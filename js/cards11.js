// ============================================================
//  2026-10-10：噩夢迭起／不堪回首的資料、專屬怪物數值、建築小格、
//             凱特／灰堆皮特的起始道具、錯字修正
// ============================================================
(function () {
  // ==========================================================
  //  1. 怪物數值（試算表＋實體照片＋卡牌網站核對過，三方一致）
  // ==========================================================
  Object.assign(CARDS.keywords, { '不可阻擋': '這個怪物嘗試破壞屏障時，將所有🔍轉化為★。' });
  const M = (aw, hr, brawn, kw) => ({ aw, hr, brawn, kw: kw || [], flavor: '' });
  Object.assign(CARDS.monsters, {
    // 噩夢迭起
    MONSTER_CTHONIAN: M(4, 7, 5),                 // 鑽地魔蟲
    UNIQUE_MONSTER_CULT_LEADER: M(4, 3, 2),       // 異教徒首領
    MONSTER_HOUND_OF_TINDALOS: M(6, 5, 3, ['穿透']),
    MONSTER_MANIAC: M(5, 1, 2, ['不可阻擋']),     // 殺人狂
    MONSTER_MI_GO: M(6, 4, 3, ['飛行']),
    MONSTER_SHOGGOTH: M(3, 6, 4),
    MONSTER_WITCH: M(3, 2, 2),
    MONSTER_ZOMBIE: M(2, 4, 2),
    // 不堪回首
    MONSTER_CHILD_OF_THE_GOAT: M(3, 1, 2),        // 黑山羊子嗣
    MONSTER_DARK_DRUID: M(3, 2, 2),
    MONSTER_DARK_YOUNG: M(4, 7, 5),               // 黑山羊幼崽
    MONSTER_GOAT_SPAWN: M(4, 3, 2),               // 黑山羊眷族
    MONSTER_NIGHTGAUNT: M(6, 5, 3, ['飛行']),     // 夜魘
    UNIQUE_MONSTER_WIZARD: M(4, 3, 2),            // 法師
    UNIQUE_MONSTER_DUNWICH_HORROR: M(7, 9, 5),
    MONSTER_CRAWLING_ONE: M(2, 4, 4),
    MONSTER_BYAKHEE: M(4, 3, 2, ['飛行'])
  });
  // 劇本專屬怪物（例如史密斯教授、梅寶）沒有自己的怪物標記：用它所用模型那隻怪物的數值
  for (const [id, d] of Object.entries(DB.monsters)) {
    if (CARDS.monsters[id]) continue;
    const base = Object.keys(CARDS.monsters).filter(b => DB.monsters[b] && DB.monsters[b].img === d.img).sort((a, b) => /^UNIQUE/.test(a) - /^UNIQUE/.test(b))[0];
    if (base) CARDS.monsters[id] = CARDS.monsters[base];
  }

  // ==========================================================
  //  2. 官方原檔錯字：UNIQUE_MONSTER_ROFESSOR_SMITH_MOVE（少了 P）
  // ==========================================================
  for (const S of [typeof STR !== 'undefined' && STR, typeof STR_EN !== 'undefined' && STR_EN]) if (S && S.UNIQUE_MONSTER_PROFESSOR_SMITH_MOVE != null && S.UNIQUE_MONSTER_ROFESSOR_SMITH_MOVE == null) S.UNIQUE_MONSTER_ROFESSOR_SMITH_MOVE = S.UNIQUE_MONSTER_PROFESSOR_SMITH_MOVE;

  // ==========================================================
  //  3. 有建築的板塊：建築是獨立一格，只能從入口進出
  //     入口有探索標記或門的：處理掉之前門是關的；沒有的：一開始就能進去
  //     座標是板塊未旋轉時的局部座標（中板塊 -1～1，小板塊寬 -1～1、高 -0.5～0.5）
  //     anchor：原本的格子中心被建築蓋住，棋子改放在這一點
  // ==========================================================
  Object.assign(MAP.TILE_INFO, {
    TILE_TOOL_SHED_MAD20: { anchor: { '-0.5,0.5': [-0.83, 0.83] }, names: { A: '院子', BLD0: '工具棚' },
      bld: [{ name: '工具棚', x: -0.15, y: 0.17, hx: 0.5, hy: 0.48, doors: [{ x: -0.1, y: -0.31, to: '-0.5,-0.5' }] }] },
    TILE_PIER_MAD20: { anchor: { '0.5,0.5': [0.17, 0.45] }, names: { A: '碼頭', BLD0: '小吃攤' },
      bld: [{ name: '小吃攤', x: 0.66, y: 0.455, hx: 0.29, hy: 0.335, doors: [{ x: 0.37, y: 0.35, to: '0.5,0.5' }] }] },
    TILE_BEACH_MAD20: { anchor: { '0.5,0': [0.45, 0.3] }, names: { A: '海灘', BLD0: '海灘小屋' },
      bld: [{ name: '海灘小屋', x: 0.435, y: -0.215, hx: 0.345, hy: 0.265, doors: [{ x: 0.43, y: 0.05, to: '0.5,0' }] }] },
    TILE_HOUSE_BOAT_MAD20: { anchor: { '0.5,0': [0.82, 0] }, names: { A: '遊艇', BLD0: '船艙' },
      bld: [{ name: '船艙', x: 0.29, y: -0.01, hx: 0.33, hy: 0.33, doors: [{ x: -0.04, y: 0, to: '-0.5,0' }, { x: 0.62, y: 0, to: '0.5,0' }] }] },
    TILE_RENTAL_DOCK_MAD20: { anchor: { '-0.5,0': [-0.55, 0.36] }, names: { A: '租船碼頭', BLD0: '租船小屋' },
      bld: [{ name: '租船小屋', x: -0.59, y: -0.125, hx: 0.35, hy: 0.315, doors: [{ x: -0.59, y: 0.19, to: '-0.5,0' }] }] }
  });

  // ==========================================================
  //  4. 凱特的「磁通量穩定器」、灰堆皮特的「杜克」（不可交易、不可丟棄）
  // ==========================================================
  const DUKE = 'UNIQUE_ITEM_DUKE_THE_DOG', FLUX = 'UNIQUE_ITEM_FLUX_STABILIZER';
  Object.assign(CARDS.items, {
    [DUKE]: { cat: '夥伴', kind: 'note', text: '當你的回合開始時，你可以與範圍內任一格中的調查員執行一次交易。（不可交易、不可丟棄）', note: {} },
    [FLUX]: { cat: '裝備', kind: 'note', text: '在你的回合開始時，移動一隻範圍內的怪物最多一格。（不可交易、不可丟棄）', note: {} }
  });
  const lk = CE.locked;
  CE.locked = function (it) { return (it && (it.id === DUKE || it.id === FLUX) && it.owner != null) || lk.apply(this, arguments); };
  const has = (i, id) => CE.owned(i).some(it => it.id === id);

  async function duke(i) {
    const others = CE.invsInRange(i) || [];
    if (!others.length) return;
    const iv = G.inv[i];
    if (!await CE.ask(`${iv.name} 的【杜克】`, '回合開始：要和範圍內的一名調查員交易嗎？（不花行動）', '交易', '不用')) return;
    const j = others.length === 1 ? others[0] : await CE.chooseInv('和誰交易？', others);
    if (j == null) return;
    await new Promise(res => {
      const w = CE.layer('');
      const draw = () => {
        const row = (it, to) => `<div class="trRow"><img src="img/items/${it.img}.png"><b>${esc(T(it.name))}</b><span class="trB"><button class="btn small" data-give="${it.id}" data-to="${to}">交給 ${esc(G.inv[to].name)}</button></span></div>`;
        w.box.innerHTML = `<h3 class="dlgTitle">杜克：${esc(iv.name)} 和 ${esc(G.inv[j].name)} 交易</h3>
          ${[[i, j], [j, i]].map(([a, b]) => `<div class="lbl" style="font-size:14px">${esc(G.inv[a].name)} 的物品</div>${CE.owned(a).filter(it => !CE.locked(it)).map(it => row(it, b)).join('') || '<div class="small">（沒有）</div>'}`).join('')}
          <div class="btns"><button class="btn primary" id="trOk">完成交易</button></div>`;
        w.box.querySelectorAll('[data-give]').forEach(b => b.onclick = () => { const it = G.items.find(x => x.id === b.dataset.give); it.owner = +b.dataset.to; Engine.log(`（杜克）${T(it.name)} 交給了 ${G.inv[it.owner].name}`); UI.render(); draw(); });
        w.box.querySelector('#trOk').onclick = () => { w.close(); res(); };
      };
      draw();
    });
  }
  async function flux(i) {
    const ms = CE.monstersInRange(i) || [];
    if (!ms.length) return;
    const iv = G.inv[i];
    let m = ms[0];
    if (ms.length > 1) {
      const w = CE.layer(`<h3 class="dlgTitle">${esc(iv.name)} 的【磁通量穩定器】</h3><div class="msg">回合開始：選一隻範圍內的怪物，移動牠最多一格。</div>
        <div class="grid">${ms.map((x, k) => `<div class="pick" data-k="${k}"><img src="img/monsters/${x.img}.png"><div>${esc(T(x.name))}</div></div>`).join('')}</div>
        <div class="btns"><button class="btn" data-k="-1">不移動</button></div>`);
      const k = await new Promise(res => w.box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { w.close(); res(+b.dataset.k); }));
      if (k < 0) return;
      m = ms[k];
    } else if (!await CE.ask(`${iv.name} 的【磁通量穩定器】`, `回合開始：移動範圍內的 ${T(m.name)} 最多一格。`, '移動', '不移動')) return;
    const c = MAP.posCell(m); if (!c) return;
    const g = MAP.build();
    const cells = [c, ...MAP.moveAdj(c.id).map(id => g.cells[id])];
    const t = await CE.pickCellMap(`把 ${T(m.name)} 移到哪一格？（點原來那格＝不動）`, cells);
    if (!t || t.id === c.id) return;
    m.x = t.x; m.y = t.y; MAP.snap(m, G.monsters);
    Engine.log(`（磁通量穩定器）${T(m.name)} 被移動 1 格`);
    UI.render();
    if (CE.hasFire && CE.hasFire(t)) { m.dmg += 1; UI.toast(`${T(m.name)} 被移進火焰，受到 1 點傷害`); UI.render(); if (m.dmg >= m.hp && await CE.ask('怪物被擊敗？', `${T(m.name)} 受到的傷害已達生命值，確定被擊敗了嗎？`, '擊敗', '還沒')) await Engine.killMonster(m); }
  }
  const ts = CE.turnStart;
  CE.turnStart = async function (i) {
    const iv = G.inv[i];
    const first = iv && iv.turn && !iv.turn.started && !(iv.turn.acts > 0) && !iv.turn.extra;
    const r = await ts.apply(this, arguments);
    if (first && G.phase === 'investigator' && !iv.turn.done && !G.gameOver && !iv.removed) {
      if (has(i, FLUX)) await flux(i);
      if (has(i, DUKE)) await duke(i);
    }
    return r;
  };
})();

