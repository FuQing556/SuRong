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

// ── 从 outputSections 生成输出格式模板（与客户端一致）──
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

// ── 构建完整系统提示词（与客户端 utils.js 保持一致）──
function buildSystemPrompt(template) {
  if (!template) return gamePrompt || '';

  const format = generateOutputFormat(template.outputSections, template.sceneTypes);
  const body = template.promptBody || '';

  const outputRule = `【回复格式】\n每次回复严格按以下顺序，末尾完整输出所有状态字段（数值无变化也照写，不得省略）。第一回合上回合写"游戏开始。"`;

  const narrativeGuide = `【叙事法则】
· 每个选项必须推动剧情——不能让玩家选择后原地踏步。至少3个选项带玩家离开当前场景。
· 代价必须真实：标注【资源不足】的选项被选后，现状中必须体现失败后果，不得让选项正常成功。
· 结算时如实更新所有字段数值。消耗扣减，获得增加。数值变化要合理——不要凭空增减。
· 选项之间要有路线分歧：提供至少2条不同的策略方向（如战斗vs谈判、信任vs怀疑、冒险vs保守）。
· 结局推送：当关键数值达到极端（≥90或≤10）或轮次≥15时，积极考虑触发结局。触发时输出【游戏结束·结局名】。`;

  return outputRule + '\n\n' + format + '\n\n' + narrativeGuide + '\n\n' + body;
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

// ── API: 游戏对话（流式输出）──
app.post('/api/chat', async (req, res) => {
  const { messages, summary, template, systemPrompt } = req.body;

  // 构建消息数组
  let fullMessages;
  if (systemPrompt && systemPrompt.trim().length >= 100) {
    fullMessages = [{ role: 'system', content: systemPrompt }];
  } else if (messages && Array.isArray(messages) && messages.length > 0 && messages[0].role === 'system') {
    fullMessages = [...messages];
  } else {
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
    if (summary && summary.trim()) {
      fullMessages.push({ role: 'system', content: `【历史摘要】${summary}` });
    }
    if (messages && Array.isArray(messages)) {
      fullMessages.push(...messages);
    }
  }

  try {
    const apiKey = getApiKey(req.body);
    // 流式请求 DeepSeek
    const dsResp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: fullMessages, temperature: 0.8, max_tokens: 1024, stream: true }),
    });

    if (!dsResp.ok) {
      const errText = await dsResp.text();
      return res.status(dsResp.status).json({ error: `DeepSeek API 错误 (${dsResp.status}): ${errText}` });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 逐块转发 DeepSeek 的 SSE 流到客户端
    const reader = dsResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          res.write(line + '\n\n');
        }
      }
    }
  } catch (err) {
    console.error('对话请求失败:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
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

  const metaPrompt = `你是互动叙事游戏设计AI。输出纯JSON，不要markdown包裹。

【玩家需求】
名称：${name} | 世界观：${world} | 主角：${protagonist}
核心冲突：${conflict || '自由发挥'} | 风格：${styleText} | 长度：${length}
结局门槛：早${lengthGuide.early}回/中${lengthGuide.mid}回/后${lengthGuide.late}回/大后${lengthGuide.epic}回
${extra ? '★ 额外要求：' + extra : ''}

【字段架构 outputSections】
固定4段key：statusTop(状态栏,inline,3字段)/taskLine(null,inline,2字段)/resources(资源,inline,2字段)/variables(关系,grid,2字段)
statusTop: 生命线 — 2个数字(0-100)+1个文本状态
taskLine: 必须含 round(轮次,number) + 主线进度(0-5数字)
resources: 2个可消耗数字资源，每个必须在选项代价/收益中体现
variables: 2个关系值(-100~100)，每个必须被至少1个结局引用
字段格式: {"id":"camelCase","label":"2-4字中文","icon":"emoji","formatHint":"[范围]","type":"number或text"}

【提示词正文 promptBody — 3000-5000字，用【】分章节】
你是这个世界的AI主持人。每次回复 = 结算上轮后果 + 全新场景 + 4选项 + 状态字段。

必含章节（顺序）：
【你的身份】AI行为准则。因果结算+选项生成。不替玩家选择，不评价对错。
【叙事风格】这个世界独有的叙事语调。是冷峻、荒诞、温情还是史诗？用2-3句定义。每回合保持一致的叙事声音。
【场景跳跃】★ 每回合强制切换：时间+地点+事件至少换其二。禁止连续同场景。关键轮次(10/20/30)可延续2回合。给正确+错误示例。
【主角设定】外貌/能力/身世/处境。150-250字。只写能影响选项设计的。
【世界观】势力/NPC/规则。200-350字。每个NPC/势力必须能在选项中使用。
【结局系统】★ 4层结局，每层引用具体字段+数值。格式示例：
  早期(${lengthGuide.early}回): 条件(字段名=数值/范围) — 结局名 — 触发【游戏结束·结局名】
  中期(${lengthGuide.mid}回): 条件 — 结局名
  后期(${lengthGuide.late}回): 条件 — 结局名
  大后期(${lengthGuide.epic}回): 多条件 — 结局名
★ 条件必须引用具体字段标签和数值。"轮次≥15后积极推结局。结局触发后保留继续选项。
【资源系统】2个资源各列3种获取+3种消耗方式。资源不足→标的【资源不足】→下回合体现失败后果。
【选项设计】每回合4选项 = 动作+代价+风险(低/中/高/孤注)。≥3个带玩家离开当前场景。≥2条不同策略路线。禁止无代价、禁止"等待/观察"。选项之间形成真正的两难——没有明显最优解。
【开局系统】3个开局(编号1-3)，不同场景+初始数值。openingMessages:["开始游戏。【开局编号：1】",...]

【成就 achievements — 6-8个】
命名创意化，禁止"{字段}大师"等公式。用世界观特有名词。每个含字段+阈值。必含3通用成就(命名创意化): 轮次≥30未结局/触发结局/孤注一掷成功。格式:{"名":{"icon":"emoji","desc":"含检测条件"}}

【隐藏成就 hiddenAchievements — 3-5个】
每个含trigger。类型: choice(pattern+count)/gambit(count)/rounds_under(round)/field_zero(fieldLabel)/field_max_under(fieldLabel+threshold)/response_match(pattern+count)

【其他】
sceneTypes:5-7中文。description:≤20字。worldSetting/protagonist/conflict:各200-400字,\n\n分段。theme:"dark"。styles:标签数组。

输出纯JSON:`;

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
      template.openingMessages = template.openingMessages?.length > 0
        ? template.openingMessages
        : ['开始游戏。【开局编号：1】', '开始游戏。【开局编号：2】', '开始游戏。【开局编号：3】'];
      template.promptBody = template.promptBody || '';
      template.worldSetting = template.worldSetting || world;
      template.protagonist = template.protagonist || protagonist;
      template.conflict = template.conflict || conflict || '';
      template.styles = template.styles && template.styles.length > 0 ? template.styles : (styles || []);
      template.extra = template.extra || extra || '';

      // 规范化 outputSections（新架构：statusTop=3, taskLine=2, resources=2, variables=2）
      const SECTION_KEYS = ['statusTop', 'taskLine', 'resources', 'variables'];
      if (template.outputSections) {
        for (const key of SECTION_KEYS) {
          if (!template.outputSections[key] || typeof template.outputSections[key] !== 'object') {
            template.outputSections[key] = {
              label: key === 'taskLine' ? null : (key === 'variables' ? '关系' : key),
              display: key === 'variables' ? 'grid' : 'inline',
              fields: []
            };
          }
          const sec = template.outputSections[key];
          if (!Array.isArray(sec.fields)) sec.fields = [];
          sec.fields = sec.fields.filter(f => f && typeof f === 'object').map(f => ({
            id: f.id || ('field_' + Math.random().toString(36).slice(2,8)),
            label: f.label || f.id || '未命名字段',
            icon: f.icon || '📌',
            formatHint: f.formatHint || '[状态]',
            type: f.type || (f.id === 'round' ? 'number' : 'text'),
          }));
          // 确保 taskLine 含 round 字段
          if (key === 'taskLine' && !sec.fields.some(f => f.id === 'round' || f.label === '轮次')) {
            sec.fields.push({ id: 'round', label: '轮次', icon: '🔄', formatHint: '[数字]', type: 'number' });
          }
        }
      }
      // 规范化 achievements
      if (template.achievements && typeof template.achievements === 'object') {
        for (const [name, ach] of Object.entries(template.achievements)) {
          if (!ach || typeof ach !== 'object') {
            template.achievements[name] = { icon: '🏆', desc: name };
          } else {
            ach.icon = ach.icon || '🏆';
            ach.desc = ach.desc || ach.description || name;
          }
        }
      } else {
        template.achievements = {};
      }
      // 规范化 hiddenAchievements
      if (!template.hiddenAchievements || typeof template.hiddenAchievements !== 'object') {
        template.hiddenAchievements = {};
      } else {
        for (const [name, ha] of Object.entries(template.hiddenAchievements)) {
          if (!ha || typeof ha !== 'object') {
            template.hiddenAchievements[name] = { icon: '🎭', desc: name, trigger: { type: 'gambit', count: 1 } };
          } else {
            ha.icon = ha.icon || '🎭';
            ha.desc = ha.desc || name;
            if (!ha.trigger || typeof ha.trigger !== 'object') ha.trigger = { type: 'gambit', count: 1 };
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

// API: 备份酒馆（导出全部共享数据为JSON下载）
app.get('/api/tavern/backup', (_req, res) => {
  ensureSharedDir();
  try {
    const files = fs.readdirSync(SHARED_DIR).filter(f => f.endsWith('.json'));
    const data = files.map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SHARED_DIR, f), 'utf-8'));
      } catch (e) { return null; }
    }).filter(Boolean);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="tavern_backup.json"');
    res.json({ exportedAt: new Date().toISOString(), count: data.length, shared: data });
  } catch (err) {
    res.status(500).json({ error: '备份失败: ' + err.message });
  }
});

// API: 恢复酒馆（上传JSON文件导入共享数据）
app.post('/api/tavern/restore', (req, res) => {
  const { shared, overwrite } = req.body;
  if (!shared || !Array.isArray(shared)) {
    return res.status(400).json({ error: '无效的备份数据，需要 { shared: [...] }' });
  }
  try {
    ensureSharedDir();
    let imported = 0;
    for (const tpl of shared) {
      if (!tpl || !tpl.id || !tpl.name) continue;
      const filePath = path.join(SHARED_DIR, `${tpl.id}.json`);
      if (!overwrite && fs.existsSync(filePath)) continue; // 不覆盖已存在的
      fs.writeFileSync(filePath, JSON.stringify(tpl, null, 2), 'utf-8');
      imported++;
    }
    res.json({ success: true, imported, total: shared.length });
  } catch (err) {
    res.status(500).json({ error: '恢复失败: ' + err.message });
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
