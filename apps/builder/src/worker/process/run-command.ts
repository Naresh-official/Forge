import { spawn } from "child_process"

export interface RunCommandOptions {
  cwd: string
  env?: NodeJS.ProcessEnv

  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
}

export function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    child.stdout.on("data", (data: Buffer) => {
      options.onStdout?.(data.toString())
    })

    child.stderr.on("data", (data: Buffer) => {
      options.onStderr?.(data.toString())
    })

    child.on("error", reject)

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command "${command}" exited with code ${code}`))
    })
  })
}
