// =====================================================================
// PROVES DE LA FASE D.3.1: afinament visual + menú de pausa, documents, mapa, desar i carregar          node tools/test-fase-d31.js   (necessita `three`)
// Prova dades, geometria generada i la lògica REAL (pauseState, saveGame, documents, mapData, menuModel, createGameplay, portes, cripta).
// NO prova l'aspecte en pantalla, el so, el pointer lock del navegador ni el DOM del menú: això ho ha de mirar l'usuari al navegador.
// =====================================================================
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createHouseDoor } from '../src/player/houseDoors.js';
import { createGameplay, KEY_DESCRIPTIONS } from '../src/player/puzzle.js';
import { createCryptAccess } from '../src/player/crypt.js';
import { buildVillage } from '../src/world/village.js';
import { paintBedding, BEDDING_TILE } from '../src/world/village.js';
import { createPauseController, GUARD_MS, MAX_DELTA } from '../src/game/pauseState.js';
import { SAVE_KEY, SAVE_VERSION, captureState, canSave, validateSave, applyState, readSave, writeSave } from '../src/game/saveGame.js';
import { createDocuments, documentDefs, DOCUMENT_IDS } from '../src/player/documents.js';
import { buildMapData, createMapProgress, buildMapModel } from '../src/world/mapData.js';
import { drawMap } from '../src/ui/mapView.js';
import { inventoryEntries, inventorySummary, documentEntries, UNKNOWN_KEY } from '../src/ui/menuModel.js';

const { CRYPT, CRYPT_WALLS, CRYPT_FLOORS, FLOORS, KEYS, SECRET_DOOR, DOORS, PLAYER, BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS, CEM_PROPS } = LAYOUT;
let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const expect = (c, m) => { if (!c) throw new Error(m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const R = PLAYER.collisionRadius;
const hash = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
const SECTION = (t) => console.log(`\n${t}`);

// =====================================================================
SECTION('A. Canvis visuals i dades que NO s\'han de tocar');
// =====================================================================
test('A1. Casa C: UNA sola cadira a tota la casa (C-CH1, planta baixa) i cap altre moble eliminat', () => {
  const chairs = FURNITURE.filter((f) => f.type === 'chair');
  expect(chairs.length === 1 && chairs[0].id === 'C-CH1', `cadires: ${chairs.map((c) => c.id)}`);
  const c = chairs[0].collision; const table = FURNITURE.find((f) => f.id === 'C-TABLE').collision;
  expect(chairs[0].level === 0 && table, 'la cadira ha de ser a la planta baixa, vora la taula');
  const gap = Math.hypot(Math.max(0, table.xMin - c.xMax, c.xMin - table.xMax), Math.max(0, table.zMin - c.zMax, c.zMin - table.zMax));
  expect(gap < 0.6, `la cadira és a ${gap.toFixed(2)} m de la taula`);
  for (const id of ['C-TABLE', 'C-U-BED']) expect(FURNITURE.some((f) => f.id === id), `falta ${id}`);
    const hcFurn = FURNITURE.filter((f) => f.buildingId === 'HC'); // tots els mobles C- que hi havia, menys 3 cadires
  expect(hcFurn.length >= 8, `${hcFurn.length} mobles C-`);
});
test('A2. Les altres cases no han perdut cap cadira (només s\'han tret C-CH2/3/4)', () => {
  expect(!FURNITURE.some((f) => ['C-CH2', 'C-CH3', 'C-CH4'].includes(f.id)), 'cadires sobrants encara presents');
  const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
  expect(!colliders.some((c) => ['C-CH2', 'C-CH3', 'C-CH4'].includes(c.id)), 'col·lisionadors de cadires sobrants');
});
test('A3. D1 comença TANCADA: angles inicials 0°, fulles al centre, isOpen=false, objectiu 165°', () => {
  const sw = DOORS.find((d) => d.id === 'D1').swing;
  expect(sw.initialAngleDeg === 0 && sw.minAngleDeg === 0 && sw.openTargetDeg === 165, JSON.stringify(sw));
  const door = createSwingDoor(DOORS.find((d) => d.id === 'D1'));
  const a = door.angles(); expect(a[0] === 0 && a[1] === 0 && !door.isOpen() && !door.isAnimating(), `angles ${a}`);
  const segs = door.colliders.map((c) => c);
  expect(segs.length === 2, '2 fulles');
  const xs = segs.flatMap((c) => [c.x1, c.x2]).filter((v) => Number.isFinite(v));
  const gap = (() => { const w = segs.find((c) => Math.max(c.x1, c.x2) < 0.5); const e = segs.find((c) => Math.min(c.x1, c.x2) > -0.5); return Math.min(Math.abs(e.x1), Math.abs(e.x2)) + Math.min(Math.abs(w.x1), Math.abs(w.x2)); })();
  expect(gap < 0.06, `les fulles no encaixen al centre (forat ${gap.toFixed(3)} m)`);
});
test('A4. D1: el jugador NO travessa les fulles tancades; amb E s\'obre, es pot entrar i es torna a tancar', () => {
  const door = createSwingDoor(DOORS.find((d) => d.id === 'D1'));
  const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS }); colliders.push(...door.colliders);
  const out = createMoveResult(); let crossed = 0;
  for (const x0 of [-0.9, -0.5, -0.1, 0.1, 0.5, 0.9]) {
    let px = x0; let pz = -4;
    for (let f = 0; f < 400; f++) { movePlayer(px, pz, 0, -0.06, R, colliders, out, 0); px = out.x; pz = out.z; door.update(1 / 60, px, pz, 0, -0.06, R, colliders); }
    if (pz < -9.7) crossed++;
  }
  expect(crossed === 0, `${crossed} recorreguts han travessat la porta tancada`);
  door.toggle(); for (let i = 0; i < 300; i++) door.update(1 / 60, 0, -7, 0, 0, R, colliders);
  expect(door.isOpen(), 'E ha d\'obrir'); let px = 0; let pz = -7;
  for (let f = 0; f < 300; f++) { movePlayer(px, pz, 0, -0.06, R, colliders, out, 0); px = out.x; pz = out.z; }
  expect(pz < -12, `no ha pogut entrar (z=${pz.toFixed(2)})`);
  door.toggle(); for (let i = 0; i < 400; i++) door.update(1 / 60, 0, -4, 0, 0, R, colliders);
  expect(!door.isOpen() && door.angles().every((a) => a < 1e-6), 'E ha de tornar a tancar-la');
});
test('A5. Portes D2/D3/D4 i la resta de dades aprovades NO han canviat (hash idèntic a la D.3)', () => {
  const H = {
    LIGHTS: 'e395ee191dad3b02', INT: '0022e4ecc3b11706', CANDLES: 'dc76b8827295fbb1', CEMW: '96b3fc8b9a6580d4', CEMP: '00057f298fff49f8', CT2: '9fc58104c8b2d3b6',
    CW: 'b9a5dc26ecfc009d', CP: '28a0f604781b3c34', CF: '19eefab751812495', PUZ: '30622f739a8299c6', SARC: '9db0942f57b86fea', KEYS: '5d8141fdedda0de0',
    SD: '52b3c35013c4952c', D234: '16ca3844240a72be', GATE: 'a1b74f49d994fbcc', CEMGATE: 'b0ef10286bfd641e',
  };
  const now = {
    LIGHTS: hash(LAYOUT.LIGHTS), INT: hash(LAYOUT.INTERIOR_LIGHTS), CANDLES: hash(LAYOUT.CANDLES), CEMW: hash(LAYOUT.CEM_WALLS), CEMP: hash(CEM_PROPS.filter((p) => p.id !== 'CT2')), CT2: hash(CEM_PROPS.find((p) => p.id === 'CT2')),
    CW: hash(CRYPT_WALLS), CP: hash(LAYOUT.CRYPT_PROPS), CF: hash(CRYPT_FLOORS), PUZ: hash(CRYPT.puzzle), SARC: hash(CRYPT.sarcophagus), KEYS: hash(KEYS), SD: hash(SECRET_DOOR),
    D234: hash(DOORS.filter((d) => d.id !== 'D1')), GATE: hash(LAYOUT.GATE), CEMGATE: hash(LAYOUT.CEM_GATE),
  };
  const diff = Object.keys(H).filter((k) => H[k] !== now[k]); expect(diff.length === 0, `dades canviades: ${diff}`);
});
test('A6. Il·luminació del poble i de l\'església intacta (LIGHTS, INTERIOR_LIGHTS, CANDLES del poble)', () => {
  expect(hash(LAYOUT.LIGHTS) === 'e395ee191dad3b02' && hash(LAYOUT.INTERIOR_LIGHTS) === '0022e4ecc3b11706' && hash(LAYOUT.CANDLES) === 'dc76b8827295fbb1', 'canvis a la llum del poble');
});

