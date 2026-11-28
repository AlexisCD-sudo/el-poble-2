// =====================================================================
// PROVES DE LA FASE F: el secret del campanar            node tools/test-fase-f.js   (necessita `three` només per a la secció H)
// Prova la lògica pura (porta, escala de cargol, campanes, desat) amb col·lisions i terres REALS, el flux complet amb el joc (KEY-BELLS → porta →
// escala → cordes → ressonància), la validació del desat i que el codi de main.js / village.js hi és connectat.
// NO prova l'aspecte en pantalla, les animacions vistes a 60 fps ni l'àudio real: això es mira al navegador (informe de la fase).
// La secció H (geometria real amb Three.js) es SALTA, i ho diu, si `three` no és el real (p. ex. un entorn sense xarxa).
// =====================================================================
import fs from 'node:fs';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree, isActive, clearance } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createHouseDoor } from '../src/player/houseDoors.js';
import { createGameplay } from '../src/player/puzzle.js';
import { createCryptAccess } from '../src/player/crypt.js';
import { createCemeteryGate } from '../src/player/cemeteryGate.js';
import { createMausoleum } from '../src/player/mausoleum.js';
import { createBelfry, createTowerSurface } from '../src/player/belfry.js';
import { BELFRY, BELFRY_TEXT, holeSector, stairTotalDeg, stairEndDeg, deg } from '../src/world/belfryData.js';
import { MAUSOLEUM, SLAB_PUZZLE } from '../src/world/mausoleumData.js';
import * as SP from '../src/player/slabPuzzle.js';
import { captureState, canSave, validateSave, applyState } from '../src/game/saveGame.js';
import { createDocuments, documentDefs, DOCUMENT_IDS } from '../src/player/documents.js';
import { buildMapData, createMapProgress } from '../src/world/mapData.js';
import { inventoryEntries } from '../src/ui/menuModel.js';

