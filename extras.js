/* ---------- FILM ---------- */
PX.addEffect('kodak-warm', 'Kodak Warm', [CM({c:.03,s:.04,b:-.02}), NZ(.05), G(['rgba(120,70,35,0)','rgba(255,190,0,.22)'],'overlay',.35,0)]);
PX.addEffect('kodak-cool', 'Kodak Cool', [CM({c:.05,s:.07,b:-.01}), NZ(.075), G(['rgba(30,80,150,0)','rgba(120,220,255,.22)'],'overlay',.35,90)]);
PX.addEffect('portra-soft', 'Portra Soft', [CM({c:.07,s:.10,b:-.01}), NZ(.10), G(['rgba(255,150,70,0)','rgba(255,220,150,.22)'],'overlay',.35,0)]);
PX.addEffect('portra-gold', 'Portra Gold', [CM({c:.09,s:.13,b:.01}), NZ(.075), G(['rgba(150,80,20,0)','rgba(255,190,50,.28)'],'overlay',.4,0)]);
PX.addEffect('fuji-green', 'Fuji Green', [CM({c:.05,s:.10,b:0}), G(['rgba(20,100,60,0)','rgba(120,255,100,.2)'],'overlay',.4,90), NZ(.05)]);
PX.addEffect('fuji-cyan', 'Fuji Cyan', [CM({c:.07,s:.07,b:-.01}), G(['rgba(0,80,120,0)','rgba(50,220,255,.22)'],'screen',.4,90), NZ(.06)]);
PX.addEffect('disposable-cam', 'Disposable Cam', [CM({c:.12,s:.16,b:-.03}), NZ(.13), F('leak',.18)]);
PX.addEffect('35mm-dust', '35mm Dust', [CM({c:.04,s:.08}), NZ(.14), F('dust',.25)]);
PX.addEffect('8mm-film', '8mm Film', [CM({c:.10,s:.12,b:-.04}), NZ(.18), SC(.08), F('dust',.2)]);
PX.addEffect('super-8', 'Super 8', [CM({c:.08,s:.15,b:-.02}), NZ(.16), F('leak',.2), SC(.08)]);
PX.addEffect('vintage-print', 'Vintage Print', [CM({c:.02,s:-.05,b:-.02}), NZ(.12), G(['rgba(80,45,20,0)','rgba(220,160,80,.25)'],'overlay',.4,90)]);
PX.addEffect('faded-film', 'Faded Film', [CM({c:-.03,s:-.08,b:.03}), NZ(.08), G(['rgba(255,255,255,.1)','rgba(240,220,190,.25)'],'screen',.3,90)]);
PX.addEffect('old-negative', 'Old Negative', [CM({c:.10,s:-.02,b:-.05}), F('rgb',.12), NZ(.15)]);
PX.addEffect('cinema-film', 'Cinema Film', [CM({c:.14,s:.08,b:-.04}), VG(.12), NZ(.07), G(['rgba(20,40,70,0)','rgba(255,150,80,.2)'],'overlay',.3,90)]);
PX.addEffect('brown-film', 'Brown Film', [CM({c:.06,s:-.03,b:-.02}), G(['rgba(80,45,20,0)','rgba(190,120,60,.3)'],'overlay',.5,90), NZ(.09)]);
PX.addEffect('silver-film', 'Silver Film', [CM({g:1,c:.12,s:-.1}), NZ(.11), G(['rgba(40,40,50,0)','rgba(220,220,230,.2)'],'screen',.3,90)]);
PX.addEffect('muted-film', 'Muted Film', [CM({c:.03,s:-.08,b:.01}), NZ(.07), VG(.05)]);
PX.addEffect('film-flash', 'Film Flash', [CM({c:.12,s:.12,b:.04}), BL(.12), F('leak',.16), NZ(.06)]);
PX.addEffect('film-fade', 'Film Fade', [CM({c:-.04,s:-.05,b:.04}), G(['rgba(255,255,255,.08)','rgba(255,210,170,.2)'],'screen',.4,0), NZ(.07)]);
PX.addEffect('analog-soft', 'Analog Soft', [CM({c:.04,s:.06}), BL(.14), NZ(.09)]);


