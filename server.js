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
          worldSetting: t.worldSetting || '',
          protagonist: t.protagonist || '',
          conflict: t.conflict || '',
          styles: t.styles || [],
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
  lines.push('【铁律1】你必须在每次回复的末尾完整输出以上所有状态/资源/变量字段，不得省略任何一行。即使数值无变化也必须照常输出。');
  lines.push('【铁律2】选项的代价和收益必须与资源字段联动——消耗资源要在状态中扣减，获得资源要在状态中增加。资源不足的选项必须标注【资源不足】。');
  lines.push('注意：第一回合没有"上回合"，写"上回合：游戏开始。"即可。后续每回合必须在"上回合"中结算玩家上一轮的选择后果。');
  return lines.join('\n');
}

// ── 构建完整系统提示词 ──
function buildSystemPrompt(template) {
  if (!template) return gamePrompt || '';

  const format = generateOutputFormat(template.outputSections);
  const body = template.promptBody || '';
  // 格式放最前，铁律放最后——AI读到最后的就是最重要的
  return format + '\n' + body + '\n\n════════════════════════\n【最终提醒·优先级最高】\n你必须在本次回复的末尾，原样输出以上所有状态字段及其当前数值。\n格式：字段名：值 | 字段名：值\n每个字段都必须有具体数值或状态文本，不得写"[状态]""[数值]"等占位符，不得省略任何一行。\n这是你最重要的职责，比剧情描写更优先。\n════════════════════════';
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
function getApiKey(reqBody) {
  // 优先用请求里的 key，没有就用环境变量
  const bodyKey = (reqBody && reqBody.apiKey) ? reqBody.apiKey.trim() : '';
  if (bodyKey && bodyKey.startsWith('sk-')) return bodyKey;
  return process.env.DEEPSEEK_API_KEY || '';
}

async function callDeepSeek(messages, apiKey, temperature = 0.8, maxTokens = 1024, jsonMode = false) {
  if (!apiKey) {
    throw new Error('未配置 DeepSeek API Key。请在设置页输入 Key，或在 .env / 环境变量中配置 DEEPSEEK_API_KEY');
  }

  const body = {
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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
    const apiKey = getApiKey(req.body);
    const content = await callDeepSeek(fullMessages, apiKey);
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
  const { name, world, protagonist, conflict, extra, styles, gameLength } = req.body;
  if (!name || !world || !protagonist) {
    return res.status(400).json({ error: '缺少必要字段：name, world, protagonist' });
  }

  const styleText = (styles && styles.length > 0) ? styles.join('、') : '综合平衡';
  const length = gameLength || 'medium';

  // 根据游戏长度生成不同的结局回合门槛
  const lengthGuide = {
    short:    { early:'3-5', mid:'6-10', late:'10-15', epic:'15+' },
    medium:   { early:'5-8', mid:'10-15', late:'15-25', epic:'25+' },
    long:     { early:'8-12', mid:'15-25', late:'25-40', epic:'40+' },
    immersive:{ early:'10-15', mid:'20-30', late:'35-50', epic:'50+' },
  }[length];

  const metaPrompt = `根据以下设定生成一个互动叙事游戏的系统提示词。严格输出JSON，不要输出任何其他文字。

【设定】
名称：${name}
世界观：${world}
主角：${protagonist}
冲突：${conflict || '自由发挥'}
风格：${styleText}
游戏长度：${length}（预期回合：早期${lengthGuide.early} | 中期${lengthGuide.mid} | 后期${lengthGuide.late} | 大后期${lengthGuide.epic}）

【生成内容】
1. outputSections — 状态栏/资源/变量字段定义。resources字段至少包含2个可消耗资源（金钱/能量/物品等），每个字段格式：{"id":"英文","label":"中文","icon":"emoji","formatHint":"[数值/状态]","type":"text"}
2. promptBody — 核心提示词正文(3000-6000字)，必须包含以下章节（用【】标记）：
   【你的身份】AI的行为准则
   【主角设定】外貌/能力/身世/处境
   【世界观】势力格局/当前局势
   【结局系统】★关键★ 必须设计四层结局，每层明确写出触发条件：
       早期结局(回合${lengthGuide.early})：低门槛达成即可触发，有代价、不完美。触发时AI输出【可结束】标记，但必须保留至少2个继续游戏的选项让玩家选择不结束。
       中期结局(回合${lengthGuide.mid})：标准胜利条件，主要结局。条件达成时AI主动推送结局选项。
       后期结局(回合${lengthGuide.late})：高门槛完美结局，需要额外条件（特殊道具/NPC关系/隐藏flag）。
       大后期结局(回合${lengthGuide.epic})：传奇结局，需要多条件同时满足。玩家已成为世界不可忽视的存在。
       ★铁律：任何结局触发时，AI绝不能替玩家结束。必须在选项中保留至少1个「继续走下去」的选项。★
   【核心驱动】故事的核心冲突和推动力
   【叙事铁律】写作规则
   【场景切换机制】每回合必须换场景
   【选项设计】每回合4选项，必须有代价
   【资源管理】★关键★ 列出可消耗资源及其获取/消耗方式。资源必须是选项代价的核心要素——大部分选项都应有资源代价或收益。资源不足时选项必须标注【资源不足】并触发负面后果。玩家需要管理资源来推进游戏。
   【开局系统】游戏开始时的初始场景
3. achievements — 6-8个成就，必须包含与资源管理相关的成就
4. sceneTypes — 5-7个中文场景类型
5. description — 20字简介
6. worldSetting — 世界观详细介绍（200-400字，3-4段\\n\\n分隔）
7. protagonist — 主角详细介绍（200-400字，3-4段\\n\\n分隔）
8. conflict — 核心冲突介绍（200-400字，多段\\n\\n分隔，必须列出四层结局的简述）

【输出格式】输出一个完整JSON对象，promptBody/worldSetting/protagonist/conflict中的换行用\\n，引号用\\"。不要markdown：
{"name":"${name}","description":"20字简介","outputSections":{...},"promptBody":"正文","achievements":{...},"sceneTypes":[...],"sceneImages":{...},"theme":"dark","styles":[...],"worldSetting":"世界观","protagonist":"主角","conflict":"冲突"}`;

    try {
      const apiKey = getApiKey(req.body);
      const content = await callDeepSeek([
        { role: 'system', content: '你是游戏设计AI，输出必须是合法JSON对象，不要任何额外文字。' },
        { role: 'user', content: metaPrompt },
      ], apiKey, 0.5, 8192, true); // jsonMode=true

      const template = JSON.parse(content);

      template.id = 'custom_' + Date.now();
      template.author = 'AI生成';
      template.version = '1.0.0';
      template.defaultSceneImage = '日常.png';
      template.openingMessages = ['开始游戏。'];
      template.promptBody = template.promptBody || '';
      template.worldSetting = template.worldSetting || world;
      template.protagonist = template.protagonist || protagonist;
      template.conflict = template.conflict || conflict || '';
      template.styles = template.styles && template.styles.length > 0 ? template.styles : (styles || []);
      template.extra = template.extra || extra || '';

      if (template.outputSections) {
        for (const key of Object.keys(template.outputSections)) {
          const sec = template.outputSections[key];
          if (!sec || typeof sec !== 'object') {
            template.outputSections[key] = { label: key, fields: [] };
          } else if (!Array.isArray(sec.fields)) {
            sec.fields = [];
          }
        }
      }
      template.sceneImages = {};
      if (template.sceneTypes) template.sceneTypes.forEach(t => { template.sceneImages[t] = '日常.png'; });
      template.sceneImages['日常'] = '日常.png';

      res.json({ template });
    } catch (err) {
      console.error('生成失败:', err.message, content?.substring(0, 100));
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
    const apiKey = getApiKey(req.body);
    const summary = await callDeepSeek(summaryMessages, apiKey, 0.3, 400);
    res.json({ summary });
  } catch (err) {
    console.error('摘要生成失败:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── 酒馆分享系统 ──
const SHARED_DIR = path.join(__dirname, 'templates', 'shared');

function ensureSharedDir() {
  if (!fs.existsSync(SHARED_DIR)) fs.mkdirSync(SHARED_DIR, { recursive: true });
}

// API: 列出所有分享模板
app.get('/api/shared', (_req, res) => {
  ensureSharedDir();
  const shared = [];
  try {
    const files = fs.readdirSync(SHARED_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(SHARED_DIR, file), 'utf-8');
        const t = JSON.parse(raw);
        shared.push({
          id: t.id,
          name: t.name || file,
          description: t.description || '',
          worldSetting: t.worldSetting || '',
          protagonist: t.protagonist || '',
          conflict: t.conflict || '',
          styles: t.styles || [],
          author: t.author || '未知作者',
          uploadedAt: t.uploadedAt || '',
          downloads: t.downloads || 0,
          theme: t.theme || 'dark',
        });
      } catch (e) { console.error('解析分享模板失败:', file, e.message); }
    }
  } catch (e) { console.error('读取分享目录失败:', e.message); }
  shared.sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  res.json({ shared });
});

// API: 上传分享模板
app.post('/api/shared', (req, res) => {
  const { template } = req.body;
  if (!template || !template.id || !template.name) {
    return res.status(400).json({ error: '无效的模板数据' });
  }
  try {
    ensureSharedDir();
    const shared = { ...template };
    shared.uploadedAt = shared.uploadedAt || new Date().toISOString();
    shared.downloads = shared.downloads || 0;
    shared.worldSetting = shared.worldSetting || '';
    shared.protagonist = shared.protagonist || '';
    shared.conflict = shared.conflict || '';
    shared.styles = shared.styles || [];
    delete shared.apiKey;

    const fileName = `${template.id}.json`;
    fs.writeFileSync(path.join(SHARED_DIR, fileName), JSON.stringify(shared, null, 2), 'utf-8');
    res.json({ success: true, id: template.id });
  } catch (err) {
    res.status(500).json({ error: '上传分享失败: ' + err.message });
  }
});

// API: 下载单个分享模板
app.get('/api/shared/:id', (req, res) => {
  ensureSharedDir();
  const filePath = path.join(SHARED_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '分享模板未找到' });
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const template = JSON.parse(raw);
    template.downloads = (template.downloads || 0) + 1;
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
    res.json({ template });
  } catch (err) {
    res.status(500).json({ error: '读取分享模板失败: ' + err.message });
  }
});

// API: 删除分享模板
app.delete('/api/shared/:id', (req, res) => {
  ensureSharedDir();
  const filePath = path.join(SHARED_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '分享模板未找到' });
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除分享失败: ' + err.message });
  }
});

