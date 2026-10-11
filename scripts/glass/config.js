// Art direction for the glass INDEX (index.html INDEX_MODE = 'glass'). Five words only, as soft glass tubes.
// Units: 1 = one em of the typeface. Edit here; nothing else needs to change for a new arrangement.
export const GLASS = {
  font: 'noto',                    // assets/glass/glyphs.json: noto (Noto Sans JP Black) | mplus | zen | dela  (?gxfont=)
  tracking: -0.07,                 // between the two characters of a word (em)

  // ---- the letters' volume (scripts/glass/tube.js; font units, 1000 = 1 em). profile 'slab': solid glass of thickness
  // 2 × half, shoulders rounded with radius `shoulder`, a gentle crown (share) along each stroke; ('tube': round tubes).
  // round: corner radius of the outline; unitsPerPx / grid: raster and mesh resolution (smaller = finer and heavier)
  tube: { profile: 'slab', half: 125, shoulder: 90, crown: 0.36, round: 30, maxHalf: 95, flat: 0.95, unitsPerPx: 5, grid: 2 },

  // ---- the cluster. x / y: centre of the word (em), z: depth, s: size, r: [x, y, z] rotation (deg)
  // desktop: two rows — 朝市 催し above (a little larger), 能登 応援 案内 below — one near-rectangular block
  // one block: words close together (they may just touch), a little in front of / behind each other
  layout: {
    desk: [
      { id: 'asaichi', text: '朝市', x: -1.30, y: 0.56, z: 0.12, s: 1.3, r: [-5, 9, 1.0] },
      { id: 'program', text: '催し', x: 1.28, y: 0.6, z: -0.10, s: 1.3, r: [-4, -8, -1.2] },
      { id: 'noto', text: '能登', x: -1.8, y: -0.62, z: -0.06, s: 0.96, r: [5, 10, -0.8] },
      { id: 'support', text: '応援', x: 0.02, y: -0.66, z: 0.18, s: 0.96, r: [6, 1, 0.6] },
      { id: 'info', text: '案内', x: 1.84, y: -0.62, z: -0.08, s: 0.96, r: [5, -10, -0.6] },
    ],
    // phones (portrait): three rows, 4 / 4 / 2 characters, the last word a little larger
    phone: [
      { id: 'asaichi', text: '朝市', x: -0.95, y: 1.06, z: 0.08, s: 0.98, r: [-4, 7, 0.6] },
      { id: 'program', text: '催し', x: 0.95, y: 1.08, z: -0.1, s: 0.98, r: [-3, -7, -0.6] },
      { id: 'noto', text: '能登', x: -0.95, y: 0.06, z: -0.05, s: 0.98, r: [3, 7, -0.5] },
      { id: 'support', text: '応援', x: 0.95, y: 0.04, z: 0.12, s: 0.98, r: [4, -7, 0.5] },
      { id: 'info', text: '案内', x: 0.0, y: -1.06, z: 0.04, s: 1.24, r: [5, 0, 0] },
    ],
  },
  // the whole block's resting turn in space [x, y] (deg): a little from below and from the side, so the tubes read as volume
  pose: { desk: [-9, 11], phone: [-8, 9] },
  // how much of the screen the cluster takes (fraction of width / height, whichever binds first)
  fit: { desk: { w: 0.66, h: 0.58, cy: 0.0 }, phone: { w: 0.9, h: 0.5, cy: 0.02 } },
  // where the selected word goes in the detail view (fraction of the screen) and how wide it is
  detail: { desk: { x: 0.25, y: 0.5, w: 0.3, h: 0.44 }, phone: { x: 0.5, y: 0.19, w: 0.6, h: 0.22 } },
  camera: { fov: 24 },

  // ---- glass: clear glass, faintly tinted. tint: the colour the ivory page takes through tRef of glass (thicker =
  // deeper); f0: reflectance facing the viewer; env: strength of the reflected room (the Hero's studio colours);
  // rough: a slightly soft surface (0 = mirror sharp)
  glass: {
    ivory: '#FCFAEF', tint: '#C4DAF2', tintOrange: '#FBC7A2', tRef: 0.25,
    ior: 1.5, refract: 1.4, f0: 0.12, env: 1.0, rough: 0.04,
    wave: 0.46, waveFreq: 3.0,                // the liquid swell of the surface: strength, frequency (per em)
  },
  hover: { lift: 0.12, scale: 0.025 },

  // ---- motion: the whole block floats; each word only a little on its own; the pointer tilts it slightly
  float: { bob: 0.07, bobHz: 0.075, tilt: 2.0, tiltHz: 0.05, sway: 2.6, swayHz: 0.037, word: 0.008, wordRot: 0.35, pointer: 3.5 },
  // ---- transitions (seconds)
  time: { tint: 0.32, exit: 0.7, move: 0.9, content: 0.45, back: 0.85 },
};
