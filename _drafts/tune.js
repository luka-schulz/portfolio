/* ==========================================================================
   TUNE PANEL — temporary design tool. Not part of the site.
   Tunes the "E-mail Copied!" toast's pop (TOAST_POP in main.js).
   Values are remembered (localStorage) across pages and reloads.
   When you're happy: "Copy values", paste over TOAST_POP in js/main.js,
   then delete this file and the <script src="…/tune.js"> line on each page.
   Toggle with the "Tune" tab (bottom left) or the ` key.
   ========================================================================== */
(function () {
  "use strict";
  var STORE = "tune-toast-v1";

  // Back-to-top pop from arrow-lab.html also applies on every page
  try {
    var lab = JSON.parse(localStorage.getItem("arrow-lab-pop-v1"));
    if (lab && window.TO_TOP_POP) Object.assign(window.TO_TOP_POP, lab);
  } catch (e) {}

  var P = window.TOAST_POP;
  if (!P) return;
  var DEFAULTS = JSON.parse(JSON.stringify(P));
  try { Object.assign(P, JSON.parse(localStorage.getItem(STORE)) || {}); } catch (e) {}
  function save() { try { localStorage.setItem(STORE, JSON.stringify(P)); } catch (e) {} }

  // ---- Styles --------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent = [
    ".tune-tab{position:fixed;left:12px;bottom:12px;z-index:1001;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:#1b1b1b;color:#eee;cursor:pointer}",
    ".tune{position:fixed;left:12px;bottom:48px;z-index:1000;width:320px;max-height:calc(100vh - 64px);overflow:hidden auto;padding:12px 14px 14px;border-radius:12px;background:#151515;color:#ddd;border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 40px rgba(0,0,0,.35);font:12px/1.35 -apple-system,system-ui,sans-serif;text-align:left}",
    ".tune[hidden]{display:none}",
    ".tune h2{margin:16px 0 2px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#999;font-weight:600}",
    ".tune h2:first-child{margin-top:0}",
    ".tune p{margin:4px 0 0;color:#888}",
    ".tune .row{display:grid;grid-template-columns:96px 1fr 64px;gap:8px;align-items:center;margin-top:8px}",
    ".tune .row label{color:#bbb}",
    ".tune input[type=range]{width:100%;accent-color:#9ab}",
    ".tune input[type=number]{width:100%;box-sizing:border-box;background:#0d0d0d;color:#eee;border:1px solid #2a2a2a;border-radius:5px;padding:3px 5px;font:12px ui-monospace,Menlo,monospace;text-align:right}",
    ".tune button{font:inherit;color:#ddd;background:#262626;border:1px solid #333;border-radius:6px;padding:5px 9px;cursor:pointer}",
    ".tune button:hover{background:#2f2f2f}",
    ".tune .bar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}",
    ".tune .check{display:flex;gap:8px;align-items:center;margin-top:10px;color:#ddd;cursor:pointer}",
    ".tune .check input{accent-color:#9ab}",
    ".tune canvas{display:block;width:100%;height:150px;margin-top:8px;background:#0d0d0d;border:1px solid #2a2a2a;border-radius:6px;cursor:crosshair;touch-action:none}",
    ".tune canvas.grab{cursor:grab}.tune canvas.grabbing{cursor:grabbing}",
    ".tune .key{font:10px ui-monospace,Menlo,monospace;color:#777;margin-top:4px}",
    ".tune textarea{width:100%;box-sizing:border-box;height:150px;margin-top:8px;background:#0d0d0d;color:#cde;border:1px solid #2a2a2a;border-radius:6px;font:11px/1.4 ui-monospace,Menlo,monospace;padding:6px}"
  ].join("\n");
  document.head.appendChild(css);

  var panel = document.createElement("aside"); panel.className = "tune"; panel.setAttribute("aria-label", "Tune: e-mail toast");
  var tab = document.createElement("button"); tab.className = "tune-tab"; tab.type = "button"; tab.textContent = "TUNE";
  var open = false; try { open = localStorage.getItem(STORE + "-open") === "1"; } catch (e) {}
  panel.hidden = !open;
  function toggle() { open = !open; panel.hidden = !open; try { localStorage.setItem(STORE + "-open", open ? "1" : "0"); } catch (e) {} if (open) changed(); }
  tab.addEventListener("click", toggle);
  document.addEventListener("keydown", function (e) {
    if (e.key === "`" && !/input|textarea/i.test(e.target.tagName)) toggle();
  });
  document.body.appendChild(panel); document.body.appendChild(tab);

  // ---- Building blocks -----------------------------------------------------
  function h(t) { var e = document.createElement("h2"); e.textContent = t; panel.appendChild(e); }
  function p(t) { var e = document.createElement("p"); e.textContent = t; panel.appendChild(e); }
  function bar() { var e = document.createElement("div"); e.className = "bar"; panel.appendChild(e); return e; }
  function button(parent, label, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = label; b.onclick = fn; parent.appendChild(b); return b; }
  var syncs = [];
  function control(name, get, set, min, max, step) {
    var row = document.createElement("div"); row.className = "row";
    row.innerHTML = "<label>" + name + "</label><input type=range><input type=number>";
    var r = row.children[1], n = row.children[2];
    r.min = n.min = min; r.max = n.max = max; r.step = n.step = step;
    function sync() { r.value = n.value = +(+get()).toFixed(3); }
    function input(v) { v = parseFloat(v); if (isNaN(v)) return; set(v); changed(); }
    r.addEventListener("input", function () { input(r.value); });
    n.addEventListener("input", function () { input(n.value); });
    sync(); panel.appendChild(row); syncs.push(sync);
  }
  function ms(name, key, max) { control(name, function () { return P[key]; }, function (v) { P[key] = v; }, 0, max, 10); }
  function pct(name, key, min, max, step) { control(name, function () { return P[key] * 100; }, function (v) { P[key] = v / 100; }, min, max, step); }

  // ---- cubic-bezier easing (same maths the browser uses) --------------------
  function bezier(e) {
    function c(t, a, b) { return 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t; }
    return function (x) {
      var lo = 0, hi = 1, t = x;
      for (var k = 0; k < 30; k++) { t = (lo + hi) / 2; if (c(t, e[0], e[2]) < x) lo = t; else hi = t; }
      return c(t, e[1], e[3]);
    };
  }
  function curve(dir) {                           // size over time (0–1)
    var a = dir === "in" ? [P.inFrom, P.inPeak, 1, P.inPeakAt, P.inEase, P.settleEase]
                         : [1, P.outPeak, P.outTo, P.outPeakAt, P.swellEase, P.awayEase];
    var e1 = bezier(a[4]), e2 = bezier(a[5]);
    return function (t) { return t <= a[3] ? a[0] + (a[1] - a[0]) * e1(t / a[3]) : a[1] + (a[2] - a[1]) * e2((t - a[3]) / (1 - a[3])); };
  }
  function fadeCurve(dir) {                       // opacity over time, as main.js does it
    if (dir === "in") { var f = Math.min(P.inFadeMs, P.inMs) / P.inMs, e = bezier([0.2, 0, 0.4, 1]);
      return function (t) { return t >= f ? 1 : e(t / f); }; }
    var g = Math.min(P.outFadeMs, P.outMs) / P.outMs, s0 = 1 - g, e2 = bezier([0.4, 0, 1, 1]);
    return function (t) { return t <= s0 ? 1 : 1 - e2((t - s0) / g); };
  }

  // ---- Graph with draggable points --------------------------------------------
  var LO = 0.4, HI = 1.3;
  function graph(dir) {
    var cv = document.createElement("canvas"); panel.appendChild(cv);
    var key = document.createElement("div"); key.className = "key"; key.textContent = "— size   ┄ opacity   ● drag the dots"; panel.appendChild(key);
    var ctx = cv.getContext("2d"), W, H, pad = { l: 34, r: 10, t: 10, b: 18 };
    function X(t) { return pad.l + t * (W - pad.l - pad.r); }
    function Y(s) { return pad.t + (HI - s) / (HI - LO) * (H - pad.t - pad.b); }
    function T(x) { return (x - pad.l) / (W - pad.l - pad.r); }
    function S(y) { return HI - (y - pad.t) / (H - pad.t - pad.b) * (HI - LO); }
    function handles() {
      return dir === "in" ? [
        { t: 0, s: P.inFrom, set: function (t, s) { P.inFrom = s; } },
        { t: P.inPeakAt, s: P.inPeak, set: function (t, s) { P.inPeakAt = t; P.inPeak = s; } }
      ] : [
        { t: P.outPeakAt, s: P.outPeak, set: function (t, s) { P.outPeakAt = t; P.outPeak = s; } },
        { t: 1, s: P.outTo, set: function (t, s) { P.outTo = s; } }
      ];
    }
    function draw() {
      if (panel.hidden) return;
      var r = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textBaseline = "middle"; ctx.fillStyle = "#666";
      [0.5, 0.7, 1, 1.2].forEach(function (s) {
        ctx.strokeStyle = s === 1 ? "#3a4a55" : "#1f1f1f"; ctx.setLineDash(s === 1 ? [] : [2, 3]);
        ctx.beginPath(); ctx.moveTo(pad.l, Y(s)); ctx.lineTo(W - pad.r, Y(s)); ctx.stroke();
        ctx.fillText(Math.round(s * 100) + "%", 2, Y(s));
      });
      ctx.setLineDash([]); ctx.textBaseline = "alphabetic"; ctx.fillText("0", pad.l - 2, H - 4);
      ctx.textAlign = "right"; ctx.fillText((dir === "in" ? P.inMs : P.outMs) + "ms", W - pad.r, H - 4); ctx.textAlign = "left";
      var f = fadeCurve(dir), c = curve(dir), n = 120, k;
      ctx.strokeStyle = "#556"; ctx.setLineDash([3, 3]); ctx.beginPath();
      for (k = 0; k <= n; k++) ctx[k ? "lineTo" : "moveTo"](X(k / n), Y(LO + f(k / n) * (1 - LO)));
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#9cf"; ctx.lineWidth = 2; ctx.beginPath();
      for (k = 0; k <= n; k++) ctx[k ? "lineTo" : "moveTo"](X(k / n), Y(c(k / n)));
      ctx.stroke(); ctx.lineWidth = 1;
      handles().forEach(function (hd) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(hd.t), Y(hd.s), 5, 0, 7); ctx.fill();
        ctx.fillStyle = "#cde"; ctx.fillText(Math.round(hd.s * 100) + "%", Math.min(X(hd.t) + 8, W - 38), Y(hd.s) - 8);
      });
    }
    var drag = null;
    function at(ev) { var b = cv.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; }
    function near(pt) {
      var best = null, d = 14;
      handles().forEach(function (hd, i) { var dd = Math.hypot(X(hd.t) - pt.x, Y(hd.s) - pt.y); if (dd < d) { d = dd; best = i; } });
      return best;
    }
    cv.addEventListener("pointerdown", function (ev) {
      drag = near(at(ev)); if (drag === null) return;
      cv.setPointerCapture(ev.pointerId); cv.classList.add("grabbing");
    });
    cv.addEventListener("pointermove", function (ev) {
      var pt = at(ev);
      if (drag === null) { cv.classList.toggle("grab", near(pt) !== null); return; }
      var t = Math.min(0.95, Math.max(0.05, T(pt.x))), sc = Math.min(HI, Math.max(LO, S(pt.y)));
      handles()[drag].set(Math.round(t * 100) / 100, Math.round(sc * 100) / 100); changed();
    });
    cv.addEventListener("pointerup", function () {
      if (drag !== null) { drag = null; cv.classList.remove("grabbing"); play(dir); }
    });
    return draw;
  }

  // ---- Preview: the real toast, just to the right of the panel ----------------
  var slow = false;
  function play(mode) {
    if (!window.__toastDemo) return;
    var keep = { inMs: P.inMs, inFadeMs: P.inFadeMs, outMs: P.outMs, outFadeMs: P.outFadeMs, holdMs: P.holdMs };
    if (slow) for (var k in keep) P[k] = keep[k] * 4;   // main.js reads these when the pop starts
    var b = panel.getBoundingClientRect();
    window.__toastDemo(mode, b.right + 40, Math.max(40, window.innerHeight / 2));
    if (mode !== "full") Object.assign(P, keep);
    else setTimeout(function () { Object.assign(P, keep); }, 0);   // the hold timer already has its time
  }

  // ---- Panel -------------------------------------------------------------------
  h("E-mail toast · pop in");
  p("Starts small, overshoots past full size, settles back to 100%.");
  var drawIn = graph("in");
  ms("Duration ms", "inMs", 1200);
  pct("Start size %", "inFrom", 40, 100, 1);
  pct("Overshoot %", "inPeak", 100, 130, 0.5);
  pct("Overshoot at %", "inPeakAt", 5, 95, 1);
  ms("Fade ms", "inFadeMs", 1200);
  button(bar(), "▶ Pop in", function () { play("in"); });

  h("Stays up");
  ms("Hold ms", "holdMs", 5000);

  h("Pop out");
  p("Swells a little first (anticipation), then shrinks away as it fades.");
  var drawOut = graph("out");
  ms("Duration ms", "outMs", 1200);
  pct("Swell %", "outPeak", 100, 130, 0.5);
  pct("Swell at %", "outPeakAt", 5, 95, 1);
  pct("End size %", "outTo", 40, 100, 1);
  ms("Fade ms", "outFadeMs", 1200);
  button(bar(), "▶ Pop out", function () { play("out"); });

  h("Preview");
  var lbl = document.createElement("label"); lbl.className = "check";
  lbl.innerHTML = "<input type=checkbox> Slow motion (×4)";
  lbl.firstChild.onchange = function () { slow = this.checked; }; panel.appendChild(lbl);
  button(bar(), "▶ Whole thing (in, hold, out)", function () { play("full"); });
  p("Or click the e-mail link anywhere on the site.");

  h("Values");
  p("Paste these over TOAST_POP in js/main.js.");
  var out = document.createElement("textarea"); out.readOnly = true; panel.appendChild(out);
  var b4 = bar();
  var copy = button(b4, "Copy values", function () {
    out.select(); try { navigator.clipboard.writeText(out.value); } catch (e) { document.execCommand("copy"); }
    copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy values"; }, 1200);
  });
  button(b4, "Reset", function () { Object.assign(P, JSON.parse(JSON.stringify(DEFAULTS))); changed(); });

  function arr(a) { return "[" + a.join(", ") + "]"; }
  function r3(v) { return +(+v).toFixed(3); }
  function output() {
    return "// main.js — SETTINGS\nvar TOAST_POP = {\n" +
      "  inMs: " + P.inMs + ",  inFrom: " + r3(P.inFrom) + ", inPeak: " + r3(P.inPeak) + ", inPeakAt: " + r3(P.inPeakAt) + ", inFadeMs: " + P.inFadeMs + ",\n" +
      "  inEase: " + arr(P.inEase) + ", settleEase: " + arr(P.settleEase) + ",\n" +
      "  holdMs: " + P.holdMs + ",\n" +
      "  outMs: " + P.outMs + ", outPeak: " + r3(P.outPeak) + ", outPeakAt: " + r3(P.outPeakAt) + ", outTo: " + r3(P.outTo) + ", outFadeMs: " + P.outFadeMs + ",\n" +
      "  swellEase: " + arr(P.swellEase) + ", awayEase: " + arr(P.awayEase) + "\n};";
  }
  function changed() { syncs.forEach(function (f) { f(); }); drawIn(); drawOut(); out.value = output(); save(); }
  window.addEventListener("resize", function () { drawIn(); drawOut(); });
  changed();
})();
