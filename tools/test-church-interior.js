// =====================================================================
// PROVA DE L'INTERIOR DE L'ESGLÉSIA (Fase A)   node tools/test-church-interior.js
// =====================================================================
// A diferència de test-collisions.js (que només mira les col·lisions), aquesta
// prova construeix el poble de debò amb Three.js (sense navegador ni GPU: només
// geometria) i llança raigs contra les malles. Demostra que:
//   - la porta D1 és un forat real a la geometria i el pas té l'amplada del layout;
//   - l'interior és accessible: passadís, parets, paret del fons i sostre alt;
//   - el que es veu coincideix amb el que col·lisiona (les parets visibles són
//     exactament on les col·lisions diuen que hi ha paret);
//   - un jugador mogut per movePlayer() (les col·lisions reals) pot anar de
//     l'entrada del poble al fons de l'església i tornar sense travessar
//     CAP paret visible;
//   - les finestres són forats reals i dispose() ho allibera tot.
// Requereix el paquet `three` (el mateix que fa servir el joc). Surt amb codi 1
// si alguna prova falla.
// =====================================================================
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildVillage } from '../src/world/village.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree } from '../src/player/collisions.js';

const { BUILDINGS, DOORS, PLAYER } = LAYOUT;
const R = PLAYER.collisionRadius;
const EYE = PLAYER.eyeHeight;
const nave = BUILDINGS.find((b) => b.id === 'CH-N');
const IT = nave.visual.interior.footprint;           // interior lliure
const D1 = DOORS.find((d) => d.id === 'D1');
// Només l'ESTRUCTURA (parets, façana, pas de D1): els mobles i la porta secreta es proven a tools/test-puzzle.js.
const colliders = buildColliders({ BUILDINGS: LAYOUT.BUILDINGS, WALLS: LAYOUT.WALLS, PROPS: LAYOUT.PROPS });
const churchRects = nave.collision.map((c) => ({ ...c })); // CH-N-W, E, B, FW, FE

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
  if (!(Math.abs(actual - expected) <= tolerance)) throw new Error(`${label}: s'esperava ${expected} i s'ha obtingut ${actual}`);
}
const fmt = (n) => n.toFixed(3);
function makeRng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- escena
const scene = new THREE.Scene();
const village = buildVillage(scene);
const isUnder = (o, name) => { for (let p = o; p; p = p.parent) if (p.name === name) return true; return false; };
const solids = [];
// La decoració (molsa, herba) no és sòlida. Les fulles de D1 (pivots dinàmics) tampoc compten com a paret:
// la seva posició canvia i la prova d'aquest fitxer és de l'ESTRUCTURA fixa (les fulles es proven a test-doors.js).
// Tampoc compten els mobles, l'atrezzo interior de l'església (pilastres, espelmes) ni la porta secreta (Fase B).
const isFurnishing = (o) => isUnder(o, 'Furniture') || isUnder(o, 'ChurchDecor') || isUnder(o, 'SecretDoor');
village.root.traverse((o) => { if (o.isMesh && !isUnder(o, 'Decor') && !isFurnishing(o) && !(o.parent && o.parent.userData.dynamic)) solids.push(o); });
// Fase D.4: el mur nord de la nau té ara un forat real (gòtic) pel pas de la porta secreta, perquè des de la cripta no es vegi una paret grisa.
// Amb la porta tancada el forat el tanca la porta (que aquí s'exclou, com abans) i la col·lisió el tracta com a paret: per això, en aquesta prova
// de l'ESTRUCTURA, el forat es tapa amb un tac invisible que ocupa el gruix del mur (la porta tancada es prova a test-fase-d4.js, grup G).
{ const plug = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 0.4), new THREE.MeshBasicMaterial()); plug.position.set(0, 1.8, -20.6); village.root.add(plug); plug.updateMatrixWorld(true); solids.push(plug); }
const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); // només per als raigs: veu les dues cares
const originalMaterials = solids.map((m) => m.material);
solids.forEach((m) => { m.material = probeMaterial; });
const raycaster = new THREE.Raycaster();
const _o = new THREE.Vector3(); const _d = new THREE.Vector3();

