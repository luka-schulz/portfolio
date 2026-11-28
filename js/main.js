// ==========================================================================
// SETTINGS — edit these
// ==========================================================================

// Lines the light/dark switch says when someone keeps clicking it.
// Add as many as you like: one string per line, each ending with a comma.
const QUIPS = [
  "Jesus make up your mind",
  "I swear to god...",
  "Pick one mother f*cker",
];

// Back-to-top arrow: turns with the page as you scroll.
// Turns over a full scroll = turns × (page length ÷ referenceScreens) ^ lengthScale,
// rounded to whole turns (wholeTurns) so it points north at the top and the bottom.
var TO_TOP = {
  turns: 1.5,              // full turns over a complete top-to-bottom scroll of a reference-length page…
  referenceScreens: 6,     // …this many screens tall
  lengthScale: 1,          // how page length changes that: 1 = twice as long → twice the turns,
                           // 0 = same turns on every page, 0.5 = in between
  wholeTurns: true,        // round each page to whole turns, so the arrow is north at the bottom too
  driftSpeed: 0,           // px/s: slower than this counts as stopped (ignores trackpad coasting; 0 = any movement holds it)
  returnDelay: 0,          // ms below that speed before it unwinds
  returnSpring: 0.06,      // how hard it pulls back (higher = quicker)
  returnDamping: 0.86,     // lower = more wiggle as it lands (0.6 bouncy … 0.95 calm)
  maxUnwind: 1,            // most turns it unwinds; extra turns are dropped (0 = no limit)
  maxSpin: 3.5,            // fastest it spins back, in turns per second (0 = no limit)
  stroke: 1.25,            // arrow line weight (icon units; the icon is 12 wide)
  nudge: -0.2              // up (−) / down (+) from dead centre, in icon units
};

// Pop in / out. Sizes are scale (1 = full size); "At" is where in the
// animation the overshoot peaks (0–1 of the duration). Each ease is a
// cubic-bezier: [x1, y1, x2, y2].
// Back-to-top button:
var TO_TOP_POP = {
  inMs: 250,  inFrom: 0.9, inPeak: 1.2, inPeakAt: 0.05, inFadeMs: 100,         // appear: grows past full size, settles back
  inEase: [0.2, 0.6, 0.35, 1], settleEase: [0.45, 0, 0.55, 1],
  outMs: 240, outPeak: 1.2, outPeakAt: 0.34, outTo: 0.9, outFadeMs: 100,       // disappear: swells a little, then shrinks away
  swellEase: [0.35, 0, 0.5, 1], awayEase: [0.6, 0, 1, 0.7]
};
// "E-mail Copied!" toast:
var TOAST_POP = {
  inMs: 250,  inFrom: 0.9, inPeak: 1.05, inPeakAt: 0.05, inFadeMs: 100,
  inEase: [0.2, 0.6, 0.35, 1], settleEase: [0.45, 0, 0.55, 1],
  holdMs: 1600,                                                                // how long it stays up
  outMs: 450, outPeak: 1.05, outPeakAt: 0.45, outTo: 0.9, outFadeMs: 100,
  swellEase: [0.35, 0, 0.5, 1], awayEase: [0.6, 0, 1, 0.7]
};

// ==========================================================================
// BEHAVIOUR — progressive enhancement only: the site works without this file
// ==========================================================================

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");   // shared by everything below

/* Pop an element in or out with settings P (TO_TOP_POP or TOAST_POP). It gets .is-visible while it's
   showing or popping out. Appear: starts small, overshoots past full size,
   settles to 1. Disappear: swells a touch first (anticipation), then shrinks
   away while it fades. Browsers without element.animate just show / hide it. */
