// =====================================================================
// PROVES DE MOVIMENT I COL·LISIONS  (node tools/test-collisions.js)
// =====================================================================
// Sense dependències: només Node. Surt amb codi 1 si alguna prova falla.
// Els números esperats surten de la geometria aprovada (p. ex. la cara de
// M-E2 és x = 7, així que el jugador s'atura a x = 7 − 0,35 = 6,65).
// =====================================================================
import * as LAYOUT from '../src/world/layout.js';
import {
  buildColliders, clearance, isPositionFree, collidersOverlap, movePlayer,
  createMoveResult, makeCollider,
} from '../src/player/collisions.js';

const { BUILDINGS, WALLS, PROPS, DOORS, PLAYER } = LAYOUT;
const colliders = buildColliders(LAYOUT);
const R = PLAYER.collisionRadius;
const byId = Object.fromEntries(colliders.map((c) => [c.id, c]));

// ---------------------------------------------------------------- harness
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, label) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${label}: s'esperava ${expected} i s'ha obtingut ${actual}`);
  }
}
const fmt = (n) => n.toFixed(4);

// Una sola crida de moviment (amb resultat nou).
function move(x, z, dx, dz) {
  return movePlayer(x, z, dx, dz, R, colliders, createMoveResult());
}
// Simula fotogrames: cada un amb el desplaçament (dx, dz). `onFrame` rep cada resultat.
function walk(x, z, dx, dz, frames, onFrame) {
  const out = createMoveResult();
  let px = x;
  let pz = z;
  for (let i = 0; i < frames; i++) {
    movePlayer(px, pz, dx, dz, R, colliders, out);
    px = out.x;
    pz = out.z;
    if (onFrame) onFrame(out, i);
  }
  return { x: px, z: pz };
}
function assertFree(x, z, label) {
  expect(isPositionFree(x, z, R, colliders), `${label}: el jugador és dins d'un obstacle a (${fmt(x)}, ${fmt(z)})`);
}

// PRNG determinista (mulberry32): mateixa llavor = mateixes proves.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================ 0. unitats
console.log('\n0. Funcions bàsiques');
test('buildColliders: 29 obstacles, ids únics, sense portes ni fanals', () => {
  expect(colliders.length === 29, `n'hi ha ${colliders.length}`);
  expect(new Set(colliders.map((c) => c.id)).size === 29, 'ids repetits');
  for (const id of ['D1', 'D2', 'D3', 'D4', 'F1', 'F5', 'PLAZA']) expect(!byId[id], `${id} no hauria de col·lisionar`);
});
test('Les empremtes de col·lisió aprovades: campanar x −7→−4, font r 2,17, BR-W rectangle', () => {
  expect(byId['CH-T'].xMin === -7 && byId['CH-T'].xMax === -4, 'campanar');
  expect(byId.FNT.radius === 2.17 && !byId.FNT.isRect, 'font');
  expect(byId['BR-W'].isRect, 'BR-W');
});
test('clearance: rectangle fora, cantonada, dins; cercle', () => {
  const [r] = (() => {
    const l = { BUILDINGS: [{ id: 'T', collision: { type: 'rect', xMin: 0, xMax: 2, zMin: 0, zMax: 2 } }], WALLS: [], PROPS: [] };
    return buildColliders(l);
  })();
  near(clearance(3, 1, r), 1, 1e-12, 'costat');
  near(clearance(3, 3, r), Math.SQRT2, 1e-12, 'cantonada');
  near(clearance(1, 1, r), -1, 1e-12, 'dins');
  const circle = makeCollider('C', { type: 'circle', cx: 0, cz: 0, radius: 1 });
  near(clearance(3, 0, circle), 2, 1e-12, 'cercle');
});
test('Formes invàlides llancen error', () => {
  let n = 0;
  for (const shape of [{ type: 'rect', xMin: 2, xMax: 1, zMin: 0, zMax: 1 }, { type: 'circle', cx: 0, cz: 0, radius: 0 }, { type: 'triangle' }]) {
    try { makeCollider('X', shape); } catch { n++; }
  }
  expect(n === 3, 'alguna forma invàlida no ha fallat');
});
test('collidersOverlap: contacte de vora ≠ solapament', () => {
  const a = makeCollider('a', { type: 'rect', xMin: 0, xMax: 1, zMin: 0, zMax: 1 });
  const b = makeCollider('b', { type: 'rect', xMin: 1, xMax: 2, zMin: 0, zMax: 1 });
  const c = makeCollider('c', { type: 'rect', xMin: 0.9, xMax: 2, zMin: 0, zMax: 1 });
  expect(!collidersOverlap(a, b) && collidersOverlap(a, c), 'rect-rect');
});
test("La posició d'inici (0, 27) és lliure", () => assertFree(PLAYER.start.x, PLAYER.start.z, 'inici'));