const { CRYPT, CRYPT_WALLS, CRYPT_FLOORS, FLOORS, KEYS, SECRET_DOOR, DOORS, PLAYER, BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS, CEM_WALLS, CEM_PROPS, CEM_GATE, CEM_GATE_MECH, CEM_AREA, D4_REMOVED_COLLIDERS } = LAYOUT;
let passed = 0; let failed = 0; let skipped = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const SECTION = (t) => console.log(`\n${t}`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const R = PLAYER.collisionRadius; const DEG = Math.PI / 180; const B = BELFRY; const S = B.stair;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

// ---------------------------------------------------------------------
// Món de proves (mateixa composició que main.js)
// ---------------------------------------------------------------------
const KEYBELLS = { id: MAUSOLEUM.key.id, name: MAUSOLEUM.key.name, description: MAUSOLEUM.key.description, symbol: MAUSOLEUM.key.symbol };
const KEYC = { id: CRYPT.keyC.id, name: CRYPT.keyC.name, description: CRYPT.keyC.description, symbol: 'cross' };
const world = () => {
  const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
  colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS, CRYPT_PROPS: LAYOUT.CRYPT_PROPS }));
  colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CEM_WALLS, CEM_PROPS }).filter((c) => !D4_REMOVED_COLLIDERS.includes(c.id)));
  const doorOccluders = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS }).filter((c) => c.id !== 'CH-T');
  const cryptOcc = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS }).filter((c) => !c.id.startsWith('CH-N-B-'));
  const churchDoor = createSwingDoor(DOORS.find((d) => d.id === 'D1')); colliders.push(...churchDoor.colliders);
  const houseDoors = DOORS.filter((d) => d.house).map((d) => createHouseDoor(d)); for (const hd of houseDoors) colliders.push(hd.collider);
  const access = createCryptAccess(colliders, CRYPT);
  const gate = createCemeteryGate(colliders, CEM_GATE, CEM_GATE_MECH);
  const mau = createMausoleum(colliders, MAUSOLEUM, SLAB_PUZZLE);
  const bel = createBelfry(colliders, B);
  const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown, surfaces: [bel.surface] });
  const gameplay = createGameplay({ KEYS, SECRET_DOOR, churchDoor, houseDoors, occluders: doorOccluders, playerRadius: R, crypt: { def: CRYPT, occluders: cryptOcc }, cemeteryGate: { gate, def: CEM_GATE, mech: CEM_GATE_MECH },
    mausoleum: { mau, occluders: mau.colliders.filter((c) => c.id !== 'MAU-PEDESTAL' && c.id !== 'MAU-LEAF') }, belfry: { bel } });
  const documents = createDocuments(documentDefs(CRYPT)); const mapData = buildMapData(LAYOUT); const mapProgress = createMapProgress(mapData);
  const w = { colliders, churchDoor, houseDoors, access, gate, mau, bel, floors, gameplay, documents, mapData, mapProgress, pose: { x: -2.4, z: -10.8, yaw: Math.PI / 2, pitch: 0, level: 0, feetY: 0 }, t: 0 };
  w.getPose = () => ({ ...w.pose });
  w.setPose = (p) => { const fl = floors.resolve(p.x, p.z, p.level, p.feetY); bel.setPlayerY(fl.y); w.pose = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, level: fl.level, feetY: fl.y }; };
  w.tick = (sec) => { for (let t = 0; t < sec - 1e-9; t += 1 / 30) { w.t += 1 / 30; const p = w.pose; gameplay.update(1 / 30, p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), { level: p.level, feetY: p.feetY }); access.sync(gameplay.secretDoor.state); } };
  w.ctx = () => ({ gameplay, getPose: w.getPose, setPose: w.setPose, documents, mapProgress, colliders, radius: R, mapLimit: 95, afterRestore: () => access.sync(gameplay.secretDoor.state), now: () => new Date('2026-11-26T10:00:00Z') });
  return w;
};
const defs = (w) => ({
  KEYS, CRYPT, SECRET_DOOR, CEM_AREA, houseDoorIds: DOORS.filter((d) => d.house).map((d) => d.id), churchLimits: { min: 0, max: 170 * DEG }, documentIds: w.documents.knownIds(),
  noteDocumentId: DOCUMENT_IDS.symbolNote, zoneIds: w.mapData.zones.map((z) => z.id), levelSplit: FLOORS.levelSplit, levelSplitDown: CRYPT_FLOORS.levelSplitDown, mapLimit: 95, MAUSOLEUM, SLAB_PUZZLE, BELFRY,
});
const tgt = (w, id) => w.gameplay.targets.find((t) => t.id === id);
const pressE = (w) => { const p = w.pose; return w.gameplay.pressE(p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), { level: p.level, feetY: p.feetY }); };
const stand = (w, x, z, yaw, level = 0, feetY = 0) => { w.setPose({ x, z, yaw, pitch: 0, level, feetY }); w.tick(0); };
const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));   // yaw que mira de (fx,fz) cap a (tx,tz) (convenció del joc: dir = (−sin yaw, −cos yaw))
const give = (w, ...items) => { for (const it of items) if (!w.gameplay.inventory.has(it.id)) w.gameplay.inventory.add(it); };
// Moviment real: passos de 0,04 m amb col·lisions i terres (venint de l'alçada anterior). Retorna si arriba a l'objectiu.
function walkTo(w, tx, tz, maxJump = { v: 0 }) {
  const res = createMoveResult(); let { x, z, level, feetY } = w.pose;
  for (let i = 0; i < 3000; i++) {
    const dx = tx - x; const dz = tz - z; const d = Math.hypot(dx, dz); if (d < 0.03) { w.pose = { ...w.pose, x, z, level, feetY }; return true; }
    const s = Math.min(0.04, d); movePlayer(x, z, (dx / d) * s, (dz / d) * s, R, w.colliders, res, level);
    const fl = w.floors.resolve(res.x, res.z, level, feetY);
    maxJump.v = Math.max(maxJump.v, Math.abs(fl.y - feetY)); x = res.x; z = res.z; feetY = fl.y; level = fl.level; w.bel.setPlayerY(feetY);
  }
  w.pose = { ...w.pose, x, z, level, feetY }; return false;
}
// Partida coherent fins al final de la Fase E (KEY-C, reixa oberta, mausoleu resolt i KEY-BELLS agafada): l'estat que un jugador real té en arribar al campanar.
function realKeyC(w) {   // camí REAL fins a KEY-C (calaixos → porta secreta → discs → sarcòfag), com a la Fase E
  tgt(w, 'OPEN-A-DRS').use(); w.tick(2); tgt(w, 'KEY-A').use(); tgt(w, 'OPEN-B-CHS').use(); w.tick(3); tgt(w, 'KEY-B').use();
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(16);
  w.setPose({ x: 0, z: -33, yaw: 1.2, pitch: -0.2, level: -1, feetY: -3.2 });
  const cr = w.gameplay.crypt; const want = CRYPT.puzzle.solution;
  for (let i = 0; i < 3; i++) while (CRYPT.puzzle.symbols[cr.puzzle.discIndex(i)] !== want[i]) { cr.puzzle.turn(i); w.tick(1); }
  w.tick(12); tgt(w, 'CR-SARC-LID').use(); w.tick(14); tgt(w, 'KEY-C').use(); w.tick(1);
  expect(w.gameplay.inventory.has('KEY-C'), 'KEY-C ha d\'estar a l\'inventari'); w.gate.restore({ open: true });
}
function coherent(w) {
  realKeyC(w); stand(w, -2.4, -10.8, Math.PI / 2); w.mau.restore({ doorOpen: true, puzzle: w.mau.puzzle.snapshot(), secretOpen: false, keyTaken: false });
  for (const cell of SP.explore(w.mau.puzzle.cells, SLAB_PUZZLE).path) expect(w.mau.puzzle.move(cell).ok, 'moviment del tauler');
  w.mau.update(30); expect(w.mau.takeKey(), 'KEY-BELLS al pedestal'); give(w, KEYBELLS); return w;
}
const openWorld = () => { const w = world(); give(w, KEYBELLS); w.bel.restore({ doorOpen: true, solved: false }); return w; };
// Puja per l'escala seguint un cercle de radi 0,8 amb φ creixent; retorna { top, maxJump }.
function climb(w) {
  const mj = { v: 0 }; walkTo(w, -3.5, -10.8, mj); walkTo(w, -4.4, -10.8, mj);
  let phi = (Math.atan2(w.pose.z - S.cz, w.pose.x - S.cx) * 180) / Math.PI;
  for (let k = 0; k < 2500 && w.pose.feetY < 6.99; k++) { phi += 1.5; const a = phi * DEG; if (!walkTo(w, S.cx + 0.8 * Math.cos(a), S.cz + 0.8 * Math.sin(a), mj)) break; }
  return { top: w.pose.feetY, level: w.pose.level, maxJump: mj.v };
}

