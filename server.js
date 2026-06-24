const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── 中间件 ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/themes', express.static(path.join(__dirname, 'themes')));

// ── 提示词管理 ──
const PROMPT_PATH = path.join(__dirname, 'prompt.txt');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

function loadPrompt() {
  try {
    const p = fs.readFileSync(PROMPT_PATH, 'utf-8');
    if (!p.trim()) throw new Error('prompt.txt is empty');
    return p;
  } catch (err) {
    console.error('加载提示词失败:', err.message);
    return null;
  }
}

function savePrompt(text) {
  fs.writeFileSync(PROMPT_PATH, text, 'utf-8');
}

let gamePrompt = loadPrompt();
console.log(gamePrompt ? `提示词已加载 (${gamePrompt.length} 字符)` : '⚠ 提示词加载失败！');

// ── 模板系统 ──
let templateCache = null;

function loadTemplates() {
  const templates = [];
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) return templates;
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
        const t = JSON.parse(raw);
        // 返回摘要（不含完整 promptBody）
        templates.push({
          id: t.id,
          name: t.name,
          description: t.description || '',
          theme: t.theme || 'dark',
          author: t.author || '',
          version: t.version || '1.0.0',
          sceneTypes: t.sceneTypes || [],
          hasFields: !!(t.outputSections),
        });
      } catch (e) { console.error(`模板 ${file} 解析失败:`, e.message); }
    }
  } catch (e) { console.error('加载模板目录失败:', e.message); }
  return templates;
}

function loadTemplate(id) {
  // 优先从缓存
  if (templateCache && templateCache.id === id) return templateCache;

  const filePath = path.join(TEMPLATES_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    templateCache = JSON.parse(raw);
    return templateCache;
  } catch (e) { return null; }
}

// ── 从 outputSections 生成 AI 输出格式模板 ──
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
  lines.push('注意：第一回合没有"上回合"，写"上回合：游戏开始。"即可。后续每回合必须在"上回合"中结算玩家上一轮的选择后果。');
  return lines.join('\n');
}

// ── 构建完整系统提示词 ──
function buildSystemPrompt(template) {
  if (!template) return gamePrompt || '';

  const format = generateOutputFormat(template.outputSections);
  const body = template.promptBody || '';
  return format + '\n' + body;
}

// ── API: 获取提示词 ──
app.get('/api/prompt', (_req, res) => {
  res.json({ prompt: gamePrompt || '' });
});

// ── API: 更新提示词 ──
app.post('/api/prompt', (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 100) {
    return res.status(400).json({ error: '提示词太短或无效' });
  }
  try {
    savePrompt(prompt);
    gamePrompt = prompt;
    res.json({ success: true, length: prompt.length });
  } catch (err) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// ── API: 模板列表 ──
app.get('/api/templates', (_req, res) => {
  res.json({ templates: loadTemplates() });
});

// ── API: 获取单个模板 ──
app.get('/api/templates/:id', (req, res) => {
  const template = loadTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: '模板未找到' });
  res.json({ template });
});

