interface Lockfile {
  version: string
  packages?: { specifiers?: Record<string, string> }
}

export class DenoLockfile {
  static async fromAbsolute(path: string): Promise<Lockfile> {
    const lockfile: Lockfile = await Deno.readTextFile(path).then(JSON.parse)
      .catch(
        (err) => {
          if (err instanceof Deno.errors.NotFound) {
            throw new Error(
              `A Lockfile path has been provided but could not found it at: ${path}`,
            )
          }

          throw err
        },
      )

    return lockfile
  }
}