// 一代擴充轉換：遊戲原檔要求 MAD01（＝噩夢迭起）、MAD06／MAD09（＝不堪回首）
(function () {
  const MAPP = { MAD01: 'MAD21', MAD06: 'MAD22', MAD09: 'MAD22' };
  // 新加入的劇本變體（data/mad2122.js）：接到原劇本後面，需要的盒子依用到的板塊判斷
  if (typeof SCEN_ADD_VARIANTS !== 'undefined') for (const [id, vs] of Object.entries(SCEN_ADD_VARIANTS)) {
    const s = DB.scenarios[id]; if (!s) continue;
    for (const v of vs) if (!s.variants.some(x => x.id === v.id)) s.variants.push(v);
  }
  const NEWV = ['03A', '04A', 'SB 02A', 'WLW 03A', 'WLW 04A', 'DD 01A', 'DD 01B', 'DD 02A', 'DD 03A', 'CoSH 01A', 'CoSH 01B', 'CoSH 02A', 'CoSH 03A'];
  for (const s of Object.values(DB.scenarios || {})) for (const v of s.variants || []) {
    if (!NEWV.includes(v.id) || !SCENARIOS[v.id]) continue;
    const ps = SCENARIOS[v.id].tiles.map(t => (/_(MAD\d\d)$/.exec(t.model) || [])[1]).filter(p => p && p !== 'MAD20');
    v.req = [...new Set([...(v.req || []), ...ps])];
  }
  for (const s of Object.values(DB.scenarios || {})) for (const v of s.variants || []) v.req = [...new Set((v.req || []).map(p => MAPP[p] || p))];
})();
