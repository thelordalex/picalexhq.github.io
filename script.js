(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const tick = () => new Promise(r => setTimeout(r, 30));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const copyCanvas = c => { const t = mk(c.width, c.height); t.getContext('2d').drawImage(c, 0, 0); return t; };
function rng(seed) {                       // mulberry32: same seed = same result in preview and export
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rrPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ================= config ================= */
const LOW_MEM = !!(navigator.deviceMemory && navigator.deviceMemory <= 3);
const MAX_PIXELS = LOW_MEM ? 8e6 : 16e6;
const SMALL_SIDE = 1600;
const PREVIEW_SIDE = 1000;
const COL_SIDE = LOW_MEM ? 1100 : 1500;

const PLATFORMS = [
  { id: 'original',    name: 'Original',                w: 0,    h: 0 },
  { id: 'ig-story',    name: 'Instagram Story / Reels', w: 1080, h: 1920 },
  { id: 'ig-portrait', name: 'Instagram Portrait',      w: 1080, h: 1350 },
  { id: 'ig-square',   name: 'Instagram Square',        w: 1080, h: 1080 },
  { id: 'tiktok',      name: 'TikTok',                  w: 1080, h: 1920 },
  { id: 'fb-portrait', name: 'Facebook Portrait',       w: 1080, h: 1350 }
];

/* p: b c s (adjust units) | temp lift hl fade vig clarity sharp glow grain | split {sh,hi} = rgb offsets */
const FILTERS = [
  { id: 'natural',    name: 'Natural',    p: { c: 2, s: 3, sharp: 8 } },
  { id: 'clean',      name: 'Clean',      p: { b: 3, c: 5, s: 2, temp: -1, lift: .15, clarity: .10, sharp: 14 } },
  { id: 'vivid',      name: 'Vivid',      p: { b: 1, c: 8, s: 16, sharp: 12 } },
  { id: 'hdr',        name: 'HDR',        p: { c: 5, s: 9, lift: .8, hl: .55, clarity: .45, sharp: 10 } },
  { id: 'cinematic',  name: 'Cinematic',  p: { c: 9, s: -8, fade: .03, vig: .22, clarity: .12, sharp: 6, split: { sh: [-9, 4, 10], hi: [13, 6, -8] } } },
  { id: 'warm',       name: 'Warm',       p: { b: 1, c: 2, s: 4, temp: 9, sharp: 8 } },
  { id: 'cool',       name: 'Cool',       p: { c: 3, s: 2, temp: -9, sharp: 8 } },
  { id: 'bw',         name: 'B&W',        p: { c: 10, s: -100, vig: .10, clarity: .20, sharp: 12 } },
  { id: 'flash',      name: 'Flash Film', p: { c: 13, s: 6, temp: 4, fade: .05, vig: .30, glow: .35, grain: .28, sharp: 6, split: { sh: [10, -3, 20], hi: [10, 3, -2] } } },
  { id: 'retro',      name: 'Retro 70s',  p: { c: -4, s: -6, temp: 14, fade: .07, lift: .5, vig: .20, grain: .22, split: { sh: [8, 2, -6], hi: [10, 6, -10] } } },
  { id: 'tealorange', name: 'Teal/Orange',p: { c: 10, s: 10, sharp: 8, split: { sh: [-12, 4, 10], hi: [14, 5, -12] } } },
  { id: 'moody',      name: 'Moody',      p: { b: -5, c: 14, s: -16, temp: -3, vig: .35, hl: .2, clarity: .25, split: { sh: [-4, 2, 8], hi: [4, 2, 0] } } },
  { id: 'pastel',     name: 'Dreamy',     p: { b: 6, c: -8, s: -6, fade: .08, lift: .6, glow: .45, split: { sh: [10, 4, 12], hi: [10, 2, 6] } } },
  { id: 'matte',      name: 'Matte',      p: { c: -10, s: -12, fade: .09, lift: .4, temp: 3, sharp: 6 } },
  { id: 'noir',       name: 'Noir',       p: { c: 24, s: -100, vig: .32, grain: .32, clarity: .30, sharp: 14 } },
  { id: 'sepia',      name: 'Sepia',      p: { c: 4, s: -100, temp: 22, fade: .05, vig: .20, grain: .12 } },
  { id: 'neon',       name: 'Neon',       p: { c: 12, s: 24, glow: .30, sharp: 8, split: { sh: [14, -8, 26], hi: [-8, 10, 18] } } }
];

const EFFECTS = [
  { id: 'none',   name: 'None' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'rgb',    name: 'RGB Split' },
  { id: 'vhs',    name: 'VHS' },
  { id: 'pixel',  name: 'Pixelate' },
  { id: 'leak',   name: 'Light Leak' },
  { id: 'dust',   name: 'Dust' },
  { id: 'wave',   name: 'Liquid' },
  { id: 'ghost',  name: 'Ghost' }
];

/* frame padding fractions are relative to output WIDTH */
const FRAMES = [
  { id: 'none',          name: 'None',          desc: 'No frame' },
  { id: 'polaroid',      name: 'Polaroid',      desc: 'Instant film', l: .054, t: .065, r: .054, b: .258, bg: '#f4f3f0', tex: true, rad: .006, ink: '#3b3b3b', cap: true },
  { id: 'polaroid-dark', name: 'Polaroid Dark', desc: 'Black instant', l: .054, t: .065, r: .054, b: .258, bg: '#151515', tex: true, rad: .006, ink: '#d9d9d9', cap: true, dark: true },
  { id: 'instax',        name: 'Instax Mini',   desc: 'Cream print', l: .07, t: .07, r: .07, b: .20, bg: '#f6f1e6', rad: .014, ink: '#4a4338', cap: true },
  { id: 'film',          name: 'Film Strip',    desc: '35mm', l: .115, t: .03, r: .115, b: .03, bg: '#0c0c0c', rad: .002, kind: 'film', dark: true },
  { id: 'white',         name: 'Thin White',    desc: 'Clean border', l: .035, t: .035, r: .035, b: .035, bg: '#ffffff', rad: 0, noedge: true },
  { id: 'black',         name: 'Thin Black',    desc: 'Clean border', l: .035, t: .035, r: .035, b: .035, bg: '#050505', rad: 0, noedge: true, dark: true },
  { id: 'card',          name: 'Soft Card',     desc: 'Rounded + shadow', l: .07, t: .07, r: .07, b: .07, bg: '#e8e6e1', rad: .04, shadow: true, noedge: true }
];

const SLIDERS = [
  { k: 'b',     label: 'Brightness', min: -30, max: 30 },
  { k: 'c',     label: 'Contrast',   min: -30, max: 30 },
  { k: 's',     label: 'Saturation', min: -40, max: 40 },
  { k: 'sharp', label: 'Sharpening', min: 0,   max: 100 },
  { k: 'warm',  label: 'Warmth',     min: -50, max: 50 },
  { k: 'vig',   label: 'Vignette',   min: 0,   max: 100 },
  { k: 'glow',  label: 'Glow',       min: 0,   max: 100 },
  { k: 'grain', label: 'Film grain', min: 0,   max: 100 }
];

const QUALITY = {
  jpg:  { standard: .80, high: .92, ultra: .99 },
  webp: { standard: .80, high: .92, ultra: 1.0 }
};
const MIME = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
const NEUTRAL = { b: 0, c: 0, s: 0, sharp: 0, warm: 0, vig: 0, glow: 0, grain: 0 };

/* ================= state ================= */
const st = {
  work: null, small: null, name: 'photo', note: '',
  platform: 'ig-portrait', crop: 'cover',
  filter: 'natural', strength: 100,
  effect: 'none', fxk: 70,
  frame: 'none', caption: '',
  b: 0, c: 0, s: 0, sharp: 0, warm: 0, vig: 0, glow: 0, grain: 0,
  fmt: 'jpg', quality: 'high',
  tab: 'result', fx: .5, fy: .5, cmp: 50
};
let view = 'hero';

/* ================= DOM ================= */
const hero = $('#hero'), editor = $('#editor'), collageEl = $('#collage');
const stage = $('#stage'), cAfter = $('#cAfter'), cBefore = $('#cBefore'), handle = $('#handle');
const dimsEl = $('#dims'), noteEl = $('#note');
let beforeKey = '';
let raf = 0;

let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600);
}
function busy(on, txt) {
  $('#busy').hidden = !on;
  if (txt) $('#busyTxt').textContent = txt;
}
function show(v) {
  view = v;
  hero.hidden = v !== 'hero';
  editor.hidden = v !== 'editor';
  collageEl.hidden = v !== 'collage';
  window.scrollTo({ top: 0 });
  if (v === 'collage') { colUI(); colRender(); }
}

