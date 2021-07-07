import { fetchExploringJson } from "./fetchExploringJson.js"
import { scanBrowserRuntimeFeatures } from "../runtime/createBrowserRuntime/scanBrowserRuntimeFeatures.js"

const redirect = async () => {
  const [browserRuntimeFeaturesReport, { exploringHtmlFileRelativeUrl }] = await Promise.all([
    scanBrowserRuntimeFeatures(),
    fetchExploringJson(),
  ])

  if (browserRuntimeFeaturesReport.canAvoidCompilation) {
    window.location.href = `/${exploringHtmlFileRelativeUrl}`
    return
  }

  const { outDirectoryRelativeUrl, compileId } = browserRuntimeFeaturesReport
  window.location.href = `/${outDirectoryRelativeUrl}${compileId}/${exploringHtmlFileRelativeUrl}`
}

redirect()
