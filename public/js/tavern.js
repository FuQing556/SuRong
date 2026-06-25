/* ═══════════════════════════════════════════
   tavern.js — 酒馆分享系统
   依赖：state.js, utils.js, dialogs.js, saves.js
   ═══════════════════════════════════════════ */

// ── 管理员状态 ──
let isTavernAdmin = false;

// ── 管理员登录 ──
function adminLogin() {
  dlPrompt('请输入管理员密码：').then(pwd => {
    if (pwd === 'admin123') {
      isTavernAdmin = true;
      const status = document.querySelector('#admin-status');
      if (status) { status.textContent = '✅ 管理员'; status.style.color = 'var(--green)'; }
      renderTavernPanel();
    } else if (pwd !== null) {
      dlAlert('密码错误');
    }
  });
}

function adminLogout() {
  isTavernAdmin = false;
  const status = document.querySelector('#admin-status');
  if (status) status.textContent = '';
  renderTavernPanel();
}

// ── 从酒馆删除 ──
async function deleteFromTavern(sharedId) {
  const confirmed = await dlConfirm('确定要从酒馆中删除这个分享吗？');
  if (!confirmed) return;
  try {
    const resp = await fetch('/api/shared/' + sharedId, { method: 'DELETE' });
    if (!resp.ok) throw new Error('删除失败');
    renderTavernPanel();
  } catch (err) {
    dlAlert('❌ 删除失败: ' + err.message);
  }
}

// ── 上传到酒馆 ──
async function uploadToTavern(saveId) {
  const saves = loadSaves();
  const save = saves.find(s => s.id === saveId);
  if (!save || !save.template) {
    await dlAlert('存档数据不完整，无法上传');
    return;
  }
  const confirmed = await dlConfirm('确定要将「' + save.name + '」分享到酒馆吗？\n\n分享后其他玩家可以下载你的故事设定。');
  if (!confirmed) return;

  // 深克隆模板 + 合并编辑版（确保上传的是最新版本）
  const uploadTemplate = JSON.parse(JSON.stringify(save.template));
  const editKey = 'xixi_edited_template_' + saveId;
  const ej = localStorage.getItem(editKey);
  if (ej) {
    try {
      const ed = JSON.parse(ej);
      if (ed.promptBody) uploadTemplate.promptBody = ed.promptBody;
      if (ed.outputSections) uploadTemplate.outputSections = ed.outputSections;
      if (ed.achievements) uploadTemplate.achievements = ed.achievements;
      if (ed.hiddenAchievements) uploadTemplate.hiddenAchievements = ed.hiddenAchievements;
    } catch (e) { /* corrupt */ }
  }

  try {
    const resp = await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: uploadTemplate }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || '上传失败');
    }
    await dlAlert('✅ 「' + save.name + '」已成功分享到酒馆！');
  } catch (err) {
    dlAlert('❌ 上传失败: ' + err.message);
  }
}

// ── 加载酒馆列表 ──
async function loadTavernList() {
  try {
    const resp = await fetch('/api/shared');
    const data = await resp.json();
    return data.shared || [];
  } catch (e) {
    console.error('加载酒馆失败:', e);
    return [];
  }
}

