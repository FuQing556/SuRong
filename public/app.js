/* ═══════════════════════════════════════════
   互动叙事 · 苏蓉蓉 — 前端逻辑
   ═══════════════════════════════════════════ */

// ── DOM 引用 ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // 弹窗
  warningOverlay: $('#warning-overlay'),
  prologueOverlay: $('#prologue-overlay'),
  settingsOverlay: $('#settings-overlay'),
  promptEditor: $('#prompt-editor'),
  promptLength: $('#prompt-length'),
  settingsMsg: $('#settings-msg'),
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
  // 状态
  statusSoul: $('#status-soul'),
  statusAbnorm: $('#status-abnorm'),
  statusPressure: $('#status-pressure'),
  statusRound: $('#status-round'),
  statusMission: $('#status-mission'),
  statusTodo: $('#status-todo'),
  // 变量追踪
  varMeng: $('#var-meng'),
  varXiao: $('#var-xiao'),
  varExpose: $('#var-expose'),
  varLeverage: $('#var-leverage'),
  varIntel: $('#var-intel'),
  varEvents: $('#var-events'),
};

// ── 成就定义 ──
const ACHIEVEMENTS = {
  '坚韧不拔': { icon: '💪', desc: '压力值曾达到90+但未崩溃' },
  '情报女王': { icon: '👁️', desc: '情报进展≥5' },
  '梦红尘的藏品': { icon: '💎', desc: '梦红尘好感≥70' },
  '笑红尘的认可': { icon: '⚔️', desc: '笑红尘态度≥50' },
  '行走的悬崖': { icon: '🪢', desc: '暴露风险≥80但未被揭穿' },
  '反击者': { icon: '🗡️', desc: '成功设局反杀至少一次' },
  '幸存者': { icon: '🍀', desc: '轮次≥30且未触发任何结局' },
  '崩坏': { icon: '💔', desc: '触发任一结局' },
  '极限操作': { icon: '🎲', desc: '孤注一掷选项成功' },
  '情报商人': { icon: '💰', desc: '用情报碎片完成至少一次交易' },
};

// ── 成就管理 ──
function getUnlockedAchievements() {
  try {
    return JSON.parse(localStorage.getItem('xixi_achievements') || '{}');
  } catch { return {}; }
}

function saveAchievements(data) {
  localStorage.setItem('xixi_achievements', JSON.stringify(data));
}

function unlockAchievement(name) {
  const all = getUnlockedAchievements();
  if (all[name]) return false; // 已解锁
  all[name] = new Date().toISOString().slice(0, 10);
  saveAchievements(all);
  showAchievementToast(name);
  return true;
}