/* ================= resampling ================= */
function drawScaled(ctx, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  let cur = src, cx = sx, cy = sy, cw = sw, ch = sh, tmp = null;
  while (cw * 0.5 > dw && ch * 0.5 > dh) {
    const nw = Math.max(1, Math.round(cw / 2)), nh = Math.max(1, Math.round(ch / 2));
    const t = mk(nw, nh), tc = t.getContext('2d');
    tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
    tc.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    if (tmp) { tmp.width = tmp.height = 0; }
    tmp = t; cur = t; cx = 0; cy = 0; cw = nw; ch = nh;
  }
  ctx.drawImage(cur, cx, cy, cw, ch, dx, dy, dw, dh);
  if (tmp) { tmp.width = tmp.height = 0; }
}

function coverRect(ctx, src, x, y, w, h, fx = .5, fy = .5) {
  const sw = src.width, sh = src.height;
  let cw = sw, ch = sh;
  if (w / h > sw / sh) ch = sw / (w / h); else cw = sh * (w / h);
  drawScaled(ctx, src, (sw - cw) * fx, (sh - ch) * fy, cw, ch, x, y, w, h);
}
function coverDraw(ctx, src, W, H, fx, fy) { coverRect(ctx, src, 0, 0, W, H, fx, fy); }

function backdrop(ctx, src, W, H) {
  const tw = Math.max(8, Math.round(W / 28)), th = Math.max(8, Math.round(H / 28));
  let cur = mk(tw, th);
  coverDraw(cur.getContext('2d'), src, tw, th, .5, .5);
  while (cur.width * 4 < W) {
    const n = mk(cur.width * 4, cur.height * 4), nc = n.getContext('2d');
    nc.imageSmoothingEnabled = true; nc.imageSmoothingQuality = 'high';
    nc.drawImage(cur, 0, 0, n.width, n.height);
    cur.width = cur.height = 0; cur = n;
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, W, H);
  cur.width = cur.height = 0;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(0, 0, W, H);
}