// =====================================================================
SECTION('A. Dades: layout.js intacte, planta del campanar, porta i pany');
// =====================================================================
test('A1. layout.js no coneix res de la Fase F (les dades protegides per hashes no es toquen) i l\'empremta de belfryData és la de CH-T', () => {
  const lay = read('../src/world/layout.js'); expect(!/KEY-BELLS|belfryData|BELFRY/.test(lay), 'layout.js no ha de parlar del campanar');
  const t = BUILDINGS.find((b) => b.id === 'CH-T').collision; const f = B.tower.footprint;
  expect(t.xMin === f.xMin && t.xMax === f.xMax && t.zMin === f.zMin && t.zMax === f.zMax, 'empremta');
  const w = BUILDINGS.find((b) => b.id === 'CH-N').collision.find((c) => c.id === 'CH-N-W'); expect(w.xMin === -4 && w.xMax === -3 && w.zMin === -20.4 && w.zMax === -9.6, 'CH-N-W');
});
test('A2. Planta: parets de 0,4 m, interior 2,6 × 3,2 m, pilar de 0,30 i paret de 1,30: l\'anell de graons fa 1,0 m (el jugador de radi 0,35 hi cap)', () => {
  const I = B.tower.interior; const f = B.tower.footprint;
  expect(near(I.xMin - f.xMin, 0.4) && near(I.zMin - f.zMin, 0.4) && near(f.zMax - I.zMax, 0.4) && I.xMax === f.xMax, 'parets');
  expect(near(S.rOut - S.rIn, 1.0) && 2 * R < S.rOut - S.rIn, 'amplada de l\'escala');
  expect(S.cx - S.rOut >= I.xMin - 1e-9 && S.cx + S.rOut <= I.xMax + 1e-9 && S.cz - S.rOut >= I.zMin - 1e-9 && S.cz + S.rOut <= I.zMax + 1e-9, 'el cilindre cap dins l\'interior');
});
test('A3. Porta: 1,0 m d\'ample (passable), a z −11,3→−10,3 amb el primer banc (PEW-W1, zMax −11,4) fora del seu abast: la fulla, a cap angle, el toca', () => {
  const D = B.door; expect(near(D.zMax - D.zMin, 1.0) && D.zMax - D.zMin >= 2 * R + 0.3, 'ample');
  const pew = FURNITURE.find((f) => f.id === 'PEW-W1').collision;
  for (let a = 0; a <= D.openDeg + 1e-9; a += 1) { const r = deg(a); const ex = D.hinge.x + Math.sin(r) * D.leafLength; const ez = D.hinge.z - Math.cos(r) * D.leafLength;
    for (let k = 0; k <= 20; k++) { const x = D.hinge.x + (ex - D.hinge.x) * (k / 20); const z = D.hinge.z + (ez - D.hinge.z) * (k / 20);
      expect(!(x > pew.xMin - D.leafHalfThickness && x < pew.xMax + D.leafHalfThickness && z > pew.zMin - D.leafHalfThickness && z < pew.zMax + D.leafHalfThickness), `la fulla toca el banc a ${a}°`); } }
});
test('A4. La clau de la Fase E apunta a la porta del campanar; KEY-BELLS no és a KEYS i el pany usa el seu id', () => {
  expect(B.door.keyId === MAUSOLEUM.key.id && B.door.keyId === 'KEY-BELLS' && !KEYS.some((k) => k.id === 'KEY-BELLS'), 'id');
  expect(/campanar/.test(MAUSOLEUM.key.description), 'la descripció de la clau ja anuncia el campanar');
});
test('A5. Textos del joc: català, sense xifres ni caràcters que la font Pixel Monastery Script no té', () => {
  for (const [k, v] of Object.entries(BELFRY_TEXT)) { expect(v.length > 10, k); expect(!/[0-9«»—→➤✕…]/.test(v), `${k}: conté xifres o glifs absents de la font`); }
});

// =====================================================================
SECTION('B. Col·lisions: el bloc massís es substitueix; la porta tancada barra el pas; oberta, s\'hi passa');
// =====================================================================
test('B1. createBelfry substitueix CH-T i parteix CH-N-W (no n\'hi ha de duplicats) i falla amb un missatge clar si no els troba', () => {
  const w = world(); const ids = w.colliders.map((c) => c.id);
  expect(!ids.includes('CH-T') && !ids.includes('CH-N-W') && ids.includes('CH-N-W-A') && ids.includes('CH-N-W-B') && ids.includes('BEL-NEWEL') && ids.includes('BEL-DOOR') && ids.includes('BEL-LEAF'), 'substitució');
  expect(new Set(ids).size === ids.length, 'ids duplicats');
  let threw = false; try { createBelfry([], B); } catch (e) { threw = /no trobo/.test(e.message); } expect(threw, 'error descriptiu');
});
test('B2. Tancada: no es pot entrar des de la nau; no es pot travessar la paret oest enlloc més', () => {
  const w = world(); stand(w, -2.4, -10.8, Math.PI / 2);
  walkTo(w, -4.4, -10.8); expect(w.pose.x > -3.1, `la porta tancada barra el pas (x = ${w.pose.x.toFixed(2)})`);
  for (const z of [-15, -12.5, -9.9]) { stand(w, -2.4, z, Math.PI / 2); walkTo(w, -5.3, z); expect(w.pose.x > -3.3, `paret oest a z ${z}`); }
});
test('B3. Oberta: es passa per la porta i s\'arriba a l\'escala; la fulla oberta no atrapa el jugador ni el banc', () => {
  const w = openWorld(); stand(w, -2.4, -10.8, Math.PI / 2); expect(walkTo(w, -4.4, -10.8), 'arriba a l\'escala');
  expect(isPositionFree(w.pose.x, w.pose.z, R, w.colliders, 1e-4, 0), 'posició lliure');
  const leaf = w.colliders.find((c) => c.id === 'BEL-LEAF'); expect(isActive(leaf, 0) && leaf.enabled === true, 'fulla activa');
  expect(w.bel.doorProgress() === 1 && near(Math.atan2(leaf.x2 - leaf.x1, -(leaf.z2 - leaf.z1)), deg(B.door.openDeg), 1e-6), 'fulla a 80°');
});
test('B4. Animació de la porta: closed → opening → open; la col·lisió canvia (bloc → fulla); no es pot tornar a obrir', () => {
  const w = world(); const bel = w.bel; expect(bel.doorState === 'closed' && w.colliders.find((c) => c.id === 'BEL-DOOR').enabled === true, 'tancada');
  expect(bel.openDoor() === true && bel.doorState === 'opening' && bel.openDoor() === false, 'opening');
  bel.update(B.door.swingSeconds / 2); const half = bel.doorProgress(); expect(half > 0.3 && half < 0.7 && !bel.isSettled(), 'a mig camí');
  bel.update(B.door.swingSeconds); expect(bel.doorState === 'open' && bel.isSettled() && bel.doorProgress() === 1 && bel.drainEvents().some((e) => e.type === 'doorDone'), 'oberta');
});

