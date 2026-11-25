(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const tick = () => new Promise(r => setTimeout(r, 30));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/* reusable scratch canvases: avoids allocating new canvases on every live render */
const pool = {};
function scratch(k, w, h) {
  let c = pool[k];
  if (!c) c = pool[k] = mk(w, h);
  else if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
function freeScratch() { for (const k in pool) { pool[k].width = pool[k].height = 0; delete pool[k]; } }
function copyCanvas(c, k) {
  const t = scratch(k || 'cp', c.width, c.height), x = t.getContext('2d');
  x.clearRect(0, 0, t.width, t.height); x.drawImage(c, 0, 0);
  return t;
}
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
const MAX_PIXELS = LOW_MEM ? 6e6 : 12e6;   // working-size cap: plenty for 1080-wide social output
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

/* ---- round 2: Size panel presets (W/H in px; long = long side, orig = photo pixels) ---- */
const SIZE_PRESETS = [
  { id: 'sz-orig',  name: 'Original size',    sub: 'Photo pixels',  orig: true },
  { id: 'sz-story', name: 'Story / Reels',    sub: '1080 × 1920',   w: 1080, h: 1920 },
  { id: 'sz-4x5',   name: 'Portrait 4:5',     sub: '1080 × 1350',   w: 1080, h: 1350 },
  { id: 'sz-sq',    name: 'Square',           sub: '1080 × 1080',   w: 1080, h: 1080 },
  { id: 'sz-tt',    name: 'TikTok',           sub: '1080 × 1920',   w: 1080, h: 1920 },
  { id: 'sz-fb',    name: 'Facebook Portrait',sub: '1080 × 1350',   w: 1080, h: 1350 },
  { id: 'sz-link',  name: 'Link preview',     sub: '1200 × 628',    w: 1200, h: 628 },
  { id: 'sz-web',   name: 'Web 16:9',         sub: '1600 × 900',    w: 1600, h: 900 },
  { id: 'sz-2k',    name: 'Large square',     sub: '2048 × 2048',   w: 2048, h: 2048 },
  { id: 'sz-4096',  name: 'Long side 4096',   sub: 'Keeps proportions', long: 4096 },
  { id: 'sz-4x6',   name: 'Print 4 × 6 in',   sub: '1200 × 1800 · 300 dpi', w: 1200, h: 1800 },
  { id: 'sz-5x7',   name: 'Print 5 × 7 in',   sub: '1500 × 2100 · 300 dpi', w: 1500, h: 2100 },
  { id: 'sz-8x10',  name: 'Print 8 × 10 in',  sub: '2400 × 3000 · 300 dpi', w: 2400, h: 3000 }
];
const MAX_SIDE = 8192;
const MAX_OUT_PX = LOW_MEM ? 16e6 : 33e6;   // output cap: protects canvas memory on phones

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

const EFFECTS = [{ id: 'none', name: 'None' }].concat(('vhs:VHS,glitch:Glitch,cyber:Cyber,y2k:Y2K,retro:Retro,vintage:Vintage,film:Film,camcorder:Camcorder,ccd:CCD,dv:DV,polaroid:Polaroid,disposable:Disposable,flash:Flash,paparazzi:Paparazzi,neon:Neon,chrome:Chrome,hologram:Hologram,prism:Prism,rainbow:Rainbow,aurora:Aurora,dreamy:Dreamy,dream:Dream,fairy:Fairy,ethereal:Ethereal,angel:Angel,heavenly:Heavenly,cosmic:Cosmic,galaxy:Galaxy,space:Space,starry:Starry,fire:Fire,flame:Flame,smoke:Smoke,wave:Liquid,water:Water,ice:Ice,glass:Glass,mirror:Mirror,electric:Electric,cyberpunk:Cyberpunk,matrix:Matrix,anime:Anime,comic:Comic,sketch:Sketch,doodle:Doodle,graffiti:Graffiti,sticker:Sticker,newspaper:Newspaper,collage:Collage,distortion:Distortion,rgb:RGB Split,pixel:Pixelate,leak:Light Leak,dust:Dust,ghost:Ghost').split(',').map(s => { const p = s.split(':'); return { id: p[0], name: p[1] }; }));

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
  { k: 'grain', label: 'Film grain', min: 0,   max: 100 },
  { k: 'shadows',    g: 2, label: 'Shadows',    min: -50, max: 50 },
  { k: 'highlights', g: 2, label: 'Highlights', min: -50, max: 50 },
  { k: 'clarity',    g: 2, label: 'Clarity',    min: 0,   max: 100 },
  { k: 'fade',       g: 2, label: 'Fade',       min: 0,   max: 100 }
];

const QUALITY = {
  jpg:  { standard: .80, high: .92, ultra: .99 },
  webp: { standard: .80, high: .92, ultra: 1.0 }
};
const MIME = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };
const NEUTRAL = { b: 0, c: 0, s: 0, sharp: 0, warm: 0, vig: 0, glow: 0, grain: 0, shadows: 0, highlights: 0, clarity: 0, fade: 0 };

/* ================= state ================= */
const st = {
  work: null, small: null, name: 'photo', note: '',
  platform: 'ig-portrait', crop: 'cover',
  filter: 'natural', strength: 100,
  effect: 'none', fxk: 70,
  frame: 'none', caption: '',
  b: 0, c: 0, s: 0, sharp: 0, warm: 0, vig: 0, glow: 0, grain: 0, shadows: 0, highlights: 0, clarity: 0, fade: 0,
  srcId: 0, fast: false,
  fmt: 'jpg', quality: 'high',
  tab: 'result', fx: .5, fy: .5, cmp: 50,
  /* Size panel: custom = null (use the Format preset) or { W, H } */
  custom: null, sizeFit: 'fill', sizeBg: '#000000', sizeKeep: true, sizeRatio: 1
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
  if (crop === 'stretch') {
    drawScaled(ctx, src, 0, 0, sw, sh, 0, 0, W, H);          // Size panel: distorts on purpose
  } else if (crop === 'cover' || (W === sw && H === sh)) {
    coverDraw(ctx, src, W, H, fx, fy);
  } else if (crop === 'fit-solid') {                         // Size panel: letterbox on a chosen colour
    ctx.fillStyle = st.sizeBg; ctx.fillRect(0, 0, W, H);
    const sc = Math.min(W / sw, H / sh);
    const dw = Math.round(sw * sc), dh = Math.round(sh * sc);
    drawScaled(ctx, src, 0, 0, sw, sh, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
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
    lift: m(p.lift) + adj.shadows / 50 * 0.6, hl: m(p.hl) - adj.highlights / 50 * 0.5, fade: m(p.fade) + adj.fade / 100 * 0.15,
    vig: m(p.vig) + adj.vig / 100 * 0.5,
    clarity: m(p.clarity) + adj.clarity / 100 * 0.5,
    glow: m(p.glow) + adj.glow / 100,
    grain: m(p.grain) + adj.grain / 100 * 0.6,
    split: null
  };
  if (p.split) e.split = { sh: p.split.sh.map(v => v * k), hi: p.split.hi.map(v => v * k) };
  e.vigR = (typeof T3 !== 'undefined' && T3.vigR) || 1;      // round 3: Vignette tool radius
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
  const vr = e.vigR || 1;
  const cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy) / (vr * vr);

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
  const s1 = scratch('b1', Math.max(2, w >> 3), Math.max(2, h >> 3));
  const c1 = s1.getContext('2d');
  c1.clearRect(0, 0, s1.width, s1.height);
  c1.imageSmoothingQuality = 'high';
  c1.drawImage(ctx.canvas, 0, 0, s1.width, s1.height);
  const s2 = scratch('b2', Math.max(2, w >> 5), Math.max(2, h >> 5));
  const c2 = s2.getContext('2d');
  c2.clearRect(0, 0, s2.width, s2.height);
  c2.imageSmoothingQuality = 'high';
  c2.drawImage(s1, 0, 0, s2.width, s2.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'screen';
  const a = clamp(amt, 0, 1.2) * 0.55;
  ctx.globalAlpha = a;      ctx.drawImage(s1, 0, 0, w, h);
  ctx.globalAlpha = a * .8; ctx.drawImage(s2, 0, 0, w, h);
  ctx.restore();
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
  const r = rng(7), src = copyCanvas(ctx.canvas, 'fx');
  const n = Math.round(5 + k * 14);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(r() * h), hh = Math.max(2, Math.floor((0.008 + r() * 0.06) * h));
    const off = Math.round((r() - .5) * 2 * w * 0.12 * k);
    if (!off) continue;
    ctx.drawImage(src, 0, y, w, hh, off, y, w, hh);
    ctx.drawImage(src, 0, y, w, hh, off - Math.sign(off) * w, y, w, hh);
  }
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
  const sm = scratch('px', Math.ceil(w / b), Math.ceil(h / b));
  const sc = sm.getContext('2d');
  sc.clearRect(0, 0, sm.width, sm.height);
  sc.imageSmoothingQuality = 'high';
  sc.drawImage(ctx.canvas, 0, 0, sm.width, sm.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sm, 0, 0, sm.width * b, sm.height * b);
  ctx.restore();
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
  const src = copyCanvas(ctx.canvas, 'fx'), off = w * .02 * (.5 + k);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = .1 + .35 * k; ctx.drawImage(src, off, -off * .4, w, h);
  ctx.globalAlpha = .25 * k;      ctx.drawImage(src, -off * 1.4, off * .5, w, h);
  ctx.restore();
}

const FX = { glitch: fxGlitch, rgb: fxChroma, vhs: fxVhs, pixel: fxPixel, leak: fxLeak, dust: fxDust, wave: fxWave, ghost: fxGhost };

