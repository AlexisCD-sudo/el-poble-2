// =====================================================================
// THE FORGOTTEN VILLAGE — REIXA DEL CEMENTIRI (Fase D.4, matemàtiques pures, sense Three.js ni DOM)
// =====================================================================
// Estats: 'closed' → (E amb KEY-C) 'opening' → 'open' (permanent). No es tanca mai més i no es pot obrir dues vegades.
// ANIMACIÓ: primer cau el cadenat (`lockSeconds`) i després la fulla gira `openDeg` graus cap a dins del cementiri (`swingSeconds`).
// COL·LISIÓ: es substitueix el collider de M-E3 (sòlid) per dues peces: el pilar nord (sempre) i el bloc de l'obertura, que només
//   desapareix quan la reixa és del tot oberta. Així mai no es pot passar a mig obrir i, un cop oberta, el pas és lliure.
// DESAR: només amb la reixa quieta; un 'opening' es normalitza al seu destí ('open'), com la porta secreta.
// =====================================================================
import { makeCollider } from './collisions.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

// colliders = la llista del joc (es modifica: M-E3 s'hi substitueix). def = CEM_GATE, mech = CEM_GATE_MECH.
export function createCemeteryGate(colliders, def, mech) {
  const idx = colliders.findIndex((c) => c.id === def.wallId);
  if (idx < 0) throw new Error(`Reixa del cementiri: no trobo el collider '${def.wallId}'`);
  const wall = colliders[idx];
  const pn = def.pillarNorth; const op = def.opening;
  const pillar = makeCollider('CEM-GATE-PILLAR', { type: 'rect', xMin: wall.xMin, xMax: wall.xMax, zMin: pn.zMin, zMax: pn.zMax });
  const block = makeCollider('CEM-GATE-BLOCK', { type: 'rect', xMin: wall.xMin, xMax: wall.xMax, zMin: op.zMin, zMax: op.zMax });
  colliders.splice(idx, 1, pillar, block);

  const total = mech.lockSeconds + mech.swingSeconds;
  const st = { state: 'closed', t: 0 };
  const sync = () => { block.enabled = st.state !== 'open'; };
  sync();

  const api = {
    id: def.id, pillar, block, openRad: (mech.openDeg * Math.PI) / 180,
    get state() { return st.state; },
    isOpen() { return st.state === 'open'; },
    isOpening() { return st.state === 'opening'; },
    // Obre (només des de 'closed'). Retorna true si ha començat l'animació.
    open() {
      if (st.state !== 'closed') return false;
      st.state = 'opening'; st.t = 0; sync();
      return true;
    },
    lockDrop() { return st.state === 'open' ? 1 : smooth(clamp01(st.t / mech.lockSeconds)); },   // 0 cadenat al seu lloc → 1 caigut
    leafProgress() { return st.state === 'open' ? 1 : smooth(clamp01((st.t - mech.lockSeconds) / mech.swingSeconds)); },
    leafAngle() { return api.leafProgress() * api.openRad; },
    update(dt) {
      if (st.state !== 'opening') return;
      st.t += dt;
      if (st.t >= total) { st.state = 'open'; st.t = total; sync(); }
    },
    // Desar / carregar
    isSettled() { return st.state !== 'opening'; },
    snapshot() { return { open: st.state !== 'closed' }; },
    restore(snap) { st.state = snap && snap.open ? 'open' : 'closed'; st.t = st.state === 'open' ? total : 0; sync(); },
  };
  return api;
}
