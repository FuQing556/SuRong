/* ═══════════════════════════════════════════
   游戏全流程模拟测试 — 覆盖所有判定层
   运行: node tests/simulation-test.js
   ═══════════════════════════════════════════ */

const fs = require('fs');
const vm = require('vm');

const passed = [];
const failed = [];
function check(name, ok, detail) {
  if (ok) { passed.push(name); console.log('\x1b[32m✅\x1b[0m ' + name); }
  else { failed.push(name); console.error('\x1b[31m❌\x1b[0m ' + name + (detail ? ' — ' + detail : '')); }
}

// Create shared VM context with all browser globals
const store = {};
const sandbox = {
  window: { XIXI: { modulesLoaded: [] } },
  document: { createElement: () => ({}), querySelector: () => null, querySelectorAll: () => [] },
  navigator: { language: 'zh-CN', platform: 'Win32' },
  screen: { width: 1920, height: 1080 },
  localStorage: {
    getItem: k => store[k] || null,
    setItem: (k,v) => { store[k] = v; },
    removeItem: k => { delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: () => null,
  },
  setTimeout: (fn) => { fn(); return 0; },
  setInterval: () => 0,
  clearInterval: () => {},
  clearTimeout: () => {},
  requestIdleCallback: (fn) => setTimeout(fn, 0),
  console: console,
  // Don't pre-define gameState — state.js declares 'let gameState' which would shadow this.
  // Instead, set initial values via a post-load helper.
};
sandbox.global = sandbox;

const ctx = vm.createContext(sandbox);

// Load modules into shared context
var moduleOrder = ['state.js', 'utils.js', 'saves.js', 'achievements.js'];
for (var mi = 0; mi < moduleOrder.length; mi++) {
  var code = fs.readFileSync('public/js/' + moduleOrder[mi], 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: moduleOrder[mi] });
  } catch (e) {
    console.error('LOAD ERROR in ' + moduleOrder[mi] + ': ' + e.message);
    throw e;
  }
}

// Copy const/let variables from VM scope to sandbox properties (functions are already there)
vm.runInContext('this.FALLBACK_TEMPLATE = FALLBACK_TEMPLATE; this.LS_KEYS = LS_KEYS; this.$ = $; this.$$ = $$; this.dom = dom; this.KEEP_ROUNDS = KEEP_ROUNDS; this.gameState = gameState; if (typeof _keyObfuscator !== "undefined") this._keyObfuscator = _keyObfuscator;', ctx);

// Now extract
var FALLBACK_TEMPLATE = ctx.FALLBACK_TEMPLATE;
var LS_KEYS = ctx.LS_KEYS;
var KEEP_ROUNDS = ctx.KEEP_ROUNDS;
var validateAndRepairTemplate = ctx.validateAndRepairTemplate;
var extractAllFields = ctx.extractAllFields;
var updateFieldHistoryFromParsed = ctx.updateFieldHistoryFromParsed;
var _findFieldId = ctx._findFieldId;
var _fieldVal = ctx._fieldVal;
var checkAchievementsFromState = ctx.checkAchievementsFromState;
var checkHiddenAchievements = ctx.checkHiddenAchievements;
var getAchievementProgress = ctx.getAchievementProgress;
var getAchievements = ctx.getAchievements;
var getUnlockedAchievements = ctx.getUnlockedAchievements;
var unlockAchievement = ctx.unlockAchievement;
var saveAchievements = ctx.saveAchievements;
var saveGameState = ctx.saveGameState;
var loadGameState = ctx.loadGameState;
var getSaveInfo = ctx.getSaveInfo;
var getSaveKey = ctx.getSaveKey;
var loadSaves = ctx.loadSaves;
var collectEligibleEndings = ctx.collectEligibleEndings;
var selectBestEnding = ctx.selectBestEnding;
var checkEndingClientSide = ctx.checkEndingClientSide;
var buildEndingInjection = ctx.buildEndingInjection;
var detectEnding = ctx.detectEnding;
var buildSystemPrompt = ctx.buildSystemPrompt;
var parseEndingsFromPromptBody = ctx.parseEndingsFromPromptBody;
var generateEndingsSection = ctx.generateEndingsSection;
var escapeHtml = ctx.escapeHtml;
var safeSetItem = ctx.safeSetItem;

