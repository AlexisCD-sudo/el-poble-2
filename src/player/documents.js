// =====================================================================
// THE FORGOTTEN VILLAGE — DOCUMENTS I NOTES DESCOBERTS (Fase D.3.1, matemàtiques pures, sense DOM ni Three.js)
// =====================================================================
// Registre de documents del joc. Un document NOMÉS és visible al menú quan s'ha descobert (llegit): els no descoberts no revelen
// ni títol, ni text, ni quants n'hi ha. Per afegir-ne un de nou en fases futures n'hi ha prou amb una entrada a `documentDefs(CRYPT)`.
// =====================================================================

export const DOCUMENT_IDS = { symbolNote: 'note-symbols' };

// Definicions (el text complet viu aquí; el de la nota dels tres símbols és el mateix que es mostra a la caixa-pista: CRYPT.clue).
export function documentDefs(crypt) {
  const clue = crypt && crypt.clue;
  return [
    {
      id: DOCUMENT_IDS.symbolNote,
      title: 'Nota de la caixa',
      source: 'Trobada a la casa de dues plantes, pis superior',
      text: clue ? `«${clue.text.replace(/^«|»$/g, '')}»` : '',
      symbols: clue ? clue.order.slice() : [],           // els tres símbols de la nota, en l'ordre en què hi apareixen
    },
  ];
}

export function createDocuments(defs) {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const found = new Set();
  const order = []; // ordre de descoberta
  return {
    knownIds: () => [...byId.keys()],
    isKnown: (id) => byId.has(id),
    // Descobreix un document. Retorna true si és nou (cap duplicat; ids desconeguts s'ignoren).
    discover(id) {
      if (!byId.has(id) || found.has(id)) return false;
      found.add(id); order.push(id); return true;
    },
    has: (id) => found.has(id),
    count: () => found.size,
    // Només els descoberts, en l'ordre en què s'han trobat, amb el text complet.
    list: () => order.map((id) => ({ ...byId.get(id) })),
    snapshot: () => order.slice(),
    // Substitueix l'estat per la llista (ja validada) i hi reposa els descoberts.
    restore(ids) {
      found.clear(); order.length = 0;
      for (const id of ids) if (byId.has(id) && !found.has(id)) { found.add(id); order.push(id); }
    },
  };
}
