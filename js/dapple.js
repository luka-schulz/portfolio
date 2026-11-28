/* Dappled light: soft leaf shadows drifting on the page background.
   Loaded by main.js (DAPPLE.on). Remove this file and that line to drop it.

   How it stays light: everything is drawn on a tiny canvas (1/scale of the
   screen) and stretched to fill it, which blurs it for free. Each leaf
   cluster is a few soft circles (radial gradients, no blur filters), moved
   by smooth noise. Light mode: faint shadows. Dark mode: faint light.
   Still for Reduce Motion; pauses when the tab is hidden. */
(function () {
  var D = window.DAPPLE || {};
  var S = {
    scale: D.scale || 8,                  // canvas = screen ÷ this (higher = softer, cheaper)
    clusters: D.clusters || 9,            // leaf clusters
    leaves: D.leaves || 7,                // soft circles per cluster
    size: D.size || 0.07,                 // leaf size, as a share of the screen width
    spread: D.spread || 0.12,             // how far a cluster's leaves spread
    lightOpacity: D.lightOpacity != null ? D.lightOpacity : 0.05,   // light mode: shadow strength
    darkOpacity: D.darkOpacity != null ? D.darkOpacity : 0.06,      // dark mode: light strength
    darkColor: D.darkColor || "255, 236, 205",                      // dark mode: warm light (r, g, b)
    sway: D.sway != null ? D.sway : 0.025,       // how far clusters drift (share of the width)
    flutter: D.flutter != null ? D.flutter : 0.008, // how far single leaves flutter
    speed: D.speed != null ? D.speed : 0.12,     // how fast it all moves
    fps: D.fps || 20,
    seed: D.seed || 7
  };

  var root = document.documentElement;
  var canvas = document.createElement("canvas");
  canvas.className = "dapple";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  // the same layout on every visit
  var seed = S.seed;
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

  var clusters = [];
  for (var i = 0; i < S.clusters; i++) {
    var c = { x: rand() * 1.1 - 0.05, y: rand() * 1.1 - 0.05, p: rand() * 100, leaves: [] };
    for (var j = 0; j < S.leaves; j++) {
      var a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * S.spread;
      c.leaves.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: S.size * (0.5 + rand() * 0.8), p: rand() * 100 });
    }
    clusters.push(c);
  }

  var W = 0, H = 0, colour = "0, 0, 0";
  function resize() {
    W = Math.max(16, Math.ceil(innerWidth / S.scale));
    H = Math.max(16, Math.ceil(innerHeight / S.scale));
    canvas.width = W; canvas.height = H;
    draw(last);
  }
  function readTheme() {
    var dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    colour = dark ? S.darkColor : "0, 0, 0";
    canvas.style.opacity = dark ? S.darkOpacity : S.lightOpacity;
  }

  var last = 0;
  function draw(time) {
    var t = time / 1000 * S.speed;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i];
      var cx = (c.x + S.sway * noise(t, c.p)) * W;
      var cy = c.y * H + S.sway * noise(t * 0.8, c.p + 9) * W;
      for (var j = 0; j < c.leaves.length; j++) {
        var l = c.leaves[j];
        var x = cx + (l.dx + S.flutter * noise(t * 2.3, l.p)) * W;
        var y = cy + (l.dy + S.flutter * noise(t * 2.1, l.p + 5)) * W;
        var r = l.r * W * (1 + 0.12 * noise(t * 1.4, l.p + 3));
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + colour + ", 1)");
        g.addColorStop(0.45, "rgba(" + colour + ", 0.75)");
        g.addColorStop(1, "rgba(" + colour + ", 0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  readTheme();
  resize();
  new MutationObserver(function () { readTheme(); draw(last); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { readTheme(); draw(last); });
  var resizeTimer;
  addEventListener("resize", function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var frameMs = 1000 / S.fps;
  function loop(time) {
    if (!still.matches && time - last >= frameMs) { last = time; draw(time); }
    requestAnimationFrame(loop);      // the browser pauses this in hidden tabs
  }
  requestAnimationFrame(loop);
})();
