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
      // 防御：编辑版可能损坏，合并后立即校验
      if (typeof validateAndRepairTemplate === 'function') validateAndRepairTemplate(tpl);
      refreshSystemPrompt();
      // 游戏进行中不重建状态栏DOM — 只在需要时补字段+回填值
      if (gameState.gameStarted) {
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
      } else {
        renderStatusContainers(tpl);
      }
    } catch (e) { _devWarn('openSettings parse edits', e); }
  }

  // 始终只显示 promptBody（正文），格式模板由 outputSections 自动生成，不可编辑
  const tpl = getActiveTemplate();
  if (tpl.promptBody) {
    dom.promptEditor.value = tpl.promptBody;
    dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length + ' (当前模板: ' + (tpl.name || '未命名') + ')';
  } else {
    // 仅当 promptBody 完全缺失时才尝试加载服务器后备提示词
    try {
      const resp = await fetch('/api/prompt');
      const data = await resp.json();
      dom.promptEditor.value = data.prompt || '';
      dom.promptLength.textContent = '字数: ' + dom.promptEditor.value.length + ' (服务器后备)';
    } catch (e) {
      dom.promptEditor.value = '';
      dom.promptLength.textContent = '字数: 0';
    }
  }

  // 显示已保存的 API Key
  const savedKey = (typeof _readApiKey === 'function' ? _readApiKey() : localStorage.getItem(LS_KEYS.apikey)) || '';
  if (dom.apiKeyInput) dom.apiKeyInput.value = savedKey;

  dom.settingsOverlay.classList.add('active');

  // 渲染字段编辑器
  renderFieldEditor();
  initThemeSelector();
  initFontSelector();
  renderImageManager();

  // 兜底：无论什么操作触发了DOM重建，确保字段值已回填
  if (gameState.gameStarted && typeof updateAllDynamicFieldsFromHistory === 'function') {
    updateAllDynamicFieldsFromHistory();
  }
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

  const tpl = getActiveTemplate();

  // ── 字段引用校验：扫描 promptBody 中条件引用的字段标签 ──
  var allFieldLabels = [];
  var labelToField = {};
  for (var _sk2 in (tpl.outputSections || {})) {
    if (!tpl.outputSections.hasOwnProperty(_sk2)) continue;
    for (var _fi2 = 0; _fi2 < (tpl.outputSections[_sk2].fields || []).length; _fi2++) {
      var _f2 = tpl.outputSections[_sk2].fields[_fi2];
      allFieldLabels.push(_f2.label);
      labelToField[_f2.label] = _f2;
    }
  }
  // 扫描条件中的字段引用：支持纯中文/中英混合/纯英文标签（如 "HP值"、"SAN"、"压力值"）
  var condRe = /([一-鿿\w]{1,12})\s*[≥≤=><]=?\s*-?\d+/g;
  var unknownLabels = [];
  var cm;
  while ((cm = condRe.exec(prompt)) !== null) {
    var candidate = cm[1];
    // 排除已知非字段词汇（需与所有模板字段标签不冲突）
    // 注意：模板提示词元指令避免"中文+运算符+数字"格式，如"自动放宽为≥95"→应写成"自动放宽（≥95）"
    if (/^(?:轮次|回合|且|或|则|第|此|该|当前|最大|最小|以上|以下|不超过|不低于|自动放宽为|括号紧挨标记)$/.test(candidate)) continue;
    // 候选标签是某真实字段的子串（如"压力"⊆"压力值"→提示词中用了简称）→放过
    var isSubstr = allFieldLabels.some(function(label) { return label.indexOf(candidate) !== -1 && label !== candidate; });
    if (isSubstr) continue;
    if (allFieldLabels.indexOf(candidate) === -1 && unknownLabels.indexOf(candidate) === -1) {
      unknownLabels.push(candidate);
    }
  }
  if (unknownLabels.length > 0) {
    var warnRef = '⚠ 检测到以下条件引用了不存在的字段：\n\n' +
      unknownLabels.map(function(l) { return '• ' + l; }).join('\n') +
      '\n\n这些命运转折条件将无法被客户端识别和触发。\n当前模板字段：' + allFieldLabels.join('、') +
      '\n\n确定继续保存？';
    var proceedRef = await dlConfirm(warnRef);
    if (!proceedRef) return;
  }

  // ── 游戏中编辑警告 ──
  if (gameState.gameStarted) {
    var roundN2 = gameState.fullHistory.filter(function(m) { return m.role === 'user'; }).length;
    var warnGame = '⚠ 当前游戏已进行 ' + roundN2 + ' 回合。修改提示词设定后，已有的对话历史可能与新设定不一致。建议开新游戏。\n\n确定继续修改？';
    var proceedGame = await dlConfirm(warnGame);
    if (!proceedGame) return;
  }

  // ── v2: 检查结局标记是否完整 ──
  const origBody = gameState._originalTemplate?.promptBody || '';
  if (origBody) {
    const endingMarkerRe = /【(?:游戏结束|命运转折)[：:·\s]*([^】]+)】/g;
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

  // 持久化——只保存 promptBody，不覆盖字段/成就等其他编辑
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  tpl.promptBody = prompt;
  gameState.activeTemplate.promptBody = prompt;
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { var ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { _devWarn('savePrompt parse', e); }
  edited.promptBody = prompt;
  safeSetItem(editKey, edited);

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

// ── 恢复原始设定（多选范围）──
// 始终从服务器重新拉取模板，不使用内存快照（防止SW/HTTP缓存的旧版）
async function resetPrompt() {
  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || tpl.id || 'default';

  // 从服务器强制拉取最新模板
  let orig = null;
  try {
    dom.settingsMsg.textContent = '⏳ 正在从服务器获取最新模板...';
    dom.settingsMsg.style.color = 'var(--text-dim)';
    const resp = await fetch('/api/templates/' + saveId);
    if (resp.ok) {
      const data = await resp.json();
      orig = data.template || null;
    }
  } catch (e) { /* fall through to _originalTemplate */ }

  // 服务器拉不到则回退到内存快照
  if (!orig) {
    orig = gameState._originalTemplate;
    if (orig) {
      dom.settingsMsg.textContent = '⚠ 无法连接服务器，使用本地缓存的原始模板';
      dom.settingsMsg.style.color = 'var(--yellow)';
    }
  }

  if (!orig) {
    dom.settingsMsg.textContent = '⚠ 没有可恢复的原始模板';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }

  // 更新内存快照为最新版本
  gameState._originalTemplate = JSON.parse(JSON.stringify(orig));

  // 多选恢复范围
  var scopeStr = await dlPrompt(
    '恢复原始设定（输入数字组合，如 1234 全选）：\n\n' +
    '1. 提示词正文' + (orig.promptBody ? '（' + orig.promptBody.length + '字）' : '（无）') + '\n' +
    '2. 字段结构' + (orig.outputSections ? '（' + Object.keys(orig.outputSections).length + '区段）' : '（无）') + '\n' +
    '3. 可见成就' + (orig.achievements ? '（' + Object.keys(orig.achievements).length + '个）' : '（无）') + '\n' +
    '4. 隐藏成就' + (orig.hiddenAchievements ? '（' + Object.keys(orig.hiddenAchievements).length + '个）' : '（无）') + '\n\n' +
    '留空=取消恢复'
  );
  if (!scopeStr || !scopeStr.trim()) return;
  var scope = scopeStr.trim();

  var restorePrompt = /1/.test(scope);
  var restoreFields = /2/.test(scope);
  var restoreAch = /3/.test(scope);
  var restoreHidden = /4/.test(scope);

  if (!restorePrompt && !restoreFields && !restoreAch && !restoreHidden) {
    dom.settingsMsg.textContent = '⚠ 未选择任何恢复项';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }

  var restored = [];

  // 恢复提示词正文
  if (restorePrompt && orig.promptBody) {
    dom.promptEditor.value = orig.promptBody;
    dom.promptLength.textContent = '字数: ' + orig.promptBody.length;
    gameState.customPrompt = '';
    tpl.promptBody = orig.promptBody;
    restored.push('提示词正文');
  }

  // 恢复字段结构
  if (restoreFields && orig.outputSections) {
    tpl.outputSections = JSON.parse(JSON.stringify(orig.outputSections));
    restored.push('字段结构');
  }

  // 恢复可见成就
  if (restoreAch && orig.achievements) {
    tpl.achievements = JSON.parse(JSON.stringify(orig.achievements));
    restored.push('可见成就');
  }

  // 恢复隐藏成就
  if (restoreHidden && orig.hiddenAchievements) {
    tpl.hiddenAchievements = JSON.parse(JSON.stringify(orig.hiddenAchievements));
    restored.push('隐藏成就');
  }

  // 持久化
  const editKey = LS_KEYS.editedTemplate(saveId);
  var edited = {};
  try {
    var ej = localStorage.getItem(editKey);
    if (ej) edited = JSON.parse(ej);
  } catch (e) { /* corrupt */ }
  if (restorePrompt) edited.promptBody = orig.promptBody;
  if (restoreFields) edited.outputSections = tpl.outputSections;
  if (restoreAch) edited.achievements = tpl.achievements;
  if (restoreHidden) edited.hiddenAchievements = tpl.hiddenAchievements;
  safeSetItem(editKey, edited);

  // 刷新
  if (restoreFields) {
    renderStatusContainers(tpl);
    renderFieldEditor();
  }
  refreshSystemPrompt();
  gameState.activeSystemPrompt = buildSystemPrompt(tpl);
  gameState.customPrompt = gameState.activeSystemPrompt;

  dom.settingsMsg.textContent = '✅ 已恢复：' + restored.join('、');
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
    // 樱花主题默认切楷体（用户可手动改回）
    if (theme === 'sakura') {
      var curFont = localStorage.getItem(LS_KEYS.font(saveId)) || 'sans';
      if (curFont === 'sans') {
        localStorage.setItem(LS_KEYS.font(saveId), 'kai');
        if (typeof applyFont === 'function') applyFont('kai');
        var fs = $('#font-selector');
        if (fs) fs.value = 'kai';
      }
    }
  });

  // 隐藏"应用"按钮——自动应用后不再需要
  const applyBtn = $('#btn-apply-theme');
  if (applyBtn) applyBtn.style.display = 'none';
}