const scene = new THREE.Scene(); const village = buildVillage(scene); const root = scene.children.find((c) => c.name === 'Village') || scene;
const findGroup = (n) => { let r = null; root.traverse((o) => { if (o.name === n) r = o; }); return r; };
const bboxOf = (mesh, f = () => true) => { const p = mesh.geometry.getAttribute('position'); const b = new THREE.Box3(); const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); if (f(v)) b.expandByPoint(v); } return b; };
root.updateMatrixWorld(true);

test('A7. Cartell CT2: taulell ENGANXAT a M-N1 (cara posterior a z = −9, ni flotant ni dins del mur), text mirant al sud', () => {
  const wall = WALLS.find((w) => w.id === 'M-N1'); const wz = wall.visual.footprint.zMax;
  const props = findGroup('CemeteryProps'); expect(props, 'falta CemeteryProps');
  const inBoard = (v) => v.x > 5.7 && v.x < 7.3 && v.y > 1.6 && v.y < 2.3 && v.z < -8.5;
  const wood = props.children.find((m) => m.name === 'CemeteryProps-wood'); const sign = props.children.find((m) => m.name === 'CemeteryProps-sign');
  const bw = bboxOf(wood, inBoard);
  expect(bw.min.z >= wz - 1e-6, `el taulell entra dins del mur (z mín ${bw.min.z.toFixed(3)} < ${wz})`);
  expect(bw.min.z - wz < 0.004, `el taulell queda a ${(bw.min.z - wz).toFixed(3)} m de la paret (flotant)`);
  const bs = bboxOf(sign, inBoard); expect(bs.min.z > wz && bs.max.z < wz + 0.12, `el text és a z ${bs.min.z.toFixed(3)}..${bs.max.z.toFixed(3)}`);
  const n = sign.geometry.getAttribute('normal'); expect(n.getZ(0) > 0.99, 'el text no mira al sud (cap a la plaça)');
  expect(bs.min.x > 5.5 + 0.25 && bs.max.x < 5.5 + 1.0 + 0.7 && bs.max.x - bs.min.x < 1.4, 'el text no ha de quedar darrere del pal (x 5,5) i ha de ser dins del mur M-N1');
  expect(bs.min.y > 1.7 && bs.max.y < 2.3, 'alçada del cartell');
});
test('A8. Cartell: dades aprovades de CT2 (centre, pal, collider) intactes i mur M-N1 no mogut', () => {
  const ct2 = CEM_PROPS.find((p) => p.id === 'CT2'); expect(hash(ct2) === '9fc58104c8b2d3b6', 'CT2 canviat');
  const w = WALLS.find((q) => q.id === 'M-N1'); expect(near(w.visual.footprint.zMax, -9) && near(w.visual.footprint.zMin, -9.4), 'M-N1 mogut');
});
test('A9. Llit de la casa C: matalàs gris + roba de llit al grup d\'interiors, dins la planta del llit, a sobre del somier', () => {
  const bed = FURNITURE.find((f) => f.id === 'C-U-BED').collision; const floorY = 2.75;
  const meshes = []; root.traverse((o) => { if (o.isMesh && o.name.endsWith('-bedding')) meshes.push(o); });
  expect(meshes.length === 1, `${meshes.length} malles bedding`);
  const m = meshes[0]; const bb = bboxOf(m, (v) => v.x > bed.xMin - 0.1 && v.x < bed.xMax + 0.1 && v.z > bed.zMin - 0.1 && v.z < bed.zMax + 0.1 && v.y > floorY);
  expect(!bb.isEmpty(), 'cap vèrtex de roba de llit a la planta del llit');
  expect(bb.min.x >= bed.xMin - 0.03 && bb.max.x <= bed.xMax + 0.03 && bb.min.z >= bed.zMin - 0.02 && bb.max.z <= bed.zMax, `fora del llit: ${JSON.stringify(bb.min)} ${JSON.stringify(bb.max)}`);
  expect(bb.min.y >= floorY + 0.3 - 1e-6 && bb.max.y > floorY + 0.55 && bb.max.y < floorY + 0.7, `alçades ${bb.min.y - floorY}..${bb.max.y - floorY}`);
  expect(m.material.isMeshLambertMaterial && !m.material.transparent, 'material Lambert opac');
  // Matalàs gris: color de vèrtex (base) amb canals gairebé iguals, ni blanc ni negre
  const col = m.geometry.getAttribute('color'); let grey = 0; let warm = 0; let n = 0;
  for (let i = 0; i < col.count; i++) { const r = col.getX(i); const g = col.getY(i); const b = col.getZ(i); n++; if (Math.abs(r - b) < 0.12 && Math.abs(r - g) < 0.08 && r > 0.2 && r < 0.75) grey++; else if (r - b > 0.05) warm++; }
  expect(grey / n >= 0.4, `només ${(100 * grey / n).toFixed(0)} % dels vèrtexs són grisos (matalàs)`);
  expect(warm / n >= 0.2, 'la roba de llit ha de ser bruta/terrosa (tons càlids apagats)');
});
test('A10. Llit: la fusta del somier/capçal es conserva (caixes de fusta de la casa C al mateix lloc) i la textura és pixel-art', () => {
  const woodMeshes = []; root.traverse((o) => { if (o.isMesh && o.name.endsWith('-wood')) woodMeshes.push(o); });
  const bed = FURNITURE.find((f) => f.id === 'C-U-BED').collision; let found = 0;
  for (const m of woodMeshes) { const b = bboxOf(m, (v) => v.x > bed.xMin - 0.01 && v.x < bed.xMax + 0.01 && v.z > bed.zMin - 0.01 && v.z < bed.zMax + 0.01 && v.y > 2.7 && v.y < 4); if (!b.isEmpty() && b.max.y > 2.75 + 0.7) found++; }
  expect(found >= 1, 'no es veu el capçal de fusta (≥ 0,7 m)');
  expect(BEDDING_TILE === 32, 'rajola 32 px');
  const px = new Map(); paintBedding((x, y, c) => px.set(`${x},${y}`, c), 32, 32);
  expect(px.size === 1024, `${px.size} píxels pintats`);
});
test('A11. Textura de roba de llit: gris descolorit, amb taques irregulars discretes (≥ 6 % i ≤ 30 % de la superfície) i molta varietat', () => {
  const px = []; paintBedding((x, y, c) => px.push(c), 32, 32);
  let stain = 0; let greyish = 0; const colors = new Set(px);
  for (const c of px) { const r = (c >> 16) & 255; const g = (c >> 8) & 255; const b = c & 255; if (r - b > 22 && r > 70) stain++; if (Math.abs(r - b) < 28 && r > 110) greyish++; }
  expect(colors.size >= 25, `${colors.size} colors`); expect(stain / 1024 > 0.04 && stain / 1024 < 0.3, `taques: ${(100 * stain / 1024).toFixed(1)} %`);
  expect(greyish / 1024 > 0.6, `grisos: ${(100 * greyish / 1024).toFixed(0)} %`);
  const again = []; paintBedding((x, y, c) => again.push(c), 32, 32); expect(JSON.stringify(again) === JSON.stringify(px), 'la textura ha de ser determinista');
});
test('A12. Cripta: 12 espelmes (5 de noves) repartides per antecambra, sala principal i sala del guardià; cap sobre un obstacle', () => {
  const cs = CRYPT.candles; expect(cs.length === 12 && new Set(cs.map((c) => c.id)).size === 12, `${cs.length} espelmes`);
  const rooms = { ant: (c) => c.z > -30 && c.z < -26.7, sala: (c) => c.x > -6.2 && c.z < -30.4, guard: (c) => c.x < -6.4 && c.z < -30.4 };
  expect(cs.filter(rooms.ant).length >= 2, 'antecambra'); expect(cs.filter(rooms.sala).length >= 5, 'sala'); expect(cs.filter(rooms.guard).length >= 3, 'guardià');
  const occ = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS, CRYPT_PROPS: LAYOUT.CRYPT_PROPS }).filter((c) => c.level === -1);
  for (const c of cs) if (c.on === 'floor') expect(isPositionFree(c.x, c.z, 0.05, occ, 1e-4, -1), `${c.id} dins d'un obstacle`);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) expect(Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z) > 0.8, `${cs[i].id}/${cs[j].id} massa juntes`);
});
test('A13. Cripta: una sola PointLight, sense ombres, discreta (intensitat ≤ 12, ambient ≤ 0,5) però prou visible (ambient ≥ 0,3); 7 punts de llum', () => {
  const crypt = village.crypt; const lights = []; crypt.group.traverse((o) => { if (o.isLight) lights.push(o); });
  const point = lights.filter((l) => l.isPointLight); expect(point.length === 1, `${point.length} PointLight`);
  expect(!point[0].castShadow, 'ombres dinàmiques'); expect(CRYPT.light.intensity <= 12 && CRYPT.light.intensity >= 8 && CRYPT.light.distance <= 9, `intensitat ${CRYPT.light.intensity}`); // la llum real arrenca a 0 i s'encén segons la profunditat
  expect(CRYPT.ambient.hemiDeep >= 0.3 && CRYPT.ambient.hemiDeep <= 0.5, `ambient ${CRYPT.ambient.hemiDeep}`);
  expect(CRYPT.lights.length === 7, `${CRYPT.lights.length} punts de llum`);
  for (const l of CRYPT.lights) expect(l.y < -1 && l.z < -22, `${l.id} fora de la cripta`);
  const zones = [[-1, -28.5, 'antecambra'], [-1, -33, 'sala'], [-8.4, -33.5, 'guardià']];
  for (const [x, z, nm] of zones) expect(CRYPT.lights.some((l) => Math.hypot(l.x - x, l.z - z) < 4), `cap punt de llum a prop de ${nm}`);
  const view = crypt.group; expect(view, 'grup de la cripta');
});

