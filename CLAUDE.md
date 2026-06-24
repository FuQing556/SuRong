# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义存档。每个存档使用独立的提示词、UI 字段、场景图片和主题。

**在线版**：部署在 Railway，手机电脑浏览器打开即玩，无需安装任何东西。
**本地版**：`npm start` → `http://localhost:3000`

## 文件结构

```
xixi/
├── server.js              # Express 后端：静态文件 + DeepSeek API 代理 + 模板API
├── prompt.txt             # 默认提示词（约630行，仅用于后备）
├── package.json           # Node 依赖 + Electron 打包配置
├── render.yaml            # Railway 部署配置
├── .env                   # DeepSeek API Key（本地用，不上传 GitHub）
├── .env.example           # Key 模板
├── CLAUDE.md              # 本文件
├── electron/              # Electron 桌面应用（可选）
│   ├── main.js            #   主进程
│   └── preload.js         #   预加载脚本
├── templates/             # 模板存储
│   ├── surongrong.json    #   默认模板：苏蓉蓉·潜伏（含完整 promptBody + outputSections + achievements）
│   └── custom_*.json      #   AI 生成的用户自创模板
├── themes/                # CSS 主题（11套）
│   ├── theme-light.css    #   明亮
│   ├── theme-xianxia.css  #   修仙古风
│   ├── theme-cyber.css    #   赛博霓虹
│   ├── theme-ocean.css    #   深海
│   ├── theme-forest.css   #   森林
│   ├── theme-sunset.css   #   日落
│   ├── theme-midnight.css #   子夜
│   ├── theme-sakura.css   #   樱花
│   ├── theme-monochrome.css # 黑白
│   └── theme-golden.css   #   鎏金
├── scripts/               # 工具脚本
│   ├── patch-app-builder.js    # 修补 electron-builder 的 Windows symlink 问题
│   └── patch-switchscene.js    # switchSceneImage null 安全补丁
├── api/                   # Vercel Serverless 函数（备选部署方案）
│   ├── chat.js
│   ├── summarize.js
│   └── prompt.js
├── public/                # 前端静态文件
│   ├── index.html         #   主页面：弹窗 + 游戏界面 + 设置 + 字段编辑器
│   ├── style.css          #   基础暗色主题样式
│   ├── app.js             #   模板驱动前端逻辑（约1400行）
│   ├── sw.js              #   Service Worker（PWA 离线缓存）
│   ├── manifest.json      #   PWA 清单
│   └── *.png              #   场景图片（对峙/调查/潜伏/社交/战斗/研究/交易/日常/崩溃）
└── src/
    └── 日常.png           #   原始图片
```

## 启动方式

```bash
# 本地开发
npm install
npm start                  # → http://localhost:3000

# Electron 桌面模式（可选）
npm run electron           # → Electron 窗口

# 打包为 .exe（需先修补 app-builder）
node scripts/patch-app-builder.js
npm run build:win          # → release/ 目录
```

### 在线部署（Railway）

已部署在 Railway。推送代码后自动重新部署：
```bash
git add -A && git commit -m "更新" && git push origin master
```

## 架构

### 核心创新：模板自描述系统

模板 JSON 同时驱动 **AI 输出格式** 和 **前端解析渲染**：

```
模板.json
├── outputSections   ──→  ① 自动生成 AI 输出格式（状态栏/资源/变量字段）
│                    ──→  ② 驱动前端动态解析（按字段 label 匹配提取值）
│                    ──→  ③ 驱动前端动态渲染（生成状态栏/变量面板 HTML）
├── promptBody       ──→  ④ 系统提示词正文（世界观/角色/规则）
├── achievements     ──→  ⑤ 成就列表（按模板隔离存储）
├── sceneTypes/images ──→  ⑥ 场景类型 → 图片映射
├── theme            ──→  ⑦ 默认主题
└── openingMessages  ──→  ⑧ 开局场景池
```

用户编辑字段 → `generateOutputFormat()` 重新生成 AI 格式 → `refreshSystemPrompt()` → 下次请求自动同步。一处修改，前后端同步。

### 数据流
```
玩家点击选项 → app.js handleChoice()
→ sendMessage() 构建消息（系统提示词 + 历史摘要 + AI指令 + 最近对话）
→ fetch /api/chat（附带 apiKey 和 template）
→ server.js getApiKey()（请求体 > 环境变量） → callDeepSeek()
→ 返回格式化响应
→ app.js parseAIResponse() 模板驱动解析 → renderGameState() 动态渲染
→ saveGameState() 自动存档
```

