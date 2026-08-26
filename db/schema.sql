-- ============================================================
-- FoodChain AI — MySQL 8 Database Schema
-- Run this to create the database and all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS foodchain_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE foodchain_ai;

-- ── nodes ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nodes (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150)  NOT NULL,
    type         ENUM('WAREHOUSE', 'RETAIL_STORE', 'DISTRIBUTION_CENTRE') NOT NULL,
    location     VARCHAR(255)  NOT NULL,
    capacity     INT           NOT NULL DEFAULT 0,
    status       ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('SUPPLY_CHAIN_MANAGER', 'WAREHOUSE_ADMIN', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    node_id       INT          NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_node FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    sku             VARCHAR(50)   NOT NULL UNIQUE,
    name            VARCHAR(200)  NOT NULL,
    category        VARCHAR(100)  NOT NULL,
    shelf_life_days INT           NOT NULL DEFAULT 0,
    unit_cost       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── inventory ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    node_id           INT          NOT NULL,
    product_id        INT          NOT NULL,
    quantity          INT          NOT NULL DEFAULT 0,
    reorder_threshold INT          NOT NULL DEFAULT 50,
    expiry_date       DATE         NULL,
    last_updated      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_node    FOREIGN KEY (node_id)    REFERENCES nodes(id)    ON DELETE CASCADE,
    CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── sales_records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_records (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    node_id       INT           NOT NULL,
    product_id    INT           NOT NULL,
    quantity_sold INT           NOT NULL DEFAULT 0,
    sale_date     DATE          NOT NULL,
    unit_price    DECIMAL(10,2) NULL,
    total_revenue DECIMAL(12,2) NULL,
    CONSTRAINT fk_sales_node    FOREIGN KEY (node_id)    REFERENCES nodes(id)    ON DELETE CASCADE,
    CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_sales_date       (sale_date),
    INDEX idx_sales_node       (node_id),
    INDEX idx_sales_product    (product_id)
) ENGINE=InnoDB;

-- ── redistribution_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redistribution_logs (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    source_node_id       INT  NOT NULL,
    destination_node_id  INT  NOT NULL,
    product_id           INT  NOT NULL,
    quantity             INT  NOT NULL,
    status               ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at           DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at         DATETIME NULL,
    CONSTRAINT fk_redist_source FOREIGN KEY (source_node_id)      REFERENCES nodes(id)    ON DELETE RESTRICT,
    CONSTRAINT fk_redist_dest   FOREIGN KEY (destination_node_id)  REFERENCES nodes(id)    ON DELETE RESTRICT,
    CONSTRAINT fk_redist_product FOREIGN KEY (product_id)          REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ── spoilage_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spoilage_events (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    node_id        INT           NOT NULL,
    product_id     INT           NOT NULL,
    quantity       INT           NOT NULL,
    reason         ENUM('EXPIRED', 'DAMAGED', 'CONTAMINATED', 'QUALITY_FAILURE', 'OTHER') NOT NULL DEFAULT 'EXPIRED',
    estimated_loss DECIMAL(12,2) NULL,
    event_date     DATE          NOT NULL,
    CONSTRAINT fk_spoilage_node    FOREIGN KEY (node_id)    REFERENCES nodes(id)    ON DELETE CASCADE,
    CONSTRAINT fk_spoilage_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── anomaly_alerts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    node_id     INT  NULL,
    product_id  INT  NULL,
    alert_type  ENUM('DEMAND_SPIKE','DEMAND_DROP','OVERSTOCK','UNDERSTOCK','EXPIRY_RISK','SUPPLY_INCONSISTENCY','SPOILAGE_RISK') NOT NULL,
    severity    ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    message     TEXT NOT NULL,
    status      ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert_node    FOREIGN KEY (node_id)    REFERENCES nodes(id)    ON DELETE SET NULL,
    CONSTRAINT fk_alert_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB;
