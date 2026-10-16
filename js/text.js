// 文字與圖示處理
const ICONS = {
  '\uf200': 'img/icons/strength.png', '\uf201': 'img/icons/agility.png', '\uf202': 'img/icons/observation.png',
  '\uf203': 'img/icons/lore.png', '\uf204': 'img/icons/influence.png', '\uf205': 'img/icons/will.png',
  '\uf206': 'img/ui/ElderSign_256.png', '\uf207': 'img/ui/MAD20_Clue-Token.png', '\uf208': 'img/ui/action-text.png'
};
const PRODUCT_ICON = { '\uf209': '二版', '\uf20a': '一版', '\uf20b': '禁忌煉金', '\uf20c': '荒野呼喚', '\uf20d': '超越界限', '\uf20e': '詭鎮街道', '\uf20f': '暮光聖堂', '\uf480': '驚魂之旅', '\uf481': '長蛇之路' };
const SKILLS = [
  { k: 'str', zh: '力量', icon: 'img/icons/strength.png' },
  { k: 'agi', zh: '敏捷', icon: 'img/icons/agility.png' },
  { k: 'obs', zh: '觀察', icon: 'img/icons/observation.png' },
  { k: 'lor', zh: '知識', icon: 'img/icons/lore.png' },
  { k: 'inf', zh: '影響', icon: 'img/icons/influence.png' },
  { k: 'wil', zh: '意志', icon: 'img/icons/will.png' }
];
// PuzzleAbilityType: Strength, Agility, Observation, Lore, Influence, Will
const ABILITY_INDEX = ['str', 'agi', 'obs', 'lor', 'inf', 'wil'];

function T(key) {
  if (key == null || key === '') return '';
  if (typeof key === 'object') key = key.Key || '';
  const sc = scTable();
  if (sc && sc[key] != null) return sc[key];
  if (STR[key] != null) return STR[key];
  if (STR_EN[key] != null) return STR_EN[key];
  // 官方資料有些代碼把底線打成空格（例如破碎守護 01B）：換成底線再找一次
  if (/ /.test(key) && /^[A-Z0-9_ ]+$/.test(key)) { const k2 = key.replace(/ /g, '_'); if (hasKey(k2)) return T(k2); }
  return key;
}
// 目前劇本自己的文字表（不同劇本會用到相同的代碼）
function scTable(en) {
  const id = typeof G !== 'undefined' && G.scenId;
  const all = en ? (typeof STR_SC_EN !== 'undefined' && STR_SC_EN) : (typeof STR_SC !== 'undefined' && STR_SC);
  return id && all ? all[id] : null;
}
function hasKey(key) { const sc = scTable(); return key && ((sc && sc[key] != null) || STR[key] != null || STR_EN[key] != null); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// 把遊戲字串轉成 HTML（圖示、斜體、粗體、顏色）
function fmt(s) {
  s = esc(s || '');
  s = s.replace(/\uf208\s*/g, '\u0002').replace(/[\uf200-\uf207]/g, c => `<img class="ico" src="${ICONS[c]}" alt="">`);
  s = s.replace(/[\uf209-\uf20f\uf480\uf481]\s?/g, '');
  s = s.replace(/[\ue000-\uf8ff]/g, '');
  s = s.replace(/\u0002/g, '<span class="actIco">\uf208</span>');
  s = s.replace(/\[i\/?\]/g, '<i>').replace(/\[\/i\]/g, '</i>');
  s = s.replace(/\[b\]/g, '<b>').replace(/\[\/b\]/g, '</b>');
  s = s.replace(/\[([0-9A-Fa-f]{6,8})\]/g, '<span class="gold">').replace(/\[-\]/g, '</span>');
  s = s.replace(/\\n/g, '\n');
  return s;
}
// 純文字（給紀錄用）
// 地圖標記的種類：名稱沒有 SEARCH／EXPLORE… 開頭的（例如「Lobby Table」），就看圖案判斷
function nodeTag(id) {
  if (/^(SEARCH|SERACH|EXPLORE|INTERACT|PERSON|REDIRECT|SIGHT|ITEM|REVEAL)/.test(id || '')) return id;
  const n = (typeof G !== 'undefined' && G.nodes || {})[id]; const sp = (n && n.sprite) || '';
  const k = /Feature_Search/.test(sp) ? 'SEARCH' : /Feature_Explore/.test(sp) ? 'EXPLORE' : /Feature_Interact/.test(sp) ? 'INTERACT' : /^Person_/.test(sp) ? 'PERSON' : /Sight/i.test(sp) ? 'SIGHT' : '';
  return k ? k + ' ' + id : (id || '');
}
function plain(s) {
  return (s || '').replace(/[\uf200-\uf208]/g, c => '〔' + ({ '\uf200': '力量', '\uf201': '敏捷', '\uf202': '觀察', '\uf203': '知識', '\uf204': '影響', '\uf205': '意志', '\uf206': '成功', '\uf207': '線索', '\uf208': '行動' }[c]) + '〕')
    .replace(/[\uf209-\uf20f\uf480\uf481]/g, '').replace(/\[\/?[ib]\/?\]/g, '').replace(/\[[0-9A-Fa-f]{6,8}\]|\[-\]/g, '');
}
function format(str, args) {
  return str.replace(/\{(\d+)\}/g, (m, i) => args[i] != null ? args[i] : '');
}
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr.length ? arr[rnd(arr.length)] : null; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
