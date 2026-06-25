# 互动叙事游戏 · 项目交接文档

## 给下一位老师的话

这个项目经过多轮迭代，核心问题是：**app.js 从 1934 行膨胀到 2200+ 行，补丁叠补丁，部分功能生效、部分静默失败**。建议做法：

1. **不要在原 app.js 上继续修**——积重难返
2. **保留所有其他文件**——server.js、index.html、style.css、10套主题、surongrong.json 都是好的
3. **只重写 app.js**，拆成 4-5 个模块文件，逐个功能实现，每完成一个就测

## 当前状态

### ✅ 完好可用的文件
- `server.js` — Express后端，metaPrompt重构版，含酒馆备份恢复API
- `index.html` — 所有弹窗HTML结构完整（10个overlay）
- `style.css` — 主题全覆盖规则200+行
- `themes/` — 10套主题完整
- `templates/surongrong.json` — 9字段精简版，8+5成就，6开局随机
- `prompt.txt` — 服务端后备提示词

### ⚠ 问题文件
- `public/app.js` — 单文件2200+行，部分功能生效、部分静默失败

## 用户所有需求汇总

### 核心玩法
1. 回合制互动叙事：AI每回合输出"上回合结算→现状→4选项→状态字段"
2. 选项按钮 + 键盘1-4快捷键
3. 场景图片按类型切换（9种场景类型，AI只能从模板定义的类型中选择）
4. 状态栏/资源/关系数值显示，颜色分级（绿/黄/红）
5. **故事框累积显示**所有回合（带回合标签，最多20回合，可上翻）
6. 加载时显示"第X回合·已等待X秒"
7. **资源不足的选项灰色禁用**——检测选项代价中的资源消耗，当前资源不够时禁用按钮

### AI交互
8. AI小窗输入指令，下回合生效
9. **📝合并到提示词**——将指令写入promptBody末尾【玩家补充规则】段，重复合并累加保留旧指令（自动去重）
10. AI回复格式异常时自动重试一次

### 存档系统
11. 自动存档（槽位0）
12. 手动存档💾（槽位1-9）
13. **继续游戏时多槽位选择**——弹出选择框，输入槽位号读取，输入"删X"删除指定槽位
14. 🗑清档（清除所有槽位，保留模板和成就）
15. ✕删除整个模板（含成就缓存）
16. ↩️撤销上一步

### 成就系统
17. **可见成就**——进度条自动更新，数值达标弹出提示
18. **隐藏成就**（❓未知→达成揭示）——6种trigger类型：choice/gambit/rounds_under/field_zero/field_max_under/response_match
19. **客户端自动检测**——不依赖AI标注，基于字段数值+行为追踪
20. ✏️编辑成就（改名/图标/描述）
21. ✕删除成就
22. ＋添加可见/隐藏成就
23. 📦另存为新存档（导出模板）
24. 成就按模板ID隔离存储，跨新游戏保留

### 提示词管理
25. 设置页编辑promptBody（仅正文，不含格式模板和最终提醒）
26. 💾保存到 `xixi_edited_template_{存档ID}`（按模板隔离，不是全局）
27. 新游戏和继续游戏均加载编辑版模板
28. ↩恢复原始提示词

### 字段编辑器
29. 查看/修改字段（ID/标签/图标/类型/格式提示）
30. **添加字段时选区段**（状态栏/资源/关系，不是只能加关系字段）
31. emoji下拉选择器
32. 输入标签自动生成英文ID
33. 删除字段+保存→系统提示词同步
34. 关闭设置后字段值恢复（不变横杠）

### 结局系统
35. AI输出【游戏结束·XX】→自动检测→弹出结局弹窗
36. 弹窗展示：结局图标/名称/叙述/回合数/成就解锁数/最终字段值
37. 三个按钮：重新开始/返回存档/继续游戏

### 工具功能
38. 📜历程回顾弹窗（含每回合选择/结算/现状/资源数值）
39. 📄导出故事txt（含选择/结算/现状/每回合资源变动，跳过开局消息，选项文本去编号前缀）
40. 点击状态栏数值手动修改
41. ❓帮助弹窗（11章节完整功能说明）

### 酒馆系统
42. 酒馆列表 + 🔍实时搜索
43. ☁分享到酒馆
44. 📥导入并游玩
45. 🔑管理员：删除/📥备份下载/📤恢复上传

### UI/主题
46. 11套主题切换
47. 场景图片替换
48. **自定义对话框**（替代浏览器原生prompt/confirm/alert，适配主题）