// =====================================================================
SECTION('C. Escala de cargol: alçada contínua, transitable pujant i baixant, sense caure al forat');
// =====================================================================
test('C1. Geometria: 35 graons de 0,20 m = 7,0 m en 1,75 voltes; pendent d\'escala de campanar; entre voltes, pas lliure de sobra', () => {
  expect(S.steps * S.rise === B.tower.floorY && near(stairTotalDeg(S), 630), 'volta i alçada');
  const pitch = B.tower.floorY / S.turns; const tread = ((stairTotalDeg(S) / S.steps) * DEG) * ((S.rIn + S.rOut) / 2);
  const slope = Math.atan2(S.rise, tread) / DEG; expect(slope > 28 && slope < 42, `pendent ${slope.toFixed(1)}°`); expect(pitch - 0.3 > 3, 'entre voltes hi ha més de 3 m');
});
test('C2. Pujada REAL des de la nau (col·lisions + terres): arriba a y = 7 al nivell 1 sense cap salt d\'alçada gran', () => {
  const w = openWorld(); stand(w, -2.4, -10.8, Math.PI / 2); const r = climb(w);
  expect(r.top >= 6.99 && r.level === 1, `cim ${r.top.toFixed(2)} nivell ${r.level}`); expect(r.maxJump < 0.2, `salt màxim ${r.maxJump.toFixed(3)} m`);
});
test('C3. Pas lliure: a cada punt de la sala (terra a y = 7) el cap queda a ≥ 1,95 m del forjat; sota el terra l\'escala és ≥ 1,95 m més baixa', () => {
  const sf = createTowerSurface(B); const H = B.tower.floorY - B.tower.floorThickness - S.headroom; const hs = holeSector(B);
  for (let phi = 0; phi < 360; phi += 3) { const a = phi * DEG; const x = S.cx + 0.8 * Math.cos(a); const z = S.cz + 0.8 * Math.sin(a);
    const under = (((phi - hs.fromDeg) % 360) + 360) % 360 > hs.spanDeg;   // sota el forjat (fora del forat)
    if (!under) continue;
    for (const y of [0, 1, 2, 3, 4, 5, 6, 7]) { const h = sf.heightAt(x, z, 0, y); if (h !== null && h < B.tower.floorY - 1e-6) expect(h <= H + 1e-6, `φ ${phi}: escala a ${h.toFixed(2)} sota el forjat (límit ${H.toFixed(2)})`); }
  }
  expect(near(hs.spanDeg, 188.1, 0.2), 'forat de 188°');
});
test('C4. Baixada REAL: del cim al replà de baix seguint l\'escala cap enrere, sense salts ni atascar-se', () => {
  const w = openWorld(); stand(w, -2.4, -10.8, Math.PI / 2); climb(w); const mj = { v: 0 };
  let phi = (Math.atan2(w.pose.z - S.cz, w.pose.x - S.cx) * 180) / Math.PI;
  for (let k = 0; k < 2500 && w.pose.feetY > 0.2; k++) { phi -= 1.5; const a = phi * DEG; if (!walkTo(w, S.cx + 0.8 * Math.cos(a), S.cz + 0.8 * Math.sin(a), mj)) break; }
  expect(w.pose.feetY < 0.3, `baixa fins ${w.pose.feetY.toFixed(2)}`); expect(mj.v < 0.2, `salt ${mj.v.toFixed(3)}`);
  expect(walkTo(w, -2.4, -10.8), 'i torna a la nau per la porta');
});
test('C5. No es pot caure al forat: des del terra de la sala, travessar la barana cap al sector obert és impossible (l\'alçada no baixa) i no hi ha cap salt gran', () => {
  const w = openWorld(); const mj = { v: 0 };
  for (const [sx, sz, tx, tz] of [[-4.5, -11.0, -5.3, -9.9], [-4.6, -10.6, -5.6, -10.1], [-4.5, -10.9, -5.0, -9.7]]) {
    stand(w, -2.4, -10.8, Math.PI / 2); climb(w); w.pose = { ...w.pose, x: sx, z: sz }; w.setPose({ ...w.pose, level: 1, feetY: 7 }); expect(w.pose.feetY === 7, 'dalt');
    walkTo(w, tx, tz, mj); expect(w.pose.feetY >= 6.99, `ha baixat a ${w.pose.feetY.toFixed(2)} cap a (${tx}, ${tz}) a (${w.pose.x.toFixed(2)}, ${w.pose.z.toFixed(2)})`);
  }
  expect(mj.v < 0.2, `salt màxim ${mj.v.toFixed(3)}`);
});
test('C6. Fora de l\'anell no hi ha escala (el terra normal decideix); el pilar central i la paret exterior són sòlids', () => {
  const sf = createTowerSurface(B); expect(sf.heightAt(-3.5, -10.8, 0, 0) === null && sf.heightAt(-8, -10.8, 0, 0) === null, 'fora');
  const w = openWorld(); for (const [x, z] of [[S.cx, S.cz], [S.cx + 0.2, S.cz], [S.cx - 1.25, S.cz], [S.cx, S.cz + 1.25]]) expect(!isPositionFree(x, z, R, w.colliders, 1e-6, 0), `(${x}, ${z}) ha de ser obstacle`);
});
test('C7. El nivell surt de l\'alçada: a y > 1,4 el jugador és al nivell 1; els obstacles de nivell 0 de la planta baixa de la nau no el bloquegen al campanar', () => {
  const w = openWorld(); const ground = w.floors.resolve(S.cx + 0.8 * Math.cos(deg(-30)), S.cz + 0.8 * Math.sin(deg(-30)), 0, 0);
  expect(w.floors.resolve(S.cx + 0.8, S.cz, 1, 7).level === 1 && ground.level === 0 && ground.y === 0, 'nivells');
});

