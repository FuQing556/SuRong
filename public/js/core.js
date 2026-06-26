/* ═══════════════════════════════════════════
   core.js — 游戏核心循环：解析/渲染/消息/选择/存档/结局
   依赖：state.js, utils.js, dialogs.js, saves.js, ui.js, achievements.js, ai.js
   ═══════════════════════════════════════════ */

// ── 解析 AI 响应 ──
function parseAIResponse(text, template) {
  const result = {
    sceneType: '', settlement: '', situation: '', options: [],
    fields: {},
    raw: text,
  };

  // 场景类型
  const sceneMatch = text.match(/\[场景类型[：:]\s*(.+?)\]/);
  if (sceneMatch) result.sceneType = sceneMatch[1].trim();

  // 上回合结算
  const settleMatch = text.match(/上回合[：:]\s*([\s\S]*?)(?=现状[：:])/);
  if (settleMatch) {
    result.settlement = settleMatch[1].trim();
    if (result.settlement === '游戏开始。' || result.settlement === '游戏开始') result.settlement = '';
  }

  // 现状
  const sitMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动[：:]|$)/);
  if (sitMatch) result.situation = sitMatch[1].trim();
  else {
    const looseMatch = text.match(/现状[：:]\s*([\s\S]*?)(?=可选行动|请选择|\n\n|$)/);
    if (looseMatch) result.situation = looseMatch[1].trim();
    else result.situation = text.substring(0, Math.min(200, text.length));
  }

  // 选项
  const optMatch = text.match(/可选行动[：:]\s*([\s\S]*?)(?=请选择你的行动|状态栏|$)/);
  if (optMatch) {
    const optText = optMatch[1].trim();
    optText.split('\n').filter(l => l.trim()).forEach(line => {
      const m = line.match(/^(.+?)\s*[—–\-]{1,2}\s*(.+)$/);
      if (m) result.options.push({ action: m[1].trim(), cost: m[2].trim() });
      else if (line.trim()) result.options.push({ action: line.trim(), cost: '未知代价' });
    });
  }

  // 字段提取
  const sections = template?.outputSections || FALLBACK_TEMPLATE.outputSections;
  for (const [sectionKey, section] of Object.entries(sections)) {
    const fields = section.fields || [];
    for (const field of fields) {
      result.fields[field.id] = extractField(text, field.label);
    }
  }

  return result;
}

