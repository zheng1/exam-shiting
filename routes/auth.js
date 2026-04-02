// routes/auth.js
const express = require('express');
const router = express.Router();
const { getOrCreateUser } = require('../db');

const PASSWORD = 'zhu88jie';

// POST /api/auth  { password, name }
router.post('/', (req, res) => {
  const { password, name } = req.body;
  if (!password || password !== PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ error: '请输入姓名' });
  }
  const user = getOrCreateUser(trimmedName);
  res.json({ ok: true, userId: user.id, name: user.name });
});

module.exports = router;
