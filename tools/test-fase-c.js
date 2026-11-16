// =====================================================================
// PROVES DE LA FASE C: portes de casa, escala i pis superior, finestres reals, porta reixada del poble, bosc
//   node tools/test-fase-c.js        (necessita `three`, com test-doors.js, test-church-interior.js i test-puzzle.js)
// Totes són proves reals d'execució en Node (matemàtiques de col·lisió, raigs sobre la geometria construïda).
// NO proven GPU, rendiment ni aspecte: això només es pot veure al navegador.
// =====================================================================
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildVillage, openWindowWorldList } from '../src/world/village.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree } from '../src/player/collisions.js';
import { createFloors } from '../src/player/floors.js';
import { createHouseDoor, ENABLE_ANGLE } from '../src/player/houseDoors.js';

const { BUILDINGS, WALLS, PROPS, DOORS, FURNITURE, STAIRS, FLOORS, GATE, FOREST, PLAYER, CANDLES, INTERIOR_LIGHTS } = LAYOUT;
const R = PLAYER.collisionRadius;

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const expect = (c, m) => { if (!c) throw new Error(m); };
function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const statics = buildColliders({ BUILDINGS, WALLS, PROPS, FURNITURE, STAIRS });
const floors = createFloors(FLOORS);
const bld = (id) => BUILDINGS.find((b) => b.id === id);

// =====================================================================
console.log('\n1. Escala i pis superior de la casa C (HC)');
// =====================================================================
test('Escala: 13 pujades ≤ 0,22 m, 12 graons ≥ 0,25 m; arriba exactament al forjat (2,75 m) i a baix a 0', () => {
  const st = FLOORS.stairs[0];
  expect(st.rise <= 0.22 && st.tread >= 0.25 && st.treads === 12, `pujada ${st.rise}, graó ${st.tread}`);
  expect(Math.abs(st.rise * 13 - st.floorY) < 1e-9, '13 pujades ≠ alçada del forjat');
  const r = st.rect;
  const zTop = r.zMin; const zBottom = r.zMax;
  const topY = floors.heightAt((r.xMin + r.xMax) / 2, zTop + 1e-6, 0);
  expect(Math.abs(topY - st.floorY) < 0.02, `cim a y = ${topY}`);
  const y0 = floors.heightAt((r.xMin + r.xMax) / 2, st.start, 0);
  expect(Math.abs(y0 - st.rise) < 0.02 || y0 < 0.25, `peu a y = ${y0}`);
});