// ── 渲染游戏状态 ──
function renderGameState(parsed, template) {
  const placeholder = document.getElementById('initial-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  if (parsed.sceneType) {
    parsedLastSceneType = parsed.sceneType;
    switchSceneImage(parsed.sceneType, template);
  }

  if (parsed.settlement) {
    dom.settlementContent.textContent = parsed.settlement;
    dom.settlementBox.style.display = '';
  } else {
    dom.settlementBox.style.display = 'none';
  }

  if (parsed.situation) {
    const ph = document.getElementById('initial-placeholder');
    if (ph) ph.style.display = 'none';
    const roundNum = gameState.fullHistory.filter(m => m.role === 'user').length;
    const lastChoice = gameState._lastChoiceText || '';
    gameState._lastChoiceText = '';
    const entry = document.createElement('div');
    entry.className = 'story-entry story-fade-in';
    let entryHtml = '<div class="story-round-badge">第' + roundNum + '回合</div>';
    if (lastChoice) entryHtml += '<div class="story-choice-inline">▸ ' + escapeHtml(lastChoice) + '</div>';
    if (parsed.settlement) entryHtml += '<div class="story-settlement-inline">◂ ' + escapeHtml(parsed.settlement) + '</div>';
    entryHtml += '<div class="story-situation">' + escapeHtml(parsed.situation) + '</div>';
    entry.innerHTML = entryHtml;
    dom.storyContent.appendChild(entry);
    const entries = dom.storyContent.querySelectorAll('.story-entry');
    if (entries.length > 20) {
      entries[0].remove();
      // 显示截断提示，引导玩家使用历程回顾
      let notice = document.getElementById('truncation-notice');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'truncation-notice';
        notice.style.cssText = 'text-align:center;font-size:11px;color:var(--text-dim);padding:6px 0;border-bottom:1px solid var(--border);margin-bottom:8px;';
        notice.textContent = '📜 仅显示最近20回合 · 完整记录请点击 📜历程 查看';
        dom.storyContent.insertBefore(notice, dom.storyContent.firstChild);
      }
    }
    // 只有用户在底部（容差50px）才自动滚动，避免打断阅读旧内容
    const sb = $('#story-box');
    const atBottom = sb.scrollHeight - sb.scrollTop - sb.clientHeight < 50;
    if (atBottom) sb.scrollTop = sb.scrollHeight;
  }

  // 读档时跳过字段更新，保留存档中的完整 fieldHistory（含手动修改的数值）
  if (!gameState._loadingSave) updateFieldHistoryFromParsed(parsed);
  updateOptionButtons(parsed.options);
  gameState.currentOptions = parsed.options;
  updateAllDynamicFields(parsed.fields, template);

  // 结局检测（读档时跳过，避免重弹结局窗）
  var endingType = null;
  if (!gameState._loadingSave) {
    endingType = detectEnding(parsed.raw);
    if (endingType) {
      gameState.achievementFlags.endingTriggered = true;
      gameState.achievementFlags.endingType = endingType;
      if (!gameState.achievementFlags.triggeredEndings) gameState.achievementFlags.triggeredEndings = [];
      if (gameState.achievementFlags.triggeredEndings.indexOf(endingType) === -1) {
        gameState.achievementFlags.triggeredEndings.push(endingType);
        setTimeout(function() { showEndingOverlay(endingType, parsed); }, 800);
      }
    }
  }

  // 行为标记
  if (gameState.achievementFlags.gambitChosen) {
    gameState.achievementFlags.gambitChosen = false;
    // 优先用客户端真实骰子结果，回退到 AI 文本关键词检测
    var diceResult = gameState._lastDiceResult;
    var gambitSuccess = diceResult ? diceResult.success : /赌对了|运气在|成了|如愿|得手|翻盘|逆转|成功|顺利|赢了|赌赢|押对/.test(parsed.raw);
    if (gambitSuccess) {
      gameState.achievementFlags.gambitSucceeded = true;
      gameState.achievementFlags.gambitSuccessCount = (gameState.achievementFlags.gambitSuccessCount || 0) + 1;
    }
    gameState._lastDiceResult = null;
  }
  if (/反杀|设局成功|反制|翻盘|中计|落入.*陷阱/.test(parsed.raw)) {
    gameState.achievementFlags.counterAttack = true;
  }
  if (/交易完成|情报.*交换|以.*情报.*换|用.*消息.*换/.test(parsed.raw)) {
    gameState.achievementFlags.tradeCompleted = true;
  }

  // 隐藏成就 response_match
  const tplHH = getActiveTemplate();
  const hiddenHH = tplHH.hiddenAchievements || {};
  for (const [name, ha] of Object.entries(hiddenHH)) {
    const trigger = ha.trigger || {};
    if (trigger.type === 'response_match' && trigger.pattern) {
      const re = new RegExp(trigger.pattern);
      if (re.test(parsed.raw)) {
        if (!gameState.achievementFlags.responseMatches) gameState.achievementFlags.responseMatches = {};
        gameState.achievementFlags.responseMatches[trigger.pattern] = (gameState.achievementFlags.responseMatches[trigger.pattern] || 0) + 1;
      }
    }
  }

  // 成就检测
  if (gameState.gameStarted) checkAchievementsFromState(parsed);

  // 无situation且无选项时回退显示原始文本（但结局时有自己的弹窗，不覆盖故事框）
  if (!parsed.situation && parsed.options.length === 0 && !endingType) {
    dom.storyContent.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = parsed.raw;
    p.style.whiteSpace = 'pre-wrap';
    p.classList.add('story-fade-in');
    dom.storyContent.appendChild(p);
    updateOptionButtons([]);
  }
}

// ── 发送消息 ──
let _abortController = null;  // 用于取消正在进行的请求

