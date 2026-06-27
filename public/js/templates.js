/* ═══════════════════════════════════════════
   templates.js — 模板加载/创建/字段编辑器
   依赖：state.js, utils.js, dialogs.js, saves.js, ui.js
   ═══════════════════════════════════════════ */

// ── 表单自动保存 Key ──
const FORM_SAVE_KEY = LS_KEYS.createForm;

// ── 已生成的模板缓存 ──
let generatedTemplate = null;

// ── 加载模板列表 ──
async function loadTemplateList() {
  try {
    const resp = await fetch('/api/templates');
    const data = await resp.json();
    return data.templates || [];
  } catch (e) { return []; }
}

// ── 加载单个模板 ──
async function loadTemplate(id) {
  try {
    const resp = await fetch('/api/templates/' + id);
    const data = await resp.json();
    return data.template || null;
  } catch (e) { return null; }
}

// ── 初始化模板选择器 ──
async function initTemplateSelector() {
  if (!dom.templateSelect) return;
  const templates = await loadTemplateList();
  if (templates.length <= 1) {
    dom.templateSelect.style.display = 'none';
    return;
  }
  dom.templateSelect.innerHTML = templates.map(t =>
    '<option value="' + escapeHtml(t.id) + '" ' + (t.id === (gameState.activeTemplate?.id || 'surongrong') ? 'selected' : '') + '>' + escapeHtml(t.name) + '</option>'
  ).join('');
  dom.templateSelect.style.display = '';
  dom.templateSelect.addEventListener('change', async (e) => {
    const tpl = await loadTemplate(e.target.value);
    if (tpl) {
      gameState.activeTemplate = tpl;
      applyTheme(tpl.theme);
      refreshSystemPrompt();
      renderStatusContainers(tpl);
      if (gameState.gameStarted) updateAllDynamicFieldsFromHistory();
      localStorage.setItem(LS_KEYS.activeTemplateId, tpl.id);
    }
  });
}

// ── 表单自动保存/恢复 ──
function saveFormData() {
  const data = {};
  ['new-save-name', 'new-save-world', 'new-save-protagonist', 'new-save-conflict', 'new-save-extra'].forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) data[id] = el.value;
  });
  data.styles = [...document.querySelectorAll('#style-chips .chip.selected')].map(c => c.dataset.style);
  const lenChip = document.querySelector('#length-chips .chip.selected');
  data.gameLength = lenChip ? lenChip.dataset.length : 'medium';
  const diffChip2 = document.querySelector('#difficulty-chips .chip.selected');
  data.difficulty = diffChip2 ? diffChip2.dataset.difficulty : 'standard';
  localStorage.setItem(FORM_SAVE_KEY, JSON.stringify(data));
}

function restoreFormData() {
  try {
    return JSON.parse(localStorage.getItem(FORM_SAVE_KEY));
  } catch (e) { return null; }
}

// ── 打开创建存档弹窗 ──
function openCreateSave() {
  const ssOv = $('#save-selector-overlay');
  if (ssOv) ssOv.classList.remove('active');
  const csOv = $('#create-save-overlay');
  if (csOv) csOv.classList.add('active');

  const saved = restoreFormData();
  ['new-save-name', 'new-save-world', 'new-save-protagonist', 'new-save-conflict', 'new-save-extra'].forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) el.value = saved ? (saved[id] || '') : '';
  });
  document.querySelectorAll('#style-chips .chip').forEach(c => c.classList.remove('selected'));
  if (saved?.styles) {
    document.querySelectorAll('#style-chips .chip').forEach(c => {
      if (saved.styles.includes(c.dataset.style)) c.classList.add('selected');
    });
  }
  document.querySelectorAll('#length-chips .chip').forEach(c => c.classList.remove('selected'));
  const savedLen = saved?.gameLength || 'medium';
  document.querySelectorAll('#length-chips .chip').forEach(c => {
    if (c.dataset.length === savedLen) c.classList.add('selected');
  });
  document.querySelectorAll('#difficulty-chips .chip').forEach(c => c.classList.remove('selected'));
  const savedDiff = saved?.difficulty || 'standard';
  document.querySelectorAll('#difficulty-chips .chip').forEach(c => {
    if (c.dataset.difficulty === savedDiff) c.classList.add('selected');
  });

  // 恢复已生成的模板
  try {
    const savedTpl = localStorage.getItem(LS_KEYS.generatedTpl);
    if (savedTpl) {
      generatedTemplate = JSON.parse(savedTpl);
      const previewEl = document.querySelector('#generated-prompt-preview');
      if (previewEl) previewEl.value = generatedTemplate.promptBody || '';
      const previewBox = document.querySelector('#generated-preview');
      if (previewBox) previewBox.classList.remove('hidden');
    }
  } catch (e) { generatedTemplate = null; }

  const msgEl = document.querySelector('#create-save-msg');
  if (msgEl) msgEl.textContent = generatedTemplate ? '✅ 已恢复上次生成的提示词' : '';

  // 绑定自动保存（仅首次）
  if (!window._createFormListenersBound) {
    window._createFormListenersBound = true;
    document.querySelectorAll('#create-save-overlay input, #create-save-overlay textarea').forEach(function(el) {
      el.addEventListener('input', saveFormData);
    });
    document.querySelectorAll('#style-chips .chip, #length-chips .chip, #difficulty-chips .chip').forEach(function(chip) {
      chip.addEventListener('click', function() { setTimeout(saveFormData, 100); });
    });
  }
}