/* ---------- VHS ---------- */
PX.addEffect('vhs-classic', 'VHS Classic', [CM({c:.05,s:-.04}), SC(.12), F('vhs',.18), NZ(.08)]);
PX.addEffect('vhs-blue', 'VHS Blue', [CM({c:.07,s:.02,b:-.01}), G(['rgba(0,40,120,0)','rgba(40,180,255,.25)'],'screen',.4,90), SC(.12), F('vhs',.2)]);
PX.addEffect('vhs-red', 'VHS Red', [CM({c:.08,s:.05}), G(['rgba(120,20,20,0)','rgba(255,60,60,.25)'],'screen',.4,90), SC(.12), F('vhs',.2)]);
PX.addEffect('vhs-tracking', 'VHS Tracking', [CM({c:.06,s:-.02}), SC(.18), F('vhs',.3)]);
PX.addEffect('vhs-ghost', 'VHS Ghost', [CM({c:.04,s:.02}), F('ghost',.3), SC(.10), NZ(.08)]);
PX.addEffect('vhs-scanlines', 'VHS Scanlines', [CM({c:.08,s:.03}), SC(.25), NZ(.05)]);
PX.addEffect('vhs-noise', 'VHS Noise', [CM({c:.04,s:.01}), F('vhs',.22), NZ(.18)]);
PX.addEffect('camcorder', 'Camcorder', [CM({c:.06,s:.04,b:-.02}), F('vhs',.14), SC(.12), NZ(.12)]);
PX.addEffect('hi8', 'Hi8', [CM({c:.08,s:.08}), NZ(.16), SC(.14), F('vhs',.16)]);
PX.addEffect('tape-bleed', 'Tape Bleed', [CM({c:.03,s:.02}), F('ghost',.18), F('vhs',.22), NZ(.10)]);
PX.addEffect('tape-warp', 'Tape Warp', [WP(.012,.008,1.8,1.3,1.5), SC(.12), F('vhs',.18)]);
PX.addEffect('crt-tape', 'CRT Tape', [CM({c:.10,s:.02}), SC(.28), F('vhs',.16), VG(.08)]);
PX.addEffect('retro-tv', 'Retro TV', [CM({c:.08,s:-.02}), SC(.22), F('rgb',.10), NZ(.09)]);
PX.addEffect('home-video', 'Home Video', [CM({c:.04,s:.03,b:-.01}), F('vhs',.12), NZ(.13)]);
PX.addEffect('90s-tape', '90s Tape', [CM({c:.07,s:.08,b:-.02}), F('vhs',.20), SC(.16), NZ(.10)]);
PX.addEffect('90s-camcorder', '90s Camcorder', [CM({c:.06,s:.10,b:-.03}), F('vhs',.18), SC(.14), F('leak',.08)]);
PX.addEffect('tracking-error', 'Tracking Error', [CM({c:.05,s:.01}), SC(.25), F('wave',.22), F('vhs',.22)]);
PX.addEffect('tape-color', 'Tape Color', [CM({c:.04,s:.10}), F('rgb',.12), F('vhs',.18), NZ(.08)]);
PX.addEffect('tape-haze', 'Tape Haze', [CM({c:.01,s:-.02,b:.02}), BL(.16), F('vhs',.16), NZ(.10)]);
PX.addEffect('analog-tv', 'Analog TV', [CM({c:.10,s:-.02}), SC(.30), F('rgb',.08), F('vhs',.18), VG(.06)]);
/* ---------- GLOW / LIGHT ---------- */

PX.addEffect('dream-glow', 'Dream Glow', [
  CM({c:-.03,s:.08,b:.02}),
  BL(.28),
  G(['rgba(255,150,220,0)','rgba(180,120,255,.35)'],'screen',.7,90)
]);

PX.addEffect('soft-bloom', 'Soft Bloom', [
  CM({s:.06,b:.02}),
  BL(.35),
  NZ(.04)
]);

PX.addEffect('golden-bloom', 'Golden Bloom', [
  CM({s:.12,b:.02}),
  BL(.3),
  G(['rgba(255,120,20,0)','rgba(255,210,80,.4)'],'screen',.7,90)
]);

PX.addEffect('pink-bloom', 'Pink Bloom', [
  CM({s:.08}),
  BL(.32),
  G(['rgba(255,80,150,0)','rgba(255,160,220,.35)'],'screen',.7,90)
]);

PX.addEffect('blue-bloom', 'Blue Bloom', [
  CM({s:.05,b:-.01}),
  BL(.3),
  G(['rgba(40,100,255,0)','rgba(100,220,255,.35)'],'screen',.7,90)
]);

PX.addEffect('neon-bloom', 'Neon Bloom', [
  CM({c:.08,s:.18}),
  BL(.42),
  F('rgb',.08)
]);

PX.addEffect('lens-glow', 'Lens Glow', [
  BL(.25),
  RG(.5,.35,.8,['rgba(255,255,255,0)','rgba(255,220,170,.4)'],'screen',.7),
  NZ(.05)
]);

PX.addEffect('light-leak', 'Light Leak', [
  G(['rgba(255,80,20,.5)','rgba(255,220,100,0)'],'screen',.8,0),
  BL(.18),
  NZ(.05)
]);

PX.addEffect('sun-flare', 'Sun Flare', [
  G(['rgba(255,220,100,.5)','rgba(255,100,20,0)'],'screen',.8,0),
  BL(.3)
]);

PX.addEffect('warm-flare', 'Warm Flare', [
  G(['rgba(255,120,30,.45)','rgba(255,220,100,0)'],'screen',.75,0),
  BL(.25)
]);

PX.addEffect('cool-flare', 'Cool Flare', [
  G(['rgba(40,130,255,.4)','rgba(120,230,255,0)'],'screen',.75,90),
  BL(.25)
]);

PX.addEffect('halo', 'Halo', [
  RG(.5,.5,.75,['rgba(255,255,255,.35)','rgba(255,255,255,0)'],'screen',.8),
  BL(.22)
]);

PX.addEffect('hazy-light', 'Hazy Light', [
  CM({c:-.02,s:.04,b:.03}),
  BL(.3),
  G(['rgba(255,255,255,.18)','rgba(255,220,190,0)'],'screen',.5,90)
]);

PX.addEffect('pearl-glow', 'Pearl Glow', [
  CM({s:-.02,b:.03}),
  BL(.32),
  G(['rgba(255,240,250,.25)','rgba(210,230,255,0)'],'screen',.6,90)
]);

PX.addEffect('cloud-glow', 'Cloud Glow', [
  CM({c:-.04,s:.02,b:.04}),
  BL(.38),
  NZ(.04)
]);

PX.addEffect('night-glow', 'Night Glow', [
  CM({c:.08,s:.04,b:-.04}),
  BL(.25),
  G(['rgba(30,70,180,.25)','rgba(120,180,255,0)'],'screen',.6,90)
]);

PX.addEffect('magic-glow', 'Magic Glow', [
  CM({s:.15}),
  BL(.35),
  F('rgb',.07),
  NZ(.05)
]);

