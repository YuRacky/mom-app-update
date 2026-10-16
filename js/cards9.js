// ============================================================
//  第 9 批：詭鎮街道的實體卡片與規則
//  強化（技能 +1，每項技能只能強化一次）、秘藥、剛正狀態、新的道具／法術／傷害／恐怖卡
//  卡片文字依使用者提供的 PDF、Doc1、Doc2 轉錄
// ============================================================
(function () {
  const P = 'MAD25';
  const has = (idx, id) => G.items.some(it => it.owner === idx && it.id === id);
  const SK = k => SKILLS.find(s => s.k === k);

  // ==========================================================
  //  1. 卡片資料
  // ==========================================================
  Object.assign(CARDS.items, {
    COMMON_ITEM_ENHANCING_SERUM: { cat: '裝備', kind: 'act', text: '行動：強化［力量］。然後棄除該卡。', act: { improve: 'str', discardSelf: true } },
    COMMON_ITEM_MUTATION_JUICE: { cat: '裝備', kind: 'act', text: '行動：強化［敏捷］。然後棄除該卡。', act: { improve: 'agi', discardSelf: true } },
    COMMON_ITEM_OCULAR_EXTRACT: { cat: '裝備', kind: 'act', text: '行動：強化［觀察］。然後棄除該卡。', act: { improve: 'obs', discardSelf: true } },
    COMMON_ITEM_MENTAL_STIMULANT: { cat: '裝備', kind: 'act', text: '行動：強化［知識］。然後棄除該卡。', act: { improve: 'lor', discardSelf: true } },
    COMMON_ITEM_MOON_POTION: { cat: '裝備', kind: 'act', text: '行動：強化［影響力］。然後棄除該卡。', act: { improve: 'inf', discardSelf: true } },
    COMMON_ITEM_FLASK: { cat: '裝備', kind: 'act', text: '行動：強化［意志］。然後棄除該卡。', act: { improve: 'wil', discardSelf: true } },
    COMMON_ITEM_THERMOS: {
      cat: '裝備', kind: 'act', text: '行動：棄除一點傷害然後進入集中狀態。然後將該卡翻面。', act: { discardAny: { damage: 1 }, cond: 'focused', flip: 'self' },
      flip: { name: '熱水瓶（背面）', cat: '重型武器', w: 'melee', dmg: 1, text: '該卡視為重型武器。\n「對靈魂有益的，可不只有熱湯。」' }
    },
    COMMON_ITEM_BULLETPROOF_VEST: { cat: '裝備', kind: 'note', text: '如果你將要受到至少2點傷害，將所受的傷害減少1點。', note: {} },
    COMMON_ITEM_SCALPEL: { cat: '銳器', w: 'melee', dmg: 1, bonus: 1, kind: 'note', text: '使用該卡攻擊時，你可以額外造成1點傷害。（攻擊時自動 +1）', note: {} },
    COMMON_ITEM_SNUBNOSE_REVOLVER: { cat: '槍械', w: 'ranged', dmg: 2, kind: 'note', text: '如果你在躲避檢定時行動強制結束，你可以對一隻與你同格的怪物造成1點傷害。', note: {} },
    COMMON_ITEM_GAMBLERS_DICE: { cat: '裝備', kind: 'opt', text: '每輪一次，你可以將一個🔍轉換為空白面，來重擲你的其他骰子。', opt: { when: 'any', eff: 'gambler', limit: 'round' } },
    // 特殊道具：貝基（有能力，放在 items 才會出現在擲骰畫面）
    UNIQUE_ITEM_BECKY: { cat: '槍械', w: 'ranged', dmg: 4, kind: 'opt', text: '每輪一次，你可以重擲1個骰子。', opt: { when: 'any', eff: 'rerollOne', limit: 'round' } },
    UNIQUE_ITEM_STAR_CALENDAR: { cat: '遺物', kind: 'note', text: '如果你在一個移動行動中，移動了至少2格，受到1點面朝下的傷害。', note: {} },
    UNIQUE_ITEM_STONE_CHEST: { cat: '遺物', kind: 'note', text: '當你執行一個移動行動時，你只能移動最多1格。', note: {} },
    UNIQUE_ITEM_STRANGE_TABLET: { cat: '遺物', kind: 'note', text: '當你受到至少1點恐怖時，進入眩暈狀態。', note: {} },
    UNIQUE_ITEM_MYSTERIOUS_IDOL: { cat: '遺物', kind: 'note', text: '當你受到至少1點傷害時，進入眩暈狀態。', note: {} },
    UNIQUE_ITEM_BONE_PIPES: { cat: '遺物', kind: 'note', text: '你不能躲避怪物。', note: {} }
  });
  Object.assign(CARDS.unique, {
    UNIQUE_ITEM_DE_VERMIS_MYSTERIIS: { cat: '證據、書本', text: '書中記載了禁忌力量的獲取方法，但要付出極大的代價。' },
    UNIQUE_ITEM_LEDGER: { cat: '證據、書本', text: '根據帳本的記錄，阿卡姆幾乎每個人都欠歐巴尼恩幫的錢。' },
    UNIQUE_ITEM_OLD_MAP: { cat: '證據', text: '雖然地圖上清楚地標出了路線，但並未標出一路上的危險。' }
  });
  Object.assign(CARDS.spells, {
    SPELL_AZURE_FLAME: {
      name: '藍焰術', front: { w: 'ranged', dmg: 2, text: '該卡視為「光源」。' }, backs: [
        { text: '從你的指尖，發出一道道藍色的閃電，向敵人射去。沒有額外效果。', eff: {} },
        { text: '你剛唸完咒語，法術就失去了控制；受到1點恐怖，或在相鄰一格中放置1個火焰標記。', eff: { choose: [{ label: '受到1點恐怖', eff: { horrorUp: 1 } }, { label: '在相鄰一格放置火焰', eff: { manual: '請在相鄰的一格放置1個火焰標記。' } }] } },
        { text: '從你的指尖噴射出藍色的火焰，纏繞住了敵人的身軀。怪物受到額外1點傷害，然後在其格子中放置1個火焰標記。', eff: { monster: 1, manual: '請在怪物所在的格子放置1個火焰標記。' } },
        { text: '你釋放的火焰越來越強，你不得不用生命去供養它；將1張傷害卡和1張恐怖卡翻面朝上。', eff: { flipDamageUp: 1, flipHorrorUp: 1 } },
        { text: '你瘋狂地笑著，在敵人的尖叫聲中，火焰越來越大，直到變成一個旋渦。範圍內所有怪物各受到1點傷害，然後你受到1點恐怖。', eff: { monster: 1, horrorUp: 1, manual: '範圍內其他的怪物也各受到1點傷害。' } }]
    },
    SPELL_FORCED_LEARNING: {
      name: '知識刻印', front: { act: { selfOrOther: true, improveAny: true }, text: '行動：你或範圍內的另一名調查員可以強化一項技能。然後將該卡翻面。' }, backs: [
        { test: { need: 3 }, ok: {}, fail: { loseClue: 1 }, text: '你的咒語打開了潛意識的大門（［知識］；3）。如果檢定成功，咒語漸漸消散；沒有額外效果。如果檢定失敗，新的知識充滿了你的頭腦，你開始遺忘以前的知識；棄除1個線索。' },
        { test: { need: 3 }, ok: { clue: 1 }, fail: { flipHorrorUp: 1 }, text: '你感覺自己越來越強，所向披靡（［知識］；3）。如果檢定成功，你對自己的調查更有自信了；獲得1個線索。如果檢定失敗，那種感覺很快退散，只剩下空虛；將1張恐怖卡翻面朝上。' },
        { test: { need: 2 }, ok: {}, fail: { horrorUp: 1 }, text: '你試圖抵抗住知識的洪流（［知識］；2）。如果檢定成功，眩暈很快褪去了；沒有額外效果。如果檢定失敗，在遠古知識的衝擊下，你感到頭痛欲裂；受到1點恐怖。' },
        { test: { need: 3 }, ok: { cond: 'righteous' }, fail: { horrorUp: 1 }, text: '當力量在你的血管中流動，你試圖獲得更多的知識（［知識］；3）。如果檢定成功，新知識並沒有對你造成太大的衝擊；進入剛正狀態。如果檢定失敗，你貪心地想要獲得更多，結果卻迷失了自我；受到1點恐怖。' },
        { test: { need: 3 }, ok: {}, fail: { horrorUp: 1 }, text: '知識只有在實踐時才能釋放最大的魅力（［知識］；3）。如果檢定成功，你成功使用了剛學會的咒文；沒有額外效果。如果檢定失敗，你走火入魔；受到1點恐怖。' }]
    },
    SPELL_IMPLANT_SUGGESTION: {
      name: '意識操縱', front: { act: { otherInRange: true, grantAction: true }, text: '行動：範圍內的另一名調查員可以執行一個行動。然後將該卡翻面。' }, backs: [
        { test: { need: 2 }, ok: { swapImprove: true }, fail: { horror: 1 }, text: '你感到自己的意識與他人相連時，像是被緊緊攫噬一般（［知識］；2）。如果檢定成功，你重新掌控了自己的意識；你可以棄除1個強化標記，來強化你的另一項技能。如果檢定失敗，你感覺自己的真實想法被人看透了；受到1點面朝下的恐怖。' },
        { test: { need: 2 }, ok: {}, fail: { flipDamageUp: 2 }, text: '當你在操縱對方時，突然感到有人也在試圖控制你的意識（［知識］；2）。如果檢定成功，你快速強化了精神防禦；沒有額外效果。如果檢定失敗，你不得不中斷意識連接；將2張傷害卡翻面朝上。' },
        { test: { need: 3 }, ok: { improve: true }, fail: { loseClue: 1 }, text: '一股巨大的能量流遍你全身，令你無法自拔（［知識］；3）。如果檢定成功，你獲得了不為人知的益處；強化一項你的技能。如果檢定失敗，你突然忘記了自己是誰；棄除1個線索。' },
        { test: { need: 2 }, ok: {}, fail: { horrorUp: 1 }, text: '你快速默念著法術的咒文（［知識］；2）。如果檢定成功，法術正常釋放；沒有額外效果。如果檢定失敗，你突然覺得呼吸急促，喘不過氣來；受到1點恐怖。' },
        { test: { need: 3 }, ok: { improve: true }, fail: { horrorUp: 1, manual: '範圍內的另一名調查員也受到1點恐怖（請在他的欄位用＋加上）。' }, text: '在你中斷連接前，你感到一股強大的力量試圖進入你的腦海（［知識］；3）。如果檢定成功，那股力量一閃而過，不過卻讓你的精神異常興奮；強化一項你的技能。如果檢定失敗，你突然開始默念一些意義不明的話語；你和範圍內的另一名調查員各受到1點恐怖。' }]
    }
  });
  CE.COND.righteous = '剛正';
  CARDS.conditions.righteous = { name: '剛正', text: '每輪一次，你可以將一個🔍轉換為★。當你受到至少1點恐怖時，棄除該卡。', until: 'horror' };
  if (typeof CONDITIONS !== 'undefined' && !CONDITIONS.includes('剛正')) CONDITIONS.push('剛正');
  // 傷害／恐怖卡（有勾選詭鎮街道才加進牌堆）
  CARDS.damage.push(
    { prod: P, name: '輕傷', n: 2, mode: 'imm', eff: {}, text: '沒有額外效果。將該卡翻面朝下。', flavor: '只是一點皮肉傷。' },
    { prod: P, name: '渴望正義', n: 1, mode: 'imm', eff: { cond: 'righteous' }, text: '進入剛正狀態。然後將該卡翻面朝下。', flavor: '雖然你身負重傷，但你仍然希望正義降臨。' },
    { prod: P, name: '疼痛之霧', n: 1, mode: 'disc', eff: { loseImprove: 1 }, text: '棄除1個強化標記。然後棄除該卡。', flavor: '你想做得更好，但疼痛令你的腦海一片混亂。' },
    { prod: P, name: '疲憊', n: 1, mode: 'up', eff: { clueOnCond: true }, text: '當你獲得一張狀態卡時，棄除1個線索。', flavor: '夜色越來越濃，疲勞令你的記憶力開始變差。' });
  CARDS.horror.push(
    { prod: P, name: '輕微驚嚇', n: 2, mode: 'imm', eff: {}, text: '沒有額外效果。將該卡翻面朝下。', flavor: '啊！你的心跳加快，呼吸急促。' },
    { prod: P, name: '熱情', n: 1, mode: 'imm', eff: { cond: 'righteous' }, text: '進入剛正狀態。然後將該卡翻面朝下。', flavor: '困難壓不住你，只會讓你的心更加堅強。' },
    { prod: P, name: '衰老', n: 1, mode: 'disc', eff: { loseImprove: 1 }, text: '棄除1個強化標記。然後棄除該卡。', flavor: '年輕是多麼愉悅，多麼歡樂，但你已經回不去了。' },
    { prod: P, name: '平庸', n: 1, mode: 'up', eff: { noImprove: true }, text: '你不能強化技能。', flavor: '你突然意識到，無論自己做什麼，也永遠不可能成為英雄。' });
  CARDS.insanity.push(
    { prod: P, name: '狂熱信條', min: 3, win: 'ask', ask: '你持有的法術比你右手邊的玩家多嗎？', text: '你的勝利條件改變：只有當調查完成，而且你持有的法術比你右手邊玩家多時，你才能獲勝。否則你就失敗。', flavor: '你平凡的肉體已經無法承載這種力量，你需要將自己奉獻給神。' },
    { prod: P, name: '嫉妒', min: 3, win: 'ask', ask: '你持有的道具比你左手邊的玩家多嗎？', text: '你的勝利條件改變：只有當調查完成，而且你持有的道具比你左手邊玩家多時，你才能獲勝。否則你就失敗。', flavor: '別人的天堂就是你的地獄。你容不得他人的幸福。' },
    { prod: P, name: '算計', min: 3, win: 'ask', ask: '你持有的「證據」性質道具比你右手邊的玩家多嗎？', text: '你的勝利條件改變：只有當調查完成，而且你持有的「證據」性質道具比你右手邊玩家多時，你才能獲勝。否則你就失敗。', flavor: '信任是這個世界上最愚蠢的東西，謊言只有握在自己手裡，才最安全。' });
  Object.assign(CARDS.monsters, {
    MONSTER_HIRED_GUN: { aw: 2, hr: 1, brawn: 2, kw: [], flavor: '當金錢凌駕于道德之上時，最普通的人也會變成殘忍的殺手。' },
    MONSTER_SKELETON: { aw: 2, hr: 4, brawn: 2, kw: ['水棲'], flavor: '沉睡多年的白骨，終於在黑暗的操縱下，再一次站了起來。' },
    MONSTER_STAR_VAMPIRE: { aw: 4, hr: 6, brawn: 3, kw: ['穿透'], flavor: '星之精本來是透明的，在吸血後，全身會變成血紅色。等它消化完畢後，就會再次外出覓食。' },
    MONSTER_LLOIGOR: { aw: 7, hr: 9, brawn: 5, kw: [], flavor: '斯瑪般的外形只是羅格爾的幻象，它喜歡慢慢吞噬人類的精神。當它的爪子撕裂了人的肉體時，才知道為時已晚。' }
  });
  // 沒有勾選詭鎮街道：這些卡不放進牌堆
  const offProd = c => c && c.prod && !(G.collection && G.collection.has(c.prod));
  const bd = CE.buildDeck;
  CE.buildDeck = function (type) { const src = CARDS[type]; return bd.apply(this, arguments).filter(i => !offProd(src[i])); };
  const di = CE.drawInsanity;
  CE.drawInsanity = function () {
    const off = CARDS.insanity.filter(offProd); off.forEach(c => { c._min = c.min; c.min = 99; });
    try { return di.apply(this, arguments); } finally { off.forEach(c => { c.min = c._min; }); }
  };
  // 瘋狂卡個人勝負：要比較其他玩家的，先問玩家
  const go = UI.gameOver;
  UI.gameOver = async function (victory) {
    for (const iv of G.inv) {
      const d = iv.insanity != null && CARDS.insanity[iv.insanity];
      if (d && d.win === 'ask') iv._ask = victory && await CE.ask(`${iv.name} 的瘋狂卡：${d.name}`, d.ask, '是', '否');
    }
    return go.apply(this, arguments);
  };

  // ==========================================================
  //  2. 強化（官方規則書：每項技能只能強化一次；強化標記不是道具）
  // ==========================================================
  const upEff = (iv, key) => (iv.cards || []).some(x => x.up && CARDS[x.t][x.c] && CARDS[x.t][x.c].eff[key]);
  CE.pickSkill = function (title, list) {
    return new Promise(res => {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">${list.map(s => `<div class="pick" data-k="${s.k}"><img src="${s.icon}"><div>${s.zh}</div></div>`).join('')}</div><div class="btns"><button class="btn">取消</button></div>`);
      w.box.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { w.close(); res(el.dataset.k); });
      w.box.querySelector('.btn').onclick = () => { w.close(); res(null); };
    });
  };
  CE.improve = async function (idx, sk, why) {
    const iv = G.inv[idx]; if (!iv) return false;
    iv.imp = iv.imp || {};
    if (upEff(iv, 'noImprove')) { await CE.alert('不能強化', `${iv.name} 有面朝上的「平庸」恐怖卡：不能強化技能。`); return false; }
    let k = sk;
    if (!k) {
      const opts = SKILLS.filter(s => !iv.imp[s.k]);
      if (!opts.length) { await CE.alert('不能強化', `${iv.name} 的六項技能都已經強化過了。`); return false; }
      k = await CE.pickSkill(`${iv.name} 要強化哪一項技能？${why ? '（' + why + '）' : ''}`, opts);
      if (!k) return false;
    }
    if (iv.imp[k]) { await CE.alert('不能強化', `${iv.name} 的${SK(k).zh}已經強化過了（同一項技能只能強化一次）。`); return false; }
    iv.imp[k] = true; iv.skills[k]++;
    Engine.log(`${iv.name} 強化${SK(k).zh}（${iv.skills[k] - 1} → ${iv.skills[k]}）`);
    UI.toast(`${iv.name} 的${SK(k).zh} +1`);
    UI.render();
    return true;
  };
  CE.loseImprove = async function (iv) {
    const ks = Object.keys(iv.imp || {}).filter(k => iv.imp[k]);
    if (!ks.length) { Engine.log(`${iv.name} 沒有強化標記可以棄除`); return null; }
    const k = ks.length === 1 ? ks[0] : await CE.pickSkill(`${iv.name} 要棄除哪一個強化標記？`, ks.map(SK)) || ks[0];
    delete iv.imp[k]; iv.skills[k]--;
    Engine.log(`${iv.name} 棄除${SK(k).zh}的強化標記（${iv.skills[k] + 1} → ${iv.skills[k]}）`);
    UI.render();
    return k;
  };
  // 存數值時扣掉強化（強化只在這一局有效）
  const ss = UI.saveStats;
  UI.saveStats = function (iv) {
    const imp = iv.imp || {}; const skills = Object.assign({}, iv.skills);
    for (const k in imp) if (imp[k]) skills[k]--;
    return ss.call(UI, Object.assign({}, iv, { skills }));
  };
  // 使用強化道具
  const ui0 = CE.useItem;
  CE.useItem = async function (it) {
    const f = CE.face(it), a = f && f.act;
    if (!a || !a.improve) return ui0.apply(this, arguments);
    const idx = it.owner; if (idx == null) return;
    const iv = G.inv[idx];
    if (G.phase === 'investigator') {
      CE.ensure(iv);
      if (G.active !== idx) CE.setActive(idx, true);
      if (iv.turn.acts >= CE.maxActs(iv)) { UI.toast(`${iv.name} 這回合的行動已經用完了`); return; }
    }
    if (!await CE.improve(idx, a.improve)) return;
    CE.discardItem(it, '使用');
    Engine.log(`${iv.name} 使用【${T(it.name)}】`);
    CE.spend(idx, 'other');
    UI.render();
  };
  // 傷害／恐怖卡的新效果
  const ae = CE.applyEff;
  CE.applyEff = async function (iv, e) {
    if (e && e.loseImprove) await CE.loseImprove(iv);
    return ae.apply(this, arguments);
  };
  // 疲憊：獲得狀態卡時棄除 1 線索
  const ac = CE.addCond;
  CE.addCond = function (iv, key) {
    const n = CE.COND[key] || key, had = iv.conds.includes(n);
    const r = ac.apply(this, arguments);
    if (r !== false && !had && iv.conds.includes(n) && upEff(iv, 'clueOnCond') && iv.clues > 0) { iv.clues--; Engine.log(`${iv.name} 的「疲憊」：獲得狀態，棄除 1 線索`); }
    return r;
  };

  // ==========================================================
  //  3. 受到傷害／恐怖時的自動效果
  // ==========================================================
  const suf = CE.suffer;
  CE.suffer = async function (iv, type, n, down) {
    if (!iv || !n) return suf.apply(this, arguments);
    const idx = G.inv.indexOf(iv);
    if (type === 'damage' && n >= 2 && has(idx, 'COMMON_ITEM_BULLETPROOF_VEST')) { n--; UI.toast(`${iv.name} 的防彈衣：傷害減少 1 點`); Engine.log(`${iv.name} 的防彈衣：傷害減少 1 點`); }
    if (type === 'horror' && n >= 2 && iv.id === 'INVESTIGATOR_DIANA_STANLEY') { n--; UI.toast(`${iv.name} 的能力：恐怖減少 1 點`); Engine.log(`${iv.name} 的能力：恐怖減少 1 點`); }
    const r = await suf.call(this, iv, type, n, down);
    if (type === 'horror' && CE.has(iv, 'righteous')) { CE.delCond(iv, 'righteous'); Engine.log(`${iv.name} 受到恐怖，棄除剛正狀態`); }
    if (type === 'horror' && has(idx, 'UNIQUE_ITEM_STRANGE_TABLET') && !CE.has(iv, 'dazed')) { CE.addCond(iv, 'dazed'); UI.toast(`${iv.name} 的奇異石牌：進入眩暈狀態`); }
    if (type === 'damage' && has(idx, 'UNIQUE_ITEM_MYSTERIOUS_IDOL') && !CE.has(iv, 'dazed')) { CE.addCond(iv, 'dazed'); UI.toast(`${iv.name} 的神秘偶像：進入眩暈狀態`); }
    UI.render();
    return r;
  };
  // 擲骰選項：剛正
  const op = CE.optionals;
  CE.optionals = function (idx, ctx) {
    const out = op.apply(this, arguments), iv = G.inv[idx];
    if (iv && CE.has(iv, 'righteous')) out.push({ key: '__right', label: '剛正', img: 'img/icons/clue.png', text: CARDS.conditions.righteous.text, eff: 'oneClue', cost: {}, limit: 'round', disabled: CE.usedRound(iv, '__right') ? '本輪已使用' : '' });
    return out;
  };
  // 移動：石製箱子最多 1 格；星曆移動 2 格以上受 1 點面朝下傷害
  const da = CE.doAction;
  CE.doAction = async function (idx, kind) {
    const ok = await da.apply(this, arguments);
    const iv = G.inv[idx];
    if (ok && kind === 'move' && iv.turn && iv.turn.move && has(idx, 'UNIQUE_ITEM_STONE_CHEST')) { iv.turn.move.left = 1; UI.toast(`${iv.name} 帶著石製箱子：這次最多移動 1 格`); UI.render(); }
    return ok;
  };
  const em = CE.endMove;
  CE.endMove = async function (idx) {
    const iv = G.inv[idx], mv = iv.turn && iv.turn.move;
    const r = await em.apply(this, arguments);
    if (mv && mv.steps >= 2 && has(idx, 'UNIQUE_ITEM_STAR_CALENDAR')) { await CE.alert('星曆', `${iv.name} 這次移動了 ${mv.steps} 格，受到 1 點面朝下的傷害。`); await CE.suffer(iv, 'damage', 1, true); }
    return r;
  };

  // ==========================================================
  //  4. 法術的新效果
  // ==========================================================
  const se = CE.spellEff;
  CE.spellEff = async function (e, casterIdx, targetIdx, mon) {
    if (!e) return se.apply(this, arguments);
    const me = G.inv[casterIdx];
    if (e.choose) {
      const w = CE.layer(`<h3 class="dlgTitle">選一個</h3><div class="btns" style="flex-direction:column">${e.choose.map((c, i) => `<button class="btn primary" data-i="${i}">${esc(c.label)}</button>`).join('')}</div>`);
      const i = await new Promise(res => w.box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { w.close(); res(+b.dataset.i); }));
      await CE.spellEff(e.choose[i].eff, casterIdx, targetIdx, mon);
    }
    if (e.loseClue && me.clues > 0) { me.clues = Math.max(0, me.clues - e.loseClue); Engine.log(`${me.name} 棄除 ${e.loseClue} 個線索`); }
    if (e.cond) CE.addCond(me, e.cond);
    if (e.improve) await CE.improve(casterIdx, null, '法術效果');
    if (e.swapImprove && Object.values(me.imp || {}).some(Boolean) && await CE.ask('意識操縱', `${me.name} 要棄除 1 個強化標記，來強化另一項技能嗎？`, '要', '不要')) {
      const old = await CE.loseImprove(me);
      if (old) { me.imp[old] = 'x'; const ok = await CE.improve(casterIdx, null, '換一項技能'); if (me.imp[old] === 'x') delete me.imp[old]; if (!ok) { me.imp[old] = true; me.skills[old]++; } }
    }
    return se.call(this, e, casterIdx, targetIdx, mon);
  };
  const usf = CE.useSpellFront;
  CE.useSpellFront = async function (it, idx, target) {
    const sp = CARDS.spells[it.id], a = (sp && sp.front.act) || {};
    if (a.improveAny) await CE.improve(target, null, sp.name);
    if (a.grantAction) await CE.alert(sp.name, `${G.inv[target].name} 現在可以執行一個行動（不用花他自己的行動）。`);
    return usf.apply(this, arguments);
  };

  // ==========================================================
  //  5. 秘藥（6 張，背面隨機、看不到；用了才翻開）
  // ==========================================================
  const ELIX = [
    { name: '噩夢果汁', flavor: '你的頭腦中打開了一扇窗，窗外是無限的混沌，你只好用盡全力將那扇窗關上。', text: '進入擊昏狀態。然後棄除該卡。', cond: 'stunned', disc: true },
    { name: '酸性物質', flavor: '你的血液突然開始急速流淌，皮膚滲出了紅色的血滴。', text: '在你回合結束時，將1張傷害卡翻至面朝上。', endTurn: 'damage' },
    { name: '發光液體', flavor: '夜色下，如果站在某個特定的角度，能看到你的皮膚正發著微弱的光。', text: '進入剛正狀態。然後棄除該卡。', cond: 'righteous', disc: true },
    { name: '麻痺試劑', flavor: '你突然覺得做什麼都很困難，感覺自己像是掉在蜜糖裡的一隻蒼蠅，腦子變成了一團漿糊。', text: '進入眩暈狀態。然後棄除該卡。', cond: 'dazed', disc: true },
    { name: '安慰劑', flavor: '你喝下了秘藥，感覺藥劑在你體內流動，伴隨著輕微的刺痛。你相信藥劑正在起效，只是這藥效需要一定的時間才能看得見。', text: '沒有額外效果。棄除該卡。', disc: true },
    { name: '周公夢蝶', flavor: '你已經搞不清楚是在夢中，還是在現實之中。周圍的一切突然開始混亂起來。', text: '在你回合結束時，將1張恐怖卡翻至面朝上。', endTurn: 'horror' }
  ];
  const ELIX_FRONT = '在你回合開始時，你可以強化自己的一項技能。如果你這麼做，將該卡翻面。';
  CE.giveElixir = function (idx) {
    const iv = G.inv[idx]; if (!iv) return;
    G.ce = G.ce || {};
    const held = new Set(); G.inv.forEach(o => (o.elix || []).forEach(e => held.add(e.b)));
    let deck = (G.ce.elix || []).filter(b => !held.has(b));
    if (!deck.length) deck = shuffle([0, 1, 2, 3, 4, 5].filter(b => !held.has(b)));
    const b = deck.pop(); G.ce.elix = deck;
    if (b == null) { UI.toast('秘藥都已經發完了'); return; }
    (iv.elix = iv.elix || []).push({ b, up: false });
    Engine.log(`${iv.name} 獲得一瓶秘藥`);
    UI.render();
  };
  CE.useElixir = async function (idx, k) {
    const iv = G.inv[idx], e = iv.elix[k]; if (!e || e.up) return;
    if (!await CE.improve(idx, null, '秘藥')) return;
    const d = ELIX[e.b];
    e.up = true;
    await CE.alert(`秘藥翻面：${d.name}`, `[i]${d.flavor}[/i]\n\n${d.text}`);
    if (d.cond) CE.addCond(iv, d.cond);
    if (d.disc) { iv.elix.splice(k, 1); G.ce.elix = (G.ce.elix || []).concat([e.b]); }
    UI.render();
  };
  // 拿到秘藥：問是誰拿
  const spi = Actions.SpawnItem;
  Actions.SpawnItem = async function (a, f) {
    if (!(a.Item && a.Item.ref === 'UNIQUE_ITEM_ELIXIR')) return spi.apply(this, arguments);
    const def = DB.items.UNIQUE_ITEM_ELIXIR;
    await Engine.say({ text: Engine.resolveMessage(a.Message, f), items: [{ id: def.id, name: def.name, img: def.img, type: 2, owner: null, interactions: [] }], fsm: f });
    const list = CE.alive();
    const who = list.length > 1 ? await CE.chooseInvLayer('誰拿到這瓶秘藥？', list) : list[0];
    CE.giveElixir(who != null ? who : (CE.actorNow ? CE.actorNow() : 0) || 0);
    return { event: 'NEXT' };
  };
  // 回合結束：酸性物質、周公夢蝶
  const et = CE.endTurn;
  CE.endTurn = async function (i) {
    const r = await et.apply(this, arguments);
    const iv = G.inv[i];
    for (const e of (iv && iv.elix) || []) {
      const d = ELIX[e.b];
      if (e.up && d.endTurn) { await CE.alert(d.name, `${iv.name} 的回合結束：將 1 張${d.endTurn === 'damage' ? '傷害' : '恐怖'}卡翻至面朝上。`); await CE.flipUp(iv, d.endTurn); await CE.checkLimit(iv, d.endTurn); }
    }
    return r;
  };

  // ==========================================================
  //  6. 調查員欄：強化標記、秘藥
  // ==========================================================
  const ic = UI.invCard;
  UI.invCard = function (iv, idx) {
    const d = ic.apply(this, arguments);
    try {
      for (const k in iv.imp || {}) if (iv.imp[k]) {
        const el = d.querySelector(`.skill[data-s="${k}"]`);
        if (el) { el.classList.add('imp'); el.title = '已強化（+1）'; }
      }
      if ((iv.elix || []).length) {
        const box = document.createElement('div');
        box.innerHTML = `<div class="lbl">秘藥</div><div class="chips">${iv.elix.map((e, k) => e.up
          ? `<span class="chip cond" title="${esc(ELIX[e.b].text)}">${esc(ELIX[e.b].name)}：${esc(ELIX[e.b].text)}</span>`
          : `<span class="chip elix" data-ex="${k}" title="${esc(ELIX_FRONT)}"><img src="img/items/UniqueItem_Elixir.png">秘藥（點一下使用）</span>`).join('')}</div>`;
        const anchor = [...d.querySelectorAll('.lbl')].find(x => x.textContent.includes('狀態'));
        if (anchor) d.insertBefore(box, anchor); else d.appendChild(box);
        box.querySelectorAll('[data-ex]').forEach(el => el.onclick = async e => {
          e.stopPropagation();
          if (await CE.ask('使用秘藥', `${ELIX_FRONT}\n\n（規則：在你回合開始時使用）\n${iv.name} 現在要使用嗎？`, '使用', '先不要')) CE.useElixir(idx, +el.dataset.ex);
        });
      }
    } catch (e) { console.error(e); }
    return d;
  };
})();
