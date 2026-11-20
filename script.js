(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const tick = () => new Promise(r => setTimeout(r, 30));
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- config ---------- */
const LOW_MEM = !!(navigator.deviceMemory && navigator.deviceMemory <= 3);
const MAX_PIXELS = LOW_MEM ? 8e6 : 16e6;   // working-size cap (protects low-memory phones)
const SMALL_SIDE = 1600;                   // source used for live preview
const PREVIEW_SIDE = 1000;                 // preview canvas long side

const PLATFORMS = [
  { id: 'original',    name: 'Original',               w: 0,    h: 0 },
  { id: 'ig-story',    name: 'Instagram Story / Reels', w: 1080, h: 1920 },
  { id: 'ig-portrait', name: 'Instagram Portrait',      w: 1080, h: 1350 },
  { id: 'ig-square',   name: 'Instagram Square',        w: 1080, h: 1080 },
  { id: 'tiktok',      name: 'TikTok',                  w: 1080, h: 1920 },
  { id: 'fb-portrait', name: 'Facebook Portrait',       w: 1080, h: 1350 }
];

/* Filter params are tuned to stay subtle and photographic. */
const FILTERS = [
  { id: 'natural',   name: 'Natural',   p: { c: 2, s: 3, sharp: 8 } },
  { id: 'clean',     name: 'Clean',     p: { b: 3, c: 5, s: 2, temp: -1, lift: .15, clarity: .10, sharp: 14 } },
  { id: 'vivid',     name: 'Vivid',     p: { b: 1, c: 8, s: 16, sharp: 12 } },
  { id: 'hdr',       name: 'HDR',       p: { c: 5, s: 9, lift: .8, hl: .55, clarity: .45, sharp: 10 } },
  { id: 'cinematic', name: 'Cinematic', p: { c: 9, s: -8, fade: .03, vig: .22, clarity: .12, sharp: 6,
                                            split: { sh: [-9, 4, 10], hi: [13, 6, -8] } } },
  { id: 'warm',      name: 'Warm',      p: { b: 1, c: 2, s: 4, temp: 9, sharp: 8 } },
  { id: 'cool',      name: 'Cool',      p: { c: 3, s: 2, temp: -9, sharp: 8 } },
  { id: 'bw',        name: 'Black & White', p: { c: 10, s: -100, vig: .10, clarity: .20, sharp: 12 } }
];

const SLIDERS = [
  { k: 'b',     label: 'Brightness more', min: -30, max: 30 },
  { k: 'c',     label: 'Contrast',   min: -30, max: 30 },
  { k: 's',     label: 'Saturation', min: -40, max: 40 },
  { k: 'sharp', label: 'Sharpening', min: 0,   max: 100 }
];
SLIDERS[0].label = 'Brightness';

const QUALITY = {
  jpg:  { standard: .80, high: .92, ultra: .99 },
  webp: { standard: .80, high: .92, ultra: 1.0 }
};
const MIME = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' };

/* ---------- state ---------- */
const st = {
  work: null, small: null, name: 'photo', note: '',
  platform: 'ig-portrait', crop: 'cover', filter: 'natural', strength: 100,
  b: 0, c: 0, s: 0, sharp: 0,
  fmt: 'jpg', quality: 'high',
  tab: 'result', fx: .5, fy: .5, cmp: 50
};

/* ---------- DOM ---------- */
const hero = $('#hero'), editor = $('#editor');
const stage = $('#stage'), cAfter = $('#cAfter'), cBefore = $('#cBefore'), handle = $('#handle');
const dimsEl = $('#dims'), noteEl = $('#note');
let beforeKey = '';
let raf = 0;

/* ---------- UI helpers ---------- */
let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600);
}
function busy(on, txt) {
  $('#busy').hidden = !on;
  if (txt) $('#busyTxt').textContent = txt;
}

/* ---------- resampling ---------- */
// High quality downscale: halve step by step, then final draw (avoids aliasing).
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

function coverDraw(ctx, src, W, H, fx, fy) {
  const sw = src.width, sh = src.height;
  const sr = sw / sh, dr = W / H;
  let cw = sw, ch = sh;
  if (dr > sr) ch = sw / dr; else cw = sh * dr;
  const sx = (sw - cw) * fx, sy = (sh - ch) * fy;
  drawScaled(ctx, src, sx, sy, cw, ch, 0, 0, W, H);
}

