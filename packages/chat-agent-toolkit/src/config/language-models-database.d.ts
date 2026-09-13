/**
 * List of default models for the chat providers and a list of models
 * @property {string} provider - The provider name
 * @property {string} docs - The documentation URL for the model
 * @property {string} api_key - The API key  url for the model
 * @property {string} default - The default model for the chat provider
 * @property {Object[]} models - The list of models available for the chat provider
 * @category Generate
 */
export declare const LANGUAGE_MODELS: ({
    provider: string;
    docs: string;
    api_key: string;
    default: string;
    models: {
        name: string;
        id: string;
        contextLength: number;
        free: boolean;
        type: string;
    }[];
} | {
    provider: string;
    docs: string;
    api_key: string;
    default: string;
    models: {
        name: string;
        id: string;
        contextLength: number;
    }[];
} | {
    provider: string;
    docs: string;
    api_key: string;
    default: string;
    models: {
        name: string;
        id: string;
        contextLength: number;
        free: boolean;
        type: string;
        rateLimit: string;
    }[];
} | {
    default?: undefined;
    provider: string;
    docs: string;
    api_key: string;
    models: {
        name: string;
        id: string;
        contextLength: number;
    }[];
} | {
    provider: string;
    docs: string;
    api_key: string;
    default: string;
    models: ({
        type?: undefined;
        name: string;
        id: string;
        contextLength: number;
        provider: string;
    } | {
        name: string;
        id: string;
        contextLength: number;
        provider: string;
        type: string;
    })[];
})[];
/** List of available LLM provider services */
export declare const LANGUAGE_PROVIDERS: string[];
/**
 * Guest-safe models that are known to work reliably.
 * Based on test results: only models with HTTP 200 status.
 * Last tested: 2026-07-22
 */
export declare const GUEST_SAFE_MODELS: {
    nvidia: string[];
    anyapi: string[];
    openrouter: string[];
};
/**
 * Filter models to only those in the guest-safe list.
 * Returns models with `free: true` property.
 */
export declare function filterModelsForGuests(models: any[]): any[];
/**
 * Get guest-safe provider list (only tested working models).
 * Uses GUEST_SAFE_MODELS whitelist to ensure reliability.
 */
export declare function getGuestSafeProviders(): typeof LANGUAGE_MODELS;
