// =====================================================================
// THE FORGOTTEN VILLAGE — PORTES DE CASA D'UNA FULLA (matemàtiques pures, Fase C)
// =====================================================================
// Sense Three.js ni DOM: es pot provar des de la terminal (tools/test-house-doors.js).
//
// Cada porta de casa (D2, D3, D4) té UNA fulla amb frontissa a una jamba (`house.hinge`, en coordenades de món).
// Comença TANCADA. Amb E s'obre amb una animació suau i amb E es tanca. Estats: closed → opening → open → closing → closed.
//
// COL·LISIÓ: mentre la fulla és a menys d'ENABLE_ANGLE de la posició tancada, un rectangle (`house.block`, tot el gruix
// de la paret) tanca el pas; més oberta, el pas queda lliure. Si el jugador és al pas quan es tanca, el rectangle
// el fa fora pel costat més proper (collisions.js): mai no queda dins la paret ni atrapat.
//
// SEGURETAT (no atrapar el jugador): la fulla s'obre SEMPRE cap al costat contrari al del jugador (si és fora, cap a dins;
// si és dins, cap a fora) i NO es pot tancar si el jugador és al pas o dins de la zona que escombra la fulla.
// =====================================================================
import { makeCollider } from './collisions.js';

export const ENABLE_ANGLE = 0.5;   // rad (~29°): per sota, la fulla tanca el pas
const GAP = 0.04;                  // m de joc a la jamba oposada
const HINGE_INSET = 0.05;          // m: l'eix de la frontissa és a 5 cm dins del gruix de la paret (la fulla queda recolzada a la cara interior)

const NORMAL = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };

// Geometria derivada d'una porta del layout (tot en coordenades de món).
export function houseDoorGeometry(door) {
  const h = door.house;
  const b = h.block;
  const n = NORMAL[door.face];
  if (!n) throw new Error(`${door.id}: cara desconeguda '${door.face}'`);
  const alongX = door.face === 'north' || door.face === 'south'; // el pas s'estén al llarg de X
  // cara interior de la paret (pla de la fulla tancada) i eix de la frontissa
  const inner = door.face === 'east' ? b.xMin : door.face === 'west' ? b.xMax : door.face === 'south' ? b.zMin : b.zMax;
  const hingeAlong = alongX ? (h.hinge === 'xMin' ? b.xMin : b.xMax) : (h.hinge === 'zMin' ? b.zMin : b.zMax);
  const dirAlong = (alongX ? (h.hinge === 'xMin' ? 1 : -1) : (h.hinge === 'zMin' ? 1 : -1));
  const hinge = alongX
    ? { x: hingeAlong, z: inner + n[1] * HINGE_INSET }
    : { x: inner + n[0] * HINGE_INSET, z: hingeAlong };
  const closedDir = alongX ? { x: dirAlong, z: 0 } : { x: 0, z: dirAlong };
  const width = alongX ? b.xMax - b.xMin : b.zMax - b.zMin;
  return { n: { x: n[0], z: n[1] }, inner, hinge, closedDir, leafLength: width - GAP, width, alongX };
}

export function createHouseDoor(door) {
  if (!door.house) throw new Error(`${door.id}: no té dades 'house'`);
  const h = door.house;
  const geom = houseDoorGeometry(door);
  const collider = makeCollider(`${door.id}-BLOCK`, h.block);
  const openRad = (h.openDeg * Math.PI) / 180;
  const blockCenter = { x: (h.block.xMin + h.block.xMax) / 2, z: (h.block.zMin + h.block.zMax) / 2 };
  // Punt on el jugador interactua: el centre del pas, a mig gruix de la paret.
  const interact = { x: blockCenter.x, z: blockCenter.z };

  const st = { angle: 0, target: 0, side: 1, msg: '' };

  // El punt (x, z) és dins de la zona que escombra la fulla (costat `side`) o al pas?
  function inSweep(x, z, r, side) {
    // al pas (rectangle del bloc inflat)
    const e = r + 0.1;
    if (x > h.block.xMin - e && x < h.block.xMax + e && z > h.block.zMin - e && z < h.block.zMax + e) return true;
    const vx = x - geom.hinge.x; const vz = z - geom.hinge.z;
    const dist = Math.hypot(vx, vz);
    if (dist > geom.leafLength + r + 0.05) return false;
    const dirX = -geom.n.x * side; const dirZ = -geom.n.z * side;      // cap on gira la fulla
    const vb = vx * dirX + vz * dirZ;                                   // cap al costat on gira
    const va = vx * geom.closedDir.x + vz * geom.closedDir.z;           // al llarg de la fulla tancada
    return vb >= -r && va >= -0.35 - r;
  }

  function sideOfPlayer(x, z) { // −1 si el jugador és a l'interior (darrere del pla de la paret), +1 si és fora
    const s = (x - blockCenter.x) * geom.n.x + (z - blockCenter.z) * geom.n.z;
    return s < 0 ? -1 : 1;
  }

  const api = {
    id: door.id,
    geom,
    collider,
    interact,
    interactRange: h.interactDistance,
    openRad,
    get angle() { return st.angle; },           // 0 = tancada, openRad = oberta
    get side() { return st.side; },             // +1 cap a dins, −1 cap a fora
    get signedAngle() { return st.angle * st.side; },
    get progress() { return st.angle / openRad; },
    isOpen() { return st.target > 0; },         // la intenció: oberta (o obrint-se)
    isClosed() { return st.angle <= 1e-6 && st.target === 0; },
    isMoving() { return Math.abs(st.angle - st.target * openRad) > 1e-4; },
    get state() {
      if (st.target > 0) return Math.abs(st.angle - openRad) < 1e-4 ? 'open' : 'opening';
      return st.angle <= 1e-6 ? 'closed' : 'closing';
    },
    get message() { return st.msg; },
    inSweep(x, z, r) { return inSweep(x, z, r, st.side); },
    // E: obre (cap al costat contrari al del jugador) o tanca (si el jugador no és a la zona de la fulla).
    // Retorna { changed, opened?, reason? }.
    toggle(px, pz, radius) {
      st.msg = '';
      if (st.target === 0) {
        if (st.angle > 1e-6) { // encara es tanca: es pot tornar a obrir pel mateix costat
          st.target = 1;
          return { changed: true, opened: true };
        }
        st.side = sideOfPlayer(px, pz); // fora (+1) → la fulla gira cap a dins; dins (−1) → cap a fora
        st.target = 1;
        return { changed: true, opened: true };
      }
      // tancar
      if (inSweep(px, pz, radius, st.side)) {
        st.msg = 'No pots tancar la porta: hi ha algú al mig.';
        return { changed: false, reason: 'blocked', message: st.msg };
      }
      st.target = 0;
      return { changed: true, opened: false };
    },
    // Avança l'animació (cada fotograma). Retorna true si l'angle ha canviat.
    update(dt) {
      const goal = st.target * openRad;
      const prev = st.angle;
      if (Math.abs(goal - st.angle) > 1e-6) {
        const k = 1 - Math.exp(-dt / (h.smoothTime * 0.36));
        let step = (goal - st.angle) * k;
        const max = h.maxSpeed * dt;
        if (Math.abs(step) > max) step = Math.sign(step) * max;
        st.angle += step;
        if (Math.abs(goal - st.angle) < 0.002) st.angle = goal;
      }
      collider.enabled = st.angle < ENABLE_ANGLE;
      return st.angle !== prev;
    },
  };
  collider.enabled = true;
  return api;
}
