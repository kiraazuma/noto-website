// NOTO meets HITOTSUBASHI — PC Hero.
// Phase 1  three lines of type, one by one, filling the screen (the poster's pressure, in time).
// Phase 2  the pressure resolves: NOTO and HITOTSUBASHI relax into their resting place (bottom right, an echo of the
//          poster), MEETS — the meeting itself — is compressed into the centre, the paper flashes white, and the
//          liquid object condenses there from its core outward. The object then lives quietly under the cursor.
// The object is the base image (art direction) + its maps. WebGL only refracts the live type, moves light, and lets the
// glass give a few px of viscous pull. Its silhouette is never redesigned.
import * as THREE from 'three';
import { field } from './field.js';

const COBALT = '#0130E2', ORANGE = '#FD5500', CREAM = '#FCFAEF';
let W = 1600, H = 900;                                  // the active design frame (desktop 1600 x 900, mobile 390 x 844)
const qs = new URLSearchParams(location.search);
// Render resolution: never the raw devicePixelRatio. Desktop high-DPI is capped at 1.5 (visually the same glass at
// ~56% of the pixels of 2x); if frames are slow on this machine it steps down to 1.25, then 1.0 (adaptive).
// While the statements are shown (the whole stage is blurred ~24 px) the glass is rendered at 0.5x and every other frame:
// into a corner of the SAME drawing buffer (viewport) and scaled up by CSS, so switching allocates nothing.
// Adaptive resolution is decided once per session and only ever applied while the stage is hidden (no visible pop).
const DPR_MAX = Number(qs.get('dpr')) || Math.min(window.devicePixelRatio || 1, 1.5);
let DPR = DPR_MAX, PR = DPR, quality = 'full';
const MANUAL = qs.has('manual');                       // headless checks drive the clock
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const JP = '"Noto Sans JP", sans-serif', LAT = 'Archivo, sans-serif';

/* ------------------------------------------------------------------ type */
const mctx = document.createElement('canvas').getContext('2d');
const canvasInkLag = !('fontStretch' in mctx);
const STRETCH_KW = { 62.5: 'extra-condensed', 75: 'condensed', 87.5: 'semi-condensed', 100: 'normal', 125: 'expanded' };
const fontOf = (it, px) => `${it.weight} ${px}px ${it.family}`;
function setFont(ctx, it, px) { ctx.font = fontOf(it, px); if ('fontStretch' in ctx) ctx.fontStretch = STRETCH_KW[it.stretch || 100]; if ('letterSpacing' in ctx) ctx.letterSpacing = ((it.track || 0) * px) + 'px'; }
// The DOM is the source of truth for width. Canvas text metrics are only used for the ink box shape, and are
// calibrated against the DOM: WebKit / Safari's canvas has no fontStretch / letterSpacing, so there it measures the
// normal-width face while the page shows the condensed one (that mismatch is what threw the hero type off in Safari).
// r = DOM advance / canvas advance: 1.00 in Chromium, about 0.6-0.7 where the canvas cannot condense.
const probeBox = document.createElement('div');
probeBox.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;pointer-events:none;contain:layout style';
const probe = document.createElement('span'); probeBox.append(probe); document.body.append(probeBox);
function domAdvance(it, px, text) {
  Object.assign(probe.style, { font: fontOf(it, px), fontStretch: (it.stretch || 100) + '%', letterSpacing: (it.track || 0) + 'em', fontKerning: 'normal' });
  probe.textContent = text; return probe.getBoundingClientRect().width;
}
// returns placement + ink box (design px)
function typeset(it) {
  const text = it.runs.map(r => r[0]).join('');
  setFont(mctx, it, 200);
  const m = mctx.measureText(text);
  const cr = domAdvance(it, 200, text) / Math.max(1, m.width);                 // canvas -> DOM horizontal calibration
  const rr = Math.abs(cr - 1) < 0.004 ? 1 : cr;
  // (canvas adds the tracking after the last glyph too; actualBoundingBox is ink-based, so it is unaffected)
  const L = m.actualBoundingBoxLeft * rr, R = m.actualBoundingBoxRight * rr, A = m.actualBoundingBoxAscent, D = m.actualBoundingBoxDescent;
  const FA = m.fontBoundingBoxAscent, FD = m.fontBoundingBoxDescent;
  let k, sx = 1, ox, oy;
  const [l, r, t, b] = it.box;
  k = (b - t) / (A + D); oy = t + A * k;
  if (it.fit === 'w') {                                              // width fit at a given horizontal ratio
    sx = it.sx || 1; k = (r - l) / ((L + R) * sx); ox = l + L * k * sx;
    oy = it.vAlign === 'bottom' ? b - D * k : it.vAlign === 'center' ? it.yc - (D - A) * k / 2 : t + A * k;
  }
  else if (it.fit === 'box') { sx = (r - l) / ((L + R) * k); ox = l + L * k * sx; }
  else ox = it.align === 'r' ? r - R * k : l + L * k;              // height-only fit, natural width
  const px = 200 * k;
  setFont(mctx, it, px);
  let x = 0; const runs = it.runs.map(([t_, c]) => { const q = { t: t_, c, x }; x += mctx.measureText(t_).width; return q; });   // canvas units
  return { px, sx, ox, oy, runs, r: rr, FA: FA * k, FD: FD * k, ink: [ox - L * k * sx, oy - A * k, ox + R * k * sx, oy + D * k] };
}

