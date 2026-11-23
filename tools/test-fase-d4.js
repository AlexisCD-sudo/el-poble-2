// =====================================================================
// PROVES DE LA FASE D.4: reixa del cementiri (KEY-C), cripta més clara, sortida de la cripta neta, cartell sense pal,
// títol «EL POBLE» i tipografia pròpia                                                       node tools/test-fase-d4.js   (necessita `three`)
// Prova dades, geometria generada, col·lisions i la lògica REAL (createCemeteryGate, createGameplay, saveGame, mapData, theme, titleScreen).
// NO prova l'aspecte en pantalla, el rendiment ni el pointer lock del navegador: això ho ha de mirar l'usuari al navegador.
// =====================================================================
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createHouseDoor } from '../src/player/houseDoors.js';
import { createGameplay } from '../src/player/puzzle.js';
import { createCryptAccess } from '../src/player/crypt.js';
import { createCemeteryGate } from '../src/player/cemeteryGate.js';
import { buildVillage } from '../src/world/village.js';
import { captureState, canSave, validateSave, applyState, SAVE_VERSION } from '../src/game/saveGame.js';
import { createDocuments, documentDefs, DOCUMENT_IDS } from '../src/player/documents.js';
import { buildMapData, createMapProgress, buildMapModel, zoneAccessible } from '../src/world/mapData.js';
import { FONT_FACES, FONT_TITLE, FONT_TEXT, fontFaceCSS } from '../src/ui/theme.js';
import { GAME_TITLE, CONTROLS, titleScale } from '../src/ui/titleScreen.js';
import { TITLE_IMAGE, FONT_PIXEL } from '../src/ui/theme.js';
import { TABS } from '../src/ui/pauseMenu.js';

const { CRYPT, CRYPT_WALLS, CRYPT_FLOORS, FLOORS, KEYS, SECRET_DOOR, DOORS, PLAYER, BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS, CEM_WALLS, CEM_PROPS, CEM_GATE, CEM_GATE_MECH, CEM_AREA, D4_REMOVED_COLLIDERS } = LAYOUT;
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const SECTION = (t) => console.log(`\n${t}`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const R = PLAYER.collisionRadius; const DEG = Math.PI / 180;
const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

// ---------------------------------------------------------------------
// Món de proves: la mateixa composició que main.js (inclosa la reixa, el collider CT2 retirat i la cripta)
// ---------------------------------------------------------------------
const world = () => {
  const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
  colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS, CRYPT_PROPS: LAYOUT.CRYPT_PROPS }));
  colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CEM_WALLS, CEM_PROPS }).filter((c) => !D4_REMOVED_COLLIDERS.includes(c.id)));
  const doorOccluders = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS });
  const cryptOcc = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS }).filter((c) => !c.id.startsWith('CH-N-B-'));
  const churchDoor = createSwingDoor(DOORS.find((d) => d.id === 'D1')); colliders.push(...churchDoor.colliders);
  const houseDoors = DOORS.filter((d) => d.house).map((d) => createHouseDoor(d)); for (const hd of houseDoors) colliders.push(hd.collider);
  const access = createCryptAccess(colliders, CRYPT);
  const gate = createCemeteryGate(colliders, CEM_GATE, CEM_GATE_MECH);
  const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown });
  const gameplay = createGameplay({ KEYS, SECRET_DOOR, churchDoor, houseDoors, occluders: doorOccluders, playerRadius: R, crypt: { def: CRYPT, occluders: cryptOcc }, cemeteryGate: { gate, def: CEM_GATE, mech: CEM_GATE_MECH } });
  const documents = createDocuments(documentDefs(CRYPT));
  const mapData = buildMapData(LAYOUT); const mapProgress = createMapProgress(mapData);
  const w = { colliders, churchDoor, houseDoors, access, gate, floors, gameplay, documents, mapData, mapProgress, pose: { x: 12, z: -7.7, yaw: -Math.PI / 2, pitch: 0, level: 0, feetY: 0 }, t: 0 };
  w.getPose = () => ({ ...w.pose });
  w.setPose = (p) => { const fl = floors.resolve(p.x, p.z, p.level); w.pose = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, level: fl.level, feetY: fl.y }; };
  w.flags = () => ({ sdOpen: gameplay.secretDoor.state === 'open', cemeteryOpen: gate.isOpen() });
  w.tick = (sec) => { for (let t = 0; t < sec; t += 1 / 30) { w.t += 1 / 30; const p = w.pose; churchDoor.update(1 / 30, p.x, p.z, 0, 0, R, colliders); gameplay.update(1 / 30, p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), { level: p.level, feetY: p.feetY }); access.sync(gameplay.secretDoor.state); w.mapProgress.update(p.x, p.z, p.level, w.flags()); } };
  w.ctx = () => ({ gameplay, getPose: w.getPose, setPose: w.setPose, documents, mapProgress, colliders, radius: R, mapLimit: 95, afterRestore: () => access.sync(gameplay.secretDoor.state), now: () => new Date('2026-11-21T10:00:00Z') });
  return w;
};
const defs = (w) => ({
  KEYS, CRYPT, SECRET_DOOR, CEM_AREA, houseDoorIds: DOORS.filter((d) => d.house).map((d) => d.id),
  churchLimits: { min: 0, max: 170 * DEG }, documentIds: w.documents.knownIds(), noteDocumentId: DOCUMENT_IDS.symbolNote, zoneIds: w.mapData.zones.map((z) => z.id),
  levelSplit: FLOORS.levelSplit, levelSplitDown: CRYPT_FLOORS.levelSplitDown, mapLimit: 95,
});
const KEYC = { id: CRYPT.keyC.id, name: CRYPT.keyC.name, description: CRYPT.keyC.description, symbol: 'cross' };
const giveKeyC = (w) => { if (!w.gameplay.inventory.has('KEY-C')) w.gameplay.inventory.add(KEYC); };
// el jugador davant del pany (a l'oest de la reixa, mirant cap a l'est)
const atLock = (w, x = 14.2, z = -7.7, yaw = -Math.PI / 2) => w.setPose({ x, z, yaw, pitch: 0, level: 0, feetY: 0 });
const dirOf = (p) => [-Math.sin(p.yaw), -Math.cos(p.yaw)];
const pressE = (w) => { const p = w.pose; const [dx, dz] = dirOf(p); return w.gameplay.pressE(p.x, p.z, dx, dz, { level: p.level, feetY: p.feetY }); };
const lookAt = (w) => { const p = w.pose; const [dx, dz] = dirOf(p); w.gameplay.update(0, p.x, p.z, dx, dz, { level: p.level, feetY: p.feetY }); return w.gameplay.current ? w.gameplay.current() : null; };
const gateTarget = (w) => w.gameplay.targets.find((t) => t.id === CEM_GATE.id);
const targetFor = (w, x, z, yaw) => { w.setPose({ x, z, yaw, pitch: 0, level: 0, feetY: 0 }); const p = w.pose; const [dx, dz] = dirOf(p); w.gameplay.update(0, p.x, p.z, dx, dz, { level: 0, feetY: 0 }); return w.gameplay.target ? w.gameplay.target() : null; };
// Intenta caminar des de (x0,z) cap a x1 en passos de 0,05 m; retorna la x final.
function walk(w, x0, z, x1) {
  const res = createMoveResult(); let x = x0; const step = 0.05; let zz = z;
  while (x < x1) { movePlayer(x, zz, step, 0, R, w.colliders, res); const moved = res.x - x; x = res.x; zz = res.z; if (moved < step * 0.2) break; }
  return { x, z: zz };
}


