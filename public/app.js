/* ═══════════════════════════════════════════
   互动叙事 · 模板驱动前端逻辑
   ═══════════════════════════════════════════ */

// ── DOM 引用 ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // 弹窗
  warningOverlay: $('#warning-overlay'),
  saveSelectorOverlay: $('#save-selector-overlay'),
  createSaveOverlay: $('#create-save-overlay'),
  settingsOverlay: $('#settings-overlay'),
  promptEditor: $('#prompt-editor'),
  promptLength: $('#prompt-length'),
  settingsMsg: $('#settings-msg'),
  apiKeyInput: $('#api-key-input'),
  // 游戏
  settlementContent: $('#settlement-content'),
  settlementBox: $('#settlement-box'),
  storyContent: $('#story-content'),
  initialPlaceholder: $('#initial-placeholder'),
  loadingIndicator: $('#loading-indicator'),
  errorBox: $('#error-box'),
  errorMsg: $('#error-message'),
  optionBtns: $$('.option-btn'),
  optionsContainer: $('#options-container'),
  characterImage: $('#character-image'),
  imageCaption: $('.image-caption'),
  // 动态容器
  statusGrid: $('#status-grid'),
  resourcesRow: $('#resources-row'),
  varsGrid: $('#vars-grid'),
  varsToggle: $('#vars-toggle'),
  // 模板选择器
  templateSelect: $('#template-select'),
};

// ── 成就定义（从活动模板加载，后备为默认成就）──
function getAchievements() {
  const tpl = getActiveTemplate();
  if (tpl.achievements && Object.keys(tpl.achievements).length > 0) return tpl.achievements;
  // 从模板变量字段自动生成成就
  const vars = tpl.outputSections?.variables?.fields || [];
  if (vars.length > 0) {
    const generated = {};
    vars.forEach(v => {
      generated[v.label + '大师'] = { icon: v.icon || '⭐', desc: v.label + '达到较高水平' };
    });
    generated['幸存者'] = { icon: '🍀', desc: '轮次≥30且未触发任何结局' };
    generated['崩坏'] = { icon: '💔', desc: '触发任一结局' };
    generated['极限操作'] = { icon: '🎲', desc: '孤注一掷选项成功' };
    return generated;
  }
  // 最终后备
  return {
    '幸存者': { icon: '🍀', desc: '轮次≥30且未触发任何结局' },
    '崩坏': { icon: '💔', desc: '触发任一结局' },
    '极限操作': { icon: '🎲', desc: '孤注一掷选项成功' },
  };
}

// ── 成就管理 ──
function unlockAchievement(name) {
  const all = getUnlockedAchievements();
  if (all[name]) return false;
  all[name] = new Date().toISOString().slice(0, 10);
  saveAchievements(all);
  showAchievementToast(name);
  return true;
}

function showAchievementToast(name) {
  const ach = getAchievements()[name];
  const toast = $('#achievement-toast');
  $('#ach-toast-text').textContent = `${ach?.icon || '🏆'} ${name}`;
  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  toast.offsetHeight;
  toast.style.animation = 'achSlideIn .5s ease, achSlideOut .5s ease 3s forwards';
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function checkAchievementsFromResponse(text) {
  const matches = text.matchAll(/【[🏆🏅⭐🎖️]?\s*成就解锁[：:]\s*(.+?)】/g);
  for (const m of matches) {
    if (getAchievements()[m[1].trim()]) unlockAchievement(m[1].trim());
  }
  const achLine = text.match(/成就[：:]\s*(.+)/);
  if (achLine) {
    achLine[1].split(/[\/,，]/).map(s => s.trim()).filter(Boolean).forEach(name => {
      if (name !== '无' && getAchievements()[name]) unlockAchievement(name);
    });
  }
}

function renderAchievementsPanel() {
  const all = getUnlockedAchievements();
  const list = $('#achievements-list');
  if (!list) return;
  const achievements = getAchievements();
  if (!achievements || Object.keys(achievements).length === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);">该模板未定义成就</p>';
    return;
  }
  list.innerHTML = Object.entries(achievements).map(([name, ach]) => {
    const unlocked = all[name];
    return `<div class="ach-item${unlocked ? '' : ' locked'}">
      <span class="ach-icon">${unlocked ? ach.icon : '🔒'}</span>
      <span class="ach-name">${name} — ${ach.desc}</span>
      ${unlocked ? `<span class="ach-date">${unlocked}</span>` : ''}</div>`;
  }).join('');
}

// ── 游戏状态 ──
const KEEP_ROUNDS = 8;

let gameState = {
  fullHistory: [],
  summary: '',
  summarisedCount: 0,
  currentOptions: [],
  isLoading: false,
  gameStarted: false,
  originalPrompt: '',
  customPrompt: '',
  activeTemplate: null,           // 当前活动模板（含 outputSections, sceneImages 等）
  activeSystemPrompt: '',         // 由模板自动生成的完整系统提示词
  activeSaveId: 'surongrong',     // 当前存档ID（用于存档/读档）
};

// ── 默认模板（后备）──
const FALLBACK_TEMPLATE = {
  id: 'fallback',
  name: '默认',
  theme: 'dark',
  sceneImages: {
    '对峙': '对峙.png','调查': '调查.png','潜伏': '潜伏.png','社交': '社交.png',
    '突发事件': '日常.png','战斗': '战斗.png','研究': '研究.png','交易': '交易.png',
    '日常': '日常.png','崩溃': '崩溃.png'
  },
  defaultSceneImage: '日常.png',
  outputSections: {
    statusTop: {
      label: '状态栏', display: 'inline',
      fields: [
        { id: 'soulState', label: '魂力残余', icon: '✨', type: 'text' },
        { id: 'abnormal', label: '异常状态', icon: '⚠', type: 'text' },
        { id: 'stress', label: '压力值', icon: '💔', type: 'number' },
      ]
    },
    taskLine: {
      label: null, display: 'inline',
      fields: [
        { id: 'currentTask', label: '当前潜伏任务', icon: '🎯', type: 'text' },
        { id: 'todo', label: '待办事项', icon: '📋', type: 'text' },
        { id: 'round', label: '轮次', icon: '🔄', type: 'number' },
      ]
    },
    resources: {
      label: '资源', display: 'inline',
      fields: [
        { id: 'soulReserve', label: '魂力储备', icon: '🔮', type: 'text' },
        { id: 'favors', label: '人情令牌', icon: '🎫', type: 'text' },
        { id: 'intel', label: '情报碎片', icon: '📜', type: 'number' },
        { id: 'blackmail', label: '把柄', icon: '🗡', type: 'number' },
      ]
    },
    variables: {
      label: '变量追踪', display: 'grid',
      fields: [
        { id: 'mengHaoGan', label: '梦红尘好感', icon: '💜', type: 'text' },
        { id: 'xiaoTaiDu', label: '笑红尘态度', icon: '⚔', type: 'text' },
        { id: 'exposure', label: '暴露风险', icon: '🚨', type: 'text' },
        { id: 'intelProgress', label: '情报进展', icon: '📊', type: 'text' },
        { id: 'majorEvents', label: '重大事件', icon: '⚡', type: 'text' },
      ]
    }
  },
  promptBody: '',
};

// ── 模板管理 ──
async function loadTemplateList() {
  try {
    const resp = await fetch('/api/templates');
    const data = await resp.json();
    return data.templates || [];
  } catch (e) { return []; }
}

async function loadTemplate(id) {
  try {
    const resp = await fetch(`/api/templates/${id}`);
    const data = await resp.json();
    return data.template || null;
  } catch (e) { return null; }
}

function getActiveTemplate() {
  return gameState.activeTemplate || FALLBACK_TEMPLATE;
}

