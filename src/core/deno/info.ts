const decoder = new TextDecoder()

import type { ModuleEntry, NpmPackage } from '../../concepts/deno.ts'

export interface RootInfoOutput {
  denoDir: string
  npmCache: string
}

interface InfoOutput {
  roots: string[]
  modules: ModuleEntry[]
  redirects: Record<string, string>
  npmPackages: Record<string, NpmPackage>
}

// const defaultArgs = new Set(['info', '--json', '--no-config', '--no-lock'])

/**
 * Perform 'deno info' operations.
 */
export class DenoInfo {
  private static readonly tempDir = Deno.makeTempDirSync()

  readonly args = new Set(['info', '--json', '--no-config', '--no-lock'])

  private cwd: Deno.CommandOptions['cwd'] = DenoInfo.tempDir

  private info_cache = new Map<string, InfoOutput>()

  static async root(): Promise<RootInfoOutput> {
    const cmd = new Deno.Command(
      Deno.execPath(),
      {
        args: ['info', '--json', '--no-config', '--no-lock'],
        cwd: DenoInfo.tempDir,
        env: { DENO_NO_PACKAGE_JSON: 'true' },
        stdout: 'piped',
        stderr: 'inherit',
      },
    )

    const output = await cmd.output()

    if (!output.success) {
      throw new Error(`Failed to call 'deno info'`)
    }

    const txt = decoder.decode(output.stdout)
    return JSON.parse(txt)
  }

  setCwd(path: string) {
    this.args.delete('--no-lock')
    this.cwd = path
  }

  setConfigPath(path: string) {
    this.args.delete('--no-config')
    this.args.add(`--config=${path}`)
  }

  useImportMap(path: string) {
    this.args.add(`--import-map=${path}`)
  }

  useLockFile(path: string) {
    if (path) {
      this.args.delete('--no-lock')
      this.args.add(`--lock=${path}`)
    }
  }

  useNodeModulesDir() {
    this.args.add('--node-modules-dir')
  }

  async read(specifier: string): Promise<InfoOutput> {
    if (this.info_cache.has(specifier)) {
      return this.info_cache.get(specifier)!
    }

    const args = Array.from(this.args)

    args.push(specifier)

    const cmd: Deno.CommandOptions = {
      args,
      env: { DENO_NO_PACKAGE_JSON: 'true' } as Record<string, string>,
      cwd: this.cwd,
      stdout: 'piped',
      stderr: 'inherit',
    }

    const output = await new Deno.Command(
      Deno.execPath(),
      cmd,
    ).output()

    if (!output.success) {
      throw new Error(`Failed to call 'deno info' on '${specifier}'`)
    }

    const info = JSON.parse(decoder.decode(output.stdout))
    this.info_cache.set(specifier, info)

    return info
  }
}