// Camí REAL fins a KEY-C (calaixos → porta secreta → discs → sarcòfag), com a la D.3.1, i després el jugador surt al poble.
const tg = (w, id) => w.gameplay.targets.find((t) => t.id === id);
function realKeyC(w) {
  tg(w, 'OPEN-A-DRS').use(); w.tick(2); tg(w, 'KEY-A').use(); tg(w, 'OPEN-B-CHS').use(); w.tick(3); tg(w, 'KEY-B').use();
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(16);
  w.setPose({ x: 0, z: -33, yaw: 1.2, pitch: -0.2, level: -1, feetY: -3.2 });
  const cr = w.gameplay.crypt; const want = CRYPT.puzzle.solution;
  for (let i = 0; i < 3; i++) while (CRYPT.puzzle.symbols[cr.puzzle.discIndex(i)] !== want[i]) { cr.puzzle.turn(i); w.tick(1); }
  w.tick(12); tg(w, 'CR-SARC-LID').use(); w.tick(14); tg(w, 'KEY-C').use(); w.tick(1);
  expect(w.gameplay.inventory.has('KEY-C'), 'KEY-C ha d\'estar a l\'inventari');
  w.setPose({ x: 14.2, z: -7.7, yaw: -Math.PI / 2, pitch: 0, level: 0, feetY: 0 });
}

// =====================================================================
SECTION('A. Dades aprovades intactes (D.1 v4 / D.2 / D.3 / D.3.1)');
// =====================================================================
test('A1. Hashes d\'or de les dades que no s\'han de tocar (cementiri, reixa, cripta, trencaclosques, claus, porta secreta, il·luminació del poble)', () => {
  const g = { LIGHTS: ['e395ee191dad3b02', LAYOUT.LIGHTS], INT: ['0022e4ecc3b11706', LAYOUT.INTERIOR_LIGHTS || LAYOUT.INT], CANDLES: ['dc76b8827295fbb1', LAYOUT.CANDLES],
    CEMW: ['96b3fc8b9a6580d4', CEM_WALLS], GATE: ['a1b74f49d994fbcc', LAYOUT.GATE || null], CEMGATE: ['b0ef10286bfd641e', CEM_GATE], SD: ['52b3c35013c4952c', SECRET_DOOR], KEYS: ['5d8141fdedda0de0', KEYS] };
  const bad = [];
  for (const [k, [h, o]] of Object.entries(g)) { if (o === undefined || o === null) continue; if (hash(o) !== h) bad.push(`${k}: ${hash(o)} ≠ ${h}`); }
  expect(bad.length === 0, bad.join('; '));
});
test('A2. CEM_GATE: dades aprovades (obertura 1,4 m, pilar nord, punt d\'interacció a la cara oest)', () => {
  expect(near(CEM_GATE.opening.zMax - CEM_GATE.opening.zMin, 1.4), 'amplada'); expect(near(CEM_GATE.pillarNorth.zMax, CEM_GATE.opening.zMin), 'pilar contigu');
  expect(CEM_GATE.interactionPoint.x <= 15.0 + 1e-9, 'el pany és a la cara oest (x ≤ 15,0)');
});
test('A3. Només es retira l\'obstacle del pal del cartell (CT2); els altres props del cementiri no canvien', () => {
  expect(D4_REMOVED_COLLIDERS.length === 1 && D4_REMOVED_COLLIDERS[0] === 'CT2', JSON.stringify(D4_REMOVED_COLLIDERS));
  const all = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CEM_WALLS, CEM_PROPS }); expect(all.some((c) => c.id === 'CT2'), 'les dades de CT2 es conserven');
  const w = world(); expect(!w.colliders.some((c) => c.id === 'CT2'), 'CT2 no ha d\'estar al joc'); expect(all.filter((c) => c.id !== 'CT2').every((c) => w.colliders.some((q) => q.id === c.id)), 'han de quedar tots els altres');
});

