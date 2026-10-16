// ============================================================
//  平板（iPad）觸控支援（測試組 2026-10-16）
//  ・只在觸控裝置啟用（電腦用滑鼠時完全不影響）
//  ・一般點一下：不觸發「滑鼠移上去的說明」，避免 iPad 要點兩下才有反應
//  ・長按（約 0.5 秒）：顯示說明（調查員、怪物、標記、按鈕提示…）；再點一下任何地方就關掉
//  ・長按地圖上的標記物（屏障、火…）：問要不要移除（電腦是按右鍵）
//  ・兩指捏合：放大縮小地圖（電腦是滾輪）
//  ・不讓頁面被誤放大、被拖著捲動；第一次觸碰時讓音樂可以播放
// ============================================================
(function () {
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 1;
  if (!isTouch) return;
  document.documentElement.classList.add('touchUI');

  // ---------- 樣式：關掉長按選字、放大鏡、雙擊放大 ----------
  const st = document.createElement('style');
  st.textContent = `
    html.touchUI, html.touchUI body { touch-action: manipulation; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }
    html.touchUI body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
    html.touchUI input, html.touchUI textarea, html.touchUI select { -webkit-user-select: text; user-select: text; }
    html.touchUI #board, html.touchUI #world { touch-action: none; }
    html.touchUI img { -webkit-user-drag: none; -webkit-touch-callout: none; }
    #touchLP { position: fixed; z-index: 99999; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%; border: 3px solid #e6c35c; pointer-events: none; opacity: 0; transform: scale(.4); transition: transform .45s ease-out, opacity .45s; }
    #touchLP.on { opacity: .9; transform: scale(1); }`;
  document.head.appendChild(st);
  // iPad Safari 的兩指縮放整個網頁：關掉（地圖自己處理縮放）
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });

  // ---------- 觸控產生的「假滑鼠移入」：擋掉，只有長按時放行 ----------
  let lastTouch = 0, synthetic = false;
  window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') lastTouch = Date.now(); }, true);
  for (const ev of ['mouseover', 'mouseenter', 'mousemove', 'mouseout', 'mouseleave']) {
    window.addEventListener(ev, e => { if (!synthetic && Date.now() - lastTouch < 1500) e.stopImmediatePropagation(); }, true);
  }

  // ---------- 長按 ----------
  const ring = document.createElement('div'); ring.id = 'touchLP'; document.body.appendChild(ring);
  let lp = null, tipOpen = false, entered = [], swallowClick = false;
  const fire = (type, el, x, y, bubbles) => el.dispatchEvent(new MouseEvent(type, { bubbles, cancelable: true, clientX: x, clientY: y, view: window }));
  const hideTips = () => {
    if (!tipOpen) return; tipOpen = false;
    synthetic = true;
    try { for (const el of entered) fire('mouseleave', el, 0, 0, false); fire('mouseover', document.body, -10, -10, true); fire('mousedown', document.body, -10, -10, true); } catch (e) { }
    synthetic = false; entered = [];
    for (const id of ['qtip', 'invTip', 'netTip']) { const t = document.getElementById(id); if (t) t.style.display = 'none'; }
    document.querySelectorAll('#hoverTip.on, .tipBox.on').forEach(t => t.classList.remove('on'));
  };
  const showTip = (target, x, y) => {
    synthetic = true;
    try {
      fire('mouseover', target, x, y, true);
      entered = []; for (let el = target; el && el !== document.body; el = el.parentElement) { entered.push(el); fire('mouseenter', el, x, y, false); }
      fire('mousemove', target, x, y, true);
    } catch (e) { }
    synthetic = false; tipOpen = true;
  };
  const longPress = async (target, x, y) => {
    swallowClick = true;
    // 地圖上的標記物：電腦按右鍵移除 → 平板長按問要不要移除
    const tok = target.closest && target.closest('.token[data-token]');
    if (tok && typeof tok.oncontextmenu === 'function' && typeof UI !== 'undefined' && UI.confirm) {
      const name = tok.dataset.tip || tok.title || '這個標記';
      if (await UI.confirm(`移除「${String(name).split('：')[0]}」？`)) tok.oncontextmenu({ preventDefault() { }, stopPropagation() { } });
      return;
    }
    showTip(target, x, y);
  };
  window.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (tipOpen) { hideTips(); }
    if (lp) { clearTimeout(lp.t); lp = null; }
    if (pinch.size >= 1) return;   // 第二根手指：是捏合，不是長按
    const target = e.target, x = e.clientX, y = e.clientY;
    if (/INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
    ring.style.left = x + 'px'; ring.style.top = y + 'px'; ring.classList.remove('on');
    lp = { x, y, t: setTimeout(() => { ring.classList.remove('on'); lp = null; longPress(target, x, y); }, 520), r: setTimeout(() => ring.classList.add('on'), 150) };
  }, true);
  const cancelLP = () => { if (lp) { clearTimeout(lp.t); clearTimeout(lp.r); lp = null; } ring.classList.remove('on'); };
  window.addEventListener('pointermove', e => { if (lp && e.pointerType === 'touch' && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) cancelLP(); }, true);
  window.addEventListener('pointerup', e => { if (e.pointerType === 'touch') cancelLP(); }, true);
  window.addEventListener('pointercancel', cancelLP, true);
  // 長按之後放開產生的 click：不要觸發按鈕
  window.addEventListener('click', e => { if (swallowClick) { swallowClick = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  window.addEventListener('contextmenu', e => { if (Date.now() - lastTouch < 1500) e.preventDefault(); }, true);

  // ---------- 兩指捏合縮放地圖 ----------
  const pinch = new Map(); let pz = null;
  const board = () => document.getElementById('board');
  window.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    const B = board(); if (!B || !B.contains(e.target)) return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.size === 2 && typeof UI !== 'undefined' && UI.cam) {
      cancelLP();
      const [a, b] = [...pinch.values()];
      pz = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: UI.cam.z, cx: UI.cam.x, cy: UI.cam.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  }, true);
  window.addEventListener('pointermove', e => {
    if (!pinch.has(e.pointerId)) return;
    pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!pz || pinch.size < 2) return;
    e.stopImmediatePropagation();   // 捏合時不要讓單指拖曳地圖的程式也動
    const [a, b] = [...pinch.values()], r = board().getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const nz = Math.min(2.5, Math.max(0.15, pz.z * d / pz.d));
    const ox = pz.mx - r.left, oy = pz.my - r.top;
    UI.cam.z = nz;
    UI.cam.x = (mx - r.left) - (ox - pz.cx) * nz / pz.z;
    UI.cam.y = (my - r.top) - (oy - pz.cy) * nz / pz.z;
    UI.applyCam();
  }, true);
  const upP = e => {
    if (!pinch.has(e.pointerId)) return;
    pinch.delete(e.pointerId);
    if (pz) { if (pinch.size === 0) pz = null; else pz.blocked = true; }   // 放開的訊號照樣傳下去（地圖拖曳才會結束）
  };
  window.addEventListener('pointerup', upP, true);
  window.addEventListener('pointercancel', upP, true);
  // 捏合結束後剩下一根手指：不要接著拖地圖（會跳）
  window.addEventListener('pointermove', e => { if (pz && pz.blocked && pinch.size === 1) e.stopImmediatePropagation(); }, true);

  // ---------- 第一次觸碰：讓背景音樂可以開始（iPad 規定要使用者先碰一下）----------
  const unlock = () => { try { if (window.AU && AU.apply) AU.apply(); } catch (e) { } window.removeEventListener('pointerdown', unlock, true); };
  window.addEventListener('pointerdown', unlock, true);
})();
