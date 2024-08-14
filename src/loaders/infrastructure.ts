import { config } from '../concepts/configs.ts'
import {
  mapContentType,
  type Module,
  type ModuleEntry,
} from '../concepts/deno.ts'

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

/**
 * Used for portable loader.
 */
export class RemoteModules {
  readonly modules = new Map<string, Module>()
  readonly redirects = new Map<string, string>()
  readonly fetches = new Map<string, Promise<void>>()

  private registerRedirect(specifier: string, location: string) {
    this.redirects.set(specifier, location)
  }

  registerModule(mod: Module) {
    this.modules.set(mod.specifier, mod)
  }

  async findModule(specifier: string): Promise<Module> {
    if (this.redirects.has(specifier)) {
      const redirected = this.modules.get(this.redirects.get(specifier)!)

      if (redirected) {
        return redirected
      }
    }

    const module = this.modules.get(specifier)

    if (!module) {
      const fetched = await this.fetchModule(specifier)
      this.registerModule(fetched)
      return fetched
    }

    return module
  }

  async fetchModule(specifier: string): Promise<Module> {
    const res = await this.fetch(specifier)

    if (res.status >= 300) {
      for (let i = 0; i < config().MAX_REDIRECTS; i++) {
        await res.body?.cancel()

        const location = res.headers.get('location')

        if (!location) {
          throw new Error(
            `Redirected without location header while fetching ${specifier}.`,
          )
        }

        const url = new URL(location, specifier)

        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          throw new Error(
            `Redirected to unsupported protocol '${url.protocol}' while fetching ${specifier}.`,
          )
        }

        this.registerRedirect(specifier, url.href)

        return this.fetchModule(url.href)
      }

      throw new Error('Too many redirects. Last one: ' + specifier)
    }

    const contentType = res.headers.get('content-type')
    const mediaType = mapContentType(new URL(specifier), contentType)

    const data = new Uint8Array(await res.arrayBuffer())

    return { specifier, mediaType, data }
  }

  private async fetch(url: string): Promise<Response> {
    const rspn = await fetch(url, {
      redirect: 'manual',
    })

    if (rspn.status < 200 || rspn.status >= 400) {
      throw new Error(
        `Encountered status code ${rspn.status} while fetching ${url}.`,
      )
    }

    return rspn
  }
}
