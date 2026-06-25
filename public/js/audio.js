/* ═══════════════════════════════════════════
   audio.js — Web Audio API 合成音效 + 主题氛围
   依赖：state.js
   ═══════════════════════════════════════════ */

let _audioCtx = null;
let _ambientNode = null;
let _ambientGain = null;
let _audioOn = true;  // 音效开关

function getCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// ── UI 音效 ──

function playClick() {
  if (!_audioOn) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  } catch (e) { /* audio not available */ }
}

function playAchievement() {
  if (!_audioOn) return;
  try {
    const ctx = getCtx();
    const notes = [523, 659, 784];  // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.5);
    });
  } catch (e) { /* audio not available */ }
}

function playError() {
  if (!_audioOn) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* audio not available */ }
}

// ── 氛围音效（按主题）──

function stopAmbient() {
  if (_ambientNode) { try { _ambientNode.stop(); } catch (e) {} _ambientNode = null; }
  if (_ambientGain) { _ambientGain = null; }
}

function startAmbient(themeName) {
  stopAmbient();
  if (!_audioOn) return;
  try {
    const ctx = getCtx();
    _ambientGain = ctx.createGain();
    _ambientGain.gain.value = 0.04;
    _ambientGain.connect(ctx.destination);

    switch (themeName) {
      case 'forest': {
        // 风穿过树叶 — 滤波白噪声
        const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.5;
        src.connect(filter); filter.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }
      case 'ocean': {
        // 海浪 — 低频调制噪声
        const buf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 300; filter.Q.value = 0.3;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 150;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        src.connect(filter); filter.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }
      case 'cyber': {
        // 低嗡 + 偶尔高频 — 科技感底噪
        const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 55;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.02;
        const filter2 = ctx.createBiquadFilter();
        filter2.type = 'lowpass'; filter2.frequency.value = 200;
        osc.connect(filter2); filter2.connect(gain2); gain2.connect(ctx.destination);
        osc.start();
        _ambientNode = osc;
        break;
      }
      case 'xianxia': {
        // 五声音阶随机风铃 — C D E G A
        const penta = [523, 587, 659, 784, 880];
        const note = () => {
          if (!_audioOn) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = penta[Math.floor(Math.random() * penta.length)] * 1.5;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.02, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          o.connect(g); g.connect(ctx.destination);
          o.start(); o.stop(ctx.currentTime + 1.6);
        };
        const interval = setInterval(note, 3000 + Math.random() * 2000);
        _ambientNode = { stop: () => clearInterval(interval) };
        break;
      }
      case 'midnight': {
        // 极低频 — 宇宙背景
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 30;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.015;
        osc.connect(gain2); gain2.connect(ctx.destination);
        osc.start();
        _ambientNode = osc;
        break;
      }
      case 'golden': {
        // 极细微金属共鸣
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 120;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.01;
        osc.connect(gain2); gain2.connect(ctx.destination);
        osc.start();
        _ambientNode = osc;
        break;
      }
      case 'sakura': {
        // 柔风 — 高频滤过噪声
        const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
        src.connect(f); f.connect(_ambientGain); src.start();
        _ambientNode = src;
        break;
      }
      case 'sunset': {
        // 温暖低频嗡
        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 80;
        const gain2 = ctx.createGain(); gain2.gain.value = 0.02;
        osc.connect(gain2); gain2.connect(ctx.destination);
        osc.start();
        _ambientNode = osc;
        break;
      }
      default:
        // dark / light / monochrome — 无氛围
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

console.log('🔊 audio.js 已加载');