function showAchievementToast(name) {
  const ach = ACHIEVEMENTS[name];
  const toast = $('#achievement-toast');
  $('#ach-toast-text').textContent = `${ach?.icon || '🏆'} ${name}`;
  toast.classList.remove('hidden');
  // 重新触发动画
  toast.style.animation = 'none';
  toast.offsetHeight;
  toast.style.animation = 'achSlideIn .5s ease, achSlideOut .5s ease 3s forwards';
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

function checkAchievementsFromResponse(text) {
  // 解析 AI 输出中的成就解锁标记
  const matches = text.matchAll(/【[🏆🏅⭐🎖️]?\s*成就解锁[：:]\s*(.+?)】/g);
  for (const m of matches) {
    const name = m[1].trim();
    if (ACHIEVEMENTS[name]) {
      unlockAchievement(name);
    }
  }
  // 也检查变量追踪中的成就行
  const achLine = text.match(/成就[：:]\s*(.+)/);
  if (achLine) {
    const names = achLine[1].split(/[\/,，]/).map(s => s.trim()).filter(Boolean);
    for (const name of names) {
      if (name !== '无' && ACHIEVEMENTS[name]) {
        unlockAchievement(name);
      }
    }
  }
}

function renderAchievementsPanel() {
  const all = getUnlockedAchievements();
  const list = $('#achievements-list');
  const entries = Object.entries(ACHIEVEMENTS);
  list.innerHTML = entries.map(([name, ach]) => {
    const unlocked = all[name];
    return `
      <div class="ach-item${unlocked ? '' : ' locked'}">
        <span class="ach-icon">${unlocked ? ach.icon : '🔒'}</span>
        <span class="ach-name">${name} — ${ach.desc}</span>
        ${unlocked ? `<span class="ach-date">${unlocked}</span>` : ''}
      </div>`;
  }).join('');
}

// ── 游戏状态 ──
const KEEP_ROUNDS = 8;

let gameState = {
  fullHistory: [],      // 全部消息 [{role, content}]
  summary: '',          // 历史摘要
  summarisedCount: 0,   // 已摘要的消息数
  currentOptions: [],   // [{action, cost}]
  isLoading: false,
  gameStarted: false,
  originalPrompt: '',   // 原始提示词备份
  customPrompt: '',     // 用户自定义提示词（localStorage）
};

// ── 初始化 ──
async function init() {
  // 先绑定事件（确保按钮立即可点击，不等待网络请求）
  bindEvents();

  // 检查是否已经通过年龄验证
  if (localStorage.getItem('xixi_age_verified') === 'true') {
    dom.warningOverlay.classList.remove('active');
    dom.prologueOverlay.classList.add('active');
  }

  // 后台加载提示词（不阻塞 UI）
  try {
    const resp = await fetch('/api/prompt');
    const data = await resp.json();
    gameState.originalPrompt = data.prompt;
    const localPrompt = localStorage.getItem('xixi_custom_prompt');
    if (localPrompt && localPrompt.trim()) {
      gameState.customPrompt = localPrompt;
      console.log('已加载本地自定义提示词');
    }
  } catch (e) {
    console.warn('无法加载提示词（不影响游戏功能）:', e);
  }
}

// ── 事件绑定 ──
function bindEvents() {
  // 18+ 警告 → 进入序章
  $('#btn-enter').addEventListener('click', () => {
    localStorage.setItem('xixi_age_verified', 'true');
    dom.warningOverlay.classList.remove('active');
    dom.prologueOverlay.classList.add('active');
  });
  $('#btn-leave').addEventListener('click', () => {
    window.close();
    // 如果无法关闭，跳转到空白页
    if (!window.closed) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#78788c;font-family:sans-serif;font-size:18px;">已退出</div>';
    }
  });

  // 设置
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-close-settings').addEventListener('click', closeSettings);
  $('#btn-save-prompt').addEventListener('click', savePrompt);
  $('#btn-reload-prompt').addEventListener('click', reloadPrompt);
  $('#btn-reset-prompt').addEventListener('click', resetPrompt);

  // 设置弹窗点击外部关闭
  dom.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === dom.settingsOverlay) closeSettings();
  });

  // 选项按钮
  dom.optionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (!isNaN(idx) && gameState.currentOptions[idx] && !gameState.isLoading) {
        handleChoice(idx + 1); // 选项编号 1-4
      }
    });
  });

  // 键盘快捷键 1-4
  document.addEventListener('keydown', (e) => {
    if (dom.settingsOverlay.classList.contains('active')) return;
    if (dom.warningOverlay.classList.contains('active')) return;
    if (gameState.isLoading) return;

    const key = parseInt(e.key);
    if (key >= 1 && key <= 4 && gameState.currentOptions[key - 1]) {
      e.preventDefault();
      handleChoice(key);
    }
  });

  // 重试按钮
  $('#btn-retry').addEventListener('click', () => retryLastRequest());

  // 序章 → 进入游戏
  $('#btn-prologue-start').addEventListener('click', () => {
    dom.prologueOverlay.classList.remove('active');
    startNewGame();
  });

  // 跳过序章
  $('#btn-prologue-skip').addEventListener('click', () => {
    dom.prologueOverlay.classList.remove('active');
    startNewGame();
  });

  // 成就面板
  $('#btn-achievements').addEventListener('click', () => {
    renderAchievementsPanel();
    $('#achievements-overlay').classList.add('active');
  });
  $('#btn-close-achievements').addEventListener('click', () => {
    $('#achievements-overlay').classList.remove('active');
  });
  $('#achievements-overlay').addEventListener('click', (e) => {
    if (e.target === $('#achievements-overlay')) {
      $('#achievements-overlay').classList.remove('active');
    }
  });

  // 序章点击外部不关闭（必须点按钮）
  dom.prologueOverlay.addEventListener('click', (e) => {
    // 不做任何事，必须点击按钮
  });

  // 开始游戏（初始按钮，用于新游戏后重新开始）
  $('#btn-start-game').addEventListener('click', () => {
    startNewGame();
  });

  // 新游戏
  $('#btn-new-game').addEventListener('click', startNewGame);

  // 变量追踪折叠
  const varsToggle = $('#vars-toggle');
  const varsGrid = $('#vars-grid');
  if (varsToggle && varsGrid) {
    varsToggle.addEventListener('click', () => {
      varsGrid.classList.toggle('collapsed');
      varsToggle.textContent = varsGrid.classList.contains('collapsed')
        ? '📊 变量追踪 ▶'
        : '📊 变量追踪 ▼';
    });
  }

  // 字数统计
  dom.promptEditor.addEventListener('input', () => {
    dom.promptLength.textContent = `字数: ${dom.promptEditor.value.length}`;
  });
}

