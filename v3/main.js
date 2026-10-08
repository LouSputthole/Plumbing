// Legacy Plumbing Group v3: page behaviour. Loader, effects toggle, kinetic type, reel, and the
// hand-off to the 3D scene (scene.js, loaded only when effects are on).
const d = document;
const html = d.documentElement;
const KEY = "lpg-v3-fx";
const q = (s, r = d) => r.querySelector(s);
const qa = (s, r = d) => [...r.querySelectorAll(s)];
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
const fxOn = () => html.classList.contains("fx");
const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

let scene = null;
let sceneMod = null;
let sceneLoading = false;
let loaderDone = false;

/* ---------- Loader: a pressure gauge, capped at ~1.5 s ---------- */

const loader = q(".gauge-loader");
let gaugeTarget = 18;
const gauge = (v) => (gaugeTarget = Math.max(gaugeTarget, v));

function finishLoad() {
  if (loaderDone) return;
  loaderDone = true;
  html.classList.add("is-loaded");
  q("[data-kinetic]")?.classList.add("is-built");
  // Let the fly-off and headline transitions reach the compositor before the scene's setup work.
  setTimeout(startScene, 140);
}

function runLoader() {
  if (!loader || !fxOn()) {
    loader?.remove();
    finishLoad();
    return;
  }
  const needle = q(".g-needle", loader);
  const fill = q(".g-fill", loader);
  const num = q(".g-num", loader);
  const FORCE_AT = 760; // ms after navigation start: stop waiting and open up.
  let v = 0;
  let last = performance.now();
  let finishing = false;
  const step = (now) => {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    if (!finishing && (gaugeTarget >= 100 || now > FORCE_AT)) finishing = true;
    const goal = finishing ? 100 : gaugeTarget;
    v = Math.min(goal, v + Math.max((goal - v) * dt * 5, (finishing ? 420 : 70) * dt));
    needle.style.transform = `rotate(${-135 + v * 2.7}deg)`;
    fill.setAttribute("stroke-dasharray", `${v.toFixed(1)} 100`);
    num.textContent = Math.round(v);
    if (v < 100) return requestAnimationFrame(step);
    loader.classList.add("is-ok");
    setTimeout(() => {
      loader.classList.add("is-out");
      finishLoad();
      setTimeout(() => loader.remove(), 520);
    }, 170);
  };
  requestAnimationFrame(step);
  d.fonts?.ready.then(() => gauge(40));
}

/* ---------- 3D scene hand-off ---------- */

// Download (and parse) three.js + scene.js while the gauge runs; build the scene once it is done.
function bootScene() {
  if (!q("canvas.scene") || sceneMod || sceneLoading || !fxOn()) return startScene();
  sceneLoading = true;
  import("./scene.js")
    .then((m) => {
      sceneMod = m;
      gauge(100);
      startScene();
    })
    .catch((err) => {
      console.warn("3D scene unavailable; showing the static page instead.", err);
      fallBack();
    })
    .finally(() => (sceneLoading = false));
}

function startScene() {
  const canvas = q("canvas.scene");
  if (!canvas || !sceneMod || scene || !loaderDone || !fxOn()) return;
  try {
    scene = sceneMod.start(canvas, { hq: params.has("hq"), onReady: () => scene?.intro(), onLost: fallBack });
  } catch (err) {
    console.warn("3D scene unavailable; showing the static page instead.", err);
    fallBack();
  }
}

function fallBack() {
  html.classList.add("no-gl");
  setFx(false, false);
  gauge(100);
}

function stopScene() {
  if (!scene) return;
  scene.destroy();
  scene = null;
  // A fresh canvas lets a later restart get a clean WebGL context.
  const old = q("canvas.scene");
  if (old) {
    const c = old.cloneNode(false);
    c.removeAttribute("style");
    old.replaceWith(c);
  }
}

/* ---------- Reduce-effects toggle (stored per browser) ---------- */

const toggle = q(".fx-toggle");

function setFx(on, save) {
  html.classList.toggle("fx", on);
  html.classList.toggle("no-fx", !on);
  toggle?.setAttribute("aria-pressed", String(!on));
  if (save) {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch (e) {}
  }
  if (on) {
    qa("[data-split]").forEach((h) => h.classList.add("is-in"));
    bootScene();
  } else {
    stopScene();
    qa("[data-magnet]").forEach((el) => (el.style.transform = ""));
  }
  layoutReel();
}

