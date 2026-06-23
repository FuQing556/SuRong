const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, previousSummary } = req.body;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: '没有需要摘要的消息' });
  }

  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' });
  }

  const prevContext = previousSummary
    ? `之前的摘要：${previousSummary}\n\n以下是新的对话片段，请合并成完整摘要。`
    : '以下是互动叙事对话片段，请生成摘要。';

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '用200字以内中文总结互动叙事关键事件。只写事实：主角经历、选择后果、状态变化、任务进展、NPC互动。不写感受。',
          },
          { role: 'user', content: `${prevContext}\n\n对话片段：\n${JSON.stringify(messages)}` },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });

    if (!resp.ok) throw new Error(`API error ${resp.status}`);
    const data = await resp.json();
    return res.json({ summary: data.choices[0].message.content });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
