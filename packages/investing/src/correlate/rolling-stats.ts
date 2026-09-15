/**
 * @file rolling-stats.ts
 * @description Rolling window statistical calculations for time series data.
 */

/**
 * Calculate rolling statistics for a given array of values
 *
 * Computes rolling mean and standard deviation over a sliding window.
 * Rolling statistics help identify trends and volatility in time series data.
 *
 * @param data - Array of data objects
 * @param field - Field name to calculate rolling stats for
 * @param window - Rolling window size (default: 7)
 * @returns Array with added rolling statistics fields:
 *   - `${field}_rolling_mean_${window}d`: Rolling mean
 *   - `${field}_rolling_std_${window}d`: Rolling standard deviation
 * @example
 *  let data = [
 *    { date: '2024-01-01', price: 100 },
 *    { date: '2024-01-02', price: 105 },
 *    { date: '2024-01-03', price: 110 },
 *  ];
 *  let result = calculateRollingStats(data, 'price', 3);
 *  // result[2] will have price_rolling_mean_3d and price_rolling_std_3d
 */
export function calculateRollingStats(
  data: any[],
  field: string,
  window: number = 7
): any[] {
  return data.map((item, index) => {
    if (index < window - 1) {
      // Not enough data points for full window, use the first value
      return {
        ...item,
        [`${field}_rolling_mean_${window}d`]: item[field],
        [`${field}_rolling_std_${window}d`]: item[field],
      };
    }

    // Get values for the rolling window
    const windowValues = data
      .slice(index - window + 1, index + 1)
      .map((d) => d[field])
      .filter((val) => val !== null && val !== undefined && !isNaN(val));

    if (windowValues.length === 0) {
      return {
        ...item,
        [`${field}_rolling_mean_${window}d`]: null,
        [`${field}_rolling_std_${window}d`]: null,
      };
    }

    // Calculate rolling mean
    const mean =
      windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length;

    // Calculate rolling standard deviation
    const variance =
      windowValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      windowValues.length;
    const std = Math.sqrt(variance);

    return {
      ...item,
      [`${field}_rolling_mean_${window}d`]: Math.floor(mean), // Round to integer
      [`${field}_rolling_std_${window}d`]: Math.floor(std),
    };
  });
}
