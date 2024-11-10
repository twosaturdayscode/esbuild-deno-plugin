# esbuild-deno-plugin
[![deno doc](https://jsr.io/badges/@duesabati/esbuild-deno-plugin)](https://jsr.io/@duesabati/esbuild-deno-plugin)

> [!IMPORTANT]
> This is a fork and rewrite of the original work of [esbuild_deno_loader](https://github.com/lucacasonato/esbuild_deno_loader)

Deno modules resolution and loading for `esbuild`.

## Features

### Already available

- Support for `file:`, `https:`, and `data:` specifiers.
- Support for `npm:` specifiers.
- Support for `jsr:` specifiers.
- Support for import maps (including embedded into `deno.json`).
- Native loader using Deno's global cache directory.

### Workspaces

Recently added [`workspaces`](https://docs.deno.com/runtime/manual/basics/workspaces/)
feature is supported, not only it enables you to bundle workspace members but it
resolves their import maps too! Look at the following example.

If you have a `snake` package/member like this:

```typescript
// packages/snake/mod.ts (workspace member)
import { toSnakeCase } from "@std/text"

export function snake(hiss: string) {
  return toSnakeCase(hiss)
}
```

It can have an import map that defines the "defaults" of your imports.

```jsonc
// packages/snake/deno.json
{
  "name": "@myscope/snake",
  "version": "0.1.0",
  "exports": "./mod.ts",
  "imports": {
    "@std/text": "jsr:@std/text@1.0.3"
  }
}
```

Then you refer to is as usual.

```typescript
// apps/web/main.ts
import { snake } from "@myscope/snake"

function main() {
  console.log(snake("hello world"))
}

main()
```

```jsonc
// apps/web/deno.json
{
  "workspace": ["./packages/snake"]
}
```

The plugin simply works by adding `scopes` to the main `deno.json` imports map
overrding the member's imports, obviously your own written scopes takes
precendence.

### Vendoring

Support for [`vendoring`](https://docs.deno.com/runtime/manual/basics/vendoring/)
coming soon.

## Example

This example bundles an entrypoint into a single ESM output.

```ts
import * as esbuild from "npm:esbuild@0.23.0";
// Import the WASM build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@0.20.2/wasm.js";

import { denoPlugins } from "jsr:@duesabati/esbuild-deno-plugin@^0.0.1";

const result = await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["https://deno.land/std@0.185.0/bytes/mod.ts"],
  outfile: "./dist/bytes.esm.js",
  bundle: true,
  format: "esm",
});

console.log(result.outputFiles);

esbuild.stop();
```

### Permissions

This plugins requires the following permissions:

- `--allow-read` if you need to resolve local files.
- `--allow-net` if you need to resolve remote files.

If the program is run with `--allow-run`, the plugin will use the `deno` binary
to resolve remote files. This allows the plugin to re-use the Deno module cache.

## Usage with other plugins

For some use-cases these plugins should be manually instantiated. For example if
you want to add your own loader plugins that handles specific file extensions or
URL schemes, you should insert these plugins between the Deno resolver, and Deno
loader.

> [!NOTE]
> In most cases, the `denoResolverPlugin` should be the first plugin in the plugin array.

For more details read the "How it works" section.

## How it works

The library consists of two separate plugins (that are however most commonly
used together):

1. The resolver, which resolves specifiers within a file relative to the file
   itself ('absolutization'), taking into account _import maps_.
1. The loader, which takes a fully resolved specifier, and attempts to load it.
   If the loader encounters redirects, these are processed until a final module
   is found.

Most commonly these two plugins are used together, chained directly after each
other using the denoPlugins() function. This function returns an array of
esbuild.Plugin instances, which can be spread directly into the plugins array of
the esbuild build options.

@todo: Further explain precautions about usage with other plugins.

## Why this project?

I've decided to rewrite the original project found at
[esbuild_deno_loader](https://github.com/lucacasonato/esbuild_deno_loader) as a
refactor exercise/challenge and to understand what was going on. I also think
that the code is more readable and better designed but this is a **completely
personal opinion** and **NOT** a judgement on the original work.

With that being said, I really hope this library helps you.
