// =====================================================================
// PROVA DE LA PORTA FÍSICA DE L'ESGLÉSIA (D1)      node tools/test-doors.js
// =====================================================================
// Simula el joc sense navegador: el jugador es mou amb movePlayer() (les col·lisions
// reals), la porta es mou amb createSwingDoor() (src/player/doors.js, la mateixa
// que fa servir main.js) i, per a la part visual, es construeix el poble amb Three.js
// (sense GPU). Demostra que:
//   - la porta comença mig oberta i s'hi entra i en surt sense prémer E;
//   - si el jugador camina contra les fulles, s'obren físicament (i mai el travessen);
//   - E obre i tanca, amb una animació suau, amb límits d'angle i només a prop;
//   - la col·lisió segueix la fulla a cada fotograma (la fulla dibuixada coincideix);
//   - una porta que no pot obrir-se (tancada de veritat) no es pot travessar des de cap costat;
//   - cap fulla toca mai les parets i el pas de 2,2 m continua lliure;
//   - cap combinació aleatòria de moviment + E fa que el jugador quedi dins de la fusta;
//   - dispose() allibera les fulles. Surt amb codi 1 si alguna prova falla.
// =====================================================================
import fs from 'node:fs';
import * as THREE from 'three';
import * as LAYOUT from '../src/world/layout.js';
import { buildVillage } from '../src/world/village.js';
import { buildColliders, movePlayer, createMoveResult, isPositionFree, collidersOverlap } from '../src/player/collisions.js';
import { createSwingDoor } from '../src/player/doors.js';

const { DOORS, PLAYER } = LAYOUT;
const R = PLAYER.collisionRadius;
const D1 = DOORS.find((d) => d.id === 'D1');
const SW = D1.swing;
const DEG = Math.PI / 180;
const deg = (r) => (r / DEG).toFixed(1);
const staticColliders = buildColliders(LAYOUT);

// ---------------------------------------------------------------- harness
let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function expect(c, m) { if (!c) throw new Error(m); }
function makeRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- simulació
const DT = 1 / 60;
const res = createMoveResult();
function makeWorld(def = D1) {
  const door = createSwingDoor(def);
  return { door, cols: [...staticColliders, ...door.colliders], violations: 0, nudges: 0 };
}
// Un fotograma: la porta primer, el jugador després (exactament com updatePlayer a main.js).
function frame(w, p, mx, mz, dt = DT, withColliders = true) {
  const st = w.door.update(dt, p.x, p.z, mx, mz, R, withColliders ? w.cols : null);
  if (st.nudged) { p.x = st.x; p.z = st.z; w.nudges++; } // la fulla animada ha empès el jugador (com fa main.js)
  movePlayer(p.x, p.z, mx, mz, R, w.cols, res);
  p.x = res.x; p.z = res.z;
  if (!isPositionFree(p.x, p.z, R, w.cols, 1e-5)) w.violations++;
  return res;
}
// Camina en línia recta cap a (tx, tz) a `speed` m/s; retorna els fotogrames fets.
function walkTo(w, p, tx, tz, { speed = 4, maxFrames = 900 } = {}) {
  let n = 0;
  for (; n < maxFrames; n++) {
    const dx = tx - p.x; const dz = tz - p.z; const d = Math.hypot(dx, dz);
    if (d < 1e-3) break;
    const s = Math.min(speed * DT, d);
    frame(w, p, (dx / d) * s, (dz / d) * s);
  }
  return n;
}
function idle(w, p, seconds) { for (let i = 0; i < Math.round(seconds / DT); i++) frame(w, p, 0, 0); }
const angles = (w) => w.door.angles().map(deg).join('°, ') + '°';

console.log('\nPorta física de D1 (Fase A2)');

// ============================================================ 1. estat inicial
console.log('\n1. Estat inicial');
test('1. La porta comença MIG OBERTA (entre el límit tancat i l\'obert) i amb límits definits', () => {
  const w = makeWorld();
  const [a, b] = w.door.angles();
  near(a, SW.initialAngleDeg * DEG); near(b, SW.initialAngleDeg * DEG);
  expect(a > 30 * DEG && a < 140 * DEG, `l'angle inicial ${deg(a)}° no és "mig obert"`);
  expect(w.door.minAngle === SW.minAngleDeg * DEG && w.door.maxAngle === SW.maxAngleDeg * DEG, 'límits d\'angle');
  expect(w.door.maxAngle <= Math.PI && w.door.minAngle >= 0, 'els límits han de ser dins de 0°–180°');
  expect(w.door.colliders.length === 2 && w.door.colliders.every((c) => c.isSegment), 'una col·lisió (segment) per fulla');
});
function near(a, b, tol = 1e-9) { expect(Math.abs(a - b) <= tol, `s'esperava ${b} i hi ha ${a}`); }

