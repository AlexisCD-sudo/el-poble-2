// =====================================================================
// THE FORGOTTEN VILLAGE — DIBUIX DEL MAPA (Fase D.3.1): esquema 2D sobre pergamí, amb canvas
// =====================================================================
// `drawMap(ctx, model, opts)` només fa servir crides bàsiques de CanvasRenderingContext2D, així es pot provar amb un context simulat.
// `model` ve de mapData.buildMapModel(): ja només conté les zones DESCOBERTES. Estils:
//   visitat      → ombrejat de tinta ple i contorn continu
//   conegut      → ombrejat clar i contorn continu (encara no s'hi ha entrat)
//   no accessible → trama de ratlles diagonals, contorn discontinu i una creu (X); l'etiqueta diu per què («reixa tancada»)
// El jugador és una fletxa vermella fosca que apunta cap a on mira (nord amunt).
// =====================================================================

export const MAP_SCALE = 7; // píxels per metre
export const INK = '#2b2013';
const PARCHMENT = '#c9b88f';

const FILL = {
  road: ['#c2ad7c', '#b79f6c'], plaza: ['#c7b283', '#b8a06d'], house: ['#a98f68', '#8a6f4a'], church: ['#a49680', '#7d705d'],
  cemetery: ['#a8ae8a', '#8d946e'], forest: ['#a3ab86', '#7f8a62'], crypt: ['#8d8795', '#6a6475'],
};

export function mapSize(bounds, scale = MAP_SCALE) {
  return { w: Math.round((bounds.xMax - bounds.xMin) * scale), h: Math.round((bounds.zMax - bounds.zMin) * scale) };
}
export const toCanvas = (bounds, x, z, scale = MAP_SCALE) => [(x - bounds.xMin) * scale, (z - bounds.zMin) * scale];

function noise(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function parchment(ctx, w, h) {
  ctx.fillStyle = PARCHMENT; ctx.fillRect(0, 0, w, h);
  const r = noise(77);
  for (let i = 0; i < 900; i++) { // grans i taques de pergamí vell
    ctx.fillStyle = r() < 0.5 ? 'rgba(120,95,55,0.10)' : 'rgba(235,222,185,0.12)';
    const s = 1 + Math.floor(r() * 3); ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), s, s);
  }
  for (let i = 0; i < 10; i++) { ctx.strokeStyle = `rgba(70,45,20,${0.30 - i * 0.027})`; ctx.lineWidth = 1; ctx.strokeRect(i + 0.5, i + 0.5, w - 2 * i - 1, h - 2 * i - 1); } // vores fosques
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(9, 9, w - 18, h - 18);
}

function hatch(ctx, x, y, w, h) { // ratlles diagonals dins d'un rectangle (sense retallar: es fan segments curts)
  ctx.strokeStyle = 'rgba(43,32,19,0.55)'; ctx.lineWidth = 1;
  for (let k = -h; k < w; k += 5) {
    const x0 = Math.max(0, k); const y0 = x0 - k; const x1 = Math.min(w, k + h); const y1 = x1 - k;
    if (x1 <= x0) continue;
    ctx.beginPath(); ctx.moveTo(x + x0, y + y0); ctx.lineTo(x + x1, y + y1); ctx.stroke();
  }
}

function drawZone(ctx, bounds, z, scale) {
  const [light, dark] = FILL[z.kind] || FILL.road;
  const visited = z.status === 'visited';
  for (const r of z.rects) {
    const [x0, y0] = toCanvas(bounds, r.xMin, r.zMin, scale); const [x1, y1] = toCanvas(bounds, r.xMax, r.zMax, scale);
    const w = x1 - x0; const h = y1 - y0;
    ctx.fillStyle = visited ? dark : light; ctx.fillRect(x0, y0, w, h);
    if (!z.accessible) hatch(ctx, x0, y0, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = visited ? 2 : 1;
    if (!z.accessible && ctx.setLineDash) ctx.setLineDash([4, 3]);
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
    if (ctx.setLineDash) ctx.setLineDash([]);
    if (z.kind === 'forest') { // arbres esquemàtics (només a l'entrada del bosc)
      ctx.fillStyle = 'rgba(40,52,30,0.75)';
      for (let tx = x0 + 6; tx < x1 - 4; tx += 12) for (let ty = y0 + 8; ty < y1 - 4; ty += 12) { ctx.beginPath(); ctx.moveTo(tx, ty - 5); ctx.lineTo(tx + 4, ty + 3); ctx.lineTo(tx - 4, ty + 3); ctx.closePath(); ctx.fill(); }
    }
  }
}

function halo(ctx, text, x, y) { // text amb vora clara perquè es llegeixi sobre les trames
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(222,208,170,0.92)'; ctx.strokeText(text, x, y); ctx.fillStyle = INK; ctx.fillText(text, x, y);
}

function label(ctx, bounds, z, scale) {
  const r = z.rects[0]; const [cx, cy] = toCanvas(bounds, (r.xMin + r.xMax) / 2, (r.zMin + r.zMax) / 2, scale);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'italic 11px Georgia, serif';
  const text = z.accessible || !z.lockedNote ? z.name : `${z.name} (${z.lockedNote})`;
  halo(ctx, text, cx, cy + (z.kind === 'church' ? -2 : 4));
  if (!z.accessible) { ctx.font = 'bold 13px Georgia, serif'; halo(ctx, '✕', cx, cy + 20); }
}

function compass(ctx, w) {
  const cx = w - 34; const cy = 40;
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx, cy + 16); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx, cy - 3); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx, cy + 3); ctx.closePath(); ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText('N', cx, cy - 20);
}

export function drawPlayer(ctx, bounds, p, scale) {
  const [x, y] = toCanvas(bounds, p.x, p.z, scale);
  const dx = -Math.sin(p.yaw); const dz = -Math.cos(p.yaw); // la mateixa «endavant» que main.js (nord = −Z = amunt)
  const px = -dz; const pz = dx;                             // perpendicular
  ctx.fillStyle = '#7a2a22'; ctx.strokeStyle = '#efe2bd'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + dx * 9, y + dz * 9); ctx.lineTo(x - dx * 6 + px * 5.5, y - dz * 6 + pz * 5.5); ctx.lineTo(x - dx * 3, y - dz * 3); ctx.lineTo(x - dx * 6 - px * 5.5, y - dz * 6 - pz * 5.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.font = 'bold 11px Georgia, serif'; ctx.fillText('Tu', x, y - 13);
}

// Dibuixa el mapa sencer. Retorna el nombre de zones dibuixades (per als tests).
export function drawMap(ctx, model, opts = {}) {
  const scale = opts.scale || MAP_SCALE; const { w, h } = mapSize(model.bounds, scale);
  parchment(ctx, w, h);
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.font = 'italic bold 15px Georgia, serif'; ctx.fillText('El Poble Oblidat', 20, 32);
  compass(ctx, w);
  const order = ['road', 'plaza', 'forest', 'cemetery', 'house', 'church', 'crypt'];
  const zones = [...model.zones].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const z of zones) drawZone(ctx, model.bounds, z, scale);
  for (const z of zones) label(ctx, model.bounds, z, scale);
  drawPlayer(ctx, model.bounds, model.player, scale);
  return zones.length;
}
