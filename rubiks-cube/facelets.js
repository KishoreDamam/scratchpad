/* The flat net: 54 stickers, and the conversion between what is painted on
 * them and a solver state.
 *
 * The net is laid out as the cube unfolds around the front face:
 *
 *        U
 *     L  F  R  B
 *        D
 *
 * Each face is walked left-to-right, top-to-bottom in that layout, so every
 * sticker maps to one cubie position and one outward direction.
 */

const NET_FACES = [
  { face: 'U', right: [1, 0, 0], down: [0, 0, 1] },
  { face: 'L', right: [0, 0, 1], down: [0, 1, 0] },
  { face: 'F', right: [1, 0, 0], down: [0, 1, 0] },
  { face: 'R', right: [0, 0, -1], down: [0, 1, 0] },
  { face: 'B', right: [-1, 0, 0], down: [0, 1, 0] },
  { face: 'D', right: [1, 0, 0], down: [0, 0, -1] }
];

const FACELETS = [];
const FACELET_INDEX = new Map(); // "face|x,y,z" -> index into FACELETS

for (const { face, right, down } of NET_FACES) {
  const normal = FACES[face].axis;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const pos = normal.map(
        (v, i) => v + right[i] * (col - 1) + down[i] * (row - 1)
      );
      FACELET_INDEX.set(`${face}|${pos.join(',')}`, FACELETS.length);
      FACELETS.push({ face, row, col, pos, dir: normal, centre: row === 1 && col === 1 });
    }
  }
}

const faceletAt = (face, pos) => FACELET_INDEX.get(`${face}|${pos.join(',')}`);

// The colours a cube is currently showing, as face letters, one per sticker.
function faceletsFromCube(cube) {
  const at = (pos) => cube.cubies.find((c) => c.position.every((v, i) => v === pos[i]));
  return FACELETS.map((f) => stickerAt(at(f.pos), f.dir));
}

class CubeStateError extends Error {}

// Reads a painted net into a solver state, refusing anything that isn't a
// cube you could actually hold.
function stateFromFacelets(colours) {
  if (colours.length !== 54 || colours.some((c) => !c)) {
    throw new CubeStateError('Every sticker needs a colour.');
  }

  const tally = {};
  for (const colour of colours) tally[colour] = (tally[colour] || 0) + 1;
  const wrong = Object.entries(tally).filter(([, n]) => n !== 9);
  if (Object.keys(tally).length !== 6 || wrong.length) {
    throw new CubeStateError('Each of the six colours must appear exactly nine times.');
  }

  // Centres never move, so they name the faces.
  const faceOfColour = new Map();
  for (const face of FACE_ORDER) {
    const colour = colours[faceletAt(face, FACES[face].axis)];
    if (faceOfColour.has(colour)) {
      throw new CubeStateError('Two centres share a colour — check the middle stickers.');
    }
    faceOfColour.set(colour, face);
  }

  const state = new Int8Array(STATE_SIZE);
  const readPiece = (slot, slots, label) => {
    const faces = slot.faces.map((f) => faceOfColour.get(colours[faceletAt(f, slot.pos)]));
    const piece = slots.findIndex((p) => sameSet(p.faces, faces));
    if (piece < 0) {
      throw new CubeStateError(`The ${slot.name} ${label} isn't a real piece of this cube.`);
    }
    return { piece, faces };
  };

  CORNER_SLOTS.forEach((slot, s) => {
    const { piece, faces } = readPiece(slot, CORNER_SLOTS, 'corner');
    state[CP + s] = piece;
    state[CO + s] = faces.indexOf(CORNER_SLOTS[piece].faces[0]);
  });
  EDGE_SLOTS.forEach((slot, s) => {
    const { piece, faces } = readPiece(slot, EDGE_SLOTS, 'edge');
    state[EP + s] = piece;
    state[EO + s] = faces[0] === EDGE_SLOTS[piece].faces[0] ? 0 : 1;
  });

  assertSolvable(state);
  return state;
}

function permutationParity(values) {
  let swaps = 0;
  const order = Array.from(values);
  for (let i = 0; i < order.length; i++) {
    while (order[i] !== i) {
      const j = order[i];
      [order[i], order[j]] = [order[j], order[i]];
      swaps += 1;
    }
  }
  return swaps % 2;
}

// The three ways a cube can be mis-assembled: a twisted corner, a flipped
// edge, or a single swapped pair. None of them can be turned back to solved.
function assertSolvable(state) {
  const corners = Array.from(state.slice(CP, CP + 8));
  const edges = Array.from(state.slice(EP, EP + 12));
  if (new Set(corners).size !== 8 || new Set(edges).size !== 12) {
    throw new CubeStateError('Some pieces appear twice — check the sticker colours.');
  }

  let twist = 0;
  for (let i = 0; i < 8; i++) twist += state[CO + i];
  if (twist % 3) throw new CubeStateError('A corner is twisted: this cube can\'t be solved.');

  let flip = 0;
  for (let i = 0; i < 12; i++) flip += state[EO + i];
  if (flip % 2) throw new CubeStateError('An edge is flipped: this cube can\'t be solved.');

  if (permutationParity(corners) !== permutationParity(edges)) {
    throw new CubeStateError('Two pieces are swapped: this cube can\'t be solved.');
  }
}

/* ---------- state -> geometry, so a read-in cube can be shown and turned ---------- */

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];

// The rotation carrying each of the piece's home sticker directions onto the
// direction it now points. With an orthonormal triple that is just the sum of
// their outer products.
function orientationFrom(fromAxes, toAxes) {
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) m[i][j] += toAxes[k][i] * fromAxes[k][j];
    }
  }
  return m;
}

function cubeFromState(state) {
  const cube = new Cube();
  const at = (pos) => cube.cubies.find((c) => c.position.every((v, i) => v === pos[i]));

  const seat = (slot, piece, slotFaces) => {
    const cubie = at(slot.pos);
    cubie.stickers = piece.faces.slice();
    cubie.home = piece.pos.slice();
    const from = piece.faces.map((f) => FACES[f].axis);
    const to = slotFaces.map((f) => FACES[f].axis);
    if (from.length === 2) {
      // An edge pins only two directions; the third comes from their normal.
      from.push(cross(from[0], from[1]));
      to.push(cross(to[0], to[1]));
    }
    cubie.orientation = orientationFrom(from, to);
  };

  CORNER_SLOTS.forEach((slot, s) => {
    const twist = state[CO + s];
    seat(slot, CORNER_SLOTS[state[CP + s]],
      [0, 1, 2].map((k) => slot.faces[(twist + k) % 3]));
  });

  EDGE_SLOTS.forEach((slot, s) => {
    seat(slot, EDGE_SLOTS[state[EP + s]],
      state[EO + s] ? [slot.faces[1], slot.faces[0]] : slot.faces);
  });

  return cube;
}
