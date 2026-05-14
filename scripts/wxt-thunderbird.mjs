#!/usr/bin/env node
import process from "node:process"
import { runWxt } from "./lib/run-wxt.mjs"

const command = process.argv[2] ?? "build"
const args = command === "dev"
  ? ["-b", "thunderbird", "--mv3"]
  : ["build", "-b", "thunderbird", "--mv3"]

await runWxt(args, {
  env: {
    WXT_SKIP_ENV_VALIDATION: process.env.WXT_SKIP_ENV_VALIDATION ?? "true",
  },
})
