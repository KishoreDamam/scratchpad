/* The solver's interface: paint a cube on the net, watch the solution run on
 * the 3D model.
 *
 * One cube object is the source of truth for what is on screen. Painting
 * rebuilds it from the net; playing the solution turns it move by move.
 */

const CUBIE = 62;   // px, matches --cubie in styles.css
const GAP = 4;
const STEP = CUBIE + GAP;
const VIEW_SCALE = 1.3;
const TURN_MS = 260;

const cubeEl = document.getElementById('cube');
const viewportEl = document.getElementById('viewport');
const netEl = document.getElementById('net');
const paletteEl = document.getElementById('palette');
const validityEl = document.getElementById('validity');
const summaryEl = document.getElementById('summary');
const stagesEl = document.getElementById('stages');
const playbackEl = document.getElementById('playback');
const positionEl = document.getElementById('position');
const nowPlayingEl = document.getElementById('nowPlaying');
const barEl = document.getElementById('bar');
const playButton = document.getElementById('play');
const notationInput = document.getElementById('notation');

// The colour of each face is whatever the viewer painted on its centre, so a
// cube held in an unusual orientation still shows up the way they see it.
let paint = Object.fromEntries(FACE_ORDER.map((f) => [f, f]));
const colourOf = (face) => FACES[paint[face]].color;

let cube = new Cube();
let colours = faceletsFromCube(cube);
let solution = null;      // { stages, moves } once solved
let cursor = 0;           // how many solution moves have been played
let playing = false;
let busy = false;
let brush = 'U';
let view = { x: -26, y: -34 };

const elements = new Map();   // cubie -> DOM node
const faceletEls = [];

/* ---------- 3D view ---------- */

const STICKER_TRANSFORM = {
  U: 'rotateX(90deg)', D: 'rotateX(-90deg)',
  R: 'rotateY(90deg)', L: 'rotateY(-90deg)',
  F: '', B: 'rotateY(180deg)'
};

function transformFor(cubie, prefix = '') {
  const [x, y, z] = cubie.position;
  const m = cubie.orientation;
  const matrix = [
    m[0][0], m[1][0], m[2][0], 0,
    m[0][1], m[1][1], m[2][1], 0,
    m[0][2], m[1][2], m[2][2], 0,
    0, 0, 0, 1
  ].join(',');
  return `${prefix}translate3d(${x * STEP}px, ${y * STEP}px, ${z * STEP}px) matrix3d(${matrix})`;
}

function buildCube() {
  cubeEl.textContent = '';
  elements.clear();
  for (const cubie of cube.cubies) {
    const el = document.createElement('div');
    el.className = 'cubie';
    for (const face of FACE_ORDER) {
      const sticker = document.createElement('div');
      const shown = cubie.stickers.includes(face);
      sticker.className = 'sticker' + (shown ? '' : ' inner');
      sticker.dataset.face = shown ? face : '';
      sticker.style.background = shown ? colourOf(face) : '#131316';
      sticker.style.transform = `${STICKER_TRANSFORM[face]} translateZ(${CUBIE / 2}px)`;
      el.appendChild(sticker);
    }
    el.style.transform = transformFor(cubie);
    elements.set(cubie, el);
    cubeEl.appendChild(el);
  }
  updateView();
}

function updateView() {
  cubeEl.style.transform =
    `scale(${VIEW_SCALE}) rotateX(${view.x}deg) rotateY(${view.y}deg)`;
}

function renderCube() {
  for (const [cubie, el] of elements) el.style.transform = transformFor(cubie);
}

function animateTurn(face, quarters) {
  return new Promise((resolve) => {
    const axis = FACES[face].axis;
    const layer = cube.layer(face);
    for (const cubie of layer) {
      const el = elements.get(cubie);
      el.style.transition = `transform ${TURN_MS}ms cubic-bezier(.4,.1,.25,1)`;
      void el.offsetWidth;
      el.style.transform = transformFor(
        cubie, `rotate3d(${axis[0]},${axis[1]},${axis[2]},${90 * quarters}deg) `
      );
    }
    setTimeout(() => {
      cube.turn(face, quarters);
      for (const cubie of layer) {
        const el = elements.get(cubie);
        el.style.transition = 'none';
        el.style.transform = transformFor(cubie);
      }
      void cubeEl.offsetWidth;
      for (const cubie of layer) elements.get(cubie).style.transition = '';
      resolve();
    }, TURN_MS);
  });
}

/* ---------- the net ---------- */

const NET_ORIGIN = { U: [3, 0], L: [0, 3], F: [3, 3], R: [6, 3], B: [9, 3], D: [3, 6] };

function buildNet() {
  netEl.textContent = '';
  FACELETS.forEach((facelet, index) => {
    const [colOffset, rowOffset] = NET_ORIGIN[facelet.face];
    const el = document.createElement('button');
    el.className = 'facelet' + (facelet.centre ? ' centre' : '');
    el.style.gridColumn = colOffset + facelet.col + 1;
    el.style.gridRow = rowOffset + facelet.row + 1;
    el.type = 'button';
    el.addEventListener('click', () => paintFacelet(index));
    netEl.appendChild(el);
    faceletEls.push(el);
  });
  renderNet();
}

