// Glass-tube letters: a glyph's outline becomes a soft, inflated body whose strokes have a round cross-section —
// as if a glass tube had been run along each stroke — instead of a flat outline pushed into depth.
//
// 1. the glyph is drawn into a small raster (real font outline, Path2D)
// 2. its corners are rounded (morphological opening: shrink, then grow back by `round`)
// 3. a distance field gives, everywhere inside, the distance d to the edge, and w — the half width of the stroke there
//    (the largest d nearby, i.e. the stroke's centre line value)
// 4. the surface height is a circle across the stroke: h = sqrt(d (2w − d)) — zero at the edge, w on the centre line —
//    mirrored front and back, so every stroke is a round tube; where strokes meet, the body swells a little
// 5. the mesh is built on a grid (marching squares for a smooth silhouette); front and back meet at the edge, so the
//    normals there turn sideways like a real tube's
import * as THREE from 'three';

export function tubeGeometry(d, opt) {
  const { upm, emMid, adv, unitsPerPx: S = 4, grid: GS = 2, round = 28, maxHalf = 90, flat = 0.9, asc, desc } = opt;
  const pad = round + 40;
  const x0 = -pad, x1 = adv + pad, y0 = desc - pad, y1 = asc + pad;
  const W = Math.ceil((x1 - x0) / S), H = Math.ceil((y1 - y0) / S);
  // 1 raster (y down in the raster, y up in the font)
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.setTransform(1 / S, 0, 0, -1 / S, -x0 / S, y1 / S); g.fillStyle = '#000'; g.fill(new Path2D(d), 'nonzero');
  const px = g.getImageData(0, 0, W, H).data;
  let inside = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) inside[i] = px[i * 4 + 3] > 127 ? 1 : 0;
  // 2 round the corners: keep what is farther than r from the edge, then grow it back by r
  const r = round / S;
  if (r > 0.5) {
    const dIn = edt(inside, W, H, 0);                       // distance to outside, for inside pixels
    const core = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) core[i] = dIn[i] > r ? 1 : 0;
    const dCore = edt(core, W, H, 1);                       // distance to the core, for pixels outside it
    for (let i = 0; i < W * H; i++) inside[i] = core[i] || dCore[i] <= r ? 1 : 0;
  }
  // 3 signed distance (px; + inside) and the local half width
  const dI = edt(inside, W, H, 0), dO = edt(inside, W, H, 1);
  let sd = new Float32Array(W * H); for (let i = 0; i < W * H; i++) sd[i] = inside[i] ? dI[i] - 0.5 : -(dO[i] - 0.5);
  sd = blur(blur(sd, W, H, 1), W, H, 1);                     // a smooth surface (no raster steps in the light)
  const half = blur(blur(localThickness(dI, W, H, maxHalf / S), W, H, 3), W, H, 3);   // smooth: no creases where strokes meet
  // 4/5 mesh: grid nodes every GS px; marching squares for the cut cells; vertex tables instead of string keys
  const N = Math.floor((W - 1) / GS), M = Math.floor((H - 1) / GS), NN = N + 1;
  const val = new Float32Array(NN * (M + 1)), hgt = new Float32Array(NN * (M + 1));
  for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) {
    const k = (j * GS) * W + i * GS, dd = Math.max(0, sd[k]) * S, w = Math.max(dd, half[k] * S);
    val[j * NN + i] = sd[k]; hgt[j * NN + i] = Math.sqrt(Math.max(0, dd * (2 * w - dd))) * flat;
  }
  const cF = new Int32Array(NN * (M + 1)).fill(-1), cB = new Int32Array(NN * (M + 1)).fill(-1);
  const eH = new Int32Array(NN * (M + 1)).fill(-1), eV = new Int32Array(NN * (M + 1)).fill(-1);
  const pos = [], idx = [];
  const push = (x, y, z) => { pos.push((x0 + x * S) / upm, (y1 - y * S - emMid) / upm, z / upm); return pos.length / 3 - 1; };
  const corner = (i, j, side) => { const k = j * NN + i, T = side > 0 ? cF : cB; if (T[k] < 0) T[k] = push(i * GS, j * GS, hgt[k] * side); return T[k]; };
  const edgeV = (ai, aj, bi, bj) => {                         // the point where the edge (a, b) crosses the outline
    const va = val[aj * NN + ai], vb = val[bj * NN + bi], t = va / (va - vb);
    const horiz = aj === bj, k = horiz ? aj * NN + Math.min(ai, bi) : Math.min(aj, bj) * NN + ai, T = horiz ? eH : eV;
    if (T[k] < 0) T[k] = push((ai + (bi - ai) * t) * GS, (aj + (bj - aj) * t) * GS, 0);
    return T[k];
  };
  const ci = [0, 1, 1, 0], cj = [0, 0, 1, 1], pf = [], pb = [];
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
    const v0 = val[j * NN + i], v1 = val[j * NN + i + 1], v2 = val[(j + 1) * NN + i + 1], v3 = val[(j + 1) * NN + i];
    if (v0 <= 0 && v1 <= 0 && v2 <= 0 && v3 <= 0) continue;
    const vv = [v0, v1, v2, v3]; pf.length = 0; pb.length = 0;
    for (let k = 0; k < 4; k++) {
      const ai = i + ci[k], aj = j + cj[k], bi = i + ci[(k + 1) % 4], bj = j + cj[(k + 1) % 4], va = vv[k], vb = vv[(k + 1) % 4];
      if (va > 0) { pf.push(corner(ai, aj, 1)); pb.push(corner(ai, aj, -1)); }
      if ((va > 0) !== (vb > 0)) { const e = edgeV(ai, aj, bi, bj); pf.push(e); pb.push(e); }   // front and back meet at the edge
    }
    for (let k = 1; k + 1 < pf.length; k++) { idx.push(pf[0], pf[k + 1], pf[k]); idx.push(pb[0], pb[k], pb[k + 1]); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingBox();
  return geo;
}

