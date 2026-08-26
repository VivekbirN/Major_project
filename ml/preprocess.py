import os
import pandas as pd
import numpy as np

OPERATING_HOURS = 16.0  # 6:00 to 22:00

def handle_stockout(df: pd.DataFrame) -> pd.DataFrame:
    """
    Stockout-aware demand adjustment.
    When product was unavailable during operating hours (stock_hour6_22_cnt > 0),
    observed sales underestimate true latent demand.
    We compute stockout_ratio and adjusted_demand.
    """
    df = df.copy()
    
    # Extract stockout hours from stock_hour6_22_cnt if present
    if 'stock_hour6_22_cnt' in df.columns:
        df['stockout_hours'] = df['stock_hour6_22_cnt'].clip(0, int(OPERATING_HOURS))
    else:
        df['stockout_hours'] = 0.0

    df['stockout_ratio'] = df['stockout_hours'] / OPERATING_HOURS
    df['is_stockout'] = (df['stockout_hours'] > 0).astype(int)
    
    # Adjust observed sales to account for censored stockout periods
    # Available hours during operating window = 16 - stockout_hours
    available_hours = (OPERATING_HOURS - df['stockout_hours']).clip(lower=2.0)
    
    if 'sale_amount' in df.columns:
        # If stockout occurred, extrapolate hourly sales rate to full operating day
        adjustment_factor = np.where(
            df['is_stockout'] == 1,
            OPERATING_HOURS / available_hours,
            1.0
        )
        df['adjusted_demand'] = (df['sale_amount'] * adjustment_factor).round(2)
    else:
        df['adjusted_demand'] = 0.0

    return df


