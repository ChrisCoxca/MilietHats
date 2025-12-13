// js/db.js
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'database.db');

// Asegura carpeta uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error abriendo DB:', err);
  } else {
    console.log('Conectado a database.db');
  }
});

db.serialize(() => {
  // Tabla productos
  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock INTEGER NOT NULL,
      description TEXT,
      images TEXT
    )
  `);

  // Tabla pedidos
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      telefono TEXT,
      direccion TEXT,
      total REAL,
      estado TEXT DEFAULT 'pendiente',
      paypalOrderID TEXT,
      carrito TEXT
    )
  `);
});

module.exports = db;
