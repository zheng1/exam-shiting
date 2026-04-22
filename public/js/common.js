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

/**
 * 预热缓存：登录后立即把所有关键 API 缓存到 SW
 * 这样离线时 /exam、/wrong、/practice 都能正常工作
 */
function warmCache(userName) {
  if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  const urls = [
    '/api/questions?name=' + encodeURIComponent(userName),
    '/api/records/'        + encodeURIComponent(userName),
  ];
  navigator.serviceWorker.controller.postMessage({ type: 'CACHE_URLS', urls });
}

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

// OfflineQueue — 离线答题队列（IndexedDB）
const OfflineQueue = (() => {
  const DB_NAME    = 'exam-offline';
  const STORE_NAME = 'pending_records';
  let db = null;

  function openDB() {
    if (db) return Promise.resolve(db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function enqueue(payload) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).add({ payload, ts: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function getAll() {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function remove(id) {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = d.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function flush() {
    const items = await getAll();
    for (const item of items) {
      try {
        const res = await fetch('/api/records', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(item.payload),
        });
        if (res.ok) await remove(item.id);
      } catch (e) {
        break;
      }
    }
  }

  window.addEventListener('online', flush);

  async function submit(payload) {
    if (!navigator.onLine) {
      await enqueue(payload);
      return { ok: true, offline: true };
    }
    try {
      return await API.post('/api/records', payload);
    } catch (e) {
      await enqueue(payload);
      return { ok: true, offline: true };
    }
  }

  return { submit, flush };
})();
