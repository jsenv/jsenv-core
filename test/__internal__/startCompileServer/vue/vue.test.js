import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { COMPILE_ID_OTHERWISE } from "@jsenv/core/src/internal/CONSTANTS.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { jsenvCompilerForVue } from "@jsenv/core/packages/jsenv-vue/main.js"
import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const filename = `main.vue`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const compiledFileRelativeUrl = `${jsenvDirectoryRelativeUrl}out/${COMPILE_ID_OTHERWISE}/${fileRelativeUrl}`
// const compiledFileUrl = `${jsenvCoreDirectoryUrl}${compiledFileRelativeUrl}`

{
  const { origin: compileServerOrigin } = await startCompileServer({
    ...COMPILE_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    customCompilers: {
      ...jsenvCompilerForVue,
    },
  })
  const vueServerUrl = `${compileServerOrigin}/${compiledFileRelativeUrl}`
  const response = await fetchUrl(vueServerUrl, { ignoreHttpsError: true })
  {
    const actual = {
      status: response.status,
      contentType: response.headers.get("content-type"),
    }
    const expected = {
      status: 200,
      contentType: "application/javascript",
    }
    assert({ actual, expected })
  }
}