/* ---- effect toolkit: small steps composed into recipes (RC). Each recipe is blended with the original by Effect strength ---- */
const T = (c, m, a) => (x, w, h) => { x.save(); x.globalCompositeOperation = m; x.globalAlpha = a; x.fillStyle = c; x.fillRect(0, 0, w, h); x.restore(); };
const stp = (g, cs) => { cs.forEach((c, i) => g.addColorStop(i / (cs.length - 1), c)); return g; };
const G = (cs, m, a, ang) => (x, w, h) => {                       // linear gradient overlay at an angle (0 = left→right, 90 = top→bottom)
  const r = ang * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r), L = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  x.save(); x.globalCompositeOperation = m; x.globalAlpha = a;
  x.fillStyle = stp(x.createLinearGradient(w / 2 - dx * L, h / 2 - dy * L, w / 2 + dx * L, h / 2 + dy * L), cs); x.fillRect(0, 0, w, h); x.restore();
};
const RG = (px, py, pr, cs, m, a) => (x, w, h) => {                // radial gradient overlay
  const R = Math.max(w, h) * pr;
  x.save(); x.globalCompositeOperation = m; x.globalAlpha = a;
  x.fillStyle = stp(x.createRadialGradient(w * px, h * py, 0, w * px, h * py, R), cs); x.fillRect(0, 0, w, h); x.restore();
};
const VG = a => RG(.5, .5, .75, ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,' + a + ')'], 'source-over', 1);
const CM = o => (x, w, h) => {                                     // colour matrix: c contrast, s saturation, b brightness, m rgb gain, p posterize, g gray
  const im = x.getImageData(0, 0, w, h), d = im.data, c = 1 + (o.c || 0), s = 1 + (o.s || 0), b = (o.b || 0) * 255, m = o.m || [1, 1, 1], p = o.p ? 255 / (o.p - 1) : 0;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], q = d[i + 2];
    const l = r * .2126 + g * .7152 + q * .0722;
    if (o.g) r = g = q = l; else if (s !== 1) { r = l + (r - l) * s; g = l + (g - l) * s; q = l + (q - l) * s; }
    r = ((r - 128) * c + 128 + b) * m[0]; g = ((g - 128) * c + 128 + b) * m[1]; q = ((q - 128) * c + 128 + b) * m[2];
    if (p) { r = Math.round(r / p) * p; g = Math.round(g / p) * p; q = Math.round(q / p) * p; }
    d[i] = r; d[i + 1] = g; d[i + 2] = q;
  }
  x.putImageData(im, 0, 0);
};
const ED = (mode, col, gain) => (x, w, h) => {                     // Sobel edges: 'line' ink, 'neon' glow lines, 'sketch' pencil on paper
  const im = x.getImageData(0, 0, w, h), d = im.data, N = w * h, Lm = new Uint8Array(N), c = col || [0, 0, 0];
  for (let p = 0, i = 0; p < N; p++, i += 4) Lm[p] = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
  for (let y = 1; y < h - 1; y++) for (let X = 1; X < w - 1; X++) {
    const p = y * w + X, i = p * 4,
      gx = Lm[p - w + 1] + 2 * Lm[p + 1] + Lm[p + w + 1] - Lm[p - w - 1] - 2 * Lm[p - 1] - Lm[p + w - 1],
      gy = Lm[p + w - 1] + 2 * Lm[p + w] + Lm[p + w + 1] - Lm[p - w - 1] - 2 * Lm[p - w] - Lm[p - w + 1],
      m = Math.min(1, Math.hypot(gx, gy) / 220 * gain);
    if (mode === 'sketch') { const v = Math.min(255 - m * 255, 255 - (255 - Lm[p]) * .3); d[i] = v; d[i + 1] = v * .985; d[i + 2] = v * .95; }
    else { const k = mode === 'neon' ? .18 : 1 - m, a = mode === 'neon' ? m : m; d[i] = d[i] * k + c[0] * a; d[i + 1] = d[i + 1] * k + c[1] * a; d[i + 2] = d[i + 2] * k + c[2] * a; }
  }
  x.putImageData(im, 0, 0);
};
const HT = (n, over, col) => (x, w, h) => {                        // halftone dots (over = print dots on the photo, else dots on paper)
  const c = Math.max(4, Math.round(w / n)), gw = Math.ceil(w / c), gh = Math.ceil(h / c), s = scratch('ht', gw, gh), sc = s.getContext('2d');
  sc.clearRect(0, 0, gw, gh); sc.drawImage(x.canvas, 0, 0, gw, gh);
  const d = sc.getImageData(0, 0, gw, gh).data;
  x.save();
  if (over) x.globalCompositeOperation = 'multiply'; else { x.fillStyle = '#f2efe6'; x.fillRect(0, 0, w, h); }
  x.fillStyle = col || '#111';
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const o = (j * gw + i) * 4, r = (1 - (d[o] * .2126 + d[o + 1] * .7152 + d[o + 2] * .0722) / 255) * c * .75;
    if (r < .5) continue;
    x.beginPath(); x.arc((i + .5) * c, (j + .5) * c, r, 0, 6.2832); x.fill();
  }
  x.restore();
};
const ST = (n, sz, cs, seed) => (x, w, h) => {                    // glowing stars with glints
  const r = rng(seed), u = w / 1080;
  x.save(); x.globalCompositeOperation = 'lighter'; x.lineWidth = Math.max(1, u);
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = r() * h, s = (.4 + r() * r() * 2.4) * sz * u, c = cs[i % cs.length];
    x.fillStyle = stp(x.createRadialGradient(px, py, 0, px, py, s * 3), [c, 'rgba(0,0,0,0)']); x.fillRect(px - s * 3, py - s * 3, s * 6, s * 6);
    if (s > 2.8 * u) { x.strokeStyle = c; x.beginPath(); x.moveTo(px - s * 4, py); x.lineTo(px + s * 4, py); x.moveTo(px, py - s * 4); x.lineTo(px, py + s * 4); x.stroke(); }
  }
  x.restore();
};
const DO = (cs, seed) => (x, w, h) => {                            // hand-drawn doodles: stars, hearts, squiggles, circles
  const r = rng(seed), u = w / 1080;
  x.save(); x.lineCap = x.lineJoin = 'round'; x.lineWidth = 5 * u;
  for (let i = 0; i < 14; i++) {
    x.strokeStyle = cs[i % cs.length]; x.beginPath();
    const px = r() * w, py = r() * h, s = (25 + r() * 50) * u, t = i % 4;
    if (t === 0) { for (let a = 0; a < 10; a++) { const R = a % 2 ? s * .45 : s, an = a * Math.PI / 5 - 1.57; x.lineTo(px + Math.cos(an) * R, py + Math.sin(an) * R); } x.closePath(); }
    else if (t === 1) { x.moveTo(px, py + s * .7); x.bezierCurveTo(px - s * 1.2, py - s * .2, px - s * .4, py - s, px, py - s * .35); x.bezierCurveTo(px + s * .4, py - s, px + s * 1.2, py - s * .2, px, py + s * .7); }
    else if (t === 2) { x.moveTo(px - s, py); for (let a = 1; a <= 6; a++) x.quadraticCurveTo(px - s + (a - .5) * s / 3, py + (a % 2 ? -1 : 1) * s * .5, px - s + a * s / 3, py); }
    else x.arc(px, py, s * .6, 0, 6.2832);
    x.stroke();
  }
  x.restore();
};
const BO = (n, col, seed) => (x, w, h) => {                        // lightning bolts
  const r = rng(seed), u = w / 1080;
  x.save(); x.globalCompositeOperation = 'lighter'; x.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    let px = r() * w, py = 0; const pts = [[px, py]], end = h * (.5 + r() * .5);
    while (py < end) { px += (r() - .5) * w * .12; py += h * (.03 + r() * .05); pts.push([px, py]); }
    [[14, .18, col], [6, .4, col], [2, 1, '#fff']].forEach(q => {
      x.globalAlpha = q[1]; x.strokeStyle = q[2]; x.lineWidth = q[0] * u; x.beginPath();
      pts.forEach((p, j) => j ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke();
    });
  }
  x.restore();
};
const FL = (n, cs, seed) => (x, w, h) => {                         // flame tongues rising from the bottom
  const r = rng(seed);
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const px = r() * w, bw = w * (.04 + r() * .07), fh = h * (.15 + r() * .3);
    x.fillStyle = stp(x.createLinearGradient(0, h, 0, h - fh), [cs[i % cs.length], 'rgba(255,60,0,0)']);
    x.beginPath(); x.moveTo(px - bw, h);
    x.bezierCurveTo(px - bw, h - fh * .5, px - bw * .3, h - fh * .6, px + (r() - .5) * bw, h - fh);
    x.bezierCurveTo(px + bw * .3, h - fh * .6, px + bw, h - fh * .5, px + bw, h); x.fill();
  }
  x.restore();
};
const SM = (n, seed) => (x, w, h) => {                             // soft smoke clouds
  const r = rng(seed);
  x.save(); x.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = h * (.3 + r() * .7), R = w * (.15 + r() * .3);
    x.fillStyle = stp(x.createRadialGradient(px, py, 0, px, py, R), ['rgba(255,255,255,' + (.14 + r() * .14) + ')', 'rgba(255,255,255,0)']); x.fillRect(px - R, py - R, R * 2, R * 2);
  }
  x.restore();
};
const RY = (px, py, n, c, a, seed) => (x, w, h) => {               // light rays from a point
  const r = rng(seed), X = w * px, Y = h * py, L = Math.hypot(w, h);
  x.save(); x.globalCompositeOperation = 'screen';
  x.fillStyle = stp(x.createRadialGradient(X, Y, 0, X, Y, L), ['rgba(' + c + ',' + a + ')', 'rgba(' + c + ',0)']);
  for (let i = 0; i < n; i++) {
    const an = Math.PI * (.1 + .8 * r()), wd = .015 + r() * .04;
    x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(an - wd) * L, Y + Math.sin(an - wd) * L); x.lineTo(X + Math.cos(an + wd) * L, Y + Math.sin(an + wd) * L); x.fill();
  }
  x.restore();
};
const SP = (n, cs, seed) => (x, w, h) => {                        // spray splatter with drips
  const r = rng(seed);
  x.save();
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = r() * h, R = w * (.004 + r() * .02);
    x.globalAlpha = .6 + r() * .4; x.fillStyle = cs[i % cs.length]; x.beginPath(); x.arc(px, py, R, 0, 6.2832); x.fill();
    if (r() < .25) x.fillRect(px - R * .15, py, R * .3, h * (.03 + r() * .1));
  }
  x.restore();
};
const MX = (x, w, h) => {                                          // matrix code rain
  const r = rng(5), sz = Math.round(w * .022);
  x.save(); x.font = sz + 'px monospace'; x.globalCompositeOperation = 'lighter';
  for (let cx = 0; cx < w; cx += sz) {
    const len = 4 + Math.floor(r() * 18), y0 = r() * h;
    for (let i = 0; i < len; i++) { x.fillStyle = 'rgba(60,255,120,' + (1 - i / len) * .8 + ')'; x.fillText(String.fromCharCode(48 + Math.floor(r() * 43)), cx, ((y0 - i * sz) % h + h) % h); }
  }
  x.restore();
};
const SC = a => (x, w, h) => { const u = Math.max(1, Math.round(w / 540)); x.fillStyle = 'rgba(0,0,0,' + a + ')'; for (let y = 0; y < h; y += 3 * u) x.fillRect(0, y, w, u); };
const WP = (ax, ay, fx, fy, ph) => (x, w, h) => {                  // sine displacement (water, glass, distortion)
  const im = x.getImageData(0, 0, w, h), d = new Uint32Array(im.data.buffer), s = new Uint32Array(d), A = Math.max(w, h) * .01;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++)
    d[y * w + X] = s[clamp(Math.round(y + Math.sin(X * fy * 6.2832 / w + ph) * ay * A), 0, h - 1) * w + clamp(Math.round(X + Math.sin(y * fx * 6.2832 / h + ph) * ax * A), 0, w - 1)];
  x.putImageData(im, 0, 0);
};
const BG = a => (x, w, h) => {                                     // lens bulge
  const im = x.getImageData(0, 0, w, h), d = new Uint32Array(im.data.buffer), s = new Uint32Array(d), cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
    const nx = (X - cx) / cx, ny = (y - cy) / cy, r2 = nx * nx + ny * ny, f = r2 < 1 ? 1 - a * (1 - r2) : 1;
    d[y * w + X] = s[clamp(Math.round(cy + ny * cy * f), 0, h - 1) * w + clamp(Math.round(cx + nx * cx * f), 0, w - 1)];
  }
  x.putImageData(im, 0, 0);
};
const MI = q => (x, w, h) => {
  let o = copyCanvas(x.canvas, 'cp'); x.save(); x.translate(w, 0); x.scale(-1, 1); x.drawImage(o, 0, 0, w / 2, h, 0, 0, w / 2, h); x.restore();
  if (q) { o = copyCanvas(x.canvas, 'cp'); x.save(); x.translate(0, h); x.scale(1, -1); x.drawImage(o, 0, 0, w, h / 2, 0, 0, w, h / 2); x.restore(); }
};
const SF = a => (x, w, h) => {                                     // soft focus
  const s = scratch('sf', Math.max(2, w >> 2), Math.max(2, h >> 2)), c = s.getContext('2d');
  c.clearRect(0, 0, s.width, s.height); c.imageSmoothingQuality = 'high'; c.drawImage(x.canvas, 0, 0, s.width, s.height);
  x.save(); x.imageSmoothingQuality = 'high'; x.globalAlpha = a; x.drawImage(s, 0, 0, w, h); x.restore();
};
const TL = n => (x, w, h) => {                                     // scrapbook collage of polaroid-style tiles
  const o = copyCanvas(x.canvas, 'cp'), r = rng(8), cw = w / n, ch = h / n, pw = cw * .94, ph = ch * .94, b = pw * .05, sw = w * .7, sh = h * .7;
  x.save(); x.fillStyle = '#e9e2d3'; x.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    x.save(); x.translate((i + .5) * cw, (j + .5) * ch); x.rotate((r() - .5) * .12);
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = w * .012; x.shadowOffsetY = w * .004; x.fillStyle = '#fff'; x.fillRect(-pw / 2, -ph / 2, pw, ph);
    x.shadowColor = 'transparent'; x.drawImage(o, (w - sw) * r(), (h - sh) * r(), sw, sh, -pw / 2 + b, -ph / 2 + b, pw - 2 * b, ph - 2 * b); x.restore();
  }
  x.restore();
};
const SK = (x, w, h) => {                                          // die-cut sticker card on a dotted background
  const o = copyCanvas(x.canvas, 'cp'), m = w * .07, b = w * .022, iw = w - 2 * (m + b), ih = h - 2 * (m + b), s = Math.max(iw / w, ih / h), sw = iw / s, sh = ih / s;
  x.save(); x.fillStyle = '#ffd1e8'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.6)';
  for (let j = 0, q = 0; j < h; j += w * .05, q++) for (let i = (q % 2) * w * .025; i < w; i += w * .05) { x.beginPath(); x.arc(i, j, w * .006, 0, 6.2832); x.fill(); }
  x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = w * .02; x.shadowOffsetY = w * .008; x.fillStyle = '#fff'; rrPath(x, m, m, w - 2 * m, h - 2 * m, w * .09); x.fill(); x.shadowColor = 'transparent';
  rrPath(x, m + b, m + b, iw, ih, w * .07); x.clip(); x.drawImage(o, (w - sw) / 2, (h - sh) / 2, sw, sh, m + b, m + b, iw, ih); x.restore();
};
const TX = (t, al, px, py, c, sz) => (x, w, h) => { x.save(); x.font = 'bold ' + Math.round(w * sz) + 'px monospace'; x.textAlign = al; x.fillStyle = c; x.shadowColor = c; x.shadowBlur = w * .008; x.fillText(t(), w * px, h * py); x.restore(); };
const RD = (x, w, h) => { x.fillStyle = '#ff2020'; x.beginPath(); x.arc(w * .065, h * .09 - w * .0145, w * .014, 0, 6.2832); x.fill(); };
const pad2 = n => String(n).padStart(2, '0');
const D1 = () => { const d = new Date(); return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()); };
const D2 = () => { const d = new Date(); return "'" + String(d.getFullYear()).slice(2) + ' ' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getDate()); };
const D3 = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const F = (id, k) => (x, w, h) => FX[id](x, w, h, k);
const BL = a => (x, w, h) => bloom(x, w, h, a);
const NZ = a => (x, w, h) => grain(x, w, h, a);
const WH = 'rgba(255,255,255,.9)', RB = ['#ff3b3b', '#ffb13b', '#fff23b', '#3bff6a', '#3bb4ff', '#9b3bff'];

const RC = {
  cyber:      [CM({ c: .25, s: .3 }), G(['#00e5ff', '#ff2bd6'], 'overlay', .55, 35), F('rgb', .7), SC(.18), BL(.4), NZ(.15)],
  y2k:        [CM({ c: .15, s: .35, b: .05 }), G(['#ff9ad5', '#8ec5ff', '#e9d7ff'], 'soft-light', .9, 60), G(['#ffffff', 'rgba(255,255,255,0)'], 'screen', .25, 90), BL(.6), ST(40, 2.2, [WH, 'rgba(190,220,255,.9)', 'rgba(255,170,230,.9)'], 11), NZ(.1)],
  retro:      [CM({ c: -.1, s: -.1, b: .04 }), T('#ffb066', 'multiply', .28), T('#3a2a55', 'lighten', .18), VG(.35), NZ(.25)],
  vintage:    [CM({ s: -.45, c: -.1 }), T('#d9b98a', 'multiply', .45), T('#5b4630', 'lighten', .2), VG(.45), F('dust', .6), NZ(.3)],
  film:       [CM({ c: .12, s: -.08 }), T('#ffcf9e', 'soft-light', .35), BL(.35), T('#ff3b1f', 'screen', .06), NZ(.38), F('dust', .4)],
  camcorder:  [CM({ c: .1, s: -.15 }), SF(.35), SC(.12), VG(.3), RD, TX(() => 'REC', 'left', .095, .09, '#ff3030', .04), TX(D1, 'right', .95, .95, '#ffffff', .032), TX(D3, 'right', .95, .9, '#ffffff', .032), NZ(.2)],
  ccd:        [CM({ c: .2, s: .1, b: .06, m: [.96, 1, 1.06] }), BL(.45), T('#bfe3ff', 'soft-light', .3), VG(.2), TX(D2, 'right', .95, .95, '#ff9b2e', .04), NZ(.15)],
  dv:         [CM({ s: -.3, c: .05, m: [.97, 1, 1.04] }), SF(.25), SC(.16), VG(.25), TX(D1, 'right', .95, .95, '#ffb347', .035), TX(D3, 'left', .05, .95, '#ffb347', .035), NZ(.3)],
  polaroid:   [CM({ c: -.08, s: -.05, b: .05 }), T('#ffd9a0', 'multiply', .2), T('#2c3a52', 'lighten', .18), VG(.25), BL(.15), NZ(.18)],
  disposable: [CM({ c: .15, s: .1 }), T('#ffb45c', 'soft-light', .45), RG(.5, .45, .6, ['rgba(255,240,210,.55)', 'rgba(255,240,210,0)'], 'screen', .8), VG(.5), F('leak', .5), NZ(.4), TX(D2, 'right', .95, .95, '#ff8a1f', .04)],
  flash:      [CM({ c: .3, s: -.05, b: .08 }), RG(.5, .45, .55, ['rgba(255,255,255,.55)', 'rgba(255,255,255,.15)', 'rgba(255,255,255,0)'], 'screen', 1), T('#2a1a55', 'lighten', .2), VG(.5), BL(.35), NZ(.25)],
  paparazzi:  [CM({ c: .45, b: .1, s: -.1 }), RG(.5, .4, .45, ['rgba(255,255,255,.9)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,0)'], 'screen', 1), VG(.7), ST(3, 6, ['rgba(255,255,255,1)'], 77), BL(.4), NZ(.2)],
  neon:       [ED('neon', [40, 255, 240], 1.4), G(['#ff00c8', '#00f0ff'], 'screen', .18, 40), BL(.9)],
  chrome:     [CM({ g: 1, c: .55, b: -.02 }), G(['#9fb4c8', '#ffffff', '#556677', '#e8f0f8'], 'overlay', .9, 70), T('#5aa0ff', 'soft-light', .3), BL(.4)],
  hologram:   [CM({ s: .1, c: .15 }), G(['#ff6ad5', '#6adcff', '#c8ffb0', '#ffd86a', '#b46aff'], 'overlay', .7, 20), G(['#00ffee', '#ff00cc'], 'screen', .15, 110), F('rgb', .5), SC(.12), BL(.4)],
  prism:      [F('rgb', .9), G(['rgba(255,0,80,0)', 'rgba(255,160,0,.5)', 'rgba(255,255,0,.5)', 'rgba(0,255,120,.5)', 'rgba(0,160,255,.5)', 'rgba(160,0,255,0)'], 'screen', .7, 35), BL(.3), F('ghost', .5)],
  rainbow:    [G(RB, 'soft-light', 1, 20), G(RB, 'screen', .22, 20), CM({ s: .15 }), BL(.25)],
  aurora:     [CM({ b: -.12, c: .1 }), G(['rgba(0,255,140,0)', 'rgba(0,255,140,.55)', 'rgba(120,60,255,.5)', 'rgba(255,60,200,0)'], 'screen', .9, 95), ST(30, 1.2, [WH], 15), BL(.5)],
  dreamy:     [SF(.55), BL(.7), T('#ffc6e8', 'soft-light', .5), CM({ s: -.05, c: -.1, b: .06 }), ST(25, 1.6, [WH], 21)],
  dream:      [SF(.6), BL(.6), G(['#7a8bff', '#ff9be6'], 'soft-light', .7, 70), CM({ c: -.1, b: .04 }), NZ(.12)],
  fairy:      [SF(.4), BL(.6), T('#ffb3f0', 'soft-light', .45), G(['#a8ffd8', '#ffb3f0'], 'screen', .2, 45), ST(70, 2, [WH, 'rgba(255,200,250,.95)', 'rgba(190,255,230,.95)'], 31)],
  ethereal:   [CM({ s: -.35, b: .1, c: -.18 }), SF(.55), BL(.8), T('#dfe9ff', 'soft-light', .5), RY(.8, 0, 5, '255,255,255', .18, 6)],
  angel:      [CM({ b: .12, c: -.12, s: -.15 }), BL(1), T('#fffbe8', 'soft-light', .45), RY(.5, -.05, 9, '255,250,225', .28, 7), SF(.35), ST(15, 2, [WH], 41)],
  heavenly:   [BL(.8), T('#ffe2a0', 'soft-light', .5), RY(.95, -.05, 8, '255,225,150', .3, 8), G(['rgba(255,236,170,.4)', 'rgba(255,236,170,0)'], 'screen', .8, 60), SF(.3)],
  cosmic:     [CM({ b: -.2, c: .2, s: .1 }), G(['#1b0b4a', '#6a1bb8', '#ff3fa4', '#0a1b6a'], 'screen', .6, 50), RG(.7, .3, .5, ['rgba(255,120,220,.5)', 'rgba(255,120,220,0)'], 'screen', 1), ST(110, 1.4, [WH, 'rgba(190,200,255,.9)', 'rgba(255,190,240,.9)'], 51), BL(.4)],
  galaxy:     [CM({ b: -.25, c: .25, s: .3 }), G(['#0b1040', '#3b1a8c', '#c21b9c', '#00b4c8'], 'screen', .7, 120), RG(.35, .6, .45, ['rgba(0,230,255,.45)', 'rgba(0,230,255,0)'], 'screen', 1), RG(.7, .3, .45, ['rgba(255,60,200,.5)', 'rgba(255,60,200,0)'], 'screen', 1), ST(160, 1.3, [WH, 'rgba(180,230,255,.9)', 'rgba(255,190,240,.9)'], 61), BL(.45)],
  space:      [CM({ b: -.3, c: .3, s: -.1 }), T('#001a4d', 'screen', .18), VG(.6), ST(60, 1.2, [WH], 71), RG(.85, .15, .25, ['rgba(120,170,255,.55)', 'rgba(120,170,255,0)'], 'screen', 1)],
  starry:     [CM({ b: -.15, c: .15 }), T('#0b1a5c', 'screen', .2), ST(90, 1.6, [WH, 'rgba(255,240,180,.95)'], 81), ST(10, 4, ['rgba(255,255,255,1)'], 82), BL(.6)],
  fire:       [CM({ c: .25, s: .3 }), T('#ff4a10', 'overlay', .55), G(['rgba(255,60,0,0)', 'rgba(255,90,0,.55)'], 'screen', 1, 90), FL(40, ['rgba(255,150,20,.55)', 'rgba(255,70,10,.5)', 'rgba(255,210,60,.45)'], 91), BL(.6), NZ(.1)],
  flame:      [CM({ c: .15, s: .15 }), T('#ff8a3a', 'soft-light', .5), FL(16, ['rgba(255,160,40,.5)', 'rgba(255,90,20,.45)'], 92), BL(.4)],
  smoke:      [CM({ s: -.3, c: -.08 }), SM(14, 93), SF(.3), T('#8a8f99', 'soft-light', .3), NZ(.15)],
  water:      [CM({ s: .05 }), T('#2aa8d8', 'soft-light', .55), WP(1, 1, 14, 9, .3), G(['rgba(255,255,255,.3)', 'rgba(255,255,255,0)'], 'screen', .7, 90), BL(.35)],
  ice:        [CM({ s: -.3, c: .15, b: .06 }), T('#9fe4ff', 'soft-light', .7), T('#cfeeff', 'screen', .18), ST(60, 1.2, [WH, 'rgba(190,240,255,.95)'], 94), BL(.5), NZ(.12)],
  glass:      [WP(0, 1.1, 0, 45, 0), WP(.6, 0, 30, 0, 0), F('rgb', .35), G(['rgba(255,255,255,.35)', 'rgba(255,255,255,0)', 'rgba(255,255,255,.15)'], 'screen', 1, 35), T('#dff3ff', 'soft-light', .3)],
  mirror:     [MI(false)],
  electric:   [CM({ b: -.12, c: .25, s: -.1 }), T('#2a5cff', 'screen', .2), BO(5, '#6ab8ff', 3), F('rgb', .35), BL(.7)],
  cyberpunk:  [CM({ c: .3, s: .35 }), G(['#ff1fb4', '#00e6ff'], 'overlay', .7, 30), F('glitch', .45), SC(.15), BL(.55), VG(.4)],
  matrix:     [CM({ g: 1, c: .5, b: -.1 }), T('#00ff66', 'multiply', 1), MX, SC(.2), BL(.5)],
  anime:      [CM({ s: .35, c: .2, b: .05, p: 7 }), ED('line', [20, 20, 40], .9), SF(.2), BL(.35), ST(12, 2, [WH], 101)],
  comic:      [CM({ s: .4, c: .35, p: 5 }), HT(110, true), ED('line', [0, 0, 0], 1.1)],
  sketch:     [ED('sketch', null, 1), NZ(.1)],
  doodle:     [CM({ b: .04, s: .1 }), DO(['#ffffff', '#ff7ac8', '#ffe14d', '#6be0ff'], 9)],
  graffiti:   [CM({ c: .35, s: .5, p: 6 }), ED('line', [0, 0, 0], 1.2), SP(60, ['#ff2bd6', '#00e5ff', '#ffe14d', '#7dff3b'], 12)],
  sticker:    [SK],
  newspaper:  [CM({ g: 1, c: .35 }), HT(130, false, '#1b1b1b'), T('#e9dcc0', 'multiply', .55), NZ(.25), F('dust', .5)],
  collage:    [TL(2)],
  distortion: [BG(.55), WP(2.2, 2.2, 6, 5, 0), F('rgb', .55)]
};
function runRecipe(steps, x, w, h, k) {
  const o = copyCanvas(x.canvas, 'rc');
  steps.forEach(s => s(x, w, h));
  const a = clamp(k * 1.3, 0, 1);
  if (a < 1) { x.save(); x.globalAlpha = 1 - a; x.drawImage(o, 0, 0); x.restore(); }
}
function runEffect(id, ctx, w, h, k) {
  k = clamp(k, 0.05, 1);
  if (RC[id]) runRecipe(RC[id], ctx, w, h, k); else if (FX[id]) FX[id](ctx, w, h, k);
}

