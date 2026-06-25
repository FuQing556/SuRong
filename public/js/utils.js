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

// ── 从 outputSections 生成系统提示词格式段 ──
function generateOutputFormat(sections, sceneTypes) {
  if (!sections || Object.keys(sections).length === 0) return '';
  const lines = [];
  lines.push('【强制输出格式】');
  lines.push('你每次回复，必须严格使用以下模板，不得添加、不得遗漏、不得发挥：');
  const sceneTypeList = (sceneTypes || []).join('、');
  lines.push('[场景类型：' + sceneTypeList + ' — 只能从以上' + (sceneTypes?.length || 0) + '个类型中选择] [事件大小：大/小]');
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
  lines.push('【铁律】你必须在每次回复的末尾完整输出以上所有状态字段，不得省略任何一行。即使数值无变化也必须照常输出。');
  lines.push('注意：第一回合没有"上回合"，写"上回合：游戏开始。"即可。后续每回合必须在"上回合"中结算玩家上一轮的选择后果。');
  return lines.join('\n');
}

// ── 构建完整系统提示词 ──
function buildSystemPrompt(template) {
  if (!template) return gameState.originalPrompt || '';
  const format = generateOutputFormat(template.outputSections, template.sceneTypes);
  const body = template.promptBody || '';
  return format + '\n' + body + '\n\n════════════════════════\n【最终提醒·优先级最高】\n你必须在本次回复的末尾，原样输出以上所有状态字段及其当前数值。\n格式：字段名：值 | 字段名：值\n每个字段都必须有具体数值或状态文本，不得写"[状态]""[数值]"等占位符，不得省略任何一行。\n这是你最重要的职责，比剧情描写更优先。\n════════════════════════';
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
