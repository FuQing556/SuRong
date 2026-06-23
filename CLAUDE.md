# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于斗罗大陆世界观、DeepSeek API 驱动的互动叙事网页游戏。玩家扮演史莱克学院卧底苏蓉蓉，在日月帝国皇家魂导学院中挣扎求生。

```
前端: HTML/CSS/JS 单页应用
后端: Node.js Express (本地) / Vercel Serverless (线上)
AI:   DeepSeek Chat API (deepseek-chat 模型)
```

## 文件结构

```
xixi/
├── server.js              # Express 后端：静态文件 + DeepSeek API 代理
├── prompt.txt             # 游戏提示词（530行，核心资产）
├── package.json           # Node 依赖
├── .env                   # DeepSeek API Key（不上传 GitHub）
├── .env.example           # Key 模板
├── vercel.json            # Vercel 部署配置
├── 启动游戏.bat            # 双击启动（Windows）
├── 首次安装.bat            # 首次运行装依赖
├── 游戏提示词.txt          # 原始提示词备份
├── CLAUDE.md              # 本文件
├── api/                   # Vercel Serverless 函数
│   ├── chat.js            #   对话接口（内置提示词打包）
│   ├── summarize.js       #   摘要接口
│   └── prompt.js          #   提示词读写接口
├── public/                # 前端静态文件
│   ├── index.html         #   主页面：弹窗 + 游戏界面
│   ├── style.css          #   暗色主题样式
│   ├── app.js             #   核心逻辑：解析/渲染/状态管理
│   └── *.png              #   场景图片（8张：对峙/调查/潜伏/社交/战斗/交易/日常/崩溃）
└── src/
    └── 日常.png           #   原始图片
```

## 启动方式

```bash
# 本地
npm install
npm start                  # → http://localhost:3000
# 或双击 启动游戏.bat

# Vercel（需要设置环境变量 DEEPSEEK_API_KEY）
# 关联 GitHub 仓库后自动部署
```

## 架构

### 数据流
```
玩家点击选项 → app.js handleChoice() → fetch /api/chat
→ server.js 拼接 system prompt + history + summary
→ fetch DeepSeek API → 返回格式化响应
→ app.js parseAIResponse() → 渲染现状/选项/状态栏/变量追踪
```

### AI 输出格式（强制模板）
```
[场景类型：对峙] [事件大小：大]
上回合：[结算上轮选择后果]
现状：[新场景描述]
可选行动：
1. [动作] — [代价] 【风险等级】
...
状态栏 / 资源 / 变量追踪 / 成就
```

### 前端状态管理
- `gameState.fullHistory[]` - 完整对话历史
- `gameState.summary` - 旧对话摘要（超8回合触发）
- `gameState.currentOptions[]` - 当前4选项
- `gameState.customPrompt` - 用户自定义提示词（localStorage）

### 关键功能
- **场景跳转**：双段结构（上回合结算→现状切新场景），每回合强制换场景
- **RNG 系统**：高风险选项暗中掷1-100骰子
- **资源管理**：魂力储备/人情令牌/情报碎片/把柄
- **四条路线**：隐忍/反击/周旋/沉沦，玩家选择累积塑造
- **五大结局**：精神崩溃/身份暴露/成功赎回/反向渗透/魂师大赛
- **成就系统**：10个成就自动追踪
- **图片轮换**：AI 输出场景类型，前端自动切图

## 提示词结构

prompt.txt 分为以下模块：
1. 强制输出格式
2. AI 身份定义
3. 主角设定（苏蓉蓉）
4. 势力格局（明德堂/红尘双子/猎手/圣灵教/本体宗/史莱克/皇室）
5. 压迫性羞辱事件模板
6. 叙事铁律（冷感呈现）
7. 场景切换机制（终极版）
8. 性作为交易通货
9. 伤害边界
10. 选项设计硬性规则（7维度 + 场景类型匹配 + RNG）
11. 状态栏 / 资源系统 / 变量追踪
12. 关键事件系统
13. 胜利时刻
14. 结局系统
15. 压力值系统
16. 成就系统
17. 平衡检查
18. 场景类型库 / 手法分析（叙事手册）

## 技术要点

- **API Key 安全**：.env 不提交 Git，Vercel 上通过环境变量注入
- **摘要机制**：对话超过阈值时自动压缩旧消息，节省 token
- **提示词热更新**：通过设置弹窗编辑 → 保存到 localStorage → 随请求发送
- **Vercel 兼容**：提示词在构建时通过 fs.readFileSync 打包进 serverless 函数
