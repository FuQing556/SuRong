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
function generateOutputFormat(sections, sceneTypes) {
  if (!sections || Object.keys(sections).length === 0) return '';

  const lines = [];
  const sceneTypeList = (sceneTypes || []).join('、');
  lines.push('【强制输出格式】');
  lines.push('你每次回复，必须严格使用以下模板，不得添加、不得遗漏、不得发挥：');
  lines.push(`[场景类型：${sceneTypeList || '类型名'} — 只能从以上${sceneTypes?.length || 0}个类型中选择] [事件大小：大/小]`);
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

  const format = generateOutputFormat(template.outputSections, template.sceneTypes);
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

  const metaPrompt = `你是一个互动叙事游戏的设计AI。根据以下设定生成完整的游戏模板JSON。严格输出合法JSON对象，不要markdown包裹，不要任何额外文字。

【玩家设定】
名称：${name}
世界观：${world}
主角：${protagonist}
核心冲突：${conflict || '自由发挥'}
风格倾向：${styleText}
游戏长度：${length}
结局回合门槛：早期${lengthGuide.early}回合 | 中期${lengthGuide.mid}回合 | 后期${lengthGuide.late}回合 | 大后期${lengthGuide.epic}回合

══════════════════════════════════
【第一部分：outputSections — 字段架构】
══════════════════════════════════

字段是游戏唯一的数值系统。以下规则是强制性的：

§1 四段式固定结构（key名称不可变）：
{
  "statusTop":  { "label":"状态栏", "display":"inline", "fields":[...] },
  "taskLine":   { "label":null,       "display":"inline", "fields":[...] },
  "resources":  { "label":"资源",     "display":"inline", "fields":[...] },
  "variables":  { "label":"关系",     "display":"grid",   "fields":[...] }
}

§2 字段数量硬性限制：
  statusTop：恰好3个 —— 主角的"生命线"。建议：压力/理智/体力值(0-100数字) + 威胁/暴露/危险值(0-100数字) + 一个定性状态(文本，如"健康/受伤/濒死")
  taskLine：恰好2个 —— 必须包含"round"(轮次,type:"number") + 主线进度(0-5数字，如潜伏进度/复仇进度/修为等级)
  resources：恰好2个 —— 可消耗资源(数字)。每个资源必须在选项代价/收益中被使用。如：金钱+弹药、灵石+丹药、情报+把柄
  variables：恰好2个 —— 关键NPC或阵营的关系值(数字，范围-100~100)。每个变量必须在至少一个结局条件中被引用

§3 每个字段对象5属性：
  {"id":"englishCamelCase","label":"中文标签(2-4字)","icon":"单个emoji","formatHint":"[范围如0-100]","type":"number或text"}

§4 铁律：每个字段必须在选项代价或结局条件中被使用。不满足则删除。

══════════════════════════════════
【第二部分：promptBody — 系统提示词正文】
══════════════════════════════════

AI主持游戏时收到的系统提示词。必须紧凑可执行。字数2000-4000字。用【】标记章节。

必须包含的章节（顺序固定）：

【你的身份】
AI行为准则。核心：你是因果结算机+选项生成器。每次回复 = 结算上轮后果 → 呈现全新场景 → 4个选项 → 输出状态字段。永远不替玩家做选择。

【场景跳跃铁律】★最高优先级★
每一回合必须是全新事件。强制切换时间+地点+事件类型(三者至少切换其二)。禁止连续两回合在同一场景。只有轮次10/20/30的关键事件允许延续2回合。给出1个正确示例和1个错误示例。

【主角设定】
外貌/能力/身世/当前处境。100-200字，只写对选项设计有影响的信息。

【世界观】
势力格局/关键NPC。150-300字。每个NPC或势力必须在选项设计中被使用。

【结局系统】★最关键★
设计4层结局，每层引用§1中的字段和具体数值：
  早期结局(约${lengthGuide.early}回合)：低门槛，有代价。触发条件示例：压力=100 / 暴露=100 / 某资源归零。触发时AI输出【游戏结束·结局名】，但保留至少1个"继续"选项。
  中期结局(约${lengthGuide.mid}回合)：标准胜利。触发条件示例：主线进度≥4 且 风险≤50 且 轮次≥${lengthGuide.early}。
  后期结局(约${lengthGuide.late}回合)：完美结局。触发条件示例：主线进度≥5 且 关系≥70 且 资源≥3。
  大后期结局(约${lengthGuide.epic}回合)：传奇结局。多条件全部满足。
★铁律：每个结局条件必须引用具体的字段标签和数值。禁止"足够多""很高"等模糊词。轮次≥20时大幅增加结局推送。结局触发时保留"继续"选项。

【资源管理】
列出2个可消耗资源的获取/消耗方式。至少3种获取+3种消耗。选项代价与资源联动。资源不足标注【资源不足】并触发负面后果。

【选项设计】
每回合4个选项 = 动作 + 代价 + 风险等级【低风险/中风险/高风险/孤注一掷】。至少3个选项带玩家离开当前场景。禁止无代价选项。禁止"等待/观察"等停留型选项。提供至少2条不同路线。

【开局系统】
设计3个开局场景（编号1-3），每个有不同初始场景和略微不同的初始数值，增加重玩性。每个开局的初始变量值不同。第一回合写"上回合：游戏开始。"
同时在JSON中输出openingMessages数组：["开始游戏。【开局编号：1】","开始游戏。【开局编号：2】","开始游戏。【开局编号：3】"]

══════════════════════════════════
【第三部分：achievements — 可见成就】
══════════════════════════════════

6-8个可见成就。命名必须根据世界观创意，禁止公式化命名（如"{字段}大师""{字段}达人"）。好例子：修仙→"元婴大成""渡劫成功"；谍战→"影子之王""双重间谍"。

每个成就必须能被字段数值检测：§1中的数字字段+阈值。如：压力曾≥90→"淬火成钢"；主线≥5→"真相大白"。

必须包含3个通用成就（名字创意化）：
  1. 轮次≥30且未结局 —— 如"长路漫漫""不死鸟"
  2. 触发任一结局 —— 如"尘埃落定""命运之轮"
  3. 孤注一掷成功 —— 如"赌徒""天选之人"

格式：{"创意成就名":{"icon":"单个emoji","desc":"简述(含检测条件)"}}

══════════════════════════════════
【第四部分：hiddenAchievements — 隐藏成就】
══════════════════════════════════

3-5个隐藏成就。解锁前不可见。每个必须包含trigger。

trigger类型：
  {"type":"choice","pattern":"匹配文本","count":N} —— 累计选N次匹配选项
  {"type":"gambit","count":N} —— 孤注一掷成功N次
  {"type":"rounds_under","round":N} —— N回合内触发结局
  {"type":"field_zero","fieldLabel":"字段标签"} —— 某字段归零
  {"type":"field_max_under","fieldLabel":"字段标签","threshold":N} —— 某字段全程未超阈值且通关
  {"type":"response_match","pattern":"匹配文本","count":N} —— AI回复N次匹配

格式：{"创意隐藏成就名":{"icon":"emoji","desc":"隐藏描述","trigger":{触发规则}}}

示例：
"近朱者赤":{"icon":"🌸","desc":"三度主动靠近危险的庇护者","trigger":{"type":"choice","pattern":"梦红尘|梦学姐|去找她","count":3}}
"赌徒":{"icon":"🎰","desc":"孤注一掷成功3次","trigger":{"type":"gambit","count":3}}
"速战速决":{"icon":"⚡","desc":"8回合内结束游戏","trigger":{"type":"rounds_under","round":8}}

══════════════════════════════════
【第五部分：其他】
══════════════════════════════════

sceneTypes：5-7个中文场景类型
description：20字以内简介
worldSetting：200-400字，\\n\\n分段
protagonist：200-400字，\\n\\n分段
conflict：200-400字，\\n\\n分段，简述四层结局
theme："dark"
styles：风格标签数组

══════════════════════════════════
【最终JSON模板】
══════════════════════════════════
换行用\\n，引号用\\"。输出纯JSON：

{"name":"${name}","description":"简介","outputSections":{"statusTop":{"label":"状态栏","display":"inline","fields":[{"id":"...","label":"...","icon":"...","formatHint":"...","type":"number"}]},"taskLine":{"label":null,"display":"inline","fields":[{"id":"round","label":"轮次","icon":"🔄","formatHint":"[数字]","type":"number"},{}]},"resources":{"label":"资源","display":"inline","fields":[{},{}]},"variables":{"label":"关系","display":"grid","fields":[{},{}]}},"promptBody":"正文","achievements":{"成就名":{"icon":"emoji","desc":"描述"}},"hiddenAchievements":{"成就名":{"icon":"emoji","desc":"描述","trigger":{}}},"sceneTypes":["类型"],"sceneImages":{"类型":"日常.png"},"theme":"dark","styles":[],"openingMessages":["开始游戏。【开局编号：1】","开始游戏。【开局编号：2】","开始游戏。【开局编号：3】"],"worldSetting":"世界观","protagonist":"主角","conflict":"冲突"}`;

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
