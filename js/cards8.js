// ============================================================
//  第 8 批：多個劇本（詭鎮街道：星辰鍊金、黑道風雲、厄命展覽）
//  劇本選擇、序幕／結局、新的狀態機動作
// ============================================================
(function () {
  // ==========================================================
  //  1. 劇本清單
  // ==========================================================
  const COE = DB.scenario;
  DB.scenarios = DB.scenarios || {};
  DB.scenarios.CoE = Object.assign({}, COE, {
    id: 'CoE', name: 'SCENARIO_CYCLE_OF_ETERNITY_MAD20', desc: 'SCENARIO_CYCLE_OF_ETERNITY_DESCRIPTION', image: 'Scenario_CoE', prologue: 2,
    difficulty: 2, min: 60, max: 90, initialItemsToSpawn: [], variants: ['01A', '01B', '02A', '02B'].map(id => ({ id, req: [] }))
  });
  // 開鎖清單在 data/unlock.js（劇本組做完一個劇本就在那裡開鎖，不用改這裡）
  const UL = () => (typeof UNLOCK !== 'undefined' && UNLOCK) || {};
  const ORDER0 = ['CoE', 'EFI', 'RT', 'SB', 'WLW', 'DD', 'CoSH', 'AA', 'IFE', 'GoA'];
  // 劇本顯示順序：原本的 10 個，後面接 unlock.js 裡開鎖的新劇本；寫 false 的劇本不顯示
  const orderNow = () => { const sc = UL().scenarios || {}; return [...ORDER0, ...Object.keys(sc).filter(k => !ORDER0.includes(k) && sc[k])].filter(id => sc[id] !== false); };
  // 地圖版本能不能玩：劇本資料有載入，而且 unlock.js 沒有寫 false
  const varOpen = v => !!(typeof SCENARIOS !== 'undefined' && SCENARIOS[v.id]) && (UL().variants || {})[v.id] !== false;
  Engine.scenOf = v => (/ /.test(v || '') ? v.split(' ')[0] : 'CoE');
  Object.assign(CUTSCENES, {
    39: 'AA_PROLOGUE', 40: 'AA_BADENDING', 41: 'AA_NORMALENDING', 42: 'AA_GOODENDING', 43: 'AA_SECRETENDING',
    44: 'AN_PROLOGUE', 45: 'AN_GANGLOSS', 46: 'AN_GANGWIN', 47: 'AN_MONSTERLOSS', 48: 'AN_MONSTERWIN',
    49: 'IFE_PROLOGUE', 50: 'IFE_BADENDING', 51: 'IFE_NORMALENDING', 52: 'IFE_GOODENDING'
  });
  if (typeof CUTSCENES_EXTRA !== 'undefined') Object.assign(CUTSCENES, CUTSCENES_EXTRA);   // 二版基礎劇本（data/mad20.js）
  // 詭鎮街道的 4 位調查員（勾選擁有這盒時才會出現）
  if (typeof CARDS !== 'undefined' && CARDS.ownedInvestigators) for (const id of (() => { const u = (typeof UNLOCK !== 'undefined' && UNLOCK.products) || null; return u ? Object.keys(u).filter(k => u[k] && k !== 'MAD20') : ['MAD25', 'MAD21', 'MAD22']; })().flatMap(p => (DB.products[p] || {}).investigators || [])) if (!CARDS.ownedInvestigators.includes(id)) CARDS.ownedInvestigators.push(id);

  // 存檔裡的資料（跟著存檔一起保存）
  const bag = k => (G.vars['__' + k] = G.vars['__' + k] || {});

  const ng = Engine.newGame;
  Engine.newGame = function (opts) {
    const id = Engine.scenOf(opts.variant);
    DB.scenario = DB.scenarios[id] || DB.scenarios.CoE;
    G.scenId = id;
    return ng.apply(this, arguments);
  };

  // 開始：序幕 → 起始物品 → 劇本開始
  Engine.begin = async function () {
    UI.render();
    const sc = DB.scenario;
    await UI.cutscene(CUTSCENES[sc.prologue] || 'COE_PROLOGUE', T(sc.name));
    const start = [];
    for (const f of sc.initialItemsRandom || []) {
      const it = Engine.randomItem(f.Filter, f.IncludeTraits, f.ExcludeTraits);
      if (it) { Engine.addItem(it); start.push(it); }
    }
    for (const id of sc.initialItemsToSpawn || []) {
      const d = DB.items[id];
      if (d && !G.items.some(i => i.id === id)) { Engine.addItem(d); start.push(d); }
    }
    if (start.length) await Engine.say({ title: '起始物品', text: '調查員們共同擁有以下起始物品，請自行分配：', items: start });
    // 調查員能力：遊戲開始時獲得的物品
    const special = { INVESTIGATOR_TOMMY_MULDOON: 'UNIQUE_ITEM_BECKY', INVESTIGATOR_KATE_WINTHROP: 'UNIQUE_ITEM_FLUX_STABILIZER', INVESTIGATOR_ASHCAN_PETE: 'UNIQUE_ITEM_DUKE_THE_DOG' };
    for (let i = 0; i < G.inv.length; i++) {
      const id = special[G.inv[i].id], d = id && DB.items[id];
      if (d && !G.items.some(x => x.id === id)) {
        const it = Engine.addItem(d); it.owner = i;
        await Engine.say({ title: G.inv[i].name, text: `遊戲開始時，${G.inv[i].name} 獲得特殊道具【${T(d.name)}】。`, items: [it] });
      }
    }
    // 劇本起始線索：平均分給所有調查員，除不盡的給前面的人
    const sClues = sc.startingClues | 0;
    if (sClues > 0 && G.inv.length) {
      const n = G.inv.length, lines = [];
      G.inv.forEach((iv, i) => {
        const g = Math.floor(sClues / n) + (i < sClues % n ? 1 : 0);
        if (g > 0) { iv.clues = (iv.clues || 0) + g; lines.push(`${iv.name}：獲得 ${g} 個線索`); }
      });
      UI.render();
      await Engine.say({ title: '起始線索', text: `本劇本開始時共獲得 ${sClues} 個線索，已平均分配：\n` + lines.join('\n') });
    }
    Engine.broadcast('BEGIN SCENARIO');
  };

  // 內建變數
  const gv = getVar;
  window.getVar = function (name, fsm) {
    if (name === 'TotalThreat') return G.threat;
    if (name === 'UnspentThreat') return G.unspent;
    return gv(name, fsm);
  };
  // 劇情改威脅值（例如暮光權冠遊行結束時把威脅歸零、給舞會重新計時）：要改到真正的威脅計數，
  // 不然讀的時候還是舊的值（原本寫到另一個變數，歸零沒效果，舞會一開始就結束）
  const sv0 = setVar;
  window.setVar = function (name, v, fsm) {
    if (name === 'TotalThreat' && !(fsm && fsm.vars && name in fsm.vars)) { G.threat = Math.max(0, +v || 0); Engine.checkWatchers(); UI.render && UI.render(); return; }
    if (name === 'UnspentThreat' && !(fsm && fsm.vars && name in fsm.vars)) { G.unspent = Math.max(0, +v || 0); Engine.checkWatchers(); UI.render && UI.render(); return; }
    return sv0(name, v, fsm);
  };

  // ==========================================================
  //  2. 新的狀態機動作
  // ==========================================================
  const fsmOfGo = x => { const n = goName(x); return n ? G.fsmByObj[n] : null; };
  const monOfNode = x => { const n = goName(x); return n ? G.monsters.find(m => m.node === n) : null; };
  const sendTo = (t, ev, f) => {
    t = t || {};
    if (t.target === 4) { setTimeout(() => Engine.broadcast(ev), 0); return; }
    const tg = t.go ? fsmOfGo(t.go) : f;
    if (tg) setTimeout(() => tg.fire(ev), 0);
  };
  Object.assign(Actions, {
    SetBoolValue(a, f) { const n = varName(a.boolVariable); if (n) setVar(n, !!a.boolValue, f); },
    SetIntValue(a, f) { const n = varName(a.intVariable); if (n) setVar(n, val(a.intValue, f), f); },
    BoolTest(a, f) { const v = !!getVar(varName(a.boolVariable), f); const ev = v ? a.isTrue : a.isFalse; return ev ? { event: ev } : null; },
    BoolAnyTrue(a, f) {
      const r = (a.boolVariables || []).some(x => x && !!getVar(varName(x), f));
      const s = varName(a.storeResult); if (s) setVar(s, r, f);
      return r && a.sendEvent ? { event: a.sendEvent } : null;
    },
    BoolAllTrue(a, f) {
      const r = (a.boolVariables || []).filter(Boolean).every(x => !!getVar(varName(x), f));
      const s = varName(a.storeResult); if (s) setVar(s, r, f);
      return r && a.sendEvent ? { event: a.sendEvent } : null;
    },
    // 把一段文字的代碼存起來，之後插進訊息裡（存翻譯好的文字）
    StoreKey(a, f) { const n = varName(a.StoreResult); const k = a.Key && (a.Key.Key || a.Key); if (n && k) setVar(n, T(k), f); },
    // 這個標記是否曾經出現過（CheckCurrentVisibility：還要現在看得到）
    IsNodeRevealed(a, f) {
      const id = goName(a.Node), n = G.nodes[id];
      const ever = n && (n.visible || bag('rev')[id]);
      // 怪物圖案的標記放出來後會變成真的怪物（標記本身收起來）：怪物還活著就算「現在看得到」，不然劇情會以為沒放過、再放一次
      const alive = !!(G.monsters || []).some(m => m.node === id);
      const ok = (ever || alive) && (!a.CheckCurrentVisibility || n.visible || alive);
      return { event: ok ? a.TrueEvent : a.FalseEvent };
    },
    RestartFSM(a, f) {
      const tg = fsmOfGo(a.FsmToRestart); if (!tg) return;
      if (!tg.state || tg.finished) { tg.finished = false; setTimeout(() => tg.start(), 0); }
      else setTimeout(() => tg.fire('START'), 0);
    },
    ExecuteEvent(a, f) { sendTo(a.Target, a.EventName, f); },
    // 讀另一個狀態機的變數：官方資料只剩「讀取」，把同一個狀態裡接著會用到的變數抄過來
    GetFsmVariable(a, f) {
      const tg = fsmOfGo(a.gameObject); if (!tg) return;
      const st = f.states[f.state]; const names = new Set();
      JSON.stringify(st ? st.actions : [], (k, v) => { if (k === 'var' && typeof v === 'string' && v) names.add(v); return v; });
      for (const n of names) if (tg.vars && n in tg.vars) f.vars[n] = tg.vars[n];
    },
    AddStoryEvent(a) { const tg = fsmOfGo(a.StoryEventObject); if (tg && !G.mythosQueue.includes(tg)) G.mythosQueue.push(tg); },
    // 房間標記（官方用來記錄「這一輪誰在哪個房間有動靜」）
    SetRoomFlare(a) {
      const r = a.Room && a.Room.ref; if (!r) return;
      const fl = bag('flare'); const o = fl[r] = fl[r] || {};
      o.v = !!a.Value; if (a.SetCurrentFlareAlso) o.cur = !!a.Value;
    },
    GetRoomFlare(a) {
      const o = bag('flare')[a.Room && a.Room.ref] || {};
      return { event: (a.CurrentRound ? o.cur : o.v) ? a.trueEvent : a.falseEvent };
    },
    ResetRoomFlares(a) { const fl = bag('flare'); for (const k in fl) { if (a.CurrentTurnOnly) fl[k].cur = false; else delete fl[k]; } },
    HighlightNodes(a) {
      const ids = (a.Nodes || []).map(goName).filter(Boolean);
      ids.forEach(id => { const n = G.nodes[id]; if (n) { n.visible = true; n.hl = Date.now(); } });
      UI.render(); if (ids.length) UI.focusNodes(ids);
    },
    AssignMonsterID(a) { const m = a.UseMostRecent ? G.mostRecentMonster : monOfNode(a.MonsterNode); if (m) m.mid = a.MonsterID || 0; },
    AddActivationDelay(a, f) { const m = a.UseMostRecent ? G.mostRecentMonster : monOfNode(a.MonsterNode); if (m) { m.cooldown = (m.cooldown || 0) + (val(a.Delay, f) || 1); UI.render(); } },
    async DefeatAllMonsters() {
      if (!G.monsters.length) return;
      const names = G.monsters.map(m => T(m.name));
      G.monsters.splice(0); UI.selectMonster(null); UI.render();
      Engine.log('移除所有怪物：' + names.join('、'));
    },
    RemoveItem(a) {
      const id = goName(a.Item), n = G.nodes[id];
      const it = G.items.find(i => i.node === id) || G.items.find(i => i.id === ((n && n.model && n.model.ref) || id));
      if (!it) return;
      G.items.splice(G.items.indexOf(it), 1);
      Engine.log(`【${T(it.name)}】從遊戲中移除`); UI.render();
    },
    // 載入某個地區（浪潮洶湧）：板塊之後由劇情一塊一塊揭示，這裡不用做事
    RevealMap() { },
    // 整張地圖收起來（換場景）
    HideMap(a) {
      const mp = goName(a.MapGameObject); if (!mp) return;
      for (const t of Object.values(G.tiles)) if (t.map === mp) t.revealed = false;
      for (const n of Object.values(G.nodes)) if (n.map === mp) n.visible = false;
      G.tokens = (G.tokens || []).filter(t => !Engine.tileAt(t.x, t.y) || Engine.tileAt(t.x, t.y).map !== mp);
      Engine.log('地圖收起來，換到下一個場景'); MAP._sig = null; UI.render();
    },
    // 怪物選單：選中某隻怪物（之後的訊息就是關於這隻）
    SelectMenuItem(a, f) {
      const m = a.MenuItem ? monOfNode(a.MenuItem) : null;
      if (m) { f.monster = m; G.mostRecentMonster = m; UI.selectMonster(m.uid); } else { if (!a.MenuItem) f.monster = null; UI.selectMonster(null); }
    },
    SetMostRecentMonster(a, f) { const m = monOfNode(a.MenuItem || a.MonsterNode); if (m) G.mostRecentMonster = m; },
    SetMenuVisibility(a) { if (!a.IsVisible) UI.selectMonster(null); },
    LockMenu() { },
    SetMonsterHP(a, f) {
      const node = goName(a.MonsterNode), hp = val(a.HitPoints, f);
      const m = a.UseMostRecent ? G.mostRecentMonster : monOfNode(a.MonsterNode);
      if (m) { m.hp = hp; UI.render(); } else if (node) bag('hp')[node] = hp;
    },
    // 有旗標的多選項：旗標是 true 的選項才顯示（Variable 直接寫 true＝一定顯示，1.2.48 測試組）
    async DisplayMessageMultipleChoiceWithFlags(a, f) {
      const text = Engine.resolveMessage(a.Message, f);
      const btns = (a.Choices || []).filter(c => c && (!c.Variable || c.Variable === true || (c.Variable !== false && !!getVar(varName(c.Variable), f)))).map(c => ({ label: T(c.Localization), ev: c.Event }));
      if (a.CancelChoice && a.CancelChoice.Event) btns.push({ label: T(a.CancelChoice.Localization) || '取消', ev: a.CancelChoice.Event });
      const ev = await Engine.say({ text, source: a.MessageSource, fsm: f, buttons: btns, vertical: true });
      return { event: ev };
    }
  });

  // 怪物標記：出現在地圖上時放上怪物（官方的劇情怪物是預先準備好、隱藏著的）
  // 同一個劇情步驟裡緊接著「設定怪物生命」（例如叢林覺醒依人數設定羽蛇生命）：官方是同時生效，這裡出現時就先套用，
  // 不然訊息框顯示的是預設生命，按繼續後才變
  const preHp = (f, id) => {
    try {
      const st = f && f.state && f.states[f.state]; if (!st) return null;
      const a = (st.actions || []).find(x => x.action === 'SetMonsterHP' && (x.UseMostRecent || goName(x.MonsterNode) === id));
      if (!a) return null; const v = val(a.HitPoints, f); return v > 0 ? v : null;
    } catch (e) { return null; }
  };
  const spawnNodeMonster = function (id, f) {
    const n = G.nodes[id];
    if (!n || !n.virtual || !n.model || !/MONSTER/.test(n.model.ref || '') || G.monsters.some(m => m.node === id)) return null;
    const def = DB.monsters[n.model.ref]; if (!def) return null;
    let x = n.x, y = n.y;
    if (x == null || !Engine.tileAt(x, y)) { const i = CE.actorNow ? CE.actorNow() : 0; const iv = G.inv[i] || G.inv[0]; x = iv ? iv.x : 0; y = iv ? iv.y : 0; }
    const hp = preHp(f, id) || bag('hp')[id] || n.Toughness || def.tough;
    delete bag('hp')[id];
    const m = Engine.addMonster(def.id, { x, y, node: id, hp });
    Engine.log(`出現怪物：${T(m.name)}（生命 ${m.hp}）`);
    return m;
  };
  const dmr = Actions.DisplayMessageAndReveal;
  Actions.DisplayMessageAndReveal = async function (a, f) {
    const id = goName(a.MessageSource);
    const m = spawnNodeMonster(id, f);
    if (m) {
      bag('rev')[id] = 1;
      UI.focusPos(m.x, m.y);
      await Engine.say({ text: Engine.resolveMessage(a.Message, f), monster: m, fsm: f, spawn: true });
      return { event: 'NEXT' };
    }
    if (id) bag('rev')[id] = 1;
    return dmr.apply(this, arguments);
  };
  const rn = Actions.RevealNode;
  Actions.RevealNode = function (a, f) { const id = goName(a.Node); if (id) bag('rev')[id] = 1; if (spawnNodeMonster(id, f)) return; return rn.apply(this, arguments); };
  // 劇情怪物出現：對應到同型號的怪物標記（不限名稱開頭）
  const am = Engine.addMonster;
  Engine.addMonster = function (model, opts = {}) {
    const m = am.apply(this, arguments);
    if (!m.node) {
      const n = Object.values(G.nodes).find(n => n.virtual && n.model && n.model.ref === model && !G.monsters.some(x => x !== m && x.node === n.id));
      if (n) m.node = n.id;
    }
    return m;
  };
  // 看得到的標記都記成「出現過」
  const rnd0 = UI.render;
  UI.render = function () {
    try { if (G.nodes && G.vars) { const r = bag('rev'); for (const n of Object.values(G.nodes)) if (n.visible) r[n.id] = 1; } } catch (e) { }
    return rnd0.apply(this, arguments);
  };


  // ==========================================================
  //  4. 一塊板子有兩個以上房間的新板塊（依板塊圖判讀）
  // ==========================================================
  Object.assign(MAP.TILE_INFO, {
    TILE_MAGIC_SHOP_MAD25: { rooms: { '0.5,0': 'B' }, inner: [['-0.5,0', '0.5,0', 'door']], names: { A: '魔術商店', B: '商店辦公室' } },
    TILE_GENERAL_SHOP_MAD25: { rooms: { '0.5,0.5': 'B', '0.5,-0.5': 'B' }, inner: [['-0.5,0.5', '0.5,0.5', 'wall'], ['-0.5,-0.5', '0.5,-0.5', 'door']], names: { A: '雜貨鋪', B: '商店儲物室' } },
    TILE_STUDIO_MAD25: { rooms: { '0.5,0.5': 'B' }, inner: [['-0.5,0.5', '0.5,0.5', 'door'], ['0.5,0.5', '0.5,-0.5', 'wall']], names: { A: '工作室', B: '工作室儲物室' } },
    TILE_INTERIOR_HALL_MAD20: { rooms: { '-0.5,-0.5': 'B', '0.5,-0.5': 'C' }, inner: [['-0.5,0.5', '-0.5,-0.5', 'door'], ['0.5,0.5', '0.5,-0.5', 'door'], ['-0.5,-0.5', '0.5,-0.5', 'wall']], names: { A: '室內過道', B: '小臥室1', C: '小臥室2' } }
  });

  // ==========================================================
  //  3. 開新局：選劇本
  // ==========================================================
  const scName = id => T((DB.scenarios[id] || {}).name || '') || id;
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  UI.newGameDialog = function () {
    const sv = Engine.loadSaved();
    if (sv && !this._skipResume) {
      const names = (sv.inv || []).map(i => i.name).join('、');
      UI.openDialog(`<h3 class="dlgTitle">繼續上次的遊戲？</h3>
        <div class="msg" style="font-size:15px">${esc(scName(Engine.scenOf(sv.variant)))}（地圖 ${esc(sv.variant)}）<br>第 ${sv.round} 輪　·　${sv.phase === 'mythos' ? '神秘階段' : '調查員階段'}<br>調查員：${esc(names)}<br><span class="small">存檔時間：${new Date(sv.time).toLocaleString()}</span>${sv.vars && sv.vars.__dev ? '<br><b style="color:#ff6a6a">（這個存檔開過開發者模式）</b>' : ''}</div>
        <div class="btns"><button class="btn" id="rsNew">開新遊戲</button><button class="btn primary" id="rsGo">繼續遊戲</button></div>`);
      UI.$('#rsGo').onclick = () => { this.closeDialog(); Engine.restore(sv); };
      UI.$('#rsNew').onclick = () => { this._skipResume = true; this.newGameDialog(); };
      return;
    }
    // 已經做進 APP 的盒子；其他的上鎖，不能選
    const BUILT = (() => { const p = UL().products || {}; const on = Object.keys(p).filter(k => p[k]); return on.length ? on : ['MAD20', 'MAD21', 'MAD22', 'MAD25']; })();
    const coll = new Set(lsGet(SAVE_COLL, ['MAD20']).filter(c => BUILT.includes(c)));
    // 連線時：收藏＝主機＋每位朋友各自的收藏合起來；劇本＝大家投票，票多的贏（平手看主機投的）
    const netOn = () => typeof NET !== 'undefined' && NET.role === 'host' && NET.connected;
    const allColl = () => { const s = new Set(coll); if (netOn()) for (const p of NET.peers.values()) if (p.coll) p.coll.forEach(c => BUILT.includes(c) && s.add(c)); return s; };
    let C = allColl();
    const votes = {}, voteAt = {}; let voteSeq = 0;
    const voters = () => ['host', ...NET.peers.keys()];
    const whoName = k => k === 'host' ? '主機' : NET.nameOf(k);
    const voteWinner = () => {
      const cnt = {}; Object.values(votes).forEach(s => cnt[s] = (cnt[s] || 0) + 1);
      const ids = Object.keys(cnt); if (!ids.length) return null;
      const mx = Math.max(...ids.map(i => cnt[i])), tied = ids.filter(i => cnt[i] === mx);
      if (tied.length === 1) return tied[0];
      if (votes.host && tied.includes(votes.host)) return votes.host;
      return tied.sort((a, b) => Math.max(...Object.keys(votes).filter(k => votes[k] === b).map(k => voteAt[k])) - Math.max(...Object.keys(votes).filter(k => votes[k] === a).map(k => voteAt[k])))[0];
    };
    const chosen = [];
    let scen = lsGet('mom2_scen', 'CoE'); if (!DB.scenarios[scen]) scen = 'CoE';
    const owned = CARDS.ownedInvestigators;
    const playable = id => (DB.scenarios[id].variants || []).some(v => varOpen(v) && v.req.every(p => C.has(p)));
    const prodName = p => (T(p.name) || p.code).replace(/^.*?《(.+?)》.*$/, '$1');
    const needTxt = id => { const vs = (DB.scenarios[id].variants || []).filter(varOpen).map(v => v.req.filter(p => !C.has(p))).sort((a, b) => a.length - b.length); return (vs[0] || []).map(c => DB.products[c] ? prodName(DB.products[c]) : c).join('、'); };
    // 三個步驟：1 我的收藏 → 2 選劇本 → 3 選調查員、地圖版本、開始
    let step = 1, focus = null;
    // 連線時誰選了哪位調查員（host＝主機，其他＝朋友的連線代碼）
    const owners = {};
    const whoClicks = () => (typeof NET !== 'undefined' && NET.connected) ? (NET.fromGuest && NET.fromGuest !== true ? NET.fromGuest : 'host') : null;
    const ownerName = id => { const o = owners[id]; if (!o || typeof NET === 'undefined' || !NET.connected) return ''; return o === 'host' ? '主機' : (NET.nameOf ? NET.nameOf(o) : '朋友'); };
    const SK = [['str', '力量'], ['agi', '敏捷'], ['obs', '觀察'], ['lor', '知識'], ['inf', '影響'], ['wil', '意志']];
    let invTip = document.getElementById('invTip');
    if (!invTip) { invTip = document.createElement('div'); invTip.id = 'invTip'; invTip.className = 'invInfo'; document.body.appendChild(invTip); }
    const placeTip = e => {
      const w = invTip.offsetWidth, h = invTip.offsetHeight;
      let x = e.clientX + 16, y = e.clientY + 16;
      if (x + w > innerWidth - 8) x = e.clientX - w - 16;
      if (y + h > innerHeight - 8) y = innerHeight - h - 8;
      invTip.style.left = Math.max(8, x) + 'px'; invTip.style.top = Math.max(8, y) + 'px';
    };
    const invInfo = id => {
      const d = id && INV_DATA[id], st = d && d.stats, iv = id && DB.investigators.find(x => x.id === id);
      if (!st) return '<div class="small">滑鼠移到調查員上（或點一下），這裡會顯示他的能力和數值</div>';
      return `<img src="${d.img}"><div class="iiBody"><b>${esc(T(iv ? iv.name : id))}</b>${d.title ? `　<span class="small">${esc(d.title)}</span>` : ''}
        <div class="iiStat">❤ 生命 ${st.health}　🧠 理智 ${st.sanity}</div>
        <div class="iiSk">${SK.map(([k, n]) => `<span>${n} <b>${st.skills[k]}</b></span>`).join('')}</div>
        <div class="iiAb">${esc(st.ability || '')}</div></div>`;
    };
    UI._invInfo = invInfo;   // 連線時朋友滑鼠停在調查員上，由主機算好說明傳過去（net.js）
    const draw = (keepScroll = true) => {
      C = allColl();
      if (netOn()) {
        const ids = voters(); for (const k in votes) if (!ids.includes(k) || !playable(votes[k])) delete votes[k];
        const w = voteWinner(); if (w) scen = w;
      }
      if (!playable(scen)) scen = 'CoE';
      const sc = DB.scenarios[scen];
      const avail = DB.investigators.filter(iv => owned.includes(iv.id) && [...C].some(c => ((DB.products[c] || {}).investigators || []).includes(iv.id)));
      for (let i = chosen.length - 1; i >= 0; i--) if (!avail.some(a => a.id === chosen[i])) chosen.splice(i, 1);
      const vars = sc.variants.filter(v => varOpen(v) && v.req.every(p => C.has(p)));
      const steps = ['我的收藏', '選劇本', '選調查員'];
      const bar = `<div class="ngSteps">${steps.map((t, i) => `<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}">${i + 1}. ${t}</span>`).join('<b>›</b>')}</div>`;
      let body = '', btns = '';
      if (step === 1) {
        const hasWho = c => netOn() ? voters().filter(k => k === 'host' ? coll.has(c) : ((NET.peers.get(k) || {}).coll || new Set()).has(c)).map(whoName) : [];
        body = `<div class="lbl" style="font-size:14px">我的收藏（點盒子切換：亮的＝我有，暗的＝沒有。會影響出現的怪物、物品、調查員和可以玩的劇本）</div>${netOn() ? '<div class="small" style="color:#9cc4ff;margin:-2px 0 6px">連線中：每個人點自己有的盒子，大家的收藏會合起來算（盒子下面寫誰有）</div>' : ''}
        <div class="prodGrid">${Object.values(DB.products).map(p => BUILT.includes(p.code)
          ? `<div class="prodBox ${C.has(p.code) ? 'on' : ''} ${p.code === 'MAD20' ? 'base' : ''}" data-p="${p.code}"><img src="img/misc/Product_${p.code}.jpg" onerror="this.style.visibility='hidden'"><div class="pbName">${esc(prodName(p))}</div><div class="pbMark">${C.has(p.code) ? (netOn() ? '✔ ' + esc(hasWho(p.code).join('、')) : '✔ 擁有') : '未擁有'}</div></div>`
          : `<div class="prodBox locked" data-lock="${p.code}" title="這個擴充還沒做進 APP，暫時不能選"><img src="img/misc/Product_${p.code}.jpg" onerror="this.style.visibility='hidden'"><div class="pbLock">🔒</div><div class="pbName">${esc(prodName(p))}</div><div class="pbMark">尚未建置</div></div>`).join('')}</div>`;
        btns = `<button class="btn" id="ngPrev">‹ 上一步</button><button class="btn primary" id="ngNext">下一步：選劇本 ›</button>`;
      } else if (step === 2) {
        const vFor = id => netOn() ? voters().filter(k => votes[k] === id).map(whoName) : [];
        const notYet = netOn() ? voters().filter(k => !votes[k]).map(whoName) : [];
        body = `${netOn() ? `<div class="small" style="color:#9cc4ff;margin-bottom:6px">連線中：每個人點想玩的劇本投票，票最多的會被選上（平手時看主機投的）。${notYet.length ? '還沒投：' + esc(notYet.join('、')) : '大家都投了'}</div>` : ''}<div class="scenPick">${orderNow().filter(id => DB.scenarios[id]).map(id => { const s = DB.scenarios[id], ok = playable(id);
          return `<div class="scCard ${id === scen ? 'on' : ''} ${ok ? '' : 'off'}" data-s="${id}"><img src="img/misc/${s.image}.jpg"><div class="nm">${esc(T(s.name))}</div><div class="small">難度 ${'★'.repeat(s.difficulty || 1)}　${s.min}～${s.max} 分鐘</div>${ok ? '' : `<div class="small lockTxt">需要：${esc(needTxt(id))}</div>`}${vFor(id).length ? `<div class="small" style="color:#ffd27a">投票：${esc(vFor(id).join('、'))}（${vFor(id).length} 票）</div>` : ''}</div>`; }).join('')}</div>
        <div class="msg" style="font-size:14px">${fmt(T(sc.desc))}</div>`;
        btns = `<button class="btn" id="ngPrev">‹ 上一步</button><button class="btn primary" id="ngNext">下一步：選調查員 ›</button>`;
      } else {
        body = `<div class="msg" style="font-size:14px;margin-bottom:6px">劇本：<b>${esc(T(sc.name))}</b></div>
        <div class="lbl" style="font-size:14px">選擇調查員（1～5 位，已選 ${chosen.length} 位）</div>
        <div class="grid">${avail.map(iv => `<div class="pick ${chosen.includes(iv.id) ? 'on' : ''}" data-id="${iv.id}"><img src="${INV_DATA[iv.id].img}"><div>${esc(T(iv.name))}</div>${chosen.includes(iv.id) && ownerName(iv.id) ? `<div class="small pkOwner">${esc(ownerName(iv.id))} 選的</div>` : ''}${INV_DATA[iv.id].stats ? '' : '<div class="small">（數值待填）</div>'}</div>`).join('')}</div>
        <div class="row" style="margin-top:10px">地圖版本：<select id="selVar"><option value="">隨機（與官方相同）</option>${vars.map(v => `<option value="${v.id}" ${v.id === UI._ngVar ? 'selected' : ''}>${esc(v.id.split(' ').pop())}</option>`).join('')}</select></div>`;
        btns = `<button class="btn" id="ngPrev">‹ 上一步</button><button class="btn primary" id="btnStart" ${chosen.length ? '' : 'disabled'}>開始遊戲</button>`;
      }
      invTip.style.display = 'none';
      const D0 = UI.$('#dialog'), top = keepScroll ? D0.scrollTop : 0;
      UI.openDialog(`<h3 class="dlgTitle">新遊戲 <span class="small" style="opacity:.6">v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''}</span></h3>${bar}${body}<div class="btns">${btns}</div>`);
      const D = UI.$('#dialog'); D.scrollTop = top;   // 點選後畫面不要跳回最上面
      D.querySelectorAll('.scCard').forEach(el => el.onclick = () => { if (el.classList.contains('off')) { UI.toast('請先在「我的收藏」點亮：' + needTxt(el.dataset.s)); return; } if (netOn()) { const w = whoClicks() || 'host'; votes[w] = el.dataset.s; voteAt[w] = ++voteSeq; if (w === 'host') lsSet('mom2_scen', el.dataset.s); draw(); return; } scen = el.dataset.s; lsSet('mom2_scen', scen); draw(); });
      D.querySelectorAll('.prodBox').forEach(el => el.onclick = () => { const c = el.dataset.p; if (c === 'MAD20') { UI.toast('基本盒一定要有'); return; } const w = whoClicks(); if (w && w !== 'host') { const p = NET.peers.get(w); if (p) { p.coll = p.coll || new Set(); p.coll.has(c) ? p.coll.delete(c) : p.coll.add(c); } draw(); return; } coll.has(c) ? coll.delete(c) : coll.add(c); lsSet(SAVE_COLL, [...coll]); draw(); });
      D.querySelectorAll('.pick').forEach(el => {
        // 滑鼠移到調查員上：在滑鼠旁邊顯示能力和數值
        el.onmouseenter = e => { invTip.innerHTML = invInfo(el.dataset.id); invTip.style.display = 'flex'; placeTip(e); };
        el.onmousemove = placeTip;
        el.onmouseleave = () => { invTip.style.display = 'none'; };
        el.onclick = () => {
          const id = el.dataset.id, i = chosen.indexOf(id), who = whoClicks();
          focus = id;
          if (i >= 0) {
            // 連線時：只能取消自己選的調查員，不會把別人選的取消掉
            if (owners[id] && owners[id] !== who) { UI.toast(`${esc(T((DB.investigators.find(x => x.id === id) || {}).name || ''))} 是 ${ownerName(id)} 選的，只有他能取消`); draw(); return; }
            chosen.splice(i, 1); delete owners[id];
          } else if (chosen.length < 5) { chosen.push(id); owners[id] = who; }
          else UI.toast('最多 5 位');
          draw();
        };
      });
      const nx = UI.$('#ngNext'), pv = UI.$('#ngPrev'), sv2 = UI.$('#selVar');
      if (nx) nx.onclick = () => { step++; draw(false); };
      if (pv) pv.onclick = () => {
        if (step > 1) { step--; draw(false); return; }
        // 第一步再按上一步：有存檔就回到「繼續上次的遊戲？」
        if (Engine.loadSaved()) { this._skipResume = false; this.newGameDialog(); } else UI.toast('已經是第一步了');
      };
      D.querySelectorAll('.prodBox.locked').forEach(el => el.onclick = () => UI.toast('這個擴充還沒做進 APP（劇本、板塊、卡片都還沒有），暫時不能選'));
      if (sv2) sv2.onchange = () => { UI._ngVar = sv2.value; };
      const st = UI.$('#btnStart');
      if (st) st.onclick = () => {
        invTip.style.display = 'none';
        const v = UI.$('#selVar').value || pick(vars).id;
        UI.closeDialog();
        this.startGame(v, [...C], chosen.slice());
      };
    };
    UI._redrawNew = draw;
    draw();
  };
})();

