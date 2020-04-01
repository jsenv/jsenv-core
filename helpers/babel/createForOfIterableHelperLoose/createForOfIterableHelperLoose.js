/* eslint-disable eqeqeq, no-eq-null */
import unsupportedIterableToArray from "../unsupportedIterableToArray/unsupportedIterableToArray.js"

export default function createForOfIteratorHelperLoose(o) {
  var i = 0
  if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) {
    // Fallback for engines without symbol support
    if (Array.isArray(o) || (o = unsupportedIterableToArray(o)))
      return function() {
        if (i >= o.length) return { done: true }
        return { done: false, value: o[i++] }
      }
    throw new TypeError(
      "Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.",
    )
  }
  i = o[Symbol.iterator]()
  return i.next.bind(i)
}