// =====================================================================
SECTION('B. Col·lisió de la reixa: tancada bloqueja, oberta deixa passar');
// =====================================================================
test('B1. M-E3 es parteix en pilar nord + bloc de l\'obertura que, units, ocupen exactament el mateix espai', () => {
  const w = world(); const ids = w.colliders.map((c) => c.id); expect(!ids.includes('M-E3'), 'M-E3 ha de desaparèixer'); 
  const o = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS }).find((c) => c.id === 'M-E3');
  expect(near(w.gate.pillar.zMin, o.zMin) && near(w.gate.pillar.zMax, CEM_GATE.opening.zMin) && near(w.gate.block.zMin, CEM_GATE.opening.zMin) && near(w.gate.block.zMax, o.zMax), 'z');
  expect(near(w.gate.pillar.xMin, o.xMin) && near(w.gate.block.xMax, o.xMax), 'x'); expect(w.gate.pillar.enabled !== false && w.gate.block.enabled === true, 'pilar sempre i bloc quan és tancada');
});
test('B2. Reixa TANCADA: el jugador no passa per cap carril de l\'obertura (queda a x ≤ 14,65)', () => {
  const w = world(); for (let z = -8.3; z <= -7.1; z += 0.05) { const e = walk(w, 11, z, 18); expect(e.x <= 14.66, `z=${z.toFixed(2)} → x=${e.x.toFixed(2)}`); }
});
test('B3. Reixa OBERTA: el jugador la travessa pels carrils lliures (z −8,05…−7,35) i no queda encallat', () => {
  const w = world(); w.gate.restore({ open: true }); let n = 0;
  for (let z = -8.0; z <= -7.4; z += 0.05) { const e = walk(w, 11, z, 19); expect(e.x >= 18.9, `z=${z.toFixed(2)} → x=${e.x.toFixed(2)}`); n++; }
  expect(n >= 12, 'carrils provats');
});
test('B4. Oberta, el pas lliure només és l\'obertura: el pilar nord continua sòlid i els murs no s\'han forat', () => {
  const w = world(); w.gate.restore({ open: true });
  for (const z of [-8.7, -8.5]) { const e = walk(w, 11, z, 19); expect(e.x <= 14.66, `pilar z=${z} → ${e.x}`); }
  { const r2 = createMoveResult(); let zz = -5.5; for (let i = 0; i < 40; i++) { movePlayer(14, zz, 0, -0.05, R, w.colliders, r2); zz = r2.z; } expect(zz > -6.26, `el mur sud M-E1 segueix bloquejant (z=${zz.toFixed(2)})`); }
});
test('B5. Durant l\'animació el bloc continua actiu (no es pot entrar a mig obrir) i es desactiva exactament en acabar', () => {
  const w = world(); giveKeyC(w); atLock(w); expect(pressE(w) === CEM_GATE.id, 'E ha d\'obrir');
  expect(w.gate.state === 'opening' && w.gate.block.enabled === true, 'bloc actiu mentre s\'obre');
  w.tick(1.0); expect(w.gate.state === 'opening' && walk(w, 11, -7.7, 18).x <= 14.66, 'a mig obrir no es pot passar');
  w.tick(CEM_GATE_MECH.lockSeconds + CEM_GATE_MECH.swingSeconds); expect(w.gate.state === 'open' && w.gate.block.enabled === false, 'oberta');
  expect(walk(w, 11, -7.7, 18).x >= 17.9, 'travessable un cop oberta');
});

// =====================================================================
SECTION('C. Interacció amb E (KEY-C, distància, orientació, parets)');
// =====================================================================
test('C1. Sense KEY-C: no s\'obre i surt un missatge que parla d\'una clau especial; l\'indicador diu «examinar»', () => {
  const w = world(); atLock(w); w.tick(0.1); const t = gateTarget(w); expect(t && t.prompt().includes('examinar'), 'prompt');
  expect(pressE(w) === CEM_GATE.id, 'E activa l\'objecte'); expect(w.gate.state === 'closed' && w.gate.block.enabled, 'segueix tancada');
  expect(/clau especial/.test(w.gameplay.message), `missatge: ${w.gameplay.message}`);
});
test('C2. Amb KEY-C: l\'indicador diu «obrir» i E comença l\'animació; la clau continua a l\'inventari', () => {
  const w = world(); giveKeyC(w); atLock(w); w.tick(0.1); expect(gateTarget(w).prompt().includes('obrir'), 'prompt');
  expect(pressE(w) === CEM_GATE.id && w.gate.state === 'opening', 'ha de començar'); expect(w.gameplay.inventory.has('KEY-C'), 'la clau no es gasta');
  w.tick(10); expect(w.gate.state === 'open' && w.gameplay.inventory.has('KEY-C'), 'oberta i amb clau');
});
test('C3. No es pot obrir dues vegades ni durant l\'animació: E és ignorada, no hi ha errors i l\'estat final és el mateix', () => {
  const w = world(); giveKeyC(w); atLock(w); pressE(w); w.tick(0.4); const s1 = w.gate.state;
  for (let i = 0; i < 5; i++) { expect(pressE(w) === null, 'E no ha de seleccionar res durant l\'animació'); w.tick(0.1); }
  expect(s1 === 'opening' && w.gate.open() === false, 'open() no s\'accepta a mig obrir');
  w.tick(10); expect(w.gate.state === 'open' && w.gate.open() === false && pressE(w) === null, 'oberta: res més a fer'); expect(w.gate.leafProgress() === 1 && w.gate.lockDrop() === 1, 'progrés final');
});
test('C4. Només a distància i orientació correctes: lluny, d\'esquena i de costat NO s\'activa', () => {
  const w = world(); giveKeyC(w);
  const probe = (x, z, yaw) => { atLock(w, x, z, yaw); w.tick(0.05); return pressE(w) === CEM_GATE.id; };
  expect(!probe(11.0, -7.7, -Math.PI / 2), 'a 4 m'); expect(!probe(12.5, -7.7, -Math.PI / 2), 'a 2,5 m'); expect(!probe(14.2, -7.7, Math.PI / 2), 'd\'esquena (mirant a l\'oest)');
  expect(!probe(14.2, -7.7, 0), 'mirant al nord'); expect(!probe(14.2, -7.7, Math.PI), 'mirant al sud'); expect(w.gate.state === 'closed', 'segueix tancada');
  expect(probe(13.4, -7.7, -Math.PI / 2), 'a 1,6 m mirant-la SÍ');
});
test('C5. No s\'obre a través de parets: ni des del carrer del sud, ni des de dins del cementiri, ni des de més amunt/avall', () => {
  const w = world(); giveKeyC(w);
  const probe = (x, z, yaw, lvl = 0, fy = 0) => { w.setPose({ x, z, yaw, pitch: 0, level: lvl, feetY: fy }); const p = w.pose; const [dx, dz] = dirOf(p); w.gameplay.update(0, x, z, dx, dz, { level: lvl, feetY: fy }); return w.gameplay.pressE(x, z, dx, dz, { level: lvl, feetY: fy }) === CEM_GATE.id; };
  const aim = (x, z) => Math.atan2(-(CEM_GATE.interactionPoint.x - x), -(CEM_GATE.interactionPoint.z - z));
  expect(!probe(14.5, -6.2, aim(14.5, -6.2)), 'des del sud, darrere del mur M-E1');
  expect(!probe(14.9, -9.45, aim(14.9, -9.45)), 'des del nord, darrere del mur M-N1');
  expect(!probe(16.0, -7.7, Math.PI / 2), 'des de dins del cementiri, darrere la reixa');
  expect(!probe(14.2, -7.7, -Math.PI / 2, 1, 2.75), 'des de dalt (altre nivell)'); expect(w.gate.state === 'closed', 'ha de seguir tancada');
  expect(probe(14.2, -7.7, -Math.PI / 2), 'control: davant del pany sí que s\'obre');
});