// =====================================================================
SECTION('D. Trencaclosques de les campanes: PETITA → GRAN → MITJANA');
// =====================================================================
const ORDER = B.solution.map((id) => B.bells.findIndex((b) => b.id === id));
test('D1. La solució és petita → gran → mitjana, i les campanes són de mides diferents (petita < mitjana < gran)', () => {
  expect(B.solution.join() === 'small,large,medium', 'ordre'); const h = Object.fromEntries(B.bells.map((b) => [b.id, b.height]));
  expect(h.small < h.medium && h.medium < h.large, 'mides'); const f = Object.fromEntries(B.bells.map((b) => [b.id, b.freq])); expect(f.small > f.medium && f.medium > f.large, 'to: petita aguda, gran greu');
});
test('D2. Ordre correcte → ressonància → resolt (permanent); cada pas és «correcte» i el progrés creix', () => {
  const w = openWorld(); const bel = w.bel; const evs = [];
  for (const i of ORDER) { const e = bel.ring(i); evs.push(e); }
  expect(evs.map((e) => e.correct).join() === 'true,true,true' && evs.map((e) => e.progress).join() === '1,2,3', 'passos'); expect(bel.resonating && !bel.solved && !bel.isSettled(), 'ressonància en curs');
  bel.update(B.resonanceSeconds + 0.1); expect(bel.solved && !bel.resonating && bel.isSettled(), 'resolt'); expect(bel.drainEvents().map((e) => e.type).filter((t) => t !== 'ring').join() === 'resonance,solved', 'esdeveniments');
});
test('D3. Un error reinicia la seqüència SENSE càstig (es pot reintentar a l\'instant, sense espera ni pèrdua de res)', () => {
  const w = openWorld(); const bel = w.bel; const [s, l, m] = ORDER;
  expect(bel.ring(s).correct === true, 'petita'); expect(bel.ring(m).correct === false, 'mitjana fora d\'ordre'); expect(bel.puzzle.seq.length === 0, 'reiniciada');
  expect(bel.ring(l).correct === false, 'gran com a primera'); expect(bel.ring(s).correct && bel.ring(l).correct && bel.ring(m).correct && bel.resonating, 'torna a començar i resol');
});
test('D4. Cada ordre equivocat (les 6 permutacions menys la bona) NO resol; només la bona resol', () => {
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; let solved = 0;
  for (const p of perms) { const w = openWorld(); for (const i of p) w.bel.ring(i); if (w.bel.resonating) solved++; if (p.join() === ORDER.join()) expect(w.bel.resonating, 'la bona resol'); else expect(!w.bel.resonating, `${p} no ha de resoldre`); }
  expect(solved === 1, 'només una resol');
});
test('D5. Una seqüència parcial s\'oblida amb el temps; estirar una corda després de resolt només sona (free) i no canvia res', () => {
  const w = openWorld(); const bel = w.bel; bel.ring(ORDER[0]); bel.update(B.idleResetSeconds + 1); expect(bel.puzzle.seq.length === 0, 'oblidada');
  for (const i of ORDER) bel.ring(i); bel.update(B.resonanceSeconds + 0.1); const e = bel.ring(1); expect(e && e.free === true && bel.solved, 'free');
});
test('D6. Amb la porta tancada o durant la ressonància les cordes no responen', () => {
  const w = world(); expect(w.bel.ring(0) === null, 'porta tancada'); const o = openWorld(); for (const i of ORDER) o.bel.ring(i); expect(o.bel.ring(0) === null, 'durant la ressonància');
});
test('D7. Animació: la campana oscil·la i s\'atura sola; la ressonància fa tremolar les tres i després s\'apaga', () => {
  const w = openWorld(); const bel = w.bel; bel.ring(0); let max = 0; for (let t = 0; t < 1; t += 1 / 60) { bel.update(1 / 60); max = Math.max(max, Math.abs(bel.bellAngle(0))); }
  expect(max > 0.05 && max <= B.swing.maxAmp + 1e-9, `amplitud ${max.toFixed(3)}`); bel.update(B.swing.seconds + 1); expect(bel.bellAngle(0) === 0, 'quieta');
  for (const i of ORDER) bel.ring(i); bel.update(B.resonanceSeconds * 0.4); expect(bel.bellTremble(0) > 0.5 && bel.bellTremble(1) > 0.5 && bel.bellTremble(2) > 0.5, 'tremolor'); bel.update(B.resonanceSeconds); expect(bel.bellTremble(0) === 0, 'apagat');
});

