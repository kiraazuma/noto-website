// After the hero, the page is quiet. Motion budget, in order: the opening, the liquid hero, hero -> statements,
// statements -> summary, the INDEX accordion and its colour change. Nothing on the page follows the pointer or scroll.
// One motion language: cubic-bezier(.22, 1, .36, 1) (no bounce, no overshoot), transform / opacity first.
// One scroll source: the browser's native scroll. The intro locks it; programmatic moves use one damped tween.
import { hero, ctl } from './hero.js';
import { field, bindField, setPointer } from './field.js';
import { initCursor } from './cursor.js';

const clamp01 = x => Math.max(0, Math.min(1, x));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
// cubic-bezier(x1, y1, x2, y2) as a function of progress (Newton + bisection on x)
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
const E = bezier(0.22, 1, 0.36, 1);                 // the house curve
const ES = bezier(0.65, 0, 0.35, 1);                // its symmetric partner, only for colour / ground cross-fades
const SINE = x => 0.5 - 0.5 * Math.cos(Math.PI * x);   // the statements' fades: gentle at both ends, no steep middle
const seg = (t, a, d) => clamp01((t - a) / d);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
// the cursor (an orange dot) and the circular hover, site-wide (scripts/cursor.js; index.html CUR_MODE / ?cursor=)
window.__cur = initCursor();
const MANUAL = hero.MANUAL, REDUCED = hero.REDUCED;
const root = document.documentElement;

/* ---------------------------------------------------------------- units: --p = one px of the 1600 x 900 frame */
let P = 1, VW = 0, VH = 0;
// The layout units live in CSS (--p / --t / --vh) and CSS is the source of truth: JS reads --p back from a probe
// (1000 * --p wide) instead of re-deriving it, and takes the viewport from the fixed, full-viewport stage box.
const unitProbe = document.createElement('div');
unitProbe.style.cssText = 'position:absolute;left:0;top:0;width:calc(1000 * var(--p));height:0;visibility:hidden;pointer-events:none';
document.body.append(unitProbe);
const stageBox = document.getElementById('stage');
function measure() {
  VW = stageBox.clientWidth || innerWidth; VH = stageBox.clientHeight || innerHeight;
  P = (unitProbe.offsetWidth / 1000) || Math.max(0.6, Math.min(1.3, VW / 1600, VH / 900));
}
measure();
// resize: once, after it settles. An accordion move in progress is completed (its measurements would be stale);
// the open row's height is CSS (auto), so nothing else needs measuring.
// the same source as the hero: a ResizeObserver on the stage (= the visible pane: window, iframe or artifact pane)
let rz; function onResize() { measure(); clearTimeout(rz); rz = setTimeout(() => { measure(); if (A) { A.t = A.T; updateAcc(0); } fitEnd(); diagUpdate(); }, 140); }
if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(stageBox); else addEventListener('resize', onResize, { passive: true });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

/* ---------------------------------------------------------------- intro: hero -> statements -> EVENT SUMMARY
   Scroll-driven and pinned: the viewport stays put while the scroll distance moves one progress value d (in vh of
   scroll) through the sequence. Scrolling and the automatic advance drive the SAME target (dT); the scene is always a
   pure function of the rendered value d, which follows dT.
     wheel / touch / key delta  ─┐
     auto-advance (idle)        ─┴─> target dT (clamped per gesture) -> d (damped + speed-limited) -> visual state
   Distance map (vh of scroll; desktop / phone):
     0 - 50          hero -> atmosphere: the hero type thins, the veil comes in, the sculpture defocuses and recedes
     each statement  fade in 16 / 13 | FULLY VISIBLE 22 / 25 | fade out 18 / 16   (56 / 54 vh), 4 vh apart
                     (all three: 176 / 170 vh; before 2026-10-12: 356 / 335)
     after the last  kinetic INDEX: the veil thins to ivory and the ground closes while the giant type comes in, then
                     the INDEX builds itself (KX_LEN = 120 vh, was 68). In all ~350 / ~344 vh.
                     glass / classic INDEX: the sculpture alone, the veil thins to ivory, the ground closes, the summary
                     comes into focus (84 vh). In all ~310 / ~304 vh.
   One gesture (wheel / trackpad events less than 260 ms apart, momentum included) can only travel to the next
   resting point — the middle of the next statement's hold, or the end — so a strong flick never skips a statement.
   Left alone inside the statements for AUTO.idle s, the sequence advances by itself to the next resting point at
   AUTO.speed; any input takes over at once from wherever it is. Never with prefers-reduced-motion. */
