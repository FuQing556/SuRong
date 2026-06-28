/* ═══════════════════════════════════════════
   init.js — 事件绑定 + 启动 + 全局错误处理
   依赖：所有以上模块
   ═══════════════════════════════════════════ */

// ── 数据版本迁移：自动清除旧版缓存 ──
// 升级时 bump APP_DATA_VERSION，所有客户端打开即自动清旧数据
(function migrateDataVersion() {
  var APP_DATA_VERSION = 4;
  var stored = localStorage.getItem('xixi_data_version');
  if (stored && parseInt(stored, 10) >= APP_DATA_VERSION) return;

  console.log('🧹 数据版本升级: ' + (stored || '首次') + ' → v' + APP_DATA_VERSION + '，清除所有旧缓存...');

  // 仅保留：API Key、模板列表、年龄确认
  var keep = {};
  keep[LS_KEYS.apikey] = true;
  keep[LS_KEYS.saves] = true;
  keep[LS_KEYS.ageVerified] = true;

  var keys = [];
  try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch(e) {}

  var cleared = 0;
  keys.forEach(function(k) {
    if (!k || k.indexOf('xixi_') !== 0) return;
    if (keep[k]) return;
    localStorage.removeItem(k);
    cleared++;
  });

  localStorage.setItem('xixi_data_version', String(APP_DATA_VERSION));
  console.log('✅ 已清理 ' + cleared + ' 项旧版数据。模板列表和 API Key 已保留。');
})();

