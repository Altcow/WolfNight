'use strict';
// 大野狼來了:深夜木屋躲避遊戲。無按鈕,點場景物件或出聲都會產生「噪音」,狼依噪音大小與位置反應。
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const S = {
  stars: 0, plays: 0, level: 2, vol: 1, mic: 0,
  mode: 'title',            // title | play | escaping | caught | won
  paused: false, hidden: false, round: 1, tapN: 0, idleT: 0, noisy: 0,
};

// ---------- 儲存 ----------
function load() {
  try { const o = JSON.parse(localStorage.getItem('wolfnight') || '{}'); ['stars', 'plays', 'level', 'vol', 'mic'].forEach(k => { if (typeof o[k] === 'number') S[k] = o[k]; }); } catch (e) { /* 無儲存空間 */ }
}
function save() {
  try { localStorage.setItem('wolfnight', JSON.stringify({ stars: S.stars, plays: S.plays, level: S.level, vol: S.vol, mic: S.mic })); } catch (e) { /* 略過 */ }
}

// ---------- Three 場景 ----------
const host = $('#gl');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.Fog(0x05080f, 9, 22);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 60);
const CAM = { x: 0, y: 1.65, z: 6.5 };
function resize() {
  const w = window.innerWidth, h = window.innerHeight, a = w / h;
  renderer.setSize(w, h); camera.aspect = a;
  camera.fov = a < 1 ? clamp(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(40)) / Math.max(a, 0.4)) * 180 / Math.PI, 60, 88) : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, metalness: 0 }, o || {}));
const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (parent || scene).add(b); return b; };

// 光線
scene.add(new THREE.AmbientLight(0x2a3550, 0.9));
const moon = new THREE.DirectionalLight(0x7f9bff, 0.6); moon.position.set(-4, 5, 3); scene.add(moon);
const candle = new THREE.PointLight(0xffa850, 0.9, 11); candle.position.set(-2.5, 1.7, -1.3); scene.add(candle);
const winLight = new THREE.PointLight(0x8fb0ff, 0.8, 9); winLight.position.set(-2.0, 2.0, -4.0); scene.add(winLight);

// 房間
const woodM = mat(0x4a3322), wallM = mat(0x3b2a1d), darkM = mat(0x2a1d14);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), woodM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 1); scene.add(floor);
for (let i = -4; i <= 4; i++) box(0.04, 0.01, 12, mat(0x2d1f14), i, 0.01, 1);
box(9, 4, 0.2, wallM, 0, 2, -4.6);                 // 後牆
box(0.2, 4, 12, wallM, -4.5, 2, 1);                // 左牆
box(0.2, 4, 12, wallM, 4.5, 2, 1);                 // 右牆
box(9, 0.2, 12, darkM, 0, 4, 1);                   // 天花板
for (let i = 0; i < 5; i++) box(0.12, 4, 0.05, mat(0x2d1f14), -3.6 + i * 1.8, 2, -4.48); // 牆板縫

// 可點的物件(含放大的隱形感應盒,小朋友好點)
const proxies = [];
const pulsers = [];
function proxy(kind, w, h, d, x, y, z) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  p.position.set(x, y, z); p.userData.kind = kind; scene.add(p); proxies.push(p); return p;
}
function glowMat(c, em) { const m = mat(c, { emissive: em || 0x000000, emissiveIntensity: 0 }); pulsers.push({ m, base: em || 0x000000 }); return m; }

// 門
const doorM = glowMat(0x7a4a22, 0xffc766);
const doorG = new THREE.Group(); doorG.position.set(0.9, 0, -4.45); scene.add(doorG);
const doorLeaf = box(1.5, 2.7, 0.12, doorM, 0, 1.35, 0, doorG);
box(0.12, 0.12, 0.15, mat(0xd4af37), 0.55, 1.3, 0.1, doorG);
box(1.7, 2.9, 0.1, darkM, 0, 1.45, -0.08, doorG);
const doorLight = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.7), new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0 }));
doorLight.position.set(0, 1.35, -0.12); doorG.add(doorLight);
proxy('door', 2.0, 3.0, 0.8, 0.9, 1.5, -4.2);
const DOOR_POS = new THREE.Vector3(0.9, 0, -3.8);

// 窗
const winM = glowMat(0x6a88c8, 0x88aaff);
const winG = new THREE.Group(); winG.position.set(-2.1, 2.0, -4.45); scene.add(winG);
box(1.8, 1.5, 0.1, darkM, 0, 0, 0, winG);
box(1.5, 1.2, 0.05, winM, 0, 0, 0.06, winG);
box(0.06, 1.2, 0.07, darkM, 0, 0, 0.1, winG); box(1.5, 0.06, 0.07, darkM, 0, 0, 0.1, winG);
const shutL = box(0.75, 1.2, 0.06, doorM, -0.9, 0, 0.1, winG); const shutR = box(0.75, 1.2, 0.06, doorM, 0.9, 0, 0.1, winG);
proxy('window', 2.2, 1.8, 0.8, -2.1, 2.0, -4.0);
const WIN_POS = new THREE.Vector3(-2.1, 0, -3.4);