function geometry(ctx, src, W, H, crop, fx, fy) {
  const sw = src.width, sh = src.height;
  if (crop === 'cover' || (W === sw && H === sh)) {
    coverDraw(ctx, src, W, H, fx, fy);
  } else {
    backdrop(ctx, src, W, H);
    const sc = Math.min(W / sw, H / sh);
    const dw = Math.round(sw * sc), dh = Math.round(sh * sc);
    drawScaled(ctx, src, 0, 0, sw, sh, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
  }
}

/* ================= colour pipeline ================= */
function effective(adj, f, k) {
  const p = f ? f.p : {};
  const m = v => (v || 0) * k;
  const e = {
    b: adj.b + m(p.b), c: adj.c + m(p.c),
    s: clamp(adj.s + m(p.s), -100, 100),
    sharp: adj.sharp + m(p.sharp),
    temp: m(p.temp) + adj.warm * 0.2,
    lift: m(p.lift), hl: m(p.hl), fade: m(p.fade),
    vig: m(p.vig) + adj.vig / 100 * 0.5,
    clarity: m(p.clarity),
    glow: m(p.glow) + adj.glow / 100,
    grain: m(p.grain) + adj.grain / 100 * 0.6,
    split: null
  };
  if (p.split) e.split = { sh: p.split.sh.map(v => v * k), hi: p.split.hi.map(v => v * k) };
  return e;
}

function buildLut(e) {
  const lut = new Uint8ClampedArray(256);
  const cf = 1 + e.c / 80, add = e.b * 1.7 / 255;
  const K = 0.12 * 27 / 4;
  for (let i = 0; i < 256; i++) {
    let x = i / 255;
    x += e.lift * K * x * (1 - x) * (1 - x);
    x -= e.hl * K * x * x * (1 - x);
    x = (x - 0.5) * cf + 0.5 + add;
    if (e.fade) x = e.fade + x * (1 - e.fade);
    lut[i] = Math.round(x * 255);
  }
  return lut;
}

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
function blurLum(src, w, h) {
  const r = Math.max(2, Math.round(Math.max(w, h) * 0.02));
  const b = new Uint8Array(src.length), c = new Uint8Array(src.length);
  blurH(src, b, w, h, r); blurV(b, c, w, h, r);
  blurH(c, b, w, h, r);   blurV(b, c, w, h, r);
  return c;
}

function sharpen(d, w, h, amount) {
  const rl = w * 4;
  let prev = new Uint8ClampedArray(rl), cur = new Uint8ClampedArray(rl);
  prev.set(d.subarray(0, rl));
  for (let y = 0; y < h; y++) {
    const yo = y * rl;
    cur.set(d.subarray(yo, yo + rl));
    const last = y === h - 1;
    const nx = last ? cur : d;
    const no = last ? 0 : yo + rl;
    for (let x = 0; x < w; x++) {
      const i = x * 4;
      const xl = (x > 0 ? x - 1 : x) * 4, xr = (x < w - 1 ? x + 1 : x) * 4;
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

function process(ctx, w, h, e) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data, N = w * h;
  const lut = buildLut(e);
  let lum = null, blur = null;
  const cl = e.clarity;
  if (cl > 0.01) {
    lum = new Uint8Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 4) lum[p] = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
    blur = blurLum(lum, w, h);
  }
  const sf = 1 + e.s / 100;
  const tr = e.temp, tg = e.temp * 0.25, tb = -e.temp;
  const sp = e.split, vig = e.vig;
  const cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy);

  for (let y = 0, p = 0, i = 0; y < h; y++) {
    const dy = y - cy, dy2 = dy * dy;
    for (let x = 0; x < w; x++, p++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (lum) {
        const dl = (lum[p] - blur[p]) * cl;
        r += dl; g += dl; b += dl;
        r = r < 0 ? 0 : r > 255 ? 255 : r;
        g = g < 0 ? 0 : g > 255 ? 255 : g;
        b = b < 0 ? 0 : b > 255 ? 255 : b;
      }
      r = lut[r | 0]; g = lut[g | 0]; b = lut[b | 0];
      if (sf !== 1) {                                   // saturation first, grading after
        const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf;
      }
      if (sp) {
        const l = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255, wl = 1 - l;
        r += sp.sh[0] * wl + sp.hi[0] * l;
        g += sp.sh[1] * wl + sp.hi[1] * l;
        b += sp.sh[2] * wl + sp.hi[2] * l;
      }
      if (tr) { r += tr; g += tg; b += tb; }
      if (vig) {
        const dx = x - cx;
        const v = 1 - vig * ((dx * dx + dy2) * inv);
        r *= v; g *= v; b *= v;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
  }
  const amt = clamp(e.sharp, 0, 140) / 100 * 0.9;
  if (amt > 0.02) sharpen(d, w, h, amt);
  ctx.putImageData(img, 0, 0);
}

/* ================= glow / grain / effects ================= */
function bloom(ctx, w, h, amt) {
  if (amt < 0.02) return;
  const s1 = mk(Math.max(2, w >> 3), Math.max(2, h >> 3));
  const c1 = s1.getContext('2d');
  c1.imageSmoothingQuality = 'high';
  c1.drawImage(ctx.canvas, 0, 0, s1.width, s1.height);
  const s2 = mk(Math.max(2, w >> 5), Math.max(2, h >> 5));
  const c2 = s2.getContext('2d');
  c2.imageSmoothingQuality = 'high';
  c2.drawImage(s1, 0, 0, s2.width, s2.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'screen';
  const a = clamp(amt, 0, 1.2) * 0.55;
  ctx.globalAlpha = a;      ctx.drawImage(s1, 0, 0, w, h);
  ctx.globalAlpha = a * .8; ctx.drawImage(s2, 0, 0, w, h);
  ctx.restore();
  s1.width = s1.height = s2.width = s2.height = 0;
}

function grain(ctx, w, h, amt) {
  if (amt < 0.02) return;
  const c = Math.max(1, Math.round(Math.max(w, h) / 1400));
  const gw = Math.ceil(w / c), gh = Math.ceil(h / c);
  const nz = new Int8Array(gw * gh);
  let s = 2463534242;
  for (let i = 0; i < nz.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; nz[i] = ((s >>> 0) % 255) - 127; }
  const img = ctx.getImageData(0, 0, w, h), d = img.data, A = amt * 0.5;
  for (let y = 0; y < h; y++) {
    const row = ((y / c) | 0) * gw;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const n = nz[row + ((x / c) | 0)] * A;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fxGlitch(ctx, w, h, k) {
  const r = rng(7), src = copyCanvas(ctx.canvas);
  const n = Math.round(5 + k * 14);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(r() * h), hh = Math.max(2, Math.floor((0.008 + r() * 0.06) * h));
    const off = Math.round((r() - .5) * 2 * w * 0.12 * k);
    if (!off) continue;
    ctx.drawImage(src, 0, y, w, hh, off, y, w, hh);
    ctx.drawImage(src, 0, y, w, hh, off - Math.sign(off) * w, y, w, hh);
  }
  src.width = src.height = 0;
  const dx = Math.max(1, Math.round(w * 0.012 * k));
  const img = ctx.getImageData(0, 0, w, h), d = img.data, s = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4;
      d[i] = s[(row + (x + dx < w ? x + dx : w - 1)) * 4];
      d[i + 2] = s[(row + (x - dx > 0 ? x - dx : 0)) * 4 + 2];
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const blocks = 2 + Math.round(k * 4);
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,255,230,.22)' : 'rgba(255,0,90,.24)';
    ctx.fillRect(r() * w * .8, r() * h, w * (.08 + r() * .3), Math.max(2, h * (.004 + r() * .02)));
  }
  ctx.restore();
}

function fxChroma(ctx, w, h, k) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, s = new Uint8ClampedArray(d);
  const cx = w / 2, cy = h / 2, a = 0.035 * k;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const ox = (x - cx) * a, oy = (y - cy) * a;
      const xr = clamp(Math.round(x + ox), 0, w - 1), yr = clamp(Math.round(y + oy), 0, h - 1);
      const xb = clamp(Math.round(x - ox), 0, w - 1), yb = clamp(Math.round(y - oy), 0, h - 1);
      d[i] = s[(yr * w + xr) * 4];
      d[i + 2] = s[(yb * w + xb) * 4 + 2];
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fxVhs(ctx, w, h, k) {
  const r = rng(11);
  const img = ctx.getImageData(0, 0, w, h), d = img.data, s = new Uint8ClampedArray(d);
  const sh = Math.max(1, Math.round(w * 0.006 * k * 2));
  const b1 = r() * h * .7 + h * .1, b2 = r() * h * .8 + h * .1;
  const band = h * .02;
  let ns = 88172645;
  for (let y = 0; y < h; y++) {
    let shift = 0;
    const d1 = Math.abs(y - b1), d2 = Math.abs(y - b2);
    if (d1 < band) shift = Math.round(Math.sin((y - b1) * .45) * w * .035 * k * (1 - d1 / band));
    else if (d2 < band * .6) shift = Math.round(Math.sin((y - b2) * .6) * w * .02 * k);
    const dark = (y % 4 < 2) ? 1 : 1 - .18 * k;
    const bottom = y > h * .965;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let xs = x + shift; xs = xs < 0 ? 0 : xs >= w ? w - 1 : xs;
      const xr = xs + sh < w ? xs + sh : w - 1, xb = xs - sh > 0 ? xs - sh : 0;
      ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5;
      const n = (((ns >>> 0) / 4294967296) - .5) * (bottom ? 160 : 34) * k;
      const row = y * w * 4;
      d[i]     = (s[row + xr * 4] * dark) + n;
      d[i + 1] = (s[row + xs * 4 + 1] * dark) + n;
      d[i + 2] = (s[row + xb * 4 + 2] * dark) + n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function fxPixel(ctx, w, h, k) {
  const b = Math.max(2, Math.round(w * (0.004 + 0.03 * k)));
  const sm = mk(Math.ceil(w / b), Math.ceil(h / b));
  const sc = sm.getContext('2d');
  sc.imageSmoothingQuality = 'high';
  sc.drawImage(ctx.canvas, 0, 0, sm.width, sm.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sm, 0, 0, sm.width * b, sm.height * b);
  ctx.restore();
  sm.width = sm.height = 0;
}

function fxLeak(ctx, w, h, k) {
  const r = rng(21);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const R = Math.max(w, h);
  const left = r() < .5;
  const x0 = left ? -w * .05 : w * 1.05, y0 = h * (.2 + r() * .6);
  const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, R * .85);
  g.addColorStop(0, 'rgba(255,120,30,' + (.9 * k) + ')');
  g.addColorStop(.35, 'rgba(255,50,70,' + (.5 * k) + ')');
  g.addColorStop(1, 'rgba(255,0,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createLinearGradient(0, 0, 0, h * .35);
  g2.addColorStop(0, 'rgba(255,200,80,' + (.45 * k) + ')');
  g2.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h * .35);
  ctx.restore();
}

function fxDust(ctx, w, h, k) {
  const r = rng(33), sc = Math.max(1, w / 1080);
  const n = Math.round((60 + k * 320) * (w * h / 1e6));
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < n; i++) {
    const rad = (0.4 + r() * 1.3) * sc;
    ctx.globalAlpha = .25 + r() * .6;
    ctx.beginPath(); ctx.arc(r() * w, r() * h, rad, 0, 6.2832); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = Math.max(1, sc * .8);
  const m = 3 + Math.round(k * 10);
  for (let i = 0; i < m; i++) {
    const x = r() * w, y = r() * h, len = h * (.05 + r() * .3);
    ctx.globalAlpha = .12 + r() * .25;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - .5) * 6 * sc, y + len); ctx.stroke();
  }
  ctx.restore();
}

function fxWave(ctx, w, h, k) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = new Uint32Array(img.data.buffer), s = new Uint32Array(d);
  const amp = w * 0.03 * k, freq = 2 * Math.PI * (3 + k * 5) / h;
  for (let y = 0; y < h; y++) {
    const sh = Math.round(Math.sin(y * freq) * amp), row = y * w;
    for (let x = 0; x < w; x++) d[row + x] = s[row + (((x + sh) % w) + w) % w];
  }
  ctx.putImageData(img, 0, 0);
}

function fxGhost(ctx, w, h, k) {
  const src = copyCanvas(ctx.canvas), off = w * .02 * (.5 + k);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .1 + .35 * k; ctx.drawImage(src, off, -off * .4, w, h);
  ctx.globalAlpha = .25 * k;      ctx.drawImage(src, -off * 1.4, off * .5, w, h);
  ctx.restore();
  src.width = src.height = 0;
}

const FX = { glitch: fxGlitch, rgb: fxChroma, vhs: fxVhs, pixel: fxPixel, leak: fxLeak, dust: fxDust, wave: fxWave, ghost: fxGhost };
function runEffect(id, ctx, w, h, k) { if (FX[id]) FX[id](ctx, w, h, clamp(k, 0.05, 1)); }

/* colour + glow + effect + grain */
function post(ctx, w, h) {
  const e = curEff();
  process(ctx, w, h, e);
  bloom(ctx, w, h, e.glow);
  if (st.effect !== 'none') runEffect(st.effect, ctx, w, h, st.fxk / 100);
  grain(ctx, w, h, e.grain);
}

/* ================= frames ================= */
function curFilter() { return FILTERS.find(f => f.id === st.filter); }
function curFrame() { return FRAMES.find(f => f.id === st.frame); }
function curEff() { return effective(st, curFilter(), st.strength / 100); }

function outSize() {
  const p = PLATFORMS.find(x => x.id === st.platform);
  if (!st.work) return { W: 0, H: 0 };
  if (p.id === 'original') return { W: st.work.width, H: st.work.height };
  return { W: p.w, H: p.h };
}
function layout(W, H) {
  const f = curFrame();
  if (!f || f.id === 'none') return { ix: 0, iy: 0, iw: W, ih: H, f: null };
  const l = Math.round(f.l * W), t = Math.round(f.t * W), r = Math.round(f.r * W), b = Math.round(f.b * W);
  return { ix: l, iy: t, iw: Math.max(8, W - l - r), ih: Math.max(8, H - t - b), f };
}
function trims() {
  if (!st.work || st.platform === 'original') return false;
  const { W, H } = outSize();
  const L = layout(W, H);
  return Math.abs(L.iw / L.ih - st.work.width / st.work.height) > 0.005;
}

function drawFrame(ctx, W, H, L, ph) {
  const f = L.f, rr = (f.rad || 0) * W, dark = !!f.dark;
  ctx.fillStyle = f.bg; ctx.fillRect(0, 0, W, H);
  if (f.tex) {
    const t = Math.max(4, Math.round(W / 120)), tc = mk(t, t), x = tc.getContext('2d');
    x.strokeStyle = dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
    x.lineWidth = Math.max(1, t / 8);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(t, t); x.moveTo(t, 0); x.lineTo(0, t); x.stroke();
    ctx.fillStyle = ctx.createPattern(tc, 'repeat'); ctx.fillRect(0, 0, W, H);
  }
  if (!f.shadow && f.kind !== 'film') {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, dark ? 'rgba(0,0,0,.28)' : 'rgba(70,55,40,.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (f.shadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = W * .04; ctx.shadowOffsetY = W * .014;
    ctx.fillStyle = '#000'; rrPath(ctx, L.ix, L.iy, L.iw, L.ih, rr); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  rrPath(ctx, L.ix, L.iy, L.iw, L.ih, rr); ctx.clip();
  ctx.drawImage(ph, L.ix, L.iy);
  ctx.restore();
  if (!f.noedge) {
    ctx.save();
    rrPath(ctx, L.ix, L.iy, L.iw, L.ih, rr);
    ctx.lineWidth = Math.max(1, W * .0014);
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.28)';
    ctx.stroke();
    ctx.restore();
  }
  if (f.kind === 'film') {
    const hw = W * .03, hh = W * .044, step = W * .078, rad = W * .008;
    const cxL = L.ix / 2, cxR = W - L.ix / 2;
    ctx.fillStyle = '#ece8df';
    for (let y = step * .5; y < H - hh / 2; y += step) {
      rrPath(ctx, cxL - hw / 2, y - hh / 2, hw, hh, rad); ctx.fill();
      rrPath(ctx, cxR - hw / 2, y - hh / 2, hw, hh, rad); ctx.fill();
    }
  }
  if (f.cap && st.caption) {
    const bandTop = L.iy + L.ih, bandH = H - bandTop;
    let size = Math.round(bandH * .26);
    const fam = '"Segoe Print","Bradley Hand","Noteworthy","Marker Felt","Comic Sans MS","Comic Neue",cursive';
    ctx.save();
    ctx.fillStyle = f.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = size + 'px ' + fam;
    while (size > 8 && ctx.measureText(st.caption).width > W * .78) { size -= 2; ctx.font = size + 'px ' + fam; }
    ctx.translate(W / 2, bandTop + bandH * .46);
    ctx.rotate(-0.012);
    ctx.fillText(st.caption, 0, 0);
    ctx.restore();
  }
}

/* render the final picture into ctx at W x H (raw = original look, no edits) */
function renderInto(ctx, src, W, H, raw) {
  const L = layout(W, H);
  if (!L.f) {
    geometry(ctx, src, W, H, st.crop, st.fx, st.fy);
    if (!raw) post(ctx, W, H);
    return;
  }
  const ph = mk(L.iw, L.ih), pc = ph.getContext('2d', { willReadFrequently: true });
  geometry(pc, src, L.iw, L.ih, st.crop, st.fx, st.fy);
  if (!raw) post(pc, L.iw, L.ih);
  drawFrame(ctx, W, H, L, ph);
  ph.width = ph.height = 0;
}

/* ================= preview ================= */
function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

function render() {
  if (!st.small) return;
  const { W, H } = outSize();
  const sc = Math.min(1, PREVIEW_SIDE / Math.max(W, H));
  const pw = Math.max(1, Math.round(W * sc)), ph = Math.max(1, Math.round(H * sc));

  if (cAfter.width !== pw || cAfter.height !== ph) { cAfter.width = pw; cAfter.height = ph; }
  const ctx = cAfter.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, pw, ph);
  renderInto(ctx, st.small, pw, ph, false);

  const key = [pw, ph, st.crop, st.fx.toFixed(4), st.fy.toFixed(4), st.frame, st.caption].join('|');
  if (key !== beforeKey) {
    if (cBefore.width !== pw || cBefore.height !== ph) { cBefore.width = pw; cBefore.height = ph; }
    const bc = cBefore.getContext('2d');
    bc.clearRect(0, 0, pw, ph);
    renderInto(bc, st.small, pw, ph, true);
    beforeKey = key;
  }
  stage.style.setProperty('--ar', (W / H).toFixed(5));
  dimsEl.textContent = W + ' × ' + H;
  applyCompare();
}

