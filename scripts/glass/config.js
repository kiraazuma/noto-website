// Art direction for the glass INDEX (index.html INDEX_MODE = 'glass'). Five words only, as soft glass tubes.
// Units: 1 = one em of the typeface. Edit here; nothing else needs to change for a new arrangement.
export const GLASS = {
  font: 'noto',                    // assets/glass/glyphs.json: noto (Noto Sans JP Black) | mplus | zen | dela  (?gxfont=)
  tracking: -0.07,                 // between the two characters of a word (em)

  // ---- the glass tube (scripts/glass/tube.js; font units, 1000 = 1 em): every stroke gets a round cross-section.
  // round: corner radius; maxHalf: the widest stroke half width counted; flat: depth of the tube (1 = a full circle);
  // unitsPerPx / grid: raster and mesh resolution (smaller = finer and heavier)
  tube: { round: 34, maxHalf: 95, flat: 0.95, unitsPerPx: 5, grid: 2 },

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

  // ---- glass: pale sky blue in the middle of a tube, cobalt toward its rims; haze = how milky (frosted) it is;
  // rim = how quickly the colour deepens toward the rim (lower = more of the deep colour)
  glass: {
    ivory: '#FCFAEF', sky: '#9CCEFB', blue: '#1F4FE4', skyOrange: '#FFB283', orange: '#FD5500',
    haze: 0.36, rim: 1.2, ior: 1.33, refract: 0.8, fresnel: 0.8,
  },
  hover: { lift: 0.12, scale: 0.025 },

  // ---- motion: the whole block floats; each word only a little on its own; the pointer tilts it slightly
  float: { bob: 0.07, bobHz: 0.075, tilt: 2.0, tiltHz: 0.05, sway: 2.6, swayHz: 0.037, word: 0.008, wordRot: 0.35, pointer: 3.5 },
  // ---- transitions (seconds)
  time: { tint: 0.32, exit: 0.7, move: 0.9, content: 0.45, back: 0.85 },
};
