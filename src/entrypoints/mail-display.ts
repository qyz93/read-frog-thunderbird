import "@/utils/zod-config"

import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { defineUnlistedScript } from "#imports"
import { Sha256Hex } from "@/utils/hash"
import { onMessage, sendMessage } from "@/utils/message"
import { getWordExplainPrompt } from "@/utils/prompts/word-explain"

interface TranslatedNode {
  originalText: string
  container: HTMLElement
}

const translatedNodes: TranslatedNode[] = []
let overlay: HTMLElement | null = null

function ensureMailStyles() {
  if (document.getElementById("read-frog-mail-styles")) {
    return
  }

  const style = document.createElement("style")
  style.id = "read-frog-mail-styles"
  style.textContent = `
    .read-frog-mail-pair {
      display: inline;
    }
    .read-frog-mail-translation {
      display: block;
      margin: 0.35em 0 0.65em;
      padding-inline-start: 0.75em;
      border-inline-start: 3px solid #22c55e;
      color: #14532d;
      font-size: 0.96em;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .read-frog-mail-original-hidden {
      display: none;
    }
    .read-frog-mail-overlay {
      position: fixed;
      z-index: 2147483647;
      right: 18px;
      bottom: 18px;
      width: min(420px, calc(100vw - 36px));
      max-height: min(460px, calc(100vh - 36px));
      overflow: auto;
      box-sizing: border-box;
      padding: 14px 16px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      background: #ffffff;
      color: #111827;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.24);
      font: 13px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      white-space: pre-wrap;
    }
    .read-frog-mail-overlay-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .read-frog-mail-overlay button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }
  `
  document.documentElement.append(style)
}

function isSkippableTextNode(textNode: Text, minCharacters: number) {
  const text = textNode.nodeValue?.trim() ?? ""
  if (text.length < minCharacters) {
    return true
  }

  const parent = textNode.parentElement
  if (!parent) {
    return true
  }

  if (parent.closest(".read-frog-mail-pair, .read-frog-mail-overlay")) {
    return true
  }

  const tagName = parent.tagName.toLowerCase()
  return ["script", "style", "noscript", "template", "svg", "math"].includes(tagName)
}

function getTextNodes(minCharacters: number) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isSkippableTextNode(node as Text, minCharacters)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  return nodes
}

function restoreMailTranslation() {
  for (const item of translatedNodes.splice(0)) {
    item.container.replaceWith(document.createTextNode(item.originalText))
  }
}

function renderTranslation(textNode: Text, translation: string, mode: Config["translate"]["mode"]) {
  const originalText = textNode.nodeValue ?? ""
  const container = document.createElement("span")
  container.className = "read-frog-mail-pair"

  const original = document.createElement("span")
  original.textContent = originalText
  if (mode === "translationOnly") {
    original.className = "read-frog-mail-original-hidden"
  }

  const translated = document.createElement("span")
  translated.className = "read-frog-mail-translation"
  translated.textContent = translation

  container.append(original, translated)
  textNode.replaceWith(container)
  translatedNodes.push({ originalText, container })
}

export async function translateMailDocument(data: {
  langConfig: Config["language"]
  providerConfig: ProviderConfig
  mode: Config["translate"]["mode"]
  minCharactersPerNode: number
  mailSubject?: string | null
}) {
  restoreMailTranslation()
  ensureMailStyles()

  const textNodes = getTextNodes(Math.max(2, data.minCharactersPerNode))
  const scheduleAt = Date.now()

  const translationRequests = textNodes.flatMap((textNode) => {
    const text = textNode.nodeValue?.trim()
    if (!text) {
      return []
    }

    const hash = Sha256Hex(
      "mail",
      data.providerConfig.id,
      data.langConfig.sourceCode,
      data.langConfig.targetCode,
      text,
    )

    const promise = sendMessage("enqueueTranslateRequest", {
      text,
      langConfig: data.langConfig,
      providerConfig: data.providerConfig,
      scheduleAt,
      hash,
      webTitle: data.mailSubject ?? document.title ?? null,
      webContent: null,
      webSummary: null,
    })

    return [{ promise, textNode }]
  })

  const results = await Promise.allSettled(
    translationRequests.map(async ({ promise, textNode }) => {
      const translation = await promise
      if (translation.trim() && textNode.isConnected) {
        renderTranslation(textNode, translation, data.mode)
        return true
      }
      return false
    }),
  )

  const translatedCount = results.filter(result => result.status === "fulfilled" && result.value).length
  const firstError = results.find(result => result.status === "rejected")
  if (translatedCount === 0 && firstError?.status === "rejected") {
    throw firstError.reason instanceof Error ? firstError.reason : new Error("Mail translation failed.")
  }

  return translatedCount
}

