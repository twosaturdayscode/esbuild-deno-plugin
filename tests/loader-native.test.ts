import * as esbuild from 'https://deno.land/x/esbuild@v0.23.0/mod.js'
import { assert, assertEquals, assertStringIncludes } from '@std/assert'

import { denoPlugins } from '../mod.ts'
import { join } from 'jsr:@std/path@0.213/join'
import { esbuildResolutionToURL } from '../src/concepts/esbuild/utils.ts'
import type { Plugin } from '../src/concepts/esbuild.ts'
import { denoResolver } from '../src/resolver.ts'
import { denoLoader } from '../src/loader.ts'

await esbuild.initialize({})

const BASE_OPTIONS = {
  write: false,
  format: 'esm',
  /**
   * @todo remove when https://github.com/evanw/esbuild/pull/2968 is fixed
   */
  absWorkingDir: Deno.cwd(),
} satisfies esbuild.BuildOptions

const LOADER_TYPE = 'native' as const

Deno.test('Remote (.ts)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['https://deno.land/std@0.185.0/collections/without_all.ts'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { withoutAll } = await import(dataURL)
  assertEquals(withoutAll([1, 2, 3], [2, 3, 4]), [1])
})

Deno.test('Local (.ts)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.ts'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Remote (.mts)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: [
      'https://gist.githubusercontent.com/lucacasonato/4ad57db57ee8d44e4ec08d6a912e93a7/raw/f33e698b4445a7243d72dbfe95afe2d004c7ffc6/mod.mts',
    ],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Local (.mts)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.mts'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Local (.js)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd')
})

Deno.test('Remote (.mjs)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: [
      'https://gist.githubusercontent.com/lucacasonato/4ad57db57ee8d44e4ec08d6a912e93a7/raw/f33e698b4445a7243d72dbfe95afe2d004c7ffc6/mod.mjs',
    ],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd')
})

Deno.test('Local (.mjs)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.mjs'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd')
})

/**
 * @note This is disabled because the entry point is not valid.
 */
Deno.test('Remote (.jsx)', { ignore: true }, async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['https://crux.land/GeaWJ'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const m = await import(dataURL)
  assertEquals(m.default, 'foo')
})

Deno.test('Local (.jsx)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.jsx'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const m = await import(dataURL)
  assertEquals(m.default, 'foo')
})

/**
 * @note This is disabled because the entry point is not a valid.
 */
Deno.test('Remote (.tsx)', { ignore: true }, async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['https://crux.land/2Qjyo7'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const m = await import(dataURL)
  assertEquals(m.default, 'foo')
})

Deno.test('Local (.tsx)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/mod.tsx'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const m = await import(dataURL)
  assertEquals(m.default, 'foo')
})

Deno.test('Bundle remote imports', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['https://deno.land/std@0.185.0/uuid/mod.ts'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { v1 } = await import(dataURL)
  assert(v1.validate(v1.generate()))
})

Deno.test('Local (.json)', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    entryPoints: ['tests/fixtures/data.json'],
    bundle: true,
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { default: data } = await import(dataURL)
  assertEquals(data, {
    hello: 'world',
    ['__proto__']: {
      sky: 'universe',
    },
  })
})

Deno.test('Remote HTTP redirects are de-duped', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    bundle: true,
    entryPoints: ['tests/fixtures/remote_redirects.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const matches = [...output.text.matchAll(/0\.178\.0/g)]
  assertEquals(matches.length, 2) // once in the comment, once in the code
})

const IMPORTMAP_URL =
  new URL('./fixtures/import_map.json', import.meta.url).href

Deno.test('Bundle explicit import map', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [
      ...denoPlugins({ importMapURL: IMPORTMAP_URL, loader: LOADER_TYPE }),
    ],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/mapped.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Bundle config inline import map', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'config_inline.jsonc')

  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ configPath, loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/mapped.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Bundle config ref import map', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'config_ref.json')
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ configPath, loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/mapped.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { bool } = await import(dataURL)
  assertEquals(bool, 'asd2')
})

