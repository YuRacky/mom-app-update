/* 實體卡片資料（依使用者拍攝的實體卡轉錄，2026-10-07 討論確認）
   技能代碼：str 力量 agi 敏捷 obs 觀察 lor 知識 inf 影響力 wil 意志
   效果代碼說明見 js/cards.js */
var CARDS = {};

/* ---------- 一般物品 ----------
   cat 類別；w 武器：'melee' 近戰 / 'ranged' 遠程；dmg 武器傷害（紅色數字）
   kind：'flavor' 只有故事文字 / 'auto' 自動加骰 / 'opt' 擲完骰後可選擇發動 / 'act' 行動時使用 / 'note' 提醒和限制 */
CARDS.items = {
  COMMON_ITEM_CARBINE_RIFLE:   { cat:'槍械', w:'ranged', dmg:5, kind:'note', text:'不能使用本卡來攻擊同格的怪物。', note:{noSameSpace:true} },
  COMMON_ITEM_BULLSEYE_LANTERN:{ cat:'光源', kind:'act', text:'行動：範圍內的另一個調查員進入眩暈狀態。', act:{otherInRange:true, cond:'dazed'} },
  COMMON_ITEM_BRASS_KNUCKLES:  { cat:'裝備', kind:'auto', text:'當玩家徒手攻擊時額外投擲兩顆骰子。', auto:{when:'unarmed', dice:2} },
  COMMON_ITEM_45_AUTOMATIC:    { cat:'槍械', w:'ranged', dmg:4, kind:'flavor', text:'偵探是件危險的活兒，但是有了這對寶貝兒你就安全多了。' },
  COMMON_ITEM_AXE:             { cat:'重型武器', w:'melee', dmg:2, kind:'opt', text:'用本卡攻擊時，你可以承受2點面朝下的恐怖來將所有🔍轉換為★。', opt:{when:'attackWith', eff:'allClue', cost:{horror:2}} },
  COMMON_ITEM_LUCKY_CIGARETTE_CASE:{ cat:'裝備', kind:'opt', text:'每回合一次，你可以將一個🔍轉換為★。', opt:{when:'any', eff:'oneClue', limit:'turn'} },
  COMMON_ITEM_LEAD_PIPE:       { cat:'重型武器', w:'melee', dmg:1, kind:'flavor', text:'「在犯罪現場發現染血的鉛管。死因未知。」——警官丁祥' },
  COMMON_ITEM_KNIFE:           { cat:'銳器', w:'melee', dmg:1, kind:'flavor', text:'啥都能切，包括怪物。' },
  COMMON_ITEM_CROWBAR:         { cat:'重型武器', w:'melee', dmg:2, kind:'flavor', text:'強力工具，輕鬆搞定。' },
  COMMON_ITEM_HOLY_CROSS:      { cat:'裝備', kind:'auto', text:'當結算［意志］檢定時額外投擲一顆骰子。', auto:{when:'skill', skill:'wil', dice:1} },
  COMMON_ITEM_ELDER_WARD:      { cat:'裝備', kind:'auto', text:'受到怪物攻擊時，可額外投擲一顆骰子。', auto:{when:'monsterAttack', dice:1} },
  COMMON_ITEM_MEDICAL_TEXTBOOK:{ cat:'裝備', kind:'act', text:'行動：你或範圍內的另外一名調查員可以棄除一點面朝下的傷害。', act:{selfOrOther:true, discardDown:{damage:1}} },
  COMMON_ITEM_BANDAGES:        { cat:'裝備', kind:'act', text:'行動：棄除至多2點面朝下的傷害。然後棄除本卡。', act:{discardDown:{damage:2}, discardSelf:true} },
  COMMON_ITEM_FIRE_EXTINGUISHER:{ cat:'重型武器', w:'melee', dmg:2, kind:'act', text:'行動：棄除你所在格和所有相鄰格中的所有火焰。', act:{remind:'請移除你所在格和所有相鄰格中的火焰標記。'} },
  COMMON_ITEM_ARCANE_MANUSCRIPT:{ cat:'書本', kind:'auto', text:'執行［知識］檢定時投擲一顆額外骰子。', auto:{when:'skill', skill:'lor', dice:1} },
  COMMON_ITEM_ELDER_SIGN_PENDANT:{ cat:'裝備', kind:'auto', text:'躲避一隻怪物時額外投擲一顆骰子。', auto:{when:'evade', dice:1} },
  COMMON_ITEM_MEAT_CLEAVER:    { cat:'銳器', w:'melee', dmg:2, kind:'opt', text:'當用本卡攻擊時，你可以承受兩點面朝下的恐怖來將所有🔍轉換為★。', opt:{when:'attackWith', eff:'allClue', cost:{horror:2}} },
  COMMON_ITEM_SHOTGUN:         { cat:'槍械', w:'ranged', dmg:6, kind:'note', text:'你不能用本卡攻擊一格距離以外的怪物。', note:{maxDist:0} },
  COMMON_ITEM_SLEDGEHAMMER:    { cat:'重型武器', w:'melee', dmg:2, kind:'opt', text:'當你使用本卡攻擊時，你可以承受2點面朝下的傷害來將所有🔍轉換為★。', opt:{when:'attackWith', eff:'allClue', cost:{damage:2}} },
  COMMON_ITEM_TOMMY_GUN:       { cat:'槍械', w:'ranged', dmg:4, kind:'opt', text:'每輪一次，在使用本卡攻擊時，你可以重擲所有骰子。', opt:{when:'attackWith', eff:'rerollAll', limit:'round'} },
  COMMON_ITEM_38_REVOLVER:     { cat:'槍械', w:'ranged', dmg:3, kind:'flavor', text:'武裝人員的好夥伴。' },
  COMMON_ITEM_WRENCH:          { cat:'重型武器', w:'melee', dmg:1, kind:'flavor', text:'「阿卡姆好像出了些狀況，我的任務就是來這兒修一修。」——威爾森．理查德' },
  COMMON_ITEM_TORCH:           { cat:'重型武器、光源', w:'melee', dmg:1, kind:'note', text:'當一名調查員丟棄本卡時，在本卡所在格子放置一個火焰。', note:{onDrop:'請在丟棄火把的格子放置一個火焰。'} },
  COMMON_ITEM_SHOVEL:          { cat:'重型武器', w:'melee', dmg:1, kind:'flavor', text:'挖洞只是它眾多功能中的一項。' },
  COMMON_ITEM_KEROSENE_LANTERN:{ cat:'光源', kind:'opt', text:'當你徒手攻擊時，你可以棄除本卡來將所有🔍轉換成★。', opt:{when:'unarmed', eff:'allClue', cost:{discardSelf:true}} },
  COMMON_ITEM_SEDATIVES:       { cat:'裝備', kind:'note', text:'在你的回合開始時，你可以棄除3點傷害和3點恐怖。如果你這樣做了，就棄除本卡然後結束你的回合。', note:{turnStart:'sedatives'} },
  COMMON_ITEM_RITUAL_DAGGER:   { cat:'銳器', w:'melee', dmg:1, kind:'auto', text:'當施放法術時額外投擲一顆骰子。', auto:{when:'spell', dice:1} },
  COMMON_ITEM_POCKET_WATCH:    { cat:'裝備', kind:'note', text:'嘗試解決謎題的時候可以額外執行一個謎題步驟。', note:{puzzleStep:1} },
  COMMON_ITEM_PICKAXE:         { cat:'重型武器', w:'melee', dmg:3, kind:'flavor', text:'只要猛地一揮，就算最硬的東西也敲得進去。' },
  COMMON_ITEM_CANDLES:         { cat:'光源', kind:'opt', text:'釋放法術時，你可以棄除本卡來將所有🔍轉換為★。', opt:{when:'spell', eff:'allClue', cost:{discardSelf:true}} },
  COMMON_ITEM_MAGNIFYING_GLASS:{ cat:'裝備', kind:'auto', text:'結算一次［觀察］檢定時額外投擲一顆骰子。', auto:{when:'skill', skill:'obs', dice:1} },
  COMMON_ITEM_HOLY_WATER:      { cat:'裝備', kind:'act', text:'行動：棄除一點恐怖然後進入集中狀態。然後棄除本卡。', act:{discardAny:{horror:1}, cond:'focused', discardSelf:true} },
  COMMON_ITEM_18_DERRINGER:    { cat:'槍械', w:'ranged', dmg:2, kind:'flavor', text:'姑娘們上街溜達總要帶點防身武器。' },
  COMMON_ITEM_KING_JAMES_BIBLE:{ cat:'書本', kind:'act', text:'行動：你或者範圍內的另一名調查員可以棄除一點面朝下的恐怖。', act:{selfOrOther:true, discardDown:{horror:1}} },
  COMMON_ITEM_MACHETE:         { cat:'銳器', w:'melee', dmg:2, kind:'flavor', text:'儘管現在一般是用來切菜，不過拿來切那些鬼東西也不錯。' },
  COMMON_ITEM_LUCKY_RABBITS_FOOT:{ cat:'裝備', kind:'opt', text:'每輪一次，你可以重新投擲一顆骰子。', opt:{when:'any', eff:'rerollOne', limit:'round'} },

  /* 翻面物品（flip 為翻面後） */
  COMMON_ITEM_2x4:      { cat:'重型武器', w:'melee', dmg:2, kind:'act', text:'行動：你用這塊木板堵住了門。將此牌面朝下放置在一扇門上，視為屏障。', act:{flip:'barricade'},
                          flip:{ name:'長木板（屏障）', text:'這扇門被一塊板加固了。將本卡視為一個屏障。當某個調查員拾起這張卡或移開這張堵住門的卡，將此牌翻到正面。' } },
  COMMON_ITEM_DYNAMITE: { cat:'裝備', kind:'act', text:'行動：點燃雷管然後投擲炸藥。將本卡翻面然後放置在範圍內的一個格子中。', act:{flip:'dynamite'},
                          flip:{ name:'點燃的炸藥', text:'在調查階段結束後，每個在該格或相鄰格的調查員受到8點傷害，每個怪物受到10點。然後棄除本卡。' } },
  COMMON_ITEM_FLARE_GUN:{ cat:'裝備', kind:'act', text:'行動：在範圍內的一個格子中放置火焰。每個在該格子中的怪物受到兩點傷害。然後將本卡翻面。', act:{remind:'在範圍內的一個格子中放置火焰，該格每個怪物受到2點傷害。', flip:'self'},
                          flip:{ name:'信號槍（最後一發）', text:'你只有最後一發了。行動：在範圍內的一個格子中放置火焰。每個在該格子中的怪物受到兩點傷害。然後將本卡棄除。', act:{remind:'在範圍內的一個格子中放置火焰，該格每個怪物受到2點傷害。', discardSelf:true} } },
  COMMON_ITEM_WHISKEY:  { cat:'裝備', kind:'act', text:'行動：棄除至多2點面朝下的恐怖。然後將本卡翻面。', act:{discardDown:{horror:2}, flip:'self'},
                          flip:{ name:'破瓶子', cat:'銳器', w:'melee', dmg:1, text:'本卡視為銳器。' } },
  UNIQUE_ITEM_HANDCUFFS:{ cat:'裝備', kind:'act', text:'行動：你可以試著用手銬來銬住嫌犯（［力量］；2）。如果你通過檢定，則將該卡翻面然後給同格的另一名調查員。', act:{test:{skill:'str', need:2}, flip:'bind'},
                          flip:{ name:'手銬（被銬住）', text:'你不能花費線索來轉換骰子或執行額外的謎題步驟。這張卡不能被丟棄或者交易。行動：你可以嘗試解開手銬（［觀察］；2）。如果你通過檢定，你就掙脫枷鎖，將該卡翻面。任何在這個格子的調查員都可以執行這個行動。', bound:{noClue:true, escape:{skill:'obs', need:2}} } },
  UNIQUE_ITEM_ROPE:     { cat:'裝備', kind:'act', text:'行動：你試著綁住嫌犯（［力量］；2）。如果通過檢定，將該卡翻面然後給同格的另外一名調查員。', act:{test:{skill:'str', need:2}, flip:'bind'},
                          flip:{ name:'繩子（被綁住）', text:'不能主動移動。這張卡不能被丟棄或者交易。行動：你可以嘗試滑出繩套（［敏捷］；2）。如果你通過檢定，則成功逃脫，然後將本卡翻面。在這個格子中的任意調查員都可以執行這個行動。', bound:{noMove:true, escape:{skill:'agi', need:2}} } }
};

