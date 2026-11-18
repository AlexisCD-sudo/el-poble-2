// =====================================================================
// VALIDADOR DEL LAYOUT  (npm run check:layout  →  node tools/validate-layout.js)
// =====================================================================
// Comprova que les dades de src/world/layout.js són coherents i que el
// món és jugable, sense obrir el navegador. Sense dependències.
//
//   A. Integritat de les dades        E. Solapaments i passos estrets
//   B. Visual i col·lisió coherents   F. Perímetre, accessibilitat i racons
//   C. Portes i fanals                G. Amples dels carrerons
//   C2. Porta de fulles (D1 swing)
//   C3. Interiors: mobles, claus i porta secreta (Fase B)
//   D. Valors aprovats ("golden")     H. Mutacions (el validador es prova a si mateix)
//   I. Cementiri (Fase D.2): murs, perímetre segellat, reixa tancada, cartell CT2, camins, passos
//
// Surt amb codi 1 si hi ha algun error. Al final imprimeix el mapa de
// col·lisió generat a partir de les dades.
// =====================================================================
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, clearance, collidersOverlap, isActive, isPositionFree, makeCollider, setSegment } from '../src/player/collisions.js';

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
  BUILDINGS: L.BUILDINGS, WALLS: L.WALLS, PROPS: L.PROPS, FURNITURE: L.FURNITURE, SECRET_DOOR: L.SECRET_DOOR, KEYS: L.KEYS, DOORS: L.DOORS,
  LIGHTS: L.LIGHTS, STAIRS: L.STAIRS, FLOORS: L.FLOORS, PLAYER: L.PLAYER, PLAZA: L.PLAZA, LAYOUT_META: L.LAYOUT_META,
  // Fase D.2: cementiri (les seccions A–G continuen analitzant només el poble; la secció I analitza el cementiri)
  CEM_AREA: L.CEM_AREA, CEM_WALLS: L.CEM_WALLS, CEM_GATE: L.CEM_GATE, CEM_REAR_GATE: L.CEM_REAR_GATE, CEM_PROPS: L.CEM_PROPS, CEM_PATHS: L.CEM_PATHS,
});
const solidsOf = (L) => [...L.BUILDINGS, ...L.WALLS];
// `collision` d'un objecte: una forma o (església, Fase A) una llista de formes amb `id`.
const partsOf = (item) => (Array.isArray(item.collision) ? item.collision : item.collision ? [{ ...item.collision, id: item.id }] : []);
// Totes les formes de col·lisió del layout amb el seu id (les parts d'un objecte compost surten per separat).
const allShapes = (L) => [...L.BUILDINGS, ...L.WALLS, ...L.PROPS, ...L.FURNITURE, ...(L.STAIRS || [])].flatMap(partsOf);
const inRect = (x, z, r) => x >= r.xMin - TOL && x <= r.xMax + TOL && z >= r.zMin - TOL && z <= r.zMax + TOL;

