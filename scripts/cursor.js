// CIRCULAR HOVER — one colour/motion language for the whole site (index.html CUR_MODE or ?cursor=):
//   off     the page as it was (the system cursor; INDEX words turn orange by a plain colour change)
//   fill    from where the system cursor entered, the type turns orange in a growing circle (the glyphs themselves
//           are the mask — background-clip:text with a radial gradient, no copy of the text); leaving, it shrinks back
//   a/b/c   fill + a one-shot on the five INDEX words, played once, the moment the word is entirely orange:
//           a Squash & Pop  ·  b Tilt & Bounce  ·  c Spin & Settle
//   random  fill + one of a/b/c each time (never the same twice in a row)
// Rules for the one-shot: it plays when the circle has filled the word (not on entering, not on moving); never again
// while the pointer stays; only after leaving and coming back; not if the pointer leaves before the word is full; a
// press cancels it (the INDEX's own open motion has the word). It moves the word's inner type (.kx-in / .kx-ch), never
// the box the INDEX engine places and transforms, and always ends exactly at rest.
// Fine pointers that can hover only (no circle on touch). prefers-reduced-motion: no one-shot (the circle stays:
// it is a colour change).

// ---- timing and strength (s / multipliers). The panel (CUR_PANEL) edits these live.
export const CUR = {
  fillIn: 0.3,       // the circle growing over the word
  fillOut: 0.24,     // and shrinking back out
  speed: 1,          // one-shot speed (2 = twice as fast)
  strength: 1,       // one-shot amplitude
  photo: { duration: 0.15 }, // seconds, starting at the circle-full trigger alongside the one-shot
  shots: {
    a: { name: 'Squash & Pop', dur: 0.48 },
    b: { name: 'Tilt & Bounce', dur: 0.56 },
    c: { name: 'Spin & Settle', dur: 0.52, stagger: 0.06 },
  },
};
const MAIN = '.kx-w';                                                          // the INDEX words (with a one-shot)
const MINOR = '#foot a, .kx-back, .gx-back, #replay, .s-cue, .kx-body a, .gx-body a';  // the other main links / buttons

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MANUAL = new URLSearchParams(location.search).has('manual');   // tests / recordings: main.js steps the clock
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; } return Y(clamp(t, 0, 1)); };
}
const E_IN = bezier(0.5, 0, 0.25, 1);    // the circle: gathers, then fills to the last corner crisply (the "full" moment)
const E_OUT = bezier(0.22, 1, 0.36, 1);  // shrinking out: the house curve