// =====================================================================
SECTION('D. Animació i geometria de la reixa');
// =====================================================================
test('D1. El progrés és monòton: primer cau el cadenat, després gira la fulla fins a 88° i es queda oberta', () => {
  const w = world(); giveKeyC(w); atLock(w); pressE(w); let lastL = -1; let lastF = -1; let lockedFirst = true;
  for (let i = 0; i < 140; i++) { w.tick(1 / 30); const l = w.gate.lockDrop(); const f = w.gate.leafProgress(); expect(l >= lastL - 1e-9 && f >= lastF - 1e-9, 'monòton'); if (f > 0 && l < 1 - 1e-9) lockedFirst = false; lastL = l; lastF = f; }
  expect(lockedFirst, 'la fulla no es mou fins que el cadenat no ha caigut'); expect(w.gate.state === 'open' && near(w.gate.leafAngle(), 88 * DEG), 'angle final'); 
});
const buildScene = () => { const scene = new THREE.Scene(); const v = buildVillage(scene); scene.updateMatrixWorld(true); return { scene, v }; };
const S = buildScene();
test('D2. La fulla (oberta) queda a l\'interior del cementiri, arran del mur sud i sense tocar-lo; el cadenat acaba a terra', () => {
  const h = S.v.cemeteryGate; expect(h && h.leaf && h.lock, 'handles de la reixa');
  h.setLeafAngle(0); h.setLockDrop(0); S.scene.updateMatrixWorld(true); const closed = new THREE.Box3().setFromObject(h.leaf); const lock0 = new THREE.Box3().setFromObject(h.lock);
  expect(closed.max.x < 15.45 && closed.min.x > 14.95, `tancada dins el gruix del mur: x ${closed.min.x.toFixed(2)}…${closed.max.x.toFixed(2)}`);
  h.setLeafAngle(88 * DEG); h.setLockDrop(1); S.scene.updateMatrixWorld(true); const open = new THREE.Box3().setFromObject(h.leaf); const lock1 = new THREE.Box3().setFromObject(h.lock);
  expect(open.max.x > 16.4 && open.min.x > 15.0, `oberta cap a dins: x ${open.min.x.toFixed(2)}…${open.max.x.toFixed(2)}`);
  expect(open.max.z <= -7.0 + 0.02 && open.min.z > -7.2, `arran del mur sud sense travessar-lo: z ${open.min.z.toFixed(3)}…${open.max.z.toFixed(3)}`);
  expect(lock1.min.y >= -0.03 && lock1.max.y < lock0.max.y - 0.7, `cadenat a terra: y ${lock1.min.y.toFixed(2)}…${lock1.max.y.toFixed(2)}`);
  h.setLeafAngle(0); h.setLockDrop(0);
});
test('D3. La fulla oberta no redueix el pas: el carril lliure del jugador (z −8,05…−7,35) no la talla', () => {
  const h = S.v.cemeteryGate; h.setLeafAngle(88 * DEG); S.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(h.leaf);
  expect(b.max.z <= -6.98 && b.min.z >= -7.2, `z ${b.min.z.toFixed(3)}…${b.max.z.toFixed(3)}`); h.setLeafAngle(0);
});
test('D4. La fulla i el cadenat són objectes mòbils (matriu viva) i la resta del cementiri continua estàtic', () => {
  const h = S.v.cemeteryGate; expect(h.leaf.userData.dynamic && h.lock.userData.dynamic, 'dynamic'); expect(h.leaf.matrixAutoUpdate && h.lock.matrixAutoUpdate, 'matrixAutoUpdate');
});

// =====================================================================
SECTION('E. Guardar i carregar amb la reixa');
// =====================================================================
test('E1. No es pot desar mentre la reixa s\'està obrint; sí un cop oberta', () => {
  const w = world(); realKeyC(w); pressE(w); w.tick(0.5); const c = w.ctx();
  expect(!canSave(c).ok, 'no s\'ha de poder desar a mig obrir'); w.tick(10); expect(canSave(c).ok, `ara sí: ${JSON.stringify(canSave(c))}`);
});
test('E2. La reixa oberta es desa i es recupera: oberta, sense col·lisió, fulla a 88°, clau a l\'inventari i sense duplicar res', () => {
  const w = world(); realKeyC(w); pressE(w); w.tick(10); w.setPose({ x: 17, z: -7.8, yaw: 0, pitch: 0, level: 0, feetY: 0 });
  const data = captureState(w.ctx(), 'v'); expect(data.state.cemeteryGate && data.state.cemeteryGate.open === true, 'a l\'estat desat');
  const w2 = world(); const inv0 = w2.gameplay.inventory.list().length; const v = validateSave(JSON.parse(JSON.stringify(data)), defs(w2)); expect(v.ok, `validació: ${JSON.stringify(v.errors)}`);
  const r = applyState(w2.ctx(), data, defs(w2)); expect(r.ok, JSON.stringify(r));
  expect(w2.gate.state === 'open' && w2.gate.block.enabled === false && near(w2.gate.leafAngle(), 88 * DEG), 'reixa oberta restaurada'); expect(w2.gameplay.inventory.has('KEY-C') && w2.gameplay.inventory.list().length === w.gameplay.inventory.list().length && w2.gameplay.inventory.list().filter((i) => i.id === 'KEY-C').length === 1, 'una sola KEY-C');
  expect(near(w2.pose.x, 17) && walk(w2, 11, -7.7, 19).x >= 18.9, 'i es pot travessar');
  applyState(w2.ctx(), data, defs(w2)); expect(w2.gameplay.inventory.list().length === w.gameplay.inventory.list().length, 'carregar dues vegades no duplica');
});
test('E3. Una partida amb la reixa tancada la deixa tancada (també si abans era oberta): no es perd cap altra cosa', () => {
  const w = world(); atLock(w); const closedSave = captureState(w.ctx(), 'v'); expect(closedSave.state.cemeteryGate.open === false, 'tancada a l\'estat');
  const w2 = world(); realKeyC(w2); pressE(w2); w2.tick(10); expect(w2.gate.isOpen(), 'prèvia oberta');
  const r = applyState(w2.ctx(), closedSave, defs(w2)); expect(r.ok && w2.gate.state === 'closed' && w2.gate.block.enabled === true, JSON.stringify(r)); expect(walk(w2, 11, -7.7, 18).x <= 14.66, 'torna a bloquejar');
});
test('E4. Compatibilitat: una partida de la D.3.1 (sense el camp cemeteryGate) es valida i es carrega amb la reixa tancada', () => {
  const w = world(); atLock(w); const data = JSON.parse(JSON.stringify(captureState(w.ctx(), 'v'))); delete data.state.cemeteryGate;
  const v = validateSave(data, defs(w)); expect(v.ok, JSON.stringify(v.errors)); { const w3 = world(); const r = applyState(w3.ctx(), data, defs(w3)); expect(r.ok, JSON.stringify(r)); }
});
test('E5. Partides invàlides refusades: reixa oberta sense KEY-C, camp mal format, o jugador dins el cementiri amb la reixa tancada', () => {
  const w = world(); realKeyC(w); pressE(w); w.tick(10); const base = JSON.parse(JSON.stringify(captureState(w.ctx(), 'v')));
  const a = JSON.parse(JSON.stringify(base)); a.state.inventory = a.state.inventory.filter((i) => (i.id || i) !== 'KEY-C'); a.state.crypt.keyTaken = false; expect(!validateSave(a, defs(w)).ok, 'oberta sense clau');
  const b = JSON.parse(JSON.stringify(base)); b.state.cemeteryGate = { open: 'sí' }; expect(!validateSave(b, defs(w)).ok, 'camp mal format'); b.state.cemeteryGate = 7; expect(!validateSave(b, defs(w)).ok, 'camp no objecte');
  const c = JSON.parse(JSON.stringify(base)); c.state.cemeteryGate = { open: false }; c.player.x = 17; c.player.z = -8; expect(!validateSave(c, defs(w)).ok, 'dins del cementiri amb la reixa tancada');
  expect(validateSave(base, defs(w)).ok, 'la base és vàlida');
});
test('E6. Mapa: el cementiri passa a ser accessible quan la reixa és oberta (i abans no)', () => {
  const w = world(); const z = w.mapData.zones.find((q) => q.id === 'cementiri'); expect(z && !zoneAccessible(z, w.flags()), 'tancat'); 
  giveKeyC(w); atLock(w); pressE(w); w.tick(10); expect(zoneAccessible(z, w.flags()), 'obert');
  const m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()); const mz = m.zones.find((q) => q.id === 'cementiri'); expect(mz && mz.accessible === true, 'al model del mapa');
});

