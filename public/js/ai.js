/* ═══════════════════════════════════════════
   ai.js — AI 实时指令系统
   依赖：state.js, utils.js
   ═══════════════════════════════════════════ */

// ── 指令存储 ──
function getAiInstructions() {
  try {
    var val = JSON.parse(localStorage.getItem(LS_KEYS.aiInstructions) || '[]');
    return Array.isArray(val) ? val : [];
  } catch { return []; }
}

function saveAiInstructions(instructions) {
  localStorage.setItem(LS_KEYS.aiInstructions, JSON.stringify(instructions));
}

// ── 发送指令 ──
function sendAiInstruction() {
  const input = $('#ai-chat-input');
  if (!input) return;
  const text = input.value.trim().substring(0, 500);  // 限制 500 字符
  if (!text) return;

  const instructions = getAiInstructions();
  // 去重：同文本不重复添加
  if (!instructions.some(function(i) { return i.text === text; })) {
    instructions.push({ text: text, time: Date.now() });
  }
  saveAiInstructions(instructions);
  renderAiChatMessages();
  input.value = '';
}

// ── 清除指令 ──
function clearAiInstructions() {
  saveAiInstructions([]);
  renderAiChatMessages();
}

// ── 渲染指令消息 ──
function renderAiChatMessages() {
  const container = $('#ai-chat-messages');
  if (!container) return;
  const instructions = getAiInstructions();
  if (instructions.length === 0) {
    container.innerHTML = '<div class="ai-chat-msg system-msg">AI：在此输入指令可实时调整故事方向、修正错误或修改规则。下回合生效。</div>';
  } else {
    container.innerHTML = instructions.map(i =>
      '<div class="ai-chat-msg user-msg">💬 ' + escapeHtml(i.text) + '</div>'
    ).join('');
    container.scrollTop = container.scrollHeight;
  }
}

console.log('📦 ai.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('ai');
