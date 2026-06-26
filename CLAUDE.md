# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义存档。每个存档使用独立的提示词、UI 字段、场景图片和主题。

**在线版**：部署在 Railway → `xixi-fable.up.railway.app`
手机电脑浏览器打开即玩，无需安装任何东西。

## v4 更新记录（2026-06-26）

### 代码质量 — 68+ bug 修复
- `LS_KEYS` 集中管理全部 16 个 localStorage key
- `safeSetItem()` 统一存储满处理
- `loadAndMergeTemplate()` 消除 selectSave/continueGame ~45 行重复
- `sendMessage` 拆为 `_prepareMessages` / `_streamResponse` / `_handleParsedResponse`
- `bindOverlayClose()` 消除 8 处 overlay 关闭重复
- `window.XIXI` 命名空间 + 13 模块加载顺序校验 + test.js 跨模块命名冲突检查
- 服务端删除 client systemPrompt 快速路径，始终用服务端构建
- 管理员密码脱敏 → `/api/admin/verify` SHA-256 验证
- `prompt.txt` 精简为 5 行通用兜底
- 3 处 XSS（字段标签/值/图标 `escapeHtml`）+ 3 处 JSON.parse 加 try-catch

### 结局系统重写
- `repairEndingSection` 负向前瞻跳过内部 `【游戏结束】` 标记
- `collectEligibleEndings` 遍历所有括号取第一个合法条件
- 条件窗口 500→200 字符（防跨结局误判）
- `=100` 放宽为 `≥95`（AI 压 99 也能触发）
- 结局弹窗移到 `triggeredEndings` 守卫内 + 硬兜底不再提前 push
- `_loadingSave` 守卫防读档重弹
- **结局指令从 system 消息移到用户消息末尾** — AI 无法忽视
- 结局成就自动解锁改为遍历所有匹配项

### 游戏体验
- **客户端掷骰**：高风险 50% / 孤注 30%，`Math.random()` 真随机
- 骰子指令覆盖所有规则，强制 AI 改 3+ 项数值
- 第 1 回合计数修正 + 首回合隐藏空结算框
- 流式输出加滚动容差 + `beforeunload` 始终提醒
- Ctrl+S 快速存档 / Ctrl+Z 撤销 / `manualSave` 加 `isLoading` 守卫

### 美学 v2
- 数值变化绿涨红跌闪烁 + 故事时间线金点连线
- 按钮涟漪 / 场景 Ken Burns 慢速缩放 / 加载呼吸动画
- 成就弹跳+金光 / 卡片悬浮上浮 / 滚动条美化

### PWA + 移动端
- 安装引导横幅 + SVG 矢量图标
- SW 补全 10 主题 CSS + HTTP 错误回退缓存
- 横幅 `position: fixed`（不挤占游戏空间）
- iOS 输入框 16px + 触控目标增大 + `dvh` 单位

---

## 文件结构

