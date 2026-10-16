// ============================================================
//  實體卡整合（物品效果、輪到誰、擲骰加骰、狀態）
//  卡片資料在 data/cards.js
// ============================================================
const CE = {
  COND: { focused: '集中', dazed: '眩暈', stunned: '擊昏', restrained: '抑制', wounded: '受傷', insane: '瘋狂' },
  WTYPE: { HEAVY: '重型武器', BLADED: '銳器', FIREARM: '槍械', SPELL: '法術', UNARMED: '徒手' },

  // ---------- 基本查詢 ----------
  alive() { return G.inv.map((iv, i) => i).filter(i => !G.inv[i].removed); },
  has(iv, key) { return iv && iv.conds.includes(CE.COND[key] || key); },
  addCond(iv, key) {
    const n = CE.COND[key] || key;
    if (iv.id === 'INVESTIGATOR_WENDY_ADAMS' && (n === '擊昏' || n === '抑制')) { UI.toast(`${iv.name} 的能力：不會進入${n}狀態`); return false; }
    if (!iv.conds.includes(n)) iv.conds.push(n);
    Engine.log(`${iv.name} 進入${n}狀態`);
    return true;
  },
  delCond(iv, key) { const n = CE.COND[key] || key; iv.conds = iv.conds.filter(c => c !== n); },
  owned(idx) { return G.items.filter(it => it.owner === idx); },
  // 卡片目前的那一面
  face(it) {
    const id = it.id || it;
    const c = CARDS.items[id];
    if (c) { if (it.flipped && c.flip) return Object.assign({ base: c }, c, { kind: c.flip.act ? 'act' : (c.flip.w ? 'flavor' : 'flip'), act: c.flip.act, auto: null, opt: null }, c.flip, { name: c.flip.name, flipped: true }); return c; }
    if (CARDS.unique[id]) return Object.assign({ unique: true }, CARDS.unique[id]);
    if (CARDS.spells[id]) { const s = CARDS.spells[id]; return { spell: true, cat: '法術', w: s.front.w, dmg: s.front.dmg, act: s.front.act, kind: s.front.act ? 'act' : 'spell', text: s.front.text }; }
    return null;
  },
  isWeapon(it) { const f = CE.face(it); return f && f.w; },
  isSpell(id) { return !!CARDS.spells[id]; },
  weaponMatches(it, type) {
    const f = CE.face(it); if (!f || !f.w) return false;
    if (!type) return true;
    if (type === 'SPELL') return !!f.spell;
    if (f.spell) return false;
    return (f.cat || '').includes(CE.WTYPE[type]);
  },
  bound(idx) { return CE.owned(idx).filter(it => it.flipped && CARDS.items[it.id] && CARDS.items[it.id].flip && CARDS.items[it.id].flip.bound).map(it => CARDS.items[it.id].flip.bound); },
  noClue(iv, idx) { return CE.has(iv, 'dazed') || CE.bound(idx).some(b => b.noClue); },
  usedRound(iv, key) { return iv.lim && iv.lim[key] === G.round; },
  markRound(iv, key) { iv.lim = iv.lim || {}; iv.lim[key] = G.round; },
  discardItem(it, why) {
    const i = G.items.indexOf(it); if (i < 0) return;
    G.items.splice(i, 1);
    Engine.log(`棄除物品：${T(it.name)}${why ? '（' + why + '）' : ''}`);
    const c = CARDS.items[it.id];
    if (c && c.note && c.note.onDrop) UI.toast(c.note.onDrop);
  },
  // 受到傷害／恐怖（第 2 階段會換成牌堆）
  suffer(iv, type, n, down) {
    if (!n) return;
    if (type === 'damage') { if (down) iv.dmg += n; else iv.dmgUp += n; }
    else { if (down) iv.hor += n; else iv.horUp += n; }
    Engine.log(`${iv.name} 受到 ${n} 點${down ? '面朝下的' : ''}${type === 'damage' ? '傷害' : '恐怖'}`);
  },

  // ---------- 輪到誰 ----------
  maxActs(iv) { return CE.has(iv, 'stunned') ? 1 : 2; },
  ensure(iv) { if (!iv.turn) iv.turn = { acts: 0, moves: 0, done: false }; if (!iv.lim) iv.lim = {}; },
  resetTurns() {
    G.inv.forEach(iv => { iv.turn = { acts: 0, moves: 0, done: !!iv.removed }; CE.ensure(iv); });
    G.active = null;
    const first = CE.alive()[0];
    if (first != null) CE.setActive(first, true);
  },
  setActive(i, quiet) {
    if (G.phase !== 'investigator') { G.active = i; UI.render(); return; }
    const cur = G.active != null ? G.inv[G.active] : null;
    if (cur && G.active !== i && cur.turn && cur.turn.acts > 0 && !cur.turn.done) CE.endTurn(G.active, true);
    G.active = i;
    const iv = G.inv[i]; CE.ensure(iv);
    if (iv.turn.done) iv.turn.done = false; // 手動切回已行動的人：允許補做
    UI.render();
    if (!quiet) UI.toast(`現在輪到：${iv.name}`);
    CE.turnStart(i);
  },
  async turnStart(i) {
    const iv = G.inv[i];
    if (iv.turn.acts > 0 || iv.turn.started) return;
    iv.turn.started = true;
    const sed = CE.owned(i).find(it => it.id === 'COMMON_ITEM_SEDATIVES');
    if (sed && (iv.dmg + iv.dmgUp + iv.hor + iv.horUp) > 0) {
      const ok = await UI.confirm(`${iv.name} 持有【鎮靜劑】。\n要在回合開始時使用嗎？棄除 3 點傷害和 3 點恐怖，然後棄除鎮靜劑並結束這個回合。`);
      if (ok) {
        CE.heal(iv, 'damage', 3, 'any'); CE.heal(iv, 'horror', 3, 'any');
        CE.discardItem(sed, '使用');
        CE.endTurn(i);
      }
    }
  },
  canMove(i) {
    const iv = G.inv[i];
    if (CE.has(iv, 'restrained')) return '你處於抑制狀態，不能主動移動。';
    if (CE.bound(i).some(b => b.noMove)) return '你被繩子綁住了，不能主動移動。';
    if (CE.has(iv, 'wounded') && iv.turn.moves >= 1) return '你處於受傷狀態，每輪只能執行一次移動行動。';
    return null;
  },
  spend(i, kind) {
    const iv = G.inv[i]; CE.ensure(iv);
    if (G.phase !== 'investigator') return true;
    if (G.active !== i) CE.setActive(i, true);
    if (kind === 'move') { const why = CE.canMove(i); if (why) { UI.toast(why); return false; } }
    if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return false; }
    iv.turn.acts++;
    if (kind === 'move') iv.turn.moves++;
    Engine.log(`${iv.name}：${kind === 'move' ? '移動' : '行動'}（${iv.turn.acts}/${CE.maxActs(iv)}）`);
    UI.render();
    return true;
  },
  async endTurn(i, quiet) {
    const iv = G.inv[i]; CE.ensure(iv);
    if (iv.turn.done) return;
    iv.turn.done = true;
    for (const k of ['dazed', 'stunned', 'restrained']) if (CE.has(iv, k)) { CE.delCond(iv, k); Engine.log(`${iv.name} 的${CE.COND[k]}狀態結束`); }
    if (CE.onTurnEnd) await CE.onTurnEnd(i);
    if (quiet) { UI.render(); return; }
    const next = CE.alive().find(j => !G.inv[j].turn || !G.inv[j].turn.done);
    if (next != null) { CE.setActive(next); return; }
    G.active = null; UI.render();
    if (await UI.confirm('所有調查員都行動完了。\n要結束調查員階段，進入神秘階段嗎？')) Engine.endInvestigatorPhase();
  },
  heal(iv, type, n, mode) {
    // mode: 'down' 只棄面朝下；'any' 先棄面朝下再棄面朝上
    let left = n;
    const kD = type === 'damage' ? 'dmg' : 'hor', kU = type === 'damage' ? 'dmgUp' : 'horUp';
    const a = Math.min(iv[kD], left); iv[kD] -= a; left -= a;
    if (mode === 'any') { const b = Math.min(iv[kU], left); iv[kU] -= b; left -= b; }
    if (n - left) Engine.log(`${iv.name} 棄除 ${n - left} 點${type === 'damage' ? '傷害' : '恐怖'}`);
    return n - left;
  },

  // ---------- 擲骰加骰 ----------
  autoBonuses(idx, ctx) {
    const out = [];
    for (const it of CE.owned(idx)) {
      const f = CE.face(it); if (!f || !f.auto) continue;
      if (CE.match(f.auto.when, ctx, it, f.auto)) out.push({ label: T(it.name), n: f.auto.dice, img: it.img });
    }
    return out;
  },
  minusList(idx, ctx) { return CE.cardMinus ? CE.cardMinus(idx, ctx) : []; },
  match(when, ctx, it, spec) {
    switch (when) {
      case 'any': return true;
      case 'skill': return ctx.skill === spec.skill;
      case 'evade': return ctx.kind === 'evade';
      case 'monsterAttack': return ctx.kind === 'monsterAttack';
      case 'unarmed': return ctx.kind === 'attack' && ctx.weapon === 'unarmed';
      case 'attackWith': return ctx.kind === 'attack' && ctx.weapon === it.id;
      case 'spell': return ctx.kind === 'spell' || (ctx.kind === 'attack' && CE.isSpell(ctx.weapon));
    }
    return false;
  },
  optionals(idx, ctx) {
    const iv = G.inv[idx], out = [];
    for (const it of CE.owned(idx)) {
      const f = CE.face(it); if (!f || !f.opt) continue;
      if (!CE.match(f.opt.when, ctx, it, f.opt)) continue;
      const lim = f.opt.limit && CE.usedRound(iv, it.id);
      out.push({ key: it.id, item: it, label: T(it.name), img: 'img/items/' + it.img + '.png', text: f.text, eff: f.opt.eff, cost: f.opt.cost || {}, limit: f.opt.limit, disabled: lim ? (f.opt.limit === 'round' ? '本輪已使用' : '本回合已使用') : '' });
    }
    if (CE.has(iv, 'focused')) out.push({ key: '__focus', label: '集中', img: 'img/icons/clue.png', text: CARDS.conditions.focused.text, eff: 'allClue', cost: { cond: 'focused' } });
    return out;
  },
  // 「受到2點面朝下的恐怖（意志-1消除）」這種：成功數抵消傷害／恐怖
  parseNegate(text) {
    const t = text || '';
    const m = t.match(/([\uf200-\uf205])\s*([+\-－＋]\s*\d)?\s*消除/);
    if (!m) return null;
    const mod = m[2] ? parseInt(m[2].replace(/[－]/, '-').replace(/[＋]/, '+').replace(/\s/g, '')) : 0;
    const before = t.slice(0, t.indexOf(m[0]));
    const hits = [];
    const re = /(\d+)\s*(點|張)([^，。；！？\d]*?)(傷害|恐怖|恐懼)/g;
    const seg = before.slice(Math.max(0, before.search(/(受到|獲得)[^。；]*$/)));
    let x; while ((x = re.exec(seg))) hits.push({ type: x[4] === '傷害' ? 'damage' : 'horror', n: +x[1], down: /朝下/.test(x[3]) });
    return { skill: SKILLS[m[1].charCodeAt(0) - 0xf200].k, mod, hits };
  },
  parseNeed(text) { const m = (text || '').match(/[-]\s*[；;]\s*(\d+)/); return m ? +m[1] : null; },
  parseSkill(text) { const m = (text || '').match(/[-]/); return m ? SKILLS[m[0].charCodeAt(0) - 0xf200].k : null; },
  defaultInv() { if (G.active != null && !G.inv[G.active].removed) return G.active; return CE.alive()[0] ?? 0; }
};

