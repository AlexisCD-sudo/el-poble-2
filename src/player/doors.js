// =====================================================================
// THE FORGOTTEN VILLAGE — PORTA FÍSICA DE DUES FULLES (matemàtiques pures)
// =====================================================================
// Com collisions.js, aquest fitxer NO importa Three.js ni el layout ni cap API
// del navegador: només rep números i els retorna, així que es pot provar des de
// la terminal (tools/test-doors.js). `main.js` el connecta amb el joc i
// `village.js` dibuixa les fulles amb els angles que calcula.
//
// MODEL
//   Cada fulla és un SEGMENT GRUIXUT (càpsula) que va de la frontissa fins al
//   cantell lliure. Gira al voltant de la frontissa (eix vertical) entre
//   `minAngle` (tancada) i `maxAngle` (oberta contra la paret): el límit és dur,
//   la porta no pot girar infinitament. La porta s'obre cap a DINS de la nau.
//   Angle θ: la direcció de la fulla oest és (cosθ, −sinθ) i la de l'est
//   (−cosθ, −sinθ) (X = est, Z = sud; la nau és cap a −Z).
//   Cada fulla té un obstacle `collider` (tipus segment, vegeu collisions.js) que
//   es mou amb ella: la col·lisió SEMPRE segueix la posició real de la fusta.
//
// QUÈ MOU LES FULLES (a cada fotograma, ABANS de movePlayer):
//   1. EMPENTA DEL JUGADOR: si el moviment que vol fer el jugador entra a la
//      fulla, aquesta gira cap al costat que l'allibera (cap a dins si el jugador
//      ve de fora, cap a tancar si ve de dins), com a molt a `maxPushSpeed` rad/s.
//      Si la fulla no pot girar prou (límit o massa ràpid), movePlayer()
//      atura el jugador contra la fusta: no es pot travessar mai.
//   2. ANIMACIÓ AMB E: cap a l'angle objectiu amb un suavitzat crític
//      (SmoothDamp), amb velocitat màxima. Si en OBRIR la fulla li arriba a sobre
//      al jugador, l'EMPENY cap enrere, cap a l'interior de la nau (amb el mateix
//      algorisme de col·lisions: mai l'envia a una paret ni a l'altra fulla). En
//      TANCAR no empeny ningú: si el jugador és al camí, la fulla ESPERA (no
//      l'esclafa ni el treu de la nau) fins que es retira.
// =====================================================================

import { makeCollider, setSegment, distanceToSegment, movePlayer, createMoveResult, isPositionFree } from './collisions.js';

const DEG = Math.PI / 180;
const CLOSED_THRESHOLD = 0.35; // rad: per sobre d'això la porta es considera "oberta" (E la tanca)
const EPS = 1e-6;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

const _updateResult = { moved: false, nudged: false, x: 0, z: 0 }; // resultat reutilitzat (sense brossa per fotograma)
const _nudge = createMoveResult();