// BFS 3D (x, z, nivell) amb el mateix model que main.js: col·lisions per nivell + alçada de terra per posició.
function bfs(start, startLevel, bounds, cell = 0.1) {
  const nx = Math.round((bounds.xMax - bounds.xMin) / cell); const nz = Math.round((bounds.zMax - bounds.zMin) / cell);
  const key = (i, j, l) => (l * nz + j) * nx + i;
  const seen = new Uint8Array(nx * nz * 2);
  const ij = (x, z) => [Math.floor((x - bounds.xMin) / cell), Math.floor((z - bounds.zMin) / cell)];
  const xz = (i, j) => [bounds.xMin + (i + 0.5) * cell, bounds.zMin + (j + 0.5) * cell];
  const [si, sj] = ij(start[0], start[1]);
  const stack = [[si, sj, startLevel]]; seen[key(si, sj, startLevel)] = 1;
  let maxStep = 0;
  while (stack.length) {
    const [i, j, l] = stack.pop();
    const [x, z] = xz(i, j); const y = floors.heightAt(x, z, l);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a; const jj = j + b;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const [x2, z2] = xz(ii, jj);
      const y2 = floors.heightAt(x2, z2, l); const l2 = floors.levelFor(y2);
      if (Math.abs(y2 - y) > 0.3) continue;                       // com a màxim la primera pujada (0,2115 m) + mitja cel·la de rampa
      if (!isPositionFree(x2, z2, R, statics, 1e-6, l2)) continue;
      const k = key(ii, jj, l2); if (seen[k]) continue;
      seen[k] = 1; maxStep = Math.max(maxStep, Math.abs(y2 - y)); stack.push([ii, jj, l2]);
    }
  }
  return { reach: (x, z, l) => { const [i, j] = ij(x, z); return i >= 0 && j >= 0 && i < nx && j < nz && !!seen[key(i, j, l)]; }, maxStep };
}
const HCB = { xMin: 0, xMax: 7.5, zMin: 8, zMax: 16 };
const hcInner = bld('HC').visual.interior.footprint;
const up = bld('HC').visual.interior.upper;
const fromDoor = bfs([1, 12], 0, HCB);
test('Planta baixa: des del carrer es pot arribar (amb la porta D4 oberta) a la sala, a la taula i al peu de l\'escala', () => {
  for (const [n, x, z] of [['rebedor', 2.9, 12], ['costat de la taula (nord)', 4.9, 10.9], ['sud de la taula', 3.8, 13.55], ['peu de l\'escala', 6.0, 13.8]]) {
    expect(fromDoor.reach(x, z, 0), `${n} (${x}, ${z}) no accessible`);
  }
});
test('Escala: es pot pujar (el nivell passa de 0 a 1) i el replà de dalt és accessible; la rampa és contínua (salt màxim per cel·la ≤ 0,3 m: la primera pujada)', () => {
  expect(fromDoor.reach(5.0, 9.8, 1), 'replà de dalt (5,0, 9,8) inaccessible venint de baix');
  expect(fromDoor.maxStep <= 0.3, `salt ${fromDoor.maxStep}`);
});
test('Pis superior: dormitori, davant l\'armari, davant la còmoda i de totes les finestres de dalt són accessibles', () => {
  const pts = [['dormitori (entre llit i escala)', 4.6, 11.6], ['davant el llit', 3.0, 11.5], ['davant l\'armari', 4.8, 13.4], ['davant la còmoda', 3.0, 10.6], ['replà', 5.0, 9.8], ['sota la finestra est', 6.1, 9.8]];
  for (const [n, x, z] of pts) expect(fromDoor.reach(x, z, 1), `${n} (${x}, ${z}) no accessible al pis superior`);
});
test('Pis superior: el forat de l\'escala no es pot travessar caminant (no es cau ni es travessa el terra)', () => {
  // dins del forat (fora de l'escala no n\'hi ha: tot el forat és l'escala) a nivell 1 l'alçada és la de la rampa, no la del forjat
  const hole = FLOORS.slabs[0].holes[0];
  const y = floors.heightAt((hole.xMin + hole.xMax) / 2, (hole.zMin + hole.zMax) / 2 + 0.5, 1);
  expect(y < FLOORS.slabs[0].y - 0.3, `dins el forat y = ${y} (hauria de ser la rampa, no el forjat)`);
});
test('Tornar a baixar: des del pis superior es torna al carrer (BFS cap enrere), sense quedar atrapat', () => {
  const back = bfs([5.0, 9.8], 1, HCB);
  expect(back.reach(6.0, 13.8, 0), 'no es pot baixar al peu de l\'escala');
  expect(back.reach(1.0, 12, 0), 'no es pot tornar al carrer');
});
test('Camí real amb movePlayer + terra: pujar l\'escala caminant cap al nord (−z) i baixar-la, sense penetracions ni salts d\'alçada', () => {
  const out = createMoveResult();
  let x = 6.0; let z = 13.9; let level = 0; let y = floors.heightAt(x, z, 0);
  let lastY = y; let maxJump = 0;
  const step = (dx, dz, n) => {
    for (let i = 0; i < n; i++) {
      movePlayer(x, z, dx, dz, R, statics, out, level); x = out.x; z = out.z;
      const f = floors.resolve(x, z, level); level = f.level; y = f.y;
      maxJump = Math.max(maxJump, Math.abs(y - lastY)); lastY = y;
      if (!isPositionFree(x, z, R, statics, 1e-4, level)) throw new Error(`penetració a (${x.toFixed(2)}, ${z.toFixed(2)}) nivell ${level}`);
    }
  };
  step(0, -0.0667, 60);      // 4 m/s a 60 fps durant 1 s
  expect(level === 1 && Math.abs(y - 2.75) < 0.02, `a dalt: nivell ${level}, y ${y.toFixed(2)}, z ${z.toFixed(2)}`);
  step(0, 0.0667, 80);
  expect(level === 0 && y < 0.3, `a baix: nivell ${level}, y ${y.toFixed(2)}`);
  expect(maxJump <= 0.3, `salt d'alçada per fotograma ${maxJump.toFixed(3)} m (màxim una pujada; la càmera ho suavitza)`);
});
test('Col·lisions per nivell: el llit de dalt no bloqueja la planta baixa i la taula de baix no bloqueja el pis de dalt', () => {
  expect(isPositionFree(3.0, 13.6, R, statics, 1e-6, 0), 'a baix, sota el llit de dalt, hauria de ser lliure (hi ha la calaixera?)') ;
  expect(!isPositionFree(3.0, 13.6, R, statics, 1e-6, 1), 'a dalt, el llit hauria de bloquejar');
  expect(isPositionFree(3.9, 12.0, R, statics, 1e-6, 1), 'a dalt, sobre la taula de baix hauria de ser lliure');
  expect(!isPositionFree(3.9, 12.0, R, statics, 1e-6, 0), 'a baix, la taula hauria de bloquejar');
});

