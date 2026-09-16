/**
 * img2three.js — turn a source image into an animated Three.js point cloud.
 *
 *   sample an image on a grid -> keep the ink -> one GPU particle per sample
 *   -> assemble from a scattered shell -> drift, react to the pointer,
 *      dissolve on scroll.
 *
 * Public API:
 *   const cloud = await createImageCloud({ canvas, src, ... });
 *   cloud.dispose();
 *
 * Every failure path (no WebGL, image decode error, tainted canvas, reduced
 * motion) throws or degrades so the caller can fall back to static CSS art.
 * See design.md §7 for the reasoning.
 */

import * as THREE from "three";

/* ------------------------------------------------------------------ *
 * 1. Sampling: image -> attribute arrays
 * ------------------------------------------------------------------ */

/**
 * Draw `src` into an offscreen canvas and walk it on a grid, keeping pixels
 * that are opaque enough and dark enough to count as ink.
 *
 * @returns {{positions:Float32Array, depths:Float32Array, count:number, aspect:number}}
 */
async function sampleImage(src, {
  resolution = 460,   // px the source is rasterised at
  step = 3,           // grid stride in px — lower is denser and slower
  alphaMin = 0.35,    // ignore anti-aliased edges and transparent ground
  lumaMax = 0.85,     // ignore near-white pixels (negative space in the mark)
  jitter = 0.45,      // break up the grid so it doesn't read as a screen door
} = {}) {
  const img = await loadImage(src);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("img2three: 2d context unavailable");

  // contain-fit the source into the square
  const scale = Math.min(resolution / img.width, resolution / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (resolution - w) / 2, (resolution - h) / 2, w, h);

  let data;
  try {
    data = ctx.getImageData(0, 0, resolution, resolution).data;
  } catch {
    throw new Error("img2three: canvas is tainted — serve the source same-origin");
  }

  const pos = [];
  const depth = [];
  const half = resolution / 2;

  for (let y = 0; y < resolution; y += step) {
    for (let x = 0; x < resolution; x += step) {
      const i = (y * resolution + x) * 4;
      const a = data[i + 3] / 255;
      if (a < alphaMin) continue;

      const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      if (luma > lumaMax) continue; // white highlight = hole, not ink

      // grid -> centred world units, y flipped (canvas y grows downward)
      const jx = (Math.random() - 0.5) * step * jitter * 2;
      const jy = (Math.random() - 0.5) * step * jitter * 2;
      pos.push(x - half + jx, half - y + jy, 0);

      // darker ink sits further forward; gives the cloud a real z distribution
      depth.push(1 - luma * 0.9);
    }
  }

  const count = depth.length;
  if (!count) throw new Error("img2three: source produced no samples");

  // fold depth into z now that we know the range
  const positions = new Float32Array(pos);
  const depths = new Float32Array(depth);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 2] = (depths[i] - 0.5) * 46 + (Math.random() - 0.5) * 10;
  }

  return { positions, depths, count, aspect: resolution };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`img2three: could not load ${src}`));
    img.src = src;
  });
}

/* ------------------------------------------------------------------ *
 * 2. Shaders
 * ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;   // 0 scattered -> 1 assembled
  uniform float uDissolve;   // 0 intact    -> 1 blown apart
  uniform vec2  uPointer;    // world-space pointer, xy
  uniform float uPointerOn;  // 0..1 pointer presence
  uniform float uRadius;
  uniform float uForce;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec3  aScatter;
  attribute vec3  aSeed;
  attribute float aDepth;

  varying float vDepth;
  varying float vAlpha;

  // per-particle eased assembly with a seeded delay
  float easeOut(float t) { return 1.0 - pow(1.0 - t, 3.0); }

  void main() {
    float delay = aSeed.z * 0.45;
    float t = clamp((uProgress - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
    vec3 pos = mix(aScatter, position, easeOut(t));

    // idle drift — small on purpose: alive, not animated
    float ph = aSeed.x * 6.2831853;
    pos.z += sin(uTime * 0.6 + ph) * 6.0 * aDepth;
    pos.x += sin(uTime * 0.4 + ph * 1.7) * 1.4;
    pos.y += cos(uTime * 0.45 + ph * 1.3) * 1.4;

    // pointer repulsion, stronger on nearer particles
    vec2 d = pos.xy - uPointer;
    float dist = length(d);
    float fall = smoothstep(uRadius, 0.0, dist) * uPointerOn;
    pos.xy += normalize(d + 0.0001) * fall * uForce * (0.45 + aDepth);
    pos.z  += fall * uForce * 0.35;

    // scroll dissolve — push outward from the centre and fade
    pos += normalize(pos + vec3(0.001)) * uDissolve * 90.0;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    gl_PointSize = uSize * uPixelRatio * (0.55 + aDepth * 0.9) * (320.0 / -mv.z);
    gl_PointSize = min(gl_PointSize, 9.0 * uPixelRatio);

    vDepth = aDepth;
    vAlpha = t * (1.0 - uDissolve) * (0.55 + aDepth * 0.45);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform float uOpacity;

  varying float vDepth;
  varying float vAlpha;

  void main() {
    // soft round sprite, no texture fetch
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    float mask = smoothstep(0.25, 0.04, d);
    if (mask <= 0.001) discard;

    vec3 color = mix(uColorRim, uColorCore, smoothstep(0.25, 0.85, vDepth));
    gl_FragColor = vec4(color, mask * vAlpha * uOpacity);
  }
`;

/* ------------------------------------------------------------------ *
 * 3. The cloud
 * ------------------------------------------------------------------ */

