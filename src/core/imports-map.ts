import { isStringRecord } from '../validations/is-string-record.ts'
import { isRecord } from '../validations/is-any-record.ts'
import type { Imports, Scopes } from '../concepts/deno.ts'
import { isUrlLike, resolveUrlLike } from './urls-like.ts'

export class ImportMap {
  private imports: Imports
  private scopes: Scopes

  static empty() {
    return new ImportMap({})
  }

  private constructor(_imports: Imports, _scopes: Scopes = {}) {
    this.imports = _imports
    this.scopes = _scopes
  }

  /**
   * Given a record containing imports and scopes, create a new ImportMap.
   */
  loadRaw(pln: Record<string, unknown>) {
    if (!isValidMapShape(pln)) {
      throw new Error('Invalid import map shape')
    }

    Object.entries(pln.imports).forEach(([k, v]) => {
      if (!isValidImportSpecifier(k)) {
        throw new Error('Invalid import specifier. At key: ' + k)
      }

      if (!isValidImportValue(v)) {
        throw new Error('Invalid import value. At key: ' + k)
      }
    })

    this.imports = pln.imports
    this.scopes = pln.scopes ?? {}

    return this
  }

  addImport(specifier: string, path: string) {
    if (!isValidImportSpecifier(specifier)) {
      throw new Error('Invalid import specifier. At key: ' + specifier)
    }

    if (!isValidImportValue(path)) {
      throw new Error('Invalid import value. At key: ' + specifier)
    }

    this.imports[specifier] = path
  }

  private constructor(_imports: Imports, _scopes: Scopes = {}) {
    this.imports = _imports
    this.scopes = _scopes
  }

  resolveWith(base: string): void {
    const resolvedImports: Imports = ImportMap.resolveImports(
      this.imports,
      base,
    )

    if (!hasValidRemaps(resolvedImports)) {
      throw new Error(
        'Invalid remaps. If a specifier ends with a "/", the value must also end with a "/"',
      )
    }

    const resolvedScopes: Scopes = Object.fromEntries(
      Object.entries(this.scopes).map(([a, imp]) => {
        if (!isStringRecord(imp)) {
          throw new Error('Invalid import shape. At scope: ' + a)
        }

        if (!URL.canParse(a, base)) {
          throw new Error('Invalid scope. At scope: ' + a)
        }

        const imports = this.sortRecord(ImportMap.resolveImports(imp, base))

        if (!hasValidRemaps(imports)) {
          throw new Error(
            'Invalid remaps in scopes. If a specifier ends with a "/", the value must also end with a "/". At scope: ' +
              a,
          )
        }

        return [a, imports]
      }),
    )

    const sortedImports = this.sortRecord(resolvedImports)
    const sortedScopes = this.sortRecord(resolvedScopes)

    this.imports = sortedImports
    this.scopes = sortedScopes
  }

  resolveModule(specifier: string, base: string): string {
    if (this.isEmpty) {
      return new URL(specifier, base).href
    }

    const resolvedSpecifier = resolveUrlLike(specifier, base)

    /**
     * Check in the scopes
     */
    for (const [scope, scopedImports] of Object.entries(this.scopes)) {
      if (scope === base || (scope.endsWith('/') && base.startsWith(scope))) {
        const resolvedImport = resolveImportsMatch(
          resolvedSpecifier,
          scopedImports,
        )

        if (resolvedImport) {
          return resolvedImport
        }
      }
    }

    const resolvedImport = resolveImportsMatch(resolvedSpecifier, this.imports)

    if (resolvedImport) {
      return resolvedImport
    }

    return resolvedSpecifier
  }

  expand() {
    const result: [string, string][] = []

    for (const [k, v] of Object.entries(this.imports)) {
      result.push([k, v])

      if (
        !k.endsWith('/') &&
        !this.imports[k + '/'] &&
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

    this.imports = Object.fromEntries(result)
    return this
  }

  get isEmpty() {
    return Object.keys(this.imports).length === 0
  }

  /**
   * Resolve relative imports in the given import map imports.
   */
  static resolveImports(imports: Imports, base: string): Imports {
    return Object.fromEntries(
      Object.entries(imports)
        .map(([k, v]) => {
          if (URL.canParse(k) || isUrlLike(k)) {
            return [resolveUrlLike(k, base), v]
          }

          return [k, v]
        })
        .map(([k, v]) => {
          if (URL.canParse(v) || isUrlLike(v)) {
            return [k, resolveUrlLike(v, base)]
          }

          throw new Error('Invalid import value. At key: ' + k)
        }),
    )
  }

  private sortRecord<T extends { [K: string]: unknown }>(record: T): T {
    return Object.fromEntries(
      Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
    ) as T
  }
}

/**
 * Check if the given object is a valid import map.
 */
function isValidMapShape(map: unknown): map is {
  imports: Imports
  scopes?: Scopes
} {
  if (!isRecord(map)) {
    return false
  }

  if (!('imports' in map) && !isStringRecord(map.imports)) {
    return false
  }

  if ('scopes' in map && map.scopes != null && !isRecord(map.scopes)) {
    return false
  }

  return true
}

function isValidImportSpecifier(specifier: string): boolean {
  return specifier.length > 0
}

function isValidImportValue(value: string): boolean {
  return value.length > 0
}

/**
 * Check if every key that ends with a "/" has a value that also ends with a "/".
 */
function hasValidRemaps(imports: Imports): boolean {
  return Object.entries(imports).every(([k, v]) => {
    if (k.endsWith('/')) {
      return v.endsWith('/')
    }

    return true
  })
}

export function resolveImportsMatch(
  specifier: string,
  imports: Imports,
): string | null {
  let resolvedImport: string | null = null

  for (const [k, v] of Object.entries(imports)) {
    if (specifier === k) {
      resolvedImport = v
    }

    if (
      k.endsWith('/') &&
      specifier.startsWith(k) &&
      (isSpecial(specifier) || specifier.startsWith('@'))
    ) {
      if (!v.endsWith('/')) {
        throw new Error("Invalid remap URL. Must end with '/'. At key: " + k)
      }

      /**
       * This do:
       *   specifier: @std/path/join
       *   k: @std/path/
       *   afterPrefix: join
       *
       * @todo find a better name.
       */
      const afterPrefix = specifier.slice(k.length)

      if (!URL.canParse(afterPrefix, v)) {
        throw new Error('Invalid remap URL. At key: ' + k)
      }

      const url = new URL(afterPrefix, v)

      if (!url.href.startsWith(v)) {
        throw new Error(
          'Invalid remap URL, resolution backtracking above its specifier. At key: ' +
            k,
        )
      }

      resolvedImport = url.href
    }
  }

  return resolvedImport
}

const specialSchemes = ['ftp', 'file', 'http', 'https', 'ws', 'wss']

/* https://url.spec.whatwg.org/#is-special */
function isSpecial(url: string): boolean {
  return specialSchemes.some((s) => url.startsWith(s))
}