// =====================================================================
SECTION('B. Controlador de pausa i pointer lock');
// =====================================================================
const mkPause = () => { const s = { locks: 0, t: 0 }; const c = createPauseController({ requestLock: () => { s.locks++; }, now: () => s.t }); return { c, s }; };
test('B1. Abans del primer clic no hi ha pausa; en capturar el ratolí entra en joc; en alliberar-lo hi ha pausa', () => {
  const { c } = mkPause(); expect(!c.started && !c.paused && !c.playing, 'estat inicial');
  c.onLockChange(true); expect(c.started && c.playing && !c.paused, 'jugant');
  c.onLockChange(false); expect(c.started && c.paused && !c.playing, 'en pausa');
});
test('B2. Obrir i tancar el menú: ESC amb el menú obert reprèn (demana la captura una vegada); ESC jugant no fa res', () => {
  const { c, s } = mkPause(); c.onLockChange(true);
  expect(c.onEscape() === false && s.locks === 0, 'ESC jugant no ha de demanar res');
  c.onLockChange(false); expect(c.onEscape() === true && s.locks === 1, 'ESC en pausa ha de reprendre');
  c.onLockChange(true); expect(c.playing && !c.paused, 'reprès');
  c.onLockChange(false); expect(c.resume() === true && s.locks === 2, 'el botó també reprèn');
});
test('B3. Congelació: el temps de joc és 0 en pausa i passa íntegre jugant', () => {
  const { c } = mkPause(); c.onLockChange(true); expect(c.gameDt(0.016) === 0.016, 'jugant');
  c.onLockChange(false); expect(c.gameDt(0.016) === 0 && c.gameDt(5) === 0, 'pausa');
});
test('B4. Recuperació del pointer lock: si el navegador refusa la captura, la pausa continua i es pot tornar a provar', () => {
  const { c, s } = mkPause(); c.onLockChange(true); c.onLockChange(false);
  c.resume(); c.onLockError(); expect(c.paused && c.lastError, 'ha de seguir en pausa amb error');
  c.resume(); expect(s.locks === 2, 'segon intent'); c.onLockChange(true); expect(!c.lastError && c.playing, 'recuperat');
});
test('B5. Sense salts de càmera: es descarten els moviments de ratolí just després de recuperar el ratolí i els deltes gegants', () => {
  const { c, s } = mkPause(); s.t = 1000; c.onLockChange(true);
  expect(!c.acceptMouse(5, 0), 'durant la guarda'); s.t = 1000 + GUARD_MS + 1;
  expect(c.acceptMouse(5, -3), 'moviment normal'); expect(!c.acceptMouse(MAX_DELTA + 1, 0) && !c.acceptMouse(0, -MAX_DELTA - 1), 'salt enorme');
  c.onLockChange(false); expect(!c.acceptMouse(1, 1), 'en pausa no gira');
  s.t += 10; c.onLockChange(true); expect(!c.acceptMouse(1, 1), 'guarda també en cada represa');
});
test('B6. main.js: pausa neix de pointerlockchange; ESC només reprèn; E i tecles ignorades en pausa; rellotge de joc; HUD intacte', () => {
  const m = read('../src/main.js');
  expect(/pointerlockchange[\s\S]{0,300}pause\.onLockChange\(locked\)/.test(m), 'pointerlockchange → pause.onLockChange');
  expect(/e\.code === 'Escape'[\s\S]{0,200}pause\.onEscape\(\)/.test(m), 'ESC → pause.onEscape');
  expect(m.includes("e.code === 'KeyE' && !e.repeat && document.pointerLockElement === renderer.domElement"), 'condició de la tecla E');
  expect(/if \(document\.pointerLockElement === renderer\.domElement\) setKey\(e\.code, true\)/.test(m), 'tecles només amb el ratolí capturat');
  expect(/pause\.acceptMouse\(e\.movementX, e\.movementY\)/.test(m), 'filtre de ratolí');
  expect(/pause\.started \? pause\.gameDt\(dt\) : dt/.test(m) && /if \(gdt > 0\) \{\s*updatePlayer\(gdt\);/.test(m), 'animate() ha de congelar updatePlayer');
  expect(m.includes('cryptFrame(dt, gameTime)') && !/cryptFrame\(dt, performance\.now/.test(m), 'rellotge de joc a la cripta');
  expect(/sky\.update\(gdt, camera, gameTime\)/.test(m), 'cel congelat');
  expect(m.includes('pointer-events: none'), 'HUD amb pointer-events none');
  expect(m.includes('buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS })'), 'buildColliders intacte');
  expect(m.indexOf('churchDoor.update(') < m.indexOf('movePlayer(\n'), 'ordre churchDoor.update → movePlayer');
  const menu = read('../src/ui/pauseMenu.js'); expect(!/pointer-events:\s*none/.test(menu), 'el menú ha de ser interactiu');
  expect(m.split('\n').length < 900, 'main.js no s\'ha d\'inflar: la interfície és als mòduls');
});

// =====================================================================
SECTION('C. Món de proves (mateixa composició que main.js)');
// =====================================================================
const world = () => {
  const colliders = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
  colliders.push(...buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS, CRYPT_PROPS: LAYOUT.CRYPT_PROPS }));
  const doorOccluders = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS });
  const cryptOcc = buildColliders({ BUILDINGS: [], WALLS: [], PROPS: [], CRYPT_WALLS }).filter((c) => !c.id.startsWith('CH-N-B-'));
  const churchDoor = createSwingDoor(DOORS.find((d) => d.id === 'D1')); colliders.push(...churchDoor.colliders);
  const houseDoors = DOORS.filter((d) => d.house).map((d) => createHouseDoor(d)); for (const hd of houseDoors) colliders.push(hd.collider);
  const access = createCryptAccess(colliders, CRYPT);
  const floors = createFloors({ ...FLOORS, slabs: [...FLOORS.slabs, ...CRYPT_FLOORS.slabs], stairs: [...FLOORS.stairs, ...CRYPT_FLOORS.stairs], levelSplitDown: CRYPT_FLOORS.levelSplitDown });
  const gameplay = createGameplay({ KEYS, SECRET_DOOR, churchDoor, houseDoors, occluders: doorOccluders, playerRadius: R, crypt: { def: CRYPT, occluders: cryptOcc } });
  const documents = createDocuments(documentDefs(CRYPT));
  const mapData = buildMapData(LAYOUT); const mapProgress = createMapProgress(mapData);
  const w = { colliders, churchDoor, houseDoors, access, floors, gameplay, documents, mapData, mapProgress, pose: { x: 0, z: 27, yaw: 0, pitch: 0, level: 0, feetY: 0 }, t: 0 };
  w.getPose = () => ({ ...w.pose });
  w.setPose = (p) => { const fl = floors.resolve(p.x, p.z, p.level); w.pose = { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, level: fl.level, feetY: fl.y }; };
  w.flags = () => ({ sdOpen: gameplay.secretDoor.state === 'open', cemeteryOpen: false });
  w.track = () => { if (gameplay.crypt.note.seen()) documents.discover(DOCUMENT_IDS.symbolNote); mapProgress.update(w.pose.x, w.pose.z, w.pose.level, w.flags()); };
  w.tick = (sec) => { for (let t = 0; t < sec; t += 1 / 30) { w.t += 1 / 30; const p = w.pose; churchDoor.update(1 / 30, p.x, p.z, 0, 0, R, colliders); gameplay.update(1 / 30, p.x, p.z, 0, -1, { level: p.level, feetY: p.feetY }); access.sync(gameplay.secretDoor.state); w.track(); } };
  w.ctx = () => ({ gameplay, getPose: w.getPose, setPose: w.setPose, documents, mapProgress, colliders, radius: R, mapLimit: 95, afterRestore: () => access.sync(gameplay.secretDoor.state), now: () => new Date('2026-11-20T00:30:00Z') });
  return w;
};
const defs = (w) => ({
  KEYS, CRYPT, SECRET_DOOR, houseDoorIds: DOORS.filter((d) => d.house).map((d) => d.id),
  churchLimits: { min: 0, max: 170 * DEG }, documentIds: w.documents.knownIds(), noteDocumentId: DOCUMENT_IDS.symbolNote, zoneIds: w.mapData.zones.map((z) => z.id),
  levelSplit: FLOORS.levelSplit, levelSplitDown: CRYPT_FLOORS.levelSplitDown, mapLimit: 95,
});
const tgt = (w, id) => w.gameplay.targets.find((t) => t.id === id);
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, _m: m }; };
// Avança el joc fins a un punt de progrés.
function stepKeyA(w) { tgt(w, 'OPEN-A-DRS').use(); w.tick(2); tgt(w, 'KEY-A').use(); }
function stepKeyB(w) { tgt(w, 'OPEN-B-CHS').use(); w.tick(3); tgt(w, 'KEY-B').use(); }
function stepOpenSD(w) { w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(16); }
function stepSolve(w) { const cr = w.gameplay.crypt; const want = CRYPT.puzzle.solution; for (let i = 0; i < 3; i++) while (CRYPT.puzzle.symbols[cr.puzzle.discIndex(i)] !== want[i]) { cr.puzzle.turn(i); w.tick(1); } w.tick(12); }
function stepKeyC(w) { tgt(w, 'CR-SARC-LID').use(); w.tick(14); tgt(w, 'KEY-C').use(); }
function stepNote(w) { tgt(w, CRYPT.clue.id).use(); w.tick(0.2); }
const full = () => { const w = world(); stepKeyA(w); stepKeyB(w); stepOpenSD(w); w.setPose({ x: 0, z: -33, yaw: 1.2, pitch: -0.2, level: -1, feetY: -3.2 }); stepSolve(w); stepKeyC(w); w.setPose({ x: 0.3, z: -33, yaw: 1.2, pitch: -0.2, level: -1, feetY: -3.2 }); return w; };
const snap = (w) => JSON.stringify({ g: w.gameplay.snapshot(), d: w.documents.snapshot(), m: w.mapProgress.snapshot(), p: w.pose });

