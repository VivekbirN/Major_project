const http = require('http');
const mongoose = require('mongoose');
const { Node, Product, Inventory, SalesRecord, AnomalyAlert } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseHelper');

const FASTAPI_HOST = process.env.FASTAPI_HOST || 'localhost';
const FASTAPI_PORT = parseInt(process.env.FASTAPI_PORT) || 8000;

const isValidId = (id) => mongoose.isValidObjectId(id);

/**
 * Helper to make HTTP requests to the FastAPI ML service
 */
function callFastAPI(path, method = 'POST', payload = null) {
  return new Promise((resolve, reject) => {
    const dataString = payload ? JSON.stringify(payload) : '';
    const options = {
      hostname: FASTAPI_HOST,
      port: FASTAPI_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
      },
      timeout: 8000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.detail || `FastAPI error with status ${res.statusCode}`));
          }
        } catch {
          reject(new Error(`Failed to parse FastAPI response: ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`ML service unreachable at http://${FASTAPI_HOST}:${FASTAPI_PORT}${path}. Error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ML service request timed out'));
    });

    if (dataString) req.write(dataString);
    req.end();
  });
}

/**
 * GET /api/v1/ml/health
 */
const getMLHealth = async (req, res) => {
  try {
    const health = await callFastAPI('/health', 'GET');
    return sendSuccess(res, health, 'ML Service health check succeeded');
  } catch (error) {
    return sendError(res, error.message, 503);
  }
};

/**
 * POST /api/v1/ml/demand
 */
const getDemandForecast = async (req, res) => {
  try {
    const { role, node_id: userNodeId } = req.user;
    const {
      node_id,
      product_id,
      historical_sales,
      discount = 1.0,
      holiday_flag = 0,
      activity_flag = 0,
      weather,
      stockout_hours = 0.0,
      forecast_date,
    } = req.body;

    if (!node_id || !product_id) {
      return sendError(res, 'node_id and product_id are required', 400);
    }
    if (!isValidId(node_id) || !isValidId(product_id)) {
      return sendError(res, 'Invalid node_id or product_id', 400);
    }

    if (role === 'WAREHOUSE_ADMIN' && userNodeId.toString() !== node_id.toString()) {
      return sendError(res, 'Access denied — you can only request forecasts for your assigned node', 403);
    }

    const [node, product] = await Promise.all([
      Node.findById(node_id).select('id name type location'),
      Product.findById(product_id).select('id sku name category unit_cost'),
    ]);

    if (!node) return sendError(res, 'Node not found', 404);
    if (!product) return sendError(res, 'Product not found', 404);

    let salesSeries = historical_sales;
    if (!salesSeries || !salesSeries.length) {
      const records = await SalesRecord.find({ node_id, product_id })
        .sort({ sale_date: 1 })
        .limit(30);

      if (records.length > 0) {
        salesSeries = records.map(r => r.quantity_sold);
      } else {
        const inv = await Inventory.findOne({ node_id, product_id });
        const base = inv ? Math.max(Math.round(inv.reorder_threshold * 0.4), 10) : 25;
        salesSeries = Array.from({ length: 14 }, () => base + Math.floor(Math.random() * 8 - 4));
      }
    }

    const mlPayload = {
      node_id,
      product_id,
      historical_sales: salesSeries,
      discount: parseFloat(discount),
      holiday_flag: parseInt(holiday_flag),
      activity_flag: parseInt(activity_flag),
      weather: weather || { temperature: 24.0, humidity: 65.0, precipitation: 0.0, wind_level: 1.5 },
      stockout_hours: parseFloat(stockout_hours),
      forecast_date: forecast_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    };

    const mlResult = await callFastAPI('/predict/demand', 'POST', mlPayload);

    return sendSuccess(res, {
      node,
      product,
      historical_sales: salesSeries,
      forecast: mlResult.prediction,
      model_info: mlResult.model,
    }, 'Demand forecast calculated successfully');
  } catch (error) {
    console.error('Demand forecast error:', error);
    return sendError(res, error.message || 'Failed to generate demand forecast', 500);
  }
};

/**
 * POST /api/v1/ml/spoilage
 */
