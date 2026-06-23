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

// ── 提示词管理 ──
const PROMPT_PATH = path.join(__dirname, 'prompt.txt');

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
  if (!gamePrompt) {
    return res.status(500).json({ error: '游戏提示词未加载，请检查 prompt.txt' });
  }

  const { messages, summary } = req.body;

  // 构建消息数组
  const fullMessages = [{ role: 'system', content: gamePrompt }];

  // 插入历史摘要
  if (summary && summary.trim()) {
    fullMessages.push({
      role: 'system',
      content: `【历史摘要 — 这是之前发生的事件的压缩记录。请基于此延续剧情，不要重复已经发生的事件。】\n${summary}`,
    });
  }

  // 插入最近对话
  if (messages && Array.isArray(messages)) {
    fullMessages.push(...messages);
  }

  try {
    const content = await callDeepSeek(fullMessages);
    res.json({ content });
  } catch (err) {
    console.error('对话请求失败:', err.message);
    res.status(500).json({ error: err.message });
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

// ── 启动 ──
app.listen(PORT, () => {
  console.log(`\n🎮 互动叙事游戏服务已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   提示词: ${gamePrompt ? '✅ 已加载 (' + gamePrompt.length + ' 字符)' : '❌ 未加载'}`);
  console.log(`   API Key: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '⚠ 未配置 (需创建 .env 文件)'}\n`);
});
