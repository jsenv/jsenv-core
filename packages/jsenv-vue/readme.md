# jsenv-vue

Enable vue files in jsenv.

[![npm package](https://img.shields.io/npm/v/@jsenv/vue.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/vue)

**WARNING:** My experience with Vue.js is non existent. Consequently I have no idea how it would integrate with a codebase written in Vue.js. I made this package as a proof of concept to ensure jsenv is capable to run `.vue` files.

# Usage

<details>
  <summary>1 - Install <code>@jsenv/vue</code></summary>

```console
npm install --save-dev @jsenv/vue
```

</details>

<details>
  <summary>2 - Use <code>jsenvCompilerForVue</code></summary>

Add a `customCompilers` export into `jsenv.config.js`:

```js
import { jsenvCompilerForVue } from "@jsenv/vue"

export const customCompilers = { ...jsenvCompilerForVue }
```

</details>
