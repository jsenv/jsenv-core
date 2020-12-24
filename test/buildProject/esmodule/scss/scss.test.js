import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, readFile } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvCompilerForSass } from "@jsenv/core/packages/jsenv-sass/main.js"
import { buildProject } from "@jsenv/core"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
  },
  customCompilers: [jsenvCompilerForSass],
})

const mainScssBuildRelativeUrl = buildMappings[`${testDirectoryRelativeUrl}main.scss`]
const mainScssBuildUrl = resolveUrl(`./dist/esmodule/${mainScssBuildRelativeUrl}`, import.meta.url)
const mainScssSource = await readFile(mainScssBuildUrl, { as: "string" })

// ensure scss was transformed to css
const actual = mainScssSource.includes("$color")
const expected = false
assert({ actual, expected })