/* ---------- 獨特物品（只有故事文字） ---------- */
CARDS.unique = {
  UNIQUE_ITEM_SILVER_KEY:            { cat:'鑰匙', text:'尤格．索托斯既是門，也是門鑰和其守護者。' },
  UNIQUE_ITEM_MISSING_LINK:          { cat:'證據', text:'有了這個，一切就講得通了。' },
  UNIQUE_ITEM_CULT_SIGIL:            { cat:'證據、鑰匙', text:'這個東西是狂熱信徒的身份證明。' },
  UNIQUE_ITEM_CIRCUMSTANTIAL_EVIDENCE:{ cat:'證據', text:'一切都快水落石出了。' },
  UNIQUE_ITEM_PHOTOGRAPHIC_EVIDENCE: { cat:'證據', text:'一目了然。' },
  UNIQUE_ITEM_OLD_KEYS:              { cat:'鑰匙', text:'鑰匙聲響驚寂夜，唯恐招來不速客。' },
  UNIQUE_ITEM_GOLD_KEY:              { cat:'鑰匙', text:'刻在鑰匙上繁複花紋暗示它的鎖也一樣的精巧。' },
  UNIQUE_ITEM_CONCLUSIVE_EVIDENCE:   { cat:'證據', text:'這是罪行的鐵證。' },
  UNIQUE_ITEM_FORENSIC_EVIDENCE:     { cat:'證據', text:'受害者身份證明。' },
  UNIQUE_ITEM_OIL_LAMP:              { cat:'光源', text:'燈火悲矣，魂魔萬劫。' },
  UNIQUE_ITEM_OLD_JOURNAL:           { cat:'證據', text:'這本罪犯手造日誌實際上是一本自白。' },
  UNIQUE_ITEM_GROTESQUE_STONE:       { cat:'證據', text:'這尊石像暗綠斑駁的表面彷彿見證了千年歲月。' },
  UNIQUE_ITEM_BRASS_KEY:             { cat:'鑰匙', text:'當你拿著鑰匙的時候，你可以找找可以用得上的鎖和門把手。' },
  UNIQUE_ITEM_INCRIMINATING_EVIDENCE:{ cat:'證據', text:'你覺得這個人像是嫌犯，而這就是證據。' },
  UNIQUE_ITEM_RITUAL_COMPONENTS:     { cat:'證據', text:'專供某個黑暗儀式的一套詭異物品。' },
  UNIQUE_ITEM_PUZZLE_BOX:            { cat:'裝備', text:'盒子上繁複的花紋隨著表盤的轉動而千變萬化。你不知道會開到什麼東西。' }
};