// Primer impacte d'un raig (origen, direcció, distància màxima). null = camí lliure.
function cast(ox, oy, oz, dx, dy, dz, far) {
  _o.set(ox, oy, oz); _d.set(dx, dy, dz).normalize();
  raycaster.set(_o, _d);
  raycaster.near = 0; raycaster.far = far;
  const hits = raycaster.intersectObjects(solids, false);
  return hits.length ? hits[0] : null;
}
const nameOf = (hit) => (hit ? `${hit.object.name} a ${fmt(hit.distance)} m (${fmt(hit.point.x)}, ${fmt(hit.point.y)}, ${fmt(hit.point.z)})` : 'cap');

console.log('\nEsglésia: geometria visual (Three.js real) — Fase A');

// ============================================================ 1. estructura
console.log('\n1. Estructura i porta');
test('1. La nau té parets, terra, estructura de fusta, teulada i taques de llum', () => {
  const g = village.root.getObjectByName('CH-N');
  expect(g, 'no hi ha el grup CH-N');
  const names = g.children.map((c) => c.name);
  for (const k of ['stone', 'floor', 'wood', 'roof', 'moonPatch']) expect(names.includes(`CH-N-${k}`), `falta la malla CH-N-${k} (hi ha: ${names.join(', ')})`);
});
test('2. D1 és oberta i el seu grup visual no té cap fulla tancant el pas (les fulles són peces mòbils a part)', () => {
  expect(D1.state === 'open' && D1.enterable, 'D1 ha de ser oberta i enterable al layout');
  const g = village.root.getObjectByName('D1');
  expect(g, 'no hi ha el grup D1');
});

// ============================================================ 2. porta
console.log('\n2. La porta D1 és un pas real');
test('3. Raigs de la plaça cap al fons, per dins l\'obertura (5 posicions × 6 alçades): cap impacte fins a la paret del fons (z = −20,4)', () => {
  for (const x of [-0.9, -0.5, 0, 0.5, 0.9]) {
    for (const y of [0.3, 0.8, 1.2, EYE, 2.2, 2.8]) {
      const h = cast(x, y, -5, 0, 0, -1, 30);
      expect(h, `x=${x} y=${y}: el raig no arriba enlloc`);
      near(h.point.z, IT.zMin, 1e-3, `x=${x} y=${y}: primer impacte ${nameOf(h)}; paret del fons`);
    }
  }
});
test('4. Amplada exacta del pas: a ±1,08 m es passa; a ±1,12 m la façana (o el seu marc de pedra) ho impedeix', () => {
  for (const sgn of [-1, 1]) {
    const free = cast(sgn * 1.08, 1.0, -5, 0, 0, -1, 30);
    near(free.point.z, IT.zMin, 1e-3, `x=${sgn * 1.08}: ha de passar fins al fons; ${nameOf(free)}`);
    const blocked = cast(sgn * 1.12, 1.0, -5, 0, 0, -1, 30);
    expect(blocked && blocked.point.z > -9.01 && blocked.point.z < -8.85, `x=${sgn * 1.12}: ha de topar amb la façana/el marc a z ≈ −9; ${nameOf(blocked)}`);
  }
  near(D1.width, 2.2, 1e-9, 'amplada de D1');
});
test('5. L\'arc de la porta: a y = 3,0 el pas és més estret que a terra; a y = 3,6 (sobre la clau) no hi passa res', () => {
  const wideAtFloor = cast(0.95, 1.0, -5, 0, 0, -1, 30);
  near(wideAtFloor.point.z, IT.zMin, 1e-3, 'x=0,95 y=1,0');
  const narrowAtArch = cast(1.0, 3.0, -5, 0, 0, -1, 30);
  expect(narrowAtArch && narrowAtArch.point.z > -9.01, `x=1,0 y=3,0 ha de topar amb la façana (l'arc ja és més estret); ${nameOf(narrowAtArch)}`);
  const aboveArch = cast(0, 3.9, -5, 0, 0, -1, 30);
  expect(aboveArch && aboveArch.point.z > -9.01, `x=0 y=3,9 ha de topar amb la façana sobre l'arc; ${nameOf(aboveArch)}`);
});

