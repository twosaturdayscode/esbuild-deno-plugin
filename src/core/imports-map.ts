import { isStringRecord } from '../validations/is-string-record.ts'
import { isRecord } from '../validations/is-any-record.ts'
import type { Imports, PlainImportMap, Scopes } from '../concepts/deno.ts'
import { resolveUrlLike } from './urls-like.ts'

export class ImportMap {
  private readonly _imports = new Map<string, string>()
  private readonly _scopes = new Map<string, Map<string, string>>()

  /**
   * @returns An empty ImportMap.
   */
  static empty() {
    return new ImportMap()
  }

  private constructor(private readonly pln: Partial<PlainImportMap> = {}) {
    return Object.assign(this, this.pln)
  }

  /**
   * Allows to create a new ImportMap instance from a plain object.
   *
   * @param pln A serialized / plain object import map.
   * @returns A new ImportMap instance.
   */
  load(pln: Partial<PlainImportMap>): ImportMap {
    if (!ImportMap.isValidMapRecord(pln)) {
      throw new Error('Invalid import map shape.')
    }

    Object.entries(pln.imports).forEach(([k, v]) => {
      if (!isValidImportSpecifier(k)) {
        throw new Error(`Invalid import specifier. At import: ${k}`)
      }

      if (!isValidImportValue(v)) {
        throw new Error(`Invalid import value. At import: ${k}`)
      }

      if (!isValidImport(k, v)) {
        throw new Error(
          `Invalid import. If a specifier ends with a "/", the value must also end with a "/". At import: ${k}`,
        )
      }
    })

    for (const [k, v] of Object.entries(pln.imports)) {
      this._imports.set(k, v)
    }

    for (const [k, v] of Object.entries(pln.scopes ?? {})) {
      this._scopes.set(k, new Map(Object.entries(v)))
    }

    return this
  }

  /**
   * Add a new import to the map, mutating the current instance.
   *
   * @param specifier The import specifier.
   * @param path The import value.
   */
  addImport(specifier: string, path: string): void {
    if (!isValidImportSpecifier(specifier)) {
      throw new Error(`Invalid import specifier. At import: ${specifier}`)
    }

    if (!isValidImportValue(path)) {
      throw new Error(`Invalid import value. At import: ${specifier}`)
    }

    if (!isValidImport(specifier, path)) {
      throw new Error(
        'Invalid import. If a specifier ends with a "/", the value must also end with a "/"',
      )
    }

    this._imports.set(specifier, path)
  }

  /**
   * Add a new scope to the map, mutating the current instance.
   *
   * If the scope already exists, the imports will be merged.
   *
   * If an import already exists, the value will be overwritten.
   *
   * @param scope The scope specifier.
   * @param scoped The scoped imports.
   */
  addScope(scope: string, scoped: Imports): void {
    if (!URL.canParse(scope)) {
      throw new Error(`Invalid scope specifier. At scope: ${scope}`)
    }

    if (!isStringRecord(scoped)) {
      throw new Error(`Invalid scoped imports. At scope: ${scope}`)
    }

    for (const [k, v] of Object.entries(scoped)) {
      if (!isValidImportSpecifier(k)) {
        throw new Error(
          `Invalid import specifier in scope ${scope}. At import key: ${k}`,
        )
      }

      if (!isValidImportValue(v)) {
        throw new Error(
          `Invalid import value in scope ${scope}. At import key: ${k}`,
        )
      }

      if (!isValidImport(k, v)) {
        throw new Error(
          `Invalid import in scopes. If a specifier ends with a "/", the value must also end with a "/". At scope: ${scope}`,
        )
      }
    }

    const current = this._scopes.get(scope)

    if (current) {
      for (const [k, v] of Object.entries(scoped)) {
        current.set(k, v)
      }

      this._scopes.set(scope, current)
      return
    }

    this._scopes.set(scope, new Map(Object.entries(scoped)))
  }

  /**
   * Resolve the import map with a base URL.
   *
   * @param base The base URL to resolve the relative imports.
   * @returns A new resolved ImportMap instance.
   */
  resolveWith(base: string): void {
    const imports: Imports = Object.fromEntries(
      Array.from(this._imports).map(([k, v]) => [
        resolveUrlLike(k, base),
        resolveUrlLike(v, base),
      ]),
    )

    const scopes: Scopes = Object.fromEntries(
      Array.from(this._scopes).map(([a, scoped]) => {
        if (!URL.canParse(a, base)) {
          throw new Error('Invalid scope. At scope: ' + a)
        }

        const imports = Object.fromEntries(
          Array.from(scoped).map(([k, v]) => [
            resolveUrlLike(k, base),
            resolveUrlLike(v, base),
          ]),
        )

        return [a, sortRecord(imports)]
      }),
    )

    const sortedImports = sortRecord(imports)
    const sortedScopes = sortRecord(scopes)

    this._imports.clear()
    this._scopes.clear()

    for (const [k, v] of Object.entries(sortedImports)) {
      this._imports.set(k, v)
    }

    for (const [k, v] of Object.entries(sortedScopes)) {
      this._scopes.set(k, new Map(Object.entries(v)))
    }
  }

