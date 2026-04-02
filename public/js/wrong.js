// public/js/wrong.js
const user = Auth.require();
if (!user) throw new Error('not logged in');

document.getElementById('user-label').textContent = '👤 ' + user.name + ' 的错题记录';
document.getElementById('btn-logout').onclick = () => { Auth.clear(); location.href = '/'; };

async function loadWrong() {
  const container = document.getElementById('wrong-list');
  container.textContent = '';

  const loading = document.createElement('p');
  loading.className   = 'text-muted';
  loading.textContent = '加载中…';
  container.appendChild(loading);

  let records = [];
  try {
    records = await API.get('/api/records/' + encodeURIComponent(user.name));
  } catch {
    // 降级：从本地缓存读取
    records = LocalWrong.get(user.name);
  }

  container.textContent = '';

  if (!records.length) {
    const msg = document.createElement('div');
    msg.className   = 'card text-center';
    msg.textContent = '🎉 暂无错题，继续保持！';
    msg.style.color = '#10b981';
    msg.style.fontSize = '1.05rem';
    container.appendChild(msg);
    return;
  }

  // 统计数
  const countEl = document.createElement('p');
  countEl.className   = 'text-muted';
  countEl.style.marginBottom = '16px';
  countEl.textContent = `共 ${records.length} 道错题`;
  container.appendChild(countEl);

  records.forEach((r, idx) => {
    const q = r.question;
    if (!q) return;

    const card = document.createElement('div');
    card.className = 'card wrong-card';

    // 序号 + 题型
    const header = document.createElement('div');
    header.className = 'flex align-center gap-8';
    header.style.marginBottom = '12px';

    const numEl = document.createElement('span');
    numEl.className   = 'text-muted';
    numEl.textContent = '#' + (idx + 1);

    const badgeEl = document.createElement('span');
    badgeEl.className   = 'badge badge-' + q.type;
    badgeEl.textContent = { single: '单选', multiple: '多选', judge: '判断' }[q.type] || q.type;

    header.appendChild(numEl);
    header.appendChild(badgeEl);
    card.appendChild(header);

    // 案例背景
    if (q.caseContext) {
      const ctx = document.createElement('div');
      ctx.className   = 'case-context';
      ctx.style.marginBottom = '10px';
      ctx.textContent = q.caseContext;
      card.appendChild(ctx);
    }

    // 题目
    const qText = document.createElement('p');
    qText.style.fontWeight  = '500';
    qText.style.lineHeight  = '1.75';
    qText.style.marginBottom = '10px';
    qText.textContent = q.question.replace(/^[（(][^）)]+[）)]\s*/, '');
    card.appendChild(qText);

    // 选项列表
    const ul = document.createElement('ul');
    ul.className = 'option-list';
    Object.entries(q.options).forEach(([key, text]) => {
      const li = document.createElement('li');
      li.style.cursor = 'default';

      const isCorrect   = q.answer.includes(key);
      const wasSelected = (r.user_answer || '').includes(key);

      if (isCorrect)        li.className = 'option-item correct';
      else if (wasSelected) li.className = 'option-item wrong';
      else                  li.className = 'option-item';

      const keySpan = document.createElement('span');
      keySpan.className   = 'option-key';
      keySpan.textContent = key;

      const txtSpan = document.createElement('span');
      txtSpan.textContent = text;

      li.appendChild(keySpan);
      li.appendChild(txtSpan);
      ul.appendChild(li);
    });
    card.appendChild(ul);

    // 你的答案 vs 正确答案
    const ansRow = document.createElement('div');
    ansRow.className = 'wrong-answer-row';
    ansRow.textContent = `❌ 你的答案：${r.user_answer || '未作答'}    ✅ 正确答案：${q.answer}`;
    card.appendChild(ansRow);

    container.appendChild(card);
  });
}

loadWrong();
