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
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulInventory (ProductId, WarehouseId, AvailableQuantity, EarliestDispatchDate)
VALUES
    ('PROD-100', 'WH-A', 500, '2026-10-01'),
    ('PROD-100', 'WH-B', 120, '2026-10-03'),
    ('PROD-200', 'WH-A', 75,  '2026-10-02'),
    ('PROD-200', 'WH-C', 300, '2026-10-05'),
    ('PROD-300', 'WH-B', 40,  '2026-10-04');
GO

-- ------------------------------------------------------------
-- OrdfulOrders
-- ------------------------------------------------------------
-- EarliestDispatchDate is NULL for blocked orders (no warehouse selected).
INSERT INTO dbo.OrdfulOrders (OrderId, CustomerId, ProductId, Quantity, PromisedDeliveryDate, EarliestDispatchDate, OrderStatus)
VALUES
    ('ORD-1001', 'CUST-001', 'PROD-100', 50,  '2026-10-05', '2026-10-01', 'released'),
    ('ORD-1002', 'CUST-002', 'PROD-200', 100, '2026-10-10', '2026-10-06', 'partially released'),
    ('ORD-1003', 'CUST-003', 'PROD-300', 20,  '2026-10-08', NULL,         'blocked'),
    ('ORD-1004', 'CUST-004', 'PROD-100', 10,  '2026-10-12', NULL,         'blocked');
GO

-- ------------------------------------------------------------
-- OrdfulFulfilmentResults
-- Reason is populated only for blocked orders, using the exact
-- reason strings the fulfilment engine produces.
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulFulfilmentResults (OrderId, Status, WarehouseId, Reason)
VALUES
    ('ORD-1001', 'released',            'WH-A', NULL),
    ('ORD-1002', 'partially released',  'WH-A', NULL),
    ('ORD-1003', 'blocked',             NULL,   'credit hold'),
    ('ORD-1004', 'blocked',             NULL,   'eligibility unknown');
GO

-- ------------------------------------------------------------
-- OrdfulInventoryAllocations
-- ------------------------------------------------------------
INSERT INTO dbo.OrdfulInventoryAllocations (OrderId, ProductId, WarehouseId, AllocatedQuantity)
VALUES
    ('ORD-1001', 'PROD-100', 'WH-A', 50),
    ('ORD-1002', 'PROD-200', 'WH-A', 75);
GO
