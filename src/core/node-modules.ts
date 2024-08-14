import { dirname, join } from '@std/path'
import { encodeBase32 } from '@std/encoding/base32'

import type { NpmPackage } from '../concepts/deno.ts'
import { DenoInfo } from './deno/info.ts'

/** @todo This class can be probably broken down in 2. */
export class NodeModulesDirectory {
  /** Cache the deno info command executed on project root. */
  private static readonly rootInfo = DenoInfo.root()

  private readonly nodeModulesDir: Map<string, string> = new Map()
  private readonly npmPackagesDir: Map<string, NpmPackage> = new Map()
  private readonly linkDir: Map<string, string> = new Map()

  constructor(private readonly path: string) {}

  get ownPath() {
    return this.path
  }

  findParentPackageId(importer: string): string {
    const id = this.nodeModulesDir.get(importer)

    if (id) {
      return id
    }

    if (importer !== dirname(importer)) {
      this.findParentPackageId(dirname(importer))
    }

    throw new Error(
      `Could not find package ID for importer: ${importer}`,
    )
  }

  registerNodeModule(dir: string, pkgId: string) {
    this.nodeModulesDir.set(dir, pkgId)
  }

  findPackageId(importer: string, path: string) {
    const parentPackageId = this.findParentPackageId(importer)
    const [packageName] = this.readPackagePath(path).split('/')

    const parentPackage = this.getPackage(parentPackageId)

    if (parentPackage.name === packageName) {
      return parentPackageId
    }

    for (const dep of parentPackage.dependencies) {
      const depPackage = this.getPackage(dep)

      if (depPackage.name === packageName) return dep
    }

    return parentPackageId
  }

  /**
   * @todo It's not clear what this is doing.
   */
  async resolvePackage(pkgId: string) {
    const pkg = this.getPackage(pkgId)

    if (this.linkDir.has(pkgId)) {
      const linkDir = this.linkDir.get(pkgId)
      return linkDir!
    }

    let name = pkg.name

    if (pkg.name.toLowerCase() !== pkg.name) {
      name = `_${encodeBase32(new TextEncoder().encode(name))}`
    }

    const { denoDir, npmCache } = await NodeModulesDirectory.rootInfo

    const packageDir = join(
      npmCache,
      'registry.npmjs.org',
      name,
      pkg.version,
    )

    const linkDirPath = join(
      denoDir,
      'deno_esbuild',
      pkgId,
      'node_modules',
      name,
    )

    const linkDirParent = dirname(linkDirPath)
    const tmpDirParent = join(denoDir, 'deno_esbuild_tmp')

    /** @todo Check if this can be replaced by a `exists` */
    try {
      await Deno.stat(linkDirPath)

      this.linkDir.set(pkgId, linkDirPath)

      return linkDirPath
    } catch {
      // directory does not yet exist
    }

    // create a temporary directory, recursively hardlink the package contents
    // into it, and then rename it to the final location
    await Deno.mkdir(tmpDirParent, { recursive: true })
    const tmpDir = await Deno.makeTempDir({ dir: tmpDirParent })
    await linkRecursive(packageDir, tmpDir)

    try {
      await Deno.mkdir(linkDirParent, { recursive: true })
      await Deno.rename(tmpDir, linkDirPath)
    } catch (err) {
      // the directory may already have been created by someone else - check if so
      try {
        await Deno.stat(linkDirPath)
      } catch {
        throw err
      }
    }

    this.linkDir.set(pkgId, linkDirPath)

    return linkDirPath
  }

  readPackagePath(path: string) {
    if (path.startsWith('@')) {
      const [scope, name, ...rest] = path.split('/')

      return [`${scope}/${name}`, rest].join('/')
    }

    const [name, ...rest] = path.split('/')
    return [name, rest].join('/')
  }

  /** @todo If it's used only in the resolve function make it private. */
  getPackage(id: string): NpmPackage {
    const pkg = this.npmPackagesDir.get(id)

    if (!pkg) {
      throw new Error(`NPM package "${id}" not found.`)
    }

    return pkg
  }

  register(npmPackages: Record<string, NpmPackage>) {
    for (const [id, npmPackage] of Object.entries(npmPackages)) {
      this.npmPackagesDir.set(id, npmPackage)
    }
  }
}

async function linkRecursive(from: string, to: string) {
  const fromStat = await Deno.stat(from)
  if (fromStat.isDirectory) {
    await Deno.mkdir(to, { recursive: true })
    for await (const entry of Deno.readDir(from)) {
      await linkRecursive(join(from, entry.name), join(to, entry.name))
    }
  } else {
    await Deno.link(from, to)
  }
}
