export function isUrlLike(v: string) {
  return v.startsWith('/') || v.startsWith('./') || v.startsWith('../')
}

/**
 * @question Is this the proper way to handle this?
 */
export function resolveUrlLike(specifier: string, base: string): string {
  if (isUrlLike(specifier)) {
    if (URL.canParse(specifier, base)) {
      return new URL(specifier, base).href
    }

    return specifier
  }

  if (URL.canParse(specifier)) {
    return new URL(specifier).href
  }

  return specifier
}