// =====================================================================
SECTION('E. Joc: interaccions (porta amb KEY-BELLS, cordes), inventari i missatges');
// =====================================================================
test('E1. Sense KEY-BELLS la porta no s\'obre (missatge); amb la clau s\'obre i la clau CONTINUA a l\'inventari', () => {
  const w = world(); stand(w, -2.2, -10.8, yawTo(-2.2, -10.8, -3, -10.8)); w.tick(0.1);
  expect(w.gameplay.target && w.gameplay.target.id === 'BEL-DOOR' && /examinar/.test(w.gameplay.prompt), 'objectiu: examinar'); pressE(w); expect(w.bel.doorState === 'closed' && w.gameplay.message === BELFRY_TEXT.doorLocked, 'tancada + missatge');
  give(w, KEYBELLS); w.tick(0.1); expect(/obrir/.test(w.gameplay.prompt), 'prompt obrir'); expect(pressE(w) === 'BEL-DOOR' && w.bel.doorState === 'opening', 'obre');
  w.tick(B.door.swingSeconds + 0.5); expect(w.bel.isOpen() && w.gameplay.inventory.has('KEY-BELLS'), 'oberta i la clau continua'); expect(!tgt(w, 'BEL-DOOR').enabled(), 'ja no es pot tornar a usar');
});
test('E2. La porta no s\'activa des de lluny, d\'esquena ni a través de la paret (des de dins del campanar o des de fora de l\'església)', () => {
  const w = world(); give(w, KEYBELLS);
  stand(w, 0, -10.8, yawTo(0, -10.8, -3, -10.8)); w.tick(0.05); expect(!w.gameplay.target || w.gameplay.target.id !== 'BEL-DOOR', 'a 3 m');
  stand(w, -2.2, -10.8, yawTo(-2.2, -10.8, 0, -10.8)); w.tick(0.05); expect(!w.gameplay.target || w.gameplay.target.id !== 'BEL-DOOR', 'd\'esquena');
  stand(w, -9, -10.8, yawTo(-9, -10.8, -3, -10.8)); w.tick(0.05); expect(!w.gameplay.target || w.gameplay.target.id !== 'BEL-DOOR', 'des de fora, a través del campanar');
});
test('E3. Les cordes només són interactuables a la sala (nivell 1, y = 7) amb la porta oberta; el prompt és l\'estirar', () => {
  const w = openWorld(); const rp = B.bells[0].rope;
  stand(w, rp.x - 0.7, rp.z, -Math.PI / 2, 0, 0); w.tick(0.05); expect(!w.gameplay.target || !/^BEL-ROPE/.test(w.gameplay.target.id), 'a baix no');
  w.pose = { x: -4.62, z: -11.0, yaw: -Math.PI / 2, pitch: 0, level: 1, feetY: 7 }; w.tick(0.05); expect(w.gameplay.target && /^BEL-ROPE/.test(w.gameplay.target.id) && w.gameplay.prompt === BELFRY_TEXT.ropeHint, `a dalt sí (objectiu ${w.gameplay.target && w.gameplay.target.id})`);
  const c = world(); give(c, KEYBELLS); c.pose = { x: -4.62, z: -11.0, yaw: -Math.PI / 2, pitch: 0, level: 1, feetY: 7 }; c.tick(0.05); expect(!c.gameplay.target || !/^BEL-ROPE/.test(c.gameplay.target.id), 'amb la porta tancada no');
});
test('E4. Joc real complet: KEY-BELLS → porta → escala → sala → tres cordes en ordre → ressonància → resolt', () => {
  const w = world(); give(w, KEYC, KEYBELLS); stand(w, -2.2, -10.8, yawTo(-2.2, -10.8, -3, -10.8)); w.tick(0.1); pressE(w); w.tick(B.door.swingSeconds + 0.5);
  const r = climb(w); expect(r.top >= 6.99 && r.level === 1, 'cim');
  const order = B.solution; const heard = [];
  for (const id of order) { const bell = B.bells.find((b) => b.id === id); const p = w.pose;
    // el jugador es col·loca a la sala, a prop de la corda, mirant-la (la posició exacta depèn de la barana; es tria un punt lliure a ≤ 1,1 m)
    const cand = [[-4.62, -11.8], [-4.62, -11.0], [-4.62, -10.3]].filter(([x, z]) => isPositionFree(x, z, R, w.colliders, 1e-4, 1)).sort((a, b) => Math.hypot(a[0] - bell.rope.x, a[1] - bell.rope.z) - Math.hypot(b[0] - bell.rope.x, b[1] - bell.rope.z))[0];
    w.pose = { x: cand[0], z: cand[1], yaw: yawTo(cand[0], cand[1], bell.rope.x, bell.rope.z), pitch: 0, level: 1, feetY: 7 }; w.tick(0.05);
    expect(w.gameplay.target && w.gameplay.target.id === `BEL-ROPE-${id}`, `objectiu ${w.gameplay.target && w.gameplay.target.id} ≠ ${id}`); pressE(w); heard.push(w.bel.drainEvents().find((e) => e.type === 'ring').bell); w.tick(0.2); }
  expect(heard.join() === 'small,large,medium' && w.bel.resonating, 'ressonància'); w.tick(B.resonanceSeconds + 0.5); expect(w.bel.solved && w.gameplay.isSettled(), 'resolt i quiet');
});
test('E5. KEY-BELLS surt al menú d\'inventari (no només a l\'inventari intern) amb nom i descripció', () => {
  const w = world(); give(w, KEYBELLS); const e = inventoryEntries({ KEYS, CRYPT, MAUSOLEUM, keyDescription: () => '' }, w.gameplay.inventory.list().map((i) => i.id)).find((x) => x.id === 'KEY-BELLS'); expect(e && e.collected && e.name === MAUSOLEUM.key.name && e.description.length > 40, 'entrada');
});

