// =====================================================================
// THE FORGOTTEN VILLAGE — NOTA DE LA CAIXA-PISTA (Fase D.3): text + tres símbols pixel-art (Campana → Lluna → Creu)
// =====================================================================
// Capa DOM sense interacció (pointer-events: none): no afecta el pointer lock. Es mostra/amaga amb setVisible().
import { SYMBOL_BITMAPS, SYMBOL_NAMES } from '../world/cryptSymbols.js';
import { FONT_PIXEL, TEXT_MIN, PIXEL_GRID, createArrow } from './theme.js'; // Fase D.6: font única

export function createNoteView(def, parent = document.body) {
  const box = document.createElement('div');
  box.style.cssText = `
    position: fixed; left: 50%; top: 38%; transform: translate(-50%, -50%); display: none;
    padding: 20px 28px 16px; width: max-content; max-width: min(600px, 92vw); box-sizing: border-box; text-align: center; pointer-events: none; user-select: none;
    background: #cdbd96; color: #2b2013; border: 3px solid #5a4630; border-radius: 3px;
    box-shadow: 0 0 40px rgba(0,0,0,0.7); font-family: ${FONT_PIXEL}; font-synthesis: none; font-size: ${PIXEL_GRID}px; line-height: 1.25;
  `;
  const text = document.createElement('div');
  text.textContent = `"${def.clue.text.replace(/^[\u00ab"]|[\u00bb"]$/g, '')}"`;
  box.appendChild(text);
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; justify-content: center; align-items: center; gap: 22px; margin-top: 16px;';
  def.clue.order.forEach((name, i) => {
    const bmp = SYMBOL_BITMAPS[name]; const S = 8;
    const c = document.createElement('canvas');
    c.width = bmp[0].length; c.height = bmp.length;
    c.style.cssText = `width: ${c.width * S}px; height: ${c.height * S}px; image-rendering: pixelated;`;
    c.title = SYMBOL_NAMES[name];
    const ctx = c.getContext('2d');
    if (ctx) { ctx.fillStyle = '#2b2013'; bmp.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); })); }
    row.appendChild(c);
    if (i < def.clue.order.length - 1) row.appendChild(createArrow(document, { width: 40, height: 16 }));
  });
  box.appendChild(row);
  const foot = document.createElement('div');
  foot.textContent = 'E - tancar la nota';
  foot.style.cssText = `margin-top: 12px; font-size: ${TEXT_MIN}px; line-height: 1.1; opacity: 0.7;`;
  box.appendChild(foot);
  parent.appendChild(box);
  let shown = false;
  return {
    element: box,
    setVisible(v) { if (v !== shown) { shown = v; box.style.display = v ? 'block' : 'none'; } },
    isVisible: () => shown,
  };
}
