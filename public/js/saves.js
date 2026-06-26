/* ═══════════════════════════════════════════
   saves.js — 存档管理 + 成就存储隔离
   依赖：state.js, utils.js, dialogs.js
   ═══════════════════════════════════════════ */

// ── 存档 Key 生成 ──
function getSaveKey(templateId, slot) {
  return LS_KEYS.save(templateId || 'default', slot);
}

// ── 自动/手动存档 ──
// v5: fullHistory 截断到最近 30 轮 + requestIdleCallback 异步写入
function saveGameState(slot) {
  if (!gameState.gameStarted || gameState.fullHistory.length < 2) return;
  const tpl = getActiveTemplate();
  const saveSlot = (slot !== undefined) ? slot : 0;
  const saveKey = getSaveKey(gameState.activeSaveId || tpl.id || 'default', saveSlot);

  // 截断 fullHistory 到最近 30 轮（60条消息），防止 localStorage 膨胀
  const MAX_STORED_ROUNDS = 30;
  var wasTruncated = gameState.fullHistory.length > MAX_STORED_ROUNDS * 2;
  var truncatedHistory = wasTruncated
    ? gameState.fullHistory.slice(-MAX_STORED_ROUNDS * 2)
    : gameState.fullHistory;
  // 截断后重置摘要索引，防止 summarisedCount 越界
  var clampedSummarisedCount = wasTruncated ? 0 : gameState.summarisedCount;
  var clampedSummary = wasTruncated ? '' : gameState.summary;

  const saveData = {
    dataVersion: 2,  // 存档格式版本，continueGame时做兼容迁移
    templateId: gameState.activeSaveId || tpl.id || 'default',
    slot: saveSlot,
    fullHistory: truncatedHistory,
    summary: clampedSummary,
    summarisedCount: clampedSummarisedCount,
    currentOptions: gameState.currentOptions,
    lastPlayed: Date.now(),
    roundNumber: gameState.fullHistory.filter(function(m) { return m.role === 'user'; }).length,
    theme: gameState._currentTheme || tpl.theme || 'dark',
    fieldHistory: gameState.fieldHistory,
    achievementFlags: gameState.achievementFlags,
  };

  // 异步写入 localStorage，避免阻塞 UI 线程
  var _doSave = function() {
    try { localStorage.setItem(saveKey, JSON.stringify(saveData)); gameState._saveFailed = false; }
    catch (e) {
      console.error('💾 存档失败！localStorage 可能已满:', e.message,
        '存档:', saveKey, '大小:', JSON.stringify(saveData).length, '字符');
      gameState._saveFailed = true;
    }
    updateSaveIndicator();
  };

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(_doSave, { timeout: 2000 });
  } else {
    setTimeout(_doSave, 0);
  }
}

// ── 读取存档（纯读取，不修改 gameState）──
function loadGameState(templateId, slot) {
  const saveKey = getSaveKey(templateId, slot !== undefined ? slot : 0);
  try {
    const data = JSON.parse(localStorage.getItem(saveKey));
    if (data && data.fullHistory && data.fullHistory.length > 0) {
      return data;
    }
  } catch (e) { _devWarn('loadGameState corrupted', e); }
  return null;
}

// ── 存档信息（用于显示）──
function getSaveInfo(templateId) {
  let best = null;
  for (let slot = 0; slot < 10; slot++) {
    const key = getSaveKey(templateId, slot);
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data && data.fullHistory && data.fullHistory.length > 0) {
        if (!best || data.lastPlayed > best.lastPlayed) best = data;
      }
    } catch (e) { /* skip corrupt */ }
  }
  if (!best) return null;
  let slotCount = 0;
  for (let s = 0; s < 10; s++) {
    if (localStorage.getItem(getSaveKey(templateId, s))) slotCount++;
  }
  return { roundNumber: best.roundNumber || 0, lastPlayed: best.lastPlayed || 0, hasSave: true, slotCount };
}

