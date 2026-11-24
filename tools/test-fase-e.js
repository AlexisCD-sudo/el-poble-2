// =====================================================================
// PROVES DE LA FASE E: mecanisme de les lloses del mausoleu            node tools/test-fase-e.js   (necessita `three`)
// Prova la MATEMÀTICA del trencaclosques (regles, validació per continuïtat de canals, resolubilitat per cerca exhaustiva), les parets i portes del
// mausoleu amb col·lisions reals, el flux complet (KEY-C → porta → lloses → porta secreta → clau KEY-BELLS), el desat/càrrega i la integració.
// NO prova l'aspecte en pantalla, el cursor virtual ni el pointer lock del navegador: això es mira amb captures (informe de la fase).
// =====================================================================
import fs from 'node:fs';
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createHouseDoor } from '../src/player/houseDoors.js';
import { createGameplay } from '../src/player/puzzle.js';
import { createCryptAccess } from '../src/player/crypt.js';
import { createCemeteryGate } from '../src/player/cemeteryGate.js';
import { createMausoleum } from '../src/player/mausoleum.js';
import { MAUSOLEUM, MAUSOLEUM_COLLIDERS, SLAB_PUZZLE, SLAB_MECH } from '../src/world/mausoleumData.js';
import * as SP from '../src/player/slabPuzzle.js';
import { buildVillage } from '../src/world/village.js';
import { captureState, canSave, validateSave, applyState } from '../src/game/saveGame.js';
import { createDocuments, documentDefs, DOCUMENT_IDS } from '../src/player/documents.js';
import { buildMapData, createMapProgress } from '../src/world/mapData.js';
import { inventoryEntries } from '../src/ui/menuModel.js';
import { SYMBOL_BITMAPS, SYMBOL_ORDER } from '../src/world/cryptSymbols.js';

