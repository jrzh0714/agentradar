import { z } from 'zod'

/** Public links must be ordinary HTTP(S) URLs without embedded credentials. */
export const HttpUrlSchema = z.string().url().refine((value) => {
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}, 'Expected an HTTP(S) URL without embedded credentials')