// ============================================================ 2. entrar/sortir sense E
console.log('\n2. Entrar i sortir sense prémer E');
test('2. Entrar caminant (x = −0,5…0,5) de la plaça al fons: arriba, sense prémer E i sense tocar les fulles', () => {
  for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) {
    const w = makeWorld(); const p = { x, z: -3 };
    walkTo(w, p, x, -16);
    expect(Math.abs(p.z + 16) < 0.01, `x=${x}: s'ha parat a z=${p.z.toFixed(2)}`);
    expect(w.violations === 0, `x=${x}: ${w.violations} fotogrames dins de la fusta`);
    near(w.door.leaves[0].angle, SW.initialAngleDeg * DEG); near(w.door.leaves[1].angle, SW.initialAngleDeg * DEG);
  }
});
test('3. Entrar en diagonal (des de (−2,5; −3) i (2,5; −3) cap al fons) i sortir: mai dins la fusta ni les parets', () => {
  for (const sx of [-2.5, 2.5]) {
    const w = makeWorld(); const p = { x: sx, z: -3 };
    walkTo(w, p, 0, -9); walkTo(w, p, 0, -16); // enfila el pas i segueix
    expect(p.z < -15.9, `no ha arribat dins: z=${p.z.toFixed(2)}`);
    walkTo(w, p, 0, -9); walkTo(w, p, sx, -3);  // torna cap al carrer
    expect(p.z > -3.5, `no ha tornat a sortir: z=${p.z.toFixed(2)}`);
    expect(w.violations === 0, `${w.violations} fotogrames dins d'un obstacle`);
  }
});
test('4. Sortir de dins cap a la plaça amb la porta mig oberta: lliurement', () => {
  const w = makeWorld(); const p = { x: 0.3, z: -15 };
  walkTo(w, p, 0, -2);
  expect(p.z > -2.01 && w.violations === 0, `ha acabat a z=${p.z.toFixed(2)}, violacions ${w.violations}`);
});

// ============================================================ 3. empenta
console.log('\n3. Empènyer les fulles caminant-hi');
test('5. Porta TANCADA: caminar-hi des de fora la fa girar cap a dins i el jugador passa, sense travessar mai la fusta', () => {
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const w = makeWorld(); w.door.setAngles(0, 0); const p = { x, z: -3 };
    walkTo(w, p, x, -16, { speed: 4 });
    expect(p.z < -15.9, `x=${x}: no ha pogut entrar (z=${p.z.toFixed(2)}); angles ${angles(w)}`);
    expect(w.violations === 0, `x=${x}: ${w.violations} fotogrames dins de la fusta`);
    expect(w.door.leaves.some((l) => l.angle > 20 * DEG), `x=${x}: les fulles no s'han obert (${angles(w)})`);
  }
});
test('6. Les fulles s\'obren PROGRESSIVAMENT (no d\'un cop) i el jugador queda alentit contra la fusta', () => {
  const w = makeWorld(); w.door.setAngles(0, 0); const p = { x: 0, z: -8 };
  let prev = 0; let maxJump = 0; let contact = 0;
  for (let i = 0; i < 240; i++) {
    const r = frame(w, p, 0, -4 * DT);
    const a = w.door.leaves[0].angle; maxJump = Math.max(maxJump, Math.abs(a - prev)); prev = a;
    if (r.collided) contact++;
  }
  expect(maxJump <= SW.maxPushSpeed * DT + 1e-9, `salt d'angle per fotograma ${maxJump.toFixed(4)} > ${(SW.maxPushSpeed * DT).toFixed(4)}`);
  expect(contact > 0, 'el jugador hauria de notar la resistència de la fulla');
  expect(w.violations === 0, 'penetració');
});
test('7. Empènyer només un costat (x = 0,7, rasant la fulla est) mou aquesta fulla i el jugador passa sense travessar-la', () => {
  const w = makeWorld(); w.door.setAngles(0, 0); const p = { x: 0.72, z: -3 };
  walkTo(w, p, 0.72, -16);
  expect(p.z < -15.9 && w.violations === 0, `z=${p.z.toFixed(2)} violacions ${w.violations}`);
  expect(w.door.leaves[1].angle > w.door.leaves[0].angle - 1e-9, `la fulla est (${deg(w.door.leaves[1].angle)}°) hauria d'obrir-se almenys tant com l'oest (${deg(w.door.leaves[0].angle)}°)`);
});
test('8. Des de DINS, una fulla mig oberta s\'empeny cap a tancar (la porta no deixa passar de l\'altre costat)', () => {
  const w = makeWorld(); w.door.setAngles(60 * DEG, 60 * DEG); const p = { x: 0, z: -10.2 };
  // el jugador és entre els extrems de les fulles; es mou cap a una fulla (est) fins a empènyer-la
  walkTo(w, p, 1.2, -10.2, { maxFrames: 120 });
  expect(w.violations === 0, 'penetració');
  expect(w.door.leaves[1].angle >= 0 && w.door.leaves[1].angle <= w.door.maxAngle, 'angle fora de límits');
});

