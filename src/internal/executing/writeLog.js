import readline from "readline"
import { require } from "../require.js"
import { memoize } from "../memoize.js"

const stringWidth = require("string-width")

export const writeLog = (string, { stream = process.stdout } = {}) => {
  stream.write(`${string}
`)

  const streamModified = spyStreamModification(stream)

  const remove = memoize(() => {
    const { columns = 80 } = stream
    const logLines = string.split(/\r\n|\r|\n/)
    let visualLineCount = 0
    logLines.forEach((logLine) => {
      const width = stringWidth(logLine)
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns)
    })

    while (visualLineCount--) {
      readline.cursorTo(stream, 0)
      readline.clearLine(stream, 0)
      readline.moveCursor(stream, 0, -1)
    }
  })

  let updated = false
  const update = (newString) => {
    if (updated) {
      throw new Error(`cannot update twice`)
    }
    updated = true

    if (!streamModified()) {
      remove()
    }
    return writeLog(newString, { stream })
  }

  return {
    remove,
    update,
  }
}

const spyStreamModification = (stream) => {
  let modified = false
  const dataListener = () => {
    modified = true
  }
  stream.once("data", dataListener)
  return () => {
    stream.removeListener("data", dataListener)
    return modified
  }
}