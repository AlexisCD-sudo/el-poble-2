// =====================================================================
// THE FORGOTTEN VILLAGE — MENÚ DE PAUSA (Fase D.3.1): capa DOM medieval (pergamí, fusta i pedra)
// =====================================================================
// Només dibuixa i delega: no conté lògica del joc. Es crea amb `createPauseMenu({ model, actions, drawMap })`:
//   model   = { getInventory() → entrades, getDocuments() → entrades, getMap() → model del mapa, getSaveInfo() → { status, savedAt } }
//   actions = { resume(), save() → { ok, message }, load() → { ok, message } }
// La capa és INTERACTIVA (el ratolí és lliure mentre és oberta). Sense animacions CSS ni transparències cares: és un fons fosc pla.
// Seccions: Inventari, Documents, Mapa, Guardar, Carregar + «Tornar al joc». Tot el text és en català.
// =====================================================================
import { SYMBOL_BITMAPS } from '../world/cryptSymbols.js';
import { inventorySummary, NO_DOCUMENTS_TEXT, NO_SAVE_TEXT } from './menuModel.js';
import { mapSize, MAP_SCALE } from './mapView.js';
import { formatSavedAt } from '../game/saveGame.js';
import { FONT_PIXEL, TEXT_MIN, createArrow } from './theme.js';   // Fase D.6: Pixel Monastery Script és l'única tipografia

export const TABS = [['inventari', 'Inventari'], ['documents', 'Documents'], ['mapa', 'Mapa'], ['guardar', 'Guardar'], ['carregar', 'Carregar']];

const DEFAULT_HINT = 'Esc - tornar al joc';
const FONT = FONT_PIXEL; const BIG = 30; const SMALL = TEXT_MIN;   // 30 px = mida nativa de la font; 24 px = mínim per als textos petits
const INK = '#2b2013';
const MATERIAL_COLOR = { bronze: '#a47b3f', iron: '#6a6e7a', blackIron: '#34343c' };

