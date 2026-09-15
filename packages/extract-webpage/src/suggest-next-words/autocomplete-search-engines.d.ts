/**
 * Provides search query autocomplete/suggestions from various search engines.
 */
/**
 * Autocomplete function type
 */
type AutocompleteFunction = (query: string, locale?: string) => Promise<string[]>;
/**
 * Baidu autocomplete
 */
export declare function baidu(query: string, _locale?: string): Promise<string[]>;
/**
 * Brave autocomplete
 */
export declare function brave(query: string, _locale?: string): Promise<string[]>;
/**
 * DuckDuckGo autocomplete
 */
export declare function duckduckgo(query: string, locale?: string): Promise<string[]>;
/**
 * Google autocomplete
 */
export declare function google(query: string, locale?: string): Promise<string[]>;
/**
 * Qwant autocomplete
 */
export declare function qwant(query: string, locale?: string): Promise<string[]>;
/**
 * Startpage autocomplete
 */
export declare function startpage(query: string, locale?: string): Promise<string[]>;
/**
 * Wikipedia autocomplete
 */
export declare function wikipedia(query: string, locale?: string): Promise<string[]>;
/**
 * Yandex autocomplete
 */
export declare function yandex(query: string, _locale?: string): Promise<string[]>;
/**
 * Available autocomplete backends
 */
export declare const backends: {
    [key: string]: AutocompleteFunction;
};
/**
 * Get autocomplete suggestions from a specific backend
 *
 * @param backendName - Name of the autocomplete backend
 * @param query - Search query
 * @param locale - Locale/language code (e.g., 'en-US', 'de-DE')
 * @returns Array of suggestion strings
 */
export declare function searchAutocomplete(backendName: string, query: string, locale?: string): Promise<string[]>;
/**
 * Get autocomplete suggestions from multiple backends and merge them
 *
 * @param backendNames - Array of backend names to query
 * @param query - Search query
 * @param locale - Locale/language code
 * @returns Merged and deduplicated array of suggestions
 */
export declare function searchAutocompleteMulti(backendNames: string[], query: string, locale?: string): Promise<string[]>;
export {};
