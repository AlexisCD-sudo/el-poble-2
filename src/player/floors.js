// =====================================================================
// THE FORGOTTEN VILLAGE — TERRES I ESCALES (matemàtiques pures, Fase C)
// =====================================================================
// Sense Three.js ni DOM: es pot provar des de la terminal (tools/test-stairs.js).
//
// El jugador és un cercle en el pla XZ (collisions.js). L'alçada dels peus depèn de la posició i del NIVELL:
//   nivell 0 = planta baixa (y = 0)      nivell 1 = pis superior (y = floorY del forjat)
//   nivell −1 = cripta (Fase D.3; només si `levelSplitDown` és definit): per sota d'aquesta alçada dels peus.
//   Les escales poden baixar (`floorY` negatiu, `rise` = alçada inicial 0): la mateixa rampa que passa per les arestes dels graons.
//   Els forjats (`slabs`) tenen `level` (per defecte 1); un jugador només camina sobre els del seu nivell.
// Dins del rectangle d'una escala el terra puja linealment (una rampa que passa per les arestes dels graons);
// fora, el terra del nivell. El nivell nou surt de l'alçada: a partir de `levelSplit` el jugador és al nivell 1.
// Això permet que el mateix pla XZ tingui dues estances superposades sense que res no es travessi: els
// obstacles porten `level` (vegeu collisions.js) i només compten per al nivell on són.
// =====================================================================

const inRect = (x, z, r, e = 1e-9) => x >= r.xMin - e && x <= r.xMax + e && z >= r.zMin - e && z <= r.zMax + e;

export function createFloors(def) {
  const stairs = def.stairs || [];
  const slabs = def.slabs || [];
  const split = def.levelSplit;
  const splitDown = def.levelSplitDown; // undefined = no hi ha nivell −1 (comportament de les fases anteriors)

  // Alçada del terra de l'escala a la posició (x, z) (només si és dins del seu rectangle).
  function stairHeight(st, x, z) {
    const t = st.axis === 'z' ? (z - st.start) * st.dir : (x - st.start) * st.dir; // 0 al peu, `run` al cim
    const k = Math.min(1, Math.max(0, t / st.run));
    return st.rise + (st.floorY - st.rise) * k;
  }

  const api = {
    levelSplit: split,
    levelSplitDown: splitDown,
    // Escala sota (x, z) o null.
    stairAt(x, z) {
      for (const st of stairs) if (inRect(x, z, st.rect)) return st;
      return null;
    },
    // Alçada dels peus (m) a (x, z) per a un jugador del nivell `level`.
    heightAt(x, z, level) {
      for (const st of stairs) if (inRect(x, z, st.rect)) return stairHeight(st, x, z);
      for (const sl of slabs) {
        if ((sl.level === undefined ? 1 : sl.level) === level && inRect(x, z, sl.rect) && !sl.holes.some((h) => inRect(x, z, h))) return sl.y;
      }
      return 0;
    },
    // Nivell que correspon a una alçada dels peus.
    levelFor(y) { return y > split ? 1 : (splitDown !== undefined && y < splitDown ? -1 : 0); },
    // Un pas de moviment: retorna { y, level } per a la nova posició (x, z) venint del nivell `level`.
    resolve(x, z, level) {
      const y = api.heightAt(x, z, level);
      return { y, level: api.levelFor(y) };
    },
  };
  return api;
}

// Suavitzat exponencial de l'alçada de la càmera (evita els salts a cada graó). Retorna la nova alçada.
export function smoothHeight(current, target, dt, rate = 14) {
  const k = 1 - Math.exp(-rate * dt);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 1e-4 ? target : next;
}