const stage = $('#stage'), veil = $('#veil'), page = $('#page'), replay = $('#replay'), indexEl = $('#index'), stmt = $('#statement'), summary = $('#summary');
let locked = true;                 // opening, accordion motion
let mode = 'hero';                 // hero | intro | main
let d = 0, dT = 0;                 // rendered / target progress (vh of scroll)
for (const l of $$('#statement .l')) l.innerHTML = l.innerHTML.replace(/([、。])(?=([\s\S])?)/g, (m, c, nx) => `<span class="pp${nx ? '' : ' hang'}">${c}</span>`);
const ST = $$('#statement .st').map(el => ({ el, lines: $$('.l', el), last: '' }));
const S_A = 50, S_BLANK = 4, K_IN = S_A / 66;            // K_IN: the hero -> statement transition, scaled with S_A
// fade in | hold | fade out, vh. Phones / portrait tablets keep a slightly longer hold (shorter screen, larger type).
// (halved 2026-10-12: was desk [32, 44, 40] / phone [26, 51, 32] — the text is read in the hold, the rest was waiting)
const SEG = { desk: [16, 22, 18], phone: [13, 25, 16] };
// the kinetic INDEX: how far the scroll that builds it runs (vh; was 68)
const KX_LEN = 120;
const AUTO = { idle: 2.5, speed: 45 };                   // s without input before advancing; vh / s while advancing
const V_MAX = 150, V_FADE = 70;                          // vh / s: the scene's top speed, and its top speed inside a fade
const PHONE = matchMedia('(max-width: 1023px) and (orientation: portrait)');
const STOPS = [];
let D_OBJ, D_IV, IV, D_COV, COV, D_WIN, WIN, D_END, KX_A;
// INDEX display mode (index.html: INDEX_MODE / ?index=): 'glass' = the five glass words, 'classic' = summary + rows
const GLASS = document.documentElement.dataset.index === 'glass';
let GX = null, gxStart = null;
// 'kinetic' = the 2D kinetic typography INDEX (scripts/kinetic/kinetic-index.js): its entrance is scrubbed by the end of
// this sequence (KX_A .. D_END), so nothing of it fades here
const KINETIC = document.documentElement.dataset.index === 'kinetic';
let KX = null, kxStart = null;
const ALT = GLASS || KINETIC;                                   // an INDEX that handles its own items
const sumParts = $$(GLASS ? '#summary .gx .sp' : KINETIC ? '#summary .kx .sp' : '#summary .fr .sp').map((el, k) => ({ el, d: k * 5, k: '' }));
function setTimings() {
  const [fi, fh, fo] = PHONE.matches ? SEG.phone : SEG.desk, L = fi + fh + fo;
  ST.forEach((s, i) => { s.a = S_A + i * (L + S_BLANK); s.inEnd = s.a + fi; s.outStart = s.inEnd + fh; s.outEnd = s.a + L; s._k = null; });
  D_OBJ = ST[ST.length - 1].outEnd;
  if (KINETIC) {
    // no pause after the last statement: as it fades, the veil thins and the page's ground closes over the sculpture
    // while the INDEX's giant type is already coming in; the rest of the scroll is the INDEX building itself
    KX_A = D_OBJ + 2; D_IV = D_OBJ + 2; IV = 24; D_COV = D_OBJ + 6; COV = 26; D_WIN = D_OBJ; WIN = 1;
    D_END = KX_A + KX_LEN;
  } else {
    D_IV = D_OBJ + 12; IV = 30; D_COV = D_IV + 10; COV = 30; D_WIN = D_IV + 28; WIN = 28;
    D_END = D_WIN + 12 + WIN + 4;
    KX_A = D_IV + 4;
  }
  STOPS.length = 0; STOPS.push(0, ...ST.map(s => (s.inEnd + s.outStart) / 2), D_END);
}
setTimings();
PHONE.addEventListener?.('change', () => { const f = D_END ? d / D_END : 0; setTimings(); if (mode === 'intro') d = dT = f * D_END; });
let idleT = 0, autoTo = null, touching = false;
const stopAuto = () => { idleT = 0; autoTo = null; };
document.body.classList.add('intro', 'booted');
bindField((x, y) => { const v = hero.view(); return [(x - v.ox) / v.s, (y - v.oy) / v.s]; });

