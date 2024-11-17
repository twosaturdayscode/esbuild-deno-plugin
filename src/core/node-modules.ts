import { dirname, join } from '@std/path'
import { encodeBase32 } from '@std/encoding/base32'

import type { NpmPackage } from '../concepts/deno.ts'
import { DenoInfo } from './deno/info.ts'

/** @todo This class can be probably broken down in 2. */
export class NodeModulesDirectory {
  /** Cache the deno info command executed on project root. */
  private static readonly rootInfo = DenoInfo.root()

  readonly nodeModulesDir: Map<string, string> = new Map()
  readonly npmPackagesDir: Map<string, NpmPackage> = new Map()
  readonly linkDir: Map<string, string> = new Map()

  constructor(private readonly path: string) {}

  get ownPath() {
    return this.path
  }

  findParentPackageId(importer: string): string {
    const id = this.nodeModulesDir.get(importer)

    if (id) return id

    if (importer === '/' || importer === '.') {
      throw new Error(
        `Could not find package ID for importer: ${importer}`,
      )
    }

    return this.findParentPackageId(dirname(importer))
  }

  registerNodeModule(dir: string, pkgId: string) {
    this.nodeModulesDir.set(dir, pkgId)
  }

  findPackageId(importer: string, path: string) {
    const parentPackageId = this.findParentPackageId(importer)

    const package_name = this.readPackageNameFrom(path)

    const parentPackage = this.getPackage(parentPackageId)

    if (parentPackage.name === package_name) {
      return parentPackageId
    }

    for (const dep of parentPackage.dependencies) {
      const depPackage = this.getPackage(dep)

      if (depPackage.name === package_name) return dep
    }

    return parentPackageId
  }

  /**
   * @todo It's not clear what this is doing.
   */
  async resolvePackage(pkgId: string) {
    const pkg = this.getPackage(pkgId)

    if (this.linkDir.has(pkgId)) {
      return this.linkDir.get(pkgId)!
    }

    let name = pkg.name

    if (pkg.name.toLowerCase() !== pkg.name) {
      name = `_${encodeBase32(new TextEncoder().encode(name))}`
    }

    const { denoDir, npmCache } = await NodeModulesDirectory.rootInfo

    /**
     * @todo Move this to its place once you refactor this class.
     *
     * The npmDir is not always `registry.npmjs.org` it changes based on the
     * registry used. If using a private registry it will be the domain of the
     * registry. This info is found in the `.npmrc` file.
     *
     * See https://docs.deno.com/runtime/manual/node/private_registries/
     */
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

  /**
   * This function is used to get the package name from an import path,
   * that is not a file path or url.
   *
   * @example
   *
   * // Say we have a package with the name `@foo/bar` and we want to get the
   * // package name from the import path `@foo/bar/baz/qux`.
   * const import_path = '@foo/bar/baz/qux'
   * const package_name = readPackagePath(import_path)
   * console.log(package_name) // @foo/bar
   *
   * // Say we have a package with the name `foo` and we want to get the
   * // package name from the import path `foo/bar/baz/qux`.
   * const import_path = 'foo/bar/baz/qux'
   * const package_name = readPackagePath(import_path)
   * console.log(package_name) // foo
   *
   * @param import_path
   * @returns
   */
  readPackageNameFrom(import_path: string) {
    if (import_path.startsWith('@')) {
      const [scope, name] = import_path.split('/')
      return `${scope}/${name}`
    }

    const [name] = import_path.split('/')
    return name
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
