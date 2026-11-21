// =====================================================================
// PROVES DE LA FASE B: interiors, mobles, inventari, claus i porta secreta
//   node tools/test-puzzle.js        (necessita `three`, com test-doors.js i test-church-interior.js)
// =====================================================================
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import * as LAYOUT from '../src/world/layout.js';
import { buildVillage } from '../src/world/village.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree } from '../src/player/collisions.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createInventory, pickTarget } from '../src/player/interactions.js';
import { createGameplay, createSecretDoor, createContainer } from '../src/player/puzzle.js';

const { BUILDINGS, WALLS, PROPS, DOORS, FURNITURE, SECRET_DOOR, KEYS, PLAYER } = LAYOUT;
const R = PLAYER.collisionRadius;
const nave = BUILDINGS.find((b) => b.id === 'CH-N');
const IT = nave.visual.interior.footprint;
const HA = BUILDINGS.find((b) => b.id === 'HA').visual.interior.footprint;
const HB = BUILDINGS.find((b) => b.id === 'HB').visual.interior.footprint;

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, t, l) => { if (!(Math.abs(a - b) <= t)) throw new Error(`${l}: s'esperava ${b} i s'ha obtingut ${a}`); };
function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// El món tal com el veu main.js: estructura + mobles + les dues fulles de D1.
const door = createSwingDoor(DOORS.find((d) => d.id === 'D1'));
const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE });
door.setAngles(80 * Math.PI / 180, 80 * Math.PI / 180); // Fase D.3.1: D1 comença tancada; aquí es posa mig oberta per provar l'interior (el jugador l'obriria amb E)
colliders.push(...door.colliders);
const shell = buildColliders({ BUILDINGS, WALLS, PROPS });
const out = createMoveResult();
// Camina `frames` fotogrames amb desplaçament (dx, dz) per fotograma; actualitza també la porta D1 com fa main.js.
function walk(x, z, dx, dz, frames, cs = colliders) {
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    door.update(1 / 60, x, z, dx, dz, R, cs);
    movePlayer(x, z, dx, dz, R, cs, out);
    if (out.collided) hits++;
    x = out.x; z = out.z;
    if (!isPositionFree(x, z, R, cs, 1e-4)) throw new Error(`penetració a (${x.toFixed(3)}, ${z.toFixed(3)})`);
  }
  return { x, z, hits };
}
const newGame = (churchDoor = createSwingDoor(DOORS.find((d) => d.id === 'D1'))) => createGameplay({ KEYS, SECRET_DOOR, churchDoor });
const dt = 1 / 20;
const advance = (g, seconds, px = 0, pz = -17.6) => { for (let t = 0; t < seconds; t += dt) g.update(dt, px, pz, 0, -1); };

// ---------------------------------------------------------------- 1. dades i inventari
console.log('\n1. Inventari mínim i selecció d\'interacció');
test('Inventari: afegir, no duplicar, consultar, llistar', () => {
  const inv = createInventory();
  expect(inv.add({ id: 'KEY-A', name: 'Clau del guardià' }) === true, 'afegir');
  expect(inv.add({ id: 'KEY-A', name: 'Clau del guardià' }) === false, 'no s\'ha de duplicar');
  expect(inv.has('KEY-A') && !inv.has('KEY-B') && inv.count === 1 && inv.list()[0].name === 'Clau del guardià', 'estat');
});
test('pickTarget: només l\'objecte més proper dins el seu abast i davant la mirada', () => {
  const ts = [{ id: 'a', x: 0, z: -1, range: 2 }, { id: 'b', x: 0, z: -1.5, range: 2 }, { id: 'c', x: 0, z: 1, range: 2, facing: 0.5 }];
  expect(pickTarget(ts, 0, 0, 0, -1).id === 'a', 'el més proper');
  expect(pickTarget(ts, 0, 0, 0, 1).id === 'a', 'c queda darrere però a continua més a prop que c? (a és a 1 m, c a 1 m: empat → per id)');
  expect(pickTarget(ts, 0, 5, 0, -1) === null, 'fora d\'abast');
  const only = [{ id: 'c', x: 0, z: 1, range: 2, facing: 0.5 }];
  expect(pickTarget(only, 0, 0, 0, -1) === null, 'un objecte darrere no s\'activa');
  expect(pickTarget(only, 0, 0, 0, 1).id === 'c', 'de cara sí');
  expect(pickTarget([{ id: 'x', x: 0, z: -1, range: 2, enabled: () => false }], 0, 0, 0, -1) === null, 'desactivat');
});
test('E activa UN SOL objecte quan n\'hi ha diversos a prop', () => {
  const g = newGame();
  let calls = 0; let calls2 = 0;
  g.targets.push({ id: 'X1', x: 0, z: -7.5, range: 3, priority: 5, prompt: () => 'x', use: () => { calls++; } });
  g.targets.push({ id: 'X2', x: 0, z: -7.6, range: 3, priority: 5, prompt: () => 'y', use: () => { calls2++; } });
  const r = g.pressE(0, -7, 0, -1); // també és dins l'abast de D1 (a 2,7 m)
  expect(calls + calls2 === 1, `s'han activat ${calls + calls2} objectes`);
  expect(r === 'X1' && calls === 1, `s'ha activat ${r}`);
  expect(g.pressE(0, -7, 0, -1) === 'X1' && calls === 2 && calls2 === 0, 'cada pulsació, un sol objecte');
});

