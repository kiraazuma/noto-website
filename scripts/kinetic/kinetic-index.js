// KINETIC INDEX (index.html INDEX_MODE = 'kinetic', ?index=kinetic) — 2D only.
//
// The INDEX is one sheet of very large type, and every piece of it is one element that is never duplicated: the five
// INDEX words (buttons), the event name in parts (出張輪島 / 朝市 / in 一橋祭), the dates, the small facts. The script
// computes, for each state of the sheet, where each piece is and how large it is (a "layout"), and moves the same
// elements from one layout to the next (transform only; the font size is reset at rest so the type stays sharp).
//
//   E0  before: everything outside the screen, larger than it will be
//   E1  the Hero's scale: 能登 cut by the top edge (where NOTO was), the event name as one line running through the
//       middle, cut at both sides, the dates cut by the bottom edge
//   I   the INDEX: 能登 and 朝市 at the two corners (top left / bottom right, as NOTO / HITOTSUBASHI), 催し 応援 案内
//       as one line between them, the event name and dates as a block top right, the facts bottom left.
//       The line through the middle breaks: 出張輪島 goes up to the block, its 朝市 goes down and becomes the INDEX word.
//   D   an item open: the chosen word becomes the page's heading (it travels there), the other four leave the
//       screen away from it, the event and the dates fold into one running line under it, the item reads beside it.
//
// E0 -> E1 -> I is scrubbed by the scroll that ends the statements (main.js passes the progress; reversible, short).
// I <-> D is a timed transition (click / Enter; back: the heading, empty space, INDEX, Esc).
// One loop: main.js calls frame(dt) from its own requestAnimationFrame loop.

const PHONE = matchMedia('(max-width:1023px) and (orientation:portrait)');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => clamp(x, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 24; i++) { const v = X(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return Y(t);
  };
}
// the house curve (no overshoot) for arrivals; a firm in-out for scrubbed travel and for moves that start at rest;
// an accelerating curve for exits
const EASE = { out: bezier(0.22, 1, 0.36, 1), io: bezier(0.7, 0, 0.2, 1), scrub: bezier(0.6, 0, 0.25, 1), in: bezier(0.55, 0, 0.9, 0.4) };

const WORDS = ['asaichi', 'program', 'noto', 'support', 'info'];
const MID = ['program', 'support', 'info'];                  // the INDEX line between the two corner words

// scrubbed tracks: for each piece, [from, to] windows of the entrance progress for E0 -> E1 and E1 -> I
// (re-timed for the longer scroll, KX_LEN 120 vh: the opening third brings the Hero-scale wall in while the page's
// ground closes, the middle third breaks it and moves the pieces, the last third settles the INDEX line by line)
const TRACK = {
  noto: [[0.00, 0.34], [0.40, 0.84]],
  name1: [[0.03, 0.38], [0.44, 0.82]],
  asaichi: [[0.03, 0.38], [0.46, 0.90]],
  date: [[0.08, 0.42], [0.48, 0.92]],
  program: [null, [0.56, 0.88]],
  support: [null, [0.62, 0.92]],
  info: [null, [0.68, 0.96]],
  name2: [null, [0.72, 0.96]],
  in: [null, [0.76, 0.98]],
  facts: [null, [0.80, 1.00]],
};