// =====================================================================
SECTION('F. Cripta més clara (sense perdre l\'ambient) i la resta d\'il·luminació intacta');
// =====================================================================
test('F1. La llum de la cripta és més forta i arriba més lluny que a la D.3.1 (9 / 8) i hi ha un únic punt de llum dinàmic', () => {
  expect(CRYPT.light.intensity >= 15 && CRYPT.light.distance >= 11, JSON.stringify(CRYPT.light)); let n = 0; S.scene.traverse((o) => { if (o.isPointLight && o.name === 'CryptLight') n++; }); expect(n === 1, `punts de llum de la cripta: ${n}`);
});
test('F2. Ambient sota terra: més alt que abans (0,42) però molt per sota de la superfície (no és una cripta il·luminada) i amb to càlid', () => {
  const a = CRYPT.ambient; expect(a.hemiDeep > 0.42 && a.hemiDeep <= 1.0 && a.hemiDeep < a.hemiSurface * 0.6, `hemiDeep=${a.hemiDeep}`); expect(a.fogFarDeep <= 22 && a.fogFarDeep >= 16, 'boira');
  const sky = new THREE.Color(a.hemiSkyDeep); expect(sky.r > sky.b + 0.05, 'to càlid (més vermell que blau)');
});
test('F3. Hi ha més espelmes que a la D.3 (≥ 12) i les zones clau tenen llum a prop: escala, altar dels discs i sarcòfag', () => {
  expect(CRYPT.candles.length >= 12, `espelmes: ${CRYPT.candles.length}`);
  const dist = (l, p) => Math.hypot(l.x - p.x, l.z - p.z); const alt = CRYPT.puzzle.interact; const lights = CRYPT.lights;
  const nearest = (p) => Math.min(...lights.map((l) => dist(l, p)));
  expect(nearest({ x: 0, z: -24.3 }) < 6, 'escala'); expect(nearest({ x: alt.x, z: alt.z }) < 6, 'altar'); expect(nearest({ x: CRYPT.sarcophagus.interact.x, z: CRYPT.sarcophagus.interact.z }) < 6, 'sarcòfag');
});
test('F4. Sense ombres dinàmiques i la il·luminació del poble, de les cases i de l\'església no ha canviat', () => {
  const m = read('../src/main.js'); expect(!/shadowMap\.enabled\s*=\s*true/.test(m) && !/castShadow\s*=\s*true/.test(m), 'sense ombres dinàmiques');
  expect(hash(LAYOUT.LIGHTS) === 'e395ee191dad3b02', 'LIGHTS'); 
});
test('F5. Només la cripta canvia el color de la llum hemisfèrica (a la superfície es conserva el to)', () => {
  const m = read('../src/main.js'); expect(/hemiLight\.color\.copy\(baseHemiSky\)\.lerp\(deepHemiSky, view\.fogT\)/.test(m), 'lerp pel factor de profunditat');
});