// ── 从 outputSections 生成系统提示词格式段 ──
function generateOutputFormat(sections) {
  if (!sections || Object.keys(sections).length === 0) return '';
  const lines = [];
  lines.push('【强制输出格式】');
  lines.push('你每次回复，必须严格使用以下模板，不得添加、不得遗漏、不得发挥：');
  lines.push('[场景类型：类型名] [事件大小：大/小]');
  lines.push('上回合： [1-2句话，结算玩家上一回合选择的直接后果。做了什么、结果如何。这是因果结算，不写感受。]');
  lines.push('现状： [1-3句话，纯陈述。这是全新的场景。新的时间、新的地点、新的事件。不承接上回合的场景。]');
  lines.push('可选行动：');
  lines.push('1. [动作] — [代价] 【风险等级】');
  lines.push('2. [动作] — [代价] 【风险等级】');
  lines.push('3. [动作] — [代价] 【风险等级】');
  lines.push('4. [动作] — [代价] 【风险等级】');
  lines.push('请选择你的行动（回复数字1-4）。');
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    if (fields.length === 0) continue;
    if (section.label) lines.push(section.label);
    const fieldParts = fields.map(f => `${f.label}：${f.formatHint || '[状态]'}`);
    lines.push(fieldParts.join(' | '));
  }
  lines.push('');
  lines.push('【资源校验铁律】');
  lines.push('· 生成选项时，如果选项代价涉及消耗资源（如金钱、魂力、灵石等），必须先检查状态栏当前数值，确保玩家拥有足够资源。');
  lines.push('· 若玩家资源不足，该选项仍可显示，但必须在代价中明确标注"【资源不足】"，且选择后必然触发负面后果。');
  lines.push('· 若玩家强行选择资源不足的选项，下一回合必须在现状中体现失败后果（被追债、被打、失去信任、被迫签订不利契约等），不得让选项正常成功。');
  lines.push('· 每回合结算时，必须在状态栏中如实更新资源数值变动。消耗资源的选项必须扣减，获得资源的选项必须增加。');
  lines.push('');
  lines.push('注意：第一回合没有"上回合"，写"上回合：游戏开始。"即可。后续每回合必须在"上回合"中结算玩家上一轮的选择后果。');
  return lines.join('\n');
}

// ── 构建完整系统提示词 ──
function buildSystemPrompt(template) {
  if (!template) return gameState.originalPrompt || '';
  const format = generateOutputFormat(template.outputSections);
  const body = template.promptBody || '';
  return format + '\n' + body;
}

// ── 更新系统提示词（模板变化时调用）──
function refreshSystemPrompt() {
  const tpl = getActiveTemplate();
  gameState.activeSystemPrompt = buildSystemPrompt(tpl);
  // 同步更新 customPrompt（向后兼容旧逻辑）
  if (gameState.activeSystemPrompt) {
    gameState.customPrompt = gameState.activeSystemPrompt;
  }
}

// ── 应用主题 ──
function applyTheme(themeName) { gameState._currentTheme = themeName;
  const existing = $('#theme-style');
  if (existing) existing.remove();

  if (!themeName || themeName === 'dark') return; // dark 是基础样式，无需额外加载

  const link = document.createElement('link');
  link.id = 'theme-style';
  link.rel = 'stylesheet';
  link.href = `themes/theme-${themeName}.css`;
  document.head.appendChild(link);
}

// ── 初始化 ──
async function init() {
  bindEvents();

  if (localStorage.getItem('xixi_age_verified') === 'true') {
    dom.warningOverlay.classList.remove('active');
    showSaveSelector();
  }

  // 加载提示词和模板
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
      const savedTheme = localStorage.getItem("xixi_theme_" + lastSaveId);
      applyTheme(savedTheme || defaultTemplate.theme || "dark");
      console.log("Init: loaded theme", savedTheme || defaultTemplate.theme, "for save", lastSaveId);
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

async function initTemplateSelector() {
  if (!dom.templateSelect) return;
  const templates = await loadTemplateList();
  if (templates.length <= 1) {
    dom.templateSelect.style.display = 'none';
    return;
  }
  dom.templateSelect.innerHTML = templates.map(t =>
    `<option value="${t.id}" ${t.id === (gameState.activeTemplate?.id || 'surongrong') ? 'selected' : ''}>${t.name}</option>`
  ).join('');
  dom.templateSelect.style.display = '';
  dom.templateSelect.addEventListener('change', async (e) => {
    const tpl = await loadTemplate(e.target.value);
    if (tpl) {
      gameState.activeTemplate = tpl;
      applyTheme(tpl.theme);
      refreshSystemPrompt();
      renderStatusContainers(tpl);
      // 更新本地存储
      localStorage.setItem('xixi_active_template_id', tpl.id);
    }
  });
}

// ── 动态渲染状态栏容器 ──
function renderStatusContainers(template) {
  const sections = template.outputSections || {};

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
  }

  // 更新变量追踪标题
  if (dom.varsToggle && sections.variables?.label) {
    dom.varsToggle.textContent = sections.variables.label + ' ▼';
  }
}

