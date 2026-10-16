// ============================================================
//  開發者模式（2026-10-10）
//  只有主資料夾有 js/dev_on.js（設定 DEV_ALLOWED），給朋友的壓縮檔沒有那個檔案 → 完全看不到
// ============================================================
(function () {
  if (!window.DEV_ALLOWED) return;
  const LS = 'mom2_dev';
  const ld = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const D = window.DEV = Object.assign({ on: false, god: true, noMon: false, ghosts: true, dice: 'normal', diceN: 2, plot: true }, ld());
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { } };
  const on = () => D.on && G && G.scen;
  const markUsed = () => { if (G && G.vars) G.vars.__dev = 1; };

  // ---------- 樣式 ----------
  const css = document.createElement('style');
  css.textContent = `
  #devBadge{position:fixed;top:56px;left:50%;transform:translateX(-50%);background:#b0181c;color:#fff;font-weight:bold;padding:3px 14px;border-radius:0 0 8px 8px;z-index:9000;font-size:14px;letter-spacing:2px;pointer-events:none;box-shadow:0 2px 8px #000a}
  #btnDev.onDev{background:#5a1214;border-color:#e04040}
  #devPanel{position:fixed;right:10px;top:60px;width:340px;max-height:calc(100vh - 80px);overflow:auto;background:#1b1410f2;border:2px solid #b0181c;border-radius:10px;z-index:9100;color:#eee;padding:10px 12px;font-size:14px;box-shadow:0 4px 18px #000c}
  #devPanel h4{margin:8px 0 4px;color:#ffb0a0;font-size:15px}
  #devPanel label{display:flex;gap:6px;align-items:center;margin:3px 0;cursor:pointer}
  #devPanel button{background:#3a2a1c;color:#ffd9a0;border:1px solid #7a5a3a;border-radius:6px;padding:4px 9px;margin:2px;cursor:pointer;font-size:13px}
  #devPanel button:hover{background:#5a3a22}
  #devPanel .row2{display:flex;flex-wrap:wrap;gap:2px;align-items:center}
  #devPanel .small{color:#aaa;font-size:12px}
  #devPlot{position:fixed;left:10px;bottom:10px;width:380px;max-height:44vh;overflow:auto;background:#10141bf0;border:2px solid #4a7ab0;border-radius:10px;z-index:8900;color:#e8eef8;padding:8px 10px;font-size:13px;box-shadow:0 4px 14px #000b}
  #devPlot .ph{display:flex;justify-content:space-between;align-items:center;font-weight:bold;color:#9cc8ff;margin-bottom:4px}
  #devPlot .ph button{background:#22324a;color:#cfe;border:1px solid #4a7ab0;border-radius:5px;cursor:pointer}
  #devPlot .it{border-top:1px solid #2a3a50;padding:4px 0}
  #devPlot .st{display:inline-block;font-size:11px;padding:0 5px;border-radius:4px;margin-right:4px}
  #devPlot .w{background:#2a6a2a}#devPlot .d{background:#555}#devPlot .f{background:#6a4a1a}
  #devPlot .pv{color:#bbb;font-size:12px;margin-left:4px}
  .devGhost{position:absolute;border:2px dashed #ff6a6a;border-radius:50%;background:rgba(255,80,80,.12);color:#ffb0b0;font-size:22px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:40;opacity:.8}
  .devGhost span{position:absolute;top:100%;white-space:nowrap;font-size:16px;background:#000a;padding:0 4px;border-radius:4px}
  .devKill{background:#7a1010!important;color:#fff!important}
  .devPz{background:#5a1214!important;color:#fff!important}`;
  document.head.appendChild(css);

  // ---------- 工具列按鈕、紅色標示 ----------
  function addButton() {
    if (document.getElementById('btnDev')) return;
    const after = document.getElementById('btnTokens') || document.getElementById('btnItems');
    if (!after) return;
    const b = document.createElement('button');
    b.className = 'tb'; b.id = 'btnDev'; b.title = '開發者模式';
    b.innerHTML = '<span>🛠 開發者</span>';
    b.onclick = togglePanel;
    after.after(b);
    refreshBadge();
  }
  function refreshBadge() {
    let bd = document.getElementById('devBadge');
    if (D.on && !bd) { bd = document.createElement('div'); bd.id = 'devBadge'; bd.textContent = '開發者模式'; document.body.appendChild(bd); }
    if (!D.on && bd) bd.remove();
    const b = document.getElementById('btnDev'); if (b) b.classList.toggle('onDev', !!D.on);
    drawPlot();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', addButton) : addButton();

  // ---------- 開發者面板 ----------
  function togglePanel() {
    const p = document.getElementById('devPanel');
    if (p) { p.remove(); return; }
    drawPanel();
  }
  function drawPanel() {
    let p = document.getElementById('devPanel');
    if (!p) { p = document.createElement('div'); p.id = 'devPanel'; document.body.appendChild(p); }
    const chk = (k, t) => `<label><input type="checkbox" data-k="${k}" ${D[k] ? 'checked' : ''}> ${t}</label>`;
    const slots = [1, 2, 3].map(n => { let s = null; try { s = JSON.parse(localStorage.getItem('mom2_dev_slot' + n)); } catch (e) { } return { n, s }; });
    const keys = rawKeys();
    p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#ff8a7a;font-size:16px">🛠 開發者模式</b><button id="dvClose">關閉面板</button></div>
      <label style="font-size:15px"><input type="checkbox" data-k="on" ${D.on ? 'checked' : ''}> <b>開啟開發者模式</b></label>
      <div class="small">開啟後：移動、行動、能力都不限次數；人偶可以拖到任何格子；地圖上任何搜索／探索／互動標記都能直接點；怪物視窗有「直接擊殺」。</div>
      <h4>選項</h4>
      ${chk('god', '無敵（不會被消滅）')}${chk('noMon', '怪物不行動（神秘階段跳過怪物攻擊）')}${chk('ghosts', '顯示還沒出現的標記（紅色虛線圈）')}${chk('plot', '顯示「劇情推演」小框')}
      <h4>骰子</h4>
      <div class="row2">${[['normal', '正常'], ['all', '全部成功'], ['none', '全部失敗'], ['n', '指定★數']].map(([v, t]) => `<label><input type="radio" name="dvDice" value="${v}" ${D.dice === v ? 'checked' : ''}> ${t}</label>`).join('')}
        <input id="dvN" type="number" min="0" max="12" value="${D.diceN}" style="width:48px"> 顆★</div>
      <div class="small">謎題：開發者模式下每次出現謎題都會先問你「直接解開／直接失敗／正常玩」。</div>
      <h4>劇本旗標與計數器</h4><button id="dvFlags">打開旗標面板</button>
      <h4>對話紀錄</h4><div class="small">這局已記錄 ${LOG.length} 段文字；未翻譯代碼 ${keys.length} 個${keys.length ? '：<span style="color:#ff6a6a">' + esc(keys.slice(0, 8).join('、')) + (keys.length > 8 ? '…' : '') + '</span>' : ''}</div>
      <button id="dvExport">匯出對話紀錄（網頁檔）</button><button id="dvClear">清空紀錄</button>
      <h4>快速存檔</h4>
      ${slots.map(({ n, s }) => `<div class="row2"><b>存檔 ${n}</b><button data-sv="${n}">存</button><button data-ld="${n}" ${s ? '' : 'disabled'}>讀</button><span class="small">${s ? esc((s.label || '') + ' 第' + s.round + '輪 ' + new Date(s.time).toLocaleTimeString()) : '（空）'}</span></div>`).join('')}`;
    p.querySelector('#dvClose').onclick = () => p.remove();
    p.querySelectorAll('[data-k]').forEach(c => c.onchange = () => { D[c.dataset.k] = c.checked; save(); if (c.dataset.k === 'on' && c.checked) markUsed(); refreshBadge(); try { UI.render(); } catch (e) { } });
    p.querySelectorAll('[name=dvDice]').forEach(r => r.onchange = () => { D.dice = r.value; save(); });
    p.querySelector('#dvN').onchange = e => { D.diceN = Math.max(0, +e.target.value || 0); save(); };
    p.querySelector('#dvFlags').onclick = flagPanel;
    p.querySelector('#dvExport').onclick = exportLog;
    p.querySelector('#dvClear').onclick = () => { LOG.length = 0; drawPanel(); };
    p.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => slotSave(+b.dataset.sv));
    p.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => slotLoad(+b.dataset.ld));
  }

  // ==========================================================
  //  1. 無限行動、無限移動、不限次數的能力
  // ==========================================================
  // 行動照常記錄，但做完立刻退回 → 永遠用不完（畫面上的行動點也維持正常）
  const sr = CE.spendRaw;
  CE.spendRaw = function (idx) {
    const iv = G.inv[idx], before = iv && iv.turn ? iv.turn.acts : 0;
    const r = sr.apply(this, arguments);
    if (on() && r && iv && iv.turn) { iv.turn.acts = before; UI.render(); }
    return r;
  };
  const cm = CE.canMove; CE.canMove = function () { return on() ? null : cm.apply(this, arguments); };
  const ur = CE.usedRound; CE.usedRound = function () { return on() ? false : ur.apply(this, arguments); };
  // 人偶可以拖到任何格子（用「補做」的自由拖曳）
  const md = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    md.call(UI, el, getObj, onClick);
    if (!el.dataset || el.dataset.inv == null) return;
    const i = +el.dataset.inv, down = el.onpointerdown;
    el.onpointerdown = e => {
      if (!on() || e.button !== 0) return down(e);
      const iv = G.inv[i]; CE.ensure(iv);
      const pa = G.active, pr = iv.turn.redo;
      G.active = i; iv.turn.redo = true;
      try { down(e); } finally { G.active = pa; iv.turn.redo = pr; }
    };
  };
  // ==========================================================
  //  2. 任何標記都能直接點（不用走到同一格、不用先按「其他行動」）
  // ==========================================================
  const ACT = { test: id => /^(SEARCH|SERACH|EXPLORE|INTERACT|PERSON|REDIRECT|ITEM)/.test(nodeTag(id)) };
  const ntf = CE.nodeTooFar; CE.nodeTooFar = function () { return on() ? null : (ntf ? ntf.apply(this, arguments) : null); };
  const cn = UI.clickNode;
  UI.clickNode = function (id) {
    if (on() && (ACT.test(id) || /^Person_/.test((G.nodes[id] || {}).sprite || '')) && CE.pending == null && G.phase === 'investigator') {
      let a = CE.actorNow ? CE.actorNow() : G.active; if (a == null) a = CE.alive()[0];
      CE.pending = a;
    }
    return cn.apply(this, arguments);
  };
  // ==========================================================
  //  3. 怪物視窗：直接擊殺
  // ==========================================================
  const ms = UI.monsterSheet;
  UI.monsterSheet = function (uid) {
    ms.apply(this, arguments);
    if (!on()) return;
    const m = G.monsters.find(x => x.uid === UI.selMonster); if (!m) return;
    const btns = document.querySelector('#sheetInner .btns'); if (!btns) return;
    btns.insertAdjacentHTML('afterbegin', '<button class="btn devKill" id="mDevKill">🛠 直接擊殺</button>');
    document.getElementById('mDevKill').onclick = async () => { UI.closeSheet(); m.dmg = m.hp; Engine.log(`（開發者）直接擊殺 ${T(m.name)}`); await Engine.killMonster(m); UI.render(); };
  };
  // ==========================================================
  //  4. 無敵、怪物不行動
  // ==========================================================
  const el0 = CE.eliminate;
  CE.eliminate = async function (iv) { if (on() && D.god) { UI.toast(`（開發者無敵）${iv.name} 不會被消滅`); return; } return el0.apply(this, arguments); };
  const rmt = Engine.runMonsterTemplate;
  Engine.runMonsterTemplate = async function (m, kind) {
    if (on() && D.noMon && kind === 'attack' && G.phase === 'mythos') { Engine.log(`（開發者）${T(m.name)} 不行動`); return; }
    return rmt.apply(this, arguments);
  };
  // ==========================================================
  //  5. 骰子控制
  // ==========================================================
  const rd = UI.rollDie; let burst = 0, bt = null;
  UI.rollDie = function () {
    if (!on() || D.dice === 'normal') return rd.apply(this, arguments);
    if (D.dice === 'all') return 'S';
    if (D.dice === 'none') return 'B';
    clearTimeout(bt); bt = setTimeout(() => { burst = 0; }, 0);   // 同一次擲骰：前 N 顆是★
    return burst++ < D.diceN ? 'S' : 'B';
  };
  // ==========================================================
  //  6. 謎題：直接解開／直接失敗／正常玩
  // ==========================================================
  for (const k of ['slide', 'code', 'lock', 'tower', 'pipe', 'rotate']) {
    const o = Puzzles[k]; if (typeof o !== 'function') continue;
    Puzzles[k] = async function () {
      if (!on()) return o.apply(this, arguments);
      const w = CE.layer(`<h3 class="dlgTitle">🛠 開發者：謎題</h3><div class="msg">這裡要解一個謎題，要怎麼處理？</div><div class="btns"><button class="btn devPz" data-v="1">直接解開</button><button class="btn" data-v="0">直接失敗</button><button class="btn primary" data-v="2">正常玩</button></div>`);
      const v = await new Promise(res => w.box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { w.close(); res(+b.dataset.v); }));
      if (v === 2) return o.apply(this, arguments);
      Engine.log(`（開發者）謎題直接${v ? '解開' : '失敗'}`);
      return !!v;
    };
  }
  // ==========================================================
  //  7. 顯示還沒出現的標記
  // ==========================================================
  const GH = /SEARCH|SERACH|EXPLORE|INTERACT|PERSON|ITEM|MONSTER|Monster|Search|Explore|Interact|Person|Sight|SIGHT/;
  const icon = n => /SEARCH|SERACH|Search/.test(n.id + n.sprite) ? '🔍' : /EXPLORE|Explore/.test(n.id + n.sprite) ? '🚪' : /PERSON|Person/.test(n.id + n.sprite) ? '🧑' : /MONSTER|Monster/.test(n.id + (n.sprite || '')) ? '👹' : /SIGHT|Sight/.test(n.id + n.sprite) ? '👁' : '✋';
  const kindName = n => ({ '🔍': '搜索', '🚪': '探索', '🧑': '人物', '👹': '怪物', '👁': '景象', '✋': '互動' })[icon(n)] + '（未出現）';
  const rb = UI.renderBoard;
  UI.renderBoard = function () {
    const r = rb.apply(this, arguments);
    if (!on() || !D.ghosts) return r;
    const W = document.getElementById('world'); if (!W) return r;
    const maps = new Set(Object.values(G.tiles).filter(t => t.revealed).map(t => t.map));
    const rev = G.vars.__rev || {};
    for (const n of Object.values(G.nodes)) {
      if (n.visible || n.virtual || rev[n.id] || n.x == null || !GH.test(n.id + ' ' + (n.sprite || ''))) continue;
      if (n.map != null && maps.size && !maps.has(n.map)) continue;
      const d = document.createElement('div'); d.className = 'devGhost';
      d.style.cssText = `left:${n.x * U - 30}px;top:${-n.y * U - 30}px;width:60px;height:60px`;
      d.innerHTML = icon(n) + `<span>${kindName(n)}</span>`;
      W.appendChild(d);
    }
    // 開發者模式：標記不顯示上鎖
    W.querySelectorAll('.node.locked').forEach(e => e.classList.remove('locked', 'far'));
    return r;
  };
  // ==========================================================
  //  8. 對話紀錄（匯出成網頁檔，未翻譯的代碼用紅字）
  // ==========================================================
  const LOG = [];
  const KEY = /\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b/g;
  const rawKeys = () => [...new Set(LOG.flatMap(l => l.t.match(KEY) || []))];
  const msg = UI.message;
  UI.message = function (o) {
    try {
      if (o && (o.text || o.title)) LOG.push({ r: G.round, ph: G.phase, title: o.title ? plain(String(o.title)) : '', t: plain(String(o.text || '')), b: (o.buttons || []).map(b => plain(String(b.label || ''))).filter(Boolean) });
    } catch (e) { }
    return msg.apply(this, arguments);
  };
  function exportLog() {
    const scen = G.variant || '';
    const red = s => esc(s).replace(KEY, k => `<b style="color:#d00">${k}</b>`).replace(/\n/g, '<br>');
    const keys = rawKeys();
    const html = `<!doctype html><meta charset="utf-8"><title>對話紀錄 ${esc(scen)}</title><body style="font-family:sans-serif;max-width:900px;margin:20px auto;line-height:1.6">
      <h2>對話紀錄：${esc(scen)}（${new Date().toLocaleString()}）</h2>
      <p>共 ${LOG.length} 段。未翻譯代碼（紅字）：${keys.length ? keys.map(k => `<b style="color:#d00">${k}</b>`).join('、') : '沒有'}</p>
      ${LOG.map((l, i) => `<div style="border-top:1px solid #ccc;padding:6px 0"><small style="color:#888">#${i + 1}　第 ${l.r} 輪・${l.ph === 'mythos' ? '神秘階段' : l.ph === 'setup' ? '設置' : '調查員階段'}</small>${l.title ? `<div><b>${red(l.title)}</b></div>` : ''}<div>${red(l.t)}</div>${l.b.length ? `<div style="color:#555">按鈕：${l.b.map(red).join('／')}</div>` : ''}</div>`).join('')}</body>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `對話紀錄_${scen.replace(/\s+/g, '_')}_${Date.now()}.html`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // ==========================================================
  //  9. 旗標與計數器面板
  // ==========================================================
  function flagPanel() {
    const names = new Set();
    for (const f of G.fsms || []) for (const st of f.def.states) for (const a of st.actions || []) for (const v of Object.values(a || {})) if (v && typeof v === 'object' && typeof v.var === 'string' && v.var && !/^(PlayerCount|MonsterCount|Round|TotalThreat|UnspentThreat)$/.test(v.var)) names.add(v.var);
    for (const k of Object.keys(G.vars || {})) if (!k.startsWith('__')) names.add(k);
    const list = [...names].sort();
    const w = CE.layer(`<h3 class="dlgTitle">🛠 劇本旗標與計數器</h3>
      <div class="small">勾選＝是（旗標）；數字可以直接改。改完會立刻檢查有沒有劇情因此觸發。</div>
      <input id="dvF" placeholder="搜尋名稱…" style="width:100%;margin:6px 0">
      <div id="dvFL" style="max-height:55vh;overflow:auto;text-align:left;font-size:13px"></div>
      <div class="btns"><button class="btn primary" id="dvFC">關閉</button></div>`);
    const draw = q => {
      w.box.querySelector('#dvFL').innerHTML = list.filter(n => !q || n.toLowerCase().includes(q.toLowerCase())).map(n => {
        const v = G.vars[n];
        return `<div style="display:flex;gap:6px;align-items:center;border-bottom:1px solid #333;padding:2px 0"><span style="flex:1;word-break:break-all">${esc(n)}</span>
          <label><input type="checkbox" data-b="${esc(n)}" ${v === true || v === 1 ? 'checked' : ''}>是</label>
          <input type="number" data-n="${esc(n)}" value="${typeof v === 'number' ? v : (v ? 1 : 0)}" style="width:60px"></div>`;
      }).join('');
      w.box.querySelectorAll('[data-b]').forEach(c => c.onchange = () => { setVar(c.dataset.b, c.checked, null); Engine.log(`（開發者）旗標 ${c.dataset.b} = ${c.checked}`); markUsed(); UI.render(); });
      w.box.querySelectorAll('[data-n]').forEach(c => c.onchange = () => { setVar(c.dataset.n, +c.value, null); Engine.log(`（開發者）計數器 ${c.dataset.n} = ${c.value}`); markUsed(); UI.render(); });
    };
    w.box.querySelector('#dvF').oninput = e => draw(e.target.value);
    w.box.querySelector('#dvFC').onclick = () => w.close();
    draw('');
  }
  // ==========================================================
  //  10. 快速存檔（3 格）＋ 開發者存檔標記
  // ==========================================================
  function slotSave(n) {
    if (!G.scen) { UI.toast('還沒開始遊戲'); return; }
    if (Engine.canSave && !Engine.canSave()) { UI.toast('劇情正在進行中，等畫面停下來再存'); return; }
    markUsed(); Engine.save();
    try {
      const d = JSON.parse(localStorage.getItem('mom2_save')); d.label = G.variant;
      localStorage.setItem('mom2_dev_slot' + n, JSON.stringify(d)); UI.toast(`已存到存檔 ${n}`);
    } catch (e) { UI.toast('存檔失敗：' + e.message); }
    drawPanel();
  }
  function slotLoad(n) {
    let d = null; try { d = JSON.parse(localStorage.getItem('mom2_dev_slot' + n)); } catch (e) { }
    if (!d) return;
    UI.closeDialog && UI.closeDialog();
    document.getElementById('devPanel') && document.getElementById('devPanel').remove();
    Engine.restore(d); UI.toast(`已讀取存檔 ${n}`);
  }
  // ==========================================================
  //  11. 劇情推演小框：多少威脅、第幾輪會觸發什麼
  // ==========================================================
  const wr = Actions.WaitForRoundDelay;
  Actions.WaitForRoundDelay = function (a, f) { f._devRound = G.round + val(a.Delay, f); return wr.apply(this, arguments); };
  // 從某個狀態往後找：第一段會顯示的文字（會跟進「加入劇情事件」的事件本身）
  const firstText = (f, stName, depth) => {
    depth = depth || 0;
    const seen = new Set(), q = [stName];
    while (q.length && seen.size < 40) {
      const cur = q.shift(); if (!cur || seen.has(cur)) continue; seen.add(cur);
      const st = f.states[cur]; if (!st) continue;
      for (const a of st.actions || []) {
        if (!a) continue;
        if (a.Message && a.Message.Key) { const t = plain(T(a.Message.Key) || '').replace(/\{\d+\}/g, '□'); if (t && !/^[A-Z0-9_ ]+$/.test(t)) return t; }
        if (a.action === 'AddStoryEvent' && a.StoryEventObject && depth < 2) {
          const tf = G.fsmByObj[goName(a.StoryEventObject)];
          if (tf) { const r = firstText(tf, tf.def.start, depth + 1) || (tf.def.globalTransitions || []).map(t => firstText(tf, t[1], depth + 1)).find(Boolean); if (r) return r; }
        }
        if (a.action === 'AddThisMythosEvent') for (const t of f.def.globalTransitions || []) q.push(t[1]);
        if (a.action === 'RevealTile') return '（揭示新的板塊）';
      }
      for (const t of st.transitions || []) q.push(t[1]);
    }
    return '';
  };
  const nextOf = (f, st, ev) => { const t = (st.transitions || []).find(x => x[0] === ev) || (f.def.globalTransitions || []).find(x => x[0] === ev); return t ? t[1] : null; };
  function plotItems() {
    const items = [];
    const waiting = new Set((Engine.watchers || []).map(w => w.fsm));
    for (const f of G.fsms || []) {
      for (const st of f.def.states) for (const a of st.actions || []) {
        if (!a) continue;
        let cond = null, kind = null, reached = false, v = null;
        const vn = a.variable && a.variable.var;
        if (a.action === 'WaitForCounter' && /^(TotalThreat|UnspentThreat|Round)$/.test(vn || '')) {
          v = val(a.value, f); const cur = vn === 'Round' ? G.round : vn === 'UnspentThreat' ? G.unspent : G.threat;
          cond = vn === 'Round' ? `第 ${v} 輪` : `${vn === 'UnspentThreat' ? '未花費威脅' : '威脅值'} ≥ ${v}`; kind = vn === 'Round' ? 'r' : 't'; reached = cur >= v;
        } else if (a.action === 'WaitFor' && [0, 3, 4].includes(a.target || 0)) {
          v = val(a.value, f); const nm = ['第幾輪', '', '', '威脅值', '未花費威脅'][a.target || 0];
          cond = `${nm} ${['>', '≥', '<', '≤', '='][a.conditionOperator || 0]} ${v}`; kind = a.target ? 't' : 'r';
        } else if (a.action === 'WaitForRoundDelay') {
          const d = val(a.Delay, f); kind = 'r'; v = 1000 + d;
          cond = f.state === st.name && f._devRound != null ? `第 ${f._devRound} 輪（再 ${Math.max(0, f._devRound - G.round)} 輪）` : `前面的條件成立後，再過 ${d} 輪`;
        } else if (a.action === 'WaitForFlag' && f.state === st.name && waiting.has(f)) {
          cond = `等劇情旗標（${varName(a.boolVariable)}）${a.Value ? '成立' : '取消'}`; kind = 'g'; v = 2000;
        } else continue;
        const isWait = f.state === st.name && waiting.has(f);
        const status = isWait ? 'w' : (kind === 't' && reached) ? 'd' : 'f';
        const nx = nextOf(f, st, a.continueEvent || a.EventToFire || 'NEXT');
        items.push({ status, cond, owner: f.owner, pv: nx ? firstText(f, nx) : '', v: v || 0 });
      }
    }
    const ord = { w: 0, f: 1, d: 2 };
    return items.sort((a, b) => ord[a.status] - ord[b.status] || a.v - b.v);
  }
  let plotT = null;
  function drawPlot() {
    let box = document.getElementById('devPlot');
    if (!D.on || !D.plot || !G.scen) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'devPlot'; document.body.appendChild(box); }
    if (box._min) { box.innerHTML = `<div class="ph"><span>📜 劇情推演</span><button id="dpT">展開</button></div>`; box.querySelector('#dpT').onclick = () => { box._min = false; drawPlot(); }; return; }
    const its = plotItems();
    box.innerHTML = `<div class="ph"><span>📜 劇情推演　第 ${G.round} 輪・威脅 ${G.threat}（未花 ${G.unspent}）</span><button id="dpT">縮小</button></div>
      ${its.length ? its.slice(0, 30).map(i => `<div class="it"><span class="st ${i.status}">${i.status === 'w' ? '等待中' : i.status === 'd' ? '已達成' : '尚未開始'}</span><b>${esc(i.cond)}</b>
        <div class="pv">→ ${esc(i.owner)}${i.pv ? '：' + esc(i.pv.slice(0, 70)) + (i.pv.length > 70 ? '…' : '') : ''}</div></div>`).join('') : '<div class="small">這個劇本沒有用威脅值或回合數觸發的劇情。</div>'}
      <div class="small" style="margin-top:4px;color:#8aa">「尚未開始」＝前面的劇情還沒走到這裡，條件到了也不會馬上觸發。</div>`;
    box.querySelector('#dpT').onclick = () => { box._min = true; drawPlot(); };
  }
  const rr = UI.render;
  UI.render = function () {
    const r = rr.apply(this, arguments);
    clearTimeout(plotT); plotT = setTimeout(() => { try { drawPlot(); } catch (e) { } }, 200);
    if (on()) markUsed();
    return r;
  };
})();
