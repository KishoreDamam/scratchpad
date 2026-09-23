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

const SCHEME_KEY = 'rubiks-scheme';
const SCHEME_FACES = [
  ['U', 'Top'], ['D', 'Bottom'], ['F', 'Front'],
  ['B', 'Back'], ['L', 'Left'], ['R', 'Right']
];

// Which colour sits on each face of the viewer's own cube. Set directly in
// the scheme panel, or read back from whatever they paint on the centres.
let scheme = loadScheme();
const colourOf = (face) => COLOURS[scheme[face]];

let cube = new Cube();
let colours = paintedFacelets();
let solution = null;      // { stages, moves } once solved
let cursor = 0;           // how many solution moves have been played
let playing = false;
let busy = false;
let brush = 'white';
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

/* ---------- the viewer's colour scheme ---------- */

// Storage can be missing or blocked, and stored text can be nonsense. Those
// are the only failures worth absorbing — anything else is a bug in here, and
// swallowing it would hide it, so it goes back up.
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    if (err instanceof DOMException) return null;
    throw err;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (!(err instanceof DOMException)) throw err;
  }
}

function loadScheme() {
  const raw = readStored(SCHEME_KEY);
  if (!raw) return { ...DEFAULT_SCHEME };
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (err) {
    return { ...DEFAULT_SCHEME };
  }
  const usable = saved && FACE_ORDER.every((f) => COLOUR_KEYS.includes(saved[f]));
  return usable ? saved : { ...DEFAULT_SCHEME };
}

const saveScheme = () => writeStored(SCHEME_KEY, JSON.stringify(scheme));

// The cube's stickers, in the viewer's colours.
function paintedFacelets() {
  return faceletsFromCube(cube).map((face) => scheme[face]);
}

function buildScheme() {
  const rows = document.getElementById('schemeRows');
  for (const [face, label] of [['U', 'Top face'], ['F', 'Front face']]) {
    const row = document.createElement('label');
    row.className = 'scheme-row';

    const name = document.createElement('span');
    name.textContent = label;
    row.appendChild(name);

    const select = document.createElement('select');
    select.dataset.face = face;
    for (const colour of COLOUR_KEYS) {
      const option = document.createElement('option');
      option.value = colour;
      option.textContent = colour;
      select.appendChild(option);
    }
    select.addEventListener('change', chooseOrientation);
    row.appendChild(select);
    rows.appendChild(row);
  }
  renderScheme();
}

// Two colours name an orientation, and the remaining four follow from it, so
// the viewer can never build an impossible cube here by accident.
function chooseOrientation() {
  const top = document.querySelector('#schemeRows select[data-face="U"]').value;
  const front = document.querySelector('#schemeRows select[data-face="F"]').value;
  const next = schemeFromTopAndFront(top, front);

  if (!next) {
    const note = document.getElementById('schemeNote');
    note.textContent = top === front
      ? `Both faces can't be ${top}.`
      : `${top} and ${front} are on opposite sides of the cube, so you can't see both at once. Pick a colour next to ${top}.`;
    note.className = 'hint bad';
    document.getElementById('schemeBox').classList.add('flagged');
    return;
  }

  scheme = next;
  saveScheme();
  colours = paintedFacelets();
  renderScheme();
  renderNet();
  buildCube();
  validate();
  discardSolution();
}

function renderScheme() {
  for (const select of document.querySelectorAll('#schemeRows select')) {
    select.value = scheme[select.dataset.face];
  }

  const derived = document.getElementById('schemeDerived');
  derived.textContent = '';
  for (const [face, label] of SCHEME_FACES) {
    const cell = document.createElement('span');
    cell.className = 'scheme-cell';
    cell.innerHTML =
      `<span class="scheme-chip" style="background:${COLOURS[scheme[face]]}"></span>` +
      `<span>${label}</span>`;
    cell.title = `${label}: ${scheme[face]}`;
    derived.appendChild(cell);
  }

  // Painting the centres can still describe a cube that cannot exist, so the
  // check stays even though the selects above cannot produce one.
  const problem = schemeProblem(scheme);
  const note = document.getElementById('schemeNote');
  note.textContent = problem || 'This matches a real cube.';
  note.className = problem ? 'hint bad' : 'hint ok';
  document.getElementById('schemeBox').classList.toggle('flagged', Boolean(problem));
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
    faceletEls[i].style.background = COLOURS[colour];
    faceletEls[i].setAttribute(
      'aria-label', `${FACELETS[i].face} face, ${colour} sticker`
    );
  });
}

