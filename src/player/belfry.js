// =====================================================================
// THE FORGOTTEN VILLAGE — EL CAMPANAR (Fase F, lògica pura, sense Three.js ni DOM)
// =====================================================================
// Tres estats que es desen junts:
//   1. PORTA del campanar: 'closed' → (E amb KEY-BELLS) 'opening' → 'open' (permanent). La clau NO es gasta.
//   2. TERRA de l'escala de cargol i de la sala (superfície contínua, vegeu `surface`): només és accessible amb la porta oberta.
//   3. TRENCACLOSQUES DE LES CAMPANES: PETITA → GRAN → MITJANA. Una seqüència errònia es reinicia SENSE càstig. En acabar la correcta hi ha una
//      ressonància (BELFRY.resonanceSeconds) i l'estat `solved` (permanent). Conseqüència narrativa: «alguna cosa antiga es desperta»: el joc
//      només en guarda la marca (`belfry.solved`), perquè una fase futura la faci servir; no s'afegeix cap clau ni porta nova.
// COL·LISIÓ: es SUBSTITUEIX el bloc massís 'CH-T' per les parets del campanar, i la paret CH-N-W es parteix per deixar el pas de la porta.
// DESAR: només amb tot quiet (`isSettled`: ni porta ni ressonància en curs). La seqüència parcial i les oscil·lacions NO es desen.
// =====================================================================
import { makeCollider, setSegment } from './collisions.js';
import { BELFRY, BELFRY_COLLIDERS, NAVE_WEST_WALL_ID, NAVE_WEST_WALL_PIECES, TOWER_SOLID_ID, DOOR_CLOSED_COLLIDER, deg, stairTotalDeg, stairEndDeg, holeSector } from '../world/belfryData.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const norm360 = (a) => ((a % 360) + 360) % 360;

// ---------------------------------------------------------------------
// SUPERFÍCIE (terra del campanar). heightAt(x, z, level, prevY) → alçada dels peus o null (el terra normal decideix).
// Candidats: les voltes de l'escala (una per volta a cada angle), el replà de terra, el terra de la sala (si no és sobre el forat) i el terra
// del pis baix (davant la porta). S'escull el més proper a `prevY` (la volta on ja eres): així l'alçada és contínua i no hi ha salts.
// ---------------------------------------------------------------------
export function createTowerSurface(B = BELFRY) {
  const S = B.stair; const I = B.tower.interior; const total = stairTotalDeg(S); const top = B.tower.floorY;
  const hole = holeSector(B); const eps = 1e-6;
  const inInterior = (x, z) => x >= I.xMin - eps && x <= I.xMax + eps && z >= I.zMin - eps && z <= I.zMax + eps;
  const inHole = (phi) => { const d = norm360(phi - hole.fromDeg); return d <= hole.spanDeg + 1e-9; };
  // Alçada de la rampa de l'escala a l'angle `theta` (graus, sense normalitzar) o null si és fora del tram.
  const stairH = (theta) => { const d = theta - S.startDeg; return d < -1e-9 || d > total + 1e-9 ? null : Math.min(top, Math.max(0, (d / total) * top)); };
  const api = {
    hole, def: B,
    heightAt(x, z, level, prevY) {
      if (!inInterior(x, z)) return null;
      const dx = x - S.cx; const dz = z - S.cz; const r = Math.hypot(dx, dz);
      if (r < S.rIn - eps) return null;
      const phi = (Math.atan2(dz, dx) * 180) / Math.PI;
      const cand = [];
      if (r <= S.rOut + eps) {
        for (let k = -3; k <= 3; k++) { const h = stairH(norm360(phi) + 360 * k); if (h !== null) cand.push(h); }
        // replà de sortida (terra) just abans del primer graó
        const back = norm360(S.startDeg - norm360(phi));       // graus «per darrere» del primer graó
        if (back <= S.landingDeg + 1e-9) cand.push(0);
        if (!inHole(phi)) cand.push(top);
      } else {
        cand.push(0, top);                                        // vestíbul de la porta (a terra) i racons de la sala (terra)
      }
      if (!cand.length) return null;
      const ref = prevY === undefined ? (level === 1 ? top : 0) : prevY;
      let best = cand[0];
      for (const c of cand) if (Math.abs(c - ref) < Math.abs(best - ref)) best = c;
      return best;
    },
    // Angle (graus) i alçada de la rampa en un punt (per a la geometria i els tests).
    stairHeightAtAngle: (theta) => stairH(theta),
  };
  return api;
}

