/* ═══════════════════════════════════════════
   ui.js — 界面渲染：加载/错误/选项/状态栏/场景图/主题/序章/存档选择
   依赖：state.js, utils.js, dialogs.js, saves.js
   ═══════════════════════════════════════════ */

// ── 自定义图片追踪 ──
let parsedLastSceneType = '';

// ── 加载指示器 ──
let _loadingTimer = null;
let _loadingStart = 0;
let _loadingPhase = 'connecting';  // 'connecting' | 'thinking' | 'streaming'

// ── 取消当前请求 ──
function cancelCurrentRequest() {
  if (_abortController) {
    gameState._cancelledByUser = true;
    _abortController.abort();
  }
}

function showLoading(show) {
  dom.loadingIndicator.classList.toggle('hidden', !show);
  // 加载时隐藏选项区，比显示4个"等待中..."更干净
  if (dom.optionsContainer) dom.optionsContainer.style.visibility = show ? 'hidden' : '';
  // 加载时显示取消按钮
  let cancelBtn = $('#btn-cancel-request');
  if (show) {
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'btn-cancel-request';
      cancelBtn.className = 'btn btn-ghost btn-tiny';
      cancelBtn.textContent = '✕ 取消';
      cancelBtn.title = '取消当前请求，恢复到选择前的状态';
      cancelBtn.style.cssText = 'margin-left:12px;font-size:11px;';
      cancelBtn.addEventListener('click', cancelCurrentRequest);
      dom.loadingIndicator.appendChild(cancelBtn);
    }
    cancelBtn.style.display = '';
    _loadingStart = Date.now();
    _loadingPhase = 'connecting';
    _updateLoadingText();
    _loadingTimer = setInterval(_updateLoadingText, 1000);
  } else {
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (_loadingTimer) { clearInterval(_loadingTimer); _loadingTimer = null; }
  }
}

function _updateLoadingText() {
  var elapsed = Math.floor((Date.now() - _loadingStart) / 1000);
  var roundNum = Math.max(1, gameState.fullHistory.filter(function(m) { return m.role === 'user'; }).length);
  var textEl = dom.loadingIndicator.querySelector('.spinner')?.nextSibling;
  if (!textEl) return;
  // 阶段化提示：连接中 → AI思考中 → 文字流出
  if (_loadingPhase === 'connecting' && elapsed >= 2) _loadingPhase = 'thinking';
  if (_loadingPhase === 'connecting') {
    textEl.textContent = '第' + roundNum + '回合 · 已连接服务器...';
  } else if (_loadingPhase === 'thinking') {
    textEl.textContent = '第' + roundNum + '回合 · AI 正在构思...已等' + elapsed + '秒';
  } else {
    textEl.textContent = '第' + roundNum + '回合 · 已等待' + elapsed + '秒';
  }
}

// 供 _streamResponse 调用，标记进入流式阶段
function _setLoadingPhase(phase) { _loadingPhase = phase; }


// ── 错误提示 ──
function showError(msg) {
  dom.errorBox.classList.remove('hidden');
  dom.errorMsg.textContent = msg;
  if (typeof playError === 'function') playError();
  // 确保关闭按钮存在
  if (!$('#btn-dismiss-error')) {
    const dismissBtn = document.createElement('button');
    dismissBtn.id = 'btn-dismiss-error';
    dismissBtn.className = 'btn btn-ghost btn-tiny';
    dismissBtn.textContent = '✕ 关闭';
    dismissBtn.style.cssText = 'margin-left:8px;font-size:11px;';
    dismissBtn.addEventListener('click', () => dom.errorBox.classList.add('hidden'));
    $('#btn-retry').after(dismissBtn);
  }
  if (gameState.currentOptions.length > 0) updateOptionButtons(gameState.currentOptions);
}

