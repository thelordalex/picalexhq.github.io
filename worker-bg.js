/* Picalex HQ - worker-bg.js (round 3: general heavy pixel work, no AI, no network)
   Jobs:
     { id, type:'grade', w, h, rgba, e, o, curves, bwTone }  -> { id, type:'graded', rgba }
       The full colour grade (adjust LUT, white balance, curves, saturation, split toning,
       tonal contrast, B&W mix, vignette, clarity, structure, sharpening) on one RGBA buffer.
     { id, type:'analyze', w, h, rgba }                      -> { id, type:'stats', stats }
       Histogram / skin / sky statistics that drive the adaptive Looks and the Smart pick.
   Everything runs locally; this worker makes no network requests. */
'use strict';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function blurH(s, t, w, h, r) {
  const div = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = s[row] * r;
    for (let i = 0; i <= r; i++) acc += s[row + (i < w ? i : w - 1)];
    for (let x = 0; x < w; x++) {
      t[row + x] = (acc / div + 0.5) | 0;
      const a = x + r + 1, b = x - r;
      acc += s[row + (a < w ? a : w - 1)] - s[row + (b > 0 ? b : 0)];
    }
  }
}
function blurV(s, t, w, h, r) {
  const div = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let acc = s[x] * r;
    for (let i = 0; i <= r; i++) acc += s[(i < h ? i : h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      t[y * w + x] = (acc / div + 0.5) | 0;
      const a = y + r + 1, b = y - r;
      acc += s[(a < h ? a : h - 1) * w + x] - s[(b > 0 ? b : 0) * w + x];
    }
  }
}
function blurLumR(src, w, h, rr) {
  const b = new Uint8Array(src.length), c = new Uint8Array(src.length);
  blurH(src, b, w, h, rr); blurV(b, c, w, h, rr);
  blurH(c, b, w, h, rr); blurV(b, c, w, h, rr);
  return c;
}
function sharpen(d, w, h, amount) {
  const rl = w * 4;
  let prev = new Uint8ClampedArray(rl), cur = new Uint8ClampedArray(rl);
  prev.set(d.subarray(0, rl));
  for (let y = 0; y < h; y++) {
    const yo = y * rl;
    cur.set(d.subarray(yo, yo + rl));
    const last = y === h - 1, nx = last ? cur : d, no = last ? 0 : yo + rl;
    for (let x = 0; x < w; x++) {
      const i = x * 4, xl = (x > 0 ? x - 1 : x) * 4, xr = (x < w - 1 ? x + 1 : x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur = (prev[xl + c] + 2 * prev[i + c] + prev[xr + c]
          + 2 * (cur[xl + c] + 2 * cur[i + c] + cur[xr + c])
          + nx[no + xl + c] + 2 * nx[no + i + c] + nx[no + xr + c]) / 16;
        d[yo + i + c] = cur[i + c] + amount * (cur[i + c] - blur);
      }
    }
    const t = prev; prev = cur; cur = t;
  }
}

function curLut(pts) {
  if (!pts || pts.length < 2) return null;
  const p = pts.slice().sort((a, b) => a[0] - b[0]);
  if (p[0][0] > 0) p.unshift([0, p[0][1]]);
  if (p[p.length - 1][0] < 1) p.push([1, p[p.length - 1][1]]);
  const n = p.length, xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  const dx = [], sl = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); sl.push((ys[i + 1] - ys[i]) / (dx[i] || 1e-6)); }
  const t = [sl[0]];
  for (let i = 1; i < n - 1; i++) t.push(sl[i - 1] * sl[i] <= 0 ? 0 : 2 / (1 / sl[i - 1] + 1 / sl[i]));
  t.push(sl[n - 2]);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 255; let j = 0;
    while (j < n - 2 && x > xs[j + 1]) j++;
    const h = dx[j] || 1e-6, u = clamp((x - xs[j]) / h, 0, 1);
    const y = ys[j] * (2 * u ** 3 - 3 * u ** 2 + 1) + h * t[j] * (u ** 3 - 2 * u ** 2 + u)
            + ys[j + 1] * (-2 * u ** 3 + 3 * u ** 2) + h * t[j + 1] * (u ** 3 - u ** 2);
    lut[i] = clamp(Math.round(y * 255), 0, 255);
  }
  return lut;
}
function adjLut(e, m) {
  const lut = new Uint8ClampedArray(256);
  const cf = 1 + e.c / 80, add = e.b * 1.7 / 255, K = 0.12 * 27 / 4;
  for (let i = 0; i < 256; i++) {
    let x = i / 255;
    x += e.lift * K * (m || 1) * x * (1 - x) * (1 - x);
    x -= e.hl * K * (m || 1) * x * x * (1 - x);
    x = (x - 0.5) * cf + 0.5 + add;
    if (e.fade) x = e.fade + x * (1 - e.fade);
    lut[i] = Math.round(x * 255);
  }
  return lut;
}

