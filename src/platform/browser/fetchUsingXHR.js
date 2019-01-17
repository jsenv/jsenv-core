export const fetchUsingXHR = (url, headers = {}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.ontimeout = () => {
      reject({
        name: "REQUEST_TIMEOUT_ERROR",
      })
    }

    xhr.onerror = (error) => {
      reject(error)
    }

    xhr.onload = () => {
      if (xhr.status === 0) {
        resolve({
          ...normalizeXhr(xhr),
          status: 200,
        })

        return
      }
      resolve({
        ...normalizeXhr(xhr),
      })
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) {
        return
      }

      // in Chrome on file:/// URLs, status is 0
      if (xhr.status === 0) {
        if (xhr.responseText) {
          xhr.onload()
        }
        return
      }

      resolve(normalizeXhr(xhr))
    }

    xhr.open("GET", url, true)
    Object.keys(headers).forEach((key) => {
      xhr.setRequestHeader(key, headers[key])
    })
    xhr.send(null)
  })
}

const normalizeXhr = (xhr) => {
  return {
    // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
    url: xhr.responseURL,
    status: xhr.status,
    statusText: xhr.statusText,
    headers: getHeadersFromXHR(xhr),
    body: xhr.responseText,
  }
}

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example
const getHeadersFromXHR = (xhr) => {
  const headerMap = {}

  const headersString = xhr.getAllResponseHeaders()
  if (headersString === "") return headerMap

  const lines = headersString.trim().split(/[\r\n]+/)
  lines.forEach((line) => {
    const parts = line.split(": ")
    const name = parts.shift()
    const value = parts.join(": ")
    headerMap[name.toLowerCase()] = value
  })

  return headerMap
}
