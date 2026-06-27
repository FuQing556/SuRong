/* ═══════════════════════════════════════════
   dialogs.js — 自定义对话框（替代原生 prompt/confirm/alert）
   依赖：state.js
   ═══════════════════════════════════════════ */

// ── 通用对话框（队列化防竞争）──
let _dialogQueue = [];
let _dialogActive = false;

function showDialog(message, options = {}) {
  const { type = 'alert', placeholder = '', defaultValue = '' } = options;
  return new Promise((resolve) => {
    _dialogQueue.push({ message, type, placeholder, defaultValue, resolve });
    if (!_dialogActive) _processDialogQueue();
  });
}

function _processDialogQueue() {
  if (_dialogQueue.length === 0) { _dialogActive = false; return; }
  _dialogActive = true;
  var item = _dialogQueue.shift();

  const overlay = $('#dialog-overlay');
  if (!overlay) { item.resolve(null); _processDialogQueue(); return; }
  $('#dialog-message').textContent = item.message;
  const inputRow = $('#dialog-input-row');
  const input = $('#dialog-input');
  if (item.type === 'prompt') {
    inputRow.style.display = '';
    input.value = item.defaultValue;
    input.placeholder = item.placeholder;
    input.focus();
  } else {
    inputRow.style.display = 'none';
  }
  $('#dialog-cancel').style.display = (item.type === 'alert') ? 'none' : '';
  $('#dialog-ok').textContent = (item.type === 'alert') ? '关闭' : '确定';
  overlay.classList.add('active');

  function done(value) {
    overlay.classList.remove('active');
    // 清理事件绑定：克隆节点替换以移除所有监听器
    var newOk = $('#dialog-ok').cloneNode(true);
    var newCancel = $('#dialog-cancel').cloneNode(true);
    if ($('#dialog-ok').parentNode) $('#dialog-ok').parentNode.replaceChild(newOk, $('#dialog-ok'));
    if ($('#dialog-cancel').parentNode) $('#dialog-cancel').parentNode.replaceChild(newCancel, $('#dialog-cancel'));
    item.resolve(value);
    _processDialogQueue();
  }
  $('#dialog-ok').onclick = function() { done(item.type === 'prompt' ? input.value : true); };
  $('#dialog-cancel').onclick = function() {
    done(item.type === 'confirm' ? false : (item.type === 'prompt' ? null : undefined));
  };
  overlay.onclick = function(e) {
    if (e.target === overlay) done(item.type === 'confirm' ? false : (item.type === 'prompt' ? null : undefined));
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') done(item.type === 'prompt' ? input.value : true);
  };
}

// ── 便捷方法 ──
async function dlAlert(msg) { return showDialog(msg, { type: 'alert' }); }
async function dlConfirm(msg) { return showDialog(msg, { type: 'confirm' }); }
async function dlPrompt(msg, def) { return showDialog(msg, { type: 'prompt', defaultValue: def || '' }); }

// ── Emoji 选择器（电脑端友好）──
const EMOJI_LIST = [
  // 表情
  '😀','😂','😊','😍','🤩','😎','🥺','😢','😡','😱','🤔','🙄','😴','🤗','🫡',
  // 手势
  '👍','👎','👏','🙌','💪','🤝','✊','👊','🤞','🫰',
  // 心形
  '❤️','💔','💕','💖','💗','💜','🖤','🤍','💝','💞',
  // 物品
  '🔥','⭐','✨','💎','🔮','🎯','⚔️','🗡️','🛡️','🔑','📜','📖','🎭','🎪','💀',
  // 自然
  '🌸','🌺','🌹','🍀','🌙','☀️','⚡','💧','🔥','🌊','🌿','🍂','❄️','🌑','💫',
  // 符号
  '⚠️','🚨','❓','✅','❌','🔒','🔓','🏆','🎖️','📌','📊','📋','💬','🔄','➕',
  // 角色
  '👤','👥','🎮','🕵️','👑','🤴','👸','🧙','🦸','🧛',
  // 动物
  '🐺','🦊','🐉','🦅','🐍','🦇','🕊️','🐾','🦋','🐚',
];

function pickEmoji(current) {
  return new Promise((resolve) => {
    // 移除旧的选择器 + 遮罩
    var oldPopup = document.getElementById('emoji-picker-popup');
    if (oldPopup) oldPopup.remove();
    var oldBackdrop = document.getElementById('emoji-picker-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    const popup = document.createElement('div');
    popup.id = 'emoji-picker-popup';
    popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2200;background:var(--bg-panel,#111118);border:1px solid var(--border,#252536);border-radius:12px;padding:16px;max-width:480px;width:90%;max-height:70vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.6);';

    let html = '<div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">选择图标（当前：' + (current || '无') + '）</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    EMOJI_LIST.forEach(emoji => {
      html += '<button style="font-size:24px;background:var(--bg-card,#181825);border:1px solid var(--border,#252536);border-radius:6px;cursor:pointer;padding:4px 6px;line-height:1;transition:transform .1s;" onmouseover="this.style.transform=\'scale(1.3)\'" onmouseout="this.style.transform=\'scale(1)\'" data-emoji="' + emoji + '">' + emoji + '</button>';
    });
    html += '</div>';
    html += '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">';
    html += '<button id="emoji-cancel" class="btn btn-ghost" style="font-size:12px;">取消</button>';
    html += '</div>';
    popup.innerHTML = html;
    document.body.appendChild(popup);

    // 背景遮罩
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:2199;background:rgba(0,0,0,.5);';
    backdrop.id = 'emoji-picker-backdrop';
    document.body.appendChild(backdrop);

    var closed = false;
    function cleanup(val) {
      if (closed) return;
      closed = true;
      popup.remove();
      backdrop.remove();
      document.removeEventListener('keydown', escHandler);
      resolve(val);
    }

    popup.querySelectorAll('button[data-emoji]').forEach(btn => {
      btn.addEventListener('click', () => cleanup(btn.dataset.emoji));
    });
    popup.querySelector('#emoji-cancel').addEventListener('click', () => cleanup(null));
    backdrop.addEventListener('click', () => cleanup(null));
    // ESC 关闭
    var escHandler = function(e) { if (e.key === 'Escape') cleanup(null); };
    document.addEventListener('keydown', escHandler);
  });
}

console.log('📦 dialogs.js 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('dialogs');
