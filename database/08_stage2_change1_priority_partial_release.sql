-- ============================================================
-- 08_stage2_change1_priority_partial_release.sql
-- Stage 2 / CHANGE1: Priority customers may combine inventory
-- across WH-A, WH-B, WH-C and be partially released when at
-- least the configured threshold (default 70%) of the requested
-- quantity is available. Standard customers are unchanged.
--
-- This script:
--   1. Normalizes any existing lowercase status values to the
--      new exact literals ("Released" / "Partially Released" /
--      "Blocked") required by the Stage 2 API contract.
--   2. Updates the OrderStatus / Status CHECK constraints to the
--      new literals.
--   3. Adds ReleasedQuantity / BackorderedQuantity columns to
--      OrdfulFulfilmentResults so they are persisted directly,
--      not just derived from allocations.
--   4. Creates OrdfulBackorders to persist an "Open" backorder
--      record for a partially released order.
--
-- Safe to run multiple times.
-- ============================================================

USE MOBDB_DEV;
GO

-- ------------------------------------------------------------
-- 1. Normalize existing status values (old lowercase -> new exact literals)
-- ------------------------------------------------------------
UPDATE dbo.OrdfulOrders
SET OrderStatus = CASE OrderStatus
    WHEN 'released' THEN 'Released'
    WHEN 'partially released' THEN 'Partially Released'
    WHEN 'blocked' THEN 'Blocked'
    ELSE OrderStatus
END
WHERE OrderStatus IN ('released', 'partially released', 'blocked');
GO

UPDATE dbo.OrdfulFulfilmentResults
SET Status = CASE Status
    WHEN 'released' THEN 'Released'
    WHEN 'partially released' THEN 'Partially Released'
    WHEN 'blocked' THEN 'Blocked'
    ELSE Status
END
WHERE Status IN ('released', 'partially released', 'blocked');
GO

-- ------------------------------------------------------------
-- 2. Update CHECK constraints to the new exact literals
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulOrders_OrderStatus')
BEGIN
    ALTER TABLE dbo.OrdfulOrders DROP CONSTRAINT CK_OrdfulOrders_OrderStatus;
END
GO

ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT CK_OrdfulOrders_OrderStatus
        CHECK (OrderStatus IN ('Released', 'Partially Released', 'Blocked'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulFulfilmentResults_Status')
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults DROP CONSTRAINT CK_OrdfulFulfilmentResults_Status;
END
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_Status
        CHECK (Status IN ('Released', 'Partially Released', 'Blocked'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulFulfilmentResults_ReasonOnlyWhenBlocked')
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults DROP CONSTRAINT CK_OrdfulFulfilmentResults_ReasonOnlyWhenBlocked;
END
GO

ALTER TABLE dbo.OrdfulFulfilmentResults
    ADD CONSTRAINT CK_OrdfulFulfilmentResults_ReasonOnlyWhenBlocked
        CHECK (
            (Status <> 'Blocked' AND Reason IS NULL)
            OR (Status = 'Blocked')
        );
GO

-- ------------------------------------------------------------
-- 3. Persist ReleasedQuantity / BackorderedQuantity directly
--
-- Each ALTER TABLE ADD is its own batch, followed by GO, before any
-- later statement references the new column — SQL Server compiles a
-- whole batch up front, so a column added earlier in the SAME batch
-- is not yet visible to a later statement in that batch.
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OrdfulFulfilmentResults') AND name = 'ReleasedQuantity'
)
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults ADD ReleasedQuantity INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OrdfulFulfilmentResults') AND name = 'BackorderedQuantity'
)
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults ADD BackorderedQuantity INT NULL;
END
GO

-- Backfill from existing allocations/orders for any pre-existing rows
-- that don't have a value yet (safe to re-run).
UPDATE fr
SET fr.ReleasedQuantity = COALESCE(alloc.TotalAllocated, 0)
FROM dbo.OrdfulFulfilmentResults fr
OUTER APPLY (
    SELECT SUM(ia.AllocatedQuantity) AS TotalAllocated
    FROM dbo.OrdfulInventoryAllocations ia
    WHERE ia.OrderId = fr.OrderId
) alloc
WHERE fr.ReleasedQuantity IS NULL;
GO

UPDATE fr
SET fr.BackorderedQuantity = COALESCE(o.Quantity, 0) - fr.ReleasedQuantity
FROM dbo.OrdfulFulfilmentResults fr
INNER JOIN dbo.OrdfulOrders o ON o.OrderId = fr.OrderId
WHERE fr.BackorderedQuantity IS NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OrdfulFulfilmentResults') AND name = 'ReleasedQuantity' AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults ALTER COLUMN ReleasedQuantity INT NOT NULL;
END
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OrdfulFulfilmentResults') AND name = 'BackorderedQuantity' AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults ALTER COLUMN BackorderedQuantity INT NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulFulfilmentResults_ReleasedQuantity')
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults
        ADD CONSTRAINT CK_OrdfulFulfilmentResults_ReleasedQuantity CHECK (ReleasedQuantity >= 0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulFulfilmentResults_BackorderedQuantity')
BEGIN
    ALTER TABLE dbo.OrdfulFulfilmentResults
        ADD CONSTRAINT CK_OrdfulFulfilmentResults_BackorderedQuantity CHECK (BackorderedQuantity >= 0);
END
GO

-- ------------------------------------------------------------
-- 4. Backorders (one "Open" backorder per partially released order)
-- ------------------------------------------------------------
IF OBJECT_ID('dbo.OrdfulBackorders') IS NULL
BEGIN
    CREATE TABLE dbo.OrdfulBackorders
    (
        BackorderId          INT IDENTITY(1,1) NOT NULL,
        OrderId              NVARCHAR(50)       NOT NULL,
        ProductId            NVARCHAR(50)       NOT NULL,
        BackorderedQuantity  INT                NOT NULL,
        Status               NVARCHAR(20)       NOT NULL,
        CreatedAt            DATETIME2          NOT NULL CONSTRAINT DF_OrdfulBackorders_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_OrdfulBackorders PRIMARY KEY CLUSTERED (BackorderId),
        CONSTRAINT UQ_OrdfulBackorders_OrderId UNIQUE (OrderId),
        CONSTRAINT FK_OrdfulBackorders_OrdfulOrders FOREIGN KEY (OrderId) REFERENCES dbo.OrdfulOrders (OrderId),
        CONSTRAINT CK_OrdfulBackorders_Status CHECK (Status IN ('Open')),
        CONSTRAINT CK_OrdfulBackorders_BackorderedQuantity CHECK (BackorderedQuantity > 0)
    );

    CREATE NONCLUSTERED INDEX IX_OrdfulBackorders_OrderId ON dbo.OrdfulBackorders (OrderId);
END
GO