function backdrop(ctx, src, W, H) {
  const tw = Math.max(8, Math.round(W / 28)), th = Math.max(8, Math.round(H / 28));
  let cur = mk(tw, th);
  coverDraw(cur.getContext('2d'), src, tw, th, .5, .5);
  while (cur.width * 4 < W) {                    // soft multi-step upscale
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

/* ---------- pixel pipeline ---------- */
function effective(adj, f, k) {
  const p = f ? f.p : {};
  const m = v => (v || 0) * k;
  const e = {
    b: adj.b + m(p.b), c: adj.c + m(p.c),
    s: clamp(adj.s + m(p.s), -100, 100),
    sharp: adj.sharp + m(p.sharp),
    temp: m(p.temp), lift: m(p.lift), hl: m(p.hl), fade: m(p.fade),
    vig: m(p.vig), clarity: m(p.clarity), split: null
  };
  if (p.split) {
    e.split = { sh: p.split.sh.map(v => v * k), hi: p.split.hi.map(v => v * k) };
  }
  return e;
}

function buildLut(e) {
  const lut = new Uint8ClampedArray(256);
  const cf = 1 + e.c / 80, add = e.b * 1.7 / 255;
  const K = 0.12 * 27 / 4;
  for (let i = 0; i < 256; i++) {
    let x = i / 255;
    x += e.lift * K * x * (1 - x) * (1 - x);   // lift shadows
    x -= e.hl * K * x * x * (1 - x);           // compress highlights
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
      if (sp) {
        const l = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255, wl = 1 - l;
        r += sp.sh[0] * wl + sp.hi[0] * l;
        g += sp.sh[1] * wl + sp.hi[1] * l;
        b += sp.sh[2] * wl + sp.hi[2] * l;
      }
      if (tr) { r += tr; g += tg; b += tb; }
      if (sf !== 1) {
        const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = l + (r - l) * sf; g = l + (g - l) * sf; b = l + (b - l) * sf;
      }
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

/* ---------- current settings ---------- */
function curFilter() { return FILTERS.find(f => f.id === st.filter); }
function curEff() { return effective(st, curFilter(), st.strength / 100); }
function outSize() {
  const p = PLATFORMS.find(x => x.id === st.platform);
  if (p.id === 'original' || !st.work) return { W: st.work ? st.work.width : 0, H: st.work ? st.work.height : 0 };
  return { W: p.w, H: p.h };
}
function trims() {
  if (!st.work || st.platform === 'original') return false;
  const { W, H } = outSize();
  return Math.abs(W / H - st.work.width / st.work.height) > 0.005;
}

/* ---------- preview ---------- */
function scheduleRender() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

function render() {
  if (!st.small) return;
  const { W, H } = outSize();
  const sc = Math.min(1, PREVIEW_SIDE / Math.max(W, H));
  const pw = Math.max(1, Math.round(W * sc)), ph = Math.max(1, Math.round(H * sc));

  if (cAfter.width !== pw || cAfter.height !== ph) { cAfter.width = pw; cAfter.height = ph; }
  const ctx = cAfter.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, pw, ph);
  geometry(ctx, st.small, pw, ph, st.crop, st.fx, st.fy);
  process(ctx, pw, ph, curEff());

  const key = [pw, ph, st.crop, st.fx.toFixed(4), st.fy.toFixed(4)].join('|');
  if (key !== beforeKey) {
    if (cBefore.width !== pw || cBefore.height !== ph) { cBefore.width = pw; cBefore.height = ph; }
    const bc = cBefore.getContext('2d');
    bc.clearRect(0, 0, pw, ph);
    geometry(bc, st.small, pw, ph, st.crop, st.fx, st.fy);
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
    const sc = st.crop === 'cover' ? Math.max(W / st.work.width, H / st.work.height) : Math.min(W / st.work.width, H / st.work.height);
    if (st.platform !== 'original' && sc > 1.02) parts.push('Source is ' + st.work.width + ' × ' + st.work.height + ' — it will be enlarged to fit this format.');
  }
  noteEl.textContent = parts.join(' ');
}

/* ---------- UI build ---------- */
function buildPlatforms() {
  const box = $('#platforms');
  box.innerHTML = '';
  PLATFORMS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'card'; b.dataset.id = p.id; b.type = 'button';
    b.innerHTML = '<b></b><small></small>';
    b.firstChild.textContent = p.name;
    b.lastChild.textContent = p.id === 'original' ? 'Keep dimensions' : p.w + ' × ' + p.h;
    b.addEventListener('click', () => { st.platform = p.id; st.fx = st.fy = .5; syncUI(); scheduleRender(); updateNote(); });
    box.appendChild(b);
  });
}

function buildFilters() {
  const box = $('#filters');
  box.innerHTML = '';
  FILTERS.forEach(f => {
    const b = document.createElement('button');
    b.className = 'fchip'; b.dataset.id = f.id; b.type = 'button';
    const cv = mk(96, 96);
    b.appendChild(cv);
    const sp = document.createElement('span'); sp.textContent = f.name; b.appendChild(sp);
    b.addEventListener('click', () => { st.filter = f.id; syncUI(); scheduleRender(); });
    box.appendChild(b);
  });
}

async function renderThumbs() {
  if (!st.small) return;
  for (const f of FILTERS) {
    const cv = $('.fchip[data-id="' + f.id + '"] canvas');
    if (!cv) continue;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    geometry(ctx, st.small, 96, 96, 'cover', .5, .5);
    process(ctx, 96, 96, effective({ b: 0, c: 0, s: 0, sharp: 0 }, f, 1));
    await new Promise(r => setTimeout(r, 0));
  }
}

function buildSliders() {
  const box = $('#sliders');
  box.innerHTML = '';
  SLIDERS.forEach(s => {
    const w = document.createElement('div'); w.className = 'sl';
    w.innerHTML = '<div class="lab"><span></span><output></output></div><input type="range">';
    $('span', w).textContent = s.label;
    const inp = $('input', w), out = $('output', w);
    inp.min = s.min; inp.max = s.max; inp.step = 1; inp.value = st[s.k]; inp.dataset.k = s.k;
    out.textContent = fmtVal(s, st[s.k]);
    inp.addEventListener('input', () => { st[s.k] = +inp.value; out.textContent = fmtVal(s, st[s.k]); scheduleRender(); });
    inp.addEventListener('dblclick', () => { inp.value = 0; inp.dispatchEvent(new Event('input')); });
    box.appendChild(w);
  });
  const w = document.createElement('div');
  w.className = 'sl'; w.style.marginTop = '12px';
  w.innerHTML = '<div class="lab"><span>Filter strength</span><output></output></div><input type="range" min="0" max="100" step="1">';
  const inp = $('input', w), out = $('output', w);
  inp.value = st.strength; out.textContent = st.strength + '%';
  inp.addEventListener('input', () => { st.strength = +inp.value; out.textContent = st.strength + '%'; scheduleRender(); });
  $('#rowStrength').appendChild(w);
}
function fmtVal(s, v) { return s.min < 0 && v > 0 ? '+' + v : String(v); }

function syncUI() {
  $$('#platforms .card').forEach(b => b.classList.toggle('on', b.dataset.id === st.platform));
  $$('#filters .fchip').forEach(b => b.classList.toggle('on', b.dataset.id === st.filter));
  $$('.seg').forEach(g => {
    const k = g.dataset.key;
    $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === st[k]));
  });
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

