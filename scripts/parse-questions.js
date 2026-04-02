// scripts/parse-questions.js
// 解析「全媒体运营师三级视听」PDF 导出的文本 → data/questions.json
//
// 题型格式：
//   判断题：  1.题目文字（√）或（×）
//   单选题：  1.题目文字（D）\n（A）选项（B）选项（C）选项（D）选项
//   多选题：  1.题目文字（ABDE）\n（A）选项…（E）选项
//
// 先用 pdftotext 导出文本，再解析。

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Step 1: pdftotext 提取文本
const pdfPath = path.join(__dirname, '../8-全媒体运营师（视听运营）_三级_理论全题库（含答案）.pdf');
const txtPath = path.join(__dirname, '../data/raw.txt');

fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });
execFileSync('pdftotext', ['-layout', pdfPath, txtPath]);
console.log('PDF 文本提取完成');

const raw = fs.readFileSync(txtPath, 'utf-8');

// 预处理：合并跨行文本
// 每行 trim，去掉页码行（如 "1 / 185"）和标题行
const lines = raw.split('\n')
  .map(l => l.trim())
  .filter(l => l && !/^\d+\s*\/\s*\d+$/.test(l) && !/^全媒体运营师三级视听题库/.test(l));

// 合并为一个长文本
const text = lines.join(' ');

const questions = [];
let id = 1;

// ===== 判断题 =====
const judgeSection = text.match(/一、\s*判断题.+?(?=二、\s*单项选择题)/s);
if (judgeSection) {
  const judgeRegex = /(\d+)\.\s*(.+?)\s*[（(]\s*([√×✓✗xX]?)\s*[）)]/g;
  let m;
  while ((m = judgeRegex.exec(judgeSection[0])) !== null) {
    const qText = m[2].trim();
    const rawAns = m[3].trim();
    if (!rawAns) continue;
    const isCorrect = rawAns === '√' || rawAns === '✓';
    questions.push({
      id: id++,
      type: 'judge',
      section: '判断题',
      caseContext: null,
      question: qText,
      options: { A: '正确', B: '错误' },
      answer: isCorrect ? 'A' : 'B',
    });
  }
}
console.log('判断题：' + questions.length + ' 题');

// ===== 单选题 =====
const singleSection = text.match(/二、\s*单项选择题.+?(?=三、\s*多项选择题)/s);
if (singleSection) {
  parseSingleMultiple(singleSection[0], 'single', '单选题');
}
const singleCount = questions.filter(q => q.type === 'single').length;
console.log('单选题：' + singleCount + ' 题');

// ===== 多选题 =====
const multiSection = text.match(/三、\s*多项选择题.+/s);
if (multiSection) {
  parseSingleMultiple(multiSection[0], 'multiple', '多选题');
}
const multiCount = questions.filter(q => q.type === 'multiple').length;
console.log('多选题：' + multiCount + ' 题');

function parseSingleMultiple(sectionText, type, sectionName) {
  // 按 "数字." 开头分割题目块
  const blocks = sectionText.split(/(?=\d+\.)/);

  for (const block of blocks) {
    const headerMatch = block.match(/^(\d+)\.\s*(.+)/s);
    if (!headerMatch) continue;

    const fullText = headerMatch[2].trim();

    // 找第一个 （A） 选项的位置
    const firstOptionIdx = fullText.search(/[（(]\s*A\s*[）)]\s*/);
    if (firstOptionIdx < 0) continue;

    const questionPart = fullText.substring(0, firstOptionIdx).trim();
    const optionsPart = fullText.substring(firstOptionIdx).trim();

    // 从 questionPart 末尾提取答案（最后一个括号中的字母）
    const ansMatch = questionPart.match(/[（(]\s*([A-E]+)\s*[）)]\s*$/);
    if (!ansMatch) continue;

    const answer = ansMatch[1].trim().toUpperCase();
    const qText = questionPart.substring(0, ansMatch.index).trim();
    if (!qText) continue;

    // 解析选项
    const options = {};
    const optRegex = /[（(]\s*([A-E])\s*[）)]\s*/g;
    const optMatches = [...optionsPart.matchAll(optRegex)];

    for (let i = 0; i < optMatches.length; i++) {
      const key = optMatches[i][1];
      const startIdx = optMatches[i].index + optMatches[i][0].length;
      const endIdx = i + 1 < optMatches.length ? optMatches[i + 1].index : optionsPart.length;
      const optText = optionsPart.substring(startIdx, endIdx).trim();
      options[key] = optText;
    }

    if (Object.keys(options).length < 2) continue;

    questions.push({
      id: id++,
      type,
      section: sectionName,
      caseContext: null,
      question: qText,
      options,
      answer,
    });
  }
}

// 写入 JSON
fs.writeFileSync(
  path.join(__dirname, '../data/questions.json'),
  JSON.stringify(questions, null, 2),
  'utf-8'
);

const stats = questions.reduce((acc, q) => {
  acc[q.type] = (acc[q.type] || 0) + 1;
  return acc;
}, {});
console.log('\n✅ 解析完成，共 ' + questions.length + ' 题：', stats);
