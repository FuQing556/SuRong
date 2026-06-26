/* ═══════════════════════════════════════════
   audio.js — Web Audio API 合成音效 + 主题氛围
   依赖：state.js
   v2: 统一路由、null安全、柔化音色、主题贴合
   ═══════════════════════════════════════════ */

let _audioCtx = null;
let _ambientNode = null;
let _ambientGain = null;
let _audioOn = true;
let _userGestured = false;

// ── 全局用户手势门控 ──
(function _setupAudioGestureGate() {
  const _unlock = () => {
    _userGestured = true;
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(() => {});
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

// ── 辅助：安全获取ctx，失败静默 ──
function _safeCtx() {
  if (!_audioOn) return null;
  return getCtx();
}

// ═══════════════════════════════════════════
//  UI 音效
// ═══════════════════════════════════════════

// 通用UI按钮点击 — 极轻的咔嗒声（600Hz，0.03s），与游戏选项区分
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

// 游戏选项点击 — 短促明亮的"咔嗒"声（1200Hz正弦，0.05s）
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

// 成就解锁 — C-E-G 大三和弦，三角波，温暖明亮
function playAchievement() {
  const ctx = _safeCtx();
  if (!ctx) return;
  try {
    const notes = [523, 659, 784];  // C5 E5 G5
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

// 错误音效 — 柔和的低音三角波下行（替代刺耳锯齿波）
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
//  氛围音效（按主题）
// ═══════════════════════════════════════════

function stopAmbient() {
  if (_ambientNode) { try { _ambientNode.stop(); } catch (e) {} _ambientNode = null; }
  if (_ambientGain) { _ambientGain = null; }
}

function startAmbient(themeName) {
  stopAmbient();
  const ctx = _safeCtx();
  if (!ctx) return;

  try {
    // 统一的主增益节点 — 所有氛围音效都经过此节点
    _ambientGain = ctx.createGain();
    _ambientGain.gain.value = 0.02;  // 基准音量（下调，原来0.025偏高）
    _ambientGain.connect(ctx.destination);

    switch (themeName) {

      // ── 🌿 森林：柔和风吟（宽带低通滤波白噪声，模拟树叶沙沙）──
      case 'forest': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        // 低频为主的柔和风声 — lowpass 400Hz, 窄Q模拟自然风
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
        const fGain = ctx.createGain(); fGain.gain.value = 0.7;
        src.connect(filter); filter.connect(fGain); fGain.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }

      // ── 🌊 深海：低频潮汐调制噪声 ──
      case 'ocean': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.25;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 200; filter.Q.value = 0.3;
        // LFO 调制模拟潮汐涨落
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 100;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        src.connect(filter); filter.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }

      // ── 💜 赛博：低嗡科技感底噪 ──
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

      // ── 🏯 修仙：柔和持续底嗡 + 稀疏低音风铃（替代随机高频刺耳风铃）──
      case 'xianxia': {
        // 持续嗡鸣底音 — 温暖的pad
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 65;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 98; // 五度泛音
        const gPad = ctx.createGain(); gPad.gain.value = 0.015;
        osc.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc.start(); osc2.start();

        // 稀疏的柔和风铃 — 每次只发一个音，间隔更长（4-7秒），音量更低
        const bells = [523, 587, 659, 784, 880]; // C5-D5-E5-G5-A5 五声音阶
        let bellTimer = null;
        const chime = () => {
          if (!_audioOn || !_ambientGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = bells[Math.floor(Math.random() * bells.length)]; // 不升八度，原始频率更柔和
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.015, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
          o.connect(g); g.connect(_ambientGain);
          o.start(); o.stop(ctx.currentTime + 2.6);
        };
        bellTimer = setInterval(chime, 4000 + Math.random() * 3000);
        _ambientNode = {
          stop: () => {
            clearInterval(bellTimer);
            try { osc.stop(); osc2.stop(); } catch (e) {}
          }
        };
        break;
      }

      // ── 🌃 子夜：55Hz低频 + 极慢LFO调制（替代28Hz不可闻频率）──
      case 'midnight': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.018;
        // 极慢LFO调制频率，产生宇宙背景的"呼吸感"
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 8;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start();
        osc.connect(gain2); gain2.connect(_ambientGain);
        osc.start();
        _ambientNode = osc;
        break;
      }

      // ── ✨ 鎏金：110Hz基频 + 弱五度泛音（金属共鸣感）──
      case 'golden': {
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 110;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 165; // 纯五度泛音
        const gain2 = ctx.createGain(); gain2.gain.value = 0.016;
        const gain3 = ctx.createGain(); gain3.gain.value = 0.006;
        osc.connect(gain2); osc2.connect(gain3);
        gain2.connect(_ambientGain); gain3.connect(_ambientGain);
        osc.start(); osc2.start();
        _ambientNode = { stop: () => { try { osc.stop(); osc2.stop(); } catch (e) {} } };
        break;
      }

      // ── 🌸 樱花：柔风（低频宽带风吟，替代原来偏高频的bandpass）──
      case 'sakura': {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.1;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        // 低通滤波，只保留250Hz以下 → 温暖柔和的微风
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 250; f.Q.value = 0.4;
        const fGain2 = ctx.createGain(); fGain2.gain.value = 0.6;
        src.connect(f); f.connect(fGain2); fGain2.connect(_ambientGain); src.start();
        _ambientNode = src;
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

function toggleAudio() {
  _audioOn = !_audioOn;
  if (!_audioOn) { stopAmbient(); }
  else { const t = gameState._currentTheme || 'dark'; startAmbient(t); }
  return _audioOn;
}

function isAudioOn() { return _audioOn; }

console.log('🔊 audio.js v2 已加载');
window.XIXI.modulesLoaded = (window.XIXI.modulesLoaded || []).concat('audio');