// ============================================================
//  擲骰視窗（取代原本的）
//  opts: inv, skill, kind('test'|'attack'|'evade'|'horror'|'monsterAttack'|'spell'), text, need, weaponType, monster(uid), useResult
// ============================================================
UI.diceDialog = function (opts = {}) {
  return new Promise(res => {
    const pool = opts.only && opts.only.length ? opts.only : CE.alive();
    const askWho = opts.inv == null && pool.length > 1 && (G.phase !== 'investigator' || G.active == null || opts.only);
    let ivIdx = opts.inv ?? (opts.only && opts.only.length === 1 ? opts.only[0] : askWho ? null : (CE.actorNow && CE.actorNow() != null ? CE.actorNow() : CE.defaultInv()));
    let skill = opts.skill || CE.parseSkill(opts.text) || 'obs';
    const fixedSkill = !!(opts.skill || CE.parseSkill(opts.text));
    const kind = opts.kind || 'test';
    const need = opts.need ?? CE.parseNeed(opts.text);
    let mod = 0, dice = [], sel = new Set(), rolled = false, used = new Set(), weapon = null, dealtAdj = 0, hitAdj = [];
    const neg = opts.negate || null;
    if (neg && !neg.hits.length) neg.hits.push({ type: kind === 'horror' ? 'horror' : 'damage', n: 1, down: false });
    const mon = opts.monster && kind === 'attack' ? G.monsters.find(m => m.uid === opts.monster) : null;
    const iv = () => ivIdx == null ? null : G.inv[ivIdx];
    const NAME = { attack: '攻擊', evade: '躲避', horror: '恐怖檢定', monsterAttack: '抵擋攻擊', spell: '施法' };
    const weapons = () => {
      if (kind !== 'attack' || ivIdx == null) return [];
      const out = CE.owned(ivIdx).filter(it => CE.weaponMatches(it, opts.weaponType)).map(it => ({ id: it.id, label: T(it.name), f: CE.face(it) }));
      if (!opts.weaponType || opts.weaponType === 'UNARMED') out.push({ id: 'unarmed', label: '徒手', f: { dmg: 0 } });
      return out;
    };
    const pickWeapon = () => { const w = weapons(); if (!w.find(x => x.id === weapon)) weapon = w.length ? w[0].id : (kind === 'attack' ? 'unarmed' : null); };
    // 武器指定用某項能力檢定（例如赫刀：一律用力量）
    const wNow = () => weapons().find(x => x.id === weapon);
    const skillNow = () => { const w = kind === 'attack' && wNow(); return (w && w.f && w.f.forceSkill) || skill; };
    const ctx = () => ({ kind, skill: skillNow(), weapon });
    const parts = () => {
      if (!iv()) return [];
      const sk = skillNow(), w = kind === 'attack' && wNow();
      const p = [{ label: SKILLS.find(s => s.k === sk).zh + (sk !== skill && w ? `（${w.label}：改用${SKILLS.find(s => s.k === sk).zh}）` : ''), n: iv().skills[sk], base: true }];
      CE.autoBonuses(ivIdx, ctx()).forEach(b => p.push(b));
      CE.minusList(ivIdx, ctx()).forEach(b => p.push(b));
      if (neg && neg.mod) p.push({ label: '檢定修正', n: neg.mod });
      if (mod) p.push({ label: '手動調整', n: mod });
      return p;
    };
    const total = () => Math.max(1, parts().reduce((a, b) => a + b.n, 0));   // 規則：骰池少於 1 時仍擲 1 顆
    const succ = () => dice.filter(d => d === 'S').length;
    const clueFaces = () => dice.filter(d => d === 'C').length;
    const wDmg = () => { const w = weapons().find(x => x.id === weapon); return w && w.f ? (w.f.dmg || 0) + (w.f.bonus || 0) + (w.f.bonus2 && succ() >= 2 ? 1 : 0) + (w.f.bonus1 && succ() >= 1 ? 1 : 0) : 0; };   // bonus1：至少 1 個成功時額外 +1   // bonus2：至少 2 個成功時額外 +1
    // 結果
    const hitsNow = () => {
      const s = succ(), pass = need != null ? s >= need : null;
      let h = [];
      if (neg) { let left = s; h = neg.hits.map(x => { const cut = Math.min(left, x.n); left -= cut; return Object.assign({}, x, { left: x.n - cut }); }); }
      else if (opts.outcome && pass != null) h = (pass ? opts.outcome.ok : opts.outcome.ng).map(x => Object.assign({}, x, { left: x.n }));
      h.forEach((x, i) => { x.left = Math.max(0, x.left + (hitAdj[i] || 0)); });
      return h;
    };
    const dealt = () => { const s = succ(), pass = need != null ? s >= need : true; const fx = opts.dmgFx && (pass ? opts.dmgFx.ok : opts.dmgFx.ng); if (fx) return Math.max(0, fx(s, wDmg()) + dealtAdj); return pass ? Math.max(0, s + wDmg() + dealtAdj) : Math.max(0, dealtAdj); };
    const verdict = () => {
      const s = succ(), canClue = iv() && iv().clues > 0 && !CE.noClue(iv(), ivIdx);
      const nm = NAME[kind] || '檢定';
      if (neg) {
        const h = hitsNow(), tot = h.reduce((a, x) => a + x.left, 0), all = h.reduce((a, x) => a + x.n, 0);
        const what = h.map(x => `${x.left} 點${x.down ? '面朝下的' : ''}${x.type === 'damage' ? '傷害' : '恐怖'}`).join('、');
        if (!tot) return { ok: true, big: '✔ 完全消除', small: `抵消了全部 ${all} 點` };
        const tip = canClue && clueFaces() ? `（花 ${Math.min(tot, clueFaces(), iv().clues)} 線索可以再抵消）` : '';
        return { ok: false, big: `消除 ${all - tot} 點 → 受到 ${what}`, small: tip };
      }
      if (need != null) {
        if (s >= need) return { ok: true, big: `✔ ${nm === '檢定' ? '檢定' : nm}成功`, small: kind === 'attack' && mon ? `對 ${T(mon.name)} 造成 ${dealt()} 點傷害${opts.dmgTxt ? `（${opts.dmgTxt}）` : ''}` : '' };
        const lack = need - s, fix = canClue && clueFaces() >= lack && iv().clues >= lack;
        return { ok: false, big: `✘ ${nm === '檢定' ? '檢定' : nm}失敗`, small: `還差 ${lack} 個成功${fix ? `，花 ${lack} 線索就能成功` : ''}${kind === 'attack' && mon && dealt() ? `；仍對 ${T(mon.name)} 造成 ${dealt()} 點傷害` : ''}` };
      }
      if (kind === 'attack' && mon) return { ok: true, big: `對 ${T(mon.name)} 造成 ${dealt()} 點傷害`, small: opts.dmgTxt ? `（${opts.dmgTxt}）` : `成功 ${s}${wDmg() ? ` ＋ 武器傷害 ${wDmg()}` : ''}` };
      return { ok: null, big: `成功 ${s}`, small: '' };
    };
    const outcomeLine = () => { const h = hitsNow().filter(x => x.left); if (neg || !h.length) return ''; return `${iv().name}：` + h.map(x => x.flip ? `${x.left} 張${x.type === 'damage' ? '傷害' : '恐怖'}卡翻到正面` : `受到 ${x.left} 點${x.down ? '面朝下的' : ''}${x.type === 'damage' ? '傷害' : '恐怖'}`).join('、'); };
    const draw = () => {
      pickWeapon();
      const ws = weapons();
      const ops = rolled ? CE.optionals(ivIdx, ctx()) : [];
      const noClue = iv() && CE.noClue(iv(), ivIdx);
      const v = rolled ? verdict() : null;
      UI.openDialog(`<h3 class="dlgTitle">${NAME[kind] || '擲骰'}${need != null ? `　<span class="need">需要 ${need} 個成功</span>` : ''}</h3>
        ${opts.text ? `<div class="msg dmsg">${fmt(opts.text)}</div>` : ''}
        ${!rolled && (askWho || ivIdx == null) ? `<div class="whoRow">${ivIdx == null ? '<b>誰擲骰？</b>' : ''}${pool.map(i => `<div class="who ${i === ivIdx ? 'on' : ''}" data-who="${i}"><img src="${G.inv[i].img}"><span>${esc(G.inv[i].name)}</span></div>`).join('')}</div>` : iv() ? `<div class="whoOne"><img src="${iv().img}">${esc(iv().name)}</div>` : ''}
        ${!rolled && iv() ? `<div class="dparts">${parts().map(p => `<span class="dp ${p.base ? 'base' : p.n < 0 ? 'neg' : 'pos'}">${p.base ? '' : (p.n > 0 ? '＋' : '－') + Math.abs(p.n) + ' '}${esc(p.label)}${p.base ? ' ' + p.n : ''}</span>`).join('')}
          ${fixedSkill ? '' : `<select id="dSk">${SKILLS.map(s => `<option value="${s.k}" ${s.k === skill ? 'selected' : ''}>${s.zh}</option>`).join('')}</select>`}
          ${kind === 'attack' ? `<select id="dW">${ws.map(x => `<option value="${x.id}" ${x.id === weapon ? 'selected' : ''}>${esc(x.label)}${x.f && x.f.dmg ? `（傷害 ${x.f.dmg}）` : ''}</option>`).join('')}</select>` : ''}</div>
          <div class="btns"><button class="btn primary big" id="dRoll" ${iv() ? '' : 'disabled'}>擲 ${total()} 顆骰</button><button class="btn" id="dCancel">取消</button></div>` : ''}
        ${!rolled && !iv() ? `<div class="btns"><button class="btn" id="dCancel">取消</button></div>` : ''}
        ${rolled ? `<div class="dice">${dice.map((d, i) => `<div class="die ${d === 'B' ? 'blank' : ''} ${sel.has(i) ? 'lock' : ''}" data-i="${i}"><img src="${d === 'S' ? 'img/ui/ElderSign_256.png' : 'img/ui/MAD20_Clue-Token.png'}"></div>`).join('')}</div>
          <div class="verdict ${v.ok === true ? 'ok' : v.ok === false ? 'ng' : ''}"><div class="vb">${esc(v.big)}</div>${v.small ? `<div class="vs">${esc(v.small)}</div>` : ''}${outcomeLine() ? `<div class="vs">${esc(outcomeLine())}</div>` : ''}</div>
          ${ops.length || (iv().clues > 0 && clueFaces() && !noClue) ? `<div class="opts">
            ${iv().clues > 0 && clueFaces() && !noClue ? `<div class="opt clueOpt" id="dClue"><img src="img/icons/clue.png"><div><b>花 1 線索</b><div class="small">${iv().id === 'INVESTIGATOR_JOE_DIAMOND' ? '2 個🔍變成功（祖的能力）' : '1 個🔍變成功'}（剩 ${iv().clues}）</div></div></div>` : ''}
            ${ops.map((o, i) => `<div class="opt ${o.disabled || used.has(o.key) ? 'off' : ''}" data-o="${i}" title="${esc(o.text)}"><img src="${o.img}"><div><b>${esc(o.label)}</b><div class="small">${esc(o.disabled || (used.has(o.key) ? '已使用' : o.text))}</div></div></div>`).join('')}</div>` : ''}
          ${noClue && iv().clues > 0 && clueFaces() ? `<div class="warn">${esc(CE.noClueWhy ? CE.noClueWhy(iv(), ivIdx) : '眩暈')}：不能花線索</div>` : ''}
          <div class="btns"><button class="btn primary big" id="dDone">完成</button></div>
          <details class="manual"><summary>調整</summary>
            <div class="btns"><button class="btn small" id="dAdd">再加擲 1 顆</button><button class="btn small" id="dRe">重擲選取的骰子（先點骰子）</button></div>
            ${mon ? `<div class="btns">傷害 <button class="btn small" id="dDm">−</button><b>${dealt()}</b><button class="btn small" id="dDp">＋</button></div>` : ''}
            ${hitsNow().map((h, i) => `<div class="btns">${h.type === 'damage' ? '傷害' : '恐怖'}${h.flip ? '翻正面' : ''} <button class="btn small" data-hm="${i}">−</button><b>${h.left}</b><button class="btn small" data-hp="${i}">＋</button></div>`).join('')}
          </details>` : ''}`);
      const $ = s => UI.$('#dialog').querySelector(s);
      UI.$('#dialog').querySelectorAll('[data-who]').forEach(el => el.onclick = () => { ivIdx = +el.dataset.who; draw(); });
      if ($('#dSk')) $('#dSk').onchange = e => { skill = e.target.value; draw(); };
      if ($('#dW')) $('#dW').onchange = e => { weapon = e.target.value; draw(); };
      if ($('#dRoll')) $('#dRoll').onclick = () => { dice = Array.from({ length: total() }, () => UI.rollDie()); rolled = true; sel.clear(); Engine.log(`${iv().name} 擲 ${dice.length} 顆骰：成功 ${succ()}`); draw(); UI.$('#dialog').querySelectorAll('.die').forEach(d => d.classList.add('roll')); };
      if ($('#dCancel')) $('#dCancel').onclick = () => { UI.closeDialog(); res(0); };
      if ($('#dAdd')) $('#dAdd').onclick = () => { dice.push(UI.rollDie()); draw(); };
      if ($('#dRe')) $('#dRe').onclick = () => { sel.forEach(i => dice[i] = UI.rollDie()); sel.clear(); draw(); };
      if ($('#dDm')) $('#dDm').onclick = () => { dealtAdj--; draw(); };
      if ($('#dDp')) $('#dDp').onclick = () => { dealtAdj++; draw(); };
      UI.$('#dialog').querySelectorAll('[data-hm]').forEach(b => b.onclick = () => { const i = +b.dataset.hm; hitAdj[i] = (hitAdj[i] || 0) - 1; draw(); });
      UI.$('#dialog').querySelectorAll('[data-hp]').forEach(b => b.onclick = () => { const i = +b.dataset.hp; hitAdj[i] = (hitAdj[i] || 0) + 1; draw(); });
      UI.$('#dialog').querySelectorAll('.die').forEach(el => el.onclick = () => { const i = +el.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); el.classList.toggle('lock'); });
      if ($('#dClue')) $('#dClue').onclick = () => { const i = dice.indexOf('C'); if (i >= 0 && iv().clues > 0) { dice[i] = 'S'; if (iv().id === 'INVESTIGATOR_JOE_DIAMOND') { const j = dice.indexOf('C'); if (j >= 0) dice[j] = 'S'; } iv().clues--; Engine.log(`${iv().name} 花 1 線索轉換骰子`); UI.render(); draw(); } };
      UI.$('#dialog').querySelectorAll('[data-o]').forEach(el => el.onclick = async () => {
        const o = ops[+el.dataset.o]; if (o.disabled || used.has(o.key)) return;
        if ((o.eff === 'oneClue' || o.eff === 'allClue' || o.eff === 'gambler') && !dice.includes('C')) { UI.toast('沒有🔍可以轉換'); return; }
        if (o.eff === 'rerollOne' && sel.size !== 1) { UI.toast('請先點選 1 顆要重擲的骰子'); return; }
        if (o.eff === 'rerollSel' && !sel.size) { UI.toast(`請先點選要重擲的骰子（可以選很多顆），選好後再按一次【${o.label}】`); UI.$('#dialog').querySelectorAll('.die').forEach(d => d.classList.add('pickMe')); el.classList.add('armed'); return; }
        const c = o.cost;
        const costTxt = c.horror ? `承受 ${c.horror} 點面朝下的恐怖` : c.damage ? `承受 ${c.damage} 點面朝下的傷害` : c.discardSelf ? `棄除【${o.label}】` : '';
        if (costTxt && !(await UI.confirm(`使用【${o.label}】需要${costTxt}，確定嗎？`))) return;
        if (o.eff === 'allClue') dice = dice.map(d => d === 'C' ? 'S' : d);
        if (o.eff === 'oneClue') dice[dice.indexOf('C')] = 'S';
        if (o.eff === 'rerollAll') dice = dice.map(() => UI.rollDie());
        if (o.eff === 'gambler') { const gi = dice.indexOf('C'); dice = dice.map((d, k) => k === gi ? 'B' : UI.rollDie()); sel.clear(); }
        if (o.eff === 'rerollOne') { const i = [...sel][0]; dice[i] = UI.rollDie(); sel.clear(); }
        if (o.eff === 'rerollSel') { const ix = [...sel]; ix.forEach(i => dice[i] = UI.rollDie()); sel.clear(); }
        if (c.horror) await CE.suffer(iv(), 'horror', c.horror, true);
        if (c.damage) await CE.suffer(iv(), 'damage', c.damage, true);
        if (c.discardSelf && o.item) CE.discardItem(o.item, '使用');
        if (c.cond) CE.delCond(iv(), c.cond);
        if (o.limit && !o.onUse) CE.markRound(iv(), o.key);
        if (o.onUse) o.onUse();
        used.add(o.key);
        Engine.log(`${iv().name} 使用【${o.label}】：成功 ${succ()}`);
        UI.render(); draw();
      });
      if ($('#dDone')) $('#dDone').onclick = async () => {
        UI.closeDialog();
        const h = hitsNow();
        if (h.some(x => x.left)) { if (CE.applyHits) await CE.applyHits(iv(), h); else for (const x of h) if (x.left) await CE.suffer(iv(), x.type, x.left, x.down); }
        if (mon && G.monsters.includes(mon)) {
          const n = dealt();
          if (n) {
            mon.dmg += n; Engine.log(`${T(mon.name)} 受到 ${n} 點傷害（${mon.dmg}/${mon.hp}）`); UI.toast(`${T(mon.name)} 受到 ${n} 點傷害`);
            if (mon.dmg >= mon.hp && await UI.confirm(`${T(mon.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`)) await Engine.killMonster(mon);
          }
        }
        UI.render();
        if (kind === 'attack' && weapon && CE.isSpell(weapon) && CE.spellBack) await CE.spellBack(ivIdx, weapon, G.monsters.includes(mon) ? mon : null);
        CE._lastRoll = { inv: ivIdx, succ: succ(), pass: need != null ? succ() >= need : null };
        res(succ());
      };
    };
    draw();
  });
};

