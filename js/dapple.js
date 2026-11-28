/* Dappled light: light falling through leaves onto the page.
   Loaded by main.js (DAPPLE.on). Remove this file and that line to drop it.
   Tune it live on _drafts/dapple.html.

   The model: each layer is a faint sheet of shadow with patches of light
   cut out of it (and lightly tinted). Patches are ragged: a few overlapping
   stretched ovals along the light's angle. They group into clumps, like
   gaps in a canopy: a clump sways as one; each patch flutters, slides,
   stretches and fades on smooth noise.
   Two layers: a soft one (big blurry patches) under a crisp one (small
   streaks). Each is a small canvas (1/blur of the screen) stretched to
   fill it, which blurs it for free; no blur filters.

   The shadows live on the page like a huge wall: they're laid out down the
   whole page, one screen-tall tile at a time (each tile from the seed, so
   a spot always gets the same shadows), and the canvases sit in the page
   and scroll with it natively. Each redraw re-centres them on the view.
   Still for Reduce Motion; pauses in hidden tabs. */
(function () {
  var DEFAULTS = {
    angle: -40,                   // direction the patches lean, degrees

    // colours. Shadow strength = how dark the shaded wall is;
    // light tint = how much the light patches are coloured.
    lightShadow: "#6b665f", lightShadowStrength: 0.11,
    lightLight: "#fffaf0",  lightLightStrength: 0.5,
    darkShadow: "#000000",  darkShadowStrength: 0.3,
    darkLight: "#ffe2b8",   darkLightStrength: 0.06,

    // movement
    speed: 0.28,                  // overall pace (0 = still)
    drift: 0.035,                 // clumps sway along the angle (share of the width)
    wobble: 0.012,                // …and across it
    flutter: 0.012,               // single patches move on their own
    twist: 4,                     // angle wobble, degrees
    stretch: 0.3,                 // patches lengthen and shorten
    fade: 0.6,                    // patches fade in and out (0 = steady)
    fps: 30,

    ragged: 3,                    // ovals per patch (1 = smooth ellipses, more = more irregular)

    // soft layer, underneath: big blurry patches. Counts are per screen of page.
    softCount: 12, softPieces: 5, softSpread: 0.2, softLength: 0.26, softWidth: 0.12,
    softSoftness: 14, softHardness: 0.15, softStrength: 0.6,
    // crisp layer, on top: small streaks
    sharpCount: 24, sharpPieces: 9, sharpSpread: 0.16, sharpLength: 0.11, sharpWidth: 0.034,
    sharpSoftness: 3, sharpHardness: 0.4, sharpStrength: 0.45,

    seed: 11                      // arrangement; change for a different one
  };
  var MARGIN = 0.25;              // canvas reaches this many screens above and below the view
  var S;
  function readSettings() {
    var D = window.DAPPLE || {}, out = {};
    for (var k in DEFAULTS) out[k] = D[k] != null ? D[k] : DEFAULTS[k];
    return out;
  }

  var root = document.documentElement;
  // a box the size of the whole page, behind everything; the canvases slide inside it
  var wall = document.createElement("div");
  wall.className = "dapple";
  wall.setAttribute("aria-hidden", "true");
  document.body.prepend(wall);
  var layers = ["soft", "sharp"].map(function (key) {      // soft first, crisp on top
    var c = document.createElement("canvas");
    wall.append(c);
    return { key: key, canvas: c, ctx: c.getContext("2d"), tiles: {} };
  });
  if (!layers[0].ctx) return;

  var seed;
  function rand() {
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

  // the clumps for one screen-tall tile of the wall (made once, then kept)
  function tile(L, i) {
    if (L.tiles[i]) return L.tiles[i];
    var k = L.key, rag = Math.max(1, Math.round(S.ragged)), clumps = [];
    seed = S.seed * 1000003 + i * 7919 + (k === "soft" ? 0 : 104729);
    for (var n = 0; n < S[k + "Count"]; n++) {
      var c = { x: rand() * 1.2 - 0.1, y: i + rand(), p: rand() * 100, patches: [] };
      for (var j = 0; j < S[k + "Pieces"]; j++) {
        var a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * S[k + "Spread"];
        var patch = { dx: Math.cos(a) * d, dy: Math.sin(a) * d, size: 0.55 + rand() * 0.9, p: rand() * 100, ovals: [] };
        for (var o = 0; o < rag; o++) {             // ragged: ovals strung along the patch, varied
          patch.ovals.push({
            along: rag > 1 ? (o / (rag - 1) - 0.5) * 0.7 + (rand() - 0.5) * 0.2 : 0,
            across: (rand() - 0.5) * 0.5,
            len: 0.45 + rand() * 0.55, wid: 0.55 + rand() * 0.7
          });
        }
        c.patches.push(patch);
      }
      clumps.push(c);
    }
    return (L.tiles[i] = clumps);
  }

  // one soft oval, drawn once per layer and colour, then stamped (cheap) at any size and angle
  var SPRITE = 64;
  function sprite(hard, col) {
    var c = document.createElement("canvas"); c.width = c.height = SPRITE;
    var x = c.getContext("2d"), r = SPRITE / 2;
    var g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(" + col + ", 1)");
    g.addColorStop(hard, "rgba(" + col + ", 0.9)");
    g.addColorStop(1, "rgba(" + col + ", 0)");
    x.fillStyle = g; x.fillRect(0, 0, SPRITE, SPRITE);
    return c;
  }
  function stamp(ctx, img, x, y, a, len, wid, alpha) {
    var sx = Math.max(0.3, len) / SPRITE, sy = Math.max(0.3, wid) / SPRITE, cos = Math.cos(a), sin = Math.sin(a);
    ctx.globalAlpha = alpha;
    ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, x, y);
    ctx.drawImage(img, -SPRITE / 2, -SPRITE / 2);
  }

  var dark = false, last = 0, vw = 0, vh = 0, pageH = 0, top = 0, span = 0;
  function readTheme() {
    dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    var mode = dark ? "dark" : "light";
    layers.forEach(function (L) {
      var hard = Math.min(0.95, Math.max(0, S[L.key + "Hardness"]));
      L.cut = sprite(hard, "0, 0, 0");
      L.tint = sprite(hard, rgb(S[mode + "Light"]));
    });
  }
  function measure() {
    wall.style.height = "0";                       // so the wall itself doesn't count
    pageH = Math.max(document.documentElement.scrollHeight, innerHeight);
    wall.style.height = pageH + "px";
    vw = document.documentElement.clientWidth; vh = innerHeight;
    span = Math.min(pageH, Math.round(vh * (1 + 2 * MARGIN)));     // drawn height, page px
    layers.forEach(function (L) {
      var s = Math.max(1, S[L.key + "Softness"]);
      L.s = s;
      L.canvas.width = Math.max(16, Math.ceil(vw / s));
      L.canvas.height = Math.max(16, Math.ceil(span / s));
      L.canvas.style.height = span + "px";
    });
    draw(last);
  }

  function draw(time) {
    top = Math.max(0, Math.min(pageH - span, scrollY - vh * MARGIN));   // re-centre on the view
    var t = time / 1000 * S.speed;
    var mode = dark ? "dark" : "light";
    var shadowCol = rgb(S[mode + "Shadow"]);
    var shadowA = S[mode + "ShadowStrength"], lightA = S[mode + "LightStrength"];
    var base = S.angle * Math.PI / 180;

    layers.forEach(function (L) {
      var ctx = L.ctx, k = L.key, s = L.s, W = L.canvas.width, H = L.canvas.height;
      L.canvas.style.transform = "translateY(" + top + "px)";
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(" + shadowCol + ", " + shadowA * S[k + "Strength"] + ")";   // the shaded wall
      ctx.fillRect(0, 0, W, H);

      // clumps near the drawn part, from the tiles it overlaps (plus a little either side)
      var reach = (S[k + "Spread"] + S[k + "Length"] * 1.5 + S.drift) * vw;
      var first = Math.floor((top - reach) / vh), lastTile = Math.floor((top + span + reach) / vh);
      var shapes = [];
      for (var ti = first; ti <= lastTile; ti++) {
        var clumps = tile(L, ti);
        for (var i = 0; i < clumps.length; i++) {
          var c = clumps[i];
          var py0 = c.y * vh;                                    // page px
          if (py0 < top - reach || py0 > top + span + reach) continue;
          var ca = base + S.twist * Math.PI / 180 * noise(t * 0.6, c.p + 4);
          var along = S.drift * noise(t, c.p), across = S.wobble * noise(t * 1.3, c.p + 8);
          var cx = c.x * vw + (Math.cos(ca) * along - Math.sin(ca) * across) * vw;
          var cy = py0 + (Math.sin(ca) * along + Math.cos(ca) * across) * vw;
          for (var j = 0; j < c.patches.length; j++) {
            var p = c.patches[j];
            var vis = 1 - S.fade * (0.5 + 0.5 * noise(t * 0.7, p.p + 6));
            if (vis <= 0.01) continue;
            var pa = ca + S.twist * 0.5 * Math.PI / 180 * noise(t * 1.1, p.p + 1);
            var px = cx + (p.dx + S.flutter * noise(t * 1.9, p.p)) * vw;
            var py = cy + (p.dy + S.flutter * noise(t * 1.7, p.p + 5)) * vw;
            var len = S[k + "Length"] * p.size * vw * (1 + S.stretch * noise(t * 0.9, p.p + 2));
            var wid = S[k + "Width"] * p.size * vw;
            for (var o = 0; o < p.ovals.length; o++) {
              var ov = p.ovals[o];
              shapes.push([
                (px + Math.cos(pa) * ov.along * len - Math.sin(pa) * ov.across * wid) / s,
                (py + Math.sin(pa) * ov.along * len + Math.cos(pa) * ov.across * wid - top) / s,
                pa, len * ov.len / s, wid * ov.wid / s, vis
              ]);
            }
          }
        }
      }
      ctx.globalCompositeOperation = "destination-out";          // cut the light out of the shadow
      for (var q = 0; q < shapes.length; q++) { var z = shapes[q]; stamp(ctx, L.cut, z[0], z[1], z[2], z[3], z[4], z[5]); }
      if (lightA > 0) {
        ctx.globalCompositeOperation = "source-over";            // and warm it a little
        var la = lightA * S[k + "Strength"];
        for (q = 0; q < shapes.length; q++) { z = shapes[q]; stamp(ctx, L.tint, z[0], z[1], z[2], z[3], z[4], la * z[5]); }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    });
  }

  function build() {
    S = readSettings();
    layers.forEach(function (L) { L.tiles = {}; });
    readTheme(); measure();
  }
  build();

  new MutationObserver(function () { readTheme(); draw(last); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readTheme(); draw(last); });
  var resizeTimer;
  function later() { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); }
  addEventListener("resize", later);
  addEventListener("load", later);                               // images change the page length
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);

  var still = matchMedia("(prefers-reduced-motion: reduce)"), cost = 0;
  function loop(time) {
    var due = time - last >= 1000 / S.fps;
    var offView = scrollY < top || scrollY + vh > top + span;      // scrolled past the drawn part
    if ((due && !still.matches) || offView) {
      if (due) last = time;
      var t0 = performance.now(); draw(still.matches ? last : time);
      cost = cost * 0.9 + (performance.now() - t0) * 0.1;        // average ms per frame, for the tuning page
    }
    requestAnimationFrame(loop);      // the browser pauses this in hidden tabs
  }
  requestAnimationFrame(loop);

  // for the tuning page: change settings live
  window.__dapple = {
    set: function (o) { window.DAPPLE = Object.assign(window.DAPPLE || {}, o); build(); },
    get: function () { return Object.assign({}, S); },
    cost: function () { return { msPerFrame: cost, msPerSecond: cost * S.fps }; },
    defaults: DEFAULTS
  };
})();
