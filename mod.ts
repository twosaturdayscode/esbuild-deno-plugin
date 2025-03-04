import type { Plugin } from './src/concepts/esbuild.ts'

import { denoLoader } from './src/loader.ts'
import { denoResolver } from './src/resolver.ts'

export interface DenoPluginsOptions {
  // /**
  //  * Specify which loader to use. By default this will use the `native` loader,
  //  * unless the `--allow-run` permission has not been given.
  //  *
  //  * See {@link denoLoader } for more information on the different loaders.
  //  */
  // loader?: 'native'

  /**
   * Specify the path to a deno.json config file to use. This is equivalent to
   * the `--config` flag to the Deno executable. This path must be absolute.
   */
  configPath?: string
  /**
   * Specify a URL to an import map file to use when resolving import
   * specifiers. This is equivalent to the `--import-map` flag to the Deno
   * executable. This URL may be remote or a local file URL.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what import map to use, if any.
   */
  importMapURL?: string
  /**
   * Specify the path to a deno.lock file to use. This is equivalent to the
   * `--lock` flag to the Deno executable. This path must be absolute.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what lock file to use, if any.
   *
   * A lockfile is not required, but to ensure dependencies are de-duplicated
   * correctly, it is recommended to use a lockfile.
   */
  lockPath?: string
  /**
   * Specify whether to generate and use a local `node_modules` directory when
   * using the `native` loader. This is equivalent to the `--node-modules-dir`
   * flag to the Deno executable.
   */
  nodeModulesDir?: boolean
}

/**
 * A convenience function to enable both the Deno resolver plugin, and Deno
 * loader plugin.
 */
export function denoPlugins(opts: DenoPluginsOptions = {}): Plugin[] {
  return [denoResolver(opts), denoLoader(opts)]
}

export { denoLoader, denoResolver }
