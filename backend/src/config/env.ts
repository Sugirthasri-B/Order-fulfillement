import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
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
