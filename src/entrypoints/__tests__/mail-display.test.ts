/**
 * @vitest-environment jsdom
 */
import type { ProviderConfig } from "@/types/config/provider"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const { sendMessageMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  defineUnlistedScript: (definition: unknown) => definition,
}))

vi.mock("@/utils/message", () => ({
  onMessage: vi.fn(),
  sendMessage: sendMessageMock,
}))

const providerConfig = {
  id: "deeplx-default",
  name: "DeepLX",
  provider: "deeplx",
  enabled: true,
} satisfies ProviderConfig

describe("thunderbird mail display translation", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p>First paragraph for translation.</p>
      <p>Second paragraph for translation.</p>
      <p>Third paragraph for translation.</p>
    `
    document.title = "Test mail"
    sendMessageMock.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("enqueues all mail text nodes before awaiting translations", async () => {
    const resolvers: Array<(value: string) => void> = []
    sendMessageMock.mockImplementation(() => new Promise<string>((resolve) => {
      resolvers.push(resolve)
    }))

    const { translateMailDocument } = await import("../mail-display")
    const translationPromise = translateMailDocument({
      langConfig: DEFAULT_CONFIG.language,
      providerConfig,
      mode: "bilingual",
      minCharactersPerNode: 2,
      mailSubject: "Test mail",
    })

    await Promise.resolve()

    expect(sendMessageMock).toHaveBeenCalledTimes(3)
    const scheduleTimes = sendMessageMock.mock.calls.map(call => call[1].scheduleAt)
    expect(new Set(scheduleTimes).size).toBe(1)

    resolvers.forEach((resolve, index) => resolve(`Translated ${index + 1}`))
    await expect(translationPromise).resolves.toBe(3)

    expect(document.querySelectorAll(".read-frog-mail-translation")).toHaveLength(3)
  })
})
