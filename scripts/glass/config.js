// Art direction for the glass INDEX (index.html INDEX_MODE = 'glass'). Five words only, as soft glass tubes.
// Units: 1 = one em of the typeface. Edit here; nothing else needs to change for a new arrangement.
// an upright column: words centred on x = 0, `pitch` em apart, the middle word at y = 0
function col(...a) {
  const pitch = a.pop(), n = a.length;
  return a.map(([id, text], i) => ({ id, text, x: 0, y: ((n - 1) / 2 - i) * pitch, z: 0, s: 1, r: [0, 0, 0] }));
}
export const GLASS = {
  font: 'noto',                    // assets/glass/glyphs.json: noto (Noto Sans JP Black) | mplus | zen | dela  (?gxfont=)
  tracking: -0.07,                 // between the two characters of a word (em)

  // ---- the letters' volume (scripts/glass/tube.js; font units, 1000 = 1 em). profile 'liquid': liquid glass poured
  // into the letter — round across narrow strokes, levelling off at `half` on wide ones. round: outer corners rounded;
  // fill: inner corners / notches filled (the strokes flow into each other); smooth: passes relaxing the surface;
  // unitsPerPx / grid: raster and mesh resolution (smaller = finer and heavier)
  tube: { profile: 'liquid', half: 130, flat: 1.0, round: 40, fill: 8, smooth: 3, maxHalf: 110, unitsPerPx: 5, grid: 2 },

  // ---- the cluster. x / y: centre of the word (em), z: depth, s: size, r: [x, y, z] rotation (deg)
  // desktop: two rows — 朝市 催し above (a little larger), 能登 応援 案内 below — one near-rectangular block
  // one upright column, centred on one axis, top to bottom: 催し 朝市 能登 応援 案内. Every word the same size, no tilt,
  // the same step from one to the next (pitch, em). The order is also the keyboard order (index.html).
  layout: {
    desk: col(['program', '催し'], ['asaichi', '朝市'], ['noto', '能登'], ['support', '応援'], ['info', '案内'], 1.13),
    phone: col(['program', '催し'], ['asaichi', '朝市'], ['noto', '能登'], ['support', '応援'], ['info', '案内'], 1.1),
  },
  // the whole block's resting turn in space [x, y] (deg): a little from below and from the side, so the tubes read as volume
  pose: { desk: [0, 0], phone: [0, 0] },
  // how much of the screen the cluster takes (fraction of width / height, whichever binds first)
  fit: { desk: { w: 0.5, h: 0.7, cy: 0.0 }, phone: { w: 0.5, h: 0.5, cy: -0.02 } },
  // where the selected word goes in the detail view (fraction of the screen) and how wide it is
  detail: { desk: { x: 0.235, y: 0.56, w: 0.3, h: 0.4 }, phone: { x: 0.5, y: 0.27, w: 0.5, h: 0.17 } },
  camera: { fov: 24 },

  // ---- glass: clear glass, faintly tinted. tint: the colour the ivory page takes through tRef of glass (thicker =
  // deeper); f0: reflectance facing the viewer; env: strength of the reflected room (the Hero's studio colours);
  // rough: a slightly soft surface (0 = mirror sharp)
  glass: {
    ivory: '#FCFAEF', tint: '#9EC0EE', tintOrange: '#FBC7A2', tRef: 0.25,
    ior: 1.5, refract: 1.4, f0: 0.04, env: 1.0, rough: 0.04,
    wave: 0.6, waveFreq: 2.6,                // the liquid swell of the surface: strength, frequency (per em)
  },
  hover: { lift: 0.12, scale: 0.025 },
  // ---- the plain physical glass (engine 'lab', default): the NOTO Glass Lab's MeshTransmissionMaterial, the studio it
  // reflects, and how strongly the glass is tinted. tint: absorption colour (faint sky blue); tintDistance: how far
  // light travels before taking it (larger = clearer); thickness: front / back refraction depth (world units, 1 = 1 em)
  engine: 'lab',
  lab: {
    samples: 6, ior: 1.5, roughness: 0.0, ca: 0.04, env: 2.0,          // the Glass Lab's v1 values (ior, roughness, CA, env)
    frontThickness: 0.7, backThickness: 0.35,                          // the Lab's 1.2 / 0.6, scaled to a letter's em
    tint: '#9CC4F0', tintOrange: '#F7A35C', tintDistance: 2.0, bodyOrange: '#FFE3CC',
    rimDepth: 1.2,        // the tint deepens toward the rims (longer path through the glass): clear centre, blue edges
    core: 0.55,           // the bright centre: how much light the face of the glass carries over the type it refracts
    distortion: 0, distortionScale: 0.6, temporal: 0,
    bgZ: -1.2,
    room: '#8f8e87',
    reflectors: [
      { color: '#ffffff', intensity: 4.0, size: [5, 2.6], pos: [-2.6, 4.2, 3.0] },
      { color: '#0130E2', intensity: 1.0, size: [6, 6], pos: [4.2, 0.6, 1.0] },
      { color: '#3C5424', intensity: 1.0, size: [6, 4], pos: [-3.6, -3.0, 0.6] },
      { color: '#FD5500', intensity: 1.6, size: [0.6, 0.6], pos: [2.6, -2.4, 3.0] },
    ],
    // which 2D type the glass refracts (CSS selector inside the section's sticky frame)
    optics: '.gx-title, .gx-meta, .gx-prog, .gx-adm, .gx-run, .gx-big, .gx-mega',
  },

  // ---- motion: the whole block floats; each word only a little on its own; the pointer tilts it slightly
  float: { bob: 0.05, bobHz: 0.07, tilt: 0.5, tiltHz: 0.05, sway: 0.7, swayHz: 0.037, word: 0, wordRot: 0, pointer: 1.4 },
  // ---- transitions (seconds)
  time: { tint: 0.32, exit: 0.7, move: 0.9, content: 0.45, back: 0.85 },
};
