// =====================================================================
// VALIDADOR DEL LAYOUT  (npm run check:layout  →  node tools/validate-layout.js)
// =====================================================================
// Comprova que les dades de src/world/layout.js són coherents i que el
// món és jugable, sense obrir el navegador. Sense dependències.
//
//   A. Integritat de les dades        E. Solapaments i passos estrets
//   B. Visual i col·lisió coherents   F. Perímetre, accessibilitat i racons
//   C. Portes i fanals                G. Amples dels carrerons
//   D. Valors aprovats ("golden")     H. Mutacions (el validador es prova a si mateix)
//
// Surt amb codi 1 si hi ha algun error. Al final imprimeix el mapa de
// col·lisió generat a partir de les dades.
// =====================================================================
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, clearance, collidersOverlap } from '../src/player/collisions.js';

const TOL = 1e-9;
const eq = (a, b, t = TOL) => Math.abs(a - b) <= t;
const err = (code, message) => ({ code, message });

// Mida de la quadrícula d'anàlisi (metres) i zona que cobreix.
const GRID = { xMin: -16, xMax: 16, zMin: -22, zMax: 30 };
const MAIN_CELL = 0.05;
const MUTATION_CELL = 0.1;
const POCKET_AREA = 0.05;   // m²: un racó inaccessible més gran que això és un error
const COMFORT_GAP = 1.2;    // m: un pas entre dos obstacles més estret que això és un error

const FACES = {
  south: { axis: 'z', side: 'zMax', n: [0, 1] },
  north: { axis: 'z', side: 'zMin', n: [0, -1] },
  east: { axis: 'x', side: 'xMax', n: [1, 0] },
  west: { axis: 'x', side: 'xMin', n: [-1, 0] },
};
const RECT_KEYS = ['xMin', 'xMax', 'zMin', 'zMax'];
const rectEq = (a, b) => RECT_KEYS.every((k) => eq(a[k], b[k]));
const pickLayout = (L) => ({
  BUILDINGS: L.BUILDINGS, WALLS: L.WALLS, PROPS: L.PROPS, DOORS: L.DOORS,
  LIGHTS: L.LIGHTS, PLAYER: L.PLAYER, PLAZA: L.PLAZA, LAYOUT_META: L.LAYOUT_META,
});
const solidsOf = (L) => [...L.BUILDINGS, ...L.WALLS];

// ---------------------------------------------------------------------
// VALORS APROVATS (snapshot de l'auditoria geomètrica)
// 'r' = rectangle [xMin, xMax, zMin, zMax]; 'c' = cercle [cx, cz, radi]
// ---------------------------------------------------------------------
const GOLDEN_COLLISION = {
  'CH-N': ['r', -4, 4, -21, -9], 'CH-T': ['r', -7, -4, -13, -9],
  HA: ['r', -12, -7, -9, -3], HB: ['r', 7, 12, -7, -1], HC: ['r', 2, 7, 9, 15],
  'M-N1': ['r', 4, 15.4, -9.4, -9], 'M-E1': ['r', 12, 15.4, -7, -6.6], 'M-E3': ['r', 15, 15.4, -9, -7],
  'M-E2': ['r', 7, 7.4, -1, 9.4], 'M-S1': ['r', -7, -2, 9, 9.4], 'M-W2': ['r', -7.4, -7, -0.6, 9.4],
  'M-W1': ['r', -15.4, -7, -1, -0.6], 'M-W3': ['r', -15.4, -12, -3.4, -3], 'M-W4': ['r', -15.4, -15, -3, -1],
  'M-SO': ['r', -2.4, -2, 9.4, 29.4], 'M-SE': ['r', 2, 2.4, 15, 29.4], 'M-S2': ['r', -2, 2, 29, 29.4],
  FNT: ['c', 0, 3, 2.17], ARB: ['c', -4, -2, 0.3],
  B1: ['r', 6.5, 7, 4.2, 5.8], B2: ['r', -4.85, -4.35, 2.2, 3.8], B3: ['r', 2, 3.6, -9, -8.5],
  'BR-W': ['r', -7, -6.4, 1.3, 2.7], BR3: ['c', -1.7, 17, 0.3], BR4: ['c', 14.7, -8.7, 0.3],
  CR1: ['r', 6.4, 7, 8.4, 9], CR2: ['r', -15, -14.4, -1.6, -1], CR3: ['r', 1.4, 2, 19.7, 20.3],
  CT: ['c', 1.8, 25, 0.2],
};
const GOLDEN_DOORS = { D1: [0, -9, 'south'], D2: [-7, -6, 'east'], D3: [7, -4, 'west'], D4: [2, 12, 'west'] };
const GOLDEN_LIGHTS = { F1: [-2, 21, -1.6, 21], F2: [2, 13.5, 1.6, 13.5], F3: [2.6, -9, 2.6, -8.6], F4: [7, -1.5, 6.6, -1.5], F5: [-7, -4, -6.6, -4] };

