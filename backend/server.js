require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { sequelize } = require('./models');
const { errorHandler } = require('./middleware/errorHandler');
const { sendSuccess } = require('./utils/responseHelper');

// Route imports
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();
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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/inventory', inventoryRoutes);

// Top-level convenience routes (spec requires GET /api/v1/products and GET /api/v1/nodes)
const { authenticate } = require('./middleware/authMiddleware');
const { authorizeRoles } = require('./middleware/rbacMiddleware');
const { getProducts, getNodes } = require('./controllers/inventoryController');

app.get('/api/v1/products', authenticate, authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'), getProducts);
app.get('/api/v1/nodes', authenticate, authorizeRoles('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER'), getNodes);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Error Handler ─────────────────────────────────────────────────────────────

app.use(errorHandler);

// ── Database + Server Start ───────────────────────────────────────────────────

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync models without dropping tables in dev
    await sequelize.sync({ alter: false });
    console.log('✅ Database models synchronized');

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