// ============================================================
//  訊息視窗：有檢定（技能圖示＋數字）時加一個「擲骰」按鈕
// ============================================================
(function () {
  const orig = UI.message;
  UI.message = function (o) {
    const p = orig.call(UI, o);
    try {
      const text = o.text || '';
      const sk = CE.parseSkill(text), need = CE.parseNeed(text), neg = need == null ? CE.parseNegate(text) : null;
      if (sk && (need != null || neg) && OFF.layer) {
        const f = o.fsm || {};
        const kindMap = { invattack: 'attack', evade: 'evade', horror: 'horror', attack: 'monsterAttack' };
        const kind = kindMap[f.kind] || 'test';
        const wt = kind === 'attack' ? ((f.state || '').match(/^(HEAVY|BLADED|FIREARM|SPELL|UNARMED)/) || [])[1] : null;
        const L = OFF.layer, anchor = L.querySelector('.tap, .twobtn, .col');
        const b = document.createElement('div');
        b.className = 'dice plate oldnews rollPlate'; b.textContent = '擲骰';
        const area = (CE.whoIn ? CE.whoIn(text) : null) || (CE._area && f && CE._area.fsm === f ? CE._area.w : null);
        const multi = !!area || (/(每位|每名|每個|所有)[^。]*調查員/.test(text) && f.kind !== 'horror'), rolled = new Set();
        const pool0 = () => { const a = (CE._area && o.fsm && CE._area.fsm === o.fsm) ? CE._area.w : area; return a ? a.list : CE.alive(); };
        const top = anchor ? parseFloat(anchor.style.top) || 0 : 0;
        b.style.top = top + 'px';
        L.querySelector('#popup').appendChild(b);
        b.onclick = async () => {
          L.classList.add('hidden');
          CE._lastRoll = null;
          await UI.diceDialog({ only: multi ? pool0().filter(i => !rolled.has(i)) : null, text, skill: neg ? neg.skill : sk, need, negate: neg, kind, weaponType: wt, monster: neg ? null : (f.monster ? f.monster.uid : (o.monster ? o.monster.uid : null)) });
          L.classList.remove('hidden');
          const tap = L.querySelector('.tap');
          if (CE._lastRoll && tap) {
            if (multi) {
              rolled.add(CE._lastRoll.inv);
              const left = pool0().filter(i => !rolled.has(i));
              if (left.length) { b.textContent = `還剩${left.length}人`; return; }
            }
            tap.click();
          }
        };
      }
    } catch (e) { console.error(e); }
    return p;
  };
  const origTpl = Engine.monsterTemplate;
  Engine.monsterTemplate = function (m, kind) { const f = origTpl.call(Engine, m, kind); if (f) f.kind = kind; return f; };
  // 調查員階段開始：重設行動
  const origStart = Engine.startInvestigatorPhase;
  Engine.startInvestigatorPhase = function (first) { origStart.call(Engine, first); if (G.phase === 'investigator') { CE.resetTurns(); UI.render(); } };
  // 存檔 / 讀檔：記住目前輪到誰
  const origSave = Engine.save;
  Engine.save = function () {
    origSave.call(Engine);
    try { const d = JSON.parse(localStorage.getItem('mom2_save')); d.active = G.active; d.ce = G.ce || {}; localStorage.setItem('mom2_save', JSON.stringify(d)); } catch (e) { }
  };
  const origRestore = Engine.restore;
  Engine.restore = function (d) { const r = origRestore.call(Engine, d); G.active = d.active ?? null; G.ce = d.ce || {}; G.inv.forEach(CE.ensure); UI.render(); return r; };
  const origNew = Engine.newGame;
  Engine.newGame = function (o) { const r = origNew.call(Engine, o); G.active = null; G.ce = {}; G.inv.forEach(CE.ensure); return r; };
  // 謎題提醒：懷錶、眩暈
  for (const k of ['slide', 'code', 'lock']) {
    const fn = Puzzles[k]; if (!fn) continue;
    Puzzles[k] = function (a, f) {
      const i = CE.defaultInv(), iv = G.inv[i];
      const tips = [];
      if (iv && CE.owned(i).some(it => it.id === 'COMMON_ITEM_POCKET_WATCH')) tips.push(`${iv.name} 持有懷錶：可以多執行 1 個謎題步驟`);
      if (iv && CE.has(iv, 'dazed')) tips.push(`${iv.name} 處於眩暈：不能花費線索執行額外的謎題步驟`);
      if (tips.length) setTimeout(() => UI.toast(tips.join('；')), 600);
      return fn.call(Puzzles, a, f);
    };
  }
})();

