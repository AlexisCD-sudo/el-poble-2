// =====================================================================
// THE FORGOTTEN VILLAGE — DADES DEL MAPA I ZONES DESCOBERTES (Fase D.3.1, lògica pura, sense DOM ni Three.js)
// =====================================================================
// El mapa és un esquema 2D (vista des de dalt, nord amunt = −Z). Es dedueix del layout: edificis, plaça, carrers, cementiri, reixa del
// bosc i cripta. NO es mostra res que el jugador no hagi descobert (boira de guerra):
//   · una zona es REVELA («coneguda») quan el jugador s'hi apropa a menys de `reveal.distance` metres, o per una regla especial:
//       'start' = visible des del principi (el camí d'entrada i la reixa del bosc, on comença la partida);
//       'crypt' = la cripta es revela quan la porta secreta s'obre (se'n descobreix l'existència) o quan el jugador hi entra;
//   · una zona és «visitada» quan el jugador ha estat DINS del seu perímetre (o, a la cripta, al nivell −1).
//   · «accessible»: false = es veu però encara no s'hi pot anar (la reixa del bosc, el cementiri fins a la Fase D.4; la cripta fins que SD s'obre).
// =====================================================================

const R = (r) => ({ xMin: r.xMin, xMax: r.xMax, zMin: r.zMin, zMax: r.zMax });
const fp = (b) => R(b.visual.footprint);

// Distància (m) d'un punt a un rectangle (0 si és a dins).
export function distToRect(x, z, r) {
  return Math.hypot(Math.max(0, r.xMin - x, x - r.xMax), Math.max(0, r.zMin - z, z - r.zMax));
}
export const inRect = (x, z, r) => x >= r.xMin && x <= r.xMax && z >= r.zMin && z <= r.zMax;

// layout = { PLAZA, BUILDINGS, CEM_AREA, CRYPT, CRYPT_FLOORS, GATE, WALLS }
export function buildMapData(layout) {
  const b = (id) => layout.BUILDINGS.find((q) => q.id === id);
  const church = b('CH-N'); const tower = b('CH-T');
  const gateZ = layout.GATE.center.z;
  const zones = [
    { id: 'entrada', name: 'Camí d\'entrada', kind: 'road', rects: [{ xMin: -2, xMax: 2, zMin: 9, zMax: gateZ }], reveal: 'start', accessible: true },
    { id: 'bosc', name: 'Entrada del bosc', kind: 'forest', rects: [{ xMin: -9, xMax: 9, zMin: gateZ + 0.4, zMax: gateZ + 9 }], reveal: 'start', accessible: false, lockedNote: 'reixa tancada' },
    { id: 'placa', name: 'Plaça', kind: 'plaza', rects: [R(layout.PLAZA.bounds)], reveal: { distance: 24 }, accessible: true },
    { id: 'esglesia', name: 'Església', kind: 'church', rects: [fp(church), fp(tower)], inside: [R(church.visual.interior.footprint)], reveal: { distance: 20 }, accessible: true },
    { id: 'casa-oest', name: 'Casa oest', kind: 'house', rects: [fp(b('HA'))], inside: [R(b('HA').visual.interior.footprint)], reveal: { distance: 16 }, accessible: true },
    { id: 'casa-est', name: 'Casa est', kind: 'house', rects: [fp(b('HB'))], inside: [R(b('HB').visual.interior.footprint)], reveal: { distance: 16 }, accessible: true },
    { id: 'casa-gran', name: 'Casa gran', kind: 'house', rects: [fp(b('HC'))], inside: [R(b('HC').visual.interior.footprint)], reveal: { distance: 16 }, accessible: true },
    { id: 'carrer-oest', name: 'Carreró de l\'oest', kind: 'road', rects: [{ xMin: -15, xMax: -7, zMin: -3, zMax: -1 }], reveal: { distance: 12 }, accessible: true },
    { id: 'carrer-est', name: 'Carreró de l\'est', kind: 'road', rects: [{ xMin: 7, xMax: 15, zMin: -9, zMax: -7 }], reveal: { distance: 12 }, accessible: true },
    { id: 'cementiri', name: 'Cementiri', kind: 'cemetery', rects: [R(layout.CEM_AREA.clos), R(layout.CEM_AREA.vestibule)], reveal: { distance: 10 }, accessible: false, lockedNote: 'reixa tancada' },
    {
      id: 'cripta', name: 'Cripta', kind: 'crypt',
      rects: [...layout.CRYPT_FLOORS.slabs.map((s) => R(s.rect)), R(layout.CRYPT.shaft.outer)], reveal: 'crypt', accessible: false, level: -1,
    },
  ];
  const w = { xMin: -18, xMax: 31, zMin: -38, zMax: 38 };
  return { zones, bounds: w, byId: Object.fromEntries(zones.map((z) => [z.id, z])) };
}

