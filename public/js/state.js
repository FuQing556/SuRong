/* ═══════════════════════════════════════════
   state.js — 全局状态 + DOM引用 + 常量
   依赖：无
   ═══════════════════════════════════════════ */

// ── DOM 快捷选择器 ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── DOM 引用 ──
const dom = {
  // 弹窗
  warningOverlay: $('#warning-overlay'),
  saveSelectorOverlay: $('#save-selector-overlay'),
  createSaveOverlay: $('#create-save-overlay'),
  settingsOverlay: $('#settings-overlay'),
  promptEditor: $('#prompt-editor'),
  promptLength: $('#prompt-length'),
  settingsMsg: $('#settings-msg'),
  apiKeyInput: $('#api-key-input'),
  // 游戏
  settlementContent: $('#settlement-content'),
  settlementBox: $('#settlement-box'),
  storyContent: $('#story-content'),
  initialPlaceholder: $('#initial-placeholder'),
  loadingIndicator: $('#loading-indicator'),
  errorBox: $('#error-box'),
  errorMsg: $('#error-message'),
  optionBtns: $$('.option-btn'),
  optionsContainer: $('#options-container'),
  characterImage: $('#character-image'),
  // 动态容器
  statusGrid: $('#status-grid'),
  resourcesRow: $('#resources-row'),
  varsGrid: $('#vars-grid'),
  varsToggle: $('#vars-toggle'),
  // 模板选择器
  templateSelect: $('#template-select'),
};

// ── 常量 ──
const KEEP_ROUNDS = 8;

// ── 游戏状态 ──
let gameState = {
  fullHistory: [],
  summary: '',
  summarisedCount: 0,
  currentOptions: [],
  isLoading: false,
  gameStarted: false,
  originalPrompt: '',
  customPrompt: '',
  activeTemplate: null,
  _originalTemplate: null,    // 加载时的原始模板（深克隆，永不修改，用于恢复默认）
  activeSystemPrompt: '',
  activeSaveId: 'surongrong',
  fieldHistory: {},
  _lastChoiceText: '',
  _currentTheme: 'dark',
  _loadingSave: false,
  _cancelledByUser: false,
  _saveFailed: false,
  _pendingDiceRoll: null,
  _lastDiceResult: null,
  achievementFlags: {
    gambitChosen: false,
    gambitSucceeded: false,
    gambitSuccessCount: 0,
    endingTriggered: false,
    endingType: '',
    triggeredEndings: [],  // 已触发过的结局名列表，防止同结局重复弹窗
    counterAttack: false,
    tradeCompleted: false,
    choiceCounts: {},
    responseMatches: {},
  },
};

// ── 默认模板（后备）──
const FALLBACK_TEMPLATE = {
  id: 'fallback',
  name: '默认',
  theme: 'dark',
  sceneImages: {
    '对峙': '对峙.png', '调查': '调查.png', '潜伏': '潜伏.png', '社交': '社交.png',
    '突发事件': '日常.png', '战斗': '战斗.png', '研究': '研究.png', '交易': '交易.png',
    '日常': '日常.png', '崩溃': '崩溃.png'
  },
  defaultSceneImage: '日常.png',
  outputSections: {
    statusTop: {
      label: '状态栏', display: 'inline',
      fields: [
        { id: 'soulState', label: '魂力残余', icon: '✨', type: 'text' },
        { id: 'abnormal', label: '异常状态', icon: '⚠', type: 'text' },
        { id: 'stress', label: '压力值', icon: '💔', type: 'number' },
      ]
    },
    taskLine: {
      label: null, display: 'inline',
      fields: [
        { id: 'currentTask', label: '当前潜伏任务', icon: '🎯', type: 'text' },
        { id: 'todo', label: '待办事项', icon: '📋', type: 'text' },
        { id: 'round', label: '轮次', icon: '🔄', type: 'number' },
      ]
    },
    resources: {
      label: '资源', display: 'inline',
      fields: [
        { id: 'soulReserve', label: '魂力储备', icon: '🔮', type: 'text' },
        { id: 'favors', label: '人情令牌', icon: '🎫', type: 'text' },
        { id: 'intel', label: '情报碎片', icon: '📜', type: 'number' },
        { id: 'blackmail', label: '把柄', icon: '🗡', type: 'number' },
      ]
    },
    variables: {
      label: '变量追踪', display: 'grid',
      fields: [
        { id: 'mengHaoGan', label: '梦红尘好感', icon: '💜', type: 'text' },
        { id: 'xiaoTaiDu', label: '笑红尘态度', icon: '⚔', type: 'text' },
        { id: 'exposure', label: '暴露风险', icon: '🚨', type: 'text' },
        { id: 'intelProgress', label: '情报进展', icon: '📊', type: 'text' },
        { id: 'majorEvents', label: '重大事件', icon: '⚡', type: 'text' },
      ]
    }
  },
  promptBody: '',
};