// ============================================================ 4. tecla E
console.log('\n4. Tecla E: obrir i tancar amb animació suau');
test('9. E a prop (mig oberta) la TANCA: animació suau, monòtona, amb velocitat màxima i sense salts', () => {
  const w = makeWorld(); const p = { x: 0, z: -7 };
  expect(w.door.interact(p.x, p.z) === 'closing', 'E mig oberta hauria de tancar');
  let prev = w.door.leaves[0].angle; let prevV = 0; let maxV = 0; let maxAcc = 0; let mono = true; let first = null; let t = 0;
  for (; t < 5 / DT && w.door.isAnimating(); t++) {
    frame(w, p, 0, 0);
    const a = w.door.leaves[0].angle; const v = (a - prev) / DT;
    if (first === null) first = v;
    maxV = Math.max(maxV, Math.abs(v)); maxAcc = Math.max(maxAcc, Math.abs(v - prevV) / DT);
    if (a > prev + 1e-12) mono = false;
    prev = a; prevV = v;
  }
  near(w.door.leaves[0].angle, 0, 1e-9); near(w.door.leaves[1].angle, 0, 1e-9);
  expect(mono, 'l\'angle no és monòton'); expect(Math.abs(first) < 0.6, `arrencada brusca: ${first.toFixed(2)} rad/s al primer fotograma`);
  expect(maxV <= SW.maxSpeed + 0.05, `velocitat ${maxV.toFixed(2)} > ${SW.maxSpeed}`);
  expect(maxAcc < 40, `acceleració massa brusca (${maxAcc.toFixed(1)} rad/s²)`);
  expect(t * DT < 3.5, `triga massa (${(t * DT).toFixed(2)} s)`);
});
test('10. E tancada l\'OBRE fins a l\'angle d\'obertura (≤ límit) amb animació suau; una segona E la torna a tancar', () => {
  const w = makeWorld(); w.door.setAngles(0, 0); const p = { x: 0, z: -7 };
  expect(w.door.interact(p.x, p.z) === 'opening', 'E tancada hauria d\'obrir');
  let maxSeen = 0; let maxV = 0; let prev = 0;
  for (let t = 0; t < 6 / DT && w.door.isAnimating(); t++) { frame(w, p, 0, 0); const a = w.door.leaves[0].angle; maxSeen = Math.max(maxSeen, a); maxV = Math.max(maxV, (a - prev) / DT); prev = a; }
  near(w.door.leaves[0].angle, SW.openTargetDeg * DEG, 1e-9);
  expect(maxSeen <= w.door.maxAngle + 1e-12, `ha superat el límit (${deg(maxSeen)}°)`);
  expect(maxV <= SW.maxSpeed + 0.05, `velocitat ${maxV.toFixed(2)}`);
  expect(w.door.interact(p.x, p.z) === 'closing', 'segona E: tancar');
  idle(w, p, 4); near(w.door.leaves[0].angle, 0, 1e-9); near(w.door.leaves[1].angle, 0, 1e-9);
});
test('11. E lluny de la porta no fa res (distància d\'interacció)', () => {
  const w = makeWorld();
  for (const [x, z] of [[0, 27], [0, 0], [0, -5], [10, -9.7], [0, -20.4]]) {
    expect(w.door.interact(x, z) === null, `E a (${x}, ${z}) no hauria d'actuar`);
  }
  expect(w.door.isAnimating() === false, 'no hi hauria d\'haver animació');
  for (const [x, z] of [[0, -7], [0, -12], [1.5, -9.3], [-2, -11]]) expect(w.door.canInteract(x, z), `(${x}, ${z}) ha de poder interactuar`);
});
test('12. LÍMITS: els angles mai surten de [mín, màx], ni a la força (setAngles fora de rang) ni empenyent', () => {
  const w = makeWorld();
  w.door.setAngles(500 * DEG, -3);
  expect(w.door.leaves[0].angle === w.door.maxAngle && w.door.leaves[1].angle === w.door.minAngle, `setAngles no ha limitat: ${angles(w)}`);
  w.door.setAngles(w.door.maxAngle, w.door.maxAngle);
  const p = { x: -1.6, z: -10.6 };
  let top = 0;
  for (let i = 0; i < 300; i++) { frame(w, p, 0, -3 * DT * (i < 150 ? -1 : 1)); top = Math.max(top, w.door.leaves[0].angle); } // empeny cap a la paret
  expect(top <= w.door.maxAngle + 1e-12 && w.violations === 0, `màxim ${deg(top)}°, violacions ${w.violations}`);
});