```
xixi/
├── server.js              # Express 后端 + API 代理 + 模板API + 酒馆API + metaPrompt
├── prompt.txt             # 服务端后备提示词（5行通用兜底）
├── package.json           # 3个依赖：cors/dotenv/express
├── render.yaml            # Railway 部署配置
├── CLAUDE.md              # 本文件
├── test.js                # 自动化测试（node test.js — 75项检查）
├── templates/             # 模板存储
│   ├── surongrong.json    #   默认模板：苏蓉蓉·潜伏（手工模板，慎改）
│   ├── custom_*.json      #   AI 生成的用户自创模板
│   └── shared/            #   酒馆分享数据（运行时创建，git不追踪）
├── themes/                # CSS 主题（10套）
│   ├── theme-forest.css   #   🌿 森林
│   ├── theme-xianxia.css  #   🏯 修仙
│   ├── theme-cyber.css    #   💜 赛博
│   ├── theme-sakura.css   #   🌸 樱花
│   ├── theme-ocean.css    #   🌊 深海
│   ├── theme-sunset.css   #   🌅 日落
│   ├── theme-midnight.css #   🌃 子夜
│   ├── theme-monochrome.css # ⬜ 黑白
│   ├── theme-golden.css   #   ✨ 鎏金
│   └── theme-light.css    #   ☀ 明亮
├── public/                # 前端静态文件
│   ├── index.html         #   主页面（含内联 SVG favicon）
│   ├── style.css          #   基础暗色主题样式（变量驱动）
│   ├── sw.js              #   Service Worker（v6，网络优先，只缓存GET 200）
│   ├── manifest.json      #   PWA 清单
│   ├── *.png              #   场景图片
│   └── js/                #   前端模块（13文件，按依赖顺序加载）
│       ├── state.js       #     全局状态/DOM引用/常量
│       ├── utils.js       #     工具函数/提示词构建/结局检测/结局预检与择优/结局指令生成
│       ├── dialogs.js     #     自定义对话框+Emoji选择器
│       ├── saves.js       #     存档管理+成就存储隔离
│       ├── ui.js          #     界面渲染/资源检测/主题/场景图
│       ├── achievements.js #    成就系统(双守卫防误触发)
│       ├── prompts.js     #     提示词管理(合并非替换防串档+保存前结局校验)
│       ├── templates.js   #     模板加载/创建/字段编辑器(ID迁移)
│       ├── tavern.js      #     酒馆分享
│       ├── ai.js          #     AI实时指令
│       ├── audio.js       #     Web Audio 合成音效+主题氛围（v2:统一路由/null安全/柔化音色）
│       ├── core.js        #     游戏核心循环+结局预检+硬兜底
│       ├── init.js        #     事件绑定/启动/_originalTemplate初始化/全局音效委托
│       └── test.js        #     浏览器端结局诊断脚本
└── 启动游戏.bat           # 本地开发启动
```

## 启动方式

```bash
npm start                  # → http://localhost:3000
node test.js               # 自动化测试（75项，core.js/utils.js括号告警为已知误报）
```

浏览器诊断（结局问题排查）：
```js
fetch('/js/test.js').then(r => r.text()).then(eval)
```

## JS 模块加载顺序

```
state → utils → dialogs → saves → ui → achievements
  → prompts → templates → tavern → ai → audio → core → init
```

每个模块用 `function` 声明全局函数。纯数据模块（state）用 `const`/`let`。index.html 中 13 个 `<script>` 标签按此顺序加载。

## ⚠️ 部署前必做：备份酒馆

Railway 每次 `git push` 部署会清空文件系统，酒馆共享数据（`templates/shared/`）会丢失。
**推代码前**必须提醒用户备份酒馆：

1. 打开 `https://xixi-fable.up.railway.app` → 酒馆标签 → 🔑 管理员登录
2. 📥 备份下载 `tavern_backup.json`
3. git push 部署
4. 部署完成后 → 📤 恢复上传备份

```bash
git add -A && git commit -m "描述" && git push origin master
# Railway 自动部署，等待 1-2 分钟
```

---

## 结局系统（四层架构）v3

结局触发采用四层递进机制。结局触发后弹窗展示，玩家可点"继续游戏"关闭弹窗继续游玩——结局不等于游戏结束。

### 第0层：预检注入（`core.js` → `sendMessage()`，发请求前）

**v3 新增**。在发送请求给 AI 之前，先跑 `checkEndingClientSide()` 预检。如果条件满足：

1. `collectEligibleEndings()` 收集所有条件达标的结局
2. `selectBestEnding()` 过滤已触发过的结局（`triggeredEndings`），按严格度择优：
   - 轮次要求高的优先 → 轮次相同优先含关系条件（好感/态度）的 → 都相同按模板出现顺序
3. `buildEndingInjection()` 从模板 `promptBody` 提取该结局的叙事描述文本
4. 生成具体结局指令，作为独立 system 消息**追加到消息数组末尾**（确保 AI 看到）

### 第1层：AI 主动触发（主要机制）

`utils.js` → `buildSystemPrompt()` 构建系统提示词时：

1. **叙事法则**告诉 AI："严格按照下方【结局系统】中定义的条件判断。一旦数值达标立即触发结局"
2. **repairEndingSection()** 逐标记验证结局章节完整性后再构建
3. **状态快照**（`buildStatusSnapshot()`）每回合把当前字段值注入提示词末尾
4. AI 看到条件+当前值，主动输出 `【游戏结束·结局名】` → `detectEnding()` 捕获 → `showEndingOverlay()`

