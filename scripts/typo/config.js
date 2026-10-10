// Art direction for the typographic object (the Hero's glass silhouette rebuilt from words).
// All coordinates are in the Hero asset's base space (assets/assets.json: 1180 x 1475, outline = `contour`), so the
// object is the same shape as the glass. Edit here and re-run tools/typo-generate.html to rebuild the layout.
//
// How the object is built (in this order; later layers flow around earlier ones):
//   1 anchors   the five INDEX words, placed by hand (size, angle, writing direction)
//   2 regions   the shape is divided into parts along its own anatomy (head, neck, bay lobe, body, lower body, the
//               two tail forks). Each part is swept by bands of type running in its own direction, in its own rhythm
//               of band heights: a word is chosen and stretched / compressed so that it spans the free chord of the
//               shape at that height — so the words' ends make the outline, and their sizes make the structure
//   3 voids     a few places are deliberately left open
// The same seed always gives the same result.
export const CONFIG = {
  seed: 20261121,
  debug: false,                            // true: adds a coverage map to layout.stat (generator tool only)
  cell: 2,                                 // raster resolution for the composition (base px per cell)
  // palette: blue only; the selected anchor alone turns orange (runtime)
  tones: { deep: '#0A219C', cobalt: '#0130E2', mid: '#2F55E4', soft: '#6F8AEC', pale: '#A9BAF3' },
  fonts: {
    sans9: { family: '"Noto Sans JP"', weight: 900 },
    sans7: { family: '"Noto Sans JP"', weight: 700 },
    sans5: { family: '"Noto Sans JP"', weight: 500 },
    serif9: { family: '"Noto Serif JP"', weight: 900 },
    serif6: { family: '"Noto Serif JP"', weight: 600 },
    lat: { family: 'Archivo', weight: 900, stretch: '62.5%' },
  },
  // 1 — the five INDEX anchors. c: centre, a: angle of the reading direction (deg, 0 = left -> right, positive =
  // clockwise), size: em height, sx: horizontal stretch, v: vertical writing (characters stacked, upright)
  anchors: [
    { id: 'asaichi', text: '朝市', c: [812, 222], a: -23, size: 184, sx: 1.12, font: 'sans9' },
    { id: 'noto', text: '能登', c: [688, 714], a: 0, size: 160, sx: 1, v: true, font: 'sans9' },
    { id: 'program', text: '催し', c: [916, 632], a: 0, size: 100, sx: 1, v: true, font: 'serif9' },
    { id: 'support', text: '応援', c: [598, 1012], a: -50, size: 134, sx: 1.08, font: 'sans9' },
    { id: 'info', text: '案内', c: [262, 1196], a: -13, size: 112, sx: 1.18, font: 'serif9' },
  ],
  // 2 — the parts of the shape. seed: a polyline through the part (each cell of the shape belongs to the nearest one);
  // a: the bands' reading direction; rhythm: band heights (base px) in order, repeated; pool: whose words fill it
  regions: [
    { id: 'head', seed: [[1085, 105], [930, 160], [760, 235], [650, 300]], a: -23, pool: 'asaichi',
      rhythm: [80, 28, 18, 38, 14, 14, 110, 25, 16, 55, 32, 18, 42] },
    { id: 'neck', seed: [[615, 360], [596, 455], [612, 545]], a: -64, pool: 'asaichi',
      rhythm: [28, 16, 55, 18, 14, 38, 25] },
    { id: 'lobe', seed: [[880, 560], [930, 640], [935, 710]], a: 90, v: true, pool: 'program',
      rhythm: [50, 16, 16, 35, 12, 12, 28] },
    { id: 'body', seed: [[640, 600], [670, 720], [650, 860]], a: -6, pool: 'noto',
      rhythm: [18, 30, 72, 16, 14, 38, 120, 25, 50, 15, 32, 88, 18] },
    { id: 'lower', seed: [[650, 920], [560, 1040], [460, 1130]], a: -50, pool: 'support',
      rhythm: [38, 18, 15, 82, 28, 14, 30, 60, 16, 25] },
    { id: 'tailA', seed: [[400, 1150], [250, 1190], [80, 1255]], a: -13, pool: 'info',
      rhythm: [25, 15, 45, 18, 14, 32, 16] },
    { id: 'tailB', seed: [[330, 1250], [250, 1330], [170, 1405]], a: -56, pool: 'info',
      rhythm: [18, 38, 15, 28, 16] },
  ],
  // 3 — open places inside the object (centre, radius)
  voids: [[[742, 470], 34], [[560, 812], 28], [[478, 1078], 22]],
  // B — the coast: running text along the outline, just inside it. sizes change from stretch to stretch (base px),
  // each stretch `stretch` px long; track: letter spacing factor; inset: extra distance from the edge
  coast: [
    { start: 140, sizes: [16, 22, 14, 26, 18, 14, 30, 20, 15, 24], stretch: [60, 200], track: 0.96, inset: 0, font: 'sans9' },
  ],
  // D — the grain: band heights of the fine running text that fills what is left
  grain: [14, 17, 13, 19, 15, 13, 21],
  grainTurns: [90],                        // the grain also runs across each part (fills pockets)
  grainMin: 2.4,                           // shortest grain line (in band heights)
  lightBelow: 10,
  grainFont: 'sans9',
  halfFont: 'sans9',                       // the half-height lines beside a word
  joiner: '・',                             // between sentences in the running text
  anchorAir: 2,                            // cells of air kept around the anchors
  air: [0.8, 0.02],                       // air around every glyph: max(px, share of the size)
  leading: 0.02,                           // space between bands (share of the band height)
  overshoot: 0.3,                          // how far a band's words may run past the outline (share of its height)
  flip: 0.12,                              // share of small lines set upside down
  // typeface mix per class of type (weights): heavy gothic, light gothic, heavy / medium mincho
  fontMix: {
    big: [['sans9', 3], ['serif9', 2]],
    mid: [['sans9', 4], ['serif9', 2], ['serif6', 1], ['sans5', 1]],
  },
  // band sizes: >= big -> heading-level type; >= mid -> phrases; below -> sentence fragments
  sizes: { big: 40, mid: 20 },
  stretch: [0.62, 1.5],                    // allowed horizontal compression / expansion of a word
};