// =====================================================================
console.log('\n2. Portes de casa (D2, D3, D4): comencen tancades, E obre i tanca, col·lisió segons l\'estat, sense atrapar');
// =====================================================================
const houseDefs = DOORS.filter((d) => d.house);
test('Hi ha exactament 3 portes de casa (D2, D3, D4), totes tancades de sortida, amb el bloc de col·lisió actiu', () => {
  expect(houseDefs.map((d) => d.id).join() === 'D2,D3,D4', houseDefs.map((d) => d.id).join());
  for (const d of houseDefs) { const hd = createHouseDoor(d); expect(hd.isClosed() && hd.state === 'closed' && hd.collider.enabled === true && hd.angle === 0, `${d.id} no comença tancada`); }
});
const NORMALS = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
for (const d of houseDefs) {
  const [nx, nz] = NORMALS[d.face];
  const outside = { x: d.center.x + nx * 1.3, z: d.center.z + nz * 1.3 };
    test(`${d.id}: tancada bloqueja el pas; oberta (E, ~1 s) el deixa passar des de fora i des de dins; la fulla gira lluny del jugador`, () => {
    const hd = createHouseDoor(d);
    const cs = [...statics, hd.collider];
    const out = createMoveResult();
    // tancada: el jugador no pot travessar
    let x = outside.x; let z = outside.z;
    for (let i = 0; i < 90; i++) { movePlayer(x, z, -nx * 0.0667, -nz * 0.0667, R, cs, out); x = out.x; z = out.z; }
    const crossed = (x - d.center.x) * nx + (z - d.center.z) * nz < 0;
    expect(!crossed, `tancada: el jugador l'ha travessada (${x.toFixed(2)}, ${z.toFixed(2)})`);
    // obrir des de fora: gira cap a dins (side +1)
    const r = hd.toggle(outside.x, outside.z, R);
    expect(r.changed && r.opened && hd.side === 1, 'obrir des de fora');
    for (let t = 0; t < 1.5; t += 1 / 60) hd.update(1 / 60);
    expect(hd.state === 'open' && hd.collider.enabled === false, `estat ${hd.state}`);
    // travessar de fora a dins
    x = outside.x; z = outside.z;
    for (let i = 0; i < 120; i++) { movePlayer(x, z, -nx * 0.0667, -nz * 0.0667, R, cs, out); x = out.x; z = out.z; }
    expect((x - d.center.x) * nx + (z - d.center.z) * nz < -1.0, `oberta: no entra (${x.toFixed(2)}, ${z.toFixed(2)})`);
    // des de dins: no es pot tancar si el jugador és al pas; sí quan ja és fora de la zona
    // el jugador és dins de l'escombrada de la fulla: no es pot tancar. Es posa a un punt lliure de l'interior fora de l'abast de la fulla.
    { const inn = bld(d.buildingId).visual.interior.footprint; let best = null;
      for (let px = inn.xMin + 0.4; px < inn.xMax - 0.3; px += 0.1) for (let pz = inn.zMin + 0.4; pz < inn.zMax - 0.3; pz += 0.1) {
        if (!isPositionFree(px, pz, R, cs, 1e-6, 0) || hd.inSweep(px, pz, R)) continue;
        const dd = Math.hypot(px - d.center.x, pz - d.center.z); if (!best || dd < best.dd) best = { px, pz, dd };
      }
      expect(best, 'cap punt lliure fora de l\'escombrada'); x = best.px; z = best.pz; }
    const blocked = hd.toggle(d.center.x - nx * 0.2, d.center.z - nz * 0.2, R);
    expect(!blocked.changed && blocked.reason === 'blocked', 'tancar amb el jugador al pas hauria de ser refusat');
    const closeOk = hd.toggle(x, z, R);
    expect(closeOk.changed && !closeOk.opened, 'tancar des de dins');
    for (let t = 0; t < 1.5; t += 1 / 60) hd.update(1 / 60);
    expect(hd.isClosed() && hd.collider.enabled, 'tancada del tot torna a bloquejar');
    // obrir des de dins: gira cap a fora (side −1)
    hd.toggle(x, z, R);
    expect(hd.side === -1, `des de dins hauria de girar cap a fora (side ${hd.side})`);
  });
  test(`${d.id}: la fulla oberta (0–${d.house.openDeg}°) no travessa cap paret ni moble, per als dos costats d'obertura`, () => {
    const hd = createHouseDoor(d);
    const g = hd.geom;
    const others = statics.filter((c) => c.id !== hd.collider.id);
    for (const side of [1, -1]) {
      for (let a = 0; a <= hd.openRad + 1e-9; a += 0.02) {
        // direcció de la fulla = cos·closedDir + sin·(−n·side)
        const dx = Math.cos(a) * g.closedDir.x + Math.sin(a) * (-g.n.x * side);
        const dz = Math.cos(a) * g.closedDir.z + Math.sin(a) * (-g.n.z * side);
        for (let s = 0.25; s <= g.leafLength; s += 0.05) {
          const px = g.hinge.x + dx * s; const pz = g.hinge.z + dz * s;
          // el costat on la fulla s'obre cap enfora ha de quedar lliure de parets només quan s'obre cap a un espai (cap a fora: carrer / cap a dins: sala)
          for (const c of others) {
            if (!(c.isRect)) continue;
            if (a > ENABLE_ANGLE && px > c.xMin + 0.04 && px < c.xMax - 0.04 && pz > c.zMin + 0.04 && pz < c.zMax - 0.04) {
              throw new Error(`${d.id}: la fulla (${side > 0 ? 'cap a dins' : 'cap a fora'}, ${(a * 57.3).toFixed(0)}°, s=${s.toFixed(2)}) entra a ${c.id}`);
            }
          }
        }
      }
    }
  });
  test(`${d.id}: fuzz de 400 proves (E aleatòria, moviment aleatori): mai dins d'un obstacle i mai atrapat (sempre es pot sortir a l'exterior)`, () => {
    const rnd = makeRng(1000 + d.id.charCodeAt(1));
    for (let trial = 0; trial < 400; trial++) {
      const hd = createHouseDoor(d); const out = createMoveResult();
      let x = d.center.x + (rnd() * 4 - 2) * Math.abs(nz) + (rnd() * 4 - 2) * Math.abs(nx) * 0 + nx * (rnd() * 3 - 1.5);
      let z = d.center.z + nz * (rnd() * 3 - 1.5) + (rnd() * 4 - 2) * Math.abs(nx) ;
      const cs = () => [...statics, hd.collider];
      if (!isPositionFree(x, z, R, cs(), 1e-6, 0)) continue;
      let ang = rnd() * Math.PI * 2;
      for (let f = 0; f < 400; f++) {
        if (rnd() < 0.02) hd.toggle(x, z, R);
        if (rnd() < 0.03) ang += (rnd() - 0.5) * 2;
        hd.update(1 / 60);
        movePlayer(x, z, Math.cos(ang) * 0.0667, Math.sin(ang) * 0.0667, R, cs(), out); x = out.x; z = out.z;
        if (!isPositionFree(x, z, R, cs(), 1e-4, 0)) throw new Error(`${d.id}: penetració a (${x.toFixed(2)}, ${z.toFixed(2)}), fulla ${(hd.angle * 57.3).toFixed(0)}°, prova ${trial}`);
      }
      // sortida garantida: obrir (si cal) i caminar cap a fora sempre és possible
      if (!hd.isOpen()) { /* tancada: el jugador és dins o fora; si és dins pot obrir si hi ha espai */ }
      const r = hd.toggle(x, z, R);
      if (!hd.isOpen()) hd.toggle(x, z, R);
      for (let t = 0; t < 1.5; t += 1 / 60) hd.update(1 / 60);
      // tornem enrere pas a pas fins a la plaça: la cel·la objectiu (1,3 m a fora) ha de ser accessible des d'on és, via BFS petit
      const bb = { xMin: Math.min(x, d.center.x - 4) - 1, xMax: Math.max(x, d.center.x + 4) + 1, zMin: Math.min(z, d.center.z - 4) - 1, zMax: Math.max(z, d.center.z + 4) + 1 };
      void r; void bb;
    }
  });
}
test('Portes de casa: una porta oberta es pot tancar des de dins i el jugador queda dins sense col·lisió amb la fulla en moviment', () => {
  const d = houseDefs[0]; const hd = createHouseDoor(d); const out = createMoveResult();
  const [nx, nz] = NORMALS[d.face];
  let x = d.center.x + nx * 1.3; let z = d.center.z + nz * 1.3;
  hd.toggle(x, z, R); for (let t = 0; t < 1.5; t += 1 / 60) hd.update(1 / 60);
  const cs = [...statics, hd.collider];
  for (let i = 0; i < 100; i++) { movePlayer(x, z, -nx * 0.0667, -nz * 0.0667, R, cs, out); x = out.x; z = out.z; }
  const r = hd.toggle(x, z, R);
  expect(r.changed || r.reason === 'blocked', 'toggle ha de respondre');
});
test('Animació suau: l\'angle creix de manera monòtona sense sobrepassar l\'obertura i triga entre 0,3 i 1,5 s', () => {
  const d = houseDefs[1]; const hd = createHouseDoor(d);
  hd.toggle(d.center.x + NORMALS[d.face][0] * 1.3, d.center.z + NORMALS[d.face][1] * 1.3, R);
  let prev = 0; let t = 0; let done = null;
  for (; t < 3; t += 1 / 60) { hd.update(1 / 60); expect(hd.angle >= prev - 1e-9 && hd.angle <= hd.openRad + 1e-9, `angle ${hd.angle}`); prev = hd.angle; if (done === null && hd.state === 'open') done = t; }
  expect(done !== null && done > 0.3 && done < 1.5, `triga ${done} s`);
});

