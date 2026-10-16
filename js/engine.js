// ============================================================
//  瘋狂詭宅 二版 劇本引擎：執行官方 App 的 PlayMaker 狀態機資料
// ============================================================
const U = 200; // 地圖：1 個遊戲單位 = 200 像素
const TRAIT_UNIQUE = 4194304;
const CUTSCENES = { 1: 'ALL_INVESTIGATORDEATH', 2: 'COE_PROLOGUE', 3: 'COE_PORTALCONSUMESHOUSE', 4: 'COE_PORTALCLOSED', 5: 'COE_RITUALSTOPPED' };

const G = {}; // 遊戲狀態

// ---------- 對話框排隊（一次只顯示一個）----------
let dlgChain = Promise.resolve();
var dlgOpenCount = 0;   // 目前正在顯示（還沒按掉）的排隊對話框數
function queueDialog(fn) {
  const p = dlgChain.then(() => { dlgOpenCount++; return Promise.resolve().then(fn).finally(() => { dlgOpenCount--; }); });
  dlgChain = p.catch(() => { });
  return p;
}

// ---------- 變數 ----------
function getVar(name, fsm) {
  if (fsm && fsm.vars && name in fsm.vars) return fsm.vars[name];
  if (name === 'PlayerCount') return G.inv.filter(i => !i.removed).length;
  if (name === 'MonsterCount') return G.monsters.length;
  if (name === 'Round') return G.round;
  return G.vars[name] ?? 0;
}
function setVar(name, val, fsm) {
  if (fsm && fsm.vars && name in fsm.vars) fsm.vars[name] = val;
  else G.vars[name] = val;
  Engine.checkWatchers();
}
function val(x, fsm, dflt = 0) {
  if (x == null) return dflt;
  if (typeof x === 'object' && 'var' in x) return x.var === '' ? dflt : getVar(x.var, fsm);
  return x;
}
function varName(x) { return x && typeof x === 'object' ? x.var : null; }
function goName(x) { return x && typeof x === 'object' ? (x.go || x.ref) : x; }

// ---------- 狀態機 ----------
class FSM {
  constructor(def, owner, kind) {
    this.def = def; this.owner = owner; this.kind = kind;
    this.states = {}; for (const s of def.states) this.states[s.name] = s;
    this.vars = {};
    for (const [k, list] of Object.entries(def.variables || {})) for (const [n, v] of list) this.vars[n] = (v && typeof v === 'object') ? null : v;
    this.state = null; this.tok = 0; this.running = 0; this.finished = false; this.idleWaiters = [];
  }
  start() { return this.enter(this.def.start); }
  findTransition(ev) {
    const st = this.states[this.state];
    if (st) for (const [e, to] of st.transitions) if (e === ev) return to;
    for (const [e, to] of this.def.globalTransitions || []) if (e === ev) return to;
    return null;
  }
  hasHandler(ev) { return this.findTransition(ev) != null; }
  fire(ev) {
    const to = this.findTransition(ev);
    if (to) { this.enter(to); return true; }
    return false;
  }
  async enter(name) {
    const st = this.states[name];
    if (!st) return;
    const tok = ++this.tok; this.state = name; this.running++;
    try {
      Engine.clearWatchersOf(this);
      // 官方 App（PlayMaker）進入狀態時，所有動作同時開始：訊息框等玩家按「繼續」時，
      // 同一狀態後面的動作（揭示標記、設定旗標、更新目標…）早就做完了。
      // 所以：訊息後面的「畫面類」動作先做，其餘動作在訊息之後照樣做，最後才依訊息的結果換狀態。
      const acts = st.actions.filter(Boolean);
      const isMsg = x => /^DisplayMessage/.test(x.action) || (x.Message && x.Message.Key != null);
      const mi = acts.findIndex(isMsg);
      let order = acts;
      if (mi >= 0 && mi < acts.length - 1) {
        const PRE = /^(RevealNode|RevealTile|SetRoomFlare|FocusCamera|HighlightNodes|PlaySound)/;
        const rest = acts.slice(mi + 1);
        order = [...acts.slice(0, mi), ...rest.filter(x => PRE.test(x.action)), acts[mi], ...rest.filter(x => !PRE.test(x.action))];
      }
      let pending = null, softPending = null;
      for (let k = 0; k < order.length; k++) {
        const a = order[k];
        const fn = Actions[a.action];
        let r = null;
        if (fn) {
          try { r = await fn(a, this); } catch (e) { console.error('動作錯誤', a.action, e); }
        } else console.warn('未實作的動作', a.action, a);
        if (tok !== this.tok) return;
        if (r && r.event && r.soft) { if (k < order.length - 1) { softPending = softPending || r.event; continue; } if (pending) continue; }   // 設定目標的 NEXT：同一狀態後面還有動作就先做完
        if (r && r.event) {
          if (pending) continue;
          if (isMsg(a) && k < order.length - 1) { pending = r.event; continue; }
          // 帶訊息的動作（例：SpawnMonster 附文字）回傳事件，但同一狀態後面還有純設定旗標／計數的動作：先做完再換狀態（1.2.48 測試組：深淵潛藏揪出混血深潛者後旗標沒清掉）
          if (k < order.length - 1 && order.slice(k + 1).every(x => /^(SetFlag|SetCounter|IncrementCounter|SetIntValue|SetBoolValue)$/.test(x.action))) { pending = r.event; continue; }
          const to = this.findTransition(r.event); if (to) return await this.enter(to); continue;
        }
        if (r && r.wait && !pending) return;
      }
      if (tok !== this.tok) return;
      if (pending) { const to = this.findTransition(pending); if (to) return await this.enter(to); }
      if (softPending) { const to = this.findTransition(softPending); if (to) return await this.enter(to); }
      const to = this.findTransition('FINISHED');
      if (to) return await this.enter(to);
    } finally {
      this.running--;
      if (this.running <= 0) { this.running = 0; const w = this.idleWaiters; this.idleWaiters = []; w.forEach(f => f()); Engine.checkWatchers(); }
    }
  }
  whenIdle() { return this.running === 0 ? Promise.resolve() : new Promise(r => this.idleWaiters.push(r)); }
}