const openingDone = () => hero.time() > hero.T.end + 0.1;
const nextStop = (x) => STOPS.find(v => v > x + 0.5) ?? D_END;
const prevStop = (x) => [...STOPS].reverse().find(v => v < x - 0.5) ?? 0;
let gesture = null;
// a scroll delta (px) moves the target; within one gesture it may not pass the next resting point
function input(px, fresh = false) {
  if (!openingDone() || locked || !px) return;
  stopAuto();                                                  // the hand always wins over the auto-advance
  if (mode === 'main') {
    if (!(scrollY <= 0 && px < 0)) return;
    if (altCur()) return;                                      // an open item stays open (Esc / back closes it)
    mode = 'intro'; d = dT = D_END; ST_TW = null;              // back up into the sequence from the top of the page
  }
  const dv = px / Math.max(1, VH) * 100, dir = Math.sign(dv), now = performance.now();
  if (fresh || !gesture || now - gesture.last > 260 || dir !== gesture.dir) gesture = { dir, limit: dir > 0 ? nextStop(dT) : prevStop(dT) };
  gesture.last = now;
  dT = dir > 0 ? Math.min(dT + dv, gesture.limit) : Math.max(dT + dv, gesture.limit);
  dT = clamp(dT, 0, D_END);
  if (mode === 'hero' && dT > 0) { mode = 'intro'; replay.classList.remove('on'); }
}
// Input. A non-passive wheel / touchmove listener makes every native scroll wait for the main thread, so it is only
// attached while the sequence (or an accordion move) actually holds the page. In the ordinary page: passive only.
const wheelOf = (e) => e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? VH : 1);
const onWheelHold = (e) => { e.preventDefault(); input(wheelOf(e)); };
let touchY = null;
const onTouchHold = (e) => { e.preventDefault(); const y = e.touches[0].clientY; if (touchY != null) input((touchY - y) * 2.2); touchY = y; };
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; gesture = null; touching = true; stopAuto(); }, { passive: true });
addEventListener('touchend', () => { touchY = null; touching = false; idleT = 0; }, { passive: true });
addEventListener('touchcancel', () => { touchY = null; touching = false; idleT = 0; }, { passive: true });
// the ordinary page (not holding): a pull down at the very top travels back up into the sequence, as the wheel does
addEventListener('touchmove', (e) => { if (holding) return; const y = e.touches[0].clientY; if (touchY != null && scrollY <= 0 && y > touchY) input((touchY - y) * 2.2); touchY = y; }, { passive: true });
addEventListener('wheel', (e) => { ST_TW = null; if (!holding) input(wheelOf(e)); }, { passive: true });
let holding = false;
function syncHold() {
  const h = mode !== 'main' || locked;
  if (h === holding) return; holding = h;
  if (h) { addEventListener('wheel', onWheelHold, { passive: false }); addEventListener('touchmove', onTouchHold, { passive: false }); }
  else { removeEventListener('wheel', onWheelHold, { passive: false }); removeEventListener('touchmove', onTouchHold, { passive: false }); }
}
addEventListener('keydown', (e) => {
  const k = e.key, inSeq = mode !== 'main';
  const step = { ArrowDown: 0.3, PageDown: 0.8, ' ': 0.8, ArrowUp: -0.3, PageUp: -0.8 }[k];
  if (step == null) { if ((k === 'Home' || k === 'End') && (inSeq || locked)) e.preventDefault(); return; }
  if (inSeq || locked || (step < 0 && scrollY <= 0)) { e.preventDefault(); input(step * VH, true); }
});

