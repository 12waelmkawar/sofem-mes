import { query, pool } from './src/db/pool.js';

async function run() {
  try {
    await query('ALTER TABLE ordres_fabrication ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE');
    console.log('✓ actif column added to ordres_fabrication');
    
    // Also add to of_operations if missing
    await query('ALTER TABLE of_operations ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT TRUE');
    console.log('✓ actif column added to of_operations');

    // Add updated_at trigger if not exists
    await query(`
      CREATE OR REPLACE TRIGGER trg_ordres_fabrication_updated_at 
      BEFORE UPDATE ON ordres_fabrication 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('✓ updated_at trigger added to ordres_fabrication');

    await pool.end();
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

run();
