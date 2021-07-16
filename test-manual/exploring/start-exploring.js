/**

I think the sometimes poor perf of compile server comes from this:

node.js is overhelmed by things to do
in that context it takes the opportunity to delay promise resolution
and a promise might take 50/100ms to resolve (or more)

consequently a dumb request ends up taking 600ms when it would take 50ms

https://github.com/nodejs/node/issues/30001
https://v8.dev/blog/fast-async
https://medium.com/netscape/async-iterators-these-promises-are-killing-my-performance-4767df03d85b
https://stackoverflow.com/questions/32363198/slow-response-to-resolved-promise-node-js
https://softwareengineering.stackexchange.com/questions/278778/why-are-native-es6-promises-slower-and-more-memory-intensive-than-bluebird

- node --heap-prof ./test-manual/exploring/start-exploring-2.js
- node ./test-manual/exploring/start-exploring-2.js

node --inspect test-manual/exploring/start-exploring.js

*/

import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { startExploring } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { jsenvCompilerForSass } from "@jsenv/core/packages/jsenv-sass/main.js"
import { jsenvCompilerForVue } from "@jsenv/core/packages/jsenv-vue/main.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`

startExploring({
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  explorableConfig: {
    source: {
      [`./${testDirectoryRelativeUrl}**/*.html`]: true,
    },
  },
  customCompilers: {
    ...jsenvCompilerForSass,
    ...jsenvCompilerForVue,
  },
  jsenvDirectoryRelativeUrl,
  compileServerProtocol: "https",
  compileServerPort: 3456,
  keepProcessAlive: true,
  jsenvDirectoryClean: true,
  stopOnPackageVersionChange: false,
  // useFilesystemAsCache: false,
  // writeOnFileSystem: false,
  compileGroupCount: 2,
  // livereloading: false,
})