PX.addEffect('electric-glow', 'Electric Glow', [
  CM({c:.12,s:.2}),
  BL(.3),
  G(['rgba(0,180,255,.35)','rgba(180,0,255,.25)'],'screen',.7,90)
]);

PX.addEffect('pastel-glow', 'Pastel Glow', [
  CM({c:-.03,s:.04,b:.04}),
  BL(.35),
  G(['rgba(255,180,220,.2)','rgba(180,220,255,.2)'],'screen',.6,90)
]);

PX.addEffect('candle-glow', 'Candle Glow', [
  CM({c:.04,s:.08,b:-.02}),
  BL(.25),
  G(['rgba(255,80,20,.35)','rgba(255,210,80,0)'],'screen',.7,90)
]);


/* ---------- RGB / CHROMATIC ---------- */

PX.addEffect('rgb-split', 'RGB Split', [
  F('rgb',.28)
]);

PX.addEffect('red-shift', 'Red Shift', [
  F('rgb',.18),
  G(['rgba(255,0,0,.25)','rgba(255,40,40,0)'],'screen',.4,0)
]);

PX.addEffect('blue-shift', 'Blue Shift', [
  F('rgb',.18),
  G(['rgba(0,80,255,.25)','rgba(40,180,255,0)'],'screen',.4,90)
]);

PX.addEffect('cyan-shift', 'Cyan Shift', [
  F('rgb',.2),
  G(['rgba(0,220,220,.25)','rgba(0,120,255,0)'],'screen',.4,90)
]);

PX.addEffect('magenta-shift', 'Magenta Shift', [
  F('rgb',.2),
  G(['rgba(255,0,180,.25)','rgba(150,0,255,0)'],'screen',.4,90)
]);

PX.addEffect('chromatic-edge', 'Chromatic Edge', [
  ED('neon',[255,40,100],.8),
  F('rgb',.16)
]);

PX.addEffect('prism', 'Prism', [
  F('rgb',.22),
  G(['rgba(255,0,100,.2)','rgba(0,180,255,.2)'],'screen',.5,90)
]);

PX.addEffect('rgb-ghost', 'RGB Ghost', [
  F('ghost',.2),
  F('rgb',.22)
]);

PX.addEffect('color-echo', 'Color Echo', [
  F('ghost',.24),
  CM({s:.14})
]);

PX.addEffect('channel-offset', 'Channel Offset', [
  F('rgb',.3)
]);

PX.addEffect('red-cyan', 'Red Cyan', [
  F('rgb',.24),
  G(['rgba(255,0,0,.2)','rgba(0,220,220,.2)'],'screen',.5,0)
]);

PX.addEffect('blue-yellow', 'Blue Yellow', [
  F('rgb',.2),
  G(['rgba(30,80,255,.2)','rgba(255,220,0,.2)'],'overlay',.5,90)
]);

PX.addEffect('purple-green', 'Purple Green', [
  F('rgb',.22),
  G(['rgba(180,0,255,.25)','rgba(0,255,100,.2)'],'screen',.5,90)
]);

PX.addEffect('digital-prism', 'Digital Prism', [
  F('rgb',.3),
  BL(.12),
  CM({s:.12})
]);

PX.addEffect('spectrum', 'Spectrum', [
  F('rgb',.26),
  G([
    'rgba(255,0,80,.25)',
    'rgba(255,220,0,.2)',
    'rgba(0,255,150,.2)',
    'rgba(0,100,255,.25)'
  ],'screen',.65,0)
]);

PX.addEffect('color-fracture', 'Color Fracture', [
  F('glitch',.18),
  F('rgb',.3)
]);

PX.addEffect('rgb-wave', 'RGB Wave', [
  WP(.008,.006,1.5,1.2,1.4),
  F('rgb',.24)
]);

PX.addEffect('chromatic-blur', 'Chromatic Blur', [
  BL(.18),
  F('rgb',.22)
]);

PX.addEffect('neon-split', 'Neon Split', [
  CM({c:.12,s:.2}),
  F('rgb',.28),
  BL(.12)
]);

PX.addEffect('3d-glasses', '3D Glasses', [
  F('rgb',.34)
]);


/* ---------- RETRO / Y2K ---------- */

PX.addEffect('y2k', 'Y2K', [
  CM({c:.1,s:.18,b:.01}),
  F('rgb',.1),
  NZ(.08),
  BL(.08)
]);

PX.addEffect('y2k-flash', 'Y2K Flash', [
  CM({c:.14,s:.2,b:.05}),
  BL(.16),
  F('leak',.18)
]);

PX.addEffect('cyber-y2k', 'Cyber Y2K', [
  CM({c:.15,s:.22}),
  F('rgb',.18),
  G(['rgba(0,220,255,.2)','rgba(255,0,220,.2)'],'screen',.6,90)
]);

PX.addEffect('chrome-y2k', 'Chrome Y2K', [
  CM({c:.18,s:.04}),
  G(['rgba(180,220,255,.25)','rgba(255,255,255,.2)'],'screen',.5,90),
  BL(.12)
]);

PX.addEffect('magazine', 'Magazine', [
  CM({c:.12,s:.12}),
  HT(70,false,'#222'),
  NZ(.04)
]);

PX.addEffect('pop-print', 'Pop Print', [
  CM({c:.2,s:.2}),
  HT(60,false,'#111')
]);

PX.addEffect('arcade', 'Arcade', [
  CM({c:.14,s:.18}),
  SC(.12),
  F('rgb',.1)
]);

PX.addEffect('gameboy', 'Gameboy', [
  CM({g:1,c:.08,s:-.1}),
  G(['rgba(20,60,20,.25)','rgba(160,220,100,.25)'],'overlay',.6,90),
  NZ(.05)
]);