// ============================================================ 3. interior
console.log('\n3. L\'interior és accessible i tancat');
test('6. Des del centre (z = −15): les parets E/W són a x = ±3 i la del fons a z = −20,4 (a tres alçades d\'ulls)', () => {
  for (const y of [0.5, 1.0, EYE]) {
    near(cast(0, y, -15, 1, 0, 0, 20).point.x, IT.xMax, 1e-3, `E y=${y}`);
    near(cast(0, y, -15, -1, 0, 0, 20).point.x, IT.xMin, 1e-3, `W y=${y}`);
    near(cast(0, y, -15, 0, 0, -1, 20).point.z, IT.zMin, 1e-3, `fons y=${y}`);
  }
});
test('7. La façana interior tanca a banda i banda de la porta (x = ∓2 → z = −9,6) i s\'obre cap a fora en x = 0', () => {
  // Sense les fulles mòbils (es proven a test-doors.js), la façana interior és a z = −9,6 a banda i banda del pas.
  for (const x of [-3, -2.6, -2, -1.5, 1.5, 2, 2.6, 3]) near(cast(x, 1.0, -15, 0, 0, 1, 20).point.z, IT.zMax, 1e-3, `x=${x}`);
  const out = cast(0, 1.0, -15, 0, 0, 1, 5.7); // fins a z = −9,3 (just dins la porta)
  expect(!out, `per x = 0 no hi ha d'haver res fins a la porta; ${nameOf(out)}`);
});
test('8. Sostre alt: des de dins no es toca res fins a més de 7,1 m i el sostre és a menys de 10,1 m', () => {
  for (const [x, z] of [[0, -14], [-2.9, -12], [2.9, -18], [1.5, -19.9], [0, -11.4]]) {
    const h = cast(x, EYE, z, 0, 1, 0, 20);
    expect(h, `(${x}, ${z}): el raig cap amunt no toca res (sostre obert?)`);
    expect(h.point.y > 7.1 && h.point.y < 10.1, `(${x}, ${z}): sostre a y = ${fmt(h.point.y)} (${h.object.name})`);
  }
});
test('9. Tres finestres a cada paret lateral: forats reals (el raig a y = 3 les travessa) d\'uns 0,9–1,05 m', () => {
  for (const [dir, label] of [[1, 'est'], [-1, 'oest']]) {
    const open = [];
    for (let z = IT.zMax - 0.02; z > IT.zMin; z -= 0.025) open.push({ z, free: !cast(0, 3.0, z, dir, 0, 0, 3.0 + 1.5) });
    const windows = [];
    let cur = null;
    for (const s of open) { // agrupa trams oberts separats per menys de 0,1 m (els barrots)
      if (s.free) { if (cur && cur.zEnd - s.z < 0.1) cur.zEnd = s.z; else { cur = { zStart: s.z, zEnd: s.z }; windows.push(cur); } }
    }
    expect(windows.length === 3, `paret ${label}: ${windows.length} finestres (s'esperaven 3)`);
    for (const w of windows) expect(w.zStart - w.zEnd > 0.85 && w.zStart - w.zEnd < 1.1, `paret ${label}: finestra de ${fmt(w.zStart - w.zEnd)} m`);
  }
});

