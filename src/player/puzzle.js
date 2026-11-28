// =====================================================================
// THE FORGOTTEN VILLAGE — PORTA SECRETA, CONTENIDORS I GLUE DEL PRIMER PUZLE (matemàtiques pures)
// =====================================================================
// Sense Three.js ni DOM. main.js només hi connecta la mirada, la tecla E i el HUD; village.js dibuixa
// l'estat que aquí es calcula (alçada del calaix, tapa de l'arca, batents de la porta, claus a les ranures).
//
// PORTA SECRETA (estat): 'locked' → (les 2 claus inserides) 'unlocked' (mecanisme, `unlockDelay` s) → 'opening'
//   (`openSeconds` s, suau i lenta) → 'open'. Les claus s'insereixen UNA PER UNA amb E, cadascuna a la seva ranura;
//   no es treuen. No s'obre mai sola: cal tornar-hi i inserir-les. Un cop oberta, el pas continua sellat per la
//   paret (la zona del darrere no existeix encara): només s'ensenya la foscor.
// CONTENIDOR (calaix de la còmoda A / tapa de l'arca B): E l'obre (animació curta); la clau queda al descobert.
// =====================================================================

import { createInventory, pickTarget, DOOR_INTERACTION } from './interactions.js';
import { createCryptGame } from './crypt.js';
import { BELFRY_TEXT } from '../world/belfryData.js';   // Fase F: textos del campanar

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);

// Descripció de les claus de la casa per material (també la fa servir el menú de pausa, Fase D.3.1).
export const KEY_DESCRIPTIONS = { bronze: 'clau de bronze envellit amb una campana gravada', iron: 'clau de ferro envellit amb una lluna gravada' };

export function createContainer(def) {
  const c = { id: def.id, reveal: def.reveal, t: 0, opened: false, duration: 0.7 };
  return {
    id: c.id, reveal: c.reveal,
    open() { if (c.opened) return false; c.opened = true; return true; },
    isOpen() { return c.opened; },
    // 0 = tancat, 1 = obert del tot (amb l'animació suavitzada)
    progress() { return smooth(c.t); },
    update(dt) { if (c.opened && c.t < 1) c.t = clamp01(c.t + dt / c.duration); },
    // Desar / carregar (Fase D.3.1)
    isSettled() { return !c.opened || c.t >= 1; },
    snapshot() { return { opened: c.opened }; },
    restore(snap) { c.opened = !!snap.opened; c.t = c.opened ? 1 : 0; },
  };
}

export function createSecretDoor(def) {
  const slots = def.slots.map((s) => ({ ...s, inserted: false }));
  const s = { state: 'locked', timer: 0, t: 0 };
  const api = {
    id: def.id,
    slots,
    get state() { return s.state; },
    insertedCount() { return slots.filter((q) => q.inserted).length; },
    isInserted(keyId) { return slots.some((q) => q.key === keyId && q.inserted); },
    // 0 (tancada) → 1 (oberta). Cada batent llisca `slide` · progress.
    progress() { return smooth(s.t); },
    slideOffset() { return def.slide * smooth(s.t); },
    isOpen() { return s.state === 'open'; },
    // Interacció amb E. Retorna { action: 'examine'|'insert'|'dark', keyId?, message }.
    interact(inventory) {
      if (s.state === 'unlocked' || s.state === 'opening') return { action: 'examine', message: 'El mecanisme grinyola dins la paret... la porta es mou, lenta i pesada.' };
      if (s.state === 'open') return { action: 'dark', message: 'Una foscor freda s\'endinsa darrere la porta. Encara no és hora d\'entrar-hi.' };
      const next = slots.find((q) => !q.inserted && inventory.has(q.key));
      if (next) {
        next.inserted = true;
        const name = inventory.list().find((i) => i.id === next.key).name;
        if (api.insertedCount() === slots.length) {
          s.state = 'unlocked'; s.timer = def.unlockDelay;
          return { action: 'insert', keyId: next.key, message: `Insereixes la ${name}. Les dues claus giren alhora i, dins la paret, un mecanisme es desbloqueja.` };
        }
        const pending = slots.find((q) => !q.inserted);
        return { action: 'insert', keyId: next.key, message: `Insereixes la ${name}. Encara falta l'altra clau (la de la ranura ${pending.key === 'KEY-A' ? 'de la campana' : 'de la lluna'}).` };
      }
      if (api.insertedCount() > 0) {
        const pending = slots.find((q) => !q.inserted);
        return { action: 'examine', message: `Només una ranura està ocupada. Encara falta la clau ${pending.key === 'KEY-A' ? 'del guardià (campana)' : 'dels oblidats (lluna)'}.` };
      }
      return { action: 'examine', message: `Porta segellada. Cal inserir dues claus: una ranura té una campana gravada, l'altra una lluna. "${def.inscription}"` };
    },
    // Desar / carregar (Fase D.3.1): només 'locked' i 'open' són estats quiets; 'unlocked' i 'opening' són animacions en curs.
    isSettled() { return s.state === 'locked' || s.state === 'open'; },
    snapshot() {
      const inserted = {}; for (const q of slots) inserted[q.key] = q.inserted;
      return { state: s.state === 'locked' ? 'locked' : 'open', inserted }; // un estat transitori es normalitza al seu destí (obrint-se → oberta)
    },
    restore(snap) {
      for (const q of slots) q.inserted = !!(snap.inserted && snap.inserted[q.key]);
      s.state = snap.state === 'open' ? 'open' : 'locked'; s.timer = 0; s.t = s.state === 'open' ? 1 : 0;
    },
    update(dt) {
      if (s.state === 'unlocked') {
        s.timer -= dt;
        if (s.timer <= 0) { s.state = 'opening'; s.t = 0; }
      } else if (s.state === 'opening') {
        s.t = clamp01(s.t + dt / def.openSeconds);
        if (s.t >= 1) s.state = 'open';
      }
    },
  };
  return api;
}