// ── 事件绑定 ──
function bindEvents() {
  $('#btn-enter').addEventListener('click', () => {
    localStorage.setItem('xixi_age_verified', 'true');
    dom.warningOverlay.classList.remove('active');
    showSaveSelector();
  });
  $('#btn-leave').addEventListener('click', () => {
    window.close();
    if (!window.closed) document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#78788c;font-family:sans-serif;font-size:18px;">已退出</div>';
  });

  // 创建存档
  $('#btn-create-save').addEventListener('click', openCreateSave);
  $('#btn-cancel-create').addEventListener('click', closeCreateSave);
  $('#btn-generate-prompt').addEventListener('click', generatePrompt);
  $('#btn-confirm-save').addEventListener('click', confirmCreateSave);
  $('#btn-regenerate').addEventListener('click', generatePrompt);
  document.querySelector("#create-save-overlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeCreateSave(); });

  // 风格选择芯片
  $('#style-chips').addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
      e.target.classList.toggle('selected');
    }
  });

  // AI 聊天
  $('#btn-ai-send').addEventListener('click', sendAiInstruction);
  $('#btn-ai-clear').addEventListener('click', clearAiInstructions);
  $('#ai-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAiInstruction();
  });

  // API Key 保存
  $('#btn-save-apikey').addEventListener('click', () => {
    const key = dom.apiKeyInput ? dom.apiKeyInput.value.trim() : '';
    if (key && key.startsWith('sk-')) {
      localStorage.setItem('xixi_apikey', key);
      const msgEl = document.querySelector('#settings-msg');
      if (msgEl) { msgEl.textContent = '✅ API Key 已保存'; msgEl.style.color = 'var(--green)'; }
    } else {
      const msgEl = document.querySelector('#settings-msg');
      if (msgEl) { msgEl.textContent = '⚠ Key 格式不正确，应以 sk- 开头'; msgEl.style.color = 'var(--red)'; }
    }
  });

  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-close-settings').addEventListener('click', closeSettings);
  $('#btn-save-prompt').addEventListener('click', savePrompt);
  $('#btn-reload-prompt').addEventListener('click', reloadPrompt);
  $('#btn-reset-prompt').addEventListener('click', resetPrompt);
  $('#btn-save-fields').addEventListener('click', saveFields);
  $('#btn-add-field').addEventListener('click', addField);
  dom.settingsOverlay.addEventListener('click', (e) => { if (e.target === dom.settingsOverlay) closeSettings(); });

  // 序章弹窗
  $('#btn-prologue-start').addEventListener('click', () => {
    closePrologue();
    startNewGame();
  });

  dom.optionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && gameState.currentOptions[idx] && !gameState.isLoading) handleChoice(idx + 1);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (dom.settingsOverlay?.classList.contains("active")) return;
    if (dom.warningOverlay?.classList.contains("active")) return;
    if (dom.saveSelectorOverlay?.classList.contains("active")) return;
    if (dom.createSaveOverlay?.classList.contains("active")) return;
    if (document.querySelector('#prologue-overlay')?.classList.contains("active")) return;
    if (gameState.isLoading) return;
    const key = parseInt(e.key);
    if (key >= 1 && key <= 4 && gameState.currentOptions[key - 1]) {
      e.preventDefault();
      handleChoice(key);
    }
  });

  $('#btn-retry').addEventListener('click', () => retryLastRequest());

  // 存档选择器
  const newGameBtn = document.querySelector('#btn-new-game');
  if (newGameBtn) newGameBtn.addEventListener('click', showSaveSelector);
  const startGameBtn = document.querySelector('#btn-start-game');
  if (startGameBtn) startGameBtn.addEventListener('click', showSaveSelector);
  const backBtn = document.querySelector('#btn-back-saves');
  if (backBtn) backBtn.addEventListener('click', showSaveSelector);

  $('#btn-achievements').addEventListener('click', () => {
    try {
      renderAchievementsPanel();
      const overlay = $('#achievements-overlay');
      if (overlay) {
        overlay.classList.add('active');
        console.log('Achievements overlay opened');
      } else {
        console.error('Achievements overlay element not found');
      }
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

  document.querySelector("#save-selector-overlay")?.addEventListener("click", e => { /* 不关闭，必须选存档 */ });

  // 变量追踪折叠（动态绑定）
  if (dom.varsToggle && dom.varsGrid) {
    dom.varsToggle.addEventListener('click', () => {
      dom.varsGrid.classList.toggle('collapsed');
      const label = getActiveTemplate().outputSections?.variables?.label || '变量追踪';
      dom.varsToggle.textContent = dom.varsGrid.classList.contains('collapsed')
        ? label + ' ▶' : label + ' ▼';
    });
  }

  dom.promptEditor.addEventListener('input', () => {
    dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length}`;
  });
}

// ── 开始新游戏 ──
async function startNewGame() {
  // 彻底重置状态
  gameState.fullHistory = [];
  gameState.summary = '';
  gameState.summarisedCount = 0;
  gameState.currentOptions = [];
  gameState.gameStarted = false;
  gameState.isLoading = false;
  // 重置旧存档引用
  localStorage.removeItem(getSaveKey(gameState.activeSaveId || 'default'));

  dom.storyContent.innerHTML = '<div id="initial-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:20px;"><p class="placeholder-text">命运之轮重新转动...</p></div>';
  dom.initialPlaceholder = document.querySelector('#initial-placeholder');
  if (dom.errorBox) dom.errorBox.classList.add('hidden');
  dom.settlementContent.textContent = '—';
  dom.settlementBox.style.display = 'none';

  const tpl = getActiveTemplate();
  renderStatusContainers(tpl);
  updateAllDynamicFields({}, tpl);
  updateOptionButtons([]);
  switchSceneImage('日常', tpl);

  clearAiInstructions();
  renderAiChatMessages();

  const openings = tpl.openingMessages || ['开始游戏。【开局编号：1】'];
  const openingMsg = openings[Math.floor(Math.random() * openings.length)];
  await sendMessage(openingMsg);
}

// ── 发送消息 ──
async function sendMessage(userContent) {
  if (gameState.isLoading) return;
  gameState.isLoading = true;
  showLoading(true);
  dom.errorBox.classList.add('hidden');
  updateOptionButtons([]);

  try {
    // AI 实时指令：注入到用户消息中（AI无法忽略用户消息中的内容）
    const instructions = getAiInstructions();
    let enhancedContent = userContent;
    if (instructions.length > 0) {
      const instrText = instructions.map(i => i.text).join('；');
      enhancedContent = userContent + '\n\n【以下是你必须执行的指令，优先级高于系统提示词中的任何冲突规则：' + instrText + '。请在本次回复中直接体现这些指令的效果，不要只是说"收到"——用剧情和选项来展示变化。】';
    }

    gameState.fullHistory.push({ role: 'user', content: enhancedContent });
    await maybeSummarize();
    const recentMessages = gameState.fullHistory.slice(-(KEEP_ROUNDS * 2));

    refreshSystemPrompt();
    const tpl = getActiveTemplate();

    // 构建消息
    const allMessages = [
      { role: 'system', content: gameState.activeSystemPrompt },
    ];
    if (gameState.summary && gameState.summary.trim()) {
      allMessages.push({ role: 'system', content: `【历史摘要】${gameState.summary}` });
    }
    allMessages.push(...recentMessages);

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: allMessages,
        summary: null,
        systemPrompt: null,
        template: { id: tpl.id, outputSections: tpl.outputSections, promptBody: tpl.promptBody },
        apiKey: localStorage.getItem('xixi_apikey') || '',
      }),
      signal: AbortSignal.timeout(60000), // 60秒超时
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(errData.error || `请求失败 (${resp.status})`);
    }

    const data = await resp.json();
    gameState.fullHistory.push({ role: 'assistant', content: data.content });

    const parsed = parseAIResponse(data.content, tpl);
    renderGameState(parsed, tpl);
    checkAchievementsFromResponse(data.content);
    gameState.gameStarted = true;
    saveGameState(); // 自动存档

  } catch (err) {
    console.error('请求失败:', err);
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      showError('请求超时（60秒）。请检查网络连接，或在设置页确认 API Key 有效。');
    } else {
      showError(err.message);
    }
    gameState.fullHistory.pop();
  } finally {
    gameState.isLoading = false;
    showLoading(false);
  }
}

// ── 处理选择 ──
async function handleChoice(num) {
  if (gameState.isLoading) return;
  await sendMessage(`选择 ${num}`);
}

async function retryLastRequest() {
  if (gameState.fullHistory.length > 0 &&
      gameState.fullHistory[gameState.fullHistory.length - 1].role === 'assistant') {
    gameState.fullHistory.pop();
  }
  const lastUserMsg = [...gameState.fullHistory].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    const idx = gameState.fullHistory.lastIndexOf(lastUserMsg);
    if (idx >= 0) gameState.fullHistory.splice(idx, 1);
    await sendMessage(lastUserMsg.content);
  }
}

// ── 摘要管理 ──
async function maybeSummarize() {
  const totalMessages = gameState.fullHistory.length;
  const unsummarised = totalMessages - gameState.summarisedCount;
  const TRIGGER = KEEP_ROUNDS * 2 + 4;
  if (unsummarised <= TRIGGER) return;
  const keepStart = Math.max(0, totalMessages - KEEP_ROUNDS * 2);
  const toSummarise = gameState.fullHistory.slice(gameState.summarisedCount, keepStart);
  if (toSummarise.length < 4) return;
  try {
    const resp = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: toSummarise, previousSummary: gameState.summary }),
    });
    if (resp.ok) {
      const data = await resp.json();
      gameState.summary = data.summary;
      gameState.summarisedCount = keepStart;
    }
  } catch (err) { console.warn('摘要更新失败:', err); }
}

// ── 解析 AI 响应（模板驱动）──
function parseAIResponse(text, template) {
  const result = {
    sceneType: '', settlement: '', situation: '', options: [],
    fields: {},  // { fieldId: value } — 模板驱动
    raw: text,
  };

  // 场景类型
  const sceneMatch = text.match(/\[场景类型[：:]\s*(.+?)\]/);
  if (sceneMatch) result.sceneType = sceneMatch[1].trim();

  // 上回合结算
  const settleMatch = text.match(/上回合[：:]\s*([\s\S]*?)(?=现状[：:])/);
  if (settleMatch) {
    result.settlement = settleMatch[1].trim();
    if (result.settlement === '游戏开始。' || result.settlement === '游戏开始') result.settlement = '';
  }

  // 现状
  const sitMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动[：:]|$)/);
  if (sitMatch) result.situation = sitMatch[1].trim();
  else {
    const looseMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动|请选择|\n\n|$)/);
    if (looseMatch) result.situation = looseMatch[1].trim();
    else result.situation = text.substring(0, Math.min(200, text.length));
  }

  // 选项
  const optMatch = text.match(/可选行动[：:]\s*([\s\S]*?)(?=请选择你的行动|状态栏|$)/);
  if (optMatch) {
    const optText = optMatch[1].trim();
    optText.split('\n').filter(l => l.trim()).forEach(line => {
      const m = line.match(/^(.+?)\s*[—–\-]{1,2}\s*(.+)$/);
      if (m) result.options.push({ action: m[1].trim(), cost: m[2].trim() });
      else if (line.trim()) result.options.push({ action: line.trim(), cost: '未知代价' });
    });
  }

  // 模板驱动字段提取
  const sections = template?.outputSections || FALLBACK_TEMPLATE.outputSections;
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    for (const field of fields) {
      result.fields[field.id] = extractField(text, field.label);
    }
  }

  return result;
}

function extractField(text, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 值到换行符或 | 分隔符为止，避免跨字段匹配
  const re = new RegExp(`${escaped}[：:]\\s*([^|\\n]+?)(?:\\s*[|]|\\s*\\n|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '—';
}

// ── 场景图片（模板驱动）──
function switchSceneImage(sceneType, template) {
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
  if (sceneType) {
    const tplName = template?.name || '';
    dom.imageCaption.textContent = tplName ? `${tplName} [${sceneType}]` : `[${sceneType}]`;
  }
}

// ── 渲染游戏状态 ──
function renderGameState(parsed, template) {
  const placeholder = document.getElementById('initial-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  if (parsed.sceneType) switchSceneImage(parsed.sceneType, template);

  if (parsed.settlement) {
    dom.settlementContent.textContent = parsed.settlement;
    dom.settlementBox.style.display = '';
  } else if (!parsed.settlement && !parsed.situation) {
    dom.settlementBox.style.display = 'none';
  }

  if (parsed.situation) {
    dom.storyContent.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = parsed.situation;
    p.classList.add('story-fade-in');
    dom.storyContent.appendChild(p);
    $('#story-box').scrollTop = 0;
  }

  updateOptionButtons(parsed.options);
  gameState.currentOptions = parsed.options;

  updateAllDynamicFields(parsed.fields, template);

  if (!parsed.situation && parsed.options.length === 0) {
    dom.storyContent.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = parsed.raw;
    p.style.whiteSpace = 'pre-wrap';
    p.classList.add('story-fade-in');
    dom.storyContent.appendChild(p);
    updateOptionButtons([]);
  }
}

// ── 更新选项按钮 ──
function updateOptionButtons(options) {
  dom.optionBtns.forEach((btn, i) => {
    const opt = options[i];
    const actionEl = btn.querySelector('.option-action');
    const costEl = btn.querySelector('.option-cost');
    if (opt) {
      actionEl.textContent = opt.action;
      costEl.textContent = opt.cost ? `— ${opt.cost}` : '';
      btn.disabled = false;
      btn.style.display = '';
    } else {
      actionEl.textContent = '';
      costEl.textContent = '';
      btn.disabled = true;
      if (i >= (options.length || 0)) btn.style.display = options.length === 0 ? '' : 'none';
    }
  });
  if (options.length === 0) {
    dom.optionBtns.forEach(btn => {
      btn.querySelector('.option-action').textContent = '等待中...';
      btn.querySelector('.option-cost').textContent = '';
      btn.disabled = true;
      btn.style.display = '';
    });
  }
}

// ── 动态更新所有字段 ──
function updateAllDynamicFields(fieldValues, template) {
  const sections = template?.outputSections || FALLBACK_TEMPLATE.outputSections;
  const allFields = [];
  for (const [sectionKey, section] of Object.entries(sections)) {
    for (const f of section.fields) {
      allFields.push(f);
    }
  }

  for (const field of allFields) {
    const el = document.getElementById(`field-${field.id}`);
    if (!el) continue;
    const value = fieldValues[field.id] || '—';
    el.textContent = value;

    // 数值高亮
    el.className = 'status-value';
    if (field.type === 'number') {
      const num = parseInt(value);
      if (!isNaN(num)) {
        if (num >= 70) el.classList.add('pressure-danger');
        else if (num >= 40) el.classList.add('pressure-warn');
        else el.classList.add('pressure-safe');
      }
    }
  }
}

// ── 加载状态 ──
function showLoading(show) {
  dom.loadingIndicator.classList.toggle('hidden', !show);
}

// ── 错误处理 ──
function showError(msg) {
  dom.errorBox.classList.remove('hidden');
  dom.errorMsg.textContent = msg;
  if (gameState.currentOptions.length > 0) updateOptionButtons(gameState.currentOptions);
}

// ── 设置弹窗 ──
async function openSettings() {
  dom.settingsMsg.textContent = '';
  // 插入修改提醒
  if (!$('#settings-warning')) {
    const warn = document.createElement('div');
    warn.id = 'settings-warning';
    warn.className = 'settings-warning';
    warn.innerHTML = '⚠ <b>注意：</b>小幅调整（语气、难度、字段名）下回合即可生效。大幅修改世界观或角色设定建议<b>开新游戏</b>，否则对话历史与新设定可能不一致。';
    dom.promptEditor.parentNode.insertBefore(warn, dom.promptEditor);
  }

  // 优先显示活动模板的系统提示词
  if (gameState.activeSystemPrompt && gameState.activeSystemPrompt.length >= 100) {
    dom.promptEditor.value = gameState.activeSystemPrompt;
    dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length} (当前模板)`;
  } else {
    const localPrompt = localStorage.getItem('xixi_custom_prompt');
    if (localPrompt && localPrompt.trim()) {
      dom.promptEditor.value = localPrompt;
      dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length} (本地版本)`;
    } else {
      try {
        const resp = await fetch('/api/prompt');
        const data = await resp.json();
        dom.promptEditor.value = data.prompt || '';
        dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length}`;
      } catch (e) {
        dom.promptEditor.value = '';
        dom.promptLength.textContent = '字数: 0';
      }
    }
  }
  // 显示已保存的 API Key
  const savedKey = localStorage.getItem('xixi_apikey') || '';
  if (dom.apiKeyInput) dom.apiKeyInput.value = savedKey;

  dom.settingsOverlay.classList.add('active');
}

function closeSettings() { dom.settingsOverlay.classList.remove('active'); }

async function savePrompt() {
  const prompt = dom.promptEditor.value;
  if (prompt.trim().length < 100) {
    dom.settingsMsg.textContent = '⚠ 提示词太短，至少需要100字';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }
  localStorage.setItem('xixi_custom_prompt', prompt);
  gameState.customPrompt = prompt;
  gameState.activeSystemPrompt = prompt; // 手动编辑的提示词直接使用
  dom.settingsMsg.textContent = '⏳ 保存中...';
  dom.settingsMsg.style.color = 'var(--text-dim)';
  try {
    await fetch('/api/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
  } catch (e) { /* Vercel 上忽略 */ }
  dom.settingsMsg.textContent = '✅ 提示词已保存！开始新游戏后生效。';
  dom.settingsMsg.style.color = 'var(--green)';
  dom.promptLength.textContent = `字数: ${prompt.length} (本地版本)`;
}

async function reloadPrompt() {
  try {
    const resp = await fetch('/api/prompt');
    const data = await resp.json();
    dom.promptEditor.value = data.prompt || '';
    dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length}`;
    dom.settingsMsg.textContent = '✅ 已重新加载服务器上的提示词';
    dom.settingsMsg.style.color = 'var(--green)';
  } catch (e) {
    dom.settingsMsg.textContent = '❌ 加载失败';
    dom.settingsMsg.style.color = 'var(--red)';
  }
}

async function resetPrompt() {
  if (!gameState.originalPrompt) {
    dom.settingsMsg.textContent = '⚠ 没有备份的提示词';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }
  dom.promptEditor.value = gameState.originalPrompt;
  dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length}`;
  localStorage.removeItem('xixi_custom_prompt');
  gameState.customPrompt = '';
  dom.settingsMsg.textContent = '✅ 已恢复默认提示词';
  dom.settingsMsg.style.color = 'var(--green)';
}

// ── 存档管理 ──
function loadSaves() {
  const saves = [
    {
      id: 'surongrong', name: '苏蓉蓉·潜伏',
      desc: '斗罗大陆世界观。扮演史莱克卧底在日月帝国皇家魂导学院挣扎求生。潜行、博弈、情报、生存。',
      icon: '🌸', type: 'default',
      worldSetting: '斗罗大陆。日月帝国皇家魂导师学院，大陆最先进魂导技术中心。多方势力暗中博弈，魂师大赛临近。',
      protagonist: '苏蓉蓉，18岁女魂师。武魂圣光铃兰（极致之光），64级魂帝。史莱克弃子兼潜伏先发队，在受辱与求存间走钢丝。',
      conflict: '潜伏获取情报换取撤离。平衡各方势力觊觎。在暴露风险、精神崩溃与人格磨损中求生。',
      styles: ['潜行谍战', '社交博弈', '沉沦堕落', '冒险战斗'],
    },
  ];
  // 加载用户创建的存档
  const userSaves = JSON.parse(localStorage.getItem('xixi_saves') || '[]');
  return [...saves, ...userSaves];
}

function saveUserSaves(saves) {
  const userSaves = saves.filter(s => s.type !== 'default');
  localStorage.setItem('xixi_saves', JSON.stringify(userSaves));
}

// ── 游戏存档（自动保存/读取）──
function getSaveKey(templateId) {
  return 'xixi_gamesave_' + (templateId || 'default');
}

function saveGameState() {
  if (!gameState.gameStarted || gameState.fullHistory.length < 2) return;
  const tpl = getActiveTemplate();
  const saveKey = getSaveKey(gameState.activeSaveId || tpl.id || 'default');
  const saveData = {
    templateId: gameState.activeSaveId || tpl.id || 'default',
    fullHistory: gameState.fullHistory,
    summary: gameState.summary,
    summarisedCount: gameState.summarisedCount,
    currentOptions: gameState.currentOptions,
    lastPlayed: Date.now(),
    roundNumber: gameState.fullHistory.filter(m => m.role === "user").length,
    theme: gameState._currentTheme || tpl.theme || "dark",
  };
  try { localStorage.setItem(saveKey, JSON.stringify(saveData)); } catch(e) {}
}

function loadGameState(templateId) {
  const saveKey = getSaveKey(templateId);
  try {
    const data = JSON.parse(localStorage.getItem(saveKey));
    if (data && data.fullHistory && data.fullHistory.length > 0) return data;
  } catch(e) {}
  return null;
}

function getSaveInfo(templateId) {
  const data = loadGameState(templateId);
  if (!data) return null;
  return {
    roundNumber: data.roundNumber || 0,
    lastPlayed: data.lastPlayed || 0,
    hasSave: true,
  };
}

// ── 成就隔离存储（按模板ID）──
function getAchieveKey() {
  const tpl = getActiveTemplate();
  return 'xixi_achievements_' + (tpl.id || 'default');
}

function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(getAchieveKey()) || '{}'); }
  catch { return {}; }
}
function saveAchievements(data) { localStorage.setItem(getAchieveKey(), JSON.stringify(data)); }

function showSaveSelector() {
  // 先保存当前游戏状态（含主题），确保不丢失
  if (gameState.gameStarted) saveGameState();

  // 显示弹窗
  const ov = document.querySelector('#save-selector-overlay');
  if (ov) ov.classList.add('active');
  const setOv = document.querySelector('#settings-overlay');
  if (setOv) setOv.classList.remove('active');
  const csOv = document.querySelector('#create-save-overlay');
  if (csOv) csOv.classList.remove('active');

  // 初始化标签切换
  initSaveTabs();

  // 默认显示我的存档
  renderMySavesPanel();
}

function renderMySavesPanel() {
  const saves = loadSaves();
  const grid = document.querySelector('#save-grid');
  if (!grid) return;

  grid.innerHTML = saves.map(s => {
    const info = getSaveInfo(s.id);
    const hasProgress = info && info.roundNumber > 0;
    const dateStr = info?.lastPlayed ? new Date(info.lastPlayed).toLocaleDateString('zh-CN') : '';
    // 故事简述：优先用 conflict 首句，回退到 desc
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

  // 绑定按钮事件
  grid.querySelectorAll('.save-continue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); continueGame(btn.dataset.saveId); });
  });
  grid.querySelectorAll('.save-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); selectSave(btn.dataset.saveId); });
  });
  grid.querySelectorAll('.save-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSave(btn.dataset.saveId); });
  });
  // 上传按钮
  grid.querySelectorAll('.tavern-upload-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      uploadToTavern(btn.dataset.saveId);
    });
  });

  // 底部按钮（在 #panel-my-saves 内）
  const footer = document.querySelector('#panel-my-saves .save-selector-footer');
  if (footer) {
    if (gameState.gameStarted) {
      footer.innerHTML = '<button id="btn-return-game" class="btn btn-secondary">↩ 返回游戏</button> <button id="btn-create-save" class="btn btn-primary">＋ 创建新存档</button>';
    } else {
      footer.innerHTML = '<button id="btn-create-save" class="btn btn-primary">＋ 创建新存档</button>';
    }
    const createBtn = document.querySelector('#btn-create-save');
    if (createBtn) createBtn.addEventListener('click', openCreateSave);
    const returnBtn = document.querySelector('#btn-return-game');
    if (returnBtn) returnBtn.addEventListener('click', () => {
      const ov = document.querySelector('#save-selector-overlay');
      if (ov) ov.classList.remove('active');
    });
  }
}

function initSaveTabs() {
  // 重置标签：默认激活"我的存档"
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const myTab = document.querySelector('.tab-btn[data-tab="my-saves"]');
  if (myTab) myTab.classList.add('active');

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const myPanel = document.querySelector('#panel-my-saves');
  if (myPanel) myPanel.classList.add('active');

  // 绑定标签切换（只绑一次）
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
  if (refreshBtn) refreshBtn.addEventListener('click', renderTavernPanel);
  // 管理员按钮
  const adminBtn = document.querySelector('#btn-admin-login');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      if (isTavernAdmin) adminLogout(); else adminLogin();
    });
    adminBtn.title = isTavernAdmin ? '退出管理员' : '管理员登录';
  }
}

async function selectSave(saveId) {
  try {
    const ov = document.querySelector('#save-selector-overlay');
    if (ov) ov.classList.remove('active');

    let template;
    if (saveId === 'surongrong') {
      template = await loadTemplate('surongrong');
    } else {
      const saves = loadSaves();
      const save = saves.find(s => s.id === saveId);
      template = save?.template || null;
      console.log('Loading custom save:', saveId, 'template:', template?.name, 'has sections:', !!template?.outputSections, 'has achievements:', !!template?.achievements);
    }
    if (template) {
      localStorage.removeItem(getSaveKey(saveId)); // 清除旧存档
      gameState.activeTemplate = template;
      gameState.activeSaveId = saveId;
      localStorage.setItem('xixi_last_save_id', saveId);
      const theme = localStorage.getItem("xixi_theme_" + saveId) || template.theme || "dark";
      applyTheme(theme);
      console.log("selectSave: applied theme", theme, "for save", saveId);
      refreshSystemPrompt();
      renderStatusContainers(template);
      localStorage.setItem('xixi_active_template_id', saveId);
      // 新游戏展示序章，不直接开始
      showPrologue(template);
    } else {
      console.error('Template not found for save:', saveId);
    }
  } catch (e) {
    console.error('selectSave error:', e);
  }
}

function deleteSave(saveId) {
  if (!confirm('确定要删除这个存档吗？此操作不可恢复。')) return;
  const saves = loadSaves();
  saveUserSaves(saves.filter(s => s.id !== saveId));
  // 清理所有相关存储
  try {
    localStorage.removeItem('xixi_template_' + saveId);
    localStorage.removeItem(getSaveKey(saveId));
    localStorage.removeItem('xixi_achievements_' + saveId);
    localStorage.removeItem('xixi_theme_' + saveId);
  } catch(e) {}
  renderMySavesPanel();
}

async function continueGame(saveId) {
  const ov = document.querySelector('#save-selector-overlay');
  if (ov) ov.classList.remove('active');

  // 加载模板
  let template;
  if (saveId === 'surongrong') {
    template = await loadTemplate('surongrong');
  } else {
    const saves = loadSaves();
    const save = saves.find(s => s.id === saveId);
    template = save?.template || null;
  }
  if (!template) { console.error('Template not found'); return; }

  // 恢复存档数据
  const saveData = loadGameState(saveId);
  if (!saveData) { selectSave(saveId); return; } // 没有存档，开新游戏

  gameState.activeTemplate = template;
  gameState.activeSaveId = saveId;
  localStorage.setItem('xixi_last_save_id', saveId);
  gameState.fullHistory = saveData.fullHistory || [];
  gameState.summary = saveData.summary || '';
  gameState.summarisedCount = saveData.summarisedCount || 0;
  gameState.currentOptions = saveData.currentOptions || [];
  gameState.gameStarted = true;
  gameState.isLoading = false;

  const savedTheme = saveData.theme || template.theme || "dark";
  localStorage.setItem("xixi_theme_" + saveId, savedTheme);
  applyTheme(savedTheme);
  console.log("continueGame: restored theme", savedTheme, "for save", saveId);
  refreshSystemPrompt();
  renderStatusContainers(template);
  localStorage.setItem('xixi_active_template_id', saveId);

  // 渲染最后一回合的AI响应
  const lastAiMsg = [...gameState.fullHistory].reverse().find(m => m.role === 'assistant');
  if (lastAiMsg) {
    const parsed = parseAIResponse(lastAiMsg.content, template);
    renderGameState(parsed, template);
  } else {
    // 没有AI消息，显示初始状态
    updateOptionButtons([]);
    updateAllDynamicFields({}, template);
  }
}

// ── 创建存档 ──
let generatedTemplate = null;

// 表单自动保存/恢复
const FORM_SAVE_KEY = 'xixi_create_save_form';

function saveFormData() {
  const data = {};
  ['new-save-name','new-save-world','new-save-protagonist','new-save-conflict','new-save-extra'].forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) data[id] = el.value;
  });
  data.styles = [...document.querySelectorAll('#style-chips .chip.selected')].map(c => c.dataset.style);
  localStorage.setItem(FORM_SAVE_KEY, JSON.stringify(data));
}

function restoreFormData() {
  try {
    return JSON.parse(localStorage.getItem(FORM_SAVE_KEY));
  } catch(e) { return null; }
}

function openCreateSave() {
  const ssOv = document.querySelector('#save-selector-overlay');
  if (ssOv) ssOv.classList.remove('active');
  const csOv = document.querySelector('#create-save-overlay');
  if (csOv) csOv.classList.add('active');

  // 恢复上次填写的内容
  const saved = restoreFormData();
  ['new-save-name','new-save-world','new-save-protagonist','new-save-conflict','new-save-extra'].forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) el.value = saved ? (saved[id] || '') : '';
  });
  document.querySelectorAll('#style-chips .chip').forEach(c => c.classList.remove('selected'));
  if (saved?.styles) {
    document.querySelectorAll('#style-chips .chip').forEach(c => {
      if (saved.styles.includes(c.dataset.style)) c.classList.add('selected');
    });
  }
  const preview = document.querySelector('#generated-preview');
  if (preview) preview.classList.add('hidden');
  const msgEl = document.querySelector('#create-save-msg');
  if (msgEl) msgEl.textContent = '';
  generatedTemplate = null;

  // 绑定自动保存（输入时）
  document.querySelectorAll('#create-save-overlay input, #create-save-overlay textarea').forEach(el => {
    el.addEventListener('input', saveFormData);
  });
  document.querySelectorAll('#style-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => setTimeout(saveFormData, 100));
  });
}

function closeCreateSave() {
  const csOv = document.querySelector('#create-save-overlay');
  if (csOv) csOv.classList.remove('active');
  showSaveSelector();
}

function qs(sel) { return document.querySelector(sel); }

async function generatePrompt() {
  const name = qs('#new-save-name')?.value?.trim() || '';
  const world = qs('#new-save-world')?.value?.trim() || '';
  const protagonist = qs('#new-save-protagonist')?.value?.trim() || '';
  const conflict = qs('#new-save-conflict')?.value?.trim() || '';
  const extra = qs('#new-save-extra')?.value?.trim() || '';
  const styles = [...document.querySelectorAll('#style-chips .chip.selected')].map(c => c.dataset.style);

  if (!name || !world || !protagonist) {
    const msgEl = qs('#create-save-msg'); if (msgEl) { msgEl.textContent = '⚠ 请填写存档名称、世界观背景和主角设定'; msgEl.style.color = 'var(--red)'; }
    return;
  }

  // 生成前自动保存表单
  saveFormData();

  const msgEl = qs('#create-save-msg'); if (msgEl) { msgEl.textContent = '⏳ AI 正在生成提示词，可能需要30-60秒...'; msgEl.style.color = 'var(--text-dim)'; }
  const btnEl = qs('#btn-generate-prompt'); if (btnEl) btnEl.disabled = true;

  // 重试最多2次
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1 && msgEl) { msgEl.textContent = '⏳ 第' + attempt + '次尝试生成...'; }
      const resp = await fetch('/api/generate-prompt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, world, protagonist, conflict, extra, styles, apiKey: localStorage.getItem('xixi_apikey') || '' }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || '生成失败');
      const data = await resp.json();
      generatedTemplate = data.template;

      const previewEl = qs('#generated-prompt-preview');
      if (previewEl) previewEl.value = data.template.promptBody || '';
      const previewBox = qs('#generated-preview');
      if (previewBox) previewBox.classList.remove('hidden');
      if (msgEl) { msgEl.textContent = '✅ 提示词生成完成！可预览后确认创建。'; msgEl.style.color = 'var(--green)'; }
      break; // 成功，退出重试
    } catch (err) {
      if (attempt === 2) {
        if (msgEl) { msgEl.textContent = '❌ 生成失败（已重试）: ' + err.message; msgEl.style.color = 'var(--red)'; }
      }
    }
  }
  const btnEl2 = qs('#btn-generate-prompt'); if (btnEl2) btnEl2.disabled = false;
}

async function confirmCreateSave() {
  if (!generatedTemplate) {
    const msgEl = qs('#create-save-msg'); if (msgEl) { msgEl.textContent = '⚠ 请先生成提示词'; msgEl.style.color = 'var(--red)'; }
    return;
  }
  const saves = loadSaves();
  const newId = 'custom_' + Date.now();
  saves.push({
    id: newId,
    name: generatedTemplate.name || (qs('#new-save-name')?.value?.trim() || ''),
    desc: generatedTemplate.description || (qs('#new-save-world')?.value?.trim()?.substring(0, 80) || ''),
    icon: '🎮', type: 'custom', template: generatedTemplate,
    worldSetting: qs('#new-save-world')?.value?.trim() || generatedTemplate.worldSetting || '',
    protagonist: qs('#new-save-protagonist')?.value?.trim() || generatedTemplate.protagonist || '',
    conflict: qs('#new-save-conflict')?.value?.trim() || generatedTemplate.conflict || '',
    styles: generatedTemplate.styles || [],
  });
  saveUserSaves(saves);

  try { await fetch('/api/templates/' + newId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: generatedTemplate }) }); } catch (e) {}

  const csOv = document.querySelector('#create-save-overlay');
  if (csOv) csOv.classList.remove('active');
  selectSave(newId);
}

// ── 酒馆分享 ──
let isTavernAdmin = false;

function adminLogin() {
  const pwd = prompt('请输入管理员密码：');
  if (pwd === 'admin123') {
    isTavernAdmin = true;
    const status = document.querySelector('#admin-status');
    if (status) { status.textContent = '✅ 管理员'; status.style.color = 'var(--green)'; }
    renderTavernPanel();
  } else if (pwd !== null) {
    alert('密码错误');
  }
}

function adminLogout() {
  isTavernAdmin = false;
  const status = document.querySelector('#admin-status');
  if (status) { status.textContent = ''; }
  renderTavernPanel();
}

async function deleteFromTavern(sharedId) {
  if (!confirm('确定要从酒馆中删除这个分享吗？')) return;
  try {
    const resp = await fetch(`/api/shared/${sharedId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error('删除失败');
    renderTavernPanel();
  } catch (err) {
    alert('❌ 删除失败: ' + err.message);
  }
}

async function uploadToTavern(saveId) {
  const saves = loadSaves();
  const save = saves.find(s => s.id === saveId);
  if (!save || !save.template) {
    alert('存档数据不完整，无法上传');
    return;
  }
  if (!confirm(`确定要将「${save.name}」分享到酒馆吗？\n\n分享后其他玩家可以下载你的故事设定。`)) return;

  try {
    const resp = await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: save.template }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || '上传失败');
    }
    alert(`✅ 「${save.name}」已成功分享到酒馆！`);
  } catch (err) {
    alert('❌ 上传失败: ' + err.message);
  }
}

