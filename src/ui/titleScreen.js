// =====================================================================
// EL POBLE — PANTALLA INICIAL (Fase D.4; títol pixel art a la D.5)
// =====================================================================
// Capa DOM per sobre del món 3D (que continua dibuixat a sota, de nit i amb boira: és el mateix poble del joc, a baix-polígon i pixel-art):
//   · vinyeta fosca i dues barres negres de pantalla panoràmica (to cinematogràfic),
//   · boira que es mou molt a poc a poc (2 capes amb `transform`, sense repintar res; s'atura amb «prefers-reduced-motion»),
//   · el títol «El Poble» (Fase D.5): IMATGE pixelada feta amb la Pixel Monastery Script, ampliada amb factor enter (píxels nítids), color os amb un llum fred i un lleu doble vermell (inspirat en el to gràfic de l'horror
//     cinematogràfic modern, sense copiar cap logotip ni tipografia concreta), una filera fina amb un rombe i el subtítol,
//   · «Clica per començar» amb un parpelleig lent i els controls en petit.
// És la MATEIXA capa `overlay` de main.js: main.js la mostra/amaga (display flex/none) segons el pointer lock. No té lògica de joc.
// =====================================================================
import { FONT_PIXEL, PIXEL_GRID, TEXT_MIN, COLORS, TITLE_IMAGE } from './theme.js';

export const GAME_TITLE = 'El Poble';
export const GAME_SUBTITLE = 'Un joc d\'exploració i misteri';
export const START_TEXT = 'Clica per començar';
export const CONTROLS = [
  ['W A S D', 'moure\'s'],
  ['Ratolí', 'mirar al voltant'],
  ['E', 'interactuar (portes, calaixos, claus, reixa)'],
  ['Esc', 'menú de pausa (inventari, documents, mapa, guardar i carregar)'],
];

const CSS = `
.fv-title-screen { position: fixed; inset: 0; z-index: 900; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;
  color: ${COLORS.bone}; font-family: ${FONT_PIXEL}; text-align: center; cursor: pointer; user-select: none;
  background: radial-gradient(ellipse at 50% 46%, rgba(4,6,12,0.50) 0%, rgba(3,4,9,0.78) 58%, rgba(1,2,4,0.96) 100%); }
.fv-ts-bar { position: absolute; left: 0; right: 0; height: 11%; background: #000; z-index: 3; }
.fv-ts-bar.fv-top { top: 0; box-shadow: 0 6px 40px 10px #000; } .fv-ts-bar.fv-bottom { bottom: 0; box-shadow: 0 -6px 40px 10px #000; }
.fv-ts-fog { position: absolute; left: -30%; width: 160%; z-index: 1; pointer-events: none; will-change: transform; }
.fv-ts-fog.fv-f1 { top: 38%; height: 34%; background: radial-gradient(ellipse at 50% 50%, rgba(150,165,190,0.20), rgba(150,165,190,0) 68%); animation: fv-drift-a 64s ease-in-out infinite alternate; }
.fv-ts-fog.fv-f2 { top: 52%; height: 40%; background: radial-gradient(ellipse at 50% 50%, rgba(120,135,160,0.16), rgba(120,135,160,0) 70%); animation: fv-drift-b 88s ease-in-out infinite alternate; }
@keyframes fv-drift-a { from { transform: translateX(-9%); } to { transform: translateX(9%); } }
@keyframes fv-drift-b { from { transform: translateX(8%); } to { transform: translateX(-8%); } }
.fv-ts-body { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; padding: 0 5vw; }
.fv-ts-title { margin: 0; line-height: 0; font-weight: normal; }
.fv-ts-logo { position: relative; margin: 0 auto; filter: drop-shadow(0 0 26px rgba(150,175,215,0.30)) drop-shadow(0 10px 22px rgba(0,0,0,0.9)); }
.fv-ts-logo img { position: absolute; left: 0; top: 0; image-rendering: crisp-edges; image-rendering: pixelated; user-select: none; -webkit-user-drag: none; }
.fv-ts-logo img.fv-ghost { opacity: 0.6; }
.fv-ts-logo.fv-fallback { font-family: ${FONT_PIXEL}; color: ${COLORS.bone}; white-space: nowrap; line-height: 1; }
.fv-ts-rule { display: flex; align-items: center; gap: 14px; width: min(62vw, 620px); margin: 18px 0 14px; }
.fv-ts-rule i { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(185,173,146,0), rgba(185,173,146,0.75), rgba(185,173,146,0)); }
.fv-ts-rule b { width: 9px; height: 9px; transform: rotate(45deg); border: 1px solid #b9ad92; background: #7a2a22; flex: none; }
.fv-ts-sub { margin: 0 0 4vh; font-size: clamp(${TEXT_MIN}px, 2.4vw, ${PIXEL_GRID}px); letter-spacing: 0.1em; color: ${COLORS.boneDim}; text-transform: uppercase; }
.fv-ts-start { margin: 0 0 2.4vh; font-family: ${FONT_PIXEL}; font-size: ${PIXEL_GRID}px; letter-spacing: 0.12em; text-transform: uppercase; color: ${COLORS.bone}; animation: fv-blink 3.4s ease-in-out infinite; }
@keyframes fv-blink { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
.fv-ts-controls { font-size: ${TEXT_MIN}px; line-height: 1.25; color: ${COLORS.boneDim}; opacity: 0.9; }
.fv-ts-controls b { font-family: ${FONT_PIXEL}; font-weight: normal; letter-spacing: 0.04em; color: ${COLORS.bone}; margin-right: 8px; }
@media (prefers-reduced-motion: reduce) { .fv-ts-fog, .fv-ts-start { animation: none; } .fv-ts-start { opacity: 1; } }
@media (max-height: 560px) { .fv-ts-controls { display: none; } .fv-ts-sub { margin-bottom: 2vh; } }
`;

