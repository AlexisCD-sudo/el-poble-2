// =====================================================================
// THE FORGOTTEN VILLAGE — COL·LISIONS DEL JUGADOR (matemàtiques pures)
// =====================================================================
// Aquest fitxer NO importa Three.js ni el layout, i no usa cap API del
// navegador. Només rep números i retorna números, així que es pot provar
// des de la terminal (tools/test-collisions.js).
//
// COORDENADES: les mateixes que layout.js (metres; X = est, Z = sud).
// El jugador és un CERCLE de radi `radius` en el pla XZ. Els obstacles són
// rectangles (xMin, xMax, zMin, zMax) o cercles (cx, cz, radius).
//
// ALGORITME DE MOVIMENT (empenta iterativa):
//   1. El desplaçament es divideix en subpassos de com a màxim 0,1 m
//      (així cap moviment pot "saltar" un obstacle).
//   2. A cada subpas, el jugador es mou i, si el cercle penetra en algun
//      obstacle, s'empeny cap enfora en la direcció que va del punt més
//      proper de l'obstacle cap al centre del jugador. Es comença pel
//      que penetra més, i es repeteix fins a MAX_ITERATIONS vegades
//      (necessari als racons, on hi ha dos obstacles alhora).
//   3. Amb un mur recte, la component paral·lela al mur es conserva
//      (lliscament). A les cantonades convexes el jugador es desvia en
//      diagonal; a les formes rodones, les envolta.
//   4. Seguretat: si després de les iteracions encara penetra, el subpas
//      es desfà (el jugador s'atura). Mai no acaba dins un obstacle.
//
// Un contacte exacte (a `radius` de la vora) NO és col·lisió: s'usa una
// tolerància de COLLISION_TOLERANCE perquè el jugador no vibri.
//
// NIVELLS (Fase C, pis superior de la casa C): un obstacle pot dur `level` (0 = planta baixa, 1 = pis superior);
// només col·lisiona amb un jugador que és a aquest nivell. Sense `level` (parets, escala…) col·lisiona sempre.
// Un obstacle amb `enabled === false` (porta de casa oberta) és com si no hi fos.
// =====================================================================

export const COLLISION_TOLERANCE = 1e-6;
export const MAX_SUBSTEP = 0.1;
export const MAX_ITERATIONS = 4;

// ---------------------------------------------------------------------
// OBSTACLES
// ---------------------------------------------------------------------

// Converteix una forma de layout.js en un obstacle pla (camps sempre iguals).
export function makeCollider(id, shape) {
  const finite = (...v) => v.every((n) => typeof n === 'number' && Number.isFinite(n));
  if (shape && shape.type === 'rect') {
    const { xMin, xMax, zMin, zMax } = shape;
    if (!finite(xMin, xMax, zMin, zMax) || !(xMin < xMax) || !(zMin < zMax)) {
      throw new Error(`Rectangle de col·lisió invàlid a "${id}"`);
    }
    return { id, isRect: true, xMin, xMax, zMin, zMax, cx: 0, cz: 0, radius: 0 };
  }
  if (shape && shape.type === 'circle') {
    const { cx, cz, radius } = shape;
    if (!finite(cx, cz, radius) || !(radius > 0)) {
      throw new Error(`Cercle de col·lisió invàlid a "${id}"`);
    }
    // xMin..zMax = capsa envolvent (per descartar ràpidament i per al validador)
    return { id, isRect: false, xMin: cx - radius, xMax: cx + radius, zMin: cz - radius, zMax: cz + radius, cx, cz, radius };
  }
  if (shape && shape.type === 'segment') {
    // Segment gruixut (càpsula): una fulla de porta. Els extrems es poden moure després amb setSegment().
    const { x1, z1, x2, z2, halfThickness } = shape;
    if (!finite(x1, z1, x2, z2, halfThickness) || !(halfThickness > 0)) {
      throw new Error(`Segment de col·lisió invàlid a "${id}"`);
    }
    const c = { id, isRect: false, isSegment: true, xMin: 0, xMax: 0, zMin: 0, zMax: 0, cx: 0, cz: 0, radius: 0, x1, z1, x2, z2, halfThickness };
    setSegment(c, x1, z1, x2, z2);
    return c;
  }
  throw new Error(`Forma de col·lisió desconeguda a "${id}"`);
}

