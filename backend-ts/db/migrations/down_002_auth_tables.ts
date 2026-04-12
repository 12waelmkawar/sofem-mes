import { query } from '../../src/db/pool.js';

async function run() {
  console.log('Rolling back migration: auth tables...');
  await query('DROP TABLE IF EXISTS failed_logins CASCADE');
  await query('DROP TABLE IF EXISTS sessions CASCADE');
  console.log('✓ Auth tables dropped.');
}

run().catch(err => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
