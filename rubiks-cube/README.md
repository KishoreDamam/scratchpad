# Rubik's Cube Solver

Enter the cube you are holding and get the turns that solve it — and learn the
method well enough to do it without the app. No build step and no
dependencies: open `index.html`.

Two tabs: **Solve** answers this cube, **Learn** teaches you to answer the next
one.

## Solve

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

## Learn

The method solves the bottom layer first, and the default colours put white
there — so stage one builds the white cross most tutorials start with. That is
an ordinary cube held upside down: turning it over swaps left and right too,
so red sits on the left of green rather than the right. Paint the centres any
way you like and the lessons still read correctly; they name the bottom colour
rather than assuming it.

The same seven stages, taught one at a time. Each lesson gives the goal, what
to look for on the cube, the algorithm (with a **Watch it** button that runs it
in front of you), why it works, and how to tell when the stage is done.

Then **practise it**. The app builds a cube finished up to that stage and
scrambled from there, hands you the controls, and gets out of the way:

- Turn the cube with the buttons or the keyboard, and undo a wrong turn.
- **Hint** names the next move; **Show step** plays the whole placement.
- A meter counts the pieces placed, and full always means finished.
- Break an earlier stage and it says so — noticing that yourself is most of
  the skill.
- Stages you complete are ticked off and remembered between visits.

Every algorithm a lesson teaches is one the solver itself searches with,
referenced rather than retyped, so the lessons cannot drift from the code. The
counts quoted ("at most three applications") are measured against the solver
over thousands of random cubes.

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
- the default colours are some orientation of a real cube, checked against all
  24 rotations of the standard scheme — a mirror-image palette looks plausible
  and cannot be built.
- every lesson matches the solver: the algorithms it teaches are generators
  the solver actually uses, and the cross stage teaches none.
- phases complete in order and stay complete; progress counters read full
  exactly when a stage is done; and from a practice setup at any stage,
  following hints finishes it without breaking an earlier one.

Run them with `./test/run.sh` (optionally passing a scramble count, default 1000).
