# 互动叙事游戏 · 苏蓉蓉

## 项目概览

基于 DeepSeek API 驱动的多模板互动叙事引擎。默认模板「苏蓉蓉·潜伏」为斗罗大陆世界观卧底叙事，支持 AI 辅助创建任意世界观的自定义存档。每个存档使用独立的提示词、UI 字段、场景图片和主题。

**在线版**：部署在 Railway → `xixi-fable.up.railway.app`
手机电脑浏览器打开即玩，无需安装任何东西。

## v6 更新记录（2026-06-26 深夜）

### 主题系统全面细化 — 11 套主题全部升至 v2+

每套主题覆盖：**撞色体系 + 照片框重设计 + 粒子特效 + 选项hover特效 + 背景音效**

| 主题 | 版本 | 核心色 | 照片框 | 粒子 | 音效 |
|------|------|--------|--------|------|------|
| 🌿 森林 | v3 | 深绿 `#0c1a10` + 琥珀边 `#f0a840` + 品红 `#e06890` | 树桩年轮椭圆 | 萤火虫暖金浮游 + 4片叶🍂飘落 | 风吟+溪流+鸟鸣 |
| 🌊 深海 | v2 | 墨蓝+暖金+珠光（不变） | 潜水艇舷窗+波浪底边 | 7鱼散游+鲸影+气泡珍珠 | 鲸歌+声呐ping |
| 💜 赛博 | v2 | 黑底+电青+品红（补响应式+成就弹窗） | 斜切霓虹+CRT扫描线 | 霓虹墨迹+电流脉冲+摩斯蜂鸣 | 机器低嗡+摩斯+电流噪点 |
| 🏯 修仙 | v2 | 竹纸暖底+朱砂+墨色（补响应式） | 卷轴裱框+剑锋冷光 | 云海仙雾+墨点洇染+竹节暗纹 | 五度pad+风铃+远箫 |
| 🌸 樱花 | v5 | 和風暖白+朱红+鼠尾草绿（不变） | 掛け軸天杆地杆 | 6瓣正弦飘落+淡墨洇染 | 纯四度泛音垫+高音风铃 |
| 🌅 日落 | v2 | 暖奶油墙 `#f0e8da` + 琥珀金 `#e09050` + 暮紫 `#6878b8` | 现代深色铝框窗 | 丁达尔光柱+浮尘+归鸟🐦×3+纱帘 | 五度pad+东方晚钟+慵懒归鸟 |
| 🌃 子夜 | v2 | 暗夜蓝 `#060e1a` + 极光青 `#40e8c0` + 银白 `#d0d8f0` | 六边形蜂巢窗+银白边框 | 12星闪烁+流星划落+极光帷幕 | 五度pad+脚步声 |
| ✨ 鎏金 | v2 | 暖棕 `#1a0e06` + 紫晶 `#c060d0` + 玫瑰金 `#e87090` | 四角紫晶镶饰镀金框 | 金粉飘落+画框微光呼吸 | 五度pad+竖琴琶音+低频金钟 |
| ⬜ 黑白 | v2 | 米白+纯黑+绯红（三色不变） | 宝丽来白边+上下装订孔 | 胶片颗粒+打字机光标闪烁 | 打字机键击+换行铃 |
| ☀ 明亮 | v2 | 书页白 `#f5f0e4` + 蓝墨水 `#2850a0` + 陶土红 `#d06040` | 书页插图框+页码 | 台灯浮尘+纱帘飘动 | 翻书声+风铃 |
| 🌙 暗色 | v2 | 变量不动，仅加氛围层 | 微光细框 | 暗角晕影+余烬粒子缓升 | 40Hz极低频垫音 |