// ============================================================ 1. murs
console.log('\n1. Murs rectes i lliscament');
test('1. Moviment lliure a la plaça: el resultat és exactament el demanat', () => {
  const r = move(5, -5, 0.12, -0.16);
  near(r.x, 5.12, 1e-12, 'x'); near(r.z, -5.16, 1e-12, 'z');
  expect(!r.collided, 'no hauria de col·lisionar');
});
test('2. De cara contra M-E2: s\'atura a x = 6,65 i z no canvia', () => {
  const r = move(6, 0, 1, 0);
  near(r.x, 7 - R, 1e-9, 'x'); near(r.z, 0, 1e-9, 'z');
  expect(r.collided && r.lastId === 'M-E2', `lastId=${r.lastId}`);
});
test('3a. Lliscament: diagonal contra el mur conserva TOTA la component paral·lela', () => {
  const r = move(6.5, 0, 0.3, 0.3);
  near(r.x, 6.65, 1e-9, 'x'); near(r.z, 0.3, 1e-9, 'z');
});
test('3b. Lliscament sostingut: 20 fotogrames diagonals, x queda a 6,65 i z avança 2,0', () => {
  const p = walk(6.5, 0, 0.1, 0.1, 20);
  near(p.x, 6.65, 1e-9, 'x'); near(p.z, 2.0, 1e-9, 'z');
});
test('6a. Contacte just (a 0,35 m del mur): no s\'empeny ni vibra', () => {
  const r = move(6.65, 0, 0, 0);
  expect(!r.collided && r.x === 6.65 && r.z === 0, 'ha reaccionat');
});
test('6b. Caminar paral·lel al mur tocant-lo no compta com a col·lisió', () => {
  const r = move(6.65, 0, 0, 0.2);
  near(r.z, 0.2, 1e-12, 'z'); expect(!r.collided, 'col·lisió falsa');
});
test('16. Moviment gran (3 m en una crida) no travessa el mur de 0,4 m', () => {
  const r = move(5, 0, 3, 0);
  near(r.x, 6.65, 1e-9, 'x');
});