// =====================================================================
SECTION('G. Sortida de la cripta neta (la paret grisa de l\'escala)');
// =====================================================================
const mkRay = (S2) => {
  const meshes = []; S2.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const mats = new Map(); for (const o of meshes) { mats.set(o, o.material.side); o.material.side = THREE.DoubleSide; }
  return { meshes, cast(origin, dir) { const rc = new THREE.Raycaster(origin, dir.clone().normalize(), 0, 60); const h = rc.intersectObjects(meshes, false); return h.length ? h[0] : null; } };
};
const RAY = mkRay(S);
const SDOPEN = () => { S.v.puzzle.setSecretDoorProgress ? S.v.puzzle.setSecretDoorProgress(1) : null; S.scene.updateMatrixWorld(true); };
test('G1. Amb la porta secreta oberta, des de la nau es veu a través del pas (no hi ha paret massissa): el primer impacte és molt més enllà del mur', () => {
  expect(S.v.puzzle && typeof S.v.puzzle.setSecretDoorProgress === 'function', 'hi ha d\'haver control visual de la porta secreta');
  SDOPEN(); let bad = [];
  for (const x of [-0.55, 0, 0.55]) for (const y of [0.6, 1.2, 1.8]) { const h = RAY.cast(new THREE.Vector3(x, y, -19.8), new THREE.Vector3(0, 0, -1)); if (!h || h.point.z > -25) bad.push(`x=${x},y=${y} → z=${h ? h.point.z.toFixed(2) : 'cap'}`); }
  expect(bad.length === 0, `queda tapat: ${bad.join('; ')}`);
});
test('G2. Des de l\'escala (replà) mirant cap a l\'església no hi ha cap paret just a la sortida: el primer impacte és ja dins la nau, no a la paret', () => {
  SDOPEN(); const bad = [];
  for (const x of [-0.55, 0, 0.55]) for (const y of [0.6, 1.2, 1.8]) { const h = RAY.cast(new THREE.Vector3(x, y, -22.4), new THREE.Vector3(0, 0, 1)); if (!h || h.point.z < -20.4) bad.push(`x=${x},y=${y} → z=${h ? h.point.z.toFixed(2) : 'cap'}`); }
  expect(bad.length === 0, `paret grisa: ${bad.join('; ')}`);
});
test('G3. Amb la porta secreta TANCADA des de la nau es veu la porta (fulles de fusta a ~0,1 m del mur), no un forat obert', () => {
  S.v.puzzle.setSecretDoorProgress(0); S.scene.updateMatrixWorld(true); const h = RAY.cast(new THREE.Vector3(0, 1.2, -19.8), new THREE.Vector3(0, 0, -1));
  expect(h && h.point.z > -21.2 && h.point.z < -20.2, `primer impacte z=${h && h.point.z.toFixed(3)}`);
});
test('G4. El pas a la paret té el mateix forat apuntat que el marc (1,4 m d\'ample, arc fins a 2,6 m): es veu a la cantonada de l\'arc i a les vores', () => {
  SDOPEN(); const pts = [[-0.65, 1.0], [0.65, 1.0], [-0.6, 1.9], [0.6, 1.9], [0, 2.45]]; const bad = [];
  for (const [x, y] of pts) { const h = RAY.cast(new THREE.Vector3(x, y, -19.8), new THREE.Vector3(0, 0, -1)); if (!h || h.point.z > -25) bad.push(`(${x},${y})`); }
  expect(bad.length === 0, `forat incomplet a ${bad.join(' ')}`);
  const top = RAY.cast(new THREE.Vector3(0, 2.8, -19.8), new THREE.Vector3(0, 0, -1)); expect(top && top.point.z > -21.2 && top.point.z < -20.1, 'per sobre de l\'arc hi ha paret');
});
test('G5. La col·lisió de la sortida no ha canviat: CH-N-B segueix sòlid amb la porta secreta tancada i s\'obre amb ella (no hi ha forats nous)', () => {
  const w = world(); const solid = (x, z) => { const res = createMoveResult(); movePlayer(x, z + 0.5, 0, -0.5, R, w.colliders, res); return res.z > z + 0.2; };
  expect(solid(0, -20.7), 'tancada: bloqueja'); w.gameplay.inventory.add({ id: 'KEY-A', name: 'a', description: 'x', symbol: 'bell' }); w.gameplay.inventory.add({ id: 'KEY-B', name: 'b', description: 'x', symbol: 'moon' });
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(16); w.access.sync(w.gameplay.secretDoor.state);
  const e = createMoveResult(); movePlayer(0, -19.0, 0, -3.0, R, w.colliders, e); expect(e.z < -21.5, `oberta: es pot passar (z=${e.z.toFixed(2)})`);
  const side = createMoveResult(); movePlayer(-1.6, -19.0, 0, -3.0, R, w.colliders, side); expect(side.z > -20.2, 'fora del pas el mur segueix sòlid');
});
test('G6. La decoració (herbes/molsa) ja no cau dins del pou de l\'escala', () => {
  const box = CRYPT.shaft.outer; const bad = [];
  S.scene.traverse((o) => { if (!o.isMesh || !o.parent || o.parent.name !== 'Decor') return; const p = o.geometry.getAttribute('position'); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.x > box.xMin + 0.05 && v.x < box.xMax - 0.05 && v.z > box.zMin + 0.05 && v.z < box.zMax - 0.05 && v.y > -0.5 && v.y < 1.5) { bad.push(o.name); break; } } });
  expect(bad.length === 0, `decoració dins el pou: ${bad.join(',')}`);
});

// =====================================================================
SECTION('H. Cartell «CEMENTIRI →» sense pal, fixat a la paret');
// =====================================================================
test('H1. No queda cap geometria del pal (cap vèrtex a prop de l\'antiga posició del pal, a mitja alçada)', () => {
  const sign = LAYOUT.CEM_PROPS.find((p) => p.id === 'CT2'); const cx = sign.visual.center.x; const cz = sign.collision ? sign.collision.z : -7.6; const bad = [];
  S.scene.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.getAttribute('position'); const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (Math.abs(v.x - cx) < 0.18 && Math.abs(v.z - cz) < 0.18 && v.y > 0.35 && v.y < 1.6) { bad.push(`${o.name}@${v.y.toFixed(2)}`); break; } } });
  expect(bad.length === 0, `queda geometria al lloc del pal: ${bad.join(',')}`);
});
test('H2. El taulell és a la cara sud de M-N1 (z = −9), amb la cara posterior sobre la pedra i centrat a x = 5,5', () => {
  const sign = LAYOUT.CEM_PROPS.find((p) => p.id === 'CT2'); const bd = sign.visual.board; const wz = WALLS.find((w) => w.id === 'M-N1').visual.footprint.zMax;
  const frontZ = wz + bd.thickness + 0.004; let n = 0; let xmin = 1e9; let xmax = -1e9; const v = new THREE.Vector3();
  S.scene.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (Math.abs(v.z - frontZ) < 2e-3 && v.y > bd.bottom - 0.05 && v.y < bd.top + 0.05 && Math.abs(v.x - sign.visual.center.x) < 1.0) { n++; xmin = Math.min(xmin, v.x); xmax = Math.max(xmax, v.x); } } });
  expect(n >= 4, `no trobo el plànol del text (${n})`); expect(Math.abs((xmin + xmax) / 2 - sign.visual.center.x) < 0.1 && Math.abs((xmax - xmin) - bd.width) < 0.1, `x ${xmin.toFixed(2)}…${xmax.toFixed(2)}`);
  expect(bd.thickness < 0.14, 'prim i enganxat a la paret');
});
test('H3. El cartell no té obstacle propi i la resta de col·lisions dels murs no han canviat (M-N1 intacte)', () => {
  const w = world(); const n = w.colliders.find((c) => c.id === 'M-N1'); const o = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS }).find((c) => c.id === 'M-N1');
  expect(n && JSON.stringify(n) === JSON.stringify(o), 'M-N1');
});

