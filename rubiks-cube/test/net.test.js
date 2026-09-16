const fs=require('fs'), vm=require('vm'), assert=require('assert');
const base=require('path').join(__dirname,'..')+'/';
for (const f of ['cube.js','solver.js','facelets.js']) vm.runInThisContext(fs.readFileSync(base+f,'utf8'));
const eq=(a,b)=>Array.from(a).every((v,i)=>v===b[i]);

// 54 stickers, 9 per face, centres in the right place
assert.strictEqual(FACELETS.length,54);
for (const f of FACE_ORDER) assert.strictEqual(FACELETS.filter(x=>x.face===f).length,9,'9 per face '+f);
{
  const solved=faceletsFromCube(new Cube());
  for (const f of FACE_ORDER) {
    const own=FACELETS.map((x,i)=>[x,i]).filter(([x])=>x.face===f).map(([,i])=>solved[i]);
    assert(own.every(c=>c===f), `solved cube: face ${f} is not all ${f}`);
  }
}

// round trip: cube -> net -> state -> cube -> net, over many random cubes
for (let i=0;i<400;i++){
  const cube=new Cube();
  for (const mv of randomScramble(25)){const{face,quarters}=parseMove(mv);cube.turn(face,quarters);}
  const net=faceletsFromCube(cube);
  const state=stateFromFacelets(net);
  assert(eq(state, stateFromCube(cube)), 'net -> state mismatch');
  const rebuilt=cubeFromState(state);
  assert.deepStrictEqual(faceletsFromCube(rebuilt), net, 'state -> cube -> net mismatch');
  assert(eq(stateFromCube(rebuilt), state), 'rebuilt cube state mismatch');
  // and the rebuilt cube must still turn like a cube
  const mv='R'; rebuilt.turn('R',1); cube.turn('R',1);
  assert.deepStrictEqual(faceletsFromCube(rebuilt), faceletsFromCube(cube), 'rebuilt cube turns wrong'); void mv;
}
// a rebuilt scrambled cube can be solved end to end
for (let i=0;i<50;i++){
  const c=new Cube();
  for (const mv of randomScramble(25)){const{face,quarters}=parseMove(mv);c.turn(face,quarters);}
  const rebuilt=cubeFromState(stateFromFacelets(faceletsFromCube(c)));
  const {moves}=solveCube(rebuilt);
  for (const mv of moves){const{face,quarters}=parseMove(mv);rebuilt.turn(face,quarters);}
  assert(rebuilt.isSolved(),'rebuilt cube not solved');
}
console.log('net round trip ok');

// rejections
const solvedNet=()=>faceletsFromCube(new Cube());
function expectError(mutate, fragment){
  const net=solvedNet(); mutate(net);
  try { stateFromFacelets(net); assert.fail('expected rejection: '+fragment); }
  catch(e){
    assert(e instanceof CubeStateError, 'wrong error type: '+e.message);
    assert(e.message.toLowerCase().includes(fragment), `got "${e.message}", wanted "${fragment}"`);
  }
}
expectError(n=>{n[0]=null;}, 'colour');
expectError(n=>{n[0]='D';}, 'nine times');
// impossible piece: a corner carrying two opposite colours
expectError(n=>{
  const a=CORNER_SLOTS[0]; // URF, take its U sticker
  const b=CORNER_SLOTS[3]; // UBR, take its B sticker
  const i=faceletAt('U',a.pos), j=faceletAt('B',b.pos);
  [n[i],n[j]]=[n[j],n[i]];
}, 'real piece');
// two slots holding each other's edge is a swap, and reads as one
expectError(n=>{
  const i=faceletAt('U',EDGE_SLOTS[1].pos), j=faceletAt('D',EDGE_SLOTS[5].pos);
  [n[i],n[j]]=[n[j],n[i]];
}, 'swapped');
// the duplicate-piece guard, exercised directly: no count-valid net can reach it
{
  const dup=solvedState(); dup[EP+1]=dup[EP+0];
  assert.throws(()=>assertSolvable(dup), e=>e instanceof CubeStateError && /twice/.test(e.message));
}
// twisted corner: rotate the three stickers of one corner
expectError(n=>{
  const slot=CORNER_SLOTS[0];
  const idx=slot.faces.map(f=>faceletAt(f,slot.pos));
  const vals=idx.map(i=>n[i]);
  idx.forEach((i,k)=>{n[i]=vals[(k+1)%3];});
}, 'twisted');
// flipped edge
expectError(n=>{
  const slot=EDGE_SLOTS[0];
  const idx=slot.faces.map(f=>faceletAt(f,slot.pos));
  const vals=idx.map(i=>n[i]);
  n[idx[0]]=vals[1]; n[idx[1]]=vals[0];
}, 'flipped');
// swapped pair of edges
expectError(n=>{
  const a=EDGE_SLOTS[0], b=EDGE_SLOTS[1];
  const ai=a.faces.map(f=>faceletAt(f,a.pos)), bi=b.faces.map(f=>faceletAt(f,b.pos));
  const av=ai.map(i=>n[i]), bv=bi.map(i=>n[i]);
  ai.forEach((i,k)=>{n[i]=bv[k];}); bi.forEach((i,k)=>{n[i]=av[k];});
}, 'swapped');
console.log('invalid cubes rejected ok');
