import { scanBrowserRuntimeFeatures } from "../../runtime/createBrowserRuntime/scanBrowserRuntimeFeatures.js"
import { removeForceHideElement, activateToolbarSection } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"

export const renderCompilationInToolbar = ({ compileGroup }) => {
  const compilationRootNode = document.querySelector("#compilation_info")

  // reset file execution indicator ui
  enableVariant(compilationRootNode, { compileInfo: "pending" })
  removeForceHideElement(compilationRootNode)
  activateToolbarSection(compilationRootNode)

  scanBrowserRuntimeFeatures().then(
    ({ featuresReport, canAvoidCompilation, outDirectoryRelativeUrl, compileId }) => {
      if (compileGroup.compileId && canAvoidCompilation) {
        enableVariant(compilationRootNode, { compileInfo: "compiled_and_compilation_is_optional" })
        const variantNode = compilationRootNode.querySelector("[data-when-active]")
        variantNode.querySelector("a.go_to_source_link").onclick = () => {
          window.parent.location = `/${compileGroup.fileRelativeUrl}`
        }
        return
      }

      if (compileGroup.compileId) {
        enableVariant(compilationRootNode, { compileInfo: "compiled_and_compilation_is_required" })
        const variantNode = compilationRootNode.querySelector("[data-when-active]")
        variantNode.querySelector("a.go_to_source_link").onclick = () => {
          window.parent.location = `/${compileGroup.fileRelativeUrl}`
        }
        variantNode.querySelector(`a.required_reasons_link`).onclick = () => {
          alertCompilationRequiredReasons(featuresReport)
        }
        return
      }

      if (canAvoidCompilation) {
        enableVariant(compilationRootNode, { compileInfo: "source_and_compilation_is_optional" })
        const variantNode = compilationRootNode.querySelector("[data-when-active]")
        variantNode.querySelector("a.go_to_compiled_link").onclick = () => {
          window.parent.location = `/${outDirectoryRelativeUrl}${compileId}/${compileGroup.fileRelativeUrl}`
        }
        return
      }

      enableVariant(compilationRootNode, { compileInfo: "source_and_compilation_is_required" })
      const variantNode = compilationRootNode.querySelector("[data-when-active]")
      variantNode.querySelector("a.go_to_compiled_link").onclick = () => {
        window.parent.location = `/${outDirectoryRelativeUrl}${compileId}/${compileGroup.fileRelativeUrl}`
      }
      variantNode.querySelector(`a.required_reasons_link`).onclick = () => {
        alertCompilationRequiredReasons(featuresReport)
      }
      return
    },
  )
}

const alertCompilationRequiredReasons = (featuresReport) => {
  const parts = []

  const { convertPatterns } = featuresReport
  const convertPatternCount = convertPatterns.length
  if (convertPatternCount > 0) {
    parts.push(`convertMap is used with the following keys: ${convertPatterns}`)
  }

  const { jsenvPluginRequiredNames } = featuresReport
  const jsenvPluginRequiredCount = jsenvPluginRequiredNames.length
  if (jsenvPluginRequiredCount > 0) {
    parts.push(
      `${jsenvPluginRequiredCount} jsenv plugins are mandatory: ${jsenvPluginRequiredNames}`,
    )
  }

  const { customCompilerNames } = featuresReport
  const customCompilerCount = customCompilerNames.length
  if (customCompilerCount > 0) {
    parts.push(`${customCompilerCount} custom compilers enabled: ${customCompilerNames}`)
  }

  const { babelPluginRequiredNames } = featuresReport
  const babelPluginRequiredCount = babelPluginRequiredNames.length
  if (babelPluginRequiredCount > 0) {
    parts.push(
      `${babelPluginRequiredCount} babel plugins are mandatory: ${babelPluginRequiredNames}`,
    )
  }

  const { importmapSupported } = featuresReport
  if (!importmapSupported) {
    parts.push(`importmap are not supported`)
  }

  const { dynamicImportSupported } = featuresReport
  if (!dynamicImportSupported) {
    parts.push(`dynamic import are not supported`)
  }

  const { topLevelAwaitSupported } = featuresReport
  if (!topLevelAwaitSupported) {
    parts.push(`top level await is not supported`)
  }

  // eslint-disable-next-line no-alert
  window.alert(
    `Compilation is required because:
- ${parts.join(`
-`)}`,
  )
}
