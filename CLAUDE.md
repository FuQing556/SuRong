# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义模板。

**在线版**：`xixi-fable.up.railway.app` | **本地**：`npm start` → `http://localhost:3000`

---

## v9 更新概览

### v9.0–v9.5（2026-06-27，2 轮共 23 项修复 + 命运转折结构化）

| 类别 | 关键改动 |
|------|---------|
| 致命崩溃 | `extractAllFields` 字段缺 label 时排序崩溃 → 加 `.filter(f=>f.label)` 防线 |
| 数据结构兜底 | 新增 `validateAndRepairTemplate()` — 每次加载模板自动修复 outputSections/字段/endings/achievements |
| AI输出防御 | `outputSections`/`achievements`/`hiddenAchievements` AI返回数组时自动包裹为对象 |
| 命运转折结构化 | 新增 `template.endings` 数组（name/condition/narrative/icon），自动从旧 promptBody 迁移 |
| XSS 防护 | 6处 innerHTML 增加 escapeHtml |
| UI | 难度chip事件绑定；"存档"→"模板"文案修正；资源行flex→grid对齐 |

### v9.6（2026-06-27）：模板AI标准生成 + 手机端UI + 主题修复 + 负数阈值

| 类别 | 关键改动 |
|------|---------|
| 默认模板替换 | `surongrong.json` 旧版手工提示词 → `POST /api/generate-prompt` 标准流程生成 |
| 手机端UI | 顶部10按钮等宽统一（`min-width` + `text-align:center`）、资源字段左对齐（`justify-self:start`）、触摸设备隐藏键盘提示+防双击缩放 |
| iOS输入框 | `font-size:16px !important` 全局 → 精确限定到主交互区，不误伤弹窗表单 |
| 主题CSS | 4个主题文件 `@media (max-width:480px)` 闭合括号泄漏修复（`.game-title` 误漏到全局） |
| 负数阈值 | `utils.js` 条件正则 `\d+` → `-?\d+` 支持负数阈值（如 `≥-50`） |
| 测试 | `ending-system.test.js` 适配新模板字段名 + 结构化 endings 优先路径 + 条件回溯bug修复 |

### v9.7（2026-06-27）：默认模板全面重制 + PWA品牌升级

| 类别 | 关键改动 |
|------|---------|
| 字段精简 | 13→10字段：红尘双子分离（梦红尘好感/笑红尘态度）、圣灵教独立字段、恢复魂力状态/把柄、去掉无叙事意义字段 |
| 命运转折重命名 | 精神崩溃→**月光和六便士**、身份暴露→**枯萎之刻**、成功撤离→**归乡**、快速撤离→**暮去朝来**、反向渗透→**红尘庇佑**、魂师大赛→**凉面派** 🍜 |
| 成就重命名 | 黑暗中的盟友→**近朱者赤**、笑红尘的认可→**学长的肯定** 等，全部叙事化 |
| 开局恢复 | 6个详细开局场景恢复（拍卖会/浴室失窃/走廊围堵/学妹扣押/深夜侵入/多方会诊），每个150-200字 |
| 提示词 | 6912字，15章节完整，保留新版结构+旧版叙事精度 |
| PWA品牌 | 名称→**Lily of the Valley**（简称铃兰）、图标→苏蓉蓉大头照（192+512 PNG）+ 铃兰矢量 SVG、SW v8→v9→v10 |

### v9.8（2026-06-27）：版本门控清缓存 + 缓存根治 + PWA精修 + 校验加固 + 帮助重写