// ---------------------------------------------------------------------
// A. INTEGRITAT
// ---------------------------------------------------------------------
function checkIntegrity(L, ctx) {
  const out = [];
  const ids = [];
  (function walk(o) {
    if (o && typeof o === 'object') {
      if (typeof o.id === 'string') ids.push(o.id);
      for (const v of Object.values(o)) walk(v);
    }
  })([L.BUILDINGS, L.WALLS, L.PROPS, L.DOORS, L.LIGHTS, L.PLAYER, L.PLAZA]);
  const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dups.length) out.push(err('duplicate-id', `IDs repetits: ${dups.join(', ')}`));
  out.push(...[]);
  ctx.info.push(`${ids.length} IDs, ${L.BUILDINGS.length} edificis, ${L.WALLS.length} murs, ${L.PROPS.length} atrezzo, ${L.DOORS.length} portes, ${L.LIGHTS.length} fanals`);

  for (const item of [...L.BUILDINGS, ...L.WALLS, ...L.PROPS]) {
    if (!item.visual) out.push(err('missing-field', `${item.id}: falta "visual"`));
    if (!item.collision) out.push(err('missing-field', `${item.id}: falta "collision"`));
  }
  if (!ctx.colliders) out.push(err('invalid-shape', ctx.colliderError));

  const solids = solidsOf(L);
  for (const d of L.DOORS) {
    if (!solids.some((s) => s.id === d.buildingId)) out.push(err('door-building', `${d.id}: l'edifici "${d.buildingId}" no existeix`));
    if (!FACES[d.face]) out.push(err('door-face', `${d.id}: cara desconeguda "${d.face}"`));
    const b = L.BUILDINGS.find((x) => x.id === d.buildingId);
    if (b && !b.doorIds.includes(d.id)) out.push(err('door-building', `${d.id} no és a doorIds de ${b.id}`));
  }
  for (const b of L.BUILDINGS) {
    for (const id of b.doorIds) if (!L.DOORS.some((d) => d.id === id)) out.push(err('door-building', `${b.id}: doorIds conté "${id}", que no existeix`));
  }
  for (const l of L.LIGHTS) {
    if (!solids.some((s) => s.id === l.mountedOn)) out.push(err('lantern-face', `${l.id}: "${l.mountedOn}" no existeix`));
  }
  return out;
}

