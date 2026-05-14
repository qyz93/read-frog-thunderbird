#!/usr/bin/env node
import { runWxt } from "./lib/run-wxt.mjs"

await runWxt(["prepare"], {
  env: {
    WXT_SKIP_ENV_VALIDATION: "true",
  },
})
