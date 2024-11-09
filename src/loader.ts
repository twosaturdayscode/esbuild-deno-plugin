import { fromFileUrl, join } from '@std/path'

import type {
  OnLoadArgs,
  OnLoadResult,
  OnResolveArgs,
  Plugin,
} from './concepts/esbuild.ts'
import {
  esbuildResolutionToURL,
  isInNodeModules,
  isNodeModulesResolution,
  urlToEsbuildResolution,
} from './concepts/esbuild/utils.ts'
import type { DenoLoaderOptions } from './concepts/loader.ts'

import { LoaderPluginConf } from './configurator.ts'

import { DenoLockfile } from './core/deno/lockfile.ts'
import { DenoInfo } from './core/deno/info.ts'
import { NativeResolver } from './loaders/native.ts'
import { NodeModulesDirectory } from './core/node-modules.ts'
import { ModulesCache, RemoteModules } from './loaders/infrastructure.ts'
import { config } from './concepts/configs.ts'
import { isBuiltInNodeModule } from './concepts/node.ts'
import { mapContentType, mediaTypeToLoader } from './concepts/deno.ts'
import type { Module } from './concepts/deno.ts'
import { JSRSpecifier, NPMSpecifier } from './core/specifiers.ts'

const PLUGIN_NAME = 'deno-loader'

/**
 * The Deno loader plugin for esbuild. This plugin will load fully qualified
 * `file`, `http`, `https`, and `data` URLs.
 *
 * **Note** that this plugin does not do relative->absolute specifier
 * resolution, or import map resolution. You must use the `denoResolverPlugin`
 * _before_ the `denoLoaderPlugin` to do that.
 *
 * This plugin can be backed by two different loaders, the `native` loader and
 * the `portable` loader.
 *
 * ### Native Loader
 *
 * The native loader shells out to the Deno executable under the hood to load
 * files. Requires `--allow-read` and `--allow-run`. In this mode the download
 * cache is shared with the Deno executable. This mode respects deno.lock,
 * DENO_DIR, DENO_AUTH_TOKENS, and all similar loading configuration. Files are
 * cached on disk in the same Deno cache as the Deno executable, and will not be
 * re-downloaded on subsequent builds.
 *
 * NPM specifiers can be used in the native loader without requiring a local
 * `node_modules` directory. NPM packages are resolved, downloaded, cached, and
 * loaded in the same way as the Deno executable does.
 *
 * JSR specifiers can be used without restrictions in the native loader. To
 * ensure dependencies are de-duplicated correctly, it is recommended to use a
 * lockfile.
 *
 * ### Portable Loader
 *
 * The portable loader does module downloading and caching with only Web APIs.
 * Requires `--allow-read` and/or `--allow-net`. This mode does not respect
 * deno.lock, DENO_DIR, DENO_AUTH_TOKENS, or any other loading configuration. It
 * does not cache downloaded files. It will re-download files on every build.
 *
 * NPM specifiers can be used in the portable loader, but require a local
 * `node_modules` directory. The `node_modules` directory must be created prior
 * using Deno's `--node-modules-dir` flag.
 *
 * JSR specifiers require a lockfile to be present to resolve.
 */
