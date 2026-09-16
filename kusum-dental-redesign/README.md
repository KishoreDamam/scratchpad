# Kusum's Dental Care — redesign

A ground-up redesign of the practice site as a dependency-free static build.
No framework, no bundler, no build step: open `index.html` on any static host.

```
kusum-dental-redesign/
├── index.html                 single page, semantic landmarks
├── design.md                  the design system + the reasoning behind it
└── assets/
    ├── css/styles.css         tokens, components, dark mode, reduced motion
    ├── js/img2three.js        image → Three.js point-cloud engine ("img2threeJS")
    ├── js/main.js             nav state, reveals, hours, form, hero bootstrap
    └── img/mark.svg           the practice mark; also the hero particle source
```

## Run it

```bash
python3 -m http.server 4173 --directory kusum-dental-redesign
# → http://localhost:4173
```

It must be served over HTTP, not opened as a `file://` URL: the hero reads pixels
back out of a canvas, and `file://` origins taint it. When that happens the hero
falls back to the static CSS mark rather than breaking.

## The hero (img2threeJS)

`assets/js/img2three.js` rasterises `assets/img/mark.svg`, walks it on a 3px grid,
keeps the pixels that are opaque and dark, and turns each one into a GPU particle.
The cloud assembles from a scattered spherical shell, drifts, parts around the
cursor, and dissolves as you scroll past. Full pipeline and constraints: `design.md` §7.

Swap the source by changing one attribute:

```html
<canvas id="hero-canvas" data-src="assets/img/your-logo.svg"></canvas>
```

High-contrast silhouettes (SVG or PNG with transparency) work. Photographs do not —
the sampler keys on ink coverage, not on tone.

Tuning knobs live in the `createImageCloud({...})` call in `main.js`: `step`
(density — lower is denser and heavier), `pointSize`, `assembleMs`, and the two
colours, which are pulled from the CSS custom properties so the cloud tracks the
theme.

**It degrades, always.** No WebGL, a failed decode, a tainted canvas, or
`prefers-reduced-motion` each fall through to a CSS-masked static mark. The
headline, CTAs and every word of content are plain DOM and never wait on the canvas.

## Content swap checklist

The live site was unreachable from the build environment (network egress to
`kusum-s-dental-care.vercel.app` is blocked by the proxy), so **all copy here is
written placeholder** — structurally correct and on-voice, but not the practice's
own words. Every string that needs replacing carries a `data-placeholder`
attribute; enumerate them in the browser console with:

```js
[...document.querySelectorAll('[data-placeholder]')]
  .map(el => [el.dataset.placeholder, el.textContent.trim()])
```

Must be replaced before this goes anywhere near a patient:

- [ ] `practice-name`, `practice-tagline`, `registration`
- [ ] `phone` (4 occurrences incl. the `tel:` hrefs and the mobile Call button), `email`, `address`, `address-short`
- [ ] `hero-title`, `hero-lead`, `hero-eyebrow`, `hero-note`
- [ ] `stat-1..4` — replace or delete; **do not ship invented numbers**
- [ ] `service-1..6` titles and bodies — match the treatments actually offered
- [ ] `pillar-1..3`, `step-1..4`
- [ ] `dentist-name`, `dentist-credentials`, `dentist-bio-1/2`, plus a real portrait
      in place of the `.portrait` placeholder figure
- [ ] `quote-1..3` and their attributions — **real, consented patient reviews only**
- [ ] `faq-1..5` — fee answers in particular must match the real fee schedule
- [ ] `hours-mon..sun`
- [ ] `<title>` and `<meta name="description">`

Also outstanding before launch:

- [ ] Wire `#booking-form` to a real endpoint (it currently intercepts submit and
      tells the visitor to call). Add server-side validation and a privacy notice.
- [ ] Replace the `.portrait` placeholder with a photograph, and add `LocalBusiness`
      / `Dentist` JSON-LD with the real NAP details.
- [ ] Add a map embed, a privacy policy, and any regulator-required practice details.
- [ ] Self-host the two font families if you'd rather not depend on Google Fonts.

## Browser support

Modern evergreen browsers. Uses `color-mix()`, `clamp()`, container-free fluid type,
ES modules with an import map, `ResizeObserver` and `IntersectionObserver`. Three.js
is pinned to `0.160.0` from jsDelivr via the import map in `index.html`; vendor it
into `assets/js/` if you need to run without a CDN.
