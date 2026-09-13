/**
 * @fileoverview Specialized tools for AI agents to interact with the QwkSearch API.
 * Provides web search, content extraction, and AI response generation.
 */
import { z } from "zod";
/**
 * List of tools available for agent usage, including their schemas and implementation.
 */
export declare const AGENT_TOOLS: ({
    name: string;
    description: string;
    schema: z.ZodObject<{
        query: z.ZodString;
        category: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            files: "files";
            general: "general";
            images: "images";
            it: "it";
            news: "news";
            science: "science";
            videos: "videos";
        }>>>;
        recency: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            day: "day";
            month: "month";
            none: "none";
            week: "week";
            year: "year";
        }>>>;
        page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        language: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        public: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        baseURL: z.ZodOptional<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    func: ({ query, category, recency, page, language, public: isPublic, timeout, baseURL, apiKey }: {
        apiKey: any;
        baseURL: any;
        category?: string;
        language?: string;
        page?: number;
        public?: boolean;
        query: any;
        recency?: string;
        timeout?: number;
    }) => Promise<string>;
} | {
    name: string;
    description: string;
    schema: z.ZodObject<{
        url: z.ZodString;
        images: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        links: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        formatting: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        absoluteURLs: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        baseURL: z.ZodOptional<z.ZodString>;
        apiKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    func: ({ url, images, links, formatting, absoluteURLs, timeout, baseURL, apiKey }: {
        absoluteURLs?: boolean;
        apiKey: any;
        baseURL: any;
        formatting?: boolean;
        images?: boolean;
        links?: boolean;
        timeout?: number;
        url: any;
    }) => Promise<string>;
} | {
    name: string;
    description: string;
    schema: z.ZodObject<{
        url: z.ZodString;
        blockImages: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        wait: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        waitUntil: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            domcontentloaded: "domcontentloaded";
            load: "load";
            networkidle0: "networkidle0";
            networkidle2: "networkidle2";
        }>>>;
        bypassCaptcha: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        sessionId: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            html: "html";
            json: "json";
        }>>>;
        scraperUrl: z.ZodOptional<z.ZodString>;
        scraperApiKey: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    func: ({ url, blockImages, wait, timeout, waitUntil, bypassCaptcha, sessionId, format, scraperUrl, scraperApiKey }: {
        blockImages?: boolean;
        bypassCaptcha?: boolean;
        format?: string;
        scraperApiKey: any;
        scraperUrl: any;
        sessionId?: string;
        timeout?: number;
        url: any;
        wait?: number;
        waitUntil?: string;
    }) => Promise<string>;
})[];