### 第2层：客户端硬兜底（`utils.js` → `checkEndingClientSide()`）

AI 回复后调用。如果 AI 未触发但条件满足：
1. 注入 `【游戏结束·XXX】` 到响应
2. 从模板提取结局叙事描述作为兜底叙事（而非显示无关的 AI 文本）
3. 记录到 `achievementFlags.triggeredEndings` 防止重复触发

### 第3层：自动修复（`utils.js` → `repairEndingSection()`）v2

`buildSystemPrompt()` 中调用。**v2 改為逐标记验证**：提取原始模板中所有 `【游戏结束·XXX】` 标记，逐一核对是否在编辑版中存在。缺任意一个即从 `_originalTemplate` 恢复完整结局章节。

### 结局去重

`gameState.achievementFlags.triggeredEndings: []` — 记录已触发结局名列表。每个结局在单存档内只弹窗一次。兼容旧存档（无此字段时自动初始化为空数组）。新游戏重置，继续游戏从存档恢复。

### 结局择优规则（`selectBestEnding()`）

多结局同时达标时：
1. 过滤已触发过的（`triggeredEndings`）
2. 按轮次要求降序（轮次高的更严格）
3. 轮次相同 → 含关系条件（好感/态度）的优先
4. 都相同 → 模板出现顺序

### key functions map

| 函数 | 文件 | 用途 |
|------|------|------|
| `collectEligibleEndings(template)` | utils.js | 收集所有条件达标的结局 |
| `selectBestEnding(eligible, template)` | utils.js | 从达标结局中选最优 |
| `checkEndingClientSide(template)` | utils.js | 主入口：返回应触发的最佳结局名 |
| `buildEndingInjection(endingName, template)` | utils.js | 从模板提取结局描述，生成具体叙事指令 |
| `repairEndingSection(body, originalTemplate)` | utils.js | 逐标记验证+修复结局章节 |
| `detectEnding(text)` | utils.js | 从 AI 回复中检测结局标记 |

### 结局检测正则（`utils.js` → `detectEnding()`）

兼容多种 AI 可能输出的格式变体：
- `【游戏结束·结局名】` — 全角括号+中点分隔（标准）
- `【游戏结束：结局名】` — 全角括号+冒号
- `【游戏结束 结局名】` — 无分隔符
- `[游戏结束·结局名]` — 半角括号（AI偶尔混淆）
- `【游戏结束 · 结局名】` — 分隔符前后有空格

### 常见结局故障排查

1. **结局章节被截断**：`repairEndingSection` v2 会自动检测并修复。控制台会打印缺失的结局标记
2. **结局已触发但不再弹窗**：检查 `gameState.achievementFlags.triggeredEndings` — F12 执行 `gameState.achievementFlags.triggeredEndings = []; saveGameState();` 重置
3. **结局叙事不匹配**：确认模板 `promptBody` 中该结局有具体叙事描述（1-2句）。`buildEndingInjection` 依赖此描述生成指令
4. **字段名不匹配**：诊断脚本会列出结局条件引用的字段 vs 模板实际定义的字段。确保条件中使用的字段 label 在 `outputSections` 中存在
5. **模板文件损坏**：`node -e "var t=JSON.parse(require('fs').readFileSync('templates/surongrong.json','utf8')); console.log(t.promptBody.indexOf('【结局系统】'))"` → 若返回 -1 则文件损坏需修复

---

## 核心功能

### 游戏循环
- 回合制互动叙事：AI输出"上回合结算→现状→4选项→状态字段"
- 选项按钮 + 键盘1-4快捷键（弹窗/输入框激活时自动禁用）
- 故事框累积显示所有回合（带回合标签，最多20回合，超出显示截断提示）
- 加载时显示"第X回合·已等待X秒"
- 资源不足选项灰色禁用——检测全部字段区段（不仅resources）
- 流式输出带闪烁光标 `▌`，自动剥离格式标记 `[场景类型]` `[事件大小]`，超800字截断

### AI交互
- AI小窗输入指令，下回合生效
- 指令写入promptBody末尾【玩家补充规则】段，自动去重累加
- AI回复格式异常时自动重试一次（结局回复允许无选项）
- 60秒超时，超时显示重试按钮
- 请求可手动取消（✕ 取消按钮）