toggle?.setAttribute("aria-pressed", String(!fxOn()));
toggle?.addEventListener("click", () => setFx(!fxOn(), true));

/* ---------- Kinetic headline: letters fly in, land, and cool from copper to white ---------- */

function splitHeadline() {
  const h = q("[data-kinetic]");
  if (!h) return;
  const text = h.textContent.trim().replace(/\s+/g, " ");
  let i = 0;
  const words = text.split(" ").map((w) => {
    const chars = [...w]
      .map((ch) => `<span class="kc" style="--i:${i++};--x:${rnd(-180, 180)}px;--y:${rnd(60, 260)}px;--r:${rnd(-60, 60)}deg">${esc(ch)}</span>`)
      .join("");
    return `<span class="kw">${chars}</span>`;
  });
  h.innerHTML = `<span class="sr-only">${esc(text)}</span><span aria-hidden="true">${words.join(" ")}</span>`;
}

/* ---------- Section headings: words rise out of a mask when they scroll in ---------- */

function splitHeadings() {
  const heads = qa("[data-split]");
  heads.forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.innerHTML = words.map((w, n) => `<span class="wm"><span class="wi" style="--w:${n}">${esc(w)}</span></span>`).join(" ");
  });
  if (!("IntersectionObserver" in window)) return heads.forEach((h) => h.classList.add("is-in"));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }),
    { rootMargin: "0px 0px -10% 0px" }
  );
  heads.forEach((h) => io.observe(h));
}

/* ---------- Nav links jitter on hover ---------- */

function splitNav() {
  qa(".site-nav a").forEach((a) => {
    const t = a.textContent.trim();
    a.innerHTML =
      `<span class="sr-only">${esc(t)}</span><span aria-hidden="true">` +
      [...t]
        .map((ch) => `<span class="lt" style="--d:${rnd(0, 90)}ms;--jx:${rnd(-3, 3)}px;--jy:${rnd(-4, 4)}px;--jr:${rnd(-12, 12)}deg">${esc(ch)}</span>`)
        .join("") +
      "</span>";
  });
}

/* ---------- Magnetic buttons and the custom cursor (fine pointers only) ---------- */

function magnets() {
  if (!fine) return;
  qa("[data-magnet]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (!fxOn()) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(-10, Math.min(10, (e.clientX - r.left - r.width / 2) * 0.22));
      const y = Math.max(-8, Math.min(8, (e.clientY - r.top - r.height / 2) * 0.32));
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}

function cursor() {
  if (!fine) return;
  const c = d.createElement("div");
  c.className = "cursor";
  c.setAttribute("aria-hidden", "true");
  d.body.append(c);
  let x = 0, y = 0, cx = 0, cy = 0, running = false;
  const loop = () => {
    cx += (x - cx) * 0.24;
    cy += (y - cy) * 0.24;
    c.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
    running = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 && fxOn();
    if (running) requestAnimationFrame(loop);
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!c.classList.contains("is-on")) {
        cx = x;
        cy = y;
        c.classList.add("is-on");
      }
      if (!running && fxOn()) {
        running = true;
        requestAnimationFrame(loop);
      }
    },
    { passive: true }
  );
  d.addEventListener("pointerover", (e) => {
    c.classList.toggle("is-drop", !!e.target.closest?.("a, button, label, select, summary, [tabindex]"));
  });
  d.addEventListener("pointerleave", () => c.classList.remove("is-on"));
}

/* ---------- Services: tiles tell the scene which part to light up ---------- */

function tiles() {
  const send = (k) => dispatchEvent(new CustomEvent("lpg:focus", { detail: k }));
  qa("[data-obj]").forEach((t) => {
    const k = t.dataset.obj;
    t.addEventListener("pointerenter", () => send(k));
    t.addEventListener("pointerleave", () => send(null));
    t.addEventListener("focusin", () => send(k));
    t.addEventListener("focusout", () => send(null));
    const link = q("[data-service]", t);
    link?.addEventListener("click", () => {
      const sel = q("#f-service");
      if (sel) sel.value = link.dataset.service;
    });
  });
}

