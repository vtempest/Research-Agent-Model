# XGBoost Statistical Prediction Module

This module provides a complete XGBoost-based machine learning pipeline for statistical prediction and analysis.

## What is XGBoost?

**XGBoost (eXtreme Gradient Boosting)** is a powerful machine learning algorithm that builds an ensemble of decision trees to make predictions. It's widely used in data science competitions and production systems due to its:

- **High Accuracy**: Consistently achieves state-of-the-art results
- **Speed**: Optimized implementation with parallel processing
- **Flexibility**: Supports regression, classification, and ranking tasks
- **Robustness**: Handles missing values and prevents overfitting through regularization

### How XGBoost Works

XGBoost uses **gradient boosting**, which builds trees sequentially where each new tree corrects the errors of previous trees:

1. **Start with a simple model**: Makes initial predictions (often just the mean)
2. **Calculate residuals**: Find the difference between predictions and actual values
3. **Build a tree to predict residuals**: The next tree learns to predict these errors
4. **Add the new tree to the ensemble**: Combine all trees with weighted contributions
5. **Repeat**: Continue building trees until performance plateaus or reaches maximum rounds

The algorithm uses gradient descent to minimize a loss function, with each tree moving predictions closer to the true values.

### Key Concepts

**Boosting**: Unlike Random Forest (which builds independent trees), boosting builds trees that depend on previous trees, focusing on correcting mistakes.

**Regularization**: XGBoost includes several techniques to prevent overfitting:

- Tree depth limits
- Minimum instances per leaf
- Feature/sample subsampling
- L1/L2 weight penalties

**Sparsity Awareness**: Efficiently handles missing values by learning optimal default directions in tree splits.

## Module Structure

```
correlate/
├── README.md                    # This file
├── predict-statistics.ts        # Main export file (barrel export)
├── types.ts                     # TypeScript interfaces
├── xgboost-trainer.ts          # Model training
├── xgboost-predictor.ts        # Making predictions
├── metrics.ts                   # Evaluation metrics (RMSE, R²)
├── model-persistence.ts        # Save/load models
└── rolling-stats.ts            # Time series statistics
```

## Usage

### Basic Training Example

```typescript
import { trainModels } from "./correlate";

// Prepare your data
const data = [
  { temperature: 20, humidity: 65, rainfall: 5, crop_yield: 100 },
  { temperature: 22, humidity: 70, rainfall: 3, crop_yield: 95 },
  { temperature: 25, humidity: 60, rainfall: 8, crop_yield: 110 },
  // ... more data
];

// Train the model
const accuracy = await trainModels(
  data,
  "crop_yield", // Target variable to predict
  {
    featuresToUse: ["temperature", "humidity", "rainfall"],
    testSize: 0.2, // Use 20% for testing
    xgbParams: {
      max_depth: 6,
      eta: 0.1,
      objective: "reg:squarederror",
      nthread: 4,
    },
  },
);

console.log(`Model R² score: ${accuracy}`);
```

### Making Predictions

```typescript
import { predictFuture } from "./correlate";

// New data to predict
const futureData = [
  { temperature: 23, humidity: 68, rainfall: 4 },
  { temperature: 21, humidity: 72, rainfall: 6 },
];

// Make predictions
const predictions = await predictFuture(futureData, {
  featuresToUse: ["temperature", "humidity", "rainfall"],
});

console.log(predictions);
// [
//   { temperature: 23, humidity: 68, rainfall: 4, predicted: 102.5 },
//   { temperature: 21, humidity: 72, rainfall: 6, predicted: 98.3 },
// ]
```

### Saving and Loading Models

```typescript
import { saveModel, loadModel } from "./correlate";

// After training, save the model
await saveModel("./models/crop-prediction.bin");

// Later, load the model for predictions
await loadModel("./models/crop-prediction.bin");

// Now you can make predictions without retraining
const predictions = await predictFuture(newData, options);
```

### Calculate Rolling Statistics

```typescript
import { calculateRollingStats } from "./correlate";

const priceData = [
  { date: "2024-01-01", price: 100 },
  { date: "2024-01-02", price: 105 },
  { date: "2024-01-03", price: 110 },
  { date: "2024-01-04", price: 108 },
  { date: "2024-01-05", price: 112 },
  { date: "2024-01-06", price: 115 },
  { date: "2024-01-07", price: 113 },
];

// Calculate 7-day rolling mean and standard deviation
const withStats = calculateRollingStats(priceData, "price", 7);

console.log(withStats[6]);
// {
//   date: '2024-01-07',
//   price: 113,
//   price_rolling_mean_7d: 109,
//   price_rolling_std_7d: 4
// }
```

## XGBoost Parameters Explained

### Tree Structure Parameters

| Parameter          | Default | Description                                                           |
| ------------------ | ------- | --------------------------------------------------------------------- |
| `max_depth`        | 6       | Maximum depth of each tree. Higher = more complex, risks overfitting  |
| `min_child_weight` | 1       | Minimum instances needed in a leaf. Higher = more conservative splits |
| `gamma`            | 0       | Minimum loss reduction for splits. Higher = more conservative         |

