import { createDetailedMessage } from "@jsenv/logger"
import { isCancelError } from "@jsenv/cancellation/main.browser.js"

import { fetchJson } from "../browser-utils/fetchJson.js"

export const fetchExploringJson = async ({ cancellationToken } = {}) => {
  try {
    const exploringInfo = await fetchJson("/.jsenv/exploring.json", {
      cancellationToken,
    })
    return exploringInfo
  } catch (e) {
    if (isCancelError(e)) {
      throw e
    }
    throw new Error(
      createDetailedMessage(`Cannot communicate with exploring server due to a network error`, {
        ["error stack"]: e.stack,
      }),
    )
  }
}
