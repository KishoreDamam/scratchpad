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

// The default colours must describe a cube that can actually be built, and so
// must anything a viewer sets in the scheme panel. A mirror-image scheme
// (swapping one pair of opposite faces) looks plausible and is impossible.
{
  assert.strictEqual(ROTATIONS.length, 24, 'the rotation group has 24 elements');
  assert(isRealScheme(DEFAULT_SCHEME), 'the default scheme is not a real cube');
  assert.strictEqual(schemeProblem(DEFAULT_SCHEME), null, 'the default scheme is flagged');
  assert.strictEqual(DEFAULT_SCHEME.D, 'white', 'the course builds the white cross');

  // all six colours, each used once, each with a real hex value
  assert.strictEqual(new Set(FACE_ORDER.map(f=>DEFAULT_SCHEME[f])).size, 6, 'six distinct colours');
  for (const key of COLOUR_KEYS) assert(/^#[0-9a-f]{6}$/.test(COLOURS[key]), `${key} has no colour`);

  // every orientation of the default cube must also read as real
  for (const m of ROTATIONS) {
    const turned = Object.fromEntries(FACE_ORDER.map((face) => {
      const moved = FACE_ORDER.find(f => FACES[f].axis.every((v,i) => v === apply(m, FACES[face].axis)[i]));
      return [face, DEFAULT_SCHEME[moved]];
    }));
    assert(isRealScheme(turned), 'a turned cube was rejected: ' + JSON.stringify(turned));
  }

  // a mirror image: swap one pair of opposite faces and nothing else
  const mirrored = { ...DEFAULT_SCHEME, L: DEFAULT_SCHEME.R, R: DEFAULT_SCHEME.L };
  assert(!isRealScheme(mirrored), 'a mirrored scheme was accepted');
  assert(/mirror image/.test(schemeProblem(mirrored)), 'mirrored scheme not explained: ' + schemeProblem(mirrored));

  // non-standard opposites, e.g. reading stickers off a scrambled cube
  const misread = { U:'white', D:'green', F:'red', B:'blue', L:'orange', R:'yellow' };
  const problem = schemeProblem(misread);
  assert(problem && /opposite/.test(problem), 'a non-standard pairing was not explained');
  assert(/centre/.test(problem), 'the explanation should point at the centres');

  // a colour used twice
  assert(/exactly one face/.test(schemeProblem({ ...DEFAULT_SCHEME, F: DEFAULT_SCHEME.U })));
}
console.log('colour schemes: default is real, mirrors and misreads are caught');

// Naming the top and front colours must fix a cube exactly: every adjacent
// pair gives one real orientation, and no same-or-opposite pair gives any.
{
  const opposite = {};
  for (const [a, b] of STANDARD_OPPOSITES) { opposite[a] = b; opposite[b] = a; }

  let real = 0;
  for (const top of COLOUR_KEYS) {
    for (const front of COLOUR_KEYS) {
      const scheme = schemeFromTopAndFront(top, front);
      const possible = top !== front && opposite[top] !== front;
      if (!possible) {
        assert.strictEqual(scheme, null, `${top}/${front} should be impossible`);
        continue;
      }
      assert(scheme, `${top} on top with ${front} in front should be a real cube`);
      assert.strictEqual(scheme.U, top);
      assert.strictEqual(scheme.F, front);
      assert.strictEqual(schemeProblem(scheme), null, `${top}/${front} was flagged: ${schemeProblem(scheme)}`);
      real++;
    }
  }
  assert.strictEqual(real, 24, `expected 24 orientations, got ${real}`);

  // the arrangement most tutorials describe
  const classic = schemeFromTopAndFront('white', 'green');
  assert.strictEqual(classic.R, 'red', 'white up, green front should put red on the right');
  assert.strictEqual(classic.D, 'yellow');
  assert.strictEqual(classic.L, 'orange');
  assert.strictEqual(classic.B, 'blue');
}
console.log('top + front fixes exactly the 24 real orientations');