function renderNet() {
  colours.forEach((colour, i) => {
    faceletEls[i].style.background = FACES[colour].color;
    faceletEls[i].setAttribute(
      'aria-label', `${FACELETS[i].face} face, ${FACES[colour].name} sticker`
    );
  });
}

function buildPalette() {
  for (const face of FACE_ORDER) {
    const swatch = document.createElement('button');
    swatch.className = 'swatch';
    swatch.type = 'button';
    swatch.style.background = FACES[face].color;
    swatch.title = FACES[face].name;
    swatch.setAttribute('aria-label', FACES[face].name);
    swatch.addEventListener('click', () => {
      brush = face;
      for (const el of paletteEl.children) el.classList.remove('active');
      swatch.classList.add('active');
    });
    if (face === brush) swatch.classList.add('active');
    paletteEl.appendChild(swatch);
  }
}

function paintFacelet(index) {
  if (busy) return;
  colours[index] = brush;
  renderNet();
  discardSolution();
  // A valid paint takes effect immediately, so the 3D view always shows the
  // cube described by the net.
  const state = validate();
  if (state) adoptState(state);
}

/* ---------- state plumbing ---------- */

function validate() {
  try {
    const state = stateFromFacelets(colours);
    validityEl.textContent = 'This is a solvable cube.';
    validityEl.className = 'validity ok';
    return state;
  } catch (err) {
    if (!(err instanceof CubeStateError)) throw err;
    validityEl.textContent = err.message;
    validityEl.className = 'validity bad';
    return null;
  }
}

function adoptState(state) {
  paint = Object.fromEntries(
    FACE_ORDER.map((face) => [face, colours[faceletAt(face, FACES[face].axis)]])
  );
  cube = cubeFromState(state);
  buildCube();
}

// Replaces the whole cube, e.g. after a scramble or a reset.
function adoptCube(next) {
  cube = next;
  colours = faceletsFromCube(cube);
  paint = Object.fromEntries(FACE_ORDER.map((f) => [f, f]));
  renderNet();
  buildCube();
  validate();
  discardSolution();
}

/* ---------- solving ---------- */

function discardSolution() {
  solution = null;
  cursor = 0;
  playing = false;
  playbackEl.hidden = true;
  stagesEl.textContent = '';
  summaryEl.textContent = 'Paint your cube, then solve it.';
  summaryEl.className = 'summary';
}

document.getElementById('solve').addEventListener('click', () => {
  if (busy) return;
  const state = validate();
  if (!state) {
    summaryEl.textContent = 'Fix the cube above first.';
    summaryEl.className = 'summary bad';
    return;
  }
  adoptState(state);

  if (cube.isSolved()) {
    discardSolution();
    summaryEl.textContent = 'This cube is already solved.';
    summaryEl.className = 'summary ok';
    return;
  }

  const started = performance.now();
  solution = solveCube(cube);
  const elapsed = Math.max(1, Math.round(performance.now() - started));
  cursor = 0;

  summaryEl.innerHTML =
    `<strong>${solution.moves.length} moves</strong> in ${solution.stages.length} stages` +
    `<span class="muted"> &middot; found in ${elapsed}ms</span>`;
  summaryEl.className = 'summary ok';
  renderStages();
  playbackEl.hidden = false;
  updateProgress();
});

function renderStages() {
  stagesEl.textContent = '';
  let offset = 0;
  solution.stages.forEach((stage) => {
    const start = offset;
    const item = document.createElement('li');
    item.className = 'stage-card';

    const head = document.createElement('div');
    head.className = 'stage-head';
    head.innerHTML =
      `<span class="stage-name">${stage.name}</span>` +
      `<span class="stage-count">${stage.moves.length}</span>`;
    item.appendChild(head);

    const detail = document.createElement('p');
    detail.className = 'stage-detail';
    detail.textContent = stage.detail;
    item.appendChild(detail);

    const moves = document.createElement('div');
    moves.className = 'moves';
    stage.moves.forEach((move, i) => {
      const index = start + i;
      const chip = document.createElement('button');
      chip.className = 'move';
      chip.type = 'button';
      chip.textContent = move;
      chip.dataset.index = String(index);
      chip.addEventListener('click', () => seekTo(index + 1));
      moves.appendChild(chip);
    });
    item.appendChild(moves);
    stagesEl.appendChild(item);
    offset += stage.moves.length;
  });
}

/* ---------- playback ---------- */

function updateProgress() {
  if (!solution) return;
  const total = solution.moves.length;
  positionEl.textContent = `${cursor} / ${total}`;
  barEl.style.width = `${(cursor / total) * 100}%`;
  nowPlayingEl.textContent = cursor === 0
    ? 'Scrambled'
    : cursor === total ? 'Solved' : `Next: ${solution.moves[cursor]}`;

  for (const chip of stagesEl.querySelectorAll('.move')) {
    const index = Number(chip.dataset.index);
    chip.classList.toggle('done', index < cursor);
    chip.classList.toggle('next', index === cursor);
  }
  const current = stagesEl.querySelector('.move.next');
  if (current) current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  renderNet();
  document.getElementById('stepBack').disabled = cursor === 0;
  document.getElementById('toStart').disabled = cursor === 0;
  document.getElementById('stepForward').disabled = cursor === total;
  document.getElementById('toEnd').disabled = cursor === total;
}

