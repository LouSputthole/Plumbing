// Legacy Plumbing Group v3: the rough-in that builds itself.
// A procedural copper pipe network in a dark void. Scrolling builds it and flies the camera between
// section vantages; service tiles light up their part; "Flush the lines" sends a surge through it.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const { clamp, lerp } = THREE.MathUtils;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const WATER = 0x5fd3ff;
const ADD = THREE.AdditiveBlending;

// Orthogonal pipe runs (x, y, z). w = window on the 0-1 build timeline. dark = ABS drain/flue, no water.
const RUNS = [
  { g: "supply", w: [0, 0.22], r: 0.13, pts: [[-17, 2.5, -1.6], [-5, 2.5, -1.6], [-5, 1.5, -1.6], [-2.85, 1.5, -1.6], [-2.85, 1.5, -2.7], [-2.85, 2.4, -2.7]] },
  { g: "rough", w: [0.03, 0.45], r: 0.26, dark: 1, pts: [[-5.9, 9.5, -3.4], [-5.9, 0.3, -3.4], [10.5, 0.3, -3.4], [10.5, 9.5, -3.4]] },
  { g: "hot", w: [0.22, 0.36], r: 0.13, pts: [[-1.95, 2.4, -2.7], [-1.95, 1, -2.7], [-1.95, 1, 0.6], [2.6, 1, 0.6]] },
  { g: "tankless", w: [0.28, 0.36], r: 0.15, dark: 1, pts: [[-2.4, 4.8, -2.7], [-2.4, 9.5, -2.7]] },
  { g: "commercial", w: [0.34, 0.42], r: 0.2, pts: [[2.6, 1, 0.6], [9.4, 1, 0.6]] },
  ...[0, 1, 2, 3, 4].map((i) => {
    const x = 3.3 + i * 1.1;
    return { g: "commercial", w: [0.4 + i * 0.03, 0.52 + i * 0.03], r: 0.09, pts: [[x, 1, 0.6], [x, 3, 0.6], [x, 3, -2.2], [x, 9.5, -2.2]] };
  }),
  { g: "bath", w: [0.5, 0.62], r: 0.1, pts: [[8.8, 1, 0.6], [8.8, 5.2, 0.6], [8.8, 5.2, 1.5]] },
  { g: "supply", w: [0.45, 0.8], r: 0.11, pts: [[-6.2, 2.5, -1.6], [-6.2, 0.55, -1.6], [-6.2, 0.55, 2.2], [11.2, 0.55, 2.2], [11.2, 4.6, 2.2], [11.2, 4.6, -2]] },
  { g: "area", w: [0.86, 1], r: 0.16, pts: [[-5, 0.35, 6.2], [-1.6, 0.35, 6.2], [-1.6, 0.35, 7.4], [1.6, 0.35, 7.4], [1.6, 0.35, 6.2], [5, 0.35, 6.2]] },
];

// Where each service lives in the network (camera nudge + focus light).
const CENTERS = {
  rough: V(-1, 1, -3.4),
  treatment: V(-8.3, 1.2, -1.6),
  tankless: V(-2.4, 3.6, -2.7),
  bath: V(8.8, 4.2, 1.3),
  repairs: V(0.4, 1.8, 0.6),
  commercial: V(6, 2, 0),
};

// One camera vantage per page section (matched by data-cam). p = position, t = look-at target,
// b = how much of the network is built, dim = canvas opacity, wall = how far the walls have closed.
const KF = {
  hero: { p: [-3, 6.6, 15.5], t: [0.8, 1.3, -0.6], b: 0.5, dim: 1 },
  services: { p: [15, 7, 17], t: [-4, -3, -1.5], b: 0.7, dim: 1 },
  projects: { p: [-2, 15.5, 24], t: [-1, 0.6, -0.5], b: 0.86, dim: 0.9 },
  about: { orbit: 1, a0: 0.2, R: 19, y: 6.4, t: [-1.5, 2.2, -0.6], b: 0.86, dim: 0.8 },
  reviews: { p: [-11, 6, 13], t: [0, 2, 0], b: 0.88, dim: 0.42 },
  area: { p: [0, 8.5, 22], t: [0, 0.35, 6.2], b: 1, dim: 1, hi: 1, scrim: 0.3 },
  request: { p: [0, 4.2, 16.5], t: [0, 3.6, 3.7], b: 1, dim: 0.85, wall: 1 },
};

