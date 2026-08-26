import os
import numpy as np
import pandas as pd

def generate_spoilage_data(num_samples: int = 15000, random_state: int = 42) -> pd.DataFrame:
    """
    Generate realistic operational data for the FoodChain AI spoilage risk classification model.
    
    Academic Note: FreshRetailNet-50K is a demand/stockout dataset without spoilage ground-truth labels.
    This operational dataset simulates supply-chain inventory decay physics based on:
    - days_to_expiry: Remaining shelf life
    - product_shelf_life: Total shelf life of SKU
    - inventory_quantity: Current batch volume
    - stock_age: Days since receiving
    - temperature_exposure: Temperature deviation factor (>1.0 = warm abuse)
    - historical_spoilage_rate: Category baseline loss rate
    - storage_condition: 0=Cold Chain (Optimal), 1=Standard Chilled, 2=Ambient
    """
    np.random.seed(random_state)
    
    # 1. Product shelf lives (days): Dairy (5-14), Bakery (3-7), Produce (4-10), Meat (3-8), Pantry (30-180)
    shelf_life_choices = np.random.choice([3, 5, 7, 10, 14, 21, 30, 90, 180], size=num_samples, p=[0.1, 0.2, 0.25, 0.2, 0.1, 0.05, 0.04, 0.03, 0.03])
    product_shelf_life = shelf_life_choices.astype(float)
    
    # 2. Stock age (days batch has been held)
    stock_age = np.array([np.random.uniform(0, sl * 1.1) for sl in product_shelf_life])
    
    # 3. Days to expiry (can be negative if already expired)
    days_to_expiry = (product_shelf_life - stock_age) + np.random.normal(0, 0.5, size=num_samples)
    days_to_expiry = np.round(days_to_expiry, 1)
    
    # 4. Inventory quantity (units)
    inventory_quantity = np.random.exponential(scale=150, size=num_samples).astype(int) + 5
    
    # 5. Temperature exposure index (1.0 = normal, >1.3 = severe heat excursion)
    temp_exposure = np.random.gamma(shape=20, scale=0.05, size=num_samples) # centered near 1.0
    temp_exposure = np.clip(temp_exposure, 0.7, 2.5)
    
    # 6. Historical baseline spoilage rate for category
    historical_spoilage_rate = np.random.beta(a=2, b=15, size=num_samples) # centered around 0.08 - 0.15
    
    # 7. Storage condition: 0=Optimal Cold Chain, 1=Standard Chilled, 2=Ambient/Suboptimal
    storage_condition = np.random.choice([0, 1, 2], size=num_samples, p=[0.6, 0.3, 0.1])
    
    # 8. True Latent Spoilage Risk Probability Calculation (Logistic formulation)
    # Risk increases sharply when days_to_expiry <= 2, temp > 1.2, storage condition is poor
    shelf_fraction = np.clip(days_to_expiry / np.maximum(product_shelf_life, 1.0), -1.0, 2.0)
    
    log_odds = (
        - 3.5 * shelf_fraction
        + 2.2 * (temp_exposure - 1.0)
        + 1.8 * (storage_condition / 2.0)
        + 4.0 * historical_spoilage_rate
        + 0.5 * (inventory_quantity > 300).astype(float) # large batches spoil faster if slow-moving
        - 0.8 # base intercept
    )
    
    # Convert to probability
    prob = 1.0 / (1.0 + np.exp(-log_odds))
    
    # Ground truth binary label with slight measurement noise
    spoilage_risk = (np.random.rand(num_samples) < prob).astype(int)
    
    df = pd.DataFrame({
        'days_to_expiry': days_to_expiry,
        'product_shelf_life': product_shelf_life,
        'inventory_quantity': inventory_quantity,
        'stock_age': np.round(stock_age, 1),
        'temperature_exposure': np.round(temp_exposure, 2),
        'historical_spoilage_rate': np.round(historical_spoilage_rate, 3),
        'storage_condition': storage_condition,
        'spoilage_risk': spoilage_risk
    })
    
    return df


def generate_anomaly_data(num_samples: int = 12000, random_state: int = 42) -> pd.DataFrame:
    """
    Generate normal and anomalous operational pattern features for training Isolation Forest.
    Features:
    - recent_sales: Last 24h / 1-day sales
    - rolling_mean: 7-day average sales
    - rolling_std: 7-day sales standard deviation
    - sales_change: (recent_sales - rolling_mean) / (rolling_mean + 1)
    - inventory_change: Daily delta in inventory
    - stockout_ratio: Stockout fraction (0 to 1)
    """
    np.random.seed(random_state)
    
    # Baseline normal distributions
    rolling_mean = np.random.gamma(shape=10, scale=5, size=num_samples) # 20 - 100 units
    rolling_std = rolling_mean * np.random.uniform(0.1, 0.3, size=num_samples)
    
    recent_sales = np.random.normal(loc=rolling_mean, scale=rolling_std)
    recent_sales = np.maximum(recent_sales, 0.0)
    
    stockout_ratio = np.random.beta(a=1, b=8, size=num_samples)
    inventory_change = -recent_sales + np.random.choice([0, 50, 100, 200], size=num_samples, p=[0.7, 0.15, 0.1, 0.05])
    
    # Inject 5% realistic operational anomalies
    anomaly_mask = np.random.rand(num_samples) < 0.05
    
    # Type 1: Massive demand spike (e.g. panic buying, viral promotion)
    spike_idx = anomaly_mask & (np.random.rand(num_samples) < 0.4)
    recent_sales[spike_idx] = rolling_mean[spike_idx] * np.random.uniform(3.5, 6.0, size=np.sum(spike_idx))
    
    # Type 2: Sudden unexplained demand drop to 0 with high inventory
    drop_idx = anomaly_mask & ~spike_idx & (np.random.rand(num_samples) < 0.5)
    recent_sales[drop_idx] = 0.0
    
    # Type 3: Extreme phantom stockout (high stockout ratio despite moderate sales)
    stockout_idx = anomaly_mask & ~spike_idx & ~drop_idx
    stockout_ratio[stockout_idx] = np.random.uniform(0.85, 1.0, size=np.sum(stockout_idx))

    sales_change = (recent_sales - rolling_mean) / (rolling_mean + 1.0)
    
    df = pd.DataFrame({
        'recent_sales': np.round(recent_sales, 1),
        'rolling_mean': np.round(rolling_mean, 1),
        'rolling_std': np.round(rolling_std, 2),
        'sales_change': np.round(sales_change, 3),
        'inventory_change': np.round(inventory_change, 1),
        'stockout_ratio': np.round(stockout_ratio, 3),
    })
    
    return df


if __name__ == '__main__':
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    print("Generating simulated operational spoilage dataset...")
    df_spoilage = generate_spoilage_data()
    spoilage_path = os.path.join(data_dir, 'spoilage_operational_data.csv')
    df_spoilage.to_csv(spoilage_path, index=False)
    print(f"Saved {len(df_spoilage):,} spoilage records to {spoilage_path}")
    print(f"Spoilage positive class balance: {df_spoilage['spoilage_risk'].mean():.2%}")
    
    print("\nGenerating anomaly detection training dataset...")
    df_anomaly = generate_anomaly_data()
    anomaly_path = os.path.join(data_dir, 'anomaly_operational_data.csv')
    df_anomaly.to_csv(anomaly_path, index=False)
    print(f"Saved {len(df_anomaly):,} anomaly records to {anomaly_path}")
