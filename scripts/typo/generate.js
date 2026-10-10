// Builds the typographic object (see config.js for the art direction). Runs in a browser (it measures the real
// fonts); tools/typo-generate.html runs it and saves the result as scripts/typo/layout.json, which is all the page
// itself loads. Deterministic: the same config + words + fonts give the same layout.
//
// Passes (each later pass flows around what is already there):
//   A anchors     the five INDEX words, hand placed (config.anchors)
//   B coast       a line of small running text follows the outline just inside it, its size changing from stretch
//                 to stretch — the letters themselves draw the silhouette, with a slightly uneven edge
//   C structure   each part of the shape is swept by bands in its own direction and rhythm (config.regions). A band
//                 of large type takes headings / phrases stretched or compressed to span the free chord; small bands
//                 take running text cut to fit exactly; a long band can split into a word + two half-height lines
//   D grain       what is still open (except the deliberate voids) is filled with fine running text
//
// Output items (base coordinates):
//   { k: 'h', text, font, size, m: [a,b,c,d,e,f], xs: [char x…], y: baseline, tone, anchor? }   a line of type
//   { k: 'v', text, font, size, pts: [[x, y]…], tone, anchor? }                                 upright, stacked
//   { k: 'p', text, font, size, pts: [[x, y]…], rot: [deg…], tone }                             along a path
export async function generate({ config: C, sections, contour }) {
  const STAT = { coastTry: 0, coastOff: 0, coastOut: 0, coastInk: 0 };
  const R = mulberry32(C.seed);
  const cell = C.cell, GW = Math.ceil(1180 / cell), GH = Math.ceil(1475 / cell);
  const inside = new Uint8Array(GW * GH), ink = new Uint8Array(GW * GH), label = new Int8Array(GW * GH).fill(-1), blocked = new Uint8Array(GW * GH);
  fillPoly(inside, GW, GH, contour.map(([x, y]) => [x / cell, y / cell]), 1);
  const segs = C.regions.map(r => r.seed);
  const regionAt = (x, y) => { let best = 1e9, bi = -1; segs.forEach((poly, ri) => { const d = distPoly(x, y, poly); if (d < best) { best = d; bi = ri; } }); return bi; };
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i; if (inside[k]) label[k] = regionAt((i + 0.5) * cell, (j + 0.5) * cell); }
  for (const [[cx, cy], r] of C.voids) for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = (i + 0.5) * cell, y = (j + 0.5) * cell; if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) blocked[j * GW + i] = 1;
  }
  const at = (x, y) => { const i = Math.floor(x / cell), j = Math.floor(y / cell); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
  const free = (x, y) => { const k = at(x, y); return k >= 0 && inside[k] && !ink[k] && !blocked[k]; };

  // ---------------------------------------------------------------- measuring
  const cv = document.createElement('canvas').getContext('2d'), mcache = new Map();
  function adv(text, fk) {
    const key = fk + '|' + text; if (mcache.has(key)) return mcache.get(key);
    const f = C.fonts[fk]; cv.font = `${f.weight} 100px ${f.family}`; if ('fontStretch' in cv) cv.fontStretch = f.stretch ? 'extra-condensed' : 'normal';
    const a = [...text].map(ch => cv.measureText(ch).width); mcache.set(key, a); return a;
  }
  const width = (text, fk, size) => adv(text, fk).reduce((s, w) => s + w, 0) * size / 100;
  const latin = (t) => /^[\x20-\x7E¥–]+$/.test(t);

  // ---------------------------------------------------------------- text streams (running text per section)
  const streams = {};
  for (const [id, s] of Object.entries(sections)) {
    const parts = [...s.small, ...s.mid.filter(t => !latin(t)), ...s.kana];
    // interleave so the stream never repeats the same sentence back to back
    const seq = []; for (let r = 0; r < 4; r++) for (let i = 0; i < parts.length; i++) seq.push(parts[(i * 7 + r * 3) % parts.length]);
    streams[id] = { chars: [...seq.join(C.joiner ?? '')], pos: Math.floor(R() * 40) };
  }
  // take characters from a stream to fill `L` at `size` (returns text + stretch)
  function takeStream(id, fk, size, L) {
    const st = streams[id]; let text = '', w = 0;
    while (true) {
      const ch = st.chars[st.pos % st.chars.length];
      const cw = width(ch, fk, size);
      if (w + cw > L * 1.08 && text.length) break;
      text += ch; w += cw; st.pos++;
      if (text.length > 400) break;
    }
    text = text.replace(/^　+|　+$/g, '');
    const W0 = width(text, fk, size);
    return text ? { t: text, fk, W0, r: L / W0 } : null;
  }

  // ---------------------------------------------------------------- placing type (records its ink)
  const items = [];
  // ink is the type's real glyph shapes (rasterised at the grid's resolution, with a little air around them), so
  // smaller type can settle into the space a large character leaves around itself
  const gcv = document.createElement('canvas'); gcv.width = GW; gcv.height = GH; const g = gcv.getContext('2d', { willReadFrequently: true });
  const gFont = (fk, size) => { const f = C.fonts[fk]; g.font = `${f.weight} ${size}px ${f.family}`; if ('fontStretch' in g) g.fontStretch = f.stretch ? 'extra-condensed' : 'normal'; };
  function stamp(quads, draw, size) {
    const air = Math.max(C.air?.[0] ?? 1.2, size * (C.air?.[1] ?? 0.06));
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of quads) for (const [x, y] of q) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const bx = Math.max(0, Math.floor((x0 - air) / cell) - 1), by = Math.max(0, Math.floor((y0 - air) / cell) - 1);
    const bw = Math.min(GW, Math.ceil((x1 + air) / cell) + 1) - bx, bh = Math.min(GH, Math.ceil((y1 + air) / cell) + 1) - by;
    if (bw <= 0 || bh <= 0) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(bx, by, bw, bh);
    g.save(); g.scale(1 / cell, 1 / cell); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.lineWidth = air * 2;
    draw(g); g.restore();
    const d = g.getImageData(bx, by, bw, bh).data;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) if (d[(j * bw + i) * 4 + 3] > 50) ink[(by + j) * GW + bx + i] = 1;
  }
  function lineH(text, fk, size, origin, ang, sx = 1, h = size, extra = {}) {
    const e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)];
    const A = adv(text, fk); let x = 0; const xs = [], quads = [];
    const P = (u, v) => [origin[0] + e1[0] * u * sx + e2[0] * v, origin[1] + e1[1] * u * sx + e2[1] * v];
    for (const w0 of A) { const w = w0 * size / 100; xs.push(+x.toFixed(2)); quads.push([P(x, 0), P(x + w, 0), P(x + w, h), P(x, h)]); x += w; }
    const base = size * 0.88 + (h - size) / 2, ch = [...text];
    stamp(quads, (g) => { g.transform(e1[0] * sx, e1[1] * sx, e2[0], e2[1], origin[0], origin[1]); gFont(fk, size); g.textBaseline = 'alphabetic';
      ch.forEach((c, i) => { g.strokeText(c, xs[i], base); g.fillText(c, xs[i], base); }); }, size);
    items.push({ k: 'h', text, font: fk, size: +size.toFixed(2), m: [e1[0] * sx, e1[1] * sx, e2[0], e2[1], origin[0], origin[1]].map(v => +v.toFixed(3)),
      xs, y: +(size * 0.88 + (h - size) / 2).toFixed(2), ...extra });
    return x * sx;
  }
  function lineV(text, fk, size, origin, ang, extra = {}) {
    const e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)];
    const pts = [], quads = [];
    [...text].forEach((ch, i) => {
      const u = i * size + size / 2, c = [origin[0] + e1[0] * u + e2[0] * size / 2, origin[1] + e1[1] * u + e2[1] * size / 2];
      pts.push(c.map(v => +v.toFixed(2))); const s = size / 2;
      quads.push([[c[0] - s, c[1] - s], [c[0] + s, c[1] - s], [c[0] + s, c[1] + s], [c[0] - s, c[1] + s]]);
    });
    const ch = [...text];
    stamp(quads, (g) => { gFont(fk, size); g.textAlign = 'center'; g.textBaseline = 'middle';
      ch.forEach((c, i) => { g.strokeText(c, pts[i][0], pts[i][1]); g.fillText(c, pts[i][0], pts[i][1]); }); }, size);
    items.push({ k: 'v', text, font: fk, size: +size.toFixed(2), pts, ...extra });
    return [...text].length * size;
  }
  // tone follows the hierarchy only (no shading from the glass: it is not terrain data): headings deep, phrases deep /
  // cobalt, running text cobalt / mid, the finest grain mid / soft — the anchors stay the brightest blue
  const toneFor = (cls, x, y, t = '') => { const k = hash(t + cls) % 3;
    return cls === 'big' ? 'deep' : cls === 'mid' ? (k ? 'deep' : 'cobalt') : cls === 'small' ? (k ? 'cobalt' : 'mid') : (k ? 'mid' : 'soft'); };

  // ================================================================ A  anchors
  for (const a of C.anchors) {
    const ang = a.a * Math.PI / 180, n = [...a.text].length;
    if (a.v) {
      const sa = ang + Math.PI / 2, e1 = [Math.cos(sa), Math.sin(sa)], e2 = [-Math.sin(sa), Math.cos(sa)], L = n * a.size;
      lineV(a.text, a.font, a.size, [a.c[0] - e1[0] * L / 2 - e2[0] * a.size / 2, a.c[1] - e1[1] * L / 2 - e2[1] * a.size / 2], sa, { tone: 'cobalt', anchor: a.id });
    } else {
      const L = width(a.text, a.font, a.size) * a.sx, e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)];
      lineH(a.text, a.font, a.size, [a.c[0] - e1[0] * L / 2 - e2[0] * a.size / 2, a.c[1] - e1[1] * L / 2 - e2[1] * a.size / 2], ang, a.sx, a.size, { tone: 'cobalt', anchor: a.id });
    }
  }
  dilateInto(ink, GW, GH, C.anchorAir || 3);                 // air around the anchors

  // ================================================================ B  coast (run after the structure, see below)
  function coastPass(K) {
    // the outline, evenly sampled; glyph tops point outward, and the path is traversed in the direction the glyphs
    // then read (tangent = up rotated a quarter turn clockwise), so no stretch of the coast reads backwards
    const outward = (P) => P.map((p, i) => {
      const a = P[(i - 2 + P.length) % P.length], b = P[(i + 2) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let n = [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
      const k = at(p[0] + n[0] * 4, p[1] + n[1] * 4); if (k >= 0 && inside[k]) n = [-n[0], -n[1]];
      return { t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n };
    });
    let path = resample(contour, 3), fr = outward(path);
    const agree = fr.reduce((acc, { t, n }) => acc + Math.sign(t[0] * -n[1] + t[1] * n[0]), 0);
    if (agree < 0) { path = path.reverse(); fr = outward(path); }
    const N = path.length, pts = path, nrm = fr.map(f => f.n), tan = fr.map(f => f.t);
    const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[N - 1];
    const sample = (s) => { s = ((s % total) + total) % total; let i = cum.findIndex(c => c >= s); if (i <= 0) i = 1; const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const lerp = (A, B) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f]; return { p: lerp(pts[i - 1], pts[i]), n: lerp(nrm[i - 1], nrm[i]), t: lerp(tan[i - 1], tan[i]) }; };
    let s = K.start, run = null;
    const flush = () => { if (run && run.text.length) items.push({ k: 'p', text: run.text, font: run.fk, size: +run.size.toFixed(2), pts: run.pts, rot: run.rot, tone: run.tone }); run = null; };
    let segIndex = 0, segEnd = s;
    while (s < K.start + total - 4) {
      if (s >= segEnd) {                                       // a new stretch: new size
        flush(); const size = K.sizes[segIndex % K.sizes.length] * (0.9 + 0.2 * R()); segIndex++;
        const len = K.stretch[0] + R() * (K.stretch[1] - K.stretch[0]); segEnd = s + len;
        const smp = sample(s), reg = C.regions[regionAt(smp.p[0], smp.p[1])];
        run = { text: '', pts: [], rot: [], size, fk: K.font || (size >= 22 ? 'sans9' : 'sans7'), sec: reg.pool, tone: size >= 24 ? 'deep' : 'cobalt' };
      }
      const st = streams[run.sec], ch = st.chars[st.pos % st.chars.length]; st.pos++;
      const w = Math.max(run.size * 0.5, width(ch, run.fk, run.size)) * K.track;
      const m = sample(s + w / 2), inset = run.size * 0.56 + K.inset;
      // glyph up = outward normal; the reading direction must follow the path direction
      const c = [m.p[0] - m.n[0] * inset, m.p[1] - m.n[1] * inset];
      const rot = Math.atan2(m.n[0], -m.n[1]) * 180 / Math.PI;
      const k = at(c[0], c[1]);
      STAT.coastTry++; if (k < 0) STAT.coastOff++; else if (!inside[k]) STAT.coastOut++; else if (ink[k]) STAT.coastInk++;
      if (ch !== '　' && k >= 0 && inside[k] && !ink[k]) {
        run.text += ch; run.pts.push(c.map(v => +v.toFixed(2))); run.rot.push(+rot.toFixed(1));
        const hs = run.size / 2, ws = w / 2, e1 = [Math.cos(rot * Math.PI / 180), Math.sin(rot * Math.PI / 180)], e2 = [-e1[1], e1[0]];
        const q = [[-ws, -hs], [ws, -hs], [ws, hs], [-ws, hs]].map(([u, v]) => [c[0] + e1[0] * u + e2[0] * v, c[1] + e1[1] * u + e2[1] * v]);
        stamp([q], (g) => { g.translate(c[0], c[1]); g.rotate(rot * Math.PI / 180); gFont(run.fk, run.size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(ch, 0, 0); g.fillText(ch, 0, 0); }, run.size);
      } else if (ch !== '　') { const keep = run; flush(); run = { ...keep, text: '', pts: [], rot: [] }; }
      s += w;
    }
    flush();
  }

  // ================================================================ C  structure (words reach the edges first),
  // then B the coast fills the outline between them, then D the grain
  const used = new Map();
  for (const [ri, reg] of C.regions.entries()) sweep(ri, reg, reg.rhythm, false);
  for (const ring of C.coast) coastPass(ring);
  // ================================================================ D  grain
  for (const [ri, reg] of C.regions.entries()) sweep(ri, reg, C.grain, true);
  for (const turn of (C.grainTurns || [90])) for (const [ri, reg] of C.regions.entries()) sweep(ri, { ...reg, grainTurn: turn }, C.grain, true);   // pockets

  // ================================================================ E  pockets: what is still open (the largest empty
  // place first) takes a line set across it at the size that fits, in its part's direction or across it
  pockets();
  function pockets() {
    const P = C.pockets || { min: 9, max: 30, tries: 600 };
    const tried = new Uint8Array(GW * GH);
    const isFree = (k) => inside[k] && !ink[k] && !blocked[k] && !tried[k];
    for (let it = 0; it < P.tries; it++) {
      // chamfer distance to the nearest non-free cell
      const D = new Float32Array(GW * GH);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const k = j * GW + i; if (!isFree(k)) { D[k] = 0; continue; }
        let d = 1e9; if (i) d = Math.min(d, D[k - 1] + 1); if (j) { d = Math.min(d, D[k - GW] + 1); if (i) d = Math.min(d, D[k - GW - 1] + 1.414); if (i < GW - 1) d = Math.min(d, D[k - GW + 1] + 1.414); } D[k] = i && j ? d : 0; }
      let best = 0, bk = -1;
      for (let j = GH - 1; j >= 0; j--) for (let i = GW - 1; i >= 0; i--) { const k = j * GW + i; if (!D[k]) continue;
        let d = D[k]; if (i < GW - 1) d = Math.min(d, D[k + 1] + 1); if (j < GH - 1) { d = Math.min(d, D[k + GW] + 1); if (i < GW - 1) d = Math.min(d, D[k + GW + 1] + 1.414); if (i) d = Math.min(d, D[k + GW - 1] + 1.414); } D[k] = d;
        if (d > best) { best = d; bk = k; } }
      const r = best * cell; STAT.pocketIt = it; STAT.pocketR = +r.toFixed(1); if (r * 2 < P.min) break;
      const x = ((bk % GW) + 0.5) * cell, y = (Math.floor(bk / GW) + 0.5) * cell, reg = C.regions[label[bk]] || C.regions[0];
      let done = false;
      for (let h = Math.min(P.max, r * 2 * 0.86); h >= P.min && !done; h *= 0.8) {
        for (const turn of [0, 90, -90]) {
          const ang = (reg.a + turn) * Math.PI / 180, e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)];
          const okAt = (u) => { for (const f of [-0.36, 0, 0.36]) { const k = at(x + e1[0] * u + e2[0] * f * h, y + e1[1] * u + e2[1] * f * h); if (k < 0 || !inside[k] || ink[k] || blocked[k]) return false; } return true; };
          let u0 = 0, u1 = 0; while (u0 > -900 && okAt(u0 - cell)) u0 -= cell; while (u1 < 900 && okAt(u1 + cell)) u1 += cell;
          const pad = Math.max(0.6, h * 0.04), L = u1 - u0 - pad * 2; if (L < h * 1.6) continue;
          const cls = h >= C.sizes.mid ? 'mid' : 'small';
          let w = cls === 'mid' ? pick(reg.pool, cls, h, L) : null;
          if (w && (L / w.W0 > 1.6)) w = null;
          if (!w) w = takeStream(reg.pool, h < (C.lightBelow ?? 11) ? 'sans5' : C.grainFont || 'sans7', h, L);
          if (!w) continue;
          const sx = Math.min(1.5, Math.max(0.7, L / w.W0)), len = w.W0 * sx, a0 = u0 + pad + (L - len) / 2;
          const o = [x + e1[0] * a0 - e2[0] * h / 2, y + e1[1] * a0 - e2[1] * h / 2];
          used.set(w.t, (used.get(w.t) || 0) + 1);
          const tone = toneFor(cls, x, y, w.t);
          if (R() < (C.flip || 0.12) && cls === 'small') lineH(w.t, w.fk, h, [o[0] + e1[0] * len + e2[0] * h, o[1] + e1[1] * len + e2[1] * h], ang + Math.PI, sx, h, { tone });
          else lineH(w.t, w.fk, h, o, ang, sx, h, { tone });
          done = true; break;
        }
      }
      if (done) STAT.pocketDone = (STAT.pocketDone || 0) + 1; else STAT.pocketFail = (STAT.pocketFail || 0) + 1;
      if (!done) { const rr = Math.max(1, Math.round(best * 0.7)), bi = bk % GW, bj = Math.floor(bk / GW);
        for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) { const ii = bi + i, jj = bj + j; if (ii >= 0 && jj >= 0 && ii < GW && jj < GH && i * i + j * j <= rr * rr) tried[jj * GW + ii] = 1; } }
    }
  }

  function sweep(ri, reg, rhythm, grain) {
    const ang = (reg.a + (grain && reg.grainTurn ? reg.grainTurn : 0)) * Math.PI / 180, e1 = [Math.cos(ang), Math.sin(ang)], e2 = [-Math.sin(ang), Math.cos(ang)];
    let vmin = 1e9, vmax = -1e9, umin = 1e9, umax = -1e9;
    for (let k = 0; k < label.length; k++) if (label[k] === ri) {
      const x = ((k % GW) + 0.5) * cell, y = (Math.floor(k / GW) + 0.5) * cell, u = x * e1[0] + y * e1[1], v = x * e2[0] + y * e2[1];
      vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); umin = Math.min(umin, u); umax = Math.max(umax, u);
    }
    const pt = (u, vv) => [u * e1[0] + vv * e2[0], u * e1[1] + vv * e2[1]];
    let v = vmin - (grain ? 0 : 4), bi = Math.floor(R() * rhythm.length);
    while (v < vmax) {
      const h = rhythm[bi % rhythm.length] * (0.94 + 0.12 * R()); bi++;
      for (const [u0, u1] of runs(v, h)) fill(u0, u1, v, h);
      v += h + Math.max(1, h * (C.leading ?? 0.05));
    }
    function runs(v0, h) {
      const lines = [v0 + h * 0.15, v0 + h * 0.5, v0 + h * 0.85], out = []; let s = null, own = 0;
      for (let u = umin - 60; u <= umax + 60; u += cell) {
        let ok = true; for (const vv of lines) { const [x, y] = pt(u, vv); if (!free(x, y)) { ok = false; break; } }
        if (ok) { if (s == null) { s = u; own = 0; } const [x, y] = pt(u, v0 + h / 2), k = at(x, y); if (k >= 0 && label[k] === ri) own++; }
        else if (s != null) { if (own * cell >= (u - s) * (grain ? 0.2 : 0.4)) out.push([s, u - cell]); s = null; }
      }
      if (s != null) out.push([s, umax + 60]);
      // a word may run a little past the outline (never into other type): the silhouette gets the words' ends
      const outsideOK = (u) => { for (const vv of lines) { const [x, y] = pt(u, vv), k = at(x, y); if (k >= 0 && (inside[k] || ink[k])) return false; } return true; };
      const over = grain ? 0.12 : (C.overshoot ?? 0.3);
      for (const r of out) {
        let e = 0; while (e < h * over && outsideOK(r[0] - cell)) { r[0] -= cell; e += cell; }
        e = 0; while (e < h * over && outsideOK(r[1] + cell)) { r[1] += cell; e += cell; }
      }
      return out.filter(([a, b]) => b - a >= Math.max(h * (grain ? (C.grainMin ?? 2.4) : 1.15), 9));
    }
    // fill the whole free chord: its ends are the outline (or the type beside it)
    function fill(u0, u1, v, h) {
      const pad = Math.max(0.6, h * 0.04), a = u0 + pad, L = u1 - pad - a;
      const cls = grain ? 'grain' : h >= C.sizes.big ? 'big' : h >= C.sizes.mid ? 'mid' : 'small';
      if (cls === 'small' || cls === 'grain') { put([takeStream(reg.pool, h < (C.lightBelow ?? 11) ? 'sans5' : C.grainFont || 'sans7', h, L)], a, v, h, cls, L); return; }
      // words set at their natural width until the chord is nearly full, then all stretched together to fit it
      const seq = []; let W = 0; const sp = h * 0.22;
      for (let n = 0; n < 6; n++) {
        const rest = L - W - (seq.length ? sp : 0); if (rest < h * 1.2) break;
        const w = pick(reg.pool, cls, h, rest, seq.length === 0); if (!w) break;
        if (w.W0 * C.stretch[0] > rest) break;
        seq.push(w); W += (seq.length > 1 ? sp : 0) + w.W0;
        if (W > L * 0.82) break;
      }
      const rest = L - W - (seq.length ? sp : 0);
      // the remainder of a long band of large type: two half-height lines of running text
      if (seq.length && rest > h * 2.2 && h >= 26) {
        const len = put(seq, a, v, h, cls, Math.min(L - rest + h * 0.1, W * C.stretch[1]));
        const b0 = a + len + sp, g = Math.max(1, h * 0.08), hh = (h - g) / 2, LL = a + L - b0;
        put([takeStream(reg.pool, C.halfFont || 'sans7', hh, LL)], b0, v, hh, 'small', LL); put([takeStream(reg.pool, C.halfFont || 'sans7', hh, LL)], b0, v + hh + g, hh, 'small', LL);
        return;
      }
      if (!seq.length) {
        const g = Math.max(1, h * 0.08), hh = (h - g) / 2;
        if (hh >= 8) { put([takeStream(reg.pool, C.halfFont || 'sans7', hh, L)], a, v, hh, 'small', L); put([takeStream(reg.pool, C.halfFont || 'sans7', hh, L)], a, v + hh + g, hh, 'small', L); }
        return;
      }
      put(seq, a, v, h, cls, L);
    }
    // sets a sequence of words in one band, stretched as one to length L (within the allowed stretch); returns length
    function put(seq, a, v, h, cls, L) {
      seq = seq.filter(Boolean); if (!seq.length) return 0;
      const sp = seq.length > 1 ? h * 0.22 : 0, W0 = seq.reduce((s, w) => s + w.W0, 0) + sp * (seq.length - 1);
      const lim = cls === 'small' || cls === 'grain' ? [0.72, 1.45] : C.stretch;
      const sx = Math.min(lim[1], Math.max(lim[0], L / W0));
      let x = a;
      for (const w of seq) {
        used.set(w.t, (used.get(w.t) || 0) + 1);
        const len = w.W0 * sx, o = pt(x, v);
        const mid = [o[0] + e1[0] * len / 2 + e2[0] * h / 2, o[1] + e1[1] * len / 2 + e2[1] * h / 2];
        const tone = toneFor(cls, mid[0], mid[1], w.t);
        if (reg.v && !latin(w.t) && cls !== 'grain' && cls !== 'small') {        // vertical writing, upright
          const n = [...w.t].length, size = Math.min(h, len / n); lineV(w.t, w.fk, size, o, ang, { tone });
        } else if ((cls === 'small' || cls === 'grain') && R() < (C.flip || 0.12)) {    // some lines upside down
          lineH(w.t, w.fk, h, pt(x + len, v + h), ang + Math.PI, sx, h, { tone });
        } else lineH(w.t, w.fk, h, o, ang, sx, h, { tone });
        x += len + sp * sx;
      }
      return x - sp * sx - a;
    }
  }
  function pick(pool, cls, h, L, first) {
    const s = sections[pool], lists = cls === 'big' ? [s.mid, s.kana] : [s.mid, s.kana];
    let best = null;
    for (const list of lists) for (const t of list) {
      const fk = fontFor(t, cls, h), W0 = width(t, fk, h), r = L / W0, u = used.get(t) || 0;
      if (r < C.stretch[0]) continue;
      // prefer a word that fills the chord by itself; otherwise one that leaves room for another
      let score = r <= C.stretch[1] ? Math.abs(Math.log(r)) * 1.2 : 0.9 + Math.abs(Math.log(r / 2.4)) * 0.6;
      score += u * 0.7 + R() * 0.35;
      if (!best || score < best.score) best = { t, fk, W0, r, score };
    }
    return best;
  }
  // typefaces: heavy gothic, light gothic, heavy and medium mincho — chosen per word and band (deterministic)
  function fontFor(t, cls, h) {
    if (latin(t)) return 'lat';
    const mix = (C.fontMix || {})[cls] || [['sans9', 1]], tot = mix.reduce((s, [, w]) => s + w, 0);
    let x = (hash(t + '|' + Math.round(h)) % 1000) / 1000 * tot;
    for (const [fk, w] of mix) { if ((x -= w) < 0) return fk; }
    return mix[0][0];
  }
  let tot = 0, inked = 0; for (let k = 0; k < inside.length; k++) if (inside[k]) { tot++; if (ink[k]) inked++; }
  STAT.coverage = +(inked / tot).toFixed(3);
  if (C.debug) { let m = ''; for (let j = 0; j < GH; j += 2) { for (let i = 0; i < GW; i += 2) { const k = j * GW + i; m += !inside[k] ? '.' : blocked[k] ? 'v' : ink[k] ? '#' : ' '; } m += '\n'; } STAT.map = m; }
  return { version: 2, seed: C.seed, items, stat: STAT };
}