function closeCreateSave() {
  const csOv = $('#create-save-overlay');
  if (csOv) csOv.classList.remove('active');
  showSaveSelector();
}

// ── AI 生成提示词 ──
async function generatePrompt() {
  const name = $('#new-save-name')?.value?.trim() || '';
  const world = $('#new-save-world')?.value?.trim() || '';
  const protagonist = $('#new-save-protagonist')?.value?.trim() || '';
  const conflict = $('#new-save-conflict')?.value?.trim() || '';
  const extra = $('#new-save-extra')?.value?.trim() || '';
  const styles = [...document.querySelectorAll('#style-chips .chip.selected')].map(c => c.dataset.style);
  const lenChip = document.querySelector('#length-chips .chip.selected');
  const gameLength = lenChip ? lenChip.dataset.length : 'medium';
  const diffChip = document.querySelector('#difficulty-chips .chip.selected');
  const difficulty = diffChip ? diffChip.dataset.difficulty : 'standard';

  if (!name || !world || !protagonist) {
    const msgEl = $('#create-save-msg');
    if (msgEl) { msgEl.textContent = '⚠ 请填写存档名称、世界观背景和主角设定'; msgEl.style.color = 'var(--red)'; }
    return;
  }

  saveFormData();

  const msgEl = $('#create-save-msg');
  if (msgEl) { msgEl.textContent = '⏳ AI 正在生成提示词，可能需要30-60秒...'; msgEl.style.color = 'var(--text-dim)'; }
  const btnEl = $('#btn-generate-prompt');
  if (btnEl) btnEl.disabled = true;

  // 重试最多3次
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1 && msgEl) { msgEl.textContent = '⏳ 第' + attempt + '次尝试生成...'; }
      const resp = await fetch('/api/generate-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, world, protagonist, conflict, extra, styles, gameLength, difficulty, apiKey: (typeof _readApiKey === 'function' ? _readApiKey() : '') || '' }),
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || '生成失败');
      const data = await resp.json();
      generatedTemplate = data.template;
      localStorage.setItem(LS_KEYS.generatedTpl, JSON.stringify(generatedTemplate));

      const previewEl = $('#generated-prompt-preview');
      if (previewEl) previewEl.value = data.template.promptBody || '';
      const previewBox = $('#generated-preview');
      if (previewBox) previewBox.classList.remove('hidden');
      if (msgEl) { msgEl.textContent = '✅ 提示词生成完成！可预览后确认创建。'; msgEl.style.color = 'var(--green)'; }
      break;
    } catch (err) {
      console.error('生成尝试' + attempt + '失败:', err.message);
      if (attempt === 3) {
        if (msgEl) { msgEl.textContent = '❌ 生成失败（已重试3次）: ' + err.message; msgEl.style.color = 'var(--red)'; }
      }
    }
  }
  const btnEl2 = $('#btn-generate-prompt');
  if (btnEl2) btnEl2.disabled = false;
}