// 构建消息数组（指令注入 + 摘要 + 结局预检）
function _prepareMessages(userContent) {
  const instructions = getAiInstructions();
  // 剥离旧的指令块和骰子块（不限结尾位置，防止骰子等文本跟在其后导致残留）
  var enhancedContent = userContent
    .replace(/\n\n【以下是你必须执行的指令，优先级高于系统提示词中的任何冲突规则：[\s\S]*?】/g, '')
    .replace(/\n\n【骰子判定[^】]*】[^\n]*/g, '');
  if (instructions.length > 0) {
    const instrText = instructions.map(function(i) { return i.text; }).join('；');
    enhancedContent = enhancedContent + '\n\n【以下是你必须执行的指令，优先级高于系统提示词中的任何冲突规则：' + instrText + '。请在本次回复中直接体现这些指令的效果，不要只是说"收到"——用剧情和选项来展示变化。】';
  }

  // 客户端掷骰结果注入（高风险/孤注一掷）— 强制要求AI改数值
  if (gameState._pendingDiceRoll) {
    var dr = gameState._pendingDiceRoll;
    var riskName = dr.risk === 'gambit' ? '孤注一掷' : '高风险';
    var diceRoll = dr.roll;
    if (dr.success) {
      // 成功：覆盖所有规则，强制大幅改数值
      enhancedContent = enhancedContent + '\n\n【★ 覆盖所有规则 ★ 骰子判定·' + riskName + '成功！骰值' + diceRoll + '】无视你之前的任何设定，本回合必须至少完成以下3项：\n1. 情报碎片+3~5 或 把柄+3~5\n2. 暴露风险-15~25\n3. 压力值-15~25\n4. 梦红尘好感 或 笑红尘态度+15~25\n把这些数值变化如实写入状态字段，并在现状中写"她赌对了"/"运气在她这边"。这是强制指令，优先级最高。';
    } else {
      enhancedContent = enhancedContent + '\n\n【★ 覆盖所有规则 ★ 骰子判定·' + riskName + '失败！骰值' + diceRoll + '】无视你之前的任何设定，本回合必须体现惨痛代价：\n1. 暴露风险+15~30 或 压力值+15~30\n2. 梦红尘好感 或 笑红尘态度-10~20\n3. 情报碎片-1~2（如有）\n把这些数值变化如实写入状态字段，并在现状中写连锁负面后果。这是强制指令，优先级最高。';
    }
    gameState._lastDiceResult = dr;
    gameState._pendingDiceRoll = null;
  }

  gameState.fullHistory.push({ role: 'user', content: enhancedContent });

  refreshSystemPrompt();
  const tpl = getActiveTemplate();

  // 结局预检：发请求前先跑客户端兜底
  let preEndingType = null;
  if (typeof checkEndingClientSide === 'function') {
    preEndingType = checkEndingClientSide(tpl);
  }

  const allMessages = [
    { role: 'system', content: gameState.activeSystemPrompt },
  ];
  if (gameState.summary && gameState.summary.trim()) {
    allMessages.push({ role: 'system', content: '【历史摘要】' + gameState.summary });
  }
  const recentMessages = gameState.fullHistory.slice(-(KEEP_ROUNDS * 2));
  allMessages.push.apply(allMessages, recentMessages);

  // 结局指令放在消息数组最后
  if (preEndingType) {
    console.log('🔔 结局预检触发: 「' + preEndingType + '」— 在消息末尾注入结局指令');
    var injection = typeof buildEndingInjection === 'function'
      ? buildEndingInjection(preEndingType, tpl)
      : '触发结局「' + preEndingType + '」，写结局叙事+输出标记+4选项';
    allMessages.push({ role: 'system', content: injection });
  }

  return { allMessages: allMessages, tpl: tpl, preEndingType: preEndingType };
}

// SSE 流式读取 + 实时预览
async function _streamResponse(resp, liveEl) {
  dom.loadingIndicator.classList.add('hidden');
  if (dom.optionsContainer) dom.optionsContainer.style.visibility = '';
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let streamBuffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    streamBuffer += decoder.decode(value, { stream: true });
    const lines = streamBuffer.split('\n');
    streamBuffer = lines.pop() || '';
    for (var i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('data: ') && line.length > 6) {
        try {
          const json = JSON.parse(line.slice(6));
          // 检测 API 错误（如余额不足、key无效等）
          if (json.error) {
            throw new Error('API 错误: ' + (json.error.message || JSON.stringify(json.error)));
          }
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            let displayText = fullContent;
            displayText = displayText.replace(/\[场景类型[：:][^\]]*\]/g, '');
            displayText = displayText.replace(/\[事件大小[：:][^\]]*\]/g, '');
            displayText = displayText.replace(/【事件大小[：:][^】]*】/g, '');
            const optIdx = displayText.search(/可选行动[：:]/);
            if (optIdx >= 0) displayText = displayText.substring(0, optIdx) + '\n\n▌ 正在生成选项...';
            if (displayText.length > 800) displayText = displayText.substring(0, 800) + '…';
            liveEl.textContent = displayText;
            var sb3 = $('#story-box');
            if (sb3.scrollHeight - sb3.scrollTop - sb3.clientHeight < 50) sb3.scrollTop = sb3.scrollHeight;
          }
        } catch (e) { /* 跳过非JSON行 */ }
      }
    }
  }
  return fullContent;
}

// 结局检测 + 渲染 + 存档
function _handleParsedResponse(fullContent, tpl, parsed) {
  gameState.fullHistory.push({ role: 'assistant', content: fullContent });

  parsed = parsed || parseAIResponse(fullContent, tpl);
  let endingType = detectEnding(fullContent);

  // 硬兜底：AI未触发但客户端检测到条件满足 → 注入标记，由renderGameState统一弹窗
  if (!endingType && typeof checkEndingClientSide === 'function') {
    const clientEnding = checkEndingClientSide(tpl);
    if (clientEnding) {
      console.log('🔔 客户端结局兜底触发: ' + clientEnding);
      endingType = clientEnding;
      gameState.achievementFlags.endingTriggered = true;
      gameState.achievementFlags.endingType = clientEnding;
      // 注意：不要在这里 push triggeredEndings，交由 renderGameState 统一处理弹窗+记录
      parsed.raw = parsed.raw + '\n【游戏结束·' + clientEnding + '】';
      fullContent = fullContent + '\n【游戏结束·' + clientEnding + '】';
      gameState.fullHistory[gameState.fullHistory.length - 1].content = fullContent;
      if (!parsed.situation || parsed.situation.length < 20) {
        var inj = typeof buildEndingInjection === 'function'
          ? buildEndingInjection(clientEnding, tpl) : '';
        var descM = inj.match(/结局主题[：:]\s*(.+?)[。]/);
        parsed.situation = '【' + clientEnding + '】\n' + (descM ? descM[1] : '这一刻终于到来。' + clientEnding + '。');
      }
    }
  }

  // AI返回了故事但漏了选项 且 非结局 → 视为格式异常
  if (parsed.options.length === 0 && !endingType) {
    gameState.fullHistory.pop();
    throw new Error('AI 返回格式异常：未包含可选行动。请点击重试。');
  }

  renderGameState(parsed, tpl);
  gameState.gameStarted = true;
  saveGameState();
}