let wasMain = false, lastStage = '', lastVeil = '', lastPage = '', animOn = null;
function setAnim(on) {               // will-change only while these layers actually move
  if (on === animOn) return; animOn = on;
  stmt.classList.toggle('anim', on); summary.classList.toggle('anim', on); page.classList.toggle('anim', on);
}
function updateIntro(dt) {
  // damping: the scene follows the scroll a little behind it (time constant ~0.14 s), never ahead
  if (mode === 'intro') {
    // (real elapsed time, so a slow frame does not make the scene trail further behind the scroll)
    const ddt = MANUAL ? dt : Math.max(dt, rawDt);
    // auto-advance: only inside the statements, only after AUTO.idle s without input, never under reduced motion.
    // It moves the same target a hand would, so taking over (or handing back) never jumps.
    idleT += dt;
    const inStatements = dT >= ST[0].a && dT < D_END;
    if (!REDUCED && !touching && !A && inStatements && (autoTo != null || idleT >= AUTO.idle)) {
      if (autoTo == null) autoTo = nextStop(dT);
      dT = Math.min(autoTo, dT + AUTO.speed * dt);
      if (dT >= autoTo) { autoTo = null; idleT = 0; }         // arrived: read, then go on
    } else if (!inStatements) autoTo = null;
    // the scene follows the target a little behind it (~0.14 s), and never faster than V_MAX (V_FADE while a statement
    // fades): a hard flick still shows each fade for ~0.4 s, while ordinary scrolling (slower) is followed directly
    const step = REDUCED ? dT - d : (dT - d) * (1 - Math.exp(-ddt * 7));
    const vmax = ST.some(s => (d > s.a - 1 && d < s.inEnd + 1) || (d > s.outStart - 1 && d < s.outEnd + 1)) ? V_FADE : V_MAX;
    d += REDUCED ? step : clamp(step, -vmax * ddt, vmax * ddt);
    if (Math.abs(dT - d) < 0.02) d = dT;
    if (d >= D_END - 0.02 && dT >= D_END) { mode = 'main'; d = dT = D_END; scrollTo({ top: 0, behavior: 'instant' }); if (afterIntro.length) { const q = afterIntro.splice(0); requestAnimationFrame(() => q.forEach(f => f())); } }
    else if (d <= 0.02 && dT <= 0) { mode = 'hero'; d = dT = 0; }
  }
  let typeF, fog, veilO, pageO, texts, ivory = 0, parts = null;
  if (mode === 'hero') { typeF = 0; fog = 0; veilO = 0; pageO = 0; texts = null; }
  else if (mode === 'intro') {
    typeF = E(seg(d, 0, 45 * K_IN));                            // 1  the hero type thins
    fog = E(seg(d, 12 * K_IN, 63 * K_IN));                      // 2  defocus + recede
    ivory = ES(seg(d, D_IV, IV));                               //    (later) the veil thins to warm ivory
    veilO = E(seg(d, 18 * K_IN, 60 * K_IN)) * (1 - ivory);      // 3  the cobalt veil
    pageO = ES(seg(d, D_COV, COV));                             //    the page's ivory ground closes over the sculpture
    parts = sumParts.map(p => E(seg(d, D_WIN + p.d, WIN)));
    // fades: a symmetric ease (no sudden jump to 0 or 1 at either end), so a fade reads as a fade
    texts = ST.map(s => ({ line: SINE(seg(d, s.a, s.inEnd - s.a)), out: SINE(seg(d, s.outStart, s.outEnd - s.outStart)) }));
  } else { typeF = 1; fog = 1; veilO = 0; pageO = 1; texts = null; }
  const main = mode === 'main';
  if (main && wasMain) return;                                     // the page is an ordinary page now: nothing to drive
  wasMain = main;
  setAnim(mode === 'intro');

  // the glass under the blur: 0.5x and half rate once the stage is well defocused (hysteresis, no flicker)
  if (mode !== 'hero' && fog > 0.65) hero.setQuality('low'); else if (fog < 0.5) hero.setQuality('full');

  // the summary's parts come into focus one after another (focus arrives a little before full opacity)
  sumParts.forEach((p, k) => {
    let o = 1, b = 0;
    if (parts) { o = parts[k]; b = (1 - clamp01(o * 1.6)) * 6 * P; }
    const key = main ? '' : o.toFixed(3) + '|' + b.toFixed(1);
    if (p.k !== key) { p.k = key; p.el.style.opacity = main ? '' : o.toFixed(3); p.el.style.filter = !main && b > 0.1 ? `blur(${b.toFixed(1)}px)` : ''; }
  });

  stage.style.visibility = main ? 'hidden' : 'visible';
  ctl.hidden = main;
  // one blur layer: the stage. The sculpture goes back into the space (a little smaller) as it defocuses.
  const sf = fog > 0.002 ? `blur(${(24 * P * fog).toFixed(1)}px) saturate(${(1 + 0.3 * fog * (1 - ivory)).toFixed(3)}) brightness(${(1 - 0.08 * fog * (1 - ivory)).toFixed(3)})` : '';
  const sx = fog > 0.002 ? `scale(${(1 - 0.06 * fog).toFixed(4)})` : '';
  if (sf + sx !== lastStage) { lastStage = sf + sx; stage.style.filter = sf; stage.style.transform = sx; }
  ctl.typeFade = 0.97 * typeF; ctl.calm = 0.82 * fog;            // the sculpture answers at ~18% under the statements
  for (const k of ['noto', 'hito', 'date', 'title']) ctl.exit[k] = 0.03 * typeF;
  const vo = veilO.toFixed(3); if (vo !== lastVeil) { lastVeil = vo; veil.style.opacity = vo; }
  replay.style.visibility = mode === 'hero' ? 'visible' : 'hidden';

  // statements: opacity + a little focus (filter) on their own layers; no letter-spacing / layout changes
  ST.forEach((s, i) => {
    if (texts) {
      const T = texts[i];
      const f = clamp01(T.line * 1.6), b = (1 - f) * 8 * P + T.out * 5 * P;
      const key = T.line.toFixed(3) + '|' + b.toFixed(1);
      if (s._k !== key) {
        s._k = key;
        for (const ln of s.lines) { ln.style.opacity = T.line.toFixed(3); ln.style.filter = b > 0.1 ? `blur(${b.toFixed(1)}px)` : ''; }
      }
    }
    const op = (texts ? 1 - texts[i].out : 0).toFixed(3);
    if (s.last !== op) { s.el.style.opacity = op; s.last = op; }
  });

  document.body.classList.toggle('intro', pageO <= 0.001 && !main);
  const po = main ? '' : pageO.toFixed(3);
  if (po !== lastPage) { lastPage = po; page.style.opacity = po; }
  if (main) { page.style.visibility = ''; setAnim(false); stmt.classList.remove('warm'); }
  else page.style.visibility = 'visible';
}

