/* The course: what each phase is for, how to read the cube, and the
 * algorithms that do the work.
 *
 * Every algorithm here is one of the sequences the solver itself searches
 * with, referenced rather than retyped, so a lesson can never teach a move
 * the solver doesn't use. The counts quoted ("at most three") are measured
 * against the solver over thousands of random cubes.
 */

const NOTATION = [
  { move: 'U', text: 'Up face, clockwise' },
  { move: 'D', text: 'Down face, clockwise' },
  { move: 'L', text: 'Left face, clockwise' },
  { move: 'R', text: 'Right face, clockwise' },
  { move: 'F', text: 'Front face, clockwise' },
  { move: 'B', text: 'Back face, clockwise' },
  { move: "R'", text: 'Prime: the same face, counter-clockwise' },
  { move: 'R2', text: 'A half turn — direction doesn\'t matter' }
];

// "Clockwise" always means looking directly at that face from outside.
const CLOCKWISE_NOTE =
  'Clockwise always means as you look straight at that face from outside the ' +
  'cube — so L clockwise turns the far side of the left face towards you.';

const LESSONS = {
  cross: {
    goal: 'Four edges around the bottom centre, each also matching its side centre.',
    idea:
      'Nothing is solved yet, so this stage needs no algorithm at all — every ' +
      'piece has a clear path. Work it out by looking, not by memorising. ' +
      'Getting comfortable here is what makes the rest readable.',
    look: [
      'Find an edge carrying the bottom colour. Its other colour tells you which side it belongs to.',
      'If it is stuck in the bottom or middle layer, turn it up into the top layer first.',
      'Spin U until it hovers over its own side face.',
      'Bottom colour pointing up? Turn that side face twice and it drops straight in.',
      'Bottom colour pointing outwards? It needs flipping as it goes in, not a half turn.'
    ],
    algorithms: [],
    check: 'All four bottom edges home. The bottom face shows a cross, and each arm matches the centre beside it.',
    why:
      'Matching the side centre is the whole point. A cross that looks right ' +
      'from below but ignores the side colours will fight you for the rest of ' +
      'the solve, because centres never move — they are the fixed frame ' +
      'everything else is measured against.'
  },

  corners: {
    goal: 'Fill the four bottom corners. That completes the entire first layer.',
    idea:
      'One short sequence does all four corners. You never need a second ' +
      'algorithm here — only the patience to repeat the first.',
    look: [
      'Find a corner carrying the bottom colour and work out which slot it belongs in: its three colours name its three faces.',
      'Turn U until that corner sits in the top layer directly above its slot.',
      'Repeat the trigger until it drops in the right way up.',
      'Already in its slot but twisted or backwards? Run the trigger once to kick it out into the top layer, then start over.'
    ],
    algorithms: [
      {
        name: 'The trigger',
        moves: TRIGGER,
        note:
          'For the front-right slot. Going round the bottom it becomes B U B\' U\' ' +
          '(back-right), L U L\' U\' (back-left) and F U F\' U\' (front-left).'
      }
    ],
    check: 'The whole bottom layer is one colour, and the side faces each show a matching band of three.',
    why:
      'The trigger lifts the corner out of its slot, spins it in the top layer, ' +
      'and puts it back turned a step further. Repeating cycles the corner ' +
      'through every way it can sit, and the sequence returns to its starting ' +
      'point after six repeats, so it can never miss — at most six and the ' +
      'corner is in. Everything else in the bottom layer is untouched, which ' +
      'is why you can use it over and over.'
  },

  middle: {
    goal: 'The four edges between the side centres, finishing two full layers.',
    idea:
      'Two algorithms, mirror images of each other. The only decision is ' +
      'whether the edge goes in to the right or to the left.',
    look: [
      'Find a top-layer edge with no top colour on it — those are the middle-layer pieces.',
      'Turn U until its front colour matches the centre it is sitting above. It now points at the face it belongs to.',
      'Look at its top colour: that names the face it must travel to. To the right, use the right insert; to the left, use the left insert.',
      'No usable edge in the top layer? One is trapped in a middle slot: run either insert on that slot to pop it out, then place it properly.'
    ],
    algorithms: [
      { name: 'Right insert', moves: RIGHT_INSERT, note: 'Sends the edge from the front face into the front-right slot.' },
      { name: 'Left insert', moves: LEFT_INSERT, note: 'The mirror: front face into the front-left slot.' }
    ],
    check: 'Two complete layers. Only the top face is still scrambled.',
    why:
      'Each insert opens the target slot, parks the edge there, and rebuilds ' +
      'the slot behind it. Everything it disturbs on the way is put back, so ' +
      'the first layer survives untouched — that is why these are safe to use ' +
      'even after the bottom is finished.'
  },

  topCross: {
    goal: 'The four top edges showing the top colour. Positions do not matter yet.',
    idea:
      'One algorithm, applied up to three times. Each application moves you ' +
      'one step along the same chain of shapes.',
    look: [
      'Look only at the top edges, ignoring the corners entirely.',
      'A dot (no edges up), an L of two, a line of two, or the finished cross — those are the only four shapes.',
      'Line: turn it to run left to right before you start.',
      'L: turn it so the two solved edges point back and left.',
      'Dot: hold it any way you like.'
    ],
    algorithms: [
      { name: 'The edge flipper', moves: FLIP_EDGES, note: 'Flips the top edges it touches and leaves the two finished layers alone.' }
    ],
    check: 'A cross on the top face. Its arms almost certainly do not match the side centres yet — that is fine, it is the next-but-one stage.',
    why:
      'The shapes form a chain: dot, then L, then line, then cross. Each run ' +
      'of the algorithm advances you one link, which is why three is always ' +
      'enough from the worst case.'
  },

  topFace: {
    goal: 'Twist the top corners until the whole top face is a single colour.',
    idea:
      'One algorithm — Sune — and its mirror. You are only changing how the ' +
      'corners are twisted; where they sit gets fixed afterwards.',
    look: [
      'Count how many top corners already show the top colour: none, one, two, or all four.',
      'With one correct, hold the cube so it sits at the front-right, then run Sune.',
      'With none or two, run Sune anyway, look again, and run it again — the case improves each time.',
      'Between runs you may turn U freely; it does not undo anything.'
    ],
    algorithms: [
      { name: 'Sune', moves: SUNE, note: 'Twists three top corners one way.' },
      { name: 'Anti-Sune', moves: ANTI_SUNE, note: 'The mirror: twists them the other way.' }
    ],
    check: 'The top face is one solid colour. The sides are still a mess — expected.',
    why:
      'A cube can never have exactly one corner twisted on its own: the twists ' +
      'always balance out to a multiple of three. That is why these two ' +
      'algorithms between them reach every case, and why three applications ' +
      'is the worst you will meet.'
  },

  cornerPerm: {
    goal: 'Move the top corners into their correct places. They stay the right way up.',
    idea:
      'One algorithm that cycles three corners and leaves the fourth where it ' +
      'is. Find a corner already home, and let the algorithm rotate the rest ' +
      'around it.',
    look: [
      'A corner is in the right place when its three colours match the three faces it touches — in any order. It does not have to be the right way round.',
      'If exactly one corner is home, the other three need the cycle.',
      'If none is home, run the algorithm once: that always leaves at least one in place.',
      'Turn U between runs to bring the case into position.'
    ],
    algorithms: [
      { name: 'Corner cycle', moves: A_PERM, note: 'Rotates three top corners without twisting any of them.' }
    ],
    check: 'Every top corner is in its right place, and the top face is still one colour.',
    why:
      'The cycle moves three corners and touches nothing else, so the solved ' +
      'top face survives it. Two applications cover the worst case: one to ' +
      'place a first corner, one to bring the rest home.'
  },

  edgePerm: {
    goal: 'Slide the last edges into place. This finishes the cube.',
    idea: 'One last algorithm, cycling three edges while the corners stay put.',
    look: [
      'Find an edge that already matches its centre — the algorithm keeps it and cycles the other three.',
      'Hold that finished edge at the back before you start.',
      'If no edge matches, run it once and one will.',
      'A final U turn may be all that is left.'
    ],
    algorithms: [
      { name: 'Edge cycle', moves: U_PERM, note: 'Rotates three top edges and leaves the corners alone.' }
    ],
    check: 'Every face is a single colour — that is the whole cube, from your own hands.',
    why:
      'By now the corners are fixed in place, so the only freedom left is a ' +
      'three-edge cycle — which is exactly what this algorithm is. Two runs ' +
      'is the worst case, and often one is enough.'
  }
};

// The order to learn them in, which is also the order they are solved in.
const COURSE = PHASES.map((phase) => ({
  key: phase.key,
  name: phase.name,
  detail: phase.detail,
  ...LESSONS[phase.key]
}));
