/**
 * @file model-persistence.ts
 * @description Functions for saving and loading trained XGBoost models.
 */
import xgboost from "xgboost_node";

/**
 * Saves the trained XGBoost model to the specified file path
 *
 * The model is serialized to disk in XGBoost's native binary format,
 * which can be loaded later for making predictions without retraining.
 *
 * @param modelPath - Path where the model should be saved
 * @returns Promise that resolves when the model is saved
 * @example
 *  await saveModel('./models/my-model.bin');
 */
export async function saveModel(modelPath: string): Promise<void> {
  await xgboost.saveModel(modelPath);
}

/**
 * Loads a trained XGBoost model from the specified file path
 *
 * Restores a previously saved model from disk, allowing you to make
 * predictions without retraining. The loaded model becomes the active
 * model for subsequent prediction calls.
 *
 * @param modelPath - Path to the saved model file
 * @returns Promise that resolves when the model is loaded
 * @example
 *  await loadModel('./models/my-model.bin');
 */
export async function loadModel(modelPath: string): Promise<void> {
  await xgboost.loadModel(modelPath);
}
