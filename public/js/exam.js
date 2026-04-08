// public/js/exam.js
const user = Auth.require();
if (!user) throw new Error('not logged in');

document.getElementById('user-name').textContent = '👤 ' + user.name;
document.getElementById('btn-logout').onclick = () => { Auth.clear(); location.href = '/'; };

let paperId     = null;
let questions   = [];
let answeredMap = {}; // { qId: { userAnswer, correctAnswer, isCorrect } }
let current     = 0;
let selected    = new Set();

function getScore() {
  return Object.values(answeredMap).filter(a => a.isCorrect).length;
}

function firstUnansweredIndex() {
  for (let i = 0; i < questions.length; i++) {
    if (!answeredMap[questions[i].id]) return i;
  }
  return questions.length;
}

async function loadQuestions() {
  try {
    const data = await API.get('/api/questions?name=' + encodeURIComponent(user.name));

    if (data.allDone) {
      showAllDone(data.total);
      return;
    }

    paperId     = data.paperId;
    questions   = data.questions;
    answeredMap = data.answeredMap || {};

    current = firstUnansweredIndex();

    if (current >= questions.length) {
      showPaperComplete();
      return;
    }

    renderQuestion();
  } catch (e) {
    document.getElementById('question-card').textContent = '题库加载失败，请刷新重试';
  }
}

function updateProgress() {
  const answered = Object.keys(answeredMap).length;
  document.getElementById('progress-fill').style.width  = (answered / questions.length * 100) + '%';
  document.getElementById('progress-text').textContent  = `第 ${current + 1} / ${questions.length} 题（已答 ${answered}）`;
  document.getElementById('score-text').textContent     = `得分 ${getScore()}`;
}

function renderQuestion() {
  if (current >= questions.length) { showPaperComplete(); return; }

  const q = questions[current];
  selected.clear();

  updateProgress();

  // 题型标签
  const badgeEl = document.getElementById('q-badge');
  badgeEl.textContent = { single: '单选', multiple: '多选', judge: '判断' }[q.type] || q.type;
  badgeEl.className   = 'badge badge-' + q.type;

  // 案例背景
  const ctxEl = document.getElementById('case-context');
  if (q.caseContext) {
    ctxEl.textContent   = q.caseContext;
    ctxEl.style.display = 'block';
  } else {
    ctxEl.style.display = 'none';
  }

  // 题目文字
  const qClean = q.question.replace(/^[（(][^）)]+[）)]\s*/, '');
  document.getElementById('q-text').textContent = qClean;

  // 多选提示
  document.getElementById('multiple-hint').style.display = q.type === 'multiple' ? 'block' : 'none';

  // 上一题按钮
  const btnPrev    = document.getElementById('btn-prev');
  btnPrev.disabled = current === 0;
  btnPrev.onclick  = () => { current--; renderQuestion(); };

  const existingAnswer = answeredMap[q.id];

  if (existingAnswer) {
    renderLockedOptions(q, existingAnswer);
    showFeedback(existingAnswer.isCorrect, existingAnswer.correctAnswer);

    const btn       = document.getElementById('btn-submit');
    btn.disabled    = false;
    btn.textContent = current + 1 < questions.length ? '下一题 →' : '查看结果 →';
    btn.onclick     = () => { current++; renderQuestion(); };
  } else {
    renderFreshOptions(q);

    const fbEl         = document.getElementById('feedback');
    fbEl.style.display = 'none';
    fbEl.className     = 'feedback';

    const btn       = document.getElementById('btn-submit');
    btn.disabled    = true;
    btn.textContent = '提交答案';
    btn.onclick     = submitAnswer;
  }
}

function renderFreshOptions(q) {
  const list = document.getElementById('option-list');
  list.textContent = '';
  Object.entries(q.options).forEach(([key, text]) => {
    const li          = document.createElement('li');
    li.className      = 'option-item';
    li.dataset.key    = key;

    const keySpan       = document.createElement('span');
    keySpan.className   = 'option-key';
    keySpan.textContent = key;

    const txtSpan       = document.createElement('span');
    txtSpan.textContent = text;

    li.appendChild(keySpan);
    li.appendChild(txtSpan);

    li.onclick = () => {
      if (q.type === 'multiple') {
        if (selected.has(key)) { selected.delete(key); li.classList.remove('selected'); }
        else                   { selected.add(key);    li.classList.add('selected');    }
      } else {
        list.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
        selected.clear();
        selected.add(key);
        li.classList.add('selected');
      }
      document.getElementById('btn-submit').disabled = selected.size === 0;
    };
    list.appendChild(li);
  });
}

