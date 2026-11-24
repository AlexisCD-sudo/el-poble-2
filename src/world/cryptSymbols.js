// =====================================================================
// THE FORGOTTEN VILLAGE — SÍMBOLS DE LA CRIPTA (Fase D.3): campana, lluna, creu i sol en pixel-art (dades pures, sense Three.js)
// =====================================================================
// Els fan servir: els discs de l'altar, la tapa de la caixa-pista (village.js) i la nota que es mostra en examinar-la (src/ui/noteView.js).
// '#' = píxel pintat. Les mides en píxels són les de cada mapa de bits.
// =====================================================================
export const SYMBOL_BITMAPS = {
  bell: ['...#...', '..###..', '.#####.', '.#####.', '.#####.', '.#####.', '#######', '...#...'],
  moon: ['..####.', '.###...', '###....', '###....', '###....', '###....', '.###...', '..####.'],
  cross: ['...#...', '...#...', '#######', '...#...', '...#...', '...#...', '...#...', '...#...', '...#...'],
  // Fase E: símbol de la clau del mausoleu (només inventari/menú; NO és a SYMBOL_ORDER: no entra a l'atles ni als discs de la cripta)
  bells3: ['.#...#...#.', '###.###.###', '###.###.###', '.#...#...#.'],
  sun: ['....#....', '.#.....#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#.....#.', '....#....'],
};
export const SYMBOL_ORDER = ['bell', 'moon', 'cross', 'sun'];
export const SYMBOL_NAMES = { bell: 'Campana', moon: 'Lluna', cross: 'Creu', sun: 'Sol' };

// Atles d'una fila (1 píxel de separació): nom → [x, y, w, h] (y cap avall).
export const SYMBOL_CELLS = (() => {
  const cells = {}; let x = 0;
  for (const name of SYMBOL_ORDER) { const b = SYMBOL_BITMAPS[name]; cells[name] = [x, 0, b[0].length, b.length]; x += b[0].length + 1; }
  return cells;
})();
export const SYMBOL_ATLAS_SIZE = (() => {
  const w = Math.max(...Object.values(SYMBOL_CELLS).map(([x, , cw]) => x + cw));
  const h = Math.max(...Object.values(SYMBOL_CELLS).map(([, , , ch]) => ch));
  return [w, h];
})();

// Pinta l'atles (blanc amb alfa; el color final el posa el vèrtex de cada peça).
export function paintSymbols(px) {
  for (const name of SYMBOL_ORDER) {
    const [cx, cy] = SYMBOL_CELLS[name];
    SYMBOL_BITMAPS[name].forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') px(cx + c, cy + r, 0xffffff); }));
  }
}