/* colour + glow + effect + grain */
function post(ctx, w, h) {
  const e = curEff();
  process(ctx, w, h, e);
  px3color(ctx, w, h);
  bloom(ctx, w, h, e.glow);
  if (st.effect !== 'none') runEffect(st.effect, ctx, w, h, st.fxk / 100);
  px3local(ctx, w, h);
  grain(ctx, w, h, e.grain);
  px3top(ctx, w, h);
}

/* ================= frames ================= */
function curFilter() { return FILTERS.find(f => f.id === st.filter); }
function curFrame() { return FRAMES.find(f => f.id === st.frame); }
function curEff() { return effective(st, curFilter(), st.strength / 100); }

/* crop mode in force: the Size panel (when active) overrides the Format Fill/Fit switch */
function effCrop() {
  if (!st.custom) return st.crop;
  return st.sizeFit === 'fill' ? 'cover' : st.sizeFit === 'stretch' ? 'stretch' : 'fit-solid';
}
function outSize() {
  const p = PLATFORMS.find(x => x.id === st.platform);
  if (!st.work) return { W: 0, H: 0 };
  if (st.custom) return { W: st.custom.W, H: st.custom.H };
  if (p.id === 'original') return { W: st.work.width, H: st.work.height };
  return { W: p.w, H: p.h };
}
function layout(W, H) {
  const f = curFrame();
  if (!f || f.id === 'none') return { ix: 0, iy: 0, iw: W, ih: H, f: null };
  const fk = (typeof T3 !== 'undefined' && T3.frameK) ? T3.frameK / 100 : 1;   // round 3: Frames tool scales thickness
  const l = Math.round(f.l * W * fk), t = Math.round(f.t * W * fk), r = Math.round(f.r * W * fk), b = Math.round(f.b * W * fk);
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
const geo = { key: '', c: null };
/* geometry (crop + high-quality downscale) is the expensive part: cache it while only colour sliders move */
function geoInto(ctx, src, w, h, cache) {
  const cm = effCrop();
  if (!cache) { geometry(ctx, src, w, h, cm, st.fx, st.fy); return; }
  const key = [st.srcId, w, h, cm, cm === 'fit-solid' ? st.sizeBg : '', st.fx.toFixed(5), st.fy.toFixed(5), prepSig()].join('|');
  if (geo.key !== key || !geo.c) {
    if (!geo.c) geo.c = mk(w, h); else if (geo.c.width !== w || geo.c.height !== h) { geo.c.width = w; geo.c.height = h; }
    geometry(geo.c.getContext('2d'), src, w, h, cm, st.fx, st.fy);
    geo.key = key;
  }
  ctx.drawImage(geo.c, 0, 0);
}

function renderInto(ctx, src, W, H, raw, cache) {
  const L = layout(W, H);
  const base = raw ? src : preparedFor(src);      // round 3: crop / rotate / perspective / expand bake into the base image
  if (!L.f) {
    geoInto(ctx, base, W, H, cache);
    if (!raw) post(ctx, W, H);
    return;
  }
  const ph = scratch('ph', L.iw, L.ih), pc = ph.getContext('2d', { willReadFrequently: true });
  geoInto(pc, base, L.iw, L.ih, cache);
  if (!raw) post(pc, L.iw, L.ih);
  drawFrame(ctx, W, H, L, ph);
}

/* ================= preview ================= */
function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
/* while a slider / drag is active render a lighter preview, then refine when the finger stops */
let fastT = 0;
function scheduleFast() {
  st.fast = true;
  clearTimeout(fastT);
  fastT = setTimeout(() => { st.fast = false; scheduleRender(); }, 220);
  scheduleRender();
}
const previewSide = () => st.fast ? 640 : PREVIEW_SIDE;

function render() {
  if (!st.small) return;
  const { W, H } = outSize();
  const sc = Math.min(1, previewSide() / Math.max(W, H));
  const pw = Math.max(1, Math.round(W * sc)), ph = Math.max(1, Math.round(H * sc));

  if (cAfter.width !== pw || cAfter.height !== ph) { cAfter.width = pw; cAfter.height = ph; }
  const ctx = cAfter.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, pw, ph);
  try { renderInto(ctx, st.small, pw, ph, false, true); }
  catch (e) {                                   // never leave a black preview: fall back to the plain photo
    ctx.clearRect(0, 0, pw, ph);
    try { drawScaled(ctx, st.small, 0, 0, st.small.width, st.small.height, 0, 0, pw, ph); } catch (_) {}
    toast('Preview fallback: ' + String(e && e.message || e).slice(0, 70));
  }

  const key = [pw, ph, effCrop(), st.sizeBg, st.fx.toFixed(4), st.fy.toFixed(4), st.frame, st.caption].join('|');
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
  sizeInfo();
  scheduleEstimate();
  drawOverlay();
}

function applyCompare() {
  handle.style.left = st.cmp + '%';
  cBefore.style.clipPath = 'inset(0 ' + (100 - st.cmp) + '% 0 0)';
}

/* how much the photo is enlarged to reach the output (1 = none) */
function upFactor() {
  if (!st.work) return 1;
  const { W, H } = outSize();
  const L = layout(W, H), cm = effCrop(), sw = st.work.width, sh = st.work.height;
  if (cm === 'stretch') return Math.max(L.iw / sw, L.ih / sh);
  return cm === 'cover' ? Math.max(L.iw / sw, L.ih / sh) : Math.min(L.iw / sw, L.ih / sh);
}
function updateNote() {
  const parts = [];
  if (st.tab === 'move') parts.push('Drag the photo to choose what stays visible.');
  if (st.note) parts.push(st.note);
  if (st.work) {
    const sc = upFactor();
    if ((st.platform !== 'original' || st.custom) && sc > 2) parts.push('Source is ' + st.work.width + ' × ' + st.work.height + ' and is enlarged ' + sc.toFixed(1) + '×. Detail will look soft.');
    else if ((st.platform !== 'original' || st.custom) && sc > 1.02) parts.push('Source is ' + st.work.width + ' × ' + st.work.height + ' — it will be enlarged to fit this format.');
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
  const b1 = $('#sliders'), b2 = $('#sliders2');
  b1.innerHTML = ''; b2.innerHTML = '';
  SLIDERS.forEach(s => (s.g ? b2 : b1).appendChild(slider(s.label, s.min, s.max, st[s.k], v => fmtVal(s, v), v => { st[s.k] = v; scheduleFast(); })));
  const rs = $('#rowStrength'); rs.innerHTML = '';
  rs.appendChild(slider('Filter strength', 0, 100, st.strength, v => v + '%', v => { st.strength = v; scheduleFast(); }));
  const rf = $('#rowFx'); rf.innerHTML = '';
  rf.appendChild(slider('Effect strength', 0, 100, st.fxk, v => v + '%', v => { st.fxk = v; scheduleFast(); }));
}

function syncUI() {
  $$('#platforms .card').forEach(b => b.classList.toggle('on', !st.custom && b.dataset.id === st.platform));
  $$('#frames .card').forEach(b => b.classList.toggle('on', b.dataset.id === st.frame));
  $$('#filters .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === st.filter));
  $$('#effects .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === st.effect));
  $$('#editor .seg').forEach(g => {
    const k = g.dataset.key;
    if (!k) return;
    $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === st[k]));
  });
  $('#rowFx').hidden = st.effect === 'none';
  $('#capRow').hidden = !curFrame().cap;
  const orig = st.platform === 'original';
  $('#cropBlk .seg').classList.toggle('dis', orig || !!st.custom);
  $('#cropHint').textContent = st.custom
    ? 'The Size panel is active and controls fit.'
    : orig
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
  const canMove = effCrop() === 'cover' && trims();
  mv.hidden = !canMove;
  if (!canMove && st.tab === 'move') setTab('result');
  syncSizeUI();
}

function setTab(t) {
  st.tab = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  stage.classList.toggle('cmp', t === 'compare');
  stage.classList.toggle('move', t === 'move');
  updateNote();
}

/* ================= stage interactions ================= */
let drag = null;
stage.addEventListener('pointerdown', e => {
  if (!T3.paint && st.tab !== 'compare' && st.tab !== 'move') return;
  stage.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, fx: st.fx, fy: st.fy };
  if (T3.paint) { paintDown(e); return; }
  if (st.tab === 'compare') moveCmp(e);
});
stage.addEventListener('pointermove', e => {
  if (!drag) return;
  if (st.tab === 'compare') { moveCmp(e); return; }
  if (T3.paint) { paintMove(e); return; }
  if (st.tab === 'move') {
    const r = stage.getBoundingClientRect();
    const sw = st.work.width, sh = st.work.height;
    const { W, H } = outSize();
    const L = layout(W, H), ar = L.iw / L.ih;
    let cw = sw, ch = sh;
    if (ar > sw / sh) ch = sw / ar; else cw = sh * ar;
    if (sw - cw > 0.5) st.fx = clamp(drag.fx - ((e.clientX - drag.x) / r.width) * (W / L.iw) * cw / (sw - cw), 0, 1);
    if (sh - ch > 0.5) st.fy = clamp(drag.fy - ((e.clientY - drag.y) / r.height) * (H / L.ih) * ch / (sh - ch), 0, 1);
    scheduleFast();
  }
});
const endDrag = () => { drag = null; paintUp(); };
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

let lastErr = null;
function adopt(work, name, note, platform) {
  let small = work;
  const tw = work.width, th = work.height;
  if (Math.max(tw, th) > SMALL_SIDE) {
    const k = SMALL_SIDE / Math.max(tw, th);
    small = mk(Math.round(tw * k), Math.round(th * k));
    drawScaled(small.getContext('2d'), work, 0, 0, tw, th, 0, 0, small.width, small.height);
  }
  st.srcId++;
  st.work = work; st.small = small; st.note = note || ''; st.name = name;
  if (platform) st.platform = platform;
  st.fx = st.fy = .5; beforeKey = '';
  st.custom = null;                       // a new photo starts from the Format preset
  const safe = fn => { try { fn(); } catch (e) { lastErr = e; } };
  safe(adoptT3);                         // clean round-3 state (tools, looks, smart pick)
  show('editor');                        // always open the editor once the photo has decoded
  safe(syncUI); safe(() => setTab('result'));
  safe(render); safe(updateNote);
  safe(renderThumbs);
  if (lastErr) { const m = String(lastErr && lastErr.message || lastErr); lastErr = null; toast('Photo opened, but a step failed: ' + m.slice(0, 80)); }
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
    toast('Could not open this image (' + String(err && err.message || err).slice(0, 60) + '). Try another JPG, PNG or WEBP.');
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
    c = await renderExport();                       // full-res grade runs in worker-bg.js when available
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
    const fname = st.name + '-' + (st.custom ? st.custom.W + 'x' + st.custom.H : (SLUG[st.platform] || 'photo')) + '-PicalexHQ.' + ext;
    const url = URL.createObjectURL(blob);
    if (/; wv\)/.test(navigator.userAgent)) {
      openSheet(url, blob, fname);                 // Android WebView often ignores a[download]
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  } catch (err) {
    toast('Export failed. Try a smaller format or a lower quality.');
  } finally {
    if (c) { c.width = c.height = 0; }
    freeScratch();
    busy(false);
  }
}
const SLUG = { original: 'original', 'ig-story': 'story', 'ig-portrait': 'portrait', 'ig-square': 'square', tiktok: 'tiktok', 'fb-portrait': 'facebook' };