function applyCompare() {
  handle.style.left = st.cmp + '%';
  cBefore.style.clipPath = 'inset(0 ' + (100 - st.cmp) + '% 0 0)';
}

function updateNote() {
  const parts = [];
  if (st.note) parts.push(st.note);
  if (st.work) {
    const { W, H } = outSize();
    const L = layout(W, H);
    const sc = st.crop === 'cover' ? Math.max(L.iw / st.work.width, L.ih / st.work.height) : Math.min(L.iw / st.work.width, L.ih / st.work.height);
    if (st.platform !== 'original' && sc > 1.02) parts.push('Source is ' + st.work.width + ' × ' + st.work.height + ' — it will be enlarged to fit this format.');
  }
  noteEl.textContent = parts.join(' ');
}

/* ================= UI build ================= */
function buildCards(boxSel, list, key, sub, after) {
  const box = $(boxSel);
  box.innerHTML = '';
  list.forEach(p => {
    const b = document.createElement('button');
    b.className = 'card'; b.dataset.id = p.id; b.type = 'button';
    b.innerHTML = '<b></b><small></small>';
    b.firstChild.textContent = p.name;
    b.lastChild.textContent = sub(p);
    b.addEventListener('click', () => { st[key] = p.id; after(); });
    box.appendChild(b);
  });
}