PX.addEffect('pixel-pop', 'Pixel Pop', [
  CM({c:.15,s:.2}),
  F('pixel',.3),
  NZ(.04)
]);

PX.addEffect('digital-camera', 'Digital Camera', [
  CM({c:.1,s:.12,b:.01}),
  NZ(.08),
  BL(.06)
]);

PX.addEffect('ccd-flash', 'CCD Flash', [
  CM({c:.15,s:.15,b:.05}),
  BL(.1),
  NZ(.06)
]);

PX.addEffect('early-digital', 'Early Digital', [
  CM({c:.08,s:.08,b:-.02}),
  NZ(.12),
  F('rgb',.08)
]);

PX.addEffect('myspace', 'MySpace', [
  CM({c:.08,s:.14}),
  BL(.12),
  F('leak',.12),
  NZ(.08)
]);

PX.addEffect('cyber-flash', 'Cyber Flash', [
  CM({c:.16,s:.22,b:.03}),
  F('rgb',.15),
  BL(.15)
]);

PX.addEffect('retro-chrome', 'Retro Chrome', [
  CM({c:.18,s:.04}),
  G(['rgba(40,60,90,.15)','rgba(230,230,255,.25)'],'overlay',.5,90),
  NZ(.06)
]);

PX.addEffect('plastic-camera', 'Plastic Camera', [
  CM({c:.1,s:.15,b:-.01}),
  BL(.1),
  NZ(.12),
  F('leak',.08)
]);

PX.addEffect('toy-camera', 'Toy Camera', [
  CM({c:.12,s:.16,b:-.02}),
  VG(.2),
  NZ(.12)
]);

PX.addEffect('lomo', 'Lomo', [
  CM({c:.18,s:.2,b:-.03}),
  VG(.25),
  NZ(.08)
]);

PX.addEffect('cross-process', 'Cross Process', [
  CM({c:.14,s:.18,b:-.02}),
  G(['rgba(30,100,180,.18)','rgba(255,170,40,.2)'],'overlay',.5,90),
  NZ(.06)
]);

PX.addEffect('retro-punch', 'Retro Punch', [
  CM({c:.2,s:.22,b:-.01}),
  VG(.1),
  NZ(.06)
]);
/* ---------- PRINT / HALFTONE ---------- */

PX.addEffect('halftone', 'Halftone', [
  CM({c:.12,s:.04}),
  HT(70,false,'#111')
]);

PX.addEffect('fine-halftone', 'Fine Halftone', [
  CM({c:.08,s:.02}),
  HT(45,false,'#222')
]);

PX.addEffect('large-dots', 'Large Dots', [
  CM({c:.16,s:.08}),
  HT(110,false,'#111')
]);

PX.addEffect('comic-ink', 'Comic Ink', [
  CM({g:1,c:.2,s:-.1}),
  ED('line',[20,20,20],.8),
  HT(85,false,'#111')
]);

PX.addEffect('newspaper', 'Newspaper', [
  CM({g:1,c:.18,s:-.15}),
  HT(65,false,'#222')
]);

PX.addEffect('magazine-print', 'Magazine Print', [
  CM({c:.12,s:.12}),
  HT(75,false,'#111')
]);

PX.addEffect('risograph', 'Risograph', [
  CM({c:.1,s:.1}),
  G(['rgba(255,50,80,.18)','rgba(30,80,220,.2)'],'multiply',.55,90),
  HT(80,false,'#222')
]);

PX.addEffect('screen-print', 'Screen Print', [
  CM({c:.2,s:.12}),
  HT(90,false,'#111')
]);

PX.addEffect('ink-bleed', 'Ink Bleed', [
  CM({c:.08,s:-.04}),
  BL(.12),
  HT(80,false,'#222')
]);

PX.addEffect('dot-matrix', 'Dot Matrix', [
  CM({g:1,c:.14,s:-.1}),
  HT(55,false,'#111'),
  SC(.08)
]);

PX.addEffect('laser-print', 'Laser Print', [
  CM({g:1,c:.22,s:-.12}),
  HT(50,false,'#222')
]);

PX.addEffect('xerox', 'Xerox', [
  CM({g:1,c:.3,b:-.04}),
  HT(75,false,'#111'),
  NZ(.05)
]);

PX.addEffect('photocopy', 'Photocopy', [
  CM({g:1,c:.26,b:-.06}),
  ED('sketch',[30,30,30],.45),
  HT(90,false,'#222')
]);

PX.addEffect('newsprint', 'Newsprint', [
  CM({g:1,c:.12,s:-.15,b:.02}),
  HT(95,false,'#333'),
  NZ(.04)
]);

PX.addEffect('comic-shadow', 'Comic Shadow', [
  CM({c:.22,s:.12}),
  ED('line',[10,10,10],.65),
  HT(85,false,'#111')
]);

PX.addEffect('pop-art', 'Pop Art', [
  CM({c:.25,s:.3}),
  HT(70,false,'#111'),
  G(['rgba(255,0,100,.15)','rgba(0,180,255,.15)'],'screen',.5,90)
]);

PX.addEffect('cmyk-print', 'CMYK Print', [
  CM({c:.18,s:.12}),
  F('rgb',.12),
  HT(75,false,'#111')
]);

PX.addEffect('poster-print', 'Poster Print', [
  CM({c:.28,s:.16}),
  HT(65,false,'#111')
]);

PX.addEffect('stencil', 'Stencil', [
  CM({g:1,c:.35,s:-.2}),
  ED('line',[0,0,0],.9)
]);