### 技术要点
49. **存档key兼容旧格式**：slot=0不写后缀（`xixi_gamesave_{id}`），slot>0写后缀（`xixi_gamesave_{id}_1`）
50. **编辑模板key**：`xixi_edited_template_{存档ID}`
51. **fieldHistory**追踪所有字段当前值和历史最大值
52. **achievementFlags**追踪行为标记（gambitSuccessCount/choiceCounts/responseMatches等）
53. **extractField全局匹配**：取最后一次出现（状态字段在回复末尾）
54. **generateOutputFormat含场景类型约束**：AI只能从模板定义的类型中选择
55. 提示词结构：格式模板 + promptBody + 最终提醒（不被套娃污染）

## 建议的重构方案

### 文件结构
```
public/
  index.html          ← 保留，script标签改为加载js/模块
  style.css           ← 保留
  js/
    state.js          ← gameState, FALLBACK_TEMPLATE, KEEP_ROUNDS
    utils.js          ← escapeHtml, extractField, generateOutputFormat, buildSystemPrompt, refreshSystemPrompt
    dialogs.js        ← showDialog, dlAlert, dlConfirm, dlPrompt
    saves.js          ← getSaveKey, saveGameState, loadGameState, getSaveInfo, clearAllSaves, deleteSave, 存档列表
    ui.js             ← showLoading, updateOptionButtons(资源检测版), renderStatusContainers, updateAllDynamicFields, 场景图片, 主题
    achievements.js   ← 所有成就相关函数
    core.js           ← parseAIResponse, renderGameState(历程累积版), sendMessage, handleChoice, startNewGame, continueGame(多槽位版)
    prompts.js        ← openSettings, closeSettings, savePrompt, reloadPrompt, resetPrompt, mergeInstructionsToPrompt
    templates.js      ← 模板加载/创建/字段编辑器
    tavern.js         ← 酒馆分享系统
    ai.js             ← AI聊天指令
    init.js           ← bindEvents, init, 所有事件绑定
```

### 加载顺序（index.html中的script标签顺序）
state → utils → dialogs → saves → ui → achievements → prompts → templates → tavern → ai → core → init

### 实现顺序
1. state.js — 纯数据，无依赖
2. utils.js + dialogs.js — 工具函数
3. saves.js — 存档系统
4. ui.js — 渲染函数（含updateOptionButtons资源检测版）
5. achievements.js — 成就系统
6. prompts.js — 提示词管理
7. templates.js — 模板系统
8. tavern.js — 酒馆
9. ai.js — AI聊天
10. core.js — 游戏核心循环
11. init.js — 事件绑定和启动

每写完一个模块，在浏览器F12测试该模块的全局函数是否可访问。

## 给用户的任务

1. **不要删当前文件夹**——server.js/index.html/style.css/themes/templates都是好的
2. 等新老师重写完 `public/js/` 模块后，**硬刷新**（Ctrl+Shift+R）
3. 打开 F12 控制台，运行基本检查：
   ```js
   console.log(typeof gameState, typeof showDialog, typeof getSaveKey, typeof updateOptionButtons)
   ```
   四个都应该是 `"object"` `"function"` `"function"` `"function"`
4. 然后按之前给出的10步验证流程走一遍

## 当前 app.js 已知问题清单

1. 故事框不累积（每次覆盖）
2. 资源检测可能不生效（fieldHistory更新时序问题）
3. 成就编辑器弹窗可能被成就面板遮挡（z-index）
4. 添加字段选区段的对话框可能没触发（因为函数签名变了但调用处还是同步）
5. 部分浏览器原生prompt/confirm/alert还没替换为自定义对话框
6. 设置恢复原始提示词后编辑器不刷新

——以上问题在新老师重写时都会被自然解决，因为是从零写清晰代码。

## 测试方法

浏览器打开 `http://localhost:3000`，F12粘贴：
```js
// 快速诊断
console.log('gameState:', typeof gameState);
console.log('showDialog:', typeof showDialog);
console.log('updateOptionButtons:', typeof updateOptionButtons);
console.log('renderAchievementsPanel:', typeof renderAchievementsPanel);
console.log('getSaveKey:', getSaveKey('test', 0));
console.log('fieldHistory:', gameState.fieldHistory ? '存在' : '缺失');
console.log('achievementFlags:', gameState.achievementFlags ? '存在' : '缺失');
```
