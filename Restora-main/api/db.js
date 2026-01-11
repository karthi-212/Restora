// File-based database for Vercel compatibility
// Uses JSON files instead of SQLite (no native compilation needed)

const fs = require('fs').promises;
const path = require('path');

// Database directory (use /tmp for Vercel, or data/ for local)
// Check for Vercel environment variables
const IS_VERCEL = process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION;
const DB_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'restora.json');

// Ensure directory exists
async function ensureDir() {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.warn('Could not create database directory:', err);
    }
  }
}

// Load database from file
async function loadDB() {
  try {
    await ensureDir();
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, return default structure
      return {
        users: [],
        menu: [],
        reservations: [],
        reviews: [],
        orders: [],
        sales: []
      };
    }
    console.error('Error loading database:', err);
    return {
      users: [],
      menu: [],
      reservations: [],
      reviews: [],
      orders: [],
      sales: []
    };
  }
}

// Save database to file
async function saveDB(data) {
  try {
    await ensureDir();
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving database:', err);
    return false;
  }
}

// Database operations
const db = {
  // Users
  async getUsers() {
    const data = await loadDB();
    return data.users || [];
  },
  
  async getUserByEmail(email) {
    const users = await this.getUsers();
    return users.find(u => u.email === email) || null;
  },
  
  async createUser(user) {
    const data = await loadDB();
    if (!data.users) data.users = [];
    data.users.push(user);
    await saveDB(data);
    return user;
  },
  
  async updateUser(id, updates) {
    const data = await loadDB();
    if (!data.users) data.users = [];
    const index = data.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    data.users[index] = { ...data.users[index], ...updates, updated_at: Math.floor(Date.now() / 1000) };
    await saveDB(data);
    return data.users[index];
  },
  
  // Menu
  async getMenu() {
    const data = await loadDB();
    return data.menu || [];
  },
  
  async getMenuItem(id) {
    const menu = await this.getMenu();
    return menu.find(m => m.id === id) || null;
  },
  
  async createMenuItem(item) {
    const data = await loadDB();
    if (!data.menu) data.menu = [];
    data.menu.push(item);
    await saveDB(data);
    return item;
  },
  
  async updateMenuItem(id, updates) {
    const data = await loadDB();
    if (!data.menu) data.menu = [];
    const index = data.menu.findIndex(m => m.id === id);
    if (index === -1) return null;
    data.menu[index] = { ...data.menu[index], ...updates, updated_at: Math.floor(Date.now() / 1000) };
    await saveDB(data);
    return data.menu[index];
  },
  
  async deleteMenuItem(id) {
    const data = await loadDB();
    if (!data.menu) data.menu = [];
    data.menu = data.menu.filter(m => m.id !== id);
    await saveDB(data);
    return true;
  },
  
  // Reservations
  async getReservations() {
    const data = await loadDB();
    return data.reservations || [];
  },
  
  async getReservation(id) {
    const reservations = await this.getReservations();
    return reservations.find(r => r.id === id) || null;
  },
  
  async createReservation(reservation) {
    const data = await loadDB();
    if (!data.reservations) data.reservations = [];
    data.reservations.push(reservation);
    await saveDB(data);
    return reservation;
  },
  
  async updateReservation(id, updates) {
    const data = await loadDB();
    if (!data.reservations) data.reservations = [];
    const index = data.reservations.findIndex(r => r.id === id);
    if (index === -1) return null;
    data.reservations[index] = { ...data.reservations[index], ...updates, updated_at: Math.floor(Date.now() / 1000) };
    await saveDB(data);
    return data.reservations[index];
  },
  
  async deleteReservation(id) {
    const data = await loadDB();
    if (!data.reservations) data.reservations = [];
    data.reservations = data.reservations.filter(r => r.id !== id);
    await saveDB(data);
    return true;
  },
  
  // Reviews
  async getReviews() {
    const data = await loadDB();
    return data.reviews || [];
  },
  
  async getReview(id) {
    const reviews = await this.getReviews();
    return reviews.find(r => r.id === id) || null;
  },
  
  async createReview(review) {
    const data = await loadDB();
    if (!data.reviews) data.reviews = [];
    data.reviews.push(review);
    await saveDB(data);
    return review;
  },
  
  async deleteReview(id) {
    const data = await loadDB();
    if (!data.reviews) data.reviews = [];
    data.reviews = data.reviews.filter(r => r.id !== id);
    await saveDB(data);
    return true;
  },
  
  // Orders
  async getOrders() {
    const data = await loadDB();
    return data.orders || [];
  },
  
  async getOrder(id) {
    const orders = await this.getOrders();
    return orders.find(o => o.id === id) || null;
  },
  
  async createOrder(order) {
    const data = await loadDB();
    if (!data.orders) data.orders = [];
    data.orders.push(order);
    await saveDB(data);
    return order;
  },
  
  async updateOrder(id, updates) {
    const data = await loadDB();
    if (!data.orders) data.orders = [];
    const index = data.orders.findIndex(o => o.id === id);
    if (index === -1) return null;
    data.orders[index] = { ...data.orders[index], ...updates, updated_at: Math.floor(Date.now() / 1000) };
    await saveDB(data);
    return data.orders[index];
  },
  
  // Sales
  async getSales() {
    const data = await loadDB();
    return data.sales || [];
  },
  
  async createSale(sale) {
    const data = await loadDB();
    if (!data.sales) data.sales = [];
    data.sales.push(sale);
    await saveDB(data);
    return sale;
  },
  
  async createSales(sales) {
    const data = await loadDB();
    if (!data.sales) data.sales = [];
    data.sales.push(...sales);
    await saveDB(data);
    return sales;
  }
};

// Initialize database with default data
async function initializeDatabase() {
  const data = await loadDB();
  let needsInit = false;
  
  // Initialize users - no default users
  if (!data.users || data.users.length === 0) {
    data.users = [];
  }
  
  // Initialize menu
  if (!data.menu || data.menu.length === 0) {
    data.menu = [
      {
        id: createId(),
        name: "Coq au Vin",
        price: 850,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%201.png",
        category: "Main Course",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "Bouillabaisse",
        price: 1200,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%202.png",
        category: "Main Course",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "Ratatouille",
        price: 650,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%203.png",
        category: "Vegetarian",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "Escargot",
        price: 750,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%204.png",
        category: "Appetizer",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "Crêpes",
        price: 450,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%205.png",
        category: "Dessert",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "French Onion Soup",
        price: 420,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%206.png",
        category: "Soup",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      },
      {
        id: createId(),
        name: "Beef Bourguignon",
        price: 1100,
        image: "https://raw.githubusercontent.com/karthi-212/Restora/refs/heads/main/assests/images/French%20Food%207.png",
        category: "Main Course",
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      }
    ];
    needsInit = true;
  }
  
  if (needsInit) {
    await saveDB(data);
    console.log('Database initialized successfully');
  }
}

// Initialize on module load
initializeDatabase().catch(err => {
  console.warn('Database initialization warning:', err);
});

// Helper function to create ID
function createId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = {
  db,
  createId,
  initializeDatabase,
};
