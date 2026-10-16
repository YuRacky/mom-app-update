// ============================================================
//  第 5 階段：怪物圖板、範圍自動計算、恐怖步驟、蠻力
// ============================================================
(function () {
  const MON = id => CARDS.monsters[id] || null;
  CE.monStat = m => MON(m.model) || {};
  const invCell = i => MAP.posCell(G.inv[i]);
  const monCell = m => MAP.posCell(m);

  // ---------- 拖曳放下貼齊格子 ----------
  const origDrag = UI.makeDraggable;
  UI.makeDraggable = function (el, getObj, onClick) {
    origDrag.call(UI, el, getObj, onClick);
    const down = el.onpointerdown;
    el.onpointerdown = e => {
      const o0 = getObj(); const sx = o0 ? o0.x : 0, sy = o0 ? o0.y : 0;
      down(e);
      const up = el.onpointerup;
      if (!up) return;
      el.onpointerup = ev => {
        up(ev);
        const o = getObj();
        if (o && Math.hypot(o.x - sx, o.y - sy) < 0.05) return;
        if (o && (G.inv.includes(o) || G.monsters.includes(o))) {
          MAP.snap(o, [...G.inv.filter(x => !x.removed), ...G.monsters]);
          UI.renderBoard();
        }
      };
    };
  };

  // ---------- 範圍查詢 ----------
  CE.monstersInRange = i => { const c = invCell(i); if (!c) return null; const d = MAP.rangeDist(c.id); return G.monsters.filter(m => { const mc = monCell(m); return mc && d[mc.id] != null; }); };
  CE.invsInRange = (i, sameOnly) => { const c = invCell(i); if (!c) return null; const d = sameOnly ? { [c.id]: 0 } : MAP.rangeDist(c.id); return CE.alive().filter(j => j !== i && invCell(j) && d[invCell(j).id] != null); };
  CE.rangeCount = i => { const c = invCell(i); if (!c) return null; return Object.keys(MAP.rangeDist(c.id)).length; };
  CE.inDark = i => {
    const c = invCell(i); if (!c) return null;
    const darks = [...G.tokens.filter(t => t.kind === 'dark'), ...Object.values(G.nodes).filter(n => n.visible && /Darkness/.test(n.sprite || ''))];
    return darks.some(t => { const tc = MAP.cellAt(t.x, t.y); return tc && tc.id === c.id; });
  };
  // 回合結束檢查：改成自動判斷，再讓玩家確認
  const origAsk = CE.ask;
  CE.autoAsk = async function (title, q, auto) {
    if (auto == null) return origAsk(title, q);
    return origAsk(title, `${q}\n\n依地圖判斷：[b]${auto ? '是' : '否'}[/b]（如果地圖上的位置不對，請選正確的答案）`, auto ? '是（套用）' : '是', auto ? '否' : '否（不套用）');
  };
  const origTE = CE.onTurnEnd;
  CE.onTurnEnd = async function (i) {
    const saved = CE.ask;
    CE.ask = (title, q, y, n) => {
      let auto = null;
      if (/範圍內（3 格內）有其他調查員/.test(q)) { const r = CE.invsInRange(i); auto = r ? r.length > 0 : null; }
      else if (/格子數量是否少於或等於 2/.test(q)) { const n2 = CE.rangeCount(i); auto = n2 == null ? null : n2 <= 2; }
      else if (/所在的格子有黑暗/.test(q)) auto = CE.inDark(i);
      else if (/格子中有其他調查員/.test(q)) { const r = CE.invsInRange(i, true); auto = r ? r.length > 0 : null; }
      return CE.autoAsk(title, q, auto);
    };
    try { return await origTE.call(CE, i); } finally { CE.ask = saved; }
  };

  // ---------- 怪物：在地圖、怪物列、怪物頁顯示圖板數字 ----------
  const origBoard = UI.renderBoard;
  UI.renderBoard = function () {
    origBoard.apply(UI, arguments);
    G.monsters.forEach(m => {
      const st = CE.monStat(m); const el = document.querySelector(`#world [data-mon="${m.uid}"]`);
      if (!el || st.aw == null) return;
      el.insertAdjacentHTML('beforeend', `<span class="mAw" title="察覺">${st.aw}</span><span class="mHr" title="恐懼">${st.hr}</span>`);
    });
  };
  const origDock = UI.renderDock;
  UI.renderDock = function () {
    origDock.apply(UI, arguments);
    G.monsters.forEach(m => {
      const st = CE.monStat(m); const el = document.querySelector(`#monsterDock [data-m="${m.uid}"]`);
      if (!el || st.aw == null) return;
      el.insertAdjacentHTML('beforeend', `<span class="mAw">${st.aw}</span><span class="mHr">${st.hr}</span>`);
    });
  };
  const origSheet = UI.monsterSheet;
  UI.monsterSheet = function (uid) {
    origSheet.call(UI, uid);
    const m = G.monsters.find(x => x.uid === UI.selMonster); if (!m) return;
    const st = CE.monStat(m);
    const box = document.querySelector('#sheetInner .mpanel > div:last-child');
    if (!box || st.aw == null) return;
    box.insertAdjacentHTML('afterbegin', `<div class="mtoken">
      <div class="mtF"><img src="img/monsters/${m.img}.png"><span class="mAw big">${st.aw}</span><span class="mHr big">${st.hr}</span><div class="small">正面：<b style="color:#7fd06a">察覺 ${st.aw}</b>（躲避時用）　<b style="color:#7fb0ff">恐懼 ${st.hr}</b>（恐怖檢定時用）</div></div>
      <div class="mtB"><div class="mtFl">${esc(st.flavor || '')}</div>${st.kw.map(k => `<div class="mtKw"><b>${esc(k)}</b>：${esc(CARDS.keywords[k])}</div>`).join('')}<div class="small">背面：<b style="color:#ff8a7a">蠻力 ${st.brawn}</b>（推開屏障時擲的骰子數）</div></div></div>`);
    const btns = box.querySelector('.btns');
    if (btns) {
      btns.insertAdjacentHTML('beforeend', `<button class="btn" id="mBrawn">推開屏障（擲 ${st.brawn} 顆）</button>`);
      document.getElementById('mBrawn').onclick = () => CE.brawnRoll(m);
      // 躲避：檢查同格察覺更高的怪物
      const ev = document.getElementById('mEva'); const oe = ev.onclick;
      ev.onclick = async () => {
        const c = monCell(m);
        const same = c ? G.monsters.filter(x => x !== m && monCell(x) && monCell(x).id === c.id && (CE.monStat(x).aw || 0) > st.aw) : [];
        if (same.length) {
          const hi = same.sort((a, b) => CE.monStat(b).aw - CE.monStat(a).aw)[0];
          if (await origAsk('躲避對象', `同一格中，${T(hi.name)} 的察覺（${CE.monStat(hi).aw}）比 ${T(m.name)}（${st.aw}）高。\n規則：要對察覺最高的怪物躲避。要改成對 ${T(hi.name)} 躲避嗎？`, '改成它', '維持原本')) { UI.closeSheet(); await Engine.runMonsterTemplate(hi, 'evade', 'MONSTER/EVADE/START'); return; }
        }
        oe();
      };
      // 恐怖檢定按鈕 → 恐怖步驟流程
      const hb = document.getElementById('mHor');
      hb.onclick = () => { UI.closeSheet(); CE.horrorStep(); };
    }
  };
  // 蠻力：擲骰，2 個以上成功推開屏障
  CE.brawnRoll = async function (m) {
    const st = CE.monStat(m), n = st.brawn || 0;
    const dice = Array.from({ length: n }, () => UI.rollDie());
    const s = dice.filter(d => d === 'S').length, ok = s >= 2;
    Engine.log(`${T(m.name)} 嘗試推開屏障：擲 ${n} 顆，成功 ${s}`);
    await CE.alert(`${T(m.name)} 推開屏障`, `蠻力 ${n}：擲 ${n} 顆骰 → 成功 ${s} 個。\n${ok ? '[b]成功！[/b]棄除屏障，怪物照常移動。' : '[b]失敗[/b]，屏障擋住了怪物。'}`);
    if (ok) {
      const c = monCell(m);
      const near = G.tokens.filter(t => t.kind === 'barricade').sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
      if (near && Math.hypot(near.x - m.x, near.y - m.y) < 1.6 && await origAsk('移除屏障', '要移除怪物旁邊的屏障標記嗎？', '移除', '我自己處理')) { G.tokens.splice(G.tokens.indexOf(near), 1); UI.render(); }
    }
  };

  // ---------- 恐怖步驟 ----------
  CE.horrorStep = async function () {
    if (!G.monsters.length) { UI.toast('沒有怪物'); return; }
    if (CE._hsBusy) return; CE._hsBusy = true;
    try { return await CE._horrorStep(); } finally { CE._hsBusy = false; }
  };
  CE._horrorStep = async function () {
    const plan = {}; CE._hsTie = {};
    CE.alive().forEach(i => {
      const list = CE.monstersInRange(i);
      if (list == null) { plan[i] = null; return; }
      const best = list.sort((a, b) => (CE.monStat(b).hr || 0) - (CE.monStat(a).hr || 0))[0];
      plan[i] = best ? best.uid : 0;
      if (best && list.filter(m => (CE.monStat(m).hr || 0) === (CE.monStat(best).hr || 0) && m.model !== best.model).length) (CE._hsTie = CE._hsTie || {})[i] = true;
    });
    const ok = await new Promise(res => {
      const w = CE.layer('');
      const draw = () => {
        w.box.innerHTML = `<h3 class="dlgTitle">恐怖步驟</h3>
          <div class="msg" style="font-size:14px">每位調查員對自己範圍內（3 格內）<b>恐懼最高</b>的怪物做恐怖檢定；對同一隻怪物的人共用同一段檢定，各自擲骰。\n下面是依地圖算出的建議，請確認或更改。</div>
          ${CE.alive().map(i => `<div class="hsRow"><img src="${G.inv[i].img}"><b>${esc(G.inv[i].name)}</b>
            <select data-i="${i}"><option value="0" ${plan[i] === 0 ? 'selected' : ''}>範圍內沒有怪物（不用檢定）</option>${G.monsters.map(m => `<option value="${m.uid}" ${plan[i] === m.uid ? 'selected' : ''}>${esc(T(m.name))}（恐懼 ${CE.monStat(m).hr ?? '?'}）</option>`).join('')}</select>
            ${plan[i] === null ? '<span class="small">（不在地圖格子上，請自己選）</span>' : CE._hsTie && CE._hsTie[i] ? '<span class="small" style="color:#ffd36b">（有恐懼相同的怪物，規則：由這位調查員自己選）</span>' : ''}</div>`).join('')}
          <div class="btns"><button class="btn" id="hsNo">取消</button><button class="btn primary" id="hsGo">開始</button></div>`;
        w.box.querySelectorAll('select').forEach(s => s.onchange = () => { plan[+s.dataset.i] = +s.value; });
        w.box.querySelector('#hsNo').onclick = () => { w.close(); res(false); };
        w.box.querySelector('#hsGo').onclick = () => { w.close(); res(true); };
      };
      CE.alive().forEach(i => { if (plan[i] == null) plan[i] = 0; });
      draw();
    });
    if (!ok) return;
    const groups = {};
    for (const [i, uid] of Object.entries(plan)) if (uid) (groups[uid] = groups[uid] || []).push(+i);
    if (!Object.keys(groups).length) { await CE.alert('恐怖步驟', '沒有調查員需要做恐怖檢定。'); return; }
    for (const [uid, invs] of Object.entries(groups)) {
      const m = G.monsters.find(x => x.uid === +uid); if (!m) continue;
      CE.horrorGroup = invs;
      UI.toast(`${T(m.name)} 的恐怖檢定：${invs.map(i => G.inv[i].name).join('、')}`);
      try { await Engine.runMonsterTemplate(m, 'horror', 'MONSTER/HORROR/START'); } finally { CE.horrorGroup = null; }
    }
    G.ce.horrorDone = G.round;
    UI.render();
  };
  // 恐怖檢定的訊息：擲骰按鈕依序讓同組每個人擲
  const origDice = UI.diceDialog;
  UI.diceDialog = async function (opts = {}) {
    if (opts.kind === 'horror' && CE.horrorGroup && CE.horrorGroup.length && opts.inv == null) {
      let last = 0;
      for (const i of CE.horrorGroup) { last = await origDice.call(UI, Object.assign({}, opts, { inv: i, negate: opts.negate ? JSON.parse(JSON.stringify(opts.negate)) : null })); }
      return last;
    }
    return origDice.call(UI, opts);
  };
  // 恐怖檢定的「是否進行恐怖檢定？」在恐怖步驟中自動確認
  const origSay = Engine.say;
  Engine.say = function (o) {
    if (CE.horrorGroup && o && o.buttons && o.buttons.length === 2 && /是否進行恐怖檢定/.test(o.text || '')) {
      const b = o.buttons.find(x => /CONFIRM/.test(x.ev)) || o.buttons[1];
      return Promise.resolve(b.ev);
    }
    if (CE.horrorGroup && o && o.text) o = Object.assign({}, o, { text: `［${CE.horrorGroup.map(i => G.inv[i].name).join('、')}］\n` + o.text });
    return origSay.call(Engine, o);
  };
  // 神秘階段的恐怖步驟訊息後，自動開啟恐怖步驟
  const origRun = Engine.runMythosSequence;
  Engine.runMythosSequence = async function () {
    await origRun.apply(Engine, arguments);
    if (G.horrorStep && G.monsters.length && !G.gameOver && G.ce.horrorDone !== G.round) await CE.horrorStep();
  };

  // ---------- 炸藥：自動列出被炸到的人和怪物 ----------
  const origEnd = Engine.endInvestigatorPhase;
  Engine.endInvestigatorPhase = async function () {
    if (G.phase === 'investigator' && !G.gameOver) {
      for (const t of G.tokens.filter(x => x.kind === 'dynamite')) {
        const c = MAP.cellAt(t.x, t.y);
        if (!c) continue;
        const area = new Set([c.id, ...MAP.moveAdj(c.id)]);
        const invs = CE.alive().filter(i => invCell(i) && area.has(invCell(i).id));
        const mons = G.monsters.filter(m => monCell(m) && area.has(monCell(m).id));
        if (await origAsk('炸藥爆炸！', `依地圖判斷，爆炸範圍內有：\n調查員：${invs.map(i => G.inv[i].name).join('、') || '沒有'}（各受 8 點傷害）\n怪物：${mons.map(m => T(m.name)).join('、') || '沒有'}（各受 10 點傷害）\n\n要自動套用嗎？`, '自動套用', '我自己處理')) {
          for (const i of invs) await CE.suffer(G.inv[i], 'damage', 8, false);
          for (const m of mons) m.dmg += 10;
        }
        G.tokens.splice(G.tokens.indexOf(t), 1);
        const it = G.items.find(x => x.id === t.item); if (it) CE.discardItem(it, '爆炸');
        UI.render();
        for (const m of mons.filter(m => m.dmg >= m.hp)) if (await origAsk('怪物被擊敗？', `${T(m.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`, '擊敗', '還沒')) await Engine.killMonster(m);
      }
    }
    return origEnd.apply(Engine, arguments);
  };
})();
