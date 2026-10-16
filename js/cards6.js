// ============================================================
//  第 6 批：標記鎖定、移動規則、結束回合、地上物品、自動效果、
//          懸停提示、上一步、神秘階段、音樂音效
// ============================================================
(function () {
  const invC = i => MAP.posCell(G.inv[i]);
  const NUM = { 一: 1, 兩: 2, 二: 2, 三: 3, 四: 4, 五: 5 };
  const num = s => /\d/.test(s) ? +s : (NUM[s] || 1);
  const isInv = () => G.phase === 'investigator' && !G.gameOver;
  CE.actorNow = () => {
    if (CE.nodeActor != null) return CE.nodeActor;
    if (G.phase === 'investigator' && G.active != null && G.inv[G.active] && !G.inv[G.active].removed) return G.active;
    return null;
  };

  // ==========================================================
  //  1. 地圖標記：要先選「搜索／互動／探索」才能點（景象標記不用）
  // ==========================================================
  CE.pending = null;
  CE.nodeActor = null;
  const FREE = { test: id => /^(SIGHT|REVEAL)/.test(id) || /Sight/i.test(((G.nodes || {})[id] || {}).sprite || '') };
  // 名稱沒有 PERSON 開頭、但圖是人物的標記（例如「Elli Horowitz」）也算人物互動
  const ACT_NODE = { test: id => /^(SEARCH|SERACH|EXPLORE|INTERACT|PERSON|REDIRECT|ITEM)/.test(nodeTag(id)) || /^Person_/.test(((G.nodes || {})[id] || {}).sprite || '') };
  const origClick = UI.clickNode;
  UI.clickNode = async function (id) {
    if (!isInv()) return origClick.call(UI, id);
    if (!UI.$('#overlay').classList.contains('hidden')) return;
    const f = G.fsmByObj[id];
    if (FREE.test(id) || !ACT_NODE.test(id)) {           // 景象標記：不用行動（規則：結算景象標記不需要行動，也沒有距離限制）
      CE.nodeActor = CE.actorNow();
      CE._ia = { idx: CE.nodeActor, covered: false };
      origClick.call(UI, id);
      if (f) f.whenIdle().then(() => { CE.nodeActor = null; CE._ia = null; }); else CE._ia = null;
      return;
    }
    const a = CE.pending;
    if (a == null) { UI.toast('請先按調查員欄的「其他行動」→「搜索／互動／探索」，再點標記'); return; }
    // 規則：搜索、互動要和標記在同一格；探索要在同一格或在那扇門旁邊的格子
    const far = CE.nodeTooFar ? CE.nodeTooFar(a, id) : null;
    if (far) { await CE.alert('距離不夠', far + '\n\n請先把人偶移到正確的格子（這次不扣行動）。'); return; }
    CE.pending = null;
    const actsBefore = (G.inv[a].turn || {}).acts || 0;
    CE.spendRaw(a, 'other');
    CE.nodeActor = a;
    CE._ia = { idx: a, covered: true };
    CE._refund = { idx: a, first: true };
    origClick.call(UI, id);
    if (!f || f.running === 0) { const iv = G.inv[a]; iv.turn.acts = Math.max(0, iv.turn.acts - 1); CE.nodeActor = null; CE._refund = null; UI.render(); return; }
    f.whenIdle().then(async () => {
      if (CE.nodeActor === a) CE.nodeActor = null;
      // 整段互動都沒有選到有「行動」圖示的選項：不扣行動（官方規則）
      if (CE._ia && CE._ia.idx === a && CE._ia.covered) { const iv = G.inv[a]; iv.turn.acts = Math.max(0, iv.turn.acts - 1); Engine.log(`${iv.name} 這次互動沒有選需要行動的選項，不扣行動`); UI.toast('沒有選到需要行動的選項，不扣行動'); }
      CE._ia = null;
      CE._refund = null;
      // 互動被取消／不扣行動：沒有真的做行動，不受火焰傷害
      if (CE.fireAfter && ((G.inv[a].turn || {}).acts || 0) > actsBefore) await CE.fireAfter(a);
      UI.render();
    });
  };
  // 第一個對話選「取消」：不消耗行動
  const wrapCancel = (name, isCancel) => {
    const orig = Actions[name]; if (!orig) return;
    Actions[name] = async function (a, f) {
      const r = CE._refund, first = r && r.first;
      if (r) r.first = false;
      const res = await orig.call(Actions, a, f);
      if (first && res && isCancel(a, res.event)) {
        const iv = G.inv[r.idx]; iv.turn.acts = Math.max(0, iv.turn.acts - 1);
        if (CE._ia) CE._ia.covered = false;
        UI.toast('已取消，不消耗行動'); Engine.log(`${iv.name} 取消了互動（不消耗行動）`); UI.render();
      }
      return res;
    };
  };
  wrapCancel('DisplayMessageCancelConfirm', (a, ev) => ev === 'CANCEL');
  wrapCancel('DisplayMessageMultipleChoice', (a, ev) => a.CancelChoice && ev === a.CancelChoice.Event);
  for (const n of ['DisplayMessage', 'DisplayMessageAndReveal', 'DisplayMessageChallenge', 'SpawnItem']) wrapCancel(n, () => false);

  // 「其他行動」選單：第一項改成「搜索／互動／探索」
  const origMenu = CE.actionMenu;
  CE.actionMenu = function (idx) {
    // 已經開著一個選單（連點兩下、或連線時朋友畫面慢一步又按一次）：先關掉舊的，不要疊兩層（1.2.62 測試組）
    document.querySelectorAll('#cardLayer .clBox').forEach(b => { if (b.querySelector('.actMenu')) b.remove(); });
    origMenu.call(CE, idx);
    const all = document.querySelectorAll('#cardLayer .am[data-k="general"]'); const el = all[all.length - 1];
    if (!el) return;
    el.innerHTML = '<b>搜索／互動／探索</b><span>選好後，點地圖上的標記（景象標記不用選）</span>';
    el.onclick = async () => {
      el.closest('.clBox').remove(); const L = document.getElementById('cardLayer'); if (L && !L.children.length) L.classList.remove('on');
      const iv = G.inv[idx]; CE.ensure(iv);
      if (G.active !== idx) CE.setActive(idx, true);
      if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return; }
      if (!(await CE.evadeFirst(idx, 'other'))) return;
      CE.pending = idx;
      UI.toast('請點地圖上的搜索、互動或探索標記');
      UI.render();
    };
  };
  // 物品頁「檢視／使用」（例如舊日誌）：互動中獲得的東西給持有人
  const origDetail = UI.itemDetail;
  UI.itemDetail = function (it) {
    origDetail.call(UI, it);
    if (!it) return;
    const fsm = it.node && G.fsmByObj[it.node];
    UI.$('#dialog').querySelectorAll('[data-act]').forEach(b => {
      const o = b.onclick;
      b.onclick = () => { CE.nodeActor = it.owner; o(); if (fsm) fsm.whenIdle().then(() => { CE.nodeActor = null; }); };
    });
    // 丟棄 → 放在地上；另外加「移出遊戲」
    const drop = UI.$('#itDrop');
    if (drop && it.owner != null) {
      drop.textContent = '丟在地上';
      drop.onclick = () => { if (CE.locked(it)) { UI.toast('這張卡不能被丟棄或交易'); return; } UI.closeDialog(); CE.dropToGround(it, it.owner); UI.render(); };
      const rm = document.createElement('button'); rm.className = 'btn'; rm.textContent = '移出遊戲';
      rm.title = '劇情或卡片要求「棄除」時使用：這個物品會從這場遊戲消失';
      rm.onclick = async () => { UI.closeDialog(); if (await UI.confirm(`確定把【${T(it.name)}】移出這場遊戲？（劇情要求棄除時使用）`)) { CE.discardItem(it, '移出遊戲'); UI.render(); } };
      drop.after(rm);
    }
    if (it.ground) {
      const g = UI.$('#giveSel'); if (g) g.closest('.row').innerHTML = '<span class="small">這個物品在地上。同一格的調查員可以用「交換」行動撿起來。</span>';
      if (drop) drop.remove();
      const btns = UI.$('#dialog .btns');
      const pk = document.createElement('button'); pk.className = 'btn primary'; pk.textContent = '撿起（交換行動）';
      pk.onclick = () => { UI.closeDialog(); CE.pickUpFlow(it); };
      btns.insertBefore(pk, btns.firstChild);
      const rm = document.createElement('button'); rm.className = 'btn'; rm.textContent = '移出遊戲';
      rm.onclick = async () => { UI.closeDialog(); if (await UI.confirm(`確定把地上的【${T(it.name)}】移出這場遊戲？`)) { CE.discardItem(it, '移出遊戲'); UI.render(); } };
      btns.insertBefore(rm, btns.lastChild);
    }
  };

  // ==========================================================
  //  2. 移動：按「移動」後拖曳人偶，一次移動最多 2 格（麗塔 3 格），可中途插入其他行動
  // ==========================================================
  const dist = (from, to, maxD) => {
    if (!from || !to) return null;
    if (from.id === to.id) return 0;
    const seen = { [from.id]: 0 }, q = [from.id];
    while (q.length) { const c = q.shift(); if (seen[c] >= maxD) continue; for (const n of MAP.moveAdj(c)) if (seen[n] == null) { seen[n] = seen[c] + 1; if (n === to.id) return seen[n]; q.push(n); } }
    return null;
  };
  const origDo = CE.doAction;
  CE.doAction = async function (idx, kind, body) {
    const iv = G.inv[idx]; CE.ensure(iv);
    if (kind === 'move' && iv.turn.move && iv.turn.move.left > 0) await CE.endMove(idx);
    CE.pending = null;
    const start = invC(idx);
    const ok = await origDo.call(CE, idx, kind, body);
    if (ok && kind === 'move') {
      iv.turn.move = { left: iv.id === 'INVESTIGATOR_RITA_YOUNG' ? 3 : 2, steps: 0, evaded: start ? start.id : null };
      UI.toast(`${iv.name} 開始移動：最多 ${iv.turn.move.left} 格，請拖曳人偶`);
      UI.render();
    }
    return ok;
  };
  CE.endMove = async function (idx) {
    const iv = G.inv[idx], mv = iv.turn && iv.turn.move; if (!mv) return;
    iv.turn.move = null;
    if (mv.steps > 1 && (iv.cards || []).some(x => x.up && CARDS[x.t === 'damage' ? 'damage' : 'horror'][x.c].eff.legBroken)) {
      await CE.alert('大腿骨折', `${iv.name} 這次移動超過 1 格，要將一張傷害卡翻到正面。`);
      await CE.flipUp(iv, 'damage'); await CE.checkLimit(iv, 'damage');
    }
    UI.render();
  };
  // 移動途中離開有怪物的格子：要先躲避
  CE.moveEvade = async function (idx) {
    const iv = G.inv[idx], mv = iv.turn.move, c = invC(idx);
    const m = CE.monsterHere(idx);
    await CE.alert('要先躲避', `${iv.name} 要離開和 ${T(m.name)} 同一格的格子，必須先做躲避檢定。`, '開始躲避');
    await Engine.runMonsterTemplate(m, 'evade', 'MONSTER/EVADE/START');
    const ok = await CE.ask('躲避結果', `依剛才的結果，${iv.name} 還能繼續移動嗎？\n（訊息說「行動被取消／強制結束」就選「被取消」，剩下的移動會作廢）`, '可以繼續', '被取消');
    if (ok) mv.evaded = c ? c.id : null; else { mv.left = 0; await CE.endMove(idx); }
    UI.render();
  };
  const origDrag2 = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    origDrag2.call(UI, el, getObj, onClick);
    if (!el.dataset || el.dataset.inv == null) return;
    const i = +el.dataset.inv;
    const down = el.onpointerdown;
    el.onpointerdown = e => {
      if (e.button !== 0) return down(e);
      const iv = G.inv[i], o = getObj();
      if (!isInv() || !o) return down(e);
      CE.ensure(iv);
      if (iv.turn.redo && G.active === i) return down(e);   // 補做：自由移動
      const mv = iv.turn.move;
      const start = invC(i), sx = o.x, sy = o.y;
      let reason = null;
      if (G.active !== i) reason = null;          // 不是行動中的人：只能點選，不能拖
      if (!mv || mv.left <= 0 || G.active !== i) reason = G.active !== i ? '先點頭像選這位調查員，再按「移動」' : '請先按「移動」，再拖曳人偶';
      else if (start && CE.monsterHere(i) && mv.evaded !== start.id) reason = 'evade';
      down(e);
      const up = el.onpointerup;
      if (reason) {
        let warned = false;
        el.onpointermove = ev => { if (!warned && Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) > 8) { warned = true; if (reason !== 'evade') UI.toast(reason); } };
        el.onpointerup = ev => { up && up(ev); if (warned && reason === 'evade') CE.moveEvade(i); };
        return;
      }
      el.onpointerup = async ev => {
        const to = MAP.cellAt(o.x, o.y);
        const moved = Math.hypot(o.x - sx, o.y - sy) > 0.05;
        let d = moved ? dist(start, to, mv.left) : 0;
        // 探索後的免費 1 格：可以走進剛探索那扇門的另一邊
        if (moved && d == null && to && mv.free && mv.door && G.nodes[mv.door]) {
          const n = G.nodes[mv.door];
          if (Math.max(Math.abs(to.x - n.x), Math.abs(to.y - n.y)) <= 0.75) d = 1;
        }
        if (moved && (d == null || to == null)) {
          o.x = sx; o.y = sy;
          const need = to && start ? dist(start, to, 12) : null;
          UI.toast(to == null ? '那裡不是可以站的格子' : need == null ? '走不到那裡：中間被牆擋住，或門被屏障擋住' : `走不到那裡：要走 ${need} 格，你只剩 ${mv.left} 格`);
          d = 0;
        }
        up && up(ev);
        if (d > 0) {
          mv.left -= d; mv.steps += d;
          Engine.log(`${iv.name} 移動 ${d} 格（剩 ${mv.left} 格）`);
          if (mv.left <= 0) await CE.endMove(i); else UI.render();
        } else UI.renderBoard();
      };
    };
  };

  // ==========================================================
  //  3. 調查員欄：移動狀態、選標記狀態、結束回合提醒
  // ==========================================================
  const origCard = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = origCard.call(UI, iv, idx);
    const bar = d.querySelector('.turnBar');
    if (bar && isInv() && G.active === idx) {
      const mv = iv.turn && iv.turn.move;
      const info = document.createElement('div'); info.className = 'turnInfo';
      if (mv && mv.left > 0) {
        info.innerHTML = `<span>🚶 移動中：剩 <b>${mv.left}</b> 格（可以先插入其他行動）</span><button class="tbtn">結束移動</button>`;
        info.querySelector('button').onclick = () => CE.endMove(idx);
        bar.after(info);
      } else if (iv.turn && iv.turn.redo) {
        info.innerHTML = `<span>✋ 補做中：人偶可以自由拖曳，不扣行動</span>`;
        bar.after(info);
      } else if (CE.pending === idx) {
        info.innerHTML = `<span>🔍 請點地圖上的搜索／互動／探索標記</span><button class="tbtn">取消</button>`;
        info.querySelector('button').onclick = () => { CE.pending = null; UI.render(); };
        bar.after(info);
      }
      const done = iv.turn && iv.turn.acts >= CE.maxActs(iv) && !(mv && mv.left > 0);
      const endB = bar.querySelector('.end'); if (endB && done) endB.classList.add('glow');
    }
    // 物品堆下拉選單：不包含地上的物品
    d.querySelectorAll('select[data-a="give"] option').forEach(op => { const it = G.items.find(x => x.id === op.value); if (it && it.ground) op.remove(); });
    return d;
  };
  // 結束回合時：結束移動、清掉待選標記
  const origEnd = CE.endTurn;
  CE.endTurn = async function (i, quiet) {
    const iv = G.inv[i];
    if (iv.turn && iv.turn.move) await CE.endMove(i);
    if (CE.pending === i) CE.pending = null;
    if (iv.turn) iv.turn.redo = false;
    return origEnd.call(CE, i, quiet);
  };
  const origSet = CE.setActive;
  CE.setActive = function (i, quiet) {
    if (CE.pending != null && CE.pending !== i) CE.pending = null;
    const iv = G.inv[i];
    if (isInv() && iv && iv.turn && iv.turn.done) { iv.turn.redo = true; setTimeout(() => UI.toast(`補做：${iv.name} 的人偶可以自由移動（不扣行動）`), 300); }
    return origSet.call(CE, i, quiet);
  };

  // ==========================================================
  //  4. 每位調查員都結束回合後，才能結束調查員階段
  // ==========================================================
  const notDone = () => CE.alive().filter(i => !G.inv[i].turn || !G.inv[i].turn.done);
  const origEndPhase = Engine.endInvestigatorPhase;
  Engine.endInvestigatorPhase = async function () {
    if (G.phase === 'investigator' && !CE._forceEnd) {
      const left = notDone();
      if (left.length) { UI.toast(`還有人沒按「結束回合」：${left.map(i => G.inv[i].name).join('、')}`); return; }
    }
    return origEndPhase.apply(Engine, arguments);
  };

  // ==========================================================
  //  5. 地上的物品
  // ==========================================================
  CE.groundSpot = function (x, y) {
    const c = MAP.cellAt(x, y);
    const cx = c ? c.x : x, cy = c ? c.y : y;
    const avoid = [
      ...Object.values(G.nodes).filter(n => n.visible && !n.virtual && n.sprite && !/Wall|Door|Secret|Investigators/.test(n.sprite)).map(n => [n.x, n.y, 0.42]),
      ...G.tokens.map(t => [t.x, t.y, 0.38]),
      ...G.inv.filter(v => !v.removed).map(v => [v.x, v.y, 0.36]),
      ...G.monsters.map(m => [m.x, m.y, 0.4]),
      ...G.items.filter(it => it.ground).map(it => [it.ground.x, it.ground.y, 0.24])
    ];
    let best = [cx, cy], bs = -1e9;
    for (let gx = -0.4; gx <= 0.401; gx += 0.08) for (let gy = -0.4; gy <= 0.401; gy += 0.08) {
      const px = cx + gx, py = cy + gy;
      let s = 0; for (const [ax, ay, r] of avoid) { const dd = Math.hypot(ax - px, ay - py); if (dd < r) s -= (r - dd) * 10; }
      s -= Math.hypot(px - x, py - y) * 0.5;
      if (s > bs) { bs = s; best = [px, py]; }
    }
    return { x: best[0], y: best[1] };
  };
  CE.placeGround = function (it, pos) {
    if (!pos) { const a = CE.actorNow(); const iv = a != null ? G.inv[a] : G.inv.find(v => !v.removed); pos = iv ? { x: iv.x, y: iv.y } : { x: 0, y: 0 }; }
    it.owner = null; it.ground = CE.groundSpot(pos.x, pos.y);
    Engine.log(`${T(it.name)} 放在地上`);
  };
  CE.dropToGround = function (it, idx) {
    const iv = G.inv[idx];
    CE.placeGround(it, iv ? { x: iv.x, y: iv.y } : null);
    Engine.log(`${iv ? iv.name : ''} 把 ${T(it.name)} 丟在地上`);
  };
  // 規則上的「丟棄／丟下」（隨機丟道具、手臂骨折、被消滅）都放在地上
  const withDrop = fn => async function (idx, ...rest) {
    const iv = typeof idx === 'number' ? G.inv[idx] : idx;
    const i = G.inv.indexOf(iv);
    const before = G.items.filter(it => it.owner === i);
    const r = await fn.call(CE, idx, ...rest);
    before.filter(it => it.owner == null && !it.ground && G.items.includes(it)).forEach(it => CE.placeGround(it, { x: iv.x, y: iv.y }));
    UI.render();
    return r;
  };
  CE.dropRandom = withDrop(CE.dropRandom);
  CE.enforceHandLimit = withDrop(CE.enforceHandLimit);
  CE.eliminate = withDrop(CE.eliminate);
  const origDiscard = CE.discardItem;
  CE.discardItem = function (it, why) { it.ground = null; return origDiscard.call(CE, it, why); };
  // 撿起
  CE.pickUpFlow = async function (it) {
    const c = MAP.cellAt(it.ground.x, it.ground.y);
    let who = CE.alive().filter(i => !c || (invC(i) && invC(i).id === c.id));
    if (!who.length) { UI.toast('要站在同一格才能撿起'); return; }
    const a = who.includes(CE.actorNow()) ? CE.actorNow() : (who.length === 1 ? who[0] : await CE.chooseInvLayer('誰要撿起來？', who));
    if (a == null) return;
    if (isInv()) await CE.doAction(a, 'other', async () => { it.ground = null; it.owner = a; Engine.log(`${G.inv[a].name} 撿起了 ${T(it.name)}`); });
    else { it.ground = null; it.owner = a; }
    UI.render();
  };
  // 交換行動：撿起、丟下、交給同格的人
  CE.actTrade = async function (idx) {
    await CE.doAction(idx, 'other', async () => {
      const snap = G.items.map(it => [it, it.owner, it.ground]);   // 取消時還原
      const cancelled = await new Promise(res => {
        const w = CE.layer('');
        const draw = () => {
          const c = invC(idx);
          const same = CE.alive().filter(j => !c || (invC(j) && invC(j).id === c.id));
          const ground = G.items.filter(it => it.ground && (!c || (MAP.cellAt(it.ground.x, it.ground.y) || {}).id === c.id));
          const row = (it, btns) => `<div class="trRow"><img src="img/items/${it.img}.png"><b>${esc(T(it.name))}</b><span class="trB">${btns}</span></div>`;
          w.box.innerHTML = `<h3 class="dlgTitle">交換（同一格的調查員）</h3>
            <div class="lbl" style="font-size:14px">地上的物品</div>${ground.map(it => row(it, same.map(j => `<button class="btn small" data-pick="${it.id}" data-to="${j}">${esc(G.inv[j].name)} 撿起</button>`).join(''))).join('') || '<div class="small">（沒有）</div>'}
            ${same.map(j => `<div class="lbl" style="font-size:14px">${esc(G.inv[j].name)} 的物品</div>${CE.owned(j).filter(it => !CE.locked(it)).map(it => row(it, `<button class="btn small" data-drop="${it.id}">丟在地上</button>` + same.filter(k => k !== j).map(k => `<button class="btn small" data-give="${it.id}" data-to="${k}">交給 ${esc(G.inv[k].name)}</button>`).join(''))).join('') || '<div class="small">（沒有）</div>'}`).join('')}
            <div class="btns"><button class="btn" id="trNo">取消交換</button><button class="btn primary" id="trOk">完成交換</button></div>`;
          const find = id => G.items.find(x => x.id === id);
          w.box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const it = find(b.dataset.pick); it.ground = null; it.owner = +b.dataset.to; Engine.log(`${G.inv[it.owner].name} 撿起了 ${T(it.name)}`); UI.render(); draw(); });
          w.box.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { const it = find(b.dataset.drop); CE.dropToGround(it, it.owner); UI.render(); draw(); });
          w.box.querySelectorAll('[data-give]').forEach(b => b.onclick = () => { const it = find(b.dataset.give); it.owner = +b.dataset.to; Engine.log(`${T(it.name)} 交給了 ${G.inv[it.owner].name}`); UI.render(); draw(); });
          w.box.querySelector('#trOk').onclick = () => { w.close(); res(false); };
          w.box.querySelector('#trNo').onclick = () => { w.close(); res(true); };
        };
        draw();
      });
      if (cancelled) {
        for (const [it, o, g] of snap) { it.owner = o; it.ground = g; }
        const iv = G.inv[idx]; iv.turn.acts = Math.max(0, (iv.turn.acts || 0) - 1);
        Engine.log(`${iv.name} 取消了交換（物品還原，不消耗行動）`); UI.toast('已取消交換，不消耗行動'); UI.render();
      }
    });
  };
  // 地圖上畫出地上的物品（小圖示）
  const origBoard = UI.renderBoard;
  UI.renderBoard = function () {
    const r = origBoard.apply(UI, arguments);
    const W = document.getElementById('world'); if (!W || !G.items) return r;
    // 隨板塊被移除的地上物品
    if (!Engine._noItemPurge && !Object.values(G.tiles).some(t => t._carry)) for (const it of [...G.items]) if (it.ground && Object.values(G.tiles).some(t => t.revealed) && !MAP.cellAt(it.ground.x, it.ground.y)) { G.items.splice(G.items.indexOf(it), 1); Engine.log(`${T(it.name)} 隨板塊被移出遊戲`); }
    for (const it of G.items.filter(x => x.ground)) {
      const el = document.createElement('div');
      el.className = 'gitem'; el.dataset.gitem = it.id;
      el.style.cssText = `left:${it.ground.x * U}px;top:${-it.ground.y * U}px;width:${0.22 * U}px;height:${0.22 * U}px`;
      el.innerHTML = `<img src="img/items/${it.img}.png">`;
      W.appendChild(el);
      UI.makeDraggable(el, () => it.ground, () => UI.itemDetail(it));
    }
    // 標記上鎖
    W.querySelectorAll('.node[data-node]').forEach(el => {
      const id = el.dataset.node;
      if (el.classList.contains('feature') || FREE.test(id) || !ACT_NODE.test(id)) return;
      if (isInv() && CE.pending == null) el.classList.add('locked');
      if (CE.pending != null) { if (CE.nodeTooFar && CE.nodeTooFar(CE.pending, id)) el.classList.add('locked', 'far'); else el.classList.add('pickable'); }
    });
    return r;
  };
  // 物品視窗：物品堆、地上、各調查員分開
  UI.itemSheet = function () {
    if (!G.scen) return;
    const chip = it => `<span class="chip ${it.type === 1 ? 'spell' : it.type === 2 ? 'unique' : ''}" data-item="${it.id}"><img src="img/items/${it.img}.png">${esc(T(it.name))}</span>`;
    const groups = [{ t: '物品堆（尚未分配，例如起始物品）', list: G.items.filter(i => i.owner == null && !i.ground) }, { t: '地上（要用「交換」行動撿起）', list: G.items.filter(i => i.ground) }]
      .concat(G.inv.map((iv, i) => ({ t: iv.name, list: G.items.filter(x => x.owner === i) })));
    const all = Engine.collectionItems().filter(it => !G.items.some(x => x.id === it.id)).sort((a, b) => a.type - b.type);
    UI.openSheet(`<div class="sheetHead"><h3>物品</h3><button class="btn small" id="shClose">關閉</button></div>
      ${groups.map(g => `<div class="lbl" style="font-size:14px">${esc(g.t)}</div><div class="chips">${g.list.map(chip).join('') || '<span class="small">（無）</span>'}</div>`).join('')}
      <div class="lbl" style="font-size:14px;margin-top:12px">手動加入物品（實體遊戲中取得時使用）</div>
      <div class="addRow"><select id="addItemSel"><option value="">選擇物品…</option>${all.map(it => `<option value="${it.id}">${['普通', '法術', '獨特'][it.type]}：${esc(T(it.name))}</option>`).join('')}</select><button id="addItemBtn">加入</button></div>`);
    UI.$('#shClose').onclick = () => UI.closeSheet();
    UI.$('#sheetInner').querySelectorAll('[data-item]').forEach(el => el.onclick = () => { UI.closeSheet(); UI.itemDetail(G.items.find(x => x.id === el.dataset.item)); });
    UI.$('#addItemBtn').onclick = () => { const id = UI.$('#addItemSel').value; if (id) { Engine.addItem(DB.items[id]); UI.itemSheet(); } };
  };

  // ==========================================================
  //  6. 劇本給的物品：「獲得」→ 直接給行動中的人；「放在…位置」→ 放在地上
  // ==========================================================
  CE.spawnMode = null; CE.spawnPos = null;
  const origSpawn = Actions.SpawnItem;
  Actions.SpawnItem = async function (a, f) {
    const raw = T(a.Message && (a.Message.Key || a.Message)) || '';
    const give = /獲得[^。]*?(道具|法術)/.test(raw);
    const place = /(放在|放置)[^。]*/.test(raw) && /道具/.test(raw);
    CE.spawnMode = place && !give ? 'ground' : 'give';
    CE.spawnPos = a.SpawnPoint ? Engine.pos(a.SpawnPoint) : null;
    try { return await origSpawn.call(Actions, a, f); } finally { CE.spawnMode = null; CE.spawnPos = null; }
  };
  const origAdd = Engine.addItem;
  Engine.addItem = function (def, extra) {
    const isNew = !G.items.some(i => i.id === def.id);
    const it = origAdd.call(Engine, def, extra);
    if (!isNew || it.owner != null || it.ground || G.phase === 'setup') return it;
    if (CE.spawnMode === 'ground') { CE.placeGround(it, CE.spawnPos); UI.toast(`【${T(it.name)}】放在地上，同一格的人可以用「交換」行動撿起`); }
    else {
      const a = CE.nodeActor != null ? CE.nodeActor : (CE.spawnMode === 'give' ? CE.actorNow() : null);
      if (a != null && G.inv[a] && !G.inv[a].removed) { it.owner = a; Engine.log(`${G.inv[a].name} 獲得了 ${T(it.name)}`); UI.toast(`${G.inv[a].name} 獲得了【${T(it.name)}】`); AU.sfx('GainItem_01'); }
    }
    UI.render();
    return it;
  };

  // ==========================================================
  //  7. 訊息中的線索、傷害、恐怖、狀態：判斷是誰，按「繼續」後自動套用
  // ==========================================================
  CE.planEffects = function (o) {
    const text = o && o.text; if (!text) return null;
    const f = o.fsm || {};
    if (CE.parseNeed(text) != null || CE.parseNegate(text) || /檢定|消除/.test(text)) return null;
    if (f.kind === 'attack') return null;                       // 怪物在神秘階段攻擊：由玩家決定是誰
    let t = text.split(/如果/)[0];
    // 對象
    let targets = null, who = '';
    const allM = t.match(/(每位|每名|每個|所有)([^。，；]*?)調查員/);
    if (allM) {
      if (/(在|中的|移動過|範圍|黑暗|格子)/.test(allM[2] || '')) return null;   // 有條件：讓玩家自己選（套用按鈕）
      targets = CE.alive(); who = '每位調查員';
    } else {
      let a = CE.nodeActor;
      if (a == null && f.kind === 'horror' && CE.horrorGroup) { targets = CE.horrorGroup.slice(); }
      if (a == null && !targets) { const byName = CE.alive().filter(i => text.includes(G.inv[i].name)); if (byName.length === 1) a = byName[0]; }
      if (a == null && !targets && (f.kind === 'evade' || f.kind === 'invattack' || (!f.monster && !f.mythosEvent))) a = CE.actorNow();
      if (!targets) { if (a == null) return null; targets = [a]; }
      who = targets.map(i => G.inv[i].name).join('、');
    }
    const fx = { clue: 0, hits: [], heal: [], conds: [] };
    let m; const reC = /(獲得|和|、)\s*(\d+|一|兩|二|三)\s*(條|個|枚)線索/g;
    while ((m = reC.exec(t))) fx.clue += num(m[2]);
    const reL = /(棄除|失去)\s*(\d+|一|兩|二)\s*(條|個|枚)線索/g;
    while ((m = reL.exec(t))) fx.clue -= num(m[2]);
    fx.hits = CE.parseHits(t);
    const reH = /棄除\s*(\d+|一|兩|二)\s*(點|張)(面朝下的)?(恐怖|傷害)/g;
    while ((m = reH.exec(t))) fx.heal.push({ type: m[4] === '傷害' ? 'damage' : 'horror', n: num(m[1]) });
    // 狀態（也認擴充的中毒、催眠…，和「進入中毒和眩暈狀態」這種兩個一起的）
    if (CE.condsIn) fx.conds.push(...CE.condsIn(t));
    else { const reS = /進入(集中|眩暈|擊昏|抑制)狀態/g; while ((m = reS.exec(t))) fx.conds.push(m[1]); }
    // 線索的中文數字也算傷害恐怖
    const reCN = /受到\s*(一|兩|二|三)\s*點(面朝下的)?(傷害|恐怖)/g;
    while ((m = reCN.exec(t))) fx.hits.push({ type: m[3] === '傷害' ? 'damage' : 'horror', n: num(m[1]), down: !!m[2] });
    const parts = [];
    if (fx.clue > 0) parts.push(`獲得 ${fx.clue} 線索`);
    if (fx.clue < 0) parts.push(`棄除 ${-fx.clue} 線索`);
    fx.hits.forEach(h => parts.push(h.flip ? `${h.n} 張面朝下的${h.type === 'damage' ? '傷害' : '恐怖'}卡翻到正面（沒有就不翻）` : `受到 ${h.n} 點${h.down ? '面朝下的' : ''}${h.type === 'damage' ? '傷害' : '恐怖'}`));
    fx.heal.forEach(h => parts.push(`棄除 ${h.n} 點${h.type === 'damage' ? '傷害' : '恐怖'}`));
    fx.conds.forEach(c => parts.push(`進入${c}狀態`));
    if (!parts.length) return null;
    return { targets, fx, desc: `${who}：${parts.join('、')}` };
  };
  CE.runPlan = async function (p) {
    for (const i of p.targets) {
      const iv = G.inv[i]; if (!iv || iv.removed) continue;
      if (p.fx.clue) { iv.clues = Math.max(0, iv.clues + p.fx.clue); Engine.log(`${iv.name} ${p.fx.clue > 0 ? '獲得' : '棄除'} ${Math.abs(p.fx.clue)} 線索`); }
      for (const c of p.fx.conds) CE.addCond(iv, c);
      for (const h of p.fx.heal) CE.heal(iv, h.type, h.n, 'any');
      if (p.fx.hits.length) await CE.applyHits(iv, p.fx.hits.map(h => Object.assign({}, h)));
    }
    UI.toast('已套用：' + p.desc);
    UI.render();
  };
  const origSay = Engine.say;
  Engine.say = async function (o) {
    let plan = null;
    try { plan = CE.planEffects(o); } catch (e) { console.error(e); }
    if (plan) o = Object.assign({}, o, { _plan: plan });
    const r = await origSay.call(Engine, o);
    if (plan) await CE.runPlan(plan);
    return r;
  };
  const origMsg = UI.message;
  UI.message = function (o) {
    const p = origMsg.call(UI, o);
    try {
      if (o && o._plan && OFF.layer) {
        OFF.layer.querySelectorAll('.applyPlate').forEach(e => e.remove());
        const pop = OFF.layer.querySelector('#popup'), bg = pop && pop.querySelector('.bg');
        if (bg) { const el = document.createElement('div'); el.className = 'autoFx'; el.textContent = '按「繼續」後自動套用 → ' + o._plan.desc; el.style.top = (parseFloat(bg.style.top) + bg.offsetHeight - 6 * OFF.u) + 'px'; pop.appendChild(el); }
      }
    } catch (e) { console.error(e); }
    return p;
  };

  // ==========================================================
  //  8. 滑鼠移上去就顯示內容
  // ==========================================================
  const tip = document.createElement('div'); tip.id = 'hoverTip'; document.body.appendChild(tip);
  const itemTip = it => { const f = CE.face(it) || {}; return `<b>${esc(f.flipped ? f.name : T(it.name))}</b><div class="ht2">${it.type === 2 ? '獨特物品' : CE.isSpell(it.id) ? '法術' : '普通物品'}${f.cat ? '・' + esc(f.cat) : ''}${f.w ? `・${f.w === 'melee' ? '近戰' : '遠程'} 傷害 ${f.dmg}` : ''}${it.ground ? '・在地上' : ''}</div>${fmt((f.text || '').replace(/🔍/g, '').replace(/★/g, ''))}`; };
  const tipFor = el => {
    let e;
    if ((e = el.closest('[data-gitem]'))) { const it = G.items.find(x => x.id === e.dataset.gitem); return it && itemTip(it); }
    if ((e = el.closest('[data-item]'))) { const it = G.items.find(x => x.id === e.dataset.item); return it && itemTip(it); }
    if ((e = el.closest('[data-cond]'))) { const n = e.dataset.cond; const c = Object.values(CARDS.conditions).find(x => x.name === n); return c && `<b>${esc(c.name)}</b><div>${fmt(c.text.replace(/🔍/g, '').replace(/★/g, ''))}</div>`; }
    if ((e = el.closest('.dhUp'))) return `<b>${esc(e.textContent)}</b><div>${esc(e.dataset.tip || e.title || '')}</div>`;
    if ((e = el.closest('.dhBack'))) return '面朝下的卡（內容保密，但會算進總數）';
    if ((e = el.closest('[data-mon], .mcard[data-m]'))) {
      const m = G.monsters.find(x => x.uid === +(e.dataset.mon || e.dataset.m)); if (!m) return null;
      const st = CE.monStat(m);
      return `<b>${esc(T(m.name))}</b><div class="ht2">生命 ${m.hp - m.dmg}/${m.hp}${st.aw != null ? `・察覺 ${st.aw}・恐懼 ${st.hr}・蠻力 ${st.brawn}` : ''}</div>${(st.kw || []).map(k => `<div><b>${esc(k)}</b>：${esc(CARDS.keywords[k])}</div>`).join('')}`;
    }
    if ((e = el.closest('.node[data-node]'))) {
      const id = e.dataset.node; if (e.classList.contains('feature')) return null;
      const n = G.nodes[id];
      const kind = /^SIGHT/.test(nodeTag(id)) ? '景象標記（不用花行動）' : /^(SEARCH|SERACH)/.test(nodeTag(id)) ? '搜索標記' : /^(EXPLORE|REDIRECT)/.test(nodeTag(id)) ? '探索標記' : /^PERSON/.test(id) ? '人物' : '互動標記';
      return `<b>${kind}</b>${e.classList.contains('far') ? '<div class="ht2">🚫 太遠：要和標記站在同一格（探索可以站在門的任一邊）</div>' : e.classList.contains('locked') ? '<div class="ht2">🔒 先按「其他行動」→「搜索／互動／探索」才能點</div>' : ''}`;
    }
    if ((e = el.closest('.fig[data-inv]'))) { const iv = G.inv[+e.dataset.inv]; return iv && `<b>${esc(iv.name)}</b><div class="ht2">生命 ${iv.maxH - CE.total(iv, 'damage')}/${iv.maxH}・神智 ${iv.maxS - CE.total(iv, 'horror')}/${iv.maxS}・線索 ${iv.clues}</div>${esc(iv.ability || '')}`; }
    if ((e = el.closest('.token[data-token]'))) { const t = G.tokens.find(x => x.id == e.dataset.token); const tt = t && TOKEN_TYPES.find(x => x.kind === t.kind); return tt && `<b>${esc(tt.name)}</b><div class="ht2">右鍵可以移除</div>`; }
    return null;
  };
  CE.tipFor = tipFor;   // 連線時朋友滑鼠停在東西上，由主機算好說明傳過去（net.js）
  document.addEventListener('mouseover', ev => {
    if (NET.role === 'guest') return;
    const h = tipFor(ev.target);
    if (!h) { tip.classList.remove('on'); return; }
    const e = ev.target.closest('[title]'); if (e && /dhUp|chip|node|fig|token|mcard|gitem/.test(e.className)) { e.dataset.tip = e.dataset.tip || e.title; e.removeAttribute('title'); }
    tip.innerHTML = h; tip.classList.add('on');
  });
  document.addEventListener('mousemove', ev => {
    if (!tip.classList.contains('on')) return;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = ev.clientX + 16, y = ev.clientY + 16;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 12;
    if (y + hh > innerHeight - 8) y = ev.clientY - hh - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  document.addEventListener('pointerdown', () => tip.classList.remove('on'));

  // ==========================================================
  //  9. 上一步（擲骰、抽牌、隨機事件之後不能退回）
  // ==========================================================
  CE.undo = { stack: [], rand: false, busy: false, t: null };
  const origRnd = window.rnd;
  window.rnd = function (n) { CE.undo.rand = true; return origRnd(n); };
  CE.snapshot = function () {
    const U2 = CE.undo;
    if (U2.busy || !Engine.canSave() || document.querySelector('#cardLayer.on') || (OFF.layer && !OFF.layer.classList.contains('hidden'))) return;
    Engine.save();
    const s = localStorage.getItem('mom2_save'); if (!s) return;
    const key = s.replace(/"time":\d+,/, '');
    if (U2.rand) { U2.stack = []; U2.rand = false; }
    if (U2.stack.length && U2.stack[U2.stack.length - 1].key === key) return;
    U2.stack.push({ key, s });
    if (U2.stack.length > 11) U2.stack.shift();
    updUndo();
  };
  const updUndo = () => { const b = document.getElementById('btnUndo'); if (b) b.disabled = CE.undo.stack.length < 2; };
  CE.doUndo = function () {
    const U2 = CE.undo;
    if (U2.stack.length < 2) { UI.toast('沒有可以退回的步驟（擲骰、抽牌或揭露新內容後就不能再退回）'); return; }
    U2.stack.pop();
    const prev = U2.stack[U2.stack.length - 1];
    U2.busy = true;
    const cam = Object.assign({}, UI.cam), bn = UI.banner, fv = UI.fitView;
    UI.banner = () => { }; UI.fitView = () => { };
    try { Engine.restore(JSON.parse(prev.s)); } finally { UI.banner = bn; UI.fitView = fv; }
    Object.assign(UI.cam, cam); UI.applyCam();
    CE.pending = null; CE.nodeActor = null; CE._ia = null; CE._atk = null; CE._refund = null;   // 退回後，進行到一半的行動紀錄都清掉
    U2.rand = false; U2.busy = false;
    UI.render(); updUndo();
    UI.toast('已退回上一步');
  };
  const origRender = UI.render;
  UI.render = function () {
    const r = origRender.apply(UI, arguments);
    clearTimeout(CE.undo.t); CE.undo.t = setTimeout(CE.snapshot, 450);
    // 結束調查員階段按鈕
    const ep = document.getElementById('btnEndPhase');
    if (ep && G.phase === 'investigator' && !G.gameOver) {
      const left = notDone();
      ep.disabled = left.length > 0;
      ep.textContent = left.length ? `結束調查員階段（還有 ${left.length} 人）` : '結束調查員階段';
      ep.title = left.length ? '還沒結束回合：' + left.map(i => G.inv[i].name).join('、') : '';
    }
    updUndo();
    return r;
  };

  // ==========================================================
  //  10. 神話 → 神秘
  // ==========================================================
  for (const k in STR) if (typeof STR[k] === 'string' && STR[k].includes('神話')) STR[k] = STR[k].replace(/神話/g, '神秘');

  // ==========================================================
  //  11. 音樂與音效
  // ==========================================================
  const AU = window.AU = {
    st: Object.assign({ music: 0.5, sfx: 0.8, mute: false }, (() => { try { return JSON.parse(localStorage.getItem('mom2_audio') || '{}'); } catch (e) { return {}; } })()),
    bgm: null, kind: null, unlocked: false, want: null,
    save() { try { localStorage.setItem('mom2_audio', JSON.stringify(AU.st)); } catch (e) { } },
    LIST: { menu: ['MainMenu_01'], setup: ['Setup_01'], game: ['GameViewAtmosphere_01', 'GameViewAtmosphere_02', 'GameViewAtmosphere_03', 'GameViewAtmosphere_04', 'GameViewAtmosphere_05', 'GameViewAtmosphere_06'], over: ['GameOver_01'], win: ['Complete_01'] },
    sfx(name, remote) {
      if (!name) return;
      if (!remote && typeof NET !== 'undefined' && NET.role === 'host' && NET.connected) NET.send({ t: 'sfx', n: name });
      if (AU.st.mute || !AU.unlocked) return;
      const a = new Audio('audio/' + name + '.ogg'); a.volume = AU.st.sfx; a.play().catch(() => { });
    },
    music(kind, remote) {
      if (!remote && typeof NET !== 'undefined' && NET.role === 'host' && NET.connected) NET.send({ t: 'music', k: kind });
      AU.want = kind;
      if (!AU.unlocked) return;
      if (AU.kind === kind && AU.bgm && !AU.bgm.paused) return;
      AU.kind = kind;
      const list = AU.LIST[kind] || [];
      const old = AU.bgm;
      if (old) AU.fade(old, 0, 900, () => old.pause());
      if (!list.length) { AU.bgm = null; return; }
      const a = new Audio('audio/' + pick(list) + '.ogg');
      a.volume = 0; a.loop = list.length === 1 && kind !== 'over' && kind !== 'win';
      a.onended = () => { if (AU.kind === kind && list.length > 1) { AU.kind = null; AU.music(kind, true); } };
      AU.bgm = a;
      if (!AU.st.mute) { a.play().catch(() => { }); AU.fade(a, AU.st.music, 1200); }
    },
    fade(a, to, ms, done) {
      const from = a.volume, t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) requestAnimationFrame(step); else if (done) done(); };
      requestAnimationFrame(step);
    },
    apply() { if (AU.bgm) { AU.bgm.volume = AU.st.mute ? 0 : AU.st.music; if (AU.st.mute) AU.bgm.pause(); else AU.bgm.play().catch(() => { }); } }
  };
  // rnd 被音樂的 pick 用到時不要當成「隨機事件」
  const _music = AU.music;
  AU.music = function (kind, remote) { const r = CE.undo.rand; const res = _music.call(AU, kind, remote); CE.undo.rand = r; return res; };
  window.addEventListener('pointerdown', () => { if (!AU.unlocked) { AU.unlocked = true; if (AU.want) { const k = AU.want; AU.kind = null; AU.music(k, true); } } }, true);
  // 遊戲事件 → 音樂
  AU.want = 'menu';
  const hook = (obj, name, fn) => { const o = obj[name]; obj[name] = function () { fn.apply(this, arguments); return o.apply(this, arguments); }; };
  hook(Engine, 'begin', () => AU.music('setup'));
  hook(Engine, 'startInvestigatorPhase', () => { AU.music('game'); AU.sfx('Investigator_01'); });
  hook(Engine, 'restore', () => { if (!CE.undo.busy) AU.music('game'); });
  hook(Engine, 'gameOver', v => AU.music(v ? 'win' : 'over'));
  const origEIP = Engine.endInvestigatorPhase;
  Engine.endInvestigatorPhase = async function () { const before = G.phase; const r = origEIP.apply(Engine, arguments); setTimeout(() => { if (before === 'investigator' && G.phase === 'mythos') AU.sfx('Mythos_01'); }, 50); return r; };
  Actions.PlaySound = a => { if (a && a.Clip && a.Clip.ref) AU.sfx(a.Clip.ref); };
  hook(Actions, 'RevealTile', () => AU.sfx('RevealTile_01'));
  hook(Engine, 'addMonster', () => AU.sfx('MonsterGeneric_0' + (1 + Math.floor(Math.random() * 4))));
  // 攻擊音效：擲骰時依武器
  const origDice = UI.diceDialog;
  UI.diceDialog = function (opts = {}) {
    if (opts.kind === 'attack') { const w = opts.weaponType; AU.sfx({ HEAVY: 'Heavy_01', BLADED: 'Bladed_01', FIREARM: 'Firearm_01', SPELL: 'Spell_01', UNARMED: 'Unarmed_01' }[w] || 'Select_01'); }
    if (opts.kind === 'spell') AU.sfx('Spell_02');
    return origDice.call(UI, opts);
  };
  // 按鈕點擊音
  document.addEventListener('click', e => { if (e.target.closest('.actbtn, .tap, .confbtn, .btn, .tb')) AU.sfx('Click_01'); }, true);
  // 朋友那邊播放
  if (typeof NET !== 'undefined') {
    const gOn = NET.Guest.onMsg;
    NET.Guest.onMsg = function (m) {
      if (m.t === 'sfx') { AU.unlocked = true; return AU.sfx(m.n, true); }
      if (m.t === 'music') { AU.unlocked = true; return AU.music(m.k, true); }
      return gOn.call(NET.Guest, m);
    };
    const hOn = NET.Host.onMsg;
    NET.Host.onMsg = function (m, from) { if (m.t === 'hello' && AU.kind) NET.sendTo(from, { t: 'music', k: AU.kind }); return hOn.apply(NET.Host, arguments); };
  }

  // ==========================================================
  //  上方工具列：上一步、音量
  // ==========================================================
  window.addEventListener('load', () => {
    const rc = document.getElementById('btnRecenter');
    if (rc && !document.getElementById('btnUndo')) {
      const u = document.createElement('button'); u.className = 'tb'; u.id = 'btnUndo'; u.innerHTML = '<span>↶ 上一步</span>'; u.title = '回到上一步（擲骰、抽牌或揭露新內容後不能退回）';
      u.onclick = () => CE.doUndo(); rc.after(u);
      const s = document.createElement('button'); s.className = 'tb'; s.id = 'btnSound'; s.innerHTML = `<span>${AU.st.mute ? '🔇' : '🔊'} 聲音</span>`;
      s.onclick = () => {
        const w = CE.layer(`<h3 class="dlgTitle">聲音</h3>
          <div class="sndRow">音樂 <input type="range" min="0" max="1" step="0.05" id="sdM" value="${AU.st.music}"></div>
          <div class="sndRow">音效 <input type="range" min="0" max="1" step="0.05" id="sdS" value="${AU.st.sfx}"></div>
          <div class="sndRow"><label><input type="checkbox" id="sdX" ${AU.st.mute ? 'checked' : ''}> 全部靜音</label></div>
          <div class="btns"><button class="btn primary">關閉</button></div>`);
        w.box.querySelector('#sdM').oninput = e => { AU.st.music = +e.target.value; AU.apply(); AU.save(); };
        w.box.querySelector('#sdS').oninput = e => { AU.st.sfx = +e.target.value; AU.save(); };
        w.box.querySelector('#sdX').onchange = e => { AU.st.mute = e.target.checked; AU.apply(); AU.save(); s.innerHTML = `<span>${AU.st.mute ? '🔇' : '🔊'} 聲音</span>`; };
        w.box.querySelector('.btn').onclick = () => w.close();
      };
      u.after(s);
      updUndo();
    }
  });
})();

