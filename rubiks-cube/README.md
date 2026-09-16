# Rubik's Cube

A 3D Rubik's cube in the browser, with no build step and no dependencies —
just open `index.html`.

## Controls

- **Drag** anywhere on the stage to orbit the camera.
- **Keys** `U` `D` `L` `R` `F` `B` turn a face clockwise; hold `Shift` for
  counter-clockwise.
- **Buttons** for every face turn, plus scramble, reset, undo and an
  animation-speed slider.
- The timer starts on your first move after a scramble and stops the moment
  the cube is solved.

## How it works

`cube.js` holds the model. Each of the 26 visible cubies stores its integer
grid position and a 3×3 orientation matrix; a face turn multiplies both by a
90° rotation matrix, so entries stay exactly −1, 0 or 1 and never drift.

Coordinates use the CSS convention (x right, y **down**, z toward the viewer),
and every face is identified by its outward normal: `R = +x`, `L = −x`,
`U = −y`, `D = +y`, `F = +z`, `B = −z`. A clockwise turn is a +90° rotation
about that normal — which is exactly what `rotate3d()` does with the same
axis, so the CSS animation and the model agree by construction.

`app.js` renders each cubie as `translate3d(position) matrix3d(orientation)`.
To animate a turn it prepends `rotate3d(axis, 90deg)` to the transforms of
the nine cubies in the layer, and when the transition ends it commits the
turn to the model and rewrites the transforms without animation.

Stickers are assigned once at solved state from each cubie's outward-facing
sides, then simply ride along with the orientation matrix.
