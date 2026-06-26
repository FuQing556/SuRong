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
  imageCaption: $('.image-caption'),
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