// Verify all critical functions loaded
var allLoaded = true;
['validateAndRepairTemplate','extractAllFields','FALLBACK_TEMPLATE','LS_KEYS',
 '_fieldVal','_findFieldId','checkAchievementsFromState','checkHiddenAchievements',
 'getAchievementProgress','collectEligibleEndings','selectBestEnding',
 'buildEndingInjection','detectEnding','buildSystemPrompt',
 'updateFieldHistoryFromParsed','saveGameState','loadGameState','getSaveInfo',
 'parseEndingsFromPromptBody','generateEndingsSection'].forEach(function(name) {
  if (typeof eval(name) === 'undefined') { console.error('MISSING: ' + name); allLoaded = false; }
});
if (!allLoaded) { console.error('Cannot continue — essential functions missing'); process.exit(1); }

// Load template
var tpl = JSON.parse(fs.readFileSync('templates/surongrong.json', 'utf8'));
var allFields = [];
var secKeys = Object.keys(tpl.outputSections);
for (var ski = 0; ski < secKeys.length; ski++) {
  var fs2 = tpl.outputSections[secKeys[ski]].fields || [];
  for (var fi = 0; fi < fs2.length; fi++) allFields.push(fs2[fi]);
}

// ═══════ 1. 模板结构 ═══════
console.log('\n═══ 1. 模板结构校验 ═══');
check('模板可解析', tpl && tpl.name === '苏蓉蓉·潜伏');
check('outputSections 4区段', Object.keys(tpl.outputSections).length === 4);
check('endings >=6', tpl.endings && tpl.endings.length >= 6);
check('achievements >=10', Object.keys(tpl.achievements).length >= 10);
check('hiddenAchievements >=5', Object.keys(tpl.hiddenAchievements).length >= 5);
check('openingMessages 6条', tpl.openingMessages && tpl.openingMessages.length === 6);
check('initialState 覆盖10字段', Object.keys(tpl.initialState).length >= 10);
check('promptBody >=6000字', (tpl.promptBody || '').length >= 6000);

var repaired = validateAndRepairTemplate(JSON.parse(JSON.stringify(tpl)));
check('有效模板不被破坏', repaired.outputSections.statusTop.fields.length === tpl.outputSections.statusTop.fields.length);

var broken = JSON.parse(JSON.stringify(tpl));
broken.achievements = ['array'];
broken.hiddenAchievements = null;
broken.outputSections.variables = null;
var fixed = validateAndRepairTemplate(broken);
check('achievements数组→对象', typeof fixed.achievements === 'object' && !Array.isArray(fixed.achievements));
check('hiddenAchievements null→对象', typeof fixed.hiddenAchievements === 'object');
check('variables null→重建', Array.isArray(fixed.outputSections.variables.fields));

delete fixed.endings;
var reEnd = validateAndRepairTemplate(fixed);
check('endings缺失→从promptBody迁移', Array.isArray(reEnd.endings) && reEnd.endings.length >= 6);

// ═══════ 2. 字段提取 ═══════
console.log('\n═══ 2. 字段提取 ═══');
var aiResp = '[场景类型：社交] [事件大小：小]\n上回合：你选择了婉拒。\n现状：走廊被拦。\n可选行动：\n1. 回答 — 低风险\n2. 撒谎 — 情报碎片+1 暴露风险+5 【中风险】\n3. 走人 — 压力值+15 【低风险】\n4. 反唇 — 笑红尘态度-20 【高风险】\n\n压力值：22 | 暴露风险：12 | 魂力状态：正常\n轮次：2 | 潜伏进度：1\n情报碎片：2 | 把柄：0\n梦红尘好感：18 | 笑红尘态度：-5 | 圣灵教觊觎：0';
var parsed = extractAllFields(aiResp, allFields);
check('压力值=22', parsed.stress === '22');
check('暴露风险=12', parsed.exposure === '12');
check('梦红尘好感=18', parsed.mengHaoGan === '18');
check('笑红尘态度=-5', parsed.xiaoTaiDu === '-5');
check('圣灵教觊觎=0', parsed.shenglingjiao === '0');
check('把柄=0', parsed.blackmail === '0');
check('魂力状态=正常', parsed.soulState === '正常');