// ---------------------------------------------------------------------
// VALORS APROVATS (snapshot de l'auditoria geomètrica)
// 'r' = rectangle [xMin, xMax, zMin, zMax]; 'c' = cercle [cx, cz, radi]
// ---------------------------------------------------------------------
const GOLDEN_COLLISION = {
  // Nau: 5 parets (el bloc sòlid únic ja no existeix); interior x −3→3, z −20,4→−9,6; pas de D1 x −1,1→1,1.
  'CH-N-W': ['r', -4, -3, -20.4, -9.6], 'CH-N-E': ['r', 3, 4, -20.4, -9.6], 'CH-N-B': ['r', -4, 4, -21, -20.4],
  'CH-N-FW': ['r', -4, -1.1, -9.6, -9], 'CH-N-FE': ['r', 1.1, 4, -9.6, -9],
  'CH-T': ['r', -7, -4, -13, -9],
  // Cases A i B accessibles (Fase B): parets de 0,4 m; pas de D2 (z −6,6→−5,4) i de D3 (z −4,6→−3,4) de 1,2 m.
  'HA-W': ['r', -12, -11.6, -9, -3], 'HA-N': ['r', -11.6, -7, -9, -8.6], 'HA-S': ['r', -11.6, -7, -3.4, -3],
  'HA-EN': ['r', -7.4, -7, -8.6, -6.6], 'HA-ES': ['r', -7.4, -7, -5.4, -3.4],
  'HB-E': ['r', 11.6, 12, -7, -1], 'HB-N': ['r', 7, 11.6, -7, -6.6], 'HB-S': ['r', 7, 11.6, -1.4, -1],
  'HB-WN': ['r', 7, 7.4, -6.6, -4.6], 'HB-WS': ['r', 7, 7.4, -3.4, -1.4],
  'HC-E': ['r', 6.6, 7, 9, 15], 'HC-N': ['r', 2.4, 6.6, 9, 9.4], 'HC-S': ['r', 2.4, 6.6, 14.6, 15], 'HC-WN': ['r', 2, 2.4, 9, 11.5], 'HC-WS': ['r', 2, 2.4, 12.5, 15],
  'HC-STR': ['r', 5.32, 5.42, 10.9, 13.3], 'HC-RAIL': ['r', 5.32, 5.42, 13.3, 14.6],
  'B-TAB': ['r', 10.6, 11.6, -6.6, -5.95], 'B-SHELF': ['r', 9.85, 11.6, -1.8, -1.4], 'A-SHELF': ['r', -8.65, -7.4, -3.8, -3.4],
  'C-COFFER': ['r', 2.4, 2.9, 9.4, 10.4], 'C-CAB1': ['r', 2.9, 3.9, 9.4, 9.95], 'C-SHELF': ['r', 3.9, 5.32, 9.4, 9.8], 'C-STORE': ['r', 5.32, 6.6, 9.4, 10.9],
  'C-TABLE': ['r', 3.4, 4.4, 11.3, 12.7], 'C-CH1': ['r', 3.45, 3.85, 10.85, 11.3], 'C-CH2': ['r', 3.95, 4.35, 10.85, 11.3], 'C-CH3': ['r', 3.45, 3.85, 12.7, 13.15], 'C-CH4': ['r', 3.95, 4.35, 12.7, 13.15],
  'C-DRS': ['r', 2.4, 3.6, 14.1, 14.6], 'C-CAB2': ['r', 3.6, 4.3, 14.1, 14.6],
  'C-U-BED': ['r', 2.4, 3.9, 12.65, 14.6], 'C-U-NIGHT': ['r', 3.9, 4.4, 14, 14.6], 'C-U-WARD': ['r', 4.4, 5.32, 14, 14.6], 'C-U-DRS': ['r', 2.4, 3.6, 9.4, 9.95],
  // Mobles (Fase B): 8 bancs, altar i mobles de les cases A i B.
  'PEW-W1': ['r', -3, -1.6, -11.95, -11.4], 'PEW-E1': ['r', 1.6, 3, -11.95, -11.4],
  'PEW-W2': ['r', -3, -1.6, -13.75, -13.2], 'PEW-E2': ['r', 1.6, 3, -13.75, -13.2],
  'PEW-W3': ['r', -3, -1.6, -15.55, -15], 'PEW-E3': ['r', 1.6, 3, -15.55, -15],
  'PEW-W4': ['r', -3, -1.6, -17.35, -16.8], 'PEW-E4': ['r', 1.6, 3, -17.35, -16.8],
  ALT: ['r', -0.9, 0.9, -19.15, -18.45],
  'A-DRS': ['r', -11.6, -10.4, -8.6, -8.1], 'A-CAB': ['r', -11.6, -11.1, -4.8, -3.4], 'A-TAB': ['r', -9.85, -8.65, -4.2, -3.4], 'A-CRT': ['r', -8.3, -7.4, -8.6, -7.8],
  'B-BED': ['r', 7.4, 9.4, -6.6, -5.6], 'B-CHS': ['r', 10.9, 11.6, -4.7, -3.3], 'B-CAB': ['r', 8.65, 9.85, -1.9, -1.4],
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
// Porta de fulles de D1 (valors aprovats de la Fase A2).
// Porta secreta i claus (Fase B).
// Passos aprovats de menys de COMFORT_GAP (decisió de disseny, Fase C): [id, id, ample mínim]. A la planta baixa de la casa C
// la taula (1,0 m) queda entre la paret oest i l'escala (només 2,92 m de sala): 1,0 m de pas = 0,3 m de marge al cos del jugador; l'escala fa 1,18 m d'ample.
const ALLOWED_NARROW = [['HC-WN', 'C-TABLE', 1.0], ['HC-WS', 'C-TABLE', 1.0], ['C-TABLE', 'HC-STR', 0.9], ['HC-E', 'HC-STR', 1.18]];
const GOLDEN_PUZZLE = { door: { x: 0, z: -20.4, width: 1.4, height: 2.6 }, slotX: [-0.95, 0.95], keys: { 'KEY-A': 'A-DRS', 'KEY-B': 'B-CHS' } };
const GOLDEN_SWING = { hingeX: 1.17, hingeZ: -9.705, leafLength: 1.16, minAngleDeg: 0, maxAngleDeg: 170, initialAngleDeg: 80 };
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
  })([L.BUILDINGS, L.WALLS, L.PROPS, L.FURNITURE, L.SECRET_DOOR, L.KEYS, L.DOORS, L.LIGHTS, L.PLAYER, L.PLAZA]);
  const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dups.length) out.push(err('duplicate-id', `IDs repetits: ${dups.join(', ')}`));
  out.push(...[]);
  ctx.info.push(`${ids.length} IDs, ${L.BUILDINGS.length} edificis, ${L.WALLS.length} murs, ${L.PROPS.length} atrezzo, ${L.FURNITURE.length} mobles, ${L.KEYS.length} claus, ${L.DOORS.length} portes, ${L.LIGHTS.length} fanals`);

  for (const item of [...L.BUILDINGS, ...L.WALLS, ...L.PROPS, ...L.FURNITURE]) {
    if (!item.visual) out.push(err('missing-field', `${item.id}: falta "visual"`));
    if (!item.collision) out.push(err('missing-field', `${item.id}: falta "collision"`));
    if (Array.isArray(item.collision)) {
      for (const part of item.collision) if (!part || typeof part.id !== 'string' || part.type !== 'rect') out.push(err('missing-field', `${item.id}: cada part de "collision" ha de ser un rectangle amb "id"`));
    }
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
    if (Array.isArray(c)) {
      // Col·lisió composta (nau): les parts omplen l'empremta MENYS l'interior MENYS el pas de la porta, sense solapar-se.
      const box = { xMin: Math.min(...c.map((r) => r.xMin)), xMax: Math.max(...c.map((r) => r.xMax)), zMin: Math.min(...c.map((r) => r.zMin)), zMax: Math.max(...c.map((r) => r.zMax)) };
      const it = b.visual.interior?.footprint;
      if (!rectEq(v, box)) bad(b.id, 'les parts de col·lisió no abasten exactament l\'empremta visual');
      if (!it) { bad(b.id, 'falta visual.interior.footprint (l\'interior lliure)'); continue; }
      const area = (r) => (r.xMax - r.xMin) * (r.zMax - r.zMin);
      const door = L.DOORS.find((d) => d.buildingId === b.id && d.enterable);
      const f = door && FACES[door.face];
      const doorArea = door && f ? door.width * Math.abs(v[f.side] - it[f.side]) : 0;
      const expected = area(v) - area(it) - doorArea;
      const got = c.reduce((sum, r) => sum + area(r), 0);
      if (!eq(got, expected, 1e-6)) bad(b.id, `àrea de les parets ${got.toFixed(3)} m² ≠ empremta − interior − pas de la porta (${expected.toFixed(3)} m²)`);
      for (const r of c) if (collidersOverlap({ ...r, isRect: true }, { ...it, isRect: true })) bad(b.id, `${r.id} entra dins l'interior lliure`);
    } else if (b.id === 'CH-T') {
      const nave = L.BUILDINGS.find((x) => x.id === 'CH-N');
      const trimmed = eq(c.xMin, v.xMin) && eq(c.zMin, v.zMin) && eq(c.zMax, v.zMax) && c.xMax <= v.xMax + TOL;
      // El tros retallat (x c.xMax→v.xMax) ha de ser dins de les parets de la nau (mostreig cada 5 cm).
      let covered = !!nave;
      for (let x = c.xMax + 0.025; covered && x < v.xMax; x += 0.05) {
        for (let z = v.zMin + 0.025; z < v.zMax; z += 0.05) if (!partsOf(nave).some((r) => inRect(x, z, r))) { covered = false; break; }
      }
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
// Ample lliure (entre obstacles) al llarg d'un eix horitzontal a z fixa (per a portes N/S).
function freeRunX(colliders, z, startX) {
  let lo = -Infinity;
  let hi = Infinity;
  for (const c of colliders) {
    let a;
    let b;
    if (c.isRect) {
      if (!(c.zMin < z && z < c.zMax)) continue;
      a = c.xMin; b = c.xMax;
    } else {
      const d = Math.abs(z - c.cz);
      if (d >= c.radius) continue;
      const h = Math.sqrt(c.radius * c.radius - d * d);
      a = c.cx - h; b = c.cx + h;
    }
    if (a < startX && startX < b) return 0;
    if (b <= startX) lo = Math.max(lo, b);
    else hi = Math.min(hi, a);
  }
  return hi - lo;
}

// Una porta enterable ha de tenir una obertura REAL: ample suficient i un camí lliure per al cos del jugador.
function checkDoorPassage(L, ctx, d, f) {
  const out = [];
  const R = L.PLAYER.collisionRadius;
  const [nx, nz] = f.n;
  // 1) l'obertura a mig gruix de la paret, com a mínim tan ampla com la porta
  const mid = [d.center.x - nx * 0.3, d.center.z - nz * 0.3];
  const run = f.axis === 'z' ? freeRunX(ctx.colliders, mid[1], mid[0]) : freeRun(ctx.colliders, mid[0], mid[1]);
  if (run < d.width - 1e-6) out.push(err('door-opening', `${d.id}: l'obertura de la col·lisió és de ${Number.isFinite(run) ? run.toFixed(2) : '∞'} m i la porta en demana ${d.width}`));
  // 2) camí recte del cos del jugador: 1 m a fora → 3 m a dins, pel centre de la porta
  let blockedAt = null;
  const depth = d.house ? 0.9 : 3; // portes de casa: només el llindar i el replà; la resta la cobreix la graella
  for (let t = -1; t <= depth && blockedAt === null; t += 0.05) {
    if (!isPositionFree(d.center.x - nx * t, d.center.z - nz * t, R, ctx.colliders)) blockedAt = t;
  }
  if (blockedAt !== null) out.push(err('door-opening', `${d.id}: el jugador (radi ${R}) no pot travessar la porta (bloquejat a ${blockedAt.toFixed(2)} m)`));
  return out;
}
function checkDoorsAndLights(L, ctx) {
  const out = [];
  const solids = solidsOf(L);
  for (const d of L.DOORS) {
    // Dos estats vàlids: TANCADA (visual, no enterable, sense obertura) o OBERTA i enterable (amb obertura real).
    const okClosed = d.kind === 'visual' && d.state === 'closed' && d.enterable === false && d.opensCollision === false;
    const okOpen = d.kind === 'visual' && d.state === 'open' && d.enterable === true && d.opensCollision === true;
    // Fase C: porta de casa (house) tancada però enterable: la fulla és un bloc dinàmic que s'obre amb E.
    const okHouse = d.kind === 'visual' && d.state === 'closed' && d.enterable === true && d.opensCollision === true && !!d.house && d.house.block && d.house.block.type === 'rect';
    if ((!okClosed && !okOpen && !okHouse) || 'collision' in d) {
      out.push(err('door-state', `${d.id}: ha de ser tancada (no enterable), oberta i enterable, o porta de casa (tancada amb bloc dinàmic i obertura real)`));
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
    if (d.enterable && ctx.colliders) out.push(...checkDoorPassage(L, ctx, d, f));
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
// C2. PORTA DE FULLES (D1): dades de `swing` coherents amb la geometria
// ---------------------------------------------------------------------
// Comprova, sense obrir el navegador, que les dues fulles de fusta poden girar en tot el seu
// recorregut sense travessar cap paret, que tancades cobreixen el pas, i que a l'estat
// inicial (mig oberta) i obert el cos del jugador hi passa. Reutilitza makeCollider/setSegment
// de collisions.js (les mateixes càpsules que fa servir el joc).
function checkDoorSwing(L, ctx) {
  const out = [];
  const f = (code, m) => out.push(err(code, m));
  const NUM = ['hingeX', 'hingeZ', 'leafLength', 'leafThickness', 'collisionHalfThickness', 'minAngleDeg', 'maxAngleDeg',
    'initialAngleDeg', 'openTargetDeg', 'maxPushSpeed', 'smoothTime', 'maxSpeed', 'interactDistance'];
  const R = L.PLAYER.collisionRadius;
  let n = 0;
  for (const d of L.DOORS) {
    const sw = d.swing;
    if (!sw) continue;
    n++;
    if (!(d.style === 'arch' && d.state === 'open' && d.enterable && d.face === 'south')) { f('door-swing-scope', `${d.id}: només una porta d'arc oberta i enterable a la cara sud pot tenir fulles mòbils`); continue; }
    const bad = NUM.filter((k) => typeof sw[k] !== 'number' || !Number.isFinite(sw[k]));
    if (bad.length) { f('door-swing-range', `${d.id}.swing: falten números (${bad.join(', ')})`); continue; }
    if (!(sw.minAngleDeg >= 0 && sw.maxAngleDeg <= 180 && sw.minAngleDeg <= sw.maxAngleDeg)) f('door-swing-range', `${d.id}: els angles han d'estar dins de 0°–180° i mín ≤ màx (hi ha ${sw.minAngleDeg}°…${sw.maxAngleDeg}°)`);
    if (!(sw.openTargetDeg >= sw.minAngleDeg && sw.openTargetDeg <= sw.maxAngleDeg)) f('door-swing-range', `${d.id}: l'angle d'obertura amb E (${sw.openTargetDeg}°) és fora dels límits`);
    if (!(sw.initialAngleDeg > sw.minAngleDeg + 10 && sw.initialAngleDeg < sw.maxAngleDeg - 10)) f('door-swing-initial', `${d.id}: la porta ha de començar MIG OBERTA (inicial ${sw.initialAngleDeg}°, entre ${sw.minAngleDeg}° i ${sw.maxAngleDeg}°)`);
    if (!(sw.maxPushSpeed > 0 && sw.smoothTime > 0 && sw.maxSpeed > 0 && sw.interactDistance > 0 && sw.leafThickness > 0 && sw.collisionHalfThickness > 0)) f('door-swing-range', `${d.id}: velocitats, temps, distància i gruixos han de ser positius`);
    // Frontisses i tancament: fora del pas, i les dues fulles tancades han de cobrir-lo sense solapar-se.
    if (!(sw.hingeX >= d.width / 2 - TOL)) f('door-swing-hinge', `${d.id}: la frontissa (x ±${sw.hingeX}) ha de ser fora del pas (±${d.width / 2})`);
    const meet = sw.hingeX - sw.leafLength;
    if (!(meet >= 0 && meet <= 0.05)) f('door-swing-closure', `${d.id}: tancades, les fulles s'han de trobar al mig amb una junta de 0–5 cm (ara ${(meet * 100).toFixed(1)} cm)`);
    // Les fulles són DINS la nau: darrere de la cara interior de la façana.
    const b = [...L.BUILDINGS].find((q) => q.id === d.buildingId);
    const it = b && b.visual.interior && b.visual.interior.footprint;
    if (!it) { f('door-swing-wall', `${d.id}: falta l'interior de l'edifici`); continue; }
    // Recorregut complet de cada fulla: cap solapament amb obstacles estàtics (parets, campanar, etc.).
    const statics = ctx.colliders ? ctx.colliders : [];
    const leaves = [-1, 1].map((side) => makeCollider(`${d.id}-leaf`, { type: 'segment', x1: 0, z1: 0, x2: 0, z2: 0, halfThickness: sw.collisionHalfThickness }));
    const place = (c, side, a) => setSegment(c, d.center.x + side * sw.hingeX, sw.hingeZ, d.center.x + side * sw.hingeX - side * Math.cos(a) * sw.leafLength, sw.hingeZ - Math.sin(a) * sw.leafLength);
    let hit = null;
    for (let a = sw.minAngleDeg; a <= sw.maxAngleDeg + 1e-9 && !hit; a += 1) {
      for (const [k, side] of [-1, 1].entries()) {
        place(leaves[k], side, (a * Math.PI) / 180);
        const o = statics.find((c) => collidersOverlap(leaves[k], c));
        if (o) { hit = `${a}° (${side < 0 ? 'oest' : 'est'}) toca ${o.id}`; break; }
      }
    }
    if (hit) f('door-swing-wall', `${d.id}: una fulla travessa un obstacle a ${hit}`);
    if (!(sw.hingeZ + sw.collisionHalfThickness < it.zMax - TOL)) f('door-swing-wall', `${d.id}: la fulla (z fins a ${(sw.hingeZ + sw.collisionHalfThickness).toFixed(3)}) ha de quedar dins la nau (a l'interior de z < ${it.zMax})`);
    // El pas pel centre de la porta (1 m a fora → 3 m a dins) és lliure a l'estat inicial i a l'obert; tancada, bloquejat.
    const pathFree = (angDeg) => {
      place(leaves[0], -1, (angDeg * Math.PI) / 180); place(leaves[1], 1, (angDeg * Math.PI) / 180);
      const all = [...statics, ...leaves];
      for (let z = d.center.z + 1; z >= sw.hingeZ - 3; z -= 0.05) if (!isPositionFree(d.center.x, z, R, all)) return z;
      return null;
    };
    for (const [label, ang] of [['inicial', sw.initialAngleDeg], ['oberta amb E', sw.openTargetDeg]]) {
      const z = ctx.colliders ? pathFree(ang) : null;
      if (z !== null) f('door-swing-passage', `${d.id}: amb la porta ${label} (${ang}°) el jugador (radi ${R}) no pot passar pel centre (bloquejat a z = ${z.toFixed(2)})`);
    }
    if (ctx.colliders && sw.minAngleDeg === 0 && pathFree(0) === null) f('door-swing-closed-gap', `${d.id}: tancada (0°) les fulles no bloquegen el pas`);
  }
  ctx.info.push(`${n} porta(es) amb fulles mòbils; recorregut 0°–180° comprovat cada 1°`);
  return out;
}

// ---------------------------------------------------------------------
// C3. INTERIORS (Fase B): mobles, claus i porta secreta
// ---------------------------------------------------------------------
const FURN_TYPES = ['pew', 'altar', 'dresser', 'cabinet', 'table', 'crate', 'bed', 'chest', 'shelf', 'coffer', 'store', 'chair', 'bench', 'dresser2', 'bed2', 'nightstand', 'wardrobe'];
function checkInteriors(L, ctx) {
  const out = [];
  const f = (code, m) => out.push(err(code, m));
  const R = L.PLAYER.collisionRadius;
  const g = ctx.grid;
  const reach = (x, z) => { const k = g ? g.index(x, z) : -1; return k >= 0 && g.r35[k] === 1; };
  const nave = L.BUILDINGS.find((b) => b.id === 'CH-N');
  const it = nave.visual.interior.footprint;
  const d1 = L.DOORS.find((d) => d.id === 'D1');

  // --- Mobles: dins del seu interior, mateixa empremta visual i de col·lisió, tipus conegut ---
  for (const m of L.FURNITURE) {
    if (!FURN_TYPES.includes(m.type)) f('unknown-furniture-type', `${m.id}: tipus desconegut "${m.type}"`);
    const b = L.BUILDINGS.find((q) => q.id === m.buildingId);
    const inner = b && b.visual.interior && b.visual.interior.footprint;
    if (!inner) { f('furniture-building', `${m.id}: l'edifici "${m.buildingId}" no té interior accessible`); continue; }
    if (!(m.collision.type === 'rect' && rectEq(m.visual.footprint, m.collision))) f('visual-collision', `${m.id}: empremta visual i de col·lisió diferents`);
    const r = m.collision;
    if (r.xMin < inner.xMin - TOL || r.xMax > inner.xMax + TOL || r.zMin < inner.zMin - TOL || r.zMax > inner.zMax + TOL) f('furniture-outside', `${m.id}: surt de l'interior de ${b.id}`);
  }
  // --- Passadís central de l'església: cap banc ni altar al camí de la porta cap a l'altar ---
  const aisle = { xMin: d1.center.x - d1.width / 2, xMax: d1.center.x + d1.width / 2, zMin: it.zMin, zMax: it.zMax };
  for (const m of L.FURNITURE.filter((q) => q.buildingId === 'CH-N' && q.type !== 'altar')) {
    if (collidersOverlap({ ...m.collision, isRect: true }, { ...aisle, isRect: true })) f('aisle-blocked', `${m.id} tapa el passadís central de l'església`);
  }
  const alt = L.FURNITURE.find((q) => q.type === 'altar');
  if (!alt) f('altar-missing', "falta l'altar");
  else {
    // Es pot caminar per darrere (fins a la porta secreta) i per les bandes: mínim 1,2 m a la paret del fons i a cada paret lateral.
    if (alt.collision.zMin - it.zMin < 1.2 - 1e-6) f('altar-clearance', `l'altar és a ${(alt.collision.zMin - it.zMin).toFixed(2)} m de la paret del fons (mínim 1,2 m)`);
    if (alt.collision.xMin - it.xMin < 1.2 - 1e-6 || it.xMax - alt.collision.xMax < 1.2 - 1e-6) f('altar-clearance', "l'altar és massa a prop d'una paret lateral (mínim 1,2 m)");
  }
  // --- Porta secreta: sobre la cara interior de la paret del fons, ranures sobre el marc de pedra ---
  const sd = L.SECRET_DOOR;
  const FRAME_HALF = 1.5;   // semi-amplada del marc de pedra dibuixat (village.js)
  if (!sd) { f('secret-door-wall', 'falta SECRET_DOOR'); return out; }
  if (!eq(sd.center.z, it.zMin) || sd.face !== 'north' || sd.buildingId !== 'CH-N' || sd.center.x - FRAME_HALF < it.xMin || sd.center.x + FRAME_HALF > it.xMax) {
    f('secret-door-wall', 'la porta secreta ha de ser sobre la cara interior de la paret del fons de la nau (z = ' + it.zMin + ')');
  }
  if (sd.slots.length !== 2 || new Set(sd.slots.map((q) => q.key)).size !== 2) f('secret-door-slot', 'la porta secreta necessita exactament dues ranures amb claus diferents');
  for (const sl of sd.slots) {
    const dx = Math.abs(sl.x - sd.center.x);
    if (!(dx >= sd.width / 2 + 0.1 && dx <= FRAME_HALF - 0.1) || !(sl.y > 0.8 && sl.y < 1.8)) f('secret-door-slot', `${sl.id}: la ranura ha de ser sobre el marc de pedra (a ${(sd.width / 2 + 0.1).toFixed(2)}–${(FRAME_HALF - 0.1).toFixed(2)} m del centre) i a l'alçada de la mà`);
    if (!L.KEYS.some((k) => k.id === sl.key)) f('secret-door-slot', `${sl.id}: la clau "${sl.key}" no existeix`);
  }
  if (!(sd.slide > 0 && sd.width / 2 + sd.slide <= FRAME_HALF - 0.05)) f('secret-door-slide', `els batents (${sd.width / 2} + ${sd.slide} m) han de quedar amagats dins el marc (${FRAME_HALF} m)`);
  if (!(sd.openSeconds >= 3 && sd.unlockDelay > 0)) f('secret-door-slide', "l'obertura ha de ser lenta (≥ 3 s) i amb una pausa després de la 2a clau");
  // --- Claus: dins del moble correcte, descobribles i recollibles ---
  const spec = { 'KEY-A': ['HA', 'bronze', 'bell', 'dresser'], 'KEY-B': ['HB', 'iron', 'moon', 'chest'] };
  if (L.KEYS.length !== 2) f('key-spec', 'hi ha d\'haver exactament dues claus');
  for (const k of L.KEYS) {
    const m = L.FURNITURE.find((q) => q.id === k.container);
    const sp = spec[k.id];
    if (!m || !sp || m.buildingId !== sp[0] || m.type !== sp[3] || k.material !== sp[1] || k.symbol !== sp[2]) { f('key-spec', `${k.id}: ha d'estar a ${sp ? sp[0] : '?'} (${sp ? sp[3] : '?'}), de ${sp ? sp[1] : '?'} amb símbol ${sp ? sp[2] : '?'}`); continue; }
    const r = m.collision;
    const inside = k.reveal === 'drawer'
      ? k.pos.x >= r.xMin && k.pos.x <= r.xMax && k.pos.z > r.zMax && k.pos.z <= r.zMax + 0.4
      : k.pos.x >= r.xMin && k.pos.x <= r.xMax && k.pos.z >= r.zMin && k.pos.z <= r.zMax;
    if (!inside) f('key-position', `${k.id}: la posició no és al ${k.reveal === 'drawer' ? 'calaix obert' : "cos de l'arca"} de ${m.id}`);
    if (!(k.y >= 0.3)) f('key-position', `${k.id}: no pot ser a terra (y = ${k.y})`);
    if (g) {
      // un punt on el jugador pugui estar-se dret a < pickRange de la clau (anell de 0,5–1,4 m)
      let ok = false;
      for (let a = 0; a < 24 && !ok; a++) for (const rad of [0.5, 0.8, 1.1, 1.4]) { const px = k.pos.x + Math.cos((a * Math.PI) / 12) * rad; const pz = k.pos.z + Math.sin((a * Math.PI) / 12) * rad; if (rad <= k.pickRange && reach(px, pz)) { ok = true; break; } }
      if (!ok) f('key-unreachable', `${k.id}: el jugador no pot arribar a < ${k.pickRange} m de la clau`);
    }
  }
  // --- Accessibilitat (graella): interiors, davant de l'altar, darrere l'altar i davant de la porta secreta ---
  if (g) {
    const mid = (b) => { const q = L.BUILDINGS.find((x) => x.id === b).visual.interior.footprint; return [(q.xMin + q.xMax) / 2, (q.zMin + q.zMax) / 2]; };
    const pois = [['casa A: carril de la porta', [-8.4, -6]], ['casa B: carril de la porta', [8.4, -4]], ['casa A: centre', mid('HA')], ['casa B: centre', mid('HB')],
      ['porta secreta: darrere l\'altar', [0, sd.center.z + R + 0.1]], ['porta secreta: banda est de l\'altar', [1.6, sd.center.z + 0.6]], ['porta secreta: banda oest de l\'altar', [-1.6, sd.center.z + 0.6]],
      ['davant de l\'altar', [0, alt ? alt.collision.zMax + 0.7 : -17.5]]];
    const bad = pois.filter(([, [x, z]]) => !reach(x, z)).map(([n]) => n);
    if (bad.length) f('unreachable', `interiors no accessibles: ${bad.join(', ')}`);
    // el punt per examinar la porta (≤ interactRange) existeix
    let can = false;
    for (let z = sd.center.z + 0.5; z <= sd.center.z + sd.interactRange - 0.1 && !can; z += 0.1) if (reach(0, z) || reach(1.6, z) || reach(-1.6, z)) can = true;
    if (!can) f('secret-door-unreachable', `no hi ha cap lloc des d'on examinar la porta secreta (a < ${sd.interactRange} m)`);
    ctx.info.push(`${pois.length - bad.length}/${pois.length} punts d'interior accessibles; porta secreta examinable des de la nau`);
  }
  ctx.info.push(`${L.FURNITURE.length} mobles; claus: ${L.KEYS.map((k) => `${k.id}→${k.container}`).join(', ')}`);
  return out;
}

// ---------------------------------------------------------------------
// D. VALORS APROVATS
// ---------------------------------------------------------------------
function checkGolden(L) {
  const out = [];
  const bad = (m) => out.push(err('golden', m));
  const shapes = allShapes(L); // formes amb id (les parts de la nau, una per una)
  for (const [id, g] of Object.entries(GOLDEN_COLLISION)) {
    const c = shapes.find((i) => i.id === id);
    if (!c) { bad(`${id}: falta (era un valor aprovat)`); continue; }
    const got = c.type === 'rect' ? ['r', c.xMin, c.xMax, c.zMin, c.zMax] : ['c', c.cx, c.cz, c.radius];
    if (got.length !== g.length || got[0] !== g[0] || g.slice(1).some((v, i) => !eq(v, got[i + 1]))) {
      bad(`${id}: col·lisió ${JSON.stringify(got)} ≠ aprovada ${JSON.stringify(g)}`);
    }
  }
  for (const i of shapes) if (!(i.id in GOLDEN_COLLISION)) bad(`${i.id}: objecte no aprovat afegit al layout`);
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
  const sw1 = L.DOORS.find((q) => q.id === 'D1')?.swing;
  for (const [k, v] of Object.entries(GOLDEN_SWING)) if (!sw1 || !eq(sw1[k], v)) bad(`D1.swing.${k}: ${sw1 ? sw1[k] : 'falta'} ≠ aprovat ${v}`);
  for (const d of L.DOORS) if (d.id !== 'D1' && 'swing' in d) bad(`${d.id}: només D1 té fulles mòbils (les portes de les cases no s'obren encara)`);
  const sd = L.SECRET_DOOR; const gp = GOLDEN_PUZZLE;
  if (!sd || sd.center.x !== gp.door.x || sd.center.z !== gp.door.z || sd.width !== gp.door.width || sd.height !== gp.door.height) bad('SECRET_DOOR: ha de ser a (0, −20,4), d\'1,4 × 2,6 m');
  else if (sd.slots.length !== 2 || sd.slots.some((q, i) => q.x !== gp.slotX[i])) bad('SECRET_DOOR: dues ranures a x = ∓0,95');
  for (const [id, cont] of Object.entries(gp.keys)) { const k = L.KEYS.find((q) => q.id === id); if (!k || k.container !== cont) bad(`${id}: ha d'estar amagada a ${cont}`); }
  const d4 = L.DOORS.find((q) => q.id === 'D4'); const hc = L.BUILDINGS.find((q) => q.id === 'HC');
  if (!d4 || d4.state !== 'closed' || !d4.enterable || !d4.house || !hc || !Array.isArray(hc.collision) || hc.collision.length !== 5) bad('Casa C (D4, Fase C): porta de casa tancada però enterable, edifici compost de 5 parets');
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

// level: 0 = planta baixa, 1 = pis superior (només compten els obstacles actius a aquell nivell).
// blocks: rectangles extra (forat de l'escala al pis superior).
function computeGrid(allColliders, radius, start, cell, level = 0, blocks = [], win = GRID) {
  const colliders = [...allColliders.filter((c) => isActive(c, level)), ...blocks.map((b, i) => makeCollider(`BLOCK-${i}`, { type: 'rect', ...b }))];
  const nx = Math.round((win.xMax - win.xMin) / cell);
  const nz = Math.round((win.zMax - win.zMin) / cell);
  const free0 = new Uint8Array(nx * nz);   // espai lliure (el cos és un punt)
  const free35 = new Uint8Array(nx * nz);  // posicions possibles del CENTRE del jugador
  for (let j = 0; j < nz; j++) {
    const z = win.zMin + (j + 0.5) * cell;
    for (let i = 0; i < nx; i++) {
      const x = win.xMin + (i + 0.5) * cell;
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
  const si = Math.floor((start.x - win.xMin) / cell);
  const sj = Math.floor((start.z - win.zMin) / cell);
  const startIdx = sj * nx + si;
  const r0 = flood(free0, nx, nz, startIdx);
  const r35 = flood(free35, nx, nz, startIdx);
  const index = (x, z) => {
    const i = Math.floor((x - win.xMin) / cell);
    const j = Math.floor((z - win.zMin) / cell);
    return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i;
  };
  return { cell, nx, nz, free0, free35, r0, r35, index, radius, startFree: !!free35[startIdx] };
}

const count = (a) => { let n = 0; for (let i = 0; i < a.length; i++) n += a[i]; return n; };

// ---------------------------------------------------------------------
// E. SOLAPAMENTS I PASSOS ESTRETS
// ---------------------------------------------------------------------
// Dues parts de col·lisió del MATEIX edifici compost (p. ex. HA-EN i HA-ES): el buit entre elles és una porta.
function sameBuilding(L, idA, idB) {
  return L.BUILDINGS.some((b) => Array.isArray(b.collision) && b.collision.some((r) => r.id === idA) && b.collision.some((r) => r.id === idB));
}
// Dos obstacles només poden xocar si comparteixen nivell (sense `level` = tots els nivells).
const levelsMeet = (a, b) => a.level === undefined || b.level === undefined || a.level === b.level;
function checkGeometry(L, ctx) {
  const out = [];
  const soft = new Set(L.FURNITURE.filter((m) => m.soft || (m.collision && m.collision.soft)).map((m) => m.id));
  const cs = ctx.colliders;
  for (let a = 0; a < cs.length; a++) {
    for (let b = a + 1; b < cs.length; b++) {
      if (!levelsMeet(cs[a], cs[b])) continue;
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
      if (!levelsMeet(A, B) || soft.has(A.id) || soft.has(B.id)) continue; // cadires (soft): es poden esquivar/empènyer, no són un pas
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
      if (width === null || width >= COMFORT_GAP - 1e-6) continue;
      if (ALLOWED_NARROW.some(([x, y, min]) => ((A.id === x && B.id === y) || (A.id === y && B.id === x)) && width >= min - 1e-6)) continue;
      if (g.perimeterOpen) continue;
      if (sameBuilding(L, A.id, B.id)) continue; // el buit entre dues parts d'un mateix edifici és el pas d'una porta (es valida a part)
      // el punt mig de la franja ha d'estar dins l'espai jugable
      const mx = width === gx ? (A.xMin > B.xMax ? (A.xMin + B.xMax) / 2 : (B.xMin + A.xMax) / 2) : mid[0];
      const mz = width === gz ? (A.zMin > B.zMax ? (A.zMin + B.zMax) / 2 : (B.zMin + A.zMax) / 2) : mid[1];
      const lg = (A.level === 1 || B.level === 1) && ctx.grid1 ? ctx.grid1 : g;
      const k = lg.index(mx, mz);
      if (k < 0 || !lg.r0[k]) continue;
      narrowest = Math.min(narrowest, width);
      const kind = width < 2 * R ? 'IMPASSABLE per al jugador' : `marge efectiu ${(width - 2 * R).toFixed(2)} m, massa just`;
      out.push(err('narrow-passage', `${A.id} i ${B.id}: pas de ${width.toFixed(2)} m (${kind})`));
    }
  }
  ctx.info.push(Number.isFinite(narrowest) ? `pas més estret: ${narrowest.toFixed(2)} m` : `cap pas més estret de ${COMFORT_GAP} m entre obstacles que es miren`);
  return out;
}

function checkPockets(g, R, out, label) {
  const cellArea = g.cell * g.cell;
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
      out.push(err('dead-pocket', `racó inaccessible${label} de ${area.toFixed(2)} m² prop de (${cx.toFixed(1)}, ${cz.toFixed(1)})`));
    }
  }
  return biggest;
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
  // Interior de l'església (a partir de visual.interior): entrada, centre, fons i les 4 cantonades.
  const nave = L.BUILDINGS.find((b) => b.id === 'CH-N');
  const it = nave?.visual.interior?.footprint;
  if (it) {
    const cx = (it.xMin + it.xMax) / 2;
    const m = R + 0.05; // marge perquè el centre del jugador hi càpiga
    pois.push(["dins de l'església (entrada)", [cx, it.zMax - 0.9]], ['centre de la nau', [cx, (it.zMin + it.zMax) / 2]], ["fons de l'església", [cx, it.zMin + m]],
      ['cantonada interior NO', [it.xMin + m, it.zMin + m]], ['cantonada interior NE', [it.xMax - m, it.zMin + m]],
      ['cantonada interior SO', [it.xMin + m, it.zMax - m]], ['cantonada interior SE', [it.xMax - m, it.zMax - m]]);
  }
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

  for (const [label, gg] of [['', g], [' (pis superior)', ctx.grid1]]) {
    if (!gg) continue;
    const biggest = checkPockets(gg, R, out, label);
    ctx.info.push(`racó inaccessible més gran${label}: ${biggest.toFixed(3)} m² (llindar ${POCKET_AREA} m²)`);
  }
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
// I. CEMENTIRI (Fase D.2): visible però INACCESSIBLE. Valors aprovats de la D.1 v4, perímetre segellat, reixa tancada, cartell, camins i passos.
// ---------------------------------------------------------------------
const CEM_WINDOW = { xMin: -16, xMax: 34, zMin: -38, zMax: 30 }; // graella pròpia: poble + cementiri + marge exterior
const GOLDEN_CEM_COLLISION = {
  'CW-N': ['r', 3.6, 28.4, -34.4, -34], 'CW-E': ['r', 28, 28.4, -34, -7], 'CW-S3': ['r', 15.4, 28.4, -7, -6.6], 'CW-W': ['r', 3.6, 4, -34, -21],
  CT2: ['c', 5.5, -7.6, 0.2], SIB: ['r', 20.4, 22.4, -9.2, -8.2], CAL: ['c', 12, -16, 0.9], MAU: ['r', 12.5, 17.5, -34, -29.2],
  SHED: ['r', 23.5, 26.8, -34, -30.5], PIT: ['r', 19.6, 20.8, -29.4, -27.2], FOSSA: ['r', 19.5, 26.5, -14.4, -11.5], LONE: ['r', 5.4, 7.8, -32.8, -30.4],
  'ENC-M': ['r', 17, 21.2, -25.6, -21.6], 'ENC-V': ['r', 17, 21.4, -20.2, -17.6],
  'Z1-a': ['r', 8.5, 10.8, -28, -26], 'Z1-b': ['r', 7.6, 11.05, -24.8, -22.8], 'Z1-c': ['r', 7.28, 10.73, -21.6, -19.6], Z3: ['r', 11.24, 14.69, -13.9, -11.9],
  T1: ['c', 5.6, -28.4, 0.3], T2: ['c', 9.4, -12.2, 0.3], T4: ['c', 26.2, -24.5, 0.3], T6: ['c', 10.2, -31, 0.3], T7: ['c', 19.4, -31.8, 0.3],
};
const CEM_WALL_CHAIN = [['CW-N', 'CW-W'], ['CW-N', 'CW-E'], ['CW-E', 'CW-S3'], ['CW-S3', 'M-E1'], ['CW-S3', 'M-E3'], ['M-E3', 'M-E1'], ['M-E3', 'M-N1'], ['CW-W', 'CH-N-B'], ['M-N1', 'CH-N-FE']];
// Separació mínima entre els rectangles/cercles (0 = es toquen o se solapen)
const shapeBox = (c) => (c.type === 'circle' ? { xMin: c.cx - c.radius, xMax: c.cx + c.radius, zMin: c.cz - c.radius, zMax: c.cz + c.radius } : c);
function shapeGap(a, b) {
  const A = shapeBox(a); const B = shapeBox(b);
  return Math.hypot(Math.max(0, A.xMin - B.xMax, B.xMin - A.xMax), Math.max(0, A.zMin - B.zMax, B.zMin - A.zMax));
}
function checkCemetery(L, ctx) {
  const out = [];
  const bad = (code, m) => out.push(err(code, m));
  const walls = L.CEM_WALLS || []; const props = L.CEM_PROPS || [];
  const cols = ctx.fullColliders; const byId = (id) => cols.find((c) => c.id === id);
  const rectOf = (id) => allShapes(L).find((q) => q.id === id) || partsOf([...walls, ...props].find((q) => q.id === id) || {})[0];

  // 1. IDs únics i dades completes (les parts amb id d'una col·lisió composta, també)
  const ids = [...allShapes(L).map((q) => q.id), ...walls.map((w) => w.id), ...props.map((q) => q.id)];
  const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dups.length) bad('cem-duplicate-id', `IDs repetits entre el poble i el cementiri: ${dups.join(', ')}`);
  for (const w of walls) {
    if (!w.collision || w.collision.type !== 'rect' || !w.visual || !w.visual.footprint) { bad('cem-visual-collision', `${w.id}: cal un rectangle de col·lisió i una empremta visual`); continue; }
    if (!rectEq(w.visual.footprint, w.collision)) bad('cem-visual-collision', `${w.id}: l'empremta visual no coincideix amb la col·lisió`);
    if (w.collision.enabled === false) bad('cem-wall-disabled', `${w.id}: un mur del perímetre no pot estar desactivat`);
  }
  for (const q of props) {
    const c = q.collision; const v = q.visual || {};
    if (!c) { bad('cem-visual-collision', `${q.id}: falta la col·lisió`); continue; }
    if (c.type === 'rect' && v.footprint && !rectEq(v.footprint, c)) bad('cem-visual-collision', `${q.id}: l'empremta visual no coincideix amb la col·lisió`);
    if (c.type === 'circle' && v.center && (!eq(v.center.x, c.cx) || !eq(v.center.z, c.cz))) bad('cem-visual-collision', `${q.id}: el centre visual no coincideix amb la col·lisió`);
  }

  // 2. Valors aprovats (D.1 v4)
  if (!ctx.skipGolden) {
    const shapes = [...walls, ...props];
    for (const [id, g] of Object.entries(GOLDEN_CEM_COLLISION)) {
      const it = shapes.find((q) => q.id === id);
      if (!it) { bad('cem-golden', `${id}: falta (valor aprovat de la D.1 v4)`); continue; }
      const c = it.collision; const got = c.type === 'rect' ? ['r', c.xMin, c.xMax, c.zMin, c.zMax] : ['c', c.cx, c.cz, c.radius];
      if (got.length !== g.length || got[0] !== g[0] || g.slice(1).some((v, i) => !eq(v, got[i + 1]))) bad('cem-golden', `${id}: col·lisió ${JSON.stringify(got)} ≠ aprovada ${JSON.stringify(g)}`);
    }
    for (const it of shapes) if (!(it.id in GOLDEN_CEM_COLLISION)) bad('cem-golden', `${it.id}: element no aprovat afegit al cementiri`);
    for (const w of walls) if (w.visual.height !== 2.8) bad('cem-golden', `${w.id}: alçada 2,8 m`);
    const ar = L.CEM_AREA;
    if (!ar || !rectEq(ar.clos, { xMin: 4, xMax: 28, zMin: -34, zMax: -9.4 }) || !rectEq(ar.vestibule, { xMin: 15.4, xMax: 28, zMin: -9.4, zMax: -7 })) bad('cem-golden', 'CEM_AREA: clos x 4→28, z −34→−9,4 i vestíbul x 15,4→28, z −9,4→−7');
    const gt = L.CEM_GATE; const op = gt && gt.opening;
    if (!gt || gt.wallId !== 'M-E3' || !op || !eq(op.zMin, -8.4) || !eq(op.zMax, -7) || !eq(op.center, -7.7) || !eq(op.height, 2.6)
      || !gt.pillarNorth || !eq(gt.pillarNorth.zMin, -9) || !eq(gt.pillarNorth.zMax, -8.4) || !gt.leaf || !eq(gt.leaf.x, 15.2) || !eq(gt.leaf.length, 1.38) || !eq(gt.leaf.hingeZ, -7.05)
      || !gt.padlock || !eq(gt.padlock.x, 14.93) || !eq(gt.padlock.y, 1.05) || !eq(gt.padlock.z, -7.7)) bad('cem-golden', 'CEM_GATE: obertura z −8,4→−7,0 (centre −7,7, 2,6 m), pilar nord z −9→−8,4, fulla x 15,2 de 1,38 m, frontissa z −7,05, pany (14,93; 1,05; −7,7)');
    const rg = L.CEM_REAR_GATE;
    if (!rg || rg.wallId !== 'CW-E' || !eq(rg.zMin, -21) || !eq(rg.zMax, -19)) bad('cem-golden', 'CEM_REAR_GATE: porta posterior al mur CW-E, z −21→−19');
    const ct = props.find((q) => q.id === 'CT2');
    if (!ct || ct.type !== 'sign' || !ct.visual || !ct.visual.board || !eq(ct.visual.height, 2.4) || !eq(ct.visual.board.width, 1.3) || !eq(ct.visual.board.height, 0.45) || !eq(ct.visual.board.bottom, 1.75) || !eq(ct.visual.board.top, 2.2)) bad('cem-golden', 'CT2: pal de 2,4 m, taulell 1,3 × 0,45 m a y 1,75→2,2');
  }

  // 3. Perímetre continu: cada parell de la cadena es toca (sense forats ni solapaments buits)
  for (const [a, b] of CEM_WALL_CHAIN) {
    const A = rectOf(a); const B = rectOf(b);
    if (!A || !B) { bad('cem-gap', `perímetre: falta ${!A ? a : b}`); continue; }
    const g = shapeGap(A, B);
    if (g > 1e-9) bad('cem-gap', `perímetre: ${a} i ${b} no es toquen (separació ${g.toFixed(3)} m)`);
  }

  // 4. Reixa i porta posterior: tancades, sense mecànica D.4
  const me3 = byId('M-E3');
  const me3Data = L.WALLS.find((w) => w.id === 'M-E3');
  if (!me3 || me3.enabled === false || !me3Data || me3Data.collision.enabled === false) bad('cem-gate-solid', 'M-E3: la col·lisió de la reixa ha de ser sòlida i activa');
  else if (!rectEq(me3, { xMin: 15, xMax: 15.4, zMin: -9, zMax: -7 })) bad('cem-gate-solid', 'M-E3: la col·lisió ha de continuar sent x 15→15,4, z −9→−7');
  if (byId('M-E3-N')) bad('cem-forbidden', 'M-E3-N (peça de col·lisió de la Fase D.4) no ha d\'existir a la D.2');
  if (L.CEM_GATE && ('openCollision' in L.CEM_GATE || L.CEM_GATE.state !== 'locked')) bad('cem-forbidden', 'CEM_GATE: res de mecànica D.4 (openCollision) i estat "locked"');
  if (L.CEM_REAR_GATE && (L.CEM_REAR_GATE.state !== 'closed' || L.CEM_REAR_GATE.opensCollision !== false || L.CEM_REAR_GATE.locked !== true)) bad('cem-rear-gate', 'CEM_REAR_GATE: ha de ser tancada, amb pany i sense obrir la col·lisió');
  if ((L.KEYS || []).some((k) => /KEY-C/.test(k.id)) || props.some((q) => /crypt|cripta|stair|KEY-C/i.test(q.id + q.type))) bad('cem-forbidden', 'D.2 no pot incloure cripta, escala secreta ni KEY-C');
  for (const q of props) if (q.collision && q.collision.enabled === false) bad('cem-forbidden', `${q.id}: cap col·lisió del cementiri pot estar desactivada`);

  // 5. Camins: només decals (cap col·lisió) i dins del cementiri
  const inArea = (x, z) => [L.CEM_AREA.clos, L.CEM_AREA.vestibule].some((r) => inRect(x, z, r));
  for (const pth of L.CEM_PATHS || []) {
    if ('collision' in pth) bad('cem-path-collision', `${pth.id}: un camí no pot tenir col·lisió`);
    if (cols.some((c) => c.id === pth.id)) bad('cem-path-collision', `${pth.id}: el camí apareix com a col·lisionador`);
    for (const [x, z] of pth.points) if (!inArea(x, z)) bad('cem-path-area', `${pth.id}: el punt (${x}, ${z}) és fora del clos`);
  }

  // 6. Passos: cap pas < COMFORT_GAP entre elements (excepte els murs a ras: MAU i SHED lliguen amb CW-N)
  const cem = cols.filter((c) => props.some((q) => q.id === c.id));
  const wallIds = new Set(walls.map((w) => w.id));
  const FLUSH = new Set(['MAU|CW-N', 'SHED|CW-N']);
  const narrow = [];
  for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
    const a = cols[i]; const b = cols[j];
    if (!cem.includes(a) && !cem.includes(b)) continue;
    const g = shapeGap(a, b);
    if (g > COMFORT_GAP - 1e-6) continue;
    if (FLUSH.has(`${a.id}|${b.id}`) || FLUSH.has(`${b.id}|${a.id}`)) continue;
    if (g === 0 && wallIds.has(a.id) && wallIds.has(b.id)) continue;
    narrow.push(`${a.id}–${b.id} (${g.toFixed(2)} m)`);
  }
  if (narrow.length) bad('cem-narrow', `passos de menys de ${COMFORT_GAP} m: ${narrow.join(', ')}`);
  const ct2 = byId('CT2');
  if (ct2) ctx.info.push(`CT2: separació mínima als obstacles més propers = ${Math.min(...cols.filter((c) => c !== ct2).map((c) => shapeGap(ct2, c))).toFixed(2)} m`);

  // 7. Segellat: graella pròpia amb TOTS els col·lisionadors. El jugador (inici) no ha d'arribar a cap punt del clos ni a l'exterior.
  const R = L.PLAYER.collisionRadius;
  const g = computeGrid(cols, R, L.PLAYER.start, ctx.cell, 0, [], CEM_WINDOW);
  if (!g.startFree) { bad('cem-start', "la posició d'inici no és lliure a la graella del cementiri"); return out; }
  let touchesBorder = false; let enter = 0; let leak = 0; let enter35 = 0;
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const k = j * g.nx + i;
    if (!g.r0[k] && !g.r35[k]) continue;
    const x = CEM_WINDOW.xMin + (i + 0.5) * g.cell; const z = CEM_WINDOW.zMin + (j + 0.5) * g.cell;
    if (g.r0[k]) {
      if (i === 0 || j === 0 || i === g.nx - 1 || j === g.nz - 1) touchesBorder = true;
      if (inArea(x, z)) enter += 1;
      if (x > 15.45 || z < -21.05) leak += 1;
    }
    if (g.r35[k] && (inArea(x, z) || x > 15.45 || z < -21.05)) enter35 += 1;
  }
  if (touchesBorder) bad('cem-perimeter-open', "el perímetre NO és segellat: des de l'inici s'arriba a la vora de la graella ampliada");
  if (enter || enter35) bad('cem-enterable', `el jugador pot entrar al cementiri (${enter} cel·les del clos/vestíbul accessibles amb el cos puntual, ${enter35} amb el cos de radi ${R})`);
  if (leak) bad('cem-leak', `${leak} cel·les accessibles fora del poble (x > 15,45 o z < −21,05)`);
  if (!touchesBorder && !enter && !leak) ctx.info.push(`perímetre del cementiri segellat (graella ${((CEM_WINDOW.xMax - CEM_WINDOW.xMin) / g.cell) | 0}×${g.nz} cel·les de ${g.cell} m): 0 cel·les del clos accessibles des de l'inici`);
  return out;
}

// ---------------------------------------------------------------------
// EXECUCIÓ DE TOTES LES COMPROVACIONS
// ---------------------------------------------------------------------
function runAll(L, { cell, skipGolden = false } = {}) {
  const ctx = { info: [], colliders: null, colliderError: '', grid: null };
  // Les seccions A–G analitzen el POBLE: sense els col·lisionadors del cementiri (el clos és inaccessible i apareixeria com a racó mort).
  try { ctx.colliders = buildColliders({ ...L, CEM_WALLS: [], CEM_PROPS: [] }); } catch (e) { ctx.colliderError = e.message; }
  try { ctx.fullColliders = buildColliders(L); } catch (e) { ctx.fullColliderError = e.message; }
  ctx.skipGolden = skipGolden; ctx.cell = cell;
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
      // Pis superior (Fase C): es comença al replà de dalt de l'escala; el forat de l'escala és un buit (no es camina).
      const up = L.FLOORS && L.FLOORS.slabs && L.FLOORS.slabs[0];
      if (up) ctx.grid1 = computeGrid(ctx.colliders, L.PLAYER.collisionRadius, { x: 5.0, z: 9.8 }, cell, 1, up.holes);
    } catch (e) { ctx.colliderError = `graella: ${e.message}`; }
  }
  const sections = [
    ['A. Integritat de les dades', checkIntegrity, false],
    ['B. Visual i col·lisió coherents', checkVisualCollision, false],
    ['C. Portes i fanals', checkDoorsAndLights, false],
    ['C2. Porta de fulles (D1)', checkDoorSwing, !ctx.colliders],
    ['C3. Interiors: mobles, claus i porta secreta', checkInteriors, !ctx.grid],
    ['D. Valors aprovats', checkGolden, skipGolden],
    ['E. Solapaments i passos estrets', checkGeometry, !ctx.grid],
    ['F. Perímetre, accessibilitat i racons morts', checkGrid, !ctx.grid],
    ['G. Amples dels carrerons', checkAlleys, !ctx.colliders],
    ['I. Cementiri (Fase D.2)', checkCemetery, !ctx.fullColliders],
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
  { name: 'porta D4 (casa C) tancada i enterable però sense fulla dinàmica (house)', expect: 'door-state',
    apply: (L) => { delete L.DOORS.find((d) => d.id === 'D4').house; } },
  { name: 'porta D1 fora de la façana', expect: 'door-face',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').center.z = -8.5; } },
  { name: 'casa B allargada 0,5 m cap al sud (solapa el mur M-E2)', expect: 'overlap', skipGolden: true,
    apply: (L) => { const b = L.BUILDINGS.find((q) => q.id === 'HB'); b.visual.footprint.zMax = -0.5; b.collision.find((r) => r.id === 'HB-S').zMax = -0.5; b.collision.find((r) => r.id === 'HB-E').zMax = -0.5; } },
  { name: 'església amb la façana sense obertura (FW i FE es toquen: D1 impassable)', expect: 'door-opening', skipGolden: true,
    apply: (L) => { L.BUILDINGS.find((q) => q.id === 'CH-N').collision.find((r) => r.id === 'CH-N-FE').xMin = -1.1; } },
  { name: 'obertura de D1 de només 0,6 m (el cos del jugador no hi cap)', expect: 'door-opening', skipGolden: true,
    apply: (L) => { const c = L.BUILDINGS.find((q) => q.id === 'CH-N').collision; c.find((r) => r.id === 'CH-N-FW').xMax = -0.3; c.find((r) => r.id === 'CH-N-FE').xMin = 0.3; } },
  { name: "forat a la paret del fons de l'església (l'interior dona a fora)", expect: 'perimeter-open', skipGolden: true,
    apply: (L) => { const c = L.BUILDINGS.find((q) => q.id === 'CH-N').collision; c.splice(c.findIndex((r) => r.id === 'CH-N-B'), 1); } },
  { name: 'nau tornada a un únic bloc sòlid (versió antiga): interior inaccessible', expect: 'unreachable', skipGolden: true,
    apply: (L) => { L.BUILDINGS.find((q) => q.id === 'CH-N').collision = { type: 'rect', xMin: -4, xMax: 4, zMin: -21, zMax: -9 }; } },
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
  { name: 'fulles de D1 massa curtes (0,6 m): tancades no cobreixen el pas', expect: 'door-swing-closure',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').swing.leafLength = 0.6; } },
  { name: 'frontisses de D1 dins el gruix de la façana (hingeZ −9,3): la fulla travessa les parets', expect: 'door-swing-wall',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').swing.hingeZ = -9.3; } },
  { name: 'angle màxim de D1 de 200° (la porta podria girar més de mitja volta)', expect: 'door-swing-range',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').swing.maxAngleDeg = 200; } },
  { name: 'D1 que comença tancada (cal prémer E per entrar)', expect: 'door-swing-initial',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D1').swing.initialAngleDeg = 0; } },
  { name: 'frontisses de D1 dins del pas (x ±1,0): les fulles tapen el pas', expect: 'door-swing-hinge',
    apply: (L) => { const s = L.DOORS.find((d) => d.id === 'D1').swing; s.hingeX = 1.0; s.leafLength = 0.99; } },
  { name: 'fulles de D1 que giren fins a 90° però queden dins el pas (angle inicial 90°, màx 100°, 0,2 m de gruix)', expect: 'door-swing-range',
    apply: (L) => { const s = L.DOORS.find((d) => d.id === 'D1').swing; s.openTargetDeg = 120; s.maxAngleDeg = 100; } },
  { name: 'una porta de casa (D2) amb fulles mòbils (encara no s\'han d\'obrir)', expect: 'door-swing-scope',
    apply: (L) => { L.DOORS.find((d) => d.id === 'D2').swing = structuredClone(L.DOORS.find((d) => d.id === 'D1').swing); } },
  // --- Fase B: interiors, claus i porta secreta ---
  { name: 'un banc al mig del passadís central de l\'església', expect: 'aisle-blocked', skipGolden: true,
    apply: (L) => { const m = L.FURNITURE.find((q) => q.id === 'PEW-W1'); for (const r of [m.visual.footprint, m.collision]) { r.xMin = -0.5; r.xMax = 0.9 - 0.2; } } },
  { name: 'altar enganxat a la paret del fons (no es pot anar fins a la porta secreta)', expect: 'altar-clearance', skipGolden: true,
    apply: (L) => { const m = L.FURNITURE.find((q) => q.id === 'ALT'); for (const r of [m.visual.footprint, m.collision]) { r.zMin = -20.2; r.zMax = -19.5; } } },
  { name: 'porta secreta fora de la paret del fons', expect: 'secret-door-wall',
    apply: (L) => { L.SECRET_DOOR.center.z = -19.9; } },
  { name: 'ranura de la porta secreta dins l\'obertura (sobre els batents)', expect: 'secret-door-slot',
    apply: (L) => { L.SECRET_DOOR.slots[0].x = -0.3; } },
  { name: 'batents de 1,2 m de recorregut (sortirien del marc de pedra)', expect: 'secret-door-slide',
    apply: (L) => { L.SECRET_DOOR.slide = 1.2; } },
  { name: 'clau del guardià a terra, fora del calaix', expect: 'key-position', skipGolden: true,
    apply: (L) => { const k = L.KEYS.find((q) => q.id === 'KEY-A'); k.pos = { x: -9.0, z: -6.0 }; k.y = 0.05; } },
  { name: 'clau dels oblidats dins una arca que no és a la casa B', expect: 'key-spec',
    apply: (L) => { L.KEYS.find((q) => q.id === 'KEY-B').container = 'A-CRT'; } },
  { name: 'taula al mig del carril de la porta de la casa A (D2 impassable)', expect: 'unreachable', skipGolden: true,
    apply: (L) => { const m = L.FURNITURE.find((q) => q.id === 'A-TAB'); for (const r of [m.visual.footprint, m.collision]) { r.xMin = -9.6; r.xMax = -8.4; r.zMin = -6.4; r.zMax = -5.6; } } },
  { name: 'moble fora de la casa B', expect: 'furniture-outside', skipGolden: true,
    apply: (L) => { const m = L.FURNITURE.find((q) => q.id === 'B-CAB'); for (const r of [m.visual.footprint, m.collision]) { r.xMin = 12.2; r.xMax = 12.8; } } },
  { name: 'casa C oberta (porta D4 enterable)', expect: 'golden',
    apply: (L) => { const d = L.DOORS.find((q) => q.id === 'D4'); d.state = 'open'; d.enterable = true; d.opensCollision = true; } },
  { name: 'coordenada aprovada alterada (HA 0,1 m cap a l\'est)', expect: 'golden',
    apply: (L) => { const b = L.BUILDINGS.find((q) => q.id === 'HA'); b.visual.footprint.xMax += 0.1; b.collision.find((r) => r.id === 'HA-EN').xMax += 0.1; } },
  // --- Fase D.2: cementiri ---
  { name: 'CW-S3 eliminat (el vestíbul queda obert al sud)', expect: 'cem-gap', skipGolden: true,
    apply: (L) => { L.CEM_WALLS.splice(L.CEM_WALLS.findIndex((w) => w.id === 'CW-S3'), 1); } },
  { name: 'CW-S3 desalineat 1 cm (xMin 15,41): rendija al perímetre', expect: 'cem-gap', skipGolden: true,
    apply: (L) => { const w = L.CEM_WALLS.find((q) => q.id === 'CW-S3'); w.collision.xMin = 15.41; w.visual.footprint.xMin = 15.41; } },
  { name: 'CW-E escurçat 1 m pel nord (forat a la cantonada nord-est)', expect: 'cem-gap', skipGolden: true,
    apply: (L) => { const w = L.CEM_WALLS.find((q) => q.id === 'CW-E'); w.collision.zMin = -33; w.visual.footprint.zMin = -33; } },
  { name: 'reixa M-E3 sense col·lisió al tram central (z −8,4→−7): es pot entrar', expect: 'cem-enterable', skipGolden: true,
    apply: (L) => { const w = L.WALLS.find((q) => q.id === 'M-E3'); w.collision.zMin = -9; w.collision.zMax = -8.4; } },
  { name: 'M-E3 desactivada (enabled = false)', expect: 'cem-gate-solid', skipGolden: true,
    apply: (L) => { L.WALLS.find((q) => q.id === 'M-E3').collision.enabled = false; } },
  { name: 'porta posterior amb la col·lisió oberta (opensCollision)', expect: 'cem-rear-gate',
    apply: (L) => { L.CEM_REAR_GATE.opensCollision = true; } },
  { name: 'mecànica D.4 a les dades (CEM_GATE.openCollision)', expect: 'cem-forbidden',
    apply: (L) => { L.CEM_GATE.openCollision = { id: 'M-E3-N' }; } },
  { name: 'KEY-C a la llista de claus (no és de la D.2)', expect: 'cem-forbidden',
    apply: (L) => { L.KEYS.push({ id: 'KEY-C', container: 'SHED' }); } },
  { name: 'cartell CT2 a x = 7,5 (a la boca del carreró)', expect: 'cem-narrow', skipGolden: true,
    apply: (L) => { const p = L.CEM_PROPS.find((q) => q.id === 'CT2'); p.collision.cx = 7.5; p.visual.center.x = 7.5; } },
  { name: 'tomba de Sibil·la desplaçada 0,1 m', expect: 'cem-golden',
    apply: (L) => { const p = L.CEM_PROPS.find((q) => q.id === 'SIB'); p.collision.xMin += 0.1; p.collision.xMax += 0.1; p.visual.footprint.xMin += 0.1; p.visual.footprint.xMax += 0.1; } },
  { name: 'tomba nova al vestíbul que deixa un pas de 0,6 m amb SIB', expect: 'cem-narrow', skipGolden: true,
    apply: (L) => { const r = { type: 'rect', xMin: 23, xMax: 24.5, zMin: -9.2, zMax: -8.2 }; L.CEM_PROPS.push({ id: 'X-TOMB', type: 'graveBlock', visual: { footprint: { ...r }, graves: [] }, collision: { ...r } }); } },
  { name: 'camí amb col·lisió pròpia', expect: 'cem-path-collision',
    apply: (L) => { L.CEM_PATHS[0].collision = { type: 'rect', xMin: 16, xMax: 17, zMin: -9, zMax: -8 }; } },
  { name: 'ID repetit al cementiri (SHED passa a dir-se MAU)', expect: 'cem-duplicate-id',
    apply: (L) => { L.CEM_PROPS.find((q) => q.id === 'SHED').id = 'MAU'; } },
];

// ---------------------------------------------------------------------
// MAPA DE COL·LISIÓ generat a partir de les dades
// ---------------------------------------------------------------------
function printMap(L, ctx) {
  const letters = { 'CH-N': 'E', 'CH-T': 'K', HA: 'A', HB: 'B', HC: 'C' };
  const propLetter = { fountain: 'O', tree: 'Y', bench: 'b', barrel: 'o', barrelPair: 'o', crate: 'x', sign: 'i' };
  for (const w of L.WALLS) letters[w.id] = '#';
  for (const p of L.PROPS) letters[p.id] = propLetter[p.type] || '?';
  for (const b of L.BUILDINGS) for (const part of partsOf(b)) letters[part.id] = letters[b.id]; // parts de la nau → 'E'
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
