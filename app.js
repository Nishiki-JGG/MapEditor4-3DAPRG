(() => {
'use strict';

// ============================================================
// Map data
// ============================================================
const MAP_SIZES = [24, 32, 48, 64, 96, 128];
const SIZE = (() => { const m = /size=(\d+)/.exec(location.hash), v = m ? +m[1] : 64; return MAP_SIZES.includes(v) ? v : 64; })(), RES = 2, N = SIZE * RES + 1, CELL = 1 / RES, HALF = SIZE / 2;
const STEP = 2.2;          // plateau tool step height (m)
const SKIRT_Y = -14;       // bottom of the map's outer wall
const H = new Float32Array(N * N);       // heights (m)
const NS = 9;                            // splat channels
const S = new Uint8Array(N * N * NS);    // splat: [dirt, cobble, sand, rubble, swamp, poison] 0..255
const GROUND = ['dirt', 'cobble', 'sand', 'rubble', 'swamp', 'poison', 'lava', 'snowfield', 'ice'];
const GROUND_SPEED = [1, 1, .85, .8, .55, .6, .5, .8, 1];   // walk speed factor per ground type
const O = new Uint8Array(N * N);         // walk override: 0 = auto, 1 = force walkable, 2 = force blocked, 3 = secret passage
const F = new Float32Array(N * N);
const C = new Uint8Array(N * N);         // rock-wall style painted per vertex: 0 = the map's default, k = CLIFF_STYLES[k - 1]       // floor height used inside secret passages (H elsewhere)
const A = new Uint8Array(N * N);         // auto walkability cache (1 = walkable)
let props = [];                           // [type, x, z, rotY, scale, auto, scaleY?, baseY?]
let falls = [];                           // {x, z, rot, w, top, bottom, sx?, sz?}  sx/sz = upstream source
let bridges = [];                         // {x1, z1, x2, z2, w, type}
let stairs = [];
let markers = [];                         // game markers: {id, kind, x, z, rot, w, r, tag}                          // {x1, z1, x2, z2, w, type, y1, y2}  (x1,z1) is the bottom
const state = {
  roomId: '', nextId: 1, revision: 0, lastExportHash: '', catalog: { types: {}, floorLinks: {} },
  agent: { radius: .3, height: 1.8, maxSlopeDeg: 51.3, maxWaterDepth: .9, maxStep: .5, arrivalClearance: .5 },   // who the walkability is computed for
  biome: 'forest', palette: 'all', cliffStyle: 'standard', sunOn: true, sea: false, weather: { kind: 'none', amount: .7 }, atmo: { kind: 'none', amount: .6, height: 3 },
  variant: { bridge: 'wood', stairs: 'stone', place: 0, marker: 'port', link: 'warp', cliffpaint: 1 }, placeScale: 1, placeRot: 0, placeRandom: true,
  mode: 'edit', tool: 'plateau', radius: 4, strength: .6, density: .6,
  types: new Set([0, 1]), water: .8, spawn: { x: 0, z: 22 },
};

// ============================================================
// Utilities
// ============================================================
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { return vnoise(x, y) * .6 + vnoise(x * 2.07 + 5.2, y * 2.07 + 1.3) * .28 + vnoise(x * 4.1 + 9, y * 4.1 + 3) * .12; }
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const idx = (i, j) => j * N + i;
const vx = i => i * CELL - HALF;
function heightAt(x, z) {
  const fx = (x + HALF) * RES, fz = (z + HALF) * RES;
  const i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fz), 0, N - 2);
  const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), k = idx(i, j);
  return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + N], H[k + N + 1], u), v);
}
function slopeAt(x, z) { const e = .35; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
function splatAt(x, z, ch) { const i = clamp(Math.round((x + HALF) * RES), 0, N - 1), j = clamp(Math.round((z + HALF) * RES), 0, N - 1); return S[idx(i, j) * NS + ch] / 255; }
function distToPolyline(x, z, pts) {
  let best = 1e9;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
class SpatialHash {
  constructor(cs) { this.cs = cs; this.m = new Map(); }
  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }
  add(item, x, z) { const k = this.key(Math.floor(x / this.cs), Math.floor(z / this.cs)); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(item); }
  query(x, z, r, cb) {
    const c0 = Math.floor((x - r) / this.cs), c1 = Math.floor((x + r) / this.cs), d0 = Math.floor((z - r) / this.cs), d1 = Math.floor((z + r) / this.cs);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) { const a = this.m.get(this.key(cx, cz)); if (a) for (const it of a) cb(it); }
  }
}

// ============================================================
// Renderer / scene
// ============================================================
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e12);
scene.fog = new THREE.Fog(0x0b0e12, 140, 280);
const camera = new THREE.PerspectiveCamera(38, 1, .5, 600);

const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x6a5a3e, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
sun.position.set(-48, 62, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -(SIZE / 2 + 16), right: SIZE / 2 + 16, top: SIZE / 2 + 16, bottom: -(SIZE / 2 + 16), near: 1, far: 220 + SIZE });
const FOG_K = Math.max(1, SIZE / 64);   // keep distance fog off the far side of big maps
sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
scene.add(sun, sun.target);

// ---------- shared GLSL ----------
const GLSL_NOISE = `
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
vec3 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8., id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 c=i+g;
    vec2 o=vec2(h21(c),h21(c+37.7)); float d=length(g+o-f);
    if(d<d1){ d2=d1; d1=d; id=h21(c+11.3); } else if(d<d2){ d2=d; } }
  return vec3(d1,d2,id); }
`;

// ---------- terrain ----------
const waterU = { value: state.water };
const dimU = { value: 0 };   // fades the scene while the walkability view is on
const DIM_GLSL = 'vec3 dimc(vec3 c){ float l=dot(c,vec3(.3,.59,.11)); return mix(c,vec3(l),.6*uDim)*(1.-.3*uDim); }';
const timeU = { value: 0 };
// ---------- biomes: the map's base biome sets the atmosphere; parts carry biome tags for the palette filter
// g = ground colours [low, high, highlight], water = [shallow, deep], flora = what the sample generator plants
const BIOMES = [
  { id: 'grassland', name: '草原', bg: 0x10161a, sky: 0xdcecff, ground: 0x6a5a3e, hemi: 1.1, sun: 0xfff0c8, sunI: 2.8, exp: 1.3,
    g: [[.20, .34, .08], [.55, .70, .22], [.78, .78, .34]], water: [[.36, .86, .80], [.03, .33, .46]],
    flora: { rim: [['oak', 2], ['pine', 1]], inner: [['oak', 1], ['bush', 2]], small: 'flowers', density: .7 } },
  { id: 'forest', name: '森林', bg: 0x0b0e12, sky: 0xd6e8ff, ground: 0x6a5a3e, hemi: 1.05, sun: 0xffe0b0, sunI: 2.6, exp: 1.3,
    g: [[.16, .28, .07], [.46, .60, .17], [.66, .68, .28]], water: [[.36, .86, .80], [.03, .33, .46]],
    flora: { rim: [['pine', 3], ['oak', 1]], inner: [['pine', 1], ['oak', 1.2], ['bush', 1]], small: 'bush', density: 1 } },
  { id: 'jungle', name: '密林', bg: 0x08100a, sky: 0xc8f0d8, ground: 0x4a5a2e, hemi: 1.0, sun: 0xfff2b0, sunI: 2.3, exp: 1.25,
    g: [[.08, .24, .06], [.30, .58, .12], [.50, .66, .18]], water: [[.30, .70, .50], [.04, .26, .22]], prop: [.9, 1.05, .9],
    flora: { rim: [['oak', 3], ['bush', 1]], inner: [['oak', 2], ['bush', 2], ['log', .3]], small: 'bush', density: 1.4 } },
  { id: 'canyon', moss: [.62, .47, .30], name: '渓谷', bg: 0x140e0a, sky: 0xffe2c4, ground: 0x7a4a2e, hemi: 1.0, sun: 0xffd0a0, sunI: 2.8, exp: 1.3,
    g: [[.36, .34, .12], [.62, .56, .26], [.80, .66, .38]], water: [[.36, .86, .80], [.03, .33, .46]], rock: [1.15, .9, .72], prop: [1.05, .98, .85],
    flora: { rim: [['pine', 2], ['bush', 1]], inner: [['bush', 2], ['rock', 1]], small: 'pebble', density: .6 } },
  { id: 'wasteland', moss: [.56, .49, .33], name: '荒野', bg: 0x14110c, sky: 0xefe0c8, ground: 0x6a5038, hemi: 1.0, sun: 0xffe0b0, sunI: 3.0, exp: 1.3, flowers: .2,
    g: [[.40, .36, .20], [.64, .56, .34], [.76, .66, .44]], water: [[.45, .62, .50], [.15, .28, .25]], rock: [1.05, .95, .82], prop: [1.05, .95, .75],
    flora: { rim: [['deadtree', 1], ['rock', 1]], inner: [['deadtree', 1], ['rock', 2]], small: 'pebble', density: .35 } },
  { id: 'mountain', name: '山岳', bg: 0x0c1016, sky: 0xdbe8ff, ground: 0x5a5a5a, hemi: 1.05, sun: 0xfff4e0, sunI: 2.6, exp: 1.3, snow: 1, snowLine: 6,
    g: [[.20, .30, .14], [.44, .54, .30], [.70, .72, .62]], water: [[.40, .80, .85], [.05, .30, .45]], rock: [.95, .98, 1.05],
    flora: { rim: [['pine', 3]], inner: [['pine', 1], ['rock', 1]], small: 'pebble', density: .8 } },
  { id: 'desert', moss: [.80, .68, .46], name: '砂漠・ピラミッド', bg: 0x16120c, sky: 0xffeedd, ground: 0x8a6a40, hemi: 1.0, sun: 0xfff0c8, sunI: 3.2, exp: 1.25, flowers: 0,
    g: [[.70, .58, .36], [.88, .76, .52], [.94, .84, .62]], water: [[.30, .80, .75], [.04, .40, .50]], rock: [1.15, 1.0, .78], prop: [1.1, 1.0, .8],
    flora: { rim: [['rock', 1], ['deadtree', .4]], inner: [['rock', 1]], small: 'pebble', density: .2 } },
  { id: 'cave', moss: [.30, .30, .32], name: '洞窟', bg: 0x050607, fogNear: 30, fogFar: 110, sky: 0x6a7890, ground: 0x2a2620, hemi: .55, sun: 0xcfd8ff, sunI: 1.1, exp: 1.15, flowers: 0,
    g: [[.16, .15, .13], [.30, .28, .24], [.40, .38, .34]], water: [[.20, .50, .60], [.02, .10, .16]], rock: [.7, .72, .78], prop: [.75, .8, .85],
    flora: { rim: [['rock', 2]], inner: [['rock', 1], ['mushroom', 1.5]], small: 'mushroom', density: .4 } },
  { id: 'ruins', name: '遺跡', bg: 0x0e0f0c, sky: 0xe4ecd8, ground: 0x6a6040, hemi: 1.0, sun: 0xffe8c0, sunI: 2.6, exp: 1.3,
    g: [[.24, .32, .12], [.52, .60, .26], [.70, .70, .42]], water: [[.36, .80, .72], [.04, .30, .38]], rock: [1.05, 1.02, .92], prop: [1, 1, .92],
    flora: { rim: [['oak', 2], ['pine', 1]], inner: [['oak', 1], ['bush', 1], ['stump', .4]], small: 'flowers', density: .7 } },
  { id: 'castle', name: '古城', bg: 0x0b0b12, sky: 0xb8c4e0, ground: 0x4a4650, hemi: .9, sun: 0xd8d8ff, sunI: 2.0, exp: 1.2, flowers: .3,
    g: [[.14, .22, .10], [.34, .44, .22], [.48, .52, .40]], water: [[.25, .50, .55], [.03, .14, .22]], rock: [.9, .92, 1.0], prop: [.85, .9, .95],
    flora: { rim: [['pine', 2], ['deadtree', 1]], inner: [['deadtree', 1], ['bush', 1]], small: 'bush', density: .5 } },
  { id: 'volcano', moss: [.24, .21, .19], name: '火山', bg: 0x120604, fog: 0x1a0804, sky: 0xffb48a, ground: 0x5a1a0a, hemi: .85, sun: 0xff9a60, sunI: 2.4, exp: 1.25, flowers: 0, lava: true,
    g: [[.14, .12, .11], [.28, .24, .21], [.42, .34, .28]], water: [[.95, .40, .08], [.45, .06, .02]], rock: [.6, .55, .52], prop: [.55, .48, .45],
    flora: { rim: [['deadtree', 1], ['rock', 2]], inner: [['rock', 1], ['deadtree', .5]], small: 'pebble', density: .3 } },
  { id: 'beach', name: '浜辺・磯', bg: 0x0c141a, sky: 0xe0f4ff, ground: 0x8a7a5a, hemi: 1.1, sun: 0xfff6e0, sunI: 3.0, exp: 1.3,
    g: [[.30, .46, .16], [.60, .74, .30], [.80, .82, .48]], water: [[.30, .92, .86], [.02, .36, .56]], rock: [.95, .95, .98],
    flora: { rim: [['oak', 1], ['bush', 2]], inner: [['bush', 1], ['rock', .6]], small: 'reed', density: .5 } },
  { id: 'snow', moss: [.90, .93, 1.0], name: '雪原・氷河', bg: 0x0c1018, sky: 0xe8f2ff, ground: 0x9aa4b4, hemi: 1.2, sun: 0xfff6ec, sunI: 2.4, exp: 1.25, flowers: 0, snow: 1, snowLine: -100,
    g: [[.80, .84, .92], [.94, .96, 1.0], [1, 1, 1]], water: [[.55, .85, .95], [.10, .40, .60]], rock: [.85, .9, 1.0], prop: [.85, .92, 1.0],
    flora: { rim: [['pine', 3]], inner: [['pine', 1], ['rock', .4]], small: 'pebble', density: .7 } },
  { id: 'demon', moss: [.36, .12, .40], name: '魔界', bg: 0x0c0412, fog: 0x14061e, sky: 0xc080ff, ground: 0x3a0a2a, hemi: .9, sun: 0xff70c0, sunI: 2.0, exp: 1.25, flowers: 0,
    g: [[.12, .05, .14], [.30, .10, .34], [.50, .18, .48]], water: [[.55, .20, .45], [.12, .02, .15]], rock: [.7, .55, .8], prop: [.7, .45, .75],
    flora: { rim: [['deadtree', 2], ['rock', 1]], inner: [['deadtree', 1], ['mushroom', 1]], small: 'mushroom', density: .45 } },
];
BIOMES.splice(BIOMES.findIndex(b => b.id === 'castle') + 1, 0,
  { id: 'graveyard', moss: [.42, .44, .36], name: '廃墟・墓地', bg: 0x0a0b10, fog: 0x1a1c24, sky: 0x9aa6c8, ground: 0x3a3830, hemi: .85, sun: 0xb8c4ff, sunI: 1.6, exp: 1.2, flowers: .15,
    g: [[.16, .20, .12], [.32, .38, .24], [.44, .46, .36]], water: [[.25, .40, .42], [.04, .10, .14]], rock: [.85, .88, .95], prop: [.75, .8, .85],
    flora: { rim: [['deadtree', 2], ['pine', 1]], inner: [['gravestone', 3], ['crossgrave', 2], ['deadtree', .6], ['lantern', .3], ['stele', .4]], small: 'pebble', density: .6 } });
// the new parts are what the sample generator plants in these biomes; atmo = default fog when the biome is chosen
const setBiome = (id, o) => Object.assign(BIOMES.find(b => b.id === id), o);
setBiome('cave', { noSun: true, atmo: ['spores', .5], flora: { rim: [['stalagmite', 3], ['rock', 1]], inner: [['stalagmite', 2], ['crystal', 1], ['glowmush', 1.2], ['torch', .25], ['rock', .5]], small: 'glowmush', density: .6 } });
setBiome('ruins', { atmo: ['morning', .35], flora: { rim: [['oak', 2], ['pine', 1]], inner: [['column', 1], ['brokencol', 1.4], ['ruinwall', 1], ['rubblepile', 1], ['oak', 1], ['stele', .4], ['statue', .2]], small: 'flowers', density: .7 } });
setBiome('graveyard', { atmo: ['mist', .7], flora: { ...BIOMES.find(b => b.id === 'graveyard').flora, density: .9 } });
setBiome('castle', { atmo: ['mist', .45] });
setBiome('demon', { atmo: ['miasma', .65] });
setBiome('volcano', { atmo: ['ash', .55] });
setBiome('desert', { atmo: ['dust', .3] });
setBiome('jungle', { atmo: ['morning', .4] });
setBiome('beach', { flora: { rim: [['palm', 2], ['bush', 1]], inner: [['palm', 2], ['rock', .6], ['driftwood', .5], ['bush', .6]], small: 'shells', density: .5 }, landmark: ['lighthouse', 20, -20] });
setBiome('desert', { flora: { rim: [['cactus', 2], ['rock', 1]], inner: [['cactus', 1.5], ['barrelcactus', 1], ['bones', .4], ['obelisk', .15], ['brokencol', .2]], small: 'barrelcactus', density: .4 }, landmark: ['pyramid', -15, 12] });
setBiome('volcano', { flora: { rim: [['lavarock', 2], ['deadtree', 1]], inner: [['lavarock', 1.5], ['obsidian', 1], ['fumarole', .3], ['deadtree', .4]], small: 'pebble', density: .4 } });
setBiome('snow', { flora: { rim: [['pine', 3]], inner: [['pine', 1], ['iceblock', .6], ['icespike', .5], ['snowman', .06]], small: 'pebble', density: .7 }, landmark: ['kamakura', -15, 12] });
setBiome('castle', { flora: { rim: [['pine', 2], ['deadtree', 1]], inner: [['castlewall', 1], ['banner', .5], ['rubblepile', .6], ['bush', 1], ['tower', .15]], small: 'bush', density: .55 }, landmark: ['tower', -15, 12] });
setBiome('demon', { flora: { rim: [['twisttree', 2], ['deadtree', 1]], inner: [['twisttree', 1], ['demonspire', .7], ['bonepile', .6], ['crystal', .4], ['lavarock', .3]], small: 'mushroom', density: .5 }, landmark: ['magiccircle', 1, 9] });
setBiome('jungle', { flora: { rim: [['oak', 2], ['banana', 1.5]], inner: [['banana', 1.2], ['fern', 2], ['oak', 1], ['palm', .4]], small: 'fern', density: 1.4 } });
setBiome('grassland', { flora: { ...BIOMES.find(b => b.id === 'grassland').flora, inner: [['oak', 1], ['bush', 2], ['haystack', .25], ['woodfence', .2]] } });
setBiome('graveyard', { landmark: ['mausoleum', -15, 12] });
const BIOME = () => BIOMES.find(b => b.id === state.biome) || BIOMES[1];
const BU = {
  uG0: { value: new THREE.Color() }, uG1: { value: new THREE.Color() }, uGH: { value: new THREE.Color() },
  uRockTint: { value: new THREE.Color(1, 1, 1) }, uPropTint: { value: new THREE.Color(1, 1, 1) }, uFlowers: { value: 1 },
  uSnow: { value: 0 }, uSnowLine: { value: -100 }, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uLava: { value: 0 },
  uMoss: { value: new THREE.Color() }, uMossAmt: { value: 0 }, uSea: { value: 0 }, uWind: { value: new THREE.Vector3(0, 0, 0) }, uWet: { value: 0 },
  // rock-wall style: terrain cliff faces and rock / cliff-stone props
  uCliffTint: { value: new THREE.Color(1, 1, 1) }, uCliffMoss: { value: new THREE.Color(.30, .42, .15) }, uCliffMossK: { value: 1 }, uCliffMossOn: { value: 0 }, uCliffWet: { value: 0 }, uCliffSnow: { value: 0 },
  // pits cut into the terrain (stairs down): centre x, z, cos, sin / half width, half length, local z offset
  uPitN: { value: 0 }, uPitA: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uPitB: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
};
const CLIFF_STYLES = [
  ['standard', '岩壁（標準）', { tint: [1, 1, 1] }],
  ['dirt', '土壁', { tint: [1.18, .86, .6], moss: [.46, .36, .22], mossK: .8 }],
  ['black', '黒い岩壁', { tint: [.36, .36, .4], moss: [.2, .21, .19], mossK: .5 }],
  ['wet', '濡れた岩壁', { tint: [.5, .56, .64], moss: [.16, .26, .14], wet: 1, mossK: 1.4 }],
  ['mossy', '苔むした岩壁', { tint: [.72, .9, .55], moss: [.26, .5, .12], mossK: 3.2 }],
  ['desert', '砂漠の岩壁', { tint: [1.38, 1.06, .72], moss: [.86, .7, .46], mossK: .7 }],
  ['snow', '雪山の岩壁', { tint: [.86, .9, .98], moss: [.93, .95, 1], mossK: .6, snow: 1 }],
];
const cliffParams = st => ({ tint: st.tint, moss: st.moss || [.30, .42, .15], mossOn: st.moss ? 1 : 0, mossK: st.mossK ?? 1, wet: st.wet || 0, snow: st.snow || 0 });
const defaultCliffIndex = () => Math.max(0, CLIFF_STYLES.findIndex(c => c[0] === state.cliffStyle));
const cliffIndexAt = k => C[k] ? C[k] - 1 : defaultCliffIndex();   // resolved style index (0..6) at an editor vertex
const cliffIndexNear = (x, z) => cliffIndexAt(idx(clamp(Math.round((x + HALF) * RES), 0, N - 1), clamp(Math.round((z + HALF) * RES), 0, N - 1)));
// per-style uniform tables for the rock props (instances look their style up by index)
BU.uCSTint = { value: CLIFF_STYLES.map(c => new THREE.Vector3(...cliffParams(c[2]).tint)) };
BU.uCSMoss = { value: CLIFF_STYLES.map(c => { const p = cliffParams(c[2]); return new THREE.Vector4(...p.moss, p.mossOn); }) };
BU.uCSWet = { value: CLIFF_STYLES.map(c => { const p = cliffParams(c[2]); return new THREE.Vector2(p.wet, p.snow); }) };
// terrain: the style's parameters go into vertex attributes so neighbouring styles blend across a triangle
function fillCliffAttrs() {
  if (typeof tGeo === 'undefined' || !tGeo.attributes.cliffT) return;
  const t = tGeo.attributes.cliffT.array, m = tGeo.attributes.cliffM.array, w = tGeo.attributes.cliffW.array, P = CLIFF_STYLES.map(c => cliffParams(c[2]));
  for (let k = 0; k < N * N; k++) {
    const p = P[cliffIndexAt(k)];
    t[k * 3] = p.tint[0]; t[k * 3 + 1] = p.tint[1]; t[k * 3 + 2] = p.tint[2];
    m[k * 4] = p.moss[0]; m[k * 4 + 1] = p.moss[1]; m[k * 4 + 2] = p.moss[2]; m[k * 4 + 3] = p.mossK;
    w[k * 2] = p.wet; w[k * 2 + 1] = p.snow;
  }
  tGeo.attributes.cliffT.needsUpdate = tGeo.attributes.cliffM.needsUpdate = tGeo.attributes.cliffW.needsUpdate = true;
}
function applyCliffStyle() {
  const st = (CLIFF_STYLES.find(c => c[0] === state.cliffStyle) || CLIFF_STYLES[0])[2];
  BU.uCliffTint.value.setRGB(...st.tint); BU.uCliffMoss.value.setRGB(...(st.moss || [.30, .42, .15])); BU.uCliffMossOn.value = st.moss ? 1 : 0;
  BU.uCliffMossK.value = st.mossK ?? 1; BU.uCliffWet.value = st.wet || 0; BU.uCliffSnow.value = st.snow || 0;
  fillCliffAttrs(); if (typeof rebuildProps === 'function' && typeof propMeshes !== 'undefined') rebuildProps(true);
}
const terrainMat = new THREE.MeshStandardMaterial({ roughness: .92, metalness: 0 });
terrainMat.onBeforeCompile = (sh) => {
  sh.uniforms.uWater = waterU; sh.uniforms.uDim = dimU; sh.uniforms.uTime = timeU; Object.assign(sh.uniforms, BU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 splatA; attribute vec4 splatB; attribute float splatC; attribute vec3 cliffT; attribute vec4 cliffM; attribute vec2 cliffW; varying vec3 vCT; varying vec4 vCM; varying vec2 vCW; varying vec4 vSA; varying vec4 vSB; varying float vSC; varying vec3 vWPos; varying vec3 vWNor;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSA=splatA; vSB=splatB; vSC=splatC; vCT=cliffT; vCM=cliffM; vCW=cliffW; vWPos=(modelMatrix*vec4(position,1.)).xyz; vWNor=normalize(mat3(modelMatrix)*normal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec4 vSA; varying vec4 vSB; varying float vSC; varying vec3 vWPos; varying vec3 vWNor; uniform float uWater; uniform float uDim; uniform float uTime;
uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uGH; uniform vec3 uRockTint; uniform float uFlowers; uniform float uSnow; uniform float uSnowLine; uniform float uWet;
varying vec3 vCT; varying vec4 vCM; varying vec2 vCW; uniform int uPitN; uniform vec4 uPitA[8]; uniform vec4 uPitB[8];
float gGloss=0.; vec3 gGlow=vec3(0.);
${GLSL_NOISE}
${DIM_GLSL}
vec3 terrainColor(){
  vec3 wp=vWPos; vec3 n=normalize(vWNor); vec2 p=wp.xz;
  float slope=1.-n.y;
  float a=fbm(p*.22), b=fbm(p*1.6+5.), c=vn(p*11.);
  // grass
  vec3 grass=mix(uG0, uG1, clamp(a*1.2+b*.7-.5,0.,1.));
  grass=mix(grass, uGH, smoothstep(.62,.95,b)*.35);
  grass*=.86+.28*c;
  vec2 fc=floor(p*4.5), fg=fract(p*4.5)-.5;
  float fl=step(.968,h21(fc+3.1))*step(length(fg-(vec2(h21(fc),h21(fc+9.))-.5)*.5),.1);
  vec3 fcol=h21(fc+7.7)<.55?vec3(.97,.95,.86):vec3(.98,.82,.22);
  // dirt
  vec3 dirt=mix(vec3(.36,.25,.14), vec3(.66,.52,.33), clamp(b*1.25+c*.35-.2,0.,1.));
  // cobble
  vec3 cv=vor(p*1.5); float ce=smoothstep(.02,.1,cv.y-cv.x);
  vec3 cob=mix(vec3(.20,.17,.14), mix(vec3(.42,.38,.33),vec3(.70,.65,.57),cv.z)*(.9+.2*c), ce);
  vec3 col=mix(grass,dirt,smoothstep(.2,.55,vSA.x+(b-.5)*.35));
  col=mix(col,cob,smoothstep(.3,.55,vSA.y+(c-.5)*.15));
  col=mix(col,fcol,uFlowers*fl*step(slope,.12)*(1.-smoothstep(.2,.4,vSA.x+vSA.y+vSA.z+vSA.w+vSB.x+vSB.y)));
  // sand: wind ripples
  float sdw=smoothstep(.25,.6,vSA.z+(b-.5)*.3);
  if(sdw>0.){
    float rip=sin((p.x*.8+p.y*.55)*7.+fbm(p*.45)*7.)*.5+.5;
    vec3 sd=mix(vec3(.76,.66,.46),vec3(.90,.81,.60),clamp(b*.9+c*.3,0.,1.))*(.9+.12*rip);
    col=mix(col,sd,sdw);
  }
  // rubble: dry cracked earth strewn with stones
  float rbw=smoothstep(.25,.6,vSA.w+(b-.5)*.3);
  if(rbw>0.){
    vec3 cr0=vor(p*.8); float crack=1.-smoothstep(.0,.05,cr0.y-cr0.x);
    vec3 dry=mix(vec3(.42,.36,.28),vec3(.60,.53,.41),clamp(b+c*.3-.1,0.,1.))*(1.-.45*crack);
    vec3 st=vor(p*2.4); float isStone=step(.45,st.z)*smoothstep(.36,.26,st.x);
    vec3 stone=mix(vec3(.44,.42,.39),vec3(.76,.73,.68),h21(vec2(st.z*91.,3.)))*(.62+.5*smoothstep(.36,.0,st.x));
    col=mix(col,mix(dry,stone,isStone),rbw);
  }
  // swamp: mud, moss and murky puddles with rising bubbles
  float swW=smoothstep(.25,.6,vSB.x+(b-.5)*.3);
  if(swW>0.){
    vec3 mud=mix(vec3(.17,.15,.09),vec3(.31,.28,.15),b);
    mud=mix(mud,vec3(.24,.32,.11),smoothstep(.45,.75,a+c*.2)*.7);
    float pud=smoothstep(.5,.58,fbm(p*.55+3.7)+(c-.5)*.08);
    vec3 murk=vec3(.10,.14,.08)+.04*vec3(sin(uTime*.6+p.x),sin(uTime*.5+p.y),0.);
    vec2 bc=floor(p*1.8), bf=fract(p*1.8)-.5; float tt=fract(uTime*.3+h21(bc));
    float ring=smoothstep(.03,.0,abs(length(bf-(vec2(h21(bc+1.),h21(bc+2.))-.5)*.5)-tt*.3))*(1.-tt)*pud;
    col=mix(col,mix(mud,murk,pud)+ring*.18,swW);
    gGloss=max(gGloss,pud*swW);
  }
  // poison swamp: purple sludge with glowing, bubbling pools
  float poW=smoothstep(.25,.6,vSB.y+(b-.5)*.3);
  if(poW>0.){
    vec3 sludge=mix(vec3(.16,.09,.19),vec3(.31,.15,.34),b);
    float pud=smoothstep(.46,.56,fbm(p*.65+9.1)+(c-.5)*.08);
    vec3 goo=mix(vec3(.42,.80,.22),vec3(.50,.30,.62),.5+.5*sin(uTime*.5+fbm(p*1.1)*5.));
    vec2 bc=floor(p*1.6), bf=fract(p*1.6)-.5; float tt=fract(uTime*.4+h21(bc+5.));
    float ring=step(.62,h21(bc+8.))*smoothstep(.03,.0,abs(length(bf-(vec2(h21(bc+3.),h21(bc+4.))-.5)*.5)-tt*.28))*(1.-tt)*pud;
    col=mix(col,mix(sludge,goo*.42,pud)+ring*goo*.45,poW);
    gGlow+=goo*(pud*.1+ring*.6)*poW;
    gGloss=max(gGloss,pud*poW);
  }
  // lava: black crust split by glowing, slowly flowing magma
  float lvW=smoothstep(.25,.6,vSB.z+(b-.5)*.3);
  if(lvW>0.){
    vec3 cr=vor(p*.9+vec2(uTime*.02,0.)); float edge=1.-smoothstep(.0,.12,cr.y-cr.x);
    vec3 hot=mix(vec3(.95,.30,.04),vec3(1.,.78,.32),fbm(p*1.2-uTime*.06));
    float molten=max(edge,smoothstep(.6,.75,fbm(p*.35+3.)));
    vec3 crust=mix(vec3(.07,.05,.05),vec3(.18,.14,.12),cr.z)*(.8+.3*c);
    col=mix(col,mix(crust,hot,molten),lvW);
    gGlow+=hot*molten*lvW*.9;
  }
  // snow field: soft white with sparkles
  float snG=smoothstep(.25,.6,vSB.w+(b-.5)*.3);
  if(snG>0.){
    vec3 sn=mix(vec3(.80,.85,.93),vec3(.97,.98,1.),b)*(.94+.08*c);
    sn+=step(.985,h21(floor(p*9.)))*.25;
    col=mix(col,sn,snG);
  }
  // ice: glassy blue with white cracks
  float icW=smoothstep(.25,.6,vSC+(b-.5)*.3);
  if(icW>0.){
    vec3 iv=vor(p*.7); float crk=1.-smoothstep(.0,.04,iv.y-iv.x);
    vec3 ic=mix(vec3(.45,.68,.80),vec3(.70,.88,.95),fbm(p*.5))*(.9+.15*iv.z);
    col=mix(col,mix(ic,vec3(.93,.97,1.),crk*.8),icW);
    gGloss=max(gGloss,icW*.9);
  }
  // beach sand
  float hw=wp.y-uWater;
  float sandW=smoothstep(.42,.08,hw+(a-.5)*.3)*(1.-smoothstep(.3,.5,slope));
  col=mix(col, mix(vec3(.60,.52,.36),vec3(.76,.68,.50),b), sandW);
  // rock (cliffs)
  vec2 rq=vec2((wp.x*.75+wp.z*.65)*1.1, wp.y*1.5);
  vec3 rv=vor(rq); float cr=smoothstep(.0,.13,rv.y-rv.x);
  vec3 rock=mix(vec3(.34,.31,.28), vec3(.70,.65,.58), clamp(fbm(rq*1.3)*1.2+rv.z*.35-.2,0.,1.));
  rock*=mix(.42,1.,cr)*uRockTint*vCT;
  rock=mix(rock, vCM.rgb, clamp(smoothstep(.55,.85,fbm(rq*.7+3.))*smoothstep(.75,.45,slope)*.7*vCM.a,0.,1.));
  rock*=1.-.35*vCW.x;
  rock=mix(rock, vec3(.93,.95,1.), vCW.y*smoothstep(.3,.7,n.y+(fbm(rq*1.7)-.5)*.5));
  float rockW=smoothstep(.24,.42,slope+(a-.5)*.14);
  col=mix(col,rock,rockW);
  gGloss=max(gGloss,vCW.x*.8*rockW);
  // underwater bed
  float dpt=uWater-wp.y;
  if(dpt>0.){
    vec3 pv=vor(p*2.2);
    vec3 bed=mix(vec3(.58,.54,.45),vec3(.72,.67,.56),pv.z)*(.9+.1*smoothstep(.0,.25,pv.y-pv.x));
    bed=mix(bed,col,rockW*.6);
    col=mix(col,bed,smoothstep(0.,.06,dpt));
  }
  // snow cover on flat ground above the snow line
  float snW=uSnow*smoothstep(uSnowLine-.4,uSnowLine+.6,wp.y+(a-.5)*1.2)*(1.-smoothstep(.32,.62,slope))*step(0.,hw);
  col=mix(col, mix(vec3(.80,.86,.95),vec3(.97,.98,1.),b)*(.93+.1*c), snW);
  col*=mix(1.,.72,smoothstep(.18,.0,hw)*step(0.,hw));
  col*=1.-.3*uWet*(1.-snW);
  gGloss=max(gGloss,uWet*.6*(1.-snW));
  return pow(col,vec3(2.2));
}`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for(int i=0;i<8;i++){ if(i>=uPitN) break; vec2 d=vWPos.xz-uPitA[i].xy; float lx=d.x*uPitA[i].z-d.y*uPitA[i].w, lz=d.x*uPitA[i].w+d.y*uPitA[i].z-uPitB[i].z; if(abs(lx)<uPitB[i].x && abs(lz)<uPitB[i].y) discard; }`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=dimc(terrainColor());')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.55,gGloss);')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=pow(gGlow,vec3(2.2))*(1.-.6*uDim);');
};
terrainMat.customProgramCacheKey = () => 'terrain-v6';

function gridIndex() {
  const ix = new Uint32Array((N - 1) * (N - 1) * 6); let o = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = idx(i, j), b = a + 1, c = a + N, d = c + 1;
    ix[o++] = a; ix[o++] = c; ix[o++] = b; ix[o++] = b; ix[o++] = c; ix[o++] = d;
  }
  return new THREE.BufferAttribute(ix, 1);
}
const tGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = idx(i, j) * 3; pos[k] = vx(i); pos[k + 2] = vx(j); }
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
  tGeo.setAttribute('splatA', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('splatB', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('splatC', new THREE.BufferAttribute(new Float32Array(N * N), 1));
  tGeo.setAttribute('cliffT', new THREE.BufferAttribute(new Float32Array(N * N * 3).fill(1), 3));
  tGeo.setAttribute('cliffM', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('cliffW', new THREE.BufferAttribute(new Float32Array(N * N * 2), 2));
  tGeo.setIndex(gridIndex());
}
const terrain = new THREE.Mesh(tGeo, terrainMat);
terrain.castShadow = terrain.receiveShadow = true;
scene.add(terrain);

// outer wall (skirt) so the map reads as a floating block
const sGeo = new THREE.BufferGeometry();
const SIDES = [[i => [i, 0], [0, 0, -1]], [i => [N - 1, i], [1, 0, 0]], [i => [N - 1 - i, N - 1], [0, 0, 1]], [i => [0, N - 1 - i], [-1, 0, 0]]];
{
  const nv = SIDES.length * N * 2, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), ix = [];
  SIDES.forEach(([f, n], s) => {
    for (let t = 0; t < N; t++) {
      const [i, j] = f(t), v = (s * N + t) * 2;
      for (const k of [v, v + 1]) { pos[k * 3] = vx(i); pos[k * 3 + 2] = vx(j); nor.set(n, k * 3); }
      pos[(v + 1) * 3 + 1] = SKIRT_Y;
      if (t < N - 1) ix.push(v, v + 1, v + 2, v + 2, v + 1, v + 3);
    }
  });
  sGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  sGeo.setAttribute('splat', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
  sGeo.setIndex(ix);
}
{
  const nv = sGeo.attributes.position.count, c = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { const top = v % 2 === 0, k = top ? .42 : .0; c[v * 3] = k * .95; c[v * 3 + 1] = k * .9; c[v * 3 + 2] = k * .82; }
  sGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
const skirt = new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
skirt.receiveShadow = true;
scene.add(skirt);

// ---------- water ----------
// 水の解析（water.js）の結果を、画面の水の描き直しと「水」表示に使う。書き出しと同じ解析・同じ画像（flow / mask）。
const WFLOW = new Uint8Array(N * N * 4), WMASK = new Uint8Array(N * N * 4);
const mkWaterTex = data => { const tx = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.generateMipmaps = false; tx.needsUpdate = true; return tx; };
const WATERU = {
  uFlow: { value: mkWaterTex(WFLOW) }, uMask: { value: mkWaterTex(WMASK) }, uFlowMax: { value: 2 }, uBankRange: { value: 1.5 }, uTrailMax: { value: .65 }, uShow: { value: 0 }, uMapSize: { value: SIZE },
  uFalls: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uFallCount: { value: 0 },
};
let waterTimer = 0, waterInfo = null;
function refreshWaterData() {
  waterTimer = 0;
  const res = TDWater.analyze({ TN: N, TS: CELL, HALF, TH: H, level: state.water, falls: falls.map(f => ({ id: f.id, x: f.x, z: f.z, w: f.w })) });
  const pk = TDWater.pack(res);
  WFLOW.set(pk.flow); WMASK.set(pk.mask); WATERU.uFlow.value.needsUpdate = true; WATERU.uMask.value.needsUpdate = true;
  WATERU.uFlowMax.value = res.options.maxSpeed; WATERU.uBankRange.value = res.options.bankRange; WATERU.uTrailMax.value = res.options.trailMaxCover;
  let n = 0;
  for (let i = 0; i < falls.length && n < 8; i++) {
    const rf = res.falls[i]; if (!rf || rf.dry) continue; const f = falls[i];
    WATERU.uFalls.value[n++].set(rf.cx, rf.cz, (Math.abs(Math.sin(f.x * 12.9898 + f.z * 78.233)) * 43758.5453) % 1, f.w);
  }
  WATERU.uFallCount.value = n; waterInfo = res; showWaterInfo();
}
function scheduleWater() { clearTimeout(waterTimer); waterTimer = setTimeout(refreshWaterData, 350); }
function showWaterInfo() {
  const el = typeof document !== 'undefined' && document.getElementById('waterInfo'); if (!el || !waterInfo) return;
  const r = waterInfo, s = r.stats, lines = [];
  if (!r.wetCount) lines.push('水位より低い所がありません（水は出ません）');
  else {
    lines.push(`水の所 ${(s.wetFraction * 100).toFixed(1)}%、最大の水深 ${s.maxDepth.toFixed(1)}m` + (r.hasFlow ? `、流れ 速さの上位5% ${s.speedP95.toFixed(2)}m/s` : '、流れなし'));
    lines.push(`滝 ${r.falls.length}個（着水できる ${r.falls.filter(f => !f.dry).length}個）、地図の端から端へ流れる川 ${(r.inflows || []).length}本`);
    for (const w of r.warnings) lines.push('⚠ ' + w);
    if (BIOME().lava) lines.push('溶岩: Unity の水は未対応（書き出しは waterSim.available=false）');
    else if (state.sea) lines.push('海: Unity の水は未対応（書き出しは waterSim.available=false）');
  }
  el.textContent = lines.join('\n');
}
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(tGeo.attributes.position.array.map((v, k) => k % 3 === 1 ? 0 : v), 3));
wGeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(N * N), 1));
wGeo.setIndex(gridIndex());
const waterMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uDim: dimU, uSun: { value: sun.position.clone().normalize() }, uShallow: BU.uShallow, uDeep: BU.uDeep, uLava: BU.uLava, uSea: BU.uSea, ...WATERU },
  vertexShader: `attribute float depth; varying float vD; varying vec3 vWPos;
    void main(){ vD=depth; vec4 w=modelMatrix*vec4(position,1.); vWPos=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uTime; uniform float uDim; uniform vec3 uSun; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uLava; uniform float uSea; uniform sampler2D uFlow; uniform sampler2D uMask; uniform float uFlowMax; uniform float uBankRange; uniform float uTrailMax; uniform float uShow; uniform float uMapSize; uniform vec4 uFalls[8]; uniform float uFallCount; varying float vD; varying vec3 vWPos;
    ${DIM_GLSL}
    ${GLSL_NOISE}
    float caus(vec2 p){ vec3 a=vor(p+vec2(uTime*.12,uTime*.08)); vec3 b=vor(p*1.6-vec2(uTime*.09,-uTime*.11));
      return (1.-smoothstep(0.,.07,a.y-a.x))*(1.-smoothstep(0.,.07,b.y-b.x)); }
    void main(){
      if(vD<=0.) discard;
      vec2 p=vWPos.xz; float d=vD;
      float t=1.-exp(-d*1.1);
      vec3 col=mix(uShallow, uDeep, t);
      // 流れ（書き出しと同じ画像）：細波・光の網・泡の模様を、半周期ずらした2層で下流へ運ぶ
      vec2 muv=(p+uMapSize*.5)/uMapSize; vec4 fl=texture2D(uFlow,muv); vec4 mk=texture2D(uMask,muv);
      float wetMap=clamp(fl.a*60.,0.,1.);
      vec2 flow=vec2(fl.r*2.-1.,-(fl.g*2.-1.))*uFlowMax*wetMap;     // 画像は Unity の軸（z が逆）
      float speed=length(flow);
      float ph0=fract(uTime/1.6), ph1=fract(uTime/1.6+.5), w0=1.-abs(1.-2.*ph0);
      vec2 pa=p-flow*ph0*1.6, pb=p-flow*ph1*1.6;
      col+=mix(caus(pb*.55),caus(pa*.55),w0)*(1.-t)*vec3(.22,.3,.28);
      float e=.15; float n0a=fbm(pa*1.3+uTime*.25), n0b=fbm(pb*1.3+uTime*.25);
      vec2 ga=vec2(fbm(pa*1.3+vec2(e,0)+uTime*.25)-n0a, fbm(pa*1.3+vec2(0,e)+uTime*.25)-n0a)/e;
      vec2 gb=vec2(fbm(pb*1.3+vec2(e,0)+uTime*.25)-n0b, fbm(pb*1.3+vec2(0,e)+uTime*.25)-n0b)/e;
      vec2 g=mix(gb,ga,w0)*(1.+speed*.5);
      vec3 nr=normalize(vec3(-g.x*.25,1.,-g.y*.25));
      vec3 V=normalize(cameraPosition-vWPos);
      float spec=pow(max(dot(reflect(-uSun,nr),V),0.),140.)*.35;
      float fres=pow(1.-max(V.y,0.),3.)*.35;
      col+=spec+fres*vec3(.6,.75,.85);
      float fz=smoothstep(.17,.0,d+(fbm(p*3.+uTime*.3)-.5)*.16);
      col=mix(col,vec3(.96,1.,1.),fz*.9);
      // 泡の模様（流れに乗る）。覆う割合 cover は Unity の水と同じ式：lace = saturate((pattern-(1-cover))*4)
      float patA=clamp((mix(fbm(pb*2.3+vec2(uTime*.03,0.)),fbm(pa*2.3+vec2(uTime*.03,0.)),w0)-.5)*2.6+.5,0.,1.);
      float patB=clamp((fbm(p*3.9+vec2(-uTime*.02,uTime*.03))-.5)*2.6+.5,0.,1.);
      float pat=patA*.6+patB*.4;
      float rapids=clamp((speed-.6)/.6,0.,1.)*(1.-smoothstep(.8,2.2,d));
      float lace=clamp((pat-(1.-.58*rapids))*4.,0.,1.)*step(.001,rapids);
      float trail=mk.r*uTrailMax; float trailLace=clamp((patA-(1.-trail))*4.,0.,1.)*step(.001,trail);
      float bankDist=fl.a*uBankRange; float bankNear=(1.-smoothstep(.15,.6,bankDist))*step(.04,bankDist);
      float shoreBand=max(smoothstep(.10,.025,d)*smoothstep(0.,.012,d), bankNear*step(.02,d));
      float lap=.5+.5*sin(uTime*1.25+fl.b*9.+(p.x+p.y)*.7);
      float shore=shoreBand*clamp((pat-(1.-(.58+.06*lap)))*4.,0.,1.)*(.7+.3*clamp(speed,0.,1.))*.9;
      // 滝の着水：中心が明るく外へ広がって薄れる輪（Unity の飛沫・波紋と同じ向きの動き）
      float ringF=0.;
      for(int i=0;i<8;i++){ if(float(i)>=uFallCount) break; vec2 rel=p-uFalls[i].xy; float r=length(rel);
        ringF+=exp(-r*r/(.5+uFalls[i].w*.12))*.75;
        for(int k=0;k<3;k++){ float ph=fract(uTime*.5+float(k)/3.+uFalls[i].z); float R=.3+ph*(2.4+uFalls[i].w*.5);
          float arc=smoothstep(.30,.75,vn(vec2(atan(rel.y,rel.x)*2.2+float(k)*7.3+uFalls[i].z*5.,uTime*.25)));
          ringF+=exp(-pow((r-R)/.26,2.))*(1.-ph)*(1.-ph)*arc*.9; } }
      ringF=clamp(ringF,0.,1.);
      float foamAdd=max(max(lace*.92,trailLace*.85),max(shore*.8,ringF*.8));
      col=mix(col,vec3(.96,1.,1.),foamAdd*(1.-uLava));
      fz=max(fz,foamAdd);
      // sea: rows of breaking waves rolling in toward the shore
      float wv=sin(d*5.5-uTime*1.6+fbm(p*.18)*5.);
      float surf=smoothstep(.82,.98,wv)*(1.-smoothstep(.15,2.2,d))*smoothstep(.0,.08,d)*(.6+.6*fbm(p*1.5+uTime*.2));
      col=mix(col,vec3(.97,1.,1.),surf*uSea);
      fz=max(fz,surf*uSea*.8);
      float alpha=max(mix(.42,.93,t),fz*.95);
      if(uShow>.5){   // 水の表示：1 = 流れの矢印と速さの色、2 = 水際の帯（緑）と泡の帯（赤紫）
        vec3 ov=col;
        if(uShow<1.5){
          ov=mix(ov,mix(vec3(.1,.35,1.),vec3(1.,.25,.1),clamp(speed/1.5,0.,1.)),.55);
          vec2 cc=(floor(p/1.5)+.5)*1.5; vec2 cuv=(cc+uMapSize*.5)/uMapSize; vec4 cf=texture2D(uFlow,cuv);
          vec2 cfl=vec2(cf.r*2.-1.,-(cf.g*2.-1.))*uFlowMax*clamp(cf.a*60.,0.,1.); float cs=length(cfl);
          if(cs>.04){ vec2 dir=cfl/cs; vec2 q=p-cc; float al=dot(q,dir), pe=abs(dot(q,vec2(-dir.y,dir.x))); float len=.18+.42*clamp(cs/1.5,0.,1.);
            float shaft=step(pe,.045)*step(-len,al)*step(al,len*.55); float head=step(len*.55,al)*step(al,len)*step(pe,(len-al)*.55);
            ov=mix(ov,vec3(1.),clamp(shaft+head,0.,1.)); }
        } else {
          ov=mix(ov,vec3(.2,.9,.3),shoreBand*.55); ov=mix(ov,vec3(1.,.2,.8),clamp(mk.r*1.6,0.,1.)*.75);
        }
        col=ov; alpha=max(alpha,.85);
      }
      if(uLava>.5){
        // molten rock: glowing flow under a drifting dark crust
        float n=fbm(p*.5+vec2(uTime*.03,0.));
        vec3 hot=mix(vec3(.95,.28,.04),vec3(1.,.78,.30),fbm(p*1.4-uTime*.08));
        float crust=smoothstep(.42,.62,n+(1.-caus(p*.3))*.15);
        col=mix(hot,vec3(.10,.06,.05)+hot*.08,crust*.88);
        col=mix(col,vec3(1.,.6,.2),fz*.6);
        alpha=1.;
      }
      gl_FragColor=vec4(dimc(pow(col,vec3(2.2))),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(wGeo, waterMat);
water.renderOrder = 2;
scene.add(water);

function updateTerrain() {
  walkDirty = true;
  if (typeof linkGroup !== 'undefined') for (const g of linkGroup.children) g.position.y = heightAt(g.userData.m.x, g.userData.m.z);
  if (typeof updateAtmoHeights === 'function' && fogGroup) updateAtmoHeights();
  const pos = tGeo.attributes.position.array, sa = tGeo.attributes.splatA.array, sb = tGeo.attributes.splatB.array, sc = tGeo.attributes.splatC.array, dp = wGeo.attributes.depth.array;
  for (let k = 0; k < N * N; k++) {
    pos[k * 3 + 1] = H[k]; dp[k] = state.water - H[k];
    for (let c = 0; c < 4; c++) sa[k * 4 + c] = S[k * NS + c] / 255;
    for (let c = 0; c < 4; c++) sb[k * 4 + c] = S[k * NS + 4 + c] / 255;
    sc[k] = S[k * NS + 8] / 255;
  }
  fillCliffAttrs();
  tGeo.attributes.position.needsUpdate = tGeo.attributes.splatA.needsUpdate = tGeo.attributes.splatB.needsUpdate = tGeo.attributes.splatC.needsUpdate = wGeo.attributes.depth.needsUpdate = true;
  tGeo.computeVertexNormals();
  tGeo.computeBoundingSphere(); tGeo.computeBoundingBox();
  const spos = sGeo.attributes.position.array;
  SIDES.forEach(([f], s) => { for (let t = 0; t < N; t++) { const [i, j] = f(t); spos[(s * N + t) * 2 * 3 + 1] = H[idx(i, j)]; } });
  sGeo.attributes.position.needsUpdate = true; sGeo.computeBoundingSphere();
  water.position.y = state.water; waterU.value = state.water;
  scheduleWater();
}

// ============================================================
// Props (procedural low-poly assets, drawn instanced)
// ============================================================
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
function makeGeo(parts, seed) {
  const R = rng(seed), P = [], C = [], G = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const p of parts) {
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m);
    const pos = g.attributes.position, pr = R();
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const ny = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize().y;
      const base = p.cfn ? p.cfn((a.y + b.y + c.y) / 3, ny, R, pr) : p.c;
      const k = (1 + (R() - .5) * 2 * (p.j ?? .12)) * (.74 + .36 * Math.max(ny, -.4));
      for (const v of [a, b, c]) { P.push(v.x, v.y, v.z); C.push(base[0] * k, base[1] * k, base[2] * k); G.push(p.glow || 0); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('glow', new THREE.Float32BufferAttribute(G, 1));   // self-lit parts: flames, crystals, glowing caps
  geo.computeVertexNormals();
  return geo;
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
function geoPine() {
  const parts = [];
  parts.push({ g: new THREE.CylinderGeometry(.11, .2, 1.8, 6), m: mat4(0, .9, 0, 1, 1, 1), c: col(0x46301e) });
  const rs = [1.55, 1.36, 1.15, .94, .72, .5, .3], top = (y, ny, R) => ny > .55 ? mixc(col(0x3f7f45), col(0x6aa055), R()) : ny > .2 ? mixc(col(0x2a6038), col(0x3b7442), R()) : mixc(col(0x1a4128), col(0x24502f), R());
  rs.forEach((r, k) => parts.push({ g: tierGeo(r, 1.35, 9 + (k % 2), k * 1.7), m: mat4(0, 1.45 + k * .66, 0, 1, 1, 1, k * .9), cfn: top, j: .12 }));
  return makeGeo(parts, 11);
}
function geoOak() {
  const parts = [{ g: new THREE.CylinderGeometry(.2, .32, 2.6, 6), m: mat4(0, 1.3, 0, 1, 1, 1), c: col(0x5a4028) }];
  const greens = [0x2c6326, 0x3a7a2b, 0x4c8e30, 0x2a5a25].map(col);
  [[0, 3.7, 0, 1.9], [1.15, 3.25, .5, 1.3], [-1.05, 3.35, -.45, 1.35], [.3, 4.65, -.55, 1.15], [-.45, 4.35, .95, 1.1], [.95, 2.95, -1.05, 1]]
    .forEach(([x, y, z, r], k) => parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 1), .38, k * 3.1), m: mat4(x, y, z, r, r * .85, r), c: greens[k % 4], j: .2 }));
  return makeGeo(parts, 12);
}
function geoRock() {
  const parts = [];
  const cf = (y, ny, R) => ny > .8 && R() < .22 ? mixc(col(0x5d7a33), col(0x78924a), R()) : mixc(col(0x5c5750), col(0x9a9184), clamp(.35 + y * .35 + (R() - .5) * .4, 0, 1));
  parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 1), .35, 1.7), m: mat4(0, .4, 0, 1.05, .62, .85, .3), cfn: cf, j: .1 });
  parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .4, 4.2), m: mat4(.95, .2, .45, .55, .45, .5, 1.1), cfn: cf, j: .1 });
  parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .4, 7.9), m: mat4(-.8, .15, -.55, .42, .35, .4, 2.3), cfn: cf, j: .1 });
  return makeGeo(parts, 13);
}
function geoCliff() {
  const R = rng(77), parts = [];
  const cf = (y, ny, Rr, pr) => ny > .7 ? (pr < .4 ? mixc(col(0x5d7a32), col(0x7f9a46), pr * 2) : mixc(col(0x9a917f), col(0xbdb4a0), pr))
    : mixc(col(0x6f685d), col(0xc2b8a4), clamp(.3 + y * .2 + (Rr() - .5) * .5, 0, 1));
  let x = -1.15;
  while (x < 1.1) {
    const w = .38 + R() * .5, h = 1.9 + R() * .55, d = .8 + R() * .4;
    const g = displace(new THREE.BoxGeometry(w, h, d, 1, 2, 1), .16, x * 9.1);
    parts.push({ g, m: mat4(x + w / 2, h / 2 - .1, (R() - .5) * .25, 1, 1, 1, (R() - .5) * .25, (R() - .5) * .06), cfn: cf, j: .1 });
    if (R() < .12) {
      const h2 = .2 + R() * .25, g2 = displace(new THREE.BoxGeometry(w * .9, h2, d * .85, 1, 1, 1), .2, x * 3.3);
      parts.push({ g: g2, m: mat4(x + w / 2 + (R() - .5) * .1, h + h2 / 2 - .12, (R() - .5) * .2, 1, 1, 1, (R() - .5) * .4), cfn: cf, j: .1 });
    }
    x += w * .92;
  }
  return makeGeo(parts, 15);
}
function geoPebble() {
  const cf = (y, ny, R, pr) => mixc(col(0x6d675e), col(0xb3ab9c), clamp(pr * .7 + (ny > .6 ? .25 : 0) + (R() - .5) * .2, 0, 1));
  return makeGeo([{ g: displace(new THREE.IcosahedronGeometry(1, 0), .5, 2.2), m: mat4(0, .1, 0, .3, .17, .24, .4), cfn: cf, j: .08 },
    { g: displace(new THREE.IcosahedronGeometry(1, 0), .5, 5.1), m: mat4(.38, .06, .2, .16, .1, .14, 1.3), cfn: cf, j: .08 }], 41);
}
function geoReed() {
  const R = rng(42), parts = [];
  for (let k = 0; k < 9; k++) {
    const a = R() * 6.28, r = R() * .35, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 1.0 + R() * .7, lean = (R() - .5) * .25;
    parts.push({ g: new THREE.CylinderGeometry(.012, .025, h, 3), m: mat4(x, h / 2, z, 1, 1, 1, 0, lean, (R() - .5) * .2), c: mixc(col(0x557a2a), col(0x86a046), R()), j: .1 });
    if (R() < .55) parts.push({ g: new THREE.CylinderGeometry(.045, .045, .22, 5), m: mat4(x + Math.sin(lean) * 0, h - .05, z + lean * h * .5, 1, 1, 1, 0, lean), c: col(0x5a3a1e), j: .1 });
    parts.push({ g: new THREE.BoxGeometry(.05, h * .7, .01), m: mat4(x + .04, h * .33, z, 1, 1, 1, a, (R() - .5) * .5, .25), c: col(0x6a8c34), j: .15 });
  }
  return makeGeo(parts, 42);
}
function geoLog() {
  const bark = (y, ny, R) => mixc(col(0x3e2a19), col(0x6a4a2e), R());
  return makeGeo([
    { g: displace(new THREE.CylinderGeometry(.3, .34, 3.2, 9, 3), .06, 3.3), m: mat4(0, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), cfn: bark, j: .1 },
    { g: new THREE.CylinderGeometry(.27, .27, .03, 9), m: mat4(1.61, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xc9a274), j: .05 },
    { g: new THREE.CylinderGeometry(.3, .3, .03, 9), m: mat4(-1.61, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xc9a274), j: .05 },
    { g: new THREE.CylinderGeometry(.04, .07, .7, 5), m: mat4(.5, .55, .15, 1, 1, 1, 0, .6, .3), cfn: bark, j: .1 },
    { g: displace(new THREE.IcosahedronGeometry(.28, 0), .3, 1.1), m: mat4(-.6, .55, 0, 1.4, .35, 1, 0), c: col(0x4f7a2a), j: .15 },
  ], 43);
}
function geoStump() {
  const bark = (y, ny, R) => ny > .8 ? mixc(col(0xb88c5c), col(0xd9b384), R()) : mixc(col(0x3e2a19), col(0x6a4a2e), R());
  const parts = [{ g: displace(new THREE.CylinderGeometry(.36, .46, .62, 9, 2), .06, 7.7), m: mat4(0, .31, 0, 1, 1, 1), cfn: bark, j: .08 }];
  for (let k = 0; k < 4; k++) { const a = k * 1.6 + .4; parts.push({ g: new THREE.CylinderGeometry(.05, .14, .7, 5), m: mat4(Math.cos(a) * .42, .08, Math.sin(a) * .42, 1, 1, 1, -a, 0, Math.PI / 2 - .25), cfn: bark, j: .1 }); }
  parts.push({ g: displace(new THREE.IcosahedronGeometry(.12, 0), .3, 2.9), m: mat4(.25, .66, .1, 1, .5, 1), c: col(0xd8c39a), j: .1 });
  return makeGeo(parts, 44);
}
function geoDeadTree() {
  const bark = (y, ny, R) => mixc(col(0x4a4038), col(0x7a6e62), R());
  const parts = [{ g: displace(new THREE.CylinderGeometry(.1, .3, 3.4, 7, 3), .12, 1.9), m: mat4(0, 1.7, 0, 1, 1, 1, 0, .05, .04), cfn: bark, j: .1 }];
  [[1.5, .9, .7, 1.1], [2.1, -.8, 2.2, .9], [2.6, .7, 3.9, .8], [3.0, -.6, 5.1, .6], [1.1, .8, 4.5, .7]].forEach(([y, tilt, ry, L]) =>
    parts.push({ g: new THREE.CylinderGeometry(.03, .08, L, 5), m: mat4(Math.sin(ry) * L * .35, y + L * .3, Math.cos(ry) * L * .35, 1, 1, 1, ry, tilt, 0), cfn: bark, j: .1 }));
  return makeGeo(parts, 45);
}
function geoFlowers() {
  const R = rng(46), parts = [], cols = [0xf2d23c, 0xf6f2e6, 0xe887b8, 0xa58ae0, 0xf08a4b].map(col);
  for (let k = 0; k < 4; k++) parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .3, k), m: mat4((R() - .5) * .5, .08, (R() - .5) * .5, .2, .1, .2), c: mixc(col(0x3e6e28), col(0x5f8f34), R()), j: .1 });
  const c0 = cols[(R() * cols.length) | 0], c1 = cols[(R() * cols.length) | 0];
  for (let k = 0; k < 11; k++) {
    const x = (R() - .5) * .7, z = (R() - .5) * .7, h = .18 + R() * .22;
    parts.push({ g: new THREE.CylinderGeometry(.008, .01, h, 3), m: mat4(x, h / 2, z, 1, 1, 1), c: col(0x4f7a2a) });
    parts.push({ g: new THREE.IcosahedronGeometry(.055, 0), m: mat4(x, h, z, 1, .6, 1), c: R() < .6 ? c0 : c1, j: .08 });
  }
  return makeGeo(parts, 46);
}
function geoMushroom() {
  const R = rng(47), parts = [];
  for (let k = 0; k < 4; k++) {
    const x = (R() - .5) * .45, z = (R() - .5) * .45, h = .1 + R() * .14, r = .06 + R() * .07, red = R() < .5;
    parts.push({ g: new THREE.CylinderGeometry(r * .3, r * .4, h, 5), m: mat4(x, h / 2, z, 1, 1, 1), c: col(0xe8ddc8) });
    parts.push({ g: new THREE.SphereGeometry(r, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(x, h - .01, z, 1, .8, 1), c: red ? col(0xc8402e) : col(0x9a6a3e), j: .08 });
  }
  return makeGeo(parts, 47);
}
// ---------- cave
function geoStalagmite() {
  const cf = (y, ny, R) => mixc(col(0x5a5650), col(0xa8a092), clamp(.25 + y * .18 + (R() - .5) * .3, 0, 1));
  const parts = [];
  [[0, 0, 2.4, .5], [.55, .2, 1.4, .32], [-.4, .35, 1.0, .26], [.15, -.5, .8, .22]].forEach(([x, z, h, r], k) =>
    parts.push({ g: displace(new THREE.ConeGeometry(r, h, 7, 4), .18, k * 2.3), m: mat4(x, h / 2 - .05, z, 1, 1, 1, k), cfn: cf, j: .08 }));
  parts.push({ g: displace(new THREE.CylinderGeometry(.9, 1.05, .25, 9), .2, 9), m: mat4(0, .05, 0, 1, 1, 1), cfn: cf, j: .1 });
  return makeGeo(parts, 51);
}
function geoCrystal() {
  const R = rng(52), parts = [], glowC = (y, ny, Rr) => mixc(col(0x6fe3ff), col(0xc39bff), Rr() * .6);
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05 + R() * .4, lean = .15 + R() * .45, h = .6 + R() * 1.1, r = .12 + R() * .1;
    parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .18, h * .45, Math.sin(a) * .18, r, h * .55, r, a, Math.cos(a) * lean, Math.sin(a) * lean), cfn: glowC, j: .15, glow: 1.3 });
  }
  parts.push({ g: displace(new THREE.IcosahedronGeometry(.45, 0), .4, 3), m: mat4(0, .05, 0, 1.2, .4, 1.1), c: col(0x4a4650), j: .1 });
  return makeGeo(parts, 52);
}
function geoGlowMush() {
  const R = rng(53), parts = [];
  for (let k = 0; k < 5; k++) {
    const x = (R() - .5) * .6, z = (R() - .5) * .6, h = .15 + R() * .3, r = .07 + R() * .1;
    parts.push({ g: new THREE.CylinderGeometry(r * .25, r * .35, h, 5), m: mat4(x, h / 2, z, 1, 1, 1), c: col(0xcfe8e0) });
    parts.push({ g: new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(x, h - .01, z, 1, .7, 1), c: R() < .5 ? col(0x5ff0d0) : col(0x7fb8ff), glow: 1.5, j: .06 });
  }
  return makeGeo(parts, 53);
}
function geoTorch() {
  const wood = (y, ny, R) => mixc(col(0x3e2a19), col(0x6a4a2e), R());
  return makeGeo([
    { g: new THREE.CylinderGeometry(.06, .08, 1.5, 6), m: mat4(0, .75, 0, 1, 1, 1), cfn: wood, j: .1 },
    { g: new THREE.CylinderGeometry(.13, .07, .22, 7), m: mat4(0, 1.58, 0, 1, 1, 1), c: col(0x2e2a26), j: .05 },
    { g: new THREE.ConeGeometry(.12, .42, 7), m: mat4(0, 1.86, 0, 1, 1, 1), c: col(0xffa030), glow: 2.6, j: .1 },
    { g: new THREE.ConeGeometry(.06, .28, 6), m: mat4(0, 1.9, 0, 1, 1, 1), c: col(0xfff0a0), glow: 3, j: .05 },
  ], 54);
}
// ---------- ruins
const RUIN_STONE = (y, ny, R, pr) => mixc(col(0x8d877c), col(0xd2cab8), clamp(pr * .5 + R() * .3 + (ny > .7 ? .15 : 0), 0, 1));
const MOSS = (y, ny, R) => mixc(col(0x4d6e2a), col(0x7a9a46), R());
function geoColumn() {
  const cf = RUIN_STONE;
  return makeGeo([
    { g: new THREE.BoxGeometry(1, .3, 1), m: mat4(0, .15, 0, 1, 1, 1), cfn: cf, j: .06 },
    { g: new THREE.BoxGeometry(.85, .15, .85), m: mat4(0, .37, 0, 1, 1, 1), cfn: cf, j: .06 },
    { g: displace(new THREE.CylinderGeometry(.34, .38, 2.7, 12, 4), .03, 5), m: mat4(0, 1.8, 0, 1, 1, 1), cfn: cf, j: .05 },
    { g: new THREE.BoxGeometry(.85, .18, .85), m: mat4(0, 3.24, 0, 1, 1, 1), cfn: cf, j: .06 },
    { g: new THREE.BoxGeometry(1.05, .22, 1.05), m: mat4(0, 3.43, 0, 1, 1, 1), cfn: cf, j: .06 },
    { g: displace(new THREE.IcosahedronGeometry(.3, 0), .4, 2), m: mat4(.35, .32, .3, 1.2, .35, 1, .4), cfn: MOSS, j: .1 },
  ], 55);
}
function geoBrokenCol() {
  const cf = RUIN_STONE;
  return makeGeo([
    { g: new THREE.BoxGeometry(1, .3, 1), m: mat4(0, .15, 0, 1, 1, 1, .2), cfn: cf },
    { g: displace(new THREE.CylinderGeometry(.3, .38, 1.5, 12, 3), .08, 7), m: mat4(0, 1.05, 0, 1, 1, 1, 0, .04), cfn: cf },
    { g: displace(new THREE.CylinderGeometry(.34, .34, .9, 12, 1), .06, 2), m: mat4(1.0, .34, .5, 1, 1, 1, .6, 0, Math.PI / 2), cfn: cf },
    { g: displace(new THREE.IcosahedronGeometry(.18, 0), .4, 4), m: mat4(-.6, .1, .5, 1, .7, 1), cfn: cf },
    { g: displace(new THREE.IcosahedronGeometry(.13, 0), .4, 8), m: mat4(-.3, .08, -.7, 1, .7, 1), cfn: cf },
    { g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 6), m: mat4(-.1, .3, .4, 1.4, .35, 1, 0), cfn: MOSS, j: .1 },
  ], 56);
}
function geoRuinWall() {
  const R = rng(57), parts = [], cf = RUIN_STONE;
  for (let row = 0; row < 5; row++) {
    let x = -1.5 + (row % 2) * .25; const y = .2 + row * .4;
    while (x < 1.45) {
      const w = Math.min(.5 + R() * .35, 1.5 - x), top = 1.9 - Math.abs(x) * .5 + (R() - .5) * .8;
      if (y < top || row === 0) {
        parts.push({ g: new THREE.BoxGeometry(w - .03, .38, .55), m: mat4(x + w / 2, y, (R() - .5) * .05, 1, 1, 1, (R() - .5) * .04), cfn: cf, j: .1 });
        if (row > 0 && y + .4 >= top && R() < .6) parts.push({ g: displace(new THREE.IcosahedronGeometry(.22, 0), .4, x * 7), m: mat4(x + w / 2, y + .22, 0, 1.3, .45, 1.1), cfn: MOSS, j: .1 });
      }
      x += w;
    }
  }
  for (let k = 0; k < 4; k++) parts.push({ g: displace(new THREE.IcosahedronGeometry(.2, 0), .4, k + 11), m: mat4((R() - .5) * 3, .1, .5 + R() * .4, 1, .7, 1, R() * 3), cfn: cf });
  return makeGeo(parts, 57);
}
function geoArchGate() {
  const cf = RUIN_STONE, parts = [];
  for (const sx of [-1.25, 1.25]) {
    parts.push({ g: new THREE.BoxGeometry(.7, .3, .8), m: mat4(sx, .15, 0, 1, 1, 1), cfn: cf });
    parts.push({ g: displace(new THREE.BoxGeometry(.55, 2.5, .6, 1, 4, 1), .03, sx), m: mat4(sx, 1.55, 0, 1, 1, 1), cfn: cf });
  }
  const n = 9;
  for (let k = 0; k < n; k++) { const a = Math.PI * (k + .5) / n; parts.push({ g: new THREE.BoxGeometry(.55, .42, .62), m: mat4(Math.cos(a) * 1.25, 2.8 + Math.sin(a) * 1.25, 0, 1, 1, 1, 0, 0, a - Math.PI / 2), cfn: cf, j: .08 }); }
  parts.push({ g: new THREE.BoxGeometry(3.3, .35, .7), m: mat4(0, 4.25, 0, 1, 1, 1), cfn: cf });
  parts.push({ g: displace(new THREE.IcosahedronGeometry(.35, 0), .4, 3), m: mat4(-.8, 4.45, .1, 1.5, .35, 1, .3), cfn: MOSS, j: .1 });
  return makeGeo(parts, 58);
}
function geoStatue() {
  const cf = (y, ny, R) => ny > .75 && R() < .35 ? mixc(col(0x56743a), col(0x7d9a4c), R()) : mixc(col(0x7c776e), col(0xbdb6a6), clamp(R() * .4 + y * .08, 0, 1));
  return makeGeo([
    { g: new THREE.BoxGeometry(1.1, .6, 1.1), m: mat4(0, .3, 0, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.9, .15, .9), m: mat4(0, .67, 0, 1, 1, 1), cfn: cf },
    { g: displace(new THREE.CylinderGeometry(.26, .42, 1.5, 8, 3), .05, 3), m: mat4(0, 1.5, 0, 1, 1, 1), cfn: cf },
    { g: displace(new THREE.IcosahedronGeometry(.2, 1), .08, 5), m: mat4(0, 2.42, 0, 1, 1.1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.12, .7, .14), m: mat4(-.32, 1.75, .08, 1, 1, 1, 0, -.5, .25), cfn: cf },
    { g: new THREE.BoxGeometry(.12, .75, .14), m: mat4(.3, 1.95, 0, 1, 1, 1, 0, 0, -.2), cfn: cf },
    { g: new THREE.CylinderGeometry(.03, .03, 2.1, 5), m: mat4(.36, 1.9, 0, 1, 1, 1), cfn: cf },
  ], 59);
}
function halfDisc(r, d) { return new THREE.CylinderGeometry(r, r, d, 10, 1, false, Math.PI / 2, Math.PI); }   // rounded top, use with rx = PI/2
function geoStele() {
  const cf = RUIN_STONE;
  return makeGeo([
    { g: new THREE.BoxGeometry(1.1, .25, .55), m: mat4(0, .12, 0, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.8, 1.3, .22), m: mat4(0, .9, 0, 1, 1, 1), cfn: cf },
    { g: halfDisc(.4, .22), m: mat4(0, 1.55, 0, 1, 1, 1, 0, Math.PI / 2), cfn: cf },
    { g: new THREE.BoxGeometry(.56, .9, .02), m: mat4(0, 1.0, .115, 1, 1, 1), c: col(0x6a655c), j: .03 },
  ], 60);
}
function geoRubblePile() {
  const R = rng(61), parts = [];
  for (let k = 0; k < 9; k++) {
    const a = R() * 6.28, d = R() * .7, s = .25 + R() * .3;
    parts.push({ g: k % 3 ? new THREE.BoxGeometry(s * 1.6, s, s) : displace(new THREE.IcosahedronGeometry(s * .7, 0), .3, k), m: mat4(Math.cos(a) * d, s * .4 + (k > 5 ? .3 : 0), Math.sin(a) * d, 1, 1, 1, R() * 3, (R() - .5) * .6, (R() - .5) * .6), cfn: RUIN_STONE, j: .1 });
  }
  return makeGeo(parts, 61);
}
// ---------- graveyard
function geoGrave() {
  const cf = (y, ny, R) => ny > .7 && R() < .3 ? mixc(col(0x56743a), col(0x7d9a4c), R()) : mixc(col(0x6e6b66), col(0xa9a59c), R() * .7);
  return makeGeo([
    { g: new THREE.BoxGeometry(.8, .12, .5), m: mat4(0, .06, .15, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.6, .75, .14), m: mat4(0, .45, -.05, 1, 1, 1, 0, -.06), cfn: cf },
    { g: halfDisc(.3, .14), m: mat4(0, .83, -.07, 1, 1, 1, 0, Math.PI / 2 - .06), cfn: cf },
    { g: displace(new THREE.IcosahedronGeometry(.3, 0), .3, 4), m: mat4(0, .02, .55, 1.3, .25, 1.6), c: col(0x4a3d2c), j: .1 },
  ], 62);
}
function geoCrossGrave() {
  const cf = (y, ny, R) => mixc(col(0x75716a), col(0xb0aba0), R() * .7);
  return makeGeo([
    { g: displace(new THREE.IcosahedronGeometry(.45, 1), .2, 2), m: mat4(0, 0, .25, 1, .3, 1.7), c: col(0x4a3d2c), j: .12 },
    { g: new THREE.BoxGeometry(.13, 1.15, .13), m: mat4(0, .6, -.15, 1, 1, 1, 0, 0, .05), cfn: cf },
    { g: new THREE.BoxGeometry(.6, .13, .13), m: mat4(0, .85, -.15, 1, 1, 1, 0, 0, .05), cfn: cf },
  ], 63);
}
function geoIronFence() {
  const iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R()), parts = [];
  for (let k = 0; k <= 8; k++) {
    const x = -1 + k * .25, h = k % 4 === 0 ? 1.55 : 1.3, w = k % 4 === 0 ? .1 : .035;
    parts.push({ g: new THREE.BoxGeometry(w, h, w), m: mat4(x, h / 2, 0, 1, 1, 1), cfn: iron, j: .05 });
    parts.push({ g: new THREE.ConeGeometry(w * 1.3, .16, 4), m: mat4(x, h + .07, 0, 1, 1, 1), cfn: iron, j: .05 });
  }
  for (const y of [.25, 1.1]) parts.push({ g: new THREE.BoxGeometry(2, .05, .05), m: mat4(0, y, 0, 1, 1, 1), cfn: iron, j: .05 });
  return makeGeo(parts, 64);
}
function geoLantern() {
  const iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R());
  return makeGeo([
    { g: new THREE.CylinderGeometry(.06, .08, 1.9, 6), m: mat4(0, .95, 0, 1, 1, 1), cfn: iron },
    { g: new THREE.BoxGeometry(.5, .05, .05), m: mat4(.22, 1.85, 0, 1, 1, 1), cfn: iron },
    { g: new THREE.BoxGeometry(.2, .26, .2), m: mat4(.42, 1.6, 0, 1, 1, 1), c: col(0xffd27a), glow: 2.2, j: .05 },
    { g: new THREE.ConeGeometry(.17, .14, 4), m: mat4(.42, 1.8, 0, 1, 1, 1, Math.PI / 4), cfn: iron },
  ], 65);
}
function geoMausoleum() {
  const cf = (y, ny, R, pr) => ny > .7 && R() < .2 ? mixc(col(0x4e6a34), col(0x6f8c46), R()) : mixc(col(0x6c6a66), col(0xa6a29a), clamp(pr * .4 + R() * .4, 0, 1));
  return makeGeo([
    { g: new THREE.BoxGeometry(2.8, .35, 3.2), m: mat4(0, .17, 0, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(2.2, 2.0, 2.6), m: mat4(0, 1.35, 0, 1, 1, 1), cfn: cf },
    { g: new THREE.CylinderGeometry(1.62, 1.62, 3.0, 3, 1, false, Math.PI), m: mat4(0, 2.62, 0, 1, 1, .55, 0, Math.PI / 2), cfn: cf },
    { g: new THREE.BoxGeometry(.8, 1.35, .06), m: mat4(0, 1.03, 1.31, 1, 1, 1), c: col(0x1c1a18), j: .03 },
    { g: halfDisc(.4, .06), m: mat4(0, 1.7, 1.31, 1, 1, 1, 0, Math.PI / 2), c: col(0x1c1a18), j: .03 },
    { g: new THREE.CylinderGeometry(.13, .15, 2, 8), m: mat4(-.75, 1.35, 1.38, 1, 1, 1), cfn: cf },
    { g: new THREE.CylinderGeometry(.13, .15, 2, 8), m: mat4(.75, 1.35, 1.38, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.12, .5, .12), m: mat4(0, 3.35, 0, 1, 1, 1), cfn: cf },
    { g: new THREE.BoxGeometry(.36, .1, .1), m: mat4(0, 3.45, 0, 1, 1, 1), cfn: cf },
  ], 66);
}
// ---------- shared colours for the biome parts
const WOOD_C = (y, ny, R) => mixc(col(0x5a3d22), col(0x8e6740), R());
const SANDSTONE = (y, ny, R, pr) => mixc(col(0xb08a58), col(0xe2c58e), clamp(pr * .5 + R() * .35 + (ny > .7 ? .12 : 0), 0, 1));
const CASTLE_C = (y, ny, R, pr) => mixc(col(0x6a6863), col(0xa5a29a), clamp(pr * .5 + R() * .35 + (ny > .7 ? .1 : 0), 0, 1));
const ICE_C = (y, ny, R) => mixc(col(0x8fd0ea), col(0xdff6ff), R() * .7 + (ny > .6 ? .3 : 0));
const BONE_C = (y, ny, R) => mixc(col(0xc9bfa5), col(0xeee6d0), R());
const DARK_C = (y, ny, R) => mixc(col(0x1d1820), col(0x3a2e40), R());
const LEAF_C = (y, ny, R) => mixc(col(0x2f7a2c), col(0x6aa83e), R());
// a frond: a chain of thin boxes that curls downward, along local +x after yaw a
function frond(parts, x0, y0, z0, a, L, w, segs, droop, cfn, lift = .15) {
  let x = x0, y = y0, z = z0;
  for (let s = 0; s < segs; s++) {
    const t = (s + .5) / segs, ang = lift - droop * t * t, len = L / segs;
    const cx = x + Math.cos(a) * Math.cos(ang) * len / 2, cz = z + Math.sin(a) * Math.cos(ang) * len / 2, cy = y + Math.sin(ang) * len / 2;
    parts.push({ g: new THREE.BoxGeometry(len * 1.06, .03, w * (1 - t * .55)), m: mat4(cx, cy, cz, 1, 1, 1, -a, 0, ang), cfn, j: .12 });
    x += Math.cos(a) * Math.cos(ang) * len; z += Math.sin(a) * Math.cos(ang) * len; y += Math.sin(ang) * len;
  }
}
// ---------- beach
function geoPalm() {
  const R = rng(71), parts = [], bark = (y, ny, Rr) => mixc(col(0x6b5236), col(0x9a7a52), Rr());
  let x = 0, y = 0;
  for (let k = 0; k < 8; k++) { const h = .58, bend = k * .065; parts.push({ g: new THREE.CylinderGeometry(.13 - k * .008, .16 - k * .008, h + .06, 7), m: mat4(x + Math.sin(bend) * h / 2, y + Math.cos(bend) * h / 2, 0, 1, 1, 1, 0, 0, -bend), cfn: bark, j: .1 }); x += Math.sin(bend) * h; y += Math.cos(bend) * h; }
  for (let k = 0; k < 9; k++) frond(parts, x, y, 0, k / 9 * 6.283 + R() * .3, 2.0 + R() * .5, .42, 4, 1.4, LEAF_C, .35);
  for (let k = 0; k < 3; k++) parts.push({ g: new THREE.IcosahedronGeometry(.11, 0), m: mat4(x + Math.cos(k * 2.1) * .15, y - .12, Math.sin(k * 2.1) * .15, 1, 1, 1), c: col(0x5a3e1e) });
  return makeGeo(parts, 71);
}
function geoRowboat() {
  const parts = [];
  parts.push({ g: new THREE.CylinderGeometry(.62, .62, 2.6, 12, 1, false, Math.PI, Math.PI), m: mat4(0, .42, 0, .55, 1, 1, 0, 0, Math.PI / 2), cfn: WOOD_C, j: .08 });
  for (const sx of [-1.2, 1.2]) parts.push({ g: new THREE.ConeGeometry(.35, .5, 6), m: mat4(sx, .32, 0, 1, .7, 1, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2), cfn: WOOD_C });
  for (const sx of [-.5, .4]) parts.push({ g: new THREE.BoxGeometry(.22, .05, 1.1), m: mat4(sx, .4, 0, 1, 1, 1), cfn: WOOD_C });
  parts.push({ g: new THREE.BoxGeometry(2.0, .03, .06), m: mat4(.1, .48, .35, 1, 1, 1, .3, 0, .08), cfn: WOOD_C });
  return makeGeo(parts, 72);
}
function geoDriftwood() {
  const pale = (y, ny, R) => mixc(col(0x9c9282), col(0xd1c8b6), R());
  return makeGeo([
    { g: displace(new THREE.CylinderGeometry(.16, .22, 2.4, 7, 3), .12, 2), m: mat4(0, .16, 0, 1, 1, 1, 0, 0, Math.PI / 2 + .05), cfn: pale },
    { g: new THREE.CylinderGeometry(.04, .08, .9, 5), m: mat4(.6, .35, .2, 1, 1, 1, 0, .7, -.5), cfn: pale },
    { g: new THREE.CylinderGeometry(.03, .06, .6, 5), m: mat4(-.7, .3, -.15, 1, 1, 1, 0, -.6, .6), cfn: pale },
  ], 73);
}
function geoShells() {
  const R = rng(74), parts = [];
  for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.18, .025, .045), m: mat4(Math.cos(k * 1.2566) * .08, .02, Math.sin(k * 1.2566) * .08, 1, 1, 1, -k * 1.2566), c: col(0xe8784a), j: .1 });
  for (let k = 0; k < 4; k++) parts.push({ g: new THREE.SphereGeometry(.06, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(.3 + R() * .4 - .2, 0, (R() - .5) * .5, 1, .5, 1.3, R() * 3), c: mixc(col(0xf1e3cf), col(0xf0b9a8), R()) });
  return makeGeo(parts, 74);
}
function geoLighthouse() {
  const parts = [], white = (y, ny, R) => mixc(col(0xe9e6e0), col(0xffffff), R() * .5), red = (y, ny, R) => mixc(col(0xa8302a), col(0xc8443a), R());
  parts.push({ g: displace(new THREE.CylinderGeometry(1.6, 1.8, .6, 10), .08, 2), m: mat4(0, .3, 0, 1, 1, 1), c: col(0x8a857c) });
  for (let k = 0; k < 4; k++) { const y0 = .6 + k * 1.6, r0 = 1.15 - k * .14, r1 = r0 - .14; parts.push({ g: new THREE.CylinderGeometry(r1, r0, 1.6, 14), m: mat4(0, y0 + .8, 0, 1, 1, 1), cfn: k % 2 ? red : white, j: .04 }); }
  parts.push({ g: new THREE.CylinderGeometry(.85, .85, .12, 14), m: mat4(0, 7.06, 0, 1, 1, 1), c: col(0x2c2c30) });
  parts.push({ g: new THREE.CylinderGeometry(.5, .5, .8, 10), m: mat4(0, 7.52, 0, 1, 1, 1), c: col(0xfff2b8), glow: 2.4 });
  parts.push({ g: new THREE.ConeGeometry(.65, .55, 10), m: mat4(0, 8.2, 0, 1, 1, 1), cfn: red });
  parts.push({ g: new THREE.BoxGeometry(.4, .7, .06), m: mat4(0, 1.0, 1.12, 1, 1, 1), c: col(0x3a2a1e) });
  return makeGeo(parts, 75);
}
// ---------- desert
function geoPyramid() {
  const parts = [];
  for (let k = 0; k < 6; k++) { const w = 8 - k * 1.25; parts.push({ g: displace(new THREE.BoxGeometry(w, .8, w, 3, 1, 3), .015, k), m: mat4(0, .4 + k * .8, 0, 1, 1, 1), cfn: SANDSTONE, j: .06 }); }
  parts.push({ g: new THREE.ConeGeometry(1.3, 1.2, 4), m: mat4(0, 5.4, 0, 1, 1, 1, Math.PI / 4), c: col(0xe8cf8e) });
  parts.push({ g: new THREE.BoxGeometry(1.0, 1.4, .1), m: mat4(0, .7, 4.0, 1, 1, 1), c: col(0x20180f), j: .02 });
  parts.push({ g: new THREE.BoxGeometry(1.4, .25, .6), m: mat4(0, 1.5, 4.0, 1, 1, 1), cfn: SANDSTONE });
  return makeGeo(parts, 76);
}
function geoObelisk() {
  const r = .3 * Math.SQRT2;
  return makeGeo([
    { g: new THREE.BoxGeometry(1.1, .4, 1.1), m: mat4(0, .2, 0, 1, 1, 1), cfn: SANDSTONE },
    { g: new THREE.CylinderGeometry(r * .75, r, 4, 4), m: mat4(0, 2.4, 0, 1, 1, 1, Math.PI / 4), cfn: SANDSTONE, j: .05 },
    { g: new THREE.ConeGeometry(r * .75, .55, 4), m: mat4(0, 4.67, 0, 1, 1, 1, Math.PI / 4), c: col(0xe8c460), j: .05 },
    { g: new THREE.BoxGeometry(.12, 2.8, .02), m: mat4(0, 2.3, .29, 1, 1, 1, 0, -.02), c: col(0x6a4e2a), j: .05 },
  ], 77);
}
function geoCactus() {
  const g = (y, ny, R) => mixc(col(0x3f7a3a), col(0x6aa058), R());
  const parts = [{ g: new THREE.CylinderGeometry(.22, .25, 2.6, 10), m: mat4(0, 1.3, 0, 1, 1, 1), cfn: g, j: .08 }, { g: new THREE.SphereGeometry(.22, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(0, 2.6, 0, 1, 1, 1), cfn: g }];
  for (const [sx, y0, h] of [[1, 1.0, .9], [-1, 1.35, .7]]) {
    parts.push({ g: new THREE.CylinderGeometry(.13, .13, .5, 8), m: mat4(sx * .38, y0, 0, 1, 1, 1, 0, 0, Math.PI / 2), cfn: g });
    parts.push({ g: new THREE.CylinderGeometry(.14, .14, h, 8), m: mat4(sx * .6, y0 + h / 2 - .05, 0, 1, 1, 1), cfn: g });
    parts.push({ g: new THREE.SphereGeometry(.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(sx * .6, y0 + h - .05, 0, 1, 1, 1), cfn: g });
  }
  return makeGeo(parts, 78);
}
function geoBarrelCactus() {
  const R = rng(79), parts = [];
  for (let k = 0; k < 3; k++) { const x = (R() - .5) * .6, z = (R() - .5) * .6, r = .18 + R() * .14; parts.push({ g: new THREE.SphereGeometry(r, 10, 6), m: mat4(x, r * .8, z, 1, 1.1, 1), cfn: (y, ny, Rr) => mixc(col(0x4f8a44), col(0x7aaa5a), Rr()), j: .1 }); parts.push({ g: new THREE.IcosahedronGeometry(.05, 0), m: mat4(x, r * 1.85, z, 1, .6, 1), c: R() < .5 ? col(0xf06aa0) : col(0xf6d040) }); }
  return makeGeo(parts, 79);
}
function geoBones() {
  const parts = [{ g: displace(new THREE.IcosahedronGeometry(.18, 1), .1, 3), m: mat4(.3, .14, .1, 1.2, .9, 1, .4), cfn: BONE_C }];
  parts.push({ g: new THREE.BoxGeometry(.08, .04, .05), m: mat4(.43, .14, .2, 1, 1, 1, .4), c: col(0x1a1612) });
  parts.push({ g: new THREE.BoxGeometry(.08, .04, .05), m: mat4(.36, .14, .28, 1, 1, 1, .4), c: col(0x1a1612) });
  for (let k = 0; k < 4; k++) parts.push({ g: new THREE.TorusGeometry(.32, .025, 4, 10, Math.PI * .9), m: mat4(-.3 + k * .17, .05, -.1, 1, 1, 1, Math.PI / 2, 0, 0), cfn: BONE_C });
  parts.push({ g: new THREE.CylinderGeometry(.035, .035, 1.0, 5), m: mat4(-.05, .05, -.1, 1, 1, 1, 0, 0, Math.PI / 2), cfn: BONE_C });
  return makeGeo(parts, 80);
}
// ---------- volcano
function geoLavaRock() {
  const R = rng(81), parts = [{ g: displace(new THREE.IcosahedronGeometry(.8, 1), .35, 4), m: mat4(0, .35, 0, 1.1, .62, .95, .3), cfn: (y, ny, Rr) => mixc(col(0x17120f), col(0x332822), Rr()), j: .1 }];
  for (let k = 0; k < 4; k++) parts.push({ g: new THREE.BoxGeometry(.7 + R() * .5, .03, .05), m: mat4((R() - .5) * .6, .72 + R() * .05, (R() - .5) * .6, 1, 1, 1, R() * 3, 0, (R() - .5) * .3), c: col(0xff7a1a), glow: 2.2 });
  return makeGeo(parts, 81);
}
function geoFumarole() {
  return makeGeo([
    { g: displace(new THREE.ConeGeometry(1.0, .9, 9, 2, true), .15, 3), m: mat4(0, .45, 0, 1, 1, 1), cfn: (y, ny, Rr) => mixc(col(0x2a201b), col(0x4a3a30), Rr()), j: .1 },
    { g: new THREE.CylinderGeometry(.32, .32, .05, 9), m: mat4(0, .78, 0, 1, 1, 1), c: col(0xff8a2a), glow: 2.6 },
    { g: displace(new THREE.IcosahedronGeometry(.3, 0), .3, 6), m: mat4(.8, .1, .3, 1, .5, 1), c: col(0xd8c060), j: .1 },
  ], 82);
}
function geoObsidian() {
  const R = rng(83), parts = [];
  for (let k = 0; k < 5; k++) { const a = k * 1.3 + R(), h = .6 + R() * 1.2; parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .25, h * .45, Math.sin(a) * .25, .16 + R() * .1, h * .5, .16 + R() * .1, a, Math.cos(a) * .3, Math.sin(a) * .3), cfn: (y, ny, Rr) => mixc(col(0x0d0a12), col(0x3a2a52), Rr()), j: .2 }); }
  return makeGeo(parts, 83);
}
// ---------- snow
function geoIceBlock() {
  const R = rng(84), parts = [];
  for (let k = 0; k < 3; k++) parts.push({ g: displace(new THREE.BoxGeometry(.9 + R() * .5, .7 + R() * .6, .8 + R() * .4), .12, k), m: mat4((R() - .5) * .9, .35 + R() * .2, (R() - .5) * .7, 1, 1, 1, R() * 3, (R() - .5) * .3, (R() - .5) * .3), cfn: ICE_C, j: .08, glow: .18 });
  return makeGeo(parts, 84);
}
function geoIceSpike() {
  const R = rng(85), parts = [];
  for (let k = 0; k < 5; k++) { const a = k * 1.25 + R(), h = 1 + R() * 1.6; parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .25, h * .45, Math.sin(a) * .25, .15 + R() * .1, h * .55, .15 + R() * .1, a, Math.cos(a) * .25, Math.sin(a) * .25), cfn: ICE_C, j: .1, glow: .25 }); }
  return makeGeo(parts, 85);
}
function geoSnowman() {
  const sn = (y, ny, R) => mixc(col(0xe6eef7), col(0xffffff), R());
  return makeGeo([
    { g: new THREE.IcosahedronGeometry(.5, 1), m: mat4(0, .45, 0, 1, 1, 1), cfn: sn }, { g: new THREE.IcosahedronGeometry(.37, 1), m: mat4(0, 1.12, 0, 1, 1, 1), cfn: sn },
    { g: new THREE.IcosahedronGeometry(.27, 1), m: mat4(0, 1.62, 0, 1, 1, 1), cfn: sn },
    { g: new THREE.ConeGeometry(.05, .3, 6), m: mat4(0, 1.62, .38, 1, 1, 1, 0, Math.PI / 2), c: col(0xf07a20) },
    { g: new THREE.CylinderGeometry(.2, .22, .3, 8), m: mat4(0, 1.95, 0, 1, 1, 1), c: col(0x2a2a30) },
    { g: new THREE.CylinderGeometry(.015, .02, .7, 4), m: mat4(.55, 1.25, 0, 1, 1, 1, 0, 0, -1.0), cfn: WOOD_C },
    { g: new THREE.CylinderGeometry(.015, .02, .7, 4), m: mat4(-.55, 1.25, 0, 1, 1, 1, 0, 0, 1.0), cfn: WOOD_C },
  ], 86);
}
function geoKamakura() {
  const sn = (y, ny, R) => mixc(col(0xdce6f0), col(0xffffff), R());
  return makeGeo([
    { g: new THREE.SphereGeometry(1.4, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(0, 0, 0, 1, .85, 1), cfn: sn, j: .05 },
    { g: new THREE.CylinderGeometry(.5, .5, .5, 10, 1, false, Math.PI / 2, Math.PI), m: mat4(0, .45, 1.3, 1, 1, 1, 0, Math.PI / 2), c: col(0x101418) },
    { g: new THREE.BoxGeometry(1.0, .45, .4), m: mat4(0, .22, 1.3, 1, 1, 1), c: col(0x101418) },
    { g: new THREE.BoxGeometry(.2, .2, .2), m: mat4(.2, .15, .6, 1, 1, 1), c: col(0xffb860), glow: 2.4 },
  ], 87);
}
// ---------- castle
function geoCastleWall() {
  const parts = [{ g: displace(new THREE.BoxGeometry(3, 2.8, 1, 3, 3, 1), .02, 1), m: mat4(0, 1.4, 0, 1, 1, 1), cfn: CASTLE_C, j: .08 }];
  for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.38, .45, 1.05), m: mat4(-1.31 + k * .655, 3.02, 0, 1, 1, 1), cfn: CASTLE_C });
  parts.push({ g: new THREE.BoxGeometry(3.05, .15, 1.15), m: mat4(0, 2.78, 0, 1, 1, 1), cfn: CASTLE_C });
  parts.push({ g: displace(new THREE.IcosahedronGeometry(.3, 0), .4, 2), m: mat4(.8, .1, .55, 1.4, .4, 1, .3), c: col(0x4e6a34), j: .1 });
  return makeGeo(parts, 88);
}
function geoTower() {
  const parts = [{ g: displace(new THREE.CylinderGeometry(1.1, 1.25, 5, 12, 4), .02, 3), m: mat4(0, 2.5, 0, 1, 1, 1), cfn: CASTLE_C, j: .06 }];
  parts.push({ g: new THREE.CylinderGeometry(1.3, 1.15, .3, 12), m: mat4(0, 5.15, 0, 1, 1, 1), cfn: CASTLE_C });
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; parts.push({ g: new THREE.BoxGeometry(.4, .45, .35), m: mat4(Math.cos(a) * 1.18, 5.52, Math.sin(a) * 1.18, 1, 1, 1, -a), cfn: CASTLE_C }); }
  parts.push({ g: new THREE.ConeGeometry(1.15, 1.9, 12), m: mat4(0, 6.5, 0, 1, 1, 1), c: col(0x3a4458), j: .08 });
  for (const [y, a] of [[2.2, .6], [3.6, 2.4], [3.0, 4.2]]) parts.push({ g: new THREE.BoxGeometry(.12, .5, .1), m: mat4(Math.cos(a) * 1.16, y, Math.sin(a) * 1.16, 1, 1, 1, -a + Math.PI / 2), c: col(0x14120f) });
  return makeGeo(parts, 89);
}
function geoGatehouse() {
  const parts = [], iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R());
  for (const sx of [-1.6, 1.6]) { parts.push({ g: displace(new THREE.BoxGeometry(1.2, 4.2, 1.4, 1, 3, 1), .02, sx), m: mat4(sx, 2.1, 0, 1, 1, 1), cfn: CASTLE_C, j: .07 }); for (let k = 0; k < 2; k++) parts.push({ g: new THREE.BoxGeometry(.4, .45, 1.45), m: mat4(sx - .3 + k * .6, 4.42, 0, 1, 1, 1), cfn: CASTLE_C }); }
  parts.push({ g: new THREE.BoxGeometry(2.1, 1.1, 1.2), m: mat4(0, 3.6, 0, 1, 1, 1), cfn: CASTLE_C });
  for (let k = 0; k < 7; k++) parts.push({ g: new THREE.BoxGeometry(.05, .75, .05), m: mat4(-.84 + k * .28, 2.68, .3, 1, 1, 1), cfn: iron });
  parts.push({ g: new THREE.BoxGeometry(1.9, .05, .05), m: mat4(0, 2.6, .3, 1, 1, 1), cfn: iron });
  return makeGeo(parts, 90);
}
function geoBanner() {
  return makeGeo([
    { g: new THREE.CylinderGeometry(.04, .05, 3.6, 6), m: mat4(0, 1.8, 0, 1, 1, 1), cfn: WOOD_C },
    { g: new THREE.SphereGeometry(.07, 6, 4), m: mat4(0, 3.65, 0, 1, 1, 1), c: col(0xd8b040) },
    { g: new THREE.BoxGeometry(.06, .06, .9), m: mat4(0, 3.4, .42, 1, 1, 1), cfn: WOOD_C },
    { g: new THREE.BoxGeometry(.02, 1.3, .8), m: mat4(0, 2.72, .45, 1, 1, 1), c: col(0x9a1e24), j: .05 },
    { g: new THREE.BoxGeometry(.03, .22, .22), m: mat4(.005, 2.9, .45, 1, 1, 1, 0, Math.PI / 4), c: col(0xe0b840), j: .05 },
  ], 91);
}
// ---------- demon world
function geoTwistTree() {
  const R = rng(92), parts = [];
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < 7; k++) { const h = .55, ax = Math.sin(k * 1.3) * .35, az = Math.cos(k * 1.7) * .35; parts.push({ g: new THREE.CylinderGeometry(.16 - k * .016, .2 - k * .016, h + .08, 6), m: mat4(x, y + h / 2, z, 1, 1, 1, k, ax, az), cfn: DARK_C, j: .1 }); x += Math.sin(az) * -h * .5; z += Math.sin(ax) * h * .5; y += h * .95; }
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + R(), L = .8 + R() * .7, y0 = 1.6 + R() * 2.2; parts.push({ g: new THREE.CylinderGeometry(.02, .06, L, 5), m: mat4(x * .6 + Math.cos(a) * L * .4, y0 + L * .2, z * .6 + Math.sin(a) * L * .4, 1, 1, 1, -a, 0, -Math.PI / 2.6), cfn: DARK_C });
    parts.push({ g: new THREE.IcosahedronGeometry(.09, 0), m: mat4(x * .6 + Math.cos(a) * L * .8, y0 + L * .32, z * .6 + Math.sin(a) * L * .8, 1, 1.2, 1), c: col(0xc050ff), glow: 2.2 }); }
  return makeGeo(parts, 92);
}
function geoMagicCircle() {
  const parts = [], glowC = () => col(0xb070ff);
  for (const [r, t] of [[1.5, .04], [1.15, .03], [.45, .025]]) parts.push({ g: new THREE.TorusGeometry(r, t, 3, 40), m: mat4(0, .04, 0, 1, 1, 1, 0, Math.PI / 2), c: glowC(), glow: 2 });
  for (let k = 0; k < 5; k++) { const a0 = k * 4 * Math.PI / 5 + Math.PI / 2, a1 = (k + 1) * 4 * Math.PI / 5 + Math.PI / 2, x0 = Math.cos(a0) * 1.15, z0 = Math.sin(a0) * 1.15, x1 = Math.cos(a1) * 1.15, z1 = Math.sin(a1) * 1.15, L = Math.hypot(x1 - x0, z1 - z0);
    parts.push({ g: new THREE.BoxGeometry(L, .02, .04), m: mat4((x0 + x1) / 2, .045, (z0 + z1) / 2, 1, 1, 1, -Math.atan2(z1 - z0, x1 - x0)), c: glowC(), glow: 2 }); }
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; parts.push({ g: new THREE.BoxGeometry(.12, .02, .06), m: mat4(Math.cos(a) * 1.33, .045, Math.sin(a) * 1.33, 1, 1, 1, -a + (k % 3) * .7), c: glowC(), glow: 1.6 }); }
  return makeGeo(parts, 93);
}
function geoDemonSpire() {
  const R = rng(94), parts = [];
  for (let k = 0; k < 4; k++) parts.push({ g: displace(new THREE.ConeGeometry(.75 - k * .16, 1.6, 6, 2), .2, k), m: mat4((R() - .5) * .15, .7 + k * 1.05, (R() - .5) * .15, 1, 1, 1, k * .7, (R() - .5) * .15), cfn: DARK_C, j: .1 });
  for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.035, .9, .035), m: mat4(Math.cos(k * 1.3) * (.45 - k * .06), .9 + k * .7, Math.sin(k * 1.3) * (.45 - k * .06), 1, 1, 1, 0, .15, .25), c: col(0xff3050), glow: 2.4 });
  return makeGeo(parts, 94);
}
function geoBonePile() {
  const R = rng(95), parts = [];
  for (let k = 0; k < 10; k++) parts.push({ g: new THREE.CylinderGeometry(.035, .035, .6 + R() * .5, 5), m: mat4((R() - .5) * .8, .05 + R() * .25, (R() - .5) * .8, 1, 1, 1, R() * 3, R() * 3, Math.PI / 2 + (R() - .5)), cfn: BONE_C });
  for (let k = 0; k < 2; k++) parts.push({ g: displace(new THREE.IcosahedronGeometry(.16, 1), .1, k), m: mat4((R() - .5) * .5, .3, (R() - .5) * .5, 1.2, .9, 1, R() * 3), cfn: BONE_C });
  return makeGeo(parts, 95);
}
// ---------- jungle / grassland
function geoFern() {
  const R = rng(96), parts = [];
  for (let k = 0; k < 10; k++) frond(parts, 0, .05, 0, k / 10 * 6.283 + R() * .3, .9 + R() * .4, .22, 4, 1.6, LEAF_C, .9);
  return makeGeo(parts, 96);
}
function geoBanana() {
  const R = rng(97), parts = [], st = (y, ny, Rr) => mixc(col(0x5a6a2c), col(0x8a9a4a), Rr());
  parts.push({ g: new THREE.CylinderGeometry(.16, .22, 2.4, 8), m: mat4(0, 1.2, 0, 1, 1, 1), cfn: st });
  for (let k = 0; k < 7; k++) frond(parts, 0, 2.3, 0, k / 7 * 6.283 + R() * .4, 1.6 + R() * .4, .55, 3, 1.1, LEAF_C, .7);
  for (let k = 0; k < 5; k++) parts.push({ g: new THREE.CylinderGeometry(.03, .04, .22, 5), m: mat4(.18 + Math.cos(k) * .06, 1.9 - k * .05, Math.sin(k) * .06, 1, 1, 1, 0, .3, -.5), c: col(0xd8c040) });
  return makeGeo(parts, 97);
}
function geoWoodFence() {
  const parts = [];
  for (let k = 0; k < 3; k++) parts.push({ g: new THREE.BoxGeometry(.12, 1.0, .12), m: mat4(-.9 + k * .9, .5, 0, 1, 1, 1, (k - 1) * .05), cfn: WOOD_C });
  for (const y of [.35, .75]) parts.push({ g: new THREE.BoxGeometry(2.0, .1, .05), m: mat4(0, y, .07, 1, 1, 1, 0, 0, (y - .5) * .05), cfn: WOOD_C });
  return makeGeo(parts, 98);
}
function geoHaystack() {
  const hay = (y, ny, R) => mixc(col(0xb08a3a), col(0xe0c470), R());
  return makeGeo([{ g: displace(new THREE.CylinderGeometry(.75, .8, .9, 12, 2), .06, 3), m: mat4(0, .45, 0, 1, 1, 1), cfn: hay }, { g: displace(new THREE.ConeGeometry(.82, .8, 12, 2), .06, 5), m: mat4(0, 1.3, 0, 1, 1, 1), cfn: hay }], 99);
}
function geoBush() {
  const parts = [];
  const cf = (y, ny, R) => R() < .012 ? (R() < .7 ? col(0xc9aa36) : col(0xb8b29e)) : mixc(col(0x2a5c24), col(0x4f8a2e), R());
  [[0, .45, 0, .65], [.5, .35, .2, .5], [-.45, .32, -.15, .48], [.1, .3, -.5, .42]]
    .forEach(([x, y, z, r], k) => parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 1), .3, k * 5.3), m: mat4(x, y, z, r, r * .8, r), cfn: cf, j: .15 }));
  return makeGeo(parts, 14);
}
const PROP = [
  { id: 'pine', name: '針葉樹', geo: geoPine(), r: .45, min: 1.7, sc: [.8, 1.4], slope: .9, vis: 1.5, tree: true },
  { id: 'oak', name: '広葉樹', geo: geoOak(), r: .6, min: 3.2, sc: [.8, 1.3], slope: .8, vis: 2.1, tree: true },
  { id: 'rock', name: '岩', geo: geoRock(), r: .8, min: 1.4, sc: [.6, 1.9], slope: 4, vis: 1.2, anyGround: true },
  { id: 'bush', name: '茂み', geo: geoBush(), r: 0, min: 1.0, sc: [.7, 1.5], slope: .8, vis: .9 },
  { id: 'cliff', name: '崖石', geo: geoCliff(), r: .6, min: 1.0, sc: [.9, 1.2], slope: 9, vis: 1.25, anyGround: true },
  { id: 'pebble', name: '小石', geo: geoPebble(), r: 0, min: .45, sc: [.6, 1.6], slope: 3, vis: .4, anyGround: true },
  { id: 'reed', name: '葦', geo: geoReed(), r: 0, min: .7, sc: [.8, 1.3], slope: .7, vis: .5, anyGround: true },
  { id: 'log', name: '倒木', geo: geoLog(), r: .5, offs: [-1.1, 0, 1.1], min: 2.6, sc: [.8, 1.2], slope: .6, vis: 1.7 },
  { id: 'stump', name: '切り株', geo: geoStump(), r: .45, min: 1.2, sc: [.8, 1.3], slope: .7, vis: .6 },
  { id: 'deadtree', name: '枯れ木', geo: geoDeadTree(), r: .3, min: 2.4, sc: [.8, 1.3], slope: .8, vis: 1.1, anyGround: true },
  { id: 'flowers', name: '花', geo: geoFlowers(), r: 0, min: .6, sc: [.8, 1.4], slope: .8, vis: .45 },
  { id: 'mushroom', name: 'きのこ', geo: geoMushroom(), r: 0, min: .5, sc: [.8, 1.5], slope: .9, vis: .3, anyGround: true },
  { id: 'stalagmite', name: '石筍', geo: geoStalagmite(), r: .5, min: 1.6, sc: [.7, 1.4], slope: 1.2, vis: 1, anyGround: true },
  { id: 'crystal', name: '水晶', geo: geoCrystal(), r: .35, min: 1.2, sc: [.7, 1.5], slope: 1.2, vis: .6, anyGround: true, light: [0x7fd8ff, 14, .8] },
  { id: 'glowmush', name: '光るきのこ', geo: geoGlowMush(), r: 0, min: .6, sc: [.8, 1.6], slope: 1, vis: .4, anyGround: true, light: [0x6fffd8, 6, .4] },
  { id: 'torch', name: '松明', geo: geoTorch(), r: .15, min: 2, sc: [1, 1], slope: .8, vis: .3, anyGround: true, light: [0xff9a40, 26, 1.9] },
  { id: 'column', name: '石柱', geo: geoColumn(), r: .5, min: 2.2, sc: [.85, 1.15], slope: .5, vis: .6, anyGround: true },
  { id: 'brokencol', name: '折れた石柱', geo: geoBrokenCol(), r: .5, min: 2, sc: [.8, 1.2], slope: .6, vis: 1, anyGround: true },
  { id: 'ruinwall', name: '崩れた壁', geo: geoRuinWall(), r: .4, offs: [-1.2, -.4, .4, 1.2], min: 3.2, sc: [.85, 1.15], slope: .5, vis: 1.6, anyGround: true },
  { id: 'archgate', name: 'アーチ門', geo: geoArchGate(), r: .45, offs: [-1.25, 1.25], min: 4, sc: [.9, 1.1], slope: .4, vis: 1.9, anyGround: true },
  { id: 'statue', name: '石像', geo: geoStatue(), r: .6, min: 2.5, sc: [.9, 1.2], slope: .4, vis: .7, anyGround: true },
  { id: 'stele', name: '石碑', geo: geoStele(), r: .4, min: 1.6, sc: [.8, 1.2], slope: .6, vis: .6, anyGround: true },
  { id: 'rubblepile', name: '瓦礫の山', geo: geoRubblePile(), r: .55, min: 1.6, sc: [.7, 1.3], slope: 1, vis: .9, anyGround: true },
  { id: 'gravestone', name: '墓石', geo: geoGrave(), r: .3, min: 1.1, sc: [.8, 1.2], slope: .5, vis: .45, anyGround: true },
  { id: 'crossgrave', name: '十字の墓', geo: geoCrossGrave(), r: .3, min: 1.2, sc: [.8, 1.2], slope: .5, vis: .5, anyGround: true },
  { id: 'ironfence', name: '鉄柵', geo: geoIronFence(), r: .12, offs: [-.8, 0, .8], min: 2.1, sc: [1, 1], slope: .5, vis: 1.1, anyGround: true },
  { id: 'lantern', name: 'ランタン', geo: geoLantern(), r: .15, min: 2.5, sc: [1, 1], slope: .6, vis: .4, anyGround: true, light: [0xffc070, 20, 1.6] },
  { id: 'palm', name: 'ヤシ', geo: geoPalm(), r: .35, min: 2.6, sc: [.8, 1.25], slope: .7, vis: 2, anyGround: true, sway: 1 },
  { id: 'rowboat', name: '小舟', geo: geoRowboat(), r: .55, offs: [-.8, 0, .8], min: 3, sc: [.9, 1.1], slope: .6, vis: 1.3, anyGround: true },
  { id: 'driftwood', name: '流木', geo: geoDriftwood(), r: .3, offs: [-.8, .8], min: 2, sc: [.8, 1.2], slope: .7, vis: 1.2, anyGround: true },
  { id: 'shells', name: '貝殻・ヒトデ', geo: geoShells(), r: 0, min: .6, sc: [.8, 1.6], slope: .7, vis: .35, anyGround: true },
  { id: 'lighthouse', name: '灯台', geo: geoLighthouse(), r: 1.5, min: 6, sc: [.9, 1.1], slope: .4, vis: 1.8, anyGround: true, light: [0xfff0c0, 60, 7.5] },
  { id: 'pyramid', name: 'ピラミッド', geo: geoPyramid(), r: 4, min: 10, sc: [.8, 1.2], slope: .4, vis: 4.5, anyGround: true },
  { id: 'obelisk', name: 'オベリスク', geo: geoObelisk(), r: .5, min: 2.5, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true },
  { id: 'cactus', name: 'サボテン', geo: geoCactus(), r: .3, min: 1.8, sc: [.7, 1.3], slope: .7, vis: .8, anyGround: true },
  { id: 'barrelcactus', name: '丸サボテン', geo: geoBarrelCactus(), r: 0, min: .8, sc: [.8, 1.5], slope: .8, vis: .5, anyGround: true },
  { id: 'bones', name: '骨', geo: geoBones(), r: 0, min: 1, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true },
  { id: 'lavarock', name: '溶岩岩', geo: geoLavaRock(), r: .7, min: 1.8, sc: [.6, 1.6], slope: 2, vis: 1, anyGround: true, light: [0xff6a20, 8, .9] },
  { id: 'fumarole', name: '噴気孔', geo: geoFumarole(), r: .6, min: 2.5, sc: [.8, 1.3], slope: .8, vis: 1, anyGround: true, light: [0xff7a2a, 14, 1.2] },
  { id: 'obsidian', name: '黒曜石', geo: geoObsidian(), r: .4, min: 1.4, sc: [.7, 1.4], slope: 1.2, vis: .6, anyGround: true },
  { id: 'iceblock', name: '氷塊', geo: geoIceBlock(), r: .7, min: 2, sc: [.7, 1.5], slope: 1.2, vis: 1, anyGround: true },
  { id: 'icespike', name: '氷柱', geo: geoIceSpike(), r: .4, min: 1.5, sc: [.7, 1.5], slope: 1.2, vis: .6, anyGround: true },
  { id: 'snowman', name: '雪だるま', geo: geoSnowman(), r: .4, min: 2, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true },
  { id: 'kamakura', name: 'かまくら', geo: geoKamakura(), r: 1.3, min: 4, sc: [.9, 1.1], slope: .3, vis: 1.5, anyGround: true, light: [0xffb060, 10, .4] },
  { id: 'castlewall', name: '城壁', geo: geoCastleWall(), r: .55, offs: [-1.1, 0, 1.1], min: 3.2, sc: [.9, 1.1], slope: .4, vis: 1.6, anyGround: true },
  { id: 'tower', name: '塔', geo: geoTower(), r: 1.3, min: 4, sc: [.9, 1.15], slope: .4, vis: 1.3, anyGround: true },
  { id: 'gatehouse', name: '城門', geo: geoGatehouse(), r: .75, offs: [-1.6, 1.6], min: 5, sc: [.9, 1.1], slope: .3, vis: 2.2, anyGround: true },
  { id: 'banner', name: '旗', geo: geoBanner(), r: .1, min: 2, sc: [.9, 1.1], slope: .6, vis: .5, anyGround: true, sway: .5 },
  { id: 'twisttree', name: '異形の木', geo: geoTwistTree(), r: .35, min: 2.4, sc: [.8, 1.3], slope: .8, vis: 1.3, anyGround: true, light: [0xb050ff, 6, 2.5] },
  { id: 'magiccircle', name: '魔法陣', geo: geoMagicCircle(), r: 0, min: 4, sc: [.8, 1.3], slope: .25, vis: 1.6, anyGround: true, light: [0xa060ff, 16, .5] },
  { id: 'demonspire', name: '魔界の尖塔', geo: geoDemonSpire(), r: .6, min: 2.5, sc: [.8, 1.4], slope: .8, vis: .8, anyGround: true, light: [0xff3050, 8, 2] },
  { id: 'bonepile', name: '骨の山', geo: geoBonePile(), r: .35, min: 1.4, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true },
  { id: 'fern', name: 'シダ', geo: geoFern(), r: 0, min: 1, sc: [.8, 1.5], slope: .8, vis: .8, sway: .6 },
  { id: 'banana', name: 'バナナの木', geo: geoBanana(), r: .3, min: 2.6, sc: [.8, 1.2], slope: .7, vis: 1.6, tree: true, sway: 1 },
  { id: 'woodfence', name: '木の柵', geo: geoWoodFence(), r: .1, offs: [-.8, 0, .8], min: 2.1, sc: [1, 1], slope: .5, vis: 1.1, anyGround: true },
  { id: 'haystack', name: '干し草', geo: geoHaystack(), r: .7, min: 2, sc: [.8, 1.2], slope: .5, vis: .8 },
  { id: 'mausoleum', name: '霊廟', geo: geoMausoleum(), r: 1.5, min: 4.5, sc: [.9, 1.1], slope: .3, vis: 1.9, anyGround: true },
];
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, flatShading: true });
const heroMat = propMat.clone();
heroMat.transparent = true;   // lets it be drawn last, on top of rock, while inside a tunnel
const propShader = (sh) => {
  sh.uniforms.uDim = dimU; sh.uniforms.uTime = timeU; Object.assign(sh.uniforms, BU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vPY; attribute float glow; varying float vGlow; attribute float sway; uniform vec3 uWind; uniform float uTime;\n#ifdef MOSS\nattribute float cliffI; varying float vCI;\n#endif')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vGlow=glow;
#ifdef MOSS
vCI=cliffI;
#endif
#ifdef USE_INSTANCING
if(sway>0.&&uWind.z>0.){
  // bend along the world wind direction, more toward the top, with gusts
  mat3 im=mat3(instanceMatrix); vec3 ip=instanceMatrix[3].xyz;
  float hk=pow(max(transformed.y,0.)/3.,1.5)*sway;
  float gust=.55+.45*sin(uTime*(1.2+uWind.z*1.5)+ip.x*.35+ip.z*.27)+.15*sin(uTime*4.1+ip.x);
  vec3 wo=vec3(uWind.x,0.,uWind.y)*uWind.z*hk*gust*.45;
  transformed+=transpose(im)*wo/dot(im[0],im[0]);
}
#endif
vec4 pw4=vec4(transformed,1.);
#ifdef USE_INSTANCING
pw4=instanceMatrix*pw4;
#endif
vPY=(modelMatrix*pw4).y;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uDim; uniform float uTime; varying float vGlow; uniform vec3 uPropTint; uniform vec3 uMoss; uniform float uMossAmt; uniform float uSnow; uniform float uSnowLine; varying float vPY;\nuniform vec3 uCSTint[7]; uniform vec4 uCSMoss[7]; uniform vec2 uCSWet[7];\n#ifdef MOSS\nvarying float vCI;\n#endif\n' + DIM_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef MOSS
float mg=diffuseColor.g-max(diffuseColor.r,diffuseColor.b);
int ci=int(vCI+.5); vec4 cm=uCSMoss[ci]; vec2 cw=uCSWet[ci];
vec3 mossC=mix(uMoss,cm.rgb,cm.a);
diffuseColor.rgb=mix(diffuseColor.rgb, mossC*(.8+.5*dot(diffuseColor.rgb,vec3(.33))), max(uMossAmt,cm.a)*smoothstep(.0,.05,mg));
diffuseColor.rgb*=uCSTint[ci]*(1.-.3*cw.x);
#endif
diffuseColor.rgb=dimc(diffuseColor.rgb*uPropTint);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
float upw=dot(normal, normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz));
diffuseColor.rgb=mix(diffuseColor.rgb, dimc(vec3(.92,.95,1.)), uSnow*smoothstep(.45,.8,upw)*smoothstep(uSnowLine-.3,uSnowLine+.5,vPY)*(1.-step(.01,vGlow)));
#ifdef MOSS
diffuseColor.rgb=mix(diffuseColor.rgb, dimc(vec3(.93,.95,1.)), uCSWet[int(vCI+.5)].y*smoothstep(.5,.85,upw));
#endif`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef MOSS\nroughnessFactor*=1.-.6*uCSWet[int(vCI+.5)].x;\n#endif')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vGlow*(.85+.15*sin(uTime*9.+vPY*13.))*(1.-.5*uDim);');
};
propMat.onBeforeCompile = propShader; propMat.customProgramCacheKey = () => 'prop-dim-v6';
// rocks and cliff stones get their moss recoloured per biome (sand, ash, snow...)
const rockMat = propMat.clone(); rockMat.defines = { MOSS: '' };
rockMat.onBeforeCompile = propShader; rockMat.customProgramCacheKey = () => 'prop-dim-v6-moss';
const CAP = 8000;
const propMeshes = PROP.map(t => {
  const m = new THREE.InstancedMesh(t.geo, ['rock', 'cliff', 'pebble'].includes(t.id) ? rockMat : propMat, CAP);
  m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  if (m.material === rockMat) { m.userData.cliffI = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1); t.geo.setAttribute('cliffI', m.userData.cliffI); }
  scene.add(m); return m;
});
const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, flatShading: true, transparent: true, opacity: .28, depthWrite: false });
const ghostMeshes = PROP.map(t => {
  const m = new THREE.InstancedMesh(t.geo, ghostMat, 256);
  m.frustumCulled = false; m.count = 0; m.renderOrder = 8;
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(256 * 3), 3);
  scene.add(m); return m;
});
let ghosts = new Set();   // props currently faded because the player is inside them
const VIS_R = PROP.map(t => t.vis);
// 'common' parts appear under every biome in the palette
const PTAGS = {
  pine: ['forest', 'mountain', 'canyon', 'snow', 'castle', 'graveyard'], oak: ['grassland', 'forest', 'jungle', 'ruins', 'beach'],
  rock: ['common'], bush: ['grassland', 'forest', 'jungle', 'canyon', 'ruins', 'castle', 'beach'], cliff: ['common'], pebble: ['common'],
  reed: ['grassland', 'forest', 'jungle', 'beach'], log: ['grassland', 'forest', 'jungle'], stump: ['grassland', 'forest', 'ruins', 'castle'],
  deadtree: ['wasteland', 'desert', 'volcano', 'castle', 'snow', 'demon', 'ruins', 'graveyard'], flowers: ['grassland', 'forest', 'ruins'],
  mushroom: ['forest', 'jungle', 'cave', 'demon', 'graveyard'],
  stalagmite: ['cave', 'volcano', 'mountain'], crystal: ['cave', 'demon'], glowmush: ['cave', 'jungle', 'demon'], torch: ['cave', 'castle', 'ruins', 'graveyard'],
  column: ['ruins', 'castle', 'desert'], brokencol: ['ruins', 'desert', 'graveyard'], ruinwall: ['ruins', 'castle', 'graveyard'], archgate: ['ruins', 'castle'],
  statue: ['ruins', 'castle', 'graveyard'], stele: ['ruins', 'desert', 'graveyard'], rubblepile: ['ruins', 'castle', 'desert', 'graveyard'],
  palm: ['beach', 'jungle'], rowboat: ['beach'], driftwood: ['beach'], shells: ['beach'], lighthouse: ['beach'],
  pyramid: ['desert'], obelisk: ['desert', 'ruins'], cactus: ['desert', 'wasteland', 'canyon'], barrelcactus: ['desert', 'wasteland'], bones: ['desert', 'wasteland', 'demon', 'graveyard'],
  lavarock: ['volcano', 'demon'], fumarole: ['volcano'], obsidian: ['volcano', 'demon', 'cave'],
  iceblock: ['snow', 'mountain'], icespike: ['snow', 'cave'], snowman: ['snow'], kamakura: ['snow'],
  castlewall: ['castle', 'ruins'], tower: ['castle'], gatehouse: ['castle'], banner: ['castle'],
  twisttree: ['demon', 'graveyard'], magiccircle: ['demon', 'ruins', 'cave'], demonspire: ['demon'], bonepile: ['demon', 'graveyard', 'cave'],
  fern: ['jungle', 'forest'], banana: ['jungle'], woodfence: ['grassland', 'forest'], haystack: ['grassland'],
  gravestone: ['graveyard'], crossgrave: ['graveyard'], ironfence: ['graveyard', 'castle'], lantern: ['graveyard', 'castle'], mausoleum: ['graveyard'],
};
PROP.forEach(t => { t.tags = PTAGS[t.id] || ['common']; });
const SWAY = { pine: .6, oak: .5, bush: .5, reed: 1, flowers: .8, deadtree: .2 };
for (const t of PROP) {
  const sw = t.sway ?? SWAY[t.id] ?? 0;
  if (sw) t.geo.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(t.geo.attributes.position.count).fill(sw), 1));
}   // visual footprint per prop type (x scale)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
// a small pool of real lights follows the glowing parts nearest to the view
const glowLights = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xffaa55, 0, 10, 1.7); l.userData.base = 0; scene.add(l); return l; });
let glowTick = 0;
function updateGlowLights(cx, cz) {
  const cand = [];
  for (const p of props) { const L = PROP[p[0]].light; if (!L) continue; const d = (p[1] - cx) ** 2 + (p[2] - cz) ** 2; if (d < 1600) cand.push([d, p]); }
  cand.sort((a, b) => a[0] - b[0]);
  glowLights.forEach((l, k) => {
    const c = cand[k]; if (!c) { l.userData.base = 0; l.intensity = 0; return; }
    const p = c[1], L = PROP[p[0]].light;
    l.color.setHex(L[0]); l.userData.base = L[1] * p[4]; l.position.set(p[1], heightAt(p[1], p[2]) + L[2] * p[4], p[2]);
  });
}
function rebuildProps(visualOnly = false) {
  glowTick = 0;
  const cnt = PROP.map(() => 0), gcnt = PROP.map(() => 0);
  for (const p of props) {
    const [t, x, z, r, s] = p, sy = p[6] ?? 1, by = p[7] ?? null, ghost = ghosts.has(p) && gcnt[t] < 256;
    const mesh = ghost ? ghostMeshes[t] : propMeshes[t], c = ghost ? gcnt : cnt;
    if (c[t] >= CAP) continue;
    _p.set(x, by ?? heightAt(x, z) - (t === 2 ? .12 * s : .05), z); _q.setFromAxisAngle(_up, r); _s.set(s, s * sy, s);
    mesh.setMatrixAt(c[t], _m.compose(_p, _q, _s));
    const v = .86 + .28 * hash2(x * 97 | 0, z * 89 | 0);
    mesh.setColorAt(c[t], _c.setRGB(v * (.95 + .1 * hash2(x * 13 | 0, 7)), v, v * (.95 + .1 * hash2(3, z * 17 | 0))));
    if (!ghost && mesh.userData.cliffI) mesh.userData.cliffI.array[c[t]] = cliffIndexNear(x, z);
    c[t]++;
  }
  propMeshes.forEach((m, t) => { m.count = cnt[t]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; if (m.userData.cliffI) m.userData.cliffI.needsUpdate = true; });
  ghostMeshes.forEach((m, t) => { m.count = gcnt[t]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
  if (!visualOnly) { colliders = null; walkDirty = true; }
}

// ============================================================
// Atmosphere (fog / miasma)
// ============================================================
const ATMOS = {
  none: { name: 'なし' },
  mist: { name: '霧', color: [.80, .84, .90], fogMul: .45, speed: .15, swirl: .2 },
  morning: { name: '朝もや', color: [1.0, .93, .82], fogMul: .7, speed: .08, swirl: .15 },
  miasma: { name: '瘴気', color: [.55, .22, .70], fogMul: .6, speed: .35, swirl: 1, motes: [.85, .45, 1.0], add: true },
  poison: { name: '毒霧', color: [.45, .75, .25], fogMul: .6, speed: .3, swirl: .8, motes: [.6, 1.0, .3], add: true },
  ash: { name: '火山灰', color: [.42, .36, .33], fogMul: .5, speed: .25, swirl: .5, motes: [1.0, .5, .15], add: true },
  dust: { name: '砂塵', color: [.85, .72, .52], fogMul: .55, speed: .6, swirl: .3, motes: [.95, .85, .65] },
  spores: { name: '胞子', color: [.40, .55, .65], fogMul: .75, speed: .12, swirl: .4, motes: [.5, 1.0, .9], add: true },
};
// ground height (incl. water surface) as a half-float texture, so the fog can hug the terrain
const hData = new Uint16Array(N * N);
const hTex = new THREE.DataTexture(hData, N, N, THREE.RedFormat, THREE.HalfFloatType);
hTex.magFilter = hTex.minFilter = THREE.LinearFilter; hTex.needsUpdate = true;
const AU = { uHT: { value: hTex }, uACol: { value: new THREE.Color() }, uAAmount: { value: 0 }, uAHeight: { value: 3 }, uASpeed: { value: .2 }, uASwirl: { value: .3 }, uSpacing: { value: 1 }, uMote: { value: new THREE.Color() } };
const HT_GLSL = `uniform sampler2D uHT; float groundH(vec2 xz){ return texture2D(uHT, ((xz+${HALF}.)/${SIZE}.*${N - 1}.+.5)/${N}.).r; }`;
const fogMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: timeU, uDim: dimU, ...AU },
  vertexShader: `varying vec3 vP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uTime; uniform float uDim; uniform vec3 uACol; uniform float uAAmount; uniform float uAHeight; uniform float uASpeed; uniform float uASwirl; uniform float uSpacing; varying vec3 vP;
    ${GLSL_NOISE}
    ${HT_GLSL}
    void main(){
      float above=vP.y-groundH(vP.xz);
      if(above<0.||above>uAHeight) discard;
      float t=uTime*uASpeed;
      vec2 q=vP.xz*.09+vec2(t,t*.6);
      q+=uASwirl*vec2(vn(q*1.7+vP.y*.3+t), vn(q*1.7-t+3.))*1.2;
      float n=(vn(q)*.62+vn(q*2.03+17.1)*.38)*1.25+vn(vP.xz*.35-t*1.6)*.35-.32;
      float prof=pow(1.-above/uAHeight,1.3)*smoothstep(0.,.25,above);
      vec2 e=abs(vP.xz)/${HALF}.;
      float a=clamp(n,0.,1.)*prof*uAAmount*uSpacing/uAHeight*2.6*smoothstep(1.,.93,max(e.x,e.y));
      gl_FragColor=vec4(pow(uACol*(.8+.4*n),vec3(2.2)), a*(1.-.75*uDim));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const FOG_LAYERS = 14, fogGroup = new THREE.Group(); scene.add(fogGroup);
for (let i = 0; i < FOG_LAYERS; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), fogMat); m.rotation.x = -Math.PI / 2; m.renderOrder = 6; fogGroup.add(m); }
const MOTES = 1000, moteGeo = new THREE.BufferGeometry();
{
  const R = rng(99), sd = new Float32Array(MOTES * 4);
  for (let k = 0; k < MOTES; k++) { sd[k * 4] = (R() - .5) * (SIZE - 2); sd[k * 4 + 1] = (R() - .5) * (SIZE - 2); sd[k * 4 + 2] = R(); sd[k * 4 + 3] = R(); }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  moteGeo.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
  moteGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SIZE);
}
const moteMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uDim: dimU, ...AU },
  vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uAHeight; uniform float uASpeed; varying float vA;
    ${HT_GLSL}
    void main(){
      float t=uTime*(.05+uASpeed*.25)+seed.z*7.;
      vec2 xz=seed.xy+vec2(sin(t*1.3+seed.w*9.),cos(t+seed.z*5.))*1.5;
      float ph=fract(seed.w+uTime*.03*(.5+seed.z));
      vec3 p=vec3(xz, groundH(xz)+ph*uAHeight*1.4+.1);
      vA=sin(ph*3.1416);
      vec4 mv=viewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=min(7.,(1.+seed.z*1.6)*(110./-mv.z));
    }`,
  fragmentShader: `uniform vec3 uMote; uniform float uAAmount; uniform float uDim; varying float vA;
    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      gl_FragColor=vec4(pow(uMote,vec3(2.2))*1.4, smoothstep(.5,.0,d)*vA*min(1.,uAAmount*1.4)*(1.-.75*uDim));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const motes = new THREE.Points(moteGeo, moteMat); motes.renderOrder = 7; motes.frustumCulled = false; scene.add(motes);
function updateAtmoHeights() {
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k < N * N; k++) { const h = Math.max(H[k], state.water); hData[k] = THREE.DataUtils.toHalfFloat(h); mn = Math.min(mn, h); mx = Math.max(mx, h); }
  hTex.needsUpdate = true;
  const top = mx + state.atmo.height, sp = (top - mn) / FOG_LAYERS;
  fogGroup.children.forEach((m, i) => { m.position.y = mn + (i + .5) * sp; });
  AU.uSpacing.value = sp;
}
function applyAtmo() {
  const A = ATMOS[state.atmo.kind] || ATMOS.none, on = state.atmo.kind !== 'none', B = BIOME();
  fogGroup.visible = on; motes.visible = on && !!A.motes;
  const baseFog = new THREE.Color(B.fog ?? B.bg);
  scene.fog.color.copy(baseFog); scene.fog.near = (B.fogNear ?? 140) * FOG_K; scene.fog.far = (B.fogFar ?? 280) * FOG_K;
  if (on) {
    const k = state.atmo.amount;
    AU.uACol.value.setRGB(...A.color); AU.uAAmount.value = k; AU.uAHeight.value = state.atmo.height; AU.uASpeed.value = A.speed; AU.uASwirl.value = A.swirl;
    if (A.motes) { AU.uMote.value.setRGB(...A.motes); moteMat.blending = A.add ? THREE.AdditiveBlending : THREE.NormalBlending; moteMat.needsUpdate = true; }
    scene.fog.color.lerp(new THREE.Color().setRGB(A.color[0] * .45, A.color[1] * .45, A.color[2] * .45), k * .6);
    scene.fog.near *= 1 - k * (1 - A.fogMul); scene.fog.far *= 1 - k * (1 - A.fogMul) * .7;
  }
  updateAtmoHeights();
  applyWeather();
  if ($('atmoKind')) { $('atmoKind').value = state.atmo.kind; $('atmoAmount').value = state.atmo.amount; $('atmoAmountV').textContent = state.atmo.amount.toFixed(2); $('atmoHeight').value = state.atmo.height; $('atmoHeightV').textContent = state.atmo.height.toFixed(1) + 'm'; }
}

// ============================================================
// Weather: wind, rain, snow, sand, sparkles and fireflies around the view
// ============================================================
const WIND_DIR = new THREE.Vector2(1, .4).normalize();
const WEATHER = {
  none: { name: 'なし' },
  breeze: { name: 'そよ風', wind: .35, pts: { n: 160, color: [.55, .75, .3], size: 3, fall: .4, wind: 2.5, wobble: 1.2 } },
  gale: { name: '強風', wind: 1, pts: { n: 700, color: [.5, .7, .3], size: 3.5, fall: .8, wind: 11, wobble: 2 }, light: .9 },
  rain: { name: '雨', wind: .3, rain: { n: 2600, speed: 20, len: .9, wind: 2 }, light: .7, wet: .75 },
  storm: { name: '暴風雨', wind: 1.1, rain: { n: 7000, speed: 28, len: 1.3, wind: 9 }, light: .45, wet: 1, lightning: true, fogNear: .55, fogColor: [.25, .28, .33] },
  snow: { name: '雪', wind: .2, pts: { n: 2600, color: [1, 1, 1], size: 3, fall: 1.3, wind: .9, wobble: 1.2 }, light: .9, cover: .7 },
  blizzard: { name: '吹雪', wind: 1, pts: { n: 8000, color: [.95, .97, 1], size: 3.2, fall: 2.6, wind: 13, wobble: 2 }, light: .75, cover: 1, fogNear: .3, fogColor: [.80, .84, .92], veil: { color: [.88, .91, .97], alpha: .42, streak: .8 } },
  diamond: { name: 'ダイヤモンドダスト', wind: .05, pts: { n: 1800, color: [.85, .95, 1], size: 2.6, fall: .25, wind: .4, wobble: .6, twinkle: true, add: true }, light: 1.05 },
  sandstorm: { name: '砂嵐', wind: 1, pts: { n: 8000, color: [.85, .68, .45], size: 3, fall: .3, wind: 15, wobble: 1.5 }, light: .65, fogNear: .28, fogColor: [.62, .48, .32], veil: { color: [.80, .62, .40], alpha: .62, streak: 1.3 } },
  fireflies: { name: '蛍', pts: { n: 420, color: [.75, 1, .35], size: 4.5, fall: 0, wind: .15, wobble: 1.6, twinkle: true, add: true, hug: true }, light: .45 },
};
const WU = {
  uCenter: { value: new THREE.Vector3() }, uWindDir: { value: WIND_DIR }, uFall: { value: 1 }, uWindAmt: { value: 0 }, uWobble: { value: 1 }, uSize: { value: 3 },
  uTwinkle: { value: 0 }, uHug: { value: 0 }, uPCol: { value: new THREE.Color() }, uRainSpeed: { value: 20 }, uRainLen: { value: 1 }, uRainWind: { value: 0 },
};
const WBOX = `vec3 B=vec3(56.,24.,56.);`;
const wrapGLSL = `p.xz=mod(p.xz-uCenter.xz+B.xz*.5,B.xz)-B.xz*.5; p.y=mod(p.y,B.y);
  vec3 wp=vec3(uCenter.x+p.x,0.,uCenter.z+p.z); float g=groundH(wp.xz);
  float edge=smoothstep(.5,.38,max(abs(p.x)/B.x,abs(p.z)/B.z));`;
const WMAX = 8000;
const ptsGeo = new THREE.BufferGeometry(), rainGeo = new THREE.BufferGeometry();
{
  const R = rng(123), sd = new Float32Array(WMAX * 4), rs = new Float32Array(WMAX * 8), re = new Float32Array(WMAX * 2);
  for (let k = 0; k < WMAX; k++) { for (let c = 0; c < 4; c++) { const v = R(); sd[k * 4 + c] = v; rs[k * 8 + c] = rs[k * 8 + 4 + c] = R(); } re[k * 2 + 1] = 1; }
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WMAX * 3), 3)); ptsGeo.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
  rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WMAX * 6), 3)); rainGeo.setAttribute('seed', new THREE.BufferAttribute(rs, 4)); rainGeo.setAttribute('endp', new THREE.BufferAttribute(re, 1));
}
const wPtsMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: timeU, uDim: dimU, uHT: AU.uHT, ...WU },
  vertexShader: `attribute vec4 seed; uniform vec3 uCenter; uniform vec2 uWindDir; uniform float uTime, uFall, uWindAmt, uWobble, uSize, uTwinkle, uHug; varying float vA;
    ${HT_GLSL}
    void main(){
      ${WBOX}
      float sp=.7+.6*seed.w; vec3 p=seed.xyz*B;
      p.y-=uTime*uFall*sp; p.xz+=uWindDir*uTime*uWindAmt*sp;
      p.x+=sin(uTime*1.3*uWobble+seed.w*40.)*uWobble*.6; p.z+=cos(uTime*1.1*uWobble+seed.w*23.)*uWobble*.6;
      ${wrapGLSL}
      wp.y = uHug>.5 ? g+.4+seed.y*2.2+sin(uTime*.7+seed.w*30.)*.3 : max(g,uCenter.y-4.)+p.y-1.;
      float tw = uTwinkle>.5 ? pow(.5+.5*sin(uTime*(1.5+seed.w*4.)+seed.x*60.),3.) : 1.;
      vA=edge*tw*step(g-.05,wp.y);
      vec4 mv=viewMatrix*vec4(wp,1.); gl_Position=projectionMatrix*mv;
      gl_PointSize=min(10.,uSize*(60./-mv.z));
    }`,
  fragmentShader: `uniform vec3 uPCol; uniform float uDim; varying float vA;
    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      gl_FragColor=vec4(pow(uPCol,vec3(2.2))*1.3, smoothstep(.5,.1,d)*vA*.85*(1.-.75*uDim));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: { uTime: timeU, uDim: dimU, uHT: AU.uHT, ...WU },
  vertexShader: `attribute vec4 seed; attribute float endp; uniform vec3 uCenter; uniform vec2 uWindDir; uniform float uTime, uRainSpeed, uRainLen, uRainWind; varying float vA;
    ${HT_GLSL}
    void main(){
      ${WBOX}
      vec3 p=seed.xyz*B; float sp=.85+.3*seed.w;
      vec3 vel=vec3(uWindDir.x*uRainWind,-uRainSpeed*sp,uWindDir.y*uRainWind);
      p+=vel*uTime;
      ${wrapGLSL}
      wp.y=max(g,uCenter.y-4.)+p.y-1.;
      wp-=normalize(vel)*uRainLen*endp;
      vA=edge*step(g,wp.y);
      gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
    }`,
  fragmentShader: `uniform float uDim; varying float vA;
    void main(){ gl_FragColor=vec4(pow(vec3(.78,.84,.94),vec3(2.2)), vA*.42*(1.-.75*uDim));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
// a translucent sheet over the whole screen, with gusts streaking across it
const veilMat = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uTime: timeU, uDim: dimU, uVCol: { value: new THREE.Color() }, uVAlpha: { value: 0 }, uStreak: { value: 1 }, uWindDir: WU.uWindDir },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform float uTime; uniform float uDim; uniform vec3 uVCol; uniform float uVAlpha; uniform float uStreak; uniform vec2 uWindDir; varying vec2 vUv;
    ${GLSL_NOISE}
    void main(){
      vec2 q=vUv*vec2(3.,5.); float t=uTime;
      float gust=fbm(vec2(q.x*.6-t*1.4*sign(uWindDir.x+.001), q.y*.35+t*.15));
      float streak=vn(vec2(q.x*.8-t*3.2, q.y*14.))*vn(vec2(q.x*.3-t*2., q.y*4.));
      float a=uVAlpha*(.7+.6*gust)+uStreak*streak*uVAlpha*.6;
      float vig=smoothstep(.2,.95,length(vUv-.5)*1.3);
      a=clamp(a+vig*uVAlpha*.35,0.,.9);
      gl_FragColor=vec4(pow(uVCol*(.85+.3*gust),vec3(2.2)), a*(1.-.8*uDim));
      #include <colorspace_fragment>
    }`,
});
const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
veil.frustumCulled = false; veil.renderOrder = 20; veil.visible = false; scene.add(veil);
const wPts = new THREE.Points(ptsGeo, wPtsMat), rainLines = new THREE.LineSegments(rainGeo, rainMat);
for (const o of [wPts, rainLines]) { o.frustumCulled = false; o.renderOrder = 8; o.visible = false; scene.add(o); }
let weatherHemi = 1, flash = 0;
function applyWeather() {
  const W = WEATHER[state.weather.kind] || WEATHER.none, k = state.weather.amount, B = BIOME(), on = state.weather.kind !== 'none';
  const light = on ? lerp(1, W.light ?? 1, k) : 1;
  sun.intensity = state.sunOn ? B.sunI * light : 0; sun.visible = state.sunOn;   // off: no sun and no sun shadows (caves) weatherHemi = hemi.intensity = B.hemi * (.55 + .45 * light);
  BU.uWind.value.set(WIND_DIR.x, WIND_DIR.y, on ? (W.wind || 0) * k : 0);
  BU.uWet.value = on ? (W.wet || 0) * k : 0;
  BU.uSnow.value = B.snow || 0; BU.uSnowLine.value = B.snowLine ?? -100;
  if (on && W.cover) { BU.uSnow.value = Math.max(BU.uSnow.value, W.cover * k); BU.uSnowLine.value = -100; }
  const P = on && W.pts; wPts.visible = !!P;
  if (P) {
    WU.uFall.value = P.fall; WU.uWindAmt.value = P.wind * (.5 + .5 * k); WU.uWobble.value = P.wobble; WU.uSize.value = P.size;
    WU.uTwinkle.value = P.twinkle ? 1 : 0; WU.uHug.value = P.hug ? 1 : 0; WU.uPCol.value.setRGB(...P.color);
    const bl = P.add ? THREE.AdditiveBlending : THREE.NormalBlending; if (wPtsMat.blending !== bl) { wPtsMat.blending = bl; wPtsMat.needsUpdate = true; }
    ptsGeo.setDrawRange(0, Math.round(P.n * k));
  }
  const Rn = on && W.rain; rainLines.visible = !!Rn;
  if (Rn) { WU.uRainSpeed.value = Rn.speed; WU.uRainLen.value = Rn.len; WU.uRainWind.value = Rn.wind * k; rainGeo.setDrawRange(0, Math.round(Rn.n * k) * 2); }
  if (on && W.fogNear) { scene.fog.near *= lerp(1, W.fogNear, k); scene.fog.far *= lerp(1, Math.min(1, W.fogNear * 1.8), k); }
  veil.visible = !!(on && W.veil);
  if (veil.visible) { veilMat.uniforms.uVCol.value.setRGB(...W.veil.color); veilMat.uniforms.uVAlpha.value = W.veil.alpha * k; veilMat.uniforms.uStreak.value = W.veil.streak; }
  if (on && W.fogColor) scene.fog.color.lerp(new THREE.Color().setRGB(...W.fogColor), k * .8);
  if ($('sunOn')) $('sunOn').checked = state.sunOn;
  if ($('weatherKind')) { $('weatherKind').value = state.weather.kind; $('weatherAmount').value = k; $('weatherAmountV').textContent = k.toFixed(2); }
}

// ============================================================
// Waterfalls
// ============================================================
const fallMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  uniforms: { uTime: timeU },
  vertexShader: `varying vec2 vUv; varying float vH; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vH=w.y; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uTime; uniform float uLava; varying vec2 vUv; ${GLSL_NOISE}
    void main(){
      float x=vUv.x, y=vUv.y;
      float s1=fbm(vec2(x*7., y*1.6+uTime*1.7)), s2=vn(vec2(x*26., y*5.+uTime*3.4));
      vec3 c=mix(vec3(.50,.76,.82), vec3(.97,1.,1.), smoothstep(.38,.78,s1*.75+s2*.45));
      c=mix(c, vec3(1.), smoothstep(.18,.0,y)*.9);
      // white water where it tips over the lip
      float lip=smoothstep(.84,.98,y)*(.65+.35*vn(vec2(x*18.,uTime*2.5)));
      c=mix(c, vec3(1.), lip*.85);
      c=mix(c, mix(vec3(1.,.42,.06),vec3(1.,.82,.35),s1), uLava);
      float edge=smoothstep(0.,.14,x)*smoothstep(1.,.86,x);
      float a=edge*(.7+.3*s1);
      gl_FragColor=vec4(pow(c,vec3(2.2)),a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const foamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uTime; uniform float uLava; varying vec2 vUv; ${GLSL_NOISE}
    void main(){
      vec2 q=vUv-.5; float r=length(q)*2.;
      float n=fbm(q*7.+vec2(0.,-uTime*.9))*.7+vn(q*20.-uTime*1.3)*.4;
      float a=smoothstep(1.,.25,r+(n-.5)*.5);
      gl_FragColor=vec4(pow(mix(vec3(.95,.99,1.),vec3(1.,.55,.15),uLava),vec3(2.2)), a*.9);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
fallMat.uniforms.uLava = BU.uLava; foamMat.uniforms.uLava = BU.uLava;
const fallGroup = new THREE.Group(); scene.add(fallGroup);
// stream that feeds a waterfall: flows from the source toward the lip
const streamMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: timeU, uDim: dimU },
  vertexShader: `attribute float along; attribute float dist; varying vec2 vUv; varying float vA; varying float vDist;
    void main(){ vUv=uv; vA=along; vDist=dist; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uTime; uniform float uDim; uniform float uLava; varying vec2 vUv; varying float vA; varying float vDist; ${GLSL_NOISE}
    ${DIM_GLSL}
    void main(){
      float x=vUv.x;
      float s1=fbm(vec2(x*5., vDist*1.3-uTime*1.9)), s2=vn(vec2(x*14., vDist*3.-uTime*3.2));
      vec3 c=mix(vec3(.30,.78,.80), vec3(.10,.48,.62), smoothstep(.2,.5,abs(x-.5)*-1.+.5));
      c=mix(c, vec3(.86,.98,1.), smoothstep(.55,.85,s1*.8+s2*.4)*.7);
      float rapids=smoothstep(.75,1.,vA)+smoothstep(.12,.0,vA)*.7;      // white water at lip and spring
      c=mix(c, vec3(1.), rapids*(.45+.55*s2));
      float edge=smoothstep(0.,.18,x)*smoothstep(1.,.82,x);
      float bank=1.-edge;
      c=mix(c, vec3(.95,1.,1.), bank*.5*s1);
      c=mix(c, mix(vec3(1.,.40,.06),vec3(1.,.80,.32),s1), uLava);
      gl_FragColor=vec4(dimc(pow(c,vec3(2.2))), edge*.9+.05);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const mistTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
streamMat.uniforms.uLava = BU.uLava;
const fallDir = f => [-Math.sin(f.rot), -Math.cos(f.rot)];   // uphill direction (toward the source)
function streamGeometry(f) {
  const [ux, uz] = fallDir(f), ex = f.x + ux * .8, ez = f.z + uz * .8;   // top of the falling sheet
  const L = Math.hypot(f.sx - ex, f.sz - ez), M = Math.max(4, Math.ceil(L / .35)), px = -uz, pz = ux;
  const pos = [], uv = [], al = [], di = [], ix = [];
  for (let i = 0; i <= M; i++) {
    const t = i / M, x = lerp(f.sx, ex, t), z = lerp(f.sz, ez, t);
    const y = Math.max(heightAt(x, z) + .1, f.top + .04);
    const w = f.w * .85 * (.5 + .5 * sstep(0, .3, t)) / 2;
    pos.push(x - px * w, y, z - pz * w, x + px * w, y, z + pz * w);
    uv.push(0, t, 1, t); al.push(t, t); di.push(t * L, t * L);
    if (i < M) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('along', new THREE.Float32BufferAttribute(al, 1)); g.setAttribute('dist', new THREE.Float32BufferAttribute(di, 1));
  g.setIndex(ix); return g;
}
function fallGeometry(w, hgt, lean) {
  const g = new THREE.PlaneGeometry(w, 1, 6, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + .5;                  // 0 bottom .. 1 top
    p.setXYZ(i, p.getX(i) * (1 + .18 * (1 - v)), v * hgt, -lean * Math.pow(v, 2.5));
  }
  g.computeVertexNormals(); return g;
}
function rebuildFalls() {
  scheduleWater();
  for (const c of [...fallGroup.children]) { if (c.geometry) c.geometry.dispose(); fallGroup.remove(c); }
  for (const f of falls) {
    if (f.sx !== undefined) { const st = new THREE.Mesh(streamGeometry(f), streamMat); st.renderOrder = 3; fallGroup.add(st); }
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: .4 }));
    mist.position.set(f.x + Math.sin(f.rot) * .5, f.bottom + f.w * .45, f.z + Math.cos(f.rot) * .5);
    mist.userData = { mist: true, base: f.w * 2.4, ph: f.x * 3.1 }; mist.scale.setScalar(f.w * 2.4); mist.renderOrder = 5; fallGroup.add(mist);
    const hgt = f.top - f.bottom; if (hgt < .3) continue;
    const m = new THREE.Mesh(fallGeometry(f.w, hgt + .15, .8), fallMat);
    m.position.set(f.x, f.bottom, f.z); m.rotation.y = f.rot; m.renderOrder = 3; fallGroup.add(m);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(f.w * 2.2, f.w * 1.6), foamMat);
    foam.rotation.set(-Math.PI / 2, 0, f.rot); foam.position.set(f.x + Math.sin(f.rot) * .4, f.bottom + .04, f.z + Math.cos(f.rot) * .4);
    foam.renderOrder = 4; fallGroup.add(foam);
  }
}
// finds the cliff profile at (x, z): direction downhill, height of lip and foot
function cliffAt(x, z) {
  const e = .4, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz);
  if (gl < .6) return null;
  const ux = gx / gl, uz = gz / gl;
  let hT = -1e9, hB = 1e9, dB = 0;
  for (let d = 0; d <= 3; d += .25) { hT = Math.max(hT, heightAt(x + ux * d, z + uz * d)); const hb = heightAt(x - ux * d, z - uz * d); if (hb < hB) { hB = hb; dB = d; } }
  return { ux, uz, hT, hB, dB };
}
function placeFall(x, z, w) {
  const c = cliffAt(x, z); if (!c) return false;
  const bottom = Math.max(c.hB, state.water), top = c.hT;
  if (top - bottom < 1) return false;
  const fx = x - c.ux * 1.0, fz = z - c.uz * 1.0, rot = Math.atan2(-c.ux, -c.uz);
  // find the lip, then follow the plateau uphill for the stream that feeds the fall
  let lipD = 0; while (lipD < 3 && heightAt(x + c.ux * lipD, z + c.uz * lipD) < top - .2) lipD += .1;
  const lx = x + c.ux * lipD, lz = z + c.uz * lipD;
  let len = 0; const want = 3.5 + w * .8;
  while (len < want) {
    const nx = lx + c.ux * (len + .25), nz = lz + c.uz * (len + .25), h = heightAt(nx, nz);
    if (Math.abs(nx) > HALF - 1.5 || Math.abs(nz) > HALF - 1.5 || h < top - .7 || h > top + 1.2) break;
    len += .25;
  }
  const f = { x: fx, z: fz, rot, w, top: top - .05, bottom };
  // clear the stone columns and boulders that would hide the sheet of water
  const behindFall = (px, pz) => { const ax = px - x, az = pz - z, along = ax * c.ux + az * c.uz, lat = Math.abs(ax * c.uz - az * c.ux); return lat < w * .5 + .25 && along > -2 && along < 1.6; };
  props = props.filter(p => !((p[0] === 4 || p[0] === 2) && behindFall(p[1], p[2])));
  if (len >= 1.5) {
    const sx = lx + c.ux * len, sz = lz + c.uz * len, half = w * .5 + .5;
    const ax = lx - c.ux * .4, az = lz - c.uz * .4;
    forBrush((ax + sx) / 2, (az + sz) / 2, len / 2 + half + .5, (i, d, vx_, vz_) => {
      const dd = distToPolyline(vx_, vz_, [[ax, az], [sx, sz]]);
      const k = sstep(half, half - .7, dd) * (.3 + .1 * sstep(len, 0, Math.hypot(vx_ - lx, vz_ - lz)));
      if (k > 0) H[i] -= k;
    });
    f.top = heightAt(lx, lz) + .04; f.sx = sx; f.sz = sz;
    // nothing grows in the stream bed; a few stones mark the spring and the banks
    props = props.filter(p => distToPolyline(p[1], p[2], [[ax, az], [sx, sz]]) > half + (PROP[p[0]].r * p[4]));
    const R = rng((x * 1000 + z * 7) | 0), px = -c.uz, pz = c.ux;
    for (let k = 0; k < 3; k++) { const a = (k - 1) * 1.1; props.push([2, sx + c.ux * .5 + px * a * w * .4, sz + c.uz * .5 + pz * a * w * .4, R() * 6.3, .55 + R() * .45, 0]); }
    for (let t = .2; t < len - .3; t += .9 + R() * .6) for (const sd of [-1, 1]) if (R() < .6)
      props.push([2, lx + c.ux * t + px * sd * (w * .48 + .25), lz + c.uz * t + pz * sd * (w * .48 + .25), R() * 6.3, .3 + R() * .35, 0]);
  }
  falls.push(f);
  updateTerrain(); rebuildFalls(); rebuildProps();
  return true;
}
function autoFalls(R) {
  const cands = [];
  for (let k = 0; k < 4000; k++) {
    const x = (R() - .5) * (SIZE - 16), z = (R() - .5) * (SIZE - 16);
    if (slopeAt(x, z) < 1.3) continue;
    const c = cliffAt(x, z); if (!c) continue;
    if (-c.ux - c.uz < .25) continue;          // face the default camera (from +x,+z)
    if (c.hB > state.water + .05 || c.hT - state.water < 3.0) continue;
    if (state.water - heightAt(x - c.ux * 1.8, z - c.uz * 1.8) < .4) continue;
    cands.push([x, z, c.hT - state.water]);
  }
  cands.sort((a, b) => b[2] - a[2]);
  const chosen = [];
  for (const c of cands) { if (chosen.length >= 3) break; if (chosen.every(o => Math.hypot(o[0] - c[0], o[1] - c[1]) > 14)) chosen.push(c); }
  for (const [x, z] of chosen) placeFall(x, z, 3 + R() * 1.4);
}

// ============================================================
// Bridges
// ============================================================
const bridgeGroup = new THREE.Group(); scene.add(bridgeGroup);
function mat4o(px, py, pz, sx, sy, sz, ry, rx) {   // yaw then pitch, for pieces that follow the deck
  return new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
}
// deck curve per type: [rise per metre of span, max]; negative = sagging rope bridge
const BRIDGE_ARCH = { wood: [.06, .7], log: [0, 0], stone: [.03, .45], arch: [.2, 2.4], straight: [0, 0], vine: [-.09, 1.8], sus: [-.05, 1.0] };
const BRIDGE_TYPES = [['wood', '木の橋'], ['log', '割った丸太'], ['stone', '石の橋'], ['arch', 'アーチ橋'], ['straight', 'まっすぐな橋'], ['vine', 'ツタのつり橋'], ['sus', '丈夫なつり橋']];
const STAIR_TYPES = [['dirt', '土の階段'], ['stone', '石の階段'], ['wood', '木の階段'], ['built', '人工物の階段']];
const BRIDGE_TAGS = {
  wood: ['grassland', 'forest', 'canyon', 'mountain', 'beach'], log: ['forest', 'jungle'],
  stone: ['mountain', 'canyon', 'ruins', 'castle', 'desert', 'volcano', 'cave', 'demon', 'graveyard'], arch: ['castle', 'ruins', 'grassland', 'demon'],
  straight: ['castle', 'cave'], vine: ['jungle', 'canyon'], sus: ['canyon', 'mountain', 'snow'],
};
const STAIR_TAGS = { dirt: ['grassland', 'forest', 'jungle', 'canyon', 'mountain', 'beach'], stone: ['common'], wood: ['forest', 'cave', 'beach', 'snow', 'jungle'], built: ['ruins', 'castle', 'desert', 'demon', 'graveyard'] };
// ground paint tools; tools not listed here (terrain, structures, walkability) are always shown
const GTOOL_TAGS = {
  grass: ['common'], dirt: ['common'], cobble: ['grassland', 'ruins', 'castle', 'desert', 'graveyard'], sand: ['desert', 'beach', 'canyon', 'wasteland'],
  rubble: ['wasteland', 'mountain', 'canyon', 'volcano', 'cave', 'ruins', 'desert', 'graveyard'], swamp: ['forest', 'jungle', 'demon', 'cave', 'graveyard'], poison: ['demon', 'jungle', 'cave', 'volcano'],
  lava: ['volcano', 'demon'], snowfield: ['snow', 'mountain'], ice: ['snow', 'mountain', 'cave'], coast: ['beach'],
};
const inPalette = tags => state.palette === 'all' || tags.includes('common') || tags.includes(state.palette);
const propVisible = i => inPalette(PROP[i].tags);
const toolVisible = id => !GTOOL_TAGS[id] || inPalette(GTOOL_TAGS[id]);
function bridgeProfile(b) {
  const L = Math.hypot(b.x2 - b.x1, b.z2 - b.z1);
  const y1 = Math.max(heightAt(b.x1, b.z1), state.water) + .12, y2 = Math.max(heightAt(b.x2, b.z2), state.water) + .12;
  const [ak, amax] = BRIDGE_ARCH[b.type || 'wood'], arch = Math.sign(ak) * Math.min(amax, Math.abs(ak) * L);
  return { L, y1, y2, arch, y: t => lerp(y1, y2, t) + arch * Math.sin(Math.PI * t), dy: t => (y2 - y1) + arch * Math.PI * Math.cos(Math.PI * t) };
}
function bridgeAt(x, z, margin = 0) {   // margin: distance kept from the deck edge (0 = the deck itself)
  for (const b of bridges) {
    const dx = b.x2 - b.x1, dz = b.z2 - b.z1, L2 = dx * dx + dz * dz, t = ((x - b.x1) * dx + (z - b.z1) * dz) / L2;
    if (t < -.02 || t > 1.02) continue;
    if (Math.abs((x - b.x1) * dz - (z - b.z1) * dx) / Math.sqrt(L2) > b.w / 2 - margin) continue;
    return bridgeProfile(b).y(clamp(t, 0, 1));
  }
  return null;
}
function geoBridgeWood(b) {
  const pr = bridgeProfile(b), L = pr.L, dx = (b.x2 - b.x1) / L, dz = (b.z2 - b.z1) / L, ry = Math.atan2(dx, dz), px = dz, pz = -dx;
  const R = rng(((b.x1 * 97 + b.z1 * 31) * 100) | 0), parts = [];
  const wood = (y, ny, Rr, pr2) => mixc(col(0x7a4f2c), col(0xb58552), clamp(pr2 * .8 + (ny > .7 ? .25 : 0) + (Rr() - .5) * .2, 0, 1));
  const dark = (y, ny, Rr) => mixc(col(0x4a2f19), col(0x6e4828), Rr() * .6 + (ny > .7 ? .3 : 0));
  const stone = (y, ny, Rr) => mixc(col(0x777064), col(0xb1a894), Rr() * .7 + (ny > .7 ? .2 : 0));
  const at = (t, lat, up) => [b.x1 + dx * t * L + px * lat, pr.y(t) + up, b.z1 + dz * t * L + pz * lat];
  const pitch = t => -Math.atan(pr.dy(t) / L);
  // deck planks
  const n = Math.max(5, Math.round(L / .34));
  for (let k = 0; k < n; k++) {
    const t = (k + .5) / n, [x, y, z] = at(t, (R() - .5) * .06, 0);
    parts.push({ g: new THREE.BoxGeometry(b.w * (.95 + R() * .08), .09, L / n * .86), m: mat4o(x, y, z, 1, 1, 1, ry + (R() - .5) * .03, pitch(t)), cfn: wood, j: .06 });
    for (const sd of [-1, 1]) { const [sx, sy, sz] = at(t, sd * (b.w / 2 - .12), -.13); parts.push({ g: new THREE.BoxGeometry(.14, .17, L / n * 1.02), m: mat4o(sx, sy, sz, 1, 1, 1, ry, pitch(t)), cfn: dark, j: .05 }); }
  }
  // posts and rails
  const m = Math.max(2, Math.round(L / 1.4));
  for (const sd of [-1, 1]) {
    const lat = sd * (b.w / 2 + .02);
    for (let k = 0; k <= m; k++) {
      const t = k / m, [x, y, z] = at(t, lat, .5);
      parts.push({ g: new THREE.BoxGeometry(.12, 1.0, .12), m: mat4(x, y, z, 1, 1, 1, ry), cfn: dark, j: .05 });
      // piers down to the river bed where the deck is high above ground
      const ground = heightAt(x, z), deck = pr.y(t);
      if (deck - ground > .8 && k > 0 && k < m) { const h = deck - ground; const [qx, , qz] = at(t, sd * (b.w / 2 - .2), 0); parts.push({ g: new THREE.BoxGeometry(.2, h, .2), m: mat4(qx, ground + h / 2 - .1, qz, 1, 1, 1, ry), cfn: dark, j: .05 }); }
      if (k < m) {
        const t2 = (k + .5) / m, segL = L / m * 1.02;
        for (const [up, th] of [[.9, .09], [.5, .06]]) { const [rx, rY, rz] = at(t2, lat, up); parts.push({ g: new THREE.BoxGeometry(th, th, segL), m: mat4o(rx, rY, rz, 1, 1, 1, ry, pitch(t2)), cfn: wood, j: .05 }); }
      }
    }
  }
  // stone footings at both ends
  for (const t of [0, 1]) { const [x, y, z] = at(t, 0, -.32); parts.push({ g: displace(new THREE.BoxGeometry(b.w + .5, .5, .8, 2, 1, 1), .08, x + z), m: mat4(x, y, z, 1, 1, 1, ry), cfn: stone, j: .08 }); }
  return makeGeo(parts, 31);
}
// --- shared helpers for structures that follow a deck curve
function bridgeKit(b) {
  const pr = bridgeProfile(b), L = pr.L, dx = (b.x2 - b.x1) / L, dz = (b.z2 - b.z1) / L;
  return { pr, L, dx, dz, ry: Math.atan2(dx, dz), px: dz, pz: -dx,
    at: (t, lat, up) => [b.x1 + dx * t * L + dz * lat, pr.y(t) + up, b.z1 + dz * t * L - dx * lat],
    pitch: t => -Math.atan(pr.dy(t) / L) };
}
function beam(parts, P0, P1, wx, wy, cfn, j = .06) {
  const dx = P1[0] - P0[0], dy = P1[1] - P0[1], dz = P1[2] - P0[2], h = Math.hypot(dx, dz), len = Math.hypot(h, dy);
  parts.push({ g: new THREE.BoxGeometry(wx, wy, len), m: mat4o((P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, (P0[2] + P1[2]) / 2, 1, 1, 1, Math.atan2(dx, dz), -Math.atan2(dy, h)), cfn, j });
}
const C_WOOD = (y, ny, R, pr) => mixc(col(0x7a4f2c), col(0xb58552), clamp(pr * .8 + (ny > .7 ? .25 : 0) + (R() - .5) * .2, 0, 1));
const C_DARK = (y, ny, R) => mixc(col(0x4a2f19), col(0x6e4828), R() * .6 + (ny > .7 ? .3 : 0));
const C_STONE = (y, ny, R, pr) => mixc(col(0x6f685d), col(0xb9b09c), clamp(pr * .6 + R() * .3 + (ny > .7 ? .15 : 0), 0, 1));
const C_ROPE = (y, ny, R) => mixc(col(0x6b5a3c), col(0x9a8660), R());
const C_LEAF = (y, ny, R) => mixc(col(0x2f6a26), col(0x5d9a38), R());
const C_CONC = (y, ny, R) => mixc(col(0xa9a69f), col(0xd6d3cb), R() * .5 + (ny > .7 ? .4 : 0));
const C_METAL = (y, ny, R) => mixc(col(0x3c4046), col(0x6a7078), R());
function geoBridge(b) {
  const type = b.type || 'wood';
  if (type === 'wood') return geoBridgeWood(b);
  const K = bridgeKit(b), { L, at, pitch } = K, w = b.w, R = rng(((b.x1 * 97 + b.z1 * 31) * 100) | 0), parts = [];
  const ground = (x, z) => heightAt(x, z);
  if (type === 'log') {
    // a trunk split lengthwise, flat face up
    const r = w / 2, [mx, my, mz] = at(.5, 0, 0), ph = pitch(.5);
    parts.push({ g: displace(new THREE.CylinderGeometry(r, r * 1.06, L + .4, 11, 4), .05, 9.1), m: new THREE.Matrix4().compose(new THREE.Vector3(mx, my - r * .55, mz), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + ph, K.ry, 0, 'YXZ')), new THREE.Vector3(1, 1, .55)), cfn: (y, ny, Rr) => mixc(col(0x3e2a19), col(0x6a4a2e), Rr()), j: .1 });
    beam(parts, at(0, 0, .015), at(1, 0, .015), w * .92, .05, (y, ny, Rr) => mixc(col(0xb88a58), col(0xd7ae7c), Rr()), .05);
    beam(parts, at(0, 0, .045), at(1, 0, .045), w * .12, .01, () => col(0x8a6238), .05);
    for (let k = 0; k < 3; k++) { const [x, y, z] = at(.15 + R() * .7, (R() < .5 ? -1 : 1) * r * .8, -.05); parts.push({ g: displace(new THREE.IcosahedronGeometry(.22, 0), .3, k), m: mat4(x, y, z, 1.3, .35, .9, R() * 3), cfn: C_LEAF, j: .1 }); }
  } else if (type === 'stone' || type === 'straight') {
    const stone = type === 'stone', n = Math.max(2, Math.ceil(L / (stone ? .9 : 2))), seg = 1 / n;
    for (let k = 0; k < n; k++) {
      const t0 = k * seg, t1 = (k + 1) * seg;
      beam(parts, at(t0, 0, stone ? -.19 : -.15), at(t1, 0, stone ? -.19 : -.15), w + (stone ? .1 : 0), stone ? .38 : .3, stone ? C_STONE : C_CONC, stone ? .1 : .04);
      for (const sd of [-1, 1]) {
        if (stone) beam(parts, at(t0 + .01, sd * (w / 2 + .05), .2), at(t1 - .01, sd * (w / 2 + .05), .2), .3, .45, C_STONE, .1);
        else beam(parts, at(t0, sd * (w / 2 - .08), .04), at(t1, sd * (w / 2 - .08), .04), .16, .14, C_CONC, .03);
      }
    }
    if (!stone) {
      const m = Math.max(2, Math.round(L / 1.2));
      for (const sd of [-1, 1]) {
        const lat = sd * (w / 2 - .08);
        for (let k = 0; k <= m; k++) { const [x, y, z] = at(k / m, lat, .58); parts.push({ g: new THREE.BoxGeometry(.06, .95, .06), m: mat4(x, y, z, 1, 1, 1, K.ry), cfn: C_METAL, j: .03 }); }
        for (const up of [1.03, .6]) beam(parts, at(0, lat, up), at(1, lat, up), .05, .05, C_METAL, .03);
      }
    }
    // piers where the deck stands high above the bed
    const pm = Math.max(1, Math.round(L / (stone ? 4 : 5)));
    for (let k = 1; k < pm; k++) {
      const t = k / pm, [x, y, z] = at(t, 0, 0), g0 = ground(x, z), h = y - g0;
      if (h < .8) continue;
      if (stone) parts.push({ g: displace(new THREE.BoxGeometry(w * .85, h, .9, 1, 3, 1), .05, t * 9), m: mat4(x, g0 + h / 2 - .2, z, 1, 1, 1, K.ry), cfn: C_STONE, j: .1 });
      else for (const sd of [-1, 1]) { const [qx, , qz] = at(t, sd * (w / 2 - .35), 0); parts.push({ g: new THREE.BoxGeometry(.45, h, .45), m: mat4(qx, g0 + h / 2 - .2, qz, 1, 1, 1, K.ry), cfn: C_CONC, j: .03 }); }
    }
  } else if (type === 'arch') {
    // stone arch: solid spandrels down to an arched underside, ring stones and parapets
    const n = Math.max(6, Math.ceil(L / .5)), A = K.pr.arch;
    const under = t => lerp(K.pr.y1, K.pr.y2, t) - .9 + (A + .5) * Math.pow(Math.sin(Math.PI * t), .6);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, tc = (t0 + t1) / 2, top = K.pr.y(tc), bot = under(tc), h = Math.max(.35, top - bot);
      const [x, , z] = at(tc, 0, 0);
      parts.push({ g: new THREE.BoxGeometry(w + .2, h, L / n * 1.02), m: mat4o(x, top - h / 2, z, 1, 1, 1, K.ry, 0), cfn: C_STONE, j: .08 });
      const [ux0, , uz0] = at(t0, 0, 0), [ux1, , uz1] = at(t1, 0, 0);
      beam(parts, [ux0, under(t0) + .1, uz0], [ux1, under(t1) + .1, uz1], w + .3, .24, (y, ny, Rr) => mixc(col(0x5d574e), col(0x8f8778), Rr()), .1);
      for (const sd of [-1, 1]) beam(parts, at(t0 + .003, sd * (w / 2 + .04), .27), at(t1 - .003, sd * (w / 2 + .04), .27), .28, .55, C_STONE, .08);
    }
  } else if (type === 'vine' || type === 'sus') {
    const vine = type === 'vine', n = Math.max(6, Math.round(L / (vine ? .38 : .3)));
    for (let k = 0; k < n; k++) {
      if (vine && k > 1 && k < n - 2 && R() < .08) continue;           // a missing plank or two
      const t = (k + .5) / n, [x, y, z] = at(t, (R() - .5) * (vine ? .08 : .02), 0);
      parts.push({ g: new THREE.BoxGeometry(w * (vine ? .82 + R() * .16 : 1), vine ? .05 : .07, L / n * (vine ? .7 : .9)), m: mat4o(x, y, z, 1, 1, 1, K.ry + (vine ? (R() - .5) * .16 : 0), pitch(t)), cfn: C_WOOD, j: .08 });
    }
    const steps = Math.max(8, Math.round(L / .5));
    const railUp = t => vine ? .95 : .9 + 1.4 * (1 - Math.sin(Math.PI * t));       // sturdy: main cable from the towers
    for (const sd of [-1, 1]) {
      const lat = sd * (w / 2 + (vine ? .05 : .1));
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps, t1 = (k + 1) / steps;
        beam(parts, at(t0, sd * (w / 2 - .08), -.06), at(t1, sd * (w / 2 - .08), -.06), vine ? .05 : .1, vine ? .05 : .12, vine ? C_ROPE : C_DARK, .05);
        beam(parts, at(t0, lat, railUp(t0)), at(t1, lat, railUp(t1)), vine ? .05 : .08, vine ? .05 : .08, C_ROPE, .05);
        if (k % (vine ? 2 : 1) === 0) beam(parts, at(t0, lat, .02), at(t0, lat, railUp(t0)), .025, .025, C_ROPE, .05);
        if (vine && R() < .5) {
          const [x, y, z] = at(t0 + R() * .05, lat, railUp(t0) - .05);
          parts.push({ g: displace(new THREE.IcosahedronGeometry(.16, 0), .35, k + sd), m: mat4(x, y - R() * .1, z, 1.1, .55, .9, R() * 3), cfn: C_LEAF, j: .15 });
          if (R() < .5) beam(parts, [x, y, z], [x, y - .3 - R() * .6, z], .03, .03, C_LEAF, .1);
        }
      }
      // end posts (vine) or towers (sturdy)
      for (const t of [0, 1]) {
        const [x, y, z] = at(t, lat, 0), hgt = vine ? 1.5 : 2.6;
        parts.push({ g: new THREE.CylinderGeometry(vine ? .08 : .13, vine ? .11 : .16, hgt, 6), m: mat4(x, y + hgt / 2 - .35, z, 1, 1, 1), cfn: C_DARK, j: .08 });
      }
    }
    if (!vine) for (const t of [0, 1]) beam(parts, at(t, -(w / 2 + .1), 2.2), at(t, w / 2 + .1, 2.2), .2, .2, C_DARK, .06);
  }
  return makeGeo(parts, 32);
}
function rebuildBridges() {
  for (const c of [...bridgeGroup.children]) { c.geometry.dispose(); bridgeGroup.remove(c); }
  for (const b of bridges) { const m = new THREE.Mesh(geoBridge(b), propMat); m.castShadow = m.receiveShadow = true; bridgeGroup.add(m); }
  walkDirty = true;
}
function placeBridge(a, c, w, type = 'wood') {
  if (type === 'log') w = Math.min(w, 1.1); else if (type === 'vine') w = Math.min(w, 1.8);
  const L = Math.hypot(c.x - a.x, c.z - a.z);
  if (L < 2 || L > 26) return false;
  const b = { x1: a.x, z1: a.z, x2: c.x, z2: c.z, w, type };
  // clear anything standing on the deck
  props = props.filter(p => { const d = distToPolyline(p[1], p[2], [[b.x1, b.z1], [b.x2, b.z2]]); return d > w / 2 + .3 + (p[0] === 4 ? .6 : PROP[p[0]].r * p[4]); });
  bridges.push(b); rebuildBridges(); rebuildProps();
  return true;
}
// ---------- slopes and stairs share a ramp carved into the terrain
function shapeRamp(a, c, w, y1, y2, sink) {
  const L = Math.hypot(c.x - a.x, c.z - a.z), dx = (c.x - a.x) / L, dz = (c.z - a.z) / L;
  forBrush((a.x + c.x) / 2, (a.z + c.z) / 2, L / 2 + w / 2 + 2, (i, d, px, pz) => {
    const t = ((px - a.x) * dx + (pz - a.z) * dz) / L, lat = Math.abs((px - a.x) * dz - (pz - a.z) * dx);
    const k = sstep(w / 2 + 1.1, w / 2, lat) * sstep(-.14, .02, t) * sstep(1.14, .98, t);
    if (k > 0) H[i] = lerp(H[i], lerp(y1, y2, clamp(t, 0, 1)) - sink, k);
  });
}
function clearCorridor(a, c, w) {
  props = props.filter(p => distToPolyline(p[1], p[2], [[a.x, a.z], [c.x, c.z]]) > w / 2 + .3 + (p[0] === 4 ? .7 : PROP[p[0]].r * p[4]));
}
// coast: everything past the drag start, in the drag direction, sinks into the sea behind a sandy beach
function makeCoast(a, c) {
  const L = Math.hypot(c.x - a.x, c.z - a.z); if (L < 2) return false;
  const dx = (c.x - a.x) / L, dz = (c.z - a.z) / L, W = state.water, beach = Math.max(4, L * .6);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = vx(i), z = vx(j), k = idx(i, j);
    const t = (x - a.x) * dx + (z - a.z) * dz + (fbm(x * .12 + 5, z * .12) - .5) * 5;
    if (t < -6) continue;
    const target = t < 0 ? W + .55 + -t * .35 : t < beach ? W + .55 - t / beach * .95 : W - .4 - Math.min(3, (t - beach) * .22);
    if (target < H[k]) H[k] = lerp(H[k], target, sstep(-6, -1, t));
    const sw = sstep(-5, -2, t) * sstep(beach + 4, beach, t);
    if (sw > 0) {
      S[k * NS + 2] = Math.max(S[k * NS + 2], sw * 255);
      for (const o of [0, 1, 3, 4, 5, 6, 7, 8]) S[k * NS + o] = Math.round(S[k * NS + o] * (1 - sw));
    }
  }
  state.sea = true;
  props = props.filter(p => heightAt(p[1], p[2]) > W + .15 || PROP[p[0]].id === 'reed' || p[0] === TYPE('rock'));
  props = props.filter(p => !(PROP[p[0]].tree && splatAt(p[1], p[2], 2) > .5));
  applyBiome(state.biome); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs();
  return true;
}
function placeSlope(a, c, w) {
  const L = Math.hypot(c.x - a.x, c.z - a.z), y1 = heightAt(a.x, a.z), y2 = heightAt(c.x, c.z);
  if (L < 2) return '2m以上ドラッグしてください';
  if (Math.abs(y2 - y1) / L > .75) return '急すぎます。もっと長くドラッグするか、階段を使ってください';
  shapeRamp(a, c, w, y1, y2, 0); clearCorridor(a, c, w);
  updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs();
  return '';
}
const stairSteps = st => Math.max(2, Math.round((st.y2 - st.y1) / .24));
function stairsAt(x, z, margin = 0) {
  for (const st of stairs) {
    const dx = st.x2 - st.x1, dz = st.z2 - st.z1, L2 = dx * dx + dz * dz, t = ((x - st.x1) * dx + (z - st.z1) * dz) / L2;
    if (t < -.01 || t > 1.01) continue;
    if (Math.abs((x - st.x1) * dz - (z - st.z1) * dx) / Math.sqrt(L2) > st.w / 2 - margin) continue;
    const n = stairSteps(st), k = clamp(Math.floor(t * n), 0, n - 1);
    return st.y1 + (st.y2 - st.y1) / n * (k + 1);
  }
  return null;
}
function placeStairs(a, c, w, type) {
  let y1 = heightAt(a.x, a.z), y2 = heightAt(c.x, c.z);
  if (y2 < y1) { [a, c] = [c, a]; [y1, y2] = [y2, y1]; }
  const L = Math.hypot(c.x - a.x, c.z - a.z);
  if (L < 1.2) return '1.2m以上ドラッグしてください';
  if (y2 - y1 < .3) return '高低差が小さいので「坂」を使ってください';
  if ((y2 - y1) / L > 1.25) return '短すぎます（急すぎる階段）。もっと長くドラッグしてください';
  shapeRamp(a, c, w + .3, y1, y2, .12); clearCorridor(a, c, w + .4);
  stairs.push({ x1: a.x, z1: a.z, x2: c.x, z2: c.z, w, type, y1, y2 });
  updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs();
  return '';
}
const stairGroup = new THREE.Group(); scene.add(stairGroup);
function geoStairs(st) {
  const L = Math.hypot(st.x2 - st.x1, st.z2 - st.z1), dx = (st.x2 - st.x1) / L, dz = (st.z2 - st.z1) / L, ry = Math.atan2(dx, dz);
  const n = stairSteps(st), rise = (st.y2 - st.y1) / n, run = L / n, w = st.w, R = rng(((st.x1 * 53 + st.z1 * 71) * 100) | 0), parts = [];
  const at = (t, lat, y) => [st.x1 + dx * t * L + dz * lat, y, st.z1 + dz * t * L - dx * lat];
  const dirt = (y, ny, Rr) => mixc(col(0x5c4127), col(0x8c6a44), Rr());
  for (let k = 0; k < n; k++) {
    const tc = (k + .5) / n, t0 = k / n, top = st.y1 + rise * (k + 1), [x, , z] = at(tc, 0, 0);
    if (st.type === 'dirt') {
      parts.push({ g: new THREE.BoxGeometry(w, .16, run * 1.04), m: mat4(x, top - .08, z, 1, 1, 1, ry), cfn: dirt, j: .08 });
      const [lx, , lz] = at(t0 + .02, 0, 0);
      parts.push({ g: new THREE.CylinderGeometry(.09, .1, w + .15, 7), m: mat4(lx, top - .06, lz, 1, 1, 1, ry, 0, Math.PI / 2), cfn: (y, ny, Rr) => mixc(col(0x3e2a19), col(0x6a4a2e), Rr()), j: .1 });
      for (const sd of [-1, 1]) { const [sx, , sz] = at(t0 + .02, sd * (w / 2 + .08), 0); parts.push({ g: new THREE.CylinderGeometry(.035, .04, .4, 5), m: mat4(sx, top - .05, sz, 1, 1, 1), cfn: C_DARK, j: .1 }); }
    } else if (st.type === 'stone') {
      const h = rise + .45;
      parts.push({ g: displace(new THREE.BoxGeometry(w * (.94 + R() * .1), h, run * 1.1, 2, 1, 1), .05, k * 1.7), m: mat4(x + (R() - .5) * .05, top - h / 2, z, 1, 1, 1, ry + (R() - .5) * .06), cfn: C_STONE, j: .1 });
      if (k % 2 === 0) for (const sd of [-1, 1]) { const [sx, , sz] = at(tc, sd * (w / 2 + .28), 0); parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .35, k + sd), m: mat4(sx, top - .15, sz, .38 + R() * .15, .3 + R() * .15, .4, R() * 3), cfn: C_STONE, j: .1 }); }
    } else if (st.type === 'wood') {
      parts.push({ g: new THREE.BoxGeometry(w, .07, run * .9), m: mat4(x, top - .035, z, 1, 1, 1, ry), cfn: C_WOOD, j: .06 });
    } else {
      const h = rise + .3;
      parts.push({ g: new THREE.BoxGeometry(w, h, run * 1.005), m: mat4(x, top - h / 2, z, 1, 1, 1, ry), cfn: C_CONC, j: .02 });
      const [nx, , nz] = at(t0 + .02 / L, 0, 0);
      parts.push({ g: new THREE.BoxGeometry(w, .035, .06), m: mat4(nx, top - .015, nz, 1, 1, 1, ry), cfn: C_METAL, j: .02 });
      for (const sd of [-1, 1]) { const [sx, , sz] = at(tc, sd * (w / 2 + .12), 0), wh = rise + .75; parts.push({ g: new THREE.BoxGeometry(.24, wh, run * 1.01), m: mat4(sx, top + .45 - wh / 2, sz, 1, 1, 1, ry), cfn: (y, ny, Rr) => mixc(col(0x9d968a), col(0xc4bdb0), Rr() * .5 + (ny > .7 ? .4 : 0)), j: .02 }); }
    }
  }
  if (st.type === 'wood') {
    for (const sd of [-1, 1]) {
      const lat = sd * (w / 2 - .04);
      beam(parts, at(0, lat, st.y1 - .05), at(1, lat, st.y2 - .05), .09, .3, C_DARK, .05);
      const m = Math.max(1, Math.round(L / 1.5));
      for (let k = 0; k <= m; k++) { const t = k / m, y = lerp(st.y1, st.y2, t) + rise * .5; const [x, , z] = at(t, lat + sd * .02, 0); parts.push({ g: new THREE.BoxGeometry(.09, .95, .09), m: mat4(x, y + .45, z, 1, 1, 1, ry), cfn: C_DARK, j: .05 }); }
      beam(parts, at(0, lat + sd * .02, st.y1 + rise * .5 + .92), at(1, lat + sd * .02, st.y2 + rise * .5 + .92), .08, .07, C_WOOD, .05);
    }
  } else if (st.type === 'built') {
    for (const t of [0, 1]) for (const sd of [-1, 1]) {
      const y = t ? st.y2 : st.y1, [x, , z] = at(t, sd * (w / 2 + .12), 0);
      parts.push({ g: new THREE.BoxGeometry(.36, 1.15, .36), m: mat4(x, y + .45, z, 1, 1, 1, ry), cfn: C_CONC, j: .02 });
      parts.push({ g: new THREE.BoxGeometry(.2, .2, .2), m: mat4(x, y + 1.13, z, 1, 1, 1, ry), c: col(0xffe7a0) });
    }
  }
  return makeGeo(parts, 33);
}
function rebuildStairs() {
  for (const c of [...stairGroup.children]) { c.geometry.dispose(); stairGroup.remove(c); }
  for (const st of stairs) { const m = new THREE.Mesh(geoStairs(st), propMat); m.castShadow = m.receiveShadow = true; stairGroup.add(m); }
  walkDirty = true;
}
// lays a bridge where a path crosses deep water (sample map)
function bridgeAlong(path, w, type = 'wood') {
  const pts = [];
  for (let k = 0; k < path.length - 1; k++) { const [ax, az] = path[k], [bx, bz] = path[k + 1], L = Math.hypot(bx - ax, bz - az); for (let d = 0; d < L; d += .25) pts.push([ax + (bx - ax) * d / L, az + (bz - az) * d / L]); }
  const wet = pts.map(([x, z]) => state.water - heightAt(x, z) > .3);
  const i0 = wet.indexOf(true), i1 = wet.lastIndexOf(true); if (i0 < 0) return;
  const a = pts[Math.max(0, i0 - 6)], c = pts[Math.min(pts.length - 1, i1 + 6)];
  placeBridge({ x: a[0], z: a[1] }, { x: c[0], z: c[1] }, w, type);
}

// ============================================================
// Player (walk mode)
// ============================================================
function geoHero() {
  const parts = [
    { g: new THREE.BoxGeometry(.2, .8, .22), m: mat4(-.13, .4, 0, 1, 1, 1), c: col(0x3a2c22) },
    { g: new THREE.BoxGeometry(.2, .8, .22), m: mat4(.13, .4, 0, 1, 1, 1), c: col(0x3a2c22) },
    { g: new THREE.BoxGeometry(.55, .65, .32), m: mat4(0, 1.12, 0, 1, 1, 1), c: col(0x2f5d9a) },
    { g: new THREE.BoxGeometry(.6, .1, .34), m: mat4(0, .82, 0, 1, 1, 1), c: col(0x5a3a1e) },
    { g: new THREE.BoxGeometry(.62, .9, .06), m: mat4(0, 1.0, -.2, 1, 1, 1, 0, .12), c: col(0xa8322a) },
    { g: new THREE.IcosahedronGeometry(.22, 1), m: mat4(0, 1.62, 0, 1, 1.05, 1), c: col(0xe8c4a0) },
    { g: new THREE.IcosahedronGeometry(.24, 1), m: mat4(0, 1.7, -.03, 1, .75, 1), c: col(0x6a3b1c) },
    { g: new THREE.BoxGeometry(.06, .7, .06), m: mat4(.38, 1.0, .12, 1, 1, 1, 0, .5), c: col(0xc9ccd2) },
  ];
  return makeGeo(parts, 21);
}
const hero = new THREE.Mesh(geoHero(), heroMat);
hero.castShadow = true; hero.visible = false; scene.add(hero);
const spawnMarker = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
spawnMarker.rotation.x = Math.PI; scene.add(spawnMarker);
const player = { x: 0, z: 0, y: 0, face: 0, moving: 0, t: 0 };
let colliders = null, colliderMaxR = 0;
function getColliders() {
  if (colliders) return colliders;
  colliders = new SpatialHash(4); colliderMaxR = 0;
  // each collider: [x, z, radius, bottom y, top y]
  const add = (x, z, r, y0, y1) => { colliders.add([x, z, r, y0, y1], x, z); colliderMaxR = Math.max(colliderMaxR, r); };
  for (const p of props) {
    const t = PROP[p[0]], r = t.r * p[4]; if (r <= 0) continue;
    const y0 = p[7] ?? heightAt(p[1], p[2]), y1 = y0 + t.height * p[4] * (p[6] ?? 1);
    if (t.offs) for (const [ox, oz] of t.offs) { const c = Math.cos(p[3]), sn = Math.sin(p[3]); add(p[1] + (ox * c + oz * sn) * p[4], p[2] + (-ox * sn + oz * c) * p[4], r, y0, y1); }
    else add(p[1], p[2], r, y0, y1);
  }
  for (const m of markers) if (isLink(m.kind)) { const sp = LINK_SPEC[m.kind], y0 = heightAt(m.x, m.z); for (const [lx, lz, r] of sp.solid) { const q = linkLocal(m, lx, lz); add(q.x, q.z, r, y0, y0 + sp.height); } }
  return colliders;
}
const inBounds = (x, z) => Math.abs(x) <= HALF - .8 && Math.abs(z) <= HALF - .8;
function overrideAt(x, z) { return O[idx(clamp(Math.round((x + HALF) * RES), 0, N - 1), clamp(Math.round((z + HALF) * RES), 0, N - 1))]; }
// the walkable steps of a 'stairs up' floor link: height above its base at editor-local z (null = off the steps)
function linkDeckAt(x, z, margin) {
  for (const m of markers) {
    if (m.kind !== 'up') continue;
    const dk = LINK_SPEC.up.deck, dx = x - m.x, dz = z - m.z, c = Math.cos(m.rot), s = Math.sin(m.rot), lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) > dk.halfWidth - margin || lz > dk.front || lz < dk.back + margin) continue;
    const i = Math.floor((dk.front - lz) / dk.run);
    return heightAt(m.x, m.z) + Math.min(i + 1, dk.steps) * dk.rise;
  }
  return null;
}
// footing on a bridge or stairs deck for a body of the given radius (null = no deck there)
function deckAt(x, z, margin) {
  if (bridges.length) { const y = bridgeAt(x, z, margin); if (y !== null) return { y, kind: 'bridge' }; }
  if (stairs.length) { const y = stairsAt(x, z, margin); if (y !== null) return { y, kind: 'stairs' }; }
  if (markers.length) { const y = linkDeckAt(x, z, margin); if (y !== null) return { y, kind: 'stairs' }; }
  return null;
}
// no collider within the agent's radius; with a deck height, only colliders overlapping [y, y + agent height] count
function bodyClear(x, z, y) {
  const ag = state.agent; let ok = true;
  getColliders().query(x, z, ag.radius + colliderMaxR, c => {
    if (ok && Math.hypot(c[0] - x, c[1] - z) < c[2] + ag.radius && (y === undefined || (c[4] > y + .05 && c[3] < y + ag.height))) ok = false;
  });
  return ok;
}
// Priority: forced blocked > structure deck > forced walkable / secret passage > automatic ground check.
// Where a deck exists (margin 0) its floor is the one used — by floorAt too — so the body must fit on it:
// agent radius from the deck edge and no obstacle on the deck; otherwise the point is blocked (no fallback to the ground below).
function walkable(x, z, autoCached) {
  if (!inBounds(x, z)) return false;
  const o = overrideAt(x, z);
  if (o === 2) return false;
  const d = deckAt(x, z, 0);
  if (d) return !!deckAt(x, z, state.agent.radius) && bodyClear(x, z, d.y);
  if (o === 1 || o === 3) return true;
  return autoCached ?? autoWalkable(x, z);
}
function autoWalkable(x, z) {
  if (!inBounds(x, z)) return false;
  if (state.water - heightAt(x, z) > state.agent.maxWaterDepth) return false;
  if (BIOME().lava && heightAt(x, z) < state.water + .05) return false;
  if (splatAt(x, z, 6) > .5) return false;
  if (slopeAt(x, z) > Math.tan(state.agent.maxSlopeDeg * Math.PI / 180)) return false;
  return bodyClear(x, z);
}

// walkability overlay: green = walkable, magenta = blocked, stripes = manual override
let walkDirty = true;
const wkGeo = new THREE.BufferGeometry();
wkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
wkGeo.setAttribute('walk', new THREE.BufferAttribute(new Float32Array(N * N), 1));
wkGeo.setAttribute('forced', new THREE.BufferAttribute(new Float32Array(N * N), 1));
wkGeo.setAttribute('secret', new THREE.BufferAttribute(new Float32Array(N * N), 1));
wkGeo.setIndex(gridIndex());
const walkOverlay = new THREE.Mesh(wkGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `attribute float walk; attribute float forced; attribute float secret; varying float vW; varying float vF; varying float vS; varying vec3 vP;
    void main(){ vW=walk; vF=forced; vS=secret; vec4 w=modelMatrix*vec4(position,1.); vP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying float vW; varying float vF; varying float vS; varying vec3 vP;
    void main(){
      float w=smoothstep(.45,.55,vW);
      vec3 c=mix(vec3(1.,.12,.82), vec3(.30,1.,.42), w);
      float a=mix(.64,.22,w);
      // manual overrides keep their diagonal stripes
      float stripe=step(.5,fract((vP.x+vP.z)*1.4));
      float f=smoothstep(.3,.7,vF);
      c=mix(c, c*1.3+.1, f*stripe); a+=f*stripe*.16;
      // bright line where walkable meets blocked (about 2px wide on screen)
      float dl=abs(vW-.5)/max(fwidth(vW),1e-4);
      float line=1.-smoothstep(1.,2.6,dl);
      c=mix(c, vec3(1.,.98,.80), line); a=mix(a,.96,line);
      // secret passages: cyan with cross-hatching and their own outline
      float sp=smoothstep(.45,.55,vS);
      float hatch=max(step(.78,fract((vP.x+vP.z)*1.1)), step(.78,fract((vP.x-vP.z)*1.1)));
      c=mix(c, mix(vec3(.15,.80,1.), vec3(.75,.97,1.), hatch), sp); a=mix(a, .55+.3*hatch, sp);
      float sl=1.-smoothstep(1.,2.6,abs(vS-.5)/max(fwidth(vS),1e-4));
      c=mix(c, vec3(.55,.95,1.), sl); a=mix(a,.97,sl);
      gl_FragColor=vec4(pow(c,vec3(2.2)),a);
      #include <colorspace_fragment>
    }`,
}));
walkOverlay.renderOrder = 6; walkOverlay.visible = false; scene.add(walkOverlay);
// Floor of each secret passage: harmonic interpolation between its entrances, so a passage
// through a cliff stays at ground level instead of climbing the rock. Entrances are the
// walkable cells next to the passage; ones more than 1.2m above the lowest entrance are
// ignored (they are the plateau tops beside a tunnel, not ways in).
function computeFloor() {
  F.set(H);
  const seen = new Uint8Array(N * N), nb = k => { const i = k % N, j = (k / N) | 0, r = []; if (i > 0) r.push(k - 1); if (i < N - 1) r.push(k + 1); if (j > 0) r.push(k - N); if (j < N - 1) r.push(k + N); return r; };
  const entry = k => O[k] === 1 || (O[k] === 0 && A[k]);
  for (let s0 = 0; s0 < N * N; s0++) {
    if (O[s0] !== 3 || seen[s0]) continue;
    const region = [s0]; seen[s0] = 1;
    for (let q = 0; q < region.length; q++) for (const n of nb(region[q])) if (O[n] === 3 && !seen[n]) { seen[n] = 1; region.push(n); }
    let base = Infinity;
    for (const k of region) for (const n of nb(k)) if (O[n] !== 3 && entry(n)) base = Math.min(base, H[n]);
    if (base === Infinity) continue;               // no way in: keep the terrain height
    const ok = n => O[n] !== 3 && entry(n) && H[n] <= base + 1.2;
    for (const k of region) F[k] = base;
    const iters = Math.min(800, 40 + region.length * 2);
    for (let it = 0; it < iters; it++) for (const k of region) {
      let sum = 0, cnt = 0;
      for (const n of nb(k)) { if (O[n] === 3) { sum += F[n]; cnt++; } else if (ok(n)) { sum += H[n]; cnt++; } }
      if (cnt) F[k] = sum / cnt;
    }
  }
}
// ground height for the walking character; passages use their own floor
function floorAt(x, z) {
  if (walkDirty) computeWalk();
  const d = deckAt(x, z, 0); if (d) return d.y;   // same floor choice as walkable()
  const fx = (x + HALF) * RES, fz = (z + HALF) * RES;
  const i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fz), 0, N - 2), k = idx(i, j);
  const ks = [k, k + 1, k + N, k + N + 1];
  if (!ks.some(c => O[c] === 3)) return heightAt(x, z);
  const near = idx(clamp(Math.round(fx), 0, N - 1), clamp(Math.round(fz), 0, N - 1)), c0 = O[near] === 3 ? F[near] : H[near];
  const v = ks.map(c => { const h = O[c] === 3 ? F[c] : H[c]; return Math.abs(h - c0) > 1.2 ? c0 : h; });
  const u = clamp(fx - i, 0, 1), w = clamp(fz - j, 0, 1);
  return lerp(lerp(v[0], v[1], u), lerp(v[2], v[3], u), w);
}
function computeWalk() {
  const pos = wkGeo.attributes.position.array, wa = wkGeo.attributes.walk.array, fa = wkGeo.attributes.forced.array;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = idx(i, j), x = vx(i), z = vx(j);
    A[k] = autoWalkable(x, z) ? 1 : 0;
  }
  computeFloor();
  const sa = wkGeo.attributes.secret.array;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = idx(i, j), x = vx(i), z = vx(j), o = O[k];
    wa[k] = walkable(x, z, A[k] === 1) ? 1 : 0; fa[k] = o === 1 || o === 2 ? 1 : 0; sa[k] = o === 3 ? 1 : 0;
    pos[k * 3] = x; pos[k * 3 + 1] = Math.max(H[k], state.water) + .06; pos[k * 3 + 2] = z;
  }
  for (const n of ['position', 'walk', 'forced', 'secret']) wkGeo.attributes[n].needsUpdate = true;
  wkGeo.computeBoundingSphere();
  walkDirty = false;
}
function applyDim(v) {
  dimU.value = v;
  const see = v > .01;
  for (const m of [propMat, rockMat]) {
    if (m.transparent !== see) { m.transparent = see; m.depthWrite = !see; m.needsUpdate = true; }
    m.opacity = 1 - .55 * v;
  }
  // draw props after the overlay so the colours show through them
  for (const m of propMeshes) m.renderOrder = see ? 7 : 0;
}
function setWalkView(on) {
  state.showWalk = on; walkOverlay.visible = on; $('walkView').classList.toggle('on', on);
  if (on && walkDirty) computeWalk();
}

// ============================================================
// Camera
// ============================================================
const cam = { yaw: Math.PI / 4, pitch: .95, dist: 88 * Math.max(.5, SIZE / 64), target: new THREE.Vector3(0, 2, 0) };
const playCam = { yaw: Math.PI / 4, pitch: .9, dist: 17 };
function placeCamera(c, target) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  camera.position.set(target.x + Math.sin(c.yaw) * cp * c.dist, target.y + sp * c.dist, target.z + Math.cos(c.yaw) * cp * c.dist);
  camera.lookAt(target);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // keep the scene centred in the area not covered by the edit panel
  if (state.mode === 'edit' && w > 700) camera.setViewOffset(w, h, -139, 0, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ============================================================
// Editing
// ============================================================
const TOOLS = [
  { id: 'plateau', name: '台地', key: '1', hint: 'ドラッグ: 一段高い台地（崖つき）。Shift+ドラッグ: 一段低く。' },
  { id: 'raise', name: '上げる', key: '2', hint: 'なだらかに盛り上げます。' },
  { id: 'lower', name: '下げる', key: '3', hint: 'なだらかに掘り下げます。水位より下は水になります。' },
  { id: 'flat', name: '平らに', key: '4', hint: 'ドラッグ開始地点の高さにそろえます。' },
  { id: 'smooth', name: 'なだらか', key: '5', hint: '段差や凸凹をならします。' },
  { id: 'grass', name: '草', key: '6', hint: '土・石畳・砂・荒れ地・沼などを消して草に戻します。' },
  { id: 'dirt', name: '土', key: '7', hint: '土の道を塗ります。' },
  { id: 'cobble', name: '石畳', key: '8', hint: '石畳を塗ります。' },
  { id: 'sand', name: '砂地', key: 'z', hint: '風紋のある砂地を塗ります。歩くと少し遅くなります（×0.85）。' },
  { id: 'rubble', name: '荒れ地', key: 'x', hint: 'ひび割れた乾いた地面に石が転がる荒れ地を塗ります。塗り終えると小石が自動で散らばります（×0.8）。' },
  { id: 'swamp', name: '沼地', key: 'c', hint: 'ぬかるみと濁った水たまりの沼地を塗ります。葦や枯れ木が自動で生えます。歩くと遅くなります（×0.55）。' },
  { id: 'coast', name: '海岸', key: 'l', hint: '砂浜にしたい所から海の方向へドラッグします。その先が砂浜と海になり、波が打ち寄せます。' },
  { id: 'lava', name: '溶岩', key: 'u', hint: '黒い溶岩の殻と、光りながら流れるマグマを塗ります。歩けません（通行不可）。' },
  { id: 'snowfield', name: '雪', key: 'y', hint: '雪原を塗ります。歩くと少し遅くなります（×0.8）。' },
  { id: 'ice', name: '氷', key: 'i', hint: 'ひび割れた氷の地面を塗ります（つるつる。ゲーム側で滑る床として扱えます）。' },
  { id: 'poison', name: '毒沼', key: 'f', hint: '光る毒の泡がわく毒沼を塗ります。歩くと遅くなり、ゲーム側でダメージ地帯として扱えます。' },
  { id: 'scatter', name: '小物を撒く', key: '9', hint: 'チェックした種類を撒きます。水中・急斜面・道の上は避けます。' },
  { id: 'erase', name: '小物を消す', key: '0', hint: 'チェックした種類だけを消します。' },
  { id: 'slope', name: '坂', key: 'n', hint: '下から上へドラッグすると、歩いて上り下りできるゆるやかな坂を作ります（幅＝半径）。急すぎる場合は作りません。' },
  { id: 'stairs', name: '階段', key: 'm', hint: '段差をまたいでドラッグすると階段を作ります（幅＝半径の半分）。種類は下の「種類」から選びます。' },
  { id: 'bridge', name: '橋', key: 'b', hint: '岸から岸へドラッグすると橋を架けます（幅＝半径の半分、1.6〜4m）。種類は下の「種類」から。Shift+クリックで近くの橋を消します。' },
  { id: 'fall', name: '滝', key: '=', hint: '崖をクリックすると、縁から水面へ落ちる滝を置きます（幅＝半径の半分）。Shift+クリックで近くの滝を消します。' },
  { id: 'place', name: '置く', key: 'p', hint: '「種類」で選んだ物を、クリックした場所に1つ置きます。R キーで向きを45°回転。' },
  { id: 'pick', name: '選んで消す', key: 'o', hint: 'カーソルを合わせると赤く囲まれた物（木・岩・橋・階段・滝など）を、クリックで1つ消します。' },
  { id: 'marker', name: 'マーカー', key: 't', hint: '出入口・敵の候補・宝箱の候補・戦闘/出現禁止範囲を置きます。出入口は、置く場所から部屋の内側へドラッグ（クリックだけなら中央向き）。幅＝半径の半分。禁止範囲の大きさ＝半径。Shift+クリックで近くのマーカーを消します。' },
  { id: 'cliffpaint', name: '岩壁を塗る', key: '.', hint: '崖の面と岩・崖石の種類を、場所ごとに塗り分けます。「マップの既定」で塗ると、バイオーム欄の「岩壁」の設定に戻ります。平らな地面を塗っても見た目は変わりません（崖と岩にだけ効きます）。' },
  { id: 'link', name: '階層移動', key: ',', hint: '魔法陣・上り階段・下り階段を置きます。置く場所から、プレイヤーが近づいてくる側へドラッグすると向きが決まります（クリックだけなら部屋の中央向き）。タグには行き先（例: B2, 上の階）を入れます。Shift+クリックで近くの物を消します。歩くモードで触れると表示が出ます。' },
  { id: 'spawn', name: '開始地点', key: '-', hint: 'クリックした場所を、歩くモードの開始地点にします。' },
  { id: 'walkOn', name: '通行可', key: 'g', hint: '塗った所を、自動判定に関係なく「通れる」にします（緑の斜線）。崖や水の上でも歩けます。' },
  { id: 'walkOff', name: '通行不可', key: 'h', hint: '塗った所を、自動判定に関係なく「通れない」にします（赤紫の斜線）。見えない壁などに使います。' },
  { id: 'secret', name: '隠し通路', key: 'k', hint: '茂み・岩・崖の中を通り抜けられる隠し通路を塗ります（水色）。通路の床は入口と出口の地面の高さでつながり、キャラが入ると重なった物が透けます。' },
  { id: 'walkAuto', name: '自動に戻す', key: 'j', hint: '塗った所の上書きを消し、自動判定に戻します。' },
];
const undoStack = [], redoStack = [];
const snapshot = () => ({ H: H.slice(), S: S.slice(), O: O.slice(), C: C.slice(), P: props.map(p => p.slice()), F: falls.map(f => ({ ...f })), B: bridges.map(b => ({ ...b })), T: stairs.map(st => ({ ...st })), W: state.water, sp: { ...state.spawn }, bi: state.biome, at: { ...state.atmo }, sea: state.sea, we: { ...state.weather }, sun: state.sunOn, M: markers.map(m => ({ ...m })), nid: state.nextId, rid: state.roomId, cat: JSON.stringify(state.catalog), ag: { ...state.agent }, cs: state.cliffStyle });
function restore(s) { H.set(s.H); S.set(s.S); O.set(s.O); if (s.C) C.set(s.C); else C.fill(0); walkDirty = true; props = s.P.map(p => p.slice()); falls = s.F.map(f => ({ ...f })); bridges = s.B.map(b => ({ ...b })); stairs = (s.T || []).map(st => ({ ...st })); state.water = s.W; state.spawn = { ...s.sp }; if (s.at) state.atmo = { ...s.at }; if (s.we) state.weather = { ...s.we }; state.sunOn = s.sun !== false; markers = (s.M || []).map(m => ({ ...m })); state.nextId = s.nid || state.nextId; state.roomId = s.rid || state.roomId; if (s.cat) { state.catalog = JSON.parse(s.cat); applyCatalog(); } if (s.ag) { state.agent = { ...s.ag }; syncAgentUI(); colliders = null; } state.cliffStyle = s.cs || 'standard'; applyCliffStyle(); if ($('cliffStyle')) $('cliffStyle').value = state.cliffStyle; rebuildMarkers(); state.sea = !!s.sea; applyBiome(s.bi || state.biome); syncUI(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); toast('取り消し'); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); toast('やり直し'); }

const stroke = { active: false, base: 0, lower: false, lastStamp: null };
let hit = null;
function forBrush(x, z, r, fn) {
  const i0 = clamp(Math.floor((x - r + HALF) * RES), 0, N - 1), i1 = clamp(Math.ceil((x + r + HALF) * RES), 0, N - 1);
  const j0 = clamp(Math.floor((z - r + HALF) * RES), 0, N - 1), j1 = clamp(Math.ceil((z + r + HALF) * RES), 0, N - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(vx(i) - x, vx(j) - z); if (d < r) fn(idx(i, j), d, vx(i), vx(j)); }
}
const soft = (d, r) => { const t = 1 - d / r; return t <= 0 ? 0 : t * t * (3 - 2 * t); };
function applyBrush(x, z, dt) {
  const r = state.radius, k = state.strength, tool = state.tool;
  if (tool === 'plateau') {
    const target = stroke.base + (stroke.lower ? -STEP : STEP);
    forBrush(x, z, r * 1.1, (i, d, px, pz) => {
      const dd = d + (fbm(px * .45 + 3, pz * .45) - .5) * r * .35;
      const w = sstep(r, r * .8, dd);
      if (w > 0) H[i] = lerp(H[i], target, Math.min(1, w * (.35 + k)));
    });
  } else if (tool === 'raise' || tool === 'lower') {
    const sgn = tool === 'raise' ? 1 : -1;
    forBrush(x, z, r, (i, d) => { H[i] += sgn * soft(d, r) * k * 4 * dt; });
  } else if (tool === 'flat') {
    forBrush(x, z, r, (i, d) => { H[i] = lerp(H[i], stroke.base, Math.min(1, soft(d, r) * k * 8 * dt)); });
  } else if (tool === 'smooth') {
    const src = H.slice();
    forBrush(x, z, r, (i, d) => {
      const ii = i % N, jj = (i / N) | 0;
      if (ii < 1 || jj < 1 || ii > N - 2 || jj > N - 2) return;
      const avg = (src[i - 1] + src[i + 1] + src[i - N] + src[i + N] + src[i]) / 5;
      H[i] = lerp(H[i], avg, Math.min(1, soft(d, r) * k * 10 * dt));
    });
  } else if (tool === 'cliffpaint') {
    const v = state.variant.cliffpaint;
    forBrush(x, z, r, (i, d, px, pz) => { if (d + (fbm(px * .5 + 7, pz * .5) - .5) * r * .3 < r) C[i] = v; });
    stroke.cliffChanged = true;
  } else if (tool === 'walkOn' || tool === 'walkOff' || tool === 'walkAuto' || tool === 'secret') {
    const v = tool === 'walkOn' ? 1 : tool === 'walkOff' ? 2 : tool === 'secret' ? 3 : 0;
    forBrush(x, z, r, i => { O[i] = v; });
    walkDirty = true;
  } else if (tool === 'grass' || GROUND.includes(tool)) {
    const ch = GROUND.indexOf(tool);
    if (ch >= 3) stroke.groundChanged = true;
    forBrush(x, z, r, (i, d) => {
      const a = soft(d, r) * k * 700 * dt;
      for (let c = 0; c < NS; c++) S[i * NS + c] = clamp(S[i * NS + c] + (c === ch ? a : -a), 0, 255);
    });
  }
}
function buildPropHash() { const h = new SpatialHash(4); for (const p of props) h.add(p, p[1], p[2]); return h; }
function canPlace(t, x, z, hash) {
  if (Math.abs(x) > HALF - 1.2 || Math.abs(z) > HALF - 1.2) return false;
  if (heightAt(x, z) < state.water + (PROP[t].id === 'reed' ? -.45 : .3)) return false;
  if (slopeAt(x, z) > PROP[t].slope) return false;
  if (!PROP[t].anyGround && (splatAt(x, z, 0) > .45 || splatAt(x, z, 1) > .4)) return false;
  if (PROP[t].tree && (splatAt(x, z, 2) + splatAt(x, z, 4) + splatAt(x, z, 5) > .45)) return false;
  if (splatAt(x, z, 6) > .35) return false;
  let ok = true;
  hash.query(x, z, 3.5, p => { if (ok && Math.hypot(p[1] - x, p[2] - z) < (PROP[t].min + PROP[p[0]].min) * .5) ok = false; });
  return ok;
}
function scatterAt(x, z, R = Math.random) {
  const types = [...state.types].filter(propVisible); if (!types.length) return;
  const r = state.radius, hash = buildPropHash(), n = Math.max(1, Math.round(Math.PI * r * r * state.density * .22));
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, t = types[(R() * types.length) | 0];
    if (!canPlace(t, px, pz, hash)) continue;
    const s = lerp(PROP[t].sc[0], PROP[t].sc[1], R());
    const p = [t, px, pz, R() * Math.PI * 2, s, 0]; props.push(p); hash.add(p, px, pz);
  }
  rebuildProps();
}
const TYPE = id => PROP.findIndex(t => t.id === id);
function regenGroundProps() {
  props = props.filter(p => p[5] !== 2);
  const hash = buildPropHash(), add = (t, x, z, s) => { const p = [t, x, z, hash2(x * 31 | 0, z * 17 | 0) * 6.28, s, 2]; props.push(p); hash.add(p, x, z); };
  const free = (x, z, d) => { let ok = true; hash.query(x, z, 2.5, p => { if (ok && Math.hypot(p[1] - x, p[2] - z) < d) ok = false; }); return ok; };
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = idx(i, j), rb = S[k * NS + 3] / 255, sw = S[k * NS + 4] / 255, po = S[k * NS + 5] / 255;
    if (rb < .45 && sw < .45 && po < .45) continue;
    const h1 = hash2(i * 7 + 3, j * 13 + 5), h2 = hash2(i * 11 + 1, j * 3 + 9);
    const x = vx(i) + (h2 - .5) * .45, z = vx(j) + (hash2(i, j * 5) - .5) * .45;
    if (heightAt(x, z) < state.water - .45 || slopeAt(x, z) > 1.2) continue;
    if (rb >= .45) {
      if (h1 < .16 * rb && free(x, z, .4)) add(TYPE('pebble'), x, z, .6 + h2 * 1.1);
      else if (h1 > .992 && free(x, z, 1.2)) add(TYPE('rock'), x, z, .45 + h2 * .4);
    }
    if (sw >= .45) {
      if (h1 < .045 * sw && free(x, z, .7)) add(TYPE('reed'), x, z, .8 + h2 * .5);
      else if (h1 > .9975 && free(x, z, 2.5)) add(TYPE('deadtree'), x, z, .8 + h2 * .4);
      else if (h1 > .985 && h1 < .99 && free(x, z, .5)) add(TYPE('mushroom'), x, z, .8 + h2 * .6);
    }
    if (po >= .45) {
      if (h1 > .996 && free(x, z, 2.5)) add(TYPE('deadtree'), x, z, .7 + h2 * .3);
      else if (h1 < .02 && free(x, z, .5)) add(TYPE('pebble'), x, z, .5 + h2 * .5);
    }
  }
  rebuildProps();
}
function eraseAt(x, z) {
  const r = state.radius, n0 = props.length;
  props = props.filter(p => !(state.types.has(p[0]) && propVisible(p[0]) && Math.hypot(p[1] - x, p[2] - z) < r));
  if (props.length !== n0) rebuildProps();
}
// keeps generated rocks off waterfalls (their sheet and stream) and bridge decks
function nearFeature(x, z) {
  for (const f of falls) {
    const [ux, uz] = fallDir(f), cx = f.x + ux, cz = f.z + uz, ax = x - cx, az = z - cz;
    if (Math.abs(ax * uz - az * ux) < f.w * .5 + .35 && Math.abs(ax * ux + az * uz) < 2) return true;
    if (f.sx !== undefined && distToPolyline(x, z, [[cx, cz], [f.sx, f.sz]]) < f.w * .5 + .8) return true;
  }
  for (const b of bridges) if (distToPolyline(x, z, [[b.x1, b.z1], [b.x2, b.z2]]) < b.w / 2 + .8) return true;
  for (const st of stairs) if (distToPolyline(x, z, [[st.x1, st.z1], [st.x2, st.z2]]) < st.w / 2 + .9) return true;
  return false;
}
const nearEdge = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > HALF - 2.5;   // the map's outer rim is left alone
function autoRocks(seed = Date.now()) {
  const R = rng(seed | 0);
  props = props.filter(p => p[5] !== 1);
  const hash = buildPropHash();
  // stacked stone columns that dress every cliff face
  const ch = new SpatialHash(3), e = .4;
  const pts = [];
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) pts.push([vx(i) + (R() - .5) * .4, vx(j) + (R() - .5) * .4]);
  for (let k = pts.length - 1; k > 0; k--) { const m = (R() * (k + 1)) | 0; [pts[k], pts[m]] = [pts[m], pts[k]]; }
  for (const [x, z] of pts) {
    if (nearEdge(x, z) || slopeAt(x, z) < 1.3 || nearFeature(x, z)) continue;
    const gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz);
    const ux = gx / gl, uz = gz / gl;
    let hT = heightAt(x, z), hB = hT;
    for (let d = .25; d <= 2.5; d += .25) { hT = Math.max(hT, heightAt(x + ux * d, z + uz * d)); hB = Math.min(hB, heightAt(x - ux * d, z - uz * d)); }
    const drop = hT - hB; if (drop < .9) continue;
    const px = x - ux * .35, pz = z - uz * .35;
    if (nearEdge(px, pz)) continue;
    let ok = true; ch.query(px, pz, 2, p => { if (ok && Math.hypot(p[1] - px, p[2] - pz) < 1.45) ok = false; });
    if (!ok) continue;
    const below = Math.max(hB, state.water - .6), span = hT - below - .05;
    const layers = Math.max(1, Math.round(span / 2.3)), rot = Math.atan2(-ux, -uz);
    for (let L = 0; L < layers; L++) {
      // upper layers step back into the cliff a little, like weathered strata
      const back = (L - (layers - 1) / 2) * .18, w = .95 + R() * .25;
      const p = [4, px + ux * back, pz + uz * back, rot + (R() - .5) * .35, w, 1, span / layers / 2.25, below - .1 + span * L / layers];
      props.push(p); if (L === 0) ch.add(p, px, pz);
    }
  }
  for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
    const x = vx(i) + (R() - .5) * .5, z = vx(j) + (R() - .5) * .5, s = slopeAt(x, z);
    if (nearEdge(x, z) || s < 1.1 || R() > .07 || nearFeature(x, z)) continue;
    // drop to the foot or the lip of the cliff, whichever is lower-risk to overlap
    const e = .4, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz) || 1;
    const foot = R() < .7, off = foot ? -1.1 : .9;
    const px = x + gx / gl * off, pz = z + gz / gl * off;
    if (nearEdge(px, pz)) continue;
    let ok = true; hash.query(px, pz, 3, p => { if (ok && Math.hypot(p[1] - px, p[2] - pz) < 1.2) ok = false; });
    if (!ok) continue;
    const p = [2, px, pz, R() * Math.PI * 2, (foot ? 1.1 : .7) + R() * 1.1, 1]; props.push(p); hash.add(p, px, pz);
  }
  rebuildProps();
}

// ============================================================
// Sample / new maps
// ============================================================
// a different map size needs freshly sized buffers: hand the next step to the reloaded page
function reloadAtSize(size, pending) {
  try { sessionStorage.setItem('me_pending', pending); } catch (e) { return false; }
  location.hash = 'size=' + size; location.reload(); return true;
}
// Sample 2 (48m, ruins): a rock ridge cuts the room in two; the northern sanctum is reached only by a secret
// passage through the ridge (no other route), with a hidden staircase down inside.
const SAMPLE2_SIZE = 48;
const secretLineX = z => -7 + 1.3 * Math.sin((z - 2) / 9 * Math.PI);   // centre line of the hidden way (bends a little)
function genSample2(seed = 11) {
  C.fill(0);
  state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = [];
  state.sea = false; S.fill(0); O.fill(0); bridges = []; stairs = []; falls = []; props = [];
  state.biome = 'ruins'; state.water = .4;
  const R = rng(seed);
  const dirt = [[[0, -24], [0, -12]], [[-24, -8], [-12, -10], [0, -12]], [[0, -12], [7, -8], [13, -4]], [[-6.2, 13], [-5, 14.5], [-3, 15.5]]];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = vx(i), z = vx(j), k = idx(i, j);
    let h = 3 + (fbm(x * .07 + 5, z * .07) - .5) * .8 + (fbm(x * .25, z * .25) - .5) * .2;
    const d = Math.max(Math.abs(x), Math.abs(z)) / HALF, rn = (fbm(x * .15 + 3, z * .15) - .5) * .06;
    const gapS = sstep(3.4, 2.2, Math.abs(x)) * sstep(.5, .7, -z / HALF), gapW = sstep(3.4, 2.2, Math.abs(z + 8)) * sstep(.5, .7, -x / HALF);
    h += 5.5 * sstep(.84 + rn, .95 + rn, d) * (1 - Math.max(gapS, gapW));
    // the ridge
    const rz = 6.5 + (fbm(x * .12 + 7, 1.3) - .5) * 2.4, half = 2.3 + (fbm(x * .2, 9.1) - .5) * .8, rq = sstep(half + 1.1, half, Math.abs(z - rz));
    h = Math.max(h, 3 + rq * (5.3 + (fbm(x * .4, z * .4) - .5) * 1.2));
    H[k] = h;
    if (z > 1 && z < 12 && Math.abs(x - secretLineX(z)) <= 1.05) O[k] = 3;
    // paint: dirt paths, a cobbled plaza at the spawn, a cobbled floor in the sanctum, rubble in the south-east
    const dp = Math.min(...dirt.map(pl => distToPolyline(x, z, pl))) + (fbm(x * .35, z * .35) - .5) * 1.4;
    S[k * NS] = clamp(sstep(2.0, .7, dp) * 255 + sstep(.68, .9, fbm(x * .12 + 30, z * .12)) * 120, 0, 255);
    const pl = Math.min(Math.hypot(x, z + 12) - 5, Math.hypot(x + 3, z - 16) - 4.6) + (fbm(x * .5, z * .5) - .5) * 1.2;
    S[k * NS + 1] = clamp(sstep(.6, -.6, pl) * 255, 0, 255);
    S[k * NS + 3] = clamp(sstep(5.5, 2.5, Math.hypot(x - 14, z + 14) + (fbm(x * .4 + 2, z * .4) - .5) * 2) * 255, 0, 255);
  }
  state.spawn = { x: 0, z: -12 };
  applyBiome('ruins');
  const hash = buildPropHash(), keepClear = (x, z) => (z > -1.5 && z < 14 && Math.abs(x - secretLineX(clamp(z, 1, 12))) < 2.8) || Math.hypot(x, z + 12) < 4.5;
  for (let k = 0; k < 5000; k++) {
    const x = (R() - .5) * (SIZE - 3), z = (R() - .5) * (SIZE - 3), d = Math.max(Math.abs(x), Math.abs(z)) / HALF, f = fbm(x * .08 + 11, z * .08);
    const dens = d > .7 ? .35 + f * .45 : sstep(.55, .72, f) * .6;
    if (R() > dens * .32 * BIOME().flora.density || keepClear(x, z)) continue;
    const t = pickFlora(R, d > .66 ? BIOME().flora.rim : BIOME().flora.inner);
    if (!canPlace(t, x, z, hash)) continue;
    const p = [t, x, z, R() * Math.PI * 2, lerp(PROP[t].sc[0], PROP[t].sc[1], R()), 0]; props.push(p); hash.add(p, x, z);
  }
  autoRocks(seed * 13); regenGroundProps();
  props = props.filter(p => !keepClear(p[1], p[2]));
  // hints and decoration: a weathered stele near the hidden way, bushes in front of it, columns around the sanctum stairs
  const put = (id, x, z, r = 0, s = 1) => props.push([TYPE(id), x, z, r, s, 0]);
  put('stele', secretLineX(1) + 3.0, -.6, .3); put('bush', secretLineX(1) - 2.0, .4, 0, 1.1); put('bush', secretLineX(1) + 1.9, 1.2, 1, .9);
  for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2 + .3; if (Math.cos(t) < -.6) continue; put(a % 2 ? 'brokencol' : 'column', -3 + Math.sin(t) * 5.6, 16 + Math.cos(t) * 5.6, t); }
  put('statue', 5.5, 19.5, Math.PI); put('torch', -6.6, 13.2); put('torch', -.4, 12.2);
  for (const [kind, x, z, cx, cz] of [['port', 0, -22.6, 0, -19], ['port', -21.1, -8, -17.5, -8], ['enemy', 9, -7], ['enemy', -12.38, -14.08], ['enemy', 13, -15],
    ['chest', 5.71, 15.71], ['nobattle', 0, -12], ['warp', 14, -3, 10, -6], ['down', -3, 16.5, -3, 12]]) {
    if (kind === 'port' || isLink(kind)) placeMarker(kind, { x, z }, cx === undefined ? null : { x: cx, z: cz }); else { placeMarker(kind, { x, z }); if (kind === 'nobattle') markers[markers.length - 1].r = 4; }
  }
  for (const m of markers) m.tag = m.kind === 'port' ? 'field' : m.kind === 'down' ? 'B2_hidden' : m.kind === 'warp' ? 'hub' : '';
  props = props.filter(p => !markers.some(m => isLink(m.kind) && Math.hypot(p[1] - m.x, p[2] - m.z) < 3.4 + PROP[p[0]].r * p[4]));
  rebuildProps(); ensureIds(); rebuildMarkers();
}
function genFlat() { C.fill(0); state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = []; state.sea = false; H.fill(3); S.fill(0); O.fill(0); props = []; falls = []; bridges = []; stairs = []; state.water = .8; state.spawn = { x: 0, z: 0 }; }
function pickFlora(R, list) {
  let tot = 0; for (const [, w] of list) tot += w;
  let r = R() * tot; for (const [id, w] of list) { r -= w; if (r <= 0) return TYPE(id); }
  return TYPE(list[0][0]);
}
function genSample(seed = 7) {
  C.fill(0);
  state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = [];
  state.sea = false; S.fill(0);   // channels 2+ are only ever raised below, so start clean
  O.fill(0); bridges = []; stairs = []; falls = []; props = [];   // nothing from the previous map may steer the generator
  const R = rng(seed), WL = .8;
  const river = [[20, -34], [17, -20], [12, -8], [9, 2], [11, 12], [17, 22], [22, 34]];
  const path1 = [[0, -34], [-1, -20], [-3, -8], [-2, 4], [1, 16], [0, 28]];
  const path2 = [[-34, 8], [-20, 6], [-8, 4], [-2, 4]];
  const path3 = [[-2, 4], [9, 5], [16, 4], [34, 3]];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = vx(i), z = vx(j), k = idx(i, j);
    let h = 3 + (fbm(x * .05 + 3, z * .05) - .5) * 1.3 + (fbm(x * .2, z * .2) - .5) * .3;
    const d = Math.max(Math.abs(x), Math.abs(z)) / HALF, wn = (fbm(x * .09 + 9, z * .09) - .5) * .14;
    let wall = sstep(.79, .84, d + wn) * 4.5 + sstep(.88, .92, d + wn * 1.3) * 3;
    const gapN = 1 - (1 - sstep(2.5, 5, Math.abs(x + 1))) * sstep(.6, .8, -z / HALF);
    const gapW = 1 - (1 - sstep(2.5, 5, Math.abs(z - 7))) * sstep(.6, .8, -x / HALF);
    const gapE = 1 - (1 - sstep(2.5, 5, Math.abs(z - 3))) * sstep(.6, .8, x / HALF);
    wall *= gapN * gapW * gapE;
    h += wall;
    // central outcrop and a smaller hill
    const o1 = Math.hypot(x + 9, z + 6) + (fbm(x * .4, z * .4) - .5) * 2.4;
    h += sstep(6.4, 5.4, o1) * 2.4 + sstep(3.2, 2.6, o1 + .6) * 1.6;
    const o2 = Math.hypot(x + 19, z - 18) + (fbm(x * .4 + 7, z * .4) - .5) * 2;
    h += sstep(4.4, 3.6, o2) * 2.2;
    // river + pond
    const dr = distToPolyline(x, z, river), w = 3.1 + 1.1 * Math.sin(z * .18) + (fbm(x * .2, z * .2) - .5) * 1.2;
    const ford = 0;
    let bed = lerp(WL - .9 - .9 * sstep(w * .8, 0, dr), WL - .32, ford);
    h = lerp(h, bed, sstep(w + 1.7, w - .2, dr));
    const dp = Math.hypot(x + 15, z - 4) + (fbm(x * .3, z * .3 + 4) - .5) * 2.5;
    h = lerp(h, WL - 1.1 - .6 * sstep(5, 0, dp), sstep(6.8, 5.2, dp));
    H[k] = h;
    // splat
    const dpath = Math.min(distToPolyline(x, z, path1), distToPolyline(x, z, path2), distToPolyline(x, z, path3)) + (fbm(x * .35, z * .35) - .5) * 1.6;
    S[k * NS] = clamp(sstep(2.2, .8, dpath) * 255 + sstep(.7, .9, fbm(x * .12 + 30, z * .12)) * 140, 0, 255);
    S[k * NS + 1] = clamp(sstep(3.2, 2.2, Math.hypot(x - 10, z - 5) + (fbm(x * .5, z * .5) - .5)) * 255, 0, 255) * (h > WL - .4 ? 1 : 0);
  }
  state.water = WL; state.spawn = { x: 1, z: 20 }; props = [];
  // forests: dense near the rim, clumps inside
  const hash = buildPropHash();
  for (let k = 0; k < 9000; k++) {
    const x = (R() - .5) * (SIZE - 3), z = (R() - .5) * (SIZE - 3), d = Math.max(Math.abs(x), Math.abs(z)) / HALF, f = fbm(x * .08 + 11, z * .08);
    const dens = d > .7 ? .35 + f * .45 : sstep(.62, .74, f) * .55;
    if (R() > dens * .3 * BIOME().flora.density) continue;
    const t = pickFlora(R, d > .66 ? BIOME().flora.rim : BIOME().flora.inner);
    if (!canPlace(t, x, z, hash)) continue;
    const p = [t, x, z, R() * Math.PI * 2, lerp(PROP[t].sc[0], PROP[t].sc[1], R()), 0]; props.push(p); hash.add(p, x, z);
  }
  for (let k = 0; k < 500; k++) {
    const x = (R() - .5) * (SIZE - 4), z = (R() - .5) * (SIZE - 4);
    const st = TYPE(BIOME().flora.small);
    if (!canPlace(st, x, z, hash) || R() < .4) continue;
    const p = [st, x, z, R() * 6.28, lerp(.7, 1.4, R()), 0]; props.push(p); hash.add(p, x, z);
  }
  // ground types: rubble in the north-west, a bog with a poison pool in the south-west, sandy river banks
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = vx(i), z = vx(j), k = idx(i, j), n = (fbm(x * .3 + 40, z * .3) - .5) * 2.2, h = H[k];
    if (h < WL - .2) continue;
    const put = (c, v) => { if (state.biome === 'forest' ? c > 5 : !GTOOL_TAGS[GROUND[c]].includes(state.biome)) return; if (v > 0) { S[k * NS + c] = Math.max(S[k * NS + c], clamp(v * 255, 0, 255)); for (const o of [0, 1]) S[k * NS + o] = Math.round(S[k * NS + o] * (1 - clamp(v, 0, 1))); } };
    put(3, sstep(6.5, 4.5, Math.hypot(x + 20, z + 19) + n));
    put(4, sstep(5.2, 3.4, Math.hypot(x + 6, z - 12) + n) * (h < 4.2 ? 1 : 0));
    put(5, sstep(2.2, 1.3, Math.hypot(x + 7.2, z - 12.8) + n * .6) * (h < 4.2 ? 1 : 0));
    put(6, sstep(4.2, 2.6, Math.hypot(x + 20, z + 19) + n) + sstep(1.6, .8, distToPolyline(x, z, [[-20, -19], [-12, -24], [-6, -27]]) + n * .4));
    put(2, sstep(2.4, 1.2, distToPolyline(x, z, river) - (3.1 + 1.1 * Math.sin(z * .18)) - 1.8 + n * .5) * (x > 12 && z > 6 ? 1 : 0));
  }
  autoRocks(seed * 13);
  falls = []; autoFalls(R);
  bridgeAlong(path3, 2.6);
  bridgeAlong([[8, -21], [27, -21]], 1.6, 'vine');
  placeStairs({ x: -9, z: 3.1 }, { x: -9, z: -4.9 }, 2, 'stone');
  placeSlope({ x: -11.5, z: 18 }, { x: -16.8, z: 18 }, 3);
  if (state.biome === 'beach') makeCoast({ x: 10, z: 0 }, { x: 28, z: 0 });
  const lm = BIOME().landmark;
  if (lm) {
    const t = TYPE(lm[0]), r = PROP[t].r + 2.5;
    props = props.filter(p => Math.hypot(p[1] - lm[1], p[2] - lm[2]) > r + PROP[p[0]].r);
    props.push([t, lm[1], lm[2], .4, 1, 0]); rebuildProps();
  }
  regenGroundProps();
  for (const [kind, x, z, cx, cz] of [['port', 0, -28.5, 0, -26], ['port', -28, 7, -25.5, 7], ['enemy', -7.5, 6], ['enemy', 6.18, -12.78], ['enemy', 4, 16], ['chest', -18.38, -7.08], ['nobattle', 1, 20], ['warp', 8, 22, 4, 18], ['down', -20, 18, -16, 16], ['up', 18, 4, 14.73, 1.69]]) {
    if (kind === 'port' || isLink(kind)) placeMarker(kind, { x, z }, { x: cx, z: cz }); else { placeMarker(kind, { x, z }); if (kind === 'nobattle') markers[markers.length - 1].r = 4; }
  }
  for (const m of markers) m.tag = m.kind === 'port' ? 'field' : m.kind === 'down' ? 'B2' : m.kind === 'up' ? 'B0' : m.kind === 'warp' ? 'hub' : '';
  state.spawn = { x: 1, z: 20 };
  props = props.filter(p => !markers.some(m => isLink(m.kind) && Math.hypot(p[1] - m.x, p[2] - m.z) < 3.4 + PROP[p[0]].r * p[4])); rebuildProps();
  ensureIds(); rebuildMarkers();
}

// ============================================================
// Save / load / export
// ============================================================
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
// ---------- stable ids: assigned once, saved, never renumbered by reordering or re-export
const newRoomId = () => (crypto.randomUUID ? crypto.randomUUID() : 'room-' + Math.random().toString(16).slice(2) + Date.now().toString(16));
const newId = prefix => `${prefix}_${(state.nextId++).toString(36).padStart(4, '0')}`;
function ensureIds() {
  if (!state.roomId) state.roomId = newRoomId();
  for (const p of props) if (!p[8]) p[8] = newId('prop');
  for (const b of bridges) if (!b.id) b.id = newId('bridge');
  for (const st of stairs) if (!st.id) st.id = newId('stairs');
  for (const f of falls) if (!f.id) f.id = newId('fall');
  for (const m of markers) if (!m.id) m.id = newId(markerPrefix(m.kind));
  if (!state.spawn.id) state.spawn.id = 'spawn_main';
}

// ---------- asset catalog: typeId -> assetKey and the proxy collider the editor uses for walkability
const EXPORTER_VERSION = 'tdj-map-editor/2026.10.19-r9';
for (const t of PROP) { t.geo.computeBoundingBox(); t.height = +t.geo.boundingBox.max.y.toFixed(2); t.base = { r: t.r, offs: t.offs, height: t.height }; t.offs = t.offs ? t.offs.map(o => [o, 0]) : null; }   // internal offsets are [x, z] (see applyCatalog)
const isNum = (v, ok) => typeof v === 'number' && Number.isFinite(v) && (!ok || ok(v));
// version 1 catalogs were a flat {typeId: entry} map; version 2 has {types, floorLinks}
function normalizeCatalog(d) {
  if (!d || typeof d !== 'object') return { types: {}, floorLinks: {} };
  if (d.types || d.floorLinks) return { types: { ...(d.types || {}) }, floorLinks: { ...(d.floorLinks || {}) } };
  return { types: { ...d }, floorLinks: {} };
}
// Catalog shapes are real prefab-local coordinates (+X right, +Y up, -Z = the side the player approaches from), and
// Unity places the prefab with rotation yawDeg + yawOffsetDeg. The editor keeps shapes in its logical local frame
// (rotation yawDeg only, approach side at +Z), so:  logical = rotY(yawOffsetDeg) * prefab, editor = (x, -z) of logical.
const rotU = (x, z, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, -x * s + z * c]; };   // Unity Euler Y
const prefabToEditor = (x, z, off) => { const [lx, lz] = rotU(x, z, off); return [lx, -lz]; };
const editorToPrefab = (x, z, off) => rotU(x, -z, -off);
function applyCatalog() {
  state.catalog = normalizeCatalog(state.catalog);
  for (const t of PROP) {
    const c = state.catalog.types[t.id] || {};
    t.assetKey = typeof c.assetKey === 'string' && c.assetKey ? c.assetKey : `tdj/${t.id}`;
    t.r = c.solid === false ? 0 : isNum(c.radius, v => v >= 0) ? c.radius : t.base.r;
    t.offsPrefab = Array.isArray(c.offsets) && c.offsets.length && c.offsets.every(v => isNum(v)) ? c.offsets.slice() : t.base.offs || null;
    t.height = isNum(c.height, v => v > 0) ? c.height : t.base.height;
    t.yawOffset = isNum(c.yawOffsetDeg) ? c.yawOffsetDeg : 0;
    // collider centres in the editor's local frame: [x, z] per prefab offset along prefab X
    t.offs = t.offsPrefab ? t.offsPrefab.map(o => prefabToEditor(o, 0, t.yawOffset)) : null;
  }
  for (const [k] of LINK_KINDS) {
    const sp = LINK_SPEC[k], c = state.catalog.floorLinks[sp.id] || {};
    sp.assetKey = typeof c.assetKey === 'string' && c.assetKey ? c.assetKey : `tdj/${sp.id}`;
    sp.yawOffset = isNum(c.yawOffsetDeg) ? c.yawOffsetDeg : 0;
    sp.solidPrefab = Array.isArray(c.solid) && c.solid.every(q => Array.isArray(q) && q.length === 3 && q.every(v => isNum(v)) && q[2] >= 0)
      ? c.solid.map(q => q.slice()) : sp.base.solid.map(([x, z, r]) => [...editorToPrefab(x, z, sp.yawOffset), r]);
    sp.solid = sp.solidPrefab.map(([x, z, r]) => [...prefabToEditor(x, z, sp.yawOffset), r]);
    sp.height = isNum(c.height, v => v > 0) ? c.height : sp.base.height;
  }
  colliders = null; walkDirty = true;
}
function catalogExport() {
  const r3 = v => +v.toFixed(3) || 0, pl = (x, z, off) => { const [px, pz] = editorToPrefab(x, z, off); return [r3(px), 0, r3(pz)]; };
  return {
    schemaVersion: 2, exporterVersion: EXPORTER_VERSION,
    note: 'assetKey・当たり判定（半径・offsets・高さ・solid）・yawOffsetDeg を編集し、エディターの「資産対応表を読み込み」で戻すと、エディターの通行判定と次の書き出しに反映されます。trigger / arrival / footprint / pivot は参考値（読み込みでは変わりません）。',
    frame: {
      prefabLocal: '+X = right, +Y = up, +Z = the way the player walks into the object; -Z = the side the player approaches from. Lengths in m at scale 1.',
      placement: 'Unity: position = meta/CSV position, rotation = Euler(0, yawDeg + yawOffsetDeg, 0), scale = (scale, scaleY, scale). yawOffsetDeg is only for prefabs authored facing another way; the export never adds it to yawDeg. All shapes here (offsets, solid, trigger, arrival) are in that rotated prefab frame, and the editor applies the same yawOffsetDeg to its own collision checks, so meta world values = position + rotY(yawDeg + yawOffsetDeg) * shape.',
      pivot: { types: 'ground contact point at the centre of the base (y = 0 = ground)', floorLinks: 'ground level at the marker position (y = 0 = floor)' },
      fromEditorLocal: '(x, z)_prefab = rotY(-yawOffsetDeg) * (x, -z)_editor — the z flip matches the world transform, so shapes are not mirrored.',
    },
    fields: {
      radius: 'circle collider radius (m, scale 1). solid=false: decorative, no collider.',
      offsets: 'collider centres along prefab-local X (m, scale 1); one circle of `radius` at each. With yawOffsetDeg they rotate together with the prefab.',
      height: 'collider top above the pivot (m, scaleY 1). Used by the editor for obstacles standing on bridge / stairs decks (overlap with agentProfile.height). Ground walkability ignores it. Headroom under ceilings is not checked.',
      solid: 'floorLinks: circle colliders [x, z, radius] in prefab-local coordinates.',
    },
    types: Object.fromEntries(PROP.map(t => [t.id, { name: t.name, assetKey: t.assetKey, solid: t.r > 0, radius: t.r, offsets: t.offsPrefab || [0], height: t.height, yawOffsetDeg: t.yawOffset || 0, footprint: t.vis, tags: t.tags }])),
    floorLinks: Object.fromEntries(LINK_KINDS.map(([k, name]) => { const sp = LINK_SPEC[k]; return [sp.id, {
      name, kind: sp.game, assetKey: sp.assetKey, yawOffsetDeg: sp.yawOffset || 0, height: sp.height,
      footprint: { width: sp.size[0], length: sp.size[1] }, solid: sp.solidPrefab.map(([x, z, r]) => [r3(x), r3(z), r3(r)]),
      trigger: { center: pl(...sp.trigger, sp.yawOffset), radius: sp.tr }, arrival: pl(0, sp.arrive, sp.yawOffset),
      ...(sp.deck ? { walkSurface: { kind: 'steps', note: 'prefab-local, yawOffsetDeg 0: steps start at z = -front and climb toward +Z; the player walks up them to the trigger on the landing', front: -sp.deck.front, back: -sp.deck.back, width: 2 * sp.deck.halfWidth, steps: sp.deck.steps, run: sp.deck.run, rise: sp.deck.rise } } : {}),
      ...(sp.pit ? { pit: { note: 'prefab-local, yawOffsetDeg 0: a pit below ground level; the export opens terrain holes over it (meta.floorLinks[].pitHoleCells) and the prefab must line the pit and cover those hole cells', zFrom: -sp.pit.front, zTo: -sp.pit.back, width: 2 * sp.pit.halfWidth, depth: sp.pit.depth } } : {}),
    }]; })),
  };
}

// ---------- game markers
const MARKER_KINDS = [['port', '出入口'], ['enemy', '敵の候補'], ['chest', '宝箱の候補'], ['nobattle', '戦闘禁止範囲'], ['nospawn', '出現禁止範囲']];
const MARKER_COL = { port: 0x3fd8ff, enemy: 0xff4a4a, chest: 0xffcc33, nobattle: 0x5a8cff, nospawn: 0xff9a3a, warp: 0xb48cff, up: 0x7dffb0, down: 0xffa86b };
// floor links (dungeon level transitions): stored in `markers` so ids, undo, save and delete work the same way.
// Local frame: +z (forward) points to the side the player approaches from; the structure extends toward -z.
const LINK_KINDS = [['warp', '魔法陣'], ['up', '上り階段'], ['down', '下り階段']];
const LINK_SPEC = {
  warp: { id: 'floor_magic_circle', game: 'magicCircle', trigger: [0, 0], tr: 1.2, arrive: 2.4, size: [3.6, 3.6], height: .3, solid: [] },
  up: { id: 'floor_stairs_up', game: 'stairsUp', trigger: [0, -1.95], tr: .7, arrive: 3.1, size: [3.6, 4.6], height: 5.6, deck: { halfWidth: 1.1, front: 1.25, back: -2.6, run: .5, rise: .4, steps: 6 },
    solid: [[-1.3, .7, .4], [1.3, .7, .4], [-1.3, -.3, .4], [1.3, -.3, .4], [-1.3, -1.45, .45], [1.3, -1.45, .45], [-1.5, -2.2, .3], [1.5, -2.2, .3], [-.7, -2.85, .35], [0, -2.85, .35], [.7, -2.85, .35]] },
  down: { id: 'floor_stairs_down', game: 'stairsDown', trigger: [0, .6], tr: .9, arrive: 2.6, size: [2.9, 3.4], height: 1.4, pit: { halfWidth: 1.1, front: .9, back: -2.0, depth: 2.6 },
    solid: [[0, -.45, .95], [0, -1.45, .95], [-1.3, -1.3, .35], [-1.3, -.2, .35], [-1.3, .8, .35], [1.3, -1.3, .35], [1.3, -.2, .35], [1.3, .8, .35]] },
};
for (const k in LINK_SPEC) { const sp = LINK_SPEC[k]; sp.base = { solid: sp.solid.map(q => q.slice()), height: sp.height }; sp.assetKey = `tdj/${sp.id}`; }
const isLink = k => !!LINK_SPEC[k];
const markerPrefix = k => k === 'port' ? 'port' : isLink(k) ? 'link' : 'mk';
const markerLabel = k => (MARKER_KINDS.find(t => t[0] === k) || LINK_KINDS.find(t => t[0] === k))[1];
const linkAssetKey = k => LINK_SPEC[k].assetKey;
const linkLocal = (m, lx, lz) => { const s = Math.sin(m.rot), c = Math.cos(m.rot); return { x: m.x + lx * c + lz * s, z: m.z - lx * s + lz * c }; };
const linkTrigger = m => linkLocal(m, ...LINK_SPEC[m.kind].trigger);
const linkArrival = m => linkLocal(m, 0, LINK_SPEC[m.kind].arrive);
const markerRadius = m => m.kind === 'port' ? m.w / 2 : isLink(m.kind) ? 1.6 : m.r;
const portInward = m => [Math.sin(m.rot), Math.cos(m.rot)];
const portLanding = m => { const [ix, iz] = portInward(m); return { x: m.x + ix * 1.5, z: m.z + iz * 1.5 }; };
const markerGroup = new THREE.Group(); scene.add(markerGroup);
const unlit = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, depthWrite: false });
function groundRing(x, z, r, color, lift = .12) {
  const pts = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; pts.push(new THREE.Vector3(px, Math.max(heightAt(px, pz), state.water) + lift, pz)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 })); l.renderOrder = 9; return l;
}
const linkGroup = new THREE.Group(); scene.add(linkGroup);   // the real objects: visible while walking too
const linkSpin = [];
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: .92, flatShading: true });
const stoneDark = new THREE.MeshStandardMaterial({ color: 0x5c5a57, roughness: .95, flatShading: true });
const voidMat = new THREE.MeshBasicMaterial({ color: 0x050407 });
const daisMat = new THREE.MeshStandardMaterial({ color: 0x2a2436, roughness: .9, flatShading: true });
const runeTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const g = cv.getContext('2d'), C = 256;
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  const ring = (r, w) => { g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, 6.2832); g.stroke(); };
  ring(246, 7); ring(226, 3); ring(150, 5); ring(132, 2); ring(40, 4);
  const poly = (n, r, skip, rot) => { g.lineWidth = 4; g.beginPath(); for (let k = 0; k <= n; k++) { const a = rot + k * skip * 6.2832 / n; g[k ? 'lineTo' : 'moveTo'](C + Math.cos(a) * r, C + Math.sin(a) * r); } g.stroke(); };
  poly(6, 150, 2, -1.5708); poly(6, 150, 2, -1.5708 + Math.PI / 6);   // hexagram
  for (let k = 0; k < 36; k++) {                                      // rune band
    const a = k / 36 * 6.2832; g.save(); g.translate(C + Math.cos(a) * 188, C + Math.sin(a) * 188); g.rotate(a + 1.5708);
    g.lineWidth = 3; g.beginPath(); const t = k * 7 % 5;
    g.moveTo(-8, -12); g.lineTo(t > 2 ? 8 : 0, 12); if (t % 2) { g.moveTo(-8, 0); g.lineTo(8, 0); } if (t > 1) { g.moveTo(6, -12); g.lineTo(-4, 4); }
    g.stroke(); g.restore();
  }
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.2832 - 1.5708; g.beginPath(); g.arc(C + Math.cos(a) * 150, C + Math.sin(a) * 150, 12, 0, 6.2832); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const beamTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(cv);
})();
const glowMat = (color, map, opacity) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
// ---- otherworld gate (a ring of mossy stones around a swirling vortex), used at the top / bottom of the floor stairs
const mossStone = new THREE.MeshStandardMaterial({ color: 0x5f6e4a, roughness: .95, flatShading: true });
const vortexMat = new THREE.ShaderMaterial({
  uniforms: { uTime: timeU }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec2 vUv; uniform float uTime;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
    void main(){
      vec2 p=vUv*2.-1.; float r=length(p); if(r>1.) discard;
      float a=atan(p.y,p.x), sw=a+(1.-r)*5.+uTime*1.1;                       // spiral into the centre
      vec2 q=vec2(cos(sw),sin(sw))*(r*2.5+.3);
      float f=n(q*1.6+uTime*.25)*.6+n(q*3.3-uTime*.45)*.4;
      float streak=pow(.5+.5*sin(sw*4.+f*7.+r*9.-uTime*2.6),4.);
      float rim=smoothstep(.62,.97,r)*smoothstep(1.,.95,r);
      vec3 deep=vec3(.01,.03,.09), blue=vec3(.10,.55,1.), cyan=vec3(.55,.95,1.);
      vec3 col=deep+blue*(streak*1.4+f*.7+.15)*smoothstep(.0,.8,r)+cyan*(rim*2.6+pow(streak,2.)*smoothstep(.3,.95,r)*1.3+smoothstep(.75,1.,r)*.5);
      vec2 sp=floor(p*26.); float st=step(.988,h(sp+floor(uTime*1.5)*.37))*(1.1-r);   // stars in the deep
      col+=vec3(.85,.9,1.)*st;
      gl_FragColor=vec4(col, smoothstep(1.,.96,r));
    }`,
});
const sparkMat = new THREE.ShaderMaterial({
  uniforms: { uTime: timeU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute vec4 seed; uniform float uTime; varying float vA; varying float vC;
    void main(){
      float t=fract(seed.x+uTime*(.06+seed.y*.08)), ang=seed.z*6.2832+uTime*(.25+seed.w*.4)*(seed.y>.5?1.:-1.);
      float rad=1.+seed.w*.9;
      vec3 p=vec3(cos(ang)*rad*position.x, sin(ang)*rad*position.x+t*1.2, (seed.y-.5)*1.4+t*.9);
      vA=sin(t*3.1416); vC=seed.y;
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=min(9.,(2.+seed.w*3.)*(40./-mv.z));
    }`,
  fragmentShader: `varying float vA; varying float vC;
    void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
      vec3 c=vC>.62?vec3(1.,.62,.22):vec3(.45,.85,1.); gl_FragColor=vec4(c*(1.-d*2.)*vA*1.4,1.); }`,
});
const poolTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
function addGate(g, cy, cz, R, seed, floorY = 0) {
  const gate = new THREE.Group(); gate.position.set(0, cy, cz); g.add(gate);
  const R0 = rng(seed), n = Math.max(12, Math.round(R * 11));
  for (let k = 0; k < n; k++) {                                   // chunky stones around the ring, keystone on top
    const a = k / n * 6.2832 + 1.5708, top = k === 0, len = 6.2832 * (R + .3) / n * 1.18;
    const st = new THREE.Mesh(new THREE.BoxGeometry(len * (top ? 1.25 : 1) * (.9 + R0() * .2), (top ? .75 : .55) + R0() * .15, .75 + R0() * .25),
      R0() < .35 ? mossStone : R0() < .5 ? stoneDark : stoneMat);
    st.position.set(Math.cos(a) * (R + .3), Math.sin(a) * (R + .3), (R0() - .5) * .1); st.rotation.set((R0() - .5) * .12, (R0() - .5) * .12, a + 1.5708 + (R0() - .5) * .08);
    st.castShadow = st.receiveShadow = true; gate.add(st);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R + .06, 56), vortexMat); disc.renderOrder = 5; gate.add(disc);
  const ns = 70, sd = new Float32Array(ns * 4), pp = new Float32Array(ns * 3);
  for (let k = 0; k < ns; k++) { sd.set([R0(), R0(), R0(), R0()], k * 4); pp[k * 3] = R; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); sg.setAttribute('seed', new THREE.BufferAttribute(sd, 4));
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 3);
  const sparks = new THREE.Points(sg, sparkMat); sparks.renderOrder = 8; gate.add(sparks);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 2.4), glowMat(0x3aa8ff, poolTex, .45)); pool.rotation.x = -Math.PI / 2; pool.position.set(0, floorY - cy + .12, cz < 0 ? R * .9 : 0); pool.renderOrder = 6; gate.add(pool);
  return gate;
}
function box(g, mat, w, hgt, d, x, y, z) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; }
function buildLink(m) {
  const g = new THREE.Group();
  if (m.kind === 'warp') {
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, .14, 40), daisMat); dais.position.y = .07; dais.receiveShadow = true; g.add(dais);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832; box(g, stoneMat, .34, .12 + (k % 2) * .08, .34, Math.cos(a) * 1.95, .08, Math.sin(a) * 1.95).rotation.y = -a; }
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), glowMat(0x8a52ff, runeTex, .95)); disc.rotation.x = -Math.PI / 2; disc.position.y = .16; disc.renderOrder = 6; g.add(disc);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), glowMat(0x3fc8ff, runeTex, .6)); inner.rotation.x = -Math.PI / 2; inner.position.y = .17; inner.renderOrder = 6; g.add(inner);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 2.6, 32, 1, true), glowMat(0x7a55ff, beamTex, .5)); beam.position.y = 1.45; beam.renderOrder = 7; g.add(beam);
    linkSpin.push([disc, .25], [inner, -.5], [beam, .3]);
  } else if (m.kind === 'up') {
    // six steps climbing away from the player (toward -z) up to a landing with an otherworld gate
    for (let i = 0; i < 6; i++) box(g, i % 2 ? stoneMat : stoneDark, 2.2, (i + 1) * .4, .5, 0, (i + 1) * .2, 1.0 - i * .5);
    box(g, stoneMat, 2.6, 2.4, .9, 0, 1.2, -2.15);                         // landing
    for (const sd of [-1, 1]) {
      box(g, stoneDark, .4, 1.1, 1.0, sd * 1.3, .55, .7);
      box(g, stoneDark, .4, 2.0, 1.0, sd * 1.3, 1.0, -.3);
      box(g, stoneDark, .4, 2.8, 1.3, sd * 1.3, 1.4, -1.45);
    }
    addGate(g, 2.4 + 1.25, -2.2, 1.2, (m.x * 31 + m.z * 17) | 0);
  } else {
    // a pit cut into the ground (the terrain is hidden inside it): steps go down to a landing, the gate stands at the bottom
    const pt = LINK_SPEC.down.pit, D = pt.depth, w2 = pt.halfWidth, L = pt.front - pt.back, zc = (pt.front + pt.back) / 2;
    box(g, stoneDark, 2 * w2 + .2, .2, L + .2, 0, -D - .1, zc);                                      // pit floor
    for (const sd of [-1, 1]) box(g, stoneDark, .12, D + .05, L + .2, sd * (w2 + .04), -D / 2, zc);   // side walls
    box(g, stoneDark, 2 * w2 + .2, D + .05, .12, 0, -D / 2, pt.back - .04);                          // back wall
    for (let i = 0; i < 6; i++) { const top = -(i + 1) * .4, z1 = pt.front - i * .35; box(g, i % 2 ? stoneMat : stoneDark, 2 * w2, top + D, .35, 0, (top - D) / 2, z1 - .175); }
    for (const sd of [-1, 1]) box(g, stoneDark, .4, .75, L + .2, sd * 1.3, .37, zc);                 // low walls above ground
    for (const sd of [-1, 1]) box(g, stoneMat, .55, 1.15, .55, sd * 1.3, .57, pt.front + .1);         // posts at the top of the steps
    box(g, stoneDark, 2.9, .5, .4, 0, .25, pt.back - .2);                                            // back kerb
    const gt = addGate(g, -D + 1.0, pt.back + .45, .85, (m.x * 31 + m.z * 17) | 0, -D);
    gt.rotation.x = -.55;   // leaning back, so the vortex faces the player looking down into the pit
  }
  g.position.set(m.x, heightAt(m.x, m.z), m.z); g.rotation.y = m.rot; g.userData.m = m; linkGroup.add(g);
}
function rebuildMarkers() {
  for (const c of [...markerGroup.children]) { c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); markerGroup.remove(c); }
  for (const c of [...linkGroup.children]) { c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && ![stoneMat, stoneDark, voidMat, daisMat, mossStone, vortexMat, sparkMat].includes(o.material)) o.material.dispose(); }); linkGroup.remove(c); }
  linkSpin.length = 0; colliders = null; walkDirty = true;
  { let n = 0; const pt = LINK_SPEC.down.pit;
    for (const m of markers) if (m.kind === 'down' && n < 8) { BU.uPitA.value[n].set(m.x, m.z, Math.cos(m.rot), Math.sin(m.rot)); BU.uPitB.value[n].set(pt.halfWidth - .02, (pt.front - pt.back) / 2 - .02, (pt.front + pt.back) / 2, 0); n++; }
    BU.uPitN.value = n; }
  for (const m of markers) {
    const c = MARKER_COL[m.kind], y = floorAt(m.x, m.z), g = new THREE.Group();
    if (isLink(m.kind)) {
      buildLink(m);
      const T = linkTrigger(m), A = linkArrival(m);
      markerGroup.add(groundRing(T.x, T.z, m.r, c)); markerGroup.add(groundRing(A.x, A.z, .5, c, .08));
      continue;
    }
    if (m.kind === 'port') {
      const half = m.w / 2;
      for (const sd of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.4, .15), unlit(c)); post.position.set(sd * half, 1.2, 0); g.add(post); }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(m.w + .15, .15, .15), unlit(c)); bar.position.y = 2.4; g.add(bar);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.35, .8, 4), unlit(c)); arrow.rotation.x = Math.PI / 2; arrow.position.set(0, .3, .9); g.add(arrow);
      g.position.set(m.x, y, m.z); g.rotation.y = m.rot; markerGroup.add(g);
      const L = portLanding(m); markerGroup.add(groundRing(L.x, L.z, .5, c)); markerGroup.add(groundRing(L.x, L.z, m.r, c, .08));
      continue;
    }
    if (m.kind === 'enemy') { const d = new THREE.Mesh(new THREE.OctahedronGeometry(.35), unlit(c)); d.position.y = 1.3; d.scale.y = 1.5; g.add(d); }
    else if (m.kind === 'chest') { const b = new THREE.Mesh(new THREE.BoxGeometry(.7, .45, .45), unlit(c)); b.position.y = .25; g.add(b); }
    else { const disc = new THREE.Mesh(new THREE.CircleGeometry(m.r, 40), unlit(c)); disc.material.opacity = .22; disc.rotation.x = -Math.PI / 2; disc.position.y = .1; g.add(disc); }
    g.position.set(m.x, y, m.z); markerGroup.add(g); markerGroup.add(groundRing(m.x, m.z, m.r, c));
  }
}
function placeMarker(kind, a, c) {
  const m = { kind, x: +a.x.toFixed(3), z: +a.z.toFixed(3), rot: 0, w: 0, r: 1, tag: ($('markerTag').value || '').trim() };
  if (kind === 'port') {
    let dx = c ? c.x - a.x : -a.x, dz = c ? c.z - a.z : -a.z;
    if (Math.hypot(dx, dz) < .5) { dx = -a.x; dz = -a.z; }      // a click without a drag faces the room centre
    m.rot = +Math.atan2(dx, dz).toFixed(4); m.w = +clamp(state.radius * .5, 1.5, 6).toFixed(2); m.r = 1.5;
  } else if (isLink(kind)) {
    let dx = c ? c.x - a.x : -a.x, dz = c ? c.z - a.z : -a.z;
    if (Math.hypot(dx, dz) < .5) { dx = -a.x; dz = -a.z; }
    m.rot = +Math.atan2(dx, dz).toFixed(4); m.w = LINK_SPEC[kind].size[0]; m.r = LINK_SPEC[kind].tr;
  } else if (kind === 'enemy') m.r = 1.5;
  else if (kind === 'chest') m.r = 1;
  else m.r = +clamp(state.radius, 1, 14).toFixed(2);
  m.id = newId(markerPrefix(kind));
  markers.push(m); rebuildMarkers();
}

// ---------- validation before export
// ---------- value checks: run on loaded data before it is applied, and on the editor state before export
const FIN = v => typeof v === 'number' && Number.isFinite(v);
function valueIssues(src) {
  const out = [], bad = (what, why) => out.push(`${what}: ${why}`), inMap = (x, z) => FIN(x) && FIN(z) && Math.abs(x) <= HALF && Math.abs(z) <= HALF;
  const ag = src.agent || {};
  for (const [k, ok] of [['radius', v => v > 0], ['height', v => v > 0], ['maxSlopeDeg', v => v > 0 && v < 90], ['maxWaterDepth', v => v >= 0], ['maxStep', v => v > 0], ['arrivalClearance', v => v >= 0]])
    if (ag[k] !== undefined && !(FIN(ag[k]) && ok(ag[k]))) bad(`体格 ${k}`, `不正な値 ${ag[k]}`);
  if (src.waterLevel !== undefined && !FIN(src.waterLevel)) bad('水位', '数値ではありません');
  const sp = src.spawn || {}; if (!inMap(sp.x, sp.z)) bad('開始地点', '座標が不正かマップの外です');
  (src.props || []).forEach((p, i) => {
    const id = (Array.isArray(p) && p[8]) || `props[${i}]`;
    if (!Array.isArray(p) || p.length < 5) return bad(id, '形式が違います');
    if (!Number.isInteger(p[0]) || p[0] < 0 || p[0] >= PROP.length) bad(id, `種類 ${p[0]} が不明です`);
    if (!inMap(p[1], p[2])) bad(id, '座標が不正かマップの外です');
    if (!FIN(p[3])) bad(id, '回転が不正です');
    if (!(FIN(p[4]) && p[4] > 0)) bad(id, `大きさ ${p[4]} が不正です`);
    if (p[6] != null && !(FIN(p[6]) && p[6] > 0)) bad(id, `縦の倍率 ${p[6]} が不正です`);
    if (p[7] != null && !FIN(p[7])) bad(id, '高さが不正です');
  });
  for (const [list, label, types] of [[src.bridges, '橋', BRIDGE_TYPES], [src.stairs, '階段', STAIR_TYPES]]) (list || []).forEach((b, i) => {
    const id = b?.id || `${label}[${i}]`;
    if (!inMap(b?.x1, b?.z1) || !inMap(b?.x2, b?.z2)) return bad(id, '端の座標が不正かマップの外です');
    if (Math.hypot(b.x2 - b.x1, b.z2 - b.z1) < .5) bad(id, '長さがほぼ0です');
    if (!(FIN(b.w) && b.w > 0)) bad(id, `幅 ${b.w} が不正です`);
    if (b.type !== undefined && !types.some(t => t[0] === b.type)) bad(id, `種類 ${b.type} が不明です`);
    if (label === '階段' && !(FIN(b.y1) && FIN(b.y2))) bad(id, '高さが不正です');
  });
  (src.falls || []).forEach((f, i) => {
    const id = f?.id || `falls[${i}]`;
    if (!inMap(f?.x, f?.z)) return bad(id, '座標が不正かマップの外です');
    if (!(FIN(f.w) && f.w > 0) || !FIN(f.top) || !FIN(f.bottom) || !FIN(f.rot)) bad(id, '幅・高さ・向きが不正です');
  });
  (src.markers || []).forEach((m, i) => {
    const id = m?.id || `markers[${i}]`;
    if (!m || !(MARKER_KINDS.some(k => k[0] === m.kind) || isLink(m.kind))) return bad(id, `種類 ${m?.kind} が不明です`);
    if (!inMap(m.x, m.z)) bad(id, '座標が不正かマップの外です');
    if (!FIN(m.rot)) bad(id, '向きが不正です');
    if (!(FIN(m.r) && m.r >= 0)) bad(id, `半径 ${m.r} が不正です`);
    if (m.kind === 'port' && !(FIN(m.w) && m.w > 0)) bad(id, `幅 ${m.w} が不正です`);
    if ((m.kind === 'nobattle' || m.kind === 'nospawn') && !(m.r > 0)) bad(id, '範囲の半径が0です');
  });
  return out;
}
// Secret passage regions (connected O=3 cells). Entrances are the walkable cells next to a region that computeFloor
// also uses (not more than 1.2m above the lowest one), clustered. The route is the shortest cell path between the
// first two entrances. ids are derived from the region's first cell, so they stay put while the region is unchanged.
function secretRegions() {
  if (walkDirty) computeWalk();
  const seen = new Uint8Array(N * N), out = [];
  const nb4 = k => { const i = k % N, j = (k / N) | 0, r = []; if (i > 0) r.push(k - 1); if (i < N - 1) r.push(k + 1); if (j > 0) r.push(k - N); if (j < N - 1) r.push(k + N); return r; };
  const entry = k => O[k] === 1 || (O[k] === 0 && A[k]);
  for (let s0 = 0; s0 < N * N; s0++) {
    if (O[s0] !== 3 || seen[s0]) continue;
    const cells = [s0]; seen[s0] = 1;
    for (let q = 0; q < cells.length; q++) for (const n of nb4(cells[q])) if (O[n] === 3 && !seen[n]) { seen[n] = 1; cells.push(n); }
    const ent = new Set(); for (const k of cells) for (const n of nb4(k)) if (O[n] !== 3 && entry(n)) ent.add(n);
    const base = Math.min(...[...ent].map(k => H[k]));
    for (const k of [...ent]) if (H[k] > base + 1.2) ent.delete(k);
    const groups = [], used = new Set();
    for (const k of ent) {
      if (used.has(k)) continue; const g = [k]; used.add(k);
      for (let q = 0; q < g.length; q++) { const i = g[q] % N, j = (g[q] / N) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = idx(i + di, j + dj); if (i + di >= 0 && i + di < N && j + dj >= 0 && j + dj < N && ent.has(n) && !used.has(n)) { used.add(n); g.push(n); } } }
      const cx = g.reduce((a, c) => a + vx(c % N), 0) / g.length, cz = g.reduce((a, c) => a + vx((c / N) | 0), 0) / g.length;
      groups.push({ x: cx, z: cz, cells: g.length, adj: g });
    }
    groups.sort((a, b) => b.cells - a.cells);
    let path = [];
    if (groups.length >= 2) {
      const inR = new Set(cells), startSet = new Set(), goal = new Set();
      for (const k of cells) for (const n of nb4(k)) { if (groups[0].adj.includes(n)) startSet.add(k); if (groups[1].adj.includes(n)) goal.add(k); }
      const prev = new Map(), q = [...startSet]; for (const k of q) prev.set(k, -1);
      let end = -1;
      for (let h = 0; h < q.length && end < 0; h++) { const k = q[h]; if (goal.has(k)) { end = k; break; } for (const n of nb4(k)) if (inR.has(n) && !prev.has(n)) { prev.set(n, k); q.push(n); } }
      for (let k = end; k >= 0; k = prev.get(k)) path.push(k);
      path.reverse();
    }
    const i0 = s0 % N, j0 = (s0 / N) | 0;
    let rockMax = 0; for (const k of cells) rockMax = Math.max(rockMax, H[k] - F[k]);
    out.push({ id: `secret_${i0}_${j0}`, cells, entrances: groups.map(({ adj, ...g }) => g), path, rockAboveMax: rockMax });
  }
  return out;
}
// ---------- Unity Terrain grid and secret passage geometry
// Unity's heightmapResolution must be 2^n + 1, so the export grid is chosen independently of the editor grid (0.5 m).
const TERRAIN_RES = [33, 65, 129, 257, 513, 1025, 2049, 4097];
const terrainRes = () => TERRAIN_RES.find(r => r >= N) || 4097;
// The passage shape is the union of the 0.5 m squares around the passage (O=3) vertices: exactly what overrideAt()
// (nearest vertex) walks on. Terrain holes and the passage mesh are both derived from it on a 0.125 m raster, which
// divides the square edges (0.25 m offset) as well as the terrain cells (0.375 m or 0.5 m), so nothing is approximated twice.
const PG = .125;
function passageGeometry(TN) {
  const TS = SIZE / (TN - 1), HRN = TN - 1, CL = state.agent.height + .6, ag = state.agent;
  const regions = secretRegions(), holes = new Int16Array(HRN * HRN), regionOf = new Int32Array(N * N).fill(-1);
  regions.forEach((r, ri) => { for (const k of r.cells) regionOf[k] = ri; });
  const TH = new Float32Array(TN * TN); for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) TH[j * TN + i] = heightAt(-HALF + i * TS, -HALF + j * TS);
  const thAt = (x, z) => {   // the export heightmap, bilinear inside a cell
    const fx = clamp((x + HALF) / TS, 0, TN - 1), fz = clamp((z + HALF) / TS, 0, TN - 1), i = Math.min(Math.floor(fx), TN - 2), j = Math.min(Math.floor(fz), TN - 2), u = fx - i, w = fz - j;
    return lerp(lerp(TH[j * TN + i], TH[j * TN + i + 1], u), lerp(TH[(j + 1) * TN + i], TH[(j + 1) * TN + i + 1], u), w);
  };
  const vIdx = (x, z) => idx(clamp(Math.round((x + HALF) * RES), 0, N - 1), clamp(Math.round((z + HALF) * RES), 0, N - 1));
  const rockAt = k => H[k] > F[k] + .3;
  // holes: every terrain cell that overlaps the square of a passage vertex with rock above its floor
  for (const r of regions) for (const k of r.cells) {
    if (!rockAt(k)) continue;
    const a = vx(k % N) - .25 + HALF, b = a + .5, c = vx((k / N) | 0) - .25 + HALF, d = c + .5;
    for (let cj = Math.max(0, Math.floor(c / TS + 1e-9)); cj <= Math.min(HRN - 1, Math.ceil(d / TS - 1e-9) - 1); cj++)
      for (let ci = Math.max(0, Math.floor(a / TS + 1e-9)); ci <= Math.min(HRN - 1, Math.ceil(b / TS - 1e-9) - 1); ci++) holes[cj * HRN + ci] = regionOf[k] + 1;
  }
  const passages = regions.map((r, ri) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of r.cells) { const x = vx(k % N), z = vx((k / N) | 0); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const pad = TS + 1, gx0 = Math.floor((x0 - pad + HALF) / PG) * PG - HALF, gz0 = Math.floor((z0 - pad + HALF) / PG) * PG - HALF;
    const nx = Math.ceil((x1 - gx0 + pad) / PG), nz = Math.ceil((z1 - gz0 + pad) / PG), M = nx * nz;
    const cx = c => gx0 + (c % nx + .5) * PG, cz = c => gz0 + (((c / nx) | 0) + .5) * PG;
    const inP = new Uint8Array(M), inHole = new Uint8Array(M), ground = new Uint8Array(M), fl = new Float32Array(M), closed = new Uint8Array(M);
    for (let c = 0; c < M; c++) {
      const x = cx(c), z = cz(c), k = vIdx(x, z), ci = Math.floor((x + HALF) / TS), cj = Math.floor((z + HALF) / TS);
      inP[c] = O[k] === 3 && regionOf[k] === ri ? 1 : 0;
      inHole[c] = ci >= 0 && cj >= 0 && ci < HRN && cj < HRN && holes[cj * HRN + ci] === ri + 1 ? 1 : 0;
      fl[c] = floorAt(x, z);
      if (inP[c]) closed[c] = thAt(x, z) - fl[c] > CL + .15 ? 1 : 0;
    }
    // walkable ground outside the passage that the floor joins (entrances): no wall there
    for (let c = 0; c < M; c++) if (!inP[c] && !inHole[c] && walkable(cx(c), cz(c))) ground[c] = 1;
    const nbs = c => { const i = c % nx, j = (c / nx) | 0, o = []; if (i > 0) o.push([c - 1, -1, 0]); if (i < nx - 1) o.push([c + 1, 1, 0]); if (j > 0) o.push([c - nx, 0, -1]); if (j < nz - 1) o.push([c + nx, 0, 1]); return o; };
    const isEntrance = (c, n) => ground[n] && Math.abs(fl[n] - fl[c]) <= ag.maxStep;
    // ---- mesh (editor coordinates, counter-clockwise front faces; the export's z flip turns them clockwise for Unity)
    const verts = [], sub = { floor: [], wall: [], ceiling: [], cap: [] };
    const quad = (list, p, nrm) => {
      const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n[0] * nrm[0] + n[1] * nrm[1] + n[2] * nrm[2] < 0) p = [p[0], p[3], p[2], p[1]];
      const b = verts.length; verts.push(...p); list.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    const floorY = (c, x, z) => clamp(floorAt(x, z), fl[c] - .3, fl[c] + .3);   // shared corners stay continuous, cliffs next door do not leak in
    let holeArea = 0, rockArea = 0, capped = 0, uncovered = 0, intrusion = 0;
    for (let c = 0; c < M; c++) {
      const x = cx(c), z = cz(c), xa = x - PG / 2, xb = x + PG / 2, za = z - PG / 2, zb = z + PG / 2;
      if (inHole[c]) holeArea++;
      if (inP[c]) {
        const k = vIdx(x, z); if (rockAt(k)) { rockArea++; if (!inHole[c]) intrusion++; }
        const fy = [floorY(c, xa, za), floorY(c, xb, za), floorY(c, xb, zb), floorY(c, xa, zb)];
        quad(sub.floor, [[xa, fy[0], za], [xb, fy[1], za], [xb, fy[2], zb], [xa, fy[3], zb]], [0, 1, 0]);
        if (closed[c]) quad(sub.ceiling, [[xa, fy[0] + CL, za], [xb, fy[1] + CL, za], [xb, fy[2] + CL, zb], [xa, fy[3] + CL, zb]], [0, -1, 0]);
        for (const [n, dx, dz] of nbs(c)) {
          // the shared edge, as two corner points
          const e = dx ? [[dx > 0 ? xb : xa, za], [dx > 0 ? xb : xa, zb]] : [[xa, dz > 0 ? zb : za], [xb, dz > 0 ? zb : za]];
          const ey = e.map(([ex, ez]) => floorY(c, ex, ez)), top = e.map(([ex, ez]) => thAt(ex, ez));
          if (inP[n]) {
            if (closed[c] && !closed[n]) quad(sub.wall, [[e[0][0], ey[0] + CL, e[0][1]], [e[1][0], ey[1] + CL, e[1][1]], [e[1][0], Math.max(top[1], ey[1] + CL), e[1][1]], [e[0][0], Math.max(top[0], ey[0] + CL), e[0][1]]], [dx, 0, dz]);   // lintel over an open stretch
          } else if (isEntrance(c, n)) {
            if (closed[c]) quad(sub.wall, [[e[0][0], ey[0] + CL, e[0][1]], [e[1][0], ey[1] + CL, e[1][1]], [e[1][0], Math.max(top[1], ey[1] + CL), e[1][1]], [e[0][0], Math.max(top[0], ey[0] + CL), e[0][1]]], [dx, 0, dz]);   // portal lintel
          } else {
            const hi = closed[c] ? ey.map(v => v + CL) : top.map((t, q) => Math.max(t, ey[q] + .05));
            quad(sub.wall, [[e[0][0], ey[0], e[0][1]], [e[1][0], ey[1], e[1][1]], [e[1][0], hi[1], e[1][1]], [e[0][0], hi[0], e[0][1]]], [-dx, 0, -dz]);
          }
        }
      }
      // cap: the terrain surface over every hole cell that is not an open cut of the passage
      let covered = !!inP[c] && !closed[c];   // an open cut is covered by its own floor and walls
      if (inHole[c] && (!inP[c] || closed[c])) { quad(sub.cap, [[xa, thAt(xa, za), za], [xb, thAt(xb, za), za], [xb, thAt(xb, zb), zb], [xa, thAt(xa, zb), zb]], [0, 1, 0]); capped++; covered = true; }
      if (inHole[c] && !covered) uncovered++;
    }
    // ---- clear width: widest path between the first two entrances, distance from each passage cell to the nearest blocking cell
    const blockedList = []; for (let c = 0; c < M; c++) if (!inP[c] && !ground[c]) blockedList.push(c);
    const dist = new Float32Array(M).fill(-1);
    for (let c = 0; c < M; c++) if (inP[c]) {
      let best = 1e9; const x = cx(c), z = cz(c);
      for (const b of blockedList) { const dx = Math.max(Math.abs(cx(b) - x) - PG / 2, 0), dz = Math.max(Math.abs(cz(b) - z) - PG / 2, 0); const d = Math.hypot(dx, dz); if (d < best) best = d; }
      dist[c] = best;
    }
    const ent = r.entrances.slice(0, 2), side = new Int8Array(M).fill(-1);
    for (let c = 0; c < M; c++) if (inP[c] && nbs(c).some(([n]) => isEntrance(c, n))) {
      let bi = -1, bd = 1e9; ent.forEach((e, q) => { const d = Math.hypot(e.x - cx(c), e.z - cz(c)); if (d < bd) { bd = d; bi = q; } }); side[c] = bi;
    }
    let minClearWidth = 0;
    if (ent.length >= 2) {
      const order = []; for (let c = 0; c < M; c++) if (inP[c]) order.push(c); order.sort((a, b) => dist[b] - dist[a]);
      const par = new Int32Array(M).fill(-1), has = new Uint8Array(M), find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      for (const c of order) {
        par[c] = c; has[c] = side[c] === 0 ? 1 : side[c] === 1 ? 2 : 0;
        for (const [n] of nbs(c)) if (par[n] >= 0) { const ra = find(c), rb = find(n); if (ra !== rb) { par[rb] = ra; has[ra] |= has[rb]; } }
        if (has[find(c)] === 3) { minClearWidth = 2 * dist[c]; break; }
      }
    }
    // ---- exact outline of the passage shape (loops of square edges, editor coordinates)
    const inR = k => k >= 0 && k < N * N && regionOf[k] === ri, segs = new Map();
    for (const k of r.cells) {
      const i = k % N, j = (k / N) | 0, x = vx(i), z = vx(j), q = .25;
      if (j === 0 || !inR(k - N)) segs.set(`${x - q},${z - q}`, [x + q, z - q]);
      if (i === N - 1 || !inR(k + 1)) segs.set(`${x + q},${z - q}`, [x + q, z + q]);
      if (j === N - 1 || !inR(k + N)) segs.set(`${x + q},${z + q}`, [x - q, z + q]);
      if (i === 0 || !inR(k - 1)) segs.set(`${x - q},${z + q}`, [x - q, z - q]);
    }
    const loops = [];
    while (segs.size) {
      const [k0] = segs.keys(), loop = []; let key = k0;
      while (segs.has(key)) { const [sx, sz] = key.split(',').map(Number), nx2 = segs.get(key); segs.delete(key); loop.push([sx, sz]); key = `${nx2[0]},${nx2[1]}`; }
      loops.push(loop.filter((p, q) => { const a = loop[(q + loop.length - 1) % loop.length], b = loop[(q + 1) % loop.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; }));
    }
    const A2 = PG * PG;
    return {
      id: r.id, region: r, verts, sub, loops,
      check: { passageArea_m2: +(r.cells.length * .25).toFixed(3), passageUnderRock_m2: +(rockArea * A2).toFixed(3), holeArea_m2: +(holeArea * A2).toFixed(3), cappedHole_m2: +(capped * A2).toFixed(3),
        uncoveredHole_m2: +(uncovered * A2).toFixed(3), rockIntrudingPassage_m2: +(intrusion * A2).toFixed(3), minClearWidth: +minClearWidth.toFixed(3), requiredWidth: +(2 * ag.radius).toFixed(3),
        entranceSides: [0, 1].filter(q => side.includes(q)).length, ceilingHeight: +CL.toFixed(2) },
    };
  });
  return { TN, TS, holes, holeCells: holes.reduce((a, v) => a + (v ? 1 : 0), 0), passages };
}
const AREA_STEP = .25;
// Every sample of the disc must hold the agent (footing, water depth, slope, obstacles, forced-blocked) and be
// reachable from the centre inside the disc without exceeding the step limit. Returns the first failing point or null.
function areaIssue(cx, cz, r) {
  const ag = state.agent, n = Math.ceil(r / AREA_STEP - 1e-6), W = 2 * n + 1, fl = new Map();
  for (let b = -n; b <= n; b++) for (let a = -n; a <= n; a++) {
    const x = cx + a * AREA_STEP, z = cz + b * AREA_STEP; if (Math.hypot(a, b) * AREA_STEP > r + 1e-6) continue;
    if (!walkable(x, z)) return { x, z, why: '通れない点（足場・水深・傾斜・障害物・通行禁止）' };
    fl.set((b + n) * W + a + n, floorAt(x, z));
  }
  const c0 = n * W + n, seen = new Set([c0]), q = [c0];
  while (q.length) {
    const k = q.pop(), a = k % W, b = (k / W) | 0;
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (a + da < 0 || a + da >= W || b + db < 0 || b + db >= W) continue;
      const nk = (b + db) * W + a + da;
      if (fl.has(nk) && !seen.has(nk) && Math.abs(fl.get(nk) - fl.get(k)) <= ag.maxStep) { seen.add(nk); q.push(nk); }
    }
  }
  for (const k of fl.keys()) if (!seen.has(k)) return { x: cx + (k % W - n) * AREA_STEP, z: cz + (((k / W) | 0) - n) * AREA_STEP, why: '中心から段差を越えないと行けない点' };
  return null;
}
// walk a straight segment in 0.1m steps: every point walkable, every step within the step limit
function segmentClear(ax, az, bx, bz) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / .1)); let prev = floorAt(ax, az);
  for (let s = 1; s <= n; s++) { const x = lerp(ax, bx, s / n), z = lerp(az, bz, s / n); if (!walkable(x, z)) return false; const f = floorAt(x, z); if (Math.abs(f - prev) > state.agent.maxStep) return false; prev = f; }
  return true;
}
const uPos = (x, z) => `Unity (${(x + HALF).toFixed(2)}, ${(HALF - z).toFixed(2)})`;
function runValidation() {
  ensureIds(); if (walkDirty) computeWalk();
  const errors = [], warnings = [], ag = state.agent;
  for (const v of valueIssues({ agent: ag, waterLevel: state.water, spawn: state.spawn, props, bridges, stairs, falls, markers })) errors.push('不正な値 ' + v);
  const ids = [state.spawn.id, ...props.map(p => p[8]), ...bridges.map(b => b.id), ...stairs.map(st => st.id), ...falls.map(f => f.id), ...markers.map(m => m.id)], seen = new Set();
  for (const id of ids) { if (!id) errors.push('IDのない要素があります'); else if (seen.has(id)) errors.push(`IDが重複しています: ${id}`); seen.add(id); }
  // stand: the centre must hold the agent with a finite floor; area: the whole disc (see areaIssue)
  const stand = (label, x, z, r, list) => {
    if (!inBounds(x, z)) { errors.push(`${label} がマップの外です`); return false; }
    if (!walkable(x, z)) { errors.push(`${label} が通れない場所にあります（${uPos(x, z)}）`); return false; }
    if (!FIN(floorAt(x, z))) { errors.push(`${label} の足場の高さが不正です`); return false; }
    const bad = r > 0 ? areaIssue(x, z, r) : null;
    if (bad) list.push(`${label} の範囲（半径${r}m）に${bad.why}があります: ${uPos(bad.x, bad.z)}`);
    return true;
  };
  stand('開始地点', state.spawn.x, state.spawn.z, ag.arrivalClearance, errors);
  for (const m of markers) {
    if (m.kind === 'port') { const L = portLanding(m); stand(`出入口 ${m.id} の着地点`, L.x, L.z, m.r, errors); }
    else if (m.kind === 'enemy' || m.kind === 'chest') stand(`${m.kind === 'enemy' ? '敵の候補' : '宝箱の候補'} ${m.id}`, m.x, m.z, m.r, warnings);
    else if (isLink(m.kind)) {
      const A = linkArrival(m), name = `${markerLabel(m.kind)} ${m.id}`;
      stand(`${name} の到着点`, A.x, A.z, ag.arrivalClearance, errors);
      for (const o of markers) if (o !== m && isLink(o.kind) && o.id > m.id && Math.hypot(o.x - m.x, o.z - m.z) < 3.2) warnings.push(`${name} と ${o.id} が重なっています`);
    }
  }
  // reachability from the spawn over the walkable grid (8 neighbours, limited step height)
  const fl = new Float32Array(N * N), wk = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = idx(i, j); wk[k] = walkable(vx(i), vx(j)) ? 1 : 0; fl[k] = floorAt(vx(i), vx(j)); }
  const cell = (x, z) => idx(clamp(Math.round((x + HALF) * RES), 0, N - 1), clamp(Math.round((z + HALF) * RES), 0, N - 1));
  const seenC = new Uint8Array(N * N), q = [], s0 = cell(state.spawn.x, state.spawn.z);
  if (wk[s0]) { seenC[s0] = 1; q.push(s0); }
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = k % N, j = (k / N) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const n = idx(ii, jj); if (seenC[n] || !wk[n] || Math.abs(fl[n] - fl[k]) > ag.maxStep) continue;
      if (di && dj) {   // diagonal: both side cells must be passable too (no squeezing between two blocked corners)
        const a = idx(ii, j), b = idx(i, jj);
        if (!wk[a] || !wk[b] || Math.abs(fl[a] - fl[k]) > ag.maxStep || Math.abs(fl[b] - fl[k]) > ag.maxStep || Math.abs(fl[n] - fl[a]) > ag.maxStep || Math.abs(fl[n] - fl[b]) > ag.maxStep) continue;
      }
      seenC[n] = 1; q.push(n);
    }
  }
  // a point counts as reached only if a reached grid vertex next to it connects to it by a clear straight segment
  const reach = (x, z) => {
    if (!walkable(x, z)) return false;
    const i0 = Math.floor((x + HALF) * RES), j0 = Math.floor((z + HALF) * RES);
    for (const [i, j] of [[i0, j0], [i0 + 1, j0], [i0, j0 + 1], [i0 + 1, j0 + 1]]) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = idx(i, j);
      if (seenC[k] && segmentClear(vx(i), vx(j), x, z)) return true;
    }
    return false;
  };
  // a trigger is touchable if some reached position puts the body inside or against its circle
  const touch = (x, z, r) => {
    const i0 = clamp(Math.floor((x - r + HALF) * RES), 0, N - 1), i1 = clamp(Math.ceil((x + r + HALF) * RES), 0, N - 1);
    const j0 = clamp(Math.floor((z - r + HALF) * RES), 0, N - 1), j1 = clamp(Math.ceil((z + r + HALF) * RES), 0, N - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (seenC[idx(i, j)] && Math.hypot(vx(i) - x, vx(j) - z) <= r) return true;
    return false;
  };
  for (const m of markers) {
    if (m.kind === 'port') {
      const L = portLanding(m);
      if (!reach(L.x, L.z)) errors.push(`出入口 ${m.id} の着地点に開始地点から歩いて行けません`);
      if (!touch(m.x, m.z, m.w / 2 + ag.radius)) errors.push(`出入口 ${m.id} に触れられる場所まで歩いて行けません`);
    } else if (isLink(m.kind)) {
      const T = linkTrigger(m), A = linkArrival(m), name = `${markerLabel(m.kind)} ${m.id}`;
      if (!touch(T.x, T.z, m.r + ag.radius)) errors.push(`${name} の入口（触れる範囲）に開始地点から歩いて行けません`);
      if (!reach(A.x, A.z)) errors.push(`${name} の到着点から部屋へ出られません`);
    }
    else if ((m.kind === 'enemy' || m.kind === 'chest') && !reach(m.x, m.z)) warnings.push(`${m.kind === 'enemy' ? '敵の候補' : '宝箱の候補'} ${m.id} に開始地点から歩いて行けません`);
  }
  if (!markers.some(m => m.kind === 'port')) warnings.push('出入口マーカーがありません（ゲームの部屋として使うには必要です）');
  for (const b of bridges) {
    const pr = bridgeProfile(b), L = pr.L, dx = (b.x2 - b.x1) / L, dz = (b.z2 - b.z1) / L;
    for (const [t, sx, sz, sy] of [[0, b.x1 - dx * .6, b.z1 - dz * .6, pr.y1], [1, b.x2 + dx * .6, b.z2 + dz * .6, pr.y2]]) {
      const step = Math.abs(sy - heightAt(sx, sz)); if (step > ag.maxStep) warnings.push(`橋 ${b.id} の${t ? '終点' : '始点'}に${step.toFixed(2)}mの段差があります`);
    }
  }
  for (const g of passageGeometry(terrainRes()).passages) {
    const c = g.check;
    if (c.uncoveredHole_m2 > 0) errors.push(`隠し通路 ${g.id}: 地形の穴のうち ${c.uncoveredHole_m2}m² が床・天井・ふたで覆われていません`);
    if (c.rockIntrudingPassage_m2 > 0) errors.push(`隠し通路 ${g.id}: 通路の ${c.rockIntrudingPassage_m2}m² に地形が残ります（穴が足りません）`);
    if (c.entranceSides >= 2 && c.minClearWidth < c.requiredWidth) warnings.push(`隠し通路 ${g.id} の最も狭い所が ${c.minClearWidth}m です（体の幅 ${c.requiredWidth}m が必要）`);
  }
  for (const s of secretRegions()) {
    if (s.entrances.length < 2) warnings.push(`隠し通路 ${s.id} の出入口が ${s.entrances.length} か所です（通り抜けられません）`);
    for (const e of s.entrances) if (!reach(e.x, e.z) && !touch(e.x, e.z, 1)) warnings.push(`隠し通路 ${s.id} の出入口 ${uPos(e.x, e.z)} に開始地点から歩いて行けません`);
  }
  const reachable = q.length, walkCells = wk.reduce((a, v) => a + v, 0);
  return { errors, warnings, stats: { walkableCells: walkCells, reachableFromSpawn: reachable },
    definitions: VALIDATION_DEFS, checks: VALIDATION_CHECKS, notChecked: VALIDATION_UNCHECKED };
}
const VALIDATION_DEFS = {
  bodyRadius: 'agentProfile.radius: キャラクターの体の半径。障害物・橋/階段の端からこの距離を空ける。',
  safeRadius: '出入口の着地点を中心とする円。円内のどこに体の中心を置いても立て（足場・水深・傾斜・障害物・通行禁止）、中心から段差上限内で歩いて行けることを保証する。満たさなければエラー。',
  arrivalClearance: 'agentProfile.arrivalClearance: 開始地点と階層移動の到着点に必要な、同じ条件の円の半径。満たさなければエラー。',
  reserveRadius: '敵・宝箱の候補の確保領域。円内のどこに中心を置いても立てること（同じ条件）。満たさなければ警告。',
  trigger: '階層移動の触れる範囲。円全体が通れる必要はなく、開始地点から歩いて行ける位置で体（半径 bodyRadius）が円に触れられればよい。出入口も同様に、幅の半分＋体の半径の範囲に触れられればよい。',
  reach: '開始地点から 0.5m 格子を 8 方向に探索（斜めは両脇も通れる場合だけ、段差は maxStep 以内）。対象点は、到達した隣の格子点から 0.1m 刻みの直線で通れて初めて到達とする。',
};
const VALIDATION_CHECKS = ['IDの欠落・重複', '数値の不正（NaN/Infinity、負の半径・幅、ゼロ長の橋・階段、範囲外座標、不明な種類）', '開始地点・着地点・到着点の足場と範囲（safeRadius / arrivalClearance）', '敵・宝箱候補の確保領域（reserveRadius）',
  '開始地点からの到達（斜めの角抜けなし、最後の区間を直線で確認。隠し通路も通路の床で探索）', '隠し通路の出入口の数と到達', '隠し通路の形と地形の穴の一致（穴の全セルが床・天井・ふたで覆われ、通路に地形が残らない）と、体の幅が通れる最小幅', '出入口・階層移動の入口に触れられるか', '階層移動の到着点から部屋へ出られるか', '橋・階段上の体の幅と障害物（agentProfile.radius / height）', '橋の両端の段差'];
const VALIDATION_UNCHECKED = ['頭上空間・天井の高さ（地形の上の天井は扱わない。障害物の高さは橋・階段の上でだけ使用）', '複数の床が重なる場所（橋の下の道など）は上の床だけを判定', '隠し通路のメッシュを Unity に置いたときの見た目・当たり判定（形の一致まではエディターで検査）', 'Unity の Collider・CharacterController・NavMesh での実際の移動', '大型の敵など別体格（agentProfile を変えて再検証が必要）', '水流・滝の流れによる移動'];
function showValidation(v) {
  const el = $('valReport'); el.hidden = false;
  el.innerHTML = (v.errors.length ? v.errors.map(e => `<div class="err">✖ ${e}</div>`).join('') : '<div class="ok">✔ エラーはありません</div>') + v.warnings.map(w => `<div class="warn">⚠ ${w}</div>`).join('')
    + `<div class="hint">通れる点 ${v.stats.walkableCells} / 開始地点から行ける点 ${v.stats.reachableFromSpawn}</div>`;
}

function serialize() {
  return {
    format: 'map-editor-proto', version: 2, size: SIZE, resolution: RES, vertices: N,
    roomId: (ensureIds(), state.roomId), nextId: state.nextId, revision: state.revision, lastExportHash: state.lastExportHash, agent: { ...state.agent }, catalog: state.catalog,
    markers: markers.map(m => ({ ...m })),
    waterLevel: state.water, spawn: state.spawn, biome: state.biome, cliffStyle: state.cliffStyle, sea: state.sea, atmosphere: { ...state.atmo }, weather: { ...state.weather }, sunlight: state.sunOn,
    heightsF32: b64(new Uint8Array(H.slice().buffer)), splat: b64(S), walkOverride: b64(O), cliffMap: b64(C),   // exact heights: save → load → export reproduces the RAW
    propTypes: PROP.map(p => p.id),
    // full precision (JSON keeps doubles exactly), so a reloaded map exports byte-identical files
    props: props.map(p => p.map(v => v ?? null)),
    falls: falls.map(f => ({ ...f })), bridges: bridges.map(b => ({ ...b })), stairs: stairs.map(st => ({ ...st })),
  };
}
function deserialize(d) {
  if (d.format !== 'map-editor-proto') throw new Error('形式が違います');
  if (d.vertices !== N) {
    if (d.resolution === RES && MAP_SIZES.includes(d.size) && reloadAtSize(d.size, JSON.stringify(d))) return;
    throw new Error('サイズが違います');
  }
  // decode and check everything first; the current map is touched only after all checks pass
  const issues = valueIssues(d);
  const dec = (name, s) => { if (typeof s !== 'string') { issues.push(`${name}: ありません`); return null; } try { return unb64(s); } catch (e) { issues.push(`${name}: base64 として読めません`); return null; } };
  let newH = null;
  if (d.heightsF32 !== undefined) {
    const u = dec('heightsF32', d.heightsF32);
    if (u && u.length !== N * N * 4) issues.push(`heightsF32: ${u.length} バイト（${N * N * 4} バイトが必要）`);
    else if (u) newH = new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length));
  } else {
    const u = dec('heightsCm', d.heightsCm);
    if (u && u.length !== N * N * 2) issues.push(`heightsCm: ${u.length} バイト（${N * N * 2} バイトが必要）`);
    else if (u) { const hc = new Int16Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)); newH = Float32Array.from(hc, v => v / 100); }
  }
  if (newH) { let bad = 0; for (let k = 0; k < newH.length; k++) if (!Number.isFinite(newH[k]) || Math.abs(newH[k]) > 1000) bad++; if (bad) issues.push(`高さ: 不正な値（NaN・Infinity・±1000m 超）が ${bad} 点あります`); }
  const sp = dec('splat', d.splat), spLayers = sp ? sp.length / (N * N) : 0;
  if (sp && !(Number.isInteger(spLayers) && spLayers >= 1 && spLayers <= NS)) issues.push(`splat: ${sp.length} バイト（${N * N} の 1〜${NS} 倍が必要）`);
  const wo = d.walkOverride !== undefined ? dec('walkOverride', d.walkOverride) : new Uint8Array(N * N);
  if (wo && wo.length !== N * N) issues.push(`walkOverride: ${wo.length} バイト（${N * N} バイトが必要）`);
  else if (wo && wo.some(v => v > 3)) issues.push('walkOverride: 0〜3 以外の値があります');
  const cm = d.cliffMap !== undefined ? dec('cliffMap', d.cliffMap) : new Uint8Array(N * N);
  if (cm && cm.length !== N * N) issues.push(`cliffMap: ${cm.length} バイト（${N * N} バイトが必要）`);
  else if (cm && cm.some(v => v > CLIFF_STYLES.length)) issues.push(`cliffMap: 0〜${CLIFF_STYLES.length} 以外の値があります`);
  if (!Array.isArray(d.props)) issues.push('props: 配列ではありません');
  for (const k of ['falls', 'bridges', 'stairs', 'markers']) if (d[k] !== undefined && !Array.isArray(d[k])) issues.push(`${k}: 配列ではありません`);
  if (issues.length) throw new Error(`不正な値が ${issues.length} 件あります: ` + issues.slice(0, 3).join(' / ') + (issues.length > 3 ? ' …' : ''));
  H.set(newH);
  if (spLayers === NS) S.set(sp); else { S.fill(0); for (let k = 0; k < N * N; k++) for (let c = 0; c < spLayers; c++) S[k * NS + c] = sp[k * spLayers + c]; }
  O.set(wo); C.set(cm); walkDirty = true; props = d.props.map(p => p.slice()); falls = (d.falls || []).map(f => ({ ...f })); bridges = (d.bridges || []).map(b => ({ ...b })); stairs = (d.stairs || []).map(st => ({ ...st })); rebuildFalls(); rebuildBridges(); rebuildStairs(); state.water = d.waterLevel; state.spawn = d.spawn; state.sea = !!d.sea; state.weather = d.weather ? { ...d.weather } : { kind: 'none', amount: .7 }; state.sunOn = d.sunlight !== false; state.cliffStyle = CLIFF_STYLES.some(c => c[0] === d.cliffStyle) ? d.cliffStyle : 'standard'; applyCliffStyle(); if ($('cliffStyle')) $('cliffStyle').value = state.cliffStyle; state.atmo = d.atmosphere ? { ...d.atmosphere } : { kind: 'none', amount: .6, height: 3 };
  state.roomId = d.roomId || newRoomId(); state.nextId = d.nextId || 1; state.revision = d.revision || 0;
  state.agent = { ...state.agent, ...(d.agent || {}) }; state.catalog = normalizeCatalog(d.catalog); state.lastExportHash = d.lastExportHash || ''; applyCatalog(); syncAgentUI();
  markers = (d.markers || []).map(m => ({ ...m })); ensureIds();
  applyBiome(d.biome || 'forest');
  syncUI(); updateTerrain(); rebuildProps(); rebuildMarkers();
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(lh, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(ch, name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.byteLength, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
// SHA-256 (FIPS 180-4) for the export manifest; plain JS so it also works from file:// pages
const SHA_K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
function sha256(bytes) {
  const L = bytes.length, n = ((L + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[L] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 8, Math.floor(L / 0x20000000)); dv.setUint32(n - 4, (L << 3) >>> 0);
  const Hh = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), w = new Uint32Array(64);
  const rr = (x, c) => (x >>> c) | (x << (32 - c));
  for (let o = 0; o < n; o += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(o + t * 4);
    for (let t = 16; t < 64; t++) { const a = w[t - 15], b = w[t - 2]; w[t] = (w[t - 16] + (rr(a, 7) ^ rr(a, 18) ^ (a >>> 3)) + w[t - 7] + (rr(b, 17) ^ rr(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = Hh;
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[t] + w[t]) >>> 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    Hh[0] += a; Hh[1] += b; Hh[2] += c; Hh[3] += d; Hh[4] += e; Hh[5] += f; Hh[6] += g; Hh[7] += hh;
  }
  return Array.from(Hh, v => v.toString(16).padStart(8, '0')).join('');
}
const GROUND_EFFECT = { sand: 'slow_light', rubble: 'slow_light', swamp: 'slow', poison: 'poison', lava: 'lava', snowfield: 'slow_light', ice: 'ice' };
const WEIGHT_LAYERS = ['grass', 'dirt', 'cobble', 'sand', 'rubble', 'swamp', 'poison', 'lava', 'snowfield', 'ice', 'cliff'];
async function buildExport() {
  ensureIds(); applyCatalog(); if (walkDirty) computeWalk();
  const validation = runValidation();
  // ---- export grid: Unity Terrain heightmap resolution (2^n + 1), independent of the editor's 0.5 m grid.
  // Heights and walk floor are sampled at the export vertices (bilinear on the editor grid; the walk floor is the editor's floorAt);
  // walkability is evaluated again at every export vertex with the same walkable() (never interpolated).
  const TN = terrainRes(), TS = SIZE / (TN - 1), tx = i => -HALF + i * TS;
  const TH = new Float32Array(TN * TN), FL = new Float32Array(TN * TN);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { TH[j * TN + i] = heightAt(tx(i), tx(j)); FL[j * TN + i] = floorAt(tx(i), tx(j)); }
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k < TN * TN; k++) { mn = Math.min(mn, TH[k], FL[k]); mx = Math.max(mx, TH[k], FL[k]); }
  const range = Math.max(mx - mn, .01);
  // ---- one transform for everything: Unity left-handed frame, origin at the terrain corner, y=0 at the lowest encoded height
  const U = { x: x => +(x + HALF).toFixed(3), z: z => +(HALF - z).toFixed(3), y: y => +(y - mn).toFixed(3), yaw: r => +(-r * 180 / Math.PI).toFixed(2) };
  const P3 = (x, y, z) => [U.x(x), U.y(y), U.z(z)];
  const raw16 = arr => { const out = new Uint8Array(TN * TN * 2), dv = new DataView(out.buffer); for (let u = 0; u < TN; u++) for (let i = 0; i < TN; i++) dv.setUint16((u * TN + i) * 2, Math.round(clamp((arr[(TN - 1 - u) * TN + i] - mn) / range, 0, 1) * 65535), true); return out; };
  const pngOf = async (get, size = TN) => {   // image row 0 (top) = Unity z max = editor z min
    const c2 = document.createElement('canvas'); c2.width = c2.height = size; const x2 = c2.getContext('2d'), im2 = x2.createImageData(size, size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const o = (j * size + i) * 4, v = get(i, j); im2.data[o] = v[0]; im2.data[o + 1] = v[1] || 0; im2.data[o + 2] = v[2] || 0; im2.data[o + 3] = 255; }
    x2.putImageData(im2, 0, 0); return new Uint8Array(await (await new Promise(r => c2.toBlob(r, 'image/png'))).arrayBuffer());
  };
  const heightRaw = raw16(TH), floorRaw = raw16(FL);
  // terrain holes ((TN-1)² cells) and the passage meshes come from the same passage shape (see passageGeometry)
  const secrets = secretRegions(), geo = passageGeometry(TN), HR = TN - 1, holeAt = (i, j) => geo.holes[j * HR + i] !== 0;
  // stairs-down pits: every export cell that overlaps the pit rectangle becomes a hole too (value -1, not a passage)
  const pitCells = {};
  for (const m of markers) if (m.kind === 'down') {
    const pt = LINK_SPEC.down.pit, c = Math.cos(m.rot), s = Math.sin(m.rot); let n = 0;
    for (let cj = 0; cj < HR; cj++) for (let ci = 0; ci < HR; ci++) {
      let hit = false;
      for (let a = .0625; a < TS && !hit; a += .125) for (let b = .0625; b < TS && !hit; b += .125) {
        const x = -HALF + ci * TS + a, z = -HALF + cj * TS + b, dx = x - m.x, dz = z - m.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) < pt.halfWidth && lz < pt.front && lz > pt.back) hit = true;
      }
      if (hit) { if (!geo.holes[cj * HR + ci]) geo.holes[cj * HR + ci] = -1; n++; }
    }
    pitCells[m.id] = n;
  }
  let holeCount = 0; for (const v of geo.holes) if (v) holeCount++;
  let holesPng = null;
  if (holeCount) {
    const c2 = document.createElement('canvas'); c2.width = c2.height = HR; const x2 = c2.getContext('2d'), im2 = x2.createImageData(HR, HR);
    for (let r = 0; r < HR; r++) for (let i = 0; i < HR; i++) { const o = (r * HR + i) * 4, v = holeAt(i, r) ? 0 : 255; im2.data[o] = im2.data[o + 1] = im2.data[o + 2] = v; im2.data[o + 3] = 255; }
    x2.putImageData(im2, 0, 0); holesPng = new Uint8Array(await (await new Promise(r => c2.toBlob(r, 'image/png'))).arrayBuffer());
  }
  // raw paint masks (game logic): nearest editor vertex, values kept as painted. Layer weights: masks sampled bilinearly.
  const near = (i, j) => idx(clamp(Math.round((tx(i) + HALF) * RES), 0, N - 1), clamp(Math.round((tx(j) + HALF) * RES), 0, N - 1));
  const mask = (i, j, ch) => S[near(i, j) * NS + ch];
  const sBil = (x, z, ch) => {
    const fx = clamp((x + HALF) * RES, 0, N - 1), fz = clamp((z + HALF) * RES, 0, N - 1), i = Math.min(Math.floor(fx), N - 2), j = Math.min(Math.floor(fz), N - 2), u = fx - i, w = fz - j;
    const s = (a, b) => S[idx(a, b) * NS + ch];
    return lerp(lerp(s(i, j), s(i + 1, j), u), lerp(s(i, j + 1), s(i + 1, j + 1), u), w);
  };
  const maskPngs = [await pngOf((i, j) => [mask(i, j, 0), mask(i, j, 1), 0]), await pngOf((i, j) => [mask(i, j, 2), mask(i, j, 3), mask(i, j, 4)]),
    await pngOf((i, j) => [mask(i, j, 5), mask(i, j, 6), mask(i, j, 7)]), await pngOf((i, j) => [mask(i, j, 8), 0, 0])];
  const W8 = new Uint8Array(TN * TN * WEIGHT_LAYERS.length);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const k = j * TN + i, x = tx(i), z = tx(j), w = new Float32Array(WEIGHT_LAYERS.length); w[0] = 1;
    const add = (L, m) => { if (m <= 0) return; for (let q = 0; q < w.length; q++) w[q] *= 1 - m; w[L] += m; };
    add(1, sstep(.2, .55, sBil(x, z, 0) / 255)); add(2, sstep(.3, .55, sBil(x, z, 1) / 255));
    for (let c = 2; c < NS; c++) add(c + 1, sstep(.25, .6, sBil(x, z, c) / 255));
    const g = slopeAt(x, z); add(10, sstep(.24, .42, 1 - 1 / Math.sqrt(1 + g * g)));
    const q8 = Array.from(w, v => Math.floor(v * 255)); let rest = 255 - q8.reduce((a, v) => a + v, 0), top = 0;
    for (let q = 1; q < w.length; q++) if (w[q] > w[top]) top = q;
    q8[top] += rest; for (let q = 0; q < w.length; q++) W8[k * w.length + q] = q8[q];
  }
  const L8 = WEIGHT_LAYERS.length, wgt = (i, j, L) => L < L8 ? W8[(j * TN + i) * L8 + L] : 0;
  const weightPngs = []; for (let b = 0; b < 4; b++) weightPngs.push(await pngOf((i, j) => [wgt(i, j, b * 3), wgt(i, j, b * 3 + 1), wgt(i, j, b * 3 + 2)]));
  const cliffPng = await pngOf((i, j) => { const v = cliffIndexNear(tx(i), tx(j)); return [v, v, v]; });   // style index per export vertex (legend: meta.cliffStyles)
  const walkPng = await pngOf((i, j) => {
    const x = tx(i), z = tx(j), d = deckAt(x, z, 0), o = overrideAt(x, z), auto = autoWalkable(x, z);
    return [walkable(x, z, auto) ? 255 : 0, d ? (d.kind === 'bridge' ? 32 : 48) : o === 1 ? 128 : o === 2 ? 255 : o === 3 ? 64 : 0, auto ? 255 : 0];
  });
  const ROCKY = ['rock', 'cliff', 'pebble'];
  const csv = ['instanceId,type,assetKey,x,y,z,rotY_deg,scale,scaleY,auto,cliffStyle'].concat(props.map(p => { const t = PROP[p[0]]; return [p[8], t.id, t.assetKey, U.x(p[1]), U.y(p[7] ?? heightAt(p[1], p[2])), U.z(p[2]), U.yaw(p[3]), p[4].toFixed(3), (p[4] * (p[6] ?? 1)).toFixed(3), p[5], ROCKY.includes(t.id) ? CLIFF_STYLES[cliffIndexNear(p[1], p[2])][0] : ''].join(','); })).join('\n');
  const spawnY = floorAt(state.spawn.x, state.spawn.z);
  const portOut = m => { const [ix, iz] = portInward(m), L = portLanding(m); return { id: m.id, tag: m.tag || '', position: P3(m.x, floorAt(m.x, m.z), m.z), yawDeg: U.yaw(m.rot), inward: [+ix.toFixed(4), +(-iz).toFixed(4)], width: m.w, landing: P3(L.x, floorAt(L.x, L.z), L.z), safeRadius: m.r }; };
  const spotOut = m => ({ id: m.id, tag: m.tag || '', position: P3(m.x, floorAt(m.x, m.z), m.z), reserveRadius: m.r });
  const linkOut = m => {
    const sp = LINK_SPEC[m.kind], T = linkTrigger(m), A = linkArrival(m);
    const y0 = heightAt(m.x, m.z);
    return { id: m.id, kind: sp.game, assetKey: linkAssetKey(m.kind), catalogId: sp.id, tag: m.tag || '', position: P3(m.x, heightAt(m.x, m.z), m.z), yawDeg: U.yaw(m.rot),
      forward: [+Math.sin(m.rot).toFixed(4), +(-Math.cos(m.rot)).toFixed(4)], trigger: { center: P3(T.x, floorAt(T.x, T.z), T.z), radius: m.r },
      arrival: P3(A.x, floorAt(A.x, A.z), A.z), footprint: { width: sp.size[0], length: sp.size[1] },
      colliders: sp.solid.map(([lx, lz, r]) => { const q = linkLocal(m, lx, lz); return { center: P3(q.x, y0, q.z), radius: r, height: sp.height }; }),
      ...(m.kind === 'down' ? { pitHoleCells: pitCells[m.id] || 0 } : {}) };
  };
  const zoneOut = m => ({ id: m.id, kind: m.kind === 'nobattle' ? 'noBattle' : 'noSpawn', center: P3(m.x, floorAt(m.x, m.z), m.z), radius: m.r });
  // ---- water simulation data (water.js): flow / foam-trail images that the Unity water and the editor's water view both read
  const waterIn = { TN, TS, HALF, TH, level: state.water, falls: falls.map(f => ({ id: f.id, x: f.x, z: f.z, w: f.w })) };
  const waterRes = TDWater.analyze(waterIn);
  buildExport.lastWater = { input: waterIn, result: waterRes };   // 試験とエディターの水の表示が、書き出しと同じ解析を使うための控え
  const waterWhy = BIOME().lava ? 'liquid=lava is not supported yet' : state.sea ? 'sea (surf) is not supported yet' : !waterRes.wetCount ? 'no terrain below the water level' : null;
  for (const w of waterRes.warnings) if (!waterWhy && w.includes('乾いた')) validation.warnings.push('水: ' + w);
  const waterPack = !waterWhy ? TDWater.pack(waterRes) : null;
  const waterPngs = waterPack ? [{ name: 'water_flow.png', data: TDWater.encodePngRGBA(TN, TN, waterPack.flow) }, { name: 'water_mask.png', data: TDWater.encodePngRGBA(TN, TN, waterPack.mask) }] : [];
  const wo = waterRes.options;
  const waterSim = {
    version: 1, available: !waterWhy, ...(waterWhy ? { reason: waterWhy } : {}),
    flowMap: waterPack ? 'water_flow.png' : null, maskMap: waterPack ? 'water_mask.png' : null, resolution: TN, cellSize: +TS.toFixed(6),
    encoding: {
      flowMap: 'RGBA8, linear, bilinear, no mips, clamp. R,G = flow (Unity x,z) = (value/255*2-1)*maxSpeed m/s. B = stream function psi 0..1. A = distance to the bank / bankRange (0 = land, wet >= 4/255).',
      maskMap: 'RGBA8, same grid. R = foam-trail cover = value/255 * trailMaxCover (the main current traced from each waterfall). G,B reserved (0). A = 255.',
      depth: 'not exported: signed depth = water.level - height from heightmap_r16.raw (positive = water).',
      rows: 'PNG row 0 (top) is Unity z max, same as every other image of this export.',
    },
    maxSpeed: wo.maxSpeed, bankRange: wo.bankRange, trailMaxCover: wo.trailMaxCover, trailReach: wo.trailReach, params: { leakLength: wo.leakLength, speedP95: wo.speedP95, wetMin: wo.wetMin },
    falls: waterRes.falls.map(f => ({ id: f.id, plunge: [U.x(f.cx ?? f.x), U.y(state.water), U.z(f.cz ?? f.z)], radius: +f.radius.toFixed(2), wetCells: f.wetCells, dry: !!f.dry })),
    inflows: (waterRes.inflows || []).map(f => ({ kind: f.kind, position: [U.x(f.x), U.z(f.z)], cells: f.cells, outlets: f.outlets, note: 'a river with no waterfall: flows from the border segment with the highest bed (inflow) to the other border segments (outlets)' })),
    currentPaths: waterRes.paths.map(p => ({ fall: p.fall, points: p.points.map(([x, z]) => [U.x(x), U.z(z)]) })),
    stats: waterRes.stats, ...(waterRes.cg ? { cg: waterRes.cg } : {}), ...(waterRes.flux ? { flux: { in: +waterRes.flux.in.toFixed(5), sink: +waterRes.flux.sink.toFixed(5), leak: +waterRes.flux.leak.toFixed(5), balance: +waterRes.flux.balance.toFixed(5) } } : {}),
    warnings: waterRes.warnings,
    unsupported: ['contact foam and colour absorption of objects standing in the water (bridge piers, rocks, characters)', 'refraction of the bed', 'reflections of bridges / props', 'sea surf and lava surface'],
  };
  const meta = {
    format: 'tdj-map-export', schemaVersion: 3, exporterVersion: EXPORTER_VERSION, roomId: state.roomId, manifest: 'manifest.json',
    coordinateSystem: {
      units: 'm', upAxis: '+Y', handedness: 'left (Unity)', origin: 'terrain corner = minimum x and z; y = 0 at the lowest encoded height',
      fromEditor: { x: `x_e + ${HALF}`, z: `${HALF} - z_e`, y: mn < 0 ? `y_e + ${(-mn).toFixed(3)}` : `y_e - ${mn.toFixed(3)}`, rotY: '-rot_e (degrees)' },
      rotation: 'rotY_deg / yawDeg: degrees, Unity Euler Y (positive = clockwise seen from above)',
      grid: { kind: 'vertices', count: TN, spacing: +TS.toFixed(6), first: [0, 0], last: [SIZE, SIZE], unityTerrainCompatible: TERRAIN_RES.includes(TN),
        editorGrid: { count: N, spacing: 1 / RES, note: 'map.json only. Every exported grid file uses the export grid above.' },
        sampling: { heights: 'bilinear on the editor grid', walkFloor: 'editor walk floor (bridges, stairs, secret passages) at each export vertex', weights: 'paint masks sampled bilinearly, then blended', masks: 'nearest editor vertex (values unchanged)', walkable: 're-evaluated at each export vertex (not interpolated)', holes: 'from the secret passage shape (see secretPassages)' } },
      raw: `row-major, 16-bit unsigned little-endian; ${TN}x${TN}; row r = z index (z = r*${+TS.toFixed(6)}), column c = x index (x = c*${+TS.toFixed(6)}); row 0 is z = 0`,
      images: `PNG, row 0 (top) is z = ${SIZE}, bottom row is z = 0, column 0 is x = 0 (same as Unity texture UV, v up)`,
      prefabFrame: 'see asset_catalog.json frame: prefab +Z = the way the player walks in, -Z = the side the player approaches from; rotation = yawDeg + catalog yawOffsetDeg',
      heightDecode: `y = value / 65535 * ${range.toFixed(4)}`,
    },
    terrain: { size: [SIZE, +range.toFixed(3), SIZE], heightmapResolution: TN, cellSize: +TS.toFixed(6), heightRange: +range.toFixed(4), editorYOfZero: +mn.toFixed(3), heightmap: 'heightmap_r16.raw', walkFloor: 'walk_floor_r16.raw', holesResolution: TN - 1, holes: holesPng ? 'holes.png' : null, holeCells: holeCount },
    textures: {
      'heightmap_r16.raw': { usage: 'height', decode: 'see coordinateSystem.heightDecode' },
      'walk_floor_r16.raw': { usage: 'walk floor height (bridges, stairs, secret passages)', decode: 'same as heightmap' },
      'weights_0.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(0, 3), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'weights_1.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(3, 6), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'weights_2.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(6, 9), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'weights_3.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(9), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'mask_0.png': { usage: 'raw paint masks (game logic)', channels: ['dirt', 'cobble', null], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_1.png': { usage: 'raw paint masks (game logic)', channels: ['sand', 'rubble', 'swamp'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_2.png': { usage: 'raw paint masks (game logic)', channels: ['poison', 'lava', 'snowfield'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_3.png': { usage: 'raw paint masks (game logic)', channels: ['ice', null, null], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      ...(holesPng ? { 'holes.png': { usage: 'terrain holes for secret passages: 0 = hole, 255 = keep the surface (TerrainData.SetHoles: true = surface). (heightmap-1)² cells, image row 0 = z max; cell (i, j) spans export vertices i..i+1, j..j+1. Every hole cell is covered by secret_passages_mesh.json (floor / walls / ceiling / cap)', sRGB: false, filter: 'point', mipmaps: false, compression: 'none' } } : {}),
      'cliff_style.png': { usage: 'rock-wall style index per export vertex (R; legend meta.cliffStyles)', sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'walkable.png': { usage: 'walkability (discrete values, never interpolate)', channels: ['final 255=walkable', 'surface 0 ground/32 bridge deck/48 stairs/64 secret/128 forced on/255 forced off (forced off wins over decks)', 'auto 255=walkable'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
    },
    groundBlend: { base: 'grass', layers: WEIGHT_LAYERS, rule: 'sequential: for each layer in order, m = smoothstep(lo, hi, mask); all weights *= (1 - m); weight[layer] += m. cliff comes from slope (1 - normal.y).', thresholds: { dirt: [.2, .55], cobble: [.3, .55], others: [.25, .6], cliff: [.24, .42] } },
    groundTypes: Object.fromEntries(GROUND.map((g, i) => [g, { maskFile: `mask_${[0, 0, 1, 1, 1, 2, 2, 2, 3][i]}.png`, maskChannel: [0, 1, 0, 1, 2, 0, 1, 2, 0][i], effectId: GROUND_EFFECT[g] || null, speedHint: GROUND_SPEED[i], ...(g === 'lava' ? { blocksWalk: true } : {}) }])),
    agentProfile: { ...state.agent, note: 'walkable.png と validation はこの体格用。大型の敵などは agentProfile を変えて計算し直してください。height は橋・階段の上の障害物の判定にだけ使用（頭上空間は未検査）。' },
    definitions: VALIDATION_DEFS,
    biome: state.biome, sunlight: state.sunOn,
    cliffStyle: { default: state.cliffStyle, map: 'cliff_style.png', note: 'Rock-wall style per location: cliff_style.png R = index into cliffStyles (nearest editor vertex, never interpolated). Applies to the terrain cliff faces (cliff layer in weights) and to rock / cliff / pebble props (props.csv cliffStyle column).' },
    cliffStyles: CLIFF_STYLES.map((c, i) => ({ index: i, id: c[0], name: c[1], ...cliffParams(c[2]) })),
    weather: { ...state.weather, wind: WEATHER[state.weather.kind].wind || 0, windDir: [+WIND_DIR.x.toFixed(4), +(-WIND_DIR.y).toFixed(4)] },
    atmosphere: { ...state.atmo, color: ATMOS[state.atmo.kind].color || null },
    water: [{ id: 'water_main', type: 'plane', level: U.y(state.water), liquid: BIOME().lava ? 'lava' : 'water', sea: state.sea }],
    waterSim,
    spawnPoints: [{ id: state.spawn.id, position: P3(state.spawn.x, spawnY, state.spawn.z), yawDeg: 0 }],
    ports: markers.filter(m => m.kind === 'port').map(portOut),
    enemySpots: markers.filter(m => m.kind === 'enemy').map(spotOut),
    chestSpots: markers.filter(m => m.kind === 'chest').map(spotOut),
    zones: markers.filter(m => m.kind === 'nobattle' || m.kind === 'nospawn').map(zoneOut),
    floorLinks: markers.filter(m => isLink(m.kind)).map(linkOut),
    floorLinksNote: 'magicCircle / stairsUp / stairsDown。tag は行き先（例: B2）。trigger に入ったら階層移動、この階へ来たときは arrival に立たせる。forward はプレイヤーが近づいてくる向き（= Prefab ローカル -Z を yawDeg で回したもの）。colliders は asset_catalog.json の solid をワールドに置いたもの。見た目と当たり判定は assetKey の Prefab で再現。',
    propCatalog: 'asset_catalog.json', props: 'props.csv',
    waterfalls: falls.map(f => { const [ux, uz] = fallDir(f); return { id: f.id, position: P3(f.x, f.bottom, f.z), yawDeg: U.yaw(f.rot), upstream: [+ux.toFixed(4), +(-uz).toFixed(4)], width: f.w, top: U.y(f.top), bottom: U.y(f.bottom), ...(f.sx !== undefined ? { source: [U.x(f.sx), U.z(f.sz)] } : {}) }; }),
    bridges: bridges.map(b => { const pr = bridgeProfile(b); return { id: b.id, type: b.type || 'wood', start: P3(b.x1, pr.y1, b.z1), end: P3(b.x2, pr.y2, b.z2), width: b.w, arch: +pr.arch.toFixed(3), deckCurve: 'y(t) = lerp(start.y, end.y, t) + arch * sin(pi t); negative arch = rope sag' }; }),
    stairs: stairs.map(st => ({ id: st.id, type: st.type, bottom: P3(st.x1, st.y1, st.z1), top: P3(st.x2, st.y2, st.z2), width: st.w, steps: stairSteps(st) })),
    secretPassages: {
      present: secrets.length > 0, holes: holesPng ? 'holes.png' : null, mesh: geo.passages.length ? 'secret_passages_mesh.json' : null, clearanceHeight: +(state.agent.height + .6).toFixed(2),
      shapeRule: 'The passage shape is the union of 0.5 m squares centred on the passage vertices of the editor grid (outline = exact boundary loops below). holes.png = export cells overlapping the part of that shape that has rock above the floor (> 0.3 m). secret_passages_mesh.json is built from the same shape on a 0.125 m raster: floor over the shape, walls along its outline (none at entrances), ceiling at floor + clearanceHeight where rock is thicker, lintels over portals, and a cap at the terrain surface over every hole cell that is not an open cut.',
      note: 'Unity: SetHoles from holes.png, then place secret_passages_mesh.json (world coordinates, clockwise faces) with a MeshCollider. route and width are guidance only — do not build geometry from them.',
      passages: geo.passages.map(g => { const s = g.region; return {
        id: s.id, cells: s.cells.length, area_m2: +(s.cells.length / (RES * RES)).toFixed(2), rockAboveMax: +s.rockAboveMax.toFixed(2),
        outline: g.loops.map(loop => loop.map(([x, z]) => [U.x(x), U.z(z)])),
        entrances: s.entrances.map(e => ({ position: P3(e.x, floorAt(e.x, e.z), e.z), cells: e.cells })),
        route: s.path.filter((k, i, a) => i % 2 === 0 || i === a.length - 1).map(k => { const x = vx(k % N), z = vx((k / N) | 0); return P3(x, F[k], z); }),
        routeIsGuideOnly: true, width: +((s.cells.length / Math.max(1, s.path.length)) / RES).toFixed(2), widthIsAverage: true,
        check: g.check,
      }; }),
    },
    validation: { errors: validation.errors.length, warnings: validation.warnings.length, file: 'validation.json' },
  };
  // map.json in the export leaves out revision / lastExportHash so that an unedited re-export is byte-identical
  const { revision: _rv, lastExportHash: _lh, ...mapData } = serialize(), mapJson = JSON.stringify(mapData);
  const readme = `マップエディター 書き出しデータ (schemaVersion 3, ${EXPORTER_VERSION})
roomId: ${state.roomId}
revision・書き出し日時・ファイルごとの SHA-256・contentHash は manifest.json にあります。

■ 座標（全ファイル共通。meta.json の coordinateSystem に機械可読で記載）
- 単位 m、Y が上、Unity の左手系。原点はテレインの角、y=0 は書き出した高さの最小値。
- グリッドは頂点 ${TN}x${TN}、${+TS.toFixed(6)}m 間隔（Unity Terrain の解像度。エディター内部は ${N}x${N}・0.5m で、map.json だけがそれを使います）。RAW は行 r = z 方向、行0 が z=0。PNG は上端が z=${SIZE}、下端が z=0（Unity のテクスチャと同じ）。
- 回転 rotY_deg / yawDeg は Unity の Euler Y（上から見て時計回りが正）。
- 高さの復元: y = 値/65535 × ${range.toFixed(4)}。

■ ファイル
- heightmap_r16.raw / walk_floor_r16.raw : 地形の高さ / 歩く床の高さ（橋・階段・隠し通路）。同じ倍率。
- weights_0〜3.png : Terrain Layer の重み（草を含めて合計255）。順番は meta.json の groundBlend.layers。
- mask_0〜3.png    : 塗りの元データ（毒沼・溶岩などのゲーム判定用）。効果は groundTypes の effectId。
- holes.png        : 隠し通路がある場合だけ。地形の穴（0 = 穴、(解像度-1)² セル）。
- secret_passages_mesh.json : 隠し通路の床・壁・天井・ふた（穴と同じ形から作成。Unity 座標）。meta.secretPassages に輪郭・出入口・検査結果。route と width は目安。
- water_flow.png / water_mask.png : 水の流れ（RG=流れ、B=流れ関数、A=岸からの距離）と、滝から流れの筋にそった泡の帯（R）。水の無い部屋・溶岩・海では出ません。読み方は meta.waterSim.encoding。水深は heightmap_r16.raw と水位から Unity 側で作ります。
- cliff_style.png  : 岩壁の種類（場所ごと。R = meta.cliffStyles の番号）。岩・崖石・小石は props.csv の cliffStyle 列。
- walkable.png     : 通行判定（離散値。補間しないでください）。meta.json の agentProfile の体格で計算。
- props.csv        : 小物の配置。instanceId は再書き出しでも変わりません。assetKey は asset_catalog.json の対応表。
- asset_catalog.json : 種類ごとの assetKey と、エディターが使う代理の当たり判定。編集してエディターに読み込めます。
- meta.json        : 座標仕様、開始地点、出入口・敵/宝箱候補・禁止範囲、階層移動（魔法陣・上り/下り階段 = floorLinks）、橋・階段・滝、水、天候、霧。
- validation.json  : 書き出し時の検証結果（エラー ${validation.errors.length} / 警告 ${validation.warnings.length}）。
- map.json         : エディター用の元データ（座標はエディター内部の中心基準。Unity では使いません）。
- manifest.json    : exporterVersion、revision、exportedAt、各ファイルの大きさと SHA-256、contentHash。

■ 変更の検出（manifest.json）
- contentHash = 「exporterVersion の1行」＋「ファイル名 SHA-256 の行（files の順）」を UTF-8 にした SHA-256。manifest.json 自身は含みません。
- exportedAt と revision は manifest.json にだけ書くので、編集せずに書き出し直すと contentHash は同じです。RAW・画像・カタログ・出力ロジック（exporterVersion）が変われば変わります。
- revision は contentHash が前回の書き出しと変わったときだけ 1 増えます。

■ Prefab の向き（asset_catalog.json の frame）
- Prefab のローカル +Z = プレイヤーが入っていく向き、-Z = 近づいてくる側。回転は yawDeg + yawOffsetDeg。
- 当たり判定（radius / offsets / solid）も同じローカル座標。エディター内部のローカル座標とは z の符号だけが違います。
`;
  const files = [
    { name: 'heightmap_r16.raw', data: heightRaw }, { name: 'walk_floor_r16.raw', data: floorRaw },
    ...weightPngs.map((d, i) => ({ name: `weights_${i}.png`, data: d })), ...maskPngs.map((d, i) => ({ name: `mask_${i}.png`, data: d })),
    ...(holesPng ? [{ name: 'holes.png', data: holesPng }] : []),
    ...(geo.passages.length ? [{ name: 'secret_passages_mesh.json', data: JSON.stringify({
      format: 'tdj-secret-passage-mesh', frame: 'Unity world, same as meta.json (m)', winding: 'clockwise front faces (Unity)', ceilingHeight: +(state.agent.height + .6).toFixed(2),
      submeshes: ['floor', 'wall', 'ceiling', 'cap'], note: 'cap = terrain surface over hole cells (follows the exported heightmap, bilinear inside each cell; Unity splits a terrain cell into two triangles, so the cap edge can differ from the terrain by the cell\'s bilinear-vs-triangle error).',
      passages: geo.passages.map(g => ({ id: g.id, vertices: g.verts.flatMap(([x, y, z]) => P3(x, y, z)), triangles: g.sub })),
    }) }] : []),
    ...waterPngs,
    { name: 'walkable.png', data: walkPng }, { name: 'cliff_style.png', data: cliffPng }, { name: 'props.csv', data: csv },
    { name: 'asset_catalog.json', data: JSON.stringify(catalogExport(), null, 2) },
    { name: 'meta.json', data: JSON.stringify(meta, null, 2) }, { name: 'validation.json', data: JSON.stringify(validation, null, 2) },
    { name: 'map.json', data: mapJson }, { name: 'README.txt', data: readme },
  ];
  const enc = new TextEncoder(), bytesOf = d => typeof d === 'string' ? enc.encode(d) : d;
  const listing = files.map(f => { const b = bytesOf(f.data); return { name: f.name, bytes: b.length, sha256: sha256(b) }; });
  const contentHash = sha256(enc.encode([EXPORTER_VERSION, ...listing.map(l => `${l.name} ${l.sha256}`)].join('\n')));
  if (contentHash !== state.lastExportHash) { if (state.lastExportHash || !state.revision) state.revision++; state.lastExportHash = contentHash; }
  const manifest = {
    format: 'tdj-map-export-manifest', schemaVersion: 3, exporterVersion: EXPORTER_VERSION, roomId: state.roomId, revision: state.revision, exportedAt: new Date().toISOString(),
    contentHash, contentHashDefinition: 'SHA-256 of the UTF-8 text: exporterVersion, then one line "<name> <sha256>" per entry of files in order, joined with \\n. manifest.json itself is not included; exportedAt and revision live only here.',
    files: listing,
  };
  files.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  return { validation, manifest, files };
}

// ============================================================
// UI
// ============================================================
const $ = id => document.getElementById(id);
const toastEl = $('toast'); let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1400); }
const toolsEl = $('tools');
TOOLS.forEach(t => { const b = document.createElement('button'); b.dataset.tool = t.id; b.innerHTML = `${t.name}<kbd>${t.key}</kbd>`; b.onclick = () => setTool(t.id); toolsEl.appendChild(b); });
const biomeSel = $('biome'), paletteSel = $('palette');
paletteSel.add(new Option('全て', 'all'));
for (const b of BIOMES) { biomeSel.add(new Option(b.name, b.id)); paletteSel.add(new Option(b.name, b.id)); }
biomeSel.onchange = e => {
  pushUndo(); state.biome = e.target.value;
  state.sunOn = !BIOME().noSun; $('sunOn').checked = state.sunOn;
  const a = BIOME().atmo; state.atmo = { ...state.atmo, kind: a ? a[0] : 'none', amount: a ? a[1] : state.atmo.amount };
  applyBiome(e.target.value); toast(`マップのバイオーム: ${BIOME().name}` + (a ? `（${ATMOS[a[0]].name}）` : ''));
};
$('sunOn').onchange = e => { pushUndo(); state.sunOn = e.target.checked; applyAtmo(); };
const weatherSel = $('weatherKind');
for (const [k, v] of Object.entries(WEATHER)) weatherSel.add(new Option(v.name, k));
weatherSel.onchange = e => { pushUndo(); state.weather.kind = e.target.value; applyAtmo(); };
$('weatherAmount').addEventListener('pointerdown', pushUndo);
$('weatherAmount').oninput = e => { state.weather.amount = +e.target.value; applyAtmo(); };
const atmoSel = $('atmoKind');
for (const [k, v] of Object.entries(ATMOS)) atmoSel.add(new Option(v.name, k));
atmoSel.onchange = e => { pushUndo(); state.atmo.kind = e.target.value; applyAtmo(); };
$('atmoAmount').addEventListener('pointerdown', pushUndo); $('atmoHeight').addEventListener('pointerdown', pushUndo);
$('atmoAmount').oninput = e => { state.atmo.amount = +e.target.value; applyAtmo(); };
$('atmoHeight').oninput = e => { state.atmo.height = +e.target.value; applyAtmo(); };
paletteSel.onchange = e => { state.palette = e.target.value; applyPalette(); };
$('cliffStyle').innerHTML = CLIFF_STYLES.map(([v, name]) => `<option value="${v}">${name}</option>`).join('');
$('cliffStyle').value = state.cliffStyle;
$('cliffStyle').onchange = e => { pushUndo(); state.cliffStyle = e.target.value; applyCliffStyle(); };
const typesEl = $('types');
PROP.forEach((p, i) => { const l = document.createElement('label'); l.innerHTML = `<input type="checkbox" data-type="${i}" ${state.types.has(i) ? 'checked' : ''}> ${p.name}`; typesEl.appendChild(l); });
typesEl.addEventListener('change', e => { const i = +e.target.dataset.type; e.target.checked ? state.types.add(i) : state.types.delete(i); });
const DRAG_TOOLS = ['bridge', 'slope', 'stairs', 'coast'];
const dragWidth = tool => tool === 'link' ? 2.2 : tool === 'marker' ? clamp(state.radius * .5, 1.5, 6) : tool === 'coast' ? 1 : tool === 'slope' ? clamp(state.radius, 2, 12) : tool === 'stairs' ? clamp(state.radius * .5, 1.2, 4) : clamp(state.radius * .5, 1.6, 4);
function showVariants() {
  const tool = state.tool, box = $('variantBox'), list = $('variants');
  $('markerOpts').hidden = tool !== 'marker' && tool !== 'link';
  $('markerTag').placeholder = tool === 'link' ? '行き先 例: B2, 上の階' : '例: field, boss, north';
  const opts = tool === 'marker' ? MARKER_KINDS : tool === 'link' ? LINK_KINDS : tool === 'cliffpaint' ? [[0, 'マップの既定'], ...CLIFF_STYLES.map((c, i) => [i + 1, c[1]])] : tool === 'bridge' ? BRIDGE_TYPES.filter(([v]) => inPalette(BRIDGE_TAGS[v]))
    : tool === 'stairs' ? STAIR_TYPES.filter(([v]) => inPalette(STAIR_TAGS[v]))
    : tool === 'place' ? PROP.map((t, i) => [i, t.name]).filter(([i]) => propVisible(i)) : null;
  if (opts && opts.length && !opts.some(([v]) => v === state.variant[tool])) { state.variant[tool] = opts[0][0]; if (tool === 'place') preview.geometry = PROP[opts[0][0]].geo; }
  box.hidden = !opts; $('placeOpts').hidden = tool !== 'place';
  if (!opts) return;
  $('variantTitle').textContent = tool === 'marker' ? 'マーカーの種類' : tool === 'link' ? '階層移動の種類' : tool === 'cliffpaint' ? '岩壁の種類' : tool === 'bridge' ? '橋の種類' : tool === 'stairs' ? '階段の種類' : '置く物';
  list.innerHTML = '';
  for (const [v, name] of opts) {
    const b = document.createElement('button'); b.textContent = name; b.classList.toggle('on', state.variant[tool] === v);
    b.onclick = () => { state.variant[tool] = v; showVariants(); if (tool === 'place') preview.geometry = PROP[v].geo; };
    list.appendChild(b);
  }
}
function applyBiome(id) {
  state.biome = (BIOMES.find(b => b.id === id) || BIOMES[1]).id;
  const B = BIOME(), v3 = (u, c) => u.value.setRGB(c[0], c[1], c[2]);
  scene.background.setHex(B.bg); scene.fog.color.setHex(B.fog ?? B.bg); scene.fog.near = (B.fogNear ?? 140) * FOG_K; scene.fog.far = (B.fogFar ?? 280) * FOG_K;
  hemi.color.setHex(B.sky); hemi.groundColor.setHex(B.ground); hemi.intensity = B.hemi;
  sun.color.setHex(B.sun); sun.intensity = B.sunI; renderer.toneMappingExposure = B.exp;
  v3(BU.uG0, B.g[0]); v3(BU.uG1, B.g[1]); v3(BU.uGH, B.g[2]); v3(BU.uRockTint, B.rock || [1, 1, 1]); v3(BU.uPropTint, B.prop || [1, 1, 1]);
  v3(BU.uShallow, B.water[0]); v3(BU.uDeep, B.water[1]);
  if (B.moss) v3(BU.uMoss, B.moss); BU.uMossAmt.value = B.moss ? 1 : 0;
  BU.uLava.value = B.lava ? 1 : 0; BU.uSea.value = state.sea || B.id === 'beach' ? 1 : 0; BU.uFlowers.value = B.flowers ?? 1; BU.uSnow.value = B.snow || 0; BU.uSnowLine.value = B.snowLine ?? -100;
  if ($('biome')) $('biome').value = B.id;
  walkDirty = true;
  applyAtmo();
}
function applyPalette() {
  for (const b of toolsEl.children) b.hidden = !toolVisible(b.dataset.tool);
  for (const l of typesEl.children) l.hidden = !propVisible(+l.querySelector('input').dataset.type);
  if (!toolVisible(state.tool)) setTool('plateau'); else showVariants();
  if (state.palette === 'all') { $('paletteInfo').textContent = '全てのパーツを表示しています。'; return; }
  const all = [...PROP.map(t => t.tags), ...Object.values(GTOOL_TAGS), ...Object.values(BRIDGE_TAGS), ...Object.values(STAIR_TAGS)];
  const own = all.filter(t => t.includes(state.palette)).length, common = all.filter(t => t.includes('common')).length;
  $('paletteInfo').textContent = `このバイオーム専用 ${own}種 ＋ 共通 ${common}種` + (own < 4 ? '（専用パーツは今後追加予定）' : '');
}
function setTool(id) {
  state.tool = id;
  if ($('variantBox')) showVariants();
  if ((id.startsWith('walk') || id === 'secret') && !state.showWalk) setWalkView(true);
  for (const b of toolsEl.children) b.classList.toggle('on', b.dataset.tool === id);
  $('hint').textContent = TOOLS.find(t => t.id === id).hint;
}
const wsf = $('waterShowFlow'), wsm = $('waterShowFoam');
const syncWaterShow = which => { if (which === 'flow' && wsf.checked) wsm.checked = false; if (which === 'foam' && wsm.checked) wsf.checked = false; WATERU.uShow.value = wsf.checked ? 1 : wsm.checked ? 2 : 0; };
wsf.onchange = () => syncWaterShow('flow'); wsm.onchange = () => syncWaterShow('foam');
const sliders = [['radius', v => v.toFixed(1)], ['strength', v => v.toFixed(2)], ['density', v => v.toFixed(1)], ['water', v => v.toFixed(2)]];
function syncUI() { for (const [id, f] of sliders) { $(id).value = state[id]; $(id + 'V').textContent = f(state[id]); } }
for (const [id, f] of sliders) {
  $(id).addEventListener('input', e => {
    state[id] = +e.target.value; $(id + 'V').textContent = f(state[id]);
    if (id === 'water') { updateTerrain(); rebuildProps(); }
  });
  if (id === 'water') $(id).addEventListener('pointerdown', pushUndo);
}
function syncPlaceUI() { $('placeScale').value = state.placeScale; $('placeScaleV').textContent = '×' + state.placeScale.toFixed(2); $('placeRot').value = state.placeRot; $('placeRotV').textContent = state.placeRot + '°'; $('placeRandom').checked = state.placeRandom; }
$('placeScale').oninput = e => { state.placeScale = +e.target.value; syncPlaceUI(); };
$('placeRot').oninput = e => { state.placeRot = +e.target.value; syncPlaceUI(); };
$('placeRandom').onchange = e => { state.placeRandom = e.target.checked; };
syncPlaceUI();
$('modeEdit').onclick = () => setMode('edit');
$('modePlay').onclick = () => setMode('play');
$('undo').onclick = undo; $('redo').onclick = redo;
$('walkView').onclick = () => setWalkView(!state.showWalk);
$('autoRocks').onclick = () => { pushUndo(); autoRocks(); toast('崖のまわりに岩を配置しました'); };
$('newSample').onclick = () => { if (SIZE !== 64) { reloadAtSize(64, 'sample'); return; } pushUndo(); genSample((Math.random() * 1e6) | 0); syncUI(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); };
$('newSample2').onclick = () => {
  if (SIZE !== SAMPLE2_SIZE) { if (!reloadAtSize(SAMPLE2_SIZE, 'sample2')) toast('このブラウザではサイズを変えられません'); return; }
  pushUndo(); genSample2(); applyBiome(state.biome); syncUI(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); rebuildMarkers();
};
$('newFlat').onclick = () => {
  const size = +$('mapSize').value;
  if (size !== SIZE) { if (!reloadAtSize(size, 'flat')) toast('このブラウザではサイズを変えられません'); return; }
  pushUndo(); genFlat(); syncUI(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); rebuildMarkers();
};
$('mapSize').innerHTML = MAP_SIZES.map(v => `<option value="${v}" ${v === SIZE ? 'selected' : ''}>${v} × ${v} m${v === 64 ? '（標準）' : v < 64 ? '（狭い部屋）' : '（広い部屋）'}</option>`).join('');
$('mapSizeNow').textContent = `いまのマップ: ${SIZE} × ${SIZE} m`;
$('save').onclick = () => download('map.json', new Blob([JSON.stringify(serialize())], { type: 'application/json' }));
$('load').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()), before = snapshot(); deserialize(d); undoStack.push(before); redoStack.length = 0; toast('読み込みました'); } catch (err) { toast('読み込み失敗: ' + err.message); }
  e.target.value = '';
};
$('export').onclick = async () => {
  const { files, validation } = await buildExport(); showValidation(validation);
  download('map_export_unity.zip', makeZip(files));
  toast(validation.errors.length ? `書き出しました（エラー ${validation.errors.length} 件。検証結果を確認してください）` : '書き出しました');
};
$('validate').onclick = () => showValidation(runValidation());
$('loadCatalog').onclick = () => $('catalogFile').click();
$('catalogFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const d = JSON.parse(await f.text()); pushUndo(); state.catalog = normalizeCatalog(d); applyCatalog(); rebuildMarkers(); toast('資産対応表を読み込みました'); } catch (err) { toast('読み込み失敗: ' + err.message); }
  e.target.value = '';
};
function syncAgentUI() { for (const k of AGENT_KEYS) if ($('ag_' + k)) $('ag_' + k).value = state.agent[k]; }
const AGENT_KEYS = ['radius', 'height', 'maxSlopeDeg', 'maxWaterDepth', 'maxStep', 'arrivalClearance'];
for (const k of AGENT_KEYS) $('ag_' + k).onchange = e => { state.agent[k] = +e.target.value; walkDirty = true; colliders = null; };
syncAgentUI();

function setMode(m) {
  state.mode = m; document.body.classList.toggle('play', m === 'play');
  $('modeEdit').classList.toggle('on', m === 'edit'); $('modePlay').classList.toggle('on', m === 'play');
  hero.visible = m === 'play'; spawnMarker.visible = ring.visible = markerGroup.visible = m === 'edit'; preview.visible = false;
  if (m !== 'play' && ghosts.size) { ghosts = new Set(); rebuildProps(true); }
  heroMat.depthTest = true; hero.renderOrder = 0; heroMat.opacity = 1; heroMat.emissive.setHex(0x000000);
  if (m === 'play') {
    if (walkDirty) computeWalk();
    player.x = state.spawn.x; player.z = state.spawn.z; player.y = heightAt(player.x, player.z);
    if (!walkable(player.x, player.z)) toast('開始地点が歩けない場所です（木や崖、深い水）');
    playCam.yaw = cam.yaw;
  }
  resize(); hud(); canvas.focus();
}

// brush ring
const RING_N = 72;
const ring = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_N * 3), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, depthTest: false }));
ring.renderOrder = 5; scene.add(ring);
function updateRing() {
  preview.visible = false;
  ring.visible = state.mode === 'edit' && !!hit;
  if (!ring.visible) return;
  const a = ring.geometry.attributes.position.array, r = state.tool === 'spawn' ? .8 : state.radius;
  preview.visible = false;
  const outline = (c, color, lift) => {
    for (let k = 0; k < RING_N; k++) {
      const e = k / RING_N * c.length, i = Math.floor(e), t = e - i, [x0, z0] = c[i], [x1, z1] = c[(i + 1) % c.length], x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      a[k * 3] = x; a[k * 3 + 1] = Math.max(heightAt(x, z), state.water) + lift; a[k * 3 + 2] = z;
    }
    ring.geometry.attributes.position.needsUpdate = true; ring.material.color.set(color);
  };
  const rect = (x0, z0, x1, z1, hw) => { const L = Math.hypot(x1 - x0, z1 - z0) || 1, qx = -(z1 - z0) / L * hw, qz = (x1 - x0) / L * hw; return [[x0 + qx, z0 + qz], [x1 + qx, z1 + qz], [x1 - qx, z1 - qz], [x0 - qx, z0 - qz]]; };
  const circle = (x, z, r) => Array.from({ length: 24 }, (_, k) => [x + Math.cos(k / 24 * 6.283) * r, z + Math.sin(k / 24 * 6.283) * r]);
  if (state.tool === 'pick') {
    const tg = pickTarget(hit.x, hit.z);
    if (!tg) { outline(circle(hit.x, hit.z, .4), 0xff9a8a, .15); return; }
    if (tg.kind === 'prop') outline(circle(tg.ref[1], tg.ref[2], VIS_R[tg.ref[0]] * tg.ref[4] * .75 + .2), 0xff4a4a, .25);
    else if (tg.kind === 'fall') outline(circle(tg.ref.x, tg.ref.z, tg.ref.w * .6 + .3), 0xff4a4a, .25);
    else if (tg.kind === 'marker') outline(circle(tg.ref.x, tg.ref.z, Math.max(markerRadius(tg.ref), .8)), 0xff4a4a, .25);
    else outline(rect(tg.ref.x1, tg.ref.z1, tg.ref.x2, tg.ref.z2, tg.ref.w / 2 + .2), 0xff4a4a, .6);
    return;
  }
  if (state.tool === 'place') {
    const t = state.variant.place, s0 = (PROP[t].sc[0] + PROP[t].sc[1]) / 2 * state.placeScale;
    preview.visible = true; preview.position.set(hit.x, heightAt(hit.x, hit.z), hit.z); preview.rotation.y = state.placeRot * Math.PI / 180; preview.scale.setScalar(s0);
    outline(circle(hit.x, hit.z, VIS_R[t] * s0 * .75 + .15), 0x9cff8a, .15);
    return;
  }
  if ((DRAG_TOOLS.includes(state.tool) || state.tool === 'marker' || state.tool === 'link') && stroke.active && stroke.dragStart) {
    const s0 = stroke.dragStart, L = Math.hypot(hit.x - s0.x, hit.z - s0.z) || 1, w = dragWidth(state.tool) / 2;
    const qx = -(hit.z - s0.z) / L * w, qz = (hit.x - s0.x) / L * w, c = [[s0.x + qx, s0.z + qz], [hit.x + qx, hit.z + qz], [hit.x - qx, hit.z - qz], [s0.x - qx, s0.z - qz]];
    for (let k = 0; k < RING_N; k++) {
      const e = k / RING_N * 4, i = Math.floor(e), t = e - i, [x0, z0] = c[i], [x1, z1] = c[(i + 1) % 4], x = lerp(x0, x1, t), z = lerp(z0, z1, t);
      a[k * 3] = x; a[k * 3 + 1] = Math.max(heightAt(x, z), state.water) + .5; a[k * 3 + 2] = z;
    }
    const dh = Math.abs(heightAt(hit.x, hit.z) - heightAt(s0.x, s0.z));
    const ok = state.tool === 'marker' || state.tool === 'link' ? true : state.tool === 'coast' ? L >= 2 : state.tool === 'bridge' ? L >= 2 && L <= 26 : state.tool === 'slope' ? L >= 2 && dh / L <= .75 : L >= 1.2 && dh >= .3 && dh / L <= 1.25;
    ring.geometry.attributes.position.needsUpdate = true; ring.material.color.set(ok ? 0xffd27a : 0xff7a6a);
    return;
  }
  for (let k = 0; k < RING_N; k++) { const t = k / RING_N * Math.PI * 2, x = hit.x + Math.cos(t) * r, z = hit.z + Math.sin(t) * r; a[k * 3] = x; a[k * 3 + 1] = Math.max(heightAt(x, z), state.water) + .15; a[k * 3 + 2] = z; }
  ring.geometry.attributes.position.needsUpdate = true;
  ring.material.color.set(state.tool === 'erase' ? 0xff7a6a : state.tool === 'scatter' || state.tool === 'walkOn' ? 0x9cff8a : state.tool === 'walkOff' ? 0xff6ae0 : state.tool === 'secret' ? 0x6ee6ff : 0xffffff);
}

const preview = new THREE.Mesh(PROP[0].geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: .6, depthWrite: false }));
preview.visible = false; preview.renderOrder = 9; scene.add(preview);
// nearest deletable thing under the cursor
function pickTarget(x, z) {
  let best = null, bd = 1;
  const offer = (kind, ref, d, label) => { if (d < bd) { bd = d; best = { kind, ref, label }; } };
  for (const p of props) { const r = VIS_R[p[0]] * p[4] * .75 + .3, d = Math.hypot(p[1] - x, p[2] - z); if (d < r) offer('prop', p, d / r, PROP[p[0]].name); }
  for (const b of bridges) { const d = distToPolyline(x, z, [[b.x1, b.z1], [b.x2, b.z2]]); if (d < b.w / 2 + .3) offer('bridge', b, d / (b.w / 2 + .3) * .9, BRIDGE_TYPES.find(t => t[0] === (b.type || 'wood'))[1]); }
  for (const st of stairs) { const d = distToPolyline(x, z, [[st.x1, st.z1], [st.x2, st.z2]]); if (d < st.w / 2 + .3) offer('stairs', st, d / (st.w / 2 + .3) * .9, STAIR_TYPES.find(t => t[0] === st.type)[1]); }
  for (const f of falls) { const r = f.w * .6 + .6, d = Math.hypot(f.x - x, f.z - z); if (d < r) offer('fall', f, d / r, '滝'); }
  for (const m of markers) { const r = Math.max(markerRadius(m), 1), d = Math.hypot(m.x - x, m.z - z); if (d < r) offer('marker', m, d / r * .8, markerLabel(m.kind)); }
  return best;
}

// ============================================================
// Input
// ============================================================
const keys = new Set();
const mouse = new THREE.Vector2(); const ray = new THREE.Raycaster();
let drag = null, lastXY = [0, 0], pointerIn = false;
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect();
  mouse.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const h = ray.intersectObject(terrain, false)[0];
  return h ? h.point : null;
}
function beginStroke(e) {
  if (!hit) return;
  pushUndo();
  stroke.active = true; stroke.base = heightAt(hit.x, hit.z); stroke.lower = e.shiftKey; stroke.lastStamp = null;
  if (state.tool === 'place') {
    stroke.active = false;
    const t = state.variant.place, s0 = (PROP[t].sc[0] + PROP[t].sc[1]) / 2 * state.placeScale * (state.placeRandom ? .9 + Math.random() * .2 : 1);
    props.push([t, hit.x, hit.z, state.placeRot * Math.PI / 180, s0, 0]); rebuildProps();
    if (state.placeRandom) { state.placeRot = (state.placeRot + 15 * ((Math.random() * 24) | 0)) % 360; syncPlaceUI(); }
    toast(PROP[t].name + 'を置きました');
    return;
  }
  if (state.tool === 'pick') {
    stroke.active = false;
    const tg = pickTarget(hit.x, hit.z);
    if (!tg) { toast('近くに消せる物がありません'); return; }
    if (tg.kind === 'prop') { props = props.filter(p => p !== tg.ref); rebuildProps(); }
    else if (tg.kind === 'bridge') { bridges = bridges.filter(b => b !== tg.ref); rebuildBridges(); }
    else if (tg.kind === 'stairs') { stairs = stairs.filter(st => st !== tg.ref); rebuildStairs(); }
    else if (tg.kind === 'fall') { falls = falls.filter(f => f !== tg.ref); rebuildFalls(); }
    else if (tg.kind === 'marker') { markers = markers.filter(m => m !== tg.ref); rebuildMarkers(); }
    toast(tg.label + 'を消しました');
    return;
  }
  if (state.tool === 'marker' || state.tool === 'link') {
    if (e.shiftKey) {
      stroke.active = false; let best = null, bd = 1e9;
      for (const m of markers) { if (isLink(m.kind) !== (state.tool === 'link')) continue; const d = Math.hypot(m.x - hit.x, m.z - hit.z); if (d < Math.max(markerRadius(m), 1.2) && d < bd) { bd = d; best = m; } }
      if (best) { markers = markers.filter(m => m !== best); rebuildMarkers(); toast(markerLabel(best.kind) + 'を消しました'); } else toast('近くにありません');
    } else if (state.tool === 'link' || state.variant.marker === 'port') stroke.dragStart = { x: hit.x, z: hit.z };
    else { stroke.active = false; placeMarker(state.variant.marker, hit); toast(MARKER_KINDS.find(k => k[0] === state.variant.marker)[1] + 'を置きました'); }
    return;
  }
  if (state.tool === 'stairs' && e.shiftKey) {
    stroke.active = false; const n0 = stairs.length;
    stairs = stairs.filter(st => distToPolyline(hit.x, hit.z, [[st.x1, st.z1], [st.x2, st.z2]]) > Math.max(state.radius * .5, st.w));
    rebuildStairs(); toast(n0 !== stairs.length ? '階段を消しました' : '近くに階段がありません');
    return;
  }
  if (state.tool === 'slope' || state.tool === 'stairs' || state.tool === 'coast') { stroke.dragStart = { x: hit.x, z: hit.z }; return; }
  if (state.tool === 'bridge') {
    if (e.shiftKey) {
      stroke.active = false; const n0 = bridges.length;
      bridges = bridges.filter(b => distToPolyline(hit.x, hit.z, [[b.x1, b.z1], [b.x2, b.z2]]) > Math.max(state.radius, b.w));
      rebuildBridges(); toast(n0 !== bridges.length ? '橋を消しました' : '近くに橋がありません');
    } else stroke.dragStart = { x: hit.x, z: hit.z };
    return;
  }
  if (state.tool === 'fall') {
    stroke.active = false;
    if (e.shiftKey) { const n0 = falls.length; falls = falls.filter(f => Math.hypot(f.x - hit.x, f.z - hit.z) > state.radius); rebuildFalls(); toast(n0 !== falls.length ? '滝を消しました' : '近くに滝がありません'); }
    else toast(placeFall(hit.x, hit.z, clamp(state.radius * .5, 1, 6)) ? '滝を置きました' : 'ここは崖ではありません（高低差1m以上の急斜面をクリック）');
    return;
  }
  if (state.tool === 'spawn') { state.spawn = { x: +hit.x.toFixed(2), z: +hit.z.toFixed(2) }; stroke.active = false; toast('開始地点を設定しました'); }
  else if (state.tool === 'scatter' || state.tool === 'erase') stampAt(hit);
}
function stampAt(p) {
  if (stroke.lastStamp && Math.hypot(p.x - stroke.lastStamp.x, p.z - stroke.lastStamp.z) < state.radius * .55) return;
  stroke.lastStamp = { x: p.x, z: p.z };
  state.tool === 'scatter' ? scatterAt(p.x, p.z) : eraseAt(p.x, p.z);
}
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); canvas.focus(); lastXY = [e.clientX, e.clientY];
  if (e.button === 2) drag = 'orbit';
  else if (e.button === 1) { drag = 'pan'; e.preventDefault(); }
  else if (e.button === 0 && state.mode === 'edit') { hit = pick(e.clientX, e.clientY); beginStroke(e); }
});
canvas.addEventListener('pointermove', e => {
  pointerIn = true;
  const dx = e.clientX - lastXY[0], dy = e.clientY - lastXY[1]; lastXY = [e.clientX, e.clientY];
  const c = state.mode === 'edit' ? cam : playCam;
  if (drag === 'orbit') { c.yaw -= dx * .006; if (state.mode === 'edit') c.pitch = clamp(c.pitch + dy * .005, .25, 1.45); }
  else if (drag === 'pan' && state.mode === 'edit') {
    const s = cam.dist * .0016, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    cam.target.x += (-dx * Math.cos(cam.yaw) + dy * fx) * s * 1; cam.target.z += (dx * Math.sin(cam.yaw) + dy * fz) * s;
  }
  if (state.mode === 'edit') { hit = pick(e.clientX, e.clientY); if (stroke.active && hit && (state.tool === 'scatter' || state.tool === 'erase')) stampAt(hit); }
});
canvas.addEventListener('pointerup', () => {
  if (stroke.cliffChanged) { stroke.cliffChanged = false; rebuildProps(true); }
  if (stroke.active && markers.length && !['marker', 'link', 'spawn', 'pick', 'place'].includes(state.tool)) rebuildMarkers();   // rings follow edited ground
  if (stroke.groundChanged) { stroke.groundChanged = false; regenGroundProps(); }
  if (stroke.active && stroke.dragStart && hit) {
    const a = stroke.dragStart, c = { x: hit.x, z: hit.z }, w = dragWidth(state.tool);
    if (state.tool === 'bridge') toast(placeBridge(a, c, w, state.variant.bridge) ? '橋を架けました' : '長さ2〜26mの範囲でドラッグしてください');
    else if (state.tool === 'slope') { const err = placeSlope(a, c, w); toast(err || '坂を作りました'); }
    else if (state.tool === 'stairs') { const err = placeStairs(a, c, w, state.variant.stairs); toast(err || '階段を作りました'); }
    else if (state.tool === 'coast') toast(makeCoast(a, c) ? '海岸を作りました' : '2m以上ドラッグしてください');
    else if (state.tool === 'marker') { placeMarker('port', a, c); toast('出入口を置きました'); }
    else if (state.tool === 'link') { placeMarker(state.variant.link, a, c); toast(markerLabel(state.variant.link) + 'を置きました'); }
  }
  stroke.dragStart = null; drag = null; stroke.active = false;
});
canvas.addEventListener('pointerleave', () => { pointerIn = false; hit = null; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (state.mode === 'edit') cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0012), 6, Math.max(140, SIZE * 2.4));
  else playCam.dist = clamp(playCam.dist * Math.exp(e.deltaY * .0012), 7, 40);
}, { passive: false });
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.code === 'Tab') { e.preventDefault(); setMode(state.mode === 'edit' ? 'play' : 'edit'); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
  if (state.mode === 'edit') {
    const t = TOOLS.find(t => t.key === e.key); if (t && toolVisible(t.id)) { setTool(t.id); return; }
    if (e.key === 'v' || e.key === 'V') { setWalkView(!state.showWalk); return; }
    if ((e.key === 'r' || e.key === 'R') && state.tool === 'place') { state.placeRot = (state.placeRot + 45) % 360; syncPlaceUI(); return; }
    if (e.key === '[') { state.radius = clamp(state.radius - .5, 1, 14); syncUI(); }
    if (e.key === ']') { state.radius = clamp(state.radius + .5, 1, 14); syncUI(); }
  }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// ============================================================
// Loop
// ============================================================
const _tgt = new THREE.Vector3();
let fpsAcc = 0, fpsN = 0, fps = 0;
function update(dt) {
  timeU.value += dt;
  for (const [o, sp] of linkSpin) { if (o.geometry.type === 'PlaneGeometry') o.rotation.z += dt * sp; else { o.rotation.y += dt * sp; o.material.opacity = .42 + Math.sin(timeU.value * 2.2) * .1; } }
  { const c = state.mode === 'edit' ? cam.target : player; WU.uCenter.value.set(c.x, (state.mode === 'edit' ? heightAt(c.x, c.z) : player.y) + 2, c.z); }
  if (WEATHER[state.weather.kind]?.lightning) {
    if (flash <= 0 && Math.random() < dt * .18 * state.weather.amount) flash = .4;
    if (flash > 0) { flash -= dt; const f = flash > .3 || (flash > .12 && flash < .2) ? 1 : 0; hemi.intensity = weatherHemi + f * 4; if (flash <= 0) hemi.intensity = weatherHemi; }
  }
  if (glowTick-- <= 0) { glowTick = 20; const c = state.mode === 'edit' ? cam.target : player; updateGlowLights(c.x, c.z); }
  glowLights.forEach((l, k) => { l.intensity = l.userData.base * (.85 + .15 * Math.sin(timeU.value * 9 + k * 2.1)) * (1 - .5 * dimU.value); });
  for (const c of fallGroup.children) if (c.userData.mist) {
    const t = timeU.value * 1.3 + c.userData.ph; c.scale.setScalar(c.userData.base * (1 + .08 * Math.sin(t))); c.material.opacity = (.34 + .1 * Math.sin(t * .7)) * (1 - .6 * dimU.value);
  }
  const dimT = state.showWalk ? 1 : 0;
  if (dimU.value !== dimT) applyDim(Math.abs(dimT - dimU.value) < .02 ? dimT : lerp(dimU.value, dimT, Math.min(1, dt * 10)));
  const ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), iz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  if (state.mode === 'edit') {
    if (ix || iz) {
      const s = cam.dist * .9 * dt, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      cam.target.x = clamp(cam.target.x + (fx * iz + rx * ix) * s, -HALF, HALF); cam.target.z = clamp(cam.target.z + (fz * iz + rz * ix) * s, -HALF, HALF);
    }
    if (keys.has('KeyQ')) cam.yaw += dt * 1.2; if (keys.has('KeyE')) cam.yaw -= dt * 1.2;
    if (state.showWalk && walkDirty) computeWalk();
    if (stroke.active && hit && !['scatter', 'erase', 'spawn', 'fall'].includes(state.tool)) {
      applyBrush(hit.x, hit.z, Math.min(dt, .05)); updateTerrain(); rebuildProps();
    }
    placeCamera(cam, cam.target);
    spawnMarker.position.set(state.spawn.x, heightAt(state.spawn.x, state.spawn.z) + 1.4 + Math.sin(timeU.value * 3) * .15, state.spawn.z);
    updateRing();
  } else {
    if (keys.has('KeyQ')) playCam.yaw += dt * 1.6; if (keys.has('KeyE')) playCam.yaw -= dt * 1.6;
    let mx = 0, mz = 0;
    if (ix || iz) {
      const fx = -Math.sin(playCam.yaw), fz = -Math.cos(playCam.yaw), rx = Math.cos(playCam.yaw), rz = -Math.sin(playCam.yaw);
      mx = fx * iz + rx * ix; mz = fz * iz + rz * ix; const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    }
    const depth = state.water - floorAt(player.x, player.z);
    const onStruct = (bridges.length && bridgeAt(player.x, player.z) !== null) || (stairs.length && stairsAt(player.x, player.z) !== null);
    let gs = 1; if (!onStruct) for (let c = 2; c < NS; c++) gs = Math.min(gs, lerp(1, GROUND_SPEED[c], clamp(splatAt(player.x, player.z, c) * 1.6, 0, 1)));
    state.onPoison = !onStruct && splatAt(player.x, player.z, 5) > .5;
    state.onLink = markers.find(m => isLink(m.kind) && (() => { const T = linkTrigger(m); return Math.hypot(player.x - T.x, player.z - T.z) < m.r + state.agent.radius; })()) || null;
    const sp = (keys.has('ShiftLeft') ? 8 : 5) * (depth > .15 && !onStruct ? .5 : 1) * gs * dt;
    player.moving = 0;
    if (mx || mz) {
      const nx = player.x + mx * sp, nz = player.z + mz * sp;
      if (walkable(nx, nz)) { player.x = nx; player.z = nz; player.moving = 1; }
      else if (walkable(nx, player.z)) { player.x = nx; player.moving = 1; }
      else if (walkable(player.x, nz)) { player.z = nz; player.moving = 1; }
      const want = Math.atan2(mx, mz); let d = want - player.face; d = Math.atan2(Math.sin(d), Math.cos(d)); player.face += d * Math.min(1, dt * 12);
    }
    player.t += dt * (player.moving ? 1 : 0);
    const gy = floorAt(player.x, player.z);
    player.y = lerp(player.y, gy, Math.min(1, dt * 18));
    // inside a secret passage: fade what we overlap and keep the hero visible through rock
    const inSecret = overrideAt(player.x, player.z) === 3;
    const g = new Set();
    if (inSecret) for (const p of props) { const r = VIS_R[p[0]] * p[4] + .35; if (Math.abs(p[1] - player.x) < r && Math.abs(p[2] - player.z) < r && Math.hypot(p[1] - player.x, p[2] - player.z) < r) g.add(p); }
    if (g.size !== ghosts.size || [...g].some(p => !ghosts.has(p))) { ghosts = g; rebuildProps(true); }
    const buried = inSecret && heightAt(player.x, player.z) > player.y + 1.2;
    if (heroMat.depthTest === buried) {
      // x-ray look while buried in rock, so it reads as "inside the wall", not "on top of it"
      heroMat.depthTest = !buried; hero.renderOrder = buried ? 10 : 0;
      heroMat.opacity = buried ? .62 : 1; heroMat.emissive.setHex(buried ? 0x2a6a90 : 0x000000);
    }
    if (!buried) { const pu = state.onPoison ? .5 + .5 * Math.sin(timeU.value * 7) : 0; heroMat.emissive.setRGB(.38 * pu, .05 * pu, .5 * pu); }
    hero.position.set(player.x, player.y + (player.moving ? Math.abs(Math.sin(player.t * 11)) * .08 : 0), player.z);
    hero.rotation.y = player.face;
    _tgt.set(player.x, player.y + 1, player.z);
    placeCamera(playCam, _tgt);
  }
  sun.target.position.set(0, 0, 0);
}
function hud() {
  const n = props.length;
  $('hud').textContent = state.mode === 'edit'
    ? `編集モード  小物 ${n}  ${fps} fps\nTab: 歩く`
    : `歩くモード  WASD: 移動 / Shift: 走る / Q・E: 視点回転\nホイール: ズーム / Tab: 編集へ` + (state.onPoison ? '\n☠ 毒沼の上（ゲーム側でダメージ）' : '') + (state.onLink ? `\n${state.onLink.kind === 'down' ? '▼' : state.onLink.kind === 'up' ? '▲' : '✦'} ${markerLabel(state.onLink.kind)}${state.onLink.tag ? ' → ' + state.onLink.tag : ''}（ゲームでは階層移動）` : '');
}
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  update(dt);
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++; if (fpsAcc > .5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; hud(); }
  requestAnimationFrame(frame);
}

// ============================================================
// Boot
// ============================================================
let bootPending = null;
try { bootPending = sessionStorage.getItem('me_pending'); sessionStorage.removeItem('me_pending'); } catch (e) { }
if (bootPending === 'sample2' && SIZE === SAMPLE2_SIZE) genSample2(); else if (bootPending === 'flat' || (!bootPending && SIZE !== 64)) genFlat(); else genSample(7);
applyCatalog(); applyBiome(state.biome); applyCliffStyle(); applyPalette(); setTool('plateau'); syncUI(); resize(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); rebuildMarkers(); hud();
if (bootPending && bootPending[0] === '{') { try { deserialize(JSON.parse(bootPending)); toast(`読み込みました（${SIZE} × ${SIZE} m）`); } catch (err) { toast('読み込み失敗: ' + err.message); } }
else if (bootPending === 'flat') toast(`${SIZE} × ${SIZE} m の新規マップ`);
else if (bootPending === 'sample2') toast('サンプル2（遺跡・隠し通路）');
requestAnimationFrame(frame);

// hooks for automated checks
window.__app = {
  SIZE, state, H, S, O, F, C, cliffIndexAt, BIOMES, CLIFF_STYLES, applyCliffStyle, deckAt, linkDeckAt, runValidation, genSample, genSample2, secretRegions, secretLineX, passageGeometry, terrainRes, TERRAIN_RES, snapshot, sha256, LINK_KINDS, normalizeCatalog, catalogExport, valueIssues, areaIssue, deckAt, getColliders, PROP, get colliderMaxR() { return colliderMaxR; }, rebuildMarkers, linkTrigger, linkArrival, LINK_SPEC, get markers() { return markers; }, placeMarker, ensureIds, applyCatalog, ATMOS, WEATHER, applyAtmo, makeCoast, glowLights, applyBiome, applyPalette, propVisible, toolVisible, updateTerrain, rebuildProps, genFlat, floorAt, bridgeAt, stairsAt, placeSlope, placeStairs, placeBridge, pickTarget, regenGroundProps, rebuildBridges, get stairs() { return stairs; }, get bridges() { return bridges; }, get falls() { return falls; }, overrideAt, heroMat, get ghosts() { return ghosts; }, get props() { return props; }, cam, playCam, player, keys, setMode, setTool, update, heightAt, walkable, slope: slopeAt,
  stroke(x, z, frames = 20, opts = {}) {
    hit = new THREE.Vector3(x, heightAt(x, z), z); beginStroke({ shiftKey: !!opts.shift });
    for (let f = 0; f < frames; f++) { if (stroke.active && !['scatter', 'erase'].includes(state.tool)) { applyBrush(x, z, 1 / 60); } }
    stroke.active = false; updateTerrain(); rebuildProps();
  },
  render() { renderer.render(scene, camera); },
  serialize, deserialize, buildExport, makeZip, undo, redo, refreshWaterData, WATERU, get waterInfo() { return waterInfo; }, syncWaterShow,
};
})();
