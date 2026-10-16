// ============================================================
//  第 2 階段：傷害／恐怖牌堆、受傷／瘋狂／消滅、瘋狂卡
//  iv.cards = [{t:'damage'|'horror', c:卡片編號, up:是否面朝上}]
//  牌堆存在 G.ce.decks（會跟著存檔）
// ============================================================
(function () {
  const DEF = { damage: CARDS.damage, horror: CARDS.horror };
  const NAME = { damage: '傷害', horror: '恐怖' };

  // ---------- 疊在最上層的卡片視窗 ----------
  CE.layer = function (html, cls) {
    let L = document.getElementById('cardLayer');
    if (!L) { L = document.createElement('div'); L.id = 'cardLayer'; document.body.appendChild(L); }
    const box = document.createElement('div');
    box.className = 'clBox ' + (cls || '');
    box.innerHTML = html;
    L.appendChild(box); L.classList.add('on');
    return { box, close() { box.remove(); if (!L.children.length) L.classList.remove('on'); } };
  };
  CE.alert = function (title, text, btn) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="msg">${fmt(text)}</div><div class="btns"><button class="btn primary">${esc(btn || '知道了')}</button></div>`);
      w.box.querySelector('button').onclick = () => { w.close(); res(); };
    });
  };
  CE.ask = function (title, text, yes, no) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="msg">${fmt(text)}</div><div class="btns"><button class="btn" data-v="0">${esc(no || '否')}</button><button class="btn primary" data-v="1">${esc(yes || '是')}</button></div>`);
      w.box.querySelectorAll('button').forEach(b => b.onclick = () => { w.close(); res(b.dataset.v === '1'); });
    });
  };

  // ---------- 牌堆 ----------
  CE.decks = function () {
    G.ce = G.ce || {};
    if (!G.ce.decks) G.ce.decks = { damage: [], horror: [], dmgDisc: [], horDisc: [] };
    return G.ce.decks;
  };
  CE.buildDeck = function (type) {
    const out = [];
    DEF[type].forEach((c, i) => { for (let k = 0; k < c.n; k++) out.push(i); });
    // 扣掉調查員手上已有的
    const held = {}; G.inv.forEach(iv => (iv.cards || []).filter(x => x.t === type).forEach(x => held[x.c] = (held[x.c] || 0) + 1));
    for (const [c, n] of Object.entries(held)) for (let k = 0; k < n; k++) { const j = out.indexOf(+c); if (j >= 0) out.splice(j, 1); }
    return shuffle(out);
  };
  CE.draw = function (type) {
    const D = CE.decks();
    if (!D[type].length) { D[type] = CE.buildDeck(type); if (D[type].length < 40) UI.toast(`${NAME[type]}牌堆用完，重新洗牌`); }
    return D[type].pop();
  };
  CE.cardsOf = (iv, type, up) => (iv.cards || []).filter(x => x.t === type && (up == null || x.up === up));
  CE.sync = function (iv) {
    iv.cards = iv.cards || [];
    iv.dmg = CE.cardsOf(iv, 'damage', false).length; iv.dmgUp = CE.cardsOf(iv, 'damage', true).length;
    iv.hor = CE.cardsOf(iv, 'horror', false).length; iv.horUp = CE.cardsOf(iv, 'horror', true).length;
  };
  CE.total = (iv, type) => CE.cardsOf(iv, type).length;
  CE.removeCard = function (iv, card) { const i = iv.cards.indexOf(card); if (i >= 0) iv.cards.splice(i, 1); CE.sync(iv); };

  // 卡面 HTML
  CE.cardHtml = function (type, c, extra) {
    const d = DEF[type][c];
    const mode = { imm: '立即結算', disc: '立即結算', up: '面朝上放置' }[d.mode];
    return `<div class="dhCard ${type}">
      <div class="dhName">${esc(d.name)}</div>
      <div class="dhFlavor">${esc(d.flavor || '')}</div>
      <div class="dhMode">${mode}</div>
      <div class="dhText">${fmt(d.text)}</div>${extra || ''}</div>`;
  };
  CE.showCard = function (iv, type, c, note) {
    return new Promise(res => {
      const w = CE.layer(`<div class="small" style="text-align:center;margin-bottom:6px">${esc(iv.name)} 抽到一張${NAME[type]}卡${note ? '（' + esc(note) + '）' : ''}</div>
        ${CE.cardHtml(type, c)}<div class="btns"><button class="btn primary">結算</button></div>`, 'cardShow');
      w.box.querySelector('button').onclick = () => { w.close(); res(); };
    });
  };

  // ---------- 受到傷害／恐怖 ----------
  CE.suffer = async function (iv, type, n, down) {
    if (!iv || !n) return;
    iv.cards = iv.cards || [];
    Engine.log(`${iv.name} 受到 ${n} 點${down ? '面朝下的' : ''}${NAME[type]}`);
    for (let k = 0; k < n; k++) {
      if (iv.removed) break;
      const c = CE.draw(type);
      if (c == null) break;
      if (down) { iv.cards.push({ t: type, c, up: false }); CE.sync(iv); }
      else await CE.resolveCard(iv, type, c, null);
      UI.render();
      await CE.checkLimit(iv, type);
    }
    CE.sync(iv); UI.render();
  };
  // 結算一張面朝上的卡（新抽到的，或從面朝下翻上來的 card 物件）
  CE.resolveCard = async function (iv, type, c, existing, note) {
    const d = DEF[type][c];
    await CE.showCard(iv, type, c, note);
    Engine.log(`${iv.name} 的${NAME[type]}卡：${d.name}`);
    if (d.mode === 'up') {
      if (existing) existing.up = true; else iv.cards.push({ t: type, c, up: true });
      CE.sync(iv);
      await CE.applyEff(iv, d.eff, true);
      return;
    }
    if (d.mode === 'disc') { if (existing) CE.removeCard(iv, existing); CE.sync(iv); }
    else { if (existing) existing.up = false; else iv.cards.push({ t: type, c, up: false }); CE.sync(iv); }
    await CE.applyEff(iv, d.eff, false);
  };
  CE.applyEff = async function (iv, e, persistent) {
    if (!e) return;
    const idx = G.inv.indexOf(iv);
    if (e.drop) await CE.dropRandom(idx, e.drop);
    if (e.cond) CE.addCond(iv, e.cond);
    if (e.loseClue) { if (iv.clues > 0) { iv.clues -= Math.min(iv.clues, e.loseClue); Engine.log(`${iv.name} 棄除 ${e.loseClue} 個線索`); } }
    if (e.damage) await CE.suffer(iv, 'damage', e.damage, true);
    if (e.horror) await CE.suffer(iv, 'horror', e.horror, true);
    if (e.perSpell) { const n = CE.owned(idx).filter(it => CE.isSpell(it.id)).length; if (n) await CE.suffer(iv, 'horror', n, true); }
    if (e.flipHorrorUp) for (let k = 0; k < e.flipHorrorUp; k++) await CE.flipUp(iv, 'horror');
    if (e.flipDamageUp) for (let k = 0; k < e.flipDamageUp; k++) await CE.flipUp(iv, 'damage');
    if (e.handLimit) await CE.enforceHandLimit(idx);
    UI.render();
  };
  // 隨機丟棄道具
  CE.dropRandom = async function (idx, n) {
    const iv = G.inv[idx];
    const pool = CE.owned(idx).filter(it => !CE.locked(it));
    const out = [];
    for (let k = 0; k < n && pool.length; k++) { const it = pool.splice(rnd(pool.length), 1)[0]; it.owner = null; out.push(T(it.name)); }
    if (out.length) { Engine.log(`${iv.name} 丟下：${out.join('、')}`); await CE.alert('丟下道具', `${iv.name} 隨機丟下了：${out.join('、')}\n（道具放回物品堆，留在這一格）`); }
    else UI.toast(`${iv.name} 沒有道具可以丟`);
  };
  // 手臂骨折：最多 2 個道具
  CE.handLimit = iv => CE.cardsOf(iv, null).length >= 0 && (iv.cards || []).some(x => x.up && DEF[x.t][x.c].eff.handLimit);
  CE.enforceHandLimit = function (idx) {
    const iv = G.inv[idx];
    const items = CE.owned(idx).filter(it => !CE.locked(it));
    if (items.length <= 2) return Promise.resolve();
    return new Promise(res => {
      const keep = new Set();
      const draw = () => {
        w.box.innerHTML = `<h3 class="dlgTitle">手臂骨折</h3><div class="msg">${esc(iv.name)} 只能保留 2 個道具，請選要留下的 2 個（其他的丟回物品堆）。</div>
          <div class="grid">${items.map(it => `<div class="pick ${keep.has(it) ? 'on' : ''}" data-i="${items.indexOf(it)}"><img src="img/items/${it.img}.png" style="border-radius:0;object-fit:contain"><div>${esc(T(it.name))}</div></div>`).join('')}</div>
          <div class="btns"><button class="btn primary" ${keep.size === 2 ? '' : 'disabled'}>確定</button></div>`;
        w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { const it = items[+el.dataset.i]; if (keep.has(it)) keep.delete(it); else if (keep.size < 2) keep.add(it); draw(); });
        w.box.querySelector('.btn').onclick = () => { items.filter(it => !keep.has(it)).forEach(it => { it.owner = null; Engine.log(`${iv.name} 丟下 ${T(it.name)}（手臂骨折）`); }); w.close(); UI.render(); res(); };
      };
      const w = CE.layer('');
      draw();
    });
  };
  // 把一張面朝下的卡翻到正面（並結算）
  CE.flipUp = async function (iv, type) {
    // 連鎖翻牌（例如【頭暈】翻恐怖卡 →【歇斯底里】翻傷害卡 → 又翻到【頭暈】）：同一串連鎖裡，翻過的卡不再翻第二次，避免無限循環
    const top = !CE._flipChain; if (top) CE._flipChain = new Set();
    try {
      const downs = CE.cardsOf(iv, type, false).filter(c => !CE._flipChain.has(c));
      if (!downs.length || CE._flipChain.size > 12) { UI.toast(`${iv.name} 沒有其他面朝下的${NAME[type]}卡可以翻`); return; }
      const card = downs[rnd(downs.length)];
      CE._flipChain.add(card);
      await CE.resolveCard(iv, type, card.c, card, '從面朝下翻到正面');
    } finally { if (top) CE._flipChain = null; }
  };
  // 把一張面朝上的卡翻到背面
  CE.flipDown = async function (iv, type) {
    const ups = CE.cardsOf(iv, type, true);
    if (!ups.length) { UI.toast(`${iv.name} 沒有面朝上的${NAME[type]}卡`); return; }
    const card = ups.length === 1 ? ups[0] : await CE.pickCard(iv, ups, `選一張${NAME[type]}卡翻到背面`);
    if (card) { card.up = false; CE.sync(iv); Engine.log(`${iv.name} 把【${DEF[type][card.c].name}】翻到背面`); }
  };
  CE.pickCard = function (iv, list, title) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="cardPick">${list.map((x, i) => `<div class="cpItem" data-i="${i}">${x.up ? CE.cardHtml(x.t, x.c) : `<div class="dhCard back ${x.t}"><div class="dhName">面朝下</div></div>`}</div>`).join('')}</div><div class="btns"><button class="btn" id="cpNo">取消</button></div>`);
      w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { w.close(); res(list[+el.dataset.i]); });
      w.box.querySelector('#cpNo').onclick = () => { w.close(); res(null); };
    });
  };
  // 棄除（治療）
  CE.heal = function (iv, type, n, mode) {
    // mode：'down' 只棄面朝下；'any' 先棄面朝下再棄面朝上
    let left = n;
    for (const up of mode === 'any' ? [false, true] : [false]) {
      for (const x of CE.cardsOf(iv, type, up)) { if (!left) break; CE.removeCard(iv, x); left--; }
    }
    CE.sync(iv);
    if (n - left) Engine.log(`${iv.name} 棄除 ${n - left} 張${NAME[type]}卡`);
    return n - left;
  };
  CE.discardChosen = async function (iv, type) {
    const all = CE.cardsOf(iv, type);
    if (!all.length) { UI.toast(`${iv.name} 沒有${NAME[type]}卡`); return; }
    const card = all.length === 1 ? all[0] : await CE.pickCard(iv, all, `選一張要棄除的${NAME[type]}卡`);
    if (card) { CE.removeCard(iv, card); Engine.log(`${iv.name} 棄除一張${NAME[type]}卡`); }
  };

  // ---------- 受傷／瘋狂／消滅 ----------
  CE.checkLimit = async function (iv, type) {
    const max = type === 'damage' ? iv.maxH : iv.maxS;
    const st = type === 'damage' ? 'wounded' : 'insane';
    if (CE.total(iv, type) < max || iv.removed) return;
    if (!CE.has(iv, st)) {
      CE.addCond(iv, st);
      const n = CE.cardsOf(iv, type, false).length;
      CE.cardsOf(iv, type, false).forEach(x => CE.removeCard(iv, x));
      CE.sync(iv); UI.render();
      if (type === 'damage') {
        await CE.alert(`${iv.name} 受傷了`, `傷害已達到生命值 ${max}。\n・進入【受傷】狀態：每輪最多只能移動一次\n・棄除 ${n} 張面朝下的傷害卡（面朝上的保留）\n・之後再受到等同生命值的傷害就會被消滅`);
      } else {
        await CE.alert(`${iv.name} 瘋狂了`, `恐怖已達到神智值 ${max}。\n・進入【瘋狂】狀態，抽一張瘋狂卡（只有你自己看）\n・棄除 ${n} 張面朝下的恐怖卡（面朝上的保留）\n・之後再受到等同神智值的恐怖就會被消滅`);
        await CE.drawInsanity(iv);
      }
      return;
    }
    await CE.eliminate(iv, type);
  };
  CE.eliminate = async function (iv, type) {
    const idx = G.inv.indexOf(iv);
    iv.removed = true;
    // 個人專屬道具（自訂角色的專屬武器、凱特的磁通量穩定器、皮特的杜克）：跟著角色一起移出遊戲
    const PERSONAL = ['UNIQUE_ITEM_AKATOU', 'UNIQUE_ITEM_NICHIRIN_SHINOBU', 'UNIQUE_ITEM_NICHIRIN_TENGEN', 'UNIQUE_ITEM_DUKE_THE_DOG', 'UNIQUE_ITEM_FLUX_STABILIZER'];
    CE.owned(idx).forEach(it => {
      if (PERSONAL.includes(it.id)) { G.items.splice(G.items.indexOf(it), 1); Engine.log(`【${T(it.name)}】跟著 ${iv.name} 一起移出遊戲`); return; }
      if (CE.locked(it)) return;
      if (CE.placeGround) CE.placeGround(it, { x: iv.x, y: iv.y }); else it.owner = null;
    });   // 規則：被消滅時把所有物品丟在自己的格子
    Engine.log(`${iv.name} 被消滅了`);
    G.ce.elim = G.ce.elim || { round: G.round, phase: G.phase };
    UI.render();
    const left = CE.alive().length;
    await CE.alert(`${iv.name} 被消滅了`, `${iv.name} 的${NAME[type]}再次達到上限。\n・把所有物品丟在自己那一格（其他人可以用交換行動撿起；個人專屬道具一起移出遊戲）、移走人偶、不再行動\n` +
      (left ? `・規則：其他調查員必須在[b]下一個調查員階段結束前[/b]完成調查，否則失敗。` : `・所有調查員都被消滅了，遊戲失敗。`));
    if (!left && !G.gameOver) Engine.gameOver(false, null);
  };

  // ---------- 瘋狂卡 ----------
  CE.drawInsanity = async function (iv) {
    const players = G.inv.length;
    const used = G.inv.map(x => x.insanity).filter(x => x != null);
    let pool = CARDS.insanity.map((c, i) => i).filter(i => CARDS.insanity[i].min <= players && !used.includes(i));
    let c = pick(pool);
    if (c != null && CARDS.insanity[c].win === 'notWounded' && CE.has(iv, 'wounded')) { pool = pool.filter(i => i !== c); c = pick(pool); }
    if (c == null) return;
    iv.insanity = c;
    Engine.log(`${iv.name} 抽了一張瘋狂卡（內容保密）`);
    await CE.alert('瘋狂卡', `請讓其他人轉過頭，只有 [b]${iv.name}[/b] 可以看。`, '我是本人，翻開');
    await CE.showInsanity(iv);
  };
  CE.showInsanity = function (iv) {
    const d = CARDS.insanity[iv.insanity];
    return new Promise(res => {
      const w = CE.layer(`<div class="dhCard insanity"><div class="dhName">${esc(d.name)}</div><div class="dhFlavor">${esc(d.flavor)}</div><div class="dhText">${esc(d.text)}</div></div>
        <div class="btns"><button class="btn primary">蓋上</button></div>`, 'cardShow');
      w.box.querySelector('button').onclick = () => { w.close(); res(); };
    });
  };

  // ---------- 面朝上卡片的持續效果 ----------
  CE.cardMinus = function (idx, ctx) {
    const iv = G.inv[idx]; if (!iv) return [];
    return (iv.cards || []).filter(x => x.up && DEF[x.t][x.c].eff.minus === ctx.skill).map(x => ({ label: DEF[x.t][x.c].name, n: -1 }));
  };
  const upEff = (iv, key) => (iv.cards || []).filter(x => x.up && DEF[x.t][x.c].eff[key]);
  // 移動時：大腿骨折
  const origSpend = CE.spend;
  CE.spend = function (i, kind) {
    const ok = origSpend.call(CE, i, kind);
    if (ok && kind === 'move') {
      const iv = G.inv[i];
      if (false) setTimeout(async () => {
        if (await CE.ask('大腿骨折', `${iv.name} 這次移動有沒有超過 1 格？\n（有的話要將一張傷害卡翻到正面）`, '有，超過 1 格', '沒有')) { await CE.flipUp(iv, 'damage'); await CE.checkLimit(iv, 'damage'); UI.render(); }
      }, 50);
    }
    return ok;
  };
  // 回合結束時：妄想症、幽閉恐懼症、黑夜恐懼症、盜竊癖
  CE.onTurnEnd = async function (i) {
    const iv = G.inv[i];
    if (!iv || iv.removed) return;   // 已被消滅的人：恐怖卡效果不再觸發
    for (const x of upEff(iv, 'endTurn')) {
      const k = DEF[x.t][x.c].eff.endTurn, nm = DEF[x.t][x.c].name;
      // 能從地圖算出來的就自動判斷（算不出來才問）
      const me = MAP.posCell(iv);
      const within = n => { if (!me) return null; const d = { [me.id]: 0 }, q = [me.id]; while (q.length) { const c = q.shift(); if (d[c] >= n) continue; for (const x of MAP.moveAdj(c)) if (!(x in d)) { d[x] = d[c] + 1; q.push(x); } } return Object.keys(d).map(Number); };
      const auto = (f, ask) => { try { const v = f(); if (v === true || v === false) { Engine.log(`${iv.name} 的【${nm}】：${ask}→${v ? '是' : '否'}（自動判斷）`); return Promise.resolve(v); } } catch (e) { } return CE.ask(nm, `${iv.name} 的回合結束：${ask}`); };
      const rng3 = () => { const w = within(3); return w ? new Set(w) : null; };
      if (k === 'paranoia' && CE.alive().length > 1 && await auto(() => { const r = rng3(); return r ? CE.alive().some(j => j !== i && r.has((MAP.posCell(G.inv[j]) || {}).id)) : null; }, '範圍內（3 格內）有其他調查員嗎？')) await CE.flipUp(iv, 'horror');
      if (k === 'claustro' && await auto(() => { const r = rng3(); return r ? r.size <= 2 : null; }, '3 格範圍內的格子數量是否少於或等於 2 格？')) await CE.suffer(iv, 'horror', 1, true);
      if (k === 'dark' && await auto(() => me ? [...G.tokens.filter(t => t.kind === 'dark'), ...Object.values(G.nodes).filter(n => n.visible && /Darkness/.test(n.sprite || ''))].some(t => (MAP.cellAt(t.x, t.y) || {}).id === me.id) : null, '你所在的格子有黑暗嗎？')) await CE.suffer(iv, 'horror', 1, true);
      if (k === 'klepto' && CE.alive().length > 1 && await auto(() => me ? CE.alive().some(j => j !== i && (MAP.posCell(G.inv[j]) || {}).id === me.id) : null, '你的格子中有其他調查員嗎？')) {
        const same = CE.alive().filter(j => j !== i && me && (MAP.posCell(G.inv[j]) || {}).id === me.id);
        const cand = same.length ? same : CE.alive().filter(j => j !== i);
        const who = cand.length === 1 ? cand[0] : await CE.chooseInvLayer('從誰手中隨機抽一張道具？', cand);
        if (who != null) { const pool = CE.owned(who).filter(it => !CE.locked(it)); if (pool.length) { const it = pick(pool); it.owner = i; await CE.alert(nm, `${iv.name} 從 ${G.inv[who].name} 手中拿走了【${T(it.name)}】`); } else UI.toast('對方沒有道具'); }
      }
    }
    UI.render();
  };
  CE.chooseInvLayer = function (title, list) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">${list.map(i => `<div class="pick" data-i="${i}"><img src="${G.inv[i].img}"><div>${esc(G.inv[i].name)}</div></div>`).join('')}</div><div class="btns"><button class="btn" id="ciNo">取消</button></div>`);
      w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { w.close(); res(+el.dataset.i); });
      w.box.querySelector('#ciNo').onclick = () => { w.close(); res(null); };
    });
  };
  // 給道具時檢查手臂骨折
  const origRender = UI.render;
  UI.render = function () {
    if (G.inv) G.inv.forEach(iv => { CE.sync(iv); });
    return origRender.apply(UI, arguments);
  };

  // ---------- 調查員卡：傷害／恐怖區 ----------
  const origCard = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = origCard.call(UI, iv, idx);
    const row = d.querySelector('.dmgRow');
    if (row) {
      const part = type => {
        const ups = CE.cardsOf(iv, type, true), downs = CE.cardsOf(iv, type, false).length;
        return `<div class="dhRow ${type}"><span class="dhL">${NAME[type]} <b>${CE.total(iv, type)}</b>/${type === 'damage' ? iv.maxH : iv.maxS}</span>
          ${downs ? `<span class="dhBack" title="面朝下的${NAME[type]}卡">▮×${downs}</span>` : ''}
          ${ups.map(x => `<span class="dhUp" data-cv="${iv.cards.indexOf(x)}" title="${esc(DEF[type][x.c].text)}">${esc(DEF[type][x.c].name)}</span>`).join('')}
          <span class="dhBtns">${downs ? `<button data-h="${type}:flip" title="把一張面朝下的${NAME[type]}卡翻到正面（隨機一張）">▲</button>` : ''}<button data-h="${type}:up" title="受到 1 點${NAME[type]}（抽一張，面朝上結算）">＋</button><button data-h="${type}:down" title="受到 1 點面朝下的${NAME[type]}">▼</button><button data-h="${type}:heal" title="棄除一張${NAME[type]}卡">－</button></span></div>`;
      };
      row.outerHTML = `<div class="dhBox">${part('damage')}${part('horror')}</div>`;
    }
    const box = d.querySelector('.dhBox');
    if (box) {
      box.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => {
        const [type, op] = b.dataset.h.split(':');
        if (op === 'up') await CE.suffer(iv, type, 1, false);
        if (op === 'down') await CE.suffer(iv, type, 1, true);
        if (op === 'heal') await CE.discardChosen(iv, type);
        if (op === 'flip') { await CE.flipUp(iv, type); await CE.checkLimit(iv, type); }
        UI.render();
      });
      box.querySelectorAll('[data-cv]').forEach(el => el.onclick = () => { const x = iv.cards[+el.dataset.cv]; const w = CE.layer(CE.cardHtml(x.t, x.c) + '<div class="btns"><button class="btn">關閉</button></div>', 'cardShow'); w.box.querySelector('button').onclick = () => w.close(); });
    }
    if (iv.insanity != null) {
      const h = d.querySelector('.invHead');
      const el = document.createElement('div'); el.className = 'insChip'; el.textContent = '瘋狂卡（點擊只給本人看）';
      el.onclick = async () => { if (await CE.ask('瘋狂卡', `只有 ${iv.name} 本人可以看，確定翻開嗎？`, '翻開', '取消')) CE.showInsanity(iv); };
      h.after(el);
    }
    if (upEff(iv, 'handLimit').length && CE.owned(idx).filter(it => !CE.locked(it)).length > 2) {
      const wn = document.createElement('div'); wn.className = 'warn'; wn.textContent = '手臂骨折：道具超過 2 個！'; wn.style.cursor = 'pointer';
      wn.onclick = () => CE.enforceHandLimit(idx);
      d.appendChild(wn);
    }
    // 生命／神智大數字改成依卡片計算
    const bigs = d.querySelectorAll('.bigstats .big .v');
    if (bigs.length >= 2) { bigs[0].textContent = iv.maxH - CE.total(iv, 'damage'); bigs[1].textContent = iv.maxS - CE.total(iv, 'horror'); }
    return d;
  };

  // ---------- 訊息裡的「受到 N 點傷害／恐怖」 ----------
  CE.parseHits = function (seg) {
    const hits = [];
    if (!seg) return hits;
    const CN = { '一': 1, '兩': 2, '二': 2, '三': 3, '四': 4 };
    const fre = /將\s*(\d+|一|兩|二|三|四)\s*張(?:面朝下的)?(傷害|恐怖)卡\s*翻(?:到|至|為|成)?\s*(?:正面|面朝上|朝上|面)(?!朝下)/g;
    let x;
    while ((x = fre.exec(seg))) hits.push({ at: x.index, type: x[2] === '傷害' ? 'damage' : 'horror', n: +x[1] || CN[x[1]] || 1, flip: 'up' });
    const re = /(\d+)\s*(點|張)([^，。；！？\d（(]*?)(傷害|恐怖|恐懼)(?!卡)/g;
    while ((x = re.exec(seg))) {
      const pre = seg.slice(Math.max(0, x.index - 14), x.index);
      if (/至少|超過|少於|多於|等於/.test(seg.slice(Math.max(0, x.index - 3), x.index))) continue;
      if (!/(受到|獲得|承受)/.test(pre) && !/和$/.test(pre)) continue;
      { const cs = Math.max(seg.lastIndexOf('；', x.index), seg.lastIndexOf('。', x.index), seg.lastIndexOf(';', x.index)) + 1;
        const clause = seg.slice(cs, x.index);
        if (/等同/.test(clause) || /(怪物|敵人|生物|對手|它|牠|怪獸)[^，,]*?受到/.test(clause)) continue; }
      hits.push({ at: x.index, type: x[4] === '傷害' ? 'damage' : 'horror', n: +x[1], down: /朝下/.test(x[3]) });
    }
    hits.sort((a, b) => a.at - b.at);
    hits.forEach(h => delete h.at);
    return hits;
  };
  CE.applyHits = async function (iv, hits) {
    for (const h of hits) {
      if (!h.left && h.left !== undefined) continue;
      const n = h.left !== undefined ? h.left : h.n;
      if (h.flip === 'up') {
        // 只翻自己有的面朝下卡；不夠就有幾張翻幾張，沒有就不用翻
        const k2 = Math.min(n, CE.cardsOf(iv, h.type, false).length);
        if (!k2) { Engine.log(`${iv.name} 沒有面朝下的${NAME[h.type]}卡，不用翻`); continue; }
        for (let k = 0; k < k2; k++) await CE.flipUp(iv, h.type);
        await CE.checkLimit(iv, h.type);
      }
      else await CE.suffer(iv, h.type, n, h.down);
    }
    UI.render();
  };
  // 套用視窗：選調查員（可多選）
  CE.hitDialog = function (text, hits) {
    return new Promise(res => {
      const chosen = new Set([CE.defaultInv()]);
      const w = CE.layer('');
      const draw = () => {
        w.box.innerHTML = `<h3 class="dlgTitle">套用傷害／恐怖</h3><div class="msg" style="font-size:14px">${fmt(text)}</div>
          <div class="lbl" style="font-size:14px">誰受到？（可多選）</div>
          <div class="grid">${CE.alive().map(i => `<div class="pick ${chosen.has(i) ? 'on' : ''}" data-i="${i}"><img src="${G.inv[i].img}"><div>${esc(G.inv[i].name)}</div></div>`).join('')}</div>
          <div class="dealt">${hits.map((h, i) => `<span>${h.flip ? `將${NAME[h.type]}卡翻到正面` : `${NAME[h.type]}${h.down ? '（面朝下）' : '（面朝上）'}`}</span><button class="btn small" data-hm="${i}">−</button><b class="dv">${h.n}</b><button class="btn small" data-hp="${i}">＋</button>${h.flip ? '' : `<button class="btn small" data-hd="${i}">${h.down ? '改面朝上' : '改面朝下'}</button>`}`).join('<br style="flex-basis:100%">')}</div>
          <div class="btns"><button class="btn" id="hdNo">取消</button><button class="btn primary" id="hdOk" ${chosen.size ? '' : 'disabled'}>套用</button></div>`;
        w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { const i = +el.dataset.i; chosen.has(i) ? chosen.delete(i) : chosen.add(i); draw(); });
        w.box.querySelectorAll('[data-hm]').forEach(b => b.onclick = () => { const h = hits[+b.dataset.hm]; h.n = Math.max(0, h.n - 1); draw(); });
        w.box.querySelectorAll('[data-hp]').forEach(b => b.onclick = () => { hits[+b.dataset.hp].n++; draw(); });
        w.box.querySelectorAll('[data-hd]').forEach(b => b.onclick = () => { const h = hits[+b.dataset.hd]; h.down = !h.down; draw(); });
        w.box.querySelector('#hdNo').onclick = () => { w.close(); res(false); };
        w.box.querySelector('#hdOk').onclick = async () => { w.close(); for (const i of chosen) await CE.applyHits(G.inv[i], hits.map(h => Object.assign({}, h))); res(true); };
      };
      draw();
    });
  };
  // 官方訊息視窗：沒有檢定、但有「受到 N 點…」→ 加一個「套用」按鈕
  const origMsg = UI.message;
  UI.message = function (o) {
    const p = origMsg.call(UI, o);
    try {
      const text = o.text || '';
      const hasTest = CE.parseNeed(text) != null || CE.parseNegate(text);
      const hits = hasTest ? [] : CE.parseHits(text);
      if (hits.length && OFF.layer && !OFF.layer.querySelector('.rollPlate') && G.inv && G.inv.length) {
        const L = OFF.layer, anchor = L.querySelector('.tap, .twobtn, .col');
        const b = document.createElement('div');
        b.className = 'dice plate oldnews rollPlate applyPlate'; b.textContent = '套用';
        b.style.top = (anchor ? parseFloat(anchor.style.top) || 0 : 0) + 'px';
        L.querySelector('#popup').appendChild(b);
        b.onclick = async () => { L.classList.add('hidden'); const ok = await CE.hitDialog(text, hits.map(h => Object.assign({}, h))); L.classList.remove('hidden'); if (ok) { b.textContent = '已套用'; b.classList.add('done'); } };
      }
    } catch (e) { console.error(e); }
    return p;
  };

  // 擲骰視窗：依成功／失敗帶出要套用的結果
  const origDice = UI.diceDialog;
  UI.diceDialog = function (opts = {}) {
    if (opts.negate || !opts.text || opts.noOutcome) return origDice.call(UI, opts);
    const need = opts.need ?? CE.parseNeed(opts.text);
    if (need == null) return origDice.call(UI, opts);
    const t = opts.text;
    const iOk = t.indexOf('如果檢定成功'), iNg = t.indexOf('如果檢定失敗');
    const okSeg = iOk >= 0 ? t.slice(iOk, iNg > iOk ? iNg : undefined) : '';
    const ngSeg = iNg >= 0 ? t.slice(iNg, iOk > iNg ? iOk : undefined) : '';
    const okH = CE.parseHits(okSeg), ngH = CE.parseHits(ngSeg);
    if (!okH.length && !ngH.length) return origDice.call(UI, opts);
    return origDice.call(UI, Object.assign({}, opts, { outcome: { ok: okH, ng: ngH } }));
  };

  // 存讀檔 / 新遊戲
  const origNew = Engine.newGame;
  Engine.newGame = function (o) { const r = origNew.call(Engine, o); G.inv.forEach(iv => { iv.cards = iv.cards || []; CE.sync(iv); }); CE.decks(); return r; };

  // 調查員階段結束：檢查消滅期限
  const origEnd = Engine.endInvestigatorPhase;
  Engine.endInvestigatorPhase = async function () {
    if (G.phase === 'investigator' && G.ce && G.ce.elim && !G.gameOver) {
      const e = G.ce.elim;
      const due = (e.phase === 'investigator' && G.round > e.round) || (e.phase !== 'investigator' && G.round > e.round);
      if (due && CE.alive().length && await CE.ask('調查失敗？', `有調查員被消滅後，規則要求在下一個調查員階段結束前完成調查。\n現在這個期限到了，要判定調查失敗嗎？`, '判定失敗', '還不要')) { Engine.gameOver(false, null); return; }
    }
    return origEnd.apply(Engine, arguments);
  };

  // 遊戲結束：瘋狂卡的個人勝負
  const origOver = UI.gameOver;
  UI.gameOver = async function (victory, cut) {
    const list = G.inv.filter(iv => iv.insanity != null);
    if (list.length) {
      let s = '';
      for (const iv of list) {
        const d = CARDS.insanity[iv.insanity], idx = G.inv.indexOf(iv);
        let r = null;
        switch (d.win) {
          case 'evidence2': r = victory && CE.owned(idx).filter(it => ((CE.face(it) || {}).cat || '').includes('證據')).length >= 2; break;
          case 'noSearch': r = victory && !Object.values(G.nodes).some(n => n.visible && /^(SEARCH|SERACH)/.test(nodeTag(n.id))); break;
          case 'notWounded': r = victory && !CE.has(iv, 'wounded'); break;
          case 'otherBroken': r = victory && G.inv.some(o => o !== iv && (CE.has(o, 'wounded') || CE.has(o, 'insane'))); break;
          case 'eliminated': r = victory && iv.removed; break;
          case 'notComplete': r = !victory; break;
          case 'items6': r = CE.owned(idx).length >= 6; break;
          case 'fire6': case 'blade': r = false; break;
          case 'ask': r = victory && !!iv._ask; break;
          default: r = victory;
        }
        s += `[b]${iv.name}[/b]（瘋狂卡：${d.name}）：${r ? '[9be38a]個人獲勝[-]' : '[ff9b8f]個人失敗[-]'}\n${d.text}\n\n`;   // 用文字框支援的標記（不能用 HTML，會直接顯示出來）
      }
      await CE.alert('瘋狂調查員的個人結果', s.trim());
    }
    return origOver.apply(UI, arguments);
  };
  // 回合開始：縱火狂、千分之一 的立即獲勝
  const origTS = CE.turnStart;
  CE.turnStart = async function (i) {
    const iv = G.inv[i];
    if (iv && iv.insanity != null && !iv.turn.started) {
      const d = CARDS.insanity[iv.insanity];
      if (d.win === 'fire6' || d.win === 'blade') {
        // 能自動判斷就自動判斷：條件不成立就不用問
        let met = null;
        try {
          if (d.win === 'fire6') {
            const cells = new Set([...G.tokens.filter(t => t.kind === 'fire'), ...Object.values(G.nodes).filter(n => n.visible && /Feature_Fire/.test(n.sprite || ''))].map(t => (MAP.cellAt(t.x, t.y) || {}).id).filter(x => x != null));
            met = cells.size >= 6;
          } else {
            const me = MAP.posCell(iv), blade = CE.owned(i).some(it => CE.weaponMatches(it, 'BLADED'));
            const others = me ? CE.alive().filter(j => j !== i && (MAP.posCell(G.inv[j]) || {}).id === me.id).length : 0;
            met = blade && others === 1;
          }
        } catch (e) { met = null; }
        const q = d.win === 'fire6' ? '有 6 個或以上的房間有火焰嗎？' : '你持有銳器，而且你的格子中只有一名其他調查員嗎？';
        const yes = met === null ? await CE.ask(`${iv.name} 的回合開始（只有本人看）`, `（${d.name}）${q}\n如果是，你立刻獲勝，遊戲結束。`, '是', '否') : met;
        if (yes) { await CE.alert(d.name, `${iv.name} 的瘋狂卡條件達成，${iv.name} 獲勝，遊戲結束。其他調查員失敗。`); Engine.gameOver(false, null); return; }
      }
    }
    return origTS.call(CE, i);
  };
})();
