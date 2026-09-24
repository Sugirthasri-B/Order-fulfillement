-- ============================================================
-- 02_create_tables.sql
-- Creates tables for the Order Fulfilment database.
-- Run after 01_create_database.sql.
-- ============================================================

USE MOBDB_DEV;
GO

-- ------------------------------------------------------------
-- OrdfulCustomers
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulCustomers
(
    CustomerId          NVARCHAR(50)    NOT NULL,
    CustomerName        NVARCHAR(200)   NOT NULL,
    CustomerType        NVARCHAR(20)    NOT NULL,
    EligibilityStatus   NVARCHAR(20)    NOT NULL,
    CreatedAt           DATETIME2       NOT NULL CONSTRAINT DF_OrdfulCustomers_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulCustomers PRIMARY KEY CLUSTERED (CustomerId)
);
GO

-- ------------------------------------------------------------
-- OrdfulInventory
-- Natural key: one row per product per warehouse.
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulInventory
(
    ProductId               NVARCHAR(50)    NOT NULL,
    WarehouseId             NVARCHAR(20)    NOT NULL,
    AvailableQuantity       INT             NOT NULL,
    EarliestDispatchDate    DATE            NOT NULL,
    UpdatedAt               DATETIME2       NOT NULL CONSTRAINT DF_OrdfulInventory_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulInventory PRIMARY KEY CLUSTERED (ProductId, WarehouseId)
);
GO

-- ------------------------------------------------------------
-- OrdfulOrders
-- EarliestDispatchDate is NULL for a blocked order, since no
-- warehouse was selected to fulfil it.
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulOrders
(
    OrderId                 NVARCHAR(50)    NOT NULL,
    CustomerId              NVARCHAR(50)    NOT NULL,
    ProductId               NVARCHAR(50)    NOT NULL,
    Quantity                INT             NOT NULL,
    PromisedDeliveryDate    DATE            NOT NULL,
    EarliestDispatchDate    DATE            NULL,
    OrderStatus             NVARCHAR(30)    NOT NULL,
    CreatedAt               DATETIME2       NOT NULL CONSTRAINT DF_OrdfulOrders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulOrders PRIMARY KEY CLUSTERED (OrderId)
);
GO

-- ------------------------------------------------------------
-- OrdfulFulfilmentResults
-- One fulfilment decision per order. WarehouseId is the single
-- selected warehouse for a Standard order; it is NULL for a
-- Priority order (which may span multiple warehouses — see
-- OrdfulInventoryAllocations for the actual breakdown) and for a
-- blocked order (no warehouse selected).
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulFulfilmentResults
(
    OrderId               NVARCHAR(50)    NOT NULL,
    Status                NVARCHAR(30)    NOT NULL,
    WarehouseId           NVARCHAR(20)    NULL,
    Reason                NVARCHAR(500)   NULL,
    ReleasedQuantity      INT             NOT NULL,
    BackorderedQuantity   INT             NOT NULL,
    EvaluatedAt           DATETIME2       NOT NULL CONSTRAINT DF_OrdfulFulfilmentResults_EvaluatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulFulfilmentResults PRIMARY KEY CLUSTERED (OrderId)
);
GO

-- ------------------------------------------------------------
-- OrdfulInventoryAllocations
-- Records how much inventory (from which warehouse) was
-- allocated against an order. A Priority order that combines
-- multiple warehouses has one row per warehouse used.
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulInventoryAllocations
(
    AllocationId        INT IDENTITY(1,1) NOT NULL,
    OrderId              NVARCHAR(50)      NOT NULL,
    ProductId            NVARCHAR(50)      NOT NULL,
    WarehouseId          NVARCHAR(20)      NOT NULL,
    AllocatedQuantity    INT               NOT NULL,
    CreatedAt            DATETIME2         NOT NULL CONSTRAINT DF_OrdfulInventoryAllocations_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulInventoryAllocations PRIMARY KEY CLUSTERED (AllocationId)
);
GO

-- ------------------------------------------------------------
-- OrdfulBackorders
-- One "Open" backorder record for a partially released order's
-- unfulfilled balance (Priority customers only).
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulBackorders
(
    BackorderId          INT IDENTITY(1,1) NOT NULL,
    OrderId              NVARCHAR(50)       NOT NULL,
    ProductId            NVARCHAR(50)       NOT NULL,
    BackorderedQuantity  INT                NOT NULL,
    Status               NVARCHAR(20)       NOT NULL,
    CreatedAt            DATETIME2          NOT NULL CONSTRAINT DF_OrdfulBackorders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulBackorders PRIMARY KEY CLUSTERED (BackorderId)
);
GO
