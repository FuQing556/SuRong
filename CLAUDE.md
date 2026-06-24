# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义存档。每个存档使用独立的提示词、UI 字段、场景图片和主题。

**在线版**：部署在 Railway → `xixi-tavern.up.railway.app`
手机电脑浏览器打开即玩，无需安装任何东西。

## 文件结构

```
xixi/
├── server.js              # Express 后端 + API 代理 + 模板API + 酒馆API
├── prompt.txt             # 默认提示词（后备）
├── package.json           # 3个依赖：cors/dotenv/express
├── render.yaml            # Railway 部署配置
├── CLAUDE.md              # 本文件
├── templates/             # 模板存储
│   ├── surongrong.json    #   默认模板：苏蓉蓉·潜伏（手工模板，不改）
│   ├── custom_*.json      #   AI 生成的用户自创模板
│   └── shared/            #   酒馆分享数据（运行时创建，git不追踪）
├── themes/                # CSS 主题（10套）
├── public/                # 前端静态文件
│   ├── index.html         #   主页面：警告 + 序章 + 存档选择(我的/酒馆) + 游戏界面 + 设置
│   ├── app.js             #   模板驱动前端逻辑
│   ├── style.css          #   基础暗色主题样式
│   ├── sw.js              #   Service Worker（网络优先，v3）
│   ├── manifest.json      #   PWA 清单
│   └── *.png              #   场景图片
└── 启动游戏.bat           # 本地开发启动（双击即跑）
```

## 启动方式

```bash
# 本地开发
npm start                  # → http://localhost:3000
```

## ⚠️ 部署前必做：备份酒馆

Railway 每次 `git push` 部署会清空文件系统，酒馆共享数据（`templates/shared/`）会丢失。
**推代码前**必须执行：

1. 打开 `https://xixi-tavern.up.railway.app` → 酒馆标签 → 🔑 管理员登录（密码 `admin123`）
2. 确认酒馆内容需要保留
3. 告诉我备份酒馆，我会下载 `templates/shared/` 的所有 JSON 文件
4. 推完代码部署完成后，把备份文件上传回酒馆

```bash
# 部署
git add -A && git commit -m "描述" && git push origin master
# Railway 自动部署，等待 1-2 分钟
```

## 核心功能

### 序章背景故事卡
模板 JSON 包含 `worldSetting` / `protagonist` / `conflict` / `styles` 四个结构化字段。
新建存档或开始新游戏时弹出序章弹窗，展示世界观、主角设定、核心冲突。`\n\n` 分段自动渲染为段落。

### 酒馆分享系统
- `GET /api/shared` — 列出所有分享模板
- `POST /api/shared` — 上传分享
- `GET /api/shared/:id` — 下载模板（计数+1）
- `DELETE /api/shared/:id` — 管理员删除（前端密码 `admin123`）
- 数据存储：`templates/shared/` 目录（JSON 文件）

### 存档管理
- 双标签页面：「我的存档」/「酒馆」
- 每张卡片显示：名字 + 主角 + 故事目标
- 自定义存档可「分享到酒馆」、可删除（确认弹窗 + 彻底清理）
- 酒馆面板：浏览他人分享、导入并游玩、管理员可删除

### AI 生成模板
- 创建表单：名称、世界观、主角、冲突、风格、**游戏长度**（短篇/标准/长篇/沉浸）
- 长度决定四层结局的回合门槛
- 使用 `response_format: json_object`（jsonMode）强制合法 JSON
- 服务端规范化：自动补齐成就的 `icon`/`desc`、字段的 `id`/`label`/`icon`/`formatHint`

### 四层结局系统（AI 生成时注入）
- 早期结局（低门槛，有代价，可选不结束）
- 中期结局（标准条件，主要结局）
- 后期结局（高门槛，完美结局）
- 大后期结局（传奇结局，多条件）
- 铁律：AI 永远不能替玩家结束，触发结局时必须保留「继续」选项

### 其他
- **Service Worker**：网络优先策略（v3），`activate` 时自动清旧缓存
- **主题隔离**：`xixi_theme_{存档ID}`，每个存档独立主题
- **成就隔离**：`xixi_achievements_{模板ID}`
- **表单自动保存**：创建存档表单实时存 localStorage，退出不丢失
- **API Key**：请求体 `apiKey` → 环境变量 `DEEPSEEK_API_KEY`
- **生成超时**：chat 60秒，generate-prompt 120秒

## 模板 JSON 结构

```json
{
  "id": "my-world",
  "name": "名称",
  "description": "20字简介",
  "worldSetting": "世界观详细介绍（\\n\\n分段）",
  "protagonist": "主角详细介绍（\\n\\n分段）",
  "conflict": "核心冲突（\\n\\n分段，含四层结局）",
  "styles": ["风格标签"],
  "theme": "dark",
  "outputSections": {
    "statusTop": {"label":"状态栏","display":"inline","fields":[...]},
    "taskLine": {"label":null,"display":"inline","fields":[...]},
    "resources": {"label":"资源","display":"inline","fields":[...]},
    "variables": {"label":"变量追踪","display":"grid","fields":[...]}
  },
  "promptBody": "系统提示词正文（3000-6000字）",
  "achievements": {"成就名":{"icon":"🏆","desc":"描述"}},
  "sceneTypes": ["场景1","场景2"],
  "sceneImages": {"场景1":"日常.png"},
  "openingMessages": ["开始游戏。"]
}
```

## 添加新模板

通过游戏内「＋ 创建新存档」让 AI 生成。选择游戏长度后 AI 自动适配四层结局门槛。
也可在 `templates/` 目录手动创建 JSON 文件。

## 维护说明

- 默认模板 `surongrong.json` 为手工模板，保持原样不改
- 新增场景类型时同步更新：模板 sceneTypes + sceneImages + public/ 对应图片
- 新增主题：创建 `themes/theme-xxx.css` + 在 `index.html` 主题选择器中添加选项
- 修改 outputSections 字段：在设置页字段编辑器中操作
- **推代码前备份酒馆数据**（见上方部署章节）
