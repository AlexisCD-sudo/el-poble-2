// =====================================================================
// THE FORGOTTEN VILLAGE — MODEL DE DADES DEL MENÚ DE PAUSA (Fase D.3.1, lògica pura, sense DOM)
// =====================================================================
// Converteix l'estat del joc en el que el menú ha de MOSTRAR. Regla d'or: tot el que el jugador encara no ha aconseguit o descobert
// apareix com a desconegut i NO revela ni el nom, ni la descripció, ni el símbol (p. ex. «Clau del cementiri» no surt fins que s'agafa).
// =====================================================================

export const UNKNOWN_KEY = { name: 'Clau desconeguda', description: 'Encara no has trobat aquesta clau.' };

// Tres espais d'inventari: KEY-A, KEY-B (KEYS del layout) i KEY-C (CRYPT.keyC). `ownedIds` = ids de l'inventari real.
export function inventoryEntries(defs, ownedIds) {
  const owned = new Set(ownedIds);
  const slots = [
    ...defs.KEYS.map((k, i) => ({ id: k.id, slot: ['A', 'B', 'C'][i], name: k.name, symbol: k.symbol, material: k.material, description: defs.keyDescription(k) })),
    { id: defs.CRYPT.keyC.id, slot: 'C', name: defs.CRYPT.keyC.name, symbol: defs.CRYPT.keyC.symbol, material: defs.CRYPT.keyC.material, description: defs.CRYPT.keyC.description },
  ];
  slots.forEach((s, i) => { s.slot = ['A', 'B', 'C'][i]; });
  // Fase E: la clau del mausoleu (KEY-BELLS) només apareix quan l'has agafada (no es revela abans que existeixi un quart espai).
  const mk = defs.MAUSOLEUM && defs.MAUSOLEUM.key;
  if (mk && owned.has(mk.id)) slots.push({ id: mk.id, slot: 'D', name: mk.name, symbol: mk.symbol, material: mk.material, description: mk.description });
  return slots.map((s) => (owned.has(s.id)
    ? { ...s, collected: true }
    : { id: s.id, slot: s.slot, collected: false, name: UNKNOWN_KEY.name, description: UNKNOWN_KEY.description, symbol: null, material: null }));
}

export function inventorySummary(entries) {
  const n = entries.filter((e) => e.collected).length;
  return n === 0 ? `Cap clau de ${entries.length}` : `${n} de ${entries.length} claus`;   // el zero no té glif a la font del joc
}

// Documents: només els descoberts (res dels que no). `docs` = documents.list().
export function documentEntries(docs) {
  return docs.map((d) => ({ id: d.id, title: d.title, source: d.source, text: d.text, symbols: d.symbols || [] }));
}
export const NO_DOCUMENTS_TEXT = 'Encara no has trobat cap document.';
export const NO_SAVE_TEXT = 'No hi ha cap partida guardada.';
