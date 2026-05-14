import { useEffect, useState } from "react"
import { sendMessage } from "@/utils/message"

interface MailState {
  available: boolean
  translated: boolean
  nodes: number
  messageCount: number
  subject?: string
  consentGranted: boolean
  error?: string
}

type ToggleResult
  = | { ok: true, translated: boolean, nodes: number }
    | { ok: false, reason: string, message?: string }

function getResultMessage(result: ToggleResult) {
  if (result.ok) {
    return result.translated
      ? `Translated ${result.nodes} text segment${result.nodes === 1 ? "" : "s"}.`
      : "Original mail restored."
  }

  return result.message ?? "Mail translation failed."
}

export function ThunderbirdPopupApp() {
  const [mailState, setMailState] = useState<MailState | null>(null)
  const [status, setStatus] = useState<string>("")
  const [isBusy, setIsBusy] = useState(false)

  async function refreshState() {
    const state = await sendMessage("getCurrentMailTranslationState", undefined)
    setMailState(state)
  }

  useEffect(() => {
    void refreshState().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to read Thunderbird mail state.")
    })
  }, [])

  async function grantConsentAndTranslate() {
    setIsBusy(true)
    setStatus("")
    try {
      await sendMessage("setMailSensitiveDataConsent", { granted: true })
      const result = await sendMessage("toggleCurrentMailTranslation", { enabled: true })
      setStatus(getResultMessage(result))
      await refreshState()
    }
    catch (error) {
      setStatus(error instanceof Error ? error.message : "Mail translation failed.")
    }
    finally {
      setIsBusy(false)
    }
  }

  async function toggleTranslation() {
    if (!mailState) {
      return
    }

    setIsBusy(true)
    setStatus("")
    try {
      const result = await sendMessage("toggleCurrentMailTranslation", { enabled: !mailState.translated })
      setStatus(getResultMessage(result))
      await refreshState()
    }
    catch (error) {
      setStatus(error instanceof Error ? error.message : "Mail translation failed.")
    }
    finally {
      setIsBusy(false)
    }
  }

  return (
    <main className="w-[320px] bg-background p-4 text-sm text-foreground">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">Read Frog for Thunderbird</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Mail reading translation
          </p>
        </div>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => void sendMessage("openOptionsPage", undefined)}
        >
          Options
        </button>
      </div>

      {!mailState && (
        <div className="rounded border p-3 text-muted-foreground">
          Reading current message...
        </div>
      )}

      {mailState && !mailState.available && (
        <div className="rounded border border-dashed p-3 text-muted-foreground">
          Open an email message in Thunderbird to translate it.
        </div>
      )}

      {mailState?.available && (
        <div className="space-y-3">
          <div className="rounded border p-3">
            <p className="font-medium">
              {mailState.subject || `${mailState.messageCount} displayed message${mailState.messageCount === 1 ? "" : "s"}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mailState.translated ? `${mailState.nodes} translated segment${mailState.nodes === 1 ? "" : "s"}` : "Original message"}
            </p>
          </div>

          {!mailState.consentGranted && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-950">
              <p className="font-medium">Mail content sharing is off</p>
              <p className="mt-1 text-xs">
                Translation sends selected email text to your configured provider only after you approve it.
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded bg-amber-600 px-3 py-2 text-white disabled:opacity-60"
                disabled={isBusy}
                onClick={() => void grantConsentAndTranslate()}
              >
                Approve and Translate
              </button>
            </div>
          )}

          {mailState.consentGranted && (
            <button
              type="button"
              className="w-full rounded bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
              disabled={isBusy}
              onClick={() => void toggleTranslation()}
            >
              {mailState.translated ? "Show Original" : "Translate Mail"}
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            Select text in the email and use the context menu for quick translate or explain.
          </p>
        </div>
      )}

      {(status || mailState?.error) && (
        <p className="mt-3 rounded bg-muted p-2 text-xs text-muted-foreground">
          {status || mailState?.error}
        </p>
      )}
    </main>
  )
}