// ============================================================ 2. cantonades
console.log('\n2. Cantonades');
test('4a. Cantonada convexa (caixa CR3), de cara en diagonal: s\'atura a 0,35 m de la cantonada', () => {
  const p = walk(0.9, 19.2, 0.2, 0.2, 3);
  assertFree(p.x, p.z, 'CR3');
  near(Math.hypot(p.x - 1.4, p.z - 19.7), R, 1e-6, 'distància a la cantonada');
});
test('4b. Cantonada convexa, entrada obliqua cap a la cantonada: es desvia cap al nord i queda al racó M-SE / CR3', () => {
  let minClearance = Infinity;
  const p = walk(0.9, 19.3, 0.2, 0.12, 10, (r) => {
    minClearance = Math.min(minClearance, clearance(r.x, r.z, byId.CR3));
  });
  expect(minClearance >= R - 1e-6, `penetració (clearance ${minClearance})`);
  // La trajectòria passa pel nord de la caixa (z < 19,7) fins al mur M-SE (x = 2 − 0,35).
  near(p.x, 1.65, 1e-6, 'x'); near(p.z, 19.35, 1e-6, 'z');
});
test('4c. Cantonada convexa, entrada obliqua cap a la cara: llisca per la cara oest i envolta la cantonada', () => {
  let minClearance = Infinity;
  let slidAlongFace = false;
  const p = walk(1.0, 19.0, 0.06, 0.2, 12, (r) => {
    minClearance = Math.min(minClearance, clearance(r.x, r.z, byId.CR3));
    if (Math.abs(r.x - 1.05) < 1e-3 && r.z > 19.8 && r.z < 20.3) slidAlongFace = true;
  });
  expect(minClearance >= R - 1e-6, `penetració (clearance ${minClearance})`);
  expect(slidAlongFace, 'no ha lliscat per la cara oest (x = 1,05)');
  expect(p.z - 19.0 >= 2.2, `progrés en z ${fmt(p.z - 19.0)} de 2,4 demanats`);
});
test('5. Racó còncau (SO de la plaça): arriba a (−6,65, 8,65) i en 100 fotogrames no vibra', () => {
  const r = move(-6, 8, -2, 2);
  near(r.x, -6.65, 1e-9, 'x'); near(r.z, 8.65, 1e-9, 'z');
  let maxDev = 0;
  walk(r.x, r.z, -0.2, 0.2, 100, (o) => {
    maxDev = Math.max(maxDev, Math.abs(o.x + 6.65), Math.abs(o.z - 8.65));
  });
  expect(maxDev < 1e-9, `desviació màxima ${maxDev}`);
});
test('11. Racó NO de la plaça (on es toquen campanar i casa A): no es pot colar en diagonal', () => {
  let leaked = false;
  const p = walk(-6.2, -8.2, -0.2, -0.2, 8, (r) => { if (r.x < -7 || r.z < -9) leaked = true; });
  expect(!leaked, 'el jugador ha sortit de la plaça');
  near(p.x, -6.65, 1e-6, 'x'); near(p.z, -8.65, 1e-6, 'z');
});
test('9c. Racó del final del carreró est (barril + dos murs): no penetra i s\'hi pot sortir', () => {
  const p = walk(14, -8, 0.2, -0.1, 10);
  assertFree(p.x, p.z, 'racó est');
  const back = walk(p.x, p.z, -0.2, 0.1, 15);
  expect(back.x < p.x, 'no pot sortir del racó');
});

// ============================================================ 3. seccions llargues
console.log('\n3. Carrerons, costures i portes');
test('9a. Carreró est pel centre (z = −8): arriba a x = 14,65', () => {
  const p = walk(7.5, -8, 0.2, 0, 40);
  near(p.x, 14.65, 1e-9, 'x'); near(p.z, -8, 1e-9, 'z');
});
test('9b. Carreró oest pel centre (z = −2): arriba a x = −14,65', () => {
  const p = walk(-7.5, -2, -0.2, 0, 40);
  near(p.x, -14.65, 1e-9, 'x'); near(p.z, -2, 1e-9, 'z');
});
test('10a. Costura HB / M-E2 (z = −1): avança el 100 % al llarg de x = 6,65', () => {
  const p = walk(6.65, -3, 0, 0.2, 30);
  near(p.z, 3, 1e-9, 'z'); near(p.x, 6.65, 1e-9, 'x');
});
test('10b. Costura HA / M-W3 (x = −12) dins el carreró oest: sense ensopegar', () => {
  const p = walk(-7.5, -2.65, -0.2, 0, 35);
  near(p.x, -14.5, 1e-9, 'x'); near(p.z, -2.65, 1e-9, 'z');
});
test('12. Les 4 portes són tancades: el jugador s\'atura a 0,35 m de la façana', () => {
  const normals = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
  for (const door of DOORS) {
    const [nx, nz] = normals[door.face];
    const sx = door.center.x + nx * (R + 0.3);
    const sz = door.center.z + nz * (R + 0.3);
    const r = move(sx, sz, -nx, -nz);
    near(r.x, door.center.x + nx * R, 1e-9, `${door.id} x`);
    near(r.z, door.center.z + nz * R, 1e-9, `${door.id} z`);
    expect(r.collided, `${door.id} no ha col·lisionat`);
  }
});
test('13. El balcó de HB no té col·lisió: es pot caminar-hi per sota', () => {
  const hb = BUILDINGS.find((b) => b.id === 'HB');
  expect(hb.visual.balcony, 'HB ha de tenir balcó visual');
  const p = walk(6.5, -5.5, 0, 0.2, 15);
  near(p.z, -2.5, 1e-9, 'z'); near(p.x, 6.5, 1e-12, 'x');
});