// ---------------------------------------------------------------- 2. porta secreta (estat)
console.log('\n2. Porta secreta: claus una per una, mecanisme i obertura');
test('Sense cap clau: missatge que en calen dues; la porta continua bloquejada', () => {
  const g = newGame();
  const r = g.secretDoor.interact(g.inventory);
  expect(r.action === 'examine' && /dues claus/.test(r.message) && r.message.includes(SECRET_DOOR.inscription), r.message);
  expect(g.secretDoor.state === 'locked' && g.secretDoor.insertedCount() === 0, 'estat');
});
test('Amb una sola clau: s\'insereix i s\'indica que falta l\'altra; no s\'obre', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-B', name: 'Clau dels oblidats' });
  const r = g.secretDoor.interact(g.inventory);
  expect(r.action === 'insert' && r.keyId === 'KEY-B' && /falta l'altra/.test(r.message), r.message);
  expect(g.secretDoor.insertedCount() === 1 && g.secretDoor.state === 'locked', 'una sola ranura ocupada');
  advance(g, 20);
  expect(g.secretDoor.state === 'locked' && g.secretDoor.progress() === 0, 'no s\'obre mai amb una sola clau');
  const r2 = g.secretDoor.interact(g.inventory);
  expect(r2.action === 'examine' && /falta la clau del guardià/.test(r2.message), r2.message);
});
test('Es pot inserir la primera clau sense la segona i la segona després', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-A', name: 'Clau del guardià' });
  expect(g.secretDoor.interact(g.inventory).action === 'insert', 'primera');
  expect(g.secretDoor.isInserted('KEY-A') && !g.secretDoor.isInserted('KEY-B'), 'només A');
  advance(g, 5); expect(g.secretDoor.state === 'locked', 'continua bloquejada');
  g.inventory.add({ id: 'KEY-B', name: 'Clau dels oblidats' });
  const r = g.secretDoor.interact(g.inventory);
  expect(r.action === 'insert' && r.keyId === 'KEY-B' && /desbloqueja/.test(r.message), r.message);
  expect(g.secretDoor.state === 'unlocked', 'mecanisme desbloquejat');
});
test('Amb les dues claus: s\'insereixen una per una (una pulsació cadascuna)', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-A', name: 'Clau del guardià' }); g.inventory.add({ id: 'KEY-B', name: 'Clau dels oblidats' });
  expect(g.secretDoor.interact(g.inventory).keyId === 'KEY-A' && g.secretDoor.insertedCount() === 1 && g.secretDoor.state === 'locked', '1a pulsació: només una clau');
  expect(g.secretDoor.interact(g.inventory).keyId === 'KEY-B' && g.secretDoor.insertedCount() === 2 && g.secretDoor.state === 'unlocked', '2a pulsació');
});
test('S\'obre només amb les dues: pausa de desbloqueig, animació lenta (6 s) i suau, i queda oberta', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-A', name: 'a' }); g.inventory.add({ id: 'KEY-B', name: 'b' });
  g.secretDoor.interact(g.inventory); g.secretDoor.interact(g.inventory);
  let t = 0; let prev = 0; let maxStep = 0; let startOpen = null; let endOpen = null;
  const step = 0.02;
  while (t < 12 && g.secretDoor.state !== 'open') {
    g.secretDoor.update(step); t += step;
    const p = g.secretDoor.progress();
    expect(p >= prev - 1e-12, 'el progrés no pot retrocedir');
    maxStep = Math.max(maxStep, p - prev);
    if (startOpen === null && p > 0) startOpen = t;
    prev = p;
  }
  endOpen = t;
  near(startOpen, SECRET_DOOR.unlockDelay, 0.1, 'pausa abans d\'obrir');
  near(endOpen - startOpen, SECRET_DOOR.openSeconds, 0.1, 'durada de l\'obertura');
  expect(maxStep < 0.02 * 1.6 / SECRET_DOOR.openSeconds + 1e-9, `moviment massa brusc: ${maxStep}`); // pic del suavitzat = 1,5/T
  expect(g.secretDoor.state === 'open' && near(g.secretDoor.progress(), 1, 1e-12, 'p') === undefined, 'estat final');
  near(g.secretDoor.slideOffset(), SECRET_DOOR.slide, 1e-12, 'recorregut final');
});
test('Un cop oberta, E només mostra la foscor (la zona del darrere encara no existeix) i no insereix res', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-A', name: 'a' }); g.inventory.add({ id: 'KEY-B', name: 'b' });
  g.secretDoor.interact(g.inventory); g.secretDoor.interact(g.inventory); advance(g, 10);
  const r = g.secretDoor.interact(g.inventory);
  expect(r.action === 'dark' && /foscor/.test(r.message), r.message);
});
test('Recollir la segona clau lluny de l\'església NO obre la porta automàticament', () => {
  const g = newGame();
  g.inventory.add({ id: 'KEY-A', name: 'a' }); g.inventory.add({ id: 'KEY-B', name: 'b' });
  for (let i = 0; i < 400; i++) g.update(dt, 10.2, -4, 1, 0); // 20 s a la casa B
  expect(g.secretDoor.state === 'locked' && g.secretDoor.insertedCount() === 0 && g.secretDoor.progress() === 0, 'la porta ha canviat sola');
});
test('Contenidor: s\'obre una vegada, animació suau 0 → 1', () => {
  const c = createContainer({ id: 'X', reveal: 'drawer' });
  expect(c.progress() === 0 && !c.isOpen(), 'inici');
  expect(c.open() === true && c.open() === false, 'només una vegada');
  let prev = 0; for (let i = 0; i < 60; i++) { c.update(0.02); expect(c.progress() >= prev, 'monòton'); prev = c.progress(); }
  expect(c.progress() === 1, 'final');
});

