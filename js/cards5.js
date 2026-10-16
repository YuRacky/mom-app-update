// ============================================================
//  規則補強：躲避時機、火焰、黑暗、秘密通道、屏障、牌堆洗回、
//  特殊行動（推、偷、交換、放火、滅火、移屏障）、調查員能力
// ============================================================
(function () {
  const cellOf = o => MAP.posCell(o);
  const invC = i => cellOf(G.inv[i]);
  const sameCell = (a, b) => a && b && a.id === b.id;
  const fireCells = () => [...G.tokens.filter(t => t.kind === 'fire'), ...Object.values(G.nodes).filter(n => n.visible && /Feature_Fire/.test(n.sprite || ''))].map(t => MAP.cellAt(t.x, t.y)).filter(Boolean);
  const darkCells = () => [...G.tokens.filter(t => t.kind === 'dark'), ...Object.values(G.nodes).filter(n => n.visible && /Darkness/.test(n.sprite || ''))].map(t => MAP.cellAt(t.x, t.y)).filter(Boolean);
  CE.hasFire = c => !!c && fireCells().some(x => x.id === c.id);
  const isLight = it => /光源/.test((CE.face(it) || {}).cat || '');
  // 規則的「相鄰」：共用邊界、門、不可通過的邊界或牆
  const touching = c => MAP.build().cells.filter(x => x.id !== c.id && Math.abs(Math.hypot(x.x - c.x, x.y - c.y) - 1) < 0.15);

  // ---------- 1. 牌堆：棄除的卡立刻洗回（等同每次從「所有不在手上的卡」隨機抽） ----------
  CE.draw = function (type) { const d = CE.buildDeck(type); return d.length ? d[rnd(d.length)] : null; };

  // ---------- 2. 黑暗：不能花線索 ----------
  CE.lightAt = function (c) {
    if (!c) return false;
    const area = [c, ...touching(c)];
    const ids = new Set(area.map(x => x.id));
    if (fireCells().some(x => ids.has(x.id))) return true;
    return CE.alive().some(j => { const jc = invC(j); return jc && ids.has(jc.id) && CE.owned(j).some(isLight); });
  };
  CE.inDarkness = function (idx) { const c = invC(idx); if (!c) return false; return darkCells().some(x => x.id === c.id) && !CE.lightAt(c); };
  const origNoClue = CE.noClue;
  CE.noClue = (iv, idx) => origNoClue(iv, idx) || CE.inDarkness(idx);
  CE.noClueWhy = (iv, idx) => CE.has(iv, 'dazed') ? '眩暈' : CE.bound(idx).some(b => b.noClue) ? '被手銬銬住' : CE.inDarkness(idx) ? '身處黑暗（附近沒有光源或火焰）' : '';

  // ---------- 3. 秘密通道、屏障擋門 ----------
  const origBuild = MAP.build;
  MAP.build = function () {
    const g = origBuild.call(MAP);
    if (g._ext) return g;
    g._ext = true;   // 先標記，避免下面找格子時又重算（會無限迴圈）
    const sec = Object.values(G.nodes).filter(n => n.visible && /Secret|TrapDoor/.test(n.sprite || '')).map(n => MAP.cellAt(n.x, n.y)).filter(Boolean);   // 秘密通道、地板暗道：有這個標記的格子彼此相鄰
    const uniq = [...new Map(sec.map(c => [c.id, c])).values()];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) {
      const a = uniq[i].id, b = uniq[j].id;
      if (!g.adj[a].some(e => e.to === b)) { g.adj[a].push({ to: b, type: 'secret' }); g.adj[b].push({ to: a, type: 'secret' }); }
    }
    g._ext = true; return g;
  };
  MAP.moveAdj = function (id) {
    const g = MAP.build(), a = g.cells[id];
    const bars = [...G.tokens.filter(t => t.kind === 'barricade'), ...Object.values(G.nodes).filter(n => n.visible && /Barricade/.test(n.sprite || ''))];
    return g.adj[id].filter(e => {
      if (!['open', 'door', 'secret'].includes(e.type)) return false;
      if (e.type === 'open') return true;
      const b = g.cells[e.to];
      if (e.type === 'door') { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; return !bars.some(t => Math.hypot(t.x - mx, t.y - my) < 0.35); }
      return !bars.some(t => { const tc = MAP.cellAt(t.x, t.y); return tc && (tc.id === a.id || tc.id === b.id); });
    }).map(e => e.to);
  };

  // ---------- 4. 躲避時機 + 火焰傷害（行動時） ----------
  CE.monsterHere = function (idx) {
    const c = invC(idx); if (!c) return null;
    const list = G.monsters.filter(m => sameCell(cellOf(m), c));
    if (!list.length) return null;
    return list.sort((a, b) => (CE.monStat(b).aw || 0) - (CE.monStat(a).aw || 0))[0];
  };
  // 執行一個行動：kind = 'move' | 'other' | 'attack'；body = 真正要做的事（可省略）
  CE.doAction = async function (idx, kind, body) {
    const iv = G.inv[idx]; CE.ensure(iv);
    if (G.phase === 'investigator') {
      if (G.active !== idx) CE.setActive(idx, true);
      if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return false; }
      if (kind === 'move') { const why = CE.canMove(idx); if (why) { UI.toast(why); return false; } }
    }
    if (!(await CE.evadeFirst(idx, kind))) return false;
    if (!CE.spendRaw(idx, kind)) return false;
    if (kind === 'move' && iv.id === 'INVESTIGATOR_RITA_YOUNG') UI.toast('麗塔的能力：這次移動最多可以走 3 格');
    if (body) await body();
    if (kind !== 'move') await CE.fireAfter(idx);
    UI.render();
    return true;
  };
  // 和怪物同格時先躲避；被取消就回傳 false（仍用掉行動）
  CE.evadeFirst = async function (idx, kind) {
    const iv = G.inv[idx];
    const m = kind !== 'attack' && G.phase === 'investigator' ? CE.monsterHere(idx) : null;
    if (!m) return true;
    await CE.alert('要先躲避', `${iv.name} 和 ${T(m.name)} 在同一格（察覺 ${CE.monStat(m).aw}）。\n${kind === 'move' ? '要離開這一格' : '要做攻擊和移動以外的行動'}，必須先對它做躲避檢定。`, '開始躲避');
    await Engine.runMonsterTemplate(m, 'evade', 'MONSTER/EVADE/START');
    const ok = await CE.ask('躲避結果', `依剛才的結果，${iv.name} 這個行動還能繼續嗎？\n（如果訊息說「行動被取消／強制結束」，請選「被取消」，仍然會用掉 1 個行動）`, '可以繼續', '被取消');
    if (!ok) { CE.spendRaw(idx, kind === 'move' ? 'moveLost' : 'other'); await CE.fireAfter(idx, true); }
    return ok;
  };
  // 使用物品也是行動：先躲避
  const origUse = CE.useItem;
  CE.useItem = async function (it) {
    if (it.owner != null && G.phase === 'investigator') {
      const iv = G.inv[it.owner]; CE.ensure(iv);
      if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return; }
      if (!(await CE.evadeFirst(it.owner, 'other'))) return;
    }
    const idx = it.owner;
    await origUse.call(CE, it);
    if (idx != null && G.phase === 'investigator') await CE.fireAfter(idx);
  };
  // 不經過躲避檢查，直接扣行動
  const origSpend = CE.spend;
  CE.spendRaw = function (idx, kind) {
    if (kind === 'moveLost') { const iv = G.inv[idx]; iv.turn.acts++; Engine.log(`${iv.name} 的移動被取消`); UI.render(); return true; }
    return origSpend.call(CE, idx, kind === 'attack' ? 'other' : kind);
  };
  CE.spend = function (idx, kind) { return CE.spendRaw(idx, kind); };
  CE.fireAfter = async function (idx, forfeit) {
    const iv = G.inv[idx];
    if (CE.hasFire(invC(idx))) { await CE.alert('火焰', `${iv.name} 在有火焰的格子${forfeit ? '失去了行動' : '做了行動'}，受到 1 點面朝下的傷害。`); await CE.suffer(iv, 'damage', 1, true); await CE.checkLimit(iv, 'damage'); }
  };
  // 拖曳人偶：走進火焰受傷；怪物走進火焰受 1 傷害
  const origDrag = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    origDrag.call(UI, el, getObj, onClick);
    const down = el.onpointerdown;
    el.onpointerdown = e => {
      const o = getObj(); const before = o ? cellOf(o) : null;
      down(e);
      const up = el.onpointerup; if (!up) return;
      el.onpointerup = async ev => {
        up(ev);
        if (!o) return;
        const after = cellOf(o);
        if (!after || sameCell(before, after)) return;
        // 走過的每一個有火焰的格子都算（規則：進入有火焰的格子就受傷）
        let n = 0;
        if (before) {
          const prev = { [before.id]: null }, q = [before.id];
          while (q.length) { const c = q.shift(); if (c === after.id) break; for (const x of MAP.moveAdj(c)) if (!(x in prev)) { prev[x] = c; q.push(x); } }
          if (after.id in prev) { for (let c = after.id; c != null && c !== before.id; c = prev[c]) { if (CE.hasFire(MAP.build().cells[c])) n++; } }
          else if (CE.hasFire(after)) n = 1;
        } else if (CE.hasFire(after)) n = 1;
        if (!n) return;
        const i = G.inv.indexOf(o);
        if (i >= 0) { await CE.alert('火焰', `${o.name} 走進了 ${n} 個有火焰的格子，受到 ${n} 點面朝下的傷害。`); await CE.suffer(o, 'damage', n, true); await CE.checkLimit(o, 'damage'); }
        else if (G.monsters.includes(o)) { o.dmg += n; UI.toast(`${T(o.name)} 走進火焰，受到 ${n} 點傷害`); UI.render(); if (o.dmg >= o.hp && await CE.ask('怪物被擊敗？', `${T(o.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`, '擊敗', '還沒')) await Engine.killMonster(o); }
      };
    };
  };
  // 怪物在火焰中開始行動：受 1 傷害
  const origRunT = Engine.runMonsterTemplate;
  Engine.runMonsterTemplate = async function (m, kind, ev) {
    if (kind === 'attack' && G.phase === 'mythos' && CE.hasFire(cellOf(m))) {
      m.dmg++; Engine.log(`${T(m.name)} 在火焰中開始行動，受到 1 點傷害`); UI.toast(`${T(m.name)} 在火焰中，受到 1 點傷害`); UI.render();
      if (m.dmg >= m.hp && await CE.ask('怪物被擊敗？', `${T(m.name)} 被火燒到生命值歸零，確定被擊敗了嗎？`, '擊敗', '還沒')) { await Engine.killMonster(m); return; }
    }
    return origRunT.apply(Engine, arguments);
  };

  // ---------- 5. 調查員卡：行動按鈕改接新流程、加「能力」按鈕 ----------
  const ABIL = { INVESTIGATOR_FATHER_MATEO: '讓範圍內另一人進入集中', INVESTIGATOR_CARSON_SINCLAIR: '讓範圍內另一人多做一個行動' };
  const origCard = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = origCard.call(UI, iv, idx);
    const mv = d.querySelector('.turnBar [data-t="move"]'), ot = d.querySelector('.turnBar [data-t="other"]');
    if (mv) mv.onclick = () => CE.doAction(idx, 'move');
    if (ot) ot.onclick = () => CE.actionMenu(idx);
    if (ABIL[iv.id] && G.phase === 'investigator' && G.active === idx && !iv.removed) {
      const used = CE.usedRound(iv, '__ability');
      const b = document.createElement('button'); b.className = 'tbtn abil'; b.textContent = '能力'; b.title = ABIL[iv.id] + (used ? '（本輪已使用）' : '（花 1 行動，每輪一次）');
      if (used) b.disabled = true;
      b.onclick = () => CE.useAbility(idx);
      const end = d.querySelector('.turnBar .end'); if (end) end.before(b);
    }
    return d;
  };
  // 怪物頁的攻擊：算 1 個行動（不用躲避）
  const origSheet = UI.monsterSheet;
  UI.monsterSheet = function (uid) {
    origSheet.call(UI, uid);
    const a = document.getElementById('mAtk'); if (!a) return;
    const oa = a.onclick;
    a.onclick = async () => {
      if (G.phase === 'investigator') { const i = CE.defaultInv(); if (!(await CE.doAction(i, 'attack'))) return; }
      oa();
    };
  };
  // Carson：額外行動
  const origMax = CE.maxActs;
  CE.maxActs = iv => origMax(iv) + ((iv.turn && iv.turn.bonus) || 0);

  CE.useAbility = async function (idx) {
    const iv = G.inv[idx];
    const others = (CE.invsInRange(idx) || CE.alive().filter(j => j !== idx));
    if (!others.length) { UI.toast('範圍內沒有其他調查員'); return; }
    const t = await CE.chooseInvLayer(`${iv.name} 的能力：選範圍內的另一名調查員`, others);
    if (t == null) return;
    await CE.doAction(idx, 'other', async () => {
      CE.markRound(iv, '__ability');
      const tv = G.inv[t];
      if (iv.id === 'INVESTIGATOR_FATHER_MATEO') { CE.addCond(tv, 'focused'); UI.toast(`${tv.name} 進入集中狀態`); }
      else { CE.ensure(tv); tv.turn.bonus = (tv.turn.bonus || 0) + 1; if (tv.turn.done) tv.turn.done = false; await CE.alert('卡森的能力', `${tv.name} 可以立刻執行一個行動。\n（他的行動格已經多加 1 格，做完後按他的「移動」或「其他行動」記錄）`); }
    });
  };

  // ---------- 6. 「其他行動」選單 ----------
  CE.actionMenu = function (idx) {
    const iv = G.inv[idx];
    const hasLight = CE.owned(idx).some(isLight);
    const L = [
      ['general', '一般行動', '搜索、互動、探索、使用物品等（點地圖上的標記即可）'],
      ['trade', '交換', '同格的人互相給物品、撿起或丟下物品'],
      ['push', '推', '把同格的怪物或調查員推到相鄰的格子（力量檢定）'],
      ['steal', '偷', '和同格的調查員對抗檢定，拿走對方的物品'],
      ['setfire', '放火', hasLight ? '在你這格或相鄰格放一個火焰' : '需要持有光源'],
      ['extinguish', '滅火', '敏捷檢定，每個成功可移除 1 個火焰'],
      ['barricade', '移動屏障', '在同一格移動屏障，或從門的另一側推開（力量檢定）']
    ];
    const w = CE.layer(`<h3 class="dlgTitle">${esc(iv.name)} 要做什麼行動？</h3>
      <div class="actMenu">${L.map(([k, n, d]) => `<div class="am ${k === 'setfire' && !hasLight ? 'off' : ''}" data-k="${k}"><b>${n}</b><span>${esc(d)}</span></div>`).join('')}</div>
      <div class="btns"><button class="btn" id="amNo">取消</button></div>`);
    w.box.querySelector('#amNo').onclick = () => w.close();
    w.box.querySelectorAll('[data-k]').forEach(el => el.onclick = () => {
      const k = el.dataset.k; if (el.classList.contains('off')) return;
      w.close();
      const fn = { general: () => CE.doAction(idx, 'other'), trade: CE.actTrade, push: CE.actPush, steal: CE.actSteal, setfire: CE.actSetFire, extinguish: CE.actExtinguish, barricade: CE.actBarricade }[k];
      fn(idx);
    });
  };
  const here = (idx, withMonsters) => {
    const c = invC(idx);
    const invs = CE.alive().filter(j => j !== idx && (!c || sameCell(invC(j), c)));
    const mons = withMonsters ? G.monsters.filter(m => !c || sameCell(cellOf(m), c)) : [];
    return { invs, mons, known: !!c };
  };
  const pickTarget = (title, invs, mons) => new Promise(res => {
    const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">
      ${invs.map(i => `<div class="pick" data-v="i${i}"><img src="${G.inv[i].img}"><div>${esc(G.inv[i].name)}</div></div>`).join('')}
      ${mons.map(m => `<div class="pick" data-v="m${m.uid}"><img src="img/monsters/${m.img}.png"><div>${esc(T(m.name))}（蠻力 ${CE.monStat(m).brawn ?? '?'}）</div></div>`).join('')}</div>
      <div class="btns"><button class="btn" id="ptNo">取消</button></div>`);
    w.box.querySelectorAll('[data-v]').forEach(el => el.onclick = () => { w.close(); const v = el.dataset.v; res(v[0] === 'i' ? { inv: +v.slice(1) } : { mon: G.monsters.find(m => m.uid === +v.slice(1)) }); });
    w.box.querySelector('#ptNo').onclick = () => { w.close(); res(null); };
  });
  const roll = (idx, skill, text, need) => UI.diceDialog({ inv: idx, skill, need, text, useResult: true, noOutcome: true });

  CE.actTrade = async function (idx) {
    await CE.doAction(idx, 'other', async () => { await CE.alert('交換', '在「物品」視窗或左右欄的物品上，把物品交給同格的人、撿起或丟下。可以做任意多次。'); UI.itemSheet(); });
  };
  CE.actPush = async function (idx) {
    const h = here(idx, true);
    if (h.known && !h.invs.length && !h.mons.length) { UI.toast('你的格子裡沒有可以推的對象'); return; }
    const t = await pickTarget('要推誰？', h.known ? h.invs : CE.alive().filter(j => j !== idx), h.known ? h.mons : G.monsters);
    if (!t) return;
    await CE.doAction(idx, 'other', async () => {
      let need;
      if (t.mon) need = CE.monStat(t.mon).brawn || 1;
      else {
        const tv = G.inv[t.inv];
        if (await CE.ask('推', `${tv.name} 要自願被推，還是抵抗？`, '自願移動', '抵抗')) { await CE.alert('推', `${tv.name} 移動 1 格，然後 ${G.inv[idx].name} 也可以跟著移動 1 格（請拖曳人偶）。`); return; }
        const r = await roll(t.inv, 'str', `${tv.name} 抵抗被推：力量檢定`);
        need = r + 1;
      }
      const n = await roll(idx, 'str', `${G.inv[idx].name} 推${t.mon ? T(t.mon.name) : G.inv[t.inv].name}（；${need}）`, need);
      if (n >= need) await CE.alert('推成功', `${t.mon ? T(t.mon.name) : G.inv[t.inv].name} 移動 1 格，然後 ${G.inv[idx].name} 也可以跟著移動 1 格（請拖曳人偶）。`);
      else await CE.alert('推失敗', '這個行動被取消了。');
    });
  };
  CE.actSteal = async function (idx) {
    const h = here(idx, false);
    const list = h.known ? h.invs : CE.alive().filter(j => j !== idx);
    if (!list.length) { UI.toast('你的格子裡沒有其他調查員'); return; }
    const t = await pickTarget('要偷誰的東西？', list, []); if (!t) return;
    const sk = await new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">用哪個技能對抗？</h3><div class="btns">${['str', 'agi', 'obs'].map(k => `<button class="btn" data-s="${k}">${SKILLS.find(s => s.k === k).zh}</button>`).join('')}</div><div class="btns"><button class="btn" id="skNo">取消</button></div>`);
      w.box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { w.close(); res(b.dataset.s); });
      w.box.querySelector('#skNo').onclick = () => { w.close(); res(null); };
    });
    if (!sk) return;
    await CE.doAction(idx, 'other', async () => {
      const zh = SKILLS.find(s => s.k === sk).zh;
      const a = await roll(idx, sk, `${G.inv[idx].name} 偷東西：${zh}檢定`);
      const b = await roll(t.inv, sk, `${G.inv[t.inv].name} 防守：${zh}檢定`);
      const n = a - b;
      if (n <= 0) { await CE.alert('偷竊失敗', `${a} 對 ${b}，沒有偷到東西，這個行動被取消。`); return; }
      const items = CE.owned(t.inv).filter(it => !CE.locked(it));
      if (!items.length) { await CE.alert('偷竊', '對方沒有可以拿的物品。'); return; }
      const got = await new Promise(res => {
        const on = new Set(); const w = CE.layer('');
        const draw = () => {
          w.box.innerHTML = `<h3 class="dlgTitle">可以拿走 ${n} 件</h3><div class="grid">${items.map((it, i) => `<div class="pick ${on.has(i) ? 'on' : ''}" data-i="${i}"><img src="img/items/${it.img}.png" style="border-radius:0;object-fit:contain"><div>${esc(T(it.name))}</div></div>`).join('')}</div><div class="btns"><button class="btn primary">確定</button></div>`;
          w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { const i = +el.dataset.i; if (on.has(i)) on.delete(i); else if (on.size < n) on.add(i); draw(); });
          w.box.querySelector('.btn').onclick = () => { w.close(); res([...on].map(i => items[i])); };
        };
        draw();
      });
      got.forEach(it => { it.owner = idx; Engine.log(`${G.inv[idx].name} 偷走了 ${T(it.name)}`); });
    });
  };
  CE.actSetFire = async function (idx) {
    await CE.doAction(idx, 'other', async () => {
      if (CE.hasFire(invC(idx)) && !(await CE.ask('放火', '你的格子已經有火焰了，要放在相鄰的格子嗎？', '放相鄰格', '取消'))) return;
      CE.placeToken('fire', idx);
      UI.toast('已放上火焰標記，請拖到你這格或相鄰的格子（同一格不能放兩個火焰）');
    });
  };
  CE.actExtinguish = async function (idx) {
    await CE.doAction(idx, 'other', async () => {
      const n = await roll(idx, 'agi', `${G.inv[idx].name} 滅火：敏捷檢定，每個成功可以移除 1 個火焰`);
      if (!n) { await CE.alert('滅火', '沒有成功，火還在燒。'); return; }
      const c = invC(idx);
      const t = c && G.tokens.find(x => x.kind === 'fire' && sameCell(MAP.cellAt(x.x, x.y), c));
      let left = n;
      if (t) { G.tokens.splice(G.tokens.indexOf(t), 1); left--; }
      await CE.alert('滅火', `${t ? '已移除你這格的火焰。' : ''}${left > 0 ? `還可以移除 ${left} 個：本輪之後走進的有火格子，可以直接把火焰拿掉（不會受傷）。` : ''}`);
    });
  };
  CE.actBarricade = async function (idx) {
    const inSame = await CE.ask('移動屏障', '屏障在你同一格，還是在門的另一側？', '同一格', '門的另一側');
    await CE.doAction(idx, 'other', async () => {
      if (inSame) { await CE.alert('移動屏障', '把屏障移到門或秘密通道前擋住，或從門前移開（請直接拖曳地圖上的屏障標記）。'); return; }
      const n = await roll(idx, 'str', `${G.inv[idx].name} 推開門另一側的屏障（；2）`, 2);
      if (n >= 2) await CE.alert('成功', '把屏障從門前移開，然後你可以穿過這扇門移動 1 格。');
      else await CE.alert('失敗', '屏障沒有被推開。');
    });
  };

  // ---------- 7. 調查員能力 ----------
  const byId = id => G.inv.findIndex(iv => iv.id === id && !iv.removed);
  // 威廉：怪物被擊敗時獲得 1 線索
  const origKill = Engine.killMonster;
  Engine.killMonster = async function (m) {
    const r = await origKill.apply(Engine, arguments);
    const w = byId('INVESTIGATOR_WILLIAM_YORICK');
    if (w >= 0) { G.inv[w].clues++; Engine.log(`${G.inv[w].name} 的能力：獲得 1 線索`); UI.toast(`${G.inv[w].name} 的能力：怪物被擊敗，獲得 1 線索`); UI.render(); }
    return r;
  };
  // 阿加莎：結算恐怖檢定後獲得 1 線索
  const origRunT2 = Engine.runMonsterTemplate;
  Engine.runMonsterTemplate = async function (m, kind) {
    const r = await origRunT2.apply(Engine, arguments);
    if (kind === 'horror') {
      const a = byId('INVESTIGATOR_AGATHA_CRANE');
      const group = CE.horrorGroup || [CE.defaultInv()];
      if (a >= 0 && group.includes(a)) { G.inv[a].clues++; Engine.log(`${G.inv[a].name} 的能力：獲得 1 線索`); UI.toast(`${G.inv[a].name} 的能力：結算恐怖檢定，獲得 1 線索`); UI.render(); }
    }
    return r;
  };
  // 潘明：每輪一次，你或範圍內的另一名調查員重擲 1 顆骰
  const origOpt = CE.optionals;
  CE.optionals = function (idx, ctx) {
    const out = origOpt.call(CE, idx, ctx);
    const p = byId('INVESTIGATOR_MINH_THI_PHAN');
    if (p >= 0) {
      const ok = p === idx || (() => { const r = CE.invsInRange(p); return r == null || r.includes(idx); })();
      if (ok) { const used = CE.usedRound(G.inv[p], '__ability'); out.push({ key: '__minh', label: `${G.inv[p].name} 的能力`, img: G.inv[p].img, text: '重擲 1 顆骰子（先點選要重擲的骰子，每輪一次）', eff: 'rerollOne', cost: {}, disabled: used ? '本輪已使用' : '', onUse: () => CE.markRound(G.inv[p], '__ability') }); }
    }
    return out;
  };
  // 普雷斯頓：每輪一次，獲得物品時（劇情給的「獲得」，不含交換、從地上撿起）可以翻下或棄除一張恐怖卡
  let owners = null;
  const origRender = UI.render;
  UI.render = function () {
    const r = origRender.apply(UI, arguments);
    if (!G.items) return r;
    if (!owners) { owners = {}; G.items.forEach(it => owners[it.id] = { o: it.owner, g: !!it.ground }); return r; }
    const p = byId('INVESTIGATOR_PRESTON_FAIRMONT');
    const newly = [];
    for (const it of G.items) { const pr = owners[it.id]; if (it.owner === p && p >= 0 && (!pr || (pr.o == null && !pr.g))) newly.push(it); owners[it.id] = { o: it.owner, g: !!it.ground }; }
    if (newly.length && !CE._prestonBusy) {
      const pv = G.inv[p];
      const hasH = CE.cardsOf(pv, 'horror').length;
      if (hasH && !CE.usedRound(pv, '__ability')) {
        CE._prestonBusy = true;
        setTimeout(async () => {
          try {
            const ups = CE.cardsOf(pv, 'horror', true).length, downs = CE.cardsOf(pv, 'horror', false).length;
            const w = CE.layer(`<h3 class="dlgTitle">普雷斯頓的能力</h3><div class="msg">${esc(pv.name)} 獲得了【${esc(T(newly[0].name))}】。每輪一次，可以：</div>
              <div class="btns" style="flex-direction:column;align-items:stretch">${ups ? '<button class="btn" data-a="flip">把一張面朝上的恐怖卡翻到背面</button>' : ''}${downs ? '<button class="btn" data-a="disc">棄除一張面朝下的恐怖卡</button>' : ''}<button class="btn" data-a="no">不使用</button></div>`);
            const a = await new Promise(res => w.box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { w.close(); res(b.dataset.a); }));
            if (a === 'flip') { await CE.flipDown(pv, 'horror'); CE.markRound(pv, '__ability'); }
            if (a === 'disc') { CE.heal(pv, 'horror', 1, 'down'); CE.markRound(pv, '__ability'); }
            origRender.apply(UI);
          } finally { CE._prestonBusy = false; }
        }, 50);
      }
    }
    return r;
  };
})();