export async function createImageCloud({
  canvas,
  src,
  colorCore = "#0e8074",
  colorRim = "#c98b5e",
  step = 3,
  pointSize = 2.6,
  assembleMs = 1800,
  reducedMotion = false,
} = {}) {
  if (!canvas) throw new Error("img2three: canvas is required");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);

  const { positions, depths, count, aspect } = await sampleImage(src, { step });

  // scattered start state: a spherical shell around the mark
  const scatter = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = aspect * (0.55 + Math.random() * 0.5);
    scatter[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    scatter[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    scatter[i * 3 + 2] = Math.cos(phi) * r * 0.5;
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute("aDepth", new THREE.BufferAttribute(depths, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), aspect * 1.2);

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: reducedMotion ? 1 : 0 },
    uDissolve: { value: 0 },
    uPointer: { value: new THREE.Vector2(9999, 9999) },
    uPointerOn: { value: 0 },
    uRadius: { value: aspect * 0.22 },
    uForce: { value: aspect * 0.12 },
    uSize: { value: pointSize },
    uPixelRatio: { value: 1 },
    uColorCore: { value: new THREE.Color(colorCore) },
    uColorRim: { value: new THREE.Color(colorRim) },
    uOpacity: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  const scene = new THREE.Scene();
  scene.add(points);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
  camera.position.z = aspect * 1.42;

  /* --- sizing --- */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    uniforms.uPixelRatio.value = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the mark the same apparent size regardless of viewport
    camera.position.z = (aspect * 1.42) / Math.min(1, camera.aspect);
    camera.updateProjectionMatrix();
    pxPerUnit = h / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z);
  }
  let pxPerUnit = 1;
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* --- pointer --- */
  const target = new THREE.Vector2(9999, 9999);
  let targetOn = 0;

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    target.set(
      (e.clientX - rect.left - rect.width / 2) / pxPerUnit,
      -(e.clientY - rect.top - rect.height / 2) / pxPerUnit,
    );
    targetOn = 1;
  }
  function onPointerLeave() { targetOn = 0; }

  if (!reducedMotion) {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("blur", onPointerLeave);
  }

  /* --- visibility: never burn frames off-screen --- */
  let visible = true;
  const io = new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { threshold: 0 },
  );
  io.observe(canvas);

  /* --- scroll dissolve --- */
  let dissolveTarget = 0;
  function onScroll() {
    const rect = canvas.getBoundingClientRect();
    const past = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
    dissolveTarget = past * 0.85;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- loop --- */
  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  let elapsed = 0;

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;

    elapsed += dt;
    uniforms.uTime.value = elapsed;
    if (!reducedMotion) {
      uniforms.uProgress.value = Math.min(1, uniforms.uProgress.value + dt * (1000 / assembleMs));
    }
    uniforms.uPointer.value.lerp(target, 0.12);
    uniforms.uPointerOn.value += (targetOn - uniforms.uPointerOn.value) * 0.09;
    uniforms.uDissolve.value += (dissolveTarget - uniforms.uDissolve.value) * 0.09;

    renderer.render(scene, camera);
  }

  if (reducedMotion) {
    // one static frame, no loop at all
    uniforms.uPointer.value.set(9999, 9999);
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    count,
    setColors(core, rim) {
      uniforms.uColorCore.value.set(core);
      uniforms.uColorRim.value.set(rim);
      if (reducedMotion) renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
