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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: 返回默认提示词
  if (req.method === 'GET') {
    return res.json({ prompt: defaultPrompt });
  }

  // POST: Vercel 上无法写文件，返回提示让前端用 localStorage
  if (req.method === 'POST') {
    return res.json({
      success: true,
      message: '提示词已保存到本地浏览器',
      length: (req.body.prompt || '').length,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
