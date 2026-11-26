/* extras2.js: Y2K / CCD / Digicam effects for Picalex HQ. Uses the PX toolkit from script.js, no AI, offline. */
(function () {
'use strict';
if (!window.PX) return;
const P = window.PX;
const scratch = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* chromatic fringing: red and blue pushed apart, stronger toward the edges (cheap lens look) */
const FR = a => (x, w, h) => {
  const im = x.getImageData(0, 0, w, h), d = im.data, o = new Uint8ClampedArray(d), cx = w / 2, cy = h / 2, mx = Math.hypot(cx, cy), s = a * w / 1080;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const dx = X - cx, dy = y - cy, k = Math.hypot(dx, dy) / mx, sh = s * (.25 + k * 1.6), ux = dx / (mx || 1), uy = dy / (mx || 1);
    const rx = clamp(Math.round(X - ux * sh * 3), 0, w - 1), ry = clamp(Math.round(y - uy * sh * 3), 0, h - 1);
    const bx = clamp(Math.round(X + ux * sh * 3), 0, w - 1), by = clamp(Math.round(y + uy * sh * 3), 0, h - 1);
    const i = (y * w + X) * 4;
    d[i] = o[(ry * w + rx) * 4]; d[i + 2] = o[(by * w + bx) * 4 + 2];
  }
  x.putImageData(im, 0, 0);
};
/* low resolution: draw small and scale back up (soft sensor) or nearest (blocky) */
const LR = (div, blocky, amt) => (x, w, h) => {
  const s = scratch(Math.round(w / div), Math.round(h / div)), sx = s.getContext('2d');
  sx.imageSmoothingEnabled = true; sx.drawImage(x.canvas, 0, 0, s.width, s.height);
  x.save(); x.globalAlpha = amt == null ? 1 : amt; x.imageSmoothingEnabled = !blocky; x.imageSmoothingQuality = 'high';
  x.drawImage(s, 0, 0, w, h); x.restore();
};
/* scanlines */
const SL = (a, gap) => (x, w, h) => {
  const g = Math.max(2, Math.round(gap * w / 1080));
  x.save(); x.fillStyle = 'rgba(0,0,0,' + a + ')';
  for (let y = 0; y < h; y += g) x.fillRect(0, y, w, Math.max(1, g / 2));
  x.restore();
};
/* flash hot spot: bright centre, falloff to dark corners, like a compact camera flash */
const FH = (hot, dark) => (x, w, h) => {
  const R = Math.max(w, h);
  x.save(); x.globalCompositeOperation = 'screen';
  let g = x.createRadialGradient(w / 2, h * .46, 0, w / 2, h * .46, R * .55);
  g.addColorStop(0, 'rgba(255,248,235,' + hot + ')'); g.addColorStop(1, 'rgba(255,248,235,0)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'multiply';
  g = x.createRadialGradient(w / 2, h / 2, R * .2, w / 2, h / 2, R * .8);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(' + Math.round(255 * (1 - dark)) + ',' + Math.round(255 * (1 - dark)) + ',' + Math.round(255 * (1 - dark * .9)) + ',1)');
  x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
};
/* blown highlights: push light areas to white with a soft knee */
const BH = k => (x, w, h) => {
  const im = x.getImageData(0, 0, w, h), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255, t = clamp((l - .55) / .45, 0, 1) * k;
    d[i] += (255 - d[i]) * t; d[i + 1] += (255 - d[i + 1]) * t; d[i + 2] += (255 - d[i + 2]) * t;
  }
  x.putImageData(im, 0, 0);
};
/* chroma noise: coloured speckle like a small sensor in the dark */
const CN = a => (x, w, h) => {
  const im = x.getImageData(0, 0, w, h), d = im.data;
  let s = 1234567; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < d.length; i += 4) {
    const l = 1 - (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) / 255, n = (r() - .5) * 90 * a * (.35 + l);
    d[i] += n * (.6 + r() * .8); d[i + 1] += (r() - .5) * 60 * a * (.35 + l); d[i + 2] += n * (.6 + r() * .8);
  }
  x.putImageData(im, 0, 0);
};
/* JPEG-ish 8px blocks */
const JB = a => (x, w, h) => LR(Math.max(6, w / 135), true, a)(x, w, h);
/* purple/magenta fringe on bright edges: a warm-cool split via offset screen copy */
const PF = a => (x, w, h) => {
  const c = scratch(w, h), cx = c.getContext('2d'); cx.drawImage(x.canvas, 0, 0);
  const o = Math.max(1, w * .002);
  x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = a * .5; x.drawImage(c, o * 2, 0); x.globalAlpha = a * .3; x.drawImage(c, -o, o); x.restore();
};
/* film-strip like date stamp, orange digits, bottom right */
const DS = col => P.TX(P.D2, 'right', .95, .95, col || '#ff9b2e', .04);
/* fixed pretend-date for a 2003 camera */
const DS03 = col => P.TX(() => "'03  11  26", 'right', .95, .95, col || '#ff9b2e', .04);

