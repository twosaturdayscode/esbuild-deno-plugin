# esbuild-deno-plugin

> [!IMPORTANT]
> This is a fork and rewrite of the original work of [esbuild_deno_loader](https://github.com/lucacasonato/esbuild_deno_loader)

Deno modules resolution and loading for `esbuild`.

## Features

### Already available

- Support for `file:`, `https:`, and `data:` specifiers
- Support for `npm:` specifiers
- Support for `jsr:` specifiers
- Support for import maps (including embedded into `deno.json`)
- Native loader using Deno's global cache directory
- Portable loader that works in environments with limited permissions

### Added

- [x] Support for recently added
      [`workspaces`](https://docs.deno.com/runtime/manual/basics/workspaces/)
      feature.*
- [ ] Support for
      [`vendoring`](https://docs.deno.com/runtime/manual/basics/vendoring/)

*For now this only works if each package use the Deno conventions of
re-exporting its dependencies, it doesn't work if it relies on its own import
map. Will implement it soon.

## Example

This example bundles an entrypoint into a single ESM output.

```ts
import * as esbuild from 'npm:esbuild@0.23.0'
// Import the WASM build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@0.20.2/wasm.js";

import { denoPlugins } from 'jsr:@duesabati/esbuild-deno-plugin@^0.0.1'

const result = await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ['https://deno.land/std@0.185.0/bytes/mod.ts'],
  outfile: './dist/bytes.esm.js',
  bundle: true,
  format: 'esm',
})

console.log(result.outputFiles)

esbuild.stop()
```

## Limitations

- The `"portable"` loader does not use the Deno module cache, so all remote
  specifiers are downloaded on every run.

- When using the `"portable"` loader, all `npm:` dependencies must be
  pre-downloaded into a local `node_modules/` directory.

- When using the `"portable"` loader with `jsr:` specifiers, a lockfile must be
  present and passed to the loader (either using `configPath` or `lockPath`).

- `npm:` specifiers are not supported on WASM esbuild builds due to FS access
  limitations (see https://github.com/evanw/esbuild/pull/2968).

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
