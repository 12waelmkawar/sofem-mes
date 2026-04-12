-- SOFEM MES Database Initialization Script
-- This script runs on first database startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema for SOFEM MES
-- Tables will be created by migration scripts

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE sofem_mes TO sofem_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sofem_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sofem_user;

COMMENT ON DATABASE sofem_mes IS 'SOFEM MES - Manufacturing Execution System v6.0';