def engineer_features(df: pd.DataFrame, is_training: bool = True) -> pd.DataFrame:
    """
    Generate time-series, calendar, business, and weather features.
    """
    df = df.copy()

    # Ensure date format
    if 'dt' in df.columns:
        df['dt'] = pd.to_datetime(df['dt'])
        df['day_of_week'] = df['dt'].dt.dayofweek
        df['day_of_month'] = df['dt'].dt.day
        df['month'] = df['dt'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    else:
        df['day_of_week'] = 0
        df['day_of_month'] = 1
        df['month'] = 1
        df['is_weekend'] = 0

    # Ensure business features exist
    if 'discount' not in df.columns:
        df['discount'] = 1.0
    else:
        df['discount'] = df['discount'].fillna(1.0)

    if 'holiday_flag' not in df.columns:
        df['holiday_flag'] = 0
    else:
        df['holiday_flag'] = df['holiday_flag'].fillna(0).astype(int)

    if 'activity_flag' not in df.columns:
        df['activity_flag'] = 0
    else:
        df['activity_flag'] = df['activity_flag'].fillna(0).astype(int)

    # Weather features
    for col, default_val in [
        ('precpt', 0.0),
        ('avg_temperature', 22.0),
        ('avg_humidity', 65.0),
        ('avg_wind_level', 1.5),
    ]:
        if col not in df.columns:
            df[col] = default_val
        else:
            df[col] = df[col].fillna(default_val)

    # Apply stockout adjustment
    df = handle_stockout(df)

    # Time series lag & rolling features per (store_id, product_id)
    if is_training and 'sale_amount' in df.columns and 'store_id' in df.columns and 'product_id' in df.columns:
        df = df.sort_values(by=['store_id', 'product_id', 'dt']).reset_index(drop=True)
        grouped = df.groupby(['store_id', 'product_id'])['adjusted_demand']

        # Lags
        df['lag_1'] = grouped.shift(1).fillna(df['adjusted_demand'])
        df['lag_2'] = grouped.shift(2).fillna(df['lag_1'])
        df['lag_3'] = grouped.shift(3).fillna(df['lag_2'])
        df['lag_7'] = grouped.shift(7).fillna(df['lag_1'])
        df['lag_14'] = grouped.shift(14).fillna(df['lag_7'])

        # Rolling statistics using shifted series to avoid target leakage
        shifted = grouped.shift(1)
        df['rolling_mean_3'] = shifted.rolling(3, min_periods=1).mean().fillna(df['lag_1'])
        df['rolling_mean_7'] = shifted.rolling(7, min_periods=1).mean().fillna(df['lag_1'])
        df['rolling_mean_14'] = shifted.rolling(14, min_periods=1).mean().fillna(df['lag_7'])
        df['rolling_std_7'] = shifted.rolling(7, min_periods=1).std().fillna(0.0)

    return df


FEATURE_COLUMNS = [
    'lag_1',
    'lag_2',
    'lag_3',
    'lag_7',
    'lag_14',
    'rolling_mean_3',
    'rolling_mean_7',
    'rolling_mean_14',
    'rolling_std_7',
    'day_of_week',
    'day_of_month',
    'month',
    'is_weekend',
    'discount',
    'holiday_flag',
    'activity_flag',
    'precpt',
    'avg_temperature',
    'avg_humidity',
    'avg_wind_level',
    'stockout_ratio',
    'is_stockout',
]

TARGET_COLUMN = 'adjusted_demand'


def build_inference_features(
    historical_sales: list,
    discount: float = 1.0,
    holiday_flag: int = 0,
    activity_flag: int = 0,
    precpt: float = 0.0,
    avg_temperature: float = 22.0,
    avg_humidity: float = 65.0,
    avg_wind_level: float = 1.5,
    stockout_hours: float = 0.0,
    forecast_date: str = None,
) -> pd.DataFrame:
    """
    Construct exact feature row for real-time FastAPI inference.
    """
    sales = np.array(historical_sales if historical_sales else [10.0], dtype=float)
    
    # If historical series is short, pad with last available value
    if len(sales) < 14:
        pad_len = 14 - len(sales)
        sales = np.concatenate([np.repeat(sales[0], pad_len), sales])
    
    # Recent values from historical sales
    lag_1 = float(sales[-1])
    lag_2 = float(sales[-2])
    lag_3 = float(sales[-3])
    lag_7 = float(sales[-7])
    lag_14 = float(sales[-14])

    rolling_mean_3 = float(np.mean(sales[-3:]))
    rolling_mean_7 = float(np.mean(sales[-7:]))
    rolling_mean_14 = float(np.mean(sales[-14:]))
    rolling_std_7 = float(np.std(sales[-7:])) if len(sales) >= 7 else 0.0

    if forecast_date:
        dt = pd.to_datetime(forecast_date)
    else:
        dt = pd.Timestamp.now() + pd.Timedelta(days=1)

    day_of_week = int(dt.dayofweek)
    day_of_month = int(dt.day)
    month = int(dt.month)
    is_weekend = int(day_of_week in [5, 6])

    stockout_ratio = min(max(stockout_hours / OPERATING_HOURS, 0.0), 1.0)
    is_stockout = 1 if stockout_hours > 0 else 0

    feature_dict = {
        'lag_1': lag_1,
        'lag_2': lag_2,
        'lag_3': lag_3,
        'lag_7': lag_7,
        'lag_14': lag_14,
        'rolling_mean_3': rolling_mean_3,
        'rolling_mean_7': rolling_mean_7,
        'rolling_mean_14': rolling_mean_14,
        'rolling_std_7': rolling_std_7,
        'day_of_week': day_of_week,
        'day_of_month': day_of_month,
        'month': month,
        'is_weekend': is_weekend,
        'discount': float(discount),
        'holiday_flag': int(holiday_flag),
        'activity_flag': int(activity_flag),
        'precpt': float(precpt),
        'avg_temperature': float(avg_temperature),
        'avg_humidity': float(avg_humidity),
        'avg_wind_level': float(avg_wind_level),
        'stockout_ratio': float(stockout_ratio),
        'is_stockout': int(is_stockout),
    }

    return pd.DataFrame([feature_dict])[FEATURE_COLUMNS]


if __name__ == '__main__':
    print("Preprocessing module ready. Feature columns:", len(FEATURE_COLUMNS))
