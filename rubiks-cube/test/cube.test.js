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

// Every orientation, validation and lesson is derived from one declaration of
// this cube's colours, so that is what gets checked.
{
  assert.strictEqual(ROTATIONS.length, 24, 'the rotation group has 24 elements');
  assert.strictEqual(REAL_SCHEMES.length, 24, 'a cube can be held 24 ways');

  // the owner's cube: white up, red front, orange left, yellow right
  assert(isRealScheme(CUBE_SCHEME), 'the declared cube is not one of its own orientations');
  assert.strictEqual(schemeProblem(CUBE_SCHEME), null, 'the declared cube is flagged');

  // the app opens with the same cube rolled white-side-down, so the course's
  // first stage builds the white cross
  assert(isRealScheme(DEFAULT_SCHEME), 'the default scheme is not this cube');
  assert.strictEqual(schemeProblem(DEFAULT_SCHEME), null, 'the default scheme is flagged');
  assert.strictEqual(DEFAULT_SCHEME.D, 'white', 'the course builds the white cross');

  // opposite pairs hold in every orientation
  for (const scheme of REAL_SCHEMES) {
    for (const [a, b] of [['U','D'],['F','B'],['L','R']]) {
      const pair = [scheme[a], scheme[b]];
      assert(OPPOSITE_COLOURS.some(o => o.includes(pair[0]) && o.includes(pair[1])),
        `${pair.join('/')} are not an opposite pair on this cube`);
    }
    assert.strictEqual(new Set(FACE_ORDER.map(f=>scheme[f])).size, 6, 'six distinct colours');
  }
  for (const key of COLOUR_KEYS) assert(/^#[0-9a-f]{6}$/.test(COLOURS[key]), `${key} has no colour`);

  // a mirror image: swap one pair of opposite faces and nothing else
  const mirrored = { ...CUBE_SCHEME, L: CUBE_SCHEME.R, R: CUBE_SCHEME.L };
  assert(!isRealScheme(mirrored), 'a mirrored scheme was accepted');
  assert(/mirror image/.test(schemeProblem(mirrored)), 'mirrored scheme not explained');

  // pairings from a different cube, e.g. read off a scrambled one
  const foreign = { U:'white', D:'yellow', F:'green', B:'blue', L:'orange', R:'red' };
  const problem = schemeProblem(foreign);
  assert(problem && /opposite/.test(problem), 'a foreign pairing was not explained');
  assert(/centre/.test(problem), 'the explanation should point at the centres');

  // a colour used twice
  assert(/exactly one face/.test(schemeProblem({ ...CUBE_SCHEME, F: CUBE_SCHEME.U })));
}
console.log('colour schemes: this cube is real, mirrors and foreign pairings are caught');

// Naming the top and front colours must fix the cube exactly: every adjacent
// pair gives one orientation, and no same-or-opposite pair gives any.
{
  const opposite = {};
  for (const [a, b] of OPPOSITE_COLOURS) { opposite[a] = b; opposite[b] = a; }

  let real = 0;
  for (const top of COLOUR_KEYS) {
    for (const front of COLOUR_KEYS) {
      const scheme = schemeFromTopAndFront(top, front);
      if (top === front || opposite[top] === front) {
        assert.strictEqual(scheme, null, `${top}/${front} should be impossible`);
        continue;
      }
      assert(scheme, `${top} on top with ${front} in front should be a real cube`);
      assert.strictEqual(scheme.U, top);
      assert.strictEqual(scheme.F, front);
      assert.strictEqual(schemeProblem(scheme), null, `${top}/${front} was flagged`);
      real++;
    }
  }
  assert.strictEqual(real, 24, `expected 24 orientations, got ${real}`);

  // the arrangement its owner described, exactly
  const held = schemeFromTopAndFront('white', 'red');
  assert.deepStrictEqual(held,
    { U:'white', D:'green', F:'red', B:'blue', L:'orange', R:'yellow' },
    'white on top with red in front should be orange left, yellow right, green under, blue behind');
}
console.log('top + front fixes exactly the 24 real orientations');
