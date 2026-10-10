// INDEX as a typographic object (html[data-index="typo"]). Draws the prebuilt layout (layout.json, made by
// tools/typo-generate.html) into #summary .tx-stage. The five large words are links to the INDEX items (#asaichi …);
// main.js opens the item's existing content when one is clicked. The selected word alone turns orange (CSS .is-open),
// following whichever INDEX item is open.
import { renderSVG } from './render.js';
import { CONFIG } from './config.js';
import { SECTIONS } from './words.js';

export async function mountTypo(root) {
  const stage = root.querySelector('.tx-stage');
  const res = await fetch(new URL('./layout.json', import.meta.url));
  if (!res.ok) throw new Error('layout.json ' + res.status);
  const layout = await res.json();
  layout.view = layout.view || [0, 0, 1180, 1475];
  const labels = Object.fromEntries(Object.entries(SECTIONS).map(([id, s]) => [id, `${s.anchor}（${s.en}）`]));
  stage.innerHTML = renderSVG(layout, { fonts: CONFIG.fonts, tones: CONFIG.tones, labels, pad: 40 });
  const anchors = [...stage.querySelectorAll('.tx-a')];
  for (const a of anchors) { a.setAttribute('aria-controls', 'p-' + a.dataset.id); a.setAttribute('aria-expanded', 'false'); }
  // the selected word follows the open INDEX item
  const index = document.getElementById('index');
  const sync = () => {
    const open = index.querySelector('.item.open');
    for (const a of anchors) { const on = !!open && open.id === a.dataset.id; a.classList.toggle('is-open', on); a.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  };
  new MutationObserver(sync).observe(index, { subtree: true, attributes: true, attributeFilter: ['class'] });
  sync();
  return { anchor: (id) => anchors.find(a => a.dataset.id === id) || null };
}