// ============================================================
//  調查員卡：輪到誰、行動格
// ============================================================
(function () {
  const orig = UI.invCard;
  UI.invCard = function (iv, idx) {
    CE.ensure(iv);
    const d = orig.call(UI, iv, idx);
    const inPhase = G.phase === 'investigator' && !G.gameOver && !iv.removed;
    const act = G.active === idx;
    if (act && inPhase) d.classList.add('active', 'acting');
    if (inPhase && iv.turn.done && !act) d.classList.add('turnDone');
    const head = d.querySelector('.invHead');
    const img = head.querySelector('img');
    img.style.cursor = 'pointer'; img.title = '點一下：換這位調查員行動';
    img.onclick = () => { if (G.phase === 'investigator') CE.setActive(idx); };
    if (inPhase) {
      const max = CE.maxActs(iv), used = iv.turn.acts;
      const bar = document.createElement('div');
      bar.className = 'turnBar';
      const st = act ? '行動中' : iv.turn.done ? '已行動' : '等待中';
      const why = CE.canMove(idx);
      bar.innerHTML = `<span class="tst ${act ? 'on' : ''}">${st}</span>
        <span class="pips">${Array.from({ length: max }, (_, k) => `<i class="${k < used ? 'used' : ''}"></i>`).join('')}</span>
        ${act ? `<button class="tbtn" data-t="move" ${why || used >= max ? 'disabled' : ''} title="${esc(why || '移動 1 次（最多 2 格）')}">移動</button><button class="tbtn" data-t="other" ${used >= max ? 'disabled' : ''} title="搜索、攻擊、交換物品等">其他行動</button><button class="tbtn end" data-t="end">結束回合</button>` : `<button class="tbtn" data-t="go">${iv.turn.done ? '補做' : '換他'}</button>`}`;
      head.after(bar);
      bar.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
        const t = b.dataset.t;
        if (t === 'move' || t === 'other') CE.spend(idx, t);
        if (t === 'end') CE.endTurn(idx);
        if (t === 'go') CE.setActive(idx);
      });
    }
    // 物品小圖示：獨特物品綠框、翻面
    d.querySelectorAll('[data-item]').forEach(el => {
      const it = G.items.find(x => x.id === el.dataset.item); if (!it) return;
      const f = CE.face(it);
      if (it.type === 2) el.classList.add('uniq');
      if (f && f.flipped) { el.classList.add('flipped'); el.lastChild.textContent = f.name; }
      if (f && f.dmg) el.insertAdjacentHTML('beforeend', `<span class="wd">${f.dmg}</span>`);
    });
    return d;
  };
  UI.itemText = function (id) { const f = CE.face(G.items.find(x => x.id === id) || id); return f ? f.text : ''; };
})();