// ---------------------------------------------------------------------
// GAMEPLAY: tot el primer puzle junt (inventari, contenidors, claus, porta secreta, porta D1)
// ---------------------------------------------------------------------
// opts: { KEYS, SECRET_DOOR, churchDoor (de doors.js), houseDoors (de houseDoors.js, Fase C: D2, D3, D4; opcional),
//         occluders (col·lisions massisses per a la línia de visió de les portes de casa; opcional), playerRadius (0,35),
//         crypt (Fase D.3, opcional): { def: CRYPT, occluders: parets de la cripta } → afegeix la caixa-pista, l'altar dels discs, el sarcòfag i KEY-C,
//         mausoleum (Fase E, opcional): { mau (de mausoleum.js) } → porta del mausoleu, mecanisme de lloses i clau KEY-BELLS
//         belfry (Fase F, opcional): { bel (de belfry.js) } → porta del campanar (KEY-BELLS, no es gasta) i les tres cordes de les campanes
//         cemeteryGate (Fase D.4, opcional): { gate (de cemeteryGate.js), def: CEM_GATE, mech: CEM_GATE_MECH } → la reixa del cementiri, que s'obre amb KEY-C }
// `view` (opcional a update/pressE) = { level, feetY }: pis i alçada dels peus del jugador (Fase C.1).
export function createGameplay(opts) {
  const { KEYS, SECRET_DOOR, churchDoor, houseDoors = [], playerRadius = 0.35 } = opts;
  const occluders = [...(opts.occluders || []), ...(opts.crypt ? opts.crypt.occluders || [] : []), ...(opts.mausoleum ? opts.mausoleum.occluders || [] : [])];   // Fase E: parets del mausoleu (la porta i la llosa secreta tanquen la vista només mentre són tancades)
  const coneCos = Math.cos((DOOR_INTERACTION.coneDeg / 2) * Math.PI / 180);
  let view = { level: 0, feetY: 0, occluders };
  const setView = (v) => { if (v) view = { level: v.level, feetY: v.feetY, occluders }; };
  const inventory = createInventory();
  const secretDoor = createSecretDoor(SECRET_DOOR);
  const containers = {};
  for (const k of KEYS) containers[k.container] = createContainer({ id: k.container, reveal: k.reveal });
  const taken = new Set();
  const msg = { text: '', ttl: 0 };
  const say = (text, ttl = 5) => { msg.text = text; msg.ttl = ttl; };

  const keyDef = (id) => KEYS.find((k) => k.id === id);
  const keyDescription = KEY_DESCRIPTIONS;
  const containerOf = {};
  for (const k of KEYS) containerOf[k.container] = k;

  const targets = [];
  // 1. Porta de l'església (D1): la tecla E l'obre i la tanca (la lògica és a doors.js).
  targets.push({
    id: 'D1', x: churchDoor.centerX, z: churchDoor.hingeZ, range: churchDoor.interactRange, priority: 0,
    prompt: () => (churchDoor.isOpen() ? 'E - tancar la porta' : 'E - obrir la porta'),
    use: () => { churchDoor.toggle(); return null; },
  });
  // 1b. Portes de les cases (Fase C): comencen tancades; E les obre i les tanca (la lògica és a houseDoors.js).
  const doorsById = {};
  for (const hd of houseDoors) {
    doorsById[hd.id] = hd;
    targets.push({
      id: hd.id, x: hd.interact.x, z: hd.interact.z, range: DOOR_INTERACTION.maxDistance, priority: 0,
      // Interacció espacial (Fase C.1): ≤ 1,8 m, davant (con de 60°), mateix pis, sense parets pel mig.
      spatial: { maxDistance: DOOR_INTERACTION.maxDistance, coneCos, level: hd.level || 0, baseY: 0, maxDy: DOOR_INTERACTION.maxDy },
      prompt: () => (hd.isOpen() ? 'E - tancar la porta' : 'E - obrir la porta'),
      use: (px, pz) => {
        const r = hd.toggle(px, pz, playerRadius);
        if (!r.changed && r.message) say(r.message, 3);
        return null;
      },
    });
  }
  // 2. Contenidors (calaix / arca): s'obren una vegada.
  for (const k of KEYS) {
    const open = k.reveal === 'drawer' ? { x: k.pos.x, z: k.pos.z - 0.25 } : { x: k.pos.x - 0.35, z: k.pos.z };
    targets.push({
      id: `OPEN-${k.container}`, x: open.x, z: open.z, range: 1.9, facing: 0.35, priority: 0.2,
      enabled: () => !containers[k.container].isOpen(),
      prompt: () => (k.reveal === 'drawer' ? 'E - obrir el calaix' : 'E - obrir l\'arca'),
      use: () => {
        containers[k.container].open();
        say(k.reveal === 'drawer' ? 'Obres el calaix. Entre draps vells hi brilla una clau de bronze.' : 'Alces la tapa de l\'arca. Sota una manta podrida hi ha una clau de ferro.');
        return null;
      },
    });
    // 3. La clau, un cop el contenidor és obert.
    targets.push({
      id: k.id, x: k.pos.x, z: k.pos.z, range: k.pickRange, facing: 0.35, priority: 1,
      enabled: () => containers[k.container].isOpen() && !taken.has(k.id),
      prompt: () => `E - recollir la ${k.name.toLowerCase()}`,
      use: () => {
        taken.add(k.id);
        inventory.add({ id: k.id, name: k.name, description: keyDescription[k.material], symbol: k.symbol });
        say(`Has recollit: ${k.name} (${keyDescription[k.material]}).`);
        return { picked: k.id };
      },
    });
  }
  // 4. Porta secreta.
  targets.push({
    id: SECRET_DOOR.id, x: SECRET_DOOR.center.x, z: SECRET_DOOR.center.z, range: SECRET_DOOR.interactRange, facing: 0.5, priority: 0,
    prompt: () => {
      if (secretDoor.state === 'locked') {
        const next = SECRET_DOOR.slots.find((q) => !secretDoor.isInserted(q.key) && inventory.has(q.key));
        return next ? `E - inserir la ${keyDef(next.key).name.toLowerCase()}` : 'E - examinar la porta';
      }
      return secretDoor.state === 'open' ? 'E - mirar la foscor' : '';
    },
    use: () => {
      const r = secretDoor.interact(inventory);
      say(r.message, r.action === 'insert' ? 6 : 7);
      return r;
    },
  });

  // 5. Cripta (Fase D.3): només si es passa `opts.crypt`. No toca cap objectiu anterior (KEY-A/KEY-B, portes, SD).
  const crypt = opts.crypt ? createCryptGame(opts.crypt.def, { inventory, say }) : null;
  if (crypt) {
    targets.push(...crypt.targets);
    // Un cop SD és oberta, el pas existeix: el text d'abans («encara no és hora d'entrar-hi») ja no és cert.
    const sd = targets.find((t) => t.id === SECRET_DOOR.id);
    const sdUse = sd.use; const sdPrompt = sd.prompt;
    sd.prompt = () => (secretDoor.state === 'open' ? '' : sdPrompt());
    sd.use = () => {
      if (secretDoor.state !== 'open') return sdUse();
      say('La porta és oberta. Al darrere, una escala estreta s\'enfonsa a la foscor.', 5);
      return { action: 'dark' };
    };
  }

  // 6. Reixa del cementiri (Fase D.4): només si es passa `opts.cemeteryGate`. S'obre amb KEY-C (que continua a l'inventari). Interacció espacial:
  //    ≤ 1,8 m del pany, mirant-lo (con de 60°), al nivell 0 i sense cap paret pel mig (no s'obre des de lluny ni a través del mur).
  const cg = opts.cemeteryGate || null;
  if (cg) {
    const keyId = cg.mech.keyId;
    targets.push({
      id: cg.def.id, x: cg.def.interactionPoint.x, z: cg.def.interactionPoint.z, range: cg.mech.interact.maxDistance, priority: 0,
      spatial: { maxDistance: cg.mech.interact.maxDistance, coneCos: Math.cos((cg.mech.interact.coneDeg / 2) * Math.PI / 180), level: 0, baseY: 0, maxDy: DOOR_INTERACTION.maxDy },
      enabled: () => cg.gate.state === 'closed',
      prompt: () => (inventory.has(keyId) ? 'E - obrir la reixa amb la clau' : 'E - examinar la reixa'),
      use: () => {
        if (!inventory.has(keyId)) {
          say('La reixa està tancada amb un cadenat vell i una cadena gruixuda. No cedeix: caldria una clau especial.', 6);
          return { action: 'locked' };
        }
        if (cg.gate.open()) say('La clau de la creu gira dins el cadenat. La cadena cau i la reixa grinyola, lenta, cap a dins del cementiri.', 7);
        return { action: 'open' };
      },
    });
  }

  // 7. Mausoleu (Fase E): porta de roure (KEY-C), mecanisme de lloses de la paret oest i clau de bronze del pedestal. La clau KEY-BELLS té id propi i
  //    no interfereix amb KEY-A/B/C. Les tres interaccions són espacials (distància, mirada i cap paret pel mig) i al nivell 0.
  const mu = opts.mausoleum || null;
  if (mu) {
    const D = mu.mau.def; const spatial = (it) => ({ maxDistance: it.interact.maxDistance, coneCos: Math.cos((it.interact.coneDeg / 2) * Math.PI / 180), level: 0, baseY: 0, maxDy: DOOR_INTERACTION.maxDy });
    targets.push({
      id: D.door.id, x: D.door.interactionPoint.x, z: D.door.interactionPoint.z, range: D.door.interact.maxDistance, priority: 0, spatial: spatial(D.door),
      enabled: () => mu.mau.doorState === 'closed',
      prompt: () => (inventory.has(D.door.keyId) ? 'E - obrir el mausoleu amb la clau' : 'E - examinar la porta'),
      use: () => {
        if (!inventory.has(D.door.keyId)) { say('La porta de roure està barrada amb una cinta de ferro i un travesser. Al pany hi ha una creu gravada: caldria la clau del cementiri.', 6); return { action: 'locked' }; }
        if (mu.mau.openDoor()) say('La clau de la creu gira al pany amagat sota la cinta de ferro. El travesser cedeix i la porta s\'obre, lenta, cap enfora.', 7);
        return { action: 'open' };
      },
    });
    targets.push({
      id: D.board.id, x: D.board.interactionPoint.x, z: D.board.interactionPoint.z, range: D.board.interact.maxDistance, priority: 0, spatial: spatial(D.board),
      enabled: () => mu.mau.puzzleAvailable(),
      prompt: () => 'E - examinar el mecanisme de lloses',
      use: () => { mu.mau.requestPuzzle(); return { action: 'puzzle' }; },
    });
    targets.push({
      id: D.pedestal.id, x: D.pedestal.interactionPoint.x, z: D.pedestal.interactionPoint.z, range: D.pedestal.interact.maxDistance, priority: 0, spatial: spatial(D.pedestal),
      enabled: () => mu.mau.keyAvailable(),
      prompt: () => 'E - agafar la clau de bronze',
      use: () => {
        if (!mu.mau.takeKey()) return { action: 'none' };
        const K = D.key; inventory.add({ id: K.id, name: K.name, description: K.description, symbol: K.symbol });
        say('Agafes la clau de bronze del pedestal. Pesa més del que sembla. Tres campanes, gravades a l\'anella.', 7);
        return { action: 'take' };
      },
    });
  }

  // 8. Campanar (Fase F): porta de la paret oest de la nau (KEY-BELLS, que NO es gasta) i les tres cordes de la sala de les campanes (nivell 1, y = 7).
  const be = opts.belfry || null;
  if (be) {
    const D = be.bel.def.door; const cone = (it) => Math.cos((it.coneDeg / 2) * Math.PI / 180);
    targets.push({
      id: D.id, x: D.interactionPoint.x, z: D.interactionPoint.z, range: D.interact.maxDistance, priority: 0,
      spatial: { maxDistance: D.interact.maxDistance, coneCos: cone(D.interact), level: 0, baseY: 0, maxDy: DOOR_INTERACTION.maxDy },
      enabled: () => be.bel.doorState === 'closed',
      prompt: () => (inventory.has(D.keyId) ? 'E - obrir la porta amb la clau' : 'E - examinar la porta'),
      use: () => {
        if (!inventory.has(D.keyId)) { say(BELFRY_TEXT.doorLocked, 7); return { action: 'locked' }; }
        if (be.bel.openDoor()) say(BELFRY_TEXT.doorOpen, 8);   // la clau continua a l'inventari
        return { action: 'open' };
      },
    });
    const R = be.bel.def.rope; const floorY = be.bel.def.tower.floorY;
    be.bel.def.bells.forEach((bell, i) => {
      targets.push({
        id: `BEL-ROPE-${bell.id}`, x: bell.rope.x, z: bell.rope.z, range: R.interact.maxDistance, priority: 0,
        spatial: { maxDistance: R.interact.maxDistance, coneCos: cone(R.interact), level: 1, baseY: floorY, maxDy: DOOR_INTERACTION.maxDy },
        enabled: () => be.bel.isOpen() && !be.bel.resonating,
        prompt: () => BELFRY_TEXT.ropeHint,
        use: () => {
          const e = be.bel.ring(i);
          if (!e) return { action: 'none' };
          if (e.free) say(BELFRY_TEXT.afterSolved, 4);
          else if (!e.correct) say(BELFRY_TEXT.wrong, 4);
          else if (e.progress < be.bel.def.solution.length) say(BELFRY_TEXT.step, 4);
          else say(BELFRY_TEXT.solved, 9);
          return { action: 'ring', bell: bell.id };
        },
      });
    });
  }

  // Definició d'un objecte de l'inventari a partir del seu id (per recuperar-lo en carregar una partida; mai se'n dupliquen).
  const itemDef = (id) => {
    const k = keyDef(id);
    if (k) return { id: k.id, name: k.name, description: keyDescription[k.material], symbol: k.symbol };
    if (opts.crypt && id === opts.crypt.def.keyC.id) { const K = opts.crypt.def.keyC; return { id: K.id, name: K.name, description: K.description, symbol: K.symbol }; }
    if (mu && id === mu.mau.def.key.id) { const K = mu.mau.def.key; return { id: K.id, name: K.name, description: K.description, symbol: K.symbol }; }
    return null;
  };
  const allKeyIds = () => [...KEYS.map((k) => k.id), ...(opts.crypt ? [opts.crypt.def.keyC.id] : []), ...(mu ? [mu.mau.def.key.id] : [])];

  let current = null;
  const api = {
    inventory, secretDoor, containers, targets, houseDoors: doorsById, crypt, churchDoor, cemeteryGate: cg ? cg.gate : null, mausoleum: mu ? mu.mau : null, belfry: be ? be.bel : null,
    knownItemIds: allKeyIds,
    // --- Desar / carregar (Fase D.3.1) ---
    // Tot l'estat de la partida que viu aquí. Un estat transitori es normalitza al seu destí; `isSettled()` diu si NO n'hi ha cap en curs.
    isSettled() {
      return !churchDoor.isAnimating() && secretDoor.isSettled() && Object.values(containers).every((c) => c.isSettled())
        && houseDoors.every((hd) => hd.isSettled()) && (!crypt || crypt.isSettled()) && (!cg || cg.gate.isSettled()) && (!mu || mu.mau.isSettled()) && (!be || be.bel.isSettled());
    },
    snapshot() {
      const cont = {}; for (const [id, c] of Object.entries(containers)) cont[id] = c.snapshot();
      const hds = {}; for (const hd of houseDoors) hds[hd.id] = hd.snapshot();
      return {
        inventory: inventory.list().map((i) => i.id), taken: [...taken],
        churchDoor: { angles: churchDoor.angles().slice() },
        houseDoors: hds, containers: cont, secretDoor: secretDoor.snapshot(),
        crypt: crypt ? crypt.snapshot() : null,
        ...(cg ? { cemeteryGate: cg.gate.snapshot() } : {}),
        ...(mu ? { mausoleum: mu.mau.snapshot() } : {}),
        ...(be ? { belfry: be.bel.snapshot() } : {}),
      };
    },
    // Aplica un estat JA VALIDAT (saveGame.validateSave). No emet esdeveniments ni sons i buida missatges i objectiu.
    restore(snap) {
      for (const it of inventory.list()) inventory.remove(it.id);
      for (const id of snap.inventory) { const d = itemDef(id); if (d) inventory.add(d); }
      taken.clear(); for (const id of snap.taken) taken.add(id);
      churchDoor.setAngles(snap.churchDoor.angles[0], snap.churchDoor.angles[1]);
      for (const hd of houseDoors) if (snap.houseDoors[hd.id]) hd.restore(snap.houseDoors[hd.id]);
      for (const [id, c] of Object.entries(containers)) c.restore(snap.containers[id] || { opened: false });
      secretDoor.restore(snap.secretDoor);
      if (crypt && snap.crypt) crypt.restore(snap.crypt);
      if (mu) mu.mau.restore(snap.mausoleum || null);                  // partides anteriors a la Fase E: mausoleu tancat i tauler inicial
      if (be) be.bel.restore(snap.belfry || null);                     // partides anteriors a la Fase F: porta del campanar tancada, campanes sense resoldre
      if (cg) cg.gate.restore(snap.cemeteryGate || { open: false });   // partides de la D.3.1 (sense aquest camp): reixa tancada
      msg.text = ''; msg.ttl = 0; current = null;
    },
    get message() { return msg.ttl > 0 ? msg.text : ''; },
    // L'objecte que activaria E ara mateix (o null) i el seu text d'indicació.
    get target() { return current; },
    get prompt() { return current ? current.prompt() : ''; },
    // Indicació discreta no actuable (Fase D.3): només quan no hi ha cap objectiu.
    hint(px, pz) { return !current && crypt ? crypt.hint(px, pz) : ''; },
    hasKeyTaken(id) { return taken.has(id); },
    // A cridar cada fotograma. (dirX, dirZ) = mirada horitzontal.
    update(dt, px, pz, dirX, dirZ, v) {
      setView(v);
      secretDoor.update(dt);
      for (const c of Object.values(containers)) c.update(dt);
      for (const hd of houseDoors) hd.update(dt);
      if (crypt) crypt.update(dt, px, pz, dirX, dirZ);
      if (cg) cg.gate.update(dt);
      if (mu) mu.mau.update(dt);
      if (be) be.bel.update(dt);
      if (msg.ttl > 0) msg.ttl -= dt;
      current = pickTarget(targets, px, pz, dirX, dirZ, view);
    },
    // Tecla E: activa NOMÉS l'objecte seleccionat. Retorna el seu id o null.
    pressE(px, pz, dirX, dirZ, v) {
      setView(v);
      current = pickTarget(targets, px, pz, dirX, dirZ, view);
      if (!current) return null;
      const t = current;
      if (crypt) crypt.update(0, px, pz, dirX, dirZ); // la mirada actual (per triar disc)
      t.use(px, pz, dirX, dirZ);
      current = pickTarget(targets, px, pz, dirX, dirZ, view);
      return t.id;
    },
  };
  return api;
}
