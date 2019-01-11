import { versionHighest } from "@dmail/project-structure-compile-babel"
import { objectComposeValue, objectMapValue } from "../../objectHelper.js"

const normalizeCompatMapVersion = (compatMap) => {
  return objectMapValue(compatMap, (version) => String(version))
}

export const compatMapCompose = (compatMap, secondCompatMap) => {
  return objectComposeValue(
    normalizeCompatMapVersion(compatMap),
    normalizeCompatMapVersion(secondCompatMap),
    (version, secondVersion) => versionHighest(version, secondVersion),
  )
}
