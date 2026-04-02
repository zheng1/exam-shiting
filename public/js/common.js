// public/js/common.js — 公共工具

/** 用户登录状态（localStorage） */
const Auth = {
  KEY: 'exam_user',
  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)); } catch { return null; }
  },
  set(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },
  clear() { localStorage.removeItem(this.KEY); },
  /** 未登录则跳首页；已登录返回用户对象 */
  require() {
    const u = this.get();
    if (!u) { location.href = '/'; return null; }
    return u;
  },
};

/** Fetch 封装 */
const API = {
  async post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  },
  async get(url) {
    const r = await fetch(url);
    return r.json();
  },
};

/** 错题本地缓存（作为服务器的离线备份） */
const LocalWrong = {
  _key(name) { return 'wrong_' + name; },
  add(name, record) {
    const list = this.get(name);
    const idx = list.findIndex(r => r.question_id === record.question_id);
    if (idx >= 0) list[idx] = record; else list.push(record);
    localStorage.setItem(this._key(name), JSON.stringify(list));
  },
  get(name) {
    try { return JSON.parse(localStorage.getItem(this._key(name))) || []; } catch { return []; }
  },
};

/** 题型中文标签 HTML */
function typeBadge(type) {
  const map = {
    single:   ['single',   '单选'],
    multiple: ['multiple', '多选'],
    judge:    ['judge',    '判断'],
  };
  const [cls, label] = map[type] || ['single', type];
  return `<span class="badge badge-${cls}">${label}</span>`;
}
