/* 结局诊断 v2 — fetch('/js/test.js').then(r=>r.text()).then(eval) */
(async function diagV2() {
  var P = function(m) { console.log('%cPASS  %c'+m, 'color:#4caf50;font-weight:bold', 'color:inherit'); };
  var F = function(m) { console.log('%cFAIL  %c'+m, 'color:#f44336;font-weight:bold', 'color:inherit'); };
  var W = function(m) { console.log('%cWARN  %c'+m, 'color:#ff9800;font-weight:bold', 'color:inherit'); };
  var H = function(m) { console.log('%c\n=== '+m+' ===', 'color:#ffd54f;font-size:14px;'); };
  var I = function(m) { console.log(m); };

  H('1. promptBody 结局章节全文');
  var tpl = getActiveTemplate();
  var body = tpl.promptBody || '';
  I('promptBody 总长度: ' + body.length + ' 字符');

  // 直接定位【结局系统】章节
  var idxStart = body.indexOf('【结局系统】');
  if (idxStart < 0) {
    F('promptBody 中完全没有【结局系统】章节！');
  } else {
    // 找下一个【XXX】章节作为结束标记
    var nextIdx = body.indexOf('【', idxStart + 7);
    if (nextIdx < 0) nextIdx = body.length;
    var endingFull = body.substring(idxStart, nextIdx);
    I('--- 【结局系统】全文 (' + endingFull.length + ' 字符) ---');
    I(endingFull);
    I('--- 结束 ---');
    if (endingFull.length < 300) F('结局章节太短(' + endingFull.length + '字)，缺失多个结局条件');
    else P('结局章节长度正常(' + endingFull.length + '字)');
  }

  H('2. 结局条件提及的字段 vs 实际追踪字段');
  // 从结局章节提取所有中文标签
  var endingText = body.substring(body.indexOf('【结局系统】'), body.indexOf('【', body.indexOf('【结局系统】')+7));
  if (endingText.length < 10) endingText = body;

  // 提取所有形如 "XX字段≥N" 中的字段名
  var fieldRefs = [];
  var re = /([一-龥]{2,6}?)\s*[≥≤=]/g;
  var m;
  while ((m = re.exec(endingText)) !== null) {
    if (fieldRefs.indexOf(m[1]) < 0) fieldRefs.push(m[1]);
  }

  // 收集模板中所有字段的 label
  var allFields = [];
  for (var sk in tpl.outputSections) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    var fs = tpl.outputSections[sk].fields || [];
    for (var i = 0; i < fs.length; i++) allFields.push(fs[i]);
  }

  I('结局条件引用的字段: ' + (fieldRefs.length > 0 ? fieldRefs.join(', ') : '(无)'));
  I('模板实际定义的字段:');
  for (var i = 0; i < allFields.length; i++) {
    var f = allFields[i];
    var h = (gameState.fieldHistory || {})[f.id];
    var v = h ? (h.current != null ? h.current : h.currentText) : '--';
    var match = '';
    for (var j = 0; j < fieldRefs.length; j++) {
      if (f.label === fieldRefs[j] || f.label.indexOf(fieldRefs[j]) >= 0 || fieldRefs[j].indexOf(f.label) >= 0) {
        match = ' ← 结局引用';
      }
    }
    I('  ' + (f.icon||'') + ' ' + f.label + ' (' + f.id + ') = ' + v + ' [' + (f.type||'text') + ']' + match);
  }

  H('3. 字段名匹配检查');
  for (var j = 0; j < fieldRefs.length; j++) {
    var ref = fieldRefs[j];
    var found = false;
    for (var i = 0; i < allFields.length; i++) {
      if (allFields[i].label === ref || allFields[i].label.indexOf(ref) >= 0 || ref.indexOf(allFields[i].label) >= 0) {
        var h = (gameState.fieldHistory || {})[allFields[i].id];
        var v = h ? (h.current != null ? h.current : h.currentText) : '--';
        I('  ' + ref + ' → 匹配字段: ' + allFields[i].label + ' (' + allFields[i].id + ') = ' + v);
        found = true;
        break;
      }
    }
    if (!found) {
      F('  ' + ref + ' → 未匹配到任何模板字段！AI无法追踪此值');
    }
  }

  H('4. 手动模拟AI的判断');
  // 找出情报进展相关
  var intelProgressField = null;
  var intelField = null;
  for (var i = 0; i < allFields.length; i++) {
    if (allFields[i].label.indexOf('情报进展') >= 0) intelProgressField = allFields[i];
    if (allFields[i].label.indexOf('情报碎片') >= 0) intelField = allFields[i];
  }
  var intelProgressVal = intelProgressField ? (gameState.fieldHistory[intelProgressField.id] || {}).current : null;
  var intelVal = intelField ? (gameState.fieldHistory[intelField.id] || {}).current : null;

  I('情报碎片(intel) = ' + intelVal);
  I('情报进展(intelProgress) = ' + intelProgressVal);

  if (intelVal >= 3 && intelProgressVal != null && intelProgressVal < 3) {
    F('字段名不匹配！结局条件要求"情报进展≥3"，但情报进展=' + intelProgressVal + '。玩家以为的"情报3"实际是"情报碎片="'+intelVal+'"');
    I('  → 这两个是不同的字段。AI正确检查了情报进展('+intelProgressVal+')，不满足≥3条件。');
    I('  → 修复方案：把结局条件中的"情报进展"改为"情报碎片"，或让AI追踪时合并两个字段。');
  }

  H('5. 发给AI的系统提示词(末尾800字)');
  var sp = gameState.activeSystemPrompt || '';
  I(sp.substring(Math.max(0, sp.length - 800)));

  H('6. 手动触发测试');
  I('如果以上都正常，手动触发结局看看弹窗是否工作:');
  I('  showEndingOverlay("快速撤离", {situation:"测试结局弹窗",raw:"测试"});');
})();