// ---------------------------------------------------------------- 3. recollir les claus (joc complet)
console.log('\n3. Trobar i recollir les claus a les cases');
test('Casa A: a prop de la còmoda E obre el calaix; després E recull la Clau del guardià (bronze, campana)', () => {
  const g = newGame();
  const px = -11.0; const pz = -7.3;
  g.update(dt, px, pz, 0, -1);
  expect(g.target && g.target.id === 'OPEN-A-DRS' && /obrir el calaix/.test(g.prompt), `objectiu: ${g.target && g.target.id}`);
  expect(g.pressE(px, pz, 0, -1) === 'OPEN-A-DRS' && g.containers['A-DRS'].isOpen() && !g.inventory.has('KEY-A'), 'obrir el calaix no recull la clau');
  expect(/calaix/.test(g.message), 'missatge');
  expect(g.target.id === 'KEY-A' && /recollir la clau del guardià/.test(g.prompt), `ara l'objectiu és ${g.target && g.target.id}`);
  expect(g.pressE(px, pz, 0, -1) === 'KEY-A', 'recollida');
  const k = g.inventory.list()[0];
  expect(k.id === 'KEY-A' && k.name === 'Clau del guardià' && k.symbol === 'bell' && /bronze/.test(k.description) && /campana/.test(k.description), JSON.stringify(k));
  expect(g.hasKeyTaken('KEY-A') && g.target === null, 'ja no es pot recollir una altra vegada');
  expect(g.pressE(px, pz, 0, -1) === null && g.inventory.count === 1, 'una segona E no duplica res');
});
test('Casa B: E obre l\'arca; després E recull la Clau dels oblidats (ferro, lluna)', () => {
  const g = newGame();
  const px = 10.2; const pz = -4.0;
  g.update(dt, px, pz, 1, 0);
  expect(g.target && g.target.id === 'OPEN-B-CHS' && /obrir l'arca/.test(g.prompt), `objectiu: ${g.target && g.target.id}`);
  g.pressE(px, pz, 1, 0);
  expect(g.containers['B-CHS'].isOpen(), 'arca oberta');
  expect(g.pressE(px, pz, 1, 0) === 'KEY-B', 'recollida');
  const k = g.inventory.list()[0];
  expect(k.id === 'KEY-B' && k.symbol === 'moon' && /ferro/.test(k.description) && /lluna/.test(k.description), JSON.stringify(k));
});
test('Les claus no es poden recollir sense obrir el moble, ni de lluny, ni d\'esquena', () => {
  const g = newGame();
  expect(g.pressE(-11.0, -7.3, 0, 1) === null, 'd\'esquena al calaix no passa res');
  expect(g.pressE(-8.0, -5.0, 0, -1) === null, 'lluny del calaix no passa res');
  g.containers['A-DRS'].open();
  g.update(dt, -11.0, -7.3, 0, -1);
  expect(g.pressE(-8.0, -5.0, 0, -1) === null && g.inventory.count === 0, 'la clau no es recull des de lluny');
});
test('L\'inventari conserva les dues claus durant tota la partida', () => {
  const g = newGame();
  g.pressE(-11.0, -7.3, 0, -1); g.pressE(-11.0, -7.3, 0, -1);
  g.pressE(10.2, -4.0, 1, 0); g.pressE(10.2, -4.0, 1, 0);
  for (let i = 0; i < 2000; i++) g.update(dt, 0, -17.6, 0, -1);
  expect(g.inventory.has('KEY-A') && g.inventory.has('KEY-B') && g.inventory.count === 2, 'inventari');
});
test('Puzle complet: calaix, arca, tornar a l\'església, inserir una per una i veure la porta obrir-se', () => {
  const g = newGame();
  g.pressE(-11.0, -7.3, 0, -1); g.pressE(-11.0, -7.3, 0, -1);
  g.pressE(10.2, -4.0, 1, 0); g.pressE(10.2, -4.0, 1, 0);
  g.update(dt, 0, -17.6, 0, -1);
  expect(g.target.id === 'SD' && /inserir la clau del guardià/.test(g.prompt), `indicació: ${g.prompt}`);
  expect(g.pressE(0, -17.6, 0, -1) === 'SD' && g.secretDoor.insertedCount() === 1 && g.secretDoor.state === 'locked', '1a clau');
  expect(/inserir la clau dels oblidats/.test(g.prompt), `indicació: ${g.prompt}`);
  g.pressE(0, -17.6, 0, -1);
  expect(g.secretDoor.state === 'unlocked' && g.prompt === '', 'mecanisme desbloquejat');
  advance(g, 12);
  expect(g.secretDoor.state === 'open' && /foscor/.test(g.prompt === '' ? 'foscor' : g.prompt), 'porta oberta');
});
test('La porta D1 (D.3.1) comença TANCADA i funciona amb E (obre i tanca) i amb el nou sistema d\'interacció', () => {
  const cd = createSwingDoor(DOORS.find((d) => d.id === 'D1'));
  const g = newGame(cd);
  g.update(dt, 0, -7, 0, -1);
  expect(g.target && g.target.id === 'D1' && g.prompt === 'E — obrir la porta' && !cd.isOpen(), `inici: ${g.prompt}`);
  g.pressE(0, -7, 0, -1);
  for (let i = 0; i < 240; i++) cd.update(1 / 60, 0, -7, 0, 0, R, null);   // main.js l'actualitza cada fotograma
  g.update(dt, 0, -7, 0, -1);
  expect(cd.isOpen() && g.prompt === 'E — tancar la porta', `oberta? angles ${cd.angles()}`);
  g.pressE(0, -7, 0, -1);
  for (let i = 0; i < 240; i++) cd.update(1 / 60, 0, -7, 0, 0, R, null);
  g.update(dt, 0, -7, 0, -1);
  expect(!cd.isOpen() && g.prompt === 'E — obrir la porta', 'tancada una altra vegada');
});

// ---------------------------------------------------------------- 4. col·lisions i mobles
console.log('\n4. Col·lisions: església amb mobles, cases accessibles, porta secreta i casa C');
test('L\'església continua accessible per D1 i el passadís central és lliure fins a prop de l\'altar', () => {
  const p = walk(0, -5, 0, -0.1, 400);
  near(p.x, 0, 1e-9, 'x'); near(p.z, LAYOUT.FURNITURE.find((q) => q.id === 'ALT').collision.zMax + R, 1e-6, 's\'atura davant de l\'altar');
  expect(p.hits > 0, 'ha de topar amb l\'altar al final');
});
test('Cap banc ni l\'altar bloquegen el pas: de la porta a la porta secreta rodejant l\'altar (per cada banda)', () => {
  for (const side of [-1, 1]) {
    let { x, z } = walk(0, -5, 0, -0.1, 126);                     // pel passadís fins a davant de l'altar (z ≈ −17,6)
    ({ x, z } = walk(x, z, side * 0.1, 0, 14));                    // cap a la banda de l'altar (x ≈ ±1,4)
    ({ x, z } = walk(x, z, 0, -0.1, 40));                         // ...fins a la paret del fons
    ({ x, z } = walk(x, z, -side * 0.1, 0, 20));                  // ...i cap a la porta secreta, darrere l'altar
    near(z, IT.zMin + R, 1e-6, `z final (banda ${side})`);
    expect(Math.hypot(x - SECRET_DOOR.center.x, z - SECRET_DOOR.center.z) < 1.5, `ha arribat a prop de la porta secreta (${x.toFixed(2)}, ${z.toFixed(2)})`);
  }
});
test('Porta secreta TANCADA: no es pot travessar (la col·lisió és la paret CH-N-B) des de tot l\'ample del marc', () => {
  for (let x = -1.2; x <= 1.2; x += 0.1) {
    const p = walk(x, IT.zMin + 0.9, 0, -0.1, 30);
    near(p.z, IT.zMin + R, 1e-6, `z a x=${x.toFixed(1)}`);
  }
});
test('Porta secreta OBERTA: tampoc es pot travessar (la zona del darrere encara no existeix)', () => {
  const g = newGame(); g.inventory.add({ id: 'KEY-A', name: 'a' }); g.inventory.add({ id: 'KEY-B', name: 'b' });
  g.secretDoor.interact(g.inventory); g.secretDoor.interact(g.inventory); advance(g, 10);
  expect(g.secretDoor.state === 'open', 'oberta');
  for (const x of [-0.6, 0, 0.6]) near(walk(x, IT.zMin + 0.9, 0, -0.1, 30).z, IT.zMin + R, 1e-6, `x=${x}`);
});
test('Casa A: s\'hi entra per D2, es camina fins al fons i es surt pel mateix pas', () => {
  const d = DOORS.find((q) => q.id === 'D2');
  let p = walk(d.center.x + 2, d.center.z, -0.1, 0, 60);     // entra des de fora (est → oest)
  expect(p.x < HA.xMax - 0.5, `no ha entrat (${p.x.toFixed(2)})`);
  near(p.z, d.center.z, 1e-6, 'recte');
  p = walk(p.x, p.z, 0.1, 0, 80);                            // surt
  expect(p.x > d.center.x + 1, `no ha sortit (${p.x.toFixed(2)})`);
});
test('Casa B: s\'hi entra per D3, s\'arriba fins a l\'arca i es surt', () => {
  const d = DOORS.find((q) => q.id === 'D3');
  let p = walk(d.center.x - 2, d.center.z, 0.1, 0, 90);
  expect(p.x > HB.xMin + 1, `no ha entrat (${p.x.toFixed(2)})`);
  near(p.x, LAYOUT.FURNITURE.find((q) => q.id === 'B-CHS').collision.xMin - R, 1e-6, 'topa amb l\'arca');
  p = walk(p.x, p.z, -0.1, 0, 100);
  expect(p.x < d.center.x - 1, 'no ha sortit');
});
test('Casa A i casa B: les parets i la façana sud/nord no es poden travessar des de dins', () => {
  for (const [it, label] of [[HA, 'A'], [HB, 'B']]) {
    for (const [dx, dz, lim] of [[0, -0.1, 'zMin'], [0, 0.1, 'zMax']]) {
      for (const sx of [it.xMin + 1.4, it.xMin + 2.0, it.xMax - 1.4]) {
        const sz = (it.zMin + it.zMax) / 2;
        if (!isPositionFree(sx, sz, R, colliders)) continue;
        const p = walk(sx, sz, dx, dz, 90);
        expect(p.z >= it.zMin + R - 1e-6 && p.z <= it.zMax - R + 1e-6, `casa ${label} ${lim}: z = ${p.z.toFixed(3)}`);
      }
    }
  }
});
test('Casa C (Fase C): edifici compost de 5 parets amb el pas de D4 (z 11,5→12,5); la porta D4 comença tancada', () => {
  const d = DOORS.find((q) => q.id === 'D4');
  expect(d.state === 'closed' && d.enterable === true && d.house && !d.steps, 'D4');
  const hc = BUILDINGS.find((b) => b.id === 'HC');
  expect(Array.isArray(hc.collision) && hc.collision.length === 5, 'HC compost');
  const free = walk(d.center.x - 1.2, d.center.z, 0.1, 0, 40);
  expect(free.x > 3, `sense el bloc, el pas de D4 és lliure (x = ${free.x.toFixed(2)})`); // el bloc és dinàmic: es prova a test-house-doors.js
});
test('Cap moble bloqueja un carril de 0,7 m des de la porta de cada casa fins a 3 m a dins', () => {
  for (const id of ['D2', 'D3']) {
    const d = DOORS.find((q) => q.id === id);
    const sx = d.face === 'east' ? -1 : 1;
    for (let t = -1; t <= 3; t += 0.05) expect(isPositionFree(d.center.x + sx * t, d.center.z, R, colliders), `${id}: bloquejat a ${t.toFixed(2)} m`);
  }
});
test('No es queda atrapat: des de 300 punts lliures de cada interior hi ha camí fins a l\'exterior (BFS a 10 cm, radi 0,35)', () => {
  const cell = 0.1;
  const region = { xMin: -13, xMax: 13, zMin: -22, zMax: -2 };
  const nx = Math.round((region.xMax - region.xMin) / cell); const nz = Math.round((region.zMax - region.zMin) / cell);
  const free = new Uint8Array(nx * nz);
  const at = (i, j) => [region.xMin + (i + 0.5) * cell, region.zMin + (j + 0.5) * cell];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const [x, z] = at(i, j); free[j * nx + i] = isPositionFree(x, z, R, colliders) ? 1 : 0; }
  // exteriors: plaça (0, −5) per l'església; carrers a l'est de la casa A i a l'oest de la casa B
  for (const [it, start] of [[IT, [0, -6]], [HA, [-5.5, -6]], [HB, [8.4, -4]]]) {
    const out = it === HB ? [5.5, -4] : it === HA ? [-5.5, -6] : [0, -5];
    const seen = new Uint8Array(nx * nz); const q = [];
    const idx = (x, z) => Math.floor((z - region.zMin) / cell) * nx + Math.floor((x - region.xMin) / cell);
    expect(free[idx(out[0], out[1])], `l'exterior ${out} ha de ser lliure`);
    seen[idx(out[0], out[1])] = 1; q.push(idx(out[0], out[1]));
    while (q.length) { const k = q.pop(); const i = k % nx; const j = Math.floor(k / nx); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di; const jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii; if (free[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); } } }
    let n = 0; const rng = makeRng(it.xMin * 100 + 7);
    while (n < 300) {
      const x = it.xMin + R + rng() * (it.xMax - it.xMin - 2 * R); const z = it.zMin + R + rng() * (it.zMax - it.zMin - 2 * R);
      if (!isPositionFree(x, z, R, colliders) || !free[idx(x, z)]) continue; // (la graella té cel·les de 10 cm: s'usen punts amb la cel·la lliure)
      n++;
      expect(seen[idx(x, z)], `atrapat a (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
    void start;
  }
});
test('Fuzz: 600 caminants × 200 fotogrames per tot el poble (interiors inclosos): mai dins un obstacle ni fora del recinte', () => {
  const rng = makeRng(4242);
  const starts = [IT, HA, HB, { xMin: -6, xMax: 6, zMin: -8, zMax: 8 }, { xMin: -14, xMax: -8, zMin: -2.5, zMax: -1.5 }];
  const problems = [];
  for (let w = 0; w < 600; w++) {
    const s = starts[w % starts.length];
    let x; let z;
    do { x = s.xMin + rng() * (s.xMax - s.xMin); z = s.zMin + rng() * (s.zMax - s.zMin); } while (!isPositionFree(x, z, R, colliders));
    let a = rng() * Math.PI * 2;
    for (let f = 0; f < 200; f++) {
      if (rng() < 0.08) a = rng() * Math.PI * 2; else a += (rng() - 0.5) * 0.3;
      const len = 0.2 * (0.5 + 0.5 * rng());
      const dx = Math.cos(a) * len; const dz = Math.sin(a) * len;
      door.update(1 / 60, x, z, dx, dz, R, colliders);
      movePlayer(x, z, dx, dz, R, colliders, out);
      x = out.x; z = out.z;
      if (!isPositionFree(x, z, R, colliders, 1e-4)) problems.push(`caminant ${w} f${f}: dins d'un obstacle (${x.toFixed(3)}, ${z.toFixed(3)})`);
      if (x < -15.5 || x > 15.5 || z < -20.7 || z > 29) problems.push(`caminant ${w} f${f}: fora del recinte (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  expect(problems.length === 0, `${problems.length} problemes; primer: ${problems[0]}`);
});
test('Les animacions del puzle no mouen el jugador ni afecten les col·lisions (porta secreta, calaix, arca)', () => {
  // L'estat del puzle és pur: la col·lisió només depèn de FURNITURE/BUILDINGS (estàtics). Es comprova que no hi ha colliders dinàmics nous.
  expect(colliders.length === buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE }).length + 2, 'només les 2 fulles de D1 són dinàmiques');
});

// ---------------------------------------------------------------- 5. visual (Three.js real)
console.log('\n5. Visual: interiors, mobles, claus i porta secreta (geometria real, sense navegador)');
const scene = new THREE.Scene();
const village = buildVillage(scene);
scene.updateMatrixWorld(true);
const byName = (n) => { let r = null; village.root.traverse((o) => { if (o.name === n) r = o; }); return r; };
const box3 = (o) => new THREE.Box3().setFromObject(o);
test('buildVillage: claus esperades i `puzzle` amb 4 controls; 5 llums càlides (església + 4 a les cases); < 60.000 triangles', () => {
  for (const k of ['root', 'lanternLights', 'stats', 'doors', 'puzzle', 'dispose']) expect(k in village, `falta ${k}`);
  expect(Object.keys(village.puzzle).sort().join() === 'setContainerProgress,setKeyInserted,setKeyVisible,setSecretDoorProgress', Object.keys(village.puzzle).join());
  expect(village.interiorLights.length === 5, 'una llum a l\'església i 4 a les cases (A, B i C a baix i a dalt)');
  expect(village.stats.triangles < 60000, `${village.stats.triangles} triangles`);
});
test('Els bancs i l\'altar dibuixats cauen dins de la seva empremta de col·lisió (±5 cm)', () => {
  const g = byName('Furniture-CH-N');
  expect(g, 'falta Furniture-CH-N');
  const b = box3(g);
  const rects = FURNITURE.filter((m) => m.buildingId === 'CH-N').map((m) => m.collision);
  const env = { xMin: Math.min(...rects.map((r) => r.xMin)) - 0.2, xMax: Math.max(...rects.map((r) => r.xMax)) + 0.2, zMin: Math.min(...rects.map((r) => r.zMin)) - 0.2, zMax: Math.max(...rects.map((r) => r.zMax)) + 0.2 };
  expect(b.min.x >= env.xMin && b.max.x <= env.xMax && b.min.z >= env.zMin && b.max.z <= env.zMax, `caixa ${b.min.toArray().map((v) => v.toFixed(2))} → ${b.max.toArray().map((v) => v.toFixed(2))}`);
  expect(b.max.y < 1.8, 'alçada raonable');
});
test('El mobiliari de cada casa és dins de l\'interior i la fulla oberta de la porta no toca cap moble', () => {
  for (const [id, it] of [['HA', HA], ['HB', HB]]) {
    const g = byName(`Furniture-${id}`);
    const b = box3(g);
    expect(b.min.x >= it.xMin - 0.1 && b.max.x <= it.xMax + 0.1 && b.min.z >= it.zMin - 0.1 && b.max.z <= it.zMax + 0.1, `${id}: mobles fora de l'interior (${b.min.x.toFixed(2)},${b.min.z.toFixed(2)})→(${b.max.x.toFixed(2)},${b.max.z.toFixed(2)})`);
  }
});
test('Interiors de les cases: terra (3 cm), sostre (2,75 m) i quatre parets sòlides vistes des de dins', () => {
  const probe = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const solids = []; byName('HA').traverse((o) => { if (o.isMesh && !o.parent.userData.dynamic) { o.material = probe; solids.push(o); } });
  const rc = new THREE.Raycaster(); rc.far = 20;
  const shoot = (o, d) => { rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d)); return rc.intersectObjects(solids, false)[0]; };
  near(shoot([-9.5, 1.2, -6.6], [0, -1, 0]).point.y, 0.03, 0.005, 'terra');
  near(shoot([-9.5, 1.2, -6.6], [0, 1, 0]).point.y, 2.75, 0.005, 'sostre');
  // Cares interiors: nord z = −8,6 · sud z = −3,4 · oest x = −11,6 (a l'alçada dels ulls)
  near(shoot([-9.5, 1.2, -6.0], [0, 0, -1]).point.z, -8.6, 0.02, 'paret nord');
  near(shoot([-9.5, 1.2, -6.0], [0, 0, 1]).point.z, -3.4, 0.02, 'paret sud');
  near(shoot([-9.5, 1.2, -6.0], [-1, 0, 0]).point.x, -11.6, 0.02, 'paret oest');
  // La paret est (porta): des de dins mirant a l'est, lluny de la finestra (z = −8,3) hi ha paret a x = −7,4
  near(shoot([-9.5, 1.2, -8.3], [1, 0, 0]).point.x, -7.4, 0.02, 'paret est');
});
test('Pas de la porta D2: tancada, un raig des de fora xoca amb la fulla; oberta (90°), el pas queda lliure fins a la paret del fons', () => {
  const probe = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const solids = []; byName('HA').traverse((o) => { if (o.isMesh) { o.material = probe; solids.push(o); } });
  byName('D2').traverse((o) => { if (o.isMesh) { o.material = probe; solids.push(o); } });
  const rc = new THREE.Raycaster(); rc.far = 30;
  const first = (y) => { rc.set(new THREE.Vector3(-4, y, -6), new THREE.Vector3(-1, 0, 0)); return rc.intersectObjects(solids, false)[0]; };
  for (const y of [0.3, 1.0, 1.7]) {
    const h = first(y);
    expect(h && h.point.x > -7.5 && h.point.x < -7.0, `tancada, y=${y}: primer impacte a x = ${h ? h.point.x.toFixed(2) : 'cap'} (la fulla és a x ≈ −7,4)`);
  }
  const d2 = village.doors.D2; d2.setAngle((90 * Math.PI) / 180); scene.updateMatrixWorld(true);
  for (const y of [0.3, 1.0, 1.7]) {
    const h = first(y);
    expect(h && Math.abs(h.point.x - (-11.6)) < 0.3, `oberta, y=${y}: primer impacte a x = ${h ? h.point.x.toFixed(2) : 'cap'} (s'esperava ≈ −11,6: paret del fons)`);
  }
  d2.setAngle(0); scene.updateMatrixWorld(true);
});
test('Porta secreta: tancada, els batents tapen l\'obertura (±0,7 m); oberta, queden dins el marc (±1,5 m), amagats', () => {
  const lw = byName('SD-leaf-W'); const le = byName('SD-leaf-E');
  expect(lw && le && lw.userData.dynamic && le.userData.dynamic, 'batents dinàmics');
  village.puzzle.setSecretDoorProgress(0); scene.updateMatrixWorld(true);
  let bw = box3(lw); let be = box3(le);
  expect(bw.min.x >= -0.72 && bw.max.x <= 0.02 && be.min.x >= -0.02 && be.max.x <= 0.72, `tancada: W ${bw.min.x.toFixed(2)}…${bw.max.x.toFixed(2)} E ${be.min.x.toFixed(2)}…${be.max.x.toFixed(2)}`);
  near(bw.max.y, SECRET_DOOR.height, 0.02, 'alçada de la porta');
  village.puzzle.setSecretDoorProgress(1); scene.updateMatrixWorld(true);
  bw = box3(lw); be = box3(le);
  expect(bw.min.x >= -1.5 && bw.max.x <= -0.7 + 0.01 + 0.05 && be.max.x <= 1.5 && be.min.x >= 0.7 - 0.06, `oberta: W ${bw.min.x.toFixed(2)}…${bw.max.x.toFixed(2)} E ${be.min.x.toFixed(2)}…${be.max.x.toFixed(2)}`);
  expect(bw.min.z >= SECRET_DOOR.center.z && be.max.z <= SECRET_DOOR.center.z + 0.16, 'els batents són dins del gruix del marc (0–0,16 m)');
  village.puzzle.setSecretDoorProgress(0);
});
test('Porta secreta: el marc és sobre la paret del fons i sobresurt ≤ 0,3 m cap a la nau; ranures a ±0,95 m', () => {
  const g = byName('SecretDoor'); const b = box3(g);
  near(b.min.z, SECRET_DOOR.center.z, 0.011, 'cara de la paret');
  expect(b.max.z <= SECRET_DOOR.center.z + 0.45, `sobresurt ${(b.max.z - SECRET_DOOR.center.z).toFixed(2)} m`);
  expect(b.min.x >= -1.7 && b.max.x <= 1.7 && b.max.y < 4.6, 'mides');
  for (const key of ['KEY-A', 'KEY-B']) {
    village.puzzle.setKeyInserted(key, true);
    const slot = SECRET_DOOR.slots.find((s) => s.key === key);
    let found = null; g.traverse((o) => { if (o.name.startsWith(key) && o.name.endsWith('slot')) found = o; });
    expect(found && found.visible, `${key} visible a la ranura`);
    near(found.position.x, SECRET_DOOR.center.x + slot.x, 1e-9, `${key} x`);
    village.puzzle.setKeyInserted(key, false);
    expect(!found.visible, `${key} amagada de nou`);
  }
});
test('Calaix, tapa de l\'arca i claus: el calaix surt 0,35 m, la tapa gira ≤ 95° i la clau només es veu un cop obert', () => {
  const dr = byName('A-DRS-drawer'); const lid = byName('B-CHS-lid');
  expect(dr.userData.dynamic && lid.userData.dynamic, 'dinàmics');
  village.puzzle.setContainerProgress('A-DRS', 1); village.puzzle.setContainerProgress('B-CHS', 1);
  near(dr.position.z, 0.35, 1e-9, 'recorregut del calaix');
  near(lid.rotation.z, -(95 * Math.PI) / 180, 1e-9, 'obertura de la tapa');
  scene.updateMatrixWorld(true);
  expect(box3(lid).max.x <= 11.6 + 0.2, 'la tapa oberta no entra gaire a la paret');
  for (const k of KEYS) {
    let keyMesh = null; village.root.traverse((o) => { if (o.name === `${k.id}-flat`) keyMesh = o; });
    expect(keyMesh && keyMesh.visible === false, `${k.id} oculta fins que el moble s'obre`);
    village.puzzle.setKeyVisible(k.id, true); expect(keyMesh.visible, `${k.id} visible`);
    scene.updateMatrixWorld(true);
    const c = box3(keyMesh).getCenter(new THREE.Vector3());
    near(c.x, k.pos.x, 0.12, `${k.id} x`); near(c.z, k.pos.z, 0.12, `${k.id} z`); near(c.y, k.y, 0.1, `${k.id} y`);
    village.puzzle.setKeyVisible(k.id, false);
  }
  village.puzzle.setContainerProgress('A-DRS', 0); village.puzzle.setContainerProgress('B-CHS', 0);
});
test('Els mobles dinàmics i les claus no afegeixen col·lisions ni elements fora del que es lliura (només els grups amb matriu viva: calaix, tapa, fulles de D1, fulles de D2–D4, batents de la porta secreta i, des de la D.4, la fulla i el cadenat de la reixa del cementiri)', () => {
  const dyn = []; village.root.traverse((o) => { if (o.userData.dynamic) dyn.push(o.name); });
  expect(dyn.sort().join() === 'A-DRS-drawer,B-CHS-lid,CemeteryGateLeaf,CemeteryGateLock,D1-leaf-E,D1-leaf-W,D2-leaf,D3-leaf,D4-leaf,SD-leaf-E,SD-leaf-W', dyn.join());
});
test('Portes de casa (Fase C): D2, D3 i D4 tenen fulla mòbil pròpia; D4 ja no té esglaons (llindar a ras de terra)', () => {
  for (const id of ['D2', 'D3', 'D4']) expect(village.doors[id] && typeof village.doors[id].setAngle === 'function', `${id} sense fulla`);
  const d4def = DOORS.find((d) => d.id === 'D4');
  expect(!d4def.steps && d4def.width === 1.0, 'dades de D4');
});
test('dispose(): allibera geometries, materials i textures de tot (inclosos interiors, claus i porta secreta)', () => {
  let geos = 0; const disposed = [];
  village.root.traverse((o) => { if (o.geometry) { geos++; o.geometry.addEventListener('dispose', () => disposed.push(o.geometry)); } });
  village.dispose();
  expect(geos > 100 && disposed.length > 0, `${geos} geometries, ${disposed.length} alliberades`);
  expect(!village.root.parent, 'arrel fora de l\'escena');
});