function renderLockedOptions(q, answered) {
  const list = document.getElementById('option-list');
  list.textContent = '';
  Object.entries(q.options).forEach(([key, text]) => {
    const li          = document.createElement('li');
    li.className      = 'option-item';
    li.dataset.key    = key;

    const keySpan       = document.createElement('span');
    keySpan.className   = 'option-key';
    keySpan.textContent = key;

    const txtSpan       = document.createElement('span');
    txtSpan.textContent = text;

    li.appendChild(keySpan);
    li.appendChild(txtSpan);

    if (answered.correctAnswer.includes(key))       li.classList.add('correct');
    else if (answered.userAnswer.includes(key))     li.classList.add('wrong');

    list.appendChild(li);
  });
}

function showFeedback(isCorrect, correctAnswer) {
  const fbEl         = document.getElementById('feedback');
  fbEl.style.display = 'block';
  fbEl.className     = 'feedback ' + (isCorrect ? 'correct' : 'wrong');
  fbEl.textContent   = isCorrect ? '✅ 回答正确！' : '❌ 回答错误，正确答案：' + correctAnswer;
}

async function submitAnswer() {
  if (selected.size === 0) return;

  const q          = questions[current];
  const userAnswer = [...selected].sort().join('');
  const isCorrect  = userAnswer === q.answer.split('').sort().join('');

  // 更新本地状态
  answeredMap[q.id] = { userAnswer, correctAnswer: q.answer, isCorrect };

  // 显示结果（加锁）
  renderLockedOptions(q, answeredMap[q.id]);
  showFeedback(isCorrect, q.answer);
  updateProgress();

  // 本地缓存错题
  if (!isCorrect) {
    LocalWrong.add(user.name, {
      question_id:    q.id,
      user_answer:    userAnswer,
      correct_answer: q.answer,
      question:       q,
    });
  }

  // 更新按钮
  const btn       = document.getElementById('btn-submit');
  btn.disabled    = false;
  const isLast    = current + 1 >= questions.length;
  btn.textContent = isLast ? '查看结果 →' : '下一题 →';
  btn.onclick     = () => { current++; renderQuestion(); };

  // 同步到服务器
  try {
    const res = await API.post('/api/records', {
      name: user.name, questionId: q.id, userAnswer, paperId,
    });
    if (res.paperComplete) {
      btn.textContent = '查看本卷结果 →';
      btn.onclick     = showPaperComplete;
    }
  } catch (e) { /* 静默失败，本地状态已更新 */ }
}

function showPaperComplete() {
  const total   = questions.length;
  const correct = getScore();
  const pct     = Math.round(correct / total * 100);

  const card       = document.getElementById('question-card');
  card.textContent = '';

  const title         = document.createElement('h2');
  title.textContent   = '🎉 本卷完成！';
  title.style.cssText = 'text-align:center;margin-bottom:16px;font-size:1.4rem';

  const scoreEl         = document.createElement('p');
  scoreEl.textContent   = `本卷得分：${correct} / ${total}（${pct}%）`;
  scoreEl.style.cssText = 'text-align:center;font-size:1.1rem;color:#4b5563;margin-bottom:24px';

  const btn         = document.createElement('button');
  btn.className     = 'btn btn-primary';
  btn.textContent   = '下一张考卷 →';
  btn.style.cssText = 'display:block;margin:0 auto;font-size:1rem;padding:12px 28px';
  btn.onclick       = () => location.reload();

  card.appendChild(title);
  card.appendChild(scoreEl);
  card.appendChild(btn);

  document.getElementById('progress-fill').style.width = '100%';
}

function showAllDone(total) {
  const card       = document.getElementById('question-card');
  card.textContent = '';

  const title         = document.createElement('h2');
  title.textContent   = '🏆 恭喜！全部题目已完成！';
  title.style.cssText = 'text-align:center;margin-bottom:16px;font-size:1.3rem';

  const desc         = document.createElement('p');
  desc.textContent   = `你已完成全部 ${total} 道题目！`;
  desc.style.cssText = 'text-align:center;color:#4b5563;margin-bottom:24px';

  const btn         = document.createElement('button');
  btn.className     = 'btn btn-secondary';
  btn.textContent   = '重新开始（清空考卷进度）';
  btn.style.cssText = 'display:block;margin:0 auto';
  btn.onclick       = async () => {
    btn.disabled    = true;
    btn.textContent = '重置中...';
    await API.post('/api/papers/reset', { name: user.name });
    location.reload();
  };

  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(btn);

  document.getElementById('progress-fill').style.width = '100%';
}

loadQuestions();
