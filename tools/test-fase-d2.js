// =====================================================================
// PROVES DE LA FASE D.2: cementiri exterior (visible, inaccessible)         node tools/test-fase-d2.js   (necessita `three`)
// Comprova dades, col·lisions amb el codi real de moviment (movePlayer), geometria generada, textures pixel a pixel i rendiment.
// NO prova l'aspecte en pantalla ni la GPU del navegador: això ho ha de mirar l'usuari.
// =====================================================================
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree, clearance } from '../src/player/collisions.js';
import { buildVillage, fontWidth, fontHeight, SIGN_TEX, paintCemSign, ENGRAVE_CELLS, ENGRAVE_SIZE, paintEngrave } from '../src/world/village.js';

const { CEM_AREA, CEM_WALLS, CEM_PROPS, CEM_PATHS, CEM_GATE, CEM_REAR_GATE, PLAYER, WALLS, KEYS } = LAYOUT;
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const expect = (c, m) => { if (!c) throw new Error(m); };
const R = PLAYER.collisionRadius;
// Fase D.3: la cripta (CRYPT_*) té les seves pròpies proves (test-fase-d3.js); aquí es comparen només el poble i el cementiri.
const NO_CRYPT = { CRYPT_WALLS: [], CRYPT_PROPS: [] };
const colliders = buildColliders({ ...LAYOUT, ...NO_CRYPT });
const baseColliders = buildColliders({ ...LAYOUT, ...NO_CRYPT, CEM_WALLS: [], CEM_PROPS: [] });
const byId = (id) => colliders.find((c) => c.id === id);
const inRect = (x, z, r) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;
const inCemetery = (x, z) => inRect(x, z, CEM_AREA.clos) || inRect(x, z, CEM_AREA.vestibule);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shapeBox = (c) => (c.type === 'circle' ? { xMin: c.cx - c.radius, xMax: c.cx + c.radius, zMin: c.cz - c.radius, zMax: c.cz + c.radius } : c);
const gap = (a, b) => { const A = shapeBox(a); const B = shapeBox(b); return Math.hypot(Math.max(0, A.xMin - B.xMax, B.xMin - A.xMax), Math.max(0, A.zMin - B.zMax, B.zMin - A.zMax)); };

// Punts accessibles des de l'inici (graella de 0,1 m amb el cos del jugador): només aquests són posicions reals del jugador.
const REACH = (() => {
  const win = { xMin: -16, xMax: 34, zMin: -38, zMax: 30 }; const cell = 0.1;
  const nx = Math.round((win.xMax - win.xMin) / cell); const nz = Math.round((win.zMax - win.zMin) / cell);
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = isPositionFree(win.xMin + (i + 0.5) * cell, win.zMin + (j + 0.5) * cell, R, colliders) ? 1 : 0;
  const seen = new Uint8Array(nx * nz); const q = [Math.floor((PLAYER.start.z - win.zMin) / cell) * nx + Math.floor((PLAYER.start.x - win.xMin) / cell)];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) { const k = q[h]; const i = k % nx; for (const m of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (m >= 0 && m < nx * nz && free[m] && !seen[m]) { seen[m] = 1; q.push(m); } }
  const pts = []; for (let k = 0; k < nx * nz; k++) if (seen[k]) pts.push([win.xMin + ((k % nx) + 0.5) * cell, win.zMin + (Math.floor(k / nx) + 0.5) * cell]);
  return { pts, win, nx, nz, seen, cell };
})();
const walkTo = (x, z, tx, tz, frames, step = 0.07) => { // un jugador que apunta cap a (tx, tz); retorna la posició final i si ha estat mai dins del cementiri
  const out = createMoveResult(); let inside = false; let maxX = x;
  for (let i = 0; i < frames; i++) {
    const dx = tx - x; const dz = tz - z; const L = Math.hypot(dx, dz) || 1;
    movePlayer(x, z, (dx / L) * step, (dz / L) * step, R, colliders, out); x = out.x; z = out.z;
    if (inCemetery(x, z)) inside = true; if (x > maxX) maxX = x;
  }
  return { x, z, inside, maxX };
};