// ── 选项按钮（资源检测版 v2：力不能及/代价沉重 分治）──
function updateOptionButtons(options) {
  const tpl = getActiveTemplate();

  // 收集所有区段的数值型字段（不仅 resources，AI 模板可能把资源放在 variables 等区段）
  const resValues = {};
  for (const [sectionKey, section] of Object.entries(tpl.outputSections || {})) {
    const fields = section.fields || [];
    fields.forEach(function(f) {
      const hist = gameState.fieldHistory[f.id];
      if (hist && hist.current !== undefined && hist.current !== null) {
        resValues[f.label] = hist.current;
      } else if (hist && hist.currentText && hist.currentText !== '—') {
        const n = parseInt(hist.currentText);
        if (!isNaN(n)) resValues[f.label] = n;
      }
    });
  }

  // 重置代价沉重标记
  gameState._heavyCostOptions = [];

  dom.optionBtns.forEach(function(btn, i) {
    const opt = options[i];
    const actionEl = btn.querySelector('.option-action');
    const costEl = btn.querySelector('.option-cost');
    if (opt) {
      const actionText = (opt.action || '').replace(/^\d+[\.\、\s]+/, '');
      const costText = opt.cost || '';
      const fullText = actionText + ' ' + costText;
      // 检测 AI 标记：力不能及 + 资源不足(旧) = 禁用；代价沉重 = 可选但警告
      var hasCannotAfford = fullText.indexOf('【力不能及】') >= 0 || fullText.indexOf('【资源不足】') >= 0;
      var hasHeavyCost = fullText.indexOf('【代价沉重】') >= 0;
      var resourceBlocked = false;
      if (!hasCannotAfford) {
        for (const label in resValues) {
          var cur = resValues[label];
          if (typeof cur !== 'number' || isNaN(cur)) continue;
          var escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var re1 = new RegExp(escaped + '[：:\\s]*[xX×\\-–]?\\s*(\\d+)');
          var m = costText.match(re1) || actionText.match(re1);
          if (!m) {
            var re2 = new RegExp(escaped + '[\\s\\S]{0,8}?(\\d+)');
            m = costText.match(re2) || actionText.match(re2);
          }
          if (m) {
            var needed = parseInt(m[1]);
            if (!isNaN(needed) && cur < needed) { resourceBlocked = true; break; }
          }
        }
      } else {
        resourceBlocked = true;
      }
      actionEl.textContent = actionText;
      costEl.textContent = costText ? '— ' + costText : '';
      btn.style.display = '';
      // 力不能及 → 禁用，代价沉重 → 可选但警告
      if (hasCannotAfford || resourceBlocked) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.title = '力不能及 — 当前资源无法执行此选项';
        btn.style.borderColor = '';
      } else if (hasHeavyCost) {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.title = '⚠ 代价沉重 — 选了将付出重大代价，确定后再执行';
        btn.style.borderColor = 'var(--red)';
        gameState._heavyCostOptions.push(i);
      } else {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.title = '';
        btn.style.borderColor = '';
      }
    } else {
      actionEl.textContent = '';
      costEl.textContent = '';
      btn.disabled = true;
      btn.style.opacity = '';
      btn.title = '';
      btn.style.borderColor = '';
      if (i >= (options.length || 0)) btn.style.display = options.length === 0 ? '' : 'none';
    }
  });

  if (options.length === 0) {
    dom.optionBtns.forEach(function(btn) {
      btn.querySelector('.option-action').textContent = '等待中...';
      btn.querySelector('.option-cost').textContent = '';
      btn.disabled = true;
      btn.style.opacity = '';
      btn.title = '';
      btn.style.display = '';
      btn.style.borderColor = '';
    });
  }
}