const A = (id, name, steps) => P.addEffect(id, name, steps);
const { CM, NZ, BL, VG, G, RG, T, ST, F } = P;

/* ---------- CCD / digicam ---------- */
A('dc-ccd-flash', 'CCD Flash', [CM({ c: .18, s: .15, b: .03 }), FH(.5, .45), BH(.55), FR(1.2), CN(.5), DS('#ff9b2e')]);
A('dc-ccd-night', 'CCD Night', [CM({ c: .25, s: .1, b: -.04, m: [1, .97, 1.08] }), FH(.35, .6), BH(.4), CN(.9), BL(.3), FR(1.5), DS('#ff9b2e')]);
A('dc-point-shoot', 'Point & Shoot', [CM({ c: .14, s: .18, b: .02 }), FH(.4, .35), BH(.4), LR(1.7, false, .6), FR(.8), NZ(.08), DS03('#ffae42')]);
A('dc-2003', 'Digicam 2003', [CM({ c: .2, s: .08, b: .05, m: [1.02, 1, .96] }), LR(2.4, false, .85), BH(.5), FR(1.4), CN(.45), T('#ffeedd', 'soft-light', .2), DS03('#ff8a1e')]);
A('dc-2005', 'Digicam 2005', [CM({ c: .12, s: .2, b: .02 }), LR(1.6, false, .6), FH(.3, .3), FR(.9), CN(.3), DS('#ff9b2e')]);
A('dc-low-mp', 'Low MP', [CM({ c: .18, s: .1 }), LR(3.2, false, 1), JB(.5), FR(1), CN(.4)]);
A('dc-blocky', 'Pixel Cam', [CM({ c: .22, s: .18 }), LR(6, true, 1), CN(.2)]);
A('dc-jpeg', 'Compressed', [CM({ c: .15, s: .06 }), JB(.8), CN(.3), BL(.1)]);
A('dc-sensor', 'Sensor Noise', [CM({ c: .1, s: .08 }), CN(1), NZ(.12)]);
A('dc-purple-fringe', 'Purple Fringe', [CM({ c: .16, s: .14 }), PF(1), FR(2.2), BH(.3), CN(.25)]);
A('dc-overexposed', 'Overexposed', [CM({ c: .05, s: -.05, b: .12 }), BH(.9), BL(.4), T('#fff1d6', 'soft-light', .35), CN(.2)]);
A('dc-flash-night', 'Night Flash', [CM({ c: .3, s: .12, b: -.08 }), FH(.65, .7), BH(.5), CN(.7), FR(1.2), DS('#ff9b2e')]);
A('dc-paparazzi', 'Hard Flash', [CM({ c: .35, s: .02, b: .04 }), FH(.8, .6), BH(.85), NZ(.1), CN(.3)]);
A('dc-compact-day', 'Compact Day', [CM({ c: .12, s: .26, b: .03, m: [1, 1.01, 1.04] }), LR(1.5, false, .5), FR(.7), BL(.15), DS('#ff9b2e')]);
A('dc-cam-warm', 'Camcorder Warm', [CM({ c: .1, s: .08, b: .02, m: [1.08, 1, .9] }), SL(.12, 4), CN(.5), FR(1.3), LR(2, false, .5), DS('#ffd36a')]);
A('dc-dv', 'DV Tape', [CM({ c: .12, s: -.06, m: [.98, 1.02, 1.04] }), SL(.18, 3), CN(.6), FR(1.5), LR(2.2, false, .7), P.TX(() => 'PLAY', 'left', .06, .08, '#e8fff0', .045)]);

