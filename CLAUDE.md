# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义存档。每个存档使用独立的提示词、UI 字段、场景图片和主题。

**在线版**：部署在 Railway → `xixi-fable.up.railway.app`
手机电脑浏览器打开即玩，无需安装任何东西。

## 文件结构

```
xixi/
├── server.js              # Express 后端 + API 代理 + 模板API + 酒馆API + metaPrompt
├── prompt.txt             # 服务端后备提示词（不要随意改）
├── package.json           # 3个依赖：cors/dotenv/express
├── render.yaml            # Railway 部署配置
├── CLAUDE.md              # 本文件
├── test.js                # 自动化测试（node test.js — 60项检查）
├── templates/             # 模板存储
│   ├── surongrong.json    #   默认模板：苏蓉蓉·潜伏（手工模板，不改）
│   ├── custom_*.json      #   AI 生成的用户自创模板
│   └── shared/            #   酒馆分享数据（运行时创建，git不追踪）
├── themes/                # CSS 主题（10套，撞色结构+粒子特效+独有字体）
│   ├── theme-forest.css   #   🌿 森林 — 苔藓绿底+翠绿高亮+落叶+木框
│   ├── theme-xianxia.css  #   🏯 修仙 — 竹纸白底+赤金双线+墨点+卷轴画框
│   ├── theme-cyber.css    #   💜 赛博 — 纯黑底+电青品红+CRT扫描线+斜切框
│   ├── theme-sakura.css   #   🌸 樱花 — 象牙白底+粉樱点缀+花瓣飘落+圆镜框
│   ├── theme-ocean.css    #   🌊 深海 — 海军蓝底+亮青点缀+气泡+波浪框
│   ├── theme-sunset.css   #   🌅 日落 — 紫灰底+琥珀高亮+地平线光+半圆框
│   ├── theme-midnight.css #   🌃 子夜 — 深空黑底+12颗亮星+极光紫+望远镜圆框
│   ├── theme-monochrome.css # ⬜ 黑白 — 纯灰阶+左线区分选项+极简零动画
│   ├── theme-golden.css   #   ✨ 鎏金 — 浓黑底+暖金点缀+金属流光+镀金框
│   └── theme-light.css    #   ☀ 明亮 — 暖白底+深色文字+纸卡阴影+简洁框
├── public/                # 前端静态文件
│   ├── index.html         #   主页面：警告+序章+存档选择+游戏+设置+全弹窗
│   ├── style.css          #   基础暗色主题样式（变量驱动，10套主题自动继承）
│   ├── sw.js              #   Service Worker（网络优先v4，只缓存GET）
│   ├── manifest.json      #   PWA 清单
│   ├── *.png              #   场景图片
│   └── js/                #   前端模块（12文件，按依赖顺序加载）
│       ├── state.js       #     全局状态/DOM引用/常量
│       ├── utils.js       #     工具函数/提示词构建/文本解析
│       ├── dialogs.js     #     自定义对话框+Emoji选择器(pickEmoji)
│       ├── saves.js       #     存档管理+成就存储隔离
│       ├── ui.js          #     界面渲染/资源检测(全字段版)
│       ├── achievements.js #    成就系统(双守卫防误触发)
│       ├── prompts.js     #     提示词管理(合并非替换防串档)
│       ├── templates.js   #     模板加载/创建/字段编辑器
│       ├── tavern.js      #     酒馆分享(上传合并编辑版)
│       ├── ai.js          #     AI实时指令
│       ├── core.js        #     游戏核心循环
│       └── init.js        #     事件绑定/启动/全局错误捕获
└── 启动游戏.bat           # 本地开发启动（双击即跑）
```

## 启动方式

```bash
npm start                  # → http://localhost:3000
node test.js               # 自动化测试（无需浏览器）
```

## JS 模块加载顺序

```
state → utils → dialogs → saves → ui → achievements
  → prompts → templates → tavern → ai → core → init
```

每个模块用 `function` 声明全局函数。纯数据模块（state）用 `const`/`let`。index.html 中 12 个 `<script>` 标签按此顺序加载。

## ⚠️ 部署前必做：备份酒馆

Railway 每次 `git push` 部署会清空文件系统，酒馆共享数据（`templates/shared/`）会丢失。
**推代码前**必须提醒用户备份酒馆：

1. 打开 `https://xixi-fable.up.railway.app` → 酒馆标签 → 🔑 管理员登录（密码在 tavern.js 中，不公开）
2. 📥 备份下载 `tavern_backup.json`
3. git push 部署
4. 部署完成后 → 📤 恢复上传备份

```bash
git add -A && git commit -m "描述" && git push origin master
# Railway 自动部署，等待 1-2 分钟
```

## 核心功能

### 游戏循环
- 回合制互动叙事：AI输出"上回合结算→现状→4选项→状态字段"
- 选项按钮 + 键盘1-4快捷键（弹窗/输入框激活时自动禁用）
- 故事框累积显示所有回合（带回合标签，最多20回合，可上翻）
- 加载时显示"第X回合·已等待X秒"
- 资源不足选项灰色禁用——检测全部字段区段（不仅resources）

### AI交互
- AI小窗输入指令，下回合生效
- 📝合并到提示词——指令写入promptBody末尾【玩家补充规则】段，自动去重累加
- AI回复格式异常时自动重试一次
- 60秒超时，超时显示重试按钮