/* ---------------------------------------------------------------- footer wordmark (the final edge of the page) */
// Fit the actual Archivo width after fonts load and on resize. Sink the ink inside
// the clipped footer edge without adding to the page's scrollable height.
const END = { width: 1.015, left: 0.5, sink: 0.16 };
function fitEnd() {
  const el = document.getElementById('endmark'); if (!el) return;
  const box = el.parentElement, avail = box.clientWidth; if (!avail) return;
  const stacked = matchMedia('(max-width: 1023px) and (orientation: portrait)').matches;
  el.style.fontSize = '100px'; el.style.marginTop = '0'; el.style.marginLeft = '0'; el.style.transform = ''; box.style.height = '';
  const w = el.getBoundingClientRect().width; if (!w) return;
  const F = 100 * avail * (stacked ? 0.96 : END.width) / w; el.style.fontSize = F.toFixed(2) + 'px';
  const wF = el.getBoundingClientRect().width;
  el.style.marginLeft = (stacked ? (avail - wF) / 2 : -(wF - avail) * END.left).toFixed(2) + 'px';
  if (stacked) { box.style.height = Math.ceil(el.getBoundingClientRect().height) + 'px'; el.style.transform = `translateY(${(F * END.sink).toFixed(2)}px)`; return; }
  const probe = document.createElement('i'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  el.appendChild(probe); const base = probe.getBoundingClientRect().top - el.getBoundingClientRect().top; probe.remove();
  const c = document.createElement('canvas').getContext('2d'); c.font = `900 ${F}px Archivo`; if ('fontStretch' in c) c.fontStretch = 'extra-condensed';
  const asc = c.measureText('NOTOHITSUBA').actualBoundingBoxAscent || F * 0.72;
  el.style.marginTop = (-(base - asc)).toFixed(2) + 'px';
  box.style.height = (asc + F * 0.14).toFixed(2) + 'px';
  el.style.transform = `translateY(${(F * END.sink).toFixed(2)}px)`;
}

/* ---------------------------------------------------------------- one programmatic scroll tween (anchor links) */
let ST_TW = null;
// the only programmatic scroll (besides the accordion's own, which never runs at the same time); ends exactly on
// target (no overshoot); a wheel / touch by the user cancels it
function scrollToY(y, dur = 0.9, done = null) {
  y = Math.round(clamp(y, 0, root.scrollHeight - VH));
  const d = Math.abs(y - scrollY);
  if (REDUCED || d < 2) { scrollTo({ top: y, behavior: 'instant' }); ST_TW = null; if (done) done(); return; }
  ST_TW = { from: scrollY, to: y, t: 0, dur: clamp(dur * (0.75 + 0.25 * Math.min(1, d / (VH * 2))), 0.6, 1.1), done };
}
function updateTween(dt) {
  if (!ST_TW || A) return;
  ST_TW.t += dt; const k = clamp01(ST_TW.t / ST_TW.dur), e = E(k);
  scrollTo({ top: k >= 1 ? ST_TW.to : lerp(ST_TW.from, ST_TW.to, e), behavior: 'instant' });
  if (k >= 1) { const f = ST_TW.done; ST_TW = null; if (f) f(); }
}
addEventListener('touchstart', () => { ST_TW = null; }, { passive: true });

/* ---------------------------------------------------------------- ACCORDION INDEX
   The INDEX typography turns into its content. On open (slightly overlapped, never all at once):
     0.00  the row's state changes (CSS): full-bleed rule draws, number + mark turn orange, the word lifts a hair
     0.04  the row's ground fades to its tone (a compositor layer; 01 / 03 / 05 deep blue, 02 / 04 ivory)
     0.10  the container grows (the only height that animates) while its header travels to the top of the screen
     0.32  the information fades in with a short settle (transform + opacity)
   On close: information fades -> container contracts -> the row returns to its INDEX state.
   Everything is measured once at the click; during the motion nothing is read back from the DOM. */
const items = $$('.item').map((el, i) => ({ el, i, id: el.id, row: $('.row', el), panel: $('.panel', el), pin: $('.pin', el) }));
const byId = id => items.find(x => x.id === id);
let OPEN = null, A = null, queued = null;
const OPN = { h0: 0.10, hd: 0.78, c0: 0.32, cd: 0.62 };       // open: height start / duration, content start / duration
const CLS = { cd: 0.26, h0: 0.08, hd: 0.6, cls: 0.1 };        // close: content fade, height start / duration, row state
const SW = 0.44;                                              // switching: the next one starts opening at 0.44 s
const docTop = (el) => el.getBoundingClientRect().top + scrollY;
function toggle(x, opts = {}) {
  if (mode !== 'main') return;
  // during a move: the last click wins, but a second click on the row that is already opening is a no-op
  // (a double click never opens-then-closes)
  if (A || locked) { queued = A && A.to === x ? null : x; return; }
  const from = OPEN, to = OPEN === x ? null : x;
  if (!from && !to) return;
  // --- all reads, once
  const s0 = scrollY, docH0 = root.scrollHeight;
  const hTo = to ? to.pin.offsetHeight : 0, hFrom = from ? from.panel.offsetHeight : 0;
  const toTop0 = to ? docTop(to.row) : 0, ixTop = docTop(indexEl);
  const fromAbove = !!(from && to && from.i < to.i);
  // --- the end state, computed
  const docHF = docH0 - hFrom + hTo;
  let endScroll, toTopF = 0;
  if (to) { toTopF = toTop0 - (fromAbove ? hFrom : 0); endScroll = clamp(toTopF, 0, docHF - VH); }
  else endScroll = clamp(opts.endScroll != null ? opts.endScroll : ixTop, 0, docHF - VH);
  const tOpen = to ? (from ? SW : 0) : 0;
  A = { from, to, hTo, hFrom, s0, docH0, toTop0, fromAbove, endScroll, endView: to ? toTopF - endScroll : 0, tOpen, t: 0, sNow: s0, v0: null, opened: false, closed: false,
    hd: opts.hd || CLS.hd, instant: !!opts.instant || REDUCED,
    T: to ? tOpen + Math.max(OPN.h0 + OPN.hd, OPN.c0 + OPN.cd) : CLS.h0 + (opts.hd || CLS.hd) };
  if (from) { from.el.classList.add('anim'); from.panel.style.height = hFrom + 'px'; from.row.setAttribute('aria-expanded', 'false'); }
  if (to) { to.el.classList.add('anim'); to.panel.style.height = '0px'; to.pin.style.opacity = '0'; }
  page.style.paddingBottom = VH + 'px';                         // room below the footer while heights change (never shown)
  locked = true; ST_TW = null;
}
function updateAcc(dt) {
  if (!A) return;
  A.t += A.instant ? 99 : dt;
  const { from, to, t } = A;
  let hFromNow = 0;
  if (from) {
    if (!A.closed && t >= CLS.cls) { A.closed = true; from.el.classList.remove('open'); from.el.classList.add('calm'); }
    const c = E(seg(t, 0, CLS.cd)), h = E(seg(t, CLS.h0, A.hd));
    hFromNow = A.hFrom * (1 - h);
    from.panel.style.height = hFromNow.toFixed(1) + 'px';
    from.pin.style.opacity = (1 - c).toFixed(3);
    from.pin.style.transform = `translate3d(0,${(-c * 8 * P).toFixed(1)}px,0)`;
  }
  if (to) {
    const tt = t - A.tOpen;
    if (!A.opened && tt >= 0) { A.opened = true; to.el.classList.add('open'); to.row.setAttribute('aria-expanded', 'true'); }
    const h = E(seg(tt, OPN.h0, OPN.hd)), c = E(seg(tt, OPN.c0, OPN.cd));
    to.panel.style.height = (A.hTo * h).toFixed(1) + 'px';
    to.pin.style.opacity = c.toFixed(3);
    to.pin.style.transform = `translate3d(0,${((1 - c) * 18 * P).toFixed(1)}px,0)`;
    // where the opening row is now, computed (nothing read back)
    const rowTop = A.toTop0 - (A.fromAbove ? A.hFrom - hFromNow : 0);
    if (tt < OPN.h0) {
      // the other one is still closing: the page holds still, but never shows past the end of the content
      const lim = A.docH0 - (A.hFrom - hFromNow) - VH;
      A.sNow = Math.max(0, Math.min(A.sNow, lim));
    } else {
      if (A.v0 == null) A.v0 = rowTop - A.sNow;
      A.sNow = rowTop - lerp(A.v0, A.endView, h);
    }
  } else {
    A.sNow = lerp(A.s0, A.endScroll, E(seg(t, CLS.h0, A.hd)));
  }
  scrollTo({ top: Math.max(0, A.sNow), behavior: 'instant' });
  if (t >= A.T) {
    if (from) { from.panel.style.height = ''; from.pin.style.opacity = ''; from.pin.style.transform = ''; from.el.classList.remove('anim'); }
    if (to) { to.panel.style.height = ''; to.pin.style.opacity = ''; to.pin.style.transform = ''; to.el.classList.remove('anim'); }
    page.style.paddingBottom = '';
    scrollTo({ top: A.endScroll, behavior: 'instant' });
    OPEN = to; A = null; locked = false;
    setHash(OPEN ? OPEN.id : '');
    if (queued) { const q = queued; queued = null; toggle(q); }
  }
}
items.forEach(x => {
  x.row.addEventListener('click', () => toggle(x));
  x.row.addEventListener('pointerleave', () => x.el.classList.remove('calm'));
  x.row.addEventListener('blur', () => x.el.classList.remove('calm'));
});
// the URL mirrors the open row without adding history entries (#asaichi ... #info); no hash when all are closed
function setHash(id) {
  try { history.replaceState(null, '', id ? '#' + id : location.pathname + location.search); } catch (e) { /* sandboxed frame */ }
}
// footer SITE / SUPPORT links: travel to the INDEX, then open the row there (never a bare anchor jump)
function navigateTo(x) {
  if (mode !== 'main') return;
  if (ALT) { altStart().then(g => g ? g.open(x.id) : null); return; }    // the glass / kinetic INDEX handles its own items
  if (A) { queued = x; return; }
  if (OPEN === x) { scrollToY(docTop(x.row)); return; }
  const r = x.row.getBoundingClientRect().top;
  if (r > -VH * 0.1 && r < VH * 0.75) toggle(x);
  else scrollToY(docTop(x.row) - VH * 0.3, 0.95, () => toggle(x));
}
// TOP: back to the top of the page (the summary). An open row closes on the way; the opening is not replayed.
function toTop() {
  if (mode !== 'main') return;
  const g = ALT && (GX || KX); if (g && g.current) { g.close().then(() => scrollToY(0, 1.0)); return; }
  if (A) { queued = null; return; }
  if (OPEN) toggle(OPEN, { endScroll: 0, hd: 1.0 });
  else scrollToY(0, 1.0);
}
$('#totop').addEventListener('click', (e) => { e.preventDefault(); toTop(); });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a || a.id === 'totop') return;
  const id = a.getAttribute('href').slice(1), x = byId(id);
  e.preventDefault();
  if (x) { navigateTo(x); return; }
  const t = document.getElementById(id); if (t) scrollToY(docTop(t));
});
// the glass INDEX (loaded after the opening, when the browser is idle; at once for a deep link)
function startGlass() {
  if (!GLASS) return Promise.resolve(null);
  if (!gxStart) gxStart = import('./glass/glass-index.js')
    .then(m => m.mountGlass($('#summary .gx'), {
      scrollTo: (y, done) => scrollToY(y, 0.7, done),
      onChange: (id) => { setHash(id || ''); if (id === 'info') requestAnimationFrame(fitEnd); },
    }))
    .then(g => { GX = g; window.__gx = g; return g; })
    .catch(err => { console.error(err); document.documentElement.dataset.index = 'classic'; sumParts.forEach(p => { p.el.style.opacity = ''; p.el.style.filter = ''; }); return null; });
  return gxStart;
}
// the kinetic INDEX (loaded at once: it is light, and its entrance is part of this sequence)
const afterIntro = [];
function startKinetic() {
  if (!KINETIC) return Promise.resolve(null);
  if (!kxStart) kxStart = import('./kinetic/kinetic-index.js')
    .then(m => m.mountKinetic($('#summary .kx'), {
      progress: () => mode === 'main' ? 1 : mode === 'hero' ? 0 : clamp01((d - KX_A) / (D_END - KX_A)),
      // a click while the INDEX is still assembling: the sequence runs on to its end, then the item opens
      finishIntro: (cb) => { if (mode === 'main') { cb(); return; } afterIntro.push(cb); stopAuto(); gesture = null; if (mode === 'hero') mode = 'intro'; dT = D_END; },
      scrollTo: (y, done) => scrollToY(y, 0.7, done),
      onChange: (id) => { setHash(id || ''); if (id === 'info') requestAnimationFrame(fitEnd); },
    }))
    .then(k => { KX = k; window.__kx = k; return k; })
    .catch(err => { console.error(err); document.documentElement.dataset.index = 'classic'; return null; });
  return kxStart;
}
const altStart = () => (GLASS ? startGlass() : startKinetic());
const altCur = () => !!((GX && GX.current) || (KX && KX.current));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && OPEN && !A && mode === 'main') { const r = OPEN.row; toggle(OPEN); r.focus({ preventScroll: true }); } });
// deep link (#noto ...): skip the opening and the statements, go straight to the INDEX with that row open
const DEEP = byId(location.hash.slice(1)) || null;

