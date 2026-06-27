/* ═══════════════════════════════════════════
   结局系统完整测试套件 — 运行: node tests/ending-system.test.js
   覆盖 7 个核心函数 × 40+ 测试用例
   ═══════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

// ── 加载模板 ──
const srTpl = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'templates', 'surongrong.json'), 'utf8'
));
const origSrTpl = JSON.parse(JSON.stringify(srTpl));

// ═══════════════════════════════════════════
//  从源码提取的纯函数（Node环境可运行）
// ═══════════════════════════════════════════

// ── HTML转义 ──
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 检测结局标记 ──
function detectEnding(text) {
  // 兼容新旧两种标记格式
  var em = text.match(/【(?:游戏结束|命运转折)\s*[：:·—\-–]*\s*(.+?)】/);
  if (!em) em = text.match(/\[(?:游戏结束|命运转折)\s*[：:·—\-–]*\s*(.+?)\]/);
  return em ? em[1].trim() : null;
}

// ── 结局章节修复 ──
function repairEndingSection(body, originalTemplate) {
  if (!body || !originalTemplate) return body;
  var origBody = originalTemplate.promptBody || '';
  // 兼容新旧两种章节标题格式
  var origEm = origBody.match(/【(?:结局系统|命运转折系统)】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/)
    || origBody.match(/【结局系统】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/);
  if (!origEm) return body;
  var em = body.match(/【(?:结局系统|命运转折系统)】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/)
    || body.match(/【结局系统】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/);
  if (!em) {
    console.log('🔧 repairEndingSection: 结局/命运转折章节完全缺失，从原始模板恢复');
    return body + '\n\n' + origEm[0];
  }
  var endingMarkerRe = /【(?:游戏结束|命运转折)[：:·\s]*([^】]+)】/g;
  var origMarkers = [];
  var m;
  while ((m = endingMarkerRe.exec(origEm[0])) !== null) origMarkers.push(m[0]);
  endingMarkerRe.lastIndex = 0;
  if (origMarkers.length === 0) return body;
  var missingMarkers = [];
  for (var i = 0; i < origMarkers.length; i++) {
    if (body.indexOf(origMarkers[i]) === -1) missingMarkers.push(origMarkers[i]);
  }
  if (missingMarkers.length === 0) return body;
  console.warn('🔧 repairEndingSection: 检测到 ' + missingMarkers.length + ' 个结局/命运转折标记缺失');
  return body.replace(em[0], origEm[0]);
}

// ── 收集达标结局 ──
function collectEligibleEndings(template, fieldHistory, fullHistory) {
  if (!template) return [];
  var body = template.promptBody || '';
  var fh = fieldHistory || {};

  // 构建 label→当前数值 映射
  var vals = {};
  var allSecs = template.outputSections || {};
  for (var sk in allSecs) {
    if (!allSecs.hasOwnProperty(sk)) continue;
    var fs = allSecs[sk].fields || [];
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      var h = fh[f.id];
      if (!h) continue;
      var v = (h.current != null) ? Number(h.current) : NaN;
      if (isNaN(v) && h.currentText && h.currentText !== '—') v = Number(h.currentText);
      if (!isNaN(v)) vals[f.label] = v;
      else if (h.currentText && h.currentText !== '—') vals[f.label] = h.currentText;
    }
  }
  var roundNum = (fullHistory || []).filter(function(m){return m.role==='user';}).length;
  vals['轮次'] = roundNum;

  var varFields = (template.outputSections && template.outputSections.variables)
    ? (template.outputSections.variables.fields || []) : [];
  var relLabels = varFields.map(function(f) { return f.label; });

  function parseAndCheck(condText) {
    var parts = condText.split(/[且，,、]/);
    var checks = [];
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p].trim();
      if (!part) continue;
      var m = part.match(/([一-龥\w]{1,8})\s*([≥≤=><]=?)\s*(-?\d+)/);
      if (!m) continue;
      var op = m[2];
      if (op === '>=') op = '≥';
      if (op === '<=') op = '≤';
      checks.push({ label: m[1], op: op, threshold: Number(m[3]) });
    }
    if (checks.length === 0) return { ok: false };
    var roundReq = 0;
    var hasRel = false;
    for (var c = 0; c < checks.length; c++) {
      var chk = checks[c];
      if (chk.label === '轮次' || chk.label.indexOf('轮') >= 0) roundReq = chk.threshold;
      for (var rl2 = 0; rl2 < relLabels.length; rl2++) {
        if (chk.label === relLabels[rl2] || chk.label.indexOf(relLabels[rl2]) >= 0 || relLabels[rl2].indexOf(chk.label) >= 0) {
          hasRel = true; break;
        }
      }
      var actual = null;
      if (vals.hasOwnProperty(chk.label)) { actual = vals[chk.label]; }
      else {
        var fuzzyKey = null;
        for (var vk in vals) {
          if (!vals.hasOwnProperty(vk)) continue;
          if (vk.indexOf(chk.label) >= 0 || chk.label.indexOf(vk) >= 0) { fuzzyKey = vk; actual = vals[vk]; break; }
        }
        if (!fuzzyKey) {
          for (var vk2 in vals) {
            if (!vals.hasOwnProperty(vk2)) continue;
            if (vk2.includes(chk.label.substring(0, 2)) || chk.label.includes(vk2.substring(0, 2))) {
              fuzzyKey = vk2; actual = vals[vk2]; break;
            }
          }
        }
      }
      if (actual === null || actual === undefined || isNaN(Number(actual))) return { ok: false };
      actual = Number(actual);
      var effectiveThreshold = chk.threshold;
      if (chk.op === '=' && chk.threshold >= 95) { chk.op = '≥'; effectiveThreshold = 95; }
      if ((chk.op === '≥' && actual < effectiveThreshold) ||
          (chk.op === '≤' && actual > effectiveThreshold) ||
          (chk.op === '>' && actual <= effectiveThreshold) ||
          (chk.op === '<' && actual >= effectiveThreshold) ||
          (chk.op === '=' && actual !== effectiveThreshold)) return { ok: false };
    }
    return { ok: true, roundReq: roundReq, hasRelation: hasRel };
  }

  var results = [];
  // 优先使用结构化 endings 数组
  if (template.endings && template.endings.length > 0) {
    for (var ei = 0; ei < template.endings.length; ei++) {
      var ending = template.endings[ei];
      var parsed = parseAndCheck(ending.condition);
      if (!parsed || !parsed.ok) continue;
      results.push({
        name: ending.name,
        condText: ending.condition,
        roundReq: parsed.roundReq,
        hasRelation: parsed.hasRelation,
        index: ei,
      });
    }
  } else {
    // 回退：从 promptBody 正则解析
    var markerRe = /【(?:游戏结束|命运转折)[·：:\s]*([^】]+)】/g;
    var mm;
    var idx = 0;
    while ((mm = markerRe.exec(body)) !== null) {
      var name = mm[1].trim();
      var before = body.substring(Math.max(0, mm.index - 200), mm.index);
      var parenM = before.match(/[（(]([^）)]+)[）)]/g);
      if (!parenM || parenM.length === 0) continue;
      // ★ 只检查最近一个含运算符的括号表达式，不回退到其他结局的条件
      var condText = "";
      for (var pi = parenM.length - 1; pi >= 0; pi--) {
        var tryCond = parenM[pi].replace(/^[（(]/, "").replace(/[）)]$/, "");
        if (/[≥≤=><]/.test(tryCond)) { condText = tryCond; break; }
      }
      if (!condText) continue;
      var parsed = parseAndCheck(condText);
      if (!parsed || !parsed.ok) continue;
      results.push({ name: name, condText: condText, roundReq: parsed.roundReq, hasRelation: parsed.hasRelation, index: idx });
      idx++;
    }
  }
  return results;
}

// ── 从达标结局中择优 ──
function selectBestEnding(eligible, triggeredEndings) {
  if (!eligible || eligible.length === 0) return null;
  var trig = triggeredEndings || [];
  var fresh = eligible.filter(function(e) { return trig.indexOf(e.name) === -1; });
  if (fresh.length === 0) return null;
  fresh.sort(function(a, b) {
    if (a.roundReq !== b.roundReq) return b.roundReq - a.roundReq;
    if (a.hasRelation !== b.hasRelation) return b.hasRelation - a.hasRelation;
    return a.index - b.index;
  });
  return fresh[0].name;
}

// ── 主入口 ──
function checkEndingClientSide(template, fieldHistory, fullHistory, triggeredEndings) {
  if (!template) return null;
  var eligible = collectEligibleEndings(template, fieldHistory, fullHistory);
  if (eligible.length === 0) return null;
  return selectBestEnding(eligible, triggeredEndings);
}

// ── 构建结局注入指令 ──
function buildEndingInjection(endingName, template) {
  if (!template || !endingName) return '';
  var body = template.promptBody || '';
  var escapeName = endingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var descText = '';
  var re1 = new RegExp('(?:结局[^。：:]*)?' + escapeName + '[^。\\n]{0,200}\\s*(?:。|：|:)', 'g');
  var m1;
  while ((m1 = re1.exec(body)) !== null) {
    var found = m1[0];
    var descM = found.match(/[：:]([^。，]+)/);
    if (descM) { descText = descM[1].trim(); break; }
    descM = found.match(/[)）]\s*(.+)/);
    if (descM) { descText = descM[1].trim().replace(/标注.*$/, '').replace(/【游戏结束.*$/, ''); break; }
  }
  if (!descText) {
    var idx2 = body.indexOf(endingName);
    if (idx2 >= 0) {
      var snippet = body.substring(Math.max(0, idx2 - 100), Math.min(body.length, idx2 + 200));
      var descM2 = snippet.match(new RegExp(escapeName + '[^)）]*[)）]\\s*[：:]\\s*([^。]+)'));
      if (descM2) descText = descM2[1].trim();
      else {
        descM2 = snippet.match(new RegExp(escapeName + '[^)）]*[)）]\\s*([^。]+)'));
        if (descM2) descText = descM2[1].trim().replace(/标注.*$/, '');
      }
    }
  }
  if (!descText) descText = endingName;
  var endingNarrative = descText && descText !== endingName ? descText : endingName;
  return '【★ 命运转折回合 ★】'
    + '本回合的现状就是「' + endingName + '」的命运转折场景。不需要额外切换场景。'
    + '结算上回合的后果后，现状直接写命运转折叙事（8-12句）：' + endingNarrative + '。'
    + '末尾输出【命运转折·' + endingName + '】。'
    + '必须给4个选项。不要在命运转折叙事中提及魂师大赛——除非本命运转折就是魂师大赛。';
}

// ═══════════════════════════════════════════
//  测试框架
// ═══════════════════════════════════════════
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('\x1b[32m✅\x1b[0m ' + name);
  } catch (e) {
    failed++;
    console.error('\x1b[31m❌\x1b[0m ' + name);
    console.error('   ' + (e.message || e));
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function assertContains(str, substr, msg) { if (!str.includes(substr)) throw new Error((msg || '') + ' expected "' + substr + '" in "' + str.substring(0, 120) + '"'); }
function assertGt(a, b, msg) { if (!(a > b)) throw new Error((msg || '') + ' expected ' + a + ' > ' + b); }
function assertGte(a, b, msg) { if (!(a >= b)) throw new Error((msg || '') + ' expected ' + a + ' >= ' + b); }

function makeFH(vals) {
  var fh = {};
  for (var k in vals) {
    if (!vals.hasOwnProperty(k)) continue;
    if (typeof vals[k] === 'number') fh[k] = { current: vals[k], max: vals[k] };
    else fh[k] = { currentText: String(vals[k]) };
  }
  return fh;
}

function makeHistory(rounds) {
  var h = [];
  for (var i = 0; i < rounds; i++) {
    h.push({ role: 'user', content: '选择 1' });
    h.push({ role: 'assistant', content: '场景描述...' });
  }
  return h;
}

// ═══════════════════════════════════════════
//  1. detectEnding — 9 种格式变体
// ═══════════════════════════════════════════
console.log('\n═══ 1. detectEnding（9项）═══');

test('标准格式 【游戏结束·XXX】', () => {
  assertEq(detectEnding('文本【游戏结束·月光和六便士】结尾'), '月光和六便士');
});
test('冒号分隔 【游戏结束：XXX】', () => {
  assertEq(detectEnding('【游戏结束：枯萎之刻】'), '枯萎之刻');
});
test('无分隔符 【游戏结束 XXX】', () => {
  assertEq(detectEnding('【命运转折 凉面派】'), '凉面派');
});
test('半角括号 [命运转折·XXX]', () => {
  assertEq(detectEnding('[命运转折·月光和六便士]'), '月光和六便士');
});
test('分隔符有空格', () => {
  assertEq(detectEnding('【游戏结束 · 红尘庇佑】'), '红尘庇佑');
});
test('破折号分隔', () => {
  assertEq(detectEnding('【游戏结束——枯萎之刻】'), '枯萎之刻');
});
test('无结局返回null', () => {
  assertEq(detectEnding('普通叙事文本'), null);
});
test('"游戏结束"但无标记', () => {
  assertEq(detectEnding('游戏结束了'), null);
});
test('多标记取第一个', () => {
  assertEq(detectEnding('【游戏结束·A】然后【游戏结束·B】'), 'A');
});

// ═══════════════════════════════════════════
//  2. repairEndingSection — 6 项
// ═══════════════════════════════════════════
console.log('\n═══ 2. repairEndingSection（6项）═══');

test('完整章节原样返回', () => {
  var r = repairEndingSection(srTpl.promptBody, srTpl);
  assertEq(r, srTpl.promptBody, '完整章节不应被修改');
});
test('缺失单个结局标记→恢复', () => {
  var crippled = srTpl.promptBody.replace(/【命运转折·暮去朝来】/g, '');
  var r = repairEndingSection(crippled, srTpl);
  assertContains(r, '暮去朝来', '应恢复快速撤离标记');
});
test('结局章节完全缺失→追加', () => {
  var r = repairEndingSection('【你的身份】\n短内容\n【叙事风格】\n风格', srTpl);
  assert(r.indexOf('【结局系统】') >= 0 || r.indexOf('【命运转折系统】') >= 0, '应追加结局/命运转折章节');
});
test('body为空→返回空', () => {
  assertEq(repairEndingSection('', srTpl), '');
});
test('originalTemplate为null→返回原值', () => {
  assertEq(repairEndingSection('text', null), 'text');
});
test('缺失多个结局标记→全部恢复', () => {
  var crippled = srTpl.promptBody
    .replace(/【命运转折·暮去朝来】/g, '')
    .replace(/【命运转折·红尘庇佑】/g, '');
  var r = repairEndingSection(crippled, srTpl);
  assertContains(r, '暮去朝来', '应恢复快速撤离');
  assertContains(r, '红尘庇佑', '应恢复反向渗透');
});

// ═══════════════════════════════════════════
//  3. collectEligibleEndings — 17 项
// ═══════════════════════════════════════════
console.log('\n═══ 3. collectEligibleEndings（17项）═══');

test('不满足任何条件→空数组', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ stress: 10, exposure: 10, intel: 0, blackmail: 0, mengHaoGan: 20, xiaoTaiDu: 0, shenglingjiao: 0, infiltration: 0 }), []);
  assertEq(r.length, 0);
});
test('压力=100→精神崩溃（精确触发）', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ stress: 100 }), []);
  assert(r.some(function(e) { return e.name === '月光和六便士'; }), '压力100应触发');
});
test('压力=99→精神崩溃（≥95放宽）', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ stress: 99 }), []);
  assert(r.some(function(e) { return e.name === '月光和六便士'; }), '压力99应触发（≥95放宽）');
});
test('压力=95→精神崩溃（放宽边界）', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ stress: 95 }), []);
  assert(r.some(function(e) { return e.name === '月光和六便士'; }));
});
test('压力=94→不触发', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ stress: 94 }), []);
  assert(!r.some(function(e) { return e.name === '月光和六便士'; }), '压力94不应触发');
});
test('暴露=99→身份暴露（≥95放宽）', () => {
  var r = collectEligibleEndings(srTpl, makeFH({ exposure: 99 }), []);
  assert(r.some(function(e) { return e.name === '枯萎之刻'; }));
});
test('成功撤离全部条件满足', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 30, intel: 5 }), makeHistory(9));
  assert(r.some(function(e) { return e.name === '归乡'; }));
});
test('成功撤离—情报不足不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 30, intel: 2 }), makeHistory(9));
  assert(!r.some(function(e) { return e.name === '归乡'; }));
});
test('成功撤离—暴露过高不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 60, intel: 5 }), makeHistory(9));
  assert(!r.some(function(e) { return e.name === '归乡'; }));
});
test('成功撤离—轮次不足不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 30, intel: 5 }), makeHistory(5));
  assert(!r.some(function(e) { return e.name === '归乡'; }));
});
test('快速撤离—条件满足', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 20, intel: 4 }), makeHistory(7));
  assert(r.some(function(e) { return e.name === '暮去朝来'; }));
});
test('快速撤离—暴露过高不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 40, intel: 4 }), makeHistory(7));
  assert(!r.some(function(e) { return e.name === '暮去朝来'; }));
});
test('反向渗透全部条件满足', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 20, blackmail: 6, mengHaoGan: 75 }), []);
  assert(r.some(function(e) { return e.name === '红尘庇佑'; }));
});
test('反向渗透—把柄不足不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 20, blackmail: 3, mengHaoGan: 75 }), []);
  assert(!r.some(function(e) { return e.name === '红尘庇佑'; }));
});
test('反向渗透—梦红尘好感不足不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ exposure: 20, blackmail: 6, mengHaoGan: 50 }), []);
  assert(!r.some(function(e) { return e.name === '红尘庇佑'; }));
});
test('魂师大赛—条件满足', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ infiltration: 4 }), makeHistory(16));
  assert(r.some(function(e) { return e.name === '凉面派'; }));
});
test('魂师大赛—轮次不足不触发', () => {
  var r = collectEligibleEndings(srTpl,
    makeFH({ infiltration: 4 }), makeHistory(10));
  assert(!r.some(function(e) { return e.name === '凉面派'; }));
});
test('> 运算符支持', () => {
  var tpl = JSON.parse(JSON.stringify(srTpl));
  tpl.endings = null;
  tpl.promptBody += '\n测试结局（压力值 > 50）：测试大于。标注【命运转折·大于测试】';
  var r = collectEligibleEndings(tpl, makeFH({ stress: 60 }), []);
  assert(r.some(function(e) { return e.name === '大于测试'; }));
});
test('< 运算符支持', () => {
  var tpl = JSON.parse(JSON.stringify(srTpl));
  tpl.endings = null;
  tpl.promptBody += '\n测试结局（暴露风险 < 10）：测试小于。标注【命运转折·小于测试】';
  var r = collectEligibleEndings(tpl, makeFH({ exposure: 5 }), []);
  assert(r.some(function(e) { return e.name === '小于测试'; }));
});

// ═══════════════════════════════════════════
//  4. selectBestEnding — 7 项
// ═══════════════════════════════════════════
console.log('\n═══ 4. selectBestEnding（7项）═══');

test('空数组→null', () => { assertEq(selectBestEnding([], []), null); });
test('单结局→直接返回', () => {
  assertEq(selectBestEnding([{ name: 'X', roundReq: 5, hasRelation: false, index: 0 }], []), 'X');
});
test('轮次高优先', () => {
  assertEq(selectBestEnding([
    { name: '低', roundReq: 5, hasRelation: false, index: 0 },
    { name: '高', roundReq: 20, hasRelation: false, index: 1 },
  ], []), '高');
});
test('轮次相同→含关系优先', () => {
  assertEq(selectBestEnding([
    { name: '无', roundReq: 10, hasRelation: false, index: 0 },
    { name: '有', roundReq: 10, hasRelation: true, index: 1 },
  ], []), '有');
});
test('已触发被过滤', () => {
  assertEq(selectBestEnding([
    { name: '旧', roundReq: 10, hasRelation: false, index: 0 },
    { name: '新', roundReq: 5, hasRelation: false, index: 1 },
  ], ['旧']), '新');
});
test('全部已触发→null', () => {
  assertEq(selectBestEnding([
    { name: 'A', roundReq: 10, hasRelation: false, index: 0 },
  ], ['A']), null);
});
test('轮次+关系相同→模板顺序', () => {
  assertEq(selectBestEnding([
    { name: '后', roundReq: 10, hasRelation: false, index: 1 },
    { name: '先', roundReq: 10, hasRelation: false, index: 0 },
  ], []), '先');
});

// ═══════════════════════════════════════════
//  5. checkEndingClientSide — 5 项
// ═══════════════════════════════════════════
console.log('\n═══ 5. checkEndingClientSide（5项）═══');

test('无满足→null', () => {
  assertEq(checkEndingClientSide(srTpl, makeFH({ stress: 10 }), [], []), null);
});
test('template=null→null', () => {
  assertEq(checkEndingClientSide(null, {}, [], []), null);
});
test('精神崩溃被触发', () => {
  assertEq(checkEndingClientSide(srTpl, makeFH({ stress: 100 }), [], []), '月光和六便士');
});
test('已触发被跳过', () => {
  assertEq(checkEndingClientSide(srTpl, makeFH({ stress: 100 }), [], ['月光和六便士']), null);
});
test('多结局同时满足择优', () => {
  // 压力100 + 轮次17 + 潜伏进度4 → 月光和六便士 + 凉面派同时满足
  var fh = makeFH({ stress: 100, infiltration: 4 });
  var h = makeHistory(17);
  var r = checkEndingClientSide(srTpl, fh, h, []);
  assert(r !== null, '应触发某结局');
});

// ═══════════════════════════════════════════
//  6. buildEndingInjection — 4 项
// ═══════════════════════════════════════════
console.log('\n═══ 6. buildEndingInjection（4项）═══');

test('生成精神崩溃注入', () => {
  var r = buildEndingInjection('月光和六便士', srTpl);
  assertContains(r, '月光和六便士');
  assertContains(r, '【命运转折·月光和六便士】');
  assertContains(r, '8-12句');
});
test('不存在结局→后备', () => {
  var r = buildEndingInjection('虚构结局', srTpl);
  assertContains(r, '虚构结局');
  assertContains(r, '【命运转折·虚构结局】');
});
test('template=null→空', () => {
  assertEq(buildEndingInjection('X', null), '');
});
test('endingName=null→空', () => {
  assertEq(buildEndingInjection('', srTpl), '');
});

// ═══════════════════════════════════════════
//  7. 综合场景 — 6 项
// ═══════════════════════════════════════════
console.log('\n═══ 7. 综合场景（6项）═══');

test('场景：第20回合多结局博弈', () => {
  var fh = makeFH({ stress: 98, exposure: 45, intel: 5, blackmail: 6, mengHaoGan: 75, infiltration: 4 });
  var eligible = collectEligibleEndings(srTpl, fh, makeHistory(22));
  assertGte(eligible.length, 2, '应≥2个结局满足，实际' + eligible.length + ': ' + eligible.map(function(e){return e.name;}).join(','));
});

test('场景：AI回复含结局标记的完整流程', () => {
  var ai = '上回合：她选择承受抽血。现状：窗外传来警报声。【命运转折·月光和六便士】可选行动...';
  assertEq(detectEnding(ai), '月光和六便士');
});

test('场景：连续3回合结局不重复', () => {
  var triggered = [];
  var fh = makeFH({ stress: 100 });
  var r1 = checkEndingClientSide(srTpl, fh, makeHistory(5), triggered);
  assertEq(r1, '月光和六便士');
  triggered.push(r1);
  var r2 = checkEndingClientSide(srTpl, fh, makeHistory(6), triggered);
  assertEq(r2, null, '同结局不应重复触发');
});

test('场景：压力从94升到95时触发', () => {
  var fh94 = makeFH({ stress: 94 });
  var r94 = collectEligibleEndings(srTpl, fh94, []);
  assertEq(r94.length, 0, '压力94无结局');
  var fh95 = makeFH({ stress: 95 });
  var r95 = collectEligibleEndings(srTpl, fh95, []);
  assert(r95.some(function(e) { return e.name === '月光和六便士'; }), '压力95触发');
});

test('场景：模板切换后条件重新判定', () => {
  var tpl2 = JSON.parse(JSON.stringify(srTpl));
  tpl2.endings = null;
  tpl2.promptBody = srTpl.promptBody + '\n自定义结局（压力值 ≥ 30）：低阈值测试。标注【命运转折·低阈值】';
  var r = collectEligibleEndings(tpl2, makeFH({ stress: 98 }), []);
  assert(r.some(function(e) { return e.name === '低阈值'; }), '新模板的结局应触发');
  assert(r.some(function(e) { return e.name === '月光和六便士'; }), '原模板的精神崩溃也应触发（stress=98≥95）');
});

test('场景：空fieldHistory不崩溃', () => {
  var r = collectEligibleEndings(srTpl, {}, []);
  assertEq(r.length, 0, '空fieldHistory应返回空数组不崩溃');
});

// ═══════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
var total = passed + failed;
if (failed > 0) {
  console.log('\x1b[31m' + passed + ' passed, ' + failed + ' failed, ' + total + ' total\x1b[0m');
  console.log('\n❌ 有 ' + failed + ' 项失败！');
  process.exit(1);
} else {
  console.log('\x1b[32m' + passed + ' passed, 0 failed, ' + total + ' total\x1b[0m');
  console.log('\n✅ 结局系统全部通过！');
}
