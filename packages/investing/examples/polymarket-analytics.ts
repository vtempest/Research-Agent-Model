/**
 * Polymarket Analytics API - Usage Examples
 *
 * This file demonstrates how to use the Polymarket Analytics API endpoints
 * for fetching market summary and dashboard data. It contains no assertions,
 * so it lives in examples/ rather than test/.
 */

import {
  fetchMarketSummary,
  fetchMarketsDashboard,
} from "../src/prediction";

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Market Summary Response Interface
 * Extend this based on actual API response structure
 */
export interface MarketSummary {
  volume?: number;
  liquidity?: number;
  openInterest?: number;
  volume24h?: number;
  volumeTotal?: number;
  holders?: number;
  // Add more fields as needed based on actual API response
  [key: string]: any;
}

/**
 * Dashboard Data Response Interface
 * Extend this based on actual API response structure
 */
export interface DashboardData {
  charts?: Array<{
    timestamp: string;
    price: number;
    volume?: number;
  }>;
  holders?: Array<{
    wallet: string;
    size: number;
    value?: number;
  }>;
  positions?: any[];
  trades?: any[];
  // Add more fields as needed based on actual API response
  [key: string]: any;
}

// ============================================================================
// Typed Wrapper Functions
// ============================================================================

/**
 * Get market summary analytics for a specific event
 *
 * @param eventId - The Polymarket event ID
 * @returns Promise with market summary data including volume, liquidity, etc.
 */
export async function getMarketSummary(
  eventId: string
): Promise<MarketSummary> {
  try {
    const data = await fetchMarketSummary(eventId);
    return data as MarketSummary;
  } catch (error) {
    console.error(
      `Failed to fetch market summary for event ${eventId}:`,
      error
    );
    throw error;
  }
}

/**
 * Get dashboard data for a specific event
 *
 * @param eventId - The Polymarket event ID
 * @returns Promise with dashboard data including charts, holders, positions
 */
export async function getMarketsDashboard(
  eventId: string
): Promise<DashboardData> {
  try {
    const data = await fetchMarketsDashboard(eventId);
    return data as DashboardData;
  } catch (error) {
    console.error(
      `Failed to fetch dashboard data for event ${eventId}:`,
      error
    );
    throw error;
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example 1: Fetch and display market summary for a specific event
 */
export async function exampleMarketSummary() {
  try {
    const eventId = "23656"; // Example event ID
    const summary = await getMarketSummary(eventId);

    console.log("Market Summary:", {
      volume: summary.volume || "N/A",
      liquidity: summary.liquidity || "N/A",
      openInterest: summary.openInterest || "N/A",
      volume24h: summary.volume24h || "N/A",
    });

    return summary;
  } catch (error) {
    console.error("Market summary fetch failed:", error);
    throw error;
  }
}

/**
 * Example 2: Fetch and display dashboard data
 */
export async function exampleDashboard() {
  try {
    const eventId = "23656"; // Example event ID
    const dashboard = await getMarketsDashboard(eventId);

    console.log("Dashboard Highlights:", {
      holderCount: dashboard.holders?.length || 0,
      chartDataPoints: dashboard.charts?.length || 0,
      recentPrice:
        dashboard.charts?.[dashboard.charts.length - 1]?.price || "N/A",
    });

    return dashboard;
  } catch (error) {
    console.error("Dashboard fetch failed:", error);
    throw error;
  }
}

/**
 * Example 3: Combined workflow - Get both summary and dashboard data
 */
export async function exampleCombinedAnalytics(eventId: string) {
  try {
    // Fetch both datasets in parallel for better performance
    const [summary, dashboard] = await Promise.all([
      getMarketSummary(eventId),
      getMarketsDashboard(eventId),
    ]);

    console.log(`\n=== Analytics for Event ${eventId} ===`);

    console.log("\nMarket Summary:");
    console.log(`  Volume: ${summary.volume || "N/A"}`);
    console.log(`  Liquidity: ${summary.liquidity || "N/A"}`);
    console.log(`  Open Interest: ${summary.openInterest || "N/A"}`);

    console.log("\nDashboard Data:");
    console.log(`  Total Holders: ${dashboard.holders?.length || 0}`);
    console.log(`  Chart Data Points: ${dashboard.charts?.length || 0}`);

    if (dashboard.charts && dashboard.charts.length > 0) {
      const latest = dashboard.charts[dashboard.charts.length - 1];
      console.log(`  Latest Price: ${latest.price}`);
      console.log(`  Latest Timestamp: ${latest.timestamp}`);
    }

    return { summary, dashboard };
  } catch (error) {
    console.error("Combined analytics fetch failed:", error);
    throw error;
  }
}

/**
 * Example 4: Integration with public search to get high-volume markets
 * then fetch their detailed analytics
 */
export async function exampleHighVolumeMarketAnalytics() {
  try {
    // This would typically use the searchPublic function first
    // For demonstration, using a sample event ID
    const eventId = "23656";

    const analytics = await exampleCombinedAnalytics(eventId);

    console.log("\nHigh-volume market analytics retrieved successfully");
    return analytics;
  } catch (error) {
    console.error("High-volume market analytics failed:", error);
    throw error;
  }
}

// ============================================================================
// Main Execution Example
// ============================================================================

/**
 * Main function to demonstrate all examples
 * Run this to test the API functions
 */
export async function main() {
  console.log("=== Polymarket Analytics API Examples ===\n");

  try {
    // Example 1: Market Summary
    console.log("Example 1: Market Summary");
    await exampleMarketSummary();
    console.log();

    // Example 2: Dashboard Data
    console.log("Example 2: Dashboard Data");
    await exampleDashboard();
    console.log();

    // Example 3: Combined Analytics
    console.log("Example 3: Combined Analytics");
    await exampleCombinedAnalytics("23656");
    console.log();

    console.log("✓ All examples completed successfully");
  } catch (error) {
    console.error("✗ Example execution failed:", error);
    process.exit(1);
  }
}

// Uncomment to run examples
// main()
