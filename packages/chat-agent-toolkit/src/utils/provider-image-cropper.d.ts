/**
 * @fileoverview Crops a single provider's icon out of a shared sprite-sheet image.
 *
 * The sprite sheet is a 6-column by 4-row grid of provider logos; each provider's
 * grid position is looked up in `PROVIDERS` and rendered onto a canvas, which can
 * then be returned as a canvas, Blob, or data URL.
 */
declare const PROVIDERS: {
    readonly openrouter: {
        readonly row: 0;
        readonly col: 0;
    };
    readonly tongyi: {
        readonly row: 0;
        readonly col: 1;
    };
    readonly ollama: {
        readonly row: 0;
        readonly col: 2;
    };
    readonly huggingface: {
        readonly row: 0;
        readonly col: 3;
    };
    readonly localai: {
        readonly row: 0;
        readonly col: 4;
    };
    readonly openllm: {
        readonly row: 0;
        readonly col: 5;
    };
    readonly zhipu: {
        readonly row: 1;
        readonly col: 0;
    };
    readonly replicate: {
        readonly row: 1;
        readonly col: 1;
    };
    readonly azure: {
        readonly row: 1;
        readonly col: 2;
    };
    readonly anthropic: {
        readonly row: 1;
        readonly col: 3;
    };
    readonly groq: {
        readonly row: 1;
        readonly col: 4;
    };
    readonly sagemaker: {
        readonly row: 1;
        readonly col: 5;
    };
    readonly "01ai": {
        readonly row: 2;
        readonly col: 0;
    };
    readonly bedrock: {
        readonly row: 2;
        readonly col: 1;
    };
    readonly openai: {
        readonly row: 2;
        readonly col: 2;
    };
    readonly cohere: {
        readonly row: 2;
        readonly col: 3;
    };
    readonly together: {
        readonly row: 2;
        readonly col: 4;
    };
    readonly xorbits: {
        readonly row: 2;
        readonly col: 5;
    };
    readonly wenxin: {
        readonly row: 3;
        readonly col: 0;
    };
    readonly moonshot: {
        readonly row: 3;
        readonly col: 1;
    };
    readonly gemini: {
        readonly row: 3;
        readonly col: 2;
    };
    readonly mistral: {
        readonly row: 3;
        readonly col: 3;
    };
    readonly jina: {
        readonly row: 3;
        readonly col: 4;
    };
    readonly chatglm: {
        readonly row: 3;
        readonly col: 5;
    };
};
export type Provider = keyof typeof PROVIDERS;
/**
 * Returns a cropped canvas containing just the provider box.
 */
export declare function cropProvider(image: HTMLImageElement | ImageBitmap, provider: Provider): Promise<HTMLCanvasElement>;
/**
 * Returns the provider image as a Blob.
 */
export declare function cropProviderAsBlob(image: HTMLImageElement | ImageBitmap, provider: Provider, type?: "image/png" | "image/jpeg" | "image/webp", quality?: number): Promise<Blob>;
/**
 * Returns the provider image as a data URL.
 */
export declare function cropProviderAsDataURL(image: HTMLImageElement | ImageBitmap, provider: Provider, type?: "image/png" | "image/jpeg" | "image/webp", quality?: number): Promise<string>;
/**
 * Helper to load and crop in one call.
 */
export declare function getProviderImage(spriteSheetUrl: string, provider: Provider): Promise<HTMLCanvasElement>;
/**
 * Get all available provider names.
 */
export declare function getProviderNames(): Provider[];
export {};