// ── 渲染酒馆面板 ──
async function renderTavernPanel(filterText) {
  const grid = $('#tavern-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="tavern-loading">⏳ 正在加载酒馆...</div>';

  const allSharedT = await loadTavernList();
  const q = (filterText || (document.querySelector('#tavern-search')?.value || '')).trim().toLowerCase();
  const shared = q ? allSharedT.filter(function(s) {
    return (s.name || '').toLowerCase().indexOf(q) >= 0 ||
           (s.description || '').toLowerCase().indexOf(q) >= 0 ||
           (s.protagonist || '').toLowerCase().indexOf(q) >= 0 ||
           (s.worldSetting || '').toLowerCase().indexOf(q) >= 0 ||
           (s.author || '').toLowerCase().indexOf(q) >= 0 ||
           (s.styles || []).some(function(st) { return st.toLowerCase().indexOf(q) >= 0; });
  }) : allSharedT;

  if (allSharedT.length === 0) {
    grid.innerHTML = '<div class="tavern-empty">🍺 酒馆空空如也<br><span style="font-size:12px;color:var(--text-dim);">暂时没有人分享故事设定，来做第一个吧！</span></div>';
  } else {
    grid.innerHTML = shared.map(s => {
      const goalLine = s.conflict ? s.conflict.replace(/\n.*/s, '').substring(0, 40) : (s.description || '').substring(0, 40);
      const protagLine = s.protagonist ? s.protagonist.replace(/\n.*/s, '').substring(0, 30) : '';
      return `
      <div class="save-card" data-shared-id="${s.id}">
        <div class="save-card-header">
          <span class="save-card-icon">📖</span>
          <span class="save-card-name">${escapeHtml(s.name)}</span>
        </div>
        ${protagLine ? '<div class="save-card-protag">👤 ' + escapeHtml(protagLine) + '</div>' : ''}
        <div class="save-card-goal">🎯 ${escapeHtml(goalLine || '新的冒险即将展开')}</div>
        <div class="save-card-meta">
          <span class="tavern-card-uploaded">👤 ${escapeHtml(s.author || '未知')}</span>
          <span class="tavern-card-uploaded">🕐 ${s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString('zh-CN') : '未知'}</span>
          <span class="tavern-card-downloads">⬇ ${s.downloads || 0}</span>
        </div>
        <button class="btn btn-primary save-card-btn tavern-import-btn" data-shared-id="${s.id}">📥 导入并游玩</button>
        ${isTavernAdmin ? '<button class="save-card-delete tavern-del-btn" data-shared-id="' + s.id + '" style="position:absolute;top:6px;right:6px;">✕</button>' : ''}
      </div>
    `}).join('');

    grid.querySelectorAll('.tavern-import-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); importFromTavern(btn.dataset.sharedId); });
    });
    grid.querySelectorAll('.tavern-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); deleteFromTavern(btn.dataset.sharedId); });
    });
  }

  const infoEl = $('#tavern-info');
  if (infoEl) {
    infoEl.innerHTML = '共 ' + shared.length + ' 个分享';
    if (isTavernAdmin) {
      infoEl.innerHTML += ' <button id="btn-backup-tavern" class="btn btn-ghost btn-tiny">📥 备份</button>';
      infoEl.innerHTML += ' <button id="btn-restore-tavern" class="btn btn-ghost btn-tiny">📤 恢复</button>';
    }
  }

  // 绑定备份/恢复按钮（管理员功能）
  setTimeout(() => {
    const backupBtn = document.querySelector('#btn-backup-tavern');
    if (backupBtn) backupBtn.onclick = backupTavern;
    const restoreBtn = document.querySelector('#btn-restore-tavern');
    if (restoreBtn) restoreBtn.onclick = restoreTavern;
  }, 50);
}

// ── 从酒馆导入 ──
async function importFromTavern(sharedId) {
  try {
    const resp = await fetch('/api/shared/' + sharedId);
    const data = await resp.json();
    const template = data.template;
    if (!template) throw new Error('模板数据为空');

    const saves = loadSaves();
    const existing = saves.find(s => s.id === sharedId);
    if (existing) {
      const confirmed = await dlConfirm('本地已有存档「' + template.name + '」，是否覆盖？');
      if (!confirmed) return;
      saveUserSaves(saves.filter(s => s.id !== sharedId));
    }

    const updatedSaves = loadSaves();
    updatedSaves.push({
      id: sharedId, name: template.name || '导入存档', desc: template.description || '',
      icon: '📥', type: 'custom', template: template,
      worldSetting: template.worldSetting || '', protagonist: template.protagonist || '',
      conflict: template.conflict || '', styles: template.styles || [],
    });
    saveUserSaves(updatedSaves);

    // 自动切到"我的存档"标签
    const myTab = document.querySelector('.tab-btn[data-tab="my-saves"]');
    if (myTab) myTab.click();
    renderMySavesPanel();

    const playNow = await dlConfirm('✅ 已导入「' + template.name + '」！\n是否立即开始游戏？');
    if (playNow) selectSave(sharedId);
  } catch (err) {
    dlAlert('❌ 导入失败: ' + err.message);
  }
}

// ── 酒馆备份 ──
async function backupTavern() {
  try {
    const resp = await fetch('/api/tavern/backup');
    if (!resp.ok) throw new Error('备份失败');
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tavern_backup.json';
    a.click();
    URL.revokeObjectURL(url);
    await dlAlert('✅ 酒馆数据已下载！');
  } catch (e) { dlAlert('❌ 备份失败: ' + e.message); }
}

// ── 酒馆恢复 ──
function restoreTavern() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.shared) throw new Error('格式不正确');
      const ow = await dlConfirm('文件包含 ' + data.shared.length + ' 个分享。覆盖已存在的？');
      const resp = await fetch('/api/tavern/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: data.shared, overwrite: !!ow })
      });
      const r = await resp.json();
      await dlAlert('✅ 已导入 ' + r.imported + '/' + r.total + ' 个分享！');
      renderTavernPanel();
    } catch (e) { dlAlert('❌ 恢复失败: ' + e.message); }
  };
  inp.click();
}

console.log('📦 tavern.js 已加载');