// ── 工具：overlay 背景点击关闭 ──
function bindOverlayClose(overlayId, closeFn) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === e.currentTarget) closeFn();
    });
  }
}

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
      localStorage.setItem(LS_KEYS.ageVerified, 'true');
      // 立即隐藏警告层，让用户看到响应
      if (dom.warningOverlay) dom.warningOverlay.classList.remove('active');
      // 延迟加载存档面板，避免DOM操作阻塞点击反馈
      setTimeout(() => showSaveSelector(), 50);
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
  $('#btn-parse-story').addEventListener('click', toggleParseStoryPanel);
  $('#btn-parse-start').addEventListener('click', parseStoryToTemplate);
  $('#btn-parse-cancel').addEventListener('click', function() {
    var panel = $('#parse-story-panel');
    if (panel) panel.style.display = 'none';
  });
  bindOverlayClose('create-save-overlay', closeCreateSave);

  // 风格/长度/难度芯片
  $('#style-chips').addEventListener('click', function(e) {
    if (e.target.classList.contains('chip')) { e.target.classList.toggle('selected'); }
  });
  $('#length-chips').addEventListener('click', function(e) {
    if (e.target.classList.contains('chip')) {
      document.querySelectorAll('#length-chips .chip').forEach(c => c.classList.remove('selected'));
      e.target.classList.add('selected');
    }
  });
  $('#difficulty-chips').addEventListener('click', function(e) {
    if (e.target.classList.contains('chip')) {
      document.querySelectorAll('#difficulty-chips .chip').forEach(c => c.classList.remove('selected'));
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
      if (typeof _writeApiKey === 'function') _writeApiKey(key);
      else localStorage.setItem(LS_KEYS.apikey, key);
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
  $('#btn-reset-prompt').addEventListener('click', resetPrompt);
  $('#btn-save-fields').addEventListener('click', saveFields);
  $('#btn-add-field').addEventListener('click', addField);

  // 检查更新：强制SW检查新版本
  $('#btn-check-update').addEventListener('click', async function() {
    if (!('serviceWorker' in navigator)) {
      if (typeof dlAlert === 'function') dlAlert('⚠ 当前浏览器不支持 Service Worker，无法检查更新。');
      return;
    }
    var btn = $('#btn-check-update');
    btn.textContent = '⏳ 检查中...';
    btn.disabled = true;
    try {
      var reg = await navigator.serviceWorker.ready;
      var hadUpdate = false;
      // 1. 检查 SW 自身有无新版本
      await reg.update();
      await new Promise(function(r) { setTimeout(r, 1500); });
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        hadUpdate = true;
      } else if (reg.installing) {
        await new Promise(function(resolve) {
          reg.installing.addEventListener('statechange', function() {
            if (reg.installing.state === 'installed') { hadUpdate = true; resolve(); }
          });
          setTimeout(resolve, 3000); // 超时兜底
        });
      }
      // 2. 不管SW有没有更新，清空静态缓存 + 强制刷新
      // SW缓存里的HTML/CSS/JS可能仍是旧版，清掉让下次加载重新拉取
      btn.textContent = hadUpdate ? '✅ SW已更新，清缓存刷新...' : '✅ 已最新，清缓存刷新...';
      var cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(function(name) { return caches.delete(name); }));
      setTimeout(function() { window.location.reload(); }, 400);
    } catch (e) {
      // 降级：直接清缓存刷新
      try { var cns = await caches.keys(); await Promise.all(cns.map(function(n) { return caches.delete(n); })); } catch(e2) {}
      btn.textContent = '🔄 强制刷新中...';
      setTimeout(function() { window.location.reload(); }, 300);
    }
  });

  $('#btn-force-install').addEventListener('click', function() { _tryPwaInstall(); });
  bindOverlayClose('settings-overlay', closeSettings);

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

  // 三态音效开关
  const audioBtn = $('#btn-audio');
  if (audioBtn) {
    audioBtn.textContent = '🔉 音效';
    audioBtn.title = '全部音效 | 点击切换';
    audioBtn.addEventListener('click', () => {
      var state = typeof toggleAudio === 'function' ? toggleAudio() : { uiOn: true, ambientOn: true };
      if (state.uiOn && state.ambientOn) { audioBtn.textContent = '🔉 全部'; audioBtn.title = '全部音效 | 点击切换'; }
      else if (state.uiOn && !state.ambientOn) { audioBtn.textContent = '🔔 界面'; audioBtn.title = '仅界面音效 | 点击切换'; }
      else { audioBtn.textContent = '🔇 静音'; audioBtn.title = '静音 | 点击恢复'; }
    });
  }

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 任何弹窗/输入框激活时，禁用游戏快捷键（统一检测所有 .overlay.active）
    if (document.querySelector('.overlay.active')) return;
    if (document.getElementById('emoji-picker-popup')) return;

    // Ctrl+S 快速存档 / Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (gameState.gameStarted && !gameState.isLoading) manualSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (gameState.gameStarted && !gameState.isLoading) undoLastRound();
      return;
    }

    // 焦点在输入框/文本域时不触发快捷键（允许正常打字）
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    if (gameState.isLoading) return;
    const key = parseInt(e.key);
    if (key >= 1 && key <= 4 && gameState.currentOptions[key - 1]) {
      e.preventDefault();
      if (typeof playClick === 'function') playClick();
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
  bindOverlayClose('achievements-overlay', () => {
    const overlay = $('#achievements-overlay');
    if (overlay) overlay.classList.remove('active');
  });

  // 命运转折面板
  $('#btn-endings').addEventListener('click', () => {
    try {
      renderEndingsPanel();
      const overlay = $('#endings-overlay');
      if (overlay) overlay.classList.add('active');
    } catch (e) {
      console.error('Failed to open endings:', e);
    }
  });
  $('#btn-close-endings').addEventListener('click', () => {
    const overlay = $('#endings-overlay');
    if (overlay) overlay.classList.remove('active');
  });
  $('#btn-add-ending').addEventListener('click', addEnding);
  bindOverlayClose('endings-overlay', () => {
    const overlay = $('#endings-overlay');
    if (overlay) overlay.classList.remove('active');
  });

  // 帮助弹窗
  $('#btn-help').addEventListener('click', () => { $('#help-overlay').classList.add('active'); });
  $('#btn-close-help').addEventListener('click', () => { $('#help-overlay').classList.remove('active'); });
  bindOverlayClose('help-overlay', () => { $('#help-overlay').classList.remove('active'); });

  // 历程弹窗
  $('#btn-close-history').addEventListener('click', () => { $('#history-overlay').classList.remove('active'); });
  bindOverlayClose('history-overlay', () => { $('#history-overlay').classList.remove('active'); });

  // 结局弹窗
  $('#btn-ending-restart').addEventListener('click', () => { closeEndingOverlay(); startNewGame(); });
  $('#btn-ending-saves').addEventListener('click', () => { closeEndingOverlay(); showSaveSelector(); });
  $('#btn-ending-continue').addEventListener('click', closeEndingOverlay);
  bindOverlayClose('ending-overlay', closeEndingOverlay);

  // 存档选择器 backdrop（不关闭）
  $('#save-selector-overlay')?.addEventListener('click', e => { /* 必须选存档 */ });

  // 变量追踪折叠
  if (dom.varsToggle && dom.varsGrid) {
    dom.varsToggle.addEventListener('click', () => {
      dom.varsGrid.classList.toggle('collapsed');
      var vp = document.getElementById('variables-panel');
      if (vp) vp.classList.toggle('var-collapsed', dom.varsGrid.classList.contains('collapsed'));
      var label = getActiveTemplate().outputSections?.variables?.label || '变量追踪';
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
    const fieldLabel = ve.previousElementSibling?.textContent?.trim() || '';
    dlPrompt('修改「' + fieldLabel + '」的当前值：', cv).then(nv => {
      if (nv === null || nv === cv) return;
      if (!gameState.fieldHistory[fid]) gameState.fieldHistory[fid] = {};
      const num = parseInt(nv, 10);
      if (!isNaN(num)) {
        gameState.fieldHistory[fid].current = num;
        gameState.fieldHistory[fid].max = Math.max(gameState.fieldHistory[fid].max || 0, num);
        delete gameState.fieldHistory[fid].currentText;  // 清理旧文本值
      } else {
        gameState.fieldHistory[fid].currentText = nv;
        delete gameState.fieldHistory[fid].current;       // 清理旧数值
      }
      ve.textContent = nv;
      ve.className = 'status-value';
      if (!isNaN(num)) {
        if (num >= 70) ve.classList.add('pressure-danger');
        else if (num >= 40) ve.classList.add('pressure-warn');
        else ve.classList.add('pressure-safe');
      }
      if (gameState.gameStarted) {
        saveGameState();
        // 通知 AI 数值被手动调整
        gameState.fullHistory.push({
          role: 'user',
          content: '【系统通知】玩家手动调整了「' + fieldLabel + '」的值为 ' + nv + '。请在后续叙事中合理衔接。'
        });
      }
    });
  });

  // ── 全局UI按钮音效+涟漪：一个委托覆盖所有按钮（自动包含动态创建的）──
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    // 涟漪效果
    // 涟漪效果 — 仅对非选项、非音效按钮
    if (!btn.classList.contains('option-btn') && btn.id !== 'btn-audio') {
      var ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = 'position:absolute;border-radius:50%;background:rgba(255,255,255,.1);transform:scale(0);animation:ripple .6s ease-out;pointer-events:none;';
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(function() { ripple.remove(); }, 600);
    }
    if (btn.classList.contains('option-btn')) return;
    if (btn.id === 'btn-audio') return;
    if (typeof playUIClick === 'function') playUIClick();
  });
}

