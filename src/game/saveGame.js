// =====================================================================
// THE FORGOTTEN VILLAGE — DESAR I CARREGAR LA PARTIDA (Fase D.3.1, lògica pura, sense DOM ni Three.js)
// =====================================================================
// FORMAT (JSON a localStorage, clau SAVE_KEY, versió SAVE_VERSION):
//   { game, version, savedAt, player:{x,z,yaw,pitch,level,feetY}, state:{ ...gameplay.snapshot() }, documents:[ids], map:{discovered,visited} }
//   state = inventari (ids), claus agafades, angles de D1, portes de casa {open,side}, contenidors {opened}, porta secreta
//   {state:'locked'|'open', inserted}, cripta {discs, discTurns, solved, sarc:'locked'|'unlocked'|'open', keyTaken, noteSeen},
//   cemeteryGate {open} (Fase D.4; les partides de la D.3.1 no el tenen i es carreguen amb la reixa tancada).
//
// SEGURETAT:
//   · canSave(): només es desa amb TOT l'estat quiet (cap porta, mecanisme, calaix, disc ni sarcòfag en moviment) i amb el jugador en
//     una posició vàlida (dins del recinte, lliure d'obstacles al seu nivell, alçada coherent). Així mai es desa un estat a mig fer.
//   · validateSave(): abans d'aplicar res es comprova l'estructura, els tipus, els rangs i la COHERÈNCIA (p. ex. KEY-C a l'inventari ⇔
//     sarcòfag obert i clau agafada; una clau inserida ha de ser a l'inventari; cap clau duplicada; el puzle resolt ⇔ símbols correctes).
//   · applyState(): és TRANSACCIONAL. Aplica l'estat, comprova que la posició és lliure amb les portes ja restaurades i, si no, ho
//     desfà tot i deixa la partida com estava. Carregar no duplica res: el contingut es SUBSTITUEIX (no se suma).
// =====================================================================

import { isPositionFree } from '../player/collisions.js';
import { validCells, reachableFrom, isSolution } from '../player/slabPuzzle.js';   // Fase E: tauler de les lloses

export const SAVE_KEY = 'the-forgotten-village:save';
export const SAVE_VERSION = 1;
export const GAME_ID = 'the-forgotten-village';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const uniq = (arr) => new Set(arr).size === arr.length;

// ---------------------------------------------------------------------
// CAPTURA. ctx = { gameplay, getPose(), documents, mapProgress, now?() }
// ---------------------------------------------------------------------
export function captureState(ctx) {
  const p = ctx.getPose();
  return {
    game: GAME_ID, version: SAVE_VERSION,
    savedAt: (ctx.now ? ctx.now() : new Date()).toISOString(),
    player: { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, level: p.level, feetY: p.feetY },
    state: ctx.gameplay.snapshot(),
    documents: ctx.documents.snapshot(),
    map: ctx.mapProgress.snapshot(),
  };
}

// ¿Es pot desar ara? → { ok, reason }. ctx afegeix: colliders, radius.
export function canSave(ctx) {
  if (!ctx.gameplay.isSettled()) return { ok: false, reason: 'Hi ha una animació en curs (porta, mecanisme, calaix, disc o sarcòfag). Espera un moment i torna-ho a provar.' };
  const p = ctx.getPose();
  if (![p.x, p.z, p.yaw, p.pitch, p.feetY].every(isNum) || ![-1, 0, 1].includes(p.level)) return { ok: false, reason: 'La posició del jugador no és vàlida.' };
  if (Math.abs(p.x) > (ctx.mapLimit || 95) || Math.abs(p.z) > (ctx.mapLimit || 95)) return { ok: false, reason: 'El jugador és fora del poble.' };
  if (!isPositionFree(p.x, p.z, ctx.radius, ctx.colliders, 1e-4, p.level)) return { ok: false, reason: 'No es pot desar des d\'aquesta posició (hi ha un obstacle). Mou-te una mica i torna-ho a provar.' };
  return { ok: true, reason: '' };
}