// ── 确认创建存档 ──
async function confirmCreateSave() {
  if (!generatedTemplate) {
    try {
      const saved = localStorage.getItem(LS_KEYS.generatedTpl);
      if (saved) { generatedTemplate = JSON.parse(saved); }
    } catch (e) { /* corrupt */ }
  }
  if (!generatedTemplate) {
    const msgEl = $('#create-save-msg');
    if (msgEl) { msgEl.textContent = '⚠ 请先生成提示词'; msgEl.style.color = 'var(--red)'; }
    return;
  }
  const saves = loadSaves();
  const newId = 'custom_' + Date.now();
  saves.push({
    id: newId,
    name: generatedTemplate.name || ($('#new-save-name')?.value?.trim() || ''),
    desc: generatedTemplate.description || ($('#new-save-world')?.value?.trim()?.substring(0, 80) || ''),
    icon: '🎮', type: 'custom', template: generatedTemplate,
    worldSetting: $('#new-save-world')?.value?.trim() || generatedTemplate.worldSetting || '',
    protagonist: $('#new-save-protagonist')?.value?.trim() || generatedTemplate.protagonist || '',
    conflict: $('#new-save-conflict')?.value?.trim() || generatedTemplate.conflict || '',
    styles: generatedTemplate.styles || [],
  });
  saveUserSaves(saves);

  // 保存引用后清除所有缓存，防止下次创建时恢复旧模板/旧表单
  const savedTemplate = generatedTemplate;
  generatedTemplate = null;
  localStorage.removeItem(LS_KEYS.generatedTpl);
  localStorage.removeItem(FORM_SAVE_KEY);  // 清除表单自动保存缓存

  try { await fetch('/api/templates/' + newId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: savedTemplate }) }); } catch (e) { /* server optional */ }

  const csOv = $('#create-save-overlay');
  if (csOv) csOv.classList.remove('active');
  await selectSave(newId);
}

// ── 字段编辑器 ──
function renderFieldEditor() {
  const tpl = getActiveTemplate();
  const sections = tpl.outputSections || {};
  // 快照当前字段ID列表，供 saveFields 检测重命名迁移
  tpl._preEditFields = JSON.parse(JSON.stringify(sections));
  const container = $('#field-editor-container');
  if (!container) return;

  let html = '';
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    html += '<div class="field-editor-group"><h4>' + (section.label || sectionKey) + '</h4>';
    fields.forEach((f, idx) => {
      html += '<div class="field-editor-row" data-section="' + sectionKey + '" data-index="' + idx + '">' +
        '<input class="field-id" value="' + (f.id || '') + '" placeholder="ID" title="字段ID（英文）">' +
        '<input class="field-label" value="' + (f.label || '') + '" placeholder="标签" title="显示标签">' +
        '<input type="hidden" class="field-icon" value="' + (f.icon || '') + '">' +
        '<button class="btn-pick-emoji" title="选择图标" style="background:var(--bg-card);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:16px;padding:4px 8px;min-width:36px;">' + (f.icon || '🎨') + '</button>' +
        '<input class="field-format" value="' + (f.formatHint || '') + '" placeholder="格式提示" title="AI输出格式">' +
        '<button class="btn-remove-field" data-section="' + sectionKey + '" data-index="' + idx + '">✕</button>' +
        '</div>';
    });
    html += '</div>';
  }
  container.innerHTML = html;

  container.querySelectorAll('.btn-remove-field').forEach(btn => {
    btn.addEventListener('click', () => {
      removeField(btn.dataset.section, parseInt(btn.dataset.index));
    });
  });

  // emoji 选择器按钮
  container.querySelectorAll('.btn-pick-emoji').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.field-editor-row');
      const iconInput = row.querySelector('.field-icon');
      if (!iconInput) return;
      const picked = await pickEmoji(iconInput.value || btn.textContent);
      if (picked) { iconInput.value = picked; btn.textContent = picked; }
    });
  });
}

async function removeField(sectionKey, index) {
  const tpl = getActiveTemplate();
  const fields = tpl.outputSections?.[sectionKey]?.fields;
  if (!fields || index >= fields.length) return;
  const label = fields[index]?.label || '未命名';
  const confirmed = await dlConfirm('确定删除字段「' + label + '」？\n关闭设置前可刷新页面恢复。');
  if (!confirmed) return;
  fields.splice(index, 1);
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  renderFieldEditor();
}