// ── 初始化 ──
async function init() {
  bindEvents();

  if (localStorage.getItem(LS_KEYS.ageVerified) === 'true') {
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
      // 保存原始模板副本（用于结局章节修复 + 恢复默认）
      gameState._originalTemplate = JSON.parse(JSON.stringify(defaultTemplate));
      const lastSaveId = localStorage.getItem(LS_KEYS.lastSaveId) || 'surongrong';
      gameState.activeSaveId = lastSaveId;
      const savedTheme = localStorage.getItem(LS_KEYS.theme(lastSaveId));
      applyTheme(savedTheme || defaultTemplate.theme || 'dark');
      // 应用已保存的字体
      var savedFont = localStorage.getItem(LS_KEYS.font(lastSaveId)) || 'sans';
      if (typeof applyFont === 'function') applyFont(savedFont);
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
  if (gameState.gameStarted) {
    e.preventDefault();
    e.returnValue = '游戏正在进行中，确定离开？';
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

// ── SW 更新通知 ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SW_UPDATED') {
      var banner = document.getElementById('pwa-install-banner');
      if (banner) {
        banner.innerHTML = '<span class="pwa-banner-icon">🔄</span><span class="pwa-banner-text">有新版本可用</span><button id="btn-sw-refresh" class="btn btn-small btn-primary">刷新</button><button id="btn-sw-dismiss" class="btn btn-ghost btn-tiny">✕</button>';
        banner.classList.remove('hidden');
        var refreshBtn = document.getElementById('btn-sw-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', function() { window.location.reload(); });
        var dismissBtn = document.getElementById('btn-sw-dismiss');
        if (dismissBtn) dismissBtn.addEventListener('click', function() { banner.classList.add('hidden'); });
      }
    }
  });
}