### 音效系统变更
- 🌿 森林 v3：加溪流（低频带通白噪声随机短脉冲，2-6s间隔）
- 🌃 子夜 v2：55Hz正弦+LFO → 55+82Hz三角波五度pad + 脚步声（40-80Hz低频脉冲，2-4步/组，8-15s间隔）
- ✨ 鎏金 v2：110+165Hz → 加竖琴琶音（C5-E5-G5随机序列，12-18s）+ 低频金钟（200+300Hz，90-120s）
- ⬜ 黑白 v2：无 → 打字机键击（highpass 3000Hz白噪声短脉冲，2-5s）+ 换行铃
- ☀ 明亮 v2：无 → 翻书声（lowpass 800Hz白噪声，8-20s）+ 风铃（C6-F6，15-25s）
- 🌙 暗色 v2：无 → 40+60Hz极低频三角波+正弦垫音
- 🌅 日落 v2：80Hz三角波 → 110+165Hz五度pad+LFO + 东方晚钟（200Hz三角波+600Hz泛音，800Hz低通）+ 归鸟

### Bug 修复
- **钟声惊吓**：`gHarm`/`gFund`/`gStrike` 增益节点默认值为 1.0 导致第一声巨响，全部加 `.value = 0` 初始化
- 赛博：补按钮尺寸锁死 + 响应式 + 成就弹窗样式
- 修仙/明亮：补响应式断点
- 鎏金：`image-frame::before` flex → radial-gradient（伪元素不支持flex）
- 明亮：`attr(data-page)` → 静态文本（HTML无此属性）
- 日落：补 `#left-panel { position:relative }` 定位锚点

### 主题设计铁律（v6 总结）
1. **改照片框** — 每套主题必须有独特的 image-frame 设计
2. **改撞色** — 至少一个非金银的强调色，拒绝单色调
3. **文字清晰** — text 和 bg 对比度足够，text-bright 为最亮
4. **选项清晰** — option-btn hover 必须有可见特效（阴影/位移/边框变色）
5. **粒子特效** — 每套至少一种动态粒子（飘落/浮游/闪烁）
6. **背景音乐** — 听得见但不吵，有效增益 0.002-0.06，间歇性而非持续噪音
7. **伪元素规划** — 11 个可用伪元素提前分配，避免特效冲突

## v5 更新记录（2026-06-26 晚间）

### 性能优化
- `buildSystemPrompt` 静态部分缓存（`_promptCache`），仅模板变化时重建
- `extractAllFields` 批量字段提取替代逐字段正则，O(lines×fields) 替代 O(fields×text)
- 流式预览 3 个 replace 合并为 1 个正则
- `/api/chat` 内置模板仅传 `templateId`，自定义模板传 `templateFallback`

### 安全加固
- **提示词破限三层防御**：系统提示词「安全边界」+ 指令包装器改写 + 前端输入拦截
- API Key XOR 加密存储（`_readApiKey`/`_writeApiKey`）
- 管理员密码移除硬编码 hash，完全依赖环境变量 `ADMIN_PASSWORD`
- CSP 移除 `unsafe-eval`

### 结局系统测试
- `tests/ending-system.test.js` — 54 个用例，覆盖 `detectEnding`(9格式变体+`*`修复) / `collectEligibleEndings`(17边界+`><>=<=`运算符) / `selectBestEnding`(7择优) / `checkEndingClientSide` / `buildEndingInjection` / `repairEndingSection` / 综合场景

### Bug 修复（关键）
- **extractAllFields 倒序扫描**：AI 回复开头的格式提示（`压力值：[0-100]`）先被匹配导致实际数值被跳过，改为从末尾往前扫描 + `matched` 锁
- **fieldHistory 自愈**：`_lastParsedFields` 缓存 + `updateAllDynamicFieldsFromHistory` 兜底，打开设置不再丢字段
- **涟漪 `<span>` 撑爆按钮**：全局涟漪未排除 `#btn-audio` 且无 `position:absolute`，导致按钮 10 倍变大
- **dialog 队列化**：`_dialogQueue` 替代单变量 `_pendingDialogDone`，消除竞争条件
- **fullHistory 截断**：存档保留最近 30 轮，防止 localStorage 膨胀
- **`summarisedCount` 截断后越界**：重置为 0
- **SW 缓存**：v8 恢复完整场景图片预缓存 + 常用主题

### 游戏体验
- **里程碑引导**：第 3/5/10/15/20/30 回合自动注入叙事提示
- **AI 质量监控**：`window.XIXI.metrics` — 请求数/格式错误率/平均响应/结局触发数
- **重试指数退避**：1s→3s→5s
- **存档版本化**：`dataVersion: 2`，旧存档自动迁移
- **exportStory**：末尾追加成就摘要/结局信息/最终状态
- **状态栏色盲友好**：数值颜色 + `data-level` 属性双重传达

