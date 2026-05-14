import { PLATFORM_TARGET } from "@/utils/platform"

const BROWSER_ROUTE_DEFS = [
  { path: "/" },
  { path: "/api-providers" },
  { path: "/custom-actions" },
  { path: "/translation" },
  { path: "/video-subtitles" },
  { path: "/floating-button" },
  { path: "/selection-toolbar" },
  { path: "/context-menu" },
  { path: "/input-translation" },
  ...(import.meta.env.BROWSER === "firefox" ? [] : [{ path: "/tts" }]),
  { path: "/statistics" },
  { path: "/config" },
] as const

const THUNDERBIRD_ROUTE_DEFS = [
  { path: "/" },
  { path: "/api-providers" },
  { path: "/custom-actions" },
  { path: "/translation" },
  { path: "/context-menu" },
  { path: "/statistics" },
] as const

export const ROUTE_DEFS = [
  ...(PLATFORM_TARGET === "thunderbird" ? THUNDERBIRD_ROUTE_DEFS : BROWSER_ROUTE_DEFS),
] as const