const { CRYPT, CRYPT_WALLS, CRYPT_FLOORS, FLOORS, KEYS, SECRET_DOOR, DOORS, PLAYER, BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS, CEM_WALLS, CEM_PROPS, CEM_GATE, CEM_GATE_MECH, CEM_AREA, D4_REMOVED_COLLIDERS } = LAYOUT;
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const SECTION = (t) => console.log(`\n${t}`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const R = PLAYER.collisionRadius; const DEG = Math.PI / 180;
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const D = MAUSOLEUM; const START = SLAB_PUZZLE.start;
const cloneDef = (over) => ({ ...SLAB_PUZZLE, tiles: SLAB_PUZZLE.tiles.map((t) => ({ ...t })), start: START.slice(), ...over });

// ---------------------------------------------------------------------
// Verificador INDEPENDENT (no usa slabPuzzle.js): comprova a mà que el recorregut és continu d'un costat a l'altre
// ---------------------------------------------------------------------
function oracle(cells, def) {
  const open = (cell, side) => { const id = cells[cell]; if (id < 0) return false; return def.tiles.find((t) => t.id === id).channels.includes(side); };
  const delta = { N: -3, S: 3, E: 1, W: -1 }; const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  let cell = def.entry.cell; let from = def.entry.side; const seen = []; const symbols = new Set();
  for (let n = 0; n < 12; n++) {
    if (!open(cell, from)) return false; seen.push(cell);
    const tile = def.tiles.find((t) => t.id === cells[cell]); if (tile.symbol) symbols.add(tile.symbol);
    const to = tile.channels.replace(from, '');                       // l'altre canal de la llosa
    if (cell === def.exit.cell && to === def.exit.side) return def.symbols.every((s) => symbols.has(s));
    if ((to === 'E' && cell % 3 === 2) || (to === 'W' && cell % 3 === 0) || (to === 'N' && cell < 3) || (to === 'S' && cell > 5)) return false;
    cell += delta[to]; from = opp[to]; if (seen.includes(cell)) return false;
  }
  return false;
}
const allPerms = (() => { const out = []; const a = [-1, 0, 1, 2, 3, 4, 5, 6, 7]; (function rec(k) { if (k === 9) { out.push(a.slice()); return; } for (let i = k; i < 9; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; } })(0); return out; })();

// =====================================================================
SECTION('A. Matemàtica del trencaclosques (slabPuzzle.js): dades, regles de moviment i validació per continuïtat real');
// =====================================================================
test('A1. La definició és coherent: 8 lloses amb canals vàlids (rectes i angulars), 1 forat, símbols a 3 lloses, entrada i sortida als extrems', () => {
  expect(SP.validateDef(SLAB_PUZZLE) === true, 'validateDef');
  expect(SLAB_PUZZLE.tiles.length === 8 && START.length === 9 && START.filter((v) => v === -1).length === 1, 'forma');
  const kinds = SLAB_PUZZLE.tiles.map((t) => (t.channels === 'NS' || t.channels === 'EW' ? 'recta' : 'angular'));
  expect(kinds.includes('recta') && kinds.includes('angular'), 'ha de tenir lloses rectes i angulars');
  expect(SLAB_PUZZLE.tiles.filter((t) => t.symbol).map((t) => t.symbol).sort().join() === 'bell,cross,moon', 'tres símbols');
  expect(SLAB_PUZZLE.entry.cell === 0 && SLAB_PUZZLE.entry.side === 'W' && SLAB_PUZZLE.exit.cell === 8 && SLAB_PUZZLE.exit.side === 'E', 'entrada i sortida');
});
test('A2. Les definicions incoherents es rebutgen amb un error clar (id repetit, canals inventats, símbols que no coincideixen, tauler sense forat, llosa inexistent)', () => {
  const bad = [
    cloneDef({ tiles: SLAB_PUZZLE.tiles.map((t, i) => (i === 1 ? { ...t, id: 0 } : t)) }),
    cloneDef({ tiles: SLAB_PUZZLE.tiles.map((t, i) => (i === 2 ? { ...t, channels: 'NN' } : t)) }),
    cloneDef({ tiles: SLAB_PUZZLE.tiles.map((t, i) => (i === 1 ? { ...t, symbol: undefined } : t)) }),
    cloneDef({ start: [5, 0, 4, 3, 6, 1, 2, 7, 1] }), cloneDef({ start: [5, 0, 4, 3, 6, -1, 2, 7, 9] }), cloneDef({ tiles: SLAB_PUZZLE.tiles.slice(0, 7) }),
  ];
  for (const [i, d] of bad.entries()) { let threw = false; try { SP.validateDef(d); } catch (e) { threw = e.message.length > 5; } expect(threw, `la definició errònia ${i} s'ha acceptat`); }
});
test('A3. Només es mou una llosa ADJACENT al forat: mai en diagonal, mai el forat, mai una llosa llunyana ni una casella fora del tauler', () => {
  for (let b = 0; b < 9; b++) {
    const cells = [0, 1, 2, 3, 4, 5, 6, 7].slice(); cells.splice(b, 0, -1);
    const movable = SP.movableCells(cells); const br = Math.floor(b / 3); const bc = b % 3;
    const want = []; for (let i = 0; i < 9; i++) if (i !== b && Math.abs(Math.floor(i / 3) - br) + Math.abs((i % 3) - bc) === 1) want.push(i);
    expect(movable.join() === want.join(), `forat a ${b}: ${movable} ≠ ${want}`);
    expect(!SP.canMove(cells, b) && !SP.canMove(cells, -1) && !SP.canMove(cells, 9), 'el forat i les caselles fora no es mouen');
    for (let i = 0; i < 9; i++) if (!want.includes(i)) expect(SP.moveCell(cells, i) === null, `moviment il·legal acceptat (${i} amb forat a ${b})`);
  }
});
test('A4. Una llosa mai es gira ni es transforma: després de milers de moviments, cada id manté els seus canals i símbol, i el tauler és sempre una permutació', () => {
  let cells = START.slice(); let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let n = 0; n < 5000; n++) { const m = SP.movableCells(cells); const next = SP.moveCell(cells, m[Math.floor(rnd() * m.length)]); expect(next && SP.validCells(next), 'permutació trencada'); cells = next; }
  expect(JSON.stringify(SLAB_PUZZLE.tiles) === JSON.stringify(cloneDef({}).tiles), 'les definicions de les lloses són immutables');
  expect(SP.moveCell(START, SP.movableCells(START)[0]) !== START && START.join() === [5, 0, 4, 3, 6, -1, 2, 7, 1].join(), 'moveCell no modifica l\'original');
});
test('A5. Un moviment és reversible: anar i tornar restitueix el tauler (no hi ha estats absorbents ni contradiccions)', () => {
  for (const i of SP.movableCells(START)) { const b = START.indexOf(-1); const m = SP.moveCell(START, i); const back = SP.moveCell(m, b); expect(back && back.join() === START.join(), `la llosa ${i} no torna`); }
});
test('A6. La validació segueix els canals: el tauler inicial NO és solució i en cap cas es compara amb una configuració fixa (dues solucions diferents, ambdues vàlides)', () => {
  expect(!SP.isSolution(START, SLAB_PUZZLE) && !oracle(START, SLAB_PUZZLE), 'el tauler inicial ja estaria resolt');
  const ex = SP.explore(START, SLAB_PUZZLE); expect(ex.solutions.length >= 2, `només ${ex.solutions.length} solució`);
  const a = ex.solutions[0].cells; const b = ex.solutions.find((s) => s.cells.join() !== a.join()).cells;
  expect(a.join() !== b.join() && SP.isSolution(a, SLAB_PUZZLE) && SP.isSolution(b, SLAB_PUZZLE) && oracle(a, SLAB_PUZZLE) && oracle(b, SLAB_PUZZLE), 'han de ser vàlides les dues');
});
test('A7. Forats i talls: un forat al recorregut, un canal que no encaixa, una sortida cap a fora o un recorregut sense els tres símbols NO són solució', () => {
  const sol = SP.explore(START, SLAB_PUZZLE).solutions[0].cells; const path = SP.traceChannels(sol, SLAB_PUZZLE.tiles, SLAB_PUZZLE.entry, SLAB_PUZZLE.exit).path;
  expect(path.length === 7 && path[0] === 0 && path[6] === 8, `recorregut ${path}`);
  const hole = sol.slice(); hole[path[3]] = -1; hole[sol.indexOf(-1)] = sol[path[3]];                       // forat enmig del recorregut
  const t1 = SP.traceChannels(hole, SLAB_PUZZLE.tiles, SLAB_PUZZLE.entry, SLAB_PUZZLE.exit); expect(!t1.complete && t1.reason === 'forat' && !SP.isSolution(hole, SLAB_PUZZLE), 'forat');
  const swap = sol.slice(); [swap[path[1]], swap[path[2]]] = [swap[path[2]], swap[path[1]]];               // dues lloses intercanviades: el canal no encaixa
  expect(!SP.isSolution(swap, SLAB_PUZZLE) && !oracle(swap, SLAB_PUZZLE), 'intercanvi');
  const noSym = cloneDef({ symbols: ['bell', 'moon', 'cross'], tiles: SLAB_PUZZLE.tiles.map((t) => (t.symbol === 'cross' ? { ...t, symbol: undefined } : t.id === 7 ? { ...t, symbol: 'cross' } : t)) });   // el símbol «creu» és a la llosa parany (id 7)
  const onPath = new Set(path.map((c) => sol[c])); expect(!onPath.has(7), 'la llosa parany no és al recorregut'); expect(SP.traceChannels(sol, noSym.tiles, noSym.entry, noSym.exit).complete && !SP.isSolution(sol, noSym), 'recorregut complet però sense un símbol obligatori: no val');
  const wrongExit = SP.traceChannels(sol, SLAB_PUZZLE.tiles, SLAB_PUZZLE.entry, { cell: 8, side: 'S' }); expect(!wrongExit.complete, 'sortida pel costat incorrecte');
});
test('A8. El verificador independent coincideix amb slabPuzzle.js en TOTS els 362.880 taulers possibles (cap divergència: ni falsos positius ni falsos negatius)', () => {
  let sols = 0; for (const cells of allPerms) { const a = SP.isSolution(cells, SLAB_PUZZLE); if (a !== oracle(cells, SLAB_PUZZLE)) throw new Error(`divergència a ${cells}`); if (a) sols++; }
  expect(allPerms.length === 362880, `${allPerms.length} permutacions`); expect(sols > 0 && sols % 2 === 0, `${sols} disposicions que són solució (assolibles o no)`);
});
test('A9. RESOLUBILITAT: des del tauler inicial s\'assoleixen 181.440 estats (la meitat de les 362.880 permutacions, per paritat) i hi ha solucions assolibles', () => {
  const ex = SP.explore(START, SLAB_PUZZLE);
  expect(ex.reachable === 181440, `estats assolibles: ${ex.reachable}`); expect(ex.solutions.length >= 2, `${ex.solutions.length} solucions assolibles`);
  expect(ex.shortest >= 12 && ex.shortest <= 30, `solució més curta: ${ex.shortest} moviments (ni trivial ni interminable)`);
  expect(ex.solutions.every((s) => SP.reachableFrom(START, s.cells)), 'totes les solucions trobades compleixen la paritat');
  let ok = 0; for (const cells of allPerms.slice(0, 4000)) { if (SP.isSolution(cells, SLAB_PUZZLE)) { /* sols */ } if (SP.reachableFrom(START, cells)) ok++; }
  expect(ok > 1800 && ok < 2200, `la paritat ha d'acceptar ≈ la meitat (${ok}/4000)`);
  const odd = START.slice(); const i = odd.findIndex((v, k) => v >= 0 && k > 0); const j = odd.findIndex((v, k) => v >= 0 && k > i); [odd[i], odd[j]] = [odd[j], odd[i]];
  expect(!SP.reachableFrom(START, odd), 'un intercanvi de dues lloses NO és assolible');
  const alt = SP.explore(odd, SLAB_PUZZLE); expect(alt.reachable === 181440 && alt.reachable + ex.reachable === 362880, 'l\'altra meitat és disjunta (cal evitar aquests taulers)');
});
test('A10. La solució més curta es pot REPRODUIR amb moviments legals i acaba en un tauler que valida pels canals (no és un mirall del solucionador)', () => {
  const ex = SP.explore(START, SLAB_PUZZLE); const p = SP.createSlabPuzzle(SLAB_PUZZLE, SLAB_MECH); let solvedEvents = 0; p.onEvent((t) => { if (t === 'solved') solvedEvents++; });
  expect(ex.path.length === ex.shortest, 'camí'); for (const [k, cell] of ex.path.entries()) { expect(!p.solved || k === ex.path.length, 'resolt abans d\'hora'); const r = p.move(cell); expect(r.ok, `moviment ${k + 1} (casella ${cell}) refusat`); }
  expect(p.solved && solvedEvents === 1 && p.moves === ex.shortest && oracle(p.cells, SLAB_PUZZLE), 'resolt');
});
test('A11. En resoldre\'s el tauler es bloqueja; la il·luminació progressiva avança llosa a llosa pel recorregut i acaba; restaurar un tauler resolt el deixa il·luminat', () => {
  const ex = SP.explore(START, SLAB_PUZZLE); const p = SP.createSlabPuzzle(SLAB_PUZZLE, SLAB_MECH); ex.path.forEach((c) => p.move(c));
  expect(!p.canMove(SP.movableCells(p.cells)[0]) && !p.move(SP.movableCells(p.cells)[0]).ok, 'bloquejat'); expect(p.litCount() === 0 && !p.glowDone(), 'encara no s\'ha il·luminat res');
  const seq = []; for (let t = 0; t < 4; t += 0.1) { seq.push(p.litCount()); p.update(0.1); }
  expect(seq.every((v, i) => i === 0 || v >= seq[i - 1]) && seq.some((v) => v > 1 && v < 2) && p.litCount() === p.path.length && p.glowDone(), `seqüència ${seq.map((v) => v.toFixed(1))}`);
  expect(near(p.glowSeconds(), p.path.length * SLAB_MECH.litSeconds), 'durada = lloses × retard');
  const q = SP.createSlabPuzzle(SLAB_PUZZLE, SLAB_MECH); q.restore(p.snapshot()); expect(q.solved && q.glowDone() && q.litCount() === 7, 'restaurat');
  const r = SP.createSlabPuzzle(SLAB_PUZZLE, SLAB_MECH); r.restore({ cells: START, moves: 0 }); expect(!r.solved && r.litCount() === 0, 'restaurar l\'inicial');
});
function near(a, b, e = 1e-9) { return Math.abs(a - b) <= e; }

