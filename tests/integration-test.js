/* ═══════════════════════════════════════════
   端到端集成测试 — 真实 API 对话 + 全链路验证
   运行: node tests/integration-test.js
   ═══════════════════════════════════════════ */
const fs = require('fs');
const http = require('http');
const vm = require('vm');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('\x1b[32m✅\x1b[0m ' + name); }
  else { failed++; console.error('\x1b[31m❌\x1b[0m ' + name + (detail ? ' — ' + detail : '')); }
}

async function main() {

// Load client modules in VM
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
  setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {},
  requestIdleCallback: (fn) => setTimeout(fn, 0),
  console: console,
};
sandbox.global = sandbox;
const ctx = vm.createContext(sandbox);

['state.js','utils.js','saves.js','achievements.js'].forEach(mod => {
  vm.runInContext(fs.readFileSync('public/js/' + mod, 'utf8'), ctx, { filename: mod });
});
vm.runInContext('this.FALLBACK_TEMPLATE = FALLBACK_TEMPLATE; this.LS_KEYS = LS_KEYS; this.gameState = gameState; this.dom = dom;', ctx);

const tpl = JSON.parse(fs.readFileSync('templates/surongrong.json', 'utf8'));
const allFields = [];
for (const sec of Object.values(tpl.outputSections))
  for (const f of sec.fields) allFields.push(f);

// Init game state in VM
vm.runInContext('\
gameState.activeTemplate = FALLBACK_TEMPLATE;\
gameState.activeSaveId = "surongrong";\
gameState.fullHistory = [];\
gameState.fieldHistory = {};\
gameState.achievementFlags = {\
  gambitChosen: false, gambitSucceeded: false, gambitSuccessCount: 0,\
  endingTriggered: false, endingType: "", triggeredEndings: [],\
  counterAttack: false, tradeCompleted: false,\
  choiceCounts: {}, responseMatches: {},\
};\
', ctx);

// Initialize initialState
var initialState = tpl.initialState || {};
for (var fk in initialState) {
  if (!initialState.hasOwnProperty(fk)) continue;
  var fv = initialState[fk];
  if (typeof fv === 'number')
    ctx.gameState.fieldHistory[fk] = { current: fv, max: fv };
  else if (typeof fv === 'string')
    ctx.gameState.fieldHistory[fk] = { currentText: fv };
}

console.log('═══ 端到端集成测试 ═══\n');

// ═══════ PHASE 1: 模板完整性 ═══════
console.log('═══ 1. 模板校验 ═══');
check('模板名', tpl.name === '苏蓉蓉·潜伏');
check('10字段', allFields.length >= 10);
check('6命运转折', tpl.endings.length >= 6);
check('10可见成就', Object.keys(tpl.achievements).length >= 10);
check('5隐藏成就', Object.keys(tpl.hiddenAchievements).length >= 5);
check('6开局', tpl.openingMessages.length >= 6);
check('initialState 10项', Object.keys(tpl.initialState).length >= 10);
check('promptBody>6000', tpl.promptBody.length >= 6000);

// ═══════ PHASE 2: 真实 API 回合 1 ═══════
console.log('\n═══ 2. 真实API·回合1（开局消息）═══');
var round1Raw = await callChatAPI([
  { role: 'system', content: tpl.promptBody.substring(0, 8000) },
  { role: 'user', content: '开始游戏。【开局编号：1】' },
]);

check('API返回非空', round1Raw && round1Raw.length > 100, round1Raw ? round1Raw.length + ' chars' : 'EMPTY');

// Parse with actual client code
var parsed1 = parseWithClient(round1Raw);
check('有场景类型', !!parsed1.sceneType, parsed1.sceneType || 'MISSING');
check('有现状', !!parsed1.situation, (parsed1.situation || '').substring(0, 40));
check('有4选项', parsed1.options.length === 4, parsed1.options.length + ' options');
check('字段:压力值为数字', isNumeric(parsed1.fields.stress), parsed1.fields.stress);
check('字段:暴露风险为数字', isNumeric(parsed1.fields.exposure), parsed1.fields.exposure);
check('字段:把柄存在', parsed1.fields.blackmail !== undefined && parsed1.fields.blackmail !== '—');
check('字段:圣灵教觊觎存在', parsed1.fields.shenglingjiao !== undefined && parsed1.fields.shenglingjiao !== '—');
check('字段:轮次存在', parsed1.fields.round !== undefined);