### 存档系统
- 自动存档（槽位0）：`xixi_gamesave_{id}`
- 手动存档（槽位1-9）：`xixi_gamesave_{id}_{slot}`
- 继续游戏多槽位选择
- 新游戏和继续游戏均加载编辑版模板（`xixi_edited_template_{id}`）
- 🗑清档 / ✕删除模板 / ↩️撤销上一步

### 成就系统
- 可见成就 + 隐藏成就（❓未知→达成揭示）
- 双守卫防误触发：首回合跳过 + 读档时跳过
- 按模板ID隔离存储，跨新游戏保留

### 提示词管理
- 设置页编辑promptBody（仅正文，不含格式模板）
- 💾保存前自动检测结局标记完整性——如有缺失弹出警告
- 💾保存到 `xixi_edited_template_{存档ID}`
- openSettings合并编辑（非整体替换，防串档）
- ↩恢复原始提示词（恢复到 `_originalTemplate.promptBody`）

### 结局弹窗
- 结局图标自动匹配（根据结局名中的关键词选emoji）
- 展示：结局名/叙述/回合数/成就解锁数/最终字段值
- 三个按钮：重新开始/返回存档/继续游戏

### 酒馆系统
- 酒馆列表 + 🔍实时搜索 + 📥导入 + ☁分享
- 🔑管理员：删除/📥备份下载/📤恢复上传

### 主题系统
- 11套主题（dark默认 + 10套CSS主题）
- 主题按存档隔离存储
- CSS变量驱动，主题文件只覆盖 `:root` + 特定元素

### 音效系统（`audio.js` v2）

**Web Audio API 合成，无外部音频文件。**

**用户手势门控**：`_safeCtx()` 在用户首次交互前返回 null，避免浏览器 Autoplay Policy 警告。

**UI 音效**：
- `playClick()` — 游戏选项点击：1200→900Hz 正弦，0.05s，明亮短促（区别于一般UI按钮）
- `playUIClick()` — 通用UI按钮：600Hz 正弦，0.04s，极轻咔嗒
- `playAchievement()` — 成就解锁：C-E-G 大三和弦，三角波
- `playError()` — 错误提示：150→80Hz 三角波下行，柔和（v2 替代刺耳锯齿波）

**全局音效委托**（`init.js`）：一条 `document.addEventListener('click', ...)` + `closest('button')` 覆盖所有按钮（含动态创建的），自动排除选项按钮和音效开关。键盘 1-4 也调用 `playClick()`。

**主题氛围**（v2 全部统一路由到 `_ambientGain`，基准增益 0.02）：
| 主题 | 音色 | 说明 |
|------|------|------|
| 🌿 forest | 400Hz lowpass 白噪声，Q=0.5 | 柔和宽带风吟 |
| 🌊 ocean | 200Hz lowpass + 0.1Hz LFO | 低频潮汐涨落 |
| 💜 cyber | 55Hz sawtooth → 150Hz lowpass | 科技感低嗡 |
| 🏯 xianxia | 65+98Hz 五度pad + 稀疏柔铃 | 温暖修仙氛围（替代刺耳高频风铃）|
| 🌃 midnight | 55Hz sine + 0.05Hz LFO | 宇宙呼吸感（替代28Hz不可闻频率）|
| ✨ golden | 110Hz + 165Hz 五度泛音 | 金属共鸣 |
| 🌸 sakura | 250Hz lowpass 白噪声，Q=0.4 | 温暖柔风（替代偏高频bandpass）|
| 🌅 sunset | 80Hz triangle | 温暖低频嗡 |
| 其他 | 无氛围 | dark/light/monochrome |

音效开关按钮（🔊/🔇），状态全局记忆。

---

## Service Worker（`sw.js`）

- 版本：**v6**（修改 SW 代码时必须同步更新 `test.js` 中的版本检查）
- 策略：网络优先（Network First），回退缓存
- 安装：`Promise.allSettled` 异步缓存，不阻塞 activate
- 激活：`clients.claim()` 立即接管所有页面
- 缓存：只缓存 GET 200 响应
- **手机端缓存顽固时**：F12 → `navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))` 手动注销

---

## 维护说明

