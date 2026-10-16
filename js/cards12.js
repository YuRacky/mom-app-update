// ============================================================
//  2026-10-10：噩夢迭起／不堪回首 16 位調查員的能力（凱特、皮特在 cards11）
// ============================================================
(function () {
  const ID = s => 'INVESTIGATOR_' + s;
  const idxOf = id => G.inv ? G.inv.findIndex(iv => iv.id === id && !iv.removed) : -1;
  const NAMEH = { damage: '傷害', horror: '恐怖' };
  const inRangeOf = (i, j) => { const r = CE.invsInRange(i); return r == null || r.includes(j); };

  // ---------- 1. 「行動：」能力按鈕（珍妮、文森特、卡羅琳、哈維）----------
  const ACT = {
    [ID('JENNY_BARNES')]: { tip: '沒有線索時：獲得 2 線索，並棄除 1 張恐怖卡', why: iv => iv.clues > 0 ? '你還有線索，不能使用' : '' },
    [ID('VINCENT_LEE')]: { tip: '你或範圍內一人：1 張傷害卡翻到背面，或棄除 1 張面朝下的傷害卡', why: () => '' },
    [ID('CAROLYN_FERN')]: { tip: '你或範圍內一人：1 張恐怖卡翻到背面，或棄除 1 張面朝下的恐怖卡', why: () => '' },
    [ID('HARVEY_WALTERS')]: { tip: '範圍內另一名調查員獲得 1 線索（每輪一次）', why: iv => CE.usedRound(iv, '__ability') ? '本輪已使用' : '' }
  };
  const origCard = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = origCard.call(UI, iv, idx);
    const A = ACT[iv.id];
    if (A && G.phase === 'investigator' && G.active === idx && !iv.removed) {
      const why = A.why(iv);
      const b = document.createElement('button'); b.className = 'tbtn abil'; b.textContent = '能力';
      b.title = A.tip + '（花 1 行動）' + (why ? '：' + why : '');
      if (why) b.disabled = true;
      b.onclick = () => useAct(idx);
      const end = d.querySelector('.turnBar .end'); if (end) end.before(b);
    }
    return d;
  };
  // 選一張卡處理：翻到背面 或 棄除面朝下
  async function fixCard(tv, type, title) {
    const ups = CE.cardsOf(tv, type, true).length, downs = CE.cardsOf(tv, type, false).length;
    if (!ups && !downs) { await CE.alert(title, `${tv.name} 沒有${NAMEH[type]}卡。`); return false; }
    const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="msg">${esc(tv.name)}：要怎麼處理${NAMEH[type]}卡？</div>
      <div class="btns" style="flex-direction:column;align-items:stretch">${ups ? `<button class="btn primary" data-a="flip">把 1 張面朝上的${NAMEH[type]}卡翻到背面</button>` : ''}${downs ? `<button class="btn primary" data-a="disc">棄除 1 張面朝下的${NAMEH[type]}卡</button>` : ''}</div>`);
    const a = await new Promise(res => w.box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { w.close(); res(b.dataset.a); }));
    if (a === 'flip') await CE.flipDown(tv, type);
    if (a === 'disc') CE.heal(tv, type, 1, 'down');
    UI.render(); return true;
  }
  async function useAct(idx) {
    const iv = G.inv[idx], id = iv.id;
    if (id === ID('JENNY_BARNES')) {
      if (iv.clues > 0) { UI.toast('你還有線索，不能使用'); return; }
      await CE.doAction(idx, 'other', async () => {
        iv.clues += 2; Engine.log(`${iv.name} 的能力：獲得 2 線索`); UI.render();
        const cards = CE.cardsOf(iv, 'horror');   // 面朝上、面朝下都可以選
        if (cards.length) {
          const c = cards.length === 1 ? cards[0] : await CE.pickCard(iv, cards, '珍妮的能力：選 1 張恐怖卡棄除（面朝上、面朝下都可以）');
          if (c) { CE.removeCard(iv, c); Engine.log(`${iv.name} 棄除 1 張恐怖卡`); }
        }
        await CE.alert('珍妮的能力', `${iv.name} 獲得 2 線索${cards.length ? '，並棄除了 1 張恐怖卡' : '（沒有恐怖卡可以棄除）'}。`);
        UI.render();
      });
      return;
    }
    if (id === ID('VINCENT_LEE') || id === ID('CAROLYN_FERN')) {
      const type = id === ID('VINCENT_LEE') ? 'damage' : 'horror';
      const others = CE.invsInRange(idx) || CE.alive().filter(j => j !== idx);
      const t = others.length ? await CE.chooseInvLayer(`${iv.name} 的能力：選你自己或範圍內的一名調查員`, [idx, ...others]) : idx;
      if (t == null) return;
      const tv = G.inv[t];
      if (!CE.cardsOf(tv, type).length) { UI.toast(`${tv.name} 沒有${NAMEH[type]}卡`); return; }
      await CE.doAction(idx, 'other', async () => { await fixCard(tv, type, `${iv.name} 的能力`); });
      return;
    }
    if (id === ID('HARVEY_WALTERS')) {
      if (CE.usedRound(iv, '__ability')) { UI.toast('本輪已使用'); return; }
      const others = CE.invsInRange(idx) || CE.alive().filter(j => j !== idx);
      if (!others.length) { UI.toast('範圍內沒有其他調查員'); return; }
      const t = await CE.chooseInvLayer(`${iv.name} 的能力：選範圍內的另一名調查員獲得 1 線索`, others);
      if (t == null) return;
      await CE.doAction(idx, 'other', async () => { CE.markRound(iv, '__ability'); G.inv[t].clues++; Engine.log(`${iv.name} 的能力：${G.inv[t].name} 獲得 1 線索`); UI.toast(`${G.inv[t].name} 獲得 1 線索`); UI.render(); });
    }
  }

  // ---------- 2. 邁克爾：有怪物被擊敗時，進入集中 ----------
  const km = Engine.killMonster;
  Engine.killMonster = async function () {
    const r = await km.apply(this, arguments);
    const i = idxOf(ID('MICHAEL_MCGLEN'));
    if (i >= 0 && !CE.has(G.inv[i], 'focused')) { CE.addCond(G.inv[i], 'focused'); Engine.log(`${G.inv[i].name} 的能力：怪物被擊敗，進入集中`); UI.toast(`${G.inv[i].name} 進入集中狀態（能力）`); UI.render(); }
    return r;
  };

  // ---------- 3. 歌莉婭：回合開始時沒有線索 → 獲得 1 線索 ----------
  const ts = CE.turnStart;
  CE.turnStart = async function (i) {
    const iv = G.inv[i];
    const first = iv && iv.turn && !iv.turn.started && !(iv.turn.acts > 0) && !iv.turn.extra;
    const r = await ts.apply(this, arguments);
    if (first && iv.id === ID('GLORIA_GOLDBERG') && G.phase === 'investigator' && !iv.removed && !G.gameOver && iv.clues === 0) {
      iv.clues = 1; Engine.log(`${iv.name} 的能力：回合開始沒有線索，獲得 1 線索`); UI.toast(`${iv.name} 的能力：獲得 1 線索`); UI.render();
    }
    return r;
  };

  // ---------- 4. 曼蒂、達雷爾（獲得線索時）、德克斯特（獲得法術時）----------
  //  每次畫面更新時比對：線索變多了／多了一張法術
  let lastClue = null, lastSpell = null, busy = false;
  const rr = UI.render;
  UI.render = function () {
    const r = rr.apply(this, arguments);
    try { watch(); } catch (e) { }
    return r;
  };
  function watch() {
    if (!G.inv || !G.inv.length || !G.items) { lastClue = lastSpell = null; return; }
    const key = G.variant + '#' + G.inv.map(iv => iv.id).join(',');
    if (!lastClue || lastClue.key !== key) { lastClue = { key, v: G.inv.map(iv => iv.clues) }; lastSpell = { key, v: G.inv.map((iv, i) => CE.owned(i).filter(it => CE.isSpell(it.id)).map(it => it.id)) }; return; }
    if (busy) return;
    const spells = G.inv.map((iv, i) => CE.owned(i).filter(it => CE.isSpell(it.id)).map(it => it.id));
    for (let i = 0; i < G.inv.length; i++) {
      const iv = G.inv[i]; if (iv.removed) continue;
      const gain = (iv.clues || 0) - (lastClue.v[i] || 0);
      const newSpell = spells[i].some(s => !(lastSpell.v[i] || []).includes(s));
      if (gain > 0 && iv.id === ID('MANDY_THOMPSON') && !CE.usedRound(iv, '__mandy')) {
        CE.markRound(iv, '__mandy'); iv.clues++; Engine.log(`${iv.name} 的能力：額外獲得 1 線索`); UI.toast(`${iv.name} 的能力：額外獲得 1 線索`);
      }
      if (gain > 0 && iv.id === ID('DARRELL_SIMMONS') && !CE.usedRound(iv, '__darrell') && G.phase !== 'setup') {
        busy = true;
        const g = gain;
        setTimeout(async () => {
          try {
            if (await CE.ask(`${iv.name} 的能力`, `剛獲得 ${g} 條線索。\n每輪一次：要放棄這 ${g} 條線索，改成進入集中狀態嗎？`, '放棄線索、進入集中', '保留線索')) {
              CE.markRound(iv, '__darrell'); iv.clues = Math.max(0, iv.clues - g); CE.addCond(iv, 'focused'); Engine.log(`${iv.name} 的能力：放棄 ${g} 線索，進入集中`);
            }
          } finally { busy = false; lastClue.v = G.inv.map(x => x.clues); rr.apply(UI); }
        }, 30);
      }
      if (newSpell && iv.id === ID('DEXTER_DRAKE') && !CE.usedRound(iv, '__dexter')) {
        CE.markRound(iv, '__dexter');
        if (!CE.has(iv, 'focused')) { CE.addCond(iv, 'focused'); Engine.log(`${iv.name} 的能力：獲得法術，進入集中`); UI.toast(`${iv.name} 獲得法術，進入集中狀態（能力）`); }
      }
    }
    if (!busy) lastClue.v = G.inv.map(iv => iv.clues);
    lastSpell.v = spells;
  }

  // ---------- 5. 瑪麗修女：範圍內其他人檢定時，把 1 個🔍轉成★（每輪一次）----------
  const op = CE.optionals;
  CE.optionals = function (idx, ctx) {
    const out = op.call(CE, idx, ctx);
    const m = idxOf(ID('SISTER_MARY'));
    if (m >= 0 && idx != null && idx !== m && inRangeOf(m, idx)) {
      const used = CE.usedRound(G.inv[m], '__mary');
      out.push({ key: '__mary', label: `${G.inv[m].name} 的能力`, img: G.inv[m].img, text: '把 1 個🔍轉成★（每輪一次）', eff: 'oneClue', cost: {}, disabled: used ? '本輪已使用' : '', onUse: () => CE.markRound(G.inv[m], '__mary') });
    }
    return out;
  };

  // ---------- 6. 阿曼達：解謎時多 2 步（提示）----------
  for (const k of ['slide', 'code', 'lock', 'tower']) {
    const o = Puzzles[k]; if (typeof o !== 'function') continue;
    Puzzles[k] = function () {
      const a = idxOf(ID('AMANDA_SHARPE'));
      if (a >= 0) setTimeout(() => UI.toast(`如果由 ${G.inv[a].name} 解謎：可以多走 2 步（步數上限＝技能值＋2）`), 300);
      return o.apply(this, arguments);
    };
  }

  // ---------- 7. 蒙特雷：同一格的其他調查員不用躲避 ----------
  const sameCellAsMonterey = idx => {
    const m = idxOf(ID('MONTEREY_JACK'));
    if (m < 0 || m === idx) return false;
    const a = MAP.posCell(G.inv[m]), b = MAP.posCell(G.inv[idx]);
    return a && b && a.id === b.id;
  };
  const ef = CE.evadeFirst;
  CE.evadeFirst = async function (idx, kind) {
    if (sameCellAsMonterey(idx) && CE.monsterHere(idx) && !(CE.pipesStuck && CE.pipesStuck(idx))) { Engine.log(`${G.inv[idx].name} 和蒙特雷同一格：不用躲避`); return true; }
    return ef.apply(this, arguments);
  };
  const me = CE.moveEvade;
  CE.moveEvade = async function (idx) {
    if (sameCellAsMonterey(idx)) {
      const iv = G.inv[idx], c = MAP.posCell(iv);
      if (iv.turn && iv.turn.move && c) iv.turn.move.evaded = c.id;
      UI.toast('和蒙特雷同一格：不用躲避，請再拖一次人偶'); UI.render(); return;
    }
    return me.apply(this, arguments);
  };

  // ---------- 8. 鮑勃：每輪一次，花行動和人物互動後，處理 1 張恐怖卡 ----------
  const cn = UI.clickNode;
  UI.clickNode = async function (id) {
    const b = idxOf(ID('BOB_JENKINS'));
    const isPerson = (/^PERSON/.test(id) || /^Person_/.test((G.nodes[id] || {}).sprite || '')) && b >= 0 && G.phase === 'investigator';
    const before = isPerson ? (G.inv[b].turn ? G.inv[b].turn.acts : 0) : 0;
    const actor = isPerson ? (CE.pending != null ? CE.pending : (CE.actorNow ? CE.actorNow() : G.active)) : null;
    const r = await cn.apply(this, arguments);
    if (isPerson && actor === b) {
      const f = G.fsmByObj[id];
      const after = async () => {
        const iv = G.inv[b]; if (!iv || iv.removed || CE.usedRound(iv, '__bob')) return;
        const spent = (iv.turn ? iv.turn.acts : 0) > before || (window.DEV && DEV.on);
        if (!spent || !CE.cardsOf(iv, 'horror').length) return;
        if (!await CE.ask(`${iv.name} 的能力`, '剛剛花行動和人物互動。每輪一次：要處理 1 張恐怖卡嗎？', '使用', '不用')) return;
        CE.markRound(iv, '__bob');
        await fixCard(iv, 'horror', `${iv.name} 的能力`);
      };
      if (f) f.whenIdle().then(() => setTimeout(after, 50)); else after();
    }
    return r;
  };
})();

// ============================================================
//  滑鼠移到調查員欄的按鈕、數值上：立刻顯示說明（不用等瀏覽器的慢提示）
// ============================================================
(function () {
  const TIPS = [
    ['.invHead .x', el => el.textContent.includes('復原') ? '復原：把被淘汰的調查員放回遊戲' : '淘汰：調查員被消滅時按這裡（移走人偶，不再行動）'],
    ['.invHead img', '點一下：換這位調查員行動'],
    ['.turnBar .tst', '這位調查員目前的狀態：行動中／已行動／等待中'],
    ['.turnBar .pips', '這回合已經用掉的行動（每回合 2 個；亮的是還沒用的）'],
    ['.turnBar [data-t="go"]', el => el.textContent.includes('補做') ? '補做：已經行動過，但還要補做事情（人偶可以自由拖曳，不扣行動）' : '換他：改成由這位調查員行動'],
    ['.turnBar [data-t="end"]', '結束這位調查員的回合，換下一位'],
    ['textarea.ability', '調查員的特殊能力（APP 會自動處理的能力，也會在需要時跳出提示）'],
    ['.bigstats .big:nth-child(1) [data-a="maxH+"]', '生命上限 +1'], ['.bigstats .big:nth-child(1) [data-a="maxH-"]', '生命上限 −1'],
    ['.bigstats .big:nth-child(2) [data-a="maxS+"]', '理智上限 +1'], ['.bigstats .big:nth-child(2) [data-a="maxS-"]', '理智上限 −1'],
    ['[data-a="clue+"]', '線索 +1'], ['[data-a="clue-"]', '線索 −1'],
    ['.dhBack', '面朝下的卡（只算點數，沒有效果）'],
    ['select[data-a="give"]', '從物品堆（沒有人持有的物品，例如起始物品）拿一件給這位調查員'],
    ['select[data-a="cond"]', '給這位調查員加上一個狀態（集中、眩暈、擊昏…）'],
    ['.chip.cond', '點一下移除這個狀態'],
    ['.dhRow.damage .dhL', '傷害：目前受到的傷害／生命上限'], ['.dhRow.horror .dhL', '恐怖：目前受到的恐怖／理智上限']
  ];
  const oc = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = oc.apply(this, arguments);
    for (const [sel, t] of TIPS) d.querySelectorAll(sel).forEach(el => { if (!el.title) el.title = typeof t === 'function' ? t(el) : t; });
    return d;
  };
  // 快速提示框
  let tip = null, cur = null;
  const show = (el, e) => {
    if (!tip) { tip = document.createElement('div'); tip.id = 'qtip'; document.body.appendChild(tip); }
    tip.textContent = el.dataset.tip; tip.style.display = 'block';
    const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = Math.min(e.clientY + 16, innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  document.addEventListener('mouseover', e => {
    if (typeof NET !== 'undefined' && NET.role === 'guest') return;   // 朋友那邊用 net.js 的說明框
    const el = e.target.closest && e.target.closest('#leftCol [title], #rightCol [title], #leftCol [data-tip], #rightCol [data-tip]');
    if (!el) { if (tip) tip.style.display = 'none'; cur = null; return; }
    if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }   // 用自己的提示，不要兩個同時出現
    cur = el; show(el, e);
  });
  document.addEventListener('mousemove', e => { if (cur && tip && tip.style.display === 'block') show(cur, e); });
  document.addEventListener('mousedown', () => { if (tip) tip.style.display = 'none'; });
})();

// ============================================================
//  調查員起始位置：第一個調查員階段開始時，全部放進入口那一格
//  （入口標記附近如果剛好有白線，原本左右排開會有人跑到隔壁格）
// ============================================================
(function () {
  const sip = Engine.startInvestigatorPhase;
  Engine.startInvestigatorPhase = function (first) {
    if (first && G.round <= 1 && !G.vars.__startPlaced) {
      G.vars.__startPlaced = 1;
      try {
        const ent = Object.values(G.nodes).find(n => n.id === 'ENTRANCE' || (n.sprite || '').includes('Investigators'));
        CE.placeAllAt(ent);
      } catch (e) { console.warn('起始位置', e); }
    }
    return sip.apply(this, arguments);
  };
  // 把所有調查員放進某個標記所在的格子（左右排開，排不下就疊在中心）
  CE.placeAllAt = function (ent) {
        const c = ent && MAP.cellAt(ent.x, ent.y);
        if (c) {
          const ivs = G.inv.filter(iv => !iv.removed);
          const n = ivs.length, sp = 0.24;
          ivs.forEach((iv, k) => {
            // 先試著在格子中心左右排開（兩排），排不下的就疊在中心
            const row = n > 3 ? (k < Math.ceil(n / 2) ? -0.12 : 0.12) : 0, inRow = n > 3 ? (k < Math.ceil(n / 2) ? Math.ceil(n / 2) : n - Math.ceil(n / 2)) : n, j = n > 3 ? (k < Math.ceil(n / 2) ? k : k - Math.ceil(n / 2)) : k;
            const x = c.x + (j - (inRow - 1) / 2) * sp, y = c.y + row;
            const cc = MAP.cellAt(x, y);
            if (cc && cc.id === c.id) { iv.x = x; iv.y = y; } else { iv.x = c.x + (k - (n - 1) / 2) * 0.04; iv.y = c.y; }
          });
          UI.render();
          return true;
        }
        return false;
  };
  // 換地圖（例如回到旅店、去碼頭）時「將調查員模型放在所示位置」：自動把大家移過去
  const sayP = Engine.say;
  Engine.say = function (o) {
    try {
      // 「將暗道放在所示位置」：訊息指的那個暗道標記要真的出現在地圖上（有暗道的格子彼此相鄰）
      const sid = o && o.source ? goName(o.source) : null, sn = sid && G.nodes[sid];
      if (sn && !sn.visible && /TrapDoor|SecretPassage/.test(sn.sprite || '') && /放/.test(plain(o.text || ''))) { sn.visible = true; MAP._sig = null; UI.render(); Engine.log('地圖上放了一個暗道'); }
    } catch (e) { }
    try {
      if (o && G.phase !== 'setup' && G.vars.__startPlaced) {
        const id = o.source ? goName(o.source) : null, n = id && G.nodes[id];
        const isStart = n && ((n.sprite || '').includes('Investigators') || /^STARTING SPACE/i.test(n.id));
        const txt = /將(你的|你們的|所有)?調查員(模型)?放(在|到|置)(於)?所示位置/.test(plain(o.text || ''));
        if (isStart || txt) {
          const tgt = isStart ? n : Object.values(G.nodes).filter(x => x.visible && ((x.sprite || '').includes('Investigators') || /^STARTING SPACE/i.test(x.id))).find(x => MAP.cellAt(x.x, x.y));
          if (tgt && CE.placeAllAt(tgt)) Engine.log('調查員已移到劇情指定的位置');
        }
      }
    } catch (e) { console.warn('放置調查員', e); }
    return sayP.apply(Engine, arguments);
  };
})();

// ==========================================================
//  神秘階段保險：流程已經停了（例如在神秘階段按了「上一步」），
//  但「結束神秘階段」按鈕還是灰的 → 閒置 5 秒後自動開放按鈕
// ==========================================================
(function () {
  let idle = 0;
  setInterval(() => {
    try {
      if (typeof G === 'undefined' || !G || G.phase !== 'mythos' || G.horrorStep || G.gameOver) { idle = 0; return; }
      const ov = document.querySelector('#overlay');
      const dlgOpen = (ov && !ov.classList.contains('hidden')) ||
        [...document.querySelectorAll('body > *')].some(e => e.id !== 'app' && e.id !== 'overlay' && !/qtip|invTip|toast/i.test(e.id + ' ' + e.className) && getComputedStyle(e).display !== 'none' && e.querySelector('button') && e.getClientRects().length > 0);
      const offOpen = typeof OFF !== 'undefined' && OFF.layer && !OFF.layer.classList.contains('hidden');
      const busy = offOpen || (typeof dlgOpenCount !== 'undefined' && dlgOpenCount > 0) || (G.fsms || []).some(f => f.running > 0) || (G.monsters || []).some(m => m.fsm && m.fsm.running > 0);
      if (dlgOpen || busy) { idle = 0; return; }
      if (++idle >= 5) {
        idle = 0; G.horrorStep = true; UI.render();
        UI.toast && UI.toast('神秘階段的事件都處理完了，請進行恐怖檢定後按右上角「結束神秘階段」');
      }
    } catch (e) { idle = 0; }
  }, 1000);
})();

// ==========================================================
//  訊息裡的「強化」：按「繼續」後跳出選技能
//   ・任意／任選 1 項技能得到強化、強化〔力量〕、強化你的所有技能
//   ・棄除 1 個強化
//   ・「如果檢定成功／失敗…」依剛剛擲骰的結果
//   ・「骷髏所在範圍內的每位調查員」：用怪物被擊敗時的位置判斷
// ==========================================================
(function () {
  const ZH = { 力量: 'str', 敏捷: 'agi', 觀察: 'obs', 知識: 'lor', 影響: 'inf', 意志: 'wil' };
  const N1 = '(?:1|一)';
  const parse = seg => {
    const s = seg.replace(/强/g, '強');
    const fx = {};
    if (/強化你的所有技能/.test(s)) fx.all = true;
    const sp = s.match(/強化〔(力量|敏捷|觀察|知識|影響|意志)〕/); if (sp) fx.sk = ZH[sp[1]];
    if (new RegExp(`(任意|任選)\\s*${N1}\\s*項技能(得到|獲得)?強化|強化\\s*${N1}\\s*項(你的)?技能|任意強化\\s*${N1}\\s*項技能`).test(s)) fx.any = true;
    if (new RegExp(`(棄除|棄掉|失去)\\s*${N1}\\s*(個|點)強化`).test(s)) fx.lose = true;
    return (fx.all || fx.sk || fx.any || fx.lose) ? fx : null;
  };
  CE.pickInvs = function (title, list, pre) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="msg" style="font-size:14px">勾選符合條件的調查員：</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">${list.map(i => `<label style="font-size:16px"><input type="checkbox" data-i="${i}" ${pre && pre.includes(i) ? 'checked' : ''}> ${esc(G.inv[i].name)}</label>`).join('')}</div>
        <div class="btns"><button class="btn" id="piNo">都沒有</button><button class="btn primary" id="piOk">確定</button></div>`);
      w.box.querySelector('#piOk').onclick = () => { const r = [...w.box.querySelectorAll('input:checked')].map(x => +x.dataset.i); w.close(); res(r); };
      w.box.querySelector('#piNo').onclick = () => { w.close(); res([]); };
    });
  };
  const kill0 = Engine.killMonster;
  Engine.killMonster = function (m) {
    try { if (G.monsters.includes(m)) CE._lastKill = { name: T(m.name), cell: MAP.cellAt(m.x, m.y) }; } catch (e) { }
    return kill0.apply(this, arguments);
  };
  const say0 = Engine.say;
  Engine.say = async function (o) {
    const raw = o && o.text || '';
    const hasImp = /[強强]化/.test(raw);
    if (hasImp) CE._lastRoll = null;
    const r = await say0.apply(Engine, arguments);
    if (!hasImp || G.phase === 'setup') return r;
    try {
      const t = plain(raw);
      let seg, who = null;
      if (/如果檢定成功/.test(t)) {
        const lr = CE._lastRoll; if (!lr || lr.pass == null) return r;
        const ok = t.split('如果檢定成功')[1] || '';
        seg = lr.pass ? ok.split('如果檢定失敗')[0] : (t.split('如果檢定失敗')[1] || '');
        who = [lr.inv];
      } else seg = t.split(/如果|否則/)[0];
      const fx = parse(seg); if (!fx) return r;
      const why = '劇情效果';
      if (!who) {
        const allM = seg.match(/(每位|每名|每個|所有)([^。；]*?)調查員/);
        if (allM) {
          const alive = CE.alive();
          const mm = seg.match(/([^\s，。；]{1,8})所在(的)?(範圍|格子)/);
          if (mm && CE._lastKill && CE._lastKill.cell && mm[1].includes(CE._lastKill.name.replace(/\s/g, '').slice(0, 2))) {
            who = alive.filter(i => { const c = MAP.posCell(G.inv[i]); return c && c.id === CE._lastKill.cell.id; });
          } else if (/(在|處於|位於|範圍|格)/.test(allM[2] || '') || mm) {
            const w = CE.whoIn(seg);
            who = w ? w.list : await CE.pickInvs('誰符合這個效果？', alive, []);
          } else who = alive;
        } else {
          const byName = CE.alive().filter(i => t.includes(G.inv[i].name));
          if (byName.length === 1) who = byName;
          else { const a = CE.nodeActor != null ? CE.nodeActor : CE.actorNow(); if (a != null) who = [a]; }
        }
      }
      if (!who || !who.length) { if (fx.any || fx.sk || fx.all) UI.toast('範圍內沒有調查員可以強化'); return r; }
      for (const i of who) {
        const iv = G.inv[i]; if (!iv || iv.removed) continue;
        if (fx.lose) { await CE.loseImprove(iv); continue; }
        if (fx.all) { for (const s of SKILLS) if (!(iv.imp || {})[s.k]) await CE.improve(i, s.k, why); continue; }
        await CE.improve(i, fx.sk || null, why);
      }
      UI.render();
    } catch (e) { console.error(e); }
    return r;
  };
})();