async function addField() {
  const tpl = getActiveTemplate();
  const sections = tpl.outputSections || {};
  const choices = Object.keys(sections).filter(k => sections[k] && Array.isArray(sections[k].fields));
  if (choices.length === 0) return;

  let targetKey;
  if (choices.length === 1) {
    targetKey = choices[0];
  } else {
    const choice = await dlPrompt('添加到哪个区段？\n' + choices.map((k, i) => (i + 1) + '. ' + (sections[k].label || k)).join('\n'));
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    targetKey = (!isNaN(idx) && idx >= 0 && idx < choices.length) ? choices[idx] : (choices.find(k => k === choice || sections[k].label === choice) || 'variables');
  }
  const target = sections[targetKey];
  if (!target || !Array.isArray(target.fields)) return;

  // 字段基础信息
  const fid = await dlPrompt('字段ID（英文，如 "trust"）：', 'f_' + Date.now().toString(36));
  if (!fid || !fid.trim()) return;
  const label = await dlPrompt('显示标签（中文，如 "信任度"）：', '新字段');
  if (!label || !label.trim()) return;
  const icon = await pickEmoji('📌');
  if (icon === null) return;
  const typeChoice = await dlPrompt('字段类型：\n1. number（数值型，支持阈值检测）\n2. text（文本型）\n\n输入数字选择：', '1');
  const fieldType = typeChoice === '2' ? 'text' : 'number';
  const formatHint = await dlPrompt('格式提示（AI输出参考）：', fieldType === 'number' ? '[0-100]' : '[状态]');
  if (formatHint === null) return;

  // 叙事含义（必填）
  const narrative = await dlPrompt(
    '📝 叙事含义（必填 — AI据此理解字段在故事中的含义）：\n\n' +
    '例："信任度 — 梦红尘对你的信任程度。≥30时私下告知情报，≥60时主动保护你，≥80时将关键把柄交给你。≤-30时对你处处提防。"\n\n' +
    '请输入：',
    ''
  );
  if (!narrative || !narrative.trim()) {
    await dlAlert('⚠ 叙事含义为必填项。字段未创建。');
    return;
  }

  // 软阈值（可选）
  var softThresholds = '';
  var st1 = await dlPrompt('软阈值1（可选，如 "≥60→私下帮忙"。留空跳过）：', '');
  if (st1 && st1.trim()) {
    softThresholds += st1.trim();
    var st2 = await dlPrompt('软阈值2（可选，留空跳过）：', '');
    if (st2 && st2.trim()) softThresholds += ' | ' + st2.trim();
  }

  // 创建字段
  target.fields.push({
    id: fid.trim(),
    label: label.trim(),
    icon: icon.trim() || '📌',
    formatHint: formatHint.trim() || (fieldType === 'number' ? '[0-100]' : '[状态]'),
    type: fieldType,
  });

  // 追加字段定义到 promptBody
  var fieldDef = '\n\n【字段定义·' + label.trim() + '】\n' + narrative.trim();
  if (softThresholds) {
    fieldDef += '\n软阈值：' + softThresholds;
    fieldDef += '\n请在NPC行为和叙事中体现这些阈值——数值不同时NPC的反应应明显不同。';
  }
  // 找到【编辑参考】或 promptBody 末尾插入
  var editRefIdx = tpl.promptBody.indexOf('【编辑参考');
  if (editRefIdx >= 0) {
    tpl.promptBody = tpl.promptBody.substring(0, editRefIdx) + fieldDef + '\n\n' + tpl.promptBody.substring(editRefIdx);
  } else {
    tpl.promptBody = tpl.promptBody + fieldDef;
  }

  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  renderFieldEditor();
}