/* ---------------------------------------------------------------- idle prewarm (after the hero's first frames) */
// Everything the hero -> statement transition touches for the first time is prepared while nothing happens:
// the glass's low-resolution path, the statement face (subset), and the statement text layers.
let warmed = false, heroFrames = 0;
function maybeWarm() {
  if (warmed || mode !== 'hero' || !openingDone() || ++heroFrames < 30) return;
  warmed = true;
  const run = () => {
    hero.prewarm();
    document.fonts.load('900 80px Murecho', ST.map(s => s.el.textContent).join('')).catch(() => {});
    stmt.classList.add('warm');
  };
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 300);
}

/* ---------------------------------------------------------------- diagnostics (?diag, or Shift + D) */
// Shows what the live page actually gets: window / visual viewport / DPR / document / stage / canvas / CSS unit,
// the hero's computed frame and the canvas-vs-DOM type calibration. Off by default; nothing is measured unless open.
let diagEl = null;
function diagUpdate() {
  if (!diagEl) return;
  const vv = window.visualViewport, cv = document.getElementById('gl'), de = document.documentElement, st = stageBox.getBoundingClientRect(), d = hero.diag();
  const r = (x) => Math.round(x * 100) / 100;
  diagEl.textContent = [
    `window.inner      ${innerWidth} x ${innerHeight}`,
    `visualViewport    ${vv ? r(vv.width) + ' x ' + r(vv.height) + '  scale ' + r(vv.scale) : '—'}`,
    `devicePixelRatio  ${r(devicePixelRatio)}`,
    `docEl.client      ${de.clientWidth} x ${de.clientHeight}`,
    `stage (fixed)     ${stageBox.clientWidth} x ${stageBox.clientHeight}  rect ${r(st.width)} x ${r(st.height)}`,
    `canvas client     ${cv.clientWidth} x ${cv.clientHeight}  buffer ${cv.width} x ${cv.height}`,
    `100vw / 100vh     ${r(unitProbe.offsetWidth / 1000 * 1600)} (1600p)  --p ${r(P)}  ${VW} x ${VH}`,
    `hero frame        s ${r(d.view.s)}  ox ${r(d.view.ox)}  oy ${r(d.view.oy)}  objK ${r(d.objK)}`,
    `hero layouts      ${d.layouts}  typesets ${d.typesets}  fonts ${document.fonts.status}`,
    `canvas→DOM width  ${Object.entries(d.canvasR).map(([k, v]) => k + ' ' + v).join('  ')}`,
    `engine            ${navigator.userAgent.replace(/^.*\)\s*/, '').slice(0, 60)}`,
  ].join('\n');
}
function toggleDiag(on = !diagEl) {
  if (on && !diagEl) {
    diagEl = document.createElement('pre');
    diagEl.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;margin:0;padding:10px 12px;background:rgba(10,33,156,.92);color:#FCFAEF;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre;pointer-events:none';
    document.body.append(diagEl); diagUpdate();
    diagEl._t = setInterval(diagUpdate, 500);
  } else if (!on && diagEl) { clearInterval(diagEl._t); diagEl.remove(); diagEl = null; }
}
if (new URLSearchParams(location.search).has('diag')) toggleDiag(true);
addEventListener('keydown', (e) => { if (e.shiftKey && (e.key === 'D' || e.key === 'd')) toggleDiag(); });