// 短标签不吞长标签
var t1 = extractAllFields('压力值：50 | 笑红尘态度：10 | 梦红尘好感：25', allFields);
check('笑红尘≠红尘短匹配', t1.xiaoTaiDu === '10');
check('梦红尘≠红尘短匹配', t1.mengHaoGan === '25');

// 底部覆盖顶部
check('底部覆盖顶部', extractAllFields('压力值：[0-100]\n...\n压力值：85', allFields).stress === '85');

// 空值回退
var t3 = extractAllFields('压力值： | 暴露风险：', allFields);
check('空值→占位符', t3.stress === '—');
check('未出现→占位符', t3.blackmail === '—');

// 半角冒号
var t4 = extractAllFields('压力值:22|暴露风险:12', allFields);
check('半角冒号', t4.stress === '22');

// 零值保留
var t5 = extractAllFields('把柄：0 | 圣灵教觊觎：0', allFields);
check('零值保留:把柄', t5.blackmail === '0');
check('零值保留:圣灵教', t5.shenglingjiao === '0');

// ═══════ 3. fieldHistory ═══════
console.log('\n═══ 3. fieldHistory ═══');
ctx.gameState.fieldHistory = {};
updateFieldHistoryFromParsed({ fields: { stress: '10', exposure: '5', blackmail: '0', mengHaoGan: '20', xiaoTaiDu: '0', shenglingjiao: '0', intel: '0', infiltration: '0', round: '1', soulState: '正常' } });
var fh = ctx.gameState.fieldHistory;
check('压力值current=10', fh.stress.current === 10);
check('压力值max=10', fh.stress.max === 10);
check('把柄current=0', fh.blackmail.current === 0);
check('把柄max=0', fh.blackmail.max === 0);
check('魂力状态文本', fh.soulState.currentText === '正常');

updateFieldHistoryFromParsed({ fields: { stress: '35', shenglingjiao: '-10', intel: '3' } });
check('压力max上升', fh.stress.max === 35);
check('圣灵教觊觎current=-10', fh.shenglingjiao.current === -10);
check('圣灵教觊觎max=0(下降型)', fh.shenglingjiao.max === 0);

// 类型切换
fh.soulState.current = 50; fh.soulState.max = 50; delete fh.soulState.currentText;
updateFieldHistoryFromParsed({ fields: { soulState: '正常' } });
check('文本恢复清理旧数值', fh.soulState.currentText === '正常');
check('删除current', !fh.soulState.hasOwnProperty('current'));

// ═══════ 4. _fieldVal / _findFieldId ═══════
console.log('\n═══ 4. _fieldVal / _findFieldId ═══');
ctx.gameState.activeTemplate = tpl;
check('精确匹配', _findFieldId('压力值') === 'stress');
check('子串匹配', _findFieldId('压力') === 'stress');
check('空串守卫', _findFieldId('') === null);
check('无匹配', _findFieldId('不存在') === null);
check('正常读取', _fieldVal('压力值', false) === 35);
check('useMax', _fieldVal('压力值', true) === 35);
check('负数值', _fieldVal('圣灵教觊觎', false) === -10);
check('缺失→undefined', _fieldVal('不存在', false) === undefined);
ctx.gameState.fieldHistory.newEmpty = {};
check('未初始化→undefined', _fieldVal('newEmpty', false) === undefined);

// ═══════ 5. 可见成就 ═══════
console.log('\n═══ 5. 可见成就 ═══');
ctx.gameState.activeTemplate = tpl;
ctx.gameState.fullHistory = [{role:'user',content:'开始'},{role:'assistant',content:'...'},{role:'user',content:'选1'}];
ctx.gameState.achievementFlags.endingTriggered = false;
ctx.gameState.achievementFlags.triggeredEndings = [];
var ak = LS_KEYS.achievements('surongrong');
ctx.localStorage.setItem(ak, '{}');

