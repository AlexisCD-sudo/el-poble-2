// =====================================================================
// THE FORGOTTEN VILLAGE — INVENTARI MÍNIM I SELECCIÓ D'INTERACCIÓ (matemàtiques pures)
// =====================================================================
// Sense Three.js ni DOM: es pot provar des de la terminal (tools/test-puzzle.js).
//
// INVENTARI: objectes identificats per `id` (les dues claus són KEY-A i KEY-B). Viu mentre dura la partida.
//
// SELECCIÓ: quan hi ha diversos objectes interactuables a prop, la tecla E només n'activa UN:
//   el més proper (restant-li la seva `priority`) que sigui dins del seu `range` i, si té `facing`, que el jugador
//   miri cap a ell (cosinus de l'angle ≥ facing). Empat → per `id` (resultat determinista).
// =====================================================================

import { segmentBlocked } from './collisions.js';

// ---------------------------------------------------------------------
// INTERACCIÓ ESPACIAL AMB PORTES (Fase C.1). Una sola funció comuna per a D2, D3, D4 i les portes futures.
//   · distància horitzontal jugador → punt d'interacció ≤ maxDistance (1,8 m);
//   · el jugador és al mateix pis que la porta (level) i a la seva alçada (|peus − baseY| ≤ maxDy);
//   · la mirada (horitzontal) cau dins d'un con de coneDeg graus d'obertura total (60° → ±30°);
//   · cap obstacle massís (paret, sostre/escala) entre el jugador i el punt d'interacció.
// ---------------------------------------------------------------------
export const DOOR_INTERACTION = { maxDistance: 1.8, coneDeg: 60, maxDy: 0.5 };

// spec = { maxDistance, coneCos, level, baseY, maxDy }; view = { level, feetY, occluders }
export function canInteractSpatially(spec, tx, tz, px, pz, dirX, dirZ, view) {
  const v = view || { level: 0, feetY: 0, occluders: [] };
  if (spec.level !== undefined && v.level !== undefined && v.level !== spec.level) return false;
  if (v.feetY !== undefined && Math.abs(v.feetY - (spec.baseY || 0)) > spec.maxDy) return false;
  const vx = tx - px; const vz = tz - pz;
  const d = Math.hypot(vx, vz);
  if (d > spec.maxDistance) return false;
  if (d > 0.05) {
    const dl = Math.hypot(dirX, dirZ) || 1;
    if ((vx * dirX + vz * dirZ) / (d * dl) < spec.coneCos) return false;
  }
  if (v.occluders && v.occluders.length && segmentBlocked(px, pz, tx, tz, v.occluders, v.level)) return false;
  return true;
}

export function createInventory() {
  const items = new Map();
  return {
    // Afegeix un objecte. Retorna false si ja hi era (no es dupliquen).
    add(item) {
      if (!item || typeof item.id !== 'string') throw new Error('inventari: l\'objecte necessita "id"');
      if (items.has(item.id)) return false;
      items.set(item.id, { ...item });
      return true;
    },
    has(id) { return items.has(id); },
    remove(id) { return items.delete(id); },
    list() { return [...items.values()]; },
    get count() { return items.size; },
  };
}

// target: { id, x, z, range, facing?, priority?, enabled?(), stand?(px, pz) }. (dirX, dirZ) = direcció de la mirada (no cal normalitzar).
export function pickTarget(targets, px, pz, dirX, dirZ, view) {
  const dl = Math.hypot(dirX, dirZ) || 1;
  const dx = dirX / dl; const dz = dirZ / dl;
  let best = null; let bestScore = Infinity;
  for (const t of targets) {
    if (t.enabled && !t.enabled()) continue;
    if (t.stand && !t.stand(px, pz)) continue; // (Fase D.3) posició obligada: p. ex. DAVANT de l'altar dels discs
    if (t.spatial && !canInteractSpatially(t.spatial, t.x, t.z, px, pz, dirX, dirZ, view)) continue; // portes de casa (Fase C.1)
    const vx = t.x - px; const vz = t.z - pz;
    const d = Math.hypot(vx, vz);
    if (d > t.range) continue;
    if (t.facing && d > 0.05) {
      const cos = (vx * dx + vz * dz) / d;
      if (cos < t.facing) continue;
    }
    const score = d - (t.priority || 0);
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && best && t.id < best.id)) { best = t; bestScore = score; }
  }
  return best;
}