PX.addEffect('cross-hatch', 'Cross Hatch', [
  CM({g:1,c:.18,s:-.12}),
  ED('sketch',[30,30,30],.8)
]);


/* ---------- DISTORTION ---------- */

PX.addEffect('wave', 'Wave', [
  WP(.012,.008,1.6,1.2,1.2)
]);

PX.addEffect('water-ripple', 'Water Ripple', [
  WP(.018,.012,2,1.5,2.2),
  BL(.04)
]);

PX.addEffect('heat-wave', 'Heat Wave', [
  WP(.022,.006,2.5,1.1,3),
  BL(.05)
]);

PX.addEffect('lens-bulge', 'Lens Bulge', [
  BG(.22),
  CM({c:.06,s:.04})
]);

PX.addEffect('fish-eye', 'Fish Eye', [
  BG(.4),
  VG(.08)
]);

PX.addEffect('tunnel', 'Tunnel', [
  BG(.3),
  VG(.22),
  CM({c:.08,s:.04})
]);

PX.addEffect('swirl', 'Swirl', [
  WP(.02,.018,2.2,2,4)
]);

PX.addEffect('twist', 'Twist', [
  WP(.028,.02,2.8,2.4,5)
]);

PX.addEffect('shockwave', 'Shockwave', [
  WP(.035,.008,3,1.2,1),
  F('wave',.12)
]);

PX.addEffect('ripple-ring', 'Ripple Ring', [
  RG(.5,.5,.7,['rgba(255,255,255,.15)','rgba(255,255,255,0)'],'screen',.7),
  WP(.018,.018,2.2,2.2,2)
]);

PX.addEffect('liquid', 'Liquid', [
  WP(.025,.025,2.5,2.5,3),
  BL(.08)
]);

PX.addEffect('wavy-glass', 'Wavy Glass', [
  WP(.015,.02,2,2.8,4),
  BL(.1)
]);

PX.addEffect('dream-warp', 'Dream Warp', [
  WP(.02,.014,2.2,1.8,2),
  BL(.18),
  NZ(.05)
]);

PX.addEffect('pixel-warp', 'Pixel Warp', [
  F('pixel',.22),
  WP(.018,.012,2,1.5,2.8)
]);

PX.addEffect('horizontal-warp', 'Horizontal Warp', [
  WP(.035,.003,3.2,1,1.7)
]);

PX.addEffect('vertical-warp', 'Vertical Warp', [
  WP(.004,.035,1,3.2,2.4)
]);

PX.addEffect('jelly', 'Jelly', [
  WP(.025,.025,2.8,2.8,3.5),
  BL(.06)
]);

PX.addEffect('rubber', 'Rubber', [
  WP(.04,.015,3.5,1.4,4.5)
]);

PX.addEffect('mirror-wave', 'Mirror Wave', [
  MI(true),
  WP(.018,.018,2.2,2.2,2.5)
]);

PX.addEffect('kaleidoscope', 'Kaleidoscope', [
  MI(true),
  WP(.025,.025,3,3,3)
]);


/* ---------- DARK / MOODY ---------- */

PX.addEffect('noir', 'Noir', [
  CM({g:1,c:.18,s:-.12}),
  VG(.16)
]);

PX.addEffect('deep-noir', 'Deep Noir', [
  CM({g:1,c:.28,s:-.18,b:-.06}),
  VG(.25)
]);

PX.addEffect('midnight', 'Midnight', [
  CM({c:.12,s:-.02,b:-.1}),
  G(['rgba(10,20,70,.28)','rgba(0,0,20,.15)'],'multiply',.55,90),
  VG(.15)
]);

PX.addEffect('blue-night', 'Blue Night', [
  CM({c:.12,s:.02,b:-.08}),
  G(['rgba(20,60,180,.25)','rgba(0,10,50,.25)'],'multiply',.6,90),
  VG(.12)
]);

PX.addEffect('dark-red', 'Dark Red', [
  CM({c:.14,s:.04,b:-.08}),
  G(['rgba(100,0,20,.3)','rgba(30,0,0,.2)'],'multiply',.6,90),
  VG(.15)
]);

PX.addEffect('black-chrome', 'Black Chrome', [
  CM({c:.24,s:-.04,b:-.08}),
  VG(.22),
  NZ(.04)
]);

PX.addEffect('moody-blue', 'Moody Blue', [
  CM({c:.16,s:.02,b:-.07}),
  G(['rgba(20,70,150,.25)','rgba(10,20,60,.2)'],'overlay',.55,90),
  VG(.14)
]);

PX.addEffect('shadow-crush', 'Shadow Crush', [
  CM({c:.3,s:.04,b:-.1}),
  VG(.18)
]);

PX.addEffect('underexposed', 'Underexposed', [
  CM({c:.08,s:.02,b:-.16}),
  VG(.12)
]);

PX.addEffect('night-drive', 'Night Drive', [
  CM({c:.16,s:.06,b:-.1}),
  G(['rgba(0,40,100,.2)','rgba(0,0,0,.25)'],'multiply',.55,90),
  BL(.05)
]);

PX.addEffect('urban-night', 'Urban Night', [
  CM({c:.2,s:.08,b:-.08}),
  F('rgb',.06),
  VG(.18)
]);

PX.addEffect('blackout', 'Blackout', [
  CM({c:.22,s:-.05,b:-.2}),
  VG(.3)
]);

PX.addEffect('dark-cyan', 'Dark Cyan', [
  CM({c:.14,s:.02,b:-.09}),
  G(['rgba(0,90,110,.28)','rgba(0,20,30,.25)'],'multiply',.6,90)
]);