/* ---------- 狀態 ---------- */
CARDS.conditions = {
  focused:    { name:'集中', text:'結算檢定時，你可以棄除本卡將所有🔍轉換成★。', until:'use' },
  dazed:      { name:'眩暈', text:'你不能花費線索來轉換骰子結果或執行額外的謎題步驟。在你的回合結束時棄除本卡。', until:'turnEnd' },
  stunned:    { name:'擊昏', text:'該回合你至多只能執行一個行動。在你的回合結束後棄除本卡。', until:'turnEnd' },
  restrained: { name:'抑制', text:'你不能主動移動。在你的回合結束時棄除本卡。', until:'turnEnd' },
  wounded:    { name:'受傷', text:'每輪你只能執行最多一個移動行動。當你受到等同於生命值的傷害後你就被消滅。', until:'never' },
  insane:     { name:'瘋狂', text:'當你受到等同於神智值的恐怖後你就被消滅。', until:'never' }
};

/* ---------- 法術 ----------
   front.atk：攻擊法術（w, dmg）；front.act：輔助法術正面效果
   backs[i]：編號 i+1 的背面。攻擊法術：eff；輔助法術：test{need}, ok, fail
   效果：horror/damage = 自己受到面朝下；horrorUp = 面朝上；monster = 怪物額外傷害；
         flipHorrorUp/flipDamageUp/flipHorrorDown/flipDamageDown；discardHorror/discardDamage；clue；focus；
         area:'range'|'space' 範圍內/同格調查員也受；manual 需要玩家手動處理的說明 */
