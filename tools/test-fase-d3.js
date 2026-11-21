// =====================================================================
// PROVES DE LA FASE D.3: cripta secreta, puzle dels tres símbols, sarcòfag i KEY-C          node tools/test-fase-d3.js   (necessita `three`)
// Prova dades, geometria generada, col·lisions i moviment amb el codi REAL (movePlayer, createFloors, createGameplay, createCryptGame).
// NO prova l'aspecte en pantalla, el so ni la GPU del navegador: això ho ha de mirar l'usuari.
// =====================================================================
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree, isActive } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createGameplay } from '../src/player/puzzle.js';
import { createCryptAccess, undergroundView } from '../src/player/crypt.js';
import { pickTarget } from '../src/player/interactions.js';
import { buildVillage, createGroundGeometry } from '../src/world/village.js';
import { SYMBOL_BITMAPS, SYMBOL_CELLS, SYMBOL_ATLAS_SIZE, SYMBOL_ORDER } from '../src/world/cryptSymbols.js';

const { CRYPT, CRYPT_WALLS, CRYPT_PROPS, CRYPT_FLOORS, FLOORS, KEYS, SECRET_DOOR, DOORS, PLAYER, BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS } = LAYOUT;
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const expect = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const R = PLAYER.collisionRadius;
const NO_CRYPT = { CRYPT_WALLS: [], CRYPT_PROPS: [] };
const mk = () => { // món nou: col·lisionadors + cripta (accés condicional) + terres
  const colliders = buildColliders(LAYOUT);
  const access = createCryptAccess(colliders, CRYPT);
  const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown });
  return { colliders, access, floors };
};
const inRect = (x, z, r) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;
const rectOf = (c) => (c.type === 'circle' ? { xMin: c.cx - c.radius, xMax: c.cx + c.radius, zMin: c.cz - c.radius, zMax: c.cz + c.radius } : c);
const gapBetween = (a, b) => { const A = rectOf(a); const B = rectOf(b); return Math.hypot(Math.max(0, A.xMin - B.xMax, B.xMin - A.xMax), Math.max(0, A.zMin - B.zMax, B.zMin - A.zMax)); };
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Un jugador amb el MATEIX bucle que main.js (moviment → terra/nivell). Passos de 0,06 m (≈ 3,6 m/s a 60 fps).
function makePlayer(world, x, z, level = 0) {
  const p = { x, z, level, feetY: world.floors.resolve(x, z, level).y, out: createMoveResult(), levels: [level] };
  p.step = (dx, dz) => {
    movePlayer(p.x, p.z, dx, dz, R, world.colliders, p.out, p.level); p.x = p.out.x; p.z = p.out.z;
    const fl = world.floors.resolve(p.x, p.z, p.level); p.feetY = fl.y; p.level = fl.level;
    if (p.levels[p.levels.length - 1] !== p.level) p.levels.push(p.level);
  };
  p.walk = (tx, tz, maxFrames = 800, speed = 0.06) => {
    for (let f = 0; f < maxFrames; f++) {
      const d = Math.hypot(tx - p.x, tz - p.z); if (d < 0.05) return true;
      const s = Math.min(speed, d); p.step(((tx - p.x) / d) * s, ((tz - p.z) / d) * s);
    }
    return Math.hypot(tx - p.x, tz - p.z) < 0.15;
  };
  return p;
}
const openSD = (g) => { g.inventory.add(KEYS[0]); g.inventory.add(KEYS[1]); g.secretDoor.interact(g.inventory); g.secretDoor.interact(g.inventory); for (let t = 0; t < 14 && g.secretDoor.state !== 'open'; t += 0.05) g.secretDoor.update(0.05); };
const cryptOcc = () => buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS }).filter((c) => !c.id.startsWith('CH-N-B-'));
const newGame = () => createGameplay({ KEYS, SECRET_DOOR, churchDoor: createSwingDoor(DOORS.find((d) => d.id === 'D1')), crypt: { def: CRYPT, occluders: cryptOcc() } });
const DT = 1 / 20;
const advance = (g, s, px = 0, pz = -34, dx = 0, dz = -1) => { for (let t = 0; t < s; t += DT) g.update(DT, px, pz, dx, dz); };
const EV = { level: -1, feetY: -3.2 };
// Col·loca el jugador davant de l'altar mirant el disc i (0, 1, 2) i prem E.
const pressDisc = (g, i, px = 0, pz = -34.0) => g.pressE(px, pz, CRYPT.puzzle.discX[i] - px, CRYPT.puzzle.discZ - pz, EV);

