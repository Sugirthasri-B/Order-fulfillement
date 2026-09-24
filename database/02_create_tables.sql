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
-- One fulfilment decision per order.
-- ------------------------------------------------------------
CREATE TABLE dbo.OrdfulFulfilmentResults
(
    OrderId         NVARCHAR(50)    NOT NULL,
    Status          NVARCHAR(30)    NOT NULL,
    WarehouseId     NVARCHAR(20)    NULL,
    Reason          NVARCHAR(500)   NULL,
    EvaluatedAt     DATETIME2       NOT NULL CONSTRAINT DF_OrdfulFulfilmentResults_EvaluatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_OrdfulFulfilmentResults PRIMARY KEY CLUSTERED (OrderId)
);
GO

-- ------------------------------------------------------------
-- OrdfulInventoryAllocations
-- Records how much inventory (from which warehouse) was
-- allocated against an order. An order can span multiple
-- allocations when it is only partially released.
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