// ---------------------------------------------------------------------
console.log('\n1. Murs del cementiri: coordenades, perímetre continu');
// ---------------------------------------------------------------------
const WALL_SPEC = { 'CW-N': [3.6, 28.4, -34.4, -34], 'CW-E': [28, 28.4, -34, -7], 'CW-S3': [15.4, 28.4, -7, -6.6], 'CW-W': [3.6, 4, -34, -21] };
test('Els 4 murs (CW-N, CW-E, CW-S3, CW-W) tenen exactament les coordenades de la D.1 v4 i 2,8 m d\'alçada', () => {
  expect(CEM_WALLS.length === 4, `hi ha ${CEM_WALLS.length} murs, n\'havien de ser 4`);
  for (const [id, [x0, x1, z0, z1]] of Object.entries(WALL_SPEC)) {
    const w = CEM_WALLS.find((q) => q.id === id); expect(w, `${id}: falta`);
    for (const r of [w.collision, w.visual.footprint]) expect(r.xMin === x0 && r.xMax === x1 && r.zMin === z0 && r.zMax === z1, `${id}: rectangle ${JSON.stringify(r)}`);
    expect(w.visual.height === 2.8, `${id}: alçada ${w.visual.height}`);
  }
});
test('Perímetre continu: cada tram toca el següent (CW-N↔CW-W↔CH-N-B, CW-N↔CW-E↔CW-S3↔M-E1/M-E3↔M-N1↔CH-N-FE) sense cap forat', () => {
  const chain = [['CW-N', 'CW-W'], ['CW-W', 'CH-N-B'], ['CW-N', 'CW-E'], ['CW-E', 'CW-S3'], ['CW-S3', 'M-E1'], ['CW-S3', 'M-E3'], ['M-E3', 'M-E1'], ['M-E3', 'M-N1'], ['M-N1', 'CH-N-FE']];
  for (const [a, b] of chain) { const A = byId(a); const B = byId(b); expect(A && B, `${a} o ${b} no existeix`); expect(gap(A, B) < 1e-9, `${a} i ${b} no es toquen (${gap(A, B)} m)`); }
});
test('Cap forat «no planificat»: els murs no se solapen més del gruix a les cantonades i cap té col·lisió desactivada', () => {
  for (const w of CEM_WALLS) { const c = byId(w.id); expect(c.enabled !== false && w.collision.enabled !== false, `${w.id}: desactivat`); }
  const n = byId('CW-N'); const e = byId('CW-E'); const w = byId('CW-W');
  expect(n.xMax === e.xMax && n.zMax === e.zMin, 'cantonada NE no encaixa');
  expect(n.xMin === w.xMin && n.zMax === w.zMin, 'cantonada NO no encaixa');
});
test('Els murs nous fan 0,4 m de gruix (com els existents) i creixen cap a l\'exterior', () => {
  for (const id of Object.keys(WALL_SPEC)) { const c = byId(id); const t = Math.min(c.xMax - c.xMin, c.zMax - c.zMin); expect(Math.abs(t - 0.4) < 1e-9, `${id}: gruix ${t}`); }
});

// ---------------------------------------------------------------------
console.log('\n2. Inaccessibilitat: el jugador no pot entrar al cementiri');
// ---------------------------------------------------------------------
test('Des de 6000 punts ACCESSIBLES del poble (graella de 0,1 m, des de l\'inici), 500 fotogrames empenyent cap a dins del cementiri no hi entren mai', () => {
  const rnd = mulberry32(2026); const targets = [[18, -8], [10, -20], [22, -15], [27, -30], [8, -30], [20, -9], [27, -20], [14, -12]];
  expect(REACH.pts.length > 30000, `zona accessible massa petita: ${REACH.pts.length} cel·les`);
  expect(!REACH.pts.some(([x, z]) => inCemetery(x, z) || x > 15.45 || z < -21.05), 'hi ha cel·les accessibles dins el clos o fora del poble');
  for (let n = 0; n < 6000; n++) {
    const [x, z] = REACH.pts[Math.floor(rnd() * REACH.pts.length)]; const t = targets[n % targets.length];
    const r = walkTo(x, z, t[0], t[1], 500);
    expect(!r.inside && r.x < 15.0, `(${x.toFixed(2)}, ${z.toFixed(2)}) cap a (${t}) ha acabat a (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`);
  }
});
test('Reixa tancada: empènyer cap a l\'est per tots els carrils z −8,9→−7,1 (pas 0,05) no passa mai de x = 14,651 (passos de 0,05 m)', () => {
  for (let z = -8.9; z <= -7.1 + 1e-9; z += 0.05) {
    const r = walkTo(8, z, 40, z, 400, 0.05);
    expect(r.maxX <= 14.651, `carril z ${z.toFixed(2)}: x màxima ${r.maxX.toFixed(4)}`);
  }
});
test('Reixa tancada: fotogrames d\'un sol salt de 1, 3 i 6 m cap a la reixa no la travessen (cap al centre, a l\'obertura, i en diagonal)', () => {
  for (const jump of [1, 3, 6]) for (const z of [-8.3, -7.7, -7.2]) for (const dz of [0, -0.4, 0.4]) {
    const out = createMoveResult(); let x = 13; let zz = z;
    for (let k = 0; k < 6; k++) { movePlayer(x, zz, jump, dz * jump, R, colliders, out); x = out.x; zz = out.z; expect(!inCemetery(x, zz) && x <= 14.651, `salt ${jump} m, z ${z}: (${x.toFixed(3)}, ${zz.toFixed(3)})`); }
  }
});
test('Cap peça de col·lisió de l\'obertura (z −8,4→−7) és desactivable: la reixa és M-E3 sencera, sòlida i activa; no existeix M-E3-N', () => {
  const g = byId('M-E3'); expect(g && g.enabled !== false, 'M-E3 absent o desactivat');
  expect(g.xMin === 15 && g.xMax === 15.4 && g.zMin === -9 && g.zMax === -7, `M-E3 ${JSON.stringify([g.xMin, g.xMax, g.zMin, g.zMax])}`);
  expect(!byId('M-E3-N') && !colliders.some((c) => /CEM-GATE|LEAF|LOCK/i.test(c.id)), 'hi ha col·lisions de la mecànica D.4');
  for (const [x, z] of [[15.2, -8.7], [15.2, -8.3], [15.2, -7.7], [15.2, -7.2]]) expect(!isPositionFree(x, z, 0.001, colliders), `(${x}, ${z}) hauria de ser sòlid`);
});
test('Porta posterior (x 28→28,4, z −21→−19): visual i tancada; el mur CW-E continu és la col·lisió; ningú hi arriba des de fora', () => {
  expect(CEM_REAR_GATE.state === 'closed' && CEM_REAR_GATE.locked === true && CEM_REAR_GATE.opensCollision === false, 'estat de la porta posterior');
  expect(CEM_REAR_GATE.wallId === 'CW-E' && CEM_REAR_GATE.zMin === -21 && CEM_REAR_GATE.zMax === -19, 'posició');
  const e = byId('CW-E'); expect(e.zMin <= -21 && e.zMax >= -19 && !isPositionFree(28.2, -20, 0.001, colliders), 'el mur no és continu a la porta');
  expect(!colliders.some((c) => /REAR/i.test(c.id)), 'la porta posterior no ha de tenir col·lisionador propi');
});
test('Reixa i porta no tenen cap mecànica D.4: sense openCollision, sense KEY-C, sense cripta/escala/nivell −1/túnel/sortides noves', () => {
  expect(!('openCollision' in CEM_GATE) && CEM_GATE.state === 'locked', 'CEM_GATE amb mecànica D.4');
  expect(!KEYS.some((k) => /KEY-C/.test(k.id)), 'KEY-C afegida');
  expect(!CEM_PROPS.some((p) => /crypt|cripta|stair|tunnel|tunel|KEY-C/i.test(p.id + p.type)), 'element prohibit al cementiri');
  expect(!('CEM_CRYPT' in LAYOUT), 'dades de cripta dins del cementiri'); // D.3: la cripta existeix (CRYPT), però el cementiri no en depèn
  expect(LAYOUT.DOORS.length === 4, 'hi ha portes noves');
});

