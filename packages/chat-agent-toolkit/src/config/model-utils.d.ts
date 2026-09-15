/**
 * Utility functions for working with AI models
 */
/**
 * List of model IDs that are free to use (no per-token cost)
 * Updated regularly as providers change their pricing
 */
export declare const FREE_MODELS: Set<string>;
/**
 * Providers that offer free tiers with generous limits
 */
export declare const FREE_TIER_PROVIDERS: Set<string>;
/**
 * Check if a model is free to use (no per-token cost)
 * Note: Free models may have rate limits
 */
export declare function isModelFree(modelId: string): boolean;
/**
 * Check if a provider offers a free tier
 */
export declare function hasFreeTier(providerType: string): boolean;
/**
 * Get a display name for a model with cost indicator
 * Example: "Llama 3.3 70B (Free)" or "GPT-4o"
 */
export declare function getModelDisplayName(modelName: string, modelId: string): string;
/**
 * Get provider-specific information
 */
export declare function getProviderInfo(providerType: string): {
    name: string;
    hasFreeTier: boolean;
    signupUrl: string;
    docsUrl: string;
};
/**
 * Get recommended free providers for getting started
 */
export declare function getRecommendedFreeProviders(): Array<{
    type: string;
    name: string;
    reason: string;
    signupUrl: string;
}>;