/* pass 1: the classic adjustments — identical math to process() in script.js */
function gradeA(d, w, h, e) {
  const N = w * h, lut = adjLut(e);
  let lum = null, blur = null;
  if (e.clarity > 0.01) {
    lum = new Uint8Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 4) lum[p] = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
    blur = blurLumR(lum, w, h, Math.max(2, Math.round(Math.max(w, h) * .02)));
  }
  const sf = 1 + e.s / 100;
  const tr = e.temp, tg = e.temp * .25, tb = -e.temp;
  const sp = e.split, vig = e.vig;
  const cx = w / 2, cy = h / 2, vr = e.vigR || 1, inv = 1 / (cx * cx + cy * cy) / (vr * vr);
  for (let y = 0, p = 0, i = 0; y < h; y++) {
    const dy = y - cy, dy2 = dy * dy;
    for (let x = 0; x < w; x++, p++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (lum) {
        const dl = (lum[p] - blur[p]) * e.clarity;
        r += dl; g += dl; b += dl;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      }
      r = lut[r | 0]; g = lut[g | 0]; b = lut[b | 0];
      if (sf !== 1) { const l = r * .2126 + g * .7152 + b * .0722; r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf; }
      if (sp) { const l = (r * .2126 + g * .7152 + b * .0722) / 255, wl = 1 - l;
        r += sp.sh[0] * wl + sp.hi[0] * l; g += sp.sh[1] * wl + sp.hi[1] * l; b += sp.sh[2] * wl + sp.hi[2] * l; }
      if (tr) { r += tr; g += tg; b += tb; }
      if (vig) { const dx = x - cx, v = 1 - vig * ((dx * dx + dy2) * inv); r *= v; g *= v; b *= v; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  const amt = clamp(e.sharp, 0, 140) / 100 * .9;
  if (amt > 0.02) sharpen(d, w, h, amt);
}

/* pass 2: round-3 colour layer — identical math to px3color() in script.js */
function gradeB(d, w, h, o, curves, bwTone) {
  const N = w * h;
  const clut = curLut(curves);
  const lut = adjLut(o, 4);
  const gr = 1 + o.temp / 240, gg = 1 + o.tint / 220, gb = 1 - o.temp / 240;
  const sf = 1 + o.s / 100;
  let lumC = null, lumS = null;
  if (o.clar > 0.01 || o.struct > 0.01) {
    const lum = new Uint8Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 4) lum[p] = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
    if (o.clar > 0.01) lumC = [lum, blurLumR(lum, w, h, Math.max(2, Math.round(Math.max(w, h) * .02)))];
    if (o.struct > 0.01) lumS = [lum, blurLumR(lum, w, h, Math.max(1, Math.round(Math.max(w, h) * .008)))];
  }
  const sp = o.split, tc = o.tc;
  const bwt = o.bw ? ({ neu: [1, 1, 1], red: [1.5, .6, .4], org: [1.3, .9, .3], yel: [1.1, 1.1, .3], grn: [.6, 1.3, .5], blu: [.5, .8, 1.5] })[bwTone] || [1, 1, 1] : null;
  const cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy), vig = o.vig;
  for (let y = 0, p = 0, i = 0; y < h; y++) {
    const dy = y - cy, dy2 = dy * dy;
    for (let x = 0; x < w; x++, p++, i += 4) {
      let r = d[i] * gr, g = d[i + 1] * gg, b = d[i + 2] * gb;
      if (lumC) { const dl = (lumC[0][p] - lumC[1][p]) * o.clar; r += dl; g += dl; b += dl; }
      if (lumS) { const dl = (lumS[0][p] - lumS[1][p]) * o.struct; r += dl; g += dl; b += dl; }
      r = lut[r < 0 ? 0 : r > 255 ? 255 : r | 0]; g = lut[g < 0 ? 0 : g > 255 ? 255 : g | 0]; b = lut[b < 0 ? 0 : b > 255 ? 255 : b | 0];
      if (clut) { r = clut[r]; g = clut[g]; b = clut[b]; }
      if (sf !== 1) { const l = r * .2126 + g * .7152 + b * .0722; r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf; }
      if (sp) { const l = (r * .2126 + g * .7152 + b * .0722) / 255, wl = 1 - l;
        r += sp.sh[0] * wl + sp.hi[0] * l; g += sp.sh[1] * wl + sp.hi[1] * l; b += sp.sh[2] * wl + sp.hi[2] * l; }
      if (tc) { const l = (r * .2126 + g * .7152 + b * .0722) / 255;
        const ws = clamp(1 - l / .35, 0, 1), wh = clamp((l - .65) / .35, 0, 1), wm = clamp(1 - ws - wh, 0, 1);
        const dl = (l - .5) * (tc[0] * ws + tc[1] * wm + tc[2] * wh) / 100 * .8;
        r += dl * 255; g += dl * 255; b += dl * 255; }
      if (bwt) { const l = clamp(r * .2126 * bwt[0] + g * .7152 * bwt[1] + b * .0722 * bwt[2], 0, 255);
        r += (l - r) * o.bw; g += (l - g) * o.bw; b += (l - b) * o.bw; }
      if (vig) { const dx = x - cx, v = 1 - vig * ((dx * dx + dy2) * inv); r *= v; g *= v; b *= v; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  const amt = clamp(o.sharp, 0, 140) / 100 * .9;
  if (amt > 0.02) sharpen(d, w, h, amt);
}

/* photo statistics for the adaptive Looks and the Smart pick — same formulas as analyze() in script.js */
function analyzeBuf(d, w, h) {
  const N = w * h;
  let sl = 0, sl2 = 0, sr = 0, sg = 0, sb = 0, sSat = 0;
  let skin = 0, skinTop = 0, topN = 0, sky = 0, dark = 0, hi = 0, warmN = 0;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const l = r * .2126 + g * .7152 + b * .0722;
    sl += l; sl2 += l * l; sr += r; sg += g; sb += b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    sSat += sat;
    if (l < 52) dark++; if (l > 208) hi++;
    if (r > 70 && r > b + 8 && r >= g - 6 && g > b - 12 && (r - mn) > 8 && sat > .08 && sat < .75 && l > 45 && l < 235) { skin++; if (y < h * .62) skinTop++; }
    if (y < h * .45) { topN++; if (b > r + 6 && b > 70 && sat < .6) sky++; }
    if (xx > w * .25 && xx < w * .75 && y > h * .3 && y < h * .85 && r > g && g >= b && sat > .3) warmN++;
  }
  const mean = sl / N, varr = Math.max(0, sl2 / N - mean * mean);
  return {
    mean: mean / 255, contrast: Math.sqrt(varr) / 128,
    cast: [(sr / N - mean) / 128, (sg / N - mean) / 128, (sb / N - mean) / 128],
    sat: sSat / N, dark: dark / N, hi: hi / N,
    skin: skin / N, skinTop: skinTop / (topN || 1), sky: sky / (topN || 1), warmCenter: warmN / N
  };
}

self.onmessage = ev => {
  const m = ev.data;
  try {
    if (m.type === 'grade') {
      const d = new Uint8ClampedArray(m.rgba);
      gradeA(d, m.w, m.h, m.e);
      gradeB(d, m.w, m.h, m.o, m.curves, m.bwTone);
      self.postMessage({ id: m.id, type: 'graded', rgba: d.buffer }, [d.buffer]);
    } else if (m.type === 'analyze') {
      const stats = analyzeBuf(new Uint8ClampedArray(m.rgba), m.w, m.h);
      self.postMessage({ id: m.id, type: 'stats', stats });
    }
  } catch (err) {
    self.postMessage({ id: m.id, type: 'error', message: String(err && err.message || err) });
  }
};
