import os
import json
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)
from sklearn.model_selection import train_test_split

try:
    from xgboost import XGBRegressor, XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from preprocess import (
    engineer_features,
    FEATURE_COLUMNS,
    TARGET_COLUMN,
)

# ── Metric Helpers ────────────────────────────────────────────────────────────

def calculate_smape(y_true, y_pred):
    """Symmetric Mean Absolute Percentage Error (safe against near-zero values)."""
    denominator = (np.abs(y_true) + np.abs(y_pred)) / 2.0
    diff = np.abs(y_pred - y_true)
    valid = denominator > 1e-4
    if np.sum(valid) == 0:
        return 0.0
    return float(np.mean(diff[valid] / denominator[valid]) * 100.0)

def safe_mape(y_true, y_pred):
    """Mean Absolute Percentage Error with epsilon safeguard."""
    y_true_safe = np.where(y_true < 0.1, 0.1, y_true)
    return float(np.mean(np.abs((y_true - y_pred) / y_true_safe)) * 100.0)

# ── 1. Demand Forecasting Model Training ──────────────────────────────────────

def train_demand_forecasting(data_dir: str, models_dir: str, sample_series: int = 1200):
    print("\n" + "="*65)
    print("  PHASE 1: Training Demand Forecasting Models (FreshRetailNet-50K)")
    print("="*65)

    train_path = os.path.join(data_dir, 'train.parquet')
    eval_path = os.path.join(data_dir, 'eval.parquet')

    if not os.path.exists(train_path):
        train_path = os.path.join(os.path.dirname(data_dir), 'train.parquet')
    if not os.path.exists(eval_path):
        eval_path = os.path.join(os.path.dirname(data_dir), 'eval.parquet')

    print(f"Loading FreshRetailNet-50K training data from: {train_path}")
    df_train_raw = pd.read_parquet(train_path)
    print(f"Loaded train: {len(df_train_raw):,} records")

    print(f"Loading FreshRetailNet-50K evaluation data from: {eval_path}")
    df_eval_raw = pd.read_parquet(eval_path)
    print(f"Loaded eval: {len(df_eval_raw):,} records")

    # Sample representative store-product time series to maintain speed and manageable memory
    unique_series = df_train_raw[['store_id', 'product_id']].drop_duplicates()
    print(f"Total unique store-product series in dataset: {len(unique_series):,}")

    if sample_series and sample_series < len(unique_series):
        selected_series = unique_series.sample(n=sample_series, random_state=42)
        print(f"Selected {sample_series:,} representative store-product series for model training.")
        
        train_sampled = df_train_raw.merge(selected_series, on=['store_id', 'product_id'], how='inner')
        eval_sampled = df_eval_raw.merge(selected_series, on=['store_id', 'product_id'], how='inner')
    else:
        train_sampled = df_train_raw
        eval_sampled = df_eval_raw

    print(f"Sampled train set: {len(train_sampled):,} records")
    print(f"Sampled eval set:  {len(eval_sampled):,} records")

    # Preprocess and engineer features
    print("\nEngineering features (lags, rolling stats, weather, calendar, stockout handling)...")
    train_feat = engineer_features(train_sampled, is_training=True)
    
    # Combine tail of train with eval to allow accurate lag calculation for eval set
    combined = pd.concat([train_sampled, eval_sampled], ignore_index=True)
    combined_feat = engineer_features(combined, is_training=True)
    
    eval_dates = df_eval_raw['dt'].unique()
    eval_feat = combined_feat[combined_feat['dt'].isin(eval_dates)].copy()

    # Drop any rows with NaN in target or essential features
    train_clean = train_feat.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()
    eval_clean = eval_feat.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()

    X_train = train_clean[FEATURE_COLUMNS]
    y_train = train_clean[TARGET_COLUMN].values
    X_eval = eval_clean[FEATURE_COLUMNS]
    y_eval = eval_clean[TARGET_COLUMN].values

    print(f"Final feature matrix: {X_train.shape[1]} features | Train: {len(X_train):,} | Eval: {len(X_eval):,}")

    results = {}

    # 1. Baseline Model: 7-day Moving Average (rolling_mean_7) & Lag 1
    print("\nEvaluating Baseline (7-Day Rolling Moving Average)...")
    baseline_pred = X_eval['rolling_mean_7'].values
    baseline_mae = mean_absolute_error(y_eval, baseline_pred)
    baseline_rmse = np.sqrt(mean_squared_error(y_eval, baseline_pred))
    baseline_r2 = r2_score(y_eval, baseline_pred)
    baseline_smape = calculate_smape(y_eval, baseline_pred)
    baseline_mape = safe_mape(y_eval, baseline_pred)

    results['Baseline (7-Day MA)'] = {
        'mae': round(float(baseline_mae), 4),
        'rmse': round(float(baseline_rmse), 4),
        'r2': round(float(baseline_r2), 4),
        'smape': round(float(baseline_smape), 2),
        'mape': round(float(baseline_mape), 2),
    }
    print(f"  -> Baseline MAE: {baseline_mae:.4f} | RMSE: {baseline_rmse:.4f} | R²: {baseline_r2:.4f} | SMAPE: {baseline_smape:.2f}%")

    # 2. Random Forest Regressor
    print("\nTraining Random Forest Regressor (n_estimators=100, max_depth=12)...")
    rf_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=5,
        n_jobs=-1,
        random_state=42,
    )
    t0 = time.time()
    rf_model.fit(X_train, y_train)
    rf_train_time = time.time() - t0

    rf_pred = rf_model.predict(X_eval)
    rf_mae = mean_absolute_error(y_eval, rf_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_eval, rf_pred))
    rf_r2 = r2_score(y_eval, rf_pred)
    rf_smape = calculate_smape(y_eval, rf_pred)
    rf_mape = safe_mape(y_eval, rf_pred)

    results['Random Forest'] = {
        'mae': round(float(rf_mae), 4),
        'rmse': round(float(rf_rmse), 4),
        'r2': round(float(rf_r2), 4),
        'smape': round(float(rf_smape), 2),
        'mape': round(float(rf_mape), 2),
        'train_time_sec': round(rf_train_time, 2),
    }
    print(f"  -> Random Forest MAE: {rf_mae:.4f} | RMSE: {rf_rmse:.4f} | R²: {rf_r2:.4f} | SMAPE: {rf_smape:.2f}% (Trained in {rf_train_time:.1f}s)")

    # 3. XGBoost Regressor
    best_model = rf_model
    best_name = 'Random Forest'
    best_mae = rf_mae

    if HAS_XGBOOST:
        print("\nTraining XGBoost Regressor (n_estimators=150, max_depth=6, lr=0.08)...")
        xgb_model = XGBRegressor(
            n_estimators=150,
            max_depth=6,
            learning_rate=0.08,
            subsample=0.85,
            colsample_bytree=0.85,
            n_jobs=-1,
            random_state=42,
        )
        t0 = time.time()
        xgb_model.fit(X_train, y_train)
        xgb_train_time = time.time() - t0

        xgb_pred = xgb_model.predict(X_eval)
        xgb_mae = mean_absolute_error(y_eval, xgb_pred)
        xgb_rmse = np.sqrt(mean_squared_error(y_eval, xgb_pred))
        xgb_r2 = r2_score(y_eval, xgb_pred)
        xgb_smape = calculate_smape(y_eval, xgb_pred)
        xgb_mape = safe_mape(y_eval, xgb_pred)

        results['XGBoost'] = {
            'mae': round(float(xgb_mae), 4),
            'rmse': round(float(xgb_rmse), 4),
            'r2': round(float(xgb_r2), 4),
            'smape': round(float(xgb_smape), 2),
            'mape': round(float(xgb_mape), 2),
            'train_time_sec': round(xgb_train_time, 2),
        }
        print(f"  -> XGBoost MAE: {xgb_mae:.4f} | RMSE: {xgb_rmse:.4f} | R²: {xgb_r2:.4f} | SMAPE: {xgb_smape:.2f}% (Trained in {xgb_train_time:.1f}s)")

        if xgb_mae < best_mae:
            best_model = xgb_model
            best_name = 'XGBoost'
            best_mae = xgb_mae

    print(f"\n[BEST] Selected Model: {best_name} (Primary Selection Metric: MAE = {best_mae:.4f})")

    # Serialize Best Model and Config
    demand_model_file = os.path.join(models_dir, 'demand_model.joblib')
    config_file = os.path.join(models_dir, 'demand_feature_config.joblib')

    joblib.dump(best_model, demand_model_file)
    joblib.dump({
        'features': FEATURE_COLUMNS,
        'target': TARGET_COLUMN,
        'model_name': best_name,
        'operating_hours': 16.0,
    }, config_file)

    print(f"Saved demand forecasting model to: {demand_model_file}")

    return {
        'model_name': best_name,
        'results': results,
        'sample_series': sample_series,
        'train_samples': len(X_train),
        'eval_samples': len(X_eval),
    }