// ── 动态渲染状态栏容器 ──
function renderStatusContainers(template) {
  const sections = template?.outputSections || {};

  // 状态栏 + 任务行
  const statusFields = [
    ...(sections.statusTop?.fields || []),
    ...(sections.taskLine?.fields || []),
  ];
  if (dom.statusGrid) {
    dom.statusGrid.innerHTML = statusFields.map(f =>
      `<div class="status-item" data-field="${f.id}">
        <span class="status-label">${f.icon || ''} ${f.label}</span>
        <span class="status-value" id="field-${f.id}">—</span>
      </div>`
    ).join('');
  }

  // 资源行
  const resFields = sections.resources?.fields || [];
  if (dom.resourcesRow) {
    dom.resourcesRow.innerHTML = resFields.length > 0 ? resFields.map(f =>
      `<div class="status-item resource-item" data-field="${f.id}">
        <span class="status-label">${f.icon || ''} ${f.label}</span>
        <span class="status-value" id="field-${f.id}">—</span>
      </div>`
    ).join('') : '';
    dom.resourcesRow.style.display = resFields.length > 0 ? '' : 'none';
  }

  // 变量追踪
  const varFields = sections.variables?.fields || [];
  if (dom.varsGrid) {
    dom.varsGrid.innerHTML = varFields.map(f =>
      `<div class="status-item var-item" data-field="${f.id}">
        <span class="status-label">${f.icon || ''} ${f.label}</span>
        <span class="status-value" id="field-${f.id}">—</span>
      </div>`
    ).join('');
    dom.varsGrid.classList.remove('collapsed');
    var vp = document.getElementById('variables-panel');
    if (vp) vp.classList.remove('var-collapsed');
  }

  // 更新变量追踪标题（强制展开状态）
  if (dom.varsToggle && sections.variables?.label) {
    dom.varsToggle.textContent = sections.variables.label + ' ▼';
    dom.varsToggle.style.cursor = 'pointer';
    dom.varsToggle.style.padding = '8px 0';
    dom.varsToggle.style.fontSize = '13px';
  }
}

// ── 动态更新所有字段值 ──
function updateAllDynamicFields(fieldValues, template) {
  const sections = template?.outputSections || FALLBACK_TEMPLATE.outputSections;
  const allFields = [];
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields;
    if (!fields || !Array.isArray(fields)) continue;
    for (const f of fields) allFields.push(f);
  }

  for (const field of allFields) {
    const el = document.getElementById('field-' + field.id);
    if (!el) continue;
    const value = fieldValues[field.id] ?? '—';
    el.textContent = value;

    // 数值高亮 + 变化闪烁 + 色盲友好前缀
    el.className = 'status-value';
    if (field.type === 'number') {
      var num = parseInt(value);
      if (!isNaN(num)) {
        // 色盲友好：颜色 + 文字前缀双重传达
        if (num >= 70) { el.classList.add('pressure-danger'); el.setAttribute('data-level', 'high'); }
        else if (num >= 40) { el.classList.add('pressure-warn'); el.setAttribute('data-level', 'mid'); }
        else { el.classList.add('pressure-safe'); el.setAttribute('data-level', 'low'); }
        // 检测数值变化并闪烁
        var oldVal = el.getAttribute('data-prev-value');
        if (oldVal !== null && oldVal !== String(num)) {
          var prev = parseInt(oldVal);
          if (!isNaN(prev)) {
            el.classList.add(num > prev ? 'val-up' : 'val-down');
            el.classList.add('val-flash');
            setTimeout(function() { el.classList.remove('val-up', 'val-down', 'val-flash'); }, 600);
          }
        }
        el.setAttribute('data-prev-value', String(num));
      }
    }
  }
}

// ── 从 fieldHistory 恢复字段显示 ──
function updateAllDynamicFieldsFromHistory() {
  var tpl = getActiveTemplate();
  var fieldValues = {};
  var lastParsed = gameState._lastParsedFields || {};
  var fh = gameState.fieldHistory || {};
  // 收集所有字段ID
  var allIds = [];
  for (var sk in tpl.outputSections) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    var fs = tpl.outputSections[sk].fields || [];
    for (var fi = 0; fi < fs.length; fi++) allIds.push(fs[fi].id);
  }
  for (var i = 0; i < allIds.length; i++) {
    var fid = allIds[i];
    var hist = fh[fid];
    // 优先 fieldHistory，兜底 _lastParsedFields
    if (hist) {
      var v = (hist.currentText != null) ? hist.currentText : (hist.current != null ? String(hist.current) : null);
      if (v != null && v !== '—') {
        fieldValues[fid] = v;
      } else if (lastParsed[fid] && lastParsed[fid] !== '—') {
        fieldValues[fid] = lastParsed[fid];
        // 自愈：回填到 fieldHistory
        var num = parseInt(lastParsed[fid]);
        if (!isNaN(num)) { hist.current = num; hist.max = Math.max(hist.max || 0, num); delete hist.currentText; }
        else { hist.currentText = lastParsed[fid]; delete hist.current; }
      } else {
        fieldValues[fid] = v || '—';
      }
    } else if (lastParsed[fid] && lastParsed[fid] !== '—') {
      fieldValues[fid] = lastParsed[fid];
    } else {
      fieldValues[fid] = '—';
    }
  }
  updateAllDynamicFields(fieldValues, tpl);
}