// ============================================================
//  探索後「你可以移動一格進入探索過的區域」：多 1 格移動（不扣行動）
// ============================================================
(function () {
  CE._newTiles = [];
  const oRev = Actions.RevealTile;
  Actions.RevealTile = function (a) { const t = G.tiles[goName(a.Tile)]; if (t && !t.revealed) CE._newTiles.push(t.id); return oRev.apply(Actions, arguments); };
  const EXPLORE_TXT = T('EXPLORE_MOVE');
  const oSay = Engine.say;
  Engine.say = async function (o) {
    const r = await oSay.apply(Engine, arguments);
    if (o && o.text && EXPLORE_TXT && o.text.includes(EXPLORE_TXT) && G.phase === 'investigator') {
      const a = CE.nodeActor != null ? CE.nodeActor : CE.actorNow();
      const iv = a != null && G.inv[a];
      if (iv) {
        CE.ensure(iv);
        const c = MAP.posCell(iv);
        if (iv.turn.move && iv.turn.move.left > 0) iv.turn.move.left += 1;
        else iv.turn.move = { left: 1, steps: 0, evaded: c ? c.id : null, free: true, tiles: CE._newTiles.slice(), door: CE._lastNode };
        Engine.log(`${iv.name} 可以多移動 1 格，進入剛探索的區域`);
        UI.toast(`${iv.name} 可以多移動 1 格，進入剛探索的區域（不扣行動）`);
        UI.render();
      }
    }
    return r;
  };
  // 開始一次新的互動時，清空「剛探索的板塊」
  const oClick = UI.clickNode;
  UI.clickNode = function (id) { CE._newTiles = []; CE._lastNode = id; return oClick.apply(UI, arguments); };
  // 免費的那 1 格：只能走進剛探索的板塊
  const oDrag = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    oDrag.call(UI, el, getObj, onClick);
    if (!el.dataset || el.dataset.inv == null) return;
    const i = +el.dataset.inv, down = el.onpointerdown;
    el.onpointerdown = e => {
      const iv = G.inv[i], o = getObj(), mv = iv && iv.turn && iv.turn.move;
      if (!mv || !mv.free || !o || mv.left <= 0) return down(e);
      const sx = o.x, sy = o.y;
      down(e);
      const up = el.onpointerup;
      el.onpointerup = ev => {
        const to = MAP.cellAt(o.x, o.y);
        if (to && Math.hypot(o.x - sx, o.y - sy) > 0.05 && mv.tiles.length && !mv.tiles.includes(to.tile)) { o.x = sx; o.y = sy; up && up(ev); UI.toast('這 1 格只能走進剛探索出來的區域'); UI.renderBoard(); return; }
        return up && up(ev);
      };
    };
  };
})();

