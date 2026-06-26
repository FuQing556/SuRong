/* ═══════════════════════════════════════════
   prompts.js — 提示词管理 + 主题选择 + 图片管理
   依赖：state.js, utils.js, dialogs.js, saves.js, ui.js
   ═══════════════════════════════════════════ */

// ── 未保存修改追踪 ──
let _settingsDirty = false;
function markSettingsDirty() { _settingsDirty = true; }
function clearSettingsDirty() { _settingsDirty = false; }

// ── 打开设置弹窗 ──
async function openSettings() {
  if (dom.settingsMsg) dom.settingsMsg.textContent = '';
  _settingsDirty = false;  // 重置脏标记

  // 插入修改提醒
  if (!$('#settings-warning')) {
    const warn = document.createElement('div');
    warn.id = 'settings-warning';
    warn.className = 'settings-warning';
    warn.innerHTML = '⚠ <b>注意：</b>小幅调整（语气、难度、字段名）下回合即可生效。大幅修改世界观或角色设定建议<b>开新游戏</b>，否则对话历史与新设定可能不一致。';
    dom.promptEditor.parentNode.insertBefore(warn, dom.promptEditor);
  }

  // 加载编辑过的模板（合并而非替换，防止串档）
  const editKey = LS_KEYS.editedTemplate(gameState.activeSaveId || 'default');
  const savedTpl = localStorage.getItem(editKey);
  if (savedTpl) {
    try {
      const ed = JSON.parse(savedTpl);
      const tpl = getActiveTemplate();
      if (ed.promptBody !== undefined) tpl.promptBody = ed.promptBody;
      if (ed.outputSections) tpl.outputSections = ed.outputSections;
      if (ed.achievements) tpl.achievements = ed.achievements;
      if (ed.hiddenAchievements) tpl.hiddenAchievements = ed.hiddenAchievements;
      refreshSystemPrompt();
      renderStatusContainers(tpl);
      // 重建DOM后立即回填当前值 + 为新字段ID补fieldHistory默认值
      if (gameState.gameStarted) {
        // 确保所有outputSections中的字段在fieldHistory中有条目
        for (const sec of Object.values(tpl.outputSections || {})) {
          for (const f of (sec.fields || [])) {
            if (!gameState.fieldHistory[f.id]) {
              gameState.fieldHistory[f.id] = f.type === 'number'
                ? { current: 0, max: 0 }
                : { currentText: '—' };
            }
          }
        }
        updateAllDynamicFieldsFromHistory();
      }
    } catch (e) { /* corrupt */ }
  }

  // 始终只显示 promptBody（正文），格式模板由 outputSections 自动生成，不可编辑
  // 之前显示 activeSystemPrompt 会导致保存后格式模板被嵌套进 promptBody
  const tpl = getActiveTemplate();
  if (tpl.promptBody && tpl.promptBody.length >= 100) {
    dom.promptEditor.value = tpl.promptBody;
    dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length + ' (当前模板: ' + (tpl.name || '未命名') + ')';
  } else {
    try {
      const resp = await fetch('/api/prompt');
      const data = await resp.json();
      dom.promptEditor.value = data.prompt || '';
      dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length;
    } catch (e) {
      dom.promptEditor.value = '';
      dom.promptLength.textContent = '字数: 0';
    }
  }

  // 显示已保存的 API Key
  const savedKey = localStorage.getItem(LS_KEYS.apikey) || '';
  if (dom.apiKeyInput) dom.apiKeyInput.value = savedKey;

  dom.settingsOverlay.classList.add('active');

  // 渲染字段编辑器
  renderFieldEditor();
  initThemeSelector();
  renderImageManager();
}

async function closeSettings() {
  if (_settingsDirty) {
    const confirmed = await dlConfirm('设置有未保存的修改，确定关闭？');
    if (!confirmed) return;
  }
  _settingsDirty = false;
  dom.settingsOverlay.classList.remove('active');
  if (gameState.gameStarted) updateAllDynamicFieldsFromHistory();
}