// ---------- 引擎 ----------
const Engine = {
  watchers: [],
  addWatcher(fsm, check, ev) {
    const w = { fsm, tok: fsm.tok, check, ev };
    this.watchers.push(w);
    setTimeout(() => this.checkWatchers(), 0);
  },
  clearWatchersOf(fsm) { this.watchers = this.watchers.filter(w => w.fsm !== fsm); },
  checkWatchers() {
    let fired = true, guard = 0;
    while (fired && guard++ < 50) {
      fired = false;
      for (const w of [...this.watchers]) {
        if (w.fsm.tok !== w.tok || (G.fsms && !G.fsms.includes(w.fsm) && !(w.fsm.monster && G.monsters.includes(w.fsm.monster)) && !w.fsm.mythosEvent)) { this.watchers.splice(this.watchers.indexOf(w), 1); continue; }
        let ok = false; try { ok = w.check(); } catch (e) { }
        if (ok) { this.watchers.splice(this.watchers.indexOf(w), 1); fired = true; w.fsm.fire(w.ev); }
      }
    }
  },
  fsmOf(name) { return G.fsmByObj[name]; },
  broadcast(ev) { for (const f of G.fsms) f.fire(ev); },

  // ----- 開新局 -----
  newGame(opts) {
    Engine.watchers = [];   // 上一局／上一步留下的等待條件全部清掉，避免同一個劇情事件重複觸發
    const scen = SCENARIOS[opts.variant];
    Object.assign(G, {
      variant: opts.variant, scen, round: 1, phase: 'setup', threat: 0, unspent: 0, vars: {}, tiles: {}, nodes: {}, points: {},
      fsms: [], fsmByObj: {}, monsters: [], items: [], inv: opts.investigators, objective: null, log: [], mythosQueue: [],
      mostRecentItem: null, mostRecentMonster: null, collection: new Set(opts.collection), gameOver: null, tokens: [], monsterSeq: 0,
      deck: null, pendingRefund: 0, curMythosCost: 0, horrorStep: false, seen: {}
    });
    for (const t of scen.tiles) G.tiles[t.id] = Object.assign({}, t, { revealed: false });
    for (const n of scen.nodes) G.nodes[n.id] = Object.assign({}, n, { visible: false });
    for (const p of scen.points) G.points[p.id] = p;
    for (const d of scen.fsms) {
      const f = new FSM(d, d.object, 'scene');
      G.fsms.push(f); G.fsmByObj[d.object] = f;
    }
    // 調查員起始位置：入口
    const ent = scen.nodes.find(n => n.id === 'ENTRANCE' || (n.sprite || '').includes('Investigators'));
    G.inv.forEach((iv, i) => { if (iv.x != null) return; iv.x = (ent ? ent.x : 0) + (i - (G.inv.length - 1) / 2) * 0.28; iv.y = (ent ? ent.y : 0) + 0.25; });
    if (!opts.noStart) G.fsms.forEach(f => f.start());
  },

  async begin() {
    UI.render();
    // 序幕
    await UI.cutscene('COE_PROLOGUE', T('SCENARIO_CYCLE_OF_ETERNITY_MAD20'));
    // 起始物品
    const start = [];
    for (const f of DB.scenario.initialItemsRandom) {
      const it = Engine.randomItem(f.Filter, f.IncludeTraits, f.ExcludeTraits);
      if (it) { Engine.addItem(it); start.push(it); }
    }
    if (start.length) await Engine.say({ title: '起始物品', text: '調查員們共同擁有以下起始物品，請自行分配：', items: start });
    // 開始設置（揭示地圖）
    Engine.broadcast('BEGIN SCENARIO');
  },

  startInvestigatorPhase(first) {
    if (G.gameOver) return;
    if (!first) { G.round++; }
    G.phase = 'investigator'; G.horrorStep = false;
    Engine.checkWatchers();
    UI.banner('investigator');
    Engine.log(`第 ${G.round} 輪 調查員階段開始`);
    UI.render();
  },
  async endInvestigatorPhase() {
    if (G.phase !== 'investigator' || G.gameOver) return;
    G.phase = 'mythos'; UI.render();
    UI.banner('mythos');
    await sleep(1500);
    Engine.log(`第 ${G.round} 輪 神秘階段開始`);
    const story = G.fsmByObj['Story Events'];
    if (story && story.hasHandler('INVESTIGATOR_PHASE_END')) story.fire('INVESTIGATOR_PHASE_END');
    else { await Engine.runMythosSequence(); Engine.mythosWaitEnd(); }
  },
  mythosWaitEnd() { G.horrorStep = true; UI.render(); },
  endMythosPhase() {
    if (G.phase !== 'mythos') return;
    const story = G.fsmByObj['Story Events'];
    if (story) story.fire('MYTHOS_PHASE_END');
    Engine.startInvestigatorPhase(false);
  },

  // ----- 神秘階段流程（依官方 MythosSequenceTemplate）-----
  async runMythosSequence() {
    // 1. 火焰
    if (G.tokens.some(t => t.kind === 'fire')) {
      await Engine.say({ text: T('COMMON_MYTHOS_FIRE'), buttons: [{ label: T('COMMON_MYTHOS_FIRE_SPREAD'), ev: 'CONFIRM' }, { label: T('COMMON_MYTHOS_FIRE_NONE'), ev: 'CANCEL' }] });
    }
    // 2. 劇情事件 + 神秘事件
    await Engine.executeMythosEvents();
    if (G.gameOver) return;
    // 3. 怪物行動
    const act = G.monsters.filter(m => !m.cooldown && !(DB.monsters[m.model] || {}).ignoreAct);
    if (act.length) {
      UI.toast(T('UI_MONSTER_STEP'));
      for (const m of [...act]) {
        if (!G.monsters.includes(m)) continue;
        UI.selectMonster(m.uid);
        await Engine.runMonsterTemplate(m, 'attack', 'MONSTER/ATTACK/START');
      }
      UI.selectMonster(null);
    }
    G.monsters.forEach(m => { if (m.cooldown > 0) m.cooldown--; });
    // 4. 恐怖步驟
    if (G.monsters.length) {
      await Engine.say({ title: T('UI_HORROR_STEP'), text: T('UI_HORROR_STEP_MESSAGE') });
      G.horrorStep = true;
    }
    UI.render();
  },
  async executeMythosEvents() {
    const queue = G.mythosQueue.splice(0);
    let blocked = false;
    queue.sort((a, b) => ((G.nodes[b.owner] || {}).Priority || 0) - ((G.nodes[a.owner] || {}).Priority || 0));
    for (const f of queue) {
      if (G.gameOver) return;
      const n = G.nodes[f.owner] || {};
      if (n.BlocksMythosEvents) blocked = true;
      await Engine.runMythosFsm(f);
    }
    if (!blocked && !G.gameOver) await Engine.randomMythosEvent();
  },
  async runMythosFsm(f) {
    let done = false;
    f._mythosDone = () => { done = true; };
    if (!f.fire('BEGIN_MYTHOS')) return;
    await sleep(60);
    while (!done && f.running > 0) await sleep(60);
    f._mythosDone = null;
    await f.whenIdle();
  },
  // 官方神秘事件牌堆
  mythosValid(e) {
    if (!e.logic || !TEMPLATES[e.logic]) return false;
    if (!DB.scenario.mythosTypes.includes(e.type)) return false;
    if (e.products.length && !e.products.every(p => G.collection.has(p))) return false;
    if (e.round && G.round < e.round) return false;
    if (e.totalThreat && G.threat < e.totalThreat) return false;
    if (e.flags && !e.flags.split(/[,;]/).filter(Boolean).every(fl => getVar(fl.trim()))) return false;
    if (e.monsters.length && !e.monsters.every(id => G.monsters.some(m => m.model === id))) return false;
    if (e.items.length && !e.items.every(id => G.items.some(it => it.id === id))) return false;
    if (e.reqMonTraits && !Engine.collectionMonsters().some(m => (m.traits & e.reqMonTraits) === e.reqMonTraits)) return false;
    if (e.minRooms && Object.values(G.tiles).filter(t => t.revealed).length < e.minRooms) return false;
    return true;
  },
  async randomMythosEvent() {
    if (!G.deck || !G.deck.length) G.deck = shuffle(DB.mythos.filter(e => Engine.mythosValid(e)).map(e => e.id));
    const all = G.deck.map(id => DB.mythos.find(e => e.id === id)).filter(e => e && Engine.mythosValid(e));
    const big = all.filter(e => e.cost > 2 && e.cost <= G.unspent);
    const passive = all.filter(e => e.cost <= 2);
    const ev = pick(big.length ? big : passive);
    if (!ev) return;
    G.deck.splice(G.deck.indexOf(ev.id), 1);
    G.unspent -= ev.cost; G.curMythosCost = ev.cost;
    const f = new FSM(TEMPLATES[ev.logic], null, 'mythos');
    f.mythosEvent = ev; f.keyIdx = 0;
    f.start();
    await Engine.runMythosFsm(f);
    Engine.checkWatchers();
  },

  // ----- 怪物 -----
  collectionMonsters() {
    const out = [];
    for (const code of G.collection) for (const [id, n] of Object.entries((DB.products[code] || {}).monsters || {})) if (DB.monsters[id]) for (let i = 0; i < n; i++) out.push(DB.monsters[id]);
    return out;
  },
  pickMonster(req, excl) {
    req = req || 0; excl = excl || 0;
    const owned = Engine.collectionMonsters();
    const counts = {}; owned.forEach(m => counts[m.id] = (counts[m.id] || 0) + 1);
    let cand = Object.keys(counts).map(id => DB.monsters[id]).filter(m =>
      (m.traits & req) === req && (m.traits & excl) === 0 && !(m.traits & TRAIT_UNIQUE && !(req & TRAIT_UNIQUE)) && !DB.scenario.reservedMonsters.includes(m.id));
    const free = cand.filter(m => G.monsters.filter(x => x.model === m.id).length < counts[m.id]);
    if (free.length) cand = free;
    if (!cand.length) cand = Object.values(DB.monsters).filter(m => (m.traits & req) === req && (m.traits & excl) === 0 && !(m.traits & TRAIT_UNIQUE));
    return pick(cand);
  },
  addMonster(model, opts = {}) {
    const def = DB.monsters[model];
    const m = {
      uid: ++G.monsterSeq, model, name: opts.name || def.name, img: def.img, hp: opts.hp || def.tough || 3, dmg: 0, cooldown: 0,
      x: opts.x ?? 0, y: opts.y ?? 0, node: opts.node || null, fsm: {}
    };
    // 是否對應場景中的怪物節點
    if (!m.node) {
      const n = Object.values(G.nodes).find(n => n.virtual && n.id.startsWith('MONSTER ') && n.model && n.model.ref === model && !G.monsters.some(x => x.node === n.id));
      if (n) m.node = n.id;
    }
    G.monsters.push(m); G.mostRecentMonster = m;
    Engine.checkWatchers(); UI.render();
    return m;
  },
  monsterTemplate(m, kind) {
    const def = DB.monsters[m.model];
    let name = kind === 'invattack' ? DB.monsterTypes[def.type] : def[kind];
    if (!name || !TEMPLATES[name]) return null;
    if (!m.fsm[kind]) { m.fsm[kind] = new FSM(TEMPLATES[name], 'monster:' + m.uid, 'monster'); m.fsm[kind].monster = m; m.fsm[kind].start(); }
    return m.fsm[kind];
  },
  async runMonsterTemplate(m, kind, ev) {
    const f = Engine.monsterTemplate(m, kind);
    if (!f) { await Engine.say({ text: '（找不到此怪物的官方資料）' }); return; }
    G.mostRecentMonster = m;
    await f.whenIdle();
    if (!f.fire(ev)) {
      // 樣板卡在半路（例如按了「上一步」或上次攻擊中斷）：重新開始再試一次
      f.tok++; f.state = null; f.running = 0; await f.start(); await f.whenIdle();
      if (!f.fire(ev)) return;
    }
    await sleep(20);
    await f.whenIdle();
  },
  async killMonster(m) {
    const i = G.monsters.indexOf(m); if (i < 0) return;
    G.monsters.splice(i, 1);
    Engine.log(`${T(m.name)} 被擊敗了`);
    UI.render(); Engine.checkWatchers();
    if (m.node) {
      const f = G.fsmByObj[m.node];
      if (f) {
        f.fire('MONSTER/DEATH/START'); await sleep(30);
        // 在對話框裡面擊殺（例如攻擊訊息→擲骰→完成）：死亡劇情會排在這個對話框後面，
        // 這時候不能等它跑完，不然會互相等待、整個卡住
        if (dlgOpenCount === 0) await f.whenIdle();
      }
    }
  },

  // ----- 物品 -----
  collectionItems() {
    const out = new Set();
    for (const code of G.collection) for (const id of (DB.products[code] || {}).items || []) out.add(id);
    return [...out].map(id => DB.items[id]).filter(Boolean);
  },
  randomItem(filter, req, excl) {
    req = req || 0; excl = excl || 0;
    const types = filter === 1 ? [1] : filter === 2 ? [0] : [0, 1];
    const inPlay = new Set(G.items.map(i => i.id));
    let c = Engine.collectionItems().filter(it => types.includes(it.type) && (it.traits & req) === req && (it.traits & excl) === 0 &&
      !inPlay.has(it.id) && !DB.scenario.blacklistItems.includes(it.id) && !DB.scenario.reservedItems.includes(it.id));
    return pick(c);
  },
  addItem(def, extra = {}) {
    let it = G.items.find(i => i.id === def.id);
    if (!it) { it = Object.assign({ id: def.id, name: def.name, img: def.img, type: def.type, owner: null, interactions: [] }, extra); G.items.push(it); }
    G.mostRecentItem = it;
    Engine.log(`獲得物品：${T(def.name)}`);
    UI.render();
    return it;
  },

  // ----- 訊息 -----
  log(s) { G.log.push({ round: G.round, phase: G.phase, text: plain(s) }); },
  say(o) { try { if (o && o.fsm && o.text) o.fsm._lastText = plain(o.text); } catch (e) { } return queueDialog(() => UI.message(o)); },

  // ----- 解析訊息（插入文字）-----
  resolveMessage(msg, fsm) {
    if (!msg) return '';
    if (typeof msg === 'string') msg = { Key: msg };
    let key = msg.Key || '';
    const ins = msg.Inserts || [];
    const args = []; let female = false;
    const inv = () => { const alive = G.inv.filter(i => !i.removed); const iv = pick(alive.length ? alive : G.inv); if (iv && iv.gender === 1) female = true; return iv ? iv.name : ''; };
    ins.forEach((x, i) => {
      if (!x || !new RegExp('\\{' + i + '\\}').test(T(key))) { args[i] = null; return; }
      if (fsm && fsm.mythosEvent && !x.Filter) { args[i] = null; return; }
      const f = x.Filter || 0;
      switch (f) {
        case 0: args[i] = inv(); break;
        case 1: args[i] = G.mostRecentItem ? T(G.mostRecentItem.name) : ''; break;
        case 2: { const it = x.Item && x.IsRandomItem === undefined ? x.Item : null; args[i] = it ? T(it.ref) : (G.items.length ? T(pick(G.items).name) : ''); break; }
        case 3: args[i] = G.mostRecentMonster ? T(G.mostRecentMonster.name) : ''; break;
        case 4: args[i] = G.monsters.length ? T(pick(G.monsters).name) : ''; break;
        case 5: { const ts = Object.values(G.tiles).filter(t => t.revealed); args[i] = ts.length ? T(pick(ts).model) : ''; break; }
        case 6: args[i] = x.Room && x.IsRandomRoom === undefined ? Engine.roomName(x.Room.ref) : Engine.randomRoomName(); break;
        case 7: args[i] = getVar(varName(x.VariableBool) || '', fsm) ? '是' : '否'; break;
        case 8: args[i] = String((getVar(varName(x.VariableInt) || '', fsm) || 0) + (x.Delta || 0)); break;
        case 9: args[i] = String(getVar('PlayerCount')); break;
        case 10: { const opts = (x.LocalizationOptions || []).filter(o => o && o.Key); args[i] = opts.length ? T(pickWeighted(opts).Key) : ''; break; }
        case 11: {
          // 插入的文字本身還有 {0}{1}（資料用錯成範本）：改用沒有 _ALT 的那句，或把空格子拿掉
          let t = T(x.SpecificLocalizationKey);
          if (/\{\d\}/.test(t)) { const alt = String(x.SpecificLocalizationKey).replace(/_ALT$/, ''); t = alt !== x.SpecificLocalizationKey && hasKey(alt) && !/\{\d\}/.test(T(alt)) ? T(alt) : t.replace(/\{\d\}/g, '').replace(/^[，、\s]+/, ''); }
          args[i] = t; break;
        }
        case 12: args[i] = String(getVar(varName(x.VariableString) || '', fsm) || ''); break;
        case 13: { const iv = G.inv[+(getVar(varName(x.VariableInt) || '', fsm) || 0)] || G.inv[0]; if (iv && iv.gender === 1) female = true; args[i] = iv ? iv.name : ''; break; }
        default: args[i] = '';
      }
      if (f === 6 && x.Room && x.Room.ref && x.IsRandomRoom === false) args[i] = Engine.roomName(x.Room.ref);
    });
    // 神秘事件：依序套用文字
    if (!key && fsm && fsm.mythosEvent) key = Engine.mythosKey(fsm);
    let s = T(key);
    if (female && hasKey(key + '_ALT')) s = T(key + '_ALT');
    // 沒指定的 {0}：依英文判斷是房間還是調查員
    if (/\{0\}/.test(s) && args[0] == null) {
      const en = ((typeof scTable === 'function' && scTable(true)) || {})[key] || STR_EN[key] || '';
      if (/the \{0\}/.test(en) || /in \{0\}/.test(en)) args[0] = Engine.randomRoomName();
      else { args[0] = inv(); if (female && hasKey(key + '_ALT')) s = T(key + '_ALT'); }
    }
    return format(s, args);
  },
  mythosKey(fsm) {
    const name = fsm.mythosEvent.id.toUpperCase().replace(/['’\-]/g, '').replace(/[^A-Z0-9]+/g, '_').replace(/_+$/, '');
    const cands = Object.keys(STR_EN).filter(k => (k === 'MYTHOS_EVENT_' + name || k.startsWith('MYTHOS_EVENT_' + name + '_') || k === name || k.startsWith(name + '_')) && !/_ALT$/.test(k)).sort();
    const k = cands[Math.min(fsm.keyIdx, cands.length - 1)]; fsm.keyIdx++;
    return k;
  },
  roomName(ref) { const k = DB.rooms[ref]; return k ? T(k) : T(ref); },
  randomRoomName() {
    const ts = Object.values(G.tiles).filter(t => t.revealed);
    if (!ts.length) return '';
    const t = pick(ts); const room = (t.model || '').replace('TILE_', 'ROOM_');
    return DB.rooms[room] ? T(DB.rooms[room]) : T(t.model);
  },
  sourceInfo(src) {
    const n = src && G.nodes[goName(src)];
    if (!n) return null;
    let img = null;
    if (n.sprite) img = (n.sprite.startsWith('Person_') ? 'img/persons/' : 'img/features/') + n.sprite + '.png';
    return { id: n.id, img };
  },
  pos(spGo) {
    const n = goName(spGo); const p = G.points[n] || G.nodes[n];
    if (!p) return null;
    const tile = Engine.tileAt(p.x, p.y);
    if (tile && !tile.revealed && p.fallback) return Engine.pos(p.fallback);
    return { x: p.x, y: p.y };
  },
  tileAt(x, y) {
    return Object.values(G.tiles).find(t => {
      const [sw, sh] = MAP.size(t);
      const r = Math.abs(t.rot % 180) === 90; const w = r ? sh : sw, h = r ? sw : sh;
      return Math.abs(x - t.x) <= w / 2 && Math.abs(y - t.y) <= h / 2;
    });
  },
  // ----- 存檔 / 讀檔 -----
  canSave() {
    return G.scen && !G.gameOver && (G.phase === 'investigator' || (G.phase === 'mythos' && G.horrorStep)) &&
      document.querySelector('#overlay').classList.contains('hidden') && G.fsms.every(f => f.running === 0);
  },
  autosave() {
    clearTimeout(Engine._sv);
    Engine._sv = setTimeout(() => { if (Engine.canSave()) Engine.save(); }, 400);
  },
  save() {
    const data = {
      v: 1, time: Date.now(), variant: G.variant, round: G.round, phase: G.phase, horrorStep: G.horrorStep, threat: G.threat, unspent: G.unspent,
      vars: G.vars, collection: [...G.collection], objective: G.objective, log: G.log.slice(-400), deck: G.deck, tokens: G.tokens, monsterSeq: G.monsterSeq,
      tiles: Object.fromEntries(Object.values(G.tiles).map(t => [t.id, t.revealed])),
      nodes: Object.fromEntries(Object.values(G.nodes).map(n => [n.id, [n.visible, n.x, n.y]])),
      fsms: Object.fromEntries(G.fsms.map(f => [f.owner, { s: f.state, v: f.vars, fin: f.finished }])),
      monsters: G.monsters.map(m => ({ uid: m.uid, model: m.model, name: m.name, img: m.img, hp: m.hp, dmg: m.dmg, cooldown: m.cooldown, x: m.x, y: m.y, node: m.node })),
      items: G.items, inv: G.inv, queue: G.mythosQueue.map(f => f.owner),
      mri: G.mostRecentItem && G.mostRecentItem.id, mrm: G.mostRecentMonster && G.mostRecentMonster.uid,
      mrmD: G.mostRecentMonster && !G.monsters.includes(G.mostRecentMonster) ? { uid: G.mostRecentMonster.uid, model: G.mostRecentMonster.model, name: G.mostRecentMonster.name, img: G.mostRecentMonster.img, hp: G.mostRecentMonster.hp } : undefined
    };
    try { localStorage.setItem('mom2_save', JSON.stringify(data)); } catch (e) { }
  },
  loadSaved() { try { return JSON.parse(localStorage.getItem('mom2_save') || 'null'); } catch (e) { return null; } },
  clearSave() { try { localStorage.removeItem('mom2_save'); } catch (e) { } },
  restore(d) {
    Engine.newGame({ variant: d.variant, collection: d.collection, investigators: d.inv, noStart: true });
    Object.assign(G, { round: d.round, phase: d.phase, horrorStep: d.horrorStep, threat: d.threat, unspent: d.unspent, vars: d.vars, objective: d.objective, log: d.log, deck: d.deck, tokens: d.tokens || [], monsterSeq: d.monsterSeq, items: d.items });
    for (const [id, r] of Object.entries(d.tiles)) if (G.tiles[id]) G.tiles[id].revealed = r;
    for (const [id, [v, x, y]] of Object.entries(d.nodes)) if (G.nodes[id]) Object.assign(G.nodes[id], { visible: v, x, y });
    G.monsters = d.monsters.map(m => Object.assign({ fsm: {} }, m));
    G.mostRecentItem = G.items.find(i => i.id === d.mri) || (d.mri && DB.items[d.mri] ? Object.assign({}, DB.items[d.mri]) : null);   // 已棄除的道具也要記得名字
    G.mostRecentMonster = G.monsters.find(m => m.uid === d.mrm) || (d.mrmD ? Object.assign({ fsm: {}, dmg: 0 }, d.mrmD) : null);   // 被擊敗的怪物也要記得（劇情文字會用到名字）
    Engine._restoring = true;
    try { for (const f of G.fsms) {
      const s = d.fsms[f.owner]; if (!s) { f.start(); continue; }
      f.vars = s.v || f.vars; f.finished = s.fin; f.state = s.s;
      const st = f.states[s.s];
      if (st && st.actions.some(a => a && /^WaitFor/.test(a.action))) { f._restoring = true; f.enter(s.s); }
    } } finally { Engine._restoring = false; }
    G.mythosQueue = [...new Set((d.queue || []).map(o => G.fsmByObj[o]).filter(Boolean))];
    UI.render(); UI.fitView();
    UI.banner(G.phase === 'mythos' ? 'mythos' : 'investigator');
  },

  gameOver(victory, cut) {
    G.gameOver = { victory, cut }; Engine.clearSave();
    UI.render();
    return queueDialog(() => UI.gameOver(victory, cut));
  }
};
function pickWeighted(opts) {
  const tot = opts.reduce((s, o) => s + (o.Weight || 1), 0); let r = Math.random() * tot;
  for (const o of opts) { r -= (o.Weight || 1); if (r <= 0) return o; }
  return opts[opts.length - 1];
}

// ============================================================
//  動作實作
// ============================================================
function btnLabel(k, d) { return k ? T(k) : d; }
const Actions = {
  // ----- 訊息 -----
  async DisplayMessage(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    if (/^PLACEHOLDER/.test(text)) return { event: 'NEXT' };
    await Engine.say({ text, source: a.MessageSource, fsm: f });
    return { event: 'NEXT' };
  },
  async DisplayMessageAndReveal(a, f) {
    const n = G.nodes[goName(a.MessageSource)]; if (n) { n.visible = true; n.hl = Date.now(); UI.render(); UI.focusNodes([n.id]); }
    const text = Engine.resolveMessage(a.Message, f);
    await Engine.say({ text, source: a.MessageSource, fsm: f });
    return { event: 'NEXT' };
  },
  async DisplayMessageCancelConfirm(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    const ev = await Engine.say({ text, source: a.MessageSource, fsm: f, buttons: [{ label: btnLabel(a.CancelLabel, '取消'), ev: 'CANCEL' }, { label: btnLabel(a.ConfirmLabel, '確認'), ev: 'CONFIRM', primary: true }] });
    return { event: ev };
  },
  async DisplayMessageMultipleChoice(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    const btns = (a.Choices || []).filter(Boolean).map(c => ({ label: T(c.Localization), ev: c.Event }));
    if (a.CancelChoice && a.CancelChoice.Event) btns.push({ label: T(a.CancelChoice.Localization) || '取消', ev: a.CancelChoice.Event });
    const ev = await Engine.say({ text, source: a.MessageSource, fsm: f, buttons: btns, vertical: true });
    return { event: ev };
  },
  async DisplayMessageChallenge(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    const n = await queueDialog(() => UI.challenge({ text, source: a.MessageSource }));
    const sv = varName(a.Sum); if (sv) setVar(sv, n, f);
    const pairs = (a.ResultPairs || []).filter(Boolean).map(p => ({ sum: val(p.Sum, f), ev: p.Event })).sort((x, y) => x.sum - y.sum);
    let ev = pairs.length ? pairs[0].ev : 'NEXT';
    for (const p of pairs) if (n >= p.sum) ev = p.ev;
    return { event: ev };
  },
  async ShowMenuMessage(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    await Engine.say({ text, monster: f.monster, fsm: f });
    return { event: 'NEXT' };
  },
  async ShowMenuMessageBinary(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    const ev = await Engine.say({ text, monster: f.monster, fsm: f, buttons: [{ label: T(a.OptionA), ev: a.EventA, primary: true }, { label: T(a.OptionB), ev: a.EventB }] });
    return { event: ev };
  },
  async ShowMenuMessageMultipleChoice(a, f) {
    const text = Engine.resolveMessage(a.Message, f);
    const btns = (a.Choices || []).filter(Boolean).map(c => ({ label: T(c.Localization), ev: c.Event }));
    if (a.CancelChoice && a.CancelChoice.Event) btns.push({ label: T(a.CancelChoice.Localization) || '取消', ev: a.CancelChoice.Event });
    const ev = await Engine.say({ text, monster: f.monster, fsm: f, buttons: btns, vertical: true });
    return { event: ev };
  },
  SetMenuMessageViewVisibility() { }, SetMenuVisibility() { }, SelectMenuItem() { }, SetMostRecentMonster() { }, LockMenu() { },
  PlaySound() { },
  async Delay(a) { await sleep(Math.min(600, (a.Seconds || 0) * 1000)); },
  FocusCameraOnObjects(a) { UI.focusNodes((a.GameObjects || []).map(goName)); },
  FocusCameraOnWorldPositions(a) { const p = (a.Positions || [])[0]; if (p) UI.focusPos(p[0], p[1]); },
  SetRoomFlare() { },
  ResetRoomFlares() { },

  // ----- 地圖 -----
  RevealTile(a) { const t = G.tiles[goName(a.Tile)]; if (t) { t.revealed = true; Engine.log(`放置地圖板塊：${T(t.model)}`); UI.render(); UI.focusNodes([t.id]); } },
  HideTile(a) { const t = G.tiles[goName(a.Tile)]; if (t) { t.revealed = false; UI.render(); } },
  IsTileExplored(a) { const t = G.tiles[goName(a.Tile)]; return { event: t && t.revealed ? a.TrueEvent : a.FalseEvent }; },
  RevealNode(a) { const n = G.nodes[goName(a.Node)]; if (n) { n.visible = true; if (a.Highlight) n.hl = Date.now(); UI.render(); } },
  HideNode(a) { const n = G.nodes[goName(a.Node)]; if (n) { n.visible = false; UI.render(); } },
  HideThisNode(a, f) { const n = G.nodes[f.owner]; if (n) { n.visible = false; UI.render(); } },
  MoveNode(a) { const n = G.nodes[goName(a.Node)]; const p = Engine.pos(a.SpawnPoint); if (n && p) { n.x = p.x; n.y = p.y; UI.render(); } },
  ExploreNode(a) { const f = G.fsmByObj[goName(a.Node)]; if (f) f.fire('MOM/EXPLORE'); },

  // ----- 旗標 / 計數 -----
  GetFlag(a, f) { const v = !!getVar(varName(a.boolVariable), f); return { event: v ? a.isTrue : a.isFalse }; },
  SetFlag(a, f) { const n = varName(a.boolVariable); if (n) setVar(n, !!a.boolValue, f); },
  SetCounter(a, f) { const n = varName(a.variable); if (n) setVar(n, val(a.value, f), f); },
  IncrementCounter(a, f) { const n = varName(a.variable); if (n) setVar(n, getVar(n, f) + val(a.value, f, 1) * (a.IsNegative ? -1 : 1), f); },   // IsNegative：減少
  CheckCounter(a, f) {
    const v = val(a.variable, f); const vals = (a.values || []).map(x => x || {});
    for (const x of vals) if (v <= val(x.input, f)) return { event: x.outEvent };
    return { event: vals.length ? vals[vals.length - 1].outEvent : 'FINISHED' };
  },
  TestInt(a, f) { return { event: cmp(val(a.LeftSide, f), a.Operator || 0, val(a.RightSide, f)) ? a.TrueEvent : a.FalseEvent }; },
  RandomInt(a, f) {
    const min = val(a.min, f), max = val(a.max, f); const n = min + rnd(max - min + (a.inclusiveMax ? 1 : 0));
    const s = varName(a.storeResult); if (s) setVar(s, n, f);
  },
  RandomEvent(a, f) { const st = f.states[f.state]; const ts = st.transitions.filter(t => t[0] !== 'FINISHED'); const t = pick(ts); return t ? { event: t[0] } : null; },
  SendRandomEvent(a) { const evs = a.events || []; const w = (a.weights || []).map(x => x || 0); let r = Math.random() * w.reduce((s, x) => s + x, 0); for (let i = 0; i < evs.length; i++) { r -= w[i]; if (r <= 0) return { event: evs[i] }; } return { event: evs[evs.length - 1] }; },
  SendEvent(a, f) {
    const t = a.eventTarget || {};
    if (t.target === 4) { setTimeout(() => Engine.broadcast(a.sendEvent), 0); return; }
    const tg = t.go ? G.fsmByObj[goName(t.go)] : f;
    if (tg) setTimeout(() => tg.fire(a.sendEvent), 0);
  },
  CheckCondition(a) {
    const t = a.target || 0;
    const v = t === 0 ? G.round : t === 1 ? getVar('PlayerCount') : t === 2 ? G.monsters.length : t === 3 ? G.threat : t === 4 ? G.unspent : G.monsters.filter(m => !m.cooldown).length;
    return { event: v > 0 ? (a.trueEvent || 'TRUE') : (a.falseEvent || 'FALSE') };
  },

  // ----- 等待 -----
  WaitFor(a, f) {
    const target = a.target || 0, op = a.conditionOperator || 0, v = val(a.value, f);
    const cur = () => [G.round, getVar('PlayerCount'), G.monsters.length, G.threat, G.unspent][target];
    if (cmp(cur(), op, v)) return { event: a.continueEvent };
    Engine.addWatcher(f, () => cmp(cur(), op, v), a.continueEvent); return { wait: true };
  },
  WaitForFlag(a, f) {
    const n = varName(a.boolVariable), want = !!a.Value;
    if (!!getVar(n, f) === want) return { event: a.EventToFire };
    Engine.addWatcher(f, () => !!getVar(n, f) === want, a.EventToFire); return { wait: true };
  },
  WaitForCounter(a, f) {
    const n = varName(a.variable); const v = val(a.value, f);
    Engine.addWatcher(f, () => getVar(n, f) >= v, a.continueEvent || 'NEXT'); return { wait: true };
  },
  WaitForRoundDelay(a, f) {
    // 讀檔時：沿用原本要等到的輪數（不要從讀檔那輪重新算）
    const key = '__rdT/' + f.state;
    const target = (f._restoring && f.vars && f.vars[key] != null) ? f.vars[key] : G.round + val(a.Delay, f);
    f._restoring = false; if (f.vars) f.vars[key] = target;
    if (G.round >= target) return { event: a.continueEvent };
    Engine.addWatcher(f, () => G.round >= target, a.continueEvent); return { wait: true };
  },
  async WaitForFSM(a, f) {
    const tg = G.fsmByObj[goName(a.FsmToYieldOn)];
    await sleep(30); if (tg) await tg.whenIdle();
  },
  FinishFSM(a, f) { f.finished = true; },
  async RunFSM(a, f) { await Engine.runMythosSequence(); return { event: a.finishEvent || 'FINISHED' }; },
  ForceEndCurrentPhase() {
    if (G.phase === 'setup') setTimeout(() => Engine.startInvestigatorPhase(true), 50);
    else if (G.phase === 'mythos') setTimeout(() => Engine.startInvestigatorPhase(false), 50);
  },

  // ----- 威脅 / 神秘 -----
  IncreaseThreat(a, f) { const v = val(a.value, f); G.threat += v; G.unspent += v; Engine.checkWatchers(); },
  SpendThreat(a, f) { G.unspent -= val(a.value, f); Engine.checkWatchers(); },
  RefundThreat() { G.unspent += G.curMythosCost || 0; G.curMythosCost = 0; },
  AddThisMythosEvent(a, f) { if (G.fsms.includes(f) && !G.mythosQueue.some(x => x === f || (x.owner && x.owner === f.owner))) G.mythosQueue.push(f); },
  FinishMythosEvent(a, f) { if (f._mythosDone) f._mythosDone(); },
  ChangeMonsterCooldowns() { },

  // ----- 目標 / 結束 -----
  async SetGameObjective(a) {
    G.objective = a.Objective; Engine.log('目標：' + T(a.Objective)); UI.render();
    if (a.ShowMessage) await Engine.say({ title: '新目標', text: T(a.Objective) });
    return { event: 'NEXT', soft: true };   // 有些劇本（亡者歸來）設定目標後用 NEXT 往下走；沒有 NEXT 會自動走 FINISHED
  },
  async SetGameOver(a, f) {
    // IsForManualQuit：只是設定「玩家自己放棄時」要播哪個結局，不是現在就結束遊戲
    if (a.IsForManualQuit) { G.vars.__quitEnding = { v: !!a.IsVictory, cut: a.EndCutscene }; return; }
    // 官方資料有些結局漏了「勝利」記號（危機四伏的最佳結局與打倒怪物、星辰鍊金 01A～C 與逃離海城的秘密結局）：
    // 結局文字最後寫「調查成功／調查圓滿完成」就算勝利
    let win = !!a.IsVictory;
    try { if (!win && f && /調查(成功|圓滿完成|完成)[！!。.]?\s*$/.test(String(f._lastText || '').trim())) win = true; } catch (e) { }
    await Engine.gameOver(win, a.EndCutscene);
  },

  // ----- 物品 -----
  async SpawnItem(a, f) {
    let def = null;
    if (a.Item && a.Item.ref) def = DB.items[a.Item.ref];
    if (!def) def = Engine.randomItem(a.Filter || 0, a.RequiredTraits, a.ExcludeTraits);
    if (!def) { await Engine.say({ text: Engine.resolveMessage(a.Message, f) + '\n（你的收藏中沒有符合條件的物品）' }); return { event: 'NEXT' }; }
    const already = G.items.find(i => i.id === def.id);
    const it = already || Engine.addItem(def);
    G.mostRecentItem = it;
    const text = Engine.resolveMessage(a.Message, f);
    await Engine.say({ text, source: a.SpawnPoint ? null : null, items: [it], fsm: f });
    return { event: 'NEXT' };
  },
  CollectItem(a) {
    const n = G.nodes[goName(a.Item)]; if (!n || !n.model) return;
    const def = DB.items[n.model.ref]; if (!def) return;
    const it = Engine.addItem(def, { node: n.id }); it.node = n.id;
  },
  SetItemInteraction(a) {
    const n = G.nodes[goName(a.Item)];
    const it = G.items.find(i => i.node === (n && n.id)) || (n && n.model && G.items.find(i => i.id === n.model.ref));
    if (it && !it.interactions.some(x => x.ev === a.EventName)) it.interactions.push({ label: T(a.InteractionName), ev: a.EventName });
    UI.render();
  },

  // ----- 怪物 -----
  async SpawnMonster(a, f) {
    let def = a.Monster && a.Monster.ref ? DB.monsters[a.Monster.ref] : null;
    if (!def) def = Engine.pickMonster(a.RequiredTraits, a.ExcludeTraits);
    if (!def) return { event: 'NEXT' };
    const p = Engine.pos(a.SpawnPoint) || { x: 0, y: 0 };
    const hp = val(a.Health, f) || def.tough;
    const nameKey = a.MonsterName && (a.MonsterName.Key || a.MonsterName) || null;
    const m = Engine.addMonster(def.id, { x: p.x, y: p.y, hp, name: nameKey && typeof nameKey === 'string' ? nameKey : null });
    Engine.log(`出現怪物：${T(m.name)}（生命 ${m.hp}）`);
    UI.focusPos(p.x, p.y);
    const text = Engine.resolveMessage(a.Message, f);
    await Engine.say({ text, monster: m, fsm: f, spawn: true });
    return { event: 'NEXT' };
  },
  RevealNamedMonster(a) {
    const key = a.MonsterName && (a.MonsterName.Key || a.MonsterName);
    const node = goName(a.MonsterNode);
    const m = G.monsters.find(x => x.node === node) || (a.UseMostRecent && G.mostRecentMonster);
    if (m && key) { m.name = key; UI.render(); }
  },
  SetMonsterHP(a, f) {
    const node = goName(a.MonsterNode);
    const m = G.monsters.find(x => x.node === node);
    if (m) { m.hp = val(a.HitPoints, f); UI.render(); }
  },

  // ----- 謎題 -----
  async DisplaySlidePuzzle(a, f) { const r = await queueDialog(() => Puzzles.slide(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; },
  async DisplayCodePuzzle(a, f) { const r = await queueDialog(() => Puzzles.code(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; },
  async DisplayLockPuzzle(a, f) { const r = await queueDialog(() => Puzzles.lock(a, f)); return { event: r ? a.CompletedEvent : a.FailEvent }; },
};
function cmp(a, op, b) { return op === 0 ? a > b : op === 1 ? a >= b : op === 2 ? a < b : op === 3 ? a <= b : a === b; }
