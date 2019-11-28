import { stackToString } from "./stackToString.js"
import { generateOriginalStackString } from "./getOriginalStackString.js"

export const installErrorStackRemapping = ({ fetchFile, SourceMapConsumer, indent = "  " }) => {
  if (typeof fetchFile !== "function") {
    throw new TypeError(`fetchFile must be a function, got ${fetchFile}`)
  }
  if (typeof SourceMapConsumer !== "function") {
    throw new TypeError(`sourceMapConsumer must be a function, got ${SourceMapConsumer}`)
  }
  if (typeof indent !== "string") {
    throw new TypeError(`indent must be a string, got ${indent}`)
  }

  // if browser does not support window.URL it will fail
  // but no browser got Error.captureStackTrace without window.URL
  const resolveFile = (specifier, importer) => new URL(specifier, importer).href

  const errorOriginalStackStringCache = new WeakMap()
  const errorRemapFailureCallbackMap = new WeakMap()

  let installed = false
  const previousPrepareStackTrace = Error.prepareStackTrace
  const install = () => {
    if (installed) return
    installed = true
    Error.prepareStackTrace = prepareStackTrace
  }

  const uninstall = () => {
    if (!installed) return
    installed = false
    Error.prepareStackTrace = previousPrepareStackTrace
  }

  // ensure we do not use prepareStackTrace for thoose error
  // otherwise we would recursively remap error stack
  // and if the reason causing the failure is still here
  // it would create an infinite loop
  const readErrorStack = (error) => {
    uninstall()
    const stack = error.stack
    install()
    return stack
  }

  const prepareStackTrace = (error, stack) => {
    const onFailure = (failureData) => {
      const failureCallbackArray = errorRemapFailureCallbackMap.get(error)
      if (failureCallbackArray) {
        failureCallbackArray.forEach((callback) => callback(failureData))
      }
    }

    const originalStackStringPromise = generateOriginalStackString({
      stack,
      error,
      resolveFile,
      fetchFile: memoizeFetch(fetchFile),
      SourceMapConsumer,
      readErrorStack,
      indent,
      onFailure,
    })
    errorOriginalStackStringCache.set(error, originalStackStringPromise)

    return stackToString(stack, { error, indent })
  }

  const getErrorOriginalStackString = async (
    error,
    {
      onFailure = (message) => {
        console.warn(message)
      },
    } = {},
  ) => {
    if (onFailure) {
      const remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error)
      if (remapFailureCallbackArray) {
        errorRemapFailureCallbackMap.set(error, [...remapFailureCallbackArray, onFailure])
      } else {
        errorRemapFailureCallbackMap.set(error, [onFailure])
      }
    }

    // ensure Error.prepareStackTrace gets triggered by reading error.stack now
    const { stack } = error
    const promise = errorOriginalStackStringCache.get(error)

    if (promise) {
      const originalStack = await promise
      errorRemapFailureCallbackMap.get(error)
      return originalStack
    }

    return stack
  }

  install()

  return { getErrorOriginalStackString, uninstall }
}

const memoizeFetch = (fetchUrl) => {
  const urlCache = {}
  return async (url) => {
    if (url in urlCache) {
      return urlCache[url]
    }
    const responsePromise = fetchUrl(url)
    urlCache[url] = responsePromise
    return responsePromise
  }
}