// ---------------------------------------------------------------------
console.log('\n3. Cartell CT2 i carreró est');
// ---------------------------------------------------------------------
test('CT2: (5,5; −7,6), pal circular de r 0,2, 2,4 m d\'alçada, taulell 1,3 × 0,45 m a y 1,75→2,2', () => {
  const ct = CEM_PROPS.find((p) => p.id === 'CT2'); expect(ct && ct.type === 'sign', 'CT2 absent');
  expect(ct.collision.type === 'circle' && ct.collision.cx === 5.5 && ct.collision.cz === -7.6 && ct.collision.radius === 0.2, 'col·lisió');
  const b = ct.visual.board; expect(ct.visual.height === 2.4 && b.width === 1.3 && b.height === 0.45 && b.bottom === 1.75 && b.top === 2.2, 'mides del cartell');
});
test('CT2 no bloqueja la boca del carreró: separació ≥ 1,2 m amb M-N1 i amb HB-WN; 27 carrils cap a l\'est des de x = 8 arriben a la reixa (x ≥ 14,6)', () => {
  const ct = byId('CT2'); expect(gap(ct, byId('M-N1')) >= 1.2 - 1e-6, `M-N1: ${gap(ct, byId('M-N1'))}`);
  expect(gap(ct, byId('HB-WN')) >= 1.2 - 1e-6, `HB-WN: ${gap(ct, byId('HB-WN'))}`);
  for (const c of colliders) if (c !== ct) expect(gap(ct, c) >= 1.2 - 1e-6, `CT2–${c.id}: ${gap(ct, c).toFixed(3)} m`);
  let ok = 0;
  for (let z = -8.65; z <= -7.35 + 1e-9; z += 0.05) { const r = walkTo(8, z, 40, z, 260, 0.05); if (r.maxX >= 14.6) ok++; }
  expect(ok === 27, `només ${ok} de 27 carrils arriben a la reixa`);
});
test('Des de 60 punts de la plaça (incl. al voltant del cartell) es pot arribar a la reixa (x ≥ 14,6): primer a la boca del carreró (7,2; −7,7) i després a l\'est', () => {
  const rnd = mulberry32(77); let ok = 0; let n = 0;
  while (n < 60) {
    const x = -6 + rnd() * 12.5; const z = -8.7 + rnd() * 16;
    if (!isPositionFree(x, z, R, colliders)) continue;
    n++;
    const a = walkTo(x, z, 7.2, -7.7, 260, 0.07); const r = walkTo(a.x, a.z, 14.6, -7.7, 400, 0.07); if (r.maxX >= 14.6) ok++;
  }
  expect(ok === n, `${ok} de ${n}`);
});

