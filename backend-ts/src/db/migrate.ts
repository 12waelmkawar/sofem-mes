import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'sql');

async function runMigrations() {
  console.log('Running migrations...');

  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Get already applied migrations
  const { rows: applied } = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY id'
  );
  const appliedFiles = new Set(applied.map(r => r.filename));

  // Read all SQL files
  const files = await fs.readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  for (const file of sqlFiles) {
    if (appliedFiles.has(file)) {
      console.log(`  ✓ Already applied: ${file}`);
      continue;
    }

    console.log(`  Applying: ${file}`);
    const sql = await fs.readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    await query(sql);
    await query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    console.log(`  ✓ Applied: ${file}`);
  }

  console.log('Migrations complete.');
  await pool.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
