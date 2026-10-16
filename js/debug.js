// ============================================================
//  除錯報告：自動記錄每一步操作，遇到 bug 時按「🐞 除錯報告」→ 複製 → 貼給 Claude
//  紀錄存在瀏覽器裡（重新整理也還在），最多保留 400 筆
// ============================================================
(function () {
  const KEY = 'mom2_debuglog', MAX = 400, FMAX = 60;
  let L = [], F = [];
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); L = s.L || []; F = s.F || []; } catch (e) { }
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ L, F })); } catch (e) { } }, 300); };
  const now = () => { const d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':'); };
  const tag = () => { try { return G && G.scen ? `R${G.round}${G.phase === 'investigator' ? '調' : G.phase === 'mythos' ? (G.horrorStep ? '恐' : '神') : '備'}` : '--'; } catch (e) { return '--'; } };
  const cut = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  const add = (kind, text) => { L.push(`${now()} ${tag()} ${kind} ${text}`); if (L.length > MAX) L.splice(0, L.length - MAX); save(); };
  const addF = text => { F.push(`${now()} ${tag()} ${text}`); if (F.length > FMAX) F.splice(0, F.length - FMAX); save(); };
  window.DBG = { add, clear() { L = []; F = []; save(); }, report: () => report() };

  // ---- 點擊（所有按鈕、標記、怪物、調查員、選項）----
  document.addEventListener('click', e => {
    try {
      const t = e.target.closest('button,.node,[data-mon],[data-inv],[data-token],.pick,.prodBox,select,input,label,[data-a],[data-i]');
      if (!t || t.id === 'btnDebug' || t.closest('#dbgBox')) return;
      let s;
      if (t.dataset.node) { const n = G.nodes && G.nodes[t.dataset.node]; s = `標記 ${t.dataset.node}${n ? `（${cut(n.sprite || '', 30)}）` : ''}`; }
      else if (t.dataset.mon) { const m = G.monsters.find(m => m.uid == t.dataset.mon); s = `怪物 ${m ? T(m.name) + ' ' + (m.hp - m.dmg) + '/' + m.hp : t.dataset.mon}`; }
      else if (t.dataset.inv != null && t.dataset.inv !== '') s = `調查員頭像 ${G.inv[+t.dataset.inv] ? G.inv[+t.dataset.inv].name : t.dataset.inv}`;
      else if (t.dataset.token) s = `指示物 ${t.dataset.token}`;
      else {
        const card = t.closest('.inv'); const who = card ? (card.querySelector('.invName') || {}).textContent : '';
        s = `「${cut(t.textContent || t.title || t.value || t.dataset.a || '', 30)}」${t.dataset.a ? ' [' + t.dataset.a + ']' : ''}${who ? ' @' + cut(who, 12) : ''}`;
      }
      add('點', s);
    } catch (err) { }
  }, true);
  document.addEventListener('change', e => {
    try { const t = e.target; if (t.tagName === 'SELECT') add('選', `${cut(t.options[t.selectedIndex] ? t.options[t.selectedIndex].text : t.value, 30)}`); } catch (err) { }
  }, true);

  // ---- 錯誤 ----
  window.addEventListener('error', e => add('‼錯誤', cut(`${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`, 200)));
  window.addEventListener('unhandledrejection', e => add('‼錯誤', cut(e.reason && (e.reason.stack || e.reason.message) || e.reason, 200)));
  const ow = console.warn, oe = console.error;
  console.warn = function () { try { add('⚠警告', cut([...arguments].map(a => a && a.stack ? a.stack : a).join(' '), 200)); } catch (e) { } return ow.apply(console, arguments); };
  console.error = function () { try { add('‼錯誤', cut([...arguments].map(a => a && a.stack ? a.stack : a).join(' '), 200)); } catch (e) { } return oe.apply(console, arguments); };

  // ---- 對話框、提示、遊戲紀錄、狀態變化 ----
  window.addEventListener('load', () => {
    try {
      const om = UI.message;
      UI.message = function (o) {
        add('框', `${o && o.title ? '【' + cut(o.title, 16) + '】' : ''}${cut(o && o.text, 60)}${o && o.buttons ? ' 〔' + o.buttons.map(b => cut(b.label || b.ev, 10)).join('／') + '〕' : ''}`);
        const r = om.apply(this, arguments);
        if (r && r.then) r.then(v => add('答', String(v)));
        return r;
      };
      // 小視窗（是／否、提示）也記下來
      if (typeof CE !== 'undefined') {
        if (CE.ask) { const oa = CE.ask; CE.ask = function (title, text, y, n) { add('問', `【${cut(title, 16)}】${cut(text, 70)} 〔${y || '是'}／${n || '否'}〕`); const r = oa.apply(this, arguments); if (r && r.then) r.then(v => add('答', v ? (y || '是') : (n || '否'))); return r; }; }
        if (CE.alert) { const oal = CE.alert; CE.alert = function (title, text) { add('通知', `【${cut(title, 16)}】${cut(text, 70)}`); return oal.apply(this, arguments); }; }
      }
      if (UI.confirm) { const oc = UI.confirm; UI.confirm = function (text) { add('問', cut(text, 80)); const r = oc.apply(this, arguments); if (r && r.then) r.then(v => add('答', v ? '確定' : '取消')); return r; }; }
      const ot = UI.toast; UI.toast = function (m) { add('提示', cut(m, 80)); return ot.apply(this, arguments); };
      const ol = Engine.log; Engine.log = function (m) { add('紀錄', cut(m, 80)); return ol.apply(this, arguments); };
      const ogo = Engine.gameOver; Engine.gameOver = function (v) { add('＝＝', `遊戲結束：${v ? '勝利' : '失敗'}（${cut((new Error().stack || '').split('\n').slice(2, 4).map(x => x.trim().replace(/^at /, '').replace(/\(.*\/(js\/[^)]*)\)/, '$1')).join(' ← '), 120)}）`); return ogo.apply(this, arguments); };
      const on = Engine.newGame; Engine.newGame = function (o) { add('＝＝', `${o && o.noStart ? '讀取存檔' : '開新遊戲'} ${o && o.variant} 調查員：${o && o.investigators ? o.investigators.map(i => i.name).join('、') : ''}`); return on.apply(this, arguments); };
      if (CE && CE.doUndo) { const ou = CE.doUndo; CE.doUndo = function () { add('↶', '上一步'); return ou.apply(this, arguments); }; }
      if (CE && CE.doAction) { const oa = CE.doAction; CE.doAction = function (a) { add('行動', `${typeof a === 'string' ? a : JSON.stringify(a)}`); return oa.apply(this, arguments); }; }
      // 位置、階段變化（每次重畫時比對）
      let prev = {};
      const orr = UI.render;
      UI.render = function () {
        const r = orr.apply(this, arguments);
        try {
          const cur = {};
          cur.ph = `${G.round}|${G.phase}|${G.horrorStep}|${G.gameOver}`;
          G.inv.forEach((iv, i) => { const c = MAP.cellAt && MAP.cellAt(iv.x, iv.y); cur['i' + i] = `${iv.name} → ${c ? c.id : '?'}`; });
          G.monsters.forEach(m => { const c = MAP.cellAt && MAP.cellAt(m.x, m.y); cur['m' + m.uid] = `${T(m.name)} → ${c ? c.id : '?'}`; });
          for (const k in cur) if (prev[k] !== undefined && prev[k] !== cur[k]) add(k === 'ph' ? '階段' : '位置', k === 'ph' ? cur.ph : cur[k]);
          for (const k in prev) if (k[0] === 'm' && cur[k] === undefined) add('怪物', `移除 ${prev[k]}`);
          for (const k in cur) if (k[0] === 'm' && prev[k] === undefined && Object.keys(prev).length) add('怪物', `出現 ${cur[k]}`);
          prev = cur;
        } catch (e) { }
        return r;
      };
      // 劇本流程（FSM）狀態
      if (typeof FSM !== 'undefined') {
        const oen = FSM.prototype.enter;
        FSM.prototype.enter = function (name) { try { if (this.state != null) addF(`${this.def && (this.def.object || this.def.name) || (this.monster ? 'M:' + this.monster.name : this.kind || '?')} → ${name}`); } catch (e) { } return oen.apply(this, arguments); };
      }
    } catch (e) { console.warn('debug hook', e); }

    // ---- 工具列按鈕 ----
    setTimeout(() => {
      const anchor = document.getElementById('btnSound') || document.getElementById('btnRecenter');
      if (!anchor || document.getElementById('btnDebug')) return;
      const b = document.createElement('button'); b.className = 'tb'; b.id = 'btnDebug'; b.innerHTML = '<span>🐞 除錯報告</span>'; b.title = '遇到問題時按這裡，複製內容貼給 Claude';
      b.onclick = showReport; anchor.after(b);
    }, 50);
  });

  function report() {
    const out = [];
    try {
      out.push(`#除錯報告 APP ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'}　${new Date().toLocaleString()}`);
      if (G && G.scen) {
        out.push(`劇本 ${G.variant}　第${G.round}輪　階段:${G.phase}${G.horrorStep ? '(恐怖檢定)' : ''}${G.gameOver ? '　遊戲結束' : ''}　威脅:${G.threat}`);
        G.inv.forEach((iv, i) => {
          const c = MAP.cellAt && MAP.cellAt(iv.x, iv.y); const tu = iv.turn || {};
          const items = G.items.filter(it => it.owner === i).map(it => T(it.name)).join('、');
          out.push(`調${i} ${iv.name}${iv.removed ? '(淘汰)' : ''} 格:${c ? c.id : `?(${(+iv.x).toFixed(2)},${(+iv.y).toFixed(2)})`} 傷${iv.dmg}+${iv.dmgUp}/${iv.maxH} 恐${iv.hor}+${iv.horUp}/${iv.maxS} 線索${iv.clues} 行動${tu.acts}${tu.done ? ' 已結束' : ''}${tu.move ? ' 移動剩' + tu.move.left : ''} 狀態:${(iv.conds || []).join(',') || '-'} 物品:${items || '-'}`);
        });
        G.monsters.forEach(m => { const c = MAP.cellAt && MAP.cellAt(m.x, m.y); out.push(`怪 ${T(m.name)}#${m.uid} ${m.hp - m.dmg}/${m.hp} 格:${c ? c.id : '?'}`); });
        out.push('流程: ' + (G.fsms || []).filter(f => f.running || !/^(START STATE|DO NOTHING|WAIT FOR (THREAT|FLAG)|FINISH)/.test(f.state || '')).map(f => `${f.def && f.def.object || '?'}=${f.state}${f.running ? '(跑' + f.running + ')' : ''}`).join(' | '));
        out.push(`進行中: ia=${CE && CE._ia ? cut(JSON.stringify(CE._ia), 80) : '-'} atk=${CE && CE._atk ? 'Y' : '-'} pending=${CE && CE.pending ? cut(JSON.stringify(CE.pending), 60) : '-'} 小視窗=${document.querySelector('#overlay') && !document.querySelector('#overlay').classList.contains('hidden') ? '開' : '關'} 官方框=${typeof OFF !== 'undefined' && OFF.layer ? (OFF.layer.classList.contains('hidden') ? '藏' : '開') : '-'} 排隊中=${typeof dlgOpenCount !== 'undefined' ? dlgOpenCount : '?'} 上一步=${CE && CE.undo ? CE.undo.stack.length : '-'}`);
      } else out.push('（目前沒有進行中的遊戲）');
    } catch (e) { out.push('報告產生錯誤：' + e.message); }
    out.push('', '##流程（最近）'); out.push(...F.slice(-40));
    out.push('', '##操作（最近）'); out.push(...L.slice(-180));
    return out.join('\n');
  }
  function showReport() {
    const txt = report();
    const w = CE.layer(`<div id="dbgBox"><h3 class="dlgTitle">🐞 除錯報告</h3>
      <div class="msg" style="font-size:13px">遇到問題時：按「複製」，再到 Claude 對話框貼上（Ctrl+V），順便說一下你發現什麼不對。</div>
      <textarea readonly style="width:100%;height:46vh;font:12px/1.4 monospace;background:#120e08;color:#e8dcc0;border:1px solid #6b5a3a;white-space:pre">${txt.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
      <div class="btns"><button class="btn primary" id="dbgCopy">複製</button><button class="btn" id="dbgClear">清除紀錄</button><button class="btn" id="dbgClose">關閉</button></div></div>`);
    const ta = w.box.querySelector('textarea');
    w.box.querySelector('#dbgCopy').onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) { }
      if (!ok) { try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e) { } }
      UI.toast(ok ? '已複製，請到 Claude 貼上' : '自動複製失敗：請點文字框，按 Ctrl+A 再按 Ctrl+C');
    };
    w.box.querySelector('#dbgClear').onclick = async () => { DBG.clear(); w.close(); UI.toast('除錯紀錄已清除'); };
    w.box.querySelector('#dbgClose').onclick = () => w.close();
  }
})();