// ── 10套字体栈 ──
var FONT_STACKS = {
  sans:     "'Noto Sans SC','PingFang SC','Microsoft YaHei','Hiragino Sans GB',sans-serif",
  serif:    "'Noto Serif SC','STSong','Songti SC','SimSun',serif",
  kai:      "'KaiTi','STKaiti','Noto Serif SC',serif",
  fangsong: "'FangSong','STFangsong','Noto Serif SC',serif",
  round:    "'PingFang SC','Hiragino Maru Gothic Pro','Microsoft YaHei',sans-serif",
  xingshu:  "'KaiTi','STKaiti','Hiragino Mincho Pro',cursive",
  mono:     "'Cascadia Code','Fira Code','Noto Sans SC',monospace",
  light:    "'Noto Serif SC','Hiragino Mincho Pro','Songti SC',serif",
  bold:     "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",
  classic:  "'Noto Serif SC','STKaiti','Hiragino Mincho Pro',serif",
};

function initFontSelector() {
  var sel = $('#font-selector');
  if (!sel) return;
  if (sel.dataset.bound) return;
  sel.dataset.bound = '1';
  var saveId = gameState.activeSaveId || 'default';
  sel.value = localStorage.getItem(LS_KEYS.font(saveId)) || 'sans';

  sel.addEventListener('change', function() {
    var fontKey = sel.value;
    localStorage.setItem(LS_KEYS.font(saveId), fontKey);
    applyFont(fontKey);
    // 字体切换触发回流，双保险回填字段值
    if (gameState.gameStarted && typeof updateAllDynamicFieldsFromHistory === 'function') {
      updateAllDynamicFieldsFromHistory();
      requestAnimationFrame(function() { updateAllDynamicFieldsFromHistory(); });
    }
  });
}