// ---------------------------------------------------------------------
// BELFRY: porta + campanes. colliders = llista del joc (es modifica).
// ---------------------------------------------------------------------
export function createBelfry(colliders, B = BELFRY) {
  const solidIdx = colliders.findIndex((c) => c.id === TOWER_SOLID_ID);
  if (solidIdx < 0) throw new Error(`Campanar: no trobo el collider '${TOWER_SOLID_ID}'`);
  colliders.splice(solidIdx, 1);
  const wIdx = colliders.findIndex((c) => c.id === NAVE_WEST_WALL_ID);
  if (wIdx < 0) throw new Error(`Campanar: no trobo el collider '${NAVE_WEST_WALL_ID}'`);
  const pieces = NAVE_WEST_WALL_PIECES.map((m) => makeCollider(m.id, m.spec));
  colliders.splice(wIdx, 1, ...pieces);
  const made = [...pieces];
  for (const m of BELFRY_COLLIDERS) { const c = makeCollider(m.id, m.spec); if (m.level !== undefined) c.level = m.level; made.push(c); colliders.push(c); }
  const doorBlock = makeCollider(DOOR_CLOSED_COLLIDER.id, DOOR_CLOSED_COLLIDER.spec); made.push(doorBlock); colliders.push(doorBlock);
  const D = B.door;
  const leaf = makeCollider('BEL-LEAF', { type: 'segment', x1: D.hinge.x, z1: D.hinge.z, x2: D.hinge.x, z2: D.hinge.z - D.leafLength, halfThickness: D.leafHalfThickness });
  leaf.enabled = false; made.push(leaf); colliders.push(leaf);

  const rails = made.filter((c) => c.id.startsWith('BEL-RAIL-'));   // la barana només compta per a qui és a la sala (y > 6): a l'escala, la mateixa volta passa per sota
  const door = { state: 'closed', t: 0 };
  const surface = createTowerSurface(B);
  const events = []; let idle = 0;
  const bells = B.bells.map(() => ({ amp: 0, t: 99, tremble: 0 }));
  const puzzle = { seq: [], solved: false, resonating: false, resT: 0 };
  const idx = (id) => B.bells.findIndex((b) => b.id === id);

  function placeLeaf() {
    const a = deg(api.doorProgress() * D.openDeg);
    setSegment(leaf, D.hinge.x, D.hinge.z, D.hinge.x + Math.sin(a) * D.leafLength, D.hinge.z - Math.cos(a) * D.leafLength);
  }
  const sync = () => { doorBlock.enabled = door.state === 'closed'; leaf.enabled = door.state !== 'closed'; placeLeaf(); };

  const api = {
    def: B, surface, colliders: made, puzzle,
    // --- Porta ---
    get doorState() { return door.state; },
    isOpen() { return door.state === 'open'; },
    openDoor() { if (door.state !== 'closed') return false; door.state = 'opening'; door.t = 0; sync(); events.push({ type: 'doorOpen' }); return true; },
    doorProgress() { return door.state === 'open' ? 1 : door.state === 'closed' ? 0 : smooth(clamp01(door.t / D.swingSeconds)); },
    doorAngle() { return deg(api.doorProgress() * D.openDeg); },
    // --- Campanes ---
    get solved() { return puzzle.solved; },
    get resonating() { return puzzle.resonating; },
    bellAngle(i) { const b = bells[i]; return b.amp * Math.exp(-b.t / (B.swing.seconds / 3)) * Math.sin(B.swing.omega * b.t) * (i % 2 ? -1 : 1); },
    bellTremble(i) { return bells[i].tremble; },
    // Estira la corda `i` (0 = petita, 1 = gran, 2 = mitjana). Retorna l'esdeveniment, o null si no es pot (porta tancada, ressonància en curs…).
    ring(i) {
      if (door.state !== 'open' || puzzle.resonating || i < 0 || i >= B.bells.length) return null;
      idle = 0;
      const b = bells[i]; b.amp = B.swing.maxAmp; b.t = 0;
      if (puzzle.solved) { const e = { type: 'ring', bell: B.bells[i].id, index: i, correct: false, free: true }; events.push(e); return e; }
      const want = B.solution;
      let ok;
      const next = [...puzzle.seq, B.bells[i].id];
      if (next.every((id, k) => id === want[k])) { puzzle.seq = next; ok = true; }
      else if (B.bells[i].id === want[0]) { puzzle.seq = [B.bells[i].id]; ok = true; }   // reinici: aquesta campana pot ser la primera d'una nova seqüència
      else { puzzle.seq = []; ok = false; }                                              // error: seqüència reiniciada, sense càstig
      const e = { type: 'ring', bell: B.bells[i].id, index: i, correct: ok, progress: puzzle.seq.length };
      events.push(e);
      if (puzzle.seq.length === want.length) { puzzle.resonating = true; puzzle.resT = 0; puzzle.seq = []; events.push({ type: 'resonance' }); }
      return e;
    },
    drainEvents() { const e = events.slice(); events.length = 0; return e; },
    update(dt) {
      if (door.state === 'opening') {
        door.t += dt; placeLeaf();
        if (door.t >= D.swingSeconds) { door.state = 'open'; door.t = D.swingSeconds; sync(); events.push({ type: 'doorDone' }); }
      }
      for (let i = 0; i < bells.length; i++) { const b = bells[i]; b.t += dt; if (b.t > B.swing.seconds) b.amp = 0; }
      if (puzzle.resonating) {
        puzzle.resT += dt;
        const k = clamp01(puzzle.resT / B.resonanceSeconds);
        const env = Math.sin(Math.PI * Math.min(1, k * 1.1)) ;
        for (const b of bells) b.tremble = env;
        if (puzzle.resT >= B.resonanceSeconds) { puzzle.resonating = false; puzzle.solved = true; for (const b of bells) b.tremble = 0; events.push({ type: 'solved' }); }
      } else if (puzzle.seq.length) { idle += dt; if (idle >= B.idleResetSeconds) { puzzle.seq = []; idle = 0; } }
    },
    // --- Desar / carregar ---
    isSettled() { return door.state !== 'opening' && !puzzle.resonating; },
    snapshot() { return { doorOpen: door.state !== 'closed', solved: puzzle.solved }; },
    restore(s) {
      const snap = s || { doorOpen: false, solved: false };
      door.state = snap.doorOpen ? 'open' : 'closed'; door.t = snap.doorOpen ? D.swingSeconds : 0;
      puzzle.solved = !!snap.solved && !!snap.doorOpen; puzzle.resonating = false; puzzle.resT = 0; puzzle.seq = []; idle = 0;
      for (const b of bells) { b.amp = 0; b.t = 99; b.tremble = 0; }
      events.length = 0; sync();
    },
    // Index de campana per id (per als tests).
    bellIndex: idx,
    // A cridar cada fotograma amb l'alçada dels peus: activa la barana de la vora del forat només a la sala de les campanes.
    setPlayerY(y) { const on = y > B.tower.floorY - 1.0; for (const c of rails) c.enabled = on; },
    // La posició és dins del campanar (porta o escala)? Útil per a la validació de partides.
    insideTower(x, z) { const I = B.tower.interior; return x > I.xMin && x < I.xMax && z > I.zMin && z < I.zMax; },
    stairEndDeg: () => stairEndDeg(B.stair),
  };
  sync();
  return api;
}