export async function mountKinetic(root, hooks = {}) {
  const sticky = root.querySelector('.kx-sticky'), detail = root.querySelector('.kx-detail'), bodyEl = root.querySelector('.kx-body');
  const backBtn = root.querySelector('.kx-back');
  const P = {};
  for (const n of root.querySelectorAll('[data-k]')) P[n.dataset.k] = { k: n.dataset.k, n, r: 1, it: 0.07, ib: 0.93, bw: 0, bh: 0, block: n.classList.contains('kx-facts'),
    c: { x: 0, y: 0, s: 100 }, F: 0, moving: false, still: 0, last: '', vis: true };
  const btn = Object.fromEntries(WORDS.map(id => [id, P[id].n]));
  const label0 = Object.fromEntries(WORDS.map(id => [id, btn[id].getAttribute('aria-label')]));

  try { await Promise.all([document.fonts.load('900 100px "Noto Sans JP"', '出張輪島朝市催し能登応援案内一橋祭'), document.fonts.load('900 100px Archivo', '2026.11.21–23in')]); } catch (e) { /* fonts optional */ }
  await document.fonts.ready;

  // ---------------------------------------------------------------- measuring (once per size: widths and ink scale with the size)
  const cv = document.createElement('canvas').getContext('2d');
  let W = 1, H = 1, phone = PHONE.matches, small = 15;
  function measure() {
    W = sticky.clientWidth || innerWidth; H = sticky.clientHeight || innerHeight; phone = PHONE.matches;
    small = phone ? Math.max(11.5, W * 0.03) : clamp(H * 0.0175, 12.5, 18);
    root.style.setProperty('--kx-small', small.toFixed(1) + 'px');
    for (const p of Object.values(P)) {
      const n = p.n, t0 = n.style.transform;
      n.style.transform = 'none';
      if (p.block) { p.bw = n.offsetWidth; p.bh = n.offsetHeight; p.r = 1; n.style.transform = t0; continue; }
      n.style.fontSize = '100px';
      p.r = n.offsetWidth / 100;
      // ink: the glyphs' top / bottom inside the line box (line-height 1), as fractions of the size
      const cs = getComputedStyle(n), st = parseFloat(cs.fontStretch) || 100;
      cv.font = `${cs.fontWeight} 100px ${cs.fontFamily}`; if ('fontStretch' in cv) cv.fontStretch = st < 70 ? 'extra-condensed' : st < 80 ? 'condensed' : 'normal';
      const m = cv.measureText(n.dataset.k === 'date' ? '2026.11.21–23' : '出張輪島朝市催能登応援案内一橋祭');
      const fa = (m.fontBoundingBoxAscent ?? 88) / 100, fd = (m.fontBoundingBoxDescent ?? 12) / 100, base = 0.5 + (fa - fd) / 2;
      p.it = base - (m.actualBoundingBoxAscent ?? 80) / 100; p.ib = base + (m.actualBoundingBoxDescent ?? 8) / 100;
      n.style.fontSize = p.F ? p.F + 'px' : ''; n.style.transform = t0;
    }
    L = layouts();
  }

  // ---------------------------------------------------------------- layouts. Each returns { piece: { x, y, s } } in px of the
  // sticky frame (x, y = the top left of the element's box, s = its font size; blocks keep s = 1)
  // helpers: place a piece by its ink (top / bottom) and its edges (left / right)
  const at = (k, s, o) => {
    const p = P[k], w = p.block ? p.bw : p.r * s, h = p.block ? p.bh : s;
    let x = o.x ?? 0, y = o.y ?? 0;
    if (o.right != null) x = o.right - w;
    if (o.cx != null) x = o.cx - w / 2;
    if (o.inkTop != null) y = p.block ? o.inkTop : o.inkTop - p.it * s;
    if (o.inkBot != null) y = p.block ? o.inkBot - h : o.inkBot - p.ib * s;
    if (o.inkMid != null) y = o.inkMid - (p.it + p.ib) / 2 * s;
    return { x, y, s: p.block ? 1 : s };
  };
  const ink = (k, l) => ({ top: l.y + P[k].it * l.s, bot: l.y + P[k].ib * l.s, left: l.x, right: l.x + (P[k].block ? P[k].bw : P[k].r * l.s) });
  let L = null;
  function layouts() {
    const m = phone ? Math.max(16, W * 0.052) : clamp(W * 0.034, 20, 64);
    const I = {}, E1 = {}, E0 = {};
    if (!phone) {
      // ---- I: the INDEX
      const G = Math.min(0.48 * H, 0.29 * W);
      I.noto = at('noto', G, { x: -0.05 * G, inkTop: -0.1 * G });
      I.asaichi = at('asaichi', G, { right: W + 0.03 * G, inkBot: H + 0.07 * G });
      const nb = ink('noto', I.noto).bot, at0 = ink('asaichi', I.asaichi).top;
      const M = Math.min(0.15 * H, 0.092 * W, (at0 - nb) * 0.6), yc = (nb + at0) / 2;
      I.program = at('program', M, { x: m, inkMid: yc });
      I.support = at('support', M, { cx: W / 2 + 0.02 * W, inkMid: yc });
      I.info = at('info', M, { right: W - m, inkMid: yc });
      // the event block, top right (right-aligned), as large as the space beside 能登 allows
      const xL = ink('noto', I.noto).right + 0.045 * W, xR = W - m, A = xR - xL;
      const rowTop = yc - (P.program.ib - P.program.it) / 2 * M;
      let N = Math.min(0.1 * H, A / (P.name1.r + P.name2.r));
      for (let i = 0; i < 2; i++) {
        const Dd = Math.min(1.05 * N, A / P.date.r);
        const hgt = (P.name1.ib - P.name1.it) * N + 0.22 * N + (P.in.ib - P.in.it) * 0.6 * N + 0.3 * N + (P.date.ib - P.date.it) * Dd;
        const room = rowTop - 0.05 * H - m;
        if (hgt > room) N *= room / hgt; else break;
      }
      const D = Math.min(1.05 * N, A / P.date.r);
      const nameW = (P.name1.r + P.name2.r) * N;
      I.name1 = at('name1', N, { x: xR - nameW, inkTop: m });
      I.name2 = at('name2', N, { x: xR - P.name2.r * N, inkTop: m });
      const nBot = ink('name1', I.name1).bot;
      I.in = at('in', 0.6 * N, { right: xR, inkTop: nBot + 0.22 * N });
      I.date = at('date', D, { right: xR, inkTop: ink('in', I.in).bot + 0.3 * N });
      I.facts = at('facts', 1, { x: m, inkBot: H - m * 0.9 });

      // ---- E1: the Hero's scale
      const G1 = 1.32 * G;
      E1.noto = at('noto', G1, { x: -0.07 * G1, inkTop: -0.24 * G1 });
      const Lf = 0.4 * H, lineW = (P.name1.r + P.asaichi.r) * Lf, lx = W - lineW + 0.24 * Lf;
      const lineTop = ink('noto', E1.noto).bot + 0.03 * H;
      E1.name1 = at('name1', Lf, { x: lx, inkTop: lineTop });
      E1.asaichi = at('asaichi', Lf, { x: lx + P.name1.r * Lf, inkTop: lineTop });
      const D1 = Math.min(0.27 * H, 1.02 * W / P.date.r);
      E1.date = at('date', D1, { x: -0.02 * D1, inkBot: H + 0.12 * D1 });
      MID.forEach((k, i) => { const s = 1.5 * M; E1[k] = at(k, s, { x: W + 0.04 * W + i * 0.18 * W, inkMid: yc }); });
      E1.name2 = { ...I.name2, x: W + 0.06 * W }; E1.in = { ...I.in, x: W + 0.12 * W };
      E1.facts = { ...I.facts, y: H + 0.04 * H };

      // ---- E0: outside the screen
      E0.noto = at('noto', 1.5 * G, { x: -0.07 * 1.5 * G, inkBot: -0.02 * H });
      E0.name1 = { ...E1.name1, x: W + 0.06 * W };
      E0.asaichi = { ...E1.asaichi, x: W + 0.06 * W + P.name1.r * Lf };
      E0.date = { ...E1.date, x: -P.date.r * D1 - 0.06 * W };
    } else {
      // ---- phone. I: 能登 top left, 朝市 bottom right (both cut by the edges); between them two columns: 催し 応援 案内
      // stacked on the left, the event block and the facts on the right
      const G = Math.min(0.5 * W, 0.3 * H);
      I.noto = at('noto', G, { x: -0.05 * G, inkTop: -0.1 * G });
      I.asaichi = at('asaichi', G, { right: W + 0.03 * G, inkBot: H + 0.06 * G });
      const nb = ink('noto', I.noto).bot, at0 = ink('asaichi', I.asaichi).top;
      const M = Math.min(0.2 * W, (at0 - nb - 0.08 * H) / 3.5), gap = 0.2 * M, ih = (P.program.ib - P.program.it) * M;
      const blockH = 3 * ih + 2 * gap, top = (nb + at0) / 2 - blockH / 2;
      MID.forEach((k, i) => { I[k] = at(k, M, { x: m, inkTop: top + i * (ih + gap) }); });
      const xL = m + P.program.r * M + 0.07 * W, A = W - m - xL;
      const N = Math.min(0.09 * W, A / (P.name1.r + P.name2.r));
      I.name1 = at('name1', N, { x: xL, inkTop: top });
      I.name2 = at('name2', N, { x: xL + P.name1.r * N, inkTop: top });
      I.in = at('in', 0.62 * N, { x: xL, inkTop: ink('name1', I.name1).bot + 0.28 * N });
      I.date = at('date', Math.min(1.1 * N, A / P.date.r), { x: xL, inkTop: ink('in', I.in).bot + 0.3 * N });
      I.facts = at('facts', 1, { x: xL, inkTop: Math.max(ink('date', I.date).bot + 0.7 * N, top + blockH - P.facts.bh) });
      // the right column may run longer than the words: lift the whole band so it clears 朝市
      const over = I.facts.y + P.facts.bh - (at0 - 0.03 * H);
      if (over > 0) { const up = Math.min(over, Math.max(0, top - nb - 0.03 * H)); for (const k of [...MID, 'name1', 'name2', 'in', 'date', 'facts']) I[k] = { ...I[k], y: I[k].y - up }; }
      // E1
      const G1 = 1.3 * G;
      E1.noto = at('noto', G1, { x: -0.07 * G1, inkTop: -0.2 * G1 });
      const Lf = 0.36 * W, lineW = (P.name1.r + P.asaichi.r) * Lf, lx = W - lineW + 0.3 * Lf;
      const lineTop = ink('noto', E1.noto).bot + 0.06 * H;
      E1.name1 = at('name1', Lf, { x: lx, inkTop: lineTop });
      E1.asaichi = at('asaichi', Lf, { x: lx + P.name1.r * Lf, inkTop: lineTop });
      const D1 = 1.22 * W / P.date.r;
      E1.date = at('date', D1, { x: -0.02 * D1, inkBot: H + 0.1 * D1 });
      MID.forEach((k, i) => { E1[k] = at(k, 1.4 * M, { x: W + 0.05 * W + i * 0.3 * W, inkTop: I[k].y + P[k].it * M }); });
      E1.name2 = { ...I.name2, x: W + 0.1 * W }; E1.in = { ...I.in, x: W + 0.2 * W };
      E1.facts = { ...I.facts, y: H + 0.04 * H };
      E0.noto = at('noto', 1.5 * G, { x: -0.07 * 1.5 * G, inkBot: -0.02 * H });
      E0.name1 = { ...E1.name1, x: W + 0.08 * W };
      E0.asaichi = { ...E1.asaichi, x: W + 0.08 * W + P.name1.r * Lf };
      E0.date = { ...E1.date, x: -P.date.r * D1 - 0.08 * W };
    }
    for (const k in P) { if (!E1[k]) E1[k] = I[k]; if (!E0[k]) E0[k] = E1[k]; }
    return { I, E1, E0, m };
  }

  // the detail layout for one word (computed when it opens, and on resize while open)
  function detailLayout(id) {
    const D = {}, I = L.I, m = L.m, S = P[id];
    let cx, cy;
    if (!phone) {
      const Hd = Math.min(0.4 * H, 0.4 * W / S.r);
      D[id] = at(id, Hd, { x: m * 0.7, inkTop: 0.085 * H });
      const head = ink(id, D[id]);
      cx = Math.max(0.46 * W, head.right + 0.05 * W); cy = head.top;
      // the event and the dates: one running line at the foot of the heading's column
      const R = clamp(0.024 * H, 14, 26), y0 = H - m;
      let x = m;
      D.name1 = at('name1', R, { x, inkBot: y0 }); x += P.name1.r * R;
      D.name2 = at('name2', R, { x, inkBot: y0 }); x += P.name2.r * R + 0.3 * R;
      D.in = at('in', R, { x, inkBot: y0 }); x += P.in.r * R + 0.7 * R;
      D.date = at('date', 1.12 * R, { x, inkBot: y0 });
    } else {
      const Hd = Math.min(0.42 * W, 0.17 * H, (W - 2 * m) / S.r);
      D[id] = at(id, Hd, { x: m * 0.8, inkTop: m + 6 });
      const head = ink(id, D[id]), R = 13.5, y0 = head.bot + 16;
      let x = m;
      D.name1 = at('name1', R, { x, inkTop: y0 }); x += P.name1.r * R;
      D.name2 = at('name2', R, { x, inkTop: y0 }); x += P.name2.r * R + 0.3 * R;
      D.in = at('in', R, { x, inkTop: y0 }); x += P.in.r * R + 0.7 * R;
      D.date = at('date', 1.12 * R, { x, inkTop: y0 - 0.02 * R });
      cx = m; cy = ink('name1', D.name1).bot + 30;
    }
    // the other words leave the screen, each straight away from the chosen one (from where they are in the INDEX)
    const c0 = center(id, I[id]);
    for (const k of WORDS) {
      if (k === id) continue;
      const c = center(k, I[k]); let dx = c.x - c0.x, dy = c.y - c0.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const far = Math.hypot(W, H) * 0.95;
      D[k] = { x: I[k].x + dx * far, y: I[k].y + dy * far, s: I[k].s };
    }
    D.facts = { ...I.facts, y: H + 0.05 * H };
    return { D, cx, cy };
  }
  const center = (k, l) => { const p = P[k]; return { x: l.x + (p.block ? p.bw : p.r * l.s) / 2, y: l.y + (p.block ? p.bh : l.s) / 2 }; };

  // ---------------------------------------------------------------- the scrubbed entrance
  function scrubbed(k, p) {
    const T = TRACK[k], a = L.E0[k], b = L.E1[k], c = L.I[k];
    if (REDUCED) return p > 0 ? c : a;
    let v = a;
    if (T[0]) { const e = EASE.scrub(clamp01((p - T[0][0]) / (T[0][1] - T[0][0]))); v = mix(a, b, e); } else v = b;
    if (p > T[1][0]) { const e = EASE.scrub(clamp01((p - T[1][0]) / (T[1][1] - T[1][0]))); v = mix(v, c, e); }
    return v;
  }
  const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) });
  const trackMax = (k) => Math.max(L.E0[k].s, L.E1[k].s, L.I[k].s);

  // ---------------------------------------------------------------- timed transitions (open / close)
  const tw = {};                 // piece -> { from, to, t, dur, delay, ease }
  // timers on the same clock as the motion (frame dt), so content and type always keep their timing
  const timers = [];
  const later = (sec, fn) => { if (sec <= 0) fn(); else timers.push({ t: sec, fn }); };
  // the content's arrival (0 -> 1), on the same clock: it rises a little into place as it appears
  const rv = { v: 0, to: 0, dur: 0.6 };
  function tickReveal(dt) {
    if (rv.v === rv.to) return false;
    const k = REDUCED ? 1 : dt / rv.dur; rv.v = rv.to > rv.v ? Math.min(rv.to, rv.v + k) : Math.max(rv.to, rv.v - k * 2.2);
    const e = EASE.out(rv.v);
    detail.style.opacity = e.toFixed(3); detail.style.transform = rv.v >= 1 ? 'none' : `translate3d(0,${((1 - e) * Math.min(40, H * 0.04)).toFixed(1)}px,0)`;
    return true;
  }
  function tickTimers(dt) { for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } } }
  let state = 'index', current = null, busy = null, dLay = null;
  function go(k, to, dur, delay, ease) {
    const p = P[k];
    if (REDUCED || dur <= 0) { delete tw[k]; p.c = { ...to }; return; }
    tw[k] = { from: { ...p.c }, to, t: -delay, dur, ease };
  }
  function tickTweens(dt) {
    let any = false;
    for (const k in tw) {
      const T = tw[k]; T.t += dt; any = true;
      const e = T.ease(clamp01(T.t / T.dur));
      P[k].c = T.t <= 0 ? P[k].c : mix(T.from, T.to, e);
      if (T.t >= T.dur) { P[k].c = { ...T.to }; delete tw[k]; }
    }
    return any;
  }

  function mountItem(id) {
    const item = document.getElementById(id); if (!item) return;
    const ph = document.createComment('kx:' + id); item.before(ph); bodyEl.append(item); mounted = { item, ph };
    const num = item.querySelector('.row .num'), en = item.querySelector('.row .en');
    detail.querySelector('.kx-num').textContent = num ? num.textContent : '';
    detail.querySelector('.kx-en').textContent = en ? en.textContent : '';
    detail.setAttribute('aria-label', btn[id].dataset.label);
  }
  let mounted = null;
  function unmountItem() { if (mounted) { mounted.ph.replaceWith(mounted.item); mounted = null; } }
  const sectionTop = () => root.getBoundingClientRect().top + scrollY;
  function toSection(cb) {
    const y = Math.round(sectionTop());
    if (Math.abs(scrollY - y) < 2) { cb(); return; }
    if (hooks.scrollTo) hooks.scrollTo(y, cb); else { scrollTo({ top: y, behavior: 'instant' }); cb(); }
  }

  function open(id, opts = {}) {
    if (!btn[id]) return Promise.resolve();
    if (busy) return busy.then(() => open(id, opts));
    if (current === id) return Promise.resolve();
    if (current) return close({ quick: true }).then(() => open(id, opts));
    // still entering: finish the entrance first (the scroll runs on to the INDEX), then open
    if ((hooks.progress?.() ?? 1) < 1) return new Promise(res => hooks.finishIntro(() => res(open(id, opts))));
    const instant = !!opts.instant || REDUCED;
    busy = new Promise((resolve) => {
      const run = () => {
        current = id; state = 'detail'; mountItem(id);
        const { D, cx, cy } = (dLay = detailLayout(id));
        root.style.setProperty('--kx-cx', cx.toFixed(1) + 'px'); root.style.setProperty('--kx-cy', cy.toFixed(1) + 'px');
        root.classList.add('kx-open'); detail.hidden = false;
        for (const k of WORDS) {
          btn[k].setAttribute('aria-expanded', k === id ? 'true' : 'false');
          btn[k].tabIndex = k === id ? 0 : -1; if (k !== id) btn[k].setAttribute('aria-hidden', 'true');
        }
        btn[id].setAttribute('aria-label', `${btn[id].dataset.label}を閉じて INDEX に戻る`);
        // the others go first (accelerating out, the nearest first); the chosen word travels to the heading as they
        // clear; the event folds into its running line; the content comes up into the space they left
        const c0 = center(id, L.I[id]);
        const order = WORDS.filter(k => k !== id).sort((a, b) => dist(a, c0) - dist(b, c0));
        const T0 = instant ? 0 : 1;
        order.forEach((k, i) => go(k, D[k], 0.62 * T0, 0.03 * i * T0, EASE.in));
        go('facts', D.facts, 0.5 * T0, 0, EASE.in);
        go(id, D[id], 0.95 * T0, 0.08 * T0, EASE.io);
        ['name1', 'name2', 'in', 'date'].forEach((k, i) => go(k, D[k], 0.85 * T0, (0.12 + 0.03 * i) * T0, EASE.io));
        const total = instant ? 0 : 1.03;
        later(instant ? 0 : 0.6, () => { detail.classList.add('kx-show'); rv.to = 1; if (instant) rv.v = 0.999; hooks.onChange?.(id); });
        later(total, () => { busy = null; resolve(); });
      };
      if (opts.noScroll) run(); else toSection(run);
    });
    return busy;
  }
  const dist = (k, c) => { const q = center(k, L.I[k]); return Math.hypot(q.x - c.x, q.y - c.y); };

  function close(opts = {}) {
    if (busy) return busy.then(() => close(opts));
    if (!current) return Promise.resolve();
    const id = current, instant = !!opts.instant || REDUCED, quick = !!opts.quick;
    busy = new Promise((resolve) => {
      detail.classList.remove('kx-show'); rv.to = 0; if (instant) rv.v = 0.001;
      toSection(() => {});
      later(instant ? 0 : 0.23, () => {
        detail.hidden = true; unmountItem(); current = null; dLay = null;
        root.classList.remove('kx-open');
        for (const k of WORDS) { btn[k].setAttribute('aria-expanded', 'false'); btn[k].tabIndex = 0; btn[k].removeAttribute('aria-hidden'); }
        btn[id].setAttribute('aria-label', label0[id]);
        hooks.onChange?.(null);
        // the reverse: the heading goes back to its place, the others come back in from where they left (decelerating),
        // the event block unfolds, the facts come up last
        const T0 = instant ? 0 : quick ? 0.6 : 1, I = L.I;
        go(id, I[id], 0.85 * T0, 0, EASE.io);
        const c0 = center(id, I[id]);
        WORDS.filter(k => k !== id).sort((a, b) => dist(b, c0) - dist(a, c0)).forEach((k, i) => go(k, I[k], 0.78 * T0, (0.16 + 0.04 * i) * T0, EASE.out));
        ['name1', 'name2', 'in', 'date'].forEach((k, i) => go(k, I[k], 0.8 * T0, (0.05 + 0.03 * i) * T0, EASE.io));
        go('facts', I.facts, 0.6 * T0, 0.4 * T0, EASE.out);
        state = 'index';
        if (root.contains(document.activeElement) || document.activeElement === document.body) btn[id].focus({ preventScroll: true });
        later(instant ? 0 : 1.05 * T0, () => { busy = null; resolve(); });
      });
    });
    return busy;
  }

  // ---------------------------------------------------------------- input
  for (const id of WORDS) btn[id].addEventListener('click', (e) => { e.preventDefault(); if (current === id) close(); else open(id); });
  backBtn.addEventListener('click', () => close());
  // while an item is open, empty space goes back (not the content, not its links)
  sticky.addEventListener('click', (e) => { if (current && !busy && !e.target.closest('button, a')) close(); });
  detail.addEventListener('click', (e) => { if (current && !busy && !e.target.closest('.kx-dhead, .kx-body, button, a')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.preventDefault(); close(); } });

  // ---------------------------------------------------------------- render (called from main.js's loop)
  let lastP = -1, dirty = true;
  function frame(dt) {
    const p = hooks.progress ? hooks.progress() : 1;
    if (p !== lastP) { lastP = p; dirty = true; }
    tickTimers(dt); tickReveal(dt);
    const tweening = tickTweens(dt);
    if (!dirty && !tweening && !anyMoving) return;
    dirty = false;
    // the entrance (only while nothing is open and nothing is in a timed move)
    if (state === 'index' && !current && !busy) for (const k in P) if (!tw[k]) P[k].c = p >= 1 ? { ...L.I[k] } : scrubbed(k, p);
    render(dt, p);
  }
  let anyMoving = false;
  function render(dt, p) {
    anyMoving = false;
    for (const k in P) {
      const q = P[k], c = q.c;
      const key = `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.s.toFixed(2)}`;
      const changed = key !== q.last; q.last = key;
      if (changed) { q.still = 0; if (!q.moving) { q.moving = true; q.n.classList.add('kx-moving'); } }
      else q.still += dt;
      // at rest (0.18 s still): the true font size, no scale (sharp type). Moving: a base size at least as large as
      // anything on the way, scaled down (never up)
      let F;
      if (q.block) { F = 0; if (q.moving && q.still > 0.18) { q.moving = false; q.n.classList.remove('kx-moving'); } }
      else if (q.moving && q.still > 0.18) { q.moving = false; q.n.classList.remove('kx-moving'); F = c.s; }
      else if (q.moving) F = Math.max(q.F || 0, c.s, tw[k] ? Math.max(tw[k].from.s, tw[k].to.s) : (state === 'index' && p < 1 ? trackMax(k) : c.s));
      else F = q.F || c.s;
      if (!q.block && Math.abs(F - (q.F || 0)) > 0.01) { q.F = F; q.n.style.fontSize = F.toFixed(2) + 'px'; }
      const sc = q.block ? 1 : c.s / q.F;
      const tf = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0)` + (Math.abs(sc - 1) > 1e-4 ? ` scale(${sc.toFixed(5)})` : '');
      if (tf !== q.tf) { q.tf = tf; q.n.style.transform = tf; }
      // completely outside the frame and at rest: hidden (no huge layer, no focus)
      const w = q.block ? q.bw : q.r * c.s, h = q.block ? q.bh : c.s;
      const out = c.x > W + 2 || c.x + w < -2 || c.y > H + 2 || c.y + h < -2;
      const vis = !(out && !q.moving);
      if (vis !== q.vis) { q.vis = vis; q.n.style.visibility = vis ? '' : 'hidden'; }
      if (q.moving) anyMoving = true;
    }
  }

  // ---------------------------------------------------------------- size
  function onResize() {
    measure();
    if (current) { dLay = detailLayout(current); for (const k in P) if (!tw[k]) P[k].c = { ...dLay.D[k] ?? L.I[k] }; root.style.setProperty('--kx-cx', dLay.cx.toFixed(1) + 'px'); root.style.setProperty('--kx-cy', dLay.cy.toFixed(1) + 'px'); }
    dirty = true; lastP = -1;
  }
  measure();
  for (const k in P) P[k].c = { ...L.E0[k] };
  let rzT = 0; new ResizeObserver(() => { clearTimeout(rzT); rzT = setTimeout(onResize, 60); }).observe(sticky);
  root.classList.add('kx-ready');
  frame(0);

  return {
    open, close, frame,
    // the INDEX finished and still (no entrance, no open / close, nothing open): when a hover may play its one-shot
    rest: () => state === 'index' && !current && !busy && lastP >= 1 && !anyMoving && !Object.keys(tw).length && detail.hidden,
    get current() { return current; },
    debug: () => ({ W, H, phone, state, current, busy: !!busy, anyMoving, moving: Object.keys(P).filter(k => P[k].moving).map(k => k + ':' + P[k].still.toFixed(2) + ':' + P[k].last), tw: Object.keys(tw), dh: detail.hidden, p: lastP, L: L && Object.fromEntries(Object.entries(L.I).map(([k, v]) => [k, [Math.round(v.x), Math.round(v.y), Math.round(v.s)]])) }),
  };
}
