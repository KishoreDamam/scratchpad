/**
 * main.js — site behaviour. Everything here is progressive enhancement:
 * the page is fully usable with this file blocked.
 */

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- sticky nav state ---------- */
const nav = document.querySelector(".nav");
if (nav) {
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  nav.parentNode.insertBefore(sentinel, nav);
  new IntersectionObserver(
    ([e]) => nav.setAttribute("data-stuck", String(!e.isIntersecting)),
    { threshold: 1 },
  ).observe(sentinel);
}

/* ---------- scroll reveal ---------- */
const revealables = document.querySelectorAll("[data-reveal]");
if (reduced) {
  revealables.forEach((el) => el.classList.add("is-in"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const delay = Math.min(i, 4) * 60;
        setTimeout(() => entry.target.classList.add("is-in"), delay);
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  revealables.forEach((el) => io.observe(el));
}

/* ---------- highlight today's opening hours ---------- */
const hoursRows = document.querySelectorAll(".hours tbody tr[data-day]");
if (hoursRows.length) {
  const today = new Date().getDay(); // 0 = Sunday
  hoursRows.forEach((row) => {
    if (Number(row.dataset.day) === today) row.setAttribute("data-today", "true");
  });
}

/* ---------- booking form (no backend in this build) ---------- */
const form = document.querySelector("#booking-form");
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const status = form.querySelector(".booking__foot");
    if (status) {
      status.textContent =
        "This demo build has no form backend yet — call the practice to confirm your slot.";
      status.style.color = "var(--accent-600)";
    }
  });
}

/* ---------- hero: img2threeJS ---------- */
const stage = document.querySelector(".hero__stage");
const canvas = document.querySelector("#hero-canvas");

function fallback() {
  stage?.setAttribute("data-mode", "fallback");
}

async function initHero() {
  if (!stage || !canvas) return;

  const { createImageCloud, webglAvailable } = await import("./img2three.js");
  if (!webglAvailable()) return fallback();

  const css = getComputedStyle(document.documentElement);
  const core = css.getPropertyValue("--accent-600").trim() || "#0e8074";
  const rim = css.getPropertyValue("--warm-500").trim() || "#c98b5e";

  // denser cloud on desktop, lighter on phones
  const step = window.innerWidth < 720 ? 4 : 3;

  const cloud = await createImageCloud({
    canvas,
    src: canvas.dataset.src,
    colorCore: core,
    colorRim: rim,
    step,
    pointSize: window.innerWidth < 720 ? 2.4 : 2.9,
    reducedMotion: reduced,
  });

  stage.setAttribute("data-mode", "webgl");

  // follow the colour scheme if the OS flips mid-session
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const c = getComputedStyle(document.documentElement);
    cloud.setColors(
      c.getPropertyValue("--accent-600").trim(),
      c.getPropertyValue("--warm-500").trim(),
    );
  });
}

initHero().catch((err) => {
  console.warn("[hero]", err);
  fallback();
});