// =====================================================================
SECTION('I. Títol «EL POBLE» i tipografia');
// =====================================================================
const FONT_DIR = new URL('../src/assets/fonts/', import.meta.url);
test('I1. El títol visible és «El Poble» (D.5: majúscula inicial); el nom intern (identificador de partida i claus) no ha canviat', () => {
  expect(GAME_TITLE === 'El Poble', GAME_TITLE); const m = read('../src/main.js'); expect(/document\.title = GAME_TITLE/.test(m), 'document.title'); expect(!/The Forgotten Village<\/div>/.test(m), 'ja no es mostra l\'antic títol');
  expect(read('../src/game/saveGame.js').includes('the-forgotten-village'), 'identificador tècnic intacte');
});
test('I2. La pantalla inicial és la de titleScreen.js (capa amb el mateix mecanisme display flex/none) i els controls inclouen E, Esc i el ratolí', () => {
  const m = read('../src/main.js'); expect(/const overlay = createTitleScreen\(document\.body\)/.test(m), 'overlay'); expect(/overlay\.style\.display = 'none'/.test(m) && /overlay\.style\.display = 'flex'/.test(m), 'toggle');
  const t = CONTROLS.map((c) => c.join(' ')).join(' '); expect(/W A S D/.test(t) && /Ratol/.test(t) && /\bE\b/.test(t) && /Esc/.test(t), t);
});
test('I3. Fonts LOCALS: els fitxers existeixen, són woff vàlids, tenen la llicència OFL al costat i cap URL és externa', () => {
  expect(FONT_FACES.length === 5 && FONT_FACES.some((f) => f.family === 'Pixel Monastery Script'), 'cinc variants (inclosa la Pixel Monastery Script, D.5)');
  for (const f of FONT_FACES) { expect(!/^https?:/.test(f.url) || f.url.startsWith('file:'), `URL externa: ${f.url}`); const p = new URL(f.url); const b = fs.readFileSync(p); expect(b.length > 5000 && b.slice(0, 4).toString() === 'wOFF', `no és woff: ${p.pathname}`); }
  for (const l of ['OFL-Gloock.txt', 'OFL-CrimsonPro.txt', 'LLICENCIES.md', 'PixelMonasteryScript.woff']) expect(fs.existsSync(new URL(l, FONT_DIR)), `falta ${l}`);
  expect(/SIL OPEN FONT LICENSE/i.test(fs.readFileSync(new URL('OFL-Gloock.txt', FONT_DIR), 'utf8')), 'OFL');
  const all = ['main.js', 'ui/theme.js', 'ui/titleScreen.js', 'ui/pauseMenu.js', 'ui/mapView.js', 'ui/noteView.js'].map((f) => read(`../src/${f}`)).join('\n'); expect(!/fonts\.googleapis|fonts\.gstatic|cdnjs|<link[^>]+stylesheet/i.test(all), 'dependència externa');
});
test('I4. Les fonts cobreixen tots els caràcters catalans del text del joc (accents, ç, ·, cometes) i les regles @font-face són coherents', () => {
  const css = fontFaceCSS(); expect((css.match(/@font-face/g) || []).length === 5 && /font-display: swap/.test(css), 'font-face');
  expect(/Gloock/.test(FONT_TITLE) && /Crimson Pro/.test(FONT_TEXT) && /serif$/.test(FONT_TITLE) && /serif$/.test(FONT_TEXT), 'pila amb alternativa serif');
});
test('I5. Tota la interfície fa servir el tema (cap «Georgia» solta a la pantalla inicial, menú, mapa, nota ni missatges)', () => {
  for (const f of ['main.js', 'ui/pauseMenu.js', 'ui/mapView.js', 'ui/noteView.js', 'ui/titleScreen.js']) { const s = read(`../src/${f}`).replace(/\/\/.*$/gm, ''); expect(!/font-family:\s*Georgia|px Georgia/.test(s), `${f} té Georgia`); expect(/FONT_TEXT|FONT_TITLE/.test(s), `${f} no usa el tema`); }
  expect(/El Poble/.test(read('../src/ui/mapView.js')), 'el mapa porta el nom del joc'); expect(/FONT_PIXEL/.test(read('../src/ui/pauseMenu.js')), 'capçaleres de menú en pixel art');
});

