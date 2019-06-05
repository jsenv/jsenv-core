import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { generateCommonJsBundle } from "../../../../index.js"
import { requireCommonJsBundle } from "../require-commonjs-bundle.js"
import {
  NODE_BUNDLER_TEST_PARAM,
  NODE_BUNDLER_TEST_IMPORT_PARAM,
} from "../node-bundler-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const bundleIntoRelativePath = `${folderJsenvRelativePath}/dist/commonjs`

await generateCommonJsBundle({
  ...NODE_BUNDLER_TEST_PARAM,
  bundleIntoRelativePath,
  entryPointMap: {
    main: `${folderJsenvRelativePath}/json.js`,
  },
})

const { namespace: actual } = await requireCommonJsBundle({
  ...NODE_BUNDLER_TEST_IMPORT_PARAM,
  bundleIntoRelativePath,
})
const expected = { foo: true }
assert({ actual, expected })
