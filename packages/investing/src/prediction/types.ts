/**
 * Core TypeScript interfaces for the Polymarket Signal Detection System
 */

// ============================================
// Configuration Types
// ============================================

export interface Trigger {
  cents: number; // Minimum price change in cents (e.g., 5 = 5¢)
  minutes: number; // Time window in minutes
}

export interface DetectionConfig {
  minVolumeUsd: number;
  minDaysToResolution: number;
  cooldownMinutes: number;
  alertsPaused: boolean;
  triggers: Trigger[];
  blocklistCategories: string[];
  blocklistKeywords: string[];
}

// ============================================
// Market Data Types
// ============================================

export interface Market {
  id: string;
  conditionId: string;
  question: string;
  slug: string;
  eventSlug: string; // Event slug for URL (markets are nested under events)
  category: string;
  endDate: Date | null;
  active: boolean;
  volumeNum: number;
  tokenYes: string;
  tokenNo: string;
}

export interface PriceSnapshot {
  marketId: string;
  tokenId: string;
  price: number;
  timestamp: Date;
}

export interface PriceWindow {
  oldest: number | null;
  latest: number | null;
  oldestTime: Date | null;
}

// ============================================
// Detection Types
// ============================================

export type Side = "YES" | "NO";

export interface PriceMovement {
  marketId: string;
  market: Market;
  tokenId: string;
  side: Side;
  priceBefore: number;
  priceAfter: number;
  changePercent: number;
  timeWindowMinutes: number;
  detectedAt: Date;
}

// ============================================
// Signal & Enrichment Types
// ============================================

export interface Signal {
  movement: PriceMovement;
  enrichments: SignalEnrichments;
}

export interface SignalEnrichments {
  // Phase 2: Trade Attribution
  trades?: TradeInfo[];
  totalVolumeInWindow?: number;

  // Phase 3: Trader Scoring
  topTraders?: TraderInfo[];
  avgTraderScore?: number;

  // Phase 4: Wallet Clustering
  clusterAnalysis?: ClusterInfo;

  // Phase 5: Confidence Score
  confidenceScore?: number;
  scoreBreakdown?: ScoreBreakdown;

  // Greeks metrics (binary options model)
  greeks?: GreeksMetrics;
}

// Binary options-style Greeks for prediction markets
export interface GreeksMetrics {
  theta: number; // Time decay in cents/day (negative = decaying)
  vega: number; // Sensitivity to volatility changes
  impliedVol: number; // Annualized historical volatility (0-1)
  uncertainty: number; // P*(1-P), maximum 0.25 at P=50%
  daysToExpiry: number; // Days until market resolution
}

// Future phase types (placeholders)
export interface TradeInfo {
  txHash: string;
  trader: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: Date;
}

export interface TraderInfo {
  address: string;
  categoryScore: number;
  winRate: number;
  totalPnl: number;
  tradeInSignal: number;
}

export interface ClusterInfo {
  totalWallets: number;
  uniqueFundingSources: number;
  largestClusterSize: number;
  coordinationLikelihood: number;
}

export interface ScoreBreakdown {
  traderQuality: number;
  independence: number;
  conviction: number;
  context: number;
}

// ============================================
// Enricher Interface
// ============================================

export interface Enricher {
  name: string;
  enrich(signal: Signal): Promise<Signal>;
}

// ============================================
// API Response Types
// ============================================

export interface GammaMarketToken {
  token_id: string;
  outcome: string;
}

export interface GammaMarketResponse {
  id: string;
  condition_id?: string;
  question: string;
  slug?: string;
  category?: string;
  end_date_iso?: string;
  active?: boolean;
  volume_num_24hr?: string;
  tokens?: GammaMarketToken[];
}

export type ClobPricesResponse = Record<string, string>;

// ============================================
// Alert Types
// ============================================

export interface AlertRecord {
  id: number;
  marketId: string;
  triggerType: string;
  priceBefore: number;
  priceAfter: number;
  changePercent: number;
  timeWindowMinutes: number;
  sentAt: Date;
}
