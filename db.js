// db.js — SQLite 初始化与查询封装
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'exam.db'));

db.pragma('journal_mode = WAL');

// 建表 - users
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 建表 - exam_papers（先建，records 会引用它）
db.prepare(`
  CREATE TABLE IF NOT EXISTS exam_papers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    question_ids TEXT    NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

// 建表 - records（含 paper_id，用于全新安装）
db.prepare(`
  CREATE TABLE IF NOT EXISTS records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    question_id    INTEGER NOT NULL,
    user_answer    TEXT    NOT NULL,
    correct_answer TEXT    NOT NULL,
    is_correct     INTEGER NOT NULL,
    paper_id       INTEGER REFERENCES exam_papers(id),
    answered_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

// 迁移：为已存在的 records 表增加 paper_id 列（如已存在则忽略）
try {
  db.prepare('ALTER TABLE records ADD COLUMN paper_id INTEGER REFERENCES exam_papers(id)').run();
} catch (e) { /* 列已存在，忽略 */ }

// 索引
db.prepare('CREATE INDEX IF NOT EXISTS idx_exam_papers_user ON exam_papers(user_id, completed_at)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_records_paper ON records(paper_id)').run();

/** 获取或创建用户，返回 { id, name } */
function getOrCreateUser(name) {
  let user = db.prepare('SELECT id, name FROM users WHERE name = ?').get(name);
  if (!user) {
    const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
    user = { id: result.lastInsertRowid, name };
  }
  return user;
}

/** 插入一条答题记录 */
function insertRecord({ userId, questionId, userAnswer, correctAnswer, isCorrect, paperId }) {
  return db.prepare(
    'INSERT INTO records (user_id, question_id, user_answer, correct_answer, is_correct, paper_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, questionId, userAnswer, correctAnswer, isCorrect ? 1 : 0, paperId || null);
}

/**
 * 查询某用户的错题列表
 * 每道题只返回最近一次的答题记录，且该次答错才算错题
 * （若最近一次答对，则已从错题集移除）
 */
function getWrongRecords(userId) {
  return db.prepare(`
    SELECT r.question_id, r.user_answer, r.correct_answer, r.answered_at
    FROM records r
    INNER JOIN (
      SELECT question_id, MAX(answered_at) AS latest
      FROM records
      WHERE user_id = ?
      GROUP BY question_id
    ) AS lv ON r.question_id = lv.question_id AND r.answered_at = lv.latest
    WHERE r.user_id = ? AND r.is_correct = 0
    ORDER BY r.answered_at DESC
  `).all(userId, userId);
}

/** 获取用户当前进行中的考卷 */
function getActivePaper(userId) {
  return db.prepare(
    'SELECT * FROM exam_papers WHERE user_id = ? AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1'
  ).get(userId);
}

/** 根据 ID 获取考卷 */
function getPaperById(paperId) {
  return db.prepare('SELECT * FROM exam_papers WHERE id = ?').get(paperId);
}

/** 创建新考卷，返回考卷对象 */
function createPaper(userId, questionIds) {
  const result = db.prepare(
    'INSERT INTO exam_papers (user_id, question_ids) VALUES (?, ?)'
  ).run(userId, JSON.stringify(questionIds));
  return getPaperById(result.lastInsertRowid);
}

/** 标记考卷完成 */
function completePaper(paperId) {
  db.prepare('UPDATE exam_papers SET completed_at = CURRENT_TIMESTAMP WHERE id = ?').run(paperId);
}

/** 获取某张考卷的已答情况：{ questionId: { userAnswer, correctAnswer, isCorrect } } */
function getPaperAnswers(paperId, userId) {
  const rows = db.prepare(
    'SELECT question_id, user_answer, correct_answer, is_correct FROM records WHERE paper_id = ? AND user_id = ?'
  ).all(paperId, userId);
  const map = {};
  for (const r of rows) {
    map[r.question_id] = {
      userAnswer:    r.user_answer,
      correctAnswer: r.correct_answer,
      isCorrect:     r.is_correct === 1,
    };
  }
  return map;
}

/** 获取用户在所有考卷中出现过的题目 ID 列表（用于排除重复） */
function getSeenQuestionIds(userId) {
  const rows = db.prepare(
    "SELECT DISTINCT j.value AS qid FROM exam_papers e, json_each(e.question_ids) j WHERE e.user_id = ?"
  ).all(userId);
  return rows.map(r => r.qid);
}

/** 获取某张考卷中已答题的数量 */
function getPaperAnsweredCount(paperId, userId) {
  const row = db.prepare(
    'SELECT COUNT(DISTINCT question_id) AS cnt FROM records WHERE paper_id = ? AND user_id = ?'
  ).get(paperId, userId);
  return row ? row.cnt : 0;
}

/** 重置用户所有考卷进度（保留答题记录） */
function resetUserPapers(userId) {
  db.prepare('UPDATE records SET paper_id = NULL WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM exam_papers WHERE user_id = ?').run(userId);
}

module.exports = {
  getOrCreateUser,
  insertRecord,
  getWrongRecords,
  getActivePaper,
  getPaperById,
  createPaper,
  completePaper,
  getPaperAnswers,
  getSeenQuestionIds,
  getPaperAnsweredCount,
  resetUserPapers,
};
