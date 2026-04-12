import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sofem_mes',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

// Health check
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

export async function transaction<T>(fn: (q: (text: string, params?: any[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txQuery = async (text: string, params?: any[]) => {
      return client.query(text, params);
    };
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
