// Shared building blocks for the prop files in this folder (one file per prop type, see README.md here).
// Loaded before the prop files and app.js. Exposes:
//   TDGeo   - the helpers below (also used by app.js for bridges, stairs, gates and the hero)
//   TDProps - the registry: each prop file calls TDProps.add({ id, name, ..., build() { return geometry } })
(() => {
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const col = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function mat4(px, py, pz, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function displace(g, amp, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.abs(Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453) % 1;
    const s = 1 + (n - .5) * amp; p.setXYZ(i, x * s, y * s, z * s);
  }
  return g;
}
function makeGeo(parts, seed, opt = {}) {
  // opt.ao: height (m) over which the base darkens (fake contact shadow, baked into the vertex colours)
  // part.sn = [x, y, z], part.snw: bend the normals toward "out of this point" (soft foliage shading; only the smooth foliage material uses normals)
  // opt.smooth = degrees: average the normals of faces meeting at a corner when they bend less than this (soft rock, crisp ridges)
  // opt.uv = [u, v]: also write texture coordinates (foliage atlas). Parts with part.uvr = [u0, v0, u1, v1] map their own uv into
  // that rectangle; every other part samples the single texel opt.uv (the atlas' white patch), so it keeps its vertex colour.
  const R = rng(seed), P = [], C = [], G = [], Nn = [], UV = [], ao = opt.ao || 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), q = new THREE.Vector3();
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m);
    const pos = g.attributes.position, pr = R(), sn = p.sn ? new THREE.Vector3(...p.sn) : null, sw = p.snw ?? .75, uv = p.uvr && g.attributes.uv;
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      fn.copy(e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize());
      const ny = fn.y, cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      const lit = sn ? lerp(ny, q.set(cx, cy, cz).sub(sn).normalize().y, sw) : ny;
      const base = p.cfn ? p.cfn(cy, ny, R, pr, cx, cz) : p.c;
      const k = (1 + (R() - .5) * 2 * (p.j ?? .12)) * (.74 + .36 * Math.max(lit, -.4));
      for (const v of [a, b, c]) {
        let kv = k;
        // bent normals: shade each corner by its own normal, so a canopy reads as one soft mass rather than facets
        if (sn) { q.subVectors(v, sn).normalize().lerp(fn, 1 - sw).normalize(); Nn.push(q.x, q.y, q.z); kv = k / (.74 + .36 * Math.max(lit, -.4)) * (.74 + .36 * Math.max(q.y, -.4)); } else Nn.push(fn.x, fn.y, fn.z);
        if (ao && !p.glow) kv *= .62 + .38 * smooth01(clamp(v.y / ao, 0, 1));
        P.push(v.x, v.y, v.z); C.push(base[0] * kv, base[1] * kv, base[2] * kv); G.push(p.glow || 0);
      }
      if (opt.uv) for (let k = 0; k < 3; k++) {
        if (uv) UV.push(lerp(p.uvr[0], p.uvr[2], uv.getX(i + k)), lerp(p.uvr[1], p.uvr[3], uv.getY(i + k))); else UV.push(opt.uv[0], opt.uv[1]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('glow', new THREE.Float32BufferAttribute(G, 1));   // self-lit parts: flames, crystals, glowing caps
  if (opt.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  if (opt.smooth) smoothNormals(P, Nn, Math.cos(opt.smooth * Math.PI / 180));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));   // face normals (the same as computeVertexNormals on this non-indexed geometry), bent where part.sn is set
  return geo;
}
const smooth01 = t => t * t * (3 - 2 * t);
// corners at the same place share the normals of the faces that meet there within the angle (cosine) limit
function smoothNormals(P, Nn, cosLim) {
  const F = Float32Array.from(Nn), groups = new Map(), key = i => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
  for (let i = 0; i < P.length / 3; i++) { const k = key(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  for (const g of groups.values()) for (const i of g) {
    let x = 0, y = 0, z = 0;
    for (const j of g) { const d = F[i * 3] * F[j * 3] + F[i * 3 + 1] * F[j * 3 + 1] + F[i * 3 + 2] * F[j * 3 + 2]; if (d >= cosLim) { x += F[j * 3]; y += F[j * 3 + 1]; z += F[j * 3 + 2]; } }
    const l = Math.hypot(x, y, z) || 1; Nn[i * 3] = x / l; Nn[i * 3 + 1] = y / l; Nn[i * 3 + 2] = z / l;
  }
}
// ---------- building blocks for plants, rocks and walls (all low-poly, vertex-coloured)
// both sides of a list of triangles (thin leaves and petals have no thickness)
function twoSided(tris) {
  const P = [];
  for (const [p, q, r] of tris) P.push(...p, ...q, ...r);
  for (const [p, q, r] of tris) P.push(...p, ...r, ...q);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g;
}
// a leaf along +x from the stem (origin), raised along the midrib, the tip curling down. 8 triangles
function leafGeo(L, w, fold = .22, curl = 0) {
  const B = [0, 0, 0], M = [L * .5, w * fold, 0], T = [L, -curl, 0], l = [L * .38, 0, -w / 2], r = [L * .38, 0, w / 2];
  return twoSided([[B, M, l], [l, M, T], [B, r, M], [M, r, T]]);
}
// a flat diamond (petal, leaflet, ivy leaf). 4 triangles
function petalGeo(L, w, at = .4) {
  const B = [0, 0, 0], T = [L, 0, 0], l = [L * at, 0, -w / 2], r = [L * at, 0, w / 2];
  return twoSided([[B, T, l], [B, r, T]]);
}
// a long leaf (banana, reed, grass blade) along +x, bending down along its length and folded on the midrib
function stripLeafGeo(L, w, segs, lift, droop, fold = .2, shape = .7) {
  const mid = [], tris = []; let x = 0, y = 0;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs, ww = w * Math.pow(Math.sin(Math.PI * Math.min(t * .92 + .08, 1)), shape) / 2;
    mid.push([[x, y + ww * fold * 2, 0], [x, y, -ww], [x, y, ww]]);
    const ang = lift - droop * t * t, len = L / segs; x += Math.cos(ang) * len; y += Math.sin(ang) * len;
  }
  for (let s = 0; s < segs; s++) {
    const [m0, l0, r0] = mid[s], [m1, l1, r1] = mid[s + 1];
    tris.push([m0, m1, l0], [l0, m1, l1], [m0, r0, m1], [m1, r0, r1]);
  }
  return twoSided(tris);
}
// matrix that maps local +x to dir, local +y toward up (the face of a leaf), placed at p and scaled by s
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3();
function basisAt(p, dir, up = [0, 1, 0], s = 1) {
  _bx.set(...dir).normalize(); _bz.crossVectors(_bx, _by.set(...up)).normalize();
  if (_bz.lengthSq() < 1e-6) _bz.set(0, 0, 1);
  _by.crossVectors(_bz, _bx);
  return new THREE.Matrix4().makeBasis(_bx.clone().multiplyScalar(s), _by.clone().multiplyScalar(s), _bz.clone().multiplyScalar(s)).setPosition(p[0], p[1], p[2]);
}
// a tapered branch / stem from a to b (open ends: they sit inside the trunk, ground or foliage)
function limb(parts, a, b, r0, r1, seg, cfn, more = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d);
  _by.set(...d).normalize(); _bx.set(1, 0, 0); if (Math.abs(_by.x) > .9) _bx.set(0, 0, 1);
  _bz.crossVectors(_bx, _by).normalize(); _bx.crossVectors(_by, _bz);
  const m = new THREE.Matrix4().makeBasis(_bx.clone(), _by.clone(), _bz.clone()).setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  parts.push({ g: new THREE.CylinderGeometry(r1, r0, L, seg, 1, true), m, cfn, j: .1, ...more });
}
// flatten a rock-like shape with a few random cutting planes: sharp facets and edges instead of a soft blob
function chisel(g, cuts, seed, depth = .62, upBias = 0) {
  const R = rng(seed), p = g.attributes.position, planes = [];
  let rad = 0; for (let i = 0; i < p.count; i++) rad = Math.max(rad, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  for (let k = 0; k < cuts; k++) {
    const th = R() * 6.283, y = clamp(R() * 2 - 1 + upBias, -1, 1), s = Math.sqrt(1 - y * y);
    planes.push([Math.cos(th) * s, y, Math.sin(th) * s, (depth + R() * (1 - depth) * .7) * rad]);
  }
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    for (const [nx, ny, nz, d] of planes) { const o = x * nx + y * ny + z * nz - d; if (o > 0) { x -= nx * o; y -= ny * o; z -= nz * o; } }
    p.setXYZ(i, x, y, z);
  }
  return g;
}
// ribbed (cactus, fluted column): every other ring vertex pulled in toward the axis
function ribbed(g, n, inner) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue;
    const k = Math.round(((Math.atan2(z, x) / 6.2832 + 1) % 1) * n) % 2 ? inner : 1;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  return g;
}
// rock strata: each horizontal ring of vertices pushed in or out by its own amount, giving ledges (same height -> same amount, no cracks)
function strata(g, amp, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + amp * (hash2(Math.round(p.getY(i) * 100), seed) - .5) * 2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  return g;
}
// masonry tone for round towers: one colour per block of a running bond (rows of rowH, n blocks around)
const masonC = (lo, hi, rowH, n) => (y, ny, R, pr, cx, cz) => {
  if (Math.abs(ny) > .7) return mixc(col(lo), col(hi), .55 + R() * .2);
  const row = Math.floor(y / rowH), a = (Math.atan2(cz, cx) / 6.2832 + 1) * n + (row % 2) * .5;
  return mixc(col(lo), col(hi), .15 + .7 * hash2(row, Math.floor(a) % n + 7));
};
// drop the bottom cap of a shape that stands in the ground (never seen; saves triangles)
function dropBottom(g) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, P = [];
  let lo = Infinity; for (let i = 0; i < p.count; i++) lo = Math.min(lo, p.getY(i));
  for (let i = 0; i < p.count; i += 3) { if (p.getY(i) < lo + 1e-4 && p.getY(i + 1) < lo + 1e-4 && p.getY(i + 2) < lo + 1e-4) continue; for (let k = 0; k < 3; k++) P.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return o;
}
function tierGeo(r, h, seg, seed) {
  // cone whose rim droops and zig-zags like a fir branch layer
  const g = new THREE.ConeGeometry(r, h, seg, 2, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), rim = y < -h * .49;
    if (rim) {
      const k = Math.round((a / (Math.PI * 2)) * seg * 2 + seg * 2) % 2 === 0;
      const f = k ? 1.12 : .78, n = Math.abs(Math.sin(a * 7.3 + seed) * 43758.55) % 1;
      p.setXYZ(i, x * f * (.95 + n * .12), y - (k ? .22 : -.08), z * f * (.95 + n * .12));
    } else if (y < h * .49) { p.setXYZ(i, x * 1.08, y - .05, z * 1.08); }
  }
  return g;
}
// ---------- ruins
const RUIN_STONE = (y, ny, R, pr) => mixc(col(0x8d877c), col(0xd2cab8), clamp(pr * .5 + R() * .3 + (ny > .7 ? .15 : 0), 0, 1));
const MOSS = (y, ny, R) => mixc(col(0x4d6e2a), col(0x7a9a46), R());
function halfDisc(r, d) { return new THREE.CylinderGeometry(r, r, d, 10, 1, false, Math.PI / 2, Math.PI); }   // rounded top, use with rx = PI/2
// ---------- shared colours for the biome parts
const WOOD_C = (y, ny, R) => mixc(col(0x5a3d22), col(0x8e6740), R());
const SANDSTONE = (y, ny, R, pr) => mixc(col(0xb08a58), col(0xe2c58e), clamp(pr * .5 + R() * .35 + (ny > .7 ? .12 : 0), 0, 1));
const CASTLE_C = (y, ny, R, pr) => mixc(col(0x6a6863), col(0xa5a29a), clamp(pr * .5 + R() * .35 + (ny > .7 ? .1 : 0), 0, 1));
const ICE_C = (y, ny, R) => mixc(col(0x8fd0ea), col(0xdff6ff), R() * .7 + (ny > .6 ? .3 : 0));
const BONE_C = (y, ny, R) => mixc(col(0xc9bfa5), col(0xeee6d0), R());
const DARK_C = (y, ny, R) => mixc(col(0x1d1820), col(0x3a2e40), R());
// ---------- walls: stone blocks over a darker mortar core, so the joints read
const blockC = (lo, hi) => (y, ny, R, pr) => mixc(col(lo), col(hi), clamp(pr * .55 + R() * .2 + (ny > .7 ? .15 : 0) - (ny < -.3 ? .2 : 0), 0, 1));
function stoneCourses(parts, x0, x1, y0, rows, rowH, depth, R, cfn, opt = {}) {
  for (let row = 0; row < rows; row++) {
    let x = x0 - (row % 2) * .3, lo = 1e9, hi = -1e9; const y = y0 + row * rowH + rowH / 2;
    while (x < x1 - .05) {
      const w0 = .55 + R() * .35, xa = Math.max(x, x0), xb = Math.min(x + w0, x1), w = xb - xa;
      if (w > .08 && (!opt.keep || opt.keep(xa + w / 2, y))) {
        parts.push({ g: displace(new THREE.BoxGeometry(w - .045, rowH - .045, depth + (R() - .5) * .04), .07, xa * 9 + row), m: mat4((xa + xb) / 2, y, (R() - .5) * .03, 1, 1, 1, (R() - .5) * .02), cfn, j: .07 });
        lo = Math.min(lo, xa); hi = Math.max(hi, xb);
      }
      x += w0;
    }
    // dark mortar behind each course, only as long as the stones of that course (a broken top shows no core)
    if (opt.core && hi > lo) parts.push({ g: new THREE.BoxGeometry(hi - lo - .02, rowH - .01, depth * .88), m: mat4((lo + hi) / 2, y, 0, 1, 1, 1), c: col(opt.core), j: .04 });
  }
}

window.TDGeo = { clamp, lerp, hash2, rng, col, mixc, mat4, displace, makeGeo, smooth01, twoSided, leafGeo, petalGeo, stripLeafGeo, basisAt, limb, chisel, ribbed, strata, masonC, dropBottom, tierGeo, RUIN_STONE, MOSS, halfDisc, WOOD_C, SANDSTONE, CASTLE_C, ICE_C, BONE_C, DARK_C, blockC, stoneCourses };

// ---- prop registry. The order the files are loaded in (index.html) is the type order; saved maps also store the type ids
// (propTypes), and loading maps them back by id, so reordering or adding files keeps old maps intact.
const defs = [];
window.TDProps = {
  add(def) {
    if (!def || typeof def.id !== 'string' || typeof def.build !== 'function') throw new Error('TDProps.add: id and build() are required');
    if (defs.some(d => d.id === def.id)) throw new Error('TDProps.add: duplicate id ' + def.id);
    defs.push(def);
  },
  ids() { return defs.map(d => d.id); },
  // the PROP table of app.js: every field of the file, plus geo = build(); tags default to every biome ('common')
  build() { return defs.map(({ build, ...t }) => ({ ...t, geo: build(), tags: t.tags || ['common'] })); },
};
})();