const CSS = `
.fv-pause { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(5,4,3,0.86); font-family: ${FONT}; font-synthesis: none; color: ${INK}; user-select: none; }
.fv-frame { box-sizing: border-box; width: min(96vw, 980px); height: min(92vh, 660px); display: flex; border: 7px solid #34312d; outline: 2px solid #15130f; box-shadow: 0 0 0 3px #4a453d, 0 0 60px #000; background: #2a1f16; }
.fv-nav { width: 240px; flex: none; display: flex; flex-direction: column; padding: 16px 12px; gap: 8px; background: linear-gradient(90deg, #2e2218, #3a2b1d 60%, #2e2218); border-right: 4px solid #17110b; overflow: hidden; }
.fv-title { font-family: ${FONT}; text-align: center; color: #cdbd96; font-size: ${BIG}px; letter-spacing: 0; line-height: 1.1; font-weight: normal; margin: 2px 0 10px; border-bottom: 1px solid #6b5636; padding-bottom: 10px; }
.fv-btn { font-family: ${FONT}; font-size: ${BIG}px; letter-spacing: 0; line-height: 1; padding: 6px 8px; color: #d6c8a2; background: linear-gradient(#4a3826, #3a2b1d); border: 2px solid #1c140d; border-radius: 2px; box-shadow: inset 0 1px 0 #6b5636; cursor: pointer; text-align: center; font-weight: normal; }
.fv-nav .fv-btn[data-tab] { font-family: ${FONT}; font-size: ${BIG}px; letter-spacing: 0; line-height: 1; padding: 6px 8px; font-weight: normal; }   /* botons de navegació: 30 px exactes */
.fv-btn:hover, .fv-btn:focus-visible { background: linear-gradient(#5a4530, #46341f); color: #efe2bd; outline: none; }
.fv-btn.fv-active { background: linear-gradient(#cdbd96, #b9a77c); color: ${INK}; border-color: #5a4630; box-shadow: inset 0 0 0 1px #e3d6b2; }
.fv-spacer { flex: 1; }
.fv-resume { background: linear-gradient(#3b3a36, #2c2b28); border-color: #12110f; }
.fv-hint { text-align: center; color: #9a8a6a; font-size: ${SMALL}px; line-height: 1.1; margin-top: 4px; }
.fv-content { flex: 1; min-width: 0; overflow: auto; padding: 18px 24px; background: radial-gradient(ellipse at center, #d3c49e 0%, #c3b189 70%, #a9966b 100%); }
.fv-h { margin: 0 0 2px; font-family: ${FONT}; font-weight: normal; font-size: ${BIG}px; letter-spacing: 0; line-height: 1.1; }
.fv-sub { margin: 0 0 14px; font-size: ${SMALL}px; line-height: 1.2; opacity: 0.8; border-bottom: 1px solid rgba(43,32,19,0.35); padding-bottom: 6px; }
.fv-key { display: flex; gap: 14px; align-items: center; padding: 10px 12px; margin-bottom: 10px; border: 2px solid #5a4630; background: rgba(255,248,225,0.22); }
.fv-key.fv-locked { border-style: dashed; opacity: 0.7; background: rgba(43,32,19,0.10); }
.fv-key canvas { image-rendering: pixelated; flex: none; background: rgba(43,32,19,0.12); border: 1px solid rgba(43,32,19,0.4); }
.fv-key > div:nth-child(2) { flex: 1; min-width: 0; }
.fv-key-name { font-family: ${FONT}; font-size: ${BIG}px; font-weight: normal; letter-spacing: 0; line-height: 1.1; }
.fv-key-desc { font-size: ${SMALL}px; margin-top: 2px; line-height: 1.2; }
.fv-tag { margin-left: auto; font-size: ${SMALL}px; font-weight: normal; letter-spacing: 0; line-height: 1; padding: 4px 8px; border: 1px solid #5a4630; white-space: nowrap; }
.fv-tag.fv-got { background: #4b5a35; color: #e9e2c4; border-color: #2c3720; }
.fv-docs { display: flex; flex-direction: column; gap: 12px; }
.fv-doclist { display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; }
.fv-doc { text-align: left; font-family: ${FONT}; font-size: ${BIG}px; line-height: 1.1; color: ${INK}; background: rgba(255,248,225,0.25); border: 2px solid #5a4630; padding: 4px 12px; cursor: pointer; }
.fv-doc.fv-active, .fv-doc:hover { background: rgba(255,248,225,0.6); }
.fv-docview { min-width: 0; padding: 14px 20px; border: 2px solid #5a4630; background: rgba(255,248,225,0.3); }
.fv-doc-title { font-family: ${FONT}; font-size: ${BIG}px; font-weight: normal; line-height: 1.1; margin-bottom: 2px; }
.fv-doc-src { font-size: ${SMALL}px; line-height: 1.2; opacity: 0.75; margin-bottom: 12px; }
.fv-doc-text { font-size: ${BIG}px; line-height: 1.3; }
.fv-doc-symbols { display: flex; gap: 20px; align-items: center; margin-top: 16px; }
.fv-doc-symbols canvas { image-rendering: pixelated; }
.fv-map { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.fv-map canvas { flex: none; border: 3px solid #4a3826; box-shadow: 0 0 0 1px #17110b; max-width: 100%; max-height: calc(min(92vh, 660px) - 150px); width: auto; height: auto; }
.fv-legend { flex: 1; min-width: 200px; font-size: ${SMALL}px; line-height: 1.2; }
.fv-legend div { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.fv-swatch { width: 22px; height: 14px; flex: none; border: 1px solid ${INK}; }
.fv-pointer { width: 0; height: 0; flex: none; margin: 0 4px 0 6px; border-left: 14px solid #7a2a22; border-top: 8px solid transparent; border-bottom: 8px solid transparent; }
.fv-act { font-size: ${BIG}px; line-height: 1; padding: 8px 20px; margin: 10px 0; color: #efe2bd; background: linear-gradient(#5a3b2a, #43291c); border: 2px solid #2a1810; cursor: pointer; font-family: ${FONT}; letter-spacing: 0; font-weight: normal; }
.fv-act:hover, .fv-act:focus-visible { background: linear-gradient(#6a4632, #52331f); outline: none; }
.fv-note { margin-top: 12px; padding: 8px 14px; font-size: ${SMALL}px; line-height: 1.2; border: 2px solid #5a4630; background: rgba(255,248,225,0.35); min-height: 28px; }
.fv-note.fv-ok { border-color: #3d5028; color: #22331a; }
.fv-note.fv-err { border-color: #6b2a22; color: #5a1f19; }
.fv-p { font-size: ${SMALL}px; line-height: 1.25; margin: 6px 0; }
@media (max-width: 720px) { .fv-frame { flex-direction: column; height: 96vh; } .fv-nav { width: auto; flex-direction: row; flex-wrap: wrap; padding: 8px; } .fv-title { display: none; } .fv-spacer { display: none; } .fv-map { flex-direction: column; } }
`;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