// SmoothDamp (suavitzat crític amortit): retorna el nou valor i actualitza `state.v`.
function smoothDamp(current, target, state, smoothTime, maxSpeed, dt) {
  const st = Math.max(1e-4, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * st;
  const change = clamp(current - target, -maxChange, maxChange);
  const adjustedTarget = current - change;
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * e;
  let out = adjustedTarget + (change + temp) * e;
  if (target - current > 0 === out > target) { out = target; state.v = 0; } // sense passar-se de llarg
  return out;
}

// Crea la porta a partir de l'entrada del layout (DOORS: D1, amb camp `swing`).
export function createSwingDoor(door) {
  const sw = door && door.swing;
  if (!sw) throw new Error(`createSwingDoor: la porta "${door && door.id}" no té camp "swing"`);
  for (const k of ['hingeX', 'hingeZ', 'leafLength', 'collisionHalfThickness', 'minAngleDeg', 'maxAngleDeg',
    'initialAngleDeg', 'openTargetDeg', 'maxPushSpeed', 'smoothTime', 'maxSpeed', 'interactDistance']) {
    if (typeof sw[k] !== 'number' || !Number.isFinite(sw[k])) throw new Error(`createSwingDoor: swing.${k} ha de ser un número`);
  }
  const minA = sw.minAngleDeg * DEG;
  const maxA = sw.maxAngleDeg * DEG;
  if (!(minA <= maxA) || minA < 0 || maxA > Math.PI) throw new Error('createSwingDoor: angles fora de [0°, 180°] o min > max');
  const clampA = (a) => clamp(a, minA, maxA);
  const openTarget = clampA(sw.openTargetDeg * DEG);
  const centerX = door.center ? door.center.x : 0;

  const leaves = [-1, 1].map((side) => {
    const leaf = {
      side,                                  // −1 = fulla oest, +1 = fulla est
      name: `${door.id}-leaf-${side < 0 ? 'W' : 'E'}`,
      hingeX: centerX + side * sw.hingeX,
      hingeZ: sw.hingeZ,
      length: sw.leafLength,
      angle: clampA(sw.initialAngleDeg * DEG),
      target: null,                          // null = sense animació en curs
      damp: { v: 0 },
      collider: null,
    };
    leaf.collider = makeCollider(leaf.name, {
      type: 'segment', x1: leaf.hingeX, z1: leaf.hingeZ, x2: leaf.hingeX, z2: leaf.hingeZ, halfThickness: sw.collisionHalfThickness,
    });
    place(leaf, leaf.angle);
    return leaf;
  });

  // Posa la fulla a l'angle indicat i arrossega el seu obstacle de col·lisió.
  function place(leaf, angle) {
    leaf.angle = angle;
    setSegment(leaf.collider, leaf.hingeX, leaf.hingeZ,
      leaf.hingeX - leaf.side * Math.cos(angle) * leaf.length, leaf.hingeZ - Math.sin(angle) * leaf.length);
  }

  // Espai lliure (distància al cos de la fulla) entre el punt i la fulla si estigués a `angle`.
  function clearanceAt(leaf, angle, px, pz) {
    return distanceToSegment(px, pz, leaf.hingeX, leaf.hingeZ,
      leaf.hingeX - leaf.side * Math.cos(angle) * leaf.length, leaf.hingeZ - Math.sin(angle) * leaf.length, null) - sw.collisionHalfThickness;
  }

  // +1 si per alliberar el punt la fulla ha d'obrir-se (θ augmenta); −1 si ha de tancar-se.
  function releaseDirection(leaf, px, pz) {
    const tx = leaf.side * Math.sin(leaf.angle); const tz = -Math.cos(leaf.angle); // dd/dθ: cap on es mou la fulla en obrir
    const dot = (px - leaf.hingeX) * tx + (pz - leaf.hingeZ) * tz;
    return dot > 0 ? -1 : 1; // el punt és on aniria la fulla en obrir → la fulla ha de fer enrere
  }

  // Angle mínim (en el sentit `dir`) que deixa el punt a `radius` de la fulla; el límit si no n'hi ha prou.
  function angleToClear(leaf, dir, px, pz, radius) {
    const limit = dir > 0 ? maxA : minA;
    if (clearanceAt(leaf, limit, px, pz) < radius) return limit;
    let bad = leaf.angle; let good = limit;
    for (let i = 0; i < 24; i++) {
      const mid = (bad + good) / 2;
      if (clearanceAt(leaf, mid, px, pz) >= radius) good = mid; else bad = mid;
    }
    return good;
  }

  const api = {
    id: door.id,
    leaves,
    colliders: leaves.map((l) => l.collider),
    centerX,
    hingeZ: sw.hingeZ,
    interactRange: sw.interactDistance,
    minAngle: minA,
    maxAngle: maxA,
    openTarget,

    angles() { return [leaves[0].angle, leaves[1].angle]; },

    // La porta compta com a "oberta" si alguna fulla passa de ~20°.
    isOpen() { return leaves.some((l) => l.angle > CLOSED_THRESHOLD); },
    isAnimating() { return leaves.some((l) => l.target !== null); },

    // És el jugador prou a prop per interactuar amb E?
    canInteract(px, pz) { return Math.hypot(px - centerX, pz - sw.hingeZ) <= sw.interactDistance; },

    // Obre (si és tancada) o tanca (si és oberta) amb animació suau. Retorna 'opening' | 'closing'.
    toggle() {
      const closing = api.isOpen();
      const target = closing ? minA : openTarget;
      for (const l of leaves) { l.target = target; l.damp.v = 0; }
      return closing ? 'closing' : 'opening';
    },

    // Tecla E: només actua si el jugador és a prop. Retorna 'opening' | 'closing' | null.
    interact(px, pz) { return api.canInteract(px, pz) ? api.toggle() : null; },

    // Posa les fulles directament a uns angles (proves, reinici). Atura qualsevol animació.
    setAngles(west, east) {
      leaves[0].target = null; leaves[1].target = null;
      place(leaves[0], clampA(west)); place(leaves[1], clampA(east));
    },

    // A cridar a cada fotograma ABANS de movePlayer. (px, pz) = posició actual del jugador,
    // (mx, mz) = el desplaçament que farà aquest fotograma i `colliders` = la llista que usa
    // movePlayer (parets + aquestes fulles; permet empènyer el jugador si una fulla animada amb E
    // li arriba a sobre; sense ella la fulla espera). Retorna un objecte REUTILITZAT
    // { moved, nudged, x, z }: `moved` = alguna fulla s'ha mogut; si `nudged`, el jugador s'ha
    // d'enviar a (x, z) abans de moure'l (en cas contrari (x, z) és la seva posició d'entrada).
    update(dt, px0, pz0, mx, mz, radius, colliders = null) {
      const out = _updateResult;
      out.moved = false; out.nudged = false; out.x = px0; out.z = pz0;
      if (!(dt > 0)) return out;
      let px = px0; let pz = pz0;
      let moved = false;
      for (const leaf of leaves) {
        const nx = px + mx; const nz = pz + mz;
        const before = leaf.angle;
        const cNew = clearanceAt(leaf, leaf.angle, nx, nz);
        const cOld = clearanceAt(leaf, leaf.angle, px, pz);
        let pushed = false;
        if (cNew < radius - EPS && cNew < cOld - 1e-9) {
          // 1. El jugador empeny la fulla.
          const dir = releaseDirection(leaf, nx, nz);
          const goal = angleToClear(leaf, dir, nx, nz, radius);
          const maxStep = sw.maxPushSpeed * dt;
          const next = clampA(leaf.angle + clamp(goal - leaf.angle, -maxStep, maxStep));
          // La fulla només gira si això allibera el jugador: si ni al límit de rotació pot deixar-lo lliure
          // (p. ex. el jugador és al cantell d'una fulla ja oberta del tot) o si el gir l'acostaria al seu cos
          // actual, es queda quieta i és movePlayer() qui atura el jugador contra la fusta.
          const frees = clearanceAt(leaf, goal, nx, nz) >= radius - EPS;
          const safe = clearanceAt(leaf, next, px, pz) >= Math.min(cOld, radius) - 1e-9;
          if (frees && safe) {
            place(leaf, next);
            leaf.target = null; leaf.damp.v = 0;
          }
          pushed = true;
        }
        if (!pushed && leaf.target !== null) {
          // 2. Animació amb E, si no esclafa el jugador.
          const cand = clampA(smoothDamp(leaf.angle, leaf.target, leaf.damp, sw.smoothTime, sw.maxSpeed, dt));
          const worse = clearanceAt(leaf, cand, px, pz);
          if (worse < radius - EPS && worse < cOld - 1e-9) {
            // El jugador és al camí. Intent d'empènyer-lo cap enrere de forma segura.
            let nudgedOk = false;
            if (colliders && cand > leaf.angle) { // només en OBRIR: la fulla s'allunya cap a dins; en tancar, espera
              const prevAngle = leaf.angle;
              place(leaf, cand);
              movePlayer(px, pz, 0, 0, radius, colliders, _nudge);
              if (!_nudge.blocked && isPositionFree(_nudge.x, _nudge.z, radius, colliders, 1e-5)) {
                px = _nudge.x; pz = _nudge.z; out.nudged = true; nudgedOk = true;
              } else {
                place(leaf, prevAngle);
              }
            }
            if (!nudgedOk) leaf.damp.v = 0; // no es pot: la fulla espera
          } else {
            place(leaf, cand);
            if (Math.abs(leaf.target - cand) < 5e-4 && Math.abs(leaf.damp.v) < 0.02) { place(leaf, leaf.target); leaf.target = null; leaf.damp.v = 0; }
          }
        }
        if (leaf.angle !== before) moved = true;
      }
      out.moved = moved; out.x = px; out.z = pz;
      return out;
    },
  };
  return api;
}