console.log('📦 state.js 已加载');
window.XIXI = window.XIXI || {};
window.XIXI.version = '1.0.0';
window.XIXI.debug = false;  // 设为 true 可在控制台看到更多诊断信息
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('state');

// ── 统一的 catch 块 warning（dev 模式）──
// 用法: catch (e) { _devWarn('localStorage read failed', e); }
function _devWarn(msg, err) {
  if (window.XIXI && window.XIXI.debug) {
    console.warn('[dev] ' + msg + (err ? ': ' + (err.message || err) : ''));
  }
}

// ── API Key 加密存储（XOR + 浏览器指纹，防明文泄露）──
var _keyObfuscator = (function() {
  // 从浏览器特征派生一个稳定的混淆种子（非密码学安全，但比明文强）
  var seed = [navigator.language || '', navigator.platform || '', screen.width || 0, screen.height || 0].join('|');
  var seedBytes = [];
  for (var i = 0; i < seed.length; i++) seedBytes.push(seed.charCodeAt(i) & 0xFF);
  return {
    encode: function(plain) {
      if (!plain) return '';
      var result = '';
      for (var i = 0; i < plain.length; i++) {
        var code = plain.charCodeAt(i) ^ seedBytes[i % seedBytes.length];
        result += ('0' + code.toString(16)).slice(-2);
      }
      return 'e:' + result;  // 'e:' 前缀区分加密版本
    },
    decode: function(encoded) {
      if (!encoded) return '';
      if (encoded.indexOf('e:') !== 0) return encoded;  // 旧版明文，返回原值
      var hex = encoded.substring(2);
      var result = '';
      for (var i = 0; i < hex.length; i += 2) {
        var code = parseInt(hex.substring(i, i + 2), 16);
        result += String.fromCharCode(code ^ seedBytes[(i / 2) % seedBytes.length]);
      }
      return result;
    }
  };
})();

// 安全的 API Key 读写
function _readApiKey() {
  try {
    var raw = localStorage.getItem(LS_KEYS.apikey) || '';
    return _keyObfuscator.decode(raw);
  } catch (e) { return ''; }
}

function _writeApiKey(key) {
  if (!key) { localStorage.removeItem(LS_KEYS.apikey); return; }
  var encoded = _keyObfuscator.encode(key);
  localStorage.setItem(LS_KEYS.apikey, encoded);
}

// ── localStorage Key 集中管理 ──
const LS_KEYS = {
  apikey: 'xixi_apikey',
  save: function(id, slot) { return 'xixi_gamesave_' + id + (slot && slot > 0 ? '_' + slot : ''); },
  editedTemplate: function(id) { return 'xixi_edited_template_' + id; },
  achievements: function(id) { return 'xixi_achievements_' + id; },
  theme: function(id) { return 'xixi_theme_' + id; },
  saves: 'xixi_saves',
  aiInstructions: 'xixi_ai_instructions',
  customImages: 'xixi_custom_images',
  createForm: 'xixi_create_save_form',
  generatedTpl: 'xixi_generated_template',
  ageVerified: 'xixi_age_verified',
  lastSaveId: 'xixi_last_save_id',
  activeTemplateId: 'xixi_active_template_id',
  lastManualSlot: function(id) { return 'xixi_last_manual_slot_' + id; },
  font: function(id) { return 'xixi_font_' + id; },
};
