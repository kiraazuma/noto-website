// Draws a typographic-object layout (layout.json) as one SVG. Shared by the page (typo-index.js) and the generator
// tool. Every character is positioned explicitly, so the composition is the same in every browser; the five INDEX
// anchors are real links (<a href="#asaichi"> …) with a hit area matching what is drawn.
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderSVG(layout, { fonts, tones, labels = {}, pad = 40 } = {}) {
  const [bx, by, bw, bh] = layout.view || [0, 0, 1180, 1475];
  const parts = [], anchors = [];
  const fontAttr = (fk) => { const f = fonts[fk]; return `font-family='${f.family.replace(/"/g, '')}' font-weight="${f.weight}"${f.stretch ? ` style="font-stretch:${f.stretch}"` : ''}`; };
  for (const it of layout.items) {
    let el;
    if (it.k === 'h') {
      el = `<text class="tx-t" ${fontAttr(it.font)} font-size="${it.size}" transform="matrix(${it.m.join(' ')})" x="${it.xs.join(' ')}" y="${it.y}">${esc(it.text)}</text>`;
    } else if (it.k === 'p') {
      const ch = [...it.text];
      el = `<g class="tx-t" ${fontAttr(it.font)} font-size="${it.size}" text-anchor="middle" dominant-baseline="central">` +
        ch.map((c, i) => `<text transform="translate(${it.pts[i][0]} ${it.pts[i][1]}) rotate(${it.rot[i]})">${esc(c)}</text>`).join('') + '</g>';
    } else {
      const xs = it.pts.map(p => p[0]).join(' '), ys = it.pts.map(p => p[1]).join(' ');
      el = `<text class="tx-t" ${fontAttr(it.font)} font-size="${it.size}" text-anchor="middle" dominant-baseline="central" x="${xs}" y="${ys}">${esc(it.text)}</text>`;
    }
    if (it.anchor) {
      // hit area = the drawn type's box
      let hit;
      if (it.k === 'h') {
        const n = it.xs.length, len = it.xs[n - 1] + (it.xs[n - 1] - (it.xs[n - 2] ?? 0) || it.size);
        hit = `<rect class="tx-hit" transform="matrix(${it.m.join(' ')})" x="${-it.size * 0.12}" y="${-it.size * 0.12}" width="${len + it.size * 0.24}" height="${it.size * 1.24}"/>`;
      } else {
        const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]), s = it.size / 2;
        const px = Math.max(s * 1.24, it.size * 0.8);             // narrow vertical words get a wider target
        hit = `<rect class="tx-hit" x="${Math.min(...xs) - px}" y="${Math.min(...ys) - s * 1.24}" width="${Math.max(...xs) - Math.min(...xs) + px * 2}" height="${Math.max(...ys) - Math.min(...ys) + s * 2.48}"/>`;
      }
      const lab = labels[it.anchor] || it.text;
      anchors.push(`<a class="tx-a" href="#${it.anchor}" data-id="${it.anchor}" aria-label="${esc(lab)}" style="--tone:${tones[it.tone]}">${hit}${el}</a>`);
    } else parts.push(`<g fill="${tones[it.tone]}">${el}</g>`);
  }
  // body type first, anchors on top (in INDEX order for keyboard focus)
  const order = ['asaichi', 'program', 'noto', 'support', 'info'];
  anchors.sort((a, b) => order.indexOf(a.match(/data-id="(\w+)"/)[1]) - order.indexOf(b.match(/data-id="(\w+)"/)[1]));
  return `<svg class="tx-svg" xmlns="${NS}" viewBox="${bx - pad} ${by - pad} ${bw + pad * 2} ${bh + pad * 2}" focusable="false">` +
    `<g class="tx-body" aria-hidden="true">${parts.join('')}</g><g class="tx-anchors">${anchors.join('')}</g></svg>`;
}
