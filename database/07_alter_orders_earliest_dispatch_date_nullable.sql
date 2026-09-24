-- ============================================================
-- 07_alter_orders_earliest_dispatch_date_nullable.sql
-- Makes OrdfulOrders.EarliestDispatchDate nullable and updates its
-- check constraint to tolerate NULL, so Phase 6 order fulfilment
-- can store a blocked order (which has no assigned warehouse and
-- therefore no dispatch date) without violating NOT NULL.
--
-- Safe to run multiple times. Skip on a brand-new database
-- created from 02_create_tables.sql / 03_constraints.sql, which
-- already define the column as nullable.
-- ============================================================

USE MOBDB_DEV;
GO

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_OrdfulOrders_DispatchBeforeOrOnPromised'
)
BEGIN
    ALTER TABLE dbo.OrdfulOrders DROP CONSTRAINT CK_OrdfulOrders_DispatchBeforeOrOnPromised;
END
GO

ALTER TABLE dbo.OrdfulOrders
    ALTER COLUMN EarliestDispatchDate DATE NULL;
GO

ALTER TABLE dbo.OrdfulOrders
    ADD CONSTRAINT CK_OrdfulOrders_DispatchBeforeOrOnPromised
        CHECK (EarliestDispatchDate IS NULL OR EarliestDispatchDate <= PromisedDeliveryDate);
GO