function pop(el, show, P) {
  function ease(e) { return "cubic-bezier(" + e.join(",") + ")"; }
  function scale(s) { return "scale(" + s + ")"; }
  (el.__pops || []).forEach(function (a) { a.cancel(); });
  var anims = el.__pops = [];
  if (!el.animate || reduceMotion.matches) { el.classList.toggle("is-visible", show); return; }
  el.classList.add("is-visible");
  if (show) {
    anims.push(el.animate([
      { transform: scale(P.inFrom), easing: ease(P.inEase) },
      { transform: scale(P.inPeak), offset: P.inPeakAt, easing: ease(P.settleEase) },
      { transform: scale(1) }
    ], { duration: P.inMs }));
    anims.push(el.animate([{ opacity: 0, easing: "cubic-bezier(0.2, 0, 0.4, 1)" }, { opacity: 1 }],
      { duration: Math.min(P.inFadeMs, P.inMs) }));
  } else {
    var grow = el.animate([
      { transform: scale(1), easing: ease(P.swellEase) },
      { transform: scale(P.outPeak), offset: P.outPeakAt, easing: ease(P.awayEase) },
      { transform: scale(P.outTo) }
    ], { duration: P.outMs, fill: "forwards" });
    var fade = Math.min(P.outFadeMs, P.outMs);
    anims.push(grow, el.animate([{ opacity: 1, easing: "cubic-bezier(0.4, 0, 1, 1)" }, { opacity: 0 }],
      { duration: fade, delay: P.outMs - fade, fill: "both" }));      // fades over the end
    grow.onfinish = function () {
      if (el.__pops !== anims) return;                                // popped again meanwhile
      el.classList.remove("is-visible");
      anims.forEach(function (a) { a.cancel(); }); el.__pops = [];
    };
  }
}

/* Reveal on load and scroll (see "Reveal" in components.css). Items entering
   together are staggered top-left to bottom-right; anything already
   scrolled past shows at once. */
(function () {
  var root = document.documentElement;
  if (!/(^|\s)reveal-on(\s|$)/.test(root.className)) return;
  clearTimeout(window.__revealFailsafe);

  var STEP = 60, queue = [], frame = 0;

  function show(el, delay) {
    // containers and line-only elements don't fade; they just mark "in" so their hairline draws
    var cls = el.hasAttribute("data-reveal-children") || el.hasAttribute("data-reveal-line") ? " is-in" : " is-revealed";
    el.style.transitionDelay = delay ? delay + "ms" : "";
    if (el.style.setProperty) el.style.setProperty("--reveal-delay", delay + "ms");   // hairlines inside follow the same beat
    el.className += cls;
  }
  function flush() {
    queue.sort(function (a, b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (ra.top - rb.top) || (ra.left - rb.left);
    });
    for (var i = 0; i < queue.length; i++) show(queue[i], i * STEP);
    queue = []; frame = 0;
  }
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (e.isIntersecting) {
        io.unobserve(e.target);
        // containers mark "in" at once; lines take their own step in the stagger
        if (e.target.hasAttribute("data-reveal-children") && !e.target.hasAttribute("data-reveal-line")) show(e.target, 0);
        else queue.push(e.target);
      }
      else if (e.boundingClientRect.bottom < 0) { io.unobserve(e.target); show(e.target, 0); }
    }
    if (queue.length && !frame) frame = requestAnimationFrame(flush);
  }, { rootMargin: "0px 0px -6% 0px" });

  var els = document.querySelectorAll("[data-reveal], [data-reveal-children], [data-reveal-children] > *, [data-reveal-line]");
  for (var j = 0; j < els.length; j++) io.observe(els[j]);
})();

/* Smooth scrolling (base.css) only after load, so the browser's restore of
   your scroll position on reload is instant: no flash of the top, no creep */
window.addEventListener("load", function () {
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.documentElement.classList.add("is-loaded"); });
  });
});

// Videos marked with data-autoplay play only while on screen, and never
// autoplay for people who've asked their OS to reduce motion.
// Saves battery/data on phones when you have several reels on a page.
const videos = document.querySelectorAll("video[data-autoplay]");

if (videos.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (isIntersecting && !reduceMotion.matches) {
        target.play().catch(() => {}); // ignore blocked-autoplay errors
      } else {
        target.pause();
      }
    }
  }, { threshold: 0.25 });

  videos.forEach((video) => {
    video.muted = true; // required for autoplay on iOS/Chrome
    video.playsInline = true;
    observer.observe(video);
  });
}