/* ---------- Y2K ---------- */
A('y2-bubble', 'Y2K Bubblegum', [CM({ c: .12, s: .3, b: .05 }), G(['#ff9ad5', '#9ad7ff', '#ead7ff'], 'soft-light', .85, 60), BL(.5), BH(.3), ST(18, 2, ['#ffffff', '#ffd0f0', '#cfe8ff'], 21), NZ(.06)]);
A('y2-chrome', 'Chrome Y2K', [CM({ g: 1, c: .5 }), G(['#9fb4c8', '#ffffff', '#52657a', '#eaf2fa'], 'overlay', .9, 70), T('#6aa6ff', 'soft-light', .3), BL(.4), BH(.35)]);
A('y2-frost', 'Frosted Glass', [CM({ c: -.08, s: -.1, b: .1 }), T('#d6ecff', 'screen', .25), BL(.6), G(['rgba(255,255,255,.4)', 'rgba(255,255,255,0)'], 'screen', .8, 90), NZ(.05)]);
A('y2-silver', 'Silver Metal', [CM({ g: 1, c: .35, b: .06 }), T('#b8c9d8', 'overlay', .5), BH(.5), BL(.25), SL(.05, 3)]);
A('y2-sparkle', 'Glitter Sparkle', [CM({ c: .1, s: .22 }), BL(.35), ST(40, 2.6, ['#ffffff', '#fff2a0', '#ffc6f0', '#c6e6ff'], 5), NZ(.05)]);
A('y2-baby-blue', 'Baby Blue Pop', [CM({ c: .08, s: .15, b: .06, m: [.96, 1.01, 1.1] }), G(['rgba(150,210,255,.4)', 'rgba(255,255,255,0)'], 'screen', .8, 90), BL(.4), ST(14, 2, ['#ffffff', '#bfe6ff'], 8)]);
A('y2-hot-pink', 'Hot Pink Cam', [CM({ c: .2, s: .25, m: [1.1, .94, 1.02] }), T('#ff3fb0', 'soft-light', .35), FH(.3, .3), BL(.3), BH(.4), FR(1)]);
A('y2-cyber-lime', 'Acid Lime', [CM({ c: .25, s: .3, m: [.95, 1.1, .9] }), G(['#e6ff3a', '#3affd8'], 'overlay', .5, 40), BL(.2), FR(1.2)]);
A('y2-holo', 'Holo Foil', [CM({ c: .15, s: .2 }), G(['#ff6ad5', '#6adcff', '#c8ffb0', '#ffd86a', '#b46aff'], 'overlay', .6, 25), BL(.35), BH(.25), FR(1)]);
A('y2-mall', 'Mall Photobooth', [CM({ c: .2, s: .12, b: .04 }), FH(.45, .3), BH(.5), T('#ffe2c8', 'soft-light', .3), LR(1.8, false, .5), P.TX(() => 'PHOTO BOOTH', 'left', .08, .94, '#ffffff', .035)]);
A('y2-icon', 'Icon Glow', [CM({ c: .18, s: .35 }), BL(.7), G(['#3aa0ff', '#ff5ad0'], 'soft-light', .6, 120), VG(.2)]);
A('y2-lowfi-vhs', 'Lo-Fi Webcam', [CM({ c: .1, s: -.15, m: [.95, 1.04, 1.05] }), LR(3, false, 1), SL(.1, 3), CN(.8), FR(1.6), P.TX(() => 'REC', 'left', .06, .08, '#ff4a3a', .045)]);
})();