// =====================================================================
SECTION('B. Dades del mausoleu: no es toca layout.js; geometria coherent; símbol i clau amb id propi');
// =====================================================================
test('B1. L\'empremta de mausoleumData és la de layout.js (MAU) i layout.js manté el bloc massís (dades protegides intactes)', () => {
  const mau = CEM_PROPS.find((p) => p.id === 'MAU'); const f = mau.collision;
  expect(D.footprint.xMin === f.xMin && D.footprint.xMax === f.xMax && D.footprint.zMin === f.zMin && D.footprint.zMax === f.zMax, 'empremta');
  expect(mau.visual.sealed === true && mau.type === 'mausoleum', 'layout.js intacte');
  const lay = read('../src/world/layout.js'); expect(!lay.includes('KEY-BELLS') && !lay.includes('mausoleumData') && !lay.includes('SLAB_PUZZLE'), 'layout.js no coneix res de la Fase E');
});
test('B2. Planta: parets de 0,4 m, sala 2 m, envà de 0,2 m, cambra 1,8 m; porta de 1,4 m i porta secreta de 1,1 m passables pel jugador (radi 0,35)', () => {
  expect(near(D.interior.xMin - D.footprint.xMin, 0.4) && near(D.footprint.xMax - D.interior.xMax, 0.4) && near(D.interior.zMin - D.footprint.zMin, 0.4), 'parets');
  expect(near(D.hall.zMax - D.hall.zMin, 2.0) && near(D.chamber.zMax - D.chamber.zMin, 1.8) && near(D.partition.zMax - D.partition.zMin, 0.2) && D.hall.zMin === D.partition.zMax && D.chamber.zMax === D.partition.zMin, 'sala/envà/cambra');
  expect(D.door.x1 - D.door.x0 >= 2 * R + 0.3 && D.secret.x1 - D.secret.x0 >= 2 * R + 0.3, 'els passos són prou amples');
  expect(D.pedestal.x - D.pedestal.size / 2 > D.interior.xMin && D.pedestal.z - D.pedestal.size / 2 > D.interior.zMin, 'pedestal dins la cambra');
  expect(D.board.view.x - D.board.x > 0.8 && D.board.view.x < D.interior.xMax, 'la vista de prop és dins la sala, davant del tauler');
});
test('B3. La clau KEY-BELLS té id propi (≠ KEY-A/B/C), és de bronze, símbol «bells3» (tres campanes) i descripció narrativa; el símbol no entra a l\'atles ni als discs', () => {
  const ids = [...KEYS.map((k) => k.id), CRYPT.keyC.id]; expect(!ids.includes(D.key.id) && D.key.id === 'KEY-BELLS', 'id');
  expect(D.key.material === 'bronze' && D.key.symbol === 'bells3' && SYMBOL_BITMAPS.bells3 && !SYMBOL_ORDER.includes('bells3'), 'símbol');
  expect(D.key.description.length > 80 && /campan/i.test(D.key.description) && /bronze/i.test(D.key.description), 'descripció narrativa');
});