/* ---------------------------------------------------------------- one loop */
let started = false;
function tick(now, dt, draw = true) {
  if (!started && !document.hidden) { started = true; hero.start(REDUCED || !!DEEP); }   // the opening starts when it can be seen
  if (locked && !A && openingDone()) locked = false;
  if (DEEP && !locked && mode === 'hero') {
    mode = 'main'; updateIntro(0);
    if (ALT) { scrollTo({ top: docTop(summary), behavior: 'instant' }); altStart().then(g => g && g.open(DEEP.id, { instant: true, noScroll: true })); }
    else {
      scrollTo({ top: docTop(indexEl), behavior: 'instant' });
      toggle(DEEP, { instant: true }); updateAcc(0);
    }
  }
  if (GLASS && !gxStart && (warmed || mode !== 'hero')) startGlass();
  if (KINETIC && !kxStart) startKinetic();
  maybeWarm();
  updateAcc(dt);
  updateTween(dt);
  updateIntro(REDUCED && mode !== 'main' ? dt * 3 : dt);
  syncHold();
  if (mode !== 'main') hero.step(now, dt, draw); else hero.hiddenTick();
  if (KX) KX.frame(dt);
  if (MANUAL) window.__cur?.frame(dt);
}
await document.fonts.ready;
fitEnd();
let last = performance.now();
let rawDt = 1 / 60;
function loop(now) { rawDt = Math.min(0.25, (now - last) / 1000); const dt = Math.min(0.05, rawDt); last = now; tick(now, dt); requestAnimationFrame(loop); }
if (!MANUAL) requestAnimationFrame(loop); else tick(performance.now(), 1 / 60);

