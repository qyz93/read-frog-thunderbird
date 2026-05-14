import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { browser, storage } from "#imports"
import { isAPIProviderConfig } from "@/types/config/provider"
import { getEnabledLLMProvidersConfig } from "@/utils/config/helpers"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"
import { logger } from "@/utils/logger"
import { onMessage, sendMessage } from "@/utils/message"
import { ensureInitializedConfig } from "./config"

const MAIL_DISPLAY_SCRIPT_ID = "read-frog-mail-display"
const MAIL_SENSITIVE_DATA_CONSENT_KEY = "readFrog.mailSensitiveDataConsent"
const MENU_ID_MAIL_SELECTION_TRANSLATE = "read-frog-mail-selection-translate"
const MENU_ID_MAIL_SELECTION_EXPLAIN = "read-frog-mail-selection-explain"

interface MailTabState {
  translated: boolean
  nodes: number
  subject?: string
}

type MailToggleResult
  = | { ok: true, translated: boolean, nodes: number }
    | { ok: false, reason: "no-message" | "consent-required" | "provider-unavailable" | "provider-blocked" | "content-script-unavailable" | "failed", message?: string }

const mailTabState = new Map<number, MailTabState>()

function getMessengerApi(): ThunderbirdMessengerApi {
  return (globalThis.messenger ?? browser) as unknown as ThunderbirdMessengerApi
}

function isLocalHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (url.protocol !== "http:") {
      return false
    }

    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "::1"
      || url.hostname === "[::1]"
  }
  catch {
    return false
  }
}

export function isMailProviderAllowedForSensitiveUpload(providerConfig: ProviderConfig): boolean {
  if (!isAPIProviderConfig(providerConfig) || !providerConfig.baseURL) {
    return true
  }

  if (providerConfig.baseURL.startsWith("https://")) {
    return true
  }

  return isLocalHttpUrl(providerConfig.baseURL)
}

async function getMailSensitiveDataConsent() {
  return await storage.getItem<boolean>(`local:${MAIL_SENSITIVE_DATA_CONSENT_KEY}`) ?? false
}

async function getActiveMailContext() {
  const messengerApi = getMessengerApi()
  const [tab] = await messengerApi.tabs.query({ active: true, currentWindow: true }) as ThunderbirdTab[]
  if (!tab?.id) {
    return null
  }

  const messages = await messengerApi.messageDisplay.getDisplayedMessages(tab.id)
  if (messages.length === 0) {
    return null
  }

  return {
    tab,
    messages,
    subject: messages.length === 1 ? messages[0]?.subject : undefined,
  }
}

async function getMailTranslationProvider(config: Config): Promise<
  | { ok: true, providerConfig: ProviderConfig, explainProviderId?: string }
  | { ok: false, reason: "provider-unavailable" | "provider-blocked", message: string }
> {
  const providerConfig = resolveProviderConfigOrNull(config, "translate")
  if (!providerConfig || !providerConfig.enabled) {
    return {
      ok: false,
      reason: "provider-unavailable",
      message: "No enabled translation provider is configured.",
    }
  }

  if (!isMailProviderAllowedForSensitiveUpload(providerConfig)) {
    return {
      ok: false,
      reason: "provider-blocked",
      message: "Mail translation refuses non-local HTTP provider endpoints. Use HTTPS or localhost.",
    }
  }

  const configuredCustomActionProviderIds = config.selectionToolbar.customActions
    .filter(action => action.enabled !== false)
    .map(action => action.providerId)
  const enabledLlmProvider = getEnabledLLMProvidersConfig(config.providersConfig)
    .find(provider => configuredCustomActionProviderIds.includes(provider.id))
    ?? getEnabledLLMProvidersConfig(config.providersConfig)[0]
  const explainProviderId = enabledLlmProvider && isMailProviderAllowedForSensitiveUpload(enabledLlmProvider)
    ? enabledLlmProvider.id
    : undefined

  return {
    ok: true,
    providerConfig,
    explainProviderId,
  }
}

async function getContentScriptState(tabId: number): Promise<{ translated: boolean, nodes: number } | null> {
  try {
    return await sendMessage("getMailDocumentTranslationState", undefined, tabId)
  }
  catch {
    return null
  }
}

async function registerMailDisplayScript() {
  const messengerApi = getMessengerApi()
  const messageDisplayScripts = messengerApi.scripting?.messageDisplay
  if (!messageDisplayScripts?.registerScripts) {
    logger.warn("[Thunderbird] scripting.messageDisplay API is unavailable")
    return
  }

  await messageDisplayScripts.unregisterScripts?.({ ids: [MAIL_DISPLAY_SCRIPT_ID] }).catch(() => {})
  await messageDisplayScripts.registerScripts([{
    id: MAIL_DISPLAY_SCRIPT_ID,
    js: ["/mail-display.js"],
    runAt: "document_idle",
  }])
}

async function setupMailMenus() {
  const menus = getMessengerApi().menus
  if (!menus?.create) {
    logger.warn("[Thunderbird] menus API is unavailable")
    return
  }

  await Promise.resolve(menus.removeAll())
  menus.create({
    id: MENU_ID_MAIL_SELECTION_TRANSLATE,
    title: "Read Frog: Translate selection",
    contexts: ["selection"],
  })
  menus.create({
    id: MENU_ID_MAIL_SELECTION_EXPLAIN,
    title: "Read Frog: Explain selection",
    contexts: ["selection"],
  })

  menus.onClicked.addListener((info, tab) => {
    void handleMailMenuClick(info, tab)
  })
}