// ============================================================ 5. col·lisions durant l'animació
console.log('\n5. Col·lisions durant l\'animació');
test('13. En TANCAR, una fulla amb el jugador al camí ESPERA (no l\'esclafa ni l\'empeny, amb o sense llista de col·lisions) i acaba de tancar quan es retira', () => {
  const start = { x: 0.5, z: -10.3 }; // dins l'arc de gir de la fulla est (a 80°, lliure)
  for (const withColliders of [false, true]) {
    const w = makeWorld(); const p = { ...start };
    expect(isPositionFree(p.x, p.z, R, w.cols), 'el punt de partida hauria de ser lliure');
    expect(w.door.interact(p.x, p.z) === 'closing', 'tancant');
    for (let i = 0; i < 4 / DT; i++) frame(w, p, 0, 0, DT, withColliders);
    expect(w.violations === 0, `${w.violations} fotogrames amb el jugador dins la fusta`);
    expect(w.nudges === 0 && Math.hypot(p.x - start.x, p.z - start.z) < 1e-9, 'tancant no ha d\'empènyer el jugador');
    expect(w.door.leaves[1].angle > 5 * DEG, `la fulla est hauria d'esperar contra el jugador (${angles(w)})`);
    walkTo(w, p, -0.6, -12.5); idle(w, p, 4); // s'allunya cap al costat contrari de la fulla que esperava
    near(w.door.leaves[0].angle, 0, 1e-9); near(w.door.leaves[1].angle, 0, 1e-9);
    expect(w.violations === 0, 'penetració després de retirar-se');
  }
});
test('13b. En OBRIR amb el jugador just contra la fulla (per dins), la fulla l\'EMPENY suaument cap enrere (cap a la nau), sense parets ni fusta pel mig', () => {
  const w = makeWorld(); w.door.setAngles(0, 0);
  const p = { x: 0.3, z: SW.hingeZ - SW.collisionHalfThickness - R - 0.001 }; // tocant les fulles tancades, a dins
  expect(isPositionFree(p.x, p.z, R, w.cols), 'punt de partida lliure');
  const z0 = p.z;
  expect(w.door.interact(p.x, p.z) === 'opening', 'obrint');
  for (let i = 0; i < 5 / DT; i++) frame(w, p, 0, 0);
  expect(w.violations === 0, `${w.violations} fotogrames dins la fusta/paret`);
  expect(w.nudges > 0 && p.z < z0, `el jugador hauria d'haver estat empès cap a dins (nudges=${w.nudges}, z ${z0.toFixed(2)} → ${p.z.toFixed(2)})`);
  near(w.door.leaves[0].angle, SW.openTargetDeg * DEG, 1e-9); near(w.door.leaves[1].angle, SW.openTargetDeg * DEG, 1e-9);
});
test('14. La col·lisió SEGUEIX la fulla a cada fotograma de l\'animació (extrem = frontissa + L·direcció)', () => {
  const w = makeWorld(); const p = { x: 0, z: -3 }; w.door.interact(0, -7);
  let checked = 0;
  for (let i = 0; i < 200; i++) {
    frame(w, p, 0, 0);
    for (const l of w.door.leaves) {
      const c = l.collider;
      near(c.x1, l.hingeX, 1e-12); near(c.z1, l.hingeZ, 1e-12);
      near(c.x2, l.hingeX - l.side * Math.cos(l.angle) * l.length, 1e-9);
      near(c.z2, l.hingeZ - Math.sin(l.angle) * l.length, 1e-9);
      checked++;
    }
  }
  expect(checked === 400, 'comprovacions');
});
test('15. FUZZ: 200 recorreguts aleatoris amb E aleatòria pel pas i la nau (≈ 120.000 fotogrames): mai dins de la fusta ni d\'una paret', () => {
  const rnd = makeRng(2026); let frames = 0; let toggles = 0; let bad = 0;
  for (let s = 0; s < 200; s++) {
    const w = makeWorld();
    w.door.setAngles(rnd() * w.door.maxAngle, rnd() * w.door.maxAngle);
    const p = { x: (rnd() - 0.5) * 3, z: -6 - rnd() * 8 };
    if (!isPositionFree(p.x, p.z, R, w.cols)) continue;
    let heading = rnd() * Math.PI * 2; let speed = 4;
    for (let i = 0; i < 600; i++) {
      if (i % 40 === 0) { heading = rnd() * Math.PI * 2; speed = rnd() < 0.2 ? 0 : 1 + rnd() * 3.5; }
      if (rnd() < 0.012) { if (w.door.interact(p.x, p.z)) toggles++; }
      frame(w, p, Math.cos(heading) * speed * DT, Math.sin(heading) * speed * DT);
      frames++;
      for (const l of w.door.leaves) if (l.angle < w.door.minAngle - 1e-12 || l.angle > w.door.maxAngle + 1e-12) bad++;
    }
    bad += w.violations;
  }
  expect(bad === 0, `${bad} infraccions (${frames} fotogrames, ${toggles} E)`);
  console.log(`      (${frames} fotogrames, ${toggles} pulsacions d'E, 0 infraccions)`);
});