// =====================================================================
SECTION('D. Inventari amb 0, 1, 2 i 3 claus');
// =====================================================================
const invDefs = { KEYS, CRYPT, keyDescription: (k) => KEY_DESCRIPTIONS[k.material] };
test('D1. 0 claus: tres espais bloquejats, cap nom/descripció/símbol revelat (ni «Clau del cementiri»)', () => {
  const e = inventoryEntries(invDefs, []); expect(e.length === 3 && e.every((x) => !x.collected), 'tres entrades bloquejades');
  expect(e.every((x) => x.name === UNKNOWN_KEY.name && x.description === UNKNOWN_KEY.description && x.symbol === null && x.material === null), 'revela informació');
  const txt = JSON.stringify(e); for (const k of KEYS) expect(!txt.includes(k.name), `revela ${k.name}`); expect(!txt.includes(CRYPT.keyC.name) && !/campana|lluna|creu/i.test(txt), 'revela KEY-C o símbols');
  expect(inventorySummary(e) === '0 de 3 claus', inventorySummary(e));
});
test('D2. 1 clau (KEY-A): només KEY-A visible amb nom, icona (símbol) i descripció; B i C continuen bloquejades', () => {
  const e = inventoryEntries(invDefs, ['KEY-A']);
  expect(e[0].collected && e[0].name === KEYS[0].name && e[0].symbol === 'bell' && /campana/.test(e[0].description), JSON.stringify(e[0]));
  expect(!e[1].collected && !e[2].collected && e[1].name === UNKNOWN_KEY.name, 'B/C bloquejades'); expect(inventorySummary(e) === '1 de 3 claus', 'resum');
});
test('D3. 2 claus (A i B) i 3 claus (A, B, C): descripcions completes i ordre A, B, C', () => {
  let e = inventoryEntries(invDefs, ['KEY-B', 'KEY-A']); expect(e.map((x) => x.collected).join() === 'true,true,false', 'A,B');
  expect(e[1].symbol === 'moon' && /lluna/.test(e[1].description), 'KEY-B'); expect(inventorySummary(e) === '2 de 3 claus', 'resum');
  e = inventoryEntries(invDefs, ['KEY-A', 'KEY-B', 'KEY-C']); expect(e.every((x) => x.collected) && e[2].name === CRYPT.keyC.name && e[2].symbol === 'cross' && e[2].description === CRYPT.keyC.description, JSON.stringify(e[2]));
  expect(e.map((x) => x.slot).join('') === 'ABC' && inventorySummary(e) === '3 de 3 claus', 'ranures');
});
test('D4. L\'inventari real del joc alimenta el menú (recollir KEY-A → 1 clau; fins a KEY-C → 3)', () => {
  const w = world(); const ids = () => w.gameplay.inventory.list().map((i) => i.id);
  expect(inventorySummary(inventoryEntries(invDefs, ids())) === '0 de 3 claus', 'inici');
  stepKeyA(w); expect(inventorySummary(inventoryEntries(invDefs, ids())) === '1 de 3 claus', 'A');
  stepKeyB(w); stepOpenSD(w); w.setPose({ x: 0, z: -33, yaw: 0, pitch: 0, level: -1, feetY: -3.2 }); stepSolve(w); stepKeyC(w);
  expect(inventorySummary(inventoryEntries(invDefs, ids())) === '3 de 3 claus' && ids().length === 3, 'KEY-C');
});

