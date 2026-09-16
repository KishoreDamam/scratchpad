# Kusum's Dental Care — Design System

**Version** 1.0 · **Medium** Static site (HTML / CSS / vanilla ES modules + Three.js)
**Direction** *Clinical calm, editorial warmth.*

---

## 1. The problem with most dental sites

Dental practice sites converge on the same failure mode: a stock photo of strangers
laughing, a saturated medical blue, six competing CTAs, and body copy written for the
practice rather than the patient. The result reads as a template, and a template reads
as interchangeable — which is exactly the wrong signal for a decision built on trust.

This redesign takes the opposite position on four axes:

| Axis | Convention | This design |
| --- | --- | --- |
| Colour | Saturated "medical" blue, high-contrast white | Warm porcelain ground, deep sea-slate ink, a single restrained clinical accent |
| Imagery | Stock smiles | An abstract, generative mark — no stock people anywhere |
| Type | One geometric sans, everything | Editorial serif display against a humanist sans, with real typographic hierarchy |
| Motion | Bounce-in-on-scroll everywhere | One deliberate hero moment; everything else is a 200ms opinion |

**Emotional target:** the feeling of a very good waiting room. Quiet, warm, unhurried,
visibly competent. Not a spa. Not a hospital.

---

## 2. Colour

The palette is built on a warm neutral ground rather than pure white. Pure `#fff` under
a clinical accent reads cold and institutional; a porcelain tint carries the same
cleanliness while feeling like a room rather than a screen.

```
--ink-900   #0F2A2E   Primary text, headlines           (deep sea-slate)
--ink-700   #234A4E   Secondary headings
--ink-500   #4A6B6E   Body text on porcelain
--ink-300   #8AA3A5   Captions, meta, disabled

--shell-000 #FFFDFA   Card / raised surface             (porcelain)
--shell-100 #F7F2EC   Page ground                       (warm bone)
--shell-200 #EFE7DE   Sunken sections, inset fields
--shell-300 #E2D6C9   Hairlines, dividers

--accent-600 #0E8074  Primary action, links             (clinical teal)
--accent-500 #16A090  Hover / active
--accent-100 #DDF0EC  Accent wash, badge ground

--warm-500  #C98B5E   Secondary accent, rules, numerals  (terracotta)
--warm-100  #F6E8DB   Warm wash
```

**Rules**

1. Teal is reserved for *action and affirmation*. If it isn't clickable or confirming
   something, it isn't teal.
2. Terracotta is for *editorial punctuation only* — section numerals, rules, the
   underline on a display word. Never on a button. Two accents that both compete for
   "press me" is one accent too many.
3. Every text/ground pair ships at **≥ 4.5:1**. `--ink-500` on `--shell-100` measures
   5.1:1; `--ink-300` is capped at 16px+ non-essential meta only.
4. Dark mode inverts the *temperature relationship*, not the hex values: ground goes to
   a warm charcoal `#141A1A`, porcelain surfaces to `#1D2525`, and the accent lifts to
   `--accent-500` so it survives on a dark ground.

---

## 3. Type

```
Display  Fraunces  — variable serif, opsz 72, wght 400/600, SOFT 40
Text     Inter     — wght 400/500/600
```

Fraunces earns its place: at display sizes its optical-size axis gives a high-contrast,
almost bookish serif that reads *considered*, and its softness axis keeps it from
turning severe. Inter carries every functional job because it never editorialises.

**Scale** (major third, 1.250, fluid via `clamp()`):

```
display-1   clamp(2.75rem, 1.6rem + 5.2vw, 5.25rem)   Fraunces 400, lh 0.98, tracking -0.03em
display-2   clamp(2rem, 1.4rem + 2.6vw, 3.25rem)      Fraunces 400, lh 1.06, tracking -0.02em
h3          1.375rem                                   Inter 600, lh 1.3
lead        clamp(1.0625rem, 1rem + 0.4vw, 1.25rem)   Inter 400, lh 1.65
body        1rem                                       Inter 400, lh 1.7
small       0.875rem                                   Inter 500, lh 1.5
eyebrow     0.75rem                                    Inter 600, tracking 0.14em, uppercase
```