# ── 2. Spoilage Risk Classification Model ────────────────────────────────────

def train_spoilage_model(data_dir: str, models_dir: str):
    print("\n" + "="*65)
    print("  PHASE 2: Training Spoilage Risk Model (Operational Dataset)")
    print("="*65)

    spoilage_csv = os.path.join(data_dir, 'spoilage_operational_data.csv')
    if not os.path.exists(spoilage_csv):
        from generate_operational_data import generate_spoilage_data
        df = generate_spoilage_data()
        df.to_csv(spoilage_csv, index=False)
    else:
        df = pd.read_csv(spoilage_csv)

    print(f"Loaded operational spoilage dataset: {len(df):,} records")

    feature_cols = [
        'days_to_expiry',
        'product_shelf_life',
        'inventory_quantity',
        'stock_age',
        'temperature_exposure',
        'historical_spoilage_rate',
        'storage_condition',
    ]
    target_col = 'spoilage_risk'

    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Training XGBoost/RandomForest Spoilage Classifier (Train: {len(X_train):,}, Test: {len(X_test):,})...")
    
    if HAS_XGBOOST:
        clf = XGBClassifier(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.1,
            scale_pos_weight=1.2, # slight emphasis on high recall for perishable risk
            random_state=42,
            eval_metric='logloss',
        )
        model_type = 'XGBClassifier'
    else:
        clf = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            class_weight='balanced',
            random_state=42,
        )
        model_type = 'RandomForestClassifier'

    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_prob = clf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred).tolist()

    spoilage_metrics = {
        'accuracy': round(float(acc), 4),
        'precision': round(float(prec), 4),
        'recall': round(float(rec), 4),
        'f1_score': round(float(f1), 4),
        'roc_auc': round(float(auc), 4),
        'confusion_matrix': cm,
    }

    print(f"  -> Accuracy: {acc:.4f} | Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f} | ROC-AUC: {auc:.4f}")

    spoilage_file = os.path.join(models_dir, 'spoilage_model.joblib')
    joblib.dump({
        'model': clf,
        'features': feature_cols,
        'model_type': model_type,
        'metrics': spoilage_metrics,
        'risk_thresholds': {
            'LOW': 0.25,
            'MEDIUM': 0.55,
            'HIGH': 0.80,
            'CRITICAL': 1.00,
        }
    }, spoilage_file)

    print(f"Saved spoilage model to: {spoilage_file}")

    return {
        'model_type': model_type,
        'features': feature_cols,
        'metrics': spoilage_metrics,
    }