async function sendMessage(userContent) {
  if (gameState.isLoading) return;
  // 清理上一次失败请求残留的user消息
  if (gameState.fullHistory.length > 0 &&
      gameState.fullHistory[gameState.fullHistory.length - 1].role === 'user') {
    gameState.fullHistory.pop();
  }
  gameState.isLoading = true;
  showLoading(true);
  dom.errorBox.classList.add('hidden');
  updateOptionButtons([]);

  _abortController = new AbortController();
  const timeoutId = setTimeout(function() { _abortController.abort(); }, 60000);
  let liveEl = null;

  try {
    var prep = _prepareMessages(userContent);
    await maybeSummarize();

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: prep.allMessages,
        summary: null,
        systemPrompt: null,
        template: { id: prep.tpl.id, outputSections: prep.tpl.outputSections, promptBody: prep.tpl.promptBody },
        apiKey: localStorage.getItem(LS_KEYS.apikey) || '',
      }),
      signal: _abortController.signal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(function() { return { error: 'HTTP ' + resp.status }; });
      throw new Error(errData.error || '请求失败 (' + resp.status + ')');
    }

    // 创建流式预览元素
    liveEl = document.createElement('div');
    liveEl.className = 'story-entry story-streaming';
    liveEl.style.cssText = 'white-space:pre-wrap;';
    dom.storyContent.appendChild(liveEl);

    var fullContent = await _streamResponse(resp, liveEl);
    liveEl.remove();
    showLoading(false);

    _handleParsedResponse(fullContent, prep.tpl, null);

  } catch (err) {
    clearTimeout(timeoutId);
    if (liveEl && liveEl.parentNode) liveEl.remove();
    console.error('请求失败:', err);
    if (err.name === 'AbortError') {
      if (!gameState._cancelledByUser) {
        showError('请求超时（60秒）。请检查网络连接，或在设置页确认 API Key 有效。');
      }
      gameState._cancelledByUser = false;
    } else {
      showError(err.message);
    }
    if (gameState.fullHistory.length > 0 &&
        gameState.fullHistory[gameState.fullHistory.length - 1].role === 'assistant') {
      gameState.fullHistory.pop();
    }
  } finally {
    clearTimeout(timeoutId);
    _abortController = null;
    gameState.isLoading = false;
    showLoading(false);
  }
}

// ── 处理选择 ──
async function handleChoice(num) {
  if (gameState.isLoading) return;
  const btn = dom.optionBtns[num - 1];
  if (btn && btn.disabled) return;
  const chosenOption = gameState.currentOptions[num - 1];
  if (chosenOption) {
    gameState._lastChoiceText = chosenOption.action || ('选项 ' + num);
    const fullText = (chosenOption.action || '') + ' ' + (chosenOption.cost || '');
    if (fullText.includes('孤注一掷')) gameState.achievementFlags.gambitChosen = true;

    // 客户端掷骰（高风险/孤注一掷，替代 AI 幕后掷骰）
    var riskLevel = null;
    if (fullText.includes('孤注一掷')) riskLevel = 'gambit';
    else if (fullText.includes('高风险')) riskLevel = 'high';
    if (riskLevel) {
      var roll = Math.floor(Math.random() * 100) + 1;
      var success = riskLevel === 'gambit' ? (roll >= 71) : (roll >= 51);
      gameState._pendingDiceRoll = { risk: riskLevel, roll: roll, success: success };
    } else {
      gameState._pendingDiceRoll = null;
    }

    // 隐藏成就 choice 类型检测
    const tplC = getActiveTemplate();
    const hiddenC = tplC.hiddenAchievements || {};
    for (const [name, ha] of Object.entries(hiddenC)) {
      const trigger = ha.trigger || {};
      if (trigger.type === 'choice' && trigger.pattern) {
        const re = new RegExp(trigger.pattern);
        if (re.test(chosenOption.action || '') || re.test(chosenOption.cost || '')) {
          if (!gameState.achievementFlags.choiceCounts) gameState.achievementFlags.choiceCounts = {};
          gameState.achievementFlags.choiceCounts[trigger.pattern] = (gameState.achievementFlags.choiceCounts[trigger.pattern] || 0) + 1;
        }
      }
    }
  }
  await sendMessage('选择 ' + num);
}

