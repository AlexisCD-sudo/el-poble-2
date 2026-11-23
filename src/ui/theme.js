// =====================================================================
// EL POBLE — TEMA VISUAL DE LA INTERFÍCIE: UNA SOLA TIPOGRAFIA (Fase D.6)
// =====================================================================
// Pixel Monastery Script és l'ÚNICA font del joc (menús, inventari, documents, mapa, llegendes, avisos, missatges, botons, finestres i
// pantalla inicial). Fitxer LOCAL (src/assets/fonts/PixelMonasteryScript.woff): cap servei extern. Llicència i crèdit: LLICENCIES.md.
//
// Regles d'ús (les vigila tools/test-fase-d4.js):
//   · Una sola família, SENSE pila de reserva: no s'ha d'introduir cap altra tipografia com a substituta.
//   · La font té una quadrícula de 30 px: 30 px és la mida nativa (píxels exactes); 24 px és el MÍNIM per a textos petits. A 15–20 px es veu empastifada.
//   · No té «negreta» ni «cursiva»: `font-synthesis: none` impedeix que el navegador en fabriqui de falses.
//   · Escriu els números com a XIFRES ROMANES (12 → XII) i el zero surt buit: vegeu `numeral()`/`formatSavedAt()` i `inventorySummary()`.
//   · No té els signes « » — → ➤ ✕ …: es fan servir cometes rectes ("), el guionet (-) i símbols DIBUIXATS (CSS/canvas), mai caràcters de reserva.
// Aquest mòdul no toca el DOM en importar-lo: només `installTheme()` hi afegeix la regla @font-face i la regla global de la tipografia.
// =====================================================================

// `new URL('…', import.meta.url)` amb el camí LITERAL: és el que Vite reconeix per copiar l'asset a la compilació (i funciona també amb GitHub Pages).
const URLS = {
  pixel: new URL('../assets/fonts/PixelMonasteryScript.woff', import.meta.url).href,
};

// Títol «El Poble» com a IMATGE pixelada (renderitzada amb la font a la seva mida nativa de 30 px) i el seu «fantasma» vermell.
// La pantalla inicial l'amplia sempre amb un factor ENTER (image-rendering: pixelated) perquè els píxels quedin nítids.
export const TITLE_IMAGE = {
  url: new URL('../assets/title/el-poble-title.png', import.meta.url).href,
  ghostUrl: new URL('../assets/title/el-poble-ghost.png', import.meta.url).href,
  width: 85, height: 25,
};

export const FONT_FAMILY = 'Pixel Monastery Script';
export const FONT_PIXEL = `'${FONT_FAMILY}'`;      // valor per a `font-family` (sense pila de reserva, a propòsit)
export const PIXEL_GRID = 30;                      // mida nativa (px)
export const TEXT_MIN = 24;                        // mida mínima admesa per a qualsevol text de la interfície (px)

// Fitxers de font (per als tests i per a la llicència): família, pes, estil i URL.
export const FONT_FACES = [
  { family: FONT_FAMILY, weight: 400, style: 'normal', url: URLS.pixel },
];

// Paleta comuna (fusta fosca, pergamí, os, vermell sec).
export const COLORS = { bone: '#e8e0cc', boneDim: '#b9ad92', ink: '#2b2013', blood: '#7a2a22', night: '#05070d' };

// `font-display: block`: mentre la font carrega no es dibuixa cap text (així no es veu ni un instant una altra tipografia).
export function fontFaceCSS() {
  return FONT_FACES.map((f) => `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: ${f.style}; font-display: block; src: url('${f.url}') format('woff'); }`).join('\n')
    + `\nhtml, body, button, input, select, textarea { font-family: ${FONT_PIXEL}; font-synthesis: none; }`;
}

// Afegeix les regles al document (una sola vegada) i en demana la càrrega. Retorna una promesa que no falla mai.
export function installTheme(doc = document) {
  if (!doc.getElementById('fv-fonts')) {
    const style = doc.createElement('style'); style.id = 'fv-fonts'; style.textContent = fontFaceCSS(); doc.head.appendChild(style);
  }
  if (!doc.fonts || typeof doc.fonts.load !== 'function') return Promise.resolve();
  return doc.fonts.load(`400 ${PIXEL_GRID}px "${FONT_FAMILY}"`).then(() => undefined, () => undefined);
}

// Número com a text. La font el dibuixa en xifres romanes; el zero no té glif: s'escriu amb paraules («cap»).
export const numeral = (n, zero = 'cap') => (n === 0 ? zero : String(n));

// Fletxa «→» DIBUIXADA amb elements (la font no té aquest caràcter): una línia i un cap de triangle, del color del text.
export function createArrow(doc = document, { width = 34, height = 14, opacity = 0.7 } = {}) {
  const a = doc.createElement('span'); a.setAttribute('aria-hidden', 'true'); a.className = 'fv-arrow';
  a.style.cssText = `display:inline-block;position:relative;flex:none;width:${width}px;height:${height}px;opacity:${opacity};`;
  const line = doc.createElement('span'); line.style.cssText = `position:absolute;left:0;top:${Math.round(height / 2) - 1}px;width:${width - 6}px;height:2px;background:currentColor;`;
  const head = doc.createElement('span'); head.style.cssText = `position:absolute;right:0;top:0;width:0;height:0;border-left:${Math.round(height * 0.7)}px solid currentColor;border-top:${height / 2}px solid transparent;border-bottom:${height / 2}px solid transparent;`;
  a.appendChild(line); a.appendChild(head); return a;
}
