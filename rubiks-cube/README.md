# Rubik's Cube Solver

Enter the cube you are holding and get the turns that solve it. No build step
and no dependencies — open `index.html`.

## Using it

1. **Describe your cube.** Click a colour, then click stickers on the flat net.
   The centres are what say which colour is which face, so paint them the way
   you are actually holding the cube — an unusual colour scheme or a cube held
   sideways both work, and the 3D view recolours to match.
   You can also paste a scramble in standard notation, or roll a random one.
2. **Solve.** The state is checked first: a solvable cube is solved in a few
   milliseconds, and an impossible one is rejected with the reason.
3. **Follow along.** The solution is grouped into stages. Play it, step through
   it a move at a time, or click any move to jump the cube to that point.

Moves use standard notation: `U D L R F B` for a clockwise quarter turn of a
face, `'` for counter-clockwise, `2` for a half turn.

## What it rejects

A cube can be painted that no amount of turning could produce. All three
impossible cases are caught before solving, along with miscounted colours:

- a single **twisted corner** (corner twists must sum to a multiple of three)
- a single **flipped edge** (edge flips must sum to an even number)
- a **swapped pair** of pieces (corner and edge permutations must agree in parity)

Those three conditions are not just necessary but sufficient, so anything that
gets past them really is solvable — including a cube whose colour scheme is
arranged unusually.

## How it works

**`cube.js`** is the geometric model used for display. Each of the 26 visible
cubies stores an integer grid position and a 3×3 orientation matrix; a face
turn multiplies both by a 90° rotation matrix, so entries stay exactly −1, 0
or 1 and never drift. Coordinates follow the CSS convention (x right, y
**down**, z toward the viewer) and every face is keyed to its outward normal:
`R = +x`, `L = −x`, `U = −y`, `D = +y`, `F = +z`, `B = −z`. A clockwise turn is
then a +90° rotation about that normal — exactly what `rotate3d()` does with
the same axis, so the animation and the model agree by construction.

**`solver.js`** does not search that model; it reduces the cube to the standard
compact form — which piece is in each slot, and how it is turned — packed into
one 40-byte array. The move tables are read off a solved cube that has just
been turned, so they cannot drift from the geometry.

Solving runs in seven phases, each a small search whose move set is chosen so
it *cannot* disturb what the earlier phases solved: first-layer corners move
only via `R U R' U'`-style triggers, which leave the bottom cross alone; the
last layer moves only via algorithms that leave the first two layers alone.
That restriction is what keeps the searches small — the last-layer phases
explore a few hundred states rather than the whole cube.

Two details matter for correctness. The frontier is ordered by quarter turns
rather than by number of algorithms, since a generator here is anything from a
single turn to an eleven-move sequence. And each phase is keyed on *where its
tracked pieces are*, never on what sits in a given slot: a move acts on a piece
purely by where that piece is, so tracking pieces is a faithful summary, while
tracking slot contents would let the search discard states it still needed.

**`facelets.js`** converts between the painted net and a solver state, and
rebuilds a geometric cube from a state so anything read in can be shown and
turned.

## Tests

The model and solver are covered by assertions run under Node:

- `(R U R' U')^6` and `F^4` are the identity; `L2` equals two `L` turns; an
  inverted scramble solves; centres stay fixed; nine stickers per colour.
- every solver generator leaves the layers it claims to preserve untouched,
  and the A-perm and U-perm are pure 3-cycles.
- the compact move tables reproduce the geometric model move for move.
- **5000 random scrambles, all solved** — averaging 114 moves, worst case 18ms.
- the net round-trips through a state and back, and each impossible cube is
  rejected with the right reason.

Run them with `./test/run.sh` (optionally passing a scramble count, default 1000).
