import { db } from "./index";
import { DetectionConfig, PriceWindow } from "../prediction/types";

// Stub for getPool - returns an object with query method
export function getPool() {
  return {
    query: async (text: string, params: any[]) => {
      console.log("Mock query executed:", text);
      return { rows: [] };
    },
  };
}

export async function getConfig(): Promise<DetectionConfig> {
  return {
    minVolumeUsd: 50000,
    minDaysToResolution: 2,
    cooldownMinutes: 60,
    alertsPaused: false,
    triggers: [{ cents: 5, minutes: 30 }],
    blocklistCategories: [],
    blocklistKeywords: [],
  };
}

export async function getPriceWindowsBatch(
  tokenIds: string[],
  minutes: number,
): Promise<Map<string, PriceWindow>> {
  return new Map();
}

export async function getMarketsInCooldown(
  marketIds: string[],
  minutes: number,
): Promise<Set<string>> {
  return new Set();
}
