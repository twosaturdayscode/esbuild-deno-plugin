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

import { DenoInfo } from './core/deno/info.ts'
import { NativeResolver } from './loaders/native.ts'
import { NodeModulesDirectory } from './core/node-modules.ts'
import { ModulesCache } from './loaders/infrastructure.ts'
import { isBuiltInNodeModule } from './concepts/node.ts'
import { mapContentType, mediaTypeToLoader } from './concepts/deno.ts'

const PLUGIN_NAME = 'deno-loader'

/**
 * The Deno loader plugin for esbuild. This plugin will load fully qualified
 * `file`, `http`, `https`, and `data` URLs.
 *
 * **Note** that this plugin does not do relative->absolute specifier
 * resolution, or import map resolution. You must use the `denoResolverPlugin`
 * _before_ the `denoLoaderPlugin` to do that.
 *
 * The plugin shells out to the Deno executable under the hood to load
 * files. Requires `--allow-read` and `--allow-run`. In this mode the download
 * cache is shared with the Deno executable. It will respect deno.lock,
 * DENO_DIR, DENO_AUTH_TOKENS, and all similar loading configuration. Files are
 * cached on disk in the same Deno cache as the Deno executable, and will not be
 * re-downloaded on subsequent builds.
 *
 * NPM specifiers can be used without requiring a local * `node_modules`
 * directory.
 * NPM packages are resolved, downloaded, cached, and loaded in the same way as
 * the Deno executable does.
 *
 * JSR specifiers can be used without restrictions. To ensure dependencies are
 * de-duplicated correctly, it is recommended to use a lockfile.
 */
export const denoLoader = (opts: DenoLoaderOptions = {}): Plugin => ({
  name: PLUGIN_NAME,
  setup: (b) => {
    const cnf = LoaderPluginConf.fromOptions(opts)

    const cwd = b.initialOptions.absWorkingDir ?? Deno.cwd()

    const nodeDir = new NodeModulesDirectory(join(cwd, 'node_modules'))
    const modulesDir = new ModulesCache()

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
        if (cnf.isUsingNodeModules) return undefined

        /**
         * If it's a relative path, we just let esbuild handle it.
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

      const resolution = esbuildResolutionToURL(args)

      // ─────────────────────────────────────────────────────────────────────────────

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

    b.onResolve({ filter: /.*/, namespace: 'file' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'http' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'https' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'data' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'npm' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'jsr' }, onResolve)
    b.onResolve({ filter: /.*/, namespace: 'node' }, onResolve)

    async function onLoad(args: OnLoadArgs): Promise<OnLoadResult | undefined> {
      if (args.namespace === 'file' && isInNodeModules(args.path)) {
        // inside node_modules, let esbuild handle it as usual
        return undefined
      }

      const resolution = esbuildResolutionToURL(args)

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

    /**
     * @todo Once https://github.com/evanw/esbuild/pull/2968 is fixed, remove the catch all "file" handler
     */
    b.onLoad({ filter: /.*/, namespace: 'file' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'http' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'https' }, onLoad)
    b.onLoad({ filter: /.*/, namespace: 'data' }, onLoad)
  },
})