### AI 输出格式（自动生成）
```
【强制输出格式】
[场景类型：类型名] [事件大小：大/小]
上回合： [结算]
现状： [新场景]
可选行动：
1. [动作] — [代价] 【风险等级】
...
状态栏 / 资源 / 变量追踪 / 成就  ← 动态生成
【资源校验铁律】 ← 硬编码
```

### 前端状态管理
- `gameState.fullHistory[]` — 完整对话历史
- `gameState.summary` — 旧对话摘要（超8回合触发）
- `gameState.activeTemplate` — 当前活动模板（含 outputSections/sceneImages/achievements）
- `gameState.activeSystemPrompt` — 由模板自动生成的完整系统提示词
- `gameState.activeSaveId` — 当前存档ID（用于存档/读档/主题隔离）
- `gameState._currentTheme` — 当前主题（每次 applyTheme 追踪）
- `gameState.currentOptions[]` — 当前4选项

### 关键功能

**存档系统**
- 自动存档：每回合 AI 响应后 `saveGameState()` 写入 localStorage
- 继续游戏：`continueGame()` 恢复完整对话历史、状态、主题
- 新游戏：`selectSave()` 清除旧存档，开新局
- 成就隔离：`xixi_achievements_{模板ID}` 按存档独立存储
- 主题隔离：`xixi_theme_{存档ID}` 每个存档记住自己的主题

**模板系统**
- 默认模板：苏蓉蓉·潜伏（templates/surongrong.json）
- AI 辅助创建：填表单 → `/api/generate-prompt` → DeepSeek 生成完整提示词 → 预览 → 保存
- 表单自动保存：输入时实时存 localStorage，退出不丢失
- 模板字段编辑器：设置页可编辑所有字段的 label/icon/formatHint

**10 套视觉主题**
按存档隔离存储。每套有独特视觉特征（圆角/字体/边框/阴影/动画），不是简单换色。

**AI 实时指令**
指令注入到用户消息末尾，AI 无法忽略。下回合直接体现。

**场景图片替换**
设置页文件选择器，选本地图片替换任意场景类型，存 base64 到 localStorage。

**资源校验铁律**
自动生成的输出格式含硬编码资源校验规则：选项代价需检查资源、资源不足标警告、强选触发负面后果、数值如实更新。

**提示词热编辑**
设置页在线修改，下回合生效。大幅修改建议开新游戏。

**6 种随机开局**
拍卖会 / 浴室失窃 / 走廊围堵 / 学妹扣押 / 深夜侵入 / 多方会诊

**API Key 自助输入**
设置页顶部输入 DeepSeek Key，存 localStorage。每次请求附带，无需配环境变量。

## 技术要点

- **API Key 三层获取**：请求体 `apiKey` → 环境变量 `DEEPSEEK_API_KEY` → 报错
- **模板自描述**：outputSections 同时驱动 AI 输出格式和前端解析渲染
- **成就隔离**：`xixi_achievements_{模板ID}`，切换存档自动切换成就集
- **主题隔离**：`xixi_theme_{存档ID}`，每个存档独立主题
- **存档持久化**：`xixi_gamesave_{存档ID}` 存完整游戏状态，刷新/重启可继续
- **表单自动保存**：创建存档表单实时存 localStorage
- **PWA 支持**：manifest.json + service worker，手机可添加到桌面全屏运行
- **Railway 部署**：render.yaml，git push 自动重新部署

## 添加新模板

在 `templates/` 目录创建 JSON 文件，或通过游戏内「＋ 创建新存档」让 AI 生成：

```json
{
  "id": "my-world",
  "name": "我的世界",
  "description": "简介",
  "theme": "dark",
  "outputSections": {
    "statusTop": { "label": "状态", "fields": [...] },
    "taskLine": { "label": null, "fields": [...] },
    "resources": { "label": "资源", "fields": [...] },
    "variables": { "label": "变量追踪", "fields": [...] }
  },
  "promptBody": "完整的系统提示词正文...",
  "achievements": { "成就名": { "icon": "🏆", "desc": "描述" } },
  "sceneTypes": ["场景1","场景2"],
  "sceneImages": { "场景1": "日常.png" },
  "openingMessages": ["开始游戏。"]
}
```

## 维护说明

- 修改默认提示词需同步更新 `prompt.txt`（后备）和 `templates/surongrong.json`（模板系统）
- 新增场景类型时需同步：模板 sceneTypes + sceneImages + public/ 对应图片
- 新增主题：创建 `themes/theme-xxx.css` + 在 `index.html` 主题选择器中添加选项
- 修改 outputSections 字段时：编辑模板 JSON 或在设置页字段编辑器中操作
- Windows 构建前需运行 `node scripts/patch-app-builder.js`（symlink 权限问题）
