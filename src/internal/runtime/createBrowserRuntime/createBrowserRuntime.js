/* eslint-disable import/max-dependencies */

// we might want to reuse fetchUrl approach used by nodeRuntime
// eslint-disable-next-line import/no-unresolved
import groupMap from "/.jsenv/out/groupMap.json"
// eslint-disable-next-line import/no-unresolved
import env from "/.jsenv/out/env.json"

import { uneval } from "@jsenv/uneval"
// do not use memoize form @jsenv/util to avoid pulling @jsenv/util code into the browser bundle
import { memoize } from "../../memoize.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveBrowserGroup } from "../resolveBrowserGroup.js"
import { createBrowserSystem } from "./createBrowserSystem.js"
import { displayErrorInDocument } from "./displayErrorInDocument.js"
import { displayErrorNotification } from "./displayErrorNotification.js"

const memoizedCreateBrowserSystem = memoize(createBrowserSystem)
const { outDirectoryRelativeUrl, importMapFileRelativeUrl, importDefaultExtension } = env

export const createBrowserRuntime = ({ compileServerOrigin }) => {
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(groupMap),
    groupMap,
  })
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`

  const importFile = async (specifier) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      compileServerOrigin,
      outDirectoryRelativeUrl,
      compileDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importDefaultExtension,
    })
    return browserSystem.import(specifier)
  }

  const executeFile = async (
    specifier,
    {
      collectCoverage,
      collectNamespace,
      transferableNamespace = false,
      errorExposureInConsole = true,
      errorExposureInNotification = false,
      errorExposureInDocument = true,
      executionExposureOnWindow = false,
      errorTransform = (error) => error,
      executionId,
    } = {},
  ) => {
    const browserSystem = await memoizedCreateBrowserSystem({
      executionId,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      compileDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importDefaultExtension,
    })

    let executionResult
    try {
      let namespace = await browserSystem.import(specifier)
      if (collectNamespace) {
        if (transferableNamespace) {
          namespace = makeNamespaceTransferable(namespace)
        }
      } else {
        namespace = undefined
      }

      executionResult = {
        status: "completed",
        namespace,
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    } catch (error) {
      let transformedError
      try {
        transformedError = await errorTransform(error)
      } catch (e) {
        transformedError = error
      }

      if (errorExposureInConsole) displayErrorInConsole(transformedError)
      if (errorExposureInNotification) displayErrorNotification(transformedError)
      if (errorExposureInDocument) displayErrorInDocument(transformedError)

      executionResult = {
        status: "errored",
        exceptionSource: unevalException(transformedError),
        coverageMap: collectCoverage ? readCoverage() : undefined,
      }
    }

    if (executionExposureOnWindow) {
      window.__executionResult__ = executionResult
    }

    return executionResult
  }

  return {
    compileDirectoryRelativeUrl,
    importFile,
    executeFile,
  }
}

const makeNamespaceTransferable = (namespace) => {
  const transferableNamespace = {}
  Object.keys(namespace).forEach((key) => {
    const value = namespace[key]
    transferableNamespace[key] = isTransferable(value) ? value : hideNonTransferableValue(value)
  })
  return transferableNamespace
}

const hideNonTransferableValue = (value) => {
  if (typeof value === "function") {
    return `[[HIDDEN: ${value.name} function cannot be transfered]]`
  }

  if (typeof value === "symbol") {
    return `[[HIDDEN: symbol function cannot be transfered]]`
  }

  return `[[HIDDEN: ${value.constructor ? value.constructor.name : "object"} cannot be transfered]]`
}

// https://stackoverflow.com/a/32673910/2634179
const isTransferable = (value) => {
  const seenArray = []
  const visit = () => {
    if (typeof value === "function") return false

    if (typeof value === "symbol") return false

    if (value === null) return false

    if (typeof value === "object") {
      const constructorName = value.constructor.namespace

      if (supportedTypes.includes(constructorName)) {
        return true
      }

      const maybe = maybeTypes.includes(constructorName)
      if (maybe) {
        const visited = seenArray.includes(value)
        if (visited) {
          // we don't really know until we are done visiting the object
          // implementing it properly means waiting for the recursion to be done
          // let's just
          return true
        }
        seenArray.push(value)

        if (constructorName === "Array" || constructorName === "Object") {
          return Object.keys(value).every((key) => isTransferable(value[key]))
        }
        if (constructorName === "Map") {
          return (
            [...value.keys()].every(isTransferable) && [...value.values()].every(isTransferable)
          )
        }
        if (constructorName === "Set") {
          return [...value.keys()].every(isTransferable)
        }
      }

      // Error, DOM Node and others
      return false
    }
    return true
  }

  return visit(value)
}

const supportedTypes = [
  "Boolean",
  "Number",
  "String",
  "Date",
  "RegExp",
  "Blob",
  "FileList",
  "ImageData",
  "ImageBitmap",
  "ArrayBuffer",
]

const maybeTypes = ["Array", "Object", "Map", "Set"]

const unevalException = (value) => {
  return uneval(value)
}

const readCoverage = () => window.__coverage__

const displayErrorInConsole = (error) => {
  console.error(error)
}
