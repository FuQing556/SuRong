/* ═══════════════════════════════════════════
   成就系统诊断脚本 v2 — CSP安全 + 模板自适应
   浏览器运行（CSP安全）：
     var s=document.createElement('script');s.src='/js/test-achievements.js';document.head.appendChild(s);
   ═══════════════════════════════════════════ */
(function() { 'use strict';
  var P = function(m) { console.log('%c✅  %c'+m, 'color:#4caf50;font-weight:bold', 'color:inherit'); };
  var F = function(m) { console.log('%c❌  %c'+m, 'color:#f44336;font-weight:bold', 'color:inherit'); };
  var W = function(m) { console.log('%c⚠️  %c'+m, 'color:#ff9800;font-weight:bold', 'color:inherit'); };
  var I = function(m) { console.log('   ' + m); };
  var H = function(m) { console.log('%c\n═══ '+m+' ═══', 'color:#ffd54f;font-size:14px;'); };
  var pass = 0, fail = 0, warn = 0;

  function check(cond, msg) {
    if (cond) { pass++; P(msg); } else { fail++; F(msg); }
  }

  // ── 获取当前模板 ──
  var tpl = getActiveTemplate();
  if (!tpl || !tpl.id) {
    console.error('❌ 没有加载模板。请先进入游戏（"进入故事"按钮）。');
    return;
  }
  console.log('📋 当前模板: ' + (tpl.name || tpl.id) + ' (id=' + tpl.id + ')');
  var achievements = tpl.achievements || {};
  var hidden = tpl.hiddenAchievements || {};
  console.log('   可见成就: ' + Object.keys(achievements).length + ' 个, 隐藏成就: ' + Object.keys(hidden).length + ' 个');

  // 收集所有字段
  var allFields = [];
  for (var sk in (tpl.outputSections || {})) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    var fs = tpl.outputSections[sk].fields || [];
    for (var fi = 0; fi < fs.length; fi++) allFields.push(fs[fi]);
  }
  console.log('   字段总数: ' + allFields.length);

  // ═══════════════════════════════════════════
  H('1. _findFieldId — 空串守卫 + 精确匹配');
  // ═══════════════════════════════════════════

  check(_findFieldId('') === null, '_findFieldId("") → null (empty string guard)');
  check(_findFieldId(null) === null, '_findFieldId(null) → null');
  check(_findFieldId(undefined) === null, '_findFieldId(undefined) → null');
  check(_findFieldId('   ') === null, '_findFieldId("   ") → null (whitespace only)');

  // 对每个字段测试精确匹配
  var badMatches = [];
  for (var i = 0; i < allFields.length; i++) {
    var f = allFields[i];
    // label 精确匹配
    var byLabel = _findFieldId(f.label);
    if (byLabel !== f.id) badMatches.push('label="' + f.label + '" → "' + byLabel + '" (expected "' + f.id + '")');
    // id 精确匹配
    var byId = _findFieldId(f.id);
    if (byId !== f.id) badMatches.push('id="' + f.id + '" → "' + byId + '"');
  }
  if (badMatches.length === 0) {
    P('所有 ' + allFields.length + ' 个字段 label/id 精确匹配正确');
  } else {
    badMatches.forEach(function(bm) { F(bm); });
  }

  // ═══════════════════════════════════════════
  H('2. 正则 — 负阈值捕获 (-?\\d+)');
  // ═══════════════════════════════════════════

  function parseThreshold(afterText) {
    var nm = afterText.match(/(-?\d+)/);
    return nm ? parseInt(nm[1]) : null;
  }

  check(parseThreshold('达到-50') === -50, 'parseThreshold("达到-50") → ' + parseThreshold('达到-50'));
  check(parseThreshold('达到5') === 5, 'parseThreshold("达到5") → ' + parseThreshold('达到5'));
  check(parseThreshold('达到0') === 0, 'parseThreshold("达到0") → ' + parseThreshold('达到0'));
  check(parseThreshold('从未超过20') === 20, 'parseThreshold("从未超过20") → ' + parseThreshold('从未超过20'));
  check(parseThreshold('不超过-30') === -30, 'parseThreshold("不超过-30") → ' + parseThreshold('不超过-30'));

  // ═══════════════════════════════════════════
  H('3. 可见成就 — desc 解析 + 方向判定');
  // ═══════════════════════════════════════════

  var achIssues = [];
  for (var an in achievements) {
    if (!achievements.hasOwnProperty(an)) continue;
    var desc = achievements[an].desc || '';

    // 跳过行为型描述
    if (/结局/.test(desc) && !/\d/.test(desc)) { I(an + ': 行为型(结局) — 跳过数值检测'); continue; }
    if (/孤注/.test(desc)) { I(an + ': 行为型(孤注) — 跳过数值检测'); continue; }
    if (/反杀|设局/.test(desc)) { I(an + ': 行为型(反杀) — 跳过数值检测'); continue; }
    if (/情报.*交易|情报.*交换/.test(desc)) { I(an + ': 行为型(交易) — 跳过数值检测'); continue; }

    // 解析数值
    var allNm = desc.match(/(-?\d+)/g);
    var numbers = allNm ? allNm.map(function(n){return parseInt(n);}) : [];

    if (numbers.length === 0) {
      achIssues.push({ name: an, desc: desc, issue: '无数字 — 无法确定阈值' });
      continue;
    }

    // 找匹配的字段标签
    var allLabels = allFields.map(function(f){return f.label;}).sort(function(a,b){return b.length-a.length;});
    var matched = null;
    for (var li = 0; li < allLabels.length; li++) {
      if (desc.includes(allLabels[li])) { matched = allLabels[li]; break; }
    }

    if (!matched) {
      achIssues.push({ name: an, desc: desc, issue: 'desc 不含任何字段标签 → 无法关联字段' });
      continue;
    }

    // 找标签后面的数字
    var idx = desc.indexOf(matched);
    var after = desc.substring(idx + matched.length);
    var nm = after.match(/(-?\d+)/);
    var threshold = nm ? parseInt(nm[1]) : null;

    // 方向判定
    var isNeverExceeded = /从未超过/.test(desc);
    var isBelow = /低于|不超过|少于|以下|小于|≤/.test(desc);
    var direction, expectedOp;
    if (isNeverExceeded) { direction = '≤ (从未超过, 用max)'; expectedOp = '≤'; }
    else if (isBelow) { direction = '≤ (低于类)'; expectedOp = '≤'; }
    else if (threshold !== null && threshold < 0) { direction = '≤ (负阈值)'; expectedOp = '≤'; }
    else { direction = '≥ (达到)'; expectedOp = '≥'; }

    // 验证：如果有负阈值且未被前两个分支捕获
    var hasNegative = numbers.some(function(n){return n < 0;});

    I(an + ': "' + desc + '" → 字段=' + matched + ' 阈值=' + threshold + ' ' + direction +
      (hasNegative ? ' [含负数]' : ''));

    if (hasNegative && !isNeverExceeded && !isBelow && threshold >= 0) {
      achIssues.push({ name: an, desc: desc, issue: 'desc 含负数(' + numbers.join(',') + ') 但标签后阈值=' + threshold + ' — 可能匹配到别的数字' });
    }
  }

  if (achIssues.length === 0) {
    P('所有可见成就 desc 解析自洽');
  } else {
    achIssues.forEach(function(ai){ W(ai.name + ': ' + ai.issue); });
    warn += achIssues.length;
  }

  // ═══════════════════════════════════════════
  H('4. 隐藏成就 — trigger 结构检查');
  // ═══════════════════════════════════════════

  if (Object.keys(hidden).length === 0) {
    I('无隐藏成就定义 — 跳过');
  } else {
    for (var hn in hidden) {
      if (!hidden.hasOwnProperty(hn)) continue;
      var ha = hidden[hn];
      var trig = ha.trigger || {};

      if (trig.type === 'field_zero' || trig.type === 'field_max_under') {
        // 检查 field/fieldLabel 兼容
        var fieldSrc = trig.fieldLabel || trig.field || '';
        if (!fieldSrc) {
          F(hn + ': trigger.type=' + trig.type + ' 但既无 fieldLabel 也无 field');
        } else {
          var fid = _findFieldId(fieldSrc);
          if (fid) {
            P(hn + ': field="' + fieldSrc + '" → _findFieldId → "' + fid + '"');
          } else {
            W(hn + ': field="' + fieldSrc + '" → _findFieldId → null (字段未找到)');
            warn++;
          }
        }
      } else {
        I(hn + ': type=' + trig.type + ' (非字段型)');
      }
    }
  }

  // ═══════════════════════════════════════════
  H('5. 运行时 — 可见成就触发模拟');
  // ═══════════════════════════════════════════

  // 保存状态
  var savedFh = JSON.parse(JSON.stringify(gameState.fieldHistory || {}));
  var savedUnlocked = JSON.parse(JSON.stringify(getUnlockedAchievements() || {}));
  var savedEndingTriggered = gameState.achievementFlags.endingTriggered;
  var savedTriggeredEndings = JSON.parse(JSON.stringify(gameState.achievementFlags.triggeredEndings || []));
  var savedLoadingSave = gameState._loadingSave;

  // 清除所有已解锁成就（仅测试用，最后会恢复）
  var testUnlocked = {};
  function resetTestUnlocked() { testUnlocked = {}; }
  function isTestUnlocked(name) { return !!testUnlocked[name]; }
  function setTestUnlocked(name) { testUnlocked[name] = new Date().toISOString().slice(0,10); }

  // 临时替换 unlockAchievement 和 getUnlockedAchievements
  var origUnlock = unlockAchievement;
  var origGetUnlocked = getUnlockedAchievements;
  unlockAchievement = function(name) {
    if (isTestUnlocked(name)) return false;
    setTestUnlocked(name);
    return true;
  };
  getUnlockedAchievements = function() { return JSON.parse(JSON.stringify(testUnlocked)); };

  // 防止 toast 干扰
  var origToast = showAchievementToast;
  showAchievementToast = function(){};

  // 设置 fieldHistory 模拟不同场景
  gameState._loadingSave = false;
  gameState.achievementFlags.endingTriggered = false;
  gameState.achievementFlags.triggeredEndings = [];

  // 确保 fullHistory 有足够回合（绕过 roundNum<2 守卫）
  if (!gameState.fullHistory) gameState.fullHistory = [];
  while (gameState.fullHistory.filter(function(m){return m.role==='user';}).length < 2) {
    gameState.fullHistory.push({ role: 'user', content: 'test' });
    gameState.fullHistory.push({ role: 'assistant', content: 'test response' });
  }

  // 对每个数值型可见成就做正向/反向测试
  var testCount = 0, testPassed = 0;
  for (var an2 in achievements) {
    if (!achievements.hasOwnProperty(an2)) continue;
    var desc = achievements[an2].desc || '';
    if (/结局|孤注|反杀|设局|交易/.test(desc) && !/\d/.test(desc)) continue;

    var allLabels2 = allFields.map(function(f){return f.label;}).sort(function(a,b){return b.length-a.length;});
    var matched2 = null;
    for (var li2 = 0; li2 < allLabels2.length; li2++) {
      if (desc.includes(allLabels2[li2])) { matched2 = allLabels2[li2]; break; }
    }
    if (!matched2) continue;

    var idx2 = desc.indexOf(matched2);
    var after2 = desc.substring(idx2 + matched2.length);
    var nm2 = after2.match(/(-?\d+)/);
    if (!nm2) continue;
    var thresh = parseInt(nm2[1]);

    var isNever = /从未超过/.test(desc);
    var isBelow = /低于|不超过|少于|以下|小于|≤/.test(desc);
    var negThresh = thresh < 0;

    var fid = _findFieldId(matched2);
    if (!fid) continue;

    // 正向测试：设置满足条件的值
    resetTestUnlocked();
    gameState.fieldHistory = {};
    if (isNever) {
      // 从未超过X：max应≤X
      var valOk = Math.max(0, thresh - 5);
      gameState.fieldHistory[fid] = { current: valOk, max: valOk };
    } else if (isBelow || negThresh) {
      // ≤ 判定
      var valOk2;
      if (negThresh) valOk2 = thresh - 5;  // 更负
      else valOk2 = Math.max(0, thresh - 5);
      gameState.fieldHistory[fid] = { current: valOk2, max: valOk2 };
    } else {
      // ≥ 判定
      gameState.fieldHistory[fid] = { current: thresh, max: thresh };
    }

    var parsedOk = {};
    parsedOk[fid] = String(gameState.fieldHistory[fid].current);
    checkAchievementsFromState({ fields: parsedOk });
    var triggeredOk = isTestUnlocked(an2);
    testCount++;

    if (triggeredOk) {
      testPassed++;
    } else {
      W(an2 + ': 应触发但未触发 (desc="' + desc + '", thresh=' + thresh + ', val=' + gameState.fieldHistory[fid].current + ', direction=' +
        (isNever ? '从未超过' : isBelow ? '低于' : negThresh ? '负阈值' : '达到') + ')');
    }

    // 反向测试：设置不满足条件的值
    resetTestUnlocked();
    if (isNever) {
      var valBad = thresh + 10;
      gameState.fieldHistory[fid] = { current: valBad, max: valBad };
    } else if (isBelow || negThresh) {
      var valBad2;
      if (negThresh) valBad2 = thresh + 10;  // 不够负
      else valBad2 = thresh + 10;
      gameState.fieldHistory[fid] = { current: valBad2, max: valBad2 };
    } else {
      gameState.fieldHistory[fid] = { current: Math.max(0, thresh - 3), max: Math.max(0, thresh - 3) };
    }

    var parsedBad = {};
    parsedBad[fid] = String(gameState.fieldHistory[fid].current);
    checkAchievementsFromState({ fields: parsedBad });
    var triggeredBad = isTestUnlocked(an2);

    if (!triggeredBad) {
      testPassed++;
    } else {
      W(an2 + ': 不应触发但触发了 (val=' + gameState.fieldHistory[fid].current + ', thresh=' + thresh + ')');
    }
    testCount++;
  }

  if (testCount > 0) {
    check(testPassed === testCount,
      '运行时触发模拟: ' + testPassed + '/' + testCount + ' 个方向判定正确');
  } else {
    I('无数值型可见成就可测试');
  }

  // ═══════════════════════════════════════════
  H('6. 隐藏成就 — field_zero / field_max_under 运行时');
  // ═══════════════════════════════════════════

  var hiddenFieldsToTest = [];
  for (var hn3 in hidden) {
    if (!hidden.hasOwnProperty(hn3)) continue;
    var trig3 = hidden[hn3].trigger || {};
    if (trig3.type === 'field_zero' || trig3.type === 'field_max_under') {
      hiddenFieldsToTest.push({ name: hn3, trigger: trig3 });
    }
  }

  if (hiddenFieldsToTest.length === 0) {
    I('无字段型隐藏成就 — 跳过');
  } else {
    for (var hti = 0; hti < hiddenFieldsToTest.length; hti++) {
      var ht = hiddenFieldsToTest[hti];
      var ttype = ht.trigger.type;
      resetTestUnlocked();

      // 需要 endingTriggered=true
      gameState.achievementFlags.endingTriggered = true;

      if (ttype === 'field_zero') {
        var fieldSrc = ht.trigger.fieldLabel || ht.trigger.field || '';
        var fid3 = _findFieldId(fieldSrc);
        gameState.fieldHistory = {};
        if (fid3) {
          gameState.fieldHistory[fid3] = { current: 0, max: 5 };
          checkHiddenAchievements({ fields: {} });
          if (isTestUnlocked(ht.name)) {
            P('field_zero: "' + ht.name + '" → 触发 (field=0 + endingTriggered)');
          } else {
            W('field_zero: "' + ht.name + '" → 未触发 (检查 endingTriggered/hasOwnProperty)');
            warn++;
          }
        }
      } else if (ttype === 'field_max_under') {
        var fieldSrc2 = ht.trigger.fieldLabel || ht.trigger.field || '';
        var fid4 = _findFieldId(fieldSrc2);
        gameState.fieldHistory = {};
        if (fid4) {
          var thr = ht.trigger.threshold || 50;
          // 设置 max < threshold 应触发
          gameState.fieldHistory[fid4] = { current: thr - 5, max: thr - 5 };
          checkHiddenAchievements({ fields: {} });
          if (isTestUnlocked(ht.name)) {
            P('field_max_under: "' + ht.name + '" → 触发 (max=' + (thr-5) + '≤' + thr + ' + endingTriggered)');
          } else {
            W('field_max_under: "' + ht.name + '" → 未触发 (检查 v>0 守卫/fid匹配)');
            warn++;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  H('7. _fieldVal — 负数值保留');
  // ═══════════════════════════════════════════

  // 找所有可能为负的字段（范围含负数）
  var negFields = allFields.filter(function(f){
    if (!f.id || !f.label) return false;
    var h = gameState.fieldHistory && gameState.fieldHistory[f.id];
    // 如果字段名含"觊觎/敌意/恨意/厌恶"等可能是负向
    return /觊觎|恨|敌|厌恶|恐惧|怀疑/.test(f.label || '') || /觊觎|恨|敌|厌恶|恐惧|怀疑/.test(f.id || '');
  });

  if (negFields.length === 0) {
    I('无负向字段 — 跳过');
  } else {
    for (var nfi = 0; nfi < negFields.length; nfi++) {
      var nf = negFields[nfi];
      var savedEntry = gameState.fieldHistory && gameState.fieldHistory[nf.id];
      if (!gameState.fieldHistory) gameState.fieldHistory = {};
      gameState.fieldHistory[nf.id] = { current: -60, max: 0 };

      var vCur = _fieldVal(nf.label, false);
      check(vCur === -60, '_fieldVal("' + nf.label + '", useMax=false) → ' + vCur + ' (负数值保留)');

      var vMax = _fieldVal(nf.label, true);
      check(vMax === 0, '_fieldVal("' + nf.label + '", useMax=true) → ' + vMax + ' (max=0, 下降型)');

      if (savedEntry) gameState.fieldHistory[nf.id] = savedEntry;
      else delete gameState.fieldHistory[nf.id];
    }
  }

  // ═══════════════════════════════════════════
  H('8. 进度条百分比计算');
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

  check(calcPct(5, 3) === 60, '正阈值: 3/5 = ' + calcPct(5,3) + '% (expect 60%)');
  check(calcPct(5, 0) === 0, '正阈值: 0/5 = ' + calcPct(5,0) + '% (expect 0%)');
  check(calcPct(5, 7) === 100, '正阈值: 7/5 → cap ' + calcPct(5,7) + '% (expect 100%)');
  check(calcPct(-50, 0) === 0, '负阈值: 0→-50, cur=0 = ' + calcPct(-50,0) + '% (expect 0%)');
  check(calcPct(-50, -30) === 60, '负阈值: 0→-50, cur=-30 = ' + calcPct(-50,-30) + '% (expect 60%)');
  check(calcPct(-50, -50) === 100, '负阈值: 0→-50, cur=-50 = ' + calcPct(-50,-50) + '% (expect 100%)');
  check(calcPct(-50, -70) === 100, '负阈值: 溢出钳制 = ' + calcPct(-50,-70) + '% (expect 100%)');

  // ═══════════════════════════════════════════
  H('9. 静态源码检查');
  // ═══════════════════════════════════════════

  var srcCheck = addNewAchievement.toString();
  var hasClamp = /Math\.max\(0,\s*parseInt/.test(srcCheck);
  check(!hasClamp, 'addNewAchievement 源码无 Math.max(0, parseInt(...)) 钳制');

  var srcCheckHA = checkHiddenAchievements.toString();
  var hasFieldFallback = /trigger\.fieldLabel\s*\|\|\s*trigger\.field/.test(srcCheckHA);
  check(hasFieldFallback, 'checkHiddenAchievements 含 trigger.field 回退逻辑');

  var srcCheckFF = _findFieldId.toString();
  var hasEmptyGuard = /!labelPart/.test(srcCheckFF);
  check(hasEmptyGuard, '_findFieldId 含空串守卫');

  // ═══════════════════════════════════════════
  H('10. getAchievementProgress 测试');
  // ═══════════════════════════════════════════

  var savedFh10 = JSON.parse(JSON.stringify(gameState.fieldHistory || {}));
  gameState.fieldHistory = {};

  // 对每个数值型成就测试进度
  var progOk = 0, progTotal = 0;
  for (var an10 in achievements) {
    if (!achievements.hasOwnProperty(an10)) continue;
    var desc10 = achievements[an10].desc || '';
    if (/结局|孤注|反杀|设局|交易/.test(desc10) && !/\d/.test(desc10)) continue;

    var matched10 = null;
    var allLabels10 = allFields.map(function(f){return f.label;}).sort(function(a,b){return b.length-a.length;});
    for (var li10 = 0; li10 < allLabels10.length; li10++) {
      if (desc10.includes(allLabels10[li10])) { matched10 = allLabels10[li10]; break; }
    }
    if (!matched10) continue;

    var nm10 = desc10.match(/(-?\d+)/);
    if (!nm10) continue;
    var thresh10 = parseInt(nm10[1]);

    var fid10 = _findFieldId(matched10);
    if (!fid10) continue;

    // 设置值为阈值的一半
    var isNever10 = /从未超过/.test(desc10);
    var isBelow10 = /低于|不超过|少于|以下|小于|≤/.test(desc10);
    var neg10 = thresh10 < 0;
    var halfVal;
    if (isNever10 || isBelow10 || neg10) {
      halfVal = neg10 ? Math.round(thresh10 / 2) : Math.round(thresh10 / 2);
      if (isNever10) halfVal = Math.round(thresh10 / 2);  // max 为正
    } else {
      halfVal = Math.round(thresh10 / 2);
    }
    gameState.fieldHistory[fid10] = { current: halfVal, max: isNever10 ? halfVal : halfVal };

    var prog = getAchievementProgress(an10);
    progTotal++;
    if (prog && prog.target !== null && prog.current !== null) {
      progOk++;
    } else {
      W(an10 + ': getAchievementProgress 返回异常: ' + JSON.stringify(prog));
      warn++;
    }
  }

  if (progTotal > 0) {
    check(progOk === progTotal, 'getAchievementProgress: ' + progOk + '/' + progTotal + ' 个成就返回有效进度');
  } else {
    I('无数值型成就可测试进度');
  }

  // ── 恢复状态 ──
  gameState.fieldHistory = savedFh;
  gameState.achievementFlags.endingTriggered = savedEndingTriggered;
  gameState.achievementFlags.triggeredEndings = savedTriggeredEndings;
  gameState._loadingSave = savedLoadingSave;
  unlockAchievement = origUnlock;
  getUnlockedAchievements = origGetUnlocked;
  showAchievementToast = origToast;
  testUnlocked = {};
  gameState.fieldHistory = savedFh10;

  // ═══════════════════════════════════════════
  H('总结');
  // ═══════════════════════════════════════════

  var total = pass + fail + warn;
  console.log('\n  ✅ ' + pass + ' passed  ❌ ' + fail + ' failed  ⚠️ ' + warn + ' warnings  (' + total + ' total)');

  if (fail === 0 && warn === 0) {
    console.log('%c  🎉 成就系统全部检测通过！', 'color:#4caf50;font-size:16px;font-weight:bold');
  } else if (fail === 0) {
    console.log('%c  ⚠️ ' + warn + ' 项警告 — 查看上方 WARN 行', 'color:#ff9800;font-size:16px;font-weight:bold');
  } else {
    console.log('%c  ❌ ' + fail + ' 项失败 — 查看上方 FAIL 行', 'color:#f44336;font-size:16px;font-weight:bold');
  }

  console.log('\n%c  手动验证清单:', 'color:#ffd54f;');
  console.log('  1. 进入游戏玩几回合 → 打开成就面板 → 查看进度条是否正常');
  console.log('  2. 如果有负值字段（如圣灵教觊觎），降低到阈值以下 → 是否触发');
  console.log('  3. 触发结局后 → 隐藏成就(field_zero/field_max_under)是否解锁');
  console.log('  4. F12 控制台 → 不应有"结局条件引用未知字段"warning');

})();