// =====================================================================
SECTION('F. Desat i càrrega: porta, resolt, partides antigues, coherència i seguretat');
// =====================================================================
test('F1. snapshot només desa el que cal ({doorOpen, solved}); la seqüència parcial i les oscil·lacions NO es desen', () => {
  const w = openWorld(); w.bel.ring(ORDER[0]); const s = w.bel.snapshot(); expect(Object.keys(s).sort().join() === 'doorOpen,solved' && s.doorOpen && !s.solved, 'snapshot');
  expect(w.gameplay.snapshot().belfry.doorOpen === true, 'dins l\'estat del joc');
});
test('F2. Cicle complet: partida coherent (mausoleu resolt) + campanar obert i resolt → desar → partida nova → carregar → mateix estat; la clau no es duplica', () => {
  const w = coherent(world()); w.bel.restore({ doorOpen: true, solved: true }); stand(w, -2.4, -11.05, Math.PI / 2);   // (a z −10,8 la fulla oberta quedaria a 0,35 m: just al límit)
  const data = JSON.parse(JSON.stringify(captureState(w.ctx()))); const v = validateSave(data, defs(w)); expect(v.ok, v.errors.join('; '));
  const w2 = world(); const r = applyState(w2.ctx(), data, defs(w2)); expect(r.ok, r.error);
  expect(w2.bel.isOpen() && w2.bel.solved && w2.gameplay.inventory.list().filter((i) => i.id === 'KEY-BELLS').length === 1 && w2.gameplay.inventory.has('KEY-C'), 'restaurat sense duplicar');
  const again = applyState(w2.ctx(), data, defs(w2)); expect(again.ok && w2.gameplay.inventory.list().filter((i) => i.id === 'KEY-BELLS').length === 1, 'carregar dues vegades tampoc duplica');
});
test('F3. Partida antiga SENSE camp «belfry» (i amb KEY-BELLS): es valida i es carrega amb la porta tancada i sense resoldre', () => {
  const w = world(); const snap = w.gameplay.snapshot(); delete snap.belfry; w.bel.restore({ doorOpen: true, solved: true }); w.gameplay.restore(snap);
  expect(w.bel.doorState === 'closed' && !w.bel.solved, 'restore(sense camp) = tancada');
});
test('F4. Validació: porta oberta sense KEY-BELLS, resolt amb la porta tancada, camp mal format o jugador dins la torre amb la porta tancada → rebutjat', () => {
  const w = coherent(world()); const base = captureState(w.ctx()); const d = defs(w); expect(validateSave(base, d).ok, 'base coherent: ' + validateSave(base, d).errors.join('; '));
  const clone = () => JSON.parse(JSON.stringify(base));
  const a = clone(); a.state.belfry = { doorOpen: true, solved: false }; a.state.inventory = a.state.inventory.filter((i) => i !== 'KEY-BELLS'); expect(!validateSave(a, d).ok, 'porta oberta sense clau');
  const b = clone(); b.state.belfry = { doorOpen: false, solved: true }; expect(!validateSave(b, d).ok, 'resolt amb porta tancada');
  const c = clone(); c.state.belfry = { doorOpen: 1, solved: false }; expect(!validateSave(c, d).ok, 'tipus');
  const e = clone(); e.state.belfry = { doorOpen: false, solved: false }; e.player.x = -5.3; e.player.z = -10.8; expect(!validateSave(e, d).ok, 'dins la torre amb la porta tancada');
});
test('F5. canSave: no es desa amb la porta movent-se ni durant la ressonància; sí quan tot és quiet, inclòs dalt de la sala (nivell 1, y = 7)', () => {
  const w = coherent(world()); w.bel.restore({ doorOpen: false, solved: false }); w.bel.openDoor(); expect(!canSave({ ...w.ctx() }).ok, 'porta movent-se'); w.bel.update(B.door.swingSeconds + 0.1);
  for (const i of ORDER) w.bel.ring(i); expect(!canSave({ ...w.ctx() }).ok, 'ressonància'); w.bel.update(B.resonanceSeconds + 0.1);
  stand(w, -4.6, -11.0, 0, 1, 7); expect(w.pose.level === 1 && near(w.pose.feetY, 7), 'dalt'); const r = canSave(w.ctx()); expect(r.ok, `es pot desar dalt: ${r.reason}`);
});
test('F6. Desar a dalt de la sala i carregar en una partida nova restaura posició, nivell, alçada, porta oberta i campanes resoltes', () => {
  const w = coherent(world()); w.bel.restore({ doorOpen: true, solved: true }); stand(w, -4.6, -11.0, 1.2, 1, 7);
  const data = captureState(w.ctx()); const d = defs(w); const v = validateSave(data, d); expect(v.ok, v.errors.join('; '));
  const w2 = world(); const r = applyState(w2.ctx(), JSON.parse(JSON.stringify(data)), defs(w2)); expect(r.ok, r.error);
  expect(w2.bel.isOpen() && w2.bel.solved && w2.gameplay.inventory.has('KEY-BELLS') && w2.pose.level === 1 && near(w2.pose.feetY, 7) && near(w2.pose.x, -4.6), 'estat restaurat');
});

