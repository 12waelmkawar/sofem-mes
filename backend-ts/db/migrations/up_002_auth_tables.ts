import { query } from '../../src/db/pool.js';

async function run() {
  console.log('Applying migration: sessions and failed_logins tables...');

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      session_token VARCHAR NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at) WHERE revoked_at IS NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS failed_logins (
      id BIGSERIAL PRIMARY KEY,
      attempted_pin_hash VARCHAR(64),
      ip_address VARCHAR(45) NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_user_id INT REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_logins(ip_address);
    CREATE INDEX IF NOT EXISTS idx_failed_logins_created ON failed_logins(created_at);
  `);

  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_must_change BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
  `);

  console.log('✓ Sessions and failed_logins tables created.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
