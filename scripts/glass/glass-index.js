// The glass INDEX (index.html INDEX_MODE = 'glass'): the five INDEX words as thick blue glass, floating together in
// the middle of the summary page. A word turns orange under the pointer / keyboard focus; a click sends the other four
// off, the chosen word moves aside and the item's existing INDEX content appears beside it. Back reverses it.
//
// Letters: real outlines of the typeface (assets/glass/glyphs.json), turned into soft glass tubes (tube.js): every
// stroke gets a round cross-section, corners are rounded, junctions swell a little.
// Glass: two passes. 1) the back faces of all letters -> a small buffer (their normal + distance). 2) the front faces:
// the ray enters (refraction), crosses the tube, leaves through the back face read from the buffer. The colour is a
// pale, slightly milky sky blue where the tube faces the viewer and a deeper blue toward its rims (where the light
// travels along the glass); the page behind shows through softly (frost), and a soft room is reflected at grazing
// angles. No textures, one draw per glyph.
import * as THREE from 'three';
import { GLASS as G } from './config.js';
import { tubeGeometry } from './tube.js';

const PHONE = matchMedia('(max-width:1023px) and (orientation:portrait)');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const EASE = {
  io: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
};
const D2R = Math.PI / 180;

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}

export async function mountGlass(root, hooks = {}) {
  const sticky = root.querySelector('.gx-sticky'), stage = root.querySelector('.gx-stage'), canvas = root.querySelector('.gx-canvas');
  const detail = root.querySelector('.gx-detail'), bodyEl = root.querySelector('.gx-body'), backBtn = root.querySelector('.gx-back');
  const btn = Object.fromEntries([...root.querySelectorAll('.gx-words button')].map(b => [b.dataset.id, b]));
  const ids = Object.keys(btn);
  let current = null, busy = null, hover = null;

  // ------------------------------------------------------------------ 3D (or a flat fallback without WebGL)
  let three = null;
  if (webglAvailable() && !new URLSearchParams(location.search).has('gxflat')) {      // ?gxflat: check the fallback
    try { three = await build(); } catch (e) { console.error(e); three = null; }
  }
  if (!three) root.classList.add('gx-flat');
  root.classList.add('gx-ready');

  // ------------------------------------------------------------------ interaction
  const setHover = (id) => { hover = id; if (three) three.hover(id); for (const k of ids) btn[k].classList.toggle('is-hot', k === id || k === current); };
  for (const id of ids) {
    const b = btn[id];
    b.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') setHover(id); });
    b.addEventListener('pointerleave', () => { if (hover === id) setHover(null); });
    b.addEventListener('focus', () => setHover(id));
    b.addEventListener('blur', () => { if (hover === id) setHover(null); });
    b.addEventListener('click', (e) => { e.preventDefault(); if (current === id) close(); else open(id); });
  }
  backBtn.addEventListener('click', () => close());

  const sectionTop = () => root.getBoundingClientRect().top + scrollY;
  function scrollToSection(cb) {
    const y = Math.round(sectionTop());
    if (Math.abs(scrollY - y) < 2) { cb(); return; }
    if (hooks.scrollTo) hooks.scrollTo(y, cb); else { scrollTo({ top: y, behavior: 'instant' }); cb(); }
  }

  let placeholder = null, item = null;
  function mountItem(id) {
    item = document.getElementById(id); if (!item) return;
    placeholder = document.createComment('gx:' + id); item.before(placeholder); bodyEl.append(item);
    const num = item.querySelector('.row .num'), en = item.querySelector('.row .en');
    detail.querySelector('.gx-num').textContent = num ? num.textContent : '';
    detail.querySelector('.gx-en').textContent = en ? en.textContent : '';
    detail.setAttribute('aria-label', btn[id].dataset.label || id);
  }
  function unmountItem() { if (item && placeholder) placeholder.replaceWith(item); item = null; placeholder = null; }

  function open(id, opts = {}) {
    if (!btn[id]) return Promise.resolve();
    if (busy) return busy.then(() => open(id, opts));
    if (current === id) return Promise.resolve();
    if (current) return close({ quick: true }).then(() => open(id, opts));
    const instant = !!opts.instant || REDUCED;
    busy = new Promise((resolve) => {
      const go = () => {
        current = id; mountItem(id);
        root.classList.add('gx-open'); detail.hidden = false;
        for (const k of ids) { btn[k].setAttribute('aria-expanded', k === id ? 'true' : 'false'); btn[k].tabIndex = k === id ? 0 : -1; }
        btn[id].setAttribute('aria-label', `${btn[id].dataset.label}を閉じて INDEX に戻る`);
        setHover(hover);
        const T = three ? three.open(id, instant) : 0;
        // the content comes in while the word settles
        setTimeout(() => { detail.classList.add('gx-show'); hooks.onChange?.(id); }, instant ? 0 : Math.max(0, T * 1000 - 420));
        setTimeout(() => { busy = null; resolve(); }, instant ? 0 : T * 1000);
      };
      if (opts.noScroll) go(); else scrollToSection(go);
    });
    return busy;
  }
  function close(opts = {}) {
    if (busy) return busy.then(() => close(opts));
    if (!current) return Promise.resolve();
    const id = current, instant = !!opts.instant || REDUCED;
    busy = new Promise((resolve) => {
      detail.classList.remove('gx-show');
      const fade = instant ? 0 : 260;
      scrollToSection(() => {});
      setTimeout(() => {
        detail.hidden = true; unmountItem(); current = null;
        root.classList.remove('gx-open');
        for (const k of ids) { btn[k].setAttribute('aria-expanded', 'false'); btn[k].tabIndex = 0; }
        btn[id].setAttribute('aria-label', `${btn[id].dataset.label}を開く`);
        hooks.onChange?.(null);
        const T = three ? three.close(id, instant || opts.quick) : 0;
        if (root.contains(document.activeElement) || document.activeElement === document.body) btn[id].focus({ preventScroll: true });
        setTimeout(() => { setHover(hover === id && document.activeElement !== btn[id] ? null : hover); busy = null; resolve(); }, instant ? 0 : T * 1000);
      }, fade);
    });
    return busy;
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.preventDefault(); close(); } });

  return { open, close, get current() { return current; }, three: !!three, debug: () => three && three.debug() };

  // ==================================================================================================== the scene
  async function build() {
    const data = await (await fetch(new URL('../../assets/glass/glyphs.json', import.meta.url))).json();
    const q = new URLSearchParams(location.search).get('gxfont');
    const font = data.fonts[q && data.fonts[q] ? q : G.font];
    const upm = font.upm, emMid = (font.asc + font.desc) / 2;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(G.camera.fov, 1, 1, 100);
    const rig = new THREE.Group(); scene.add(rig);

    // ---- materials
    const srgb2lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => srgb2lin(v / 255)); };
    const ivory = lin(G.glass.ivory);
    const sigma = (hex, tRef) => lin(hex).map((c, i) => -Math.log(clamp(c / ivory[i], 1e-3, 1)) / tRef);
    const rt = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType, depthBuffer: true });
    const U = {
      tBack: { value: rt.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uNear: { value: 1 }, uFar: { value: 2 },
      uIvory: { value: new THREE.Vector3(...ivory) },
      uIor: { value: G.glass.ior }, uRefr: { value: G.glass.refract }, uF0: { value: G.glass.f0 }, uRough: { value: G.glass.rough },
      uDefT: { value: 2 * G.tube.half / upm },
      // body colour (Beer–Lambert): the ivory page seen through `tRef` of glass takes exactly the tint colour
      uSigB: { value: new THREE.Vector3(...sigma(G.glass.tint, G.glass.tRef)) }, uSigO: { value: new THREE.Vector3(...sigma(G.glass.tintOrange, G.glass.tRef)) },
      // the Hero's studio (hero.js, its env): cobalt, moss, a little orange, around a bright sky
      uEnvC: { value: new THREE.Vector3(0.004, 0.03, 0.76) }, uEnvM: { value: new THREE.Vector3(0.11, 0.17, 0.06) }, uEnvO: { value: new THREE.Vector3(0.98, 0.09, 0.0) },
      uEnvK: { value: G.glass.env }, uTime: { value: 0 }, uWave: { value: G.glass.wave }, uWaveF: { value: G.glass.waveFreq },
      uP00: { value: 1 }, uP11: { value: 1 },
    };
    const backMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_BACK, side: THREE.BackSide, blending: THREE.NoBlending, uniforms: { uNear: U.uNear, uFar: U.uFar } });

    // ---- the letters
    const geoCache = {}, t0 = performance.now();
    function glyphGeo(ch) {
      if (geoCache[ch]) return geoCache[ch];
      const g = font.glyphs[ch];
      const geo = tubeGeometry(g.d, { ...G.tube, upm, emMid, adv: g.adv, asc: font.asc, desc: font.desc });
      return (geoCache[ch] = { geo, adv: g.adv / upm });
    }
    const words = {};
    // built one glyph at a time, letting the page breathe in between (no long block of the main thread)
    const breathe = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));
    for (const ch of new Set(ids.flatMap(id => [...btn[id].dataset.text]))) { glyphGeo(ch); await breathe(); }
    for (const id of ids) {
      const text = btn[id].dataset.text, chars = [...text];
      const group = new THREE.Group(), mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_FRONT, uniforms: { ...U, uOrange: { value: 0 }, uHot: { value: 0 } } });
      let x = 0; const box = new THREE.Box3();
      chars.forEach((ch, k) => {
        const { geo, adv } = glyphGeo(ch); const m = new THREE.Mesh(geo, mat); m.position.x = x; group.add(m);
        box.union(geo.boundingBox.clone().translate(new THREE.Vector3(x, 0, 0)));
        x += adv + (k < chars.length - 1 ? G.tracking : 0);
      });
      const w = x; group.children.forEach(m => { m.position.x -= w / 2; }); box.translate(new THREE.Vector3(-w / 2, 0, 0));
      const pivot = new THREE.Group(); pivot.add(group); rig.add(pivot);
      words[id] = { id, pivot, mat, w, box, a: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, o: 0 }, phase: hashPhase(id), tint: 0, hot: 0 };
    }

    const buildMs = Math.round(performance.now() - t0);

    // ---- layout (home positions), camera fit
    let VW = 1, VH = 1, visW = 1, visH = 1, camY = 0, phone = PHONE.matches;
    const home = (id) => (phone ? G.layout.phone : G.layout.desk).find(l => l.id === id);
    function clusterBox() {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const l of (phone ? G.layout.phone : G.layout.desk)) { const w = words[l.id].w * l.s / 2, h = 0.5 * l.s; x0 = Math.min(x0, l.x - w); x1 = Math.max(x1, l.x + w); y0 = Math.min(y0, l.y - h); y1 = Math.max(y1, l.y + h); }
      return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
    function resize() {
      const r = stage.getBoundingClientRect(); VW = Math.max(1, r.width); VH = Math.max(1, r.height); phone = PHONE.matches;
      const dpr = Math.min(devicePixelRatio || 1, VW * VH > 1.6e6 ? 1.5 : 2);
      renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false);
      const bw = Math.round(VW * dpr), bh = Math.round(VH * dpr); rt.setSize(bw, bh); U.uRes.value.set(bw, bh);
      const F = phone ? G.fit.phone : G.fit.desk, cb = clusterBox(), aspect = VW / VH, tf = Math.tan(G.camera.fov * D2R / 2);
      visH = Math.max(cb.h / F.h, cb.w / F.w / aspect); visW = visH * aspect;
      const dist = visH / 2 / tf;
      camera.aspect = aspect; camera.position.set(cb.cx, cb.cy - F.cy * visH, dist); camera.lookAt(cb.cx, cb.cy - F.cy * visH, 0); camera.updateProjectionMatrix();
      camY = cb.cy - F.cy * visH;
      camera.near = dist - 6; camera.far = dist + 6; camera.updateProjectionMatrix();
      U.uNear.value = dist - 4; U.uFar.value = dist + 4; U.uP00.value = camera.projectionMatrix.elements[0]; U.uP11.value = camera.projectionMatrix.elements[5];
      // settle words at their places for the current layout (not during a move)
      for (const id of ids) if (!anims.some(t => t.obj === words[id].a)) placeWord(id);
      dirty = true;
    }
    function placeWord(id) {
      const a = words[id].a;
      if (!current) Object.assign(a, homeOf(id));
      else if (id === current) Object.assign(a, detailOf(id));
      else Object.assign(a, exitOf(id));
    }
    const homeOf = (id) => { const l = home(id); return { x: l.x, y: l.y, z: l.z, rx: l.r[0], ry: l.r[1], rz: l.r[2], s: l.s, o: 0 }; };
    function detailOf(id) {
      const D = phone ? G.detail.phone : G.detail.desk, w = words[id].w;
      const s = Math.min(D.w * visW / w, D.h * visH / 1.0);
      return { x: camera.position.x + (D.x - 0.5) * visW, y: camY + (0.5 - D.y) * visH, z: 0.2, rx: 0, ry: phone ? 0 : 9, rz: 0, s, o: 0 };
    }
    function exitOf(id) {
      const h = homeOf(id), cb = clusterBox();
      let dx = h.x - cb.cx, dy = (h.y - cb.cy) * 1.6; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) dy = -1;
      const far = Math.max(visW, visH) * 1.25;
      return { ...h, x: h.x + dx * far, y: h.y + dy * far, z: h.z - 1.2, rx: h.rx - dy * 22, ry: h.ry + dx * 30, rz: h.rz - dx * 8, s: h.s * 0.92 };
    }

    // ---- tweens
    const anims = [];
    function tween(obj, to, dur, delay = 0, ease = EASE.io) {
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].obj === obj) anims.splice(i, 1);
      if (dur <= 0.001) { Object.assign(obj, to); dirty = true; return; }
      const from = {}; for (const k in to) from[k] = obj[k];
      anims.push({ obj, from, to, dur, t: -delay, ease });
    }
    function tickTweens(dt) {
      for (let i = anims.length - 1; i >= 0; i--) {
        const A = anims[i]; A.t += dt; if (A.t < 0) continue;
        const k = clamp(A.t / A.dur, 0, 1), e = A.ease(k);
        for (const key in A.to) A.obj[key] = lerp(A.from[key], A.to[key], e);
        if (k >= 1) anims.splice(i, 1);
      }
    }
    const tints = {};               // word id -> target orange (0 / 1)
    let hotId = null;
    function hoverWord(id) { hotId = id; for (const k of ids) tints[k] = k === current ? 1 : (k === id && !current ? 1 : 0); dirty = true; }

    const T = G.time;
    function openWord(id, instant) {
      const order = ids.filter(k => k !== id);
      tints[id] = 1;
      if (instant) { for (const k of order) tween(words[k].a, exitOf(k), 0); tween(words[id].a, detailOf(id), 0); words[id].tint = 1; return 0; }
      order.forEach((k, i) => tween(words[k].a, exitOf(k), T.exit, i * 0.04, EASE.in));
      tween(words[id].a, detailOf(id), T.move, 0.14, EASE.io);
      return 0.14 + T.move;
    }
    function closeWord(id, instant) {
      const order = ids.filter(k => k !== id);
      if (instant) { for (const k of ids) tween(words[k].a, homeOf(k), 0); tints[id] = 0; words[id].tint = 0; return 0; }
      tween(words[id].a, homeOf(id), T.back, 0, EASE.io);
      order.forEach((k, i) => tween(words[k].a, homeOf(k), T.back, 0.18 + i * 0.05, EASE.out));
      setTimeout(() => { tints[id] = 0; }, T.back * 600);
      return 0.18 + 0.05 * (order.length - 1) + T.back;
    }

    // ---- pointer (a slight tilt of the block)
    const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; ptr.tx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1); ptr.ty = clamp(e.clientY / innerHeight * 2 - 1, -1, 1); }, { passive: true });

    // ---- hit areas: each button covers its word's projected box (updated as the words move)
    const v3 = new THREE.Vector3(), corners = [...Array(8)].map(() => new THREE.Vector3());
    function placeButtons() {
      for (const id of ids) {
        const W = words[id], b = W.box; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        const pts = [[b.min.x, b.min.y, b.min.z], [b.max.x, b.min.y, b.min.z], [b.min.x, b.max.y, b.min.z], [b.max.x, b.max.y, b.min.z], [b.min.x, b.min.y, b.max.z], [b.max.x, b.min.y, b.max.z], [b.min.x, b.max.y, b.max.z], [b.max.x, b.max.y, b.max.z]];
        pts.forEach((p, i) => { corners[i].set(...p).applyMatrix4(W.pivot.matrixWorld).project(camera); const sx = (corners[i].x + 1) / 2 * VW, sy = (1 - corners[i].y) / 2 * VH; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); });
        const st = `${x0.toFixed(1)},${y0.toFixed(1)},${(x1 - x0).toFixed(1)},${(y1 - y0).toFixed(1)}`;
        if (W._st !== st) { W._st = st; const s = btn[id].style; s.left = x0.toFixed(1) + 'px'; s.top = y0.toFixed(1) + 'px'; s.width = (x1 - x0).toFixed(1) + 'px'; s.height = (y1 - y0).toFixed(1) + 'px'; }
      }
    }

    // ---- frame
    let time = 0, last = performance.now(), dirty = true, running = false, visible = false;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { rootMargin: '80px' });
    io.observe(sticky);
    new ResizeObserver(() => { resize(); kick(); }).observe(stage);
    PHONE.addEventListener?.('change', () => { resize(); kick(); });
    document.addEventListener('visibilitychange', kick);
    const active = () => visible && !document.hidden && !document.body.classList.contains('intro');
    function kick() { if (!running && active()) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
    new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    function frame(now) {
      if (!active()) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt); requestAnimationFrame(frame);
    }
    function step(dt) {
      if (!REDUCED) time += dt;
      U.uTime.value = time;
      tickTweens(dt);
      // tint: a short cross-fade to orange and back
      for (const id of ids) {
        const W = words[id], to = tints[id] || 0, k = 1 - Math.exp(-dt / Math.max(0.01, T.tint / 3));
        W.tint = REDUCED ? to : lerp(W.tint, to, k); W.mat.uniforms.uOrange.value = W.tint;
        const ho = id === hotId && !current ? 1 : 0; W.hot = REDUCED ? ho : lerp(W.hot, ho, 1 - Math.exp(-dt / 0.12)); W.mat.uniforms.uHot.value = W.hot;
      }
      ptr.x = lerp(ptr.x, REDUCED ? 0 : ptr.tx, 1 - Math.exp(-dt * 2.2)); ptr.y = lerp(ptr.y, REDUCED ? 0 : ptr.ty, 1 - Math.exp(-dt * 2.2));
      const F = G.float, tt = time * Math.PI * 2, calm = current ? 0.45 : 1;
      rig.position.y = Math.sin(tt * F.bobHz) * F.bob * calm;
      const base = current ? [0, 0] : (phone ? G.pose.phone : G.pose.desk);   // the block's resting turn in space
      rig.rotation.x = (base[0] + Math.sin(tt * F.tiltHz + 1.3) * F.tilt + ptr.y * F.pointer * 0.6) * D2R * calm;
      rig.rotation.y = (base[1] + Math.sin(tt * F.swayHz) * F.sway + ptr.x * F.pointer) * D2R * calm;
      for (const id of ids) {
        const W = words[id], a = W.a, p = W.phase;
        W.pivot.position.set(a.x, a.y + Math.sin(tt * 0.13 + p) * F.word * calm, a.z + Math.sin(tt * 0.09 + p * 2) * F.word + W.hot * G.hover.lift);
        W.pivot.rotation.set((a.rx + Math.sin(tt * 0.1 + p) * F.wordRot) * D2R, (a.ry + Math.sin(tt * 0.08 + p * 1.7) * F.wordRot) * D2R, (a.rz + Math.sin(tt * 0.07 + p * 0.6) * F.wordRot * 0.4) * D2R);
        W.pivot.scale.setScalar(a.s * (1 + W.hot * G.hover.scale));
      }
      scene.updateMatrixWorld();
      placeButtons();
      // pass 1: back faces -> buffer;  pass 2: the glass
      scene.overrideMaterial = backMat; renderer.setRenderTarget(rt); renderer.setClearColor(0x8080ff, 1); renderer.clear();
      renderer.render(scene, camera);
      scene.overrideMaterial = null; renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      dirty = false;
    }

    resize();
    // compile now, so the first visible frame does not stall
    renderer.compile(scene, camera);
    step(0);
    kick();
    return {
      hover: hoverWord,
      open: openWord,
      close: closeWord,
      debug: () => ({ VW, VH, visW, visH, phone, buildMs, words: Object.fromEntries(ids.map(id => [id, { ...words[id].a, tint: +words[id].tint.toFixed(2), hot: +words[id].hot.toFixed(2) }])) }),
    };
  }
}