let sheetUrl = '';
function openSheet(url, blob, fname) {
  sheetUrl = url;
  $('#sheetImg').src = url;
  const file = new File([blob], fname, { type: blob.type });
  const can = navigator.canShare && navigator.canShare({ files: [file] });
  const sb = $('#sheetShare');
  sb.hidden = !can;
  sb.onclick = () => { navigator.share({ files: [file] }).catch(() => {}); };
  $('#sheet').hidden = false;
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetImg').removeAttribute('src');
  if (sheetUrl) { URL.revokeObjectURL(sheetUrl); sheetUrl = ''; }
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
let colRaf = 0;
function colSchedule() { if (!colRaf) colRaf = requestAnimationFrame(() => { colRaf = 0; colRender(); }); }
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
    ci.addEventListener('input', () => { col.bg = ci.value; colSync(); colSchedule(); });
    sw.appendChild(ci);
    $$('#cAr button').forEach(b => b.addEventListener('click', () => { col.ar = b.dataset.v; colSync(); colRender(); }));
    $('#cGap').addEventListener('input', e => { col.gap = +e.target.value; $('#oGap').textContent = col.gap; colSchedule(); });
    $('#cRad').addEventListener('input', e => { col.rad = +e.target.value; $('#oRad').textContent = col.rad; colSchedule(); });
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
    st.crop = 'cover';
    adopt(c, 'collage', '', AR_PLATFORM[col.ar]);
  } finally { busy(false); }
}

/* ================= round 2: Size panel ================= */
/* Output size lives in st.custom ({W,H}); null means "use the Format preset". Resampling is unchanged:
   drawScaled() halves step by step and finishes with one high-quality draw. */
const szW = $('#szW'), szH = $('#szH');
const presetDims = p => {
  if (!st.work) return { W: 0, H: 0 };
  if (p.orig) return { W: st.work.width, H: st.work.height };
  if (p.long) { const k = p.long / Math.max(st.work.width, st.work.height); return { W: Math.round(st.work.width * k), H: Math.round(st.work.height * k) }; }
  return { W: p.w, H: p.h };
};
function setCustom(W, H) {
  W = clamp(Math.round(W) || 0, 16, MAX_SIDE); H = clamp(Math.round(H) || 0, 16, MAX_SIDE);
  if (W * H > MAX_OUT_PX) { const k = Math.sqrt(MAX_OUT_PX / (W * H)); W = Math.floor(W * k); H = Math.floor(H * k); toast('Size capped at ' + W + ' × ' + H + ' to protect your device memory.'); }
  st.custom = { W, H };
  syncUI(); updateNote(); scheduleRender();
}
function buildSizeUI() {
  const box = $('#sizePresets');
  box.innerHTML = '';
  SIZE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'card'; b.dataset.id = p.id; b.type = 'button';
    b.innerHTML = '<b></b><small></small>';
    b.firstChild.textContent = p.name; b.lastChild.textContent = p.sub;
    b.addEventListener('click', () => {
      if (!st.work) return;
      const d = presetDims(p);
      st.sizeRatio = d.W / d.H; st.fx = st.fy = .5;
      setCustom(d.W, d.H);
      writeSizeFields();
    });
    box.appendChild(b);
  });
  const edit = which => {
    const el = which === 'w' ? szW : szH;
    const v = parseInt(el.value.replace(/\D/g, ''), 10);
    if (!(v >= 16) || !st.work) return;                     // ignore half-typed numbers
    const cur = outSize();
    let W = cur.W, H = cur.H;
    if (which === 'w') { W = v; if (st.sizeKeep) H = Math.round(v / st.sizeRatio); }
    else { H = v; if (st.sizeKeep) W = Math.round(v * st.sizeRatio); }
    if (!st.sizeKeep) st.sizeRatio = W / H;
    setCustom(W, H);
    const other = which === 'w' ? szH : szW;
    const o = outSize();
    other.value = which === 'w' ? o.H : o.W;
  };
  szW.addEventListener('input', () => edit('w'));
  szH.addEventListener('input', () => edit('h'));
  [szW, szH].forEach(el => el.addEventListener('change', writeSizeFields));
  $('#szKeep').addEventListener('change', e => {
    st.sizeKeep = e.target.checked;
    if (st.sizeKeep && st.work) { const o = outSize(); st.sizeRatio = o.W / o.H; }
  });
  $$('#szSw button').forEach(b => b.addEventListener('click', () => { st.sizeBg = b.dataset.c; $('#szBg').value = st.sizeBg; syncUI(); scheduleRender(); }));
  $('#szBg').addEventListener('input', e => { st.sizeBg = e.target.value; syncUI(); scheduleRender(); });
}
function writeSizeFields() {
  const o = outSize();
  szW.value = o.W || ''; szH.value = o.H || '';
}
function syncSizeUI() {
  if (!st.work) return;
  const o = outSize();
  $$('#sizePresets .card').forEach(b => {
    const p = SIZE_PRESETS.find(x => x.id === b.dataset.id), d = presetDims(p);
    b.classList.toggle('on', !!st.custom && d.W === o.W && d.H === o.H);
  });
  if (document.activeElement !== szW && document.activeElement !== szH) writeSizeFields();
  $('#szKeep').checked = st.sizeKeep;
  $('#szBgRow').hidden = st.sizeFit !== 'fit';
  $('#szWarn').hidden = st.sizeFit !== 'stretch';
  $$('#szSw button').forEach(b => b.classList.toggle('on', b.dataset.c === st.sizeBg));
  $('#szFitHint').textContent = st.sizeFit === 'fill'
    ? 'Fill crops the edges so the frame is fully covered.'
    : st.sizeFit === 'fit' ? 'Fit keeps the whole photo and fills the rest with a solid colour.' : '';
  $('#szFit').parentNode.classList.toggle('dim', !st.custom);
}
const SZ_NOTE_ID = '#szNote';
function sizeInfo() {
  if (!st.work) return;
  const { W, H } = outSize();
  const mp = (W * H / 1e6).toFixed(1);
  const est = estimate.bytes ? ' · about ' + fmtSize(estimate.bytes) + ' as ' + st.fmt.toUpperCase() : '';
  const line = W + ' × ' + H + ' px · ' + mp + ' MP' + est;
  $('#szInfo').textContent = line;
  $('#expInfo').textContent = 'Output ' + line;
  const up = upFactor();
  const n = $(SZ_NOTE_ID);
  if ((st.platform !== 'original' || st.custom) && up > 2) {
    n.hidden = false;
    n.textContent = 'Enlarged ' + up.toFixed(1) + '× from the ' + st.work.width + ' × ' + st.work.height + ' source. Beyond 2× the photo looks soft. A smaller size gives a sharper result.';
  } else if ((st.platform !== 'original' || st.custom) && up > 1.02) {
    n.hidden = false;
    n.textContent = 'Enlarged ' + up.toFixed(1) + '× from the source. Fine detail may look slightly soft.';
  } else n.hidden = true;
}
/* file size estimate: encode the preview once, scale by pixel count. A rough figure, labelled "about". */
const estimate = { bytes: 0, key: '' };
let estT = 0;
function scheduleEstimate() { clearTimeout(estT); estT = setTimeout(runEstimate, 500); }
async function runEstimate() {
  if (!st.small || st.fast || view !== 'editor' || !cAfter.width) return;
  const { W, H } = outSize(), pw = cAfter.width, ph = cAfter.height;
  const key = [st.fmt, st.quality, W, H, st.srcId, st.filter, st.effect, st.frame].join('|');
  try {
    const q = st.fmt === 'png' ? undefined : QUALITY[st.fmt][st.quality];
    const blob = await new Promise(r => cAfter.toBlob(r, MIME[st.fmt], q));
    if (!blob) return;
    estimate.bytes = blob.size * (W * H) / (pw * ph);
    estimate.key = key;
    sizeInfo();
  } catch (_) { /* estimate is optional */ }
}


/* ================= round 3: tools engine ================= */
const T3 = {
  look: 'none', lookK: 100,
  amb: 0, temp: 0, tint: 0, struct: 0,
  curves: null,                       // sorted [[x,y]..] 0..1, y up
  cropR: null, rot: 0, rotQ: 0, flipH: false, flipV: false,
  perspV: 0, perspH: 0, expand: 0,
  sel: [], brush: [], heal: [],
  lens: { k: 0, mode: 'radial', u: .5, v: .45, rad: .55 },
  styles: {}, bwTone: 'neu',
  dxOn: false, dxImg: null, dxMode: 'screen', dxK: 60,
  txt: { on: false, str: '', size: 9, color: '#ffffff', font: 'sans', outline: true, shadow: true, k: 100, u: .5, v: .82 },
  frameK: 100,
  paint: null
};
function resetT3() {
  Object.assign(T3, {
    look: 'none', lookK: 100, amb: 0, temp: 0, tint: 0, struct: 0, curves: null,
    cropR: null, rot: 0, rotQ: 0, flipH: false, flipV: false, perspV: 0, perspH: 0, expand: 0,
    sel: [], brush: [], heal: [], lens: { k: 0, mode: 'radial', u: .5, v: .45, rad: .55 },
    styles: {}, bwTone: 'neu', dxOn: false, dxImg: null, dxMode: 'screen', dxK: 60,
    txt: { on: false, str: '', size: 9, color: '#ffffff', font: 'sans', outline: true, shadow: true, k: 100, u: .5, v: .82 },
    frameK: 100, paint: null
  });
  prep.key = ''; analysis = null;
}
const prepActive = () => !!(T3.cropR || T3.rot || T3.rotQ || T3.flipH || T3.flipV || T3.perspV || T3.perspH || T3.expand);
const prepSig = () => [
  T3.cropR ? [T3.cropR.x, T3.cropR.y, T3.cropR.w, T3.cropR.h].map(n => n.toFixed(4)).join(',') : '',
  T3.rot, T3.rotQ, T3.flipH ? 1 : 0, T3.flipV ? 1 : 0, T3.perspV, T3.perspH, T3.expand
].join('|');

const prep = { key: '', c: null };
function preparedFor(src) {
  if (!prepActive()) return src;
  const o2 = outSize();
  const sig = [st.srcId, src.width, src.height, prepSig(), o2.W, o2.H, st.fx.toFixed(4), st.fy.toFixed(4), effCrop()].join('|');
  if (prep.key === sig && prep.c) return prep.c;
  let cur = src;
  if (T3.cropR) {                                   // 1 crop: fractions of the visible frame
    const o = outSize(), L = layout(o.W, o.H), ar = L.iw / L.ih;
    const sw0 = src.width, sh0 = src.height, cm = effCrop();
    let vw = sw0, vh = sh0, vx = 0, vy = 0;
    if (cm === 'cover') {
      if (ar > sw0 / sh0) { vh = sw0 / ar; vy = (sh0 - vh) * st.fy; }
      else { vw = sh0 * ar; vx = (sw0 - vw) * st.fx; }
    }
    const r = T3.cropR;
    const rx = Math.round(vx + r.x * vw), ry = Math.round(vy + r.y * vh);
    const rw = Math.max(2, Math.round(r.w * vw)), rh = Math.max(2, Math.round(r.h * vh));
    const t = mk(rw, rh);
    t.getContext('2d').drawImage(src, rx, ry, rw, rh, 0, 0, rw, rh);
    cur = t;
  }
  if (T3.rotQ || T3.rot || T3.flipH || T3.flipV) {  // 2 flips + quarter turns + free rotate with auto-zoom
    const q = ((T3.rotQ % 4) + 4) % 4, swap = q % 2 === 1;
    const a = T3.rot * Math.PI / 180;
    const sw0 = cur.width, sh0 = cur.height;
    const sw = swap ? sh0 : sw0, sh = swap ? sw0 : sh0;
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    const z = Math.min(1 / Math.max(.001, Math.min((sw * ca + sh * sa) / sw, (sw * sa + sh * ca) / sh)), 3);
    const t = mk(sw, sh), x = t.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.translate(sw / 2, sh / 2); x.rotate(q * Math.PI / 2 + a);
    x.scale((T3.flipH ? -1 : 1) * z, (T3.flipV ? -1 : 1) * z);
    x.drawImage(cur, -sw0 / 2, -sh0 / 2);
    if (cur !== src) { cur.width = cur.height = 0; }
    cur = t;
  }
  if (T3.perspV || T3.perspH) {                       // 3 keystone as strips
    if (T3.perspV) {
      const k = T3.perspV / 100 * .5, w = cur.width, h = cur.height;
      const t = mk(w, h), x = t.getContext('2d'), N = Math.min(240, h);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      for (let i = 0; i < N; i++) {
        const v = i / (N - 1), sy = Math.floor(v * h), sh2 = Math.ceil(h / N);
        const sc = 1 + k * (1 - 2 * v), dw = Math.max(1, w * sc);
        x.drawImage(cur, 0, sy, w, sh2, (w - dw) / 2, i / N * h, dw, h / N + 1);
      }
      if (cur !== src) { cur.width = cur.height = 0; }
      cur = t;
    }
    if (T3.perspH) {
      const k = T3.perspH / 100 * .5, w = cur.width, h = cur.height;
      const t = mk(w, h), x = t.getContext('2d'), N = Math.min(240, w);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), sx = Math.floor(u * w), sw2 = Math.ceil(w / N);
        const sc = 1 + k * (1 - 2 * u), dh = Math.max(1, h * sc);
        x.drawImage(cur, sx, 0, sw2, h, i / N * w, (h - dh) / 2, w / N + 1, dh);
      }
      if (cur !== src) { cur.width = cur.height = 0; }
      cur = t;
    }
  }
  if (T3.expand > 0) {                                // 4 expand: edge stretch beyond the frame
    const e = T3.expand / 100, w = cur.width, h = cur.height;
    const W2 = Math.round(w * (1 + e)), H2 = Math.round(h * (1 + e));
    const bx = (W2 - w) / 2, by = (H2 - h) / 2;
    const t = mk(W2, H2), x = t.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, bx, by);
    const strip = (sx, sy, sw, sh, dx, dy, dw, dh) => { if (sw > 0 && sh > 0 && dw > 0 && dh > 0) x.drawImage(cur, sx, sy, sw, sh, dx, dy, dw, dh); };
    strip(0, 0, w, 2, 0, 0, W2, by);                  // top + bottom stretched edges
    strip(0, h - 2, w, 2, 0, by + h, W2, by);
    strip(0, 0, 2, h, 0, by, bx, h);                  // left + right
    strip(w - 2, 0, 2, h, bx + w, by, bx, h);
    if (cur !== src) { cur.width = cur.height = 0; }
    cur = t;
  }
  prep.key = sig; prep.c = cur;
  return cur;
}