// ============================================================
//  連線開新遊戲：兩個人都按「準備好」才能開始
// ============================================================
(function () {
  if (typeof NET === 'undefined') return;
  NET.ready = { host: false, g: {}, sig: '' };
  const hOn = NET.Host.onMsg;
  NET.Host.onMsg = function (m, from) { NET.fromGuest = from || true; try { return hOn.apply(NET.Host, arguments); } finally { NET.fromGuest = false; } };
  const oOpen = UI.openDialog;
  UI.openDialog = function (html) {
    const r = oOpen.call(UI, html);
    const st = document.getElementById('btnStart');
    if (!st || !NET.connected || NET.role !== 'host') return r;
    const sig = [...document.querySelectorAll('#dialog .pick.on')].map(e => e.dataset.id).join(',');
    const R = NET.ready;
    if (sig !== R.sig) { R.host = false; R.g = {}; R.sig = sig; }
    const ids = [...NET.peers.keys()];
    const both = R.host && ids.every(id => R.g[id]);
    const box = document.createElement('div'); box.className = 'readyBox';
    box.innerHTML = `<button class="btn ${both ? '' : 'primary'}" id="btnReady">✋ 準備好</button>
      <span class="${R.host ? 'ok' : ''}">主機：${R.host ? '✔' : '尚未準備'}</span>
      ${ids.map(id => `<span class="${R.g[id] ? 'ok' : ''}">${esc(NET.nameOf(id))}：${R.g[id] ? '✔' : '尚未準備'}</span>`).join('')}
      <span class="small">${both ? '大家都準備好了，可以開始！' : '選好調查員後，每個人都要按自己的「準備好」'}</span>`;
    st.closest('.btns').before(box);
    if (!both) { st.disabled = true; st.title = '每個人都按「準備好」才能開始'; }
    document.getElementById('btnReady').onclick = () => {
      const k = NET.fromGuest;
      if (k && k !== true) { R.g[k] = !R.g[k]; UI.toast(`${NET.nameOf(k)}${R.g[k] ? '準備好了' : '取消準備'}`); }
      else { R.host = !R.host; UI.toast(`主機${R.host ? '準備好了' : '取消準備'}`); }
      if (UI._redrawNew) UI._redrawNew();
    };
    return r;
  };
})();

// ==========================================================
//  保險：人偶不小心停在格子外面（拖曳中途被打斷等）→ 放回最後一個合法的位置
// ==========================================================
(function () {
  const lastOk = new WeakMap();
  const fix = () => {
    try {
      if (!G || !G.inv || !G.tiles) return;
      for (const iv of G.inv) {
        if (!iv || iv.removed || !isFinite(iv.x)) continue;
        if (MAP.posCell(iv)) { lastOk.set(iv, [iv.x, iv.y]); continue; }
        const p = lastOk.get(iv);
        if (p && !UI.dragging) { iv.x = p[0]; iv.y = p[1]; Engine.log(`${iv.name} 停在格子外面，放回原來的位置`); }
      }
    } catch (e) { }
  };
  const r0 = UI.render;
  UI.render = function () { fix(); return r0.apply(this, arguments); };
  document.addEventListener('pointerdown', e => { if (e.target && e.target.closest && e.target.closest('[data-inv]')) UI.dragging = true; }, true);
  document.addEventListener('pointerup', () => setTimeout(() => { UI.dragging = false; fix(); }, 300), true);
})();
