import { dirname, join } from '@std/path'
import { isRunAllowed } from './concepts/deno.ts'
import {
  type DenoLoaderOptions,
  LOADER_TYPES,
  type LoaderType,
} from './concepts/loader.ts'

import { DenoConfig } from './core/deno/config.ts'

export class LoaderPluginConf {
  shouldUseNodeModules(): void {
    this.config.useNodeModulesFolder = true
  }

  static async fromOptions(opts: DenoLoaderOptions): Promise<LoaderPluginConf> {
    const defaultLoader = await LoaderPluginConf.defaultLoader()

    const loader = new LoaderPluginConf(defaultLoader)

    if (opts.configPath) {
      const config = DenoConfig.fromAbsolute(opts.configPath)

      // if (config.lock !== false) {
      //   loader.setLockPath(join(dirname(opts.configPath), 'deno.lock'))
      // }

      if (typeof config.lock === 'string' && config.lock !== '') {
        loader.setLockPath(join(dirname(opts.configPath), config.lock))
      }

      loader.setConfigPath(opts.configPath)
    }

    if (opts.importMapURL) {
      loader.setImportMapURL(opts.importMapURL)
    }

    if (opts.lockPath) {
      loader.setLockPath(opts.lockPath)
    }

    if (opts.nodeModulesDir) {
      loader.shouldUseNodeModules()
    }

    return loader
  }

  /**
   * If the `--allow-run` permission has been granted, this will use the `native`
   * loader. Otherwise, it will use the `portable` loader.
   *
   * @returns The default loader based on the permissions granted to the script.
   */
  static async defaultLoader(): Promise<LoaderType> {
    if (await isRunAllowed()) {
      return 'native'
    }

    return 'portable'
  }

  private constructor(
    private loader: LoaderType,
    private readonly config = {
      useNodeModulesFolder: false,
      configPath: '',
      importMapURL: '',
      lockPath: '',
    },
  ) {}

  setLoaderType(loaderType: LoaderType): void {
    this.loader = loaderType
  }

  get isUsingNodeModules(): boolean {
    return this.config.useNodeModulesFolder
  }

  get isUsingNativeLoader(): boolean {
    return this.loader === 'native'
  }

  static isSupported(loader: string): loader is LoaderType {
    return LOADER_TYPES.includes(loader)
  }

  setConfigPath(configPath: string): void {
    this.config.configPath = configPath
  }

  setImportMapURL(importMapURL: string): void {
    this.config.importMapURL = importMapURL
  }

  setLockPath(lockPath: string): void {
    this.config.lockPath = lockPath
  }

  get providedConfigPath(): boolean {
    return this.config.configPath !== ''
  }

  get configPath(): string {
    return this.config.configPath
  }

  get providedImportMapURL(): boolean {
    return this.config.importMapURL !== ''
  }

  get importMapURL(): string {
    return this.config.importMapURL
  }

  get providedLockPath(): boolean {
    return this.config.lockPath !== ''
  }

  get lockPath(): string {
    return this.config.lockPath
  }
}
