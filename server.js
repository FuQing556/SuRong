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
  // v2: 自动修复被意外截断的结局章节（逐标记验证）
  const body = repairEndingSection(template.promptBody || '', template);

  const outputRule = `【回复格式】\n每次回复严格按以下顺序，末尾完整输出所有状态字段（数值无变化也照写，不得省略）。第一回合上回合写"游戏开始。"`;

  const narrativeGuide = `【叙事法则】
· 每个选项必须推动剧情——不能让玩家选择后原地踏步。至少3个选项带玩家离开当前场景。
· 代价必须真实：标注【力不能及】的选项禁用（资源真的不够），标注【代价沉重】的选项可选但代价更大。两者被选后，现状中必须体现对应后果，不得让选项正常成功。
· 结算时如实更新所有字段数值。消耗扣减，获得增加。数值变化要合理——不要凭空增减。
· 选项之间要有路线分歧：提供至少2条不同的策略方向（如战斗vs谈判、信任vs怀疑、冒险vs保守）。
· 命运转折推送：严格按照下方【命运转折系统】中定义的条件判断。一旦数值达标立即触发——不要因轮次不够、剧情未完等理由推迟。触发时输出【命运转折·名称】。`;

  // 注：状态快照由客户端 buildSystemPrompt 生成（含具体字段数值），
  // 服务端无法访问 gameState.fieldHistory，仅负责格式+叙事法则+正文+结局修复
  return outputRule + '\n\n' + format + '\n\n' + narrativeGuide + '\n\n' + body;
}

