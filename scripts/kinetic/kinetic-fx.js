// KINETIC INDEX — cursor interactions (2D only), to compare. index.html KX_INTERACTION or ?interaction=
//   off      the INDEX as it is
//   distort  A: Proximity Distortion. Around the cursor the glyphs themselves bend, like the surface of a soft liquid:
//            the cursor's movement drags the type a little with it (direction and speed), and it flows back when the
//            cursor rests. A WebGL layer over the sheet draws the same type (a copy of the DOM text, drawn per
//            character where the DOM put it) through a small displacement field; the field is pushed by the cursor,
//            spreads a little (viscosity) and relaxes (recover). The DOM type stays where it is, for clicks / focus /
//            reading; while the layer is shown the DOM type is made transparent (it is cross-faded, ~0.15 s). When the
//            field has relaxed, the layer goes away and the page is exactly the original DOM again.
//   elastic  B: Elastic Typography. Each character of the five INDEX words (and, more gently, the event name, the
//            dates and the facts as blocks) is pushed away from the cursor by an invisible force that fades with
//            distance, and is held by a spring: it gives way a few px, sways slightly, and settles back when the cursor
//            leaves. Only CSS `translate` / `scale` on the characters (the engine's own `transform` is untouched).
// Both run only when the INDEX is complete and at rest (not while it assembles, not during open / close, not while
// an item is open), only with a fine pointer that can hover, never with prefers-reduced-motion.
// Parameters: FX below (defaults), ?fx={"radius":180,...} (URL), or the small panel (shown on this branch).

