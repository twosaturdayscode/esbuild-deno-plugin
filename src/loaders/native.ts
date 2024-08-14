import type { ModuleEntry } from '../concepts/deno.ts'
import { NPMSpecifier } from '../core/specifiers.ts'

export class NativeResolver {
  static resolveEntry(entry: ModuleEntry) {
    if ('error' in entry) throw new Error(entry.error)

    if (entry.kind === 'npm') {
      const parsed = NPMSpecifier.fromURL(new URL(entry.specifier))

      return {
        kind: 'npm',
        packageId: entry.npmPackage,
        packageName: parsed.name,
        path: parsed.path ?? '',
      } as const
    }

    if (entry.kind === 'node') {
      return {
        kind: 'node',
        path: entry.specifier,
      } as const
    }

    return { kind: 'esm', specifier: new URL(entry.specifier) } as const
  }
}
