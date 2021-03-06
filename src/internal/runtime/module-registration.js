import { createDetailedMessage } from "@jsenv/logger"

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

const fromFunctionReturningRegisteredModule = (fn, data) => {
  try {
    return fn()
  } catch (error) {
    if (error.name === "SyntaxError") {
      throw new Error(
        createDetailedMessage(`Syntax error in module.`, {
          "syntax error stack": error.stack,
          ...getModuleDetails(data),
        }),
      )
    }
    throw new Error(
      createDetailedMessage(`Module instantiation error.`, {
        ["instantiation error stack"]: error.stack,
        ...getModuleDetails(data),
      }),
    )
  }
}

export const fromUrl = async ({
  url,
  importerUrl,
  fetchSource,
  instantiateJavaScript,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
}) => {
  let moduleResponse
  try {
    moduleResponse = await fetchSource(url, {
      importerUrl,
    })

    if (moduleResponse.status === 404) {
      throw new Error(
        createDetailedMessage(
          `Module file cannot be found.`,
          getModuleDetails({
            url,
            importerUrl,
            compileServerOrigin,
            compileDirectoryRelativeUrl,
            notFound: true,
          }),
        ),
      )
    }
  } catch (e) {
    e.code = "NETWORK_FAILURE"
    throw e
  }

  const contentType = moduleResponse.headers["content-type"] || ""

  if (moduleResponse.status === 500 && contentType === "application/json") {
    const bodyAsJson = await moduleResponse.json()
    if (bodyAsJson.message && bodyAsJson.filename && "columnNumber" in bodyAsJson) {
      const error = new Error(
        createDetailedMessage(`Module file cannot be parsed.`, {
          ["parsing error message"]: bodyAsJson.message,
          ...getModuleDetails({
            url,
            importerUrl,
            compileServerOrigin,
            compileDirectoryRelativeUrl,
          }),
        }),
      )
      error.parsingError = bodyAsJson
      throw error
    }
  }

  if (moduleResponse.status < 200 || moduleResponse.status >= 300) {
    throw new Error(
      createDetailedMessage(`Module file response status is unexpected.`, {
        ["status"]: moduleResponse.status,
        ["allowed status"]: "200 to 299",
        ["statusText"]: moduleResponse.statusText,
        ...getModuleDetails({
          url,
          importerUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl,
        }),
      }),
    )
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
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
  }

  if (contentType === "application/json" || contentType === "application/importmap+json") {
    const bodyAsJson = await moduleResponse.json()
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: bodyAsJson,
        }
      },
      {
        url: moduleResponse.url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
  }

  if (contentTypeShouldBeReadAsText(contentType)) {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: moduleResponse.url,
        }
      },
      {
        url: moduleResponse.url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      },
    )
  }

  if (contentType) {
    // for now content type different of javascript are not unusual anymore
    // ideally we would not use static import to tell rollup we have a dependency to an url
    // insetad we would write something that would be compatible with web strandard such as
    // new URL('./whatever', import.meta.url)
    // or import.meta.resolve('./whatever')
    //     console.warn(`Module content-type is unusual.
    // ['content-type']:   // ${contentType}
    // ['allowed content-type']:   // application/javascript
    // application/json
    // text/*
    // ${getModuleDetails({ url, importerUrl, compileServerOrigin, outDirectoryRelativeUrl })}`)
  } else {
    console.warn(`Module content-type is missing.`, {
      ["allowed content-type"]: ["aplication/javascript", "application/json", "text/*"],
      ...getModuleDetails({
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
      }),
    })
  }

  return fromFunctionReturningNamespace(
    () => {
      return {
        default: moduleResponse.url,
      }
    },
    {
      url: moduleResponse.url,
      importerUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    },
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

// const textToBase64 =
//   typeof window === "object"
//     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
//     : (text) => Buffer.from(text, "utf8").toString("base64")

const getModuleDetails = ({
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  notFound = false,
}) => {
  const relativeUrl = tryToFindProjectRelativeUrl(url, {
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

  const importerRelativeUrl = tryToFindProjectRelativeUrl(importerUrl, {
    compileServerOrigin,
    compileDirectoryRelativeUrl,
  })

  const details = notFound
    ? {
        ...(importerUrl ? { ["import declared in"]: importerRelativeUrl || importerUrl } : {}),
        ...(relativeUrl ? { file: relativeUrl } : {}),
        ["file url"]: url,
      }
    : {
        ...(relativeUrl ? { file: relativeUrl } : {}),
        ["file url"]: url,
        ...(importerUrl ? { ["imported by"]: importerRelativeUrl || importerUrl } : {}),
      }

  return details
}

export const tryToFindProjectRelativeUrl = (
  url,
  { compileServerOrigin, compileDirectoryRelativeUrl },
) => {
  if (!url) {
    return null
  }

  if (!url.startsWith(`${compileServerOrigin}/`)) {
    return null
  }

  if (url === compileServerOrigin) {
    return null
  }

  const afterOrigin = url.slice(`${compileServerOrigin}/`.length)
  if (!afterOrigin.startsWith(compileDirectoryRelativeUrl)) {
    return null
  }

  const afterCompileDirectory = afterOrigin.slice(compileDirectoryRelativeUrl.length)
  return afterCompileDirectory
}