| 类别 | 关键改动 |
|------|---------|
| 数据版本迁移 | `init.js` `migrateDataVersion()` — bump `APP_DATA_VERSION` 后所有客户端自动清旧缓存。当前 v4 |
| SW 缓存根治 | v9→v10：`/api/*` 请求跳过缓存，模板/酒馆每次拉最新。`resetPrompt` 强制 fetch 服务器而非内存快照 |
| 字段校验加固 | 候选标签是真实字段真子串时智能放过（如"压力"⊆"压力值"）+ 排除列表新增元指令误报词 |
| reloadPrompt 删除 | 原实现加载 `/api/prompt` 的 111 字废文，与 `resetPrompt` 功能重复。已删除按钮+函数 |
| 提示词文本修复 | `surongrong.json` 三处歧义文本消歧（压力→压力值、自动放宽为（≥95）→自动放宽（≥95）等） |
| PWA 描述 | `manifest.json` + `package.json` → **互动叙事 · 苏蓉蓉** |
| PWA 图标 | `icon-192.png` + `icon-512.png` 四角切圆角（18% 半径）|
| 浏览器图标 | favicon 从铃兰 SVG（看着像一根草）→ 苏蓉蓉大头照 `icon-192.png` |
| PWA 手动按钮 | 设置底部：🔄检查更新（强制 SW 拉新版+刷新）/ 📲安装到桌面（按平台给引导） |
| 帮助面板 | 全面重写，去冗余（不列固定数目/具体结局），覆盖 v9.7–v9.8 所有新特性 |

> **以后需要全量清缓存**：`init.js` 顶部 `APP_DATA_VERSION` 从 `4` 改成 `5`，推送即生效。

---

## 🔍 审查清单（按功能域，非按 Phase）

> 以下每一项都需要在新会话中逐条检查。勾选 = 已验证通过。

### A. 游戏核心循环
- [ ] **新游戏启动**：点"进入故事"→ 序章弹窗 → 开始 → 第1回合 AI 正常回复（结算+现状+4选项+状态字段）
- [ ] **initialState 激活**：F12 → `gameState.fieldHistory` → 确认初始值来自 `surongrong.json:initialState`（压力值10、暴露风险5、梦红尘好感20等），而非全 0
- [ ] **选项交互**：点击选项按钮 / 键盘 1-4 → 正常触发 `handleChoice` → `sendMessage` → 下回合
- [ ] **代价沉重**：选了标注 `【代价沉重】` 的选项 → 弹出确认框 → 确认后才发送
- [ ] **力不能及**：资源不够时 → 选项灰显禁用
- [ ] **流式输出**：AI 回复实时显示，带闪烁光标，`[场景类型]` `[事件大小]` 自动剥离
- [ ] **故事框截断**：超 20 回合 → 显示截断提示 "仅显示最近20回合"
- [ ] **加载状态**：请求中 loading 动画 + "第X回合·已等待Xs"；请求可取消

### B. 结局 / 命运转折系统
- [ ] **AI 主动触发**：数值达标 → AI 输出 `【命运转折·XXX】` → 弹窗展示（图标自动匹配、叙事、回合数、成就数、最终字段）
- [ ] **客户端硬兜底**：AI 未触发但条件满足 → 客户端注入标记 → 弹窗
- [ ] **独立 system 消息注入**：F12 Network → `/api/chat` 请求体 → 确认结局指令在独立的 `{role:'system'}` 中，不在 user 消息内
- [ ] **结局去重**：同一结局不重复弹窗（`triggeredEndings` 数组）
- [ ] **结局后继续**：关闭弹窗 → fullHistory 有 `【系统通知】命运转折「XXX」已触发` → 下一回合 AI 正常回复
- [ ] **结局标记修复**：编辑提示词删除结局标记 → 保存时弹警告 → `repairEndingSection` 自动从 `_originalTemplate` 恢复
- [ ] **旧标记兼容**：所有检测函数同时兼容 `【游戏结束·XXX】` 和 `【命运转折·XXX】` 格式
- [ ] **测试**：`node tests/ending-system.test.js` → 56/56 ✓