// 窗簾
const curtM = mat(0x7a2a35);
const curtain = box(0.55, 1.9, 0.12, curtM, -3.4, 2.0, -4.3);
proxy('curtain', 0.9, 2.2, 0.6, -3.4, 2.0, -4.1);

// 時鐘
const clockM = glowMat(0xe8dcc0, 0xffffff);
const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24), clockM); clock.rotation.x = Math.PI / 2; clock.position.set(-0.6, 3.05, -4.45); scene.add(clock);
const hand1 = box(0.04, 0.3, 0.02, darkM, -0.6, 3.12, -4.38); const hand2 = box(0.03, 0.22, 0.02, darkM, -0.54, 3.05, -4.38); hand2.rotation.z = -1.2;
proxy('clock', 1.1, 1.1, 0.6, -0.6, 3.05, -4.2);
const CLOCK_POS = new THREE.Vector3(-0.6, 0, -3.8);

// 桌子 + 鍋子
const tableM = mat(0x5d3f26);
box(1.7, 0.1, 1.0, tableM, -2.5, 0.95, -1.3);
[[-3.25, -1.7], [-1.75, -1.7], [-3.25, -0.9], [-1.75, -0.9]].forEach(([x, z]) => box(0.1, 0.95, 0.1, tableM, x, 0.47, z));
const potM = glowMat(0x9aa0a8, 0xffffff);
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.45, 18), potM); pot.position.set(-2.5, 1.27, -1.3); scene.add(pot);
const potHandle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 14), mat(0x333333)); potHandle.position.set(-2.2, 1.3, -1.3); scene.add(potHandle);
proxy('pot', 1.4, 1.2, 1.0, -2.5, 1.2, -1.3);
const POT_POS = new THREE.Vector3(-2.5, 0, -1.3);

// 櫃子
const cupM = glowMat(0x6e4a2a, 0x66ff99);
const cup = new THREE.Group(); cup.position.set(3.1, 0, -3.6); scene.add(cup);
box(1.3, 2.5, 0.9, cupM, 0, 1.25, 0, cup);
box(0.04, 2.3, 0.04, darkM, 0, 1.25, 0.47, cup);
box(0.1, 0.35, 0.06, mat(0xd4af37), -0.15, 1.2, 0.5, cup); box(0.1, 0.35, 0.06, mat(0xd4af37), 0.15, 1.2, 0.5, cup);
proxy('cupboard', 1.7, 2.8, 1.3, 3.1, 1.4, -3.6);
const CUP_POS = new THREE.Vector3(3.0, 0, -2.8);

// 狼
const wolfProxy = proxy('wolf', 1.6, 2.8, 1.2, 0, 1.4, 0);
const FLOOR_X = [-3.5, 3.5], FLOOR_Z = [-3.6, 4.5];

const rig = (() => {
  const g = new THREE.Group();
  const fur = mat(0x58606e), furL = mat(0x8a919e), dark = mat(0x23262e), org = mat(0xe2761b), over = mat(0x2d2f33);
  const R = { g, legs: [], arms: [], eyes: [], ears: [] };
  [-0.3, 0.3].forEach(sx => {
    const hip = new THREE.Group(); hip.position.set(sx, 1.0, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.95, 10), over); leg.position.y = -0.47; hip.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), dark); foot.scale.set(1, 0.6, 1.4); foot.position.set(0, -0.95, 0.12); hip.add(foot);
    g.add(hip); R.legs.push(hip);
  });
  const torso = new THREE.Group(); torso.position.y = 1.65; g.add(torso); R.torso = torso;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), fur); body.scale.set(1, 1.15, 0.8); torso.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), over); belly.scale.set(1, 0.95, 0.7); belly.position.set(0, -0.2, 0.15); torso.add(belly);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 8, 16), org); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.62; torso.add(scarf);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8, 8), fur); tail.position.set(0, -0.3, -0.65); tail.rotation.x = -2.0; torso.add(tail); R.tail = tail;
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.68, 0.45, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.9, 10), fur); arm.position.y = -0.45; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), furL); hand.position.y = -0.92; sh.add(hand);
    for (let i = -1; i <= 1; i++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 6), dark); cl.position.set(i * 0.07, -1.08, 0.04); cl.rotation.x = Math.PI; sh.add(cl); }
    torso.add(sh); R.arms.push(sh);
  });
  const head = new THREE.Group(); head.position.set(0, 1.05, 0.05); torso.add(head); R.head = head;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), fur); skull.scale.set(1.15, 1, 1); head.add(skull);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 10), furL); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.12, 0.55); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), dark); nose.position.set(0, -0.1, 0.82); head.add(nose);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), dark); jaw.position.set(0, -0.3, 0.55); head.add(jaw);
  for (let i = -2; i <= 2; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0xf2f2e8 })); t.position.set(i * 0.075, -0.25, 0.7); t.rotation.x = Math.PI; head.add(t); }
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 8), fur); ear.position.set(s * 0.34, 0.5, 0); ear.rotation.z = -s * 0.25; head.add(ear); R.ears.push(ear);
    const em = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc84a, emissiveIntensity: 1.2 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), em); eye.scale.set(1.1, 0.8, 0.6); eye.position.set(s * 0.22, 0.1, 0.46); head.add(eye); R.eyes.push(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark); pup.position.set(s * 0.22, 0.1, 0.54); head.add(pup);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), dark); brow.position.set(s * 0.22, 0.26, 0.5); brow.rotation.z = s * 0.4; head.add(brow);
  });
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), org); hat.scale.set(1.05, 0.5, 1); hat.position.set(0, 0.5, 0.05); head.add(hat);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.14), mat(0xf0c890)); patch.position.set(0.08, 0.66, 0.08); head.add(patch);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
  return R;
})();
scene.add(rig.g);