function hashPhase(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h % 1000) / 1000 * Math.PI * 2; }

const VS = /* glsl */`
varying vec3 vV; varying vec3 vN; varying vec3 vP;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vP = (modelMatrix * vec4(position, 1.0)).xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;

// back faces: view-space normal (xy) + distance (16 bit in b/a)
const FS_BACK = /* glsl */`
uniform float uNear, uFar; varying vec3 vV; varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  float dn = clamp((-vV.z - uNear) / (uFar - uNear), 0.0, 0.996);
  float hi = floor(dn * 255.0) / 255.0, lo = fract(dn * 255.0);
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, hi, lo);
}`;

const FS_FRONT = /* glsl */`
uniform sampler2D tBack; uniform vec2 uRes; uniform float uNear, uFar, uIor, uRefr, uF0, uRough, uDefT, uP00, uP11, uOrange, uHot, uEnvK;
uniform vec3 uIvory, uSigB, uSigO, uEnvC, uEnvM, uEnvO;
uniform float uTime, uWave, uWaveF;
varying vec3 vV; varying vec3 vN; varying vec3 vP;
float backAt(vec2 uv, out vec3 nb) {
  vec4 c = texture2D(tBack, uv); float dn = c.b + c.a / 255.0;
  vec2 xy = c.rg * 2.0 - 1.0; nb = vec3(xy, -sqrt(max(0.0, 1.0 - dot(xy, xy))));
  return dn > 0.995 ? -1.0 : uNear + dn * (uFar - uNear);
}
// The Hero's environment, as directions (view space, y up): a bright sky with a soft window upper left, and the same
// three coloured panels the Hero's glass reflects — cobalt to the right, moss low left, a small orange patch low right.
// uRough widens every edge (a slightly soft surface).
vec3 env(vec3 d) {
  float r = uRough;
  vec3 c = mix(vec3(0.84, 0.88, 0.95), vec3(1.0, 1.0, 0.99), smoothstep(-0.5, 0.7, d.y));
  c += vec3(0.9) * smoothstep(0.93 - r, 0.975, dot(d, normalize(vec3(-0.45, 0.62, 0.64))));
  float wC = smoothstep(0.24 - r, 0.32 + r, d.x + 0.25 * d.y);
  float wM = smoothstep(0.4 - r, 0.48 + r, -d.x - 0.45 * d.y);
  float wO = 1.0 - smoothstep(0.06, 0.1 + r, length(d.xy - vec2(0.46, -0.4)));
  // the glass recoloured orange carries its colour into everything it shows: the cobalt it would show turns orange
  vec3 cC = mix(uEnvC, vec3(0.98, 0.2, 0.01), uOrange), cO = mix(uEnvO, uEnvC * 0.0 + vec3(0.95, 0.55, 0.12), uOrange);
  c = mix(c, cC, wC); c = mix(c, uEnvM, wM * 0.9 * (1.0 - 0.5 * uOrange)); c = mix(c, cO, wO * 0.8);
  return c;
}
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 N = normalize(vN), V = normalize(-vV);
  if (dot(N, V) < 0.0) N = -N;
  // liquid: a slow, low swell over the surface (as the Hero's reflections drift), strongest where the glass faces us
  vec2 p = vP.xy * uWaveF;
  vec2 sw = vec2(sin(p.x * 1.0 + p.y * 0.55 + uTime * 0.31) + 0.5 * sin(p.y * 1.7 - p.x * 0.8 - uTime * 0.23),
                 sin(p.y * 1.1 - p.x * 0.4 + uTime * 0.27) + 0.5 * sin(p.x * 1.9 + p.y * 0.7 + uTime * 0.19));
  N = normalize(N + vec3(sw * uWave * smoothstep(0.2, 0.9, N.z), 0.0));
  float fd = -vV.z; vec2 suv = gl_FragCoord.xy / uRes;
  vec3 nb; float bd = backAt(suv, nb); float t0 = bd > fd + 0.002 ? bd - fd : uDefT * 0.5;
  // in through the front, across the glass, out through the back
  vec3 R = refract(-V, N, 1.0 / uIor);
  vec2 off = vec2(R.x * uP00, R.y * uP11) * 0.5 * t0 * uRefr / fd;
  vec3 nb1; float bd1 = backAt(suv + off, nb1);
  bool ok = bd1 > fd + 0.002 && bd1 - fd < uDefT * 2.5;
  float t = ok ? bd1 - fd : t0; if (!ok) nb1 = bd > 0.0 ? nb : vec3(0.0, 0.0, -1.0);
  vec3 E = refract(R, -nb1, uIor);
  vec3 seen;
  if (dot(E, E) < 1e-4) { seen = mix(uIvory, env(reflect(R, -nb1)), 0.75) * 0.95; t *= 1.5; }   // turned back inside: the room
  else {
    // straight through: the ivory page; the further the light is bent, the more of the room it brings
    float bend = smoothstep(0.12, 0.5, length(E.xy));
    seen = mix(uIvory, env(normalize(E + vec3(0.0, 0.0, 0.5))), bend);
  }
  // the glass itself: a faint sky tint that deepens with thickness (or orange, the same glass recoloured)
  vec3 sig = mix(uSigB, uSigO, uOrange);
  vec3 col = seen * exp(-sig * t);
  // the surface reflects the room (Fresnel), white to pale blue highlights included in the room
  float c = clamp(dot(N, V), 0.0, 1.0);
  float F = uF0 + (1.0 - uF0) * pow(1.0 - c, 3.2);      // a little more reflective than plain glass, as the Hero
  col = mix(col, env(reflect(-V, N)) * uEnvK, clamp(F, 0.0, 1.0));
  // the key light's highlight, as the Hero's (white, slightly soft)
  vec3 L = normalize(vec3(-0.35, 0.45, 0.82)), Hh = normalize(L + V);
  col = 1.0 - (1.0 - col) * (1.0 - 0.85 * smoothstep(0.5, 0.95, pow(max(dot(N, Hh), 0.0), mix(110.0, 40.0, uRough * 4.0))));
  col += vec3(0.03) * uHot;
  gl_FragColor = vec4(toSrgb(col), 1.0);
}`;
