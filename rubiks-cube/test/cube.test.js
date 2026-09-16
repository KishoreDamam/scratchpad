const fs=require('fs');
const base=require('path').join(__dirname,'..')+'/';
require('vm').runInThisContext(fs.readFileSync(base+'cube.js','utf8'));
const c=new Cube();
const assert=require('assert');
assert(c.isSolved(),'fresh cube solved');

// sexy move has order 6
for(let i=0;i<6;i++){c.turn('R',1);c.turn('U',1);c.turn('R',-1);c.turn('U',-1);}
assert(c.isSolved(),'(R U R\' U\')^6 == identity');

// single turn is not solved; 4 turns returns
c.turn('F',1); assert(!c.isSolved());
c.turn('F',1);c.turn('F',1);c.turn('F',1); assert(c.isSolved(),'F^4');

// half turn == two quarters
const a=new Cube(), b=new Cube();
a.turn('L',2); b.turn('L',1); b.turn('L',1);
assert.deepStrictEqual(a.cubies.map(x=>[x.position,x.orientation]), b.cubies.map(x=>[x.position,x.orientation]),'L2');

// scramble then invert solves
const s=randomScramble(40);
for(const m of s){const {face,quarters}=parseMove(m);c.turn(face,quarters);}
assert(!c.isSolved(),'scrambled');
for(const m of [...s].reverse()){const {face,quarters}=parseMove(m);const i=invertMove(face,quarters);c.turn(i.face,i.quarters);}
assert(c.isSolved(),'inverse scramble solves');

// every layer always has exactly 9 cubies, and centers stay put
for(const f of FACE_ORDER) assert.strictEqual(c.layer(f).length,9,'layer '+f);
for(const m of randomScramble(30)){const {face,quarters}=parseMove(m);c.turn(face,quarters);}
for(const f of FACE_ORDER){
  assert.strictEqual(c.layer(f).length,9,'layer size after scramble');
  const center=c.cubies.find(x=>x.position.filter(v=>v!==0).length===1 && x.position.every((v,i)=>v===FACES[f].axis[i]));
  assert(center.home.every((v,i)=>v===center.position[i]),'center '+f+' fixed');
}
// sticker counts: 9 of each colour visible on the cube
const counts={};
for(const cu of c.cubies) for(const f of cu.stickers) counts[f]=(counts[f]||0)+1;
assert(FACE_ORDER.every(f=>counts[f]===9), 'nine stickers per colour');
console.log('all cube model checks passed');
