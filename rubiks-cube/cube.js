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

// Colour is not a property of a face — it is a property of the cube in your
// hands. FACES carries only geometry; which colour sits where is a scheme,
// and the viewer can set their own.
const COLOURS = {
  white: '#f7f7f5',
  yellow: '#ffd500',
  green: '#00a04b',
  blue: '#0051ba',
  red: '#d2281f',
  orange: '#ff6a00'
};

const COLOUR_KEYS = Object.keys(COLOURS);

// This cube's colours, as its owner holds it: white on top, red in front,
// orange left, yellow right, green underneath, blue behind. Its opposite
// pairs are white/green, red/blue and orange/yellow.
//
// Colour never reaches the solver, which works in face letters throughout, so
// the pairing is purely what you see — every orientation, validation and
// lesson below is derived from this one declaration.
const CUBE_SCHEME = {
  U: 'white', D: 'green', F: 'red', B: 'blue', L: 'orange', R: 'yellow'
};

const OPPOSITE_COLOURS = [
  ['white', 'green'], ['red', 'blue'], ['orange', 'yellow']
];

// The app opens with that cube turned white-side-down: the method solves the
// bottom layer first, so this is what makes the course's first stage the
// white cross. It is the same cube, rolled over.
const DEFAULT_SCHEME = {
  U: 'green', D: 'white', F: 'red', B: 'blue', L: 'yellow', R: 'orange'
};

const FACES = {
  U: { axis: [0, -1, 0] },
  D: { axis: [0, 1, 0] },
  F: { axis: [0, 0, 1] },
  B: { axis: [0, 0, -1] },
  R: { axis: [1, 0, 0] },
  L: { axis: [-1, 0, 0] }
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

/* ---------- checking a colour scheme ---------- */

const OPPOSITE_FACES = [['U', 'D'], ['F', 'B'], ['L', 'R']];

// The 24 ways a cube can be turned, as rotation matrices.
const ROTATIONS = (() => {
  const key = (m) => m.flat().join(',');
  const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const found = new Map([[key(identity), identity]]);
  let frontier = [identity];
  while (frontier.length) {
    const next = [];
    for (const m of frontier) {
      for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const turned = multiply(rotationMatrix(axis, 90), m);
        if (!found.has(key(turned))) {
          found.set(key(turned), turned);
          next.push(turned);
        }
      }
    }
    frontier = next;
  }
  return [...found.values()];
})();

const faceWithAxis = (axis) =>
  FACE_ORDER.find((f) => FACES[f].axis.every((v, i) => v === axis[i]));

// Is this scheme some orientation of a standard cube? Getting the opposite
// pairs right is not enough: swapping just one pair gives a mirror image,
// which looks entirely plausible and cannot be built.
function isRealScheme(scheme) {
  return REAL_SCHEMES.some((real) => FACE_ORDER.every((f) => real[f] === scheme[f]));
}

// Every orientation a real cube can be held in.
const REAL_SCHEMES = ROTATIONS.map((m) =>
  Object.fromEntries(FACE_ORDER.map((face) => {
    const moved = faceWithAxis(apply(m, FACES[face].axis));
    return [face, CUBE_SCHEME[moved]];
  }))
);

// Naming the top and front colours fixes a cube completely — the other four
// faces follow. Returns null when no cube can be held that way, which is the
// case exactly when the two colours are the same or opposite each other.
function schemeFromTopAndFront(top, front) {
  return REAL_SCHEMES.find((s) => s.U === top && s.F === front) || null;
}

// Why a scheme does not describe a real cube, in words, or null if it does.
function schemeProblem(scheme) {
  const used = new Set(FACE_ORDER.map((f) => scheme[f]));
  if (used.size !== 6) return 'Each of the six colours belongs on exactly one face.';

  for (const [a, b] of OPPOSITE_FACES) {
    const pair = [scheme[a], scheme[b]];
    const known = OPPOSITE_COLOURS.some(
      (o) => o.includes(pair[0]) && o.includes(pair[1])
    );
    if (!known) {
      const pairs = OPPOSITE_COLOURS.map(([a, b]) => `${a} opposite ${b}`);
      return `You have ${pair[0]} opposite ${pair[1]}. On this cube it is ` +
        `${pairs.slice(0, -1).join(', ')} and ${pairs[pairs.length - 1]}. ` +
        'Read the centre square of each face — centres never move, so they are ' +
        'the only colours that say which face is which.';
    }
  }

  if (!isRealScheme(scheme)) {
    return 'The opposite pairs are right, but this arrangement is a mirror ' +
      'image of a real cube — two of the side faces need swapping.';
  }
  return null;
}