// ---------------------------------------------------------------------
// VALIDACIÓ. defs = { KEYS, CRYPT, SECRET_DOOR, BELFRY (Fase F, opcional: porta i campanes del campanar), houseDoorIds, churchLimits:{min,max} (rad), documentIds, noteDocumentId, zoneIds, levelSplit, levelSplitDown, mapLimit, CEM_AREA (opcional) }
// Retorna { ok, errors[] } sense modificar res.
// ---------------------------------------------------------------------
export function validateSave(data, defs) {
  const errors = [];
  const bad = (m) => { errors.push(m); };
  if (!isObj(data)) return { ok: false, errors: ['la partida no és un objecte'] };
  if (data.game !== GAME_ID) bad('no és una partida de The Forgotten Village');
  if (data.version !== SAVE_VERSION) bad(`versió ${String(data.version)} no compatible (cal ${SAVE_VERSION})`);
  if (typeof data.savedAt !== 'string' || Number.isNaN(Date.parse(data.savedAt))) bad('data de desat invàlida');

  const lim = defs.mapLimit || 95;
  const pl = data.player;
  if (!isObj(pl)) bad('falta player');
  else {
    if (!isNum(pl.x) || !isNum(pl.z) || Math.abs(pl.x) > lim || Math.abs(pl.z) > lim) bad('posició fora del món');
    if (!isNum(pl.yaw) || !isNum(pl.pitch) || Math.abs(pl.pitch) > Math.PI / 2) bad('orientació invàlida');
    if (![-1, 0, 1].includes(pl.level)) bad('nivell invàlid');
    if (!isNum(pl.feetY) || pl.feetY < -10 || pl.feetY > 10) bad('alçada invàlida');
  }

  const st = data.state;
  if (!isObj(st)) { bad('falta state'); return { ok: false, errors }; }
  const keyIds = [...defs.KEYS.map((k) => k.id), defs.CRYPT.keyC.id, ...(defs.MAUSOLEUM ? [defs.MAUSOLEUM.key.id] : [])];   // Fase E: KEY-BELLS
  const A = defs.KEYS[0]; const B = defs.KEYS[1];

  // inventari i claus agafades
  if (!Array.isArray(st.inventory) || !st.inventory.every((i) => typeof i === 'string' && keyIds.includes(i))) bad('inventari invàlid');
  else if (!uniq(st.inventory)) bad('inventari amb claus duplicades');
  if (!Array.isArray(st.taken) || !st.taken.every((i) => defs.KEYS.some((k) => k.id === i))) bad('claus agafades invàlides');
  else if (!uniq(st.taken)) bad('claus agafades duplicades');

  // contenidors
  const containers = isObj(st.containers) ? st.containers : null;
  if (!containers || !defs.KEYS.every((k) => isObj(containers[k.container]) && typeof containers[k.container].opened === 'boolean')) bad('contenidors invàlids');

  // porta secreta
  const sd = st.secretDoor; const slotKeys = defs.SECRET_DOOR.slots.map((q) => q.key);
  if (!isObj(sd) || !['locked', 'open'].includes(sd.state) || !isObj(sd.inserted) || !slotKeys.every((k) => typeof sd.inserted[k] === 'boolean')) bad('porta secreta invàlida');

  // porta de l'església
  const cd = st.churchDoor;
  if (!isObj(cd) || !Array.isArray(cd.angles) || cd.angles.length !== 2 || !cd.angles.every((a) => isNum(a) && a >= defs.churchLimits.min - 1e-9 && a <= defs.churchLimits.max + 1e-9)) bad('porta de l\'església invàlida');

  // portes de casa
  const hd = st.houseDoors;
  if (!isObj(hd) || !defs.houseDoorIds.every((id) => isObj(hd[id]) && typeof hd[id].open === 'boolean' && (hd[id].side === 1 || hd[id].side === -1))) bad('portes de casa invàlides');

  // cripta
  const cr = st.crypt; const P = defs.CRYPT.puzzle; const n = P.symbols.length;
  if (!isObj(cr)) bad('cripta invàlida');
  else {
    const okDiscs = Array.isArray(cr.discs) && cr.discs.length === 3 && cr.discs.every((d) => Number.isInteger(d) && d >= 0 && d < n);
    const okTurns = Array.isArray(cr.discTurns) && cr.discTurns.length === 3 && cr.discTurns.every((t) => Number.isInteger(t) && t >= 0 && t < 4000);
    if (!okDiscs || !okTurns) bad('discs invàlids');
    else for (let i = 0; i < 3; i++) {
      const start = P.symbols.indexOf(P.start[i]);
      if ((((start + cr.discTurns[i]) % n) + n) % n !== cr.discs[i]) bad(`disc ${i + 1}: els girs no quadren amb el símbol`);
    }
    if (typeof cr.solved !== 'boolean' || !['locked', 'unlocked', 'open'].includes(cr.sarc) || typeof cr.keyTaken !== 'boolean' || typeof cr.noteSeen !== 'boolean') bad('estat de la cripta invàlid');
    if (okDiscs && typeof cr.solved === 'boolean') {
      const isSol = cr.discs.every((d, i) => P.symbols[d] === P.solution[i]);
      if (cr.solved !== isSol) bad('puzle resolt incoherent amb els discs');
    }
    if (cr.sarc !== 'locked' && !cr.solved) bad('sarcòfag desbloquejat sense resoldre el puzle');
    if (cr.solved && cr.sarc === 'locked') bad('puzle resolt amb el sarcòfag encara bloquejat');
    if (cr.keyTaken && cr.sarc !== 'open') bad('KEY-C agafada amb el sarcòfag tancat');
  }

  // reixa del cementiri (Fase D.4): camp opcional (partides antigues = tancada)
  const gateSnap = st.cemeteryGate;
  if (gateSnap !== undefined && (!isObj(gateSnap) || typeof gateSnap.open !== 'boolean')) bad('reixa del cementiri invàlida');

  // mausoleu (Fase E): camp opcional (partides antigues = porta tancada, tauler inicial, sense clau). Només s'accepta un estat que es pugui assolir jugant.
  const mau = st.mausoleum; let mauOk = true;
  if (mau !== undefined && defs.MAUSOLEUM) {
    const pz = isObj(mau) ? mau.puzzle : null;
    if (!isObj(mau) || typeof mau.doorOpen !== 'boolean' || typeof mau.secretOpen !== 'boolean' || typeof mau.keyTaken !== 'boolean' || !isObj(pz)
      || !validCells(pz.cells) || !Number.isInteger(pz.moves) || pz.moves < 0 || pz.moves > 100000) { bad('mausoleu invàlid'); mauOk = false; }
    else if (!reachableFrom(defs.SLAB_PUZZLE.start, pz.cells)) { bad('tauler de lloses impossible (no s\'hi arriba des de l\'inicial)'); mauOk = false; }
  }

  // campanar (Fase F): camp opcional (partides antigues = porta tancada, campanes sense resoldre). La seqüència parcial i les oscil·lacions no es desen.
  const bel = st.belfry; let belOk = true;
  if (bel !== undefined && defs.BELFRY && (!isObj(bel) || typeof bel.doorOpen !== 'boolean' || typeof bel.solved !== 'boolean')) { bad('campanar invàlid'); belOk = false; }

  // coherència entre peces (només si l'estructura bàsica és correcta)
  if (errors.length === 0) {
    const inv = new Set(st.inventory); const taken = new Set(st.taken);
    for (const k of defs.KEYS) {
      if (taken.has(k.id) !== inv.has(k.id)) errors.push(`${k.id}: agafada i inventari no coincideixen`);
      if (taken.has(k.id) && !containers[k.container].opened) errors.push(`${k.id}: agafada amb el contenidor tancat`);
    }
    if (inv.has(defs.CRYPT.keyC.id) !== cr.keyTaken) errors.push('KEY-C a l\'inventari i al sarcòfag no coincideixen');
    for (const q of slotKeys) if (sd.inserted[q] && !inv.has(q)) errors.push(`${q}: inserida però no és a l'inventari`);
    const all = slotKeys.every((q) => sd.inserted[q]);
    if (sd.state === 'open' && !all) errors.push('porta secreta oberta sense les dues claus');
    if (sd.state === 'locked' && all) errors.push('porta secreta amb les dues claus inserides però tancada');
    const gateOpen = !!(gateSnap && gateSnap.open);
    if (gateOpen && !inv.has(defs.CRYPT.keyC.id)) errors.push('reixa del cementiri oberta sense KEY-C a l\'inventari');
    if (!gateOpen && pl && defs.CEM_AREA && [defs.CEM_AREA.clos, defs.CEM_AREA.vestibule].some((r) => pl.x >= r.xMin && pl.x <= r.xMax && pl.z >= r.zMin && pl.z <= r.zMax)) errors.push('jugador dins el cementiri amb la reixa tancada');
    if (mau !== undefined && defs.MAUSOLEUM && mauOk) {
      const solved = isSolution(mau.puzzle.cells, defs.SLAB_PUZZLE);
      const slabsTouched = mau.puzzle.moves > 0 || mau.puzzle.cells.join() !== defs.SLAB_PUZZLE.start.join();
      if (mau.doorOpen && !inv.has(defs.CRYPT.keyC.id)) errors.push('mausoleu obert sense KEY-C a l\'inventari');
      if (!mau.doorOpen && (slabsTouched || mau.secretOpen || mau.keyTaken)) errors.push('progrés al mausoleu amb la porta tancada');
      if (solved !== mau.secretOpen) errors.push('porta secreta incoherent amb el tauler de lloses');
      if (mau.keyTaken && !mau.secretOpen) errors.push('clau del mausoleu agafada amb la cambra tancada');
      if (inv.has(defs.MAUSOLEUM.key.id) !== mau.keyTaken) errors.push('clau del mausoleu: inventari i pedestal no coincideixen');
      const I = defs.MAUSOLEUM.interior;
      if (!mau.doorOpen && pl && pl.x > I.xMin && pl.x < I.xMax && pl.z > I.zMin && pl.z < I.zMax) errors.push('jugador dins el mausoleu amb la porta tancada');
    } else if (mau === undefined && defs.MAUSOLEUM && inv.has(defs.MAUSOLEUM.key.id)) errors.push('clau del mausoleu sense estat del mausoleu');
    if (defs.BELFRY && belOk) {
      const doorOpen = !!(bel && bel.doorOpen); const solved = !!(bel && bel.solved); const keyId = defs.MAUSOLEUM ? defs.MAUSOLEUM.key.id : defs.BELFRY.door.keyId;
      if (doorOpen && !inv.has(keyId)) errors.push('campanar obert sense KEY-BELLS a l\'inventari');
      if (solved && !doorOpen) errors.push('campanes resoltes amb la porta del campanar tancada');
      const T = defs.BELFRY.tower.interior;
      if (!doorOpen && pl && pl.x > T.xMin && pl.x < T.xMax && pl.z > T.zMin && pl.z < T.zMax) errors.push('jugador dins el campanar amb la porta tancada');
    }
    const crypticProgress = cr.solved || cr.keyTaken || cr.sarc !== 'locked' || cr.discTurns.some((t) => t > 0);
    if (crypticProgress && sd.state !== 'open') errors.push('progrés a la cripta amb la porta secreta tancada');
    if (pl && pl.level === -1 && sd.state !== 'open') errors.push('jugador a la cripta amb la porta secreta tancada');
    const up = defs.levelSplit; const down = defs.levelSplitDown;       // 1,4 i −1,4 m: la mateixa regla que floors.levelFor()
    if (pl && pl.level === 1 && !(pl.feetY > up - 1e-6)) errors.push('nivell 1 amb alçada de peus incoherent');
    if (pl && pl.level === -1 && !(pl.feetY < down + 1e-6)) errors.push('nivell −1 amb alçada de peus incoherent');
    if (pl && pl.level === 0 && !(pl.feetY >= down - 1e-6 && pl.feetY <= up + 1e-6)) errors.push('nivell 0 amb alçada de peus incoherent');
  }

  // documents i mapa
  if (!Array.isArray(data.documents) || !data.documents.every((d) => typeof d === 'string' && defs.documentIds.includes(d)) || !uniq(data.documents)) bad('documents invàlids');
  else if (isObj(st.crypt) && st.crypt.noteSeen && !data.documents.includes(defs.noteDocumentId)) bad('nota vista però el document no consta');
  const mp = data.map;
  if (!isObj(mp) || !Array.isArray(mp.discovered) || !Array.isArray(mp.visited)
    || ![...mp.discovered, ...mp.visited].every((z) => typeof z === 'string' && defs.zoneIds.includes(z))) bad('mapa invàlid');

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------
// APLICAR (transaccional). ctx = { gameplay, getPose(), setPose(pose), documents, mapProgress, colliders, radius, afterRestore?() }
// ---------------------------------------------------------------------
export function applyState(ctx, data, defs) {
  const v = validateSave(data, defs);
  if (!v.ok) return { ok: false, error: 'La partida desada no és vàlida i no s\'ha carregat.', errors: v.errors };
  const before = { pose: ctx.getPose(), state: ctx.gameplay.snapshot(), documents: ctx.documents.snapshot(), map: ctx.mapProgress.snapshot() };
  const put = (d) => {
    ctx.gameplay.restore(d.state);
    ctx.documents.restore(d.documents);
    if (d.state.crypt && d.state.crypt.noteSeen) ctx.documents.discover(defs.noteDocumentId);
    ctx.mapProgress.restore(d.map);
    if (ctx.afterRestore) ctx.afterRestore();   // p. ex. obrir/tancar el pas de la cripta segons la porta secreta (cryptAccess.sync)
    ctx.setPose(d.pose);
  };
  try {
    put({ state: data.state, documents: data.documents, map: data.map, pose: data.player });
    const p = data.player;
    if (!isPositionFree(p.x, p.z, ctx.radius, ctx.colliders, 1e-4, p.level)) throw new Error('posició ocupada');
  } catch (e) {
    put(before); // desfà-ho tot: la partida continua exactament com estava
    return { ok: false, error: 'No s\'ha pogut carregar: la posició desada no és vàlida. La partida actual no ha canviat.', errors: [String(e.message || e)] };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// EMMAGATZEMATGE (injectat: localStorage al navegador, un objecte simulat als tests)
// ---------------------------------------------------------------------
export function readSave(storage) {
  let raw;
  try { raw = storage.getItem(SAVE_KEY); } catch (e) { return { status: 'unavailable', data: null }; }
  if (raw === null || raw === undefined) return { status: 'none', data: null };
  try { return { status: 'ok', data: JSON.parse(raw) }; } catch (e) { return { status: 'corrupt', data: null }; }
}

export function writeSave(storage, data) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(data)); return { ok: true }; } catch (e) { return { ok: false, error: 'El navegador no deixa desar (emmagatzematge ple o bloquejat).' }; }
}

// Data llegible d'un desat, amb paraules: «20 de novembre de 2026, 10 h 30 min». La font del joc (Pixel Monastery Script) escriu els números
// com a xifres romanes i el zero no té glif: per això no hi ha «00» ni «:»; els minuts a zero s'ometen i la mitjanit s'escriu amb paraules.
const MONTHS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
export function formatSavedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const month = MONTHS[d.getMonth()]; const de = /^[aeiou]/.test(month) ? "d'" : 'de ';
  const h = d.getHours(); const m = d.getMinutes();
  const time = `${h === 0 ? 'mitjanit' : `${h} h`}${m ? ` ${m} min` : ''}`;
  return `${d.getDate()} ${de}${month} de ${d.getFullYear()}, ${time}`;
}
