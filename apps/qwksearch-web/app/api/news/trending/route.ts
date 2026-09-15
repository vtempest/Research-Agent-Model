/**
 * @fileoverview Trending news for the homepage widget: Wikipedia's daily
 * most-viewed topics joined to matching headlines from The News API, keeping
 * the API key server-side. `GET /api/news/trending?limit=6`, or
 * `?topic=<name>` for one topic's headlines.
 */
import { serveTrendingNews } from "@/lib/news/trending";
import { withCors, corsPreflight } from "@/lib/cors";

export const GET = withCors(serveTrendingNews);
export const OPTIONS = corsPreflight;
