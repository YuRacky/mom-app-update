// ============================================================
//  第 7 批：官方過場畫面、怪物數量上限、怪物移動暫停、物品＋線索提示
// ============================================================
(function () {
  // ==========================================================
  //  1. 官方過場畫面（左邊有框的圖、右邊花紋標題線＋一段一段出現的文字）
  //     圖片與時間取自官方 App 的 MoM_CutsceneItem
  // ==========================================================
  const CUT = {
    COE_PROLOGUE: { audio: 'CoE_Prologue_EN', reveal: [0.5, 14, 20, 25, 39, 58], cont: 63, imgs: [250, 173, 593] },
    COE_PORTALCONSUMESHOUSE: { audio: 'CoE_Epilogue_1_EN', reveal: [0.5, 8, 15], cont: 20, imgs: [497, 610, 460] },   // 1.2.55 測試組：圖順序照遊戲
    COE_PORTALCLOSED: { audio: 'CoE_Epilogue_2_EN', reveal: [0.5, 17, 25.5], cont: 26, imgs: [349, 467, 114] },
    COE_RITUALSTOPPED: { audio: 'CoE_Epilogue_3_EN', reveal: [0.5, 13, 24], cont: 30, imgs: [507, 29, 614, 19] },
    ALL_INVESTIGATORDEATH: { audio: null, reveal: [0.5, 15], cont: 19, imgs: [94] }
  };
  if (typeof CUTS_EXTRA !== 'undefined') for (const [k, v] of Object.entries(CUTS_EXTRA)) if (!CUT[k]) CUT[k] = v;
  const keysOf = name => { if (CUT[name] && CUT[name].keys) return CUT[name].keys.filter(hasKey); const k = []; for (let i = 1; i < 20; i++) { const s = `CUTSCENE_${name}_${String(i).padStart(2, '0')}`; if (hasKey(s)) k.push(s); else break; } return k; };

  UI.cutscene = function (name) {
    const keys = keysOf(name);
    if (!keys.length) return Promise.resolve();
    const d = CUT[name] || { reveal: keys.map((_, i) => 0.5 + i * 6), cont: keys.length * 6, imgs: [] };
    const reveal = keys.map((_, i) => d.reveal[i] != null ? d.reveal[i] : (d.reveal[d.reveal.length - 1] || 0) + 6 * (i - d.reveal.length + 1));
    const total = Math.max(d.cont, reveal[reveal.length - 1] + 1);
    return new Promise(res => {
      const el = document.createElement('div'); el.id = 'cutscene';
      el.innerHTML = `<div class="csWrap">
        <div class="csArt"><div class="csWin">${d.imgs.map((p, i) => `<img data-k="${i}" src="img/cut/${p}.jpg" class="${i ? '' : 'on'}" style="--dur:${(total / d.imgs.length + 3).toFixed(1)}s">`).join('')}</div></div>
        <div class="csText">
          <img class="csOrn" src="img/ui/FancyBorder.png">
          <div class="csParas">${keys.map((k, i) => `<p data-k="${i}">${fmt(T(k))}</p>`).join('')}</div>
          <img class="csOrn bottom" src="img/ui/FancyBorder.png">
        </div></div>
        <div class="csCont">點一下顯示下一段</div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('on'));
      // 旁白（官方英文配音）；靜音時不播
      let voice = null;
      if (d.audio && window.AU && !AU.st.mute && AU.unlocked) {
        voice = new Audio('audio/' + d.audio + '.ogg'); voice.volume = Math.min(1, AU.st.sfx);
        voice.play().catch(() => { });
        setTimeout(() => { if (AU.bgm && document.body.contains(el)) AU.fade(AU.bgm, AU.st.music * 0.35, 800); }, 1300);
      }
      let t = 0, last = performance.now(), shown = -1, img = 0, over = false, raf;
      const P = [...el.querySelectorAll('.csParas p')], I = [...el.querySelectorAll('.csWin img')];
      const cont = el.querySelector('.csCont');
      const win = el.querySelector('.csWin');
      const fit = im => { const s = Math.max(0, im.offsetWidth - win.clientWidth); im.style.setProperty('--shift', -s + 'px'); };
      I.forEach(im => { if (im.complete) fit(im); else im.onload = () => fit(im); });
      const step = now => {
        t += Math.max(0, now - last) / 1000; last = Math.max(last, now);
        while (shown + 1 < P.length && t >= reveal[shown + 1]) { shown++; P[shown].classList.add('on'); try { P[shown].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } }
        if (I.length) {
          const k = Math.max(0, Math.min(I.length - 1, Math.floor(t / (total / I.length))));
          if (k !== img) { I[img].classList.remove('on'); I[k].classList.add('on'); img = k; }
        }
        if (!over && shown === P.length - 1 && t >= reveal[shown] + 1.5) { over = true; cont.textContent = '繼續'; cont.classList.add('ready'); }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      const finish = () => {
        cancelAnimationFrame(raf);
        if (voice) { const v = voice; AU.fade(v, 0, 600, () => v.pause()); }
        if (AU.bgm && !AU.st.mute) AU.fade(AU.bgm, AU.st.music, 800);
        el.classList.remove('on'); setTimeout(() => el.remove(), 450);
        res();
      };
      el.onclick = () => {
        if (over) return finish();
        // 跳到下一段
        const nx = shown + 1;
        if (nx < P.length) {
          t = Math.max(t, reveal[nx]);
          if (voice && voice.duration && t < voice.duration) { try { voice.currentTime = t; } catch (e) { } }
        }
      };
    });
  };

  // 遊戲結束：先播過場（不經過對話佇列，避免卡住），再顯示結果
  UI.gameOver = (function (orig) {
    return async function (victory, cut) {
      const nm = CUTSCENES[cut];
      if (nm) await UI.cutscene(nm);
      const saved = CUTSCENES[cut];
      try { delete CUTSCENES[cut]; return await orig.apply(UI, arguments); } finally { if (saved) CUTSCENES[cut] = saved; }
    };
  })(UI.gameOver);

  // ==========================================================
  //  2. 怪物數量不超過你擁有的模型
  //     （以前所有同種怪物都在場上時還會繼續產生，所以出現 5 個邪教徒）
  // ==========================================================
  Engine.pickMonster = function (req, excl) {
    req = req || 0; excl = excl || 0;
    const owned = Engine.collectionMonsters();
    const counts = {}; owned.forEach(m => counts[m.id] = (counts[m.id] || 0) + 1);
    const ok = (m, r) => (m.traits & r) === r && (m.traits & excl) === 0 && !(m.traits & TRAIT_UNIQUE && !(r & TRAIT_UNIQUE)) && !DB.scenario.reservedMonsters.includes(m.id);
    const free = m => G.monsters.filter(x => x.model === m.id).length < counts[m.id];
    const types = Object.keys(counts).map(id => DB.monsters[id]);
    let cand = types.filter(m => ok(m, req) && free(m));
    if (!cand.length) cand = types.filter(m => ok(m, 0) && free(m));          // 同種的都用完了：換別種還有模型的怪物
    if (!cand.length) { Engine.log('（你擁有的怪物模型都已在場上，這次沒有怪物出現）'); return null; }
    return pick(cand);
  };

  // ==========================================================
  //  4. 訊息裡「獲得【某物品】」：和線索一起，按「繼續」後自動給人
  //     認錯或沒認到時，可以按「＋ 物品」手動補
  // ==========================================================
  // 引號裡的長句是角色說的話（可能有「如果」），判斷時先拿掉；短的是物品名稱，保留
  CE.stripQuotes = s => String(s || '').replace(/[“"「]([^”"」]{13,})[”"」]/g, '');
  CE.itemsInText = function (o) {
    if (!o || !o.text) return [];
    const t = CE.stripQuotes(o.text).split(/如果/)[0];
    const segs = []; let m; const re = /獲得([^。！]*)/g;
    while ((m = re.exec(t))) segs.push(m[1]);
    if (!segs.length) return [];
    const out = [];
    for (const def of Object.values(DB.items)) {
      const n = T(def.name); if (!n || n.length < 2) continue;
      if (!segs.some(s => s.includes(n))) continue;
      const it = G.items.find(i => i.id === def.id);
      if (it && (it.owner != null || it.ground)) continue;
      if (!out.some(d => T(d.name) === n)) out.push(def);
    }
    // 名稱互相包含時保留較長的
    return out.filter(d => !out.some(e => e !== d && T(e.name).includes(T(d.name))));
  };
  const plan0 = CE.planEffects;
  CE.planEffects = function (o) {
    let p = null;
    try { p = plan0.call(CE, o && o.text ? Object.assign({}, o, { text: CE.stripQuotes(o.text) }) : o); } catch (e) { console.error(e); }
    let items = [];
    try { if (!(o && o.fsm && o.fsm.kind === 'attack') && !(CE.parseNeed(o.text || '') != null) && !/檢定/.test(o.text || '')) items = CE.itemsInText(o); } catch (e) { console.error(e); }
    if (!items.length) return p;
    let who = p && p.targets && p.targets.length === 1 ? p.targets[0] : null;
    if (who == null) who = CE.nodeActor != null ? CE.nodeActor : CE.actorNow();
    if (who == null || !G.inv[who]) return p;
    if (!p) p = { targets: [], fx: { clue: 0, hits: [], heal: [], conds: [] }, desc: '' };
    p.items = items; p.itemTo = who;
    const rest = p.desc ? p.desc.replace(/^[^：]*：/, '') : '';
    const itemTxt = items.map(d => `獲得【${T(d.name)}】`).join('、');
    const sameWho = p.targets.length === 1 && p.targets[0] === who;
    if (!p.targets.length || sameWho) p.desc = `${G.inv[who].name}：${itemTxt}${rest ? '＋' + rest.replace(/獲得 (\d+) 線索/, '$1 線索') : ''}`;
    else p.desc = `${G.inv[who].name}：${itemTxt}；${p.desc}`;
    return p;
  };
  const run0 = CE.runPlan;
  CE.runPlan = async function (p) {
    if (p.items && p.items.length) {
      const iv = G.inv[p.itemTo];
      for (const def of p.items) {
        const it = Engine.addItem(def);
        if (it.owner == null && iv && !iv.removed) { it.owner = p.itemTo; it.ground = false; Engine.log(`${iv.name} 獲得了 ${T(it.name)}`); if (window.AU) AU.sfx('GainItem_01'); }
      }
    }
    if (p.targets.length) return run0.call(CE, p);
    UI.toast('已套用：' + p.desc); UI.render();
  };
  // 「放在某某所在格子」：放在那個怪物（或剛被擊敗的怪物）的位置
  const kill0 = Engine.killMonster;
  Engine.killMonster = function (m) { if (m) CE._lastDead = { x: m.x, y: m.y, node: m.node, name: T(m.name) }; return kill0.apply(Engine, arguments); };
  const spawn0 = Actions.SpawnItem;
  Actions.SpawnItem = async function (a, f) {
    const raw = T(a.Message && (a.Message.Key || a.Message)) || '';
    CE._dropAt = null;
    if (!a.SpawnPoint && /所在(的)?(格子|位置|區域)/.test(raw)) {
      const live = G.monsters.find(m => (f && f.object && m.node === f.object) || raw.includes(T(m.name)));
      if (live) CE._dropAt = { x: live.x, y: live.y };
      else if (CE._lastDead && ((f && f.object && CE._lastDead.node === f.object) || raw.includes(CE._lastDead.name) || true)) CE._dropAt = { x: CE._lastDead.x, y: CE._lastDead.y };
    }
    try { return await spawn0.apply(Actions, arguments); } finally { CE._dropAt = null; }
  };
  const pg0 = CE.placeGround;
  CE.placeGround = function (it, pos) { return pg0.call(CE, it, pos || CE._dropAt || null); };
  // 手動補物品
  CE.manualGive = function (hint) {
    return new Promise(res => {
      const all = Object.values(DB.items).filter(d => { const it = G.items.find(i => i.id === d.id); return !(it && it.owner != null); })
        .sort((a, b) => (b.type === 2) - (a.type === 2) || T(a.name).localeCompare(T(b.name), 'zh-Hant'));
      const guess = all.find(d => hint && hint.includes(T(d.name)));
      let to = CE.nodeActor != null ? CE.nodeActor : CE.actorNow();
      if (to == null) to = CE.alive()[0];
      const w = CE.layer('');
      const draw = () => {
        w.box.innerHTML = `<h3 class="dlgTitle">手動加入物品</h3>
          <div class="small" style="margin-bottom:6px">給誰？</div>
          <div class="whoRow">${CE.alive().map(i => `<div class="who ${i === to ? 'on' : ''}" data-i="${i}"><img src="${G.inv[i].img}"><span>${esc(G.inv[i].name)}</span></div>`).join('')}</div>
          <div class="small" style="margin:10px 0 6px">哪一個物品？</div>
          <select id="mgSel" style="width:100%;padding:6px;font-size:15px;background:#181512;color:#eee;border:1px solid #6a5a44">${all.map(d => `<option value="${d.id}" ${guess === d ? 'selected' : ''}>${['普通', '法術', '獨特'][d.type] || ''}：${esc(T(d.name))}</option>`).join('')}</select>
          <div class="btns"><button class="btn" data-x="0">取消</button><button class="btn primary" data-x="1">給他</button></div>`;
        w.box.querySelectorAll('.who').forEach(e => e.onclick = () => { to = +e.dataset.i; draw(); });
        w.box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
          if (b.dataset.x === '1') {
            const def = DB.items[w.box.querySelector('#mgSel').value];
            if (def) { const it = Engine.addItem(def); it.owner = to; it.ground = false; Engine.log(`${G.inv[to].name} 獲得了 ${T(it.name)}`); UI.toast(`${G.inv[to].name} 獲得了【${T(it.name)}】`); if (window.AU) AU.sfx('GainItem_01'); UI.render(); }
          }
          w.close(); res();
        });
      };
      draw();
    });
  };
  const msg0 = UI.message;
  UI.message = function (o) {
    const p = msg0.apply(UI, arguments);
    try {
      const text = o && o.text || '';
      if (OFF.layer && /獲得|道具|發現/.test(text) && !(o.items && o.items.length) && G.phase !== 'setup') {
        const pop = OFF.layer.querySelector('#popup'), bg = pop && pop.querySelector('.bg');
        if (bg) {
          const b = document.createElement('div'); b.className = 'addItemBtn'; b.textContent = '＋ 物品';
          b.title = '系統沒認到物品時，按這裡手動給';
          b.style.top = (parseFloat(bg.style.top) + 4 * OFF.u) + 'px';
          b.onclick = async e => { e.stopPropagation(); OFF.layer.classList.add('hidden'); await CE.manualGive(text); OFF.layer.classList.remove('hidden'); };
          pop.appendChild(b);
        }
      }
    } catch (e) { console.error(e); }
    return p;
  };

  // ==========================================================
  //  3. 怪物「移動」：關掉對話框，怪物發光，玩家移動後按「移動完成」才繼續
  // ==========================================================
  const MOVE_RE = /移動\s*(\d+|一|兩|二|三)\s*格|移動到|朝[^。]*移動|向[^。]*移動/;
  CE.waitMonsterMove = function (m, text, btn) {
    return new Promise(res => {
      const old = document.getElementById('monMoveBar'); if (old) old.remove();
      CE._movingMon = m ? m.uid : null; UI.render();
      const bar = document.createElement('div'); bar.id = 'monMoveBar';
      bar.innerHTML = `<div class="mmTxt">${m ? `<img src="img/monsters/${m.img}.png">` : ''}<span>${esc(text)}</span></div><button class="btn primary big" id="mmDone">${btn || '移動完成'}</button>`;
      document.body.appendChild(bar);
      bar.querySelector('#mmDone').onclick = () => { bar.remove(); CE._movingMon = null; UI.render(); res(); };
    });
  };
  const moveSay = Engine.say;
  Engine.say = async function (o) {
    const r = await moveSay.apply(Engine, arguments);
    try {
      // 怪物出現：先讓玩家把模型放好（可以拖曳調整位置），再接下一段
      if (o && o.spawn && o.monster && G.monsters.includes(o.monster) && !MOVE_RE.test(o.text || '')) {
        await CE.waitMonsterMove(o.monster, `${T(o.monster.name)} 已放在地圖上標示的位置；把模型放到桌上同一格，需要的話可以拖曳調整`, '放好了');
        return r;
      }
      const text = o && o.text || '';
      const m = o && (o.monster || (o.fsm && o.fsm.monster) || G.monsters.slice().reverse().find(x => text.includes(T(x.name))));
      if (m && G.monsters.includes(m) && MOVE_RE.test(text) && (!o.buttons || o.buttons.length <= 1) && r !== 'CANCEL') {
        const mm = text.match(/[^。]*移動[^。]*。?/);
        const sent = mm ? mm[0].replace(/^[，、\s]+/, '') : ''; await CE.waitMonsterMove(m, sent ? (sent.includes(T(m.name)) ? sent : `${T(m.name)}：${sent}`) + '　移好後按右邊按鈕' : `請把 ${T(m.name)} 移動到指定位置`);
      }
    } catch (e) { console.error(e); }
    return r;
  };
  // 移動中的怪物發光
  const mark = () => {
    try {
      document.querySelectorAll('.moving').forEach(e => e.classList.remove('moving'));
      if (CE._movingMon != null) document.querySelectorAll(`[data-mon="${CE._movingMon}"], .mcard[data-m="${CE._movingMon}"]`).forEach(e => e.classList.add('moving'));
    } catch (e) { }
  };
  for (const fn of ['render', 'renderBoard']) {
    const o = UI[fn]; if (!o) continue;
    UI[fn] = function () { const r = o.apply(UI, arguments); mark(); return r; };
  }

  // ==========================================================
  //  5. 文字裡的「如果…，額外投擲 N 個骰子」：條件符合就自動加骰
  // ==========================================================
  const NUMS = { '一': 1, '兩': 2, '二': 2, '三': 3 };
  CE.textBonus = function (idx, text, monUid) {
    const t = CE.stripQuotes ? text : text;
    const m = (t || '').match(/([^。；;（）]*?)[，,]?\s*(?:則)?額外投擲\s*(\d+|一|兩|二|三)?\s*個骰子/);
    if (!m) return null;
    const cond = m[1], n = m[2] ? (+m[2] || NUMS[m[2]] || 1) : 1;
    const iv = G.inv[idx]; if (!iv) return null;
    let ok = null, why = '';
    const q = cond.match(/[“"「]([^”"」]+)[”"」]/);
    let k;
    if (q) { why = '持有' + q[1]; ok = CE.owned(idx).some(it => T(it.name) === q[1]); }
    else if (/法術/.test(cond)) { why = '持有法術'; ok = CE.owned(idx).some(it => it.type === 1); }
    else if ((k = cond.match(/(\d+)\s*(張|点|點)[^，]*?(傷害|恐怖)/)) && /你/.test(cond)) {
      const type = k[3] === '傷害' ? 'damage' : 'horror'; why = `${k[3]}卡 ${k[1]} 張以上`; ok = CE.total(iv, type) >= +k[1];
    } else if ((k = cond.match(/(怪物|生物)[^，]*?(\d+)\s*點[^，]*?傷害/))) {
      const mon = G.monsters.find(x => x.uid === monUid) || null; why = `怪物已受 ${k[2]} 點傷害以上`; ok = mon ? mon.dmg >= +k[2] : null;
    } else if (/同一個位置|同一格/.test(cond)) {
      const mon = G.monsters.find(x => x.uid === monUid) || null; why = '怪物和你在同一格';
      try { ok = mon ? MAP.same(MAP.posCell(mon), MAP.posCell(iv)) : null; } catch (e) { ok = null; }
    }
    return { n, ok, why: why || cond.replace(/^[；;，,\s]*如果/, '') };
  };
  let curOpts = null;
  const dd0 = UI.diceDialog;
  UI.diceDialog = function (opts = {}) {
    const prev = curOpts; curOpts = opts; CE._tbForce = null;
    const p = dd0.apply(UI, arguments);
    Promise.resolve(p).finally(() => { curOpts = prev; });
    return p;
  };
  const ab0 = CE.autoBonuses;
  CE.autoBonuses = function (idx, ctx) {
    const out = ab0.apply(CE, arguments);
    try {
      if (curOpts && curOpts.text) {
        const b = CE.textBonus(idx, curOpts.text, curOpts.monster);
        if (b && (b.ok || CE._tbForce === true)) out.push({ label: b.why, n: b.n, img: '' });
      }
    } catch (e) { console.error(e); }
    return out;
  };

  // ==========================================================
  //  6. 文字裡用「證據」性質道具改骰子
  //     ・棄除一張證據 → 重擲任意數量的骰子
  //     ・每持有一張證據 → 可以重擲一顆骰子
  //     ・每持有一張證據 → 可以把一個🔍變成成功
  // ==========================================================
  const isEvidence = it => ((CE.face(it) || {}).cat || '').includes('證據');
  const op0 = CE.optionals;
  CE.optionals = function (idx, ctx) {
    const out = op0.apply(CE, arguments);
    try {
      const t = curOpts && curOpts.text || '';
      if (!t || !/證據/.test(t)) return out;
      const ev = CE.owned(idx).filter(isEvidence);
      if (!ev.length) return out;
      const evTxt = '持有的證據：' + ev.map(it => T(it.name)).join('、');
      if (/棄除一張[“"]?證據[”"]?性質道具[^。]*重擲任意數量/.test(t)) {
        out.push({ key: '__evDiscard', item: ev[0], label: `棄除【${T(ev[0].name)}】重擲`, img: 'img/items/' + ev[0].img + '.png', text: '先點選要重擲的骰子，再按這裡。' + evTxt, eff: 'rerollSel', cost: {}, onUse: () => { CE.discardItem(ev[0], '使用'); Engine.log(`棄除【${T(ev[0].name)}】重擲骰子`); } });
      }
      if (/每持有一張[“"]?證據[”"]?性質道具[^。]*重擲一個骰子/.test(t)) {
        ev.forEach((it, i) => out.push({ key: '__evRe' + i, label: `證據重擲 1 顆（${i + 1}/${ev.length}）`, img: 'img/items/' + it.img + '.png', text: '先點選 1 顆要重擲的骰子。' + evTxt, eff: 'rerollOne', cost: {} }));
      }
      if (/每持有一張[“"]?證據[”"]?性質道具[^。]*轉化為一個/.test(t)) {
        ev.forEach((it, i) => out.push({ key: '__evCl' + i, label: `證據：🔍變成功（${i + 1}/${ev.length}）`, img: 'img/items/' + it.img + '.png', text: evTxt, eff: 'oneClue', cost: {} }));
      }
    } catch (e) { console.error(e); }
    return out;
  };

  // ==========================================================
  //  7. 「每個處於大廳的調查員…」：算出誰在那裡
  // ==========================================================
  const cellName = c => {
    const info = MAP.TILE_INFO[c.model] || {};
    const rk = c.room.split(':')[1];
    return c.name || (info.names && info.names[rk]) || T(c.model) || '';
  };
  const darkCells = () => [...G.tokens.filter(t => t.kind === 'dark'), ...Object.values(G.nodes).filter(n => n.visible && /Darkness/.test(n.sprite || ''))].map(t => MAP.cellAt(t.x, t.y)).filter(Boolean);
  const fireCells = () => [...G.tokens.filter(t => t.kind === 'fire'), ...Object.values(G.nodes).filter(n => n.visible && /Feature_Fire/.test(n.sprite || ''))].map(t => MAP.cellAt(t.x, t.y)).filter(Boolean);
  CE.whoIn = function (text) {
    try {
      const t = plain(text || '');
      const m = t.match(/(每個|每位|每名|所有)([^。，；]{0,6}?)(處於|位於|在)([^。，；]*?)(?:中|裡|內|之中)?的?調查員/);
      if (!m) return null;
      let area = m[4].replace(/(的)?(每個)?格子$/, '').trim();
      if (!area || /範圍|其他|你|怪物|\{|室外|室內|河流|或以上/.test(area)) return null;
      const parts = area.split(/和|或|、|及/).map(x => x.replace(/[\s\d]/g, '').replace(/格子$/, '')).filter(Boolean);
      const g = MAP.build(); const hit = new Set();
      for (const part of parts) {
        let cells;
        if (/^黑暗/.test(part)) cells = darkCells();
        else if (/^火焰/.test(part)) cells = fireCells();
        else {
          cells = g.cells.filter(c => { const n = cellName(c).replace(/[\s\d]/g, ''); return n && (n === part || n.startsWith(part)); });
          if (!cells.length) return null;           // 認不出這個地點：讓玩家自己選
        }
        cells.forEach(c => hit.add(c.id));
      }
      const list = CE.alive().filter(i => { const c = MAP.posCell(G.inv[i]); return c && hit.has(c.id); });
      return { area, list };
    } catch (e) { console.error(e); return null; }
  };
  // 訊息下方列出在那裡的人
  const msg1 = UI.message;
  UI.message = function (o) {
    const p = msg1.apply(UI, arguments);
    try {
      let w = o && o.text && G.phase !== 'setup' ? CE.whoIn(o.text) : null;
      if (w && o.fsm) CE._area = { fsm: o.fsm, w };
      else if (!w && o && o.fsm && CE._area && CE._area.fsm === o.fsm) {
        // 同一個事件的下一段（例如檢定）：沿用前面算出的「受影響的調查員」
        const c2 = CE._area.w.label ? null : CE.whoIn('每位在' + CE._area.w.area + '的調查員'); w = c2 || CE._area.w; CE._area.w = w;
      }
      if (w && OFF.layer) {
        const pop = OFF.layer.querySelector('#popup'), bg = pop && pop.querySelector('.bg');
        if (bg) {
          const el = document.createElement('div'); el.className = 'whoInBox';
          el.innerHTML = w.list.length ? `${w.label ? esc(w.label) : '在' + esc(w.area) + '的調查員'}：${w.list.map(i => `<span><img src="${G.inv[i].img}">${esc(G.inv[i].name)}</span>`).join('')}` : (w.label ? `目前沒有${esc(w.label)}，沒有人受到影響` : `目前沒有調查員在${esc(w.area)}，沒有人受到影響`);
          el.style.top = (parseFloat(bg.style.top) - 40 * OFF.u) + 'px';
          pop.appendChild(el);
          if (!w.list.length) pop.querySelectorAll('.rollPlate').forEach(e => e.remove());
          else if (w.list.length) { const rp = pop.querySelector('.rollPlate:not(.applyPlate)'); if (rp && w.list.length > 1) rp.textContent = `擲骰×${w.list.length}`; }
        }
      }
    } catch (e) { console.error(e); }
    return p;
  };
  // 沒有擲骰、只是「在某地的調查員受到…」：直接套用到在那裡的人
  const plan1 = CE.planEffects;
  CE.planEffects = function (o) {
    const p = plan1.apply(CE, arguments);
    if (p || !o || !o.text) return p;
    try {
      if (CE.parseNeed(o.text) != null || CE.parseNegate(o.text) || /檢定/.test(o.text)) return p;
      const w = CE.whoIn(o.text) || (CE._area && o.fsm && CE._area.fsm === o.fsm ? CE._area.w : null); if (!w || !w.list.length) return p;
      const hits = CE.parseHits(o.text.split(/如果/)[0]);
      if (!hits.length) return p;
      const desc = `在${w.area}的 ${w.list.map(i => G.inv[i].name).join('、')}：` + hits.map(h => `受到 ${h.n} 點${h.down ? '面朝下的' : ''}${h.type === 'damage' ? '傷害' : '恐怖'}`).join('、');
      return { targets: w.list.slice(), fx: { clue: 0, hits, heal: [], conds: [] }, desc };
    } catch (e) { console.error(e); return p; }
  };

  // ==========================================================
  //  8. 攻擊文字裡怪物受到多少傷害（依官方文字算）
  //     等同檢定結果 / 武器傷害 / 加上額外 N 點 / 固定 N 點
  // ==========================================================
  CE.monDmgFormula = function (seg) {
    if (!seg) return null;
    const re = /(怪物|敵人|生物|對手|它|牠)[^。；;]*?(受到|承受)([^。；;]*)/g;
    let m, c = null;
    while ((m = re.exec(seg))) { if (/傷害/.test(m[3])) { c = m[3]; break; } }
    if (c == null) return null;
    if (!/等同/.test(c)) { const f = c.match(/^\D{0,4}(\d+)\s*點/); if (!f) return null; const n = +f[1]; return { fx: () => n, txt: `${n} 點` }; }
    const after = c.slice(c.indexOf('等同'));
    const useW = /(武器|法術)傷害/.test(after), useS = /(檢定|判定)結果/.test(after);
    const ex = after.match(/(?:額外|加上?)\s*(\d+)\s*點/); const mi = after.match(/[–\-－減]\s*(\d+)/);
    const plus = (ex ? +ex[1] : 0) - (mi ? +mi[1] : 0);
    const parts = [useW ? '武器傷害' : '', useS ? '成功數' : ''].filter(Boolean).join('＋') + (plus > 0 ? `＋${plus}` : plus < 0 ? `－${-plus}` : '');
    if (!useW && !useS) return null;
    return { fx: (s, w) => Math.max(0, (useW ? w : 0) + (useS ? s : 0) + plus), txt: parts };
  };
  const dd1 = UI.diceDialog;
  UI.diceDialog = function (opts = {}) {
    try {
      // 文字裡指名了某位調查員：直接由他擲骰，不用問
      if (opts && opts.inv == null && opts.text && !(opts.only && opts.only.length > 1)) {
        const t = plain(opts.text), named = CE.alive().filter(i => t.includes(G.inv[i].name));
        if (named.length === 1 && (!opts.only || opts.only.includes(named[0]))) opts = Object.assign({}, opts, { inv: named[0] });
      }
      if (opts && opts.text && opts.kind === 'attack' && !opts.dmgFx) {
        const t = plain(opts.text);
        const iOk = t.indexOf('如果檢定成功'), iNg = t.indexOf('如果檢定失敗');
        const okSeg = iOk >= 0 ? t.slice(iOk, iNg > iOk ? iNg : undefined) : (iNg >= 0 ? t.slice(0, iNg) : t);
        const ngSeg = iNg >= 0 ? t.slice(iNg, iOk > iNg ? iOk : undefined) : '';
        const ok = CE.monDmgFormula(okSeg), ng = CE.monDmgFormula(ngSeg);
        if (ok || ng) opts = Object.assign({}, opts, { dmgFx: { ok: ok ? ok.fx : null, ng: ng ? ng.fx : (() => 0) }, dmgTxt: ok && ok.txt });
      }
    } catch (e) { console.error(e); }
    return dd1.call(UI, opts);
  };

  // ==========================================================
  //  9. 攻擊距離（官方規則）
  //     ・近戰武器、徒手、近戰法術：只能打同一格的怪物
  //     ・槍械、遠程法術：範圍內（3 格內，不穿牆）的怪物
  //     ・霰彈槍：只能打同一格（本版規則）；卡賓槍：不能打同一格
  // ==========================================================
  const TYPE_OF = f => f.spell || CE.isSpell(f.id) ? 'SPELL' : /槍械/.test(f.cat || '') ? 'FIREARM' : /銳器/.test(f.cat || '') ? 'BLADED' : /重型/.test(f.cat || '') ? 'HEAVY' : null;
  CE.attackDist = function (idx, m) {
    const a = MAP.posCell(G.inv[idx]), b = MAP.posCell(m);
    if (!a || !b) return { d: 0, unknown: true };
    if (a.id === b.id) return { d: 0 };
    const d = MAP.rangeDist(a.id)[b.id];
    return { d: d == null ? null : d };
  };
  CE.weaponOk = function (it, d) {
    const f = CE.face(it) || {}, w = f.w || (CE.isSpell(it.id) && CARDS.spells[it.id].front && CARDS.spells[it.id].front.w);
    if (!w) return false;
    const note = f.note || {};
    if (w === 'melee') return d === 0;
    if (d == null || d > 3) return false;
    if (note.noSameSpace && d === 0) return false;
    if (note.maxDist != null && d > note.maxDist) return false;
    return true;
  };
  CE.attackOptions = function (idx, m) {
    const { d, unknown } = CE.attackDist(idx, m);
    const items = CE.owned(idx).filter(it => { const f = CE.face(it) || {}; return (f.w || CE.isSpell(it.id)) && (unknown || CE.weaponOk(it, d)); });
    const types = new Set();
    items.forEach(it => { const f = Object.assign({ id: it.id }, CE.face(it) || {}); const t = TYPE_OF(f); if (t) types.add(t); });
    if (d === 0 || unknown) types.add('UNARMED');
    return { d, unknown, items: items.map(it => it.id), types };
  };
  const ms1 = UI.monsterSheet;
  UI.monsterSheet = function (uid) {
    ms1.apply(UI, arguments);
    const a = document.getElementById('mAtk'); if (!a) return;
    const prev = a.onclick;
    a.onclick = async () => {
      const m = G.monsters.find(x => x.uid === uid);
      if (G.phase === 'investigator' && m) {
        const i = CE.defaultInv(), o = CE.attackOptions(i, m);
        if (!o.types.size) {
          const far = o.d == null ? '不在範圍內（超過 3 格或被牆擋住）' : `相距 ${o.d} 格`;
          await CE.alert('打不到', `${G.inv[i].name} 和 ${T(m.name)} ${far}。\n\n近戰武器和徒手只能打同一格的怪物；\n槍械和遠程法術可以打範圍內（3 格內）的怪物，霰彈槍只能打同一格的怪物，卡賓槍不能打同一格。\n\n${G.inv[i].name} 身上沒有能打到這個距離的武器。`);
          return;
        }
        CE._atk = { idx: i, uid, types: o.types, items: o.items, d: o.d };
        CE._ia = { idx: i, covered: true, atk: true };
      }
      const myAtk = CE._atk, myIa = CE._ia;
      try { return prev && await prev(); } finally {
        // 只處理「這一次攻擊」自己的紀錄；別人已經開始新的行動（例如換人搜索）就不要動它
        const ia = CE._ia;
        if (ia && ia === myIa && ia.covered && G.phase === 'investigator') { const iv = G.inv[ia.idx]; if (iv && iv.turn) { iv.turn.acts = Math.max(0, iv.turn.acts - 1); UI.toast('取消攻擊，不扣行動'); UI.render(); } }
        if (CE._atk === myAtk) CE._atk = null;
        if (CE._ia === myIa) CE._ia = null;
      }
    };
  };
  // 選武器類型的對話：只留打得到的
  const say9 = Engine.say;
  Engine.say = function (o) {
    try {
      if (o && o.buttons && CE._atk && o.buttons.some(b => /^WEAPON\//.test(b.ev))) {
        const ok = o.buttons.filter(b => !/^WEAPON\//.test(b.ev) || CE._atk.types.has(b.ev.split('/')[1]));
        const dTxt = CE._atk.d == null ? '' : CE._atk.d === 0 ? '（同一格）' : `（相距 ${CE._atk.d} 格）`;
        o = Object.assign({}, o, { buttons: ok, text: (o.text || '') + `\n${dTxt}只列出打得到的武器類型。` });
      }
    } catch (e) { console.error(e); }
    return say9.call(Engine, o);
  };
  // 擲骰視窗的武器清單：只留打得到的
  const own9 = CE.weaponMatches;
  CE.weaponMatches = function (it, type) {
    const r = own9.apply(CE, arguments);
    if (r && CE._atk && curOpts && curOpts.kind === 'attack' && curOpts.monster === CE._atk.uid) return CE._atk.items.includes(it.id);
    return r;
  };

  // ==========================================================
  //  10. 謎題步數上限（官方規則）
  //      本次步數最多 = 解謎者的對應技能；每花 1 線索多 1 步
  // ==========================================================
  const wrapPuzzle = name => {
    const orig = Puzzles[name];
    Puzzles[name] = function (a, f) {
      const p = orig.apply(Puzzles, arguments);
      try {
        let idx = CE.actorNow ? CE.actorNow() : null;
        if (idx == null) idx = CE.defaultInv();
        const iv = G.inv[idx], sk = SKILLS[(a && a.AbilityType) || 0];
        if (iv && sk && OFF.layer) {
          let limit = iv.skills[sk.k] || 0, used = 0;
          const view = OFF.layer.querySelector('#pzv'), mv = OFF.layer.querySelector('#mv');
          const bar = document.createElement('div'); bar.className = 'pzLimit';
          view.appendChild(bar);
          const draw = () => {
            used = +(mv.textContent || 0);
            const left = Math.max(0, limit - used), lock = left <= 0;
            view.classList.toggle('pzLocked', lock);
            const canClue = iv.clues > 0 && !CE.noClue(iv, idx);
            bar.innerHTML = `<img src="${iv.img}"><span>${esc(iv.name)}　${sk.zh} ${iv.skills[sk.k]}${limit > iv.skills[sk.k] ? ` ＋線索 ${limit - iv.skills[sk.k]}` : ''}：這次可以走 <b>${limit}</b> 步，還剩 <b class="${lock ? 'zero' : ''}">${left}</b> 步</span>` +
              (lock ? `<button class="btn primary" id="pzClue" ${canClue ? '' : 'disabled'}>花 1 線索多走 1 步（剩 ${iv.clues}）</button>` : '');
            const b = bar.querySelector('#pzClue');
            if (b) b.onclick = e => { e.stopPropagation(); if (iv.clues <= 0) return; iv.clues--; limit++; Engine.log(`${iv.name} 花 1 線索，謎題多走 1 步`); UI.render(); draw(); };
          };
          const guard = e => { if (view.classList.contains('pzLocked') && e.target.closest('#tiles, #pcs, #pieces, #socks, #pzGuess')) { e.stopPropagation(); e.preventDefault(); UI.toast('步數用完了，可以花線索多走，或按「關閉」'); } };
          ['click', 'pointerdown'].forEach(t => view.addEventListener(t, guard, true));
          new MutationObserver(draw).observe(mv, { childList: true, characterData: true, subtree: true });
          draw();
        }
      } catch (e) { console.error(e); }
      return p;
    };
  };
  ['slide', 'code', 'lock', 'tower'].forEach(n => Puzzles[n] && wrapPuzzle(n));

  // ==========================================================
  //  11. 怪物移動的訊息有兩個以上選項（例如「怪物進行攻擊／該格沒有調查員」）
  //      先把選項藏起來，按「先移動怪物」→ 移好按「移動完成」→ 再選
  // ==========================================================
  const msg11 = UI.message;
  UI.message = function (o) {
    const p = msg11.apply(UI, arguments);
    try {
      const text = o && o.text || '';
      const m = o && (o.monster || (o.fsm && o.fsm.monster));
      if (m && G.monsters.includes(m) && o.buttons && o.buttons.length > 1 && MOVE_RE.test(text) && OFF.layer) {
        const L = OFF.layer, pop = L.querySelector('#popup');
        const grp = pop.querySelector('.twobtn, .col');
        if (grp) {
          grp.style.visibility = 'hidden';
          const t = document.createElement('div'); t.className = 'tap confbtn'; t.textContent = '先移動怪物';
          t.style.top = grp.style.top; pop.appendChild(t);
          t.onclick = async e => {
            e.stopPropagation();
            L.classList.add('hidden');
            const mm = text.match(/[^。]*移動[^。]*。?/), sent = mm ? mm[0] : '';
            await CE.waitMonsterMove(m, (sent.includes(T(m.name)) ? sent : `${T(m.name)}：${sent}`) + '　移好後按右邊按鈕');
            L.classList.remove('hidden'); t.remove(); grp.style.visibility = '';
            // 告訴玩家怪物那一格有沒有調查員
            try {
              const c = MAP.posCell(m);
              const here = c ? CE.alive().filter(i => { const ci = MAP.posCell(G.inv[i]); return ci && ci.id === c.id; }) : [];
              const near = c ? CE.alive().filter(i => { const ci = MAP.posCell(G.inv[i]); return ci && ci.id !== c.id && MAP.adjacentOrSame(c, ci); }) : [];
              const info = document.createElement('div'); info.className = 'whoInBox';
              info.innerHTML = here.length ? `和${esc(T(m.name))}同一格：${here.map(i => `<span><img src="${G.inv[i].img}">${esc(G.inv[i].name)}</span>`).join('')}` : `${esc(T(m.name))}那一格沒有調查員${near.length ? `（相鄰格：${near.map(i => esc(G.inv[i].name)).join('、')}）` : ''}`;
              const bg = pop.querySelector('.bg'); info.style.top = (parseFloat(bg.style.top) - 40 * OFF.u) + 'px';
              pop.appendChild(info);
            } catch (er) { }
          };
        }
      }
    } catch (e) { console.error(e); }
    return p;
  };

  // ==========================================================
  //  12. 標記的距離（官方規則）
  //      搜索／互動：要和標記在同一格；探索：同一格，或在那扇門旁邊的格子
  // ==========================================================
  CE.nodeTooFar = function (idx, id) {
    try {
      const n = G.nodes[id], iv = G.inv[idx]; if (!n || !iv) return null;
      const ic = MAP.posCell(iv); if (!ic) return null;
      const g = MAP.build();
      // 標記所在的格子：搜索／互動＝標記那一格；探索（放在門上）＝門兩邊的格子
      const explore = /^EXPLORE/.test(nodeTag(id));
      const d = explore ? 0.25 : 0.06, ids = new Set();
      for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) { const c = MAP.cellAt(n.x + dx, n.y + dy); if (c) ids.add(c.id); }
      const near = g.cells.filter(c => ids.has(c.id));
      if (!near.length) return null;
      if (near.some(c => c.id === ic.id)) return null;
      const kind = explore ? '探索' : /^PERSON/.test(nodeTag(id)) ? '和人物互動' : /^(SEARCH|SERACH)/.test(nodeTag(id)) ? '搜索' : '互動';
      return `${iv.name} 離這個標記太遠。\n規則：${kind}${explore ? '要站在標記那一格，或那扇門旁邊的格子' : '要和標記站在同一格'}。`;
    } catch (e) { return null; }
  };

  // ==========================================================
  //  13. 有「行動」圖示的選項：選了就花 1 個行動（官方規則）
  //      這次互動一開始已經扣過的那 1 個，抵第一個有圖示的選項
  // ==========================================================
  const ACT = '';
  const actsLeft = i => { const iv = G.inv[i]; CE.ensure(iv); return CE.maxActs(iv) - (iv.turn.acts || 0); };
  const msg13 = UI.message;
  UI.message = function (o) {
    const p = msg13.apply(UI, arguments);
    const btns = o && o.buttons || [];
    if (!btns.some(b => (b.label || '').includes(ACT)) || G.phase !== 'investigator') return p;
    try {
      // 沒有行動點時，不能選有圖示的選項
      const L = OFF.layer;
      L && L.querySelectorAll('[data-i]').forEach(el => {
        const b = btns[+el.dataset.i]; if (!b || !(b.label || '').includes(ACT)) return;
        el.addEventListener('click', e => {
          const ia = CE._ia, idx = ia ? ia.idx : CE.actorNow();
          if (idx == null || (ia && ia.covered)) return;
          if (actsLeft(idx) <= 0) { e.stopImmediatePropagation(); e.preventDefault(); UI.toast(`${G.inv[idx].name} 這回合已經沒有行動了，不能選這個選項`); }
        }, true);
      });
    } catch (e) { console.error(e); }
    return p.then(ev => {
      const b = btns.find(x => x.ev === ev);
      if (b && (b.label || '').includes(ACT)) {
        const ia = CE._ia, idx = ia ? ia.idx : CE.actorNow();
        if (ia && ia.covered) ia.covered = false;
        else if (idx != null && G.inv[idx]) { CE.spendRaw(idx, 'other'); Engine.log(`${G.inv[idx].name} 選了「${plain(b.label).replace(/〔行動〕/g, '').trim()}」，花 1 個行動`); UI.toast(`${G.inv[idx].name} 花了 1 個行動`); UI.render(); }
      }
      return ev;
    });
  };

  // ==========================================================
  //  14. 「受到…（消除）。然後將 N 張卡翻面」：擲骰消除完，再自動翻面
  // ==========================================================
  const say14 = Engine.say;
  Engine.say = async function (o) {
    const text = o && o.text || '';
    let flips = [];
    try {
      if (text && CE.parseNegate(text)) {
        const i = text.search(/消除\s*[）)]/);
        if (i >= 0) flips = CE.parseHits(text.slice(i)).filter(h => h.flip === 'up');
      }
    } catch (e) { }
    if (flips.length) CE._lastRoll = null;
    const r = await say14.apply(Engine, arguments);
    if (flips.length) {
      try {
        const t = plain(text), named = CE.alive().filter(k => t.includes(G.inv[k].name));
        const who = CE._lastRoll ? CE._lastRoll.inv : named.length === 1 ? named[0] : CE.actorNow();
        if (who != null && G.inv[who]) { await CE.applyHits(G.inv[who], flips.map(h => Object.assign({}, h))); UI.render(); }
      } catch (e) { console.error(e); }
    }
    return r;
  };

  // ==========================================================
  //  15. 屏障（路障）：留在地圖上、可以拖曳並吸附、照規則擋路
  //      ・屏障放在某一格：頂住這格的一扇門（擋路），或推開（不擋）
  //      ・調查員階段要先按「其他行動 → 移動屏障」才能拖，只能在同一格裡移動
  //      ・門上有探索標記也不能通過
  //      ・怪物要穿過被頂住的門：擲蠻力，2 個以上成功摧毀屏障，否則這次不能移動
  // ==========================================================
  const BAR = t => t && t.kind === 'barricade';
  const cellOfXY = (x, y) => MAP.cellAt(x, y);
  CE.barDoors = function (c) {
    if (!c) return [];
    const g = MAP.build();
    return (g.adj[c.id] || []).filter(e => e.type === 'door' || e.type === 'secret').map(e => { const b = g.cells[e.to]; return { type: e.type, mx: e.mx != null ? e.mx : (c.x + b.x) / 2, my: e.my != null ? e.my : (c.y + b.y) / 2, tx: b.x, ty: b.y }; });
  };
  CE.barPlace = function (tk, c, door) {
    tk.cx = c.x; tk.cy = c.y;
    if (door) { tk.block = { mx: door.mx, my: door.my, type: door.type, tx: door.tx, ty: door.ty }; tk.x = c.x + (door.mx - c.x) * 0.72; tk.y = c.y + (door.my - c.y) * 0.72; }
    else { tk.block = null; tk.x = c.x - 0.28; tk.y = c.y - 0.28; }
  };
  // 依放下的位置吸附；otherCell=false 時不能換格
  CE.barSnap = function (tk, px, py, otherCell) {
    const home = tk.cx != null ? cellOfXY(tk.cx, tk.cy) : null;
    let c = otherCell ? cellOfXY(px, py) : home;
    if (!c) c = home || cellOfXY(px, py);
    if (!c) return false;
    if (!otherCell && home) { const pc = cellOfXY(px, py); if (pc && pc.id !== home.id && Math.max(Math.abs(px - home.x), Math.abs(py - home.y)) > 0.62) return false; }
    const opts = [{ x: c.x, y: c.y, door: null }, ...CE.barDoors(c).map(d => ({ x: c.x + (d.mx - c.x) * 0.72, y: c.y + (d.my - c.y) * 0.72, door: d }))];
    const best = opts.sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
    CE.barPlace(tk, c, best.door);
    return true;
  };
  // 以前放上去、還沒有「頂住哪扇門」資料的屏障：依位置判斷
  const normBar = tk => {
    if (tk.cx != null) return;
    const g = MAP.build(); let best = null, bd = 0.45;
    for (const c of g.cells) for (const d of CE.barDoors(c)) { const dd = Math.hypot(d.mx - tk.x, d.my - tk.y); if (dd < bd) { bd = dd; best = { c, d }; } }
    if (best) {
      // 屏障在門的哪一邊：離哪個格子比較近
      const other = cellOfXY(best.d.tx, best.d.ty), c = Math.hypot(best.c.x - tk.x, best.c.y - tk.y) <= Math.hypot(other.x - tk.x, other.y - tk.y) ? best.c : other;
      const door = CE.barDoors(c).find(d => Math.hypot(d.mx - best.d.mx, d.my - best.d.my) < 0.05);
      CE.barPlace(tk, c, door || null);
    } else { const c = cellOfXY(tk.x, tk.y); if (c) CE.barPlace(tk, c, null); }
  };
  // 移動判定：屏障擋門、探索標記擋門
  MAP.moveAdj = function (id) {
    const g = MAP.build(), a = g.cells[id];
    G.tokens.filter(BAR).forEach(normBar);
    const bars = G.tokens.filter(t => BAR(t) && t.block);
    const explores = Object.values(G.nodes).filter(n => n.visible && /Feature_Explore/.test(n.sprite || ''));
    return g.adj[id].filter(e => {
      if (!['open', 'door', 'secret'].includes(e.type)) return false;
      if (e.type === 'open') return true;
      const b = g.cells[e.to], mx = e.mx != null ? e.mx : (a.x + b.x) / 2, my = e.my != null ? e.my : (a.y + b.y) / 2;
      if (bars.some(t => Math.hypot(t.block.mx - mx, t.block.my - my) < 0.2)) return false;
      if (e.type === 'door' && explores.some(n => Math.hypot(n.x - mx, n.y - my) < 0.3)) return false;
      return true;
    }).map(e => e.to);
  };
  // 劇本說「在所示位置放置屏障」：自動放一個，留在地圖上
  const barNodeId = o => { try { const id = o && o.source ? goName(o.source) : null; return id && /^BARRICADE/.test(id) ? id : null; } catch (e) { return null; } };
  CE.barFromNode = function (id) {
    const n = G.nodes[id]; if (!n || G.tokens.some(t => t.node === id)) return;
    const tk = { id: Date.now() + Math.random(), kind: 'barricade', x: n.x, y: n.y, node: id };
    normBar(tk);
    if (!tk.block && tk.cx != null) { tk.x = Math.max(tk.cx - 0.35, Math.min(tk.cx + 0.35, n.x)); tk.y = Math.max(tk.cy - 0.35, Math.min(tk.cy + 0.35, n.y)); }
    G.tokens.push(tk); n.visible = false;
    Engine.log('地圖上放了一個屏障');
    UI.render();
  };
  const say15 = Engine.say;
  Engine.say = function (o) { const id = barNodeId(o); if (id) { CE.barFromNode(id); const tk = G.tokens.find(t => t.node === id); if (tk && o.fsm && o.fsm.def && !tk.by) tk.by = o.fsm.def.object; } return say15.apply(Engine, arguments); };
  const rev15 = Actions.RevealNode;
  Actions.RevealNode = function (a, f) { const r = rev15.apply(Actions, arguments); try { const id = goName(a.Node); if (/^BARRICADE/.test(id)) { CE.barFromNode(id); const tk = G.tokens.find(t => t.node === id); if (tk && f && f.def) tk.by = f.def.object; } } catch (e) { } return r; };
  const hide15 = Actions.HideNode;
  Actions.HideNode = function (a, f) {
    const r = hide15.apply(Actions, arguments);
    try {
      const id = goName(a.Node);
      // 同一段劇情「顯示屏障位置 → 再藏起來」：官方只是收掉提示，實體屏障還在，所以不要拿掉
      if (/^BARRICADE/.test(id)) { const by = f && f.def && f.def.object; G.tokens = G.tokens.filter(t => t.node !== id || (by && t.by === by)); UI.render(); }
    } catch (e) { } return r;
  };

  // 拖曳：鎖定＋吸附
  CE.barMove = null;
  const drag15 = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    drag15.call(UI, el, getObj, onClick);
    if (el.dataset && el.dataset.token != null) {
      const down = el.onpointerdown;
      el.onpointerdown = e => {
        const tk = getObj();
        if (!BAR(tk) || e.button !== 0) return down(e);
        normBar(tk);
        const setup = G.phase === 'setup';
        const mine = CE.barMove && CE.barMove.tok === tk.id;
        // 從「標記」手動放的屏障：可以自由拖到任何位置，放下後自動吸附到最近的門
        if (!tk.node && !tk.item) {
          down(e);
          const up0 = el.onpointerup;
          el.onpointerup = ev => {
            up0 && up0(ev);
            const px = tk.x, py = tk.y; delete tk.cx; delete tk.cy; tk.block = null; if (!CE.barSnap(tk, px, py, true)) normBar(tk);
            UI.toast(tk.block ? '屏障頂住了這扇門（怪物要穿過時會自動擲蠻力）' : '屏障放在格子中間（拖到門邊才會頂住門）');
            UI.render();
          };
          return;
        }
        if (!setup && !mine) { e.stopPropagation(); UI.toast('要移動屏障：先站到屏障那一格，按「其他行動」→「移動屏障」'); return; }
        down(e);
        const up = el.onpointerup;
        el.onpointerup = ev => {
          up && up(ev);
          const px = tk.x, py = tk.y;
          if (!CE.barSnap(tk, px, py, setup)) { CE.barPlace(tk, cellOfXY(tk.cx, tk.cy), tk.block ? CE.barDoors(cellOfXY(tk.cx, tk.cy)).find(d => Math.hypot(d.mx - tk.block.mx, d.my - tk.block.my) < 0.05) : null); UI.toast('屏障只能在同一格裡移動：頂住這格的一扇門，或拖到格子中間推開'); }
          else UI.toast(tk.block ? '屏障頂住了這扇門（不能通過）' : '屏障推開了，門可以通過');
          UI.render();
        };
      };
    }
    if (el.dataset && el.dataset.mon != null) {
      const down = el.onpointerdown;
      el.onpointerdown = e => {
        const m = getObj(); if (!m || e.button !== 0) return down(e);
        const sx = m.x, sy = m.y;
        down(e);
        const up = el.onpointerup;
        el.onpointerup = async ev => {
          up && up(ev);
          if (Math.hypot(m.x - sx, m.y - sy) < 0.05) return;
          await CE.monCross(m, sx, sy);
        };
      };
    }
  };
  // 怪物穿過被頂住的門：擲蠻力
  CE.monCross = async function (m, sx, sy) {
    const g = MAP.build(), a = cellOfXY(sx, sy), b = cellOfXY(m.x, m.y);
    if (!a || !b || a.id === b.id) return;
    const bfs = (adjFn) => { const seen = { [a.id]: null }, q = [a.id]; while (q.length) { const c = q.shift(); if (c === b.id) break; for (const n of adjFn(c)) if (!(n in seen)) { seen[n] = c; q.push(n); } } return b.id in seen ? seen : null; };
    if (bfs(id => MAP.moveAdj(id))) return;                       // 有不經過屏障的路
    const all = bfs(id => g.adj[id].filter(e => ['open', 'door', 'secret'].includes(e.type)).map(e => e.to));
    if (!all) return;
    // 找出路上被頂住的門
    let blocker = null;
    for (let c = b.id; all[c] != null && !blocker; c = all[c]) {
      const p = g.cells[all[c]], q = g.cells[c], mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      blocker = G.tokens.find(t => BAR(t) && t.block && Math.hypot(t.block.mx - mx, t.block.my - my) < 0.2);
    }
    if (!blocker) return;
    const st = CE.monStat(m), n = st.brawn || 0;
    const dice = Array.from({ length: n }, () => UI.rollDie()), s = dice.filter(d => d === 'S').length, ok = s >= 2;
    Engine.log(`${T(m.name)} 要穿過被屏障頂住的門：蠻力 ${n}，成功 ${s}`);
    await CE.alert(`${T(m.name)} 撞向屏障`, `這扇門被屏障頂住了。${T(m.name)} 擲蠻力 ${n} 顆骰 → 成功 ${s} 個。\n${ok ? '[b]成功！[/b]屏障被摧毀（移出地圖），怪物照常移動。' : '[b]失敗[/b]，怪物這次不能移動，已放回原位。'}`);
    if (ok) G.tokens.splice(G.tokens.indexOf(blocker), 1);
    else { m.x = sx; m.y = sy; }
    UI.render();
  };
  // 「其他行動 → 移動屏障」
  CE.actBarricade = async function (idx) {
    const iv = G.inv[idx], c = MAP.posCell(iv);
    G.tokens.filter(BAR).forEach(normBar);
    const here = c && G.tokens.find(t => BAR(t) && t.cx != null && Math.hypot(t.cx - c.x, t.cy - c.y) < 0.1);
    const across = c && G.tokens.find(t => BAR(t) && t.block && Math.hypot(t.block.tx - c.x, t.block.ty - c.y) < 0.1);
    if (!here && !across) { await CE.alert('移動屏障', `${iv.name} 這一格沒有屏障，旁邊被頂住的門另一側也沒有屏障。`); return; }
    if (here) {
      await CE.doAction(idx, 'other', () => new Promise(res => {
        CE.barMove = { idx, tok: here.id };
        const old = document.getElementById('monMoveBar'); if (old) old.remove();
        const bar = document.createElement('div'); bar.id = 'monMoveBar';
        bar.innerHTML = `<div class="mmTxt"><img src="img/features/Feature_BarricadeInterior.png" style="border-radius:0"><span>拖曳屏障：拖到門上＝頂住那扇門；拖到格子中間＝推開</span></div><button class="btn primary big" id="mmDone">完成</button>`;
        document.body.appendChild(bar);
        bar.querySelector('#mmDone').onclick = () => { bar.remove(); CE.barMove = null; UI.render(); res(); };
        UI.render();
      }));
      return;
    }
    await CE.doAction(idx, 'other', async () => {
      CE._lastRoll = null;
      const n = await UI.diceDialog({ inv: idx, skill: 'str', need: 2, text: `${iv.name} 從門的另一側推開屏障（；2）`, useResult: true, noOutcome: true });
      if (n >= 2) {
        const hc = cellOfXY(across.cx, across.cy); CE.barPlace(across, hc, null);
        CE.ensure(iv); iv.turn.move = { left: 1, steps: 0, evaded: c.id, free: true, tiles: [], door: null };
        await CE.alert('成功', `屏障被推開了。${iv.name} 可以穿過這扇門移動 1 格（不另外扣行動），請拖曳人偶。`);
      } else await CE.alert('失敗', '屏障沒有被推開。');
      UI.render();
    });
  };
  // 2x4（木板）或手動放的屏障：放上去時吸附到最近的門
  const place15 = CE.placeToken;
  CE.placeToken = function (kind, idx) {
    const r = place15.apply(CE, arguments);
    if (kind === 'barricade') { const tk = G.tokens[G.tokens.length - 1], c = MAP.posCell(G.inv[idx]); if (tk && c) { const d = CE.barDoors(c)[0]; CE.barPlace(tk, c, d || null); UI.toast(d ? '屏障已頂住你這格的一扇門。要換門：其他行動 → 移動屏障' : '屏障已放在你這格'); UI.render(); } }
    return r;
  };
  // 屏障畫面：頂住門時轉向門、加紅框
  const rb15 = UI.renderBoard;
  UI.renderBoard = function () {
    const r = rb15.apply(UI, arguments);
    try {
      document.querySelectorAll('#world .token[data-token]').forEach(el => {
        const tk = G.tokens.find(t => t.id == el.dataset.token); if (!BAR(tk)) return;
        el.classList.toggle('barBlock', !!tk.block);
        el.classList.toggle('barMovable', G.phase === 'setup' || !!(CE.barMove && CE.barMove.tok === tk.id));
        el.title = tk.block ? '屏障：頂住這扇門（調查員和怪物都不能通過）' : '屏障：已推開，不擋門';
      });
    } catch (e) { }
    return r;
  };
})();

