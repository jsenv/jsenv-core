export const fromFunctionReturningNamespace = (fn, data) => {
  return fromFunctionReturningRegisteredModule(() => {
    // should we compute the namespace here
    // or as it is done below, defer to execute ?
    // I think defer to execute is better
    return [
      [],
      (_export) => {
        return {
          execute: () => {
            const namespace = fn()
            _export(namespace)
          },
        }
      },
    ]
  }, data)
}

export const fromFunctionReturningRegisteredModule = (fn, { url, importerUrl }) => {
  try {
    return fn()
  } catch (error) {
    throw new Error(`imported module instantiation error.
--- instantiation error stack ---
${error.stack}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }
}

export const fromUrl = async ({
  url,
  importerUrl,
  executionId,
  fetchSource,
  instantiateJavaScript,
}) => {
  const moduleResponse = await fetchSource({
    url,
    importerUrl,
    executionId,
  })

  if (moduleResponse.status === 404) {
    throw new Error(`imported module not found.
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  const contentType = moduleResponse.headers["content-type"] || ""

  if (moduleResponse.status === 500 && contentType === "application/json") {
    const bodyAsJson = await moduleResponse.json()
    if (bodyAsJson.message && bodyAsJson.filename && "columnNumber" in bodyAsJson) {
      const error = new Error(`imported module parsing error.
--- parsing error message ---
${bodyAsJson.message}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
      error.parsingError = bodyAsJson
      throw error
    }
  }

  if (moduleResponse.status < 200 || moduleResponse.status >= 300) {
    throw new Error(`imported module response unsupported status.
--- status ---
${moduleResponse.status}
--- allowed status
200 to 299
--- statusText ---
${moduleResponse.statusText}
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  // don't forget to keep it close to https://github.com/systemjs/systemjs/blob/9a15cfd3b7a9fab261e1848b1b2fa343d73afedb/src/extras/module-types.js#L21
  // and in sync with loadModule in createJsenvRollupPlugin.js
  if (contentType === "application/javascript" || contentType === "text/javascript") {
    const bodyAsText = await moduleResponse.text()
    return fromFunctionReturningRegisteredModule(
      () => instantiateJavaScript(bodyAsText, moduleResponse.url),
      {
        url: moduleResponse.url,
        importerUrl,
      },
    )
  }

  if (contentType === "application/json") {
    const bodyAsJson = await moduleResponse.json()
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: bodyAsJson,
        }
      },
      { url: moduleResponse.url, importerUrl },
    )
  }

  if (contentTypeShouldBeReadAsText(contentType)) {
    const bodyAsText = await moduleResponse.text()
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: bodyAsText,
        }
      },
      { url: moduleResponse.url, importerUrl },
    )
  }

  if (contentType) {
    console.warn(`Module handled as base64 text because of its content-type.
--- content-type ---
${contentType}
--- allowed content-type ---
application/javascript
application/json
text/*
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  } else {
    console.warn(`Module handled as base64 text because of missing content-type.
--- allowed content-type ---
application/javascript
application/json
text/*
--- url ---
${url}
--- importer url ---
${importerUrl}`)
  }

  const bodyAsText = await moduleResponse.text()
  const bodyAsBase64 = textToBase64(bodyAsText)
  return fromFunctionReturningNamespace(
    () => {
      return {
        default: bodyAsBase64,
      }
    },
    { url: moduleResponse.url, importerUrl },
  )
}

const contentTypeShouldBeReadAsText = (contentType) => {
  if (contentType.startsWith("text/")) {
    return true
  }
  if (contentType === "image/svg+xml") {
    return true
  }
  return false
}

const textToBase64 =
  typeof window === "object"
    ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
    : (text) => Buffer.from(text, "utf8").toString("base64")