// ── 存档列表（我的存档）──
function loadSaves() {
  const saves = [
    {
      id: 'surongrong', name: '苏蓉蓉·潜伏',
      desc: '斗罗大陆世界观。扮演史莱克卧底在日月帝国皇家魂导学院挣扎求生。潜行、博弈、情报、生存。',
      icon: '🌸', type: 'default',
      worldSetting: '斗罗大陆。日月帝国皇家魂导师学院，大陆最先进魂导技术中心。多方势力暗中博弈，魂师大赛临近。',
      protagonist: '苏蓉蓉，18岁女魂师。武魂圣光铃兰（极致之光），64级魂帝。史莱克弃子兼潜伏先发队，在受辱与求存间走钢丝。',
      conflict: '潜伏获取情报换取撤离。平衡各方势力觊觎。在暴露风险、精神崩溃与人格磨损中求生。',
      styles: ['潜行谍战', '社交博弈', '沉沦堕落', '冒险战斗'],
    },
  ];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEYS.saves) || '[]');
    const userSaves = Array.isArray(raw) ? raw : [];
    return [...saves, ...userSaves];
  } catch (e) {
    _devWarn('loadSaves corrupted', e);
    return saves;
  }
}

function saveUserSaves(saves) {
  const userSaves = saves.filter(s => s.type !== 'default');
  try {
    localStorage.setItem(LS_KEYS.saves, JSON.stringify(userSaves));
  } catch (e) {
    console.error('📂 保存存档列表失败（localStorage可能已满）:', e.message);
  }
}

// ── 删除存档模板 ──
function deleteSave(saveId) {
  dlConfirm('确定要删除这个存档吗？此操作不可恢复。').then(function(confirmed) {
    if (!confirmed) return;
    const saves = loadSaves();
    saveUserSaves(saves.filter(s => s.id !== saveId));
    // 清理所有相关存储
    try {
      localStorage.removeItem('xixi_template_' + saveId);
      for (let s = 0; s < 10; s++) localStorage.removeItem(LS_KEYS.save(saveId, s));
      localStorage.removeItem(LS_KEYS.achievements(saveId));
      localStorage.removeItem(LS_KEYS.theme(saveId));
      localStorage.removeItem(LS_KEYS.editedTemplate(saveId));
      localStorage.removeItem(LS_KEYS.lastManualSlot(saveId));
    } catch (e) { /* cleanup best-effort */ }
    renderMySavesPanel();
  });
}

// ── 清除所有存档槽位 ──
async function clearAllSaves(saveId) {
  const info = getSaveInfo(saveId);
  const count = info?.slotCount || 0;
  if (count === 0) {
    await dlAlert('没有存档可清除');
    return;
  }
  var savesList = loadSaves();
  var saveName = saveId;
  var match = savesList.find(function(s) { return s.id === saveId; });
  if (match) saveName = match.name;
  const confirmed = await dlConfirm('确定清除「' + saveName + '」的全部 ' + count + ' 个存档槽位？\n模板和成就保留，仅删除游戏进度。');
  if (!confirmed) return;
  for (let s = 0; s < 10; s++) localStorage.removeItem(getSaveKey(saveId, s));
  renderMySavesPanel();
}

// ── 成就隔离存储（按模板ID）──
function getAchieveKey() {
  const tpl = getActiveTemplate();
  return LS_KEYS.achievements(tpl.id || 'default');
}

function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(getAchieveKey()) || '{}'); }
  catch { return {}; }
}

function saveAchievements(data) {
  return safeSetItem(getAchieveKey(), data);
}

// ── 安全写入 localStorage（统一处理 QuotaExceededError）──
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('💾 localStorage 写入失败 (' + key + '):', e.message);
    if (typeof dlAlert === 'function') {
      dlAlert('⚠ 存储空间不足，请清理浏览器数据或删除旧存档。\n操作未保存，游戏可继续但进度可能丢失。');
    }
    return false;
  }
}

console.log('📦 saves.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('saves');
