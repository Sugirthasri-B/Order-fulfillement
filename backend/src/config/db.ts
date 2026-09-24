import sql, { ConnectionPool } from 'mssql';
import { env } from './env';

const config: sql.config = {
  server: env.db.server,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  options: {
    encrypt: env.db.encrypt,
    trustServerCertificate: env.db.trustServerCertificate,
  },
};

let pool: ConnectionPool | null = null;

export const getPool = async (): Promise<ConnectionPool> => {
  if (pool) {
    return pool;
  }
  pool = await new sql.ConnectionPool(config).connect();
  return pool;
};

/**
 * Closes the shared connection pool, if open. Used by the test suite so
 * Jest can exit cleanly instead of hanging on an open TCP handle.
 */
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};