### C. 提示词 / 模板编辑
- [ ] **打开设置**：`openSettings` 合并编辑版（不串档），只显示 promptBody 正文
- [ ] **保存提示词**：`savePrompt` → 字段引用校验（扫描 `字段名≥数字` 与 outputSections 比对，子串智能放过）→ 结局标记完整性检查 → 持久化到 `xixi_edited_template_{id}`
- [ ] **字段引用子串放过**：候选标签是真实字段真子串时自动放过（如"压力"⊆"压力值"），不弹误报警告
- [ ] **恢复默认**：`resetPrompt` → 多选弹窗 → **从服务器强制拉取最新模板**（离线时回退内存快照）→ 更新 `_originalTemplate`
- [ ] **字段编辑器**：`renderFieldEditor` 正常渲染 → 图标仅按钮可见（input 为 hidden）→ 添加/删除字段正常
- [ ] **添加字段**：`addField` → 7步弹窗链（区段→ID→标签→图标→类型→叙事含义必填→软阈值可选）→ 字段定义追加到 promptBody
- [ ] **保存字段**：`saveFields` → 字段标签改名 → 扫描 promptBody 中旧标签 → 确认后替换；游戏中编辑弹警告
- [ ] **字段 ID 迁移**：仅等长+单ID重命名+无冲突时自动迁移 fieldHistory
- [ ] **游戏中编辑警告**：游戏进行中 → `saveFields` / `savePrompt` 均弹确认
- [ ] **设置底部按钮**：🔄检查更新（强制SW拉新版+刷新）/ 📲安装到桌面（按平台引导）

### D. 成就系统
- [ ] **可见成就**：数值达标自动解锁 → toast 弹窗 + 成就面板显示
- [ ] **隐藏成就**：添加时可选择 6 种 trigger 类型（choice/gambit/rounds_under/field_zero/field_max_under/response_match）→ 各类型专属参数输入
- [ ] **双守卫**：首回合跳过检测 / 读档时跳过检测
- [ ] **成就面板**：可见+隐藏分开展示，编辑/删除按钮正常

### E. 存档 / 继续游戏
- [ ] **新游戏确认**：`selectSave` → 有进度时弹确认窗（含槽位数+回合数）→ 取消回到选择页
- [ ] **自动存档**：每回合自动保存到槽位 0
- [ ] **手动存档**：Ctrl+S → 轮转槽位 1-9 → 满槽弹覆盖确认
- [ ] **继续游戏**：多槽位扫描 → 选择 → 渲染最后一回合（`_loadingSave` 守卫跳过成就/结局重触发）
- [ ] **槽位管理**：继续游戏输入 `X1` 删单槽 / `XA` 清全部
- [ ] **撤销**：Ctrl+Z → `undoLastRound` → 回退到上一回合
- [ ] **历程回顾**：`renderHistoryModal` 正常显示完整对话历史
- [ ] **导出故事**：`exportStory` 含成就摘要/结局信息/最终状态

### F. AI 指令系统
- [ ] **发送指令**：AI 聊天框输入 → 下回合生效 → 去重累加
- [ ] **按存档隔离**：切换存档 → AI 指令列表各自独立（`xixi_ai_instructions_{id}`）
- [ ] **前端拦截**：破限/内容越界关键词 → 输入被拦截不发送
- [ ] **合并到提示词**：`mergeInstructionsToPrompt` → 警告不可撤销 → 合并后清空指令列表

### G. 酒馆分享
- [ ] **上传清理**：运行时属性（`_preEditFields`/`_originalTemplate`）自动删除；`【玩家补充规则】` 残留检测并警告
- [ ] **版本号**：每次上传 `version` patch+1
- [ ] **自定义图片打包**：上传时询问是否包含 Base64 图片
- [ ] **导入**：正常导入 → 切到"我的模板"→ 询问是否立即开始
- [ ] **管理**：管理员登录 → 删除/备份/恢复

### H. 主题 / UI
- [ ] **11 套主题**：逐一切换 → 颜色/照片框/粒子特效/选项 hover 正常
- [ ] **sunset 移动端**：480px 宽度 → 顶部栏按钮不换行
- [ ] **模板 vs 存档命名**：标签页"我的模板"、按钮"创建新模板"、表单"模板名称"——与"存档槽位 1-9"区分清晰
- [ ] **字段图标**：字段编辑器每行仅一个图标按钮可见，无重复显示
- [ ] **字体切换**：10 套系统字体栈按存档隔离
- [ ] **音效三态**：🔉全部 → 🔔仅UI → 🔇静音 循环

### I. 数据安全 / 状态隔离
- [ ] **AI 指令隔离**：`LS_KEYS.aiInstructions(id)` — 不同存档不串
- [ ] **自定义图片隔离**：`LS_KEYS.customImages(id)` — 不同存档不串
- [ ] **API Key XOR 加密**：`_readApiKey`/`_writeApiKey` 正常加解密
- [ ] **管理员验证**：SHA-256 验证，不存明文密码
- [ ] **CSP**：无 `unsafe-eval`
- [ ] **XSS**：字段标签/值/图标均 `escapeHtml`

