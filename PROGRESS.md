# 优化实施进度

> 施工图：`优化方案.md`（14 章节，47+ 问题，11 个 Phase）
> 架构文档：`CLAUDE.md`
> 开始日期：2026-06-27

---

## ✅ Phase 1：元提示词重写（已完成）

**文件**：`server.js:381-480`

**改动**：metaPrompt 从 ~44 行扩至 ~130 行，lengthGuide 新增 6 个联动参数。

**新增章节**：叙事哲学、叙事节拍、两难设计、字段叙事效应、编辑参考

**修改章节**：你的身份（例外条款）、世界观（400-600字+铁律）、主角（300-500字）、冲突（≥3重困境）、命运转折系统（原结局系统，5-8个自由设计）、开局（N个可配置）、成就（全定制禁止通用名）、资源系统（叙事联动+代价沉重）

**弹性化**：statusTop 2-4 / resources 1-3 / variables 1-4（taskLine 固定 2）

---

## ✅ Phase 2：关键词全局重命名（已完成）

**标记重命名**：

| 旧标记 | 新标记 | 行为 |
|--------|--------|------|
| `【游戏结束·XXX】` | `【命运转折·XXX】` | 检测正则同时兼容新旧 |
| `【资源不足】` | `【力不能及】` | 资源不够→按钮禁用 |
| （无） | `【代价沉重】` | 够但贵→可选+红框+确认弹窗 |

**改动文件**：

| 文件 | 改动内容 |
|------|---------|
| `server.js` | narrativeGuide 文案 + repairEndingSection 正则双兼容 + _matchChapter 辅助 |
| `public/js/utils.js` | buildStatusSnapshot / repairEndingSection / collectEligibleEndings / buildEndingInjection / detectEnding — 全部正则 `(?:游戏结束\|命运转折)` |
| `public/js/core.js` | 硬兜底注入用新标记 + 结局弹窗标题改"命运转折" + handleChoice 加代价沉重确认 |
| `public/js/ui.js` | updateOptionButtons v2 — 力不能及→禁用灰显 / 代价沉重→可选+红色边框+`_heavyCostOptions` |
| `public/js/prompts.js` | savePrompt 结局标记检查正则双兼容 |
| `prompt.txt` | 后备提示词同步更新 |

**向后兼容**：surongrong.json 保持旧标记。所有正则同时匹配 `【游戏结束` 和 `【命运转折`。54 项结局单元测试全部通过。

**未改的（有意保留）**：
- 函数名未重命名（detectEnding 等保持旧名，内部逻辑已升级）
- `tests/ending-system.test.js` 保持测试旧格式（验证向后兼容）

---

## ⬜ Phase 3：叙事引擎升级

**内容**：
- [ ] `core.js startNewGame()` — 读取 `template.initialState` 初始化 fieldHistory（目前是 `{}`）
- [ ] `init.js` 状态栏点击编辑 — 改完后追加系统通知到 fullHistory 告知 AI

**依赖**：无，独立实施

---

## ⬜ Phase 4：结局指令强化

**内容**：
- [ ] `core.js _prepareMessages()` — 结局注入从拼到 user 消息末尾改为独立 system 消息
- [ ] 文案优化："现状就是命运转折场景"+"不需要额外切换"
- [ ] 元提示词（Phase 1 已完成）的【你的身份】例外条款已写入

**依赖**：Phase 2（标记名已改）

---

## ⬜ Phase 5：编辑系统校验

**内容**：
- [ ] `templates.js saveFields()` — 字段改名→promptBody 扫描替换
- [ ] `prompts.js savePrompt()` — 字段引用校验（条件里的字段 label 是否存在于 outputSections）
- [ ] `templates.js addField()` — 弹窗重构（叙事含义必填 + 软阈值可选）
- [ ] `achievements.js addNewAchievement(true)` — 隐藏成就 trigger 类型编辑器
- [ ] `prompts.js resetPrompt()` — 恢复范围多选（字段/成就/隐藏成就/提示词）
- [ ] 游戏中编辑→警告弹窗

