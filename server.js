import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 5000;

// Middleware (Increased limit for large JSON payloads)
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 

// Initialize Database
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) console.error("Database error:", err.message);
  else console.log("Connected to SQLite database.");
});

// 1. Create Users Table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT
)`);

// 2. Create Scans Table (NEW)
db.run(`CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  date TEXT,
  job_description TEXT,
  results TEXT,
  stats TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
)`);

// --- ROUTES ---

// Auth Routes (Same as before)
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const hashedPassword = bcrypt.hashSync(password, 8);
  db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, 
    [name, email, hashedPassword], 
    function(err) {
      if (err) return res.status(400).json({ error: "User exists or error." });
      res.json({ id: this.lastID, name, email });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) return res.status(404).json({ error: "User not found" });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: "Invalid password" });
    res.json({ id: user.id, name: user.name, email: user.email });
  });
});

// --- NEW HISTORY ROUTES ---

// Save a Scan
app.post('/api/save-scan', (req, res) => {
  const { userId, title, jobDescription, results, stats } = req.body;
  
  const date = new Date().toISOString();
  const resultsJson = JSON.stringify(results);
  const statsJson = JSON.stringify(stats);

  db.run(`INSERT INTO scans (user_id, title, date, job_description, results, stats) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, date, jobDescription, resultsJson, statsJson],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, scanId: this.lastID });
    }
  );
});

// Get History List
app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT id, title, date, stats FROM scans WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Parse stats back to object for the frontend list
    const history = rows.map(r => ({
      ...r,
      stats: JSON.parse(r.stats)
    }));
    res.json(history);
  });
});

// Load Specific Scan
app.get('/api/scan/:scanId', (req, res) => {
  const { scanId } = req.params;
  db.get(`SELECT * FROM scans WHERE id = ?`, [scanId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Scan not found" });
    res.json({
      ...row,
      results: JSON.parse(row.results)
    });
  });
});

app.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