export function initCursor() {
  const html = document.documentElement;
  let mode = html.dataset.cur || 'off';
  if (!['off', 'fill', 'a', 'b', 'c', 'random'].includes(mode)) mode = 'off';

  const fillOn = () => mode !== 'off' && FINE.matches;
  function applyMode() {
    html.dataset.cur = mode;
    html.classList.toggle('cf-mode', fillOn());  // circular colour change on hover
  }

  // ---------------------------------------------------------------- targets
  const T = new Map();        // element -> state
  function target(el) {
    let t = T.get(el); if (t) return t;
    const main = el.matches(MAIN);
    t = { el, main, inner: main ? el.querySelector('.kx-in') : null, layers: main ? [...el.querySelectorAll('.kx-ch')] : [el],
      phase: 'idle', t: 0, r: 0, r0: 0, R: 1, x: 0, y: 0, ex: 0, ey: 0, sx: 0, sy: 0, fired: false, anims: [], k: '',
      pointerHovered: false, photoShown: false, photoTicket: 0, photoReady: null };
    T.set(el, t); return t;
  }
  // Only these two kinetic words have photographic glyphs. Preload on pointer entry, not during the Hero.
  const photoWord = t => t.main && ['asaichi', 'noto'].includes(t.el.dataset.id);
  function preparePhotos(t) {
    if (!photoWord(t) || t.photoReady) return;
    t.photoReady = Promise.all(t.layers.map(l => {
      if (!l.dataset.photo) return false;
      l.style.setProperty('--kx-photo', `url("${new URL(l.dataset.photo, document.baseURI).href}")`);
      const image = new Image(); image.src = l.dataset.photo;
      return image.decode().then(() => true, () => false);
    })).then(ready => (t.photosDecoded = ready.every(Boolean)));
  }
  function hidePhotos(t) {
    t.photoTicket++; t.photoShown = false; t.el.classList.remove('kx-photo-on', 'kx-photo-sync');
  }
  const photoEligible = t => photoWord(t) && !REDUCED && fillOn() && t.pointerHovered && t.phase === 'full'
    && t.el.getAttribute('aria-expanded') !== 'true' && (window.__kx?.rest ? window.__kx.rest() : true);
  function revealPhotos(t) {
    const eligible = () => photoEligible(t);
    if (!eligible() || !t.photoReady) return;
    const ticket = t.photoTicket;
    t.photoReady.then(ready => {
      // A late image/animation completion must never repaint a word after leave, press or opening.
      if (!ready || ticket !== t.photoTicket || !eligible()) return;
      t.photoShown = true; t.el.classList.add('kx-photo-on');
    });
  }
  function syncPhotos(t, motions, running, done) {
    if (!photoEligible(t) || !t.photoReady) return;
    const ticket = t.photoTicket;
    const start = ready => {
      if (!ready || ticket !== t.photoTicket || t.anims !== running || !photoEligible(t)
        || motions.every(m => m.playState === 'finished')) return;
      // Both photographs start at the circle-full trigger, alongside the first motion (no C stagger).
      // Animate only the pseudo-layer opacity. It inherits the existing character/word transforms.
      t.photoShown = true; t.el.classList.add('kx-photo-on', 'kx-photo-sync');
      const motion = motions[0];
      t.layers.forEach(layer => {
        const fade = layer.animate([
          { opacity: 0 }, { opacity: 1 },
        ], { pseudoElement: '::after', duration: CUR.photo.duration * 1000, easing: 'linear', fill: 'both' });
        // Image.decode may finish after motion start: join its timeline at the current position.
        if (MANUAL) { fade.pause(); fade.currentTime = motion.currentTime || 0; }
        else if (motion.startTime != null) fade.startTime = motion.startTime;
        else fade.currentTime = motion.currentTime || 0;
        fade.onfinish = done; running.push(fade);
      });
    };
    if (t.photosDecoded) start(true); else t.photoReady.then(start);
  }
  // the element's own (untransformed) box, and a client point in it
  function local(t, cx, cy) {
    const box = t.main ? t.inner : t.el, r = box.getBoundingClientRect();
    const k = r.width / (box.offsetWidth || r.width || 1) || 1;
    return { x: (cx - r.left) / k, y: (cy - r.top) / k, w: box.offsetWidth, h: box.offsetHeight };
  }
  function begin(t, cx, cy) {
    const L = cx == null ? null : local(t, cx, cy);
    const box = t.main ? t.inner : t.el, w = box.offsetWidth, h = box.offsetHeight;
    // where it starts: the pointer (or the middle, for keyboard focus); a fresh hover always starts from nothing
    // (coming back while it is still shrinking: it grows again from where it is, no jump)
    if (t.phase === 'idle') t.r = 0;
    if (t.phase !== 'out' || t.r < 1) { t.x = L ? clamp(L.x, 0, w) : w / 2; t.y = L ? clamp(L.y, 0, h) : h / 2; }
    t.R = Math.max(Math.hypot(t.x, t.y), Math.hypot(w - t.x, t.y), Math.hypot(t.x, h - t.y), Math.hypot(w - t.x, h - t.y)) + 2;
    t.r0 = t.r; t.t = 0; t.phase = 'in'; t.fired = false;
    t.entry = L ? Math.sign(L.x - w / 2) || 1 : 1;
    if (!t.on) {
      const base = getComputedStyle(t.layers[0]).color;
      // character offsets inside the word (each character carries its own circle, so each can move on its own)
      t.off = t.layers.map(l => t.main ? { x: l.offsetLeft - t.inner.offsetLeft, y: l.offsetTop - t.inner.offsetTop } : { x: 0, y: 0 });
      for (const l of t.layers) { l.style.setProperty('--cfb', base); l.classList.add('cf-on'); }
      t.on = true;
    }
    kick();
  }
  function end(t, cx, cy) {
    t.pointerHovered = false;
    const hadPhoto = t.photoShown; hidePhotos(t);
    if (hadPhoto || photoWord(t)) { stop(t); clear(t); return; } // cancel even during the 150ms crossfade
    if (t.phase === 'idle') return;
    if (cx != null) { const L = local(t, cx, cy); t.ex = L.x; t.ey = L.y; } else { t.ex = t.x; t.ey = t.y; }
    t.sx = t.x; t.sy = t.y; t.r0 = t.r; t.t = 0; t.phase = 'out'; kick();
  }
  function clear(t) {
    hidePhotos(t); t.pointerHovered = false;
    // back to the element's own colour at once (its own colour transition would fade the type in from transparent)
    for (const l of t.layers) { l.style.transition = 'none'; l.classList.remove('cf-on'); for (const p of ['--cfx', '--cfy', '--cfr', '--cfb']) l.style.removeProperty(p); }
    void t.layers[0].offsetWidth; getComputedStyle(t.layers[0]).color;
    for (const l of t.layers) l.style.transition = '';
    t.on = false; t.phase = 'idle'; t.r = 0; t.k = '';
  }
  function draw(t) {
    const key = `${t.x.toFixed(1)},${t.y.toFixed(1)},${t.r.toFixed(1)}`; if (key === t.k) return; t.k = key;
    t.layers.forEach((l, i) => { const o = t.off[i]; l.style.setProperty('--cfx', (t.x - o.x).toFixed(1) + 'px'); l.style.setProperty('--cfy', (t.y - o.y).toFixed(1) + 'px'); l.style.setProperty('--cfr', t.r.toFixed(1) + 'px'); });
  }

  // ---------------------------------------------------------------- the loop (only while a circle moves)
  let raf = 0, last = 0;
  function kick() { if (!raf && !MANUAL) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; raf = 0; if (tick(dt)) raf = requestAnimationFrame(frame); }
  function tick(dt) {
    let busy = false;
    for (const t of T.values()) {
      if (t.phase === 'in') {
        t.t += dt; const k = clamp(t.t / Math.max(0.01, CUR.fillIn), 0, 1);
        t.r = t.r0 + (t.R - t.r0) * E_IN(k);
        if (k >= 1) { t.r = t.R; t.phase = 'full'; if (t.main && !t.fired) { t.fired = true; if (!shot(t)) revealPhotos(t); } }
        else busy = true;
        draw(t);
      } else if (t.phase === 'out') {
        t.t += dt; const k = clamp(t.t / Math.max(0.01, CUR.fillOut), 0, 1), e = E_OUT(k);
        t.r = t.r0 * (1 - e); t.x = t.sx + (t.ex - t.sx) * e; t.y = t.sy + (t.ey - t.sy) * e;
        if (k >= 1) clear(t); else { busy = true; draw(t); }
      }
    }
    // (manual clock: the one-shots are paused and advanced here)
    if (MANUAL) for (const t of T.values()) for (const a of t.anims) { if (a.playState === 'finished') continue; a.currentTime = (a.currentTime || 0) + dt * 1000; const tm = a.effect.getComputedTiming(); if (a.currentTime >= tm.endTime) a.finish(); }
    return busy;
  }

  // ---------------------------------------------------------------- the one-shots (Web Animations on the inner type)
  let lastShot = '';
  const canShot = (t) => !REDUCED && ['a', 'b', 'c', 'random'].includes(mode) && t.el.getAttribute('aria-expanded') !== 'true' && (window.__kx?.rest ? window.__kx.rest() : true);
  function shot(t) {
    if (!canShot(t)) return false;
    let s = mode;
    if (s === 'random') { const pool = ['a', 'b', 'c'].filter(x => x !== lastShot); s = pool[Math.floor(Math.random() * pool.length)]; }
    lastShot = s;
    stop(t);
    const S = CUR.shots[s], dur = S.dur * 1000 / CUR.speed, k = CUR.strength, h = t.inner.offsetHeight;
    if (s === 'a') {
      // Squash & Pop: a short squash (wider, lower), a pop past the rest size, a small settle — volume kept, centre kept
      t.inner.style.transformOrigin = '50% 62%';
      t.anims.push(t.inner.animate([
        { transform: 'scale(1, 1)', easing: 'cubic-bezier(.3, 0, .5, 1)' },
        { transform: `scale(${1 + 0.07 * k}, ${1 - 0.11 * k})`, offset: 0.22, easing: 'cubic-bezier(.25, 0, .3, 1)' },
        { transform: `scale(${1 - 0.03 * k}, ${1 + 0.06 * k})`, offset: 0.54, easing: 'cubic-bezier(.3, 0, .4, 1)' },
        { transform: `scale(${1 + 0.012 * k}, ${1 - 0.01 * k})`, offset: 0.8 },
        { transform: 'scale(1, 1)' },
      ], { duration: dur }));
    } else if (s === 'b') {
      // Tilt & Bounce: a quick tilt toward where the pointer came from, a lifted swing back past upright, a last nod
      const deg = -clamp(7.5 - (h - 100) * 0.012, 3.2, 7.5) * k * t.entry;   // toward the way the pointer was going
      t.inner.style.transformOrigin = '50% 100%';
      t.anims.push(t.inner.animate([
        { transform: 'rotate(0deg) translateY(0)', easing: 'cubic-bezier(.3, 0, .3, 1)' },
        { transform: `rotate(${deg}deg) translateY(${-0.03 * h * k}px)`, offset: 0.26, easing: 'cubic-bezier(.4, 0, .3, 1)' },
        { transform: `rotate(${-0.45 * deg}deg) translateY(0)`, offset: 0.58, easing: 'cubic-bezier(.4, 0, .4, 1)' },
        { transform: `rotate(${0.14 * deg}deg) translateY(0)`, offset: 0.82 },
        { transform: 'rotate(0deg) translateY(0)' },
      ], { duration: dur }));
    } else {
      // Spin & Settle: each character turns once about its own upright axis (a coin, not a wheel: the word keeps its
      // footprint), one after the other, fast out and settling square
      t.layers.forEach((l, i) => {
        l.style.transformOrigin = '50% 50%';
        t.anims.push(l.animate([
          { transform: 'perspective(1200px) rotateY(0deg)' },
          { transform: 'perspective(1200px) rotateY(360deg)' },
        ], { duration: dur, delay: i * S.stagger * 1000 / CUR.speed, easing: 'cubic-bezier(.22, .9, .3, 1)' }));
      });
    }
    if (MANUAL) for (const a of t.anims) a.pause();
    played(s, t);
    const running = t.anims;
    const motions = running.slice();
    const done = () => {
      if (t.anims !== running || !running.every(a => a.playState === 'finished')) return;
      // The synchronized layer already holds opacity 1. Never schedule a new fade after motion completion.
      stop(t);
    };
    for (const a of t.anims) a.onfinish = done;
    syncPhotos(t, motions, running, done);
    return true;
  }
  function stop(t) { for (const a of t.anims) a.cancel(); t.anims = []; if (t.inner) t.inner.style.transformOrigin = ''; for (const l of t.layers) l.style.transformOrigin = ''; }

  // ---------------------------------------------------------------- events
  const isTarget = (el) => el && el.closest && el.closest(MAIN + ',' + MINOR);
  document.addEventListener('pointerover', (e) => {
    if (!fillOn() || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
    const el = isTarget(e.target); if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;            // moving inside it
    const t = target(el); hidePhotos(t); t.pointerHovered = true;
    if (!REDUCED) preparePhotos(t);
    begin(t, e.clientX, e.clientY);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const el = isTarget(e.target); if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    const t = T.get(el); if (t) end(t, e.clientX, e.clientY);
  });
  // a press: the item's own motion has the word now
  function press(e) {
    const el = isTarget(e.target), t = el && T.get(el);
    if (t) { t.pointerHovered = false; hidePhotos(t); t.fired = true; stop(t); }
  }
  document.addEventListener('pointerdown', press, true);
  document.addEventListener('click', press, true);  // keyboard activation also clears before the INDEX click listener
  // opened / closed by the INDEX: drop the circle at once (the open word is orange by its own style)
  // (all the INDEX words at once: the others leave the screen with the open motion, with no circle to repaint)
  new MutationObserver((ms) => { for (const m of ms) { const t = T.get(m.target); if (!t) continue; for (const u of t.main ? [...T.values()].filter(x => x.main) : [t]) { stop(u); clear(u); u.fired = true; } } })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
  // keyboard: the focused one fills from its middle (no one-shot)
  document.addEventListener('focusin', (e) => { if (!fillOn()) return; const el = isTarget(e.target); if (el && el.matches(':focus-visible')) { const t = target(el); begin(t); t.fired = true; } });
  document.addEventListener('focusout', (e) => { const el = isTarget(e.target); const t = el && T.get(el); if (t && !el.matches(':hover')) end(t); });
  function clearAll() { for (const t of T.values()) { stop(t); clear(t); } }
  FINE.addEventListener?.('change', () => { clearAll(); applyMode(); });
  addEventListener('blur', clearAll);

  // ---------------------------------------------------------------- switching + the comparison panel
  function setMode(m) {
    for (const t of T.values()) { stop(t); clear(t); }
    mode = m; applyMode(); panelSync();
    try { const u = new URL(location.href); u.searchParams.set('cursor', m); history.replaceState(history.state, '', u); } catch (e) { /* sandboxed */ }
  }
  let panel = null, playedEl = null;
  const NAMES = { off: 'OFF', fill: 'FILL', a: 'A', b: 'B', c: 'C', random: 'RANDOM' };
  function played(s, t) {
    const name = `${s.toUpperCase()} ${CUR.shots[s].name}`;
    html.dataset.curPlayed = s; html.dataset.curCount = String((+html.dataset.curCount || 0) + 1);
    if (playedEl) playedEl.innerHTML = `PLAYED <b>${name}</b> · ${t.el.dataset.label || ''}`;
    if (new URLSearchParams(location.search).has('curlog')) console.info('[cursor] one-shot', name, t.el.dataset.label || '');
  }
  const SL = [['fillIn', 'fill in', 0.12, 0.7, 0.01, 's'], ['fillOut', 'fill out', 0.1, 0.6, 0.01, 's'], ['speed', 'shot speed', 0.5, 2, 0.05, '×'], ['strength', 'shot amp', 0, 2, 0.05, '×']];
  if (html.dataset.curpanel === '1') {
    panel = document.createElement('div'); panel.className = 'cur-dev'; panel.setAttribute('aria-label', 'CURSOR（比較用）');
    panel.innerHTML = `<button type="button" class="cur-dev-t" aria-expanded="false">CURSOR <b></b></button><div class="cur-dev-b"><div class="cur-dev-h">CURSOR / HOVER（比較用）</div>
      <div class="cur-dev-m">${Object.keys(NAMES).map(m => `<button type="button" data-m="${m}">${NAMES[m]}</button>`).join('')}</div><div class="cur-dev-s"></div><div class="cur-dev-p">PLAYED —</div></div>`;
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m);
      if (e.target.closest('.cur-dev-t')) { const o = panel.classList.toggle('open'); panel.querySelector('.cur-dev-t').setAttribute('aria-expanded', o ? 'true' : 'false'); }
    });
    const box = panel.querySelector('.cur-dev-s');
    for (const [key, label, a, b, st, u] of SL) {
      const row = document.createElement('label'); const v = CUR[key];
      row.innerHTML = `<span>${label}</span><input type="range" min="${a}" max="${b}" step="${st}" value="${v}"><output>${v}${u}</output>`;
      const inp = row.querySelector('input'), out = row.querySelector('output');
      inp.addEventListener('input', () => { CUR[key] = parseFloat(inp.value); out.textContent = inp.value + u; });
      box.append(row);
    }
    playedEl = panel.querySelector('.cur-dev-p');
    document.body.append(panel);
  }
  function panelSync() {
    if (!panel) return;
    for (const b of panel.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', b.dataset.m === mode ? 'true' : 'false');
    panel.querySelector('.cur-dev-t b').textContent = NAMES[mode];
  }
  applyMode(); panelSync();
  return { setMode, frame: (dt) => { if (MANUAL) tick(dt); }, get mode() { return mode; }, debug: () => ({ mode, active: [...T.values()].filter(t => t.phase !== 'idle').map(t => [t.el.dataset.label || t.el.textContent.trim().slice(0, 12), t.phase, +t.r.toFixed(1), t.fired]) }) };
}