// ============================================================ 4. font
console.log('\n4. Font (obstacle rodó)');
test('7. De cara contra la font: s\'atura a z = 5,52 (3 + 2,17 + 0,35)', () => {
  const r = move(0, 6, 0, -1);
  near(r.z, 5.52, 1e-9, 'z'); near(r.x, 0, 1e-9, 'x');
});
test('8. Envoltar la font empenyent-la: mai a menys de 2,52 m del centre, i hi arriba al nord', () => {
  let x = 0;
  let z = 5.6;
  let minDist = Infinity;
  const out = createMoveResult();
  for (let i = 0; i < 400; i++) {
    const rx = x - 0;
    const rz = z - 3;
    const d = Math.hypot(rx, rz);
    const ux = rx / d;
    const uz = rz / d;
    // tangent (gira cap a l'oest) + una mica d'empenta cap al centre
    movePlayer(x, z, -uz * 0.1 - ux * 0.03, ux * 0.1 - uz * 0.03, R, colliders, out);
    x = out.x; z = out.z;
    minDist = Math.min(minDist, Math.hypot(x, z - 3));
    if (z < 0.7 && Math.abs(x) < 0.5) break;
  }
  expect(minDist >= 2.52 - 1e-6, `s'ha acostat a ${minDist}`);
  expect(z < 0.7, `no ha arribat al nord (z=${fmt(z)})`);
});
test('14. Ruta inicial: de (0, 27) cap al nord, la primera col·lisió és la font (z = 5,52)', () => {
  let firstHit = null;
  const p = walk(0, 27, 0, -0.2, 120, (r) => { if (r.collided && firstHit === null) firstHit = r.lastId; });
  near(p.z, 5.52, 1e-9, 'z'); near(p.x, 0, 1e-9, 'x');
  expect(firstHit === 'FNT', `primera col·lisió: ${firstHit}`);
});

test('17. Racó barril + mur (BR3 / M-SO): 300 fotogrames prement-hi, la posició es calma i no vibra', () => {
  const out = createMoveResult();
  let x = -1.4;
  let z = 18.5;
  let lastChange = Infinity;
  for (let i = 0; i < 300; i++) {
    movePlayer(x, z, -0.12, -0.1, R, colliders, out);
    lastChange = Math.hypot(out.x - x, out.z - z);
    x = out.x; z = out.z;
  }
  expect(lastChange < 1e-9, `encara es mou ${lastChange} m per fotograma`);
  assertFree(x, z, 'racó BR3');
});

