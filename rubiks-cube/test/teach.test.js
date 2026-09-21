const fs=require('fs'), vm=require('vm'), assert=require('assert');
const base=require('path').join(__dirname,'..')+'/';
for (const f of ['cube.js','solver.js','facelets.js','lessons.js']) vm.runInThisContext(fs.readFileSync(base+f,'utf8'));

const scrambled = () => {
  const c=new Cube();
  for (const mv of randomScramble(25)){const{face,quarters}=parseMove(mv);c.turn(face,quarters);}
  return c;
};
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// 1. every phase has a lesson with real content
assert.strictEqual(COURSE.length, PHASES.length, 'a lesson per phase');
for (const lesson of COURSE) {
  assert(lesson.goal && lesson.goal.length>20, `${lesson.key}: goal`);
  assert(lesson.idea && lesson.idea.length>40, `${lesson.key}: idea`);
  assert(lesson.look.length>=3, `${lesson.key}: needs things to look for`);
  assert(lesson.why && lesson.why.length>80, `${lesson.key}: why it works`);
  assert(lesson.check && lesson.check.length>10, `${lesson.key}: completion check`);
  for (const alg of lesson.algorithms) {
    assert(alg.name && alg.note, `${lesson.key}: algorithm needs a name and a note`);
    assert(alg.moves.every(m=>/^[UDLRFB]('|2)?$/.test(m)), `${lesson.key}: bad notation in ${alg.name}`);
  }
}

// 2. no lesson may teach a move the solver does not itself search with
const taught = {
  corners: [TRIGGER],
  middle: [RIGHT_INSERT, LEFT_INSERT],
  topCross: [FLIP_EDGES],
  topFace: [SUNE, ANTI_SUNE],
  cornerPerm: [A_PERM],
  edgePerm: [U_PERM]
};
for (const [key, algs] of Object.entries(taught)) {
  const phase = PHASES.find(p=>p.key===key);
  for (const alg of algs) {
    assert(phase.generators.some(g=>same(g,alg)),
      `${key}: the taught algorithm ${alg.join(' ')} is not one of the phase's generators`);
  }
  // and the lesson must show exactly those
  const lesson = COURSE.find(l=>l.key===key);
  assert.strictEqual(lesson.algorithms.length, algs.length, `${key}: lesson shows a different number of algorithms`);
  for (const shown of lesson.algorithms) {
    assert(algs.some(a=>same(a,shown.moves)), `${key}: lesson shows an algorithm the phase never uses`);
  }
}
assert.strictEqual(COURSE.find(l=>l.key==='cross').algorithms.length, 0, 'the cross stage teaches no algorithm');
console.log('lessons match the solver');

// 3. phases complete in order through a real solve, and never un-complete
for (let i=0;i<60;i++){
  const cube=scrambled();
  let state=stateFromCube(cube);
  const {stages}=solveCube(cube);
  const doneSoFar=[];
  stages.forEach((stage,index)=>{
    const phase=PHASES[index];
    assert.strictEqual(stage.key, phase.key, 'stage order matches phase order');
    // A stage can arrive already finished — an earlier one occasionally
    // completes it in passing — and then it contributes no moves.
    const up = currentPhase(state);
    if (stage.moves.length) {
      assert.strictEqual(up && up.key, phase.key, `expected to be up to ${phase.key}`);
    } else {
      assert(phaseDone(state, phase), `${phase.key} contributed no moves but was not already done`);
    }
    state=applyMoves(state, stage.moves);
    assert(phaseDone(state, phase), `${phase.key} not finished by its own stage`);
    doneSoFar.push(phase);
    for (const earlier of doneSoFar) {
      assert(phaseDone(state, earlier), `${phase.key} undid ${earlier.key}`);
    }
  });
  assert.strictEqual(currentPhase(state), null, 'solved cube has no current phase');
}
console.log('phases complete in order and stay complete');

// 4. progress counters agree with the goals
for (let i=0;i<40;i++){
  const state=stateFromCube(scrambled());
  for (const phase of PHASES){
    const n=phase.progress(state), total=phaseTotal(phase);
    assert(n>=0 && n<=total, `${phase.key}: progress out of range`);
    assert.strictEqual(n===total, phaseDone(state,phase),
      `${phase.key}: progress says ${n}/${total} but phaseDone disagrees`);
  }
}
console.log('progress counters agree with the goals');

// 5. hints always advance, and repeated hints finish the stage
// (this is the practice loop: set the cube up at a stage, then follow hints)
for (const phase of PHASES){
  let practised=0;
  for (let attempt=0; attempt<25 && practised<8; attempt++){
    const cube=scrambled();
    const {stages}=solveCube(cube);
    const target=PHASES.indexOf(phase);
    for (let i=0;i<target;i++){
      for (const mv of stages[i].moves){const{face,quarters}=parseMove(mv);cube.turn(face,quarters);}
    }
    let state=stateFromCube(cube);
    for (const earlier of PHASES.slice(0,target)) {
      assert(phaseDone(state, earlier), `${phase.key}: setup left ${earlier.key} unfinished`);
    }
    if (phaseDone(state, phase)) continue;   // already done by luck; try another cube
    practised++;

    let guard=0;
    while (!phaseDone(state, phase)) {
      const moves=phaseHint(state, phase);
      assert(moves.length, `${phase.key}: hint was empty with work left`);
      assert(moves.every(m=>/^[UDLRFB]('|2)?$/.test(m)), `${phase.key}: hint has bad notation`);
      const before=phase.progress(state);
      state=applyMoves(state, moves);
      const after=phase.progress(state);
      assert(after>before, `${phase.key}: a hint moved the count ${before} -> ${after}`);
      for (const earlier of PHASES.slice(0,target)) {
        assert(phaseDone(state, earlier), `${phase.key}: a hint broke ${earlier.key}`);
      }
      assert(++guard<12, `${phase.key}: hints did not finish the stage`);
    }
  }
  assert(practised>0, `${phase.key}: could not build a practice cube`);
}
console.log('hints advance every stage without breaking earlier ones');
