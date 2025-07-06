/**
 * Database Connection Module
 * Provides PostgreSQL connection pool for the application
 */

const { Pool } = require('pg');

// Create a pool of connections to the PostgreSQL database
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'affiliate_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  // Set max connections based on expected load
  max: 20,
  // How long a client is allowed to remain idle before being closed
  idleTimeoutMillis: 30000,
  // How long a client will wait to get a connection from the pool
  connectionTimeoutMillis: 2000,
});

// Log connection status
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Export query method for use in other modules
module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