### 音效系统 v3
- **三态开关**：🔉全部 → 🔔仅UI界面 → 🔇静音 循环
- **标准化主增益**：`_ambientGain = 0.06`，白噪声类内部增益下调，全主题音量一致
- **🌸 樱花新音色**：白噪声风→纯四度泛音垫(330+392Hz) + 高音风铃(E5-C6)
- UI/氛围独立控制：`_safeCtx()` 仅检查 `_uiAudioOn`，`_safeAmbientCtx()` 检查 `_ambientOn`

### 主题系统重构
- **字体解耦**：10 套系统字体栈独立选择器（黑/宋/楷/仿宋/圆/行书/等宽/轻宋/粗黑/篆隶），按存档隔离。主题 CSS 不再管 `font-family`
- **🌸 樱花 v4**：三标签定位（樱花+日式+微古风），掛け軸画框（天杆地杆）、和紙肌理、墨線边框、6瓣正弦漂落、9:16 竖幅 `object-fit:cover`

### 文件变更
- 新增 `tests/ending-system.test.js`（54 用例）
- 新增 `public/js/font-debug.js`、`public/js/status-debug.js`、`public/js/field-trace.js`（诊断脚本）
- SW 版本 v7→v8
- `LS_KEYS` 新增 `font(id)`

---

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
│   ├── theme-forest.css   #   🌿 森林 v2
│   ├── theme-xianxia.css  #   🏯 修仙 v2
│   ├── theme-cyber.css    #   💜 赛博 v2
│   ├── theme-sakura.css   #   🌸 樱花 v5
│   ├── theme-ocean.css    #   🌊 深海 v2
│   ├── theme-sunset.css   #   🌅 日落
│   ├── theme-midnight.css #   🌃 子夜
│   ├── theme-monochrome.css # ⬜ 黑白
│   ├── theme-golden.css   #   ✨ 鎏金
│   └── theme-light.css    #   ☀ 明亮
├── public/                # 前端静态文件
│   ├── index.html         #   主页面（含内联 SVG favicon）
│   ├── style.css          #   基础暗色主题样式（变量驱动）
│   ├── sw.js              #   Service Worker（v8，网络优先，只缓存GET 200）
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
│       ├── audio.js       #     Web Audio 合成音效+主题氛围（v3:统一路由/null安全/柔化音色）
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

### 音效系统（`audio.js` v3）

**Web Audio API 合成，无外部音频文件。**

**三态音效开关**：🔉全部 → 🔔仅UI界面 → 🔇静音，循环切换。`_uiAudioOn` 和 `_ambientOn` 独立控制。

**用户手势门控**：`_safeCtx()` 检查 `_uiAudioOn`，`_safeAmbientCtx()` 检查 `_ambientOn`。

**UI 音效**：
- `playClick()` — 游戏选项点击：1200→900Hz 正弦，0.05s
- `playUIClick()` — 通用UI按钮：600Hz 正弦，0.04s
- `playAchievement()` — 成就解锁：C-E-G 大三和弦，三角波
- `playError()` — 错误提示：150→80Hz 三角波下行

**主题氛围**（v3 统一主增益 0.06，白噪声类内部增益下调）：
| 主题 | 音色 | 说明 |
|------|------|------|
| 🌿 forest | 350Hz lowpass 白噪声，内部增益 0.25 | 柔和风吟 |
| 🌊 ocean | 200Hz lowpass + 0.1Hz LFO，噪声振幅 0.07 | 低频潮汐 |
| 💜 cyber | 55Hz sawtooth → 150Hz lowpass | 科技低嗡 |
| 🏯 xianxia | 65+98Hz 五度pad + 稀疏柔铃(C5-A5) | 修仙氛围 |
| 🌃 midnight | 55Hz sine + 0.05Hz LFO | 宇宙呼吸 |
| ✨ golden | 110Hz + 165Hz 五度泛音 | 金属共鸣 |
| 🌸 sakura | 330+392Hz 纯四度pad + 高音风铃(E5-C6) | 花瓣静谧 |
| 🌅 sunset | 80Hz triangle | 温暖低频 |
| 其他 | 无氛围 | dark/light/monochrome |