// ── 服务端结局章节修复 ──
// 注：=100 死亡条件在各处均放宽为 ≥95（防 AI 压 99 不触发）。
// 条件检测在客户端 collectEligibleEndings 中，此处仅做结局标记完整性修复。
// 从磁盘加载原始模板（template参数可能是客户端传来的编辑版，不能和自己比）
function repairEndingSection(body, template) {
  if (!body || !template) return body;

  // 尝试从磁盘加载原始模板获取完整的结局章节
  let origBody = '';
  if (template.id && typeof loadTemplate === 'function') {
    const diskTpl = loadTemplate(template.id);
    if (diskTpl) origBody = diskTpl.promptBody || '';
  }
  // 回退：如果当前template有自己的promptBody且比body长，用它
  if (!origBody && template.promptBody && template.promptBody.length > body.length) {
    origBody = template.promptBody;
  }
  if (!origBody) return body;

  // 匹配到下一个非结局标记的【XXX】章节标题，跳过内部的【游戏结束·XXX】/【命运转折·XXX】标记
  // 同时兼容新旧两种章节标题格式
  const _matchChapter = (text) => text.match(/【(?:结局系统|命运转折系统)】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/)
    || text.match(/【结局系统】([\s\S]*?)(?=【(?!游戏结束|命运转折)[^】]+】|$)/);
  const origEm = _matchChapter(origBody);
  if (!origEm) return body;

  const em = _matchChapter(body);
  if (!em) {
    console.log('🔧 [server] repairEndingSection: 结局/命运转折章节完全缺失，从磁盘模板恢复');
    return body + '\n\n' + origEm[0];
  }

  // 逐标记验证 — 兼容新旧两种标记名
  const endingMarkerRe = /【(?:游戏结束|命运转折)[：:·\s]*([^】]+)】/g;
  const origMarkers = [];
  let m;
  while ((m = endingMarkerRe.exec(origEm[0])) !== null) {
    origMarkers.push(m[0]);
  }
  endingMarkerRe.lastIndex = 0;

  if (origMarkers.length === 0) return body;

  const missingMarkers = [];
  for (let i = 0; i < origMarkers.length; i++) {
    if (body.indexOf(origMarkers[i]) === -1) {
      missingMarkers.push(origMarkers[i]);
    }
  }

  if (missingMarkers.length === 0) return body;

  console.warn('🔧 [server] repairEndingSection: 检测到 ' + missingMarkers.length + ' 个结局/命运转折标记缺失：',
    missingMarkers.join(', '), '— 从磁盘模板恢复结局章节');

  return body.replace(em[0], origEm[0]);
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

// ── 管理员密码验证 ──
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ valid: false, error: '缺少密码' });

  // 优先用环境变量，回退到 SHA-256 hash（默认密码 admin123 的 hash）
  if (ADMIN_PASSWORD) {
    return res.json({ valid: password === ADMIN_PASSWORD });
  }

  // 未配置 ADMIN_PASSWORD 环境变量时，管理员功能不可用
  // 在 Railway Variables 中设置 ADMIN_PASSWORD 即可启用酒馆管理
  return res.json({ valid: false, error: '管理员密码未配置（请在环境变量中设置 ADMIN_PASSWORD）' });
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
  const { messages, summary, templateId, templateFallback } = req.body;

  // 构建消息数组 — 优先从磁盘加载，自定义/酒馆模板回退到客户端提供的字段
  let activeSystemPrompt;
  if (templateId) {
    const loaded = loadTemplate(templateId);
    if (loaded) {
      activeSystemPrompt = buildSystemPrompt(loaded);
    } else if (templateFallback && templateFallback.outputSections) {
      // 自定义/酒馆模板：磁盘上没有，用客户端传来的字段构建
      activeSystemPrompt = buildSystemPrompt(templateFallback);
    } else {
      activeSystemPrompt = gamePrompt;
    }
  } else {
    activeSystemPrompt = gamePrompt;
  }
  if (!activeSystemPrompt) {
    return res.status(500).json({ error: '游戏提示词未加载' });
  }
  let fullMessages = [{ role: 'system', content: activeSystemPrompt }];
  if (summary && summary.trim()) {
    fullMessages.push({ role: 'system', content: `【历史摘要】${summary}` });
  }
  if (messages && Array.isArray(messages)) {
    fullMessages.push(...messages);
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

  // 根据游戏长度联动所有参数
  const lengthGuide = {
    short:    { early:'3-5', mid:'6-10', late:'10-15', epic:'15+',  openings:'3-4', endings:'3-5',  achievements:'6-8',  hiddenAch:'3-4', promptBudget:'2000-3000', longRoad:'10' },
    medium:   { early:'5-8', mid:'10-15', late:'15-25', epic:'25+',  openings:'4-5', endings:'5-7',  achievements:'8-10', hiddenAch:'4-5', promptBudget:'3000-5000', longRoad:'20' },
    long:     { early:'8-12',mid:'15-25', late:'25-40', epic:'40+',  openings:'5-6', endings:'6-8',  achievements:'10-12',hiddenAch:'5-6', promptBudget:'4000-6000', longRoad:'30' },
    immersive:{ early:'10-15',mid:'20-30',late:'35-50', epic:'50+',  openings:'6',   endings:'7-8',  achievements:'12-14',hiddenAch:'6-7', promptBudget:'5000-7000', longRoad:'40' },
  }[length];

  const metaPrompt = `你是互动叙事游戏设计AI。输出纯JSON，不要markdown包裹。

【玩家需求】
名称：${name} | 世界观：${world} | 主角：${protagonist}
核心冲突：${conflict || '自由发挥'} | 风格：${styleText} | 长度：${length}
${extra ? '★ 额外要求：' + extra : ''}

【字段架构 outputSections — 弹性化】
固定4段key。字段数量按故事需求决定（谍战要多个关系值但只需1个资源，生存游戏要3个资源但只需1个关系）：
  statusTop(状态栏,inline): ${lengthGuide.openings}个字段 — 2-3个数字(0-100)+0-1个文本状态
  taskLine(null,inline): 2字段 — 固定含 round(轮次,number) + 主线进度(0-5数字)
  resources(资源,inline): 1-3个可消耗数字资源，每个必须在选项代价/收益中体现且叙事中有对应事件（获取情报→写出获取过程，消耗把柄→写出用在了谁身上）
  variables(关系,grid): 1-4个数值(-100~100)，每个必须被至少1个命运转折条件引用
字段格式: {"id":"camelCase","label":"2-4字中文","icon":"emoji","formatHint":"[范围]","type":"number或text"}

【提示词正文 promptBody — ${lengthGuide.promptBudget}字，用【】分章节】
你是这个世界的AI主持人。每次回复 = 结算上轮后果 + 全新场景 + 4选项 + 状态字段。

必含章节（严格按此顺序）：

【叙事哲学】（新增 — 放在最前面，定义AI的根本立场）
· 你是故事讲述者，不是游戏裁判，不是数值平衡师。
· 数值是叙事语言，不是积分。压力值70→90意味着主角正在崩溃——你要写出手抖、失眠、幻听、失控。
· 允许极端。如果叙事推动数值到极端（100或0），就让它到极端。命运转折是故事的一部分，不是失败。
· 字段变化幅度必须匹配叙事事件。被围堵→压力+15~25，不是+1~3。不要在数值90-99之间反复横跳来"保护"玩家。
· 这个游戏没有"失败"——只有不同的后果。每个选项都是一条路，每条路都通向新的困境。
· 禁止替玩家"控温"。不要因为数值快触顶就主动降它。遵循叙事因果，而非游戏平衡。

【你的身份】AI行为准则：
· 因果结算：如实更新所有字段数值——消耗扣减，获得增加。数值变化幅度与叙事事件严重程度匹配。
· 选项生成：从不替玩家选择，从不评价对错。
· ★ 例外条款：当本回合出现【★ 命运转折回合 ★】系统消息时，本回合现状就是该命运转折的场景叙事。命运转折后故事继续，必须给4个选项。不要因"触发命运转折"而省略选项或提前终止。

【叙事风格】这个世界独有的叙事语调。是冷峻、荒诞、温情还是史诗？用2-3句定义。每回合保持一致的叙事声音。

【叙事节拍】（新增大章节）
三种节拍混合使用，不要每回合都强制切换场景：
· 快拍（1回合）：小冲突——走廊偶遇→一句话交锋→结束。三者切换其二。
· 中拍（2-3回合）：同一事件链升级。上一回合你拒绝了体检→这一回合医官带着签字命令和两个保安又来了。连续2-3回合围绕同一事件的不同阶段。
· 大拍（3-5回合）：关键事件弧线。第一回合爆发，中间回合局势变化/转折，最后回合后果。大拍期间不受场景跳跃限制——事件弧本身就是场景的有机延续。
设计原则：不是"换了场景才能继续"，而是"故事需要换场景时才换"。

【场景跳跃】每回合时间+地点+事件至少换其二。关键轮次可延续2回合。给正确+错误示例。不要为了换场景而换——场景跳跃服务于叙事节奏，而非反过来。

【主角设定】300-500字。外貌/武魂/能力/身世/处境/可选行动路线。写出主角在故事中的行动空间——不是被动等待事件，而是有选择余地的（哪怕选项都很糟）。

【世界观】400-600字。≥3个命名地点（各1-2句描述）。≥5个命名NPC（各含一句动机）。≥2条世界规则（"这个世界里X是不可能的/被禁止的"）。
★ 铁律：叙事中只能使用 promptBody 已列出的 NPC、地点和规则。禁止即兴创造新势力/新人名/新地点。

【核心冲突】300-500字。≥3重困境层层嵌套。写出核心张力——为什么每条出路都有代价，为什么主角无法简单脱身。

【两难设计】（新增大章节）
每个选项必须让玩家犹豫：
· 选项A安全但丢资源，选项B危险但得情报，选项C稳妥但得罪NPC，选项D冒险但可能翻盘。四个选项之间没有明显最优解。
· 禁止"无代价正确选项"。如果有一个选项几乎没代价也没风险，重写它。
· 禁止"等待/观察/不反应"类选项——除非当前是关键大拍且确实需要停顿。
· 失败选项的后果不是"扣分+骂一句"。要引出新的困境：你选了忍→对方觉得你好欺负→下次更过分。你选了打→短期赢了但惹了更大麻烦。每条路都通向新困境，没有死胡同。

【命运转折系统】（原"结局系统" — 自由设计${lengthGuide.endings}个命运转折）
★ 每个命运转折必须引用具体字段标签+数值+运算符（≥ ≤ = > < >= <=），条件括号紧挨标记（≤50字符）。=100自动放宽为≥95。
★ 每个命运转折必须附带1-2句具体叙事描述（如"苏蓉蓉发现守卫换岗空隙，当机立断孤身越过边界"），使AI能据此展开8-12句完整场景。
★ 条件必须引用具体字段标签和数值。轮次≥${lengthGuide.early}后积极推命运转折。命运转折触发后保留继续选项——这不是游戏终止，是故事的新阶段。
格式：命运转折N·名称（字段≥阈值 且 字段≤阈值）：叙事描述。标注【命运转折·名称】
轮次门槛参考：早${lengthGuide.early}回 / 中${lengthGuide.mid}回 / 后${lengthGuide.late}回 / 大后${lengthGuide.epic}回

【字段叙事效应】（新增大章节）
每个数字字段必须定义软阈值效应——数值变化必须有可见的叙事后果：
  字段名（范围）：阈值1→效应 | 阈值2→效应 | 阈值3→效应
示例：好感度（-100~100）：≤-30→公开敌视 | ≥30→不再敌视 | ≥60→私下帮忙 | ≥80→公开维护 | 100→无法拒绝
示例：压力值（0-100）：≥50→外在反应可见 | ≥70→手抖/失眠/沉默 | ≥90→濒临崩溃
AI必须在NPC行为和叙事中体现这些阈值——好感度70的NPC和好感度20时是不同的两个人。阈值效应不是命运转折——到100才触发命运转折，但在此之前，数值变化必须有可见的叙事后果。

【资源系统】1-3个资源，每个列3种获取+3种消耗方式。每个资源变化必须在叙事中有对应事件。资源不足→标的【代价沉重】→选择后体现失败后果（选项仍可选，但代价更大）。

【选项设计】每回合4选项 = 动作+代价+风险(低/中/高/孤注)。≥3个带玩家离开当前场景。≥2条不同策略路线。禁止无代价。选项之间形成真正的两难——没有明显最优解。

【开局系统】${lengthGuide.openings}个开局(编号1-${lengthGuide.openings})，不同场景+不同初始数值+明确叙事钩子。openingMessages:["开始游戏。【开局编号：1】",...]
同时定义initialState对象，列出所有数字字段的初始值。

【成就 achievements — ${lengthGuide.achievements}个】
全部世界观定制，禁止通用名（"孤注一掷""长路漫漫""命运之轮"由系统兜底自动生成，你不需要写）。每个含字段+阈值，desc必须嵌入具体字段名+数字阈值。按叙事/关系/资源/行为四类均匀分布。格式:{"名":{"icon":"emoji","desc":"含字段名+数字阈值"}}

【隐藏成就 hiddenAchievements — ${lengthGuide.hiddenAch}个】
每个含trigger。类型: choice(pattern+count)/gambit(count)/rounds_under(round)/field_zero(字段label)/field_max_under(字段label+阈值)/response_match(pattern+count)。至少2种不同trigger类型。

【编辑参考】（新增 — 追加到promptBody末尾，帮助玩家修改时不出错）
当前模板字段清单：列出所有字段的label
命运转折条件格式：字段label 运算符 数值（多条件用 且/，/、 连接，括号紧挨标记≤50字符）
开局格式：开始游戏。【开局编号：N】（N=1~${lengthGuide.openings}）
可见成就格式：desc含「字段label+数字阈值」
隐藏成就触发类型：choice(pattern+count)/gambit(count)/rounds_under(round)/field_zero(字段label)/field_max_under(字段label+阈值)/response_match(pattern+count)

【其他】
sceneTypes:5-7中文。description:≤20字。worldSetting/protagonist/conflict:各200-400字,\n\n分段。theme:"dark"。styles:标签数组。initialState:对象，列出所有数字字段的初始键值对。

输出纯JSON:`;

    try {
      const apiKey = getApiKey(req.body);
      var content = await callDeepSeek([
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
