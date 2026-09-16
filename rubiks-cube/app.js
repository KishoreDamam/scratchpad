/* Rendering, animation and UI wiring for the cube defined in cube.js. */

const CUBIE = 62;   // px, matches --cubie in styles.css
const GAP = 4;
const STEP = CUBIE + GAP;

const cube = new Cube();
const cubeEl = document.getElementById('cube');
const stageEl = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const speedEl = document.getElementById('speed');

const elements = new Map(); // cubie -> DOM node
let history = [];
let moveCount = 0;
let busy = false;
let startedAt = null;
let timerHandle = null;
let view = { x: -28, y: -34 };
const VIEW_SCALE = 1.35;

/* ---------- rendering ---------- */

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

const STICKER_TRANSFORM = {
  U: 'rotateX(90deg)',
  D: 'rotateX(-90deg)',
  R: 'rotateY(90deg)',
  L: 'rotateY(-90deg)',
  F: '',
  B: 'rotateY(180deg)'
};

function build() {
  cubeEl.textContent = '';
  elements.clear();
  for (const cubie of cube.cubies) {
    const el = document.createElement('div');
    el.className = 'cubie';
    for (const face of FACE_ORDER) {
      const sticker = document.createElement('div');
      const shown = cubie.stickers.includes(face);
      sticker.className = 'sticker' + (shown ? '' : ' inner');
      sticker.style.background = shown ? FACES[face].color : '#131316';
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

function render() {
  for (const [cubie, el] of elements) {
    el.style.transform = transformFor(cubie);
  }
}

/* ---------- animated moves ---------- */

function animateTurn(face, quarters, duration) {
  return new Promise((resolve) => {
    const axis = FACES[face].axis;
    const layer = cube.layer(face);
    const angle = 90 * quarters;

    if (duration <= 0) {
      cube.turn(face, quarters);
      render();
      resolve();
      return;
    }

    for (const cubie of layer) {
      const el = elements.get(cubie);
      el.style.transition = `transform ${duration}ms cubic-bezier(.4,.1,.25,1)`;
      // Force a reflow so the transition starts from the current transform.
      void el.offsetWidth;
      const prefix = `rotate3d(${axis[0]},${axis[1]},${axis[2]},${angle}deg) `;
      el.style.transform = transformFor(cubie, prefix);
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
    }, duration);
  });
}

async function doMove(face, quarters, { record = true, duration = null } = {}) {
  if (busy) return;
  busy = true;
  await animateTurn(face, quarters, duration === null ? Number(speedEl.value) : duration);
  if (record) {
    history.push({ face, quarters });
    moveCount += 1;
    startTimer();
  }
  busy = false;
  refreshUi();
}

async function playSequence(moves, duration) {
  if (busy) return;
  busy = true;
  for (const move of moves) {
    const { face, quarters } = parseMove(move);
    await animateTurn(face, quarters, duration);
    history.push({ face, quarters });
    moveCount += 1;
  }
  busy = false;
  refreshUi();
}

/* ---------- timer + status ---------- */

function startTimer() {
  if (startedAt !== null || cube.isSolved()) return;
  startedAt = performance.now();
  timerHandle = setInterval(() => {
    timerEl.textContent = elapsed().toFixed(1) + 's';
  }, 100);
}

function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

function resetTimer() {
  stopTimer();
  startedAt = null;
  timerEl.textContent = '0.0s';
}

function elapsed() {
  return startedAt === null ? 0 : (performance.now() - startedAt) / 1000;
}

function refreshUi() {
  movesEl.textContent = String(moveCount);
  const solved = cube.isSolved();
  statusEl.textContent = solved ? 'Solved' : 'Scrambled';
  statusEl.classList.toggle('good', solved);
  if (solved && startedAt !== null) {
    stopTimer();
    timerEl.textContent = elapsed().toFixed(1) + 's';
    startedAt = null;
    cubeEl.classList.add('celebrate');
    setTimeout(() => cubeEl.classList.remove('celebrate'), 900);
  }
  const recent = history.slice(-24).map((m) => formatMove(m.face, m.quarters));
  historyEl.textContent = recent.length ? recent.join(' ') : '—';
}

/* ---------- controls ---------- */

function buildFaceButtons() {
  const container = document.getElementById('faceButtons');
  for (const face of FACE_ORDER) {
    for (const quarters of [1, -1]) {
      const button = document.createElement('button');
      button.textContent = formatMove(face, quarters);
      button.className = 'face';
      button.addEventListener('click', () => doMove(face, quarters));
      container.appendChild(button);
    }
  }
}

document.getElementById('scramble').addEventListener('click', async () => {
  resetTimer();
  history = [];
  moveCount = 0;
  await playSequence(randomScramble(25), 90);
  resetTimer();
  moveCount = 0;
  history = [];
  refreshUi();
});

document.getElementById('reset').addEventListener('click', () => {
  if (busy) return;
  cube.reset();
  build();
  history = [];
  moveCount = 0;
  resetTimer();
  refreshUi();
});

document.getElementById('undo').addEventListener('click', async () => {
  if (busy || history.length === 0) return;
  const last = history.pop();
  const inverse = invertMove(last.face, last.quarters);
  await doMove(inverse.face, inverse.quarters, { record: false });
  moveCount = Math.max(0, moveCount - 1);
  refreshUi();
});

document.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const face = event.key.toUpperCase();
  if (!FACES[face]) return;
  event.preventDefault();
  doMove(face, event.shiftKey ? -1 : 1);
});

/* ---------- drag to orbit ---------- */

let dragging = null;

function pointer(event) {
  const touch = event.touches && event.touches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : { x: event.clientX, y: event.clientY };
}

function beginDrag(event) {
  dragging = { ...pointer(event), view: { ...view } };
  stageEl.classList.add('dragging');
}

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
  stageEl.classList.remove('dragging');
}

stageEl.addEventListener('mousedown', beginDrag);
window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);
stageEl.addEventListener('touchstart', beginDrag, { passive: true });
stageEl.addEventListener('touchmove', moveDrag, { passive: false });
stageEl.addEventListener('touchend', endDrag);

/* ---------- boot ---------- */

buildFaceButtons();
build();
refreshUi();