async function saveFields() {
  const container = $('#field-editor-container');
  if (!container) return;

  const tpl = getActiveTemplate();

  // ── 游戏中编辑警告 ──
  if (gameState.gameStarted) {
    var roundN3 = gameState.fullHistory.filter(function(m) { return m.role === 'user'; }).length;
    var warnGame2 = '⚠ 当前游戏已进行 ' + roundN3 + ' 回合。修改字段结构后，已有的对话历史可能与新字段不一致。建议开新游戏。\n\n确定继续修改？';
    var proceedGame2 = await dlConfirm(warnGame2);
    if (!proceedGame2) return;
  }

  const rows = container.querySelectorAll('.field-editor-row');
  const newSections = {};

  // 构建旧字段索引：sectionKey → fieldId → origField
  const origIndex = {};
  for (const [sKey, section] of Object.entries(tpl.outputSections || {})) {
    origIndex[sKey] = {};
    for (const f of (section.fields || [])) {
      origIndex[sKey][f.id] = f;
    }
  }

  // ── 构建旧标签→新标签映射（用于 promptBody 扫描替换）──
  var labelRenames = [];  // [{oldLabel, newLabel, sectionKey}]
  rows.forEach(row => {
    const sKey = row.dataset.section;
    const newLabel = (row.querySelector('.field-label')?.value || '').trim() || '未命名';
    // 查找旧标签（从 _preEditFields 按位置匹配）
    var oldSection = (tpl._preEditFields && tpl._preEditFields[sKey]) || [];
    var idx = parseInt(row.dataset.index);
    if (idx >= 0 && idx < oldSection.length) {
      var oldField = oldSection[idx];
      if (oldField && oldField.label && oldField.label !== newLabel) {
        labelRenames.push({ oldLabel: oldField.label, newLabel: newLabel, sectionKey: sKey });
      }
    }
  });

  rows.forEach(row => {
    const sKey = row.dataset.section;
    const fid = (row.querySelector('.field-id')?.value || '').trim() || 'unnamed';
    const newLabel = (row.querySelector('.field-label')?.value || '').trim() || '未命名';
    const iconVal = (row.querySelector('.field-icon')?.value || '').trim();
    const formatVal = (row.querySelector('.field-format')?.value || '').trim() || '[状态]';
    // 从旧字段保留 type（number/text），默认为 text
    const origField = origIndex[sKey]?.[fid];
    const fieldData = {
      id: fid,
      label: newLabel,
      icon: iconVal,
      formatHint: formatVal,
      type: origField?.type || 'text',
    };
    if (!newSections[sKey]) newSections[sKey] = { label: sKey, display: 'inline', fields: [] };
    newSections[sKey].fields.push(fieldData);
  });

  // 检查字段 ID 唯一性
  const seenIds = new Set();
  let dupFound = false;
  for (const section of Object.values(newSections)) {
    for (const f of (section.fields || [])) {
      if (seenIds.has(f.id)) { dupFound = true; break; }
      seenIds.add(f.id);
    }
    if (dupFound) break;
  }
  if (dupFound) {
    const msgEl = $('#fields-msg');
    if (msgEl) { msgEl.textContent = '⚠ 存在重复的字段ID，请修改后再保存。'; msgEl.style.color = 'var(--red)'; }
    return;
  }

  // ── 字段标签改名 → promptBody 扫描替换 ──
  if (labelRenames.length > 0 && tpl.promptBody) {
    var promptChanged = false;
    for (var lri = 0; lri < labelRenames.length; lri++) {
      var lr = labelRenames[lri];
      if (tpl.promptBody.indexOf(lr.oldLabel) >= 0) {
        var count = (tpl.promptBody.match(new RegExp(lr.oldLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (count > 0) {
          var replaceLabel = await dlConfirm(
            '检测到 promptBody 中有 ' + count + ' 处引用了「' + lr.oldLabel + '」。\n是否全部替换为「' + lr.newLabel + '」？'
          );
          if (replaceLabel) {
            tpl.promptBody = tpl.promptBody.split(lr.oldLabel).join(lr.newLabel);
            promptChanged = true;
          }
        }
      }
    }
    if (promptChanged) {
      // 同步更新编辑器内容
      if (dom.promptEditor && dom.promptEditor.value === gameState._originalTemplate?.promptBody) {
        dom.promptEditor.value = tpl.promptBody;
        dom.promptLength.textContent = '字数: ' + tpl.promptBody.length;
      }
    }
  }

  // 保留原有 label 和 display
  for (const [sKey, section] of Object.entries(newSections)) {
    const orig = tpl.outputSections?.[sKey];
    if (orig) { section.label = orig.label; section.display = orig.display; }
  }

  tpl.outputSections = newSections;
  // 防御：确保保存后的结构完整
  if (typeof validateAndRepairTemplate === 'function') validateAndRepairTemplate(tpl);
  refreshSystemPrompt();

  // ── 字段ID迁移：仅在纯重命名（等长、仅一个ID变化）时迁移，防止插入/删除导致数据错位 ──
  for (const [sKey, newSec] of Object.entries(newSections)) {
    const oldFields = (tpl._preEditFields && tpl._preEditFields[sKey]) || [];
    const newFields = newSec.fields || [];
    // 统计重命名数和新ID冲突数
    var renameCount = 0, conflictCount = 0;
    for (var ri = 0; ri < Math.min(oldFields.length, newFields.length); ri++) {
      if (oldFields[ri].id !== newFields[ri].id) {
        renameCount++;
        if (gameState.fieldHistory[newFields[ri].id]) conflictCount++;
      }
    }
    // 只在安全时迁移：等长 + 仅1个重命名 + 新ID无历史冲突
    if (oldFields.length === newFields.length && renameCount === 1 && conflictCount === 0) {
      for (var mi = 0; mi < oldFields.length; mi++) {
        var oid = oldFields[mi].id, nid = newFields[mi].id;
        if (oid !== nid && gameState.fieldHistory[oid]) {
          gameState.fieldHistory[nid] = gameState.fieldHistory[oid];
          delete gameState.fieldHistory[oid];
        }
      }
    } else if (renameCount > 1 || oldFields.length !== newFields.length) {
      console.warn('⚠ 字段结构变化较大（重命名' + renameCount + '/增删' + Math.abs(oldFields.length - newFields.length) + '），已跳过自动迁移。旧fieldHistory保留为孤立数据。');
    }
  }

  // 为新增字段初始化 fieldHistory 默认值，避免全显"—"
  for (const section of Object.values(newSections)) {
    for (const f of (section.fields || [])) {
      if (!gameState.fieldHistory[f.id]) {
        if (f.type === 'number') {
          gameState.fieldHistory[f.id] = { current: 0, max: 0 };
        } else {
          gameState.fieldHistory[f.id] = { currentText: '—' };
        }
      }
    }
  }

  renderStatusContainers(tpl);
  updateAllDynamicFieldsFromHistory();  // 重建DOM后立即回填数值
  renderFieldEditor();

  // 按存档隔离保存（仅保存 outputSections，与其他编辑键互不覆盖）
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  var edited = {};
  try { var ej2 = localStorage.getItem(LS_KEYS.editedTemplate(saveId)); if (ej2) edited = JSON.parse(ej2); } catch (e) {}
  edited.outputSections = tpl.outputSections;
  // 如果 promptBody 被改名扫描修改过，也一并保存
  if (typeof labelRenames !== 'undefined' && labelRenames.length > 0) {
    edited.promptBody = tpl.promptBody;
  }
  safeSetItem(LS_KEYS.editedTemplate(saveId), edited);

  // 只清除字段编辑的脏标记，不影响提示词编辑器的脏状态
  // （提示词有自己独立的保存按钮和脏标记追踪）
  if (typeof clearSettingsDirty === 'function') {
    // 延迟清除：如果用户也编辑了提示词，提示词输入事件会重新标记dirty
    setTimeout(function() { clearSettingsDirty(); }, 200);
  }
  const msgEl = $('#fields-msg');
  if (msgEl) {
    msgEl.textContent = gameState._saveFailed ? '⚠ 保存失败：存储空间不足' : '✅ 字段已保存！系统提示词已自动同步。';
    msgEl.style.color = gameState._saveFailed ? 'var(--red)' : 'var(--green)';
  }
}

// ── 从故事文本解析生成模板 ──
function toggleParseStoryPanel() {
  const panel = $('#parse-story-panel');
  if (!panel) return;
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : '';
  if (!isVisible) {
    // 自动填入额外要求字段的内容作为初始文本（如果有的话）
    const extraEl = $('#new-save-extra');
    const inputEl = $('#parse-story-input');
    if (inputEl && extraEl && extraEl.value.trim() && !inputEl.value.trim()) {
      inputEl.value = extraEl.value.trim();
    }
  }
}

async function parseStoryToTemplate() {
  const inputEl = $('#parse-story-input');
  const msgEl = $('#parse-story-msg');
  const storyText = (inputEl?.value || '').trim();

  if (storyText.length < 50) {
    if (msgEl) { msgEl.textContent = '⚠ 故事文本太短，至少需要50字'; msgEl.style.color = 'var(--red)'; }
    return;
  }

  if (msgEl) { msgEl.textContent = '⏳ AI 正在解析故事，可能需要30-60秒...'; msgEl.style.color = 'var(--text-dim)'; }
  const btnEl = $('#btn-parse-start');
  if (btnEl) btnEl.disabled = true;

  try {
    const resp = await fetch('/api/parse-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyText, apiKey: (typeof _readApiKey === 'function' ? _readApiKey() : '') || '' }),
      signal: AbortSignal.timeout(120000),
    });
    if (!resp.ok) throw new Error((await resp.json()).error || '解析失败');
    const data = await resp.json();
    generatedTemplate = data.template;
    localStorage.setItem(LS_KEYS.generatedTpl, JSON.stringify(generatedTemplate));

    // 自动填充表单（解析成功后强制覆盖，不保留旧输入）
    const tpl = generatedTemplate;
    if (tpl.name) { const el = $('#new-save-name'); if (el) el.value = tpl.name; }
    if (tpl.worldSetting) { const el = $('#new-save-world'); if (el) el.value = tpl.worldSetting; }
    if (tpl.protagonist) { const el = $('#new-save-protagonist'); if (el) el.value = tpl.protagonist; }
    if (tpl.conflict) { const el = $('#new-save-conflict'); if (el) el.value = tpl.conflict; }
    if (tpl.description) { const el = $('#new-save-extra'); if (el) el.value = tpl.description; }
    if (tpl.styles && tpl.styles.length > 0) {
      document.querySelectorAll('#style-chips .chip').forEach(function(c) {
        c.classList.toggle('selected', tpl.styles.includes(c.dataset.style));
      });
    }
    saveFormData();

    // 显示预览
    const previewEl = $('#generated-prompt-preview');
    if (previewEl) previewEl.value = tpl.promptBody || '';
    const previewBox = $('#generated-preview');
    if (previewBox) previewBox.classList.remove('hidden');
    if (msgEl) { msgEl.textContent = '✅ 解析完成！表单已自动填充。可预览后确认创建。'; msgEl.style.color = 'var(--green)'; }
    // 收起解析面板
    const panel = $('#parse-story-panel');
    if (panel) panel.style.display = 'none';
  } catch (err) {
    console.error('故事解析失败:', err.message);
    if (msgEl) { msgEl.textContent = '❌ 解析失败: ' + err.message; msgEl.style.color = 'var(--red)'; }
  }
  if (btnEl) btnEl.disabled = false;
}

// ── 命运转折编辑面板 ──
function renderEndingsPanel() {
  const tpl = getActiveTemplate();
  const list = $('#endings-list');
  if (!list) return;

  // 确保 endings 数组存在
  if (!tpl.endings || !Array.isArray(tpl.endings)) {
    if (typeof validateAndRepairTemplate === 'function') {
      validateAndRepairTemplate(tpl);
    }
    if (!tpl.endings) tpl.endings = [];
  }

  if (tpl.endings.length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);">暂无命运转折。点击下方按钮添加，或从提示词的【命运转折系统】章节自动迁移。</p>';
    return;
  }

  // 已触发的命运转折列表（按存档隔离）
  var triggered = (gameState.achievementFlags && gameState.achievementFlags.triggeredEndings) || [];

  // 收集所有字段标签供条件参考
  var allLabels = [];
  for (var sk in (tpl.outputSections || {})) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    (tpl.outputSections[sk].fields || []).forEach(function(f) {
      if (f.label) allLabels.push(f.label);
    });
  }

  var html = '';
  for (var i = 0; i < tpl.endings.length; i++) {
    var e = tpl.endings[i];
    var name = e.name || ('命运转折' + (i + 1));
    var condition = e.condition || '';
    var narrative = (e.narrative || '').substring(0, 60);
    var icon = e.icon || '🎭';
    var isTriggered = triggered.indexOf(name) >= 0;

    // 检测矛盾条件（同一字段同时有 ≤下限 和 ≥上限）
    var condWarn = '';
    var fieldChecks = {};
    var condParts = condition.split(/[且，,、]/);
    for (var cp = 0; cp < condParts.length; cp++) {
      var cm = condParts[cp].match(/(\S{1,8})\s*([≥≤=><]=?)\s*(\d+)/);
      if (cm) {
        var fn = cm[1], op = cm[2], val = parseInt(cm[3]);
        if (!fieldChecks[fn]) fieldChecks[fn] = [];
        fieldChecks[fn].push({ op: op, val: val });
      }
    }
    for (var fk in fieldChecks) {
      var checks = fieldChecks[fk];
      for (var ca = 0; ca < checks.length; ca++) {
        for (var cb = ca + 1; cb < checks.length; cb++) {
          var a = checks[ca], b = checks[cb];
          if ((a.op === '≤' || a.op === '<') && (b.op === '≥' || b.op === '>') && a.val < b.val) {
            condWarn = ' ⚠矛盾';
          }
          if ((b.op === '≤' || b.op === '<') && (a.op === '≥' || a.op === '>') && b.val < a.val) {
            condWarn = ' ⚠矛盾';
          }
        }
      }
    }

    html += '<div class="ending-editor-row" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);' + (isTriggered ? '' : 'opacity:0.45;') + '">' +
      '<span style="font-size:20px;flex-shrink:0;">' + icon + '</span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:600;font-size:13px;">' + escapeHtml(name) + (isTriggered ? ' <span style="color:var(--gold);font-size:11px;">✦ 已触发</span>' : '') + condWarn + '</div>' +
        '<div style="font-size:11px;color:' + (condWarn ? 'var(--red)' : 'var(--gold-dim)') + ';">' + escapeHtml(condition || '无条件') + '</div>' +
        '<div style="font-size:11px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(narrative) + '</div>' +
      '</div>' +
      '<button class="btn btn-ghost btn-tiny btn-edit-ending" data-index="' + i + '" style="flex-shrink:0;">✏️</button>' +
      '<button class="btn btn-ghost btn-tiny btn-del-ending" data-index="' + i + '" style="flex-shrink:0;">✕</button>' +
      '</div>';
  }
  html += '<div style="font-size:11px;color:var(--text-dim);margin-top:8px;">当前字段：' + allLabels.map(function(l) { return '<code>' + escapeHtml(l) + '</code>'; }).join(' ') + '</div>';
  list.innerHTML = html;

  list.querySelectorAll('.btn-edit-ending').forEach(function(btn) {
    btn.addEventListener('click', function() { editEnding(parseInt(btn.dataset.index)); });
  });
  list.querySelectorAll('.btn-del-ending').forEach(function(btn) {
    btn.addEventListener('click', function() { deleteEnding(parseInt(btn.dataset.index)); });
  });
}