// ── 重试上次请求 ──
async function retryLastRequest() {
  // 清理上次失败的assistant回复（如果有）
  if (gameState.fullHistory.length > 0 &&
      gameState.fullHistory[gameState.fullHistory.length - 1].role === 'assistant') {
    gameState.fullHistory.pop();
  }
  var lastUserMsg = null;
  for (var ri = gameState.fullHistory.length - 1; ri >= 0; ri--) {
    if (gameState.fullHistory[ri].role === 'user') { lastUserMsg = gameState.fullHistory[ri]; break; }
  }
  if (lastUserMsg) {
    const idx = gameState.fullHistory.lastIndexOf(lastUserMsg);
    if (idx >= 0) gameState.fullHistory.splice(idx, 1);
    await sendMessage(lastUserMsg.content);
  }
}

// ── 摘要管理 ──
async function maybeSummarize() {
  const totalMessages = gameState.fullHistory.length;
  const unsummarised = totalMessages - gameState.summarisedCount;
  const TRIGGER = KEEP_ROUNDS * 2 + 4;
  if (unsummarised <= TRIGGER) return;
  const keepStart = Math.max(0, totalMessages - KEEP_ROUNDS * 2);
  const toSummarise = gameState.fullHistory.slice(gameState.summarisedCount, keepStart);
  if (toSummarise.length < 4) return;
  try {
    const resp = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: toSummarise, previousSummary: gameState.summary }),
    });
    if (resp.ok) {
      const data = await resp.json();
      gameState.summary = data.summary;
      gameState.summarisedCount = keepStart;
    }
  } catch (err) { console.warn('摘要更新失败:', err); }
}

// ── 开始新游戏 ──
async function startNewGame() {
  try {
    console.log('startNewGame: begin');
    // 彻底重置状态
    gameState.fullHistory = [];
    gameState.summary = '';
    gameState.summarisedCount = 0;
    gameState.currentOptions = [];
    gameState._lastChoiceText = '';
    gameState.gameStarted = false;
    gameState.isLoading = false;

    // 清除旧存档
    const tplIdCl = gameState.activeSaveId || 'default';
    localStorage.removeItem(getSaveKey(tplIdCl, 0));
    gameState.fieldHistory = {};
    gameState._pendingDiceRoll = null;
    gameState._lastDiceResult = null;
    gameState.achievementFlags = {
      gambitChosen: false, gambitSucceeded: false, gambitSuccessCount: 0,
      endingTriggered: false, endingType: '', triggeredEndings: [],
      counterAttack: false, tradeCompleted: false,
      choiceCounts: {}, responseMatches: {},
    };

    if (!dom.storyContent) { console.error('storyContent missing'); return; }
    dom.storyContent.innerHTML = '<div id="initial-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:20px;"><p class="placeholder-text">命运之轮重新转动...</p></div>';
    if (dom.errorBox) dom.errorBox.classList.add('hidden');
    if (dom.settlementContent) dom.settlementContent.textContent = '—';
    if (dom.settlementBox) dom.settlementBox.style.display = 'none';

    const tpl = getActiveTemplate();
    console.log('startNewGame: template', tpl?.name, 'openingMessages:', tpl?.openingMessages?.length || 0);
    renderStatusContainers(tpl);
    updateAllDynamicFields({}, tpl);
    updateOptionButtons([]);
    switchSceneImage('日常', tpl);

    clearAiInstructions();
    renderAiChatMessages();

    var openings = tpl.openingMessages;
    if (!openings || !Array.isArray(openings) || openings.length === 0) {
      openings = ['开始游戏。【开局编号：1】'];
    }
    var openingMsg = openings[Math.floor(Math.random() * openings.length)] || '开始游戏。';
    console.log('startNewGame: sending', openingMsg.substring(0, 30));
    showLoading(true);
    await sendMessage(openingMsg);
  } catch (e) {
    console.error('startNewGame error:', e);
    showError('启动失败: ' + (e.message || '未知错误'));
    gameState.isLoading = false;
    showLoading(false);
  }
}

