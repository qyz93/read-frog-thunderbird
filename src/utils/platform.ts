export type PlatformTarget = "browser" | "thunderbird"

export interface PlatformCapabilities {
  canTranslateWebPages: boolean
  canTranslateMailMessages: boolean
  hasBrowserSidePanel: boolean
  hasOffscreenAudio: boolean
  hasVideoSubtitles: boolean
  hasInputTranslation: boolean
}

export function getPlatformTarget(browser = import.meta.env.BROWSER): PlatformTarget {
  return browser === "thunderbird" ? "thunderbird" : "browser"
}

export function getPlatformCapabilities(target: PlatformTarget = getPlatformTarget()): PlatformCapabilities {
  if (target === "thunderbird") {
    return {
      canTranslateWebPages: false,
      canTranslateMailMessages: true,
      hasBrowserSidePanel: false,
      hasOffscreenAudio: false,
      hasVideoSubtitles: false,
      hasInputTranslation: false,
    }
  }

  return {
    canTranslateWebPages: true,
    canTranslateMailMessages: false,
    hasBrowserSidePanel: true,
    hasOffscreenAudio: import.meta.env.BROWSER !== "firefox",
    hasVideoSubtitles: true,
    hasInputTranslation: true,
  }
}

export const PLATFORM_TARGET = getPlatformTarget()
export const PLATFORM_CAPABILITIES = getPlatformCapabilities(PLATFORM_TARGET)