// Icona pixel-art d'una clau (anella amb el símbol dins) en un canvas petit.
export function keyIcon(entry, size = 5) {
  const c = document.createElement('canvas'); c.width = 24; c.height = 12; c.style.cssText = `width:${24 * size}px;height:${12 * size}px;`;
  const ctx = c.getContext('2d'); if (!ctx) return c;
  const col = entry.collected ? (MATERIAL_COLOR[entry.material] || '#777') : '#4b4540';
  ctx.fillStyle = col;
  ctx.fillRect(9, 5, 14, 2); ctx.fillRect(19, 7, 2, 3); ctx.fillRect(22, 7, 1, 2);  // canya i dents
  ctx.fillRect(1, 2, 8, 8); ctx.clearRect(2, 3, 6, 6); ctx.fillRect(1, 2, 8, 1); ctx.fillRect(1, 9, 8, 1);   // anella
  ctx.clearRect(2, 3, 6, 6);
  if (entry.collected && entry.symbol === 'bells3') {   // Fase E: tres campanes diminutes dins l'anella (el mostreig 1 de cada 2 del mapa de bits no les dibuixaria bé)
    ctx.fillStyle = '#e3d6b2';
    for (let k = 0; k < 3; k++) { const x = 2 + k * 2; ctx.fillRect(x, 4, 1, 1); ctx.fillRect(x, 5, 2, 2); ctx.fillRect(x, 7, 1, 1); }
  } else if (entry.collected && entry.symbol && SYMBOL_BITMAPS[entry.symbol]) { // símbol dins l'anella (ocupa 6×6 aprox.)
    const b = SYMBOL_BITMAPS[entry.symbol]; ctx.fillStyle = '#e3d6b2';
    const ox = 5 - Math.floor(b[0].length / 4); const oy = 6 - Math.floor(b.length / 4);
    b.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#' && x % 2 === 0 && y % 2 === 0) ctx.fillRect(ox + x / 2, oy + y / 2, 1, 1); }));
  } else if (!entry.collected) { ctx.fillStyle = '#8d7d5d'; ctx.fillRect(4, 4, 2, 1); ctx.fillRect(5, 5, 1, 1); ctx.fillRect(4, 6, 2, 1); ctx.fillRect(4, 8, 1, 1); } // «?» minúscul
  return c;
}

function symbolCanvas(name, scale = 6) {
  const bmp = SYMBOL_BITMAPS[name]; const c = document.createElement('canvas'); c.width = bmp[0].length; c.height = bmp.length;
  c.style.cssText = `width:${c.width * scale}px;height:${c.height * scale}px;`;
  const ctx = c.getContext('2d'); if (ctx) { ctx.fillStyle = INK; bmp.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); })); }
  return c;
}

