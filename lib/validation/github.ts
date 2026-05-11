import { z } from 'zod'

export const GithubRepoSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  stargazers_count: z.number(),
  language: z.string().nullable(),
  topics: z.array(z.string()).default([]),
  owner: z.object({
    login: z.string(),
  }),
  pushed_at: z.string().nullable(),
  created_at: z.string().nullable(),
})

export const GithubSearchResponseSchema = z.object({
  total_count: z.number(),
  items: z.array(GithubRepoSchema),
})

export type GithubRepo = z.infer<typeof GithubRepoSchema>
export type GithubSearchResponse = z.infer<typeof GithubSearchResponseSchema>
