import { z } from 'zod'

export const GithubRepoSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  stargazers_count: z.number(),
  forks_count: z.number().default(0),
  language: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  owner: z.object({
    login: z.string(),
  }),
  pushed_at: z.string().nullable(),
  created_at: z.string().nullable(),

  // Quality / status flags — used for ingestion filtering.
  // `fork:false` in the search query already excludes most forks, but the
  // defensive check in lib/ingestion/github.ts is the last line of defence.
  fork:     z.boolean().default(false),
  archived: z.boolean().default(false),
  disabled: z.boolean().default(false),
})

export const GithubSearchResponseSchema = z.object({
  total_count: z.number(),
  items: z.array(GithubRepoSchema),
})

export type GithubRepo = z.infer<typeof GithubRepoSchema>
export type GithubSearchResponse = z.infer<typeof GithubSearchResponseSchema>