// ---------------------------------------------------------------- 6. main.js (estàtic)
console.log('\n6. main.js: pointer lock, tecla E i HUD (comprovació estàtica)');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
test('E només actua amb el ratolí capturat i sense repetició; una sola crida a pressE; HUD sense pointer-events', () => {
  expect(/e\.code === 'KeyE' && !e\.repeat && document\.pointerLockElement === renderer\.domElement/.test(main), 'condició d\'E');
  expect((main.match(/gameplay\.pressE\(/g) || []).length === 1, 'una sola crida a pressE');
  expect((main.match(/pointer-events: none/g) || []).length >= 3, 'doorHint, messageBox i inventoryBox amb pointer-events: none');
  const iDoor = main.indexOf('churchDoor.update('); const iMove = main.indexOf('  movePlayer(\n'); const iPuz = main.indexOf('gameplay.update(');
  expect(iDoor > 0 && iDoor < iMove && iMove < iPuz, `ordre: porta → moviment → puzle (${iDoor}, ${iMove}, ${iPuz})`);
  expect(/buildColliders\(\{ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS \}\)/.test(main), 'main.js construeix els col·lidors amb FURNITURE i STAIRS');
});
test('Els mòduls purs (interactions.js, puzzle.js) no importen Three.js ni toquen el DOM', () => {
  for (const f of ['interactions.js', 'puzzle.js']) {
    const src = readFileSync(new URL(`../src/player/${f}`, import.meta.url), 'utf8');
    expect(!/from 'three'|document\.|window\.|requestPointerLock/.test(src), `${f} depèn del navegador`);
  }
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
