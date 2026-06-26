/* ═══════════════════════════════════════════
   achievements.js — 成就系统：定义/解锁/检测/面板/编辑/导出
   依赖：state.js, utils.js, dialogs.js, saves.js, ui.js
   ═══════════════════════════════════════════ */

// ── 获取成就定义 ──
function getAchievements() {
  const tpl = getActiveTemplate();
  if (tpl.achievements && Object.keys(tpl.achievements).length > 0) return tpl.achievements;
  // 从模板变量字段自动生成
  const vars = tpl.outputSections?.variables?.fields || [];
  if (vars.length > 0) {
    const generated = {};
    vars.forEach(v => {
      // 用 field id 做 key（稳定），label 放 desc（可编辑）
      const key = (v.id || v.label) + '大师';
      generated[key] = { icon: v.icon || '⭐', desc: v.label + '达到较高水平' };
    });
    generated['幸存者'] = { icon: '🍀', desc: '轮次≥30且未触发任何结局' };
    generated['崩坏'] = { icon: '💔', desc: '触发任一结局' };
    generated['极限操作'] = { icon: '🎲', desc: '孤注一掷选项成功' };
    return generated;
  }
  return {
    '幸存者': { icon: '🍀', desc: '轮次≥30且未触发任何结局' },
    '崩坏': { icon: '💔', desc: '触发任一结局' },
    '极限操作': { icon: '🎲', desc: '孤注一掷选项成功' },
  };
}

// ── 解锁成就 ──
function unlockAchievement(name) {
  const all = getUnlockedAchievements();
  if (all[name]) return false;
  all[name] = new Date().toISOString().slice(0, 10);
  if (!saveAchievements(all)) {
    console.error('🏆 成就解锁保存失败（localStorage可能已满）:', name);
    return false;  // 保存失败则不弹toast，避免"假解锁"
  }
  if (typeof playAchievement === 'function') playAchievement();
  showAchievementToast(name);
  return true;
}

var _achToastQueue = [];
var _achToastShowing = false;

function showAchievementToast(name) {
  // 队列化：多个成就同时解锁时逐个展示
  _achToastQueue.push(name);
  if (_achToastShowing) return;
  _showNextToast();
}

function _showNextToast() {
  if (_achToastQueue.length === 0) { _achToastShowing = false; return; }
  _achToastShowing = true;
  var name = _achToastQueue.shift();
  var ach = getAchievements()[name];
  var toast = $('#achievement-toast');
  if (!toast) { _achToastShowing = false; return; }
  $('#ach-toast-text').textContent = (ach?.icon || '🏆') + ' ' + name;
  toast.classList.remove('hidden');
  toast.style.animation = 'none';
  toast.offsetHeight;
  toast.style.animation = 'achSlideIn .5s ease, achSlideOut .5s ease 3.5s forwards';
  setTimeout(function() { toast.classList.add('hidden'); _showNextToast(); }, 4000);
}

// ── 从解析结果更新 fieldHistory ──
function updateFieldHistoryFromParsed(parsed) {
  if (!parsed.fields) return;
  for (const [fieldId, value] of Object.entries(parsed.fields)) {
    if (!gameState.fieldHistory[fieldId]) gameState.fieldHistory[fieldId] = {};
    const hist = gameState.fieldHistory[fieldId];
    const num = parseInt(value);
    if (!isNaN(num)) {
      hist.current = num;
      hist.max = Math.max(hist.max || 0, num);
      delete hist.currentText;  // 清理旧文本值，防类型切换残留
    } else {
      hist.currentText = value;
      delete hist.current;      // 清理旧数值，防类型切换残留
    }
  }
}

// ── 辅助：根据标签词查找字段ID ──
function _findFieldId(labelPart) {
  const tpl = getActiveTemplate();
  const sections = tpl.outputSections || {};
  for (const sec of Object.values(sections)) {
    for (const f of (sec.fields || [])) {
      if (f.label && f.label.includes(labelPart)) return f.id;
    }
  }
  for (const sec of Object.values(sections)) {
    for (const f of (sec.fields || [])) {
      if (f.id && f.id.toLowerCase().includes(labelPart.toLowerCase())) return f.id;
    }
  }
  const idMap = { '轮次': 'round', '回合': 'round', '压力': 'stress', '暴露': 'exposure', '好感': 'favor', '态度': 'attitude', '进度': 'progress', '情报': 'intel' };
  for (const [kw, tid] of Object.entries(idMap)) {
    if (labelPart.includes(kw)) {
      for (const sec of Object.values(sections)) {
        for (const f of (sec.fields || [])) {
          if (f.id && f.id.toLowerCase().includes(tid)) return f.id;
        }
      }
    }
  }
  return null;
}

