/* ═══════════════════════════════════════════
   成就系统诊断脚本 v1
   浏览器运行：fetch('/js/test-achievements.js').then(r=>r.text()).then(eval)
   或：node 端可跑 test-achievements-node.js
   ═══════════════════════════════════════════ */
(async function diagAchievements() {
  var P = function(m) { console.log('%c✅  %c'+m, 'color:#4caf50;font-weight:bold', 'color:inherit'); };
  var F = function(m) { console.log('%c❌  %c'+m, 'color:#f44336;font-weight:bold', 'color:inherit'); };
  var W = function(m) { console.log('%c⚠️  %c'+m, 'color:#ff9800;font-weight:bold', 'color:inherit'); };
  var H = function(m) { console.log('%c\n═══ '+m+' ═══', 'color:#ffd54f;font-size:14px;'); };
  var pass = 0, fail = 0;

  function check(cond, msg) {
    if (cond) { pass++; P(msg); } else { fail++; F(msg); }
  }

  // ── 确保模板已加载 ──
  if (!gameState.activeTemplate) {
    console.log('⏳ 正在加载默认模板...');
    gameState.activeTemplate = await loadTemplate('surongrong');
  }
  var tpl = getActiveTemplate();
  if (!tpl) { console.error('❌ 无模板，测试中止'); return; }
  console.log('📋 模板: ' + (tpl.name || tpl.id || 'unknown'));

  // ═══════════════════════════════════════════
  H('1. _findFieldId — 精确匹配 + 空串守卫');
  // ═══════════════════════════════════════════

  check(_findFieldId('') === null, '_findFieldId("") → null (空串守卫)');
  check(_findFieldId(null) === null, '_findFieldId(null) → null');
  check(_findFieldId(undefined) === null, '_findFieldId(undefined) → null');
  check(_findFieldId('   ') === null, '_findFieldId("   ") → null (纯空格)');

  // 精确 label 匹配
  check(_findFieldId('压力值') === 'stress', '_findFieldId("压力值") → "stress"');
  check(_findFieldId('暴露风险') === 'exposure', '_findFieldId("暴露风险") → "exposure"');
  check(_findFieldId('圣灵教觊觎') === 'shenglingjiao', '_findFieldId("圣灵教觊觎") → "shenglingjiao"');
  check(_findFieldId('梦红尘好感') === 'mengHaoGan', '_findFieldId("梦红尘好感") → "mengHaoGan"');
  check(_findFieldId('笑红尘态度') === 'xiaoTaiDu', '_findFieldId("笑红尘态度") → "xiaoTaiDu"');
  check(_findFieldId('情报碎片') === 'intel', '_findFieldId("情报碎片") → "intel"');
  check(_findFieldId('把柄') === 'blackmail', '_findFieldId("把柄") → "blackmail"');
  check(_findFieldId('潜伏进度') === 'infiltration', '_findFieldId("潜伏进度") → "infiltration"');
  check(_findFieldId('轮次') === 'round', '_findFieldId("轮次") → "round"');

  // 精确 id 匹配（template 用 "field": "blackmail" 的场景）
  check(_findFieldId('blackmail') === 'blackmail', '_findFieldId("blackmail") → "blackmail" (id精确匹配)');
  check(_findFieldId('stress') === 'stress', '_findFieldId("stress") → "stress" (id精确匹配)');
  check(_findFieldId('mengHaoGan') === 'mengHaoGan', '_findFieldId("mengHaoGan") → "mengHaoGan" (id精确匹配)');

  // 子串匹配
  check(_findFieldId('红尘好感') === 'mengHaoGan', '_findFieldId("红尘好感") → "mengHaoGan" (子串)');
  check(_findFieldId('圣灵教') === 'shenglingjiao', '_findFieldId("圣灵教") → "shenglingjiao" (子串)');

  // ═══════════════════════════════════════════
  H('2. 正则 — 负阈值捕获 (-?\\d+)');
  // ═══════════════════════════════════════════

  var afterNeg = '达到-50';
  var nmNeg = afterNeg.match(/(-?\d+)/);
  check(nmNeg && parseInt(nmNeg[1]) === -50, '"达到-50" → parseInt=' + (nmNeg ? nmNeg[1] : 'null') + ' (期望 -50)');

  var afterPos = '达到5';
  var nmPos = afterPos.match(/(-?\d+)/);
  check(nmPos && parseInt(nmPos[1]) === 5, '"达到5" → parseInt=' + (nmPos ? nmPos[1] : 'null') + ' (期望 5)');

  var afterZero = '达到0';
  var nmZero = afterZero.match(/(-?\d+)/);
  check(nmZero && parseInt(nmZero[1]) === 0, '"达到0" → parseInt=' + (nmZero ? nmZero[1] : 'null') + ' (期望 0)');

  var descNegInMiddle = '圣灵教觊觎达到-50且存活';
  var nmMid = descNegInMiddle.match(/(-?\d+)/);
  check(nmMid && parseInt(nmMid[1]) === -50, '中间含负号: ' + (nmMid ? nmMid[1] : 'null'));

  // ═══════════════════════════════════════════
  H('3. 可见成就 desc — 方向判定逻辑');
  // ═══════════════════════════════════════════

  var achievements = getAchievements();
  check(!!achievements, 'getAchievements() 返回非空对象');
  var achKeys = Object.keys(achievements);
  console.log('  共 ' + achKeys.length + ' 个可见成就');

  // 逐一检查每个成就的描述解析
  var checkResults = [];
  for (var an in achievements) {
    if (!achievements.hasOwnProperty(an)) continue;
    var desc = achievements[an].desc || '';
    var isNeverExceeded = /从未超过/.test(desc);
    var isBelow = /低于|不超过|少于|以下|小于|≤/.test(desc);
    var nm = desc.match(/(-?\d+)/g);
    var numbers = nm ? nm.map(function(n){return parseInt(n);}) : [];
    var threshold = numbers.length > 0 ? numbers[numbers.length - 1] : null; // 最后一个数字
    var direction = '???';
    if (isNeverExceeded) direction = '≤ (从未超过,用max)';
    else if (isBelow) direction = '≤ (低于类)';
    else if (threshold !== null && threshold < 0) direction = '≤ (负阈值)';
    else if (threshold !== null) direction = '≥ (达到)';
    else direction = '- (非数值型)';

    var ok = true;
    var issue = '';
    if (isNeverExceeded && isBelow) { ok = false; issue = ' 同时命中从未超过+低于模式'; }
    // 有数值但无方向判定
    if (threshold !== null && direction === '???' && !/结局|孤注|反杀|设局|交易/.test(desc)) { ok = false; issue = ' 有数值但无方向'; }

    checkResults.push({ name: an, desc: desc, threshold: threshold, direction: direction, ok: ok, issue: issue });
    var status = ok ? '✅' : '❌';
    console.log('  ' + status + ' ' + an + ': "' + desc + '" → 阈值=' + threshold + ' ' + direction + (issue || ''));
  }

  var badResults = checkResults.filter(function(r){return !r.ok;});
  check(badResults.length === 0, '所有可见成就 desc 方向判定自洽 (' + (achKeys.length - badResults.length) + '/' + achKeys.length + ')');
  badResults.forEach(function(r){ W('  ⚠ ' + r.name + ': ' + r.issue); });

  // ═══════════════════════════════════════════
  H('4. 隐藏成就 — field/fieldLabel 双键兼容');
  // ═══════════════════════════════════════════

  var hidden = tpl.hiddenAchievements || {};
  var hiddenKeys = Object.keys(hidden);
  console.log('  共 ' + hiddenKeys.length + ' 个隐藏成就');

  for (var hn in hidden) {
    if (!hidden.hasOwnProperty(hn)) continue;
    var ha = hidden[hn];
    var trig = ha.trigger || {};
    var fieldSrc = trig.fieldLabel || trig.field || '';
    var fid = fieldSrc ? _findFieldId(fieldSrc) : null;

    if (trig.type === 'field_zero' || trig.type === 'field_max_under') {
      check(!!fid, hn + ': trigger.' + (trig.fieldLabel ? 'fieldLabel' : 'field') + '="' + fieldSrc + '" → _findFieldId → "' + fid + '"');
    } else {
      console.log('  ⏭ ' + hn + ': type=' + trig.type + ' (非字段型，跳过)');
    }
  }

  // ═══════════════════════════════════════════
  H('5. field_zero — endingTriggered 守卫');
  // ═══════════════════════════════════════════

  // 通过源码静态检查：field_zero case 内是否有 endingTriggered 判断
  // (运行时代码路径验证)
  var savedEndingTriggered = gameState.achievementFlags.endingTriggered;
  var savedTriggeredEndings = gameState.achievementFlags.triggeredEndings;

  // 场景A: endingTriggered=false → field_zero 不应触发
  gameState.achievementFlags.endingTriggered = false;
  var savedUnlocked = getUnlockedAchievements();
  var unlockedBefore = Object.keys(savedUnlocked).filter(function(k){return k==='净身出户';}).length;

  // 设置 fieldHistory 使 把柄 current=0
  var savedFh = JSON.parse(JSON.stringify(gameState.fieldHistory));
  if (!gameState.fieldHistory['blackmail']) gameState.fieldHistory['blackmail'] = {};
  gameState.fieldHistory['blackmail'].current = 0;
  gameState.fieldHistory['blackmail'].max = 0;

  // 手动调用 checkHiddenAchievements（它内部会检查 endingTriggered）
  var parsed = { fields: { blackmail: '0' } };
  checkHiddenAchievements(parsed);

  var unlockedAfter = !!getUnlockedAchievements()['净身出户'];
  if (unlockedAfter) {
    // 如果意外触发了，清理掉
    var ua = getUnlockedAchievements();
    delete ua['净身出户'];
    saveAchievements(ua);
    F('field_zero: endingTriggered=false 时意外触发了"净身出户"');
  } else {
    P('field_zero: endingTriggered=false → "净身出户" 未触发 (守卫生效)');
  }

  // 场景B: endingTriggered=true, current=0 → 应触发
  gameState.achievementFlags.endingTriggered = true;
  gameState.fieldHistory['blackmail'].current = 0;
  checkHiddenAchievements(parsed);

  var unlockedB = !!getUnlockedAchievements()['净身出户'];
  if (unlockedB) {
    P('field_zero: endingTriggered=true + current=0 → "净身出户" 触发 ✓');
    var ua2 = getUnlockedAchievements();
    delete ua2['净身出户'];
    saveAchievements(ua2);
  } else {
    W('field_zero: endingTriggered=true + current=0 → "净身出户" 未触发 (检查 hasOwnProperty 或 fid 匹配)');
  }

  // 场景C: endingTriggered=true, current≠0 → 不应触发
  gameState.achievementFlags.endingTriggered = true;
  gameState.fieldHistory['blackmail'].current = 3;
  checkHiddenAchievements(parsed);

  var unlockedC = !!getUnlockedAchievements()['净身出户'];
  if (unlockedC) {
    var ua3 = getUnlockedAchievements();
    delete ua3['净身出户'];
    saveAchievements(ua3);
    F('field_zero: current=3 时意外触发了"净身出户"');
  } else {
    P('field_zero: endingTriggered=true + current=3 → "净身出户" 未触发 ✓');
  }

  // 恢复状态
  gameState.achievementFlags.endingTriggered = savedEndingTriggered;
  gameState.achievementFlags.triggeredEndings = savedTriggeredEndings;
  gameState.fieldHistory = savedFh;

  // ═══════════════════════════════════════════
  H('6. field_max_under — trigger.field 回退 + v>0 放行');
  // ═══════════════════════════════════════════

  var ach6 = hidden['崩溃边缘'];
  if (ach6 && ach6.trigger) {
    var fieldSrc6 = ach6.trigger.fieldLabel || ach6.trigger.field || '';
    check(fieldSrc6 === 'stress', '"崩溃边缘" 字段来源: "' + fieldSrc6 + '" (期望 "stress")');
    var fid6 = _findFieldId(fieldSrc6);
    check(fid6 === 'stress', '"_findFieldId("stress") → "' + fid6 + '"');

    // 运行时测试
    var savedFh6 = JSON.parse(JSON.stringify(gameState.fieldHistory));
    gameState.achievementFlags.endingTriggered = true;
    if (!gameState.fieldHistory['stress']) gameState.fieldHistory['stress'] = {};
    gameState.fieldHistory['stress'].max = 85; // 低于阈值92
    gameState.fieldHistory['stress'].current = 50;

    checkHiddenAchievements({ fields: {} });
    var unlocked6 = !!getUnlockedAchievements()['崩溃边缘'];
    if (unlocked6) {
      P('field_max_under: endingTriggered + max=85≤92 → "崩溃边缘" 触发 ✓');
      var ua6 = getUnlockedAchievements();
      delete ua6['崩溃边缘'];
      saveAchievements(ua6);
    } else {
      W('field_max_under: max=85≤92 未触发 (检查 v>0 守卫或 _fieldVal)');
    }

    gameState.achievementFlags.endingTriggered = savedEndingTriggered;
    // 不恢复 fieldHistory — 让后续测试继续用
  }

  // ═══════════════════════════════════════════
  H('7. _fieldVal — 负数值保留');
  // ═══════════════════════════════════════════

  var savedFh7 = JSON.parse(JSON.stringify(gameState.fieldHistory));
  if (!gameState.fieldHistory['shenglingjiao']) gameState.fieldHistory['shenglingjiao'] = {};
  gameState.fieldHistory['shenglingjiao'].current = -60;
  gameState.fieldHistory['shenglingjiao'].max = 0;  // max stays at 0 for negative fields

  var val7a = _fieldVal('圣灵教觊觎', false);
  check(val7a === -60, '_fieldVal("圣灵教觊觎", useMax=false) → ' + val7a + ' (期望 -60)');

  var val7b = _fieldVal('圣灵教觊觎', true);
  check(val7b === 0, '_fieldVal("圣灵教觊觎", useMax=true) → ' + val7b + ' (max=0, 下降型字段正确)');

  gameState.fieldHistory = savedFh7;

  // ═══════════════════════════════════════════
  H('8. 可见成就运行时检测 — 模拟各场景');
  // ═══════════════════════════════════════════

  // 设置 fieldHistory 模拟游戏状态
  var savedFh8 = JSON.parse(JSON.stringify(gameState.fieldHistory));
  var savedRound = gameState.fullHistory.filter(function(m){return m.role==='user';}).length;
  var savedLoading = gameState._loadingSave;

  // 模拟已进行2回合
  gameState._loadingSave = false;
  // fullHistory 应至少有2条user消息

  // 场景 8a: 圣灵教觊觎=-60 → "圣灵教之影" 应触发 (负阈值≤判定)
  gameState.fieldHistory['shenglingjiao'] = { current: -60, max: 0 };
  gameState.fieldHistory['exposure'] = { current: 15, max: 15 };
  gameState.fieldHistory['stress'] = { current: 30, max: 30 };
  gameState.fieldHistory['intel'] = { current: 2, max: 2 };
  gameState.fieldHistory['blackmail'] = { current: 1, max: 1 };

  // 确保成就未解锁
  var ua8 = getUnlockedAchievements();
  delete ua8['圣灵教之影'];
  delete ua8['潜行大师'];
  delete ua8['铁壁意志'];
  saveAchievements(ua8);

  // 只测"圣灵教之影"（负阈值）
  var parsed8a = { fields: { shenglingjiao: '-60', exposure: '15', stress: '30', intel: '2', blackmail: '1' } };
  checkAchievementsFromState(parsed8a);
  var got8a = !!getUnlockedAchievements()['圣灵教之影'];
  if (got8a) {
    P('运行时: 圣灵教觊觎=-60 → "圣灵教之影" 触发 ✓ (负阈值≤判定)');
    delete getUnlockedAchievements()['圣灵教之影'];
    saveAchievements(getUnlockedAchievements());
  } else {
    F('运行时: 圣灵教觊觎=-60 → "圣灵教之影" 未触发 (期望触发)');
  }

  // 场景 8b: 暴露风险 max=15 → "潜行大师" 应触发 (从未超过≤判定)
  gameState.fieldHistory['exposure'] = { current: 10, max: 15 };
  checkAchievementsFromState({ fields: { exposure: '10' } });
  var got8b = !!getUnlockedAchievements()['潜行大师'];
  if (got8b) {
    P('运行时: 暴露max=15≤20 → "潜行大师" 触发 ✓ (从未超过≤判定)');
    delete getUnlockedAchievements()['潜行大师'];
    saveAchievements(getUnlockedAchievements());
  } else {
    F('运行时: 暴露max=15≤20 → "潜行大师" 未触发 (期望触发)');
  }

  // 场景 8c: 压力 max=30≤50 → "铁壁意志" 应触发
  gameState.fieldHistory['stress'] = { current: 25, max: 30 };
  checkAchievementsFromState({ fields: { stress: '25' } });
  var got8c = !!getUnlockedAchievements()['铁壁意志'];
  if (got8c) {
    P('运行时: 压力max=30≤50 → "铁壁意志" 触发 ✓ (从未超过≤判定)');
    delete getUnlockedAchievements()['铁壁意志'];
    saveAchievements(getUnlockedAchievements());
  } else {
    F('运行时: 压力max=30≤50 → "铁壁意志" 未触发 (期望触发)');
  }

  // 场景 8d: 暴露风险=25>20 → "潜行大师" 不应触发
  gameState.fieldHistory['exposure'] = { current: 25, max: 30 };
  checkAchievementsFromState({ fields: { exposure: '25' } });
  var got8d = !!getUnlockedAchievements()['潜行大师'];
  if (got8d) {
    F('运行时: 暴露max=30>20 → "潜行大师" 意外触发');
    delete getUnlockedAchievements()['潜行大师'];
    saveAchievements(getUnlockedAchievements());
  } else {
    P('运行时: 暴露max=30>20 → "潜行大师" 未触发 ✓ (超过阈值)');
  }

  // 场景 8e: 情报碎片=5 → "情报拼图" 应触发 (正常≥判定)
  gameState.fieldHistory['intel'] = { current: 5, max: 5 };
  checkAchievementsFromState({ fields: { intel: '5' } });
  var got8e = !!getUnlockedAchievements()['情报拼图'];
  if (got8e) {
    P('运行时: 情报碎片=5 → "情报拼图" 触发 ✓ (正常≥判定)');
    delete getUnlockedAchievements()['情报拼图'];
    saveAchievements(getUnlockedAchievements());
  } else {
    F('运行时: 情报碎片=5 → "情报拼图" 未触发 (期望触发)');
  }

  // 场景 8f: 情报碎片=3<5 → "情报拼图" 不应触发
  gameState.fieldHistory['intel'] = { current: 3, max: 3 };
  checkAchievementsFromState({ fields: { intel: '3' } });
  var got8f = !!getUnlockedAchievements()['情报拼图'];
  if (got8f) {
    F('运行时: 情报碎片=3<5 → "情报拼图" 意外触发');
    delete getUnlockedAchievements()['情报拼图'];
    saveAchievements(getUnlockedAchievements());
  } else {
    P('运行时: 情报碎片=3<5 → "情报拼图" 未触发 ✓ (未达阈值)');
  }

  // 恢复状态
  gameState.fieldHistory = savedFh8;

  // ═══════════════════════════════════════════
  H('9. getAchievementProgress — 进度条数值');
  // ═══════════════════════════════════════════

  // 9a: 正阈值进度
  var savedFh9 = JSON.parse(JSON.stringify(gameState.fieldHistory));
  gameState.fieldHistory['intel'] = { current: 3, max: 3 };
  var prog9a = getAchievementProgress('情报拼图');
  if (prog9a) {
    check(prog9a.target === 5, '情报拼图 target=5 (期望5): ' + prog9a.target);
    check(prog9a.current === 3, '情报拼图 current=3 (期望3): ' + prog9a.current);
  } else {
    F('getAchievementProgress("情报拼图") 返回 null');
  }

  // 9b: 负阈值进度
  gameState.fieldHistory['shenglingjiao'] = { current: -30, max: 0 };
  var prog9b = getAchievementProgress('圣灵教之影');
  if (prog9b) {
    check(prog9b.target === -50, '圣灵教之影 target=-50 (期望-50): ' + prog9b.target);
    check(prog9b.current === -30, '圣灵教之影 current=-30 (期望-30): ' + prog9b.current);
  } else {
    F('getAchievementProgress("圣灵教之影") 返回 null');
  }

  // 9c: 从未超过进度
  gameState.fieldHistory['exposure'] = { current: 10, max: 15 };
  var prog9c = getAchievementProgress('潜行大师');
  if (prog9c) {
    check(prog9c.target === 20, '潜行大师 target=20: ' + prog9c.target);
    console.log('  潜行大师进度文本: ' + prog9c.text);
  }

  // 9d: 正阈值且已达到
  gameState.fieldHistory['intel'] = { current: 6, max: 6 };
  var prog9d = getAchievementProgress('情报拼图');
  if (prog9d) {
    // 达到后 current 应 capped 在 target
    check(prog9d.current === 5, '情报拼图 current=capped(5, target=5): ' + prog9d.current);
  }

  gameState.fieldHistory = savedFh9;

  // ═══════════════════════════════════════════
  H('10. 进度条百分比渲染');
  // ═══════════════════════════════════════════

  function calcPct(tgt, raw) {
    var cur, pct;
    if (tgt < 0) {
      cur = Math.max(tgt, Math.min(0, raw));
      pct = Math.round(((0 - cur) / (0 - tgt)) * 100);
    } else {
      cur = Math.max(0, Math.min(tgt, raw));
      pct = Math.round((cur / tgt) * 100);
    }
    return Math.min(100, Math.max(0, pct));
  }

  check(calcPct(5, 3) === 60, '正阈值进度: 3/5 = ' + calcPct(5,3) + '% (期望 60%)');
  check(calcPct(5, 0) === 0, '正阈值进度: 0/5 = ' + calcPct(5,0) + '% (期望 0%)');
  check(calcPct(5, 7) === 100, '正阈值进度: 7/5 → cap = ' + calcPct(5,7) + '% (期望 100%)');
  check(calcPct(-50, 0) === 0, '负阈值进度: 0→-50, 当前0 = ' + calcPct(-50,0) + '% (期望 0%)');
  check(calcPct(-50, -30) === 60, '负阈值进度: 0→-50, 当前-30 = ' + calcPct(-50,-30) + '% (期望 60%)');
  check(calcPct(-50, -50) === 100, '负阈值进度: 0→-50, 当前-50 = ' + calcPct(-50,-50) + '% (期望 100%)');
  check(calcPct(-50, -70) === 100, '负阈值进度: 0→-50, 当前-70 → cap=' + calcPct(-50,-70) + '% (越界钳制 100%)');
  check(calcPct(20, 15) === 75, '从未超过进度: 15/20 = ' + calcPct(20,15) + '% (期望 75%)');

  // ═══════════════════════════════════════════
  H('11. updateFieldHistoryFromParsed — 负数值处理');
  // ═══════════════════════════════════════════

  var savedFh11 = JSON.parse(JSON.stringify(gameState.fieldHistory));
  gameState.fieldHistory = {};
  updateFieldHistoryFromParsed({ fields: { shenglingjiao: '-50', intel: '3', exposure: '10' } });

  check(gameState.fieldHistory['shenglingjiao'] && gameState.fieldHistory['shenglingjiao'].current === -50,
    'updateFieldHistory: 圣灵教觊觎 current=-50 (期望 -50): ' +
    (gameState.fieldHistory['shenglingjiao'] ? gameState.fieldHistory['shenglingjiao'].current : 'null'));

  check(gameState.fieldHistory['shenglingjiao'] && gameState.fieldHistory['shenglingjiao'].max === 0,
    'updateFieldHistory: 圣灵教觊觎 max=0 (下降型, Math.max(0,-50)=0)');

  check(gameState.fieldHistory['intel'] && gameState.fieldHistory['intel'].current === 3,
    'updateFieldHistory: 情报碎片 current=3');
  check(gameState.fieldHistory['intel'] && gameState.fieldHistory['intel'].max === 3,
    'updateFieldHistory: 情报碎片 max=3 (Math.max(0,3)=3)');

  // 测试 max 累加（上升型）
  updateFieldHistoryFromParsed({ fields: { intel: '6' } });
  check(gameState.fieldHistory['intel'].max === 6,
    'updateFieldHistory: 情报碎片 max 从3→6: ' + gameState.fieldHistory['intel'].max);

  gameState.fieldHistory = savedFh11;

  // ═══════════════════════════════════════════
  H('12. addNewAchievement parseInt — 无 Math.max 钳制');
  // ═══════════════════════════════════════════

  // 静态检查：parseInt 负号处理
  check(parseInt('-50') === -50, 'parseInt("-50") → -50');
  check(parseInt('50') === 50, 'parseInt("50") → 50');
  check(parseInt('0') === 0, 'parseInt("0") → 0');
  // 验证源码中无 Math.max(0, parseInt(...)) 包裹
  var srcCheck = addNewAchievement.toString();
  var hasClamp = /Math\.max\(0,\s*parseInt/.test(srcCheck);
  check(!hasClamp, 'addNewAchievement 源码不含 Math.max(0, parseInt(...)) 钳制');

  // ═══════════════════════════════════════════
  H('13. 模板结构完整性');
  // ═══════════════════════════════════════════

  check(!!tpl.achievements, 'tpl.achievements 存在');
  check(typeof tpl.achievements === 'object' && !Array.isArray(tpl.achievements), 'tpl.achievements 是对象');
  check(!!tpl.hiddenAchievements, 'tpl.hiddenAchievements 存在');
  check(typeof tpl.hiddenAchievements === 'object' && !Array.isArray(tpl.hiddenAchievements), 'tpl.hiddenAchievements 是对象');

  // 检查每个隐藏成就的 trigger 结构
  for (var hn13 in hidden) {
    if (!hidden.hasOwnProperty(hn13)) continue;
    var trig13 = hidden[hn13].trigger || {};
    if (trig13.type === 'field_zero' || trig13.type === 'field_max_under') {
      var src13 = trig13.fieldLabel || trig13.field;
      check(!!src13, hn13 + ': trigger 有 field/fieldLabel 值: "' + src13 + '"');
    }
  }

  // ═══════════════════════════════════════════
  H('总结');
  // ═══════════════════════════════════════════

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed, ' + (pass+fail) + ' total');
  if (fail === 0) {
    console.log('%c  🎉 成就系统全部检测通过！', 'color:#4caf50;font-size:16px;font-weight:bold');
  } else {
    console.log('%c  ⚠ ' + fail + ' 项失败 — 查看上方 FAIL 行', 'color:#f44336;font-size:16px;font-weight:bold');
  }
  console.log('\n%c  手动验证清单:', 'color:#ffd54f;');
  console.log('  1. 开一局新游戏');
  console.log('  2. 玩几回合 → 打开成就面板 → 查看进度条百分比');
  console.log('  3. 让圣灵教觊觎降到-50以下 → 检查"圣灵教之影"是否解锁');
  console.log('  4. 保持暴露风险≤20 到游戏结束 → 检查"潜行大师"');
  console.log('  5. 保持把柄=0 且达成结局 → 检查"净身出户"');
  console.log('  6. F12 → 控制台 → 不应有"结局条件引用未知字段"warning');

})();
