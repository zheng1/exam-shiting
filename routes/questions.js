// routes/questions.js
const express = require('express');
const router = express.Router();
const questions = require('../data/questions.json');
const {
  getOrCreateUser,
  getActivePaper,
  createPaper,
  getPaperAnswers,
  getSeenQuestionIds,
} = require('../db');

const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/questions?name=alice
router.get('/', (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: '缺少 name 参数' });

  const user = getOrCreateUser(name);

  // 查当前进行中的考卷
  let paper = getActivePaper(user.id);

  if (!paper) {
    // 找出已出现过的题目 ID，生成新考卷
    const seenIds = new Set(getSeenQuestionIds(user.id));
    const pool = questions.filter(q => !seenIds.has(q.id));

    if (pool.length === 0) {
      return res.json({ allDone: true, total: questions.length });
    }

    const selected = shuffle(pool).slice(0, 100);
    paper = createPaper(user.id, selected.map(q => q.id));
  }

  // 获取当前考卷的已答情况
  const answeredMap = getPaperAnswers(paper.id, user.id);

  // 按考卷顺序构建题目列表
  const paperQuestions = JSON.parse(paper.question_ids)
    .map(id => qMap[id])
    .filter(Boolean);

  res.json({ paperId: paper.id, questions: paperQuestions, answeredMap });
});

module.exports = router;
