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

## ✅ Phase 3：叙事引擎升级（已完成）

**内容**：
- [x] `core.js startNewGame()` — 读取 `template.initialState` 初始化 fieldHistory（目前是 `{}`）
- [x] `init.js` 状态栏点击编辑 — 改完后追加系统通知到 fullHistory 告知 AI

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/core.js` | `startNewGame()` 中 fieldHistory 初始化从 `{}` 改为读取 `tpl.initialState`；number→`{current, max}`，string→`{currentText}`，跳过嵌套对象 |
| `public/js/init.js` | 状态栏数值点击编辑后，追加 `【系统通知】玩家手动调整了「字段label」的值为 X` 到 `fullHistory`，通知 AI 合理衔接 |

**依赖**：无，独立实施

---

## ✅ Phase 4：结局指令强化（已完成）

**内容**：
- [x] `core.js _prepareMessages()` — 结局注入从拼到 user 消息末尾改为独立 system 消息
- [x] 文案优化："现状就是命运转折场景"+"不需要额外切换"
- [x] 元提示词（Phase 1 已完成）的【你的身份】例外条款已写入

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/core.js` | `_prepareMessages()` 结局注入从 `enhancedContent += endingInjection` 改为 `allMessages.push({role:'system', content: preEndingInjection})`，放在里程碑消息之前、user 消息之前——覆盖效应让 AI 无法忽视 |
| `public/js/utils.js` | `buildEndingInjection()` 文案重写："必须触发"→"现状就是"，加"不需要额外切换场景"，去掉"最高优先级"和"格式规则放宽"（例外条款已在 Phase 1 元提示词中处理） |
| `server.js` | Phase 1 已写入例外条款：`当本回合出现【★ 命运转折回合 ★】系统消息时…`（第 423 行，无需改动） |

**依赖**：Phase 2（标记名已改）

---

## ✅ Phase 5：编辑系统校验（已完成）

**内容**：
- [x] `templates.js saveFields()` — 字段改名→promptBody 扫描替换
- [x] `prompts.js savePrompt()` — 字段引用校验（条件里的字段 label 是否存在于 outputSections）
- [x] `templates.js addField()` — 弹窗重构（叙事含义必填 + 软阈值可选）
- [x] `achievements.js addNewAchievement(true)` — 隐藏成就 trigger 类型编辑器
- [x] `prompts.js resetPrompt()` — 恢复范围多选（字段/成就/隐藏成就/提示词）
- [x] 游戏中编辑→警告弹窗（saveFields + savePrompt 两处）

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/achievements.js` | `addNewAchievement(true)` 隐藏成就添加时不再硬编码 gambit trigger，改为 6 种类型选择（choice/gambit/rounds_under/field_zero/field_max_under/response_match），每种带类型专属参数输入 |
| `public/js/prompts.js` | `savePrompt()` 新增字段引用校验（扫描 promptBody 中 `字段名≥数字` 模式，与 outputSections 比对，未知字段弹警告）+ 游戏中编辑警告；`resetPrompt()` 从单一项改为多选范围（提示词/字段/可见成就/隐藏成就），从 `_originalTemplate` 恢复选定项 |
| `public/js/templates.js` | `saveFields()` 新增字段标签改名→promptBody 全文扫描替换（比较 `_preEditFields` 快照与当前 DOM）+ 游戏中编辑警告；`addField()` 从 10 行扩至 ~70 行，新增字段ID/标签/类型选择 + 叙事含义必填 + 软阈值可选，字段定义自动追加到 promptBody `【编辑参考】` 之前 |

**依赖**：Phase 2（正则已更新）

---

## ✅ Phase 6：全局状态隔离（已完成）

**内容**：
- [x] `state.js LS_KEYS` — `aiInstructions` 和 `customImages` 改为 `function(id)` 格式
- [x] `ai.js` — 读写函数 key 加 saveId
- [x] `ui.js renderImageManager` — 图片 key 加 saveId（实际在 prompts.js）
- [x] `prompts.js mergeInstructionsToPrompt` — 加强警告文案（已有）

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/state.js` | `LS_KEYS.aiInstructions` 和 `LS_KEYS.customImages` 从静态字符串改为 `function(id)` |
| `public/js/ai.js` | `getAiInstructions()`/`saveAiInstructions()` 使用 `gameState.activeSaveId` 拼接 key |
| `public/js/prompts.js` | `renderImageManager` 及图片替换/重置所有 5 处 `LS_KEYS.customImages` 均改为 `LS_KEYS.customImages(saveId)` |

**影响点**：`getAiInstructions`/`saveAiInstructions`/`clearAiInstructions` 全部覆盖

---

## ✅ Phase 7：数据安全（已完成）

