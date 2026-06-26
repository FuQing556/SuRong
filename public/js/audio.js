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

      // ── 🌿 森林 v3：柔风低吟 + 溪流 + 稀疏鸟鸣 ──
      case 'forest': {
        // 底层柔风 — 350Hz lowpass 白噪声
        const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 350; filter.Q.value = 0.5;
        const fGain = ctx.createGain(); fGain.gain.value = 0.25;
        src.connect(filter); filter.connect(fGain); fGain.connect(_ambientGain); src.start();

        // 中层溪流 — 低频带通白噪声随机短脉冲，模拟远处水流
        let streamTimer = null;
        const streamRipple = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const dur = 0.2 + Math.random() * 0.5;
          const buf2 = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
          const d2 = buf2.getChannelData(0);
          for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * 0.06;
          const src2 = ctx.createBufferSource(); src2.buffer = buf2;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 200 + Math.random() * 200; bp.Q.value = 0.3;
          const g2 = ctx.createGain(); g2.gain.value = 0.015;
          src2.connect(bp); bp.connect(g2); g2.connect(_ambientGain);
          src2.start(now); src2.stop(now + dur + 0.1);
        };
        streamTimer = setInterval(streamRipple, 2000 + Math.random() * 4000);

        // 表层鸟鸣 — 短促高频颤音，随机间隔
        let birdTimer = null;
        const birdChirp = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const chirps = 1 + Math.floor(Math.random() * 3);
          for (let c = 0; c < chirps; c++) {
            const o = ctx.createOscillator(); o.type = 'sine';
            const g = ctx.createGain();
            const t = now + c * 0.15;
            const freq = 1800 + Math.random() * 1200;
            o.frequency.setValueAtTime(freq, t);
            o.frequency.linearRampToValueAtTime(freq + 200, t + 0.06);
            o.frequency.linearRampToValueAtTime(freq - 100, t + 0.1);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.03, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            o.connect(g); g.connect(_ambientGain);
            o.start(t); o.stop(t + 0.15);
          }
        };
        birdTimer = setInterval(birdChirp, 4000 + Math.random() * 8000);

        _ambientNode = {
          stop: () => {
            clearInterval(streamTimer); clearInterval(birdTimer);
            try { src.stop(); } catch (e) {}
          }
        };
        break;
      }// ── 🌊 深海 v5：鲸歌 — 上滑呼唤→渐弱消散（仿多普勒），不回落 ──
      case 'ocean': {
        // 底层极淡垫音
        const pad1 = ctx.createOscillator(); pad1.type = 'sine'; pad1.frequency.value = 100;
        const pad2 = ctx.createOscillator(); pad2.type = 'sine'; pad2.frequency.value = 150;
        const gPad = ctx.createGain(); gPad.gain.value = 0.01;
        pad1.connect(gPad); pad2.connect(gPad); gPad.connect(_ambientGain);
        pad1.start(); pad2.start();

        let whaleTimer = null;
        const whaleCall = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const hasResponse = Math.random() > 0.4;

          // 主音"呼"：从低缓缓爬升→到顶后边微降边消散
          const o1 = ctx.createOscillator(); o1.type = 'sine';
          const g1 = ctx.createGain();
          const start1 = 200 + Math.random() * 60;                      // 200-260Hz
          const peak1 = start1 + 100 + Math.random() * 80;             // 上滑 100-180Hz
          o1.frequency.setValueAtTime(start1, now);
          o1.frequency.linearRampToValueAtTime(peak1, now + 3.5);      // 3.5秒爬升
          o1.frequency.linearRampToValueAtTime(peak1 - 30, now + 8);   // 到顶后只微降30Hz
          g1.gain.setValueAtTime(0, now);
          g1.gain.linearRampToValueAtTime(0.1, now + 2.5);             // 2.5秒浮现
          g1.gain.setValueAtTime(0.1, now + 5.0);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 9);        // 4秒渐弱消散
          o1.connect(g1); g1.connect(_ambientGain);
          o1.start(now); o1.stop(now + 9.5);

          if (hasResponse) {
            // 副音"应"：更高更短，上行后渐弱
            const o2 = ctx.createOscillator(); o2.type = 'sine';
            const g2 = ctx.createGain();
            const start2 = 300 + Math.random() * 60;                    // 300-360Hz
            o2.frequency.setValueAtTime(start2, now + 6);
            o2.frequency.linearRampToValueAtTime(start2 + 80, now + 8.5);
            o2.frequency.linearRampToValueAtTime(start2 + 50, now + 11);
            g2.gain.setValueAtTime(0, now + 6);
            g2.gain.linearRampToValueAtTime(0.06, now + 8);
            g2.gain.setValueAtTime(0.06, now + 9.5);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 13);
            o2.connect(g2); g2.connect(_ambientGain);
            o2.start(now + 6); o2.stop(now + 13.5);
          }
        };
        whaleCall();
        whaleTimer = setInterval(whaleCall, 120000 + Math.random() * 30000);  // 2分钟彩蛋

        // 声呐 ping — 双音"滴—滴"，固定频率，规律间隔
        let sonarTimer = null;
        const sonarPing = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          [0, 0.6].forEach(function(delay) {
            const o = ctx.createOscillator(); o.type = 'sine';
            const g = ctx.createGain();
            o.frequency.setValueAtTime(2200, now + delay);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(0.05, now + delay + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
            o.connect(g); g.connect(_ambientGain);
            o.start(now + delay); o.stop(now + delay + 0.25);
          });
        };
        sonarTimer = setInterval(sonarPing, 10000);  // 固定10秒

        _ambientNode = {
          stop: () => {
            clearInterval(whaleTimer); clearInterval(sonarTimer);
            try { pad1.stop(); pad2.stop(); } catch (e) {}
          }
        };
        break;
      }

      // ── 💜 赛博 v2：机器低嗡 + 摩斯蜂鸣 + 电流噪点 ──
      case 'cyber': {
        // 底层：双振荡器五度堆叠 — 55Hz+82.5Hz 机器嗡鸣
        const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
        const osc2 = ctx.createOscillator(); osc2.type = 'sawtooth'; osc2.frequency.value = 82.5;
        const gDrone = ctx.createGain(); gDrone.gain.value = 0.025;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 180; filter.Q.value = 0.4;
        osc1.connect(filter); osc2.connect(filter); filter.connect(gDrone); gDrone.connect(_ambientGain);
        osc1.start(); osc2.start();

        // 中层：稀疏摩斯蜂鸣 — 880Hz 短促正弦，8-15秒间隔
        let beepTimer = null;
        const morseBeep = () => {
          if (!_ambientOn || !_ambientGain) return;
          // 随机选择蜂鸣模式：短(·) 或 长(–)
          const patterns = [
            [50],           // 单点 ·
            [50, 150],      // ··
            [150],          // 单划 –
            [50, 80, 150],  // ··–
            [150, 80, 50],  // –··
          ];
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          let offset = ctx.currentTime;
          pattern.forEach((dur) => {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, offset);
            g.gain.linearRampToValueAtTime(0.04, offset + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, offset + dur / 1000);
            o.connect(g); g.connect(_ambientGain);
            o.start(offset); o.stop(offset + dur / 1000 + 0.02);
            offset += dur / 1000 + 0.08;
          });
        };
        beepTimer = setInterval(() => {
          morseBeep();
        }, 8000 + Math.random() * 7000);

        // 表层：电流噪点 — 极淡的白噪声短脉冲，模拟电流声
        let crackleTimer = null;
        const crackle = () => {
          if (!_ambientOn || !_ambientGain) return;
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.03;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const g = ctx.createGain(); g.gain.value = 0.02;
          const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
          src.connect(hp); hp.connect(g); g.connect(_ambientGain);
          src.start();
        };
        crackleTimer = setInterval(() => {
          crackle();
        }, 3000 + Math.random() * 5000);

        _ambientNode = {
          stop: () => {
            clearInterval(beepTimer); clearInterval(crackleTimer);
            try { osc1.stop(); osc2.stop(); } catch (e) {}
          }
        };
        break;
      }

      // ── 🏯 修仙 v2：温暖pad + 稀疏风铃 + 远箫泛音 ──
      case 'xianxia': {
        // 底层暖pad — 65+98Hz 纯五度
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 65;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 98;
        const gPad = ctx.createGain(); gPad.gain.value = 0.015;
        osc.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc.start(); osc2.start();

        // 中层风铃 — C5-A5，4-7秒间隔
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

        // 顶层远箫泛音 — D6(1175Hz) 极淡正弦，缓入缓出，似有若无的仙气
        let xiaoTimer = null;
        const xiaoDrift = () => {
          if (!_ambientOn || !_ambientGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = 1175 + Math.random() * 15;  // D6 ± 微颤
          const g = ctx.createGain();
          const now = ctx.currentTime;
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.008, now + 1.5);   // 1.5秒缓缓浮现
          g.gain.setValueAtTime(0.008, now + 3.5);             // 停留2秒
          g.gain.exponentialRampToValueAtTime(0.001, now + 6); // 2.5秒消散
          o.connect(g); g.connect(_ambientGain);
          o.start(now); o.stop(now + 6.5);
        };
        xiaoTimer = setInterval(xiaoDrift, 10000 + Math.random() * 8000);

        _ambientNode = {
          stop: () => {
            clearInterval(bellTimer); clearInterval(xiaoTimer);
            try { osc.stop(); osc2.stop(); } catch (e) {}
          }
        };
        break;
      }

      // ── 🌃 子夜 v2：极低频垫音 + 远处脚步声 ──
      case 'midnight': {
        // 底层垫音 — 55+82Hz 三角波五度
        const osc1 = ctx.createOscillator(); osc1.type = 'triangle'; osc1.frequency.value = 55;
        const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 82;
        const gPad = ctx.createGain(); gPad.gain.value = 0.016;
        // LFO 微调 — 极慢
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.04;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 6;
        lfo.connect(lfoGain); lfoGain.connect(osc1.frequency);
        lfo.start();
        osc1.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc1.start(); osc2.start();

        // 脚步声 — 低频短脉冲，2-4步一组，模拟远处有人轻轻走过
        let stepTimer = null;
        const footsteps = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const steps = 2 + Math.floor(Math.random() * 3);  // 2-4步
          for (let s = 0; s < steps; s++) {
            const t = now + s * (0.4 + Math.random() * 0.6);  // 步间0.4-1.0s
            const o = ctx.createOscillator(); o.type = 'triangle';
            o.frequency.value = 40 + Math.random() * 40;  // 40-80Hz
            const g = ctx.createGain(); g.gain.value = 0;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.03, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            // 低通 — 让脚步发闷
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 120; lp.Q.value = 0.3;
            o.connect(lp); lp.connect(g); g.connect(_ambientGain);
            o.start(t); o.stop(t + 0.3);
          }
        };
        stepTimer = setInterval(footsteps, 8000 + Math.random() * 7000);  // 8-15s

        _ambientNode = {
          stop: () => {
            clearInterval(stepTimer);
            try { osc1.stop(); osc2.stop(); lfo.stop(); } catch (e) {}
          }
        };
        break;
      }// ── ✨ 鎏金 v2：暖金pad + 竖琴琶音 + 低频金钟 ──
      case 'golden': {
        // 底层暖金pad — 110+165Hz 纯五度三角波
        const pad1 = ctx.createOscillator(); pad1.type = 'triangle'; pad1.frequency.value = 110;
        const pad2 = ctx.createOscillator(); pad2.type = 'triangle'; pad2.frequency.value = 165;
        const gPad = ctx.createGain(); gPad.gain.value = 0.018;
        pad1.connect(gPad); pad2.connect(gPad); gPad.connect(_ambientGain);
        pad1.start(); pad2.start();

        // 竖琴琶音 — C5-E5-G5 正弦序列，稀疏
        const harpNotes = [523, 659, 784, 988, 1175, 1319];
        let harpTimer = null;
        const harpArpeggio = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const count = 2 + Math.floor(Math.random() * 4);  // 2-5个音
          const notes = [];
          for (let i = 0; i < count; i++) {
            notes.push(harpNotes[Math.floor(Math.random() * harpNotes.length)]);
          }
          notes.sort(() => Math.random() - 0.5);  // 随机顺序
          notes.forEach((freq, i) => {
            const o = ctx.createOscillator(); o.type = 'sine';
            const g = ctx.createGain(); g.gain.value = 0;
            const t = now + i * 0.25;
            o.frequency.value = freq;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.025, t + 0.03);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
            // 高音加一点亮度
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass'; hp.frequency.value = 400; hp.Q.value = 0.3;
            o.connect(hp); hp.connect(g); g.connect(_ambientGain);
            o.start(t); o.stop(t + 2.0);
          });
        };
        harpTimer = setInterval(harpArpeggio, 12000 + Math.random() * 6000);  // 12-18s

        // 低频金钟 — 200+300Hz 纯五度慢敲
        let bellTimer = null;
        const goldBell = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          [200, 300].forEach((freq) => {
            const o = ctx.createOscillator(); o.type = 'triangle';
            o.frequency.value = freq;
            const g = ctx.createGain(); g.gain.value = 0;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.02, now + 0.6);
            g.gain.setValueAtTime(0.02, now + 2.0);
            g.gain.exponentialRampToValueAtTime(0.001, now + 9);
            o.connect(g); g.connect(_ambientGain);
            o.start(now); o.stop(now + 9.5);
          });
        };
        goldBell();
        bellTimer = setInterval(goldBell, 90000 + Math.random() * 30000);  // 90-120s

        _ambientNode = {
          stop: () => {
            clearInterval(harpTimer); clearInterval(bellTimer);
            try { pad1.stop(); pad2.stop(); } catch (e) {}
          }
        };
        break;
      }// ── 🌸 樱花 v3：柔光五度pad + 稀疏高音风铃（无白噪声）──
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

            // ── 🌅 日落 v2：温暖五度pad + 东方晚钟 + 慵懒归鸟 ──
      case 'sunset': {
        // 底层暖pad — 110Hz+165Hz 纯五度三角波，轻微LFO呼吸
        const pad1 = ctx.createOscillator(); pad1.type = 'triangle'; pad1.frequency.value = 110;
        const pad2 = ctx.createOscillator(); pad2.type = 'triangle'; pad2.frequency.value = 165;
        const gPad = ctx.createGain(); gPad.gain.value = 0.018;
        // LFO 微调主频 — 模拟光线波动
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 3;
        lfo.connect(lfoGain); lfoGain.connect(pad1.frequency);
        lfo.start();
        pad1.connect(gPad); pad2.connect(gPad); gPad.connect(_ambientGain);
        pad1.start(); pad2.start();

        // 中层：东方晚钟 — 200Hz三角波+600Hz泛音，缓起缓落
        let bellTimer = null;
        const eveningBell = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;

          // 撞钟瞬态 — 极短的高频铛
          const strike = ctx.createOscillator(); strike.type = 'sine';
          strike.frequency.value = 800 + Math.random() * 150;
          const gStrike = ctx.createGain(); gStrike.gain.value = 0;
          gStrike.gain.setValueAtTime(0.002, now);
          gStrike.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          strike.connect(gStrike); gStrike.connect(_ambientGain);
          strike.start(now); strike.stop(now + 0.18);

          // 基频 — 200Hz 三角波，微颤
          const fund = ctx.createOscillator(); fund.type = 'triangle';
          fund.frequency.setValueAtTime(200, now);
          fund.frequency.linearRampToValueAtTime(197, now + 3);
          fund.frequency.linearRampToValueAtTime(202, now + 7);
          const gFund = ctx.createGain(); gFund.gain.value = 0;
          gFund.gain.setValueAtTime(0, now);
          gFund.gain.linearRampToValueAtTime(0.04, now + 0.9);     // 0.9s 缓缓浮现
          gFund.gain.setValueAtTime(0.04, now + 2.8);               // 停留近2s
          gFund.gain.exponentialRampToValueAtTime(0.001, now + 10); // 7s 消散
          const bellLP = ctx.createBiquadFilter(); bellLP.type = "lowpass"; bellLP.frequency.value = 800; bellLP.Q.value = 0.5;
          fund.connect(bellLP); bellLP.connect(gFund); gFund.connect(_ambientGain);
          fund.start(now); fund.stop(now + 10.5);

          // 三次泛音 — 600Hz 正弦，更轻
          const harm = ctx.createOscillator(); harm.type = 'sine';
          harm.frequency.value = 600;
          const gHarm = ctx.createGain(); gHarm.gain.value = 0;
          gHarm.gain.setValueAtTime(0, now + 0.3);
          gHarm.gain.linearRampToValueAtTime(0.012, now + 1.2);
          gHarm.gain.setValueAtTime(0.012, now + 2.5);
          gHarm.gain.exponentialRampToValueAtTime(0.001, now + 8);
          harm.connect(gHarm); gHarm.connect(_ambientGain);
          harm.start(now); harm.stop(now + 8.5);
        };
        setTimeout(eveningBell, 12000);  // 12s后敲第一声，避免启动时吓人
        bellTimer = setInterval(eveningBell, 70000 + Math.random() * 30000);  // 70-100s

        // 表层：归鸟啼鸣 — 慵懒、低沉、隔着窗玻璃
        let birdTimer = null;
        const duskBird = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const chirps = 1 + Math.floor(Math.random() * 2);  // 1-2声
          for (let c = 0; c < chirps; c++) {
            const o = ctx.createOscillator(); o.type = 'sine';
            const g = ctx.createGain();
            const t = now + c * 0.22;
            const freq = 1200 + Math.random() * 600;  // 1200-1800Hz（比森林低）
            o.frequency.setValueAtTime(freq, t);
            o.frequency.linearRampToValueAtTime(freq - 120, t + 0.08);
            // 低通滤波模拟隔着窗玻璃
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.4;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.012, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
            o.connect(lp); lp.connect(g); g.connect(_ambientGain);
            o.start(t); o.stop(t + 0.18);
          }
        };
        birdTimer = setInterval(duskBird, 10000 + Math.random() * 10000);  // 10-20s

        _ambientNode = {
          stop: () => {
            clearInterval(bellTimer); clearInterval(birdTimer);
            try { pad1.stop(); pad2.stop(); lfo.stop(); } catch (e) {}
          }
        };
        break;
      }
      // ── ⬜ 黑白 v2：打字机键击 + 换行铃 ──
      case 'monochrome': {
        // 打字机键击 — 短促高频白噪声
        let typeTimer = null;
        const typewriter = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const strikes = 1 + Math.floor(Math.random() * 3);  // 1-3击
          for (let s = 0; s < strikes; s++) {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.1;
            const src = ctx.createBufferSource(); src.buffer = buf;
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass'; hp.frequency.value = 3000; hp.Q.value = 0.2;
            const g = ctx.createGain(); g.gain.value = 0.015;
            const t = now + s * 0.15;
            src.connect(hp); hp.connect(g); g.connect(_ambientGain);
            src.start(t); src.stop(t + 0.05);
          }
          // 换行铃 — 极轻高频短音
          const bell = ctx.createOscillator(); bell.type = 'sine';
          bell.frequency.value = 1200;
          const gBell = ctx.createGain(); gBell.gain.value = 0;
          gBell.gain.setValueAtTime(0, now + 0.5);
          gBell.gain.linearRampToValueAtTime(0.008, now + 0.52);
          gBell.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          bell.connect(gBell); gBell.connect(_ambientGain);
          bell.start(now + 0.5); bell.stop(now + 0.75);
        };
        typeTimer = setInterval(typewriter, 2000 + Math.random() * 3000);  // 2-5s
        _ambientNode = { stop: () => { clearInterval(typeTimer); } };
        break;
      }

      // ── ☀ 明亮 v2：翻书声 + 远处风铃 ──
      case 'light': {
        // 翻书声 — 极轻短促白噪声
        let pageTimer = null;
        const pageTurn = () => {
          if (!_ambientOn || !_ambientGain) return;
          const now = ctx.currentTime;
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.04;
          const src = ctx.createBufferSource(); src.buffer = buf;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.4;
          const g = ctx.createGain(); g.gain.value = 0.01;
          src.connect(lp); lp.connect(g); g.connect(_ambientGain);
          src.start(now); src.stop(now + 0.15);
        };
        pageTimer = setInterval(pageTurn, 8000 + Math.random() * 12000);  // 8-20s

        // 风铃 — C6-E6 稀疏高音
        const bells = [1047, 1175, 1319, 1397];  // C6 D6 E6 F6
        let chimeTimer = null;
        const windChime = () => {
          if (!_ambientOn || !_ambientGain) return;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.value = bells[Math.floor(Math.random() * bells.length)];
          const g = ctx.createGain(); g.gain.value = 0;
          g.gain.setValueAtTime(0.01, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
          o.connect(g); g.connect(_ambientGain);
          o.start(); o.stop(ctx.currentTime + 2.6);
        };
        chimeTimer = setInterval(windChime, 15000 + Math.random() * 10000);  // 15-25s

        _ambientNode = { stop: () => { clearInterval(pageTimer); clearInterval(chimeTimer); } };
        break;
      }

      // ── 🌙 暗色 v2：极低频垫音 — 潜意识层 ──
      case 'dark': {
        const osc1 = ctx.createOscillator(); osc1.type = 'triangle'; osc1.frequency.value = 40;
        const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 60;
        const gPad = ctx.createGain(); gPad.gain.value = 0.014;
        osc1.connect(gPad); osc2.connect(gPad); gPad.connect(_ambientGain);
        osc1.start(); osc2.start();
        _ambientNode = { stop: () => { try { osc1.stop(); osc2.stop(); } catch (e) {} } };
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
