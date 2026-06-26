/* 音效按钮尺寸诊断 — 浏览器控制台粘贴运行 */
(function(){
  var btn = document.getElementById('btn-audio');
  if (!btn) { console.log('❌ 未找到 #btn-audio'); return; }

  // 记录初始尺寸
  var r1 = btn.getBoundingClientRect();
  console.log('初始:', r1.width.toFixed(1) + '×' + r1.height.toFixed(1),
    '| fontSize:', getComputedStyle(btn).fontSize,
    '| padding:', getComputedStyle(btn).padding,
    '| display:', getComputedStyle(btn).display);

  // 检查所有匹配的CSS规则
  console.log('\n--- 匹配的CSS规则 ---');
  var sheets = document.styleSheets;
  var count = 0;
  for (var i = 0; i < sheets.length; i++) {
    try {
      var rules = sheets[i].cssRules || sheets[i].rules || [];
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        if (rule.selectorText && btn.matches(rule.selectorText)) {
          console.log('  ' + rule.selectorText + ' { ' + (rule.style.cssText || '').substring(0, 200) + ' }');
          count++;
          if (count > 30) { console.log('  ... (截断)'); return; }
        }
      }
    } catch(e) {}
  }

  // 模拟点击，观察变化
  console.log('\n--- 点击后 ---');
  btn.click();
  setTimeout(function(){
    var r2 = btn.getBoundingClientRect();
    console.log('点击后:', r2.width.toFixed(1) + '×' + r2.height.toFixed(1),
      '| 变化: Δ' + (r2.width-r1.width).toFixed(1) + '×Δ' + (r2.height-r1.height).toFixed(1));
    console.log('transform:', getComputedStyle(btn).transform);
    console.log('textContent:', '"' + btn.textContent + '"');
    // 检查是否有子元素溢出
    btn.childNodes.forEach(function(c,i){
      if(c.nodeType===1) console.log('  子元素#'+i+':', c.tagName, c.className, c.getBoundingClientRect().width.toFixed(1)+'×'+c.getBoundingClientRect().height.toFixed(1));
    });

    // 恢复
    btn.click();
    setTimeout(function(){
      btn.click();
      var r3 = btn.getBoundingClientRect();
      console.log('\n最终:', r3.width.toFixed(1) + '×' + r3.height.toFixed(1),
        '| vs初始 Δ' + (r3.width-r1.width).toFixed(1));
    }, 100);
  }, 100);
})();
