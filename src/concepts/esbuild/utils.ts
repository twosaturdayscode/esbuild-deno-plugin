import { fromFileUrl, SEPARATOR, toFileUrl } from '@std/path'

import type { EsbuildResolution, OnResolveArgs } from '../esbuild.ts'

const SLASH_NODE_MODULES_SLASH = `${SEPARATOR}node_modules${SEPARATOR}`
const SLASH_NODE_MODULES = `${SEPARATOR}node_modules`

/**
 * A simple utility to check if a given specifier is external, given a list of
 * esbuild external specifiers.
 */
export class Externals {
  static fromOptions(list: string[]): Externals {
    const regexps = list.map((external) => {
      const regexp = new RegExp(
        '^' +
          external
            .replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
            .replace(/\*/g, '.*') +
          '$',
      )
      return regexp
    })

    return new Externals(regexps)
  }

  constructor(private readonly regexps: RegExp[]) {}

  has(specifier: string): boolean {
    return this.regexps.some((regexp) => regexp.test(specifier))
  }
}

/**
 * Check if the given path is inside a node_modules directory.
 */
export function isInNodeModules(path: string): boolean {
  return path.includes(SLASH_NODE_MODULES_SLASH) ||
    path.endsWith(SLASH_NODE_MODULES)
}

/**
 * Check if the given resolution is a node_modules resolution.
 */
export function isNodeModulesResolution(args: OnResolveArgs) {
  return (
    (args.namespace === '' || args.namespace === 'file') &&
    (isInNodeModules(args.resolveDir) || isInNodeModules(args.path) ||
      isInNodeModules(args.importer))
  )
}

export function urlToEsbuildResolution(url: URL): EsbuildResolution {
  if (url.protocol === 'file:') {
    return { path: fromFileUrl(url), namespace: 'file' }
  }

  const namespace = url.protocol.slice(0, -1)
  const path = url.href.slice(namespace.length + 1)
  return { path, namespace }
}

export function esbuildResolutionToURL(res: EsbuildResolution): URL {
  if (res.namespace === 'file') {
    return toFileUrl(res.path)
  }

  return new URL(`${res.namespace}:${res.path}`)
}
