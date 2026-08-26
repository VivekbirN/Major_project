import os
import json
import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def generate_evaluation_report():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(base_dir, 'models')
    meta_path = os.path.join(models_dir, 'model_metadata.json')
    notebooks_dir = os.path.join(base_dir, 'notebooks')
    os.makedirs(notebooks_dir, exist_ok=True)

    if not os.path.exists(meta_path):
        print(f"Error: {meta_path} not found. Please run train_models.py first.")
        return

    with open(meta_path, 'r') as f:
        meta = json.load(f)

    print("\n" + "="*70)
    print("           FOODCHAIN AI — MODEL EVALUATION & BENCHMARK REPORT")
    print("="*70)
    print(f"Timestamp:       {meta.get('training_timestamp')}")
    print(f"Dataset:         {meta['dataset']['name']} ({meta['dataset']['source']})")
    print(f"Records Used:    Train: {meta['dataset']['train_records_used']:,} | Eval: {meta['dataset']['eval_records_used']:,}")
    print(f"Store-SKU Pairs: {meta['dataset']['sampled_series_count']:,}")
    print("-"*70)

    # 1. Demand Forecasting Model Comparison
    print("\n[1] DEMAND FORECASTING REGRESSION BENCHMARK")
    print(f"{'Model':<22} | {'MAE':<8} | {'RMSE':<8} | {'R²':<8} | {'SMAPE (%)':<10}")
    print("-"*70)

    demand_results = meta['demand_model']['results']
    models_list = []
    maes = []
    rmses = []
    r2s = []

    for model_name, metrics in demand_results.items():
        print(f"{model_name:<22} | {metrics['mae']:<8.4f} | {metrics['rmse']:<8.4f} | {metrics['r2']:<8.4f} | {metrics['smape']:<10.2f}")
        models_list.append(model_name)
        maes.append(metrics['mae'])
        rmses.append(metrics['rmse'])
        r2s.append(metrics['r2'])

    print(f"\nSelected Primary Model: {meta['demand_model']['selected_model']}")
    print(f"Feature Count:         {len(meta['demand_model']['features'])}")

    # 2. Spoilage Model Report
    print("\n" + "-"*70)
    print("[2] SPOILAGE RISK CLASSIFIER REPORT")
    spoilage = meta['spoilage_model']
    print(f"Model Architecture:    {spoilage['model_type']}")
    print(f"Accuracy:              {spoilage['metrics']['accuracy']:.4f}")
    print(f"Precision:             {spoilage['metrics']['precision']:.4f}")
    print(f"Recall (High Priority):{spoilage['metrics']['recall']:.4f}")
    print(f"F1-Score:              {spoilage['metrics']['f1_score']:.4f}")
    print(f"ROC-AUC:               {spoilage['metrics']['roc_auc']:.4f}")
    print(f"Confusion Matrix:      {spoilage['metrics']['confusion_matrix']}")

    # 3. Anomaly Model Report
    print("\n" + "-"*70)
    print("[3] ANOMALY DETECTION REPORT")
    anomaly = meta['anomaly_model']
    print(f"Algorithm:             {anomaly['algorithm']}")
    print(f"Features:              {', '.join(anomaly['features'])}")
    print(f"Detected Anomaly Rate: {anomaly['anomaly_rate']:.2%}")
    print(f"Records Evaluated:     {anomaly['records_trained']:,}")

    # Generate Chart Visualization
    try:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        
        # MAE & RMSE comparison
        x = np.arange(len(models_list))
        width = 0.35
        axes[0].bar(x - width/2, maes, width, label='MAE (Lower is better)', color='#6366f1')
        axes[0].bar(x + width/2, rmses, width, label='RMSE (Lower is better)', color='#22d3ee')
        axes[0].set_ylabel('Error Score')
        axes[0].set_title('Demand Model Error Comparison (MAE vs RMSE)')
        axes[0].set_xticks(x)
        axes[0].set_xticklabels(models_list, rotation=15)
        axes[0].legend()
        axes[0].grid(axis='y', linestyle='--', alpha=0.3)

        # R² comparison
        axes[1].bar(models_list, r2s, color='#34d399', width=0.45)
        axes[1].set_ylabel('R² Score (Higher is better)')
        axes[1].set_title('Demand Model R² Goodness-of-Fit')
        axes[1].set_xticklabels(models_list, rotation=15)
        axes[1].grid(axis='y', linestyle='--', alpha=0.3)

        plt.tight_layout()
        chart_path = os.path.join(notebooks_dir, 'model_comparison.png')
        plt.savefig(chart_path, dpi=150)
        plt.close()
        print(f"\nSaved benchmark comparison chart to: {chart_path}")
    except Exception as e:
        print(f"Chart generation note: {e}")

    print("="*70 + "\n")

if __name__ == '__main__':
    generate_evaluation_report()
