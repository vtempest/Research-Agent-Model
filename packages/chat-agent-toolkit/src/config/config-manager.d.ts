/**
 * @fileoverview Configuration Manager
 *
 * Manages model providers, MCP servers, and search configuration in memory.
 * Handles environment variable loading, provider hashing, and config updates.
 */
import type { ConfigModelProvider, Config, UIConfigSections } from "./config-types";
declare class ConfigManager {
    configVersion: number;
    currentConfig: Config;
    uiConfigSections: UIConfigSections;
    private initialized;
    constructor();
    private ensureInitialized;
    private initialize;
    getConfig(key: string, defaultValue?: any): any;
    updateConfig(key: string, val: any): void;
    addModelProvider(type: string, name: string, config: any): ConfigModelProvider;
    removeModelProvider(id: string): void;
    updateModelProvider(id: string, name: string, config: any): Promise<ConfigModelProvider>;
    addProviderModel(providerId: string, type: "chat", model: any): any;
    removeProviderModel(providerId: string, type: "chat", modelKey: string): void;
    isSetupComplete(): boolean;
    markSetupComplete(): void;
    getUIConfigSections(): UIConfigSections;
    getCurrentConfig(): Config;
}
declare const configManager: ConfigManager;
export default configManager;