CARDS.spells = {
  SPELL_SHRIVELING: { name:'皺縮術', front:{ w:'ranged', dmg:3, text:'吟唱咒語使敵人的血肉沸騰燃燒。' }, backs:[
    { text:'有一瞬間，那些奇怪的燒傷彷彿佔據了你的大腦。受到1點面朝下的恐怖。', eff:{horror:1} },
    { text:'當你放下你的手，你看到手掌有一處腐爛的傷口。受到1點面朝下的傷害。', eff:{damage:1} },
    { text:'敵人的血肉震動著裂開。怪物受到額外1點傷害，然後你受到1點面朝下的恐怖。', eff:{monster:1, horror:1} },
    { text:'法術咒語在你腦中迴響。你將回響再次導出射向另一個敵人。受到1點面朝下的恐怖，然後另一隻範圍內的怪物受到3點傷害。', eff:{horror:1, manual:'範圍內的另一隻怪物受到3點傷害。'} },
    { text:'法術如你所料般生效，不過你沒想到敵人會血肉橫飛。沒有額外效果。', eff:{} } ] },
  SPELL_WITHER: { name:'凋零術', front:{ w:'ranged', dmg:2, text:'法術生效，受害者的身體便凋零乾癟。' }, backs:[
    { text:'有一瞬間，你看見自己和受害者面對面。受到1點面朝下的恐怖。', eff:{horror:1} },
    { text:'法術像活物般在你腦中蠕動撞擊。受到1點面朝下的傷害。', eff:{damage:1} },
    { text:'你看著法術在目標身上跳動擴散。受到1點面朝下的傷害，怪物則受到額外1點傷害。', eff:{damage:1, monster:1} },
    { text:'你怒吼著釋放法術，無法控制這股狂野之力朝向何處，你擊中了另一個敵人。範圍內的另一隻怪物受到2點傷害。如果範圍內沒有其他怪物，則範圍內的另一名調查員受到1點面朝下的傷害。', eff:{manual:'範圍內的另一隻怪物受到2點傷害；如果範圍內沒有其他怪物，則範圍內的另一名調查員受到1點面朝下的傷害。'} },
    { text:'就這一次，這法術如同古書上所寫的那樣精準地擊中了目標。沒有額外效果。', eff:{} } ] },
  SPELL_WRACK: { name:'滅殺術', front:{ w:'melee', dmg:5, text:'這個咒語在撕裂敵人身體的時候會造成毀滅性的刺痛。' }, backs:[
    { text:'你的敵人遭受可怕的折磨發出了近乎人類的慘叫。你和每個範圍內的調查員都受到1點面朝下的恐怖。', eff:{horror:1, area:'range'} },
    { text:'一種灼熱的蒼白疼痛穿過了你的身體。你和同格的每一名調查員受到1點面朝下的傷害。', eff:{damage:1, area:'space'} },
    { text:'你慢慢意識到自己在狂笑。受到2點恐怖。然後怪物受到額外2點傷害。', eff:{horrorUp:2, monster:2} },
    { text:'你的敵人被擊中后，猛烈地胡亂揮舞拍擊，不僅加深了自己的傷口，還波及了周圍的人。你和同格的每名調查員都受到1點面朝下的傷害，怪物受到額外1點傷害。', eff:{damage:1, area:'space', monster:1} },
    { text:'你覺得釋放這個法術如此輕鬆。你不禁對這可以輕而易舉撕裂活物的力量感到害怕。受到2點面朝下的恐怖。然後將1張恐怖卡翻面朝上。', eff:{horror:2, flipHorrorUp:1} } ] },
  SPELL_FEED_THE_MIND: { name:'養神術', front:{ act:{selfOrOther:true, cond:'focused'}, text:'行動：你或範圍內另外一名調查員進入集中狀態。然後將本卡翻面。' }, backs:[
    { test:{need:2}, ok:{}, fail:{horror:1}, text:'（［知識］；2）如果檢定成功，沒有額外效果。如果檢定失敗，受到1點面朝下的恐怖。' },
    { test:{need:3}, ok:{}, fail:{flipHorrorUp:1}, text:'（［知識］；3）如果檢定成功，沒有額外效果。如果檢定失敗，將一張恐怖卡翻面朝上。' },
    { test:{need:3}, ok:{focusAny:true}, fail:{horror:1}, text:'（［知識］；3）如果檢定成功，你或範圍內的另一名調查員進入集中狀態。如果檢定失敗，受到1點面朝下的恐怖。' },
    { test:{need:2}, ok:{clue:1}, fail:{horror:1}, text:'（［知識］；2）如果檢定成功，獲得1線索。如果檢定失敗，受到1點面朝下的恐怖。' },
    { test:{need:3}, ok:{clue:1}, fail:{flipHorrorUp:1}, text:'心神匯聚成一把尖刀（［知識］；3）。如果檢定成功，獲得1線索。如果檢定失敗，將一張恐怖卡翻面朝上。' } ] },
  SPELL_INSTILL_BRAVERY: { name:'勇氣注入', front:{ act:{selfOrOther:true, discardAny:{horror:1}}, text:'行動：你或者範圍內另一名調查員棄除一張恐怖卡。然後將本卡翻面。' }, backs:[
    { test:{need:2}, ok:{}, fail:{damage:1}, text:'將要完成法術時，你劇烈咳嗽起來（［知識］；2）。如果檢定成功，你順利吟唱完咒語；沒有額外效果。如果檢定失敗，咳嗽聲伴隨著咒語；受到1點面朝下的傷害。' },
    { test:{need:3}, ok:{}, fail:{flipHorrorUp:1}, text:'（［知識］；3）如果檢定成功，沒有額外效果。如果檢定失敗，將一張恐怖卡翻面朝上。' },
    { test:{need:3}, ok:{discardHorror:1}, fail:{flipHorrorUp:1}, text:'（［知識］；3）如果檢定成功，棄除一張恐怖卡。如果檢定失敗，將一張恐怖卡翻面朝上。' },
    { test:{need:2}, ok:{flipHorrorDown:1}, fail:{damage:1}, text:'你感覺心靈在扭曲拉伸（［知識］；2）。如果檢定成功，你豁然開朗；將一張恐怖卡翻面朝下。如果檢定失敗，你舉步維艱；受到1點面朝下的傷害。' },
    { test:{need:3}, ok:{flipHorrorDown:1}, fail:{}, text:'（［知識］；3）如果檢定成功，將一張恐怖卡翻面朝下。如果檢定失敗，沒有額外效果。' } ] },
  SPELL_FLESH_WARD: { name:'自我修復', front:{ act:{selfOrOther:true, discardAny:{damage:1}}, text:'行動：你或範圍內另一名調查員棄除一張傷害卡。然後將本卡翻面。' }, backs:[
    { test:{need:2}, ok:{}, fail:{horror:1, target:true}, text:'你感到一股躁動的力量湧入體內（［知識］；2）。如果檢定成功，你將這法力逼出；沒有額外效果。如果檢定失敗，你的皮肉如水波一般蕩漾，並且止不住地抽搐；受影響的調查員受到1點面朝下的恐怖。' },
    { test:{need:3}, ok:{}, fail:{flipDamageUp:1}, text:'你感到全身毛髮悚然（［知識］；3）。如果檢定成功，不適感轉瞬即逝；沒有額外效果。如果檢定失敗，你嘶喊著抓刺自己的皮膚；將一張傷害卡翻面朝上。' },
    { test:{need:3}, ok:{discardDamage:1}, fail:{horror:1}, text:'一陣法術的回音穿胸而過（［知識］；3）。如果檢定成功，你用心聆聽，明白了回音的含義並重新施放；棄除一張傷害卡。如果檢定失敗，你失去了注意力；受到1點面朝下的恐怖。' },
    { test:{need:2}, ok:{flipDamageDown:1, any:true}, fail:{horror:1}, text:'你洞悉了自己和同伴身體的每個部分（［知識］；2）。如果檢定成功，你知道了某種傷勢的療法；你或者範圍內另一名調查員將一張傷害卡翻面朝下。如果檢定失敗，你尖叫著將神智從這感覺中抽回；受到1點面朝下的恐怖。' },
    { test:{need:3}, ok:{flipDamageDown:1, target:true}, fail:{flipHorrorUp:1}, text:'法術釋放后，一股奇怪的能量揮之不去（［知識］；3）。如果檢定成功，你追尋到了這股能量；受到影響的調查員將一張傷害卡翻至面朝下。如果檢定失敗，能量消失得無影無蹤；將一張恐怖卡翻面朝上。' } ] }
};

