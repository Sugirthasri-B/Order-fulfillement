import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /**
   * Stage 2 / CHANGE1: a Priority order is "Partially Released" when at
   * least this percentage of the requested quantity is available across
   * warehouses. Kept as an integer percent (not a 0-1 fraction) so the
   * "exactly 70% qualifies" boundary can be checked with exact integer
   * arithmetic (releasedQty * 100 >= quantity * thresholdPercent),
   * avoiding floating-point comparison bugs at the boundary.
   */
  priorityPartialReleaseThresholdPercent: Number(process.env.PRIORITY_PARTIAL_RELEASE_THRESHOLD_PERCENT) || 70,
  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    database: process.env.DB_NAME || 'OrderFulfilmentDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};