export function createPauseMenu({ model, actions, drawMap, parent = document.body }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = el('div', 'fv-pause'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Menú de pausa');
  const frame = el('div', 'fv-frame'); const nav = el('div', 'fv-nav'); const content = el('div', 'fv-content');
  nav.appendChild(el('div', 'fv-title', 'Pausa'));
  const buttons = {};
  for (const [id, text] of TABS) { const b = el('button', 'fv-btn', text); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => api.select(id)); nav.appendChild(b); buttons[id] = b; }
  nav.appendChild(el('div', 'fv-spacer'));
  const resumeBtn = el('button', 'fv-btn fv-resume', 'Tornar al joc'); resumeBtn.type = 'button'; resumeBtn.dataset.action = 'resume';
  resumeBtn.addEventListener('click', () => actions.resume());
  const hintEl = el('div', 'fv-hint', DEFAULT_HINT); hintEl.dataset.role = 'hint';
  nav.appendChild(resumeBtn); nav.appendChild(hintEl);
  frame.appendChild(nav); frame.appendChild(content); root.appendChild(frame); parent.appendChild(root);
  // El menú és interactiu: els clics no han d'arribar a res més (i el context menú no hi fa res).
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  let visible = false; let tab = 'inventari'; let selectedDoc = null; let notice = { text: '', kind: '' };

  const header = (title, sub) => { content.appendChild(el('h2', 'fv-h', title)); content.appendChild(el('p', 'fv-sub', sub)); };
  const noteBox = () => { const n = el('div', `fv-note${notice.kind ? ` fv-${notice.kind}` : ''}`, notice.text); n.dataset.role = 'notice'; if (!notice.text) n.style.display = 'none'; n.setAttribute('aria-live', 'polite'); return n; };

  function renderInventory() {
    const entries = model.getInventory();
    header('Inventari', inventorySummary(entries));
    for (const e of entries) {
      const row = el('div', `fv-key${e.collected ? '' : ' fv-locked'}`); row.dataset.key = e.id; row.dataset.collected = String(e.collected);
      row.appendChild(keyIcon(e));
      const info = el('div'); info.appendChild(el('div', 'fv-key-name', e.name)); info.appendChild(el('div', 'fv-key-desc', e.description.charAt(0).toUpperCase() + e.description.slice(1) + (e.collected ? '.' : '')));
      row.appendChild(info); row.appendChild(el('div', `fv-tag${e.collected ? ' fv-got' : ''}`, e.collected ? 'RECOLLIDA' : 'BLOQUEJADA'));
      content.appendChild(row);
    }
    content.appendChild(el('p', 'fv-p', 'Les claus no es poden fer servir des d\'aquest menú: cal portar-les davant del seu pany.'));
  }
  function renderDocuments() {
    const docs = model.getDocuments();
    header('Documents', docs.length ? `${docs.length} descobert${docs.length === 1 ? '' : 's'}` : 'Cap document');
    if (!docs.length) { content.appendChild(el('p', 'fv-p', NO_DOCUMENTS_TEXT)); return; }
    if (!docs.some((d) => d.id === selectedDoc)) selectedDoc = docs[0].id;
    const wrap = el('div', 'fv-docs'); const list = el('div', 'fv-doclist'); const view = el('div', 'fv-docview');
    for (const d of docs) {
      const b = el('button', `fv-doc${d.id === selectedDoc ? ' fv-active' : ''}`, d.title); b.type = 'button'; b.dataset.doc = d.id;
      b.addEventListener('click', () => { selectedDoc = d.id; render(); }); list.appendChild(b);
    }
    const d = docs.find((q) => q.id === selectedDoc);
    view.appendChild(el('div', 'fv-doc-title', d.title)); view.appendChild(el('div', 'fv-doc-src', d.source)); view.appendChild(el('div', 'fv-doc-text', d.text));
    if (d.symbols.length) {
      const row = el('div', 'fv-doc-symbols');
      d.symbols.forEach((s, i) => { row.appendChild(symbolCanvas(s)); if (i < d.symbols.length - 1) row.appendChild(createArrow()); });
      view.appendChild(row);
    }
    wrap.appendChild(list); wrap.appendChild(view); content.appendChild(wrap);
  }
  function renderMap() {
    header('Mapa', 'Esquema del que has vist del poble');
    const m = model.getMap(); const { w, h } = mapSize(m.bounds, MAP_SCALE);
    const wrap = el('div', 'fv-map'); const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; canvas.dataset.role = 'map';
    const ctx = canvas.getContext('2d'); if (ctx) drawMap(ctx, m);
    wrap.appendChild(canvas);
    const lg = el('div', 'fv-legend');
    const sw = (bg, extra, text) => { const r = el('div'); const s = el('span', 'fv-swatch'); s.style.cssText = `background:${bg};${extra}`; r.appendChild(s); r.appendChild(el('span', '', text)); lg.appendChild(r); };
    sw('#8a6f4a', '', 'Lloc visitat'); sw('#b79f6c', '', 'Lloc conegut, encara no visitat');
    sw('repeating-linear-gradient(45deg,#a8ae8a 0 3px,#4d4230 3px 4px)', 'border-style:dashed;', 'Lloc no accessible (tancat)');
    const you = el('div'); you.appendChild(el('span', 'fv-pointer')); you.appendChild(el('span', '', 'Tu (apunta cap a on mires)')); lg.appendChild(you);
    lg.appendChild(el('p', 'fv-p', 'Només hi surt el que has descobert.'));
    wrap.appendChild(lg); content.appendChild(wrap);
  }
  function renderSave() {
    header('Guardar', 'Desa la partida en aquest navegador');
    const info = model.getSaveInfo();
    content.appendChild(el('p', 'fv-p', info.status === 'ok' ? `Última partida desada: ${formatSavedAt(info.savedAt)}` : NO_SAVE_TEXT));
    content.appendChild(el('p', 'fv-p', 'Es desen la posició, l\'inventari, les portes, la porta secreta, la cripta, el sarcòfag, les claus i els documents. No es pot desar mentre hi ha una animació en curs ni des d\'una posició no vàlida. Desar sobreescriu la partida anterior.'));
    const b = el('button', 'fv-act', 'Guardar partida'); b.type = 'button'; b.dataset.action = 'save';
    b.addEventListener('click', () => { const r = actions.save(); notice = { text: r.message, kind: r.ok ? 'ok' : 'err' }; render(); });
    content.appendChild(b); content.appendChild(noteBox());
  }
  function renderLoad() {
    header('Carregar', 'Recupera l\'última partida desada');
    const info = model.getSaveInfo();
    if (info.status === 'ok') content.appendChild(el('p', 'fv-p', `Última partida desada: ${formatSavedAt(info.savedAt)}`));
    else if (info.status === 'corrupt') content.appendChild(el('p', 'fv-p', 'La partida desada està malmesa i no es pot carregar.'));
    else if (info.status === 'unavailable') content.appendChild(el('p', 'fv-p', 'El navegador no permet accedir a l\'emmagatzematge: no es pot carregar.'));
    else content.appendChild(el('p', 'fv-p', NO_SAVE_TEXT));
    content.appendChild(el('p', 'fv-p', 'Carregar substitueix l\'estat actual de la partida pel que hi havia en desar-la. El progrés no desat es perd.'));
    const b = el('button', 'fv-act', 'Carregar l\'última partida'); b.type = 'button'; b.dataset.action = 'load';
    b.addEventListener('click', () => { const r = actions.load(); notice = { text: r.message, kind: r.ok ? 'ok' : 'err' }; render(); });
    content.appendChild(b); content.appendChild(noteBox());
  }

  function render() {
    content.textContent = '';
    for (const [id] of TABS) buttons[id].classList.toggle('fv-active', id === tab);
    ({ inventari: renderInventory, documents: renderDocuments, mapa: renderMap, guardar: renderSave, carregar: renderLoad })[tab]();
  }

  const api = {
    element: root,
    get tab() { return tab; },
    select(id) { if (!buttons[id]) return; if (id !== tab) notice = { text: '', kind: '' }; tab = id; render(); },
    show() { visible = true; root.style.display = 'flex'; hintEl.textContent = DEFAULT_HINT; render(); },
    setHint(text) { hintEl.textContent = text || DEFAULT_HINT; },
    hide() { visible = false; root.style.display = 'none'; },
    isVisible: () => visible,
    refresh() { if (visible) render(); },
    notify(text, kind = '') { notice = { text, kind }; if (visible) render(); },
  };
  return api;
}
