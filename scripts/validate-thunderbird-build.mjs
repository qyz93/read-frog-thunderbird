#!/usr/bin/env node
import process from "node:process"
import {
  THUNDERBIRD_BUILD_DIR,
  validateThunderbirdBuildDir,
} from "./lib/thunderbird-build-validation.mjs"

const buildDir = process.argv[2] ?? THUNDERBIRD_BUILD_DIR
const errors = await validateThunderbirdBuildDir(buildDir)

if (errors.length > 0) {
  console.error("Thunderbird manifest validation failed:")
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`Thunderbird manifest validation passed: ${buildDir}`)