### J. 服务端
- [ ] **模板生成**：`POST /api/generate-prompt` → 正常生成 JSON → 含难度参数
- [ ] **故事解析**：`POST /api/parse-story` → 粘贴故事文本 → 返回模板 JSON
- [ ] **对话摘要**：消息格式化为自然对话（非 JSON）→ 正常返回摘要
- [ ] **Token 估算**：长对话自动触发摘要（消息数或 token>80K）
- [ ] **buildSystemPrompt 同步**：server.js 和 utils.js 逻辑一致（含 ⚠ 同步注释）
- [ ] **repairEndingSection 同步**：两端均支持逐标记验证 + 新旧格式兼容

### K. 难度选择（Phase 11 新增）
- [ ] **创建表单**：简单/标准/困难/噩梦 4 个 chip，默认标准
- [ ] **表单自动保存/恢复**：切换页面后难度选择保留
- [ ] **metaPrompt**：`【难度调整】` 章节根据难度给出不同参数（NPC敌意/资源量/代价/命运转折门槛）

### L. 自动化测试
- [ ] `node test.js` → 74/76（2 失败 = utils.js+core.js 括号计数误报，已知）
- [ ] `node tests/ending-system.test.js` → 56/56 ✓
- [ ] 浏览器诊断：F12 → `fetch('/js/test.js').then(r=>r.text()).then(eval)`

---

## 当前已知问题

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| 1 | `test.js` utils.js + core.js 括号平衡检查失败 | 低（误报） | 已知，正则中的 `[]` 被朴素计数法误判 |
| 2 | server.js 和 utils.js 的 buildSystemPrompt / repairEndingSection 代码重复 | 中（维护风险） | 已加 ⚠ 同步注释，未做物理去重 |
| 3 | 函数名未同步重命名（detectEnding/buildEndingInjection 等仍用旧名"Ending"） | 低（技术债） | 内部逻辑已升级，仅函数名未改 |
| 4 | 多槽位存档选择用文本输入而非可点击卡片 | 低（UX） | 功能正确，体验待优化 |
| 5 | 自动存档 localStorage 满时静默失败 | 低 | 手动存档时弹提示 |
| 6 | Chrome `beforeinstallprompt` 装过又删后会限流，按钮无法触发安装 | 低（浏览器限制） | 已按平台给出菜单手动安装引导 |
| 7 | `prompt.txt` 111字通用兜底已无实际用途（多模板架构） | 低 | `/api/prompt` 仅 init.js 和 server.js 保留，未清理 |

---

## 文件结构