### 命名规范
- 新增全局函数尽量以模块名为前缀（如 `audio_xxx`、`save_xxx`），避免跨模块命名冲突
- localStorage key 统一通过 `LS_KEYS` 常量访问（定义在 `state.js`），禁止硬编码 `'xixi_'` 字符串
- `test.js` 会自动检查跨模块函数命名冲突

### 状态一致性（重要）

`renderStatusContainers()` 重建状态DOM后**必须**调用 `updateAllDynamicFieldsFromHistory()` 恢复数值。已有配对：
- `closeSettings()` → restore ✓
- `saveFields()` → restore ✓
- `openSettings()` → 补fieldHistory默认值 + restore ✓
- `renderGameState()` → updateAllDynamicFields ✓

新增 `renderStatusContainers` 调用点时务必补上 restore。

`updateAllDynamicFields` 使用 `??` 而非 `||`，防止数值 0 显示为"—"。

### 结局章节维护

- 修改 promptBody 时确保 `【结局系统】` 章节含全部结局的 `【游戏结束·XXX】` 标记
- `repairEndingSection` v2 使用逐标记验证（非简单长度检查），即使 350 字符的残缺版本也能检测到缺失结局
- 每个结局必须附带 1-2 句具体叙事描述，供 `buildEndingInjection` 生成 AI 指令
- 格式：`结局X·名称（条件）：叙事描述。标注【游戏结束·名称】`
- 提示词首段需包含结局例外条款："当系统消息明确指示触发结局时，优先写结局叙事"
- 保存提示词时会自动检测结局标记完整性，缺失时弹出警告

### 模板 JSON 结构

- 默认模板 `surongrong.json` 为手工模板。修改其 promptBody 时确保结局章节完整
- 自定义模板的结局系统须遵循格式让客户端兜底能解析
- 新增场景类型：同步更新模板 sceneTypes + sceneImages + public/ 对应图片
- 新增主题：创建 `themes/theme-xxx.css` + 在 `index.html` 主题选择器中添加选项
- 主题CSS只需覆盖 `:root` 变量 + 特定元素样式
- **推代码前备份酒馆数据**
- **prompt.txt 是服务端后备**，不要随意修改
- `node test.js` 做自动化语法检查（75项）。core.js 和 utils.js 的括号告警是**已知误报**——正则中的 `[]` 被朴素计数法误判
- 浏览器诊断：F12 粘贴 `fetch('/js/test.js').then(r=>r.text()).then(eval)`

### 服务端结局修复

`server.js` 的 `buildSystemPrompt()` 也包含 `repairEndingSection()`，从磁盘加载原始模板（`loadTemplate(id)`）作为对比源——不依赖客户端传来的可能已截断的版本。

---

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
| `xixi_age_verified` | 12+警告已确认 |
| `xixi_last_save_id` | 上次游玩的存档ID |
| `xixi_active_template_id` | 当前活动模板ID |
| `xixi_last_manual_slot_{id}` | 上次手动存档槽位号 |

## 模板 JSON 结构

```json
{
  "id": "my-world",
  "name": "名称",
  "description": "20字简介",
  "worldSetting": "世界观详细介绍（\\n\\n分段）",
  "protagonist": "主角详细介绍（\\n\\n分段）",
  "conflict": "核心冲突（\\n\\n分段，含结局概述）",
  "styles": ["风格标签"],
  "theme": "dark",
  "outputSections": {
    "statusTop": {"label":"状态栏","display":"inline","fields":[...]},
    "taskLine": {"label":null,"display":"inline","fields":[...]},
    "resources": {"label":"资源","display":"inline","fields":[...]},
    "variables": {"label":"变量追踪","display":"grid","fields":[...]}
  },
  "promptBody": "系统提示词正文（3000-6000字，必须含【结局系统】章节且每个结局标注【游戏结束·XXX】并附带1-2句叙事描述）",
  "achievements": {"成就名":{"icon":"🏆","desc":"描述"}},
  "hiddenAchievements": {"隐藏成就":{"icon":"🎭","desc":"描述","trigger":{"type":"choice","pattern":"...","count":1}}},
  "sceneTypes": ["场景1","场景2"],
  "sceneImages": {"场景1":"日常.png"},
  "openingMessages": ["开始游戏。【开局编号：1】"]
}
```