export const denoLoader = (opts: DenoLoaderOptions = {}): Plugin => ({
  name: PLUGIN_NAME,
  setup: async (b) => {
    const cnf = await LoaderPluginConf.fromOptions(opts)

    const cwd = b.initialOptions.absWorkingDir ?? Deno.cwd()

    const nodeDir = new NodeModulesDirectory(join(cwd, 'node_modules'))
    const modulesDir = new ModulesCache()
    const fetchedDir = new RemoteModules()

    const info = new DenoInfo()

    if (cnf.providedConfigPath) {
      info.setConfigPath(cnf.configPath)
    }

    if (cnf.providedImportMapURL) {
      info.useImportMap(cnf.importMapURL)
    }

    if (cnf.providedLockPath) {
      info.useLockFile(cnf.lockPath)
    }

    if (cnf.isUsingNodeModules) {
      info.useNodeModulesDir()
    }

    const readInfo = async (specifier: string) => await info.read(specifier)

    const onResolve = async (args: OnResolveArgs) => {
      if (isNodeModulesResolution(args)) {
        /**
         * Whenever it's a built-in module, we just return it as external
         * and let esbuild handle it.
         */
        if (isBuiltInNodeModule(args.path)) {
          return { path: args.path, external: true }
        }

        /**
         * If we are using the node_modules directory, we don't need to do anything.
         * We just let esbuild handle it.
         */
        if (cnf.isUsingNodeModules) {
          return undefined
        }

        if (cnf.isUsingNativeLoader) {
          /**
           * Using the native loader, if it's a relative path, we just let
           * esbuild handle it.
           */
          if (args.path.startsWith('.')) return undefined

          const pkgId = nodeDir.findPackageId(args.importer, args.path)

          const resolveDir = await nodeDir.resolvePackage(pkgId)

          nodeDir.registerNodeModule(resolveDir, pkgId)

          return await b.resolve(args.path, {
            kind: args.kind,
            resolveDir,
            importer: args.importer,
          })
        }

        throw new Error(
          `Could not load npm module "${args.path}".
            Remember that to load npm modules you must either use the "native" loader
            or specify the "nodeModulesDir" option.`,
        )
      }

      const resolution = esbuildResolutionToURL(args)

      // ─────────────────────────────────────────────────────────────────────────────

      if (cnf.isUsingNativeLoader) {
        const { modules, redirects, npmPackages } = await readInfo(
          resolution.href,
        )

        nodeDir.register(npmPackages)

        modulesDir.registerModules(modules)
        modulesDir.registerRedirects(redirects)

        if (resolution.href.startsWith('npm:')) {
          const specifier = modulesDir.findRedirect(resolution.href) ??
            resolution.href
          const mod = modulesDir.findModule(specifier)

          if (!mod) {
            const { modules, redirects, npmPackages } = await readInfo(
              specifier,
            )

            nodeDir.register(npmPackages)
            modulesDir.registerModules(modules)
            modulesDir.registerRedirects(redirects)
          }
        }

        const specifier = modulesDir.findRedirect(resolution.href) ??
          resolution.href

        const entry = modulesDir.findModule(specifier)

        if (entry === undefined) {
          throw new Error(
            `Unreachable: '${specifier}' loaded but not reachable. (onResolve)`,
          )
        }

        const res = NativeResolver.resolveEntry(entry)

        switch (res.kind) {
          case 'esm': {
            const { specifier } = res
            return urlToEsbuildResolution(specifier)
          }

          case 'node': {
            return {
              path: res.path,
              external: true,
            }
          }

          case 'npm': {
            const resolveDir = await nodeDir.resolvePackage(res.packageId)

            nodeDir.registerNodeModule(resolveDir, res.packageId)

            const path = `${res.packageName}${res.path ?? ''}`

            return await b.resolve(path, {
              kind: args.kind,
              resolveDir,
              importer: args.importer,
            })
          }
        }
      }

      /**
       * Portable loader
       */
      switch (resolution.protocol) {
        case 'file:': {
          return urlToEsbuildResolution(resolution)
        }

        case 'http:':
        case 'https:':
        case 'data:': {
          const module = await fetchedDir.findModule(resolution.href)
          return urlToEsbuildResolution(new URL(module.specifier))
        }

        case 'jsr:': {
          if (!cnf.providedLockPath) {
            throw new Error(
              'JSR specifiers are not supported in the portable loader without a lockfile',
            )
          }

          const lockfile = await DenoLockfile.fromAbsolute(cnf.lockPath)

          const jsrSpecifier = JSRSpecifier.fromURL(resolution)

          // Look up the package + constraint in the lockfile.
          const id = JSRSpecifier.toId(jsrSpecifier)

          /**
           * @todo Create a class for this
           */
          const lockfileEntry = lockfile.packages?.specifiers?.[id]

          if (!lockfileEntry) {
            throw new Error(`Specifier not found in lockfile: ${id}`)
          }

          const lockfileEntryParsed = JSRSpecifier.fromURL(
            new URL(lockfileEntry),
          )

          // Load the JSR manifest to find the export path.
          const manifestUrl = new URL(
            `./${lockfileEntryParsed.name}/${lockfileEntryParsed
              .version!}_meta.json`,
            config().JSR_REGISTRY_URL,
          )

          const manifestModule = await fetchedDir.findModule(manifestUrl.href)

          if (manifestModule.mediaType !== 'Json') {
            throw new Error(
              `Expected JSON media type for JSR manifest, got: ${manifestModule.mediaType}`,
            )
          }

          const manifestData = new TextDecoder().decode(manifestModule.data)
          const manifestJson = JSON.parse(manifestData)

          // Look up the export path in the manifest.
          const exportEntry = `.${jsrSpecifier.path ?? ''}`
          const exportPath = manifestJson.exports[exportEntry]

          if (!exportPath) {
            throw new Error(
              `Package '${lockfileEntry}' has no export named '${exportEntry}'`,
            )
          }

          // Return the resolved URL.
          const resolved = new URL(
            `./${lockfileEntryParsed.name}/${lockfileEntryParsed
              .version!}/${exportPath}`,
            config().JSR_REGISTRY_URL,
          )

          return urlToEsbuildResolution(resolved)
        }

        case 'npm:': {
          if (!cnf.isUsingNodeModules) {
            throw new Error(
              `To use "npm:" specifiers while using "loader: portable", you must specify "nodeModulesDir: true".`,
            )
          }

          const parsed = NPMSpecifier.fromURL(resolution)

          const resolveDir = nodeDir.ownPath
          const path = `${parsed.name}${parsed.path ?? ''}`

          return await b.resolve(path, {
            kind: args.kind,
            resolveDir,
            importer: args.importer,
          })
        }

        case 'node:': {
          return { external: true, path: resolution.pathname }
        }

        default:
          throw new Error(`Unsupported scheme: '${resolution.protocol}'`)
      }
    }

    b.onResolve({ filter: /.*/, namespace: 'file' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'http' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'https' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'data' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'npm' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'jsr' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'node' }, onResolve)

    async function onLoad(
      args: OnLoadArgs,
    ): Promise<OnLoadResult | undefined> {
      if (args.namespace === 'file' && isInNodeModules(args.path)) {
        // inside node_modules, let esbuild handle it as usual
        return undefined
      }

      const resolution = esbuildResolutionToURL(args)

      if (cnf.isUsingNativeLoader) {
        if (resolution.protocol === 'data:') {
          const resp = await fetch(resolution)

          const contents = new Uint8Array(await resp.arrayBuffer())

          const contentType = resp.headers.get('content-type')

          const mediaType = mapContentType(resolution, contentType)

          const loader = mediaTypeToLoader(mediaType)

          return { contents, loader }
        }

        const { modules, redirects, npmPackages } = await readInfo(
          resolution.href,
        )

        nodeDir.register(npmPackages)

        modulesDir.registerModules(modules)
        modulesDir.registerRedirects(redirects)

        if (resolution.href.startsWith('npm:')) {
          const specifier = modulesDir.findRedirect(resolution.href) ??
            resolution.href
          const mod = modulesDir.findModule(specifier)

          if (!mod) {
            const { modules, redirects, npmPackages } = await readInfo(
              specifier,
            )

            nodeDir.register(npmPackages)
            modulesDir.registerModules(modules)
            modulesDir.registerRedirects(redirects)
          }
        }

        const specifier = modulesDir.findRedirect(resolution.href) ??
          resolution.href

        const entry = modulesDir.findModule(specifier)

        if (entry === undefined) {
          throw new Error(
            `Unreachable: '${entry}' loaded but not reachable`,
          )
        }

        if ('error' in entry) throw new Error(entry.error)

        if (!('local' in entry)) {
          throw new Error('[unreachable] Not an ESM module.')
        }

        if (!entry.local) throw new Error('Module not downloaded yet.')

        const loader = mediaTypeToLoader(entry.mediaType)

        const contents = await Deno.readFile(entry.local)

        const res: OnLoadResult = { contents, loader }

        if (resolution.protocol === 'file:') {
          res.watchFiles = [fromFileUrl(resolution)]
        }

        return res
      }

      let module: Module

      switch (resolution.protocol) {
        case 'file:': {
          module = await loadLocal(resolution)
          break
        }

        case 'http:':
        case 'https:':
        case 'data:': {
          module = await fetchedDir.findModule(resolution.href)
          break
        }

        default:
          throw new Error(
            '[unreachable] unsupported esm scheme ' + resolution.protocol,
          )
      }

      const loader = mediaTypeToLoader(module.mediaType)

      const res: OnLoadResult = { contents: module.data, loader }

      if (resolution.protocol === 'file:') {
        res.watchFiles = [fromFileUrl(module.specifier)]
      }
      return res
    }

    /**
     * @todo Once https://github.com/evanw/esbuild/pull/2968 is fixed, remove the catch all "file" handler
     */
    b.onLoad({ filter: /.*/, namespace: 'file' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'http' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'https' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'data' }, onLoad)
  },
})

const loadLocal = async (specifier: URL): Promise<Module> => {
  const path = fromFileUrl(specifier)

  const mediaType = mapContentType(specifier, null)
  const data = await Deno.readFile(path)

  return { specifier: specifier.href, mediaType, data }
}
