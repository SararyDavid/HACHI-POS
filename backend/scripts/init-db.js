const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runInitDb() {
  console.log('=== Hachi Tech POS Database Initialization ===');
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'hachi_pos';

  console.log(`Target: ${user}@${host}:${port}`);

  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log('1. Connected to MySQL Server successfully.');
    
    const schemaFile = path.join(__dirname, '..', 'schema.sql');
    if (!fs.existsSync(schemaFile)) {
      throw new Error(`Schema file not found at: ${schemaFile}`);
    }

    const sql = fs.readFileSync(schemaFile, 'utf8');
    console.log(`2. Executing schema & seed SQL from ${schemaFile}...`);
    
    await connection.query(sql);
    console.log('3. Schema initialized & seed products loaded into MySQL!');

    await connection.end();
    console.log('=== Database initialization completed successfully! ===');
    process.exit(0);
  } catch (error) {
    console.error('=== Initialization Failed ===');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.log('\nTip: Please verify DB_USER and DB_PASSWORD in backend/.env match your local MySQL configuration.');
    process.exit(1);
  }
}

runInitDb();