async function showMailSelectionError(tabId: number, message: string) {
  try {
    await sendMessage("showMailSelectionErrorInContentScript", { message }, tabId)
  }
  catch (error) {
    logger.warn("[Thunderbird] Failed to show mail selection error", error)
  }
}

async function handleMailMenuClick(info: ThunderbirdMenuClickData, tab?: ThunderbirdTab) {
  if (
    info.menuItemId !== MENU_ID_MAIL_SELECTION_TRANSLATE
    && info.menuItemId !== MENU_ID_MAIL_SELECTION_EXPLAIN
  ) {
    return
  }

  if (!tab?.id) {
    return
  }

  const selectionText = info.selectionText?.trim()
  if (!selectionText) {
    return
  }

  const consentGranted = await getMailSensitiveDataConsent()
  if (!consentGranted) {
    await showMailSelectionError(tab.id, "Enable mail content sharing in the Read Frog popup before translating email text.")
    return
  }

  const config = await ensureInitializedConfig()
  if (!config) {
    await showMailSelectionError(tab.id, "Read Frog configuration is unavailable. Open options once and try again.")
    return
  }

  const providerResult = await getMailTranslationProvider(config)
  if (!providerResult.ok) {
    await showMailSelectionError(tab.id, providerResult.message)
    return
  }

  if (info.menuItemId === MENU_ID_MAIL_SELECTION_EXPLAIN && !providerResult.explainProviderId) {
    await showMailSelectionError(tab.id, "Explain requires an enabled LLM provider.")
    return
  }

  try {
    await sendMessage("showMailSelectionResultInContentScript", {
      action: info.menuItemId === MENU_ID_MAIL_SELECTION_TRANSLATE ? "translate" : "explain",
      selectionText,
      langConfig: config.language,
      providerConfig: providerResult.providerConfig,
      explainProviderId: providerResult.explainProviderId,
      mailSubject: mailTabState.get(tab.id)?.subject ?? null,
    }, tab.id)
  }
  catch (error) {
    logger.warn("[Thunderbird] Failed to route mail selection action", error)
  }
}

export function setupMailMessageTranslationHandlers() {
  void registerMailDisplayScript()
  void setupMailMenus()

  const messengerApi = getMessengerApi()
  messengerApi.messageDisplay.onMessagesDisplayed?.addListener((tab, displayedMessages) => {
    if (!tab.id) {
      return
    }

    mailTabState.set(tab.id, {
      translated: false,
      nodes: 0,
      subject: displayedMessages.length === 1 ? displayedMessages[0]?.subject : undefined,
    })
  })

  onMessage("getMailSensitiveDataConsent", async () => getMailSensitiveDataConsent())

  onMessage("setMailSensitiveDataConsent", async (message) => {
    await storage.setItem(`local:${MAIL_SENSITIVE_DATA_CONSENT_KEY}`, message.data.granted)
    return { ok: true as const }
  })

  onMessage("getCurrentMailTranslationState", async () => {
    const consentGranted = await getMailSensitiveDataConsent()
    const mailContext = await getActiveMailContext()
    if (!mailContext?.tab.id) {
      return {
        available: false,
        translated: false,
        nodes: 0,
        messageCount: 0,
        consentGranted,
      }
    }

    const scriptState = await getContentScriptState(mailContext.tab.id)
    const savedState = mailTabState.get(mailContext.tab.id)
    const state = scriptState ?? savedState ?? { translated: false, nodes: 0 }

    return {
      available: true,
      translated: state.translated,
      nodes: state.nodes,
      messageCount: mailContext.messages.length,
      subject: mailContext.subject,
      consentGranted,
      error: scriptState ? undefined : "Mail display script is not active for this message yet. Reopen the message if translation does not start.",
    }
  })

  onMessage("toggleCurrentMailTranslation", async (message): Promise<MailToggleResult> => {
    const { enabled } = message.data
    const mailContext = await getActiveMailContext()
    if (!mailContext?.tab.id) {
      return { ok: false, reason: "no-message", message: "No open mail message is available." }
    }

    if (enabled && !(await getMailSensitiveDataConsent())) {
      return { ok: false, reason: "consent-required", message: "Mail translation needs explicit consent before sending email content to a provider." }
    }

    const config = await ensureInitializedConfig()
    if (!config) {
      return { ok: false, reason: "failed", message: "Read Frog configuration is unavailable. Open options once and try again." }
    }

    const providerResult = await getMailTranslationProvider(config)
    if (!providerResult.ok) {
      return { ok: false, reason: providerResult.reason, message: providerResult.message }
    }

    try {
      const result = await sendMessage("toggleMailTranslationInContentScript", {
        enabled,
        langConfig: config.language,
        providerConfig: providerResult.providerConfig,
        mode: config.translate.mode,
        minCharactersPerNode: config.translate.page.minCharactersPerNode,
        mailSubject: mailContext.subject ?? null,
      }, mailContext.tab.id)

      mailTabState.set(mailContext.tab.id, {
        translated: result.translated,
        nodes: result.nodes,
        subject: mailContext.subject,
      })

      return { ok: true, translated: result.translated, nodes: result.nodes }
    }
    catch (error) {
      logger.error("[Thunderbird] Failed to toggle mail translation", error)
      return {
        ok: false,
        reason: "content-script-unavailable",
        message: "Mail display script is not active. Reopen the message and try again.",
      }
    }
  })
}