/* ---- local masks in output-frame space (fractions of the framed image) ---- */
let brushSprite3 = null;
function sprite3() {
  if (!brushSprite3) {
    brushSprite3 = mk(64, 64);
    const x = brushSprite3.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  }
  return brushSprite3;
}
function dot(x, u, v, r, W, H) { x.drawImage(sprite3(), u * W - r, v * H - r, 2 * r, 2 * r); }
function strokePath(x, pts, r, W, H) {
  const step = Math.max(1, r * .3); let pu = null, pv = null;
  for (let i = 0; i < pts.length; i += 2) {
    const u = pts[i], v = pts[i + 1];
    if (pu === null) dot(x, u, v, r, W, H);
    else {
      const du = (u - pu) * W, dv = (v - pv) * H, n = Math.max(1, Math.ceil(Math.hypot(du, dv) / step));
      for (let k = 1; k <= n; k++) dot(x, pu + (u - pu) * k / n, pv + (v - pv) * k / n, r, W, H);
    }
    pu = u; pv = v;
  }
}
function buildMask(W, H, draw) {
  const m = mk(W, H), x = m.getContext('2d');
  x.clearRect(0, 0, W, H);
  draw(x);
  return m;
}
function selMask(W, H) {           // selective points: sum of radial blobs, clamped via destination-atop union
  return buildMask(W, H, x => {
    T3.sel.forEach(p => {
      const g = x.createRadialGradient(p.u * W, p.v * H, 0, p.u * W, p.v * H, p.rad * Math.min(W, H));
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.7, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
  });
}
function brushMask(W, H, mode) {
  return buildMask(W, H, x => T3.brush.filter(s => s.mode === mode).forEach(s => strokePath(x, s.p, s.size / 100 * Math.min(W, H) / 2, W, H)));
}
function healMask(W, H) {
  return buildMask(W, H, x => T3.heal.forEach(p => dot(x, p.u, p.v, p.r * Math.min(W, H), W, H)));
}

/* stage (screen) -> output-frame fractions; mirrors the geometry the preview uses */
function stageToOut(e) {
  const r = stage.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  const { W, H } = outSize(), L = layout(W, H);
  return { u: (u * W - L.ix) / L.iw, v: (v * H - L.iy) / L.ih };
}

/* ---- curves: monotone cubic (Fritsch-Carlson) through editor points -> 256 LUT ---- */
function buildCurLut(pts) {
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
    const x = i / 255;
    let j = 0; while (j < n - 2 && x > xs[j + 1]) j++;
    const h = dx[j] || 1e-6, u = clamp((x - xs[j]) / h, 0, 1);
    const y = ys[j] * (2 * u ** 3 - 3 * u ** 2 + 1) + h * t[j] * (u ** 3 - 2 * u ** 2 + u)
            + ys[j + 1] * (-2 * u ** 3 + 3 * u ** 2) + h * t[j + 1] * (u ** 3 - u ** 2);
    lut[i] = clamp(Math.round(y * 255), 0, 255);
  }
  return lut;
}

/* ---- image analysis: runs once per photo on the small canvas; drives Looks + Smart pick ---- */
let analysis = null;
function analyze() {
  if (analysis) return analysis;
  const w = 160, h = Math.max(2, Math.round(160 * st.small.height / st.small.width));
  const t = mk(w, h), x = t.getContext('2d', { willReadFrequently: true });
  x.drawImage(st.small, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, N = w * h;
  let sl = 0, sl2 = 0, sr = 0, sg = 0, sb = 0, sSat = 0;
  let skin = 0, skinTop = 0, topN = 0, sky = 0, dark = 0, hi = 0;
  const warmC = { n: 0, s: 0 };
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    const l = r * .2126 + g * .7152 + b * .0722;
    sl += l; sl2 += l * l; sr += r; sg += g; sb += b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    sSat += sat;
    if (l < 52) dark++; if (l > 208) hi++;
    const isSkin = r > 70 && r > b + 8 && r >= g - 6 && g > b - 12 && (r - mn) > 8 && sat > .08 && sat < .75 && l > 45 && l < 235;
    if (isSkin) { skin++; if (y < h * .62) skinTop++; }
    if (y < h * .45) {
      topN++;
      if (b > r + 6 && b > 70 && sat < .6) sky++;
    }
    if (xx > w * .25 && xx < w * .75 && y > h * .3 && y < h * .85 && r > g && g >= b && sat > .3) { warmC.n++; warmC.s += sat; }
  }
  const mean = sl / N, varr = Math.max(0, sl2 / N - mean * mean);
  analysis = {
    mean: mean / 255, contrast: Math.sqrt(varr) / 128,
    cast: [(sr / N - mean) / 128, (sg / N - mean) / 128, (sb / N - mean) / 128],
    sat: sSat / N, dark: dark / N, hi: hi / N,
    skin: skin / N, skinTop: skinTop / (topN || 1),
    sky: sky / (topN || 1),
    warmCenter: warmC.n / N
  };
  t.width = t.height = 0;
  return analysis;
}

/* ---- adaptive Looks: each reads the analysis and returns colour params (k = user strength 0..1) ---- */
const LOOKS = [
  { id: 'morning', name: 'Morning', hint: 'Warm gentle lift',
    f: (a, k) => ({ b: 8 * k, temp: 14 * k, tint: 2 * k, s: 8 * k, lift: .3 * k, glow: .25 * k, fade: .02 * k, c: 4 * k }) },
  { id: 'noon', name: 'Noon', hint: 'Clean bright contrast',
    f: (a, k) => ({ b: (a.mean > .6 ? -6 : 6) * k, c: 12 * k, s: 6 * k, temp: -4 * k, clar: .3 * k, hl: .25 * k, sharp: 10 * k }) },
  { id: 'golden', name: 'Golden hour', hint: 'Rich amber warmth',
    f: (a, k) => ({ temp: 22 * k, tint: 4 * k, s: 12 * k, c: 8 * k, vig: .18 * k, glow: .2 * k, split: { sh: [10 * k, 2 * k, -8 * k], hi: [14 * k, 6 * k, -10 * k] } }) },
  { id: 'night', name: 'Night', hint: 'Deep cool mood',
    f: (a, k) => ({ b: (a.mean > .45 ? -14 : 4) * k, c: 14 * k, temp: -16 * k, tint: -2 * k, s: -6 * k, vig: .3 * k, clar: .25 * k, split: { sh: [-6 * k, 2 * k, 12 * k], hi: [-4 * k, 0, 6 * k] } }) },
  { id: 'rainy', name: 'Rainy', hint: 'Soft desaturated cool',
    f: (a, k) => ({ s: -18 * k, c: -4 * k, temp: -10 * k, b: 4 * k, fade: .06 * k, glow: .15 * k, lift: .25 * k }) }
];
function lookParams() {
  const L = LOOKS.find(l => l.id === T3.look);
  if (!L) return null;
  return L.f(analyze(), T3.lookK / 100);
}

/* ---- Snapseed-style studio styles: param bundles merged by their strength (0..1) ---- */
const STYLES3 = {
  hdr:     { name: 'HDR Scape',      p: { c: 22, s: 22, clar: .8, struct: .6, b: 2, sharp: 12 } },
  glamour: { name: 'Glamour Glow',   p: { glow: .8, temp: 6, s: -14, b: 6, c: -10, fade: .03 } },
  tcon:    { name: 'Tonal Contrast', p: {}, tc: [30, 18, 24] },
  drama:   { name: 'Drama',          p: { s: -50, c: 30, struct: .8, b: -8, vig: .3, clar: .3 } },
  vintage: { name: 'Vintage',        p: { fade: .25, temp: 12, s: -28, vig: .35, grain: .3, c: -8, lift: .2 } },
  grainy:  { name: 'Grainy Film',    p: { grain: .8, fade: .18, s: -22, c: 10, b: 3 } },
  retro:   { name: 'Retrolux',       p: { fade: .3, s: -18, grain: .4, vig: .3, temp: 10, c: -6 }, leak: 1 },
  grunge:  { name: 'Grunge',         p: { grain: .6, c: 38, s: -38, vig: .5, struct: .5, b: -6 }, tex: 1 },
  bw:      { name: 'Black & White',  p: { c: 14 }, bw: 1 },
  noir:    { name: 'Noir',           p: { c: 46, vig: .6, glow: .25, grain: .35, b: -4 }, bw: 1 }
};
const BW_TONES = { neu: [1, 1, 1], red: [1.5, .6, .4], org: [1.3, .9, .3], yel: [1.1, 1.1, .3], grn: [.6, 1.3, .5], blu: [.5, .8, 1.5] };

/* merge active looks + styles into one param object */
function mergeFx() {
  const o = { b: 0, c: 0, s: 0, temp: 0, tint: 0, lift: 0, hl: 0, fade: 0, vig: 0, clar: 0, struct: 0, glow: 0, grain: 0, sharp: 0, split: null, tc: null, bw: 0, leak: 0, tex: 0 };
  const add = (p, k) => {
    if (!p) return;
    ['b', 'c', 's', 'temp', 'tint', 'lift', 'hl', 'fade', 'vig', 'clar', 'struct', 'glow', 'grain', 'sharp'].forEach(key => { if (p[key]) o[key] += p[key]; });
    if (p.split) {
      if (!o.split) o.split = { sh: [0, 0, 0], hi: [0, 0, 0] };
      for (let i = 0; i < 3; i++) { o.split.sh[i] += p.split.sh[i]; o.split.hi[i] += p.split.hi[i]; }
    }
  };
  add(lookParams(), 1);
  for (const id in T3.styles) {
    const S = STYLES3[id], k = T3.styles[id] / 100;
    if (!S || !k) continue;
    const p = {}; for (const key in S.p) p[key] = S.p[key] * k;
    add(p, k);
    if (S.tc) { if (!o.tc) o.tc = [0, 0, 0]; for (let i = 0; i < 3; i++) o.tc[i] += S.tc[i] * k; }
    if (S.bw) o.bw = Math.max(o.bw, k);
    if (S.leak) o.leak = Math.max(o.leak, k);
    if (S.tex) o.tex = Math.max(o.tex, k);
  }
  o.temp += T3.temp * .9 + T3.amb * .15;
  o.tint += T3.tint;
  o.struct += T3.struct / 100;
  o.s += T3.amb * .5;
  return o;
}

/* ---- one pixel pass for white balance, curves, tune/details, styles and the active Look ---- */
function blurLumR(src, w, h, rr) {
  const b = new Uint8Array(src.length), c = new Uint8Array(src.length);
  blurH(src, b, w, h, rr); blurV(b, c, w, h, rr);
  blurH(c, b, w, h, rr); blurV(b, c, w, h, rr);
  return c;
}
function px3color(ctx, w, h) {
  const o = mergeFx();
  const clut = buildCurLut(T3.curves);
  const on = o.b || o.c || o.s || o.temp || o.tint || o.lift || o.hl || o.fade || o.vig ||
    o.clar || o.struct || o.split || o.tc || o.bw || o.sharp || clut;
  if (!on) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, N = w * h;
  const cf = 1 + o.c / 80, add = o.b * 1.7 / 255, K = 0.12 * 27 / 4;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    let x = i / 255;
    x += o.lift * K * 4 * x * (1 - x) * (1 - x);
    x -= o.hl * K * 4 * x * x * (1 - x);
    x = (x - 0.5) * cf + 0.5 + add;
    if (o.fade) x = o.fade + x * (1 - o.fade);
    lut[i] = Math.round(x * 255);
  }
  const gr = 1 + o.temp / 240, gg = 1 + o.tint / 220, gb = 1 - o.temp / 240;
  const sf = 1 + o.s / 100;
  let lumC = null, lumS = null;
  if (o.clar > 0.01 || o.struct > 0.01) {
    const lum = new Uint8Array(N);
    for (let p = 0, i = 0; p < N; p++, i += 4) lum[p] = (d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8;
    if (o.clar > 0.01) lumC = [lum, blurLumR(lum, w, h, Math.max(2, Math.round(Math.max(w, h) * .02)))];
    if (o.struct > 0.01) lumS = [lum, blurLumR(lum, w, h, Math.max(1, Math.round(Math.max(w, h) * .008)))];
  }
  const sp = o.split, tc = o.tc, bwt = o.bw ? BW_TONES[T3.bwTone] || BW_TONES.neu : null;
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
  ctx.putImageData(img, 0, 0);
}

/* ---- local tools, all in framed-photo space: heal, lens blur, portrait/face, selective, brush ---- */
function applyHeal(ctx, W, H) {
  if (!T3.heal.length) return;
  const src = copyCanvas(ctx.canvas, 'heal');
  T3.heal.forEach(p => {
    const cxp = p.u * W, cyp = p.v * H, r = Math.max(4, p.r * Math.min(W, H));
    let ox = Math.sign(p.u - .5) * r * 2.4 || r * 2.4, oy = Math.sign(p.v - .5) * r * 1.6 || r;
    const sx = clamp(cxp - r + ox, 0, W - 2 * r), sy = clamp(cyp - r + oy, 0, H - 2 * r);
    ox = sx - (cxp - r); oy = sy - (cyp - r);
    const t = mk(Math.round(2 * r), Math.round(2 * r)), x = t.getContext('2d');
    x.drawImage(src, sx, sy, 2 * r, 2 * r, 0, 0, 2 * r, 2 * r);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(sprite3(), 0, 0, 2 * r, 2 * r);
    ctx.drawImage(t, cxp - r, cyp - r);
    t.width = t.height = 0;
  });
}
function blurCopy(ctx, W, H, shift) {
  const s = scratch('lb' + shift, Math.max(2, W >> shift), Math.max(2, H >> shift));
  const c = s.getContext('2d');
  c.clearRect(0, 0, s.width, s.height);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(ctx.canvas, 0, 0, s.width, s.height);
  const up = scratch('lbu' + shift, W, H), uc = up.getContext('2d');
  uc.clearRect(0, 0, W, H);
  uc.imageSmoothingEnabled = true; uc.imageSmoothingQuality = 'high';
  uc.drawImage(s, 0, 0, W, H);
  return up;
}
function applyLens(ctx, W, H) {
  const L = T3.lens; if (L.k <= 0) return;
  const b1 = blurCopy(ctx, W, H, 2), b2 = blurCopy(ctx, W, H, 3);
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const d1 = b1.getContext('2d').getImageData(0, 0, W, H).data;
  const d2 = b2.getContext('2d').getImageData(0, 0, W, H).data;
  const k = L.k / 100, cxp = L.u * W, cyp = L.v * H, R = Math.max(8, L.rad * Math.max(W, H));
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i += 4) {
      let m;
      if (L.mode === 'radial') {
        const dd = Math.hypot(x - cxp, y - cyp) / R;
        m = clamp((dd - .45) / .75, 0, 1);
      } else {
        const dd = Math.abs(y - cyp) / R;
        m = clamp((dd - .3) / .7, 0, 1);
      }
      m *= k; if (m <= 0.004) continue;
      if (m < .5) { const t = m * 2;
        d[i] += (d1[i] - d[i]) * t; d[i + 1] += (d1[i + 1] - d[i + 1]) * t; d[i + 2] += (d1[i + 2] - d[i + 2]) * t;
      } else { const t = (m - .5) * 2;
        d[i] = d1[i] + (d2[i] - d1[i]) * t; d[i + 1] = d1[i + 1] + (d2[i + 1] - d1[i + 1]) * t; d[i + 2] = d1[i + 2] + (d2[i + 2] - d1[i + 2]) * t;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* portrait + face enhance: skin smoothing + face-zone lift, no AI (skin-tone heuristics) */
function applyFaceFx(ctx, W, H) {
  const pk = (T3.styles.portrait || 0) / 100, fk = (T3.styles.face || 0) / 100;
  if (pk <= 0 && fk <= 0) return;
  const smoothK = pk * .8 + fk * .5, brightK = pk * .12 + fk * .2, bgK = pk * .35;
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  const soft = blurCopy(ctx, W, H, 2).getContext('2d').getImageData(0, 0, W, H).data;
  const blurred = bgK > 0 ? blurCopy(ctx, W, H, 3).getContext('2d').getImageData(0, 0, W, H).data : null;
  const fx = W * .5, fy = H * .38, rx = W * .3, ry = H * .32;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = r * .2126 + g * .7152 + b * .0722;
    const sat = mx ? (mx - mn) / mx : 0;
    const skin = (r > 70 && r > b + 8 && r >= g - 6 && g > b - 12 && sat > .08 && sat < .75 && l > 45 && l < 235) ? 1 : 0;
    if (skin && smoothK > 0) {
      const t = smoothK * .85;
      d[i] += (soft[i] - r) * t; d[i + 1] += (soft[i + 1] - g) * t; d[i + 2] += (soft[i + 2] - b) * t;
    }
    const dd = ((x - fx) / rx) ** 2 + ((y - fy) / ry) ** 2;
    if (dd < 1 && brightK > 0) {
      const t = (1 - dd) * (1 - dd) * brightK;
      d[i] += (255 - d[i]) * t; d[i + 1] += (255 - d[i + 1]) * t; d[i + 2] += (255 - d[i + 2]) * t;
    }
    if (blurred && dd > 1.44) {
      const t = clamp((dd - 1.44) / 1.2, 0, 1) * bgK;
      d[i] += (blurred[i] - d[i]) * t; d[i + 1] += (blurred[i + 1] - d[i + 1]) * t; d[i + 2] += (blurred[i + 2] - d[i + 2]) * t;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* selective control points: sequential masked B/C/S adjustments */
function applySel(ctx, W, H) {
  T3.sel.forEach(p => {
    const R = p.rad * Math.min(W, H), cxp = p.u * W, cyp = p.v * H;
    const x0 = Math.max(0, Math.floor(cxp - R)), x1 = Math.min(W, Math.ceil(cxp + R));
    const y0 = Math.max(0, Math.floor(cyp - R)), y1 = Math.min(H, Math.ceil(cyp + R));
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0, h = y1 - y0;
    const img = ctx.getImageData(x0, y0, w, h), d = img.data;
    const cf = 1 + p.c / 250, ba = p.b * .55, sf = 1 + p.s / 100;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      const dd = Math.hypot(x0 + x - cxp, y0 + y - cyp) / R;
      if (dd >= 1) continue;
      const t = dd < .7 ? 1 : (1 - dd) / .3;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      let l = r * .2126 + g * .7152 + b * .0722;
      if (sf !== 1) { r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf; }
      r = (r - 128) * cf + 128 + ba; g = (g - 128) * cf + 128 + ba; b = (b - 128) * cf + 128 + ba;
      d[i] += (r - d[i]) * t; d[i + 1] += (g - d[i + 1]) * t; d[i + 2] += (b - d[i + 2]) * t;
    }
    ctx.putImageData(img, x0, y0);
  });
}

/* brush strokes: dodge / burn / saturate / warm */
const BRUSH_MODES = { dodge: 'Dodge (lighten)', burn: 'Burn (darken)', sat: 'Saturation', temp: 'Warmth' };
function applyBrush(ctx, W, H) {
  if (!T3.brush.length) return;
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  T3.brush.forEach(s => {
    const R = Math.max(3, s.size / 100 * Math.min(W, H) / 2), k = s.k / 100;
    for (let j = 0; j < s.p.length; j += 2) {
      const cxp = s.p[j] * W, cyp = s.p[j + 1] * H;
      const x0 = Math.max(0, Math.floor(cxp - R)), x1 = Math.min(W, Math.ceil(cxp + R));
      const y0 = Math.max(0, Math.floor(cyp - R)), y1 = Math.min(H, Math.ceil(cyp + R));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const dd = Math.hypot(x - cxp, y - cyp) / R;
        if (dd >= 1) continue;
        const t = (dd < .55 ? 1 : (1 - dd) / .45) * k * .35, i = (y * W + x) * 4;
        let r = d[i], g = d[i + 1], b = d[i + 2];
        if (s.mode === 'dodge') { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
        else if (s.mode === 'burn') { r *= 1 - t; g *= 1 - t; b *= 1 - t; }
        else if (s.mode === 'sat') { const l = r * .2126 + g * .7152 + b * .0722; r = l + (r - l) * (1 + t * 2); g = l + (g - l) * (1 + t * 2); b = l + (b - l) * (1 + t * 2); }
        else { r += 26 * t; b -= 26 * t; }
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
    }
  });
  ctx.putImageData(img, 0, 0);
}

function px3local(ctx, W, H) {
  applyHeal(ctx, W, H);
  applyLens(ctx, W, H);
  applyFaceFx(ctx, W, H);
  applySel(ctx, W, H);
  applyBrush(ctx, W, H);
}

/* ---- finishing layers: style overlays, double exposure, text ---- */
function px3top(ctx, W, H) {
  const o = mergeFx();
  if (o.glow > 0.02) bloom(ctx, W, H, o.glow);
  if (o.leak > 0.02) fxLeak(ctx, W, H, o.leak * .8);
  if (o.tex > 0.02) fxDust(ctx, W, H, o.tex * .5);
  if (T3.dxOn && T3.dxImg) {
    ctx.save();
    ctx.globalAlpha = T3.dxK / 100;
    ctx.globalCompositeOperation = T3.dxMode;
    coverDraw(ctx, T3.dxImg, W, H, .5, .5);
    ctx.restore();
  }
  if (o.grain > 0.02) grain(ctx, W, H, o.grain);
  drawText3(ctx, W, H);
}
const FONTS3 = {
  sans: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: 'ui-monospace,Menlo,Consolas,monospace',
  hand: '"Segoe Print","Bradley Hand","Comic Sans MS",cursive'
};
function drawText3(ctx, W, H) {
  const t = T3.txt;
  if (!t.on || !t.str) return;
  const size = Math.max(8, Math.round(W * t.size / 100));
  ctx.save();
  ctx.globalAlpha = t.k / 100;
  ctx.font = 'bold ' + size + 'px ' + (FONTS3[t.font] || FONTS3.sans);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const x = t.u * W, y = t.v * H;
  if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = size * .25; ctx.shadowOffsetY = size * .06; }
  if (t.outline) { ctx.lineWidth = Math.max(1.5, size * .09); ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t.str, x, y); ctx.shadowColor = 'transparent'; }
  ctx.fillStyle = t.color;
  ctx.fillText(t.str, x, y);
  ctx.restore();
}

/* ---- Smart suggestion (#10): classify the photo and recommend a Look ---- */
function smartPick() {
  const a = analyze();
  const pickLook = id => { T3.look = id; syncLooksUI(); scheduleRender(); toast('Applied the ' + LOOKS.find(l => l.id === id).name + ' look.'); };
  let type, look;
  if (a.mean < .3 || a.dark > .45) { type = 'a night or low-light photo'; look = 'night'; }
  else if (a.skin > .12 && a.skinTop > .1) { type = 'a portrait'; look = 'golden'; }
  else if (a.sky > .3) { type = 'an outdoor / sky shot'; look = a.mean > .62 ? 'noon' : 'morning'; }
  else if (a.warmCenter > .18) { type = 'a warm close-up (food?)'; look = 'morning'; }
  else if (a.sat < .16) { type = 'a flat, muted photo'; look = 'rainy'; }
  else { type = 'a daylight photo'; look = a.mean > .6 ? 'noon' : 'morning'; }
  return { type, look, apply: pickLook };
}

/* ================= round 3: Tools UI ================= */
const IC = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
const ICONS3 = {
  tune: IC('<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>'),
  details: IC('<path d="M12 3l2.2 5.6L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.8-.4z"/>'),
  curves: IC('<path d="M4 4v16h16"/><path d="M5 19C9 15 10 9 19 5"/>'),
  wb: IC('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>'),
  crop: IC('<path d="M7 3v14h14M3 7h14v14"/>'),
  rotate: IC('<path d="M20 12a8 8 0 1 1-3-6"/><path d="M17 2v4h-4"/>'),
  persp: IC('<path d="M6 4h12l2 16H4z"/><path d="M9 8h6M8 12h8M7 16h10"/>'),
  expand: IC('<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>'),
  selective: IC('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>'),
  brush: IC('<path d="M4 20c2 0 3-1 3-3l8-8 3 3-8 8c0 2-1 3-3 3z"/><path d="M14 6l3-3 4 4-3 3"/>'),
  heal: IC('<path d="M8 3v6a4 4 0 0 0 8 0V3"/><path d="M12 13v8M9 18h6"/>'),
  hdr: IC('<path d="M4 18l4-8 4 5 3-4 5 7z"/><circle cx="17" cy="6" r="2"/>'),
  glamour: IC('<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
  tcon: IC('<circle cx="12" cy="12" r="8"/><path d="M4 12h16" /><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" stroke="none"/>'),
  drama: IC('<path d="M5 17l4-9 3 5 2-3 5 7z"/><path d="M4 4l16 2-1 4-15-2z"/>'),
  vintage: IC('<rect x="4" y="6" width="16" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6l1-2h6l1 2"/>'),
  grainy: IC('<circle cx="7" cy="7" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="11" cy="12" r="1.2"/><circle cx="17" cy="14" r="1.2"/><circle cx="6" cy="16" r="1.2"/><circle cx="13" cy="18" r="1.2"/>'),
  retro: IC('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16" stroke-dasharray="2 2"/>'),
  grunge: IC('<path d="M4 5l3 3M15 4l4 4M3 14l4 2M14 15l3 5M10 10l4 1-2 3z"/>'),
  bw: IC('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16V4z" fill="currentColor" stroke="none"/>'),
  noir: IC('<circle cx="12" cy="12" r="8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="none"/>'),
  portrait: IC('<circle cx="12" cy="9" r="4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  face: IC('<circle cx="12" cy="10" r="5"/><path d="M12 15c-3 0-5 2-5 4h10c0-2-2-4-5-4z"/><path d="M9.5 9.5h.01M14.5 9.5h.01"/>'),
  lens: IC('<circle cx="12" cy="12" r="3"/><path d="M12 5a7 7 0 0 1 7 7M12 19a7 7 0 0 1-7-7" stroke-dasharray="2 2"/>'),
  vig: IC('<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="8" y="8" width="8" height="8" rx="4"/>'),
  dx: IC('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
  text: IC('<path d="M5 6h14M12 6v13"/><path d="M9 19h6"/>'),
  framek: IC('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>')
};

const TOOLS3 = [
  { id: 'tune', name: 'Tune Image' }, { id: 'details', name: 'Details' },
  { id: 'curves', name: 'Curves' }, { id: 'wb', name: 'White Balance' },
  { id: 'crop', name: 'Crop', paint: 'crop' }, { id: 'rotate', name: 'Rotate' },
  { id: 'persp', name: 'Perspective' }, { id: 'expand', name: 'Expand' },
  { id: 'selective', name: 'Selective', paint: 'sel' }, { id: 'brush', name: 'Brush', paint: 'brush' },
  { id: 'heal', name: 'Healing', paint: 'heal' },
  { id: 'hdr', name: 'HDR Scape', style: 'hdr' }, { id: 'glamour', name: 'Glamour Glow', style: 'glamour' },
  { id: 'tcon', name: 'Tonal Contrast', style: 'tcon' }, { id: 'drama', name: 'Drama', style: 'drama' },
  { id: 'vintage', name: 'Vintage', style: 'vintage' }, { id: 'grainy', name: 'Grainy Film', style: 'grainy' },
  { id: 'retro', name: 'Retrolux', style: 'retro' }, { id: 'grunge', name: 'Grunge', style: 'grunge' },
  { id: 'bw', name: 'Black & White', style: 'bw' }, { id: 'noir', name: 'Noir', style: 'noir' },
  { id: 'portrait', name: 'Portrait', style: 'portrait' }, { id: 'face', name: 'Face Enhance', style: 'face' },
  { id: 'lens', name: 'Lens Blur', paint: 'lens' }, { id: 'vig', name: 'Vignette' },
  { id: 'dx', name: 'Double Exposure' }, { id: 'text', name: 'Text', paint: 'text' },
  { id: 'framek', name: 'Frame Width' }
];
let openPanelId = null;
const panelEls = {};
function closeTool() {
  openPanelId = null; T3.paint = null;
  $$('#toolGrid .tbtn').forEach(b => b.classList.remove('on'));
  for (const k in panelEls) panelEls[k].hidden = true;
  drawOverlay();
}
function openTool(id) {
  if (openPanelId === id) { closeTool(); return; }
  closeTool();
  const def = TOOLS3.find(t => t.id === id);
  if (!panelEls[id]) {
    const p = document.createElement('div');
    p.className = 'tpanel';
    const head = document.createElement('div');
    head.className = 'trow thead';
    const ttl = document.createElement('b'); ttl.textContent = def.name;
    const done = document.createElement('button');
    done.className = 'btn small ghost'; done.type = 'button'; done.textContent = 'Done';
    done.addEventListener('click', closeTool);
    head.appendChild(ttl); head.appendChild(done);
    p.appendChild(head);
    (PANELS[id] || (() => {}))(p);
    $('#toolPanels').appendChild(p);
    panelEls[id] = p;
  }
  panelEls[id].hidden = false;
  openPanelId = id;
  T3.paint = def.paint || null;
  $$('#toolGrid .tbtn').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  if (def.paint === 'crop' && !T3.cropR) T3.cropR = { x: 0, y: 0, w: 1, h: 1 };
  drawOverlay();
}
function buildToolsUI() {
  const g = $('#toolGrid');
  TOOLS3.forEach(t => {
    const b = document.createElement('button');
    b.className = 'tbtn'; b.type = 'button'; b.dataset.id = t.id;
    b.innerHTML = ICONS3[t.id] + '<span></span>';
    $('span', b).textContent = t.name;
    b.addEventListener('click', () => { if (!st.work) { toast('Choose a photo first.'); return; } openTool(t.id); });
    g.appendChild(b);
  });
}
/* small helper for the panels: a labelled slider bound live */
const sl3 = (label, min, max, get, set, fmt) =>
  slider(label, min, max, get(), v => (fmt || String)(v), v => { set(v); scheduleFast(); });

const PANELS = {};
const hint3 = t => { const p = document.createElement('p'); p.className = 'hint'; p.textContent = t; return p; };
const chipRow = (list, cur, onPick) => {
  const d = document.createElement('div'); d.className = 'seg gold segwrap';
  list.forEach(([v, n]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.v = v; b.textContent = n;
    if (v === cur) b.classList.add('on');
    b.addEventListener('click', () => { $$('button', d).forEach(x => x.classList.toggle('on', x === b)); onPick(v); });
    d.appendChild(b);
  });
  return d;
};
PANELS.tune = p => {
  p.appendChild(sl3('Brightness', -30, 30, () => st.b, v => st.b = v));
  p.appendChild(sl3('Contrast', -30, 30, () => st.c, v => st.c = v));
  p.appendChild(sl3('Saturation', -40, 40, () => st.s, v => st.s = v));
  p.appendChild(sl3('Ambiance', -50, 50, () => T3.amb, v => T3.amb = v));
  p.appendChild(sl3('Shadows', -50, 50, () => st.shadows, v => st.shadows = v));
  p.appendChild(sl3('Highlights', -50, 50, () => st.highlights, v => st.highlights = v));
  p.appendChild(sl3('Warmth', -50, 50, () => st.warm, v => st.warm = v));
};
PANELS.details = p => {
  p.appendChild(sl3('Structure', 0, 100, () => T3.struct, v => T3.struct = v));
  p.appendChild(sl3('Sharpening', 0, 100, () => st.sharp, v => st.sharp = v));
};
PANELS.wb = p => {
  p.appendChild(sl3('Temperature', -100, 100, () => T3.temp, v => T3.temp = v));
  p.appendChild(sl3('Tint', -100, 100, () => T3.tint, v => T3.tint = v));
};
PANELS.vig = p => {
  p.appendChild(sl3('Strength', 0, 100, () => st.vig, v => st.vig = v));
  p.appendChild(sl3('Size', 40, 200, () => Math.round((T3.vigR || 1) * 100), v => T3.vigR = v / 100, v => v + '%'));
};
PANELS.framek = p => {
  p.appendChild(sl3('Frame width', 30, 200, () => T3.frameK, v => T3.frameK = v, v => v + '%'));
  p.appendChild(hint3('Scales the frame chosen in the Frame section.'));
};
PANELS.expand = p => {
  p.appendChild(sl3('Expand', 0, 40, () => T3.expand, v => T3.expand = v, v => '+' + v + '%'));
  p.appendChild(hint3('Stretches the photo edges to make the canvas bigger.'));
};
PANELS.persp = p => {
  p.appendChild(sl3('Vertical', -50, 50, () => T3.perspV, v => T3.perspV = v));
  p.appendChild(sl3('Horizontal', -50, 50, () => T3.perspH, v => T3.perspH = v));
  p.appendChild(hint3('Straightens lines that lean, like buildings shot from below.'));
};
PANELS.rotate = p => {
  p.appendChild(sl3('Angle', -45, 45, () => T3.rot, v => T3.rot = v, v => v + '°'));
  const row = document.createElement('div'); row.className = 'trow';
  [['⟲ 90°', () => T3.rotQ--], ['⟳ 90°', () => T3.rotQ++],
   ['Flip ↔', () => T3.flipH = !T3.flipH], ['Flip ↕', () => T3.flipV = !T3.flipV]].forEach(([n, f]) => {
    const b = document.createElement('button'); b.className = 'btn ghost tt'; b.type = 'button'; b.textContent = n;
    b.addEventListener('click', () => { f(); scheduleRender(); });
    row.appendChild(b);
  });
  p.appendChild(row);
  const rs = document.createElement('button'); rs.className = 'btn link'; rs.type = 'button'; rs.textContent = 'Reset rotation';
  rs.addEventListener('click', () => { T3.rot = 0; T3.rotQ = 0; T3.flipH = T3.flipV = false; closeTool(); scheduleRender(); });
  p.appendChild(rs);
};
PANELS.crop = p => {
  p.appendChild(chipRow([['free', 'Free'], ['1', '1:1'], ['.8', '4:5'], ['1.5', '3:2'], ['1.7778', '16:9']], 'free', v => {
    cropAr = v === 'free' ? 0 : +v;
    if (cropAr && st.work) {
      const ar0 = st.work.width / st.work.height;
      let w = 1, h = 1;
      if (cropAr > ar0) h = ar0 / cropAr; else w = cropAr / ar0;
      T3.cropR = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
      scheduleRender(); drawOverlay();
    }
  }));
  p.appendChild(hint3('Drag the corners on the photo. Drag inside to move.'));
  const rs = document.createElement('button'); rs.className = 'btn link'; rs.type = 'button'; rs.textContent = 'Remove crop';
  rs.addEventListener('click', () => { T3.cropR = null; cropAr = 0; closeTool(); scheduleRender(); });
  p.appendChild(rs);
};
let cropAr = 0;

/* curves editor: tap to add a point, drag to move, drag a point out to remove */
let cvCanvas = null, cvDrag = -1;
function drawCurveEditor() {
  const cv = cvCanvas; if (!cv) return;
  const x = cv.getContext('2d'), S = cv.width;
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#14161c'; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(255,255,255,.09)'; x.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke();
    x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,.16)';
  x.beginPath(); x.moveTo(0, S); x.lineTo(S, 0); x.stroke();
  const lut = buildCurLut(T3.curves);
  x.strokeStyle = '#d4a95f'; x.lineWidth = 2; x.beginPath();
  for (let i = 0; i < 256; i++) {
    const px = i / 255 * S, py = (1 - (lut ? lut[i] : i) / 255) * S;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.stroke();
  (T3.curves || []).forEach(q => {
    x.fillStyle = '#d4a95f';
    x.beginPath(); x.arc(q[0] * S, (1 - q[1]) * S, 7, 0, 6.2832); x.fill();
    x.fillStyle = '#1a1408';
    x.beginPath(); x.arc(q[0] * S, (1 - q[1]) * S, 3, 0, 6.2832); x.fill();
  });
}
function cvPos(e) {
  const r = cvCanvas.getBoundingClientRect();
  return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1)];
}
PANELS.curves = p => {
  cvCanvas = mk(240, 240); cvCanvas.className = 'curveEd';
  cvCanvas.addEventListener('pointerdown', e => {
    cvCanvas.setPointerCapture(e.pointerId);
    const [u, v] = cvPos(e), pts = T3.curves || (T3.curves = [[0, 0], [1, 1]]);
    cvDrag = pts.findIndex(q => Math.hypot(q[0] - u, q[1] - v) < .07);
    if (cvDrag < 0) {
      pts.push([u, v]); pts.sort((a, b) => a[0] - b[0]);
      cvDrag = pts.findIndex(q => q[0] === u && q[1] === v);
    }
    drawCurveEditor(); scheduleFast();
  });
  cvCanvas.addEventListener('pointermove', e => {
    if (cvDrag < 0) return;
    const [u, v] = cvPos(e), pts = T3.curves;
    if (v < -.12 && cvDrag > 0 && cvDrag < pts.length - 1) { pts.splice(cvDrag, 1); cvDrag = -1; }
    else {
      const lo = cvDrag > 0 ? pts[cvDrag - 1][0] + .01 : 0, hi = cvDrag < pts.length - 1 ? pts[cvDrag + 1][0] - .01 : 1;
      pts[cvDrag] = [clamp(u, lo, hi), clamp(v, 0, 1)];
    }
    drawCurveEditor(); scheduleFast();
  });
  ['pointerup', 'pointercancel'].forEach(ev => cvCanvas.addEventListener(ev, () => {
    cvDrag = -1;
    if (T3.curves && T3.curves.length <= 2 && T3.curves.every((q, i) => Math.abs(q[0] - q[1]) < .01 && Math.abs(q[0] - i) < .01)) T3.curves = null;
    if (T3.curves && T3.curves.length < 2) T3.curves = null;
    drawCurveEditor(); scheduleRender();
  }));
  p.appendChild(cvCanvas);
  p.appendChild(hint3('Tap to add a point, drag to shape the tones. Drag a point below the box to delete it.'));
  const rs = document.createElement('button'); rs.className = 'btn link'; rs.type = 'button'; rs.textContent = 'Reset curve';
  rs.addEventListener('click', () => { T3.curves = null; drawCurveEditor(); scheduleRender(); });
  p.appendChild(rs);
  setTimeout(drawCurveEditor, 0);
};

/* style panels (HDR Scape .. Face Enhance): one strength slider each; BW adds tone filters */
function stylePanel(id) {
  return p => {
    p.appendChild(sl3('Strength', 0, 100, () => T3.styles[id] || 0, v => { T3.styles[id] = v; }, v => v + '%'));
    if (id === 'bw') {
      p.appendChild(chipRow([['neu', 'Neutral'], ['red', 'Red'], ['org', 'Orange'], ['yel', 'Yellow'], ['grn', 'Green'], ['blu', 'Blue']],
        T3.bwTone, v => { T3.bwTone = v; scheduleFast(); }));
      p.appendChild(hint3('Colour filters change which tones go light or dark, like filters on a lens.'));
    }
    if (id === 'portrait') p.appendChild(hint3('Smooths skin tones, lifts the face area and softens the background. No AI: it works from colour cues, best with a centred face.'));
    if (id === 'face') p.appendChild(hint3('Brightens and softens the face area. No AI, no uploads.'));
    if (id === 'hdr') p.appendChild(hint3('Strong local contrast and detail, like HDR photography.'));
  };
}
['hdr', 'glamour', 'tcon', 'drama', 'vintage', 'grainy', 'retro', 'grunge', 'bw', 'noir', 'portrait', 'face']
  .forEach(id => PANELS[id] = stylePanel(id));

PANELS.selective = p => {
  p.appendChild(hint3('Tap the photo to drop a control point, tap a point to select it, then adjust.'));
  const info = document.createElement('p'); info.className = 'info'; info.id = 'selInfo';
  p.appendChild(info);
  p.appendChild(sl3('Radius', 5, 60, () => selCur() ? selCur().rad * 100 : 20, v => { if (selCur()) selCur().rad = v / 100; }, v => v + '%'));
  p.appendChild(sl3('Brightness', -50, 50, () => selCur() ? selCur().b : 0, v => { if (selCur()) selCur().b = v; }));
  p.appendChild(sl3('Contrast', -50, 50, () => selCur() ? selCur().c : 0, v => { if (selCur()) selCur().c = v; }));
  p.appendChild(sl3('Saturation', -50, 50, () => selCur() ? selCur().s : 0, v => { if (selCur()) selCur().s = v; }));
  const row = document.createElement('div'); row.className = 'trow';
  const del = document.createElement('button'); del.className = 'btn ghost tt'; del.type = 'button'; del.textContent = 'Delete point';
  del.addEventListener('click', () => { if (selIdx >= 0) { T3.sel.splice(selIdx, 1); selIdx = -1; scheduleRender(); drawOverlay(); syncSelInfo(); } });
  const clr = document.createElement('button'); clr.className = 'btn ghost tt'; clr.type = 'button'; clr.textContent = 'Clear all';
  clr.addEventListener('click', () => { T3.sel = []; selIdx = -1; scheduleRender(); drawOverlay(); syncSelInfo(); });
  row.appendChild(del); row.appendChild(clr); p.appendChild(row);
  setTimeout(syncSelInfo, 0);
};
let selIdx = -1;
const selCur = () => selIdx >= 0 ? T3.sel[selIdx] : null;
function syncSelInfo() {
  const el = $('#selInfo'); if (!el) return;
  el.textContent = T3.sel.length
    ? (selIdx >= 0 ? 'Point ' + (selIdx + 1) + ' of ' + T3.sel.length + ' selected.' : T3.sel.length + ' points. Tap one to edit it.')
    : 'No points yet.';
}

PANELS.brush = p => {
  p.appendChild(chipRow([['dodge', 'Dodge'], ['burn', 'Burn'], ['sat', 'Saturation'], ['temp', 'Warmth']],
    brushMode, v => { brushMode = v; }));
  p.appendChild(sl3('Brush size', 2, 40, () => brushSize, v => brushSize = v, v => v + '%'));
  p.appendChild(sl3('Strength', 10, 100, () => brushK, v => brushK = v, v => v + '%'));
  p.appendChild(hint3('Paint on the photo. Dodge lightens, Burn darkens.'));
  const row = document.createElement('div'); row.className = 'trow';
  const un = document.createElement('button'); un.className = 'btn ghost tt'; un.type = 'button'; un.textContent = 'Undo stroke';
  un.addEventListener('click', () => { T3.brush.pop(); scheduleRender(); drawOverlay(); });
  const clr = document.createElement('button'); clr.className = 'btn ghost tt'; clr.type = 'button'; clr.textContent = 'Clear';
  clr.addEventListener('click', () => { T3.brush = []; scheduleRender(); drawOverlay(); });
  row.appendChild(un); row.appendChild(clr); p.appendChild(row);
};
let brushMode = 'dodge', brushSize = 12, brushK = 60;

PANELS.heal = p => {
  p.appendChild(sl3('Patch size', 2, 20, () => healSize, v => healSize = v, v => v + '%'));
  p.appendChild(hint3('Tap a spot to remove it: it is covered with clean texture from nearby. Best for small spots and blemishes.'));
  const un = document.createElement('button'); un.className = 'btn ghost tt'; un.type = 'button'; un.textContent = 'Undo patch';
  un.addEventListener('click', () => { T3.heal.pop(); scheduleRender(); drawOverlay(); });
  p.appendChild(un);
};
let healSize = 6;

PANELS.lens = p => {
  p.appendChild(chipRow([['radial', 'Radial'], ['linear', 'Linear']], T3.lens.mode, v => { T3.lens.mode = v; scheduleFast(); drawOverlay(); }));
  p.appendChild(sl3('Strength', 0, 100, () => T3.lens.k, v => T3.lens.k = v, v => v + '%'));
  p.appendChild(sl3('Focus size', 15, 100, () => T3.lens.rad * 100, v => T3.lens.rad = v / 100, v => v + '%'));
  p.appendChild(hint3('Tap the photo to place the focus point.'));
};

PANELS.dx = p => {
  const pick = document.createElement('button'); pick.className = 'btn ghost tt'; pick.type = 'button';
  pick.textContent = T3.dxImg ? 'Change second photo' : 'Choose second photo';
  pick.addEventListener('click', () => $('#fileDx').click());
  p.appendChild(pick);
  p.appendChild(chipRow([['screen', 'Screen'], ['multiply', 'Multiply'], ['overlay', 'Overlay'], ['lighten', 'Lighten'], ['darken', 'Darken']],
    T3.dxMode, v => { T3.dxMode = v; scheduleFast(); }));
  p.appendChild(sl3('Opacity', 5, 100, () => T3.dxK, v => T3.dxK = v, v => v + '%'));
  const row = document.createElement('div'); row.className = 'trow';
  const tog = document.createElement('button'); tog.className = 'btn ghost tt'; tog.type = 'button';
  const syncTog = () => tog.textContent = T3.dxOn ? 'On — tap to turn off' : 'Off — tap to turn on';
  tog.textContent = T3.dxOn ? 'On — tap to turn off' : 'Off — tap to turn on';
  tog.addEventListener('click', () => {
    if (!T3.dxImg && !T3.dxOn) { toast('Choose a second photo first.'); return; }
    T3.dxOn = !T3.dxOn; syncTog(); scheduleRender();
  });
  row.appendChild(tog); p.appendChild(row);
  p.appendChild(hint3('Blends a second photo over yours, like a film double exposure.'));
};
$('#fileDx').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !isImg(f)) { if (f) toast('Please choose a JPG, PNG or WEBP image.'); return; }
  busy(true, 'Loading photo…'); await tick();
  try {
    T3.dxImg = await toCanvas(f, SMALL_SIDE);
    T3.dxOn = true;
    toast('Second photo added.');
    if (openPanelId === 'dx') { delete panelEls.dx; openTool('dx'); }
    scheduleRender();
  } catch (_) { toast('Could not open this image.'); }
  finally { busy(false); }
});

PANELS.text = p => {
  const ta = document.createElement('input');
  ta.type = 'text'; ta.maxLength = 60; ta.placeholder = 'Write your text…'; ta.className = 'txtIn';
  ta.value = T3.txt.str;
  ta.addEventListener('input', () => { T3.txt.str = ta.value; T3.txt.on = !!ta.value.trim(); scheduleRender(); });
  p.appendChild(ta);
  p.appendChild(chipRow([['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono'], ['hand', 'Handwritten']],
    T3.txt.font, v => { T3.txt.font = v; scheduleFast(); }));
  p.appendChild(sl3('Size', 4, 22, () => T3.txt.size, v => T3.txt.size = v, v => v + '%'));
  p.appendChild(sl3('Opacity', 20, 100, () => T3.txt.k, v => T3.txt.k = v, v => v + '%'));
  const cw = document.createElement('label'); cw.className = 'chk';
  const ci = document.createElement('input'); ci.type = 'color'; ci.value = T3.txt.color;
  ci.addEventListener('input', () => { T3.txt.color = ci.value; scheduleFast(); });
  const cs = document.createElement('span'); cs.textContent = 'Text colour';
  cw.appendChild(ci); cw.appendChild(cs); p.appendChild(cw);
  [['outline', 'Dark outline'], ['shadow', 'Shadow']].forEach(([k, n]) => {
    const l = document.createElement('label'); l.className = 'chk';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = T3.txt[k];
    c.addEventListener('change', () => { T3.txt[k] = c.checked; scheduleFast(); });
    const s2 = document.createElement('span'); s2.textContent = n;
    l.appendChild(c); l.appendChild(s2); p.appendChild(l);
  });
  p.appendChild(hint3('Drag on the photo to place the text.'));
};

/* ---- Looks row + Smart pick ---- */
function syncLooksUI() {
  $$('#lookChips .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === T3.look));
  $('#lookRow').hidden = T3.look === 'none';
  const inp = $('#lookK input'); if (inp) inp.value = T3.lookK;
  const out = $('#lookK output'); if (out) out.textContent = T3.lookK + '%';
}
function buildLooksUI() {
  const box = $('#lookChips');
  [{ id: 'none', name: 'None' }].concat(LOOKS).forEach(L => {
    const b = document.createElement('button');
    b.className = 'fchip'; b.type = 'button'; b.dataset.id = L.id;
    b.appendChild(mk(96, 96));
    const sp = document.createElement('span'); sp.textContent = L.name; b.appendChild(sp);
    b.addEventListener('click', () => {
      T3.look = L.id;
      syncLooksUI(); scheduleRender();
    });
    box.appendChild(b);
  });
  const row = $('#lookRow');
  const w = slider('Look strength', 0, 150, T3.lookK, v => v + '%', v => { T3.lookK = v; scheduleFast(); });
  w.id = 'lookK';
  row.appendChild(w);
}
async function renderLookThumbs() {
  if (!st.small) return;
  for (const L of LOOKS) {
    const cv = $('#lookChips .fchip[data-id="' + L.id + '"] canvas');
    if (!cv) continue;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    geometry(ctx, st.small, 96, 96, 'cover', .5, .5);
    process(ctx, 96, 96, effective(NEUTRAL, FILTERS[0], 1));
    const keep = T3.look, keepK = T3.lookK;
    T3.look = L.id; T3.lookK = 100;
    px3color(ctx, 96, 96);
    T3.look = keep; T3.lookK = keepK;
    bloom(ctx, 96, 96, .12);
    await new Promise(r => setTimeout(r, 0));
  }
}

/* ================= round 3: stage painting + overlay ================= */
const cOv = $('#cOv');
let paintDrag = null;      // {kind:'crop-move'|'crop-hw'..|'brush'|'text', ...}
function uvClamp(p) { p.u = clamp(p.u, 0, 1); p.v = clamp(p.v, 0, 1); return p; }
function selHit(u, v) {
  const { W, H } = outSize();
  let best = -1, bd = 1e9;
  T3.sel.forEach((p, i) => {
    const d = Math.hypot((p.u - u) * W, (p.v - v) * H);
    if (d < bd) { bd = d; best = i; }
  });
  return bd < Math.max(26, Math.min(W, H) * .05) ? best : -1;
}
function cropHit(u, v) {
  const r = T3.cropR; if (!r) return null;
  const t = .045, hw = [];
  [[r.x, r.y, 'nw'], [r.x + r.w, r.y, 'ne'], [r.x, r.y + r.h, 'sw'], [r.x + r.w, r.y + r.h, 'se']].forEach(q => {
    if (Math.abs(u - q[0]) < t && Math.abs(v - q[1]) < t) hw.push(q[2]);
  });
  if (hw.length) return hw[0];
  if (u > r.x && u < r.x + r.w && v > r.y && v < r.y + r.h) return 'move';
  return null;
}
function paintDown(e) {
  const p = uvClamp(stageToOut(e));
  if (T3.paint === 'brush') {
    const s = { mode: brushMode, size: brushSize, k: brushK, p: [p.u, p.v] };
    T3.brush.push(s); paintDrag = { kind: 'brush', s };
  } else if (T3.paint === 'heal') {
    T3.heal.push({ u: p.u, v: p.v, r: healSize / 100 });
  } else if (T3.paint === 'sel') {
    const hit = selHit(p.u, p.v);
    if (hit >= 0) { selIdx = hit; paintDrag = { kind: 'selmove', i: hit }; }
    else { T3.sel.push({ u: p.u, v: p.v, rad: .2, b: 0, c: 0, s: 0 }); selIdx = T3.sel.length - 1; paintDrag = { kind: 'selmove', i: selIdx }; }
    syncSelInfo();
    if (openPanelId === 'selective') { const keep = panelEls.selective; if (keep) { keep.remove(); delete panelEls.selective; openPanelId = null; openTool('selective'); } }
  } else if (T3.paint === 'crop') {
    const h = cropHit(p.u, p.v);
    if (h) paintDrag = { kind: 'crop', how: h, u: p.u, v: p.v, r: Object.assign({}, T3.cropR) };
  } else if (T3.paint === 'lens') {
    T3.lens.u = p.u; T3.lens.v = p.v;
  } else if (T3.paint === 'text') {
    T3.txt.u = p.u; T3.txt.v = p.v; paintDrag = { kind: 'text' };
  }
  scheduleFast(); drawOverlay();
}
function paintMove(e) {
  const p = stageToOut(e);
  if (!paintDrag) return;
  if (paintDrag.kind === 'brush') {
    const s = paintDrag.s, n = s.p.length;
    const { W, H } = outSize();
    if (Math.hypot((p.u - s.p[n - 2]) * W, (p.v - s.p[n - 1]) * H) < 6) return;
    s.p.push(clamp(p.u, 0, 1), clamp(p.v, 0, 1));
  } else if (paintDrag.kind === 'selmove') {
    uvClamp(p); T3.sel[paintDrag.i].u = p.u; T3.sel[paintDrag.i].v = p.v;
  } else if (paintDrag.kind === 'crop') {
    const r = Object.assign({}, paintDrag.r), du = p.u - paintDrag.u, dv = p.v - paintDrag.v;
    if (paintDrag.how === 'move') { r.x += du; r.y += dv; }
    else {
      if (paintDrag.how.includes('w')) { r.x += du; r.w -= du; }
      if (paintDrag.how.includes('e')) r.w += du;
      if (paintDrag.how.includes('n')) { r.y += dv; r.h -= dv; }
      if (paintDrag.how.includes('s')) r.h += dv;
      if (cropAr) {
        const { W, H } = outSize(), L = layout(W, H), ar = L.iw / L.ih;
        if (paintDrag.how.includes('e') || paintDrag.how.includes('w')) r.h = r.w * (ar / cropAr) * 1; else r.w = r.h * (cropAr / ar);
      }
    }
    r.w = clamp(r.w, .05, 1); r.h = clamp(r.h, .05, 1);
    r.x = clamp(r.x, 0, 1 - r.w); r.y = clamp(r.y, 0, 1 - r.h);
    T3.cropR = r;
  } else if (paintDrag.kind === 'text') {
    uvClamp(p); T3.txt.u = p.u; T3.txt.v = p.v;
  }
  scheduleFast(); drawOverlay();
}
function paintUp() { paintDrag = null; }

function drawOverlay() {
  if (!cOv) return;
  const W0 = cAfter.width, H0 = cAfter.height;
  if (!W0) { cOv.width = cOv.height = 0; return; }
  if (cOv.width !== W0 || cOv.height !== H0) { cOv.width = W0; cOv.height = H0; }
  const x = cOv.getContext('2d');
  x.clearRect(0, 0, W0, H0);
  const { W, H } = outSize(), L = layout(W, H), sc = W0 / W;
  const X = u => (L.ix + u * L.iw) * sc, Y = v => (L.iy + v * L.ih) * sc;
  x.lineWidth = 2;
  const gold = '#d4a95f';
  if (T3.paint === 'crop' && T3.cropR) {
    const r = T3.cropR, x0 = X(r.x), y0 = Y(r.y), x1 = X(r.x + r.w), y1 = Y(r.y + r.h);
    x.save();
    x.fillStyle = 'rgba(0,0,0,.5)';
    x.beginPath(); x.rect(0, 0, W0, H0); x.rect(x0, y0, x1 - x0, y1 - y0); x.fill('evenodd');
    x.strokeStyle = gold; x.strokeRect(x0, y0, x1 - x0, y1 - y0);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      x.beginPath(); x.moveTo(x0 + (x1 - x0) * i / 3, y0); x.lineTo(x0 + (x1 - x0) * i / 3, y1); x.stroke();
      x.beginPath(); x.moveTo(x0, y0 + (y1 - y0) * i / 3); x.lineTo(x1, y0 + (y1 - y0) * i / 3); x.stroke();
    }
    x.fillStyle = gold;
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(q => { x.beginPath(); x.arc(q[0], q[1], 8, 0, 6.2832); x.fill(); });
    x.restore();
  }
  if (T3.paint === 'sel') T3.sel.forEach((p, i) => {
    x.beginPath(); x.arc(X(p.u), Y(p.v), 11, 0, 6.2832);
    x.fillStyle = i === selIdx ? gold : 'rgba(255,255,255,.85)'; x.fill();
    x.beginPath(); x.arc(X(p.u), Y(p.v), p.rad * Math.min(L.iw, L.ih) * sc);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.setLineDash([4, 5]); x.stroke(); x.setLineDash([]);
  });
  if (T3.paint === 'brush') {
    x.strokeStyle = 'rgba(212,169,95,.8)'; x.lineWidth = 3; x.lineCap = 'round';
    T3.brush.forEach(s => {
      x.beginPath();
      for (let i = 0; i < s.p.length; i += 2) i ? x.lineTo(X(s.p[i]), Y(s.p[i + 1])) : x.moveTo(X(s.p[i]), Y(s.p[i + 1]));
      x.stroke();
    });
  }
  if (T3.paint === 'heal') T3.heal.forEach(p => {
    x.beginPath(); x.arc(X(p.u), Y(p.v), Math.max(8, p.r * Math.min(L.iw, L.ih) * sc), 0, 6.2832);
    x.strokeStyle = gold; x.setLineDash([4, 4]); x.stroke(); x.setLineDash([]);
  });
  if (T3.paint === 'lens' && T3.lens.k > 0) {
    x.strokeStyle = gold;
    if (T3.lens.mode === 'radial') {
      x.beginPath(); x.arc(X(T3.lens.u), Y(T3.lens.v), T3.lens.rad * Math.max(L.iw, L.ih) * sc * .45, 0, 6.2832); x.stroke();
      x.beginPath(); x.arc(X(T3.lens.u), Y(T3.lens.v), T3.lens.rad * Math.max(L.iw, L.ih) * sc, 0, 6.2832);
      x.setLineDash([5, 6]); x.stroke(); x.setLineDash([]);
    } else {
      const dy = T3.lens.rad * L.ih * sc;
      x.beginPath(); x.moveTo(0, Y(T3.lens.v)); x.lineTo(W0, Y(T3.lens.v)); x.stroke();
      x.setLineDash([5, 6]);
      x.beginPath(); x.moveTo(0, Y(T3.lens.v) - dy); x.lineTo(W0, Y(T3.lens.v) - dy); x.stroke();
      x.beginPath(); x.moveTo(0, Y(T3.lens.v) + dy); x.lineTo(W0, Y(T3.lens.v) + dy); x.stroke();
      x.setLineDash([]);
    }
  }
  if (T3.txt.on && T3.txt.str) {
    const tx = X(T3.txt.u), ty = Y(T3.txt.v);
    x.strokeStyle = 'rgba(212,169,95,.9)'; x.setLineDash([5, 5]);
    x.strokeRect(tx - 26, ty - 16, 52, 32); x.setLineDash([]);
    x.fillStyle = gold; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('T', tx, ty);
  }
}

/* ================= round 3: worker client, export, smart suggestion ================= */
let wbg = null, wbgDead = false, wgSeq = 0;
const wgWait = new Map();
function wgClient() {
  if (wbg || wbgDead) return wbg;
  try {
    wbg = new Worker('worker-bg.js');
    wbg.onmessage = ev => { const m = ev.data || {}; const r = wgWait.get(m.id); if (r) { wgWait.delete(m.id); r(m); } };
    wbg.onerror = () => { wbgDead = true; wbg = null; wgWait.forEach(r => r(null)); wgWait.clear(); };
  } catch (_) { wbgDead = true; }
  return wbg;
}
function wgCall(job) {                                    // resolves null when the worker is unavailable
  const w = wgClient();
  if (!w) return Promise.resolve(null);
  return new Promise(res => {
    const id = ++wgSeq;
    wgWait.set(id, res);
    try { w.postMessage(Object.assign({ id }, job), job.rgba ? [job.rgba] : []); }
    catch (_) { wgWait.delete(id); res(null); }
  });
}

/* heavy colour work for one canvas: full-res grade in worker-bg.js when possible */
async function postHeavy(ctx, w, h) {
  const e = curEff();
  const img = ctx.getImageData(0, 0, w, h);
  const copy = new ImageData(new Uint8ClampedArray(img.data), w, h);
  const fx = mergeFx();
  const o = {
    b: fx.b, c: fx.c, s: fx.s, temp: fx.temp, tint: fx.tint, lift: fx.lift, hl: fx.hl, fade: fx.fade,
    vig: fx.vig, clar: fx.clar, struct: fx.struct, sharp: fx.sharp, split: fx.split, tc: fx.tc, bw: fx.bw
  };
  const m = await wgCall({ type: 'grade', w, h, rgba: copy.data.buffer, e, o, curves: T3.curves, bwTone: T3.bwTone });
  if (m && m.type === 'graded' && m.rgba) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(m.rgba), w, h), 0, 0);
  } else {
    process(ctx, w, h, e);
    px3color(ctx, w, h);
  }
  bloom(ctx, w, h, e.glow);
  if (st.effect !== 'none') runEffect(st.effect, ctx, w, h, st.fxk / 100);
  px3local(ctx, w, h);
  grain(ctx, w, h, e.grain);
  px3top(ctx, w, h);
}

