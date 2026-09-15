/**
 * @module research/search/index
 * @description Research library module.
 *
 * Note: To use these search handlers, you need to provide search functions
 * (searchSearxng, searchTavily, etc.) from search-web-api package.
 */
import MetaSearchAgent from "./metaSearchAgent";
import type { Config } from "./meta-search-types";
/**
 * Creates search handler instances with provided search functions.
 * Pass in search functions from extract-webpage to enable web search.
 */
export declare const createSearchHandlers: (searchFunctions?: Partial<Config>) => {
    webSearch: MetaSearchAgent;
    academicSearch: MetaSearchAgent;
    writingAssistant: MetaSearchAgent;
    wolframAlphaSearch: MetaSearchAgent;
    youtubeSearch: MetaSearchAgent;
    redditSearch: MetaSearchAgent;
};
/**
 * Default search handlers without search functions.
 * These will not perform actual web searches unless search functions are added to the Config.
 * @deprecated Use createSearchHandlers() with search functions instead
 */
export declare const searchHandlers: {
    webSearch: MetaSearchAgent;
    academicSearch: MetaSearchAgent;
    writingAssistant: MetaSearchAgent;
    wolframAlphaSearch: MetaSearchAgent;
    youtubeSearch: MetaSearchAgent;
    redditSearch: MetaSearchAgent;
};