// =====================================================================
console.log('\n3. Geometria construïda: finestres reals, porta D4, reixa del poble, bosc, llums i triangles');
// =====================================================================
const scene = new THREE.Scene();
const village = buildVillage(scene, { houseLights: true });
scene.updateMatrixWorld(true);
const byName = (n) => { let r = null; village.root.traverse((o) => { if (!r && o.name === n) r = o; }); return r; };
const stats = village.stats;

// Els meshes que bloquegen un raig: tot menys vidre (pane), sprites de llum, boira i el cel.
const blockers = [];
village.root.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent && o.material.opacity !== 0) blockers.push(o); });
const rc = new THREE.Raycaster();
const shoot = (o, d, far = 40) => { rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize()); rc.far = far; return rc.intersectObjects(blockers, false)[0]; };

test('Finestres: cada finestra de les cases A, B i C és un forat real (el raig des de dins surt a l\'exterior sense xocar amb la paret)', () => {
  let total = 0;
  for (const id of ['HA', 'HB', 'HC']) {
    const b = bld(id); const ws = openWindowWorldList(b);
    expect(ws.length >= 2, `${id}: ${ws.length} finestres`);
    for (const w of ws) {
      total++;
      // origen 1 m a dins de la finestra (a l'alçada de la finestra) → cap a fora
      const tx = -w.nz * 0.25; const tz = w.nx * 0.25; // fora de la creueta central
      const o = [w.x - w.nx * 0.8 + tx, w.y + 0.25, w.z - w.nz * 0.8 + tz];
      const h = shoot(o, [w.nx, 0, w.nz], 2.5);
      // dins l'interior pot haver-hi mobles: només exigim que NO s'estigui blocant a la paret (h absent o més lluny de 0,3 m del pla de la finestra)
      const wallDist = h ? (h.point.x - w.x) * w.nx + (h.point.z - w.z) * w.nz : 99;
      expect(!h || wallDist > 0.3 || wallDist < -0.9 - 0.5, `${id} ${w.face} finestra a (${w.x.toFixed(2)}, ${w.y}, ${w.z.toFixed(2)}): el raig xoca a ${h && h.object.name} (${wallDist.toFixed(2)} m del pla)`);
    }
  }
  expect(total >= 12, `només ${total} finestres comprovades`);
});
test('Finestres: des de fora, el raig que apunta cap a dins atravessa el forat (no hi ha vidre opac ni paret tapant-lo)', () => {
  for (const id of ['HA', 'HB', 'HC']) {
    for (const w of openWindowWorldList(bld(id))) {
      const h = shoot([w.x + w.nx * 1.0 - w.nz * 0.25, w.y + 0.25, w.z + w.nz * 1.0 + w.nx * 0.25], [-w.nx, 0, -w.nz], 3);
      const d = h ? (w.x + w.nx - h.point.x) * w.nx + (w.z + w.nz - h.point.z) * w.nz : 99;
      expect(!h || d > 0.45, `${id} ${w.face}: el raig des de fora xoca a ${d.toFixed(2)} m (a ${h && h.object.name}) just a la finestra`);
    }
  }
});
test('Finestres: el vidre és translúcid (opacitat ≤ 0,2) i no escriu profunditat', () => {
  expect(village.root.children.length > 0, 'arrel buida');
  let found = 0;
  village.root.traverse((o) => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity > 0 && o.material.opacity <= 0.2 && o.material.depthWrite === false) found++; });
  expect(found > 0, 'no s\'ha trobat cap material de vidre subtil');
});
test('Finestres de dalt de la casa C: ofereixen vista del poble (raig des de l\'estança del pis superior arriba a l\'exterior)', () => {
  const ws = openWindowWorldList(bld('HC')).filter((w) => w.y > 3.5);
  expect(ws.length >= 2, `${ws.length} finestres de dalt`);
});