/* ---------- 傷害卡（共 40 張） ----------
   mode：'imm' 立即結算後翻面朝下 / 'disc' 結算後棄除 / 'up' 面朝上放置
   eff：drop 隨機丟棄道具數；cond 進入狀態；horror/damage 額外面朝下；loseClue；flipHorrorUp；flipDamageUp；
        minus 少擲骰的技能；handLimit 道具上限；legBroken；endTurn 回合結束檢查 */
CARDS.damage = [
  { name:'輕傷',     n:16, mode:'imm', eff:{},                text:'沒有額外效果。將本卡翻面。', flavor:'只是一點皮肉傷。' },
  { name:'重傷',     n:2,  mode:'imm', eff:{damage:1},        text:'受到額外一點面朝下的傷害。然後將本卡翻面。', flavor:'你用力摀住傷口，滲出的鮮血染紅了你的手掌。' },
  { name:'重傷',     n:1,  mode:'disc', eff:{damage:1},       text:'受到額外一點面朝下的傷害。然後棄除本卡。', flavor:'' },
  { name:'背部痙攣', n:1,  mode:'imm', eff:{drop:1},          text:'隨機丟棄1個道具。然後將本卡翻面。', flavor:'肌肉痙攣讓你痛得勾住了你的背，暫時放下了手中的物品。' },
  { name:'背部痙攣', n:1,  mode:'imm', eff:{drop:1},          text:'隨機丟棄一個道具。然後將本卡翻面。', flavor:'你的背部一陣劇痛，你一下子都站不直了。' },
  { name:'致命傷',   n:2,  mode:'imm', eff:{horror:1},        text:'受到額外一點面朝下的恐怖。然後將本卡翻面。', flavor:'你的喉間湧上一口甜腥。' },
  { name:'手臂骨折', n:1,  mode:'up',  eff:{handLimit:2},     text:'如果你有2個以上道具則只保留2個道具，丟棄多餘的道具。', flavor:'你的手臂廢了，每當你想動一下的時候就痛如針扎。' },
  { name:'手臂骨折', n:1,  mode:'up',  eff:{handLimit:2},     text:'如果你有2個以上道具則只保留2個道具，丟棄多餘的道具。', flavor:'你的手臂完全失去了知覺。你想這或許是個壞兆。' },
  { name:'大腿骨折', n:1,  mode:'up',  eff:{legBroken:true},  text:'如果你一次移動行動移動了超過一個格子，則將一張傷害卡翻到正面。', flavor:'喀嚓一聲，你聽見自己的骨頭斷了。你的腿再也不能承重了。' },
  { name:'大腿骨折', n:1,  mode:'up',  eff:{legBroken:true},  text:'如果你一次移動行動移動了超過一個格子，則將一張傷害卡翻到正面。', flavor:'劇痛爬上大腿，你掙扎著站起又倒下。' },
  { name:'頭暈',     n:2,  mode:'imm', eff:{flipHorrorUp:1},  text:'將一張面朝下的恐怖卡翻面。然後將本卡翻面。', flavor:'你的視線飄忽。你擔心自己會比看上去傷得更重。' },
  { name:'擦傷',     n:1,  mode:'disc',eff:{},                text:'沒有效果，棄除本卡。', flavor:'你覺得傷勢比看起來嚴重。' },
  { name:'刺痛',     n:1,  mode:'imm', eff:{drop:2},          text:'隨機丟棄2個道具。然後將本卡翻面。', flavor:'你痛得一下子抽回了手，咬緊了牙關。' },
  { name:'毀容',     n:1,  mode:'up',  eff:{minus:'inf'},     text:'當你做［影響力］檢定時少投擲一顆骰子。', flavor:'你不敢照鏡子了。其他人看你的表情讓你有了自知之明。' },
  { name:'忍痛',     n:1,  mode:'imm', eff:{cond:'focused'},  text:'進入集中狀態。然後將本卡翻面。', flavor:'傷勢很重，但你不會讓它拖慢腳步。然而這樣做的風險太高了。' },
  { name:'耳膜穿孔', n:1,  mode:'up',  eff:{minus:'agi'},     text:'當你做［敏捷］檢定時少投擲一顆骰子。', flavor:'在變得半聾且遭受撕裂般的疼痛後，你失去了平衡。' },
  { name:'腦震盪',   n:1,  mode:'imm', eff:{loseClue:1},      text:'棄除一個線索。然後將本卡翻面。', flavor:'你的腦袋嗡嗡作響，感覺就像身陷迷霧之中。' },
  { name:'傷口難愈', n:1,  mode:'up',  eff:{},                text:'沒有效果。保持此面朝上。', flavor:'你只能眼睜睜地看著鮮血從傷口沿著你的手臂滴落。' },
  { name:'肌肉撕裂', n:1,  mode:'up',  eff:{minus:'str'},     text:'做［力量］檢定時少投擲一顆骰子。', flavor:'當你站著不動沒什麼感覺，但是當你走起來則痛得要命。' },
  { name:'頭部重擊', n:1,  mode:'imm', eff:{cond:'dazed'},    text:'進入眩暈狀態。然後將本卡翻面。', flavor:'眼花撩亂，直冒金星。' },
  { name:'腳踝扭傷', n:1,  mode:'disc',eff:{cond:'restrained'},text:'進入抑制狀態。然後棄除本卡。', flavor:'你倒了下去，抓著你的腳踝痛得吸氣。你覺得站不起來了。' },
  { name:'腹部槍傷', n:1,  mode:'disc',eff:{cond:'stunned'},  text:'進入擊昏狀態。然後棄除本卡。', flavor:'肚子受到狠狠一擊，你瞬間感覺全身的力氣都被抽走了。你摀著肚子大口喘氣。' }
];