```
xixi/
├── server.js              # Express 后端 + API 代理 + 模板生成 + 酒馆 + metaPrompt + parse-story
├── prompt.txt             # 服务端后备提示词（5行通用兜底）
├── package.json           # cors/dotenv/express + dev:sharp（图标生成）
├── render.yaml            # Railway 部署配置
├── CLAUDE.md              # 本文件（项目文档 + 审查清单）
├── 优化方案.md             # 14 章节完整施工图（47+ 问题）
├── PROGRESS.md            # 11 个 Phase 详细进度跟踪
├── test.js                # 自动化测试（node test.js — 75项检查）
├── tests/
│   └── ending-system.test.js  # 结局系统测试（54 用例）
├── templates/             # 模板存储
│   ├── surongrong.json    #   默认模板：苏蓉蓉·潜伏 v2.1（AI标准生成+手工精修）
│   ├── custom_*.json      #   AI 生成的用户自创模板
│   └── shared/            #   酒馆分享数据（运行时创建，git不追踪）
├── themes/                # CSS 主题（10套）
│   ├── theme-forest.css   #   🌿 森林 v3
│   ├── theme-xianxia.css  #   🏯 修仙 v2
│   ├── theme-cyber.css    #   💜 赛博 v2
│   ├── theme-sakura.css   #   🌸 樱花 v5
│   ├── theme-ocean.css    #   🌊 深海 v2
│   ├── theme-sunset.css   #   🌅 日落 v2
│   ├── theme-midnight.css #   🌃 子夜 v2
│   ├── theme-monochrome.css # ⬜ 黑白 v2
│   ├── theme-golden.css   #   ✨ 鎏金 v2
│   └── theme-light.css    #   ☀ 明亮 v2
└── public/                # 前端静态文件
    ├── index.html         #   主页面
    ├── style.css          #   基础样式（变量驱动，暗色主题）
    ├── sw.js              #   Service Worker v10（网络优先，API请求跳过缓存）
    ├── manifest.json      #   PWA 清单（Lily of the Valley / 铃兰）
    ├── *.png              #   场景图片
    └── js/                #   前端模块（13文件，按顺序加载）
        ├── state.js       #     全局状态 / DOM引用 / 常量 / LS_KEYS / API Key加解密
        ├── utils.js       #     工具函数 / buildSystemPrompt / 结局全流程 / extractAllFields
        ├── dialogs.js     #     自定义对话框 + Emoji选择器
        ├── saves.js       #     存档管理 / 成就存储隔离
        ├── ui.js          #     界面渲染 / 资源检测 / 主题 / 场景图 / selectSave
        ├── achievements.js #    成就系统 / checkAchievementsFromState / trigger编辑器
        ├── prompts.js     #     提示词管理 / 图片管理 / 主题选择 / 字体选择
        ├── templates.js   #     模板加载/创建 / 字段编辑器 / AI生成
        ├── tavern.js      #     酒馆分享 / 上传清理 / 导入导出
        ├── ai.js          #     AI实时指令（按存档隔离）
        ├── audio.js       #     Web Audio 合成音效 + 主题氛围（v3）
        ├── core.js        #     游戏核心循环 / sendMessage / 结局预检 / 硬兜底 / 摘要
        ├── init.js        #     事件绑定 / 启动 / 状态栏编辑 / 全局音效委托
        └── test.js        #     浏览器端结局诊断脚本
```

## JS 模块加载顺序

```
state → utils → dialogs → saves → ui → achievements
  → prompts → templates → tavern → ai → audio → core → init
```

每个模块用 `function` 声明全局函数。index.html 中 13 个 `<script>` 标签按此顺序加载。

## 关键函数速查