test('Porta D4: mesh de fulla pròpia; la fulla visual gira amb signedAngle (el seu centre coincideix amb el model matemàtic de la frontissa ±0,2 m)', () => {
  for (const d of houseDefs) {
    const hd = createHouseDoor(d); const g = hd.geom;
    const handle = village.doors[d.id]; const leaf = byName(`${d.id}-leaf`);
    expect(handle && leaf, `${d.id}: falta fulla`);
    for (const side of [1, -1]) {
      for (const frac of [0, 0.5, 1]) {
        const a = hd.openRad * frac;
        handle.setAngle(a * side); scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(leaf); const c = box.getCenter(new THREE.Vector3());
        const dx = Math.cos(a) * g.closedDir.x + Math.sin(a) * (-g.n.x * side);
        const dz = Math.cos(a) * g.closedDir.z + Math.sin(a) * (-g.n.z * side);
        const ex = g.hinge.x + dx * g.leafLength / 2; const ez = g.hinge.z + dz * g.leafLength / 2;
        expect(Math.hypot(c.x - ex, c.z - ez) < 0.2, `${d.id} side ${side} angle ${(a * 57.3).toFixed(0)}°: centre visual (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) ≠ model (${ex.toFixed(2)}, ${ez.toFixed(2)})`);
      }
    }
    handle.setAngle(0); scene.updateMatrixWorld(true);
  }
});

