// ============================================================
//  介面
// ============================================================
const CONDITIONS = ['眩暈', '擊昏', '抑制', '中毒', '催眠', '剛正', '心力交瘁', '集中', '時空錯亂', '無畏', '瘋狂', '受傷'];
const TOKEN_TYPES = [
  { kind: 'fire', name: '火焰', img: 'img/features/Feature_Fire.png', size: .38 },
  { kind: 'dark', name: '黑暗', img: 'img/features/Feature_Darkness.png', size: .38 },
  { kind: 'clue', name: '線索', img: 'img/ui/MAD20_Clue-Token.png', size: .3 },
  { kind: 'barricade', name: '路障', img: 'img/features/Feature_BarricadeInterior.png', size: .38 },
  { kind: 'sight', name: '視線', img: 'img/features/Feature_Sight.png', size: .34 },
  { kind: 'secret', name: '密道', img: 'img/features/Feature_SecretPassageInterior.png', size: .34 },
];
const SAVE_COLL = 'mom2_collection', SAVE_STATS = 'mom2_inv_stats';
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

const UI = {
  $(s) { return document.querySelector(s); },
  cam: { x: 0, y: 0, z: 0.55 },
  selMonster: null,

  // ---------- 啟動 ----------
  init() {
    this.bindBoard();
    UI.$('#btnEndPhase').onclick = () => {
      if (G.phase === 'investigator') this.confirm('確定要結束調查員階段，進入神秘階段嗎？').then(ok => ok && Engine.endInvestigatorPhase());
      else if (G.phase === 'mythos') Engine.endMythosPhase();
    };
    UI.$('#btnMenu').onclick = () => this.menu();
    UI.$('#btnObjective').onclick = () => G.objective ? Engine.say({ title: '目前目標', text: T(G.objective) }) : this.toast('尚未有目標');
    UI.$('#btnLog').onclick = () => this.showLog();
    UI.$('#btnDice').onclick = () => this.diceDialog();
    UI.$('#btnItems').onclick = () => this.itemSheet();
    UI.$('#btnMonsters').onclick = () => this.monsterSheet();
    UI.$('#btnTokens').onclick = () => this.tokenSheet();
    UI.$('#btnRecenter').onclick = () => this.fitView();
    this.newGameDialog();
  },

  // ---------- 開新局 ----------
  newGameDialog() {
    const sv = Engine.loadSaved();
    if (sv && !this._skipResume) {
      const names = (sv.inv || []).map(i => i.name).join('、');
      UI.openDialog(`<h3 class="dlgTitle">繼續上次的遊戲？</h3>
        <div class="msg" style="font-size:15px">永恆輪迴（地圖 ${sv.variant}）<br>第 ${sv.round} 輪　·　${sv.phase === 'mythos' ? '神秘階段' : '調查員階段'}<br>調查員：${esc(names)}<br><span class="small">存檔時間：${new Date(sv.time).toLocaleString()}</span></div>
        <div class="btns"><button class="btn" id="rsNew">開新遊戲</button><button class="btn primary" id="rsGo">繼續遊戲</button></div>`);
      UI.$('#rsGo').onclick = () => { this.closeDialog(); Engine.restore(sv); };
      UI.$('#rsNew').onclick = () => { this._skipResume = true; this.newGameDialog(); };
      return;
    }
    const coll = new Set(lsGet(SAVE_COLL, ['MAD20']));
    const chosen = [];
    const invs = DB.investigators;
    const draw = () => {
      const avail = invs.filter(iv => [...coll].some(c => (DB.products[c] || {}).investigators.includes(iv.id)));
      UI.openDialog(`<h3 class="dlgTitle">永恆輪迴 · 新遊戲</h3>
        <div class="msg" style="font-size:14px">${fmt(T('SCENARIO_CYCLE_OF_ETERNITY_DESCRIPTION'))}</div>
        <div class="lbl" style="font-size:14px;margin-top:10px">我的收藏（勾選你擁有的盒子，會影響出現的怪物與物品）</div>
        <div class="row">${Object.values(DB.products).map(p => `<label><input type="checkbox" data-p="${p.code}" ${coll.has(p.code) ? 'checked' : ''} ${p.code === 'MAD20' ? 'disabled' : ''}> ${esc(T(p.name))}</label>`).join('')}</div>
        <div class="lbl" style="font-size:14px">選擇調查員（1～5 位，已選 ${chosen.length} 位）</div>
        <div class="grid">${avail.map(iv => `<div class="pick ${chosen.includes(iv.id) ? 'on' : ''}" data-id="${iv.id}"><img src="${INV_DATA[iv.id].img}"><div>${esc(T(iv.name))}</div>${INV_DATA[iv.id].stats ? '' : '<div class="small">（數值待填）</div>'}</div>`).join('')}</div>
        <div class="row" style="margin-top:10px">地圖版本：<select id="selVar"><option value="">隨機（與官方相同）</option>${['01A', '01B', '02A', '02B'].map(v => `<option>${v}</option>`).join('')}</select></div>
        <div class="btns"><button class="btn primary" id="btnStart" ${chosen.length ? '' : 'disabled'}>開始遊戲</button></div>`);
      UI.$('#dialog').querySelectorAll('[data-p]').forEach(cb => cb.onchange = () => { cb.checked ? coll.add(cb.dataset.p) : coll.delete(cb.dataset.p); lsSet(SAVE_COLL, [...coll]); draw(); });
      UI.$('#dialog').querySelectorAll('.pick').forEach(el => el.onclick = () => {
        const id = el.dataset.id, i = chosen.indexOf(id);
        if (i >= 0) chosen.splice(i, 1); else if (chosen.length < 5) chosen.push(id); else UI.toast('最多 5 位');
        draw();
      });
      UI.$('#btnStart').onclick = () => {
        const v = UI.$('#selVar').value || pick(['01A', '01B', '02A', '02B']);
        UI.closeDialog();
        this.startGame(v, [...coll], chosen.slice());
      };
    };
    UI._redrawNew = draw;
    draw();
  },
  startGame(variant, coll, ids) {
    const saved = lsGet(SAVE_STATS, {});
    const inv = ids.map(id => {
      const base = INV_DATA[id], st = saved[id] || base.stats || { health: 6, sanity: 6, ability: '', skills: { str: 3, agi: 3, obs: 3, lor: 3, inf: 3, wil: 3 } };
      const m = DB.investigators.find(x => x.id === id);
      return {
        id, name: T(m.name), gender: m.gender, img: base.img, maxH: st.health, maxS: st.sanity, ability: st.ability || '',
        skills: Object.assign({ str: 3, agi: 3, obs: 3, lor: 3, inf: 3, wil: 3 }, st.skills), clues: 0, dmg: 0, hor: 0, dmgUp: 0, horUp: 0, conds: [], removed: false
      };
    });
    Engine.clearSave();
    Engine.newGame({ variant, collection: coll, investigators: inv });
    this.render(); this.fitView();
    Engine.begin();
  },
  saveStats(iv) {
    const s = lsGet(SAVE_STATS, {});
    s[iv.id] = { health: iv.maxH, sanity: iv.maxS, ability: iv.ability, skills: iv.skills };
    lsSet(SAVE_STATS, s);
  },

  // ---------- 繪製 ----------
  render() {
    if (!G.scen) return;
    UI.$('#roundLabel').textContent = `${T('UI_ROUND')} ${G.round}　·　地圖 ${G.variant}`;
    UI.$('#phaseLabel').textContent = G.gameOver ? '遊戲結束' : G.phase === 'setup' ? T('UI_PHASE_SETUP') : G.phase === 'investigator' ? T('UI_PHASE_INVESTIGATOR') : (G.horrorStep ? T('UI_HORROR_STEP') : T('UI_PHASE_MYTHOS'));
    const ep = UI.$('#btnEndPhase');
    ep.disabled = !!G.gameOver || G.phase === 'setup' || (G.phase === 'mythos' && !G.horrorStep);
    ep.textContent = G.phase === 'mythos' ? '結束神秘階段' : '結束調查員階段';
    ep.classList.toggle('mythos', G.phase === 'mythos');
    this.renderInvestigators();
    this.renderBoard();
    this.renderDock();
    Engine.autosave();
  },
  renderInvestigators() {
    const L = UI.$('#leftCol'), R = UI.$('#rightCol');
    L.innerHTML = ''; R.innerHTML = '';
    G.inv.forEach((iv, i) => (i % 2 === 0 ? L : R).appendChild(this.invCard(iv, i)));
  },
  invCard(iv, idx) {
    const d = document.createElement('div');
    d.className = 'inv' + (iv.removed ? ' dead' : '');
    const owned = G.items.filter(it => it.owner === idx);
    const pool = G.items.filter(it => it.owner == null);
    const hp = iv.maxH - iv.dmg - iv.dmgUp, sp = iv.maxS - iv.hor - iv.horUp;
    d.innerHTML = `
      <div class="invHead"><img src="${iv.img}"><div class="invName">${esc(iv.name)}</div><button class="x" data-a="kill">${iv.removed ? '復原' : '淘汰'}</button></div>
      <textarea class="ability" placeholder="特殊能力（照卡片輸入）">${esc(iv.ability)}</textarea>
      <div class="bigstats">
        <div class="big ${hp <= 1 ? 'low' : ''}" title="生命上限（剩餘＝上限−傷害）"><img src="img/icons/health.png"><span class="v">${hp}</span><span class="pm"><button data-a="maxH+">+</button><button data-a="maxH-">−</button></span></div>
        <div class="big ${sp <= 1 ? 'low' : ''}" title="理智上限（剩餘＝上限−恐怖）"><img src="img/icons/sanity.png"><span class="v">${sp}</span><span class="pm"><button data-a="maxS+">+</button><button data-a="maxS-">−</button></span></div>
        <div class="big" title="線索"><img src="img/icons/clue.png"><span class="v">${iv.clues}</span><span class="pm"><button data-a="clue+">+</button><button data-a="clue-">−</button></span></div>
      </div>
      <div class="skills">${SKILLS.map(s => `<div class="skill" data-s="${s.k}" title="點一下修改；按住 Shift 點擊直接擲骰"><img src="${s.icon}">${s.zh}<span class="sv">${iv.skills[s.k]}</span></div>`).join('')}</div>
      <div class="dmgRow">
        <div class="dmg">傷害 <button data-a="dmg-">−</button><b>${iv.dmg}</b><button data-a="dmg+">+</button></div>
        <div class="dmg">恐怖 <button data-a="hor-">−</button><b>${iv.hor}</b><button data-a="hor+">+</button></div>
      </div>
      <div class="lbl">持有物品／法術</div>
      <div class="chips">${owned.map(it => `<span class="chip ${it.type === 1 ? 'spell' : it.type === 2 ? 'unique' : ''}" data-item="${it.id}" title="${esc(this.itemText(it.id) || '點擊查看')}"><img src="img/items/${it.img}.png">${esc(T(it.name))}</span>`).join('') || '<span class="small">（無）</span>'}</div>
      <div class="addRow"><select data-a="give"><option value="">＋ 從物品堆拿取…</option>${pool.map(it => `<option value="${it.id}">${esc(T(it.name))}</option>`).join('')}</select></div>
      <div class="lbl">狀態</div>
      <div class="chips">${iv.conds.map(c => `<span class="chip cond" data-cond="${esc(c)}" title="點擊移除">${esc(c)} ✕</span>`).join('')}</div>
      <div class="addRow"><select data-a="cond"><option value="">＋ 加入狀態…</option>${CONDITIONS.map(c => `<option>${c}</option>`).join('')}</select></div>`;
    d.querySelector('.ability').onchange = e => { iv.ability = e.target.value; this.saveStats(iv); };
    d.querySelectorAll('[data-a]').forEach(b => {
      const a = b.dataset.a;
      if (b.tagName === 'SELECT') {
        b.onchange = () => {
          if (!b.value) return;
          if (a === 'give') { const it = G.items.find(x => x.id === b.value); if (it) it.owner = idx; }
          if (a === 'cond' && !iv.conds.includes(b.value)) iv.conds.push(b.value);
          this.render();
        };
        return;
      }
      b.onclick = () => {
        if (a === 'kill') { iv.removed = !iv.removed; }
        if (a === 'maxH+') iv.maxH++; if (a === 'maxH-') iv.maxH = Math.max(1, iv.maxH - 1);
        if (a === 'maxS+') iv.maxS++; if (a === 'maxS-') iv.maxS = Math.max(1, iv.maxS - 1);
        if (a === 'clue+') iv.clues++; if (a === 'clue-') iv.clues = Math.max(0, iv.clues - 1);
        if (a === 'dmg+') iv.dmg++; if (a === 'dmg-') iv.dmg = Math.max(0, iv.dmg - 1);
        if (a === 'hor+') iv.hor++; if (a === 'hor-') iv.hor = Math.max(0, iv.hor - 1);
        if (a.startsWith('max')) this.saveStats(iv);
        if (a === 'dmg+' && iv.dmg >= iv.maxH) this.toast(`${iv.name} 的傷害已達生命上限：受重傷！`);
        if (a === 'hor+' && iv.hor >= iv.maxS) this.toast(`${iv.name} 的恐怖已達理智上限：發瘋！`);
        this.render();
      };
    });
    d.querySelectorAll('.skill').forEach(el => el.onclick = (e) => {
      const k = el.dataset.s;
      if (e.shiftKey) { this.diceDialog({ inv: idx, skill: k }); return; }
      const v = prompt(`${iv.name} 的${SKILLS.find(s => s.k === k).zh}數值：`, iv.skills[k]);
      if (v != null && !isNaN(+v)) { iv.skills[k] = +v; this.saveStats(iv); this.render(); }
    });
    d.querySelectorAll('[data-item]').forEach(el => el.onclick = () => this.itemDetail(G.items.find(x => x.id === el.dataset.item)));
    d.querySelectorAll('[data-cond]').forEach(el => el.onclick = () => { iv.conds = iv.conds.filter(c => c !== el.dataset.cond); this.render(); });
    return d;
  },

  // ---------- 地圖 ----------
  tileImg(model) { return 'img/tiles/' + model + '.png'; },
  renderBoard() {
    const W = UI.$('#world');
    let html = '';
    for (const t of Object.values(G.tiles)) {
      if (!t.revealed) continue;
      const [sw0, sh0] = MAP.size(t), w = sw0 * U, h = sh0 * U;
      html += `<img class="tile" src="${this.tileImg(t.model)}" style="left:${t.x * U - w / 2}px;top:${-t.y * U - h / 2}px;width:${w}px;height:${h}px;transform:rotate(${-t.rot}deg)">`;
    }
    for (const n of Object.values(G.nodes)) {
      if (!n.visible || n.virtual || !n.sprite) continue;
      // 人物、搜索、互動標記走到還沒探索的房間（例如保安巡邏）：房間出現前先不顯示，免得浮在桌面上
      if (/^(SEARCH|SERACH|INTERACT|PERSON|ITEM)/.test(nodeTag(n.id)) && !MAP.cellAt(n.x, n.y) && ![[0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].some(([dx, dy]) => MAP.cellAt(n.x + dx, n.y + dy))) continue;
      const isWall = /Wall|Door|Barricade|Investigators|TrapDoor|Secret/.test(n.sprite);
      const fsm = G.fsmByObj[n.id];
      const clickable = fsm && /^(SEARCH|SERACH|EXPLORE|INTERACT|PERSON|REDIRECT|SIGHT|ITEM)/.test(nodeTag(n.id));
      let w = 0.36, h = 0.36;
      if (/Wall|Door|Secret/.test(n.sprite)) { w = 0.5; h = 0.3; }
      if (/Investigators/.test(n.sprite)) { w = 0.42; h = 0.42; }
      if (/Barricade/.test(n.sprite)) { w = 0.34; h = 0.34; }
      if (/^Person_/.test(n.sprite)) { w = 0.4; h = 0.4; }
      const src = (n.sprite.startsWith('Person_') ? 'img/persons/' : 'img/features/') + n.sprite + '.png';
      const hl = n.hl && Date.now() - n.hl < 4000;
      html += `<div class="node ${clickable ? '' : 'feature'} ${hl ? 'hl' : ''}" data-node="${esc(n.id)}" title="${clickable ? esc(this.nodeTitle(n)) : ''}" style="left:${n.x * U}px;top:${-n.y * U}px;width:${w * U}px;height:${h * U}px;${isWall ? `transform:translate(-50%,-50%) rotate(${-(n.rot || 0)}deg)` : ''}"><img src="${src}"></div>`;
    }
    for (const tk of G.tokens) {
      const tt = TOKEN_TYPES.find(x => x.kind === tk.kind);
      html += `<div class="token" data-token="${tk.id}" style="left:${tk.x * U}px;top:${-tk.y * U}px;width:${tt.size * U}px;height:${tt.size * U}px" title="${tt.name}（右鍵移除）"><img src="${tt.img}"></div>`;
    }
    for (const m of G.monsters) {
      html += `<div class="fig monster ${this.selMonster === m.uid ? 'selected' : ''}" data-mon="${m.uid}" style="left:${m.x * U}px;top:${-m.y * U}px;width:${0.42 * U}px;height:${0.42 * U}px"><img src="img/monsters/${m.img}.png"><span class="hp">${Math.max(0, m.hp - m.dmg)}</span><span class="nm">${esc(T(m.name))}</span></div>`;
    }
    G.inv.forEach((iv, i) => {
      if (iv.removed) return;
      html += `<div class="fig" data-inv="${i}" style="left:${iv.x * U}px;top:${-iv.y * U}px;width:${0.36 * U}px;height:${0.36 * U}px"><img src="${iv.img}"><span class="nm">${esc(iv.name)}</span></div>`;
    });
    W.innerHTML = html;
    W.querySelectorAll('.node[data-node]').forEach(el => el.onclick = (e) => { e.stopPropagation(); this.clickNode(el.dataset.node); });
    W.querySelectorAll('[data-mon]').forEach(el => this.makeDraggable(el, () => G.monsters.find(m => m.uid == el.dataset.mon), () => this.monsterSheet(+el.dataset.mon)));
    W.querySelectorAll('[data-inv]').forEach(el => this.makeDraggable(el, () => G.inv[+el.dataset.inv]));
    W.querySelectorAll('[data-token]').forEach(el => {
      this.makeDraggable(el, () => G.tokens.find(t => t.id == el.dataset.token));
      el.oncontextmenu = e => { e.preventDefault(); G.tokens = G.tokens.filter(t => t.id != el.dataset.token); this.render(); };
    });
    this.applyCam();
  },
  nodeTitle(n) {
    if (/^(SEARCH|SERACH)/.test(nodeTag(n.id))) return T('UI_SEARCH');
    if (/^EXPLORE|^REDIRECT/.test(nodeTag(n.id))) return T('UI_EXPLORE');
    return T('UI_INTERACT');
  },
  clickNode(id) {
    if (G.gameOver) return;
    if (G.phase !== 'investigator') { this.toast('只能在調查員階段進行'); return; }
    if (!UI.$('#overlay').classList.contains('hidden')) return;
    const f = G.fsmByObj[id];
    if (f && !f.fire('NODE CLICKED')) this.toast('目前無法互動');
  },
  makeDraggable(el, getObj, onClick) {
    let sx, sy, ox, oy, moved = false;
    el.onpointerdown = e => {
      if (e.button !== 0) return;
      e.stopPropagation(); el.setPointerCapture(e.pointerId);
      const o = getObj(); if (!o) return;
      sx = e.clientX; sy = e.clientY; ox = o.x; oy = o.y; moved = false;
      el.onpointermove = ev => {
        const dx = (ev.clientX - sx) / this.cam.z / U, dy = (ev.clientY - sy) / this.cam.z / U;
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
        o.x = ox + dx; o.y = oy - dy;
        el.style.left = o.x * U + 'px'; el.style.top = -o.y * U + 'px';
      };
      el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; if (!moved && onClick) onClick(); };
    };
  },
  bindBoard() {
    const B = UI.$('#board');
    let drag = null;
    B.onpointerdown = e => { if (e.target.closest('.fig,.token,.node,#monsterDock')) return; drag = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; B.classList.add('dragging'); };
    window.addEventListener('pointermove', e => { if (!drag) return; this.cam.x = drag.cx + (e.clientX - drag.x); this.cam.y = drag.cy + (e.clientY - drag.y); this.applyCam(); });
    window.addEventListener('pointerup', () => { drag = null; B.classList.remove('dragging'); });
    B.addEventListener('wheel', e => {
      e.preventDefault();
      const r = B.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const nz = Math.min(2.5, Math.max(0.15, this.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      this.cam.x = mx - (mx - this.cam.x) * nz / this.cam.z; this.cam.y = my - (my - this.cam.y) * nz / this.cam.z; this.cam.z = nz;
      this.applyCam();
    }, { passive: false });
  },
  applyCam() { UI.$('#world').style.transform = `translate(${this.cam.x}px,${this.cam.y}px) scale(${this.cam.z})`; },
  fitView() {
    const ts = Object.values(G.tiles || {}).filter(t => t.revealed);
    const pts = ts.length ? ts : Object.values(G.tiles || {});
    if (!pts.length) return;
    const xs = pts.flatMap(t => [t.x - 1.2, t.x + 1.2]), ys = pts.flatMap(t => [t.y - 1.2, t.y + 1.2]);
    this.fitBox(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), false);
  },
  fitBox(x0, x1, y0, y1, anim, maxZ = 1) {
    const B = UI.$('#board').getBoundingClientRect();
    const z = Math.min(maxZ, B.width / ((x1 - x0) * U), (B.height - 110) / ((y1 - y0) * U));
    const cx = (x0 + x1) / 2 * U, cy = -(y0 + y1) / 2 * U;
    const target = { z, x: B.width / 2 - cx * z, y: (B.height - 90) / 2 - cy * z };
    if (!anim) { Object.assign(this.cam, target); this.applyCam(); return; }
    const from = Object.assign({}, this.cam), t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 600), e = k * (2 - k); for (const p of ['x', 'y', 'z']) this.cam[p] = from[p] + (target[p] - from[p]) * e; this.applyCam(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  },
  focusNodes(ids) {
    const pts = ids.map(id => G.tiles[id] || G.nodes[id]).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const all = Object.values(G.tiles).filter(t => t.revealed);
    const ax = all.flatMap(t => [t.x - 1.1, t.x + 1.1]).concat(xs), ay = all.flatMap(t => [t.y - 1.1, t.y + 1.1]).concat(ys);
    this.fitBox(Math.min(...ax), Math.max(...ax), Math.min(...ay), Math.max(...ay), true);
  },
  focusPos(x, y) { this.focusNodes([]); const all = Object.values(G.tiles).filter(t => t.revealed); const ax = all.flatMap(t => [t.x - 1.1, t.x + 1.1]).concat([x - 1, x + 1]), ay = all.flatMap(t => [t.y - 1.1, t.y + 1.1]).concat([y - 1, y + 1]); this.fitBox(Math.min(...ax), Math.max(...ax), Math.min(...ay), Math.max(...ay), true); },

  // ---------- 怪物 ----------
  renderDock() {
    const D = UI.$('#monsterDock');
    D.innerHTML = G.monsters.map(m => `<div class="mcard ${this.selMonster === m.uid ? 'sel' : ''}" data-m="${m.uid}"><img src="img/monsters/${m.img}.png"><span class="md">${m.dmg}/${m.hp}</span><div class="mn">${esc(T(m.name))}</div></div>`).join('');
    D.querySelectorAll('.mcard').forEach(el => el.onclick = () => this.monsterSheet(+el.dataset.m));
  },
  selectMonster(uid) { this.selMonster = uid; this.render(); },
  monsterSheet(uid) {
    if (!G.monsters.length) { this.toast('目前沒有怪物'); return; }
    let m = G.monsters.find(x => x.uid === uid) || G.monsters.find(x => x.uid === this.selMonster) || G.monsters[0];
    this.selMonster = m.uid; this.render();
    const def = DB.monsters[m.model];
    const busy = !UI.$('#overlay').classList.contains('hidden');
    UI.openSheet(`<div class="sheetHead"><h3>怪物</h3><button class="btn small" id="shClose">關閉</button></div>
      <div class="row">${G.monsters.map(x => `<span class="chip ${x.uid === m.uid ? 'unique' : ''}" data-m="${x.uid}"><img src="img/monsters/${x.img}.png">${esc(T(x.name))}</span>`).join('')}</div>
      <div class="mpanel">
        <div class="big2"><img src="img/monsters/${m.img}.png"><h3>${esc(T(m.name))}</h3>
          <div class="counter"><button id="mDmgM">−</button><div><div class="cv">${m.dmg} / ${m.hp}</div><div class="small">傷害 / 生命</div></div><button id="mDmgP">＋</button></div>
          <div class="row" style="justify-content:center">生命上限 <button class="btn small" id="mHpM">−</button><button class="btn small" id="mHpP">＋</button></div>
        </div>
        <div style="flex:1">
          <div class="msg" style="font-size:15px">${G.phase === 'investigator' ? '調查員階段：可對此怪物進行<b>攻擊</b>或<b>躲避</b>。' : G.horrorStep ? '恐怖步驟：每位調查員對範圍內恐怖等級最高的怪物進行<b>恐怖檢定</b>。' : '神秘階段'}</div>
          <div class="btns" style="justify-content:flex-start">
            <button class="btn primary" id="mAtk">⚔ 攻擊</button>
            <button class="btn" id="mEva">躲避</button>
            <button class="btn blue" id="mHor">恐怖檢定</button>
            <button class="btn" id="mAct">怪物行動（手動）</button>
            <button class="btn" id="mKill">擊敗／移除</button>
          </div>
          <div class="small" style="margin-top:8px">怪物類型：${esc(({ Humanoid: '類人', Beast: '野獸', Spirit: '靈體', Fleshless: '無肉身', 'Dunwich Horror': '敦威治恐怖', Snake_Person: '蛇人' })[def.type] || def.type || '')}　·　圖上的怪物可拖曳移動</div>
        </div>
      </div>`);
    UI.$('#shClose').onclick = () => this.closeSheet();
    UI.$('#sheetInner').querySelectorAll('[data-m]').forEach(el => el.onclick = () => this.monsterSheet(+el.dataset.m));
    const upd = () => { this.render(); this.monsterSheet(m.uid); };
    UI.$('#mDmgP').onclick = async () => { m.dmg++; upd(); if (m.dmg >= m.hp) { const ok = await this.confirm(`${T(m.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`); if (ok) { this.closeSheet(); await Engine.killMonster(m); } } };
    UI.$('#mDmgM').onclick = () => { m.dmg = Math.max(0, m.dmg - 1); upd(); };
    UI.$('#mHpP').onclick = () => { m.hp++; upd(); };
    UI.$('#mHpM').onclick = () => { m.hp = Math.max(1, m.hp - 1); upd(); };
    const run = (kind, ev) => async () => { if (busy) return; this.closeSheet(); await Engine.runMonsterTemplate(m, kind, ev); this.monsterSheet(m.uid); };
    UI.$('#mAtk').onclick = run('invattack', 'MONSTER/INVESTIGATOR_ATTACK/START');
    UI.$('#mEva').onclick = run('evade', 'MONSTER/EVADE/START');
    UI.$('#mHor').onclick = run('horror', 'MONSTER/HORROR/START');
    UI.$('#mAct').onclick = run('attack', 'MONSTER/ATTACK/START');
    UI.$('#mKill').onclick = async () => { const ok = await this.confirm(`確定移除 ${T(m.name)}？（若是被擊敗，劇本可能會觸發後續事件）`); if (ok) { this.closeSheet(); await Engine.killMonster(m); } };
  },

  // ---------- 物品 ----------
  itemSheet() {
    if (!G.scen) return;
    const groups = [{ t: '物品堆（尚未分配）', list: G.items.filter(i => i.owner == null) }].concat(G.inv.map((iv, i) => ({ t: iv.name, list: G.items.filter(x => x.owner === i) })));
    const all = Engine.collectionItems().filter(it => !G.items.some(x => x.id === it.id)).sort((a, b) => a.type - b.type);
    UI.openSheet(`<div class="sheetHead"><h3>物品</h3><button class="btn small" id="shClose">關閉</button></div>
      ${groups.map(g => `<div class="lbl" style="font-size:14px">${esc(g.t)}</div><div class="chips">${g.list.map(it => `<span class="chip ${it.type === 1 ? 'spell' : it.type === 2 ? 'unique' : ''}" data-item="${it.id}"><img src="img/items/${it.img}.png">${esc(T(it.name))}</span>`).join('') || '<span class="small">（無）</span>'}</div>`).join('')}
      <div class="lbl" style="font-size:14px;margin-top:12px">手動加入物品（實體遊戲中取得時使用）</div>
      <div class="addRow"><select id="addItemSel"><option value="">選擇物品…</option>${all.map(it => `<option value="${it.id}">${['普通', '法術', '獨特'][it.type]}：${esc(T(it.name))}</option>`).join('')}</select><button id="addItemBtn">加入</button></div>`);
    UI.$('#shClose').onclick = () => this.closeSheet();
    UI.$('#sheetInner').querySelectorAll('[data-item]').forEach(el => el.onclick = () => { this.closeSheet(); this.itemDetail(G.items.find(x => x.id === el.dataset.item)); });
    UI.$('#addItemBtn').onclick = () => { const id = UI.$('#addItemSel').value; if (id) { Engine.addItem(DB.items[id]); this.itemSheet(); } };
  },
  itemTraits(it) {
    const d = DB.items[it.id] || {}; const t = d.traits || 0;
    const N = ['武器', '重型武器', '銳器', '槍械', '恢復', '書籍', '工具', '光源', '飾品', '強力', '虛弱', '實用', '攻擊法術', '小型', '大型', '戶外', '家用', '違禁品'];
    return N.filter((n, i) => t & (1 << i));
  },
  itemText(id) { const m = lsGet('mom2_item_text', {}); return m[id] || (window.ITEM_TEXT && ITEM_TEXT[id]) || ''; },
  itemDetail(it) {
    if (!it) return;
    const fsm = it.node && G.fsmByObj[it.node];
    const acts = [];
    if (fsm && fsm.hasHandler('ACTIVATE_ITEM')) acts.push({ label: '檢視／使用', ev: 'ACTIVATE_ITEM' });
    it.interactions.forEach(x => acts.push(x));
    const tr = this.itemTraits(it);
    UI.openDialog(`<h3 class="dlgTitle">${esc(T(it.name))}</h3>
      <div class="itemCard"><img src="img/items/${it.img}.png" style="width:130px;height:130px"><div>${['普通物品', '法術', '獨特物品'][it.type]}${tr.length ? `<br><span class="small">特性：${tr.join('、')}</span>` : ''}<br><span class="small">持有者：${it.owner == null ? '物品堆' : esc(G.inv[it.owner].name)}</span></div></div>
      <div class="lbl" style="font-size:14px">卡片效果</div>
      <textarea id="itText" class="ability" style="min-height:90px;font-size:15px" placeholder="官方 App 裡沒有卡片效果文字，請照實體卡片輸入（輸入一次就會記住）">${esc(this.itemText(it.id))}</textarea>
      <div class="row">交給：<select id="giveSel"><option value="-1">物品堆</option>${G.inv.map((iv, i) => `<option value="${i}" ${it.owner === i ? 'selected' : ''}>${esc(iv.name)}</option>`).join('')}</select></div>
      <div class="btns">${acts.map((x, i) => `<button class="btn primary" data-act="${i}">${esc(x.label)}</button>`).join('')}<button class="btn" id="itDrop">丟棄</button><button class="btn" id="itClose">關閉</button></div>`);
    UI.$('#itText').onchange = e => { const m = lsGet('mom2_item_text', {}); m[it.id] = e.target.value; lsSet('mom2_item_text', m); this.render(); };
    UI.$('#giveSel').onchange = e => { const v = +e.target.value; it.owner = v < 0 ? null : v; this.render(); };
    UI.$('#itClose').onclick = () => this.closeDialog();
    UI.$('#itDrop').onclick = async () => { this.closeDialog(); if (await this.confirm('確定丟棄這個物品？')) { G.items.splice(G.items.indexOf(it), 1); this.render(); } };
    UI.$('#dialog').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const x = acts[+b.dataset.act]; this.closeDialog();
      if (fsm) fsm.fire(x.ev);
    });
  },

  // ---------- 標記 ----------
  tokenSheet() {
    if (!G.scen) return;
    UI.openSheet(`<div class="sheetHead"><h3>地圖標記</h3><button class="btn small" id="shClose">關閉</button></div>
      <div class="small">點選後會放在畫面中央，可拖曳到正確位置；在地圖上按右鍵可移除。</div>
      <div class="grid">${TOKEN_TYPES.map(t => `<div class="pick" data-k="${t.kind}"><img src="${t.img}" style="border-radius:0;object-fit:contain"><div>${t.name}</div></div>`).join('')}</div>`);
    UI.$('#shClose').onclick = () => this.closeSheet();
    UI.$('#sheetInner').querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
      const B = UI.$('#board').getBoundingClientRect();
      const x = (B.width / 2 - this.cam.x) / this.cam.z / U, y = -((B.height / 2 - this.cam.y) / this.cam.z / U);
      G.tokens.push({ id: Date.now() + Math.random(), kind: el.dataset.k, x, y });
      this.closeSheet(); this.render();
    });
  },

  // ---------- 擲骰 ----------
  // 瘋狂詭宅骰：8 面，3 面成功（遠古印記）、2 面線索（放大鏡）、3 面空白
  rollDie() { const r = rnd(100); return r < 39 ? 'S' : r < 64 ? 'C' : 'B'; },
  diceDialog(opts = {}, onDone) {
    return new Promise(res => {
      let ivIdx = opts.inv ?? 0, skill = opts.skill || 'obs', mod = 0, dice = [], used = 0, locked = new Set();
      const iv = () => G.inv[ivIdx];
      const draw = () => {
        const succ = dice.filter(d => d === 'S').length;
        UI.openDialog(`<h3 class="dlgTitle">擲骰</h3>
          ${opts.text ? `<div class="msg" style="font-size:15px">${fmt(opts.text)}</div>` : ''}
          <div class="row">調查員：<select id="dInv">${G.inv.map((x, i) => `<option value="${i}" ${i === ivIdx ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
            能力：<select id="dSk">${SKILLS.map(s => `<option value="${s.k}" ${s.k === skill ? 'selected' : ''}>${s.zh}（${iv() ? iv().skills[s.k] : 0}）</option>`).join('')}</select>
            加減骰數：<button class="btn small" id="dM">−</button><b>${mod >= 0 ? '+' : ''}${mod}</b><button class="btn small" id="dP">＋</button></div>
          <div class="btns"><button class="btn primary" id="dRoll">擲 ${Math.max(0, (iv() ? iv().skills[skill] : 0) + mod)} 顆骰</button><button class="btn" id="dAdd">再加擲 1 顆</button><button class="btn" id="dRe" ${dice.length ? '' : 'disabled'}>重擲選取的骰</button></div>
          <div class="dice">${dice.map((d, i) => `<div class="die roll ${d === 'B' ? 'blank' : ''} ${locked.has(i) ? 'lock' : ''}" data-i="${i}"><img src="${d === 'S' ? 'img/ui/ElderSign_256.png' : 'img/ui/MAD20_Clue-Token.png'}"></div>`).join('')}</div>
          ${dice.length ? `<div class="diceSum">成功 <b>${succ}</b>　　線索面 ${dice.filter(d => d === 'C').length}　　空白 ${dice.filter(d => d === 'B').length}</div>
          <div class="btns"><button class="btn" id="dClue" ${iv() && iv().clues > 0 && dice.includes('C') ? '' : 'disabled'}>花 1 線索：把 1 個放大鏡變成功（剩 ${iv() ? iv().clues : 0}）</button></div>
          <div class="small" style="text-align:center">點骰子可選取（用於重擲）。</div>` : ''}
          <div class="btns"><button class="btn ${opts.useResult ? 'primary' : ''}" id="dDone">${opts.useResult ? `使用結果（${succ} 成功）` : '關閉'}</button></div>`);
        UI.$('#dInv').onchange = e => { ivIdx = +e.target.value; draw(); };
        UI.$('#dSk').onchange = e => { skill = e.target.value; draw(); };
        UI.$('#dM').onclick = () => { mod--; draw(); }; UI.$('#dP').onclick = () => { mod++; draw(); };
        UI.$('#dRoll').onclick = () => { const n = Math.max(0, (iv() ? iv().skills[skill] : 0) + mod); dice = Array.from({ length: n }, () => this.rollDie()); locked.clear(); draw(); };
        UI.$('#dAdd').onclick = () => { dice.push(this.rollDie()); draw(); };
        UI.$('#dRe').onclick = () => { locked.forEach(i => dice[i] = this.rollDie()); locked.clear(); draw(); };
        UI.$('#dialog').querySelectorAll('.die').forEach(el => el.onclick = () => { const i = +el.dataset.i; locked.has(i) ? locked.delete(i) : locked.add(i); el.classList.toggle('lock'); });
        const cl = UI.$('#dClue'); if (cl) cl.onclick = () => { const i = dice.indexOf('C'); if (i >= 0 && iv().clues > 0) { dice[i] = 'S'; iv().clues--; this.render(); draw(); } };
        UI.$('#dDone').onclick = () => { this.closeDialog(); res(dice.filter(d => d === 'S').length); };
      };
      draw();
    });
  },

  // ---------- 對話框 ----------
  openDialog(html) { UI.$('#dialog').innerHTML = html; UI.$('#overlay').classList.remove('hidden'); UI.$('#dialog').scrollTop = 0; },
  closeDialog() { UI.$('#overlay').classList.add('hidden'); UI.$('#dialog').innerHTML = ''; },
  openSheet(html) { UI.$('#sheetInner').innerHTML = html; UI.$('#sheet').classList.remove('hidden'); UI.$('#sheet').onclick = e => { if (e.target.id === 'sheet') this.closeSheet(); }; },
  closeSheet() { UI.$('#sheet').classList.add('hidden'); },
  confirm(text) {
    return new Promise(res => {
      // 蓋在別的視窗上：把原本的畫面元件整個收起來，問完再放回去（只抄文字會讓原本的按鈕點了沒反應）
      const D = UI.$('#dialog');
      const prev = UI.$('#overlay').classList.contains('hidden') ? null : [...D.childNodes];
      const top = D.scrollTop;
      UI.openDialog(`<div class="msg">${fmt(text)}</div><div class="btns"><button class="btn" id="cNo">取消</button><button class="btn primary" id="cYes">確定</button></div>`);
      const done = v => { if (prev && prev.length) { D.replaceChildren(...prev); UI.$('#overlay').classList.remove('hidden'); D.scrollTop = top; } else this.closeDialog(); res(v); };
      UI.$('#cNo').onclick = () => done(false); UI.$('#cYes').onclick = () => done(true);
    });
  },
  srcHtml(o) {
    if (o.monster) return `<div class="msgSrc"><img src="img/monsters/${o.monster.img}.png"><b>${esc(T(o.monster.name))}</b></div>`;
    const si = Engine.sourceInfo(o.source);
    if (si && si.img) return `<div class="msgSrc"><img src="${si.img}" style="object-fit:contain;background:transparent;border:none"></div>`;
    return '';
  },
  message(o) {
    return new Promise(res => {
      const si = Engine.sourceInfo(o.source);
      if (si) { const n = G.nodes[si.id]; if (n) { n.hl = Date.now(); this.renderBoard(); } }
      if (o.text) Engine.log(o.text);
      const btns = o.buttons && o.buttons.length ? o.buttons : [{ label: T('UI_TAP_TO_CONTINUE') || '繼續', ev: 'NEXT', primary: true }];
      this.openDialog(`${o.title ? `<h3 class="dlgTitle">${esc(o.title)}</h3>` : ''}${this.srcHtml(o)}
        ${o.text ? `<div class="msg">${fmt(o.text)}</div>` : ''}
        ${(o.items || []).map(it => `<div class="itemCard"><img src="img/items/${it.img}.png"><div><b>${esc(T(it.name))}</b><br><span class="small">${['普通物品', '法術', '獨特物品'][it.type]}　·　已放入物品堆，可在左右欄或「物品」分配給調查員</span></div></div>`).join('')}
        ${o.spawn && o.monster ? `<div class="itemCard"><img src="img/monsters/${o.monster.img}.png" style="border-radius:50%"><div><b>${esc(T(o.monster.name))}</b><br>生命 ${o.monster.hp}<br><span class="small">請把對應的怪物模型放到地圖上標示的位置</span></div></div>` : ''}
        <div class="btns" style="${o.vertical ? 'flex-direction:column;align-items:stretch' : ''}">${btns.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''}" data-b="${i}">${esc((b.label || '').replace(/[\ue000-\uf8ff]/g, '').trim())}</button>`).join('')}</div>`);
      UI.$('#dialog').querySelectorAll('[data-b]').forEach(el => el.onclick = () => { this.closeDialog(); res(btns[+el.dataset.b].ev); setTimeout(() => this.render(), 0); });
    });
  },
  challenge(o) {
    return new Promise(res => {
      let n = 0;
      if (o.text) Engine.log(o.text);
      const draw = () => {
        this.openDialog(`${this.srcHtml(o)}<div class="msg">${fmt(o.text)}</div>
          <div class="counter"><button id="chM">−</button><img src="img/ui/ElderSign_256.png"><div class="cv">${n}</div><button id="chP">＋</button></div>
          <div class="small" style="text-align:center">輸入你擲出的成功數（可先按「擲骰」讓程式幫你擲）</div>
          <div class="btns"><button class="btn" id="chRoll">🎲 擲骰</button><button class="btn primary" id="chOk">確認</button></div>`);
        UI.$('#chM').onclick = () => { n = Math.max(0, n - 1); draw(); };
        UI.$('#chP').onclick = () => { n++; draw(); };
        UI.$('#chOk').onclick = () => { this.closeDialog(); Engine.log(`→ 成功數：${n}`); res(n); };
        UI.$('#chRoll').onclick = async () => {
          const ic = (o.text.match(/[\uf200-\uf205]/) || [])[0];
          const sk = ic ? SKILLS[ic.charCodeAt(0) - 0xf200].k : 'obs';
          n = await this.diceDialog({ skill: sk, text: o.text, useResult: true });
          draw();
        };
      };
      draw();
    });
  },
  async cutscene(name, title) {
    const keys = []; for (let i = 1; i < 20; i++) { const k = `CUTSCENE_${name}_${String(i).padStart(2, '0')}`; if (hasKey(k)) keys.push(k); else break; }
    for (let i = 0; i < keys.length; i++) await Engine.say({ title: i === 0 ? title : '', text: T(keys[i]), buttons: [{ label: i === keys.length - 1 ? '開始' : '繼續', ev: 'NEXT', primary: true }] });
  },
  async gameOver(victory, cut) {
    const nm = CUTSCENES[cut];
    if (nm) await this.cutscene(nm, victory ? '調查成功' : '調查失敗');
    await new Promise(res => {
      this.openDialog(`<h3 class="dlgTitle">${victory ? '勝利！' : '遊戲結束'}</h3><div class="msg">共進行了 ${G.round} 輪。</div>
        <div class="btns"><button class="btn primary" id="goNew">開新遊戲</button><button class="btn" id="goStay">留在地圖</button></div>`);
      UI.$('#goNew').onclick = () => { this.closeDialog(); location.reload(); };
      UI.$('#goStay').onclick = () => { this.closeDialog(); res(); };
    });
  },
  banner(kind) {
    const b = UI.$('#banner');
    UI.$('#bannerImg').src = kind === 'mythos' ? 'img/misc/Mythos_Phase.png' : 'img/misc/Investigator_Phase.png';
    UI.$('#bannerText').textContent = kind === 'mythos' ? T('UI_PHASE_MYTHOS') : T('UI_PHASE_INVESTIGATOR');
    b.classList.remove('hidden'); b.style.animation = 'none'; b.offsetHeight; b.style.animation = '';
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), 1700);
  },
  toast(s) { const t = UI.$('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), 2200); },
  showLog() {
    UI.openSheet(`<div class="sheetHead"><h3>訊息紀錄</h3><button class="btn small" id="shClose">關閉</button></div>
      <div class="loglist">${G.log ? G.log.slice().reverse().map(l => `<div class="le"><span class="lr">第 ${l.round} 輪 · ${l.phase === 'mythos' ? '神秘' : l.phase === 'setup' ? '設置' : '調查員'}</span><br>${esc(l.text)}</div>`).join('') : ''}</div>`);
    UI.$('#shClose').onclick = () => this.closeSheet();
  },
  menu() {
    UI.openDialog(`<h3 class="dlgTitle">選單</h3>
      <div class="msg" style="font-size:14px">威脅值（隱藏資訊，僅供參考）：累計 ${G.threat || 0}，未使用 ${G.unspent || 0}<br>地圖版本：${G.variant || '—'}<br>APP 版本：${typeof APP_VERSION !== 'undefined' ? APP_VERSION : '—'}</div>
      <div class="btns" style="flex-direction:column;align-items:stretch">
        <button class="btn" id="mnNew">開新遊戲</button>
        <button class="btn" id="mnHelp">操作說明</button>
        <button class="btn" id="mnClose">關閉</button>
      </div>`);
    UI.$('#mnClose').onclick = () => this.closeDialog();
    UI.$('#mnNew').onclick = async () => { if (await this.confirm('確定放棄目前遊戲並開新局？（目前進度會被刪除）')) { Engine.clearSave(); location.reload(); } };
    UI.$('#mnHelp').onclick = () => this.openDialog(`<h3 class="dlgTitle">操作說明</h3><div class="msg" style="font-size:14px;white-space:normal">
      ・<b>地圖</b>：拖曳空白處移動視角，滾輪縮放。點擊搜索／探索／互動標記，跟官方 App 一樣觸發劇情。<br>
      ・<b>調查員</b>：圖上的頭像可以拖曳到所在位置。左右欄記錄生命、理智、線索、能力值、物品與狀態。能力值點一下可修改，Shift＋點擊直接擲骰。<br>
      ・<b>檢定</b>：遇到檢定時可按「擲骰」，程式依能力值擲骰並自動填入成功數。<br>
      ・<b>怪物</b>：下方怪物列點選怪物，可進行攻擊、躲避、恐怖檢定與記錄傷害。<br>
      ・<b>物品</b>：找到的物品先放進物品堆，再交給調查員。<br>
      ・<b>回合</b>：做完所有調查員行動後，按右上角「結束調查員階段」。神秘階段結束時再按「結束神秘階段」。<br>
      ・遊戲會自動存檔（每次對話結束後）。關掉網頁後再打開，可以選擇「繼續遊戲」。</div><div class="btns"><button class="btn" id="hClose">關閉</button></div>`) || (UI.$('#hClose').onclick = () => this.closeDialog());
  }
};
window.addEventListener('load', () => UI.init());
