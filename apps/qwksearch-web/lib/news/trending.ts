/**
 * @fileoverview Serves the homepage trending-news widget from this app, so a
 * deployment only needs a `THENEWSAPI_API_KEY` — not a separately deployed
 * copy of `packages/trending-news-api/worker`.
 *
 * The widget's data is the same for everyone (Wikipedia's daily ranking joined
 * to headlines), and each cold answer costs one Wikipedia call plus one News
 * API search per topic, so it is cached in KV for ten minutes. The browser
 * caches the same response in `localStorage` for ten minutes too; this cache
 * is what keeps the *first* visit of the next ten minutes cheap.
 */
import { handleTrendingNewsRequest, parseTopicLimit } from "trending-news-api/server";
import { getCloudflareContext } from "../cloudflare/context";

const CACHE_PREFIX = "trending-news:v1:";
const CACHE_TTL_SECONDS = 600;

/**
 * The News API token. Worker secrets are only on the Cloudflare env; local dev
 * and the Node server read it from `process.env`.
 */
export function getNewsApiKey(): string | undefined {
  let fromWorker: string | undefined;
  try {
    fromWorker = getCloudflareContext().env?.THENEWSAPI_API_KEY;
  } catch {
    // No Cloudflare runtime (Node dev server, tests) — fall through.
  }
  return fromWorker || process.env.THENEWSAPI_API_KEY || undefined;
}

function getKV(): any {
  try {
    return (getCloudflareContext().env as any)?.KV;
  } catch {
    return undefined;
  }
}

/**
 * Cache key for a request. The query is all that varies the body, but it is
 * normalised first — the same way the handler normalises it — so that
 * `?limit=6`, `?limit=06` and `?limit=99999` can't each open their own cache
 * entry (and their own upstream fan-out) for what is one answer.
 */
function cacheKey(url: URL): string {
  const topic = url.searchParams.get("topic");
  if (topic) return `${CACHE_PREFIX}topic:${topic.trim().toLowerCase().slice(0, 120)}`;
  return `${CACHE_PREFIX}top:${parseTopicLimit(url.searchParams.get("limit"))}`;
}

function jsonResponse(
  body: string,
  status: number,
  cache: "HIT" | "MISS" | "BYPASS",
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json",
      // Public and non-personalised when it worked; never hold on to a failure.
      "Cache-Control":
        status === 200 ? `public, max-age=${CACHE_TTL_SECONDS}` : "no-store",
      "X-Trending-News-Cache": cache,
    },
  });
}

/**
 * Answers a trending-news request, reading through a ten-minute KV cache when
 * the binding is available. Errors are never cached, so a News API blip
 * doesn't stick around for ten minutes.
 *
 * Cross-origin access is decided by this app's own allowlist (`lib/cors`), not
 * by the `Access-Control-Allow-Origin: *` the standalone worker sends — hence
 * rebuilding the response rather than passing it straight through.
 */
export async function serveTrendingNews(request: Request): Promise<Response> {
  const apiKey = getNewsApiKey();
  const kv = getKV();
  const key = cacheKey(new URL(request.url));

  if (kv && apiKey) {
    try {
      const cached = await kv.get(key);
      if (cached) return jsonResponse(cached, 200, "HIT");
    } catch (error) {
      console.error("Trending news cache read failed:", error);
    }
  }

  const response = await handleTrendingNewsRequest(request, { apiKey });
  const body = await response.text();

  if (kv && response.status === 200) {
    try {
      await kv.put(key, body, { expirationTtl: CACHE_TTL_SECONDS });
    } catch (error) {
      console.error("Trending news cache write failed:", error);
    }
  }

  return jsonResponse(body, response.status, kv ? "MISS" : "BYPASS");
}
