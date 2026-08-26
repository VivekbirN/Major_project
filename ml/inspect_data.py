import os
import pandas as pd
import numpy as np

def inspect():
    train_path = os.path.join(os.path.dirname(__file__), 'data', 'train.parquet')
    if not os.path.exists(train_path):
        train_path = 'train.parquet'
    
    eval_path = os.path.join(os.path.dirname(__file__), 'data', 'eval.parquet')
    if not os.path.exists(eval_path):
        eval_path = 'eval.parquet'

    print("="*60)
    print("  FreshRetailNet-50K Dataset Inspection")
    print("="*60)

    print(f"Reading train dataset from: {train_path}")
    df_train = pd.read_parquet(train_path)
    print(f"Train Shape: {df_train.shape[0]:,} rows x {df_train.shape[1]} columns")

    print(f"\nReading eval dataset from: {eval_path}")
    df_eval = pd.read_parquet(eval_path)
    print(f"Eval Shape: {df_eval.shape[0]:,} rows x {df_eval.shape[1]} columns")

    print("\n--- Train Columns & Types ---")
    for col, dtype in df_train.dtypes.items():
        print(f"  {col:25} {str(dtype):15} (nulls: {df_train[col].isna().sum():,})")

    print("\n--- First 3 Sample Rows ---")
    print(df_train.head(3).T)

    print("\n--- Basic Statistics ---")
    stores = df_train['store_id'].nunique() if 'store_id' in df_train.columns else 'N/A'
    products = df_train['product_id'].nunique() if 'product_id' in df_train.columns else 'N/A'
    cities = df_train['city_id'].nunique() if 'city_id' in df_train.columns else 'N/A'
    
    print(f"Unique Stores:   {stores}")
    print(f"Unique Products: {products}")
    print(f"Unique Cities:   {cities}")

    if 'dt' in df_train.columns:
        print(f"Train Date Range: {df_train['dt'].min()} to {df_train['dt'].max()}")
    if 'dt' in df_eval.columns:
        print(f"Eval Date Range:  {df_eval['dt'].min()} to {df_eval['dt'].max()}")

    if 'sale_amount' in df_train.columns:
        print(f"Sale Amount: min={df_train['sale_amount'].min()}, max={df_train['sale_amount'].max()}, mean={df_train['sale_amount'].mean():.4f}, median={df_train['sale_amount'].median():.4f}")

    if 'hours_stock_status' in df_train.columns:
        print(f"Sample hours_stock_status: {df_train['hours_stock_status'].head(3).tolist()}")
    if 'stock_hour6_22_cnt' in df_train.columns:
        print(f"Stockout count summary: min={df_train['stock_hour6_22_cnt'].min()}, max={df_train['stock_hour6_22_cnt'].max()}, mean={df_train['stock_hour6_22_cnt'].mean():.4f}")

    print("="*60)

if __name__ == '__main__':
    inspect()
