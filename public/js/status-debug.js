/* 状态栏"—"根因诊断 — F12 粘贴: */
(function(){
console.clear();
var REPORT = [];

function log(msg, detail){
  var entry = '[' + performance.now().toFixed(0) + 'ms] ' + msg;
  console.log(entry, detail || '');
  REPORT.push(entry);
}

// ═══ 1. 快照当前所有 status-value ═══
var vals = document.querySelectorAll('.status-value');
log('📊 当前字段数: ' + vals.length);
vals.forEach(function(el){
  log('  ' + el.id + ' = "' + el.textContent + '" | parentNode:', el.parentNode?.outerHTML?.substring(0,80));
});

// ═══ 2. 检查 fieldHistory ═══
var fh = gameState.fieldHistory || {};
var fhKeys = Object.keys(fh);
log('📦 fieldHistory 共 ' + fhKeys.length + ' 个字段');
fhKeys.forEach(function(k){
  var h = fh[k];
  log('  ' + k + ': current=' + h.current + ' currentText=' + h.currentText + ' max=' + h.max);
});

// ═══ 3. 检查模板 outputSections ═══
var tpl = (typeof getActiveTemplate === 'function') ? getActiveTemplate() : null;
if (tpl && tpl.outputSections) {
  log('📋 模板字段:');
  for (var sk in tpl.outputSections) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    var fs = tpl.outputSections[sk].fields || [];
    fs.forEach(function(f){
      var el = document.getElementById('field-' + f.id);
      log('  ' + sk + '.' + f.id + ' (' + f.label + ') DOM存在=' + !!el + ' type=' + f.type);
    });
  }
}

// ═══ 4. 手动跑一遍 updateAllDynamicFieldsFromHistory ═══
log('\n--- 手动调用 updateAllDynamicFieldsFromHistory ---');
if (typeof updateAllDynamicFieldsFromHistory === 'function') {
  updateAllDynamicFieldsFromHistory();
  setTimeout(function(){
    log('📊 调用后字段值:');
    document.querySelectorAll('.status-value').forEach(function(el){
      log('  ' + el.id + ' = "' + el.textContent + '"');
    });
  }, 50);
}

// ═══ 5. 检查是否有多余的 renderStatusContainers 调用 ═══
var origRSC = window.renderStatusContainers;
var rscCount = 0;
window.renderStatusContainers = function(){
  rscCount++;
  var stack = new Error().stack;
  var caller = stack.split('\n')[2]?.trim() || 'unknown';
  log('⚠ renderStatusContainers 第' + rscCount + '次调用 from: ' + caller.substring(0,100));
  return origRSC.apply(this, arguments);
};

// ═══ 6. 模拟打开设置 ═══
log('\n--- 模拟 openSettings ---');
setTimeout(function(){
  var btn = document.getElementById('btn-settings');
  if (btn) {
    log('点击 ⚙️ 设置按钮...');
    btn.click();
    setTimeout(function(){
      log('📊 打开设置后字段值:');
      document.querySelectorAll('.status-value').forEach(function(el){
        log('  ' + el.id + ' = "' + el.textContent + '"');
      });
      log('renderStatusContainers 被调用了 ' + rscCount + ' 次');

      // 关闭设置
      setTimeout(function(){
        var closeBtn = document.getElementById('btn-close-settings');
        if (closeBtn) {
          log('\n点击关闭设置...');
          closeBtn.click();
          setTimeout(function(){
            log('📊 关闭设置后字段值:');
            document.querySelectorAll('.status-value').forEach(function(el){
              log('  ' + el.id + ' = "' + el.textContent + '"');
            });
            // 恢复
            window.renderStatusContainers = origRSC;
            log('\n✅ 诊断完成。如果字段还是"—"，请截图完整日志');
          }, 500);
        }
      }, 500);
    }, 500);
  } else {
    log('❌ 未找到设置按钮');
  }
}, 200);

})();