Deno.test('Bundle config inline import map with expansion', async () => {
  const configPath = join(
    Deno.cwd(),
    'tests/fixtures',
    'config_inline_expansion.json',
  )

  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ configPath, loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/mapped_jsr.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const ns = await import(dataURL)
  assertEquals(ns.join('a', 'b'), join('a', 'b'))
})

const COMPUTED_PLUGIN: Plugin = {
  name: 'computed',
  setup(build) {
    build.onResolve({ filter: /.*/, namespace: 'computed' }, (args) => {
      return new Promise((res) =>
        res({ path: args.path, namespace: 'computed' })
      )
    })
    build.onLoad({ filter: /.*/, namespace: 'computed' }, (args) => {
      const url = esbuildResolutionToURL(args)
      return new Promise((res) =>
        res({ contents: `export default ${url.pathname};`, loader: 'js' })
      )
    })
  },
}

Deno.test('Custom plugin for scheme', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [
      denoResolver(),
      COMPUTED_PLUGIN,
      denoLoader({ loader: LOADER_TYPE }),
    ],
    entryPoints: ['computed:1+2'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { default: sum } = await import(dataURL)
  assertEquals(sum, 3)
})

Deno.test('Custom plugin for scheme with import map', async () => {
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [
      denoResolver({ importMapURL: IMPORTMAP_URL }),
      COMPUTED_PLUGIN,
      denoLoader({ importMapURL: IMPORTMAP_URL, loader: LOADER_TYPE }),
    ],
    bundle: true,
    entryPoints: ['tests/fixtures/mapped-computed.js'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { default: sum } = await import(dataURL)
  assertEquals(sum, 3)
})

Deno.test('Uncached data url', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'config_ref.json')
  const rand = Math.random()
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ configPath, loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: [
      `data:application/javascript;base64,${
        btoa(
          `export const value = ${rand};`,
        )
      }`,
    ],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { value } = await import(dataURL)
  assertEquals(value, rand)
})

Deno.test('Externals', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'config_ref.json')
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ configPath, loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/externals.ts'],
    external: ['foo:bar', 'foo:baz/*', 'bar'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertStringIncludes(output.text, 'foo:bar')
  assertStringIncludes(output.text, 'foo:baz/bar')
})

Deno.test('JSR - auto discovered lock file', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'jsr', 'deno.json')
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE, configPath })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['jsr:@std/path@^0.213'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertStringIncludes(
    output.text,
    'https://jsr.io/@std/path/0.213.1/mod.ts',
  )
  const ns = await import(
    `data:application/javascript;base64,${btoa(output.text)}`
  )
  assertEquals(ns.join('a', 'b'), join('a', 'b'))
})

Deno.test('JSR - lock file referenced in deno.json', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'jsr_deno.json')
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE, configPath })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['jsr:@std/path@^0.213'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertStringIncludes(
    output.text,
    'https://jsr.io/@std/path/0.213.1/mod.ts',
  )
  const ns = await import(
    `data:application/javascript;base64,${btoa(output.text)}`
  )
  assertEquals(ns.join('a', 'b'), join('a', 'b'))
})

Deno.test('JSR - no lockfile', async () => {
  const tmp = Deno.makeTempDirSync()
  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['jsr:@std/path@0.213.1'],
    absWorkingDir: tmp,
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]
  assertStringIncludes(
    output.text,
    'https://jsr.io/@std/path/0.213.1/mod.ts',
  )
  const ns = await import(
    `data:application/javascript;base64,${btoa(output.text)}`
  )
  assertEquals(ns.join('a', 'b'), join('a', 'b'))
})

Deno.test('Vendoring', async () => {
  const configPath = join(Deno.cwd(), 'tests/fixtures', 'vendoring.json')

  const b = await esbuild.build({
    ...BASE_OPTIONS,
    plugins: [...denoPlugins({ loader: LOADER_TYPE, configPath })],
    bundle: true,
    platform: 'neutral',
    entryPoints: ['tests/fixtures/uncached.ts'],
  })

  assertEquals(b.warnings, [])
  assertEquals(b.errors, [])
  assertEquals(b.outputFiles.length, 1)

  const output = b.outputFiles[0]

  assertEquals(output.path, '<stdout>')
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`
  const { sorted } = await import(dataURL)
  assertEquals(sorted, -1)
})