// Masonry (Work, Photography): place each tile, in order, into the shortest column(s).
// Reads column count and gaps from CSS, so breakpoints live in components.css.
function layoutMasonry(grid) {
  const cs = getComputedStyle(grid);
  const cols = parseInt(cs.getPropertyValue("--cols"), 10) || 1;
  const gapX = parseFloat(cs.columnGap) || 0;
  const gapY = parseFloat(cs.rowGap) || 0;
  grid.classList.add("is-laid-out");
  const colW = (grid.clientWidth - gapX * (cols - 1)) / cols;
  const heights = new Array(cols).fill(0);
  const tiles = [...grid.children];
  const spans = tiles.map((tile) => Math.min(cols, parseInt(tile.dataset.span, 10) || 1));

  // write all widths, then read all heights: one layout pass instead of one per tile
  tiles.forEach((tile, i) => { tile.style.width = `${colW * spans[i] + gapX * (spans[i] - 1)}px`; });
  const tileHeights = tiles.map((tile) => tile.offsetHeight);

  tiles.forEach((tile, i) => {
    const span = spans[i];
    let col = 0, top = Infinity;
    for (let c = 0; c <= cols - span; c++) {           // leftmost lowest slot wins
      const y = Math.max(...heights.slice(c, c + span));
      if (y < top - 0.5) { top = y; col = c; }
    }
    tile.style.left = `${col * (colW + gapX)}px`;
    tile.style.top = `${top}px`;
    for (let c = col; c < col + span; c++) heights[c] = top + tileHeights[i] + gapY;
  });
  grid.style.height = `${Math.max(0, ...heights) - gapY}px`;
}

document.querySelectorAll(".masonry").forEach((grid) => {
  let lastWidth = 0;
  const run = () => layoutMasonry(grid);
  run();
  const reflow = () => { if (grid.clientWidth !== lastWidth) { lastWidth = grid.clientWidth; run(); } };
  if ("ResizeObserver" in window) new ResizeObserver(reflow).observe(grid);   // re-flow when the width changes
  else window.addEventListener("resize", reflow);
  window.addEventListener("load", run);                  // after images/fonts settle
});

// Light / dark toggle. Starts from the OS setting; a click saves the choice.
// (An inline script in <head> applies the saved choice before first paint.)
const themeBtn = document.querySelector(".theme-toggle");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function currentTheme() {
  return document.documentElement.dataset.theme || (prefersDark.matches ? "dark" : "light");
}
function setSwitch(dark) {
  themeBtn.setAttribute("aria-checked", String(dark));   // switch on = dark mode
}
function syncBrowserColor() {             // mobile browser toolbar colour
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch {}
  syncBrowserColor();
}

// "Dark Mode" / "Light Mode" next to the switch: shows, holds, fades.
// Easter egg (clicks < 3s apart count as "in a row"):
//   3rd click in a row  → always a line from QUIPS (top of this file)
//   4th click onwards   → randomly a QUIPS line or the normal label
// Lines are picked at random and never repeat back to back.
const themeLabel = document.querySelector(".theme-label");
let labelTimer, clickStreak = 0, lastClick = 0, lastQuip = -1;

function labelFor(mode) {
  const now = Date.now();
  clickStreak = now - lastClick < 3000 ? clickStreak + 1 : 1;
  lastClick = now;
  if (QUIPS.length && (clickStreak === 3 || (clickStreak > 3 && Math.random() < 0.5))) {
    let i;
    do { i = Math.floor(Math.random() * QUIPS.length); } while (i === lastQuip && QUIPS.length > 1);
    lastQuip = i;
    return QUIPS[i];
  }
  return mode === "dark" ? "Dark Mode" : "Light Mode";
}
function flashLabel(text) {
  if (!themeLabel) return;
  themeLabel.textContent = text;
  themeLabel.classList.add("is-visible");
  clearTimeout(labelTimer);
  labelTimer = setTimeout(() => themeLabel.classList.remove("is-visible"), 1200);
}

// The colours change when the knob first reaches the other side:
// 55% of the 400ms knob animation in components.css.
const THEME_SWAP_DELAY = 220;

