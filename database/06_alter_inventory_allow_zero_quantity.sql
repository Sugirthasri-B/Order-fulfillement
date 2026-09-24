-- ============================================================
-- 06_alter_inventory_allow_zero_quantity.sql
-- Relaxes CK_OrdfulInventory_AvailableQuantity from "> 0" to ">= 0"
-- so order fulfilment (Phase 6) can deduct a warehouse down to
-- empty. Creation of new inventory still requires a positive
-- quantity, enforced by the API's validation layer.
--
-- Safe to run multiple times. Skip on a brand-new database
-- created from 02_create_tables.sql / 03_constraints.sql, which
-- already define the ">= 0" check.
-- ============================================================

USE MOBDB_DEV;
GO

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_OrdfulInventory_AvailableQuantity'
)
BEGIN
    ALTER TABLE dbo.OrdfulInventory DROP CONSTRAINT CK_OrdfulInventory_AvailableQuantity;
END
GO

ALTER TABLE dbo.OrdfulInventory
    ADD CONSTRAINT CK_OrdfulInventory_AvailableQuantity
        CHECK (AvailableQuantity >= 0);
GO