// Opening type (unchanged): the wide NOTO and the condensed HITOTSUBASHI that fill the three bands.
const OPEN = {
  noto: { runs: [['NOTO', COBALT]], family: LAT, weight: 900, stretch: 125, track: -0.035, fit: 'box', box: [-34, 1150, -52, 296] },
  hito: { runs: [['HITOTSUBASHI', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.025, fit: 'box', box: [-14, W + 14, 676, 922] },
};
// Hero (Phase 2), after the layout reference:
//   NOTO          top left, very tall and condensed, cut by the top edge — a wall of type
//   HITOTSUBASHI  bottom right, the same voice, starting under the glass's tail and running off the right/bottom edges
//   orange line   the date (left) and the title (right), their centre lines on the exact middle of the gap between
//                 NOTO's bottom and HITOTSUBASHI's top; the glass stands between them
const MID_GAP = 24;   // side margins for the orange line
const REST = {
  noto: { runs: [['NOTO', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'box', box: [-24, 828, -64, 356] },
  hito: { runs: [['HITOTSUBASHI', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'box', box: [581.8, W + 24, 680, 942] },
  // y is set from the measured gap (see centreLine())
  date: { runs: [['2026.11.21–23', ORANGE]], family: LAT, weight: 900, stretch: 87.5, h: 61.5, box: [MID_GAP, 0, 0, 0] },
  title: { runs: [['出張輪島朝市 in 一橋祭', ORANGE]], family: JP, weight: 900, track: -0.03, h: 61, box: [0, W - MID_GAP, 0, 0], align: 'r' },
};
// Phase 1 boxes: three bands, edge to edge and a little past it, almost touching each other.
const INTRO = {
  noto: [-28, W + 28, 14, 300],
  meets: { runs: [['MEETS', ORANGE]], family: LAT, weight: 900, stretch: 125, fit: 'box', box: [-28, W + 28, 314, 600] },
  hito: [-28, W + 28, 614, 900],
};
// The object at rest: centred, upright enough to be read whole, its tail dipping into HITOTSUBASHI.
let OBJECT = { cx: 738, cy: 450, h: 852, rot: 0 };   // centred vertically: equal safety margin above and below   // poster orientation (rot 0): the silhouette reads exactly as on the poster

/* ------------------------------------------------------------------ the two compositions */
// Desktop: the poster (1600 x 900). Mobile (portrait, narrower than 700 px): a recomposition on a 390 x 844 frame —
// not a scaled copy. Same faces, same horizontal ratios as the desktop type (NOTO 75 %, HITOTSUBASHI 54 %: the
// brand's condensed voice, no extra squeeze), the same sculpture, the same light. Built from width (the type spans
// the screen) and pinned to the top / bottom edges, so a shorter Safari viewport only tightens the middle.
// Opening bands (desktop): the same rule as the phone — three words of ONE glyph height filling the viewport — with a
// slight crop past the side edges (crop: share of the width per side).
const DESK = { name: 'desk', W: 1600, H: 900, OPEN, REST, INTRO, OBJECT: { ...OBJECT }, info: ['date', 'title'], midLine: true,
  BANDS: { gap: 0.012, gapMin: 6, crop: 0.012 },
  ANCHOR: { noto: [-1, -1], notoO: [-1, -1], hito: [1, 1], hitoO: [1, 1], date: [-1, 0], title: [1, 0], meets: [0, 0] } };
const MW = 390, MH = 844;
const MOB = { name: 'mob', W: MW, H: MH, info: ['titleA', 'titleB', 'date'], midLine: false, infoOnTop: true,
  OPEN: {
    noto: { runs: [['NOTO', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'w', sx: 0.75, box: [-26, MW + 26, 16, 0], vAlign: 'top' },
    hito: { runs: [['HITOTSUBASHI', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'w', sx: 0.54, box: [-6, MW + 6, 0, MH - 16], vAlign: 'bottom' },
  },
  MEETS: { runs: [['MEETS', ORANGE]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'w', sx: 0.75, box: [-26, MW + 26, 0, 0], vAlign: 'center', yc: MH / 2 },
  REST: {
    // NOTO: top-left, its top cut by the edge, the last O touching the right edge
    noto: { runs: [['NOTO', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'w', sx: 0.75, box: [-11, MW + 11, -26, 0], vAlign: 'top' },
    // HITOTSUBASHI: along the bottom edge, with the last I slightly past the right edge
    hito: { runs: [['HITOTSUBASHI', COBALT]], family: LAT, weight: 900, stretch: 62.5, track: -0.02, fit: 'w', sx: 0.54, box: [-7, MW + 7, 0, MH + 8], vAlign: 'bottom' },
    // the orange information in the two corners the sculpture leaves free: title upper-left, date lower-right
    titleA: { runs: [['出張輪島朝市', ORANGE]], family: JP, weight: 900, track: -0.02, box: [18, 0, 214, 240] },
    titleB: { runs: [['in 一橋祭', ORANGE]], family: JP, weight: 900, track: -0.02, box: [18, 0, 250, 276] },
    date: { runs: [['2026.11.21–23', ORANGE]], family: LAT, weight: 900, stretch: 75, box: [0, MW - 18, 702, 727], align: 'r' },
  },
  // The sculpture is not placed by a fixed point: it is solved per viewport in the band between NOTO and HITOTSUBASHI
  // (see solveMobileObject). OBJECT here is only the starting value; FIT holds the composition's rules.
  OBJECT: { cx: MW / 2, cy: 548, h: 486, rot: 0 },
  FIT: {
    hMax: 640,     // the largest the glass may be (design px tall): the band between the words decides, not the width
    bleed: 0.12,   // the glass may run past each side edge by this share of its own width (head / tail cut, shape kept)
    hMin: 300,     // below this the band is too short to compose; the glass stops shrinking (orange stays above it)
    ovT: 30,       // the head reaches this far up into NOTO's letters ...
    ovB: 34,       // ... and the tail this far down into HITOTSUBASHI's (the poster's two contacts)
    gap: 8,        // clear space kept between the glass and every orange line
    edge: 6,       // the glass is never cut by the screen edges
  },
  // Opening (phone): the three words stacked as three bands of ONE glyph height, each squeezed to the screen width
  // (see openingBands). gap: share of the screen height between bands (at least gapMin); crop: past the side edges.
  BANDS: { gap: 0.009, gapMin: 4, crop: 0.015 },
  // HERO only: keep 1.8% of each measured glyph height past its edge, even on short screens.
  // Signed offsets also carry the title/date inward; the existing glass solver fits the resulting band.
  SQZ: { cropT: 0.018, cropB: 0.018, top: ['noto', 'titleA', 'titleB'], bot: ['hito', 'date'] },
  ANCHOR: { noto: [-1, -1], notoO: [-1, -1], hito: [1, 1], hitoO: [1, 1], titleA: [-1, -1], titleB: [-1, -1], date: [1, 1], meets: [0, 0] } };
let LAY = DESK;
const pickLayout = (vw, vh) => (vw < 700 && vh > vw ? MOB : DESK);

/* ------------------------------------------------------------------ timeline (s) */
const T = {
  noto: [0.00, 0.62], meets: [0.36, 0.98], hito: [0.72, 1.34],      // slide-ins
  hold: 1.95,                                                        // all three rest a moment
  settle: [1.95, 2.85],                                              // names relax to their resting place
  squeeze: [1.95, 2.50],                                             // MEETS compressed to the centre
  flash: [2.20, 2.95],                                               // paper whites out, briefly
  form: [2.32, 3.10],                                                // glass condenses from its core
  info: [2.80, 3.30],                                                // info arrives last
  end: 3.30,
};
const clamp01 = x => Math.max(0, Math.min(1, x));
const seg = (t, [a, b]) => clamp01((t - a) / (b - a));
const outExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const inOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const inCubic = x => x * x * x;
const outCubic = x => 1 - Math.pow(1 - x, 3);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ DOM */
const design = document.getElementById('design'), typo = document.getElementById('typo'), cv = document.getElementById('gl');
const hinfo = document.getElementById('hinfo'), stageEl = document.getElementById('stage');
const flash = document.getElementById('flash'), replay = document.getElementById('replay');
const items = {};      // name -> { it, ts, el, m: [a,b,c,d,e,f] (design affine), o: opacity }
function buildItem(name, it) {
  const ts = typeset(it);
  if (items[name]) items[name].el.remove();
  const g = document.createElement('div'); g.className = 'g';
  const w = document.createElement('div'); w.className = 't';
  w.style.left = ts.ox + 'px'; w.style.top = ts.oy + 'px'; w.style.transform = `scaleX(${ts.sx})`;
  const s = document.createElement('span');
  Object.assign(s.style, { font: fontOf(it, ts.px), fontStretch: (it.stretch || 100) + '%', letterSpacing: (it.track || 0) + 'em', lineHeight: ts.px + 'px', top: -((ts.px - (ts.FA + ts.FD)) / 2 + ts.FA) + 'px' });
  for (const r of ts.runs) { const sp = document.createElement('span'); sp.textContent = r.t; sp.style.color = r.c; s.append(sp); }
  w.append(s); g.append(w);
  // the phone's orange information sits in a layer above the glass: overlap is allowed, hiding it is not
  (LAY.infoOnTop && LAY.info.includes(name) ? hinfo : typo).append(g);
  items[name] = Object.assign(items[name] || { m: [1, 0, 0, 1, 0, 0], o: 1 }, { it, ts, el: g });
}
// affine that maps box A (ink) onto box B (non-uniform scale + translate)
function boxMap(a, b) {
  const sx = (b[2] - b[0]) / (a[2] - a[0]), sy = (b[3] - b[1]) / (a[3] - a[1]);
  return [sx, 0, 0, sy, b[0] - a[0] * sx, b[1] - a[1] * sy];
}
const mix6 = (p, q, t) => p.map((v, i) => lerp(v, q[i], t));
// Outside control (scroll / transition), all in design px. pre: scroll pressure 0..1 (Step 1, reversible);
// exit: per-item progress 0..1 of leaving the frame (NOTO up-left, HITOTSUBASHI down-right, date left, title right).
export const ctl = { pre: 0, exit: { noto: 0, hito: 0, date: 0, title: 0 }, calm: 0, turn: 0, fade: 0, beam: 0, gather: 0, hidden: false, typeFade: 0 };
const EXIT = { noto: [-1010, -580], hito: [1120, 360], date: [-840, 0], title: [1000, 0] };
const PRE = { noto: [-16, -14], hito: [16, 4], date: [-12, -6], title: [12, -6] };     // Step 1: a lean in the scroll direction
// Desktop responsive: one uniform type scale s (fluid, clamped), and each element pinned to the viewport edge it
// touches in the poster: NOTO top-left, HITOTSUBASHI bottom-right (its last I keeps the same ~95% at every size),
// the date left / title right on the centre line, the object centred. AX / AY = slack between frame and viewport.
let AX = 0, AY = 0, objK = 1;
const SQ = { t: 0, b: 0 };
const EXTRA = {};                                  // per-item offsets of the orange info (desktop held upright, see layout)
let bleedX = 0;                                    // design px the glass may run past the side edges (phone)                         // phone, short screens: NOTO lifted by t, HITOTSUBASHI sunk by b
const sqOf = (n) => !LAY.SQZ ? 0 : LAY.SQZ.top.includes(n) ? -SQ.t : LAY.SQZ.bot.includes(n) ? SQ.b : 0;
function writeItems() {
  for (const n in items) {
    const { el, m, o } = items[n];
    const an = LAY.ANCHOR[n] || [0, 0];
    const ex = EXTRA[n];
    let ox = an[0] * AX + (ex ? ex[0] : 0), oy = an[1] * AY + sqOf(n) + (ex ? ex[1] : 0);
    if (EXIT[n]) { const e = ctl.exit[n], p = PRE[n]; ox += p[0] * ctl.pre + EXIT[n][0] * e; oy += p[1] * ctl.pre + EXIT[n][1] * e; }
    items[n].off = [ox, oy];
    el.style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4] + ox},${m[5] + oy})`; el.style.opacity = o * (1 - ctl.typeFade);
  }
  // the refracted copy of the type: while the type is fading behind the blur, 5% steps are enough (no per-frame
  // full-viewport canvas redraw + texture upload)
  const osig = (lastApplied < T.end ? lastApplied : 'r') + '|' + Math.round(ctl.typeFade * 20);
  if (osig !== lastOpt) { lastOpt = osig; opticalDirty = true; }
}
let lastOpt = '';
const ID = [1, 0, 0, 1, 0, 0];

/* ------------------------------------------------------------------ optical background (the same type, for the glass) */
const optical = document.createElement('canvas'), octx = optical.getContext('2d');
let view = { s: 1, ox: 0, oy: 0, vw: 0, vh: 0 };
function drawOptical() {
  const f = DPR;
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1; octx.fillStyle = CREAM; octx.fillRect(0, 0, optical.width, optical.height);
  for (const k in items) {
    const { it, ts, m, o } = items[k]; if (o <= 0.001) continue;
    octx.setTransform(f * view.s, 0, 0, f * view.s, f * view.ox, f * view.oy);
    const off = items[k].off || [0, 0];
    octx.transform(m[0], m[1], m[2], m[3], m[4] + off[0], m[5] + off[1]);
    octx.translate(ts.ox, ts.oy); octx.scale(ts.sx * ts.r, 1); setFont(octx, it, ts.px); octx.textBaseline = 'alphabetic';
    octx.globalAlpha = o * (1 - ctl.typeFade);
    for (const r of ts.runs) { octx.fillStyle = r.c; octx.fillText(r.t, r.x, 0); }
  }
  octx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ WebGL: the object */
const meta = await (await fetch('assets/assets.json')).json();
const [BW, BH] = meta.size, BB = meta.bbox, BC = [(BB[0] + BB[2]) / 2, (BB[1] + BB[3]) / 2], BBH = BB[3] - BB[1];
async function loadTex(url, { premultiply = false, mip = false } = {}) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: premultiply ? 'premultiply' : 'none', imageOrientation: 'none' });
  const t = new THREE.Texture(bmp);
  Object.assign(t, { flipY: false, colorSpace: THREE.NoColorSpace, premultiplyAlpha: false, generateMipmaps: mip, minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter, magFilter: THREE.LinearFilter, anisotropy: 8 });
  t.needsUpdate = true; return t;
}
// The glass maps (~4 MB) load in the background: the opening (DOM type) never waits for them. Until they are in, the
// sculpture is simply not drawn; the opening holds on its full three-word frame (see heroStep) for at most HOLD_MAX s,
// so on a slow network the glass still condenses in its proper moment instead of popping in later.
const blankTex = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t.needsUpdate = true; return t; };
let tBase = blankTex(), tSdf = blankTex(), tDisp = blankTex(), tThick = blankTex(), tHigh = blankTex();
let texReady = false, texFailed = false;
const HOLD_MAX = 6;
const texLoad = Promise.all([
  loadTex('assets/object-base.png', { premultiply: true, mip: true }), loadTex('assets/object-sdf.png'),
  loadTex('assets/object-displacement.png'), loadTex('assets/object-thickness.png'), loadTex('assets/object-highlight.png', { mip: true }),
]).then(([a, b, c, d, e]) => {
  Object.assign(U.tBase, { value: a }); U.tSdf.value = b; U.tDisp.value = c; U.tThick.value = d; U.tHigh.value = e;
  texReady = true; quad.visible = true;
}, () => { texReady = true; texFailed = true; });       // no glass rather than a stalled page
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let opticalTex = null;

const frag = /* glsl */`
uniform sampler2D tBase, tSdf, tDisp, tThick, tHigh, tBg;
uniform vec2 uRes, uOrigin, uBaseSize, uHlOff, uSlide, uAnchor, uPull;
uniform float uScale, uDevPerBase, uSdfRange, uTime, uSigma, uNear, uReveal, uGlint;
uniform vec3 uL;                         // light direction (cursor-driven, lagged): x right, y down, z towards the viewer
uniform vec2 uAxis, uBC;                 // long axis of the object and its centre (base px)
uniform float uLive, uSpec, uEnv, uNormK;
uniform vec2 uRefrTilt;
uniform vec4 uSafe;
uniform float uMaxShift;
uniform mat3 uInv; uniform mat2 uFwd;
uniform vec3 uPaper;
uniform float uFade, uBeam, uBeamY, uBeamW;
uniform float uRefr, uDispPx, uThickW, uCA, uCAW, uHl, uSoft, uFlow, uTBias;
uniform float uTrans, uTransWhite, uTransColour, uTransHl, uClearLo, uClearHi, uSatLo, uSatHi, uWhiteLo, uWhiteHi;
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float dec16(vec4 t) { return (t.r * 65280.0 + t.g * 255.0) / 65535.0; }
vec3 unpre(vec4 p) { return p.a > 0.0 ? clamp(p.rgb / p.a, 0.0, 1.0) : vec3(0.0); }
void main() {
  vec2 dp = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uOrigin) / uScale;       // design px
  vec3 hq = uInv * vec3(dp, 1.0);                      // projective: the sculpture can turn in depth
  vec2 q = hq.xy / hq.z, uv = q / uBaseSize;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) discard;
  float sd = (dec16(texture2D(tSdf, uv)) - 0.5) * 2.0 * uSdfRange;
  float a = clamp(sd * uDevPerBase / max(uSoft, 0.35) * 0.5 + 0.5, 0.0, 1.0);
  float Hk = dec16(texture2D(tThick, uv));
  // condensation: the glass appears from its thickest core outward; the moving front carries light
  float th = 1.08 - uReveal * 1.2;
  float form = smoothstep(th - 0.05, th + 0.01, Hk);
  float front = smoothstep(th - 0.10, th, Hk) * (1.0 - smoothstep(th, th + 0.12, Hk)) * (1.0 - uReveal * uReveal);
  a *= max(form, 0.0);
  if (a <= 0.0) discard;
  // reflections drift a little on the curved surface (silhouette fixed): deeper parts move more
  // bands of reflection move a little, more where the glass is deep; the outline does not
  // internal flow: the reflections travel very slowly along the peninsula's length (a long, slow wave; no noise)
  float sAx = dot(q - uBC, uAxis);
  vec2 flow = uAxis * sin(uTime * 0.21 - sAx * 0.0105) * uFlow;
  // view parallax: deeper parts of the glass shift more when the light / view leans (the rim stays put)
  vec2 tuv = uv + (uSlide + flow) * smoothstep(0.08, 0.6, Hk) / uBaseSize;
  // never read the base outside its own glass: where the shifted sample leaves the opaque body, fall back to the
  // unshifted texel (no dark / transparent fringe pulled in)
  vec4 bpS = texture2D(tBase, tuv);
  float inBody = smoothstep(0.92, 0.995, bpS.a);
  tuv = mix(uv, tuv, inBody);
  vec3 baseS = mix(unpre(texture2D(tBase, uv)), unpre(bpS), inBody);
  vec3 base = toLin(baseS);
  // refraction of the live type
  vec3 dm = texture2D(tDisp, uv).rgb;
  vec2 d = (dm.xy * 2.0 - 1.0) * dm.z * uDispPx * uRefr * mix(1.0, Hk, uThickW);
  // the refraction leans a little with the view (deeper glass bends the type further), the same everywhere
  d += uRefrTilt * Hk;
  vec2 dd = uFwd * d * uScale;                                                          // device px
  // limit the displacement and keep every sample inside the drawn page (never past its edges)
  float dl = length(dd); dd *= min(1.0, uMaxShift * uScale / max(dl, 1e-4));
  vec2 suv = gl_FragCoord.xy / uRes, duv = vec2(dd.x, -dd.y) / uRes;
  float ca = uCA * (1.0 - smoothstep(0.0, uCAW, Hk));
  vec2 lo = uSafe.xy, hi = uSafe.zw;
  vec3 bg = texture2D(tBg, clamp(suv + duv, lo, hi)).rgb;
  if (ca > 0.004) { bg.r = texture2D(tBg, clamp(suv + duv * (1.0 - ca), lo, hi)).r; bg.b = texture2D(tBg, clamp(suv + duv * (1.0 + ca), lo, hi)).b; }
  vec3 ratio = bg / uPaper;
  // how much type shows: from the base's own local luminance / saturation / speculars
  vec3 soft = unpre(texture2D(tBase, tuv, uTBias));
  float lum = dot(soft, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(soft.r, max(soft.g, soft.b)), mn = min(soft.r, min(soft.g, soft.b));
  float sat = (mx - mn) / max(mx, 1e-3);
  float clear = smoothstep(uClearLo, uClearHi, lum) * (1.0 - smoothstep(uSatLo, uSatHi, sat));
  float white = smoothstep(uWhiteLo, uWhiteHi, lum);
  float lumS = dot(baseS, vec3(0.2126, 0.7152, 0.0722));
  float mxS = max(baseS.r, max(baseS.g, baseS.b)), mnS = min(baseS.r, min(baseS.g, baseS.b));
  float hl0 = smoothstep(0.92, 0.985, lumS) * (1.0 - smoothstep(0.05, 0.16, (mxS - mnS) / max(mxS, 1e-3)));
  float Tm = mix(uTransColour, mix(uTrans, uTransWhite, white), clear) * (1.0 - uTransHl * hl0);
  vec3 col = base * mix(vec3(1.0), ratio, Tm);
  // the base's own speculars, leaning towards the cursor
  float hl = texture2D(tHigh, uv + uHlOff / uBaseSize).r * uHl;
  col = 1.0 - (1.0 - col) * (1.0 - hl);
  // where the glass edge crosses the type, the edge catches light (only there)
  float inkUnder = 1.0 - smoothstep(0.55, 0.9, dot(texture2D(tBg, suv).rgb, vec3(0.2126, 0.7152, 0.0722)));
  float rimBand = 1.0 - smoothstep(0.04, 0.2, Hk);
  col = 1.0 - (1.0 - col) * (1.0 - uGlint * rimBand * inkUnder * 0.8);
  // optical layer: the same surface under a moving light. Surface = the dome + the base's own bands (so new light rides
  // on the existing pattern instead of painting a new one).
  vec2 e = vec2(3.0, 0.0) / uBaseSize, f = vec2(0.0, 3.0) / uBaseSize;
  float hx1 = dec16(texture2D(tThick, uv + e)) * 0.7 + dot(unpre(texture2D(tBase, tuv + e, 2.0)), vec3(0.3333)) * 0.3;
  float hx0 = dec16(texture2D(tThick, uv - e)) * 0.7 + dot(unpre(texture2D(tBase, tuv - e, 2.0)), vec3(0.3333)) * 0.3;
  float hy1 = dec16(texture2D(tThick, uv + f)) * 0.7 + dot(unpre(texture2D(tBase, tuv + f, 2.0)), vec3(0.3333)) * 0.3;
  float hy0 = dec16(texture2D(tThick, uv - f)) * 0.7 + dot(unpre(texture2D(tBase, tuv - f, 2.0)), vec3(0.3333)) * 0.3;
  vec3 n = normalize(vec3(-(hx1 - hx0) * uNormK, -(hy1 - hy0) * uNormK, 1.0));
  vec3 Hh = normalize(normalize(uL) + vec3(0.0, 0.0, 1.0));
  float sp = smoothstep(0.55, 0.95, pow(max(dot(n, Hh), 0.0), 70.0)) * smoothstep(0.03, 0.18, Hk);
  // a few reflected colours by direction (studio around the object), turning with the light
  vec2 r = n.xy - uL.xy * 0.55;
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.4);
  float wC = smoothstep(0.12, 0.42, r.x - 0.25 * r.y), wM = smoothstep(0.12, 0.42, -r.x + 0.4 * r.y), wO = 1.0 - smoothstep(0.04, 0.11, length(r - vec2(0.3, 0.42)));
  vec3 env = vec3(0.004, 0.03, 0.76) * wC + vec3(0.11, 0.17, 0.06) * wM + vec3(0.98, 0.09, 0.0) * wO * 0.6;
  float envW = clamp((wC + wM + wO * 0.6) * fres * uEnv, 0.0, 0.6) * uLive;
  col = mix(col, env, envW);
  // the side that faces the light gathers a little more brightness, the far side clears (balance shifts with the view)
  float facing = dot(n, normalize(uL));
  col = mix(col, vec3(1.0), uLive * 0.10 * smoothstep(0.55, 1.0, facing) * smoothstep(0.05, 0.4, Hk));
  col = 1.0 - (1.0 - col) * (1.0 - sp * uSpec * uLive);
  col = mix(col, vec3(1.0), front * 0.85);
  // Hero -> Main: the light gathers on the sculpture's horizontal centre line (screen space) while the glass clears
  float band = exp(-pow((dp.y - uBeamY) / uBeamW, 2.0));
  col = mix(col, vec3(1.0), clamp(band * uBeam * 1.15, 0.0, 1.0));
  col = mix(col, vec3(0.9, 0.93, 1.0), uBeam * 0.35 * (1.0 - band));
  a *= max(1.0 - uFade, band * uBeam * (1.0 - smoothstep(0.55, 1.0, uFade)));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}`;
const U = {
  tBase: { value: tBase }, tSdf: { value: tSdf }, tDisp: { value: tDisp }, tThick: { value: tThick }, tHigh: { value: tHigh }, tBg: { value: null },
  uRes: { value: new THREE.Vector2() }, uOrigin: { value: new THREE.Vector2() }, uBaseSize: { value: new THREE.Vector2(BW, BH) },
  uHlOff: { value: new THREE.Vector2() }, uSlide: { value: new THREE.Vector2() }, uAnchor: { value: new THREE.Vector2(OBJECT.cx, OBJECT.cy) }, uPull: { value: new THREE.Vector2() },
  uScale: { value: 1 }, uDevPerBase: { value: 1 }, uSdfRange: { value: meta.sdfRangePx }, uTime: { value: 0 }, uSigma: { value: 170 }, uNear: { value: 0 }, uReveal: { value: 0 }, uGlint: { value: 0.32 }, uL: { value: new THREE.Vector3(-0.35, -0.45, 0.82) }, uAxis: { value: new THREE.Vector2(0.6, -0.8) }, uBC: { value: new THREE.Vector2(BC[0], BC[1]) }, uLive: { value: 0 }, uSpec: { value: 0.65 }, uEnv: { value: 0.5 }, uNormK: { value: 9 }, uRefrTilt: { value: new THREE.Vector2() }, uSafe: { value: new THREE.Vector4(0, 0, 1, 1) }, uMaxShift: { value: 40 },
  uFade: { value: 0 }, uBeam: { value: 0 }, uBeamY: { value: 450 }, uBeamW: { value: 60 },
  uInv: { value: new THREE.Matrix3() }, uFwd: { value: new THREE.Matrix2() }, uPaper: { value: new THREE.Color(CREAM) },
  // look (settled in the static hero work)
  uRefr: { value: 0.95 }, uDispPx: { value: 48 }, uThickW: { value: 1 }, uCA: { value: 0.04 }, uCAW: { value: 0.3 }, uHl: { value: 0.12 }, uSoft: { value: 0.5 * DPR }, uFlow: { value: 3.0 }, uTBias: { value: 1.5 },
  uTrans: { value: 0.92 }, uTransWhite: { value: 0.45 }, uTransColour: { value: 0.05 }, uTransHl: { value: 1 },
  uClearLo: { value: 0.45 }, uClearHi: { value: 0.7 }, uSatLo: { value: 0.12 }, uSatHi: { value: 0.35 }, uWhiteLo: { value: 0.82 }, uWhiteHi: { value: 0.94 },
};
const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false });
// the fragment shader only runs over the sculpture's projected bounds (+ margin), not the whole viewport
const quadPos = new THREE.Float32BufferAttribute(new Float32Array(18), 3);
const quad = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', quadPos), mat);
function setQuad(b) {
  const g = 24, v = view;
  const x0 = (v.ox + (b[0] - g) * v.s) / v.vw * 2 - 1, x1 = (v.ox + (b[2] + g) * v.s) / v.vw * 2 - 1;
  const y0 = 1 - (v.oy + (b[1] - g) * v.s) / v.vh * 2, y1 = 1 - (v.oy + (b[3] + g) * v.s) / v.vh * 2;
  const a = quadPos.array; a.set([x0, y1, 0, x1, y1, 0, x0, y0, 0, x0, y0, 0, x1, y1, 0, x1, y0, 0]); quadPos.needsUpdate = true;   // counter-clockwise (front-facing)
}
quad.frustumCulled = false; quad.visible = false; scene.add(quad);
// The sculpture as a rigid plane in space: in-plane turn rz, turn in depth ax (about x) / ay (about y), uniform scale sc,
// offset (dx, dy), seen through a long lens (focal F). Gives a real perspective shift without deforming the outline.
const F = 2600;                                   // design px: lens length -> a visible but gentle keystone when it tips
const CONTOUR = meta.contour;
let lastBBox = null;
function homography(dx, dy, rz, ax, ay, sc) {
  const o = OBJECT, k = o.h / BBH;
  const cz = Math.cos(rz), sz = Math.sin(rz), cx_ = Math.cos(ax), sx_ = Math.sin(ax), cy_ = Math.cos(ay), sy_ = Math.sin(ay);
  // R = Ry(ay) * Rx(ax) * Rz(rz)
  const Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]], Rx = [[1, 0, 0], [0, cx_, -sx_], [0, sx_, cx_]], Ry = [[cy_, 0, sy_], [0, 1, 0], [-sy_, 0, cy_]];
  const mul = (A, B) => A.map((r, i) => B[0].map((_, j) => r.reduce((t, _v, q) => t + A[i][q] * B[q][j], 0)));
  const R = mul(Ry, mul(Rx, Rz));
  const Tx = o.cx + dx, Ty = o.cy + dy, f = F, g = sc;
  const A = [[f * g * R[0][0] + Tx * R[2][0], f * g * R[0][1] + Tx * R[2][1], f * Tx],
             [f * g * R[1][0] + Ty * R[2][0], f * g * R[1][1] + Ty * R[2][1], f * Ty],
             [R[2][0], R[2][1], f]];
  const B = [[k, 0, -k * BC[0]], [0, k, -k * BC[1]], [0, 0, 1]];
  return { Hm: mul(A, B), R, k: k * sc };
}
function project(Hm, x, y) { const w = Hm[2][0] * x + Hm[2][1] * y + Hm[2][2]; return [(Hm[0][0] * x + Hm[0][1] * y + Hm[0][2]) / w, (Hm[1][0] * x + Hm[1][1] * y + Hm[1][2]) / w]; }
function placeObject(dx = 0, dy = 0, rz = 0, ax = 0, ay = 0, sc = objK) {
  let h = homography(dx, dy, rz, ax, ay, sc);
  // never clip: keep the projected outline inside the frame (6 px margin) by limiting the offset, not by deforming
  let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
  for (let i = 0; i < CONTOUR.length; i += 2) { const [X, Y] = project(h.Hm, CONTOUR[i][0], CONTOUR[i][1]); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); x0 = Math.min(x0, X); x1 = Math.max(x1, X); }
  const m = 6; let fy = 0, fx = 0;
  const T0 = -AY + m, B0 = H + AY - m, L0 = -AX + m - bleedX, R0 = W + AX - m + bleedX;   // the viewport (+ allowed side bleed), design px
  if (y0 < T0) fy = T0 - y0; else if (y1 > B0) fy = B0 - y1;
  if (x0 < L0) fx = L0 - x0; else if (x1 > R0) fx = R0 - x1;
  if (fx || fy) { h = homography(dx + fx, dy + fy, rz, ax, ay, sc); y0 += fy; y1 += fy; x0 += fx; x1 += fx; }
  lastBBox = [x0, y0, x1, y1];
  if (view.vw) setQuad(lastBBox);
  const Hm = h.Hm, M3 = new THREE.Matrix3().set(...Hm[0], ...Hm[1], ...Hm[2]).invert();
  U.uInv.value.copy(M3);
  const R = h.R, kk = h.k;
  U.uFwd.value.set(R[0][0] * kk, R[0][1] * kk, R[1][0] * kk, R[1][1] * kk);
  U.uDevPerBase.value = kk * view.s * PR;
}

/* ------------------------------------------------------------------ phone: one poster composition */
// The phone hero is one vertical poster laid out in ONE region: the stage box (100svh, i.e. the height with Safari's
// bars shown — it does not change when they slide away). The type is sized by the width only (s = vw / 390), so the
// words keep their width whatever the height. NOTO hangs from the top edge, HITOTSUBASHI stands on the bottom edge,
// the title hangs under NOTO and the date stands on HITOTSUBASHI (they move with the word they belong to).
// The glass is then solved inside the band between the two words, from their measured ink:
//   size    = the largest that (a) the width allows (hMax), (b) the band asks for (head ovT into NOTO, tail ovB into
//             HITOTSUBASHI) and (c) keeps `gap` clear of every orange line — so a shorter screen first loses spare
//             space, then shrinks the glass only as much as needed;
//   centre  = vertically, ALWAYS the middle of the two words: the glass's optical centre (OPT, below) sits on
//             (A + B) / 2, A = NOTO's drawn bottom, B = HITOTSUBASHI's drawn top (measured ink, after any squeeze) —
//             never 50vh; horizontally, centred on the screen, moved only as far as the orange lines require.
// Everything is continuous in the viewport size. DPR plays no part (it only sets the drawing-buffer resolution).
const CB = CONTOUR.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
// The optical centre of the glass: the area centroid of its outline (a fixed property of the shape). The head is broad
// and the tail thin, so it sits 3.6 % of the height above the box centre; the box centre would look low.
const OPT = (() => { let a = 0, x = 0, y = 0; for (let i = 0, j = CONTOUR.length - 1; i < CONTOUR.length; j = i++) {
  const [x0, y0] = CONTOUR[j], [x1, y1] = CONTOUR[i], c = x0 * y1 - x1 * y0; a += c; x += (x0 + x1) * c; y += (y0 + y1) * c; }
  return [x / (3 * a), y / (3 * a)]; })();
const saProbe = document.createElement('div');
saProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
stageEl.append(saProbe);
function segHitsRect(ax, ay, bx, by, r) {             // Liang–Barsky: does segment AB touch the rect [l, t, r, b]?
  if ((ax < r[0] && bx < r[0]) || (ax > r[2] && bx > r[2]) || (ay < r[1] && by < r[1]) || (ay > r[3] && by > r[3])) return false;
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  const P = [-dx, dx, -dy, dy], Q = [ax - r[0], r[2] - ax, ay - r[1], r[3] - ay];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return false; continue; }
    const t = Q[i] / P[i];
    if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function polyHits(P, r) {
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (segHitsRect(P[j][0], P[j][1], P[i][0], P[i][1], r)) return true;
  return inPoly(P, r[0], r[1]);
}
let mobFit = null;
function solveMobileObject() {
  const F = LAY.FIT;
  const ink = (n) => { const a = LAY.ANCHOR[n] || [0, 0], b = items[n].ts.ink, y = a[1] * AY + sqOf(n); return [b[0] + a[0] * AX, b[1] + y, b[2] + a[0] * AX, b[3] + y]; };
  const cs = getComputedStyle(saProbe), saT = parseFloat(cs.paddingTop) / view.s || 0, saB = parseFloat(cs.paddingBottom) / view.s || 0;
  // the region, in design px (frame coordinates; the frame is centred in the stage, AX / AY = slack)
  const top = -AY, bot = H + AY, left = -AX + F.edge, right = W + AX - F.edge;
  const nb = ink('noto')[3], ht = ink('hito')[1];
  const yT = nb - F.ovT, yB = ht + F.ovB;                                  // the band the glass spans (with its two contacts)
  const inkR = LAY.info.map(ink);
  let rects = inkR.map(r => [r[0] - F.gap, r[1] - F.gap, r[2] + F.gap, r[3] + F.gap]);
  const T0 = top + F.edge + saT, B0 = bot - F.edge - saB;
  const ch = CB[3] - CB[1], cw = CB[2] - CB[0], ccx = (CB[0] + CB[2]) / 2, ccy = (CB[1] + CB[3]) / 2;
  // vertical: the optical centre on the middle of the two words, for every size of the glass
  const mid = (nb + ht) / 2;
  const cyOf = (k) => mid - (OPT[1] - BC[1]) * k;
  // for a height h: the horizontal position nearest the screen-centred one that keeps every orange line clear
  function fit(h) {
    const k = h / BBH, cy = cyOf(k);
    if (cy + (CB[1] - BC[1]) * k < T0 - 1e-6 || cy + (CB[3] - BC[1]) * k > B0 + 1e-6) return null;   // never cut
    const P0 = CONTOUR.map(([x, y]) => [(x - BC[0]) * k, (y - BC[1]) * k]);
    const bl = (F.bleed || 0) * cw * k;                                  // allowed run-out past each side edge
    const lo = left - bl - (CB[0] - BC[0]) * k, hi = right + bl - (CB[2] - BC[0]) * k;
    if (lo > hi + 1e-6) return null;
    const pref = Math.max(lo, Math.min(hi, (left + right) / 2 - (ccx - BC[0]) * k));   // the outline's box centred
    const n = Math.ceil(Math.max(pref - lo, hi - pref) / 0.5);
    const ok = (cx) => cx >= lo - 1e-6 && cx <= hi + 1e-6 && !rects.some(r => polyHits(P0, [r[0] - cx, r[1] - cy, r[2] - cx, r[3] - cy]));
    for (let i = 0; i <= n; i++) {                                       // nearest first, alternating sides
      if (ok(pref + i * 0.5)) return { cx: pref + i * 0.5, cy, h };
      if (i && ok(pref - i * 0.5)) return { cx: pref - i * 0.5, cy, h };
    }
    return null;
  }
  const hUp = Math.max(F.hMin, Math.min(F.hMax, (yB - yT) * BBH / ch, (B0 - T0) * BBH / ch));
  let sol = fit(hUp);
  if (!sol) {
    let a = F.hMin, b = hUp, ok = fit(a);
    for (let i = 0; i < 22 && ok; i++) { const m = (a + b) / 2, r = fit(m); if (r) { a = m; ok = r; } else b = m; }
    sol = ok;
  }
  // extreme screens (shorter than any phone browser in practice): the smallest glass, giving up the clear space
  // gradually rather than all at once; the orange stays readable on its layer above the glass
  for (const g of [9, 6, 3, 0]) { if (sol) break; rects = inkR.map(r => [r[0] - g, r[1] - g, r[2] + g, r[3] + g]); sol = fit(F.hMin); }
  if (!sol) {
    const h = F.hMin, k = h / BBH, lo = left - (CB[0] - BC[0]) * k, hi = right - (CB[2] - BC[0]) * k, pref = (left + right) / 2 - (ccx - BC[0]) * k;
    sol = { cx: Math.max(lo, Math.min(hi, pref)), cy: cyOf(k), h };
  }
  OBJECT.cx = sol.cx; OBJECT.cy = sol.cy; OBJECT.h = sol.h;
  bleedX = (F.bleed || 0) * cw * sol.h / BBH + F.edge;
  U.uAnchor.value.set(OBJECT.cx, OBJECT.cy);
  mobFit = { ...sol, band: [nb, ht], mid, opt: sol.cy + (OPT[1] - BC[1]) * sol.h / BBH, yT, yB, hUp, saT, saB, sq: { ...SQ } };
}

/* ------------------------------------------------------------------ desktop: the glass's size from the screen height */
// The type scales with the smaller side (s); the glass does not have to. On screens narrower than 16:9 (4:3 laptops,
// tablets held upright) s is set by the width and used to shrink the glass with it. Now the glass is at least
// DESK_FILL of the viewport height (16:9 desktops are already larger and stay as they are), as long as it keeps
// clear of the orange info; otherwise it grows only as far as that allows.
const DESK_FILL = { wide: 0.86, narrow: 0.86, upright: 0.8, gap: 10 };
function sizeDeskObject(vh) {
  const s = view.s, base = objK, upright = view.vh > view.vw, narrow = view.vw / view.vh < 1.45;
  OBJECT.cx = LAY.OBJECT.cx; OBJECT.cy = LAY.OBJECT.cy;
  const target = (upright ? DESK_FILL.upright : narrow ? DESK_FILL.narrow : DESK_FILL.wide) * vh / (OBJECT.h * s);
  if (target <= base) return;
  const g = DESK_FILL.gap / s;
  const rects = LAY.info.filter(n => items[n]).map(n => { const it = items[n], a = LAY.ANCHOR[n] || [0, 0], e = EXTRA[n] || [0, 0], b = it.ts.ink;
    const ox = a[0] * AX + e[0], oy = a[1] * AY + e[1]; return [b[0] + ox - g, b[1] + oy - g, b[2] + ox + g, b[3] + oy + g]; });
  // a size is possible if, at some horizontal position (nearest the composed one first), the outline stays on screen
  // and clear of the orange lines; returns that position
  const place = (sc) => { const k = OBJECT.h / BBH * sc, cy = OBJECT.cy;
    const P0 = CONTOUR.map(([x, y]) => [(x - BC[0]) * k, cy + (y - BC[1]) * k]);
    const ys = P0.map(q => q[1]); if (Math.min(...ys) < -AY + 6 || Math.max(...ys) > H + AY - 6) return null;
    const xs = P0.map(q => q[0]), lo = -AX + 6 - Math.min(...xs), hi = W + AX - 6 - Math.max(...xs), c0 = LAY.OBJECT.cx;
    const ok = (cx) => cx >= lo && cx <= hi && !rects.some(r => polyHits(P0, [r[0] - cx, r[1], r[2] - cx, r[3]]));
    for (let i = 0; i <= 160; i++) { for (const sg of i ? [1, -1] : [1]) { const cx = c0 + sg * i * 4; if (ok(cx)) return cx; } }
    return null; };
  let cx = place(target);
  if (cx != null) { objK = target; OBJECT.cx = cx; return; }
  let lo = base, hi = target, best = place(base);
  if (best == null) return;
  for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2, c = place(m); if (c != null) { lo = m; best = c; } else hi = m; }
  objK = lo; OBJECT.cx = best;
}
// Desktop composition on a narrow screen (4:3 / 5:4 laptops, tablets): the orange line no longer fits beside a glass of
// that size, so —
// as on the phone — the title hangs under NOTO on the left and the date stands on HITOTSUBASHI on the right.
function deskInfo(vw, vh) {
  for (const k of Object.keys(EXTRA)) delete EXTRA[k];
  if (!(vw / vh < 1.45) || !items.title || !items.date || !items.noto || !items.hito) return;
  const m = 24 / view.s, gap = 26 / view.s;
  const notoB = items.noto.ts.ink[3] - AY, hitoT = items.hito.ts.ink[1] + AY;
  const t = items.title.ts.ink, d = items.date.ts.ink;          // title anchor [1, 0], date anchor [-1, 0]
  EXTRA.title = [(-AX + m) - (t[0] + AX), (notoB + gap) - t[1]];
  EXTRA.date = [(W + AX - m) - (d[2] - AX), (hitoT - gap) - d[3]];
}

/* ------------------------------------------------------------------ layout */
// layout source of truth: the size of the fixed, full-viewport stage as laid out (clientWidth / clientHeight are
// untransformed, so the stage's own blur-scale never leaks in). Falls back to innerWidth only if it has no box yet.
function viewport() { return [stageEl.clientWidth || innerWidth, stageEl.clientHeight || innerHeight]; }
let mobileHeroPane = false;
function syncHeroPane() {
  // Keep the original 100svh opening. Once it has finished, the HERO follows Safari's visible pane.
  // Ignore pinch zoom: zooming must not recompose the poster.
  const vv = window.visualViewport;
  if (mobileHeroPane && vv && Math.abs(vv.scale - 1) >= 0.01) return false;
  const mobile = pickLayout(innerWidth, innerHeight) === MOB;
  const height = mobileHeroPane && mobile ? (vv && Math.abs(vv.scale - 1) < 0.01 ? vv.height : innerHeight) : 0;
  const css = height ? `${height}px` : '';
  if (stageEl.style.height === css) return false;
  stageEl.style.height = css; return true;
}
function layout() {
  const [vw, vh] = viewport();
  const want = pickLayout(vw, vh);
  if (want !== LAY) { setLayout(want); buildAll(); }
  // type scale: the reference composition (1600 x 900) fitted to the smaller side, clamped for very small / very large
  // screens. Nothing is letterboxed: the outer letters are pinned to the edges they touch, so spare height or width
  // only opens the space between them (the orange line and the object stay on the centre).
  const s = LAY === MOB ? Math.max(0.8, Math.min(1.25, vw / W)) : Math.max(0.5, Math.min(1.35, vw / W, vh / H));
  view = { s, ox: (vw - W * s) / 2, oy: (vh - H * s) / 2, vw, vh };
  AX = view.ox / s; AY = view.oy / s;
  // the object follows the smaller side; where there is height to spare (16:10, 4:3) it may grow up to 4% beyond the
  // type, never past ~95% of the viewport height and never into the orange line
  objK = LAY === MOB ? 1 : Math.max(1, Math.min(1.04, (vh / H) / s));
  if (LAY === DESK) { bleedX = 0; deskInfo(vw, vh); }
  design.style.transform = hinfo.style.transform = `translate(${view.ox}px, ${view.oy}px) scale(${s})`;
  if (LAY === MOB && items.noto) {
    const Z = LAY.SQZ;
    const hn = items.noto.ts.ink[3] - items.noto.ts.ink[1], hh = items.hito.ts.ink[3] - items.hito.ts.ink[1];
    SQ.t = items.noto.ts.ink[1] + Z.cropT * hn;
    SQ.b = H - items.hito.ts.ink[3] + Z.cropB * hh;
    computeIntroMaps(); lastApplied = -1;                                       // the opening letters land on the moved words
    solveMobileObject();
  } else { SQ.t = SQ.b = 0; if (LAY.BANDS && items.noto) { computeIntroMaps(); lastApplied = -1; } if (items.noto) sizeDeskObject(vh); }
  // the only allocations: drawing buffer + optical copy, at DPR
  renderer.setPixelRatio(DPR); renderer.setSize(vw, vh, false);
  optical.width = Math.round(vw * DPR); optical.height = Math.round(vh * DPR);
  if (opticalTex) opticalTex.dispose();
  opticalTex = new THREE.CanvasTexture(optical); opticalTex.colorSpace = THREE.SRGBColorSpace; opticalTex.generateMipmaps = false; opticalTex.minFilter = THREE.LinearFilter;
  U.tBg.value = opticalTex;
  // refraction may only read inside the drawn page, 3 px in from its edges
  const ix = 3 / vw, iy = 3 / vh;
  U.uSafe.value.set(ix, iy, 1 - ix, 1 - iy);
  opticalDirty = true;
  if (items.noto) { lastCtl = ''; writeItems(); placeObject(); ROOM.up = Math.max(0, lastBBox[1] + AY - 8); ROOM.down = Math.max(0, H + AY - 8 - lastBBox[3]); }
  applyQuality();
}
// full: the whole buffer.  low: a 0.5x region in its bottom-left corner, shown through a CSS scale (the stage is blurred)
function applyQuality() {
  const vw = view.vw, vh = view.vh, Wb = renderer.domElement.width, Hb = renderer.domElement.height;
  let w = Wb, h = Hb;
  if (quality === 'low') { w = Math.max(2, Math.round(vw * 0.5)); h = Math.max(2, Math.round(vh * 0.5)); }
  PR = w / vw;
  renderer.setViewport(0, 0, w / DPR, h / DPR);
  cv.style.transformOrigin = '0 100%';
  cv.style.transform = quality === 'low' ? `scale(${(Wb / w).toFixed(5)},${(Hb / h).toFixed(5)})` : '';
  U.uRes.value.set(w, h); U.uOrigin.value.set(view.ox * PR, view.oy * PR); U.uScale.value = view.s * PR; U.uSoft.value = 0.5 * PR;
  if (lastBBox) placeObject();
}

/* ------------------------------------------------------------------ the intro, as a pure function of time */
let introMaps = {};
// The phone opening's three bands, in frame coordinates. One glyph height for all three words: the region is split into
// three equal bands (with a hair of gap), and each word's measured INK box is mapped onto its band — so the drawn glyphs
// (not their line boxes) are exactly the band height, and each word is squeezed horizontally to the screen width
// (scale y is the same for all three; only scale x differs: NOTO a little, MEETS more, HITOTSUBASHI most).
function openingBands() {
  const Z = LAY.BANDS, top = -AY, bot = H + AY, Hr = bot - top;
  const g = Math.max(Z.gapMin, Z.gap * Hr), h = (Hr - 2 * g) / 3;
  const Ws = W + 2 * AX, l = -AX - Ws * Z.crop, r = W + AX + Ws * Z.crop;
  // WebKit's canvas cannot use the DOM's width axis. Scaling its ink side bearings by the advance ratio
  // leaves different optical gaps for N, M and H; compensate at the mapped band in viewport proportions.
  const lag = !canvasInkLag ? [0, 0, 0] : LAY === DESK ? [0.023, 0.019, 0.015] : [0.015, 0.015, 0.015];
  return { noto: [l - Ws * lag[0], r, top, top + h], meets: [l - Ws * lag[1], r, top + h + g, top + 2 * h + g],
    hito: [l - Ws * lag[2], r, bot - h, bot], h, gap: g };
}
function computeIntroMaps() {
  // map the resting ink boxes onto the Phase 1 bands
  const ltrb = ([l, r, t, b]) => [l, t, r, b];
  if (LAY.BANDS) {
    // phone: the ink boxes onto the bands (minus each item's edge anchor, which writeItems adds back)
    const B = openingBands(), sh = (b, n) => { const a = LAY.ANCHOR[n] || [0, 0]; return [b[0] - a[0] * AX, b[2] - a[1] * AY, b[1] - a[0] * AX, b[3] - a[1] * AY]; };
    introMaps.noto = boxMap(items.notoO.ts.ink, sh(B.noto, 'notoO'));
    introMaps.hito = boxMap(items.hitoO.ts.ink, sh(B.hito, 'hitoO'));
    introMaps.meets = boxMap(items.meets.ts.ink, sh(B.meets, 'meets'));
    introMaps.bands = B;
  } else {
    introMaps.noto = LAY.INTRO ? boxMap(items.notoO.ts.ink, ltrb(LAY.INTRO.noto)) : ID.slice();
    introMaps.hito = LAY.INTRO ? boxMap(items.hitoO.ts.ink, ltrb(LAY.INTRO.hito)) : ID.slice();
    introMaps.meets = null;
  }
  // the opening letters travel onto the hero's letters (ink box to ink box), then hand over under the white flash
  const dy = (b, d) => [b[0], b[1] + d, b[2], b[3] + d];
  introMaps.notoEnd = boxMap(items.notoO.ts.ink, dy(items.noto.ts.ink, sqOf('noto')));
  introMaps.hitoEnd = boxMap(items.hitoO.ts.ink, dy(items.hito.ts.ink, sqOf('hito')));
}
function applyTimeline(t) {
  const sNoto = outExpo(seg(t, T.noto)), sMeets = outExpo(seg(t, T.meets)), sHito = outExpo(seg(t, T.hito));
  const settle = inOutCubic(seg(t, T.settle)), squeeze = inCubic(seg(t, T.squeeze));
  // NOTO / HITOTSUBASHI: slide in, then relax from the band into their resting place (same letters, released)
  const slide = (m, dx) => [m[0], m[1], m[2], m[3], m[4] + dx, m[5]];
  items.notoO.m = mix6(slide(introMaps.noto, -(1 - sNoto) * (W + 120)), introMaps.notoEnd, settle);
  items.hitoO.m = mix6(slide(introMaps.hito, -(1 - sHito) * (W + 120)), introMaps.hitoEnd, settle);
  // handover inside the white flash: the opening letters leave first, then the hero's letters arrive (never both)
  const out_ = clamp01((t - 2.28) / 0.22), in_ = outCubic(clamp01((t - 2.52) / 0.30));
  items.notoO.o = t < T.noto[0] ? 0 : 1 - out_; items.hitoO.o = t < T.hito[0] ? 0 : 1 - out_;
  items.noto.o = in_; items.hito.o = in_; items.noto.m = ID; items.hito.m = ID;
  // MEETS: in from the right, then squeezed into the object's centre and gone
  const c = [OBJECT.cx, OBJECT.cy], k = lerp(1, 0.18, squeeze), ky = lerp(1, 0.06, squeeze);
  const mx = (1 - sMeets) * (W + 120);
  const M0 = introMaps.meets;                       // phone: MEETS set into its band first
  items.meets.m = M0 ? [k * M0[0], 0, 0, ky * M0[3], k * M0[4] + c[0] - c[0] * k + mx * (1 - squeeze), ky * M0[5] + c[1] - c[1] * ky]
                     : [k, 0, 0, ky, c[0] - c[0] * k + mx * (1 - squeeze), c[1] - c[1] * ky];
  items.meets.o = t < T.meets[0] ? 0 : 1 - clamp01((t - 2.30) / 0.22);
  // info: last, quietly
  const inf = outCubic(seg(t, T.info));
  for (const n of LAY.info) { items[n].o = inf; items[n].m = [1, 0, 0, 1, 0, (1 - inf) * 8]; }
  // paper flash and the glass
  const f = seg(t, T.flash), fl = Math.sin(Math.PI * f) * (f < 0.5 ? 1 : 1) ;
  flash.style.opacity = (0.62 * Math.pow(fl, 1.4)).toFixed(3);
  U.uReveal.value = outCubic(seg(t, T.form));
  writeItems();
}

/* ------------------------------------------------------------------ cursor: light leans, glass gives a little (viscous) */
const spr = (k) => ({ x: 0, y: 0, vx: 0, vy: 0, w: k });
const lagLight = spr(11), lagGlass = spr(6.8), lagNear = spr(5);         // light answers first; the heavy sculpture follows later (inertia)
function stepSpring(p, tx, ty, dt) {          // critically damped
  const w = p.w, ax = w * w * (tx - p.x) - 2 * w * p.vx, ay = w * w * (ty - p.y) - 2 * w * p.vy;
  p.vx += ax * dt; p.vy += ay * dt; p.x += p.vx * dt; p.y += p.vy * dt;
}
let live = 0;      // 0 during the intro, 1 once the object has formed
// A hard sculpture of liquid glass, not a creature. Hierarchy:
//   light / reflections / refraction (largest) > whole-object drift + tilt (small, inertial) > shape (never deformed)
const REST_L = [-0.32, -0.42];          // the poster's light: from the upper left
// A heavy liquid-glass sculpture floating in space. Light answers first, the body follows ~0.3 s later, both settle
// without bounce. Shape is never deformed.
const MOVE = { x: 31, y: 33, tiltX: 4.8, tiltY: 3.1, rz: 1.4, scale: 0.014 };   // +20% (a little more answer, same character)
   // design px, degrees, scale gain
function updateCursor(dt) {
  const cur = field;
  const px = cur.in ? Math.max(-1, Math.min(1, (cur.x - W / 2) / (W / 2))) : 0;
  const py = cur.in ? Math.max(-1, Math.min(1, (cur.y - H / 2) / (H / 2))) : 0;
  // proximity to the sculpture (0 far .. 1 on it): it comes a hair closer when the pointer comes near
  const near = cur.in ? 1 - Math.min(1, Math.max(0, (Math.hypot(cur.x - OBJECT.cx, cur.y - OBJECT.cy) - 120) / 520)) : 0;
  // critically damped springs (no overshoot). body: half-response ~0.25 s, settles in ~0.6 s; light: quicker
  lagGlass.w = cur.in ? 6.8 : 6.0; lagLight.w = cur.in ? 11 : 7.5; lagNear.w = 5;
  stepSpring(lagLight, px, py, dt); stepSpring(lagGlass, px, py, dt); stepSpring(lagNear, near, 0, dt);
  const lv = live * (1 - ctl.calm);
  const gx = lagGlass.x * lv, gy = lagGlass.y * lv, lx = lagLight.x * lv, ly = lagLight.y * lv, nr = lagNear.x * lv;
  const D = Math.PI / 180;
  // 1 body: drift towards the pointer, turn to face it (ay: right -> faces right, ax: up -> tips up), a little roll,
  //   and come slightly closer when near
  // vertical travel is soft-limited by the room left above / below the tall sculpture (it never leaves the frame)
  const room = gy < 0 ? ROOM.up : ROOM.down, want = gy * MOVE.y;
  const dyv = room > 0 ? Math.sign(want) * room * Math.tanh(Math.abs(want) / room) : 0;
  // scroll pressure (Step 1): the sculpture leans back a little, as if the page were being pushed upward
  const pre = ctl.pre * live;
  placeObject(gx * MOVE.x, dyv - pre * Math.min(10, ROOM.up), gx * MOVE.rz * D, (gy * MOVE.tiltX + pre * 3 + ctl.turn) * D, -gx * MOVE.tiltY * D, objK * (1 + MOVE.scale * nr));
  // 2 light: leans hard towards the pointer — the optical layer moves more than the body
  const lean = Math.min(1, Math.hypot(lx, ly) * 1.8);
  U.uL.value.set(REST_L[0] + (lx * 0.7 - REST_L[0]) * lean * 0.7, REST_L[1] + (ly * 0.8 - REST_L[1]) * lean * 0.7, 0.7);
  // the pause before the conversion: the light comes round to the front (it gathers on the centre line)
  U.uL.value.set(lerp(U.uL.value.x, 0, ctl.gather), lerp(U.uL.value.y, 0.05, ctl.gather), 0.7).normalize();
  U.uFade.value = ctl.fade; U.uBeam.value = ctl.beam;
  U.uBeamY.value = (lastBBox[1] + lastBBox[3]) / 2; U.uBeamW.value = lerp(70, 6, ctl.beam);
  U.uLive.value = live;
  // 3 speculars slide far across the surface; reflection bands flow as a whole; refraction leans with the view
  U.uHlOff.value.set(-lx * 22, -ly * 32);       // vertical travel of the light a little larger: the sculpture is tall
  U.uSlide.value.set(lx * 15, ly * 20);
  U.uRefrTilt.value.set(lx * 5, ly * 5);
}

/* ------------------------------------------------------------------ frame (driven by the page's single loop) */
let lastApplied = -1, lastCtl = '', frameN = 0;
// adaptive: measured once, in the first 2 s of the settled hero. If it runs slower than ~45 fps the resolution is
// lowered one step (1.25) — two (1.0) if below ~30 fps — but only once per session, never raised again, and applied
// only while the stage is hidden (after the hero), so the glass never visibly changes resolution.
let measured = 0, ema = 1 / 60, decided = false, pendingDPR = 0;
function adapt(dt) {
  if (decided) return;
  ema += (dt - ema) * 0.1; measured += dt;
  if (measured < 2) return;
  decided = true;
  if (ema > 1 / 45 && DPR > 1) pendingDPR = Math.max(1, ema > 1 / 30 ? 1 : DPR - 0.25);
}
function setQuality(q) { if (q === quality) return; quality = q; applyQuality(); }
// idle-time prewarm: exercise the low-resolution path once (same program, same buffer) without presenting it
function prewarm() {
  if (ctl.hidden) return;
  const q = quality;
  quality = 'low'; applyQuality(); if (opticalDirty) { drawOptical(); opticalTex.needsUpdate = true; opticalDirty = false; } renderer.render(scene, camera);
  quality = q; applyQuality(); renderer.render(scene, camera);
}
let t0 = performance.now(), manualT = 0, opticalDirty = true;
const heroTime = (now) => MANUAL ? manualT : (now - t0) / 1000;
let holdFrom = -1;
function heroStep(now, dt, draw = true) {
  // the glass maps are still loading: the opening rests on its full frame (all three words) until they arrive
  if (!texReady && !MANUAL && started0) {
    const tt = heroTime(now);
    if (tt > T.hold) { if (holdFrom < 0) holdFrom = now; if (now - holdFrom < HOLD_MAX * 1000) t0 = now - T.hold * 1000; }
  }
  const t = heroTime(now);
  mobileHeroPane = t >= T.end;
  if (syncHeroPane()) layout();
  // (lastApplied is set first: the refracted copy's redraw check must see the time being applied, not the previous one)
  const tc = Math.min(t, T.end); if (tc !== lastApplied) { lastApplied = tc; applyTimeline(tc); }
  const sig = JSON.stringify([ctl.pre.toFixed(4), ctl.exit, ctl.typeFade.toFixed(3)]);
  if (sig !== lastCtl) { lastCtl = sig; writeItems(); }
  live = clamp01((t - T.form[1] + 0.25) / 0.6);
  updateCursor(dt);
  U.uTime.value = REDUCED ? 0 : t;
  cv.style.visibility = ctl.hidden ? 'hidden' : 'visible';
  frameN++;
  if (!MANUAL && quality === 'full' && !ctl.hidden && ctl.calm < 0.01 && t > T.end + 1) adapt(dt);
  // statements: half rate (the stage is blurred, its motion is 18% of the hero's)
  const skip = quality === 'low' && !MANUAL && (frameN & 1);
  if (!ctl.hidden && draw && !skip) {
    if (opticalDirty) { drawOptical(); opticalTex.needsUpdate = true; opticalDirty = false; }
    renderer.render(scene, camera);
  }
  replay.classList.toggle('on', t > T.end && ctl.exit.noto === 0 && ctl.pre < 0.05);
  return t;
}
let started0 = false;
function start(skipIntro) { started0 = true; t0 = performance.now() - (skipIntro ? (T.end + 0.1) * 1000 : 0); manualT = skipIntro ? T.end + 0.1 : 0; replay.classList.remove('on'); lastApplied = -1; }
replay.addEventListener('click', () => start(false));

/* ------------------------------------------------------------------ boot */
await Promise.all(['900 100px Archivo', '700 100px Archivo'].map(f => document.fonts.load(f)).concat(document.fonts.load('700 100px "Noto Sans JP"', '出張輪島朝市一橋祭in'), document.fonts.load('900 100px "Noto Sans JP"', '出張輪島朝市一橋祭in'))).catch(() => {});
await document.fonts.ready;
function setLayout(L) { LAY = L; W = L.W; H = L.H; OBJECT = { ...L.OBJECT }; }
function buildAll() {
  const want = new Set(['hito', 'noto', 'hitoO', 'notoO', 'meets', ...LAY.info]);
  for (const k of Object.keys(items)) if (!want.has(k)) { items[k].el.remove(); delete items[k]; }
  buildItem('hito', LAY.REST.hito); buildItem('noto', LAY.REST.noto);
  buildItem('hitoO', LAY.OPEN.hito); buildItem('notoO', LAY.OPEN.noto);
  if (LAY.midLine) {
    buildItem('meets', LAY.INTRO.meets);
    // the orange line: centre lines on the middle of the gap between NOTO and HITOTSUBASHI (measured ink, not boxes)
    const midY = (items.noto.ts.ink[3] + items.hito.ts.ink[1]) / 2;
    for (const k of ['date', 'title']) { const it = LAY.REST[k]; it.box[2] = midY - it.h / 2; it.box[3] = midY + it.h / 2; buildItem(k, it); }
    window.__midY = midY;
  } else {
    // mobile opening: MEETS centred between the opening NOTO and HITOTSUBASHI
    LAY.MEETS.yc = (items.notoO.ts.ink[3] + items.hitoO.ts.ink[1]) / 2;
    buildItem('meets', LAY.MEETS);
    for (const k of LAY.info) buildItem(k, LAY.REST[k]);
  }
  computeIntroMaps(); lastApplied = -1; lastCtl = '';
}
const ROOM = { up: 0, down: 0 };
{ const [vw0, vh0] = viewport(); setLayout(pickLayout(vw0, vh0)); }
buildAll(); placeObject(); layout();
ROOM.up = Math.max(0, lastBBox[1] + AY - 8); ROOM.down = Math.max(0, H + AY - 8 - lastBBox[3]);
window.__room = ROOM;
const layoutCbs = [];
let layouts = 0, typesets = 1;
function relayout() { layouts++; layout(); layoutCbs.forEach(f => f(view)); }
// one face arriving late (slow network, a fallback swapped out) re-sets the type: widths are measured again
const typeSig = () => ['noto', 'hito', ...LAY.info].map(k => domAdvance(items[k].it, 100, items[k].it.runs.map(r => r[0]).join('')).toFixed(1)).join('|');
let lastTypeSig = typeSig();
document.fonts.addEventListener('loadingdone', () => { const sig = typeSig(); if (sig !== lastTypeSig) { lastTypeSig = sig; typesets++; buildAll(); relayout(); } });
// resize: the stage is fixed and full-viewport, so its box IS the visible pane (iframe / artifact pane / window).
// Re-laid out at most every 120 ms while the size is moving, and once more when it settles.
let rlLast = 0, rlT = 0;
function scheduleLayout() {
  syncHeroPane();
  const now = performance.now(); clearTimeout(rlT);
  if (now - rlLast > 120) { rlLast = now; relayout(); } else rlT = setTimeout(() => { rlLast = performance.now(); relayout(); }, 120);
}
if ('ResizeObserver' in window) new ResizeObserver(scheduleLayout).observe(stageEl);
else addEventListener('resize', scheduleLayout, { passive: true });
window.visualViewport?.addEventListener('resize', () => {
  if (mobileHeroPane && Math.abs(window.visualViewport.scale - 1) < 0.01) scheduleLayout();
}, { passive: true });
start(REDUCED || qs.has('skip'));

export const hero = {
  step: heroStep, start, T, items, ready: texLoad, MANUAL, REDUCED, setQuality, prewarm, layoutName: () => LAY.name,
  // called by the page while the stage is hidden: the one moment a decided resolution change may be applied
  hiddenTick: () => { if (pendingDPR && pendingDPR < DPR) { DPR = pendingDPR; pendingDPR = 0; layout(); } },
  res: () => ({ DPR, PR, quality, decided, pendingDPR }),
  bands: () => introMaps.bands && { ...introMaps.bands },
  diag: () => ({ view: { ...view }, AX, AY, objK, layouts, typesets, canvasR: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, +v.ts.r.toFixed(3)])) }),
  time: () => heroTime(performance.now()),
  seek: (t) => { manualT = t; },
  view: () => view,
  onLayout: (f) => layoutCbs.push(f),
  bbox: () => lastBBox.slice(),
  fit: () => mobFit && { ...mobFit },
  // the projected outline in client px (checks only)
  outline: () => { const v = view, o = OBJECT, k = o.h / BBH * objK; return CONTOUR.map(([x, y]) => [v.ox + (o.cx + (x - BC[0]) * k) * v.s, v.oy + (o.cy + (y - BC[1]) * k) * v.s]); },
};