// =====================================================================
console.log('\n1. Dimensions i dades de la cripta (D.3 §1)');
// =====================================================================
const wall = (id) => CRYPT_WALLS.find((w) => w.id === id);
test('Caixa de l\'escala: exterior x −1,3→1,3 z −27,1→−21; interior x −0,9→0,9; parets de 0,4 m; replà z −22,2→−21', () => {
  const s = CRYPT.shaft;
  expect(s.outer.xMin === -1.3 && s.outer.xMax === 1.3 && s.outer.zMin === -27.1 && s.outer.zMax === -21, 'exterior');
  expect(s.inner.xMin === -0.9 && s.inner.xMax === 0.9 && s.inner.zMax === -21, 'interior');
  expect(near(wall('CR-SH-W').collision.xMax - wall('CR-SH-W').collision.xMin, 0.4) && near(wall('CR-SH-E').collision.xMax - wall('CR-SH-E').collision.xMin, 0.4), 'gruix 0,4');
  expect(s.landing.zMin === -22.2 && s.landing.zMax === -21, 'replà');
});
test('Escala: 16 graons de 0,2 m d\'alçada i 0,28 m de petjada, baixa 3,2 m cap al nord (−Z)', () => {
  const st = CRYPT_FLOORS.stairs[0]; expect(st.treads === 16 && st.riser === 0.2 && st.tread === 0.28 && near(st.run, 16 * 0.28), 'graons');
  expect(near(st.floorY, -16 * 0.2) && st.dir === -1 && st.axis === 'z' && st.start === -22.2, 'sentit/altura');
  expect(CRYPT.stair.steps === 16 && near(CRYPT.stair.rise * 16, 3.2) && near(CRYPT.stair.tread * 16, 4.48), 'CRYPT.stair');
});
test('Antecambra x −2,2→2,2 z −30→−26,7; cara sud amb parets de 0,4 (x −2,6→−1,3 i 1,3→2,6, z −26,7→−26,3)', () => {
  const r = CRYPT.rooms.ANT.rect; expect(r.xMin === -2.2 && r.xMax === 2.2 && r.zMin === -30 && r.zMax === -26.7, 'ANT');
  const w = wall('CR-ANT-S-W').collision; const e = wall('CR-ANT-S-E').collision;
  expect(w.xMin === -2.6 && w.xMax === -1.3 && w.zMin === -26.7 && w.zMax === -26.3 && e.xMin === 1.3 && e.xMax === 2.6 && e.zMin === -26.7 && e.zMax === -26.3, 'cara sud');
});
test('Obertura ANT→SALA x −0,8→0,8 dins del mur z −30,4→−30', () => {
  const o = CRYPT.openings.antSala; expect(o.xMin === -0.8 && o.xMax === 0.8 && o.zMin === -30.4 && o.zMax === -30, 'obertura');
  expect(wall('CR-DIV-W').collision.xMax === -0.8 && wall('CR-DIV-E').collision.xMin === 0.8 && wall('CR-DIV-W').collision.zMin === -30.4 && wall('CR-DIV-W').collision.zMax === -30, 'mur');
});
test('Gran sala x −6→2,6 z −35,6→−30,4; sala del guardià x −10,4→−6,4 z −35,6→−31; mur de 0,4 (x −6,4→−6) amb arc z −34,6→−33', () => {
  const s = CRYPT.rooms.SALA.rect; const g = CRYPT.rooms.GUARDIA.rect; const a = CRYPT.openings.arc;
  expect(s.xMin === -6 && s.xMax === 2.6 && s.zMin === -35.6 && s.zMax === -30.4, 'SALA');
  expect(g.xMin === -10.4 && g.xMax === -6.4 && g.zMin === -35.6 && g.zMax === -31, 'GUARDIA');
  expect(a.xMin === -6.4 && a.xMax === -6 && a.zMin === -34.6 && a.zMax === -33 && near(a.zMax - a.zMin, 1.6), 'arc');
  expect(wall('CR-ARC-S').collision.zMin === -33 && wall('CR-ARC-S').collision.zMax === -30.4 && wall('CR-ARC-N').collision.zMax === -34.6 && wall('CR-ARC-N').collision.zMin === -35.6, 'trams del mur');
});
test('Sarcòfag 1,0 × 2,2 a x −8,9→−7,9, z −34,4→−32,2; ≤ 2 pilars de r 0,3; separacions ≥ 1,2 m entre obstacles de la sala', () => {
  const sc = CRYPT_PROPS.find((p) => p.id === 'CR-SARC').collision; expect(near(sc.xMax - sc.xMin, 1) && near(sc.zMax - sc.zMin, 2.2) && sc.xMin === -8.9 && sc.zMin === -34.4, 'sarcòfag');
  const pil = CRYPT_PROPS.filter((p) => p.type === 'pillar'); expect(pil.length <= 2 && pil.every((p) => p.collision.radius === 0.3), 'pilars');
  const lvl = [...CRYPT_WALLS.filter((w) => w.level === -1), ...CRYPT_PROPS.filter((p) => p.level === -1)];
  const bad = [];
  for (const p of CRYPT_PROPS.filter((q) => q.level === -1)) for (const o of lvl) { if (o === p) continue; const g = gapBetween(p.collision, o.collision); if (g > 1e-9 && g < 1.2 - 1e-9) bad.push(`${p.id}–${o.id}: ${g.toFixed(2)}`); }
  expect(bad.length === 0, `separacions < 1,2 m: ${bad.join(', ')}`);
});
test('Res a x > 3,0 ni sota l\'església; tots els obstacles de la cripta dins del volum reservat (o el pou)', () => {
  const b = CRYPT.bounds;
  for (const w of CRYPT_WALLS.filter((q) => q.level === -1)) { const c = w.collision; expect(c.xMax <= 3.0 && c.xMin >= b.xMin && c.zMin >= b.zMin - 1e-9 && c.zMax <= -26.3 + 1e-9, `${w.id} fora del volum`); }
  for (const p of CRYPT_PROPS.filter((q) => q.level === -1)) { const c = rectOf(p.collision); expect(c.xMax <= 3.0 && c.zMax <= -26.3 + 1e-9, `${p.id} fora`); }
  expect(CRYPT.bounds.xMax === 3.0, 'límit est');
});
test('Ids únics i cap id de la cripta xoca amb els del poble/cementiri; KEY-C no és a KEYS (el sistema KEY-A/KEY-B no canvia)', () => {
  const ids = [...CRYPT_WALLS.map((w) => w.id), ...CRYPT_PROPS.map((p) => p.id)];
  expect(new Set(ids).size === ids.length, 'ids duplicats');
  const all = buildColliders(LAYOUT).map((c) => c.id); expect(new Set(all).size === all.length, 'ids duplicats a tot el layout');
  expect(!KEYS.some((k) => k.id === 'KEY-C') && KEYS.length === 2 && CRYPT.keyC.id === 'KEY-C', 'KEY-C');
  expect(SECRET_DOOR.center.x === 0 && SECRET_DOOR.center.z === -20.4 && SECRET_DOOR.width === 1.4 && SECRET_DOOR.slots.length === 2, 'SD intacta');
});

// =====================================================================
console.log('\n2. Continuïtat de l\'escala i canvi de nivell');
// =====================================================================
test('Alçada contínua: 0 al replà, −3,2 a la boca de l\'antecambra, mai puja, sense salts, pendent ≤ 0,2/0,28', () => {
  const { floors } = mk(); let prev = floors.heightAt(0, -22.2, 0); expect(near(prev, 0), 'replà'); let maxJump = 0;
  for (let z = -22.2; z >= -26.7; z -= 0.005) { const y = floors.heightAt(0, z, z < -24.16 ? -1 : 0); expect(y <= prev + 1e-9, `puja a z ${z}`); maxJump = Math.max(maxJump, prev - y); prev = y; }
  expect(near(prev, -3.2, 1e-6), `fons ${prev}`); expect(maxJump <= 0.005 * (0.2 / 0.28) + 1e-6, `salt ${maxJump}`);
  expect(near(floors.heightAt(0, -26.8, -1), -3.2) && near(floors.heightAt(0, -28, -1), -3.2), 'antecambra');
  for (let i = 0; i <= 16; i++) expect(near(floors.heightAt(0, -22.2 - 0.28 * i, i > 5 ? -1 : 0), -0.2 * i, 1e-6), `aresta del graó ${i}`);
});
test('Nivell −1 només per sota de y −1,4; 0 a la superfície; 1 al pis de la casa C (sense canvis)', () => {
  const { floors } = mk(); expect(floors.levelFor(0) === 0 && floors.levelFor(-1.39) === 0 && floors.levelFor(-1.41) === -1 && floors.levelFor(-3.2) === -1 && floors.levelFor(2.75) === 1, 'levelFor');
  expect(near(floors.resolve(0, -15, 0).y, 0) && floors.resolve(0, -15, 0).level === 0, 'nau');
  expect(floors.resolve(4, 12, 1).level === 1 && near(floors.resolve(4, 12, 1).y, 2.75), 'pis superior (casa C)');
});
test('Terra del món: el forat de l\'escala és exactament x ±0,9, z −26,7→−22,2 (la geometria té el forat)', () => {
  const g = createGroundGeometry(200, [CRYPT.shaft.hole]); const pos = g.attributes.position; let inside = 0; let hasHoleVerts = 0;
  for (let i = 0; i < pos.count; i++) { if (near(pos.getX(i), 0.9) || near(pos.getX(i), -0.9)) hasHoleVerts++; }
  const idx = g.index; const tri = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < tri; t++) { const a = idx ? idx.getX(t * 3) : t * 3; const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1; const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2; const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3; const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3; if (Math.abs(cx) < 0.89 && cy > 22.3 && cy < 26.6) inside++; }
  expect(hasHoleVerts >= 4 && inside === 0, `triangles dins del forat: ${inside}`);
  let area = 0; for (let t = 0; t < tri; t++) { const a = idx ? idx.getX(t * 3) : t * 3; const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1; const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2; area += Math.abs((pos.getX(b) - pos.getX(a)) * (pos.getY(c) - pos.getY(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getY(b) - pos.getY(a))) / 2; }
  expect(near(area, 200 * 200 - 1.8 * 4.5, 1e-3), `àrea ${area}`);
});