function _fieldVal(labelPart, useMax) {
  const id = _findFieldId(labelPart);
  if (!id || !gameState.fieldHistory[id]) return 0;
  return useMax ? (gameState.fieldHistory[id].max || 0) : (gameState.fieldHistory[id].current || 0);
}

// ── 检测可见成就（字段数值型+行为型）──
function checkAchievementsFromState(parsed) {
  // 读档时不重检（避免 endingTriggered 等旧标记重复触发成就）
  if (gameState._loadingSave) return;
  // 第一回合（开局消息）不检测——AI 设定初始数值时可能误触发低阈值成就
  const roundNum = gameState.fullHistory.filter(m => m.role === 'user').length;
  if (roundNum < 2) return;

  const tpl = getActiveTemplate();
  const achievements = getAchievements();
  if (!achievements || Object.keys(achievements).length === 0) return;

  updateFieldHistoryFromParsed(parsed);

  for (const [name, ach] of Object.entries(achievements)) {
    if (getUnlockedAchievements()[name]) continue;
    const desc = ach.desc || '';
    let triggered = false;

    if (/结局/.test(desc) && !/未触发/.test(desc) && !/\d/.test(desc)) {
      triggered = !!(gameState.achievementFlags.endingTriggered || (gameState.achievementFlags.triggeredEndings || []).length > 0);
    } else if (/孤注/.test(desc)) {
      triggered = !!gameState.achievementFlags.gambitSucceeded;
    } else if (/反杀|设局/.test(desc)) {
      triggered = !!gameState.achievementFlags.counterAttack;
    } else if (/情报.*交易|情报.*交换/.test(desc)) {
      triggered = !!gameState.achievementFlags.tradeCompleted;
    } else {
      const nm = desc.match(/(\d+)/);
      const threshold = nm ? parseInt(nm[1]) : 70;
      const useMax = /曾达|最高/.test(desc);
      const hasGate = /未触发|未被|但未|且未/.test(desc);
      const allLabels = [];
      for (const sec of Object.values(tpl.outputSections || {})) {
        for (const f of (sec.fields || [])) allLabels.push(f.label);
      }
      allLabels.sort((a, b) => b.length - a.length);
      let matched = null;
      for (const l of allLabels) {
        if (desc.includes(l)) { matched = l; break; }
      }
      if (matched) {
        const val = _fieldVal(matched, useMax);
        triggered = val >= threshold;
        if (triggered && hasGate) triggered = !gameState.achievementFlags.endingTriggered;
      }
    }
    if (triggered) unlockAchievement(name);
  }

  checkHiddenAchievements(parsed);
}

// ── 检测隐藏成就 ──
function checkHiddenAchievements(parsed) {
  const tpl = getActiveTemplate();
  const hidden = tpl.hiddenAchievements || {};
  if (Object.keys(hidden).length === 0) return;

  for (const [name, ha] of Object.entries(hidden)) {
    if (getUnlockedAchievements()[name]) continue;
    const trigger = ha.trigger || {};
    let triggered = false;
    switch (trigger.type) {
      case 'choice':
        triggered = (gameState.achievementFlags.choiceCounts[trigger.pattern] || 0) >= (trigger.count || 1);
        break;
      case 'gambit':
        triggered = gameState.achievementFlags.gambitSuccessCount >= (trigger.count || 1);
        break;
      case 'rounds_under':
        if (gameState.achievementFlags.endingTriggered) {
          const r = _fieldVal('轮次');
          triggered = r > 0 && r <= (trigger.round || 10);
        }
        break;
      case 'field_zero': {
        const fid = _findFieldId(trigger.fieldLabel || '');
        if (fid && gameState.fieldHistory[fid] && gameState.fieldHistory[fid].hasOwnProperty('current')) {
          triggered = (gameState.fieldHistory[fid].current || 0) === 0;
        }
        break;
      }
      case 'field_max_under':
        if (gameState.achievementFlags.endingTriggered) {
          const v = _fieldVal(trigger.fieldLabel || '', true);
          triggered = v > 0 && v <= (trigger.threshold || 50);
        }
        break;
      case 'response_match':
        triggered = (gameState.achievementFlags.responseMatches[trigger.pattern] || 0) >= (trigger.count || 1);
        break;
    }
    if (triggered) unlockAchievement(name);
  }
}