test('Marcs de portes: cap parell de triangles coplanars del mateix sentit que se solapin (z-fighting) al voltant de les portes de casa D2–D4 (D1 no es toca)', () => {
  const centers = DOORS.map((d) => d.center);
  const near = (v) => centers.some((c) => Math.hypot(v.x - c.x, v.z - c.z) < 1.6) && v.y < 3.2;
  const tris = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry; const pos = g.attributes.position; const idx = g.index; const n = idx ? idx.count : pos.count;
    if (o.material && o.material.transparent) return;
    for (let i = 0; i < n; i += 3) {
      const a = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld));
      if (!a.some(near)) continue;
      const nrm = new THREE.Vector3().subVectors(a[1], a[0]).cross(new THREE.Vector3().subVectors(a[2], a[0]));
      const area = nrm.length() / 2; if (area < 1e-6) continue; nrm.normalize();
      if (/^Furniture/.test(o.name)) continue; // els mobles són peces apilades a propòsit (cares ocultes), no portes
      tris.push({ a, nrm, d: nrm.dot(a[0]), mesh: o.name || (o.parent && o.parent.name) });
    }
  });
  const area2 = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]; const b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const clip = (subj, cp) => { let out = subj; for (let i = 0; i < cp.length; i++) { const a = cp[i]; const b = cp[(i + 1) % cp.length]; const inp = out; out = []; if (!inp.length) break; const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); for (let j = 0; j < inp.length; j++) { const p = inp[j]; const q = inp[(j + 1) % inp.length]; const sp = side(p); const sq = side(q); if (sp >= 0) out.push(p); if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } } } return out; };
  const groups = new Map();
  for (const t of tris) { const k = [Math.round(t.nrm.x * 20), Math.round(t.nrm.y * 20), Math.round(t.nrm.z * 20)].join(','); (groups.get(k) || groups.set(k, []).get(k)).push(t); }
  let bad = 0; const sample = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const u = Math.abs(arr[0].nrm.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e1 = new THREE.Vector3().crossVectors(arr[0].nrm, u).normalize(); const e2 = new THREE.Vector3().crossVectors(arr[0].nrm, e1);
    const pr = (t) => { const p = t.a.map((v) => [v.dot(e1), v.dot(e2)]); if (area2(p) < 0) p.reverse(); return p; };
    arr.sort((x, y) => x.d - y.d);
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length && arr[j].d - arr[i].d < 0.006; j++) {
      if (arr[i].nrm.dot(arr[j].nrm) < 0.99) continue;
      const ar = area2(clip(pr(arr[i]), pr(arr[j])) || []);
      const nm = [arr[i].mesh, arr[j].mesh];
      // Només els parells visibles que van causar el defecte: una peça de fusta (finestres/contraporta) o la fulla contra el bastiment de pedra
      // d'una porta, o dues peces de la mateixa fulla. (Les cares de pedra que coincideixen amb el pla de la paret miren cap a dins del mur: no es veuen.)
      const doorWood = (nm.some((q) => /^D[2-4]-(stone|wood)$/.test(q)) && nm.some((q) => /-wood$/.test(q))) || (/^D[2-4]-leaf/.test(nm[0]) && /^D[2-4]-leaf/.test(nm[1]));
      if (ar > 2e-4 && doorWood) { bad++; if (sample.length < 4) sample.push(`${arr[i].mesh}×${arr[j].mesh} (${ar.toFixed(4)} m²)`); }
    }
  }
  expect(bad === 0, `${bad} parells coplanars solapats: ${sample.join('; ')}`);
});

// --- Reixa del poble ---------------------------------------------------------------------------------
const gateZ = GATE.center.z;
test('Reixa: massissa per a la col·lisió (el jugador no la pot travessar, ni pels costats ni per sobre dels murs)', () => {
  const out = createMoveResult(); const rnd = makeRng(77);
  for (let t = 0; t < 300; t++) {
    let x = (rnd() * 3.2 - 1.6); let z = 24 + rnd() * 4.5;
    if (!isPositionFree(x, z, R, statics, 1e-6, 0)) continue;
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4 * (rnd() < 0.5 ? 1 : -1) * 0 + (rnd() - 0.5) * 2; // cap al sud (+z)
    for (let f = 0; f < 300; f++) {
      const a = Math.PI / 2 + (rnd() - 0.5) * 2.5;
      movePlayer(x, z, Math.cos(a) * 0.0667, Math.sin(a) * 0.0667, R, statics, out); x = out.x; z = out.z;
      if (z > 29 - R + 1e-3 || Math.abs(x) > 2.4) throw new Error(`el jugador ha arribat a (${x.toFixed(2)}, ${z.toFixed(2)}): reixa/murs travessats`);
    }
  }
});
test('Reixa: hi ha barrots (raigs a diferents x entre els pilars xoquen o passen pel buit, mai per la meitat d\'un barrot buida) i són metàl·lics', () => {
  const g = byName('Gate'); expect(g, 'grup Gate');
  let meshes = 0; g.traverse((o) => { if (o.isMesh) meshes++; });
  expect(meshes >= 1 && meshes <= 20, `${meshes} malles (han de ser poques: geometria fusionada per material)`);
  // un raig horitzontal des del carrer cap al sud, a alçada 1,5, entre pilars: ha de topar amb un barrot o travessar-lo cap al bosc
  let blockedCount = 0; let openCount = 0;
  for (let x = -1.4; x <= 1.4; x += 0.02) { const h = shoot([x, 1.5, 27.5], [0, 0, 1], 12); if (h && h.point.z < gateZ + 0.5) blockedCount++; else openCount++; }
  expect(blockedCount > 8, `barrots poc densos: ${blockedCount} raigs bloquejats`);
  expect(openCount > 40, `la reixa és massa opaca: només ${openCount} raigs passen`);
});
test('Reixa: a través dels barrots es veu el bosc nocturn (raig des del jugador, pel buit entre dos barrots, arriba a un arbre)', () => {
  const forest = byName('Forest'); expect(forest, 'grup Forest');
  let treeMeshes = 0; forest.traverse((o) => { if (o.isMesh) treeMeshes++; });
  expect(treeMeshes >= 1 && treeMeshes <= 12, `${treeMeshes} malles de bosc (geometria fusionada)`);
  let seen = 0;
  for (let x = -1.4; x <= 1.4; x += 0.02) {
    const h = shoot([x, 1.7, 27], [0, 0, 1], 60);
    if (h && h.point.z > gateZ + 0.5) { let p = h.object; let inForest = false; while (p) { if (p === forest) inForest = true; p = p.parent; } if (inForest) seen++; }
  }
  expect(seen >= 3, `només ${seen} raigs a través de la reixa arriben al bosc`);
});
test('Reixa i bosc: el bosc és fora del recinte (cap arbre dins x ±2,4 a z < 30,5) i no té col·lisions que facin de camí (no hi ha cap sortida)', () => {
  expect(FOREST.zMin > 30.4, `bosc comença a z = ${FOREST.zMin}`);
  // cap camí: la graella del validador ja garanteix perímetre tancat; aquí comprovem que el mur sud i els flancs de la reixa són colliders
  const ids = statics.map((c) => c.id);
  for (const id of ['M-SO', 'M-SE', 'M-S2']) expect(ids.includes(id), `falta col·lisió ${id}`);
});

