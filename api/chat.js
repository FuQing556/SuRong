const fs = require('fs');
const path = require('path');

// 构建时打包提示词
const defaultPrompt = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'prompt.txt'), 'utf-8');
  } catch (e) {
    return '';
  }
})();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, summary, customPrompt } = req.body;
  const systemPrompt = customPrompt || defaultPrompt;

  if (!systemPrompt) {
    return res.status(500).json({ error: '游戏提示词未加载' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY 环境变量' });
  }

  const fullMessages = [{ role: 'system', content: systemPrompt }];

  if (summary && summary.trim()) {
    fullMessages.push({
      role: 'system',
      content: `【历史摘要】${summary}\n请基于此延续剧情，不要重复已发生事件。`,
    });
  }

  if (messages && Array.isArray(messages)) {
    fullMessages.push(...messages);
  }

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: fullMessages,
        temperature: 0.8,
        max_tokens: 1024,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: `DeepSeek API 错误 (${resp.status}): ${errText.substring(0, 200)}` });
    }

    const data = await resp.json();
    return res.json({ content: data.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