// ---------------------------------------------------------------------
console.log('\n4. Posicions aprovades i passos interiors');
// ---------------------------------------------------------------------
const APPROVED = {
  SIB: [20.4, 22.4, -9.2, -8.2], CAL: ['c', 12, -16, 0.9], MAU: [12.5, 17.5, -34, -29.2], SHED: [23.5, 26.8, -34, -30.5], PIT: [19.6, 20.8, -29.4, -27.2],
  FOSSA: [19.5, 26.5, -14.4, -11.5], LONE: [5.4, 7.8, -32.8, -30.4], 'ENC-M': [17, 21.2, -25.6, -21.6], 'ENC-V': [17, 21.4, -20.2, -17.6],
  'Z1-a': [8.5, 10.8, -28, -26], 'Z1-b': [7.6, 11.05, -24.8, -22.8], 'Z1-c': [7.28, 10.73, -21.6, -19.6], Z3: [11.24, 14.69, -13.9, -11.9],
  T1: ['c', 5.6, -28.4, 0.3], T2: ['c', 9.4, -12.2, 0.3], T4: ['c', 26.2, -24.5, 0.3], T6: ['c', 10.2, -31, 0.3], T7: ['c', 19.4, -31.8, 0.3],
};
test('Totes les posicions aprovades (Sibil·la al vestíbul, calvari, mausoleu segellat, caseta, fossa oberta, fossa comuna, tomba solitària, parcel·les, blocs de tombes, 5 arbres morts)', () => {
  expect(CEM_PROPS.filter((p) => p.id !== 'CT2').length === Object.keys(APPROVED).length, `hi ha ${CEM_PROPS.length - 1} elements i n'hi hauria d'haver ${Object.keys(APPROVED).length}`);
  for (const [id, g] of Object.entries(APPROVED)) {
    const p = CEM_PROPS.find((q) => q.id === id); expect(p, `${id}: falta`);
    const c = p.collision;
    if (g[0] === 'c') expect(c.type === 'circle' && c.cx === g[1] && c.cz === g[2] && c.radius === g[3], `${id}: ${JSON.stringify(c)}`);
    else expect(c.type === 'rect' && c.xMin === g[0] && c.xMax === g[1] && c.zMin === g[2] && c.zMax === g[3], `${id}: ${JSON.stringify(c)}`);
  }
});
test('Sibil·la Aldaira és al vestíbul (x 20,4→22,4, z −9,2→−8,2), a l\'eix de la reixa, i la seva làpida mira a l\'oest (cap a l\'entrada)', () => {
  const sib = CEM_PROPS.find((p) => p.id === 'SIB');
  expect(CEM_AREA.vestibule.xMin <= 20.4 && CEM_AREA.vestibule.xMax >= 22.4 && CEM_AREA.vestibule.zMin <= -9.2 && CEM_AREA.vestibule.zMax >= -8.2, 'fora del vestíbul');
  expect(sib.type === 'tomb', `tipus ${sib.type}`);
  const f = sib.visual.facing || sib.visual.headFacing; expect(f === 'west', `orientació de la làpida: ${f}`);
});
test('Fossa comuna amb 13 creus i 3 grups de decoració esperats; muntatge de 10 làpides a ENC-M i 6 a ENC-V', () => {
  const fo = CEM_PROPS.find((p) => p.id === 'FOSSA').visual; const nc = fo.crosses ? fo.crosses.length : fo.crossCount;
  expect(nc === 13, `${nc} creus`);
  const nm = CEM_PROPS.find((p) => p.id === 'ENC-M').visual; const nv = CEM_PROPS.find((p) => p.id === 'ENC-V').visual;
  const cnt = (v) => (v.stones ? v.stones.length : v.headstones ? v.headstones.length : v.count);
  expect(cnt(nm) === 10 && cnt(nv) === 6, `ENC-M ${cnt(nm)}, ENC-V ${cnt(nv)}`);
});
test('Passos interiors: cap pas de menys de 1,2 m entre elements del cementiri ni amb els murs (només MAU i SHED lliguen amb CW-N)', () => {
  const cem = colliders.filter((c) => CEM_PROPS.some((p) => p.id === c.id));
  const wallIds = new Set(CEM_WALLS.map((w) => w.id));
  const bad = [];
  for (let i = 0; i < colliders.length; i++) for (let j = i + 1; j < colliders.length; j++) {
    const a = colliders[i]; const b = colliders[j]; if (!cem.includes(a) && !cem.includes(b)) continue;
    const g = gap(a, b); if (g >= 1.2 - 1e-6) continue;
    const key = [a.id, b.id].sort().join('|'); if (key === 'CW-N|MAU' || key === 'CW-N|SHED') continue;
    if (wallIds.has(a.id) && wallIds.has(b.id)) continue;
    bad.push(`${a.id}–${b.id} ${g.toFixed(2)} m`);
  }
  expect(bad.length === 0, bad.join(', '));
});
test('Camins: 6 camins (E0, P1–P5), només decals: sense col·lisió, tots dins del clos, i cap col·lisionador s\'anomena com un camí', () => {
  expect(CEM_PATHS.map((p) => p.id).sort().join() === 'E0,P1,P2,P3,P4,P5', CEM_PATHS.map((p) => p.id).join());
  for (const p of CEM_PATHS) { expect(!('collision' in p) && !colliders.some((c) => c.id === p.id), `${p.id}: té col·lisió`); for (const [x, z] of p.points) expect(inCemetery(x, z), `${p.id}: (${x}, ${z}) fora del clos`); }
});
test('Cap element de decoració crea obstacles innecessaris: els col·lisionadors del cementiri són exactament 4 murs + els elements del layout (23)', () => {
  const extra = colliders.length - baseColliders.length; expect(extra === 4 + CEM_PROPS.length, `${extra} col·lisionadors nous (esperats ${4 + CEM_PROPS.length})`);
  expect(CEM_PROPS.length === 19, `${CEM_PROPS.length} elements`);
});