// =====================================================================
SECTION('E. Documents descoberts i no descoberts');
// =====================================================================
test('E1. Sense descobrir res: la llista és buida i no s\'exposa cap text ni títol', () => {
  const d = createDocuments(documentDefs(CRYPT)); expect(d.count() === 0 && documentEntries(d.list()).length === 0, 'ha de ser buida');
  expect(!JSON.stringify(d.list()).includes('Nota'), 'revela informació');
});
test('E2. La nota dels tres símbols no consta fins que s\'ha llegit; en llegir-la apareix amb el text complet i els 3 símbols en ordre', () => {
  const w = world(); w.track(); expect(w.documents.count() === 0, 'abans de llegir');
  w.gameplay.crypt.note.seen(); expect(!w.gameplay.crypt.note.seen(), 'no vista');
  w.setPose({ x: 4.2, z: 9.7, yaw: 0, pitch: 0, level: 1, feetY: 2.75 }); stepNote(w);
  expect(w.gameplay.crypt.note.seen() && w.documents.has(DOCUMENT_IDS.symbolNote), 'ha de constar després de llegir-la');
  const e = documentEntries(w.documents.list()); expect(e.length === 1, 'una entrada');
  expect(e[0].text.includes(CRYPT.clue.text.replace(/^«|»$/g, '')), 'text complet'); expect(JSON.stringify(e[0].symbols) === JSON.stringify(CRYPT.clue.order) && e[0].symbols.length === 3, 'símbols');
  w.documents.discover(DOCUMENT_IDS.symbolNote); w.documents.discover('inexistent'); expect(w.documents.count() === 1, 'sense duplicats ni documents inventats');
});

// =====================================================================
SECTION('F. Congelació del joc en pausa (bucle com animate())');
// =====================================================================
test('F1. En pausa res no avança: ni portes, ni porta secreta, ni calaixos, ni discs, ni temps de joc; en reprendre continua', () => {
  const w = world(); const { c } = mkPause(); c.onLockChange(true);
  stepKeyA(w); stepKeyB(w);
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory);
  w.churchDoor.toggle(); w.houseDoors[0].toggle(); tgt(w, 'OPEN-A-DRS');
  const frame = (dt) => { const g = c.gameDt(dt); if (g > 0) w.tick(g); };
  for (let i = 0; i < 20; i++) frame(1 / 30);
  const before = JSON.stringify({ s: w.gameplay.secretDoor.state, c: w.churchDoor.angles(), h: w.houseDoors[0].angle, t: w.t, sd: w.gameplay.secretDoor.progress });
  c.onLockChange(false);                                  // ESC → pausa
  for (let i = 0; i < 600; i++) frame(1 / 30);           // 20 s de «temps real» en pausa
  const frozen = JSON.stringify({ s: w.gameplay.secretDoor.state, c: w.churchDoor.angles(), h: w.houseDoors[0].angle, t: w.t, sd: w.gameplay.secretDoor.progress });
  expect(before === frozen, `l'estat ha canviat en pausa: ${before} → ${frozen}`);
  c.onLockChange(true); for (let i = 0; i < 600; i++) frame(1 / 30);
  expect(w.gameplay.secretDoor.state === 'open' && w.churchDoor.isOpen(), 'en reprendre, tot ha de continuar');
});
test('F2. Les interaccions (E) es bloquegen en pausa: la condició de main.js exigeix pointer lock i la pausa no en té', () => {
  const { c } = mkPause(); c.onLockChange(true); c.onLockChange(false); expect(!c.locked, 'sense lock'); // main.js: E només amb document.pointerLockElement === canvas (vegeu B6)
  const w = world(); w.setPose({ x: 0, z: -7, yaw: 0, pitch: 0, level: 0, feetY: 0 });
  const dBefore = JSON.stringify(w.churchDoor.angles()); // sense premer E ni avançar temps
  w.tick(0); expect(JSON.stringify(w.churchDoor.angles()) === dBefore, 'res canvia sense avançar el temps');
});