// ============================================================ 4. coherència
console.log('\n4. El que es veu coincideix amb el que col·lisiona');
// Impacte analític d'un raig horitzontal contra els rectangles de col·lisió de l'església.
function analyticHit(ox, oz, dx, dz, maxT) {
  let best = Infinity;
  for (const r of churchRects) {
    let t0 = 0; let t1 = maxT;
    for (const [o, d, lo, hi] of [[ox, dx, r.xMin, r.xMax], [oz, dz, r.zMin, r.zMax]]) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
      let a = (lo - o) / d; let b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 <= t1 && t0 > 1e-9 && t0 < best) best = t0;
  }
  return best;
}
test('10. 4.000 raigs aleatoris des de dins (y ≤ 1,7): el primer impacte visible és a la distància de la primera paret de col·lisió', () => {
  const rng = makeRng(2024);
  const problems = [];
  let hitsWall = 0; let escapes = 0;
  for (let i = 0; i < 4000; i++) {
    const x = IT.xMin + 0.05 + rng() * (IT.xMax - IT.xMin - 0.1);
    const z = IT.zMin + 0.05 + rng() * (IT.zMax - IT.zMin - 0.1);
    const y = [0.5, 1.0, 1.4, EYE][Math.floor(rng() * 4)];
    const a = rng() * Math.PI * 2; const dx = Math.cos(a); const dz = Math.sin(a);
    // Es talla el raig al pla de la porta (z = −9): el que hi ha a l'altra banda (marc exterior, banc…) no compta.
    const tPlane = dz > 1e-9 ? (-9 - z) / dz : Infinity;
    const maxT = Math.min(40, tPlane);
    const expected = analyticHit(x, z, dx, dz, maxT);
    const got = cast(x, y, z, dx, 0, dz, maxT);
    if (expected < Infinity) {
      hitsWall++;
      // Les fulles de la porta (visuals, 12 cm) i el seu bastiment poden aparèixer una mica abans de la façana interior.
      const doorLeaf = got && got.object.parent && got.object.parent.name === 'D1';
      // La fulla ocupa 12 cm en Z: en un raig oblic la diferència de distància és 0,13 / |dz| (i el punt ha de ser a la franja de la fulla).
      const lo = doorLeaf ? expected - 0.13 / Math.max(Math.abs(dz), 0.05) : expected - 0.003;
      const leafOk = !doorLeaf || (got.point.z <= IT.zMax + 0.003 && got.point.z >= IT.zMax - 0.13);
      const unreachable = doorLeaf && z > IT.zMax - R; // origen a menys de R de la façana: el jugador no hi pot ser
      if (!unreachable && (!got || !leafOk || got.distance < lo || got.distance > expected + 0.003)) problems.push(`#${i} (${fmt(x)},${y},${fmt(z)}) dir ${fmt(a)}: col·lisió a ${fmt(expected)} m, visual ${nameOf(got)}`);
    } else {
      escapes++;
      // Una fulla oberta de D1 (12 cm) només pot tocar un raig que neix a menys de R de la façana: el centre del jugador
      // no hi pot ser (radi de col·lisió), per tant la fulla no pot travessar mai la càmera.
      // (o si la fulla es toca fora de l'amplada del pas: la fulla no pot mai tapar el pas, però sí que es veu de rasant al costat).
      const leafOutOfReach = got && got.object.parent && got.object.parent.name === 'D1'
        && (z > IT.zMax - R || Math.abs(got.point.x) >= D1.width / 2 - 1e-6);
      if (got && !leafOutOfReach) problems.push(`#${i} (${fmt(x)},${y},${fmt(z)}) dir ${fmt(a)}: la col·lisió deixa sortir però es veu ${nameOf(got)}`);
    }
  }
  expect(problems.length === 0, `${problems.length} discrepàncies; primera: ${problems[0]}`);
  console.log(`      (${hitsWall} raigs contra paret, ${escapes} que surten per la porta; cap discrepància)`);
});

