import { hrefToMeta } from "./locaters.js"

export const overrideSystemResolve = ({
  System,
  resolveAbsoluteModuleSpecifier,
  remoteRoot,
  compileInto,
  compileId,
}) => {
  const resolve = System.resolve
  System.resolve = async (moduleSpecifier, moduleSpecifierFile) => {
    if (moduleSpecifier[0] === "/") {
      return resolveAbsoluteModuleSpecifier({
        moduleSpecifier,
        file: moduleSpecifierFile,
        root: moduleSpecifierFileToRoot({
          moduleSpecifierFile,
          remoteRoot,
          compileInto,
          compileId,
        }),
      })
    }
    return resolve(moduleSpecifier, moduleSpecifierFile)
  }
}

const moduleSpecifierFileToRoot = ({ moduleSpecifierFile, remoteRoot, compileInto, compileId }) => {
  if (!moduleSpecifierFile) return `${remoteRoot}/${compileInto}/${compileId}`
  const { compileId: moduleSpecifiedFileCompileId } = hrefToMeta(moduleSpecifierFile, {
    remoteRoot,
    compileInto,
  })
  if (!moduleSpecifiedFileCompileId) return `${remoteRoot}/${compileInto}/${compileId}`
  return `${remoteRoot}/${compileInto}/${moduleSpecifiedFileCompileId}`
}