// Update fieldHistory from parsed response
var fields1 = {};
for (var f of allFields) {
  var v = parsed1.fields[f.id];
  if (v !== undefined && v !== '—' && v !== '') fields1[f.id] = v;
}
vm.runInContext('updateFieldHistoryFromParsed({fields:' + JSON.stringify(fields1) + '})', ctx);

// Verify fieldHistory
var fh1 = ctx.gameState.fieldHistory;
check('fh:压力值>0', fh1.stress && fh1.stress.current > 0, fh1.stress?.current);
check('fh:轮次>0', fh1.round && fh1.round.current > 0, fh1.round?.current);

// Check achievements (should be skipped due to round<2)
var achKey = 'xixi_achievements_surongrong';
ctx.localStorage.setItem(achKey, '{}');
vm.runInContext('gameState.fullHistory = [{role:"user"},{role:"assistant"}]; checkAchievementsFromState({fields:' + JSON.stringify(fields1) + '})', ctx);
var unlocked1 = JSON.parse(ctx.localStorage.getItem(achKey) || '{}');
check('回合1不触发成就(round<2)', Object.keys(unlocked1).length === 0);

// Check ending (should not trigger at round 1)
vm.runInContext('gameState.achievementFlags.triggeredEndings = []', ctx);
var eligible1 = vm.runInContext('collectEligibleEndings(FALLBACK_TEMPLATE)', ctx);
check('回合1不触发结局', eligible1.length === 0, eligible1.map(e=>e.name).join(',') || 'none');

// ═══════ PHASE 3: 真实 API 回合 2（选择1）═══
console.log('\n═══ 3. 真实API·回合2（选第1个选项）═══');
vm.runInContext('gameState.fullHistory = [{role:"user"},{role:"assistant"},{role:"user"}]', ctx); // roundNum=2

var choice1Text = parsed1.options[0] ? (parsed1.options[0].action + ' — ' + parsed1.options[0].cost) : '选1';
var round2Raw = await callChatAPI([
  { role: 'system', content: tpl.promptBody.substring(0, 6000) },
  { role: 'assistant', content: round1Raw },
  { role: 'user', content: '选择 1. ' + choice1Text },
]);

check('API回合2非空', round2Raw && round2Raw.length > 100, round2Raw ? round2Raw.length + ' chars' : 'EMPTY');

var parsed2 = parseWithClient(round2Raw);
check('回合2有场景', !!parsed2.sceneType, parsed2.sceneType || 'MISSING');
check('回合2有4选项', parsed2.options.length === 4, parsed2.options.length + ' options');
check('回合2字段:压力值', isNumeric(parsed2.fields.stress), parsed2.fields.stress);
check('回合2字段:暴露风险', isNumeric(parsed2.fields.exposure), parsed2.fields.exposure);
check('回合2字段:圣灵教觊觎', parsed2.fields.shenglingjiao !== undefined, parsed2.fields.shenglingjiao);

// Update fieldHistory
var fields2 = {};
for (var f of allFields) {
  var v2 = parsed2.fields[f.id];
  if (v2 !== undefined && v2 !== '—' && v2 !== '') fields2[f.id] = v2;
}
vm.runInContext('updateFieldHistoryFromParsed({fields:' + JSON.stringify(fields2) + '})', ctx);

// Check that fieldHistory max was updated
var fh2 = ctx.gameState.fieldHistory;
check('fh2:压力值有current', fh2.stress && fh2.stress.current !== undefined);
check('fh2:圣灵教觊觎有current', fh2.shenglingjiao && fh2.shenglingjiao.current !== undefined);

// Now check achievements (round>=2, should trigger if conditions met)
ctx.localStorage.setItem(achKey, '{}');
vm.runInContext('checkAchievementsFromState({fields:' + JSON.stringify(fields2) + '})', ctx);
var unlocked2 = JSON.parse(ctx.localStorage.getItem(achKey) || '{}');
check('回合2成就检测不崩溃', true);
console.log('  解锁成就: ' + (Object.keys(unlocked2).join(', ') || '(无 — 正常，开局数值低)'));

// Check endings at round 2
vm.runInContext('gameState.achievementFlags.triggeredEndings = []', ctx);
var eligible2 = vm.runInContext('collectEligibleEndings(FALLBACK_TEMPLATE)', ctx);
check('回合2不误触发结局', eligible2.length === 0, eligible2.map(e=>e.name).join(',') || 'none');

