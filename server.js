import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve path variables for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Initialize Database
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) console.error("Database error:", err.message);
  else console.log("Connected to SQLite database.");
});

// Users Table
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT
)`);

// Scans Table (History)
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

// --- API ROUTES ---

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const hashedPassword = bcrypt.hashSync(password, 8);
  db.run(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`, 
    [name, email, hashedPassword], 
    function(err) {
      if (err) return res.status(400).json({ error: "User already exists." });
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

app.post('/api/save-scan', (req, res) => {
  const { userId, title, jobDescription, results, stats } = req.body;
  const date = new Date().toISOString();
  db.run(`INSERT INTO scans (user_id, title, date, job_description, results, stats) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, date, jobDescription, JSON.stringify(results), JSON.stringify(stats)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, scanId: this.lastID });
    }
  );
});

app.get('/api/history/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT id, title, date, stats FROM scans WHERE user_id = ? ORDER BY date DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const history = rows.map(r => ({ ...r, stats: JSON.parse(r.stats) }));
    res.json(history);
  });
});

app.get('/api/scan/:scanId', (req, res) => {
  const { scanId } = req.params;
  db.get(`SELECT * FROM scans WHERE id = ?`, [scanId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Scan not found" });
    res.json({ ...row, results: JSON.parse(row.results) });
  });
});

// --- SERVE FRONTEND (Crucial for Render) ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