// ============================================================
//  物品詳細頁
// ============================================================
UI.itemDetail = function (it) {
  if (!it) return;
  const fsm = it.node && G.fsmByObj[it.node];
  const acts = [];
  if (fsm && fsm.hasHandler('ACTIVATE_ITEM')) acts.push({ label: '檢視／使用', ev: 'ACTIVATE_ITEM' });
  it.interactions.forEach(x => acts.push(x));
  const f = CE.face(it) || {};
  const sp = CARDS.spells[it.id];
  const canUse = f.act && it.owner != null;
  const typeName = it.type === 2 ? '獨特物品' : sp ? '法術' : '普通物品';
  UI.openDialog(`<h3 class="dlgTitle">${esc(f.flipped ? f.name : T(it.name))}</h3>
    <div class="cardView ${it.type === 2 ? 'uniq' : sp ? 'spell' : ''}">
      <img src="img/items/${it.img}.png">
      <div class="cvBody">
        <div class="cvCat">${esc(typeName)}${f.cat ? '　·　' + esc(f.cat) : ''}${f.flipped ? '　·　<b>已翻面</b>' : ''}</div>
        ${f.w ? `<div class="cvW">${f.w === 'melee' ? '近戰' : '遠程'}武器　<span class="wdBig">${f.dmg}</span> 武器傷害</div>` : ''}
        <div class="cvText">${fmt((f.text || '').replace(/🔍/g, '').replace(/★/g, ''))}</div>
        ${f.flipped && f.base ? `<div class="small" style="margin-top:6px">正面：${esc(f.base.text)}</div>` : ''}
        ${sp ? `<div class="small" style="margin-top:6px">背面有 5 種隨機結果，施法時抽一張。</div>` : ''}
        <div class="small" style="margin-top:6px">持有者：${it.owner == null ? '物品堆' : esc(G.inv[it.owner].name)}</div>
      </div>
    </div>
    <div class="row">交給：<select id="giveSel"><option value="-1">物品堆</option>${G.inv.map((iv, i) => `<option value="${i}" ${it.owner === i ? 'selected' : ''}>${esc(iv.name)}</option>`).join('')}</select></div>
    <div class="btns">${canUse ? `<button class="btn primary" id="itUse">使用（花 1 行動）</button>` : ''}${f.flipped && f.bound && it.owner != null ? `<button class="btn primary" id="itEsc">嘗試掙脫（花 1 行動）</button>` : ''}${acts.map((x, i) => `<button class="btn primary" data-act="${i}">${esc(x.label)}</button>`).join('')}<button class="btn" id="itDrop">丟棄</button><button class="btn" id="itClose">關閉</button></div>`);
  UI.$('#giveSel').onchange = e => { const v = +e.target.value; if (CE.locked(it)) { UI.toast('這張卡不能被丟棄或交易'); e.target.value = it.owner; return; } it.owner = v < 0 ? null : v; UI.render(); };
  UI.$('#itClose').onclick = () => UI.closeDialog();
  UI.$('#itDrop').onclick = async () => { if (CE.locked(it)) { UI.toast('這張卡不能被丟棄或交易'); return; } UI.closeDialog(); if (await UI.confirm('確定丟棄這個物品？')) { CE.discardItem(it); UI.render(); } };
  if (UI.$('#itUse')) UI.$('#itUse').onclick = () => { UI.closeDialog(); CE.useItem(it); };
  if (UI.$('#itEsc')) UI.$('#itEsc').onclick = () => { UI.closeDialog(); CE.escape(it); };
  UI.$('#dialog').querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const x = acts[+b.dataset.act]; UI.closeDialog(); if (fsm) fsm.fire(x.ev); });
};
CE.locked = function (it) { const c = CARDS.items[it.id]; return !!(it.flipped && c && c.flip && c.flip.bound); };