PX.addEffect('dark-purple', 'Dark Purple', [
  CM({c:.16,s:.06,b:-.08}),
  G(['rgba(70,0,120,.28)','rgba(20,0,40,.2)'],'multiply',.6,90)
]);

PX.addEffect('low-key', 'Low Key', [
  CM({c:.12,s:-.02,b:-.12}),
  VG(.25),
  NZ(.05)
]);

PX.addEffect('night-vision', 'Night Vision', [
  CM({g:1,c:.1,s:-.1}),
  G(['rgba(0,40,0,.2)','rgba(100,255,80,.35)'],'screen',.55,90),
  NZ(.08)
]);

PX.addEffect('infrared', 'Infrared', [
  CM({c:.2,s:.12}),
  G(['rgba(255,0,0,.3)','rgba(40,0,80,.2)'],'overlay',.55,90),
  NZ(.05)
]);

PX.addEffect('red-night', 'Red Night', [
  CM({c:.16,s:.04,b:-.08}),
  G(['rgba(150,0,0,.3)','rgba(40,0,0,.2)'],'screen',.5,90),
  VG(.16)
]);

PX.addEffect('moonlight', 'Moonlight', [
  CM({c:.1,s:-.03,b:-.06}),
  G(['rgba(80,120,220,.3)','rgba(20,30,80,.15)'],'screen',.55,90),
  BL(.08)
]);

PX.addEffect('dark-dream', 'Dark Dream', [
  CM({c:.02,s:.02,b:-.08}),
  BL(.2),
  G(['rgba(70,40,130,.2)','rgba(20,10,60,.2)'],'overlay',.5,90),
  VG(.15)
]);
/* ---------- DIGITAL / GLITCH ---------- */

PX.addEffect('glitch', 'Glitch', [
  F('glitch', .3),
  F('rgb', .18),
  SC(.08)
]);

PX.addEffect('glitch-blocks', 'Glitch Blocks', [
  F('glitch', .42),
  F('pixel', .12),
  F('rgb', .22)
]);

PX.addEffect('digital-noise', 'Digital Noise', [
  CM({c:.06,s:.02}),
  NZ(.3),
  SC(.08)
]);

PX.addEffect('pixelate', 'Pixelate', [
  F('pixel', .38),
  CM({c:.08,s:.04})
]);

PX.addEffect('datamosh', 'Datamosh', [
  F('glitch', .48),
  F('ghost', .2),
  F('rgb', .25)
]);

PX.addEffect('corrupt', 'Corrupt', [
  F('glitch', .55),
  F('wave', .2),
  F('rgb', .3)
]);

PX.addEffect('broken-signal', 'Broken Signal', [
  F('glitch', .4),
  SC(.2),
  F('wave', .18)
]);

PX.addEffect('error-screen', 'Error Screen', [
  F('glitch', .5),
  F('rgb', .28),
  SC(.22)
]);

PX.addEffect('digital-dust', 'Digital Dust', [
  F('dust', .32),
  NZ(.2),
  CM({c:.08,s:.02})
]);

PX.addEffect('scanline', 'Scanline', [
  SC(.32),
  CM({c:.08,s:.02})
]);

PX.addEffect('crt', 'CRT', [
  SC(.3),
  F('rgb', .1),
  VG(.12)
]);

PX.addEffect('lcd', 'LCD', [
  SC(.18),
  CM({c:.12,s:-.02}),
  F('rgb', .08)
]);

PX.addEffect('ascii', 'ASCII', [
  CM({g:1,c:.2,s:-.15}),
  HT(45,false,'#111')
]);

PX.addEffect('binary', 'Binary', [
  CM({g:1,c:.3,s:-.2}),
  HT(55,false,'#111'),
  SC(.12)
]);

PX.addEffect('data-leak', 'Data Leak', [
  F('glitch', .35),
  F('rgb', .2),
  F('leak', .18)
]);

PX.addEffect('compression', 'Compression', [
  F('pixel', .18),
  F('glitch', .2),
  NZ(.12)
]);

PX.addEffect('jpeg-damage', 'JPEG Damage', [
  F('pixel', .25),
  F('glitch', .3),
  NZ(.18)
]);

PX.addEffect('pixel-drift', 'Pixel Drift', [
  F('pixel', .22),
  WP(.012,.008,1.8,1.5,2.5),
  F('rgb', .18)
]);

PX.addEffect('cyber-noise', 'Cyber Noise', [
  NZ(.28),
  F('rgb', .24),
  SC(.14),
  CM({c:.14,s:.18})
]);

PX.addEffect('matrix', 'Matrix', [
  CM({g:1,c:.22,s:-.12}),
  G(['rgba(0,30,0,.2)','rgba(40,255,80,.35)'],'screen',.6,90),
  SC(.16),
  NZ(.08)
]);


/* ---------- DREAM / SOFT ---------- */

PX.addEffect('dream', 'Dream', [
  CM({c:-.04,s:.06,b:.03}),
  BL(.22),
  NZ(.04)
]);

PX.addEffect('soft-focus', 'Soft Focus', [
  BL(.28),
  CM({c:-.02,s:.03,b:.02})
]);

PX.addEffect('ethereal', 'Ethereal', [
  CM({c:-.05,s:.02,b:.04}),
  BL(.32),
  G(['rgba(180,210,255,.18)','rgba(255,220,245,.2)'],'screen',.55,90)
]);

PX.addEffect('cloudy', 'Cloudy', [
  CM({c:-.06,s:-.01,b:.05}),
  BL(.38),
  NZ(.03)
]);

