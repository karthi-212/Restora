// File-based persistent storage for serverless functions
// Data persists across server restarts

const fs = require('fs').promises;
const path = require('path');

// Storage directory (use /tmp for serverless, or data/ for local)
const STORAGE_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist, that's fine
    if (err.code !== 'EEXIST') {
      console.warn('Could not create storage directory:', err);
    }
  }
}

// Get file path for a data type
function getFilePath(dataType) {
  return path.join(STORAGE_DIR, `${dataType}.json`);
}

// Load data from file
async function loadData(dataType, defaultValue = []) {
  try {
    await ensureStorageDir();
    const filePath = getFilePath(dataType);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist yet, return default
      return defaultValue;
    }
    console.error(`Error loading ${dataType}:`, err);
    return defaultValue;
  }
}

// Save data to file
async function saveData(dataType, data) {
  try {
    await ensureStorageDir();
    const filePath = getFilePath(dataType);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error saving ${dataType}:`, err);
    return false;
  }
}

// Initialize data from files
async function initializeData() {
  const [reviews, reservations, menu, sales] = await Promise.all([
    loadData('reviews', []),
    loadData('reservations', []),
    loadData('menu', []),
    loadData('sales', [])
  ]);

  return { reviews, reservations, menu, sales };
}

module.exports = {
  loadData,
  saveData,
  initializeData,
  getFilePath
};