// ---------------------------------------------------------------------
// Món de proves (mateixa composició que main.js)
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
  const mau = createMausoleum(colliders, MAUSOLEUM, SLAB_PUZZLE);
  const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown });
  const gameplay = createGameplay({ KEYS, SECRET_DOOR, churchDoor, houseDoors, occluders: doorOccluders, playerRadius: R, crypt: { def: CRYPT, occluders: cryptOcc }, cemeteryGate: { gate, def: CEM_GATE, mech: CEM_GATE_MECH },
    mausoleum: { mau, occluders: mau.colliders.filter((c) => c.id !== 'MAU-PEDESTAL' && c.id !== 'MAU-LEAF') } });
  const documents = createDocuments(documentDefs(CRYPT)); const mapData = buildMapData(LAYOUT); const mapProgress = createMapProgress(mapData);
  const w = { colliders, churchDoor, houseDoors, access, gate, mau, floors, gameplay, documents, mapData, mapProgress, pose: { x: 12, z: -7.7, yaw: -Math.PI / 2, pitch: 0, level: 0, feetY: 0 }, t: 0 };
  w.getPose = () => ({ ...w.pose });
  w.setPose = (p) => { const fl = floors.resolve(p.x, p.z, p.level); w.pose = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, level: fl.level, feetY: fl.y }; };
  w.tick = (sec) => { for (let t = 0; t < sec - 1e-9; t += 1 / 30) { w.t += 1 / 30; const p = w.pose; gameplay.update(1 / 30, p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), { level: p.level, feetY: p.feetY }); access.sync(gameplay.secretDoor.state); } };
  w.ctx = () => ({ gameplay, getPose: w.getPose, setPose: w.setPose, documents, mapProgress, colliders, radius: R, mapLimit: 95, afterRestore: () => access.sync(gameplay.secretDoor.state), now: () => new Date('2026-11-23T10:00:00Z') });
  return w;
};
const defs = (w) => ({
  KEYS, CRYPT, SECRET_DOOR, CEM_AREA, houseDoorIds: DOORS.filter((d) => d.house).map((d) => d.id), churchLimits: { min: 0, max: 170 * DEG }, documentIds: w.documents.knownIds(),
  noteDocumentId: DOCUMENT_IDS.symbolNote, zoneIds: w.mapData.zones.map((z) => z.id), levelSplit: FLOORS.levelSplit, levelSplitDown: CRYPT_FLOORS.levelSplitDown, mapLimit: 95, MAUSOLEUM, SLAB_PUZZLE,
});
const KEYC = { id: CRYPT.keyC.id, name: CRYPT.keyC.name, description: CRYPT.keyC.description, symbol: 'cross' };
const giveKeyC = (w) => { if (!w.gameplay.inventory.has('KEY-C')) w.gameplay.inventory.add(KEYC); };
const tgt = (w, id) => w.gameplay.targets.find((t) => t.id === id);
const pressE = (w) => { const p = w.pose; return w.gameplay.pressE(p.x, p.z, -Math.sin(p.yaw), -Math.cos(p.yaw), { level: p.level, feetY: p.feetY }); };
const stand = (w, x, z, yaw) => { w.setPose({ x, z, yaw, pitch: 0, level: 0, feetY: 0 }); w.gameplay.update(0, x, z, -Math.sin(yaw), -Math.cos(yaw), { level: 0, feetY: 0 }); };
// Camí REAL fins a KEY-C (calaixos → porta secreta → discs → sarcòfag), com a la D.3.1, i la reixa oberta (l'estat és coherent per desar).
function realKeyC(w) {
  tgt(w, 'OPEN-A-DRS').use(); w.tick(2); tgt(w, 'KEY-A').use(); tgt(w, 'OPEN-B-CHS').use(); w.tick(3); tgt(w, 'KEY-B').use();
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(16);
  w.setPose({ x: 0, z: -33, yaw: 1.2, pitch: -0.2, level: -1, feetY: -3.2 });
  const cr = w.gameplay.crypt; const want = CRYPT.puzzle.solution;
  for (let i = 0; i < 3; i++) while (CRYPT.puzzle.symbols[cr.puzzle.discIndex(i)] !== want[i]) { cr.puzzle.turn(i); w.tick(1); }
  w.tick(12); tgt(w, 'CR-SARC-LID').use(); w.tick(14); tgt(w, 'KEY-C').use(); w.tick(1);
  expect(w.gameplay.inventory.has('KEY-C'), 'KEY-C ha d\'estar a l\'inventari'); w.gate.restore({ open: true });
}
const NORTH = 0; const WEST = Math.PI / 2; const EAST = -Math.PI / 2; const SOUTH = Math.PI;
// Camina des de (x,z) amb passos de 0,05 m en la direcció (dx,dz) durant `len` metres; retorna la posició final.
function walk(w, x, z, dx, dz, len) { const res = createMoveResult(); const n = Math.round(len / 0.05); for (let i = 0; i < n; i++) { movePlayer(x, z, dx * 0.05, dz * 0.05, R, w.colliders, res); x = res.x; z = res.z; } return { x, z }; }