function applyFont(fontKey) {
  // 移除旧字体 class，换新 — 最轻量的方式，不触发DOM回流
  var cls = document.body.className.replace(/\bfont-\w+\b/g, '').trim();
  document.body.className = cls + ' font-' + fontKey;
}

// ── 图片管理 ──
function renderImageManager() {
  const container = $('#image-manager');
  if (!container) return;
  const tpl = getActiveTemplate();
  const images = tpl.sceneImages || {};
  const defaultImg = tpl.defaultSceneImage || '日常.png';
  const sceneTypes = tpl.sceneTypes || Object.keys(images);
  const saveId = gameState.activeSaveId || 'default';
  var customImages = {};
  try { customImages = JSON.parse(localStorage.getItem(LS_KEYS.customImages(saveId)) || '{}'); } catch (e) { /* corrupt */ }

  container.innerHTML = sceneTypes.map(type => {
    const currentSrc = customImages[type] || images[type] || defaultImg;
    const isCustom = !!customImages[type];
    var escType = escapeHtml(type);
    var escSrc = escapeHtml(currentSrc);
    return '<div class="image-mgr-row">' +
      '<span class="image-mgr-label">' + escType + '</span>' +
      '<img class="image-mgr-thumb" src="' + escSrc + '" alt="' + escType + '" onerror="this.style.opacity=\'0.3\'">' +
      '<span class="image-mgr-filename">' + (isCustom ? '📁 自定义' : escSrc) + '</span>' +
      '<button class="btn btn-small btn-replace-img" data-scene="' + escType + '">📂 替换</button>' +
      (isCustom ? '<button class="btn btn-ghost btn-tiny btn-reset-img" data-scene="' + escType + '">↺ 恢复</button>' : '') +
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
          var imgs = {}; try { imgs = JSON.parse(localStorage.getItem(LS_KEYS.customImages(saveId)) || '{}'); } catch (e) {}
          imgs[sceneType] = reader.result;
          if (!safeSetItem(LS_KEYS.customImages(saveId), imgs)) {
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
      var imgs = {}; try { imgs = JSON.parse(localStorage.getItem(LS_KEYS.customImages(saveId)) || '{}'); } catch (e) {}
      delete imgs[btn.dataset.scene];
      localStorage.setItem(LS_KEYS.customImages(saveId), JSON.stringify(imgs));
      renderImageManager();
    });
  });
}

console.log('📦 prompts.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('prompts');