---

## Service Worker（`sw.js`）

- 版本：**v8**（修改 SW 代码时必须同步更新 `test.js` 中的版本检查）
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
| `xixi_font_{id}` | 字体选择（按存档隔离，10套系统字体栈） |

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

---

## 🔧 近期修复记录（2026-06-26 会话）

### 图片 UI 修复
- **图片说明框移除**：`.image-caption` DOM 元素从 index.html 删除，CSS（style.css + theme-sakura.css）和 JS（state.js dom 引用 + ui.js switchSceneImage）全部清理
- **Ken Burns 动画恢复 1.08**：用户理解效果后恢复原始缩放幅度
- **涟漪按钮修复**：`.btn` 添加 `position: relative`，确保 ripple span（`position: absolute`）正确锚定在按钮内

### 按钮/存档修复
- **存档按钮统一样式**：`#btn-back-saves` 从 `btn-ghost btn-tiny` 改为 `btn-small`
- **清档功能迁移**：存档卡片移除「🗑 清档」按钮，改为继续游戏输入框内支持 `X1`（删槽位1）/ `XA`（清全部）
- **成就图标去重**：`反杀时刻` 🗡→⚔️，`把柄` 🗡→🔑

### CSS 全局修正
- **主题按钮压缩**：修仙、森林、深海主题的 `.btn`/`.btn-small`/`.btn-tiny` 加了尺寸锁死，防止顶部栏换行

---

## 🎨 主题细化方法论（2026-06-26 会话总结）

### 流程
1. 用户给关键词（6-9个）
2. 分析现状 vs 关键词的覆盖/缺口
3. 关键词分层：底层（氛围/纹理）→ 中层（骨架/结构）→ 表层（装饰/动效/音效）
4. CSS + 音频同步落地
5. 每套主题必须覆盖的统一区域：选项区容器、状态面板、AI对话框、按钮尺寸、滚动条、输入聚焦、弹窗标题、结局弹窗、加载动画

### 已完成主题（5/11）

| 主题 | 版本 | 关键词 | 核心识别 |
|------|------|--------|----------|
| 🌸 樱花 | v5 | 日式·樱花·微古风 | 掛け軸画框+6瓣飘落+淡墨洇染+楷体 |
| 💜 赛博 | v2 | 水彩涂鸦·摩斯密码·电流·计算机·机器 | 霓虹墨迹+CRT扫描线+摩斯蜂鸣+电流脉冲 |
| 🏯 修仙 | v2 | 云海·竹林·剑·功法·墨水·朱砂 | 薄雾飘移+竹节暗纹+剑锋冷光+符箓◇+远箫泛音 |
| 🌊 深海 | v2 | 海渊·鲸鱼·潜水艇·气泡·珍珠·珊瑚·鱼群·漩涡 | 鲸影掠过+散游鱼群+声呐ping+鲸歌彩蛋(2min) |
| 🌿 森林 | v2 | 苔青·光斑·薄雾·藤蔓·湖泊·落叶🍂·鸟鸣·花朵 | 林间光斑漂移+散落叶片+藤蔓垂枝+鸟鸣颤音 |

### 待细化（6/11）
🌅 日落 · 🌃 子夜 · ⬜ 黑白 · ✨ 鎏金 · ☀ 明亮 · 🌙 暗色(dark)

### 音效设计经验

**音量标准**：`_ambientGain = 0.06` 统一主增益。樱花 pad 内部 gain 0.03，有效增益 0.0018，这是"似有若无"的参考基准。

**纯正弦波低频陷阱**：笔记本/手机喇叭放不出 <150Hz 的纯正弦。解决方案：
- 用三角波/锯齿波（带泛音）替代正弦
- 或把频率提到 200Hz 以上
- 或加一个高频垫底做"锚点"，让用户知道音频在工作

**setInterval vs 连续振荡器**：
- 连续垫底用 `osc.start()` 直接启动（如樱花 pad、森林风吟）
- 间歇音效（鸟鸣、鲸歌、声呐）用 `setInterval` + 每次创建短期振荡器
- `stopAmbient()` 后 `_ambientNode.stop()` 必须清理所有 timer 和 oscillator