/* ---------- 恐怖卡（共 40 張） ---------- */
CARDS.horror = [
  { name:'輕微驚嚇',   n:16, mode:'imm', eff:{},                 text:'沒有額外效果。將本卡翻面朝下。', flavor:'啊！你的心跳加快，呼吸急促。' },
  { name:'絕對恐懼',   n:2,  mode:'imm', eff:{horror:1},         text:'受到1點額外的面朝下的恐怖。然後將本卡翻面朝下。', flavor:'從喉嚨裡發出了幾不可聞的哽咽，你才發現你正無聲地流淚。' },
  { name:'歇斯底里',   n:2,  mode:'imm', eff:{flipDamageUp:1},   text:'將一張傷害卡翻面朝上。然後將本卡翻面朝下。', flavor:'你歇斯底里地尖叫，指甲在自己的皮膚上刻出數道血痕。' },
  { name:'妄想症',     n:2,  mode:'up',  eff:{endTurn:'paranoia'},text:'如果你的回合結束時，範圍內有一名其他調查員，則將一張恐怖卡翻面朝上。', flavor:'你正想像著你的朋友們會用何種方法來傷害你。' },
  { name:'驟然驚懼',   n:2,  mode:'imm', eff:{drop:2},           text:'隨機丟棄2個道具。然後將本卡翻面朝下。', flavor:'你猛地抬手防禦，這使你的一些東西飛了出去。' },
  { name:'驚慌',       n:1,  mode:'imm', eff:{damage:1},         text:'受到1點額外面朝下傷害。然後將本卡翻面。', flavor:'你驚慌失措地後退，結果跌到摔傷。你除了奔逃什麼也注意不到。' },
  { name:'驚慌',       n:1,  mode:'imm', eff:{damage:1},         text:'受到1點額外面朝下傷害。然後將本卡翻面。', flavor:'你尖叫著奔逃，卻摔倒在地。' },
  { name:'迷失方向',   n:1,  mode:'imm', eff:{cond:'dazed'},     text:'進入眩暈狀態。然後將本卡翻面朝下。', flavor:'腦袋空空的你喃喃自語不知所措。剛剛看見的東西怎麼可能是真的？' },
  { name:'默默承受',   n:1,  mode:'imm', eff:{cond:'focused'},   text:'進入集中狀態。然後將本卡翻面朝下。', flavor:'深呼吸，嚥下恐懼。' },
  { name:'魔術恐慌',   n:1,  mode:'imm', eff:{perSpell:1},       text:'每擁有1張法術卡，受到1點額外的面朝下的恐怖。然後將本卡翻面朝下。', flavor:'你抽泣著抗拒這難以置信的事實。' },
  { name:'痴呆',       n:1,  mode:'imm', eff:{loseClue:1},       text:'棄除一個線索。然後將本卡翻面朝下。', flavor:'你轉過身去，腦中如墜雲霧。這反而是一種解脫，真的。' },
  { name:'驚懼躲藏',   n:1,  mode:'disc',eff:{cond:'stunned'},   text:'進入擊昏狀態。然後棄除本卡。', flavor:'你縮到一個角落藏了起來，就一小會兒就一小會兒。' },
  { name:'尖叫痙攣',   n:1,  mode:'disc',eff:{cond:'restrained'},text:'進入抑制狀態。然後棄除本卡。', flavor:'你尖叫個不停，然後又哭又笑，甚至還打嗝。' },
  { name:'回憶',       n:1,  mode:'disc',eff:{flipHorrorUp:1},   text:'將另一張恐怖卡翻至正面。然後棄除本卡。', flavor:'最近的一些記憶不受控制地浮現出來。' },
  { name:'震驚',       n:1,  mode:'disc',eff:{},                 text:'沒有效果，棄除本卡。', flavor:'你驚慌失措地向後退。' },
  { name:'計算力缺失', n:1,  mode:'up',  eff:{minus:'lor'},      text:'結算［知識］檢定時少投擲1顆骰子。', flavor:'你好像無法排列字母或數字了。你知道你本來是可以的，但是現在好像什麼都不會了。' },
  { name:'幻覺',       n:1,  mode:'up',  eff:{minus:'obs'},      text:'結算［觀察］檢定時少投擲1顆骰子。', flavor:'恐怖的陰影和鬼魂隨處可見，從記憶深處噴湧而至。你再看一眼就會受不了。' },
  { name:'極度緊張',   n:1,  mode:'up',  eff:{minus:'wil'},      text:'結算［意志］檢定時少投擲1顆骰子。', flavor:'你做了幾個深呼吸，但是這無法讓你平靜。你彷彿這時候一根羽毛都能將你推落懸崖。' },
  { name:'幽閉恐懼症', n:1,  mode:'up',  eff:{endTurn:'claustro'},text:'如果你回合結束時，範圍內格子數量少於等於2格，受到1點面朝下的恐怖。', flavor:'這裡太窄了，簡直令人窒息。你必須要出去透口氣。' },
  { name:'黑夜恐懼症', n:1,  mode:'up',  eff:{endTurn:'dark'},   text:'如果你的回合結束時你所處的格子是黑暗狀態，則受到1點面朝下的恐怖。', flavor:'你不怕黑，真的。你怕的是黑暗之下未知的恐怖。' },
  { name:'盜竊癖',     n:1,  mode:'up',  eff:{endTurn:'klepto'}, text:'如果你的回合結束時所處格子中有一名其他調查員，則隨機從其手中抽取一張道具卡。', flavor:'你不知道為什麼你總是想偷東西，你就是情不自禁。' }
];

