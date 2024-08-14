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

export class DenoInfo {
  private static readonly tempDir = Deno.makeTempDirSync()

  private readonly args: Set<string> = new Set([
    'info',
    '--json',
    '--no-config',
    '--no-lock',
  ])

  private cwd: Deno.CommandOptions['cwd'] = DenoInfo.tempDir

  static async root(): Promise<RootInfoOutput> {
    const cmd = new Deno.Command(
      Deno.execPath(),
      {
        args: ['info', '--json', '--no-config', '--no-lock'],
        cwd: DenoInfo.tempDir,
        env: { DENO_NO_PACKAGE_JSON: 'true' } as Record<string, string>,
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
    this.args.delete('--no-lock')
    this.args.add(`--lock=${path}`)
  }

  useNodeModulesDir() {
    this.args.add('--node-modules-dir')
  }

  async execute(specifier: string): Promise<InfoOutput> {
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

    const txt = decoder.decode(output.stdout)
    return JSON.parse(txt)
  }
}

interface Lockfile {
  version: string
  packages?: { specifiers?: Record<string, string> }
}

export async function readLockfile(path: string): Promise<Lockfile> {
  const lockfile: Lockfile = await Deno.readTextFile(path).then(JSON.parse)
    .catch(
      (err) => {
        if (err instanceof Deno.errors.NotFound) {
          throw new Error(
            `A Lockfile path has been provided but could not found it at: ${path}`,
          )
        }

        throw err
      },
    )

  if (lockfile.version < '3') {
    throw new Error('Unsupported lockfile version: ' + lockfile.version)
  }

  return lockfile
}