/* ---------- Projects reel: coverflow on top of native horizontal scroll ---------- */

const reel = q(".reel");
let reelCards = [];
let reelCenters = [];
let reelRaf = 0;

function measureReel() {
  if (!reel) return;
  reelCenters = reelCards.map((c) => c.offsetLeft + c.offsetWidth / 2);
  layoutReel();
}

function layoutReel() {
  reelRaf = 0;
  if (!reel) return;
  const on = fxOn() && !reduceMotion;
  const mid = reel.scrollLeft + reel.clientWidth / 2;
  const w = reelCards[0]?.offsetWidth || 300;
  reelCards.forEach((c, n) => {
    if (!on) {
      c.style.transform = "";
      c.style.opacity = "";
      return;
    }
    const dd = Math.max(-2.6, Math.min(2.6, (reelCenters[n] - mid) / (w * 1.08)));
    const a = Math.abs(dd);
    c.style.transform = `perspective(1100px) rotateY(${(-dd * 26).toFixed(2)}deg) translateZ(${(-a * 90).toFixed(1)}px) scale(${(1 - Math.min(a, 2) * 0.05).toFixed(3)})`;
    c.style.opacity = (1 - Math.min(a, 2.4) * 0.22).toFixed(3);
  });
  const btns = qa("[data-reel]");
  if (btns.length === 2) {
    btns[0].disabled = reel.scrollLeft < 4;
    btns[1].disabled = reel.scrollLeft > reel.scrollWidth - reel.clientWidth - 4;
  }
}

function setupReel() {
  if (!reel) return;
  reelCards = qa(".reel-card", reel);
  reel.addEventListener("scroll", () => (reelRaf ||= requestAnimationFrame(layoutReel)), { passive: true });
  addEventListener("resize", measureReel);
  qa("[data-reel]").forEach((b) =>
    b.addEventListener("click", () => {
      const step = (reelCards[1]?.offsetLeft || 0) - (reelCards[0]?.offsetLeft || 0) || 320;
      reel.scrollBy({ left: Number(b.dataset.reel) * step, behavior: reduceMotion || !fxOn() ? "auto" : "smooth" });
    })
  );
  // Start on the third photo so the coverflow reads at first glance.
  requestAnimationFrame(() => {
    measureReel();
    const third = reelCards[2];
    if (third) reel.scrollLeft = third.offsetLeft + third.offsetWidth / 2 - reel.clientWidth / 2;
    layoutReel();
  });
  if (fine) {
    reelCards.forEach((c) => {
      const f = q(".reel-frame", c);
      c.addEventListener("pointermove", (e) => {
        if (!fxOn()) return;
        const r = f.getBoundingClientRect();
        f.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
        f.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -12}deg`);
      });
      c.addEventListener("pointerleave", () => {
        f.style.removeProperty("--rx");
        f.style.removeProperty("--ry");
      });
    });
  }
}

/* ---------- Header: menu, scrolled state ---------- */

function header() {
  const head = q(".site-header");
  const menu = q(".menu-toggle");
  if (!head) return;
  const setOpen = (open) => {
    head.classList.toggle("nav-open", open);
    menu?.setAttribute("aria-expanded", String(open));
  };
  menu?.addEventListener("click", () => setOpen(!head.classList.contains("nav-open")));
  qa(".site-nav a", head).forEach((a) => a.addEventListener("click", () => setOpen(false)));
  d.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && head.classList.contains("nav-open")) {
      setOpen(false);
      menu?.focus();
    }
  });
  const onScroll = () => head.classList.toggle("is-scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Flush the lines (easter egg) ---------- */

function flush() {
  const b = q(".flush");
  b?.addEventListener("click", () => {
    dispatchEvent(new Event("lpg:flush"));
    b.classList.remove("is-flushing");
    void b.offsetWidth;
    b.classList.add("is-flushing");
  });
}

/* ---------- Go ---------- */

if (q("[data-kinetic]")) splitHeadline();
splitHeadings();
splitNav();
header();
tiles();
setupReel();
magnets();
cursor();
flush();
bootScene();
runLoader();
