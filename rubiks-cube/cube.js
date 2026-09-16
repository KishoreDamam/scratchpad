/* Rubik's cube state and geometry.
 *
 * Coordinates follow the CSS convention: x points right, y points DOWN and
 * z points out of the screen. Faces are named by their outward normal:
 *
 *   R = +x   L = -x   U = -y   D = +y   F = +z   B = -z
 *
 * A clockwise turn of a face is a +90 degree rotation about that face's
 * outward normal, which is exactly what CSS rotate3d() does with the same
 * axis, so the animation and the state stay in sync.
 */

const FACES = {
  U: { axis: [0, -1, 0], color: '#f7f7f5', name: 'white' },
  D: { axis: [0, 1, 0], color: '#ffd500', name: 'yellow' },
  F: { axis: [0, 0, 1], color: '#00a04b', name: 'green' },
  B: { axis: [0, 0, -1], color: '#0051ba', name: 'blue' },
  R: { axis: [1, 0, 0], color: '#d2281f', name: 'red' },
  L: { axis: [-1, 0, 0], color: '#ff6a00' }
};

const FACE_ORDER = ['U', 'D', 'L', 'R', 'F', 'B'];

// Rodrigues' rotation formula for a unit axis, restricted to the right angles
// we actually use, so every entry comes back as an exact -1 / 0 / 1.
function rotationMatrix(axis, degrees) {
  const [x, y, z] = axis;
  const a = (degrees * Math.PI) / 180;
  const c = Math.round(Math.cos(a));
  const s = Math.round(Math.sin(a));
  const t = 1 - c;
  return [
    [int(t * x * x + c), int(t * x * y - s * z), int(t * x * z + s * y)],
    [int(t * x * y + s * z), int(t * y * y + c), int(t * y * z - s * x)],
    [int(t * x * z - s * y), int(t * y * z + s * x), int(t * z * z + c)]
  ];
}

// Math.round can hand back -0, which is equal to 0 but prints as "-0" in the
// matrix3d() strings and in comparisons of raw state, so flatten it here.
function int(v) {
  const r = Math.round(v);
  return r === 0 ? 0 : r;
}

function multiply(a, b) {
  const out = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
    }
  }
  return out;
}

function apply(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
  ].map(int);
}

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

class Cube {
  constructor() {
    this.reset();
  }

  reset() {
    this.cubies = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue; // hidden core
          this.cubies.push({
            home: [x, y, z],
            position: [x, y, z],
            orientation: IDENTITY.map((row) => row.slice()),
            // Sticker colours are baked in at solved state and then simply
            // ride along with the cubie's orientation.
            stickers: FACE_ORDER.filter((f) => {
              const [ax, ay, az] = FACES[f].axis;
              return ax * x + ay * y + az * z === 1;
            })
          });
        }
      }
    }
  }

  // Cubies that belong to the layer turned by `face`.
  layer(face) {
    const axis = FACES[face].axis;
    return this.cubies.filter((c) => {
      const [x, y, z] = c.position;
      return axis[0] * x + axis[1] * y + axis[2] * z === 1;
    });
  }

  // Applies a quarter turn (or half turn) to the state, without animating.
  turn(face, quarters = 1) {
    const axis = FACES[face].axis;
    const m = rotationMatrix(axis, 90 * quarters);
    for (const cubie of this.layer(face)) {
      cubie.position = apply(m, cubie.position);
      cubie.orientation = multiply(m, cubie.orientation).map((row) =>
        row.map(int)
      );
    }
  }

  // Solved means every sticker faces its own colour's side. Comparing whole
  // orientation matrices would be stricter than the cube itself: a centre can
  // be left spun in place by a legal sequence, which changes its matrix but
  // nothing you can see.
  isSolved() {
    return this.cubies.every((cubie) => {
      if (!cubie.home.every((v, i) => v === cubie.position[i])) return false;
      return cubie.stickers.every((face) => {
        const axis = FACES[face].axis;
        const facing = apply(cubie.orientation, axis);
        return facing.every((v, i) => v === axis[i]);
      });
    });
  }
}

// "R", "R'", "R2" -> { face, quarters }
function parseMove(move) {
  const face = move[0].toUpperCase();
  if (!FACES[face]) throw new Error(`Unknown face: ${move}`);
  const suffix = move.slice(1);
  const quarters = suffix === "'" ? -1 : suffix === '2' ? 2 : 1;
  return { face, quarters };
}

function formatMove(face, quarters) {
  return face + (quarters === -1 ? "'" : quarters === 2 ? '2' : '');
}

function invertMove(face, quarters) {
  return { face, quarters: quarters === 2 ? 2 : -quarters };
}

// Random scramble that never turns the same face twice in a row and avoids
// pairs like R L R that undo the look of a real scramble.
function randomScramble(length = 25) {
  const moves = [];
  let previous = null;
  let beforePrevious = null;
  while (moves.length < length) {
    const face = FACE_ORDER[Math.floor(Math.random() * FACE_ORDER.length)];
    if (face === previous) continue;
    if (face === beforePrevious && isOpposite(face, previous)) continue;
    const quarters = [1, -1, 2][Math.floor(Math.random() * 3)];
    moves.push(formatMove(face, quarters));
    beforePrevious = previous;
    previous = face;
  }
  return moves;
}

function isOpposite(a, b) {
  if (!a || !b) return false;
  const [ax, ay, az] = FACES[a].axis;
  const [bx, by, bz] = FACES[b].axis;
  return ax === -bx && ay === -by && az === -bz;
}
