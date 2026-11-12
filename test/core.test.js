import test from 'node:test';
import assert from 'node:assert/strict';
import { triangulate, Triangle, Edge } from '../src/index.js';

function area(points, t) {
  const a = points[t.a];
  const b = points[t.b];
  const c = points[t.c];
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

test('empty and small inputs return no triangles', () => {
  assert.deepEqual(triangulate([]), []);
  assert.deepEqual(triangulate([{ x: 0, y: 0 }]), []);
  assert.deepEqual(triangulate([{ x: 0, y: 0 }, { x: 1, y: 1 }]), []);
});

test('three non-collinear points produce one triangle', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  const tris = triangulate(pts);
  assert.equal(tris.length, 1);
  const t = tris[0];
  assert.ok(t instanceof Triangle);
  assert.equal(t.hasVertex(0) && t.hasVertex(1) && t.hasVertex(2), true);
});

test('three collinear points produce no triangles', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  assert.deepEqual(triangulate(pts), []);
});

test('square has two triangles and no super-triangle vertices', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const tris = triangulate(pts);
  assert.equal(tris.length, 2);
  for (const t of tris) {
    assert.ok(t.a < 4 && t.b < 4 && t.c < 4);
  }
});

test('duplicate points are ignored', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ];
  const tris = triangulate(pts);
  assert.equal(tris.length, 1);
  const t = tris[0];
  assert.equal(t.hasVertex(0) && t.hasVertex(1) && t.hasVertex(3), true);
});

test('collinear interior point does not create a triangle', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
  ];
  const tris = triangulate(pts);
  // The three collinear points form degenerate triangles that are skipped;
  // the valid triangles all use the non-collinear point.
  assert.equal(tris.length, 2);
  for (const t of tris) {
    assert.equal(t.hasVertex(3), true);
  }
});

test('all points lie on a circle and produce a valid triangulation', () => {
  const pts = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  const tris = triangulate(pts);
  // Four cocircular points admit two possible triangulations; either is
  // valid. We check that the total area equals the square formed by the
  // four points, which is 2 for this unit diamond.
  let total = 0;
  for (const t of tris) {
    total += area(pts, t);
  }
  assert.ok(Math.abs(total - 2) < 1e-9);
});

test('points with identical coordinates reduce to a single triangle', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  const tris = triangulate(pts);
  assert.equal(tris.length, 1);
});

test('non-array input throws', () => {
  assert.throws(() => triangulate(null), TypeError);
  assert.throws(() => triangulate('nope'), TypeError);
});

test('non-finite coordinates throw', () => {
  assert.throws(() => triangulate([{ x: 0, y: 0 }, { x: NaN, y: 0 }, { x: 0, y: 1 }]), TypeError);
  assert.throws(() => triangulate([{ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: 0, y: 1 }]), TypeError);
});

test('missing coordinate properties throw', () => {
  assert.throws(() => triangulate([{ x: 0, y: 0 }, { x: 1 }, { x: 0, y: 1 }]), TypeError);
});

test('edge canonical form orders indices', () => {
  const e1 = new Edge(5, 2);
  const e2 = new Edge(2, 5);
  assert.equal(e1.u, 2);
  assert.equal(e1.v, 5);
  assert.ok(e1.equals(e2));
});

test('triangle hasVertex checks membership', () => {
  const t = new Triangle(0, 1, 2);
  assert.equal(t.hasVertex(1), true);
  assert.equal(t.hasVertex(3), false);
});
