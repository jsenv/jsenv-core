/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"
import { require } from "../require.js"
import { renderNamePattern } from "../renderNamePattern.js"

const parse5 = require("parse5")
// https://github.com/inikulin/parse5/blob/master/packages/parse5/lib/tree-adapters/default.js
// eslint-disable-next-line import/no-unresolved
// const treeAdapter = require("parse5/lib/tree-adapters/default.js")

export const parseHtmlString = (htmlString) => {
  const htmlAst = parse5.parse(htmlString, { sourceCodeLocationInfo: true })
  return htmlAst
}

export const parseSvgString = (svgString) => {
  const svgAst = parse5.parseFragment(svgString, { sourceCodeLocationInfo: true })
  return svgAst
}

export const stringifyHtmlAst = (htmlAst) => {
  const htmlString = parse5.serialize(htmlAst)
  return htmlString
}

export const findNode = (htmlStringOrAst, predicate) => {
  const htmlAst =
    typeof htmlStringOrAst === "string" ? parseHtmlString(htmlStringOrAst) : htmlStringOrAst
  let nodeMatching = null
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      nodeMatching = node
      return "stop"
    }
    return null
  })
  return nodeMatching
}

export const findNodes = (htmlString, predicate) => {
  const htmlAst = parseHtmlString(htmlString)
  const nodes = []
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      nodes.push(node)
    }
    return null
  })
  return nodes
}

export const findNodeByTagName = (htmlString, tagName) =>
  findNode(htmlString, (node) => node.nodeName === tagName)

export const findAllNodeByTagName = (htmlString, tagName) =>
  findNodes(htmlString, (node) => node.nodeName === tagName)

export const findFirstImportmapNode = (htmlStringOrAst) =>
  findNode(htmlStringOrAst, htmlNodeIsScriptImportmap)

export const getHtmlNodeAttributeByName = (htmlNode, attributeName) =>
  htmlNode.attrs.find((attr) => attr.name === attributeName)

export const removeHtmlNodeAttribute = (htmlNode, attributeToRemove) => {
  let attrIndex
  if (typeof attributeToRemove === "object") {
    attrIndex = htmlNode.attrs.indexOf(attributeToRemove)
  }
  if (attrIndex === -1) {
    return false
  }
  htmlNode.attrs.splice(attrIndex, 1)
  return true
}

export const addHtmlNodeAttribute = (htmlNode, attributeToSet) => {
  if (typeof attributeToSet !== "object") {
    throw new TypeError(`addHtmlNodeAttribute attribute must be an object {name, value}`)
  }

  const existingAttributeIndex = htmlNode.attrs.findIndex(
    (attr) => attr.name === attributeToSet.name,
  )
  if (existingAttributeIndex === -1) {
    htmlNode.attrs.push(attributeToSet)
  } else {
    htmlNode.attrs[existingAttributeIndex] = attributeToSet
  }
}

export const getHtmlNodeTextNode = (htmlNode) => {
  const firstChild = htmlNode.childNodes[0]
  return firstChild && firstChild.nodeName === "#text" ? firstChild : null
}

export const setHtmlNodeText = (htmlNode, textContent) => {
  const textNode = getHtmlNodeTextNode(htmlNode)
  if (textNode) {
    textNode.value = textContent
  } else {
    const newTextNode = { nodeName: "#text", value: textContent, parentNode: htmlNode }
    htmlNode.childNodes.splice(0, 0, newTextNode)
  }
}

export const removeHtmlNodeText = (htmlNode) => {
  const textNode = getHtmlNodeTextNode(htmlNode)
  if (textNode) {
    htmlNode.childNodes = []
  }
}

export const getHtmlNodeLocation = (htmlNode) => {
  const { sourceCodeLocation } = htmlNode
  if (!sourceCodeLocation) {
    return {}
  }
  const { startLine, startCol } = sourceCodeLocation
  return {
    line: startLine,
    column: startCol,
  }
}

export const htmlAstContains = (htmlAst, predicate) => {
  let contains = false
  visitHtmlAst(htmlAst, (node) => {
    if (predicate(node)) {
      contains = true
      return "stop"
    }
    return null
  })
  return contains
}

export const htmlNodeIsScriptModule = (htmlNode) => {
  if (htmlNode.nodeName !== "script") {
    return false
  }
  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type")
  if (!typeAttribute) {
    return false
  }
  return typeAttribute.value === "module"
}

export const htmlNodeIsScriptImportmap = (htmlNode) => {
  if (htmlNode.nodeName !== "script") {
    return false
  }
  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type")
  if (!typeAttribute) {
    return false
  }
  return typeAttribute.value === "importmap"
}

export const parseSrcset = (srcsetString) => {
  const srcsetParts = []
  srcsetString.split(",").forEach((set) => {
    const [specifier, descriptor] = set.trim().split(" ")
    srcsetParts.push({
      specifier,
      descriptor,
    })
  })
  return srcsetParts
}

export const stringifySrcset = (srcsetParts) => {
  const srcsetString = srcsetParts
    .map(({ specifier, descriptor }) => `${specifier} ${descriptor}`)
    .join(", ")
  return srcsetString
}

// let's <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// if srcset is used we should parse it and collect all src referenced in it
// also <link ref="preload">
// ideally relative iframe should recursively fetch (not needed so lets ignore)
// <svg> ideally looks for external ressources inside them