// 選擇目標調查員
CE.chooseInv = function (title, list) {
  return new Promise(res => {
    UI.openDialog(`<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">${list.map(i => `<div class="pick" data-i="${i}"><img src="${G.inv[i].img}"><div>${esc(G.inv[i].name)}</div></div>`).join('')}</div>
      <div class="btns"><button class="btn" id="ciNo">取消</button></div>`);
    UI.$('#dialog').querySelectorAll('[data-i]').forEach(el => el.onclick = () => { UI.closeDialog(); res(+el.dataset.i); });
    UI.$('#ciNo').onclick = () => { UI.closeDialog(); res(null); };
  });
};

// 使用物品（行動）
CE.useItem = async function (it) {
  const idx = it.owner; if (idx == null) return;
  const iv = G.inv[idx], f = CE.face(it), a = f.act; if (!a) return;
  if (G.phase === 'investigator') {
    CE.ensure(iv);
    if (G.active !== idx) CE.setActive(idx, true);
    if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return; }
  }
  const others = CE.alive().filter(j => j !== idx);
  let target = idx;
  if (a.otherInRange) { if (!others.length) { UI.toast('沒有其他調查員'); return; } target = await CE.chooseInv('選擇範圍內的另一名調查員', others); if (target == null) return; }
  else if (a.selfOrOther && others.length) { target = await CE.chooseInv('選擇對象（你或範圍內的另一名調查員）', [idx, ...others]); if (target == null) return; }
  const tv = G.inv[target];
  // 需要檢定的（手銬、繩子）
  if (a.test) {
    const n = await UI.diceDialog({ inv: idx, skill: a.test.skill, need: a.test.need, kind: 'test', text: f.text.replace(/［力量］/, '').replace(/［敏捷］/, '').replace(/［觀察］/, ''), useResult: true });
    CE.spend(idx, 'other');
    if (n < a.test.need) { await Engine.say({ text: `檢定失敗，沒有成功使用【${T(it.name)}】。` }); UI.render(); return; }
    if (a.flip === 'bind') {
      const tgt = others.length ? await CE.chooseInv('把卡片翻面，交給同格的哪一位調查員？', others) : null;
      if (tgt == null) { UI.render(); return; }
      it.flipped = true; it.owner = tgt;
      await Engine.say({ text: `${G.inv[tgt].name} 被${T(it.name)}困住了：\n${CARDS.items[it.id].flip.text}` });
    }
    UI.render(); return;
  }
  if (CE.useSpellFront && CARDS.spells[it.id]) { CE.spend(idx, 'other'); await CE.useSpellFront(it, idx, target); UI.render(); return; }
  if (a.discardDown) { if (a.discardDown.damage) CE.heal(tv, 'damage', a.discardDown.damage, 'down'); if (a.discardDown.horror) CE.heal(tv, 'horror', a.discardDown.horror, 'down'); }
  if (a.discardAny) { if (a.discardAny.damage) CE.heal(tv, 'damage', a.discardAny.damage, 'any'); if (a.discardAny.horror) CE.heal(tv, 'horror', a.discardAny.horror, 'any'); }
  if (a.cond) CE.addCond(tv, a.cond);
  if (a.remind) await Engine.say({ text: a.remind });
  if (a.flip === 'self' || a.flip === 'barricade' || a.flip === 'dynamite') {
    it.flipped = true;
    if (a.flip === 'barricade') { CE.placeToken('barricade', idx); it.owner = null; }
    if (a.flip === 'dynamite') { CE.placeToken('dynamite', idx); it.owner = null; G.ce = G.ce || {}; (G.ce.dynamite = G.ce.dynamite || []).push(it.id); }
    await Engine.say({ text: `【${T(it.name)}】翻面：\n${CARDS.items[it.id].flip.text}` });
  }
  if (a.discardSelf) CE.discardItem(it, '使用');
  Engine.log(`${iv.name} 使用【${T(it.name)}】${target !== idx ? '→ ' + tv.name : ''}`);
  CE.spend(idx, 'other');
  UI.render();
};
CE.placeToken = function (kind, idx) {
  const iv = G.inv[idx];
  G.tokens.push({ id: Date.now() + Math.random(), kind, x: iv.x + 0.3, y: iv.y, item: kind === 'barricade' ? 'COMMON_ITEM_2x4' : kind === 'dynamite' ? 'COMMON_ITEM_DYNAMITE' : null });
  UI.toast('已在你旁邊放上標記，請拖曳到正確的位置');
};