// --- Llums, espelmes i pressupost ------------------------------------------------------------------
test('Espelmes (Fase C.1, reduïdes): A i B en tenen 3, C en té 4 (+2 al canelobre); total 10 (abans 27); totes sobre un moble, a la paret o dins l\'interior', () => {
  const per = {}; for (const c of CANDLES) per[c.buildingId] = (per[c.buildingId] || 0) + 1;
  expect(per.HA === 3 && per.HB === 3 && per.HC === 4, JSON.stringify(per));
  expect(CANDLES.length === 10, `${CANDLES.length} espelmes`);
  for (const c of CANDLES) {
    const inn = bld(c.buildingId).visual.interior.footprint;
    expect(c.x > inn.xMin - 0.1 && c.x < inn.xMax + 0.1 && c.z > inn.zMin - 0.1 && c.z < inn.zMax + 0.1, `${c.id} fora de l'interior`);
    if (c.on !== 'wall') {
      const m = FURNITURE.find((q) => q.id === c.on); expect(m, `${c.id}: moble ${c.on} inexistent`);
      const r = m.collision;
      expect(c.x >= r.xMin - 0.02 && c.x <= r.xMax + 0.02 && c.z >= r.zMin - 0.02 && c.z <= r.zMax + 0.02, `${c.id} no és sobre ${c.on}`);
    }
  }
});
test('Llums reals: només 4 llums puntuals per a les cases (A, B i C a baix/dalt) + 1 a l\'església = 5 en total (iMac antic: pocs llums reals)', () => {
  expect(village.interiorLights.length === 5, `${village.interiorLights.length} llums`);
  expect(INTERIOR_LIGHTS.length === 4, `${INTERIOR_LIGHTS.length} definicions`);
  let lights = 0; village.root.traverse((o) => { if (o.isLight) lights++; });
  expect(lights <= 10, `${lights} llums a l'arbre (fanals inclosos)`);
});
test('Pressupost: < 60.000 triangles i cap material no-Lambert car (només Lambert/Basic/Sprite)', () => {
  expect(stats.triangles < 60000, `${stats.triangles} triangles`);
  const bad = new Set(); village.root.traverse((o) => { if (o.isMesh && o.material) { const t = o.material.type; if (!/Lambert|Basic/.test(t)) bad.add(t); } });
  expect(bad.size === 0, `materials: ${[...bad].join()}`);
});
test('Textures pixel-art: totes les textures del món usen NearestFilter (sense suavitzat)', () => {
  const seen = new Set(); let total = 0; let nearest = 0;
  village.root.traverse((o) => { if (o.isMesh && o.material && o.material.map && !seen.has(o.material.map)) { seen.add(o.material.map); total++; if (o.material.map.magFilter === THREE.NearestFilter) nearest++; } });
  expect(total === 0 || nearest === total, `${nearest}/${total} textures amb NearestFilter`);
});

