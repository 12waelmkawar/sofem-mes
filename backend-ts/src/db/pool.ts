import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Neon database detection (serverless PostgreSQL with PgBouncer)
const isNeon = process.env.DATABASE_URL?.includes('neon.tech') ||
               process.env.DATABASE_URL?.includes('neonctl') ||
               process.env.DATABASE_URL?.includes('ep-');

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://sofem_user:sofem_password_dev@localhost:5432/sofem_mes',
  
  // SSL Configuration:
  // Neon ALWAYS requires SSL (even in development)
  // Local PostgreSQL: no SSL
  ssl: isNeon || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  
  // Connection pool limits:
  // Neon free tier: 10 connections max per pooler endpoint
  // Neon default pooler endpoint already includes PgBouncer
  // Local dev: higher limits
  max: isNeon ? 8 : 20,
  
  // Neon compute suspension timeout:
  // Cold starts can take 1-3 seconds
  // Increase timeout for Neon to handle wake-up
  connectionTimeoutMillis: isNeon ? 15000 : 5000,
  
  idleTimeoutMillis: 30000,
  
  // IMPORTANT for Neon/PgBouncer:
  // Disable prepared statements (not supported in PgBouncer transaction mode)
  // Neon's pooler endpoint uses PgBouncer by default
  statement_timeout: 30000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit in production/serverless (Neon may suspend)
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    return originalRelease();
  };

  return client;
};

// Helper to check if database connection is alive (handles Neon cold starts)
export const testConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};