// =====================================================================
console.log('\n3. Accés: impossible amb SD tancada, possible amb SD oberta');
// =====================================================================
const NAVE = { x: 0, z: -15 };
// L'altar de l'església (ALT, x ±0,9, z −19,15→−18,45) és entre la nau i SD: cal voltar-lo pel passadís lliure del costat est (≥ 1,25 m a darrere).
const NAVE_TO_SD = [[0, -17.9], [1.6, -17.9], [1.6, -19.8], [0, -19.8]];
test('Amb SD tancada: CH-N-B és actiu i les dues peces són desactivades (estat inicial del sistema d\'accés)', () => {
  const w = mk(); const o = w.colliders.find((c) => c.id === 'CH-N-B'); expect(o && o.enabled !== false && w.access.pieces.length === 2 && w.access.pieces.every((p) => p.enabled === false), 'estat inicial');
  expect(!isPositionFree(0, -20.2, R, w.colliders, undefined, 0), 'el jugador no pot ser a z −20,2 (paret a −20,4)');
});
test('Amb SD tancada (inclosos els estats unlocked/opening) el jugador des de la nau no passa de z −20,05 ni arriba mai al pou ni al nivell −1', () => {
  for (const st of ['locked', 'unlocked', 'opening']) {
    const w = mk(); w.access.sync(st); const p = makePlayer(w, NAVE.x, NAVE.z); let minZ = 0;
    for (const tx of [-0.6, 0, 0.6]) { p.walk(tx, -15, 300); for (let f = 0; f < 400; f++) { p.step(0, -0.06); minZ = Math.min(minZ, p.z); } p.walk(NAVE.x, NAVE.z, 600); }
    expect(minZ >= -20.4 + R - 1e-6 && p.level === 0 && !p.levels.includes(-1), `st ${st}: z mínima ${minZ}`);
  }
});
test('Connectivitat (graella 0,1 m des de la nau, nivell 0): amb SD tancada cap cel·la del pou ni de la cripta; amb SD oberta el replà i l\'escala', () => {
  const cell = 0.1; const win = { xMin: -6, xMax: 6, zMin: -29, zMax: -8 }; const nx = Math.round((win.xMax - win.xMin) / cell); const nz = Math.round((win.zMax - win.zMin) / cell);
  const run = (state) => {
    const w = mk(); w.access.sync(state); const level = (x, z) => 0;
    const free = new Uint8Array(nx * nz); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = isPositionFree(win.xMin + (i + 0.5) * cell, win.zMin + (j + 0.5) * cell, R, w.colliders, undefined, 0) ? 1 : 0;
    const seen = new Uint8Array(nx * nz); const s = Math.floor((NAVE.z - win.zMin) / cell) * nx + Math.floor((NAVE.x - win.xMin) / cell); const q = [s]; seen[s] = 1;
    for (let h = 0; h < q.length; h++) { const k = q[h]; const i = k % nx; for (const m of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (m >= 0 && m < nx * nz && free[m] && !seen[m]) { seen[m] = 1; q.push(m); } }
    let inShaft = 0; let landing = 0; for (let k = 0; k < nx * nz; k++) if (seen[k]) { const x = win.xMin + ((k % nx) + 0.5) * cell; const z = win.zMin + (Math.floor(k / nx) + 0.5) * cell; if (inRect(x, z, CRYPT.shaft.inner)) inShaft++; if (inRect(x, z, CRYPT.shaft.landing)) landing++; }
    return { inShaft, landing };
  };
  const c = run('locked'); expect(c.inShaft === 0 && c.landing === 0, `tancada: ${JSON.stringify(c)}`);
  const o = run('open'); expect(o.landing > 20 && o.inShaft > o.landing, `oberta: ${JSON.stringify(o)}`);
});
test('Les peces de CH-N-B són DINS de CH-N-B: unió idèntica (x −4→4, z −21→−20,4) i amb la porta oberta deixen el pas x −0,7→0,7', () => {
  const w = mk(); const [a, b] = w.access.pieces; expect(a.xMin === -4 && a.xMax === -0.7 && b.xMin === 0.7 && b.xMax === 4 && a.zMin === -21 && a.zMax === -20.4 && b.zMin === -21 && b.zMax === -20.4, 'peces');
  w.access.sync('open'); expect(w.access.original.enabled === false && a.enabled === true && b.enabled === true, 'estat obert');
  expect(isPositionFree(0, -20.7, R, w.colliders, undefined, 0) && isPositionFree(0.35, -20.7, 0.34, w.colliders, undefined, 0), 'el pas és lliure');
  expect(!isPositionFree(1.0, -20.7, 0.01, w.colliders, undefined, 0) && !isPositionFree(-1.0, -20.7, 0.01, w.colliders, undefined, 0), 'a x ±1 hi ha paret');
  w.access.sync('locked'); expect(w.access.original.enabled !== false && a.enabled === false && b.enabled === false, 'es torna a tancar');
});
test('Pas lliure per al jugador (radi 0,35) i el sistema real: obrir SD (KEY-A + KEY-B) i caminar de la nau al replà', () => {
  const w = mk(); const g = newGame(); openSD(g); w.access.sync(g.secretDoor.state); expect(g.secretDoor.state === 'open', 'SD oberta');
  const p = makePlayer(w, NAVE.x, NAVE.z); for (const [x, z] of NAVE_TO_SD) expect(p.walk(x, z, 600), `no arriba a (${x}, ${z}); és a (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`); expect(p.walk(0, -21.6, 400), 'arriba al replà'); expect(p.z < -21 && p.level === 0 && near(p.feetY, 0), `z ${p.z} nivell ${p.level}`);
});

// =====================================================================
console.log('\n4. Moviment entre nivells, sales i col·lisions');
// =====================================================================
const ROUTE = [...NAVE_TO_SD, [0, -21.6], [0, -25.0], [0, -28.5], [0, -31.0], [-1.5, -33.0], [-4.5, -33.8], [-7.2, -33.8], [-7.2, -31.7], [-8.4, -31.6]];
test('Recorregut complet (nau → escala → antecambra → gran sala → arc → sala del guardià) i tornada, amb els canvis de nivell 0 → −1 → 0 una sola vegada', () => {
  const w = mk(); w.access.sync('open'); const p = makePlayer(w, NAVE.x, NAVE.z);
  for (const [x, z] of ROUTE) expect(p.walk(x, z, 900), `no arriba a (${x}, ${z}); és a (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
  expect(p.level === -1 && near(p.feetY, -3.2), `final nivell ${p.level} y ${p.feetY}`); expect(JSON.stringify(p.levels) === '[0,-1]', `nivells ${JSON.stringify(p.levels)}`);
  for (const [x, z] of [...ROUTE].reverse().slice(1)) expect(p.walk(x, z, 900), `tornada: (${x}, ${z})`);
  expect(p.walk(0, -17.9, 900) && p.walk(NAVE.x, NAVE.z, 900), 'torna a la nau'); expect(p.level === 0 && near(p.feetY, 0) && JSON.stringify(p.levels) === '[0,-1,0]', `nivells ${JSON.stringify(p.levels)}`);
});
test('Escala: mentre es baixa l\'alçada dels peus baixa de forma contínua (sense salts > 0,06 m per pas) i es puja igual', () => {
  const w = mk(); w.access.sync('open'); const p = makePlayer(w, 0, -21.6); let prev = p.feetY; let maxJump = 0; let monotone = true;
  for (let f = 0; f < 200 && p.z > -26.8; f++) { p.step(0, -0.06); maxJump = Math.max(maxJump, Math.abs(p.feetY - prev)); if (p.feetY > prev + 1e-9) monotone = false; prev = p.feetY; }
  expect(monotone && maxJump <= 0.06 * (0.2 / 0.28) + 1e-6, `salt ${maxJump}`); expect(near(p.feetY, -3.2, 0.05), 'baixa fins al terra');
  prev = p.feetY; for (let f = 0; f < 200 && p.z < -22.3; f++) { p.step(0, 0.06); maxJump = Math.max(maxJump, Math.abs(p.feetY - prev)); prev = p.feetY; } expect(maxJump <= 0.06 * (0.2 / 0.28) + 1e-6 && p.level === 0, 'pujada contínua');
});
test('Parets del pou i de l\'antecambra: no es pot sortir lateralment de l\'escala ni travessar les parets de la cripta', () => {
  const w = mk(); w.access.sync('open'); const p = makePlayer(w, 0, -24); let maxAbsX = 0;
  for (const dx of [-0.06, 0.06]) { for (let f = 0; f < 80; f++) { p.step(dx, 0); maxAbsX = Math.max(maxAbsX, Math.abs(p.x)); } p.walk(0, -24); }
  expect(maxAbsX <= 0.9 - R + 1e-6, `x màxima ${maxAbsX}`);
});
test('Gran bucle de proves aleatòries (60 000 passos) dins la cripta: mai dins de cap paret/pilar/sarcòfag/altar i sempre dins del volum permès', () => {
  const w = mk(); w.access.sync('open'); const p = makePlayer(w, 0, -28.5, -1); p.feetY = -3.2; const rnd = mulberry32(3033); let heading = 0; let violations = 0; let bad = '';
  const allowed = [CRYPT.rooms.ANT.rect, CRYPT.openings.antSala, CRYPT.rooms.SALA.rect, CRYPT.openings.arc, CRYPT.rooms.GUARDIA.rect, { xMin: -0.9, xMax: 0.9, zMin: -26.8, zMax: -21 }, { xMin: -0.7, xMax: 0.7, zMin: -21, zMax: -20.4 }];
  const sealed = [...CRYPT_WALLS.filter((c) => c.level === -1), ...CRYPT_PROPS.filter((c) => c.level === -1)].map((c) => c.collision);
  const visited = new Set();
  for (let n = 0; n < 60000; n++) {
    if (n % 15 === 0) heading += (rnd() - 0.5) * 2.4; if (p.z > -21.2) { heading = Math.PI / 2 + (rnd() - 0.5) * 0.5; } // al replà, torna cap avall (no sortim a la nau)
    p.step(Math.cos(heading) * 0.06, Math.sin(heading) * 0.06);
    if (p.level === 0 && p.z > -21.3) { p.x = 0; p.z = -22; p.level = 0; }
    if (!allowed.some((r) => inRect(p.x, p.z, r))) { violations++; bad = `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`; }
    if (p.level === -1) { for (const c of sealed) { const k = rectOf(c); if (p.x > k.xMin + 0.001 && p.x < k.xMax - 0.001 && p.z > k.zMin + 0.001 && p.z < k.zMax - 0.001) { violations++; bad = `dins ${JSON.stringify(c).slice(0, 50)}`; } } }
    visited.add(`${Math.round(p.x)},${Math.round(p.z)}`);
  }
  expect(violations === 0, `${violations} violacions, p. ex. ${bad}`); expect(visited.size > 40, `només ${visited.size} cel·les visitades`);
});
test('Obstacles de la sala: pilars (r 0,3), altar i sarcòfag aturen el jugador i no s\'hi pot entrar des de cap costat', () => {
  const w = mk(); w.access.sync('open');
  const tryInto = (x, z, tx, tz) => { const p = makePlayer(w, x, z, -1); p.feetY = -3.2; p.walk(tx, tz, 200); return p; };
  let p = tryInto(-2.8, -31.4, -2.8, -32.4); expect(Math.hypot(p.x + 2.8, p.z + 32.4) >= 0.3 + R - 1e-3, 'pilar oest');
  p = tryInto(1.0, -31.4, 1.0, -32.4); expect(Math.hypot(p.x - 1.0, p.z + 32.4) >= 0.3 + R - 1e-3, 'pilar est');
  p = tryInto(0, -33.5, 0, -35.2); expect(p.z >= -34.8 + R - 1e-3, `altar ${p.z}`);
  p = tryInto(-7.0, -33.3, -8.4, -33.3); expect(p.x >= -7.9 + R - 1e-3, `sarcòfag ${p.x}`);
  p = tryInto(-8.4, -31.6, -8.4, -33.3); expect(p.z >= -32.2 + R - 1e-3, `sarcòfag (sud) ${p.z}`);
});
test('Nivells independents: un jugador al nivell 0 no col·lisiona amb els obstacles del nivell −1 (ni a l\'inrevés amb els del nivell 1)', () => {
  const w = mk(); expect(isPositionFree(-8.4, -33.3, R, w.colliders, undefined, 0), 'el sarcòfag no existeix al nivell 0'); expect(!isPositionFree(-8.4, -33.3, R, w.colliders, undefined, -1), 'sí al −1');
  const tbl = w.colliders.find((c) => c.id === 'C-U-CLUE-TABLE'); expect(tbl && tbl.level === 1 && !isActive(tbl, 0) && !isActive(tbl, -1) && isActive(tbl, 1), 'la tauleta només és del nivell 1');
  const sarc = w.colliders.find((c) => c.id === 'CR-SARC'); expect(sarc.level === -1 && !isActive(sarc, 0) && !isActive(sarc, 1), 'el sarcòfag només és del nivell −1');
});

// =====================================================================
console.log('\n5. Caixa-pista (casa C, pis superior)');
// =====================================================================
const AT_BOX = { px: 4.2, pz: 10.7, dx: 0, dz: -1 };
test('La caixa és damunt la tauleta (x 3,8→4,6, z 9,4→9,95, y 2,75+0,8) i la tauleta és un obstacle del pis superior', () => {
  const c = CRYPT.clue; expect(c.center.x - c.w / 2 > 3.8 && c.center.x + c.w / 2 < 4.6 && c.center.z - c.d / 2 > 9.4 && c.center.z + c.d / 2 < 9.95 && near(c.y, 3.55), 'posició');
  const w = mk(); expect(!isPositionFree(4.2, 9.7, 0.01, w.colliders, undefined, 1), 'tauleta sòlida al nivell 1'); expect(isPositionFree(4.2, 10.7, R, w.colliders, undefined, 1), 'es pot arribar davant la tauleta');
});
test('E davant la caixa (pis superior) mostra la nota, no dona cap clau i no activa res de la casa; E de nou la tanca', () => {
  const g = newGame(); const inv0 = g.inventory.list().length; const doors0 = JSON.stringify(g.houseDoors && Object.keys(g.houseDoors).map((k) => g.houseDoors[k].open ?? g.houseDoors[k].signedAngle));
  g.update(DT, AT_BOX.px, AT_BOX.pz, 0, -1, { level: 1, feetY: 2.75 }); expect(g.target && g.target.id === 'CLUE-BOX' && /examinar/.test(g.prompt), `objectiu ${g.target && g.target.id}`);
  g.pressE(AT_BOX.px, AT_BOX.pz, 0, -1, { level: 1, feetY: 2.75 }); expect(g.crypt.note.isOpen() && g.crypt.note.seen(), 'nota oberta');
  expect(g.crypt.drainEvents().some((e) => e.type === 'note'), 'esdeveniment');
  expect(g.inventory.list().length === inv0 && !g.inventory.has('KEY-A') && !g.inventory.has('KEY-B') && !g.inventory.has('KEY-C'), 'cap clau');
  expect(JSON.stringify(g.houseDoors && Object.keys(g.houseDoors).map((k) => g.houseDoors[k].open ?? g.houseDoors[k].signedAngle)) === doors0, 'les portes de casa no canvien'); expect(g.secretDoor.state === 'locked', 'SD intacta');
  g.update(DT, AT_BOX.px, AT_BOX.pz, 0, -1, { level: 1, feetY: 2.75 }); expect(/tancar/.test(g.prompt), 'prompt de tancar');
  g.pressE(AT_BOX.px, AT_BOX.pz, 0, -1, { level: 1, feetY: 2.75 }); expect(!g.crypt.note.isOpen(), 'tancada amb E');
});
test('La nota s\'autotanca en allunyar-se (> 2,6 m); no es pot examinar des de la planta baixa, de lluny, d\'esquena ni a través de la paret', () => {
  const g = newGame(); g.pressE(AT_BOX.px, AT_BOX.pz, 0, -1, { level: 1, feetY: 2.75 }); expect(g.crypt.note.isOpen(), 'oberta');
  g.update(DT, 4.2, 13.5, 0, -1, { level: 1, feetY: 2.75 }); expect(!g.crypt.note.isOpen(), 'autotancada');
  const g2 = newGame(); g2.pressE(4.2, 10.7, 0, -1, { level: 0, feetY: 0 }); expect(!g2.crypt.note.isOpen(), 'des de la planta baixa');
  g2.pressE(4.2, 13.5, 0, -1, EV); g2.pressE(4.2, 13.5, 0, -1, { level: 1, feetY: 2.75 }); expect(!g2.crypt.note.isOpen(), 'de lluny (3,8 m)');
  g2.pressE(4.2, 10.7, 0, 1, { level: 1, feetY: 2.75 }); expect(!g2.crypt.note.isOpen(), 'd\'esquena');
});
test('Text de la nota exacte i símbols en ordre Campana → Lluna → Creu', () => {
  expect(CRYPT.clue.text === 'El guardià no escolta qui truca, sinó qui recorda l\'ordre.', 'text'); expect(CRYPT.clue.order.join() === 'bell,moon,cross', 'ordre');
  expect(CRYPT.puzzle.solution.join() === CRYPT.clue.order.join(), 'la pista és la solució');
});

// =====================================================================
console.log('\n6. Puzle dels tres discs (altar de la gran sala)');
// =====================================================================
test('Estat inicial: tres discs amb el SOL (cap combinació correcta, no aleatori); el puzle no està resolt i el sarcòfag està bloquejat', () => {
  const g = newGame(); expect(g.crypt.puzzle.symbols().join() === 'sun,sun,sun' && !g.crypt.puzzle.solved() && g.crypt.sarcophagus.state() === 'locked', 'inicial');
});
test('Cal ser DAVANT de l\'altar i a ≤ 1,75 m; E des de darrere, de lluny, des d\'una altra sala o sense mirar un disc no gira res', () => {
  const g = newGame(); const s0 = g.crypt.puzzle.symbols().join();
  for (const [px, pz, dx, dz] of [[0, -32.5, 0, -1], [0, -31.5, 0, -1], [3.5, -34.4, -1, 0], [0, -34.0, 0, 1], [0, -34.0, 1, 0], [-8.4, -33.3, 1, 0], [0, -36.4, 0, 1]]) g.pressE(px, pz, dx, dz, EV);
  expect(g.crypt.puzzle.symbols().join() === s0, `s'ha mogut: ${g.crypt.puzzle.symbols()}`);
  pressDisc(g, 1); expect(g.crypt.puzzle.symbols().join() === 'sun,bell,sun', 'des del davant sí');
});
test('Cada E gira UN SOL disc (el que es mira): esquerra / mig / dreta, i cicla campana → lluna → creu → sol → campana', () => {
  const g = newGame(); pressDisc(g, 0); expect(g.crypt.puzzle.symbols().join() === 'bell,sun,sun', 'disc 0'); pressDisc(g, 2); expect(g.crypt.puzzle.symbols().join() === 'bell,sun,bell', 'disc 2');
  pressDisc(g, 0); pressDisc(g, 0); pressDisc(g, 0); expect(g.crypt.puzzle.symbols().join() === 'sun,sun,bell', 'cicle de 4 (campana → lluna → creu → sol)'); expect(CRYPT.puzzle.symbols.join() === 'bell,moon,cross,sun', 'ordre del cicle');
  advance(g, 2); expect(Math.abs(g.crypt.puzzle.discAngle(0) - 4 * Math.PI / 2) < 1e-6, 'animació acaba a 4 × 90°');
});
test('Indicació en pantalla: "E — girar el disc …" només davant de l\'altar; hint discret quan no hi ha objectiu', () => {
  const g = newGame(); g.update(DT, 0, -34.0, 0, -1, EV); expect(/girar el disc/.test(g.prompt), `prompt "${g.prompt}"`);
  expect(g.hint(0, -33.0) !== '' || true, ''); const g2 = newGame(); g2.update(DT, 0, -33.2, 1, 0, EV); expect(g2.prompt === '' && /Altar dels tres discs/.test(g2.hint(0, -33.2)), `hint "${g2.hint(0, -33.2)}"`);
  const g3 = newGame(); g3.update(DT, 0, -31, 0, -1, EV); expect(g3.hint(0, -31) === '', 'sense hint lluny');
});
test('Seqüència correcta CAMPANA → LLUNA → CREU: resol el puzle (esdeveniment), el sarcòfag es desbloqueja DESPRÉS d\'una pausa, i NO es dona KEY-C', () => {
  const g = newGame(); pressDisc(g, 0); pressDisc(g, 1); pressDisc(g, 1); pressDisc(g, 2); pressDisc(g, 2); pressDisc(g, 2);
  expect(g.crypt.puzzle.symbols().join() === 'bell,moon,cross' && g.crypt.puzzle.solved(), 'resolt'); const ev = g.crypt.drainEvents().map((e) => e.type);
  expect(ev.filter((t) => t === 'solved').length === 1 && !ev.includes('mechanism'), `esdeveniments ${ev}`); expect(/desbloquejat/.test(g.message), `missatge "${g.message}"`);
  expect(g.crypt.sarcophagus.state() === 'locked', 'encara bloquejat'); advance(g, 1.3); expect(g.crypt.sarcophagus.state() === 'unlocking' && g.crypt.drainEvents().some((e) => e.type === 'mechanism'), 'mecanisme en marxa');
  advance(g, 1.6); expect(g.crypt.sarcophagus.state() === 'unlocked' && g.crypt.sarcophagus.unlockProgress() === 1, 'desbloquejat');
  expect(!g.inventory.has('KEY-C') && g.inventory.list().length === 0, 'KEY-C no s\'ha donat automàticament'); expect(!g.crypt.sarcophagus.keyVisible(), 'la clau encara no es veu');
  expect(g.crypt.puzzle.sealProgress() === 1, 'discs segellats');
});
test('Les 64 combinacions de gir (0–3 per disc): només una (1, 2, 3 girs = campana, lluna, creu) resol el puzle; les altres no fan res al sarcòfag', () => {
  let solved = 0; const winner = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    const g = newGame(); for (let i = 0; i < a; i++) pressDisc(g, 0); for (let i = 0; i < b; i++) pressDisc(g, 1); for (let i = 0; i < c; i++) pressDisc(g, 2); advance(g, 4);
    if (g.crypt.puzzle.solved()) { solved++; winner.push([a, b, c].join()); expect(g.crypt.puzzle.symbols().join() === 'bell,moon,cross', 'símbols'); } else expect(g.crypt.sarcophagus.state() === 'locked' && !g.crypt.puzzle.solved(), `combinació ${a}${b}${c} ha desbloquejat`);
  }
  expect(solved === 1 && winner[0] === '1,2,3', `resolen: ${winner}`);
});
test('Ordres equivocats amb els símbols correctes (lluna, campana, creu; creu, lluna, campana; etc.) no resolen', () => {
  const perms = [['moon', 'bell', 'cross'], ['bell', 'cross', 'moon'], ['cross', 'moon', 'bell'], ['moon', 'cross', 'bell'], ['cross', 'bell', 'moon']];
  for (const p of perms) { const g = newGame(); p.forEach((s, i) => { const n = (CRYPT.puzzle.symbols.indexOf(s) - 3 + 4) % 4; for (let k = 0; k < n; k++) pressDisc(g, i); }); advance(g, 4); expect(g.crypt.puzzle.symbols().join() === p.join() && !g.crypt.puzzle.solved() && g.crypt.sarcophagus.state() === 'locked', `permutació ${p}`); }
});
test('Combinació equivocada: no passa res de dolent i es pot continuar provant fins resoldre; un cop resolt, els discs ja no giren (objectiu desactivat)', () => {
  const g = newGame(); pressDisc(g, 0); pressDisc(g, 0); pressDisc(g, 1); pressDisc(g, 2); expect(g.crypt.puzzle.symbols().join() === 'moon,bell,bell' && !g.crypt.puzzle.solved(), 'equivocada'); advance(g, 3);
  expect(g.crypt.sarcophagus.state() === 'locked' && g.crypt.drainEvents().every((e) => e.type === 'disc'), 'cap efecte');
  pressDisc(g, 0); pressDisc(g, 0); pressDisc(g, 0); pressDisc(g, 1); pressDisc(g, 2); pressDisc(g, 2); expect(g.crypt.puzzle.solved() && g.crypt.puzzle.symbols().join() === 'bell,moon,cross', 'resolt després d\'equivocar-se');
  const sol = g.crypt.puzzle.symbols().join(); pressDisc(g, 0); pressDisc(g, 1); expect(g.crypt.puzzle.symbols().join() === sol, 'ja no giren'); g.update(DT, 0, -34.0, 0, -1, EV); expect(!g.target || g.target.id !== 'CR-DISCS', 'objectiu desactivat');
});

// =====================================================================
console.log('\n7. Sarcòfag i KEY-C');
// =====================================================================
const SOLVED = () => { const g = newGame(); pressDisc(g, 0); pressDisc(g, 1); pressDisc(g, 1); pressDisc(g, 2); pressDisc(g, 2); pressDisc(g, 2); advance(g, 3.2); return g; };
const AT_SARC = { px: -7.2, pz: -33.3, dx: -1, dz: 0 };
test('Abans de resoldre: E al sarcòfag només dona un missatge (la tapa no cedeix); no hi ha KEY-C ni animació', () => {
  const g = newGame(); g.update(DT, AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); expect(g.target && g.target.id === 'CR-SARC-LID' && /examinar/.test(g.prompt), `objectiu ${g.target && g.target.id}`);
  g.pressE(AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); expect(/no cedeix/.test(g.message), `missatge "${g.message}"`); expect(g.crypt.sarcophagus.state() === 'locked' && g.crypt.sarcophagus.lidProgress() === 0 && !g.crypt.sarcophagus.keyVisible(), 'bloquejat');
  advance(g, 5, AT_SARC.px, AT_SARC.pz); expect(g.crypt.sarcophagus.state() === 'locked', 'segueix bloquejat'); expect(!g.inventory.has('KEY-C'), 'sense clau');
  g.pressE(AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); g.pressE(-8.4, -31.6, 0, -1, EV); expect(g.crypt.sarcophagus.state() === 'locked' && !g.inventory.has('KEY-C'), 'cap pulsació el pot obrir');
});
test('Desbloquejat: E alça la tapa (animació 2,6 s, la clau apareix a mig camí); la tapa no es pot tornar a "obrir" ni la clau agafar mentre s\'obre', () => {
  const g = SOLVED(); g.update(DT, AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); expect(/alçar la tapa/.test(g.prompt), `prompt "${g.prompt}"`);
  g.pressE(AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); expect(g.crypt.sarcophagus.state() === 'opening' && g.crypt.drainEvents().some((e) => e.type === 'lid'), 'obrint');
  advance(g, 0.5, AT_SARC.px, AT_SARC.pz); expect(!g.crypt.sarcophagus.keyVisible() && g.crypt.sarcophagus.lidProgress() > 0 && g.crypt.sarcophagus.lidProgress() < 0.5, 'la clau encara no es veu');
  g.pressE(AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); expect(!g.inventory.has('KEY-C'), 'no es pot agafar a mitges');
  advance(g, 1.2, AT_SARC.px, AT_SARC.pz); expect(g.crypt.sarcophagus.keyVisible() && g.crypt.sarcophagus.state() === 'opening', 'la clau apareix'); advance(g, 1.3, AT_SARC.px, AT_SARC.pz); expect(g.crypt.sarcophagus.state() === 'open' && g.crypt.sarcophagus.lidProgress() === 1, 'oberta');
});
test('Amb la tapa oberta, E recull KEY-C a l\'inventari EXISTENT (una sola vegada); KEY-C és de ferro negre amb una creu; no apareix a KEYS', () => {
  const g = SOLVED(); g.pressE(AT_SARC.px, AT_SARC.pz, AT_SARC.dx, AT_SARC.dz, EV); advance(g, 3, AT_SARC.px, AT_SARC.pz);
  g.update(DT, -8.4, -31.6, 0, -1, EV); expect(g.target && g.target.id === 'KEY-C' && /recollir/.test(g.prompt), `objectiu ${g.target && g.target.id} "${g.prompt}"`);
  g.pressE(-8.4, -31.6, 0, -1, EV); expect(g.inventory.has('KEY-C') && g.inventory.list().length === 1, 'KEY-C a l\'inventari'); const k = g.inventory.list()[0];
  expect(k.id === 'KEY-C' && /ferro negre/.test(k.description) && /creu/.test(k.description) && k.symbol === 'cross', JSON.stringify(k)); expect(g.crypt.sarcophagus.keyTaken() && g.crypt.sarcophagus.state() === 'open', 'la clau consta com a recollida (main.js l\'amaga: keyVisible && !keyTaken)');
  g.pressE(-8.4, -31.6, 0, -1, EV); expect(g.inventory.list().length === 1, 'no es duplica'); g.update(DT, -8.4, -31.6, 0, -1, EV); expect(!g.target || g.target.id !== 'KEY-C', 'ja no és interactuable');
  expect(!KEYS.some((q) => q.id === 'KEY-C'), 'no és a KEYS'); expect(CRYPT.keyC.material === 'blackIron', 'material');
});
test('KEY-C no obre res en aquesta fase (D.4 no existeix): la reixa del cementiri continua tancada i amb els mateixos col·lisionadors', () => {
  const w = mk(); const a = w.colliders.find((c) => c.id === 'M-E3'); expect(a && a.enabled !== false && a.xMin === 15 && a.xMax === 15.4 && a.zMin === -9 && a.zMax === -7, 'M-E3 intacta');
  expect(!LAYOUT.CEM_GATE.openCollision && LAYOUT.CEM_GATE.state === 'locked', 'reixa bloquejada'); expect(!w.colliders.some((c) => /GATE-OPEN|CEM-GATE|LEAF|LOCK/i.test(c.id)), 'cap col·lisionador D.4');
});
test('Compatibilitat: SD oberta amb la cripta mostra el missatge de la baixada; sense cripta (joc pla) manté "una foscor freda" (no es trenca res)', () => {
  const g = newGame(); openSD(g); const sd = g.targets.find((t) => t.id === 'SD'); const r = sd.use(0, -18, 0, -1, { level: 0, feetY: 0 }); expect(r && r.action === 'dark' && /escala/.test(g.message), `missatge "${g.message}"`);
  const plain = createGameplay({ KEYS, SECRET_DOOR, churchDoor: createSwingDoor(DOORS.find((d) => d.id === 'D1')) }); openSD(plain); const r2 = plain.targets.find((t) => t.id === 'SD').use(0, -18, 0, -1, { level: 0, feetY: 0 }); expect(r2.action === 'dark' && /foscor/.test(plain.message), 'sense cripta');
});

// =====================================================================
console.log('\n8. Llum i atmosfera soterrània (matemàtiques)');
// =====================================================================
test('undergroundView: a fora tot igual que abans (hemi 1,5, lluna 1,2, boira base); a sota llum ambient baixa però més clara (D.4: 0,5–0,9), sense lluna i poble amagat', () => {
  const a = undergroundView(0, 0, -15, CRYPT); expect(near(a.hemi, 1.5) && near(a.moon, 1.2) && a.fogT === 0 && a.villageVisible && !a.lightOn, 'superfície');
  const b = undergroundView(-3.2, 0, -30, CRYPT); expect(b.hemi <= 0.9 && b.hemi >= 0.5 && b.moon === 0 && b.fogT === 1 && !b.villageVisible && b.interiorVisible && b.lightOn, 'cripta');
  let prev = 2; for (let y = 0; y >= -3.2; y -= 0.1) { const v = undergroundView(y, 0, -24, CRYPT); expect(v.hemi <= prev + 1e-9, 'monòton'); prev = v.hemi; }
  const c = undergroundView(0, 10, 10, CRYPT); expect(!c.interiorVisible && !c.lightOn, 'l\'interior no es dibuixa des de fora');
  expect(undergroundView(0, 0, -15, CRYPT).interiorVisible, 'a la nau sí (es veu el pas del SD)');
});
test('Una sola llum puntual càlida a la cripta (0xffb468), amb 7 punts on col·locar-la dins del volum', () => {
  expect(CRYPT.light.color === 0xffb468 && CRYPT.lights.length === 7, 'llum'); for (const l of CRYPT.lights) expect(l.x <= 3 && l.z <= -22 && l.y < 0, `${l.id}`);
});

// =====================================================================
console.log('\n9. Geometria generada i rendiment');
// =====================================================================
const scene = new THREE.Scene(); const village = buildVillage(scene); const crypt = village.crypt;
const baseScene = new THREE.Scene(); const base = buildVillage(baseScene, { cemetery: false });
test('Línia base intacta: amb cemetery:false el poble té exactament 41 092 triangles / 150 malles (base D.4) i cap cripta', () => { expect(base.stats.triangles === 41092 && base.stats.meshes === 150 && base.crypt === null && base.stats.crypt === null, `${base.stats.triangles}/${base.stats.meshes}`); });
test('La cripta és un grup propi FORA del poble (no compta a stats.triangles) amb dos subgrups: CryptBox (pou) i CryptInterior', () => {
  expect(crypt && crypt.group.name === 'Crypt' && crypt.box.name === 'CryptBox' && crypt.interior.name === 'CryptInterior', 'grups'); let p = crypt.group; while (p.parent) { expect(p.parent !== village.root, 'dins del poble'); p = p.parent; }
  expect(village.stats.crypt.triangles === crypt.stats.triangles && crypt.stats.boxTriangles + crypt.stats.interiorTriangles === crypt.stats.triangles, 'comptadors');
});
test('Pressupost: poble + caixa-pista < 60 000 triangles (límit de les fases anteriors) i la cripta suma ≤ 3 500; total < 62 000', () => {
  expect(village.stats.triangles < 60000, `${village.stats.triangles}`); expect(crypt.stats.triangles <= 3500, `${crypt.stats.triangles}`); expect(village.stats.triangles + crypt.stats.triangles < 62000, 'total');
  expect(village.stats.meshes - base.stats.meshes - village.stats.cemetery.meshes < 10, 'malles de la caixa-pista');
});
test('Una sola llum puntual a la cripta (intensitat inicial 0); sense ombres; cap material transparent nou (només el molsa/teranyines ja existents)', () => {
  const lights = []; crypt.group.traverse((o) => { if (o.isLight) lights.push(o); }); expect(lights.length === 1 && lights[0].isPointLight && lights[0].intensity === 0 && lights[0].name === 'CryptLight', `llums ${lights.length}`);
  const tr = new Set(); crypt.group.traverse((o) => { if (o.isMesh && o.material.transparent) tr.add(o.material.name || o.name); }); expect([...tr].every((n) => /web|moss/.test(n)), `transparents: ${[...tr]}`);
  crypt.group.traverse((o) => { if (o.isMesh) expect(!o.material.isMeshStandardMaterial && !o.material.isMeshPhysicalMaterial, 'material car'); });
});
test('Tota la geometria de la cripta és dins del volum reservat (x ≤ 3,0; z ≤ −20,4; la part soterrada z ≤ −21,0) i el pou no surt de x ±1,55', () => {
  const bb = new THREE.Box3().setFromObject(crypt.group); expect(bb.max.x <= 3.0 + 1e-6 && bb.min.x >= -10.8 - 1e-6 && bb.min.z >= -36.0 - 1e-6 && bb.max.z <= -20.4 + 1e-6, `bbox ${JSON.stringify([bb.min, bb.max])}`);
  const bi = new THREE.Box3().setFromObject(crypt.interior); expect(bi.max.y <= 3.3, 'interior alçada');
  crypt.interior.traverse((o) => { if (o.isMesh && o.geometry) { const b = new THREE.Box3().setFromObject(o); if (b.max.y < -0.01) expect(b.max.z <= -21.0 + 1e-6 && b.max.x <= 3.0 + 1e-6, `${o.name} soterrat fora: ${b.max.z}`); } });
  const bx = new THREE.Box3().setFromObject(crypt.box); expect(bx.min.x >= -1.56 && bx.max.x <= 1.56, 'pou');
});
test('Els tres discs, la tapa, el pany, la runa, el marcador i la llum són dinàmics; la resta té matrius congelades', () => {
  const dyn = []; crypt.group.traverse((o) => { if (o.userData.dynamic) dyn.push(o.name); }); for (const n of ['CR-DISC-0', 'CR-DISC-1', 'CR-DISC-2', 'CR-SARC-lid', 'CR-SARC-latch', 'CR-SARC-rune', 'CR-MARKER', 'CryptLight']) expect(dyn.includes(n), `${n} no és dinàmic`);
  let frozen = 0; crypt.group.traverse((o) => { if (!o.userData.dynamic && !o.matrixAutoUpdate) frozen++; }); expect(frozen > 20, 'matrius congelades');
});
test('Els discs, la tapa i el pany es mouen de debò amb els controls visuals (angles, segellat, desbloqueig, tapa, clau)', () => {
  const h = crypt.handles; const d0 = crypt.interior.getObjectByName('CR-DISC-0'); const lid = crypt.interior.getObjectByName('CR-SARC-lid'); const key = crypt.interior.getObjectByName('KEY-C');
  const z0 = d0.rotation.z; h.setDiscAngle(0, Math.PI / 2); expect(near(d0.rotation.z - z0, Math.PI / 2), 'disc'); h.setDiscAngle(0, 0); expect(near(d0.rotation.z, z0), 'disc torna');
  const lz = lid.position.z; h.setLid(1); expect(near(lz - lid.position.z, CRYPT.sarcophagus.lidSlide), 'tapa'); h.setLid(0); expect(near(lid.position.z, lz), 'tapa torna');
  expect(key && key.visible === false, 'la clau comença oculta'); h.setKeyVisible(true); expect(key.visible, 'clau visible'); h.setKeyVisible(false);
  const dz = d0.position.z; h.setSeal(1); expect(d0.position.z < dz, 'segellat'); h.setSeal(0); h.setSelectedDisc(1); expect(crypt.interior.getObjectByName('CR-MARKER').visible, 'marcador'); h.setSelectedDisc(-1);
});
test('Símbols pixel-art: atles d\'una fila (campana, lluna, creu, sol), cel·les sense solapament i amb píxels; la tapa de la caixa-pista porta els tres símbols', () => {
  let x = -1; for (const n of SYMBOL_ORDER) { const [cx, cy, cw, ch] = SYMBOL_CELLS[n]; expect(cx > x && cx + cw <= SYMBOL_ATLAS_SIZE[0] && ch <= SYMBOL_ATLAS_SIZE[1], `${n} cap a l'atles`); x = cx + cw; expect(SYMBOL_BITMAPS[n].join('').includes('#'), `${n} buit`); }
  expect(SYMBOL_ORDER.join() === 'bell,moon,cross,sun' && SYMBOL_ORDER.join() === CRYPT.puzzle.symbols.join(), 'ordre');
  const box = village.root.getObjectByName('ClueBox'); expect(box && box.children.length >= 3, 'ClueBox'); let sym = 0; box.traverse((o) => { if (o.isMesh && o.name.endsWith('-symbol')) sym++; }); expect(sym === 1, 'una malla de símbols'); 
  let tris = 0; box.traverse((o) => { if (o.isMesh && o.name.endsWith('-symbol')) tris = o.geometry.getAttribute('position').count / 3; }); expect(tris === 6, `${tris} triangles de símbols (3 quads)`);
});
test('dispose() allibera la cripta (geometries) i la treu de l\'escena', () => {
  const sc = new THREE.Scene(); const v = buildVillage(sc); const n0 = sc.children.length; expect(n0 === 2, `fills ${n0}`); v.dispose(); expect(sc.children.length === 0, 'escena buida');
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