// ============================================================ 6. porta tancada de veritat
console.log('\n6. Una porta tancada no es pot travessar');
const lockedDef = { ...D1, swing: { ...SW, minAngleDeg: 0, maxAngleDeg: 0, initialAngleDeg: 0, openTargetDeg: 0 } }; // fulles que no poden girar
test('16. Porta que no pot obrir-se: des de fora, cap aproximació (rectes i en diagonal, 5 velocitats) travessa la fusta', () => {
  const limit = SW.hingeZ + SW.collisionHalfThickness + R; // pla de la fulla + cos del jugador (la vora arrodonida de la junta del mig n'afegeix < 0,3 mm)
  for (const speed of [1, 4, 8, 20]) {
    for (const x of [-0.75, -0.4, 0, 0.4, 0.75]) {
      for (const fromX of [x, x * 3, 0]) {
        const w = makeWorld(lockedDef); const p = { x: fromX, z: -3 };
        walkTo(w, p, x, -16, { speed, maxFrames: 400 });
        expect(p.z >= limit - 3e-4, `x=${x} des de ${fromX} a ${speed} m/s: z=${p.z.toFixed(3)} < ${limit.toFixed(3)} (ha travessat)`);
        expect(w.violations === 0, 'penetració');
      }
    }
  }
});
test('17. El mateix des de DINS cap a la plaça: tampoc es travessa', () => {
  const limit = SW.hingeZ - SW.collisionHalfThickness - R;
  for (const speed of [1, 4, 20]) for (const x of [-0.7, 0, 0.7]) {
    const w = makeWorld(lockedDef); const p = { x, z: -15 };
    walkTo(w, p, x, -3, { speed, maxFrames: 400 });
    expect(p.z <= limit + 3e-4, `x=${x} a ${speed} m/s: z=${p.z.toFixed(3)} > ${limit.toFixed(3)}`);
  }
});
test('18. Porta tancada normal: des de dins no s\'obre empenyent (obre cap a dins); amb E s\'obre (empenyent el jugador enrere) i es pot sortir', () => {
  const w = makeWorld(); w.door.setAngles(0, 0); const p = { x: 0, z: -14 };
  walkTo(w, p, 0, -3, { maxFrames: 400 });
  expect(p.z < -10 && w.door.leaves.every((l) => l.angle < 1e-9), `ha de quedar-se dins amb les fulles tancades (z=${p.z.toFixed(2)}, ${angles(w)})`);
  expect(w.door.interact(p.x, p.z) === 'opening', 'E ha d\'obrir');
  idle(w, p, 4);
  walkTo(w, p, 0, -3, { maxFrames: 400 });
  expect(p.z > -3.01 && w.violations === 0, `no ha pogut sortir (z=${p.z.toFixed(2)})`);
});

