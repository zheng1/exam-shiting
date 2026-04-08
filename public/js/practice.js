// public/js/practice.js
const user = Auth.require();
if (!user) throw new Error('not logged in');

document.getElementById('user-name').textContent = '📝 错题练习 · ' + user.name;
document.getElementById('btn-logout').onclick = () => { Auth.clear(); location.href = '/'; };

let questions   = [];  // 本轮错题（已打乱）
let answeredMap = {};  // 本轮答题记录 { qId: { userAnswer, correctAnswer, isCorrect } }
let current     = 0;
let selected    = new Set();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getScore() {
  return Object.values(answeredMap).filter(a => a.isCorrect).length;
}

async function loadPractice() {
  try {
    const records = await API.get('/api/records/' + encodeURIComponent(user.name));
    if (!records.length) { showNoWrong(); return; }
    questions = shuffle(records.map(r => r.question).filter(Boolean));
    renderQuestion();
  } catch (e) {
    document.getElementById('question-card').textContent = '加载失败，请刷新重试';
  }
}

function updateProgress() {
  const answered = Object.keys(answeredMap).length;
  document.getElementById('progress-fill').style.width = (answered / questions.length * 100) + '%';
  document.getElementById('progress-text').textContent = `第 ${current + 1} / ${questions.length} 题`;
  document.getElementById('score-text').textContent    = `答对 ${getScore()}`;
}

function renderQuestion() {
  if (current >= questions.length) { showComplete(); return; }

  const q = questions[current];
  selected.clear();
  updateProgress();

  const badgeEl       = document.getElementById('q-badge');
  badgeEl.textContent = { single: '单选', multiple: '多选', judge: '判断' }[q.type] || q.type;
  badgeEl.className   = 'badge badge-' + q.type;

  const ctxEl = document.getElementById('case-context');
  if (q.caseContext) { ctxEl.textContent = q.caseContext; ctxEl.style.display = 'block'; }
  else               { ctxEl.style.display = 'none'; }

  document.getElementById('q-text').textContent = q.question.replace(/^[（(][^）)]+[）)]\s*/, '');
  document.getElementById('multiple-hint').style.display = q.type === 'multiple' ? 'block' : 'none';

  const btnPrev    = document.getElementById('btn-prev');
  btnPrev.disabled = current === 0;
  btnPrev.onclick  = () => { current--; renderQuestion(); };

  const existingAnswer = answeredMap[q.id];
  if (existingAnswer) {
    renderLockedOptions(q, existingAnswer);
    showFeedback(existingAnswer.isCorrect, existingAnswer.correctAnswer);
    const btn       = document.getElementById('btn-submit');
    btn.disabled    = false;
    btn.textContent = current + 1 < questions.length ? '下一题 →' : '完成练习 →';
    btn.onclick     = () => { current++; renderQuestion(); };
  } else {
    renderFreshOptions(q);
    document.getElementById('feedback').style.display = 'none';
    document.getElementById('feedback').className     = 'feedback';
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
    const keySpan     = document.createElement('span');
    keySpan.className = 'option-key'; keySpan.textContent = key;
    const txtSpan     = document.createElement('span');
    txtSpan.textContent = text;
    li.appendChild(keySpan); li.appendChild(txtSpan);
    li.onclick = () => {
      if (q.type === 'multiple') {
        if (selected.has(key)) { selected.delete(key); li.classList.remove('selected'); }
        else                   { selected.add(key);    li.classList.add('selected');    }
      } else {
        list.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
        selected.clear(); selected.add(key); li.classList.add('selected');
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
    const keySpan     = document.createElement('span');
    keySpan.className = 'option-key'; keySpan.textContent = key;
    const txtSpan     = document.createElement('span');
    txtSpan.textContent = text;
    li.appendChild(keySpan); li.appendChild(txtSpan);
    if (answered.correctAnswer.includes(key))   li.classList.add('correct');
    else if (answered.userAnswer.includes(key)) li.classList.add('wrong');
    list.appendChild(li);
  });
}

function showFeedback(isCorrect, correctAnswer) {
  const fbEl         = document.getElementById('feedback');
  fbEl.style.display = 'block';
  fbEl.className     = 'feedback ' + (isCorrect ? 'correct' : 'wrong');
  fbEl.textContent   = isCorrect
    ? '✅ 回答正确！已从错题集移除'
    : '❌ 回答错误，正确答案：' + correctAnswer;
}

async function submitAnswer() {
  if (selected.size === 0) return;
  const q          = questions[current];
  const userAnswer = [...selected].sort().join('');
  const isCorrect  = userAnswer === q.answer.split('').sort().join('');

  answeredMap[q.id] = { userAnswer, correctAnswer: q.answer, isCorrect };
  renderLockedOptions(q, answeredMap[q.id]);
  showFeedback(isCorrect, q.answer);
  updateProgress();

  const btn       = document.getElementById('btn-submit');
  btn.disabled    = false;
  btn.textContent = current + 1 < questions.length ? '下一题 →' : '完成练习 →';
  btn.onclick     = () => { current++; renderQuestion(); };

  // 提交到服务器（无 paperId；答对后 getWrongRecords 会自动过滤）
  API.post('/api/records', { name: user.name, questionId: q.id, userAnswer }).catch(() => {});
}

function showComplete() {
  const total   = questions.length;
  const correct = getScore();
  const wrong   = total - correct;
  const pct     = Math.round(correct / total * 100);

  const card       = document.getElementById('question-card');
  card.textContent = '';

  const title         = document.createElement('h2');
  title.textContent   = '✅ 本轮练习完成！';
  title.style.cssText = 'text-align:center;margin-bottom:16px;font-size:1.4rem';

  const scoreEl         = document.createElement('p');
  scoreEl.textContent   = `答对 ${correct} / ${total}（${pct}%）`;
  scoreEl.style.cssText = 'text-align:center;font-size:1.1rem;color:#4b5563;margin-bottom:8px';

  const desc         = document.createElement('p');
  desc.style.cssText = 'text-align:center;color:#6b7280;margin-bottom:28px;font-size:.9rem';
  desc.textContent   = wrong > 0
    ? `还有 ${wrong} 道题答错，已保留在错题集`
    : '全部答对！错题集已清空 🎉';

  const row         = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;justify-content:center';

  const btnBack         = document.createElement('button');
  btnBack.className     = 'btn btn-secondary';
  btnBack.textContent   = '查看错题集';
  btnBack.onclick       = () => { location.href = '/wrong'; };

  row.appendChild(btnBack);

  if (wrong > 0) {
    const btnAgain       = document.createElement('button');
    btnAgain.className   = 'btn btn-primary';
    btnAgain.textContent = '再练一轮';
    btnAgain.onclick     = () => { location.reload(); };
    row.appendChild(btnAgain);
  }

  card.appendChild(title);
  card.appendChild(scoreEl);
  card.appendChild(desc);
  card.appendChild(row);
  document.getElementById('progress-fill').style.width = '100%';
}

function showNoWrong() {
  const card       = document.getElementById('question-card');
  card.textContent = '';

  const msg         = document.createElement('p');
  msg.textContent   = '🎉 暂无错题，继续保持！';
  msg.style.cssText = 'text-align:center;padding:20px;font-size:1.05rem;color:#10b981';

  const btn         = document.createElement('button');
  btn.className     = 'btn btn-primary';
  btn.textContent   = '返回答题';
  btn.style.cssText = 'display:block;margin:16px auto 0';
  btn.onclick       = () => { location.href = '/exam'; };

  card.appendChild(msg);
  card.appendChild(btn);
}

loadPractice();
