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

    const name = parsed.name as string | undefined

    if (typeof parsed.exports === 'string') {
      return { name, exports: parsed.exports }
    }

    if (isRecord(parsed.exports)) {
      const exports = parsed.exports['.'] as string

      return { name, exports }
    }

    return { name, exports: undefined }
  }

  static find(path: string): string {
    const json = new URL(path + '/deno.json')
    const jsonc = new URL(path + '/deno.jsonc')

    if (existsSync(json)) {
      return json.pathname
    }

    if (existsSync(jsonc)) {
      return jsonc.pathname
    }

    throw new Error(`Could not find a Deno config file at: ${path}`)
  }
}