// ── 继续游戏（多槽位版）──
async function continueGame(saveId) {
  try {
  const ov = $('#save-selector-overlay');
  if (ov) ov.classList.remove('active');

  const template = await loadAndMergeTemplate(saveId);
  if (!template) { console.error('Template not found'); return; }

  // 多槽位扫描
  let savesAvail = [];
  for (let s = 0; s < 10; s++) {
    const d = loadGameState(saveId, s);
    if (d) savesAvail.push({ slot: s, data: d });
  }
  if (savesAvail.length === 0) { selectSave(saveId); return; }

  let saveData;
  if (savesAvail.length === 1) {
    saveData = savesAvail[0].data;
  } else {
    savesAvail.sort(function(a, b) { return b.data.lastPlayed - a.data.lastPlayed; });
    const lines = savesAvail.map(function(s) {
      return '槽位' + s.slot + ': 第' + s.data.roundNumber + '回合 (' + new Date(s.data.lastPlayed).toLocaleString('zh-CN') + ')';
    });
    const choice = await dlPrompt('有多个存档：\n' + lines.join('\n') + '\n\n输入槽位编号读取，输入"删X"删除槽位X，取消则读取最新');
    if (!choice || !choice.trim()) {
      saveData = savesAvail[0].data;
    } else if (choice.startsWith('删')) {
      const ds = parseInt(choice.replace('删', '').trim());
      if (!isNaN(ds) && savesAvail.some(function(s) { return s.slot === ds; })) {
        const confirmed = await dlConfirm('确定删除槽位' + ds + '？');
        if (confirmed) {
          localStorage.removeItem(getSaveKey(saveId, ds));
          const rem = [];
          for (let rs = 0; rs < 10; rs++) {
            const rd = loadGameState(saveId, rs);
            if (rd) rem.push({ slot: rs, data: rd });
          }
          if (rem.length === 0) { selectSave(saveId); return; }
          saveData = rem.length === 1 ? rem[0].data : rem.sort(function(a, b) { return b.data.lastPlayed - a.data.lastPlayed; })[0].data;
        } else {
          saveData = savesAvail[0].data;
        }
      } else {
        saveData = savesAvail[0].data;
      }
    } else {
      const chosen = savesAvail.find(function(s) { return s.slot === parseInt(choice); });
      saveData = chosen ? chosen.data : savesAvail[0].data;
    }
  }

  gameState.activeTemplate = template;
  gameState.activeSaveId = saveId;
  localStorage.setItem(LS_KEYS.lastSaveId, saveId);
  gameState.fullHistory = saveData.fullHistory || [];
  gameState.summary = saveData.summary || '';
  gameState.summarisedCount = saveData.summarisedCount || 0;
  gameState.currentOptions = saveData.currentOptions || [];
  gameState._lastChoiceText = '';
  gameState.fieldHistory = saveData.fieldHistory || {};
  // 为模板新增字段（存档时还不存在的）初始化默认值
  for (var secKey in template.outputSections) {
    if (!template.outputSections.hasOwnProperty(secKey)) continue;
    var secFields = template.outputSections[secKey].fields || [];
    for (var sfi = 0; sfi < secFields.length; sfi++) {
      var sf = secFields[sfi];
      if (!gameState.fieldHistory[sf.id]) {
        gameState.fieldHistory[sf.id] = sf.type === 'number'
          ? { current: 0, max: 0 }
          : { currentText: '—' };
      }
    }
  }
  gameState.achievementFlags = saveData.achievementFlags || {
    gambitChosen: false, gambitSucceeded: false, gambitSuccessCount: 0,
    endingTriggered: false, endingType: '', triggeredEndings: [],
    counterAttack: false, tradeCompleted: false,
    choiceCounts: {}, responseMatches: {},
  };
  // 兼容旧存档无 triggeredEndings 字段
  if (!gameState.achievementFlags.triggeredEndings) {
    gameState.achievementFlags.triggeredEndings = [];
  }
  gameState.gameStarted = true;
  gameState.isLoading = false;

  const savedTheme = saveData.theme || template.theme || 'dark';
  localStorage.setItem(LS_KEYS.theme(saveId), savedTheme);
  applyTheme(savedTheme);
  refreshSystemPrompt();
  renderStatusContainers(template);
  localStorage.setItem(LS_KEYS.activeTemplateId, saveId);

  // 渲染最后一回合（跳过成就检测，避免读档时重复触发）
  // 清空故事面板，防止切换存档时旧存档故事残留累加
  dom.storyContent.innerHTML = '';
  dom.settlementBox.style.display = 'none';
  const lastAiMsg = [...gameState.fullHistory].reverse().find(m => m.role === 'assistant');
  if (lastAiMsg) {
    gameState._loadingSave = true;
    try {
      const parsed = parseAIResponse(lastAiMsg.content, template);
      renderGameState(parsed, template);
    } finally {
      gameState._loadingSave = false;
    }
  } else {
    updateOptionButtons([]);
    updateAllDynamicFields({}, template);
  }
  } catch (e) {
    console.error('continueGame 失败:', e);
    dlAlert('❌ 读取存档失败: ' + (e.message || '未知错误')).catch(function(){});
  }
}

// ── 撤销上一步 ──
async function undoLastRound() {
  if (gameState.isLoading) return;
  if (gameState.fullHistory.length < 2) {
    await dlAlert('没有可撤销的步骤');
    return;
  }
  const confirmed = await dlConfirm('撤销上一步操作，回到上一回合？');
  if (!confirmed) return;
  const lui = gameState.fullHistory.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
  if (lui === undefined || lui >= gameState.fullHistory.length - 1) return;
  gameState.fullHistory.splice(lui);
  gameState.currentOptions = [];
  gameState.isLoading = false;
  // 撤销后清理摘要，防止AI看到已撤销事件的旧摘要
  // 撤销后尝试从剩余历史重建摘要（而非全部丢弃）
  gameState.summary = '';
  gameState.summarisedCount = 0;
  if (gameState.fullHistory.length > 8) {
    maybeSummarize().catch(function(){});
  }
  const lastAi = [...gameState.fullHistory].reverse().find(m => m.role === 'assistant');
  if (lastAi) {
    const tpl = getActiveTemplate();
    const parsed = parseAIResponse(lastAi.content, tpl);
    dom.storyContent.innerHTML = '';
    dom.settlementBox.style.display = 'none';
    renderGameState(parsed, tpl);
  } else {
    dom.storyContent.innerHTML = '<div id="initial-placeholder"><p class="placeholder-text">命运之轮重新转动...</p></div>';
    updateOptionButtons([]);
    updateAllDynamicFields({}, getActiveTemplate());
  }
  saveGameState();
}

