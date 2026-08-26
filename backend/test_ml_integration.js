const http = require('http');

function req(options, body = null) {
  return new Promise((resolve) => {
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', (err) => resolve({ status: 0, err: err.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function testML() {
  console.log('\n======================================================');
  console.log('  TESTING PART 3: ML FASTAPI & EXPRESS INTEGRATION');
  console.log('======================================================\n');

  // 1. Direct FastAPI Health
  const fastApiHealth = await req({ hostname: 'localhost', port: 8000, path: '/health', method: 'GET' });
  console.log('1. Direct FastAPI /health:', fastApiHealth.status, fastApiHealth.body);

  // 2. Direct FastAPI Demand Prediction
  const fastApiDemand = await req(
    { hostname: 'localhost', port: 8000, path: '/predict/demand', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      node_id: 1,
      product_id: 1,
      historical_sales: [12.0, 15.0, 14.0, 16.0, 13.0, 18.0, 19.0, 15.0, 17.0, 20.0, 18.0, 22.0, 21.0, 25.0],
      discount: 0.95,
      holiday_flag: 0,
      activity_flag: 1,
      stockout_hours: 1.5,
    }
  );
  console.log('\n2. Direct FastAPI /predict/demand:', fastApiDemand.status, fastApiDemand.body);

  // 3. Direct FastAPI Spoilage Prediction
  const fastApiSpoilage = await req(
    { hostname: 'localhost', port: 8000, path: '/predict/spoilage', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      days_to_expiry: 1.5,
      product_shelf_life: 7.0,
      inventory_quantity: 150,
      stock_age: 5.5,
      temperature_exposure: 1.4,
      historical_spoilage_rate: 0.12,
      storage_condition: 1,
    }
  );
  console.log('\n3. Direct FastAPI /predict/spoilage:', fastApiSpoilage.status, fastApiSpoilage.body);

  // 4. Direct FastAPI Anomaly Detection
  const fastApiAnomaly = await req(
    { hostname: 'localhost', port: 8000, path: '/detect/anomaly', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      recent_sales: 85.0,
      rolling_mean: 18.0,
      rolling_std: 3.5,
      inventory_change: -85.0,
      stockout_ratio: 0.0,
    }
  );
  console.log('\n4. Direct FastAPI /detect/anomaly:', fastApiAnomaly.status, fastApiAnomaly.body);

  // 5. Authenticate with Node.js backend
  const loginRes = await req(
    { hostname: 'localhost', port: 5000, path: '/api/v1/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { email: 'manager@foodchain.ai', password: 'password123' }
  );
  const token = loginRes.body.data?.token;
  console.log('\n5. Express Login Status:', loginRes.status, 'Token acquired:', !!token);

  // 6. Express -> FastAPI Demand Forecast (auto-fetching sales from MySQL!)
  const expressDemand = await req(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/ml/demand',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    },
    {
      node_id: 1,
      product_id: 1,
      discount: 0.9,
      activity_flag: 1,
    }
  );
  console.log('\n6. Express -> FastAPI /api/v1/ml/demand (Auto-fetching DB sales):', expressDemand.status, expressDemand.body);

  // 7. Express -> FastAPI Spoilage Prediction (auto-fetching inventory from MySQL!)
  const expressSpoilage = await req(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/ml/spoilage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    },
    {
      inventory_id: 1,
    }
  );
  console.log('\n7. Express -> FastAPI /api/v1/ml/spoilage (Auto-fetching DB inventory):', expressSpoilage.status, expressSpoilage.body);

  // 8. Express -> FastAPI Anomaly Detection & Persistence
  const expressAnomaly = await req(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/ml/anomaly',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    },
    {
      node_id: 1,
      product_id: 1,
      recent_sales: 120.0,
      rolling_mean: 20.0,
      persist_alert: true,
    }
  );
  console.log('\n8. Express -> FastAPI /api/v1/ml/anomaly (With DB Alert Persistence):', expressAnomaly.status, expressAnomaly.body);

  console.log('\n======================================================\n');
}

testML();