**内容**：
- [x] `ui.js selectSave()` — 有存档进度时弹确认后才清档
- [x] `prompts.js resetPrompt()` — 确认弹窗（已在 Phase 5 完成）
- [x] `core.js closeEndingOverlay()` — 关闭弹窗后追加系统通知到 fullHistory

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/ui.js` | `selectSave()` 开始新游戏前扫描 10 个槽位，有进度时弹确认窗（含槽位数+最新回合数），取消则返回存档选择页 |
| `public/js/core.js` | `closeEndingOverlay()` 关闭结局弹窗后追加 `【系统通知】命运转折「XXX」已触发。故事继续…` 到 fullHistory |

---

## ✅ Phase 8：酒馆分享清理（已完成）

**内容**：
- [x] `tavern.js uploadToTavern()` — 上传前清除 `_preEditFields`、`_originalTemplate` 等运行时属性
- [x] 模板 `version` 字段每次上传递增
- [x] 自定义图片可选打包（弹窗询问）

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/js/tavern.js` | `uploadToTavern()` 新增：检测【玩家补充规则】残留并警告、清理运行时属性（_preEditFields/_originalTemplate）、自动移除【玩家补充规则】章节、版本号 patch+1、自定义图片可选打包弹窗 |

---

## ✅ Phase 9：服务端统一（已完成）

**内容**：
- [x] `server.js buildSystemPrompt` 和 `utils.js buildSystemPrompt` — 添加同步注释
- [x] `server.js /api/summarize` — 格式化为自然对话而非 JSON 序列化
- [x] `core.js maybeSummarize` — 加 token 估算阈值

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `server.js` | `buildSystemPrompt` 加 ⚠ 同步注释；新增 `formatMessagesForSummary()` 将消息格式化为自然对话；`/api/summarize` 使用新格式化函数替代 `JSON.stringify` |
| `public/js/utils.js` | `buildSystemPrompt` 加 ⚠ 同步注释 |
| `public/js/core.js` | `maybeSummarize()` 新增 token 估算（中文~1.5字/token），在消息数达标 OR token>80K 时触发摘要 |

---

## ✅ Phase 10：UI 修复（已完成）

**内容**：
- [x] `themes/theme-sunset.css` — 移动端按钮换行修复
- [x] UI 命名：模板（设定）vs 存档（进度）区分。标签页/按钮文字统一
- [x] `templates.js renderFieldEditor` — 字段图标改为 hidden input，仅按钮可见
- [x] `templates.js saveFields` — 改用 class 选择器（`.field-id`/`.field-label`/`.field-icon`/`.field-format`）

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `themes/theme-sunset.css` | 480px 断点新增 `#top-bar .btn` 防换行规则 |
| `public/index.html` | 标签页"我的存档"→"我的模板"、按钮"创建新存档"→"创建新模板"、表单"存档名称"→"模板名称"、帮助文案同步更新 |
| `public/js/templates.js` | `renderFieldEditor()` 图标 input 从可见改为 `type="hidden"`；`saveFields()` 从 `inputs[0..3]` 位置索引改为 `querySelector('.field-xxx')` class 选择器 |

---

## ✅ Phase 11：新功能（已完成）

**内容**：
- [x] 难度选择（简单/标准/困难/噩梦）→ 影响元提示词参数
- [x] `POST /api/parse-story` — 从故事文本反向解析生成模板

**改动文件**：
| 文件 | 改动内容 |
|------|---------|
| `public/index.html` | 创建表单新增难度选择 chip 行（简单/标准/困难/噩梦），默认标准 |
| `public/js/templates.js` | `saveFormData()`/`restoreFormData()`/`openCreateSave()`/`generatePrompt()` 全部支持 difficulty 参数；auto-save 监听新增 `#difficulty-chips` |
| `server.js` | `generatePrompt` metaPrompt 新增【难度调整】章节，四种难度对应不同参数（NPC敌意/资源量/代价/命运转折门槛）；新增 `POST /api/parse-story` 端点，接受故事文本→AI解析→输出模板 JSON |

---

## 改动范围汇总（最终）

| 文件 | Phase | 改动程度 |
|------|-------|---------|
| `server.js` | 1,2,9,11 | 🔴 大改 |
| `public/js/utils.js` | 2,3,4,9 | 🔴 大改 |
| `public/js/core.js` | 2,3,4,7,9 | 🔴 大改 |
| `public/js/ui.js` | 2,7,10 | 🟠 中改 |
| `public/js/templates.js` | 5,10,11 | 🔴 大改 |
| `public/js/achievements.js` | 2,5 | 🟠 中改 |
| `public/js/prompts.js` | 5,6,7 | 🔴 大改 |
| `public/js/ai.js` | 6 | 🟠 中改 |
| `public/js/tavern.js` | 8 | 🟠 中改 |
| `public/js/state.js` | 6,10 | 🟡 小改 |
| `public/js/init.js` | 3 | 🟡 小改 |
| `public/index.html` | 10,11 | 🟡 小改 |
| `themes/theme-sunset.css` | 10 | 🟡 小改 |
| `prompt.txt` | 2 | 🟡 小改 |

## 测试状态

- `node test.js`：73/75（2 失败 = utils.js + core.js 括号计数误报，已知）
- `node tests/ending-system.test.js`：54/54 ✅
- 全部 11 个 Phase 完成 ✅

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