// ── 场景图片切换 ──
function switchSceneImage(sceneType, template) {
  // 先检查自定义图片
  var saveId = gameState.activeSaveId || 'default';
  var customImages = {};
  try { customImages = JSON.parse(localStorage.getItem(LS_KEYS.customImages(saveId)) || '{}'); } catch (e) { /* corrupt */ }
  if (customImages[sceneType]) {
    const img = dom.characterImage;
    if (!img) return;
    if (img.src === customImages[sceneType]) return;
    img.classList.add('img-fade-out');
    setTimeout(() => {
      img.src = customImages[sceneType];
      img.classList.remove('img-fade-out');
      img.classList.add('img-fade-in');
      setTimeout(() => img.classList.remove('img-fade-in'), 500);
    }, 200);
    return;
  }

  // 默认图片逻辑
  const img = dom.characterImage;
  if (!img) return;
  const images = template?.sceneImages || FALLBACK_TEMPLATE.sceneImages;
  const defaultImg = template?.defaultSceneImage || '日常.png';
  const filename = images[sceneType] || defaultImg;
  if (img.src && img.src.endsWith(filename)) return;
  img.classList.add('img-fade-out');
  setTimeout(() => {
    img.src = filename;
    img.classList.remove('img-fade-out');
    img.classList.add('img-fade-in');
    setTimeout(() => img.classList.remove('img-fade-in'), 500);
  }, 200);
}

// ── 存档时间指示器 ──
function updateSaveIndicator() {
  let el = $('#save-indicator');
  if (!el) {
    el = document.createElement('span');
    el.id = 'save-indicator';
    el.style.cssText = 'font-size:10px;color:var(--text-dim);margin-left:8px;opacity:.7;';
    const topActions = document.querySelector('.top-actions');
    if (topActions) topActions.appendChild(el);
  }
  const now = new Date();
  const ts = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.textContent = '💾 ' + ts;
  el.title = '上次存档时间';
}

// ── 应用主题 ──
function applyTheme(themeName) {
  gameState._currentTheme = themeName;
  const existing = $('#theme-style');
  if (existing) existing.remove();

  if (!themeName || themeName === 'dark') {
    if (typeof startAmbient === 'function') startAmbient('dark');
    return;
  }

  const link = document.createElement('link');
  link.id = 'theme-style';
  link.rel = 'stylesheet';
  link.href = 'themes/theme-' + themeName + '.css';
  document.head.appendChild(link);

  // 切换氛围音效
  if (typeof startAmbient === 'function') startAmbient(themeName);
}

// ── 序章弹窗 ──
function showPrologue(template) {
  const icon = $('#prologue-icon');
  const title = $('#prologue-title');
  const body = $('#prologue-body');

  const world = template.worldSetting || '';
  const protag = template.protagonist || '';
  const conflict = template.conflict || '';
  const styleList = template.styles || [];
  const desc = template.description || '';

  function renderText(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    const paragraphs = escaped.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p =>
      '<p class="prologue-section-content">' + p.replace(/\n/g, '<br>') + '</p>'
    ).join('');
  }

  if (!world && !protag && !conflict) {
    body.innerHTML = '<p class="prologue-section-content">' + escapeHtml(desc || '一段未知的冒险即将展开。') + '</p>';
  } else {
    let html = '';
    if (world) {
      html += '<div class="prologue-section-title">🌍 世界观</div>';
      html += renderText(world);
    }
    if (protag) {
      html += '<div class="prologue-section-title">👤 主角设定</div>';
      html += renderText(protag);
    }
    if (conflict) {
      html += '<div class="prologue-section-title">⚔ 核心冲突</div>';
      html += renderText(conflict);
    }
    if (styleList.length > 0) {
      html += '<div class="prologue-styles-bar">';
      html += styleList.map(s => '<span class="prologue-style-tag">' + escapeHtml(s) + '</span>').join('');
      html += '</div>';
    }
    body.innerHTML = html;
  }

  icon.textContent = '📖';
  title.textContent = template.name || '序章';

  const overlay = $('#prologue-overlay');
  if (overlay) overlay.classList.add('active');
}