**Rules**

- Measure is capped at **62ch** for body, **34ch** for display. Long lines are the single
  most common readability failure on practice sites.
- Display type sets tight (`lh 0.98`) and negative-tracked; body sets loose (`lh 1.7`).
  The contrast between those two rhythms *is* the editorial voice.
- Numerals: `font-variant-numeric: tabular-nums` on anything in a column (hours, prices).
- One italic per page, maximum. Here it is the word *care* in the hero.

---

## 4. Space & layout

An 8px base, but the section rhythm is driven by a fluid step so the page breathes on a
27" display without shredding on a phone.

```
--s-1 4px   --s-2 8px   --s-3 12px  --s-4 16px  --s-5 24px
--s-6 32px  --s-7 48px  --s-8 64px  --s-9 96px  --s-10 128px
--section  clamp(4.5rem, 3rem + 7vw, 9rem)   vertical section padding
--gutter   clamp(1.25rem, 0.5rem + 3vw, 3rem)
```

Grid: 12 columns, `max-width: 1200px`, gutter as above. Content sits in a 1120px
measure; full-bleed is reserved for the hero canvas and the section ground changes.

**Vertical rhythm rule:** the gap between a heading and its own paragraph is always
smaller than the gap to the next block, by at least a factor of 2. Proximity does the
grouping work so borders don't have to.

---

## 5. Surface & depth

No drop shadows in the Material sense. Depth comes from three moves, in order of
preference:

1. **Ground change** — `--shell-100` → `--shell-200` to sink a section.
2. **Hairline** — `1px solid --shell-300`. Cards are outlined, not shadowed.
3. **Shadow**, only for things that genuinely float (sticky nav on scroll, open FAQ):
   `0 1px 2px rgb(15 42 46 / .04), 0 12px 32px -12px rgb(15 42 46 / .10)` — low opacity,
   long blur, tinted with the ink colour rather than neutral black.

Radii: `--r-sm 8px` (inputs, badges), `--r-md 16px` (cards), `--r-lg 28px` (feature
panels), `--r-full` (pills). One step per element size class; mixing radii within a
component is the fastest way to look unfinished.

---

## 6. Motion

**Budget: one hero moment, and 200ms of opinion on everything else.**

```
--e-out    cubic-bezier(0.22, 1, 0.36, 1)    enter, expand
--e-inout  cubic-bezier(0.65, 0, 0.35, 1)    move, transform
--t-fast   140ms    hover, focus
--t-base   220ms    state change
--t-slow   480ms    reveal
```

- Scroll reveals are **opacity + 12px translate only**. No scale, no rotate, no stagger
  longer than 60ms per item.
- Hover on a card lifts the hairline colour and the arrow, not the whole card.
- `prefers-reduced-motion: reduce` kills the particle drift, the assembly animation, and
  every scroll reveal — content renders in its final state immediately. This is wired at
  the source (the reveal observer never arms, the Three.js loop renders one static
  frame), not merely a `transition: none` override.

---

## 7. The hero: img2threeJS

The hero replaces the stock-photo slot with a **generative point cloud sampled from a
source image** — the practice mark rendered as ~9,000 GPU particles.

### Pipeline

```
source mark (SVG / PNG)
  → offscreen <canvas>, drawn at 460×460
  → getImageData, sampled on a 3px grid
  → keep pixels where alpha > 0.35
  → per-particle attributes:
      aTarget   vec3   x,y from pixel position; z from luminance × depth range
      aScatter  vec3   random position on a sphere shell (the pre-assembly state)
      aSeed     vec3   phase offsets so no two particles drift in sync
      aDepth    float  0..1, drives size, colour mix, and parallax strength
  → BufferGeometry + ShaderMaterial (gl.POINTS)
```