// 之後有 3D 模型就放 models/wolf.glb(直立兩足,腳底在 y=0),會自動取代上面的程式模型
let gltfMixer = null, gltfClips = {};
(async function tryModel() {
  try {
    const r = await fetch('models/wolf.glb', { method: 'HEAD' });
    if (!r.ok || !/octet|gltf|model/.test(r.headers.get('content-type') || 'octet')) return;
    new THREE.GLTFLoader().load('models/wolf.glb', gl => {
      const m = gl.scene, bb = new THREE.Box3().setFromObject(m), hgt = bb.max.y - bb.min.y || 1;
      m.scale.setScalar(2.9 / hgt); m.position.y = -bb.min.y * (2.9 / hgt); rig.g.children.slice().forEach(c => { if (c.type !== 'Mesh' || c.geometry.type !== 'CircleGeometry') rig.g.remove(c); });
      rig.g.add(m); rig.model = true;
      gltfMixer = new THREE.AnimationMixer(m);
      gl.animations.forEach(a => { gltfClips[a.name.toLowerCase()] = gltfMixer.clipAction(a); });
    });
  } catch (e) { /* 沒有模型就用程式模型 */ }
})();
let curClip = null;
function playClip(re) {
  if (!gltfMixer) return;
  const k = Object.keys(gltfClips).find(n => re.test(n)) || Object.keys(gltfClips)[0];
  if (!k || curClip === k) return;
  if (curClip) gltfClips[curClip].fadeOut(0.25);
  gltfClips[k].reset().fadeIn(0.25).play(); curClip = k;
}

// ---------- 狼 AI ----------
const W = { state: 'patrol', pos: new THREE.Vector3(-1, 0, -2.5), yaw: 0, target: null, timer: 0, phase: 0, headYaw: 0, look: null, wp: null, aw: 0, hold: 0, search: 0 };
const WPS = [[-2.5, -3], [0, -3.2], [2.2, -3], [-3, -0.5], [0.5, 0.2], [3, -0.2], [-1.2, 1.8], [1.8, 2.2]].map(([x, z]) => new THREE.Vector3(x, 0, z));
const LF = () => [0.75, 1, 1.35][S.level - 1] * Math.min(1.5, 1 + (S.round - 1) * 0.08);
function nextWP() {
  let n; do { n = WPS[Math.floor(Math.random() * WPS.length)]; } while (W.wp === n || n.distanceTo(W.pos) < 1.5);
  W.wp = n; return n;
}
function setState(s, t) {
  if (W.state === s) return;
  W.state = s; W.timer = t || 0;
  const txt = { patrol: '狼在巡邏', alert: '狼聽到聲音了', investigate: '狼過去查看', sniff: '狼在嗅聞', hunt: '狼發現小朋友了!', search: '狼在搜索' }[s];
  if (txt) Net.state({ text: txt, form: s === 'hunt' ? 'scary' : 'toon', stars: S.stars, scare: S.level });
}
function moveTo(p, sp, dt) {
  const dx = p.x - W.pos.x, dz = p.z - W.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.12) return true;
  const st = Math.min(sp * dt, d);
  W.pos.x += dx / d * st; W.pos.z += dz / d * st;
  W.yaw += wrapA(Math.atan2(dx, dz) - W.yaw) * Math.min(1, dt * 7);
  W.phase += sp * dt * 3.2;
  return false;
}