# ── 3. Anomaly Detection Model ────────────────────────────────────────────────

def train_anomaly_model(data_dir: str, models_dir: str):
    print("\n" + "="*65)
    print("  PHASE 3: Training Anomaly Detection Model (Isolation Forest)")
    print("="*65)

    anomaly_csv = os.path.join(data_dir, 'anomaly_operational_data.csv')
    if not os.path.exists(anomaly_csv):
        from generate_operational_data import generate_anomaly_data
        df = generate_anomaly_data()
        df.to_csv(anomaly_csv, index=False)
    else:
        df = pd.read_csv(anomaly_csv)

    feature_cols = [
        'recent_sales',
        'rolling_mean',
        'rolling_std',
        'sales_change',
        'inventory_change',
        'stockout_ratio',
    ]

    X = df[feature_cols]

    print(f"Fitting Isolation Forest on {len(X):,} operational patterns (contamination=0.05)...")
    iso_forest = IsolationForest(
        n_estimators=120,
        contamination=0.05,
        max_samples='auto',
        random_state=42,
        n_jobs=-1,
    )
    iso_forest.fit(X)

    # Inspect decision function threshold
    scores = iso_forest.decision_function(X)
    preds = iso_forest.predict(X)
    anomaly_rate = float(np.mean(preds == -1))

    print(f"  -> Anomaly Detection Rate: {anomaly_rate:.2%} (Decision Score Range: [{scores.min():.3f}, {scores.max():.3f}])")

    anomaly_file = os.path.join(models_dir, 'anomaly_model.joblib')
    joblib.dump({
        'model': iso_forest,
        'features': feature_cols,
        'algorithm': 'IsolationForest',
        'contamination': 0.05,
        'score_thresholds': {
            'CRITICAL': -0.15,
            'HIGH': -0.05,
            'MEDIUM': 0.00,
            'LOW': 0.05,
        }
    }, anomaly_file)

    print(f"Saved anomaly model to: {anomaly_file}")

    return {
        'algorithm': 'IsolationForest',
        'features': feature_cols,
        'anomaly_rate': round(anomaly_rate, 4),
        'records_trained': len(X),
    }

# ── Main Pipeline Execution ───────────────────────────────────────────────────

def run_pipeline():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, 'data')
    models_dir = os.path.join(base_dir, 'models')

    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    t_start = time.time()

    demand_summary = train_demand_forecasting(data_dir, models_dir, sample_series=1200)
    spoilage_summary = train_spoilage_model(data_dir, models_dir)
    anomaly_summary = train_anomaly_model(data_dir, models_dir)

    total_time = time.time() - t_start

    # Save comprehensive metadata
    metadata = {
        'version': '1.0.0',
        'training_timestamp': datetime.now().isoformat(),
        'pipeline_duration_sec': round(total_time, 2),
        'dataset': {
            'name': 'FreshRetailNet-50K',
            'source': 'Dingdong-Inc/FreshRetailNet-50K',
            'license': 'CC BY 4.0',
            'train_records_used': demand_summary['train_samples'],
            'eval_records_used': demand_summary['eval_samples'],
            'sampled_series_count': demand_summary['sample_series'],
        },
        'demand_model': {
            'selected_model': demand_summary['model_name'],
            'features': FEATURE_COLUMNS,
            'target': TARGET_COLUMN,
            'results': demand_summary['results'],
        },
        'spoilage_model': spoilage_summary,
        'anomaly_model': anomaly_summary,
    }

    meta_path = os.path.join(models_dir, 'model_metadata.json')
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print("\n" + "="*65)
    print(f"  ALL MODELS TRAINED & SERIALIZED IN {total_time:.1f}s")
    print(f"  Metadata saved to: {meta_path}")
    print("="*65 + "\n")

if __name__ == '__main__':
    run_pipeline()