async function loadTavernList() {
  try {
    const resp = await fetch('/api/shared');
    const data = await resp.json();
    return data.shared || [];
  } catch (e) {
    console.error('加载酒馆失败:', e);
    return [];
  }
}

async function renderTavernPanel() {
  const grid = $('#tavern-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="tavern-loading">⏳ 正在加载酒馆...</div>';

  const shared = await loadTavernList();
  if (shared.length === 0) {
    grid.innerHTML = '<div class="tavern-empty">🍺 酒馆空空如也<br><span style="font-size:12px;color:var(--text-dim);">暂时没有人分享故事设定，来做第一个吧！</span></div>';
  } else {
    grid.innerHTML = shared.map(s => {
      const goalLine = s.conflict ? s.conflict.replace(/\n.*/s, '').substring(0, 40) : (s.description || '').substring(0, 40);
      const protagLine = s.protagonist ? s.protagonist.replace(/\n.*/s, '').substring(0, 30) : '';
      return `
      <div class="save-card" data-shared-id="${s.id}">
        <div class="save-card-header">
          <span class="save-card-icon">📖</span>
          <span class="save-card-name">${escapeHtml(s.name)}</span>
        </div>
        ${protagLine ? `<div class="save-card-protag">👤 ${escapeHtml(protagLine)}</div>` : ''}
        <div class="save-card-goal">🎯 ${escapeHtml(goalLine || '新的冒险即将展开')}</div>
        <div class="save-card-meta">
          <span class="tavern-card-uploaded">👤 ${escapeHtml(s.author || '未知')}</span>
          <span class="tavern-card-uploaded">🕐 ${s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString('zh-CN') : '未知'}</span>
          <span class="tavern-card-downloads">⬇ ${s.downloads || 0}</span>
        </div>
        <button class="btn btn-primary save-card-btn tavern-import-btn" data-shared-id="${s.id}">📥 导入并游玩</button>
        ${isTavernAdmin ? `<button class="save-card-delete tavern-del-btn" data-shared-id="${s.id}" style="position:absolute;top:6px;right:6px;">✕</button>` : ''}
      </div>
    `}).join('');

    grid.querySelectorAll('.tavern-import-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        importFromTavern(btn.dataset.sharedId);
      });
    });
    // 管理员删除按钮
    grid.querySelectorAll('.tavern-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFromTavern(btn.dataset.sharedId);
      });
    });
  }

  const infoEl = $('#tavern-info');
  if (infoEl) infoEl.textContent = `共 ${shared.length} 个分享`;
}

