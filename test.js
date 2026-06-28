/* ═══════════════════════════════════════════
   服务端自动化测试 — 运行: node test.js
   ═══════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const http = require('http');

const JS_DIR = path.join(__dirname, 'public', 'js');
const MODULES = [
  'state.js', 'utils.js', 'dialogs.js', 'saves.js', 'ui.js',
  'achievements.js', 'prompts.js', 'templates.js', 'tavern.js',
  'ai.js', 'core.js', 'init.js',
];

let passed = 0, failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log('\x1b[32m✅\x1b[0m ' + name); }
  else { failed++; console.error('\x1b[31m❌\x1b[0m ' + name + (detail ? ' — ' + detail : '')); }
}

async function run() {

// ═══════════ 1. 文件存在 + 大小合理 ═══════════
console.log('\n═══ 文件检查 ═══');
for (const f of MODULES) {
  const fp = path.join(JS_DIR, f);
  const exists = fs.existsSync(fp);
  const size = exists ? fs.statSync(fp).size : 0;
  check(f, exists && size > 500, size + ' bytes');
}

const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const scriptCount = (indexHtml.match(/src="js\//g) || []).length;
check('index.html script tags', scriptCount === 13, scriptCount + ' modules referenced');
check('index.html no app.js', !indexHtml.includes('src="app.js"'));

// ═══════════ 2. 括号平衡 ═══════════
console.log('\n═══ 括号平衡 ═══');
// 注: utils.js / core.js 的正则中含大量 [ ]，朴素计数会有误报（CLAUDE.md 已记录）
for (const f of MODULES) {
  const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  const braces = (code.match(/\{/g) || []).length === (code.match(/\}/g) || []).length;
  const parens = (code.match(/\(/g) || []).length === (code.match(/\)/g) || []).length;
  const brackets = (code.match(/\[/g) || []).length === (code.match(/\]/g) || []).length;
  check(f + ' brackets', braces && parens && brackets);
}

// ═══════════ 3. 加载顺序 + 函数声明检查 ═══════════
console.log('\n═══ 模块函数声明 ═══');
const moduleExports = {};

for (const f of MODULES) {
  const code = fs.readFileSync(path.join(JS_DIR, f), 'utf8');
  const funcs = [...code.matchAll(/^function\s+(\w+)/gm)].map(m => m[1]);
  const consts = [...code.matchAll(/^(?:const|let|var)\s+(\w+)/gm)].map(m => m[1]);
  moduleExports[f.replace('.js', '')] = { funcs, consts };
}

const loadOrder = MODULES.map(f => f.replace('.js', ''));
const DATA_ONLY = ['state']; // 纯数据模块，不导出函数
for (const mod of loadOrder) {
  const info = moduleExports[mod] || { funcs: [], consts: [] };
  const total = info.funcs.length + info.consts.length;
  if (DATA_ONLY.includes(mod)) {
    check(mod + ' exports', info.consts.length > 0, info.consts.length + ' consts (data module)');
  } else {
    check(mod + ' exports', info.funcs.length > 0, info.funcs.length + ' functions');
  }
}

// ═══════════ 4. emoji picker ═══════════
console.log('\n═══ Emoji 选择器 ═══');
const dialogs = fs.readFileSync(path.join(JS_DIR, 'dialogs.js'), 'utf8');
check('pickEmoji defined', dialogs.includes('function pickEmoji'));
check('EMOJI_LIST', dialogs.includes('EMOJI_LIST'));

// ═══════════ 5. autocomplete=off ═══════════
console.log('\n═══ autocomplete=off ═══');
const inputTags = [...indexHtml.matchAll(/<input\s[^>]*>/g)].map(m => m[0]);
let acOff = 0, acMissing = 0;
for (const tag of inputTags) {
  if (tag.includes('autocomplete="off"')) acOff++;
  else { acMissing++; console.warn('  \x1b[33m⚠\x1b[0m ' + tag.substring(0, 60) + '...'); }
}
check('autocomplete=off', acMissing === 0, acOff + '/' + inputTags.length + ' inputs OK');

// ═══════════ 6. Service Worker ═══════════
console.log('\n═══ Service Worker ═══');
const sw = fs.readFileSync(path.join(__dirname, 'public', 'sw.js'), 'utf8');
check('sw.js filters POST', sw.includes("method !== 'GET'"));
check('sw.js cache v11', sw.includes('xixi-v11'));

// ═══════════ 7. 关键 bug 修复验证 ═══════════
console.log('\n═══ Bug 修复验证 ═══');

const uiCode = fs.readFileSync(path.join(JS_DIR, 'ui.js'), 'utf8');
check('selectSave uses loadAndMergeTemplate', uiCode.includes('loadAndMergeTemplate'));

const promptsCode = fs.readFileSync(path.join(JS_DIR, 'prompts.js'), 'utf8');
check('openSettings merges edits', promptsCode.includes('ed.promptBody') && promptsCode.includes('ed.outputSections'));
check('openSettings no full replace', !promptsCode.includes('gameState.activeTemplate = JSON.parse(savedTpl)'));
check('resetPrompt uses _originalTemplate', promptsCode.includes('_originalTemplate'));

const achCode = fs.readFileSync(path.join(JS_DIR, 'achievements.js'), 'utf8');
check('achievements round guard', achCode.includes('roundNum < 2'));

const tplCode = fs.readFileSync(path.join(JS_DIR, 'templates.js'), 'utf8');
check('saveFields preserves type', tplCode.includes("origField?.type"));
check('field emoji picker button', tplCode.includes("btn-pick-emoji"));

const stateCode = fs.readFileSync(path.join(JS_DIR, 'state.js'), 'utf8');
check('state has _originalTemplate', stateCode.includes('_originalTemplate'));

const coreCode = fs.readFileSync(path.join(JS_DIR, 'core.js'), 'utf8');
check('continueGame uses loadAndMergeTemplate', coreCode.includes('loadAndMergeTemplate'));
check('continueGame sets _loadingSave', coreCode.includes('_loadingSave = true'));
check('continueGame clears _loadingSave', coreCode.includes('_loadingSave = false'));

// achievements double-guard
const achCode2 = fs.readFileSync(path.join(JS_DIR, 'achievements.js'), 'utf8');
check('achievements _loadingSave guard', achCode2.includes('_loadingSave'));

// help text no password leak
check('help no admin password', !indexHtml.includes('admin123'));

// option resource detection robustness
const uiCode2 = fs.readFileSync(path.join(JS_DIR, 'ui.js'), 'utf8');
check('option resource NaN guard', uiCode2.includes('typeof cur !== \'number\' || isNaN(cur)'));

// tavern upload merges edits
const tavernCode = fs.readFileSync(path.join(JS_DIR, 'tavern.js'), 'utf8');
check('tavern upload merges edited template', tavernCode.includes('LS_KEYS.editedTemplate'));
check('tavern upload uses uploadTemplate', tavernCode.includes('uploadTemplate'));

// ── v3 新增: 音效函数检查 ──
const audioCode = fs.readFileSync(path.join(JS_DIR, 'audio.js'), 'utf8');
check('audio playUIClick defined', audioCode.includes('function playUIClick'));
check('audio playClick defined', audioCode.includes('function playClick'));
check('audio playAchievement defined', audioCode.includes('function playAchievement'));
check('audio _safeCtx used', audioCode.includes('_safeCtx()'));

// ── v3 新增: 结局系统检查 ──
const utilsCode2 = fs.readFileSync(path.join(JS_DIR, 'utils.js'), 'utf8');
check('utils buildEndingInjection', utilsCode2.includes('function buildEndingInjection'));
check('utils collectEligibleEndings', utilsCode2.includes('function collectEligibleEndings'));
check('utils selectBestEnding', utilsCode2.includes('function selectBestEnding'));
check('utils repairEndingSection v2', utilsCode2.includes('missingMarkers'));
check('core uses buildEndingInjection', coreCode.includes('buildEndingInjection'));
check('core has triggeredEndings', coreCode.includes('triggeredEndings'));
check('state has triggeredEndings', stateCode.includes('triggeredEndings'));

// ── v3 新增: 模板结局完整性 ──
const surongrongRaw = fs.readFileSync(path.join(__dirname, 'templates', 'surongrong.json'), 'utf8');
const srTpl = JSON.parse(surongrongRaw);
const srBody = srTpl.promptBody || '';
const endingMarkers = srBody.match(/【(?:游戏结束|命运转折)[^】]+】/g) || [];
check('surongrong has 6 ending markers', endingMarkers.length >= 6, endingMarkers.length + ' endings found');
let endingsWithDesc = 0;
for (const marker of endingMarkers) {
  const idx = srBody.indexOf(marker);
  const before = srBody.substring(Math.max(0, idx - 50), idx);
  if (before.trim().length > 5) endingsWithDesc++;
}
check('surongrong ending descriptions', endingsWithDesc >= 5, endingsWithDesc + ' endings have descriptions');

// ── v3 新增: openSettings fieldHistory 初始化 ──
check('openSettings init fieldHistory', promptsCode.includes("gameState.fieldHistory[f.id]") && promptsCode.includes("f.type === 'number'"));

// ── v3 新增: ui.js 使用 nullish coalescing ──
check('ui use nullish coalescing', uiCode.includes("?? '—'"));

// ── v4 新增: 全局函数命名冲突检查 ──
console.log('\n═══ 全局函数命名 ═══');
var allFuncs = [];
for (var f = 0; f < MODULES.length; f++) {
  var mcode = fs.readFileSync(path.join(JS_DIR, MODULES[f]), 'utf8');
  var fns = [...mcode.matchAll(/^function\s+(\w+)/gm)].map(function(mm) { return mm[1]; });
  for (var fn = 0; fn < fns.length; fn++) {
    allFuncs.push({ name: fns[fn], module: MODULES[f] });
  }
}
var nameMap = {};
var conflicts = [];
for (var n = 0; n < allFuncs.length; n++) {
  var entry = allFuncs[n];
  if (nameMap[entry.name] && nameMap[entry.name] !== entry.module) {
    conflicts.push(entry.name + ' (in ' + nameMap[entry.name] + ' and ' + entry.module + ')');
  }
  nameMap[entry.name] = entry.module;
}
check('no cross-module function name conflicts', conflicts.length === 0, conflicts.length > 0 ? conflicts.join('; ') : '');

// ═══════════ 8. 服务器 HTTP 检查 ═══════════
console.log('\n═══ 服务器 ═══');
try {
  const serverReady = await new Promise((resolve) => {
    const req = http.get('http://localhost:3000/js/state.js', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
  if (serverReady) {
    check('server :3000', true, 'running');
  } else {
    console.log('\x1b[33m⚠\x1b[0m server :3000 — not started (npm start 后重试)');
  }
} catch (e) {
  console.log('  \x1b[33m⚠\x1b[0m 服务器检查跳过: ' + e.message);
}

// ═══════════ 汇总 ═══════════
console.log('\n' + '═'.repeat(50));
console.log((failed > 0 ? '\x1b[31m' : '\x1b[32m') + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total\x1b[0m');
if (failed > 0) {
  console.log('\n❌ 有 ' + failed + ' 项失败');
  process.exitCode = 1;
} else {
  console.log('\n✅ 全部通过！');
}

}

run();