// Regles d'accés dinàmiques (l'estat de la partida decideix què és accessible).
export function zoneAccessible(zone, flags) {
  if (zone.id === 'cripta') return !!flags.sdOpen;
  if (zone.id === 'cementiri') return !!flags.cemeteryOpen; // D.4 (obertura de la reixa): encara no existeix
  return zone.accessible;
}

export function createMapProgress(data) {
  const discovered = new Set(); const visited = new Set();
  const known = new Set(data.zones.map((z) => z.id));
  function seed() { for (const z of data.zones) if (z.reveal === 'start') discovered.add(z.id); }
  seed();
  const api = {
    discovered: (id) => discovered.has(id), visited: (id) => visited.has(id),
    // Actualitza amb la posició del jugador i l'estat; retorna true si alguna cosa ha canviat.
    update(x, z, level, flags = {}) {
      let changed = false;
      const add = (set, id) => { if (!set.has(id)) { set.add(id); changed = true; } };
      for (const zone of data.zones) {
        if (zone.reveal === 'crypt') {
          if (flags.sdOpen || level === -1) add(discovered, zone.id);
          if (level === -1 && zone.rects.some((r) => inRect(x, z, r))) { add(discovered, zone.id); add(visited, zone.id); }
          continue;
        }
        if (level === -1) continue; // sota terra el jugador no és a cap zona de superfície
        if (zone.reveal !== 'start' && zone.reveal && zone.rects.some((r) => distToRect(x, z, r) <= zone.reveal.distance)) add(discovered, zone.id);
        const inner = zone.inside || zone.rects;
        if (inner.some((r) => inRect(x, z, r))) { add(discovered, zone.id); add(visited, zone.id); }
      }
      return changed;
    },
    snapshot() { return { discovered: [...discovered].sort(), visited: [...visited].sort() }; },
    restore(s) {
      discovered.clear(); visited.clear(); seed();
      for (const id of s.discovered) if (known.has(id)) discovered.add(id);
      for (const id of s.visited) if (known.has(id)) { visited.add(id); discovered.add(id); }
    },
  };
  return api;
}

// Model de dibuix: només inclou el que el jugador coneix. pose = { x, z, yaw, level }.
export function buildMapModel(data, progress, pose, flags = {}) {
  const zones = [];
  for (const z of data.zones) {
    if (!progress.discovered(z.id)) continue; // no s'insinua res de les zones no descobertes
    zones.push({
      id: z.id, name: z.name, kind: z.kind, rects: z.rects.map(R),
      status: progress.visited(z.id) ? 'visited' : 'known',
      accessible: zoneAccessible(z, flags), lockedNote: z.lockedNote || '',
    });
  }
  const here = pose.level === -1 ? 'cripta' : (data.zones.find((z) => (z.inside || z.rects).some((r) => inRect(pose.x, pose.z, r))) || {}).id || null;
  return { bounds: data.bounds, zones, player: { x: pose.x, z: pose.z, yaw: pose.yaw, level: pose.level, zone: here } };
}
