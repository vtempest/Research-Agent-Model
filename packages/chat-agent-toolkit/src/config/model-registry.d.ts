import type { ConfigModelProvider, Model } from "./config-types";
export default class ModelRegistry {
    /**
     * Currently configured providers (env-based + user-added).
     * Sync getter used by the chat handler for logging and lookups.
     */
    get activeProviders(): ConfigModelProvider[];
    /**
     * Providers with their full chat model lists (defaults merged with
     * user-added models), shaped for the settings/providers UI.
     */
    getActiveProviders(guestMode?: boolean): Promise<{
        id: string;
        name: string;
        type: string;
        chatModels: Model[];
    }[]>;
    /**
     * Get guest-safe chat models for a provider (only tested working models).
     */
    private getGuestChatModels;
    /**
     * Finds a provider by id, falling back to free providers in order:
     * OpenRouter (no daily limits, best for guests), Groq (fastest, daily limits),
     * AnyAPI (100,000 anyTokens/day free), then NVIDIA, then the first
     * configured provider.
     * Client-side provider ids are config hashes that go stale whenever
     * server env config changes, so a graceful fallback keeps existing
     * chat sessions working after a redeploy.
     */
    private findProvider;
    /** Whether the resolved provider was configured from environment variables. */
    isProviderEnvBased(providerId?: string): boolean;
    /**
     * Instantiates a Vercel AI SDK language model for the given provider and
     * model key. Falls back to the provider's first/default model when no key
     * is given. Temperature is a per-call setting in the AI SDK, so callers
     * pass it to generateText/streamText rather than the model instance.
     */
    loadChatModel(providerId?: string, modelKey?: string): Promise<any>;
    /**
     * Registers a new provider. Accepts both `(type, config)` — used by the
     * providers API route — and `(type, name, config)`.
     */
    addProvider(type: string, nameOrConfig: any, config?: Record<string, any>): Promise<{
        id: string;
        name: string;
        type: string;
        config: Record<string, any>;
        hash: string;
        isEnvBased?: boolean;
        chatModels: Model[];
    }>;
    removeProvider(providerId: string): Promise<void>;
    /**
     * Updates a provider's config. Accepts both `(id, config)` — used by the
     * providers API route — and `(id, name, config)`.
     */
    updateProvider(providerId: string, nameOrConfig: any, config?: Record<string, any>): Promise<{
        id: string;
        name: string;
        type: string;
        config: Record<string, any>;
        hash: string;
        isEnvBased?: boolean;
        chatModels: Model[];
    }>;
    addProviderModel(providerId: string, type: "chat", model: any): Promise<any>;
    removeProviderModel(providerId: string, type: "chat", modelKey: string): Promise<void>;
}
