import 'dotenv/config';

module.exports = {
  migrationsDirectory: 'db/migrations',
  migrationsTable: 'pgmigrations',
  dbClient: 'pg',
  connectionString: process.env.DATABASE_URL || 'postgresql://sofem_user:sofem_password_dev@localhost:5432/sofem_mes',
  direction: 'up',
  ignorePattern: 'down_.*\\.ts$',
  templateFileName: 'up_',
};