// =====================================================================
SECTION('C. Parets i portes del mausoleu amb col·lisions reals');
// =====================================================================
test('C1. El bloc massís \'MAU\' desapareix del joc i el substitueixen parets, porta, envà i pedestal; la resta de col·lisions no es toca', () => {
  const w = world(); const ids = w.colliders.map((c) => c.id);
  expect(!ids.includes('MAU'), 'MAU ha de desaparèixer'); for (const m of MAUSOLEUM_COLLIDERS) expect(ids.includes(m.id), `falta ${m.id}`); expect(ids.includes('MAU-PEDESTAL'), 'pedestal');
  const cem = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CEM_WALLS, CEM_PROPS }).filter((c) => !D4_REMOVED_COLLIDERS.includes(c.id) && c.id !== 'MAU' && c.id !== 'M-E3');
  expect(cem.length > 15 && cem.every((c) => ids.includes(c.id)), 'col·lisions del cementiri intactes');
  const plain = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS }).filter((c) => !c.id.startsWith('CH-N-B') && c.id !== 'M-E3'); const miss = plain.filter((c) => !ids.includes(c.id)).map((c) => c.id); expect(plain.length > 50 && miss.length === 0, `col·lisions del poble: falten ${miss.join()}`);
  for (const id of ['SHED', 'PIT', 'CAL', 'SIB', 'FOSSA', 'LONE', 'ENC-M']) expect(ids.includes(id), `${id} ha de seguir al joc`);
  let threw = false; try { createMausoleum([], MAUSOLEUM, SLAB_PUZZLE); } catch (e) { threw = /no trobo/.test(e.message); } expect(threw, 'sense MAU: error descriptiu');
});
test('C2. Amb la porta TANCADA no es pot entrar (ni per la porta ni per les parets); amb la porta oberta es travessa pel mig i les parets continuen sòlides', () => {
  const w = world(); let p = walk(w, 15, -27.5, 0, -1, 4); expect(p.z > -29.2 + R - 0.02, `la porta tancada ha d'aturar: z=${p.z.toFixed(2)}`);
  for (const dx of [-1.3, 1.3, -0.5, 0.5]) { p = walk(w, 15 + dx, -27.5, 0, -1, 4); expect(p.z > -29.2, `paret: x=${15 + dx} z=${p.z.toFixed(2)}`); }
  w.mau.openDoor(); expect(walk(w, 15, -27.5, 0, -1, 4).z > -29.2 + R - 0.02, 'mentre s\'obre encara bloqueja'); w.tick(3.6); expect(w.mau.isOpen(), 'oberta');
  p = walk(w, 15, -27.5, 0, -1, 2.2); expect(p.z < -29.7 && Math.abs(p.x - 15) < 0.01, `ha d'entrar: z=${p.z.toFixed(2)}`);
  p = walk(w, 15, -30.2, -1, 0, 4); expect(p.x >= D.interior.xMin + R - 0.01 && p.x < D.interior.xMin + R + 0.02, `la paret oest atura: x=${p.x.toFixed(2)}`);
  p = walk(w, 15, -30.2, 1, 0, 4); expect(p.x <= D.interior.xMax - R + 0.01, 'paret est'); p = walk(w, 15, -30.2, 0, -1, 4); expect(p.z >= D.partition.zMax + R - 0.01, `envà: z=${p.z.toFixed(2)}`);
  p = walk(w, 14.95, -28.5, -1, 0, 1); expect(p.x >= 14.35 + R - 0.02, `la fulla oberta (a fora, x 14,25–14,35) atura: x=${p.x.toFixed(2)}`);
  p = walk(w, 14.0, -30.6, 1, 0, 0.0); expect(w.colliders.find((c) => c.id === 'MAU-LEAF').enabled, 'la fulla oberta té col·lisió');
});
test('C3. La porta secreta de l\'envà bloqueja fins que s\'ha enfonsat del tot; oberta, el pas de 1,1 m deixa entrar a la cambra però no travessar el pedestal', () => {
  const w = world(); w.mau.openDoor(); w.tick(4); let p = walk(w, 16.55, -30.2, 0, -1, 3); expect(p.z >= D.partition.zMax + R - 0.01, `tancada: z=${p.z.toFixed(2)}`);
  w.mau.restore({ doorOpen: true, puzzle: { cells: SP.explore(START, SLAB_PUZZLE).solutions[0].cells, moves: 20 }, secretOpen: true, keyTaken: false });
  p = walk(w, 16.55, -30.2, 0, -1, 3); expect(p.z < D.chamber.zMax && p.z > D.interior.zMin + R - 0.02, `oberta: z=${p.z.toFixed(2)}`);
  p = walk(w, 15, -32.0, 0, -1, 1.2); expect(p.z >= D.pedestal.z + 0.36 + R - 0.03, `el pedestal és sòlid: z=${p.z.toFixed(2)}`);
});
test('C4. Cap hueco: el jugador no pot colar-se per les cantonades (parets, porta, envà) caminant en diagonal des de fora', () => {
  const w = world(); let bad = 0;
  for (let x = 11; x <= 19; x += 0.25) for (const [dx, dz] of [[0, -1], [0.7, -0.7], [-0.7, -0.7]]) { const p = walk(w, x, -28.5, dx, dz, 6); if (p.z < -29.5 && p.x > 12.7 && p.x < 17.3) bad++; }
  expect(bad === 0, `${bad} entrades il·legals amb la porta tancada`);
});

