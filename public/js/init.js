/* ═══════════════════════════════════════════
   init.js — 事件绑定 + 启动 + 全局错误处理
   依赖：所有以上模块
   ═══════════════════════════════════════════ */

// ── 事件绑定 ──
function bindEvents() {
  // 首次访问提示
  const btnEnter = $('#btn-enter');
  let _entering = false;  // 防连点/网卡重复触发
  if (btnEnter) {
    btnEnter.addEventListener('click', () => {
      if (_entering) return;
      _entering = true;
      btnEnter.textContent = '正在进入...';
      btnEnter.disabled = true;
      localStorage.setItem('xixi_age_verified', 'true');
      if (dom.warningOverlay) dom.warningOverlay.classList.remove('active');
      showSaveSelector();
    });
  }
  const btnLeave = $('#btn-leave');
  if (btnLeave) {
    btnLeave.addEventListener('click', () => {
      window.close();
      if (!window.closed) document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#78788c;font-family:sans-serif;font-size:18px;">已退出</div>';
    });
  }

  // 创建存档
  $('#btn-create-save').addEventListener('click', openCreateSave);
  $('#btn-cancel-create').addEventListener('click', closeCreateSave);
  $('#btn-generate-prompt').addEventListener('click', generatePrompt);
  $('#btn-confirm-save').addEventListener('click', confirmCreateSave);
  $('#btn-regenerate').addEventListener('click', generatePrompt);
  $('#create-save-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCreateSave();
  });

  // 风格/长度芯片
  $('#style-chips').addEventListener('click', function(e) {
    if (e.target.classList.contains('chip')) { e.target.classList.toggle('selected'); }
  });
  $('#length-chips').addEventListener('click', function(e) {
    if (e.target.classList.contains('chip')) {
      document.querySelectorAll('#length-chips .chip').forEach(c => c.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  });

  // AI 聊天
  $('#btn-ai-send').addEventListener('click', sendAiInstruction);
  $('#btn-ai-clear').addEventListener('click', clearAiInstructions);
  $('#btn-ai-save-prompt').addEventListener('click', mergeInstructionsToPrompt);
  $('#ai-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiInstruction();
  });

  // API Key 保存
  $('#btn-save-apikey').addEventListener('click', () => {
    const key = dom.apiKeyInput ? dom.apiKeyInput.value.trim() : '';
    if (key && key.startsWith('sk-')) {
      localStorage.setItem('xixi_apikey', key);
      const msgEl = $('#settings-msg');
      if (msgEl) { msgEl.textContent = '✅ API Key 已保存'; msgEl.style.color = 'var(--green)'; }
    } else {
      const msgEl = $('#settings-msg');
      if (msgEl) { msgEl.textContent = '⚠ Key 格式不正确，应以 sk- 开头'; msgEl.style.color = 'var(--red)'; }
    }
  });

  // 设置/游戏工具栏
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-undo').addEventListener('click', undoLastRound);
  $('#btn-export-story').addEventListener('click', exportStory);
  $('#btn-manual-save').addEventListener('click', manualSave);
  $('#btn-history').addEventListener('click', renderHistoryModal);
  $('#btn-close-settings').addEventListener('click', closeSettings);
  $('#btn-save-prompt').addEventListener('click', savePrompt);
  $('#btn-reload-prompt').addEventListener('click', reloadPrompt);
  $('#btn-reset-prompt').addEventListener('click', resetPrompt);
  $('#btn-save-fields').addEventListener('click', saveFields);
  $('#btn-add-field').addEventListener('click', addField);
  dom.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === dom.settingsOverlay) closeSettings();
  });

  // 序章弹窗
  $('#btn-prologue-start').addEventListener('click', () => {
    closePrologue();
    startNewGame();
  });

  // 选项按钮
  dom.optionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && gameState.currentOptions[idx] && !gameState.isLoading) {
        if (typeof playClick === 'function') playClick();
        handleChoice(idx + 1);
      }
    });
  });

  // 音效开关
  const audioBtn = $('#btn-audio');
  if (audioBtn) {
    audioBtn.textContent = '🔊 音效';
    audioBtn.addEventListener('click', () => {
      const on = typeof toggleAudio === 'function' ? toggleAudio() : true;
      audioBtn.textContent = on ? '🔊 音效' : '🔇 静音';
    });
  }

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 任何弹窗/输入框激活时，禁用游戏快捷键
    if (dom.settingsOverlay?.classList.contains('active')) return;
    if (dom.warningOverlay?.classList.contains('active')) return;
    if (dom.saveSelectorOverlay?.classList.contains('active')) return;
    if (dom.createSaveOverlay?.classList.contains('active')) return;
    if ($('#dialog-overlay')?.classList.contains('active')) return;
    if ($('#emoji-picker-popup')) return;  // emoji选择器打开时禁用快捷键
    if ($('#prologue-overlay')?.classList.contains('active')) return;
    if ($('#ending-overlay')?.classList.contains('active')) return;
    if ($('#help-overlay')?.classList.contains('active')) return;
    if ($('#achievements-overlay')?.classList.contains('active')) return;
    if ($('#history-overlay')?.classList.contains('active')) return;
    if (gameState.isLoading) return;
    const key = parseInt(e.key);
    if (key >= 1 && key <= 4 && gameState.currentOptions[key - 1]) {
      e.preventDefault();
      handleChoice(key);
    }
  });

  // 重试
  $('#btn-retry').addEventListener('click', () => retryLastRequest());

  // 存档选择器
  const newGameBtn = document.querySelector('#btn-new-game');
  if (newGameBtn) newGameBtn.addEventListener('click', showSaveSelector);
  const startGameBtn = document.querySelector('#btn-start-game');
  if (startGameBtn) startGameBtn.addEventListener('click', showSaveSelector);
  const backBtn = document.querySelector('#btn-back-saves');
  if (backBtn) backBtn.addEventListener('click', showSaveSelector);

  // 成就面板
  $('#btn-achievements').addEventListener('click', () => {
    try {
      renderAchievementsPanelV2();
      const overlay = $('#achievements-overlay');
      if (overlay) overlay.classList.add('active');
    } catch (e) {
      console.error('Failed to open achievements:', e);
    }
  });
  $('#btn-close-achievements').addEventListener('click', () => {
    const overlay = $('#achievements-overlay');
    if (overlay) overlay.classList.remove('active');
  });
  $('#achievements-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // 帮助弹窗
  $('#btn-help').addEventListener('click', () => { $('#help-overlay').classList.add('active'); });
  $('#btn-close-help').addEventListener('click', () => { $('#help-overlay').classList.remove('active'); });
  $('#help-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // 历程弹窗
  $('#btn-close-history').addEventListener('click', () => { $('#history-overlay').classList.remove('active'); });
  $('#history-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
  });

  // 结局弹窗
  $('#btn-ending-restart').addEventListener('click', () => { closeEndingOverlay(); startNewGame(); });
  $('#btn-ending-saves').addEventListener('click', () => { closeEndingOverlay(); showSaveSelector(); });
  $('#btn-ending-continue').addEventListener('click', closeEndingOverlay);
  $('#ending-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEndingOverlay();
  });

  // 存档选择器 backdrop（不关闭）
  $('#save-selector-overlay')?.addEventListener('click', e => { /* 必须选存档 */ });

  // 变量追踪折叠
  if (dom.varsToggle && dom.varsGrid) {
    dom.varsToggle.addEventListener('click', () => {
      dom.varsGrid.classList.toggle('collapsed');
      const label = getActiveTemplate().outputSections?.variables?.label || '变量追踪';
      dom.varsToggle.textContent = dom.varsGrid.classList.contains('collapsed')
        ? label + ' ▶' : label + ' ▼';
    });
  }

  // 提示词字数统计 + 未保存标记
  dom.promptEditor.addEventListener('input', () => {
    dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length;
    if (typeof markSettingsDirty === 'function') markSettingsDirty();
  });

  // 状态栏数值点击编辑
  $('#status-panel')?.addEventListener('click', (e) => {
    const ve = e.target.closest('.status-value');
    if (!ve || gameState.isLoading) return;
    const fid = ve.id?.replace('field-', '');
    if (!fid) return;
    const cv = ve.textContent;
    dlPrompt('修改「' + (ve.previousElementSibling?.textContent?.trim() || '') + '」的当前值：', cv).then(nv => {
      if (nv === null || nv === cv) return;
      if (!gameState.fieldHistory[fid]) gameState.fieldHistory[fid] = {};
      const num = parseInt(nv);
      if (!isNaN(num)) {
        gameState.fieldHistory[fid].current = num;
        gameState.fieldHistory[fid].max = Math.max(gameState.fieldHistory[fid].max || 0, num);
      } else {
        gameState.fieldHistory[fid].currentText = nv;
      }
      ve.textContent = nv;
      ve.className = 'status-value';
      if (!isNaN(num)) {
        if (num >= 70) ve.classList.add('pressure-danger');
        else if (num >= 40) ve.classList.add('pressure-warn');
        else ve.classList.add('pressure-safe');
      }
      if (gameState.gameStarted) saveGameState();
    });
  });
}