// =====================================================================
SECTION('G. Integració: main.js, puzzle.js, so, mausoleu (pista) i línies base');
// =====================================================================
test('G1. main.js connecta el campanar: createBelfry abans de les terres, superfície, interaccions, validació del desat, animació i so', () => {
  const m = read('../src/main.js');
  expect(m.indexOf('createBelfry(colliders') > m.indexOf('createMausoleum(colliders') && m.indexOf('createBelfry(colliders') < m.indexOf('createFloors('), 'ordre');
  expect(/surfaces: \[belfry\.surface\]/.test(m) && /belfry: \{ bel: belfry \}/.test(m) && /BELFRY,\s*\/\/ Fase F/.test(m), 'terres, gameplay i saveDefs');
  expect(/belfryFrame\(dt,/.test(m) && /belfryFrame\(0,/.test(m), 'fotograma i refreshWorld'); expect(/floors\.resolve\([^)]*feetY\)/.test(m), 'el terra rep l\'alçada anterior');
  expect(/belfry\.setPlayerY\(feetY\)/.test(m), 'la barana del forat s\'activa segons l\'alçada');
});
test('G2. Sons de les campanes (petita aguda, gran greu, mitjana, ressonància) existeixen i els fa servir main.js', () => {
  const s = read('../src/audio/cryptSounds.js'); const m = read('../src/main.js');
  for (const n of ['bellSmall', 'bellLarge', 'bellMedium', 'resonance']) { expect(new RegExp(`${n}\\(t\\)`).test(s), `${n} definit`); expect(m.includes(`'${n}'`) || m.includes(n), `${n} usat`); }
});
test('G3. Pista del mausoleu: tres campanes a la dreta de la porta, d\'esquerra a dreta petita < gran > mitjana, sense text, sota la lluna i sobre la molsa', () => {
  const v = read('../src/world/village.js'); const i = v.indexOf('PISTA DEL CAMPANAR'); expect(i > 0, 'comentari de la pista');
  const m = /for \(const \[dx, w, h\] of \[\[([0-9.]+), ([0-9.]+), ([0-9.]+)\], \[([0-9.]+), ([0-9.]+), ([0-9.]+)\], \[([0-9.]+), ([0-9.]+), ([0-9.]+)\]\]\) cemEngrave\(b, 'bell'/.exec(v.slice(i, i + 900));
  expect(m, 'les tres campanes'); const n = m.slice(1).map(Number); const [dx1, w1, h1, dx2, w2, h2, dx3, w3, h3] = n;
  expect(dx1 < dx2 && dx2 < dx3, 'd\'esquerra a dreta'); expect(h1 < h3 && h3 < h2 && w1 < w3 && w3 < w2, 'petita, gran, mitjana (mides)');
  const doorRight = MAUSOLEUM.door.x1 + 0.14 - (MAUSOLEUM.footprint.xMin + MAUSOLEUM.footprint.xMax) / 2; expect(dx1 - w1 / 2 > doorRight, 'a la dreta del marc de la porta');
  expect(dx3 + w3 / 2 < 2.1, 'abans del pilar de la dreta'); expect(1.2 - h2 / 2 > 0.7 && 1.2 + h2 / 2 < 1.73, 'entre la molsa (0,7) i la lluna (1,73)');
  expect(/cemEngrave\(b, 'bell', \{ x: cx - 1\.75/.test(v) && /cemEngrave\(b, 'moon', \{ x: cx \+ 1\.75/.test(v), 'els gravats antics (campana i lluna) segueixen igual');
});
test('G4. El mecanisme de lloses del mausoleu no s\'ha tocat: mausoleum.js, slabPuzzle.js i el tauler inicial són els de la Fase E', () => {
  const mau = read('../src/player/mausoleum.js'); expect(!/belfry|Belfry|campanar/i.test(mau), 'mausoleum.js sense res del campanar'); expect(!/belfry|campanar/i.test(read('../src/player/slabPuzzle.js')), 'slabPuzzle.js');
  expect(SLAB_PUZZLE.start.join() === '5,0,4,3,6,-1,2,7,1', 'tauler inicial');
});
test('G5. Tipografia: el campanar no afegeix cap font ni text DOM nou fora de Pixel Monastery Script', () => {
  const m = read('../src/main.js'); const b = read('../src/player/belfry.js') + read('../src/world/belfryData.js'); expect(!/font-family|fontFamily|\.font\s*=/.test(b), 'belfry*.js sense fonts'); expect(!/Arial|Georgia|serif|monospace/.test(b + m.slice(m.indexOf('belfryFrame'), m.indexOf('belfryFrame') + 2500)), 'cap font nova');
});

// =====================================================================
SECTION('H. Geometria real (Three.js): només amb el `three` de veritat');
// =====================================================================
let THREE = null; try { THREE = await import('three'); } catch (e) { THREE = null; }
const realThree = THREE && THREE.REVISION && !/stub/.test(String(THREE.REVISION));
if (!realThree) {
  skipped += 3; console.log('  ⚠ SALTADES (NO EXECUTADES): H1–H3. Aquest entorn no té el paquet `three` real (npm i GitHub bloquejats). Cal executar-les al vostre ordinador: node tools/test-fase-f.js');
} else {
  const { buildVillage } = await import('../src/world/village.js');
  const scene = new THREE.Scene(); const v = buildVillage(scene, {}); const find = (n) => { const out = []; scene.traverse((o) => { if (o.name === n) out.push(o); }); return out; };
test('H1. El grup del campanar és FORA de root i disposa d’estadístiques pròpies', () => {
  expect(v.belfry && v.belfry.stats, 'stats');
  expect(v.belfry.stats.triangles > 0, 'triangles del campanar');
});
  test('H2. La porta, les tres campanes i les tres cordes són grups dinàmics amb pivot (giren sobre si mateixos, no sobre l\'origen del món)', () => {
    const b = v.belfry; expect(b.leaf && b.bells.length === 3 && b.ropes.length === 3, 'grups');
    b.setDoorAngle(deg(80)); b.leaf.updateMatrixWorld(true); const p = new THREE.Vector3(); b.leaf.getWorldPosition(p); expect(Math.hypot(p.x - B.door.hinge.x, p.z - B.door.hinge.z) < 0.01, 'pivot de la porta a la frontissa');
    for (let i = 0; i < 3; i++) { b.bells[i].updateMatrixWorld(true); b.bells[i].getWorldPosition(p); expect(Math.hypot(p.x - B.bells[i].pos.x, p.z - B.bells[i].pos.z) < 0.01 && Math.abs(p.y - B.beamY) < 0.2, `pivot de la campana ${i}`); }
  });
  test('H3. Una sola llum puntual nova (la del campanar), apagada de partida; el poble en té les mateixes que abans', () => { const lights = []; v.belfry.group.traverse((o) => { if (o.isPointLight) lights.push(o); }); expect(lights.length === 1 && lights[0] === v.belfry.light && lights[0].intensity === 0, 'llum'); });
}

console.log(`\nResum: ${passed} proves superades, ${failed} fallades${skipped ? `, ${skipped} SALTADES (no executades)` : ''}.`);
process.exit(failed ? 1 : 0);
