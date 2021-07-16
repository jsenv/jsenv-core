export const enableVariant = (rootNode, variables) => {
  const nodesNotMatching = Array.from(
    rootNode.querySelectorAll(`[${attributeIndicatingACondition}]`),
  )
  nodesNotMatching.forEach((nodeNotMatching) => {
    const conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition)
    const matches = testCondition(conditionAttributeValue, variables)
    if (matches) {
      renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch)
    }
  })

  const nodesMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingAMatch}]`))
  nodesMatching.forEach((nodeMatching) => {
    const conditionAttributeValue = nodeMatching.getAttribute(attributeIndicatingAMatch)
    const matches = testCondition(conditionAttributeValue, variables)
    if (!matches) {
      renameAttribute(nodeMatching, attributeIndicatingAMatch, attributeIndicatingACondition)
    }
  })
}

const testCondition = (conditionAttributeValue, variables) => {
  const condition = parseCondition(conditionAttributeValue)
  return Object.keys(variables).some((key) => {
    if (condition.key !== key) {
      return false
    }
    // the condition do not specify a value, any value is ok
    if (condition.value === undefined) {
      return true
    }
    if (condition.value === variables[key]) {
      return true
    }
    return false
  })
}

const parseCondition = (conditionAttributeValue) => {
  const colonIndex = conditionAttributeValue.indexOf(":")
  if (colonIndex === -1) {
    return {
      key: conditionAttributeValue,
      value: undefined,
    }
  }
  return {
    key: conditionAttributeValue.slice(0, colonIndex),
    value: conditionAttributeValue.slice(colonIndex + 1),
  }
}

const attributeIndicatingACondition = `data-when`
const attributeIndicatingAMatch = `data-when-active`

const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name))
  node.removeAttribute(name)
}
