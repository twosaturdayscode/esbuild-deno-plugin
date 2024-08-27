import { existsSync } from '@std/fs'
import * as JSONC from '@std/jsonc'

import { isRecord } from '../../validations/is-any-record.ts'

import type { Imports, Scopes } from '../../concepts/deno.ts'

interface DenoConfigs {
  imports?: Imports
  scopes?: Scopes
  importMap?: string
  workspace?: string[]
  lock?: boolean | string
}

type WorkspaceMemberConfig = {
  name?: string
  exports?: string
  version?: string
  imports?: Imports
  importMap?: string
}

export class DenoConfig {
  static fromAbsolute(path: string) {
    const c = Deno.readTextFileSync(path)

    const parsed = JSONC.parse(c)

    if (!isRecord(parsed)) {
      throw new Error('Invalid Deno config')
    }

    return parsed as DenoConfigs
  }

  static ofWorkspaceMember(path: string): WorkspaceMemberConfig {
    const confPath = DenoConfig.find(path)
    const c = Deno.readTextFileSync(confPath)

    const parsed = JSONC.parse(c)

    if (!isRecord(parsed)) {
      throw new Error(`Invalid Deno config. At: ${path}`)
    }

    const result: WorkspaceMemberConfig = {}

    if (typeof parsed.name === 'string') {
      result['name'] = parsed.name
    }

    if (typeof parsed.version === 'string') {
      result['version'] = parsed.version
    }

    if (typeof parsed.exports === 'string') {
      result['exports'] = parsed.exports
    }

    if (isRecord(parsed.exports)) {
      const exports = parsed.exports['.'] as string

      result['exports'] = exports
    }

    if (isRecord(parsed.imports)) {
      result['imports'] = parsed.imports as Imports
    }

    if (typeof parsed.importMap === 'string') {
      result['importMap'] = parsed.importMap
    }

    return result
  }

  static find(path: string): string {
    const json = path + '/deno.json'
    const jsonc = path + '/deno.jsonc'

    if (existsSync(json)) {
      return json
    }

    if (existsSync(jsonc)) {
      return jsonc
    }

    throw new Error(`Could not find a Deno config file at: ${path}`)
  }
}
