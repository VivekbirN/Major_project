import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from preprocess import build_inference_features, FEATURE_COLUMNS

# ── Global Models Container ───────────────────────────────────────────────────
ml_assets = {
    'demand_model': None,
    'demand_config': None,
    'spoilage_model': None,
    'anomaly_model': None,
    'metadata': None,
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')

def load_artifacts():
    print(f"Loading ML models from: {MODELS_DIR}")
    
    # 1. Demand Model
    demand_path = os.path.join(MODELS_DIR, 'demand_model.joblib')
    config_path = os.path.join(MODELS_DIR, 'demand_feature_config.joblib')
    if os.path.exists(demand_path):
        ml_assets['demand_model'] = joblib.load(demand_path)
        print("  [OK] Demand forecasting model loaded")
    if os.path.exists(config_path):
        ml_assets['demand_config'] = joblib.load(config_path)

    # 2. Spoilage Model
    spoilage_path = os.path.join(MODELS_DIR, 'spoilage_model.joblib')
    if os.path.exists(spoilage_path):
        ml_assets['spoilage_model'] = joblib.load(spoilage_path)
        print("  [OK] Spoilage risk model loaded")

    # 3. Anomaly Model
    anomaly_path = os.path.join(MODELS_DIR, 'anomaly_model.joblib')
    if os.path.exists(anomaly_path):
        ml_assets['anomaly_model'] = joblib.load(anomaly_path)
        print("  [OK] Anomaly detection model loaded")

    # 4. Metadata
    meta_path = os.path.join(MODELS_DIR, 'model_metadata.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r') as f:
            ml_assets['metadata'] = json.load(f)

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield

app = FastAPI(
    title="FoodChain AI — Machine Learning Inference Service",
    description="Stockout-aware demand forecasting, spoilage risk classification, and anomaly detection API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Request & Response Schemas ─────────────────────────────────────────

class WeatherInfo(BaseModel):
    temperature: Optional[float] = Field(22.0, description="Average temperature in Celsius")
    humidity: Optional[float] = Field(65.0, description="Relative humidity percentage")
    precipitation: Optional[float] = Field(0.0, description="Precipitation in mm")
    wind_level: Optional[float] = Field(1.5, description="Average wind scale")

class DemandPredictionRequest(BaseModel):
    node_id: int = Field(..., description="Target node ID")
    product_id: int = Field(..., description="Target product ID")
    historical_sales: List[float] = Field(..., description="Chronological recent sales series (at least 7 days)")
    discount: Optional[float] = Field(1.0, ge=0.0, le=1.0, description="Price discount factor (1.0 = full price)")
    holiday_flag: Optional[int] = Field(0, description="1 if holiday, 0 otherwise")
    activity_flag: Optional[int] = Field(0, description="1 if marketing promotion/event active, 0 otherwise")
    weather: Optional[WeatherInfo] = Field(default_factory=WeatherInfo)
    stockout_hours: Optional[float] = Field(0.0, ge=0.0, le=16.0, description="Recorded stockout hours during day")
    forecast_date: Optional[str] = Field(None, description="ISO date string for forecast target day")

class SpoilagePredictionRequest(BaseModel):
    days_to_expiry: float = Field(..., description="Remaining shelf life in days")
    product_shelf_life: float = Field(..., gt=0, description="Total expected shelf life in days")
    inventory_quantity: int = Field(..., ge=0, description="Current stock quantity in units")
    stock_age: Optional[float] = Field(0.0, ge=0, description="Days since inventory was received")
    temperature_exposure: Optional[float] = Field(1.0, ge=0.5, le=3.0, description="Cold chain temperature multiplier")
    historical_spoilage_rate: Optional[float] = Field(0.10, ge=0.0, le=1.0, description="Category loss rate")
    storage_condition: Optional[int] = Field(0, description="0=Optimal Cold Chain, 1=Standard Chilled, 2=Ambient")

class AnomalyDetectionRequest(BaseModel):
    recent_sales: float = Field(..., ge=0, description="Most recent sales volume (units)")
    rolling_mean: float = Field(..., ge=0, description="Historical 7-day average sales (units)")
    rolling_std: Optional[float] = Field(None, description="Historical 7-day standard deviation")
    inventory_change: Optional[float] = Field(0.0, description="Daily change in inventory units")
    stockout_ratio: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Fraction of operating hours out of stock")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FoodChain AI ML Service",
        "models_loaded": {
            "demand": ml_assets['demand_model'] is not None,
            "spoilage": ml_assets['spoilage_model'] is not None,
            "anomaly": ml_assets['anomaly_model'] is not None,
        },
        "model_versions": {
            "demand": ml_assets['demand_config'].get('model_name', 'Trained') if ml_assets['demand_config'] else None,
            "spoilage": ml_assets['spoilage_model'].get('model_type', 'Trained') if ml_assets['spoilage_model'] else None,
            "anomaly": "IsolationForest" if ml_assets['anomaly_model'] else None,
        }
    }

@app.get("/health/models")
def get_model_metadata():
    if not ml_assets['metadata']:
        raise HTTPException(status_code=404, detail="Model metadata not loaded")
    return ml_assets['metadata']

@app.post("/predict/demand")
def predict_demand(payload: DemandPredictionRequest):
    if ml_assets['demand_model'] is None:
        raise HTTPException(status_code=503, detail="Demand forecasting model is not loaded. Run train_models.py first.")

    try:
        weather = payload.weather or WeatherInfo()
        X_df = build_inference_features(
            historical_sales=payload.historical_sales,
            discount=payload.discount,
            holiday_flag=payload.holiday_flag,
            activity_flag=payload.activity_flag,
            precpt=weather.precipitation or 0.0,
            avg_temperature=weather.temperature or 22.0,
            avg_humidity=weather.humidity or 65.0,
            avg_wind_level=weather.wind_level or 1.5,
            stockout_hours=payload.stockout_hours or 0.0,
            forecast_date=payload.forecast_date,
        )

        model = ml_assets['demand_model']
        pred_raw = float(model.predict(X_df)[0])
        predicted_demand = max(round(pred_raw, 1), 0.0)

        # Baseline 7-day average for comparison
        recent_series = payload.historical_sales[-7:] if len(payload.historical_sales) >= 7 else payload.historical_sales
        baseline_7d = float(np.mean(recent_series)) if recent_series else predicted_demand
        
        pct_change = round(((predicted_demand - baseline_7d) / max(baseline_7d, 1.0)) * 100.0, 1)

        model_name = ml_assets['demand_config'].get('model_name', 'XGBoost / Random Forest') if ml_assets['demand_config'] else 'Trained Regressor'

        return {
            "success": True,
            "prediction": {
                "node_id": payload.node_id,
                "product_id": payload.product_id,
                "forecast_horizon": "next_day",
                "predicted_demand": predicted_demand,
                "unit": "units",
                "baseline_7d_avg": round(baseline_7d, 1),
                "expected_pct_change": pct_change,
            },
            "model": {
                "name": model_name,
                "version": "1.0.0",
                "features_used": len(FEATURE_COLUMNS),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Demand inference failed: {str(e)}")

@app.post("/predict/spoilage")
def predict_spoilage(payload: SpoilagePredictionRequest):
    if ml_assets['spoilage_model'] is None:
        raise HTTPException(status_code=503, detail="Spoilage model is not loaded. Run train_models.py first.")

    try:
        model_obj = ml_assets['spoilage_model']
        clf = model_obj['model']
        feature_cols = model_obj['features']

        stock_age = payload.stock_age if payload.stock_age is not None else max(payload.product_shelf_life - payload.days_to_expiry, 0.0)

        input_row = pd.DataFrame([{
            'days_to_expiry': float(payload.days_to_expiry),
            'product_shelf_life': float(payload.product_shelf_life),
            'inventory_quantity': int(payload.inventory_quantity),
            'stock_age': float(stock_age),
            'temperature_exposure': float(payload.temperature_exposure or 1.0),
            'historical_spoilage_rate': float(payload.historical_spoilage_rate or 0.1),
            'storage_condition': int(payload.storage_condition or 0),
        }])[feature_cols]

        prob = float(clf.predict_proba(input_row)[0][1])

        # Map to Risk Level
        if prob < 0.25:
            risk_level = "LOW"
        elif prob < 0.55:
            risk_level = "MEDIUM"
        elif prob < 0.80:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        shelf_depleted = min(max((1.0 - (payload.days_to_expiry / max(payload.product_shelf_life, 1.0))) * 100.0, 0.0), 100.0)

        return {
            "success": True,
            "prediction": {
                "risk_probability": round(prob, 4),
                "risk_level": risk_level,
                "is_high_risk": risk_level in ["HIGH", "CRITICAL"],
                "shelf_life_depleted_pct": round(shelf_depleted, 1),
            },
            "model": {
                "name": model_obj.get('model_type', 'XGBClassifier'),
                "version": "1.0.0",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Spoilage inference failed: {str(e)}")

@app.post("/detect/anomaly")
def detect_anomaly(payload: AnomalyDetectionRequest):
    if ml_assets['anomaly_model'] is None:
        raise HTTPException(status_code=503, detail="Anomaly detection model is not loaded. Run train_models.py first.")

    try:
        model_obj = ml_assets['anomaly_model']
        iso_forest = model_obj['model']
        feature_cols = model_obj['features']

        rolling_std = payload.rolling_std if payload.rolling_std is not None else max(payload.rolling_mean * 0.2, 1.0)
        sales_change = (payload.recent_sales - payload.rolling_mean) / max(payload.rolling_mean, 1.0)

        input_row = pd.DataFrame([{
            'recent_sales': float(payload.recent_sales),
            'rolling_mean': float(payload.rolling_mean),
            'rolling_std': float(rolling_std),
            'sales_change': float(sales_change),
            'inventory_change': float(payload.inventory_change or 0.0),
            'stockout_ratio': float(payload.stockout_ratio or 0.0),
        }])[feature_cols]

        raw_score = float(iso_forest.decision_function(input_row)[0])
        is_anomaly = bool(iso_forest.predict(input_row)[0] == -1)

        # Characterize severity and anomaly type
        if is_anomaly:
            if raw_score < -0.10:
                severity = "CRITICAL"
            elif raw_score < -0.05:
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            if payload.recent_sales > payload.rolling_mean * 2.5:
                anomaly_type = "DEMAND_SPIKE"
                message = f"Significant demand spike ({payload.recent_sales:.0f} units vs {payload.rolling_mean:.0f} 7-day avg)"
            elif payload.recent_sales < payload.rolling_mean * 0.25 and payload.rolling_mean > 10:
                anomaly_type = "DEMAND_DROP"
                message = f"Unusual demand collapse ({payload.recent_sales:.0f} units vs {payload.rolling_mean:.0f} 7-day avg)"
            elif (payload.stockout_ratio or 0) > 0.6:
                anomaly_type = "EXPIRY_OR_STOCKOUT_RISK"
                message = f"Severe stockout duration ({payload.stockout_ratio:.0%} of operating hours)"
            else:
                anomaly_type = "SUPPLY_INCONSISTENCY"
                message = "Irregular sales velocity and stock balance pattern detected"
        else:
            severity = "LOW"
            anomaly_type = "NORMAL"
            message = "Operating metrics within historical statistical bounds"

        return {
            "success": True,
            "anomaly": {
                "is_anomaly": is_anomaly,
                "score": round(raw_score, 4),
                "severity": severity,
                "anomaly_type": anomaly_type,
                "message": message,
            },
            "model": {
                "name": "IsolationForest",
                "version": "1.0.0",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("ml_service:app", host="0.0.0.0", port=8000, reload=False)