// ==========================================================
//  搬移板塊（MoveTile）：把板塊搬到劇本指定標記的位置和角度
//  （銀木山莊、暮光權冠、10:50 開往阿卡姆、深淵潛藏、失落的伊格神殿會用到）
//  ・板塊上的調查員、怪物、火／黑暗／屏障、地上的物品跟著一起搬
//  ・官方資料寫明「屬於這塊板塊」的標記跟著搬
//  ・生成點：在板塊範圍內、而且不在別的板塊上的跟著搬（兩塊重疊時，看名稱有沒有這塊板塊的字）
//  ・搬過的位置記在存檔裡，讀檔後還原
// ==========================================================
(function () {
  const keyOf = s => String(s || '').replace(/^TILE_/, '').replace(/\s*\(.*\)\s*$/, '').replace(/_MAD\d+$/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const inside = (t, x, y) => { try { const S = MAP.spec(t.model, t.shape); const [lx, ly] = MAP.rot(x - t.x, y - t.y, -t.rot); return Math.abs(lx) <= S.tw / 2 + 0.01 && Math.abs(ly) <= S.th / 2 + 0.01; } catch (e) { return false; } };
  const bag = k => (G.vars['__' + k] = G.vars['__' + k] || {});
  // 生成點要複製一份（不然搬了會改到劇本原始資料，下一局位置就錯了）
  const ng = Engine.newGame;
  Engine.newGame = function () { const r = ng.apply(this, arguments); for (const k of Object.keys(G.points || {})) G.points[k] = Object.assign({}, G.points[k]); return r; };
  Actions.MoveTile = function (a) {
    const t = G.tiles[goName(a.Tile)], dn = goName(a.Transform);
    const d = (G.nodes || {})[dn] || (G.points || {})[dn];
    if (!t || !d) { console.warn('搬移板塊：找不到板塊或目的地', goName(a.Tile), dn); return; }
    const nx = +d.x, ny = +d.y, nr = d.rot != null ? +d.rot : t.rot;
    if (t.x === nx && t.y === ny && t.rot === nr) return;
    const ox = t.x, oy = t.y, orr = t.rot;
    const xf = (x, y) => { const [lx, ly] = MAP.rot(x - ox, y - oy, -orr); const [wx, wy] = MAP.rot(lx, ly, nr); return [nx + wx, ny + wy]; };
    const sameMap = o => (o.map || '') === (t.map || '');
    const movers = [];
    if (t.revealed) {
      const onTile = o => { try { const c = MAP.posCell(o); return !!(c && c.tile === t.id); } catch (e) { return false; } };
      for (const iv of G.inv) if (!iv.removed && onTile(iv)) movers.push(iv);
      for (const m of G.monsters) if (onTile(m)) movers.push(m);
      for (const k of G.tokens || []) if (onTile(k.cx != null ? { x: k.cx, y: k.cy } : k)) movers.push(k);
      for (const it of G.items) if (it.owner == null && it.x != null && onTile(it)) movers.push(it);
      for (const it of G.items) if (it.owner == null && it.ground && onTile(it.ground)) movers.push(it.ground);   // 地上的物品（1.2.52）
    }
    const tk = keyOf(t.model || t.id);
    // 標記屬於哪塊板塊：如果它屬於一個「群組」（例如貨車廂、王座廳），看那個群組現在被掛在哪（SetParent 會改）
    const par = G.vars.__parent || {};
    const ownerOf = n => { let g = n.tile, k = 0; while (g && k++ < 5) { if (par[g]) { g = par[g]; continue; } const gn = G.nodes[g]; if (gn && gn !== n && /^TILE_/.test(gn.tile || '')) { g = gn.tile; continue; } break; } return g; };
    const nodes = Object.values(G.nodes).filter(n => n.id !== dn && sameMap(n) && n.tile && keyOf(ownerOf(n)) === tk);
    const others = Object.values(G.tiles).filter(o => o !== t && sameMap(o));
    const words = String(t.model || '').replace(/^TILE_/, '').replace(/_MAD\d+$/, '').split('_').filter(w => w.length > 2 && !/^\d+$/.test(w)).map(w => w.toLowerCase());
    const pts = Object.values(G.points || {}).filter(p => sameMap(p) && inside(t, p.x, p.y) && (!others.some(o => inside(o, p.x, p.y)) || words.some(w => String(p.id).toLowerCase().includes(w))));
    t.x = nx; t.y = ny; t.rot = nr;
    for (const o of [...movers, ...nodes, ...pts]) {
      [o.x, o.y] = xf(+o.x, +o.y);
      if (o.cx != null) [o.cx, o.cy] = xf(o.cx, o.cy);
      if (o.block) { const b = o.block; [b.mx, b.my] = xf(b.mx, b.my); if (b.tx != null) [b.tx, b.ty] = xf(b.tx, b.ty); }
    }
    bag('tilePos')[t.id] = [nx, ny, nr];
    for (const p of pts) bag('ptPos')[p.id] = [p.x, p.y];
    Engine.log(`板塊移動：${T(t.model)}`);
    UI.render();
    if (t.revealed && UI.focusNodes) UI.focusNodes([t.id]);
  };
  // 「等某個流程跑完」卻指定等自己（銀木山莊的鐵男、儀式）：自己永遠在跑，會卡死。
  // 這種情況只稍等一下就繼續（否則 APP 一直以為劇情在跑：不能存檔、行動算到別人頭上）
  const wf = Actions.WaitForFSM;
  Actions.WaitForFSM = async function (a, f) {
    const tg = G.fsmByObj[goName(a.FsmToYieldOn)];
    if (tg && tg === f) { await sleep(30); return; }
    return wf.apply(this, arguments);
  };
  // 保險：新一輪調查員階段開始時，清掉上一輪殘留的「誰正在互動」紀錄（避免行動算到別人頭上）
  const sip = Engine.startInvestigatorPhase;
  Engine.startInvestigatorPhase = function () { try { if (typeof CE !== 'undefined') { CE.nodeActor = null; CE._ia = null; } } catch (e) { } return sip.apply(this, arguments); };
  // 讀檔：把搬過的板塊、生成點放回去（標記、人、怪物的位置存檔裡本來就有）
  const rs = Engine.restore;
  Engine.restore = function () {
    // 1.2.52 測試組：板塊位置還原前先別清「不在格子上的地上物品」（不然讀檔／上一步會把搬過板塊上的物品刪掉）
    Engine._noItemPurge = true; let r;
    try { r = rs.apply(this, arguments); } finally { Engine._noItemPurge = false; }
    try {
      for (const [id, [x, y, rot]] of Object.entries(G.vars.__tilePos || {})) if (G.tiles[id]) Object.assign(G.tiles[id], { x, y, rot });
      for (const [id, [x, y]] of Object.entries(G.vars.__ptPos || {})) if (G.points[id]) Object.assign(G.points[id], { x, y });
      UI.render();
    } catch (e) { console.warn('讀檔還原板塊位置', e); }
    return r;
  };
})();

// ==========================================================
//  新劇本用到的劇情動作（測試組 1.2.3x）
//  ・IsProductOwned：有沒有某個擴充（例如 MAD27 恐怖之旅）
//  ・GetInvestigatorId：記下「第幾位調查員」，訊息插入 Filter 13 會顯示他的名字
//  ・SetFsmVariable：官方資料只剩名稱和目標，數值遺失；照「讀另一個流程的變數」處理，把目標的同名變數抄過來
//  ・SetParent：把一群標記掛到某塊板塊下（之後搬板塊時一起搬），或掛回 Nodes（不再跟著搬）
// ==========================================================
(function () {
  const A = Actions;
  A.IsProductOwned = function (a) {
    const code = String((a.Product && (a.Product.ref || a.Product)) || '').split(' ')[0];
    const own = !!code && G.collection.has(code);
    return { event: own ? (a.trueEvent || a.TrueEvent) : (a.falseEvent || a.FalseEvent) };
  };
  A.GetInvestigatorId = function (a, f) {
    const n = varName(a.storeResult); if (n) setVar(n, +(a.PlayerIndex || 0), f);
  };
  A.SetFsmVariable = function (a, f) {
    const tg = G.fsmByObj[goName(a.gameObject || a.Target || a.target)];
    const n = a.variableName || (a.setValue && a.setValue.variableName);
    if (!tg || !n || !tg.vars || !(n in tg.vars)) { console.warn('SetFsmVariable：找不到目標或變數', a); return; }
    f.vars[n] = tg.vars[n];
  };
  A.SetParent = function (a) {
    const g = goName(a.gameObject), p = goName(a.parent);
    if (!g || !p) return;
    (G.vars.__parent = G.vars.__parent || {})[g] = p;
  };
})();

// ==========================================================
//  收起來的地圖（HideMap）上的標記不要再冒出來（測試組 1.2.36，劇本組 10:55 回報）
//  原版：整張地圖物件被關掉，裡面的標記就算被「顯示」也看不到。
//  例：銀木山莊第二幕的訊息用第一幕的鐘樓／陽台探索標記當出處，APP 會把它們又顯示出來。
//  ・HideMap 記下這張地圖；RevealMap 拿掉
//  ・顯示標記（RevealNode、DisplayMessageAndReveal、HighlightNodes）：標記在收起來的地圖上 → 保持隱藏
//  ・放板塊（RevealTile）到收起來的地圖 → 當作回到這張地圖（有些劇本回到舊地圖不呼叫 RevealMap）
// ==========================================================
window.addEventListener('load', () => setTimeout(() => {
  const hm = () => (G.vars.__hiddenMaps = G.vars.__hiddenMaps || {});
  // 標記被 MoveNode 搬到別張地圖（例：黑道風雲老薩迪從第一張地圖的酒吧搬到第二張地圖街角），以搬過去的那張地圖為準（1.2.45）
  const nm = () => (G.vars.__nodeMap = G.vars.__nodeMap || {});
  const mapOf = n => (n && (nm()[n.id] || n.map)) || null;
  const onHidden = n => { const mp = mapOf(n); return !!(mp && hm()[mp]); };
  const wrap = (name, fn) => { const o = Actions[name]; if (typeof o !== 'function') return; Actions[name] = fn(o); };
  wrap('MoveNode', o => function (a) { const id = goName(a.Node), sp = goName(a.SpawnPoint); const p = G.points[sp] || G.nodes[sp]; const mp = p && (nm()[sp] || p.map); if (id && mp) nm()[id] = mp; return o.apply(this, arguments); });
  wrap('HideMap', o => function (a) { const mp = goName(a.MapGameObject); if (mp) hm()[mp] = true; return o.apply(this, arguments); });
  wrap('RevealMap', o => function (a) { const mp = goName(a.MapGameObject); if (mp) delete hm()[mp]; return o.apply(this, arguments); });
  wrap('RevealTile', o => function (a) { const t = G.tiles[goName(a.Tile)]; if (t && t.map && hm()[t.map]) delete hm()[t.map]; return o.apply(this, arguments); });
  const keepHidden = ids => { let ch = false; for (const id of ids) { const n = G.nodes[id]; if (onHidden(n) && n.visible) { n.visible = false; ch = true; } } if (ch) UI.render(); };
  wrap('RevealNode', o => function (a) { const r = o.apply(this, arguments); keepHidden([goName(a.Node)]); return r; });
  wrap('HighlightNodes', o => function (a) { const r = o.apply(this, arguments); keepHidden((a.Nodes || []).map(goName)); return r; });
  wrap('DisplayMessageAndReveal', o => function (a) {
    const id = goName(a.MessageSource), n = G.nodes[id];
    if (!onHidden(n)) return o.apply(this, arguments);
    const was = n.visible; const p = o.apply(this, arguments); n.visible = was; UI.render(); return p;
  });
}, 0));

// ==========================================================
//  電子版加購劇本（書頁翻轉、鏡中人）用到的 9 種劇情動作（1.2.55 測試組）
// ==========================================================
(function () {
  const A = Actions;
  // 整數變數等於 compareTo[i] → 送 sendEvent[i]
  A.IntSwitch = (a, f) => { const v = val(a.intVariable, f); const cs = a.compareTo || []; for (let i = 0; i < cs.length; i++) if (v === val(cs[i], f)) return (a.sendEvent || [])[i] ? { event: a.sendEvent[i] } : null; return null; };
  // 整數變數 += add
  A.IntAdd = (a, f) => { const n = varName(a.intVariable); if (n) setVar(n, (+getVar(n, f) || 0) + (+val(a.add, f) || 0), f); };
  // 旗標全部是 false → 送 sendEvent
  A.BoolNoneTrue = (a, f) => { const none = (a.boolVariables || []).filter(Boolean).every(x => !getVar(varName(x), f)); return none && a.sendEvent ? { event: a.sendEvent } : null; };
  // 送事件給指定物件的流程（跟 SendEvent 一樣）
  A.SendEventByName = (a, f) => A.SendEvent(a, f);
  // LeftSide Operator RightSide（0 大於、1 大於等於、2 小於、3 小於等於、4 等於）
  A.CheckConditionNew = (a, f) => ({ event: cmp(+val(a.LeftSide, f), a.Operator || 0, +val(a.RightSide, f)) ? a.TrueEvent : a.FalseEvent });
  // 某個標記現在有沒有顯示
  A.GameObjectIsVisible = (a, f) => { const id = goName(a.gameObject); const n = G.nodes[id]; const vis = !!(n && n.visible) || (G.monsters || []).some(m => m.node === id); return { event: vis ? a.trueEvent : a.falseEvent }; };
  // 兩個整數比大小
  A.IntCompare = (a, f) => { const x = +val(a.integer1, f), y = +val(a.integer2, f); const ev = x === y ? a.equal : x < y ? a.lessThan : a.greaterThan; return ev ? { event: ev } : null; };
  // integer1 運算 integer2 → storeResult（0 加、1 減、2 乘、3 除、4 取小、5 取大）
  A.IntOperator = (a, f) => { const x = +val(a.integer1, f), y = +val(a.integer2, f); const op = a.operation || 0; const r = op === 1 ? x - y : op === 2 ? x * y : op === 3 ? (y ? Math.trunc(x / y) : 0) : op === 4 ? Math.min(x, y) : op === 5 ? Math.max(x, y) : x + y; const s = varName(a.storeResult); if (s) setVar(s, r, f); };
  // 指定調查員在不在這局
  A.CheckInvestigator = (a, f) => { const id = goName(a.investigator); const inPlay = (G.inv || []).some(iv => !iv.removed && iv.id === id); return { event: inPlay ? a.InvestigatorInPlayEvent : a.InvestigatorNotInPlayEvent }; };
})();

// ==========================================================
//  擴充的狀態（測試組 1.2.6x，使用者回報：羽蛇咬到沒有進入中毒）
//  ・「加入狀態」選單：有對應擴充時多出中毒（長蛇之路）、催眠（超越界限）、心力交瘁（暮光聖堂）、時空錯亂（驚魂之旅）
//  ・擲骰檢定後：成功／失敗那一段寫「進入○○狀態」（可以好幾個，例如「進入中毒和眩暈狀態」）就自動加上
// ==========================================================
window.addEventListener('load', () => setTimeout(() => {
  const ALL = ['集中', '眩暈', '擊昏', '抑制', '中毒', '催眠', '心力交瘁', '時空錯亂', '無畏', '剛正'];
  const EXTRA = { MAD23: '催眠', MAD26: '心力交瘁', MAD27: '時空錯亂', MAD28: '中毒' };
  Object.assign(CE.COND, { poisoned: '中毒', mesmerized: '催眠', stressed: '心力交瘁', lostInTime: '時空錯亂', fearless: '無畏' });
  const syncConds = () => {
    if (typeof CONDITIONS === 'undefined') return;
    for (const c of Object.values(EXTRA)) { const i = CONDITIONS.indexOf(c); if (i >= 0) CONDITIONS.splice(i, 1); }
    for (const [p, c] of Object.entries(EXTRA)) if (G.collection && G.collection.has(p)) CONDITIONS.push(c);
  };
  for (const k of ['newGame', 'restore']) { const o = Engine[k]; Engine[k] = function () { const r = o.apply(this, arguments); try { syncConds(); UI.render(); } catch (e) { } return r; }; }
  const condsIn = seg => {
    const out = []; const re = /進入([^，。；！：\s]{1,14}?)狀態/g; let m;
    while ((m = re.exec(seg))) for (const c of m[1].split(/和|、|及|與|以及/)) if (ALL.includes(c) && !out.includes(c)) out.push(c);
    return out;
  };
  CE.condsIn = condsIn;
  const dd = UI.diceDialog;
  UI.diceDialog = async function (opts = {}) {
    const r = await dd.apply(this, arguments);
    try {
      const lr = CE._lastRoll, t = opts.text || '';
      if (lr && lr.pass != null && t && !opts.negate) {
        const iOk = t.indexOf('如果檢定成功'), iNg = t.indexOf('如果檢定失敗');
        const seg = lr.pass ? (iOk >= 0 ? t.slice(iOk, iNg > iOk ? iNg : undefined) : '') : (iNg >= 0 ? t.slice(iNg, iOk > iNg ? iOk : undefined) : '');
        const iv = G.inv[lr.inv];
        if (iv && seg) for (const c of condsIn(seg)) if (!iv.conds.includes(c)) { CE.addCond(iv, c); UI.toast(`${iv.name} 進入${c}狀態`); }
        UI.render();
      }
    } catch (e) { console.warn('檢定後的狀態', e); }
    return r;
  };
}, 0));
