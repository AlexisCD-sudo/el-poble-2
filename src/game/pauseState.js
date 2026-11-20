// =====================================================================
// THE FORGOTTEN VILLAGE — ESTAT DE PAUSA I POINTER LOCK (Fase D.3.1, lògica pura, sense DOM)
// =====================================================================
// El navegador NO envia l'ESC com a `keydown` quan el ratolí és capturat: només allibera el pointer lock. Per això la pausa
// es dedueix de `pointerlockchange` (captura → joc; alliberament → pausa) i no de la tecla ESC. Mentre el menú és obert, ESC sí
// que arriba com a tecla i serveix per REPRENDRE (demana de nou la captura). Si el navegador refusa la captura (Chrome ho fa un
// moment després d'un ESC), la pausa continua i el botó «Tornar al joc» es pot tornar a prémer.
//
// El controlador no toca el DOM: rep `requestLock()` per injecció (així es prova des de la terminal, tools/test-fase-d31.js).
//   · started  → ja s'ha entrat al joc almenys una vegada (abans només es veu «Clica per començar»)
//   · paused   → started i sense captura: el joc NO avança (dt = 0) i res no interactua
// Salts de càmera: després de recuperar la captura, el navegador pot enviar un primer moviment de ratolí enorme.
//   `filterMouse` descarta els moviments durant `GUARD_MS` després de capturar i qualsevol moviment superior a `MAX_DELTA` píxels.
// =====================================================================

export const GUARD_MS = 150;
export const MAX_DELTA = 300;

export function createPauseController({ requestLock, now = () => Date.now() }) {
  const s = { started: false, locked: false, lockedAt: -Infinity, lastError: false, resumeRequests: 0 };
  const api = {
    get started() { return s.started; },
    get locked() { return s.locked; },
    get paused() { return s.started && !s.locked; },
    get playing() { return s.locked; },
    get lastError() { return s.lastError; },
    // Esdeveniment `pointerlockchange` amb l'estat actual de la captura.
    onLockChange(locked) {
      s.locked = !!locked;
      if (locked) { s.started = true; s.lockedAt = now(); s.lastError = false; }
    },
    // Esdeveniment `pointerlockerror`: la captura s'ha refusat; seguim pausats.
    onLockError() { s.lastError = true; },
    // Reprèn (botó «Tornar al joc», tecla ESC amb el menú obert o clic de l'overlay). No fa res si ja som dins.
    resume() { if (s.locked) return false; s.resumeRequests++; requestLock(); return true; },
    // Tecla ESC (només arriba amb el ratolí alliberat): amb el menú obert, reprèn.
    onEscape() { return api.paused ? api.resume() : false; },
    // Temps de joc que ha d'avançar aquest fotograma: 0 en pausa.
    gameDt(dt) { return s.locked ? dt : 0; },
    // Moviment de ratolí: retorna true si s'ha de fer servir per girar la càmera.
    acceptMouse(dx, dy) {
      if (!s.locked) return false;
      if (now() - s.lockedAt < GUARD_MS) return false;
      if (Math.abs(dx) > MAX_DELTA || Math.abs(dy) > MAX_DELTA) return false;
      return true;
    },
  };
  return api;
}
