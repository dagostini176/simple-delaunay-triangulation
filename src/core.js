// Delaunay triangulation via Bowyer-Watson incremental insertion.
// The super-triangle is deliberately large so that no input point can fall
// outside it, which keeps the insertion loop simple: every point is guaranteed
// to be inside exactly one triangle at insertion time.

const EPS = 1e-12;

/**
 * A triangle is stored as three point indices into the original input array.
 * Using indices rather than point objects keeps the triangulation stable and
 * avoids copying coordinates, which matters for large point sets.
 */
export class Triangle {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }

  /**
   * Returns true if the point at index p is one of the triangle vertices.
   */
  hasVertex(p) {
    return this.a === p || this.b === p || this.c === p;
  }
}

/**
 * An edge is an unordered pair of point indices. The canonical form always
 * stores the smaller index first so that equality checks are a simple
 * comparison rather than a set lookup.
 */
export class Edge {
  constructor(u, v) {
    if (u < v) {
      this.u = u;
      this.v = v;
    } else {
      this.u = v;
      this.v = u;
    }
  }

  equals(other) {
    return this.u === other.u && this.v === other.v;
  }
}

/**
 * Computes the circumcircle of the triangle formed by the three points.
 * The determinant form is used because it is numerically stable for the
 * nearly-degenerate triangles that appear near the convex hull boundary.
 * Returns null when the points are collinear (determinant ~ 0), which signals
 * that the triangle is degenerate and should not participate in the
 * Bowyer-Watson cavity.
 */
function circumcircle(points, i, j, k) {
  const ax = points[i].x, ay = points[i].y;
  const bx = points[j].x, by = points[j].y;
  const cx = points[k].x, cy = points[k].y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < EPS) {
    return null;
  }

  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;

  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  const r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);

  return { x: ux, y: uy, r2 };
}

/**
 * In-circle test: returns true when the point lies strictly inside the
 * circumcircle. A small tolerance is used so that points exactly on the
 * circle (cocircular) are treated as outside. Treating them as inside would
 * create overlapping triangles; treating them as outside keeps the
 * triangulation unique for the common case of four cocircular points.
 */
function inCircle(circle, points, p) {
  const dx = points[p].x - circle.x;
  const dy = points[p].y - circle.y;
  return dx * dx + dy * dy < circle.r2 - EPS;
}

/**
 * Builds a super-triangle that contains every input point. The multiplier is
 * chosen large enough that the super-triangle vertices are far outside the
 * bounding box, so the circumcircles of the initial triangles do not
 * accidentally exclude real points.
 */
function makeSuperTriangle(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dmax = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const scale = dmax > 0 ? dmax : 1;
  const superA = { x: midX - 20 * scale, y: midY - 20 * scale };
  const superB = { x: midX + 20 * scale, y: midY - 20 * scale };
  const superC = { x: midX, y: midY + 20 * scale };

  return [superA, superB, superC];
}

/**
 * Triangulates the given array of {x, y} points using the Bowyer-Watson
 * algorithm. Returns an array of Triangle objects whose vertex indices refer
 * to the input array. Duplicate points are removed first because they produce
 * degenerate triangles and break the cavity computation.
 *
 * The algorithm is O(n^2) in the worst case; that is acceptable for the
 * intended use (hundreds to a few thousand points). A spatial index would be
 * the next step if larger inputs were required.
 */
export function triangulate(inputPoints) {
  if (!Array.isArray(inputPoints)) {
    throw new TypeError('triangulate expects an array of points');
  }

  // Deduplicate by exact coordinate equality. Near-duplicates are left in;
  // they produce sliver triangles, which is the expected behaviour for a
  // Delaunay triangulation without a snapping tolerance. Each surviving point
  // records the index of its first occurrence so that returned triangles refer
  // back to the original input array.
  const points = [];
  const seen = new Map();
  const indexMap = [];
  for (let i = 0; i < inputPoints.length; i++) {
    const p = inputPoints[i];
    if (p == null || typeof p.x !== 'number' || typeof p.y !== 'number') {
      throw new TypeError('each point must have numeric x and y properties');
    }
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      throw new TypeError('point coordinates must be finite numbers');
    }
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.set(key, points.length);
      indexMap.push(i);
      points.push({ x: p.x, y: p.y });
    }
  }

  if (points.length < 3) {
    return [];
  }

  const superPoints = makeSuperTriangle(points);
  const allPoints = points.concat(superPoints);
  const n = allPoints.length;
  const s0 = n - 3;
  const s1 = n - 2;
  const s2 = n - 1;

  // Start with the super-triangle. Its vertices are outside the input set,
  // so it is guaranteed to contain all real points.
  let triangles = [new Triangle(s0, s1, s2)];

  for (let i = 0; i < points.length; i++) {
    const bad = [];
    const good = [];

    for (const t of triangles) {
      const circle = circumcircle(allPoints, t.a, t.b, t.c);
      if (circle && inCircle(circle, allPoints, i)) {
        bad.push(t);
      } else {
        good.push(t);
      }
    }

    // Collect the boundary of the cavity. An edge shared by two bad triangles
    // is interior and must not appear in the new triangulation; an edge that
    // appears once is on the cavity boundary.
    const edgeCount = new Map();
    for (const t of bad) {
      const edges = [
        new Edge(t.a, t.b),
        new Edge(t.b, t.c),
        new Edge(t.c, t.a),
      ];
      for (const e of edges) {
        const key = `${e.u},${e.v}`;
        const entry = edgeCount.get(key);
        if (entry) {
          entry.count += 1;
        } else {
          edgeCount.set(key, { edge: e, count: 1 });
        }
      }
    }

    const boundary = [];
    for (const { edge, count } of edgeCount.values()) {
      if (count === 1) {
        boundary.push(edge);
      }
    }

    // Retriangulate the cavity by connecting the new point to every boundary
    // edge. The orientation is preserved because the boundary edges are
    // ordered consistently by the cavity removal.
    const next = good.slice();
    for (const e of boundary) {
      next.push(new Triangle(e.u, e.v, i));
    }
    triangles = next;
  }

  // Drop every triangle that still references a super-triangle vertex, and
  // translate internal point indices back to indices in the original input.
  const result = [];
  for (const t of triangles) {
    if (t.a >= s0 || t.b >= s0 || t.c >= s0) {
      continue;
    }
    result.push(new Triangle(indexMap[t.a], indexMap[t.b], indexMap[t.c]));
  }
  return result;
}