### 存档系统
- 自动存档（槽位0）：`xixi_gamesave_{id}`
- 手动存档（槽位1-9）：`xixi_gamesave_{id}_{slot}`
- 继续游戏多槽位选择——弹出自定义对话框输入槽位号
- 新游戏和继续游戏均加载编辑版模板（`xixi_edited_template_{id}`）
- 🗑清档（清除所有槽位，保留模板和成就）
- ✕删除整个模板（含成就缓存）
- ↩️撤销上一步

### 成就系统
- 可见成就——字段数值自动检测，进度条显示
- 隐藏成就（❓未知→达成揭示）——6种trigger：choice/gambit/rounds_under/field_zero/field_max_under/response_match
- 双守卫防误触发：首回合跳过 + 读档时跳过（`_loadingSave`标记）
- 按模板ID隔离存储（`xixi_achievements_{模板ID}`），跨新游戏保留
- ✏️编辑/✕删除/＋添加可见或隐藏成就
- 📦另存为新存档（导出当前模板）

### 提示词管理
- 设置页编辑promptBody（仅正文，不含格式模板和最终提醒）
- 💾保存到 `xixi_edited_template_{存档ID}`（按模板隔离）
- 新游戏和继续游戏均加载编辑版模板
- openSettings合并编辑（非整体替换，防止切存档串档）
- ↩恢复原始提示词（恢复到 `_originalTemplate.promptBody`）

### 字段编辑器
- 查看/修改字段（ID/标签/图标/类型/格式提示）
- 添加字段时选区段（状态栏/资源/关系）
- Emoji下拉选择器（`pickEmoji()`，80个常用emoji网格）
- 输入标签自动生成英文ID
- saveFields保留字段type（number/text不丢失）
- 关闭设置后字段值恢复（不变横杠）

### 结局系统
- AI输出【游戏结束·XX】→自动检测→弹出结局弹窗
- 弹窗展示：结局图标/名称/叙述/回合数/成就解锁数/最终字段值
- 三个按钮：重新开始/返回存档/继续游戏

### 工具功能
- 📜历程回顾弹窗（每回合选择/结算/现状/资源数值）
- 📄导出故事txt
- 点击状态栏数值手动修改
- ❓帮助弹窗（不显示管理员密码）

### 酒馆系统
- 酒馆列表 + 🔍实时搜索
- ☁分享到酒馆（上传前自动合并编辑版模板）
- 📥导入并游玩
- 🔑管理员：删除/📥备份下载/📤恢复上传

### UI/主题
- 11套主题切换（dark默认 + 10套CSS主题）
- 每套主题有独立：基底色、字体、图片框形状、粒子特效、文字动画、按钮hover效果
- 主题按存档隔离（`xixi_theme_{存档ID}`）
- 自定义对话框（dlAlert/dlConfirm/dlPrompt + pickEmoji）替代原生弹窗
- CSS变量驱动，主题文件只覆盖 `:root` + 特定元素

### 场景图片
- 9种场景类型，AI只能从模板定义的类型中选择
- 场景切换有淡入淡出动画
- 图片管理器中可为每个场景替换本地图片（Base64存localStorage）

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
  "hiddenAchievements": {"隐藏成就":{"icon":"🎭","desc":"描述","trigger":{"type":"choice","pattern":"...","count":1}}},
  "sceneTypes": ["场景1","场景2"],
  "sceneImages": {"场景1":"日常.png"},
  "openingMessages": ["开始游戏。【开局编号：1】"]
}
```

## localStorage Key 规范

| Key | 用途 |
|-----|------|
| `xixi_gamesave_{id}` | 自动存档（槽位0） |
| `xixi_gamesave_{id}_{slot}` | 手动存档（槽位1-9） |
| `xixi_edited_template_{id}` | 编辑版模板（字段/成就/提示词修改） |
| `xixi_achievements_{id}` | 已解锁成就 |
| `xixi_theme_{id}` | 主题选择（按存档隔离） |
| `xixi_saves` | 用户自创存档列表 |
| `xixi_apikey` | 用户API Key |
| `xixi_ai_instructions` | AI实时指令队列 |
| `xixi_custom_images` | 自定义场景图片（Base64） |
| `xixi_create_save_form` | 创建存档表单自动保存 |
| `xixi_generated_template` | AI生成的模板（防退出丢失） |
| `xixi_age_verified` | 18+警告已确认 |
| `xixi_last_save_id` | 上次游玩的存档ID |
| `xixi_active_template_id` | 当前活动模板ID |

## 维护说明

- 默认模板 `surongrong.json` 为手工模板，保持原样不改
- 新增场景类型时同步更新：模板 sceneTypes + sceneImages + public/ 对应图片
- 新增主题：创建 `themes/theme-xxx.css` + 在 `index.html` 主题选择器中添加选项
- 主题CSS只需覆盖 `:root` 变量 + 特定元素样式，基础布局由 `style.css` 提供
- 修改 outputSections 字段：在设置页字段编辑器中操作
- **推代码前备份酒馆数据**（见上方部署章节）
- **prompt.txt 是服务端后备**，不要随意修改。模板提示词在 `templates/*.json` 的 `promptBody` 中
- 运行 `node test.js` 做自动化语法检查（60项）
- 浏览器 F12 粘贴 `/js/test.js` 内容做运行时诊断
