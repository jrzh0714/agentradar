import { z } from 'zod'

export const EnrichmentSchema = z.object({
  tldr: z.string().min(20).max(280),
  tags: z.array(z.string().max(30)).min(1).max(5),
  relevance_score: z.number().min(0).max(1),
})

export type Enrichment = z.infer<typeof EnrichmentSchema>

export const DigestOutputSchema = z.object({
  title: z.string().min(5).max(100),
  intro: z.string().min(50).max(600),
})

export type DigestOutput = z.infer<typeof DigestOutputSchema>
