// Second foliage atlas (1024×512), painted once at start-up like props/foliage.js (no image files): meadow grass, straw,
// weathered wood, wild flowers and the small leaves of their rosettes. Kept apart from the first atlas, which other
// tools read at its fixed 1024×1024 size. Props that use it set material: 'cards2' and map their parts with ATLAS2.uvr.
(() => {
'use strict';
const { rng, clamp } = TDGeo;
const W = 1024, H = 512, PAD = 3;
// [x, y, w, h] in canvas pixels (y down)
const RECT = {
  meadow: [0, 0, 512, 256], straw: [512, 0, 256, 256], wood: [768, 0, 256, 256],
  flower0: [0, 256, 128, 128], flower1: [128, 256, 128, 128], flower2: [256, 256, 128, 128], flower3: [384, 256, 128, 128],
  rosette: [512, 256, 256, 128], white: [768, 256, 64, 64], clay: [832, 256, 128, 128],
};
function paint() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), R = rng(20261021);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const blade = (x, y, top, bend, wd, fill) => {
    g.fillStyle = fill; g.beginPath(); g.moveTo(x - wd, y);
    g.quadraticCurveTo(x + bend * .35, (top + y) / 2, x + bend, top); g.quadraticCurveTo(x + bend * .35 + wd * .6, (top + y) / 2, x + wd, y); g.fill();
  };
  // meadow grass: a dense tuft, darker and denser at the foot, a few dry blades and seed heads on top
  {
    const [x0, y0, w, h] = RECT.meadow, foot = y0 + h;
    for (let k = 0; k < 260; k++) {
      const t = k / 260, x = x0 + w * (.06 + R() * .88), top = y0 + h * (.05 + R() * .55 + (1 - t) * .25), bend = (x - (x0 + w / 2)) * (.25 + R() * .4) + (R() - .5) * 40;
      const dry = R() < .12, l = dry ? 52 + R() * 16 : 20 + t * 28 + R() * 12;
      blade(x, foot, top, bend, 2.2 + R() * 2.4, dry ? hsl(48, 38, l) : hsl(88 + (R() - .5) * 22, 34 + R() * 14, l));
    }
    for (let k = 0; k < 14; k++) {   // seed heads on thin stalks
      const x = x0 + w * (.15 + R() * .7), top = y0 + h * (.02 + R() * .2), bend = (R() - .5) * 60;
      g.strokeStyle = hsl(60, 25, 45); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, foot); g.quadraticCurveTo(x + bend * .3, (top + foot) / 2, x + bend, top); g.stroke();
      for (let s = 0; s < 9; s++) { g.fillStyle = hsl(45, 35, 55 + R() * 15); g.beginPath(); g.ellipse(x + bend + (R() - .5) * 6, top + s * 4, 2.2, 4, (R() - .5), 0, 6.283); g.fill(); }
    }
  }
  // straw (opaque): long golden stalks in every direction, darker underneath
  {
    const [x0, y0, w, h] = RECT.straw;
    g.fillStyle = hsl(40, 45, 50); g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 900; k++) {
      const x = x0 + R() * w, y = y0 + R() * h, a = -1.2 + R() * .8 + (R() < .3 ? R() * 3 : 0), L = 20 + R() * 50;
      g.strokeStyle = hsl(42 + (R() - .5) * 12, 52 + R() * 15, 48 + R() * 30); g.lineWidth = 1 + R() * 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
  }
  // weathered wood (opaque): grain along the texture's v, a knot or two, grey where the sun has bleached it
  {
    const [x0, y0, w, h] = RECT.wood;
    g.fillStyle = hsl(30, 20, 56); g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 140; k++) {
      let x = x0 + R() * w; const l = 38 + R() * 28, wd = .8 + R() * 2.6; g.strokeStyle = hsl(28, 18 + R() * 10, l, .8); g.lineWidth = wd;
      g.beginPath(); g.moveTo(x, y0); for (let y = y0; y <= y0 + h; y += 8) { x += (R() - .5) * 1.6; g.lineTo(x, y); } g.stroke();
    }
    for (let k = 0; k < 3; k++) { const cx = x0 + 30 + R() * (w - 60), cy = y0 + 30 + R() * (h - 60); for (let r = 14; r > 2; r -= 3) { g.strokeStyle = hsl(25, 30, 22 + r); g.lineWidth = 1.6; g.beginPath(); g.ellipse(cx, cy, r * .55, r * 1.3, 0, 0, 6.283); g.stroke(); } }
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, hsl(0, 0, 70, .18)); gr.addColorStop(.5, hsl(0, 0, 70, 0)); gr.addColorStop(1, hsl(0, 0, 70, .22));
    g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  }
  // wild flowers, one per cell: daisy, buttercup, pink cosmos, purple bellflower cluster (seen from above, slightly tilted)
  const petals = ([x0, y0, w, h], n, len, wid, fill, line, centre, cr) => {
    const cx = x0 + w / 2, cy = y0 + h / 2;
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.283 + (R() - .5) * .15;
      g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -wid, len, 0); g.quadraticCurveTo(len * .5, wid, 0, 0);
      const pg = g.createLinearGradient(0, 0, len, 0); pg.addColorStop(0, line); pg.addColorStop(.35, fill); pg.addColorStop(1, fill); g.fillStyle = pg; g.fill(); g.restore();
    }
    const cg = g.createRadialGradient(cx - cr * .3, cy - cr * .3, 1, cx, cy, cr); cg.addColorStop(0, centre[0]); cg.addColorStop(1, centre[1]);
    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, cr, 0, 6.283); g.fill();
  };
  petals(RECT.flower0, 18, 56, 7, hsl(50, 30, 96), hsl(50, 20, 80), [hsl(48, 95, 62), hsl(38, 90, 40)], 13);
  petals(RECT.flower1, 5, 50, 22, hsl(52, 95, 56), hsl(45, 90, 42), [hsl(48, 80, 50), hsl(35, 80, 30)], 9);
  petals(RECT.flower2, 8, 54, 15, hsl(330, 70, 74), hsl(330, 60, 58), [hsl(48, 90, 60), hsl(30, 80, 35)], 9);
  {   // bellflower cluster: several small cups
    const [x0, y0, w, h] = RECT.flower3;
    for (let k = 0; k < 7; k++) {
      const cx = x0 + w / 2 + (R() - .5) * w * .5, cy = y0 + h / 2 + (R() - .5) * h * .5, r = 14 + R() * 8;
      for (let q = 0; q < 5; q++) { const a = q / 5 * 6.283; g.fillStyle = hsl(268, 55, 58 + R() * 12); g.beginPath(); g.ellipse(cx + Math.cos(a) * r * .45, cy + Math.sin(a) * r * .45, r * .55, r * .4, a, 0, 6.283); g.fill(); }
      g.fillStyle = hsl(270, 45, 34); g.beginPath(); g.arc(cx, cy, r * .28, 0, 6.283); g.fill();
    }
  }
  // rosette leaves for the foot of a flower clump: lance-shaped leaves radiating from the centre
  {
    const [x0, y0, w, h] = RECT.rosette, cx = x0 + w / 2, cy = y0 + h * .9;
    for (let k = 0; k < 22; k++) {
      const a = -Math.PI + .2 + R() * (Math.PI - .4), len = h * (.55 + R() * .4), wid = 7 + R() * 7, l = 26 + R() * 22;
      g.save(); g.translate(cx, cy); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -wid, len, 0); g.quadraticCurveTo(len * .5, wid, 0, 0);
      g.fillStyle = hsl(100 + (R() - .5) * 20, 40, l); g.fill(); g.strokeStyle = hsl(95, 30, l + 14, .6); g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(len * .9, 0); g.stroke(); g.restore();
    }
  }
  // Unglazed fired clay occupies previously unused texels. Existing regions are unchanged.
  {
    const [x0,y0,w,h]=RECT.clay,im=g.createImageData(w,h),hash=TDGeo.hash2;
    const noise=(x,y)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),t=v*v*(3-2*v);return (1-s)*(1-t)*hash(a+271,b+197)+s*(1-t)*hash(a+272,b+197)+(1-s)*t*hash(a+271,b+198)+s*t*hash(a+272,b+198);};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=noise(x/27,y/23),grain=hash(x+931,y+74),turn=Math.sin(y*.32+noise(x/49,y/39)*2),v=Math.round(237+(n-.5)*24+(grain-.5)*10+turn*1.5-(grain<.018?14:0));im.data[i]=v;im.data[i+1]=v-2;im.data[i+2]=v-4;im.data[i+3]=255;}g.putImageData(im,x0,y0);
  }
  g.fillStyle = '#fff'; g.fillRect(...RECT.white);
  const d = g.getImageData(0, 0, W, H).data;
  for (const [x0, y0, w, h] of Object.values(RECT)) {   // fill empty texels with the region's average colour (no dark fringes)
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * W + x) * 4; if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    if (!n) continue; r /= n; gg /= n; b /= n;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * W + x) * 4; if (d[i + 3] < 8) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 0; } }
  }
  return new Uint8Array(d.buffer);
}
// uv rectangle [u0, v0, u1, v1] (texture rows are canvas rows: row 0 = top = v 0, flipY off)
const uvr = name => { const [x, y, w, h] = RECT[name]; return [(x + PAD) / W, (y + h - PAD) / H, (x + w - PAD) / W, (y + PAD) / H]; };
const white = (() => { const [x, y, w, h] = RECT.white; return [(x + w / 2) / W, (y + h / 2) / H]; })();
TDGeo.ATLAS2 = { width: W, height: H, paint, uvr, white, rect: RECT };
})();
