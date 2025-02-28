import { dirname, join, resolve, toFileUrl } from '@std/path'
import { existsSync } from '@std/fs'

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
   * If this option is not specified, the plugin will look the root deno.json
   * file in the current working directory.
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
export const denoResolver = (opts: DenoResolverOptions = {}): Plugin => ({
  name: PLUGIN_NAME,
  /**
   * The setup of this plugin consists in having a usable "ImportMap" object
   * that will be provided to the resolve step.
   */
  setup: async (b) => {
    const { expandImports = true } = opts

    const config_path = opts.configPath ?? DenoConfig.findPath(Deno.cwd())
    const config = DenoConfig.fromAbsolute(config_path)

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
    let map = ImportMap.empty()

    /**
     * From deno config file (deno.json/c).     *
     */

    if (config.imports) {
      map = map
        .load({ imports: config.imports, scopes: config.scopes }, {
          base: toFileUrl(opts.configPath ?? Deno.cwd()).href,
        })
    }

    if (config.importMap) {
      const import_map_path = new URL(config.importMap, toFileUrl(config_path))

      const fetched = await fetch(import_map_path)
        .then((r) => r.json())
        .catch(
          (e) => {
            throw Error(
              `Failed to fetch import map at ${import_map_path} due to: ${e}`,
            )
          },
        )

      map = map.load(fetched, { base: import_map_path.href })
    }

    // If `workspace` is specified, use the workspace to extend the
    // import map.
    if (Array.isArray(config.workspace) && config.workspace.length > 0) {
      const root = dirname(config_path)

      /**
       * Retrieve all the workspace members paths.
       */
      const workspace_members = config.workspace.map((path) => {
        if (is_glob(path)) {
          const glob = resolve(root, get_root_of(path))

          const members = Array.from(Deno.readDirSync(glob))
            .filter((e) => e.isDirectory)
            .map((e) => resolve(glob, e.name))
            .filter(is_deno_project)

          return members
        }

        return resolve(root, path)
      }).flat()

      for (const path of workspace_members) {
        const { name, exports, imports, importMap } = DenoConfig
          .ofWorkspaceMember(path)

        /**
         * If `name` or `exports` are missing, it means it's an application
         * package and not a lib package, therefore we just add to the map
         * its imports scoped under its path.
         */
        if (!name || !exports) {
          if (imports) map = map.addScope(toFileUrl(path + '/').href, imports)

          continue
        }

        /**
         * @todo Get rid of this if else block.
         */
        if (typeof exports === 'string') {
          const mod = toFileUrl(resolve(path, exports)).href

          map = map.addImport(name, mod)
        } else {
          for (const [k, v] of Object.entries(exports)) {
            map = map.addImport(
              join(name, k),
              toFileUrl(resolve(path, v)).href,
            )
          }
        }

        const location = toFileUrl(path + '/').href

        /**
         * If the user has already defined a scope for this location,
         * their configuration takes precedence, we should not override it.
         */
        if (map.hasScope(location)) continue

        /**
         * The user has not defined a scope for this location, we can
         * use the imports map of the member to resolve its imports.
         *
         * We create an import map for each workspace member.
         */
        let memberMap = ImportMap.empty()

        if (imports) {
          memberMap = memberMap.load({ imports }, { base: location })
        }

        // if (scopes) {
        //   memberMap.load({ scopes }, { base: location })
        // }

        if (importMap) {
          const importMapPath = new URL(importMap, toFileUrl(path))

          const fetched = await fetch(importMapPath).then((r) => r.json())
            .catch((e) => {
              throw Error(
                `Failed to fetch import map at ${importMapPath} of workspace member ${name} due to: ${e}`,
              )
            })

          memberMap = memberMap.load(fetched, { base: importMapPath.href })
        }

        /**
         * Finally, we load the member map into the root map as scoped
         * imports.
         */
        map = map.addScope(location, Object.fromEntries(memberMap.imports))
      }
    }

    if (opts.importMapURL) {
      const fetched = await fetch(opts.importMapURL).then((r) => r.json())
        .catch(
          (e) => {
            throw Error(
              `Failed to fetch import map at ${opts.importMapURL} due to: ${e}.`,
            )
          },
        )

      map = map.load(fetched, { base: opts.importMapURL })
    }

    if (expandImports) {
      map = map.expand()
    }

    /**
     * Now that we have finalized the import map, we can start the resolution
     * process.
     */
    b.onResolve({ filter: /.*/ }, async (args) => {
      /**
       * Pass through any node_modules internal resolution.
       */
      if (isNodeModulesResolution(args)) return undefined

      /**
       * @todo Document this case.
       */
      if (args.importer === '' && args.resolveDir === '') return undefined

      /**
       * What does it mean to have an empty importer?
       */
      if (args.importer === '') {
        const referrer = new URL(`${toFileUrl(args.resolveDir).href}/`)

        const resolved = map.resolveModule(args.path, referrer.href)

        if (externals.has(resolved)) return { path: resolved, external: true }

        const { path, namespace } = urlToEsbuildResolution(new URL(resolved))

        return await b.resolve(path, { namespace, kind: args.kind })
      }

      if (args.namespace === '') {
        throw new Error('[assert] namespace is empty.')
      }

      const referrer = new URL(`${args.namespace}:${args.importer}`)

      const resolved = map.resolveModule(args.path, referrer.href)

      if (externals.has(resolved)) return { path: resolved, external: true }

      const { path, namespace } = urlToEsbuildResolution(new URL(resolved))

      return await b.resolve(path, { namespace, kind: args.kind })
    })
  },
})

const is_glob = (path: string) => path.endsWith('*')
const get_root_of = (glob: string) => glob.split('/').slice(0, -1).join('/')
const is_deno_project = (path: string) =>
  existsSync(path + '/deno.json') || existsSync(path + '/deno.jsonc')
