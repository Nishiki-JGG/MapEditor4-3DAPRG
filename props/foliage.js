// Foliage atlas and card helpers for the semi-real plants (loaded after common.js, before the prop files).
// The atlas is painted once on a canvas at start-up (no image files): leaf clusters, pine needles, palm / fern / banana
// leaves and bark. Plants draw their leaves as alpha-tested cards that sample it (the usual way mobile games draw
// foliage: few triangles, the leaf outlines come from the texture). One texture, one draw per prop type.
(() => {
'use strict';
const { rng, clamp, lerp } = TDGeo;
const S = 1024, PAD = 3;
// [x, y, w, h] in canvas pixels (y down)
const RECT = {
  leaf: [0, 0, 512, 512], needle: [512, 0, 512, 512],
  palm: [0, 512, 1024, 128], fern: [0, 640, 512, 128], banana: [512, 640, 512, 128],
  bark: [0, 768, 256, 256], white: [256, 768, 64, 64], leafDry: [512, 768, 256, 256], grass: [768, 768, 256, 256],
};

function paint() {
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(20261020);
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const leafShape = (x, y, len, wid, ang, fill, rib) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .45, -wid, len, 0); g.quadraticCurveTo(len * .45, wid, 0, 0); g.fillStyle = fill; g.fill();
    if (rib) { g.strokeStyle = rib; g.lineWidth = Math.max(.6, wid * .12); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * .9, 0); g.stroke(); }
    g.restore();
  };
  // broadleaf cluster: twigs from the bottom, ~280 leaves in a rounded mass, darker inside, lighter toward the rim
  const cluster = ([x0, y0, w, h], hue, lit, n, dry) => {
    const cx = x0 + w / 2, cy = y0 + h * .47, rx = w * .43, ry = h * .41;
    g.strokeStyle = hsl(28, 30, dry ? 30 : 24); g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      let x = cx + (R() - .5) * w * .1, y = y0 + h * .98, a = -Math.PI / 2 + (R() - .5) * 1.3, wd = 5;
      for (let s = 0; s < 6; s++) { const L = h * .09; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineTo(x, y); g.stroke(); a += (R() - .5) * .7; wd *= .78; }
    }
    const L = [];
    for (let k = 0; k < n * 4 && L.length < n; k++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R());
      if (R() > 1.15 - r * r * .6) continue;                                   // fewer leaves in the middle of the card, more at the rim
      L.push([cx + Math.cos(a) * r * rx, cy + Math.sin(a) * r * ry, r, a]);
    }
    L.sort((p, q) => p[2] - q[2]);
    for (const [x, y, r, a] of L) {
      const len = w * (.045 + R() * .03), ang = a + (R() - .5) * 1.6, l = lit[0] + (lit[1] - lit[0]) * clamp(r * .8 + R() * .35, 0, 1);
      leafShape(x, y, len, len * (.36 + R() * .1), ang, hsl(hue + (R() - .5) * 16, 38 + R() * 18, l), hsl(hue, 30, l + 10, .7));
    }
  };
  cluster(RECT.leaf, 96, [34, 72], 300);
  cluster(RECT.leafDry, 70, [34, 66], 160, true);
  // pine spray: a twig along +x with side twigs, needles combed forward
  {
    const [x0, y0, w, h] = RECT.needle, cy = y0 + h / 2;
    const twig = (xa, ya, a, len, wd, depth) => {
      let x = xa, y = ya; const pts = [];
      for (let s = 0; s < 16; s++) { const xn = x + Math.cos(a) * len / 16, yn = y + Math.sin(a) * len / 16; g.strokeStyle = hsl(25, 30, 26); g.lineWidth = wd * (1 - s / 19); g.beginPath(); g.moveTo(x, y); g.lineTo(xn, yn); g.stroke(); x = xn; y = yn; pts.push([x, y, a]); a += (R() - .5) * .12; }
      for (const [px, py, pa] of pts) for (let k = 0; k < 10; k++) {
        const side = k % 2 ? 1 : -1, na = pa + side * (.5 + R() * .6), nl = (30 + R() * 22) * (depth ? 1 : .8);
        g.strokeStyle = hsl(140 + (R() - .5) * 16, 20 + R() * 12, 24 + R() * 22); g.lineWidth = 3;
        g.beginPath(); g.moveTo(px - Math.cos(pa) * k * 3, py - Math.sin(pa) * k * 3); g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); g.stroke();
      }
      if (depth) for (let k = 1; k < 7; k++) { const t = k / 7, p = pts[Math.floor(t * 15)]; twig(p[0], p[1], p[2] + (k % 2 ? .75 : -.75), len * (.42 - t * .2), wd * .6, depth - 1); }
    };
    twig(x0 + 14, cy, 0, w * .9, 7, 1);
  }
  // pinnate leaves along +x: palm frond and fern frond
  const pinnate = ([x0, y0, w, h], hue, lit, n, lobed) => {
    const cy = y0 + h / 2;
    g.strokeStyle = hsl(hue - 20, 35, 40); g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 4, cy); g.lineTo(x0 + w - 6, cy); g.stroke();
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, x = x0 + 8 + t * (w - 20), len = h * .47 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + .05)), .7);
      for (const sd of [-1, 1]) {
        const a = sd * (1.05 + (R() - .5) * .2) - .55 * sd * 0, ang = -sd * 0 + (sd < 0 ? -Math.PI / 2 + .55 : Math.PI / 2 - .55), l = lit[0] + R() * (lit[1] - lit[0]);
        if (lobed) { for (let q = 0; q < 6; q++) { const f = q / 6, px = x + Math.cos(ang) * len * f, py = cy + Math.sin(ang) * len * f, sz = (1 - f * .7) * h * .06; leafShape(px, py, sz * 1.6, sz * .8, ang - 1.2, hsl(hue, 42, l), null); leafShape(px, py, sz * 1.6, sz * .8, ang + 1.2, hsl(hue, 42, l - 4), null); } }
        else leafShape(x, cy, len, Math.max(3.5, w / n * .8), ang, hsl(hue + (R() - .5) * 10, 40 + R() * 10, l), hsl(hue, 25, l + 12, .6));
      }
    }
  };
  pinnate(RECT.palm, 88, [36, 58], 64, false);
  pinnate(RECT.fern, 100, [32, 54], 22, true);
  // banana leaf: broad blade, pale midrib, parallel veins, a few tears
  {
    const [x0, y0, w, h] = RECT.banana, cy = y0 + h / 2, hw = t => h * .47 * Math.pow(Math.sin(Math.PI * clamp(t * .96 + .04, 0, 1)), .55);
    g.beginPath(); g.moveTo(x0 + 2, cy);
    for (let i = 0; i <= 40; i++) { const t = i / 40; g.lineTo(x0 + 2 + t * (w - 6), cy - hw(t)); }
    for (let i = 40; i >= 0; i--) { const t = i / 40; g.lineTo(x0 + 2 + t * (w - 6), cy + hw(t)); }
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, hsl(96, 48, 44)); gr.addColorStop(.5, hsl(92, 50, 56)); gr.addColorStop(1, hsl(98, 46, 40));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = hsl(90, 30, 66, .45); g.lineWidth = 1.2;
    for (let i = 2; i < 60; i++) { const t = i / 60, x = x0 + 2 + t * (w - 6); for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x, cy); g.lineTo(x + h * .18, cy + sd * hw(t) * .97); g.stroke(); } }
    g.strokeStyle = hsl(70, 40, 78); g.lineWidth = 4; g.beginPath(); g.moveTo(x0 + 2, cy); g.lineTo(x0 + w - 8, cy); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.lineWidth = 2.5;
    for (let k = 0; k < 9; k++) { const t = .15 + R() * .75, x = x0 + 2 + t * (w - 6), sd = R() < .5 ? -1 : 1; g.beginPath(); g.moveTo(x + h * .2, cy + sd * hw(t)); g.lineTo(x + 2, cy + sd * 6); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
  }
  // bark: furrowed vertical strips (opaque)
  {
    const [x0, y0, w, h] = RECT.bark;
    g.fillStyle = hsl(28, 14, 58); g.fillRect(x0, y0, w, h);
    for (let k = 0; k < 70; k++) {
      let x = x0 + R() * w; const wd = 2 + R() * 6, l = 32 + R() * 36; g.strokeStyle = hsl(26, 14, l); g.lineWidth = wd;
      g.beginPath(); g.moveTo(x, y0);
      for (let y = y0; y <= y0 + h; y += 16) { x += (R() - .5) * 5; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 500; k++) { g.fillStyle = hsl(30, 10, 20 + R() * 50, .5); g.fillRect(x0 + R() * w, y0 + R() * h, 2, 1 + R() * 4); }
  }
  // grass tuft: blades from the bottom edge
  {
    const [x0, y0, w, h] = RECT.grass;
    for (let k = 0; k < 90; k++) {
      const x = x0 + w * (.12 + R() * .76), bend = (R() - .5) * w * .35, top = y0 + h * (.08 + R() * .45), l = 30 + R() * 34;
      g.fillStyle = hsl(85 + (R() - .5) * 20, 40, l); g.beginPath(); g.moveTo(x - 3, y0 + h); g.quadraticCurveTo(x + bend * .4, (top + y0 + h) / 2, x + bend, top); g.quadraticCurveTo(x + bend * .4 + 2, (top + y0 + h) / 2, x + 3, y0 + h); g.fill();
    }
  }
  g.fillStyle = '#fff'; g.fillRect(...RECT.white);
  // texels with no leaf take the average leaf colour of their region, so filtering and mipmaps do not darken the outlines
  const img = g.getImageData(0, 0, S, S), d = img.data;
  for (const [x0, y0, w, h] of Object.values(RECT)) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * S + x) * 4; if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    if (!n) continue; r /= n; gg /= n; b /= n;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * S + x) * 4; if (d[i + 3] < 8) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 0; } }
  }
  return new Uint8Array(d.buffer);
}