// ── PWA 安装引导 ──
var _pwaInstallPrompt = null;

// 共用安装逻辑（供 banner 和设置按钮复用）
function _tryPwaInstall() {
  if (_pwaInstallPrompt) {
    _pwaInstallPrompt.prompt();
    return _pwaInstallPrompt.userChoice.then(function(result) {
      console.log('PWA 安装:', result.outcome);
      _pwaInstallPrompt = null;
      var banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('hidden');
      if (typeof dlAlert === 'function') {
        dlAlert(result.outcome === 'accepted' ? '✅ 已添加到主屏幕！' : '已取消安装。');
      }
    });
  }
  var ua = navigator.userAgent;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  var isIOS = /iPhone|iPad|iPod/.test(ua);

  // ── 已被 App 安装（独立模式运行）──
  if (isStandalone) {
    if (typeof dlAlert === 'function') {
      if (isIOS) dlAlert('✅ 已安装！当前正在以独立App模式运行。\n\n如需重新安装：\n1. 长按桌面图标 → 删除\n2. 在 Safari 中重新打开本页面\n3. 按下方分享按钮 → 添加到主屏幕');
      else dlAlert('✅ 已安装！当前正在以独立App模式运行。\n\n如需重新安装，请先卸载再在浏览器中打开本页面。');
    }
    return Promise.resolve();
  }

  // ── 处理无法安装 PWA 的浏览器（QQ/微信/UC/百度等内置WebView）──
  // 这些浏览器不支持 beforeinstallprompt，也不支持添加到主屏幕
  // ── 辅助：复制链接到剪贴板 ──
  function _copyUrl() {
    try {
      var ta = document.createElement('textarea');
      ta.value = window.location.href;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch(e) { return false; }
  }

  if (/MicroMessenger/i.test(ua)) {
    var copied = _copyUrl();
    if (typeof dlAlert === 'function') dlAlert('⚠ 微信不支持安装到桌面\n\n'
      + (copied ? '✅ 链接已自动复制到剪贴板！\n\n' : '')
      + '📲 下一步：\n'
      + '1. 打开手机自带浏览器（Safari / Chrome / 系统浏览器）\n'
      + '2. 粘贴链接并打开\n'
      + '3. 按浏览器菜单 →「添加到主屏幕」\n\n'
      + '提示：微信里也可以点右上角 ··· →「在浏览器中打开」');
    return Promise.resolve();
  }
  if (/QQ\//i.test(ua) || /MQQBrowser/i.test(ua)) {
    var copied2 = _copyUrl();
    if (typeof dlAlert === 'function') dlAlert('⚠ QQ 不支持安装到桌面\n\n'
      + (copied2 ? '✅ 链接已自动复制！\n\n' : '')
      + '📲 下一步：\n'
      + '1. 打开手机自带浏览器（Safari / Chrome / 系统浏览器）\n'
      + '2. 粘贴链接并打开\n'
      + '3. 按浏览器菜单 →「添加到主屏幕」\n\n'
      + '提示：QQ里也可以点右上角 ··· →「在浏览器中打开」');
    return Promise.resolve();
  }
  if (/UCBrowser|UCWEB/i.test(ua) || /baidubrowser|baiduboxapp/i.test(ua)) {
    var copied3 = _copyUrl();
    if (typeof dlAlert === 'function') dlAlert('⚠ 当前浏览器不支持安装到桌面\n\n'
      + (copied3 ? '✅ 链接已复制！\n\n' : '')
      + '📲 请用手机自带浏览器（Safari / Chrome）打开此链接：\n'
      + window.location.href + '\n\n'
      + '然后在浏览器菜单中选「添加到主屏幕」');
    return Promise.resolve();
  }

  // ── iOS Safari（正常浏览器，但需要手动添加到主屏幕）──
  if (isIOS) {
    if (typeof dlAlert === 'function') dlAlert('📲 添加到主屏幕：\n\n1. 点击浏览器底部中间的「分享」按钮\n2. 向下滑动找到「添加到主屏幕」\n3. 确认名称后点击「添加」\n\n安装后可作为独立App使用，桌面会出现铃兰图标。');
    return Promise.resolve();
  }

  // ── Android Chrome（支持原生 PWA 安装）──
  if (/Android/i.test(ua) && /Chrome/i.test(ua)) {
    if (typeof dlAlert === 'function') dlAlert('📲 安装方法：\n\n点击浏览器右上角 ⋮ 菜单\n→ 「安装应用」或「添加到主屏幕」\n\n如菜单中无此选项：\n① 确认通过 HTTPS 访问\n② 关闭无痕模式\n③ 之前安装过又删除需等 Chrome 解限（1-3天）');
    return Promise.resolve();
  }

  // ── Android 其他浏览器 ──
  if (/Android/i.test(ua)) {
    if (typeof dlAlert === 'function') dlAlert('📲 建议使用 Chrome 浏览器打开本页面以获得最佳安装体验。\n\n当前浏览器安装方法：\n查看菜单中是否有「安装应用」「添加到桌面」等选项。\n\n没有？复制链接到 Chrome 打开。');
    return Promise.resolve();
  }

  // ── 桌面 Chrome / Edge（支持原生安装）──
  if (/Chrome/i.test(ua) || /Edg/i.test(ua)) {
    if (typeof dlAlert === 'function') dlAlert('📲 安装方法：\n\n点击浏览器地址栏右侧的 ⊕ 安装图标\n\n没看到？\n· 之前装过又删了 → Chrome 会限流1-3天\n· 尝试访问 chrome://settings/content/siteDetails 删除本站数据后刷新\n\n⬇ 仍装不了？可以直接下载 APK 安装包：\nhttps://pwabuilder.com?url=' + encodeURIComponent(window.location.href));
    return Promise.resolve();
  }

  // ── 其他桌面浏览器（Safari / Firefox 等）──
  if (typeof dlAlert === 'function') dlAlert('📲 当前浏览器可能不完全支持桌面安装。\n\n尝试：浏览器菜单 → 添加到桌面 / 安装应用\n\n推荐使用 Chrome 或 Edge 获得最佳体验。\n\n⬇ 或直接下载 APK：\nhttps://pwabuilder.com?url=' + encodeURIComponent(window.location.href));
  return Promise.resolve();
}

window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _pwaInstallPrompt = e;
  var banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('hidden');
});