| 函数 | 文件 | 用途 |
|------|------|------|
| `sendMessage(userContent)` | core.js | 主消息发送入口 |
| `_prepareMessages(userContent)` | core.js | 构建消息数组（指令+骰子+结局预检） |
| `_streamResponse(resp, liveEl)` | core.js | SSE 流式读取+实时预览 |
| `_handleParsedResponse(...)` | core.js | 解析AI回复+结局检测+渲染+存档 |
| `handleChoice(num)` | core.js | 选项点击→代价沉重确认→sendMessage |
| `startNewGame()` | core.js | 新游戏：读 initialState → 初始化 → 发开局消息 |
| `continueGame(saveId)` | core.js | 多槽位继续游戏 |
| `buildSystemPrompt(template)` | utils.js | 构建完整系统提示词（格式+法则+正文+状态快照） |
| `buildStatusSnapshot(fields)` | utils.js | 生成当前字段值快照 |
| `detectEnding(text)` | utils.js | 正则检测 AI 回复中的 `【命运转折·XXX】` |
| `collectEligibleEndings(template)` | utils.js | 收集所有条件达标的结局 |
| `selectBestEnding(eligible, template)` | utils.js | 从达标结局中择优（去重+轮次优先+关系优先） |
| `checkEndingClientSide(template)` | utils.js | 结局预检主入口 |
| `buildEndingInjection(endingName, template)` | utils.js | 生成结局指令（独立 system 消息） |
| `repairEndingSection(body, origTpl)` | utils.js | 逐标记验证+修复结局章节 |
| `extractAllFields(text, allFields)` | utils.js | 批量字段提取（倒序+matched锁） |
| `updateFieldHistoryFromParsed(parsed)` | achievements.js | 从解析结果更新 fieldHistory |
| `checkAchievementsFromState(parsed)` | achievements.js | 可见成就检测（双守卫） |
| `checkHiddenAchievements(parsed)` | achievements.js | 隐藏成就检测 |
| `getAiInstructions()` | ai.js | 读取当前存档的 AI 指令 |
| `saveAiInstructions(instructions)` | ai.js | 写入当前存档的 AI 指令 |
| `loadAndMergeTemplate(saveId)` | saves.js | 加载模板+合并编辑版 |
| `selectSave(saveId)` | ui.js | 选择存档：进度确认→清除旧档→序章→等待开始 |
| `renderFieldEditor()` | templates.js | 渲染字段编辑器（icon hidden input） |
| `saveFields()` | templates.js | 保存字段（class选择器+改名扫描+编辑警告） |
| `addField()` | templates.js | 添加字段（叙事含义必填+软阈值） |
| `savePrompt()` | prompts.js | 保存提示词（字段引用校验+结局标记检查+编辑警告） |
| `resetPrompt()` | prompts.js | 恢复原始设定（多选范围） |
| `addNewAchievement(isHidden)` | achievements.js | 添加成就（隐藏含6种trigger编辑器） |
| `uploadToTavern(saveId)` | tavern.js | 上传酒馆（清理+版本+图片打包） |
| `validateAndRepairTemplate(tpl)` | utils.js | **v9** 模板结构校验修复（outputSections/字段/endings/achievements） |
| `parseEndingsFromPromptBody(text)` | utils.js | **v9** 从旧 promptBody 迁移命运转折到结构化数组 |
| `generateEndingsSection(endings)` | utils.js | **v9** 从 endings 数组生成【命运转折系统】章节 |
| `renderEndingsPanel()` | templates.js | **v9** 命运转折编辑面板渲染 |
| `addEnding()` | templates.js | **v9** 添加命运转折（弹窗引导） |
| `editEnding(index)` | templates.js | **v9** 编辑命运转折 |
| `deleteEnding(index)` | templates.js | **v9** 删除命运转折 |
| `saveEndingsToTemplate(tpl)` | templates.js | **v9** 持久化 endings 到 localStorage |
| `toggleParseStoryPanel()` | templates.js | **v9** 展开/收起AI解析故事面板 |
| `parseStoryToTemplate()` | templates.js | **v9** 调用 /api/parse-story 并填充表单 |

## localStorage Key 规范

| Key | 用途 | v8 变更 |
|-----|------|---------|
| `xixi_gamesave_{id}` | 自动存档（槽位0） | |
| `xixi_gamesave_{id}_{slot}` | 手动存档（槽位1-9） | |
| `xixi_edited_template_{id}` | 编辑版模板 | |
| `xixi_achievements_{id}` | 已解锁成就 | |
| `xixi_theme_{id}` | 主题选择 | |
| `xixi_font_{id}` | 字体选择 | |
| `xixi_saves` | 用户自创模板列表 | |
| `xixi_apikey` | API Key（XOR加密） | |
| `xixi_ai_instructions_{id}` | AI指令队列 | **v8 改为 function(id)** |
| `xixi_custom_images_{id}` | 自定义场景图片 | **v8 改为 function(id)** |
| `xixi_create_save_form` | 创建表单自动保存 | |
| `xixi_generated_template` | AI生成的模板缓存 | |
| `xixi_age_verified` | 12+警告已确认 | |
| `xixi_last_save_id` | 上次游玩的模板ID | |
| `xixi_active_template_id` | 当前活动模板ID | |
| `xixi_last_manual_slot_{id}` | 上次手动存档槽位号 | |
| `xixi_data_version` | 数据版本号，升级时自动清缓存 | **v9.8 新增** |

## 结局检测正则（兼容格式）

- `【命运转折·XXX】` — 全角括号+中点（新标准）
- `【游戏结束·XXX】` — 旧格式（向后兼容）
- `【命运转折：XXX】` — 冒号变体
- `[命运转折·XXX]` — 半角括号变体
- 有空格/破折号等微调变体均兼容

## 部署前检查

Railway `git push` 会清空文件系统 → 酒馆共享数据丢失。

1. 打开线上版 → 酒馆 → 🔑 管理员登录 → 📥 备份 `tavern_backup.json`
2. `git add -A && git commit -m "..." && git push origin master`
3. 部署完成后 → 📤 恢复上传备份

## 启动与测试