// ── 手动存档 ──
async function manualSave() {
  if (!gameState.gameStarted || gameState.isLoading) return;
  const tplId = gameState.activeSaveId || getActiveTemplate().id || 'default';
  // 从上一次使用的槽位之后轮转，避免总覆写槽位1
  const lastSlotKey = LS_KEYS.lastManualSlot(tplId);
  let startSlot = parseInt(localStorage.getItem(lastSlotKey) || '0') || 0;
  let slot = startSlot + 1;
  if (slot > 9) slot = 1;
  // 找下一个空槽
  let found = false;
  for (let i = 0; i < 9; i++) {
    const trySlot = ((slot - 1 + i) % 9) + 1;
    if (!localStorage.getItem(getSaveKey(tplId, trySlot))) {
      slot = trySlot; found = true; break;
    }
  }
  if (!found) {
    // 全部满，轮转到下一个
    slot = startSlot + 1;
    if (slot > 9) slot = 1;
    const confirmed = await dlConfirm('所有存档槽位已满（1-9），将覆盖槽位' + slot + '的旧存档。是否继续？');
    if (!confirmed) return;
  }
  localStorage.setItem(lastSlotKey, String(slot));
  saveGameState(slot);
  if (gameState._saveFailed) {
    dlAlert('⚠ 存档失败！localStorage 空间可能不足，请清理浏览器数据或导出故事备份。');
  } else {
    dlAlert('💾 已存档到槽位 ' + slot + '（第' + gameState.fullHistory.filter(m => m.role === 'user').length + '回合）');
  }
}

// ── 结局弹窗 ──
function showEndingOverlay(endingType, parsed) {
  const tpl = getActiveTemplate();
  // 根据关键词动态匹配图标，不硬编码具体结局名
  const iconMap = [
    [/崩|溃|碎|裂|破|毁|亡|死|灭|终|尽|绝/, '💔'],
    [/暴露|揭穿|发现|捕获|落网|陷阱/, '🚨'],
    [/撤离|逃离|逃脱|逃出|逃命|出走/, '🏃'],
    [/反杀|反制|逆转|翻盘|复仇|反击/, '👑'],
    [/成|胜|赢|王|冠|巅|顶|极|升|圆满/, '👑'],
    [/战|斗|决|赛|竞|擂/, '⚔'],
    [/光|明|新|始|曙|晨|希望|重生|轮回/, '✨'],
    [/暗|黑|堕|沉|沦|深渊|地狱/, '🌑'],
    [/爱|情|恋|婚|眷|缘/, '💕'],
    [/牺牲|献身|守护|拯救|舍/, '🕊️'],
  ];
  let icon = '🎭';
  for (const [re, emoji] of iconMap) {
    if (re.test(endingType)) { icon = emoji; break; }
  }
  $('#ending-icon').textContent = icon;
  $('#ending-title').textContent = '结局：' + endingType;
  var rawNarrative = parsed.situation || parsed.raw || '故事到此结束。';
  $('#ending-narrative').textContent = rawNarrative.length > 600 ? rawNarrative.substring(0, 600) + '…' : rawNarrative;

  const rn = gameState.fieldHistory['round']?.current || gameState.fullHistory.filter(m => m.role === 'user').length;
  const uc = Object.keys(getUnlockedAchievements()).length;
  const ta = Object.keys(getAchievements()).length + Object.keys(tpl.hiddenAchievements || {}).length;
  let sh = '<div class="ending-stat"><span class="ending-stat-label">🔄 总回合数</span><span class="ending-stat-value">' + rn + '</span></div>';
  sh += '<div class="ending-stat"><span class="ending-stat-label">🏆 成就解锁</span><span class="ending-stat-value">' + uc + '/' + ta + '</span></div>';
  sh += '<div class="ending-stat"><span class="ending-stat-label">📋 模板</span><span class="ending-stat-value">' + escapeHtml(tpl.name || '') + '</span></div>';
  sh += '<div class="ending-stat"><span class="ending-stat-label">⚡ 结局类型</span><span class="ending-stat-value">' + endingType + '</span></div>';
  const sf = [...(tpl.outputSections?.statusTop?.fields || []), ...(tpl.outputSections?.taskLine?.fields || [])];
  sf.forEach(f => {
    if (f.type === 'number') {
      const h = gameState.fieldHistory[f.id];
      sh += '<div class="ending-stat"><span class="ending-stat-label">' + escapeHtml(f.icon || '') + ' ' + escapeHtml(f.label) + '</span><span class="ending-stat-value">' + escapeHtml(String(h ? (h.current || h.currentText || '—') : '—')) + '</span></div>';
    }
  });
  $('#ending-stats').innerHTML = sh;
  $('#ending-overlay').classList.add('active');

  // 自动解锁所有"结局触发"类成就
  var allAch = getAchievements();
  for (var ak in allAch) {
    if (allAch.hasOwnProperty(ak) && /(结局|命运|崩坏|尘埃)/.test(allAch[ak].desc || '')) {
      unlockAchievement(ak);
    }
  }
}

