/* ═══════════════════════════════════════════
   audio.js — Web Audio API 合成音效 + 主题氛围
   依赖：state.js
   v3: 三态开关(🔉全部/🔔仅UI/🔇静音) + 全主题音量标准化 + 樱花新音色
   ═══════════════════════════════════════════ */

let _audioCtx = null;
let _ambientNode = null;
let _ambientGain = null;
let _uiAudioOn = true;     // UI 点击音效
let _ambientOn = true;      // 氛围背景音
let _userGestured = false;

// ── 全局用户手势门控 ──
(function _setupAudioGestureGate() {
  const _unlock = () => {
    _userGestured = true;
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
    }
    if (_ambientOn && !_ambientNode) {
      var t = (typeof gameState !== 'undefined' && gameState._currentTheme) || 'dark';
      startAmbient(t);
    }
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      document.removeEventListener(evt, _unlock);
    });
  };
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, _unlock, { once: false });
  });
})();

function getCtx() {
  if (!_userGestured) return null;
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch (e) { return null; }
}

// ── 辅助：UI音效仅检查 _uiAudioOn；氛围音效检查 _ambientOn ──
function _safeCtx() { return _uiAudioOn ? getCtx() : null; }
function _safeAmbientCtx() { return _ambientOn ? getCtx() : null; }

// ═══════════════════════════════════════════
//  UI 音效（不受氛围开关影响）
// ═══════════════════════════════════════════

function playUIClick() {
  const ctx = _safeCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
  } catch (e) { /* audio not available */ }
}

function playClick() {
  const ctx = _safeCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.03);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.05);
  } catch (e) { /* audio not available */ }
}

function playAchievement() {
  const ctx = _safeCtx();
  if (!ctx) return;
  try {
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.5);
    });
  } catch (e) { /* audio not available */ }
}

function playError() {
  const ctx = _safeCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* audio not available */ }
}

// ═══════════════════════════════════════════
//  氛围音效（v3: 统一基准增益 0.012 + 白噪声类降内部增益）
// ═══════════════════════════════════════════

function stopAmbient() {
  if (_ambientNode) { try { _ambientNode.stop(); } catch (e) {} _ambientNode = null; }
  if (_ambientGain) { _ambientGain = null; }
}

function startAmbient(themeName) {
  stopAmbient();
  const ctx = _safeAmbientCtx();
  if (!ctx) return;

  try {
    // 统一主增益 — 所有氛围音效经此节点，基准 0.012（约为UI点击的15%）
    _ambientGain = ctx.createGain();
    _ambientGain.gain.value = 0.06;
    _ambientGain.connect(ctx.destination);

    switch (themeName) {

      // ── 🌿 森林：柔风（白噪声降增益）──
      case 'forest': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 350; filter.Q.value = 0.5;
        const fGain = ctx.createGain(); fGain.gain.value = 0.25;
        src.connect(filter); filter.connect(fGain); fGain.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }

      // ── 🌊 深海：低频潮汐（降噪声幅度）──
      case 'ocean': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.07;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 200; filter.Q.value = 0.3;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 100;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        src.connect(filter); filter.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }

      // ── 💜 赛博：低嗡科技感（不变，本身很安静）──
      case 'cyber': {
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.02;
        const filter2 = ctx.createBiquadFilter();
        filter2.type = 'lowpass'; filter2.frequency.value = 150;
        osc.connect(filter2); filter2.connect(gain2); gain2.connect(_ambientGain);
        osc.start();
        _ambientNode = osc;
        break;
      }

      // ── 🏯 修仙：温暖pad + 稀疏风铃 ──
      case 'xianxia': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 65;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 98;
        const gPad = ctx.createGain(); gPad.gain.value = 0.015;
        osc.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc.start(); osc2.start();

        const bells = [523, 587, 659, 784, 880];
        let bellTimer = null;
        const chime = () => {
          if (!_ambientOn || !_ambientGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = bells[Math.floor(Math.random() * bells.length)];
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.015, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
          o.connect(g); g.connect(_ambientGain);
          o.start(); o.stop(ctx.currentTime + 2.6);
        };
        bellTimer = setInterval(chime, 4000 + Math.random() * 3000);
        _ambientNode = {
          stop: () => { clearInterval(bellTimer); try { osc.stop(); osc2.stop(); } catch (e) {} }
        };
        break;
      }

      // ── 🌃 子夜：55Hz + 极慢LFO ──
      case 'midnight': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.018;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 8;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start();
        osc.connect(gain2); gain2.connect(_ambientGain);
        osc.start();
        _ambientNode = osc;
        break;
      }

      // ── ✨ 鎏金：110Hz + 五度泛音 ──
      case 'golden': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 110;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 165;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.016;
        const gain3 = ctx.createGain(); gain3.gain.value = 0.006;
        osc.connect(gain2); osc2.connect(gain3);
        gain2.connect(_ambientGain); gain3.connect(_ambientGain);
        osc.start(); osc2.start();
        _ambientNode = { stop: () => { try { osc.stop(); osc2.stop(); } catch (e) {} } };
        break;
      }

      // ── 🌸 樱花 v3：柔光五度pad + 稀疏高音风铃（无白噪声）──
      case 'sakura': {
        // 极柔的纯四度泛音垫 — 330Hz + 392Hz，模拟花瓣落在水面的静谧
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 330;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 392;
        const gPad = ctx.createGain(); gPad.gain.value = 0.03;  // 轻柔可闻的底音垫
        osc.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc.start(); osc2.start();

        // 稀疏高音风铃 — 比修仙更高更轻更稀疏（5-8秒间隔）
        const bells = [659, 784, 880, 988, 1047];  // E5 G5 A5 B5 C6
        let bellTimer = null;
        const chime = () => {
          if (!_ambientOn || !_ambientGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = bells[Math.floor(Math.random() * bells.length)];
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.035, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
          o.connect(g); g.connect(_ambientGain);
          o.start(); o.stop(ctx.currentTime + 1.9);
        };
        bellTimer = setInterval(chime, 5000 + Math.random() * 3000);
        _ambientNode = {
          stop: () => { clearInterval(bellTimer); try { osc.stop(); osc2.stop(); } catch (e) {} }
        };
        break;
      }

      // ── 🌅 日落：温暖低频三角波 ──
      case 'sunset': {
        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 80;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.02;
        osc.connect(gain2); gain2.connect(_ambientGain);
        osc.start();
        _ambientNode = osc;
        break;
      }

      // dark / light / monochrome — 无氛围
      default:
        break;
    }
  } catch (e) { /* audio not available */ }
}

// ═══════════════════════════════════════════
//  三态音效开关
// ═══════════════════════════════════════════

function toggleAudio() {
  // 循环: 全部 → 仅UI → 静音 → 全部
  if (_uiAudioOn && _ambientOn) {
    // 当前全部开 → 仅UI
    _ambientOn = false;
    stopAmbient();
  } else if (_uiAudioOn && !_ambientOn) {
    // 当前仅UI → 静音
    _uiAudioOn = false;
    _ambientOn = false;
    stopAmbient();
  } else {
    // 当前静音 → 全部开
    _uiAudioOn = true;
    _ambientOn = true;
    const t = (typeof gameState !== 'undefined' && gameState._currentTheme) || 'dark';
    startAmbient(t);
  }
  return { uiOn: _uiAudioOn, ambientOn: _ambientOn };
}

function isAudioOn() { return _uiAudioOn || _ambientOn; }
function isAmbientOn() { return _ambientOn; }
function isUiAudioOn() { return _uiAudioOn; }

console.log('🔊 audio.js v3 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('audio');
