import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateCommonJsBundle } from "../../../../src/bundling/commonjs/generate-commonjs-bundle.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`
const fileRelativePath = `${folderJsenvRelativePath}/balancing.js`

await generateCommonJsBundle({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: fileRelativePath,
  },
  compileGroupCount: 2,
})

const { namespace: actual } = await requireCommonJsBundle({
  ...NODE_BUNDLER_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = Object.assign(
  Object.defineProperty({}, "__esModule", {
    value: true,
  }),
  { answer: 42 },
)
assert({ actual, expected })