// 噪音事件:pos 為地面位置,mag 0~1
const ripples = [];
function ripple(pos, mag) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.06, pos.z); scene.add(m); ripples.push({ m, t: 0, s: 1 + mag * 2.5 });
}
function noise(pos, mag, name, awMul) {
  if (S.mode !== 'play' && S.mode !== 'escaping') return;
  ripple(pos, mag);
  if (name) Net.log('小朋友碰了:' + name);
  const dist = W.pos.distanceTo(pos);
  let hear = mag * (1 - clamp(dist / 14, 0, 0.7));
  if (S.hidden) hear *= 0.35;
  const gain = hear * 0.55 * (awMul === undefined ? 1 : awMul) * LF() * (S.round === 1 && S.plays <= 1 && S.tapN < 3 ? 0.6 : 1);
  W.aw = clamp(W.aw + gain, 0, 1.2);
  if (W.state === 'hunt' || S.mode === 'caught') return;
  if (hear > 0.18) {
    Sfx.growl();
    if (W.state === 'patrol' || W.state === 'search' || W.state === 'sniff') { W.target = pos.clone(); W.target.y = 0; setState('alert', 0.7 / LF()); }
    else if (W.state === 'alert' || W.state === 'investigate') { W.target = pos.clone(); W.target.y = 0; if (W.state === 'investigate') W.timer = 0; }
    W.look = pos.clone();
  }
  if (W.aw >= 1 && !S.hidden && S.mode === 'play') startHunt();
}
function startHunt() {
  if (W.state === 'hunt' || S.mode === 'caught' || S.mode === 'won') return;
  setState('hunt'); Sfx.roar(0.8); Net.log('狼發現小朋友了!');
  shake = 0.6;
}

// ---------- 互動 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const kidPos = new THREE.Vector3(0, 0, 5);
function onTap(ev) {
  if (S.mode === 'title') return startGame();
  if (S.paused || (S.mode !== 'play' && S.mode !== 'escaping')) return;
  S.tapN++; S.idleT = 0; $('#hint').style.display = 'none';
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(proxies, false)[0];
  if (hit) return interact(hit.object.userData.kind);
  const p = new THREE.Vector3();
  if (ray.ray.intersectPlane(floorPlane, p) && p.z < 5.5) { p.x = clamp(p.x, -4, 4); p.z = clamp(p.z, -4, 5); noise(p, 0.25); Sfx.footstep(); }
  else noise(kidPos, 0.15);
}
let potWob = 0, shutT = 0;
function interact(kind) {
  if (S.hidden && kind !== 'cupboard') { noise(CUP_POS, 0.3, '(躲著亂動)'); Sfx.rustle(); return; }
  switch (kind) {
    case 'cupboard':
      S.hidden = !S.hidden; $('#hideMask').classList.toggle('on', S.hidden); Sfx.rustle(); noise(CUP_POS, 0.12, S.hidden ? '躲進櫃子' : '離開櫃子'); break;
    case 'door': tryEscape(); break;
    case 'window': Sfx.bang(); shutT = 0.5; noise(WIN_POS, 0.55, '窗戶'); break;
    case 'pot': Sfx.clang(); potWob = 0.7; noise(POT_POS, 0.9, '鍋子'); break;
    case 'clock': Sfx.bell(); noise(CLOCK_POS, 1.0, '時鐘'); W.aw = clamp(W.aw + 0.12 * LF(), 0, 1.2); break;
    case 'curtain': Sfx.rustle(); noise(new THREE.Vector3(-3.2, 0, -3.8), 0.3, '窗簾'); break;
    case 'wolf': Sfx.rustle(); W.aw = clamp(W.aw + 0.45 * LF(), 0, 1.2); noise(kidPos, 0.7, '摸了大野狼'); W.look = camera.position.clone(); break;
  }
}
let esc = 0;
function tryEscape() {
  if (S.mode === 'escaping') return;
  S.mode = 'escaping'; esc = 0; S.hidden = false; $('#hideMask').classList.remove('on');
  Sfx.creak(); Net.log('小朋友想開門逃走');
  noise(DOOR_POS, 0.8, undefined, 0.25);
}

