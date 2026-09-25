require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/responseHelper');

// Route imports
const authRoutes      = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const nodeRoutes      = require('./routes/nodeRoutes');
const productRoutes   = require('./routes/productRoutes');
const spoilageRoutes  = require('./routes/spoilageRoutes');
const mlRoutes        = require('./routes/mlRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/api/v1/health', (req, res) => {
  sendSuccess(res, {
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  }, 'FoodChain AI API is running');
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/nodes',     nodeRoutes);
app.use('/api/v1/products',  productRoutes);
app.use('/api/v1/spoilage',  spoilageRoutes);
app.use('/api/v1/ml',        mlRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Error Handler ─────────────────────────────────────────────────────────────

app.use(errorHandler);

// ── Database + Server Start ───────────────────────────────────────────────────

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 FoodChain AI backend running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
