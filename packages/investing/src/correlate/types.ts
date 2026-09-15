/**
 * @file types.ts
 * @description Type definitions for XGBoost model training and prediction.
 */

/**
 * Configuration parameters for XGBoost model training.
 * @see {@link https://xgboost.readthedocs.io/en/release_3.0.0/parameter.html XGBoost Parameters Documentation}
 */
export interface XGBoostParams {
  /** Controls output verbosity: 0=silent, 1=warnings, 2=info, 3=debug. Default: 1 */
  verbosity?: number;
  /** Maximum depth of each tree. Higher values increase complexity and overfitting risk. Default: 6 */
  max_depth?: number;
  /** Learning rate (step size shrinkage). Smaller values require more rounds but improve generalization. Default: 0.3 */
  eta?: number;
  /** Learning task objective (e.g., 'reg:squarederror' for regression, 'binary:logistic' for classification) */
  objective?: string;
  /** Number of parallel threads for training. Default: maximum available */
  nthread?: number;
  /** Fraction of training instances sampled per tree (0-1). Values <1 reduce overfitting. Default: 1 */
  subsample?: number;
  /** Fraction of features sampled per tree (0-1). Adds diversity like Random Forest. Default: 1 */
  colsample_bytree?: number;
  /** Fraction of features sampled per tree level (0-1). Additional regularization layer. Default: 1 */
  colsample_bylevel?: number;
  /** Minimum sum of instance weights in a leaf. Higher values prevent overly specific splits. Default: 1 */
  min_child_weight?: number;
  /** Minimum loss reduction required for a split. Higher values make splitting more conservative. Default: 0 */
  gamma?: number;
  /** L1 regularization (lasso). Encourages sparsity/feature selection. Default: 0 */
  alpha?: number;
  /** L2 regularization (ridge). Penalizes large weights to prevent overfitting. Default: 1 */
  lambda?: number;
  /** Stop training after N rounds without validation improvement. Prevents overfitting. */
  early_stopping_rounds?: number;
  /** Random seed for reproducibility. Default: 0 */
  seed?: number;
  /** Number of boosting rounds (trees to build). More rounds needed with lower eta. */
  nrounds?: number;
  /** Tree construction algorithm: 'auto', 'exact', 'approx', 'hist', 'gpu_hist'. Default: 'auto' */
  tree_method?: string;
  /** Tree growth policy: 'depthwise' (level-by-level) or 'lossguide' (leaf-by-leaf). Default: 'depthwise' */
  grow_policy?: string;
  /** Index signature for additional XGBoost parameters not explicitly typed */
  [key: string]: any;
}

/**
 * Options for training an XGBoost model.
 */
export interface TrainModelOptions {
  /** XGBoost parameters for model configuration */
  xgbParams?: XGBoostParams;
  /** Proportion of data to use for testing (default: 0.2) */
  testSize?: number;
  /** Specific feature columns to use for training */
  featuresToUse: string[];
}

/**
 * Options for making predictions with a trained model.
 */
export interface PredictOptions {
  /** Specific feature columns to use for prediction */
  featuresToUse: string[];
}

/**
 * Result of train/test data split.
 */
export interface TrainTestSplit {
  /** Training feature arrays */
  trainFeatures: any[][];
  /** Testing feature arrays */
  testFeatures: any[][];
  /** Training target values */
  trainTarget: any[];
  /** Testing target values */
  testTarget: any[];
}
