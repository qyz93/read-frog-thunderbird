import { readFile } from "node:fs/promises"
import path from "node:path"

export const THUNDERBIRD_BUILD_DIR = path.join(".output", "thunderbird-mv3")

export const REQUIRED_PERMISSIONS = [
  "storage",
  "alarms",
  "scripting",
  "messagesRead",
  "menus",
  "sensitiveDataUpload",
]

export const REQUIRED_HOST_PERMISSIONS = [
  "https://*/*",
  "http://localhost/*",
  "http://127.0.0.1/*",
  "http://[::1]/*",
]

const FORBIDDEN_TOP_LEVEL_KEYS = [
  "action",
  "browser_action",
  "content_scripts",
  "page_action",
  "side_panel",
  "offscreen",
]

const FORBIDDEN_PERMISSIONS = [
  "contextMenus",
  "webNavigation",
  "cookies",
  "identity",
  "sidePanel",
  "offscreen",
  "tabs",
]

function listMissing(actual = [], expected) {
  return expected.filter(item => !actual.includes(item))
}

function listUnexpected(actual = [], allowed) {
  return actual.filter(item => !allowed.includes(item))
}

export function validateThunderbirdManifest(manifest) {
  const errors = []

  for (const key of FORBIDDEN_TOP_LEVEL_KEYS) {
    if (manifest[key] !== undefined) {
      errors.push(`manifest must not include ${key}`)
    }
  }

  if (!manifest.message_display_action) {
    errors.push("manifest must include message_display_action")
  }

  if (!manifest.options_ui?.page) {
    errors.push("manifest must include options_ui.page")
  }

  if (manifest.background?.service_worker) {
    errors.push("manifest must not include background.service_worker; Thunderbird currently requires background.scripts")
  }

  if (!Array.isArray(manifest.background?.scripts) || manifest.background.scripts.length === 0) {
    errors.push("manifest must include background.scripts")
  }

  if (manifest.background?.scripts?.includes("background.js") !== true) {
    errors.push("manifest background.scripts must include background.js")
  }

  if (manifest.background?.type !== "module") {
    errors.push(`manifest background.type must be module, got ${manifest.background?.type ?? "undefined"}`)
  }

  const strictMinVersion = manifest.browser_specific_settings?.gecko?.strict_min_version
  if (strictMinVersion !== "150.0") {
    errors.push(`gecko.strict_min_version must be 150.0, got ${strictMinVersion ?? "undefined"}`)
  }

  const missingPermissions = listMissing(manifest.permissions, REQUIRED_PERMISSIONS)
  if (missingPermissions.length > 0) {
    errors.push(`missing Thunderbird permissions: ${missingPermissions.join(", ")}`)
  }

  const forbiddenPermissions = (manifest.permissions ?? [])
    .filter(permission => FORBIDDEN_PERMISSIONS.includes(permission))
  if (forbiddenPermissions.length > 0) {
    errors.push(`forbidden browser permissions present: ${forbiddenPermissions.join(", ")}`)
  }

  const missingHostPermissions = listMissing(manifest.host_permissions, REQUIRED_HOST_PERMISSIONS)
  if (missingHostPermissions.length > 0) {
    errors.push(`missing Thunderbird host permissions: ${missingHostPermissions.join(", ")}`)
  }

  const unexpectedHostPermissions = listUnexpected(manifest.host_permissions, REQUIRED_HOST_PERMISSIONS)
  if (unexpectedHostPermissions.length > 0) {
    errors.push(`unexpected Thunderbird host permissions: ${unexpectedHostPermissions.join(", ")}`)
  }

  return errors
}

export async function readThunderbirdManifest(buildDir = THUNDERBIRD_BUILD_DIR) {
  const manifestPath = path.join(buildDir, "manifest.json")
  const manifestJson = await readFile(manifestPath, "utf8")
  return JSON.parse(manifestJson)
}

export async function validateThunderbirdBuildDir(buildDir = THUNDERBIRD_BUILD_DIR) {
  const manifest = await readThunderbirdManifest(buildDir)
  return validateThunderbirdManifest(manifest)
}

export function assertValidThunderbirdManifest(manifest) {
  const errors = validateThunderbirdManifest(manifest)
  if (errors.length > 0) {
    throw new Error(`Thunderbird manifest validation failed:\n- ${errors.join("\n- ")}`)
  }
}