// 重置所有字段
ctx.gameState.fieldHistory = {};
updateFieldHistoryFromParsed({ fields: { stress: '35', exposure: '15', blackmail: '3', mengHaoGan: '20', xiaoTaiDu: '10', shenglingjiao: '0', intel: '2', infiltration: '1', round: '2', soulState: '正常' } });

checkAchievementsFromState({ fields: { stress: '35' } });
var u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('低数值不触发', Object.keys(u).length === 0);

// 把柄达到5
updateFieldHistoryFromParsed({ fields: { blackmail: '5' } });
checkAchievementsFromState({ fields: { blackmail: '5' } });
u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('把柄=5→把柄收藏家', !!u['把柄收藏家']);

// 负阈值
ctx.gameState.fieldHistory.shenglingjiao = { current: -55, max: 0 };
checkAchievementsFromState({ fields: { shenglingjiao: '-55' } });
u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('圣灵教觊觎=-55→圣灵教之影', !!u['圣灵教之影']);

// isNeverExceeded
ctx.gameState.fieldHistory.exposure = { current: 15, max: 15 };
checkAchievementsFromState({ fields: { exposure: '15' } });
u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('暴露max=15→潜行大师', !!u['潜行大师']);

// isNeverExceeded 不触发
ctx.localStorage.setItem(ak, '{}');
ctx.gameState.fieldHistory.exposure = { current: 18, max: 25 };
checkAchievementsFromState({ fields: { exposure: '18' } });
u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('暴露max=25不触发', !u['潜行大师']);

// ═══════ 6. 隐藏成就 ═══════
console.log('\n═══ 6. 隐藏成就 ═══');
ctx.localStorage.setItem(ak, '{}');
ctx.gameState.achievementFlags.endingTriggered = true;
ctx.gameState.fieldHistory.blackmail = { current: 0, max: 5 };
ctx.gameState.fieldHistory.stress = { current: 80, max: 88 };
ctx.gameState.fieldHistory.round = { current: 8, max: 8 };

checkHiddenAchievements({});
u = JSON.parse(ctx.localStorage.getItem(ak) || '{}');
check('field_zero→净身出户', !!u['净身出户']);
check('field_max_under→崩溃边缘', !!u['崩溃边缘']);
check('rounds_under→闪电撤离', !!u['闪电撤离']);

// ═══════ 7. 结局条件 ═══════
console.log('\n═══ 7. 结局条件检测 ═══');
ctx.gameState.fieldHistory = {
  stress: { current: 97, max: 97 },
  exposure: { current: 30, max: 50 },
  soulState: { currentText: '正常' },
  round: { current: 16, max: 16 },
  infiltration: { current: 4, max: 4 },
  intel: { current: 6, max: 6 },
  blackmail: { current: 6, max: 6 },
  mengHaoGan: { current: 75, max: 75 },
  xiaoTaiDu: { current: 20, max: 20 },
  shenglingjiao: { current: -30, max: 0 },
};
ctx.gameState.fullHistory = [];
for (var i = 0; i < 16; i++) { ctx.gameState.fullHistory.push({role:'user'}); ctx.gameState.fullHistory.push({role:'assistant'}); }
ctx.gameState.achievementFlags.triggeredEndings = [];

var eligible = collectEligibleEndings(tpl);
var names = eligible.map(function(e) { return e.name; });
check('压力97→月光和六便士', names.indexOf('月光和六便士') >= 0, names.join(','));
check('情报6+暴露30+轮次16→归乡', names.indexOf('归乡') >= 0);
check('暮去朝来', names.indexOf('暮去朝来') >= 0);
check('红尘庇佑', names.indexOf('红尘庇佑') >= 0);
check('凉面派(轮次16≥15)', names.indexOf('凉面派') >= 0);
check('暴露30不触发枯萎之刻', names.indexOf('枯萎之刻') === -1);

var best = selectBestEnding(eligible, tpl);
check('择优:凉面派(轮次16)最高轮次优先', best === '凉面派');

ctx.gameState.achievementFlags.triggeredEndings = ['凉面派'];
var best2 = selectBestEnding(eligible, tpl);
check('凉面派已触发→归乡(轮次8>暮去朝来轮次6)', best2 === '归乡');

