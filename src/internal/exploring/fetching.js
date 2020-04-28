import { memoize } from "../memoize.js"

export const fetchUrl =
  typeof window.fetch === "function" && typeof window.AbortController === "function"
    ? fetchNative
    : fetchPolyfill

const fetchNative = async (url, { cancellationToken, ...options } = {}) => {
  const abortController = new AbortController()

  let cancelError
  cancellationToken.register((reason) => {
    cancelError = reason
    abortController.abort(reason)
  })

  let response
  try {
    response = await window.fetch(url, {
      signal: abortController.signal,
      ...options,
    })
  } catch (e) {
    if (cancelError && e.name === "AbortError") {
      throw cancelError
    }
    throw e
  }

  return response
}

const fetchPolyfill = async (...args) => {
  const { fetchUsingXHR } = await loadPolyfill()
  return fetchUsingXHR(...args)
}

const loadPolyfill = memoize(() => import("../fetchUsingXHR.js"))
