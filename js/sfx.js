'use strict';
// 用 WebAudio 即時合成的驚嚇音效:遠處狼嚎、咆哮、心跳、驚嚇尖音(不需音檔)
const Sfx = (() => {
  let ac = null, vol = 1, lastT = 0;
  const MAX = 0.8;  // 音效總音量上限,避免嚇到耳朵
  function ctx() { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; }
  function setVol(v) { vol = v; }
  function out(c, g) { lastT = Date.now(); const m = c.createGain(); m.gain.value = MAX * vol; g.connect(m).connect(c.destination); }
  function noise(c, sec) {
    const b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  }

  // 遠處狼嚎:音高上揚再下滑,加顫音
  function howl(sec = 1.8) {
    try {
      const c = ctx(), t = c.currentTime;
      const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(620, t + sec * 0.45); o.frequency.exponentialRampToValueAtTime(380, t + sec);
      lfo.frequency.value = 6; lg.gain.value = 14; lfo.connect(lg).connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 1100;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + sec * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      o.connect(f).connect(g); out(c, g);
      o.start(t); lfo.start(t); o.stop(t + sec); lfo.stop(t + sec);
    } catch (e) { /* 不支援 WebAudio 時略過 */ }
  }

  // 咆哮:低頻鋸齒波 + 帶通雜訊 + 破音
  function roar(sec = 1.1) {
    try {
      const c = ctx(), t = c.currentTime;
      const o = c.createOscillator(), ws = c.createWaveShaper(), g = c.createGain();
      const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
      ws.curve = curve;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + sec);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      o.connect(ws).connect(g); out(c, g); o.start(t); o.stop(t + sec);
      const n = noise(c, sec), bp = c.createBiquadFilter(), ng = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1800, t + sec * 0.5);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.6, t + 0.04); ng.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      n.connect(bp).connect(ng); out(c, ng); n.start(t);
    } catch (e) { /* 略過 */ }
  }

  // 驚嚇尖音(短促不和諧)
  function sting() {
    try {
      const c = ctx(), t = c.currentTime, g = c.createGain();
      [880, 932, 1245].forEach(fr => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(g); o.start(t); o.stop(t + 0.35); });
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); out(c, g);
    } catch (e) { /* 略過 */ }
  }

  // 心跳:越來越快
  function heartbeat(n = 4, gap = 0.55) {
    try {
      const c = ctx(), t0 = c.currentTime;
      for (let i = 0; i < n; i++) [0, 0.18].forEach((d, k) => {
        const t = t0 + i * gap * Math.pow(0.9, i) + d, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(70 - k * 15, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g); out(c, g); o.start(t); o.stop(t + 0.15);
      });
    } catch (e) { /* 略過 */ }
  }

  // 腳步聲(悶悶的低頻短音)與嗅聞聲
  function footstep() {
    try {
      const c = ctx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); out(c, g); o.start(t); o.stop(t + 0.2);
    } catch (e) { /* 略過 */ }
  }
  function sniff() {
    try {
      const c = ctx(), t = c.currentTime, n = noise(c, 0.5), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 2;
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.2].forEach(d => { g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16); });
      n.connect(bp).connect(g); out(c, g); n.start(t);
    } catch (e) { /* 略過 */ }
  }

  function blip(freq, dur, type, v, to) {
    try {
      const c = ctx(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); out(c, g); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* 略過 */ }
  }
  function hiss(dur, freq, q, v) {
    try {
      const c = ctx(), t = c.currentTime, n = noise(c, dur), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 1;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp).connect(g); out(c, g); n.start(t);
    } catch (e) { /* 略過 */ }
  }
  const creak = () => { blip(160, 0.9, 'sawtooth', 0.18, 260); blip(170, 0.9, 'sawtooth', 0.12, 230); };
  const clang = () => { blip(520, 0.7, 'triangle', 0.35); blip(783, 0.6, 'triangle', 0.25); blip(1240, 0.4, 'triangle', 0.15); };
  const bell = () => { [880, 1760, 2640].forEach((f, i) => blip(f, 1.6, 'sine', 0.4 / (i + 1))); };
  const bang = () => { blip(110, 0.25, 'square', 0.4, 50); hiss(0.2, 1200, 0.8, 0.4); };
  const rustle = () => hiss(0.35, 3500, 0.8, 0.18);
  const growl = () => { blip(70, 0.9, 'sawtooth', 0.3, 55); hiss(0.8, 300, 1.5, 0.15); };
  const giggle = () => { for (let i = 0; i < 6; i++) setTimeout(() => blip(620 + (i % 2) * 140, 0.09, 'square', 0.18), i * 110); };
  const chime = () => { blip(880, 0.3, 'sine', 0.3); setTimeout(() => blip(1318, 0.4, 'sine', 0.3), 110); setTimeout(() => blip(1760, 0.5, 'sine', 0.25), 230); };
  const last = () => lastT;
  return { howl, roar, sting, heartbeat, footstep, sniff, setVol, creak, clang, bell, bang, rustle, growl, giggle, chime, last };
})();