async function addEnding() {
  var tpl = getActiveTemplate();
  if (!tpl.endings) tpl.endings = [];

  var name = await dlPrompt('命运转折名称（如"雪女觉醒"）：');
  if (!name || !name.trim()) return;

  var icon = await pickEmoji('🎭');
  if (icon === null) return;

  // 列出字段供参考
  var allLabels = [];
  for (var sk in (tpl.outputSections || {})) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    (tpl.outputSections[sk].fields || []).forEach(function(f) {
      if (f.label) allLabels.push(f.label);
    });
  }

  var condition = await dlPrompt(
    '触发条件（使用字段标签+运算符+数值）：\n' +
    '可用字段：' + allLabels.join('、') + '\n' +
    '例：妖血觉醒≥80 且 雪女一族好感≥30\n' +
    '运算符：≥ ≤ = > < >= <=\n' +
    '留空=无条件触发',
    ''
  );
  if (condition === null) return;

  var narrative = await dlPrompt(
    '叙事描述（AI据此展开命运转折场景，1-2句话）：\n' +
    '例：小夜在岚山结界中完全觉醒，冰华传授雪女秘术。但觉醒的波动被酒吞童子感知。',
    ''
  );
  if (narrative === null) return;

  tpl.endings.push({
    name: name.trim(),
    condition: (condition || '').trim(),
    narrative: (narrative || '').trim(),
    icon: icon.trim() || '🎭',
  });

  saveEndingsToTemplate(tpl);
  renderEndingsPanel();
}

