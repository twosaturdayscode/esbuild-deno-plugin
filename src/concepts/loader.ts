import type { OnLoadResult } from './esbuild.ts'

export type LoaderType = 'native' | 'portable'

// deno-lint-ignore ban-types
export const LOADER_TYPES: (LoaderType | string & {})[] = ['native', 'portable']

export type LoaderResolution =
  | LoaderResolutionEsm
  | LoaderResolutionNpm
  | LoaderResolutionNode

export interface LoaderResolutionEsm {
  kind: 'esm'
  specifier: URL
}

export interface LoaderResolutionNpm {
  kind: 'npm'
  packageId: string
  packageName: string
  path: string
}

export interface LoaderResolutionNode {
  kind: 'node'
  path: string
}

export interface LoaderResolver {
  resolve(specifier: URL): Promise<LoaderResolution>
}

export interface ESMLoader {
  loadESM(specifier: URL): Promise<OnLoadResult>
}

export type Loader = LoaderResolver & ESMLoader

export interface DenoLoaderOptions {
  // /**
  //  * Specify which loader to use. By default this will use the `native` loader,
  //  * unless the `--allow-run` permission has not been given.
  //  *
  //  * See {@link denoLoaderPlugin} for more information on the different loaders.
  //  */
  // loader?: LoaderType

  /**
   * Specify the path to a deno.json config file to use. This is equivalent to
   * the `--config` flag to the Deno executable. This path must be absolute.
   *
   * NOTE: Import maps in the config file are not used to inform resolution, as
   * this has already been done by the `denoResolverPlugin`. This option is only
   * used when specifying `loader: "native"` to more efficiently load modules
   * from the cache. When specifying `loader: "native"`, this option must be in
   * sync with the `configPath` option for `denoResolverPlugin`.
   */
  configPath?: string
  /**
   * Specify a URL to an import map file to use when resolving import
   * specifiers. This is equivalent to the `--import-map` flag to the Deno
   * executable. This URL may be remote or a local file URL.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what import map to use, if any.
   *
   * NOTE: Import maps in the config file are not used to inform resolution, as
   * this has already been done by the `denoResolverPlugin`. This option is only
   * used when specifying `loader: "native"` to more efficiently load modules
   * from the cache. When specifying `loader: "native"`, this option must be in
   * sync with the `importMapURL` option for `denoResolverPlugin`.
   */
  importMapURL?: string
  /**
   * Specify the path to a lock file to use. This is equivalent to the `--lock`
   * flag to the Deno executable. This path must be absolute.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what import map to use, if any.
   *
   * A lockfile must be present to resolve `jsr:` specifiers with the `portable`
   * loader. When using the `native` loader, a lockfile is not required, but to
   * ensure dependencies are de-duplicated correctly, it is recommended to use a
   * lockfile.
   *
   * NOTE: when using `loader: "portable"`, integrity checks are not performed
   * for ESM modules.
   */
  lockPath?: string
  /**
   * Specify whether to generate and use a local `node_modules` directory when
   * using the `native` loader. This is equivalent to the `--node-modules-dir`
   * flag to the Deno executable.
   *
   * This option is ignored when using the `portable` loader, as the portable
   * loader always uses a local `node_modules` directory.
   */
  nodeModulesDir?: boolean
}