// but right now we will focus on: <link href> and <style> tags
// on veut vérifier qu'on les récupere bien
// dans rollup pour chaque css on feras le transformcss + l'ajout des assets reférencés
// pour le style inline on le parse aussi et on le remettra inline dans le html
// ensuite qu'on est capable de les mettre a jour
// ce qui veut dire de mettre a jour link.ref et style.text
export const parseHtmlAstRessources = (htmlAst) => {
  const links = []
  const styles = []
  const scripts = []
  const imgs = []
  const images = []
  const uses = []
  const sources = []

  visitHtmlAst(htmlAst, (node) => {
    if (node.nodeName === "link") {
      links.push(node)
      return
    }

    if (node.nodeName === "style") {
      styles.push(node)
      return
    }

    if (node.nodeName === "script") {
      scripts.push(node)
      return
    }

    if (node.nodeName === "img") {
      imgs.push(node)
      return
    }

    if (node.nodeName === "image") {
      images.push(node)
      return
    }

    if (node.nodeName === "use") {
      uses.push(node)
      return
    }

    if (node.nodeName === "source") {
      sources.push(node)
      return
    }
  })

  return {
    links,
    styles,
    scripts,
    imgs,
    images,
    uses,
    sources,
  }
}

export const replaceHtmlNode = (node, replacement, { inheritAttributes = true } = {}) => {
  let newNode
  if (typeof replacement === "string") {
    newNode = parseHtmlAsSingleElement(replacement)
  } else {
    newNode = replacement
  }

  if (inheritAttributes) {
    newNode.attrs = [
      // inherit script attributes except src, type, href
      ...node.attrs.filter(({ name }) => name !== "type" && name !== "src" && name !== "href"),
      ...newNode.attrs,
    ]
  }

  replaceNode(node, newNode)
}

export const manipulateHtmlAst = (htmlAst, { scriptInjections = [] }) => {
  if (scriptInjections.length === 0) {
    return
  }

  const htmlNode = htmlAst.childNodes.find((node) => node.nodeName === "html")
  const headNode = htmlNode.childNodes[0]
  const bodyNode = htmlNode.childNodes[1]

  const scriptsToPreprendInHead = []
  scriptInjections.forEach((script) => {
    const scriptExistingInHead = findExistingScript(headNode, script)
    if (scriptExistingInHead) {
      replaceNode(scriptExistingInHead, scriptToNode(script))
      return
    }
    const scriptExistingInBody = findExistingScript(bodyNode, script)
    if (scriptExistingInBody) {
      replaceNode(scriptExistingInBody, scriptToNode(script))
      return
    }
    scriptsToPreprendInHead.push(script)
  })
  const headScriptsFragment = scriptsToFragment(scriptsToPreprendInHead)
  insertFragmentBefore(
    headNode,
    headScriptsFragment,
    findChild(headNode, (node) => node.nodeName === "script"),
  )
}

const insertFragmentBefore = (node, fragment, childNode) => {
  const { childNodes = [] } = node

  if (childNode) {
    const childNodeIndex = childNodes.indexOf(childNode)
    node.childNodes = [
      ...childNodes.slice(0, childNodeIndex),
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
      ...childNodes.slice(childNodeIndex),
    ]
  } else {
    node.childNodes = [
      ...childNodes,
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
    ]
  }
}

const scriptToNode = (script) => {
  return scriptsToFragment([script]).childNodes[0]
}

const scriptsToFragment = (scripts) => {
  const html = scripts.reduce((previous, script) => {
    const { text = "", ...attributes } = script
    const scriptAttributes = objectToHtmlAttributes(attributes)
    return `${previous}<script ${scriptAttributes}>${text}</script>
      `
  }, "")
  const fragment = parse5.parseFragment(html)
  return fragment
}

const findExistingScript = (node, script) =>
  findChild(node, (childNode) => {
    return childNode.nodeName === "script" && sameScript(childNode, script)
  })

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate)

const sameScript = (node, { type = "text/javascript", src }) => {
  const typeAttribute = getHtmlNodeAttributeByName(node, "type")
  if (!typeAttribute) {
    return type === undefined || type === "text/javascript"
  }
  if (typeAttribute !== type) {
    return false
  }

  const srcAttribute = getHtmlNodeAttributeByName(node, "src")
  if (!srcAttribute) {
    return src === undefined
  }
  if (srcAttribute.value !== src) {
    return false
  }

  return true
}

const objectToHtmlAttributes = (object) => {
  return Object.keys(object)
    .map((key) => `${key}=${valueToHtmlAttributeValue(object[key])}`)
    .join(" ")
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
}

export const createInlineScriptHash = (script) => {
  const hash = createHash("sha256")
  hash.update(getHtmlNodeTextNode(script).value)
  return hash.digest("hex").slice(0, 8)
}

export const getUniqueNameForInlineHtmlNode = (node, nodes, pattern) => {
  return renderNamePattern(pattern, {
    id: () => {
      const idAttribute = getHtmlNodeAttributeByName(node, "id")
      if (idAttribute) {
        return idAttribute.value
      }

      const { line, column } = getHtmlNodeLocation(node)
      const lineTaken = nodes.some(
        (nodeCandidate) =>
          nodeCandidate !== node && getHtmlNodeLocation(nodeCandidate).line === line,
      )
      if (lineTaken) {
        return `${line}.${column}`
      }

      return line
    },
  })
}

const parseHtmlAsSingleElement = (html) => {
  const fragment = parse5.parseFragment(html)
  return fragment.childNodes[0]
}

const replaceNode = (node, newNode) => {
  const { parentNode } = node
  const parentNodeChildNodes = parentNode.childNodes
  const nodeIndex = parentNodeChildNodes.indexOf(node)
  parentNodeChildNodes[nodeIndex] = newNode
}

const visitHtmlAst = (htmlAst, callback) => {
  const visitNode = (node) => {
    const callbackReturnValue = callback(node)
    if (callbackReturnValue === "stop") {
      return
    }
    const { childNodes } = node
    if (childNodes) {
      let i = 0
      while (i < childNodes.length) {
        visitNode(childNodes[i++])
      }
    }
  }
  visitNode(htmlAst)
}