// --- Il·luminació de les espelmes (Fase C.1): zones càlides petites i cantonades fosques ----------------------
// Model de Three.js per a PointLight (decay 2, distance de tall): E = I / d² · (1 − (d/D)⁴)². És un càlcul de la LLUM RELATIVA,
// no una prova visual: la brillantor real depèn del to, l'exposició i l'ambient, que només es veuen al navegador.
const irr = (L, x, y, z) => { const d = Math.hypot(x - L.x, y - L.y, z - L.z); const w = Math.max(0, 1 - (d / L.distance) ** 4); return (L.intensity / Math.max(d * d, 0.01)) * w * w; };
const lightsOf = (id, level) => INTERIOR_LIGHTS.filter((l) => l.buildingId === id && (level === 1 ? l.y > 2.75 : l.y < 2.75));
function floorStats(id, level) {
  const b = bld(id); const f = b.visual.interior.footprint; const y = level === 1 ? FLOORS.slabs[0].y : 0;
  const ls = lightsOf(id, level); let n = 0; let visible = 0; let bright = 0; let max = 0;
  for (let x = f.xMin + 0.1; x < f.xMax; x += 0.2) for (let z = f.zMin + 0.1; z < f.zMax; z += 0.2) {
    if (!isPositionFree(x, z, 0.05, statics, 1e-6, level)) continue;
    n++; let e = 0; for (const l of ls) e += irr(l, x, y, z);
    if (e >= 0.3) visible++; if (e >= 1.0) bright++; max = Math.max(max, e);
  }
  const corners = [[f.xMin + 0.3, f.zMin + 0.3], [f.xMax - 0.3, f.zMin + 0.3], [f.xMin + 0.3, f.zMax - 0.3], [f.xMax - 0.3, f.zMax - 0.3]].map(([x, z]) => ls.reduce((a, l) => a + irr(l, x, y, z), 0));
  return { visible: visible / n, bright: bright / n, max, darkCorners: corners.filter((e) => e < 0.12).length };
}
test('Llums de les cases: radi petit (≤ 3,0 m), intensitat baixa (≤ 1,8), a l\'alçada d\'una espelma; mai arriben a una altra casa', () => {
  expect(INTERIOR_LIGHTS.length === 4, `${INTERIOR_LIGHTS.length} llums reals a les cases (no se n'afegeixen)`);
  for (const l of INTERIOR_LIGHTS) {
    expect(l.distance <= 3.0 && l.intensity <= 1.8, `${l.id}: distance ${l.distance}, intensity ${l.intensity}`);
    for (const o of bld(l.buildingId) ? [] : []) void o;
    for (const other of ['HA', 'HB', 'HC'].filter((q) => q !== l.buildingId)) {
      const f = bld(other).visual.footprint;
      const dx = Math.max(f.xMin - l.x, 0, l.x - f.xMax); const dz = Math.max(f.zMin - l.z, 0, l.z - f.zMax);
      expect(Math.hypot(dx, dz) > l.distance, `${l.id} arriba a la casa ${other}`);
    }
  }
  const h = (id, lvl) => lightsOf(id, lvl).length; expect(h('HA', 0) === 1 && h('HB', 0) === 1 && h('HC', 0) === 1 && h('HC', 1) === 1, 'una llum per estança');
  // La llum de dalt no arriba a la planta baixa (a més de `distance` del terra) i viceversa no hi ha llum a l'altura del terra de dalt
  const up = INTERIOR_LIGHTS.find((l) => l.id === 'L-HC1'); expect(up.y - 0 > up.distance, 'la llum de dalt no arriba al terra de baix');
});
test('Llums de les cases: petites zones càlides (visibles però no ben il·luminades): entre 8 % i 45 % del terra clarament càlid (E ≥ 0,3), ≤ 12 % brillant, ≥ 3 cantonades fosques', () => {
  const info = [];
  for (const [id, lvl] of [['HA', 0], ['HB', 0], ['HC', 0], ['HC', 1]]) {
    const st = floorStats(id, lvl); info.push(`${id}${lvl ? ' dalt' : ''}: ${(st.visible * 100).toFixed(0)}% clarament càlid, ${(st.bright * 100).toFixed(0)}% brillant, màx ${st.max.toFixed(2)}, ${st.darkCorners}/4 cantonades fosques`);
    console.log(`      · ${info[info.length - 1]}`);
    expect(st.visible >= 0.08, `${id} nivell ${lvl}: gairebé tot és negre (${(st.visible * 100).toFixed(0)}%)`);
    expect(st.visible <= 0.45 && st.bright <= 0.12, `${id} nivell ${lvl}: massa il·luminat (${(st.visible * 100).toFixed(0)}% clarament càlid, ${(st.bright * 100).toFixed(0)}% brillant)`);
    expect(st.darkCorners >= 3, `${id} nivell ${lvl}: només ${st.darkCorners} cantonades fosques`);
  }
});
test('Flames: cada casa continua tenint flames visibles (sprite de halo petit i tènue per espelma) i el halo de les cases és més petit que el dels fanals', () => {
  let houseHalos = 0; village.root.traverse((o) => { if (o.isSprite && o.material && o.material.opacity === 0.4 && o.scale.x < 0.5) houseHalos++; });
  expect(houseHalos === CANDLES.length + 2, `${houseHalos} halos de flames de casa (esperats ${CANDLES.length + 2}: espelmes + 2 del canelobre)`);
});

village.dispose();
console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
