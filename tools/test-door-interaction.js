// =====================================================================
// PROVES D'INTERACCIÓ ESPACIAL AMB PORTES (Fase C.1)        node tools/test-door-interaction.js
// Matemàtiques pures (sense Three.js): distància ≤ 1,8 m, con de 60°, mateix pis i alçada, sense parets pel mig.
// Són proves automàtiques del càlcul; que la sensació sigui bona al joc només es pot veure al navegador.
// =====================================================================
import { BUILDINGS, WALLS, PROPS, DOORS, FURNITURE, STAIRS, FLOORS, SECRET_DOOR, KEYS } from '../src/world/layout.js';
import { buildColliders, makeCollider } from '../src/player/collisions.js';
import { createSwingDoor } from '../src/player/doors.js';
import { createHouseDoor } from '../src/player/houseDoors.js';
import { createGameplay } from '../src/player/puzzle.js';
import { canInteractSpatially, DOOR_INTERACTION } from '../src/player/interactions.js';
import { createFloors } from '../src/player/floors.js';

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } }
const expect = (c, m) => { if (!c) throw new Error(m); };

const occluders = buildColliders({ BUILDINGS, WALLS, PROPS: [], FURNITURE: [], STAIRS });
const floors = createFloors(FLOORS);
const D = (id) => DOORS.find((d) => d.id === id);
const NORMALS = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const dt = 1 / 60;

function newGame() {
  const houseDoors = DOORS.filter((d) => d.house).map((d) => createHouseDoor(d));
  const g = createGameplay({ KEYS, SECRET_DOOR, churchDoor: createSwingDoor(D('D1')), houseDoors, occluders });
  return { g, houseDoors };
}
// Mira cap a (dx, dz) amb un angle `off` (graus) de desviació.
const look = (dx, dz, off = 0) => { const a = Math.atan2(dz, dx) + (off * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; };
// Posició a `dist` m del punt d'interacció de la porta, davant seu (cap a fora o cap a dins) i mirant-lo.
// `dist` es mesura fins al PUNT D'INTERACCIÓ real (centre del pas, a mig gruix de la paret), no fins a la cara de la façana.
function at(door, dist, inside = false, lateral = 0) {
  const [nx, nz] = NORMALS[door.face]; const sgn = inside ? -1 : 1;
  const ip = createHouseDoor(door).interact;
  const px = ip.x + nx * dist * sgn - nz * lateral; const pz = ip.z + nz * dist * sgn + nx * lateral;
  return { px, pz, dir: look(ip.x - px, ip.z - pz) };
}
const view0 = { level: 0, feetY: 0 };

for (const id of ['D2', 'D3', 'D4']) {
  const door = D(id);
  test(`${id}: constants del sistema (1,8 m, con 60°) i la porta té interacció espacial; D1 no (queda com abans)`, () => {
    expect(DOOR_INTERACTION.maxDistance === 1.8 && DOOR_INTERACTION.coneDeg === 60, JSON.stringify(DOOR_INTERACTION));
    const { g } = newGame();
    expect(g.targets.find((t) => t.id === id).spatial, `${id} sense spatial`);
    expect(!g.targets.find((t) => t.id === 'D1').spatial, 'D1 ha de continuar sense restricció espacial');
  });
  for (const inside of [false, true]) {
    const where = inside ? 'des de dins' : 'des de fora';
    test(`${id} ${where}: a 1,5 m i mirant-la, SÍ es pot activar; la indicació «E — obrir la porta» apareix`, () => {
      const { g } = newGame(); const p = at(door, 1.5, inside);
      g.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0);
      expect(g.prompt === 'E — obrir la porta', `indicació «${g.prompt}»`);
      expect(g.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0) === id, 'E no ha activat la porta');
    });
    test(`${id} ${where}: a 1,79 m sí; a 1,85 m, 3 m i 6 m NO (cap indicació, E no fa res)`, () => {
      for (const [dist, ok] of [[1.79, true], [1.85, false], [3.0, false], [6.0, false]]) {
        const { g, houseDoors } = newGame(); const p = at(door, dist, inside);
        g.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0);
        expect((g.prompt === 'E — obrir la porta') === ok, `${dist} m: indicació «${g.prompt}»`);
        const r = g.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0);
        const h = houseDoors.find((q) => q.id === id);
        expect((r === id) === ok && (h.state !== 'closed' || h.angle > 0 || h.target > 0) === ok, `${dist} m: E ${r === id ? 'ha obert' : 'no ha fet res'}`);
      }
    });
    test(`${id} ${where}: si no mira cap a la porta NO s'activa (d'esquena, de costat, a 40°); a 25° sí (con de ±30°)`, () => {
      const p = at(door, 1.3, inside);
      const ip = createHouseDoor(door).interact; const toward = look(ip.x - p.px, ip.z - p.pz);
      for (const [off, ok] of [[0, true], [25, true], [-25, true], [40, false], [-40, false], [90, false], [180, false]]) {
        const { g } = newGame(); const d = look(toward[0], toward[1], off);
        g.update(dt, p.px, p.pz, d[0], d[1], view0);
        const r = g.pressE(p.px, p.pz, d[0], d[1], view0);
        expect((r === id) === ok, `desviació ${off}°: ${r === id ? 'activada' : 'no activada'} (s'esperava ${ok ? 'activada' : 'res'})`);
      }
    });
    test(`${id} ${where}: des del pis superior (mateix x,z, peus a 2,75 m, nivell 1) NO s'activa, mirant-la i a 0,8 m; a la planta baixa sí`, () => {
      const p = at(door, 0.9, inside);
      const upView = { level: 1, feetY: FLOORS.slabs[0].y };
      const { g } = newGame();
      g.update(dt, p.px, p.pz, p.dir[0], p.dir[1], upView);
      expect(g.prompt === '' && g.pressE(p.px, p.pz, p.dir[0], p.dir[1], upView) === null, 'activada des del pis superior');
      // només l'alçada (nivell 0 però peus a 2,75: p. ex. a l'escala) tampoc
      expect(g.pressE(p.px, p.pz, p.dir[0], p.dir[1], { level: 0, feetY: 2.0 }) === null, 'activada amb els peus a 2 m');
      expect(newGame().g.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0) === id, 'a la planta baixa hauria de funcionar');
    });
  }
}