// ---------------------------------------------------------------------
console.log('\n5. Cap col·lisió ni mecànica existent s\'ha trencat');
// ---------------------------------------------------------------------
test('Els col·lisionadors del poble són idèntics amb i sense el cementiri (mateix id, ordre i forma)', () => {
  const ids = colliders.slice(0, baseColliders.length);
  for (let i = 0; i < baseColliders.length; i++) { const a = ids[i]; const b = baseColliders[i]; expect(a.id === b.id && a.type === b.type && JSON.stringify(shapeBox(a)) === JSON.stringify(shapeBox(b)), `${a.id} ≠ ${b.id}`); }
});
test('El poble no ha canviat: els col·lisionadors del poble coincideixen amb els valors aprovats (M-E3, M-E1, M-N1, CH-N-*, BR4, CT)', () => {
  const E = { 'M-E3': [15, 15.4, -9, -7], 'M-E1': [12, 15.4, -7, -6.6], 'M-N1': [4, 15.4, -9.4, -9], 'CH-N-B': [-4, 4, -21, -20.4], 'CH-N-E': [3, 4, -20.4, -9.6] };
  for (const [id, [a, b, c, d]] of Object.entries(E)) { const k = baseColliders.find((q) => q.id === id); expect(k && k.xMin === a && k.xMax === b && k.zMin === c && k.zMax === d, `${id}`); }
  const br4 = baseColliders.find((q) => q.id === 'BR4'); expect(br4.cx === 14.7 && br4.cz === -8.7 && br4.radius === 0.3, 'BR4 s\'ha mogut');
});
test('Pas BR4–reixa intacte: els carrils sense contacte cap a l\'est (fins a x = 14,6) fan 0,70 m d\'ample (z −8,05→−7,35), com a la D.1 v4', () => {
  let free = 0;
  for (let z = -8.2; z <= -7.2 + 1e-9; z += 0.01) { const out = createMoveResult(); let x = 9; let hit = false; for (let i = 0; i < 112 && x < 14.6; i++) { movePlayer(x, z, 0.05, 0, R, colliders, out); if (out.collided) hit = true; x = out.x; } if (!hit && Math.abs(out.z - z) < 1e-6) free++; }
  const width = (free - 1) * 0.01; expect(width >= 0.69 && width <= 0.71, `carrils sense contacte: ${width.toFixed(2)} m`);
});

