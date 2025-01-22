import { dirname, join } from '@std/path'
import type { DenoLoaderOptions } from './concepts/loader.ts'

import { DenoConfig } from './core/deno/config.ts'

export class LoaderPluginConf {
  shouldUseNodeModules(): void {
    this.config.useNodeModulesFolder = true
  }

  static fromOptions(opts: DenoLoaderOptions): LoaderPluginConf {
    const loader = new LoaderPluginConf()

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

  private constructor(
    private readonly config = {
      useNodeModulesFolder: false,
      configPath: '',
      importMapURL: '',
      lockPath: '',
    },
  ) {}

  get isUsingNodeModules(): boolean {
    return this.config.useNodeModulesFolder
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