/* ---------- 瘋狂卡（共 12 張，min = 需要的調查員人數） ---------- */
CARDS.insanity = [
  { name:'散播真理', min:1, win:'evidence2', text:'你的勝利條件改變：只有當調查完成，而且你有兩個或更多個證據類型的特殊物品時，你才能獲勝。否則你失敗。', flavor:'沒人相信你，但是你確實看清。真理就在那兒。' },
  { name:'躁動不安', min:1, text:'你在每輪中不能執行多次相同的行動。你的遊戲勝利或失敗條件不變。', flavor:'你突然覺得人生枯燥乏味毫無意義。世界之大，人生苦短。變數才是人生的調味料！' },
  { name:'懷疑',     min:1, text:'沒有效果。你的遊戲勝利或失敗條件不變。', flavor:'你的朋友們瞥了你一眼，他們的眼中充滿了不信任。' },
  { name:'中邪',     min:1, win:'noSearch', text:'你的勝利條件改變：只有當調查完成，而且版圖上沒有任何搜索標記時，你才能獲勝。否則你失敗。', flavor:'你必須找到它。你不知道到底是什麼，但你覺得看到就會知道，而且最終這會帶給你安寧。' },
  { name:'自私自利', min:2, win:'notWounded', text:'你的勝利條件改變：只有當調查完成，而且你沒有進入受傷狀態時，你才能獲勝。否則你失敗。當你拿到本卡時，如果你處於受傷狀態，則棄除本卡並另外抽一張不同的瘋狂狀態卡。', flavor:'你不信任你的「朋友」，你才不會為了這些人犧牲自我。' },
  { name:'同病相憐', min:2, win:'otherBroken', text:'你的勝利條件改變：只有當調查完成而且一個或更多其他的調查員進入受傷狀態或瘋狂狀態時，你才能獲勝。否則你就失敗。', flavor:'他們嘲笑著你的不幸。但你很清楚他們不會再笑很久……' },
  { name:'殺身成仁', min:2, win:'eliminated', text:'你的勝利條件改變：只有當調查被完成而且你被消滅，你才會獲勝。否則你就失敗。', flavor:'你過於長久地凝視著深淵以及與搖擺物共舞。在更好的世界裡你沒有可以為之奮鬥的一席之地。不如一死報諸君。' },
  { name:'禁忌之語', min:2, text:'你不能說話。你的遊戲勝利或失敗條件不變。', flavor:'你恐懼的話語預示了你的崩潰。你決定再也不說話。' },
  { name:'縱火狂',   min:3, win:'fire6', text:'你的勝利條件改變：在你的回合開始時，如果6個或以上房間有火焰，則你立刻獲勝而且遊戲隨之結束。如果遊戲以其他方式結束則你立刻失敗。', flavor:'火焰使你溫暖，還能驅走黑暗。唯一能讓你感到安全的就是點燃盡可能多的美麗火焰。' },
  { name:'千分之一', min:3, win:'blade', text:'你的勝利條件改變：你的回合開始時，如果你持有銳器，而且你的格子中只有一名其他調查員，你可以立刻獲勝而且遊戲隨之結束。如果遊戲以其他方式結束則你立刻失敗。', flavor:'你必須向森之黑山羊獻祭！萬歲萬歲！長眠的莎布-尼古拉斯！' },
  { name:'良心的斥責', min:3, win:'notComplete', text:'你的勝利條件改變：在遊戲結束時，如果調查沒有完成則你獲勝。否則你失敗。', flavor:'你和你的伙伴根本不懂自己的所作所為有何影響。宇宙有其自然規律，你們又有何權利去決定這整個進程？' },
  { name:'自戀',     min:3, win:'items6', text:'你的勝利條件改變：在遊戲結束時，如果你有至少6件的道具，你就能獲勝。否則你失敗。', flavor:'這簡直是不言而喻：你生的如此美麗，顯然比任何人都更值得擁有我找到的物品。你可是費盡千辛萬苦才來到這個鬼地方的！' }
];

