# jsenv-css-module

Enable `module.css` files in jsenv.

[![npm package](https://img.shields.io/npm/v/@jsenv/css-module.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/css-module)

# Usage

<details>
  <summary>1 - Install <code>@jsenv/css-module</code></summary>

```console
npm install --save-dev @jsenv/css-module
```

</details>

<details>
  <summary>2 - Use <code>jsenvCompilerForCssModule</code></summary>

Add a `customCompilers` export into `jsenv.config.js`:

```js
import { jsenvCompilerForCssModule } from "@jsenv/sass"

export const customCompilers = [jsenvCompilerForCssModule]
```

</details>
