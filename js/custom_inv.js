// ============================================================
//  自訂調查員（2026-10-10）
//  放在基本盒（MAD20）：有基本盒就能選
//  1. 人類初柱・繼國緣一（獵鬼劍士）＋ 赫刀
//  2. 蟲柱・蝴蝶忍（醫學專家／毒理劍士）＋ 特製日輪刀
//  3. 音柱・宇髄天元（獵鬼劍士／忍者）＋ 特製雙日輪刀
// ============================================================
(function () {
  const CUSTOM = [
    {
      id: 'INVESTIGATOR_YORIICHI_TSUGIKUNI', name: '人類初柱・繼國緣一', title: '獵鬼劍士',
      img: 'img/investigators/Circle_Investigator_Yoriichi_Tsugikuni.png',
      stats: {
        health: 8, sanity: 6,
        ability: '通透世界：每輪一次，當你進行攻擊檢定時，你可以花費 1 個線索來重擲該次檢定中任意數量的骰子。',
        skills: { str: 5, agi: 4, obs: 4, lor: 2, inf: 2, wil: 4 }
      },
      story: '誕生於遙遠東方的古老家族，天生便帶著斑紋與看透事物本質的「通透世界」。他一生都在追尋並斬殺食人的惡鬼，卻因一場不可名狀的空間扭曲，意外踏入了這個被舊日支配者陰影籠罩的瘋狂世界。面對那些超越常理的宇宙外神與扭曲怪物，他眼中的平靜未曾動搖。因為對他而言，只要是傷害人類的邪祟，皆是日輪刀下當斬之物。',
      item: {
        id: 'UNIQUE_ITEM_AKATOU', name: '赫刀', img: 'UniqueItem_Akatou',
        def: {
          cat: '重型武器', w: 'melee', dmg: 2, bonus2: true, forceSkill: 'str', kind: 'note', note: {},
          text: '「這把刀閃耀著如太陽般刺眼的紅光，令邪祟畏懼。」\n在戰鬥中，以［力量］進行檢定（怪物卡上的其他效果照常結算）。若擲出至少 2 個成功，額外造成 1 點傷害。此傷害視為【火屬性】與【魔法屬性】。\n（繼國緣一的專屬武器：不能交易、丟下或丟棄）'
        }
      }
    },
    {
      id: 'INVESTIGATOR_SHINOBU_KOCHO', name: '蟲柱・蝴蝶忍', title: '醫學專家／毒理劍士',
      img: 'img/investigators/Circle_Investigator_Shinobu_Kocho.png',
      stats: {
        health: 5, sanity: 7,
        ability: '精通藥理：行動：檢定［知識］。若你擲出至少 1 個成功，你可以讓自己或所在格子的一名調查員，棄除 1 張面朝下的傷害卡或恐怖卡。（不限次數，只要你願意花費行動）',
        skills: { str: 2, agi: 5, obs: 4, lor: 5, inf: 3, wil: 4 }
      },
      story: '總是面帶溫柔微笑的蟲柱，精通藥理與毒殺之術。雖然因為體格嬌小、力量不足而無法像其他劍士一樣斬斷敵人的首級，但她憑藉著過人的敏捷與自創的毒液，成為了令邪祟膽寒的存在。在意外捲入這個充滿洛夫克拉夫特式恐怖的瘋狂空間後，她發現這裡的怪物與惡鬼有著相似的肉體變異。為了保護同伴並尋找回去的方法，她以豐富的醫學知識成為團隊中最堅強的後盾，並隨時準備將毒刃刺入外神的血肉之中。',
      item: {
        id: 'UNIQUE_ITEM_NICHIRIN_SHINOBU', name: '特製日輪刀', img: 'UniqueItem_Nichirin_Shinobu',
        def: {
          // 卡面寫「輕型武器」；二代怪物卡沒有這個分類，遊戲中視為「銳器」
          cat: '輕型武器（視為銳器）', w: 'melee', dmg: 1, bonus1: true, forceSkill: 'lor', kind: 'note', note: {},
          text: '「這把刀沒有刃，只有倒鉤的尖刺，塗滿致命毒藥。」\n在戰鬥中，以［知識］進行檢定（怪物卡上的其他效果照常結算）。若擲出至少 1 個成功，額外造成 1 點傷害。\n（遊戲中視為「銳器」。蝴蝶忍的專屬武器：不能交易、丟下或丟棄）'
        }
      }
    },
    {
      id: 'INVESTIGATOR_TENGEN_UZUI', name: '音柱・宇髄天元', title: '獵鬼劍士／忍者',
      img: 'img/investigators/Circle_Investigator_Tengen_Uzui.png',
      stats: {
        health: 7, sanity: 7,
        ability: '忍者步伐：當你執行移動行動時，你可以額外多移動 1 格。每輪一次，當你離開有怪物的格子時，你可以不進行躲避檢定。',
        skills: { str: 4, agi: 5, obs: 3, lor: 2, inf: 4, wil: 3 }
      },
      story: '脫離了黑暗忍者家族、自封為「祭典之神」的鬼殺隊音柱。天生追求極致的華麗，擁有過人的身體素質與聽覺，能以獨特的「譜面」戰法看穿敵人的攻防節奏。在追查惡鬼的過程中，他不慎跨越了時空的裂隙，來到這個被舊日陰影與不可名狀怪物盤據的詭異世界。面對這裡幽暗、潮濕且充斥著黏液觸手的混亂景象，天元並未退縮，反而抽出了背後沉重的雙刀，準備在這場黑暗的狂亂中，上演一場最華麗、最喧囂的「謝幕演出」！',
      item: {
        id: 'UNIQUE_ITEM_NICHIRIN_TENGEN', name: '特製雙日輪刀', img: 'UniqueItem_Nichirin_Tengen',
        def: {
          cat: '重型武器', w: 'melee', dmg: 2, bonus2: true, forceSkill: 'agi', kind: 'note', note: {},
          text: '「由厚重鋼鐵打造的巨大雙刀，連著鎖鏈，揮舞時發出轟鳴。」\n在戰鬥中，以［敏捷］進行檢定（怪物卡上的其他效果照常結算）。若擲出至少 2 個成功，額外造成 1 點傷害。\n（宇髄天元的專屬武器：不能交易、丟下或丟棄）'
        }
      }
    }
  ];
  const BY = {}; CUSTOM.forEach(c => BY[c.id] = c);
  const ITEMS = {}; CUSTOM.forEach(c => ITEMS[c.item.id] = c);

  // ---------- 加進資料 ----------
  const base = DB.products.MAD20;
  for (const c of CUSTOM) {
    STR[c.id] = c.name; STR[c.item.id] = c.item.name;
    INV_DATA[c.id] = { img: c.img, title: c.title, stats: c.stats, story: c.story, startItem: c.item.id };
    if (!DB.investigators.some(x => x.id === c.id)) DB.investigators.push({ id: c.id, name: c.id, gender: 0 });
    if (base) { base.investigators = base.investigators || []; if (!base.investigators.includes(c.id)) base.investigators.push(c.id); }
    if (CARDS.ownedInvestigators && !CARDS.ownedInvestigators.includes(c.id)) CARDS.ownedInvestigators.push(c.id);
    DB.items[c.item.id] = { id: c.item.id, name: c.item.id, img: c.item.img, type: 2, traits: 0 };
    CARDS.items[c.item.id] = c.item.def;
  }
  // 「輕型武器（視為銳器）」：怪物卡要求銳器時也列出來
  const wm = CE.weaponMatches;
  CE.weaponMatches = function (it, type) {
    if (it && ITEMS[it.id] && type === 'BLADED' && /視為銳器/.test((CARDS.items[it.id] || {}).cat || '')) return true;
    return wm.apply(this, arguments);
  };
  // 專屬武器：不能交易、丟下、丟棄
  const lk = CE.locked;
  CE.locked = function (it) { return (it && ITEMS[it.id] && it.owner != null) || lk.apply(this, arguments); };

  // ---------- 遊戲開始：拿到專屬武器 ----------
  const sip = Engine.startInvestigatorPhase;
  Engine.startInvestigatorPhase = function (first) {
    const r = sip.apply(this, arguments);
    if (first && G.round <= 1 && !G.vars.__customItems) {
      G.vars.__customItems = 1;
      (async () => {
        for (let i = 0; i < G.inv.length; i++) {
          const c = BY[G.inv[i].id]; if (!c || G.items.some(x => x.id === c.item.id)) continue;
          const it = Engine.addItem(DB.items[c.item.id]); it.owner = i; UI.render();
          await Engine.say({ title: G.inv[i].name, text: `遊戲開始時，${G.inv[i].name} 持有專屬武器【${c.item.name}】。`, items: [it] });
        }
      })();
    }
    return r;
  };

  // ---------- 繼國緣一【通透世界】：攻擊時花 1 線索重擲任意數量的骰子（每輪一次）----------
  const op = CE.optionals;
  CE.optionals = function (idx, ctx) {
    const out = op.apply(CE, arguments);
    const iv = G.inv[idx];
    if (iv && iv.id === 'INVESTIGATOR_YORIICHI_TSUGIKUNI' && ctx && ctx.kind === 'attack') {
      const used = CE.usedRound(iv, '__yori');
      out.push({
        key: '__yori', label: '通透世界', img: iv.img,
        text: '花 1 線索，重擲任意數量的骰子（先點選要重擲的骰子，再按這裡）。每輪一次。',
        eff: 'rerollSel', cost: {},
        disabled: used ? '本輪已使用' : iv.clues < 1 ? '沒有線索' : '',
        onUse: () => { iv.clues = Math.max(0, iv.clues - 1); CE.markRound(iv, '__yori'); Engine.log(`${iv.name} 的能力【通透世界】：花 1 線索重擲骰子`); }
      });
    }
    return out;
  };

  // ---------- 蝴蝶忍【精通藥理】：行動按鈕 ----------
  const SHINOBU = 'INVESTIGATOR_SHINOBU_KOCHO';
  const NAMEH = { damage: '傷害', horror: '恐怖' };
  const sameCell = (a, b) => { const x = MAP.posCell(G.inv[a]), y = MAP.posCell(G.inv[b]); return !x || !y || x.id === y.id; };
  async function pharma(idx) {
    const iv = G.inv[idx];
    await CE.doAction(idx, 'other', async () => {
      const n = await UI.diceDialog({ inv: idx, skill: 'lor', kind: 'test', need: 1, text: '精通藥理：檢定［知識］，至少 1 個成功', useResult: true });
      if (!(n >= 1)) { Engine.log(`${iv.name} 的精通藥理沒有成功`); await CE.alert('精通藥理', '沒有擲出成功，這次沒有效果（行動照常消耗）。'); return; }
      const pool = CE.alive().filter(j => (j === idx || sameCell(idx, j)) && (CE.cardsOf(G.inv[j], 'damage', false).length || CE.cardsOf(G.inv[j], 'horror', false).length));
      if (!pool.length) { await CE.alert('精通藥理', '檢定成功，但你和同一格的調查員都沒有面朝下的傷害卡或恐怖卡。'); return; }
      const t = pool.length === 1 ? pool[0] : await CE.chooseInvLayer('精通藥理：選你自己或同一格的一名調查員', pool);
      if (t == null) return;
      const tv = G.inv[t];
      const types = ['damage', 'horror'].filter(k => CE.cardsOf(tv, k, false).length);
      let type = types[0];
      if (types.length > 1) {
        const w = CE.layer(`<h3 class="dlgTitle">精通藥理</h3><div class="msg">${esc(tv.name)}：要棄除哪一種面朝下的卡？</div>
          <div class="btns">${types.map(k => `<button class="btn primary" data-k="${k}">棄除 1 張面朝下的${NAMEH[k]}卡</button>`).join('')}</div>`);
        type = await new Promise(res => w.box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { w.close(); res(b.dataset.k); }));
      }
      CE.heal(tv, type, 1, 'down');
      Engine.log(`${iv.name} 的精通藥理：${tv.name} 棄除 1 張面朝下的${NAMEH[type]}卡`);
      UI.toast(`${tv.name} 棄除 1 張面朝下的${NAMEH[type]}卡`); UI.render();
    });
  }


  // ---------- 宇髄天元【忍者步伐】----------
  const TENGEN = 'INVESTIGATOR_TENGEN_UZUI';
  // 移動行動多走 1 格
  const da = CE.doAction;
  CE.doAction = async function (idx, kind) {
    const ok = await da.apply(this, arguments);
    const iv = G.inv[idx];
    if (ok && kind === 'move' && iv && iv.id === TENGEN && iv.turn && iv.turn.move && !iv.turn.move.tengen) {
      iv.turn.move.left += 1; iv.turn.move.tengen = true;
      UI.toast(`${iv.name} 的忍者步伐：這次移動最多可以走 ${iv.turn.move.left} 格`); UI.render();
    }
    return ok;
  };
  // 每輪一次：離開有怪物的格子可以不躲避（持有骨笛時不行）
  const canSkip = idx => { const iv = G.inv[idx]; return iv && iv.id === TENGEN && G.phase === 'investigator' && !CE.usedRound(iv, '__tengen') && !(CE.pipesStuck && CE.pipesStuck(idx)); };
  const askSkip = async idx => {
    const iv = G.inv[idx], m = CE.monsterHere && CE.monsterHere(idx);
    if (!(await CE.ask('忍者步伐', `${iv.name} 要離開${m ? '和 ' + T(m.name) + ' ' : '有怪物的'}同一格。\n每輪一次，可以不做躲避檢定直接離開。要使用嗎？`, '不躲避，直接離開', '照常躲避'))) return false;
    CE.markRound(iv, '__tengen'); Engine.log(`${iv.name} 的忍者步伐：不躲避直接離開`); return true;
  };
  const ef = CE.evadeFirst;
  CE.evadeFirst = async function (idx, kind) {
    if (kind === 'move' && CE.monsterHere && CE.monsterHere(idx) && canSkip(idx) && await askSkip(idx)) return true;
    return ef.apply(this, arguments);
  };
  const me = CE.moveEvade;
  CE.moveEvade = async function (idx) {
    if (canSkip(idx) && await askSkip(idx)) {
      const iv = G.inv[idx], c = MAP.posCell(iv);
      if (iv.turn && iv.turn.move && c) iv.turn.move.evaded = c.id;
      UI.toast('忍者步伐：不用躲避，請再拖一次人偶'); UI.render(); return;
    }
    return me.apply(this, arguments);
  };

  // ---------- 調查員欄：能力按鈕、頭像顯示背景故事 ----------
  const ic = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = ic.apply(this, arguments);
    const D = INV_DATA[iv.id];
    if (iv.id === SHINOBU && G.phase === 'investigator' && G.active === idx && !iv.removed) {
      const b = document.createElement('button'); b.className = 'tbtn abil'; b.textContent = '能力';
      b.title = '精通藥理（花 1 行動）：檢定知識，至少 1 成功 → 你或同一格的一人棄除 1 張面朝下的傷害卡或恐怖卡';
      b.onclick = () => pharma(idx);
      const end = d.querySelector('.turnBar .end'); if (end) end.before(b);
    }
    return d;
  };

  // ---------- 攻擊抽到「丟棄你攻擊的武器」：專屬武器不會掉，改成角色台詞＋敵人受到 1 點傷害 ----------
  const KEEP = {
    INVESTIGATOR_YORIICHI_TSUGIKUNI: n => `${n}冷哼了一聲，反手用刀柄往對方腹部敲擊。`,
    INVESTIGATOR_SHINOBU_KOCHO: n => `${n}輕巧地旋身，用刀鞘點中對方的要害。`,
    INVESTIGATOR_TENGEN_UZUI: n => `${n}大笑一聲，雙刀交叉把對方震退。`
  };
  const DROP_RE = /(丟棄|棄除|丟掉)你(攻擊|使用)的武器|武器(被)?(打飛|脫手)/;
  const sayK = Engine.say;
  Engine.say = async function (o) {
    try {
      const t = o && o.text || '';
      const a = CE._atk, i = a ? a.idx : null, iv = i != null ? G.inv[i] : null;
      const c = iv && BY[iv.id];
      if (c && KEEP[iv.id] && DROP_RE.test(plain(t)) && G.items.some(it => it.id === c.item.id && it.owner === i)) {
        const m = G.monsters.find(x => x.uid === a.uid);
        const txt = KEEP[iv.id](iv.name) + `\n【${c.item.name}】是專屬武器，不會掉落。${m ? T(m.name) : '敵人'}生命 −1。`;
        const r = await sayK.call(Engine, Object.assign({}, o, { text: txt }));
        if (m && G.monsters.includes(m)) {
          m.dmg += 1; Engine.log(`${T(m.name)} 受到 1 點傷害（${m.dmg}/${m.hp}）`); UI.toast(`${T(m.name)} 受到 1 點傷害`); UI.render();
          if (m.dmg >= m.hp && await UI.confirm(`${T(m.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`)) await Engine.killMonster(m);
        }
        return r;
      }
    } catch (e) { console.error(e); }
    return sayK.apply(Engine, arguments);
  };
})();