if (themeBtn) {
  let target = currentTheme();          // where we're heading (survives fast double-clicks)
  let pending;
  themeBtn.hidden = false;
  setSwitch(target === "dark");
  if (document.documentElement.dataset.theme) syncBrowserColor();   // saved choice may differ from OS

  themeBtn.addEventListener("click", () => {
    target = target === "dark" ? "light" : "dark";
    themeBtn.classList.add("is-switching");   // enables the knob animation (CSS)
    setSwitch(target === "dark");             // knob starts moving now…
    clearTimeout(pending);
    pending = setTimeout(() => applyTheme(target), reduceMotion.matches ? 0 : THEME_SWAP_DELAY);   // …colours follow
    flashLabel(labelFor(target));
  });
  prefersDark.addEventListener("change", () => {   // OS theme changed and no saved choice
    if (!document.documentElement.dataset.theme) { target = currentTheme(); setSwitch(target === "dark"); }
  });
}

// E-mail links copy the address instead of opening a mail app, and show an
// "E-mail Copied!" toast at the cursor. If copying isn't possible, the link
// falls back to opening the mail app as normal.
let toastTimer;
const CURSOR_OFFSET = { x: 14, y: 18 };       // lower right of the arrow cursor
// Created up front (empty): a live region that already exists is announced
// by screen readers far more reliably than one added with its text.
const toast = document.createElement("div");
toast.className = "toast";
toast.setAttribute("role", "status");
document.body.append(toast);

function placeToast(x, y) {
  const left = Math.max(8, Math.min(x, innerWidth - toast.offsetWidth - 8));
  const top = Math.max(8, Math.min(y, innerHeight - toast.offsetHeight - 8));
  toast.style.left = `${left}px`;
  toast.style.top = `${top}px`;
}

// While the toast is up it rides along with the cursor
document.addEventListener("pointermove", (e) => {
  if (toast.dataset.follow && toast.classList.contains("is-visible")) {
    placeToast(e.clientX + CURSOR_OFFSET.x, e.clientY + CURSOR_OFFSET.y);
  }
}, { passive: true });

function showToast(text, anchor, event) {
  toast.textContent = text;
  const byMouse = event && event.detail > 0 && event.pointerType !== "touch";
  if (byMouse) {
    // top-left corner attaches to the lower right of the cursor
    toast.dataset.follow = "1";
    placeToast(event.clientX + CURSOR_OFFSET.x, event.clientY + CURSOR_OFFSET.y);
  } else {
    // keyboard or touch: sit just off the icon's lower right, under the label
    delete toast.dataset.follow;
    const icon = anchor.querySelector(".icon");
    const range = document.createRange();
    range.selectNodeContents(anchor.lastChild || anchor);
    const label = range.getBoundingClientRect();
    const ir = (icon || anchor).getBoundingClientRect();
    placeToast(icon ? label.left : ir.left, Math.max(ir.bottom, label.bottom) + 6);
  }
  pop(toast, true, TOAST_POP);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => pop(toast, false, TOAST_POP), TOAST_POP.holdMs);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / insecure pages: hidden textarea + execCommand
    const field = Object.assign(document.createElement("textarea"), { value: text });
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;opacity:0";
    document.body.append(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}