// ============================================================ 7. geometria i pas
console.log('\n7. Parets, pas de 2,2 m i coherència amb la geometria');
test('19. A QUALSEVOL angle (0°–170°, cada 0,5°) cap fulla toca cap paret ni cap altre obstacle estàtic', () => {
  const w = makeWorld(); let n = 0;
  for (let a = SW.minAngleDeg; a <= SW.maxAngleDeg + 1e-9; a += 0.5) {
    w.door.setAngles(a * DEG, a * DEG);
    for (const l of w.door.leaves) for (const c of staticColliders) { n++; expect(!collidersOverlap(l.collider, c), `fulla ${l.name} a ${a}° toca ${c.id}`); }
  }
  console.log(`      (${n} parelles fulla/obstacle comprovades)`);
});
test('20. El pas continua sent de 2,2 m: les parets CH-N-FW/FE no han canviat i amb la porta oberta (165°) el passadís x ∈ [−0,75; 0,75] és lliure de z = −8 a −12', () => {
  const nave = LAYOUT.BUILDINGS.find((b) => b.id === 'CH-N');
  const fw = nave.collision.find((c) => c.id === 'CH-N-FW'); const fe = nave.collision.find((c) => c.id === 'CH-N-FE');
  expect(Math.abs(fe.xMin - fw.xMax - 2.2) < 1e-9, 'amplada del pas');
  const w = makeWorld(); w.door.setAngles(SW.openTargetDeg * DEG, SW.openTargetDeg * DEG);
  for (let x = -0.75; x <= 0.7501; x += 0.05) for (let z = -8; z >= -12; z -= 0.1) expect(isPositionFree(x, z, R, w.cols), `(${x.toFixed(2)}, ${z.toFixed(1)}) no és lliure`);
  const w2 = makeWorld(); // i a l'estat inicial el centre és lliure
  for (let z = -8; z >= -13; z -= 0.1) expect(isPositionFree(0, z, R, w2.cols), `inici: (0, ${z.toFixed(1)}) no és lliure`);
});
test('21. Les col·lisions de les parets i dels altres edificis no s\'han tocat: la llista estàtica no conté segments i només s\'hi afegeixen les 2 fulles', () => {
  expect(staticColliders.every((c) => !c.isSegment), 'buildColliders no ha de crear segments');
  const w = makeWorld(); expect(w.cols.length === staticColliders.length + 2, 'ha de ser estàtics + 2 fulles');
  for (const id of ['CH-N-W', 'CH-N-E', 'CH-N-B', 'CH-N-FW', 'CH-N-FE']) expect(staticColliders.some((c) => c.id === id), `falta ${id}`);
});