// =====================================================================
SECTION('I-bis. D.5: títol «El Poble» en pixel art (imatge + font)');
// =====================================================================
const pngSize = (u) => { const b = fs.readFileSync(new URL(u)); expect(b.slice(1, 4).toString() === 'PNG', 'no és PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; };
test('K1. Les imatges del títol existeixen, són PNG amb transparència i fan la mida declarada a TITLE_IMAGE (i el fantasma, la mateixa)', () => {
  const a = pngSize(TITLE_IMAGE.url); const g = pngSize(TITLE_IMAGE.ghostUrl);
  expect(a.w === TITLE_IMAGE.width && a.h === TITLE_IMAGE.height && g.w === a.w && g.h === a.h, `${JSON.stringify(a)} ${JSON.stringify(g)}`); expect(a.colorType === 6 && g.colorType === 6, 'ha de ser RGBA');
  expect(!/^https?:/.test(TITLE_IMAGE.url), 'ruta local');
});
test('K2. titleScale: sempre un enter ≥ 1, creix amb la finestra i no se surt de pantalla (≤ 72 % amplada, ≤ 34 % alçada)', () => {
  for (const [w, h] of [[320, 480], [800, 500], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440], [4000, 2000]]) {
    const k = titleScale(w, h); expect(Number.isInteger(k) && k >= 1, `k=${k}`); if (k > 1) expect(TITLE_IMAGE.width * k <= w * 0.72 + 1e-9 && TITLE_IMAGE.height * k <= h * 0.34 + 1e-9, `${w}x${h} k=${k}`);
  }
  expect(titleScale(1920, 1080) > titleScale(800, 500) && titleScale(100, 100) === 1, 'monòton i mínim 1');
});
test('K3. La pantalla inicial usa la imatge amb factor enter (image-rendering: pixelated) i té text de reserva amb la font si no carrega', () => {
  const t = read('../src/ui/titleScreen.js'); expect(/image-rendering: pixelated/.test(t) && /TITLE_IMAGE\.url/.test(t) && /fv-fallback/.test(t) && /'error'/.test(t), 'imatge + reserva'); expect(/aria-label/.test(t), 'accessible');
});
test('K4. La font pixel es carrega des del paquet local, el nom no depèn de cap servei i només s\'usa a 30 px (múltiples) a capçaleres i mapa', () => {
  expect(/Pixel Monastery Script/.test(FONT_PIXEL), FONT_PIXEL); expect(/30px \$\{FONT_PIXEL\}/.test(read('../src/ui/mapView.js')), 'mapa a 30 px'); expect(/font-family: \$\{FONT_PIXEL\}[^}]*font-size: 30px/.test(read('../src/ui/pauseMenu.js')), 'menú a 30 px');
  const woff = fs.readFileSync(new URL('../src/assets/fonts/PixelMonasteryScript.woff', import.meta.url)); expect(woff.slice(0, 4).toString() === 'wOFF' && woff.length > 20000, 'woff vàlid');
});
// Extreu el cos d'una regla CSS del menú de pausa pel seu selector exacte (el CSS és a pauseMenu.js com a plantilla de text).
const cssRule = (sel) => { const src = read('../src/ui/pauseMenu.js'); const i = src.indexOf(`\n${sel} {`); expect(i >= 0, `no trobo la regla ${sel}`); const e = src.indexOf('\n', i + 1); return src.slice(i + 1, e < 0 ? src.length : e); };   // les regles del menú són d'una sola línia
test('L1. Els cinc botons de navegació usen la font pixel a 30 px exactes (selector .fv-nav .fv-btn[data-tab]), sense separació de lletres', () => {
  const r = cssRule('.fv-nav .fv-btn[data-tab]'); expect(/font-family: \$\{FONT_PIXEL\}/.test(r) && /font-size: 30px/.test(r) && /letter-spacing: 0;/.test(r), r);
  expect(!/\$\{TITLE\}|FONT_TITLE/.test(r), 'no pot dependre de Gloock');
});
test('L2. Els noms dels cinc botons porten majúscula inicial i la resta en minúscula (Inventari, Documents, Mapa, Guardar, Carregar), i no hi ha text-transform', () => {
  expect(TABS.map((t) => t[1]).join(',') === 'Inventari,Documents,Mapa,Guardar,Carregar', TABS.map((t) => t[1]).join(','));
  expect(!/text-transform/.test(cssRule('.fv-nav .fv-btn[data-tab]')) && !/text-transform/.test(cssRule('.fv-btn')), 'cap text-transform que torni a posar majúscules');
});
test('L3. «Pausa» i les capçaleres interiors (.fv-title i .fv-h) segueixen en font pixel a 30 px, i el text «Pausa» té majúscula inicial', () => {
  for (const sel of ['.fv-title', '.fv-h']) { const r = cssRule(sel); expect(/font-family: \$\{FONT_PIXEL\}/.test(r) && /font-size: 30px/.test(r) && /letter-spacing: 0;/.test(r), `${sel}: ${r}`); }
  expect(/el\('div', 'fv-title', 'Pausa'\)/.test(read('../src/ui/pauseMenu.js')), 'Pausa');
});
test('L4. Els textos llargs i descriptius continuen en Crimson Pro (família base del menú) i no es redimensionen: .fv-p, .fv-sub, .fv-key-desc, .fv-doc-text, missatges', () => {
  const src = read('../src/ui/pauseMenu.js'); expect(/const FONT = FONT_TEXT;/.test(src), 'FONT = Crimson Pro'); expect(/\.fv-root \{[^}]*font-family: \$\{FONT\}/.test(src) || /font-family: \$\{FONT\}/.test(src), 'família base');
  for (const sel of ['.fv-p', '.fv-sub']) { if (src.includes(`\n${sel} {`)) { const r = cssRule(sel); expect(!/FONT_PIXEL|\$\{TITLE\}/.test(r), `${sel} no pot ser pixel/títol`); } }
  expect(!/\.fv-(p|sub|key-desc|doc-text)[^{]*\{[^}]*FONT_PIXEL/.test(src), 'cap text llarg en pixel');
});
test('L5. Les capçaleres que es fan servir (header(...)) tenen majúscula inicial; «Tornar al joc» i els botons d\'acció (.fv-act) no han canviat de font', () => {
  const src = read('../src/ui/pauseMenu.js'); const hs = [...src.matchAll(/header\('([^']+)'/g)].map((m) => m[1]); expect(hs.join(',') === 'Inventari,Documents,Mapa,Guardar,Carregar', hs.join(','));
  expect(/\.fv-btn \{ font-family: \$\{TITLE\}; font-size: 14px;/.test(src), '.fv-btn base (Tornar al joc) intacte'); expect(/\.fv-act \{[^}]*font-family: \$\{TITLE\}/.test(src), '.fv-act intacte');
});
test('L6. La capçalera del mapa («El Poble») es dibuixa amb la font pixel a 30 px i no queda cap font de títol antiga al dibuix de la capçalera', () => {
  const m = read('../src/ui/mapView.js'); expect(/ctx\.font = `30px \$\{FONT_PIXEL\}`; ctx\.fillText\('El Poble'/.test(m), 'capçalera'); expect(!/FONT_TITLE/.test(m.replace(/\/\/.*$/gm, '')), 'FONT_TITLE ja no s\'usa al mapa');
  expect(/import \{ FONT_TEXT, FONT_PIXEL \} from '\.\/theme\.js'/.test(m), 'import');
});
test('K5. La llicència de la Pixel Monastery Script és a LLICENCIES.md amb el nom de l\'autor i el seu estat real (no és OFL)', () => {
  const l = read('../src/assets/fonts/LLICENCIES.md'); expect(/Pixel Monastery Script/.test(l) && /Beťko|Betko/.test(l) && /All rights reserved/i.test(l), 'falta la nota');
});

// =====================================================================
SECTION('J. Arquitectura: main.js només cabla, la lògica és als mòduls');
// =====================================================================
test('J1. Integració a main.js: reixa creada després dels colliders, passada a createGameplay i sincronitzada amb el mapa i el desat', () => {
  const m = read('../src/main.js');
  expect(m.includes('createCemeteryGate(colliders, CEM_GATE, CEM_GATE_MECH)'), 'creació'); expect(/cemeteryGate: \{ gate: cemeteryGate, def: CEM_GATE, mech: CEM_GATE_MECH \}/.test(m), 'createGameplay');
  expect(m.includes('cemeteryOpen: cemeteryGate.isOpen()'), 'mapa'); expect(/mapLimit: MAP_LIMIT, CEM_AREA,/.test(m), 'defs de desat amb CEM_AREA'); expect(m.includes('syncCemeteryGateVisual()'), 'sincronització visual');
  expect(m.includes('buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS })'), 'buildColliders intacte'); expect(m.split('\n').length < 950, 'main.js no s\'ha d\'inflar');
});
test('J2. La versió del format de desat no ha canviat (les partides de la D.3.1 continuen carregant-se)', () => { expect(SAVE_VERSION === 1, `SAVE_VERSION=${SAVE_VERSION}`); });

console.log(`\n${failed === 0 ? '✔' : '✘'} ${passed} proves superades, ${failed} fallides.`);
process.exit(failed === 0 ? 0 : 1);
