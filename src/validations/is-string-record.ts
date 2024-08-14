export const isStringRecord = (
  value: unknown,
): value is Record<string, string> => {
  return typeof value === 'object' && value !== null &&
    Object.values(value).every((v) => typeof v === 'string')
}