PX.addEffect('fairy', 'Fairy', [
  CM({s:.12,b:.03}),
  BL(.28),
  G(['rgba(255,170,220,.25)','rgba(160,220,255,.22)'],'screen',.65,90)
]);

PX.addEffect('pastel-dream', 'Pastel Dream', [
  CM({c:-.04,s:.04,b:.05}),
  BL(.3),
  G(['rgba(255,180,210,.18)','rgba(180,220,255,.2)'],'screen',.55,0)
]);

PX.addEffect('milky', 'Milky', [
  CM({c:-.08,s:-.02,b:.06}),
  BL(.35),
  G(['rgba(255,255,255,.25)','rgba(250,235,240,.15)'],'screen',.55,90)
]);

PX.addEffect('velvet', 'Velvet', [
  CM({c:.02,s:.08,b:-.01}),
  BL(.18),
  G(['rgba(90,30,80,.12)','rgba(220,80,150,.15)'],'overlay',.5,90)
]);

PX.addEffect('airbrush', 'Airbrush', [
  CM({c:-.06,s:.05,b:.03}),
  BL(.3),
  NZ(.02)
]);

PX.addEffect('soft-film', 'Soft Film', [
  CM({c:.02,s:.05,b:.01}),
  BL(.16),
  NZ(.1)
]);

PX.addEffect('romantic', 'Romantic', [
  CM({c:-.03,s:.1,b:.03}),
  BL(.25),
  G(['rgba(255,80,140,.18)','rgba(255,210,220,.2)'],'screen',.6,90)
]);

PX.addEffect('heaven', 'Heaven', [
  CM({c:-.06,s:.02,b:.06}),
  BL(.35),
  G(['rgba(180,210,255,.25)','rgba(255,255,255,.2)'],'screen',.6,90)
]);

PX.addEffect('blue-dream', 'Blue Dream', [
  CM({c:-.02,s:.06,b:.01}),
  BL(.25),
  G(['rgba(40,100,255,.22)','rgba(130,210,255,.2)'],'screen',.6,90)
]);

PX.addEffect('pink-dream', 'Pink Dream', [
  CM({c:-.03,s:.08,b:.03}),
  BL(.26),
  G(['rgba(255,60,150,.2)','rgba(255,190,230,.2)'],'screen',.6,90)
]);

PX.addEffect('lavender-dream', 'Lavender Dream', [
  CM({c:-.04,s:.06,b:.03}),
  BL(.28),
  G(['rgba(120,70,220,.2)','rgba(220,170,255,.2)'],'screen',.6,90)
]);

PX.addEffect('warm-dream', 'Warm Dream', [
  CM({c:-.02,s:.08,b:.03}),
  BL(.25),
  G(['rgba(255,120,50,.2)','rgba(255,220,150,.18)'],'screen',.6,90)
]);

PX.addEffect('sleepy', 'Sleepy', [
  CM({c:-.08,s:-.02,b:.02}),
  BL(.32),
  VG(.04)
]);

PX.addEffect('fantasy', 'Fantasy', [
  CM({s:.12,b:.04}),
  BL(.3),
  F('rgb',.06),
  NZ(.03)
]);

PX.addEffect('glow-mist', 'Glow Mist', [
  CM({c:-.04,s:.06,b:.03}),
  BL(.4),
  G(['rgba(255,255,255,.2)','rgba(180,210,255,.15)'],'screen',.6,90)
]);

PX.addEffect('dream-haze', 'Dream Haze', [
  CM({c:-.05,s:.04,b:.04}),
  BL(.36),
  NZ(.05),
  VG(.04)
]);


/* ---------- EXTRA CINEMATIC / CREATIVE ---------- */

PX.addEffect('cinematic-teal', 'Cinematic Teal', [
  CM({c:.12,s:.08,b:-.03}),
  G(['rgba(0,100,120,.22)','rgba(255,120,50,.18)'],'overlay',.55,90),
  VG(.1)
]);

PX.addEffect('cinematic-orange', 'Cinematic Orange', [
  CM({c:.14,s:.1,b:-.02}),
  G(['rgba(255,120,30,.22)','rgba(20,70,140,.18)'],'overlay',.55,90),
  VG(.1)
]);

PX.addEffect('golden-shadow', 'Golden Shadow', [
  CM({c:.1,s:.12,b:-.02}),
  G(['rgba(120,70,20,.2)','rgba(255,190,60,.25)'],'overlay',.5,90)
]);

PX.addEffect('cold-metal', 'Cold Metal', [
  CM({c:.2,s:-.04,b:-.04}),
  G(['rgba(30,60,100,.2)','rgba(200,220,255,.18)'],'overlay',.5,90),
  NZ(.04)
]);

PX.addEffect('chrome-light', 'Chrome Light', [
  CM({c:.22,s:.02,b:.02}),
  BL(.08),
  G(['rgba(100,150,200,.15)','rgba(255,255,255,.25)'],'screen',.5,90)
]);

PX.addEffect('neon-night', 'Neon Night', [
  CM({c:.16,s:.18,b:-.08}),
  F('rgb',.18),
  BL(.18),
  VG(.12)
]);

PX.addEffect('purple-neon', 'Purple Neon', [
  CM({c:.12,s:.2,b:-.03}),
  G(['rgba(120,0,255,.28)','rgba(255,0,180,.2)'],'screen',.65,90),
  BL(.2)
]);

PX.addEffect('blue-neon', 'Blue Neon', [
  CM({c:.14,s:.18,b:-.04}),
  G(['rgba(0,100,255,.28)','rgba(0,220,255,.2)'],'screen',.65,90),
  BL(.18)
]);