// Factor enter d'ampliació de la imatge del títol (≥ 1): pur, es prova a tools/test-fase-d4.js.
export function titleScale(vw, vh) {
  const byW = (vw * 0.72) / TITLE_IMAGE.width; const byH = (vh * 0.30) / TITLE_IMAGE.height;
  return Math.max(1, Math.floor(Math.min(byW, byH, 14)));
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

// Crea la pantalla inicial dins de `parent` i en retorna l'element arrel (visible per defecte, display: flex).
export function createTitleScreen(parent = document.body) {
  const style = document.createElement('style'); style.id = 'fv-title-css'; style.textContent = CSS; document.head.appendChild(style);
  const root = el('div', 'fv-title-screen'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', GAME_TITLE);
  root.appendChild(el('div', 'fv-ts-fog fv-f1')); root.appendChild(el('div', 'fv-ts-fog fv-f2'));
  root.appendChild(el('div', 'fv-ts-bar fv-top')); root.appendChild(el('div', 'fv-ts-bar fv-bottom'));
  const body = el('div', 'fv-ts-body');
  const title = el('h1', 'fv-ts-title'); title.setAttribute('aria-label', GAME_TITLE);
  const logo = el('div', 'fv-ts-logo'); title.appendChild(logo);
  const ghost = document.createElement('img'); ghost.className = 'fv-ghost'; ghost.src = TITLE_IMAGE.ghostUrl; ghost.alt = ''; ghost.draggable = false;
  const img = document.createElement('img'); img.src = TITLE_IMAGE.url; img.alt = GAME_TITLE; img.draggable = false;
  logo.appendChild(ghost); logo.appendChild(img);
  let k = 1;
  const fit = () => { // factor ENTER que fa càpiguda la imatge (≈ 72 % de l'amplada o ≈ 30 % de l'alçada de la finestra)
    k = titleScale(window.innerWidth, window.innerHeight);
    logo.style.width = `${TITLE_IMAGE.width * k}px`; logo.style.height = `${TITLE_IMAGE.height * k}px`;
    for (const i of [ghost, img]) { i.style.width = `${TITLE_IMAGE.width * k}px`; i.style.height = `${TITLE_IMAGE.height * k}px`; }
    ghost.style.left = `${-k}px`; ghost.style.top = `${k}px`;   // doble vermell desplaçat un píxel del títol
    if (logo.classList.contains('fv-fallback')) logo.style.fontSize = `${PIXEL_GRID * Math.max(1, Math.floor(k / 2))}px`;
  };
  img.addEventListener('error', () => { // si la imatge no carrega, el mateix títol amb la font (és el mateix glif, a mida entera de la quadrícula)
    ghost.remove(); img.remove(); logo.classList.add('fv-fallback'); logo.style.height = 'auto'; logo.style.width = 'auto'; logo.textContent = GAME_TITLE; fit();
  });
  window.addEventListener('resize', fit); fit();
  body.appendChild(title);
  const rule = el('div', 'fv-ts-rule'); rule.appendChild(el('i')); rule.appendChild(el('b')); rule.appendChild(el('i')); body.appendChild(rule);
  body.appendChild(el('p', 'fv-ts-sub', GAME_SUBTITLE));
  body.appendChild(el('p', 'fv-ts-start', START_TEXT));
  const controls = el('div', 'fv-ts-controls');
  for (const [k, t] of CONTROLS) { const row = el('div'); row.appendChild(el('b', '', k)); row.appendChild(document.createTextNode(`- ${t}`)); controls.appendChild(row); }
  body.appendChild(controls);
  root.appendChild(body); parent.appendChild(root);
  return root;
}
