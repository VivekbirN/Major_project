# ML Layer — FoodChain AI

> **⚠️ This module is not yet implemented. It will be built in Part 3.**

## Planned Components

### `ml_service.py` — FastAPI Inference Server (Port 8000)
Serves trained Scikit-Learn / XGBoost models for:
- Demand forecasting
- Spoilage risk prediction
- Redistribution optimization
- Anomaly detection

### `train_models.py` — Model Training Pipeline
Trains ML models using historical sales, inventory, and spoilage data from MySQL.

### `generate_data.py` — Synthetic Data Generation
Generates realistic training data for initial model bootstrapping.

### `spark_analytics.py` — PySpark Analytics Engine
Distributed analytics jobs for large-scale inventory and logistics datasets.

### `models/` — Serialized Model Artifacts
Stores trained `.joblib` model files (gitignored).

## Setup (Future)

```bash
cd ml
python -m venv venv
venv\Scripts\activate     # Windows
pip install fastapi uvicorn scikit-learn xgboost pandas numpy pydantic pyspark

python train_models.py    # Train models
python ml_service.py      # Start FastAPI server on port 8000
```

## API Endpoints (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict/demand` | Demand forecasting per node/product |
| POST | `/predict/spoilage` | Spoilage risk scoring |
| POST | `/optimize/redistribution` | Transfer plan generation |
| POST | `/detect/anomaly` | Anomaly detection |
| POST | `/analytics/waste-report` | PySpark waste analytics |