// 条件不满足: 重置所有字段
ctx.gameState.fieldHistory = {
  stress: { current: 50, max: 50 },
  exposure: { current: 30, max: 50 },
  round: { current: 5, max: 5 },
  infiltration: { current: 1, max: 1 },
  intel: { current: 2, max: 2 },
  blackmail: { current: 1, max: 1 },
  mengHaoGan: { current: 30, max: 30 },
  xiaoTaiDu: { current: 10, max: 10 },
  shenglingjiao: { current: -5, max: 0 },
};
ctx.gameState.fullHistory = [];
for (var j2 = 0; j2 < 5; j2++) { ctx.gameState.fullHistory.push({role:'user'}); ctx.gameState.fullHistory.push({role:'assistant'}); }
check('压力50→无结局', collectEligibleEndings(tpl).length === 0);

// =100放宽≥95
ctx.gameState.fieldHistory.stress.current = 96;
ctx.gameState.fieldHistory.intel.current = 6;
ctx.gameState.achievementFlags.triggeredEndings = [];
check('压力96→月光(=100放宽≥95)', collectEligibleEndings(tpl).some(function(e) { return e.name === '月光和六便士'; }));

// ═══════ 8. 选项资源检测 ═══════
console.log('\n═══ 8. 选项资源检测 ═══');
ctx.gameState.fieldHistory = {
  blackmail: { current: 2, max: 5 },
  intel: { current: 3, max: 3 },
  mengHaoGan: { current: 40, max: 40 },
  shenglingjiao: { current: -30, max: 0 },
  stress: { current: 50, max: 50 },
};