// 實體卡裡有的物品都算進收藏
(function () {
  const orig = Engine.collectionItems;
  Engine.collectionItems = function () {
    const out = orig.call(Engine), have = new Set(out.map(i => i.id));
    for (const id of [...Object.keys(CARDS.items), ...Object.keys(CARDS.spells)]) if (!have.has(id) && DB.items[id] && DB.items[id].type !== 2) out.push(DB.items[id]);
    return out;
  };
})();
// 只顯示擁有的 8 位調查員；狀態只用 5 種
(function () {
  if (typeof CONDITIONS !== 'undefined') { CONDITIONS.length = 0; CONDITIONS.push('集中', '眩暈', '擊昏', '抑制', '受傷', '瘋狂'); }
  const orig = UI.newGameDialog;
  UI.newGameDialog = function () {
    const keep = DB.investigators;
    DB.investigators = keep.filter(iv => CARDS.ownedInvestigators.includes(iv.id));
    try { return orig.call(UI); } finally { DB.investigators = keep; }
  };
})();

// 掙脫手銬／繩子（同格任何調查員都可以做）
CE.escape = async function (it) {
  const b = CARDS.items[it.id].flip.bound;
  const who = await CE.chooseInv('誰來嘗試？（被困的人或同格的調查員）', CE.alive());
  if (who == null) return;
  const sk = b.escape.skill === 'obs' ? '\uf202' : '\uf201';
  const n = await UI.diceDialog({ inv: who, skill: b.escape.skill, need: b.escape.need, text: `嘗試解開【${T(it.name)}】（${sk}；${b.escape.need}）`, useResult: true });
  CE.spend(who, 'other');
  if (n >= b.escape.need) { it.flipped = false; it.owner = null; await Engine.say({ text: `成功掙脫！【${T(it.name)}】翻回正面，放回物品堆。` }); }
  else await Engine.say({ text: '沒有掙脫。' });
  UI.render();
};