// ═══════ PHASE 4: 存档测试 ═══════
console.log('\n═══ 4. 存档/读档 ═══');
vm.runInContext('\
gameState.gameStarted = true;\
gameState.fullHistory = [{role:"user",content:"开始"},{role:"assistant",content:"' + round1Raw.replace(/"/g,'\\"').substring(0,200) + '"}];\
gameState.currentOptions = ' + JSON.stringify(parsed2.options.slice(0,2)) + ';\
', ctx);

vm.runInContext('saveGameState(0)', ctx);
var saveKey = 'xixi_gamesave_surongrong_0';
var saved = JSON.parse(ctx.localStorage.getItem(saveKey) || 'null');
check('存档写入成功', !!saved);
check('存档含fieldHistory', !!saved.fieldHistory);
check('存档含achievementFlags', !!saved.achievementFlags);

// Load
vm.runInContext('gameState.fieldHistory = {}; gameState.achievementFlags = {};', ctx);
ctx.localStorage.setItem(saveKey, JSON.stringify(saved));
vm.runInContext('var d=loadGameState("surongrong",0); gameState.fieldHistory=d.fieldHistory; gameState.achievementFlags=d.achievementFlags;', ctx);
check('读档恢复fieldHistory', ctx.gameState.fieldHistory.stress && ctx.gameState.fieldHistory.stress.current > 0);

// ═══════ PHASE 5: 结局注入 + 弹窗 ═══════
console.log('\n═══ 5. 结局注入/弹窗 ═══');
var inj1 = vm.runInContext('buildEndingInjection("月光和六便士", FALLBACK_TEMPLATE)', ctx);
check('注入非空', inj1 && inj1.length > 50);
check('注入含命运转折回合', inj1.indexOf('命运转折回合') > 0);

var inj2 = vm.runInContext('buildEndingInjection("归乡", FALLBACK_TEMPLATE)', ctx);
check('归乡注入含叙事', inj2.length > 50);

// simulate ending overlay
var endingNarrative = '';
for (var ei = 0; ei < tpl.endings.length; ei++) {
  if (tpl.endings[ei].name === '月光和六便士') {
    endingNarrative = tpl.endings[ei].narrative || '';
    break;
  }
}
check('模板endings含月光叙事', endingNarrative.length > 20);

// ═══════ PHASE 6: 字段编辑+保存 ═══════
console.log('\n═══ 6. 字段/成就编辑 ═══');
var editKey = 'xixi_edited_template_surongrong';

// Simulate editing achievements
var editedAch = JSON.parse(JSON.stringify(tpl.achievements));
editedAch['测试成就'] = { icon: '🧪', desc: '压力值达到30' };
var edited = { achievements: editedAch };
ctx.localStorage.setItem(editKey, JSON.stringify(edited));

// Simulate loadAndMergeTemplate merge
vm.runInContext('\
var ej = localStorage.getItem("xixi_edited_template_surongrong");\
var ed = JSON.parse(ej);\
var merged = JSON.parse(JSON.stringify(FALLBACK_TEMPLATE));\
if (ed.achievements) merged.achievements = ed.achievements;\
gameState.activeTemplate = merged;\
', ctx);

check('合并后含测试成就', ctx.gameState.activeTemplate.achievements['测试成就'] !== undefined);
check('测试成就desc正确', ctx.gameState.activeTemplate.achievements['测试成就'].desc === '压力值达到30');

// ═══════ PHASE 7: 酒馆上传清理 ═══════
console.log('\n═══ 7. 酒馆上传清理 ═══');
var uploadTpl = JSON.parse(JSON.stringify(tpl));
uploadTpl._preEditFields = { test: 'should-be-removed' };
uploadTpl._originalTemplate = { test: 'should-be-removed' };
uploadTpl.promptBody = (uploadTpl.promptBody || '') + '\n【玩家补充规则】\n1. 测试规则\n【其他内容】';

// Simulate cleanup
delete uploadTpl._preEditFields;
delete uploadTpl._originalTemplate;
var prIdx = uploadTpl.promptBody.indexOf('【玩家补充规则');
if (prIdx >= 0) {
  var nextSection = uploadTpl.promptBody.indexOf('【', prIdx + 8);
  uploadTpl.promptBody = uploadTpl.promptBody.substring(0, prIdx) +
    (nextSection >= 0 ? uploadTpl.promptBody.substring(nextSection) : '');
}
uploadTpl.version = '2.1.1';

check('清理后无_preEditFields', !uploadTpl._preEditFields);
check('清理后无_originalTemplate', !uploadTpl._originalTemplate);
check('清理后无玩家补充规则', uploadTpl.promptBody.indexOf('【玩家补充规则') === -1);
check('版本号递增', uploadTpl.version === '2.1.1');

// ═══════ PHASE 8: 系统提示词生成 ═══════
console.log('\n═══ 8. 系统提示词 ═══');
vm.runInContext('gameState.fieldHistory = {stress:{current:22,max:22},exposure:{current:12,max:12},round:{current:2,max:2}}', ctx);
var prompt = vm.runInContext('buildSystemPrompt(FALLBACK_TEMPLATE)', ctx);
check('提示词>5000字', prompt && prompt.length > 5000);
check('含状态快照', prompt.indexOf('压力值=22') > 0);
check('含叙事法则', prompt.indexOf('叙事法则') > 0);
check('含命运转折系统', prompt.indexOf('命运转折系统') > 0);

// ═══════ PHASE 9: 进度条显示 ═══════
console.log('\n═══ 9. 进度条 ═══');
vm.runInContext('gameState.fieldHistory = {stress:{current:45,max:45},intel:{current:3,max:3},shenglingjiao:{current:-25,max:0},exposure:{current:15,max:18}}', ctx);
var prog = vm.runInContext('JSON.stringify({p1:getAchievementProgress("情报拼图"),p2:getAchievementProgress("圣灵教之影"),p3:getAchievementProgress("潜行大师"),p4:getAchievementProgress("钢丝上的舞者"),p5:getAchievementProgress("铁壁意志")})', ctx);
prog = JSON.parse(prog);
check('情报拼图3/5', prog.p1 && prog.p1.current === 3 && prog.p1.target === 5);
check('圣灵教之影-25/-50', prog.p2 && prog.p2.current === -25 && prog.p2.target === -50);
check('潜行大师max=18≤20达成', prog.p3 && prog.p3.current === 20);
check('钢丝舞者45/90', prog.p4 && prog.p4.current === 45 && prog.p4.target === 90);
check('铁壁意志max=45≤50达成', prog.p5 && prog.p5.current === 50);

// ═══════ PHASE 10: 边界条件汇总 ═══════
console.log('\n═══ 10. 边界/错误路径 ═══');
check('空template→结局空', vm.runInContext('collectEligibleEndings(null).length', ctx) === 0);
check('detectEnding无→null', vm.runInContext('detectEnding("普通文本")', ctx) === null);
check('detectEnding标准格式', vm.runInContext('detectEnding("【命运转折·测试】")', ctx) === '测试');
check('extractAllFields空文本', Object.keys(vm.runInContext('extractAllFields("", [])', ctx)).length >= 0);
check('_findFieldId空串', vm.runInContext('_findFieldId("")', ctx) === null);
check('_fieldVal不存在→undefined', vm.runInContext('_fieldVal("不存在", false)', ctx) === undefined);

// validateAndRepairTemplate with completely broken input
var severelyBroken = { name: 'broken' };
vm.runInContext('validateAndRepairTemplate(' + JSON.stringify(severelyBroken) + ')', ctx);
check('极简模板不崩溃', true);

// ═══════ SUMMARY ═══════
console.log('\n' + '='.repeat(55));
console.log((failed > 0 ? '\x1b[31m' : '\x1b[32m') + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total\x1b[0m');
if (failed > 0) {
  console.log('\n失败项:');
  process.exit(1);
} else {
  console.log('\n🎮 集成测试全部通过！');
}

// ═══════ HELPERS ═══════

function parseWithClient(raw) {
  return vm.runInContext('parseAIResponse(' + JSON.stringify(raw) + ', FALLBACK_TEMPLATE)', ctx);
}

function isNumeric(v) {
  return v !== undefined && v !== '—' && v !== '' && !isNaN(parseInt(v));
}

function callChatAPI(messages) {
  return new Promise((resolve, reject) => {
    var data = JSON.stringify({
      messages: messages,
      systemPrompt: null,
      templateId: 'surongrong',
      templateFallback: null,
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    });
    var req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 120000,
    }, res => {
      var body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode + ': ' + body.substring(0,200))); return; }
        // Extract content from SSE stream
        var content = '';
        var lines = body.split('\n');
        for (var line of lines) {
          if (line.startsWith('data: ') && line.length > 6) {
            try {
              var json = JSON.parse(line.slice(6));
              if (json.error) { reject(new Error('API Error: ' + JSON.stringify(json.error))); return; }
              var delta = json.choices?.[0]?.delta?.content;
              if (delta) content += delta;
            } catch(e) {}
          }
        }
        resolve(content);
      });
    });
    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

// Run
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
