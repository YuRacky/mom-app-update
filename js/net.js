// ============================================================
//  連線遊戲（最多 4 人：主機＋3 位朋友）
//  主機：跑遊戲，把畫面同步給朋友，並接收朋友的點擊、拖曳、輸入
//  朋友：顯示主機的畫面（比例縮放），操作傳回主機執行
//  建立連線：主機按「開房間」取得 4 位數邀請碼 → 朋友輸入自己的名字和邀請碼 → 主機按「允許」
//  配對用免費的 PeerJS 公開伺服器（只交換連線資訊），連上後兩台電腦直接傳資料
// ============================================================
const NET = {
  role: null, connected: false, peer: null, code: null,
  peers: new Map(),          // 主機：id → { conn, name }
  hostConn: null,            // 朋友：連到主機的那條線
  MAX_GUESTS: 3,
  PREFIX: 'mad20-coe-room-',
  ICE: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }],
  myName() { try { return localStorage.getItem('mom2_name') || ''; } catch (e) { return ''; } },
  guestNames() { return [...NET.peers.values()].map(p => p.name); },
  // 連線時朋友滑鼠停上去會跳說明的東西（主機用 tipFor 算內容）
  TIP_SEL: '.pick[data-id], [data-gitem], [data-item], [data-cond], .dhUp, .dhBack, [data-mon], .mcard[data-m], .node[data-node], .fig[data-inv], .token[data-token], [data-tip], [title]',
  tipFor(el) {
    if (!el || !el.closest) return null;
    let e;
    if ((e = el.closest('.pick[data-id]')) && UI._invInfo) return { h: UI._invInfo(e.dataset.id), c: 'invInfo' };
    if (typeof CE !== 'undefined' && CE.tipFor) { const h = CE.tipFor(el); if (h) return { h }; }
    if ((e = el.closest('[data-tip], [title]'))) { const s = e.dataset.tip || e.title; if (s) return { h: esc(s), c: 'txt' }; }
    return null;
  },
  // 朋友點的東西的文字：主機用來確認朋友看到的跟現在主機上那個位置是同一個東西（畫面還沒同步時不要按到別的按鈕）
  txOf(el) {
    try {
      if (!el) return '';
      if (el.nodeType !== 1) return String(el.textContent || '').replace(/\s+/g, '').slice(0, 40);
      // 不算輸入框、下拉選單裡的字（兩邊的值可能不同步，不代表是別的東西）
      let s = ''; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && n.parentNode.closest && n.parentNode.closest('textarea,select,option,input') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      while (w.nextNode() && s.length < 200) s += w.currentNode.textContent;
      return s.replace(/\s+/g, '').slice(0, 40);
    } catch (e) { return ''; }
  },
  nameOf(id) { const p = NET.peers.get(id); return p ? p.name : '朋友'; },

  // ---------- 傳送（大訊息分段） ----------
  _out(conn, obj) {
    if (!conn || !conn.open) return;
    const s = JSON.stringify(obj), N = 60000;
    try {
      if (s.length <= N) { conn.send(s); return; }
      const id = Math.random().toString(36).slice(2), n = Math.ceil(s.length / N);
      for (let i = 0; i < n; i++) conn.send(JSON.stringify({ _part: id, i, n, d: s.slice(i * N, (i + 1) * N) }));
    } catch (e) { console.error(e); }
  },
  send(obj) {
    if (NET.role === 'host') for (const p of NET.peers.values()) NET._out(p.conn, obj);
    else if (NET.role === 'guest') NET._out(NET.hostConn, obj);
  },
  sendTo(id, obj) { const p = NET.peers.get(id); if (p) NET._out(p.conn, obj); },
  _parts: {},
  recv(raw, from) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m._part) {
      const k = (from || '') + m._part, p = NET._parts[k] = NET._parts[k] || [];
      p[m.i] = m.d;
      if (p.filter(x => x != null).length < m.n) return;
      delete NET._parts[k]; m = JSON.parse(p.join(''));
    }
    if (NET.role === 'host') NET.Host.onMsg(m, from); else NET.Guest.onMsg(m);
  },
  status(s) { const el = document.getElementById('netStatus'); if (el) el.textContent = s; NET.badge(); },
  newPeer(id) {
    if (typeof Peer === 'undefined') throw new Error('連線元件沒有載入（js/peerjs.min.js）');
    const o = Object.assign({ config: { iceServers: NET.ICE }, debug: 0 }, window.NET_PEER_OPTS || {});
    return id ? new Peer(id, o) : new Peer(o);
  },

  // ---------- 小視窗（不會同步給朋友） ----------
  panel(html) {
    let P = document.getElementById('netPanel');
    if (!P) { P = document.createElement('div'); P.id = 'netPanel'; P.dataset.nomirror = '1'; document.body.appendChild(P); }
    P.innerHTML = `<div class="npBox">${html}</div>`; P.classList.add('on');
    return P;
  },
  closePanel() { const P = document.getElementById('netPanel'); if (P) P.classList.remove('on'); },
  badge() {
    let b = document.getElementById('netBadge');
    if (!NET.role) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'netBadge'; b.dataset.nomirror = '1'; document.body.appendChild(b); }
    if (NET.role === 'host') {
      const n = NET.guestNames();
      b.textContent = n.length ? `🔗 房間 ${NET.code}：${n.join('、')}` : `🔗 房間 ${NET.code}：等待朋友加入`;
      b.classList.toggle('on', n.length > 0);
    } else { b.textContent = NET.connected ? '🔗 已連上主機' : '🔗 未連線'; b.classList.toggle('on', NET.connected); }
  },

  // ============== 主機 ==============
  hostPanel() {
    const n = NET.guestNames();
    NET.panel(`<h3>開房間</h3>
      <div class="np" style="text-align:center">把這組邀請碼用 LINE 傳給朋友：</div>
      <div class="bigCode">${NET.code || '…'}</div>
      <div class="np" style="text-align:center">朋友打開他的遊戲 → 選單 →「加入朋友的遊戲」→ 輸入名字和這 4 個數字。<br>有人要加入時，這裡會問你是否允許。</div>
      <div class="np" style="text-align:center">目前已加入（最多 ${NET.MAX_GUESTS} 位）：${n.length ? n.map(esc).join('、') : '還沒有'}</div>
      <div class="np" id="netStatus" style="text-align:center;color:#9cc4ff"></div>
      <div class="btns"><button class="btn" id="npClose">關閉這個視窗（房間繼續開著）</button></div>`);
    document.getElementById('npClose').onclick = () => NET.closePanel();
  },
  hostStart() {
    if (NET.role === 'guest') return;
    if (NET.peer && NET.role === 'host') { NET.hostPanel(); return; }
    NET.role = 'host';
    NET.code = String(1000 + Math.floor(Math.random() * 9000));
    NET.hostPanel(); NET.status('正在開房間…');
    let peer;
    try { peer = NET.peer = NET.newPeer(NET.PREFIX + NET.code); } catch (e) { NET.status(e.message); return; }
    peer.on('open', () => { NET.status('房間已開好，等待朋友加入'); NET.badge(); });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { try { peer.destroy(); } catch (x) { } NET.peer = null; NET.role = null; NET.hostStart(); return; }
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') NET.status('連不上配對伺服器，請檢查網路後再試一次');
      else NET.status('連線發生問題：' + e.type);
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    peer.on('connection', conn => NET.Host.incoming(conn));
  },
  Host: {
    targets: {}, last: '', timer: null, started: false, asking: Promise.resolve(),
    incoming(conn) {
      let joined = false;
      conn.on('data', d => {
        if (!joined) {
          let m; try { m = JSON.parse(d); } catch (e) { return; }
          if (m.t !== 'join') return;
          joined = true;
          const name = String(m.name || '朋友').slice(0, 20);
          if (NET.peers.size >= NET.MAX_GUESTS) { NET._out(conn, { t: 'deny', why: '房間已滿（最多 4 人）' }); setTimeout(() => conn.close(), 500); return; }
          NET.Host.asking = NET.Host.asking.then(() => NET.Host.ask(name)).then(ok => {
            if (!ok) { NET._out(conn, { t: 'deny', why: '主機沒有允許' }); setTimeout(() => conn.close(), 500); return; }
            NET.peers.set(conn.peer, { conn, name, seen: Date.now(), coll: new Set(Array.isArray(m.coll) ? m.coll.map(String).slice(0, 50) : []) });
            NET._out(conn, { t: 'welcome' });
            UI.toast(`${name} 加入了遊戲`);
            NET.connected = true; NET.badge();
            if (document.getElementById('netPanel') && document.getElementById('netPanel').classList.contains('on')) NET.hostPanel();
            if (!NET.Host.started) NET.Host.start(); else NET.Host.push(true);
            if ((document.getElementById('btnStart') || document.getElementById('ngNext')) && UI._redrawNew) UI._redrawNew();
          });
          return;
        }
        const pp = NET.peers.get(conn.peer); if (pp) pp.seen = Date.now();
        NET.recv(d, conn.peer);
      });
      conn.on('close', () => NET.Host.drop(conn.peer));
      conn.on('error', () => NET.Host.drop(conn.peer));
    },
    drop(id) {
      {
        const p = NET.peers.get(id); if (!p) return;
        NET.peers.delete(id); UI.toast(`${p.name} 離開了遊戲`);
        try { p.conn.close(); } catch (e) { }
        NET.connected = NET.peers.size > 0; NET.badge();
        if ((document.getElementById('btnStart') || document.getElementById('ngNext')) && UI._redrawNew) UI._redrawNew();
      }
    },
    // 有人要加入：問主機（這個小視窗不會同步給朋友）
    ask(name) {
      return new Promise(res => {
        const d = document.createElement('div'); d.className = 'joinAsk joinReq'; d.dataset.nomirror = '1';
        d.innerHTML = `<div><b>${esc(name)}</b> 想加入你的遊戲，允許嗎？</div><div class="btns"><button class="btn" data-v="0">拒絕</button><button class="btn primary" data-v="1">允許</button></div>`;
        document.body.appendChild(d);
        try { if (window.AU) AU.sfx('Select_01'); } catch (e) { }
        d.querySelectorAll('button').forEach(b => b.onclick = () => { d.remove(); res(b.dataset.v === '1'); });
      });
    },
    start() {
      NET.Host.started = true;
      const obs = new MutationObserver(() => NET.Host.schedule());
      obs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      window.addEventListener('resize', () => NET.Host.schedule());
      NET.Host.push(true);
      setInterval(() => NET.Host.push(), 1500);
      // 心跳：每 3 秒打一次招呼，超過 12 秒沒消息就當作離開
      setInterval(() => {
        NET.send({ t: 'ping' });
        for (const [id, p] of NET.peers) if (Date.now() - p.seen > 12000) NET.Host.drop(id);
      }, 3000);
    },
    schedule() { if (NET.Host.timer) return; NET.Host.timer = setTimeout(() => { NET.Host.timer = null; NET.Host.push(); }, 70); },
    kids(el) { return [...el.childNodes].filter(n => !(n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.dataset && n.dataset.nomirror)) && !(n.nodeType === 3 && el === document.body && !n.textContent.trim()) && n.nodeType !== 8); },
    serialize() {
      const c = document.body.cloneNode(true);
      const src = document.body.querySelectorAll('select,textarea,input'), dst = c.querySelectorAll('select,textarea,input');
      src.forEach((s, i) => {
        const d = dst[i]; if (!d) return;
        if (s.tagName === 'SELECT') [...d.options].forEach((o, k) => { if (k === s.selectedIndex) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
        else if (s.tagName === 'TEXTAREA') d.textContent = s.value;
        else { d.setAttribute('value', s.value); if (s.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); }
      });
      c.querySelectorAll('script,[data-nomirror]').forEach(n => n.remove());
      return c.innerHTML;
    },
    css() { return [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')); },
    push(force) {
      if (!NET.peers.size) return;
      const html = NET.Host.serialize();
      if (!force && html === NET.Host.last) return;
      NET.Host.last = html;
      const st = getComputedStyle(document.documentElement).getPropertyValue('--u');
      NET.send({ t: 'dom', html, w: innerWidth, h: innerHeight, u: st, cls: document.body.className, css: NET.Host.css() });
    },
    node(path) { let el = document.body; for (const i of path) { const k = NET.Host.kids(el); el = k[i]; if (!el) return null; } return el; },
    fire(type, el, m, extra) {
      const o = Object.assign({ bubbles: true, cancelable: true, clientX: m.x, clientY: m.y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 77, pointerType: 'mouse', isPrimary: true, shiftKey: !!m.shift }, extra || {});
      const E = type.startsWith('pointer') ? PointerEvent : type === 'wheel' ? WheelEvent : MouseEvent;
      el.dispatchEvent(new E(type, o));
    },
    onMsg(m, from) {
      const H = NET.Host;
      if (m.t === 'hello') {
        // 版本不同：提醒雙方（舊版可能少了劇本或規則，連線會出錯）
        const mine = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?';
        if ((m.ver || '舊版') !== mine) setTimeout(() => UI.toast(`注意：朋友的 APP 版本是 ${m.ver || '1.2.0 以前'}，你的是 ${mine}。版本不同可能會出錯，請兩邊都用同一版。`), 500);
        H.push(true); return;
      }
      if (m.t === 'ping') return;
      if (m.t === 'bye') { H.drop(from); return; }
      if (m.t === 'file') { NET.Files.request(m.p, from); return; }
      const el = m.path ? H.node(m.path) : null;
      // 朋友畫面比主機慢一步（剛換了視窗）：同一個位置現在是別的東西 → 不要按，送最新畫面給朋友（1.2.62 測試組）
      if ((m.t === 'click' || m.t === 'pdown') && m.tx != null && (!el || NET.txOf(el) !== m.tx)) { H.stale = (H.stale || 0) + 1; H.push(true); return; }
      if (m.t === 'hover') { let r = null; try { r = NET.tipFor(el); } catch (e) { } NET.sendTo(from, Object.assign({ t: 'tip', k: m.k }, r || { h: '' })); return; }
      if (m.t === 'pdown' && el) { H.targets[from] = el; H.fire('pointerdown', el, m); }
      else if (m.t === 'pmove' && H.targets[from]) H.fire('pointermove', H.targets[from], m);
      else if (m.t === 'pup' && H.targets[from]) { H.fire('pointerup', H.targets[from], m); H.targets[from] = null; }
      // 謎題畫面裡的 SVG（水管、旋轉轉盤）也要能點（測試組：朋友不能轉轉盤）；地圖上的 SVG 照舊不轉送 click
      else if (m.t === 'click' && el) { if ((typeof el.click === 'function' && !(el instanceof SVGElement)) || (el instanceof SVGElement && el.closest && el.closest('.pzView'))) H.fire('click', el, m); }
      else if (m.t === 'wheel' && el) H.fire('wheel', el, m, { deltaY: m.dy });
      else if (m.t === 'value' && el) {
        if (el.tagName === 'SELECT') el.selectedIndex = m.idx; else el.value = m.v;
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      else if (m.t === 'toggle' && el) { el.open = m.open; }
      H.schedule();
    }
  },

  // ============== 朋友 ==============
  guestStart() {
    if (NET.role === 'host') return;
    NET.panel(`<h3>加入朋友的遊戲</h3>
      <div class="np">你的名字（主機會看到）：</div>
      <input id="npName" class="npIn" maxlength="20" value="${esc(NET.myName())}" placeholder="例如：小明">
      <div class="np" style="margin-top:10px">主機給你的 4 位數邀請碼：</div>
      <input id="npCode" class="npIn code" maxlength="4" inputmode="numeric" placeholder="1234">
      <div class="np" id="netStatus" style="color:#9cc4ff;min-height:1.6em"></div>
      <div class="btns"><button class="btn" id="npCancel">取消</button><button class="btn primary" id="npJoin">加入</button></div>`);
    const nameIn = document.getElementById('npName'), codeIn = document.getElementById('npCode');
    (nameIn.value ? codeIn : nameIn).focus();
    codeIn.oninput = () => { codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 4); };
    document.getElementById('npCancel').onclick = () => { NET.closePanel(); NET.leaveGuest(); };
    const go = () => {
      const name = nameIn.value.trim(), code = codeIn.value.trim();
      if (!name) { NET.status('請先輸入你的名字'); nameIn.focus(); return; }
      if (!/^\d{4}$/.test(code)) { NET.status('邀請碼是 4 個數字'); codeIn.focus(); return; }
      try { localStorage.setItem('mom2_name', name); } catch (e) { }
      NET.joinRoom(name, code);
    };
    document.getElementById('npJoin').onclick = go;
    [nameIn, codeIn].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
  },
  leaveGuest() { try { if (NET.peer) NET.peer.destroy(); } catch (e) { } NET.peer = null; NET.hostConn = null; if (!NET.connected) NET.role = null; },
  joinRoom(name, code) {
    NET.leaveGuest();
    NET.role = 'guest';
    NET.status('連線中…');
    let peer;
    try { peer = NET.peer = NET.newPeer(); } catch (e) { NET.status(e.message); return; }
    const fail = s => { NET.status(s); };
    const timer = setTimeout(() => { if (!NET.connected && !/無法加入|等待主機允許/.test((document.getElementById('netStatus') || {}).textContent || '')) fail('找不到這個房間。請確認 4 個數字正確，而且主機的遊戲有開著房間。'); }, 10000);
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') fail('找不到這個邀請碼的房間，請確認 4 個數字是否正確');
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') fail('連不上配對伺服器，請檢查網路');
      else fail('連線發生問題：' + e.type);
    });
    peer.on('open', () => {
      NET.status(`正在尋找房間 ${code}…`);
      const conn = NET.hostConn = peer.connect(NET.PREFIX + code, { reliable: true, serialization: 'raw' });
      conn.on('open', () => { let coll = []; try { coll = JSON.parse(localStorage.getItem('mom2_collection')) || ['MAD20']; } catch (e) { coll = ['MAD20']; } NET._out(conn, { t: 'join', name, coll }); NET.status('等待主機允許…'); });
      conn.on('data', d => {
        let m; try { m = JSON.parse(d); } catch (e) { return; }
        if (!NET.connected) {
          if (m.t === 'deny') { clearTimeout(timer); fail('無法加入：' + (m.why || '')); setTimeout(() => conn.close(), 200); return; }
          if (m.t === 'welcome') {
            clearTimeout(timer); NET.connected = true; NET.closePanel(); NET.badge(); NET.send({ t: 'hello', name, ver: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?' });
            NET._seen = Date.now();
            NET._hb = setInterval(() => {
              NET.send({ t: 'ping' });
              if (NET.connected && Date.now() - NET._seen > 12000) { try { conn.close(); } catch (e) { } NET.Guest.lost(); }
            }, 3000);
            window.addEventListener('beforeunload', () => NET.send({ t: 'bye' }));
            return;
          }
        }
        NET._seen = Date.now();
        NET.recv(d);
      });
      conn.on('close', () => NET.Guest.lost());
    });
  },
  Guest: {
    root: null, hw: 0, hh: 0, scale: 1, drag: null,
    lost() {
      if (!NET.connected) return;
      NET.connected = false; clearInterval(NET._hb); NET.badge();
      NET.panel(`<h3>連線中斷</h3><div class="np" style="text-align:center">和主機的連線斷了。可能是主機關掉了遊戲或網路不穩。</div><div class="btns"><button class="btn primary" id="npRe">重新加入</button></div>`);
      document.getElementById('npRe').onclick = () => location.reload();
    },
    setup() {
      document.querySelectorAll('body > *:not(#netPanel):not(#netBadge)').forEach(n => n.style.display = 'none');
      const wrap = document.createElement('div'); wrap.id = 'mirrorWrap';
      const root = document.createElement('div'); root.id = 'mirror';
      wrap.appendChild(root); document.body.appendChild(wrap);
      NET.Guest.root = root; NET.Guest.bind();
      window.addEventListener('resize', () => NET.Guest.fit());
      NET.badge();
    },
    fit() {
      const G2 = NET.Guest, r = G2.root; if (!G2.hw) return;
      G2.scale = Math.min(innerWidth / G2.hw, innerHeight / G2.hh);
      r.style.width = G2.hw + 'px'; r.style.height = G2.hh + 'px';
      r.style.transform = `scale(${G2.scale})`;
      r.style.left = (innerWidth - G2.hw * G2.scale) / 2 + 'px'; r.style.top = (innerHeight - G2.hh * G2.scale) / 2 + 'px';
    },
    onMsg(m) {
      const G2 = NET.Guest;
      if (m.t === 'dom') {
        if (!G2.root) G2.setup();
        G2.hw = m.w; G2.hh = m.h; G2.root.style.setProperty('--u', m.u); G2.fit();
        if (m.css) NET.Files.checkCss(m.css);
        const tmp = document.createElement('div'); tmp.innerHTML = m.html;
        NET.patch(G2.root, tmp);
      }
      else if (m.t === 'file') NET.Files.got(m);
      else if (m.t === 'tip') NET.Guest.showTip(m);
      else if (m.t === 'ping') { }
    },
    tip() {
      let t = document.getElementById('netTip'); if (t) return t;
      const st = document.createElement('style');
      st.textContent = `#netTip{position:fixed;z-index:100000;max-width:340px;background:#15110df2;border:1px solid #c9a35a;border-radius:6px;padding:8px 10px;color:#f1e6cc;font-size:13px;line-height:1.5;pointer-events:none;display:none;box-shadow:0 4px 14px #000c;white-space:normal}
#netTip b{color:#ffd36b;font-size:14px}#netTip .ht2{color:#a89a7c;font-size:12px;margin-bottom:4px}#netTip .ico{height:1.1em;vertical-align:-.2em}
#netTip.invInfo{width:340px;max-width:none;margin:0;background:#1a150e}#netTip.txt{white-space:pre-line;max-width:280px}`;
      document.head.appendChild(st);
      t = document.createElement('div'); t.id = 'netTip'; document.body.appendChild(t); return t;
    },
    showTip(m) {
      const G2 = NET.Guest; if (m.k !== G2.tipK || !m.h) return;
      const t = G2.tip(); t.className = m.c || ''; t.innerHTML = m.h; t.style.display = m.c === 'invInfo' ? 'flex' : 'block'; G2.placeTip();
    },
    hideTip() { const t = document.getElementById('netTip'); if (t) t.style.display = 'none'; },
    placeTip() {
      const t = document.getElementById('netTip'), G2 = NET.Guest; if (!t || t.style.display === 'none' || G2.mx == null) return;
      const w = t.offsetWidth, h = t.offsetHeight; let x = G2.mx + 16, y = G2.my + 16;
      if (x + w > innerWidth - 8) x = G2.mx - w - 12;
      if (y + h > innerHeight - 8) y = Math.max(8, G2.my - h - 12);
      t.style.left = Math.max(8, x) + 'px'; t.style.top = y + 'px';
    },
    path(el) {
      const p = [];
      while (el && el !== NET.Guest.root) { const par = el.parentNode; if (!par) return null; p.unshift([...par.childNodes].filter(n => n.nodeType !== 8 && !(n.nodeType === 3 && par === NET.Guest.root && !n.textContent.trim())).indexOf(el)); el = par; }
      return el ? p : null;
    },
    pt(e) { const G2 = NET.Guest, rr = G2.root.getBoundingClientRect(); return { x: (e.clientX - rr.left) / G2.scale, y: (e.clientY - rr.top) / G2.scale }; },
    bind() {
      const G2 = NET.Guest, R = G2.root; let down = false;
      const tgt = e => { let el = e.target; if (el.nodeType === 3) el = el.parentNode; return el; };
      R.addEventListener('pointerdown', e => {
        if (e.button !== 0 || /SELECT|OPTION|TEXTAREA|INPUT|SUMMARY/.test(tgt(e).tagName)) return;
        down = true;
        // 拖曳人偶、怪物、標記：先在自己畫面上跟著滑鼠走，不用等主機
        const fig = tgt(e).closest('#world .fig, #world .token, #world .tok, #world .gitem');
        if (fig) { const r = fig.getBoundingClientRect(); G2.drag = { el: fig, sx: e.clientX, sy: e.clientY, k: (r.width / (fig.offsetWidth || 1)) || 1, moved: false }; }
        NET.send(Object.assign({ t: 'pdown', path: G2.path(tgt(e)), shift: e.shiftKey, tx: NET.txOf(tgt(e)) }, G2.pt(e)));
      });
      window.addEventListener('pointermove', e => {
        if (!down) return;
        const d = G2.drag;
        if (d) { const dx = (e.clientX - d.sx) / d.k, dy = (e.clientY - d.sy) / d.k; if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true; d.el.style.translate = `${dx}px ${dy}px`; }
        NET.send(Object.assign({ t: 'pmove' }, G2.pt(e)));
      });
      window.addEventListener('pointerup', e => {
        if (!down) return; down = false;
        const d = G2.drag; if (d) { d.up = Date.now(); setTimeout(() => { if (G2.drag === d) { d.el.style.translate = ''; G2.drag = null; } }, 600); }
        NET.send(Object.assign({ t: 'pup' }, G2.pt(e)));
      });
      R.addEventListener('click', e => { const el = tgt(e); if (/SELECT|OPTION|TEXTAREA|INPUT/.test(el.tagName)) return; if (el.tagName === 'SUMMARY') { setTimeout(() => NET.send({ t: 'toggle', path: G2.path(el.parentNode), open: el.parentNode.open }), 0); return; } e.preventDefault(); NET.send(Object.assign({ t: 'click', path: G2.path(el), shift: e.shiftKey, tx: NET.txOf(el) }, G2.pt(e))); }, true);
      R.addEventListener('wheel', e => { e.preventDefault(); NET.send(Object.assign({ t: 'wheel', path: G2.path(tgt(e)), dy: e.deltaY }, G2.pt(e))); }, { passive: false });
      R.addEventListener('change', e => { const el = e.target; NET.send({ t: 'value', path: G2.path(el), v: el.value, idx: el.selectedIndex }); });
      R.addEventListener('contextmenu', e => e.preventDefault());
      // 滑鼠停在東西上：問主機這是什麼，主機回說明（調查員能力、物品、怪物、狀態、標記、按鈕提示…）
      R.addEventListener('mouseover', e => {
        const el = tgt(e), c = el.closest && el.closest(NET.TIP_SEL);
        if (c && c.title) { c.dataset.tip = c.title; c.removeAttribute('title'); }   // 不要跟瀏覽器自己的提示重疊
        if (c === G2.tipEl) return;
        G2.tipEl = c; G2.tipK = (G2.tipK || 0) + 1; G2.hideTip();
        if (!c) return;
        const p = G2.path(c); if (p) NET.send({ t: 'hover', path: p, k: G2.tipK });
      });
      R.addEventListener('mouseleave', () => { G2.tipEl = null; G2.tipK = (G2.tipK || 0) + 1; G2.hideTip(); });
      window.addEventListener('mousemove', e => { G2.mx = e.clientX; G2.my = e.clientY; G2.placeTip(); });
      R.addEventListener('pointerdown', () => { G2.tipEl = null; G2.tipK = (G2.tipK || 0) + 1; G2.hideTip(); }, true);
      // 缺少的圖片：向主機要
      R.addEventListener('error', e => { const el = e.target; if (el && el.tagName === 'IMG') NET.Files.need(el.getAttribute('src')); }, true);
    }
  },

  // ============== 缺少的檔案：朋友向主機要（主機要先選一次遊戲資料夾） ==============
  Files: {
    blobs: {}, asked: new Set(), dir: null, queue: [],
    norm(p) { return (p || '').replace(/^\.?\//, '').split('?')[0]; },
    // 朋友
    need(p) {
      p = NET.Files.norm(p);
      if (!p || /^(blob:|data:|https?:)/.test(p) || NET.Files.blobs[p] || NET.Files.asked.has(p)) return;
      NET.Files.asked.add(p); NET.send({ t: 'file', p });
    },
    checkCss(list) {
      const have = new Set([...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href')));
      list.forEach(h => { if (!have.has(h)) NET.Files.need(h); });
    },
    got(m) {
      const p = NET.Files.norm(m.p);
      if (!m.b64) return;
      const bin = atob(m.b64), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      if (/\.css$/.test(p)) {
        let css = new TextDecoder().decode(buf).replace(/url\((['"]?)\.\.\//g, 'url($1');
        const s = document.createElement('style'); s.dataset.from = p; s.textContent = css; document.head.appendChild(s);
        return;
      }
      const url = URL.createObjectURL(new Blob([buf], { type: m.mime || '' }));
      NET.Files.blobs[p] = url;
      if (NET.Guest.root) NET.Guest.root.querySelectorAll('img').forEach(im => { if (NET.Files.norm(im.getAttribute('src')) === p) im.src = url; });
    },
    map(name, v) { return name === 'src' && v && NET.Files.blobs[NET.Files.norm(v)] || v; },
    // 主機
    request(p, from) {
      p = NET.Files.norm(p);
      if (!p || p.includes('..')) return;
      if (NET.Files.dir) { NET.Files.serve(p, from); return; }
      NET.Files.queue.push([p, from]);
      NET.Files.askFolder();
    },
    askFolder() {
      if (document.getElementById('fileAsk') || !window.showDirectoryPicker) return;
      const d = document.createElement('div'); d.className = 'joinAsk fileAsk'; d.id = 'fileAsk'; d.dataset.nomirror = '1';
      d.innerHTML = `<div>朋友的遊戲缺少一些圖片或檔案（可能是他的版本比較舊）。<br>按「補傳」選一次你的遊戲資料夾（桌面的「瘋狂詭宅APP」），就會自動傳給他。</div><div class="btns"><button class="btn" data-v="0">先不要</button><button class="btn primary" data-v="1">補傳</button></div>`;
      document.body.appendChild(d);
      d.querySelectorAll('button').forEach(b => b.onclick = async () => {
        d.remove();
        if (b.dataset.v !== '1') { NET.Files.queue = []; return; }
        try {
          NET.Files.dir = await window.showDirectoryPicker({ id: 'momapp', mode: 'read' });
          const q = NET.Files.queue.splice(0); for (const [p, f] of q) NET.Files.serve(p, f);
        } catch (e) { UI.toast('沒有選到資料夾'); }
      });
    },
    async serve(p, from) {
      try {
        let h = NET.Files.dir; const parts = p.split('/');
        for (const s of parts.slice(0, -1)) h = await h.getDirectoryHandle(decodeURIComponent(s));
        const file = await (await h.getFileHandle(decodeURIComponent(parts[parts.length - 1]))).getFile();
        const buf = new Uint8Array(await file.arrayBuffer());
        let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        NET.sendTo(from, { t: 'file', p, mime: file.type, b64: btoa(s) });
      } catch (e) { /* 主機也沒有這個檔案 */ }
    }
  },

  // ---------- 簡單的 DOM 差異更新（避免動畫一直重播） ----------
  patch(to, from) {
    const a = [...to.childNodes], b = [...from.childNodes];
    const drag = NET.Guest.drag;
    for (let i = 0; i < b.length; i++) {
      const x = a[i], y = b[i];
      if (!x) { const c = y.cloneNode(true); NET.fixSrc(c); to.appendChild(c); continue; }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { const c = y.cloneNode(true); NET.fixSrc(c); to.replaceChild(c, x); continue; }
      if (x.nodeType === 3) { if (x.textContent !== y.textContent) x.textContent = y.textContent; continue; }
      if (x.nodeType !== 1) continue;
      const dragging = drag && drag.el === x;
      for (const at of [...x.attributes]) if (!y.hasAttribute(at.name) && !(dragging && at.name === 'style')) x.removeAttribute(at.name);
      for (const at of [...y.attributes]) {
        if (dragging && at.name === 'style') continue;
        const v = NET.Files.map(at.name, at.value);
        if (x.getAttribute(at.name) !== v) x.setAttribute(at.name, v);
      }
      // 放開後主機的新位置到了：拿掉暫時的位移
      if (drag && drag.el === x && drag.up) { const st = y.getAttribute('style'); if (st !== x.getAttribute('style')) { x.setAttribute('style', st); x.style.translate = ''; NET.Guest.drag = null; } }
      if (x.tagName === 'SELECT') { NET.patch(x, y); const si = [...y.options].findIndex(o => o.hasAttribute('selected')); if (si >= 0 && document.activeElement !== x) x.selectedIndex = si; continue; }
      if (x.tagName === 'TEXTAREA') { if (document.activeElement !== x && x.value !== y.textContent) x.value = y.textContent; continue; }
      if (x.tagName === 'INPUT') { if (document.activeElement !== x) { x.value = y.getAttribute('value') || ''; x.checked = y.hasAttribute('checked'); } continue; }
      if (x.tagName === 'DETAILS') x.open = y.hasAttribute('open');
      NET.patch(x, y);
    }
    while (to.childNodes.length > b.length) to.removeChild(to.lastChild);
  },
  fixSrc(node) {
    if (node.nodeType !== 1) return;
    const list = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
    list.forEach(im => { const v = NET.Files.map('src', im.getAttribute('src')); if (v !== im.getAttribute('src')) im.setAttribute('src', v); });
  }
};

// 主機端：合成事件不能 setPointerCapture，避免出錯
(function () {
  const sp = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = function (id) { try { return sp.call(this, id); } catch (e) { } };
  document.addEventListener('toggle', () => NET.role === 'host' && NET.Host.schedule(), true);
})();

// ---------- 入口：選單 ----------
(function () {
  const origMenu = UI.menu;
  UI.menu = function () {
    origMenu.apply(UI, arguments);
    const col = document.querySelector('#dialog .btns');
    if (col && NET.role !== 'guest') {
      const b = document.createElement('button'); b.className = 'btn blue';
      b.textContent = NET.role === 'host' ? `🔗 房間 ${NET.code}（${NET.peers.size} 位朋友）` : '🔗 開房間（邀請朋友）';
      b.onclick = () => { UI.closeDialog(); NET.hostStart(); };
      col.insertBefore(b, col.firstChild);
      if (!NET.role) {
        const j = document.createElement('button'); j.className = 'btn blue'; j.textContent = '🔗 加入朋友的遊戲';
        j.onclick = () => { UI.closeDialog(); NET.guestStart(); };
        col.insertBefore(j, b.nextSibling);
      }
    }
  };
})();
