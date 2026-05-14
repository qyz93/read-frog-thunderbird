import { describe, expect, it } from "vitest"
import {
  REQUIRED_HOST_PERMISSIONS,
  REQUIRED_PERMISSIONS,
  validateThunderbirdManifest,
} from "../lib/thunderbird-build-validation.mjs"

function createValidManifest(overrides = {}) {
  return {
    manifest_version: 3,
    name: "Read Frog",
    version: "1.33.5",
    permissions: [...REQUIRED_PERMISSIONS],
    host_permissions: [...REQUIRED_HOST_PERMISSIONS],
    background: {
      scripts: ["background.js"],
      type: "module",
    },
    message_display_action: {
      default_popup: "/popup.html",
    },
    options_ui: {
      page: "/options.html",
    },
    browser_specific_settings: {
      gecko: {
        strict_min_version: "150.0",
      },
    },
    ...overrides,
  }
}

describe("thunderbird build validation", () => {
  it("accepts the intended MailExtension manifest surface", () => {
    expect(validateThunderbirdManifest(createValidManifest())).toEqual([])
  })

  it("rejects browser-only entrypoints and permissions", () => {
    const errors = validateThunderbirdManifest(createValidManifest({
      content_scripts: [{ matches: ["*://*/*"], js: ["content.js"] }],
      action: { default_popup: "popup.html" },
      side_panel: { default_path: "/sidepanel.html" },
      offscreen: { documents: [] },
      permissions: [...REQUIRED_PERMISSIONS, "contextMenus", "webNavigation", "tabs"],
    }))

    expect(errors).toEqual(expect.arrayContaining([
      "manifest must not include content_scripts",
      "manifest must not include action",
      "manifest must not include side_panel",
      "manifest must not include offscreen",
      "forbidden browser permissions present: contextMenus, webNavigation, tabs",
    ]))
  })

  it("rejects broad host permissions for mail translation", () => {
    const errors = validateThunderbirdManifest(createValidManifest({
      host_permissions: ["*://*/*"],
    }))

    expect(errors).toEqual(expect.arrayContaining([
      "missing Thunderbird host permissions: https://*/*, http://localhost/*, http://127.0.0.1/*, http://[::1]/*",
      "unexpected Thunderbird host permissions: *://*/*",
    ]))
  })

  it("rejects service worker background manifests", () => {
    const errors = validateThunderbirdManifest(createValidManifest({
      background: {
        service_worker: "background.js",
        type: "module",
      },
    }))

    expect(errors).toEqual(expect.arrayContaining([
      "manifest must not include background.service_worker; Thunderbird currently requires background.scripts",
      "manifest must include background.scripts",
      "manifest background.scripts must include background.js",
    ]))
  })
})
