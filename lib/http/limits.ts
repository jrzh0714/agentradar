export function parseBoundedPositiveInt(
  raw: string | null | undefined,
  { fallback, max }: { fallback: number; max: number },
): number {
  if (!raw || !/^\d+$/.test(raw)) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 1) return fallback
  return Math.min(value, max)
}