// Mou els extrems d'un obstacle de tipus segment (porta que gira) i refà la capsa envolvent.
export function setSegment(c, x1, z1, x2, z2) {
  c.x1 = x1; c.z1 = z1; c.x2 = x2; c.z2 = z2;
  c.xMin = Math.min(x1, x2) - c.halfThickness;
  c.xMax = Math.max(x1, x2) + c.halfThickness;
  c.zMin = Math.min(z1, z2) - c.halfThickness;
  c.zMax = Math.max(z1, z2) + c.halfThickness;
  c.cx = (x1 + x2) / 2; c.cz = (z1 + z2) / 2;
  return c;
}

// Distància d'un punt a un segment (sense gruix) i punt més proper (a `out` = [x, z]).
export function distanceToSegment(px, pz, x1, z1, x2, z2, out) {
  const vx = x2 - x1; const vz = z2 - z1;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 1e-18 ? ((px - x1) * vx + (pz - z1) * vz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x1 + vx * t; const qz = z1 + vz * t;
  if (out) { out[0] = qx; out[1] = qz; }
  return Math.hypot(px - qx, pz - qz);
}

// Llegeix NOMÉS el camp `collision` d'edificis, murs i atrezzo.
// Les portes, els fanals i el balcó no hi entren (no tenen col·lisió).
// `collision` pot ser UNA forma (el cas normal) o una LLISTA de formes, cada
// una amb el seu propi `id` (edifici amb col·lisió composta: l'església, que
// té l'interior i la porta oberts). Cada forma de la llista és un obstacle.
export function buildColliders(layout) {
  const colliders = [];
  // FURNITURE (Fase B), STAIRS (Fase C) i CEM_WALLS / CEM_PROPS (Fase D.2, cementiri) són opcionals.
  for (const group of [layout.BUILDINGS, layout.WALLS, layout.PROPS, layout.FURNITURE || [], layout.STAIRS || [], layout.CEM_WALLS || [], layout.CEM_PROPS || []]) {
    for (const item of group) {
      if (!item.collision) continue;
      if (Array.isArray(item.collision)) {
        for (const part of item.collision) {
          if (!part || typeof part.id !== 'string') throw new Error(`Part de col·lisió sense "id" a "${item.id}"`);
          const c = makeCollider(part.id, part);
          const lv = part.level !== undefined ? part.level : item.level;
          if (lv !== undefined) c.level = lv;
          colliders.push(c);
        }
      } else {
        const c = makeCollider(item.id, item.collision);
        const lv = item.collision.level !== undefined ? item.collision.level : item.level;
        if (lv !== undefined) c.level = lv;
        colliders.push(c);
      }
    }
  }
  return colliders;
}

// ---------------------------------------------------------------------
// GEOMETRIA
// ---------------------------------------------------------------------

// Distància d'un punt a l'obstacle. Positiva fora, negativa o zero a dins.
export function clearance(x, z, c) {
  if (c.isSegment) return distanceToSegment(x, z, c.x1, c.z1, c.x2, c.z2, null) - c.halfThickness;
  if (c.isRect) {
    const dx = Math.max(c.xMin - x, 0, x - c.xMax);
    const dz = Math.max(c.zMin - z, 0, z - c.zMax);
    if (dx > 0 || dz > 0) return Math.hypot(dx, dz);
    return -Math.min(x - c.xMin, c.xMax - x, z - c.zMin, c.zMax - z);
  }
  return Math.hypot(x - c.cx, z - c.cz) - c.radius;
}

// L'obstacle compta per a un jugador del nivell `level`? (level indefinit = tots els nivells)
export function isActive(c, level) {
  if (c.enabled === false) return false;
  return level === undefined || c.level === undefined || c.level === level;
}

// El segment (x1,z1)→(x2,z2) travessa algun obstacle actiu al nivell `level`? (línia de visió/abast d'una interacció)
// Els rectangles es redueixen `shrink` per no comptar un simple tangent; els segments gruixuts (fulles) s'ignoren.
export function segmentBlocked(x1, z1, x2, z2, colliders, level = undefined, shrink = 0.001) {
  const dx = x2 - x1; const dz = z2 - z1;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!isActive(c, level) || c.isSegment) continue;
    if (c.isRect) {
      let t0 = 0; let t1 = 1;
      const lo = [c.xMin + shrink, c.zMin + shrink]; const hi = [c.xMax - shrink, c.zMax - shrink];
      const o = [x1, z1]; const d = [dx, dz];
      let hit = true;
      for (let k = 0; k < 2 && hit; k++) {
        if (Math.abs(d[k]) < 1e-12) { if (o[k] < lo[k] || o[k] > hi[k]) hit = false; continue; }
        let a = (lo[k] - o[k]) / d[k]; let b = (hi[k] - o[k]) / d[k];
        if (a > b) { const tmp = a; a = b; b = tmp; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) hit = false;
      }
      if (hit) return true;
    } else if (distanceToSegment(c.cx, c.cz, x1, z1, x2, z2, null) < c.radius - shrink) return true;
  }
  return false;
}