var btnInstall = document.getElementById('btn-pwa-install');
if (btnInstall) {
  btnInstall.addEventListener('click', function() { _tryPwaInstall(); });
}

var btnDismiss = document.getElementById('btn-pwa-dismiss');
if (btnDismiss) {
  btnDismiss.addEventListener('click', function() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('hidden');
  });
}

// ── 启动 ──
init();
console.log('🎮 模板驱动互动叙事游戏前端已就绪（模块化版）');
console.log('   state → utils → dialogs → saves → ui → achievements → prompts → templates → tavern → ai → audio → core → init');

window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('init');

// ── 模块加载顺序校验 ──
var EXPECTED_ORDER = ['state','utils','dialogs','saves','ui','achievements','prompts','templates','tavern','ai','audio','core','init'];
var loaded = window.XIXI.modulesLoaded || [];
var ok = true;
for (var i = 0; i < Math.min(EXPECTED_ORDER.length, loaded.length); i++) {
  if (loaded[i] !== EXPECTED_ORDER[i]) {
    console.warn('⚠ 模块加载顺序异常: 期望第' + (i+1) + '个是 ' + EXPECTED_ORDER[i] + '，实际是 ' + loaded[i]);
    ok = false;
  }
}
if (ok && loaded.length === EXPECTED_ORDER.length) {
  console.log('✅ 13 个模块加载顺序正确');
} else if (loaded.length !== EXPECTED_ORDER.length) {
  console.warn('⚠ 模块数量不匹配: 期望' + EXPECTED_ORDER.length + ', 实际' + loaded.length);
}