test('Parets pel mig: amb un mur massís entre el jugador i la porta, E no fa res; sense el mur sí (mateixa posició, mateixa mirada)', () => {
  const door = D('D4'); const p = at(door, 1.5, false); const houseDoors = [createHouseDoor(door)];
  const wall = makeCollider('TEST-WALL', { type: 'rect', xMin: p.px + 0.4, xMax: p.px + 0.6, zMin: p.pz - 1, zMax: p.pz + 1 }); // entre el jugador (x = 0,7) i la porta
  const mk = (occ) => createGameplay({ KEYS, SECRET_DOOR, churchDoor: createSwingDoor(D('D1')), houseDoors: [createHouseDoor(door)], occluders: occ });
  void houseDoors;
  const clear = mk(occluders); const blocked = mk([...occluders, wall]);
  clear.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0); blocked.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0);
  expect(clear.prompt !== '', 'sense mur ha de ser activable');
  expect(blocked.prompt === '' && blocked.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0) === null, 'a través del mur no hauria de ser activable');
});
test('Parets reals: cap posició del carrer o de dins des d\'on la línia fins al punt de la porta travessi una paret massissa no activa la porta (graella de 0,1 m)', () => {
  let selectable = 0; let checked = 0;
  for (const id of ['D2', 'D3', 'D4']) {
    const door = D(id); const hd = createHouseDoor(door);
    for (let x = door.center.x - 2.2; x <= door.center.x + 2.2; x += 0.1) for (let z = door.center.z - 2.2; z <= door.center.z + 2.2; z += 0.1) {
      const dir = look(door.center.x - x, door.center.z - z);
      const ok = canInteractSpatially({ maxDistance: 1.8, coneCos: Math.cos(Math.PI / 6), level: 0, baseY: 0, maxDy: 0.5 }, hd.interact.x, hd.interact.z, x, z, dir[0], dir[1], { level: 0, feetY: 0, occluders });
      checked++;
      if (!ok) continue;
      selectable++;
      // si és activable, el segment cap a la porta no entra a cap rectangle de paret (excepte tangents)
      for (const c of occluders) {
        if (!c.isRect || c.level !== undefined && c.level !== 0) continue;
        const n = 40; for (let k = 0; k < n; k++) {
          const t = k / n; const sx = x + (hd.interact.x - x) * t; const sz = z + (hd.interact.z - z) * t;
          if (sx > c.xMin + 0.01 && sx < c.xMax - 0.01 && sz > c.zMin + 0.01 && sz < c.zMax - 0.01) throw new Error(`${id}: activable a (${x.toFixed(1)}, ${z.toFixed(1)}) amb ${c.id} pel mig`);
        }
      }
    }
  }
  expect(selectable > 50, `només ${selectable} posicions activables de ${checked}`);
});
test('Parets reals: des de l\'altre costat d\'una paret (p. ex. dins de la casa C, darrere de la paret nord, mirant cap al sud) la porta no és activable', () => {
  // Un punt a 1,7 m de D4 però a la banda de fora de la paret sud de la casa (z > 15), mirant cap al nord-oest cap a la porta (2,2; 12)
  const hd = createHouseDoor(D('D4'));
  const x = 1.6; const z = 13.6; // dins del carrer (x < 2), 1,7 m de la porta
  const dir = look(hd.interact.x - x, hd.interact.z - z);
  expect(canInteractSpatially({ maxDistance: 1.8, coneCos: Math.cos(Math.PI / 6), level: 0, baseY: 0, maxDy: 0.5 }, hd.interact.x, hd.interact.z, x, z, dir[0], dir[1], { level: 0, feetY: 0, occluders }) === false, 'des de (1,6; 13,6) la línia travessa la paret oest de la casa: no hauria d\'activar-se');
});

