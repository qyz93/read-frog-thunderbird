import { spawn } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const wxtBin = path.join(rootDir, "node_modules", "wxt", "bin", "wxt.mjs")

export function runWxt(args, { env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wxtBin, ...args], {
      env: {
        ...process.env,
        ...env,
      },
      shell: false,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`wxt ${args.join(" ")} exited with code ${code ?? "unknown"}`))
    })
  })
}