// ── 获取成就进度（用于进度条显示）──
function getAchievementProgress(name) {
  const tpl = getActiveTemplate();
  const ach = getAchievements()[name];
  if (!ach) return null;
  const desc = ach.desc || '';

  function _findLabel(d) {
    const all = [];
    for (const sec of Object.values(tpl.outputSections || {})) {
      for (const f of (sec.fields || [])) all.push(f.label);
    }
    all.sort((a, b) => b.length - a.length);
    for (const l of all) if (d.includes(l)) return l;
    return null;
  }

  if (/结局/.test(desc) && !/未触发/.test(desc) && !/\d/.test(desc)) {
    return { current: gameState.achievementFlags.endingTriggered ? 1 : 0, target: 1, text: '触发任一结局' };
  }
  if (/孤注/.test(desc)) {
    return { current: gameState.achievementFlags.gambitSucceeded ? 1 : 0, target: 1, text: '孤注一掷成功' };
  }
  if (/反杀|设局/.test(desc)) {
    return { current: gameState.achievementFlags.counterAttack ? 1 : 0, target: 1, text: desc };
  }
  const matched = _findLabel(desc);
  if (matched) {
    const nm = desc.match(/(\d+)/);
    const target = nm ? parseInt(nm[1]) : 70;
    const useMax = /曾达|最高/.test(desc);
    const v = _fieldVal(matched, useMax);
    return { current: Math.min(v, target), target, text: matched + '达到' + target };
  }
  const nm = desc.match(/(\d+)/);
  return { current: 0, target: nm ? parseInt(nm[1]) : 1, text: desc };
}

