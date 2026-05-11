import { z } from 'zod'

export const HnHitSchema = z.object({
  objectID: z.string(),
  title: z.string(),
  url: z.string().url().nullable(),
  author: z.string().nullable(),
  points: z.number().nullable(),
  num_comments: z.number().nullable(),
  created_at: z.string(),
  story_text: z.string().nullable(),
})

export const HnSearchResponseSchema = z.object({
  hits: z.array(HnHitSchema),
  nbHits: z.number(),
})

export type HnHit = z.infer<typeof HnHitSchema>
export type HnSearchResponse = z.infer<typeof HnSearchResponseSchema>
