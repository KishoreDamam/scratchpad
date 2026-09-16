/* Layer-by-layer Rubik's cube solver.
 *
 * Solving does not run on the geometric model in cube.js — that model is nice
 * for rendering but heavy to search over. Instead the cube is reduced to the
 * standard compact form: which piece sits in each slot, and how it is twisted.
 *
 *   cp[8]  corner permutation   co[8]  corner twist   (0..2)
 *   ep[12] edge permutation     eo[12] edge flip      (0..1)
 *
 * All 40 numbers live in one Int8Array so states are cheap to copy and hash.
 *
 * Each phase is a breadth-first search over a *restricted* set of moves,
 * keyed only on the pieces that phase cares about. The move set for a phase
 * is chosen so that it cannot disturb what earlier phases solved, which is
 * what keeps the searches small: the last layer phases explore a few hundred
 * states, never the whole cube.
 */

const CORNER_SLOTS = [
  { name: 'URF', pos: [1, -1, 1], faces: ['U', 'R', 'F'] },
  { name: 'UFL', pos: [-1, -1, 1], faces: ['U', 'F', 'L'] },
  { name: 'ULB', pos: [-1, -1, -1], faces: ['U', 'L', 'B'] },
  { name: 'UBR', pos: [1, -1, -1], faces: ['U', 'B', 'R'] },
  { name: 'DFR', pos: [1, 1, 1], faces: ['D', 'F', 'R'] },
  { name: 'DLF', pos: [-1, 1, 1], faces: ['D', 'L', 'F'] },
  { name: 'DBL', pos: [-1, 1, -1], faces: ['D', 'B', 'L'] },
  { name: 'DRB', pos: [1, 1, -1], faces: ['D', 'R', 'B'] }
];

const EDGE_SLOTS = [
  { name: 'UR', pos: [1, -1, 0], faces: ['U', 'R'] },
  { name: 'UF', pos: [0, -1, 1], faces: ['U', 'F'] },
  { name: 'UL', pos: [-1, -1, 0], faces: ['U', 'L'] },
  { name: 'UB', pos: [0, -1, -1], faces: ['U', 'B'] },
  { name: 'DR', pos: [1, 1, 0], faces: ['D', 'R'] },
  { name: 'DF', pos: [0, 1, 1], faces: ['D', 'F'] },
  { name: 'DL', pos: [-1, 1, 0], faces: ['D', 'L'] },
  { name: 'DB', pos: [0, 1, -1], faces: ['D', 'B'] },
  { name: 'FR', pos: [1, 0, 1], faces: ['F', 'R'] },
  { name: 'FL', pos: [-1, 0, 1], faces: ['F', 'L'] },
  { name: 'BL', pos: [-1, 0, -1], faces: ['B', 'L'] },
  { name: 'BR', pos: [1, 0, -1], faces: ['B', 'R'] }
];

const CP = 0, CO = 8, EP = 16, EO = 28, STATE_SIZE = 40;

function solvedState() {
  const s = new Int8Array(STATE_SIZE);
  for (let i = 0; i < 8; i++) s[CP + i] = i;
  for (let i = 0; i < 12; i++) s[EP + i] = i;
  return s;
}

/* ---------- bridge to the geometric model in cube.js ---------- */

// Which face colour the cubie currently shows toward a world direction.
function stickerAt(cubie, dir) {
  for (const face of cubie.stickers) {
    const d = apply(cubie.orientation, FACES[face].axis);
    if (d[0] === dir[0] && d[1] === dir[1] && d[2] === dir[2]) return face;
  }
  return null;
}