// ── 成就面板渲染（含编辑/删除/添加/隐藏）──
function renderAchievementsPanelV2() {
  const all = getUnlockedAchievements();
  const list = $('#achievements-list');
  if (!list) return;
  const achievements = getAchievements();
  const tpl = getActiveTemplate();
  const hidden = tpl.hiddenAchievements || {};

  if (!achievements || (Object.keys(achievements).length === 0 && Object.keys(hidden).length === 0)) {
    list.innerHTML = '<p style="color:var(--text-dim);">该模板未定义成就</p>';
    return;
  }

  function buildItem(name, ach, unlocked) {
    const progress = unlocked ? null : getAchievementProgress(name);
    let pb = '';
    if (progress && progress.target > 1) {
      const cur = Math.max(0, progress.current || 0);
      const tgt = Math.max(1, progress.target || 1);
      const pct = Math.min(100, Math.max(0, Math.round((cur / tgt) * 100)));
      pb = '<div class="ach-progress-bar"><div class="ach-progress-fill" style="width:' + pct + '%"></div></div><div class="ach-progress-text">' + progress.current + '/' + progress.target + ' ' + progress.text + '</div>';
    } else if (progress && progress.target === 1 && !unlocked) {
      pb = '<div class="ach-progress-text" style="color:var(--text-dim);">' + progress.text + '</div>';
    }
    const ds = typeof unlocked === 'string' ? unlocked : (all[name] || '');
    return '<div class="ach-item' + (unlocked ? '' : ' locked') + '" data-ach-name="' + escapeHtml(name) + '"><span class="ach-icon">' + (unlocked ? ach.icon : '🔒') + '</span><div class="ach-info"><span class="ach-name">' + escapeHtml(name) + '</span><span class="ach-desc">' + escapeHtml(ach.desc || '') + '</span>' + pb + '</div>' + (ds ? '<span class="ach-date">' + ds + '</span>' : '') + '<button class="ach-edit-btn" data-ach-name="' + escapeHtml(name) + '">✏️</button><button class="ach-del-btn" data-ach-name="' + escapeHtml(name) + '">✕</button></div>';
  }

  let html = '<div style="font-size:13px;color:var(--gold);margin-bottom:8px;">📋 可见成就</div>';
  if (Object.keys(achievements).length === 0) {
    html += '<p style="color:var(--text-dim);font-size:12px;">无</p>';
  } else {
    html += Object.entries(achievements).map(function(e) { return buildItem(e[0], e[1], all[e[0]]); }).join('');
  }
  html += '<div style="font-size:13px;color:var(--purple-hover);margin:14px 0 8px;">🎭 隐藏成就</div>';
  if (Object.keys(hidden).length === 0) {
    html += '<p style="color:var(--text-dim);font-size:12px;">无</p>';
  } else {
    html += Object.entries(hidden).map(function(e) {
      const u = !!all[e[0]];
      return u ? buildItem(e[0], { icon: e[1].icon, desc: e[1].desc }, true)
               : '<div class="ach-item locked"><span class="ach-icon">❓</span><div class="ach-info"><span class="ach-name">???</span><span class="ach-desc">隐藏成就 — 解锁条件未知</span></div></div>';
    }).join('');
  }
  html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;"><button id="btn-add-achievement" class="btn btn-small">＋ 添加可见成就</button><button id="btn-add-hidden-ach" class="btn btn-small btn-ghost">🎭 添加隐藏成就</button><button id="btn-export-template" class="btn btn-small btn-primary">📦 另存为新存档</button></div>';
  list.innerHTML = html;

  // 绑定按钮
  const addBtn = document.querySelector('#btn-add-achievement');
  if (addBtn) addBtn.addEventListener('click', function() { addNewAchievement(false); });
  const addHiddenBtn = document.querySelector('#btn-add-hidden-ach');
  if (addHiddenBtn) addHiddenBtn.addEventListener('click', function() { addNewAchievement(true); });
  const exportBtn = document.querySelector('#btn-export-template');
  if (exportBtn) exportBtn.addEventListener('click', exportTemplateAsNewSave);
  list.querySelectorAll('.ach-edit-btn').forEach(function(b) {
    b.addEventListener('click', function(e) { e.stopPropagation(); editAchievement(b.dataset.achName); });
  });
  list.querySelectorAll('.ach-del-btn').forEach(function(b) {
    b.addEventListener('click', function(e) { e.stopPropagation(); deleteAchievement(b.dataset.achName); });
  });
}

