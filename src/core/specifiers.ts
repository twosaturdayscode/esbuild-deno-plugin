export class JSRSpecifier {
  readonly name: string = ''
  readonly path: string = ''
  readonly version: string | null = null

  constructor(pln: Partial<JSRSpecifier>) {
    Object.assign(this, pln)
  }

  static fromURL(url: URL): JSRSpecifier {
    if (url.protocol !== 'jsr:') throw new Error('Invalid jsr specifier')

    const path = url.pathname
    const startIndex = path[0] === '/' ? 1 : 0

    if (path[startIndex] !== '@') {
      throw new Error(`Invalid jsr specifier: ${url}`)
    }

    const firstSlash = path.indexOf('/', startIndex)

    if (firstSlash === -1) {
      throw new Error(`Invalid jsr specifier: ${url}`)
    }

    let pathStartIndex = path.indexOf('/', firstSlash + 1)
    let versionStartIndex = path.indexOf('@', firstSlash + 1)

    if (pathStartIndex === -1) pathStartIndex = path.length

    if (versionStartIndex === -1) versionStartIndex = path.length

    if (versionStartIndex > pathStartIndex) {
      versionStartIndex = pathStartIndex
    }

    if (startIndex === versionStartIndex) {
      throw new Error(`Invalid jsr specifier: ${url}`)
    }

    const n = path.slice(startIndex, versionStartIndex)

    const v = versionStartIndex === pathStartIndex
      ? null
      : path.slice(versionStartIndex + 1, pathStartIndex)

    const p = pathStartIndex === path.length ? '' : path.slice(pathStartIndex)

    return new JSRSpecifier({ name: n, version: v, path: p })
  }

  static toId(s: JSRSpecifier): string {
    return `jsr:${s.name}${s.version ? `@${s.version}` : ''}`
  }
}

export class NPMSpecifier {
  readonly name: string = ''
  readonly path: string = ''
  readonly version: string | null = null

  static fromURL(url: URL): NPMSpecifier {
    if (url.protocol !== 'npm:') throw new Error('Invalid npm specifier')
    const path = url.pathname
    const startIndex = path[0] === '/' ? 1 : 0
    let pathStartIndex
    let versionStartIndex
    if (path[startIndex] === '@') {
      const firstSlash = path.indexOf('/', startIndex)
      if (firstSlash === -1) {
        throw new Error(`Invalid npm specifier: ${url}`)
      }
      pathStartIndex = path.indexOf('/', firstSlash + 1)
      versionStartIndex = path.indexOf('@', firstSlash + 1)
    } else {
      pathStartIndex = path.indexOf('/', startIndex)
      versionStartIndex = path.indexOf('@', startIndex)
    }

    if (pathStartIndex === -1) pathStartIndex = path.length
    if (versionStartIndex === -1) versionStartIndex = path.length

    if (versionStartIndex > pathStartIndex) {
      versionStartIndex = pathStartIndex
    }

    if (startIndex === versionStartIndex) {
      throw new Error(`Invalid npm specifier: ${url}`)
    }

    return new NPMSpecifier({
      name: path.slice(startIndex, versionStartIndex),
      version: versionStartIndex === pathStartIndex
        ? null
        : path.slice(versionStartIndex + 1, pathStartIndex),
      path: pathStartIndex === path.length ? '' : path.slice(pathStartIndex),
    })
  }

  constructor(pln: Partial<JSRSpecifier>) {
    Object.assign(this, pln)
  }
}