// ---------------------------------------------------------------------
// B. VISUAL I COL·LISIÓ COHERENTS (excepcions documentades: CH-T, FNT, BR-W)
// ---------------------------------------------------------------------
function checkVisualCollision(L) {
  const out = [];
  const bad = (id, what) => out.push(err('visual-collision', `${id}: ${what}`));
  for (const b of L.BUILDINGS) {
    const v = b.visual.footprint;
    const c = b.collision;
    if (b.id === 'CH-T') {
      const nave = L.BUILDINGS.find((x) => x.id === 'CH-N');
      const trimmed = eq(c.xMin, v.xMin) && eq(c.zMin, v.zMin) && eq(c.zMax, v.zMax) && c.xMax <= v.xMax + TOL;
      const covered = nave && nave.collision.xMin <= c.xMax + TOL && nave.collision.xMax >= v.xMax - TOL &&
        nave.collision.zMin <= v.zMin + TOL && nave.collision.zMax >= v.zMax - TOL;
      if (!trimmed || !covered) bad(b.id, 'la col·lisió retallada ha de ser el visual menys el tros ja cobert per la nau');
    } else if (!rectEq(v, c)) bad(b.id, 'empremta visual i de col·lisió diferents');
  }
  for (const w of L.WALLS) if (!rectEq(w.visual.footprint, w.collision)) bad(w.id, 'empremta visual i de col·lisió diferents');
  for (const p of L.PROPS) {
    const v = p.visual;
    const c = p.collision;
    const sameCenter = (r) => c.type === 'circle' && eq(v.center.x, c.cx) && eq(v.center.z, c.cz) && eq(r, c.radius);
    switch (p.type) {
      case 'fountain': {
        const circumradius = v.acrossFlats / 2 / Math.cos(Math.PI / 8);
        if (!(c.type === 'circle' && eq(v.center.x, c.cx) && eq(v.center.z, c.cz))) bad(p.id, 'el centre de la col·lisió no coincideix amb el visual');
        else if (c.radius < circumradius - TOL || c.radius > circumradius + 0.05) {
          out.push(err('fountain-radius', `${p.id}: radi de col·lisió ${c.radius} fora de [${circumradius.toFixed(4)}, ${(circumradius + 0.05).toFixed(4)}] (ha de cobrir els vèrtexs de l'octàgon)`));
        }
        break;
      }
      case 'tree': if (!sameCenter(v.trunkRadius)) bad(p.id, 'la col·lisió ha de ser el tronc'); break;
      case 'barrel': if (!sameCenter(v.radius)) bad(p.id, 'cercle diferent del visual'); break;
      case 'sign': if (!sameCenter(v.postRadius)) bad(p.id, 'cercle diferent del visual'); break;
      case 'bench': case 'crate': if (!(c.type === 'rect' && rectEq(v.footprint, c))) bad(p.id, 'empremta visual i de col·lisió diferents'); break;
      case 'barrelPair': {
        const bb = {
          xMin: Math.min(...v.barrels.map((b) => b.center.x - b.radius)), xMax: Math.max(...v.barrels.map((b) => b.center.x + b.radius)),
          zMin: Math.min(...v.barrels.map((b) => b.center.z - b.radius)), zMax: Math.max(...v.barrels.map((b) => b.center.z + b.radius)),
        };
        if (!(c.type === 'rect' && rectEq(bb, c))) bad(p.id, 'el rectangle ha de ser la capsa dels barrils');
        break;
      }
      default: out.push(err('unknown-prop-type', `${p.id}: tipus desconegut "${p.type}"`));
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// C. PORTES I FANALS
// ---------------------------------------------------------------------
function checkDoorsAndLights(L, ctx) {
  const out = [];
  const solids = solidsOf(L);
  for (const d of L.DOORS) {
    if (d.kind !== 'visual' || d.state !== 'closed' || d.enterable !== false || d.opensCollision !== false || 'collision' in d) {
      out.push(err('door-state', `${d.id}: a la Fase 1 ha de ser visual, tancada, no enterable i sense obertura a la col·lisió`));
    }
    const b = solids.find((s) => s.id === d.buildingId);
    const f = FACES[d.face];
    if (!b || !f) continue;
    const fp = b.visual.footprint;
    const onFace = eq(f.axis === 'z' ? d.center.z : d.center.x, fp[f.side]);
    const along = f.axis === 'z' ? d.center.x : d.center.z;
    const [lo, hi] = f.axis === 'z' ? [fp.xMin, fp.xMax] : [fp.zMin, fp.zMax];
    if (!onFace || along - d.width / 2 < lo - TOL || along + d.width / 2 > hi + TOL) {
      out.push(err('door-face', `${d.id}: no és sencera sobre la cara ${d.face} de ${b.id}`));
    }
  }
  for (const l of L.LIGHTS) {
    const b = solids.find((s) => s.id === l.mountedOn);
    if (!b) continue;
    const fp = b.visual.footprint;
    const w = l.wallPoint;
    const faces = Object.values(FACES).filter((f) => {
      const [lo, hi] = f.axis === 'z' ? [fp.xMin, fp.xMax] : [fp.zMin, fp.zMax];
      const along = f.axis === 'z' ? w.x : w.z;
      return eq(f.axis === 'z' ? w.z : w.x, fp[f.side]) && along >= lo - TOL && along <= hi + TOL;
    });
    if (faces.length === 0) { out.push(err('lantern-face', `${l.id}: el punt de paret no és sobre cap cara de ${b.id}`)); continue; }
    const [nx, nz] = faces[0].n;
    if (!eq(l.glassPoint.x, w.x + nx * l.armLength) || !eq(l.glassPoint.z, w.z + nz * l.armLength)) {
      out.push(err('lantern-glass', `${l.id}: el vidre ha d'estar a ${l.armLength} m de la paret, en perpendicular`));
    }
    // La col·lisió és 2D: el vidre (a mountHeight) només xoca amb obstacles que arriben tan amunt.
    // (F3, per exemple, és damunt del banc B3, que fa 0,85 m: correcte.)
    const heightOf = (id) => {
      const q = [...L.BUILDINGS, ...L.WALLS, ...L.PROPS].find((i) => i.id === id);
      const v = q ? q.visual : {};
      return v.height ?? v.eaveHeight ?? (v.barrels ? Math.max(...v.barrels.map((x) => x.height)) : 0);
    };
    if (ctx.colliders && ctx.colliders.some((c) => clearance(l.glassPoint.x, l.glassPoint.z, c) <= 0 && heightOf(c.id) > l.mountHeight)) {
      out.push(err('lantern-in-solid', `${l.id}: el vidre és dins un obstacle que arriba a ${l.mountHeight} m`));
    }
    for (const d of L.DOORS) {
      const gap = Math.hypot(w.x - d.center.x, w.z - d.center.z) - d.width / 2;
      if (gap < 1.0 - TOL) out.push(err('lantern-near-door', `${l.id} és a ${gap.toFixed(2)} m de ${d.id} (mínim 1,0 m)`));
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// D. VALORS APROVATS
// ---------------------------------------------------------------------
function checkGolden(L) {
  const out = [];
  const bad = (m) => out.push(err('golden', m));
  const items = [...L.BUILDINGS, ...L.WALLS, ...L.PROPS];
  for (const [id, g] of Object.entries(GOLDEN_COLLISION)) {
    const c = items.find((i) => i.id === id)?.collision;
    if (!c) { bad(`${id}: falta (era un valor aprovat)`); continue; }
    const got = c.type === 'rect' ? ['r', c.xMin, c.xMax, c.zMin, c.zMax] : ['c', c.cx, c.cz, c.radius];
    if (got.length !== g.length || got[0] !== g[0] || g.slice(1).some((v, i) => !eq(v, got[i + 1]))) {
      bad(`${id}: col·lisió ${JSON.stringify(got)} ≠ aprovada ${JSON.stringify(g)}`);
    }
  }
  for (const i of items) if (!(i.id in GOLDEN_COLLISION)) bad(`${i.id}: objecte no aprovat afegit al layout`);
  const tv = L.BUILDINGS.find((b) => b.id === 'CH-T')?.visual.footprint;
  if (!tv || !rectEq(tv, { xMin: -7, xMax: -3, zMin: -13, zMax: -9 })) bad('CH-T: l\'empremta visual ha de ser x −7→−3, z −13→−9');
  if (!rectEq(L.PLAZA.bounds, { xMin: -7, xMax: 7, zMin: -9, zMax: 9 })) bad('PLAZA: ha de ser x −7→7, z −9→9');
  const fnt = L.PROPS.find((p) => p.id === 'FNT');
  if (!fnt || fnt.visual.acrossFlats !== 4 || fnt.visual.center.x !== 0 || fnt.visual.center.z !== 3) bad('FNT: octàgon de 4 m de pla a pla centrat a (0, 3)');
  const p = L.PLAYER;
  if (p.start.x !== 0 || p.start.z !== 27 || p.eyeHeight !== 1.7 || p.collisionRadius !== 0.35 || p.yaw !== 0) bad('PLAYER: inici (0, 27), ulls 1,7, radi 0,35, yaw 0');
  for (const [id, [x, z, face]] of Object.entries(GOLDEN_DOORS)) {
    const d = L.DOORS.find((q) => q.id === id);
    if (!d || d.center.x !== x || d.center.z !== z || d.face !== face) bad(`${id}: ha de ser a (${x}, ${z}) a la cara ${face}`);
  }
  for (const [id, g] of Object.entries(GOLDEN_LIGHTS)) {
    const l = L.LIGHTS.find((q) => q.id === id);
    if (!l || [l.wallPoint.x, l.wallPoint.z, l.glassPoint.x, l.glassPoint.z].some((v, i) => !eq(v, g[i]))) bad(`${id}: punts de paret/vidre diferents dels aprovats`);
  }
  return out;
}

// ---------------------------------------------------------------------
// QUADRÍCULA: espai lliure, accessibilitat per al cercle del jugador
// ---------------------------------------------------------------------
function flood(passable, nx, nz, startIdx) {
  const visited = new Uint8Array(passable.length);
  if (!passable[startIdx]) return visited;
  const queue = new Int32Array(passable.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIdx;
  visited[startIdx] = 1;
  while (head < tail) {
    const k = queue[head++];
    const i = k % nx;
    const j = (k - i) / nx;
    const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < nz - 1 ? k + nx : -1];
    for (const m of nb) if (m >= 0 && passable[m] && !visited[m]) { visited[m] = 1; queue[tail++] = m; }
  }
  return visited;
}

function computeGrid(colliders, radius, start, cell) {
  const nx = Math.round((GRID.xMax - GRID.xMin) / cell);
  const nz = Math.round((GRID.zMax - GRID.zMin) / cell);
  const free0 = new Uint8Array(nx * nz);   // espai lliure (el cos és un punt)
  const free35 = new Uint8Array(nx * nz);  // posicions possibles del CENTRE del jugador
  for (let j = 0; j < nz; j++) {
    const z = GRID.zMin + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = GRID.xMin + (i + 0.5) * cell;
      let m = Infinity;
      for (const c of colliders) {
        if (x < c.xMin - radius || x > c.xMax + radius || z < c.zMin - radius || z > c.zMax + radius) continue;
        const d = clearance(x, z, c);
        if (d < m) m = d;
      }
      free0[j * nx + i] = m > 1e-6 ? 1 : 0;
      free35[j * nx + i] = m >= radius ? 1 : 0;
    }
  }
  const si = Math.floor((start.x - GRID.xMin) / cell);
  const sj = Math.floor((start.z - GRID.zMin) / cell);
  const startIdx = sj * nx + si;
  const r0 = flood(free0, nx, nz, startIdx);
  const r35 = flood(free35, nx, nz, startIdx);
  const index = (x, z) => {
    const i = Math.floor((x - GRID.xMin) / cell);
    const j = Math.floor((z - GRID.zMin) / cell);
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
  };
  return { cell, nx, nz, free0, free35, r0, r35, index, radius, startFree: !!free35[startIdx] };
}

const count = (a) => { let n = 0; for (let i = 0; i < a.length; i++) n += a[i]; return n; };

// ---------------------------------------------------------------------
// E. SOLAPAMENTS I PASSOS ESTRETS
// ---------------------------------------------------------------------
function checkGeometry(L, ctx) {
  const out = [];
  const cs = ctx.colliders;
  for (let a = 0; a < cs.length; a++) {
    for (let b = a + 1; b < cs.length; b++) {
      if (collidersOverlap(cs[a], cs[b])) out.push(err('overlap', `${cs[a].id} i ${cs[b].id} es solapen`));
    }
  }
  // Passos estrets: dos obstacles que es MIREN (les seves projeccions es solapen)
  // separats per menys de COMFORT_GAP, amb espai lliure entremig.
  const g = ctx.grid;
  const R = L.PLAYER.collisionRadius;
  let narrowest = Infinity;
  for (let a = 0; a < cs.length; a++) {
    for (let b = a + 1; b < cs.length; b++) {
      const A = cs[a];
      const B = cs[b];
      const gx = Math.max(A.xMin - B.xMax, B.xMin - A.xMax);
      const gz = Math.max(A.zMin - B.zMax, B.zMin - A.zMax);
      const ox = Math.min(A.xMax, B.xMax) - Math.max(A.xMin, B.xMin);
      const oz = Math.min(A.zMax, B.zMax) - Math.max(A.zMin, B.zMin);
      let width = null;
      let mid = null;
      if (gx > 1e-6 && oz > 0.05) {
        width = gx;
        mid = [(Math.min(A.xMax, B.xMax) + Math.max(A.xMin, B.xMin)) / 2, (Math.min(A.zMax, B.zMax) + Math.max(A.zMin, B.zMin)) / 2];
      } else if (gz > 1e-6 && ox > 0.05) {
        width = gz;
        mid = [(Math.min(A.xMax, B.xMax) + Math.max(A.xMin, B.xMin)) / 2, (Math.min(A.zMax, B.zMax) + Math.max(A.zMin, B.zMin)) / 2];
      }
      if (width === null || width >= COMFORT_GAP) continue;
      if (g.perimeterOpen) continue;
      // el punt mig de la franja ha d'estar dins l'espai jugable
      const mx = width === gx ? (A.xMin > B.xMax ? (A.xMin + B.xMax) / 2 : (B.xMin + A.xMax) / 2) : mid[0];
      const mz = width === gz ? (A.zMin > B.zMax ? (A.zMin + B.zMax) / 2 : (B.zMin + A.zMax) / 2) : mid[1];
      const k = g.index(mx, mz);
      if (k < 0 || !g.r0[k]) continue;
      narrowest = Math.min(narrowest, width);
      const kind = width < 2 * R ? 'IMPASSABLE per al jugador' : `marge efectiu ${(width - 2 * R).toFixed(2)} m, massa just`;
      out.push(err('narrow-passage', `${A.id} i ${B.id}: pas de ${width.toFixed(2)} m (${kind})`));
    }
  }
  ctx.info.push(Number.isFinite(narrowest) ? `pas més estret: ${narrowest.toFixed(2)} m` : `cap pas més estret de ${COMFORT_GAP} m entre obstacles que es miren`);
  return out;
}

// ---------------------------------------------------------------------
// F. PERÍMETRE, ACCESSIBILITAT I RACONS MORTS
// ---------------------------------------------------------------------
function checkGrid(L, ctx) {
  const out = [];
  const g = ctx.grid;
  const R = L.PLAYER.collisionRadius;
  if (!g.startFree) { out.push(err('start-blocked', "la posició d'inici no és lliure per al jugador")); return out; }

  if (g.perimeterOpen) {
    out.push(err('perimeter-open', "el recinte NO és tancat: des de l'inici es pot arribar a la vora de la graella"));
    return out;
  }
  const cellArea = g.cell * g.cell;
  ctx.info.push(`espai lliure tancat: ${(count(g.r0) * cellArea).toFixed(1)} m²; accessible pel centre del jugador: ${(count(g.r35) * cellArea).toFixed(1)} m²`);

  // punts d'interès accessibles
  const pois = [
    ['inici', [L.PLAYER.start.x, L.PLAYER.start.z]], ['davant del cartell', [0, 24.5]], ['boca del carrer', [0, 9.5]],
    ['plaça sud', [0, 7.5]], ['volta de la font (est)', [4.5, 3]], ['volta de la font (oest)', [-3.3, 3]],
    ['banc B3', [2.8, -8]], ['entrada carreró est', [7.5, -8]], ['final carreró est', [14.6, -7.4]],
    ['entrada carreró oest', [-7.5, -2]], ['final carreró oest', [-14.6, -2.4]],
    ['sota el balcó de HB', [6.5, -4]], ["darrere l'arbre", [-4, -2.8]],
  ];
  for (const d of L.DOORS) {
    const f = FACES[d.face];
    if (f) pois.push([`davant de ${d.id}`, [d.center.x + f.n[0] * (R + 0.05), d.center.z + f.n[1] * (R + 0.05)]]);
  }
  const unreachable = [];
  for (const [name, [x, z]] of pois) {
    const k = g.index(x, z);
    if (k < 0 || !g.r35[k]) unreachable.push(name);
  }
  if (unreachable.length) out.push(err('unreachable', `no accessibles des de l'inici: ${unreachable.join(', ')}`));
  ctx.info.push(`${pois.length - unreachable.length}/${pois.length} punts d'interès accessibles amb radi ${R}`);

  // racons morts: espai lliure que el cos del jugador no pot cobrir mai
  // El centre del jugador a la quadrícula pot quedar fins a una cel·la més lluny de la paret
  // que el radi real: es compensa amb una tolerància d'una cel·la en diagonal.
  const reach = R + g.cell * Math.SQRT2;
  const rc = Math.ceil(reach / g.cell);
  const covered = new Uint8Array(g.r0.length);
  for (let j = 0; j < g.nz; j++) {
    for (let i = 0; i < g.nx; i++) {
      if (!g.r35[j * g.nx + i]) continue;
      for (let dj = -rc; dj <= rc; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= g.nz) continue;
        for (let di = -rc; di <= rc; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= g.nx) continue;
          if ((di * g.cell) ** 2 + (dj * g.cell) ** 2 <= reach * reach) covered[jj * g.nx + ii] = 1;
        }
      }
    }
  }
  const pocket = new Uint8Array(g.r0.length);
  for (let k = 0; k < pocket.length; k++) pocket[k] = g.r0[k] && !covered[k] ? 1 : 0;
  const seen = new Uint8Array(pocket.length);
  let biggest = 0;
  for (let k0 = 0; k0 < pocket.length; k0++) {
    if (!pocket[k0] || seen[k0]) continue;
    const comp = flood(pocket.map((v, k) => (v && !seen[k] ? 1 : 0)), g.nx, g.nz, k0);
    let n = 0;
    let si = 0;
    let sj = 0;
    for (let k = 0; k < comp.length; k++) if (comp[k]) { seen[k] = 1; n++; si += k % g.nx; sj += Math.floor(k / g.nx); }
    const area = n * cellArea;
    biggest = Math.max(biggest, area);
    if (area > POCKET_AREA) {
      const cx = GRID.xMin + (si / n + 0.5) * g.cell;
      const cz = GRID.zMin + (sj / n + 0.5) * g.cell;
      out.push(err('dead-pocket', `racó inaccessible de ${area.toFixed(2)} m² prop de (${cx.toFixed(1)}, ${cz.toFixed(1)})`));
    }
  }
  ctx.info.push(`racó inaccessible més gran: ${biggest.toFixed(3)} m² (llindar ${POCKET_AREA} m²)`);
  return out;
}

// ---------------------------------------------------------------------
// G. AMPLES DELS CARRERONS (exactes, per escombrada)
// ---------------------------------------------------------------------
function freeRun(colliders, x, startZ) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const c of colliders) {
    let a;
    let b;
    if (c.isRect) {
      if (!(c.xMin < x && x < c.xMax)) continue;
      a = c.zMin; b = c.zMax;
    } else {
      const d = Math.abs(x - c.cx);
      if (d >= c.radius) continue;
      const h = Math.sqrt(c.radius * c.radius - d * d);
      a = c.cz - h; b = c.cz + h;
    }
    if (a < startZ && startZ < b) return 0;
    if (b <= startZ) lo = Math.max(lo, b);
    else hi = Math.min(hi, a);
  }
  return hi - lo;
}
function checkAlleys(L, ctx) {
  const out = [];
  const cs = ctx.colliders;
  const sweep = (from, to, z) => {
    let min = Infinity;
    for (let x = Math.min(from, to) + 0.025; x < Math.max(from, to); x += 0.05) min = Math.min(min, freeRun(cs, x, z));
    return min;
  };
  const east = { normal: sweep(7, 14.4, -8), end: sweep(14.4, 15, -8) };
  const west = { normal: sweep(-14.4, -7, -2), end: sweep(-15, -14.4, -2) };
  ctx.info.push(`carreró est: ${east.normal.toFixed(3)} m (tram normal), ${east.end.toFixed(3)} m (últims 0,6 m)`);
  ctx.info.push(`carreró oest: ${west.normal.toFixed(3)} m (tram normal), ${west.end.toFixed(3)} m (últims 0,6 m)`);
  for (const [name, w] of [['est', east], ['oest', west]]) {
    if (!eq(w.normal, 2, 1e-6)) out.push(err('alley-width', `carreró ${name}: tram normal de ${w.normal.toFixed(3)} m (ha de ser 2,000)`));
    if (Math.abs(w.end - 1.4) > 0.005) out.push(err('alley-width', `carreró ${name}: últims 0,6 m de ${w.end.toFixed(3)} m (ha de ser 1,400)`));
  }
  return out;
}

// ---------------------------------------------------------------------
// EXECUCIÓ DE TOTES LES COMPROVACIONS
// ---------------------------------------------------------------------
function runAll(L, { cell, skipGolden = false } = {}) {
  const ctx = { info: [], colliders: null, colliderError: '', grid: null };
  try { ctx.colliders = buildColliders(L); } catch (e) { ctx.colliderError = e.message; }
  if (ctx.colliders) {
    try {
      ctx.grid = computeGrid(ctx.colliders, L.PLAYER.collisionRadius, L.PLAYER.start, cell);
      const touches = (m) => {
        const { nx, nz } = ctx.grid;
        for (let i = 0; i < nx; i++) if (m[i] || m[(nz - 1) * nx + i]) return true;
        for (let j = 0; j < nz; j++) if (m[j * nx] || m[j * nx + nx - 1]) return true;
        return false;
      };
      ctx.grid.perimeterOpen = touches(ctx.grid.r0);
    } catch (e) { ctx.colliderError = `graella: ${e.message}`; }
  }
  const sections = [
    ['A. Integritat de les dades', checkIntegrity, false],
    ['B. Visual i col·lisió coherents', checkVisualCollision, false],
    ['C. Portes i fanals', checkDoorsAndLights, false],
    ['D. Valors aprovats', checkGolden, skipGolden],
    ['E. Solapaments i passos estrets', checkGeometry, !ctx.grid],
    ['F. Perímetre, accessibilitat i racons morts', checkGrid, !ctx.grid],
    ['G. Amples dels carrerons', checkAlleys, !ctx.colliders],
  ];
  const results = [];
  for (const [title, fn, skip] of sections) {
    if (skip) { results.push({ title, skipped: true, issues: [], info: [] }); continue; }
    const before = ctx.info.length;
    let issues;
    try { issues = fn(L, ctx); } catch (e) { issues = [err('exception', `${fn.name}: ${e.message}`)]; }
    results.push({ title, issues, info: ctx.info.slice(before) });
  }
  return { results, ctx };
}

// ---------------------------------------------------------------------
// H. MUTACIONS: còpies del layout amb un error a propòsit. El validador HA de fallar.
// ---------------------------------------------------------------------
const MUTATIONS = [
  { name: 'cartell a x = 1,3 (ranura de 0,5 m amb el mur)', expect: 'narrow-passage', skipGolden: true,
    apply: (L) => { const p = L.PROPS.find((q) => q.id === 'CT'); p.visual.center.x = 1.3; p.collision.cx = 1.3; } },
  { name: 'caixa CR1 a la posició antiga (pas de 1,1 m amb la casa C)', expect: 'narrow-passage', skipGolden: true,
    apply: (L) => { const p = L.PROPS.find((q) => q.id === 'CR1'); for (const r of [p.visual.footprint, p.collision]) { r.zMin = 7.3; r.zMax = 7.9; } } },
  { name: 'porta D2 amb obertura a la col·lisió', expect: 'door-state',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D2').opensCollision = true; } },
  { name: 'porta D1 fora de la façana', expect: 'door-face',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').center.z = -8.5; } },
  { name: 'casa B allargada 0,5 m cap al sud (solapa el mur M-E2)', expect: 'overlap', skipGolden: true,
    apply: (L) => { const b = L.BUILDINGS.find((q) => q.id === 'HB'); b.visual.footprint.zMax = -0.5; b.collision.zMax = -0.5; } },
  { name: 'campanar amb la col·lisió sense retallar (solapa la nau)', expect: 'overlap', skipGolden: true,
    apply: (L) => { L.BUILDINGS.find((q) => q.id === 'CH-T').collision.xMax = -3; } },
  { name: 'forat al perímetre (sense el mur M-S2)', expect: 'perimeter-open', skipGolden: true,
    apply: (L) => { L.WALLS.splice(L.WALLS.findIndex((w) => w.id === 'M-S2'), 1); } },
  { name: 'cul-de-sac de 0,5 m d\'ample i 2 m de fons a la plaça (el cos del jugador no hi cap)', expect: 'dead-pocket', skipGolden: true,
    apply: (L) => {
      const add = (id, xMin, xMax, zMin, zMax) => { const r = { type: 'rect', xMin, xMax, zMin, zMax }; L.WALLS.push({ id, visual: { footprint: { ...r }, height: 2.8 }, collision: { ...r } }); };
      add('M-P1', 3.0, 3.4, 4.0, 6.0); add('M-P2', 3.9, 4.3, 4.0, 6.0); add('M-P3', 3.0, 4.3, 6.0, 6.4);
    } },
  { name: 'mur que talla el carrer (la plaça queda inaccessible)', expect: 'unreachable', skipGolden: true,
    apply: (L) => { const r = { type: 'rect', xMin: -2, xMax: 2, zMin: 20, zMax: 20.4 }; L.WALLS.push({ id: 'M-X', visual: { footprint: { ...r }, height: 2.8 }, collision: { ...r } }); } },
  { name: 'font amb radi de col·lisió 2,1 (no cobreix els vèrtexs)', expect: 'fountain-radius',
    apply: (L) => { L.PROPS.find((q) => q.id === 'FNT').collision.radius = 2.1; } },
  { name: 'fanal F3 fora de la façana', expect: 'lantern-face',
    apply: (L) => { L.LIGHTS.find((q) => q.id === 'F3').wallPoint.z = -9.5; } },
  { name: 'ID repetit (B2 passa a dir-se B1)', expect: 'duplicate-id',
    apply: (L) => { L.PROPS.find((q) => q.id === 'B2').id = 'B1'; } },
  { name: 'banc B1: la col·lisió es desvia del visual', expect: 'visual-collision', skipGolden: true,
    apply: (L) => { L.PROPS.find((q) => q.id === 'B1').collision.xMax = 7.1; } },
  { name: 'coordenada aprovada alterada (HA 0,1 m cap a l\'est)', expect: 'golden',
    apply: (L) => { const b = L.BUILDINGS.find((q) => q.id === 'HA'); b.visual.footprint.xMax += 0.1; b.collision.xMax += 0.1; } },
];

// ---------------------------------------------------------------------
// MAPA DE COL·LISIÓ generat a partir de les dades
// ---------------------------------------------------------------------
function printMap(L, ctx) {
  const letters = { 'CH-N': 'E', 'CH-T': 'K', HA: 'A', HB: 'B', HC: 'C' };
  const propLetter = { fountain: 'O', tree: 'Y', bench: 'b', barrel: 'o', barrelPair: 'o', crate: 'x', sign: 'i' };
  for (const w of L.WALLS) letters[w.id] = '#';
  for (const p of L.PROPS) letters[p.id] = propLetter[p.type] || '?';
  const prio = (c) => (letters[c.id] === '#' ? 2 : /[EKABC]/.test(letters[c.id]) ? 1 : 0);
  const CW = 0.5;
  const CH = 1.0;
  const cols = Math.round((GRID.xMax - GRID.xMin) / CW);
  const rows = Math.round((GRID.zMax - GRID.zMin) / CH);
  const marks = new Map();
  const put = (x, z, ch) => marks.set(`${Math.floor((x - GRID.xMin) / CW)},${Math.floor((z - GRID.zMin) / CH)}`, ch);
  for (const l of L.LIGHTS) put(l.glassPoint.x, l.glassPoint.z, 'L');
  for (const d of L.DOORS) { const f = FACES[d.face]; put(d.center.x + f.n[0] * 0.25, d.center.z + f.n[1] * 0.25, 'D'); }
  put(L.PLAYER.start.x, L.PLAYER.start.z, 'S');
  const bal = L.BUILDINGS.map((b) => b.visual.balcony?.footprint).filter(Boolean);
  const hits = (c, x0, x1, z0, z1) => {
    if (c.isRect) return Math.min(x1, c.xMax) - Math.max(x0, c.xMin) > 1e-9 && Math.min(z1, c.zMax) - Math.max(z0, c.zMin) > 1e-9;
    return Math.hypot(Math.max(x0 - c.cx, c.cx - x1, 0), Math.max(z0 - c.cz, c.cz - z1, 0)) < c.radius - 1e-9;
  };
  console.log('\nMapa de col·lisió (cel·la = 0,5 m en X × 1,0 m en Z; nord a dalt)');
  console.log('E nau · K campanar · A B C cases · # mur · O font · Y arbre · b banc · o barril · x caixa · i cartell · D porta · L fanal · S inici · ~ sota el balcó · . transitable');
  let ruler = '      ';
  for (let c = 0; c < cols; c += 8) ruler += String(GRID.xMin + c * CW).padEnd(8);
  console.log(ruler);
  for (let r = 0; r < rows; r++) {
    const z0 = GRID.zMin + r * CH;
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x0 = GRID.xMin + c * CW;
      const mark = marks.get(`${c},${r}`);
      if (mark) { line += mark; continue; }
      const hit = ctx.colliders.filter((q) => hits(q, x0, x0 + CW, z0, z0 + CH)).sort((a, b) => prio(a) - prio(b))[0];
      if (hit) { line += letters[hit.id]; continue; }
      const k = ctx.grid.index(x0 + CW / 2, z0 + CH / 2);
      if (k >= 0 && ctx.grid.r0[k]) {
        line += bal.some((b) => x0 >= b.xMin && x0 < b.xMax && z0 >= b.zMin && z0 < b.zMax) ? '~' : '.';
      } else line += ' ';
    }
    line = line.trimEnd();
    if (line) console.log(String(z0).padStart(4) + '  ' + line);
  }
}

// ---------------------------------------------------------------------
// PRINCIPAL
// ---------------------------------------------------------------------
const started = Date.now();
const main = runAll(pickLayout(LAYOUT), { cell: MAIN_CELL });
let errors = 0;
console.log('VALIDACIÓ DEL LAYOUT (src/world/layout.js)\n');
for (const s of main.results) {
  if (s.skipped) { console.log(`${s.title}\n  (omesa: depèn d'una secció anterior)`); errors++; continue; }
  console.log(`${s.title}\n  ${s.issues.length === 0 ? '✓ OK' : `✗ ${s.issues.length} error(s)`}`);
  for (const i of s.issues) { console.log(`    ✗ [${i.code}] ${i.message}`); errors++; }
  for (const line of s.info) console.log(`    · ${line}`);
}

console.log('\nH. Mutacions (el validador ha de detectar cada error introduït a propòsit)');
let survived = 0;
for (const m of MUTATIONS) {
  const copy = structuredClone(pickLayout(LAYOUT));
  m.apply(copy);
  const res = runAll(copy, { cell: MUTATION_CELL, skipGolden: !!m.skipGolden });
  const codes = new Set(res.results.flatMap((s) => s.issues.map((i) => i.code)));
  const caught = codes.has(m.expect);
  if (!caught) survived++;
  console.log(`  ${caught ? '✓ detectada ' : '✗ NO DETECTADA'} [${m.expect}] ${m.name}${caught ? '' : `  (codis obtinguts: ${[...codes].join(', ') || 'cap'})`}`);
}
errors += survived;

if (main.ctx.colliders && main.ctx.grid && !main.ctx.grid.perimeterOpen) printMap(pickLayout(LAYOUT), main.ctx);

console.log(`\nResum: ${errors === 0 ? '✓ TOT CORRECTE' : `✗ ${errors} problema(es)`} · ${MUTATIONS.length - survived}/${MUTATIONS.length} mutacions detectades · ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(errors === 0 ? 0 : 1);