// ── 初始化 ──
async function init() {
  bindEvents();

  if (localStorage.getItem('xixi_age_verified') === 'true') {
    dom.warningOverlay.classList.remove('active');
    showSaveSelector();
  }

  // 加载提示词
  try {
    const resp = await fetch('/api/prompt');
    const data = await resp.json();
    gameState.originalPrompt = data.prompt;
  } catch (e) { console.warn('无法加载提示词:', e); }

  // 加载默认模板
  try {
    const defaultTemplate = await loadTemplate('surongrong');
    if (defaultTemplate) {
      gameState.activeTemplate = defaultTemplate;
      const lastSaveId = localStorage.getItem('xixi_last_save_id') || 'surongrong';
      gameState.activeSaveId = lastSaveId;
      const savedTheme = localStorage.getItem('xixi_theme_' + lastSaveId);
      applyTheme(savedTheme || defaultTemplate.theme || 'dark');
    }
    refreshSystemPrompt();
  } catch (e) { console.error('Init template error:', e); }

  // 初始化模板选择器
  try { await initTemplateSelector(); } catch (e) { console.error('Init selector error:', e); }

  // 初始化动态状态栏
  try { renderStatusContainers(getActiveTemplate()); } catch (e) { console.error('Init status error:', e); }

  // 初始化AI聊天消息
  try { renderAiChatMessages(); } catch (e) { console.error('Init chat error:', e); }
}

// ── 页面离开警告（游戏进行中关闭/刷新标签页时确认）──
window.addEventListener('beforeunload', (e) => {
  if (gameState.gameStarted && gameState.isLoading) {
    e.preventDefault();
    e.returnValue = 'AI正在生成回复，离开将丢失当前回合进度。';
    return e.returnValue;
  }
});

// ── 全局错误捕获 ──
window.addEventListener('error', (e) => {
  console.error('🔴 GLOBAL ERROR:', e.message, 'at', e.filename, 'line', e.lineno);
  const errBox = $('#error-box');
  if (errBox) {
    errBox.classList.remove('hidden');
    const msgEl = $('#error-message');
    if (msgEl) msgEl.textContent = '内部错误: ' + e.message;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('🔴 UNHANDLED REJECTION:', e.reason?.message || e.reason);
});

// ── 启动 ──
init();
console.log('🎮 模板驱动互动叙事游戏前端已就绪（模块化版）');
console.log('   state → utils → dialogs → saves → ui → achievements → prompts → templates → tavern → ai → core → init');
