/* 字体切换字段消失诊断 — F12 控制台粘贴运行 */
(function(){
console.clear();
console.log('🔍 字体切换诊断开始\n');

// 1. 当前状态快照
var vals = document.querySelectorAll('.status-value');
var before = [];
vals.forEach(function(el,i){
  before.push({id:el.id, text:el.textContent, html:el.innerHTML});
});
console.log('📊 切换前字段值:', before.map(function(v){return v.id+'='+v.textContent;}).join(', '));

// 2. 检查 fieldHistory
console.log('📦 fieldHistory keys:', Object.keys(gameState.fieldHistory||{}).length);
var fhSample = {};
var fh = gameState.fieldHistory || {};
Object.keys(fh).slice(0,5).forEach(function(k){
  fhSample[k] = fh[k].current || fh[k].currentText || '?';
});
console.log('📦 fieldHistory 样本:', fhSample);

// 3. 拦截 renderStatusContainers
var origRender = window.renderStatusContainers;
var renderCalled = false;
window.renderStatusContainers = function(){
  renderCalled = true;
  console.warn('⚠ renderStatusContainers 被调用了！stack:', new Error().stack.substring(0,300));
  return origRender.apply(this, arguments);
};

// 4. 拦截 updateAllDynamicFieldsFromHistory
var origUpdate = window.updateAllDynamicFieldsFromHistory;
var updateCalled = false;
window.updateAllDynamicFieldsFromHistory = function(){
  updateCalled = true;
  console.log('✅ updateAllDynamicFieldsFromHistory 被调用');
  return origUpdate.apply(this, arguments);
};

// 5. 监听 status-value 的 DOM 变化
var targetNode = document.getElementById('status-grid');
if (targetNode) {
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.type === 'characterData') {
        console.warn('⚠ status-grid 文本变化:', m.target.textContent?.substring(0,50));
      }
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        console.warn('⚠ status-grid 新增子元素:', m.addedNodes.length + '个');
      }
    });
  });
  observer.observe(targetNode, { childList:true, subtree:true, characterData:true });
}

// 6. 执行一次字体切换
console.log('\n--- 模拟字体切换 ---');
var sel = document.getElementById('font-selector');
if (!sel) { console.log('❌ 未找到 #font-selector'); return; }

var oldVal = sel.value;
var newVal = oldVal === 'kai' ? 'sans' : 'kai';
console.log('切换: ' + oldVal + ' → ' + newVal);

// 手动触发 change
sel.value = newVal;
sel.dispatchEvent(new Event('change'));

// 7. 检查切换后
setTimeout(function(){
  console.log('\n--- 切换后 100ms ---');
  var after = [];
  document.querySelectorAll('.status-value').forEach(function(el){
    after.push({id:el.id, text:el.textContent});
  });
  console.log('📊 切换后字段值:', after.map(function(v){return v.id+'='+v.textContent;}).join(', '));

  var lost = before.filter(function(b){
    var a = after.find(function(x){return x.id===b.id;});
    return a && b.text !== '—' && a.text === '—';
  });
  if (lost.length > 0) {
    console.error('❌ 丢失的字段:', lost.map(function(v){return v.id+': '+v.text+'→—';}).join(', '));
    console.error('❌ renderStatusContainers被调?', renderCalled);
    console.error('❌ updateAllDynamicFieldsFromHistory被调?', updateCalled);
  } else {
    console.log('✅ 所有字段值完好');
  }

  // 再等一帧
  requestAnimationFrame(function(){
    setTimeout(function(){
      console.log('\n--- 切换后 200ms ---');
      var after2 = [];
      document.querySelectorAll('.status-value').forEach(function(el){
        after2.push({id:el.id, text:el.textContent});
      });
      var lost2 = before.filter(function(b){
        var a2 = after2.find(function(x){return x.id===b.id;});
        return a2 && b.text !== '—' && a2.text === '—';
      });
      if (lost2.length > 0) {
        console.error('❌ 200ms后仍丢失:', lost2.map(function(v){return v.id;}).join(','));
      } else {
        console.log('✅ 200ms后字段完好');
      }

      // 恢复
      window.renderStatusContainers = origRender;
      window.updateAllDynamicFieldsFromHistory = origUpdate;
      observer.disconnect();
      console.log('\n🔍 诊断完成。请截图发给我。');
    }, 100);
  });
}, 100);

})();