test('Les portes continuen obrint-se i tancant-se (E, ~1 s, col·lisió segons l\'estat) amb el sistema nou, des de fora i des de dins', () => {
  for (const id of ['D2', 'D3', 'D4']) {
    const door = D(id); const { g, houseDoors } = newGame(); const hd = houseDoors.find((q) => q.id === id);
    let p = at(door, 1.6, false);
    expect(hd.isClosed() && hd.collider.enabled, `${id} comença tancada`);
    expect(g.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0) === id, `${id}: E des de fora`);
    for (let t = 0; t < 1.5; t += dt) g.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0);
    expect(hd.isOpen() && hd.collider.enabled === false, `${id}: oberta, col·lisió inactiva`);
    expect(g.prompt === 'E — tancar la porta', `${id}: indicació «${g.prompt}»`);
    expect(g.pressE(p.px, p.pz, p.dir[0], p.dir[1], view0) === id, `${id}: E per tancar`);
    for (let t = 0; t < 1.5; t += dt) g.update(dt, p.px, p.pz, p.dir[0], p.dir[1], view0);
    expect(hd.isClosed() && hd.collider.enabled === true, `${id}: tornada a tancar`);
    // des de dins: obrir cap a fora (el jugador és dins però fora de l'escombrada: més lluny, mirant cap a la porta) — es prova només l'acció
    const q = at(door, 1.7, true);
    const r = g.pressE(q.px, q.pz, q.dir[0], q.dir[1], view0);
    expect(r === id && hd.side === -1, `${id}: E des de dins (side ${hd.side})`);
  }
});
test('Les altres interaccions no canvien: calaix, arca, claus, porta secreta i D1 funcionen igual sense `view` (i amb `view`, al pis que toca)', () => {
  const k = KEYS[0]; // calaix de la casa A
  const mk = () => createGameplay({ KEYS, SECRET_DOOR, churchDoor: createSwingDoor(D('D1')), houseDoors: [], occluders });
  const g = mk();
  const p = { x: k.pos.x, z: k.pos.z - 0.9 };
  g.update(dt, p.x, p.z, 0, 1);
  expect(g.pressE(p.x, p.z, 0, 1) === `OPEN-${k.container}`, 'obrir el calaix sense view');
  const g2 = mk(); g2.update(dt, p.x, p.z, 0, 1, { level: 1, feetY: 2.75 });
  expect(g2.pressE(p.x, p.z, 0, 1, { level: 1, feetY: 2.75 }) === `OPEN-${k.container}`, 'els contenidors no depenen del pis (només les portes de casa)');
  // porta secreta (examinar) i D1 (obrir) des de la seva distància habitual
  const g3 = mk(); expect(g3.pressE(SECRET_DOOR.center.x, SECRET_DOOR.center.z + 1.6, 0, -1) === SECRET_DOOR.id, 'porta secreta');
  const g4 = mk(); const d1 = D('D1'); expect(g4.pressE(d1.center.x, d1.center.z + 2.6, 0, -1, view0) === 'D1' || g4.pressE(d1.center.x, d1.center.z - 2.6, 0, 1, view0) === 'D1', 'D1 es continua activant a la seva distància original (2,6 m)');
});
test('Pis superior real: caminant fins al replà de dalt (nivell 1), E mirant cap avall a D4 no fa res', () => {
  const door = D('D4'); const { g, houseDoors } = newGame(); const hd = houseDoors.find((q) => q.id === 'D4');
  const x = 3.0; const z = 12.0; // damunt de la sala del rebedor, al pis superior
  const f = floors.resolve(x, z, 1);
  expect(f.level === 1 && Math.abs(f.y - 2.75) < 0.01, `nivell ${f.level} y ${f.y}`);
  const dir = look(door.center.x - x, door.center.z - z);
  g.update(dt, x, z, dir[0], dir[1], { level: f.level, feetY: f.y });
  expect(g.pressE(x, z, dir[0], dir[1], { level: f.level, feetY: f.y }) === null && hd.isClosed(), 'D4 s\'ha activat des del pis superior');
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