/* ---------- 怪物圖板 ----------
   aw 察覺（綠）、hr 恐懼（藍）、brawn 蠻力（背面紅）、kw 關鍵字 */
CARDS.monsters = {
  MONSTER_DEEP_ONE:            { aw:3, hr:4, brawn:2, kw:['水棲'], flavor:'這是某種恐怖強力的人魚混合生物。它們會張牙舞爪地尖嘯蹦跳。' },
  MONSTER_DEEP_ONE_HYBRID:     { aw:3, hr:1, brawn:2, kw:[], flavor:'第一眼看上去，這好像是個人類，但是這個生物的血液中隱藏了墮落謎團。' },
  MONSTER_CULTIST:             { aw:3, hr:1, brawn:2, kw:[], flavor:'一些獻身於不普通事業的普通人。有些人自認為這可以改善世界，有些人則自存私心……' },
  MONSTER_STAR_SPAWN:          { aw:5, hr:8, brawn:5, kw:['飛行'], flavor:'這隻巨大的外星生物有著橡膠似的皮膚和長滿觸鬚的嘴巴，這彷彿暗示著其海底祖先。但是其翅膀和利爪令其看起來更為危險。' },
  MONSTER_HUNTING_HORROR:      { aw:5, hr:6, brawn:3, kw:['飛行'], flavor:'這種生物蛇身體黑色黏稠，並且冷酷無情。追殺獵物的時候總是快速飛行。肉眼難以識別其千變萬化的形態。' },
  MONSTER_RIOT:                { aw:7, hr:4, brawn:4, kw:[], flavor:'人群本身就是一種極度危險的存在。更何況是一群危險分子。' },
  MONSTER_GHOST:               { aw:2, hr:5, brawn:1, kw:['穿透'], flavor:'忽隱忽現，撲朔迷離，鬼魂是那些逝者的靈魂，遊蕩在活人的世界。' },
  UNIQUE_MONSTER_CHILD_OF_DAGON:{ aw:4, hr:3, brawn:2, kw:[], flavor:'相比它的同伴，它看上去更不像人類。這怪物的似魚般的凝視和濕黏皮膚，暗示著其先祖來自深海。' },
  UNIQUE_MONSTER_PRIEST_OF_DAGON:{ aw:4, hr:3, brawn:2, kw:[], flavor:'達貢祭司聽命於邪神，慶祝著人類與海底怪獸的結合。' }
};
CARDS.keywords = {
  '水棲':'這個怪物可以穿過水域。',
  '飛行':'這個怪物可以穿越不可通過的邊界。',
  '穿透':'這個怪物可以穿過不可通過的邊界和牆壁。'
};

/* 基本盒的 8 位調查員（選人畫面只顯示這些） */
CARDS.ownedInvestigators = ['INVESTIGATOR_AGATHA_CRANE','INVESTIGATOR_CARSON_SINCLAIR','INVESTIGATOR_FATHER_MATEO','INVESTIGATOR_MINH_THI_PHAN','INVESTIGATOR_PRESTON_FAIRMONT','INVESTIGATOR_RITA_YOUNG','INVESTIGATOR_WENDY_ADAMS','INVESTIGATOR_WILLIAM_YORICK'];