const waterVS = /* glsl */ `
varying float vS; varying float vF; varying float vD;
void main() {
  vS = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vF = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const waterFS = /* glsl */ `
uniform float uT, uB, uLen, uHi, uSurge, uSX, uSpd;
uniform vec3 uC;
varying float vS; varying float vF; varying float vD;
void main() {
  if (vS > uB) discard;
  float d = vS * uLen;
  float f = fract((d - uT * uSpd) * 0.42);
  float dash = smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.18, 0.46, f));
  float tip = smoothstep(uB - 0.7 / uLen, uB, vS) * step(uB, 0.999);
  float surge = uSurge * exp(-pow(d - uSX, 2.0) * 0.06);
  float a = (0.04 + dash * (0.42 + uHi * 1.4) + tip * 1.6 + surge * 3.4) * (0.3 + vF * vF * 1.4);
  a *= exp(-pow(vD * 0.03, 2.0));
  gl_FragColor = vec4(uC * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const gridVS = /* glsl */ `
varying vec3 vW; varying float vD;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mv = viewMatrix * w;
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const gridFS = /* glsl */ `
uniform vec3 uFog;
varying vec3 vW; varying float vD;
float line(vec2 p) { vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y), 1.0); }
void main() {
  float a = line(vW.xz) * 0.035 + line(vW.xz / 4.0) * 0.09;
  a *= exp(-length(vW.xz - vec2(0.0, 1.0)) * 0.05);
  vec3 col = vec3(0.0016, 0.0026, 0.005) + vec3(0.37, 0.83, 1.0) * a;
  float fog = 1.0 - exp(-pow(vD * 0.032, 2.0));
  gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function start(canvas, hooks = {}) {
  const d = document;
  const mobile = matchMedia("(max-width: 760px)").matches;
  // Probe first so a missing WebGL2 falls back quietly instead of three.js logging an error.
  const context = canvas.getContext("webgl2", { alpha: false, antialias: !mobile, stencil: false, powerPreference: "high-performance" });
  if (!context) throw new Error("WebGL2 unavailable");
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !mobile });
  let dpr = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080f);
  scene.fog = new THREE.FogExp2(0x05080f, 0.03);
  scene.environmentIntensity = 0.62;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 140);

  /* ---------- shared bits ---------- */
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const copperMat = () => std({ color: 0xb87333, metalness: 1, roughness: 0.25, emissive: WATER, emissiveIntensity: 0, side: THREE.DoubleSide });
  const darkMat = () => std({ color: 0x1a222e, metalness: 0.35, roughness: 0.5, emissive: WATER, emissiveIntensity: 0, side: THREE.DoubleSide });
  const glow = (c, s) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(s) });
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const glowTex = (() => {
    const c = d.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const additive = (color, opacity = 1) =>
    new THREE.SpriteMaterial({ map: glowTex, color, opacity, transparent: true, depthWrite: false, blending: ADD });

  const groups = {};
  const G = (k) => (groups[k] ||= { mats: [], water: [], hi: 0 });
  const U = { uT: { value: 0 }, uSurge: { value: 0 }, uSX: { value: 0 }, uC: { value: new THREE.Color(WATER) } };
  const items = []; // equipment that pops in when the build reaches it
  const appear = (obj, at) => {
    obj.scale.setScalar(1e-4);
    items.push({ obj, at, t: 0 });
  };

  /* ---------- pipe runs ---------- */
  const DENS = mobile ? 4 : 7;
  const runs = [];
  const collarData = [];
  RUNS.forEach((R, idx) => {
    const P = R.pts.map((p) => V(...p));
    const rad = Math.max(0.3, R.r * 2.6);
    const cps = [P[0]];
    let total = 0;
    const segL = [];
    for (let k = 1; k < P.length; k++) {
      segL.push(P[k].distanceTo(P[k - 1]));
      total += segL[k - 1];
    }
    let acc = 0;
    for (let k = 1; k < P.length - 1; k++) {
      acc += segL[k - 1];
      const a = P[k].clone().sub(P[k - 1]).normalize();
      const b = P[k + 1].clone().sub(P[k]).normalize();
      const c = P[k];
      // Three control points per corner trace a quarter-circle elbow.
      cps.push(c.clone().addScaledVector(a, -rad), c.clone().addScaledVector(b.clone().sub(a), 0.2929 * rad), c.clone().addScaledVector(b, rad));
      if (!R.dark) {
        collarData.push([idx, c.clone().addScaledVector(a, -rad - 0.11), a, (acc - rad - 0.11) / total, R.r]);
        collarData.push([idx, c.clone().addScaledVector(b, rad + 0.11), b, (acc + rad + 0.11) / total, R.r]);
      }
    }
    cps.push(P[P.length - 1]);
    const curve = new THREE.CatmullRomCurve3(cps, false, "centripetal");
    const len = curve.getLength();
    const segs = Math.max(12, Math.round(len * DENS));
    const radial = R.r > 0.18 ? 14 : 10;
    const grp = G(R.g);
    const mat = R.dark ? (grp.dark ||= darkMat()) : (grp.copper ||= copperMat());
    if (!grp.mats.includes(mat)) grp.mats.push(mat);
    const mesh = add(scene, new THREE.TubeGeometry(curve, segs, R.r, radial, false), mat);
    mesh.geometry.setDrawRange(0, 0);
    const run = { R, curve, len, mesh, perSeg: radial * 6, segs, prog: -1 };
    if (!R.dark) {
      const wm = new THREE.ShaderMaterial({
        uniforms: { ...U, uB: { value: 0 }, uLen: { value: len }, uHi: { value: 0 }, uSpd: { value: R.g === "area" ? 3.4 : 2.2 } },
        vertexShader: waterVS,
        fragmentShader: waterFS,
        transparent: true,
        depthWrite: false,
        blending: ADD,
      });
      add(scene, new THREE.TubeGeometry(curve, segs, R.r * 1.09, 8, false), wm);
      run.water = wm;
      grp.water.push(wm);
    }
    run.spark = new THREE.Sprite(additive(new THREE.Color(0xff9a4a).multiplyScalar(R.dark ? 0.8 : 1.8)));
    run.spark.visible = false;
    scene.add(run.spark);
    runs.push(run);
  });

  // Sweat-fitting collars at every elbow, one instanced draw call.
  const collarMat = copperMat();
  collarMat.roughness = 0.34;
  const collars = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 16), collarMat, collarData.length);
  collars.frustumCulled = false;
  scene.add(collars);
  const UP = V(0, 1, 0);
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _s = V();
  const updateCollars = () => {
    collarData.forEach(([ri, p, dir, f, r], n) => {
      const on = runs[ri].prog >= f ? 1 : 0;
      _q.setFromUnitVectors(UP, dir);
      _s.set(r * 1.32 * on, 0.24 * on, r * 1.32 * on);
      collars.setMatrixAt(n, _m.compose(p, _q, _s));
    });
    collars.instanceMatrix.needsUpdate = true;
  };

  /* ---------- equipment ---------- */
  // Water treatment: three blue filter housings with glowing cartridges.
  const treat = G("treatment");
  const housingMat = std({ color: 0x2f7fd8, metalness: 0.2, roughness: 0.14, transparent: true, opacity: 0.55, depthWrite: false, emissive: WATER, emissiveIntensity: 0 });
  const coreMat = std({ color: 0x0b2a44, emissive: WATER, emissiveIntensity: 0.7, roughness: 0.6 });
  const capMat = std({ color: 0x18202b, metalness: 0.25, roughness: 0.42 });
  treat.mats.push(housingMat);
  const hGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.7, 28);
  const cGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 20);
  const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.32, 28);
  const nipGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.position.set(-9.6 + i * 1.3, 0, -1.6);
    add(g, cGeo, coreMat, 0, 1);
    add(g, hGeo, housingMat, 0, 1);
    add(g, capGeo, capMat, 0, 2);
    add(g, nipGeo, collarMat, 0, 2.33);
    scene.add(g);
    appear(g, 0.1 + i * 0.03);
  }

  // Tankless heater on the back wall.
  const tk = G("tankless");
  const enamel = std({ color: 0x1d2836, metalness: 0.5, roughness: 0.32, emissive: WATER, emissiveIntensity: 0 });
  tk.mats.push(enamel);
  const heater = new THREE.Group();
  heater.position.set(-2.4, 3.6, -2.7);
  add(heater, new THREE.BoxGeometry(1.6, 2.4, 0.7), enamel);
  add(heater, new THREE.BoxGeometry(1.62, 0.06, 0.72), collarMat, 0, 0.95);
  const display = add(heater, new THREE.PlaneGeometry(0.62, 0.2), glow(WATER, 1.5), 0, 0.62, 0.352);
  const flame = add(heater, new THREE.PlaneGeometry(0.34, 0.1), glow(0xff8a3d, 2.4), 0, -0.55, 0.352);
  scene.add(heater);
  appear(heater, 0.2);

  // Valves: two gate valves with red handwheels, five ball valves on the manifold risers.
  const rep = G("repairs");
  const brass = std({ color: 0xc9a14a, metalness: 1, roughness: 0.3, emissive: WATER, emissiveIntensity: 0 });
  const red = std({ color: 0xa3312a, metalness: 0.3, roughness: 0.45, emissive: WATER, emissiveIntensity: 0 });
  rep.mats.push(brass, red);
  const bodyGeo = new THREE.SphereGeometry(0.3, 20, 14);
  const bonnetGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.5, 14);
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8);
  const torusGeo = new THREE.TorusGeometry(0.34, 0.05, 10, 32);
  const spokeGeo = new THREE.BoxGeometry(0.66, 0.04, 0.05);
  const hubGeo = new THREE.SphereGeometry(0.07, 10, 8);
  const wheels = [];
  const gateValve = (x, y, z, at) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    add(g, bodyGeo, brass);
    add(g, bonnetGeo, brass, 0, 0.36);
    add(g, stemGeo, brass, 0, 0.75);
    const wheel = new THREE.Group();
    wheel.position.y = 0.88;
    g.add(wheel);
    add(wheel, torusGeo, red).rotation.x = Math.PI / 2;
    for (let s = 0; s < 3; s++) add(wheel, spokeGeo, red).rotation.y = (s * Math.PI) / 3;
    add(wheel, hubGeo, red);
    wheels.push(wheel);
    scene.add(g);
    appear(g, at);
  };
  gateValve(-12.8, 2.5, -1.6, 0.07);
  gateValve(0.4, 1, 0.6, 0.31);
  const ballGeo = new THREE.SphereGeometry(0.14, 14, 10);
  const leverGeo = new THREE.BoxGeometry(0.06, 0.05, 0.42);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    g.position.set(3.3 + i * 1.1, 1.9, 0.6);
    add(g, ballGeo, brass);
    add(g, leverGeo, red, 0, 0.1, 0.2);
    scene.add(g);
    appear(g, 0.45 + i * 0.03);
  }

  // Bath: a shower head at the top of the last riser, with falling drops.
  const bath = G("bath");
  const chrome = std({ color: 0xdfe6ee, metalness: 1, roughness: 0.12, emissive: WATER, emissiveIntensity: 0 });
  bath.mats.push(chrome);
  const head = new THREE.Group();
  head.position.set(8.8, 5.2, 1.5);
  add(head, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), chrome, 0, -0.15);
  add(head, new THREE.CylinderGeometry(0.15, 0.44, 0.16, 28), chrome, 0, -0.36);
  add(head, new THREE.CircleGeometry(0.4, 28), glow(WATER, 1.4), 0, -0.445).rotation.x = Math.PI / 2;
  scene.add(head);
  appear(head, 0.62);
  const DROPS = mobile ? 24 : 48;
  const dropPos = new Float32Array(DROPS * 3);
  const dropSeed = Array.from({ length: DROPS }, () => [Math.random(), Math.random() * 6.283, Math.random()]);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const dropMat = new THREE.PointsMaterial({ map: glowTex, size: 0.16, color: new THREE.Color(WATER).multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, blending: ADD });
  const drops = new THREE.Points(dropGeo, dropMat);
  drops.frustumCulled = false;
  scene.add(drops);

  // Nashville and Knoxville: glowing nodes at either end of the line that ties them together.
  const ag = G("area");
  const nodes = [];
  const ringMat = copperMat();
  [
    [-5, 0.86],
    [5, 0.99],
  ].forEach(([x, at]) => {
    const g = new THREE.Group();
    g.position.set(x, 0.35, 6.2);
    add(g, new THREE.SphereGeometry(0.34, 24, 16), glow(WATER, 2.6));
    add(g, new THREE.TorusGeometry(0.62, 0.06, 10, 48), ringMat).rotation.x = Math.PI / 2;
    const pulseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WATER).multiplyScalar(2), transparent: true, depthWrite: false, blending: ADD });
    const pulse = add(g, new THREE.TorusGeometry(0.9, 0.025, 6, 64), pulseMat);
    pulse.rotation.x = Math.PI / 2;
    const halo = new THREE.Sprite(additive(new THREE.Color(WATER).multiplyScalar(1.3), 0.9));
    halo.scale.setScalar(2.8);
    g.add(halo);
    scene.add(g);
    appear(g, at);
    nodes.push({ pulse, pulseMat });
  });
  ag.mats.push(ringMat);

  // The walls that close at the end of the page.
  const wallMat = std({ color: 0x0c1524, metalness: 0.1, roughness: 0.85 });
  const wallGeo = new THREE.BoxGeometry(5.9, 10.5, 0.14);
  const edgeGeo = new THREE.EdgesGeometry(wallGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(WATER).multiplyScalar(1.6), transparent: true, opacity: 0.8 });
  const studGeo = new THREE.BoxGeometry(0.04, 10.3, 0.02);
  const studMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WATER).multiplyScalar(0.5), transparent: true, opacity: 0.35 });
  const walls = [0, 1, 2, 3].map((i) => {
    const m = add(scene, wallGeo, wallMat, -9 + 6 * i, 5.2, 3.7);
    m.add(new THREE.LineSegments(edgeGeo, edgeMat));
    for (let k = -1; k <= 1; k++) add(m, studGeo, studMat, k * 1.47, 0, 0.08);
    m.visible = false;
    return m;
  });

  /* ---------- environment: grid floor, back glow, dust ---------- */
  const floor = add(
    scene,
    new THREE.PlaneGeometry(130, 130),
    new THREE.ShaderMaterial({ uniforms: { uFog: { value: scene.background } }, vertexShader: gridVS, fragmentShader: gridFS })
  );
  floor.rotation.x = -Math.PI / 2;

  const back = add(
    scene,
    new THREE.PlaneGeometry(100, 46),
    new THREE.ShaderMaterial({
      vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "varying vec2 vU; void main(){ float r = length((vU - vec2(0.5, 0.36)) * vec2(1.7, 1.0)); gl_FragColor = vec4(vec3(0.014, 0.04, 0.09) * smoothstep(0.62, 0.0, r), 1.0); }",
      transparent: true,
      depthWrite: false,
      blending: ADD,
      fog: false,
    }),
    -1,
    9,
    -18
  );
  back.renderOrder = -1;

  const DUST = mobile ? 140 : 320;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) dustPos.set([lerp(-19, 15, Math.random()), lerp(0.2, 11, Math.random()), lerp(-9, 11, Math.random())], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.08, color: 0x8fcfff, transparent: true, opacity: 0.5, depthWrite: false, blending: ADD }));
  scene.add(dust);

  /* ---------- lights ---------- */
  const key = new THREE.DirectionalLight(0xffe2c4, 1.7);
  key.position.set(8, 12, 10);
  const rim = new THREE.DirectionalLight(WATER, 1.6);
  rim.position.set(-10, 6, -12);
  const focusLight = new THREE.PointLight(WATER, 0, 14, 2);
  scene.add(key, rim, focusLight);

  /* ---------- post: bloom ---------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const BLOOM = 0.8;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.55, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let bloomOn = true;

  /* ---------- layout: size, section stops ---------- */
  let W = 0;
  let H = 0;
  let pull = 1; // portrait screens pull the camera back so the network still fits
  let stops = [];
  const measure = () => {
    const vh = innerHeight;
    const max = Math.max(1, d.documentElement.scrollHeight - vh);
    stops = [...d.querySelectorAll("[data-cam]")]
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        const top = r.top + scrollY;
        return { k: KF[el.dataset.cam], s: i === 0 ? 0 : clamp((top + Math.min(r.height, vh) * 0.5 - vh * 0.5) / max, 0, 1) };
      })
      .filter((x) => x.k);
    for (let i = 1; i < stops.length; i++) stops[i].s = Math.max(stops[i].s, stops[i - 1].s + 1e-3);
  };
  const resize = (force) => {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    if (!force && w === W && Math.abs(h - H) < 2) return measure();
    W = w;
    H = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    const asp = w / h;
    camera.aspect = asp;
    camera.fov = asp < 1 ? 50 : 40;
    camera.updateProjectionMatrix();
    pull = asp >= 1.2 ? 1 : lerp(1, 1.8, clamp((1.2 - asp) / 0.74, 0, 1));
    measure();
  };
  const ro = new ResizeObserver(() => resize(false));
  ro.observe(d.body);
  const onResize = () => resize(false);
  addEventListener("resize", onResize);

  /* ---------- input ---------- */
  let focusKey = null;
  const onFocus = (e) => (focusKey = e.detail || null);
  let surgeAt = -10;
  let time = 0;
  const onFlush = () => (surgeAt = time);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener("lpg:focus", onFocus);
  addEventListener("lpg:flush", onFlush);
  addEventListener("pointermove", onMove, { passive: true });

  /* ---------- frame ---------- */
  const A = { p: V(), t: V() };
  const B = { p: V(), t: V() };
  const camP = V();
  const camT = V();
  const focusPos = V(0, 3, 0);
  const aim = V();
  let prog = 0;
  let introAt = -1;
  let fade = 0;
  let lastOpacity = -1;
  let lastScrim = -1;
  const scrim = d.querySelector(".scrim");
  let lastBuild = -1;
  let ema = 16;
  let slowFor = 0;
  let focusAmt = 0;

  const evalKF = (K, out) => {
    if (K.orbit) {
      const a = K.a0 + Math.sin(time * 0.07) * 0.75;
      out.p.set(K.t[0] + Math.sin(a) * K.R, K.y, K.t[2] + Math.cos(a) * K.R);
    } else out.p.set(...K.p);
    out.t.set(...K.t);
    out.p.sub(out.t).multiplyScalar(pull).add(out.t);
    out.b = K.b;
    out.dim = K.dim;
    out.wall = K.wall || 0;
    out.hi = K.hi || 0;
    out.scrim = K.scrim ?? 1;
  };

  const update = (dt) => {
    time += dt;
    U.uT.value = time;
    const max = Math.max(1, d.documentElement.scrollHeight - innerHeight);
    prog += (clamp(scrollY / max, 0, 1) - prog) * (1 - Math.exp(-dt * 3.2));

    // Which two vantages are we between?
    let i = 0;
    while (i < stops.length - 2 && prog > stops[i + 1].s) i++;
    const s0 = stops[i];
    const s1 = stops[Math.min(i + 1, stops.length - 1)];
    const f = s1 === s0 ? 0 : easeInOut(clamp((prog - s0.s) / (s1.s - s0.s), 0, 1));
    evalKF(s0.k, A);
    evalKF(s1.k, B);
    camP.lerpVectors(A.p, B.p, f);
    camT.lerpVectors(A.t, B.t, f);

    // Hover focus: drift toward the lit object.
    const fk = focusKey && CENTERS[focusKey];
    focusAmt += ((fk ? 1 : 0) - focusAmt) * Math.min(1, dt * 3);
    if (fk) focusPos.lerp(fk, Math.min(1, dt * 5));
    // Lean gently toward the lit object, aiming below it so it stays in the open band above the tiles.
    camP.lerp(focusPos, 0.05 * focusAmt);
    aim.copy(focusPos).y -= camP.distanceTo(focusPos) * 0.19;
    camT.lerp(aim, 0.25 * focusAmt);
    focusLight.position.copy(focusPos).add(UP);
    focusLight.intensity = focusAmt * 26;

    // Parallax + slow drift.
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.5);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.5);
    camP.x += mouse.sx * 0.7 + Math.sin(time * 0.21) * 0.25;
    camP.y += -mouse.sy * 0.4 + Math.sin(time * 0.17) * 0.18;
    camera.position.copy(camP);
    camera.lookAt(camT);

    // Build progress (gated by the intro so the first build plays on load).
    const intro = introAt < 0 ? 0 : easeInOut(clamp((time - introAt) / 2.4, 0, 1));
    const build = lerp(A.b, B.b, f) * intro;
    if (Math.abs(build - lastBuild) > 1e-4) {
      lastBuild = build;
      runs.forEach((run) => {
        const p = clamp((build - run.R.w[0]) / (run.R.w[1] - run.R.w[0]), 0, 1);
        if (p === run.prog) return;
        run.prog = p;
        run.mesh.geometry.setDrawRange(0, Math.ceil(p * run.segs) * run.perSeg);
        if (run.water) run.water.uniforms.uB.value = p;
      });
      updateCollars();
    }
    runs.forEach((run) => {
      const on = run.prog > 0.002 && run.prog < 0.998;
      run.spark.visible = on;
      if (on) {
        run.curve.getPointAt(run.prog, run.spark.position);
        run.spark.scale.setScalar(0.28 + Math.random() * 0.3);
      }
    });
    items.forEach((it) => {
      it.t = clamp(it.t + (build >= it.at ? dt * 2.2 : -dt * 3), 0, 1);
      it.obj.scale.setScalar(Math.max(1e-4, it.t >= 1 ? 1 : backOut(it.t)));
    });

    // Surge from "Flush the lines".
    const st = time - surgeAt;
    const surge = st >= 0 && st < 2.4 ? Math.sin((Math.PI * st) / 2.4) ** 0.7 : 0;
    U.uSurge.value = surge;
    U.uSX.value = st * 15;
    bloom.strength = BLOOM + surge * 0.7;
    // Tint the glow toward water while the surge runs, so the pulse reads blue, not copper.
    bloom.bloomTintColors.forEach((v) => v.set(1 - surge * 0.55, 1 + surge * 0.05, 1 + surge * 0.45));
    renderer.toneMappingExposure = 1.1 + surge * 0.08;

    // Highlights: tiles (focusKey) and the service-area vantage.
    const areaHi = lerp(A.hi, B.hi, f);
    for (const k in groups) {
      const g = groups[k];
      const target = (k === focusKey ? 1 : 0) + (k === "area" ? areaHi : 0);
      g.hi += (target - g.hi) * Math.min(1, dt * 6);
      g.mats.forEach((m) => (m.emissiveIntensity = g.hi * 0.5));
      g.water.forEach((m) => (m.uniforms.uHi.value = g.hi));
    }
    coreMat.emissiveIntensity = 0.7 + groups.treatment.hi * 1.6;
    display.material.color.setHex(WATER).multiplyScalar(1.5 + groups.tankless.hi * 2.5);
    flame.scale.y = 0.75 + Math.sin(time * 23) * 0.12 + Math.random() * 0.18 + groups.tankless.hi * 0.6;
    wheels.forEach((w) => (w.rotation.y += dt * (0.25 + surge * 10 + groups.repairs.hi * 2.5)));

    // Shower drops.
    const headOn = head.scale.x;
    dropMat.opacity = Math.min(1, headOn) * (0.55 + groups.bath.hi * 0.6 + surge);
    for (let n = 0; n < DROPS; n++) {
      const [a, ang, b] = dropSeed[n];
      const ph = (a + time * (0.7 + b * 0.35) * (1 + surge * 1.5)) % 1;
      const r = 0.05 + b * 0.28 + ph * 0.3;
      dropPos[n * 3] = 8.8 + Math.cos(ang) * r;
      dropPos[n * 3 + 1] = 4.72 - ph * ph * 4.65;
      dropPos[n * 3 + 2] = 1.5 + Math.sin(ang) * r;
    }
    dropGeo.attributes.position.needsUpdate = true;

    // City nodes pulse.
    nodes.forEach((nd, n) => {
      const ph = (time * 0.7 + n * 0.5) % 1;
      nd.pulse.scale.setScalar(1 + ph * 1.6);
      nd.pulseMat.opacity = (1 - ph) * (0.5 + areaHi * 0.5);
    });

    // Walls close.
    const wall = lerp(A.wall, B.wall, f);
    walls.forEach((m, n) => {
      const side = n < 2 ? -1 : 1;
      const wi = easeInOut(clamp((wall - (n % 2 ? 0 : 0.14)) / 0.86, 0, 1));
      m.visible = wall > 0.002;
      m.position.x = -9 + 6 * n + side * (1 - wi) * (15 + (n % 2 ? 0 : 5));
      m.rotation.y = side * (1 - wi) * 0.7;
    });

    dust.rotation.y = time * 0.012;
    dust.position.y = Math.sin(time * 0.2) * 0.25;

    // Canvas dims behind text-heavy sections (fades in after the first frame).
    fade = Math.min(1, fade + dt * 1.4);
    const op = Math.round(lerp(A.dim, B.dim, f) * fade * 100) / 100;
    if (op !== lastOpacity) {
      canvas.style.opacity = op;
      lastOpacity = op;
    }
    // The text scrim eases off where the scene itself is the content (the two city nodes).
    const sc = Math.round(lerp(A.scrim, B.scrim, f) * 100) / 100;
    if (scrim && sc !== lastScrim) {
      scrim.style.opacity = sc;
      lastScrim = sc;
    }
  };

  const quality = (ms) => {
    if (hooks.hq || time < 2) return;
    ema += (ms - ema) * 0.08;
    slowFor = ema > 24 ? slowFor + ms / 1000 : Math.max(0, slowFor - ms / 2000);
    if (slowFor < 2) return;
    slowFor = 0;
    if (bloomOn) bloomOn = false;
    else if (dpr > 0.75) {
      dpr = Math.max(0.75, dpr - 0.25);
      resize(true);
    }
  };

  let raf = 0;
  let running = false;
  let destroyed = false;
  let ready = false;
  let last = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const ms = now - last;
    last = now;
    update(Math.min(ms / 1000, 0.05));
    if (bloomOn) composer.render();
    else renderer.render(scene, camera);
    quality(ms);
    if (!ready) {
      ready = true;
      window.__lpgFirstFrame = performance.now();
      hooks.onReady?.();
    }
  };
  const play = () => {
    if (running || destroyed) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const onVis = () => (d.hidden ? pause() : play());
  d.addEventListener("visibilitychange", onVis);
  const onLost = (e) => {
    if (destroyed) return;
    e.preventDefault();
    hooks.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  window.__lpgScene = {
    get bloom() {
      return bloomOn;
    },
    get dpr() {
      return dpr;
    },
    get frameMs() {
      return Math.round(ema * 10) / 10;
    },
  };

  resize(true);
  update(0);
  // The GPU-heavy setup runs in separate tasks so it never blocks a paint for long:
  // reflections (PMREM of a room), then shader compiles (parallel where supported), then frames.
  const nextTask = () => new Promise((r) => setTimeout(r, 0));
  (async () => {
    await nextTask();
    if (destroyed) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
    pmrem.dispose();
    await nextTask();
    if (destroyed) return;
    renderer.setRenderTarget(rt);
    const compiling = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    await compiling.catch(() => {});
    if (!destroyed && !d.hidden) play();
  })().catch(() => !destroyed && hooks.onLost?.());

  return {
    intro() {
      if (introAt < 0) introAt = time;
    },
    destroy() {
      destroyed = true;
      pause();
      ro.disconnect();
      removeEventListener("resize", onResize);
      removeEventListener("lpg:focus", onFocus);
      removeEventListener("lpg:flush", onFlush);
      removeEventListener("pointermove", onMove);
      d.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((m) => m.dispose());
      });
      glowTex.dispose();
      scene.environment?.dispose();
      composer.dispose?.();
      bloom.dispose();
      rt.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scrim?.style.removeProperty("opacity");
    },
  };
}