// ============================================================
//  選中的調查員：地圖上的人偶也發光，並且疊在其他人偶上面
// ============================================================
(function () {
  const origDrag = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    if (!onClick && el.dataset && el.dataset.inv != null) {
      const i = +el.dataset.inv;
      onClick = () => { if (G.active !== i) CE.setActive(i); };
    }
    return origDrag.call(UI, el, getObj, onClick);
  };
  const origBoard = UI.renderBoard;
  UI.renderBoard = function () {
    const r = origBoard.apply(UI, arguments);
    if (G.active != null) {
      const el = document.querySelector(`#world .fig[data-inv="${G.active}"]`);
      if (el) el.classList.add('acting');
    }
    return r;
  };
})();




// ============================================================
//  人偶不要擋住地圖標記：放到格子裡空出來的位置
// ============================================================
(function () {
  MAP.snap = function (o, others) {
    const c = MAP.cellAt(o.x, o.y); if (!c) return;
    const marks = Object.values(G.nodes).filter(n => n.visible && !n.virtual && n.sprite && !/Wall|Door|Secret|Investigators/.test(n.sprite) && Math.hypot(n.x - c.x, n.y - c.y) < 1.2)
      .concat(G.tokens.filter(t => Math.hypot(t.x - c.x, t.y - c.y) < 1.2));
    const figs = others.filter(p => p !== o && MAP.cellAt(p.x, p.y) === c);
    const cand = [];
    for (let gx = -0.36; gx <= 0.361; gx += 0.12) for (let gy = -0.36; gy <= 0.361; gy += 0.12) {
      // 只能放在同一格裡（形狀不規則的格子，中心附近的點可能落在別格或板塊外）
      const cc = MAP.cellAt(c.x + gx, c.y + gy); if (cc && cc.id === c.id) cand.push([c.x + gx, c.y + gy]);
    }
    cand.push([o.x, o.y]);
    let best = null, bs = -1;
    for (const [x, y] of cand) {
      const dm = Math.min(9, ...marks.map(n => Math.hypot(n.x - x, n.y - y)));
      const df = Math.min(9, ...figs.map(p => Math.hypot(p.x - x, p.y - y)));
      const near = -Math.hypot(x - o.x, y - o.y) * 0.3;            // 盡量靠近放手的位置
      const s = Math.min(dm / 0.45, 1) * 3 + Math.min(df / 0.38, 1) * 0.2 + near;
      if (s > bs) { bs = s; best = [x, y]; }
    }
    o.x = best[0]; o.y = best[1];
  };
  // 開始時人偶也避開標記
  const origStart = Engine.startInvestigatorPhase;
  Engine.startInvestigatorPhase = function (first) {
    if (first && G.inv) { const figs = G.inv.filter(x => !x.removed); figs.forEach(iv => MAP.snap(iv, figs)); }
    return origStart.apply(Engine, arguments);
  };
})();

// ============================================================
//  開新遊戲畫面也可以邀請朋友，一起選調查員
// ============================================================
(function () {
  const origOpen = UI.openDialog;
  UI.openDialog = function (html) {
    const r = origOpen.call(UI, html);
    if (typeof NET === 'undefined' || NET.role === 'guest') return r;
    const btns = document.querySelector('#dialog .btns');
    if (btns && (document.getElementById('btnStart') || document.getElementById('rsGo') || document.getElementById('ngNext')) && !document.getElementById('netInvite')) {
      const b = document.createElement('button'); b.className = 'btn blue'; b.id = 'netInvite';
      b.textContent = NET.role === 'host' ? `🔗 房間 ${NET.code}（${NET.peers.size} 位朋友）` : '🔗 開房間（邀請朋友）';
      b.onclick = () => NET.hostStart();
      btns.insertBefore(b, btns.firstChild);
      if (!NET.role && !document.getElementById('netJoin')) {
        const j = document.createElement('button'); j.className = 'btn blue'; j.id = 'netJoin'; j.textContent = '🔗 加入朋友的遊戲';
        j.onclick = () => { UI.closeDialog(); NET.guestStart(); };
        btns.insertBefore(j, b.nextSibling);
      }
    }
    return r;
  };
})();