async function importFromTavern(sharedId) {
  try {
    const resp = await fetch(`/api/shared/${sharedId}`);
    const data = await resp.json();
    const template = data.template;

    if (!template) throw new Error('模板数据为空');

    const saves = loadSaves();
    const existing = saves.find(s => s.id === sharedId);
    if (existing) {
      if (!confirm(`本地已有存档「${template.name}」，是否覆盖？`)) return;
      saveUserSaves(saves.filter(s => s.id !== sharedId));
    }

    const updatedSaves = loadSaves();
    updatedSaves.push({
      id: sharedId,
      name: template.name || '导入存档',
      desc: template.description || '',
      icon: '📥',
      type: 'custom',
      template: template,
      worldSetting: template.worldSetting || '',
      protagonist: template.protagonist || '',
      conflict: template.conflict || '',
      styles: template.styles || [],
    });
    saveUserSaves(updatedSaves);

    alert(`✅ 已导入「${template.name}」！切换到"我的存档"即可开始游戏。`);

    // 刷新我的存档面板
    renderMySavesPanel();

  } catch (err) {
    alert('❌ 导入失败: ' + err.message);
  }
}

// ── AI 实时指令 ──
function getAiInstructions() {
  try {
    return JSON.parse(localStorage.getItem('xixi_ai_instructions') || '[]');
  } catch { return []; }
}