// ── API: 保存模板（写入 templates/ 目录，本地开发用）──
app.post('/api/templates/:id', (req, res) => {
  const { template } = req.body;
  if (!template || !template.id) {
    return res.status(400).json({ error: '无效的模板数据' });
  }
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    const filePath = path.join(TEMPLATES_DIR, `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
    templateCache = template;
    res.json({ success: true, id: template.id });
  } catch (err) {
    res.status(500).json({ error: '保存模板失败: ' + err.message });
  }
});

// ── 调用 DeepSeek API ──
async function callDeepSeek(messages, temperature = 0.8, maxTokens = 1024) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('未配置 DEEPSEEK_API_KEY，请在 .env 文件中设置');
  }

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DeepSeek API 错误 (${resp.status}): ${errText}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── API: 游戏对话 ──
app.post('/api/chat', async (req, res) => {
  const { messages, summary, template, systemPrompt } = req.body;

  // 构建消息数组
  let fullMessages;

  if (systemPrompt && systemPrompt.trim().length >= 100) {
    // 前端传了完整系统提示词
    fullMessages = [{ role: 'system', content: systemPrompt }];
  } else if (messages && Array.isArray(messages) && messages.length > 0 && messages[0].role === 'system') {
    // 前端已构建好完整消息数组（含多条system消息），直接使用
    fullMessages = [...messages];
  } else {
    // 传统模式：构建系统提示词
    let activeSystemPrompt;
    if (template && template.outputSections) {
      activeSystemPrompt = buildSystemPrompt(template);
    } else if (template && template.id) {
      const loaded = loadTemplate(template.id);
      activeSystemPrompt = loaded ? buildSystemPrompt(loaded) : gamePrompt;
    } else {
      activeSystemPrompt = gamePrompt;
    }
    if (!activeSystemPrompt) {
      return res.status(500).json({ error: '游戏提示词未加载' });
    }
    fullMessages = [{ role: 'system', content: activeSystemPrompt }];
    // 插入历史摘要
    if (summary && summary.trim()) {
      fullMessages.push({
        role: 'system',
        content: `【历史摘要】${summary}`,
      });
    }
    // 插入最近对话
    if (messages && Array.isArray(messages)) {
      fullMessages.push(...messages);
    }
  }

  try {
    const content = await callDeepSeek(fullMessages);
    res.json({ content });
  } catch (err) {
    console.error('对话请求失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: 生成输出格式预览 ──
app.post('/api/preview-format', (req, res) => {
  const { outputSections } = req.body;
  if (!outputSections) return res.status(400).json({ error: '缺少 outputSections' });
  const format = generateOutputFormat(outputSections);
  res.json({ format });
});

// ── API: AI 生成提示词 ──
app.post('/api/generate-prompt', async (req, res) => {
  const { name, world, protagonist, conflict, extra, styles } = req.body;
  if (!name || !world || !protagonist) {
    return res.status(400).json({ error: '缺少必要字段：name, world, protagonist' });
  }

  const styleText = (styles && styles.length > 0) ? styles.join('、') : '综合平衡';
  const metaPrompt = `根据以下设定生成一个互动叙事游戏的系统提示词。严格输出JSON，不要输出任何其他文字。

【设定】
名称：${name}
世界观：${world}
主角：${protagonist}
冲突：${conflict || '自由发挥'}
风格：${styleText}
额外要求：${extra || '无'}

【生成内容】
1. outputSections — 状态栏字段定义。包含statusTop(5-6字段)、taskLine(含round字段)、resources(3-4字段)、variables(4-5字段)。每个字段格式：{"id":"英文","label":"中文","icon":"emoji","formatHint":"[状态]","type":"text"}
2. promptBody — 核心提示词正文(3000-6000字)，用【】标记章节：【你的身份】【主角设定】【世界观】【结局系统】【核心驱动】【叙事铁律】【场景切换机制】【选项设计】【资源管理】【开局系统】
3. achievements — 6-8个成就：{"成就名":{"icon":"emoji","desc":"说明"}}
4. sceneTypes — 5-7个中文场景类型
5. description — 20字简介

【输出格式】只输出一行JSON：
{"name":"${name}","description":"简介","outputSections":{...},"promptBody":"正文(双引号改单引号)","achievements":{...},"sceneTypes":[...],"sceneImages":{...},"theme":"dark"}`;

  try {
    const content = await callDeepSeek([
      { role: 'system', content: '你是游戏设计AI。只输出一行完整JSON，不要markdown代码块，不要解释。' },
      { role: 'user', content: metaPrompt },
    ], 0.7, 4096);

    // 提取JSON
    let jsonStr = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    else {
      const braceStart = content.indexOf('{');
      const braceEnd = content.lastIndexOf('}');
      if (braceStart >= 0 && braceEnd > braceStart) jsonStr = content.substring(braceStart, braceEnd + 1);
    }
    jsonStr = jsonStr.replace(/“|”/g, '"').replace(/‘|’/g, "'");

    const template = JSON.parse(jsonStr);
    template.id = 'custom_' + Date.now();
    template.author = 'AI生成';
    template.version = '1.0.0';
    template.defaultSceneImage = '日常.png';
    template.openingMessages = ['开始游戏。'];
    // 强制所有场景图片为日常.png（用户可在设置里替换）
    template.sceneImages = {};
    if (template.sceneTypes) template.sceneTypes.forEach(t => { template.sceneImages[t] = '日常.png'; });
    template.sceneImages['日常'] = '日常.png';

    res.json({ template });
  } catch (err) {
    console.error('生成提示词失败:', err.message);
    res.status(500).json({ error: 'AI生成失败: ' + err.message });
  }
});

// ── API: 对话摘要 ──
app.post('/api/summarize', async (req, res) => {
  const { messages, previousSummary } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '没有需要摘要的消息' });
  }

  const prevContext = previousSummary
    ? `之前的摘要：${previousSummary}\n\n以下是新的对话片段，请将之前的摘要与新内容合并成一份完整摘要。`
    : '以下是互动叙事游戏的对话片段，请生成摘要。';

  const summaryMessages = [
    {
      role: 'system',
      content:
        '你是一个剧情摘要工具。用200字以内的中文总结以下互动叙事的关键事件。只写事实：主角经历了什么羞辱事件、做出了什么选择、状态栏有什么变化、潜伏任务有无进展、重要NPC的互动。不要写感受，不要评论。',
    },
    { role: 'user', content: `${prevContext}\n\n对话片段：\n${JSON.stringify(messages)}` },
  ];

  try {
    const summary = await callDeepSeek(summaryMessages, 0.3, 400);
    res.json({ summary });
  } catch (err) {
    console.error('摘要生成失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 启动（支持 Electron 嵌入）──
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    const templates = loadTemplates();
    console.log(`\n🎮 互动叙事游戏服务已启动`);
    console.log(`   地址: http://localhost:${PORT}`);
    console.log(`   提示词: ${gamePrompt ? '✅ 已加载 (' + gamePrompt.length + ' 字符)' : '❌ 未加载'}`);
    console.log(`   模板: ${templates.length} 个已加载`);
    console.log(`   API Key: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '⚠ 未配置 (需创建 .env 文件)'}\n`);
  });
}
