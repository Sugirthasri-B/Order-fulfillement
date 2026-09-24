-- ============================================================
-- 03_constraints.sql
-- Adds foreign keys, unique constraints, check constraints,
-- and indexes.
-- Run after 02_create_tables.sql.
-- ============================================================

USE MOBDB_DEV;
GO

-- ------------------------------------------------------------
-- OrdfulCustomers
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulCustomers
    ADD CONSTRAINT CK_OrdfulCustomers_CustomerType
        CHECK (CustomerType IN ('Standard', 'Priority'));
GO

ALTER TABLE dbo.OrdfulCustomers
    ADD CONSTRAINT CK_OrdfulCustomers_EligibilityStatus
        CHECK (EligibilityStatus IN ('eligible', 'credit hold', 'unknown'));
GO

-- ------------------------------------------------------------
-- OrdfulInventory
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulInventory
    ADD CONSTRAINT CK_OrdfulInventory_WarehouseId
        CHECK (WarehouseId IN ('WH-A', 'WH-B', 'WH-C'));
GO

-- Creation requires a positive quantity (enforced by the API); the
-- database allows 0 so fulfilment can deplete a warehouse to empty.
ALTER TABLE dbo.OrdfulInventory
    ADD CONSTRAINT CK_OrdfulInventory_AvailableQuantity
        CHECK (AvailableQuantity >= 0);
GO

-- ------------------------------------------------------------
-- OrdfulOrders
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT FK_OrdfulOrders_OrdfulCustomers
        FOREIGN KEY (CustomerId) REFERENCES dbo.OrdfulCustomers (CustomerId);
GO

ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT CK_OrdfulOrders_Quantity
        CHECK (Quantity > 0);
GO

ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT CK_OrdfulOrders_OrderStatus
        CHECK (OrderStatus IN ('Released', 'Partially Released', 'Blocked'));
GO

-- EarliestDispatchDate is NULL for a blocked order (no warehouse selected).
ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT CK_OrdfulOrders_DispatchBeforeOrOnPromised
        CHECK (EarliestDispatchDate IS NULL OR EarliestDispatchDate <= PromisedDeliveryDate);
GO

-- ------------------------------------------------------------
-- OrdfulFulfilmentResults
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT FK_OrdfulFulfilmentResults_OrdfulOrders
        FOREIGN KEY (OrderId) REFERENCES dbo.OrdfulOrders (OrderId);
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_Status
        CHECK (Status IN ('Released', 'Partially Released', 'Blocked'));
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_WarehouseId
        CHECK (WarehouseId IS NULL OR WarehouseId IN ('WH-A', 'WH-B', 'WH-C'));
GO

-- Reason must be NULL unless the order is blocked.
ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_ReasonOnlyWhenBlocked
        CHECK (
            (Status <> 'Blocked' AND Reason IS NULL)
            OR (Status = 'Blocked')
        );
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_ReleasedQuantity
        CHECK (ReleasedQuantity >= 0);
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_BackorderedQuantity
        CHECK (BackorderedQuantity >= 0);
GO

-- ------------------------------------------------------------
-- OrdfulInventoryAllocations
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulInventoryAllocations
    ADD CONSTRAINT FK_OrdfulInventoryAllocations_OrdfulOrders
        FOREIGN KEY (OrderId) REFERENCES dbo.OrdfulOrders (OrderId);
GO

ALTER TABLE dbo.OrdfulInventoryAllocations
    ADD CONSTRAINT FK_OrdfulInventoryAllocations_OrdfulInventory
        FOREIGN KEY (ProductId, WarehouseId) REFERENCES dbo.OrdfulInventory (ProductId, WarehouseId);
GO

ALTER TABLE dbo.OrdfulInventoryAllocations
    ADD CONSTRAINT CK_OrdfulInventoryAllocations_WarehouseId
        CHECK (WarehouseId IN ('WH-A', 'WH-B', 'WH-C'));
GO

ALTER TABLE dbo.OrdfulInventoryAllocations
    ADD CONSTRAINT CK_OrdfulInventoryAllocations_AllocatedQuantity
        CHECK (AllocatedQuantity > 0);
GO

-- Prevent duplicate allocation rows for the same order/product/warehouse.
ALTER TABLE dbo.OrdfulInventoryAllocations
    ADD CONSTRAINT UQ_OrdfulInventoryAllocations_Order_Product_Warehouse
        UNIQUE (OrderId, ProductId, WarehouseId);
GO

-- ------------------------------------------------------------
-- OrdfulBackorders
-- ------------------------------------------------------------
ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT FK_OrdfulBackorders_OrdfulOrders
        FOREIGN KEY (OrderId) REFERENCES dbo.OrdfulOrders (OrderId);
GO

-- At most one backorder per order.
ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT UQ_OrdfulBackorders_OrderId
        UNIQUE (OrderId);
GO

ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT CK_OrdfulBackorders_Status
        CHECK (Status IN ('Open'));
GO

ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT CK_OrdfulBackorders_BackorderedQuantity
        CHECK (BackorderedQuantity > 0);
GO

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE NONCLUSTERED INDEX IX_OrdfulOrders_CustomerId
    ON dbo.OrdfulOrders (CustomerId);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulOrders_OrderStatus
    ON dbo.OrdfulOrders (OrderStatus);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulInventory_WarehouseId
    ON dbo.OrdfulInventory (WarehouseId);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulFulfilmentResults_Status
    ON dbo.OrdfulFulfilmentResults (Status);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulInventoryAllocations_OrderId
    ON dbo.OrdfulInventoryAllocations (OrderId);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulInventoryAllocations_ProductId_WarehouseId
    ON dbo.OrdfulInventoryAllocations (ProductId, WarehouseId);
GO

CREATE NONCLUSTERED INDEX IX_OrdfulBackorders_OrderId
    ON dbo.OrdfulBackorders (OrderId);
GO
