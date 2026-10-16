// ============================================================
//  第 3 階段：法術（正面效果 → 隨機抽背面 → 結算 → 換新的同名法術）
// ============================================================
(function () {
  const NAME = { damage: '傷害', horror: '恐怖' };
  const backHtml = (sp, b, no) => `<div class="dhCard spellBack"><div class="dhName">${esc(sp.name)}</div><div class="dhText" style="font-weight:normal;text-align:left">${fmt(b.text.replace(/［知識］/g, ''))}</div><div class="dhMode" style="margin-top:12px">背面 ${no}</div></div>`;
  CE.showBack = function (iv, sp, bi) {
    return new Promise(res => {
      const w = CE.layer(`<div class="small" style="text-align:center;margin-bottom:6px">${esc(iv.name)} 把【${esc(sp.name)}】翻到背面</div>${backHtml(sp, sp.backs[bi], bi + 1)}<div class="btns"><button class="btn primary">結算</button></div>`, 'cardShow');
      w.box.querySelector('button').onclick = () => { w.close(); res(); };
    });
  };
  // 套用法術背面的效果
  CE.spellEff = async function (e, casterIdx, targetIdx, mon) {
    if (!e) return;
    const me = G.inv[casterIdx];
    const who = e.target && targetIdx != null ? G.inv[targetIdx] : me;
    // 波及其他調查員
    const extra = [];
    if (e.area) {
      const others = CE.alive().filter(j => j !== casterIdx);
      if (others.length) {
        const q = e.area === 'range' ? '範圍內（3 格內）' : '同一格';
        const pickd = await CE.multiInv(`${q}還有哪些調查員也會受到？`, others);
        pickd.forEach(j => extra.push(G.inv[j]));
      }
    }
    for (const iv of [who, ...extra]) {
      if (e.horror) await CE.suffer(iv, 'horror', e.horror, true);
      if (e.damage) await CE.suffer(iv, 'damage', e.damage, true);
    }
    if (e.horrorUp) await CE.suffer(who, 'horror', e.horrorUp, false);
    if (e.flipHorrorUp) for (let k = 0; k < e.flipHorrorUp; k++) await CE.flipUp(who, 'horror');
    if (e.flipDamageUp) for (let k = 0; k < e.flipDamageUp; k++) await CE.flipUp(who, 'damage');
    let healT = who;
    if (e.any && CE.alive().length > 1) { const j = await CE.chooseInvLayer('你或範圍內另一名調查員', CE.alive()); if (j != null) healT = G.inv[j]; }
    if (e.flipHorrorDown) await CE.flipDown(healT, 'horror');
    if (e.flipDamageDown) await CE.flipDown(healT, 'damage');
    if (e.discardHorror) await CE.discardChosen(healT, 'horror');
    if (e.discardDamage) await CE.discardChosen(healT, 'damage');
    if (e.clue) { me.clues += e.clue; Engine.log(`${me.name} 獲得 ${e.clue} 線索`); }
    if (e.focusAny) { const j = CE.alive().length > 1 ? await CE.chooseInvLayer('誰進入集中狀態？', CE.alive()) : casterIdx; if (j != null) CE.addCond(G.inv[j], 'focused'); }
    if (e.monster && mon && G.monsters.includes(mon)) {
      mon.dmg += e.monster; Engine.log(`${T(mon.name)} 受到額外 ${e.monster} 點傷害`);
      UI.render();
      if (mon.dmg >= mon.hp && await CE.ask('怪物被擊敗？', `${T(mon.name)} 受到的傷害已達生命值（${mon.dmg}/${mon.hp}），確定被擊敗了嗎？`, '擊敗', '還沒')) await Engine.killMonster(mon);
    } else if (e.monster) await CE.alert('法術效果', `目標怪物受到額外 ${e.monster} 點傷害，請在怪物列記錄。`);
    for (const iv of [who, ...extra]) { await CE.checkLimit(iv, 'damage'); await CE.checkLimit(iv, 'horror'); }
    if (e.manual) await CE.alert('法術效果（請手動處理）', e.manual);
    UI.render();
  };
  CE.multiInv = function (title, list) {
    return new Promise(res => {
      const on = new Set();
      const w = CE.layer('');
      const draw = () => {
        w.box.innerHTML = `<h3 class="dlgTitle">${esc(title)}</h3><div class="grid">${list.map(i => `<div class="pick ${on.has(i) ? 'on' : ''}" data-i="${i}"><img src="${G.inv[i].img}"><div>${esc(G.inv[i].name)}</div></div>`).join('')}</div><div class="btns"><button class="btn primary">${on.size ? '確定' : '沒有其他人'}</button></div>`;
        w.box.querySelectorAll('[data-i]').forEach(el => el.onclick = () => { const i = +el.dataset.i; on.has(i) ? on.delete(i) : on.add(i); draw(); });
        w.box.querySelector('.btn').onclick = () => { w.close(); res([...on]); };
      };
      draw();
    });
  };
  const finish = (iv, sp) => { Engine.log(`${iv.name} 棄除【${sp.name}】並獲得一張新的${sp.name}`); };

  // 攻擊法術：攻擊擲骰完成後翻面
  CE.spellBack = async function (idx, id, mon) {
    const sp = CARDS.spells[id]; if (!sp) return;
    const iv = G.inv[idx], bi = rnd(5), b = sp.backs[bi];
    await CE.showBack(iv, sp, bi);
    await CE.spellEff(b.eff, idx, null, mon);
    finish(iv, sp);
  };

  // 輔助法術：正面效果 → 翻面 → ［知識］檢定
  CE.useSpellFront = async function (it, idx, target) {
    const sp = CARDS.spells[it.id], iv = G.inv[idx], tv = G.inv[target];
    const a = sp.front.act || {};
    if (a.cond) CE.addCond(tv, a.cond);
    if (a.discardAny && a.discardAny.horror) await CE.discardChosen(tv, 'horror');
    if (a.discardAny && a.discardAny.damage) await CE.discardChosen(tv, 'damage');
    Engine.log(`${iv.name} 施放【${sp.name}】${target !== idx ? '→ ' + tv.name : ''}`);
    UI.render();
    const bi = rnd(5), b = sp.backs[bi];
    await CE.showBack(iv, sp, bi);
    const n = await UI.diceDialog({ inv: idx, skill: 'lor', need: b.test.need, kind: 'spell', text: b.text.replace(/［知識］/g, ''), useResult: true, noOutcome: true });
    const ok = n >= b.test.need;
    await CE.alert(ok ? '檢定成功' : '檢定失敗', (ok ? '成功：' : '失敗：') + (Object.keys(ok ? b.ok : b.fail).length ? '' : '沒有額外效果。'));
    await CE.spellEff(ok ? b.ok : b.fail, idx, target, null);
    finish(iv, sp);
  };

})();

// ============================================================
//  第 4 階段：劇情訊息提到物品時，顯示誰持有
// ============================================================
(function () {
  const origMsg = UI.message;
  UI.message = function (o) {
    const p = origMsg.call(UI, o);
    try {
      const text = o.text || '';
      if (G.items && OFF.layer && text) {
        const found = G.items.filter(it => { const n = T(it.name); return n && n.length >= 2 && text.includes(n); });
        if (found.length) {
          const pop = OFF.layer.querySelector('#popup'), bg = pop && pop.querySelector('.bg');
          const el = document.createElement('div'); el.className = 'holder';
          el.innerHTML = found.map(it => `<span class="${it.type === 2 ? 'u' : ''}"><img src="img/items/${it.img}.png">${esc(T(it.name))}：<b>${it.ground ? '在地上（用交換行動撿起）' : it.owner == null ? '在物品堆（沒有人持有）' : esc(G.inv[it.owner].name) + ' 持有'}</b></span>`).join('');
          if (bg) { el.style.top = (parseFloat(bg.style.top) - 46 * OFF.u) + 'px'; pop.appendChild(el); }
        }
      }
    } catch (e) { console.error(e); }
    return p;
  };
})();
