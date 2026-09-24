-- ============================================================
-- 04_seed_data.sql
-- Inserts initial/reference data.
-- Run after 03_constraints.sql.
-- ============================================================

USE MOBDB_DEV;
GO

-- ------------------------------------------------------------
-- OrdfulCustomers
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulCustomers (CustomerId, CustomerName, CustomerType, EligibilityStatus)
VALUES
    ('CUST-001', 'Acme Retail Ltd',        'Priority', 'eligible'),
    ('CUST-002', 'Blue Harbor Traders',    'Standard', 'eligible'),
    ('CUST-003', 'Crestview Wholesale',    'Standard', 'credit hold'),
    ('CUST-004', 'Delta Supply Co',        'Priority', 'unknown');
GO

-- ------------------------------------------------------------
-- OrdfulInventory
-- PROD-400 demonstrates Priority partial release: WH-A=40 + WH-B=35
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulInventory (ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate)
VALUES
    ('PROD-100', 'WH-A', 500, '2026-10-01'),
    ('PROD-100', 'WH-B', 120, '2026-10-03'),
    ('PROD-200', 'WH-A', 75,  '2026-10-02'),
    ('PROD-200', 'WH-C', 300, '2026-10-05'),
    ('PROD-300', 'WH-B', 40,  '2026-10-04'),
    ('PROD-400', 'WH-A', 40,  '2026-10-01'),
    ('PROD-400', 'WH-B', 35,  '2026-10-02');
GO

-- ------------------------------------------------------------
-- OrdfulOrders
-- EarliestDispatchDate is the single warehouse's dispatch date for
-- a single-warehouse release, and NULL for a multi-warehouse
-- (Priority) release or a blocked order.
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulOrders (OrderId, CustomerId, ProductId, Quantity, PromisedDeliveryDate, EarliestDispatchDate, OrderStatus)
VALUES
    ('ORD-1001', 'CUST-002', 'PROD-100', 50,  '2026-10-05', '2026-10-01', 'Released'),
    ('ORD-1002', 'CUST-001', 'PROD-400', 100, '2026-10-10', NULL,         'Partially Released'),
    ('ORD-1003', 'CUST-003', 'PROD-300', 20,  '2026-10-08', NULL,         'Blocked'),
    ('ORD-1004', 'CUST-004', 'PROD-100', 10,  '2026-10-12', NULL,         'Blocked');
GO

-- ------------------------------------------------------------
-- OrdfulFulfilmentResults
-- WarehouseId is only set for a single-warehouse release. Reason is
-- populated only for blocked orders.
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulFulfilmentResults (OrderId, Status, WarehouseId, Reason, ReleasedQuantity, BackorderedQuantity)
VALUES
    ('ORD-1001', 'Released',            'WH-A', NULL,                   50, 0),
    ('ORD-1002', 'Partially Released',  NULL,   NULL,                   75, 25),
    ('ORD-1003', 'Blocked',             NULL,   'credit hold',           0, 20),
    ('ORD-1004', 'Blocked',             NULL,   'eligibility unknown',   0, 10);
GO

-- ------------------------------------------------------------
-- OrdfulInventoryAllocations
-- ORD-1002 spans two warehouses (Priority order combining WH-A + WH-B).
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulInventoryAllocations (OrderId, ProductId, WarehouseId, AllocatedQuantity)
VALUES
    ('ORD-1001', 'PROD-100', 'WH-A', 50),
    ('ORD-1002', 'PROD-400', 'WH-A', 40),
    ('ORD-1002', 'PROD-400', 'WH-B', 35);
GO

-- ------------------------------------------------------------
-- OrdfulBackorders
-- ORD-1002's unfulfilled balance (100 - 75 = 25).
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulBackorders (OrderId, ProductId, BackorderedQuantity, Status)
VALUES
    ('ORD-1002', 'PROD-400', 25, 'Open');
GO