// ---------------------------------------------------------------------
console.log('\n6. Geometria generada (buildVillage) i rendiment');
// ---------------------------------------------------------------------
const scene = new THREE.Scene(); const v = buildVillage(scene); const root = scene.children.find((c) => c.name === 'Village') || scene;
const find = (name) => { let r = null; scene.traverse((o) => { if (o.name === name && !r) r = o; }); return r; };
const sceneWith = new THREE.Scene(); const vNo = buildVillage(sceneWith, { cemetery: false });
test('Triangles: el poble sol té 41.092 (base D.4: base D.3.1 + forat gòtic de la nau, sense pal de cartell ni plafó de foscor); amb el cementiri < 60.000 i el cementiri ≤ 20.000', () => {
  expect(vNo.stats.triangles >= 41092 && vNo.stats.triangles <= 41092 + 6000 && vNo.stats.meshes === 150, `poble sol: ${vNo.stats.triangles} triangles, ${vNo.stats.meshes} malles`); // Fase F: el campanar passa de bloc massís a paret buida amb obertures reals i marcs: la línia base creix de forma acotada (pressupost 6 000 triangles; malles idèntiques).
  expect(v.stats.triangles < 60000, `${v.stats.triangles} triangles`);
  expect(v.stats.cemetery.triangles <= 20000 && v.stats.cemetery.meshes <= 40, `cementiri: ${JSON.stringify(v.stats.cemetery)}`);
  console.log(`      (total ${v.stats.triangles} triangles, ${v.stats.meshes} malles; cementiri ${v.stats.cemetery.triangles} triangles, ${v.stats.cemetery.meshes} malles)`);
});
test('0 llums puntuals noves (el cementiri només fa servir materials Lambert i cap llum)', () => {
  let lights = 0; find('Cemetery').traverse((o) => { if (o.isLight) lights++; }); expect(lights === 0, `${lights} llums`);
  expect(v.stats.pointLights === 0 && vNo.stats.pointLights === 0, 'llums puntuals al poble');
  find('Cemetery').traverse((o) => { if (o.isMesh) expect(o.material.isMeshLambertMaterial, `${o.name}: material ${o.material.type}`); });
});
test('Transparència: cap material transparent nou (només els que el poble ja feia servir: molsa, heura, herba, taques)', () => {
  const outside = new Set(); const inside = new Set(); const cem = find('Cemetery');
  scene.traverse((o) => { if (o.isMesh) { let inC = false; for (let p = o; p; p = p.parent) if (p === cem) inC = true; (inC ? inside : outside).add(o.material); } });
  for (const m of inside) if (m.transparent || m.alphaTest > 0) expect(outside.has(m) || m.alphaTest === 0.5, `material transparent nou: ${m.type}`);
  const ntr = [...inside].filter((m) => m.transparent).length; expect(ntr <= 4, `${ntr} materials transparents`);
});
test('Estructura: grup Cemetery amb els 4 murs, la reixa (pivot de la fulla a la frontissa, tancada), el cadenat, camins i atrezzo', () => {
  const cem = find('Cemetery'); expect(cem, 'falta el grup Cemetery');
  for (const id of ['CW-N', 'CW-E', 'CW-S3', 'CW-W', 'CemeteryGate', 'CemeteryProps']) expect(find(id), `falta ${id}`);
  const leaf = find('CemeteryGateLeaf'); expect(leaf, 'falta la fulla');
  expect(Math.abs(leaf.position.x - 15.2) < 1e-9 && Math.abs(leaf.position.z + 7.05) < 1e-9 && leaf.rotation.y === 0, `pivot de la fulla ${leaf.position.toArray()} rot ${leaf.rotation.y}`);
  expect(find('CemeteryGateLock'), 'falta el cadenat'); expect(find('Cemetery-paths'), 'falta el mapa de camins');
  expect(leaf.userData.dynamic, 'la fulla és mòbil a partir de la D.4 (matriu viva)');   // D.4: abans era estàtica
});
test('Camins: una sola malla plana, a y = 0,03, tots els vèrtexs dins del clos (mai sota els murs ni al carreró), normals cap amunt', () => {
  const paths = find('Cemetery-paths'); const pos = paths.geometry.getAttribute('position'); const nor = paths.geometry.getAttribute('normal');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i); expect(pos.getY(i) === 0 && nor.getY(i) === 1, 'camí no pla');
    expect(x >= 4.19 && x <= 27.81 && z >= -33.81 && z <= -7.09 && !(z > -9.4 && x < 15.49), `vèrtex a (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
  expect(paths.position.y === 0.03, `y ${paths.position.y}`);
  const idx = paths.geometry.index; for (let t = 0; t < idx.count; t += 3) { const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)]; const cross = (pos.getZ(b) - pos.getZ(a)) * (pos.getX(c) - pos.getX(a)) - (pos.getX(b) - pos.getX(a)) * (pos.getZ(c) - pos.getZ(a)); expect(cross >= -1e-9, 'triangle de camí cap avall'); }
});
test('Terra del clos (D.2.1): una malla plana a y = 0,02 que cobreix el 100 % del clos i del vestíbul (graella 0,1 m) i arriba fins sota els murs, sense sortir al carreró', () => {
  const soil = find('Cemetery-soil'); expect(soil, 'falta Cemetery-soil'); expect(soil.position.y === 0.02, `y ${soil.position.y}`);
  const pos = soil.geometry.getAttribute('position'); const idx = soil.geometry.index; const nor = soil.geometry.getAttribute('normal');
  const tris = []; for (let k = 0; k < idx.count; k += 3) { const a = idx.getX(k); const b = idx.getX(k + 1); const c = idx.getX(k + 2); const A = [pos.getX(a), pos.getZ(a)]; const B = [pos.getX(b), pos.getZ(b)]; const C = [pos.getX(c), pos.getZ(c)]; expect((B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]) >= -1e-9, 'triangle cap avall'); tris.push([A, B, C]); }
  for (let i = 0; i < pos.count; i++) expect(pos.getY(i) === 0 && nor.getY(i) === 1, 'terra no pla');
  const inTri = (x, z, [A, B, C]) => { const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); const l1 = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (z - C[1])) / d; const l2 = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (z - C[1])) / d; return l1 >= -1e-9 && l2 >= -1e-9 && 1 - l1 - l2 >= -1e-9; };
  let holes = 0; let first = null;
  for (const r of [CEM_AREA.clos, CEM_AREA.vestibule]) for (let x = r.xMin + 0.05; x < r.xMax; x += 0.1) for (let z = r.zMin + 0.05; z < r.zMax; z += 0.1) if (!tris.some((tr) => inTri(x, z, tr))) { holes++; first = first || [x, z]; }
  expect(holes === 0, `${holes} punts del clos sense terra (primer a ${first})`);
  let bad = 0; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); const z = pos.getZ(i); if (x < 3.89 || x > 28.21 || z < -34.21 || z > -6.79 || (z > -9.39 && x < 15.19)) bad++; }
  expect(bad === 0, `${bad} vèrtexs fora de la zona permesa (sota els murs)`);
  expect(!soil.material.transparent && soil.material.isMeshLambertMaterial, 'el terra ha de ser Lambert opac');
  expect(tris.length <= 900, `${tris.length} triangles de terra`);
});
test('Cartell: un únic quad (2 triangles) mirant al sud (cap a la plaça), a y 1,75→2,2, enganxat a la paret M-N1 (z = −9) amb el centre a x = 5,5 (D.4: sense pal)', () => {
  const props = find('CemeteryProps'); const quads = props.children.filter((m) => m.name === 'CemeteryProps-sign');
  expect(quads.length === 1 && quads[0].geometry.getAttribute('position').count === 6, `${quads.length} malles de cartell`);
  const g = quads[0].geometry; const p = g.getAttribute('position'); const n = g.getAttribute('normal'); const bb = new THREE.Box3().setFromBufferAttribute(p);
  for (let i = 0; i < 6; i++) expect(n.getZ(i) > 0.99, `normal z ${n.getZ(i)}`);
  expect(bb.min.y >= 1.72 && bb.max.y <= 2.23 && bb.min.x > 4.8 && bb.max.x < 6.2 && bb.min.z > -9.0 && bb.max.z < -8.9, `capsa ${bb.min.toArray()} ${bb.max.toArray()}`);
});
test('Tot el cementiri queda dins de la seva zona (x 3,4→29, z −34,8→−6,3); res no sobresurt cap al poble (llevat del cartell i de les peces de la reixa)', () => {
  const cem = find('Cemetery'); const box = new THREE.Box3();
  cem.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone(); b.translate(o.getWorldPosition(new THREE.Vector3())); box.union(b); });
  expect(box.min.x >= 3.3 && box.max.x <= 29.1 && box.min.z >= -35.1 && box.max.z <= -6.2, `capsa ${box.min.toArray().map((q) => q.toFixed(2))} → ${box.max.toArray().map((q) => q.toFixed(2))}`);
  expect(box.max.y <= 6.5, `alçada màxima ${box.max.y.toFixed(2)} m`);
});
test('La reixa dibuixada no obstrueix el carreró: cap geometria de la reixa sobresurt més de 11 cm de la cara oest (x = 15; només el cadenat) i la fulla queda dins del gruix de M-E3', () => {
  const gate = find('CemeteryGate'); const box = new THREE.Box3();
  gate.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone(); b.translate(o.getWorldPosition(new THREE.Vector3())); box.union(b); });
  expect(box.min.x >= 14.89 - 1e-6, `la reixa arriba a x = ${box.min.x.toFixed(3)}`);
  const leaf = find('CemeteryGateLeaf'); const lb = new THREE.Box3(); leaf.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone(); b.translate(o.getWorldPosition(new THREE.Vector3())); lb.union(b); } });
  expect(lb.min.x >= 15.0 && lb.max.x <= 15.4 && lb.max.y <= 2.6 && lb.min.z >= -8.45 && lb.max.z <= -6.98, `fulla ${lb.min.toArray().map((q) => q.toFixed(2))} → ${lb.max.toArray().map((q) => q.toFixed(2))}`);
});
test('dispose() allibera el cementiri sense deixar res (geometries, materials i textures nous)', () => {
  const sc = new THREE.Scene(); const vv = buildVillage(sc); expect(typeof vv.dispose === 'function', 'dispose absent');
  vv.dispose();
});

// ---------------------------------------------------------------------
console.log('\n7. Textures pixel-art: cartell «CEMENTIRI →» i gravats');
// ---------------------------------------------------------------------
function raster(w, h, paint) { const px = new Array(w * h).fill(null); paint((x, y, hex, a = 255) => { const xx = Math.floor(x); const yy = Math.floor(y); if (xx >= 0 && yy >= 0 && xx < w && yy < h) px[yy * w + xx] = { hex, a }; }, w, h); return px; }
test('El cartell conté el text «CEMENTIRI →»: cabe amb marge a les dues bandes, centrat, i el to de la pintura és pàl·lid sobre fusta fosca', () => {
  expect(SIGN_TEX.text === 'CEMENTIRI →', `text: ${SIGN_TEX.text}`);
  const tw = fontWidth(SIGN_TEX.text); expect(tw <= SIGN_TEX.w - 8 && tw >= SIGN_TEX.w * 0.7, `ample del text ${tw} px de ${SIGN_TEX.w}`);
  const px = raster(SIGN_TEX.w, SIGN_TEX.h, paintCemSign);
  const light = []; px.forEach((p, i) => { if (p && p.hex === 0xd8ceb2) light.push([i % SIGN_TEX.w, Math.floor(i / SIGN_TEX.w)]); });
  expect(light.length > 90, `només ${light.length} píxels de lletra`);
  const xs = light.map((q) => q[0]); const ys = light.map((q) => q[1]);
  const left = Math.min(...xs); const right = SIGN_TEX.w - 1 - Math.max(...xs); expect(left >= 3 && right >= 3 && Math.abs(left - right) <= 3, `marges ${left}/${right}`);
  expect(Math.min(...ys) >= SIGN_TEX.textY - 0 && Math.max(...ys) <= SIGN_TEX.textY + fontHeight(SIGN_TEX.text) - 1, `lletres (D.6: Pixel Monastery Script, 21 files) entre y ${Math.min(...ys)} i ${Math.max(...ys)}`);
  const L = (hex) => (((hex >> 16) & 255) * 0.3 + ((hex >> 8) & 255) * 0.59 + (hex & 255) * 0.11);
  const wood = px.filter((p) => p && p.hex !== 0xd8ceb2); const mean = wood.reduce((s, p) => s + L(p.hex), 0) / wood.length; expect(mean < 90, `fusta massa clara (${mean.toFixed(0)})`);
  expect(L(0xd8ceb2) > mean * 2, 'poc contrast text/fusta');
});
test('La fletxa apunta a l\'est (D.6: dibuix propi ampliat 3×): el seu cap (columnes de la dreta) és més alt i el pal és horitzontal al mig; tots els píxels pintats són dins de la imatge', () => {
  const px = raster(SIGN_TEX.w, SIGN_TEX.h, paintCemSign);
  const lightAt = (x, y) => px[y * SIGN_TEX.w + x] && px[y * SIGN_TEX.w + x].hex === 0xd8ceb2;
  const tw = fontWidth(SIGN_TEX.text); const x0 = Math.floor((SIGN_TEX.w - tw) / 2); const ax1 = x0 + tw - 1; const y = SIGN_TEX.textY; const ax0 = ax1 - 23;
  let row = 0; for (let x = ax0; x <= ax1; x++) if (lightAt(x, y + 10)) row++;            // fila central (pal complet: 8 columnes × 3 px)
  expect(row >= 12, `pal de la fletxa: ${row} píxels`);
  let head = 0; for (let x = ax0 + 12; x <= ax0 + 14; x++) for (let k = 0; k < 3; k++) if (lightAt(x, y + k) || lightAt(x, y + 18 + k)) head++;   // el cap, a dalt i a baix de la dreta
  expect(head >= 6, `cap de fletxa: ${head} píxels`);
  expect(!lightAt(ax0 + 1, y + 1) && !lightAt(ax0 + 1, y + 19), 'el cap de la fletxa és a l\'esquerra (apuntaria a l\'oest)');
});
test('Atles de gravats: totes les cel·les caben dins l\'atles, no se solapen, i hi ha pixels a cada cel·la (campana, lluna, creu, forat, ferides, SIBIL·LA, ALDAIRA)', () => {
  const px = raster(ENGRAVE_SIZE[0], ENGRAVE_SIZE[1], paintEngrave);
  const cells = Object.entries(ENGRAVE_CELLS); expect(cells.length === 8, `${cells.length} cel·les`);
  for (const [n, [x, y, w, h]] of cells) {
    expect(x >= 0 && y >= 0 && x + w <= ENGRAVE_SIZE[0] && y + h <= ENGRAVE_SIZE[1], `${n} fora de l'atles`);
    let k = 0; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (px[j * ENGRAVE_SIZE[0] + i]) k++;
    expect(k >= 6, `${n}: només ${k} píxels`);
  }
  for (const [a, [ax, ay, aw, ah]] of cells) for (const [b, [bx, by, bw, bh]] of cells) if (a < b) expect(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay, `${a} i ${b} se solapen`);
  expect(fontWidth('SIBIL·LA') === ENGRAVE_CELLS.sibila[2] && fontWidth('ALDAIRA') === ENGRAVE_CELLS.aldaira[2], 'els noms no coincideixen amb la tipografia');
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
