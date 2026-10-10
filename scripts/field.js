// Pointer input for the sculpture only. Nothing else on the page follows the pointer.
// raw pointer (this file: client px -> design px, stored as the target) -> critically damped springs in hero.js
// (smoothed) -> object. The handler does no layout reads and no rendering; it only stores numbers.
export const field = {
  x: 800, y: 450, in: false,          // target pointer in hero design px (1600 x 900 frame)
  cx: 0, cy: 0,                       // raw client px
};

let toDesign = (x, y) => [x, y];
export function bindField(fn) { toDesign = fn; }

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;          // phones: the sculpture does not follow the finger
  field.cx = e.clientX; field.cy = e.clientY;
  const [x, y] = toDesign(e.clientX, e.clientY);
  field.x = x; field.y = y; field.in = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { field.in = false; });
addEventListener('blur', () => { field.in = false; });

export function stepField() {}
export function syncScroll() {}
export function setPointer(cx, cy, inside, toD) {
  field.cx = cx; field.cy = cy;
  const [x, y] = toD ? toD(cx, cy) : toDesign(cx, cy); field.x = x; field.y = y; field.in = inside;
}
