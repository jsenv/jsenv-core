// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1

import { grey, red, ansiResetSequence } from "../executing/ansi.js"

export const showSourceLocation = (
  source,
  { line, column, numberOfSurroundingLinesToShow = 1, lineMaxLength = 120, color = false },
) => {
  let mark = (string) => string
  let aside = (string) => string
  if (color) {
    mark = (string) => `${red}${string}${ansiResetSequence}`
    aside = (string) => `${grey}${string}${ansiResetSequence}`
  }

  const lines = source.split(/\r?\n/)
  let lineRange = {
    start: line - 1,
    end: line,
  }
  lineRange = moveLineRangeUp(lineRange, numberOfSurroundingLinesToShow)
  lineRange = moveLineRangeDown(lineRange, numberOfSurroundingLinesToShow)
  lineRange = lineRangeWithinLines(lineRange, lines)
  const linesToShow = lines.slice(lineRange.start, lineRange.end)
  const endLineNumber = lineRange.end
  const lineNumberMaxWidth = String(endLineNumber).length

  const columnRange = {}
  if (column === undefined) {
    columnRange.start = 0
    columnRange.end = lineMaxLength
  } else if (column > lineMaxLength) {
    columnRange.start = column - Math.floor(lineMaxLength / 2)
    columnRange.end = column + Math.ceil(lineMaxLength / 2)
  } else {
    columnRange.start = 0
    columnRange.end = lineMaxLength
  }

  return linesToShow.map((lineSource, index) => {
    const lineNumber = lineRange.start + index + 1
    const isMainLine = lineNumber === line
    const lineSourceTruncated = applyColumnRange(columnRange, lineSource)
    const lineNumberWidth = String(lineNumber).length
    // ensure if line moves from 7,8,9 to 10 the display is still great
    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth)
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`
    const lineFormatted = `${aside(asideSource)} ${lineSourceTruncated}`
    if (isMainLine) {
      if (column === undefined) {
        return `${mark(">")} ${lineFormatted}`
      }
      const spacing = stringToSpaces(
        `${asideSource} ${lineSourceTruncated.slice(0, column - columnRange.start - 1)}`,
      )
      return `${mark(">")} ${lineFormatted}
  ${spacing}${mark("^")}`
    }
    return `  ${lineFormatted}`
  }).join(`
`)
}

const applyColumnRange = ({ start, end }, line) => {
  if (typeof start !== "number") {
    throw new TypeError(`start must be a number, received ${start}`)
  }
  if (typeof end !== "number") {
    throw new TypeError(`end must be a number, received ${end}`)
  }
  if (end < start) {
    throw new Error(`end must be greater than start, but ${end} is smaller than ${start}`)
  }

  const prefix = "…"
  const suffix = "…"
  const lastIndex = line.length

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return ""
  }

  const startTruncated = start > 0
  const endTruncated = lastIndex > end

  let from = startTruncated ? start + prefix.length : start
  let to = endTruncated ? end - suffix.length : end
  if (to > lastIndex) to = lastIndex

  if (start >= lastIndex || from === to) {
    return ""
  }

  let result = ""
  while (from < to) {
    result += line[from]
    from++
  }

  if (result.length === 0) {
    return ""
  }
  if (startTruncated && endTruncated) {
    return `${prefix}${result}${suffix}`
  }
  if (startTruncated) {
    return `${prefix}${result}`
  }
  if (endTruncated) {
    return `${result}${suffix}`
  }
  return result
}

const stringToSpaces = (string) => string.replace(/[^\t]/g, " ")

// const getLineRangeLength = ({ start, end }) => end - start

const moveLineRangeUp = ({ start, end }, number) => {
  return {
    start: start - number,
    end,
  }
}

const moveLineRangeDown = ({ start, end }, number) => {
  return {
    start,
    end: end + number,
  }
}

const lineRangeWithinLines = ({ start, end }, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end,
  }
}