  /**
   * For each import that does not end with a slash and is a jsr or npm import,
   * add a new import with the same key but with a trailing slash.
   *
   * @returns A new ImportMap instance with all the imports expanded.
   */
  expand() {
    const result: [string, string][] = []

    for (const [k, v] of Array.from(this._imports)) {
      result.push([k, v])

      if (
        !k.endsWith('/') &&
        !this._imports.has(k + '/') &&
        (v.startsWith('jsr:') || v.startsWith('npm:'))
      ) {
        const newKey = k + '/'
        /**
         * @todo Check wtf is going on here.
         */
        const newValue = v.slice(0, 4) + '/' + v.slice(v[4] === '/' ? 5 : 4) +
          '/'

        result.push([newKey, newValue])
      }
    }

    const expanded = Object.fromEntries(result)

    this._imports.clear()

    for (const [k, v] of Object.entries(expanded)) {
      this._imports.set(k, v)
    }

    return this
  }

  /**
   * Use the import map to resolve the given specifier.
   *
   * @param specifier The specifier to resolve.
   * @param referrer The referrer URL of the import.
   * @returns The value of the import in the import map.
   */
  resolveModule(specifier: string, referrer: string): string {
    if (this.isEmpty) return new URL(specifier, referrer).href

    const resolved = resolveUrlLike(specifier, referrer)

    const resolvedImport = this.findImportValue(resolved, this._imports)

    if (resolvedImport) return resolvedImport

    /**
     * Check in the scopes
     */
    for (const [scope, scopedImports] of Array.from(this._scopes)) {
      if (
        scope === referrer ||
        (scope.endsWith('/') && referrer.startsWith(scope))
      ) {
        const resolvedImport = this.findImportValue(resolved, scopedImports)

        if (resolvedImport) return resolvedImport
      }
    }

    return resolved
  }

  private findImportValue(
    specifier: string,
    imports: Map<string, string>,
  ): string | undefined {
    let resolvedImport: string | undefined = undefined

    for (const [k, v] of Array.from(imports)) {
      if (specifier === k) {
        resolvedImport = v
      }

      /**
       * Check if key ends with a slash and the specifier starts with the key.
       *
       * This would mean that all sub-paths of the key should be resolved to the value.
       */
      if (k.endsWith('/') && specifier.startsWith(k)) {
        const submodule = specifier.slice(k.length)

        if (!URL.canParse(submodule, v)) {
          throw new Error('Invalid remap URL. At key: ' + k)
        }

        const url = new URL(submodule, v)

        if (!url.href.startsWith(v)) {
          throw new Error(
            'Invalid remap URL, resolution probably backtracking above its specifier. At key: ' +
              k,
          )
        }

        resolvedImport = url.href
      }
    }

    return resolvedImport
  }

  /**
   * Check whether the given scope exists in the map.
   *
   * @param scope The scope key to check.
   */
  hasScope(scope: string): boolean {
    return this._scopes.has(scope)
  }

  get isEmpty() {
    return this._imports.size === 0 && this._scopes.size === 0
  }

  get hasEmptyImports() {
    return this._imports.size === 0
  }

  get imports(): Imports {
    return Object.fromEntries(this._imports)
  }

  get scopes(): Scopes {
    return Object.fromEntries(
      Array.from(this._scopes).map(([a, b]) => [a, Object.fromEntries(b)]),
    )
  }

  /**
   * Check if the given object has the shape of a valid import map.
   * @param map The object to check.
   * @returns A boolean indicating if the object is a valid import map.
   */
  static isValidMapRecord(map: unknown): map is {
    imports: Imports
    scopes?: Scopes
  } {
    if (!isRecord(map)) {
      return false
    }

    if (!('imports' in map) || !isStringRecord(map.imports)) {
      return false
    }

    if ('scopes' in map && map.scopes != null && !isRecord(map.scopes)) {
      return false
    }

    return true
  }
}

function isValidImportSpecifier(specifier: string): boolean {
  return specifier.length > 0
}

function isValidImportValue(value: string): boolean {
  return value.length > 0
}

function isValidImport(specifier: string, value: string): boolean {
  return !(specifier.endsWith('/') && !value.endsWith('/'))
}

function sortRecord<T extends { [K: string]: unknown }>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  ) as T
}

// const specialSchemes = ['ftp', 'file', 'http', 'https', 'ws', 'wss']

/* https://url.spec.whatwg.org/#is-special */
// function isSpecial(url: string): boolean {
//   return specialSchemes.some((s) => url.startsWith(s))
// }