// ============================================================ 8. visual
console.log('\n8. Visual (Three.js real): fulles, pivots i neteja');
const scene = new THREE.Scene();
const village = buildVillage(scene);
const handle = village.doors && village.doors.D1;
test('22. buildVillage manté el seu retorn ({ root, lanternLights, stats, dispose }) i hi afegeix doors.D1 amb 2 pivots de matriu viva', () => {
  for (const k of ['root', 'lanternLights', 'stats', 'dispose']) expect(k in village, `falta ${k}`);
  expect(handle && handle.pivots.length === 2, 'falten els pivots de D1');
  expect(handle.pivots.every((p) => p.matrixAutoUpdate === true), 'els pivots han de tenir matriu viva');
  expect(Object.keys(village.doors).join() === 'D1,D2,D3,D4' && village.doors.D1.pivots && village.doors.D2.setAngle, 'D1 amb dues fulles de física; D2–D4 amb fulla pròpia (Fase C)');
});
test('23. Cada fulla: 2 malles (roure + ferro), < 700 triangles, vora alta que segueix l\'arc i alçada ≈ 3,57 m', () => {
  for (const pv of handle.pivots) {
    expect(pv.children.length === 2, `${pv.name}: ${pv.children.length} malles`);
    let tris = 0; pv.traverse((o) => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
    expect(tris < 700, `${pv.name}: ${tris} triangles`);
    const box = new THREE.Box3().setFromObject(pv);
    expect(Math.abs(box.max.y - 3.57) < 0.02, `${pv.name}: alçada ${box.max.y.toFixed(3)}`);
  }
});
test('24. La fulla DIBUIXADA coincideix amb la de la FÍSICA: extrem lliure i frontissa a < 1 mm per a 40 angles aleatoris', () => {
  const w = makeWorld(); const rnd = makeRng(7);
  for (let i = 0; i < 40; i++) {
    w.door.setAngles(rnd() * w.door.maxAngle, rnd() * w.door.maxAngle);
    handle.setAngles(w.door.leaves[0].angle, w.door.leaves[1].angle);
    scene.updateMatrixWorld(true);
    w.door.leaves.forEach((l, k) => {
      const pv = handle.pivots[k];
      const hinge = new THREE.Vector3(0, 0, 0).applyMatrix4(pv.matrixWorld);
      const tip = new THREE.Vector3(-l.side * l.length, 0, 0).applyMatrix4(pv.matrixWorld); // cantell lliure (cara local)
      expect(Math.hypot(hinge.x - l.collider.x1, hinge.z - l.collider.z1) < 1e-3, `${l.name}: frontissa`);
      expect(Math.hypot(tip.x - l.collider.x2, tip.z - l.collider.z2) < 1e-3, `${l.name}: extrem a ${deg(l.angle)}°: visual (${tip.x.toFixed(3)}, ${tip.z.toFixed(3)}) / física (${l.collider.x2.toFixed(3)}, ${l.collider.z2.toFixed(3)})`);
    });
  }
});
test('25. Les fulles dibuixades (caixa envolvent) es queden sempre dins la nau i a menys de 6 cm de la col·lisió (cap fusta visible fora de la col·lisió)', () => {
  const w = makeWorld();
  for (const a of [0, 30, 80, 120, 170]) {
    w.door.setAngles(a * DEG, a * DEG); handle.setAngles(a * DEG, a * DEG); scene.updateMatrixWorld(true);
    for (const pv of handle.pivots) {
      const box = new THREE.Box3().setFromObject(pv);
      expect(box.max.z < -9.55, `${pv.name} a ${a}°: arriba a z=${box.max.z.toFixed(3)} (la façana és a −9,6)`);
    }
  }
});
test('26. dispose() allibera les geometries i els materials de les fulles (esdeveniments dispose)', () => {
  let geos = 0; let mats = 0; const seenG = new Set(); const seenM = new Set();
  for (const pv of handle.pivots) pv.traverse((o) => {
    if (!o.isMesh) return;
    if (!seenG.has(o.geometry)) { seenG.add(o.geometry); o.geometry.addEventListener('dispose', () => { geos++; }); }
    if (!seenM.has(o.material)) { seenM.add(o.material); o.material.addEventListener('dispose', () => { mats++; }); }
  });
  village.dispose();
  expect(geos === seenG.size && geos === 4, `geometries alliberades: ${geos}/${seenG.size}`);
  expect(mats === seenM.size && mats === 2, `materials alliberats: ${mats}/${seenM.size} (roure + ferro)`);
});

// ============================================================ 9. integració
console.log('\n9. No interfereix amb el ratolí, el pointer lock ni el moviment');
test('27. doors.js és matemàtiques pures: no importa Three.js i no toca el DOM, el teclat, el ratolí ni el pointer lock', () => {
  const src = fs.readFileSync(new URL('../src/player/doors.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['three', 'document', 'window', 'addEventListener', 'pointerLock', 'requestPointerLock', 'mousemove', 'keydown']) {
    expect(!src.includes(bad), `doors.js conté "${bad}"`);
  }
  expect(/import \{[^}]*\} from '\.\/collisions\.js'/.test(src), 'només ha de dependre de collisions.js');
});
test('28. main.js: la tecla E només actua amb el ratolí capturat, sense repetició, i l\'indicador no intercepta clics', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  expect(/e\.code === 'KeyE' && !e\.repeat && document\.pointerLockElement === renderer\.domElement/.test(src), 'condició de la tecla E');
  expect(/pointer-events: none/.test(src), 'l\'indicador ha de tenir pointer-events: none');
  expect(src.indexOf('churchDoor.update(') < src.indexOf('movePlayer(\n'), 'la porta s\'ha d\'actualitzar ABANS de movePlayer');
});

console.log(`\nResum: ${passed} proves superades, ${failed} fallades.`);
process.exit(failed ? 1 : 0);
