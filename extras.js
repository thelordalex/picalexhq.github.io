/* PicalexHQ extras: add your own filters and effects here. script.js stays untouched. */
const { T, G, RG, VG, CM, ED, HT, ST, DO, BO, FL, SM, RY, SP, MX, SC, WP, BG, MI, SF, TL, SK, TX, RD, F, BL, NZ, D1, D2, D3, WH, RB } = PX;

/* ---------- FILTERS ----------
   PX.addFilter(id, name, params)
   params (all optional):
     b c s      brightness / contrast / saturation (same units as the sliders)
     temp       warm (+) / cool (-)           lift   lift shadows (0..1)
     hl         pull highlights down (0..1)   fade   washed blacks (0..0.15)
     vig        vignette (0..0.5)             clarity (0..0.6)      sharp (0..100)
     glow       bloom (0..1)                  grain  (0..0.6)
     split      colour grading: { sh:[r,g,b], hi:[r,g,b] }  (shadows / highlights, about -25..25)   */
PX.addFilter('golden', 'Golden Hour', { c: 6, s: 8, temp: 12, fade: .03, glow: .2, split: { sh: [6, 0, -4], hi: [12, 6, -10] } });
PX.addFilter('ice2', 'Frost', { c: 4, s: -8, temp: -12, lift: .3, glow: .15, split: { sh: [-6, 2, 12], hi: [-4, 4, 8] } });

/* ---------- EFFECTS ----------
   PX.addEffect(id, name, [step, step, ...])      steps run in order on the photo.
   Effect strength slider blends the result with the original.

   Ready-made steps:
     CM({c,s,b,m:[r,g,b],p,g})        colour matrix (c contrast, s saturation, b brightness, m rgb gain, p posterize levels, g:1 gray)
     T(color, mode, alpha)             flat colour overlay      modes: 'overlay' 'soft-light' 'screen' 'multiply' 'lighten' 'lighter'
     G([colors], mode, alpha, angle)   gradient overlay (0 = left→right, 90 = top→bottom)
     RG(x, y, size, [colors], mode, alpha)   radial gradient (x,y = 0..1)
     VG(alpha)                         dark vignette
     BL(0..1)  SF(0..1)  NZ(0..1)      bloom / soft focus / grain
     SC(alpha)                         scanlines
     ST(count, size, [colors], seed)   glowing stars
     ED('line'|'neon'|'sketch', [r,g,b], gain)   edge detection
     HT(cells, onPhoto, color)         halftone dots
     WP(ax, ay, fx, fy, phase)         wave / water distortion        BG(amount) lens bulge     MI(false|true) mirror
     F('glitch'|'vhs'|'rgb'|'ghost'|'leak'|'dust'|'pixel'|'wave', strength)   built-in effects as a step
     TX(() => text, 'left'|'right', x, y, color, size)   text stamp      D1 D2 D3 = date / short date / time
   Or write your own step: (ctx, w, h) => { ... draw on ctx ... }                                              */
PX.addEffect('sunset', 'Sunset Glow', [CM({ c: .1, s: .2 }), G(['rgba(255,120,60,0)', 'rgba(255,90,120,.55)'], 'screen', 1, 90), BL(.5), NZ(.1)]);
PX.addEffect('mono-dots', 'Mono Dots', [CM({ g: 1, c: .3 }), HT(90, false, '#111')]);
