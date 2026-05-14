import type { ProviderConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { isMailProviderAllowedForSensitiveUpload } from "../mail-message-translation"

function provider(baseURL?: string): ProviderConfig {
  return {
    id: "deeplx",
    name: "DeepLX",
    provider: "deeplx",
    enabled: true,
    baseURL,
  }
}

describe("thunderbird mail provider privacy guard", () => {
  it("allows HTTPS providers", () => {
    expect(isMailProviderAllowedForSensitiveUpload(provider("https://api.example.test/v1"))).toBe(true)
  })

  it("allows local HTTP providers", () => {
    expect(isMailProviderAllowedForSensitiveUpload(provider("http://localhost:11434/v1"))).toBe(true)
    expect(isMailProviderAllowedForSensitiveUpload(provider("http://127.0.0.1:11434/v1"))).toBe(true)
  })

  it("rejects arbitrary HTTP providers", () => {
    expect(isMailProviderAllowedForSensitiveUpload(provider("http://api.example.test/v1"))).toBe(false)
  })
})
