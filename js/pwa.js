// ============================================================
//  iPad 網頁版 APP：第一次打開時把整個遊戲下載到平板（之後不用網路也能玩）
//  ・只在網址是 http(s) 時啟用；電腦用「開始遊戲」直接開檔案時完全不動作
//  ・pwa_files.json：所有檔案的清單（路徑、大小、指紋），發布時產生
//  ・有新版本：只下載改過的檔案，下載完自動重新整理
//  ・下載到一半中斷：下次打開從中斷的地方接著下載
// ============================================================
(function () {
  if (!/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator) || !window.caches) return;
  const CACHE = 'mom-files', META = 'mom-meta', PAR = 6;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('離線功能啟動失敗', e));
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }

  let box = null;
  const ui = (html) => {
    if (!box) {
      box = document.createElement('div'); box.id = 'pwaBox'; box.dataset.nomirror = '1';
      box.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#120e0bf2;color:#f1e6cc;display:flex;align-items:center;justify-content:center;text-align:center;font-size:20px;line-height:1.7;padding:24px';
      document.body.appendChild(box);
    }
    box.innerHTML = html;
  };
  const toast = (s) => { try { UI.toast(s); } catch (e) { } };
  const mb = n => (n / 1048576).toFixed(0);

  async function sync() {
    let list;
    try { const r = await fetch('pwa_files.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; list = await r.json(); } catch (e) { return; }   // 沒網路：照用平板上的
    const meta = await caches.open(META), cache = await caches.open(CACHE);
    let have = {}; try { const m = await meta.match('have.json'); if (m) have = await m.json(); } catch (e) { }
    const want = {}; for (const [p, size, h] of list.files) want[p] = [size, h];
    const todo = list.files.filter(([p, size, h]) => !have[p] || have[p] !== h);
    const gone = Object.keys(have).filter(p => !want[p]);
    for (const p of gone) { await cache.delete(p); delete have[p]; }
    if (!todo.length) { await meta.put('have.json', new Response(JSON.stringify(have))); return; }
    const fresh = Object.keys(have).length === 0, first = fresh || todo.length > 40;
    const total = todo.reduce((a, f) => a + f[1], 0); let done = 0, cnt = 0, fails = 0;
    const show = () => {
      if (first) ui(`<div><div style="font-size:26px;color:#e6c35c;margin-bottom:10px">${fresh ? '第一次下載遊戲' : '更新遊戲檔案'}</div>
        <div>${mb(done)} / ${mb(total)} MB（${Math.floor(done / Math.max(1, total) * 100)}%）</div>
        <div style="width:min(520px,80vw);height:14px;border:1px solid #c9a35a;border-radius:8px;margin:12px auto;overflow:hidden"><div style="height:100%;width:${done / Math.max(1, total) * 100}%;background:#c9a35a"></div></div>
        <div style="font-size:15px;color:#a89a7c">下載時請保持畫面開著、不要鎖定平板。<br>下載完之後，沒有網路也能玩。中斷了沒關係，下次打開會接著下載。</div></div>`);
    };
    show();
    let save = 0;
    const one = async ([p, size, h]) => {
      for (let k = 0; k < 3; k++) {
        try {
          const r = await fetch(encodeURI(p) + '?v=' + h, { cache: 'no-store' });
          if (!r.ok) throw new Error(r.status);
          await cache.put(p, new Response(await r.blob(), { headers: { 'Content-Type': r.headers.get('Content-Type') || '' } }));
          have[p] = h; done += size; cnt++;
          if (++save % 40 === 0) await meta.put('have.json', new Response(JSON.stringify(have)));
          if (first && cnt % 5 === 0) show();
          return;
        } catch (e) { await new Promise(r => setTimeout(r, 800)); }
      }
      fails++;
    };
    const q = todo.slice(); await Promise.all(Array.from({ length: PAR }, async () => { while (q.length) await one(q.shift()); }));
    await meta.put('have.json', new Response(JSON.stringify(have)));
    if (fails) { if (first) ui(`<div>有 ${fails} 個檔案沒下載成功（可能是網路不穩）。<br><button class="btn primary" onclick="location.reload()">再試一次</button></div>`); else toast(`更新時有 ${fails} 個檔案沒下載成功，下次打開會再試`); return; }
    if (first) { ui('<div style="font-size:24px">下載完成！正在打開遊戲…</div>'); setTimeout(() => location.reload(), 600); }
    else {
      // 小更新：在開始畫面就直接重新整理；遊戲進行中先提示
      const inGame = typeof G !== 'undefined' && G && G.variant;
      if (!inGame) location.reload(); else toast(`已下載新版本（${list.v || ''}），下次打開遊戲時生效`);
    }
  }
  if (document.readyState === 'complete') sync(); else window.addEventListener('load', () => setTimeout(sync, 300));
})();
