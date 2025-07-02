const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DATA_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '../data');
const DATA_FILE = process.env.DATA_PATH || path.join(DATA_DIR, 'groups.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Create timestamped backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `groups-${timestamp}.json`);

try {
  // Ensure directories exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Create the backup
  fs.copyFileSync(DATA_FILE, backupFile);
  console.log(`Backup created: ${backupFile}`);

  // Clean up old backups (keep last 7)
  exec(`ls -t ${BACKUP_DIR} | tail -n +8 | xargs -I {} rm ${BACKUP_DIR}/{}`, (error) => {
    if (error) {
      console.error('Error cleaning old backups:', error);
    } else {
      console.log('Cleaned up old backups');
    }
  });
} catch (err) {
  console.error('Backup failed:', err);
  process.exit(1);
}