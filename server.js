// server.js
const express = require('express');
const path = require('path');
const { getOrCreateUser, resetUserPapers } = require('./db');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/records',   require('./routes/records'));

// 重置考卷进度（保留错题记录）
app.post('/api/papers/reset', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '缺少 name' });
  const user = getOrCreateUser(String(name).trim());
  resetUserPapers(user.id);
  res.json({ ok: true });
});

app.get('/exam',     (req, res) => res.sendFile(path.join(__dirname, 'public/exam.html')));
app.get('/practice', (req, res) => res.sendFile(path.join(__dirname, 'public/practice.html')));
app.get('/result',   (req, res) => res.sendFile(path.join(__dirname, 'public/result.html')));
app.get('/wrong',    (req, res) => res.sendFile(path.join(__dirname, 'public/wrong.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
