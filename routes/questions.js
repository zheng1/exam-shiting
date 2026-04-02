// routes/questions.js
const express = require('express');
const router = express.Router();
const questions = require('../data/questions.json');

// Fisher-Yates 洗牌
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/questions?count=20&types=single,multiple,judge
router.get('/', (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 20, 100);
  const types = req.query.types
    ? req.query.types.split(',').map(t => t.trim())
    : ['single', 'multiple', 'judge'];

  const pool = questions.filter(q => types.includes(q.type) || (q.section === '案例分析' && (types.includes('single') || types.includes('multiple'))));
  if (!pool.length) return res.json([]);

  res.json(shuffle(pool).slice(0, count));
});

module.exports = router;