PX.addEffect('red-neon', 'Red Neon', [
  CM({c:.15,s:.2,b:-.03}),
  G(['rgba(255,0,40,.3)','rgba(255,100,0,.18)'],'screen',.65,90),
  BL(.18)
]);

PX.addEffect('golden-hour', 'Golden Hour', [
  CM({c:.08,s:.14,b:.02}),
  G(['rgba(255,120,20,.25)','rgba(255,220,100,.25)'],'screen',.65,90),
  BL(.12)
]);

PX.addEffect('frosted', 'Frosted', [
  CM({c:.04,s:-.08,b:.02}),
  G(['rgba(80,150,255,.2)','rgba(220,250,255,.3)'],'screen',.65,90),
  BL(.2),
  NZ(.04)
]);

PX.addEffect('silver-dream', 'Silver Dream', [
  CM({g:1,c:.08,s:-.1,b:.03}),
  BL(.18),
  G(['rgba(100,130,170,.18)','rgba(255,255,255,.22)'],'screen',.55,90)
]);

PX.addEffect('old-camera', 'Old Camera', [
  CM({c:.08,s:.06,b:-.03}),
  NZ(.18),
  VG(.18),
  F('dust',.2)
]);

PX.addEffect('flash-dust', 'Flash Dust', [
  CM({c:.14,s:.14,b:.04}),
  BL(.08),
  NZ(.2),
  F('dust',.24)
]);

PX.addEffect('street-film', 'Street Film', [
  CM({c:.14,s:.08,b:-.03}),
  NZ(.12),
  VG(.12),
  F('dust',.1)
]);

PX.addEffect('night-film', 'Night Film', [
  CM({c:.14,s:.02,b:-.1}),
  NZ(.13),
  VG(.2),
  G(['rgba(20,60,130,.18)','rgba(0,0,30,.2)'],'overlay',.45,90)
]);

PX.addEffect('polaroid', 'Polaroid', [
  CM({c:.04,s:.04,b:.03}),
  G(['rgba(255,210,150,.12)','rgba(255,255,220,.18)'],'screen',.4,90),
  NZ(.07)
]);

PX.addEffect('instant-film', 'Instant Film', [
  CM({c:.02,s:.08,b:.02}),
  BL(.06),
  NZ(.1),
  F('leak',.08)
]);

PX.addEffect('faded-polaroid', 'Faded Polaroid', [
  CM({c:-.04,s:-.05,b:.05}),
  G(['rgba(255,220,190,.15)','rgba(255,255,255,.18)'],'screen',.45,90),
  NZ(.08)
]);

PX.addEffect('flashback', 'Flashback', [
  CM({c:-.02,s:.1,b:.04}),
  BL(.22),
  F('leak',.15),
  NZ(.08)
]);

PX.addEffect('memory', 'Memory', [
  CM({c:-.05,s:-.02,b:.03}),
  BL(.18),
  NZ(.12),
  G(['rgba(220,170,120,.15)','rgba(255,220,180,.15)'],'overlay',.4,90)
]);

PX.addEffect('lost-tape', 'Lost Tape', [
  CM({c:.02,s:-.04,b:-.04}),
  F('vhs',.25),
  F('ghost',.16),
  NZ(.16),
  SC(.12)
]);

PX.addEffect('broken-vhs', 'Broken VHS', [
  F('vhs',.35),
  F('glitch',.3),
  F('rgb',.2),
  SC(.18)
]);

PX.addEffect('cyber-dream', 'Cyber Dream', [
  CM({c:.08,s:.18,b:.01}),
  BL(.22),
  F('rgb',.2),
  G(['rgba(0,220,255,.2)','rgba(220,0,255,.2)'],'screen',.6,90)
]);

PX.addEffect('digital-dream', 'Digital Dream', [
  CM({c:.02,s:.1,b:.03}),
  BL(.2),
  F('rgb',.12),
  NZ(.08)
]);

PX.addEffect('neon-dust', 'Neon Dust', [
  CM({c:.12,s:.2}),
  F('dust',.22),
  BL(.16),
  F('rgb',.15)
]);

PX.addEffect('electric-dust', 'Electric Dust', [
  CM({c:.16,s:.22,b:-.02}),
  F('dust',.25),
  F('rgb',.2),
  BL(.12)
]);

PX.addEffect('star-glow', 'Star Glow', [
  CM({s:.12}),
  ST(35,2,['#ffffff','#bde7ff','#ffd6f5'],7),
  BL(.12)
]);

PX.addEffect('night-stars', 'Night Stars', [
  CM({c:.12,b:-.06}),
  ST(45,2,['#ffffff','#9fd8ff'],12),
  VG(.12)
]);

PX.addEffect('sparkle', 'Sparkle', [
  CM({s:.1,b:.02}),
  ST(25,2,['#ffffff','#ffe8a8'],4),
  BL(.12)
]);

PX.addEffect('neon-stars', 'Neon Stars', [
  CM({s:.18,c:.08}),
  ST(30,2,['#00ffff','#ff00ff','#ffffff'],8),
  BL(.1)
]);

PX.addEffect('dream-stars', 'Dream Stars', [
  CM({c:-.03,s:.08,b:.03}),
  BL(.18),
  ST(28,2,['#ffffff','#ffd6f5','#c8e8ff'],3)
]);

PX.addEffect('vintage-stars', 'Vintage Stars', [
  CM({c:.06,s:.06,b:-.02}),
  NZ(.08),
  ST(20,2,['#fff0c0','#ffffff'],9)
]);

PX.addEffect('final-glow', 'Final Glow', [
  CM({c:.04,s:.1,b:.02}),
  BL(.25),
  NZ(.08),
  VG(.06)
]);