const getSpoilagePrediction = async (req, res) => {
  try {
    const { role, node_id: userNodeId } = req.user;
    const {
      inventory_id,
      node_id,
      product_id,
      days_to_expiry,
      product_shelf_life,
      inventory_quantity,
      temperature_exposure = 1.0,
      historical_spoilage_rate = 0.1,
      storage_condition = 0,
    } = req.body;

    let targetDays = days_to_expiry;
    let targetShelfLife = product_shelf_life;
    let targetQty = inventory_quantity;
    let invRecord = null;

    if (inventory_id) {
      if (!isValidId(inventory_id)) return sendError(res, 'Invalid inventory_id', 400);
      invRecord = await Inventory.findById(inventory_id)
        .populate('product_id')
        .populate('node_id');
      if (!invRecord) return sendError(res, 'Inventory record not found', 404);

      if (role === 'WAREHOUSE_ADMIN' && userNodeId.toString() !== invRecord.node_id._id.toString()) {
        return sendError(res, 'Access denied — not your node', 403);
      }

      if (targetDays === undefined && invRecord.expiry_date) {
        const diff = Math.ceil((new Date(invRecord.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        targetDays = Math.max(diff, 0);
      }
      targetShelfLife = targetShelfLife || invRecord.product_id?.shelf_life_days || 14;
      targetQty = targetQty !== undefined ? targetQty : invRecord.quantity;
    } else if (node_id && product_id) {
      if (!isValidId(node_id) || !isValidId(product_id)) return sendError(res, 'Invalid node_id or product_id', 400);
      if (role === 'WAREHOUSE_ADMIN' && userNodeId.toString() !== node_id.toString()) {
        return sendError(res, 'Access denied — not your node', 403);
      }
      const [p, inv] = await Promise.all([
        Product.findById(product_id),
        Inventory.findOne({ node_id, product_id }),
      ]);
      targetShelfLife = targetShelfLife || p?.shelf_life_days || 14;
      targetQty = targetQty !== undefined ? targetQty : inv?.quantity || 50;
      if (targetDays === undefined && inv?.expiry_date) {
        targetDays = Math.max(Math.ceil((new Date(inv.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)), 0);
      }
    }

    if (targetDays === undefined || !targetShelfLife || targetQty === undefined) {
      return sendError(res, 'days_to_expiry, product_shelf_life, and inventory_quantity are required', 400);
    }

    const mlPayload = {
      days_to_expiry: parseFloat(targetDays),
      product_shelf_life: parseFloat(targetShelfLife),
      inventory_quantity: parseInt(targetQty),
      temperature_exposure: parseFloat(temperature_exposure),
      historical_spoilage_rate: parseFloat(historical_spoilage_rate),
      storage_condition: parseInt(storage_condition),
    };

    const mlResult = await callFastAPI('/predict/spoilage', 'POST', mlPayload);

    return sendSuccess(res, {
      inventory: invRecord,
      inputs: mlPayload,
      prediction: mlResult.prediction,
      model_info: mlResult.model,
    }, 'Spoilage risk analyzed successfully');
  } catch (error) {
    console.error('Spoilage prediction error:', error);
    return sendError(res, error.message || 'Failed to predict spoilage risk', 500);
  }
};

/**
 * POST /api/v1/ml/anomaly
 */
const detectAnomaly = async (req, res) => {
  try {
    const { role, node_id: userNodeId } = req.user;
    const {
      node_id,
      product_id,
      recent_sales,
      rolling_mean,
      rolling_std,
      inventory_change = 0.0,
      stockout_ratio = 0.0,
      persist_alert = false,
    } = req.body;

    let targetSales = recent_sales;
    let targetMean = rolling_mean;
    let targetStd = rolling_std;

    if (node_id && product_id && (targetSales === undefined || targetMean === undefined)) {
      if (!isValidId(node_id) || !isValidId(product_id)) return sendError(res, 'Invalid node_id or product_id', 400);
      if (role === 'WAREHOUSE_ADMIN' && userNodeId.toString() !== node_id.toString()) {
        return sendError(res, 'Access denied — not your node', 403);
      }

      const sales = await SalesRecord.find({ node_id, product_id })
        .sort({ sale_date: -1 })
        .limit(14);

      if (sales.length > 0) {
        targetSales = sales[0].quantity_sold;
        const past = sales.slice(1);
        if (past.length > 0) {
          const sum = past.reduce((acc, curr) => acc + curr.quantity_sold, 0);
          targetMean = sum / past.length;
          const variance = past.reduce((acc, curr) => acc + Math.pow(curr.quantity_sold - targetMean, 2), 0) / past.length;
          targetStd = Math.sqrt(variance);
        } else {
          targetMean = targetSales;
          targetStd = targetSales * 0.2;
        }
      }
    }

    if (targetSales === undefined || targetMean === undefined) {
      return sendError(res, 'recent_sales and rolling_mean are required', 400);
    }

    const mlPayload = {
      recent_sales: parseFloat(targetSales),
      rolling_mean: parseFloat(targetMean),
      rolling_std: targetStd !== undefined ? parseFloat(targetStd) : undefined,
      inventory_change: parseFloat(inventory_change),
      stockout_ratio: parseFloat(stockout_ratio),
    };

    const mlResult = await callFastAPI('/detect/anomaly', 'POST', mlPayload);

    let alertRecord = null;
    if (mlResult.anomaly.is_anomaly && persist_alert && node_id && isValidId(node_id)) {
      alertRecord = await AnomalyAlert.create({
        node_id,
        product_id: (product_id && isValidId(product_id)) ? product_id : null,
        alert_type: mlResult.anomaly.anomaly_type === 'DEMAND_SPIKE'  ? 'DEMAND_SPIKE'
                  : mlResult.anomaly.anomaly_type === 'DEMAND_DROP'   ? 'DEMAND_DROP'
                  : mlResult.anomaly.anomaly_type === 'EXPIRY_OR_STOCKOUT_RISK' ? 'EXPIRY_RISK'
                  : 'SUPPLY_INCONSISTENCY',
        severity: mlResult.anomaly.severity === 'CRITICAL' ? 'CRITICAL'
                : mlResult.anomaly.severity === 'HIGH'     ? 'HIGH' : 'MEDIUM',
        message: `[AI Isolation Forest] ${mlResult.anomaly.message} (Score: ${mlResult.anomaly.score})`,
        status: 'ACTIVE',
      });
    }

    return sendSuccess(res, {
      inputs: mlPayload,
      anomaly: mlResult.anomaly,
      model_info: mlResult.model,
      persisted_alert: alertRecord,
    }, 'Anomaly detection analysis completed');
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return sendError(res, error.message || 'Failed to analyze anomaly', 500);
  }
};

module.exports = {
  getMLHealth,
  getDemandForecast,
  getSpoilagePrediction,
  detectAnomaly,
};
