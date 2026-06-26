/* 字段消失根因追踪 v2 — 拦截关键函数 */
(function(){
console.clear();
var log = console.log;

// ═══ 1. 拦截 updateAllDynamicFieldsFromHistory ═══
var origUpdate = window.updateAllDynamicFieldsFromHistory;
window.updateAllDynamicFieldsFromHistory = function(){
  var fh = gameState.fieldHistory || {};
  var missing = [], zeroVals = [], okVals = [];
  Object.keys(fh).forEach(function(k){
    var h = fh[k];
    var v = h.currentText || (h.current != null ? String(h.current) : null);
    if (v == null || v === '—') missing.push(k + '=' + JSON.stringify({c:h.current,ct:h.currentText}));
    else if (v === '0') zeroVals.push(k);
    else okVals.push(k + '=' + v);
  });
  log('📞 updateAllDynamicFieldsFromHistory 被调用');
  if (missing.length) log('  ⚠ 缺失/横杠字段: ' + missing.join(', '));
  if (zeroVals.length) log('  ⚪ 零值字段: ' + zeroVals.join(', '));
  log('  ✅ 正常字段: ' + okVals.join(', '));
  log('  📍 调用栈: ' + (new Error().stack.split('\n')[2]?.trim()?.substring(0,100) || '?'));
  return origUpdate.apply(this, arguments);
};

// ═══ 2. 拦截 updateFieldHistoryFromParsed ═══
var origParsed = window.updateFieldHistoryFromParsed;
window.updateFieldHistoryFromParsed = function(parsed){
  if (!parsed || !parsed.fields) return;
  log('📞 updateFieldHistoryFromParsed, parsed.fields keys: ' + Object.keys(parsed.fields).join(','));
  Object.keys(parsed.fields).forEach(function(k){
    var v = parsed.fields[k];
    if (v === '—' || v == null) log('  ⚠ ' + k + ' = "' + v + '" (即将写入横杠)');
  });
  return origParsed.apply(this, arguments);
};

// ═══ 3. 拦截 openSettings ═══
var origOpen = window.openSettings;
window.openSettings = function(){
  log('\n--- openSettings ---');
  var fh = gameState.fieldHistory || {};
  var sample = {};
  ['stress','exposure','round','intel','mengHaoGan'].forEach(function(k){
    var h = fh[k];
    sample[k] = h ? (h.current || h.currentText || '?') : 'MISSING';
  });
  log('  打开前 fieldHistory 样本: ' + JSON.stringify(sample));
  var result = origOpen.apply(this, arguments);
  // 异步检查打开后
  setTimeout(function(){
    var after = {};
    ['stress','exposure','round','intel','mengHaoGan'].forEach(function(k){
      var h = gameState.fieldHistory[k];
      after[k] = h ? (h.current || h.currentText || '?') : 'MISSING';
    });
    log('  打开后 fieldHistory 样本: ' + JSON.stringify(after));
    // 对比
    var changed = [];
    Object.keys(sample).forEach(function(k){
      if (sample[k] !== after[k]) changed.push(k + ': ' + sample[k] + '→' + after[k]);
    });
    if (changed.length) log('  🔴 变化: ' + changed.join(', '));
    else log('  ✅ 无变化');
  }, 300);
  return result;
};

// ═══ 4. 检查当前状态 ═══
var fh = gameState.fieldHistory || {};
log('📊 当前 fieldHistory:');
Object.keys(fh).forEach(function(k){
  var h = fh[k];
  log('  ' + k + ': current=' + h.current + ' currentText=' + (h.currentText || 'undefined') + ' max=' + h.max);
});

log('\n🔍 追踪已激活。现在去打开设置。');
})();
