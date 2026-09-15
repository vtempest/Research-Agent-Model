/**
 * @file metrics.ts
 * @description Statistical evaluation metrics for model performance.
 */

/**
 * Calculates Root Mean Square Error (RMSE) between actual and predicted values
 *
 * RMSE measures the average magnitude of prediction errors, giving higher weight
 * to larger errors due to squaring. Lower values indicate better model performance.
 *
 * @param actual - Array of actual values
 * @param predicted - Array of predicted values
 * @returns Root Mean Square Error value
 * @example
 *  let actual = [10, 20, 30, 40];
 *  let predicted = [12, 18, 32, 38];
 *  let rmse = calculateRMSE(actual, predicted);
 *  console.log(rmse); // ~2.24
 */
export function calculateRMSE(actual: number[], predicted: number[]): number {
  const squaredErrors = actual.map((val, i) => Math.pow(val - predicted[i], 2));
  const meanSquaredError =
    squaredErrors.reduce((sum, val) => sum + val, 0) / actual.length;
  return Math.sqrt(meanSquaredError);
}

/**
 * Calculates R-squared (coefficient of determination) between actual and predicted values
 *
 * R² represents the proportion of variance in the target variable that is predictable
 * from the features. Values range from 0 to 1, where:
 * - 1.0: Perfect predictions
 * - 0.0: Model performs no better than predicting the mean
 * - <0: Model performs worse than predicting the mean
 *
 * @param predicted - Array of predicted values
 * @param actual - Array of actual values
 * @returns R-squared value between 0 and 1 (rounded to 2 decimal places)
 * @example
 *  let actual = [10, 20, 30, 40];
 *  let predicted = [12, 18, 32, 38];
 *  let r2 = calculateR2(predicted, actual);
 *  console.log(r2); // ~0.96
 */
export function calculateR2(predicted: number[], actual: number[]): number {
  const meanActual = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const totalSumSquares = actual
    .map((val) => Math.pow(val - meanActual, 2))
    .reduce((sum, val) => sum + val, 0);

  const residualSumSquares = actual
    .map((val, i) => Math.pow(val - predicted[i], 2))
    .reduce((sum, val) => sum + val, 0);

  return Math.round((1 - residualSumSquares / totalSumSquares) * 100) / 100;
}
