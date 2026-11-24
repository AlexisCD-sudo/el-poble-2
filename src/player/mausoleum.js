// =====================================================================
// THE FORGOTTEN VILLAGE — MAUSOLEU (Fase E, lògica pura, sense Three.js ni DOM)
// =====================================================================
// Reuneix tres estats que es desen junts:
//   1. PORTA EXTERIOR: 'closed' → (E amb KEY-C) 'opening' → 'open' (permanent). Mentre no és oberta del tot, el seu obstacle segueix actiu.
//   2. TRENCACLOSQUES DE LES LLOSES (slabPuzzle.js). Només és accessible amb la porta oberta. En resoldre's, els canals s'il·luminen i, quan
//      han acabat, s'obre la PORTA SECRETA: 'closed' → 'opening' → 'open' (una llosa que s'enfonsa; el seu obstacle desapareix en acabar).
//   3. CLAU: sobre el pedestal fins que el jugador l'agafa (`keyTaken`).
// COL·LISIÓ: el bloc massís de layout.js ('MAU') se SUBSTITUEIX per parets, la porta i l'envà (mausoleumData.js). La resta del joc no canvia.
// DESAR: només amb tot quiet (`isSettled`). Un estat transitori no es desa: l'usuari espera uns segons i desa.
// =====================================================================
import { makeCollider } from './collisions.js';
import { createSlabPuzzle } from './slabPuzzle.js';
import { MAUSOLEUM, MAUSOLEUM_COLLIDERS, MAUSOLEUM_PEDESTAL_COLLIDER, SLAB_PUZZLE, SLAB_MECH } from '../world/mausoleumData.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

// colliders = llista del joc (es modifica: el bloc 'MAU' es substitueix). Retorna l'API del mausoleu.
export function createMausoleum(colliders, def = MAUSOLEUM, puzzleDef = SLAB_PUZZLE) {
  const idx = colliders.findIndex((c) => c.id === def.id);
  if (idx < 0) throw new Error(`Mausoleu: no trobo el collider '${def.id}'`);
  const parts = {}; const made = [];
  for (const m of MAUSOLEUM_COLLIDERS) { const c = makeCollider(m.id, m.spec); parts[m.id] = c; made.push(c); }
  const ped = makeCollider(MAUSOLEUM_PEDESTAL_COLLIDER.id, MAUSOLEUM_PEDESTAL_COLLIDER.spec); made.push(ped);
  colliders.splice(idx, 1, ...made);

  const door = { state: 'closed', t: 0 }; const secret = { state: 'closed', t: 0 };
  const puzzle = createSlabPuzzle(puzzleDef, SLAB_MECH);
  let keyTaken = false; let puzzleRequested = false; const events = [];
  const sync = () => { parts['MAU-DOOR'].enabled = door.state !== 'open'; parts['MAU-LEAF'].enabled = door.state === 'open'; parts['MAU-SECRET'].enabled = secret.state !== 'open'; ped.enabled = !keyTaken; };
  sync();
  puzzle.onEvent((type) => { if (type === 'solved') events.push({ type: 'solved' }); });

  const api = {
    def, puzzle, colliders: made,
    // --- Porta exterior ---
    get doorState() { return door.state; },
    isOpen() { return door.state === 'open'; },
    openDoor() { if (door.state !== 'closed') return false; door.state = 'opening'; door.t = 0; sync(); events.push({ type: 'doorOpen' }); return true; },
    doorProgress() { return door.state === 'open' ? 1 : smooth(clamp01(door.t / def.door.swingSeconds)); },
    doorAngle() { return api.doorProgress() * (def.door.openDeg * Math.PI) / 180; },
    // --- Porta secreta ---
    get secretState() { return secret.state; },
    secretOpen() { return secret.state === 'open'; },
    secretProgress() { return secret.state === 'open' ? 1 : secret.state === 'closed' ? 0 : smooth(clamp01(secret.t / def.secret.sinkSeconds)); },
    // --- Tauler: només es pot usar amb la porta oberta i sense resoldre ---
    puzzleAvailable() { return door.state === 'open' && !puzzle.solved; },
    requestPuzzle() { if (api.puzzleAvailable()) puzzleRequested = true; return puzzleRequested; },
    takePuzzleRequest() { const r = puzzleRequested; puzzleRequested = false; return r; },
    // --- Clau ---
    get keyTaken() { return keyTaken; },
    keyAvailable() { return secret.state === 'open' && !keyTaken; },
    takeKey() { if (!api.keyAvailable()) return false; keyTaken = true; sync(); events.push({ type: 'key' }); return true; },
    drainEvents() { const e = events.slice(); events.length = 0; return e; },
    update(dt) {
      if (door.state === 'opening') { door.t += dt; if (door.t >= def.door.swingSeconds) { door.state = 'open'; door.t = def.door.swingSeconds; sync(); events.push({ type: 'doorDone' }); } }
      puzzle.update(dt);
      if (puzzle.solved && secret.state === 'closed' && puzzle.glowDone()) { secret.state = 'opening'; secret.t = 0; events.push({ type: 'stone' }); }
      if (secret.state === 'opening') { secret.t += dt; if (secret.t >= def.secret.sinkSeconds) { secret.state = 'open'; secret.t = def.secret.sinkSeconds; sync(); events.push({ type: 'stoneDone' }); } }
    },
    // --- Desar / carregar ---
    isSettled() { return door.state !== 'opening' && secret.state !== 'opening' && (!puzzle.solved || secret.state === 'open'); },
    snapshot() { return { doorOpen: door.state !== 'closed', puzzle: puzzle.snapshot(), secretOpen: secret.state !== 'closed', keyTaken }; },
    restore(s) {
      const snap = s || { doorOpen: false, puzzle: { cells: puzzleDef.start.slice(), moves: 0 }, secretOpen: false, keyTaken: false };
      door.state = snap.doorOpen ? 'open' : 'closed'; door.t = snap.doorOpen ? def.door.swingSeconds : 0;
      puzzle.restore(snap.puzzle);
      secret.state = snap.secretOpen ? 'open' : 'closed'; secret.t = snap.secretOpen ? def.secret.sinkSeconds : 0;
      keyTaken = !!snap.keyTaken; puzzleRequested = false; events.length = 0; sync();
    },
  };
  return api;
}
