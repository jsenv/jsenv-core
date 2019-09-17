import { readFileSync } from "fs"
import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { jsenvCorePathname, compileJs } from "../../../index.js"
import { fileHrefToFolderRelativePath } from "../../fileHrefToFolderRelativePath.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const projectPathname = jsenvCorePathname
const folderRelativePath = fileHrefToFolderRelativePath(import.meta.url)
const sourceRelativePath = `${folderRelativePath}/global-this.js`
const filename = pathnameToOperatingSystemPath(`${projectPathname}${sourceRelativePath}`)
const source = readFileSync(filename).toString()

const actual = await compileJs({
  projectPathname,
  sourceRelativePath,
  babelPluginMap: jsenvBabelPluginMap,
})
const expected = {
  compiledSource: actual.compiledSource,
  contentType: "application/javascript",
  sources: [sourceRelativePath],
  sourcesContent: [source],
  assets: [`global-this.js__asset__/global-this.js.map`],
  assetsContent: [actual.assetsContent[0]],
}
assert({ actual, expected })