```bash
npm start                  # → http://localhost:3000
node test.js               # 76项检查（2项括号误报已知）
node tests/ending-system.test.js  # 56项结局测试
```

浏览器诊断：
```js
fetch('/js/test.js').then(r => r.text()).then(eval)
```

## 维护要点

- **状态一致性**：`renderStatusContainers()` 后必须 `updateAllDynamicFieldsFromHistory()`
- **`??` 而非 `||`**：`updateAllDynamicFields` 用空值合并，防数值 0 显示为"—"
- **LS_KEYS 集中管理**：禁止硬编码 `'xixi_'` 字符串
- **server.js ↔ utils.js 同步**：修改 buildSystemPrompt / repairEndingSection 时两端同步
- **SW 版本号**：修改 `sw.js` 时必须同步 `test.js` 版本检查 + `CLAUDE.md` 版本引用
- **APP_DATA_VERSION**：需要全量清缓存时 bump `init.js` 顶部 `APP_DATA_VERSION`（当前 v4 → 改 v5）
- **prompt.txt**：服务端后备，非必要不改
- **surongrong.json**：默认模板，修改后必须同步 `tests/ending-system.test.js` 字段名和结局名
- **PWA 图标**：修改 `icon-192.png`/`icon-512.png` 用 `npx sharp` 重切；修改 `icon.svg` 注意保持矢量格式
- **部署前备份酒馆**：`git push` 前必须提醒用户备份 `templates/shared/`

---

## 默认模板速查（surongrong.json v2.1）

### 字段（10个）

| 区段 | id | label | icon | 范围 |
|------|-----|-------|------|------|
| 状态栏 | `stress` | 压力值 | 💔 | 0-100 |
| 状态栏 | `exposure` | 暴露风险 | 🚨 | 0-100 |
| 状态栏 | `soulState` | 魂力状态 | ✨ | 文本 |
| 任务行 | `round` | 轮次 | 🔄 | 数字 |
| 任务行 | `infiltration` | 潜伏进度 | 🎯 | 0-5 |
| 资源 | `intel` | 情报碎片 | 📜 | 0-10 |
| 资源 | `blackmail` | 把柄 | 🔑 | 0-10 |
| 关系 | `mengHaoGan` | 梦红尘好感 | 👑 | -100~100 |
| 关系 | `xiaoTaiDu` | 笑红尘态度 | ⚔️ | -100~100 |
| 关系 | `shenglingjiao` | 圣灵教觊觎 | 👁️ | -100~0 |

### 命运转折（6个）

| icon | 名称 | 条件 |
|------|------|------|
| 💔 | 月光和六便士 | 压力值≥95 |
| 🚨 | 枯萎之刻 | 暴露风险≥95 |
| 🏆 | 归乡 | 情报碎片≥5 且 暴露风险≤50 且 轮次≥8 |
| 🏃 | 暮去朝来 | 情报碎片≥3 且 暴露风险≤30 且 轮次≥6 |
| 🕵️ | 红尘庇佑 | 把柄≥5 且 梦红尘好感≥70 且 暴露风险≤30 |
| 🍜 | 凉面派 | 轮次≥15 且 潜伏进度≥3 |

### 可见成就（10个）

情报拼图📜 / 近朱者赤👑 / 潜行大师👁️ / 把柄收藏家🔑 / 钢丝上的舞者💔 / 铁壁意志🛡️ / 学长的肯定⚔️ / 圣灵教之影🌀 / 潜伏精英🎯 / 情报网🕸️

### 隐藏成就（5个）

初次暗语🤫(choice) / 赌徒之心🎲(gambit) / 闪电撤离⚡(rounds_under) / 净身出户✨(field_zero) / 崩溃边缘💀(field_max_under)

### PWA

| 属性 | 值 |
|------|-----|
| name | Lily of the Valley |
| short_name | Lily of the Valley |
| iOS title | Lily of the Valley |
| 浏览器标题 | 互动叙事 · 苏蓉蓉 |
| icon-192.png | 苏蓉蓉大头照 192×192（圆角 r=34px） |
| icon-512.png | 苏蓉蓉大头照 512×512（圆角 r=90px） |
| icon.svg | 铃兰矢量图 512×512 |