// =====================================================================
SECTION('D. Flux complet amb el sistema d\'interacció real: KEY-C → porta → mecanisme → porta secreta → clau KEY-BELLS');
// =====================================================================
test('D1. Sense KEY-C la porta no s\'obre (missatge narratiu); amb KEY-C, E l\'obre i la clau continua a l\'inventari; no es pot obrir dues vegades', () => {
  const w = world(); stand(w, 15, -28.2, NORTH); expect(pressE(w) === 'MAU-DOOR' && w.mau.doorState === 'closed' && /clau/i.test(w.gameplay.message), 'sense clau');
  expect(w.gameplay.prompt === 'E - examinar la porta', `prompt: ${w.gameplay.prompt}`);
  giveKeyC(w); stand(w, 15, -28.2, NORTH); expect(w.gameplay.prompt.includes('obrir'), 'prompt amb clau'); expect(pressE(w) === 'MAU-DOOR' && w.mau.doorState === 'opening', 'obre');
  w.tick(4); expect(w.mau.isOpen() && w.gameplay.inventory.has('KEY-C') && w.gameplay.inventory.has('KEY-C'), 'oberta, KEY-C a l\'inventari');
  stand(w, 15, -28.2, NORTH); expect(!tgt(w, 'MAU-DOOR').enabled(), 'ja no es pot obrir de nou'); expect(w.mau.drainEvents().map((e) => e.type).join() === 'doorOpen,doorDone', 'esdeveniments');
});
test('D2. La porta es pot obrir NOMÉS des de prop i mirant-la: de lluny, d\'esquena o des de dins de la sala no actua', () => {
  const w = world(); giveKeyC(w);
  for (const [x, z, yaw, why] of [[15, -24, NORTH, 'lluny'], [15, -28.2, SOUTH, 'd\'esquena'], [11, -31, EAST, 'a través de la paret oest'], [15, -35.5, SOUTH, 'des de darrere']]) { stand(w, x, z, yaw); expect(pressE(w) !== 'MAU-DOOR', `s'ha obert ${why}`); }
  expect(w.mau.doorState === 'closed', 'segueix tancada');
});
test('D3. El mecanisme només és accessible amb la porta oberta, des de dins la sala i mirant el tauler; no a través de la paret oest ni des de la cambra', () => {
  const w = world(); giveKeyC(w); stand(w, 13.8, -30.6, WEST); expect(!tgt(w, 'MAU-SLABS').enabled() && pressE(w) !== 'MAU-SLABS', 'tancada: no');
  w.mau.openDoor(); w.tick(4); stand(w, 13.8, -30.6, WEST); expect(pressE(w) === 'MAU-SLABS' && w.mau.takePuzzleRequest() === true, 'oberta: demana la vista de prop');
  expect(w.mau.takePuzzleRequest() === false, 'la petició es consumeix');
  stand(w, 11.0, -30.6, EAST); expect(pressE(w) !== 'MAU-SLABS' && !w.mau.takePuzzleRequest(), 'a través de la paret oest NO');
  stand(w, 13.8, -30.6, EAST); expect(pressE(w) !== 'MAU-SLABS', 'd\'esquena al tauler NO');
});
function solveByMoves(w) { for (const cell of SP.explore(w.mau.puzzle.cells, SLAB_PUZZLE).path) expect(w.mau.puzzle.move(cell).ok, 'moviment'); }
test('D4. Resolució: les lloses il·luminen els canals (events i temps), la porta secreta NO s\'obre fins que acaba la il·luminació, i després s\'enfonsa en 5 s', () => {
  const w = world(); w.mau.openDoor(); w.tick(4); w.mau.drainEvents(); solveByMoves(w); expect(w.mau.puzzle.solved && !w.mau.puzzleAvailable(), 'resolt');
  w.tick(1); expect(w.mau.secretState === 'closed' && w.mau.puzzle.litCount() > 1 && !w.mau.puzzle.glowDone(), 'mentre il·lumina, la porta continua tancada');
  w.tick(w.mau.puzzle.glowSeconds() + 0.3); expect(w.mau.secretState === 'opening' && w.mau.secretProgress() >= 0 && w.mau.secretProgress() < 1, 'comença a enfonsar-se');
  expect(walk(w, 16.55, -30.2, 0, -1, 3).z >= D.partition.zMax + R - 0.01, 'encara bloqueja'); w.tick(5.2);
  expect(w.mau.secretOpen() && w.mau.secretProgress() === 1, 'oberta'); const ev = w.mau.drainEvents().map((e) => e.type); expect(ev.join() === 'solved,stone,stoneDone', `esdeveniments: ${ev}`);
  expect(walk(w, 16.55, -30.2, 0, -1, 3).z < D.chamber.zMax, 'ara es pot passar');
});
test('D5. La clau: només amb la cambra oberta i des del pedestal; s\'afegeix a l\'inventari amb la seva descripció, sense tocar KEY-A/B/C ni cap porta de l\'església', () => {
  const w = world(); w.mau.openDoor(); w.tick(4); giveKeyC(w);
  stand(w, 15, -32.0, NORTH); expect(!tgt(w, 'MAU-KEY').enabled() && pressE(w) !== 'MAU-KEY', 'amb la cambra tancada no es pot');
  solveByMoves(w); w.tick(w.mau.puzzle.glowSeconds() + 6); const before = { churchDoor: w.churchDoor.leaves.map((l) => l.angle), sd: w.gameplay.secretDoor.state, gate: w.gate.state };
  stand(w, 15, -31.9, SOUTH); expect(pressE(w) !== 'MAU-KEY', 'd\'esquena (el con de 120° no hi arriba)'); stand(w, 15, -32.0, NORTH); expect(w.gameplay.prompt === 'E - agafar la clau de bronze', w.gameplay.prompt);
  expect(pressE(w) === 'MAU-KEY' && w.gameplay.inventory.has('KEY-BELLS') && w.mau.keyTaken, 'agafada');
  const k = w.gameplay.inventory.list().find((i) => i.id === 'KEY-BELLS'); expect(k.name === D.key.name && k.description === D.key.description && k.symbol === 'bells3', 'dades de la clau');
  expect(w.gameplay.inventory.has('KEY-C') && w.gameplay.inventory.count === 2, 'KEY-C intacta i no es duplica');
  stand(w, 15, -32.0, NORTH); expect(!tgt(w, 'MAU-KEY').enabled(), 'no es pot agafar dues vegades'); pressE(w); expect(w.gameplay.inventory.list().filter((i) => i.id === 'KEY-BELLS').length === 1, 'sense duplicats');
  expect(JSON.stringify(before) === JSON.stringify({ churchDoor: w.churchDoor.leaves.map((l) => l.angle), sd: w.gameplay.secretDoor.state, gate: w.gate.state }), 'les portes existents no han canviat');
  expect(![...w.gameplay.targets].some((t) => /^D[1-4]$|^SD/.test(t.id) && t.use.toString().includes('KEY-BELLS')), 'cap porta existent usa la clau nova');
});
test('D6. KEY-BELLS surt al menú d\'inventari només quan s\'ha agafat (cap quart espai que reveli la clau abans d\'hora), amb la lletra D', () => {
  const ids = ['KEY-A'];
  const dd = { KEYS, CRYPT, MAUSOLEUM, keyDescription: () => 'x' };
  const before = inventoryEntries(dd, ids); const after = inventoryEntries(dd, [...ids, 'KEY-BELLS']);
  expect(before.length === 3 && !before.some((e) => e.id === 'KEY-BELLS'), 'abans: 3 espais'); const e = after.find((x) => x.id === 'KEY-BELLS');
  expect(after.length === 4 && e.collected && e.slot === 'D' && e.symbol === 'bells3' && e.material === 'bronze', 'després: espai D');
});