function sameSet(a, b) {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function stateFromCube(cube) {
  const state = new Int8Array(STATE_SIZE);
  const at = (pos) =>
    cube.cubies.find((c) => c.position.every((v, i) => v === pos[i]));

  CORNER_SLOTS.forEach((slot, s) => {
    const cubie = at(slot.pos);
    const piece = CORNER_SLOTS.findIndex((p) => sameSet(p.faces, cubie.stickers));
    // The twist is where the piece's U/D sticker ended up among the slot's
    // three outward directions, in the slot's own clockwise order.
    const marked = CORNER_SLOTS[piece].faces[0];
    const twist = slot.faces.findIndex(
      (f) => stickerAt(cubie, FACES[f].axis) === marked
    );
    state[CP + s] = piece;
    state[CO + s] = twist;
  });

  EDGE_SLOTS.forEach((slot, s) => {
    const cubie = at(slot.pos);
    const piece = EDGE_SLOTS.findIndex((p) => sameSet(p.faces, cubie.stickers));
    const marked = EDGE_SLOTS[piece].faces[0];
    state[EP + s] = piece;
    state[EO + s] = stickerAt(cubie, FACES[slot.faces[0]].axis) === marked ? 0 : 1;
  });

  return state;
}

/* ---------- move tables ---------- */

// Each move's table is read off a solved cube that has just been turned, so
// the tables can never drift from the geometry in cube.js.
const MOVE_TABLES = (() => {
  const tables = {};
  for (const face of FACE_ORDER) {
    for (const [suffix, quarters] of [['', 1], ["'", -1], ['2', 2]]) {
      const probe = new Cube();
      probe.turn(face, quarters);
      tables[face + suffix] = stateFromCube(probe);
    }
  }
  return tables;
})();

const ALL_MOVES = Object.keys(MOVE_TABLES);

function applyMove(state, move) {
  const t = MOVE_TABLES[move];
  const out = new Int8Array(STATE_SIZE);
  for (let s = 0; s < 8; s++) {
    const from = t[CP + s];
    out[CP + s] = state[CP + from];
    out[CO + s] = (state[CO + from] + t[CO + s]) % 3;
  }
  for (let s = 0; s < 12; s++) {
    const from = t[EP + s];
    out[EP + s] = state[EP + from];
    out[EO + s] = (state[EO + from] + t[EO + s]) % 2;
  }
  return out;
}

function applyMoves(state, moves) {
  let out = state;
  for (const move of moves) out = applyMove(out, move);
  return out;
}

/* ---------- phase search ---------- */

// Generators are whole move sequences. A phase can therefore be given only
// sequences that leave the already-solved layers alone.
//
// The frontier is ordered by how many quarter turns a path costs rather than
// by how many generators it uses, since a generator here is anything from a
// single turn to an eleven-move algorithm — expanding by generator count
// would happily prefer one long algorithm over three plain turns.
function search(start, generators, keyOf, isGoal) {
  if (isGoal(start)) return [];
  const seen = new Set([keyOf(start)]);
  const buckets = [[{ state: start, path: [] }]];

  for (let cost = 0; cost < buckets.length; cost++) {
    const bucket = buckets[cost];
    if (!bucket) continue;
    for (const node of bucket) {
      for (const gen of generators) {
        const state = applyMoves(node.state, gen);
        const key = keyOf(state);
        if (seen.has(key)) continue;
        seen.add(key);
        const path = node.path.concat(gen);
        if (isGoal(state)) return path;
        const next = cost + gen.length;
        (buckets[next] || (buckets[next] = [])).push({ state, path });
      }
    }
    bucket.length = 0;
  }
  throw new Error('no solution found for this phase');  // exhausted the space
}

const single = (moves) => moves.map((m) => [m]);
const seq = (text) => text.split(' ');

const U_TURNS = single(['U', "U'", 'U2']);

function inverse(moves) {
  return moves
    .slice()
    .reverse()
    .map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'"));
}

function withInverses(sequences) {
  return sequences.flatMap((s) => [s, inverse(s)]);
}

// Inserting a first-layer corner from the U layer: the four slot triggers.
const CORNER_TRIGGERS = withInverses(
  ['R U R\' U\'', 'B U B\' U\'', 'L U L\' U\'', 'F U F\' U\''].map(seq)
);

// Middle-layer edge inserts. For a slot between side faces A and B, the edge
// drops in from above either to the right of A or to the left of B.
const EDGE_INSERTS = withInverses(
  [
    ['F', 'R'], ['R', 'B'], ['B', 'L'], ['L', 'F']
  ].flatMap(([a, b]) => [
    seq(`U ${b} U' ${b}' U' ${a}' U ${a}`),
    seq(`U' ${a}' U ${a} U ${b} U' ${b}'`)
  ])
);

const FLIP_EDGES = seq("F R U R' U' F'");          // orients last-layer edges
const SUNE = seq("R U R' U R U2 R'");              // twists last-layer corners
const ANTI_SUNE = seq("R U2 R' U' R U' R'");
const A_PERM = seq("R' F R' B2 R F' R' B2 R2");    // 3-cycles corners, no twist
const U_PERM = seq("R U' R U R U R U' R' U' R2");  // 3-cycles edges, keeps corners

// Where a tracked piece currently sits, and how it is turned. A move acts on
// a piece purely by where that piece is, so keying on the tracked pieces alone
// is a faithful summary of the search state — keying on slot *contents* is not,
// since a slot's next occupant comes from a slot the key never mentions.
function pieceKey(state, pieces, perm, orient, slots) {
  let out = '';
  for (const piece of pieces) {
    for (let slot = 0; slot < slots; slot++) {
      if (state[perm + slot] === piece) {
        out += slot + ':' + state[orient + slot] + ' ';
        break;
      }
    }
  }
  return out;
}

const edgeKey = (state, pieces) => pieceKey(state, pieces, EP, EO, 12);
const cornerKey = (state, pieces) => pieceKey(state, pieces, CP, CO, 8);

// The last-layer phases only ever move last-layer pieces between last-layer
// slots, so there a slot-wise summary is already complete.
const slotKey = (state, offset, slots) => slots.map((s) => state[offset + s]).join(',');

const CROSS_EDGES = [5, 4, 7, 6];      // DF, DR, DB, DL
const FIRST_CORNERS = [4, 5, 6, 7];    // DFR, DLF, DBL, DRB
const MIDDLE_EDGES = [8, 9, 10, 11];   // FR, FL, BL, BR
const LAST_EDGES = [0, 1, 2, 3];       // UR, UF, UL, UB
const LAST_CORNERS = [0, 1, 2, 3];     // URF, UFL, ULB, UBR

const edgesHome = (state, slots) =>
  slots.every((s) => state[EP + s] === s && state[EO + s] === 0);
const cornersHome = (state, slots) =>
  slots.every((s) => state[CP + s] === s && state[CO + s] === 0);

/* ---------- the solve ---------- */

function solveState(start) {
  const stages = [];
  let state = start;

  const run = (label, generators, keyOf, isGoal) => {
    let moves;
    try {
      moves = search(state, generators, keyOf, isGoal);
    } catch (err) {
      throw new Error(`${label}: ${err.message}`);
    }
    state = applyMoves(state, moves);
    return moves;
  };

  // Pieces go in one at a time. Each search then ends within a couple of
  // moves, so it never has to walk the whole space its key could describe.
  const stage = (name, detail, steps) => {
    const moves = steps();
    stages.push({ name, detail, moves });
  };

  stage('Bottom cross', 'Four edges around the D centre', () => {
    let moves = [];
    const placed = [];
    for (const slot of CROSS_EDGES) {
      placed.push(slot);
      const tracked = placed.slice();
      moves = moves.concat(
        run('cross', single(ALL_MOVES),
          (s) => edgeKey(s, tracked),
          (s) => edgesHome(s, tracked))
      );
    }
    return moves;
  });

  stage('Bottom corners', 'First layer complete', () => {
    let moves = [];
    const placed = [];
    for (const slot of FIRST_CORNERS) {
      placed.push(slot);
      const tracked = placed.slice();
      moves = moves.concat(
        run('corners', U_TURNS.concat(CORNER_TRIGGERS),
          (s) => cornerKey(s, tracked),
          (s) => cornersHome(s, tracked))
      );
    }
    return moves;
  });

  stage('Middle layer', 'Four edges between the centres', () => {
    let moves = [];
    const placed = [];
    for (const slot of MIDDLE_EDGES) {
      placed.push(slot);
      const tracked = placed.slice();
      moves = moves.concat(
        run('middle', U_TURNS.concat(EDGE_INSERTS),
          (s) => edgeKey(s, tracked),
          (s) => edgesHome(s, tracked))
      );
    }
    return moves;
  });

  stage('Top cross', 'Last-layer edges flipped up', () =>
    run('flip', U_TURNS.concat([FLIP_EDGES]),
      (s) => slotKey(s, EO, LAST_EDGES),
      (s) => LAST_EDGES.every((slot) => s[EO + slot] === 0))
  );

  stage('Top face', 'Last-layer corners twisted up', () =>
    run('twist', U_TURNS.concat([SUNE, ANTI_SUNE]),
      (s) => slotKey(s, CO, LAST_CORNERS),
      (s) => LAST_CORNERS.every((slot) => s[CO + slot] === 0))
  );

  stage('Corner positions', 'Last-layer corners sorted', () =>
    run('corner perm', U_TURNS.concat(withInverses([A_PERM])),
      (s) => slotKey(s, CP, LAST_CORNERS),
      (s) => cornersHome(s, LAST_CORNERS))
  );

  stage('Edge positions', 'Last-layer edges sorted', () =>
    run('edge perm', U_TURNS.concat(withInverses([U_PERM])),
      (s) => slotKey(s, EP, LAST_EDGES) + '|' + slotKey(s, CP, LAST_CORNERS),
      (s) => edgesHome(s, LAST_EDGES) && cornersHome(s, LAST_CORNERS))
  );

  return stages;
}

/* ---------- tidying the move list ---------- */

const QUARTERS = { "'": 3, '2': 2, '': 1 };

// Collapses runs on the same face: R R -> R2, R R' -> nothing, R2 R -> R'.
function simplify(moves) {
  const out = [];
  for (const move of moves) {
    const face = move[0];
    const turns = QUARTERS[move.slice(1)];
    if (out.length && out[out.length - 1].face === face) {
      const merged = (out[out.length - 1].turns + turns) % 4;
      out.pop();
      if (merged) out.push({ face, turns: merged });
    } else {
      out.push({ face, turns });
    }
  }
  return out.map((m) => m.face + (m.turns === 3 ? "'" : m.turns === 2 ? '2' : ''));
}

// Simplifying can bring two turns of the same face together across a turn of
// the opposite face (R L R' -> R R' L), so keep passes going until stable.
function tidy(moves) {
  let current = moves;
  for (;;) {
    const once = simplify(current);
    const swapped = [];
    for (let i = 0; i < once.length; i++) {
      const a = once[i], b = once[i + 1];
      if (b && isOpposite(a[0], b[0]) && once[i + 2] && once[i + 2][0] === a[0]) {
        swapped.push(b, a);
        i += 1;
      } else {
        swapped.push(a);
      }
    }
    const next = simplify(swapped);
    if (next.length === current.length && next.every((m, i) => m === current[i])) {
      return next;
    }
    current = next;
  }
}

// Solves a geometric Cube. Returns the stages, each with its own tidied move
// list, plus the full solution.
function solveCube(cube) {
  const stages = solveState(stateFromCube(cube)).map((s) => ({
    ...s,
    moves: tidy(s.moves)
  }));
  return { stages, moves: stages.flatMap((s) => s.moves) };
}
