// db.js — SQLite 初始化与查询封装
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'exam.db'));

// 开启 WAL 模式提升并发读性能
db.pragma('journal_mode = WAL');

// 建表
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

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
function insertRecord({ userId, questionId, userAnswer, correctAnswer, isCorrect }) {
  return db.prepare(
    'INSERT INTO records (user_id, question_id, user_answer, correct_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, questionId, userAnswer, correctAnswer, isCorrect ? 1 : 0);
}

/**
 * 查询某用户的错题列表
 * 每道题只返回最近一次答错的记录
 */
function getWrongRecords(userId) {
  return db.prepare(`
    SELECT r.question_id, r.user_answer, r.correct_answer, r.answered_at
    FROM records r
    INNER JOIN (
      SELECT question_id, MAX(answered_at) AS latest
      FROM records
      WHERE user_id = ? AND is_correct = 0
      GROUP BY question_id
    ) AS latest ON r.question_id = latest.question_id AND r.answered_at = latest.latest
    WHERE r.user_id = ?
    ORDER BY r.answered_at DESC
  `).all(userId, userId);
}

module.exports = { getOrCreateUser, insertRecord, getWrongRecords };