function closePrologue() {
  const overlay = $('#prologue-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── 存档选择器 ──
function showSaveSelector() {
  // 加载中不自动存档，防止保存缺AI回复的半截状态
  if (gameState.gameStarted && !gameState.isLoading) saveGameState();

  // 如果设置有未保存修改，先提示
  if (typeof _settingsDirty !== 'undefined' && _settingsDirty) {
    var setOv = $('#settings-overlay');
    if (setOv && setOv.classList.contains('active')) {
      if (!confirm('设置有未保存的修改，确定离开？')) return;
    }
  }

  const ov = $('#save-selector-overlay');
  if (ov) ov.classList.add('active');
  var setOv2 = $('#settings-overlay');
  if (setOv2) setOv2.classList.remove('active');
  var csOv2 = $('#create-save-overlay');
  if (csOv2) csOv2.classList.remove('active');

  initSaveTabs();
  renderMySavesPanel();
}

function renderMySavesPanel() {
  const saves = loadSaves();
  const grid = $('#save-grid');
  if (!grid) return;

  grid.innerHTML = saves.map(s => {
    const info = getSaveInfo(s.id);
    const hasProgress = info && info.roundNumber > 0;
    const dateStr = info?.lastPlayed ? new Date(info.lastPlayed).toLocaleDateString('zh-CN') : '';
    const goalLine = s.conflict ? s.conflict.replace(/\n.*/s, '').substring(0, 40) : (s.desc || '').substring(0, 40);
    const protagLine = s.protagonist ? s.protagonist.replace(/\n.*/s, '').substring(0, 30) : '';
    return `
    <div class="save-card" data-save-id="${s.id}">
      <div class="save-card-header">
        <span class="save-card-icon">${s.icon}</span>
        <span class="save-card-name">${escapeHtml(s.name)}</span>
      </div>
      ${protagLine ? `<div class="save-card-protag">👤 ${escapeHtml(protagLine)}</div>` : ''}
      <div class="save-card-goal">🎯 ${escapeHtml(goalLine || '新的冒险即将展开')}</div>
      <div class="save-card-meta">
        <span>${s.type === 'default' ? '📦 默认' : '✏ 自定义'}</span>
        ${hasProgress ? `<span>📝 第${info.roundNumber}回合</span><span>🕐 ${dateStr}</span>` : '<span>🆕 新存档</span>'}
      </div>
      ${hasProgress
        ? `<button class="btn btn-primary save-card-btn save-continue-btn" data-save-id="${s.id}">▶ 继续</button>
           <button class="btn btn-secondary save-card-btn save-new-btn" data-save-id="${s.id}" style="margin-top:4px;">🔄 新游戏</button>`
        : `<button class="btn btn-primary save-card-btn save-new-btn" data-save-id="${s.id}">▶ 开始</button>`}
      ${s.type !== 'default' ? `<button class="save-card-upload tavern-upload-btn" data-save-id="${s.id}">☁ 分享到酒馆</button>
           <button class="save-card-delete save-del-btn" data-save-id="${s.id}">✕</button>` : ''}
    </div>`;
  }).join('');

  // 绑定继续按钮
  grid.querySelectorAll('.save-continue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); continueGame(btn.dataset.saveId); });
  });
  // 绑定新游戏/开始按钮
  grid.querySelectorAll('.save-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); selectSave(btn.dataset.saveId); });
  });
  // 绑定删除模板按钮
  grid.querySelectorAll('.save-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSave(btn.dataset.saveId); });
  });
  // 绑定上传按钮
  grid.querySelectorAll('.tavern-upload-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); uploadToTavern(btn.dataset.saveId); });
  });

  // 底部按钮
  const footer = document.querySelector('#panel-my-saves .save-selector-footer');
  if (footer) {
    if (gameState.gameStarted) {
      footer.innerHTML = '<button id="btn-return-game" class="btn btn-secondary">↩ 返回游戏</button> <button id="btn-create-save" class="btn btn-primary">＋ 创建新模板</button>';
    } else {
      footer.innerHTML = '<button id="btn-create-save" class="btn btn-primary">＋ 创建新模板</button>';
    }
    const createBtn = document.querySelector('#btn-create-save');
    if (createBtn) createBtn.addEventListener('click', openCreateSave);
    const returnBtn = document.querySelector('#btn-return-game');
    if (returnBtn) returnBtn.addEventListener('click', () => {
      const ov = $('#save-selector-overlay');
      if (ov) ov.classList.remove('active');
    });
  }
}

