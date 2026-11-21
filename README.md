# simple-delaunay-triangulation

Computes the Delaunay triangulation of a set of 2D points using the Bowyer-Watson incremental insertion algorithm.

## Usage

```js
import { triangulate } from './src/index.js';

const points = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const triangles = triangulate(points);
// triangles is an array of Triangle objects.
// Each Triangle holds three vertex indices into the original points array.
for (const t of triangles) {
  console.log(t.a, t.b, t.c);
}
```

## Why this exists

The Bowyer-Watson algorithm is easy to describe but fiddly to implement correctly: the super-triangle must contain every point, degenerate triangles must be skipped, and the cavity boundary must be computed without double-counting shared edges. This library packages a small, dependency-free implementation that handles those cases explicitly. The trade-off is performance: the algorithm is O(n^2) in the worst case, which is fine for the hundreds-to-thousands of points that typical 2D visualisations use, but not for large point clouds. A spatial index would be the next step if that became a requirement.

## Awkward edge

Four points that lie exactly on a common circle admit two equally valid Delaunay triangulations. This implementation resolves the ambiguity by treating cocircular points as outside the circumcircle, so the first valid triangulation encountered is kept. Both answers are correct; the library simply picks one deterministically. Near-duplicate points are not snapped, so they can produce sliver triangles — that is the expected behaviour of a Delaunay triangulation without a snapping tolerance.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

