# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于斗罗大陆世界观、DeepSeek API 驱动的互动叙事网页游戏。玩家扮演史莱克学院卧底苏蓉蓉，在日月帝国皇家魂导学院中挣扎求生。

支持两种运行模式：
- **浏览器模式**：`npm start` → `http://localhost:3000`
- **桌面应用模式**：`npm run electron` → Electron 窗口（可打包为 .exe）

```
前端: HTML/CSS/JS 单页应用
后端: Node.js Express (本地) / Vercel Serverless (线上)
AI:   DeepSeek Chat API (deepseek-chat 模型)
```

## 文件结构

```
xixi/
├── server.js              # Express 后端：静态文件 + DeepSeek API 代理
├── prompt.txt             # 游戏提示词（约630行，核心资产）
├── package.json           # Node 依赖 + Electron 打包配置
├── .env                   # DeepSeek API Key（不上传 GitHub）
├── .env.example           # Key 模板
├── vercel.json            # Vercel 部署配置
├── 启动游戏.bat            # 双击启动浏览器模式（Windows）
├── 启动Electron.bat        # 双击启动 Electron 桌面模式（Windows）
├── 首次安装.bat            # 首次运行装依赖
├── 游戏提示词.txt          # 原始提示词备份
├── CLAUDE.md              # 本文件
├── electron/              # Electron 桌面应用
│   ├── main.js            #   主进程：启动Express + BrowserWindow
│   └── preload.js         #   预加载脚本（预留IPC）
├── api/                   # Vercel Serverless 函数
│   ├── chat.js            #   对话接口（内置提示词打包）
│   ├── summarize.js       #   摘要接口
│   └── prompt.js          #   提示词读写接口
├── public/                # 前端静态文件
│   ├── index.html         #   主页面：弹窗 + 游戏界面
│   ├── style.css          #   暗色主题样式
│   ├── app.js             #   核心逻辑：解析/渲染/状态管理
│   └── *.png              #   场景图片（9张：对峙/调查/潜伏/社交/战斗/研究/交易/日常/崩溃）
└── src/
    └── 日常.png           #   原始图片
```

## 启动方式

```bash
# 浏览器模式（开发/本地）
npm install
npm start                  # → http://localhost:3000
# 或双击 启动游戏.bat

# Electron 桌面模式（开发）
npm install
npm run electron           # → Electron 窗口
# 或双击 启动Electron.bat

# 打包为独立程序
npm run build:win          # → release/ 目录生成 .exe 安装包 + 便携版
npm run build:mac          # → release/ 目录生成 .dmg
npm run build:linux        # → release/ 目录生成 .AppImage
```

### 打包后分发

打包后的程序在 `release/` 目录：
- `苏蓉蓉互动叙事 Setup 1.0.0.exe`（安装包，123MB，需安装）
- `苏蓉蓉互动叙事-1.0.0-win.zip`（便携版，152MB，解压即用）
- `.env` 文件（含 `DEEPSEEK_API_KEY`），放在 `.exe` 同目录下

对方首次启动后在设置页填入 API Key 即可游玩。无需安装 Node.js 或任何其他依赖。

### 已知问题与解决

**Windows 构建失败（winCodeSign symlink 错误）**：当前 Windows 环境无符号链接权限，electron-builder 解压 winCodeSign 会失败。已通过 `scripts/patch-app-builder.js` 修补 `app-builder.exe`（`-snld` → `-snl-`）。`npm install` 后自动执行。如果构建仍失败，手动运行 `node scripts/patch-app-builder.js`。

**rcedit 不支持中文文件名**：Windows 资源编辑器 rcedit 无法处理含中文的 exe 文件名。已设置 `executableName: 'XixiGame'`（ASCII）。显示名称（ProductName）仍可中文。

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
- **上回合结算**：双段结构（上回合了结因果 → 现状切全新场景），根治线性叙事
- **场景跳转**：每回合强制换时间+地点+事件，仅关键事件可连2-3回合
- **RNG 系统**：高风险选项暗中掷1-100骰子，三种结果（失败/部分成功/成功）
- **资源管理**：魂力储备/人情令牌/情报碎片/把柄，选项代价中展示
- **四条路线**：隐忍/反击/周旋/沉沦，玩家选择累积塑造角色风格
- **五大结局**：精神崩溃/身份暴露/成功赎回/反向渗透/魂师大赛
- **成就系统**：10个成就，localStorage 永久保存，解锁弹窗 + 面板查看
- **图片轮换**：AI 输出场景类型，前端自动切换对应图片，淡入动画
- **提示词热编辑**：设置弹窗在线修改，保存到 localStorage，下回合生效
- **对话摘要**：超阈值自动压缩旧消息，节省 token

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
- **成就持久化**：localStorage 存储，解锁时间戳，跨会话保留
- **图片映射**：app.js 中 SCENE_IMAGES 对象映射场景类型→文件名，无匹配时回退日常.png

## 维护说明

- 修改提示词后建议同步更新本文件中提示词行数
- 新增场景类型时需同步：prompt.txt 场景列表 + app.js SCENE_IMAGES + public/ 对应图片
- 新增成就时需同步：prompt.txt 成就列表 + app.js ACHIEVEMENTS 对象
