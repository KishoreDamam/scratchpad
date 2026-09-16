const fs=require('fs'), vm=require('vm'), assert=require('assert');
const base=require('path').join(__dirname,'..')+'/';
vm.runInThisContext(fs.readFileSync(base+'cube.js','utf8'));
vm.runInThisContext(fs.readFileSync(base+'solver.js','utf8'));

// 1. the compact model must agree with the geometric one
{
  const c=new Cube();
  assert.deepStrictEqual(Array.from(stateFromCube(c)), Array.from(solvedState()), 'solved state');
  for (const mv of randomScramble(60)) { const {face,quarters}=parseMove(mv); c.turn(face,quarters); }
  const viaGeometry = stateFromCube(c);
  const viaTables = applyMoves(solvedState(), []); // rebuilt below
  let s = solvedState();
  const c2 = new Cube(); const seqMoves = randomScramble(60);
  for (const mv of seqMoves) { const {face,quarters}=parseMove(mv); c2.turn(face,quarters); s = applyMove(s, mv); }
  assert.deepStrictEqual(Array.from(s), Array.from(stateFromCube(c2)), 'move tables match geometry');
  void viaGeometry; void viaTables;
}

// 2. every generator must leave earlier layers alone
const D_EDGES=[4,5,6,7], D_CORNERS=[4,5,6,7], E_EDGES=[8,9,10,11];
function check(name, gens, mustKeep) {
  for (const g of gens) {
    const s = applyMoves(solvedState(), g);
    for (const [label, ok] of mustKeep) assert(ok(s), `${name} [${g.join(' ')}] disturbs ${label}`);
  }
}
const firstLayer=[['bottom cross', s=>edgesHome(s,D_EDGES)], ['bottom corners', s=>cornersHome(s,D_CORNERS)]];
const f2l=firstLayer.concat([['middle layer', s=>edgesHome(s,E_EDGES)]]);
check('corner trigger', CORNER_TRIGGERS, [['bottom cross', s=>edgesHome(s,D_EDGES)]]);
check('edge insert', EDGE_INSERTS, firstLayer);
check('flip edges', [FLIP_EDGES], f2l);
check('sune', [SUNE, ANTI_SUNE], f2l);
check('A-perm', [A_PERM], f2l.concat([['last-layer orientation', s=>
  [0,1,2,3].every(i=>s[CO+i]===0) && [0,1,2,3].every(i=>s[EO+i]===0)]]));
check('U-perm', [U_PERM], f2l.concat([['last-layer corners', s=>cornersHome(s,[0,1,2,3])]]));

// A-perm must be a pure 3-cycle of corners; U-perm a pure 3-cycle of edges
{
  const a=applyMoves(solvedState(),A_PERM);
  const movedC=[0,1,2,3].filter(i=>a[CP+i]!==i), movedE=[0,1,2,3].filter(i=>a[EP+i]!==i);
  assert.strictEqual(movedC.length,3,'A-perm cycles 3 corners'); assert.strictEqual(movedE.length,0,'A-perm keeps edges');
  const u=applyMoves(solvedState(),U_PERM);
  assert.strictEqual([0,1,2,3].filter(i=>u[EP+i]!==i).length,3,'U-perm cycles 3 edges');
  assert.strictEqual([0,1,2,3].filter(i=>u[CP+i]!==i).length,0,'U-perm keeps corners');
}
console.log('invariants ok');

// 3. solve many random scrambles and verify on the geometric cube
const N = Number(process.argv[2] || 300);
let total=0, max=0, worstScramble=null, maxNodesTime=0;
const t0=Date.now();
for (let i=0;i<N;i++){
  const scramble=randomScramble(25);
  const cube=new Cube();
  for (const mv of scramble){const{face,quarters}=parseMove(mv);cube.turn(face,quarters);}
  const t1=Date.now();
  const {stages,moves}=solveCube(cube);
  maxNodesTime=Math.max(maxNodesTime,Date.now()-t1);
  for (const mv of moves){const{face,quarters}=parseMove(mv);cube.turn(face,quarters);}
  assert(cube.isSolved(), 'scramble not solved: '+scramble.join(' ')+'\nsolution: '+moves.join(' '));
  assert(stages.every(s=>s.moves.every(m=>/^[UDLRFB]('|2)?$/.test(m))), 'bad notation');
  total+=moves.length;
  if (moves.length>max){max=moves.length;worstScramble=scramble.join(' ');}
}
console.log(`solved ${N}/${N} scrambles in ${Date.now()-t0}ms`);
console.log(`moves: avg ${(total/N).toFixed(1)}, max ${max}`);
console.log(`slowest single solve: ${maxNodesTime}ms`);

// 4. already-solved cube yields an empty solution
{
  const c=new Cube();
  const {moves}=solveCube(c);
  assert.strictEqual(moves.length,0,'solved cube needs no moves');
}
// 5. a one-move scramble is solved in one move
{
  const c=new Cube(); c.turn('R',1);
  const {moves}=solveCube(c);
  assert.deepStrictEqual(moves,["R'"],'single turn -> single move, got '+moves.join(' '));
}
console.log('edge cases ok');