const clampI = (x, a, b) => x < a ? a : x > b ? b : x;

// exact Euclidean distance transform (Felzenszwalb & Huttenlocher). target = 0: distance (px) from each pixel of the
// set to the nearest pixel outside it; target = 1: distance from each pixel outside the set to the nearest one inside
function edt(mask, W, H, target) {
  const INF = 1e20, f = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = (target === 0 ? !mask[i] : mask[i]) ? 0 : INF;
  const n = Math.max(W, H), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), fl = new Float64Array(n);
  function pass(len, start, stride) {
    for (let q = 0; q < len; q++) fl[q] = f[start + q * stride];
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      if (fl[q] >= INF && fl[v[k]] >= INF) { continue; }
      let s = ((fl[q] + q * q) - (fl[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((fl[q] + q * q) - (fl[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; f[start + q * stride] = dq * dq + fl[v[k]]; }
  }
  for (let x = 0; x < W; x++) pass(H, x, W);
  for (let y = 0; y < H; y++) pass(W, y * W, 1);
  const out = new Float32Array(W * H); for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(f[i]); return out;
}
// local thickness: for every inside pixel, the radius of the largest inscribed disc that covers it (the stroke's
// half width there). Discs are stamped from the centre lines (ridge pixels of the distance field) only.
function localThickness(D, W, H, rMax) {
  const O = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) O[i] = D[i];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, r = D[i]; if (r < 1) continue;
    if (r < D[i - 1] || r < D[i + 1] || r < D[i - W] || r < D[i + W]) continue;     // not on a centre line
    const R = Math.min(r, rMax), R2 = R * R, ri = Math.ceil(R);
    for (let dy = -ri; dy <= ri; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue;
      for (let dx = -ri; dx <= ri; dx++) { const xx = x + dx; if (xx < 0 || xx >= W || dx * dx + dy * dy > R2) continue; const k = yy * W + xx; if (O[k] < R) O[k] = R; } }
  }
  return O;
}
// box blur (separable), radius r px
function blur(A, W, H, r) {
  const T = new Float32Array(W * H), O = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { let acc = 0, n = 0; const row = y * W;
    for (let x = -r; x < W + r; x++) {
      if (x + r < W) { acc += A[row + x + r]; n++; }
      if (x - r - 1 >= 0) { acc -= A[row + x - r - 1]; n--; }
      if (x >= 0 && x < W) T[row + x] = acc / n;
    } }
  for (let x = 0; x < W; x++) { let acc = 0, n = 0;
    for (let y = -r; y < H + r; y++) {
      if (y + r < H) { acc += T[(y + r) * W + x]; n++; }
      if (y - r - 1 >= 0) { acc -= T[(y - r - 1) * W + x]; n--; }
      if (y >= 0 && y < H) O[y * W + x] = acc / n;
    } }
  return O;
}
