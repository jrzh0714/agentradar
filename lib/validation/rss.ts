import { z } from 'zod'

export const RssItemSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  contentSnippet: z.string().optional(),
  content: z.string().optional(),
  isoDate: z.string().optional(),
  pubDate: z.string().optional(),
  creator: z.string().optional(),
  guid: z.string().optional(),
})

export const RssFeedSchema = z.object({
  title: z.string().optional(),
  items: z.array(RssItemSchema),
})

export type RssItem = z.infer<typeof RssItemSchema>
export type RssFeedData = z.infer<typeof RssFeedSchema>
