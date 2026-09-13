/**
 * @fileoverview Model availability testing and validation
 * Tests which models are actually working for a given provider
 */
export interface ModelTestResult {
    modelId: string;
    modelName: string;
    available: boolean;
    error?: string;
    latency?: number;
    type?: string;
}
export interface ProviderTestResult {
    provider: string;
    totalModels: number;
    availableModels: ModelTestResult[];
    unavailableModels: ModelTestResult[];
    testDuration: number;
}
/**
 * Test a single model to see if it's working
 */
export declare function testModel(provider: string, apiKey: string, modelId: string, modelName: string, modelType?: string, timeout?: number): Promise<ModelTestResult>;
/**
 * Test all models for a provider
 */
export declare function testProviderModels(provider: string, apiKey: string, models: Array<{
    id: string;
    name: string;
    type?: string;
    free?: boolean;
}>, options?: {
    onlyFree?: boolean;
    concurrency?: number;
    timeout?: number;
    onProgress?: (current: number, total: number, modelName: string) => void;
}): Promise<ProviderTestResult>;
/**
 * Get only free models from a model list
 */
export declare function getOnlyFreeModels<T extends {
    free?: boolean;
}>(models: T[]): T[];
/**
 * Categorize models by type
 */
export declare function categorizeModelsByType<T extends {
    type?: string;
    id: string;
    name: string;
}>(models: T[]): Record<string, T[]>;
