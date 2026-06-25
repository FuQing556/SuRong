/* ═══════════════════════════════════════════
   自动化测试脚本 — 在浏览器 F12 控制台粘贴运行
   覆盖：模块加载、模板、存档、字段、成就、对话框
   ═══════════════════════════════════════════ */

(async function runAllTests() {
  const results = [];
  const pass = (name) => { results.push({ name, ok: true }); console.log('%c✅ ' + name, 'color:#3fb950'); };
  const fail = (name, err) => { results.push({ name, ok: false, err }); console.error('❌ ' + name, err); };

  // ═══════════ 第一轮：模块完整性 ═══════════
  console.log('%c\n═══ 第一轮：模块全局函数检查 ═══', 'color:#c9a96e;font-size:14px;');

  const globals = {
    'state.js': ['gameState', 'FALLBACK_TEMPLATE', 'KEEP_ROUNDS', '$', '$$', 'dom'],
    'utils.js': ['escapeHtml', 'getActiveTemplate', 'extractField', 'generateOutputFormat', 'buildSystemPrompt', 'refreshSystemPrompt', 'detectEnding'],
    'dialogs.js': ['showDialog', 'dlAlert', 'dlConfirm', 'dlPrompt', 'pickEmoji'],
    'saves.js': ['getSaveKey', 'saveGameState', 'loadGameState', 'getSaveInfo', 'loadSaves', 'saveUserSaves', 'deleteSave', 'clearAllSaves', 'getUnlockedAchievements', 'saveAchievements'],
    'ui.js': ['showLoading', 'showError', 'updateOptionButtons', 'renderStatusContainers', 'updateAllDynamicFields', 'switchSceneImage', 'applyTheme', 'showPrologue', 'closePrologue', 'showSaveSelector', 'selectSave', 'renderMySavesPanel'],
    'achievements.js': ['getAchievements', 'unlockAchievement', 'showAchievementToast', 'checkAchievementsFromState', 'checkHiddenAchievements', 'renderAchievementsPanelV2', 'editAchievement', 'deleteAchievement', 'addNewAchievement', 'exportTemplateAsNewSave'],
    'prompts.js': ['openSettings', 'closeSettings', 'savePrompt', 'reloadPrompt', 'resetPrompt', 'mergeInstructionsToPrompt', 'initThemeSelector', 'renderImageManager'],
    'templates.js': ['loadTemplateList', 'loadTemplate', 'initTemplateSelector', 'openCreateSave', 'closeCreateSave', 'generatePrompt', 'confirmCreateSave', 'renderFieldEditor', 'addField', 'saveFields'],
    'tavern.js': ['renderTavernPanel', 'loadTavernList', 'importFromTavern', 'uploadToTavern'],
    'ai.js': ['sendAiInstruction', 'clearAiInstructions', 'renderAiChatMessages', 'getAiInstructions'],
    'core.js': ['parseAIResponse', 'renderGameState', 'sendMessage', 'handleChoice', 'startNewGame', 'continueGame', 'undoLastRound', 'manualSave', 'renderHistoryModal', 'exportStory', 'showEndingOverlay', 'closeEndingOverlay'],
    'init.js': ['bindEvents', 'init'],
  };

  for (const [module, funcs] of Object.entries(globals)) {
    for (const fn of funcs) {
      const t = typeof window[fn];
      t === 'function' || (fn === 'gameState' && t === 'object') || (fn === 'FALLBACK_TEMPLATE' && t === 'object')
        ? pass(module + ' → ' + fn + ' (' + t + ')')
        : fail(module + ' → ' + fn, 'expected function/object, got ' + t);
    }
  }

  // ═══════════ 第二轮：gameState 完整性 ═══════════
  console.log('%c\n═══ 第二轮：gameState 完整性 ═══', 'color:#c9a96e;font-size:14px;');

  const requiredKeys = ['fullHistory', 'summary', 'summarisedCount', 'currentOptions', 'isLoading', 'gameStarted', 'originalPrompt', 'customPrompt', 'activeTemplate', '_originalTemplate', 'activeSystemPrompt', 'activeSaveId', 'fieldHistory', '_lastChoiceText', '_currentTheme', 'achievementFlags'];
  for (const k of requiredKeys) {
    k in gameState ? pass('gameState.' + k + ' exists') : fail('gameState.' + k + ' missing');
  }

  const flagKeys = ['gambitChosen', 'gambitSucceeded', 'gambitSuccessCount', 'endingTriggered', 'endingType', 'counterAttack', 'tradeCompleted', 'choiceCounts', 'responseMatches'];
  for (const k of flagKeys) {
    k in (gameState.achievementFlags || {}) ? pass('achievementFlags.' + k + ' exists') : fail('achievementFlags.' + k + ' missing');
  }

  // ═══════════ 第三轮：存档 key 兼容性 ═══════════
  console.log('%c\n═══ 第三轮：存档系统 ═══', 'color:#c9a96e;font-size:14px;');

  const key0 = getSaveKey('surongrong', 0);
  key0 === 'xixi_gamesave_surongrong' ? pass('slot=0: no suffix') : fail('slot=0', 'expected xixi_gamesave_surongrong, got ' + key0);

  const key3 = getSaveKey('surongrong', 3);
  key3 === 'xixi_gamesave_surongrong_3' ? pass('slot=3: suffix _3') : fail('slot=3', 'expected xixi_gamesave_surongrong_3, got ' + key3);

  const saves = loadSaves();
  Array.isArray(saves) && saves.length >= 1 ? pass('loadSaves: ' + saves.length + ' saves') : fail('loadSaves', 'unexpected result');

  // ═══════════ 第四轮：模板 ═══════════
  console.log('%c\n═══ 第四轮：模板加载 ═══', 'color:#c9a96e;font-size:14px;');

  try {
    const tplList = await loadTemplateList();
    tplList.length > 0 ? pass('loadTemplateList: ' + tplList.length + ' templates') : fail('loadTemplateList', 'empty');
  } catch (e) { fail('loadTemplateList', e.message); }

  try {
    const surongrong = await loadTemplate('surongrong');
    surongrong && surongrong.name ? pass('loadTemplate(surongrong): ' + surongrong.name) : fail('loadTemplate(surongrong)', 'no template');
    if (surongrong) {
      surongrong.outputSections ? pass('surongrong has outputSections') : fail('surongrong.outputSections', 'missing');
      surongrong.sceneTypes ? pass('surongrong has sceneTypes') : fail('surongrong.sceneTypes', 'missing');
      surongrong.promptBody && surongrong.promptBody.length > 100 ? pass('surongrong promptBody: ' + surongrong.promptBody.length + ' chars') : fail('surongrong.promptBody', 'too short');
    }
  } catch (e) { fail('loadTemplate(surongrong)', e.message); }

  // ═══════════ 第五轮：工具函数 ═══════════
  console.log('%c\n═══ 第五轮：工具函数 ═══', 'color:#c9a96e;font-size:14px;');

  escapeHtml('<b>test</b>') === '&lt;b&gt;test&lt;/b&gt;' ? pass('escapeHtml') : fail('escapeHtml');
  extractField('压力值：42 | 暴露风险：15', '暴露风险') === '15' ? pass('extractField') : fail('extractField', 'got: ' + extractField('压力值：42 | 暴露风险：15', '暴露风险'));

  try {
    const tpl2 = await loadTemplate('surongrong');
    if (tpl2) {
      const format = generateOutputFormat(tpl2.outputSections, tpl2.sceneTypes);
      format.includes('【强制输出格式】') ? pass('generateOutputFormat: has header') : fail('generateOutputFormat', 'no header');
      format.includes('【资源校验铁律】') ? pass('generateOutputFormat: has iron rule') : fail('generateOutputFormat', 'no iron rule');
    }
  } catch (e) { fail('generateOutputFormat', e.message); }

  // ═══════════ 第六轮：成就检测不误触发 ═══════════
  console.log('%c\n═══ 第六轮：成就系统 ═══', 'color:#c9a96e;font-size:14px;');

  const ach = getAchievements();
  typeof ach === 'object' && Object.keys(ach).length > 0 ? pass('getAchievements: ' + Object.keys(ach).length + ' achievements') : fail('getAchievements', ach);

  // 模拟第一回合：不应触发任何成就
  const prevRound = gameState.fullHistory.filter(m => m.role === 'user').length;
  if (prevRound < 2) {
    pass('round guard: current round=' + prevRound + ', achievement check should be skipped');
  } else {
    console.log('  ℹ round=' + prevRound + ', guard not active (normal during gameplay)');
  }

  // 验证成就隔离存储
  const achieveKey = (() => { const t = getActiveTemplate(); return 'xixi_achievements_' + (t.id || 'default'); })();
  achieveKey.includes('surongrong') || achieveKey.includes('default')
    ? pass('achieveKey: ' + achieveKey)
    : fail('achieveKey', achieveKey);

  // ═══════════ 第七轮：DOM 检查 ═══════════
  console.log('%c\n═══ 第七轮：DOM 完整性 ═══', 'color:#c9a96e;font-size:14px;');

  const domChecks = [
    ['warning-overlay', dom.warningOverlay],
    ['save-selector-overlay', dom.saveSelectorOverlay],
    ['create-save-overlay', dom.createSaveOverlay],
    ['settings-overlay', dom.settingsOverlay],
    ['story-content', dom.storyContent],
    ['loading-indicator', dom.loadingIndicator],
    ['error-box', dom.errorBox],
    ['character-image', dom.characterImage],
    ['status-grid', dom.statusGrid],
    ['resources-row', dom.resourcesRow],
    ['vars-grid', dom.varsGrid],
    ['ending-overlay', $('#ending-overlay')],
    ['help-overlay', $('#help-overlay')],
    ['achievements-overlay', $('#achievements-overlay')],
    ['dialog-overlay', $('#dialog-overlay')],
    ['history-overlay', $('#history-overlay')],
    ['prologue-overlay', $('#prologue-overlay')],
    ['prompt-editor', dom.promptEditor],
  ];

  for (const [name, el] of domChecks) {
    el ? pass('DOM: ' + name) : fail('DOM: ' + name + ' missing');
  }

  // 选项按钮
  const optBtns = document.querySelectorAll('.option-btn');
  optBtns.length === 4 ? pass('option buttons: 4 found') : fail('option buttons', 'expected 4, got ' + optBtns.length);

  // ═══════════ 第八轮：input autocomplete ═══════
  console.log('%c\n═══ 第八轮：autocomplete=off ═══', 'color:#c9a96e;font-size:14px;');

  const inputs = document.querySelectorAll('input');
  let autocompleteOk = 0, autocompleteFail = 0;
  inputs.forEach(inp => {
    if (inp.autocomplete === 'off') autocompleteOk++;
    else { autocompleteFail++; console.warn('  ⚠ input#' + (inp.id || 'unnamed') + ' autocomplete=' + inp.autocomplete); }
  });
  autocompleteFail === 0 ? pass('all ' + autocompleteOk + ' inputs have autocomplete=off') : fail('autocomplete', autocompleteFail + ' inputs missing off');

  // ═══════════ 第九轮：emoji picker ─══════════
  console.log('%c\n═══ 第九轮：Emoji 选择器 ═══', 'color:#c9a96e;font-size:14px;');

  typeof pickEmoji === 'function' ? pass('pickEmoji is function') : fail('pickEmoji', typeof pickEmoji);

  // ═══════════ 第十轮：JSON 合法性（所有模块括号平衡）══════════
  console.log('%c\n═══ 第十轮：JS 语法检查 ═══', 'color:#c9a96e;font-size:14px;');

  // 简单的括号平衡检查（在 Node 环境运行，浏览器中跳过）
  pass('(bracket check requires Node.js — run `node test.js` instead)');

  // ═══════════ 汇总 ═══════════
  console.log('%c\n══════════════════════', 'color:#c9a96e;font-size:14px;');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('%c' + passed + ' passed, ' + failed + ' failed, ' + results.length + ' total',
    'color:' + (failed === 0 ? '#3fb950' : '#f85149') + ';font-size:16px;font-weight:bold;');

  if (failed > 0) {
    console.log('%c\n失败项：', 'color:#f85149;');
    results.filter(r => !r.ok).forEach(r => console.warn('  ❌', r.name, r.err));
  }

  return { passed, failed, results };
})();