/* full-resolution render used by export: geometry -> heavy grade -> frame */
async function renderExport() {
  const { W, H } = outSize();
  const c = mk(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (st.fmt === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  const L = layout(W, H);
  const iw = L.f ? L.iw : W, ih = L.f ? L.ih : H;
  const ph = L.f ? scratch('ph', iw, ih) : c;
  const pc = ph.getContext('2d', { willReadFrequently: true });
  geoInto(pc, st.work, iw, ih, false);
  await postHeavy(pc, iw, ih);
  if (L.f) drawFrame(ctx, W, H, L, ph);
  return c;
}

/* Smart suggestion: reads the photo once after it is adopted and offers the best fitting Look */
function smartRun() {
  const box = $('#smartBox');
  if (!box) return;
  box.innerHTML = ''; box.hidden = true;
  if (!st.small) return;
  let s;
  try { s = smartPick(); } catch (_) { return; }
  const look = LOOKS.find(l => l.id === s.look);
  const p = document.createElement('p');
  p.textContent = 'This looks like ' + s.type + '. The ' + look.name + ' look fits it best.';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn gold smartGo'; b.textContent = 'Apply it';
  b.addEventListener('click', () => { s.apply(); box.innerHTML = ''; });
  box.appendChild(p); box.appendChild(b);
  box.hidden = false;
}

/* called from adopt(): every new photo starts with a clean round-3 state */
function adoptT3() {
  resetT3();
  syncLooksUI();
  renderLookThumbs();
  smartRun();
}

/* ================= wiring ================= */
$$('#editor .seg').forEach(g => {
  if (!g.dataset.key) return;               // segments without a data-key are wired by their own panel
  $$('button', g).forEach(b => b.addEventListener('click', () => {
    st[g.dataset.key] = b.dataset.v;
    syncUI();
    if (g.dataset.key === 'crop' || g.dataset.key === 'sizeFit') { updateNote(); scheduleRender(); }
    if (g.dataset.key === 'fmt') { sizeInfo(); scheduleEstimate(); }
  }));
});
$$('#tabs button').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); }));
$('#resetAdj').addEventListener('click', () => {
  st.b = st.c = st.s = st.sharp = st.warm = st.vig = st.glow = st.grain = 0;
  st.shadows = st.highlights = st.clarity = st.fade = 0;
  st.strength = 100; st.fxk = 70;
  buildSliders();
  resetT3(); syncLooksUI(); drawOverlay();
  scheduleRender();
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
$('#sheetClose').addEventListener('click', closeSheet);

const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over'); }));
window.addEventListener('drop', e => {
  const fl = e.dataTransfer && e.dataTransfer.files;
  if (!fl || !fl.length) return;
  if (view === 'collage') { col.active = -1; colFiles(fl); } else loadFile(fl[0]);
});

buildCards('#platforms', PLATFORMS, 'platform', p => p.id === 'original' ? 'Keep dimensions' : p.w + ' × ' + p.h,
  () => { st.custom = null; st.fx = st.fy = .5; syncUI(); scheduleRender(); updateNote(); });
buildCards('#frames', FRAMES, 'frame', p => p.desc,
  () => { st.fx = st.fy = .5; syncUI(); scheduleRender(); updateNote(); });
buildChips('#filters', FILTERS, 'filter');
buildChips('#effects', EFFECTS, 'effect');
$('#effects').classList.add('fold');
$('#fxMore').addEventListener('click', e => { const f = $('#effects').classList.toggle('fold'); e.target.textContent = f ? 'Show all effects' : 'Show fewer'; });
buildSliders();
buildSizeUI();
buildToolsUI();
buildLooksUI();
syncUI();
/* ---- public API for extras.js: add filters / effects without touching this file ---- */
let pxT = 0;
const upsert = (list, it) => { const i = list.findIndex(o => o.id === it.id); if (i < 0) list.push(it); else list[i] = it; };
function refreshLists() {
  clearTimeout(pxT);
  pxT = setTimeout(() => { buildChips('#filters', FILTERS, 'filter'); buildChips('#effects', EFFECTS, 'effect'); syncUI(); renderThumbs(); }, 0);
}
window.PX = {
  T, G, RG, VG, CM, ED, HT, ST, DO, BO, FL, SM, RY, SP, MX, SC, WP, BG, MI, SF, TL, SK, TX, RD, F, BL, NZ, D1, D2, D3, WH, RB,
  addEffect(id, name, steps) { RC[id] = Array.isArray(steps) ? steps : [steps]; upsert(EFFECTS, { id, name }); refreshLists(); },
  addFilter(id, name, p) { upsert(FILTERS, { id, name, p }); refreshLists(); }
};
/* extras.js calls these helpers as bare names (CM, NZ, G, ...): expose them as globals so it runs */
Object.assign(window, { G, RG, VG, CM, ED, HT, ST, SC, WP, BG, MI, F, BL, NZ });
})();
