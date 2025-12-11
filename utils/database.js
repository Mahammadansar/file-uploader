const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
let db = null;

/**
 * Initialize database
 */
function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      // Create files table
      db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          fileName TEXT NOT NULL,
          fileSize INTEGER NOT NULL,
          key TEXT NOT NULL,
          url TEXT,
          createdAt TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }
        console.log('Database initialized successfully');
        resolve();
      });
    });
  });
}

/**
 * Save file metadata
 */
function saveFileMetadata(fileData) {
  return new Promise((resolve, reject) => {
    const { id, fileName, fileSize, key, url, createdAt } = fileData;

    db.run(
      `INSERT INTO files (id, fileName, fileSize, key, url, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, fileName, fileSize, key, url, createdAt],
      function(err) {
        if (err) {
          console.error('Error saving file metadata:', err);
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
}

/**
 * Get file metadata by ID
 */
function getFileMetadata(id) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM files WHERE id = ?',
      [id],
      (err, row) => {
        if (err) {
          console.error('Error getting file metadata:', err);
          reject(err);
          return;
        }
        resolve(row || null);
      }
    );
  });
}

/**
 * Close database connection
 */
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  saveFileMetadata,
  getFileMetadata,
  closeDatabase
};

