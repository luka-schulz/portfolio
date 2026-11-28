/* Dappled light: soft bands of light and shadow drifting on the page background.
   Loaded by main.js (DAPPLE.on). Remove this file and that line to drop it.
   Tune it live on _drafts/dapple.html.

   How it stays light: two tiny canvases (1/softness of the screen), stretched
   to fill it, which blurs them for free: a crisper layer over a softer one.
   Each band is one stretched radial gradient (no blur filters), moved by
   smooth noise: it slides along its length, wobbles, twists, stretches and
   fades in and out. Still for Reduce Motion; pauses in hidden tabs. */
(function () {
  var DEFAULTS = {
    angle: -28,                 // direction of the light, degrees (0 = horizontal)
    shadowShare: 0.6,           // share of bands that are shadow (the rest are light)

    // colours and strengths: light mode
    lightShadow: "#7d766f", lightShadowStrength: 0.09,
    lightLight: "#ffffff",  lightLightStrength: 0.6,
    // dark mode
    darkShadow: "#000000",  darkShadowStrength: 0.35,
    darkLight: "#ffecd2",   darkLightStrength: 0.07,

    // movement
    speed: 0.1,                 // overall pace (0 = still)
    drift: 0.06,                // slide along the band (share of the width)
    wobble: 0.012,              // sideways sway
    twist: 3,                   // angle wobble, degrees
    stretch: 0.15,              // how much bands lengthen and shorten
    fade: 0.7,                  // how much each band fades in and out (0 = steady)
    fps: 20,

    // crisper layer, on top
    sharpCount: 7, sharpLength: 0.45, sharpWidth: 0.035, sharpSoftness: 4, sharpHardness: 0.45, sharpStrength: 0.8,
    // softer layer, underneath
    softCount: 6, softLength: 0.7, softWidth: 0.12, softSoftness: 14, softHardness: 0.1, softStrength: 1,

    seed: 7                     // arrangement; change for a different one
  };
  var S;
  function readSettings() {
    var D = window.DAPPLE || {}, out = {};
    for (var k in DEFAULTS) out[k] = D[k] != null ? D[k] : DEFAULTS[k];
    return out;
  }

  var root = document.documentElement;
  function makeCanvas(name) {
    var c = document.createElement("canvas");
    c.className = "dapple dapple--" + name;
    c.setAttribute("aria-hidden", "true");
    document.body.prepend(c);
    return c;
  }
  var layers = [
    { key: "soft", canvas: makeCanvas("soft") },
    { key: "sharp", canvas: makeCanvas("sharp") }        // later in the DOM = on top
  ];
  layers.forEach(function (L) { L.ctx = L.canvas.getContext("2d"); });
  if (!layers[0].ctx) return;

  var seed;
  function rand() {      // the same arrangement on every visit (per seed)
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  // smooth noise in −1…1: three slow waves that never quite line up
  function noise(t, p) {
    return (Math.sin(t + p) + 0.6 * Math.sin(t * 1.73 + p * 2.1) + 0.3 * Math.sin(t * 2.97 + p * 3.7)) / 1.9;
  }
  function rgb(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255].join(", ");
  }

  var dark = false, last = 0;
  function layout() {
    seed = S.seed;
    layers.forEach(function (L) {
      var n = S[L.key + "Count"];
      L.bands = [];
      for (var i = 0; i < n; i++) {
        L.bands.push({
          x: rand() * 1.2 - 0.1, y: rand() * 1.2 - 0.1,
          len: 0.6 + rand() * 0.8, wid: 0.6 + rand() * 0.8,
          shadow: rand() < S.shadowShare,
          p: rand() * 100
        });
      }
    });
  }
  function resize() {
    layers.forEach(function (L) {
      var s = Math.max(1, S[L.key + "Softness"]);
      L.W = Math.max(16, Math.ceil(innerWidth / s));
      L.H = Math.max(16, Math.ceil(innerHeight / s));
      L.canvas.width = L.W; L.canvas.height = L.H;
    });
    draw(last);
  }
  function readTheme() {
    dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  }

  function draw(time) {
    var t = time / 1000 * S.speed;
    var mode = dark ? "dark" : "light";
    var shadowCol = rgb(S[mode + "Shadow"]), lightCol = rgb(S[mode + "Light"]);
    var shadowA = S[mode + "ShadowStrength"], lightA = S[mode + "LightStrength"];
    var base = S.angle * Math.PI / 180;

    layers.forEach(function (L) {
      var ctx = L.ctx, W = L.W, H = L.H;
      var hard = Math.min(0.95, Math.max(0, S[L.key + "Hardness"]));
      var strength = S[L.key + "Strength"];
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < L.bands.length; i++) {
        var b = L.bands[i];
        var a = base + S.twist * Math.PI / 180 * noise(t * 0.7, b.p + 4);
        var along = S.drift * noise(t, b.p), across = S.wobble * noise(t * 1.3, b.p + 8);
        var x = (b.x + Math.cos(a) * along - Math.sin(a) * across) * W;
        var y = b.y * H + (Math.sin(a) * along + Math.cos(a) * across) * W;
        var len = S[L.key + "Length"] * b.len * W * (1 + S.stretch * noise(t * 0.9, b.p + 2));
        var wid = Math.max(0.5, S[L.key + "Width"] * b.wid * W);
        var vis = 1 - S.fade * (0.5 + 0.5 * noise(t * 0.6, b.p + 6));    // fades in and out
        var alpha = (b.shadow ? shadowA : lightA) * strength * vis;
        if (alpha <= 0.001) continue;
        var col = b.shadow ? shadowCol : lightCol;

        ctx.save();
        ctx.translate(x, y); ctx.rotate(a); ctx.scale(len / 2, wid / 2);   // a unit circle, stretched into a band
        var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, "rgba(" + col + ", " + alpha + ")");
        g.addColorStop(hard, "rgba(" + col + ", " + alpha * 0.85 + ")");
        g.addColorStop(1, "rgba(" + col + ", 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    });
  }

  function build() { S = readSettings(); layout(); readTheme(); resize(); }
  build();

  new MutationObserver(function () { readTheme(); draw(last); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readTheme(); draw(last); });
  var resizeTimer;
  addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  function loop(time) {
    if (!still.matches && time - last >= 1000 / S.fps) { last = time; draw(time); }
    requestAnimationFrame(loop);      // the browser pauses this in hidden tabs
  }
  requestAnimationFrame(loop);

  // for the tuning page: change settings live
  window.__dapple = {
    set: function (o) { window.DAPPLE = Object.assign(window.DAPPLE || {}, o); build(); },
    get: function () { return Object.assign({}, S); },
    defaults: DEFAULTS
  };
})();