/* ---------------------------------------------------------------- headless hooks */
window.__m = {
  step(n = 1) { for (let i = 0; i < n; i++) tick(performance.now(), 1 / 60, i === n - 1); },
  seek(t) { hero.seek(t); this.step(1); },
  // one gesture forward / back (to the next / previous resting point); toEnd: straight to the summary
  fwd(n = 0) { gesture = null; if (mode === 'hero') mode = 'intro'; dT = nextStop(dT); this.step(n); },
  back(n = 0) { gesture = null; dT = prevStop(dT); this.step(n); },
  toEnd(n = 2) { mode = 'intro'; d = dT = D_END; this.step(n); },
  go(v, n = 0) { if (mode === 'hero') mode = 'intro'; d = dT = v; this.step(n); },
  wheel(px, n = 0) { input(px); this.step(n); },
  T: () => ({ ST: ST.map(s => [s.a, s.inEnd, s.outStart, s.outEnd]), D_OBJ, D_IV, D_COV, D_WIN, D_END, STOPS }),
  scroll(y, n = 2) { scrollTo({ top: y, behavior: 'instant' }); this.step(n); },
  pointer(x, y, n = 40) { if (x == null) field.in = false; else if (!field.in) setPointer(x, y, true); else { setPointer(x, y, true); } this.step(n); },
  hover(i) { $$('.row').forEach((r, j) => r.classList.toggle('on', j === i)); },
  toggle(i, n = 0) { toggle(items[i]); this.step(n); },
  top: (id) => docTop(document.getElementById(id)),
  vh: () => VH,
  diag: () => { toggleDiag(true); diagUpdate(); const t = diagEl.textContent; return t; },
  state: () => ({ tw: !!ST_TW, scrollY, locked, mode, d: +d.toFixed(2), dT: +dT.toFixed(2), it: d, acc: !!A, open: OPEN && OPEN.id, queued: queued && queued.id, t: hero.time(), docH: root.scrollHeight, holding, res: hero.res() }),
};
