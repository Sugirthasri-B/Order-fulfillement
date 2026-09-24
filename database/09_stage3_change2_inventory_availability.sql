-- ============================================================
-- 09_stage3_change2_inventory_availability.sql
-- Stage 3 / CHANGE2: recording newly available inventory and
-- applying it to the oldest open backorder for a product.
--
-- This script:
--   1. Widens the OrdfulBackorders Status check constraint to
--      also allow 'Closed' (previously only 'Open' was allowed —
--      a backorder could never be closed before this change).
--   2. Widens the OrdfulBackorders BackorderedQuantity check
--      constraint to allow 0 (previously required > 0 — a closed
--      backorder's remaining quantity is exactly 0).
--   3. Adds an index to support finding the oldest open backorder
--      for a product efficiently (ProductId, Status, CreatedAt).
--
-- Safe to run multiple times.
-- ============================================================

USE MOBDB_DEV;
GO

-- ------------------------------------------------------------
-- 1. Allow 'Closed' as a backorder status
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulBackorders_Status')
BEGIN
    ALTER TABLE dbo.OrdfulBackorders DROP CONSTRAINT CK_OrdfulBackorders_Status;
END
GO

ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT CK_OrdfulBackorders_Status
        CHECK (Status IN ('Open', 'Closed'));
GO

-- ------------------------------------------------------------
-- 2. Allow BackorderedQuantity = 0 (a closed backorder has
--    nothing left outstanding)
-- ------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_OrdfulBackorders_BackorderedQuantity')
BEGIN
    ALTER TABLE dbo.OrdfulBackorders DROP CONSTRAINT CK_OrdfulBackorders_BackorderedQuantity;
END
GO

ALTER TABLE dbo.OrdfulBackorders
    ADD CONSTRAINT CK_OrdfulBackorders_BackorderedQuantity
        CHECK (BackorderedQuantity >= 0);
GO

-- ------------------------------------------------------------
-- 3. Index to find the oldest open backorder for a product
--    (ORDER BY CreatedAt ASC, OrderId ASC WHERE ProductId = ? AND Status = 'Open')
-- ------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_OrdfulBackorders_ProductId_Status_CreatedAt'
      AND object_id = OBJECT_ID('dbo.OrdfulBackorders')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrdfulBackorders_ProductId_Status_CreatedAt
        ON dbo.OrdfulBackorders (ProductId, Status, CreatedAt);
END
GO