function closeEndingOverlay() {
  $('#ending-overlay').classList.remove('active');
}

// ── 历程回顾弹窗 ──
function renderHistoryModal() {
  if (gameState.fullHistory.length === 0) {
    dlAlert('还没有游戏内容');
    return;
  }
  const tpl = getActiveTemplate();
  const body = $('#history-body');
  if (!body) return;

  const fl = {};
  for (const sec of Object.values(tpl.outputSections || {})) {
    for (const f of sec.fields || []) fl[f.id] = f.label;
  }

  let html = '', rn = 0;
  for (let i = 0; i < gameState.fullHistory.length; i++) {
    const msg = gameState.fullHistory[i];
    if (msg.role === 'user') {
      if (msg.content.startsWith('开始游戏')) continue;
      rn++;
      const pa = i > 0 ? gameState.fullHistory[i - 1] : null;
      let c = msg.content.replace(/^选择\s*/, '');
      if (pa && pa.role === 'assistant') {
        const opts = parseAIResponse(pa.content, tpl).options;
        const idx = parseInt(c) - 1;
        if (opts[idx]) c = (opts[idx].action || c).replace(/^\d+[\.\、\s]+/, '');
      }
      html += '<div class="hist-round"><span class="hist-round-num">第' + rn + '回合</span> <span class="hist-choice">▸ ' + escapeHtml(c) + '</span></div>';
    } else {
      const parsed = parseAIResponse(msg.content, tpl);
      if (parsed.settlement && parsed.settlement !== '游戏开始。' && parsed.settlement !== '游戏开始') {
        html += '<div class="hist-settlement">' + escapeHtml(parsed.settlement) + '</div>';
      }
      if (parsed.situation) html += '<div class="hist-situation">' + escapeHtml(parsed.situation) + '</div>';
      const ns = Object.entries(parsed.fields).filter(([id, v]) => !isNaN(parseInt(v)) && v.trim());
      if (ns.length > 0) {
        html += '<div class="hist-fields">' + ns.map(function(kv) { return escapeHtml(fl[kv[0]] || kv[0]) + ':<b>' + escapeHtml(kv[1]) + '</b>'; }).join(' · ') + '</div>';
      }
    }
  }
  body.innerHTML = html || '<p style="color:var(--text-dim);">暂无记录</p>';
  $('#history-overlay').classList.add('active');
}

// ── 导出故事 ──
function exportStory() {
  if (gameState.fullHistory.length === 0) {
    dlAlert('还没有游戏内容可导出');
    return;
  }
  const tpl = getActiveTemplate();
  let txt = '《' + tpl.name + '》· 游戏记录\n导出时间：' + new Date().toLocaleString('zh-CN') + '\n' + '═'.repeat(40) + '\n\n';
  let roundN = 0;
  for (let i = 0; i < gameState.fullHistory.length; i++) {
    const msg = gameState.fullHistory[i];
    if (msg.role === 'user') {
      if (msg.content.startsWith('开始游戏')) continue;
      roundN++;
      const prevAi = i > 0 ? gameState.fullHistory[i - 1] : null;
      let chosen = msg.content.replace(/^选择\s*/, '');
      if (prevAi && prevAi.role === 'assistant') {
        const opts = parseAIResponse(prevAi.content, tpl).options;
        const idx = parseInt(chosen) - 1;
        if (opts[idx]) chosen = (opts[idx].action || chosen).replace(/^\d+[\.\、\s]+/, '');
      }
      txt += '\n' + '─'.repeat(30) + '\n第' + roundN + '回合 · ' + chosen + '\n';
    } else {
      const parsed = parseAIResponse(msg.content, tpl);
      if (parsed.settlement && parsed.settlement !== '游戏开始。' && parsed.settlement !== '游戏开始') {
        txt += '  结算：' + parsed.settlement + '\n';
      }
      if (parsed.situation) txt += '  现状：' + parsed.situation + '\n';
      const nfs = Object.entries(parsed.fields).filter(([id, v]) => !isNaN(parseInt(v)) && v.trim());
      if (nfs.length > 0) {
        const fl = {};
        for (const sec of Object.values(tpl.outputSections || {})) {
          for (const f of sec.fields || []) fl[f.id] = f.label;
        }
        txt += '  📊 ' + nfs.map(([id, v]) => (fl[id] || id) + ':' + v).join(' | ') + '\n';
      }
    }
  }
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (tpl.name || 'story') + '_' + new Date().toISOString().slice(0, 10) + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}

console.log('📦 core.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('core');