function buildChips(boxSel, list, key) {
  const box = $(boxSel);
  box.innerHTML = '';
  list.forEach(f => {
    const b = document.createElement('button');
    b.className = 'fchip'; b.dataset.id = f.id; b.type = 'button';
    b.appendChild(mk(96, 96));
    const sp = document.createElement('span'); sp.textContent = f.name; b.appendChild(sp);
    b.addEventListener('click', () => { st[key] = f.id; syncUI(); scheduleRender(); });
    box.appendChild(b);
  });
}

async function renderThumbs() {
  if (!st.small) return;
  for (const f of FILTERS) {
    const cv = $('#filters .fchip[data-id="' + f.id + '"] canvas');
    if (!cv) continue;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    geometry(ctx, st.small, 96, 96, 'cover', .5, .5);
    const e = effective(NEUTRAL, f, 1);
    process(ctx, 96, 96, e);
    bloom(ctx, 96, 96, e.glow);
    grain(ctx, 96, 96, e.grain);
    await new Promise(r => setTimeout(r, 0));
  }
  for (const f of EFFECTS) {
    const cv = $('#effects .fchip[data-id="' + f.id + '"] canvas');
    if (!cv) continue;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    geometry(ctx, st.small, 96, 96, 'cover', .5, .5);
    process(ctx, 96, 96, effective(NEUTRAL, FILTERS[0], 1));
    if (f.id !== 'none') runEffect(f.id, ctx, 96, 96, .85);
    await new Promise(r => setTimeout(r, 0));
  }
}

