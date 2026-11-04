'use strict';
// 雙機連線:小孩機(host)寫狀態、媽媽機(join)看狀態並下指令。未設定 Firebase 時自動停用,維持單機。
const Net = (() => {
  const V = '10.12.2';
  const LIBS = ['app', 'auth', 'database'].map(n => `https://www.gstatic.com/firebasejs/${V}/firebase-${n}-compat.js`);
  let db = null, room = null, ready = null, onlineCb = null;

  function enabled() { return !!window.FIREBASE_CONFIG; }
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  }
  function init() {
    if (!enabled()) return Promise.reject(new Error('no-config'));
    if (ready) return ready;
    ready = (async () => {
      for (const l of LIBS) await loadScript(l);
      firebase.initializeApp(window.FIREBASE_CONFIG);
      await firebase.auth().signInAnonymously();
      db = firebase.database();
      db.ref('.info/connected').on('value', s => { if (onlineCb) onlineCb(!!s.val()); });
    })();
    ready.catch(() => { ready = null; });
    return ready;
  }
  const ref = p => db.ref(`rooms/${room}/${p}`);
  const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

  // ----- 小孩機 -----
  async function host(code, onCmd) {
    await init(); room = code;
    ref('state').onDisconnect().remove();
    ref('cmd').remove(); ref('log').remove();
    ref('cmd').on('value', s => { const c = s.val(); if (c && c.ts && Date.now() - c.ts < 15000) onCmd(c); });
  }
  function state(obj) { if (db && room) ref('state').update({ ...obj, ts: Date.now() }).catch(() => {}); }
  function log(m) { if (db && room) { ref('log').push({ t: Date.now(), m: String(m).slice(0, 120) }).catch(() => {}); } }

  // ----- 媽媽機 -----
  async function join(code, onState, onLog) {
    await init(); room = code;
    ref('state').on('value', s => onState(s.val()));
    ref('log').limitToLast(30).on('child_added', s => onLog(s.val()));
  }
  function cmd(type, extra) { if (db && room) ref('cmd').set({ type, ts: Date.now(), ...(extra || {}) }); }
  function leave() { if (db && room) { ref('state').off(); ref('log').off(); ref('cmd').off(); } room = null; }
  function onOnline(cb) { onlineCb = cb; }

  return { enabled, init, host, state, log, join, cmd, leave, newCode, onOnline };
})();
