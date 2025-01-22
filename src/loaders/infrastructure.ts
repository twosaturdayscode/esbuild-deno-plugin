import type { ModuleEntry } from '../concepts/deno.ts'

export class ModulesCache {
  readonly modules = new Map<string, ModuleEntry>()
  readonly redirects = new Map<string, string>()

  registerModules(modules: ModuleEntry[]) {
    for (const module of modules) {
      this.modules.set(module.specifier, module)
    }
  }

  registerRedirects(redirects: Record<string, string>) {
    for (const [from, to] of Object.entries(redirects)) {
      this.redirects.set(from, to)
    }
  }

  findRedirect(specifier: string): string | undefined {
    return this.redirects.get(specifier)
  }

  findModule(specifier: string): ModuleEntry | undefined {
    return this.modules.get(specifier)
  }
}