document.addEventListener("click", async (event) => {
  const link = event.target.closest('a[href^="mailto:"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;   // modifier = open mail app
  event.preventDefault();
  const address = decodeURIComponent(link.getAttribute("href").slice(7).split("?")[0]);
  if (await copyText(address)) {
    showToast("E-mail Copied!", link, event);
  } else {
    window.location.href = link.href;         // couldn't copy: open the mail app
  }
});


/* Back to top: lower-right button (styles: .to-top in components.css;
   settings: TO_TOP at the top of this file). Appears the moment you scroll
   and stays locked in the corner. The arrow follows the scroll 1:1 (more
   turns on longer pages); when you stop scrolling it unwinds every turn you
   just wound, like a spring, back to north. */
(function () {
  var C = TO_TOP;
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "to-top";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML = '<svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 10.75V2.6M2.25 5.5L6 1.75 9.75 5.5"/></svg>';
  document.body.appendChild(btn);
  var needle = btn.firstChild, arrow = needle.firstChild;

  // The arrow's bounding box sits dead centre in the circle and it spins
  // around that centre. The box is measured from the real ink in a hidden
  // canvas, so it stays exact at any line weight.
  function arrowGeom(s) {
    var y0 = 1.75 + s * 0.7, d = "M6 10.75V" + y0.toFixed(2) + "M2.25 5.5L6 1.75 9.75 5.5";
    var top = 1.75 - s / 2, bottom = 10.75 + s / 2;                          // estimates if canvas isn't available
    try {
      var N = 240, k = N / 12, cv = document.createElement("canvas"); cv.width = cv.height = N;
      var cx = cv.getContext("2d"); cx.scale(k, k); cx.lineWidth = s; cx.lineCap = "square"; cx.lineJoin = "miter";
      cx.stroke(new Path2D(d));
      var px = cx.getImageData(0, 0, N, N).data, lo = N, hi = -1;
      for (var i = 3; i < px.length; i += 4) {
        if (px[i] < 128) continue;
        var row = Math.floor((i >> 2) / N);
        if (row < lo) lo = row; if (row > hi) hi = row;
      }
      if (hi >= lo) { top = lo / k; bottom = (hi + 1) / k; }
    } catch (e) {}
    return { d: d, shift: 6 - (top + bottom) / 2, rest: 0 };
  };
  var nudgePx = 0;
  function drawArrow() {                         // line weight + centring from TO_TOP
    var g = arrowGeom(C.stroke);
    needle.setAttribute("stroke-width", C.stroke);
    arrow.setAttribute("d", g.d);                // shaft ends inside the head so it never pokes through the tip
    arrow.setAttribute("transform", "translate(0 " + g.shift.toFixed(3) + ")");   // box centre = circle centre = pivot
    nudgePx = (g.rest + (+C.nudge || 0)) * (parseFloat(getComputedStyle(needle).width) || 18) / 12;   // box centred at rest
    if (typeof render === "function") render();
  }
  drawArrow();

  function turnsForPage() {                      // longer pages turn more (see lengthScale)
    var screens = document.documentElement.scrollHeight / window.innerHeight;
    var t = C.turns * Math.pow(Math.max(screens, 0.01) / C.referenceScreens, C.lengthScale);
    if (C.wholeTurns && t) t = (t < 0 ? -1 : 1) * Math.max(1, Math.round(Math.abs(t)));   // lands on north
    return t;
  }
  function progress() {                          // 0 at the top … 1 at the bottom
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, (window.pageYOffset || document.documentElement.scrollTop) / max)) : 0;
  }
  // While you scroll the arrow follows 1:1 from where the gesture started.
  // When you stop it springs back through every turn you just wound — like a
  // spring unwinding — to the north it started from. "Stopped" means slower
  // than driftSpeed, so a trackpad's coasting doesn't hold it; only a real
  // scroll (2× that speed) grabs it again.
  var isShown = false;
  function popBtn(show) { isShown = show; pop(btn, show, TO_TOP_POP); }

  function scrollAngle() { return reduceMotion.matches ? 0 : progress() * turnsForPage() * 360; }
  var shown = 0, vel = 0, anchor = 0, baseAtStart = 0, running = false, winding = false;
  var lastY = null, lastT = 0, speed = 0, lastFast = -1e9;

  function render() { needle.style.transform = "translateY(" + nudgePx.toFixed(2) + "px)" + (shown ? " rotate(" + shown.toFixed(2) + "deg)" : ""); }
  function frame(now) {
    var dt = Math.min(0.05, Math.max(0.001, (now - (lastT || now - 16.7)) / 1000)); lastT = now;
    var f = dt * 60;                                     // frames' worth of time (keeps the spring the same at 60/120Hz)
    var y = window.pageYOffset || document.documentElement.scrollTop;
    var dy = lastY === null || Math.abs(y - lastY) > window.innerHeight * 0.4 ? 0 : y - lastY;   // ignore jumps (reload restore, anchors)
    lastY = y;
    speed = speed * 0.6 + (Math.abs(dy) / dt) * 0.4;     // smoothed px per second
    if ((y > 0) !== isShown) popBtn(y > 0);

    var base = scrollAngle(), settled = false;
    if (speed > Math.max(5, C.driftSpeed) * (winding ? 1 : 2)) lastFast = now;   // a real scroll (re-grabbing needs 2× the speed)
    if (now - lastFast <= C.returnDelay) {               // scrolling: follow 1:1 from the gesture's start
      if (!winding) { winding = true; anchor = 360 * Math.round(shown / 360); baseAtStart = base - (shown - anchor); }
      shown = anchor + (base - baseAtStart); vel = 0;
    } else {                                             // stopped (or just coasting): unwind back to north
      if (winding) {                                     // just let go: drop turns beyond maxUnwind (still lands on a north)
        winding = false;
        var M = C.maxUnwind * 360, d = shown - anchor;
        if (M > 0 && Math.abs(d) > M) anchor = 360 * Math.round((shown - (d > 0 ? M : -M)) / 360);   // nearest north to "M turns back"
      }
      vel = (vel + (anchor - shown) * C.returnSpring * f) * Math.pow(C.returnDamping, f);
      var vMax = C.maxSpin * 6;                          // turns/s → degrees per 60th of a second
      if (vMax > 0) vel = Math.max(-vMax, Math.min(vMax, vel));
      shown += vel * f;
      if (Math.abs(anchor - shown) < 0.1 && Math.abs(vel) < 0.1 && speed < 1) { shown = 0; anchor = 0; vel = 0; settled = true; }
    }
    render();
    running = !settled;
    if (running) requestAnimationFrame(frame); else lastT = 0;
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  function onScroll() { wake(); }
  window.addEventListener("scroll", onScroll, { passive: true });
  render();
  isShown = (window.pageYOffset || document.documentElement.scrollTop) > 0;   // no pop on load
  btn.classList.toggle("is-visible", isShown);


  btn.addEventListener("click", function (e) {
    try { window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" }); }
    catch (err) { window.scrollTo(0, 0); }      // very old browsers: no options object
    if (e.detail === 0) {                        // keyboard: continue from the top of the page
      var first = document.querySelector("header a");
      if (first) first.focus({ preventScroll: true });
    } else {
      btn.blur();                                // mouse: don't leave a focus ring behind
    }
  });
})();


/* Lightbox for images inside any [data-lightbox] element: the photo grid,
   case studies and blog posts (styles: .lightbox in components.css).
   Click / Enter opens the photo centred over a dimmed page; Esc, a click on
   the dim or × closes; ← → keys or buttons step through the set. Clicking the photo
   toggles full screen (also F / the corner button; Esc leaves it); the
   bottom-left tools also open the photo in a new tab. Focus goes
   to the viewer itself (no ring) and returns to the photo you opened. */
(function () {
  var sets = document.querySelectorAll("[data-lightbox]");
  if (!sets.length) return;

  var box = document.createElement("div");
  box.className = "lightbox";
  box.tabIndex = -1;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Photo viewer");
  box.innerHTML =
    '<p class="lightbox__count" aria-live="polite"></p>' +
    '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close"><svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>' +
    '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous photo"><svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" aria-hidden="true"><path d="M10.5 6H1.5M5.25 2.25L1.5 6 5.25 9.75"/></svg></button>' +
    '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next photo"><svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" aria-hidden="true"><path d="M1.5 6h9M6.75 2.25L10.5 6 6.75 9.75"/></svg></button>' +
    '<img class="lightbox__img" alt="">' +
    '<div class="lightbox__tools">' +
      '<button type="button" class="lightbox__btn lightbox__tool lightbox__full" aria-label="Full screen" aria-pressed="false"><svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" aria-hidden="true"><path class="i-expand" d="M1.5 4.5v-3h3M7.5 1.5h3v3M10.5 7.5v3h-3M4.5 10.5h-3v-3"/><path class="i-shrink" d="M4.5 1.5v3h-3M10.5 4.5h-3v-3M7.5 10.5v-3h3M1.5 7.5h3v3"/></svg></button>' +
      '<a class="lightbox__btn lightbox__tool lightbox__newtab" target="_blank" rel="noopener" aria-label="Open image in a new tab"><svg class="icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="square" aria-hidden="true"><path d="M3.5 2H2v8h8V8.5M7 1.5h3.5V5M10.5 1.5L5.5 6.5"/></svg></a>' +
    '</div>';
  document.body.appendChild(box);
  var big = box.querySelector(".lightbox__img");
  var count = box.querySelector(".lightbox__count");
  var buttons = [].slice.call(box.querySelectorAll("button, a"));
  var tools = box.querySelector(".lightbox__tools");
  var fullBtn = box.querySelector(".lightbox__full");
  var newTab = box.querySelector(".lightbox__newtab");

  // Pin the tools inside the photo's bottom-left corner. offset* ignore
  // the entrance transform, so it lands where the photo will settle.
  function placeTools() {
    if (!big.offsetWidth) return;
    var inset = 10;
    tools.style.left = (big.offsetLeft + inset) + "px";                                        // bottom-left corner
    tools.style.top = (big.offsetTop + big.offsetHeight - tools.offsetHeight - inset) + "px";
  }
  big.addEventListener("load", placeTools);
  window.addEventListener("resize", function () { if (box.classList.contains("is-open")) placeTools(); });

  // Full mode: solid black, photo as large as the window allows (never upscaled)
  // Keep the corner tools pinned while the photo scales on open/close: the
  // photo scales from its centre, so its bottom-left corner moves in by
  // (1 − s) / 2 of its size. Same timing as the photo's CSS transition.
  function trackCorner(fromScale, toScale, timing) {
    if (!big.offsetWidth || reduceMotion.matches) return;
    var w = big.offsetWidth, h = big.offsetHeight;
    function at(s) { return s === 1 ? "" : "translate(" + (w * (1 - s) / 2) + "px," + (-h * (1 - s) / 2) + "px)"; }
    tools.style.transition = "none";
    tools.style.transform = at(fromScale);
    tools.offsetWidth;
    tools.style.transition = timing;
    tools.style.transform = at(toScale);
  }

  // The photo animates between sizes (FLIP: measure before and after, then
  // play the difference back as a transform) in step with the background.
  var morphTimer;
  function setFull(on) {
    var animate = box.classList.contains("is-open") && !reduceMotion.matches && big.offsetWidth;
    var first = animate && big.getBoundingClientRect();
    var toolsFirst = animate && tools.getBoundingClientRect();
    box.classList.toggle("is-full", on);
    fullBtn.setAttribute("aria-pressed", String(on));
    fullBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    placeTools();
    if (!animate) return;
    var last = big.getBoundingClientRect();
    var toolsLast = tools.getBoundingClientRect();
    var dx = (first.left + first.width / 2) - (last.left + last.width / 2);
    var dy = (first.top + first.height / 2) - (last.top + last.height / 2);
    var s = first.width / last.width;
    var MORPH = "transform 360ms var(--ease-settle)";
    // photo: from its old size and place; tools: from their old place. Same
    // timing and easing, so the tools stay pinned to the photo's corner.
    big.style.transition = tools.style.transition = "none";
    big.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + s + ")";
    tools.style.transform = "translate(" + (toolsFirst.left - toolsLast.left) + "px," + (toolsFirst.top - toolsLast.top) + "px)";
    big.offsetWidth;                                     // commit the starting points
    big.style.transition = tools.style.transition = MORPH;
    big.style.transform = tools.style.transform = "";
    clearTimeout(morphTimer);
    morphTimer = setTimeout(function () { big.style.transition = tools.style.transition = ""; }, 380);
  }
  var photos = [], index = -1, opener = null, closeTimer, lockedY = 0;

  function show(i) {
    index = (i + photos.length) % photos.length;
    var img = photos[index];
    big.src = img.src;                                   // full size, not the grid copy (srcset)
    big.alt = img.alt;
    newTab.href = big.src;
    if (big.complete) placeTools();
    count.textContent = (index + 1) + " / " + photos.length;
  }
  function open(img) {
    photos = viewable(img.closest("[data-lightbox]"));
    box.classList.toggle("is-single", photos.length < 2);   // one photo: no arrows or count
    opener = img;
    clearTimeout(closeTimer);
    box.classList.remove("is-closing");
    show(photos.indexOf(img));
    lockScroll();                                        // scroll is locked, scrollbar stays: no reflow
    box.offsetWidth;                                     // start the animation from the closed state
    trackCorner(0.97, 1, "opacity 180ms var(--ease-fade), transform 320ms var(--ease-settle)");   // matches the photo's scale-up
    box.classList.add("is-open");
    box.focus({ preventScroll: true });                  // focus the viewer, not a button: no stray ring
  }
  function close() {
    if (!box.classList.contains("is-open")) return;
    box.classList.add("is-closing");                    // photo keeps its size: just shrinks a touch and fades
    trackCorner(1, 0.95, "opacity 140ms var(--ease-fade), transform 200ms var(--ease-close-scale)");     // matches the photo's shrink
    box.classList.remove("is-open");
    unlockScroll();
    var after = 240;
    setTimeout(function () {                             // after the fade: reset for the next open
      box.classList.remove("is-closing");
      tools.style.transition = tools.style.transform = "";
      setFull(false);
    }, after);
    if (opener) opener.focus({ preventScroll: true });
    closeTimer = setTimeout(function () { big.removeAttribute("src"); }, after);
  }

  // Every image in the set, except ones that are already links (e.g. a film poster)
  function viewable(set) {
    return [].filter.call(set.querySelectorAll("img"), function (img) { return !img.closest("a"); });
  }
  [].forEach.call(sets, function (set) {
    viewable(set).forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "Open photo" + (img.alt ? ": " + img.alt : ""));
    });
    set.addEventListener("click", function (e) {
      var img = e.target.closest("img");
      if (img && !img.closest("a")) open(img);
    });
    set.addEventListener("keydown", function (e) {
      var img = e.target.closest && e.target.closest("img");
      if (img && !img.closest("a") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(img); }
    });
  });

  box.addEventListener("click", function (e) {
    if (e.target === big) return setFull(!box.classList.contains("is-full"));   // photo: full screen on / off
    var btn = e.target.closest("button, a");
    if (!btn) return close();                            // the blurred background
    e.stopPropagation();
    if (btn === newTab) return;                          // let the link open its tab
    if (btn.classList.contains("lightbox__prev")) show(index - 1);
    else if (btn.classList.contains("lightbox__next")) show(index + 1);
    else if (btn === fullBtn) setFull(!box.classList.contains("is-full"));
    else close();
    if (e.detail > 0) btn.blur();                        // mouse: no lingering focus ring
  });
  // Lock scrolling without hiding the scrollbar, so the page never changes
  // width (hiding it is what made the layout jump). Wheel/touch are blocked,
  // scroll keys are swallowed, and a scrollbar drag is undone.
  // Listeners only while open: a non-passive wheel listener left on the page
  // would make every normal scroll wait for the main thread.
  function block(e) { e.preventDefault(); }
  function hold() { if (window.pageYOffset !== lockedY) window.scrollTo(0, lockedY); }
  function lockScroll() {
    lockedY = window.pageYOffset;
    document.addEventListener("wheel", block, { passive: false });
    document.addEventListener("touchmove", block, { passive: false });
    window.addEventListener("scroll", hold);
  }
  function unlockScroll() {
    document.removeEventListener("wheel", block, { passive: false });
    document.removeEventListener("touchmove", block, { passive: false });
    window.removeEventListener("scroll", hold);
  }

  var SCROLL_KEYS = { " ": 1, PageUp: 1, PageDown: 1, Home: 1, End: 1, ArrowUp: 1, ArrowDown: 1 };
  document.addEventListener("keydown", function (e) {
    if (!box.classList.contains("is-open")) return;
    if (SCROLL_KEYS[e.key] && !(e.key === " " && e.target.closest && e.target.closest("button"))) e.preventDefault();
    if (e.key === "Escape") { if (box.classList.contains("is-full")) setFull(false); else close(); }
    else if (e.key === "f" || e.key === "F") setFull(!box.classList.contains("is-full"));
    else if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
    else if (e.key === "Tab") {                          // keep focus inside the viewer
      e.preventDefault();
      var shown = buttons.filter(function (b) { return b.offsetParent !== null; });   // skip hidden ones
      var i = shown.indexOf(document.activeElement);
      shown[(i + (e.shiftKey ? -1 : 1) + shown.length) % shown.length].focus();
    }
  });
})();


/* Scroll position: we restore it ourselves (head script sets
   history.scrollRestoration = "manual"), after the layout above — masonry
   included — so you land exactly where you were with no flash of the top. */
(function () {
  var root = document.documentElement;
  var key = "scroll:" + location.pathname;
  if (window.__restoreY != null) {
    window.scrollTo(0, window.__restoreY);
    root.className = root.className.replace(" is-restoring", "");
  }
  window.addEventListener("pagehide", function () {
    try { sessionStorage.setItem(key, String(Math.round(window.pageYOffset))); } catch (e) {}
  });
})();
