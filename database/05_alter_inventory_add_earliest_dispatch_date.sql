-- ============================================================
-- 05_alter_inventory_add_earliest_dispatch_date.sql
-- Adds EarliestDispatchDate to an OrdfulInventory table that was
-- created before Phase 5 (OrdfulInventory Management).
--
-- Safe to run multiple times. Skip this script entirely on a
-- brand-new database created from 02_create_tables.sql, which
-- already includes this column.
-- ============================================================

USE MOBDB_DEV;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.OrdfulInventory')
      AND name = 'EarliestDispatchDate'
)
BEGIN
    -- Backfill existing rows with a default, then drop the default so
    -- future inserts must supply an explicit EarliestDispatchDate.
    ALTER TABLE dbo.OrdfulInventory
        ADD EarliestDispatchDate DATE NOT NULL
            CONSTRAINT DF_OrdfulInventory_EarliestDispatchDate_Backfill DEFAULT ('2026-01-01') WITH VALUES;

    ALTER TABLE dbo.OrdfulInventory
        DROP CONSTRAINT DF_OrdfulInventory_EarliestDispatchDate_Backfill;
END
GO
