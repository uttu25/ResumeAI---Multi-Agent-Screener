import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Database (Creates a file named 'users.db')
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) console.error("Database error:", err.message);
  else console.log("Connected to SQLite database.");
});

// Create Users Table if not exists
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT
)`);

// --- ROUTES ---

// 1. REGISTER (Sign Up)
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });

  // Encrypt password
  const hashedPassword = bcrypt.hashSync(password, 8);

  db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, 
    [name, email, hashedPassword], 
    function(err) {
      if (err) return res.status(400).json({ error: "User already exists or error occurred." });
      res.json({ id: this.lastID, name, email });
    }
  );
});

// 2. LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check Password
    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid password" });

    // Success
    res.json({ id: user.id, name: user.name, email: user.email });
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