function showOverlay(title: string, content: string) {
  ensureMailStyles()
  overlay?.remove()

  overlay = document.createElement("section")
  overlay.className = "read-frog-mail-overlay"

  const header = document.createElement("div")
  header.className = "read-frog-mail-overlay-title"

  const titleNode = document.createElement("span")
  titleNode.textContent = title

  const closeButton = document.createElement("button")
  closeButton.type = "button"
  closeButton.textContent = "Close"
  closeButton.addEventListener("click", () => overlay?.remove())

  const body = document.createElement("div")
  body.textContent = content

  header.append(titleNode, closeButton)
  overlay.append(header, body)
  document.documentElement.append(overlay)
}

async function translateSelection(data: {
  selectionText: string
  langConfig: Config["language"]
  providerConfig: ProviderConfig
  mailSubject?: string | null
}) {
  const hash = Sha256Hex(
    "mail-selection",
    data.providerConfig.id,
    data.langConfig.sourceCode,
    data.langConfig.targetCode,
    data.selectionText,
  )

  return await sendMessage("enqueueTranslateRequest", {
    text: data.selectionText,
    langConfig: data.langConfig,
    providerConfig: data.providerConfig,
    scheduleAt: Date.now(),
    hash,
    webTitle: data.mailSubject ?? document.title ?? null,
    webContent: null,
    webSummary: null,
  })
}

async function explainSelection(data: {
  selectionText: string
  langConfig: Config["language"]
  explainProviderId?: string
}) {
  if (!data.explainProviderId) {
    throw new Error("Explain requires an enabled LLM provider.")
  }

  const sourceCode = data.langConfig.sourceCode === "auto" ? "eng" : data.langConfig.sourceCode
  const system = getWordExplainPrompt(sourceCode, data.langConfig.targetCode, data.langConfig.level)
  const context = (document.body.textContent ?? "").replace(/\s+/g, " ").slice(0, 1200)
  const response = await sendMessage("backgroundGenerateText", {
    providerId: data.explainProviderId,
    system,
    prompt: `Query text:\n${data.selectionText}\n\nContext:\n${context}`,
    maxRetries: 1,
  })
  return response.text
}

export default defineUnlistedScript({
  include: ["thunderbird"],
  main() {
    ensureMailStyles()

    onMessage("getMailDocumentTranslationState", async () => ({
      translated: translatedNodes.length > 0,
      nodes: translatedNodes.length,
    }))

    onMessage("toggleMailTranslationInContentScript", async (message) => {
      if (!message.data.enabled) {
        restoreMailTranslation()
        return { translated: false, nodes: 0 }
      }

      const nodes = await translateMailDocument(message.data)
      return { translated: nodes > 0, nodes }
    })

    onMessage("showMailSelectionErrorInContentScript", async (message) => {
      showOverlay("Read Frog", message.data.message)
      return { ok: true as const }
    })

    onMessage("showMailSelectionResultInContentScript", async (message) => {
      const { action } = message.data
      try {
        showOverlay("Read Frog", action === "translate" ? "Translating selection..." : "Explaining selection...")
        const result = action === "translate"
          ? await translateSelection(message.data)
          : await explainSelection(message.data)
        showOverlay(action === "translate" ? "Translation" : "Explanation", result)
        return { ok: true as const }
      }
      catch (error) {
        const messageText = error instanceof Error ? error.message : "Selection action failed."
        showOverlay("Read Frog", messageText)
        return { ok: false as const, message: messageText }
      }
    })
  },
})
