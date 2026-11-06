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
  throw new Error(`Forma de col·lisió desconeguda a "${id}"`);
}

// Llegeix NOMÉS el camp `collision` d'edificis, murs i atrezzo.
// Les portes, els fanals i el balcó no hi entren (no tenen col·lisió).
export function buildColliders(layout) {
  const colliders = [];
  for (const group of [layout.BUILDINGS, layout.WALLS, layout.PROPS]) {
    for (const item of group) {
      if (item.collision) colliders.push(makeCollider(item.id, item.collision));
    }
  }
  return colliders;
}

// ---------------------------------------------------------------------
// GEOMETRIA
// ---------------------------------------------------------------------

// Distància d'un punt a l'obstacle. Positiva fora, negativa o zero a dins.
export function clearance(x, z, c) {
  if (c.isRect) {
    const dx = Math.max(c.xMin - x, 0, x - c.xMax);
    const dz = Math.max(c.zMin - z, 0, z - c.zMax);
    if (dx > 0 || dz > 0) return Math.hypot(dx, dz);
    return -Math.min(x - c.xMin, c.xMax - x, z - c.zMin, c.zMax - z);
  }
  return Math.hypot(x - c.cx, z - c.cz) - c.radius;
}

// Un cercle de radi `radius` centrat a (x, z): està lliure d'obstacles?
export function isPositionFree(x, z, radius, colliders, tolerance = COLLISION_TOLERANCE) {
  for (let i = 0; i < colliders.length; i++) {
    if (clearance(x, z, colliders[i]) < radius - tolerance) return false;
  }
  return true;
}

// Dos obstacles es solapen (àrea > epsilon)? Els contactes de vora no compten.
export function collidersOverlap(a, b, epsilon = 1e-9) {
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

// Empeny el jugador fora de l'obstacle `c` fins a deixar-lo a `radius` de la vora.
function pushOutOf(out, radius, c, hintX, hintZ) {
  const startX = out.x;
  const startZ = out.z;
  if (c.isRect) {
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
function resolve(out, radius, colliders, hintX, hintZ) {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let worst = null;
    let worstPenetration = COLLISION_TOLERANCE;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
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
  return isPositionFree(out.x, out.z, radius, colliders);
}

// Mou el jugador des de (x, z) amb el desplaçament (dx, dz) i retorna la
// posició final resolta. `out` és opcional (per reutilitzar-lo).
export function movePlayer(x, z, dx, dz, radius, colliders, out = createMoveResult()) {
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
    if (!resolve(out, radius, colliders, sx, sz)) {
      out.x = prevX;
      out.z = prevZ;
      out.blocked = true;
    }
  }
  return out;
}
