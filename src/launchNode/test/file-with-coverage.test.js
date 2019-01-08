import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { createJsCompileService } from "../../createJsCompileService.js"
import { open as compileServerOpen } from "../../server-compile/index.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchNode } from "../launchNode.js"

const file = `src/launchNode/test/fixtures/file.js`
const compileInto = "build"
const hotreload = false
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    pluginMap,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  const { origin: remoteRoot } = await compileServerOpen({
    cancellationToken,
    protocol: "http",

    localRoot,
    compileInto,
    compileService: jsCompileService,
  })

  const verbose = true

  const result = await executeFileOnPlatform(
    file,
    () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
    {
      cancellationToken,
      platformTypeForLog: "node process",
      verbose,
      collectNamespace: true,
      collectCoverage: true,
    },
  )

  assert({
    actual: result,
    expected: {
      namespace: { default: true },
      coverageMap: {
        "src/launchNode/test/fixtures/file.js":
          result.coverageMap["src/launchNode/test/fixtures/file.js"],
      },
    },
  })
}

exec({})