function fmtVal(s, v) { return s.min < 0 && v > 0 ? '+' + v : String(v); }

function slider(label, min, max, val, fmt, onInput) {
  const w = document.createElement('div'); w.className = 'sl';
  w.innerHTML = '<div class="lab"><span></span><output></output></div><input type="range">';
  $('span', w).textContent = label;
  const inp = $('input', w), out = $('output', w);
  inp.min = min; inp.max = max; inp.step = 1; inp.value = val;
  out.textContent = fmt(val);
  inp.addEventListener('input', () => { const v = +inp.value; out.textContent = fmt(v); onInput(v); });
  inp.addEventListener('dblclick', () => { inp.value = Math.max(min, Math.min(max, min < 0 ? 0 : min)); inp.dispatchEvent(new Event('input')); });
  return w;
}

function buildSliders() {
  const box = $('#sliders');
  box.innerHTML = '';
  SLIDERS.forEach(s => box.appendChild(slider(s.label, s.min, s.max, st[s.k], v => fmtVal(s, v), v => { st[s.k] = v; scheduleRender(); })));
  const rs = $('#rowStrength'); rs.innerHTML = '';
  rs.appendChild(slider('Filter strength', 0, 100, st.strength, v => v + '%', v => { st.strength = v; scheduleRender(); }));
  const rf = $('#rowFx'); rf.innerHTML = '';
  rf.appendChild(slider('Effect strength', 0, 100, st.fxk, v => v + '%', v => { st.fxk = v; scheduleRender(); }));
}

function syncUI() {
  $$('#platforms .card').forEach(b => b.classList.toggle('on', b.dataset.id === st.platform));
  $$('#frames .card').forEach(b => b.classList.toggle('on', b.dataset.id === st.frame));
  $$('#filters .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === st.filter));
  $$('#effects .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === st.effect));
  $$('#editor .seg').forEach(g => {
    const k = g.dataset.key;
    $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === st[k]));
  });
  $('#rowFx').hidden = st.effect === 'none';
  $('#capRow').hidden = !curFrame().cap;
  const orig = st.platform === 'original';
  $('#cropBlk .seg').classList.toggle('dis', orig);
  $('#cropHint').textContent = orig
    ? 'Original keeps your photo exactly as framed.'
    : st.crop === 'cover'
      ? 'Fills the frame and trims the edges. Use Reposition to choose what stays.'
      : 'Shows the whole photo with a soft blurred background.';
  const png = st.fmt === 'png';
  $$('.seg.q button').forEach(b => b.disabled = png);
  $('#qHint').textContent = png
    ? 'PNG is lossless — quality levels do not apply. Files can be large.'
    : { standard: 'Standard — smaller file size.', high: 'High — recommended for social media.', ultra: 'Ultra — maximum available quality, larger file.' }[st.quality];
  const mv = $('#tabMove');
  const canMove = st.crop === 'cover' && trims();
  mv.hidden = !canMove;
  if (!canMove && st.tab === 'move') setTab('result');
}

function setTab(t) {
  st.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  stage.classList.toggle('cmp', t === 'compare');
  stage.classList.toggle('move', t === 'move');
}

/* ================= stage interactions ================= */
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (st.tab !== 'compare' && st.tab !== 'move') return;
  stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, fx: st.fx, fy: st.fy };
  if (st.tab === 'compare') moveCmp(e);
});
stage.addEventListener('pointermove', e => {
  if (!drag) return;
  if (st.tab === 'compare') { moveCmp(e); return; }
  if (st.tab === 'move') {
    const r = stage.getBoundingClientRect();
    const sw = st.work.width, sh = st.work.height;
    const { W, H } = outSize();
    const L = layout(W, H), ar = L.iw / L.ih;
    let cw = sw, ch = sh;
    if (ar > sw / sh) ch = sw / ar; else cw = sh * ar;
    if (sw - cw > 0.5) st.fx = clamp(drag.fx - ((e.clientX - drag.x) / r.width) * (W / L.iw) * cw / (sw - cw), 0, 1);
    if (sh - ch > 0.5) st.fy = clamp(drag.fy - ((e.clientY - drag.y) / r.height) * (H / L.ih) * ch / (sh - ch), 0, 1);
    scheduleRender();
  }
});
const endDrag = () => { drag = null; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
function moveCmp(e) {
  const r = stage.getBoundingClientRect();
  st.cmp = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
  applyCompare();
}

/* ================= loading ================= */
const isImg = f => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name || '');

function loadViaImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    im.src = url;
  });
}
async function decode(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (_) { bmp = await loadViaImg(file); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error('size');
  return { bmp, w, h };
}
async function toCanvas(file, maxSide) {
  const { bmp, w, h } = await decode(file);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k));
  const c = mk(tw, th);
  drawScaled(c.getContext('2d'), bmp, 0, 0, w, h, 0, 0, tw, th);
  if (bmp.close) bmp.close();
  return c;
}