### What the shader does

- **Assembly** — `uProgress` eases 0→1 over 1.8s, mixing `aScatter` into `aTarget` with a
  per-particle delay derived from `aSeed`, so the mark coalesces rather than snapping.
- **Drift** — a low-frequency sine on z and a smaller one on xy, scaled by `aDepth`, so
  the cloud is never quite still. Amplitude is deliberately small (≈6 world units); the
  goal is *alive*, not *animated*.
- **Pointer** — particles inside a falloff radius are pushed along the normal away from
  the cursor and drift back on release. Force scales with `aDepth`, which reads as real
  parallax.
- **Scroll** — `uDissolve` pushes particles apart and fades alpha as the hero leaves the
  viewport, so the mark dissolves rather than scrolling away as a block.
- **Colour** — particles mix `--accent-600` → `--warm-500` across `aDepth`, giving the
  cloud a teal core and warm rim without a texture lookup.

### Constraints

- Point size is DPR-aware and capped, so it doesn't bloom on a 3× display.
- `powerPreference: "low-power"`, DPR clamped at 2, and the render loop is paused via
  `IntersectionObserver` when the hero is off-screen.
- **Progressive enhancement is mandatory.** No WebGL, reduced motion, or a failed image
  decode all fall through to a CSS-only rendering of the same mark. The hero headline and
  CTA are plain DOM and never depend on the canvas.

The source image is swappable: point `data-src` at any high-contrast PNG or SVG and the
pipeline re-derives the cloud. Silhouettes work; photographs do not.

---

## 8. Components

**Button** — Primary: teal ground, porcelain text, `--r-full`, 14/28 padding, hairline
darkens on hover, `translateY(-1px)`. Secondary: transparent, 1px ink-300 border.
Focus is always `outline: 2px solid --accent-600; outline-offset: 3px` — never removed,
never replaced by a colour change alone.

**Service card** — Outlined, porcelain ground, terracotta numeral top-left, title,
2-line description, and an arrow that translates 4px on hover. The whole card is the
click target; the arrow is decoration with `aria-hidden`.

**FAQ** — Native `<details>/<summary>`, restyled. Free keyboard support, free
find-in-page. A JS accordion here would be strictly worse.

**Booking bar** — On mobile, a fixed bottom bar with Call / Book. Above 768px it retires
into the nav. Phone number is a real `tel:` link at every size.

---

## 9. Accessibility (non-negotiable)

- Landmarks: `header/nav/main/section[aria-labelledby]/footer`. One `h1`.
- All contrast ≥ 4.5:1 for text, ≥ 3:1 for UI borders and icons.
- The canvas is `aria-hidden` with `role="presentation"` — it carries no information that
  isn't also in the DOM.
- Skip link, visible focus ring everywhere, 44×44px minimum touch targets.
- Hours render as a real `<table>` with headers, not a div grid.
- Full `prefers-reduced-motion` and `prefers-contrast: more` support.

## 10. Performance

- No framework, no build step. One CSS file, two ES modules.
- Three.js loads as a **deferred, non-blocking module**; first paint never waits on it.
- Fonts: `display=swap`, preconnect, 2 families / 4 weights total.
- Zero raster images in the critical path — the mark is SVG, the textures are shader math.
- Target: LCP < 1.2s on 4G, CLS 0, total JS < 180KB gzipped (Three.js is ~150KB of it).

---

## 11. Content status

The live site could not be reached from the build environment (network egress to
`kusum-s-dental-care.vercel.app` is blocked), so **all copy in this build is written
placeholder** — plausible, on-voice, and structured correctly, but not the practice's
own. Every string that must be replaced is listed in `README.md` under *Content swap
checklist* and marked in the HTML with a `data-placeholder` attribute, so
`document.querySelectorAll('[data-placeholder]')` enumerates the full set.
