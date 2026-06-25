/* ═══════════════════════════════════════════
   utils.js — 工具函数 + 提示词构建 + 文本解析
   依赖：state.js
   ═══════════════════════════════════════════ */

// ── HTML转义 ──
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 字符串截断 ──
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

// ── 获取当前活动模板 ──
function getActiveTemplate() {
  return gameState.activeTemplate || FALLBACK_TEMPLATE;
}

// ── 从文本中提取字段值（全局匹配取最后一次出现）──
function extractField(text, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '[：:]\\s*([^|\\n]+?)(?:\\s*[|]|\\s*\\n|$)', 'g');
  let m, lastMatch = null;
  while ((m = re.exec(text)) !== null) lastMatch = m;
  return lastMatch ? lastMatch[1].trim() : '—';
}

// ── 从 outputSections 生成输出格式模板 ──
function generateOutputFormat(sections, sceneTypes) {
  if (!sections || Object.keys(sections).length === 0) return '';
  const lines = [];
  const sceneTypeList = (sceneTypes || []).join('、');
  lines.push('[场景类型：' + sceneTypeList + ' — 只选其一] [事件大小：大/小]');
  lines.push('上回合： [结算玩家选择的直接后果，1-2句，不写感受]');
  lines.push('现状： [全新场景，新时间新地点新事件，1-3句纯陈述]');
  lines.push('可选行动：');
  lines.push('1. [动作] — [代价] 【低/中/高/孤注】');
  lines.push('2. [动作] — [代价] 【低/中/高/孤注】');
  lines.push('3. [动作] — [代价] 【低/中/高/孤注】');
  lines.push('4. [动作] — [代价] 【低/中/高/孤注】');
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    if (fields.length === 0) continue;
    if (section.label) lines.push(section.label);
    lines.push(fields.map(f => `${f.label}：${f.formatHint || '[值]'}`).join(' | '));
  }
  return lines.join('\n');
}

// ── 构建完整系统提示词（格式 + 叙事指南 + 正文）──
function buildSystemPrompt(template) {
  if (!template) return gameState.originalPrompt || '';
  const format = generateOutputFormat(template.outputSections, template.sceneTypes);
  const body = template.promptBody || '';

  const narrativeGuide = `【叙事法则】
· 每个选项必须推动剧情——不能让玩家选择后原地踏步。至少3个选项带玩家离开当前场景。
· 代价必须真实：标注【资源不足】的选项被选后，现状中必须体现失败后果，不得让选项正常成功。
· 结算时如实更新所有字段数值。消耗扣减，获得增加。数值变化要合理——不要凭空增减。
· 选项之间要有路线分歧：提供至少2条不同的策略方向（如战斗vs谈判、信任vs怀疑、冒险vs保守）。
· 结局推送：当关键数值达到极端（≥90或≤10）或轮次≥15时，积极考虑触发结局。触发时输出【游戏结束·结局名】。`;

  const outputRule = `【回复格式】\n每次回复严格按以下顺序，末尾完整输出所有状态字段（数值无变化也照写，不得省略）。第一回合上回合写"游戏开始。"`;

  return outputRule + '\n\n' + format + '\n\n' + narrativeGuide + '\n\n' + body;
}

// ── 更新系统提示词（模板变化时调用）──
function refreshSystemPrompt() {
  const tpl = getActiveTemplate();
  gameState.activeSystemPrompt = buildSystemPrompt(tpl);
  if (gameState.activeSystemPrompt) {
    gameState.customPrompt = gameState.activeSystemPrompt;
  }
}

// ── 检测结局标记 ──
function detectEnding(text) {
  const em = text.match(/【游戏结束[：:·]\s*(.+?)】/);
  if (em) {
    gameState.achievementFlags.endingTriggered = true;
    gameState.achievementFlags.endingType = em[1].trim();
    return em[1].trim();
  }
  return null;
}

console.log('📦 utils.js 已加载');