function buildPalette() {
  for (const colour of COLOUR_KEYS) {
    const swatch = document.createElement('button');
    swatch.className = 'swatch';
    swatch.type = 'button';
    swatch.style.background = COLOURS[colour];
    swatch.title = colour;
    swatch.setAttribute('aria-label', colour);
    swatch.addEventListener('click', () => {
      brush = colour;
      for (const el of paletteEl.children) el.classList.remove('active');
      swatch.classList.add('active');
    });
    if (colour === brush) swatch.classList.add('active');
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

// The centres are what name the faces, so painting them is the same act as
// setting the scheme — read it back rather than keeping a second copy.
function adoptState(state) {
  scheme = Object.fromEntries(
    FACE_ORDER.map((face) => [face, colours[faceletAt(face, FACES[face].axis)]])
  );
  saveScheme();
  renderScheme();
  cube = cubeFromState(state);
  buildCube();
}

// Replaces the whole cube, e.g. after a scramble or a reset. The viewer's
// colour scheme survives it — only the arrangement changes.
function adoptCube(next) {
  cube = next;
  colours = paintedFacelets();
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
  colours = paintedFacelets();
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
  colours = paintedFacelets();
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

/* ---------- learning ---------- */

const learnEls = {
  panel: document.getElementById('learnPanel'),
  course: document.getElementById('course'),
  courseProgress: document.getElementById('courseProgress'),
  notationList: document.getElementById('notationList'),
  clockwiseNote: document.getElementById('clockwiseNote'),
  lesson: document.getElementById('lessonGroup'),
  stage: document.getElementById('lessonStage'),
  name: document.getElementById('lessonName'),
  goal: document.getElementById('lessonGoal'),
  idea: document.getElementById('lessonIdea'),
  look: document.getElementById('lessonLook'),
  algs: document.getElementById('lessonAlgs'),
  why: document.getElementById('lessonWhy'),
  check: document.getElementById('lessonCheck'),
  practice: document.getElementById('practiceGroup'),
  practiceStage: document.getElementById('practiceStage'),
  practiceGoal: document.getElementById('practiceGoal'),
  practiceCount: document.getElementById('practiceCount'),
  practiceBar: document.getElementById('practiceBar'),
  feedback: document.getElementById('practiceFeedback'),
  hintText: document.getElementById('hintText')
};

const turnpadEl = document.getElementById('turnpad');
let mode = 'solve';
let lessonIndex = 0;
let practicePhase = null;   // the phase being drilled, or null
let turnHistory = [];

// Which stages the learner has finished at least once. Per-viewer only, and
// the app works the same if the browser refuses to store it.
const LEARNED_KEY = 'rubiks-learned';

function loadLearned() {
  const raw = readStored(LEARNED_KEY);
  if (!raw) return new Set();
  try {
    const saved = JSON.parse(raw);
    return new Set(Array.isArray(saved) ? saved : []);
  } catch (err) {
    return new Set();
  }
}

const saveLearned = () => writeStored(LEARNED_KEY, JSON.stringify([...learned]));

let learned = loadLearned();

/* ---------- tabs ---------- */

function setMode(next) {
  mode = next;
  const learning = next === 'learn';
  document.getElementById('solvePanel').hidden = learning;
  learnEls.panel.hidden = !learning;
  document.getElementById('tabSolve').classList.toggle('active', !learning);
  document.getElementById('tabLearn').classList.toggle('active', learning);
  document.getElementById('tabSolve').setAttribute('aria-selected', String(!learning));
  document.getElementById('tabLearn').setAttribute('aria-selected', String(learning));
  turnpadEl.hidden = !learning;
  playbackEl.hidden = learning || !solution;
  if (learning) showLesson(lessonIndex);
}

document.getElementById('tabSolve').addEventListener('click', () => setMode('solve'));
document.getElementById('tabLearn').addEventListener('click', () => setMode('learn'));

/* ---------- course list ---------- */

function buildNotation() {
  for (const { move, text } of NOTATION) {
    const row = document.createElement('div');
    row.className = 'notation-row';
    row.innerHTML = `<span class="move static">${move}</span><span>${text}</span>`;
    learnEls.notationList.appendChild(row);
  }
  learnEls.clockwiseNote.textContent = CLOCKWISE_NOTE;
}

function renderCourse() {
  learnEls.course.textContent = '';
  COURSE.forEach((lesson, index) => {
    const item = document.createElement('li');
    item.className = 'course-step';
    item.classList.toggle('current', index === lessonIndex);
    item.classList.toggle('learned', learned.has(lesson.key));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'course-button';
    button.innerHTML =
      `<span class="course-index">${index + 1}</span>` +
      `<span class="course-text"><span class="course-name">${lesson.name}</span>` +
      `<span class="course-detail">${lesson.detail}</span></span>` +
      `<span class="course-mark">${learned.has(lesson.key) ? '&#10003;' : ''}</span>`;
    button.addEventListener('click', () => showLesson(index));
    item.appendChild(button);
    learnEls.course.appendChild(item);
  });

  const done = COURSE.filter((l) => learned.has(l.key)).length;
  learnEls.courseProgress.textContent =
    done === COURSE.length
      ? 'All seven stages practised. You can solve a cube unaided.'
      : `${done} of ${COURSE.length} stages practised.`;
  learnEls.courseProgress.className = done === COURSE.length ? 'summary ok' : 'summary';
}

function algorithmBlock(alg) {
  const box = document.createElement('div');
  box.className = 'alg';

  const head = document.createElement('div');
  head.className = 'alg-head';
  head.innerHTML = `<span class="alg-name">${alg.name}</span>`;

  const watch = document.createElement('button');
  watch.type = 'button';
  watch.className = 'small';
  watch.textContent = 'Watch it';
  watch.addEventListener('click', () => playSequence(alg.moves));
  head.appendChild(watch);
  box.appendChild(head);

  const moves = document.createElement('div');
  moves.className = 'moves';
  for (const move of alg.moves) {
    const chip = document.createElement('span');
    chip.className = 'move static';
    chip.textContent = move;
    moves.appendChild(chip);
  }
  box.appendChild(moves);

  const note = document.createElement('p');
  note.className = 'alg-note';
  note.textContent = alg.note;
  box.appendChild(note);
  return box;
}

function showLesson(index) {
  lessonIndex = index;
  const lesson = COURSE[index];
  learnEls.lesson.hidden = false;
  learnEls.stage.textContent = `Stage ${index + 1} of ${COURSE.length}`;
  learnEls.name.textContent = lesson.name;
  learnEls.goal.textContent = lesson.goal;
  learnEls.idea.textContent = lesson.idea;

  learnEls.look.textContent = '';
  for (const step of lesson.look) {
    const li = document.createElement('li');
    li.textContent = step;
    learnEls.look.appendChild(li);
  }

  learnEls.algs.textContent = '';
  if (lesson.algorithms.length) {
    const head = document.createElement('h4');
    head.className = 'lesson-head';
    head.textContent = lesson.algorithms.length > 1 ? 'The algorithms' : 'The algorithm';
    learnEls.algs.appendChild(head);
    for (const alg of lesson.algorithms) learnEls.algs.appendChild(algorithmBlock(alg));
  }

  learnEls.why.textContent = lesson.why;
  learnEls.check.textContent = `Done when: ${lesson.check}`;
  renderCourse();
}

/* ---------- practice ---------- */

const phaseFor = (key) => PHASES.find((p) => p.key === key);

// Builds a cube that is finished up to the chosen stage and scrambled from
// there on, by solving a random cube and stopping at the right moment.
function setUpPractice(key) {
  const target = PHASES.findIndex((p) => p.key === key);
  for (let attempt = 0; attempt < 20; attempt++) {
    const start = new Cube();
    for (const move of randomScramble(25)) {
      const { face, quarters } = parseMove(move);
      start.turn(face, quarters);
    }
    const { stages } = solveCube(start);
    for (let i = 0; i < target; i++) {
      for (const move of stages[i].moves) {
        const { face, quarters } = parseMove(move);
        start.turn(face, quarters);
      }
    }
    // Reject the occasional cube that arrives with this stage already done.
    if (!phaseDone(stateFromCube(start), PHASES[target])) return start;
  }
  return null;
}

function startPractice(key) {
  const next = setUpPractice(key);
  if (!next) return;
  practicePhase = phaseFor(key);
  turnHistory = [];
  cube = next;
  colours = paintedFacelets();
  renderNet();
  buildCube();
  discardSolution();
  learnEls.practice.hidden = false;
  learnEls.practiceStage.textContent = practicePhase.name;
  learnEls.practiceGoal.textContent = LESSONS[key].goal;
  learnEls.hintText.hidden = true;
  // The cross is built on the face you cannot see from the default angle.
  setViewFromBelow(key === 'cross');
  updatePractice('Your move.');
  learnEls.practice.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.getElementById('startPractice').addEventListener('click', () => {
  startPractice(COURSE[lessonIndex].key);
});
document.getElementById('newPractice').addEventListener('click', () => {
  if (practicePhase) startPractice(practicePhase.key);
});

function updatePractice(message, tone = '') {
  if (!practicePhase) return;
  const state = stateFromCube(cube);
  const placed = practicePhase.progress(state);
  const total = phaseTotal(practicePhase);
  learnEls.practiceCount.textContent = `${placed} / ${total}`;
  learnEls.practiceBar.style.width = `${(placed / total) * 100}%`;

  // Anything earlier that the learner has knocked out is worth saying, since
  // spotting it yourself is most of the skill.
  const broken = PHASES
    .slice(0, PHASES.indexOf(practicePhase))
    .filter((p) => !phaseDone(state, p));

  if (phaseDone(state, practicePhase)) {
    if (broken.length) {
      learnEls.feedback.textContent =
        `That finishes the stage, but ${broken[0].name.toLowerCase()} came apart on the way. Undo and try to keep it intact.`;
      learnEls.feedback.className = 'summary bad';
      return;
    }
    if (!learned.has(practicePhase.key)) {
      learned.add(practicePhase.key);
      saveLearned();
      renderCourse();
    }
    const next = PHASES[PHASES.indexOf(practicePhase) + 1];
    learnEls.feedback.textContent = next
      ? `Stage complete. Next up: ${next.name}.`
      : 'Stage complete — the cube is solved. That is the whole method.';
    learnEls.feedback.className = 'summary ok';
    return;
  }

  if (broken.length) {
    learnEls.feedback.textContent = `Careful — ${broken[0].name.toLowerCase()} came apart. Undo, or start a new cube.`;
    learnEls.feedback.className = 'summary bad';
    return;
  }

  learnEls.feedback.textContent = message;
  learnEls.feedback.className = 'summary' + (tone ? ' ' + tone : '');
}

document.getElementById('hint').addEventListener('click', () => {
  if (!practicePhase || busy) return;
  const moves = phaseHint(stateFromCube(cube), practicePhase);
  learnEls.hintText.hidden = false;
  learnEls.hintText.innerHTML = moves.length
    ? `Next move: <span class="move static">${moves[0]}</span>` +
      (moves.length > 1 ? `<span class="muted"> &middot; ${moves.length} to finish this piece</span>` : '')
    : 'Nothing left to do here.';
});

document.getElementById('showStep').addEventListener('click', async () => {
  if (!practicePhase || busy) return;
  const moves = phaseHint(stateFromCube(cube), practicePhase);
  if (!moves.length) return;
  learnEls.hintText.hidden = false;
  learnEls.hintText.innerHTML =
    'The step: ' + moves.map((m) => `<span class="move static">${m}</span>`).join(' ');
  await playSequence(moves);
});

/* ---------- turning by hand ---------- */

async function playSequence(moves) {
  if (busy) return;
  for (const move of moves) {
    const { face, quarters } = parseMove(move);
    await manualTurn(face, quarters);
  }
}

async function manualTurn(face, quarters) {
  if (busy) return;
  busy = true;
  await animateTurn(face, quarters);
  turnHistory.push({ face, quarters });
  colours = paintedFacelets();
  renderNet();
  busy = false;
  updatePractice('Your move.');
}

function buildTurnPad() {
  const container = document.getElementById('turnButtons');
  for (const face of FACE_ORDER) {
    for (const quarters of [1, -1]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'move';
      button.textContent = formatMove(face, quarters);
      button.addEventListener('click', () => manualTurn(face, quarters));
      container.appendChild(button);
    }
  }
}

// The first stage is built on the bottom face, which the default angle hides.
function setViewFromBelow(below) {
  view.x = below ? 32 : -26;
  document.getElementById('flipView').textContent = below ? 'Flip to top' : 'Flip to bottom';
  cubeEl.classList.add('flipping');
  updateView();
  setTimeout(() => cubeEl.classList.remove('flipping'), 500);
}

document.getElementById('flipView').addEventListener('click', () => {
  setViewFromBelow(view.x < 0);
});

document.getElementById('undoTurn').addEventListener('click', async () => {
  if (busy || !turnHistory.length) return;
  const last = turnHistory.pop();
  busy = true;
  await animateTurn(last.face, last.quarters === 2 ? 2 : -last.quarters);
  colours = paintedFacelets();
  renderNet();
  busy = false;
  updatePractice('Undone.');
});

document.addEventListener('keydown', (event) => {
  if (mode !== 'learn' || busy) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.tagName === 'INPUT') return;
  const face = event.key.toUpperCase();
  if (!FACES[face]) return;
  event.preventDefault();
  manualTurn(face, event.shiftKey ? -1 : 1);
});

/* ---------- boot ---------- */

buildScheme();
buildPalette();
buildNet();
buildNotation();
buildTurnPad();
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
  renderCourse();
})();
