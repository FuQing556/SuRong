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
    '<option value="' + t.id + '" ' + (t.id === (gameState.activeTemplate?.id || 'surongrong') ? 'selected' : '') + '>' + t.name + '</option>'
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
    document.querySelectorAll('#style-chips .chip, #length-chips .chip').forEach(function(chip) {
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
        body: JSON.stringify({ name, world, protagonist, conflict, extra, styles, gameLength, apiKey: localStorage.getItem(LS_KEYS.apikey) || '' }),
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

  // 保存引用后清除缓存，防止下次创建时恢复旧模板
  const savedTemplate = generatedTemplate;
  generatedTemplate = null;
  localStorage.removeItem(LS_KEYS.generatedTpl);

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
        '<input class="field-icon" value="' + (f.icon || '') + '" placeholder="图标" title="点击右侧按钮选emoji" style="width:50px;text-align:center;">' +
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

  target.fields.push({
    id: 'f_' + Date.now().toString(36),
    label: '新字段',
    icon: '📌',
    formatHint: '[数值]',
    type: 'number',
  });
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  renderFieldEditor();
}

function saveFields() {
  const container = $('#field-editor-container');
  if (!container) return;

  const tpl = getActiveTemplate();
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

  rows.forEach(row => {
    const sKey = row.dataset.section;
    const inputs = row.querySelectorAll('input');
    const fid = inputs[0].value.trim() || 'unnamed';
    // 从旧字段保留 type（number/text），默认为 text
    const origField = origIndex[sKey]?.[fid];
    const fieldData = {
      id: fid,
      label: inputs[1].value.trim() || '未命名',
      icon: inputs[2].value.trim() || '',
      formatHint: inputs[3].value.trim() || '[状态]',
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

  // 保留原有 label 和 display
  for (const [sKey, section] of Object.entries(newSections)) {
    const orig = tpl.outputSections?.[sKey];
    if (orig) { section.label = orig.label; section.display = orig.display; }
  }

  tpl.outputSections = newSections;
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
  try { var ej = localStorage.getItem(LS_KEYS.editedTemplate(saveId)); if (ej) edited = JSON.parse(ej); } catch (e) {}
  edited.outputSections = tpl.outputSections;
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

console.log('📦 templates.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('templates');
