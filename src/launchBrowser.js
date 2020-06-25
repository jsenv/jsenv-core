/* eslint-disable import/max-dependencies */
// https://github.com/microsoft/playwright/blob/master/docs/api.md

import { createCancellationToken, createStoppableOperation } from "@jsenv/cancellation"
import { teardownSignal } from "@jsenv/node-signals"
import { trackRessources } from "./internal/trackRessources.js"
import { require } from "./internal/require.js"
import { fetchUrl } from "./internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "./internal/validateResponseStatusIsOk.js"
import { trackPageToNotify } from "./internal/browser-launcher/trackPageToNotify.js"
import { createSharing } from "./internal/browser-launcher/createSharing.js"
import { executeHtmlFile } from "./internal/browser-launcher/executeHtmlFile.js"

const playwright = require("playwright-core")

const chromiumSharing = createSharing()

export const launchChromium = async ({
  cancellationToken = createCancellationToken(),
  chromiumExecutablePath,
  browserServerLogLevel,

  projectDirectoryUrl,
  compileServerOrigin,

  headless = true,
  // about debug check https://github.com/microsoft/playwright/blob/master/docs/api.md#browsertypelaunchserveroptions
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? chromiumSharing.getSharingToken({ chromiumExecutablePath, headless, debug, debugPort })
    : chromiumSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("chromium", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: chromiumExecutablePath,
        ...(debug ? { devtools: true } : {}),
        args: [
          // https://github.com/GoogleChrome/puppeteer/issues/1834
          // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
          // "--disable-dev-shm-usage",
          ...(debug ? [`--remote-debugging-port=${debugPort}`] : []),
        ],
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint()
    const webSocketUrl = new URL(webSocketEndpoint)
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`
    const browserResponse = await fetchUrl(browserEndpoint, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const { valid, message } = validateResponseStatusIsOk(browserResponse)
    if (!valid) {
      throw new Error(message)
    }

    const browserResponseObject = JSON.parse(browserResponse.body)
    const { webSocketDebuggerUrl } = browserResponseObject
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`)
  }

  return {
    browser,
    name: "chromium",
    version: "82.0.4057.0",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,

      projectDirectoryUrl,
      compileServerOrigin,
    }),
  }
}

export const launchChromiumTab = (namedArgs) =>
  launchChromium({
    share: true,
    ...namedArgs,
  })

const firefoxSharing = createSharing()

export const launchFirefox = async ({
  cancellationToken = createCancellationToken(),
  firefoxExecutablePath,
  browserServerLogLevel,

  projectDirectoryUrl,
  compileServerOrigin,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? firefoxSharing.getSharingToken({ firefoxExecutablePath, headless })
    : firefoxSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("firefox", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: firefoxExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  return {
    browser,
    name: "firefox",
    version: "73.0b13",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,

      projectDirectoryUrl,
      compileServerOrigin,
    }),
  }
}

export const launchFirefoxTab = (namedArgs) =>
  launchFirefox({
    share: true,
    ...namedArgs,
  })

const webkitSharing = createSharing()

export const launchWebkit = async ({
  cancellationToken = createCancellationToken(),
  webkitExecutablePath,
  browserServerLogLevel,

  projectDirectoryUrl,
  compileServerOrigin,

  headless = true,
  stopOnExit = true,
  share = false,
}) => {
  const ressourceTracker = trackRessources()
  const sharingToken = share
    ? webkitSharing.getSharingToken({ webkitExecutablePath, headless })
    : webkitSharing.getUniqueSharingToken()

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("webkit", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: webkitExecutablePath,
      },
      stopOnExit,
    })
    sharingToken.setSharedValue(launchOperation)
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue()
  ressourceTracker.registerCleanupCallback(stopUsingBrowser)

  const browser = await launchOperation

  return {
    browser,
    name: "webkit",
    version: "13.0.4",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,

      projectDirectoryUrl,

      compileServerOrigin,
    }),
  }
}

export const launchWebkitTab = (namedArgs) =>
  launchWebkit({
    share: true,
    ...namedArgs,
  })

const launchBrowser = async (
  browserName,
  { cancellationToken, ressourceTracker, options, stopOnExit },
) => {
  const browserClass = playwright[browserName]
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      try {
        const result = await browserClass.launch({
          ...options,
          // let's handle them to close properly browser, remove listener
          // and so on, instead of relying on puppetter
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false,
        })
        return result
      } catch (e) {
        if (cancellationToken.cancellationRequested && isTargetClosedError(e)) {
          return e
        }
        throw e
      }
    },
    stop: async (browser) => {
      await browser.close()
      if (browser.isConnected()) {
        await new Promise((resolve) => {
          const disconnectedCallback = () => {
            browser.removeListener("disconnected", disconnectedCallback)
            resolve()
          }
          browser.on("disconnected", disconnectedCallback)
        })
      }
    },
  })
  ressourceTracker.registerCleanupCallback(launchOperation.stop)

  if (stopOnExit) {
    const unregisterProcessTeadown = teardownSignal.addCallback((reason) => {
      launchOperation.stop(`process ${reason}`)
    })
    ressourceTracker.registerCleanupCallback(unregisterProcessTeadown)
  }

  return launchOperation
}

const browserToRuntimeHooks = (
  browser,
  {
    cancellationToken,
    ressourceTracker,

    projectDirectoryUrl,
    compileServerOrigin,
  },
) => {
  const disconnected = new Promise((resolve) => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", resolve)
  })

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }

  const executeFile = async (
    fileRelativeUrl,
    {
      // because we use a self signed certificate
      ignoreHTTPSErrors = true,
    },
  ) => {
    // open a tab to execute to the file
    const browserContext = await browser.newContext({ ignoreHTTPSErrors })
    const page = await browserContext.newPage()
    ressourceTracker.registerCleanupCallback(async () => {
      try {
        await browserContext.close()
      } catch (e) {
        if (isTargetClosedError(e)) {
          return
        }
        throw e
      }
    })
    // track tab error and console
    const stopTrackingToNotify = trackPageToNotify(page, {
      onError: (error) => {
        errorCallbackArray.forEach((callback) => {
          callback(error)
        })
      },
      onConsole: ({ type, text }) => {
        consoleCallbackArray.forEach((callback) => {
          callback({ type, text })
        })
      },
    })
    ressourceTracker.registerCleanupCallback(stopTrackingToNotify)
    return executeHtmlFile(fileRelativeUrl, {
      cancellationToken,

      projectDirectoryUrl,
      compileServerOrigin,

      page,
    })
  }

  return {
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const isTargetClosedError = (error) => {
  if (error.message.match(/^Protocol error \(.*?\): Target closed/)) {
    return true
  }
  if (error.message.match(/^Protocol error \(.*?\): Browser has been closed/)) {
    return true
  }
  return false
}