// ---------------------------------------------------------------- helpers
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fillPoly(grid, W, H, pts, val) {
  let y0 = Infinity, y1 = -Infinity; for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let j = Math.max(0, Math.floor(y0)); j <= Math.min(H - 1, Math.ceil(y1)); j++) {
    const yc = j + 0.5, xs = [];
    for (let i = 0, k = pts.length - 1; i < pts.length; k = i++) {
      const [xa, ya] = pts[k], [xb, yb] = pts[i];
      if ((ya > yc) !== (yb > yc)) xs.push(xa + (yc - ya) / (yb - ya) * (xb - xa));
    }
    xs.sort((p, q) => p - q);
    for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.ceil(xs[n] - 0.5)); i <= Math.min(W - 1, Math.floor(xs[n + 1] - 0.5)); i++) grid[j * W + i] = val;
  }
}
function distPoly(x, y, poly) {
  let best = 1e9;
  for (let i = 0; i + 1 < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
function dilateInto(g, W, H, r) {
  const src = g.slice();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (src[j * W + i]) continue;
    outer: for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      if (src[jj * W + ii] && di * di + dj * dj <= r * r) { g[j * W + i] = 1; break outer; }
    }
  }
}
function signedArea(P) { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1]; return a / 2; }
function resample(P, step) {
  const out = []; const Q = [...P, P[0]];
  for (let i = 0; i + 1 < Q.length; i++) {
    const [ax, ay] = Q[i], [bx, by] = Q[i + 1], l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(l / step));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}