// Un cercle de radi `radius` centrat a (x, z): està lliure d'obstacles? (`level` opcional: vegeu més amunt)
export function isPositionFree(x, z, radius, colliders, tolerance = COLLISION_TOLERANCE, level = undefined) {
  for (let i = 0; i < colliders.length; i++) {
    if (!isActive(colliders[i], level)) continue;
    if (clearance(x, z, colliders[i]) < radius - tolerance) return false;
  }
  return true;
}

// Dos obstacles es solapen (àrea > epsilon)? Els contactes de vora no compten.
export function collidersOverlap(a, b, epsilon = 1e-9) {
  if (a.isSegment || b.isSegment) {
    // Mostreig del segment (cada ~2 cm) contra l'altre obstacle; prou per a validar portes.
    const [seg, other] = a.isSegment ? [a, b] : [b, a];
    const n = Math.max(2, Math.ceil(Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1) / 0.02));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = seg.x1 + (seg.x2 - seg.x1) * t; const z = seg.z1 + (seg.z2 - seg.z1) * t;
      if (other.isSegment) {
        if (distanceToSegment(x, z, other.x1, other.z1, other.x2, other.z2, null) < seg.halfThickness + other.halfThickness - epsilon) return true;
      } else if (clearance(x, z, other) < seg.halfThickness - epsilon) return true;
    }
    return false;
  }
  if (a.isRect && b.isRect) {
    const ox = Math.min(a.xMax, b.xMax) - Math.max(a.xMin, b.xMin);
    const oz = Math.min(a.zMax, b.zMax) - Math.max(a.zMin, b.zMin);
    return ox > epsilon && oz > epsilon;
  }
  if (!a.isRect && !b.isRect) {
    return Math.hypot(a.cx - b.cx, a.cz - b.cz) < a.radius + b.radius - epsilon;
  }
  const [rect, circle] = a.isRect ? [a, b] : [b, a];
  return clearance(circle.cx, circle.cz, rect) < circle.radius - epsilon;
}

// ---------------------------------------------------------------------
// MOVIMENT
// ---------------------------------------------------------------------

