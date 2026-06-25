/* ═══════════════════════════════════════════
   ai.js — AI 实时指令系统
   依赖：state.js, utils.js
   ═══════════════════════════════════════════ */

// ── 指令存储 ──
function getAiInstructions() {
  try {
    return JSON.parse(localStorage.getItem('xixi_ai_instructions') || '[]');
  } catch { return []; }
}

function saveAiInstructions(instructions) {
  localStorage.setItem('xixi_ai_instructions', JSON.stringify(instructions));
}

// ── 发送指令 ──
function sendAiInstruction() {
  const input = $('#ai-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const instructions = getAiInstructions();
  instructions.push({ text, time: Date.now() });
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
