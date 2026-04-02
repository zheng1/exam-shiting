// server.js
const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/records', require('./routes/records'));

// 路由回退：返回对应页面
app.get('/exam', (req, res) => res.sendFile(path.join(__dirname, 'public/exam.html')));
app.get('/result', (req, res) => res.sendFile(path.join(__dirname, 'public/result.html')));
app.get('/wrong', (req, res) => res.sendFile(path.join(__dirname, 'public/wrong.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