function initSaveTabs() {
  // 重置标签
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const myTab = document.querySelector('.tab-btn[data-tab="my-saves"]');
  if (myTab) myTab.classList.add('active');

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const myPanel = document.querySelector('#panel-my-saves');
  if (myPanel) myPanel.classList.add('active');

  if (window._tabsBound) return;
  window._tabsBound = true;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      if (tab === 'my-saves') {
        const panel = document.querySelector('#panel-my-saves');
        if (panel) panel.classList.add('active');
      } else if (tab === 'tavern') {
        const panel = document.querySelector('#panel-tavern');
        if (panel) panel.classList.add('active');
        renderTavernPanel();
      }
    });
  });

  // 刷新酒馆按钮
  const refreshBtn = document.querySelector('#btn-refresh-tavern');
  if (refreshBtn) refreshBtn.addEventListener('click', function() { renderTavernPanel(); });
  const si = document.querySelector('#tavern-search');
  if (si) si.addEventListener('input', function() { renderTavernPanel(); });
  // 管理员按钮
  const adminBtn = document.querySelector('#btn-admin-login');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      if (isTavernAdmin) adminLogout(); else adminLogin();
    });
    adminBtn.title = isTavernAdmin ? '退出管理员' : '管理员登录';
  }
}

// ── 选择存档开始新游戏 ──
async function selectSave(saveId) {
  try {
    const template = await loadAndMergeTemplate(saveId);
    if (!template) {
      console.error('Template not found for save:', saveId);
      dlAlert('❌ 无法加载存档「' + saveId + '」，模板数据可能已损坏。').catch(function(){});
      return;
    }

    const ov = $('#save-selector-overlay');
    if (ov) ov.classList.remove('active');

    // 检查是否有现有存档进度，有则弹确认
    var existingSaves = [];
    for (let s = 0; s < 10; s++) {
      if (localStorage.getItem(getSaveKey(saveId, s))) existingSaves.push(s);
    }
    if (existingSaves.length > 0) {
      var latestData = null;
      for (var es = 0; es < existingSaves.length; es++) {
        var d = loadGameState(saveId, existingSaves[es]);
        if (d && (!latestData || d.lastPlayed > latestData.lastPlayed)) latestData = d;
      }
      var rn = latestData ? latestData.roundNumber : '?';
      var confirmMsg = '「' + (template.name || '该存档') + '」已有游戏进度（' + existingSaves.length + '个槽位，最新第' + rn + '回合）。\n\n开始新游戏将清除所有进度。确定？';
      var proceed = await dlConfirm(confirmMsg);
      if (!proceed) {
        // 回到存档选择页
        showSaveSelector();
        return;
      }
    }

    // 清除所有槽位的旧存档（0-9）防止残留手动存档干扰
    for (let s = 0; s < 10; s++) localStorage.removeItem(getSaveKey(saveId, s));
    gameState.activeTemplate = template;
    gameState.activeSaveId = saveId;
    localStorage.setItem(LS_KEYS.lastSaveId, saveId);
    const theme = localStorage.getItem(LS_KEYS.theme(saveId)) || template.theme || 'dark';
    applyTheme(theme);
    var savedFont = localStorage.getItem(LS_KEYS.font(saveId)) || 'sans';
    if (typeof applyFont === 'function') applyFont(savedFont);
    refreshSystemPrompt();
    renderStatusContainers(template);
    localStorage.setItem(LS_KEYS.activeTemplateId, saveId);
    showPrologue(template);
  } catch (e) {
    console.error('selectSave error:', e);
  }
}

console.log('📦 ui.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('ui');
