// routes/records.js
const express = require('express');
const router = express.Router();
const { getOrCreateUser, insertRecord, getWrongRecords } = require('../db');
const questions = require('../data/questions.json');

// 题目 ID → 题目对象的查找表
const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

/** 规范化答案：排序字母，便于比对多选题 */
function normalizeAnswer(ans) {
  return String(ans).trim().toUpperCase().split('').sort().join('');
}

// POST /api/records  { name, questionId, userAnswer }
router.post('/', (req, res) => {
  const { name, questionId, userAnswer } = req.body;
  if (!name || questionId == null || userAnswer == null) {
    return res.status(400).json({ error: '参数缺失' });
  }
  const q = qMap[questionId];
  if (!q) return res.status(404).json({ error: '题目不存在' });

  const user = getOrCreateUser(String(name).trim());
  const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(q.answer);

  insertRecord({
    userId: user.id,
    questionId: q.id,
    userAnswer: String(userAnswer).trim().toUpperCase(),
    correctAnswer: q.answer,
    isCorrect,
  });

  res.json({ ok: true, isCorrect, correctAnswer: q.answer });
});

// GET /api/records/:name  返回错题列表（含题目详情）
router.get('/:name', (req, res) => {
  const user = getOrCreateUser(req.params.name);
  const records = getWrongRecords(user.id);
  const result = records
    .map(r => ({ ...r, question: qMap[r.question_id] || null }))
    .filter(r => r.question);
  res.json(result);
});

module.exports = router;
