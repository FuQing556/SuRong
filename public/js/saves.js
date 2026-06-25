/* ═══════════════════════════════════════════
   saves.js — 存档管理 + 成就存储隔离
   依赖：state.js, utils.js, dialogs.js
   ═══════════════════════════════════════════ */

// ── 存档 Key 生成 ──
function getSaveKey(templateId, slot) {
  const suffix = (slot && slot > 0) ? '_' + slot : '';
  return 'xixi_gamesave_' + (templateId || 'default') + suffix;
}

// ── 自动/手动存档 ──
function saveGameState(slot) {
  if (!gameState.gameStarted || gameState.fullHistory.length < 2) return;
  const tpl = getActiveTemplate();
  const saveSlot = (slot !== undefined) ? slot : 0;
  const saveKey = getSaveKey(gameState.activeSaveId || tpl.id || 'default', saveSlot);
  const saveData = {
    templateId: gameState.activeSaveId || tpl.id || 'default',
    slot: saveSlot,
    fullHistory: gameState.fullHistory,
    summary: gameState.summary,
    summarisedCount: gameState.summarisedCount,
    currentOptions: gameState.currentOptions,
    lastPlayed: Date.now(),
    roundNumber: gameState.fullHistory.filter(m => m.role === 'user').length,
    theme: gameState._currentTheme || tpl.theme || 'dark',
    fieldHistory: gameState.fieldHistory,
    achievementFlags: gameState.achievementFlags,
  };
  try { localStorage.setItem(saveKey, JSON.stringify(saveData)); gameState._saveFailed = false; }
  catch (e) {
    console.error('💾 存档失败！localStorage 可能已满:', e.message,
      '存档:', saveKey, '大小:', JSON.stringify(saveData).length, '字符');
    gameState._saveFailed = true;  // 供 UI 层检测并提醒用户
  }
  // 更新保存时间指示器
  updateSaveIndicator();
}

// ── 读取存档（纯读取，不修改 gameState）──
function loadGameState(templateId, slot) {
  const saveKey = getSaveKey(templateId, slot !== undefined ? slot : 0);
  try {
    const data = JSON.parse(localStorage.getItem(saveKey));
    if (data && data.fullHistory && data.fullHistory.length > 0) {
      return data;
    }
  } catch (e) { /* corrupt data */ }
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
    const raw = JSON.parse(localStorage.getItem('xixi_saves') || '[]');
    const userSaves = Array.isArray(raw) ? raw : [];
    return [...saves, ...userSaves];
  } catch (e) {
    console.error('📂 存档列表损坏，已重置:', e.message);
    localStorage.removeItem('xixi_saves');
    return saves;
  }
}

function saveUserSaves(saves) {
  const userSaves = saves.filter(s => s.type !== 'default');
  try {
    localStorage.setItem('xixi_saves', JSON.stringify(userSaves));
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
      for (let s = 0; s < 10; s++) localStorage.removeItem(getSaveKey(saveId, s));
      localStorage.removeItem('xixi_achievements_' + saveId);
      localStorage.removeItem('xixi_theme_' + saveId);
      localStorage.removeItem('xixi_edited_template_' + saveId);
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
  const confirmed = await dlConfirm('确定清除「' + saveId + '」的全部 ' + count + ' 个存档槽位？\n模板和成就保留，仅删除游戏进度。');
  if (!confirmed) return;
  for (let s = 0; s < 10; s++) localStorage.removeItem(getSaveKey(saveId, s));
  renderMySavesPanel();
}

// ── 成就隔离存储（按模板ID）──
function getAchieveKey() {
  const tpl = getActiveTemplate();
  return 'xixi_achievements_' + (tpl.id || 'default');
}

function getUnlockedAchievements() {
  try { return JSON.parse(localStorage.getItem(getAchieveKey()) || '{}'); }
  catch { return {}; }
}

function saveAchievements(data) {
  try {
    localStorage.setItem(getAchieveKey(), JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('保存成就失败:', e.message);
    return false;
  }
}

console.log('📦 saves.js 已加载');