// ── 开始新游戏 ──
async function startNewGame() {
  // 重置状态
  gameState.fullHistory = [];
  gameState.summary = '';
  gameState.summarisedCount = 0;
  gameState.currentOptions = [];
  gameState.gameStarted = false;
  gameState.isLoading = false;

  // 清空 UI，重建占位符
  dom.storyContent.innerHTML = `
    <div id="initial-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:20px;">
      <p class="placeholder-text">命运之轮重新转动...</p>
    </div>
  `;
  dom.initialPlaceholder = $('#initial-placeholder');
  dom.errorBox.classList.add('hidden');
  dom.settlementContent.textContent = '—';
  updateStatusDisplay({});
  updateVariablesDisplay({});
  updateOptionButtons([]);
  // 重置图片
  switchSceneImage('日常');

  // 开始
  await sendMessage('开始游戏');
}

// ── 发送消息 ──
async function sendMessage(userContent) {
  if (gameState.isLoading) return;

  gameState.isLoading = true;
  showLoading(true);
  dom.errorBox.classList.add('hidden');
  updateOptionButtons([]); // 禁用所有按钮

  try {
    // 添加到历史
    gameState.fullHistory.push({ role: 'user', content: userContent });

    // 检查是否需要更新摘要
    await maybeSummarize();

    // 准备请求
    const recentMessages = gameState.fullHistory.slice(-(KEEP_ROUNDS * 2));

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: recentMessages,
        summary: gameState.summary,
        customPrompt: gameState.customPrompt || undefined,
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(errData.error || `请求失败 (${resp.status})`);
    }

    const data = await resp.json();

    // 添加到历史
    gameState.fullHistory.push({ role: 'assistant', content: data.content });

    // 解析并渲染
    const parsed = parseAIResponse(data.content);
    renderGameState(parsed);

    // 检查成就解锁
    checkAchievementsFromResponse(data.content);

    gameState.gameStarted = true;

  } catch (err) {
    console.error('请求失败:', err);
    showError(err.message);
    // 从历史中移除失败的用户消息
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

// ── 重试 ──
async function retryLastRequest() {
  // 移除最后一条助手消息（如果有）
  if (gameState.fullHistory.length > 0 &&
      gameState.fullHistory[gameState.fullHistory.length - 1].role === 'assistant') {
    gameState.fullHistory.pop();
  }
  // 重新发送最后一条用户消息
  const lastUserMsg = [...gameState.fullHistory].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    // 移除它，因为 sendMessage 会重新添加
    const idx = gameState.fullHistory.lastIndexOf(lastUserMsg);
    if (idx >= 0) gameState.fullHistory.splice(idx, 1);
    await sendMessage(lastUserMsg.content);
  }
}

// ── 摘要管理 ──
async function maybeSummarize() {
  const totalMessages = gameState.fullHistory.length;
  const unsummarised = totalMessages - gameState.summarisedCount;

  // 当未摘要消息超过 KEEP_ROUNDS*2 + 4 条时触发摘要
  const TRIGGER = KEEP_ROUNDS * 2 + 4;
  if (unsummarised <= TRIGGER) return;

  // 需要摘要的消息：从 summarisedCount 到 totalMessages - KEEP_ROUNDS*2
  const keepStart = Math.max(0, totalMessages - KEEP_ROUNDS * 2);
  const toSummarise = gameState.fullHistory.slice(gameState.summarisedCount, keepStart);

  if (toSummarise.length < 4) return; // 太少不值得摘要

  try {
    const resp = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: toSummarise,
        previousSummary: gameState.summary,
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      gameState.summary = data.summary;
      gameState.summarisedCount = keepStart;
      console.log('摘要已更新:', data.summary);
    }
  } catch (err) {
    console.warn('摘要更新失败:', err);
    // 不阻塞游戏，继续使用旧摘要
  }
}

