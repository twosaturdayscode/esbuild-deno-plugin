import { extname } from '@std/path'
import type { Loader } from './esbuild.ts'

export interface Imports {
  [url: string]: string
}

export interface Scopes {
  [url: string]: Imports
}

export type PlainImportMap = {
  imports: Imports
  scopes: Scopes
}

export async function isRunAllowed() {
  return await Deno.permissions.query({ name: 'run' }).then((s) =>
    s.state === 'granted'
  )
}
export type MediaType =
  | 'JavaScript'
  | 'Mjs'
  | 'Cjs'
  | 'JSX'
  | 'TypeScript'
  | 'Mts'
  | 'Cts'
  | 'Dts'
  | 'Dmts'
  | 'Dcts'
  | 'TSX'
  | 'Json'
  | 'Wasm'
  | 'TsBuildInfo'
  | 'SourceMap'
  | 'Unknown'

export type ModuleEntry =
  | ModuleEntryError
  | ModuleEntryWithoutError

export type ModuleEntryWithoutError =
  | ModuleEntryEsm
  | ModuleEntryJson
  | ModuleEntryNpm
  | ModuleEntryNode

export interface ModuleEntryBase {
  specifier: string
  error?: never
}

export interface ModuleEntryError {
  specifier: string
  error: string
}

export interface ModuleEntryEsm extends ModuleEntryBase {
  kind: 'esm'
  local: string | null
  emit: string | null
  map: string | null
  mediaType: MediaType
  size: number
}

export interface ModuleEntryJson extends ModuleEntryBase {
  kind: 'asserted' | 'json'
  local: string | null
  mediaType: MediaType
  size: number
}

export interface ModuleEntryNpm extends ModuleEntryBase {
  kind: 'npm'
  npmPackage: string
}

export interface ModuleEntryNode extends ModuleEntryBase {
  kind: 'node'
  moduleName: string
}

export interface NpmPackage {
  name: string
  version: string
  dependencies: string[]
}

export interface Module {
  specifier: string
  mediaType: MediaType
  data: Uint8Array
}

export function mapContentType(
  specifier: URL,
  contentType: string | null,
): MediaType {
  if (contentType !== null) {
    const contentTypes = contentType.split(';')
    const mediaType = contentTypes[0].toLowerCase()
    switch (mediaType) {
      case 'application/typescript':
      case 'text/typescript':
      case 'video/vnd.dlna.mpeg-tts':
      case 'video/mp2t':
      case 'application/x-typescript':
        return mapJsLikeExtension(specifier, 'TypeScript')
      case 'application/javascript':
      case 'text/javascript':
      case 'application/ecmascript':
      case 'text/ecmascript':
      case 'application/x-javascript':
      case 'application/node':
        return mapJsLikeExtension(specifier, 'JavaScript')
      case 'text/jsx':
        return 'JSX'
      case 'text/tsx':
        return 'TSX'
      case 'application/json':
      case 'text/json':
        return 'Json'
      case 'application/wasm':
        return 'Wasm'
      case 'text/plain':
      case 'application/octet-stream':
        return mediaTypeFromSpecifier(specifier)
      default:
        return 'Unknown'
    }
  } else {
    return mediaTypeFromSpecifier(specifier)
  }
}

function mapJsLikeExtension(
  specifier: URL,
  defaultType: MediaType,
): MediaType {
  const path = specifier.pathname
  switch (extname(path)) {
    case '.jsx':
      return 'JSX'
    case '.mjs':
      return 'Mjs'
    case '.cjs':
      return 'Cjs'
    case '.tsx':
      return 'TSX'
    case '.ts':
      if (path.endsWith('.d.ts')) {
        return 'Dts'
      } else {
        return defaultType
      }
    case '.mts': {
      if (path.endsWith('.d.mts')) {
        return 'Dmts'
      } else {
        return defaultType == 'JavaScript' ? 'Mjs' : 'Mts'
      }
    }
    case '.cts': {
      if (path.endsWith('.d.cts')) {
        return 'Dcts'
      } else {
        return defaultType == 'JavaScript' ? 'Cjs' : 'Cts'
      }
    }
    default:
      return defaultType
  }
}

function mediaTypeFromSpecifier(specifier: URL): MediaType {
  const path = specifier.pathname
  switch (extname(path)) {
    case '':
      if (path.endsWith('/.tsbuildinfo')) {
        return 'TsBuildInfo'
      } else {
        return 'Unknown'
      }
    case '.ts':
      if (path.endsWith('.d.ts')) {
        return 'Dts'
      } else {
        return 'TypeScript'
      }
    case '.mts':
      if (path.endsWith('.d.mts')) {
        return 'Dmts'
      } else {
        return 'Mts'
      }
    case '.cts':
      if (path.endsWith('.d.cts')) {
        return 'Dcts'
      } else {
        return 'Cts'
      }
    case '.tsx':
      return 'TSX'
    case '.js':
      return 'JavaScript'
    case '.jsx':
      return 'JSX'
    case '.mjs':
      return 'Mjs'
    case '.cjs':
      return 'Cjs'
    case '.json':
      return 'Json'
    case '.wasm':
      return 'Wasm'
    case '.tsbuildinfo':
      return 'TsBuildInfo'
    case '.map':
      return 'SourceMap'
    default:
      return 'Unknown'
  }
}

export function mediaTypeToLoader(mediaType: MediaType): Loader {
  switch (mediaType) {
    case 'JavaScript':
    case 'Mjs':
      return 'js'
    case 'JSX':
      return 'jsx'
    case 'TypeScript':
    case 'Mts':
      return 'ts'
    case 'TSX':
      return 'tsx'
    case 'Json':
      return 'json'
    default:
      throw new Error(`Unhandled media type ${mediaType}.`)
  }
}