### Learning Parameters

| Parameter             | Default | Description                                                      |
| --------------------- | ------- | ---------------------------------------------------------------- |
| `eta` (learning_rate) | 0.3     | Step size for updates. Lower = slower but more robust (0.01-0.3) |
| `subsample`           | 1       | Fraction of samples per tree. <1 reduces overfitting (0.5-1.0)   |
| `colsample_bytree`    | 1       | Fraction of features per tree. <1 adds diversity (0.5-1.0)       |

### Regularization Parameters

| Parameter             | Default | Description                                              |
| --------------------- | ------- | -------------------------------------------------------- |
| `lambda` (reg_lambda) | 1       | L2 regularization. Penalizes large weights               |
| `alpha` (reg_alpha)   | 0       | L1 regularization. Encourages sparsity/feature selection |

### Training Control

| Parameter               | Default | Description                                                |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `nrounds`               | -       | Number of boosting rounds (trees to build)                 |
| `early_stopping_rounds` | -       | Stop if no improvement for N rounds                        |
| `objective`             | -       | Loss function: 'reg:squarederror', 'binary:logistic', etc. |
| `seed`                  | 0       | Random seed for reproducibility                            |

### Recommended Parameter Sets

**For Small Datasets (<1000 samples):**

```typescript
{
  max_depth: 4,
  eta: 0.1,
  subsample: 0.8,
  colsample_bytree: 0.8,
  min_child_weight: 3,
  nrounds: 500
}
```

**For Large Datasets (>10000 samples):**

```typescript
{
  max_depth: 7,
  eta: 0.05,
  subsample: 0.85,
  colsample_bytree: 0.8,
  min_child_weight: 5,
  gamma: 0.2,
  lambda: 1.5,
  nrounds: 2000,
  tree_method: 'hist'
}
```

**For Overfitting Prevention:**

```typescript
{
  max_depth: 5,
  eta: 0.05,
  subsample: 0.7,
  colsample_bytree: 0.7,
  min_child_weight: 5,
  gamma: 0.3,
  lambda: 2.0,
  early_stopping_rounds: 50
}
```

## Evaluation Metrics

### R² (Coefficient of Determination)

Measures the proportion of variance in the target variable explained by the model:

- **1.0**: Perfect predictions
- **0.5**: Model explains 50% of variance
- **0.0**: No better than predicting the mean
- **<0**: Model performs worse than mean

### RMSE (Root Mean Square Error)

Average magnitude of prediction errors in the same units as the target:

```typescript
import { calculateRMSE } from "./correlate";

const actual = [100, 110, 105, 115];
const predicted = [98, 112, 104, 116];
const rmse = calculateRMSE(actual, predicted);
console.log(rmse); // ~2.24
```

Lower RMSE indicates better predictions. Compare against the range of your target variable to assess if the error is acceptable.

## Best Practices

### 1. Feature Engineering

XGBoost works best with well-prepared features:

- **Normalize/Scale**: Not required but can help with feature importance interpretation
- **Handle Missing**: XGBoost handles NaN values automatically
- **Create Interactions**: Manually create feature combinations if domain knowledge suggests them
- **Rolling Statistics**: Use `calculateRollingStats()` for time series features

### 2. Preventing Overfitting

Signs of overfitting:

- High training accuracy but low test accuracy
- R² score drops significantly on new data

Solutions:

- Reduce `max_depth` (try 4-6)
- Increase `min_child_weight` (try 3-5)
- Increase `gamma` (try 0.1-0.3)
- Reduce `eta` and increase `nrounds`
- Use `subsample` and `colsample_bytree` <1.0
- Enable `early_stopping_rounds`

### 3. Hyperparameter Tuning

Start with defaults and tune in this order:

1. **Tree structure**: `max_depth`, `min_child_weight`
2. **Regularization**: `gamma`, `lambda`, `alpha`
3. **Sampling**: `subsample`, `colsample_bytree`
4. **Learning rate**: Lower `eta`, increase `nrounds`

### 4. Model Validation

```typescript
// Use proper train/test split
const options = {
  testSize: 0.2,  // 80% train, 20% test
  featuresToUse: [...],
  xgbParams: {
    seed: 42,  // For reproducibility
    early_stopping_rounds: 50
  }
};
```

### 5. Feature Selection

Not all features improve predictions:

- Start with domain knowledge
- Try adding/removing features
- Check feature importance (requires XGBoost native methods)
- Use L1 regularization (`alpha`) for automatic feature selection

### Sufficient Data

XGBoost needs enough samples to learn patterns:

- Minimum: ~100 samples per feature
- Recommended: 1000+ samples for reliable models

### Target Variable Issues

- Ensure target has sufficient variance (not all same value)
- Remove outliers if they represent errors (not true patterns)
- For time series, sort data chronologically before splitting

## References

- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [XGBoost Parameters](https://xgboost.readthedocs.io/en/release_3.0.0/parameter.html)
- [XGBoost Paper](https://arxiv.org/abs/1603.02754)
