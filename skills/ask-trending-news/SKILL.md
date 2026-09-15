---
name: ask-trending-news
description: Guide to trending-news-api (packages/trending-news-api), the React trending-news widget and its backend — getTrendingNews / getTrendingNewsForTopic, the useTrendingNews hook, the TrendingNews component with compact and expandable modes, the 10-minute localStorage cache, the trending-news-api/server handler, and the worker that joins Wikipedia daily pageviews to The News API. Use when embedding or restyling the trending widget, when the homepage widget renders empty, when it throws about a missing apiEndpoint, when topics look like navigation pages, or when deploying and configuring the worker or the app's own /api/news/trending route.
---

# Working With trending-news-api

`packages/trending-news-api`, published as **trending-news-api**. Two halves: a React
widget, and `src/server/index.ts`, which produces the data by taking Wikipedia's daily
most-viewed articles as the trending topics and fetching news for each from
[The News API](https://thenewsapi.com). That handler runs either as the bundled
Cloudflare Worker (`worker/index.ts`) or inside a host app's own API route.

The widget needs an `apiEndpoint`; there is no bundled fallback data. Inside this
monorepo it already has one: qwksearch-web serves the handler at
**`/api/news/trending`** (`app/api/news/trending/route.ts` → `lib/news/trending.ts`,
KV-cached for 10 minutes), and `researchAgentUIConfig.trendingNewsApiUrl` points the
homepage widget there, so the only setup is the `THENEWSAPI_API_KEY` env var. The
`trendingNewsApiUrl` **setting** overrides that per user, for reading from a
separately deployed worker instead.

## Setup

Serving it from the app (what qwksearch-web does) — set `THENEWSAPI_API_KEY` in
`.env`, or as a Worker secret in production:

```bash
cd apps/qwksearch-web
bunx wrangler secret put THENEWSAPI_API_KEY
```

Or deploy the standalone worker and paste its URL into the *Trending News API URL*
setting:

```bash
cd packages/trending-news-api
bun run worker:deploy                      # then set the secret:
bunx wrangler secret put THENEWSAPI_API_KEY --config worker/wrangler.jsonc
```

```tsx
import { TrendingNews, useTrendingNews } from "trending-news-api";

<TrendingNews apiEndpoint="https://trending-news-api.you.workers.dev"
              compact expandable maxTopics={8} showImages />

const { data, error, loading } = useTrendingNews({ apiEndpoint, limit: 25 });
```

## Picking the right call

| You want | Call |
| --- | --- |
| The ready-made widget | `<TrendingNews {...options} className style compact maxTopics expandable expandedMaxTopics showImages />` |
| The data in your own UI | `useTrendingNews(options)` → `{ data, error, loading }` |
| An imperative fetch | `getTrendingNews(options)` → `TrendingNewsData` |
| News for one topic | `getTrendingNewsForTopic(topic, options)` → `TrendingNewsTopicData` |
| Force a refetch | `clearTrendingNewsCache()` |
| To serve the data yourself | `handleTrendingNewsRequest(request, { apiKey })` from `trending-news-api/server` |
| One step of it | `getTrendingTopics`, `getTopicHeadlines`, `fetchWikipediaTopPages`, `searchNewsForTopic` (each takes an optional `fetchImpl`) |

`TrendingNewsOptions`: `apiEndpoint` (**required**; a full URL, or a path resolved
against the current page), `topic` (fetch one topic instead of the daily list), `limit`
(default 25 topics — sent to the server as `?limit=`, and the cap on what the client
keeps).

Shapes: `TrendingTopic { topic, wikiRank?, wikiViews?, newsCount, articles }`,
`NewsArticle { title, url?, source?, publishedAt?, imageUrl? }`. The worker speaks
snake_case (`wiki_rank`, `published_at`, `image_url`); the client maps it to camelCase,
so read the mapped shape, not the raw response.

## Recipes

**Caching.** Every fetch is cached in `localStorage` for **10 minutes**, keyed by the
full request URL (prefix `trending-news-cache:`). It degrades to no cache outside the
browser and swallows quota/parse errors. Use `clearTrendingNewsCache()` after changing
`apiEndpoint`.

**Widget layout.** `compact` renders a single topic row; adding `expandable` puts a
chevron on it that expands to the full topic-by-topic article list in place
(`expandedMaxTopics`, default 15). Outside `compact`, the full list always shows and
`expandable` is ignored. Defaults: `maxTopics` 8, `showImages` true.

**Two limits.** `limit` is how many topics the *client* asks for and keeps (default 25,
server cap 50); `maxTopics`/`expandedMaxTopics` are how many the *widget renders*. Each
topic costs the server one News API search, so don't ask for more than the widget shows
— the homepage asks for 15, matching `expandedMaxTopics`.

**Yesterday's data.** Wikipedia pageviews lag about a day, so the worker deliberately
requests **yesterday's** UTC date.

## Troubleshooting

| Symptom | Cause → fix |
| --- | --- |
| `trending-news-api: apiEndpoint is required` | The option is mandatory. The hook simply returns `loading: false` with no data instead of throwing. |
| `THENEWSAPI_API_KEY is not configured` (500) | Set the env var on whichever side serves the data — the app (`.env` / `wrangler secret put`) or the standalone worker. |
| The homepage widget is blank on a self-hosted instance | Same cause: no `THENEWSAPI_API_KEY`. `/api/news/trending` answers 500 and the widget hides itself rather than showing a broken card. |
| Stale trending data for up to 10 minutes after fixing the key | `/api/news/trending` caches in KV for 10 minutes, but never caches an error — a failure clears as soon as the next request succeeds. |
| `Failed to fetch Wikipedia trends` (500) | The pageviews API was unreachable or has no data for that date. It usually resolves on the next day boundary. |
| Topics include "Main Page" or `Special:`/`Portal:` entries | The worker filters those with `NON_ARTICLE_TITLE`. Seeing them means an older deployment — redeploy. |
| Stale data after changing the endpoint | The 10-minute cache is keyed by URL. `clearTrendingNewsCache()`. |
| Nothing renders and no error | `data.topics` is empty — The News API returned nothing for those topics (quota, or a plan restriction). |
| The chevron does nothing | `expandable` only applies with `compact`. |
| SSR crashes on `localStorage` | The cache guards on `typeof window`; the component is client-side. Mark the host boundary `'use client'`. |
| CORS errors | The worker sets `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`; a proxy in front may be stripping them. |
| `bun run worker:dev` can't find the config | Worker commands need `--config worker/wrangler.jsonc`, which the `worker:*` scripts already pass — use them. |
