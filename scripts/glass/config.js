// Art direction for the glass INDEX (index.html INDEX_MODE = 'glass'). Five words only, set as thick blue glass.
// Units: 1 = one em of the typeface. Edit here; nothing else needs to change for a new arrangement.
export const GLASS = {
  font: 'noto',                    // assets/glass/glyphs.json: noto (Noto Sans JP Black) | mplus | zen | dela  (?gxfont=)
  tracking: -0.04,                 // between the two characters of a word (em)

  // ---- the solid: extrusion depth and edge bevel (font units, 1000 = 1 em)
  solid: { depth: 330, bevelThickness: 46, bevelSize: 26, bevelOffset: -19, bevelSegments: 4, curveSegments: 5, crease: 30 },

  // ---- the cluster. x / y: centre of the word (em), z: depth, s: size, r: [x, y, z] rotation (deg)
  // desktop: two rows — 朝市 催し above (a little larger), 能登 応援 案内 below — one near-rectangular block
  layout: {
    desk: [
      { id: 'asaichi', text: '朝市', x: -1.52, y: 0.70, z: 0.10, s: 1.38, r: [-9, 15, 1.2] },
      { id: 'program', text: '催し', x: 1.50, y: 0.70, z: -0.14, s: 1.38, r: [-7, -13, -1.4] },
      { id: 'noto', text: '能登', x: -2.12, y: -0.80, z: -0.08, s: 1.0, r: [9, 17, -0.8] },
      { id: 'support', text: '応援', x: 0.0, y: -0.80, z: 0.16, s: 1.0, r: [11, 2, 0.8] },
      { id: 'info', text: '案内', x: 2.12, y: -0.80, z: -0.12, s: 1.0, r: [8, -16, -0.6] },
    ],
    // phones (portrait): three rows, 4 / 4 / 2 characters, the last word a little larger
    phone: [
      { id: 'asaichi', text: '朝市', x: -1.06, y: 1.30, z: 0.08, s: 1.0, r: [-3, 6, 0.6] },
      { id: 'program', text: '催し', x: 1.06, y: 1.30, z: -0.12, s: 1.0, r: [-2, -6, -0.6] },
      { id: 'noto', text: '能登', x: -1.06, y: 0.18, z: -0.06, s: 1.0, r: [2, 6, -0.5] },
      { id: 'support', text: '応援', x: 1.06, y: 0.18, z: 0.12, s: 1.0, r: [3, -6, 0.5] },
      { id: 'info', text: '案内', x: 0.0, y: -1.16, z: 0.02, s: 1.32, r: [4, 0, 0] },
    ],
  },
  // how much of the screen the cluster takes (fraction of width / height, whichever binds first)
  fit: { desk: { w: 0.6, h: 0.5, cy: 0.0 }, phone: { w: 0.84, h: 0.46, cy: 0.02 } },
  // where the selected word goes in the detail view (fraction of the screen) and how wide it is
  detail: { desk: { x: 0.25, y: 0.5, w: 0.3, h: 0.44 }, phone: { x: 0.5, y: 0.19, w: 0.6, h: 0.22 } },
  camera: { fov: 24 },

  // ---- glass (linear colour; tRef: thickness at which the glass shows exactly its tint colour)
  glass: {
    ivory: '#FCFAEF', blue: '#0130E2', orange: '#FD5500',
    tRef: 0.3, tRefOrange: 0.46, ior: 1.5, refract: 1.0, fresnel: 0.65,
  },

  // ---- motion: the whole block floats; each word only a little on its own; the pointer tilts it slightly
  float: { bob: 0.06, bobHz: 0.11, tilt: 2.2, tiltHz: 0.07, sway: 2.4, swayHz: 0.05, word: 0.018, wordRot: 0.9, pointer: 4.5 },
  // ---- transitions (seconds)
  time: { tint: 0.32, exit: 0.7, move: 0.9, content: 0.45, back: 0.85 },
};
