import { describe, expect, it } from "vitest"
import { getPlatformCapabilities, getPlatformTarget } from "@/utils/platform"

describe("platform target helpers", () => {
  it("maps Thunderbird to the mail target", () => {
    expect(getPlatformTarget("thunderbird")).toBe("thunderbird")
  })

  it("treats regular extension browsers as the browser target", () => {
    expect(getPlatformTarget("chrome")).toBe("browser")
    expect(getPlatformTarget("firefox")).toBe("browser")
  })

  it("exposes Thunderbird mail-only capabilities", () => {
    expect(getPlatformCapabilities("thunderbird")).toEqual({
      canTranslateWebPages: false,
      canTranslateMailMessages: true,
      hasBrowserSidePanel: false,
      hasOffscreenAudio: false,
      hasVideoSubtitles: false,
      hasInputTranslation: false,
    })
  })
})
