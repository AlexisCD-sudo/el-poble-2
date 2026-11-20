// =====================================================================
// THE FORGOTTEN VILLAGE — CRIPTA (Fase D.3): accés per SD, puzle dels tres símbols, sarcòfag, KEY-C i caixa-pista (matemàtiques pures)
// =====================================================================
// Sense Three.js ni DOM (es prova des de la terminal: tools/test-fase-d3.js). village.js dibuixa l'estat que es calcula aquí i
// main.js hi connecta el so, el HUD i la llum. Dades: CRYPT, CRYPT_WALLS, CRYPT_FLOORS de layout.js.
//
// ACCÉS: quan SD és 'open' (només llavors; 'unlocked' i 'opening' no compten) es desactiva CH-N-B i s'activen les seves dues peces
//   (x −4→−0,7 i 0,7→4): queda el pas x −0,7→0,7. Amb SD tancada tot és idèntic a abans (les peces són DINS de CH-N-B).
// PUZLE: 3 discs, E gira el disc que el jugador mira (només DAVANT de l'altar i a ≤ 1,75 m). Solució: CAMPANA → LLUNA → CREU.
//   Resolt → els discs es fixen, es desbloqueja el sarcòfag (NO es dona KEY-C). Combinacions errònies: no passa res.
// SARCÒFAG: 'locked' → ('unlocking') → 'unlocked' → E → 'opening' → 'open'; llavors apareix KEY-C i E la recull (inventari existent).
// CAIXA-PISTA: E mostra/tanca la nota. No dona cap clau ni activa res de la casa.
// =====================================================================

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------------
// Col·lisió condicional de SD. `colliders` = llista de buildColliders (els mateixos objectes que fa servir movePlayer).
// ---------------------------------------------------------------------
export function createCryptAccess(colliders, def) {
  const original = colliders.find((c) => c.id === def.sdSplit.original);
  const pieces = def.sdSplit.pieces.map((id) => colliders.find((c) => c.id === id)).filter(Boolean);
  let open = false;
  const apply = () => { if (original) original.enabled = !open; for (const p of pieces) p.enabled = open; };
  apply();
  return {
    original, pieces,
    isOpen() { return open; },
    // sdState = estat de la porta secreta ('locked'|'unlocked'|'opening'|'open'). Només 'open' obre el pas.
    sync(sdState) {
      const want = sdState === 'open';
      if (want !== open) { open = want; apply(); }
    },
  };
}

// ---------------------------------------------------------------------
// Llum i visibilitat segons la fondària (el jugador que baixa l'escala). feetY = alçada dels peus.
// ---------------------------------------------------------------------
export function undergroundView(feetY, px, pz, def) {
  const a = def.ambient;
  const t = smooth(clamp01((-0.3 - feetY) / 2.3));          // 0 a fora (y ≥ −0,3) → 1 a y ≤ −2,6
  const sh = def.shaft.outer;
  const inShaft = px >= sh.xMin && px <= sh.xMax && pz >= sh.zMin && pz <= sh.zMax;
  const near = Math.hypot(Math.max(0, sh.xMin - px, px - sh.xMax), Math.max(0, sh.zMin - pz, pz - sh.zMax)) <= 14;
  return {
    depth: t,
    hemi: a.hemiSurface + (a.hemiDeep - a.hemiSurface) * t,
    moon: a.moonSurface + (a.moonDeep - a.moonSurface) * t,
    fogNear: null, fogFar: null, fogT: t, fogNearDeep: a.fogNearDeep, fogFarDeep: a.fogFarDeep, fogColorDeep: a.fogColorDeep,
    villageVisible: !(feetY < -1.6),          // el poble no es dibuixa quan ets ben a sota (només es veu el pou i la cripta)
    interiorVisible: feetY < -0.3 || near,    // l'interior de la cripta només es dibuixa si baixes o ets a ≤ 14 m del pou (nau de l'església)
    lightOn: feetY < 0.3 && inShaft || feetY < -0.3,
  };
}

