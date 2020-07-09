export const appendSourceMappingAsBase64Url = (source, map) => {
  const mapAsBase64 = Buffer.from(JSON.stringify(map)).toString("base64")
  return writeSourceMappingURL(source, `data:application/json;charset=utf-8;base64,${mapAsBase64}`)
}

const writeSourceMappingURL = (source, location) => `${source}
${"//#"} sourceMappingURL=${location}`

export const appendSourceMappingAsExternalUrl = writeSourceMappingURL

export const updateSourceMappingURL = (source, callback) => {
  const sourceMappingUrlRegExp = /\/\/# ?sourceMappingURL=([^\s'"]+)/g
  let lastSourceMappingUrl
  let matchSourceMappingUrl
  while ((matchSourceMappingUrl = sourceMappingUrlRegExp.exec(source))) {
    lastSourceMappingUrl = matchSourceMappingUrl
  }
  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index
    const before = source.slice(0, index)
    const after = source.slice(index)
    const mappedAfter = after.replace(sourceMappingUrlRegExp, (match, firstGroup) => {
      return `${"//#"} sourceMappingURL=${callback(firstGroup)}`
    })
    return `${before}${mappedAfter}`
  }
  return source
}

export const readSourceMappingURL = (source) => {
  let sourceMappingURL
  updateSourceMappingURL(source, (value) => {
    sourceMappingURL = value
  })
  return sourceMappingURL
}

const base64ToString =
  typeof window === "object"
    ? window.btoa
    : (base64String) => Buffer.from(base64String, "base64").toString("utf8")

export const parseSourceMappingURL = (source) => {
  const sourceMappingURL = readSourceMappingURL(source)

  if (!sourceMappingURL) return null

  const base64Prefix = "data:application/json;charset=utf-8;base64,"
  if (sourceMappingURL.startsWith(base64Prefix)) {
    const mapBase64Source = sourceMappingURL.slice(base64Prefix.length)
    const sourcemapString = base64ToString(mapBase64Source)
    return { sourcemapString }
  }

  return {
    sourcemapURL: sourceMappingURL,
  }
}

export const writeOrUpdateSourceMappingURL = (source, location) => {
  if (readSourceMappingURL(source)) {
    return updateSourceMappingURL(source, location)
  }
  return writeSourceMappingURL(source, location)
}