// ── 解析 AI 响应 ──
function parseAIResponse(text) {
  const result = {
    sceneType: '',
    settlement: '',
    situation: '',
    options: [],
    status: {},
    variables: {},
    raw: text,
  };

  // 0. 提取场景类型
  const sceneMatch = text.match(/\[场景类型[：:]\s*(.+?)\]/);
  if (sceneMatch) {
    result.sceneType = sceneMatch[1].trim();
  }

  // 0.5 提取上回合结算（支持跨行）
  const settleMatch = text.match(/上回合[：:]\s*([\s\S]*?)(?=现状[：:])/);
  if (settleMatch) {
    result.settlement = settleMatch[1].trim();
    // 跳过"游戏开始"这种无意义结算
    if (result.settlement === '游戏开始。' || result.settlement === '游戏开始') {
      result.settlement = '';
    }
  }

  // 1. 提取现状
  const sitMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动[：:]|$)/);
  if (sitMatch) {
    result.situation = sitMatch[1].trim();
  } else {
    const looseMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动|请选择|\n\n|$)/);
    if (looseMatch) result.situation = looseMatch[1].trim();
    else result.situation = text.substring(0, Math.min(200, text.length));
  }

  // 2. 提取选项
  const optMatch = text.match(/可选行动[：:]\s*([\s\S]*?)(?=请选择你的行动|状态栏|$)/);
  if (optMatch) {
    const optText = optMatch[1].trim();
    const lines = optText.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const m = line.match(/^(.+?)\s*[—–\-]{1,2}\s*(.+)$/);
      if (m) {
        result.options.push({ action: m[1].trim(), cost: m[2].trim() });
      } else if (line.trim()) {
        result.options.push({ action: line.trim(), cost: '未知代价' });
      }
    }
  }

  // 3. 提取状态栏（在变量追踪之前）
  const statMatch = text.match(/状态栏\s*([\s\S]*?)(?=变量追踪|$)/);
  if (statMatch) {
    const statText = statMatch[1];
    result.status.soulPower = extractField(statText, '魂力残余');
    result.status.abnormality = extractField(statText, '异常状态');
    result.status.pressure = extractField(statText, '压力值');
    result.status.round = extractField(statText, '轮次');
    result.status.mission = extractField(statText, '当前潜伏任务');
    result.status.todo = extractField(statText, '待办事项');
  }

  // 4. 提取变量追踪
  const varMatch = text.match(/变量追踪\s*([\s\S]*)$/);
  if (varMatch) {
    const varText = varMatch[1];
    result.variables.meng = extractField(varText, '梦红尘好感');
    result.variables.xiao = extractField(varText, '笑红尘态度');
    result.variables.expose = extractField(varText, '暴露风险');
    result.variables.leverage = extractField(varText, '把柄积累');
    result.variables.intel = extractField(varText, '情报进展');
    result.variables.events = extractField(varText, '重大事件');
  }

  return result;
}

