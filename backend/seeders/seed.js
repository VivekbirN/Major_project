require('dotenv').config({ path: '../.env' });
// Also try loading from same directory
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { sequelize, User, Node, Product, Inventory, SalesRecord, RedistributionLog, SpoilageEvent, AnomalyAlert } = require('../models');

const SALT_ROUNDS = 10;

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Sync schema (create tables if not exist)
    await sequelize.sync({ force: true });
    console.log('✅ Schema synchronized (tables recreated)');

    // ── 1. Nodes ─────────────────────────────────────────────────────────────
    console.log('Creating nodes...');
    const nodes = await Node.bulkCreate([
      { name: 'Central Warehouse', type: 'WAREHOUSE', location: 'Mumbai, Maharashtra', capacity: 50000, status: 'ACTIVE' },
      { name: 'Bangalore Warehouse', type: 'WAREHOUSE', location: 'Bangalore, Karnataka', capacity: 35000, status: 'ACTIVE' },
      { name: 'Mysore Distribution Centre', type: 'DISTRIBUTION_CENTRE', location: 'Mysore, Karnataka', capacity: 20000, status: 'ACTIVE' },
      { name: 'Retail Store Alpha', type: 'RETAIL_STORE', location: 'Koramangala, Bangalore', capacity: 5000, status: 'ACTIVE' },
      { name: 'Retail Store Beta', type: 'RETAIL_STORE', location: 'Indiranagar, Bangalore', capacity: 4500, status: 'ACTIVE' },
      { name: 'Retail Store Gamma', type: 'RETAIL_STORE', location: 'Whitefield, Bangalore', capacity: 6000, status: 'ACTIVE' },
      { name: 'Hyderabad Warehouse', type: 'WAREHOUSE', location: 'Hyderabad, Telangana', capacity: 30000, status: 'MAINTENANCE' },
    ]);
    console.log(`✅ Created ${nodes.length} nodes`);

    // ── 2. Users ─────────────────────────────────────────────────────────────
    console.log('Creating users...');
    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

    const users = await User.bulkCreate([
      {
        name: 'Arjun Sharma',
        email: 'manager@foodchain.ai',
        password_hash: passwordHash,
        role: 'SUPPLY_CHAIN_MANAGER',
        node_id: null, // Manager has no specific node
      },
      {
        name: 'Priya Menon',
        email: 'warehouse@foodchain.ai',
        password_hash: passwordHash,
        role: 'WAREHOUSE_ADMIN',
        node_id: nodes[1].id, // Bangalore Warehouse
      },
      {
        name: 'Rahul Gupta',
        email: 'viewer@foodchain.ai',
        password_hash: passwordHash,
        role: 'VIEWER',
        node_id: nodes[3].id, // Retail Store Alpha
      },
      {
        name: 'Sneha Pillai',
        email: 'sneha@foodchain.ai',
        password_hash: passwordHash,
        role: 'WAREHOUSE_ADMIN',
        node_id: nodes[0].id, // Central Warehouse
      },
      {
        name: 'Vikram Nair',
        email: 'vikram@foodchain.ai',
        password_hash: passwordHash,
        role: 'VIEWER',
        node_id: nodes[4].id, // Retail Store Beta
      },
    ]);
    console.log(`✅ Created ${users.length} users`);

    // ── 3. Products ───────────────────────────────────────────────────────────
    console.log('Creating products...');
    const products = await Product.bulkCreate([
      { sku: 'SKU-001', name: 'Whole Wheat Bread', category: 'Bakery', shelf_life_days: 7, unit_cost: 45.00 },
      { sku: 'SKU-002', name: 'Full Cream Milk (1L)', category: 'Dairy', shelf_life_days: 5, unit_cost: 62.00 },
      { sku: 'SKU-003', name: 'Organic Tomatoes (1kg)', category: 'Vegetables', shelf_life_days: 10, unit_cost: 55.00 },
      { sku: 'SKU-004', name: 'Basmati Rice (5kg)', category: 'Grains', shelf_life_days: 365, unit_cost: 420.00 },
      { sku: 'SKU-005', name: 'Refined Sunflower Oil (1L)', category: 'Oils', shelf_life_days: 180, unit_cost: 145.00 },
      { sku: 'SKU-006', name: 'Greek Yogurt (400g)', category: 'Dairy', shelf_life_days: 14, unit_cost: 89.00 },
      { sku: 'SKU-007', name: 'Chicken Breast (1kg)', category: 'Meat & Poultry', shelf_life_days: 3, unit_cost: 320.00 },
      { sku: 'SKU-008', name: 'Alphonso Mango (1kg)', category: 'Fruits', shelf_life_days: 5, unit_cost: 180.00 },
      { sku: 'SKU-009', name: 'Toor Dal (1kg)', category: 'Pulses', shelf_life_days: 270, unit_cost: 115.00 },
      { sku: 'SKU-010', name: 'Paneer (200g)', category: 'Dairy', shelf_life_days: 7, unit_cost: 95.00 },
      { sku: 'SKU-011', name: 'Spinach (500g)', category: 'Vegetables', shelf_life_days: 5, unit_cost: 30.00 },
      { sku: 'SKU-012', name: 'Orange Juice (1L)', category: 'Beverages', shelf_life_days: 21, unit_cost: 99.00 },
      { sku: 'SKU-013', name: 'Multigrain Biscuits (250g)', category: 'Snacks', shelf_life_days: 120, unit_cost: 48.00 },
      { sku: 'SKU-014', name: 'Amul Butter (500g)', category: 'Dairy', shelf_life_days: 90, unit_cost: 260.00 },
      { sku: 'SKU-015', name: 'Green Chillies (250g)', category: 'Vegetables', shelf_life_days: 7, unit_cost: 20.00 },
    ]);
    console.log(`✅ Created ${products.length} products`);

    // ── 4. Inventory ──────────────────────────────────────────────────────────
    console.log('Creating inventory...');
    const today = new Date();
    const daysFromNow = (d) => {
      const dt = new Date();
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().split('T')[0];
    };

    const inventoryData = [];
    // Central Warehouse — healthy stock, some overstock
    inventoryData.push(
      { node_id: nodes[0].id, product_id: products[0].id, quantity: 2500, reorder_threshold: 200, expiry_date: daysFromNow(6), last_updated: today },
      { node_id: nodes[0].id, product_id: products[1].id, quantity: 800, reorder_threshold: 100, expiry_date: daysFromNow(4), last_updated: today },
      { node_id: nodes[0].id, product_id: products[3].id, quantity: 15000, reorder_threshold: 1000, expiry_date: daysFromNow(200), last_updated: today },
      { node_id: nodes[0].id, product_id: products[4].id, quantity: 3200, reorder_threshold: 300, expiry_date: daysFromNow(150), last_updated: today },
      { node_id: nodes[0].id, product_id: products[6].id, quantity: 12, reorder_threshold: 50, expiry_date: daysFromNow(2), last_updated: today }, // LOW STOCK + NEAR EXPIRY
      { node_id: nodes[0].id, product_id: products[8].id, quantity: 4500, reorder_threshold: 500, expiry_date: daysFromNow(180), last_updated: today },
      { node_id: nodes[0].id, product_id: products[13].id, quantity: 1200, reorder_threshold: 100, expiry_date: daysFromNow(85), last_updated: today },
    );

    // Bangalore Warehouse
    inventoryData.push(
      { node_id: nodes[1].id, product_id: products[0].id, quantity: 350, reorder_threshold: 200, expiry_date: daysFromNow(5), last_updated: today },
      { node_id: nodes[1].id, product_id: products[2].id, quantity: 1800, reorder_threshold: 200, expiry_date: daysFromNow(8), last_updated: today },
      { node_id: nodes[1].id, product_id: products[5].id, quantity: 40, reorder_threshold: 100, expiry_date: daysFromNow(12), last_updated: today }, // LOW STOCK
      { node_id: nodes[1].id, product_id: products[7].id, quantity: 25, reorder_threshold: 50, expiry_date: daysFromNow(3), last_updated: today }, // LOW + NEAR EXPIRY
      { node_id: nodes[1].id, product_id: products[9].id, quantity: 600, reorder_threshold: 100, expiry_date: daysFromNow(6), last_updated: today },
      { node_id: nodes[1].id, product_id: products[11].id, quantity: 2200, reorder_threshold: 200, expiry_date: daysFromNow(18), last_updated: today }, // OVERSTOCK
      { node_id: nodes[1].id, product_id: products[12].id, quantity: 5500, reorder_threshold: 300, expiry_date: daysFromNow(100), last_updated: today }, // OVERSTOCK
    );

    // Mysore Distribution Centre
    inventoryData.push(
      { node_id: nodes[2].id, product_id: products[1].id, quantity: 2000, reorder_threshold: 300, expiry_date: daysFromNow(4), last_updated: today },
      { node_id: nodes[2].id, product_id: products[3].id, quantity: 7500, reorder_threshold: 800, expiry_date: daysFromNow(300), last_updated: today },
      { node_id: nodes[2].id, product_id: products[4].id, quantity: 1600, reorder_threshold: 200, expiry_date: daysFromNow(160), last_updated: today },
      { node_id: nodes[2].id, product_id: products[6].id, quantity: 180, reorder_threshold: 50, expiry_date: daysFromNow(2), last_updated: today }, // NEAR EXPIRY
      { node_id: nodes[2].id, product_id: products[10].id, quantity: 350, reorder_threshold: 100, expiry_date: daysFromNow(4), last_updated: today },
    );

    // Retail Store Alpha
    inventoryData.push(
      { node_id: nodes[3].id, product_id: products[0].id, quantity: 85, reorder_threshold: 80, expiry_date: daysFromNow(5), last_updated: today },
      { node_id: nodes[3].id, product_id: products[1].id, quantity: 60, reorder_threshold: 40, expiry_date: daysFromNow(3), last_updated: today },
      { node_id: nodes[3].id, product_id: products[5].id, quantity: 15, reorder_threshold: 30, expiry_date: daysFromNow(10), last_updated: today }, // LOW STOCK
      { node_id: nodes[3].id, product_id: products[9].id, quantity: 45, reorder_threshold: 25, expiry_date: daysFromNow(6), last_updated: today },
      { node_id: nodes[3].id, product_id: products[14].id, quantity: 120, reorder_threshold: 40, expiry_date: daysFromNow(6), last_updated: today },
    );

    // Retail Store Beta
    inventoryData.push(
      { node_id: nodes[4].id, product_id: products[0].id, quantity: 20, reorder_threshold: 60, expiry_date: daysFromNow(4), last_updated: today }, // LOW STOCK
      { node_id: nodes[4].id, product_id: products[2].id, quantity: 90, reorder_threshold: 50, expiry_date: daysFromNow(7), last_updated: today },
      { node_id: nodes[4].id, product_id: products[7].id, quantity: 8, reorder_threshold: 20, expiry_date: daysFromNow(3), last_updated: today }, // LOW + NEAR EXPIRY
      { node_id: nodes[4].id, product_id: products[11].id, quantity: 180, reorder_threshold: 40, expiry_date: daysFromNow(15), last_updated: today },
      { node_id: nodes[4].id, product_id: products[13].id, quantity: 220, reorder_threshold: 30, expiry_date: daysFromNow(80), last_updated: today },
    );

    // Retail Store Gamma
    inventoryData.push(
      { node_id: nodes[5].id, product_id: products[1].id, quantity: 95, reorder_threshold: 40, expiry_date: daysFromNow(4), last_updated: today },
      { node_id: nodes[5].id, product_id: products[3].id, quantity: 400, reorder_threshold: 100, expiry_date: daysFromNow(280), last_updated: today },
      { node_id: nodes[5].id, product_id: products[6].id, quantity: 55, reorder_threshold: 30, expiry_date: daysFromNow(2), last_updated: today }, // NEAR EXPIRY
      { node_id: nodes[5].id, product_id: products[8].id, quantity: 350, reorder_threshold: 80, expiry_date: daysFromNow(200), last_updated: today },
      { node_id: nodes[5].id, product_id: products[10].id, quantity: 25, reorder_threshold: 30, expiry_date: daysFromNow(4), last_updated: today }, // LOW STOCK
    );

    await Inventory.bulkCreate(inventoryData);
    console.log(`✅ Created ${inventoryData.length} inventory records`);

    // ── 5. Sales Records ──────────────────────────────────────────────────────
    console.log('Creating sales records...');
    const salesData = [];
    const pastDate = (d) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      return dt.toISOString().split('T')[0];
    };

    // Generate 60 days of sales for 3 nodes and 5 products
    const salesNodes = [nodes[3].id, nodes[4].id, nodes[5].id];
    const salesProducts = [products[0], products[1], products[2], products[5], products[9]];

    for (let day = 0; day < 60; day++) {
      for (const nodeId of salesNodes) {
        for (const product of salesProducts) {
          const qty = Math.floor(Math.random() * 30) + 5;
          salesData.push({
            node_id: nodeId,
            product_id: product.id,
            quantity_sold: qty,
            sale_date: pastDate(day),
            unit_price: product.unit_cost * 1.3,
            total_revenue: parseFloat((qty * product.unit_cost * 1.3).toFixed(2)),
          });
        }
      }
    }
    await SalesRecord.bulkCreate(salesData);
    console.log(`✅ Created ${salesData.length} sales records`);

    // ── 6. Redistribution Logs ────────────────────────────────────────────────
    console.log('Creating redistribution logs...');
    const redistributionData = [
      {
        source_node_id: nodes[1].id,
        destination_node_id: nodes[3].id,
        product_id: products[5].id,
        quantity: 100,
        status: 'COMPLETED',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
      {
        source_node_id: nodes[0].id,
        destination_node_id: nodes[4].id,
        product_id: products[0].id,
        quantity: 200,
        status: 'COMPLETED',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        source_node_id: nodes[2].id,
        destination_node_id: nodes[5].id,
        product_id: products[6].id,
        quantity: 80,
        status: 'IN_TRANSIT',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        completed_at: null,
      },
      {
        source_node_id: nodes[1].id,
        destination_node_id: nodes[2].id,
        product_id: products[11].id,
        quantity: 500,
        status: 'PENDING',
        created_at: new Date(),
        completed_at: null,
      },
      {
        source_node_id: nodes[0].id,
        destination_node_id: nodes[1].id,
        product_id: products[3].id,
        quantity: 2000,
        status: 'COMPLETED',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        completed_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      },
    ];
    await RedistributionLog.bulkCreate(redistributionData);
    console.log(`✅ Created ${redistributionData.length} redistribution logs`);

    // ── 7. Spoilage Events ────────────────────────────────────────────────────
    console.log('Creating spoilage events...');
    const spoilageData = [
      { node_id: nodes[0].id, product_id: products[6].id, quantity: 35, reason: 'EXPIRED', estimated_loss: 11200.00, event_date: pastDate(2) },
      { node_id: nodes[1].id, product_id: products[7].id, quantity: 60, reason: 'DAMAGED', estimated_loss: 10800.00, event_date: pastDate(5) },
      { node_id: nodes[3].id, product_id: products[1].id, quantity: 20, reason: 'EXPIRED', estimated_loss: 1240.00, event_date: pastDate(3) },
      { node_id: nodes[4].id, product_id: products[0].id, quantity: 15, reason: 'QUALITY_FAILURE', estimated_loss: 675.00, event_date: pastDate(7) },
      { node_id: nodes[2].id, product_id: products[10].id, quantity: 50, reason: 'CONTAMINATED', estimated_loss: 1500.00, event_date: pastDate(10) },
      { node_id: nodes[5].id, product_id: products[6].id, quantity: 25, reason: 'EXPIRED', estimated_loss: 8000.00, event_date: pastDate(1) },
      { node_id: nodes[1].id, product_id: products[2].id, quantity: 80, reason: 'DAMAGED', estimated_loss: 4400.00, event_date: pastDate(15) },
      { node_id: nodes[0].id, product_id: products[1].id, quantity: 120, reason: 'EXPIRED', estimated_loss: 7440.00, event_date: pastDate(20) },
    ];
    await SpoilageEvent.bulkCreate(spoilageData);
    console.log(`✅ Created ${spoilageData.length} spoilage events`);

    // ── 8. Anomaly Alerts ─────────────────────────────────────────────────────
    console.log('Creating anomaly alerts...');
    const alertData = [
      {
        node_id: nodes[4].id,
        product_id: products[0].id,
        alert_type: 'UNDERSTOCK',
        severity: 'HIGH',
        message: 'Retail Store Beta: Whole Wheat Bread stock critically low (20 units vs threshold 60). Immediate replenishment required.',
        status: 'ACTIVE',
      },
      {
        node_id: nodes[0].id,
        product_id: products[6].id,
        alert_type: 'EXPIRY_RISK',
        severity: 'CRITICAL',
        message: 'Central Warehouse: 12 units of Chicken Breast (SKU-007) expire in 2 days. Redistribute or mark down immediately.',
        status: 'ACTIVE',
      },
      {
        node_id: nodes[1].id,
        product_id: products[12].id,
        alert_type: 'OVERSTOCK',
        severity: 'MEDIUM',
        message: 'Bangalore Warehouse: Multigrain Biscuits overstocked (5500 units vs threshold 300). Consider redistribution.',
        status: 'ACTIVE',
      },
      {
        node_id: nodes[3].id,
        product_id: products[5].id,
        alert_type: 'UNDERSTOCK',
        severity: 'HIGH',
        message: 'Retail Store Alpha: Greek Yogurt below reorder threshold (15 units). Demand expected to increase this weekend.',
        status: 'ACKNOWLEDGED',
      },
      {
        node_id: nodes[2].id,
        product_id: products[6].id,
        alert_type: 'EXPIRY_RISK',
        severity: 'HIGH',
        message: 'Mysore Distribution Centre: 180 units of Chicken Breast expire in 2 days. Transfer to retail nodes immediately.',
        status: 'ACTIVE',
      },
      {
        node_id: nodes[5].id,
        product_id: products[10].id,
        alert_type: 'UNDERSTOCK',
        severity: 'MEDIUM',
        message: 'Retail Store Gamma: Spinach stock below reorder threshold.',
        status: 'ACTIVE',
      },
      {
        node_id: nodes[1].id,
        product_id: products[7].id,
        alert_type: 'EXPIRY_RISK',
        severity: 'CRITICAL',
        message: 'Bangalore Warehouse: Alphonso Mangoes (25 units) expire in 3 days. Urgent redistribution needed.',
        status: 'ACTIVE',
      },
    ];
    await AnomalyAlert.bulkCreate(alertData);
    console.log(`✅ Created ${alertData.length} anomaly alerts`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('   manager@foodchain.ai  / password123  (Supply Chain Manager)');
    console.log('   warehouse@foodchain.ai / password123 (Warehouse Admin — Bangalore)');
    console.log('   viewer@foodchain.ai   / password123  (Viewer — Retail Store Alpha)');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();