function adopt(work, name, note, platform) {
  let small = work;
  const tw = work.width, th = work.height;
  if (Math.max(tw, th) > SMALL_SIDE) {
    const k = SMALL_SIDE / Math.max(tw, th);
    small = mk(Math.round(tw * k), Math.round(th * k));
    drawScaled(small.getContext('2d'), work, 0, 0, tw, th, 0, 0, small.width, small.height);
  }
  st.work = work; st.small = small; st.note = note || ''; st.name = name;
  if (platform) st.platform = platform;
  st.fx = st.fy = .5; beforeKey = '';
  show('editor');
  syncUI(); setTab('result');
  render(); updateNote();
  renderThumbs();
}

async function loadFile(file) {
  if (!file) return;
  if (!isImg(file)) { toast('Please choose a JPG, PNG or WEBP image.'); return; }
  busy(true, 'Loading photo…');
  await tick();
  try {
    const { bmp, w, h } = await decode(file);
    let tw = w, th = h, note = '';
    if (w * h > MAX_PIXELS) {
      const k = Math.sqrt(MAX_PIXELS / (w * h));
      tw = Math.max(1, Math.round(w * k)); th = Math.max(1, Math.round(h * k));
      note = 'Large photo (' + w + ' × ' + h + ') was scaled to ' + tw + ' × ' + th + ' to keep your device responsive.';
    }
    const work = mk(tw, th);
    drawScaled(work.getContext('2d'), bmp, 0, 0, w, h, 0, 0, tw, th);
    if (bmp.close) bmp.close();
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'photo';
    adopt(work, name, note);
  } catch (err) {
    toast('Could not open this image. Try another JPG, PNG or WEBP.');
  } finally {
    busy(false);
  }
}

/* ================= export ================= */
async function doExport() {
  if (!st.work) return;
  busy(true, 'Rendering full quality…');
  await tick();
  let c = null;
  try {
    const { W, H } = outSize();
    c = mk(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (st.fmt === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
    renderInto(ctx, st.work, W, H, false);
    const mime = MIME[st.fmt];
    const q = st.fmt === 'png' ? undefined : QUALITY[st.fmt][st.quality];
    const blob = await new Promise(res => c.toBlob(res, mime, q));
    if (!blob) throw new Error('encode');
    let ext = st.fmt;
    if (blob.type && blob.type !== mime) {
      ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      toast('This browser cannot encode ' + st.fmt.toUpperCase() + ' — saved as ' + ext.toUpperCase() + '.');
    } else {
      toast('Saved ' + W + ' × ' + H + ' · ' + fmtSize(blob.size));
    }
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = st.name + '-PicalexHQ.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    toast('Export failed. Try a smaller format or a lower quality.');
  } finally {
    if (c) { c.width = c.height = 0; }
    busy(false);
  }
}
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB'; }

/* ================= collage maker ================= */
const grid = (c, r) => { const a = []; for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) a.push([i / c, j / r, 1 / c, 1 / r]); return a; };
const LAYOUTS = [
  { id: 'h2',  name: '2 side',   r: grid(2, 1) },
  { id: 'v2',  name: '2 stack',  r: grid(1, 2) },
  { id: 'g4',  name: '2×2',      r: grid(2, 2) },
  { id: 't3',  name: '1 + 2',    r: [[0, 0, 1, .58], [0, .58, .5, .42], [.5, .58, .5, .42]] },
  { id: 'l3',  name: 'Big left', r: [[0, 0, .62, 1], [.62, 0, .38, .5], [.62, .5, .38, .5]] },
  { id: 'v3',  name: '3 rows',   r: grid(1, 3) },
  { id: 'l4',  name: '1 + 3',    r: [[0, 0, .6, 1], [.6, 0, .4, 1 / 3], [.6, 1 / 3, .4, 1 / 3], [.6, 2 / 3, .4, 1 / 3]] },
  { id: 'g6',  name: '2×3',      r: grid(2, 3) },
  { id: 'v4',  name: 'Strip',    r: grid(1, 4) },
  { id: 'g9',  name: '3×3',      r: grid(3, 3) }
];
const AR = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16] };
const AR_PLATFORM = { '1:1': 'ig-square', '4:5': 'ig-portrait', '9:16': 'ig-story' };
const SWATCHES = ['#0b0b0d', '#fafafa', '#f1e9da', '#23262d', '#f3d9d4', '#1d2b24'];
const col = { layout: 'g4', ar: '4:5', gap: 14, rad: 16, bg: '#0b0b0d', imgs: [], active: -1 };
const cCol = $('#cCol');
let colBuilt = false;

