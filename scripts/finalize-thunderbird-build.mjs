#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { THUNDERBIRD_BUILD_DIR } from "./lib/thunderbird-build-validation.mjs"

const buildDir = process.argv[2] ?? THUNDERBIRD_BUILD_DIR
const manifestPath = path.join(buildDir, "manifest.json")
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))

let changed = false
for (const browserActionKey of ["action", "browser_action", "page_action"]) {
  if (manifest[browserActionKey] !== undefined) {
    delete manifest[browserActionKey]
    changed = true
  }
}

if (manifest.background?.service_worker) {
  manifest.background = {
    scripts: [manifest.background.service_worker],
    ...(manifest.background.type ? { type: manifest.background.type } : {}),
  }
  changed = true
}

if (changed) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Finalized Thunderbird manifest: ${manifestPath}`)
}
else {
  console.log(`Thunderbird manifest already finalized: ${manifestPath}`)
}
