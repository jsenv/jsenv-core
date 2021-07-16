# jsenv-sass

Enable scss and sass files in jsenv.

[![npm package](https://img.shields.io/npm/v/@jsenv/sass.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/sass)

# Usage

<details>
  <summary>1 - Install <code>@jsenv/sass</code></summary>

```console
npm install --save-dev @jsenv/sass
```

</details>

<details>
  <summary>2 - Use <code>jsenvCompilerForSass</code></summary>

Add a `customCompilers` export into `jsenv.config.js`:

```js
import { jsenvCompilerForSass } from "@jsenv/sass"

export const customCompilers = { ...jsenvCompilerForSass }
```

</details>