// ---------------------------------------------------------------------
// Estat del joc de la cripta. deps = { inventory, say }.
// ---------------------------------------------------------------------
export function createCryptGame(def, deps) {
  const { inventory, say } = deps;
  const P = def.puzzle; const S = def.sarcophagus; const K = def.keyC; const C = def.clue;
  const n = P.symbols.length;
  const events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });

  const st = {
    discs: P.start.map((s) => P.symbols.indexOf(s)),     // índex del símbol de cada disc
    discAngle: P.start.map(() => 0), discTarget: P.start.map(() => 0),   // radians (animació)
    solved: false, solvedT: 0, sealT: 0, unlockStarted: false,
    sarc: 'locked', sarcT: 0, lidT: 0,
    keyTaken: false, note: false, noteSeen: false,
    pose: { px: 0, pz: 0, dirX: 0, dirZ: -1 },
  };

  const symbolsNow = () => st.discs.map((i) => P.symbols[i]);
  const isSolution = () => symbolsNow().every((s, i) => s === P.solution[i]);

  // Disc que el jugador mira (el de menor angle respecte de la mirada). Si està massa lluny de la mirada, -1.
  function aimedDisc(px, pz, dirX, dirZ) {
    const dl = Math.hypot(dirX, dirZ) || 1;
    let best = -1; let bestCos = -2;
    P.discX.forEach((x, i) => {
      const vx = x - px; const vz = P.discZ - pz; const d = Math.hypot(vx, vz) || 1;
      const cos = (vx * dirX + vz * dirZ) / (d * dl);
      if (cos > bestCos) { bestCos = cos; best = i; }
    });
    return bestCos >= 0.5 ? best : -1;
  }
  const inFront = (px, pz) => pz >= P.interact.standZ && Math.abs(px - P.interact.x) <= P.interact.standHalfX;
  const discWord = ['de l\'esquerra', 'del mig', 'de la dreta'];

  function turnDisc(i) {
    if (st.solved || i < 0) return false;
    st.discs[i] = (st.discs[i] + 1) % n;
    st.discTarget[i] += Math.PI / 2;
    emit('disc', { disc: i, symbol: P.symbols[st.discs[i]] });
    if (isSolution()) {
      st.solved = true; st.solvedT = 0; st.sealT = 0;
      emit('solved');
      say('Els tres discs encaixen amb un so greu de pedra. Alguna cosa s\'ha desbloquejat dins la cripta.', 7);
    }
    return true;
  }

  const lidReady = () => st.sarc === 'unlocked';
  const targets = [];
  const crypt = (extra) => ({ ...extra });

  // 1. Caixa-pista (casa C, pis superior).
  targets.push(crypt({
    id: C.id, x: C.center.x, z: C.center.z, range: C.range, facing: 0.5, priority: 0.3,
    spatial: { maxDistance: C.range, coneCos: Math.cos(35 * Math.PI / 180), level: 1, baseY: 2.75, maxDy: 0.5 },
    prompt: () => (st.note ? 'E — tancar la nota' : 'E — examinar la caixa'),
    use: () => { st.note = !st.note; if (st.note) { st.noteSeen = true; emit('note'); } return null; },
  }));
  // 2. Altar dels tres discs.
  targets.push(crypt({
    id: 'CR-DISCS', x: P.interact.x, z: P.interact.z, range: P.interact.range, facing: 0.5, priority: 0,
    spatial: { maxDistance: P.interact.range, coneCos: -1, level: -1, baseY: -3.2, maxDy: 0.6 },
    enabled: () => !st.solved,
    stand: (px, pz) => inFront(px, pz),
    prompt: () => {
      const i = aimedDisc(st.pose.px, st.pose.pz, st.pose.dirX, st.pose.dirZ);
      if (i < 0) return 'E — girar un disc (mira’n un)';
      const cur = P.names[P.symbols[st.discs[i]]]; const nxt = P.names[P.symbols[(st.discs[i] + 1) % n]];
      return `E — girar el disc ${discWord[i]} (${cur} → ${nxt})`;
    },
    use: (px, pz, dirX, dirZ) => {
      const i = aimedDisc(px, pz, dirX, dirZ);
      if (i >= 0) turnDisc(i);
      return null;
    },
  }));
  // 3. Tapa del sarcòfag.
  targets.push(crypt({
    id: 'CR-SARC-LID', x: S.interact.x, z: S.interact.z, range: S.interact.range, facing: 0.35, priority: 0.2,
    spatial: { maxDistance: S.interact.range, coneCos: -1, level: -1, baseY: -3.2, maxDy: 0.6 },
    enabled: () => st.sarc === 'locked' || st.sarc === 'unlocking' || st.sarc === 'unlocked',
    prompt: () => (lidReady() ? 'E — alçar la tapa' : 'E — examinar el sarcòfag'),
    use: () => {
      if (lidReady()) {
        st.sarc = 'opening'; st.sarcT = 0; emit('lid');
        say('Empenys la tapa de pedra. Llisca lentament, arrossegant pols de segles.', 6);
      } else {
        say('La tapa no cedeix. Un mecanisme antic la manté tancada des de dins de la pedra.', 5);
      }
      return null;
    },
  }));
  // 4. KEY-C dins del sarcòfag (només amb la tapa oberta del tot).
  targets.push(crypt({
    id: K.id, x: K.pos.x, z: K.pos.z, range: K.pickRange, facing: 0.35, priority: 1,
    spatial: { maxDistance: K.pickRange, coneCos: -1, level: -1, baseY: -3.2, maxDy: 0.6 },
    enabled: () => st.sarc === 'open' && !st.keyTaken,
    prompt: () => `E — recollir la ${K.name.toLowerCase()}`,
    use: () => {
      st.keyTaken = true;
      inventory.add({ id: K.id, name: K.name, description: K.description, symbol: K.symbol });
      emit('key');
      say(`Has recollit: ${K.name} (${K.description}).`, 7);
      return { picked: K.id };
    },
  }));

  const api = {
    targets,
    puzzle: {
      symbols: symbolsNow, solved: () => st.solved, isSolution, turn: turnDisc, aimedDisc,
      discAngle: (i) => st.discAngle[i], discIndex: (i) => st.discs[i],
      sealProgress: () => smooth(clamp01(st.sealT / P.sealSeconds)),
    },
    sarcophagus: {
      state: () => st.sarc, unlocked: () => st.sarc !== 'locked',
      lidProgress: () => smooth(st.lidT), unlockProgress: () => (st.sarc === 'locked' ? 0 : smooth(clamp01(st.sarcT / S.unlockSeconds))),
      keyVisible: () => st.sarc === 'open' || (st.sarc === 'opening' && st.lidT > 0.55),
      keyTaken: () => st.keyTaken,
    },
    note: { isOpen: () => st.note, seen: () => st.noteSeen, close() { st.note = false; } },
    // Text contextual NO actuable (indicació discreta davant de l'altar).
    hint(px, pz) {
      if (st.solved) return '';
      if (pz >= P.interact.standZ && pz <= P.interact.standZ + 2.6 && Math.abs(px - P.interact.x) <= 2.2) return 'Altar dels tres discs: mira’n un i prem E per girar-lo.';
      return '';
    },
    drainEvents() { return events.splice(0, events.length); },
    // --- Desar / carregar (Fase D.3.1) ---
    // Quiet: cap disc girant, i si el puzle és resolt, el segell i el sarcòfag han acabat ('unlocked' o 'open'). Sense resoldre: sarcòfag 'locked'.
    isSettled() {
      if (st.discAngle.some((a, i) => Math.abs(st.discTarget[i] - a) > 1e-6)) return false;
      if (!st.solved) return st.sarc === 'locked';
      return st.sealT >= P.sealSeconds && (st.sarc === 'unlocked' || st.sarc === 'open');
    },
    snapshot() {
      const settledSarc = st.sarc === 'opening' || st.sarc === 'open' ? 'open' : st.sarc === 'locked' && !st.solved ? 'locked' : 'unlocked';
      return {
        discs: st.discs.slice(), discTurns: st.discTarget.map((a) => Math.round(a / (Math.PI / 2))),
        solved: st.solved, sarc: settledSarc, keyTaken: st.keyTaken, noteSeen: st.noteSeen,
      };
    },
    restore(snap) {
      st.discs = snap.discs.slice();
      st.discTarget = snap.discTurns.map((t) => t * (Math.PI / 2)); st.discAngle = st.discTarget.slice();
      st.solved = !!snap.solved; st.solvedT = st.solved ? P.solveDelay + 1 : 0; st.sealT = st.solved ? P.sealSeconds : 0; st.unlockStarted = st.solved;
      st.sarc = snap.sarc; st.sarcT = st.sarc === 'locked' ? 0 : S.unlockSeconds; st.lidT = st.sarc === 'open' ? 1 : 0;
      st.keyTaken = !!snap.keyTaken; st.noteSeen = !!snap.noteSeen; st.note = false;
      events.length = 0;
    },
    // A cridar cada fotograma. Retorna res; l'estat es llegeix amb els getters.
    update(dt, px, pz, dirX, dirZ) {
      st.pose = { px, pz, dirX, dirZ };
      for (let i = 0; i < st.discAngle.length; i++) {
        const d = st.discTarget[i] - st.discAngle[i];
        if (Math.abs(d) > 1e-6) st.discAngle[i] += Math.sign(d) * Math.min(Math.abs(d), (Math.PI / 2) * dt / P.turnSeconds);
      }
      if (st.solved) {
        st.solvedT += dt; st.sealT += dt;
        if (!st.unlockStarted && st.solvedT >= P.solveDelay) { st.unlockStarted = true; st.sarc = 'unlocking'; st.sarcT = 0; emit('mechanism'); }
      }
      if (st.sarc === 'unlocking') { st.sarcT += dt; if (st.sarcT >= S.unlockSeconds) { st.sarc = 'unlocked'; } }
      if (st.sarc === 'opening') { st.lidT = clamp01(st.lidT + dt / S.lidSeconds); if (st.lidT >= 1) st.sarc = 'open'; }
      if (st.note && Math.hypot(px - C.center.x, pz - C.center.z) > C.closeDistance) st.note = false;
    },
  };
  return api;
}
