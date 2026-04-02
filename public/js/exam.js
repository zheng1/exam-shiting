// public/js/exam.js
const user = Auth.require();
if (!user) throw new Error('not logged in');

document.getElementById('user-name').textContent = '👤 ' + user.name;
document.getElementById('btn-logout').onclick = () => { Auth.clear(); location.href = '/'; };

let questions = [];
let current   = 0;
let score     = 0;
let selected  = new Set();
let submitted = false;

async function loadQuestions() {
  try {
    questions = await API.get('/api/questions?count=20&types=single,multiple,judge');
  } catch {
    document.getElementById('question-card').textContent = '题库加载失败，请刷新重试';
    return;
  }
  if (!questions.length) {
    document.getElementById('question-card').textContent = '暂无题目，请联系管理员';
    return;
  }
  renderQuestion();
}

function renderQuestion() {
  if (current >= questions.length) {
    const pct = Math.round(score / questions.length * 100);
    sessionStorage.setItem('exam_result', JSON.stringify({ score, total: questions.length, pct }));
    location.href = '/result';
    return;
  }

  const q = questions[current];
  selected.clear();
  submitted = false;

  // 进度
  document.getElementById('progress-fill').style.width = (current / questions.length * 100) + '%';
  document.getElementById('progress-text').textContent = `第 ${current + 1} / ${questions.length} 题`;
  document.getElementById('score-text').textContent    = `得分 ${score}`;

  // 题型标签
  const badgeEl = document.getElementById('q-badge');
  badgeEl.textContent  = { single: '单选', multiple: '多选', judge: '判断' }[q.type] || q.type;
  badgeEl.className    = 'badge badge-' + q.type;

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

  // 清空反馈
  const fbEl = document.getElementById('feedback');
  fbEl.style.display = 'none';
  fbEl.className     = 'feedback';
  fbEl.textContent   = '';

  // 渲染选项
  const list = document.getElementById('option-list');
  list.textContent = ''; // 清空子元素（比 innerHTML='' 更安全）
  Object.entries(q.options).forEach(([key, text]) => {
    const li      = document.createElement('li');
    li.className  = 'option-item';
    li.dataset.key = key;

    const keySpan = document.createElement('span');
    keySpan.className   = 'option-key';
    keySpan.textContent = key;

    const txtSpan = document.createElement('span');
    txtSpan.textContent = text;

    li.appendChild(keySpan);
    li.appendChild(txtSpan);

    li.onclick = () => {
      if (submitted) return;
      if (q.type === 'multiple') {
        if (selected.has(key)) {
          selected.delete(key);
          li.classList.remove('selected');
        } else {
          selected.add(key);
          li.classList.add('selected');
        }
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

  const btn = document.getElementById('btn-submit');
  btn.disabled    = true;
  btn.textContent = '提交答案';
  btn.onclick     = submitAnswer;
}

async function submitAnswer() {
  if (submitted || selected.size === 0) return;
  submitted = true;

  const q          = questions[current];
  const userAnswer = [...selected].sort().join('');
  const isCorrect  = userAnswer === q.answer.split('').sort().join('');

  if (isCorrect) score++;

  // 高亮选项
  document.querySelectorAll('.option-item').forEach(el => {
    const key = el.dataset.key;
    el.classList.remove('selected');
    if (q.answer.includes(key))  el.classList.add('correct');
    else if (selected.has(key))  el.classList.add('wrong');
  });

  // 反馈
  const fbEl = document.getElementById('feedback');
  fbEl.style.display = 'block';
  fbEl.className     = 'feedback ' + (isCorrect ? 'correct' : 'wrong');
  fbEl.textContent   = isCorrect ? '✅ 回答正确！' : '❌ 回答错误，正确答案：' + q.answer;

  // 本地缓存错题
  if (!isCorrect) {
    LocalWrong.add(user.name, {
      question_id:    q.id,
      user_answer:    userAnswer,
      correct_answer: q.answer,
      question:       q,
    });
  }

  // 异步同步到服务器
  API.post('/api/records', { name: user.name, questionId: q.id, userAnswer }).catch(() => {});

  // 按钮变"下一题"
  const btn = document.getElementById('btn-submit');
  btn.disabled    = false;
  btn.textContent = current + 1 < questions.length ? '下一题 →' : '查看结果 →';
  btn.onclick     = () => { current++; renderQuestion(); };
}

loadQuestions();
