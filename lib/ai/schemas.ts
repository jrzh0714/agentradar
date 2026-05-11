import { z } from 'zod'

export const EnrichmentSchema = z.object({
  ai_summary:          z.string().min(20).max(400),
  ai_why_it_matters:   z.string().min(20).max(400),
  ai_category:         z.string().max(50),
  ai_tags:             z.array(z.string().max(30)).min(1).max(5),
  ai_audience:         z.array(z.string().max(30)).min(1).max(4),
  ai_maturity:         z.enum(['experimental', 'beta', 'production-ready']),
  ai_relevance_score:  z.number().min(0).max(1),
})

export type Enrichment = z.infer<typeof EnrichmentSchema>

export const DigestOutputSchema = z.object({
  title:   z.string().min(5).max(100),
  summary: z.string().min(50).max(800),
})

export type DigestOutput = z.infer<typeof DigestOutputSchema>
