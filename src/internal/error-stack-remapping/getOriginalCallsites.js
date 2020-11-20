import { parseDataUrl, dataUrlToRawData } from "../dataUrl.utils.js"
import { getJavaScriptSourceMappingUrl } from "../sourceMappingURLUtils.js"
import { remapCallSite } from "./remapCallSite.js"

export const getOriginalCallsites = async ({
  stack,
  resolveFile,
  fetchFile,
  SourceMapConsumer,
  readErrorStack,
  onFailure,
}) => {
  const urlToSourcemapConsumer = memoizeByFirstArgStringValue(async (stackTraceFileUrl) => {
    try {
      let text
      try {
        const fileResponse = await fetchFile(stackTraceFileUrl)
        const { status } = fileResponse
        if (status !== 200) {
          if (status === 404) {
            onFailure(`stack trace file not found at ${stackTraceFileUrl}`)
          } else {
            onFailure(`unexpected response fetching stack trace file.
--- response status ---
${status}
--- response text ---
${fileResponse.body}
--- stack trace file ---
${stackTraceFileUrl}`)
          }
          return null
        }
        text = await fileResponse.text()
      } catch (e) {
        onFailure(`error while fetching stack trace file.
--- fetch error stack ---
${readErrorStack(e)}
--- stack trace file ---
${stackTraceFileUrl}`)

        return null
      }

      const jsSourcemapUrl = getJavaScriptSourceMappingUrl(text)
      if (!jsSourcemapUrl) {
        return null
      }

      let sourcemapUrl
      let sourcemapString
      if (jsSourcemapUrl.startsWith("data:")) {
        sourcemapUrl = stackTraceFileUrl
        sourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl))
      } else {
        sourcemapUrl = resolveFile(jsSourcemapUrl, stackTraceFileUrl, {
          type: "source-map",
        })

        try {
          const sourcemapResponse = await fetchFile(sourcemapUrl)
          const { status } = sourcemapResponse
          if (status !== 200) {
            if (status === 404) {
              onFailure(`sourcemap file not found at ${sourcemapUrl}`)
            } else {
              onFailure(`unexpected response for sourcemap file.
--- response status ---
${status}
--- response text ---
${await sourcemapResponse.text()}
--- sourcemap url ---
${sourcemapUrl}`)
            }
            return null
          }
          sourcemapString = await sourcemapResponse.text()
        } catch (e) {
          onFailure(`error while fetching sourcemap.
--- fetch error stack ---
${readErrorStack(e)}
--- sourcemap url ---
${sourcemapUrl}`)
          return null
        }
      }

      let sourceMap
      try {
        sourceMap = JSON.parse(sourcemapString)
      } catch (e) {
        onFailure(`error while parsing sourcemap.
--- parse error stack ---
${readErrorStack(e)}
--- sourcemap url ---
${sourcemapUrl}`)
        return null
      }

      let { sourcesContent } = sourceMap

      if (!sourcesContent) {
        sourcesContent = []
        sourceMap.sourcesContent = sourcesContent
      }

      let firstSourceMapSourceFailure = null

      await Promise.all(
        sourceMap.sources.map(async (source, index) => {
          if (index in sourcesContent) return

          const sourcemapSourceUrl = resolveFile(source, sourcemapUrl, { type: "source" })
          try {
            const sourceResponse = await fetchFile(sourcemapSourceUrl)
            const { status } = sourceResponse
            if (status !== 200) {
              if (firstSourceMapSourceFailure) return

              if (status === 404) {
                firstSourceMapSourceFailure = `sourcemap source not found.
--- sourcemap source url ---
${sourcemapSourceUrl}
--- sourcemap url ---
${sourcemapUrl}`
                return
              }
              firstSourceMapSourceFailure = `unexpected response for sourcemap source.
  --- response status ---
  ${status}
  --- response text ---
  ${await sourceResponse.text()}
  --- sourcemap source url ---
  ${sourcemapSourceUrl}
  --- sourcemap url ---
  ${sourcemapUrl}`
              return
            }

            const sourceString = await sourceResponse.text()
            sourcesContent[index] = sourceString
          } catch (e) {
            if (firstSourceMapSourceFailure) return
            firstSourceMapSourceFailure = `error while fetching sourcemap source.
--- fetch error stack ---
${readErrorStack(e)}
--- sourcemap source url ---
${sourcemapSourceUrl}
--- sourcemap url ---
${sourcemapUrl}`
          }
        }),
      )

      if (firstSourceMapSourceFailure) {
        onFailure(firstSourceMapSourceFailure)
        return null
      }

      return new SourceMapConsumer(sourceMap)
    } catch (e) {
      onFailure(`error while preparing a sourceMap consumer for a stack trace file.
--- error stack ---
${readErrorStack(e)}
--- stack trace file ---
${stackTraceFileUrl}`)
      return null
    }
  })

  const originalCallsites = await Promise.all(
    stack.map((callSite) =>
      remapCallSite(callSite, {
        resolveFile,
        urlToSourcemapConsumer,
        readErrorStack,
        onFailure,
      }),
    ),
  )
  return originalCallsites
}

const memoizeByFirstArgStringValue = (fn) => {
  const stringValueCache = {}
  return (firstArgValue) => {
    if (firstArgValue in stringValueCache) return stringValueCache[firstArgValue]
    const value = fn(firstArgValue)
    stringValueCache[firstArgValue] = value
    return value
  }
}