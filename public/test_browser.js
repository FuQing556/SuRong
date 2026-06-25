// ═══════════════════════════════════
// 浏览器端功能诊断 · 粘贴到F12控制台运行
// ═══════════════════════════════════
(async function() {
let ok=0,bad=0;
function t(label, cond) { if(cond){ok++;console.log('%c✅ '+label,'color:#3fb950')}else{bad++;console.log('%c❌ '+label,'color:#f85149')} }

console.clear();
console.log('%c════════════════════════════════%c','color:#c9a96e','');
console.log('%c  互动叙事 · 浏览器端诊断%c','color:#c9a96e','');
console.log('%c════════════════════════════════%c','color:#c9a96e','');
console.log('');

// ═══ 1. DOM 元素 ═══
console.log('%c📦 1. DOM元素','color:#c9a96e');
t('警告弹窗', !!document.querySelector('#warning-overlay'));
t('序章弹窗', !!document.querySelector('#prologue-overlay'));
t('存档选择器', !!document.querySelector('#save-selector-overlay'));
t('创建存档', !!document.querySelector('#create-save-overlay'));
t('设置弹窗', !!document.querySelector('#settings-overlay'));
t('成就面板', !!document.querySelector('#achievements-overlay'));
t('结局弹窗', !!document.querySelector('#ending-overlay'));
t('帮助弹窗', !!document.querySelector('#help-overlay'));
t('历程回顾弹窗', !!document.querySelector('#history-overlay'));
t('自定义对话框', !!document.querySelector('#dialog-overlay'));
t('游戏容器', !!document.querySelector('#game-container'));
t('4个选项按钮', document.querySelectorAll('.option-btn').length===4);
t('状态面板', !!document.querySelector('#status-panel'));
t('AI聊天框', !!document.querySelector('#ai-chat-box'));
t('酒馆搜索框', !!document.querySelector('#tavern-search'));
t('顶栏按钮齐全', ['btn-manual-save','btn-history','btn-export-story','btn-undo','btn-help','btn-achievements','btn-settings'].every(id=>!!document.querySelector('#'+id)));
t('合并提示词按钮', !!document.querySelector('#btn-ai-save-prompt'));

// ═══ 2. 全局函数 ═══
console.log('%c⚡ 2. 全局函数','color:#c9a96e');
const funcs = [
  'init','showSaveSelector','startNewGame','continueGame','selectSave',
  'sendMessage','handleChoice','parseAIResponse','renderGameState',
  'updateOptionButtonsV2','renderAchievementsPanelV2','checkAchievementsFromState',
  'detectEnding','showEndingOverlay','escapeHtml',
  'showDialog','dlAlert','dlConfirm','dlPrompt',
  'getSaveKey','saveGameState','loadGameState','manualSave','clearAllSaves',
  'exportStory','undoLastRound','renderHistoryModal','mergeInstructionsToPrompt',
  'renderFieldEditor','addField','saveFields',
  'editAchievement','deleteAchievement','addNewAchievement','exportTemplateAsNewSave',
  'generateOutputFormat','buildSystemPrompt','refreshSystemPrompt',
  'getActiveTemplate','loadTemplate','loadTemplateList',
  'renderAiChatMessages','sendAiInstruction','clearAiInstructions',
  'showPrologue','closePrologue','openSettings','closeSettings'
];
funcs.forEach(f=>t(f, typeof window[f]!=='undefined'));

// ═══ 3. 模板数据 ═══
console.log('%c📋 3. 模板数据','color:#c9a96e');
const tpl = getActiveTemplate();
t('getActiveTemplate()返回非空', !!tpl);
t('outputSections存在', !!tpl.outputSections);
t('statusTop=3字段', tpl.outputSections.statusTop?.fields?.length===3);
t('taskLine=2字段', tpl.outputSections.taskLine?.fields?.length===2);
t('resources=2字段', tpl.outputSections.resources?.fields?.length===2);
t('variables=2字段', tpl.outputSections.variables?.fields?.length===2);
t('achievements存在', !!tpl.achievements && Object.keys(tpl.achievements).length>=6);
t('hiddenAchievements存在', !!tpl.hiddenAchievements && Object.keys(tpl.hiddenAchievements).length>=3);

// ═══ 4. gameState ═══
console.log('%c🎮 4. 游戏状态','color:#c9a96e');
t('gameState已定义', typeof gameState!=='undefined');
t('fieldHistory存在', !!gameState.fieldHistory);
t('achievementFlags存在', !!gameState.achievementFlags);
t('gambitSuccessCount', 'gambitSuccessCount' in (gameState.achievementFlags||{}));
t('choiceCounts', 'choiceCounts' in (gameState.achievementFlags||{}));
t('responseMatches', 'responseMatches' in (gameState.achievementFlags||{}));

// ═══ 5. 系统提示词 ═══
console.log('%c📝 5. 系统提示词','color:#c9a96e');
refreshSystemPrompt();
t('activeSystemPrompt非空', gameState.activeSystemPrompt?.length>1000);
t('含强制输出格式', gameState.activeSystemPrompt?.includes('【强制输出格式】'));
t('含场景类型约束', gameState.activeSystemPrompt?.includes('只能从以上'));
t('含最终提醒', gameState.activeSystemPrompt?.includes('【最终提醒'));

// ═══ 6. 成就面板 ═══
console.log('%c🏆 6. 成就面板','color:#c9a96e');
await (async()=>{
  try {
    renderAchievementsPanelV2();
    const list = document.querySelector('#achievements-list');
    t('成就面板渲染', !!list && list.innerHTML.length>100);
    t('含可见成就标题', list?.innerHTML?.includes('可见成就'));
    t('含隐藏成就标题', list?.innerHTML?.includes('隐藏成就'));
    t('有编辑按钮', list?.querySelectorAll('.ach-edit-btn').length>0);
    t('有添加按钮', !!document.querySelector('#btn-add-achievement'));
    t('有导出按钮', !!document.querySelector('#btn-export-template'));
    document.querySelector('#achievements-overlay')?.classList.remove('active');
  } catch(e) { t('成就面板渲染(异常:'+e.message+')', false); }
})();

// ═══ 7. 对话框 ═══
console.log('%c💬 7. 自定义对话框','color:#c9a96e');
try {
  const p = showDialog('测试消息', {type:'alert'});
  t('showDialog返回Promise', p instanceof Promise);
  document.querySelector('#dialog-overlay')?.classList.remove('active');
  t('对话框已关闭', !document.querySelector('#dialog-overlay')?.classList.contains('active'));
} catch(e) { t('对话框(异常:'+e.message+')', false); }

// ═══ 8. 主题 ═══
console.log('%c🎨 8. 主题系统','color:#c9a96e');
t('applyTheme函数', typeof applyTheme==='function');
t('initThemeSelector函数', typeof initThemeSelector==='function');
const sel = document.querySelector('#theme-selector');
t('主题选择器存在', !!sel);

// ═══ 9. 存储 ═══
console.log('%c💾 9. 存储系统','color:#c9a96e');
const testKey = getSaveKey('test_check', 0);
localStorage.setItem(testKey, JSON.stringify({test:true,fullHistory:[{role:'user',content:'test'},{role:'assistant',content:'ok'}]}));
const loaded = loadGameState('test_check', 0);
t('存档写入/读取', loaded && loaded.fullHistory?.length===2);
localStorage.removeItem(testKey);
const testKey1 = getSaveKey('test_check', 1);
t('slot0无后缀', getSaveKey('x',0)==='xixi_gamesave_x');
t('slot1有后缀', getSaveKey('x',1)==='xixi_gamesave_x_1');

// ═══ 结果 ═══
console.log('');
console.log('%c════════════════════════════════%c','color:#c9a96e','');
console.log('%c  通过: '+ok+'  失败: '+bad+'  总计: '+(ok+bad)+'%c','color:'+(bad===0?'#3fb950':'#f85149')+'','');
if (bad===0) console.log('%c  🎉 全部通过! 可以开始游戏测试%c','color:#3fb950','');
else console.log('%c  ⚠ 有 '+bad+' 项失败，需要修复%c','color:#f85149','');
console.log('%c════════════════════════════════%c','color:#c9a96e','');
})();