async function applyStep(forward) {
  if (!solution) return;
  const move = forward ? solution.moves[cursor] : solution.moves[cursor - 1];
  if (move === undefined) return;
  const { face, quarters } = parseMove(move);
  busy = true;
  await animateTurn(face, forward ? quarters : (quarters === 2 ? 2 : -quarters));
  cursor += forward ? 1 : -1;
  colours = faceletsFromCube(cube);
  busy = false;
  updateProgress();
}

// Jumping is instant: turning the cube one animation at a time would take
// most of a minute across a full solution.
function seekTo(target) {
  if (!solution || busy) return;
  playing = false;
  playButton.innerHTML = '&#9654; Play';
  while (cursor < target) {
    const { face, quarters } = parseMove(solution.moves[cursor]);
    cube.turn(face, quarters);
    cursor += 1;
  }
  while (cursor > target) {
    const { face, quarters } = parseMove(solution.moves[cursor - 1]);
    cube.turn(face, quarters === 2 ? 2 : -quarters);
    cursor -= 1;
  }
  colours = faceletsFromCube(cube);
  renderCube();
  updateProgress();
}

async function playLoop() {
  while (playing && solution && cursor < solution.moves.length) {
    await applyStep(true);
  }
  playing = false;
  playButton.innerHTML = '&#9654; Play';
}

playButton.addEventListener('click', () => {
  if (!solution) return;
  if (playing) {
    playing = false;
    playButton.innerHTML = '&#9654; Play';
    return;
  }
  if (cursor === solution.moves.length) seekTo(0);
  playing = true;
  playButton.innerHTML = '&#10073;&#10073; Pause';
  playLoop();
});

document.getElementById('stepForward').addEventListener('click', () => {
  playing = false;
  playButton.innerHTML = '&#9654; Play';
  if (!busy) applyStep(true);
});
document.getElementById('stepBack').addEventListener('click', () => {
  playing = false;
  playButton.innerHTML = '&#9654; Play';
  if (!busy) applyStep(false);
});
document.getElementById('toStart').addEventListener('click', () => seekTo(0));
document.getElementById('toEnd').addEventListener('click', () =>
  seekTo(solution ? solution.moves.length : 0));

/* ---------- entering a cube ---------- */

document.getElementById('scramble').addEventListener('click', () => {
  if (busy) return;
  const next = new Cube();
  for (const move of randomScramble(25)) {
    const { face, quarters } = parseMove(move);
    next.turn(face, quarters);
  }
  adoptCube(next);
});

document.getElementById('resetCube').addEventListener('click', () => {
  if (busy) return;
  adoptCube(new Cube());
  notationInput.value = '';
});

document.getElementById('applyNotation').addEventListener('click', applyNotation);
notationInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') applyNotation();
});

function applyNotation() {
  if (busy) return;
  const text = notationInput.value.trim();
  if (!text) return;
  const tokens = text.split(/\s+/);
  const bad = tokens.find((t) => !/^[UDLRFBudlrfb]('|’|2)?$/.test(t));
  if (bad) {
    validityEl.textContent = `"${bad}" isn't a move. Use U D L R F B, with ' or 2.`;
    validityEl.className = 'validity bad';
    return;
  }
  const next = new Cube();
  for (const token of tokens) {
    const { face, quarters } = parseMove(token.replace('’', "'").toUpperCase());
    next.turn(face, quarters);
  }
  adoptCube(next);
}

/* ---------- drag to orbit ---------- */

let dragging = null;

function pointer(event) {
  const touch = event.touches && event.touches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : { x: event.clientX, y: event.clientY };
}

viewportEl.addEventListener('mousedown', (e) => {
  dragging = { ...pointer(e), view: { ...view } };
  viewportEl.classList.add('dragging');
});
viewportEl.addEventListener('touchstart', (e) => {
  dragging = { ...pointer(e), view: { ...view } };
}, { passive: true });

function moveDrag(event) {
  if (!dragging) return;
  const p = pointer(event);
  view.y = dragging.view.y + (p.x - dragging.x) * 0.4;
  view.x = Math.max(-89, Math.min(89, dragging.view.x - (p.y - dragging.y) * 0.4));
  updateView();
  if (event.cancelable) event.preventDefault();
}

function endDrag() {
  dragging = null;
  viewportEl.classList.remove('dragging');
}

window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);
viewportEl.addEventListener('touchmove', moveDrag, { passive: false });
viewportEl.addEventListener('touchend', endDrag);

/* ---------- boot ---------- */

buildPalette();
buildNet();
buildCube();

// Open on a scrambled cube rather than an empty shell, so the solver has
// something to show straight away.
(() => {
  const next = new Cube();
  for (const move of randomScramble(25)) {
    const { face, quarters } = parseMove(move);
    next.turn(face, quarters);
  }
  adoptCube(next);
})();
