/**
 * Search Web via SearXNG metasearch of all major search engines.
 */
export declare function searchWeb(query: string, options?: SearchOptions): Promise<SearxngSearchResult[] | SearchResponse>;
interface SearxngSearchOptions {
    categories?: string[];
    engines?: string[];
    language?: string;
    pageno?: number;
}
export declare const searchSearxng: (query: string, opts?: SearxngSearchOptions) => Promise<{
    results: SearxngSearchResult[];
    suggestions: string[];
}>;
/**
 * Normalized view of whatever `grab` handed back.
 * Exactly one of `json`, `text` or `error` is meaningful.
 */
export interface NormalizedGrabResponse {
    /** Parsed JSON body, when the response was JSON with search results. */
    json?: any;
    /** Raw body text, when the response was HTML or another text format. */
    text?: string;
    /** Message describing why the request did not produce a usable body. */
    error?: string;
}
/**
 * `grab` resolves rather than rejects on failure: network and HTTP errors come
 * back as `{ error }`, JSON bodies are merged onto the root of the response
 * object, and text/binary bodies are placed on `.data`. This flattens those
 * shapes (plus the plain string a raw fetch would return) into one union so
 * callers never read `.results` off an error object.
 *
 * @param raw The value returned by `grab`.
 * @returns The body as JSON or text, or the error that prevented both.
 */
export declare function normalizeGrabResponse(raw: any): NormalizedGrabResponse;
interface SearchOptions {
    category?: string | number;
    recency?: string;
    privateSearxng?: string | boolean | null;
    maxRetries?: number;
    page?: number;
    safesearch?: boolean;
    lang?: string;
    proxy?: string | null;
    useProxy?: boolean;
}
export interface SearxngSearchResult {
    title: string;
    url: string;
    snippet?: string;
    domain?: string;
    favicon?: string;
    score?: number;
    source?: string;
    date?: string;
    img_src?: string;
    thumbnail_src?: string;
    thumbnail?: string;
    content?: string;
    author?: string;
    iframe_src?: string;
}
export interface SearchResponse {
    results: SearxngSearchResult[];
    suggestions: string[];
    infoboxes?: any[];
}
export {};