// ── 启动（支持 Electron 嵌入）──
module.exports = app;

// ── 调试端点：检查 API Key 状态 ──
app.get('/api/debug', (_req, res) => {
  const key = process.env.DEEPSEEK_API_KEY || '';
  res.json({
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 8) + '...' : 'NOT SET',
    keyLength: key.length,
    nodeEnv: process.env.NODE_ENV || 'not set',
    envKeys: Object.keys(process.env).filter(k => k.includes('DEEP') || k.includes('KEY')),
    templates: loadTemplates().length,
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const templates = loadTemplates();
    console.log(`\n🎮 互动叙事游戏服务已启动`);
    console.log(`   地址: http://localhost:${PORT}`);
    console.log(`   提示词: ${gamePrompt ? '✅ 已加载 (' + gamePrompt.length + ' 字符)' : '❌ 未加载'}`);
    console.log(`   模板: ${templates.length} 个已加载`);
    const keyOk = !!process.env.DEEPSEEK_API_KEY;
    console.log(`   API Key: ${keyOk ? '✅ 已配置 (' + process.env.DEEPSEEK_API_KEY.substring(0, 5) + '...)' : '❌ 未配置！请在 Railway Variables 中添加 DEEPSEEK_API_KEY 并重新部署'}`);
    if (!keyOk) console.log(`   当前环境变量: ${Object.keys(process.env).filter(k => k.includes('DEEP') || k.includes('KEY')).join(', ') || '无相关变量'}`);
    console.log('');
  });
}
