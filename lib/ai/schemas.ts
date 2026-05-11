import { z } from 'zod'

export const CATEGORIES = [
  'AI Agents',
  'Code Agents',
  'RAG',
  'LLM Frameworks',
  'MCP / Tool Use',
  'Developer Tools',
  'AI Infrastructure',
  'Open Source Models',
  'Prompt Engineering',
  'Workflow Automation',
  'Research',
  'Product Updates',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const MATURITY_VALUES = ['experimental', 'promising', 'production-ready', 'unknown'] as const
export type Maturity = (typeof MATURITY_VALUES)[number]

/**
 * Schema for the raw JSON the AI returns.
 * Field names are non-prefixed (summary, not ai_summary).
 * relevance_score is 1–10; divide by 10 before writing to DB.
 */
export const EnrichmentSchema = z.object({
  summary:         z.string().min(20).max(400),
  why_it_matters:  z.string().min(20).max(400),
  category:        z.enum(CATEGORIES),
  tags:            z.array(z.string().max(50)).min(3).max(6),
  audience:        z.array(z.string().max(50)).min(1).max(3),
  maturity:        z.enum(MATURITY_VALUES),
  relevance_score: z.number().min(1).max(10),
})

export type Enrichment = z.infer<typeof EnrichmentSchema>

export const DigestOutputSchema = z.object({
  title:   z.string().min(5).max(100),
  summary: z.string().min(50).max(800),
})

export type DigestOutput = z.infer<typeof DigestOutputSchema>
