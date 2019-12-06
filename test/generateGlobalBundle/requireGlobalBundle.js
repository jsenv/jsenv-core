import { resolveDirectoryUrl, resolveUrl, urlToFilePath } from "src/internal/urlUtils.js"

export const requireGlobalBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativeUrl,
  globalName,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, bundleDirectoryUrl)
  const mainFilePath = urlToFilePath(mainFileUrl)
  import.meta.require(mainFilePath)
  return {
    globalValue: global[globalName],
  }
}
