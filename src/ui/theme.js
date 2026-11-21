// =====================================================================
// EL POBLE — TEMA VISUAL DE LA INTERFÍCIE (Fase D.4): tipografia i colors de la pantalla inicial, els menús i els missatges
// =====================================================================
// Dues famílies LOCALS i lliures (SIL Open Font License 1.1; vegeu src/assets/fonts/LLICENCIES.md). No hi ha cap dependència d'internet:
//   · TÍTOLS  → Gloock: serif de contrast alt, afilada i elegant, de to cinematogràfic i una mica inquietant (títol del joc, capçaleres).
//   · TEXTOS  → Crimson Pro: serif d'aire antic i editorial, molt llegible a mida petita (menús, missatges, documents, mapa).
// Si una font no es pot carregar, el navegador cau a Palatino / Georgia: la interfície continua sent llegible.
// Aquest mòdul no toca el DOM en importar-lo: només `installTheme()` hi afegeix les regles @font-face.
// =====================================================================

// `new URL('…', import.meta.url)` amb el camí LITERAL: és el que Vite reconeix per copiar la font a la compilació (i funciona també amb GitHub Pages).
const URLS = {
  title: new URL('../assets/fonts/Gloock-Regular.woff', import.meta.url).href,
  text: new URL('../assets/fonts/CrimsonPro-Regular.woff', import.meta.url).href,
  textItalic: new URL('../assets/fonts/CrimsonPro-Italic.woff', import.meta.url).href,
  textBold: new URL('../assets/fonts/CrimsonPro-Bold.woff', import.meta.url).href,
};

export const FONT_TITLE = "'Gloock', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif";
export const FONT_TEXT = "'Crimson Pro', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif";

// Fitxers de font (per als tests i per a la llicència): família, pes, estil i URL.
export const FONT_FACES = [
  { family: 'Gloock', weight: 400, style: 'normal', url: URLS.title },
  { family: 'Crimson Pro', weight: 400, style: 'normal', url: URLS.text },
  { family: 'Crimson Pro', weight: 400, style: 'italic', url: URLS.textItalic },
  { family: 'Crimson Pro', weight: 700, style: 'normal', url: URLS.textBold },
];

// Paleta comuna (fusta fosca, pergamí, os, vermell sec).
export const COLORS = { bone: '#e8e0cc', boneDim: '#b9ad92', ink: '#2b2013', blood: '#7a2a22', night: '#05070d' };

export function fontFaceCSS() {
  return FONT_FACES.map((f) => `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: ${f.style}; font-display: swap; src: url('${f.url}') format('woff'); }`).join('\n');
}

// Afegeix les @font-face al document (una sola vegada) i en demana la càrrega. Retorna una promesa que no falla mai.
export function installTheme(doc = document) {
  if (!doc.getElementById('fv-fonts')) {
    const style = doc.createElement('style'); style.id = 'fv-fonts'; style.textContent = fontFaceCSS(); doc.head.appendChild(style);
  }
  if (!doc.fonts || typeof doc.fonts.load !== 'function') return Promise.resolve();
  const wants = ['400 64px "Gloock"', '400 18px "Crimson Pro"', 'italic 400 18px "Crimson Pro"', '700 18px "Crimson Pro"'];
  return Promise.all(wants.map((w) => doc.fonts.load(w).catch(() => null))).then(() => undefined, () => undefined);
}