// ============================================================ 5. recorregut real
console.log('\n5. Recorregut real amb les col·lisions: entrada del poble → fons de l\'església → sortida');
test('11. movePlayer() porta el jugador de (0, 27) fins al fons i el torna a la plaça, i cap tram del camí travessa geometria visible', () => {
  const waypoints = [
    [0, 12], [0, 8.3], [-3.2, 6], [-3.2, -6], [0, -6.5], [0, -8], // fins a la porta
    [0, -14], [0, -19.6],                                          // pel passadís fins al fons
    [-2, -19.6], [-2, -12], [0, -12], [0, -8], [0, -5],            // girar, tornar enrere i sortir
  ];
  const out = createMoveResult();
  let x = PLAYER.start.x; let z = PLAYER.start.z;
  const step = 0.08; // 4 m/s a 50 fps
  let frames = 0; let inside = false; let reachedBack = false; let backOutside = false;
  const problems = [];
  for (const [wx, wz] of waypoints) {
    let guard = 0;
    while (Math.hypot(wx - x, wz - z) > 0.15) {
      if (++guard > 1500) throw new Error(`el jugador no arriba al punt (${wx}, ${wz}); és a (${fmt(x)}, ${fmt(z)})`);
      const d = Math.hypot(wx - x, wz - z); const k = Math.min(step, d) / d;
      const dx = (wx - x) * k; const dz = (wz - z) * k;
      movePlayer(x, z, dx, dz, R, colliders, out);
      expect(isPositionFree(out.x, out.z, R, colliders), `posició dins d'un obstacle a (${fmt(out.x)}, ${fmt(out.z)})`);
      // Tram recorregut: tres alçades (turmells, cintura, ulls). No ha de topar amb cap malla.
      const len = Math.hypot(out.x - x, out.z - z);
      if (len > 1e-6) {
        for (const y of [0.3, 1.0, EYE]) {
          const h = cast(x, y, z, out.x - x, 0, out.z - z, len);
          if (h) problems.push(`fotograma ${frames}, y=${y}: el camí (${fmt(x)}, ${fmt(z)}) → (${fmt(out.x)}, ${fmt(out.z)}) travessa ${nameOf(h)}`);
        }
      }
      x = out.x; z = out.z; frames++;
      if (z < IT.zMax && x > IT.xMin && x < IT.xMax && z > IT.zMin) inside = true;
      if (z < -19.5) reachedBack = true;
      if (reachedBack && z > -9) backOutside = true;
    }
  }
  expect(problems.length === 0, `${problems.length} trams travessen geometria; primer: ${problems[0]}`);
  expect(inside && reachedBack, 'el jugador no ha arribat a entrar i arribar al fons');
  expect(backOutside, 'el jugador no ha tornat a sortir a la plaça');
  console.log(`      (${frames} fotogrames; ${problems.length} travessaments de geometria)`);
});

// ============================================================ 6. neteja
console.log('\n6. Memòria');
test('12. dispose() allibera geometries, materials i textures de tot el poble (inclòs l\'interior)', () => {
  // Es construeix un poble nou amb un <canvas> simulat perquè també es generin les textures.
  const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) });
  const previous = globalThis.document;
  globalThis.document = { createElement: fakeCanvas };
  let v2;
  try { v2 = buildVillage(new THREE.Scene()); } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
  const geos = new Set(); const mats = new Set(); const texs = new Set();
  v2.root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    for (const m of [].concat(o.material || [])) { mats.add(m); if (m.map) texs.add(m.map); }
  });
  const disposed = new Set();
  for (const r of [...geos, ...mats, ...texs]) r.addEventListener('dispose', () => disposed.add(r));
  const floorMesh = v2.root.getObjectByName('CH-N-floor');
  const patchMesh = v2.root.getObjectByName('CH-N-moonPatch');
  expect(floorMesh && patchMesh, 'falten les malles del terra o de les taques de llum');
  expect(floorMesh.material.map && patchMesh.material.map, 'el terra i les taques de llum haurien de tenir textura (amb canvas)');
  v2.dispose();
  const missing = [...geos, ...mats, ...texs].filter((r) => !disposed.has(r));
  expect(missing.length === 0, `${missing.length} recursos sense alliberar`);
  expect(!v2.root.parent, 'l\'arrel hauria d\'haver sortit de l\'escena');
  console.log(`      (${geos.size} geometries, ${mats.size} materials, ${texs.size} textures alliberats)`);
});

// ============================================================ neteja i resum
village.dispose();
probeMaterial.dispose();
originalMaterials.length = 0;
console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed === 0 ? 0 : 1);
