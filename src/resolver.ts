import { dirname, resolve, toFileUrl } from '@std/path'

import type { Plugin } from './concepts/esbuild.ts'

import {
  Externals,
  isNodeModulesResolution,
  urlToEsbuildResolution,
} from './concepts/esbuild/utils.ts'

import { ImportMap } from './core/imports-map.ts'
import { DenoConfig } from './core/deno/config.ts'

const PLUGIN_NAME = 'deno-resolver'

/** Options for the {@link denoResolverPlugin}. */
export interface DenoResolverOptions {
  /**
   * Specify the path to a root deno.json config file to use. This is equivalent to
   * the `--config` flag to the Deno executable. This path must be absolute.
   *
   * If this option is not specified, the plugin will look the root deno.json file in
   */
  configPath?: string
  /**
   * Specify a URL to an import map file to use when resolving import
   * specifiers. This is equivalent to the `--import-map` flag to the Deno
   * executable. This URL may be remote or a local file URL.
   *
   * If this option is not specified, the root deno.json config file is consulted to
   * determine what import map to use, if any, by looking at the "importMap" field.
   */
  importMapURL?: string
  /**
   * Decide whether to add for each entry in the import map the corresponding
   * relative remappd entries. Defaults to `true`.
   *
   * @example
   * If you have the following entry in the import map:
   * ```json
   * {
   *  "imports": {
   *    "react": "https://esm.sh/react@18.3.1"
   *  }
   * }
   * ```
   *
   * If `expandImports` is set to `true`, the following entries will be added:
   * ```json
   * {
   *  "imports": {
   *    "react": "https://esm.sh/react@18.3.1",
   *    "react/": "https://esm.sh/react@18.3.1/"
   *  }
   * }
   * ```
   *
   * @default true
   */
  expandImports?: boolean
}

/**
 * The Deno resolver plugin performs:
 *  1. relative->absolute specifier resolution
 *  2. import map resolution.
 *  3. workspace package resolution.
 *  4. vendorized package resolution.
 *
 * If using the {@link denoLoader}, this plugin must be used before the
 * loader plugin.
 */
export const denoResolver = (
  opts: DenoResolverOptions = { expandImports: true },
): Plugin => ({
  name: PLUGIN_NAME,
  /**
   * The setup of this plugin consists in having a usable "ImportMap" object
   * that will be provided to the resolve step.
   */
  setup: async (b) => {
    const { expandImports = true } = opts

    const externals = Externals.fromOptions(b.initialOptions.external ?? [])

    /**
     * In Deno, the import map can be specified in 3 ways in order of precedence:
     * 1. Using the `--import-map` flag to the Deno executable.
     * 2. Using a the field 'imports' in a deno.json/jsonc config file.
     * 3. Using the "importsMap" field in a deno.json/jsonc config file
     *    (equivalent to the `--import-map` flag).
     *
     * Now that we know that, we understand that there are only 2 ways that
     * an import map can be provided:
     * 1. An import map URL provided in the options.
     * 2. A deno.json config file provided in the options.
     *
     * @note Remember that that order is expected.
     */
    const map = ImportMap.empty()

    if (opts.importMapURL) {
      const fetched = await fetch(opts.importMapURL).then((r) => r.json())
      map.loadRaw(fetched).resolveWith(opts.importMapURL)
    }

    /**
     * From deno config file (deno.json/c).     *
     */
    if (opts.configPath) {
      const config = DenoConfig.fromAbsolute(opts.configPath)

      if (config.imports) {
        map
          .loadRaw({ imports: config.imports, scopes: config.scopes })
          .resolveWith(toFileUrl(opts.configPath ?? Deno.cwd()).href)

        if (expandImports) {
          map.expand()
        }
      }

      if (config.importMap) {
        const importMapPath = new URL(
          config.importMap,
          toFileUrl(opts.configPath),
        )

        const fetched = await fetch(importMapPath).then((r) => r.json())

        map.loadRaw(fetched).resolveWith(importMapPath.href)
      }

      // If `workspace` is specified, use the workspace to extend the
      // import map.
      if (Array.isArray(config.workspace) && config.workspace.length > 0) {
        for (const member of config.workspace) {
          const root = dirname(opts.configPath)
          const path = resolve(root, member)

          const { name, exports, imports } = DenoConfig.ofWorkspaceMember(path)

          if (!name || !exports) {
            continue
          }

          const importUrl = toFileUrl(resolve(path, exports)).href
          map.addImport(name, importUrl)

          if (imports) {
            for (const [k, v] of Object.entries(imports)) {
              map.addScope(toFileUrl(path + '/').href, { [k]: v })
            }
          }
        }
      }
    }

    b.onResolve({ filter: /.*/ }, async (args) => {
      // Pass through any node_modules internal resolution.
      if (isNodeModulesResolution(args)) {
        return undefined
      }

      if (args.importer === '' && args.resolveDir === '') {
        return undefined
      }

      if (args.importer !== '') {
        if (args.namespace === '') {
          throw new Error('[assert] namespace is empty')
        }

        const referrer = new URL(`${args.namespace}:${args.importer}`)

        const resolved = map.resolveModule(args.path, referrer.href)

        if (externals.has(resolved)) {
          return { path: resolved, external: true }
        }

        const { path, namespace } = urlToEsbuildResolution(new URL(resolved))

        return await b.resolve(path, {
          namespace,
          kind: args.kind,
        })
      }

      const referrer = new URL(`${toFileUrl(args.resolveDir).href}/`)

      const resolved = map.resolveModule(args.path, referrer.href)

      if (externals.has(resolved)) {
        return { path: resolved, external: true }
      }

      const { path, namespace } = urlToEsbuildResolution(new URL(resolved))

      return await b.resolve(path, {
        namespace,
        kind: args.kind,
      })
    })
  },
})
