import fs from "fs"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { serveFile } from "../serveFile.js/index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

{
  const ressource = "/src/requestToFileResponse/test/file.js"
  const actual = await serveFile(`${projectFolder}${ressource}`, {
    cacheStrategy: "etag",
  })
  const content = String(fs.readFileSync(`${projectFolder}${ressource}`))
  const length = Buffer.byteLength(content)
  const expected = {
    status: 200,
    headers: {
      "content-type": "application/javascript",
      etag: `"54-Yd2c2D1VgsR7OyJD1YIUp5mwb54"`,
      "content-length": length,
    },
    body: content,
  }
  assert({ actual, expected })
}

{
  const ressource = "/folder/file"
  const actual = await serveFile(
    {
      method: "GET",
      ressource,
      origin: "http://domain.com",
    },
    { projectFolder, locate: ({ rootHref }) => `${rootHref}/otherfolder/otherfile` },
  )
  const expected = {
    status: 307,
    headers: {
      location: "http://domain.com/otherfolder/otherfile",
    },
  }
  assert({ actual, expected })
}