**依赖**：Phase 2（正则已更新）

---

## ⬜ Phase 6：全局状态隔离

**内容**：
- [ ] `state.js LS_KEYS` — `aiInstructions` 和 `customImages` 改为 `function(id)` 格式
- [ ] `ai.js` — 读写函数 key 加 saveId
- [ ] `ui.js renderImageManager` — 图片 key 加 saveId
- [ ] `prompts.js mergeInstructionsToPrompt` — 加强警告文案

**影响点**：all callers of getAiInstructions/saveAiInstructions/clearAiInstructions

---

## ⬜ Phase 7：数据安全

**内容**：
- [ ] `ui.js selectSave()` — 有存档进度时弹确认后才清档
- [ ] `prompts.js resetPrompt()` — 确认弹窗（与 Phase 5 恢复范围合并）
- [ ] `core.js closeEndingOverlay()` — 关闭弹窗后追加系统通知到 fullHistory

---

## ⬜ Phase 8：酒馆分享清理

**内容**：
- [ ] `tavern.js uploadToTavern()` — 上传前清除 `_preEditFields`、`_originalTemplate` 等运行时属性
- [ ] 模板新增 `version` 字段，每次上传递增
- [ ] 自定义图片可选打包（弹窗询问）

---

## ⬜ Phase 9：服务端统一

**内容**：
- [ ] `server.js buildSystemPrompt` 和 `utils.js buildSystemPrompt` — 统一（服务端版补安全边界）
- [ ] `server.js repairEndingSection` 和 `utils.js repairEndingSection` — 去重（只保留一份权威实现）
- [ ] `server.js /api/summarize` — 格式化为自然对话而非 JSON 序列化
- [ ] `core.js maybeSummarize` — 加 token 估算阈值

---

## ⬜ Phase 10：UI 修复

**内容**：
- [ ] `themes/theme-sunset.css` — 移动端按钮换行修复
- [ ] UI 命名：模板（设定）vs 存档（进度）区分。标签页/按钮文字统一
- [ ] `templates.js renderFieldEditor` — 字段图标双显修复 + saveFields 改用 class 选择器

---

## ⬜ Phase 11：新功能

**内容**：
- [ ] 难度选择（简单/标准/困难/噩梦）→ 影响元提示词参数
- [ ] `POST /api/parse-story` — 从故事文本反向解析生成模板

---

## 改动范围预估

| 文件 | Phase | 改动程度 |
|------|-------|---------|
| `server.js` | 1,2,9,11 | 🔴 大改（Phase 1 已完成）|
| `public/js/utils.js` | 2,3,4,9 | 🔴 大改（Phase 2 已完成）|
| `public/js/core.js` | 2,3,4,7 | 🟠 中改（Phase 2 已完成）|
| `public/js/ui.js` | 2,7,10 | 🟠 中改（Phase 2 已完成）|
| `public/js/templates.js` | 5 | 🔴 大改 |
| `public/js/achievements.js` | 2,5 | 🟡 小改 |
| `public/js/prompts.js` | 5,7 | 🟠 中改 |
| `public/js/ai.js` | 6 | 🟠 中改 |
| `public/js/saves.js` | 6 | 🟡 小改 |
| `public/js/state.js` | 6,10 | 🟡 小改 |
| `public/js/init.js` | 3,10 | 🟡 小改 |
| `public/js/tavern.js` | 8 | 🟠 中改 |
| `themes/theme-sunset.css` | 10 | 🟡 小改 |
| `public/index.html` | 10 | 🟡 小改 |
| `prompt.txt` | 2 | 🟡 小改（Phase 2 已完成）|
| `test.js` | 2 | 🟡 小改 |

---

## 已知测试状态

- `node test.js`：73/75 通过（2 失败 = utils.js 括号计数误报 + 服务器未启动，均为已知）
- `node tests/ending-system.test.js`：54/54 全部通过
- 浏览器诊断：`fetch('/js/test.js').then(r=>r.text()).then(eval)`