const colLayout = () => LAYOUTS.find(l => l.id === col.layout);
const colSlots = () => colLayout().r.length;
function colSize(base) { const a = AR[col.ar]; return { W: base, H: Math.round(base * a[1] / a[0]) }; }
function colRects(W, H) {
  const g = col.gap / 1000 * W, m = g / 2, aw = W - 2 * m, ah = H - 2 * m;
  return colLayout().r.map(q => ({ x: m + q[0] * aw + g / 2, y: m + q[1] * ah + g / 2, w: q[2] * aw - g, h: q[3] * ah - g }));
}
function drawCollage(ctx, W, H, preview) {
  ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
  const rects = colRects(W, H), r = col.rad / 1000 * W;
  rects.forEach((q, i) => {
    const im = col.imgs[i];
    if (im) {
      ctx.save(); rrPath(ctx, q.x, q.y, q.w, q.h, r); ctx.clip();
      coverRect(ctx, im, q.x, q.y, q.w, q.h);
      ctx.restore();
    } else if (preview) {
      ctx.save();
      rrPath(ctx, q.x, q.y, q.w, q.h, r);
      ctx.fillStyle = 'rgba(128,128,140,.18)'; ctx.fill();
      const cx = q.x + q.w / 2, cy = q.y + q.h / 2, s = Math.min(q.w, q.h) * .12;
      ctx.strokeStyle = 'rgba(140,140,152,.9)'; ctx.lineWidth = Math.max(2, W * .004); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke();
      ctx.restore();
    }
  });
}
function colRender() {
  const { W, H } = colSize(720);
  if (cCol.width !== W || cCol.height !== H) { cCol.width = W; cCol.height = H; }
  drawCollage(cCol.getContext('2d'), W, H, true);
  $('#cStage').style.setProperty('--ar', (W / H).toFixed(5));
  const o = colSize(1620);
  $('#cDims').textContent = o.W + ' × ' + o.H;
}
function colUI() {
  if (!colBuilt) {
    colBuilt = true;
    const lb = $('#layouts');
    LAYOUTS.forEach(l => {
      const b = document.createElement('button');
      b.className = 'lchip'; b.type = 'button'; b.dataset.id = l.id; b.title = l.name;
      const cv = mk(64, 64), x = cv.getContext('2d');
      x.fillStyle = '#8b91a0';
      l.r.forEach(q => { rrPath(x, q[0] * 60 + 3, q[1] * 60 + 3, q[2] * 60 - 2, q[3] * 60 - 2, 4); x.fill(); });
      b.appendChild(cv);
      b.addEventListener('click', () => { col.layout = l.id; colSync(); colRender(); });
      lb.appendChild(b);
    });
    const sw = $('#swatches');
    SWATCHES.forEach(c => {
      const b = document.createElement('button');
      b.className = 'sw'; b.type = 'button'; b.dataset.c = c; b.style.background = c; b.setAttribute('aria-label', 'Background ' + c);
      b.addEventListener('click', () => { col.bg = c; colSync(); colRender(); });
      sw.appendChild(b);
    });
    const ci = document.createElement('input');
    ci.type = 'color'; ci.value = '#0b0b0d'; ci.setAttribute('aria-label', 'Custom background');
    ci.addEventListener('input', () => { col.bg = ci.value; colSync(); colRender(); });
    sw.appendChild(ci);
    $$('#cAr button').forEach(b => b.addEventListener('click', () => { col.ar = b.dataset.v; colSync(); colRender(); }));
    $('#cGap').addEventListener('input', e => { col.gap = +e.target.value; $('#oGap').textContent = col.gap; colRender(); });
    $('#cRad').addEventListener('input', e => { col.rad = +e.target.value; $('#oRad').textContent = col.rad; colRender(); });
  }
  colSync();
}
function colSync() {
  $$('#layouts .lchip').forEach(b => b.classList.toggle('on', b.dataset.id === col.layout));
  $$('#cAr button').forEach(b => b.classList.toggle('on', b.dataset.v === col.ar));
  $$('#swatches .sw').forEach(b => b.classList.toggle('on', b.dataset.c === col.bg));
}
const nextEmpty = (from) => { const n = colSlots(); for (let i = Math.max(0, from); i < n; i++) if (!col.imgs[i]) return i; return -1; };

async function colFiles(list) {
  const files = Array.from(list || []).filter(isImg);
  if (!files.length) { if (list && list.length) toast('Please choose JPG, PNG or WEBP images.'); return; }
  busy(true, 'Loading photos…');
  await tick();
  try {
    let idx = col.active >= 0 ? col.active : nextEmpty(0);
    for (const f of files) {
      if (idx < 0 || idx >= colSlots()) idx = nextEmpty(0);
      if (idx < 0) { toast('All tiles are filled. Tap a tile to replace it.'); break; }
      col.imgs[idx] = await toCanvas(f, COL_SIDE);
      idx = nextEmpty(0);
    }
  } catch (err) {
    toast('Could not open one of the images.');
  } finally {
    col.active = -1;
    busy(false);
    colRender();
  }
}

cCol.addEventListener('click', e => {
  const r = cCol.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width * cCol.width, py = (e.clientY - r.top) / r.height * cCol.height;
  const rects = colRects(cCol.width, cCol.height);
  let hit = -1;
  rects.forEach((q, i) => { if (px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h) hit = i; });
  if (hit < 0) return;
  col.active = hit;
  $('#fileCol').click();
});

async function colGo() {
  const n = colSlots();
  if (!col.imgs.slice(0, n).some(Boolean)) { toast('Add at least one photo first.'); return; }
  busy(true, 'Building collage…');
  await tick();
  try {
    const { W, H } = colSize(1620);
    const c = mk(W, H);
    drawCollage(c.getContext('2d'), W, H, false);
    adopt(c, 'collage', '', AR_PLATFORM[col.ar]);
    st.crop = 'cover';
    syncUI();
  } finally { busy(false); }
}

/* ================= wiring ================= */
$$('#editor .seg').forEach(g => {
  $$('button', g).forEach(b => b.addEventListener('click', () => {
    st[g.dataset.key] = b.dataset.v;
    syncUI();
    if (g.dataset.key === 'crop') { updateNote(); scheduleRender(); }
  }));
});
$$('#tabs button').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); }));
$('#resetAdj').addEventListener('click', () => {
  st.b = st.c = st.s = st.sharp = st.warm = st.vig = st.glow = st.grain = 0;
  st.strength = 100; st.fxk = 70;
  buildSliders(); scheduleRender();
});
$('#dl').addEventListener('click', doExport);
$('#change').addEventListener('click', () => $('#file2').click());
$('#toCollage').addEventListener('click', () => show('collage'));
$('#goCollage').addEventListener('click', () => show('collage'));
$('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('#file2').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('#fileCol').addEventListener('change', e => { colFiles(e.target.files); e.target.value = ''; });
$('#caption').addEventListener('input', e => { st.caption = e.target.value; scheduleRender(); });

$('#cAdd').addEventListener('click', () => { col.active = -1; $('#fileCol').click(); });
$('#cClear').addEventListener('click', () => { col.imgs = []; colRender(); });
$('#cBack').addEventListener('click', () => show(st.work ? 'editor' : 'hero'));
$('#cGo').addEventListener('click', colGo);

const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over'); }));
window.addEventListener('drop', e => {
  const fl = e.dataTransfer && e.dataTransfer.files;
  if (!fl || !fl.length) return;
  if (view === 'collage') { col.active = -1; colFiles(fl); } else loadFile(fl[0]);
});

buildCards('#platforms', PLATFORMS, 'platform', p => p.id === 'original' ? 'Keep dimensions' : p.w + ' × ' + p.h,
  () => { st.fx = st.fy = .5; syncUI(); scheduleRender(); updateNote(); });
buildCards('#frames', FRAMES, 'frame', p => p.desc,
  () => { st.fx = st.fy = .5; syncUI(); scheduleRender(); updateNote(); });
buildChips('#filters', FILTERS, 'filter');
buildChips('#effects', EFFECTS, 'effect');
buildSliders();
syncUI();
})();
