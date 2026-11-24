/**
 * Hachi Tech POS - Automated Production Database Backup Utility
 * Supports MySQL 8 (mysqldump) and Local JSON Storage with 14-day retention.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 14;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

console.log('==========================================================');
console.log('  🛡️ Hachi Tech POS - Automated Database Backup Starting   ');
console.log('==========================================================');

let backupCreated = false;

// 1. MySQL Dump (If MySQL credentials are provided)
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || '3306';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '';
const dbName = process.env.DB_NAME || 'hachi_pos';

try {
  const mysqlBackupFile = path.join(BACKUP_DIR, `mysql_${dbName}_${timestamp}.sql`);
  const pwdFlag = dbPassword ? `-p"${dbPassword}"` : '';
  const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${pwdFlag} ${dbName} > "${mysqlBackupFile}"`;

  console.log(`[Backup] Attempting MySQL dump for database '${dbName}'...`);
  execSync(cmd, { stdio: 'pipe' });
  console.log(`✓ MySQL database dump successfully written to: ${mysqlBackupFile}`);
  backupCreated = true;
} catch (err) {
  console.log(`[Backup Notice] MySQL dump skipped or failed (${err.message}).`);
}

// 2. Local Fallback JSON Snapshot
const localJsonFile = path.join(__dirname, '..', 'data', 'hachi_pos_local.json');
if (fs.existsSync(localJsonFile)) {
  const jsonBackupFile = path.join(BACKUP_DIR, `local_store_${timestamp}.json`);
  fs.copyFileSync(localJsonFile, jsonBackupFile);
  console.log(`✓ Local JSON transactional snapshot created at: ${jsonBackupFile}`);
  backupCreated = true;
}

// 3. Automated Retention Cleanup (Purge backups older than 14 days)
console.log(`[Retention] Purging backups older than ${RETENTION_DAYS} days...`);
const nowMs = Date.now();
const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

try {
  const files = fs.readdirSync(BACKUP_DIR);
  let purgedCount = 0;

  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    if (nowMs - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      purgedCount++;
    }
  }
  console.log(`✓ Retention cleanup completed. Purged ${purgedCount} expired backup files.`);
} catch (cleanErr) {
  console.warn('Retention cleanup warning:', cleanErr.message);
}

console.log('==========================================================');
console.log(backupCreated ? '  ✅ Backup Completed Successfully! ' : '  ⚠️ No databases found to backup.');
console.log('==========================================================');