/* ---------- stage interactions ---------- */
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
    let cw = sw, ch = sh;
    if (W / H > sw / sh) ch = sw / (W / H); else cw = sh * (W / H);
    if (sw - cw > 0.5) st.fx = clamp(drag.fx - ((e.clientX - drag.x) / r.width) * cw / (sw - cw), 0, 1);
    if (sh - ch > 0.5) st.fy = clamp(drag.fy - ((e.clientY - drag.y) / r.height) * ch / (sh - ch), 0, 1);
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

/* ---------- loading ---------- */
function loadViaImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); res(im); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    im.src = url;
  });
}

async function loadFile(file) {
  if (!file) return;
  const ok = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!ok) { toast('Please choose a JPG, PNG or WEBP image.'); return; }
  busy(true, 'Loading photo…');
  await tick();
  try {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { bmp = await loadViaImg(file); }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    if (!w || !h) throw new Error('size');

    let tw = w, th = h, note = '';
    if (w * h > MAX_PIXELS) {
      const k = Math.sqrt(MAX_PIXELS / (w * h));
      tw = Math.max(1, Math.round(w * k)); th = Math.max(1, Math.round(h * k));
      note = 'Large photo (' + w + ' × ' + h + ') was scaled to ' + tw + ' × ' + th + ' to keep your device responsive.';
    }
    const work = mk(tw, th);
    drawScaled(work.getContext('2d'), bmp, 0, 0, w, h, 0, 0, tw, th);
    if (bmp.close) bmp.close();

    let small = work;
    if (Math.max(tw, th) > SMALL_SIDE) {
      const k = SMALL_SIDE / Math.max(tw, th);
      small = mk(Math.round(tw * k), Math.round(th * k));
      drawScaled(small.getContext('2d'), work, 0, 0, tw, th, 0, 0, small.width, small.height);
    }
    st.work = work; st.small = small; st.note = note;
    st.name = (file.name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'photo';
    st.fx = st.fy = .5; beforeKey = '';

    hero.hidden = true; editor.hidden = false;
    syncUI(); setTab('result');
    render(); updateNote();
    window.scrollTo({ top: 0 });
    renderThumbs();
  } catch (err) {
    toast('Could not open this image. Try another JPG, PNG or WEBP.');
  } finally {
    busy(false);
  }
}

/* ---------- export ---------- */
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
    geometry(ctx, st.work, W, H, st.crop, st.fx, st.fy);
    process(ctx, W, H, curEff());
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

/* ---------- wiring ---------- */
$$('.seg').forEach(g => {
  $$('button', g).forEach(b => b.addEventListener('click', () => {
    st[g.dataset.key] = b.dataset.v;
    syncUI();
    if (g.dataset.key === 'crop') { updateNote(); scheduleRender(); }
    if (g.dataset.key === 'fmt' || g.dataset.key === 'quality') { /* export only */ }
  }));
});
$$('#tabs button').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); }));
$('#resetAdj').addEventListener('click', () => {
  st.b = st.c = st.s = st.sharp = 0; st.strength = 100;
  $('#sliders').innerHTML = ''; $('#rowStrength').innerHTML = '';
  buildSliders(); scheduleRender();
});
$('#dl').addEventListener('click', doExport);
$('#change').addEventListener('click', () => $('#file2').click());
$('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('#file2').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });

const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over'); }));
window.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });

buildPlatforms(); buildFilters(); buildSliders(); syncUI();
})();
