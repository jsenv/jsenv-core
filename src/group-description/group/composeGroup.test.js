import { assert } from "/node_modules/@dmail/assert/index.js"
import { composeGroup } from "./composeGroup.js"

{
  const firstGroup = {
    incompatibleNameArray: ["a"],
    compatibility: {
      chrome: 50,
      firefox: 20,
    },
  }
  const secondGroup = {
    incompatibleNameArray: ["b", "e"],
    compatibility: {
      chrome: 49,
      firefox: 30,
      node: 10,
    },
  }
  const actual = composeGroup(firstGroup, secondGroup)
  const expected = {
    incompatibleNameArray: ["a", "b", "e"],
    compatibility: {
      chrome: "50",
      firefox: "30",
      node: "10",
    },
  }
  assert({ actual, expected })
}