async function editEnding(index) {
  var tpl = getActiveTemplate();
  if (!tpl.endings || index >= tpl.endings.length) return;
  var e = tpl.endings[index];

  var name = await dlPrompt('命运转折名称：', e.name || '');
  if (name === null) return;
  var icon = await pickEmoji(e.icon || '🎭');
  if (icon === null) return;

  var allLabels = [];
  for (var sk in (tpl.outputSections || {})) {
    if (!tpl.outputSections.hasOwnProperty(sk)) continue;
    (tpl.outputSections[sk].fields || []).forEach(function(f) {
      if (f.label) allLabels.push(f.label);
    });
  }

  var condition = await dlPrompt(
    '触发条件：\n可用字段：' + allLabels.join('、'),
    e.condition || ''
  );
  if (condition === null) return;
  var narrative = await dlPrompt('叙事描述：', e.narrative || '');
  if (narrative === null) return;

  e.name = name.trim() || e.name;
  e.icon = icon.trim() || e.icon;
  e.condition = (condition || '').trim();
  e.narrative = (narrative || '').trim();

  saveEndingsToTemplate(tpl);
  renderEndingsPanel();
}

async function deleteEnding(index) {
  var tpl = getActiveTemplate();
  if (!tpl.endings || index >= tpl.endings.length) return;
  var e = tpl.endings[index];
  var confirmed = await dlConfirm('确定删除命运转折「' + (e.name || '未命名') + '」？');
  if (!confirmed) return;
  tpl.endings.splice(index, 1);
  saveEndingsToTemplate(tpl);
  renderEndingsPanel();
}

function saveEndingsToTemplate(tpl) {
  var saveId = gameState.activeSaveId || tpl.id || 'default';
  var editKey = LS_KEYS.editedTemplate(saveId);
  var edited = {};
  try { var ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.endings = tpl.endings;
  safeSetItem(editKey, edited);
  // 刷新系统提示词使 endings 变更即时生效
  if (typeof refreshSystemPrompt === 'function') refreshSystemPrompt();
}

console.log('📦 templates.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('templates');