// 標記和卡片同步：屏障被移除 → 長木板翻回正面放回物品堆
(function () {
  const orig = UI.render;
  UI.render = function () {
    if (G.items) for (const it of G.items) {
      if (it.id === 'COMMON_ITEM_2x4' && it.flipped && !G.tokens.some(t => t.item === it.id)) { it.flipped = false; it.owner = null; Engine.log('屏障被移開，長木板翻回正面'); }
    }
    return orig.apply(UI, arguments);
  };
  if (typeof TOKEN_TYPES !== 'undefined' && !TOKEN_TYPES.some(t => t.kind === 'dynamite')) TOKEN_TYPES.push({ kind: 'dynamite', name: '點燃的炸藥', img: 'img/items/CommonItem_Dynamite.png', size: .34 });
  // 調查員階段結束：炸藥爆炸
  const origEnd = Engine.endInvestigatorPhase;
  Engine.endInvestigatorPhase = async function () {
    if (G.phase === 'investigator' && !G.gameOver) {
      const dyn = G.tokens.filter(t => t.kind === 'dynamite');
      for (const t of dyn) {
        await Engine.say({ title: '炸藥爆炸！', text: '在炸藥所在的格子和所有相鄰格子中：\n・每個調查員受到 8 點傷害\n・每個怪物受到 10 點傷害\n\n請在左右欄和怪物列記錄傷害。' });
        G.tokens.splice(G.tokens.indexOf(t), 1);
        const it = G.items.find(x => x.id === t.item); if (it) CE.discardItem(it, '爆炸');
      }
      if (dyn.length) UI.render();
    }
    return origEnd.apply(Engine, arguments);
  };
})();