// ==========================================================
//  神秘事件「影響…的調查員」：
//   ・算得出來（所有、擁有強化、處於某房間、光源道具、技能 N 以上）→ 直接列出
//   ・算不出來（室外、室內、某人所在範圍…）→ 對話框先藏起來，下方出現提示列，
//     點地圖頭像或左右欄選人 →「選擇完畢」或「無人符合」
//   ・只影響一人（…且最高／最低的調查員，有地點條件）→ 只能選一位
//   ・列出的名單旁有「修改」可以重選
//   記住受影響的人，下一段檢定可以一個一個擲（還剩 N 人）
// ==========================================================
(function () {
  const SKZ = { 力量: 'str', 敏捷: 'agi', 觀察: 'obs', 知識: 'lor', 影響: 'inf', 意志: 'wil' };
  // 能自動算的名單；算不出來回傳 null
  const autoList = cond => {
    const c2 = cond.replace(/的/g, '').trim();
    if (/擁有強化|有強化/.test(c2)) return { list: CE.alive().filter(i => Object.values(G.inv[i].imp || {}).some(v => v === true)), label: '擁有強化的調查員' };
    if (!c2) return { list: CE.alive(), label: '所有調查員' };
    const trait = c2.match(/擁有[“"]?([^”"]{1,4})[”"]?性質(的)?道具/);
    if (trait) return { list: CE.alive().filter(i => CE.owned(i).some(it => ((CE.face(it) || {}).cat || '').includes(trait[1]))), label: `擁有「${trait[1]}」道具的調查員` };
    const skl = c2.match(/〔(力量|敏捷|觀察|知識|影響|意志)〕(在|為)?(\d)或以上/);
    if (skl) return { list: CE.alive().filter(i => (G.inv[i].skills[SKZ[skl[1]]] || 0) >= +skl[3]), label: `${skl[1]} ${skl[3]} 以上的調查員` };
    const place = c2.replace(/^(處於|位於|在)/, '').replace(/(格子)?(裡|中|內)?$/, '').replace(/格子$/, '').trim();
    if (place && !/且|並且|最|室外|室內|範圍|其他|至少/.test(place)) { const w = CE.whoIn('每位在' + place + '的調查員'); if (w) return { list: w.list, label: `處於${place}的調查員` }; }
    return null;
  };

  // ---- 點選模式 ----
  let PK = null;   // { sel:Set, single, bar }
  const invIdxOfCard = card => { const nm = (card.querySelector('.invName') || {}).textContent; return G.inv.findIndex(v => v.name === nm); };
  const paint = () => {
    if (!PK) return;
    document.querySelectorAll('#world [data-inv]').forEach(el => el.classList.toggle('pickSel', PK.sel.has(+el.dataset.inv)));
    document.querySelectorAll('.inv').forEach(card => { const i = invIdxOfCard(card); card.classList.toggle('pickSel', PK.sel.has(i)); card.classList.toggle('pickable', i >= 0 && !G.inv[i].removed); });
    const b = PK.bar && PK.bar.querySelector('#pkDone'); if (b) b.textContent = `選擇完畢（已選 ${PK.sel.size} 人）`;
  };
  const toggle = i => {
    if (!PK || i == null || i < 0 || !G.inv[i] || G.inv[i].removed) return;
    if (PK.sel.has(i)) PK.sel.delete(i); else { if (PK.single) PK.sel.clear(); PK.sel.add(i); }
    paint();
  };
  document.addEventListener('pointerdown', e => {
    if (!PK) return;
    const fig = e.target.closest('#world [data-inv]');
    if (fig) { e.stopPropagation(); e.preventDefault(); toggle(+fig.dataset.inv); return; }
    const card = e.target.closest('.inv');
    if (card && !e.target.closest('button,select,input,textarea')) { e.stopPropagation(); e.preventDefault(); toggle(invIdxOfCard(card)); }
  }, true);
  const rr = UI.render; UI.render = function () { const r = rr.apply(this, arguments); try { paint(); } catch (e) { } return r; };
  CE.pickInvMode = function (sentence, single, pre) {
    return new Promise(res => {
      const old = document.getElementById('pickInvBar'); if (old) old.remove();
      const bar = document.createElement('div'); bar.id = 'pickInvBar';
      bar.innerHTML = `<div class="mmTxt"><span>${single ? '請點選<b>一位</b>符合條件的調查員' : '請點選所有符合條件的調查員'}（點地圖上的頭像或左右欄）：<br><span class="pkCond">${esc(sentence)}</span></span></div>
        <button class="btn primary big" id="pkDone">選擇完畢（已選 0 人）</button><button class="btn big" id="pkNone">無人符合</button>`;
      document.body.appendChild(bar);
      PK = { sel: new Set(pre || []), single, bar };
      paint();
      const end = v => { bar.remove(); PK = null; document.querySelectorAll('.pickSel,.pickable').forEach(e => e.classList.remove('pickSel', 'pickable')); res(v); };
      bar.querySelector('#pkDone').onclick = () => { const v = [...PK.sel]; end(v.length ? v : null); };
      bar.querySelector('#pkNone').onclick = () => end(null);
    });
  };

  // 對話框已經開著時，按「無人符合」：關掉檢定和對話框，到下一步
  const closeNoOne = () => {
    const L = OFF.layer; if (!L) return;
    L.classList.remove('hidden');
    L.querySelectorAll('.rollPlate').forEach(e => e.remove());
    const no = [...L.querySelectorAll('[data-ev],[data-i],.tap')].find(e => /沒有效果|無效果|沒有調查員/.test(e.textContent));
    (no || L.querySelector('.tap') || L.querySelector('[data-ev]') || { click() { } }).click();
  };
  const setArea = (fsm, list, label, single) => { CE._area = { fsm, w: { area: label, label, list, single } }; };
  const addEdit = (o, sentence) => {
    try {
      const box = OFF.layer && OFF.layer.querySelector('.whoInBox'); if (!box || box.querySelector('.pkEdit')) return;
      const b = document.createElement('span'); b.className = 'pkEdit'; b.textContent = '修改';
      b.onclick = async e => {
        e.stopPropagation();
        const cur = CE._area && CE._area.fsm === o.fsm ? CE._area.w : { list: [], label: '符合條件的調查員' };
        OFF.layer.classList.add('hidden');
        const v = await CE.pickInvMode(sentence || cur.label, !!cur.single, cur.list);
        if (!v) { Engine.log('無人符合，跳過這個效果'); closeNoOne(); return; }
        setArea(o.fsm, v, cur.label || '符合條件的調查員', cur.single);
        box.firstChild && (box.innerHTML = `${esc(cur.label || '符合條件的調查員')}：${v.map(i => `<span><img src="${G.inv[i].img}">${esc(G.inv[i].name)}</span>`).join('')}`);
        box.appendChild(b);
        const rp = OFF.layer.querySelector('.rollPlate:not(.applyPlate)'); if (rp) rp.textContent = v.length > 1 ? `擲骰×${v.length}` : '擲骰';
        OFF.layer.classList.remove('hidden');
      };
      box.appendChild(b);
    } catch (err) { }
  };

  const msgA = UI.message;
  UI.message = function (o) {
    const self = this, args = arguments;
    try {
      if (!o || !o.fsm || G.phase === 'setup' || !o.text) return msgA.apply(self, args);
      const t = plain(o.text).replace(/强/g, '強');
      const sentence = (t.match(/[^。]*影響[^。]*調查員[^。]*。?/) || [''])[0].trim();
      const known = CE._area && CE._area.fsm === o.fsm;
      const m = t.match(/影響([^。]*?)(所有|每位|每名|每個)([^。]*?)調查員/);
      const sm = !m && t.match(/影響([^。]*?)的(一位)?調查員/);
      let need = null;     // 'multi' | 'single'
      if (m && !known) {
        const a = autoList(m[1] + m[3]);
        if (a) setArea(o.fsm, a.list, a.label, false);
        else if (!CE.whoIn(t)) need = 'multi';
      } else if (sm && !known && /處於|位於|在|格子|室外|室內|範圍/.test(sm[1])) {
        const pl = sm[1].match(/^(處於|位於|在)([^且，,]+?)(的|且|$)/);
        const a = pl && !/室外|室內|範圍|格子/.test(pl[2]) ? autoList('處於' + pl[2]) : null;
        if (a && a.list.length === 1 && sm[2]) setArea(o.fsm, a.list, a.label, true);
        else need = 'single';
      }
      if (!need) { const p = msgA.apply(self, args); if (CE._area && CE._area.fsm === o.fsm) setTimeout(() => addEdit(o, sentence), 0); return p; }
      // 先讓玩家選人（對話框不顯示）
      return (async () => {
        const v = await CE.pickInvMode(sentence, need === 'single', []);
        if (!v) {
          Engine.log('無人符合，跳過這個效果');
          const btns = o.buttons || [];
          const no = btns.find(b => /沒有效果|無效果/.test(plain(b.label || '')));
          if (no) return no.ev;
          if (btns.length <= 1) return btns[0] ? btns[0].ev : 'NEXT';
          return msgA.apply(self, args);        // 選項看不出哪個是「沒有效果」：照常顯示讓玩家選
        }
        setArea(o.fsm, v, need === 'single' ? '被選中的調查員' : '符合條件的調查員', need === 'single');
        const p = msgA.apply(self, args);
        setTimeout(() => addEdit(o, sentence), 0);
        return p;
      })();
    } catch (e) { console.error(e); return msgA.apply(self, args); }
  };
})();

// ==========================================================
//  地圖上「怪物圖案的標記」（例如 CoSH 01B 地牢裡的黑暗德魯伊、SB 03A 的幽靈梅寶）：
//  劇情把它放出來時，變成真的怪物（可以攻擊、擊敗後觸發後續劇情）
// ==========================================================
(function () {
  // 同一劇情步驟緊接著「設定怪物生命」：出現時就先套用（官方是同時生效）
  const preHp = (f, id) => {
    try {
      const st = f && f.state && f.states[f.state]; if (!st) return null;
      const a = (st.actions || []).find(x => x.action === 'SetMonsterHP' && (x.UseMostRecent || goName(x.MonsterNode) === id));
      if (!a) return null; const v = val(a.HitPoints, f); return v > 0 ? v : null;
    } catch (e) { return null; }
  };
  const spawnFromNode = (id, fsm) => {
    try {
      const n = G.nodes[id]; if (!n || !n.visible || !/^Monster_/.test(n.sprite || '')) return;
      if (G.monsters.some(m => m.node === id)) { n.visible = false; return; }
      const f = G.fsmByObj[id]; if (f && f.hasHandler('NODE CLICKED')) return;     // 可以對話的（不是敵人）
      const def = Object.values(DB.monsters).find(d => d.img === n.sprite); if (!def) return;
      const hp = preHp(fsm, id) || ((G.vars.__hp || {})[id]) || n.Toughness || def.tough;
      Engine.addMonster(def.id, { x: n.x, y: n.y, node: id, hp });
      n.visible = false;
      Engine.log(`出現怪物：${T(def.name)}（生命 ${hp}）`);
      UI.render();
    } catch (e) { console.warn('怪物標記', e); }
  };
  const rv = Actions.RevealNode;
  Actions.RevealNode = function (a, f) { const r = rv.apply(Actions, arguments); spawnFromNode(goName(a.Node), f); return r; };
  const dmr = Actions.DisplayMessageAndReveal;
  Actions.DisplayMessageAndReveal = async function (a, f) { const p = dmr.apply(Actions, arguments); spawnFromNode(goName(a.MessageSource), f); return p; };
})();

// ==========================================================
//  板塊被移出遊戲（例如商店打烊）：站在上面的調查員移到最近的格子，不要留在桌面空白處
// ==========================================================
(function () {
  const ht = Actions.HideTile;
  Actions.HideTile = function () {
    const r = ht.apply(Actions, arguments);
    try {
      const g = MAP.build(); if (!g.cells.length) return r;
      G.inv.forEach(iv => {
        if (iv.removed || Engine._carrying || MAP.posCell(iv)) return;
        let best = null, bd = 1e9; for (const c of g.cells) { const d = Math.hypot(c.x - iv.x, c.y - iv.y); if (d < bd) { bd = d; best = c; } }
        if (!best) return;
        iv.x = best.x; iv.y = best.y; if (MAP.snap) MAP.snap(iv, G.inv.filter(x => !x.removed));
        Engine.log(`${iv.name} 所在的板塊被移走了，移到最近的格子`);
      });
      UI.render();
    } catch (e) { console.warn('移走板塊', e); }
    return r;
  };
})();

// ==========================================================
//  先收起板塊再搬走（鏡中人開船：HideTile → MoveTile → RevealTile）：板塊上的調查員、怪物、地上物品要跟著搬，不是被擠下來或刪掉（1.2.55 測試組）
// ==========================================================
(function () {
  const willMove = (f, tid) => {
    if (!f || !f.states) return false; const seen = new Set(); let fr = [f.state];
    for (let d = 0; d < 4 && fr.length; d++) {
      const nx = [];
      for (const s of fr) { if (!s || seen.has(s)) continue; seen.add(s); const st = f.states[s]; if (!st) continue;
        if ((st.actions || []).some(a => a && a.action === 'MoveTile' && goName(a.Tile) === tid)) return true;
        for (const t of st.transitions || []) nx.push(t[1]); }
      fr = nx;
    }
    return false;
  };
  const ht = Actions.HideTile;
  Actions.HideTile = function (a, f) {
    const t = G.tiles[goName(a.Tile)];
    if (!t || !t.revealed || !willMove(f, t.id)) return ht.apply(Actions, arguments);
    const on = o => { try { const c = MAP.posCell(o); return !!(c && c.tile === t.id); } catch (e) { return false; } };
    const carry = [];
    for (const iv of G.inv) if (!iv.removed && on(iv)) carry.push({ o: iv, x: iv.x, y: iv.y });
    for (const m of G.monsters) if (on(m)) carry.push({ o: m, x: m.x, y: m.y });
    const items = G.items.filter(it => it.owner == null && it.ground && on(it.ground));
    for (const it of items) carry.push({ o: it.ground, x: it.ground.x, y: it.ground.y });
    Engine._noItemPurge = true; Engine._carrying = true; let r;
    try { r = ht.apply(Actions, arguments); } finally { Engine._noItemPurge = false; Engine._carrying = false; }
    for (const c of carry) { c.o.x = c.x; c.o.y = c.y; }   // 擠到旁邊的調查員放回船上
    for (const it of items) if (!G.items.includes(it)) G.items.push(it);
    t._carry = carry.map(c => c.o);
    return r;
  };
  const mt = Actions.MoveTile;
  Actions.MoveTile = function (a) {
    // 收起來準備搬的板塊：搬的時候當作還在桌上（上面的東西才會一起搬），反正接著就會 RevealTile 放回來
    const t = G.tiles[goName(a.Tile)];
    if (!t || !t._carry) return mt.apply(this, arguments);
    t.revealed = true;
    const ox = t.x, oy = t.y, orr = t.rot; const keep = t._carry.map(o => [o, o.x, o.y]);
    try { return mt.apply(this, arguments); } finally {
      // 原本的搬移沒搬到的（地圖格子快取還沒更新時會漏），自己照板塊的位移搬過去
      if (t.x !== ox || t.y !== oy || t.rot !== orr) for (const [o, x0, y0] of keep) if (o.x === x0 && o.y === y0) { const [lx, ly] = MAP.rot(x0 - ox, y0 - oy, -orr); const [wx, wy] = MAP.rot(lx, ly, t.rot); o.x = t.x + wx; o.y = t.y + wy; }
      t._carry = null; UI.render();
    }
  };
  const rt = Actions.RevealTile;
  Actions.RevealTile = function (a) { const t = G.tiles[goName(a.Tile)]; const r = rt.apply(this, arguments); if (t) t._carry = null; return r; };
})();