// Resultat reutilitzable (evita crear objectes nous a cada fotograma).
//   x, z      posició final
//   collided  ha hagut d'empènyer el jugador (ha tocat alguna cosa)
//   hits      nombre d'empentes aplicades
//   pushX/Z   suma de les empentes (apunta cap a fora dels obstacles)
//   lastId    id de l'últim obstacle tocat
//   blocked   un subpas s'ha desfet per seguretat (cas patològic)
export function createMoveResult() {
  return { x: 0, z: 0, collided: false, hits: 0, pushX: 0, pushZ: 0, lastId: null, blocked: false };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

const _closest = [0, 0]; // buffer reutilitzat (punt més proper d'un segment)

// Empeny el jugador fora de l'obstacle `c` fins a deixar-lo a `radius` de la vora.
function pushOutOf(out, radius, c, hintX, hintZ) {
  const startX = out.x;
  const startZ = out.z;
  if (c.isSegment) {
    // Fulla de porta: surt en la direcció del punt més proper del segment cap al jugador.
    _closest[0] = 0; _closest[1] = 0;
    const d = distanceToSegment(out.x, out.z, c.x1, c.z1, c.x2, c.z2, _closest);
    const reach = radius + c.halfThickness;
    if (d > 1e-12) {
      out.x = _closest[0] + ((out.x - _closest[0]) / d) * reach;
      out.z = _closest[1] + ((out.z - _closest[1]) / d) * reach;
    } else {
      // Centre exactament sobre l'eix de la fulla: surt pel costat contrari al moviment (normal del segment).
      let nx = -(c.z2 - c.z1); let nz = c.x2 - c.x1;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl; nz /= nl;
      if (nx * hintX + nz * hintZ > 0) { nx = -nx; nz = -nz; }
      out.x = _closest[0] + nx * reach;
      out.z = _closest[1] + nz * reach;
    }
  } else if (c.isRect) {
    const px = clamp(out.x, c.xMin, c.xMax);
    const pz = clamp(out.z, c.zMin, c.zMax);
    const vx = out.x - px;
    const vz = out.z - pz;
    const d = Math.hypot(vx, vz);
    if (d > 1e-12) {
      out.x = px + (vx / d) * radius;
      out.z = pz + (vz / d) * radius;
    } else {
      // Centre dins (o a la vora) del rectangle: surt per la cara més propera.
      const toXMin = out.x - c.xMin;
      const toXMax = c.xMax - out.x;
      const toZMin = out.z - c.zMin;
      const toZMax = c.zMax - out.z;
      const m = Math.min(toXMin, toXMax, toZMin, toZMax);
      if (m === toXMin) out.x = c.xMin - radius;
      else if (m === toXMax) out.x = c.xMax + radius;
      else if (m === toZMin) out.z = c.zMin - radius;
      else out.z = c.zMax + radius;
    }
  } else {
    const vx = out.x - c.cx;
    const vz = out.z - c.cz;
    const d = Math.hypot(vx, vz);
    const reach = radius + c.radius;
    if (d > 1e-12) {
      out.x = c.cx + (vx / d) * reach;
      out.z = c.cz + (vz / d) * reach;
    } else {
      // Centre exactament al centre del cercle: surt en sentit contrari al moviment.
      const h = Math.hypot(hintX, hintZ);
      const ux = h > 1e-12 ? -hintX / h : 1;
      const uz = h > 1e-12 ? -hintZ / h : 0;
      out.x = c.cx + ux * reach;
      out.z = c.cz + uz * reach;
    }
  }
  out.pushX += out.x - startX;
  out.pushZ += out.z - startZ;
  out.hits += 1;
  out.collided = true;
  out.lastId = c.id;
}

// Resol les penetracions d'un subpas. Retorna false si no ho aconsegueix.
function resolve(out, radius, colliders, hintX, hintZ, level) {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let worst = null;
    let worstPenetration = COLLISION_TOLERANCE;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (c.enabled === false || (level !== undefined && c.level !== undefined && c.level !== level)) continue;
      if (out.x < c.xMin - radius || out.x > c.xMax + radius ||
          out.z < c.zMin - radius || out.z > c.zMax + radius) continue;
      const penetration = radius - clearance(out.x, out.z, c);
      if (penetration > worstPenetration) {
        worstPenetration = penetration;
        worst = c;
      }
    }
    if (worst === null) return true;
    pushOutOf(out, radius, worst, hintX, hintZ);
  }
  return isPositionFree(out.x, out.z, radius, colliders, COLLISION_TOLERANCE, level);
}

// Mou el jugador des de (x, z) amb el desplaçament (dx, dz) i retorna la
// posició final resolta. `out` és opcional (per reutilitzar-lo).
export function movePlayer(x, z, dx, dz, radius, colliders, out = createMoveResult(), level = undefined) {
  out.x = x;
  out.z = z;
  out.collided = false;
  out.hits = 0;
  out.pushX = 0;
  out.pushZ = 0;
  out.lastId = null;
  out.blocked = false;

  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_SUBSTEP));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    const prevX = out.x;
    const prevZ = out.z;
    out.x += sx;
    out.z += sz;
    if (!resolve(out, radius, colliders, sx, sz, level)) {
      out.x = prevX;
      out.z = prevZ;
      out.blocked = true;
    }
  }
  return out;
}