function checkRes(action, cost) {
  for (var sk in tpl.outputSections) {
    var fields = tpl.outputSections[sk].fields || [];
    for (var fi = 0; fi < fields.length; fi++) {
      var f = fields[fi];
      var cur = (ctx.gameState.fieldHistory[f.id] && ctx.gameState.fieldHistory[f.id].current !== undefined) ? ctx.gameState.fieldHistory[f.id].current : NaN;
      if (typeof cur !== 'number' || isNaN(cur)) continue;
      var esc = f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp(esc + '[：:\\s]*[xX×]?\\s*([+-]?\\d+)');
      var m = cost.match(re) || action.match(re);
      if (!m) { re = new RegExp(esc + '[\\s\\S]{0,8}?([+-]?\\d+)'); m = cost.match(re) || action.match(re); }
      if (m) {
        var neededStr = m[1], needed = parseInt(neededStr);
        if (isNaN(needed)) continue;
        if (neededStr.charAt(0) === '+') return 'gain';
        if (needed < 0) {
          var rangeSrc = f.range || f.formatHint || '';
          var rm = String(rangeSrc).match(/[\[\(]?\s*([-]?\d+)/);
          var fMin = rm ? parseInt(rm[1]) : 0;
          return (cur + needed < fMin) ? 'blocked_penalty' : 'penalty_ok';
        }
        return (cur < needed) ? 'blocked_cost' : 'cost_ok';
      }
    }
  }
  return 'no_match';
}

check('情报碎片:3 cur=3→够', checkRes('偷情报', '情报碎片: 3') === 'cost_ok');
check('把柄:3 cur=2→不够', checkRes('收买', '把柄: 3') === 'blocked_cost');
check('好感+20→增益', checkRes('魅惑', '梦红尘好感+20') === 'gain');
check('觊觎-20 cur=-30 min=-100→允许', checkRes('威慑', '圣灵教觊觎-20') === 'penalty_ok');
ctx.gameState.fieldHistory.shenglingjiao.current = -95;
check('觊觎-20 cur=-95→-115<-100阻止', checkRes('威慑', '圣灵教觊觎-20') === 'blocked_penalty');

// ═══════ 9. 存档 ═══════
console.log('\n═══ 9. 存档读写 ═══');
var svKey = 'xixi_gamesave_surongrong_0';

// Run save logic inside VM to avoid scope issues
vm.runInContext('\
gameState.activeTemplate = FALLBACK_TEMPLATE;\
gameState.activeSaveId = "surongrong";\
gameState.gameStarted = true;\
gameState.fullHistory = [\
  {role:"user",content:"开始游戏"},{role:"assistant",content:"AI回复第1回合..."},\
  {role:"user",content:"选1"},{role:"assistant",content:"AI回复第2回合..."},\
];\
gameState.currentOptions = [{action:"测试",cost:"低风险"}];\
gameState.achievementFlags.triggeredEndings = ["月光和六便士"];\
gameState.fieldHistory = { stress: { current: 50, max: 50 } };\
saveGameState(0);\
', ctx);

var sv = JSON.parse(ctx.localStorage.getItem(svKey));
check('存档写入', !!sv);
if (!sv) {
  console.error('  DEBUG: localStorage keys present: ' + JSON.stringify(Object.keys(store)));
  // Try direct save
  ctx.localStorage.setItem(svKey, JSON.stringify({test:1}));
  console.error('  DEBUG: direct localStorage write works: ' + !!ctx.localStorage.getItem(svKey));
}
check('fullHistory', sv && sv.fullHistory && sv.fullHistory.length === 4);
check('triggeredEndings保存', sv && sv.achievementFlags && sv.achievementFlags.triggeredEndings.length === 1);
check('dataVersion=2', sv && sv.dataVersion === 2);

var ld = loadGameState('surongrong', 0);
check('读档成功', !!ld && ld.fullHistory.length === 4);

var info = getSaveInfo('surongrong');
check('getSaveInfo', info && info.roundNumber > 0 && info.hasSave);

// 截断保留摘要
vm.runInContext('\
var longHistory = [];\
for (var i = 0; i < 70; i++) longHistory.push({role:"user",content:"msg"+i});\
gameState.fullHistory = longHistory;\
gameState.summary = "重要摘要不应丢弃";\
gameState.summarisedCount = 20;\
saveGameState(0);\
', ctx);
var svLong = JSON.parse(ctx.localStorage.getItem(svKey));
check('截断保留摘要', svLong && svLong.summary === '重要摘要不应丢弃');
check('截断后summarisedCount=0', svLong && svLong.summarisedCount === 0);

// ═══════ 10. 结局注入 ═══════
console.log('\n═══ 10. 结局注入 ═══');
var inj = buildEndingInjection('月光和六便士', tpl);
check('注入含★', inj.indexOf('★ 命运转折回合 ★') >= 0);
check('注入含结局名', inj.indexOf('月光和六便士') >= 0);
check('注入>100字', inj.length > 100);
// 注入文本中含"不要在命运转折叙事中提及魂师大赛"（这是对AI的指令，不是bug）
check('注入是月光和六便士专用', inj.indexOf('月光和六便士') > 0);
check('不存在结局→后备', buildEndingInjection('不存在', tpl).length > 30);

// detectEnding
check('detect标准格式', detectEnding('【命运转折·月光和六便士】末尾') === '月光和六便士');
check('detect冒号变体', detectEnding('【命运转折：枯萎之刻】') === '枯萎之刻');
check('detect半角括号', detectEnding('[命运转折·归乡]') === '归乡');
check('detect无结局→null', detectEnding('普通文本') === null);

// ═══════ 11. 进度条 ═══════
console.log('\n═══ 11. 进度条计算 ═══');
ctx.gameState.fieldHistory = {
  stress: { current: 50, max: 50 },
  intel: { current: 4, max: 4 },
  shenglingjiao: { current: -30, max: 0 },
  exposure: { current: 15, max: 18 },
};
var prog1 = getAchievementProgress('情报拼图');
check('进度:情报4/5', prog1 && prog1.current === 4 && prog1.target === 5);
var prog2 = getAchievementProgress('圣灵教之影');
check('进度:觊觎-30/-50', prog2 && prog2.current === -30 && prog2.target === -50);
var prog3 = getAchievementProgress('潜行大师');
check('进度:暴露max=18≤20达成', prog3 && prog3.current === 20);
ctx.gameState.fieldHistory.exposure.max = 25;
check('进度:暴露max=25>20→0%', getAchievementProgress('潜行大师').current === 0);

// ═══════ 12. 守卫验证 ═══════
console.log('\n═══ 12. endingTriggered / _loadingSave 守卫 ═══');
ctx.localStorage.setItem(ak, '{}');
ctx.gameState.achievementFlags.endingTriggered = false;
ctx.gameState._loadingSave = true;
checkAchievementsFromState({ fields: { blackmail: '5' } });
check('_loadingSave跳过成就', Object.keys(JSON.parse(ctx.localStorage.getItem(ak) || '{}')).length === 0);

ctx.gameState._loadingSave = false;
ctx.gameState.fullHistory = [{role:'user',content:'开始'}];
checkAchievementsFromState({ fields: { blackmail: '5' } });
check('roundNum<2跳过成就', Object.keys(JSON.parse(ctx.localStorage.getItem(ak) || '{}')).length === 0);

// ═══════ 13. promptBody→endings ═══════
console.log('\n═══ 13. promptBody→endings 迁移 ═══');
var sec = tpl.promptBody.match(/【命运转折系统】[\s\S]*?(?=【(?!命运转折|游戏结束)[^】]+】|$)/);
var parsedEndings = sec ? parseEndingsFromPromptBody(sec[0]) : [];
check('解析≥6个', parsedEndings.length >= 6);
check('含月光和六便士', parsedEndings.some(function(e) { return e.name === '月光和六便士'; }));
check('含condition', parsedEndings.every(function(e) { return !!e.condition; }));

var genSec = generateEndingsSection(parsedEndings);
check('生成含章节标题', genSec.indexOf('【命运转折系统】') === 0);
check('生成≥6个命运转折', (genSec.match(/命运转折\d+/g) || []).length >= 6);

// ═══════ 14. buildSystemPrompt ═══════
console.log('\n═══ 14. buildSystemPrompt ═══');
ctx.gameState.fieldHistory = { stress: { current: 22, max: 22 }, exposure: { current: 12, max: 12 } };
var prompt = buildSystemPrompt(tpl);
check('系统提示词>5000字', prompt && prompt.length > 5000);
check('含叙事法则', prompt.indexOf('叙事法则') > 0);
check('含状态快照', prompt.indexOf('压力值=22') > 0);
check('状态快照含暴露', prompt.indexOf('暴露风险=12') > 0);

// ═══════ 15. 边界条件 ═══════
console.log('\n═══ 15. 结局边界条件 ═══');
check('空template→[]', collectEligibleEndings(null).length === 0);

ctx.gameState.fieldHistory = {
  stress: { current: 95, max: 95 },
  exposure: { current: 50, max: 50 },
  intel: { current: 5, max: 5 },
  blackmail: { current: 5, max: 5 },
  mengHaoGan: { current: 70, max: 70 },
  round: { current: 8, max: 8 },
  infiltration: { current: 3, max: 3 },
};
ctx.gameState.achievementFlags.triggeredEndings = [];
ctx.gameState.fullHistory = [];
for (var j = 0; j < 10; j++) { ctx.gameState.fullHistory.push({role:'user'}); ctx.gameState.fullHistory.push({role:'assistant'}); }

var boundary = collectEligibleEndings(tpl);
check('压力=95触发(边界)', boundary.some(function(e) { return e.name === '月光和六便士'; }));
check('暴露=50不触发枯萎之刻', !boundary.some(function(e) { return e.name === '枯萎之刻'; }));

// 空condition不触发
var tplCopy = JSON.parse(JSON.stringify(tpl));
tplCopy.endings.push({ name: '无条件', condition: '', narrative: '', icon: '🎭' });
ctx.gameState.activeTemplate = tplCopy;
check('空condition不触发', !collectEligibleEndings(tplCopy).some(function(e) { return e.name === '无条件'; }));
ctx.gameState.activeTemplate = tpl;

// ═══════ 汇总 ═══════
console.log('\n' + '='.repeat(55));
console.log((failed.length > 0 ? '\x1b[31m' : '\x1b[32m') + passed.length + ' passed, ' + failed.length + ' failed, ' + (passed.length + failed.length) + ' total\x1b[0m');
if (failed.length > 0) {
  console.log('\n失败项:');
  failed.forEach(function(f) { console.log('  \x1b[31m❌\x1b[0m ' + f); });
  process.exit(1);
} else {
  console.log('\n🎮 全流程模拟测试通过！');
}
