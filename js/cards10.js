// ============================================================
//  第 10 階段：詭鎮街道的自動化
//   1. 芬恩：每輪一次，搜索（黃色問號）之前或之後可以移動一格
//   2. 瑪麗·朗博：回合開始時，可以不花行動施放一個法術
//   3. 短管左輪：躲避失敗、行動被強制結束時，可以對同格怪物造成 1 點傷害
//   4. 額外行動（卡森、意識操縱）：另外計算，不和他自己的行動、移動混在一起
//   5. 法術的連帶效果自動處理（另一隻怪物受傷、範圍內所有怪物、火焰、範圍內的調查員）
//   6. 骨笛（你不能躲避怪物）：和怪物同格時只能攻擊；不能離開、不能交換或丟下骨笛
//      被推、被劇情或怪物移走（非自願移動）不受影響
// ============================================================
(function () {
  const has = (i, id) => CE.owned(i).some(it => it.id === id);
  const cellOf = o => o ? MAP.posCell(o) : null;
  const sameCell = (a, b) => a && b && a.id === b.id;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const busy = () => (G.fsms || []).some(f => f.running > 0) ||
    !UI.$('#overlay').classList.contains('hidden') ||
    (document.getElementById('cardLayer') || { classList: { contains: () => false } }).classList.contains('on') ||
    (typeof OFF !== 'undefined' && OFF.layer && !OFF.layer.classList.contains('hidden'));

  // ---------- 共用：怪物受傷 ----------
  CE.hurtMon = async function (m, n, why) {
    if (!m || !n || !G.monsters.includes(m)) return;
    m.dmg += n;
    Engine.log(`${T(m.name)} 受到 ${n} 點傷害${why ? '（' + why + '）' : ''}（${m.dmg}/${m.hp}）`);
    UI.toast(`${T(m.name)} 受到 ${n} 點傷害`);
    UI.render();
    if (m.dmg >= m.hp && await CE.ask('怪物被擊敗？', `${T(m.name)} 受到的傷害已達生命值（${m.dmg}/${m.hp}），確定被擊敗了嗎？`, '擊敗', '還沒')) await Engine.killMonster(m);
  };
  // 選怪物
  CE.chooseMonLayer = function (title, mons) {
    if (mons.length === 1) return Promise.resolve(mons[0]);
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">${mons.map((m, i) => `<div class="pick" data-i="${i}"><img src="img/monsters/${m.img}.png"><div>${esc(T(m.name))}<br><span class="small">${m.dmg}/${m.hp}</span></div></div>`).join('')}</div>`);
      w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { w.close(); res(mons[+el.dataset.i]); });
    });
  };
  // 在地圖上點一格
  CE._picking = null;
  CE.pickCellMap = function (title, cells) {
    if (!cells.length) return Promise.resolve(null);
    if (cells.length === 1) return Promise.resolve(cells[0]);
    return new Promise(res => {
      const bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#2a1d10;color:#ffd9a0;border:2px solid #ff9a3c;padding:10px 18px;border-radius:10px;z-index:9999;font-size:18px';
      bar.textContent = title;
      document.body.appendChild(bar);
      const done = c => { CE._picking = null; document.querySelectorAll('#world .cellPick').forEach(e => e.remove()); bar.remove(); res(c); };
      CE._picking = { cells, done };
      drawPick();
    });
  };
  function drawPick() {
    const P = CE._picking; if (!P) return;
    const W = UI.$('#world'); if (!W) return;
    W.querySelectorAll('.cellPick').forEach(e => e.remove());
    for (const c of P.cells) {
      const d = document.createElement('div'); d.className = 'cellPick';
      d.style.cssText = `position:absolute;left:${c.x * U - 50}px;top:${-c.y * U - 50}px;width:100px;height:100px;border-radius:50%;border:6px solid #ff9a3c;background:rgba(255,120,30,.35);z-index:60;cursor:pointer;box-shadow:0 0 24px #ff7a00`;
      d.onpointerdown = e => e.stopPropagation();
      d.onclick = e => { e.stopPropagation(); P.done(c); };
      W.appendChild(d);
    }
  }
  const rb = UI.renderBoard;
  UI.renderBoard = function () { const r = rb.apply(UI, arguments); try { drawPick(); } catch (e) { } return r; };
  // 可以放火的格子：自己這格＋相鄰格（隔著牆、門、不可通過的邊界也算），已有火焰的不行
  CE.fireSpots = function (idx) {
    const c = cellOf(G.inv[idx]); if (!c) return [];
    const g = MAP.build();
    return [c.id, ...MAP.touchAdj(c.id)].map(k => g.cells[k]).filter(x => x && !(CE.hasFire && CE.hasFire(x)));
  };
  // 一般的「放火」行動：也改成直接在地圖上點格子
  CE.actSetFire = async function (idx) {
    if (!cellOf(G.inv[idx])) return;
    if (!CE.fireSpots(idx).length) { UI.toast('你這格和相鄰的格子都已經有火焰了，不能放火'); return; }
    await CE.doAction(idx, 'other', async () => {
      const spots = CE.fireSpots(idx);
      const t = await CE.pickCellMap('請在地圖上點一格放火焰（你這格或相鄰格，隔著牆、門也算）', spots);
      if (t) CE.fireOn(t);
    });
  };
  // 放火焰標記到某一格
  CE.fireOn = function (c) {
    if (!c) return false;
    if (CE.hasFire && CE.hasFire(c)) { UI.toast('那一格已經有火焰了'); return false; }
    G.tokens.push({ id: Date.now() + Math.random(), kind: 'fire', x: c.x, y: c.y, item: null });
    Engine.log('放置 1 個火焰標記'); UI.render(); return true;
  };

  // ==========================================================
  //  4. 額外行動：不佔用他自己的行動，移動也另外計算
  // ==========================================================
  CE._exRes = null;
  CE.grantExtra = function (t, from, label) {
    const tv = G.inv[t]; CE.ensure(tv);
    tv.turn.extra = { acts: tv.turn.acts, move: tv.turn.move || null, done: !!tv.turn.done, active: from, label };
    tv.turn.move = null; tv.turn.done = false;
    tv.turn.acts = Math.max(0, CE.maxActs(tv) - 1);
    G.active = t;
    Engine.log(`${tv.name} 執行 1 個額外行動（${label}）`);
    UI.render();
    return new Promise(async res => {
      CE._exRes = res;
      await CE.alert(label, `${tv.name} 現在執行 1 個額外行動。\n\n・這個行動不佔用他自己這回合的行動。\n・如果是移動，就是另外的一次移動（最多 2 格），他自己原本的移動點數不受影響。\n\n做完後會自動回到 ${G.inv[from].name}。不想做可以按他欄位上的「略過額外行動」。`);
    });
  };
  CE.finishExtra = function (t) {
    const tv = G.inv[t]; const ex = tv && tv.turn && tv.turn.extra; if (!ex) return;
    tv.turn.acts = ex.acts; tv.turn.move = ex.move; tv.turn.done = ex.done; tv.turn.extra = null;
    G.active = ex.active;
    Engine.log(`${tv.name} 的額外行動結束，回到 ${G.inv[ex.active].name}`);
    UI.toast(`回到 ${G.inv[ex.active].name}`);
    UI.render();
    const r = CE._exRes; CE._exRes = null; if (r) r();
  };
  const exIdx = () => (G.inv || []).findIndex(v => v && v.turn && v.turn.extra);
  let exTimer = null;
  const checkExtra = () => {
    const t = exIdx(); if (t < 0 || exTimer) return;
    const tv = G.inv[t], mv = tv.turn.move;
    if (tv.turn.acts < CE.maxActs(tv) || (mv && mv.left > 0) || busy()) return;
    exTimer = setTimeout(() => {
      exTimer = null;
      const t2 = exIdx(); if (t2 !== t) return;
      const mv2 = tv.turn.move;
      if (tv.turn.acts < CE.maxActs(tv) || (mv2 && mv2.left > 0) || busy() || CE.pending === t) return;
      CE.finishExtra(t);
    }, 700);
  };
  const rr = UI.render;
  UI.render = function () { const r = rr.apply(UI, arguments); try { checkExtra(); } catch (e) { console.error(e); } return r; };
  setInterval(() => { try { if (G && G.inv && G.phase === 'investigator') checkExtra(); } catch (e) { } }, 1000);   // 額外行動做完、畫面沒再更新時，也會自動回到原本的人
  // 額外行動中按「結束回合」：只結束額外行動
  const et = CE.endTurn;
  CE.endTurn = async function (i, quiet) {
    const iv = G.inv[i];
    if (iv && iv.turn && iv.turn.extra) { CE.finishExtra(i); return; }
    if (iv && iv.turn) iv.turn.freeSpell = null;
    return et.apply(this, arguments);
  };
  // 調查員欄：額外行動的提示和「略過」按鈕
  const ic = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = ic.apply(this, arguments);
    try {
      if (iv.turn && iv.turn.extra) {
        const bar = d.querySelector('.turnBar');
        if (bar) {
          const tag = document.createElement('div');
          tag.className = 'small'; tag.style.cssText = 'color:#ffcf6a;margin:2px 0';
          tag.textContent = `額外行動中（${iv.turn.extra.label}）：不佔用自己的行動`;
          bar.before(tag);
          const b = document.createElement('button'); b.className = 'tbtn'; b.textContent = '略過額外行動';
          b.onclick = e => { e.stopPropagation(); CE.finishExtra(idx); };
          const end = bar.querySelector('.end'); if (end) end.replaceWith(b); else bar.appendChild(b);
        }
      }
    } catch (e) { console.error(e); }
    return d;
  };
  // 卡森：改用額外行動
  const ua = CE.useAbility;
  CE.useAbility = async function (idx) {
    const iv = G.inv[idx];
    if (!iv || iv.id !== 'INVESTIGATOR_CARSON_SINCLAIR') return ua.apply(this, arguments);
    const others = (CE.invsInRange(idx) || CE.alive().filter(j => j !== idx));
    if (!others.length) { UI.toast('範圍內沒有其他調查員'); return; }
    const t = await CE.chooseInvLayer(`${iv.name} 的能力：選範圍內的另一名調查員`, others);
    if (t == null) return;
    await CE.doAction(idx, 'other', async () => { CE.markRound(iv, '__ability'); await CE.grantExtra(t, idx, '卡森的能力'); });
  };

  // ==========================================================
  //  1. 芬恩：搜索前後移動一格（每輪一次）
  // ==========================================================
  const FINN = 'INVESTIGATOR_FINN_EDWARDS';
  const finnMove = (a, when) => {
    const iv = G.inv[a]; CE.ensure(iv);
    CE.markRound(iv, '__finn');
    iv.turn.move = { left: 1, steps: 0, evaded: null, finn: true };
    Engine.log(`${iv.name} 的能力：搜索${when}移動 1 格（不花行動）`);
    UI.toast(`${iv.name} 可以移動 1 格（不花行動），請拖曳人偶`);
    UI.render();
  };
  const oc = UI.clickNode;
  UI.clickNode = async function (id) {
    const a = CE.pending;
    if (a == null || !/^(SEARCH|SERACH)/.test(nodeTag(id)) || G.phase !== 'investigator' || !G.inv[a] || G.inv[a].id !== FINN) return oc.apply(UI, arguments);
    const iv = G.inv[a];
    if (!CE.usedRound(iv, '__finn') && UI.$('#overlay').classList.contains('hidden')) {
      // 每輪一次：搜索之前都問一次要不要先移動一格
      if (await CE.ask('芬恩的能力', `${iv.name} 要搜索了。\n每輪一次，可以在搜索之前（或之後）移動一格，不花行動。\n要先移動一格嗎？移好後再點一次這個標記搜索。`, '先移動一格', '直接搜索')) { finnMove(a, '前'); return; }
    }
    const r = await oc.apply(UI, arguments);
    if (CE.pending === null && !CE.usedRound(iv, '__finn')) {
      const f = G.fsmByObj[id];
      if (f && f.running > 0) await f.whenIdle();
      await wait(250);
      while (busy()) await wait(250);
      if (!G.gameOver && G.phase === 'investigator' && !CE.usedRound(iv, '__finn') &&
        await CE.ask('芬恩的能力', `${iv.name} 搜索完了。\n每輪一次，可以在搜索之後移動一格（不花行動）。要移動嗎？`, '移動一格', '不用')) finnMove(a, '後');
    }
    return r;
  };

  // ==========================================================
  //  2. 瑪麗·朗博：回合開始時，可以不花行動施放一個法術
  // ==========================================================
  const MARIE = 'INVESTIGATOR_MARIE_LAMBEAU';
  const ts = CE.turnStart;
  CE.turnStart = async function (i) {
    const iv = G.inv[i];
    const first = iv && iv.turn && !iv.turn.started && !(iv.turn.acts > 0) && !iv.turn.extra;
    const r = await ts.apply(this, arguments);
    if (first && iv.id === MARIE && G.phase === 'investigator' && !iv.turn.done && !G.gameOver) await marie(i);
    return r;
  };
  async function marie(i) {
    const iv = G.inv[i];
    const sp = CE.owned(i).filter(it => CE.isSpell(it.id));
    if (!sp.length) return;
    const w = CE.layer(`<h3 class="dlgTitle">${esc(iv.name)} 的能力</h3><div class="msg">回合開始時，可以不花行動施放一個法術：</div>
      <div class="btns" style="flex-direction:column;align-items:stretch">${sp.map((it, k) => `<button class="btn primary" data-k="${k}">施放【${esc(CARDS.spells[it.id].name)}】</button>`).join('')}<button class="btn" data-k="-1">不使用</button></div>`);
    const k = await new Promise(res => w.box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { w.close(); res(+b.dataset.k); }));
    if (k < 0) return;
    const it = sp[k], def = CARDS.spells[it.id];
    if (def.front && def.front.w) {
      const ms = CE.monstersInRange(i);
      if (ms && !ms.length) { await CE.alert(def.name, '範圍內沒有怪物可以攻擊，這次不能施放。'); return; }
      iv.turn.freeSpell = { kind: 'attack', id: it.id };
      await CE.alert(def.name, `請點要攻擊的怪物 →「攻擊」，在擲骰畫面選【${def.name}】。\n這次攻擊不花行動。`);
    } else {
      iv.turn.freeSpell = { kind: 'other', id: it.id };
      await CE.useItem(it);
      if (iv.turn.freeSpell) iv.turn.freeSpell = null;   // 取消了就作廢
    }
  }
  const sr = CE.spendRaw;
  CE.spendRaw = function (idx, kind) {
    const iv = G.inv[idx], fs = iv && iv.turn && iv.turn.freeSpell;
    if (fs && G.phase === 'investigator' && (kind === fs.kind || (fs.kind === 'other' && kind === 'other'))) {
      iv.turn.freeSpell = null;
      Engine.log(`${iv.name} 的能力：施放法術不花行動`);
      UI.toast('瑪麗·朗博的能力：這次不花行動');
      UI.render();
      return true;
    }
    return sr.apply(this, arguments);
  };

  // ==========================================================
  //  3. 短管左輪：躲避失敗、行動被強制結束
  // ==========================================================
  const SNUB = 'COMMON_ITEM_SNUBNOSE_REVOLVER';
  const snub = async idx => {
    const iv = G.inv[idx]; if (!iv || !has(idx, SNUB)) return;
    const c = cellOf(iv);
    const ms = G.monsters.filter(m => sameCell(cellOf(m), c));
    if (!ms.length) return;
    if (!(await CE.ask('短管左輪', `${iv.name} 的行動被強制結束。\n可以用【短管左輪】對一隻同格的怪物造成 1 點傷害。`, '造成 1 點傷害', '不用'))) return;
    const m = await CE.chooseMonLayer('對哪一隻怪物？', ms);
    await CE.hurtMon(m, 1, '短管左輪');
  };
  const ef = CE.evadeFirst;
  CE.evadeFirst = async function (idx) { const ok = await ef.apply(this, arguments); if (!ok) await snub(idx); return ok; };
  const me = CE.moveEvade;
  CE.moveEvade = async function (idx) { await me.apply(this, arguments); const iv = G.inv[idx]; if (iv && iv.turn && !iv.turn.move) await snub(idx); };

  // ==========================================================
  //  5. 法術的連帶效果
  // ==========================================================
  const S = CARDS.spells;
  const setEff = (id, i, eff) => { if (S[id] && S[id].backs[i]) S[id].backs[i].eff = eff; };
  setEff('SPELL_SHRIVELING', 3, { horror: 1, otherMon: 3 });
  setEff('SPELL_WITHER', 3, { otherMon: 2, orInvDown: 1 });
  if (S.SPELL_AZURE_FLAME) {
    const b = S.SPELL_AZURE_FLAME.backs;
    b[1].eff = { choose: [{ label: '受到1點恐怖', eff: { horrorUp: 1 } }, { label: '在相鄰一格放置1個火焰標記', eff: { fireAdj: true } }] };
    b[2].eff = { monster: 1, fireAtMon: true };
    b[4].eff = { allMonRange: 1, horrorUp: 1 };
  }
  if (S.SPELL_IMPLANT_SUGGESTION) {
    S.SPELL_IMPLANT_SUGGESTION.backs[4].fail = { horrorUp: 1, otherInvHorrorUp: 1 };
    const a = S.SPELL_IMPLANT_SUGGESTION.front.act; a.grantAction = false; a.extraAction = true;
  }
  // 意識操縱正面：另一名調查員執行 1 個額外行動（做完才翻面）
  const usf = CE.useSpellFront;
  CE.useSpellFront = async function (it, idx, target) {
    const sp = S[it.id], a = (sp && sp.front.act) || {};
    if (a.extraAction && target != null && target !== idx) await CE.grantExtra(target, idx, sp.name);
    return usf.apply(this, arguments);
  };
  const se = CE.spellEff;
  CE.spellEff = async function (e, casterIdx, targetIdx, mon) {
    if (!e) return se.apply(this, arguments);
    const NEW = ['otherMon', 'orInvDown', 'allMonRange', 'fireAtMon', 'fireAdj', 'otherInvHorrorUp', 'area'];
    if (!NEW.some(k => e[k])) return se.apply(this, arguments);
    const rest = Object.assign({}, e); NEW.forEach(k => delete rest[k]);
    const me = G.inv[casterIdx];
    // 範圍內／同格的其他調查員：自動算
    let areaList = null;
    if (e.area) {
      areaList = CE.invsInRange(casterIdx, e.area === 'space');
      if (areaList == null) return se.apply(this, arguments);   // 位置不明：照舊手動選
      const q = e.area === 'range' ? '範圍內（3 格內）' : '同一格';
      if (areaList.length) await CE.alert('法術效果', `${q}的其他調查員也一起受到：${areaList.map(j => G.inv[j].name).join('、')}`);
    }
    await se.call(this, rest, casterIdx, targetIdx, mon);
    if (areaList) for (const j of areaList) {
      const tv = G.inv[j];
      if (e.horror) await CE.suffer(tv, 'horror', e.horror, true);
      if (e.damage) await CE.suffer(tv, 'damage', e.damage, true);
      await CE.checkLimit(tv, 'damage'); await CE.checkLimit(tv, 'horror');
    }
    const inR = CE.monstersInRange(casterIdx) || [];
    if (e.otherMon) {
      const others = inR.filter(m => m !== mon);
      if (others.length) { const m = await CE.chooseMonLayer(`範圍內的哪一隻怪物受到 ${e.otherMon} 點傷害？`, others); await CE.hurtMon(m, e.otherMon, '法術'); }
      else if (e.orInvDown) {
        const invs = CE.invsInRange(casterIdx) || [];
        if (invs.length) {
          const j = invs.length === 1 ? invs[0] : await CE.chooseInvLayer('範圍內沒有其他怪物：哪一名調查員受到 1 點面朝下的傷害？', invs);
          if (j != null) { await CE.suffer(G.inv[j], 'damage', e.orInvDown, true); await CE.checkLimit(G.inv[j], 'damage'); }
        } else await CE.alert('法術效果', '範圍內沒有其他怪物，也沒有其他調查員，沒有額外效果。');
      } else await CE.alert('法術效果', '範圍內沒有其他怪物，沒有額外效果。');
    }
    if (e.allMonRange) {
      const all = inR.slice(); if (mon && G.monsters.includes(mon) && !all.includes(mon)) all.push(mon);
      if (all.length) await CE.alert('法術效果', `範圍內的怪物各受到 ${e.allMonRange} 點傷害：${all.map(m => T(m.name)).join('、')}`);
      for (const m of all) await CE.hurtMon(m, e.allMonRange, '法術');
    }
    if (e.fireAtMon) {
      const c = mon && G.monsters.includes(mon) ? cellOf(mon) : null;
      if (c) { if (CE.fireOn(c)) UI.toast('已在怪物的格子放上火焰'); }
      else await CE.alert('法術效果', '請在怪物所在的格子放置 1 個火焰標記。');
    }
    if (e.fireAdj) {
      const adj = CE.fireSpots(casterIdx);
      if (adj.length) { const t = await CE.pickCellMap('請在地圖上點一格放火焰（你這格或相鄰格，隔著牆、門也算）', adj); if (t) CE.fireOn(t); }
      else await CE.alert('法術效果', '你這格和相鄰的格子都已經有火焰（或找不到你的位置），不能放火。');
    }
    if (e.otherInvHorrorUp) {
      const invs = CE.invsInRange(casterIdx) || [];
      if (invs.length) {
        const j = invs.length === 1 ? invs[0] : await CE.chooseInvLayer('範圍內的哪一名調查員也受到 1 點恐怖？', invs);
        if (j != null) { await CE.suffer(G.inv[j], 'horror', e.otherInvHorrorUp, false); await CE.checkLimit(G.inv[j], 'horror'); }
      }
    }
    UI.render();
  };

  // ==========================================================
  //  6. 骨笛：你不能躲避怪物
  //   規則：和怪物同格時，要離開或做攻擊以外的行動都要先躲避 → 持有骨笛就不能做
  //   非自願被移出（被推、劇情、怪物效果）不需要躲避，所以不擋
  // ==========================================================
  const PIPES = 'UNIQUE_ITEM_BONE_PIPES';
  const PIPES_MSG = '持有骨笛：不能躲避，和怪物同一格時只能攻擊';
  const stuck = idx => idx != null && G.inv[idx] && G.phase === 'investigator' && has(idx, PIPES) && !!(CE.monsterHere && CE.monsterHere(idx));
  CE.pipesStuck = stuck;
  // 要躲避的行動（移動、搜索、交換、使用物品、施法…）：直接擋下，不扣行動
  const ef6 = CE.evadeFirst;
  CE.evadeFirst = async function (idx, kind) {
    if (kind !== 'attack' && stuck(idx)) { UI.toast(PIPES_MSG); return false; }
    return ef6.apply(this, arguments);
  };
  // 移動途中想拖出怪物的格子
  const me6 = CE.moveEvade;
  CE.moveEvade = async function (idx) {
    if (stuck(idx)) { const mv = G.inv[idx].turn && G.inv[idx].turn.move; if (mv) mv.left = 0; UI.toast(PIPES_MSG); await CE.endMove(idx); return; }
    return me6.apply(this, arguments);
  };
  // 移動中走進有怪物的格子（或芬恩的免費移動從怪物格開始）：剩下的移動作廢
  let pipesBusy = false;
  const r6 = UI.render;
  UI.render = function () {
    const r = r6.apply(UI, arguments);
    try {
      const i = G.active, iv = i != null && G.inv[i], mv = iv && iv.turn && iv.turn.move;
      if (!pipesBusy && mv && mv.left > 0 && stuck(i)) {
        pipesBusy = true;
        const msg = mv.steps > 0 ? '持有骨笛：走進了有怪物的格子，不能再離開，剩下的移動作廢' : '持有骨笛：和怪物同一格，不能離開';
        mv.left = 0;
        Engine.log(`${iv.name} ${msg}`);
        Promise.resolve(CE.endMove(i)).finally(() => { pipesBusy = false; UI.toast(msg); });
      }
    } catch (e) { console.error(e); pipesBusy = false; }
    return r;
  };
  // 和怪物同格時：骨笛不能交換、丟下、丟棄（物品視窗、交換視窗的按鈕）
  const pipesItem = id => { const it = (G.items || []).find(x => x.id === id); return it && it.id === PIPES && it.owner != null && stuck(it.owner) ? it : null; };
  const id6 = UI.itemDetail;
  UI.itemDetail = function (it) { CE._detailItem = it; return id6.apply(this, arguments); };
  const blockMsg = '持有骨笛：和怪物同一格時，不能交換、丟下或丟棄骨笛';
  window.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-drop],[data-give],#itDrop');
    if (!b) return;
    const it = b.id === 'itDrop' ? CE._detailItem : (G.items || []).find(x => x.id === (b.dataset.drop || b.dataset.give));
    if (it && pipesItem(it.id)) { e.stopImmediatePropagation(); e.preventDefault(); UI.toast(blockMsg); }
  }, true);
  window.addEventListener('change', e => {
    if (!e.target || e.target.id !== 'giveSel') return;
    const it = CE._detailItem;
    if (it && pipesItem(it.id)) { e.stopImmediatePropagation(); e.target.value = it.owner; UI.toast(blockMsg); }
  }, true);

  // ==========================================================
  //  7. 推：被推的調查員不能用拖的（不是行動中的人）→ 改成在地圖上點格子
  //     被推是非自願移動，不需要躲避（骨笛也不擋）
  // ==========================================================
  const moveInvTo = async (j, c) => {
    const iv = G.inv[j]; iv.x = c.x; iv.y = c.y;
    MAP.snap(iv, G.inv.filter(v => !v.removed));
    Engine.log(`${iv.name} 被推到相鄰的格子`);
    UI.render();
    if (CE.hasFire && CE.hasFire(c)) { await CE.alert('火焰', `${iv.name} 被推進有火焰的格子，受到 1 點面朝下的傷害。`); await CE.suffer(iv, 'damage', 1, true); await CE.checkLimit(iv, 'damage'); }
  };
  const al7 = CE.alert;
  CE.alert = async function (title, text) {
    const m = (title === '推' || title === '推成功') && typeof text === 'string' && text.match(/^(.+?) 移動 1 格，然後 (.+?) 也可以跟著移動 1 格/);
    const j = m ? G.inv.findIndex(v => v && !v.removed && v.name === m[1]) : -1;
    if (j < 0) return al7.apply(this, arguments);   // 不是推調查員（推怪物：照舊拖曳怪物）
    const r = await al7.call(this, title, text.replace('（請拖曳人偶）', '（接下來在地圖上點格子）'), arguments[2]);
    const c = cellOf(G.inv[j]);
    const cells = c ? MAP.moveAdj(c.id).map(k => MAP.build().cells[k]).filter(Boolean) : [];
    if (!cells.length) { await al7.call(CE, '推', `${G.inv[j].name} 的旁邊沒有可以走過去的格子，留在原地。`); return r; }
    const t = await CE.pickCellMap(`${G.inv[j].name} 被推到哪一格？`, cells);
    if (t) await moveInvTo(j, t);
    const a = G.inv.findIndex(v => v && v.name === m[2]);
    const ac = a >= 0 ? cellOf(G.inv[a]) : null;
    if (ac && await CE.ask('推', `${G.inv[a].name} 要跟著移動 1 格嗎？`, '跟著移動', '不用')) {
      const cs = MAP.moveAdj(ac.id).map(k => MAP.build().cells[k]).filter(Boolean);
      const t2 = await CE.pickCellMap(`${G.inv[a].name} 移動到哪一格？`, cs);
      if (t2) { const v = G.inv[a]; v.x = t2.x; v.y = t2.y; MAP.snap(v, G.inv.filter(x => !x.removed)); Engine.log(`${v.name} 跟著移動 1 格`); UI.render(); if (CE.hasFire(t2)) { await CE.alert('火焰', `${v.name} 走進有火焰的格子，受到 1 點面朝下的傷害。`); await CE.suffer(v, 'damage', 1, true); await CE.checkLimit(v, 'damage'); } }
    }
    return r;
  };
})();