function extractField(text, fieldName) {
  const re = new RegExp(`${fieldName}[：:]\\s*(.+?)(?:\\n|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : '—';
}

// ── 场景类型 → 图片映射 ──
const SCENE_IMAGES = {
  '对峙': '对峙.png',
  '调查': '调查.png',
  '潜伏': '潜伏.png',
  '社交': '社交.png',
  '突发事件': '日常.png',
  '战斗': '战斗.png',
  '研究': '研究.png',
  '交易': '交易.png',
  '日常': '日常.png',
  '崩溃': '崩溃.png',
};

function switchSceneImage(sceneType) {
  const filename = SCENE_IMAGES[sceneType] || '日常.png';
  if (dom.characterImage.src.endsWith(filename)) return; // 无需切换
  dom.characterImage.classList.add('img-fade-out');
  setTimeout(() => {
    dom.characterImage.src = filename;
    dom.characterImage.classList.remove('img-fade-out');
    dom.characterImage.classList.add('img-fade-in');
    setTimeout(() => dom.characterImage.classList.remove('img-fade-in'), 500);
  }, 200);
  // 更新图片说明
  if (sceneType) {
    dom.imageCaption.textContent = `苏蓉蓉 · 圣光铃兰 [${sceneType}]`;
  }
}

// ── 渲染游戏状态 ──
function renderGameState(parsed) {
  // 隐藏初始占位符（如果还存在）
  const placeholder = document.getElementById('initial-placeholder');
  if (placeholder) {
    placeholder.style.display = 'none';
  }

  // 切换场景图片
  if (parsed.sceneType) {
    switchSceneImage(parsed.sceneType);
  }

  // 渲染上回合结算
  if (parsed.settlement) {
    dom.settlementContent.textContent = parsed.settlement;
    dom.settlementBox.style.display = '';
  } else if (!parsed.settlement && !parsed.situation) {
    // 初始状态，隐藏结算框
    dom.settlementBox.style.display = 'none';
  }

  // 渲染现状
  if (parsed.situation) {
    dom.storyContent.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = parsed.situation;
    p.classList.add('story-fade-in');
    dom.storyContent.appendChild(p);
    $('#story-box').scrollTop = 0;
  }

  // 渲染选项
  updateOptionButtons(parsed.options);
  gameState.currentOptions = parsed.options;

  // 渲染状态栏
  updateStatusDisplay(parsed.status);
  updateVariablesDisplay(parsed.variables);

  // 兜底：解析失败时显示原始文本
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
      if (i >= (options.length || 0)) {
        btn.style.display = options.length === 0 ? '' : 'none';
      }
    }
  });

  // 如果没有选项，显示所有按钮为禁用状态
  if (options.length === 0) {
    dom.optionBtns.forEach(btn => {
      btn.querySelector('.option-action').textContent = '等待中...';
      btn.querySelector('.option-cost').textContent = '';
      btn.disabled = true;
      btn.style.display = '';
    });
  }
}

// ── 更新状态栏 ──
function updateStatusDisplay(status) {
  dom.statusSoul.textContent = status.soulPower || '—';
  dom.statusAbnorm.textContent = status.abnormality || '—';
  dom.statusMission.textContent = status.mission || '—';
  dom.statusTodo.textContent = status.todo || '—';

  // 压力值（带颜色）
  const pressureStr = status.pressure || '—';
  dom.statusPressure.textContent = pressureStr;
  dom.statusPressure.className = 'status-value';
  const pressureNum = parseInt(pressureStr);
  if (!isNaN(pressureNum)) {
    if (pressureNum >= 70) dom.statusPressure.classList.add('pressure-danger');
    else if (pressureNum >= 40) dom.statusPressure.classList.add('pressure-warn');
    else dom.statusPressure.classList.add('pressure-safe');
  }

  // 轮次
  dom.statusRound.textContent = status.round || '—';
}

// ── 更新变量追踪 ──
function updateVariablesDisplay(variables) {
  dom.varMeng.textContent = variables.meng || '—';
  dom.varXiao.textContent = variables.xiao || '—';
  dom.varExpose.textContent = variables.expose || '—';
  dom.varLeverage.textContent = variables.leverage || '—';
  dom.varIntel.textContent = variables.intel || '—';
  dom.varEvents.textContent = variables.events || '—';

  // 暴露风险高亮
  const exposeStr = variables.expose || '';
  const exposeNum = parseInt(exposeStr);
  dom.varExpose.className = 'status-value';
  if (!isNaN(exposeNum) && exposeNum >= 70) {
    dom.varExpose.classList.add('pressure-danger');
  } else if (!isNaN(exposeNum) && exposeNum >= 40) {
    dom.varExpose.classList.add('pressure-warn');
  }
}

// ── 加载状态 ──
function showLoading(show) {
  if (show) {
    dom.loadingIndicator.classList.remove('hidden');
  } else {
    dom.loadingIndicator.classList.add('hidden');
  }
}

// ── 错误处理 ──
function showError(msg) {
  dom.errorBox.classList.remove('hidden');
  dom.errorMsg.textContent = msg;

  // 恢复选项（如果之前有的话）
  if (gameState.currentOptions.length > 0) {
    updateOptionButtons(gameState.currentOptions);
  }
}

// ── 设置弹窗 ──
async function openSettings() {
  dom.settingsMsg.textContent = '';
  // 优先显示本地自定义提示词，否则加载默认
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
      dom.settingsMsg.textContent = '⚠ 加载失败';
      dom.settingsMsg.style.color = 'var(--red)';
    }
  }
  dom.settingsOverlay.classList.add('active');
}

function closeSettings() {
  dom.settingsOverlay.classList.remove('active');
}

async function savePrompt() {
  const prompt = dom.promptEditor.value;
  if (prompt.trim().length < 100) {
    dom.settingsMsg.textContent = '⚠ 提示词太短，至少需要100字';
    dom.settingsMsg.style.color = 'var(--red)';
    return;
  }

  // 保存到 localStorage
  localStorage.setItem('xixi_custom_prompt', prompt);
  gameState.customPrompt = prompt;

  // 同时尝试保存到服务器（本地运行时生效，Vercel 上无害）
  dom.settingsMsg.textContent = '⏳ 保存中...';
  dom.settingsMsg.style.color = 'var(--text-dim)';
  try {
    await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
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

  // 清除本地自定义提示词
  localStorage.removeItem('xixi_custom_prompt');
  gameState.customPrompt = '';
  dom.settingsMsg.textContent = '✅ 已恢复默认提示词';
  dom.settingsMsg.style.color = 'var(--green)';
}

// ── 启动 ──
init();
console.log('🎮 互动叙事游戏前端已就绪');
console.log('   点击"开始游戏"按钮开始');
console.log('   或直接发送第一条消息');
console.log('   快捷键: 数字键 1-4 选择选项');