**音频调试流程**：先用高频 + 短间隔确认能听见 → 调到正确音高 → 拉长间隔到正常节奏

### CSS 经验

**伪元素分配**：11 个可用伪元素（body×2, #game-container×2, #content-panel×2, #left-panel×2, #story-box::after, .settlement-box::after 等），做复杂主题时需要提前规划分配。

**emoji 动画**：
- 单只 emoji 比整排好（整排像横幅）
- `scaleX(-1)` 翻面在不对称 emoji（🐟🐠🐡🍂）上效果很差
- 让所有 emoji 沿自然朝向游/飘（鱼朝左、叶朝下）

**颜色单调的解法**：
- 加 3-5 个强调色变量（如森林加 `--sun`/`--bloom`/`--bark`/`--lake`）
- 不同区域用不同强调色的边框/光晕/标签
- 暖色点缀在暗色底上格外重要

**按钮统一**：所有非 dark 主题必须覆盖 `.btn`/`.btn-small`/`.btn-tiny` 尺寸，否则顶部栏会换行。

## v7 更新记录（2026-06-27 上午 — 优化方案 Phase 1+2 完成）

### Phase 1：元提示词重写（`server.js:381-480`）

metaPrompt 从 44 行扩至 ~130 行。新增章节：

| 章节 | 说明 |
|------|------|
| **叙事哲学** | AI 的根本立场：讲述者非裁判，数值是叙事语言非积分，允许极端值，禁止"控温" |
| **叙事节拍** | 快拍(1回)/中拍(2-3回)/大拍(3-5回)，场景切换服务于叙事节奏 |
| **两难设计** | 每选项都让玩家犹豫，禁止无代价正确选项，失败引出新困境 |
| **字段叙事效应** | 软阈值定义（如好感度≥60→私下帮忙），数值变化必须有可见叙事后果 |
| **编辑参考** | 追加到 promptBody 末尾，帮助玩家修改时不出错 |
| **命运转折系统** | 取代旧"结局系统"，5-8个自由设计（非固定4层），条件括号紧挨标记≤50字符 |

已修改章节：你的身份（加例外条款）、世界观（400-600字+铁律）、主角（300-500字）、冲突（≥3重困境）、开局（N个可配置）、成就（全定制禁止通用名）

**游戏长度联动**（lengthGuide 新增字段）：`openings`, `endings`, `achievements`, `hiddenAch`, `promptBudget`, `longRoad`

**字段架构弹性化**：statusTop 2-4字段 / taskLine 固定2 / resources 1-3 / variables 1-4

### Phase 2：关键词全局重命名

| 旧 | 新 | 影响 |
|----|-----|------|
| `【游戏结束·XXX】` | `【命运转折·XXX】` | 所有正则同时兼容新旧格式 |
| `【资源不足】` | `【力不能及】` | 资源真不够→禁用按钮 |
| （新增） | `【代价沉重】` | 够但贵→可选但弹确认框+红色边框 |

**关键代码改动**：
- `utils.js`：buildStatusSnapshot / repairEndingSection / collectEligibleEndings / buildEndingInjection / detectEnding — 全部正则改为 `/(?:游戏结束|命运转折)/` 兼容双格式
- `server.js`：buildSystemPrompt 叙事法则 + repairEndingSection 统一
- `core.js`：硬兜底注入 + 结局弹窗标题 + handleChoice 代价沉重确认
- `ui.js`：updateOptionButtons v2 — 力不能及→禁用，代价沉重→可选+红框，`_heavyCostOptions` 标记
- `prompts.js` / `prompt.txt`：正则兼容 + 文案更新

**向后兼容**：surongrong.json 保持旧标记不变。所有检测函数同时接收新旧格式。新生成的模板用新格式。

**⚠ 未改的**：tests/ending-system.test.js 保持测试旧格式（验证向后兼容）。函数名暂未重命名（如 detectEnding、buildEndingInjection）。

### 后续 Phase

详见 `优化方案.md` + `PROGRESS.md`。Phase 3→11 待新会话继续。