// ── 保存提示词 ──
async function savePrompt() {
  const prompt = dom.promptEditor.value;
  if (prompt.trim().length < 100) {
    dom.settingsMsg.textContent = '⚠ 提示词太短，至少需要100字';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }

  // ── v2: 检查结局标记是否完整 ──
  const origBody = gameState._originalTemplate?.promptBody || '';
  if (origBody) {
    const endingMarkerRe = /【游戏结束[：:·\s]*([^】]+)】/g;
    const missingEndings = [];
    let m;
    while ((m = endingMarkerRe.exec(origBody)) !== null) {
      if (prompt.indexOf(m[0]) === -1) {
        missingEndings.push(m[0]);
      }
    }
    if (missingEndings.length > 0) {
      const warning = '⚠ 警告：以下结局标记在编辑后的提示词中缺失，将导致这些结局无法触发：\n\n'
        + missingEndings.join('\n')
        + '\n\n建议取消后从原始模板复制结局章节。\n确定继续保存？（不完整结局的游戏体验将受影响）';
      const proceed = await dlConfirm(warning);
      if (!proceed) return;
    }
  }

  gameState.customPrompt = prompt;
  gameState.activeSystemPrompt = prompt;

  // 持久化——只保存 promptBody，不覆盖字段/成就等其他编辑
  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  tpl.promptBody = prompt;
  gameState.activeTemplate.promptBody = prompt;
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { const ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.promptBody = prompt;
  localStorage.setItem(editKey, JSON.stringify(edited));

  dom.settingsMsg.textContent = '⏳ 保存中...';
  dom.settingsMsg.style.color = 'var(--text-dim)';
  try {
    await fetch('/api/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  } catch (e) { /* server optional */ }
  clearSettingsDirty();
  dom.settingsMsg.textContent = '✅ 提示词已保存！新游戏和继续游戏均生效。';
  dom.settingsMsg.style.color = 'var(--green)';
  dom.promptLength.textContent = '字数: ' + prompt.length;
}

// ── 重新加载提示词 ──
async function reloadPrompt() {
  try {
    const resp = await fetch('/api/prompt');
    const data = await resp.json();
    dom.promptEditor.value = data.prompt || '';
    dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length;
    dom.settingsMsg.textContent = '✅ 已重新加载服务器上的提示词';
    dom.settingsMsg.style.color = 'var(--green)';
  } catch (e) {
    dom.settingsMsg.textContent = '❌ 加载失败';
    dom.settingsMsg.style.color = 'var(--red)';
  }
}

// ── 恢复原始提示词 ──
async function resetPrompt() {
  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || tpl.id || 'default';

  // 优先用 _originalTemplate，回退到服务器提示词
  let originalPromptBody = gameState._originalTemplate?.promptBody || '';
  if (!originalPromptBody && gameState.originalPrompt) {
    originalPromptBody = gameState.originalPrompt;
  }
  if (!originalPromptBody) {
    dom.settingsMsg.textContent = '⚠ 没有可恢复的原始提示词';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }

  dom.promptEditor.value = originalPromptBody;
  dom.promptLength.textContent = '字数: ' + originalPromptBody.length;
  gameState.customPrompt = '';

  // 清除编辑版模板中该存档的 promptBody，保留字段/成就编辑
  const editKey = LS_KEYS.editedTemplate(saveId);
  const savedTpl = localStorage.getItem(editKey);
  if (savedTpl) {
    try {
      const ed = JSON.parse(savedTpl);
      ed.promptBody = originalPromptBody;
      safeSetItem(editKey, ed);
    } catch (e) {
      // 解析失败只重置 promptBody，不删整个编辑键（保留字段/成就）
      safeSetItem(editKey, { promptBody: originalPromptBody });
    }
  }

  // 恢复当前模板的 promptBody（不修改 _originalTemplate 原版快照）
  tpl.promptBody = originalPromptBody;

  // 重建系统提示词
  gameState.activeSystemPrompt = buildSystemPrompt(tpl);
  gameState.customPrompt = gameState.activeSystemPrompt;

  dom.settingsMsg.textContent = '✅ 已恢复原始提示词（仅限当前存档：' + saveId + '）';
  dom.settingsMsg.style.color = 'var(--green)';
}

// ── 合并AI指令到提示词 ──
async function mergeInstructionsToPrompt() {
  const instructions = getAiInstructions();
  if (instructions.length === 0) {
    await dlAlert('没有可合并的指令。请先在AI聊天框中输入指令并发送。');
    return;
  }
  const confirmed = await dlConfirm('将 ' + instructions.length + ' 条AI指令合并到提示词末尾？\n合并后新游戏将包含这些规则。');
  if (!confirmed) return;

  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  const oldRules = [];
  const oi = tpl.promptBody.indexOf('【玩家补充规则');
  if (oi >= 0) {
    // 只提取【玩家补充规则】区块内的编号行（到下一个【标记为止）
    var sectionEnd = tpl.promptBody.indexOf('【', oi + 8);
    if (sectionEnd < 0) sectionEnd = tpl.promptBody.length;
    var sectionText = tpl.promptBody.substring(oi, sectionEnd);
    var ois = sectionText.match(/\d+\.\s+(.+)/g);
    if (ois) ois.forEach(function(item) { oldRules.push(item.replace(/^\d+\.\s+/, '')); });
    // 只删除旧区块，保留后续章节
    tpl.promptBody = (tpl.promptBody.substring(0, oi) + tpl.promptBody.substring(sectionEnd)).trimEnd();
  }
  const allRules = [...oldRules];
  instructions.forEach(i => { if (!allRules.includes(i.text)) allRules.push(i.text); });
  tpl.promptBody = tpl.promptBody + '\n\n【玩家补充规则——以下规则由玩家在游戏过程中添加，优先级高于原有规则】\n' + allRules.map((r, idx) => (idx + 1) + '. ' + r).join('\n');
  gameState.activeTemplate.promptBody = tpl.promptBody;
  // 只持久化 promptBody，不覆盖字段/成就等其他编辑
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { const ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.promptBody = tpl.promptBody;
  localStorage.setItem(editKey, JSON.stringify(edited));
  refreshSystemPrompt();
  clearAiInstructions();
  await dlAlert('✅ 已将 ' + instructions.length + ' 条指令合并到提示词！\n新游戏和继续游戏均生效。');
}

// ── 主题选择器（自动应用，无需额外点击）──
function initThemeSelector() {
  const sel = $('#theme-selector');
  if (!sel) return;
  if (sel.dataset.bound) return;  // 只绑定一次
  sel.dataset.bound = '1';
  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || 'default';
  sel.value = localStorage.getItem(LS_KEYS.theme(saveId)) || tpl.theme || 'dark';

  sel.addEventListener('change', function() {
    const theme = sel.value;
    localStorage.setItem(LS_KEYS.theme(saveId), theme);
    applyTheme(theme);
    if (gameState.gameStarted) saveGameState();
    if (gameState.activeTemplate) gameState.activeTemplate.theme = theme;
  });

  // 隐藏"应用"按钮——自动应用后不再需要
  const applyBtn = $('#btn-apply-theme');
  if (applyBtn) applyBtn.style.display = 'none';
}

// ── 图片管理 ──
function renderImageManager() {
  const container = $('#image-manager');
  if (!container) return;
  const tpl = getActiveTemplate();
  const images = tpl.sceneImages || {};
  const defaultImg = tpl.defaultSceneImage || '日常.png';
  const sceneTypes = tpl.sceneTypes || Object.keys(images);
  const customImages = JSON.parse(localStorage.getItem(LS_KEYS.customImages) || '{}');

  container.innerHTML = sceneTypes.map(type => {
    const currentSrc = customImages[type] || images[type] || defaultImg;
    const isCustom = !!customImages[type];
    return '<div class="image-mgr-row">' +
      '<span class="image-mgr-label">' + type + '</span>' +
      '<img class="image-mgr-thumb" src="' + currentSrc + '" alt="' + type + '" onerror="this.style.opacity=\'0.3\'">' +
      '<span class="image-mgr-filename">' + (isCustom ? '📁 自定义' : currentSrc) + '</span>' +
      '<button class="btn btn-small btn-replace-img" data-scene="' + type + '">📂 替换</button>' +
      (isCustom ? '<button class="btn btn-ghost btn-tiny btn-reset-img" data-scene="' + type + '">↺ 恢复</button>' : '') +
      '</div>';
  }).join('');

  container.querySelectorAll('.btn-replace-img').forEach(btn => {
    btn.addEventListener('click', () => {
      const sceneType = btn.dataset.scene;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const imgs = JSON.parse(localStorage.getItem(LS_KEYS.customImages) || '{}');
          imgs[sceneType] = reader.result;
          if (!safeSetItem(LS_KEYS.customImages, imgs)) {
            delete imgs[sceneType];
            return;
          }
          if (parsedLastSceneType === sceneType || !parsedLastSceneType) {
            const img = dom.characterImage;
            if (img) img.src = reader.result;
          }
          renderImageManager();
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  });

  container.querySelectorAll('.btn-reset-img').forEach(btn => {
    btn.addEventListener('click', () => {
      const imgs = JSON.parse(localStorage.getItem(LS_KEYS.customImages) || '{}');
      delete imgs[btn.dataset.scene];
      localStorage.setItem(LS_KEYS.customImages, JSON.stringify(imgs));
      renderImageManager();
    });
  });
}

console.log('📦 prompts.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('prompts');