// atlas uv rectangle [u0, v0, u1, v1] of a region; texture rows are the canvas rows (row 0 = top = v 0, flipY off)
const uvr = name => { const [x, y, w, h] = RECT[name]; return [(x + PAD) / S, (y + h - PAD) / S, (x + w - PAD) / S, (y + PAD) / S]; };
const white = (() => { const [x, y, w, h] = RECT.white; return [(x + w / 2) / S, (y + h / 2) / S]; })();

// one card in the XY plane, facing +z, centred (cx, cy = where its centre sits relative to the origin)
function quadGeo(w, h, cy = 0) {
  const g = new THREE.BufferGeometry(), x = w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-x, y0, 0, x, y0, 0, x, y1, 0, -x, y0, 0, x, y1, 0, -x, y1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  return g;
}
// two cards crossed at right angles (a leaf clump that reads from every side)
function crossGeo(w, h, cy = 0) {
  const a = quadGeo(w, h, cy), b = quadGeo(w, h, cy).rotateY(Math.PI / 2), g = new THREE.BufferGeometry();
  for (const k of ['position', 'uv']) g.setAttribute(k, new THREE.Float32BufferAttribute([...a.attributes[k].array, ...b.attributes[k].array], k === 'uv' ? 2 : 3));
  return g;
}
// a long leaf / frond lying along +x, bending down (lift at the base, droop toward the tip), width along z; u along the length
function stripGeo(L, w, segs, lift, droop, taper = .3, fold = 0) {
  const P = [], U = [], pts = []; let x = 0, y = 0;
  for (let s = 0; s <= segs; s++) { const t = s / segs; pts.push([x, y, t]); const a = lift - droop * t * t; x += Math.cos(a) * L / segs; y += Math.sin(a) * L / segs; }
  for (let s = 0; s < segs; s++) {
    const [xa, ya, ta] = pts[s], [xb, yb, tb] = pts[s + 1], wa = w / 2 * (1 - taper * ta), wb = w / 2 * (1 - taper * tb);
    const A = [xa, ya - fold * wa, -wa], B = [xb, yb - fold * wb, -wb], Cm = [xb, yb, 0], Dm = [xa, ya, 0], E = [xb, yb - fold * wb, wb], F = [xa, ya - fold * wa, wa];
    P.push(...A, ...Cm, ...B, ...A, ...Dm, ...Cm, ...Dm, ...E, ...Cm, ...Dm, ...F, ...E);
    U.push(ta, 0, tb, .5, tb, 0, ta, 0, ta, .5, tb, .5, ta, .5, tb, 1, tb, .5, ta, .5, ta, 1, tb, 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
}
// matrix that puts a card at p with its face (+z) toward `out` and its top (+y) toward `up`, rolled by `roll`, scaled by s
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function faceOut(p, out, up = [0, 1, 0], s = 1, roll = 0) {
  _z.set(...out).normalize(); _x.crossVectors(_y.set(...up), _z); if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0); _x.normalize(); _y.crossVectors(_z, _x);
  const m = new THREE.Matrix4().makeBasis(_x.clone().multiplyScalar(s), _y.clone().multiplyScalar(s), _z.clone().multiplyScalar(s));
  if (roll) m.multiply(new THREE.Matrix4().makeRotationZ(roll));
  return m.setPosition(p[0], p[1], p[2]);
}
// a point in a branching tree: grow limbs from `from` toward the canopy; returns the tips (for leaf clumps)
function branches(parts, limbFn, from, dir, len, r, depth, R, opt) {
  const tips = [];
  const grow = (a, d, L, rad, lvl) => {
    const b = [a[0] + d[0] * L, a[1] + d[1] * L, a[2] + d[2] * L];
    limbFn(parts, a, b, rad, rad * opt.taper, lvl === depth ? opt.seg0 : opt.seg, lvl);
    if (lvl === 0) { tips.push(b); return; }
    const n = lvl === depth ? opt.split0 : opt.split;
    for (let k = 0; k < n; k++) {
      const th = R() * 6.283, sp = opt.spread * (.7 + R() * .6);
      const nd = new THREE.Vector3(...d).multiplyScalar(opt.straight).add(new THREE.Vector3(Math.cos(th) * sp, opt.rise + (R() - .5) * .3, Math.sin(th) * sp)).normalize();
      const t = lvl === depth ? 1 : .55 + R() * .45, s = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      grow(s, [nd.x, nd.y, nd.z], L * opt.shrink * (.8 + R() * .4), rad * opt.taper, lvl - 1);
    }
  };
  grow(from, dir, len, r, depth);
  return tips;
}
Object.assign(TDGeo, { ATLAS: { size: S, paint, uvr, white, rect: RECT }, quadGeo, crossGeo, stripGeo, faceOut, branches });
})();