// ==========================================================
//  保險：訊息框不見了（劇情在等玩家按「繼續」，畫面上卻什麼都沒有）→ 自動重新顯示
//  （曾在危機四伏神秘階段生成怪物時發生，整局卡住動不了）
// ==========================================================
window.addEventListener('load', () => setTimeout(() => {
  try {
    const m0 = UI.message;
    let live = null;
    UI.message = function (o) {
      return new Promise(res => {
        const rec = { o, miss: 0 };
        rec.res = v => { if (rec.done) return; rec.done = true; if (live === rec) live = null; res(v); };
        live = rec;
        m0.call(UI, o).then(rec.res, rec.res);
      });
    };
    const vis = el => !!(el && !el.classList.contains('hidden') && el.getClientRects().length);
    const anyDialog = () => {
      const off = typeof OFF !== 'undefined' && OFF.layer;
      const cl = document.getElementById('cardLayer');
      const ov = document.getElementById('overlay'), dlg = document.getElementById('dialog');
      return (vis(off) && !!off.innerHTML) || (vis(ov) && !!(dlg && dlg.innerHTML)) ||
        !!(cl && cl.classList.contains('on') && cl.children.length) || vis(document.getElementById('sheet')) ||
        !!document.getElementById('monMoveBar') || !!document.getElementById('pickInvBar') || !!document.querySelector('.clBox');
    };
    setInterval(() => {
      try {
        if (!live || live.done || G.gameOver) return;
        if (anyDialog()) { live.miss = 0; return; }
        if (++live.miss < 4) return;
        live.miss = 0;
        const rec = live;
        Engine.log('（自動修復）訊息框不見了，重新顯示：' + plain(String(rec.o && rec.o.text || '')).slice(0, 30));
        m0.call(UI, rec.o).then(rec.res, rec.res);
      } catch (e) { }
    }, 1000);
  } catch (e) { }
}, 0));
