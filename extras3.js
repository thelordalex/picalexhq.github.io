/* extras3.js: round 5 tools for Picalex HQ. Dehaze, Clarity & Texture, Whites & Blacks, Local Adjust brush.
   Uses the PX.addTool hook from script.js. Offline, no AI. Everything is sized from the image so preview and export match. */
(function () {
'use strict';
if (!window.PX || !PX.addTool || !PX.ui) return;
const U = PX.ui;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const S = { dehaze: 0, clarity: 0, texture: 0, whites: 0, blacks: 0, strokes: [] };
const resetS = () => { S.dehaze = S.clarity = S.texture = S.whites = S.blacks = 0; S.strokes = []; };

/* ---------- helpers ---------- */
/* separable box blur on a Float32Array plane, edge clamped, a few passes approximate a gaussian */
function boxBlur(a, w, h, r, passes) {
  r = Math.max(1, Math.round(r));
  const t = new Float32Array(a.length), d = 2 * r + 1;
  for (let p = 0; p < (passes || 2); p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let i = -r; i <= r; i++) acc += a[o + clamp(i, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        t[o + x] = acc / d;
        acc += a[o + Math.min(x + r + 1, w - 1)] - a[o + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += t[clamp(i, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / d;
        acc += t[Math.min(y + r + 1, h - 1) * w + x] - t[Math.max(y - r, 0) * w + x];
      }
    }
  }
  return a;
}
/* block-average a plane set down by an integer factor f */
function shrink(d, w, h, f, ch) {
  const sw = Math.max(1, Math.floor(w / f)), sh = Math.max(1, Math.floor(h / f)), out = [];
  for (let c = 0; c < ch.length; c++) out.push(new Float32Array(sw * sh));
  const n = f * f;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const acc = [0, 0, 0, 0];
    for (let j = 0; j < f; j++) {
      const row = Math.min(h - 1, y * f + j) * w;
      for (let i = 0; i < f; i++) {
        const p = (row + Math.min(w - 1, x * f + i)) * 4;
        if (ch.length === 1) acc[0] += d[p] * .2126 + d[p + 1] * .7152 + d[p + 2] * .0722;
        else { acc[0] += d[p]; acc[1] += d[p + 1]; acc[2] += d[p + 2]; }
      }
    }
    const k = y * sw + x;
    for (let c = 0; c < ch.length; c++) out[c][k] = acc[c] / n;
  }
  return { sw, sh, planes: out };
}
/* bilinear read of a small plane at full-res pixel (x, y) */
function samp(a, sw, sh, x, y, f) {
  const fx = clamp((x + .5) / f - .5, 0, sw - 1), fy = clamp((y + .5) / f - .5, 0, sh - 1);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const top = a[y0 * sw + x0] * (1 - tx) + a[y0 * sw + x1] * tx, bot = a[y1 * sw + x0] * (1 - tx) + a[y1 * sw + x1] * tx;
  return top * (1 - ty) + bot * ty;
}

/* ---------- Dehaze: dark channel prior, softened and scaled by the slider ---------- */
function dehaze(ctx, W, H, k) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const f = Math.max(1, Math.round(Math.max(W, H) / 360));
  const sm = shrink(d, W, H, f, [0, 1, 2]), sw = sm.sw, sh = sm.sh, R = sm.planes[0], G = sm.planes[1], B = sm.planes[2], n = sw * sh;
  /* atmospheric light: brightest pixels among the haziest 0.5% */
  const mn = new Float32Array(n);
  for (let i = 0; i < n; i++) mn[i] = Math.min(R[i], G[i], B[i]);
  const rd = Math.max(2, Math.round(.012 * Math.min(sw, sh)));
  const er = new Float32Array(n), tmp = new Float32Array(n);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 255; for (let i = -rd; i <= rd; i++) { const v = mn[y * sw + clamp(x + i, 0, sw - 1)]; if (v < m) m = v; } tmp[y * sw + x] = m; }
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 255; for (let j = -rd; j <= rd; j++) { const v = tmp[clamp(y + j, 0, sh - 1) * sw + x]; if (v < m) m = v; } er[y * sw + x] = m; }
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[clamp(er[i] | 0, 0, 255)]++;
  let cut = 255, cnt = 0; const need = Math.max(1, Math.round(n * .005));
  while (cut > 0 && cnt + hist[cut] < need) { cnt += hist[cut]; cut--; }
  let best = 0, bs = -1;
  for (let i = 0; i < n; i++) if (er[i] >= cut) { const s = R[i] + G[i] + B[i]; if (s > bs) { bs = s; best = i; } }
  const A = [clamp(R[best], 150, 255), clamp(G[best], 150, 255), clamp(B[best], 150, 255)];
  if (k < 0) {                                       /* add haze: mix toward the light colour, flatten contrast */
    const a = -k * .45;
    for (let i = 0; i < d.length; i += 4) { d[i] += (A[0] - d[i]) * a; d[i + 1] += (A[1] - d[i + 1]) * a; d[i + 2] += (A[2] - d[i + 2]) * a; }
    ctx.putImageData(img, 0, 0); return;
  }
  /* transmission from the dark channel of I / A */
  for (let i = 0; i < n; i++) mn[i] = Math.min(R[i] / A[0], G[i] / A[1], B[i] / A[2]);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 9; for (let i = -rd; i <= rd; i++) { const v = mn[y * sw + clamp(x + i, 0, sw - 1)]; if (v < m) m = v; } tmp[y * sw + x] = m; }
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 9; for (let j = -rd; j <= rd; j++) { const v = tmp[clamp(y + j, 0, sh - 1) * sw + x]; if (v < m) m = v; } er[y * sw + x] = m; }
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) t[i] = 1 - .88 * clamp(er[i], 0, 1);
  boxBlur(t, sw, sh, Math.max(2, rd * .8), 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tt = clamp(1 - (1 - samp(t, sw, sh, x, y, f)) * k, .35, 1), p = (y * W + x) * 4, inv = 1 / tt;
    d[p] = (d[p] - A[0]) * inv + A[0]; d[p + 1] = (d[p + 1] - A[1]) * inv + A[1]; d[p + 2] = (d[p + 2] - A[2]) * inv + A[2];
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- Clarity (mid-tone local contrast, wide radius) and Texture (fine detail, can smooth) ---------- */
function localContrast(ctx, W, H, kc, kt) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data, m = Math.min(W, H);
  if (kc) {
    const f = Math.max(1, Math.round(Math.max(W, H) / 700));
    const sm = shrink(d, W, H, f, [0]), sw = sm.sw, sh = sm.sh, Lb = sm.planes[0].slice();
    boxBlur(Lb, sw, sh, Math.max(2, .028 * Math.min(sw, sh)), 2);
    const g = kc * 1.3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4, l = d[p] * .2126 + d[p + 1] * .7152 + d[p + 2] * .0722, b = samp(Lb, sw, sh, x, y, f), bn = b / 255;
      const wgt = 4 * bn * (1 - bn), dl = clamp((l - b) * g * wgt, -60, 60);
      d[p] += dl; d[p + 1] += dl; d[p + 2] += dl;
    }
  }
  if (kt) {
    const f = Math.max(1, Math.ceil(Math.sqrt(W * H / 8e6)));
    const sm = shrink(d, W, H, f, [0]), sw = sm.sw, sh = sm.sh, Lb = sm.planes[0];
    boxBlur(Lb, sw, sh, Math.max(1, .0035 * m / f), 2);
    const g = kt * 1.6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4, l = d[p] * .2126 + d[p + 1] * .7152 + d[p + 2] * .0722, b = samp(Lb, sw, sh, x, y, f);
      const dl = clamp((l - b) * g, -50, 50);
      d[p] += dl; d[p + 1] += dl; d[p + 2] += dl;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- Whites and Blacks ---------- */
function whitesBlacks(ctx, W, H, kw, kb) {
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
    const wl = l * l * l, bl = (1 - l) * (1 - l) * (1 - l);
    const dl = kw * 55 * wl + kb * 55 * bl;
    d[i] += dl; d[i + 1] += dl; d[i + 2] += dl;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------- Local Adjust: painted, feathered strokes, each with its own adjustment ---------- */
const MODES = [['exp', 'Exposure'], ['con', 'Contrast'], ['sat', 'Saturation'], ['warm', 'Warmth'], ['clar', 'Clarity'], ['det', 'Sharpen / Soften']];
let lMode = 'exp', lSize = 10, lSoft = 60, lAmt = 40;

function strokeMask(s, W, H) {
  const m = Math.min(W, H), R = Math.max(3, s.size / 100 * m / 2), pad = R * (1 + s.soft / 100 * .8) + 2;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let j = 0; j < s.p.length; j += 2) {
    const x = s.p[j] * W, y = s.p[j + 1] * H;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(W, Math.ceil(x1 + pad)); y1 = Math.min(H, Math.ceil(y1 + pad));
  const rw = x1 - x0, rh = y1 - y0;
  if (rw < 2 || rh < 2) return null;
  const sc = Math.min(1, 360 / Math.max(rw, rh)), mw = Math.max(2, Math.round(rw * sc)), mh = Math.max(2, Math.round(rh * sc));
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const x = c.getContext('2d'), OFF = 4000;
  x.shadowColor = '#fff'; x.shadowOffsetX = OFF; x.shadowBlur = Math.max(0, s.soft / 100 * R * sc * 1.4);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
  x.lineWidth = Math.max(1, 2 * R * sc * (1 - s.soft / 100 * .35));
  x.beginPath();
  for (let j = 0; j < s.p.length; j += 2) {
    const px = (s.p[j] * W - x0) * sc - OFF, py = (s.p[j + 1] * H - y0) * sc;
    j ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  if (s.p.length === 2) { x.beginPath(); x.arc((s.p[0] * W - x0) * sc - OFF, (s.p[1] * H - y0) * sc, x.lineWidth / 2, 0, 6.2832); x.fill(); } else x.stroke();
  const a = x.getImageData(0, 0, mw, mh).data, al = new Float32Array(mw * mh);
  for (let i = 0; i < al.length; i++) al[i] = a[i * 4 + 3] / 255;
  return { x0, y0, rw, rh, sc, mw, mh, al };
}

function applyStroke(ctx, s, W, H) {
  const mk = strokeMask(s, W, H);
  if (!mk) return;
  const img = ctx.getImageData(mk.x0, mk.y0, mk.rw, mk.rh), d = img.data, rw = mk.rw, rh = mk.rh, k = s.amt / 100;
  let blur = null;
  if (s.mode === 'clar' || s.mode === 'det') {
    const m = Math.min(W, H), r = s.mode === 'clar' ? Math.max(2, .03 * m) : Math.max(1, .004 * m);
    const chs = s.mode === 'clar' ? 1 : 3;
    blur = [];
    for (let c = 0; c < chs; c++) {
      const pl = new Float32Array(rw * rh);
      for (let i = 0; i < pl.length; i++) pl[i] = chs === 1 ? d[i * 4] * .2126 + d[i * 4 + 1] * .7152 + d[i * 4 + 2] * .0722 : d[i * 4 + c];
      blur.push(boxBlur(pl, rw, rh, r, 2));
    }
  }
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const t = samp(mk.al, mk.mw, mk.mh, x, y, 1 / mk.sc);
    if (t < .004) continue;
    const i = (y * rw + x) * 4;
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (s.mode === 'exp') {
      if (k > 0) { const e = k * .6; r += (255 - r) * e; g += (255 - g) * e; b += (255 - b) * e; }
      else { const e = 1 + k * .6; r *= e; g *= e; b *= e; }
    } else if (s.mode === 'con') {
      const e = 1 + k * .6; r = (r - 128) * e + 128; g = (g - 128) * e + 128; b = (b - 128) * e + 128;
    } else if (s.mode === 'sat') {
      const l = r * .2126 + g * .7152 + b * .0722, e = 1 + k * 1.1; r = l + (r - l) * e; g = l + (g - l) * e; b = l + (b - l) * e;
    } else if (s.mode === 'warm') {
      r += 30 * k; g += 6 * k; b -= 30 * k;
    } else if (s.mode === 'clar') {
      const l = r * .2126 + g * .7152 + b * .0722, bn = blur[0][y * rw + x] / 255, dl = clamp((l - blur[0][y * rw + x]) * k * 1.6 * 4 * bn * (1 - bn), -60, 60);
      r += dl; g += dl; b += dl;
    } else {
      const j = y * rw + x;
      r += (r - blur[0][j]) * k * 1.6; g += (g - blur[1][j]) * k * 1.6; b += (b - blur[2][j]) * k * 1.6;
    }
    d[i] += (r - d[i]) * t; d[i + 1] += (g - d[i + 1]) * t; d[i + 2] += (b - d[i + 2]) * t;
  }
  ctx.putImageData(img, mk.x0, mk.y0);
}

/* ---------- register tools ---------- */
const btn = (txt, fn) => { const b = document.createElement('button'); b.className = 'btn ghost tt'; b.type = 'button'; b.textContent = txt; b.addEventListener('click', fn); return b; };

PX.addTool({
  id: 'dehaze', name: 'Dehaze', icon: '<path d="M4 8h12M7 12h13M4 16h10M9 20h9"/><circle cx="18" cy="6" r="2"/>',
  panel(p) {
    p.appendChild(U.sl('Dehaze', -100, 100, () => S.dehaze, v => S.dehaze = v));
    p.appendChild(U.hint('Plus removes fog and haze, minus adds a soft misty veil. Works best on landscapes, windows and glass.'));
  },
  apply(ctx, W, H) { if (S.dehaze) dehaze(ctx, W, H, S.dehaze / 100); },
  reset: resetS
});
PX.addTool({
  id: 'clarity', name: 'Clarity & Texture', icon: '<path d="M4 17l4-9 4 6 3-4 5 7z"/><path d="M4 20h16"/>',
  panel(p) {
    p.appendChild(U.sl('Clarity', -100, 100, () => S.clarity, v => S.clarity = v));
    p.appendChild(U.sl('Texture', -100, 100, () => S.texture, v => S.texture = v));
    p.appendChild(U.hint('Clarity adds punch to the mid-tones. Texture brings out fine detail, and minus smooths it (skin, water).'));
  },
  apply(ctx, W, H) { if (S.clarity || S.texture) localContrast(ctx, W, H, S.clarity / 100, S.texture / 100); }
});
PX.addTool({
  id: 'tonerange', name: 'Whites & Blacks', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16" stroke-dasharray="2 2"/>',
  panel(p) {
    p.appendChild(U.sl('Whites', -100, 100, () => S.whites, v => S.whites = v));
    p.appendChild(U.sl('Blacks', -100, 100, () => S.blacks, v => S.blacks = v));
    p.appendChild(U.hint('Whites sets the brightest end, Blacks the darkest. Highlights and Shadows are in Tune Image.'));
  },
  apply(ctx, W, H) { if (S.whites || S.blacks) whitesBlacks(ctx, W, H, S.whites / 100, S.blacks / 100); }
});
PX.addTool({
  id: 'localadj', name: 'Local Adjust', icon: '<path d="M4 20c2 0 3-1 3-3l8-8 3 3-8 8c0 2-1 3-3 3z"/><path d="M14 6l3-3 4 4-3 3"/><path d="M3 4h4M5 2v4"/>',
  panel(p) {
    p.appendChild(U.chipRow(MODES, lMode, v => { lMode = v; }));
    p.appendChild(U.sl('Amount', -100, 100, () => lAmt, v => lAmt = v));
    p.appendChild(U.sl('Brush size', 2, 40, () => lSize, v => lSize = v, v => v + '%'));
    p.appendChild(U.sl('Feather', 0, 100, () => lSoft, v => lSoft = v, v => v + '%'));
    p.appendChild(U.hint('Pick what to change, set Amount (minus reverses it), then paint on the photo. Each stroke keeps its own settings.'));
    const row = document.createElement('div'); row.className = 'trow';
    row.appendChild(btn('Undo stroke', () => { S.strokes.pop(); U.render(); U.overlay(); }));
    row.appendChild(btn('Clear', () => { S.strokes = []; U.render(); U.overlay(); }));
    p.appendChild(row);
  },
  paint: {
    down(pt) {
      const s = { mode: lMode, amt: lAmt, size: lSize, soft: lSoft, p: [clamp(pt.u, 0, 1), clamp(pt.v, 0, 1)] };
      S.strokes.push(s); this.cur = s; return true;
    },
    move(pt) {
      const s = this.cur; if (!s) return;
      const o = U.outSize(), n = s.p.length;
      if (Math.hypot((pt.u - s.p[n - 2]) * o.W, (pt.v - s.p[n - 1]) * o.H) < 6) return;
      s.p.push(clamp(pt.u, 0, 1), clamp(pt.v, 0, 1));
    },
    overlay(x, X, Y, L, sc) {
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
      S.strokes.forEach(s => {
        x.strokeStyle = 'rgba(212,169,95,.35)'; x.lineWidth = Math.max(3, s.size / 100 * Math.min(L.iw, L.ih) * sc);
        x.beginPath();
        for (let i = 0; i < s.p.length; i += 2) i ? x.lineTo(X(s.p[i]), Y(s.p[i + 1])) : x.moveTo(X(s.p[i]), Y(s.p[i + 1]));
        if (s.p.length === 2) x.lineTo(X(s.p[0]) + .1, Y(s.p[1]));
        x.stroke();
      });
      x.restore();
    }
  },
  apply(ctx, W, H) { S.strokes.forEach(s => applyStroke(ctx, s, W, H)); },
  reset() { S.strokes = []; }
});
window.PX.round5 = { state: S, test: { dehaze, localContrast, whitesBlacks, applyStroke } };
})();