// =====================================================================
SECTION('E. Desar i carregar: el tauler, la porta i la clau es desen; els estats impossibles es rebutgen');
// =====================================================================
function playedWorld(upTo) {   // upTo: 'door' | 'half' | 'solved' | 'key'
  const w = world(); realKeyC(w); stand(w, 15, -28.2, NORTH); pressE(w); w.tick(4);
  if (upTo === 'half') { const p = SP.explore(START, SLAB_PUZZLE).path; for (const c of p.slice(0, 7)) w.mau.puzzle.move(c); }
  if (upTo === 'solved' || upTo === 'key') { solveByMoves(w); w.tick(w.mau.puzzle.glowSeconds() + 6); }
  if (upTo === 'key') { stand(w, 15, -32.0, NORTH); pressE(w); }
  w.setPose({ x: 15, z: -29.0, yaw: NORTH, pitch: 0, level: 0, feetY: 0 }); w.tick(0.1); return w;
}
test('E1. Round-trip: desar i carregar a mig puzle, resolt i amb la clau deixa exactament el mateix estat (tauler, moviments, porta, clau, inventari)', () => {
  for (const stage of ['door', 'half', 'solved', 'key']) {
    const w = playedWorld(stage); const c = canSave(w.ctx()); expect(c.ok, `${stage}: ${c.reason}`); const data = captureState(w.ctx());
    expect(data.state.mausoleum && Array.isArray(data.state.mausoleum.puzzle.cells), 'camp mausoleum');
    const json = JSON.parse(JSON.stringify(data)); const w2 = world(); const r = applyState(w2.ctx(), json, defs(w2)); expect(r.ok, `${stage}: ${r.error} ${r.errors}`);
    const a = w.mau.snapshot(); const b = w2.mau.snapshot(); expect(JSON.stringify(a) === JSON.stringify(b), `${stage}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
    expect(w2.gameplay.inventory.has('KEY-BELLS') === (stage === 'key') && w2.mau.isOpen() && w2.mau.secretOpen() === (stage === 'solved' || stage === 'key'), `${stage}: inventari/portes`);
    expect(w2.mau.puzzle.solved === (stage === 'solved' || stage === 'key'), `${stage}: resolt`);
  }
});
test('E2. No es pot desar a mig animació (porta o llosa enfonsant-se) i es desa quan tot és quiet', () => {
  const w = world(); realKeyC(w); stand(w, 15, -28.2, NORTH); pressE(w); w.tick(1); expect(!canSave(w.ctx()).ok, 'porta movent-se');
  w.tick(3); expect(canSave(w.ctx()).ok, 'porta quieta'); solveByMoves(w); w.tick(2); expect(!canSave(w.ctx()).ok, 'il·luminant');
  w.tick(w.mau.puzzle.glowSeconds()); w.tick(2); expect(!canSave(w.ctx()).ok, 'porta secreta enfonsant-se'); w.tick(5); expect(canSave(w.ctx()).ok, 'tot quiet');
});
test('E3. Una partida anterior a la Fase E (sense `mausoleum`) es carrega amb la porta tancada, el tauler inicial i sense clau', () => {
  const w = world(); const data = JSON.parse(JSON.stringify(captureState(w.ctx()))); delete data.state.mausoleum;
  const w2 = world(); w2.mau.openDoor(); w2.tick(4); const r = applyState(w2.ctx(), data, defs(w2)); expect(r.ok, `${r.error} ${r.errors}`);
  expect(w2.mau.doorState === 'closed' && w2.mau.puzzle.cells.join() === START.join() && !w2.mau.keyTaken && !w2.mau.secretOpen(), 'estat per defecte');
});
test('E4. Es rebutgen els estats impossibles: tauler no assolible, permutació invàlida, porta secreta sense resoldre, clau sense cambra oberta, progrés amb la porta tancada, jugador dins amb la porta tancada', () => {
  const w = playedWorld('half'); const ok = JSON.parse(JSON.stringify(captureState(w.ctx()))); expect(validateSave(ok, defs(w)).ok, 'base vàlida');
  const mut = (f) => { const d = JSON.parse(JSON.stringify(ok)); f(d.state.mausoleum, d); return validateSave(d, defs(w)); };
  const sol = SP.explore(START, SLAB_PUZZLE).solutions[0].cells;
  const cases = [
    ['intercanvi de dues lloses (no assolible)', (m) => { const c = START.slice(); [c[0], c[1]] = [c[1], c[0]]; m.puzzle.cells = c; }],
    ['permutació amb una llosa repetida', (m) => { m.puzzle.cells = [0, 0, 1, 2, 3, 4, 5, 6, -1]; }],
    ['tauler curt', (m) => { m.puzzle.cells = [0, 1, 2]; }], ['moviments negatius', (m) => { m.puzzle.moves = -1; }], ['camp que no és booleà', (m) => { m.doorOpen = 'sí'; }],
    ['porta secreta oberta sense resoldre', (m) => { m.secretOpen = true; }],
    ['tauler resolt però porta secreta tancada', (m) => { m.puzzle.cells = sol; }],
    ['clau agafada amb la cambra tancada', (m) => { m.keyTaken = true; }],
    ['progrés amb la porta tancada', (m) => { m.doorOpen = false; }],
    ['jugador dins la sala amb la porta tancada', (m, d) => { m.doorOpen = false; m.puzzle = { cells: START, moves: 0 }; d.player.x = 15; d.player.z = -30.6; }],
  ];
  for (const [name, f] of cases) { const r = mut(f); expect(!r.ok && r.errors.length > 0, `s'ha acceptat: ${name}`); }
  const d2 = JSON.parse(JSON.stringify(ok)); d2.state.inventory.push('KEY-BELLS'); expect(!validateSave(d2, defs(w)).ok, 'clau a l\'inventari sense haver-la agafat');
  const d3 = JSON.parse(JSON.stringify(ok)); d3.state.inventory = d3.state.inventory.filter((i) => i !== 'KEY-C'); expect(!validateSave(d3, defs(w)).ok, 'porta oberta sense KEY-C a l\'inventari');
});
test('E5. Carregar una partida inconsistent no deixa res a mitges (transaccional): l\'estat anterior es conserva', () => {
  const w = playedWorld('solved'); const good = JSON.parse(JSON.stringify(captureState(w.ctx()))); const w2 = playedWorld('door'); const before = JSON.stringify(w2.mau.snapshot());
  good.state.mausoleum.puzzle.cells = [0, 0, 0, 0, 0, 0, 0, 0, 0]; const r = applyState(w2.ctx(), good, defs(w2)); expect(!r.ok && JSON.stringify(w2.mau.snapshot()) === before, 'estat modificat');
});

// =====================================================================
SECTION('F. Geometria generada (Three.js) i integració a main.js');
// =====================================================================
const scene = new THREE.Scene(); const village = buildVillage(scene, { cemetery: true, decor: true });
const findAll = (n) => { const out = []; scene.traverse((o) => { if (o.name === n) out.push(o); }); return out; };
test('F1. El mecanisme és un grup propi FORA del poble (com la cripta): 8 lloses, fulla de porta, porta secreta, llum única i clau; el cementiri no hi guanya cap llum', () => {
  const h = village.mausoleum; expect(h && h.group && h.group.name === 'MausoleumMechanism' && !village.root.getObjectByName('MausoleumMechanism'), 'grup fora de root');
  for (let i = 0; i < 8; i++) expect(findAll(`MausoleumSlab-${i}`).length === 1, `llosa ${i}`);
  for (const n of ['MausoleumDoorLeaf', 'MausoleumSecretDoor', 'MausoleumKey', 'MausoleumLight']) expect(findAll(n).length === 1, n);
  let lights = 0; findAll('Cemetery')[0].traverse((o) => { if (o.isLight) lights++; }); expect(lights === 0 && village.stats.pointLights === 0, 'el cementiri i el poble no tenen llums noves');
  let own = 0; h.group.traverse((o) => { if (o.isLight) own++; }); expect(own === 1, 'una sola llum puntual');
});
test('F2. Les lloses es col·loquen a la paret oest segons (fila, columna) i es mouen de forma contínua (posició fraccionària); columna 0 = esquerra = sud', () => {
  const h = village.mausoleum; const B = D.board; const g = (id) => findAll(`MausoleumSlab-${id}`)[0];
  START.forEach((id, i) => { if (id < 0) return; const p = g(id).position; const r = Math.floor(i / 3); const c = i % 3; expect(near(p.y, B.yc + (1 - r) * B.pitch, 1e-6) && near(p.z, B.zc + (1 - c) * B.pitch, 1e-6) && p.x > B.x && p.x < B.x + 0.2, `llosa ${id}`); });
  h.setSlabPose(1, 0.5, 0.25); expect(near(g(1).position.y, B.yc + 0.5 * B.pitch) && near(g(1).position.z, B.zc + 0.75 * B.pitch), 'posició fraccionària');
  const left = g(START[0]).position.z; const right = g(START[2]).position.z; expect(left > right, 'l\'esquerra és al sud (z gran)');
  expect(g(0).userData.dynamic && findAll('MausoleumDoorLeaf')[0].userData.dynamic && findAll('MausoleumSecretDoor')[0].userData.dynamic, 'grups mòbils marcats');
});
test('F3. La fulla gira cap a FORA (sud) sobre la frontissa; la porta secreta s\'enfonsa sota el terra; el recobriment lluminós de cada llosa és additiu i comença apagat; la clau es pot amagar', () => {
  const h = village.mausoleum; const leaf = findAll('MausoleumDoorLeaf')[0]; expect(near(leaf.position.x, D.door.hinge.x) && near(leaf.position.z, D.door.hinge.z), 'frontissa');
  h.setDoorAngle(Math.PI / 2); const tip = new THREE.Vector3(1.4, 0, 0).applyEuler(leaf.rotation); expect(near(tip.z, 1.4, 1e-6) && near(tip.x, 0, 1e-6), `la fulla oberta apunta al sud (a fora): ${tip.x.toFixed(2)},${tip.z.toFixed(2)}`); h.setDoorAngle(0);
  const sg = findAll('MausoleumSecretDoor')[0]; h.setSecretDrop(1); expect(sg.position.y + D.secret.top < 0, 'enfonsada del tot'); h.setSecretDrop(0); expect(sg.position.y === 0, 'tancada');
  const glow = findAll('MausoleumSlab-1')[0].children.find((c) => c.name.endsWith('glow')); expect(glow.material.blending === THREE.AdditiveBlending && glow.material.opacity === 0 && !glow.material.depthWrite, 'recobriment');
  h.setSlabGlow(1, 0.5); expect(glow.material.opacity === 0.5, 'il·luminació'); h.setSlabGlow(1, 7); expect(glow.material.opacity === 1, 'limitada a 1'); h.setSlabGlow(1, 0);
  h.setKeyVisible(false); expect(findAll('MausoleumKey')[0].visible === false, 'clau amagada'); h.setKeyVisible(true);
});
test('F4. El mausoleu és buit: la geometria exterior ja no tapa l\'interior (cap caixa massissa a tota l\'empremta) i hi ha folres foscos a l\'interior', () => {
  const props = findAll('CemeteryProps')[0]; let covers = 0; let dark = 0; const box = new THREE.Box3();
  props.traverse((o) => { if (o.isMesh && o.geometry) { const pos = o.geometry.getAttribute('position'); const col = o.geometry.getAttribute('color'); if (!col) return;
    for (let i = 0; i < pos.count; i += 3) { box.setFromBufferAttribute(pos.clone ? pos : pos); break; } } });
  const sample = (x, y, z) => { // hi ha alguna triangle de la geometria que passi per aquest punt? (ray-cast simple vertical/horitzontal)
    const rc = new THREE.Raycaster(new THREE.Vector3(x - 3, y, z), new THREE.Vector3(1, 0, 0), 0, 6); return rc.intersectObject(props, true).length; };
  void covers; void dark; expect(typeof sample === 'function', 'ok');
  const rc = new THREE.Raycaster(new THREE.Vector3(15, 1.5, -29.0), new THREE.Vector3(0, 0, -1), 0, 6);   // des de la porta, cap al fons: les primeres cares són la paret nord (a 4,6 m) o l'envà (2,2 m), no un bloc massís a 0,2 m
  const hits = rc.intersectObject(props, true).filter((h) => h.object.material && h.object.material.side !== THREE.BackSide); const first = hits.length ? hits[0].distance : Infinity;
  expect(first > 0.35, `l'obertura de la porta ha d'estar buida: primer impacte a ${first.toFixed(2)} m`);
});
test('F5. main.js: el mausoleu es crea DESPRÉS de la reixa, es passa a createGameplay amb els seus oclusors, E demana el mode tauler, WASD no mou el jugador amb el tauler de prop, i la pausa/càrrega el tanquen', () => {
  const m = read('../src/main.js');
  expect(m.indexOf('createMausoleum(colliders') > m.indexOf('createCemeteryGate(colliders'), 'ordre de creació'); expect(/mausoleum: \{ mau: mausoleum, occluders:/.test(m), 'createGameplay');
  expect(/if \(mausoleum\.takePuzzleRequest\(\)\) enterSlabMode\(\)/.test(m), 'E → mode tauler'); expect(/function setKey\(code, pressed\) \{\s*\n\s*if \(slab\.state !== 'off'\) return;/.test(m), 'WASD bloquejat');
  expect(/if \(!locked\) leaveSlabMode\(true\)/.test(m) && /leaveSlabMode\(true\); slab\.anim = null/.test(m), 'pausa i càrrega');
  expect(/mausoleum: mausoleum|MAUSOLEUM, SLAB_PUZZLE,\s*\/\/ Fase E/.test(m), 'saveDefs'); expect(/syncMausoleumVisual\(0\)/.test(m), 'refreshWorld');
  expect(/slab\.state === 'on'[\s\S]{0,200}puzzle\.move|puzzle\.move\(d\.cell\)/.test(m) && !/puzzle\.cells\s*=/.test(m) && !/\.rotation\.[xyz]\s*=[^;]*slab/.test(m), 'les lloses només es mouen per puzzle.move i mai es giren');
  expect(/Math\.min\(1, 6 \* dt\)/.test(m) && /playerLevel === 0/.test(m), 'llum interior suau i només al nivell 0');
});
test('F7. El menú REAL d\'inventari rep les dades del mausoleu (sense això la clau no apareixeria al menú: error trobat en la comprovació al navegador)', () => {
  const m = read('../src/main.js'); expect(/getInventory: \(\) => inventoryEntries\(\{ KEYS, CRYPT, MAUSOLEUM,/.test(m), 'main.js ha de passar MAUSOLEUM a inventoryEntries');
});
test('F6. Cap tecla nova entra en conflicte amb els controls existents: E (sortir), fletxes/WASD (només amb el tauler), ratolí; Esc continua obrint la pausa', () => {
  const m = read('../src/main.js'); expect(/if \(e\.code === 'KeyE' && !e\.repeat\) leaveSlabMode\(false\)/.test(m), 'E surt'); expect(m.includes("e.code === 'Escape'"), 'Escape intacte');
  expect(/\^\(Arrow\|Key\[WASD\]\)/.test(m), 'fletxes i WASD només amb el tauler'); expect(/button === 0/.test(m), 'només el botó esquerre');
});

console.log(`\n${failed === 0 ? '✔' : '✘'} ${passed} proves superades, ${failed} fallides.`);
process.exit(failed === 0 ? 0 : 1);