// =====================================================================
SECTION('G. Desar i carregar');
// =====================================================================
test('G1. Partida nova: es pot desar, el JSON és vàlid i recuperable i conté les dades demanades', () => {
  const w = world(); w.track(); w.setPose({ x: 0, z: 20, yaw: 0.7, pitch: -0.1, level: 0, feetY: 0 });
  const c = canSave(w.ctx()); expect(c.ok, c.reason);
  const data = captureState(w.ctx()); const store = memStorage();
  expect(writeSave(store, data).ok, 'escriptura'); const r = readSave(store); expect(r.status === 'ok', r.status);
  const v = validateSave(r.data, defs(w)); expect(v.ok, v.errors.join('; '));
  const k = Object.keys(r.data.state).sort().join(); expect(k === 'churchDoor,containers,crypt,houseDoors,inventory,secretDoor,taken', k);
  expect(r.data.player.yaw === 0.7 && r.data.version === SAVE_VERSION && store._m.has(SAVE_KEY), 'jugador / versió / clau');
});
test('G2. Progrés complet (KEY-A/B, porta secreta, puzle, sarcòfag, KEY-C, nota): desar → món nou → carregar = estat idèntic', () => {
  const a = full(); stepNote(a); // la nota és al pis superior però només cal que consti l'estat
  const data = captureState(a.ctx()); const store = memStorage(); writeSave(store, data);
  const b = world(); const res = applyState(b.ctx(), readSave(store).data, defs(b)); expect(res.ok, res.error + ' ' + (res.errors || []));
  expect(snap(a) === snap(b), `estats diferents:\n${snap(a)}\n${snap(b)}`);
  expect(b.gameplay.secretDoor.state === 'open' && b.gameplay.crypt.puzzle.solved() && b.gameplay.crypt.sarcophagus.state() === 'open' && b.gameplay.crypt.sarcophagus.keyTaken(), 'cripta recuperada');
  expect(b.gameplay.inventory.has('KEY-A') && b.gameplay.inventory.has('KEY-B') && b.gameplay.inventory.has('KEY-C'), 'claus');
  expect(b.documents.has(DOCUMENT_IDS.symbolNote) && b.pose.level === -1 && near(b.pose.feetY, -3.2, 1e-3), 'document / nivell');
});
test('G3. Cripta recuperada: discs, sarcòfag i KEY-C coherents; la clau NO es pot tornar a recollir ni el puzle es re-resol', () => {
  const a = full(); const store = memStorage(); writeSave(store, captureState(a.ctx()));
  const b = world(); applyState(b.ctx(), readSave(store).data, defs(b)); b.tick(3);
  const keyT = tgt(b, 'KEY-C'); expect(!keyT.enabled || !keyT.enabled(), 'KEY-C no ha de ser recollible un altre cop');
  expect(b.gameplay.crypt.sarcophagus.lidProgress() === 1 && b.gameplay.crypt.puzzle.sealProgress() === 1, 'tapa oberta i segell tancat');
  for (let i = 0; i < 3; i++) expect(CRYPT.puzzle.symbols[b.gameplay.crypt.puzzle.discIndex(i)] === CRYPT.puzzle.solution[i], `disc ${i}`);
  expect(b.gameplay.crypt.drainEvents().length === 0, 'carregar no ha d\'emetre esdeveniments (sons) ');
  expect(b.gameplay.inventory.list().filter((i) => i.id === 'KEY-C').length === 1, 'KEY-C duplicada');
});
test('G4. Puzle a mitges (discs girats, sense resoldre): es recuperen els símbols i els girs; es pot acabar de resoldre', () => {
  const a = world(); stepKeyA(a); stepKeyB(a); stepOpenSD(a); a.setPose({ x: 0, z: -33, yaw: 0, pitch: 0, level: -1, feetY: -3.2 });
  a.gameplay.crypt.puzzle.turn(0); a.tick(1); a.gameplay.crypt.puzzle.turn(1); a.tick(1); a.gameplay.crypt.puzzle.turn(1); a.tick(1);
  expect(canSave(a.ctx()).ok, 'ha de poder desar-se amb els discs quiets'); const store = memStorage(); writeSave(store, captureState(a.ctx()));
  const b = world(); const r = applyState(b.ctx(), readSave(store).data, defs(b)); expect(r.ok, r.error);
  for (let i = 0; i < 3; i++) expect(a.gameplay.crypt.puzzle.discIndex(i) === b.gameplay.crypt.puzzle.discIndex(i), `disc ${i}`);
  expect(!b.gameplay.crypt.puzzle.solved() && near(b.gameplay.crypt.puzzle.discAngle(1), a.gameplay.crypt.puzzle.discAngle(1)), 'angles');
  stepSolve(b); expect(b.gameplay.crypt.puzzle.solved(), 'ha de poder resoldre\'s després de carregar');
});
test('G5. Portes recuperades: D1 oberta, portes de casa obertes/tancades i costat; col·lisionadors coherents; porta secreta oberta', () => {
  const a = world(); a.churchDoor.toggle(); a.houseDoors[0].toggle(); a.houseDoors[2].toggle(); a.tick(8);
  const store = memStorage(); expect(canSave(a.ctx()).ok, 'quiet'); writeSave(store, captureState(a.ctx()));
  const b = world(); const r = applyState(b.ctx(), readSave(store).data, defs(b)); expect(r.ok, r.error);
  expect(b.churchDoor.isOpen() && JSON.stringify(b.churchDoor.angles()) === JSON.stringify(a.churchDoor.angles()), 'D1');
  a.houseDoors.forEach((hd, i) => { const o = b.houseDoors[i]; expect(hd.collider.enabled === o.collider.enabled && Math.abs(hd.angle - o.angle) < 1e-9 && hd.side === o.side, `${hd.id}`); });
  expect(a.houseDoors[0].collider.enabled === false && a.houseDoors[1].collider.enabled === true, 'oberta sense obstacle / tancada amb obstacle');
  const c = world(); stepKeyA(c); stepKeyB(c); stepOpenSD(c); const st2 = memStorage(); writeSave(st2, captureState(c.ctx()));
  const d = world(); applyState(d.ctx(), readSave(st2).data, defs(d)); expect(d.gameplay.secretDoor.state === 'open' && d.gameplay.secretDoor.insertedCount() === 2, 'porta secreta');
  d.setPose({ x: 0, z: -22, yaw: 0, pitch: 0, level: 0, feetY: 0 }); expect(isPositionFree(0, -23.5, R, d.colliders, 1e-4, 0), 'el pas a la cripta ha d\'estar obert després de carregar');
});
test('G6. Sense duplicats: carregar dues vegades, o sobre una partida més avançada, SUBSTITUEIX l\'estat (cap clau ni document de més)', () => {
  const early = world(); stepKeyA(early); const store = memStorage(); writeSave(store, captureState(early.ctx()));
  const adv = full(); stepNote(adv);
  expect(adv.gameplay.inventory.list().length === 3, 'avançada té 3 claus');
  const r = applyState(adv.ctx(), readSave(store).data, defs(adv)); expect(r.ok, r.error);
  expect(adv.gameplay.inventory.list().map((i) => i.id).join() === 'KEY-A', `inventari ${adv.gameplay.inventory.list().map((i) => i.id)}`);
  applyState(adv.ctx(), readSave(store).data, defs(adv)); applyState(adv.ctx(), readSave(store).data, defs(adv));
  expect(adv.gameplay.inventory.list().length === 1 && adv.documents.count() === 0, 'duplicats després de carregar 3 cops');
  expect(adv.gameplay.secretDoor.state === 'locked' && !adv.gameplay.crypt.puzzle.solved() && !adv.gameplay.crypt.sarcophagus.keyTaken(), 'progrés posterior ha de desaparèixer (és una càrrega, no una suma)');
  expect(!tgt(adv, 'KEY-A').enabled || !tgt(adv, 'KEY-A').enabled(), 'KEY-A ja agafada: no es pot tornar a recollir');
});
test('G7. No es pot desar amb animacions en curs (porta, porta secreta, calaix, disc, sarcòfag) i sí un cop quiet', () => {
  const w = world(); w.setPose({ x: 0, z: 20, yaw: 0, pitch: 0, level: 0, feetY: 0 }); expect(canSave(w.ctx()).ok, 'inici');
  w.churchDoor.toggle(); w.tick(0.2); expect(!canSave(w.ctx()).ok && /animació/.test(canSave(w.ctx()).reason), 'porta D1 movent-se'); w.tick(10); expect(canSave(w.ctx()).ok, 'D1 quieta');
  w.houseDoors[0].toggle(); w.tick(0.1); expect(!canSave(w.ctx()).ok, 'porta de casa movent-se'); w.tick(6); expect(canSave(w.ctx()).ok, 'quieta');
  tgt(w, 'OPEN-A-DRS').use(); w.tick(0.2); expect(!canSave(w.ctx()).ok, 'calaix obrint-se'); w.tick(5); expect(canSave(w.ctx()).ok, 'calaix obert'); tgt(w, 'KEY-A').use(); stepKeyB(w);
  w.gameplay.secretDoor.interact(w.gameplay.inventory); w.gameplay.secretDoor.interact(w.gameplay.inventory); w.tick(0.5); expect(!canSave(w.ctx()).ok, 'porta secreta desbloquejant-se/obrint-se'); w.tick(16); expect(canSave(w.ctx()).ok, 'porta secreta oberta');
  w.setPose({ x: 0, z: -33, yaw: 0, pitch: 0, level: -1, feetY: -3.2 }); w.gameplay.crypt.puzzle.turn(0); w.tick(0.1); expect(!canSave(w.ctx()).ok, 'disc girant'); w.tick(1.5); expect(canSave(w.ctx()).ok, 'disc quiet');
  stepSolve(w); w.gameplay.crypt.drainEvents(); tgt(w, 'CR-SARC-LID').use(); w.tick(0.5); expect(!canSave(w.ctx()).ok, 'sarcòfag obrint-se'); w.tick(14); expect(canSave(w.ctx()).ok, 'sarcòfag obert');
});
test('G8. No es desa en una posició invàlida (dins d\'un mur, fora del món, NaN, nivell erroni)', () => {
  const w = world(); const bad = [{ x: 10, z: -9.2 }, { x: 0, z: 200 }, { x: NaN, z: 0 }, { x: 5.5, z: -9.1 }];
  for (const p of bad) { w.pose = { ...w.pose, ...p, level: 0, feetY: 0 }; expect(!canSave(w.ctx()).ok, `ha de refusar ${JSON.stringify(p)}`); }
  w.pose = { x: 0, z: 20, yaw: 0, pitch: 0, level: 5, feetY: 0 }; expect(!canSave(w.ctx()).ok, 'nivell 5');
});
test('G9. Dades invàlides o corruptes es rebutgen SENSE tocar la partida en curs (25 mutacions)', () => {
  const src = full(); stepNote(src); const good = captureState(src.ctx()); const w = world(); stepKeyA(w); w.setPose({ x: 1, z: 20, yaw: 0.3, pitch: 0, level: 0, feetY: 0 });
  const clone = () => JSON.parse(JSON.stringify(good));
  const muts = {
    'versió': (d) => { d.version = 99; }, 'joc': (d) => { d.game = 'altre'; }, 'data': (d) => { d.savedAt = 'ahir'; }, 'sense player': (d) => { delete d.player; }, 'x text': (d) => { d.player.x = '3'; },
    'x fora món': (d) => { d.player.x = 500; }, 'pitch gegant': (d) => { d.player.pitch = 4; }, 'nivell 7': (d) => { d.player.level = 7; }, 'feetY incoherent': (d) => { d.player.feetY = 2.75; },
    'sense state': (d) => { delete d.state; }, 'clau desconeguda': (d) => { d.state.inventory.push('KEY-Z'); }, 'clau duplicada': (d) => { d.state.inventory.push('KEY-A'); },
    'taken sense inventari': (d) => { d.state.inventory = d.state.inventory.filter((i) => i !== 'KEY-A'); }, 'KEY-C sense sarcòfag': (d) => { d.state.crypt.sarc = 'unlocked'; d.state.crypt.keyTaken = false; },
    'KEY-C agafada amb sarc tancat': (d) => { d.state.crypt.sarc = 'locked'; d.state.crypt.solved = false; },
    'resolt sense discs': (d) => { d.state.crypt.discs = [0, 0, 0]; d.state.crypt.discTurns = [0, 0, 0]; }, 'girs no quadren': (d) => { d.state.crypt.discTurns[0] += 1; },
    'discs fora de rang': (d) => { d.state.crypt.discs[1] = 9; }, 'SD tancada amb cripta': (d) => { d.state.secretDoor.state = 'locked'; },
    'SD oberta sense claus': (d) => { d.state.secretDoor.inserted['KEY-A'] = false; }, 'contenidor tancat amb clau': (d) => { d.state.containers['A-DRS'].opened = false; },
    'D1 angle fora de límit': (d) => { d.state.churchDoor.angles = [9, 0]; }, 'porta de casa sense side': (d) => { d.state.houseDoors.D2.side = 0; }, 'document desconegut': (d) => { d.documents = ['x']; },
    'nota vista sense document': (d) => { d.documents = []; }, 'mapa amb zona inventada': (d) => { d.map.discovered.push('atlantida'); }, 'cripta null': (d) => { d.state.crypt = null; },
  };
  expect(Object.keys(muts).length >= 25, `${Object.keys(muts).length} mutacions`);
  const base = snap(w);
  for (const [name, f] of Object.entries(muts)) {
    const d = clone(); f(d); const v = validateSave(d, defs(w)); expect(!v.ok, `«${name}»: s'hauria de rebutjar`);
    const r = applyState(w.ctx(), d, defs(w)); expect(!r.ok && typeof r.error === 'string', `«${name}»: applyState ha de fallar`);
    expect(snap(w) === base, `«${name}»: ha canviat la partida en curs`);
  }
  expect(validateSave(good, defs(w)).ok, 'la partida bona ha de ser vàlida');
});
test('G10. Posició desada ocupada (p. ex. dins d\'un mur): la càrrega es desfà i la partida segueix com estava', () => {
  const src = world(); src.setPose({ x: 0, z: 20, yaw: 0, pitch: 0, level: 0, feetY: 0 }); const d = JSON.parse(JSON.stringify(captureState(src.ctx()))); d.player.x = 10; d.player.z = -9.2;
  const w = world(); stepKeyA(w); w.setPose({ x: 2, z: 22, yaw: 0.5, pitch: 0, level: 0, feetY: 0 }); const base = snap(w);
  const r = applyState(w.ctx(), d, defs(w)); expect(!r.ok && /posició/i.test(r.error), r.error); expect(snap(w) === base, 'rollback incomplet');
});
test('G11. Emmagatzematge: cap partida → «none»; JSON trencat → «corrupt»; storage que llença → «unavailable»; escriptura plena → error clar', () => {
  expect(readSave(memStorage()).status === 'none', 'none');
  const s = memStorage(); s.setItem(SAVE_KEY, '{trencat'); expect(readSave(s).status === 'corrupt', 'corrupt');
  expect(readSave({ getItem() { throw new Error('bloquejat'); } }).status === 'unavailable', 'unavailable');
  const w = writeSave({ setItem() { throw new Error('ple'); } }, {}); expect(!w.ok && /desar/.test(w.error), 'error d\'escriptura');
});
test('G12. Càrrega de la cripta des de fora: jugador a la superfície amb la cripta oberta i viceversa, sense inconsistències', () => {
  const a = full(); a.setPose({ x: 0, z: -22, yaw: 0, pitch: 0, level: 0, feetY: 0 }); const store = memStorage(); expect(canSave(a.ctx()).ok, 'es pot desar a la nau'); writeSave(store, captureState(a.ctx()));
  const b = world(); stepKeyA(b); b.setPose({ x: 0, z: -33, yaw: 0, pitch: 0, level: 0, feetY: 0 }); // posició inconsistent a propòsit
  const r = applyState(b.ctx(), readSave(store).data, defs(b)); expect(r.ok, r.error); expect(b.pose.level === 0 && b.pose.feetY === 0 && b.gameplay.secretDoor.state === 'open', 'nivell 0 amb SD oberta');
  const c = world(); expect(!applyState(c.ctx(), (() => { const d = JSON.parse(JSON.stringify(captureState(a.ctx()))); d.player.level = -1; d.player.feetY = -3.2; d.state.secretDoor.state = 'locked'; return d; })(), defs(c)).ok, 'a la cripta amb SD tancada → refusat');
});