// ============================================================ 5. massives
console.log('\n5. Proves massives (llavor fixa, reproduïbles)');
const ZONES = [
  { xMin: LAYOUT.PLAZA.bounds.xMin, xMax: LAYOUT.PLAZA.bounds.xMax, zMin: LAYOUT.PLAZA.bounds.zMin, zMax: LAYOUT.PLAZA.bounds.zMax }, // plaça
  { xMin: -2, xMax: 2, zMin: 9, zMax: 29 },      // carrer d'entrada
  { xMin: 7, xMax: 15, zMin: -9, zMax: -7 },     // carreró est
  { xMin: -15, xMax: -7, zMin: -3, zMax: -1 },   // carreró oest
];
const inZones = (x, z, e = 1e-6) => ZONES.some((q) => x >= q.xMin - e && x <= q.xMax + e && z >= q.zMin - e && z <= q.zMax + e);
function randomFreeStart(rng) {
  for (;;) {
    const q = ZONES[Math.floor(rng() * ZONES.length)];
    const x = q.xMin + rng() * (q.xMax - q.xMin);
    const z = q.zMin + rng() * (q.zMax - q.zMin);
    if (isPositionFree(x, z, R, colliders)) return [x, z];
  }
}
// Comprova una sola resolució; retorna una descripció del problema o null.
// Un racó entre dos obstacles (p. ex. barril + mur) pot fer retrocedir el punt
// final uns mil·límetres: la posició resultant satisfà els dos límits alhora.
// Es tolera fins a 1 cm i es mostra el retrocés màxim observat.
const MAX_RECOIL = 0.01;
let worstRecoil = 0;
function checkMove(sx, sz, dx, dz, r) {
  const L = Math.hypot(dx, dz);
  const ex = r.x - sx;
  const ez = r.z - sz;
  const disp = Math.hypot(ex, ez);
  if (!isPositionFree(r.x, r.z, R, colliders)) return 'penetració';
  if (r.blocked) return 'subpas desfet (cas patològic)';
  if (disp > 2 * L + 1e-9) return `moviment absurd: ${fmt(disp)} m per a ${fmt(L)} m demanats`;
  if (L > 1e-9) {
    const ux = dx / L;
    const uz = dz / L;
    const along = ex * ux + ez * uz;           // component en la direcció demanada
    const lateral = Math.abs(-ex * uz + ez * ux); // component perpendicular (lliscament)
    if (along < worstRecoil) worstRecoil = along;
    if (along < -MAX_RECOIL) return `retrocedeix contra la direcció demanada (${fmt(along)} m)`;
    if (lateral > L + 1e-6) return `lliscament lateral massa gran (${fmt(lateral)} > ${fmt(L)})`;
  }
  return null;
}
test('15a. 50.000 moviments aleatoris d\'un sol pas (≤ 0,2 m): sense penetració, teletransport ni retrocés', () => {
  const rng = makeRng(20261106);
  const out = createMoveResult();
  let hits = 0;
  const problems = [];
  for (let i = 0; i < 50000; i++) {
    const [sx, sz] = randomFreeStart(rng);
    const angle = rng() * Math.PI * 2;
    const len = rng() < 0.2 ? 0.2 : rng() * 0.2;
    const dx = Math.cos(angle) * len;
    const dz = Math.sin(angle) * len;
    movePlayer(sx, sz, dx, dz, R, colliders, out);
    if (out.collided) hits++;
    const problem = checkMove(sx, sz, dx, dz, out);
    if (problem) problems.push(`#${i} des de (${fmt(sx)}, ${fmt(sz)}) dir (${fmt(dx)}, ${fmt(dz)}): ${problem}`);
  }
  expect(problems.length === 0, `${problems.length} problemes; primer: ${problems[0]}`);
  console.log(`      (${hits} de 50000 moviments han tocat un obstacle)`);
});
test('15b. 500 caminants × 200 fotogrames empenyent parets: mai dins un obstacle i mai fora del recinte', () => {
  const rng = makeRng(777);
  const out = createMoveResult();
  const problems = [];
  let hits = 0;
  for (let w = 0; w < 500; w++) {
    let [x, z] = randomFreeStart(rng);
    let angle = rng() * Math.PI * 2;
    for (let f = 0; f < 200; f++) {
      if (rng() < 0.08) angle = rng() * Math.PI * 2; else angle += (rng() - 0.5) * 0.3;
      const len = 0.2 * (0.5 + 0.5 * rng());
      const dx = Math.cos(angle) * len;
      const dz = Math.sin(angle) * len;
      movePlayer(x, z, dx, dz, R, colliders, out);
      if (out.collided) hits++;
      const problem = checkMove(x, z, dx, dz, out) || (inZones(out.x, out.z) ? null : `fora del recinte (${fmt(out.x)}, ${fmt(out.z)})`);
      if (problem) problems.push(`caminant ${w} fotograma ${f}: ${problem}`);
      x = out.x; z = out.z;
    }
  }
  expect(problems.length === 0, `${problems.length} problemes; primer: ${problems[0]}`);
  console.log(`      (${hits} de 100000 fotogrames han tocat un obstacle; retrocés màxim observat: ${(-worstRecoil * 1000).toFixed(1)} mm)`);
});

// ============================================================ resum
console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed === 0 ? 0 : 1);