// ---------- 流程 ----------
let shake = 0, hbT = 0, hintShown = false;
function resetRound() {
  S.mode = 'play'; S.hidden = false; S.tapN = 0; S.idleT = 0; hintShown = false; esc = 0;
  $('#hideMask').classList.remove('on'); $('#hint').style.display = 'none';
  W.pos.set(-1.2, 0, -2.6); W.yaw = 0.3; W.aw = 0; W.target = null; W.look = null; W.state = ''; setState('patrol'); nextWP();
  camera.position.set(CAM.x, CAM.y, CAM.z); doorLight.material.opacity = 0; doorLeaf.rotation.y = 0;
  const h = $('#hush'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on');
}
async function startGame() {
  if (S.mode !== 'title') return;
  $('#title').classList.add('hidden');
  Sfx.setVol(S.vol); Sfx.creak(); setTimeout(() => Sfx.howl(1.6), 500);
  S.plays++; save(); S.round = 1; resetRound();
  if (S.mic) micOn();
}
function winRound() {
  S.mode = 'won'; S.stars++; save(); $('#starN').textContent = S.stars; Net.log('成功逃脫!');
  Net.state({ text: '小朋友成功逃出去了!', form: 'toon', stars: S.stars, scare: S.level });
  const e = $('#stars'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
  Sfx.chime(); flash(); const f = $('#winFx'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  S.round++; setTimeout(resetRound, 2400);
}
function flash() { const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
// ---------- 撲過來跳臉:蹲伏 → 衝刺 → 近距離張嘴(圖 5 + 圖 4 的三格分鏡) ----------
const lungeImg = { crouch: new Image(), strip: new Image() };
lungeImg.crouch.src = 'img/lunge_crouch.webp'; lungeImg.strip.src = 'img/lunge_strip.webp';
function lungeReady() { return lungeImg.crouch.complete && lungeImg.crouch.naturalWidth && lungeImg.strip.complete && lungeImg.strip.naturalWidth; }
function playLunge(heavy) {
  return new Promise(resolve => {
    const cv = $('#lunge'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    cv.classList.add('on');
    const pH = lungeImg.strip.naturalHeight / 3, M = Math.round(pH * 0.016), sh = pH - 2 * M;
    // 每格:來源圖、來源 y、來源高、焦點 x(0~1)、起始/結束放大、長度(秒)
    const T3 = heavy ? 1.5 : 1.0;
    // 直接嚇:一開始就是嘴巴大張的近距離(重度前面多 0.15 秒的中距離飛撲)
    const p3 = { img: lungeImg.strip, sy: pH * 2 + M, h: sh, fx: 0.55, z0: 1.0, z1: 1.3, d: T3, shake: true };
    const seq = heavy ? [{ img: lungeImg.strip, sy: pH + M, h: sh, fx: 0.53, z0: 1.0, z1: 1.1, d: 0.15 }, p3] : [p3];
    const total = seq.reduce((a, f) => a + f.d, 0);
    let t0 = performance.now(), idx = -1;
    function frame(now) {
      const t = (now - t0) / 1000;
      if (t >= total) { cv.classList.remove('on'); return resolve(); }
      let acc = 0, i = 0;
      while (i < seq.length - 1 && t >= acc + seq[i].d) { acc += seq[i].d; i++; }
      const f = seq[i], k = clamp((t - acc) / f.d, 0, 1);
      if (i !== idx) {
        idx = i;
        if (i === 0) { Sfx.sting(); flash(); }
        if (i === seq.length - 1) { Sfx.roar(heavy ? 1.4 : 0.9); if (i > 0) flash(); }
      }
      const iw = f.img.naturalWidth, z = lerp(f.z0, f.z1, k);
      const scale = Math.max(W / iw, H / f.h) * z, dw = iw * scale, dh = f.h * scale;
      let dx = clamp(W / 2 - f.fx * dw, W - dw, 0), dy = (H - dh) / 2;
      if (f.shake) { dx += (Math.random() - 0.5) * 26 * dpr; dy += (Math.random() - 0.5) * 26 * dpr; }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(f.img, 0, f.sy, iw, f.h, dx, dy, dw, dh);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function caught() {
  if (S.mode === 'caught') return;
  S.mode = 'caught'; Net.log('被大野狼抓到了!');
  Net.state({ text: '被抓到了!', form: 'scary', stars: S.stars, scare: S.level });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (S.level >= 2) {
    if (lungeReady()) {
      await playLunge(S.level >= 3);
    } else {
      flash(); Sfx.sting(); Sfx.roar(S.level >= 3 ? 1.4 : 0.9);
      const j = $('#jumpImg'); j.classList.remove('on'); void j.offsetWidth; j.classList.add('on');
      await wait(S.level >= 3 ? 2300 : 1700);
      j.classList.remove('on');
    }
  }
  else { Sfx.growl(); flash(); await wait(900); }   // 程度 1:不跳臉,只有低吼與閃一下
  await wait(300);
  resetRound();
}

// ---------- 麥克風(家長可選) ----------
let micStream = null, micIv = null, micCtx = null;
async function ensureMic() { if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); return micStream; }
async function micOn() {
  if (micIv) return;
  try {
    const st = await ensureMic();
    micCtx = new (window.AudioContext || window.webkitAudioContext)();
    const an = micCtx.createAnalyser(); an.fftSize = 1024; micCtx.createMediaStreamSource(st).connect(an);
    const buf = new Uint8Array(an.fftSize), t0 = Date.now(); let base = 0, last = 0;
    micIv = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      const rms = Math.sqrt(sum / buf.length);
      if (Date.now() - t0 < 1500) { base = Math.max(base, rms); return; }
      if (Date.now() - Sfx.last() < 900) return;            // 剛播的遊戲音效不算
      if (rms > base * 2.5 + 0.04 && Date.now() - last > 700 && !S.paused) {
        last = Date.now(); const mag = clamp((rms - base) * 6 + 0.3, 0.3, 1);
        noise(kidPos, mag, '出聲'); S.noisy++;
      }
    }, 100);
  } catch (e) { console.warn('mic', e); S.mic = 0; save(); }
}
function micOff() { if (micIv) { clearInterval(micIv); micIv = null; } if (micCtx) { try { micCtx.close(); } catch (e) { /* 略過 */ } micCtx = null; } }

// ---------- 主迴圈 ----------
const clk = new THREE.Clock();
const tmpV = new THREE.Vector3();
function update(dt) {
  const t = clk.elapsedTime;
  // 燭火與提示光
  candle.intensity = 0.8 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
  pulsers.forEach((p, i) => { p.m.emissiveIntensity = (S.mode === 'play' && !S.hidden ? 0.1 : 0.02) + 0.12 * (0.5 + 0.5 * Math.sin(t * 2.2 + i)); });
  if (S.mode === 'play') {
    cupM.emissiveIntensity += 0.0;
  }
  hand1.rotation.z = Math.sin(t * 0.5) * 0.02;
  if (potWob > 0) { potWob -= dt; pot.rotation.z = Math.sin(t * 40) * potWob * 0.5; pot.position.x = -2.5 + Math.sin(t * 30) * potWob * 0.05; } else pot.rotation.z = 0;
  if (shutT > 0) { shutT -= dt; shutL.rotation.y = Math.sin(t * 30) * shutT * 0.8; shutR.rotation.y = -Math.sin(t * 30) * shutT * 0.8; }
  ripples.forEach(r => { r.t += dt; const k = r.t / 0.9; r.m.scale.setScalar(1 + k * r.s * 2); r.m.material.opacity = Math.max(0, 0.8 * (1 - k)); });
  for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].t > 0.9) { scene.remove(ripples[i].m); ripples.splice(i, 1); }

  if (S.mode === 'play' || S.mode === 'escaping') wolfAI(dt);

  // 逃脫:鏡頭衝向門
  if (S.mode === 'escaping') {
    esc += dt; const k = clamp(esc / 1.6, 0, 1), e = k * k * (3 - 2 * k);
    camera.position.set(lerp(CAM.x, 0.9, e), CAM.y, lerp(CAM.z, -2.4, e));
    doorLeaf.rotation.y = -1.1 * clamp(esc / 0.9, 0, 1); doorLight.material.opacity = 0.9 * clamp(esc / 0.9, 0, 1);
    if (tmpV.set(camera.position.x, 0, camera.position.z).distanceTo(W.pos) < 1.3) caught();
    else if (esc >= 1.6) { if (W.pos.distanceTo(DOOR_POS) < 1.6) caught(); else winRound(); }
  } else if (S.mode === 'play') {
    const tx = S.hidden ? 1.3 : CAM.x, tz = S.hidden ? 5.4 : CAM.z;
    camera.position.x = lerp(camera.position.x, tx + Math.sin(t * 0.7) * 0.05, dt * 4);
    camera.position.z = lerp(camera.position.z, tz, dt * 4);
    camera.position.y = CAM.y + Math.sin(t * 1.6) * 0.02;
  }
  const look = S.mode === 'escaping' ? new THREE.Vector3(0.9, 1.4, -4.5) : new THREE.Vector3(S.hidden ? 2.0 : 0, 1.25, -2.8);
  camera.lookAt(look);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.35; camera.position.y += (Math.random() - 0.5) * shake * 0.35; }

  // 危險暈邊與心跳
  const dang = S.mode === 'play' || S.mode === 'escaping' ? clamp(W.aw, 0, 1) : 0;
  $('#danger').style.opacity = String(dang * 0.9);
  hbT -= dt;
  if (dang > 0.25 && hbT <= 0 && !S.paused) { Sfx.heartbeat(1); hbT = lerp(1.3, 0.5, dang); }

  // 沒人碰就出現手指提示(第一次玩教學)
  if (S.mode === 'play') {
    S.idleT += dt;
    if (S.idleT > 6 && !hintShown && S.plays <= 1 && S.round === 1 && S.tapN === 0) {
      hintShown = true; tmpV.set(-2.5, 1.6, -1.3).project(camera);
      const h = $('#hint'); h.style.left = ((tmpV.x * 0.5 + 0.5) * window.innerWidth) + 'px'; h.style.top = ((-tmpV.y * 0.5 + 0.5) * window.innerHeight) + 'px'; h.style.display = 'block';
    }
  }
}
function wolfAI(dt) {
  const L = LF();
  W.aw = Math.max(0, W.aw - dt * (W.state === 'hunt' ? 0 : 0.11));
  let moving = false, sp = 0;
  switch (W.state) {
    case 'patrol': {
      if (!W.wp) nextWP();
      if (W.hold > 0) { W.hold -= dt; W.headLook = Math.sin(W.phase * 0.3 + clk.elapsedTime) * 0.8; if (W.hold <= 0) nextWP(); break; }
      sp = 0.9 * L; moving = true;
      if (moveTo(W.wp, sp, dt)) { W.hold = 1 + Math.random() * 1.5; moving = false; }
      W.look = null; break;
    }
    case 'alert': W.timer -= dt; if (W.timer <= 0) setState('investigate'); break;
    case 'investigate': {
      sp = 1.9 * L; moving = true;
      if (W.target && moveTo(W.target, sp, dt)) { moving = false; setState('sniff', 2.2); }
      break;
    }
    case 'sniff': {
      W.timer -= dt; W.sniffing = true;
      if (W.timer <= 0) {
        W.sniffing = false;
        if (S.hidden && W.pos.distanceTo(CUP_POS) < 4.2) { if (W.aw > 0.5) { caught(); break; } }
        if (W.aw > 0.55 && !S.hidden) { W.search = 2; setState('search'); W.wp = null; } else setState('patrol');
      }
      break;
    }
    case 'search': {
      if (!W.wp) nextWP();
      sp = 1.5 * L; moving = true;
      if (moveTo(W.wp, sp, dt)) { W.search--; if (W.search <= 0) setState('patrol'); else nextWP(); }
      break;
    }
    case 'hunt': {
      sp = 4.2 * L; moving = true;
      const tgt = tmpV.set(camera.position.x, 0, camera.position.z - 0.5);
      moveTo(tgt, sp, dt);
      if (W.pos.distanceTo(tgt) < 1.9 && S.mode !== 'escaping') caught();
      break;
    }
  }
  if (W.state !== 'sniff') W.sniffing = false;
  animateWolf(dt, moving, sp);
}
function animateWolf(dt, moving, sp) {
  const g = rig.g; g.position.set(W.pos.x, 0, W.pos.z); g.rotation.y = W.yaw;
  wolfProxy.position.set(W.pos.x, 1.4, W.pos.z);
  const hunting = W.state === 'hunt', alert = W.state === 'alert' || W.state === 'investigate';
  if (rig.model) { playClip(hunting ? /run|sprint/ : moving ? /walk|sneak/ : /idle|sniff|stand/); if (gltfMixer) gltfMixer.update(dt); return; }
  const sw = moving ? Math.sin(W.phase) * (hunting ? 0.9 : 0.55) : 0;
  rig.legs[0].rotation.x = sw; rig.legs[1].rotation.x = -sw;
  rig.arms[0].rotation.x = hunting ? -1.5 : -sw * 0.8; rig.arms[1].rotation.x = hunting ? -1.5 : sw * 0.8;
  rig.arms[0].rotation.z = hunting ? 0.5 : 0.1; rig.arms[1].rotation.z = hunting ? -0.5 : -0.1;
  rig.torso.position.y = 1.65 + (moving ? Math.abs(Math.sin(W.phase)) * 0.07 : Math.sin(clk.elapsedTime * 1.8) * 0.02);
  rig.torso.rotation.x = hunting ? 0.45 : W.sniffing ? 0.25 : 0.05;
  rig.tail.rotation.z = Math.sin(clk.elapsedTime * (alert ? 8 : 2)) * 0.3;
  // 頭部轉向聲音來源
  let ty = 0;
  if (W.look) ty = clamp(wrapA(Math.atan2(W.look.x - W.pos.x, W.look.z - W.pos.z) - W.yaw), -1.2, 1.2);
  else if (W.headLook !== undefined && W.state === 'patrol' && !moving) ty = W.headLook;
  W.headYaw = lerp(W.headYaw, ty, Math.min(1, dt * 8));
  rig.head.rotation.y = W.headYaw;
  rig.head.rotation.x = W.sniffing ? 0.5 + Math.sin(clk.elapsedTime * 10) * 0.08 : hunting ? 0.2 : 0;
  rig.ears.forEach((e, i) => { e.rotation.x = alert || hunting ? Math.sin(clk.elapsedTime * 30 + i) * 0.25 : 0; });
  const col = hunting ? 0xff2200 : alert ? 0xff9a2a : 0xffc84a;
  rig.eyes.forEach(e => { e.material.emissive.setHex(col); e.material.color.setHex(hunting ? 0xff6a3a : 0xffe08a); e.material.emissiveIntensity = hunting ? 2.2 : 0.9 + clamp(W.aw, 0, 1) * 1.2; });
}
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) { clk.getDelta(); return; }
  const dt = Math.min(clk.getDelta(), 0.05);
  if (!S.paused) update(dt); else clk.elapsedTime += 0;
  renderer.render(scene, camera);
}

// ---------- 家長面板 / 雙機 ----------
// ---------- 家長密碼(只是擋住小朋友的簡單鎖,不是高強度保護) ----------
const PIN_CODE = '1234';
let pinBuf = '', pinCb = null;
function buildPin() {
  const pad = $('#pinPad');
  [1, 2, 3, 4, 5, 6, 7, 8, 9, '取消', 0, '⌫'].forEach(k => {
    const b = document.createElement('button'); b.textContent = k;
    if (typeof k === 'string') b.className = 'sub';
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pinKey(k); });
    pad.appendChild(b);
  });
}
function renderPin() { [...$('#pinDots').children].forEach((d, i) => d.classList.toggle('on', i < pinBuf.length)); }
function askPin(cb) { pinBuf = ''; pinCb = cb; renderPin(); $('#pin').classList.remove('hidden'); }
function pinKey(k) {
  if (k === '取消') { $('#pin').classList.add('hidden'); pinCb = null; return; }
  if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < 4) pinBuf += k;
  renderPin();
  if (pinBuf.length === 4) {
    if (pinBuf === PIN_CODE) { const cb = pinCb; $('#pin').classList.add('hidden'); pinCb = null; if (cb) cb(); }
    else { const d = $('#pinDots'); d.classList.remove('bad'); void d.offsetWidth; d.classList.add('bad'); setTimeout(() => { pinBuf = ''; renderPin(); }, 350); }
  }
}
function openPanel() {
  $('#panel').classList.remove('hidden'); $('#vol').value = S.vol; $('#mic').value = String(S.mic);
  document.querySelectorAll('#segLevel button').forEach(b => b.classList.toggle('on', +b.dataset.v === S.level));
}
function roomCode() {
  let c = null;
  try { c = localStorage.getItem('wnRoom'); } catch (e) { /* 無儲存空間 */ }
  if (!/^\d{6}$/.test(c || '')) { c = Net.newCode(); try { localStorage.setItem('wnRoom', c); } catch (e) { /* 略過 */ } }
  return c;
}
function onCmd(c) {
  if (c.type === 'scare') { S.level = clamp(+c.v || 2, 1, 3); save(); return; }
  if (c.type === 'pause') { S.paused = true; $('#paused').classList.remove('hidden'); return; }
  if (c.type === 'resume') { S.paused = false; $('#paused').classList.add('hidden'); return; }
  if (S.mode !== 'play') return;
  if (c.type === 'reveal') { W.aw = 1.1; if (!S.hidden) startHunt(); else { W.target = CUP_POS.clone(); setState('investigate'); } }
  else if (c.type === 'calm') { W.aw = 0; W.target = null; W.state = ''; setState('patrol'); nextWP(); }
}
async function startNet(code) {
  $('#roomCode').textContent = code;
  if (!Net.enabled()) { $('#netState').textContent = '(未設定 Firebase,單機模式)'; return; }
  try {
    let online = true, mom = false;
    const show = () => { $('#netState').textContent = !online ? '離線(單機繼續玩)' : mom ? '🟢 媽媽已連線' : '已連線,等待媽媽輸入配對碼'; };
    await Net.host(code, onCmd, m => { mom = m; show(); });
    show();
    Net.onOnline(o => { online = o; show(); });
    Net.state({ text: '', form: 'toon', stars: S.stars, scare: S.level });
  } catch (e) { $('#netState').textContent = '連線失敗,單機模式'; console.warn(e); }
}
function buildUI() {
  const c = renderer.domElement;
  c.addEventListener('pointerdown', e => { e.preventDefault(); onTap(e); });
  $('#enterKid').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startGame(); });
  $('#enterParent').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); askPin(openPanel); });
  $('#openParentPage').addEventListener('click', () => window.open('parent.html', '_blank'));
  buildPin();
  let gearTm = null; const g = $('#gear');
  g.addEventListener('pointerdown', e => { e.stopPropagation(); gearTm = setTimeout(() => askPin(openPanel), 1500); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => g.addEventListener(ev, () => clearTimeout(gearTm)));
  $('#closePanel').addEventListener('click', () => $('#panel').classList.add('hidden'));
  document.querySelectorAll('#segLevel button').forEach(b => b.addEventListener('click', () => { S.level = +b.dataset.v; save(); openPanel(); }));
  $('#vol').addEventListener('input', e => { S.vol = +e.target.value; Sfx.setVol(S.vol); save(); });
  $('#mic').addEventListener('change', async e => {
    S.mic = +e.target.value; save();
    if (S.mic) { try { await ensureMic(); if (S.mode !== 'title') micOn(); } catch (err) { S.mic = 0; e.target.value = '0'; save(); alert('無法使用麥克風,已關閉'); } } else micOff();
  });
  $('#newRoom').addEventListener('click', () => { Net.leave(); try { localStorage.removeItem('wnRoom'); } catch (e) { /* 略過 */ } startNet(roomCode()); });
  $('#resetBtn').addEventListener('click', () => { S.stars = 0; S.plays = 0; save(); $('#starN').textContent = 0; });
}

load(); $('#starN').textContent = S.stars; buildUI(); startNet(roomCode());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
camera.position.set(CAM.x, CAM.y, CAM.z); camera.lookAt(0, 1.25, -2.8);
loop();
// 供除錯與測試
window.__wn = { S, W, noise, interact, startGame, caught, winRound, resetRound, camera, kidPos };