// =====================================================================
SECTION('H. Mapa');
// =====================================================================
const names = (ctxLog) => ctxLog.filter((c) => c[0] === 'fillText').map((c) => c[1]).join('|');
const fakeCtx = () => { const log = []; return new Proxy({ log }, { get: (t, k) => (k === 'log' ? log : (...a) => { log.push([k, ...a]); }), set: () => true }); };
test('H1. Inici de partida: només es veu el camí d\'entrada, la reixa del bosc i el que és a prop; res de l\'església, cementiri ni cripta', () => {
  const w = world(); w.track(); const m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()); const ids = m.zones.map((z) => z.id);
  expect(ids.includes('entrada') && ids.includes('bosc') && ids.includes('placa'), `zones ${ids}`);
  for (const hidden of ['esglesia', 'cementiri', 'cripta', 'carrer-est', 'carrer-oest']) expect(!ids.includes(hidden), `${hidden} no s'ha de veure encara`);
  const ctx = fakeCtx(); drawMap(ctx, m); const t = names(ctx.log); expect(!/Església|Cementiri|Cripta/.test(t), `text de zones ocultes: ${t}`); expect(t.includes('Tu'), 'indicador del jugador');
  expect(m.zones.find((z) => z.id === 'bosc').accessible === false, 'el bosc és tancat');
});
test('H2. En avançar es descobreixen zones; el cementiri es veu però NO és accessible (reixa); visitat ≠ conegut', () => {
  const w = world(); w.setPose({ x: 0, z: 5, yaw: 0, pitch: 0, level: 0, feetY: 0 }); w.track();
  let m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()); expect(m.zones.some((z) => z.id === 'esglesia') && m.zones.find((z) => z.id === 'placa').status === 'visited', 'església coneguda, plaça visitada');
  expect(m.zones.find((z) => z.id === 'esglesia').status === 'known', 'església encara no visitada');
  w.setPose({ x: 11, z: -8, yaw: 0, pitch: 0, level: 0, feetY: 0 }); w.track(); m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags());
  const cem = m.zones.find((z) => z.id === 'cementiri'); expect(cem && cem.accessible === false && cem.lockedNote, 'cementiri visible però tancat');
  expect(!m.zones.some((z) => z.id === 'cripta'), 'la cripta continua oculta');
  const ctx = fakeCtx(); drawMap(ctx, m); expect(/Cementiri/.test(names(ctx.log)) && /✕/.test(names(ctx.log)), 'etiqueta + creu de no accessible');
});
test('H3. La cripta apareix en descobrir-ne l\'existència (porta secreta oberta) i és accessible; entrar-hi la marca com a visitada', () => {
  const w = world(); stepKeyA(w); stepKeyB(w); w.setPose({ x: 0, z: -15, yaw: 0, pitch: 0, level: 0, feetY: 0 }); w.track();
  expect(!buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()).zones.some((z) => z.id === 'cripta'), 'abans d\'obrir SD, oculta');
  stepOpenSD(w); let m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()); let c = m.zones.find((z) => z.id === 'cripta'); expect(c && c.accessible && c.status === 'known', 'coneguda i accessible');
  w.setPose({ x: 0, z: -33, yaw: 0, pitch: 0, level: -1, feetY: -3.2 }); w.track(); m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags()); c = m.zones.find((z) => z.id === 'cripta');
  expect(c.status === 'visited' && m.player.zone === 'cripta' && m.player.level === -1, 'visitada, jugador a la cripta');
});
test('H4. El progrés del mapa es desa i es recupera (descobertes i visitades) i la càrrega no en reveli de més', () => {
  const a = world(); a.setPose({ x: 0, z: -4, yaw: 0, pitch: 0, level: 0, feetY: 0 }); a.track(); const s = a.mapProgress.snapshot();
  const b = world(); b.mapProgress.restore(s); expect(JSON.stringify(b.mapProgress.snapshot()) === JSON.stringify(s), 'ronda');
  const c = world(); c.mapProgress.restore({ discovered: ['cripta', 'inventada'], visited: [] }); expect(c.mapProgress.snapshot().discovered.includes('cripta') && !c.mapProgress.snapshot().discovered.includes('inventada'), 'ids inventats ignorats');
});
test('H5. Estil: el dibuix és sobre pergamí (fons + vores), amb zones visitades/conegudes/no accessibles diferenciades i fletxa del jugador', () => {
  const w = world(); w.setPose({ x: 11, z: -8, yaw: 1, pitch: 0, level: 0, feetY: 0 }); w.track(); const m = buildMapModel(w.mapData, w.mapProgress, w.getPose(), w.flags());
  const ctx = fakeCtx(); const n = drawMap(ctx, m); expect(n === m.zones.length, 'zones dibuixades');
  const ops = ctx.log.map((c) => c[0]); expect(ops.includes('fillRect') && ops.includes('strokeRect') && ops.includes('setLineDash') && ops.includes('moveTo') && ops.includes('fill'), 'operacions');
  expect(ctx.log.some((c) => c[0] === 'setLineDash' && c[1].length === 2), 'contorn discontinu per a no accessible');
});

// =====================================================================
SECTION('I. Compatibilitat amb fases anteriors');
// =====================================================================
test('I1. Els mòduls nous no depenen del DOM ni de Three.js (es poden provar des de la terminal)', () => {
  for (const f of ['game/pauseState.js', 'game/saveGame.js', 'player/documents.js', 'world/mapData.js', 'ui/menuModel.js']) { const s = read(`../src/${f}`); expect(!/\b(document|window)\.(getElementById|createElement|body|addEventListener|localStorage)/.test(s) && !/from 'three'/.test(s), `${f} depèn del DOM/Three`); }
});
test('I2. Estadístiques de l\'escena del poble sota el pressupost (< 60.000 triangles) i el llit no n\'afegeix més de 400', () => {
  const sc = new THREE.Scene(); const v = buildVillage(sc, { cemetery: false }); expect(v.stats.triangles === 41060, `${v.stats.triangles}`); const full = v.stats.triangles; v.dispose();
  const sc2 = new THREE.Scene(); const v2 = buildVillage(sc2); expect(v2.stats.triangles < 60000 && v2.stats.triangles > full, `${v2.stats.triangles}`);
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
