/**
 * @module research/models/providers/index
 * @description Research library module.
 *
 * This file provides metadata about providers without importing them directly,
 * to avoid circular dependency issues with the config system.
 */
import { ModelProviderUISection } from "../types";
/**
 * Gets provider UI configuration without triggering circular dependencies.
 * This function uses static metadata instead of importing provider classes.
 */
export declare const getModelProvidersUIConfigSection: () => ModelProviderUISection[];
