import { assert } from "@jsenv/assert"
import { parseHtmlString, manipulateHtmlAst, stringifyHtmlAst } from "./compileHtml.js"

const compileHtml = (
  htmlBeforeCompilation,
  {
    scriptInjections = [],
    // resolveScriptSrc = (src) => src,
  } = {},
) => {
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parseHtmlString(htmlBeforeCompilation)

  manipulateHtmlAst(document, { scriptInjections })
  // resolveScripts(document, resolveScriptSrc)

  const htmlAfterCompilation = stringifyHtmlAst(document)
  return {
    htmlAfterCompilation,
  }
}

// inject script tag inside head + there is already a script tag
{
  const htmlBeforeCompilation = `
  <html>
    <head>
      <meta charset="utf8" />
      <script src="foo.js"></script>
    </head>
    <body></body>
  </html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation, {
    scriptInjections: [{ src: "bar.js", async: true }],
  })
  const actual = htmlAfterCompilation
  const expected = `<html><head>
      <meta charset="utf8">
      <script src="bar.js" async="true"></script>
      <script src="foo.js"></script>
    </head>
    <body>
  </body></html>`
  assert({ actual, expected })
}

// don't inject script already there
{
  const htmlBeforeCompilation = `
  <html>
    <head>
      <meta charset="utf8" />
      <script src="foo.js"></script>
    </head>
    <body></body>
  </html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation, {
    scriptInjections: [{ src: "foo.js" }],
  })
  const actual = htmlAfterCompilation
  const expected = `<html><head>
      <meta charset="utf8">
      <script src="foo.js"></script>
    </head>
    <body>
  </body></html>`
  assert({ actual, expected })
}

// transform external module script inside body
{
  const htmlBeforeCompilation = `
<html>
  <head></head>
  <body>
    <script src="foo.js"></script>
    <script type="module" src="bar.js" async></script>
  </body>
</html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head>
  <body>
    <script src="foo.js"></script>
    <script async="">
      window.__jsenv__.executeFileUsingSystemJs("bar.js")
    </script>
${`  ` /* this is for prettier */}
</body></html>`
  assert({ actual, expected })
}

// transform inline module script in head
{
  const htmlBeforeCompilation = `
<html>
  <head>
    <script type="module">
      console.log(42)
    </script>
  </head>
  <body></body>
</html>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head>
    <script>
      window.__jsenv__.executeFileUsingSystemJs("./8d473bbc.js")
    </script>
  </head>
  <body>
</body></html>`
  assert({ actual, expected })
}

// ''
{
  const htmlBeforeCompilation = ""
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body></body></html>`
  assert({ actual, expected })
}

// foo
{
  const htmlBeforeCompilation = `foo`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body>foo</body></html>`
  assert({ actual, expected })
}

// <head>
{
  const htmlBeforeCompilation = `<head>`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body></body></html>`
  assert({ actual, expected })
}

// <foo />
{
  const htmlBeforeCompilation = `<foo />`
  const { htmlAfterCompilation } = compileHtml(htmlBeforeCompilation)
  const actual = htmlAfterCompilation
  const expected = `<html><head></head><body><foo></foo></body></html>`
  assert({ actual, expected })
}
