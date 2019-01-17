import { Script } from "vm"

export const evalSource = (code, { localFile }) => {
  // This filename is very important because it allows the engine (like vscode) to know
  // that the evaluated file is in fact on the filesystem
  // (very important for debugging and sourcenap resolution)
  const script = new Script(code, { filename: localFile })
  return script.runInThisContext()
}
