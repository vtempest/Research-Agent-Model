/**
 * @file predict-statistics.ts
 * @description Statistical analysis and prediction library - main export file.
 *
 * This file serves as a barrel export for all statistical prediction functionality,
 * providing a single import point for all modules.
 */

// Export types
export type {
  XGBoostParams,
  TrainModelOptions,
  PredictOptions,
  TrainTestSplit,
} from "./types";

// Export training functionality
export { trainModels, splitTrainTest } from "./xgboost-trainer";

// Export prediction functionality
export { predictFuture } from "./xgboost-predictor";

// Export evaluation metrics
export { calculateRMSE, calculateR2 } from "./metrics";

// Export model persistence
export { saveModel, loadModel } from "./model-persistence";

// Export rolling statistics
export { calculateRollingStats } from "./rolling-stats";