// ── 编辑成就 ──
async function editAchievement(name) {
  const tpl = getActiveTemplate();
  const isHidden = tpl.hiddenAchievements && tpl.hiddenAchievements[name];
  const ach = isHidden ? tpl.hiddenAchievements[name] : (tpl.achievements || {})[name];
  if (!ach) return;

  const newName = await dlPrompt('成就名称：', name);
  if (newName === null) return;
  const fn = newName.trim() || name;

  const newIcon = await pickEmoji(ach.icon || '🏆');
  if (newIcon === null) return;
  const fi = newIcon.trim() || ach.icon || '🏆';

  const newDesc = await dlPrompt(isHidden ? '描述（解锁后可见）：' : '描述（需含字段名+数值）：', ach.desc || '');
  if (newDesc === null) return;
  const fd = newDesc.trim() || ach.desc || '';

  const saveId = gameState.activeSaveId || tpl.id || 'default';
  if (isHidden) {
    if (fn !== name) {
      // 检查重名
      if (tpl.hiddenAchievements[fn] && tpl.hiddenAchievements[fn] !== tpl.hiddenAchievements[name]) {
        dlAlert('⚠ 已存在同名隐藏成就「' + fn + '」，请使用不同名称。');
        return;
      }
      tpl.hiddenAchievements[fn] = tpl.hiddenAchievements[name]; delete tpl.hiddenAchievements[name];
    }
    tpl.hiddenAchievements[fn].icon = fi;
    tpl.hiddenAchievements[fn].desc = fd;
  } else {
    if (fn !== name) {
      if (tpl.achievements[fn] && tpl.achievements[fn] !== tpl.achievements[name]) {
        dlAlert('⚠ 已存在同名可见成就「' + fn + '」，请使用不同名称。');
        return;
      }
      tpl.achievements[fn] = tpl.achievements[name]; delete tpl.achievements[name];
      const allA = getUnlockedAchievements();
      if (allA[name]) { allA[fn] = allA[name]; delete allA[name]; saveAchievements(allA); }
    }
    tpl.achievements[fn].icon = fi;
    tpl.achievements[fn].desc = fd;
  }
  // 只持久化成就部分，不覆盖字段/提示词等其他编辑
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { const ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.achievements = tpl.achievements;
  edited.hiddenAchievements = tpl.hiddenAchievements;
  safeSetItem(editKey, edited);
  renderAchievementsPanelV2();
}

// ── 删除成就 ──
async function deleteAchievement(name) {
  const tpl = getActiveTemplate();
  const confirmed = await dlConfirm('确定删除成就「' + name + '」？');
  if (!confirmed) return;
  if (tpl.hiddenAchievements && tpl.hiddenAchievements[name]) delete tpl.hiddenAchievements[name];
  else delete tpl.achievements[name];
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { const ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.achievements = tpl.achievements;
  edited.hiddenAchievements = tpl.hiddenAchievements;
  safeSetItem(editKey, edited);
  renderAchievementsPanelV2();
}

// ── 添加成就 ──
async function addNewAchievement(isHidden) {
  const tpl = getActiveTemplate();
  const name = await dlPrompt('新' + (isHidden ? '隐藏' : '可见') + '成就名称：');
  if (!name || !name.trim()) return;
  var nm = name.trim();
  // 检查重名
  if ((tpl.achievements && tpl.achievements[nm]) || (tpl.hiddenAchievements && tpl.hiddenAchievements[nm])) {
    dlAlert('⚠ 已存在同名成就「' + nm + '」，请使用不同名称。');
    return;
  }
  const icon = await pickEmoji('🏆');
  if (icon === null) return;
  const desc = await dlPrompt(isHidden ? '描述（解锁后可见）：' : '描述（需含字段名+阈值）：');
  if (desc === null) return;

  if (isHidden) {
    if (!tpl.hiddenAchievements) tpl.hiddenAchievements = {};
    tpl.hiddenAchievements[nm] = {
      icon: icon.trim() || '🎭',
      desc: desc.trim() || nm,
      trigger: { type: 'gambit', count: 1 }
    };
  } else {
    if (!tpl.achievements) tpl.achievements = {};
    tpl.achievements[nm] = { icon: icon.trim() || '🏆', desc: desc.trim() || nm };
  }
  const saveId = gameState.activeSaveId || tpl.id || 'default';
  const editKey = LS_KEYS.editedTemplate(saveId);
  let edited = {};
  try { const ej = localStorage.getItem(editKey); if (ej) edited = JSON.parse(ej); } catch (e) { /* corrupt */ }
  edited.achievements = tpl.achievements;
  edited.hiddenAchievements = tpl.hiddenAchievements;
  safeSetItem(editKey, edited);
  renderAchievementsPanelV2();
}

// ── 导出模板为新存档 ──
async function exportTemplateAsNewSave() {
  const tpl = getActiveTemplate();
  const newName = await dlPrompt('新存档名称：', tpl.name + '（修改版）');
  if (!newName || !newName.trim()) return;
  const exported = JSON.parse(JSON.stringify(tpl));
  const newId = 'custom_' + Date.now();
  exported.id = newId;
  exported.name = newName.trim();
  exported.author = '手动编辑';
  const saves = loadSaves();
  saves.push({
    id: newId, name: exported.name, desc: exported.description || '', icon: '✏️', type: 'custom',
    template: exported, worldSetting: exported.worldSetting || '', protagonist: exported.protagonist || '',
    conflict: exported.conflict || '', styles: exported.styles || []
  });
  saveUserSaves(saves);
  try { fetch('/api/templates/' + newId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template: exported }) }); } catch (e) { /* server optional */ }
  await dlAlert('✅ 已导出为新存档「' + newName.trim() + '」！\n返回存档选择页即可看到。');
  renderAchievementsPanelV2();
}

console.log('📦 achievements.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('achievements');