export const FX = {
  distort: {
    radius: 150,      // px: how far around the cursor the type bends
    strength: 0.9,    // how much of the cursor's movement the type takes (1 = it moves with the cursor)
    follow: 0.035,    // s: the cursor's smoothing (smaller = tighter)
    recover: 0.42,    // s: how fast the bend relaxes once the cursor slows or stops
    viscosity: 0.18,  // 0..1: how much the bend spreads into its surroundings each frame (thicker liquid)
    max: 26,          // px: the largest bend
  },
  elastic: {
    radius: 190,      // px: how far the force reaches
    push: 12,         // px: how far a large character gives way (smaller pieces less)
    follow: 0.05,     // s: the cursor's smoothing
    stiffness: 160,   // spring stiffness (higher = snappier return)
    damping: 0.52,    // damping ratio (1 = no sway, lower = more sway)
    scale: 0.025,     // how much a character shrinks under the cursor
  },
};
// pieces left as DOM type (not bent): the dates — Archivo's 66% width cannot be reproduced exactly on a canvas
// (it only knows named widths), so a copy would differ by a hair
const KEEP = new Set(['date']);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function mountFx(api) {
  const { root, sticky, P } = api;
  const q = new URLSearchParams(location.search);
  try { const o = q.get('fx'); if (o) { const j = JSON.parse(o); for (const m of ['distort', 'elastic']) Object.assign(FX[m], j[m] || j); } } catch (e) { /* ignore */ }
  let mode = document.documentElement.dataset.kxi || 'off';
  if (!['off', 'distort', 'elastic'].includes(mode)) mode = 'off';

  // ---------------------------------------------------------------- the cursor (relative to the sheet)
  const cur = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, px: -1e4, py: -1e4, inside: false, seen: false };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const r = sticky.getBoundingClientRect();
    cur.x = e.clientX - r.left; cur.y = e.clientY - r.top;
    cur.inside = cur.x >= 0 && cur.y >= 0 && cur.x <= r.width && cur.y <= r.height;
    if (!cur.seen) { cur.seen = true; cur.sx = cur.px = cur.x; cur.sy = cur.py = cur.y; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { cur.inside = false; });
  addEventListener('blur', () => { cur.inside = false; });

  const allowed = () => !REDUCED && FINE.matches;

  // ================================================================ A: DISTORT
  let gl = null, cv = null, typeCv = null, G = null;
  let fxOn = false, fade = 0, energy = 0, quiet = 0, redrawLeft = 0, needDraw = true, sizeKey = '';
  function glInit() {
    cv = document.createElement('canvas'); cv.className = 'kx-fxc'; cv.setAttribute('aria-hidden', 'true'); sticky.append(cv);
    gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { cv.remove(); cv = null; return false; }
    typeCv = document.createElement('canvas');
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; };
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = (filter) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    G = { field: prog(FS_FIELD), show: prog(FS_SHOW), type: tex(gl.LINEAR), f: [tex(gl.LINEAR), tex(gl.LINEAR)], fb: [gl.createFramebuffer(), gl.createFramebuffer()], i: 0, fw: 1, fh: 1, dpr: 1 };
    return true;
  }
  function glSize() {
    const W = sticky.clientWidth, H = sticky.clientHeight;
    let dpr = Math.min(devicePixelRatio || 1, 2); if (W * H * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (W * H));
    const key = `${W}x${H}@${dpr.toFixed(3)}`; if (key === sizeKey) return; sizeKey = key;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); typeCv.width = cv.width; typeCv.height = cv.height; G.dpr = dpr;
    G.fw = Math.max(8, Math.round(W / 6)); G.fh = Math.max(8, Math.round(H / 6));
    for (let k = 0; k < 2; k++) {
      gl.bindTexture(gl.TEXTURE_2D, G.f[k]);
      const z = new Uint8Array(G.fw * G.fh * 4); for (let i = 0; i < z.length; i += 4) { z[i] = 128; z[i + 1] = 128; z[i + 3] = 255; }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, G.fw, G.fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, z);
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb[k]); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.f[k], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    needDraw = true;
  }
  function clearField() {
    if (!gl) return;
    for (let k = 0; k < 2; k++) { gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb[k]); gl.viewport(0, 0, G.fw, G.fh); gl.clearColor(128 / 255, 128 / 255, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); energy = 0;
  }
  // the sheet's type, character by character, where the DOM put it (so the copy lies exactly on the DOM type)
  const meas = document.createElement('canvas').getContext('2d');
  function drawType() {
    const g = typeCv.getContext('2d'), dpr = G.dpr, s0 = sticky.getBoundingClientRect(), range = document.createRange();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, typeCv.width, typeCv.height);
    g.setTransform(dpr, 0, 0, dpr, -s0.left * dpr, -s0.top * dpr);
    for (const el of sticky.querySelectorAll('.kx-t')) {
      if (el.style.visibility === 'hidden' || KEEP.has(el.dataset.k)) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const cs = getComputedStyle(n.parentElement), st = parseFloat(cs.fontStretch) || 100;
        meas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const stretch = st < 70 ? 'extra-condensed' : st < 80 ? 'condensed' : st < 95 ? 'semi-condensed' : 'normal';
        if ('fontStretch' in meas) meas.fontStretch = stretch;
        g.font = meas.font; if ('fontStretch' in g) g.fontStretch = stretch;
        g.fillStyle = cs.color; g.textBaseline = 'alphabetic';
        let op = 1; for (let e = n.parentElement; e && e !== el; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
        g.globalAlpha = op;
        const ls = parseFloat(cs.letterSpacing) || 0;            // the DOM adds it after each character
        const mm = meas.measureText('出Hg'), asc = mm.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * 0.88, desc = mm.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * 0.12;
        const t = n.textContent;
        for (let i = 0; i < t.length; i++) {
          if (t[i] === ' ' || t[i] === '\n') continue;
          range.setStart(n, i); range.setEnd(n, i + 1);
          const r = range.getClientRects()[0]; if (!r || r.width < 0.5) continue;
          const w = meas.measureText(t[i]).width || r.width, base = r.top + (r.height - (asc + desc)) / 2 + asc;
          // the character's own advance is its box minus the letter-spacing; a scale only corrects a (rare) mismatch
          const kx = w > 0 ? (r.width - ls) / w : 1, ky = r.height / (asc + desc) || 1;
          g.save(); g.translate(r.left, base); g.scale(Math.abs(kx - 1) < 0.002 ? 1 : kx, Math.abs(ky - 1) < 0.03 ? 1 : ky); g.fillText(t[i], 0, 0); g.restore();
        }
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, G.type);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, typeCv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  // the hovered word turns orange (a CSS transition): the copy follows it for that time
  for (const b of root.querySelectorAll('.kx-w')) for (const ev of ['pointerenter', 'pointerleave', 'focus', 'blur', 'click']) b.addEventListener(ev, () => { redrawLeft = 0.45; });

  function distortFrame(dt, rest) {
    const D = FX.distort;
    redrawLeft = Math.max(0, redrawLeft - dt);
    if (!gl && !glInit()) { mode = 'off'; return; }
    glSize();
    const W = sticky.clientWidth, H = sticky.clientHeight;
    // the cursor's movement this frame (smoothed)
    const k = 1 - Math.exp(-dt / Math.max(0.001, D.follow));
    const ox = cur.sx, oy = cur.sy;
    if (cur.seen) { cur.sx += (cur.x - cur.sx) * k; cur.sy += (cur.y - cur.sy) * k; }
    const mx = rest && cur.inside ? cur.sx - ox : 0, my = rest && cur.inside ? cur.sy - oy : 0;
    const sp = Math.hypot(mx, my);
    // how much bend there is (an estimate, so the layer can go away when it has relaxed)
    const decay = Math.exp(-dt / Math.max(0.01, D.recover));
    energy = Math.min(D.max, energy * decay + sp * D.strength * 0.6);
    const want = rest && (energy > 0.6 || (cur.inside && sp > 0.4));
    quiet = want ? 0 : quiet + dt;
    if (!rest) { if (fxOn) { fxOn = false; fade = 0; root.classList.remove('kx-fx-on'); cv.style.opacity = '0'; setTypeOpacity(''); clearField(); } return; }
    if (want && !fxOn) { fxOn = true; needDraw = true; }
    if (!fxOn) return;
    // cross-fade: the copy in, the DOM type out (and back when the bend has relaxed)
    const fin = quiet < 0.2;
    fade = clamp(fade + (fin ? dt : -dt) / 0.15, 0, 1);
    if (!fin && fade <= 0) { fxOn = false; root.classList.remove('kx-fx-on'); cv.style.opacity = '0'; setTypeOpacity(''); clearField(); return; }
    root.classList.add('kx-fx-on');
    if (needDraw || redrawLeft > 0) { drawType(); needDraw = false; }
    // 1) the field: spread a little, relax, take the cursor's push along its path this frame
    const a = G.i, b = 1 - a;
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb[b]); gl.viewport(0, 0, G.fw, G.fh); gl.disable(gl.BLEND);
    gl.useProgram(G.field.p); const U = G.field.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.f[a]); gl.uniform1i(U.uPrev, 0);
    gl.uniform2f(U.uTexel, 1 / G.fw, 1 / G.fh); gl.uniform2f(U.uRes, W, H);
    gl.uniform2f(U.uA, ox, oy); gl.uniform2f(U.uB, cur.sx, cur.sy); gl.uniform2f(U.uMove, mx * D.strength, my * D.strength);
    gl.uniform1f(U.uR, D.radius); gl.uniform1f(U.uDecay, decay); gl.uniform1f(U.uVisc, D.viscosity); gl.uniform1f(U.uMax, D.max);
    gl.drawArrays(gl.TRIANGLES, 0, 3); G.i = b;
    // 2) the type, seen through the field
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(G.show.p); const V = G.show.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.type); gl.uniform1i(V.uType, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.f[b]); gl.uniform1i(V.uField, 1);
    gl.uniform2f(V.uRes, W, H); gl.uniform1f(V.uMax, D.max);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cv.style.opacity = fade.toFixed(3); setTypeOpacity((1 - fade).toFixed(3));
  }
  let typeOp = '';
  function setTypeOpacity(o) { if (o === typeOp) return; typeOp = o; for (const k in P) if (!KEEP.has(k)) P[k].n.style.opacity = o; }

  // ================================================================ B: ELASTIC
  let items = null, elOn = false;
  function wrapChars() {
    for (const b of root.querySelectorAll('.kx-w')) {
      if (b.querySelector('.kx-ch')) continue;
      const t = b.textContent; b.textContent = '';
      for (const ch of t) { const s = document.createElement('span'); s.className = 'kx-ch'; s.textContent = ch; b.append(s); }
    }
    api.remeasure();
  }
  function unwrapChars() {
    let any = false;
    for (const b of root.querySelectorAll('.kx-w')) if (b.querySelector('.kx-ch')) { b.textContent = b.textContent; any = true; }
    if (any) api.remeasure();
  }
  function collect() {
    const s0 = sticky.getBoundingClientRect(), out = [];
    const add = (el, amp) => { const r = el.getBoundingClientRect(); if (r.width < 1) return;
      out.push({ el, x0: r.left - s0.left, y0: r.top - s0.top, w: r.width, h: r.height, amp, x: 0, y: 0, vx: 0, vy: 0, s: 0, vs: 0, k: '' }); };
    for (const s of root.querySelectorAll('.kx-ch')) add(s, clamp(Math.sqrt(s.getBoundingClientRect().height / 220), 0.55, 1.25));
    for (const k of ['name1', 'name2', 'in', 'date', 'facts']) if (P[k]) add(P[k].n, 0.42);
    return out;
  }
  function elasticFrame(dt, rest) {
    const E = FX.elastic;
    if (!rest) { if (elOn) { elOn = false; for (const it of items || []) { it.el.style.translate = ''; it.el.style.scale = ''; } items = null; } return; }
    if (!items) items = collect();
    elOn = true;
    const k = 1 - Math.exp(-dt / Math.max(0.001, E.follow));
    if (cur.seen) { cur.sx += (cur.x - cur.sx) * k; cur.sy += (cur.y - cur.sy) * k; }
    const K = E.stiffness, C = 2 * Math.sqrt(K) * E.damping, h = Math.min(dt, 1 / 30);
    for (const it of items) {
      let tx = 0, ty = 0, ts = 0;
      if (cur.inside) {
        // the nearest point of the piece to the cursor; the force fades to 0 at `radius`
        const nx = clamp(cur.sx, it.x0, it.x0 + it.w), ny = clamp(cur.sy, it.y0, it.y0 + it.h);
        const dn = Math.hypot(cur.sx - nx, cur.sy - ny), f = Math.pow(clamp(1 - dn / E.radius, 0, 1), 2);
        if (f > 0) {
          let dx = it.x0 + it.w / 2 - cur.sx, dy = it.y0 + it.h / 2 - cur.sy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          tx = dx * f * E.push * it.amp; ty = dy * f * E.push * it.amp; ts = -f * E.scale * Math.min(1, it.amp);
        }
      }
      // spring (semi-implicit Euler)
      it.vx += (K * (tx - it.x) - C * it.vx) * h; it.x += it.vx * h;
      it.vy += (K * (ty - it.y) - C * it.vy) * h; it.y += it.vy * h;
      it.vs += (K * (ts - it.s) - C * it.vs) * h; it.s += it.vs * h;
      const still = Math.abs(it.x) < 0.02 && Math.abs(it.y) < 0.02 && Math.abs(it.vx) < 0.05 && Math.abs(it.vy) < 0.05 && Math.abs(it.s) < 1e-4;
      const key = still ? '' : `${it.x.toFixed(2)}|${it.y.toFixed(2)}|${it.s.toFixed(4)}`;
      if (key !== it.k) { it.k = key; it.el.style.translate = still ? '' : `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px`; it.el.style.scale = still || Math.abs(it.s) < 1e-4 ? '' : (1 + it.s).toFixed(4); }
    }
  }

  // ================================================================ switching, the loop
  function setMode(m) {
    if (m === mode && (m !== 'elastic' || root.querySelector('.kx-ch'))) return;
    // leave the old one exactly as the original
    if (fxOn) { fxOn = false; fade = 0; root.classList.remove('kx-fx-on'); if (cv) cv.style.opacity = '0'; setTypeOpacity(''); clearField(); }
    if (items) { for (const it of items) { it.el.style.translate = ''; it.el.style.scale = ''; } items = null; elOn = false; }
    mode = m; document.documentElement.dataset.kxi = m;
    if (m === 'elastic') wrapChars(); else unwrapChars();
    panelSync();
    try { const u = new URL(location.href); u.searchParams.set('interaction', m); history.replaceState(history.state, '', u); } catch (e) { /* sandboxed */ }
  }
  let restT = 0;
  function frame(dt) {
    const restNow = api.rest() && allowed();
    restT = restNow ? restT + dt : 0;
    const rest = restT > 0.12;                       // a beat after the INDEX has settled
    if (mode === 'distort') distortFrame(dt, rest);
    else if (mode === 'elastic') elasticFrame(dt, rest);
    if (panel) panel.hidden = !(api.progress() >= 1 && api.visible());
  }
  function onLayout() { sizeKey = ''; needDraw = true; if (items) { for (const it of items) { it.el.style.translate = ''; it.el.style.scale = ''; } items = null; } }

  // ---------------------------------------------------------------- the comparison panel (this branch only)
  let panel = null;
  const SL = {
    distort: [['radius', 60, 320, 5, 'px'], ['strength', 0.1, 2, 0.05, ''], ['follow', 0.005, 0.2, 0.005, 's'], ['recover', 0.1, 1.5, 0.02, 's'], ['viscosity', 0, 0.6, 0.01, ''], ['max', 6, 60, 1, 'px']],
    elastic: [['radius', 60, 360, 5, 'px'], ['push', 2, 40, 1, 'px'], ['follow', 0.005, 0.3, 0.005, 's'], ['stiffness', 30, 500, 5, ''], ['damping', 0.15, 1.2, 0.01, ''], ['scale', 0, 0.1, 0.005, '']],
  };
  function panelBuild() {
    if (document.documentElement.dataset.kxpanel !== '1') return;
    panel = document.createElement('div'); panel.className = 'kx-dev'; panel.hidden = true; panel.setAttribute('aria-label', 'INTERACTION（比較用）');
    panel.innerHTML = `<button type="button" class="kx-dev-t" aria-expanded="false">FX <b></b></button><div class="kx-dev-b"><div class="kx-dev-h">INTERACTION（比較用）</div><div class="kx-dev-m">${['off', 'distort', 'elastic'].map(m => `<button type="button" data-m="${m}">${{ off: 'OFF', distort: 'A DISTORT', elastic: 'B ELASTIC' }[m]}</button>`).join('')}</div><div class="kx-dev-s"></div></div>`;
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m);
      if (e.target.closest('.kx-dev-t')) { const o = panel.classList.toggle('open'); panel.querySelector('.kx-dev-t').setAttribute('aria-expanded', o ? 'true' : 'false'); }
    });
    document.body.append(panel); panelSync();
  }
  function panelSync() {
    if (!panel) return;
    for (const b of panel.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', b.dataset.m === mode ? 'true' : 'false');
    panel.querySelector('.kx-dev-t b').textContent = { off: 'OFF', distort: 'A', elastic: 'B' }[mode];
    const box = panel.querySelector('.kx-dev-s'); box.innerHTML = '';
    for (const [key, a, b, st, u] of SL[mode] || []) {
      const row = document.createElement('label'); const v = FX[mode][key];
      row.innerHTML = `<span>${key}</span><input type="range" min="${a}" max="${b}" step="${st}" value="${v}"><output>${v}${u}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.addEventListener('input', () => { FX[mode][key] = parseFloat(inp.value); out.textContent = inp.value + u; });
      box.append(row);
    }
  }
  panelBuild();
  if (mode === 'elastic') wrapChars();
  FINE.addEventListener?.('change', () => onLayout());

  return { frame, setMode, onLayout, get mode() { return mode; },
    debug: () => ({ mode, fxOn, fade, energy: +energy.toFixed(2), rest: api.rest(), allowed: allowed(), restT, cur: { ...cur }, items: items ? items.length : 0, gl: !!gl }) };
}

const VS = `attribute vec2 aP; varying vec2 vUv; void main() { vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
// the displacement field (px, y down), stored around 0.5 in RG
const FS_FIELD = `precision highp float;
varying vec2 vUv; uniform sampler2D uPrev; uniform vec2 uTexel, uRes, uA, uB, uMove; uniform float uR, uDecay, uVisc, uMax;
vec2 dec(vec4 c) { return (c.rg - 0.5) * 2.0 * uMax; }
void main() {
  vec2 d = dec(texture2D(uPrev, vUv));
  vec2 n = 0.25 * (dec(texture2D(uPrev, vUv + vec2(uTexel.x, 0.0))) + dec(texture2D(uPrev, vUv - vec2(uTexel.x, 0.0)))
                 + dec(texture2D(uPrev, vUv + vec2(0.0, uTexel.y))) + dec(texture2D(uPrev, vUv - vec2(0.0, uTexel.y))));
  d = mix(d, n, uVisc) * uDecay;
  float l = length(d); d *= l > 0.0 ? max(0.0, l - 0.6 / 255.0 * 2.0 * uMax) / l : 1.0;   // no residue (8-bit steps)
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 ab = uB - uA; float t = clamp(dot(p - uA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float r = length(p - (uA + ab * t)) / uR;
  float g = r < 1.0 ? (1.0 - r * r) * (1.0 - r * r) : 0.0;                                   // smooth, exactly 0 at the radius
  d += uMove * g;
  l = length(d); if (l > uMax) d *= uMax / l;
  gl_FragColor = vec4(d / (2.0 * uMax) + 0.5, 0.0, 1.0);
}`;
// the type, looked up where the field says it came from
const FS_SHOW = `precision highp float;
varying vec2 vUv; uniform sampler2D uType, uField; uniform vec2 uRes; uniform float uMax;
void main() {
  vec2 d = (texture2D(uField, vUv).rg - 0.5) * 2.0 * uMax;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes - d;
  gl_FragColor = texture2D(uType, vec2(p.x / uRes.x, 1.0 - p.y / uRes.y));
}`;