function saveAiInstructions(instructions) {
  localStorage.setItem('xixi_ai_instructions', JSON.stringify(instructions));
}

function sendAiInstruction() {
  const input = $('#ai-chat-input');
  const text = input.value.trim();
  if (!text) return;

  const instructions = getAiInstructions();
  instructions.push({ text, time: Date.now() });
  saveAiInstructions(instructions);
  renderAiChatMessages();
  input.value = '';
}

function clearAiInstructions() {
  saveAiInstructions([]);
  renderAiChatMessages();
}

function renderAiChatMessages() {
  const container = $('#ai-chat-messages');
  const instructions = getAiInstructions();
  if (instructions.length === 0) {
    container.innerHTML = '<div class="ai-chat-msg system-msg">AI：在此输入指令可实时调整故事方向、修正错误或修改规则。下回合生效。</div>';
  } else {
    container.innerHTML = instructions.map(i =>
      `<div class="ai-chat-msg user-msg">💬 ${escapeHtml(i.text)}</div>`
    ).join('');
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 工具函数 ──
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

// ── 序章弹窗（背景故事卡）──
function showPrologue(template) {
  const icon = $('#prologue-icon');
  const title = $('#prologue-title');
  const body = $('#prologue-body');

  // 提取背景信息（优先结构字段，回退到 description）
  const world = template.worldSetting || '';
  const protag = template.protagonist || '';
  const conflict = template.conflict || '';
  const styleList = template.styles || [];
  const desc = template.description || '';

  // 辅助：将多段落文本渲染为 HTML（\n\n→段落，\n→换行）
  function renderText(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    const paragraphs = escaped.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p =>
      `<p class="prologue-section-content">${p.replace(/\n/g, '<br>')}</p>`
    ).join('');
  }

  // 若没有任何结构化背景，直接用 description 做简化展示
  if (!world && !protag && !conflict) {
    body.innerHTML = `<p class="prologue-section-content">${escapeHtml(desc || '一段未知的冒险即将展开。')}</p>`;
  } else {
    let html = '';
    if (world) {
      html += `<div class="prologue-section-title">🌍 世界观</div>`;
      html += renderText(world);
    }
    if (protag) {
      html += `<div class="prologue-section-title">👤 主角设定</div>`;
      html += renderText(protag);
    }
    if (conflict) {
      html += `<div class="prologue-section-title">⚔ 核心冲突</div>`;
      html += renderText(conflict);
    }
    if (styleList.length > 0) {
      html += `<div class="prologue-styles-bar">`;
      html += styleList.map(s => `<span class="prologue-style-tag">${escapeHtml(s)}</span>`).join('');
      html += `</div>`;
    }
    body.innerHTML = html;
  }

  icon.textContent = '📖';
  title.textContent = template.name || '序章';

  // 显示弹窗
  const overlay = $('#prologue-overlay');
  if (overlay) overlay.classList.add('active');
}

function closePrologue() {
  const overlay = $('#prologue-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ── 启动 ──
function renderFieldEditor() {
  const tpl = getActiveTemplate();
  const sections = tpl.outputSections || {};
  const container = $('#field-editor-container');
  if (!container) return;

  let html = '';
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    html += `<div class="field-editor-group">
      <h4>${section.label || sectionKey}</h4>`;
    fields.forEach((f, idx) => {
      html += `<div class="field-editor-row" data-section="${sectionKey}" data-index="${idx}">
        <input class="field-id" value="${f.id}" placeholder="ID" title="字段ID（英文）">
        <input class="field-label" value="${f.label}" placeholder="标签" title="显示标签">
        <input class="field-icon" value="${f.icon || ''}" placeholder="图标" title="emoji图标">
        <input class="field-format" value="${f.formatHint || ''}" placeholder="格式提示" title="AI输出格式，如[状态]">
        <button class="btn-remove-field" data-section="${sectionKey}" data-index="${idx}">✕</button>
      </div>`;
    });
    html += '</div>';
  }
  container.innerHTML = html;

  // 绑定删除按钮
  container.querySelectorAll('.btn-remove-field').forEach(btn => {
    btn.addEventListener('click', () => {
      const sKey = btn.dataset.section;
      const idx = parseInt(btn.dataset.index);
      removeField(sKey, idx);
    });
  });
}

function removeField(sectionKey, index) {
  const tpl = getActiveTemplate();
  const fields = tpl.outputSections?.[sectionKey]?.fields;
  if (!fields || index >= fields.length) return;
  fields.splice(index, 1);
  renderFieldEditor();
}

function addField() {
  const tpl = getActiveTemplate();
  const sections = tpl.outputSections || {};
  // 默认添加到变量追踪
  const target = sections.variables || sections.statusTop || Object.values(sections)[0];
  if (!target || !target.fields) return;
  target.fields.push({
    id: 'newField' + Date.now(),
    label: '新字段',
    icon: '📌',
    formatHint: '[数值]',
    type: 'text',
  });
  renderFieldEditor();
}

function saveFields() {
  const container = $('#field-editor-container');
  if (!container) return;

  const tpl = getActiveTemplate();
  const rows = container.querySelectorAll('.field-editor-row');
  const newSections = {};

  rows.forEach(row => {
    const sKey = row.dataset.section;
    const inputs = row.querySelectorAll('input');
    const fieldData = {
      id: inputs[0].value.trim() || 'unnamed',
      label: inputs[1].value.trim() || '未命名',
      icon: inputs[2].value.trim() || '',
      formatHint: inputs[3].value.trim() || '[状态]',
      type: 'text',
    };
    if (!newSections[sKey]) newSections[sKey] = { label: sKey, display: 'inline', fields: [] };
    newSections[sKey].fields.push(fieldData);
  });

  // 保留原有的 label 和 display 属性
  for (const [sKey, section] of Object.entries(newSections)) {
    const orig = tpl.outputSections?.[sKey];
    if (orig) {
      section.label = orig.label;
      section.display = orig.display;
    }
  }

  tpl.outputSections = newSections;
  refreshSystemPrompt();
  renderStatusContainers(tpl);
  renderFieldEditor();

  // 保存到 localStorage
  localStorage.setItem('xixi_edited_template', JSON.stringify(tpl));

  const msgEl = $('#fields-msg');
  if (msgEl) {
    msgEl.textContent = '✅ 字段已保存！系统提示词已自动同步。';
    msgEl.style.color = 'var(--green)';
  }
}

// 在设置弹窗打开时渲染字段编辑器
const origOpenSettings = openSettings;
openSettings = async function() {
  await origOpenSettings();
  // 加载编辑过的模板
  const savedTpl = localStorage.getItem('xixi_edited_template');
  if (savedTpl) {
    try {
      gameState.activeTemplate = JSON.parse(savedTpl);
      refreshSystemPrompt();
      renderStatusContainers(gameState.activeTemplate);
    } catch (e) {}
  }
  renderFieldEditor();
  initThemeSelector();
  renderImageManager();
};

// ── 主题管理 ──
function initThemeSelector() {
  const sel = $('#theme-selector');
  if (!sel) return;
  const tpl = getActiveTemplate();
  const saveId = gameState.activeSaveId || 'default';
  sel.value = localStorage.getItem('xixi_theme_' + saveId) || tpl.theme || 'dark';
  $('#btn-apply-theme').addEventListener('click', () => {
    const theme = sel.value;
    // 按存档隔离存储主题
    const saveId = gameState.activeSaveId || 'default';
    localStorage.setItem("xixi_theme_" + saveId, theme);
    applyTheme(theme);
    if (gameState.gameStarted) saveGameState(); // 立即持久化到存档
    console.log("Settings: saved theme", theme, "for save", saveId);
    if (gameState.activeTemplate) gameState.activeTemplate.theme = theme;
    const msgEl = document.querySelector('#fields-msg') || document.querySelector('#settings-msg');
    if (msgEl) { msgEl.textContent = '✅ 主题已应用（仅当前存档）：' + theme; msgEl.style.color = 'var(--green)'; }
  });
}

// ── 图片管理 ──
function renderImageManager() {
  const container = $('#image-manager');
  if (!container) return;
  const tpl = getActiveTemplate();
  const images = tpl.sceneImages || {};
  const defaultImg = tpl.defaultSceneImage || '日常.png';
  const sceneTypes = tpl.sceneTypes || Object.keys(images);
  const customImages = JSON.parse(localStorage.getItem('xixi_custom_images') || '{}');

  container.innerHTML = sceneTypes.map(type => {
    const currentSrc = customImages[type] || images[type] || defaultImg;
    const isCustom = !!customImages[type];
    return `<div class="image-mgr-row">
      <span class="image-mgr-label">${type}</span>
      <img class="image-mgr-thumb" src="${currentSrc}" alt="${type}" onerror="this.style.opacity='0.3'">
      <span class="image-mgr-filename">${isCustom ? '📁 自定义' : currentSrc}</span>
      <button class="btn btn-small btn-replace-img" data-scene="${type}">📂 替换</button>
      ${isCustom ? `<button class="btn btn-ghost btn-tiny btn-reset-img" data-scene="${type}">↺ 恢复</button>` : ''}
    </div>`;
  }).join('');

  container.querySelectorAll('.btn-replace-img').forEach(btn => {
    btn.addEventListener('click', () => {
      const sceneType = btn.dataset.scene;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const imgs = JSON.parse(localStorage.getItem('xixi_custom_images') || '{}');
          imgs[sceneType] = reader.result;
          localStorage.setItem('xixi_custom_images', JSON.stringify(imgs));
          if (parsedLastSceneType === sceneType || !parsedLastSceneType) {
            const img = $('#character-image');
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
      const imgs = JSON.parse(localStorage.getItem('xixi_custom_images') || '{}');
      delete imgs[btn.dataset.scene];
      localStorage.setItem('xixi_custom_images', JSON.stringify(imgs));
      renderImageManager();
    });
  });
}

let parsedLastSceneType = '';
const origSwitchSceneImage = switchSceneImage;
switchSceneImage = function(sceneType, template) {
  parsedLastSceneType = sceneType;
  const customImages = JSON.parse(localStorage.getItem('xixi_custom_images') || '{}');
  if (customImages[sceneType]) {
    if (img.src === customImages[sceneType]) return;
    img.classList.add('img-fade-out');
    setTimeout(() => {
      img.src = customImages[sceneType];
      img.classList.remove('img-fade-out');
      img.classList.add('img-fade-in');
      setTimeout(() => img.classList.remove('img-fade-in'), 500);
    }, 200);
    if (sceneType) dom.imageCaption.textContent = `[${sceneType}] 📁`;
    return;
  }
  origSwitchSceneImage(sceneType, template);
};

// ── 全局错误捕获 ──
window.addEventListener('error', (e) => {
  console.error('🔴 GLOBAL ERROR:', e.message, 'at', e.filename, 'line', e.lineno);
  const errBox = document.querySelector('#error-box');
  if (errBox) { errBox.classList.remove('hidden'); const msgEl = document.querySelector('#error-message'); if (msgEl) msgEl.textContent = '内部错误: ' + e.message; }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('🔴 UNHANDLED REJECTION:', e.reason?.message || e.reason);
});

// ── 启动 ──
init();
console.log('🎮 模板驱动互动叙事游戏前端已就绪');
console.log('   点击"开始游戏"按钮开始');
