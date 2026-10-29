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
const propGrounding=TDPropGrounding.createCache(H,N,CELL,HALF);
const NS = 11;                           // append-only paint IDs: bedrock 9, pureblack 10
const effectiveS = new Float32Array(N * N * NS);
const S = new Uint8Array(N * N * NS);    // splat follows GROUND, 0..255
const GROUND = ['dirt', 'cobble', 'sand', 'rubble', 'swamp', 'poison', 'lava', 'snowfield', 'ice', 'bedrock', 'pureblack'];
const GROUND_SPEED = [1, 1, .85, .8, .55, .6, .5, .8, 1, 1, 1];   // walk speed factor per ground type
const O = new Uint8Array(N * N);         // walk override: 0 = auto, 1 = force walkable, 2 = force blocked, 3 = secret passage
const F = new Float32Array(N * N);
const C = new Uint8Array(N * N);         // rock-wall style painted per vertex: 0 = the map's default, k = CLIFF_STYLES[k - 1]       // floor height used inside secret passages (H elsewhere)
const A = new Uint8Array(N * N);         // auto walkability cache (1 = walkable)
let props = [];                           // [type, x, z, rotY, scale, auto, scaleY?, baseY?]
let falls = [];                           // {x, z, rot, w, top, bottom, sx?, sz?}  sx/sz = upstream source
let tunnels = [];                         // tunnels: {id, style, w, h, pts: [{x, z, y}]}  (tunnels.js)
let springs = [];                         // water sources: {id, x, z, preset}  preset = a key of TDSprings.PRESETS (springs.js)
let pools = [];                           // stone-rimmed pools: {id, type: 'rect' | 'round', x1, z1, x2, z2, floor, rim, ox, oz}  (ox, oz) = the overflow notch's direction
const SC = new Float32Array(N * N);       // how deep the springs' streams are carved into H (m): taken back out before they are carved again
let bridges = [];                         // {x1, z1, x2, z2, w, type}
let stairs = [];
let markers = [];                         // game markers: {id, kind, x, z, rot, w, r, tag}                          // {x1, z1, x2, z2, w, type, y1, y2}  (x1,z1) is the bottom
const state = {
  roomId: '', nextId: 1, revision: 0, lastExportHash: '', catalog: { types: {}, floorLinks: {} },
  agent: { radius: .3, height: 1.8, maxSlopeDeg: 51.3, maxWaterDepth: .9, maxStep: .5, arrivalClearance: .5 },   // who the walkability is computed for
  biome: 'forest', palette: 'all', cliffStyle: 'standard', sunOn: true, timeOfDay: 'day', darkness: 'dark', mapName: '', sea: false, weather: { kind: 'none', amount: .7 }, atmo: { kind: 'none', amount: .6, height: 3 },
  variant: { bridge: 'wood', stairs: 'stone', place: 0, marker: 'port', link: 'warp', cliffpaint: 1, spring: 'brook', pool: 'rect', tunnel: 'rock' }, tunnelSize: 'normal', tunnelSlope: 'flat', placeScale: 1, placeRot: 0, placeRandom: true,
  mode: 'edit', tool: 'plateau', radius: 4, strength: .6, density: .6, brushShape: 'circle',
  types: new Set([0, 1]), water: .8, spawn: { x: 0, z: 22 },
};
// how the page is shown (not map data): the left menu, and a page turned 90° on phones whose browser cannot lock the orientation
const view = { panel: true, rotated: false };
const TOUCH = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);   // phones and tablets
const viewW = () => view.rotated ? window.innerHeight : window.innerWidth, viewH = () => view.rotated ? window.innerWidth : window.innerHeight;
const toLocal = (cx, cy) => view.rotated ? [cy, window.innerWidth - cx] : [cx, cy];   // a screen point → the page's own (unturned) point

// ============================================================
// Utilities
// ============================================================
const { clamp, lerp, hash2, rng, col, mixc, mat4, displace, makeGeo, smooth01, twoSided, leafGeo, petalGeo, stripLeafGeo, basisAt, limb, chisel, ribbed, strata, masonC, dropBottom, tierGeo, RUIN_STONE, MOSS, halfDisc, WOOD_C, SANDSTONE, CASTLE_C, ICE_C, BONE_C, DARK_C, blockC, stoneCourses } = TDGeo;   // shared with props/common.js
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { return vnoise(x, y) * .6 + vnoise(x * 2.07 + 5.2, y * 2.07 + 1.3) * .28 + vnoise(x * 4.1 + 9, y * 4.1 + 3) * .12; }
const idx = (i, j) => j * N + i;
const vx = i => i * CELL - HALF;
function heightAt(x, z) {
  const fx = (x + HALF) * RES, fz = (z + HALF) * RES;
  const i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fz), 0, N - 2);
  const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), k = idx(i, j);
  return lerp(lerp(H[k], H[k + 1], u), lerp(H[k + N], H[k + N + 1], u), v);
}
function slopeAt(x, z) { const e = .35; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
function splatAt(x, z, ch) { const i = clamp(Math.round((x + HALF) * RES), 0, N - 1), j = clamp(Math.round((z + HALF) * RES), 0, N - 1); return TDTerrainPaint.weight(S,idx(i,j)*NS,NS,ch); }
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
// 深度範囲に比例して足元の影が離れないよう、補正を光源方向5mmに固定する。
sun.shadow.bias = -.005 / (sun.shadow.camera.far - sun.shadow.camera.near); sun.shadow.normalBias = .005;
scene.add(sun, sun.target);
// without sunlight (caves): how much light the room still gets. dark = only the room's own lights (torches, crystals…)
// and a faint sky; normal / bright add sky light and a soft shadowless light from above so the room reads clearly
// Stable IDs are saved and exported; the clock does not advance by itself.
const TIMES = {
  day: { name: '昼', sun: null, sky: null, ground: null, direct: 1, ambient: 1, position: [-48,62,-14], water: [1,1,1] },
  evening: { name: '夕方', sun: 0xffb56b, sky: 0xafb5dc, ground: 0x75533e, direct: .72, ambient: .70, position: [-68,22,14], water: [.72,.48,.30] },
  night: { name: '夜（満月）', sun: 0xb9d0ff, sky: 0x819fd8, ground: 0x354464, direct: .28, ambient: .32, position: [48,26.6,14], water: [.15,.23,.39] }
};
const timeId = id => Object.hasOwn(TIMES,id) ? id : 'day';
const waterTimeTint = { value: new THREE.Vector3(1,1,1) };
// No extra camera or render target: reuse the directional shadow map.
const moonStrength = { value: 0 };
const moonShadow = { get value() { return sun.shadow.map ? sun.shadow.map.texture : null; } };
const MOON_GLSL = `
  uniform float uMoonStrength;
  uniform sampler2D uMoonShadow;
  uniform mat4 uMoonShadowMatrix;
  uniform vec2 uMoonShadowTexel;
  #include <packing>
  float moonVisibility(vec3 p){
    vec4 sc=uMoonShadowMatrix*vec4(p+vec3(0.,.025,0.),1.);vec3 q=sc.xyz/sc.w;
    if(q.z<=0.||q.z>=1.||any(lessThan(q.xy,vec2(0.)))||any(greaterThan(q.xy,vec2(1.))))return 1.;
    float visibility=0.;
    for(int y=0;y<2;y++)for(int x=0;x<2;x++){
      float d=unpackRGBAToDepth(texture2D(uMoonShadow,q.xy+(vec2(float(x),float(y))-.5)*uMoonShadowTexel));
      visibility+=step(q.z-.0002,d)*.25;
    }
    return visibility;
  }
  float moonNoise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
    float b=fract(sin(dot(i+vec2(1.,0.),vec2(127.1,311.7)))*43758.5453);
    float c=fract(sin(dot(i+vec2(0.,1.),vec2(127.1,311.7)))*43758.5453);
    float d=fract(sin(dot(i+vec2(1.,1.),vec2(127.1,311.7)))*43758.5453);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  vec3 moonReflection(vec3 view,vec3 normal,vec3 light,vec3 position,float phase){
    // The elongated microfacet distribution is tied to the moon azimuth, not screen UV.
    // Small wave slopes break the reflected light into a moving moon road.
    vec3 axis=normalize(vec3(light.x,0.,light.z));
    vec3 side=normalize(cross(normal,axis)),along=normalize(cross(side,normal));
    vec3 halfLight=normalize(view+light);
    float nh=max(dot(halfLight,normal),.15);
    float sx=dot(halfLight,side)/nh,sy=dot(halfLight,along)/nh;
    float road=exp(-sx*sx/.000625-sy*sy/.1156);
    vec3 flatSide=vec3(-axis.z,0.,axis.x);
    vec2 q=vec2(dot(position,flatSide),dot(position,axis));
    float wave=moonNoise(q*vec2(4.,18.)+vec2(phase*.15,-phase*.6))*.7+moonNoise(q*vec2(1.5,3.)+phase*.12)*.3;
    float shimmer=smoothstep(.30,.82,wave);
    float fresnel=.35+.65*pow(1.-max(dot(view,normal),0.),2.);
    return vec3(.72,.84,1.)*road*shimmer*fresnel*.8
      *smoothstep(0.,.12,view.y)*smoothstep(0.,.1,light.y);
  }
`;
const DARK_LEVELS = { dark: { name: '暗い（明かりだけ）', hemi: 1, fill: 0 }, normal: { name: 'ふつう', hemi: 2.2, fill: 1.6 }, bright: { name: '明るい', hemi: 3.5, fill: 3.2 } };
const fill = new THREE.DirectionalLight(0xffffff, 0);
fill.position.set(-12, 60, 18); fill.visible = false; scene.add(fill, fill.target);

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

// Distance to the actual cell border. F2-F1 creates false diagonal bevels inside stones.
const PAVING_GLSL = `
vec4 pavingCell(vec2 p){
  vec2 i=floor(p),f=fract(p),nearest=vec2(0.),cell=vec2(0.);float best=100.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y)),c=i+g,r=g+vec2(h21(c),h21(c+37.7))-f;
    float d=dot(r,r);if(d<best){best=d;nearest=r;cell=c;}
  }
  float border=100.;
  for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
    vec2 g=vec2(float(x),float(y)),c=cell+g;
    vec2 r=c+vec2(h21(c),h21(c+37.7))-p,delta=r-nearest;
    if(dot(delta,delta)>.00001)border=min(border,dot(.5*(nearest+r),normalize(delta)));
  }
  return vec4(border,h21(cell+11.3),cell+vec2(h21(cell),h21(cell+37.7)));
}
`;

// ---------- terrain ----------
const waterU = { value: state.water };
// see-through cut (tunnels): a = (x, y, z) of the one inside a tunnel and the radius (0 = off), b = the camera. What lies
// between them and above the head is not drawn (terrain, rock skin, the tunnel's roof), with a ragged edge
const cutU = { a: { value: new THREE.Vector4(0, 0, 0, 0) }, b: { value: new THREE.Vector3() } };
// Above the head only: over the tunnel itself (onTunnel: the terrain's footprint mask; the tunnel's own mesh is all over it)
// within uCutA.w metres, and a narrow tube along the line of sight from the camera to the head (so ground beside the tunnel
// cannot hide the hero when the camera looks from the side). Ground that is not over the tunnel is cut only in that tube,
// which keeps the black of the hill's (undrawn) inside small.
const CUT_GLSL = `uniform vec4 uCutA; uniform vec3 uCutB;
bool cutAway(vec3 p, bool onTunnel){ if(uCutA.w<=0. || p.y<=uCutA.y+1.7) return false;
  if(onTunnel && length(p.xz-uCutA.xz)<uCutA.w) return true;
  vec3 a=uCutA.xyz+vec3(0.,1.,0.), ab=uCutB-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-4),0.,1.);
  float n=fract(sin(dot(floor(p*6.),vec3(12.9898,78.233,37.719)))*43758.5453);
  return length(p-(a+ab*t))<1.1*(1.+.4*t)-n*.25; }`;
const dimU = { value: 0 };   // fades the scene while the walkability view is on
const DIM_GLSL = 'vec3 dimc(vec3 c){ float l=dot(c,vec3(.3,.59,.11)); return mix(c,vec3(l),.6*uDim)*(1.-.3*uDim); }';
const timeU = { value: 0 };
const rockGrainU={value:null};
const pavingMask=TDPavingMask.createMask(N);
const pavingMaskU={value:pavingMask},pavingMapU={value:new THREE.Vector2(HALF,N)};
// The same grain texture and surface-gradient lighting serve terrain, rocks and masonry.
const STONE_SURFACE_GLSL=`
uniform sampler2D uStoneGrain;
vec2 stoneGrain(vec3 wp,vec3 wn){
  vec3 w=pow(abs(wn),vec3(4.));w/=max(.00001,w.x+w.y+w.z);
  vec3 a=wp*.42,b=wp*1.7+.37;
  float broad=dot(vec3(texture2D(uStoneGrain,a.yz).r,texture2D(uStoneGrain,a.xz).r,texture2D(uStoneGrain,a.xy).r),w);
  float fine=dot(vec3(texture2D(uStoneGrain,b.yz).r,texture2D(uStoneGrain,b.xz).r,texture2D(uStoneGrain,b.xy).r),w);
  return vec2(broad,fine);
}
vec3 surfaceNormal(vec3 viewPosition,vec3 n,float h){
  vec3 a=dFdx(viewPosition),b=dFdy(viewPosition),r0=cross(b,n),r1=cross(n,a);float det=dot(a,r0);
  if(abs(det)<1e-9)return n;
  vec3 grad=(dFdx(h)*r0+dFdy(h)*r1)/det;
  // Limit grazing-angle and silhouette derivatives; small pits must not flip the normal.
  grad*=min(1.,.30/max(.00001,length(grad)));
  return normalize(n-grad);
}
`;
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
  if(typeof cliffRelief!=='undefined')scheduleCliffRelief();
}
// Shared grass (4 m) and soil (2 m); mipmapped raw sRGB enters the existing single terrain decode.
const groundTexture = TDGround.texture;
TDBedrock.texture.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy());
groundTexture.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy());
const groundTrial = { value: 0 };
TDGround.rootPaint={texture:pavingMask,params:new THREE.Vector4(HALF,HALF,N,1)};
const LAVA_SURFACE_GLSL=`vec4 lavaSurface(vec2 p,float time){
 vec2 flow=vec2(time*.028,-time*.011);
 vec2 q=p+flow+vec2(fbm(p*.48+flow),fbm(p*.48+flow+21.))*.95;
 float field=fbm(q*1.35+vec2(fbm(q*3.),fbm(q*3.+9.))*.42);
 float vein=abs(field-.49),seam=1.-smoothstep(.025,.115,vein);
 float core=1.-smoothstep(.012,.045,vein);
 float pools=smoothstep(.64,.78,fbm(q*.32+41.));
 float heat=max(seam,pools),rough=fbm(p*8.5);
 vec3 crust=mix(vec3(.055,.045,.043),vec3(.19,.16,.14),rough)*(.8+.3*vn(p*37.));
 vec3 hot=mix(vec3(.58,.055,.008),vec3(1.,.32,.025),heat);
 hot=mix(hot,vec3(1.,.67,.14),max(core,pools*.7)*(.82+.18*fbm(q*6.-flow)));
 vec3 surface=mix(crust,hot,smoothstep(.08,.58,heat));
 return vec4(surface,heat);
}`;
const terrainMat = new THREE.MeshStandardMaterial({ roughness: .92, metalness: 0 });
terrainMat.onBeforeCompile = function(sh) {
  const useBedrock=!!this.defines?.BEDROCK_FLOOR;
  // Keep custom uniforms stable when Three reuses a cached shader variant.
  Object.assign(sh.uniforms, TDGround.uniforms, TDBedrock.uniforms); sh.uniforms.uGroundTrial = groundTrial;
  sh.uniforms.uCutA = cutU.a; sh.uniforms.uCutB = cutU.b; sh.uniforms.uTunHoles = tunnelHoleU; sh.uniforms.uTunOn = tunnelOnU;
  sh.uniforms.uWater = waterU; sh.uniforms.uDim = dimU; sh.uniforms.uTime = timeU; sh.uniforms.uStoneGrain=rockGrainU; sh.uniforms.uPavingMask=pavingMaskU; sh.uniforms.uPavingMap=pavingMapU; Object.assign(sh.uniforms, BU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float reliefSlope; varying float vReliefSlope; attribute float springLift; varying float vSpringHw; attribute vec4 splatA; attribute vec4 splatB; attribute vec3 splatC; attribute vec3 cliffT; attribute vec4 cliffM; attribute vec2 cliffW; varying vec3 vCT; varying vec4 vCM; varying vec2 vCW; varying vec4 vSA; varying vec4 vSB; varying vec3 vSC; varying vec3 vWPos; varying vec3 vWNor;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvReliefSlope=reliefSlope; vSpringHw=10.-springLift; vSA=splatA; vSB=splatB; vSC=splatC; vCT=cliffT; vCM=cliffM; vCW=cliffW; vWPos=(modelMatrix*vec4(position,1.)).xyz; vWNor=normalize(mat3(modelMatrix)*normal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying float vReliefSlope; varying float vSpringHw; varying vec4 vSA; varying vec4 vSB; varying vec3 vSC; varying vec3 vWPos; varying vec3 vWNor; uniform float uWater; uniform float uDim; uniform float uTime;
uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uGH; uniform vec3 uRockTint; uniform float uFlowers; uniform float uSnow; uniform float uSnowLine; uniform float uWet; uniform float uSea;
varying vec3 vCT; varying vec4 vCM; varying vec2 vCW; uniform int uPitN; uniform vec4 uPitA[8]; uniform vec4 uPitB[8];
uniform sampler2D uTunHoles; uniform float uTunOn;
${CUT_GLSL}
${TDGround.GLSL}
${useBedrock?TDBedrock.GLSL:''}
uniform float uGroundTrial;
float gIce=0.; float gIceRough=.2; float gIceHeight=0.; float gGloss=0.; float gSurfaceHeight=0.; float gPureBlack=0.; vec3 gGlow=vec3(0.);
${GLSL_NOISE}
${LAVA_SURFACE_GLSL}
${PAVING_GLSL}
${STONE_SURFACE_GLSL}
uniform sampler2D uPavingMask;uniform vec2 uPavingMap;
vec2 pavingPaint(vec2 world){
  vec2 uv=clamp((world+uPavingMap.x)/(2.*uPavingMap.x),0.,1.);
  return texture2D(uPavingMask,uv*(1.-1./uPavingMap.y)+.5/uPavingMap.y).rg;
}
${DIM_GLSL}
vec3 terrainColor(){
  vec3 wp=vWPos; vec3 n=normalize(vWNor); vec2 p=wp.xz;
  float slope=vReliefSlope;
  float a=fbm(p*.22), b=fbm(p*1.6+5.), c=vn(p*11.);
  float paintTotal=dot(vSA,vec4(1.))+dot(vSB,vec4(1.))+vSC.x+vSC.y;
  float baseWeight=max(0.,1.-paintTotal),paintNorm=max(1.,paintTotal);
  // grass
  vec3 grass=mix(uG0, uG1, clamp(a*1.2+b*.7-.5,0.,1.));
  grass=mix(grass, uGH, smoothstep(.62,.95,b)*.35);
  grass*=.86+.28*c;
  // Preserve broad colour variation without repeating the tiny hard-edged flower dots.
  if(uGroundTrial>0.) grass=sharedGrass(p);
  vec2 fc=floor(p*4.5), fg=fract(p*4.5)-.5;
  float fl=step(.968,h21(fc+3.1))*step(length(fg-(vec2(h21(fc),h21(fc+9.))-.5)*.5),.1);
  vec3 fcol=h21(fc+7.7)<.55?vec3(.97,.95,.86):vec3(.98,.82,.22);
  // dirt
  vec3 dirt=mix(vec3(.36,.25,.14), vec3(.66,.52,.33), clamp(b*1.25+c*.35-.2,0.,1.));
  if(uGroundTrial>0.) dirt=sharedDirt(p);
  // Resolve coverage at each stone centre, not each fragment: whole stones disappear into the grass.
  vec2 warp=vec2(fbm(p*.6),fbm(p*.6+11.))*.16,paint=pavingPaint(p);
  vec4 cv=vec4(.2,.5,p*2.2+warp);float centrePaint=0.;
  if(paint.g>.005){cv=pavingCell(p*2.2+warp);centrePaint=pavingPaint((cv.zw-warp)/2.2).r;}
  float gap=cv.x*2.,aa=max(.002,fwidth(gap));
  float ce=smoothstep(.026-aa,.026+aa,gap),bevel=smoothstep(.02,.14,gap);
  float cobbleEdge=smoothstep(.27,.33,centrePaint+(cv.y-.5)*.26);
  vec3 stone=mix(vec3(.48,.46,.40),vec3(.67,.64,.56),cv.y)*(.96+.08*c)*(.88+.12*bevel);
  float buried=smoothstep(.55,.84,fbm(p*3.1)+a*.18)*(1.-smoothstep(.48,.88,centrePaint));
  stone=mix(stone,grass*.88,buried*.40*baseWeight);
  vec3 joint=mix(dirt*.90,grass*.84,smoothstep(.45,.73,fbm(p*2.7)+a*.16)*(1.-centrePaint*.65)*baseWeight);
  vec3 cob=mix(joint,stone,ce);
  float dirtW=vSA.x;
  vec3 col=grass*baseWeight+dirt*vSA.x+cob*vSA.y;
  gSurfaceHeight=bevel*(.010+cv.y*.012)*cobbleEdge*vSA.y/paintNorm;
  if(uGroundTrial>0.)gSurfaceHeight+=(baseWeight*(dot(grass,vec3(.2126,.7152,.0722))-.35)*.018+vSA.x*groundSoilRelief(p))/paintNorm;
  col=mix(col,fcol,uFlowers*fl*(1.-uGroundTrial)*step(slope,.12)*baseWeight);
  // sand: wind ripples
  float sdw=vSA.z;
  if(sdw>0.){
    float rip=sin((p.x*.8+p.y*.55)*7.+fbm(p*.45)*7.)*.5+.5;
    vec3 sd=mix(vec3(.76,.66,.46),vec3(.90,.81,.60),clamp(b*.9+c*.3,0.,1.))*(.9+.12*rip);
    col+=sd*sdw;
  }
  // Dryland: dusty clay plates, narrow warped shrinkage cracks and buried mineral grit.
  float rbw=vSA.w;
  if(rbw>0.){
    vec2 rp=p+vec2(fbm(p*1.3),fbm(p*1.3+17.))*.30+vec2(vn(p*13.),vn(p*13.+29.))*.028;
    vec4 plate=pavingCell(rp*2.65);
    float edge=plate.x*2.,width=.022+.024*vn(p*3.7+8.);
    float aa=max(.004,fwidth(edge));
    float crack=1.-smoothstep(width-aa,width+aa,edge);
    float rim=smoothstep(width,width+.025,edge)*(1.-smoothstep(width+.025,width+.10,edge));
    vec3 hair=vor(rp*6.8+41.);
    float fine=(1.-smoothstep(.010,.030+fwidth(hair.y-hair.x),hair.y-hair.x))*smoothstep(.55,.76,fbm(p*1.9+71.))*(1.-crack);
    float dust=fbm(p*.43+3.),grain=vn(rp*54.);
    vec3 dry=mix(vec3(.49,.415,.305),vec3(.69,.605,.465),dust*.65+plate.y*.35);
    dry*=.96+.08*grain;dry+=rim*.035;
    dry=mix(dry,vec3(.225,.174,.115),crack*.80);
    dry=mix(dry,dry*.66,fine*.55);
    vec2 cell=floor(rp*9.),local=fract(rp*9.)-.5;
    float seed=h21(cell+2.7),angle=seed*6.283;
    local=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*local;
    float shape=max(abs(local.x)*.85+abs(local.y)*1.25,max(local.x*.8-local.y*.4,-local.x*.7+local.y*.65));
    float size=.06+.12*h21(cell+31.),chipAA=max(fwidth(shape),.015);
    float chip=(1.-smoothstep(size-chipAA,size+chipAA,shape))*step(.66,seed)*(1.-crack);
    vec3 mineral=mix(vec3(.46,.40,.32),vec3(.65,.59,.48),h21(cell+9.));
    col+=mix(dry,mineral,chip*.45)*rbw;
    gSurfaceHeight+=rbw*(rim*.0008-crack*.0015+chip*.001+(grain-.5)*.0004);
  }
  // swamp: mud, moss and murky puddles with rising bubbles
  float swW=vSB.x;
  if(swW>0.){
    vec3 mud=mix(vec3(.17,.15,.09),vec3(.31,.28,.15),b);
    mud=mix(mud,vec3(.24,.32,.11),smoothstep(.45,.75,a+c*.2)*.7);
    float pud=smoothstep(.5,.58,fbm(p*.55+3.7)+(c-.5)*.08);
    vec3 murk=vec3(.10,.14,.08)+.04*vec3(sin(uTime*.6+p.x),sin(uTime*.5+p.y),0.);
    vec2 bc=floor(p*1.8), bf=fract(p*1.8)-.5; float tt=fract(uTime*.3+h21(bc));
    float ring=smoothstep(.03,.0,abs(length(bf-(vec2(h21(bc+1.),h21(bc+2.))-.5)*.5)-tt*.3))*(1.-tt)*pud;
    col+=(mix(mud,murk,pud)+ring*.18)*swW;
    gGloss=max(gGloss,pud*swW);
  }
  // poison swamp: purple sludge with glowing, bubbling pools
  float poW=vSB.y;
  if(poW>0.){
    vec3 sludge=mix(vec3(.16,.09,.19),vec3(.31,.15,.34),b);
    float pud=smoothstep(.46,.56,fbm(p*.65+9.1)+(c-.5)*.08);
    vec3 goo=mix(vec3(.42,.80,.22),vec3(.50,.30,.62),.5+.5*sin(uTime*.5+fbm(p*1.1)*5.));
    vec2 bc=floor(p*1.6), bf=fract(p*1.6)-.5; float tt=fract(uTime*.4+h21(bc+5.));
    float ring=step(.62,h21(bc+8.))*smoothstep(.03,.0,abs(length(bf-(vec2(h21(bc+3.),h21(bc+4.))-.5)*.5)-tt*.28))*(1.-tt)*pud;
    col+=(mix(sludge,goo*.42,pud)+ring*goo*.45)*poW;
    gGlow+=goo*(pud*.1+ring*.6)*poW;
    gGloss=max(gGloss,pud*poW);
  }
  // Lava: irregular cooling crust and flowing molten channels.
  float lvW=vSB.z;
  if(lvW>0.){
    vec4 lava=lavaSurface(p,uTime);
    col+=lava.rgb*lvW;
    gGlow+=lava.rgb*lava.a*lvW*.85;
    gGloss=max(gGloss,lava.a*lvW*.30);
  }
  // snow field: soft white with sparkles
  float snG=vSB.w;
  if(snG>0.){
    vec3 sn=mix(vec3(.80,.85,.93),vec3(.97,.98,1.),b)*(.94+.08*c);
    sn+=step(.985,h21(floor(p*9.)))*.25;
    col+=sn*snG;
  }
  // Solid ice: buried fractures shift with the view; frost stays on the surface.
  float icW=vSC.x;
  if(icW>0.){
    vec3 viewIce=normalize(cameraPosition-wp);
    vec2 below=p-viewIce.xz/max(abs(viewIce.y),.3)*.16;
    vec2 warpIce=vec2(fbm(below*.65),fbm(below*.65+29.))*.46;
    vec3 fracture=vor((below+warpIce)*.42);
    float edge=fracture.y-fracture.x,aaIce=max(fwidth(edge),.002);
    float mainCrack=(1.-smoothstep(.012-aaIce,.012+aaIce,edge))*smoothstep(.31,.54,fbm(below*.23+9.));
    vec3 fineIce=vor((below+warpIce)*1.45+7.);
    float fe=fineIce.y-fineIce.x;
    float hairIce=(1.-smoothstep(.006,.016+fwidth(fe),fe))*smoothstep(.57,.73,fbm(below*.8+23.));
    float cloud=fbm(p*.8+vec2(fbm(p*.21),fbm(p*.21+8.))*2.);
    float frost=smoothstep(.49,.76,cloud)*.8;
    float depth=fbm(below*.31+17.);
    vec3 ic=mix(vec3(.12,.29,.37),vec3(.34,.57,.64),depth);
    ic=mix(ic,vec3(.69,.82,.85),frost);
    // A dark shoulder beside the bright seam suggests depth, not paving grout.
    float shoulder=(1.-smoothstep(.018,.085,edge))*(1.-mainCrack)*smoothstep(.31,.54,fbm(below*.23+9.));
    ic*=1.-shoulder*.10;
    ic=mix(ic,vec3(.79,.91,.94),max(mainCrack*.8,hairIce*.45));
    vec2 bubbleCell=floor(below*8.),bubbleUV=fract(below*8.)-.5;
    float bubble=(1.-smoothstep(.025,.065+fwidth(bubbleUV.x),length(bubbleUV)))*step(.965,h21(bubbleCell))*smoothstep(.35,.66,cloud);
    ic=mix(ic,vec3(.73,.85,.88),bubble*.35);
    col+=ic*icW;
    gIce=icW/paintNorm;gIceRough=mix(.14,.43,frost);
    gIceHeight=(fbm(p*2.1)-.5)*.0015;
  }
${useBedrock?`  // Manually painted continuous bedrock: packed colour and millimetre relief, no geometry.
  if(vSC.y>0.){
    vec4 bed=bedrockSurface(p);
    col+=bed.rgb*(.90+.20*a)*vSC.y;
    gSurfaceHeight+=(bed.a-.5)*.018*vSC.y;
  }
`:''}
  col/=paintNorm;gGlow/=paintNorm;
  // beach sand (ground painted with sand keeps its own sand, so the beach has one colour)
  float hw=wp.y-uWater;
  float sandW=smoothstep(.42,.08,hw+(a-.5)*.3)*(1.-smoothstep(.3,.5,slope))*(1.-clamp(sdw,0.,1.));
  col=mix(col, mix(vec3(.60,.52,.36),vec3(.76,.68,.50),b), sandW);
  // rock (cliffs)
  vec2 rq=vec2((wp.x*.75+wp.z*.65)*1.1, wp.y*1.5);
  // Geological grain and irregular strata, not the floor's polygonal paving pattern.
  float mineral=fbm(rq*2.7+vec2(3.,7.));
  float strata=fbm(vec2(wp.y*2.2+fbm(rq*.35)*1.6,dot(rq,vec2(.4,.3))));
  vec3 rock=mix(vec3(.43,.41,.36),vec3(.65,.62,.55),mineral);
  vec2 rockGrain=vec2(.5);
  if(slope>.03)rockGrain=stoneGrain(wp,n);
  rock*=(.83+.20*strata)*(.80+.30*rockGrain.x+.10*rockGrain.y)*uRockTint*vCT;
  rock=mix(rock, vCM.rgb, clamp(smoothstep(.55,.85,fbm(rq*.7+3.))*smoothstep(.75,.45,slope)*.7*vCM.a,0.,1.));
  rock*=1.-.35*vCW.x;
  rock=mix(rock, vec3(.93,.95,1.), vCW.y*smoothstep(.3,.7,n.y+(fbm(rq*1.7)-.5)*.5));
  float rockW=smoothstep(.18,.48,slope+(a-.5)*.30);
  gPureBlack=clamp(vSC.z,0.,1.)*(1.-rockW);
  col=mix(col,rock,rockW);
  gGloss=max(gGloss,vCW.x*.8*rockW);
  // underwater bed
  float dpt=max(uWater-wp.y,-vSpringHw);   // under the map's water, or a spring's stream or pond
  if(dpt>0.){
    float bedNoise=fbm(p*2.6+13.),sandGrain=vn(p*42.);
    float ripple=sin(p.x*8.+p.y*3.+fbm(p*.7)*5.);
    vec3 bed=mix(vec3(.49,.45,.35),vec3(.70,.64,.49),bedNoise)*(.91+.18*sandGrain+.025*ripple);
    bed=mix(bed,col,max(rockW*.6,max(sandW,clamp(sdw,0.,1.))*.7));   // the beach's sand runs on under the water
    col=mix(col,bed,smoothstep(0.,.6,dpt));
  }
  // snow cover on flat ground above the snow line
  float snW=(1.-clamp(vSC.x,0.,1.))*uSnow*smoothstep(uSnowLine-.4,uSnowLine+.6,wp.y+(a-.5)*1.2)*(1.-smoothstep(.32,.62,slope))*step(0.,hw);
  col=mix(col, mix(vec3(.80,.86,.95),vec3(.97,.98,1.),b)*(.93+.1*c), snW);
  // wet sand at the water's edge (up to the run-up's reach at the sea), going on darkening under the water: no step at the still level
  col*=mix(1.,.74,smoothstep(mix(.18,.5,uSea),-.04,hw+(a-.5)*.08));
  col*=mix(1.,.78,smoothstep(.14,-.03,vSpringHw+(a-.5)*.06));   // the banks of the springs' water: damp
  col*=1.-.3*uWet*(1.-snW);
  gGloss=max(gGloss,uWet*.6*(1.-snW));
  float otherPaint=max(vSA.z,max(vSB.x,max(vSB.y,max(vSB.z,max(vSB.w,vSC.x)))));
  gSurfaceHeight=(gSurfaceHeight*(1.-rockW)+(rockGrain.x-.5)*.012*rockW+(rockGrain.y-.5)*.006*rockW)*(1.-snW)*(1.-smoothstep(.1,.5,otherPaint));
  gIce*=1.-rockW;
  gSurfaceHeight+=gIceHeight*gIce;
  return pow(col,vec3(2.2));
}`)
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for(int i=0;i<8;i++){ if(i>=uPitN) break; vec2 d=vWPos.xz-uPitA[i].xy; float lx=d.x*uPitA[i].z-d.y*uPitA[i].w, lz=d.x*uPitA[i].w+d.y*uPitA[i].z-uPitB[i].z; if(abs(lx)<uPitB[i].x && abs(lz)<uPitB[i].y) discard; }
// tunnels: their mouths and cuttings are holes in the ground (one texel per 0.5 m cell), and the roof over the one inside is cut away
vec4 tunCell=vec4(0.);
if(uTunOn>.5) tunCell=texture2D(uTunHoles,(floor((vWPos.xz+${HALF.toFixed(1)})*${RES}.)+.5)/${N - 1}.);
#ifndef TUNNEL_CAP
if(tunCell.r>.5) discard;
#endif
if(cutAway(vWPos,tunCell.g>.5)) discard;`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=dimc(terrainColor());')
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Shallow stone bevels affect lighting only; the walking floor is unchanged.
normal=surfaceNormal(-vViewPosition,normal,gSurfaceHeight);`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(roughnessFactor,.55,gGloss),gIceRough,gIce);')
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_HEMI_LIGHTS > 0
vec3 iceSky=getHemisphereLightIrradiance(hemisphereLights[0],normal);
float iceFresnel=.025+.18*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),5.);
reflectedLight.indirectSpecular+=iceSky*iceFresnel*gIce*(1.-gIceRough);
#endif
`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=pow(gGlow,vec3(2.2))*(1.-.6*uDim);');
  // Apply opaque black after lighting, fog, tone mapping, colour conversion and dithering.
  // Mixed brush edges retain coverage; cliff colour/relief still follows the existing slope.
  sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>',
    '#include <dithering_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(0.),gPureBlack);');
  // With no bedrock paint, retain the previous sampler budget.
  if(!useBedrock){
    sh.vertexShader=sh.vertexShader.replace('varying vec3 vSC;','varying vec2 vSC;').replace('vSC=splatC;','vSC=splatC.xz;');
    sh.fragmentShader=sh.fragmentShader.replace('varying vec3 vSC;','varying vec2 vSC;').replace('+vSC.x+vSC.y;','+vSC.x;').replaceAll('vSC.z','vSC.y');
  }
};
terrainMat.customProgramCacheKey = function(){return 'terrain-ice-v1-black1'+(this.defines?.BEDROCK_FLOOR?'-bedrock':'');};

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
  tGeo.setAttribute('reliefSlope', new THREE.BufferAttribute(new Float32Array(N * N), 1));
  tGeo.setAttribute('springLift', new THREE.BufferAttribute(new Float32Array(N * N), 1));   // 10 - height above a spring's stream or pond (m): 0 = none near (also what a mesh without it reads)
  tGeo.setAttribute('splatA', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('splatB', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('splatC', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
  tGeo.setAttribute('cliffT', new THREE.BufferAttribute(new Float32Array(N * N * 3).fill(1), 3));
  tGeo.setAttribute('cliffM', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
  tGeo.setAttribute('cliffW', new THREE.BufferAttribute(new Float32Array(N * N * 2), 2));
  tGeo.setIndex(gridIndex());
}
const terrain = new THREE.Mesh(tGeo, terrainMat);
terrain.castShadow = terrain.receiveShadow = true;
scene.add(terrain);

// Rebuild the derived rock skin after a brush stroke, never the editable H grid.
const reliefMat=terrainMat.clone();reliefMat.onBeforeCompile=terrainMat.onBeforeCompile;
reliefMat.customProgramCacheKey=function(){return terrainMat.customProgramCacheKey.call(this)+'-skin';};
reliefMat.polygonOffset=true;reliefMat.polygonOffsetFactor=-1;reliefMat.polygonOffsetUnits=-1;
const cliffRelief=new THREE.Mesh(new THREE.BufferGeometry(),reliefMat);
cliffRelief.name='Derived cliff relief';cliffRelief.castShadow=cliffRelief.receiveShadow=true;scene.add(cliffRelief);
// Prepare only on explicit bedrock use. Keep the visible scene on ready materials
// while driver compilation runs; paint and undo data remain authoritative.
let bedrockPainted=false,bedrockPrepared=false,bedrockPreparation=null;
const bedrockWarmMaterials=[];
function setBedrockVariant(enabled){
 for(const material of [terrainMat,reliefMat])if(enabled!==!!material.defines?.BEDROCK_FLOOR){const defines={...material.defines};if(enabled)defines.BEDROCK_FLOOR=1;else delete defines.BEDROCK_FLOOR;material.defines=defines;material.needsUpdate=true;}
}
function bedrockHint(){if(state.tool==='bedrock')$('hint').textContent=bedrockPreparation&&!bedrockPrepared?'岩盤を準備中です。塗装操作は保持されます。':TOOLS.find(t=>t.id==='bedrock').hint;}
function bedrockReady(){
 if(bedrockPrepared)return Promise.resolve();
 if(bedrockPreparation)return bedrockPreparation;
 bedrockPreparation=(async()=>{
  await new Promise(r=>setTimeout(r,0));
  const probe=new THREE.Group();
  for(const mesh of [terrain,cliffRelief]){
   const copy=mesh.clone(false),material=mesh.material.clone();
   material.onBeforeCompile=mesh.material.onBeforeCompile;material.customProgramCacheKey=mesh.material.customProgramCacheKey;
   material.defines={...mesh.material.defines,BEDROCK_FLOOR:1};copy.material=material;probe.add(copy);bedrockWarmMaterials.push(material);
  }
  try{
   await renderer.compileAsync(probe,camera,scene);
   const image=TDBedrock.texture.image;if(image?.decode)await image.decode();
   renderer.initTexture(TDBedrock.texture);
   bedrockPrepared=true;setBedrockVariant(bedrockPainted);bedrockHint();if(bedrockPainted&&!mapPreparation)toast('岩盤の準備が完了しました');
  }catch(error){
   for(const material of bedrockWarmMaterials.splice(0))material.dispose();
   bedrockPreparation=null;bedrockHint();toast('岩盤の準備に失敗しました。再度選択してください');throw error;
  }finally{probe.clear();}
 })();
 bedrockHint();if(!mapPreparation)toast('岩盤を準備中です。塗装操作は保持されます');return bedrockPreparation;
}
let cliffReliefTimer=0;
function rebuildCliffRelief(){
  clearTimeout(cliffReliefTimer);cliffReliefTimer=0;
  // Reconstruct only steep cells and their shoulder ring; never change editable H.
  const oldSurface=terrain.geometry;
  const visual=TDCliffShoulder.build(tGeo,N,CELL,{mask:shoulderMask()});
  terrain.geometry=visual;if(oldSurface!==tGeo)oldSurface.dispose();
  const geometry=TDCliffRelief.build(visual,heightAt,HALF,fallReliefMask);cliffRelief.geometry.dispose();cliffRelief.geometry=geometry;
  cliffRelief.visible=geometry.index.count>0;
}
// Suppress height interpolation near links, water, the rim and fitted rocks.
function shoulderMask(){
 const memo=new Map(),rocks=new SpatialHash(4);
 for(const p of props)if(cliffFits?.valid(p))rocks.add(p,p[1],p[2]);
 return(x,z)=>{const key=Math.round(x*32)+','+Math.round(z*32);if(memo.has(key))return memo.get(key);let m=1;
  m*=sstep(0,.5,HALF-Math.max(Math.abs(x),Math.abs(z)));
  m*=sstep(.12,.45,Math.abs(heightAt(x,z)-state.water));
  const keep=(distance,radius)=>{m=Math.min(m,sstep(radius,radius+.4,distance));};
  for(const b of bridges)keep(distToPolyline(x,z,[[b.x1,b.z1],[b.x2,b.z2]]),b.w/2+.4);
  for(const st of stairs)keep(distToPolyline(x,z,[[st.x1,st.z1],[st.x2,st.z2]]),st.w/2+.4);
  if(tunnelPrep.length)keep(tunnelBandDist(x,z),0);
  for(const f of fallBands()){const[ux,uz]=fallDir(f),lat=Math.abs((x-f.x)*uz-(z-f.z)*ux),along=Math.abs((x-f.x)*ux+(z-f.z)*uz);if(along<2)keep(lat,f.w/2+.4);}
  for(const q of markers)if(q.kind==='port'||isLink(q.kind))keep(Math.hypot(x-q.x,z-q.z),Math.max(q.r||0,(q.w||2)/2)+.5);
  rocks.query(x,z,4,p=>keep(Math.hypot(x-p[1],z-p[2]),Math.max(1.5,PROP[p[0]].r||0)*p[4]+.6));
  memo.set(key,m);return m;};
}
function scheduleCliffRelief(){clearTimeout(cliffReliefTimer);cliffRelief.visible=false;cliffReliefTimer=setTimeout(rebuildCliffRelief,100);}


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
  uSprings: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uSpringCount: { value: 0 },   // springs that well up into water: x, z, size, phase
};
let waterTimer = 0, waterInfo = null;
function refreshWaterData() {
  waterTimer = 0;
  const res = TDWater.analyze({ TN: N, TS: CELL, HALF, TH: H, level: state.water, falls: falls.map(f => ({ id: f.id, x: f.x, z: f.z, w: f.w })), sea: seaMaskFor(N, CELL) });
  const pk = TDWater.pack(res);
  WFLOW.set(pk.flow); WMASK.set(pk.mask);
  if (tunnels.length) rebuildTunnels();   // the ground changed: the mouths, cuttings and roofs follow it
  solveSprings(); if (springRes) TDSprings.packInto(springRes, WFLOW, WMASK, res.options);   // the springs' streams and ponds flow in the same images WATERU.uFlow.value.needsUpdate = true; WATERU.uMask.value.needsUpdate = true;
  WATERU.uFlowMax.value = res.options.maxSpeed; WATERU.uBankRange.value = res.options.bankRange; WATERU.uTrailMax.value = res.options.trailMaxCover;
  let n = 0;
  for (let i = 0; i < falls.length && n < 8; i++) {
    const rf = res.falls[i]; if (!rf || rf.dry) continue; const f = falls[i];
    WATERU.uFalls.value[n++].set(rf.cx, rf.cz, (Math.abs(Math.sin(f.x * 12.9898 + f.z * 78.233)) * 43758.5453) % 1, f.w);
  }
  // the springs' falls ring their plunge pools too (the ring code is shared by the springs' water)
  if (springRes) for (const f of springRes.falls) { if (n >= 8) break; if (f.top - f.bottom < .6) continue; WATERU.uFalls.value[n++].set(f.foot[0], f.foot[1], (Math.abs(Math.sin(f.foot[0] * 12.9898 + f.foot[1] * 78.233)) * 43758.5453) % 1, Math.max(f.width * 1.1, .6)); }
  WATERU.uFallCount.value = n; waterInfo = res; showWaterInfo();
}
// the open sea on a TN×TN grid with spacing TS (1 = sea), from the shore field; water.js leaves it out when it sets the river's speed
function seaMaskFor(TN, TS) {
  if (!BU.uSea.value) return undefined;
  const sh = wGeo.attributes.shore.array, m = new Uint8Array(TN * TN), at = v => clamp(Math.round(v * TS * RES), 0, N - 1);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) m[j * TN + i] = sh[(at(j) * N + at(i)) * 4 + 3] > .5 ? 1 : 0;
  return m;
}
function scheduleWater() { clearTimeout(waterTimer); waterTimer = setTimeout(refreshWaterData, 350); }
function showWaterInfo() {
  const el = typeof document !== 'undefined' && document.getElementById('waterInfo'); if (!el || !waterInfo) return;
  const r = waterInfo, s = r.stats, lines = [];
  if (!r.wetCount) { lines.push('水位より低い所がありません（水は出ません）'); springInfo(lines); }
  else {
    lines.push(`水の所 ${(s.wetFraction * 100).toFixed(1)}%、最大の水深 ${s.maxDepth.toFixed(1)}m` + (r.hasFlow ? `、流れ 速さの上位5% ${s.speedP95.toFixed(2)}m/s` : '、流れなし'));
    lines.push(`滝 ${r.falls.length}個（着水できる ${r.falls.filter(f => !f.dry).length}個）、地図の端から端へ流れる川 ${(r.inflows || []).length}本`);
    for (const w of r.warnings) lines.push('⚠ ' + w);
    springInfo(lines);
    if (BIOME().lava) lines.push('溶岩: Unity の水は未対応（書き出しは waterSim.available=false）');
    else if (state.sea) lines.push('海: Unity の水は未対応（書き出しは waterSim.available=false）');
  }
  el.textContent = lines.join('\n');
}
function springInfo(lines) {
  const s = springRes; if (!s) return;
  const END = { edge: '地図の端へ', water: '水へ流れ込む', dry: '地面に浸み込んで消える', pool: 'プールの中', full: '満ちて止まる', loop: '合流', open: '流れ中' };
  if (s.springs.length) lines.push(`水源 ${s.springs.length}個：小川 ${s.streams.length}本、池 ${s.ponds.length}個、滝 ${s.falls.length}か所（` + s.springs.map(q => `${TDSprings.PRESETS[q.preset].name}→${END[q.end] || q.end}`).join('、') + '）');
  if (s.pools.length) lines.push(`プール ${s.pools.length}個`);
  for (const w of s.warnings) lines.push('⚠ ' + w);
}
// ---------- sea: the surf's shader code is in sea.js (shared with Unity) ----------
const wGeo = new THREE.BufferGeometry();
wGeo.setAttribute('position', new THREE.BufferAttribute(tGeo.attributes.position.array.map((v, k) => k % 3 === 1 ? 0 : v), 3));
wGeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(N * N), 1));
// sea waves need, per vertex: s = signed distance to the still waterline (m; + in the water, - on land), the direction to
// the shore (unit, xz) and how much of the sea this is (water joined to the map edge, and the beach next to it: 1;
// inland lakes and their banks: 0, so they stay calm)
wGeo.setAttribute('shore', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));
// and two more: o = where the crests run (m, from the coast smoothed over about a wavelength with river mouths closed,
// minus s: waves refract on the large-scale bed, not on every inlet) and j = the river's outflow jet in front of a mouth (0..1)
wGeo.setAttribute('shore2', new THREE.BufferAttribute(new Float32Array(N * N * 2), 2));
wGeo.setIndex(gridIndex());
let shoreFieldOn = false;
const SEA_OPEN = 4, SEA_MOUTH = 6, SEA_JET = 8, SEA_LAG = 3;   // m: open sea is at least this far from land (narrower water joined to it is a river); a river's mouth blends over this; its jet is half as strong this far out; crests lag this much against it
function computeShoreField() {
  const sh = wGeo.attributes.shore.array, NN = N * N;
  const sh2 = wGeo.attributes.shore2.array;
  if (!BU.uSea.value) { if (shoreFieldOn) { sh.fill(0); sh2.fill(0); wGeo.attributes.shore.needsUpdate = wGeo.attributes.shore2.needsUpdate = true; shoreFieldOn = false; } return; }
  shoreFieldOn = true;
  const W = state.water, wet = new Uint8Array(NN), INF = 1e9, R2 = Math.SQRT2;
  for (let k = 0; k < NN; k++) wet[k] = H[k] < W ? 1 : 0;
  // two-pass chamfer distance (cells) to the nearest cell where from(k) holds
  const cham = from => {
    const d = new Float32Array(NN); for (let k = 0; k < NN; k++) d[k] = from(k) ? 0 : INF;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i; let v = d[k]; if (!v) continue;
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) { v = Math.min(v, d[k - N] + 1); if (i > 0) v = Math.min(v, d[k - N - 1] + R2); if (i < N - 1) v = Math.min(v, d[k - N + 1] + R2); }
      d[k] = v;
    }
    for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
      const k = j * N + i; let v = d[k]; if (!v) continue;
      if (i < N - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < N - 1) { v = Math.min(v, d[k + N] + 1); if (i < N - 1) v = Math.min(v, d[k + N + 1] + R2); if (i > 0) v = Math.min(v, d[k + N - 1] + R2); }
      d[k] = v;
    }
    return d;
  };
  // exact Euclidean distance (cells) to the nearest cell where from(k) holds: squared distance transform along rows,
  // then columns (Felzenszwalb & Huttenlocher). The chamfer above bends contours into polygons, which bent the crests.
  const edt = from => {
    const BIG = 1e12, g = new Float64Array(NN), f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
    for (let k = 0; k < NN; k++) g[k] = from(k) ? 0 : BIG;
    const line = (at) => {
      for (let q = 0; q < N; q++) f[q] = g[at(q)];
      let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < N; q++) {
        let x = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (x <= z[k]) { k--; x = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = x; z[k + 1] = Infinity;
      }
      k = 0; for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
      for (let q = 0; q < N; q++) g[at(q)] = d[q];
    };
    for (let j = 0; j < N; j++) line(q => j * N + q);
    for (let i = 0; i < N; i++) line(q => q * N + i);
    const o = new Float32Array(NN); for (let k = 0; k < NN; k++) o[k] = Math.sqrt(g[k]); return o;
  };
  const toLand = edt(k => !wet[k]), toWater = edt(k => wet[k]);
  const sd0 = new Float32Array(NN);
  for (let k = 0; k < NN; k++) sd0[k] = clamp(wet[k] ? (toLand[k] - .5) * CELL : -(toWater[k] - .5) * CELL, -60, 60);
  // the sea: open water reachable from the map edge. A river or a channel joined to it stays a river (calm, flowing; water.js):
  // the sea grows only from water at least SEA_OPEN m from any land (the map's edge is open water, not land), reaches out
  // SEA_OPEN m from there, and gives way to the river over SEA_MOUTH m in a river's mouth
  const flood = (seed, ok) => {
    const m = new Uint8Array(NN), q = [];
    for (let t = 0; t < N; t++) for (const k of [t, (N - 1) * N + t, t * N, t * N + N - 1]) if (seed(k) && !m[k]) { m[k] = 1; q.push(k); }
    while (q.length) { const k = q.pop(), i = k % N, j = (k / N) | 0; for (const n of [i > 0 ? k - 1 : -1, i < N - 1 ? k + 1 : -1, j > 0 ? k - N : -1, j < N - 1 ? k + N : -1]) if (n >= 0 && ok(n) && !m[n]) { m[n] = 1; q.push(n); } }
    return m;
  };
  const open = k => wet[k] && toLand[k] * CELL >= SEA_OPEN;
  const core = flood(open, open), joined = flood(k => wet[k], k => wet[k]), toCore = edt(k => core[k]);
  const seaW0 = new Float32Array(NN);
  for (let k = 0; k < NN; k++) seaW0[k] = joined[k] ? clamp(1 - (toCore[k] * CELL - SEA_OPEN) / SEA_MOUTH, 0, 1) : 0;
  const sea = seaW0.map(v => v > .5 ? 1 : 0);
  const toSea = cham(k => sea[k]);
  const blur = (a, r) => {   // separable box blur, r cells
    const t = new Float32Array(NN), o = new Float32Array(NN);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0, n = 0; for (let x = Math.max(0, i - r); x <= Math.min(N - 1, i + r); x++) { v += a[j * N + x]; n++; } t[j * N + i] = v / n; }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0, n = 0; for (let y = Math.max(0, j - r); y <= Math.min(N - 1, j + r); y++) { v += t[y * N + i]; n++; } o[j * N + i] = v / n; }
    return o;
  };
  const sd = blur(sd0, 1);   // soften the grid's stair steps right at the waterline
  const sw = new Float32Array(NN);
  // where the crests run: the distance to the coast as the waves see it (rivers, lakes and land all count as coast, so a
  // river's mouth is closed), smoothed over about a wavelength (refraction follows the bed's large shapes, not every inlet)
  const coast = k => !(wet[k] && seaW0[k] > .5), toCoast = edt(coast), fromCoast = edt(k => !coast(k)), q0 = new Float32Array(NN);
  for (let k = 0; k < NN; k++) q0[k] = clamp(coast(k) ? -(fromCoast[k] - .5) * CELL : (toCoast[k] - .5) * CELL, -60, 60);
  const sb = blur(blur(blur(q0, 8), 8), 8);
  // across the crests (toward the shore), from the smoothed coast
  const dX = new Float32Array(NN), dZ = new Float32Array(NN);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, gx = sb[j * N + Math.min(N - 1, i + 1)] - sb[j * N + Math.max(0, i - 1)], gz = sb[Math.min(N - 1, j + 1) * N + i] - sb[Math.max(0, j - 1) * N + i], gl = Math.hypot(gx, gz);
    if (gl > 1e-5) { dX[k] = -gx / gl; dZ[k] = -gz / gl; }
  }
  // the river's jet: a river joined to the sea pushes its water out through the mouth, straight out to sea and spreading a
  // little, at half strength SEA_JET metres out. Each step carries it one cell seaward (it takes the value from one cell shoreward)
  const river = k => wet[k] && joined[k] && seaW0[k] < .5, at = (a, x, z) => {
    x = clamp(x, 0, N - 1.001); z = clamp(z, 0, N - 1.001); const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, k = j * N + i;
    return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + N] * (1 - u) + a[k + N + 1] * u) * v;
  };
  let jet = new Float32Array(NN); for (let k = 0; k < NN; k++) jet[k] = river(k) ? 1 : 0;
  const fade = Math.pow(.5, CELL / SEA_JET), steps = Math.ceil(SEA_JET / CELL * 3);
  for (let it = 0; it < steps; it++) {
    const nj = jet.slice();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (!wet[k] || !joined[k] || river(k)) continue; nj[k] = Math.max(nj[k], at(jet, i + dX[k], j + dZ[k]) * fade); }
    jet = it % 4 === 3 ? blur(nj, 1).map((v, k) => Math.max(v, nj[k] * .96)) : nj;   // the jet spreads as it goes
  }
  const jb = blur(jet, 2).map((v, k) => wet[k] && joined[k] ? v : 0);
  for (let k = 0; k < NN; k++) sw[k] = wet[k] ? seaW0[k] : clamp(1 - (toSea[k] * CELL - 4) / 3, 0, 1);   // banks of the sea, up to ~4 m inland
  const swb = blur(sw, 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    sh[k * 4] = sd[k]; sh[k * 4 + 1] = dX[k]; sh[k * 4 + 2] = dZ[k];
    // crests at sb in the water, held back by up to SEA_LAG m where the river's jet opposes them (waves slow down against a
    // current), so the crest line bows out to sea in front of a mouth; on the sand the run-up keeps the phase it had at the waterline
    sh2[k * 2] = clamp(sb[k] - sd[k] - SEA_LAG * jb[k], -40, 40); sh2[k * 2 + 1] = jb[k];
    sh[k * 4 + 3] = wet[k] && !joined[k] ? 0 : wet[k] ? Math.min(swb[k], seaW0[k] * 1.5) : swb[k];
  }
  wGeo.attributes.shore.needsUpdate = wGeo.attributes.shore2.needsUpdate = true;
}
const waterMat = new THREE.ShaderMaterial({
  // pulled a few depth steps toward the camera: where the sheet lies on the sand (the run-up's edge) it must stay in front of
  // it even with a phone's coarse depth buffer, or the two flicker in a pattern of the 0.5 m grid
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2,
  uniforms: { uTime: timeU, uDim: dimU, uMoonStrength: moonStrength, uMoonShadow: moonShadow, uMoonShadowMatrix: {value:sun.shadow.matrix}, uMoonShadowTexel: {value:new THREE.Vector2(1/2048,1/2048)}, uSun: { value: sun.position.clone().normalize() }, uShallow: BU.uShallow, uDeep: BU.uDeep, uLava: BU.uLava, uSea: BU.uSea, uWaveH: { value: .38 }, ...WATERU },
  vertexShader: `attribute float depth; attribute vec4 shore; attribute vec2 shore2; uniform float uTime; uniform float uSea; uniform float uWaveH;
    varying float vD; varying float vD0; varying vec3 vWPos; varying vec4 vSea; varying vec2 vPh; varying vec2 vGrad; varying vec2 vDir; varying vec2 vRiv;
    ${GLSL_NOISE}
    ${TDSea.GLSL_PRELUDE}${TDSea.COMMON}
    void main(){
      vec4 w0=modelMatrix*vec4(position,1.); float seaW=shore.w*uSea, h=0., ph=0., brk=0.; vec2 grad=vec2(0.);
      if(seaW>.001){
        grad=seaWave(w0.xz,shore.x,depth,shore.yz,shore2,h,ph,brk)*seaW; h*=seaW;
        if(depth<0.) h=max(h,-depth+.02);   // on the beach the sheet lies just on the sand, so the wet sand it draws is never hidden under it
      }
      vec4 w=modelMatrix*vec4(position+vec3(0.,h,0.),1.);
      vD=depth+h; vD0=depth; vWPos=w.xyz; vSea=vec4(seaW,brk*seaW,shore.x,uWaveH); vPh=vec2(cos(ph),sin(ph)); vGrad=grad; vDir=shore.yz; vRiv=shore2;
      gl_Position=projectionMatrix*viewMatrix*w;
    }`,
  fragmentShader: `uniform float uTime; uniform float uDim; uniform vec3 uSun; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uLava; uniform float uSea; uniform sampler2D uFlow; uniform sampler2D uMask; uniform float uFlowMax; uniform float uBankRange; uniform float uTrailMax; uniform float uShow; uniform float uMapSize; uniform vec4 uFalls[8]; uniform float uFallCount; uniform vec4 uSprings[8]; uniform float uSpringCount; uniform float uWaveH; varying float vD; varying float vD0; varying vec3 vWPos; varying vec4 vSea; varying vec2 vPh; varying vec2 vGrad; varying vec2 vDir; varying vec2 vRiv;
    ${DIM_GLSL}
    ${GLSL_NOISE}
    ${LAVA_SURFACE_GLSL}
    ${TDSea.GLSL_PRELUDE}${TDSea.COMMON}${TDSea.SHADE}
    ${MOON_GLSL}
    float caus(vec2 p){
      vec2 q=p+vec2(fbm(p*.8+uTime*.025),fbm(p*.9-uTime*.021))*1.3;
      float a=sin(q.x*8.+q.y*3.5+uTime*.22),b=sin(q.y*9.-q.x*2.3-uTime*.18);
      return pow(max(0.,a*b),5.)*.7;
    }
    void main(){
      float seaW=vSea.x; vec2 p=vWPos.xz;
      // the sea is worked out again per pixel (sea.js seaWave): its depth here decides the water's edge, so the edge,
      // the crests and their foam follow smooth curves instead of the 0.5 m triangles
      float hP=0., phP=0., brkP=0.; vec2 gP=vec2(0.);
      if(seaW>.001){ gP=seaWave(p,vSea.z,vD0,vDir,vRiv,hP,phP,brkP)*seaW; hP*=seaW; brkP*=seaW; }
      float dP=seaW>.001?vD0+hP:vD;
      bool dry=dP<=0.;
      if(dry&&seaW<.01) discard;
      float d=max(dP,0.);
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
      #ifdef SPRING
      const float SK=.3;   // a spring's streams and ponds are only a few cm deep: a thin foam line, not a white sheet
      #else
      const float SK=1.;
      #endif
      float fz=smoothstep(.17*SK,.0,d+(fbm(p*3.+uTime*.3)-.5)*.16*SK)*mix(.3,1.,SK);
      col=mix(col,vec3(.96,1.,1.),fz*.9);
      // 泡の模様（流れに乗る）。覆う割合 cover は Unity の水と同じ式：lace = saturate((pattern-(1-cover))*4)
      float patA=clamp((mix(fbm(pb*2.3+vec2(uTime*.03,0.)),fbm(pa*2.3+vec2(uTime*.03,0.)),w0)-.5)*2.6+.5,0.,1.);
      float patB=clamp((fbm(p*3.9+vec2(-uTime*.02,uTime*.03))-.5)*2.6+.5,0.,1.);
      float pat=patA*.6+patB*.4;
      float rapids=clamp((speed-.6)/.6,0.,1.)*(1.-smoothstep(.8,2.2,d));
      float lace=clamp((pat-(1.-.58*rapids))*4.,0.,1.)*step(.001,rapids);
      float trail=mk.r*uTrailMax; float trailLace=clamp((patA-(1.-trail))*4.,0.,1.)*step(.001,trail);
      float bankDist=fl.a*uBankRange; float bankNear=(1.-smoothstep(.15,.6,bankDist))*step(.04,bankDist);
      float shoreBand=max(smoothstep(.10*SK,.025*SK,d)*smoothstep(0.,.012*SK,d), bankNear*step(.02*SK,d));
      float lap=.5+.5*sin(uTime*1.25+fl.b*9.+(p.x+p.y)*.7);
      float shore=shoreBand*clamp((pat-(1.-(.58+.06*lap)))*4.,0.,1.)*(.7+.3*clamp(speed,0.,1.))*.9*mix(.5,1.,SK);
      // 滝の着水：中心が明るく外へ広がって薄れる輪（Unity の飛沫・波紋と同じ向きの動き）
      float ringF=0.;
      for(int i=0;i<8;i++){ if(float(i)>=uFallCount) break; vec2 rel=p-uFalls[i].xy; float r=length(rel);
        ringF+=exp(-r*r/(.5+uFalls[i].w*.12))*.75;
        for(int k=0;k<3;k++){ float ph=fract(uTime*.5+float(k)/3.+uFalls[i].z); float R=.3+ph*(2.4+uFalls[i].w*.5);
          float arc=smoothstep(.30,.75,vn(vec2(atan(rel.y,rel.x)*2.2+float(k)*7.3+uFalls[i].z*5.,uTime*.25)));
          ringF+=exp(-pow((r-R)/.26,2.))*(1.-ph)*(1.-ph)*arc*.9; } }
      #ifdef SPRING
      // the springs: water boiling up in the middle, and small rings running out from it
      for(int i=0;i<8;i++){ if(float(i)>=uSpringCount) break; vec2 rel=p-uSprings[i].xy; float r=length(rel), sz=uSprings[i].z;
        ringF+=exp(-r*r/(.03+.06*sz))*(.45+.55*vn(rel*10.+vec2(uTime*2.3,-uTime*1.7)))*.9;
        for(int k=0;k<3;k++){ float ph=fract(uTime*.55+float(k)/3.+uSprings[i].w); float R=.08+ph*(.45+.7*sz);
          ringF+=exp(-pow((r-R)/.06,2.))*(1.-ph)*(1.-ph)*.55; } }
      #endif
      ringF=clamp(ringF,0.,1.);
      float foamAdd=max(max(lace*.92,trailLace*.85),max(shore*.8,ringF*.8));
      col=mix(col,vec3(.96,1.,1.),foamAdd*(1.-uLava));
      fz=max(fz,foamAdd);
      #ifdef SPRING
      float alpha=max(mix(.16,.85,t)+spec*.5,fz*.9);   // a few cm of clear water: the stream bed shows through
      #else
      float alpha=max(mix(.42,.93,t),fz*.95);
      #endif
      if(dry){ col=vec3(0.); alpha=0.; }
      // the sea: waves, surf, run-up, wet sand, clear water and the light network on the floor (sea.js)
      if(seaW>.001){ vec4 sv=vec4(seaW,brkP,vSea.z,vSea.w); vec4 sc=dry?wetSand(p,dP,vD0,sv):seaColor(p,max(dP,0.),vD0,sv,vec2(cos(phP),sin(phP)),gP,vDir,vRiv); col=mix(col,sc.rgb,seaW); alpha=mix(alpha,sc.a,seaW); }
      if(dry&&alpha<.004) discard;   // the bare beach: the terrain draws its wet sand itself
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
        col=lavaSurface(p,uTime).rgb;alpha=1.;
      }
      gl_FragColor=vec4(dimc(pow(col,vec3(2.2))),alpha);
      vec3 moonLight=vec3(0.);
      if(uMoonStrength>.001 && uLava<.5 && !dry){
        vec2 slope=mix(g*(.035+.05*min(speed,2.)),gP*.6+g*.035,seaW);
        vec3 moonNormal=normalize(vec3(-slope.x,1.,-slope.y));
        moonLight=moonReflection(V,moonNormal,normalize(uSun),vWPos,uTime)*uMoonStrength*moonVisibility(vWPos)*smoothstep(0.,.12,dP)*(1.-fz*.85);
      }
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(wGeo, waterMat);
water.renderOrder = 2;
scene.add(water);

// 外周の水の断面だけを一つの帯にする。水中の体積や内陸の池の周囲は描かない。
const waterSideLight = { value: new THREE.Vector3(1,1,1) };
const waterSidePoints = { value: Array.from({length:6},()=>new THREE.Vector4()) };
const waterSideColors = { value: Array.from({length:6},()=>new THREE.Vector3()) };
const waterSideMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true,
  uniforms:{uTime:timeU,uWaveH:waterMat.uniforms.uWaveH,uSea:BU.uSea,uShallow:BU.uShallow,uDeep:BU.uDeep,uDim:dimU,
    uLight:waterSideLight,uLocal:waterSidePoints,uLocalColor:waterSideColors},
  vertexShader:`attribute float depth; attribute vec4 shore; attribute vec2 shore2; attribute float top;
    uniform float uTime,uWaveH,uSea; varying float vDepth,vBelow,vSea; varying vec3 vWorld;
    ${TDSea.GLSL_PRELUDE}${TDSea.COMMON}
    void main(){
      vec4 w=modelMatrix*vec4(position,1.); float h=0.,ph=0.,brk=0.; float seaW=shore.w*uSea;
      if(seaW>.001){seaWave(w.xz,shore.x,depth,shore.yz,shore2,h,ph,brk);h*=seaW;}
      w.y+=h*top; vBelow=(depth+h)*(1.-top);vDepth=depth;vSea=seaW;vWorld=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w;
    }`,
  fragmentShader:`uniform vec3 uShallow,uDeep,uLight; uniform float uDim; uniform vec4 uLocal[6]; uniform vec3 uLocalColor[6];
    varying float vDepth,vBelow,vSea; varying vec3 vWorld;
    ${DIM_GLSL}
    void main(){
      float z=max(vBelow,0.); vec3 seaTop=mix(mix(uShallow,vec3(.10,.78,.80),.35),uDeep,1.-exp(-.55*vDepth));
      vec3 col=mix(mix(uShallow,seaTop,vSea),uDeep,1.-exp(-1.1*z));
      col=mix(col,vec3(.72,.87,.97),vSea*.3*exp(-z/.5));col*=exp(-.25*z);
      col=mix(col,vec3(.85,.95,1.),.6*(1.-smoothstep(0.,.06,z)));
      vec3 local=vec3(0.);
      for(int i=0;i<6;i++){float d=distance(vWorld,uLocal[i].xyz);float a=max(0.,1.-d/max(.01,uLocal[i].w));local+=uLocalColor[i]*a*a*.05;}
      gl_FragColor=vec4(dimc(pow(col,vec3(2.2)))*(uLight+local),clamp(.90+.04*z,.90,.98));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
});
const waterSides = new THREE.Mesh(new THREE.BufferGeometry(),waterSideMat);
waterSides.name='Map water sides';waterSides.renderOrder=1;waterSides.visible=false;waterSides.frustumCulled=false;scene.add(waterSides);
// 既存の松明の6灯を再利用する。側面のためにライトや毎フレームの地形計算は増やさない。
const waterSideView=new THREE.Vector3();
waterSides.onBeforeRender=(_renderer,_scene,viewCamera)=>{
  // Four planar edges, drawn far-to-near inside this one draw. Otherwise a far
  // double-sided strip can paint over the near strip because depthWrite is off.
  const g=waterSides.geometry,edges=g.userData.edges;
  if(edges){
    viewCamera.getWorldDirection(waterSideView);
    const order=edges.map((e,i)=>({i,d:e.x*waterSideView.x+e.z*waterSideView.z})).sort((a,b)=>b.d-a.d).map(e=>e.i);
    const key=order.join(',');
    if(g.userData.order!==key){let k=0;for(const i of order)for(const v of edges[i].indices)g.index.array[k++]=v;g.index.needsUpdate=true;g.userData.order=key;}
  }
  const B=state.sunOn?BIOME():BIOMES.find(b=>b.id==='forest'),den=Math.max(.001,B.hemi*1.6+B.sunI);
  const amount=(hemi.intensity*1.6+(sun.visible?sun.intensity:0)+(fill.visible?fill.intensity:0))/den;
  // Outdoor tint follows the water surface; an unlit cave must not retain the daytime brightness.
  waterSideLight.value.copy(waterTimeTint.value).multiplyScalar(amount/Math.max(.001,waterTimeTint.value.x,waterTimeTint.value.y,waterTimeTint.value.z));
  for(let i=0;i<6;i++){const l=glowLights[i];waterSidePoints.value[i].set(l.position.x,l.position.y,l.position.z,l.distance);
    waterSideColors.value[i].set(l.color.r,l.color.g,l.color.b).multiplyScalar(l.visible?l.intensity:0);}
};
function rebuildWaterSides(){
  const pos=[],depth=[],shore=[],shore2=[],top=[],ix=[],edges=[];
  const sh=wGeo.attributes.shore.array,sh2=wGeo.attributes.shore2.array;
  function sample(a,b,t){const k=idx(...a),l=idx(...b),mix=(x,y)=>x+(y-x)*t;
    return {x:mix(vx(a[0]),vx(b[0])),z:mix(vx(a[1]),vx(b[1])),d:Math.max(0,state.water-mix(H[k],H[l])),
      s:Array.from({length:4},(_,c)=>mix(sh[k*4+c],sh[l*4+c])),r:Array.from({length:2},(_,c)=>mix(sh2[k*2+c],sh2[l*2+c]))};}
  for(const [edge] of SIDES){
    const mid=edge((N-1)/2),e={x:vx(mid[0]),z:vx(mid[1]),indices:[]};edges.push(e);
    for(let t=0;t<N-1;t++){
    const a=edge(t),b=edge(t+1),da=state.water-H[idx(...a)],db=state.water-H[idx(...b)];
    if(da<=0&&db<=0)continue;
    const start=da<0?da/(da-db):0,end=db<0?da/(da-db):1;
    if(end-start<1e-6)continue;
    const base=depth.length;
    for(const q of [sample(a,b,start),sample(a,b,end)])for(const upper of [1,0]){
      pos.push(q.x,state.water-q.d*(1-upper),q.z);depth.push(q.d);shore.push(...q.s);shore2.push(...q.r);top.push(upper);
    }
    const indices=[base,base+1,base+2,base+2,base+1,base+3];ix.push(...indices);e.indices.push(...indices);
    }
  }
  const g=new THREE.BufferGeometry();
  for(const [name,arr,n] of [['position',pos,3],['depth',depth,1],['shore',shore,4],['shore2',shore2,2],['top',top,1]])g.setAttribute(name,new THREE.Float32BufferAttribute(arr,n));
  g.setIndex(ix);g.userData.edges=edges;waterSides.geometry.dispose();waterSides.geometry=g;waterSides.visible=ix.length>0&&BU.uLava.value<.5;
}

// ---------- water sources (springs.js): streams and ponds above the water level, and the water in the pools
// The water is worked out once (no simulation): each spring's flow is an area it can keep wet; it runs down the steepest way,
// fills hollows to their brim and spills on. springRes holds the result on the editor grid; the walk check and the water mesh use it.
let springRes = null;
const POOL_WALL = .35, POOL_H = .45, POOL_FREE = .1;   // a pool's wall: thickness, height above its floor; its water stays this far below the rim (m)
const poolLevel = p => p.rim - POOL_FREE;
// signed distance (m) to a pool's outer edge, negative inside. Rect: the larger of the two axis distances; round: along the ellipse's radius
function poolDist(p, x, z) {
  const a = Math.abs(p.x2 - p.x1) / 2, b = Math.abs(p.z2 - p.z1) / 2, dx = x - (p.x1 + p.x2) / 2, dz = z - (p.z1 + p.z2) / 2;
  if (p.type === 'round') return (Math.hypot(dx / a, dz / b) - 1) * Math.min(a, b);
  return Math.max(Math.abs(dx) - a, Math.abs(dz) - b);
}
// a pool as springs.js sees it on a TN×TN grid: its water cells, the water's height and the cell just outside its notch
function poolInput(p, TN, TS) {
  const cells = [], at = v => clamp(Math.round((v + HALF) / TS), 0, TN - 1);
  for (let j = at(Math.min(p.z1, p.z2)); j <= at(Math.max(p.z1, p.z2)); j++) for (let i = at(Math.min(p.x1, p.x2)); i <= at(Math.max(p.x1, p.x2)); i++)
    if (poolDist(p, -HALF + i * TS, -HALF + j * TS) < -POOL_WALL + .05) cells.push(j * TN + i);
  const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2; let t = 0; while (poolDist(p, cx + p.ox * t, cz + p.oz * t) < .45 && t < 20) t += .05;
  const ox = cx + p.ox * t, oz = cz + p.oz * t, out = Math.abs(ox) < HALF && Math.abs(oz) < HALF ? at(oz) * TN + at(ox) : -1;
  return { id: p.id, cells, level: poolLevel(p), outlet: out };
}
const springInput = (TN, TS, TH) => ({ TN, TS, HALF, TH, level: state.water, springs: springs.map(q => ({ id: q.id, x: q.x, z: q.z, preset: q.preset })), pools: pools.map(p => poolInput(p, TN, TS)) });
function solveSprings() {
  springRes = (springs.length || pools.length) && !BIOME().lava ? TDSprings.solve(springInput(N, CELL, H)) : null;
  if (poolGroup.children.length !== pools.length) rebuildPools();   // a new map (genFlat…) clears the list without the meshes
  rebuildSpringWater(); rebuildSpringMarks(); walkDirty = true;
  let n = 0;
  if (springRes) for (const q of springRes.springs) if (q.wet && n < 8) WATERU.uSprings.value[n++].set(q.x, q.z, Math.sqrt(TDSprings.PRESETS[q.preset].area / 260), (Math.abs(Math.sin(q.x * 12.9898 + q.z * 78.233)) * 43758.5453) % 1);
  WATERU.uSpringCount.value = n;
}
// the springs' water surface at (x, z) (-Infinity where they have none): bilinear over the grid, with the dry cells next to
// the water held just under their ground, so the shore runs between the vertices like the mesh's does
function springLevelAt(x, z) {
  if (!springRes) return -Infinity;
  const e = springRes.edge, fx = (x + HALF) * RES, fz = (z + HALF) * RES, i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fz), 0, N - 2), k = idx(i, j);
  const a = e[k], b = e[k + 1], c = e[k + N], d = e[k + N + 1];
  if (a !== a || b !== b || c !== c || d !== d) return -Infinity;
  const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
const waterAt = (x, z) => Math.max(state.water, springLevelAt(x, z));   // the water's surface here: the map's level, or a spring's stream, pond or pool above it
// springs changed: give back the old channels, work the water out on that ground, then carve the new channels into it
function applySprings() {
  const base = H.map((h, k) => h + SC[k]);
  const res = springs.length && !BIOME().lava ? TDSprings.solve(springInput(N, CELL, base)) : null, cv = res ? TDSprings.carve(res, base) : new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) H[k] = base[k] - cv[k];
  SC.set(cv); updateTerrain(); refreshWaterData();
  // nothing stands in the new water but water plants; and no boulder or cliff stone stands in a spring's falling water
  // (the same clearing as a placed waterfall: by position, or any point of the stone's outline)
  const inFall = (x, z) => springRes && springRes.falls.some(f => { const ax = x - f.x, az = z - f.z, along = ax * f.dir[0] + az * f.dir[1], lat = Math.abs(ax * f.dir[1] - az * f.dir[0]); return lat < f.width * .55 + .3 && along > -1 && along < f.lean + 1.2; });
  const n0 = props.length; props = props.filter(p => (PROP[p[0]].water || PROP[p[0]].id === 'reed' || springLevelAt(p[1], p[2]) - heightAt(p[1], p[2]) < .03) &&
    !(FALL_CLEARS.has(PROP[p[0]].id) && (inFall(p[1], p[2]) || cliffWorldHull(p).some(([hx, hz]) => inFall(hx, hz)))));
  if (props.length !== n0) rebuildProps();
  rebuildSpringMarks();
}
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
spGeo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(N * N), 1));
spGeo.setAttribute('shore', new THREE.BufferAttribute(new Float32Array(N * N * 4), 4));   // no sea here: all zero
spGeo.setAttribute('shore2', new THREE.BufferAttribute(new Float32Array(N * N * 2), 2));
spGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(0), 1));
// the same water shader (flow images, ripples, foam), with a thinner foam line for shallow streams and the boil over each spring
const springMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -2,
  uniforms: waterMat.uniforms, vertexShader: waterMat.vertexShader, fragmentShader: waterMat.fragmentShader, defines: { SPRING: '' } });
const springWater = new THREE.Mesh(spGeo, springMat);
springWater.renderOrder = 2; springWater.visible = false; scene.add(springWater);
// one sheet over the springs' water: vertices at the water's surface (the dry ones next to it just under their ground), and only
// the cells that touch a stream or a pond (the pools have their own sheets)
let springLiftOn = false;
function rebuildSpringWater() {
  const r = springRes, pos = spGeo.attributes.position.array, dp = spGeo.attributes.depth.array, ix = [];
  if (r) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = idx(i, j), y = r.edge[k] === r.edge[k] ? r.edge[k] : H[k] - 1;
      pos[k * 3] = vx(i); pos[k * 3 + 1] = y; pos[k * 3 + 2] = vx(j); dp[k] = y - H[k];
    }
    // the shore: where the ground is flat the waterline would follow the 0.5 m grid's steps. Blur "is this vertex under water"
    // over about a metre and put the shallow vertices' depth on that, so the waterline rounds off (deep water and the positions
    // stay as they are; a vertex well above the water stays dry)
    let wet = new Float32Array(N * N); for (let k = 0; k < N * N; k++) wet[k] = r.kind[k] === 2 && dp[k] > 0 ? 1 : 0;   // ponds only: a narrow stream would be blurred away
    for (let it = 0; it < 2; it++) {
      const t = new Float32Array(N * N), o = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; for (let a = -2; a <= 2; a++) v += wet[j * N + clamp(i + a, 0, N - 1)]; t[j * N + i] = v / 5; }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; for (let b = -2; b <= 2; b++) v += t[clamp(j + b, 0, N - 1) * N + i]; o[j * N + i] = v / 5; }
      wet = o;
    }
    const nearStream = k => { const i = k % N, j = (k / N) | 0; for (let b = Math.max(0, j - 1); b <= Math.min(N - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(N - 1, i + 1); a++) if (r.kind[b * N + a] === 1) return true; return false; };
    for (let k = 0; k < N * N; k++) if (r.edge[k] === r.edge[k] && (r.kind[k] === 2 || r.kind[k] === 0) && dp[k] < .1 && !nearStream(k)) dp[k] = Math.min((wet[k] - .5) * .2, dp[k] + .05);
    const e = r.edge, kd = r.kind, open = k => kd[k] === 1 || kd[k] === 2;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = idx(i, j), b = a + 1, c = a + N, d = c + 1;
      if (e[a] !== e[a] || e[b] !== e[b] || e[c] !== e[c] || e[d] !== e[d] || !(open(a) || open(b) || open(c) || open(d))) continue;
      ix.push(a, c, b, b, c, d);
    }
  }
  spGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(ix), 1));
  spGeo.attributes.position.needsUpdate = spGeo.attributes.depth.needsUpdate = true; spGeo.computeBoundingSphere();
  springWater.visible = ix.length > 0;
  // the ground under and beside it: its height above the water (terrain shader: stream bed, damp banks)
  const sw = tGeo.attributes.springLift.array, had = springLiftOn; springLiftOn = !!r;
  if (r || had) sw.fill(0);
  if (r) {
    // the nearest stream or pond within 3 cells: its surface, raised 0.12 m a cell away from it, so the damp fades out over the bank
    const kd = r.kind, R3 = 3;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = idx(i, j); let hw = 10;
      for (let b = Math.max(0, j - R3); b <= Math.min(N - 1, j + R3); b++) for (let a = Math.max(0, i - R3); a <= Math.min(N - 1, i + R3); a++) {
        const m = b * N + a; if (kd[m] !== 1 && kd[m] !== 2) continue;
        hw = Math.min(hw, (kd[k] === 1 || kd[k] === 2 ? H[k] - r.surf[m] : Math.max(H[k] - r.surf[m], 0)) + .12 * Math.hypot(a - i, b - j));
      }
      if (kd[k] === 1 || kd[k] === 2) hw = H[k] - r.surf[k];   // only its own water makes a stream bed; dry ground below a stream up a cliff is just damp, fading with the distance
      if (hw < 10) sw[k] = 10 - clamp(hw, -10, 10);
    }
  }
  if (r || had) { tGeo.attributes.springLift.needsUpdate = true; if (terrain.geometry !== tGeo) scheduleCliffRelief(); }   // the shoulder mesh copies it from tGeo
  if (typeof rebuildPoolWater === 'function') rebuildPoolWater();
  rebuildSpringFalls();
}
// where the springs are, while editing: a ring and a drop
const springMarkGroup = new THREE.Group(); scene.add(springMarkGroup);
const springMarkMat = new THREE.MeshBasicMaterial({ color: 0x6fe3ff, transparent: true, opacity: .85, depthTest: false });
function rebuildSpringMarks() {
  for (const c of [...springMarkGroup.children]) { c.geometry.dispose(); springMarkGroup.remove(c); }
  for (const q of springs) {
    const y = Math.max(waterAt(q.x, q.z), heightAt(q.x, q.z)), s = .35 + .25 * Math.sqrt(TDSprings.PRESETS[q.preset].area / 260);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(s, .04, 6, 32), springMarkMat); ringM.rotation.x = Math.PI / 2; ringM.position.set(q.x, y + .08, q.z);
    const drop = new THREE.Mesh(new THREE.ConeGeometry(.14, .3, 10), springMarkMat); drop.rotation.x = Math.PI; drop.position.set(q.x, y + .75, q.z);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), springMarkMat); ball.position.set(q.x, y + .55, q.z);
    for (const m of [ringM, drop, ball]) { m.renderOrder = 7; springMarkGroup.add(m); }
  }
  springMarkGroup.visible = state.mode === 'edit';
}
function placeSpring(x, z, preset) {
  if (BIOME().lava) return '溶岩のバイオームでは水源を置けません';
  if (heightAt(x, z) < state.water) return '水位より低い所（水の中）には置けません';
  const near = springs.find(q => Math.hypot(q.x - x, q.z - z) < 1);
  if (near) { if (near.preset === preset) return '同じ湧出量の水源がもうあります'; near.preset = preset; applySprings(); return null; }
  springs.push({ id: newId('spring'), x: +x.toFixed(2), z: +z.toFixed(2), preset }); applySprings(); return null;
}

function refreshGroundWeights(){TDTerrainPaint.resolve(S,effectiveS,NS);}
function updateTerrain() {
  refreshGroundWeights();
  walkDirty = true;
  if (typeof linkGroup !== 'undefined') for (const g of linkGroup.children) g.position.y = heightAt(g.userData.m.x, g.userData.m.z);
  if (typeof updateAtmoHeights === 'function' && fogGroup) updateAtmoHeights();
  const pos = tGeo.attributes.position.array, sa = tGeo.attributes.splatA.array, sb = tGeo.attributes.splatB.array, sc = tGeo.attributes.splatC.array, dp = wGeo.attributes.depth.array;
  let painted=false;
  for (let k = 0; k < N * N; k++) {
    if(pos[k*3+1]!==H[k])propGrounding.changed(k);
    pos[k * 3 + 1] = H[k]; dp[k] = state.water - H[k];
    for (let c = 0; c < 4; c++) sa[k * 4 + c] = effectiveS[k * NS + c] / 255;
    for (let c = 0; c < 4; c++) sb[k * 4 + c] = effectiveS[k * NS + 4 + c] / 255;
    for(let c=0;c<3;c++)sc[k*3+c]=effectiveS[k*NS+8+c]/255;painted ||= sc[k*3+1]>0;
  }
  bedrockPainted=painted;setBedrockVariant(painted&&bedrockPrepared);
  if(painted&&!bedrockPrepared&&!bedrockPreparation)void bedrockReady().catch(()=>{});
  fillCliffAttrs();
  TDPavingMask.updateMask(pavingMask,effectiveS,NS);
  tGeo.attributes.position.needsUpdate = tGeo.attributes.splatA.needsUpdate = tGeo.attributes.splatB.needsUpdate = tGeo.attributes.splatC.needsUpdate = wGeo.attributes.depth.needsUpdate = true;
  computeShoreField();
  tGeo.computeVertexNormals();
  const slopeField=tGeo.attributes.reliefSlope;for(let k=0;k<N*N;k++)slopeField.array[k]=1-tGeo.attributes.normal.getY(k);slopeField.needsUpdate=true;
  if(terrain.geometry!==tGeo){terrain.geometry.dispose();terrain.geometry=tGeo;}
  tGeo.computeBoundingSphere(); tGeo.computeBoundingBox();
  scheduleCliffRelief();
  const spos = sGeo.attributes.position.array;
  SIDES.forEach(([f], s) => { for (let t = 0; t < N; t++) { const [i, j] = f(t); spos[(s * N + t) * 2 * 3 + 1] = H[idx(i, j)]; } });
  sGeo.attributes.position.needsUpdate = true; sGeo.computeBoundingSphere();
  water.position.y = state.water; waterU.value = state.water;
  rebuildWaterSides();
  scheduleWater();
}

// ============================================================
// Props (procedural low-poly assets, drawn instanced)
// ============================================================
// prop types: one file each in props/ (index.html loads them in type order); shared helpers in props/common.js
const PROP = TDProps.build();
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, flatShading: true });
const heroMat = propMat.clone();
heroMat.transparent = true;   // lets it be drawn last, on top of rock, while inside a tunnel
// stone detail (props/detail.js), projected in world space from three sides onto rocks, cliffs and masonry
const detailTex = new THREE.DataTexture(TDGeo.DETAIL.paint(), TDGeo.DETAIL.size, TDGeo.DETAIL.size);
detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping; detailTex.generateMipmaps = true; detailTex.minFilter = THREE.LinearMipmapLinearFilter; detailTex.magFilter = THREE.LinearFilter; detailTex.needsUpdate = true;
const detailU = { value: detailTex };
rockGrainU.value=detailTex;
const propShader = (sh) => {
  sh.uniforms.uDim = dimU; sh.uniforms.uTime = timeU; sh.uniforms.uDetail = detailU; sh.uniforms.uStoneGrain=rockGrainU; Object.assign(sh.uniforms, BU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n#ifdef TOUCH\nattribute vec3 touch;\n#endif\n#ifdef DETAIL\nvarying vec3 vWP;\n#endif\nvarying float vPY; attribute float glow; varying float vGlow; attribute float sway; uniform vec3 uWind; uniform float uTime;\n#ifdef MOSS\nattribute float cliffI; varying float vCI;\n#endif')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vGlow=glow;
#if defined(TOUCH) && defined(USE_INSTANCING)
// bent away from the hero (touch.xy = world-space bend of the top in m, touch.z = 1 / mesh height); base stays put
{ vec2 tb=touch.xy; float bb=dot(tb,tb); if(bb>0.){ float hk=pow(clamp(position.y*touch.z,0.,1.),1.6); mat3 im=mat3(instanceMatrix); transformed+=transpose(im)*(vec3(tb.x,-bb*.8,tb.y)*hk)/dot(im[0],im[0]); } }
#endif
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
vPY=(modelMatrix*pw4).y;
#ifdef DETAIL
vWP=(modelMatrix*pw4).xyz;
#endif`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n#ifdef DETAIL\nvarying vec3 vWP; uniform sampler2D uDetail;\n#ifndef DETAIL_K\n#define DETAIL_K 1.\n#endif\n#endif\nuniform float uDim; uniform float uTime; varying float vGlow; uniform vec3 uPropTint; uniform vec3 uMoss; uniform float uMossAmt; uniform float uSnow; uniform float uSnowLine; varying float vPY;\nuniform vec3 uCSTint[7]; uniform vec4 uCSMoss[7]; uniform vec2 uCSWet[7];\n#ifdef MOSS\nvarying float vCI;\n#endif\n' + DIM_GLSL + STONE_SURFACE_GLSL)
    .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef MOSS
float mg=diffuseColor.g-max(diffuseColor.r,diffuseColor.b);
int ci=int(vCI+.5); vec4 cm=uCSMoss[ci]; vec2 cw=uCSWet[ci];
vec3 mossC=mix(uMoss,cm.rgb,cm.a);
diffuseColor.rgb=mix(diffuseColor.rgb, mossC*(.8+.5*dot(diffuseColor.rgb,vec3(.33))), max(uMossAmt,cm.a)*smoothstep(.0,.05,mg));
diffuseColor.rgb*=uCSTint[ci]*(1.-.3*cw.x);
#endif
diffuseColor.rgb=dimc(diffuseColor.rgb*uPropTint);`)
    .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
#ifdef CARDS
normal *= faceDirection;   // a leaf card is lit the same from both faces (its normals point out of the crown)
#endif`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef DETAIL
// grain, pits and hairline cracks at two scales; blend weights from the world normal (flat-shaded facets pick one side each)
vec3 wn=inverseTransformDirection(normal,viewMatrix), tw=pow(abs(wn),vec3(4.)); tw/=tw.x+tw.y+tw.z;
vec3 q1=vWP*.42, q2=vWP*1.7+.37;
float dt1=texture2D(uDetail,q1.yz).r*tw.x+texture2D(uDetail,q1.xz).r*tw.y+texture2D(uDetail,q1.xy).r*tw.z;
float dt2=texture2D(uDetail,q2.yz).r*tw.x+texture2D(uDetail,q2.xz).r*tw.y+texture2D(uDetail,q2.xy).r*tw.z;
diffuseColor.rgb*=mix(1.,.5+(dt1*.62+dt2*.38),DETAIL_K);
normal=surfaceNormal(-vViewPosition,normal,((dt1-.5)*.010+(dt2-.5)*.005)*DETAIL_K);
#ifdef MOSS
// moss / grass / sand (cliff style and biome colour) settles on faces turned up, in patches that follow the grain
vec3 mc=mix(cm.rgb,uMoss,uMossAmt*(1.-cm.a));   // the cliff style's moss, else the biome's, else green
float mk=smoothstep(.5,.85,wn.y)*smoothstep(.53,.62,dt1*.6+dt2*.4+cm.a*.08)*.9;
diffuseColor.rgb=mix(diffuseColor.rgb, dimc(mc*(.5+.6*dt2)*uPropTint), mk);
#endif
#endif
float upw=dot(normal, normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz));
diffuseColor.rgb=mix(diffuseColor.rgb, dimc(vec3(.92,.95,1.)), uSnow*smoothstep(.45,.8,upw)*smoothstep(uSnowLine-.3,uSnowLine+.5,vPY)*(1.-step(.01,vGlow)));
#ifdef MOSS
diffuseColor.rgb=mix(diffuseColor.rgb, dimc(vec3(.93,.95,1.)), uCSWet[int(vCI+.5)].y*smoothstep(.5,.85,upw));
#endif`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n#ifdef MOSS\nroughnessFactor*=1.-.6*uCSWet[int(vCI+.5)].x;\n#endif\n#ifdef ICE\ndiffuseColor.rgb*=vec3(.62,.8,.95);   // blue-green depth of clear ice\n#endif')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=diffuseColor.rgb*vGlow*(.85+.15*sin(uTime*9.+vPY*13.))*(1.-.5*uDim);\n#ifdef ICE\ntotalEmissiveRadiance+=vec3(.08,.2,.3)*pow(1.-abs(dot(normal,normalize(vViewPosition))),2.5)*(1.-.5*uDim);   // light through thin edges\n#endif\n#ifdef FOLIAGE\ntotalEmissiveRadiance+=diffuseColor.rgb*.06*(1.-uDim);\n#endif');
};
propMat.onBeforeCompile = propShader; propMat.customProgramCacheKey = () => 'prop-rock-contact-v7';
// rocks and cliff stones get their moss recoloured per biome (sand, ash, snow...)
const rockMat = propMat.clone(); rockMat.defines = { MOSS: '', DETAIL: '' }; rockMat.flatShading = false;   // smoothed normals (makeGeo opt.smooth)
rockMat.onBeforeCompile = propShader; rockMat.customProgramCacheKey = () => 'prop-rock-contact-v7-moss';
// walls, columns and other masonry: the same stone detail, no per-biome moss
const carvedMat=propMat.clone(); carvedMat.flatShading=false; carvedMat.defines={DETAIL:'',DETAIL_K:'.16'}; carvedMat.onBeforeCompile=propShader; carvedMat.customProgramCacheKey=()=> 'prop-carved-v1';
const masonMat = propMat.clone(); masonMat.defines = { DETAIL: '' };
masonMat.onBeforeCompile = propShader; masonMat.customProgramCacheKey = () => 'prop-rock-contact-v7-stone';
// plants: smooth shading from the bent normals (makeGeo part.sn), so canopies and leaves read soft instead of faceted
const foliageMat = propMat.clone(); foliageMat.flatShading = false; foliageMat.roughness = .82; foliageMat.defines = { FOLIAGE: '' };
foliageMat.onBeforeCompile = propShader; foliageMat.customProgramCacheKey = () => 'prop-rock-contact-v7-foliage';
// semi-real plants: leaves on alpha-tested cards sampling the foliage atlas painted by props/foliage.js (both faces lit from outside)
const atlasTex = new THREE.DataTexture(TDGeo.ATLAS.paint(), TDGeo.ATLAS.size, TDGeo.ATLAS.size);
atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.generateMipmaps = true; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.magFilter = THREE.LinearFilter;
atlasTex.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy()); atlasTex.needsUpdate = true;
// Lambert (diffuse only): leaves need no specular, and alpha-tested cards shade every covered pixel, so the cheap model matters
const cardMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: atlasTex, alphaTest: .42, side: THREE.DoubleSide }); cardMat.defines = { FOLIAGE: '', CARDS: '' };
cardMat.onBeforeCompile = propShader; cardMat.customProgramCacheKey = () => 'prop-rock-contact-v7-cards';
// second atlas (props/foliage2.js): meadow grass, straw, wood, wild flowers
const atlasTex2 = new THREE.DataTexture(TDGeo.ATLAS2.paint(), TDGeo.ATLAS2.width, TDGeo.ATLAS2.height);
atlasTex2.colorSpace = THREE.SRGBColorSpace; atlasTex2.generateMipmaps = true; atlasTex2.minFilter = THREE.LinearMipmapLinearFilter; atlasTex2.magFilter = THREE.LinearFilter;
atlasTex2.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy()); atlasTex2.needsUpdate = true;
const cardMat2 = cardMat.clone(); cardMat2.map = atlasTex2; cardMat2.onBeforeCompile = propShader; cardMat2.customProgramCacheKey = () => 'prop-rock-contact-v7-cards2';
// ice (rim light and frosty cracks), snow (faint grain) and glassy stone (obsidian): the stone detail at different strengths
const iceMat = propMat.clone(); iceMat.roughness = .18; iceMat.defines = { DETAIL: '', DETAIL_K: '.5', ICE: '' }; iceMat.onBeforeCompile = propShader; iceMat.customProgramCacheKey = () => 'prop-rock-contact-v7-ice';
const snowMat = propMat.clone(); snowMat.roughness = .8; snowMat.flatShading = false; snowMat.defines = { DETAIL: '', DETAIL_K: '.3' }; snowMat.onBeforeCompile = propShader; snowMat.customProgramCacheKey = () => 'prop-rock-contact-v7-snow';
const glossMat = propMat.clone(); glossMat.roughness = .1; glossMat.metalness = .1; glossMat.defines = { DETAIL: '', DETAIL_K: '.3' }; glossMat.onBeforeCompile = propShader; glossMat.customProgramCacheKey = () => 'prop-rock-contact-v7-gloss';
// bridges and stairs: the stone detail a little weaker (it also reads as weathered grain on the wooden ones)
const structMat = propMat.clone(); structMat.defines = { DETAIL: '', DETAIL_K: '.75' }; structMat.onBeforeCompile = propShader; structMat.customProgramCacheKey = () => 'prop-rock-contact-v7-struct';

// Reuse the existing opaque wood atlas. Normalise its luminance so the original
// baked wood colours remain authoritative; no extra image or transparent pass.
const bridgeWoodRect = TDGeo.ATLAS2.rect.wood;
let bridgeWoodMean = 0, bridgeWoodSamples = 0;
const bridgeLinear = x => x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4);
for (let y = bridgeWoodRect[1] + 4; y < bridgeWoodRect[1] + bridgeWoodRect[3] - 4; y += 8) {
  for (let x = bridgeWoodRect[0] + 4; x < bridgeWoodRect[0] + bridgeWoodRect[2] - 4; x += 8) {
    const i = (y * TDGeo.ATLAS2.width + x) * 4, d = atlasTex2.image.data;
    bridgeWoodMean += .2126 * bridgeLinear(d[i] / 255) + .7152 * bridgeLinear(d[i + 1] / 255) + .0722 * bridgeLinear(d[i + 2] / 255);
    bridgeWoodSamples++;
  }
}
bridgeWoodMean /= bridgeWoodSamples;
const structWoodMat = structMat.clone(); structWoodMat.map = atlasTex2; structWoodMat.defines = {};
structWoodMat.onBeforeCompile = sh => {
  propShader(sh); sh.uniforms.uBridgeWoodMean = { value: bridgeWoodMean };
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBridgeWoodMean;')
    .replace('#include <map_fragment>', `
#ifdef USE_MAP
vec4 grain = texture2D(map, vMapUv);
// White atlas texel is reserved for the stone footings, outside the wood region.
float woodPixel = step(.74, vMapUv.x) * (1. - step(.5, vMapUv.y));
float value = clamp(dot(grain.rgb, vec3(.2126,.7152,.0722)) / uBridgeWoodMean, .55, 1.5);
diffuseColor.rgb *= mix(1., value, woodPixel);
#endif`);
};
structWoodMat.customProgramCacheKey = () => 'prop-rock-contact-v7-struct-wood-grain';

// Solid tools use the existing wood atlas without leaf-card lighting or double-sided shadows.
const miningToolMat=propMat.clone();miningToolMat.map=atlasTex2;miningToolMat.onBeforeCompile=propShader;miningToolMat.customProgramCacheKey=()=> 'solid-mining-tools-v1';
const PROP_MATS = { wallTorch: TDWallTorch.fixtureMaterial, carved: carvedMat, rock: rockMat, stone: masonMat, cards: cardMat, cards2: cardMat2, foliage: foliageMat, ice: iceMat, snow: snowMat, gloss: glossMat };
const CAP = 8000;
// plants with touch: true bend away from the hero in walk mode (per-instance attribute 'touch', see updateTouch)
const TOUCH_GLSL = `// bent away from the hero (touch.xy = world-space bend of the top in m, touch.z = 1 / mesh height); base stays put
{ vec2 tb=touch.xy; float bb=dot(tb,tb); if(bb>0.){ float hk=pow(clamp(position.y*touch.z,0.,1.),1.6); mat3 im=mat3(instanceMatrix); transformed+=transpose(im)*(vec3(tb.x,-bb*.8,tb.y)*hk)/dot(im[0],im[0]); } }`;
const touchMats = new Map();
function touchMat(base) {
  if (!touchMats.has(base)) {
    if(base.userData.sharedWeighted){touchMats.set(base,TDPineWind.touchMaterial(base));return touchMats.get(base);}
    const m = base.clone(); m.defines = { ...(base.defines || {}), TOUCH: '' };
    if (base.onBeforeCompile === propShader) { m.onBeforeCompile = propShader; m.customProgramCacheKey = () => base.customProgramCacheKey() + '-touch'; }
    else {   // shared assets (props/shared): the same material, plus the bend
      m.userData.touchVertex = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 touch;').replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n' + TOUCH_GLSL + '\n#endif'); };
      m.onBeforeCompile = sh => { base.onBeforeCompile(sh); m.userData.touchVertex(sh); };
      m.customProgramCacheKey = () => 'shared-touch/' + base.name;
    }
    touchMats.set(base, m);
  }
  return touchMats.get(base);
}
const propMeshes = PROP.map(t => {
  const source = t.mineCart ? TDMineCart.material() : t.mineRail ? TDMineRails.material() : t.sharedAsset ? TDSharedProps.material(t.sharedAsset) : t.id==='miningtools'?miningToolMat:PROP_MATS[t.material] || propMat;
  const base = t.id==='obsidian'?TDObsidianReflection.material(source):TDChestSurface.ids.includes(t.id)?TDChestSurface.material(source,t.id,timeU,hemi) : t.surface ? TDSmallPropSurface.material(source,t.surface) : TDFibreFinish.ids.includes(t.id)?TDFibreFinish.material(source,t.id) : t.material==='chestmetal' ? TDChestSeries.material(t.id,timeU,hemi) : source;
  const m = new THREE.InstancedMesh(t.geo, t.touch ? touchMat(base) : base, CAP);
  if(t.sharedAsset&&TDSharedProps.asset(t.sharedAsset).rootGrounding){m.userData.rootSlope=new THREE.InstancedBufferAttribute(new Float32Array(CAP*2),2);t.geo.setAttribute('rootSlope',m.userData.rootSlope);m.userData.rootTerrain=new THREE.InstancedBufferAttribute(new Float32Array(CAP*4),4);t.geo.setAttribute('rootTerrain',m.userData.rootTerrain);}
  if (t.touch) { m.userData.touch = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage); t.geo.setAttribute('touch', m.userData.touch); }
  m.castShadow = m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  if(t.sharedAsset&&(t.sharedAsset==='pine'||TDSharedProps.asset(t.sharedAsset).wind)){m.customDepthMaterial=TDPineWind.shadowMaterial(m.material);m.customDistanceMaterial=TDPineWind.shadowMaterial(m.material,true);}
  if(t.id==='treasurechest_gold'){m.customDepthMaterial=TDChestSurface.shadowMaterial(t.id);m.customDistanceMaterial=TDChestSurface.shadowMaterial(t.id,false,true);}
  if (t.canopy) m.receiveShadow = false;   // lumpy canopies shadow themselves in patches; their soft normals already shade them (and it is cheaper)
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
  if (m.material === rockMat) { m.userData.cliffI = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1); t.geo.setAttribute('cliffI', m.userData.cliffI); }
  scene.add(m); return m;
});
const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: 0, flatShading: true, transparent: true, opacity: .28, depthWrite: false });
// faded cards: the cut-out test runs after the fade (opacity .28), so it must sit below .42 × .28 or every leaf would vanish
const ghostCardMat = ghostMat.clone(); ghostCardMat.map = atlasTex; ghostCardMat.alphaTest = .1; ghostCardMat.side = THREE.DoubleSide;
const ghostCardMat2 = ghostCardMat.clone(); ghostCardMat2.map = atlasTex2;
const ghostMeshes = PROP.map(t => {
  const root=t.sharedAsset&&TDSharedProps.asset(t.sharedAsset).rootGrounding,g=root?(()=>{const g=new THREE.BufferGeometry();g.setIndex(t.geo.index);for(const[name,a]of Object.entries(t.geo.attributes))g.setAttribute(name,a);g.boundingBox=t.geo.boundingBox;g.boundingSphere=t.geo.boundingSphere;return g;})():t.geo;
  const m = new THREE.InstancedMesh(g, t.sharedAsset ? TDSharedProps.material(t.sharedAsset, true) : t.material === 'cards' ? ghostCardMat : t.material === 'cards2' ? ghostCardMat2 : t.surface ? TDSmallPropSurface.material(ghostMat,t.surface) : ghostMat, 256);
  if(root){m.userData.rootSlope=new THREE.InstancedBufferAttribute(new Float32Array(256*2),2);g.setAttribute('rootSlope',m.userData.rootSlope);m.userData.rootTerrain=new THREE.InstancedBufferAttribute(new Float32Array(256*4),4);g.setAttribute('rootTerrain',m.userData.rootTerrain);}
  m.frustumCulled = false; m.count = 0; m.renderOrder = 8;
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(256 * 3), 3);
  scene.add(m); return m;
});
let ghosts = new Set();   // props currently faded because the player is inside them
const VIS_R = PROP.map(t => t.vis);
// 'common' parts appear under every biome in the palette
for (const t of PROP) {
  const sw = t.sway ?? 0;
  if (sw) t.geo.setAttribute('sway', new THREE.Float32BufferAttribute(new Float32Array(t.geo.attributes.position.count).fill(sw), 1));
}   // visual footprint per prop type (x scale)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
// a small pool of real lights follows the glowing parts nearest to the view
const glowLights = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xffaa55, 0, 10, 1.7); l.userData.base = 0; scene.add(l); return l; });
let glowTick = 0;
const wallTorches = TDWallTorch.create(scene);
const chestPresentation = TDChestPresentation.create(scene,timeU);
function updateGlowLights(cx, cz) {
  const cand = [];
  for (const p of props) { const L = PROP[p[0]].light; if (!L) continue; const d = (p[1] - cx) ** 2 + (p[2] - cz) ** 2; if (d < 1600) cand.push([d, p]); }
  for (const q of tunnelLamps) { const d = (q.x - cx) ** 2 + (q.z - cz) ** 2; if (d < 1600) cand.push([d, null, q]); }   // the tunnels' torches and lanterns
  cand.sort((a, b) => a[0] - b[0]);
  glowLights.forEach((l, k) => {
    const c = cand[k]; if (!c) { l.userData.base = 0; l.intensity = 0; return; }
    if (!c[1]) { const q = c[2]; l.color.setHex(q.color); l.userData.base = 2.4; l.position.set(q.x, q.y, q.z); return; }
    const p = c[1], L = PROP[p[0]].light;
    l.color.setHex(L[0]); l.userData.base = L[1] * p[4]; l.position.set(p[1], heightAt(p[1], p[2]) + L[2] * p[4], p[2]);
  });
}
// ---- plants the hero brushes through (touch: true): each one is a damped spring. The hero's overlap pushes its top
// away (and a little along the walk), and when the hero leaves it swings back with a few fading wobbles.
// Visual only: walkability, saving and the export do not change.
const touchIdx = new Map(), touchState = new Map();   // prop -> instance index / spring { bx, bz, vx, vz, push }
let touchProps = [], touchPrev = null;
const touchGrid=new Map(),TOUCH_CELL=4,touchStats={registered:0,candidates:0,active:0,lastMs:0};
function touchCell(x,z){return Math.floor(x/TOUCH_CELL)+','+Math.floor(z/TOUCH_CELL);}
function indexTouch(p){const t=PROP[p[0]],cfg=t.sharedAsset?TDSharedProps.asset(t.sharedAsset).contact:null,radius=(cfg?cfg.radius:t.vis*.6)*p[4];for(let x=Math.floor((p[1]-radius)/TOUCH_CELL);x<=Math.floor((p[1]+radius)/TOUCH_CELL);x++)for(let z=Math.floor((p[2]-radius)/TOUCH_CELL);z<=Math.floor((p[2]+radius)/TOUCH_CELL);z++){const key=x+','+z;if(!touchGrid.has(key))touchGrid.set(key,[]);touchGrid.get(key).push(p);}}
const TOUCH_K = 70, TOUCH_DAMP = 4.2;   // stiffness (1/s²) and damping (1/s): about 1.3 swings a second, fading in ~1.5 s
function writeTouch(p, st) {
  const a = propMeshes[p[0]].userData.touch, i = touchIdx.get(p) * 3;
  a.array[i] = st.bx; a.array[i + 1] = st.bz; a.array[i + 2] = 1 / Math.max(PROP[p[0]].meshTop, .05); a.needsUpdate = true;
}
function updateTouch(dt) {
  const started=performance.now();touchStats.candidates=0;
  const play = state.mode === 'play' && hero.visible;
  if (!play) { if (touchState.size) { for (const [p, st] of touchState) { st.bx = st.bz = 0; writeTouch(p, st); } touchState.clear(); } touchPrev = null;touchStats.active=0;touchStats.lastMs=performance.now()-started; return; }
  const h = Math.min(dt, 1 / 30), r0 = state.agent.radius;
  let mvx = 0, mvz = 0;
  if (touchPrev && dt > 0) { mvx = (player.x - touchPrev.x) / dt; mvz = (player.z - touchPrev.z) / dt; }
  touchPrev = { x: player.x, z: player.z };
  const speed=Math.hypot(mvx,mvz),mv=speed>20?0:speed, mdx = mv > .1 ? mvx / mv : 0, mdz = mv > .1 ? mvz / mv : 0;
  const candidates=new Set();for(let x=Math.floor((player.x-r0)/TOUCH_CELL);x<=Math.floor((player.x+r0)/TOUCH_CELL);x++)for(let z=Math.floor((player.z-r0)/TOUCH_CELL);z<=Math.floor((player.z+r0)/TOUCH_CELL);z++)for(const p of touchGrid.get(x+','+z)||[])candidates.add(p);touchStats.candidates=candidates.size;
  for (const p of candidates) {
    const t = PROP[p[0]], contact=t.sharedAsset?TDSharedProps.asset(t.sharedAsset).contact:null, R = (contact?contact.radius:t.vis*.6)*p[4]+r0, dx = p[1] - player.x, dz = p[2] - player.z;
    if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
    const d = Math.hypot(dx, dz); if (d >= R) continue;
    const baseY=p[7]??(heightAt(p[1],p[2])-(t.groundSink||0)),scaleY=p[4]*(p[6]??1);if(contact&&(baseY+contact.minY*scaleY>=player.y+state.agent.height||baseY+contact.maxY*scaleY<=player.y))continue;
    let st = touchState.get(p); if (!st) touchState.set(p, st = { bx: 0, bz: 0, vx: 0, vz: 0, push: null });
    const o = 1 - d / R, nx = d > .05 ? dx / d : mdx, nz = d > .05 ? dz / d : mdz, max = contact?Math.min(.3,contact.maxDisplacementMetres*p[4]):Math.min(.45, .38 * t.meshTop * p[4] * (p[6] ?? 1));st.motion=!!contact;st.max=max;
    // push out of the way, plus drag along the walk while the hero moves
    st.push = contact?[...TDPineWind.target(dx,dz,R,mvx,mvz,max),max]:[(nx * .8 + mdx * .45 * Math.min(1, mv / 3)) * o * max * 1.6, (nz * .8 + mdz * .45 * Math.min(1, mv / 3)) * o * max * 1.6, max];
  }
  for (const [p, st] of touchState) {
    const tx = st.push ? st.push[0] : 0, tz = st.push ? st.push[1] : 0;
    if(st.motion){const rest=TDPineWind.advance(st,tx,tz,st.max,dt);st.push=null;writeTouch(p,st);if(rest)touchState.delete(p);continue;}
    st.vx += (TOUCH_K * (tx - st.bx) - TOUCH_DAMP * st.vx) * h; st.vz += (TOUCH_K * (tz - st.bz) - TOUCH_DAMP * st.vz) * h;
    st.bx += st.vx * h; st.bz += st.vz * h;
    const b = Math.hypot(st.bx, st.bz), max = st.push ? st.push[2] : .45; if (b > max) { st.bx *= max / b; st.bz *= max / b; }
    const rest = !st.push && b < .002 && Math.hypot(st.vx, st.vz) < .01;
    st.push = null;
    if (rest) { st.bx = st.bz = 0; writeTouch(p, st); touchState.delete(p); } else writeTouch(p, st);
  }
  touchStats.active=touchState.size;touchStats.lastMs=performance.now()-started;
}
const cliffFits=new TDCliffFits.Store(PROP,sha256);
function cliffInputSignature(heights=H,waterfalls=falls,water=state.water,size=SIZE){return sha256(new Uint8Array(heights.buffer))+'/'+sha256(new TextEncoder().encode(JSON.stringify([waterfalls,water,size])));}
function effectiveGeometry(p){return cliffFits.effectiveGeometry(p);}
function refreshCliffFits(visualOnly=false){if(!visualOnly){const stale=cliffFits.synchronize(cliffInputSignature(),props);if(stale)toast('地形または岩を変更したため、密着加工を解除しました。岩を自動配置で更新できます。');}for(const c of cliffFits.cache.values())if(c.mesh)c.mesh.visible=false;}
function cliffTintAt(x,z){const v=.86+.28*hash2(x*97|0,z*89|0);return[v*(.95+.1*hash2(x*13|0,7)),v,v*(.95+.1*hash2(3,z*17|0))];}
function savedCliffTint(p){return cliffFits.valid(p)?cliffFits.records.get(p[8]).instanceTint:null;}
function drawCliffFit(p,matrix,color,ghost){const c=cliffFits.get(p);if(!c)return false;const record=cliffFits.records.get(p[8]);if(record.affine){if(!c.affine)c.affine=new THREE.Matrix4().fromArray(record.affine);matrix.multiply(c.affine);return false;}if(!c.mesh){const g=c.geometry;g.setAttribute('cliffI',new THREE.InstancedBufferAttribute(new Float32Array([cliffIndexNear(p[1],p[2])]),1));const m=new THREE.InstancedMesh(g,propMeshes[p[0]].material,1);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(3),3);m.castShadow=m.receiveShadow=true;m.frustumCulled=false;c.mesh=m;scene.add(m);}const m=c.mesh;m.material=ghost?ghostMat:propMeshes[p[0]].material;m.renderOrder=ghost?8:0;m.visible=true;m.setMatrixAt(0,matrix);m.setColorAt(0,color);m.instanceMatrix.needsUpdate=m.instanceColor.needsUpdate=true;c.geometry.attributes.cliffI.array[0]=cliffIndexNear(p[1],p[2]);c.geometry.attributes.cliffI.needsUpdate=true;return true;}
function makeFittedFootprint(p,c){if(c.footprint)return c.footprint;const g=c.geometry.clone(),P=g.attributes.position;for(let i=0;i<P.count;i++){const w=TDCliffContact.world(p,[P.getX(i),P.getY(i),P.getZ(i)]);P.setXYZ(i,w[0]-p[1],w[1],w[2]-p[2]);}g.computeBoundingBox();const f=shapeFootprint({geo:g,sharedAsset:true});for(let j=0;j<f.nz;j++)for(let i=0;i<f.nx;i++){const k=j*f.nx+i;if(f.top[k]>-1e8)f.top[k]-=heightAt(p[1]+f.x0+i*SHAPE_CELL,p[2]+f.z0+j*SHAPE_CELL);}const box=g.boundingBox;f.R=Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z)));c.y0=box.min.y;c.y1=box.max.y;g.dispose();return c.footprint=f;}

// A bounded local plane moves only the root collar. Recomputed on placement/terrain rebuild, never per vertex/frame.
function rootSlopeAt(p){const t=PROP[p[0]],a=t.sharedAsset&&TDSharedProps.asset(t.sharedAsset);if(!a?.rootGrounding||p[7]!=null)return[0,0];const d=.5,x=p[1],z=p[2],gx=(heightAt(x+d,z)-heightAt(x-d,z))/(2*d),gz=(heightAt(x,z+d)-heightAt(x,z-d))/(2*d),n=Math.hypot(gx,gz),k=n>a.rootGrounding.maxSlope?a.rootGrounding.maxSlope/n:1;return[gx*k,gz*k];}
// 地面の塗りを配置時だけ調べる。未対応素材は色の混合を無効にする。
function rootTerrainAt(p){const x=p[1],z=p[2],t=PROP[p[0]],supported=groundTrial.value>0&&TDGroundData.biomes.includes(state.biome),other=[1,2,4,5,6,7,8,9].reduce((s,c)=>s+splatAt(x,z,c),0),coverage=supported?Math.max(0,1-other):0,dirt=splatAt(x,z,0),rubble=splatAt(x,z,3),grass=Math.max(0,1-dirt-rubble),baseY=p[7]??heightAt(x,z)-(t.groundSink||0);const total=Math.max(1,dirt+rubble+grass);return[dirt*coverage/total,rubble*coverage/total,grass*coverage/total,heightAt(x,z)-baseY];}
const groundedNormal=new Map(),groundedGhost=new Map();
function propBaseY(p){const t=PROP[p[0]];return p[7]??(heightAt(p[1],p[2])-(t.groundSink??(t.sharedAsset?0:p[0]===2?.12*p[4]:.05)));}
function groundedParts(p){return propGrounding.get(p,PROP[p[0]].geo,PROP[p[0]].groundSink??.001);}
function groundedMeshes(type,ghost,needed){
 const map=ghost?groundedGhost:groundedNormal,old=map.get(type);if(old&&old[0].instanceMatrix.count>=needed)return old;
 const capacity=Math.min(ghost?256:CAP,Math.max(16,2**Math.ceil(Math.log2(needed)))),t=PROP[type];
 const meshes=TDPropGrounding.parts(t.geo).map((part,i)=>{const m=new THREE.InstancedMesh(part.geometry,t.surface?TDSmallPropSurface.material(ghost?ghostMat:PROP_MATS[t.material]||propMat,t.surface):ghost?ghostMat:TDFibreFinish.material(t.id==='miningtools'?miningToolMat:PROP_MATS[t.material]||propMat,t.id),capacity);m.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);m.frustumCulled=false;m.count=0;m.castShadow=m.receiveShadow=!ghost;m.renderOrder=ghost?8:0;if(old){m.instanceMatrix.array.set(old[i].instanceMatrix.array);m.instanceColor.array.set(old[i].instanceColor.array);scene.remove(old[i]);old[i].dispose();}scene.add(m);return m;});map.set(type,meshes);return meshes;
}
function rebuildProps(visualOnly = false) {
  if(!visualOnly)TDMineRails.invalidate();
  refreshCliffFits(visualOnly);
  glowTick = 0;
  const cnt = PROP.map(() => 0), gcnt = PROP.map(() => 0);
  touchIdx.clear(); touchProps = [];touchGrid.clear();
  for (const p of props) {
    const [t, x, z, r, s] = p, sy = p[6] ?? 1, by = p[7] ?? null, ghost = ghosts.has(p) && gcnt[t] < 256;
    const mesh = ghost ? ghostMeshes[t] : propMeshes[t], c = ghost ? gcnt : cnt;
    if (c[t] >= CAP) continue;
    // Shared meshes have an explicit ground pivot; their catalog yaw offset applies to visuals too.
    const shared = PROP[t].sharedAsset;
    if(PROP[t].geo.userData.groundParts){const v=.86+.28*hash2(x*97|0,z*89|0),color=_c.setRGB(v*(.95+.1*hash2(x*13|0,7)),v,v*(.95+.1*hash2(3,z*17|0))),fit=groundedParts(p),meshes=groundedMeshes(t,ghost,c[t]+1);meshes.forEach((m,i)=>{m.setMatrixAt(c[t],fit.matrices[i]);m.setColorAt(c[t],color);});c[t]++;continue;}
    _p.set(x, propBaseY(p), z);
    _q.setFromAxisAngle(_up, r - (shared ? PROP[t].yawOffset * Math.PI / 180 : 0)); _s.set(s, s * sy, s);
    _m.compose(_p, _q, _s);
    const fitColor=(()=>{const v=.86+.28*hash2(x*97|0,z*89|0);return savedCliffTint(p)?_c.fromArray(savedCliffTint(p)):_c.setRGB(v*(.95+.1*hash2(x*13|0,7)),v,v*(.95+.1*hash2(3,z*17|0)));})();
    if(drawCliffFit(p,_m,fitColor,ghost))continue;
    mesh.setMatrixAt(c[t], _m);
    if(mesh.userData.rootSlope){const v=rootSlopeAt(p);mesh.userData.rootSlope.setXY(c[t],v[0],v[1]);mesh.userData.rootSlope.needsUpdate=true;mesh.userData.rootTerrain.setXYZW(c[t],...rootTerrainAt(p));mesh.userData.rootTerrain.needsUpdate=true;}
    const v = .86 + .28 * hash2(x * 97 | 0, z * 89 | 0);
    mesh.setColorAt(c[t], (shared || PROP[t].mineCart || PROP[t].mineRail || PROP[t].roomTorch || PROP[t].fireEffect) ? _c.setRGB(1, 1, 1) : savedCliffTint(p)?_c.fromArray(savedCliffTint(p)):_c.setRGB(v * (.95 + .1 * hash2(x * 13 | 0, 7)), v, v * (.95 + .1 * hash2(3, z * 17 | 0))));
    if (!ghost && mesh.userData.cliffI) mesh.userData.cliffI.array[c[t]] = cliffIndexNear(x, z);
    if (!ghost && mesh.userData.touch) { touchIdx.set(p, c[t]); touchProps.push(p);indexTouch(p); }
    c[t]++;
  }
  for (const m of propMeshes) if (m.userData.touch) { m.userData.touch.array.fill(0); m.userData.touch.needsUpdate = true; }
  for (const [p, st] of touchState) if (touchIdx.has(p)) writeTouch(p, st); else touchState.delete(p);
  propMeshes.forEach((m, t) => { m.count = PROP[t].geo.userData.groundParts?0:cnt[t]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; if (m.userData.cliffI) m.userData.cliffI.needsUpdate = true; });
  ghostMeshes.forEach((m, t) => { m.count = PROP[t].geo.userData.groundParts?0:gcnt[t]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
  for(const[map,counts]of [[groundedNormal,cnt],[groundedGhost,gcnt]])for(const[t,meshes]of map)for(const m of meshes){m.count=counts[t];m.instanceMatrix.needsUpdate=m.instanceColor.needsUpdate=true;}
  if (props.some(p => PROP[p[0]].roomTorch||PROP[p[0]].fireEffect||TDChestPresentation.slots(PROP[p[0]].id).length)) ensureIds();
  wallTorches.sync(props, PROP, propBaseY, state.roomId);
  chestPresentation.sync(props,PROP,propMeshes,ghosts);
  touchStats.registered=touchProps.length;
  if(state.tool==='detail')syncGroundDetailUI();
  if (!visualOnly) { colliders = null; walkDirty = true; }
}
function fittedFootprint(p){const c=cliffFits.get(p);return c?makeFittedFootprint(p,c):null;}

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
  const T = TIMES[timeId(state.timeOfDay)];
  sun.color.setHex(state.sunOn ? (T.sun ?? B.sun) : B.sun);
  hemi.color.setHex(state.sunOn ? (T.sky ?? B.sky) : B.sky);
  hemi.groundColor.setHex(state.sunOn ? (T.ground ?? B.ground) : B.ground);
  sun.position.set(...T.position);
  waterMat.uniforms.uSun.value.copy(sun.position).normalize();
  waterTimeTint.value.set(...(state.sunOn ? T.water : [1,1,1]));
  moonStrength.value = state.sunOn && timeId(state.timeOfDay)==='night' ? Math.max(0,1-(1-light)*1.5) : 0;
  sun.intensity = state.sunOn ? B.sunI * T.direct * light : 0; sun.visible = state.sunOn;   // off: no sun and no sun shadows (caves)
  const D = state.sunOn ? null : DARK_LEVELS[state.darkness] || DARK_LEVELS.dark;
  weatherHemi = hemi.intensity = B.hemi * (.55 + .45 * light) * (D ? D.hemi : T.ambient);
  fill.visible = !!D && D.fill > 0; fill.intensity = D ? D.fill * light : 0; fill.color.setHex(B.sun);   // fill: absolute intensity in the biome's light colour
  BU.uWind.value.set(WIND_DIR.x, WIND_DIR.y, on ? (W.wind || 0) * k : 0);
  waterMat.uniforms.uWaveH.value = .38 + .55 * Math.min(1, on ? (W.wind || 0) * k : 0);   // sea waves grow with the wind
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
  if ($('sunOn')) { $('sunOn').checked = state.sunOn; $('darkRow').hidden = state.sunOn; $('darkness').value = state.darkness; }
  if ($('timeOfDay')) { $('timeOfDay').value=timeId(state.timeOfDay); $('timeOfDay').disabled=!state.sunOn; }
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
for (const m of [waterMat,springMat,fallMat,foamMat,streamMat]) {
  m.uniforms.uTimeLightTint=waterTimeTint;
  m.fragmentShader='uniform vec3 uTimeLightTint;\n'+m.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= mix(uTimeLightTint,vec3(1.),step(.5,uLava));\n#include <tonemapping_fragment>');
}
for (const m of [waterMat,springMat]) m.fragmentShader=m.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb += moonLight;\n#include <tonemapping_fragment>');

const fallDir = f => [-Math.sin(f.rot), -Math.cos(f.rot)];   // uphill direction (toward the source)
// the placed falls, and the springs' streams falling down a cliff as the same kind of band (foot x, z; width w; rot facing downstream)
function fallBands() {
  if (!springRes || !springRes.falls.length) return falls;
  return falls.concat(springRes.falls.map(f => ({ x: f.foot[0], z: f.foot[1], w: f.width, rot: Math.atan2(f.dir[0], f.dir[1]), spring: true })));
}
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
function fallGeometry(w, hgt, lean, f) {
  const SY = f ? 24 : 12, g = new THREE.PlaneGeometry(w, 1, 6, SY), p = g.attributes.position;
  const half = v => w / 2 * (1 + .18 * (1 - v)), lzAt = v => -lean * Math.pow(v, 2.5);   // v: 0 bottom .. 1 top
  // with a fall f, the sheet follows the gorge: at each height it narrows (each side on its own) where the rock at or just
  // in front of it stands above the water, so the cliff sides never cut through the falling water
  let fit = null;
  if (f) {
    const c = Math.cos(f.rot), sn = Math.sin(f.rot), ground = (lx, lz) => heightAt(f.x + lx * c + lz * sn, f.z - lx * sn + lz * c);
    // the drawn triangles of a steep face can stand above the interpolated height, so look a little around the point
    const buried = (lx, lz, y) => Math.max(ground(lx, lz), ground(lx, lz + .3), ground(lx - .2, lz + .15), ground(lx + .2, lz + .15)) > f.bottom + y - .02;
    // the edge between two rows is straight, so a row also keeps clear of the rock halfway down to the next one
    const side = (v, sd) => { const h0 = half(v), y = v * hgt, lz = lzAt(v); let h = h0; while (h > h0 * .3 && (buried(sd * h, lz, y) || buried(sd * h, lz, y - hgt / SY / 2))) h -= .05; return h / h0; };
    const raw = [0, 1].map(q => Array.from({ length: SY + 1 }, (_, r) => side(1 - r / SY, q ? 1 : -1)));   // row 0 = top
    // a sudden step in width bends the soft edge into a notch that reads as a rock spike: smooth the outline, never wider than the gap
    // (erode by 2 rows, then average over 2 rows: every averaged value is at most the raw width of this row)
    const win = (a, r, n, fn) => fn(a.slice(Math.max(0, r - n), r + n + 1));
    fit = raw.map(a => { const e = a.map((_, r) => win(a, r, 2, x => Math.min(...x))); return e.map((_, r) => win(e, r, 2, x => x.reduce((s, v) => s + v, 0) / x.length)); });
  }
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + .5, r = Math.round((1 - v) * SY), k = fit ? fit[p.getX(i) < 0 ? 0 : 1][r] : 1;
    p.setXYZ(i, p.getX(i) * (1 + .18 * (1 - v)) * k, v * hgt, lzAt(v));
  }
  g.computeVertexNormals(); return g;
}
// water wears its rock smooth: no derived relief (terrain/cliff-relief.js) behind a falling sheet, beside it or under
// its lip, so the rock skin cannot poke through the water. 1 = full relief, fading to 0 within the fall's band.
function fallReliefMask(x, z) {
  let k = 1;
  for (const f of fallBands()) {
    const [ux, uz] = fallDir(f), ax = x - f.x, az = z - f.z, along = ax * ux + az * uz, lat = Math.abs(ax * uz - az * ux), w = f.w * .6;
    k = Math.min(k, Math.max(sstep(w + .5, w + 1.5, lat), sstep(3, 4, along), sstep(-1.5, -2.5, along)));
  }
  if (tunnelPrep.length) k = Math.min(k, sstep(0, 1, tunnelBandDist(x, z)));   // the rock around a tunnel's mouth stays smooth
  return k;
}
// where a spring's stream drops down a cliff (springs.js falls): the same falling sheet, foam and mist as a placed waterfall
const springFallGroup = new THREE.Group(); scene.add(springFallGroup);
function rebuildSpringFalls() {
  for (const c of [...springFallGroup.children]) { if (c.geometry) c.geometry.dispose(); if (c.isSprite) c.material.dispose(); springFallGroup.remove(c); }
  if (!springRes) return;
  for (const f of springRes.falls) {
    // the sheet stands in the plunge pool (foot) and arcs back up to the lip, leaving the cliff face behind it: the water
    // leaves the lip moving forward and falls clear of the rock
    // its top a little in front of the lip and just under the stream's surface, so the rounded cliff edge cannot hide the sheet
    // while its top edge shows over the ground
    const hgt = f.top - f.bottom, w = Math.max(f.width * 1.1, .6), rot = Math.atan2(f.dir[0], f.dir[1]), x = f.foot[0] + f.dir[0] * .15, z = f.foot[1] + f.dir[1] * .15, lean = clamp(f.lean - .2, .25, 1.4);
    if (hgt < .6) continue;
    const m = new THREE.Mesh(fallGeometry(w, hgt - .02, lean), fallMat); m.position.set(x, f.bottom - .04, z); m.rotation.y = rot; m.renderOrder = 3; springFallGroup.add(m);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.6, w * 1.3), foamMat);   // the rings on the water (uFalls) carry the rest
    foam.rotation.set(-Math.PI / 2, 0, rot); foam.position.set(x + f.dir[0] * .2, f.bottom + .03, z + f.dir[1] * .2); foam.renderOrder = 4; springFallGroup.add(foam);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: .35 }));
    mist.position.set(x + f.dir[0] * .3, f.bottom + w * .45, z + f.dir[1] * .3); mist.userData = { mist: true, base: w * 2.4, ph: x * 3.1 }; mist.scale.setScalar(w * 2.4); mist.renderOrder = 5; springFallGroup.add(mist);
  }
}
// a placed waterfall follows the ground after it is reshaped: its foot comes down when the pool under it is dug (down to the
// water when it reaches it) and goes up when it is filled, and its lip follows the cliff top. Measured the way placeFall did
// (the lowest ground 0..3 m downhill of the cliff point, 1 m uphill of the foot; the highest 0..3 m uphill of it)
function refitFalls() {
  let changed = false;
  for (const f of falls) {
    const [ux, uz] = fallDir(f); let lo = Infinity, hi = -Infinity;
    for (let d = 0; d <= 3 + 1e-9; d += .25) { lo = Math.min(lo, heightAt(f.x + ux * (1 - d), f.z + uz * (1 - d))); hi = Math.max(hi, heightAt(f.x + ux * (1 + d), f.z + uz * (1 + d))); }
    const bottom = Math.max(lo, state.water), top = f.sx !== undefined ? hi + .04 : hi - .05;
    if (Math.abs(bottom - f.bottom) > .01) { f.bottom = bottom; changed = true; }
    if (Math.abs(top - f.top) > .15) { f.top = top; changed = true; }
  }
  if (changed) rebuildFalls();
  return changed;
}
function rebuildFalls() {
  scheduleWater(); if (typeof cliffRelief !== 'undefined') scheduleCliffRelief();
  for (const c of [...fallGroup.children]) { if (c.geometry) c.geometry.dispose(); fallGroup.remove(c); }
  for (const f of falls) {
    if (f.sx !== undefined) { const st = new THREE.Mesh(streamGeometry(f), streamMat); st.renderOrder = 3; fallGroup.add(st); }
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: .4 }));
    mist.position.set(f.x + Math.sin(f.rot) * .5, f.bottom + f.w * .45, f.z + Math.cos(f.rot) * .5);
    mist.userData = { mist: true, base: f.w * 2.4, ph: f.x * 3.1 }; mist.scale.setScalar(f.w * 2.4); mist.renderOrder = 5; fallGroup.add(mist);
    const hgt = f.top - f.bottom; if (hgt < .3) continue;
    const m = new THREE.Mesh(fallGeometry(f.w, hgt + .15, .8, f), fallMat);
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
const FALL_CLEARS = new Set(['rock', 'cliff', 'cliff_split', 'cliff_shoulder', 'cliff_joint', 'cliff_slab', 'cliff_talus']);
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
  // clear the boulders and every cliff-stone part whose outline reaches the sheet of water
  const behindFall = (px, pz) => { const ax = px - x, az = pz - z, along = ax * c.ux + az * c.uz, lat = Math.abs(ax * c.uz - az * c.ux); return lat < w * .5 + .25 && along > -2 && along < 1.6; };
  props = props.filter(p => !(FALL_CLEARS.has(PROP[p[0]].id) && (behindFall(p[1], p[2]) || cliffWorldHull(p).some(([hx, hz]) => behindFall(hx, hz)))));
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
const BRIDGE_ARCH = { wood: [.06, .7], log: [0, 0], stone: [.03, .45], arch: [.2, 2.4], straight: [0, 0], vine: [-.09, 1.8], sus: [-.05, 1.0], pier: [0, 0] };
// a pier (桟橋) runs from the land out over the water and ends there: its deck climbs over the first PIER_RAMP m to PIER_DECK m
// above the still water (clear of the surf) and stays level to its end, which needs no landing
const PIER_DECK = .9, PIER_RAMP = 2;
const BRIDGE_TYPES = [['wood', '木の橋'], ['log', '割った丸太'], ['stone', '石の橋'], ['arch', 'アーチ橋'], ['straight', 'まっすぐな橋'], ['vine', 'ツタのつり橋'], ['sus', '丈夫なつり橋'], ['pier', '桟橋']];
const STAIR_TYPES = [['dirt', '土の階段'], ['stone', '石の階段'], ['wood', '木の階段'], ['built', '人工物の階段']];
const BRIDGE_TAGS = {
  wood: ['grassland', 'forest', 'canyon', 'mountain', 'beach'], log: ['forest', 'jungle'],
  stone: ['mountain', 'canyon', 'ruins', 'castle', 'desert', 'volcano', 'cave', 'demon', 'graveyard'], arch: ['castle', 'ruins', 'grassland', 'demon'],
  straight: ['castle', 'cave'], vine: ['jungle', 'canyon'], sus: ['canyon', 'mountain', 'snow'], pier: ['beach', 'grassland', 'forest', 'jungle', 'mountain', 'snow'],
};
const STAIR_TAGS = { dirt: ['grassland', 'forest', 'jungle', 'canyon', 'mountain', 'beach'], stone: ['common'], wood: ['forest', 'cave', 'beach', 'snow', 'jungle'], built: ['ruins', 'castle', 'desert', 'demon', 'graveyard'] };
// ground paint tools; tools not listed here (terrain, structures, walkability) are always shown
const GTOOL_TAGS = {
  grass: ['common'], dirt: ['common'], bedrock: ['common'], pureblack: ['common'], cobble: ['grassland', 'ruins', 'castle', 'desert', 'graveyard'], sand: ['desert', 'beach', 'canyon', 'wasteland'],
  rubble: ['wasteland', 'mountain', 'canyon', 'volcano', 'cave', 'ruins', 'desert', 'graveyard'], swamp: ['forest', 'jungle', 'demon', 'cave', 'graveyard'], poison: ['demon', 'jungle', 'cave', 'volcano'],
  lava: ['volcano', 'demon'], snowfield: ['snow', 'mountain'], ice: ['snow', 'mountain', 'cave'], coast: ['beach'],
};
const inPalette = tags => state.palette === 'all' || tags.includes('common') || tags.includes(state.palette);
const propVisible = i => !PROP[i].legacyOnly && inPalette(PROP[i].tags);
// 地形・地面の道具は小物パレットで隠さない。材質の選択肢を失わせない。
const toolVisible = id => true;
function bridgeProfile(b) {
  const L = Math.hypot(b.x2 - b.x1, b.z2 - b.z1);
  if (b.type === 'pier') {   // starts on the land (x1, z1), climbs over the ramp, level out over the water
    const y1 = Math.max(heightAt(b.x1, b.z1), state.water) + .12, y2 = Math.max(y1, state.water + PIER_DECK), tr = Math.min(.5, PIER_RAMP / Math.max(L, 1e-3));
    const y = t => t >= tr ? y2 : lerp(y1, y2, sstep(0, tr, t)), e = 1e-3;
    return { L, y1, y2, arch: 0, ramp: tr * L, y, dy: t => (y(Math.min(1, t + e)) - y(Math.max(0, t - e))) / (Math.min(1, t + e) - Math.max(0, t - e)) };
  }
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

// UVs only: point the existing wood grain along each component's longest axis.
// The positions, normals, colours, random sequence and walk profile stay intact.
function bridgeWoodUV(parts, wood, dark) {
  parts.forEach((p, index) => {
    if (p.cfn !== wood && p.cfn !== dark) return;
    const b = p.g.parameters, dims = [b.width, b.height, b.depth];
    if (!dims.every(v => Number.isFinite(v) && v > 0)) return;
    const axis = dims.indexOf(Math.max(...dims)), other = [0,1,2].filter(k => k !== axis);
    const pos = p.g.attributes.position, normal = p.g.attributes.normal, uv = p.g.attributes.uv;
    const scale = .48 + hash2(index, 71) * .38, offset = hash2(index, 83) * (1. - scale);
    for (let i = 0; i < uv.count; i++) {
      const xyz = [pos.getX(i), pos.getY(i), pos.getZ(i)], n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
      const cross = Math.abs(n[other[0]]) < Math.abs(n[other[1]]) ? other[0] : other[1];
      uv.setXY(i, .12 + (xyz[cross] / dims[cross] + .5) * .76, offset + (xyz[axis] / dims[axis] + .5) * scale);
    }
    p.uvr = TDGeo.ATLAS2.uvr('wood');
  });
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
  bridgeWoodUV(parts, wood, dark);
  return makeGeo(parts, 31, { uv: TDGeo.ATLAS2.white });
}
// 桟橋：横に並べた板の床、その下に縦の桁、約 1.8m ごとに 2 本の杭（上に梁、間に筋交い）。杭は水の中が藻で暗く、
// 水際がフジツボで白く、上は風雨で灰色がかった木。先端に係留柱とロープ、片側に水へ下りるはしご。陸の端は石の土台。
function geoBridgePier(b) {
  const K = bridgeKit(b), { L, at, pitch, pr } = K, w = b.w, W = state.water, R = rng(((b.x1 * 97 + b.z1 * 31) * 100) | 0), parts = [];
  const wood = (y, ny, Rr, p2) => mixc(col(0x7b6853), col(0xb5a48c), clamp(p2 * .7 + (ny > .7 ? .25 : 0) + (Rr() - .5) * .2, 0, 1));
  const dark = (y, ny, Rr) => mixc(col(0x463a2d), col(0x6a5844), Rr() * .6 + (ny > .7 ? .3 : 0));
  const pile = (y, ny, Rr) => y < W - .06 ? mixc(col(0x26321f), col(0x45512f), Rr()) : y < W + .28 ? mixc(col(0x75776b), col(0xb9b5a3), Rr()) : mixc(col(0x54473a), col(0x7a6853), Rr());
  // deck planks across, with small gaps, and three stringers under them following the deck
  const n = Math.max(6, Math.round(L / .3));
  for (let k = 0; k < n; k++) {
    const t = (k + .5) / n, [x, y, z] = at(t, (R() - .5) * .04, 0);
    parts.push({ g: new THREE.BoxGeometry(w * (.97 + R() * .06), .07, L / n * .86), m: mat4o(x, y, z, 1, 1, 1, K.ry + (R() - .5) * .025, pitch(t)), cfn: wood, j: .07 });
  }
  const segs = Math.max(4, Math.ceil(L / .8));
  for (const lat of [-(w / 2 - .14), 0, w / 2 - .14]) for (let k = 0; k < segs; k++) beam(parts, at(k / segs, lat, -.13), at((k + 1) / segs, lat, -.13), .12, .17, dark, .05);
  // bents: two piles each, a cap beam on them, cross braces between them where they stand tall
  const t0 = Math.max(.06, Math.min(.5, (pr.ramp || 0) / L)), m = Math.max(1, Math.round((1 - t0) * L / 1.8));
  for (let k = 0; k <= m; k++) {
    const t = t0 + (1 - t0) * k / m, deck = pr.y(t), end = k === m, feet = [];
    for (const sd of [-1, 1]) {
      const [x, , z] = at(t, sd * (w / 2 + .04), 0), bed = heightAt(x, z) - .35, top = end ? deck + .62 : deck - .05, h = top - bed;
      if (h < .25) continue;
      parts.push({ g: new THREE.CylinderGeometry(.11, .12, h, 8, Math.max(3, Math.round(h / .2))), m: mat4(x, bed + h / 2, z, 1, 1, 1), cfn: pile, j: .08 });
      feet.push([x, bed, z]);
      if (end) parts.push({ g: new THREE.CylinderGeometry(.13, .13, .05, 8), m: mat4(x, top + .02, z, 1, 1, 1), cfn: dark, j: .05 });   // a cap on the mooring post
    }
    beam(parts, at(t, -(w / 2 + .16), -.3), at(t, w / 2 + .16, -.3), .18, .16, dark, .05);
    if (feet.length === 2 && deck - Math.max(feet[0][1], feet[1][1]) > 1.1) {
      const lo = Math.max(W - .25, Math.max(feet[0][1], feet[1][1]) + .3), hi = deck - .42;
      if (hi - lo > .3) { beam(parts, [feet[0][0], hi, feet[0][2]], [feet[1][0], lo, feet[1][2]], .08, .1, dark, .05); beam(parts, [feet[0][0], lo, feet[0][2]], [feet[1][0], hi, feet[1][2]], .08, .1, dark, .05); }
    }
  }
  // a mooring rope wound round one end post
  { const [x, y, z] = at(1, -(w / 2 + .04), .4); parts.push({ g: new THREE.TorusGeometry(.14, .035, 5, 14), m: mat4(x, y, z, 1, 1, 1, 0, Math.PI / 2), cfn: C_ROPE, j: .08 }); }
  // a ladder down into the water on the far right corner
  {
    const [x, y, z] = at(1, w / 2 + .1, 0), bot = Math.max(heightAt(x, z) + .1, W - .6), top = y + .35, side = [K.dx * .2, K.dz * .2];
    for (const s of [-1, 1]) beam(parts, [x + side[0] * s - K.dx * .3, bot, z + side[1] * s - K.dz * .3], [x + side[0] * s - K.dx * .3, top, z + side[1] * s - K.dz * .3], .05, .05, dark, .04);
    for (let yy = bot + .2; yy < top - .1; yy += .3) beam(parts, [x - side[0] - K.dx * .3, yy, z - side[1] - K.dz * .3], [x + side[0] - K.dx * .3, yy, z + side[1] - K.dz * .3], .04, .04, dark, .04);
  }
  // the stone footing the deck starts from on the land
  { const [x, y, z] = at(0, 0, -.3); parts.push({ g: displace(new THREE.BoxGeometry(w + .5, .5, .9, 2, 1, 1), .08, x + z), m: mat4(x, y, z, 1, 1, 1, K.ry), cfn: C_STONE, j: .08 }); }
  bridgeWoodUV(parts, wood, dark);
  return makeGeo(parts, 33, { uv: TDGeo.ATLAS2.white });
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
  if (type === 'pier') return geoBridgePier(b);
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
  for (const b of bridges) { const m = new THREE.Mesh(geoBridge(b), ['wood', 'pier'].includes(b.type || 'wood') ? structWoodMat : structMat); m.castShadow = m.receiveShadow = true; bridgeGroup.add(m); }
  walkDirty = true;
}
function placeBridge(a, c, w, type = 'wood') {
  if (type === 'log') w = Math.min(w, 1.1); else if (type === 'vine') w = Math.min(w, 1.8);
  const L = Math.hypot(c.x - a.x, c.z - a.z);
  if (L < 2 || L > 26) return false;
  if (type === 'pier' && heightAt(c.x, c.z) > heightAt(a.x, a.z)) [a, c] = [c, a];   // a pier starts on the higher (land) end
  const b = { x1: a.x, z1: a.z, x2: c.x, z2: c.z, w, type };
  // clear anything standing on the deck
  props = props.filter(p => { const d = distToPolyline(p[1], p[2], [[b.x1, b.z1], [b.x2, b.z2]]); return d > w / 2 + .3 + (p[0] === 4 ? .6 : PROP[p[0]].r * p[4]); });
  bridges.push(b); rebuildBridges(); rebuildProps();
  return true;
}
// ---------- pools: a kerb of dressed stone standing on the ground and holding water above it (the floor inside is levelled
// and paved). Their water is a fixed pond for springs.js: a spring inside makes it overflow through the notch in its kerb.
const POOL_TYPES = [['rect', '四角いプール'], ['round', '丸いプール']];
const poolGroup = new THREE.Group(); scene.add(poolGroup);
const poolWaterGroup = new THREE.Group(); scene.add(poolWaterGroup);
// matching points along a pool's outline, d metres in from its outer edge (negative: out from it); blocks of about seg metres
function poolRing(p, d, seg) {
  const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, a = Math.abs(p.x2 - p.x1) / 2, b = Math.abs(p.z2 - p.z1) / 2, pts = [];
  if (p.type === 'round') {
    const n = Math.max(20, Math.ceil(Math.PI * (a + b) / seg));
    for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2; pts.push([cx + Math.cos(t) * (a - d), cz + Math.sin(t) * (b - d)]); }
    return pts;
  }
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let s = 0; s < 4; s++) {
    const [u0, v0] = C[s], [u1, v1] = C[(s + 1) % 4], len = s % 2 ? 2 * b : 2 * a, n = Math.max(1, Math.round(len / seg));
    for (let k = 0; k < n; k++) { const t = k / n, u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t; pts.push([cx + u * (a - d), cz + v * (b - d)]); }
  }
  return pts;
}
// a solid block between two edges of the kerb (outer a→b, inner c←d), from y0 to y1, faces turned outward
function kerbBlock(o0, o1, i1, i0, y0, y1) {
  const q = [o0, o1, i1, i0], P = [], mx = (o0[0] + o1[0] + i0[0] + i1[0]) / 4, mz = (o0[1] + o1[1] + i0[1] + i1[1]) / 4, my = (y0 + y1) / 2;
  const tri = (A, B, Cc) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx_ = Cc[0] - A[0], vy = Cc[1] - A[1], vz = Cc[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx_ - ux * vz, nz = ux * vy - uy * vx_, fx = (A[0] + B[0] + Cc[0]) / 3 - mx, fy = (A[1] + B[1] + Cc[1]) / 3 - my, fz = (A[2] + B[2] + Cc[2]) / 3 - mz;
    if (nx * fx + ny * fy + nz * fz < 0) P.push(...A, ...Cc, ...B); else P.push(...A, ...B, ...Cc);
  };
  const T = q.map(([x, z]) => [x, y1, z]), B = q.map(([x, z]) => [x, y0, z]);
  tri(T[0], T[1], T[2]); tri(T[0], T[2], T[3]); tri(B[0], B[2], B[1]); tri(B[0], B[3], B[2]);
  for (let s = 0; s < 4; s++) { const e = (s + 1) % 4; tri(B[s], B[e], T[e]); tri(B[s], T[e], T[s]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g;
}
function poolNotch(p) { const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2; let t = 0; while (poolDist(p, cx + p.ox * t, cz + p.oz * t) < 0 && t < 20) t += .02; return [cx + p.ox * t, cz + p.oz * t]; }
function geoPool(p) {
  const R = rng(((p.x1 * 97 + p.z1 * 31) * 100) | 0), parts = [], lv = poolLevel(p), [nx, nz] = poolNotch(p);
  const O = poolRing(p, 0, .7), I = poolRing(p, POOL_WALL, .7), CO = poolRing(p, -.04, .7), CI = poolRing(p, POOL_WALL + .03, .7), n = O.length;
  const stone = () => { const v = R(); return mixc(col(0x7f7a70), col(0xb2aa9a), v); };
  for (let k = 0; k < n; k++) {
    const e = (k + 1) % n, mx = (O[k][0] + O[e][0]) / 2, mz = (O[k][1] + O[e][1]) / 2, notch = Math.hypot(mx - nx, mz - nz) < .45;
    const top = notch ? lv - .1 : p.rim - .07, c1 = stone(), c2 = mixc(col(0xc4bcab), col(0xd9d1bf), R());
    // the wall reaches 0.35 m into the ground, so it meets uneven ground outside without a gap
    parts.push({ g: kerbBlock(O[k], O[e], I[e], I[k], p.floor - .35, top), m: new THREE.Matrix4(), c: c1, j: .06 });
    parts.push({ g: kerbBlock(CO[k], CO[e], CI[e], CI[k], top, notch ? lv - .02 : p.rim), m: new THREE.Matrix4(), c: c2, j: .05 });   // coping stones, a little proud of the wall
  }
  return makeGeo(parts, 131);
}
// the water inside: one flat sheet a little under the kerb all round
function poolWaterGeo(p) {
  const pts = poolRing(p, POOL_WALL - .06, .5), lv = poolLevel(p), cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, P = [cx, lv, cz], ix = [];
  for (const [x, z] of pts) P.push(x, lv, z);
  for (let k = 0; k < pts.length; k++) ix.push(0, 1 + (k + 1) % pts.length, 1 + k);
  const g = new THREE.BufferGeometry(), n = pts.length + 1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('depth', new THREE.Float32BufferAttribute(new Float32Array(n).fill(lv - p.floor), 1));
  g.setAttribute('shore', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4)); g.setAttribute('shore2', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setIndex(ix); return g;
}
function rebuildPoolWater() {
  for (const c of [...poolWaterGroup.children]) { c.geometry.dispose(); poolWaterGroup.remove(c); }
  if (BIOME().lava) return;
  for (const p of pools) { const m = new THREE.Mesh(poolWaterGeo(p), springMat); m.renderOrder = 2; poolWaterGroup.add(m); }
}
function rebuildPools() {
  for (const c of [...poolGroup.children]) { c.geometry.dispose(); poolGroup.remove(c); }
  for (const p of pools) { const m = new THREE.Mesh(geoPool(p), structMat); m.castShadow = m.receiveShadow = true; poolGroup.add(m); }
  rebuildPoolWater(); walkDirty = true;
}
// footing on a pool's kerb: its top, where the body (margin = its radius) fits on it — the kerb is narrower than the hero, so it blocks
function poolWallAt(x, z, margin = 0) {
  for (const p of pools) { const d = poolDist(p, x, z); if (d <= -margin && d >= -POOL_WALL + margin) return p.rim; }
  return null;
}
function placePool(a, c, type) {
  const p = { id: newId('pool'), type: type === 'round' ? 'round' : 'rect', x1: +Math.min(a.x, c.x).toFixed(2), z1: +Math.min(a.z, c.z).toFixed(2), x2: +Math.max(a.x, c.x).toFixed(2), z2: +Math.max(a.z, c.z).toFixed(2) };
  const w = p.x2 - p.x1, l = p.z2 - p.z1;
  if (w < 1.6 || l < 1.6) return '角から角へ、1.6m 以上の大きさにドラッグしてください';
  if (w > 16 || l > 16) return '一辺 16m までにしてください';
  if (BIOME().lava) return '溶岩のバイオームではプールを作れません';
  if (Math.min(p.x1, p.z1) < -HALF + 1 || Math.max(p.x2, p.z2) > HALF - 1) return '地図の端から 1m 以上内側に作ってください';
  if (pools.some(q => q.x1 < p.x2 + .3 && p.x1 < q.x2 + .3 && q.z1 < p.z2 + .3 && p.z1 < q.z2 + .3)) return 'ほかのプールと重なっています';
  let floor = Infinity;
  for (let z = p.z1; z <= p.z2 + 1e-6; z += .25) for (let x = p.x1; x <= p.x2 + 1e-6; x += .25) if (poolDist(p, x, z) <= 0) floor = Math.min(floor, heightAt(x, z));
  if (floor < state.water + .05) return '水の中には作れません（水位より上の地面に作ってください）';
  p.floor = +floor.toFixed(3); p.rim = +(floor + POOL_H).toFixed(3);
  // the notch faces the lowest ground just outside the kerb (the overflow runs off that way)
  const cx = (p.x1 + p.x2) / 2, cz = (p.z1 + p.z2) / 2, dirs = p.type === 'round' ? Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = Infinity;
  for (const [ux, uz] of dirs) { let t = 0; while (poolDist(p, cx + ux * t, cz + uz * t) < .6 && t < 20) t += .05; const h = heightAt(cx + ux * t, cz + uz * t); if (h < best - 1e-6) { best = h; p.ox = +ux.toFixed(4); p.oz = +uz.toFixed(4); } }
  // level the floor (and the ground under the kerb), and pave it
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = idx(i, j), d = poolDist(p, vx(i), vx(j)); if (d > .25) continue;
    H[k] = p.floor; SC[k] = 0;
    if (d <= 0) { for (let ch = 0; ch < NS; ch++) S[k * NS + ch] = 0; S[k * NS + 1] = 255; }
  }
  props = props.filter(q => poolDist(p, q[1], q[2]) > .3 + PROP[q[0]].r * q[4]);
  pools.push(p); rebuildPools(); applySprings(); rebuildProps();
  return null;
}
// ---------- tunnels (tunnels.js): dug sideways into hills and cliffs. The terrain keeps its heights; a tunnel is its own
// mesh (floor, walls, arched roof, the portal's face) and the terrain is left undrawn only at its mouths and cuttings.
// Inside, the one walking stands on the tunnel's floor; above its roof the ground is used (walkRef = the walker's height).
const TUNNEL_STYLES = Object.entries(TDTunnels.STYLES).map(([v, s]) => [v, s.name]);
let tunnelPrep = [], tunnelLamps = [], walkRef = null;
const tunnelGroup = new THREE.Group(); scene.add(tunnelGroup);
const tunnelLineGroup = new THREE.Group(); scene.add(tunnelLineGroup);
const tunnelHoleTex = (() => { const t = new THREE.DataTexture(new Uint8Array((N - 1) * (N - 1) * 4), N - 1, N - 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const tunnelHoleU = { value: tunnelHoleTex }, tunnelOnU = { value: 0 };
const tunnelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, side: THREE.DoubleSide });
// the look of each part (TDTunnels.MAT, per vertex): the cliff's own rock, masonry courses and flagstones from the tunnel's
// own coordinates (along, around), stone blocks, wood grain, trodden soil, iron, plants; +16 = moss on faces turned up.
// The vertex colour is the base colour (a brightness factor on rock); tDk darkens further in (less while the roof is cut away).
tunnelMat.onBeforeCompile = sh => {
  sh.uniforms.uCutA = cutU.a; sh.uniforms.uCutB = cutU.b; sh.uniforms.uStoneGrain = rockGrainU; sh.uniforms.uRockTint = BU.uRockTint; sh.uniforms.uDim = dimU;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN; varying vec2 vTUv; varying float vTDk; varying float vTMat; attribute vec2 tUv; attribute float tDk; attribute float tMat;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTW=(modelMatrix*vec4(transformed,1.)).xyz; vTN=normalize(mat3(modelMatrix)*objectNormal); vTUv=tUv; vTDk=tDk; vTMat=tMat;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTW; varying vec3 vTN; varying vec2 vTUv; varying float vTDk; varying float vTMat; uniform vec3 uRockTint; uniform float uDim;
${CUT_GLSL}
${GLSL_NOISE}
${STONE_SURFACE_GLSL}
${DIM_GLSL}
float gTH=0.;
vec3 tunnelAlbedo(vec3 c){
  float mm=floor(vTMat+.5),mossy=step(15.5,mm);mm=mod(mm,16.);
  vec3 p=vTW,n=normalize(vTN)*(gl_FrontFacing?1.:-1.);vec2 gr=stoneGrain(p,n);
  if(mm<.5){   // rock: the same rock as the terrain's cliffs
    vec2 rq=vec2((p.x*.75+p.z*.65)*1.1,p.y*1.5);
    float mineral=fbm(rq*2.7+vec2(3.,7.)),strata=fbm(vec2(p.y*2.2+fbm(rq*.35)*1.6,dot(rq,vec2(.4,.3))));
    c*=mix(vec3(.43,.41,.36),vec3(.65,.62,.55),mineral)*(.83+.20*strata)*(.80+.30*gr.x+.10*gr.y)*uRockTint;
    gTH=(gr.x-.5)*.014+(gr.y-.5)*.007;
  }else if(mm<1.5||(mm>4.5&&mm<5.5)){   // masonry courses (walls) and flagstones (floor): sunk joints, each stone its own shade
    vec2 sz=mm<1.5?vec2(.62,.4):vec2(.56,.46);float row=floor(vTUv.y/sz.y);
    vec2 q=vec2(vTUv.x/sz.x+row*.5+(mm>4.5?fract(sin(row*7.13)*91.7)*.6:0.),vTUv.y/sz.y),id=floor(q),f=fract(q),e=min(f,1.-f)*sz;
    float jt=min(e.x,e.y),joint=1.-smoothstep(.01,.032,jt+(gr.y-.5)*.02),h=fract(sin(dot(id,vec2(12.9898,78.233)))*43758.5453);
    c*=(.84+.28*h)*(.84+.22*gr.x+.08*gr.y);c=mix(c,c*.5,joint);
    gTH=-joint*.014+(gr.x-.5)*.007+smoothstep(.0,.1,jt)*.004;
  }else if(mm<2.5){c*=.82+.26*gr.x+.1*gr.y;gTH=(gr.x-.5)*.012+(gr.y-.5)*.005;}   // cut stone
  else if(mm<3.5){   // wood: grain along the timber, a few knots
    float g=fbm(vec2(vTUv.x*1.3,vTUv.y*17.)),k=smoothstep(.8,.9,vn(vTUv*vec2(3.,9.)));
    c*=(.76+.42*g)*(1.-.35*k);gTH=(g-.5)*.008;
  }else if(mm<4.5){   // trodden soil and small stones
    float d=fbm(p.xz*2.3),pb=smoothstep(.74,.86,vn(p.xz*13.));
    c*=.8+.36*d;c=mix(c,c*1.3+.03,pb*.6);gTH=(d-.5)*.012+pb*.008;
  }else if(mm<6.5){c*=.85+.2*gr.y;}   // iron
  else if(mm<7.5){c*=.78+.44*fbm(p.xz*5.+p.y*3.);}   // roots and vines
  if(mossy>.5){   // ruins: moss on the tops and in the floor's joints
    float mk=smoothstep(.35,.85,n.y)*smoothstep(.47,.62,fbm(p.xz*2.6+p.y*1.3));
    if(mm>4.5&&mm<5.5)mk=max(mk,smoothstep(.56,.74,fbm(p.xz*1.7))*.7);
    c=mix(c,vec3(.27,.36,.17)*(.8+.4*gr.x),mk*.85);
  }
  return c;
}`).replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(cutAway(vTW,true)) discard;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb=dimc(pow(tunnelAlbedo(vColor.rgb),vec3(2.2))*mix(1.,uCutA.w>0.?.4:.07,vTDk));')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=surfaceNormal(-vViewPosition,normal,gTH);');
};
tunnelMat.customProgramCacheKey = () => 'tunnel-v2';
const tunnelLampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
// the cut faces: shown as the sides of the cut-away (only the line of sight through them is cut)
const tunnelShaftMat = tunnelMat.clone(); tunnelShaftMat.onBeforeCompile = sh => { tunnelMat.onBeforeCompile(sh); sh.fragmentShader = sh.fragmentShader.replace('if(cutAway(vTW,true)) discard;', 'if(cutAway(vTW,false)) discard;'); };
tunnelShaftMat.customProgramCacheKey = () => 'tunnel-shaft-v2';
// the ground around a mouth, rebuilt finer with the opening left out (TDTunnels.cap): the terrain's own material, without its holes
const tunnelCapMat = terrainMat.clone(); tunnelCapMat.onBeforeCompile = terrainMat.onBeforeCompile;
tunnelCapMat.customProgramCacheKey = () => terrainMat.customProgramCacheKey() + '-tunnel-cap';
function tunnelCapGeometry(c) {
  const nv = c.tris.length / 2, names = Object.keys(tGeo.attributes).filter(n => n !== 'position' && n !== 'normal');
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), At = names.map(n => new Float32Array(nv * tGeo.attributes[n].itemSize));
  for (let o = 0; o < nv; o++) {
    const x = c.tris[o * 2], z = c.tris[o * 2 + 1], y = heightAt(x, z), e = .15, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e), l = Math.hypot(gx, 1, gz);
    P.set([x, y, z], o * 3); Nn.set([-gx / l, 1 / l, -gz / l], o * 3);
    // every other terrain attribute (paint, rock style, wetness…), bilinear on the grid like the terrain's own vertices
    const fx = clamp((x + HALF) * RES, 0, N - 1), fz = clamp((z + HALF) * RES, 0, N - 1), i = Math.min(Math.floor(fx), N - 2), j = Math.min(Math.floor(fz), N - 2), u = fx - i, w = fz - j, k = idx(i, j);
    names.forEach((n, a) => { const src = tGeo.attributes[n], s0 = src.itemSize; for (let ch = 0; ch < s0; ch++) { const g = (kk) => src.array[kk * s0 + ch]; At[a][o * s0 + ch] = (g(k) * (1 - u) + g(k + 1) * u) * (1 - w) + (g(k + N) * (1 - u) + g(k + N + 1) * u) * w; } });
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  names.forEach((n, a) => geo.setAttribute(n, new THREE.BufferAttribute(At[a], tGeo.attributes[n].itemSize)));
  return geo;
}
const tunnelLineMat = new THREE.LineDashedMaterial({ color: 0x8fe0ff, dashSize: .6, gapSize: .4, transparent: true, opacity: .85, depthTest: false });
function rebuildTunnels() {
  for (const c of [...tunnelGroup.children, ...tunnelLineGroup.children]) { c.geometry.dispose(); c.parent.remove(c); }
  tunnelPrep = TDTunnels.prepare(tunnels, heightAt); tunnelLamps = [];
  const hd = tunnelHoleTex.image.data; hd.fill(0);
  if (tunnelPrep.length) {
    const hl = TDTunnels.holes(tunnelPrep, heightAt, N, CELL, HALF); for (let k = 0; k < hl.length; k++) hd[k * 4] = hl[k] * 255;
    // G: the cells over a tunnel (cut away above the head of the one inside)
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) { const q = TDTunnels.query(tunnelPrep, vx(i) + CELL / 2, vx(j) + CELL / 2, .15); if (q && q.cls) hd[(j * (N - 1) + i) * 4 + 1] = 255; }   // inside the walls only
    const cp = TDTunnels.cap(tunnelPrep, heightAt, hl, N, CELL, HALF);
    if (cp.tris.length) {
      tunnelCapMat.defines = { ...(terrainMat.defines || {}), TUNNEL_CAP: '' }; tunnelCapMat.needsUpdate = true;
      const m = new THREE.Mesh(tunnelCapGeometry(cp), tunnelCapMat); m.castShadow = m.receiveShadow = true; tunnelGroup.add(m);
    }
    const g = TDTunnels.build(tunnelPrep, heightAt), part = s => s === 5 ? 1 : s === 6 ? 2 : 0;   // 0 rock/stone/timber, 1 lamps, 2 the cut faces (shafts)
    for (const which of [0, 1, 2]) {
      const tl = []; for (let t = 0; t < g.sub.length; t++) if (part(g.sub[t]) === which) tl.push(t);
      if (!tl.length) continue;
      const n = tl.length * 3, P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), Cc = new Float32Array(n * 3), Uv = new Float32Array(n * 2), Dk = new Float32Array(n), Mt = new Float32Array(n);
      tl.forEach((t, o) => { P.set(g.pos.subarray(t * 9, t * 9 + 9), o * 9); Nn.set(g.nor.subarray(t * 9, t * 9 + 9), o * 9); Cc.set(g.col.subarray(t * 9, t * 9 + 9), o * 9); Uv.set(g.uv.subarray(t * 6, t * 6 + 6), o * 6); Dk.set(g.dk.subarray(t * 3, t * 3 + 3), o * 3); Mt.fill(g.mat[t], o * 3, o * 3 + 3); });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); geo.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
      geo.setAttribute('tUv', new THREE.BufferAttribute(Uv, 2)); geo.setAttribute('tDk', new THREE.BufferAttribute(Dk, 1)); geo.setAttribute('tMat', new THREE.BufferAttribute(Mt, 1));
      const m = new THREE.Mesh(geo, [tunnelMat, tunnelLampMat, tunnelShaftMat][which]); m.castShadow = which === 0; m.receiveShadow = false; tunnelGroup.add(m);   // inside the hill: no sun shadow (tDk darkens it)
    }
    tunnelLamps = g.lamps;
    // the route on the ground while editing: a dashed line over the stretches under the hill
    for (const T of tunnelPrep) {
      const pts = T.st.map(q => new THREE.Vector3(q.x, Math.max(q.g, q.y + T.t.h) + .2, q.z));
      const geo = new THREE.BufferGeometry().setFromPoints(pts), l = new THREE.Line(geo, tunnelLineMat); l.computeLineDistances(); l.renderOrder = 7; tunnelLineGroup.add(l);
    }
  }
  tunnelHoleTex.needsUpdate = true; tunnelOnU.value = tunnelPrep.length ? 1 : 0;
  tunnelLineGroup.visible = state.mode === 'edit'; walkDirty = true;
  if (typeof cliffRelief !== 'undefined') scheduleCliffRelief();
}
// how far (m) outside the band of a tunnel's mouth or cutting (0 inside): no rock relief or cliff stone there
function tunnelBandDist(x, z) {
  let best = Infinity;
  for (const T of tunnelPrep) {
    const q = TDTunnels.nearest(T, x, z); if (!q || q.end && q.d > .5) continue;
    const S = T.st[q.k]; if (!S || S.cls === 0 || S.toOpen > 1.5) continue;
    best = Math.min(best, Math.max(Math.abs(q.lat) - (T.t.w / 2 + TDTunnels.WALL + .6), 0));
  }
  return best;
}
// dig: from a (a tunnel's end: carry on; a point on a tunnel: branch off; else a new mouth on the ground there) towards c
function placeTunnel(a, c) {
  if (BIOME().lava) return '溶岩のバイオームではトンネルを掘れません';
  const L = Math.hypot(c.x - a.x, c.z - a.z), sz = TDTunnels.SIZES[state.tunnelSize] || TDTunnels.SIZES.normal, slope = Math.tan((TDTunnels.SLOPES[state.tunnelSlope] || TDTunnels.SLOPES.flat).deg * Math.PI / 180);
  if (L < 1) return '1m 以上ドラッグしてください';
  if (Math.max(Math.abs(c.x), Math.abs(c.z), Math.abs(a.x), Math.abs(a.z)) > HALF - 1) return '地図の端から 1m 以上内側で掘ってください';
  let t = null, y0;
  for (const u of tunnels) {   // carry on from an end
    const P = u.pts, e0 = P[0], e1 = P[P.length - 1];
    if (Math.hypot(e1.x - a.x, e1.z - a.z) < Math.max(u.w / 2, 1)) { t = u; break; }
    if (Math.hypot(e0.x - a.x, e0.z - a.z) < Math.max(u.w / 2, 1)) { P.reverse(); t = u; break; }
  }
  let start = null;
  if (t) y0 = t.pts[t.pts.length - 1].y;
  else {
    const prep = TDTunnels.prepare(tunnels, heightAt);
    for (const T of prep) { const q = TDTunnels.nearest(T, a.x, a.z); if (q && Math.abs(q.lat) < T.t.w / 2 && !q.end) { start = { x: a.x, z: a.z, y: q.y, on: T, q }; break; } }   // a branch: moved onto the centre line below
    if (start) { const P = start.on.t.pts, q = start.q; let s0 = 0; for (let i = 0; i < P.length - 1; i++) { const L2 = Math.hypot(P[i + 1].x - P[i].x, P[i + 1].z - P[i].z); if (q.s <= s0 + L2 + 1e-9) { const u = (q.s - s0) / L2; start.x = P[i].x + (P[i + 1].x - P[i].x) * u; start.z = P[i].z + (P[i + 1].z - P[i].z) * u; break; } s0 += L2; } }
    y0 = start ? start.y : heightAt(a.x, a.z);
  }
  const from = t ? t.pts[t.pts.length - 1] : start || { x: a.x, z: a.z }, L1 = Math.hypot(c.x - from.x, c.z - from.z);
  let y1 = y0 + slope * L1;
  // out on the other side (the ground there no higher than half the tunnel above its floor): the floor meets the ground
  const w = t ? t.w : sz.w, h = t ? t.h : sz.h, gc = heightAt(c.x, c.z);
  if (gc < y1 + h * .5) { if (Math.abs(gc - y0) > TDTunnels.MAX_SLOPE * L1 + 1e-6) return '出口の地面との高さの差が大きすぎます（勾配 15° まで）'; y1 = gc; }
  if (Math.min(y0, y1) < state.water + .05) return '床が水位より低くなります';
  const pt = { x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +y1.toFixed(3) };
  if (t) t.pts.push(pt);
  else tunnels.push(t = { id: newId('tunnel'), style: state.variant.tunnel || 'rock', w: sz.w, h: sz.h, pts: [{ x: +from.x.toFixed(2), z: +from.z.toFixed(2), y: +y0.toFixed(3) }, pt] });
  rebuildTunnels(); paintTunnelMouths(t); clearTunnelProps(); rebuildProps();
  return null;
}
// the trodden ground before each mouth: soil (masonry: cobbles; ruins and caves fainter), fading out over about 2.5 m, ragged at the edges.
// Painted into the map's ground layers (so it is undone, saved and exported like any painting) and never lowered.
function paintTunnelMouths(t) {
  const T = TDTunnels.prepare([t], heightAt)[0]; if (!T) return;
  const ch = GROUND.indexOf(t.style === 'masonry' ? 'cobble' : 'dirt'), reach = 2.6, hw = t.w / 2, peak = t.style === 'ruins' ? .55 : t.style === 'cave' ? .5 : .85;
  for (let k = 0; k + 1 < T.st.length; k++) {
    const a = T.st[k], b = T.st[k + 1]; if (!!a.cls === !!b.cls) continue;   // a mouth: open ↔ cut or tunnel
    const m = a.cls ? b : a, o = a.cls ? 1 : -1;   // the open side's first station, and outward along the line
    forBrush(m.x + m.tx * o * reach / 2, m.z + m.tz * o * reach / 2, reach / 2 + hw + .8, (i, d, px, pz) => {
      const along = ((px - m.x) * m.tx + (pz - m.z) * m.tz) * o, lat = Math.abs((px - m.x) * m.nx + (pz - m.z) * m.nz), n = fbm(px * .9 + 3, pz * .9) - .5;
      const k1 = (1 - sstep(reach * .45, reach, along + n * .8)) * (1 - sstep(hw - .1 + along * .12, hw + .55 + along * .2, lat + n * .5)) * (along > -.6 ? 1 : 0);
      const want = k1 * peak, cur = TDTerrainPaint.weight(S, i * NS, NS, ch); if (want > cur + .01) TDTerrainPaint.paint(S, i * NS, NS, ch, (want - cur) / (1 - cur));
    });
  }
  updateTerrain(); regenGroundProps();
}
// the tunnels' meshes for the export (Unity frame): one vertex list with colours, triangles per submesh. The Unity z axis is
// the editor's mirrored, so every triangle is written in the reverse order to keep its front face
function tunnelMeshJson(te, P3, mn) {
  const g = te.mesh, V = [], Nn = [], Cc = [], subs = [...TDTunnels.SUBMESH, 'cap'], T = subs.map(() => []), R = TDTunnels.ROCK;
  // colours: sRGB like the editor's vertex colours (MapTunnels/Tunnel raises them to 2.2; the editor's surface patterns are not exported),
  // rock times the cliff rock's mean colour, darker further in
  const lin = (c, k) => Math.max(c, 0) * Math.pow(k, 1 / 2.2);
  for (let t = 0; t < g.sub.length; t++) {
    const b = V.length / 3, rock = (g.mat[t] & 15) === TDTunnels.MAT.rock;
    for (let q = 0; q < 3; q++) {
      const o = t * 9 + q * 3, k = 1 - .85 * g.dk[t * 3 + q];
      V.push(...P3(g.pos[o], g.pos[o + 1], g.pos[o + 2])); Nn.push(+g.nor[o].toFixed(3), +g.nor[o + 1].toFixed(3), +(-g.nor[o + 2]).toFixed(3));
      Cc.push(...[0, 1, 2].map(c => +lin(g.col[o + c] * (rock ? R[c] : 1), k).toFixed(4)));
    }
    T[g.sub[t]].push(b, b + 2, b + 1);
  }
  // the rebuilt ground around the mouths, coloured by its steepness (rock on the face, grass on top) — or use the terrain's layers
  const cp = te.cap, ci = subs.length - 1;
  for (let q = 0; q < cp.tris.length / 6; q++) {
    const b = V.length / 3, pts = [0, 1, 2].map(i => [cp.tris[q * 6 + i * 2], cp.tris[q * 6 + i * 2 + 1]]), ps = pts.map(([x, z]) => [x, te.thB(x, z), z]);
    const n = (() => { const a = ps[1].map((v, i) => v - ps[0][i]), c = ps[2].map((v, i) => v - ps[0][i]), x = a[1] * c[2] - a[2] * c[1], y = a[2] * c[0] - a[0] * c[2], z = a[0] * c[1] - a[1] * c[0], l = Math.hypot(x, y, z) || 1; return [x / l, Math.abs(y / l), z / l]; })();
    const steep = clamp((1 - n[1]) * 2.5, 0, 1), c = [lerp(.36, .52, steep), lerp(.46, .48, steep), lerp(.22, .42, steep)].map(v => lin(v, 1));
    ps.forEach(([x, y, z]) => { V.push(...P3(x, y, z)); Nn.push(+n[0].toFixed(3), +n[1].toFixed(3), +(-n[2]).toFixed(3)); Cc.push(...c.map(v => +v.toFixed(4))); });
    T[ci].push(b, b + 2, b + 1);
  }
  return { format: 'tdj-tunnel-mesh', version: 2, frame: 'Unity world, same as meta.json (m)', winding: 'clockwise front faces (Unity); the editor draws them double-sided',
    colors: 'sRGB (raise to 2.2 for the albedo, as MapTunnels/Tunnel does); rock already times its mean colour; darker further in from the mouth',
    note: 'floor / wall / ceiling / frame: vertex-coloured rock, stone and timber (lit); lamp: emissive (the light itself: meta.tunnels[].lamps); shaft: dark rock faces from the walls up to just under the ground, hidden in the hill until the roof is cut away (then cut only along the line of sight); decor: rocks, rubble, roots, vines and rails around the mouths (no collision); cap: the ground around a mouth over the terrain holes (holes.png -2), cut to the opening\'s outline',
    vertices: V, normals: Nn, colors: Cc, submeshes: subs.map((name, i) => ({ name, triangles: T[i] })) };
}
// nothing stands in a mouth or a cutting; no boulder or cliff stone around a mouth (by position or by its outline)
function clearTunnelProps() {
  const inCut = (x, z) => { const q = TDTunnels.query(tunnelPrep, x, z, -TDTunnels.WALL - .3); return q && (q.cls === 1 || q.toOpen < .8); };
  const n0 = props.length;
  props = props.filter(p => !(inCut(p[1], p[2]) || (FALL_CLEARS.has(PROP[p[0]].id) && (tunnelBandDist(p[1], p[2]) === 0 || cliffWorldHull(p).some(([hx, hz]) => tunnelBandDist(hx, hz) === 0)))));
  return props.length !== n0;
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
      for (const o of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]) S[k * NS + o] = Math.round(S[k * NS + o] * (1 - sw));
    }
  }
  state.sea = true;
  props = props.filter(p => heightAt(p[1], p[2]) > W + .15 || PROP[p[0]].id === 'reed' || PROP[p[0]].water || PROP[p[0]].shore || p[0] === TYPE('rock'));
  props = props.filter(p => !(PROP[p[0]].tree && splatAt(p[1], p[2], 2) > .5));
  applyBiome(state.biome); updateTerrain(); strandline(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs();
  return true;
}
// the strand of a sea beach: a few shells and bits of shell where the waves run up (the PROP 'shore' band); only on the sea's
// own beach, and never closer to other things than they allow. Wrack is not laid here: it is only placed by hand
function strandline() {
  const shells = ['scallop', 'cowrie', 'shellbits'].map(TYPE); if (shells.some(t => t < 0)) return;
  const sh = wGeo.attributes.shore.array, hash = buildPropHash(), W = state.water, step = .7;
  for (let z = -HALF + 1.5; z < HALF - 1.5; z += step) for (let x = -HALF + 1.5; x < HALF - 1.5; x += step) {
    const px = x + (hash2(x * 37 | 0, z * 53 | 0) - .5) * step, pz = z + (hash2(x * 71 | 0, z * 29 | 0) - .5) * step, h = heightAt(px, pz) - W, k = idx(clamp(Math.round((px + HALF) * RES), 0, N - 1), clamp(Math.round((pz + HALF) * RES), 0, N - 1));
    if (sh[k * 4 + 3] < .5 || h < -.05 || h > .45) continue;
    const r = hash2(px * 113 | 0, pz * 97 | 0), r2 = hash2(px * 59 | 0, pz * 131 | 0), t = r > .86 ? shells[(r2 * 3) | 0] : -1;
    if (t < 0 || !canPlace(t, px, pz, hash)) continue;
    const p = [t, px, pz, r2 * Math.PI * 2, lerp(PROP[t].sc[0], PROP[t].sc[1], r2), 0]; props.push(p); hash.add(p, px, pz);
  }
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
      if (k % 2 === 0) for (const sd of [-1, 1]) { const [sx, , sz] = at(tc, sd * (w / 2 + .28), 0); parts.push({ g: chisel(displace(new THREE.IcosahedronGeometry(1, 1), .2, k + sd), 5, 900 + k * 2 + sd, .65, .3), m: mat4(sx, top - .15, sz, .38 + R() * .15, .3 + R() * .15, .4, R() * 3), cfn: C_STONE, j: .1 }); }
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
  for (const st of stairs) { const m = new THREE.Mesh(geoStairs(st), structMat); m.castShadow = m.receiveShadow = true; stairGroup.add(m); }
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
// 主人公の見た目（hero/）：ゲームの体（Remy、hero/remy.js）と簡易の人形（geoHero）。見た目だけで、歩きの判定（state.agent）と書き出しには関わらない
const heroBox = new THREE.Mesh(geoHero(), heroMat);
heroBox.castShadow = true;
const heroBody = window.TDHero ? TDHero.build('remy') : null;   // null = hero/remy.js が無い（簡易の人形だけ）
const hero = new THREE.Group(); hero.add(heroBox); if (heroBody) hero.add(heroBody.group);
hero.visible = false; scene.add(hero);
const heroMats = [heroMat, ...(heroBody ? heroBody.mats : [])];
let heroLook = 'box';
function setHeroLook(v) {
  heroLook = heroBody && v === 'remy' ? 'remy' : 'box';
  heroBox.visible = heroLook === 'box'; if (heroBody) heroBody.group.visible = heroLook === 'remy';
  if ($('heroLook')) $('heroLook').value = heroLook;
}
// 岩の中（隠し通路）では透かして前に描く。毒の上では光らせる
function heroStyle(buried) {
  for (const m of heroMats) {
    m.depthTest = !buried; m.opacity = buried ? .62 : 1; m.emissive.setHex(buried ? 0x2a6a90 : 0x000000);
    if (m !== heroMat && m.transparent !== buried) { m.transparent = buried; m.needsUpdate = true; }   // Remy の部品は透かす時だけ透過（hero/hero.js）
  }
  hero.traverse(o => { if (o.isMesh) o.renderOrder = buried ? 10 : 0; });
}
function heroGlow(r, g, b) { for (const m of heroMats) m.emissive.setRGB(r, g, b); }
const spawnMarker = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xffcc33 }));
spawnMarker.rotation.x = Math.PI; scene.add(spawnMarker);
const player = { x: 0, z: 0, y: 0, face: 0, moving: 0, t: 0 };
// Footprint colliders for irregular solids (props with shape: true — rocks, cliff stones…): the outline of the mesh
// itself instead of circles, so the hero stops at the stone and passes where there is none. On a 5 cm grid in the
// prop's local frame (scale 1), top holds the mesh's highest point over each cell. Stone that rises more than
// SHAPE_MIN_H (m, world) above the ground is solid; per scale, dist holds each cell's distance to the nearest solid
// cell, so a body of radius r is blocked where dist * scale < r.
const SHAPE_CELL = .05, SHAPE_PAD = 1, SHAPE_MIN_H = .1;
function shapeFootprint(t) {
  const g = t.collisionGeo || t.geo; if(!g.boundingBox)g.computeBoundingBox(); const pos = g.attributes.position, ix = g.index, n = ix ? ix.count : pos.count, bb = g.boundingBox;
  const x0 = bb.min.x - SHAPE_PAD, z0 = bb.min.z - SHAPE_PAD, nx = Math.ceil((bb.max.x + SHAPE_PAD - x0) / SHAPE_CELL) + 1, nz = Math.ceil((bb.max.z + SHAPE_PAD - z0) / SHAPE_CELL) + 1;
  const top = new Float32Array(nx * nz).fill(-1e9), P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let f = 0; f < n; f += 3) {
    for (let q = 0; q < 3; q++) { const v = ix ? ix.getX(f + q) : f + q; P[q][0] = pos.getX(v); P[q][1] = pos.getY(v); P[q][2] = pos.getZ(v); }
    const [a, b, c] = P, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - x0) / SHAPE_CELL)), i1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0], c[0]) - x0) / SHAPE_CELL));
    const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2], c[2]) - z0) / SHAPE_CELL)), j1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], b[2], c[2]) - z0) / SHAPE_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 + i * SHAPE_CELL, z = z0 + j * SHAPE_CELL, k = j * nx + i;
      if (Math.abs(den) < 1e-12) { if (Math.hypot(x - a[0], z - a[2]) < SHAPE_CELL) top[k] = Math.max(top[k], a[1], b[1], c[1]); continue; }   // seen edge-on
      const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1;
      if (w0 >= -1e-6 && w1 >= -1e-6 && w2 >= -1e-6) top[k] = Math.max(top[k], w0 * a[1] + w1 * b[1] + w2 * c[1]);
    }
  }
  let R = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (top[j * nx + i] > 0) R = Math.max(R, Math.hypot(x0 + i * SHAPE_CELL, z0 + j * SHAPE_CELL));
  // non-shared props sit .05 m into the ground (see rebuildProps)
  return { x0, z0, nx, nz, top, R, sink: t.sharedAsset ? 0 : .05, fields: new Map() };
}
// distance field of a footprint for one scale (cached per 5 % step)
function shapeField(f, s) {
  const key = Math.round(s * 20); let d = f.fields.get(key); if (d) return d;
  if(f.fieldOnly)throw Error('この完成衝突の倍率は未準備です');
  const { x0, z0, nx, nz, top } = f, min = (SHAPE_MIN_H + f.sink) / (key / 20), solid = k => top[k] > min, edge = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (!solid(k)) continue;
    if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1 || !solid(k - 1) || !solid(k + 1) || !solid(k - nx) || !solid(k + nx)) edge.push(x0 + i * SHAPE_CELL, z0 + j * SHAPE_CELL);
  }
  const dist = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; if (solid(k)) continue;
    const x = x0 + i * SHAPE_CELL, z = z0 + j * SHAPE_CELL; let m = 1e18;
    for (let e = 0; e < edge.length; e += 2) { const dx = edge[e] - x, dz = edge[e + 1] - z; m = Math.min(m, dx * dx + dz * dz); }
    dist[k] = Math.sqrt(m);
  }
  f.fields.set(key, d = { dist, edge }); return d;
}
// distance (m, world) from a point to the stone of a placed shape collider c = [x, z, R, y0, y1, footprint, cos, sin, scale]
function shapeDist(c, x, z) {
  const f = c[5], s = c[8], F = shapeField(f, s), dx = x - c[0], dz = z - c[1], lx = (dx * c[6] - dz * c[7]) / s, lz = (dx * c[7] + dz * c[6]) / s;
  const i = Math.round((lx - f.x0) / SHAPE_CELL), j = Math.round((lz - f.z0) / SHAPE_CELL);
  if (i >= 0 && j >= 0 && i < f.nx && j < f.nz) return F.dist[j * f.nx + i] * s;
  let d = 1e9; for (let e = 0; e < F.edge.length; e += 2) d = Math.min(d, Math.hypot(F.edge[e] - lx, F.edge[e + 1] - lz));
  return d * s;
}
let colliders = null, colliderMaxR = 0;
function getColliders() {
  if (colliders) return colliders;
  colliders = new SpatialHash(4); colliderMaxR = 0;
  // each collider: [x, z, radius, bottom y, top y], plus [footprint, cos, sin, scale] for a shape collider (radius = its reach)
  const add = (x, z, r, y0, y1, ...shape) => { const c = [x, z, r, y0, y1, ...shape]; c.prop = cur; colliders.add(c, x, z); colliderMaxR = Math.max(colliderMaxR, r); };
  let cur = null;   // the prop each collider belongs to (null for floor-link solids)
  for (const p of props) {
    const t = PROP[p[0]], r = t.r * p[4]; if (r <= 0) continue; cur = p;
    const fitted=fittedFootprint(p);if(fitted){const c=cliffFits.get(p);add(p[1],p[2],fitted.R,c.y0,c.y1,fitted,1,0,1);continue;}
    const y0 = p[7] ?? heightAt(p[1], p[2]), y1 = y0 + t.height * p[4] * (p[6] ?? 1);
    if (t.footprint) { const a = p[3] - (t.sharedAsset ? t.yawOffset * Math.PI / 180 : 0); add(p[1], p[2], t.footprint.R * p[4], y0, y1, t.footprint, Math.cos(a), Math.sin(a), p[4]); }
    else if (t.offs) for (const [ox, oz] of t.offs) { const c = Math.cos(p[3]), sn = Math.sin(p[3]); add(p[1] + (ox * c + oz * sn) * p[4], p[2] + (-ox * sn + oz * c) * p[4], r, y0, y1); }
    else add(p[1], p[2], r, y0, y1);
  }
  cur = null;
  for (const m of markers) if (isLink(m.kind)) { const sp = LINK_SPEC[m.kind], y0 = heightAt(m.x, m.z); for (const [lx, lz, r] of sp.solid) { const q = linkLocal(m, lx, lz); add(q.x, q.z, r, y0, y0 + sp.height); } }
  return colliders;
}
// the generators keep a map edge entrance's landing free: every solid prop whose stone or collider reaches the circle the
// hero arrives in (the same circle the validation checks) is taken away
function clearPortLandings() {
  const out = new Set(), ag = state.agent;
  for (const m of markers) {
    if (m.kind !== 'port') continue;
    const L = portLanding(m), r = (m.r || 1.5) + ag.radius;
    getColliders().query(L.x, L.z, r + colliderMaxR, c => { if (c.prop && (c[5] ? shapeDist(c, L.x, L.z) : Math.hypot(c[0] - L.x, c[1] - L.z) - c[2]) < r) out.add(c.prop); });
  }
  if (out.size) { props = props.filter(p => !out.has(p)); colliders = null; walkDirty = true; }
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
  if (pools.length) { const y = poolWallAt(x, z, margin); if (y !== null) return { y, kind: 'pool' }; }
  if (tunnelPrep.length) { const q = TDTunnels.query(tunnelPrep, x, z, margin); if (q && (walkRef === null || walkRef < q.y + q.h - .3)) return { y: q.y, kind: 'tunnel' }; }   // above its roof (walkRef) the ground
  if (markers.length) { const y = linkDeckAt(x, z, margin); if (y !== null) return { y, kind: 'stairs' }; }
  return null;
}
// no collider within the agent's radius; with a deck height, only colliders overlapping [y, y + agent height] count
function bodyClear(x, z, y) {
  const ag = state.agent; let ok = true;
  getColliders().query(x, z, ag.radius + colliderMaxR, c => {
    if (ok && Math.hypot(c[0] - x, c[1] - z) - c[2] < ag.radius && (!c[5] || shapeDist(c, x, z) < ag.radius) && (y === undefined || (c[4] > y + .05 && c[3] < y + ag.height))) ok = false;
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
  if (waterAt(x, z) - heightAt(x, z) > state.agent.maxWaterDepth) return false;   // the map's water, or a spring's pond or pool
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
  const ref = walkRef; walkRef = null;   // the walk view and the export: inside a tunnel its floor wins
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
  walkDirty = false; walkRef = ref;
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
  const w = viewW(), h = viewH();   // the page's own size (turned 90° on some phones)
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // keep the scene centred in the area not covered by the edit panel
  if (state.mode === 'edit' && w > 700 && view.panel) camera.setViewOffset(w, h, -139, 0, w, h); else camera.clearViewOffset();
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
  { id: 'grass', name: '草原', key: '6', hint: '土・石畳・砂・荒れ地などを消して草地へ戻します。バイオームを変えても、この塗装は変わりません。' },
  { id: 'dirt', name: '土', key: '7', hint: '土の道を塗ります。' },
  { id: 'cobble', name: '石畳', key: '8', hint: '石畳を塗ります。' },
  { id: 'sand', name: '砂地', key: 'z', hint: '風紋のある砂地を塗ります。歩くと少し遅くなります（×0.85）。' },
  { id: 'rubble', name: '荒れ地', key: 'x', hint: 'ひび割れた乾いた地面に石が転がる荒れ地を塗ります。塗り終えると小石が自動で散らばります（×0.8）。' },
  { id: 'bedrock', name: '岩盤', key: 'j', hint: '片理・細い亀裂・白い鉱物脈のある灰色の岩盤を塗ります。地形の高さは変わりません。' },
  { id: 'pureblack', name: '完全な黒', key: '', hint: '照明・影・反射・霧に影響されない不透明な黒い床を塗ります。地形や歩行は変わりません。' },
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
  { id: 'bridge', name: '橋', key: 'b', hint: '岸から岸へドラッグすると橋を架けます（幅＝半径の半分、1.6〜4m）。種類は下の「種類」から。桟橋は、陸から水の上へドラッグします（先は水の上で終わります）。Shift+クリックで近くの橋を消します。' },
  { id: 'spring', name: '水源', key: '@', hint: 'クリックした所から水が湧きます。湧出量は下の「湧出量」から（しずく・小川・泉・大きな泉）。平らな所では湧出量に合った広さまで丸く広がり、坂では低い方へ小川になって流れます（川床の溝は自動で掘ります）。くぼみは池になり、満ちるといちばん低い縁からあふれて流れ続けます。水源をクリックすると湧出量を今の種類に変えます。Shift+クリックで近くの水源を消します。' },
  { id: 'pool', name: 'プール', key: ':', hint: '角から角へドラッグすると、石の縁で囲んだプールを地面の上に作ります（四角・丸は下の「プールの形」から、1.6〜16m）。中の床は平らにならして石畳にし、水は縁の 10cm 下まで張ります。中に水源を置くと、外の地面がいちばん低い側のあふれ口から小川が流れ出ます。Shift+クリックで近くのプールを消します。' },
  { id: 'tunnel', name: 'トンネル', key: '^', hint: '崖や斜面の前の地面から、山の中へドラッグすると横に掘ります。床の高さは入口の地面と同じ。掘った先の端からまたドラッグすると続きを掘り（曲がり角になります）、トンネルの途中からドラッグすると枝分かれします。反対側の地面まで掘ると出口になり、床がその地面に合わせて上り下りします（15° まで）。見た目は下の「見た目」、幅と高さは「大きさ」、中の上り下りは「勾配」から。トンネルの上でカーソルを合わせると、屋根を透かして中が見えます。Shift+クリックで近くのトンネルを消します。' },
  { id: 'fall', name: '滝', key: '=', hint: '崖をクリックすると、縁から水面へ落ちる滝を置きます（幅＝半径の半分）。Shift+クリックで近くの滝を消します。' },
  { id: 'place', name: '置く', key: 'p', hint: '「種類」で選んだ物をクリックで配置。Ctrl＋ホイールで大きさ、Q／Eで15°回転、Rで45°回転。' },
  { id: 'detail', name: '地表小物を調整', key: ';', hint: '草・花・小石・落ち葉をクリックして選び、下の欄で位置・向き・大きさを調整。Shift＋クリックで選んだ小物を移動します。調整した物は自動更新でも残ります。' },
  { id: 'pick', name: '選んで消す', key: 'o', hint: 'カーソルを合わせると赤く囲まれた物（木・岩・橋・階段・滝など）を、クリックで1つ消します。' },
  { id: 'marker', name: 'マーカー', key: 't', hint: '出入口・敵の候補・宝箱の候補・戦闘/出現禁止範囲を置きます。出入口は、置く場所から部屋の内側へドラッグ（クリックだけなら中央向き）。幅＝半径の半分。禁止範囲の大きさ＝半径。Shift+クリックで近くのマーカーを消します。' },
  { id: 'cliffpaint', name: '岩壁を塗る', key: '.', hint: '崖の面と岩・崖石の種類を、場所ごとに塗り分けます。「マップの既定」で塗ると、バイオーム欄の「岩壁」の設定に戻ります。平らな地面を塗っても見た目は変わりません（崖と岩にだけ効きます）。' },
  { id: 'link', name: '階層移動', key: ',', hint: '魔法陣・上り階段・下り階段を置きます。置く場所から、プレイヤーが近づいてくる側へドラッグすると向きが決まります（クリックだけなら部屋の中央向き）。タグには行き先（例: B2, 上の階）を入れます。Shift+クリックで近くの物を消します。歩くモードで触れると表示が出ます。' },
  { id: 'spawn', name: '開始地点', key: 'Home', hint: 'クリックした場所を、歩くモードの開始地点にします。' },
  { id: 'walkOn', name: '通行可', key: 'g', hint: '塗った所を、自動判定に関係なく「通れる」にします（緑の斜線）。崖や水の上でも歩けます。' },
  { id: 'walkOff', name: '通行不可', key: 'h', hint: '塗った所を、自動判定に関係なく「通れない」にします（赤紫の斜線）。見えない壁などに使います。' },
  { id: 'secret', name: '隠し通路', key: 'k', hint: '茂み・岩・崖の中を通り抜けられる隠し通路を塗ります（水色）。通路の床は入口と出口の地面の高さでつながり、キャラが入ると重なった物が透けます。' },
  { id: 'walkAuto', name: '自動に戻す', key: 'j', hint: '塗った所の上書きを消し、自動判定に戻します。' },
];
const undoStack = [], redoStack = [];
const snapshot = () => ({ ...(tunnels.length ? { TU: JSON.parse(JSON.stringify(tunnels)) } : {}), ...(springs.length ? { SP: springs.map(s => ({ ...s })) } : {}), ...(pools.length ? { PL: pools.map(p => ({ ...p })) } : {}), ...(SC.some(v => v) ? { SC: SC.slice() } : {}), H: H.slice(), S: S.slice(), O: O.slice(), C: C.slice(), CF: cliffFits.save(), P: props.map(p => p.slice()), F: falls.map(f => ({ ...f })), B: bridges.map(b => ({ ...b })), T: stairs.map(st => ({ ...st })), W: state.water, sp: { ...state.spawn }, bi: state.biome, at: { ...state.atmo }, sea: state.sea, we: { ...state.weather }, sun: state.sunOn, tod: state.timeOfDay, dk: state.darkness, M: markers.map(m => ({ ...m })), nid: state.nextId, rid: state.roomId, cat: JSON.stringify(state.catalog), ag: { ...state.agent }, cs: state.cliffStyle });
function restore(s,prepared,deferMarkers=false) { cliffFits.clear();H.set(s.H); tunnels = s.TU ? JSON.parse(JSON.stringify(s.TU)) : []; springs = (s.SP || []).map(q => ({ ...q })); pools = (s.PL || []).map(q => ({ ...q })); if (s.SC) SC.set(s.SC); else SC.fill(0); rebuildPools(); S.set(s.S); O.set(s.O); if (s.C) C.set(s.C); else C.fill(0); walkDirty = true; props = s.P.map(p => p.slice()); falls = s.F.map(f => ({ ...f })); bridges = s.B.map(b => ({ ...b })); stairs = (s.T || []).map(st => ({ ...st })); state.water = s.W; state.spawn = { ...s.sp }; if (s.at) state.atmo = { ...s.at }; if (s.we) state.weather = { ...s.we }; state.sunOn = s.sun !== false; state.timeOfDay = timeId(s.tod); state.darkness = s.dk || 'dark'; markers = (s.M || []).map(m => ({ ...m })); state.nextId = s.nid || state.nextId; state.roomId = s.rid || state.roomId; if (s.cat) { state.catalog = JSON.parse(s.cat); applyCatalog(); } if (s.ag) { state.agent = { ...s.ag }; syncAgentUI(); colliders = null; } state.cliffStyle = s.cs || 'standard'; applyCliffStyle(); if ($('cliffStyle')) $('cliffStyle').value = state.cliffStyle; if(!deferMarkers)rebuildMarkers(); state.sea = !!s.sea; applyBiome(s.bi || state.biome); syncUI(); updateTerrain(); rebuildTunnels(); solveSprings(); rebuildSpringMarks(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs();if(prepared)cliffFits.installPrepared(prepared,props,cliffInputSignature());else cliffFits.load(s.CF,props,cliffInputSignature());rebuildProps(); }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 40) undoStack.shift(); redoStack.length = 0; }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); toast('取り消し'); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); toast('やり直し'); }

const stroke = { active: false, base: 0, lower: false, lastStamp: null };
let hit = null;
// brush distance: a circle, or with the square brush the larger of the two axis distances (an axis-aligned square of half side r)
const brushDist = (dx, dz, sq = state.brushShape === 'square') => sq ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
function forBrush(x, z, r, fn, sq = false) {
  const i0 = clamp(Math.floor((x - r + HALF) * RES), 0, N - 1), i1 = clamp(Math.ceil((x + r + HALF) * RES), 0, N - 1);
  const j0 = clamp(Math.floor((z - r + HALF) * RES), 0, N - 1), j1 = clamp(Math.ceil((z + r + HALF) * RES), 0, N - 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = brushDist(vx(i) - x, vx(j) - z, sq); if (d < r) fn(idx(i, j), d, vx(i), vx(j)); }
}
const soft = (d, r) => { const t = 1 - d / r; return t <= 0 ? 0 : t * t * (3 - 2 * t); };
function applyBrush(x, z, dt) {
  const r = state.radius, k = state.strength, tool = state.tool, sq = state.brushShape === 'square';
  if (tool === 'plateau') {
    const target = stroke.base + (stroke.lower ? -STEP : STEP);
    forBrush(x, z, r * 1.1, (i, d, px, pz) => {
      const dd = d + (fbm(px * .45 + 3, pz * .45) - .5) * r * .35;
      const w = sstep(r, r * .8, dd);
      if (w > 0) H[i] = lerp(H[i], target, Math.min(1, w * (.35 + k)));
    }, sq);
  } else if (tool === 'raise' || tool === 'lower') {
    const sgn = tool === 'raise' ? 1 : -1;
    forBrush(x, z, r, (i, d) => { H[i] += sgn * soft(d, r) * k * 4 * dt; }, sq);
  } else if (tool === 'flat') {
    forBrush(x, z, r, (i, d) => { H[i] = lerp(H[i], stroke.base, Math.min(1, soft(d, r) * k * 8 * dt)); }, sq);
  } else if (tool === 'smooth') {
    const src = H.slice();
    forBrush(x, z, r, (i, d) => {
      const ii = i % N, jj = (i / N) | 0;
      if (ii < 1 || jj < 1 || ii > N - 2 || jj > N - 2) return;
      const avg = (src[i - 1] + src[i + 1] + src[i - N] + src[i + N] + src[i]) / 5;
      H[i] = lerp(H[i], avg, Math.min(1, soft(d, r) * k * 10 * dt));
    }, sq);
  } else if (tool === 'cliffpaint') {
    const v = state.variant.cliffpaint;
    forBrush(x, z, r, (i, d, px, pz) => { if (d + (fbm(px * .5 + 7, pz * .5) - .5) * r * .3 < r) C[i] = v; }, sq);
    stroke.cliffChanged = true;
  } else if (tool === 'walkOn' || tool === 'walkOff' || tool === 'walkAuto' || tool === 'secret') {
    const v = tool === 'walkOn' ? 1 : tool === 'walkOff' ? 2 : tool === 'secret' ? 3 : 0;
    forBrush(x, z, r, i => { O[i] = v; }, sq);
    walkDirty = true;
  } else if (tool === 'grass' || GROUND.includes(tool)) {
    const ch = GROUND.indexOf(tool);
    stroke.groundChanged = true;
    forBrush(x, z, r, (i, d) => {
      const a = soft(d, r) * k * 700 * dt;
      TDTerrainPaint.paint(S,i*NS,NS,ch,a/255);
    }, sq);
  }
}
function buildPropHash() { const h = new SpatialHash(4); for (const p of props) h.add(p, p[1], p[2]); return h; }
function canPlace(t, x, z, hash) {
  if (Math.abs(x) > HALF - 1.2 || Math.abs(z) > HALF - 1.2) return false;
  const wd = PROP[t].water;   // [min, max] still depth (m): props that grow under water (corals)
  const sh = PROP[t].shore;   // [min, max] height above the still water (m): things the waves leave at the water's edge (shells, wrack)
  if (sh ? !(heightAt(x, z) - state.water >= sh[0] && heightAt(x, z) - state.water <= sh[1]) : wd ? !(state.water - heightAt(x, z) >= wd[0] && state.water - heightAt(x, z) <= wd[1]) : heightAt(x, z) < waterAt(x, z) + (PROP[t].id === 'reed' ? -.45 : .3)) return false;
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
  const r = state.radius, sq = state.brushShape === 'square', hash = buildPropHash(), n = Math.max(1, Math.round((sq ? 4 : Math.PI) * r * r * state.density * .22));
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r, t = types[(R() * types.length) | 0];
    const px = sq ? x + (a / Math.PI - 1) * r : x + Math.cos(a) * d, pz = sq ? z + (R() * 2 - 1) * r : z + Math.sin(a) * d;   // square: uniform over the square
    if (!canPlace(t, px, pz, hash)) continue;
    let s = lerp(PROP[t].sc[0], PROP[t].sc[1], R());
    if (PROP[t].water) {   // under water things stay under it: smaller in the shallows, none where even a small one would show
      const fit = (state.water - heightAt(px, pz)) * .9 / PROP[t].height;
      if (fit < PROP[t].sc[0] * .5) continue; s = Math.min(s, fit);
    }
    const p = [t, px, pz, R() * Math.PI * 2, s, 0]; props.push(p); hash.add(p, px, pz);
  }
  rebuildProps();
}
const TYPE = id => PROP.findIndex(t => t.id === id);
function regenGroundProps() {
  refreshGroundWeights();
  props = props.filter(p => p[5] !== 2);
  const hash = buildPropHash(), add = (t, x, z, s) => { const p = [t, x, z, hash2(x * 31 | 0, z * 17 | 0) * 6.28, s, 2]; props.push(p); hash.add(p, x, z); };
  const free = (x, z, d) => { let ok = true; hash.query(x, z, 2.5, p => { if (ok && Math.hypot(p[1] - x, p[2] - z) < d) ok = false; }); return ok; };
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = idx(i, j), rb = effectiveS[k * NS + 3] / 255, sw = effectiveS[k * NS + 4] / 255, po = effectiveS[k * NS + 5] / 255;
    if (rb < .45 && sw < .45 && po < .45) continue;
    const h1 = hash2(i * 7 + 3, j * 13 + 5), h2 = hash2(i * 11 + 1, j * 3 + 9);
    const x = vx(i) + (h2 - .5) * .45, z = vx(j) + (hash2(i, j * 5) - .5) * .45;
    if (heightAt(x, z) < state.water - .45 || slopeAt(x, z) > 1.2) continue;
    if (rb >= .45) {
      // 乾いた土片は地面が十分平らな乾燥面の中だけ。橋・階段・出入口・開始点を空ける。
      const fx=x/3.4,fz=z/3.4,ix=Math.floor(fx),iz=Math.floor(fz),u=(fx-ix)**2*(3-2*(fx-ix)),v=(fz-iz)**2*(3-2*(fz-iz));
      const patch=clamp((lerp(lerp(hash2(ix+121,iz+37),hash2(ix+122,iz+37),u),lerp(hash2(ix+121,iz+38),hash2(ix+122,iz+38),u),v)-.30)/.50,0,1);
      const scale=.75+h2*.40,radius=.36*scale,base=heightAt(x,z);
      const safe=rb>.85&&h1<(.025+.44*patch*patch)*Math.min(1,6400/(SIZE*SIZE))&&free(x,z,.38)&&base>state.water+.12&&slopeAt(x,z)<.16&&bridgeAt(x,z)===null&&stairsAt(x,z)===null&&Math.hypot(x-state.spawn.x,z-state.spawn.z)>1&&
        !markers.some(m=>(m.kind==='port'||isLink(m.kind))&&Math.hypot(x-m.x,z-m.z)<Math.max(m.r||0,(m.w||2)/2)+radius+.35)&&
        Array.from({length:8},(_,i)=>i*Math.PI/4).every(a=>{const px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;return splatAt(px,pz,3)>.75&&Math.abs(heightAt(px,pz)-base)<.045&&bridgeAt(px,pz)===null&&stairsAt(px,pz)===null;});
      if(safe)add(TYPE(['drysoil_curl','drysoil_cup','drysoil_flake'][Math.floor(hash2(i*29+3,j*31+9)*3)]),x,z,scale);
      else if (h1 < .09 * rb && free(x, z, .35)) add(TYPE('scree'), x, z, .7 + h2 * .65);
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
  // 草丈の低い地被を土台に、数m単位の群れと道端の短い草を重ねる。
  const GR = TYPE('grass'), meadow = ['forest', 'grassland'].includes(state.biome);
  if (meadow && GR >= 0) {
    const noise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),u=x-i,v=z-j,s=u*u*(3-2*u),t=v*v*(3-2*v);return lerp(lerp(hash2(i,j),hash2(i+1,j),s),lerp(hash2(i,j+1),hash2(i+1,j+1),s),t);};
    const density=Math.min(1,4000/(SIZE*SIZE));
    const kinds=['meadowgrass','clover','meadowwhite','meadowyellow','shortgrass','groundlitter'].map(TYPE);
    const treeHash=new SpatialHash(4);for(const p of props)if(/tree|pine|birch|oak/.test(PROP[p[0]].id))treeHash.add(p,p[1],p[2]);
    for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
      const k=idx(i,j),dirt=effectiveS[k*NS]/255;let other=0;for(let c=1;c<NS;c++)other=Math.max(other,effectiveS[k*NS+c]/255);
      if(other>.18||dirt>.67)continue;
      const h=hash2(i*5+11,j*9+2),h2=hash2(i*3+7,j*7+1),x=vx(i)+(h2-.5)*CELL*.8,z=vx(j)+(hash2(i*9,j)-.5)*CELL*.8;
      const cluster=noise(x*.24+31,z*.24-17),edge=clamp(dirt/.4,0,1),coverage=clamp((.67-dirt)/.4,0,1);
      if(h>(.48+.65*cluster*cluster+.20*edge)*coverage*density)continue;
      if(heightAt(x,z)<state.water+.12||slopeAt(x,z)>.55||!free(x,z,.24))continue;
      if(bridgeAt(x,z)!==null||stairsAt(x,z)!==null)continue;
      if(Math.hypot(x-state.spawn.x,z-state.spawn.z)<.8||markers.some(m=>(m.kind==='port'||isLink(m.kind))&&Math.hypot(x-m.x,z-m.z)<Math.max(m.r||0,(m.w||2)/2)+.35))continue;
      const species=hash2(i*19+7,j*23-2),flowers=cluster>.55&&dirt<.25;
      const t=flowers&&species>.95?kinds[3]:flowers&&species>.90?kinds[2]:species>.92?kinds[1]:species<.62?kinds[4]:kinds[0];
      if(t<0)continue;
      const scale=t===kinds[4]?(.88+.40*h2)*(1-.18*edge):t===kinds[0]?(.70+.52*h2)*(1-.30*edge):t===kinds[1]?.50+h2*.35:.65+h2*.3;
      add(t,x,z,scale);
    }
    // 土の中心は開け、少量の埋まった小石を縁に寄せる。
    for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
      const k=idx(i,j),dirt=effectiveS[k*NS]/255;let other=0;for(let c=1;c<NS;c++)other=Math.max(other,effectiveS[k*NS+c]/255);
      if(other>.18)continue;
      const x=vx(i),z=vx(j);let treeDist=Infinity;
      treeHash.query(x,z,2.8,p=>{treeDist=Math.min(treeDist,Math.hypot(x-p[1],z-p[2]));});
      const chance=hash2(i*17+3,j*11+7),leaf=treeDist>.35&&treeDist<2.6&&dirt<.8&&chance<.12*density;
      if(!leaf&&(dirt<.2||chance>(dirt<.8?.075:.012)*density))continue;
      if(heightAt(x,z)<state.water+.12||slopeAt(x,z)>.45||!free(x,z,.20)||bridgeAt(x,z)!==null||stairsAt(x,z)!==null)continue;
      if(Math.hypot(x-state.spawn.x,z-state.spawn.z)<.8||markers.some(m=>(m.kind==='port'||isLink(m.kind))&&Math.hypot(x-m.x,z-m.z)<Math.max(m.r||0,(m.w||2)/2)+.35))continue;
      add(leaf?kinds[5]:TYPE('pebble'),x,z,leaf?.65+hash2(i*3,j*7)*.5:.20+hash2(i*3,j*7)*.30);
    }
  } else {

  if (GR >= 0 && PROP[GR].tags.includes(state.biome)) for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const k = idx(i, j); let painted = 0; for (let c = 0; c < NS; c++) painted = Math.max(painted, effectiveS[k * NS + c]); if (painted > 60) continue;
    const h1 = hash2(i * 5 + 11, j * 9 + 2); if (h1 > .045) continue;
    const h2 = hash2(i * 3 + 7, j * 7 + 1), x = vx(i) + (h2 - .5) * .45, z = vx(j) + (hash2(i * 9, j) - .5) * .45;
    if (heightAt(x, z) < state.water + .1 || slopeAt(x, z) > .9 || !free(x, z, .6)) continue;
    if ((bridges.length && bridgeAt(x, z) !== null) || (stairs.length && stairsAt(x, z) !== null)) continue;   // not on decks and steps
    add(GR, x, z, .75 + h2 * .6);
  }

  }
  rebuildProps();
}
function eraseAt(x, z) {
  const r = state.radius, n0 = props.length;
  props = props.filter(p => !(state.types.has(p[0]) && propVisible(p[0]) && brushDist(p[1] - x, p[2] - z) < r));
  if (props.length !== n0) rebuildProps();
}
// keeps generated rocks off waterfalls (their sheet and stream) and bridge decks
function nearFeatureReason(x,z){
 for(const f of falls){const[ux,uz]=fallDir(f),cx=f.x+ux,cz=f.z+uz,ax=x-cx,az=z-cz;if(Math.abs(ax*uz-az*ux)<f.w*.5+.35&&Math.abs(ax*ux+az*uz)<2)return{kind:'waterfall',id:f.id};if(f.sx!==undefined&&distToPolyline(x,z,[[cx,cz],[f.sx,f.sz]])<f.w*.5+.8)return{kind:'upstream',id:f.id};}
 for(const b of bridges)if(distToPolyline(x,z,[[b.x1,b.z1],[b.x2,b.z2]])<b.w/2+.8)return{kind:'bridge-clearance',id:b.id};
 for(const st of stairs)if(distToPolyline(x,z,[[st.x1,st.z1],[st.x2,st.z2]])<st.w/2+.9)return{kind:'stairs-clearance',id:st.id};return null;
}
function nearFeature(x,z){return!!nearFeatureReason(x,z);}

const nearEdge = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > HALF - 2.5;   // the map's outer rim is left alone
// 岩の中心ではなく、回転・拡縮後の占有輪郭を使って橋/階段/出入口を保護する。
const cliffHulls = new WeakMap();
function cliffHull(t,geometry=PROP[t].geo) {
  if(cliffHulls.has(geometry))return cliffHulls.get(geometry);
  const a=geometry.attributes.position,points=[];
  for(let i=0;i<a.count;i++)points.push([a.getX(i),a.getZ(i)]);
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=pts=>{const h=[];for(const p of pts){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}h.pop();return h;};
  const hull=half(points).concat(half([...points].reverse()));cliffHulls.set(geometry,hull);return hull;
}
function cliffWorldHull(p,geometry=effectiveGeometry(p)){const c=Math.cos(p[3]),s=Math.sin(p[3]);return cliffHull(p[0],geometry).map(([x,z])=>[p[1]+(x*c+z*s)*p[4],p[2]+(-x*s+z*c)*p[4]]);}
function cliffSegmentDistance(a,b,c,d){
  const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const point=(p,a,b)=>{const x=b[0]-a[0],z=b[1]-a[1],t=clamp(((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1),0,1);return Math.hypot(p[0]-a[0]-x*t,p[1]-a[1]-z*t);};
  if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0)return 0;
  return Math.min(point(a,c,d),point(b,c,d),point(c,a,b),point(d,a,b));
}
function cliffOverlapsLink(hull,a,b,r){
  const inside=p=>{let hit=false;for(let i=0,j=hull.length-1;i<hull.length;j=i++){const q=hull[i],s=hull[j];if((q[1]>p[1])!==(s[1]>p[1])&&p[0]<(s[0]-q[0])*(p[1]-q[1])/(s[1]-q[1])+q[0])hit=!hit;}return hit;};
  return inside(a)||inside(b)||hull.some((p,i)=>cliffSegmentDistance(p,hull[(i+1)%hull.length],a,b)<r);
}
function cliffProtectionReason(p,geometry){
 const hull=cliffWorldHull(p,geometry),margin=state.agent.radius+.15;
 for(const b of bridges)if(cliffOverlapsLink(hull,[b.x1,b.z1],[b.x2,b.z2],b.w/2+margin))return{kind:'bridge',id:b.id};
 for(const st of stairs)if(cliffOverlapsLink(hull,[st.x1,st.z1],[st.x2,st.z2],st.w/2+margin))return{kind:'stairs',id:st.id};
 for(const m of markers){if(m.kind==='port'){const L=portLanding(m);if(cliffOverlapsLink(hull,[m.x,m.z],[m.x,m.z],Math.max(m.r||0,(m.w||2)/2)+margin))return{kind:'port',id:m.id};if(cliffOverlapsLink(hull,[L.x,L.z],[L.x,L.z],m.r+margin)||cliffOverlapsLink(hull,[m.x,m.z],[L.x,L.z],Math.max(m.w/2,margin)))return{kind:'port-landing/approach',id:m.id};}else if(isLink(m.kind)){const A=linkArrival(m),T=linkTrigger(m);if(cliffOverlapsLink(hull,[A.x,A.z],[A.x,A.z],state.agent.arrivalClearance+margin)||cliffOverlapsLink(hull,[T.x,T.z],[T.x,T.z],LINK_SPEC[m.kind].tr+margin)||cliffOverlapsLink(hull,[A.x,A.z],[T.x,T.z],margin))return{kind:'floor-link',id:m.id};}}
 if(cliffOverlapsLink(hull,[state.spawn.x,state.spawn.z],[state.spawn.x,state.spawn.z],1+margin))return{kind:'spawn'};
 for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2));for(let k=0;k<=n;k++){const x=lerp(a[0],b[0],k/n),z=lerp(a[1],b[1],k/n);const feature=nearFeatureReason(x,z);if(feature)return{...feature,x,z};}}
 return null;
}
function cliffProtected(p,geometry){return!!cliffProtectionReason(p,geometry);}

let mapPreparation=null,mapPreparationSerial=0,lastPreparedState=null;
function stopCliffPreparation(){cliffContactToken++;clearTimeout(cliffContactTimer);cliffContactTimer=0;if(cliffContactDisabled?.length){const buttons=['autoRocks','save','saveAs','export','load'].map(id=>document.getElementById(id)).filter(Boolean);buttons.forEach((b,i)=>b.disabled=cliffContactDisabled[i]);}cliffContactDisabled=null;}
async function primeCollisionFields(list,job){await TDPreparation.each(list,p=>{const t=PROP[p[0]];if(t.r<=0)return;const f=fittedFootprint(p);if(f)shapeField(f,1);else if(t.footprint)shapeField(t.footprint,p[4]);},job);}
async function prepareCliffResult(r,input,job){
 job?.progress('岩の当たり形状を準備',0,r.fits.length);await primeCollisionFields(props,job);
 await TDPreparation.each(r.fits,(f,i)=>{f.prepared=cliffFits.prepare(f.p,f.geometry,input,{affine:f.affine,layering:f.layering,instanceTint:cliffTintAt(f.original[1],f.original[2])});makeFittedFootprint(f.p,f.prepared.cache);shapeField(f.prepared.cache.footprint,1);job?.progress('岩の当たり形状を準備',i+1,r.fits.length);},job);
}
let cliffContactProgress=0,cliffContactStats=null,cliffContactToken=0,cliffContactTimer=0,cliffContactDisabled=null;
async function fitCliffContact(job=null){
  clearTimeout(cliffContactTimer);cliffContactTimer=0;const token=++cliffContactToken;
  cliffContactProgress=0;rebuildCliffRelief();
  const generation=()=>[terrain.geometry.uuid,terrain.geometry.attributes.position.version,cliffRelief.geometry.uuid,cliffRelief.geometry.attributes.position.version].join('/');
  ensureIds();const version=generation(),source=props,input=cliffInputSignature(),signature=()=>JSON.stringify([source,markers,bridges,stairs,state.spawn,state.agent]),before=signature();
  let pendingFits=null;const managed=!!mapPreparation;const buttons=['autoRocks','save','saveAs','export','load'].map(id=>document.getElementById(id)).filter(Boolean);if(!cliffContactDisabled)cliffContactDisabled=managed?[]:buttons.map(b=>b.disabled);if(!managed)buttons.forEach(b=>b.disabled=true);
  try{
    const r=pendingFits=await TDCliffLayering.fitAsync({preparationJob:job,layered:p=>cliffFits.records.get(p[8])?.layering===1,geometries:[terrain.geometry,cliffRelief.geometry],types:PROP,height:heightAt,water:state.water,progress:n=>{cliffContactProgress=n;},protected:(p,g)=>cliffProtected(p,g||PROP[p[0]].geo),valid:()=>token===cliffContactToken&&generation()===version&&props===source&&signature()===before&&cliffInputSignature()===input},source);
    if(generation()!==version||props!==source||signature()!==before||token!==cliffContactToken){for(const f of r.fits)f.geometry.dispose();return{cancelled:true};}
    const prepStart=performance.now(),primeJob={valid:()=>token===cliffContactToken&&generation()===version&&props===source&&(!job||job.valid()),progress:(...args)=>job?.progress(...args)};await prepareCliffResult(r,input,primeJob);TDPreparation.check(primeJob);if(signature()!==before||cliffInputSignature()!==input){for(const f of r.fits)f.geometry.dispose();return{cancelled:true};}r.stats.prepareMs=performance.now()-prepStart;await TDPreparation.pause(primeJob);const adoptStart=performance.now();const adopted=managed?await TDPreparation.run(adoptCliffContactSteps(r,source,input),{valid:()=>token===cliffContactToken&&job.valid(),progress:(...a)=>job.progress(...a)}):adoptCliffContact(r,source,input);r.stats.adoptMs=performance.now()-adoptStart;if(adopted.cancelled)return adopted;cliffContactStats={...r.stats,generation:version};toast('岩を'+r.stats.changed+'個調整しました（'+r.stats.keptOriginal+'個は元の位置を維持）');return cliffContactStats;
  }catch(e){if(pendingFits){const installed=new Set([...cliffFits.cache.values()].map(c=>c.geometry));for(const f of pendingFits.fits)if(!installed.has(f.geometry))f.geometry.dispose();}if(e.name==='AbortError'||e.message==='cliff-contact-cancelled')return{cancelled:true};console.error(e);return{error:e.message};}
  finally{if(token===cliffContactToken){if(!managed)buttons.forEach((b,i)=>b.disabled=cliffContactDisabled?.[i]||false);cliffContactDisabled=null;}}
}


// 採用前の追加ガード。元の草地を新たに塞がず、元の岩の担当幅を残す。
function cliffCandidateFootprint(p,g){
 if(!g){const t=PROP[p[0]],a=p[3]-(t.sharedAsset?t.yawOffset*Math.PI/180:0);return[p[1],p[2],t.footprint.R*p[4],p[7],p[7]+t.height*p[4]*(p[6]??1),t.footprint,Math.cos(a),Math.sin(a),p[4]];}
 const geo=g.clone(),P=geo.attributes.position;for(let i=0;i<P.count;i++){const w=TDCliffContact.world(p,[P.getX(i),P.getY(i),P.getZ(i)]);P.setXYZ(i,w[0]-p[1],w[1],w[2]-p[2]);}geo.computeBoundingBox();const f=shapeFootprint({geo,sharedAsset:true}),b=geo.boundingBox;for(let j=0;j<f.nz;j++)for(let i=0;i<f.nx;i++){const k=j*f.nx+i;if(f.top[k]>-1e8)f.top[k]-=heightAt(p[1]+f.x0+i*SHAPE_CELL,p[2]+f.z0+j*SHAPE_CELL);}f.R=Math.hypot(Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),Math.max(Math.abs(b.min.z),Math.abs(b.max.z)));geo.dispose();return[p[1],p[2],f.R,b.min.y,b.max.y,f,1,0,1];
}
function cliffAdoptionReason(original,parts,geometries,preserveEveryPoint=true){
 const u=TDCliffContact.direction({height:heightAt,types:PROP},original),t=[-u[1],u[0]],span=(p,g)=>{let lo=Infinity,hi=-Infinity;const P=g.attributes.position;for(let i=0;i<P.count;i++){const w=TDCliffContact.world(p,[P.getX(i),P.getY(i),P.getZ(i)]),d=w[0]*t[0]+w[2]*t[1];lo=Math.min(lo,d);hi=Math.max(hi,d);}return[lo,hi];};
 if(TDCliffContact.unionCoverage(span(original,effectiveGeometry(original)),parts.map(p=>span(p,geometries.get(p)||PROP[p[0]].geo))).coverage<.99)return'original-band-coverage';
 if(!preserveEveryPoint)return null;
 for(const p of parts){const c=cliffCandidateFootprint(p,geometries.get(p)),r=c[2]+state.agent.radius;
  for(let z=Math.ceil((p[2]-r)*2)/2;z<=p[2]+r;z+=.5)for(let x=Math.ceil((p[1]-r)*2)/2;x<=p[1]+r;x+=.5){if(!inBounds(x,z)||Math.hypot(x-c[0],z-c[1])-c[2]>=state.agent.radius||shapeDist(c,x,z)>=state.agent.radius)continue;const d=deckAt(x,z,0);if(d&&!(c[4]>d.y+.05&&c[3]<d.y+state.agent.height))continue;if(walkable(x,z))return'new-walk-obstruction';}
 }
 return null;
}


// 岸際の実際の岩による通行境界は変わり得るが、元の通行領域を切断しない。
function* cliffWalkTopologySteps(){
 const step=SIZE>64?1:.5,n=Math.floor((SIZE-2)/step)+1,start=-HALF+1,open=new Uint8Array(n*n),labels=new Int32Array(n*n).fill(-1);
 for(let z=0;z<n;z++){yield {phase:"通路の接続を検査",current:z,total:n};for(let x=0;x<n;x++)open[z*n+x]=walkable(start+x*step,start+z*step)?1:0;}
 const sizes=[];let label=0;for(let i=0;i<open.length;i++){if(!open[i]||labels[i]!==-1)continue;const queue=[i];labels[i]=label;for(let k=0;k<queue.length;k++){if((k&511)===0)yield;const j=queue[k],x=j%n,z=Math.floor(j/n);for(const next of [x?j-1:-1,x<n-1?j+1:-1,z?j-n:-1,z<n-1?j+n:-1])if(next>=0&&open[next]&&labels[next]===-1){labels[next]=label;queue.push(next);}}sizes[label]=queue.length;label++;}
 const anchored=new Set(),points=[state.spawn,...bridges.flatMap(b=>[{x:b.x1,z:b.z1},{x:b.x2,z:b.z2}]),...stairs.flatMap(b=>[{x:b.x1,z:b.z1},{x:b.x2,z:b.z2}]),...markers.flatMap(m=>m.kind==='port'?[m,portLanding(m)]:isLink(m.kind)?[linkArrival(m),linkTrigger(m)]:[m])];for(const p of points){const x=Math.round((p.x-start)/step),z=Math.round((p.z-start)/step),id=x>=0&&x<n&&z>=0&&z<n?labels[z*n+x]:-1;if(id>=0)anchored.add(id);}const probes=[];for(const m of markers){const centers=m.kind==='port'?[m,portLanding(m)]:isLink(m.kind)?[linkArrival(m),linkTrigger(m)]:[];for(const p of centers)for(let k=-1;k<16;k++){const a=k*Math.PI/8,r=m.r+state.agent.radius+.15,x=p.x+(k<0?0:Math.cos(a)*r),z=p.z+(k<0?0:Math.sin(a)*r);probes.push({x,z,open:walkable(x,z)});}}for(const b of [...bridges,...stairs])for(let k=-2;k<=22;k++){const t=k/20,x=b.x1+(b.x2-b.x1)*t,z=b.z1+(b.z2-b.z1)*t;probes.push({x,z,open:walkable(x,z)});}return{n,step,start,open,labels,sizes,anchored,probes};
}
function cliffWalkTopology(){return drainMapSteps(cliffWalkTopologySteps());}
function cliffCutOwners(before,after,owners){
 const regions=new Map();for(let i=0;i<before.open.length;i++)if(before.open[i]&&after.open[i]&&(after.sizes[after.labels[i]]*after.step*after.step>=4||after.anchored.has(after.labels[i]))){const old=before.labels[i];if(!regions.has(old))regions.set(old,new Set());regions.get(old).add(after.labels[i]);}const cut=new Set([...regions].filter(([id,set])=>set.size>1).map(([id])=>id)),reject=new Set(),minority=new Set();const addOwners=(x,z)=>{const d=deckAt(x,z,0);getColliders().query(x,z,state.agent.radius+colliderMaxR,c=>{const owner=owners.get(c.prop);if(owner&&Math.hypot(c[0]-x,c[1]-z)-c[2]<state.agent.radius&&(!c[5]||shapeDist(c,x,z)<state.agent.radius)&&(!d||(c[4]>d.y+.05&&c[3]<d.y+state.agent.height)))reject.add(owner);});};for(let i=0;i<before.probes.length;i++)if(before.probes[i].open&&!after.probes[i].open)addOwners(before.probes[i].x,before.probes[i].z);if(!cut.size)return reject;for(const id of cut){const labels=[...regions.get(id)].sort((a,b)=>after.sizes[b]-after.sizes[a]);for(const label of labels.slice(1))minority.add(label);}
 for(let i=0;i<before.open.length;i++){if(!before.open[i]||after.open[i]||!cut.has(before.labels[i]))continue;const gx=i%before.n,gz=Math.floor(i/before.n),adjacent=[gx?i-1:-1,gx<before.n-1?i+1:-1,gz?i-before.n:-1,gz<before.n-1?i+before.n:-1];if(!adjacent.some(j=>j>=0&&minority.has(after.labels[j])))continue;const x=before.start+(i%before.n)*before.step,z=before.start+Math.floor(i/before.n)*before.step,d=deckAt(x,z,0);getColliders().query(x,z,state.agent.radius+colliderMaxR,c=>{const owner=owners.get(c.prop);if(owner&&Math.hypot(c[0]-x,c[1]-z)-c[2]<state.agent.radius&&(!c[5]||shapeDist(c,x,z)<state.agent.radius)&&(!d||(c[4]>d.y+.05&&c[3]<d.y+state.agent.height)))reject.add(owner);});}
 return reject.size?reject:new Set(owners.values());
}

function adoptCliffContact(r,source=props,input=cliffInputSignature()){return drainMapSteps(adoptCliffContactSteps(r,source,input));}
function* adoptCliffContactSteps(r,source=props,input=cliffInputSignature()){
 const dispose=()=>{for(const f of r.fits)f.geometry.dispose();};if(source!==props||input!==cliffInputSignature()){dispose();return{cancelled:true,reason:'input-changed'};}
 const routeBefore=r.stats.records.some(q=>q.ok&&q.method==='layered')?(yield* cliffWalkTopologySteps()):null,previousFits=routeBefore?cliffFits.save():null;
 const sourceById=new Map(source.map(p=>[p[8],p])),resultById=new Map(r.props.filter(p=>p[8]).map(p=>[p[8],p])),geometryByProp=new Map(r.fits.map(f=>[f.p,f.geometry])),updates=new Map();
 for(const record of r.stats.records){yield;const original=sourceById.get(record.id);if(!original){dispose();throw Error('元の岩IDがありません');}if(!record.ok){const retained=resultById.get(record.id);if(JSON.stringify(retained)!==JSON.stringify(original)){dispose();throw Error('維持する岩が変わっています');}updates.set(record.id,[original]);continue;}const parts=record.nextParts||[resultById.get(record.id)];if(parts.some(p=>!p)){dispose();throw Error('採用する岩がありません');}if(record.method!=='already-contact'&&parts.some(p=>cliffProtected(p,geometryByProp.get(p)||PROP[p[0]].geo))){dispose();return{cancelled:true,reason:'protection-changed'};}const reason=record.method==='already-contact'?null:cliffAdoptionReason(original,parts,geometryByProp,record.method!=='layered');if(reason){record.ok=false;record.method='kept-original';record.reason=reason;delete record.next;delete record.nextParts;updates.set(record.id,[original]);}else updates.set(record.id,parts);}
 r.fits=r.fits.filter(f=>{const keep=[...updates.values()].some(parts=>parts.includes(f.p));if(!keep)f.geometry.dispose();return keep;});r.stats.changed=r.stats.records.filter(q=>q.ok&&q.method!=='already-contact').length;r.stats.keptOriginal=r.stats.unresolved=r.stats.records.filter(q=>!q.ok).length;
 for(const record of r.stats.records)if(record.ok&&record.method!=='already-contact')cliffFits.remove(record.id);
 props=source.flatMap(p=>updates.get(p[8])||[p]);ensureIds();cliffFits.input=input;for(const f of r.fits){if(f.prepared)cliffFits.setPrepared(f.p,f.prepared);else cliffFits.set(f.p,f.geometry,input,{affine:f.affine,layering:f.layering,instanceTint:cliffTintAt(f.original[1],f.original[2])});}
 if(routeBefore){colliders=null;let rolledBack=0;for(let pass=0;pass<=r.stats.records.length;pass++){const owners=new Map();for(const record of r.stats.records)if(record.ok&&record.method==='layered')for(const p of updates.get(record.id))owners.set(p,record.id);const reject=cliffCutOwners(routeBefore,(yield* cliffWalkTopologySteps()),owners);if(!reject.size)break;for(const id of reject){const record=r.stats.records.find(q=>q.id===id);for(const p of updates.get(id))cliffFits.remove(p[8]);if(previousFits.instances[id])cliffFits.records.set(id,previousFits.instances[id]);updates.set(id,[sourceById.get(id)]);record.ok=false;record.method='kept-original';record.reason='route-connectivity';delete record.nextParts;rolledBack++;}props=source.flatMap(p=>updates.get(p[8])||[p]);colliders=null;}r.stats.routeRollback=rolledBack;r.stats.routeCuts=0;}
 r.stats.changed=r.stats.records.filter(q=>q.ok&&q.method!=='already-contact').length;r.stats.keptOriginal=r.stats.unresolved=r.stats.records.filter(q=>!q.ok).length;
 rebuildProps();return{applied:true,changed:r.stats.changed,keptOriginal:r.stats.keptOriginal};
}
function* autoRocksSteps(seed=Date.now()){
  const R=rng(seed|0),shapeR=rng((seed|0)^0x7b0d37e);
  props=props.filter(p=>p[5]!==1);
  const hash=buildPropHash(),ch=new SpatialHash(3),e=.4;
  const types=['cliff','cliff_split','cliff_shoulder'].map(TYPE),joint=TYPE('cliff_joint'),slab=TYPE('cliff_slab'),talus=TYPE('cliff_talus');
  const pts=[];for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++)pts.push([vx(i)+(R()-.5)*.4,vx(j)+(R()-.5)*.4]);
  for(let k=pts.length-1;k>0;k--){const m=R()*(k+1)|0;[pts[k],pts[m]]=[pts[m],pts[k]];}
  let rockStep=0;
  for(const [x,z]of pts){
    if(((++rockStep)&31)===0)yield {phase:"崖岩の配置",current:rockStep,total:pts.length};
    if(nearEdge(x,z)||slopeAt(x,z)<1.3||nearFeature(x,z))continue;
    const gx=(heightAt(x+e,z)-heightAt(x-e,z))/(2*e),gz=(heightAt(x,z+e)-heightAt(x,z-e))/(2*e),gl=Math.hypot(gx,gz);if(gl<1e-5)continue;
    const ux=gx/gl,uz=gz/gl;let hT=heightAt(x,z),hB=hT;
    for(let d=.25;d<=2.5;d+=.25){hT=Math.max(hT,heightAt(x+ux*d,z+uz*d));hB=Math.min(hB,heightAt(x-ux*d,z-uz*d));}
    if(hT-hB<.9)continue;
    const px=x-ux*.35,pz=z-uz*.35;if(nearEdge(px,pz))continue;
    let ok=true,neighbor=null,near=Infinity;
    ch.query(px,pz,3,p=>{const d=Math.hypot(p[1]-px,p[2]-pz);if(d<1.45)ok=false;if(d<near){neighbor=p;near=d;}});if(!ok)continue;
    const below=Math.max(hB,state.water-.6),targetH=hT-below+.10;if(targetH<.5)continue;
    // 元と同じR消費を保つ。部品選択は別乱数なので密度を意図せず変えない。
    const legacyLayers=Math.max(1,Math.round((hT-below-.05)/2.3));let width=.95,rot=Math.atan2(-ux,-uz);
    for(let L=0;L<legacyLayers;L++){const w=.95+R()*.25,r=rot+(R()-.5)*.35;if(L===0){width=w;rot=r;}}
    let chosen=types[Math.floor(shapeR()*3)];if(neighbor&&near<3&&chosen===neighbor[0])chosen=types[(types.indexOf(chosen)+1+(shapeR()>.5?1:0))%3];
    function fit(t,s){const g=PROP[t].geo;g.computeBoundingBox();const b=g.boundingBox,sy=targetH/((b.max.y-b.min.y)*s),by=below-.10-b.min.y*s*sy;return[t,px,pz,rot,s,1,sy,by];}
    let p=fit(chosen,width);
    // 幅が厳しい橋際/終端では細岩へ。広い岩を地中へ消さない。
    if(cliffProtected(p)){p=fit(joint,.95);if(cliffProtected(p))continue;}
    props.push(p);ch.add(p,px,pz);
  }
  for(let j=2;j<N-2;j++)for(let i=2;i<N-2;i++){
    const x=vx(i)+(R()-.5)*.5,z=vx(j)+(R()-.5)*.5,s=slopeAt(x,z);
    if(nearEdge(x,z)||s<1.1||R()>.07||nearFeature(x,z))continue;
    const gx=(heightAt(x+e,z)-heightAt(x-e,z))/(2*e),gz=(heightAt(x,z+e)-heightAt(x,z-e))/(2*e),gl=Math.hypot(gx,gz)||1,foot=R()<.7,off=foot?-1.1:.9;
    const px=x+gx/gl*off,pz=z+gz/gl*off;if(nearEdge(px,pz))continue;
    let ok=true;hash.query(px,pz,3,p=>{if(Math.hypot(p[1]-px,p[2]-pz)<1.2)ok=false;});if(!ok)continue;
    const yaw=R()*Math.PI*2;R(); // 旧倍率用の乱数消費を保ち、配置地点を再現する。
    const t=shapeR()<.6?slab:talus,scale=.78+.22*shapeR();
    const p=[t,px,pz,yaw,scale,1,1,heightAt(px,pz)-.04];
    if(cliffProtected(p))continue;
    const heights=cliffWorldHull(p).map(([x,z])=>heightAt(x,z));
    if(Math.max(...heights)-Math.min(...heights)>.35)continue; // 低い裾岩が斜面から独立して浮かない。
    p[7]=Math.min(...heights)-.025;
    props.push(p);hash.add(p,px,pz);
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
function* sample2Steps(seed = 11) {
  C.fill(0);
  state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = [];
  state.sea = false; S.fill(0); O.fill(0); bridges = []; stairs = []; falls = []; props = []; springs = []; pools = []; tunnels = []; SC.fill(0);
  state.biome = 'ruins'; state.water = .4;
  const R = rng(seed);
  const dirt = [[[0, -24], [0, -12]], [[-24, -8], [-12, -10], [0, -12]], [[0, -12], [7, -8], [13, -4]], [[-6.2, 13], [-5, 14.5], [-3, 15.5]]];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if(i===0)yield {phase:"地形と地面",current:j,total:N};
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
  yield* autoRocksSteps(seed * 13); regenGroundProps();
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
  props = props.filter(p => !markers.some(m => isLink(m.kind) && Math.hypot(p[1] - m.x, p[2] - m.z) < 3.4 + PROP[p[0]].r * p[4])); rebuildProps(); clearPortLandings();
  rebuildProps(); ensureIds(); rebuildMarkers();
}
function drainMapSteps(it){let r;do{r=it.next();}while(!r.done);return r.value;}
function genSample(seed=7){cancelMapPreparation(false);return drainMapSteps(sampleSteps(seed));}
function genSample2(seed=11){cancelMapPreparation(false);return drainMapSteps(sample2Steps(seed));}
function autoRocks(seed=Date.now()){return drainMapSteps(autoRocksSteps(seed));}
function genFlat() { cancelMapPreparation(false);cliffFits.clear();C.fill(0); state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = []; state.sea = false; H.fill(3); S.fill(0); O.fill(0); props = []; falls = []; bridges = []; stairs = []; springs = []; pools = []; tunnels = []; SC.fill(0); state.water = .8; state.spawn = { x: 0, z: 0 }; }
function pickFlora(R, list) {
  let tot = 0; for (const [, w] of list) tot += w;
  let r = R() * tot; for (const [id, w] of list) { r -= w; if (r <= 0) return TYPE(id); }
  return TYPE(list[0][0]);
}
function* sampleSteps(seed = 7) {
  C.fill(0);
  state.roomId = newRoomId(); state.nextId = 1; state.revision = 0; state.lastExportHash = ''; markers = [];
  state.sea = false; S.fill(0);   // channels 2+ are only ever raised below, so start clean
  O.fill(0); bridges = []; stairs = []; falls = []; props = []; springs = []; pools = []; tunnels = []; SC.fill(0);   // nothing from the previous map may steer the generator
  const R = rng(seed), WL = .8;
  const river = [[20, -34], [17, -20], [12, -8], [9, 2], [11, 12], [17, 22], [22, 34]];
  const path1 = [[0, -34], [-1, -20], [-3, -8], [-2, 4], [1, 16], [0, 28]];
  const path2 = [[-34, 8], [-20, 6], [-8, 4], [-2, 4]];
  const path3 = [[-2, 4], [9, 5], [16, 4], [34, 3]];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if(i===0)yield {phase:"地形と地面",current:j,total:N};
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
    if((k&31)===0)yield {phase:"植生の配置",current:k,total:9000};
    const x = (R() - .5) * (SIZE - 3), z = (R() - .5) * (SIZE - 3), d = Math.max(Math.abs(x), Math.abs(z)) / HALF, f = fbm(x * .08 + 11, z * .08);
    const dens = d > .7 ? .35 + f * .45 : sstep(.62, .74, f) * .55;
    if (R() > dens * .3 * BIOME().flora.density) continue;
    const t = pickFlora(R, d > .66 ? BIOME().flora.rim : BIOME().flora.inner);
    if (!canPlace(t, x, z, hash)) continue;
    const p = [t, x, z, R() * Math.PI * 2, lerp(PROP[t].sc[0], PROP[t].sc[1], R()), 0]; props.push(p); hash.add(p, x, z);
  }
  for (let k = 0; k < 500; k++) {
    if((k&31)===0)yield {phase:"小物の配置",current:k,total:500};
    const x = (R() - .5) * (SIZE - 4), z = (R() - .5) * (SIZE - 4);
    const st = TYPE(BIOME().flora.small);
    if (!canPlace(st, x, z, hash) || R() < .4) continue;
    const p = [st, x, z, R() * 6.28, lerp(.7, 1.4, R()), 0]; props.push(p); hash.add(p, x, z);
  }
  // ground types: rubble in the north-west, a bog with a poison pool in the south-west, sandy river banks
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if(i===0)yield {phase:"地形と地面",current:j,total:N};
    const x = vx(i), z = vx(j), k = idx(i, j), n = (fbm(x * .3 + 40, z * .3) - .5) * 2.2, h = H[k];
    if (h < WL - .2) continue;
    const put = (c, v) => { if (state.biome === 'forest' ? c > 5 : !GTOOL_TAGS[GROUND[c]].includes(state.biome)) return; if (v > 0) { S[k * NS + c] = Math.max(S[k * NS + c], clamp(v * 255, 0, 255)); for (const o of [0, 1]) S[k * NS + o] = Math.round(S[k * NS + o] * (1 - clamp(v, 0, 1))); } };
    put(3, sstep(6.5, 4.5, Math.hypot(x + 20, z + 19) + n));
    put(4, sstep(5.2, 3.4, Math.hypot(x + 6, z - 12) + n) * (h < 4.2 ? 1 : 0));
    put(5, sstep(2.2, 1.3, Math.hypot(x + 7.2, z - 12.8) + n * .6) * (h < 4.2 ? 1 : 0));
    put(6, sstep(4.2, 2.6, Math.hypot(x + 20, z + 19) + n) + sstep(1.6, .8, distToPolyline(x, z, [[-20, -19], [-12, -24], [-6, -27]]) + n * .4));
    put(2, sstep(2.4, 1.2, distToPolyline(x, z, river) - (3.1 + 1.1 * Math.sin(z * .18)) - 1.8 + n * .5) * (x > 12 && z > 6 ? 1 : 0));
  }
  yield* autoRocksSteps(seed * 13);
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
  props = props.filter(p => !markers.some(m => isLink(m.kind) && Math.hypot(p[1] - m.x, p[2] - m.z) < 3.4 + PROP[p[0]].r * p[4])); rebuildProps(); clearPortLandings(); rebuildProps();
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
  for (const q of springs) if (!q.id) q.id = newId('spring');
  for (const q of tunnels) if (!q.id) q.id = newId('tunnel');
  for (const q of pools) if (!q.id) q.id = newId('pool');
  for (const m of markers) if (!m.id) m.id = newId(markerPrefix(m.kind));
  if (!state.spawn.id) state.spawn.id = 'spawn_main';
}

// ---------- asset catalog: typeId -> assetKey and the proxy collider the editor uses for walkability
const EXPORTER_VERSION = 'tdj-map-editor/2026.10.21-r18';
for (const t of PROP) { t.geo.computeBoundingBox(); t.meshTop = +t.geo.boundingBox.max.y.toFixed(2); t.height = t.height ?? t.meshTop; t.base = { r: t.r, offs: t.offs, height: t.height }; t.offs = t.offs ? t.offs.map(o => [o, 0]) : null; if (t.shape && t.r > 0) t.footprint = shapeFootprint(t); }   // internal offsets are [x, z] (see applyCatalog)
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
    types: Object.fromEntries(PROP.map(t => [t.id, { name: t.name, assetKey: t.assetKey, solid: t.r > 0, radius: t.r, offsets: t.offsPrefab || [0], height: t.height, yawOffsetDeg: t.yawOffset || 0, footprint: t.vis, tags: t.tags,
      ...(t.sharedAsset && t.assetKey === TDSharedProps.asset(t.sharedAsset).assetKey ? { sharedModel: { file: 'shared_props.json', id: t.sharedAsset, version: TDSharedProps.asset(t.sharedAsset).version } } : {}) }])),
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
function valueIssues(src,size=SIZE) {
  const half=size/2;const out = [], bad = (what, why) => out.push(`${what}: ${why}`), inMap = (x, z) => FIN(x) && FIN(z) && Math.abs(x) <= half && Math.abs(z) <= half;
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
  if (tunnels.length) for (const w of TDTunnels.check(TDTunnels.prepare(tunnels, heightAt), heightAt, { agent: ag, water: state.water })) warnings.push(w);
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
      if (t === 1 && b.type === 'pier') continue;   // a pier ends over the water
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
  if(mapPreparation||cliffContactDisabled)throw Error('崖の岩を調整中です。完了後に保存してください');
  cliffFits.synchronize(cliffInputSignature(),props);
  return {
    format: 'map-editor-proto', version: 2, size: SIZE, resolution: RES, vertices: N,
    roomId: (ensureIds(), state.roomId), nextId: state.nextId, revision: state.revision, lastExportHash: state.lastExportHash, agent: { ...state.agent }, catalog: state.catalog,
    markers: markers.map(m => ({ ...m })),
    waterLevel: state.water, spawn: state.spawn, biome: state.biome, cliffStyle: state.cliffStyle, sea: state.sea, atmosphere: { ...state.atmo }, weather: { ...state.weather }, sunlight: state.sunOn, timeOfDay: state.timeOfDay, darkness: state.darkness, name: state.mapName,
    heightsF32: b64(new Uint8Array(H.slice().buffer)), splat: b64(S), walkOverride: b64(O), cliffMap: b64(C),   // exact heights: save → load → export reproduces the RAW
    propTypes: PROP.map(p => p.id),
    cliffFits: cliffFits.records.size?cliffFits.save():undefined,
    // full precision (JSON keeps doubles exactly), so a reloaded map exports byte-identical files
    props: props.map(p => p.map(v => v ?? null)),
    falls: falls.map(f => ({ ...f })), bridges: bridges.map(b => ({ ...b })), stairs: stairs.map(st => ({ ...st })),
    // water sources and pools (left out when there are none, so older maps save as before); springCarve = how deep their streams are carved
    tunnels: tunnels.length ? JSON.parse(JSON.stringify(tunnels)) : undefined,
    springs: springs.length ? springs.map(q => ({ ...q })) : undefined, pools: pools.length ? pools.map(q => ({ ...q })) : undefined,
    springCarve: SC.some(v => v) ? b64(new Uint8Array(SC.slice().buffer)) : undefined,
  };
}
// props hold a type index. A saved map also lists its type ids (propTypes), so map them onto this editor's order:
// adding, removing or reordering the prop files (props/*.js) keeps old maps intact.
function remapPropTypes(d) {
  if (!Array.isArray(d.propTypes) || !Array.isArray(d.props)) return d;
  const now = PROP.map(t => t.id), to = d.propTypes.map(id => now.indexOf(id));
  if (to.every((v, i) => v === i)) return d;
  const missing = new Set();
  for (const p of d.props) if (Array.isArray(p) && Number.isInteger(p[0]) && to[p[0]] === -1) missing.add(d.propTypes[p[0]]);
  if (missing.size) throw new Error('この版に無い小物の種類があります: ' + [...missing].join(', '));
  return { ...d, props: d.props.map(p => Array.isArray(p) && Number.isInteger(p[0]) && to[p[0]] >= 0 ? [to[p[0]], ...p.slice(1)] : p) };
}
function decodeMap(d,size=SIZE){
  const count=(size*RES+1)**2;
  d = remapPropTypes(d);
  // decode and check everything first; the current map is touched only after all checks pass
  const issues = valueIssues(d,size);
  const dec = (name, s) => { if (typeof s !== 'string') { issues.push(`${name}: ありません`); return null; } try { return unb64(s); } catch (e) { issues.push(`${name}: base64 として読めません`); return null; } };
  let newH = null;
  if (d.heightsF32 !== undefined) {
    const u = dec('heightsF32', d.heightsF32);
    if (u && u.length !== count * 4) issues.push(`heightsF32: ${u.length} バイト（${count * 4} バイトが必要）`);
    else if (u) newH = new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length));
  } else {
    const u = dec('heightsCm', d.heightsCm);
    if (u && u.length !== count * 2) issues.push(`heightsCm: ${u.length} バイト（${count * 2} バイトが必要）`);
    else if (u) { const hc = new Int16Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)); newH = Float32Array.from(hc, v => v / 100); }
  }
  if (newH) { let bad = 0; for (let k = 0; k < newH.length; k++) if (!Number.isFinite(newH[k]) || Math.abs(newH[k]) > 1000) bad++; if (bad) issues.push(`高さ: 不正な値（NaN・Infinity・±1000m 超）が ${bad} 点あります`); }
  const sp = dec('splat', d.splat), spLayers = sp ? sp.length / (count) : 0;
  if (sp && !(Number.isInteger(spLayers) && spLayers >= 1 && spLayers <= NS)) issues.push(`splat: ${sp.length} バイト（${count} の 1〜${NS} 倍が必要）`);
  const wo = d.walkOverride !== undefined ? dec('walkOverride', d.walkOverride) : new Uint8Array(count);
  if (wo && wo.length !== count) issues.push(`walkOverride: ${wo.length} バイト（${count} バイトが必要）`);
  else if (wo && wo.some(v => v > 3)) issues.push('walkOverride: 0〜3 以外の値があります');
  const cm = d.cliffMap !== undefined ? dec('cliffMap', d.cliffMap) : new Uint8Array(count);
  if (cm && cm.length !== count) issues.push(`cliffMap: ${cm.length} バイト（${count} バイトが必要）`);
  else if (cm && cm.some(v => v > CLIFF_STYLES.length)) issues.push(`cliffMap: 0〜${CLIFF_STYLES.length} 以外の値があります`);
  if (!Array.isArray(d.props)) issues.push('props: 配列ではありません');
  for (const [i, q] of (Array.isArray(d.tunnels) ? d.tunnels : []).entries()) if (!q || !(q.style in TDTunnels.STYLES) || !(q.w > 0) || !(q.h > 0) || !Array.isArray(q.pts) || q.pts.length < 2 || !q.pts.every(p => p && [p.x, p.z, p.y].every(Number.isFinite))) issues.push(`tunnels[${i}]: 形・大きさ・点が不正です`);
  for (const k of ['falls', 'bridges', 'stairs', 'markers', 'springs', 'pools', 'tunnels']) if (d[k] !== undefined && !Array.isArray(d[k])) issues.push(`${k}: 配列ではありません`);
  let sc = null;
  if (d.springCarve !== undefined) { const u = dec('springCarve', d.springCarve); if (u && u.length !== count * 4) issues.push(`springCarve: ${u.length} バイト（${count * 4} バイトが必要）`); else if (u) sc = new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length)); }
  for (const [i, q] of (Array.isArray(d.springs) ? d.springs : []).entries()) if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.z) || !(q.preset in TDSprings.PRESETS)) issues.push(`springs[${i}]: 位置か湧出量の種類が不正です`);
  for (const [i, q] of (Array.isArray(d.pools) ? d.pools : []).entries()) if (!q || !['rect', 'round'].includes(q.type) || ![q.x1, q.z1, q.x2, q.z2, q.floor, q.rim].every(Number.isFinite)) issues.push(`pools[${i}]: 形か大きさが不正です`);
  if (issues.length) throw new Error(`不正な値が ${issues.length} 件あります: ` + issues.slice(0, 3).join(' / ') + (issues.length > 3 ? ' …' : ''));
  return{data:d,newH,sp,spLayers,wo,cm,sc};
}
function deserialize(d,prepared) {
  if (d.format !== 'map-editor-proto') throw new Error('形式が違います');
  if (d.vertices !== N) {
    if (d.resolution === RES && MAP_SIZES.includes(d.size)) return prepareMap('load',0,{data:d});
    throw new Error('サイズが違います');
  }
  const {data,newH,sp,spLayers,wo,cm,sc}=decodeMap(d);d=data;
  if(!prepared){cliffFits.validate(d.cliffFits,d.props,cliffInputSignature(newH,d.falls||[],d.waterLevel));cancelMapPreparation(false);}
  cliffFits.clear();H.set(newH);
  if (spLayers === NS) S.set(sp); else { S.fill(0); for (let k = 0; k < N * N; k++) for (let c = 0; c < spLayers; c++) S[k * NS + c] = sp[k * spLayers + c]; }
  O.set(wo); C.set(cm); walkDirty = true; tunnels = d.tunnels ? JSON.parse(JSON.stringify(d.tunnels)) : []; springs = (d.springs || []).map(q => ({ ...q })); pools = (d.pools || []).map(q => ({ ...q })); if (sc) SC.set(sc); else SC.fill(0); rebuildPools(); props = d.props.map(p => p.slice()); falls = (d.falls || []).map(f => ({ ...f })); bridges = (d.bridges || []).map(b => ({ ...b })); stairs = (d.stairs || []).map(st => ({ ...st })); rebuildFalls(); rebuildBridges(); rebuildStairs(); state.water = d.waterLevel; state.spawn = d.spawn; state.sea = !!d.sea; state.weather = d.weather ? { ...d.weather } : { kind: 'none', amount: .7 }; state.sunOn = d.sunlight !== false; state.timeOfDay = timeId(d.timeOfDay); state.darkness = DARK_LEVELS[d.darkness] ? d.darkness : 'dark'; setMapName(typeof d.name === 'string' ? d.name : ''); state.cliffStyle = CLIFF_STYLES.some(c => c[0] === d.cliffStyle) ? d.cliffStyle : 'standard'; applyCliffStyle(); if ($('cliffStyle')) $('cliffStyle').value = state.cliffStyle; state.atmo = d.atmosphere ? { ...d.atmosphere } : { kind: 'none', amount: .6, height: 3 };
  state.roomId = d.roomId || newRoomId(); state.nextId = d.nextId || 1; state.revision = d.revision || 0;
  state.agent = { ...state.agent, ...(d.agent || {}) }; state.catalog = normalizeCatalog(d.catalog); state.lastExportHash = d.lastExportHash || ''; applyCatalog(); syncAgentUI();
  markers = (d.markers || []).map(m => ({ ...m })); ensureIds();
  applyBiome(d.biome || 'forest');
  syncUI(); updateTerrain(); rebuildTunnels(); solveSprings(); rebuildSpringMarks();if(prepared)cliffFits.installPrepared(prepared,props,cliffInputSignature());else cliffFits.load(d.cliffFits,props,cliffInputSignature()); rebuildProps(); rebuildMarkers();
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    if (typeof CompressionStream === 'undefined') throw Error('ZIP圧縮に対応した最新のブラウザで保存してください');
    const zlib = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    if(zlib.length<6 || (zlib[1]&32)) throw Error('ZIP圧縮形式が不正です');
    const raw = zlib.subarray(2, zlib.length - 4), method = raw.length < data.length ? 8 : 0;
    const packed = method ? raw : data;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true);
    lh.setUint16(8, method, true); lh.setUint32(14, crc, true); lh.setUint32(18, packed.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(lh, name, packed);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint16(10, method, true); ch.setUint32(16, crc, true); ch.setUint32(20, packed.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(ch, name);
    off += 30 + name.length + packed.length;
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
const WEIGHT_LAYERS = ['grass', 'dirt', 'cobble', 'sand', 'rubble', 'swamp', 'poison', 'lava', 'snowfield', 'ice', 'cliff', 'bedrock', 'pureblack'];
async function buildExport({sharedAssets = false} = {}) {
  refreshGroundWeights();
  if(mapPreparation||cliffContactDisabled)throw Error('崖の岩を調整中です。完了後に書き出してください');
  ensureIds(); applyCatalog(); if (walkDirty) computeWalk();
  const validation = runValidation();
  rebuildCliffRelief();
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
  // tunnels (tunnels.js), worked out again on the export heightmap: their mouths and cuttings join the holes (value -2)
  let tunnelExp = null;
  if (tunnels.length) {
    const thB = (x, z) => { const fx = clamp((x + HALF) / TS, 0, TN - 1), fz = clamp((z + HALF) / TS, 0, TN - 1), i = Math.min(Math.floor(fx), TN - 2), j = Math.min(Math.floor(fz), TN - 2), u = fx - i, w = fz - j; return lerp(lerp(TH[j * TN + i], TH[j * TN + i + 1], u), lerp(TH[(j + 1) * TN + i], TH[(j + 1) * TN + i + 1], u), w); };
    const prepE = TDTunnels.prepare(tunnels, thB), th = TDTunnels.holes(prepE, thB, TN, TS, HALF);
    for (let k = 0; k < th.length; k++) if (th[k] && !geo.holes[k]) geo.holes[k] = -2;
    tunnelExp = { prepE, thB, holes: th, mesh: TDTunnels.build(prepE, thB), cap: TDTunnels.cap(prepE, thB, th, TN, TS, HALF, 4) };
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
  const mask = (i, j, ch) => effectiveS[near(i, j) * NS + ch];
  const sBil = (x, z, ch) => {
    const fx = clamp((x + HALF) * RES, 0, N - 1), fz = clamp((z + HALF) * RES, 0, N - 1), i = Math.min(Math.floor(fx), N - 2), j = Math.min(Math.floor(fz), N - 2), u = fx - i, w = fz - j;
    const s = (a, b) => effectiveS[idx(a, b) * NS + ch];
    return lerp(lerp(s(i, j), s(i + 1, j), u), lerp(s(i, j + 1), s(i + 1, j + 1), u), w);
  };
  const maskPngs = [await pngOf((i, j) => [mask(i, j, 0), mask(i, j, 1), 0]), await pngOf((i, j) => [mask(i, j, 2), mask(i, j, 3), mask(i, j, 4)]),
    await pngOf((i, j) => [mask(i, j, 5), mask(i, j, 6), mask(i, j, 7)]), await pngOf((i, j) => [mask(i, j, 8), mask(i, j, 9), mask(i, j, 10)])];
  const W8 = new Uint8Array(TN * TN * WEIGHT_LAYERS.length);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const k = j * TN + i, x = tx(i), z = tx(j), w = new Float32Array(WEIGHT_LAYERS.length); w[0] = 1;
    const add = (L, m) => { if (m <= 0) return; for (let q = 0; q < w.length; q++) w[q] *= 1 - m; w[L] += m; };
    let paintTotal=0;for(let c=0;c<NS;c++){const layer=c>=9?c+2:c+1;w[layer]=sBil(x,z,c)/255;paintTotal+=w[layer];}
    w[0]=Math.max(0,1-paintTotal);if(paintTotal>1)for(let c=0;c<NS;c++)w[c>=9?c+2:c+1]/=paintTotal;
    const g = slopeAt(x, z); add(10, sstep(.24, .42, 1 - 1 / Math.sqrt(1 + g * g)));
    const q8 = Array.from(w, v => Math.floor(v * 255)); let rest = 255 - q8.reduce((a, v) => a + v, 0), top = 0;
    for (let q = 1; q < w.length; q++) if (w[q] > w[top]) top = q;
    q8[top] += rest; for (let q = 0; q < w.length; q++) W8[k * w.length + q] = q8[q];
  }
  const L8 = WEIGHT_LAYERS.length, wgt = (i, j, L) => L < L8 ? W8[(j * TN + i) * L8 + L] : 0;
  const weightPngs = []; for (let b = 0; b < Math.ceil(L8/3); b++) weightPngs.push(await pngOf((i, j) => [wgt(i, j, b * 3), wgt(i, j, b * 3 + 1), wgt(i, j, b * 3 + 2)]));
  const cliffPng = await pngOf((i, j) => { const v = cliffIndexNear(tx(i), tx(j)); return [v, v, v]; });   // style index per export vertex (legend: meta.cliffStyles)
  const walkPng = await pngOf((i, j) => {
    const x = tx(i), z = tx(j), d = deckAt(x, z, 0), o = overrideAt(x, z), auto = autoWalkable(x, z);
    return [walkable(x, z, auto) ? 255 : 0, d ? (d.kind === 'bridge' ? 32 : d.kind === 'pool' ? 40 : d.kind === 'tunnel' ? 56 : 48) : o === 1 ? 128 : o === 2 ? 255 : o === 3 ? 64 : 0, auto ? 255 : 0];
  });
  const ROCKY = ['rock', 'cliff', 'pebble'];
  const csv = ['instanceId,type,assetKey,x,y,z,rotY_deg,scale,scaleY,auto,cliffStyle'].concat(props.map(p => { const t = PROP[p[0]]; return [p[8], t.id, t.assetKey, U.x(p[1]), U.y(t.geo.userData.groundParts?propBaseY(p):(p[7] ?? (heightAt(p[1], p[2]) - (t.groundSink || 0)))), U.z(p[2]), U.yaw(p[3]), p[4].toFixed(3), (p[4] * (p[6] ?? 1)).toFixed(3), p[5], ROCKY.includes(t.id) ? CLIFF_STYLES[cliffIndexNear(p[1], p[2])][0] : ''].join(','); })).join('\n');
  const groundedInstances=props.filter(p=>PROP[p[0]].geo.userData.groundParts&&PROP[p[0]].assetKey==='tdj/'+PROP[p[0]].id);
  // Unityの既存R16地形に合わせて小物の姿勢だけ再評価する。地形/画像/保存座標は変更しない。
  const groundedExportH=groundedInstances.length?Float64Array.from(TH,h=>mn+Math.round(clamp((h-mn)/range,0,1)*65535)/65535*range):null;
  const groundedExportPose=p=>TDPropGrounding.fitParts(PROP[p[0]].geo,p,(x,z)=>TDPropGrounding.surface(groundedExportH,TN,TS,HALF,x,z),PROP[p[0]].groundSink??.001);
  const groundedData={version:1,units:'metres',axes:'Unity X/Y/Z',surface:'heightmap_r16.raw',assets:[...new Set(groundedInstances.map(p=>p[0]))].map(t=>TDPropGrounding.exportAsset(PROP[t])),instances:groundedInstances.map(p=>{const t=PROP[p[0]],v=.86+.28*hash2(p[1]*97|0,p[2]*89|0);return{instanceId:p[8],type:t.id,assetKey:t.assetKey,source:{position:P3(p[1],propBaseY(p),p[2]),yaw:U.yaw(p[3]),scale:[p[4],p[4]*(p[6]??1),p[4]]},tint:[v*(.95+.1*hash2(p[1]*13|0,7)),v,v*(.95+.1*hash2(3,p[2]*17|0))],parts:groundedExportPose(p).map((m,i)=>({id:TDPropGrounding.parts(t.geo)[i].id,...TDPropGrounding.exportPose(m,new THREE.Vector3(HALF,-mn,HALF))}))};})};
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
  const waterIn = { TN, TS, HALF, TH, level: state.water, falls: falls.map(f => ({ id: f.id, x: f.x, z: f.z, w: f.w })), sea: seaMaskFor(TN, TS) };
  const waterRes = TDWater.analyze(waterIn);
  buildExport.lastWater = { input: waterIn, result: waterRes };   // 試験とエディターの水の表示が、書き出しと同じ解析を使うための控え
  // with a sea, the flow images are still written when a river or a lake is left besides it (Unity then builds both; the
  // ordinary water fades out by sea_field.png's sea weight)
  let inland = waterRes.wetCount; if (waterIn.sea) { inland = 0; for (let k = 0; k < TN * TN; k++) if (waterRes.wet[k] && !waterIn.sea[k]) inland++; }
  const waterWhy = BIOME().lava ? 'liquid=lava is not supported yet' : !waterRes.wetCount ? 'no terrain below the water level' : !inland ? 'sea only: the flow images are for lakes and rivers; the surf is described by meta.sea (sea_field.png)' : null;
  for (const w of waterRes.warnings) if (!waterWhy && w.includes('乾いた')) validation.warnings.push('水: ' + w);
  const waterPack = !waterWhy ? TDWater.pack(waterRes) : null;
  const waterPngs = waterPack ? [{ name: 'water_flow.png', data: TDWater.encodePngRGBA(TN, TN, waterPack.flow) }, { name: 'water_mask.png', data: TDWater.encodePngRGBA(TN, TN, waterPack.mask) }] : [];
  // ---- the sea (sea.js): the field its waves follow, and their settings, so that Unity builds the same surf
  let seaPng = null, sea2Png = null, sea = null;
  if (BU.uSea.value && !BIOME().lava) {
    computeShoreField();
    const sh = wGeo.attributes.shore.array, rgba = new Uint8Array(TN * TN * 4), S0 = -20, S1 = 60;
    const field = (x, z) => {   // bilinear over the editor's vertices
      const fx = clamp((x + HALF) * RES, 0, N - 1.0001), fz = clamp((z + HALF) * RES, 0, N - 1.0001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = [0, 0, 0, 0];
      for (const [di, dj, w] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) { const k = ((j + dj) * N + i + di) * 4; for (let c = 0; c < 4; c++) o[c] += sh[k + c] * w; }
      return o;
    };
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {   // row j from the top = editor z min = Unity z max, as every image here
      const [sd, dx, dz, w] = field(tx(i), tx(j)), q = Math.round(clamp((sd - S0) / (S1 - S0), 0, 1) * 65535), ang = Math.atan2(-dz, dx) / (2 * Math.PI), o = (j * TN + i) * 4;
      rgba[o] = q >> 8; rgba[o + 1] = q & 255; rgba[o + 2] = Math.hypot(dx, dz) > .01 ? Math.round((ang + 1) % 1 * 256) % 256 : 0; rgba[o + 3] = Math.round(clamp(w, 0, 1) * 255);
    }
    seaPng = TDWater.encodePngRGBA(TN, TN, rgba);
    // the second field: o = where the crests run relative to s (m) and j = the river's outflow jet (sea.js seaH)
    const sh2 = wGeo.attributes.shore2.array, rgba2 = new Uint8Array(TN * TN * 4), O0 = -40, O1 = 40;
    const field2 = (x, z) => {
      const fx = clamp((x + HALF) * RES, 0, N - 1.0001), fz = clamp((z + HALF) * RES, 0, N - 1.0001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = [0, 0];
      for (const [di, dj, w] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) { const k = ((j + dj) * N + i + di) * 2; o[0] += sh2[k] * w; o[1] += sh2[k + 1] * w; }
      return o;
    };
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
      const [ov, jv] = field2(tx(i), tx(j)), q = Math.round(clamp((ov - O0) / (O1 - O0), 0, 1) * 65535), o = (j * TN + i) * 4;
      rgba2[o] = q >> 8; rgba2[o + 1] = q & 255; rgba2[o + 2] = Math.round(clamp(jv, 0, 1) * 255); rgba2[o + 3] = 255;
    }
    sea2Png = TDWater.encodePngRGBA(TN, TN, rgba2);
    const H0 = waterMat.uniforms.uWaveH.value, sunE = waterMat.uniforms.uSun.value, c3 = c => [+c.r.toFixed(4), +c.g.toFixed(4), +c.b.toFixed(4)];
    sea = {
      version: 2, field: 'sea_field.png', field2: 'sea_field2.png', resolution: TN, cellSize: +TS.toFixed(6),
      encoding: {
        field: `RGBA8, linear, point or bilinear, no mips, clamp; PNG row 0 (top) = Unity z max like every image here. R,G = distance to the still waterline s (m, + at sea, - on land) = (R*256+G)/65535*${S1 - S0}+(${S0}). B = direction to the shore, angle in Unity xz = B/256*360 deg from +x toward +z (0 where there is none). A = sea weight 0..1 (water joined to the map edge = 1, its beach fading out ~4 m inland, enclosed lakes 0).`,
        field2: `RGBA8, linear, as field. R,G = o, where the crests run relative to s (m: the crests follow the coast smoothed over about a wavelength with river mouths closed, held back in front of a river's mouth) = (R*256+G)/65535*${O1 - O0}+(${O0}). B = the river's outflow jet in front of a mouth, B/255 (waves steepen and break against it, and stop inside it). A = 255.`,
        shader: 'MapWater/Sea and the editor run the same code: sea.js (editor) = Assets/MapWater/Runtime/Shaders/MapSeaShared.hlsl (generated). It works in the editor frame: x = Unity x - size/2, z = size/2 - Unity z.',
      },
      waves: { wavelength: TDSea.WAVELENGTH, period: TDSea.PERIOD, height: +H0.toFixed(3), steepenFromDepth: TDSea.STEEPEN_DEPTH, breakDepth: TDSea.BREAK_DEPTH, runupHeight: +(H0 * TDSea.RUNUP_GAIN).toFixed(3), runupReach: TDSea.RUNUP_REACH },
      colors: { shallow: c3(BU.uShallow.value), deep: c3(BU.uDeep.value), space: 'the shader mixes these as given and raises the result to 2.2 (gamma 2.2 to linear), like the editor' },
      sunDirection: [+sunE.x.toFixed(4), +sunE.y.toFixed(4), +(-sunE.z).toFixed(4)],
      note: 'Visual only: walkability, walkable.png and the flow images do not change. Rivers and lakes besides the sea come with the flow images (waterSim); MapWaterBuilder builds them too, faded out where sea_field.png gives the sea.',
    };
  }
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
  // ---- water sources and pools (springs.js), worked out again on the export grid
  const springExp = (springs.length || pools.length) && !BIOME().lava ? TDSprings.solve(springInput(TN, TS, TH)) : null;
  let springPngs = [], springsMeta = undefined, poolsMeta = undefined;
  if (springExp) {
    for (const w of springExp.warnings) validation.warnings.push('水源: ' + w);
    const SW = new Uint8Array(TN * TN * 4), SF = new Uint8Array(TN * TN * 4), SM = new Uint8Array(TN * TN * 4), lo = -2, span = range + 4;
    for (let k = 0; k < TN * TN; k++) {
      SF[k * 4] = SF[k * 4 + 1] = 128; SM[k * 4 + 3] = 255;
      const e = springExp.edge[k]; if (e !== e) continue;
      const v = Math.round(clamp((e - mn - lo) / span, 0, 1) * 65535);
      SW[k * 4] = v >> 8; SW[k * 4 + 1] = v & 255; SW[k * 4 + 2] = springExp.kind[k] * 80; SW[k * 4 + 3] = 255;
    }
    TDSprings.packInto(springExp, SF, SM, { maxSpeed: wo.maxSpeed, bankRange: wo.bankRange, trailMaxCover: wo.trailMaxCover });
    springPngs = [{ name: 'spring_water.png', data: TDWater.encodePngRGBA(TN, TN, SW) }, { name: 'spring_flow.png', data: TDWater.encodePngRGBA(TN, TN, SF) }, { name: 'spring_mask.png', data: TDWater.encodePngRGBA(TN, TN, SM) }];
    const Ux = p => [U.x(p[0]), U.y(p[2]), U.z(p[1])];
    springsMeta = {
      version: 1, water: 'spring_water.png', flow: 'spring_flow.png', mask: 'spring_mask.png', trailMaxCover: wo.trailMaxCover, resolution: TN, cellSize: +TS.toFixed(6), maxSpeed: wo.maxSpeed, bankRange: wo.bankRange, surfaceMin: lo, surfaceSpan: +span.toFixed(6),
      encoding: {
        water: `RGBA8, same grid and rows as water_flow.png (PNG row 0 = Unity z max). R*256+G = surface y (Unity) = value/65535*surfaceSpan + surfaceMin. B = kind*80 (0 dry, 1 stream, 2 pond, 3 pool). A = 255 where the water mesh has a vertex: water, and the dry vertices next to it held just under their ground (so the shore falls between vertices); 0 elsewhere.`,
        flow: 'RGBA8, the same encoding as water_flow.png (R,G flow, B 0.5, A distance to the bank / bankRange), for the springs\' water only.',
        mask: 'RGBA8, the same encoding as water_mask.png: R = foam-trail cover / trailMaxCover (around the plunge pools of the springs\' falls and a few metres downstream). A = 255.',
        mesh: 'Build quads whose four corners have A = 255 and at least one corner of kind 1 or 2; pools (kind 3) get their own flat sheets (see pools). Signed depth = surface - height.',
      },
      model: 'Baked, no simulation: each spring keeps an area wet (preset); the water runs down the steepest way, fills hollows to their brim and spills on (fill-spill-merge, Barnes et al. 2021). Stream channels are already carved into the heightmap.',
      sources: springExp.springs.map(q => ({ id: q.id, preset: q.preset, name: TDSprings.PRESETS[q.preset].name, flowLps: q.q, wetArea: q.area, position: P3(q.x, heightAt(q.x, q.z), q.z), end: q.end, wet: q.wet })),
      ponds: springExp.ponds.map(p => ({ level: U.y(p.level), area: p.area, maxDepth: p.maxDepth, springs: p.springs })),
      streams: springExp.streams.map(st => ({ end: st.end, springs: st.springs, points: st.points.map(q => [...Ux(q), q[3], q[4]]), pointFormat: '[x, surface y, z, width, depth] (Unity, m)' })),
      falls: springExp.falls.map((f, i) => ({ id: 'springfall_' + (i + 1), position: P3(f.x, f.top, f.z), foot: P3(f.foot[0], f.bottom, f.foot[1]), direction: [f.dir[0], -f.dir[1]], width: f.width, top: U.y(f.top), bottom: U.y(f.bottom), lean: f.lean,
        note: 'position = the lip (top of the fall), foot = the plunge pool; the sheet stands in the plunge pool and leans back up to about 0.2 m in front of the lip (lean = horizontal lip-to-foot distance). direction = downstream (Unity xz).' })),
    };
  }
  if (pools.length) poolsMeta = pools.map(p => ({ id: p.id, type: p.type, center: P3((p.x1 + p.x2) / 2, p.floor, (p.z1 + p.z2) / 2), size: [+(p.x2 - p.x1).toFixed(3), +(p.z2 - p.z1).toFixed(3)],
    wall: POOL_WALL, floor: U.y(p.floor), rim: U.y(p.rim), waterLevel: U.y(poolLevel(p)), notch: [p.ox, -p.oz],
    shape: p.type === 'round' ? 'ellipse inscribed in size (x, z), the kerb wall is `wall` m thick inside that outline' : 'axis-aligned rectangle of size (x, z), the kerb wall is `wall` m thick inside it',
    note: 'kerb of dressed stone from floor - 0.35 m (into the ground) to rim; the floor inside is levelled to floor and paved (cobble paint). The notch (about 0.7-0.9 m wide, top just under waterLevel) faces the lowest ground outside: overflow leaves there when a spring is inside. walkable.png marks the kerb top 40; the water inside is walkable when no deeper than agentProfile.maxWaterDepth.' }));
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
      'weights_3.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(9,12), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'weights_4.png': { usage: 'terrain layer weights', layers: WEIGHT_LAYERS.slice(12), sRGB: false, filter: 'bilinear', mipmaps: false, compression: 'none' },
      'mask_0.png': { usage: 'raw paint masks (game logic)', channels: ['dirt', 'cobble', null], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_1.png': { usage: 'raw paint masks (game logic)', channels: ['sand', 'rubble', 'swamp'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_2.png': { usage: 'raw paint masks (game logic)', channels: ['poison', 'lava', 'snowfield'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'mask_3.png': { usage: 'raw paint masks (game logic)', channels: ['ice', 'bedrock', 'pureblack'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      ...(holesPng ? { 'holes.png': { usage: 'terrain holes for secret passages and tunnel mouths: 0 = hole, 255 = keep the surface (TerrainData.SetHoles: true = surface). (heightmap-1)² cells, image row 0 = z max; cell (i, j) spans export vertices i..i+1, j..j+1. Every hole cell is covered by secret_passages_mesh.json (floor / walls / ceiling / cap) or, at a tunnel, by tunnels_mesh.json (its cap, floor and walls)', sRGB: false, filter: 'point', mipmaps: false, compression: 'none' } } : {}),
      'cliff_style.png': { usage: 'rock-wall style index per export vertex (R; legend meta.cliffStyles)', sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
      'walkable.png': { usage: 'walkability (discrete values, never interpolate)', channels: ['final 255=walkable', 'surface 0 ground/32 bridge deck/40 pool kerb/48 stairs/56 tunnel floor/64 secret/128 forced on/255 forced off (forced off wins over decks)', 'auto 255=walkable'], sRGB: false, filter: 'point', mipmaps: false, compression: 'none' },
    },
    groundBlend: { base: 'grass', layers: WEIGHT_LAYERS, rule: 'sequential: for each layer in order, m = smoothstep(lo, hi, mask); all weights *= (1 - m); weight[layer] += m. cliff comes from slope (1 - normal.y).', thresholds: { dirt: [.2, .55], cobble: [.3, .55], others: [.25, .6], cliff: [.24, .42] } },
    groundTypes: Object.fromEntries(GROUND.map((g, i) => [g, { maskFile: `mask_${[0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3][i]}.png`, maskChannel: [0, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2][i], effectId: GROUND_EFFECT[g] || null, speedHint: GROUND_SPEED[i], ...(g === 'lava' ? { blocksWalk: true } : {}) }])),
    agentProfile: { ...state.agent, note: 'walkable.png と validation はこの体格用。大型の敵などは agentProfile を変えて計算し直してください。height は橋・階段の上の障害物の判定にだけ使用（頭上空間は未検査）。' },
    definitions: VALIDATION_DEFS,
    mapName: state.mapName, biome: state.biome, sunlight: state.sunOn, timeOfDay: state.timeOfDay,
    darkness: state.sunOn ? null : { level: state.darkness, skyLightScale: DARK_LEVELS[state.darkness].hemi, overheadFill: DARK_LEVELS[state.darkness].fill, note: 'without sunlight: sky (hemisphere) light × skyLightScale, plus a shadowless overhead directional light of intensity overheadFill in the sun colour' },
    cliffStyle: { default: state.cliffStyle, map: 'cliff_style.png', note: 'Rock-wall style per location: cliff_style.png R = index into cliffStyles (nearest editor vertex, never interpolated). Applies to the terrain cliff faces (cliff layer in weights) and to rock / cliff / pebble props (props.csv cliffStyle column).' },
    cliffStyles: CLIFF_STYLES.map((c, i) => ({ index: i, id: c[0], name: c[1], ...cliffParams(c[2]) })),
    weather: { ...state.weather, wind: WEATHER[state.weather.kind].wind || 0, windDir: [+WIND_DIR.x.toFixed(4), +(-WIND_DIR.y).toFixed(4)] },
    atmosphere: { ...state.atmo, color: ATMOS[state.atmo.kind].color || null },
    water: [{ id: 'water_main', type: 'plane', level: U.y(state.water), liquid: BIOME().lava ? 'lava' : 'water', sea: state.sea,
      waves: sea ? { ...sea.waves, see: 'meta.sea',
        note: 'the editor preview of the surf; meta.sea has its field and settings for Unity (MapWater/Sea)' } : null }],
    waterSim,
    sea,
    spawnPoints: [{ id: state.spawn.id, position: P3(state.spawn.x, spawnY, state.spawn.z), yawDeg: 0 }],
    ports: markers.filter(m => m.kind === 'port').map(portOut),
    enemySpots: markers.filter(m => m.kind === 'enemy').map(spotOut),
    chestSpots: markers.filter(m => m.kind === 'chest').map(spotOut),
    zones: markers.filter(m => m.kind === 'nobattle' || m.kind === 'nospawn').map(zoneOut),
    floorLinks: markers.filter(m => isLink(m.kind)).map(linkOut),
    floorLinksNote: 'magicCircle / stairsUp / stairsDown。tag は行き先（例: B2）。trigger に入ったら階層移動、この階へ来たときは arrival に立たせる。forward はプレイヤーが近づいてくる向き（= Prefab ローカル -Z を yawDeg で回したもの）。colliders は asset_catalog.json の solid をワールドに置いたもの。見た目と当たり判定は assetKey の Prefab で再現。',
    propCatalog: 'asset_catalog.json', props: 'props.csv',
    waterfalls: falls.map(f => { const [ux, uz] = fallDir(f); return { id: f.id, position: P3(f.x, f.bottom, f.z), yawDeg: U.yaw(f.rot), upstream: [+ux.toFixed(4), +(-uz).toFixed(4)], width: f.w, top: U.y(f.top), bottom: U.y(f.bottom), ...(f.sx !== undefined ? { source: [U.x(f.sx), U.z(f.sz)] } : {}) }; }),
    bridges: bridges.map(b => { const pr = bridgeProfile(b); return { id: b.id, type: b.type || 'wood', start: P3(b.x1, pr.y1, b.z1), end: P3(b.x2, pr.y2, b.z2), width: b.w, arch: +pr.arch.toFixed(3), ...(b.type === 'pier' ? { rampLength: +pr.ramp.toFixed(3), deckCurve: 'pier: from start.y (on the land) up to end.y over the first rampLength m (smoothstep), then level; the end stands over the water and has no landing' } : { deckCurve: 'y(t) = lerp(start.y, end.y, t) + arch * sin(pi t); negative arch = rope sag' }) }; }),
    stairs: stairs.map(st => ({ id: st.id, type: st.type, bottom: P3(st.x1, st.y1, st.z1), top: P3(st.x2, st.y2, st.z2), width: st.w, steps: stairSteps(st) })),
    ...(springsMeta ? { springs: springsMeta } : {}), ...(poolsMeta ? { pools: poolsMeta } : {}),
    ...(tunnelExp ? { tunnels: tunnelExp.prepE.map(T => {
      const st = T.st, t = T.t, mouths = [];
      st.forEach((q, k) => { if (q.cls !== 2) return; for (const o of [-1, 1]) { const nb = st[k + o]; if (nb && nb.cls !== 2) mouths.push({ position: P3(q.x, q.y, q.z), outward: [+(q.tx * o).toFixed(4), +(-q.tz * o).toFixed(4)] }); } });
      return { id: t.id, style: t.style, styleName: TDTunnels.STYLES[t.style].name, width: t.w, height: t.h, length: +T.len.toFixed(3), points: t.pts.map(p => P3(p.x, p.y, p.z)), mouths,
        lamps: tunnelExp.mesh.lamps.filter(l => { const q = TDTunnels.nearest(T, l.x, l.z); return q && q.d < t.w; }).map(l => ({ position: P3(l.x, l.y, l.z), color: '#' + l.color.toString(16).padStart(6, '0') })),
        note: 'points = the centre line of the floor (Unity). Stretches with ground over the roof are tunnel (floor, walls, arched roof), those with ground between the floor and the roof are open cuttings. Geometry: tunnels_mesh.json. walkable.png marks the floor 56; walk_floor_r16.raw holds the tunnel floor there (the ground over the roof is a second, upper floor that the images do not hold).' };
    }), tunnelRules: { cutaway: { overTunnelMetres: 7, sightRadius: 1.1, aboveHead: 1.7, note: 'While the hero is under a roof, the editor stops drawing what is above head height over the tunnel within overTunnelMetres, and within sightRadius of the line from the camera to the head (MapTunnelCutaway does the same for the tunnel meshes in Unity; the terrain needs the same in its material).' } } } : {}),
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
- tunnels_mesh.json: トンネルがある場合だけ。床・壁・天井・枠・灯り・口のまわりの地面（cap）の網（Unity の座標、頂点の色つき）。
- holes.png        : 隠し通路・トンネルがある場合だけ。地形の穴（0 = 穴、(解像度-1)² セル）。
- secret_passages_mesh.json : 隠し通路の床・壁・天井・ふた（穴と同じ形から作成。Unity 座標）。meta.secretPassages に輪郭・出入口・検査結果。route と width は目安。
- sea_field.png / sea_field2.png : 海がある場合だけ。sea_field.png は波が進む向きの元（R,G = 水際までの距離、B = 岸への向き、A = 海の重み。海と、それにつながる川の境目は、この重みで混ぜます）。sea_field2.png は波の山の位置（R,G）と、河口から出る川の流れの強さ（B）。Unity の MapWater/Sea がエディターと同じ波・泡・光の網目を作ります（meta.sea）。
- water_flow.png / water_mask.png : 水の流れ（RG=流れ、B=流れ関数、A=岸からの距離）と、滝から流れの筋にそった泡の帯（R）。水の無い部屋・溶岩、海だけの部屋では出ません（海につながる川・池があれば出ます。海の所は sea_field.png の A で見分けます）。読み方は meta.waterSim.encoding。水深は heightmap_r16.raw と水位から Unity 側で作ります。
- cliff_relief_mesh.json : 急斜面がある場合だけ。岩面の実形状（Unity座標・頂点法線・三角形・岩色/苔/濡れ/雪の属性）。meta.terrain.cliffRelief が参照します。表示用の追加メッシュで、歩行用高さ/通行判定は変更しません。Unity側では別途読み込みと材質の割当が必要です。
- cliff_style.png  : 岩壁の種類（場所ごと。R = meta.cliffStyles の番号）。岩・崖石・小石は props.csv の cliffStyle 列。
- walkable.png     : 通行判定（離散値。補間しないでください）。meta.json の agentProfile の体格で計算。
- spring_water.png / spring_flow.png / spring_mask.png : 水源の小川・池・プールの水面の高さ・流れ・滝つぼからの泡の帯（水源かプールがあるときだけ）。符号は meta.json の springs.encoding。
- props.csv        : 小物の配置。instanceId は再書き出しでも変わりません。assetKey は asset_catalog.json の対応表。
- asset_catalog.json : 種類ごとの assetKey と、エディターが使う代理の当たり判定。編集してエディターに読み込めます。
- meta.json        : 座標仕様、開始地点、出入口・敵/宝箱候補・禁止範囲、階層移動（魔法陣・上り/下り階段 = floorLinks）、橋・階段・滝、水、天候、霧。
- validation.json  : 書き出し時の検証結果（エラー ${validation.errors.length} / 警告 ${validation.warnings.length}）。
- map.json         : エディター用の元データ（座標はエディター内部の中心基準。Unity では使いません）。
- shared_assets.json : 共通資産の版とSHA。tdj-shared-<bundleHash>.zipを初回・更新時に保存してください。
- manifest.json    : exporterVersion、revision、exportedAt、各ファイルの大きさと SHA-256、contentHash。

■ 変更の検出（manifest.json）
- contentHash = 「exporterVersion の1行」＋「ファイル名 SHA-256 の行（files の順）」を UTF-8 にした SHA-256。manifest.json 自身は含みません。
- exportedAt と revision は manifest.json にだけ書くので、編集せずに書き出し直すと contentHash は同じです。RAW・画像・カタログ・出力ロジック（exporterVersion）が変われば変わります。
- revision は contentHash が前回の書き出しと変わったときだけ 1 増えます。

■ Prefab の向き（asset_catalog.json の frame）
- Prefab のローカル +Z = プレイヤーが入っていく向き、-Z = 近づいてくる側。回転は yawDeg + yawOffsetDeg。
- 当たり判定（radius / offsets / solid）も同じローカル座標。エディター内部のローカル座標とは z の符号だけが違います。
`;
  const fittedExport=cliffFits.export(props,HALF,mn);for(const f of fittedExport.instances){const p=props.find(p=>p[8]===f.instanceId),v=.86+.28*hash2(p[1]*97|0,p[2]*89|0);f.instanceTint=f.instanceTint||[v*(.95+.1*hash2(p[1]*13|0,7)),v,v*(.95+.1*hash2(3,p[2]*17|0))];f.cliffStyleIndex=cliffIndexNear(p[1],p[2]);}if(fittedExport.instances.length){meta.requiredFeatures=[...(meta.requiredFeatures||[]),'cliffFitsMeshV1'];meta.cliffFits={file:'cliff_fits_mesh.json',instanceIds:fittedExport.instances.map(x=>x.instanceId),replacement:'Replace original renderer and collider per ID; unsupported readers must reject'};}
  const visualFile=terrain.geometry.userData.refinedCells?'terrain_visual_mesh.json':null;
  if(visualFile)meta.terrain.visualSurface={file:visualFile,requiredForVisualParity:true,replace:'terrain renderer only; retain heightmap collider',clipHoles:holesPng?'holes.png':null,stats:terrain.geometry.userData,note:'Apply with the same ground splats, cliff styles and continuous cliffCoverageSlope; do not overlay the old terrain renderer.'};
  const reliefFile=cliffRelief.geometry.index.count?'cliff_relief_mesh.json':null;
  if(reliefFile)meta.terrain.cliffRelief={file:reliefFile,role:'visual rock skin; walking heightfield unchanged',maxOffsetMetres:+cliffRelief.geometry.userData.maxOffset.toFixed(5)};
  const rootPaintPng=await pngOf((i,j)=>[effectiveS[(j*N+i)*NS],effectiveS[(j*N+i)*NS+3],0],N);
  let bedrockPng=null;
  if(S.some((v,i)=>i%NS===9&&v>0)){
    const image=TDBedrock.texture.image;if(!image?.width)throw Error('岩盤の画像を読み込み中です');
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
    bedrockPng=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());
    meta.requiredFeatures=[...(meta.requiredFeatures||[]),'bedrockFloorV1'];
    meta.bedrockFloor={texture:'bedrock.png',channels:'RGB albedo (raw sRGB, one final decode), A shallow relief',sourceScaleMetres:6.428571,patchSpacingMetres:1.8,reliefMetres:.018,sampling:'terrain/bedrock.js bedrockSurface; four continuous interior patches, restrained rotation, explicit mip gradients',note:'対応する床シェーダーが必要です。この変更にはUnity側の実装を含みません。'};
  }
  if(S.some((v,i)=>i%NS===10&&v>0)){
    meta.requiredFeatures=[...(meta.requiredFeatures||[]),'pureBlackFloorV1'];
    meta.pureBlackFloor={id:'pureblack',mask:'mask_3.png',channel:2,weights:'weights_4.png',weightChannel:0,opaque:true,outputRGB:[0,0,0],stage:'after lighting, fog, tone mapping, colour conversion and dithering',cliffs:'existing slope coverage retained',unity:{shader:'MapSharedGround/Grass',maskProperty:'_PureBlackMask',enableProperty:'_PureBlackEnabled',sizeProperty:'_PureBlackMapSize'},note:'Unrelated camera post effects or foreground VFX can still composite over the rendered floor.'};
  }
  const roomTorches = TDWallTorch.exportData(props, PROP, state.roomId, U, propBaseY);
  if (roomTorches) { meta.requiredFeatures = [...(meta.requiredFeatures || []), 'roomTorchesV1']; meta.roomTorches = { file: 'room_torches.json', vfxId: roomTorches.vfxId }; }
  const fireProps=TDFireFixtures.exportData(props,PROP,state.roomId,U,propBaseY);
  if(fireProps)meta.requiredFeatures=[...(meta.requiredFeatures||[]),'firePropsV1'];
  const files = [
    ...(fireProps?[{name:'fire_props.json',data:JSON.stringify(fireProps)}]:[]),
    ...(roomTorches ? [{name:'room_torches.json',data:JSON.stringify(roomTorches)}] : []),
    ...(bedrockPng?[{name:'bedrock.png',data:bedrockPng}]:[]),
    {name:'root_paint.png',data:rootPaintPng},
    ...(fittedExport.instances.length?[{name:'cliff_fits_mesh.json',data:JSON.stringify(fittedExport)}]:[]),
    ...(visualFile?[{name:visualFile,data:JSON.stringify(TDCliffShoulder.exportMesh(terrain.geometry,HALF,mn))}]:[]),
    ...(reliefFile?[{name:reliefFile,data:JSON.stringify(TDCliffRelief.exportMesh(cliffRelief.geometry,HALF,mn))}]:[]),
    { name: 'heightmap_r16.raw', data: heightRaw }, { name: 'walk_floor_r16.raw', data: floorRaw },
    ...weightPngs.map((d, i) => ({ name: `weights_${i}.png`, data: d })), ...maskPngs.map((d, i) => ({ name: `mask_${i}.png`, data: d })),
    ...(holesPng ? [{ name: 'holes.png', data: holesPng }] : []),
    ...(tunnelExp ? [{ name: 'tunnels_mesh.json', data: JSON.stringify(tunnelMeshJson(tunnelExp, P3, mn)) }] : []),
    ...(geo.passages.length ? [{ name: 'secret_passages_mesh.json', data: JSON.stringify({
      format: 'tdj-secret-passage-mesh', frame: 'Unity world, same as meta.json (m)', winding: 'clockwise front faces (Unity)', ceilingHeight: +(state.agent.height + .6).toFixed(2),
      submeshes: ['floor', 'wall', 'ceiling', 'cap'], note: 'cap = terrain surface over hole cells (follows the exported heightmap, bilinear inside each cell; Unity splits a terrain cell into two triangles, so the cap edge can differ from the terrain by the cell\'s bilinear-vs-triangle error).',
      passages: geo.passages.map(g => ({ id: g.id, vertices: g.verts.flatMap(([x, y, z]) => P3(x, y, z)), triangles: g.sub })),
    }) }] : []),
    ...waterPngs, ...springPngs,
    ...(seaPng ? [{ name: 'sea_field.png', data: seaPng }, { name: 'sea_field2.png', data: sea2Png }] : []),
    { name: 'walkable.png', data: walkPng }, { name: 'cliff_style.png', data: cliffPng }, { name: 'props.csv', data: csv },
    { name: 'asset_catalog.json', data: JSON.stringify(catalogExport(), null, 2) },
    ...(groundedInstances.length?[{name:'grounded_props.json',data:JSON.stringify(groundedData)}]:[]),
    { name: 'shared_props.json', data: (()=>{const d=JSON.parse(TDSharedProps.exportJson());d.sourceLibraryVersion=d.libraryVersion;d.libraryVersion='shared-registry/1';return JSON.stringify(d);})() },
    { name: 'asset_bindings.json', data: JSON.stringify({schemaVersion:1,bindings:Object.entries(catalogExport().types).filter(([,v])=>v.sharedModel).map(([id,v])=>({id,...v}))}) },
    {name:'small_props.json',data:JSON.stringify(TDSmallPropExport.build(PROP,groundedData,props.filter(p=>TDSmallPropExport.ids.includes(PROP[p[0]].id)).map(p=>{const v=.86+.28*hash2(p[1]*97|0,p[2]*89|0);return{instanceId:p[8],...(['rowboat','seafan','pillarcoral','scallop','obsidian'].includes(PROP[p[0]].id)?{rootPosition:[U.x(p[1]),U.y(propBaseY(p)),U.z(p[2])]}:{}),tint:[v*(.95+.1*hash2(p[1]*13|0,7)),v,v*(.95+.1*hash2(3,p[2]*17|0))]};})))},
    { name: 'pine_wind.json', data: TDPineWind.exportJson() },
    {name:'root_grounding.json',data:JSON.stringify({version:1,axes:'Unity world XZ',paint:{file:'root_paint.png',resolution:N,sizeMetres:[SIZE,SIZE]},instances:props.filter(p=>PROP[p[0]].sharedAsset&&TDSharedProps.asset(PROP[p[0]].sharedAsset).rootGrounding).map(p=>{const v=rootSlopeAt(p);return{instanceId:p[8],slope:[v[0],-v[1]],terrain:rootTerrainAt(p)};})})},
    { name: 'shared_ground.json', data: JSON.stringify(TDGroundData) },
    { name: 'meta.json', data: JSON.stringify(meta, null, 2) }, { name: 'validation.json', data: JSON.stringify(validation, null, 2) },
    { name: 'map.json', data: mapJson }, { name: 'README.txt', data: readme },
  ];
  const packedExport = sharedAssets ? TDMapStorage.partition(files, sha256) : {sharedFiles:[],sharedName:null};
  if(sharedAssets)files.splice(0, files.length, ...packedExport.files);
  const enc = new TextEncoder(), bytesOf = d => typeof d === 'string' ? enc.encode(d) : d;
  const listing = files.map(f => { const b = bytesOf(f.data); return { name: f.name, bytes: b.length, sha256: sha256(b) }; });
  const contentHash = sha256(enc.encode([EXPORTER_VERSION, ...listing.map(l => `${l.name} ${l.sha256}`)].join('\n')));
  if (contentHash !== state.lastExportHash) { if (state.lastExportHash || !state.revision) state.revision++; state.lastExportHash = contentHash; }
  const manifest = {
    format: 'tdj-map-export-manifest', schemaVersion: sharedAssets ? 4 : 3, exporterVersion: EXPORTER_VERSION, roomId: state.roomId, revision: state.revision, exportedAt: new Date().toISOString(),
    contentHash, contentHashDefinition: 'SHA-256 of the UTF-8 text: exporterVersion, then one line "<name> <sha256>" per entry of files in order, joined with \\n. manifest.json itself is not included; exportedAt and revision live only here.',
    files: listing,
  };
  files.push({ name: 'manifest.json', data: JSON.stringify(manifest, null, 2) });
  return { validation, manifest, files, sharedFiles:packedExport.sharedFiles, sharedName:packedExport.sharedName };
}

// ============================================================
// UI
// ============================================================
const $ = id => document.getElementById(id);
const toastEl = $('toast'); let toastT = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1400); }
const toolsEl = $('tools');
TOOLS.forEach(t => { const b = document.createElement('button'); b.dataset.tool = t.id; b.innerHTML = `${t.name}<kbd>${t.key}</kbd>`; b.onclick = () => setTool(t.id); toolsEl.appendChild(b); });
const fillGroundSel=$('fillGround');
fillGroundSel.add(new Option('草原','grass'));
for(const id of GROUND)fillGroundSel.add(new Option(TOOLS.find(t=>t.id===id).name,id));
fillGroundSel.addEventListener('change',()=>{if(fillGroundSel.value==='bedrock')void bedrockReady().catch(()=>{});});
function fillGroundAll(id){
 const channel=GROUND.indexOf(id);if(id!=='grass'&&channel<0)return false;
 pushUndo();S.fill(0);if(channel>=0)for(let k=0;k<N*N;k++)S[k*NS+channel]=255;
 updateTerrain();regenGroundProps();
 toast('床全体を「'+(channel<0?'草原':TOOLS.find(t=>t.id===id).name)+'」に変更しました（Ctrl+Zで戻せます）');return true;
}
$('fillGroundAll').onclick=()=>fillGroundAll(fillGroundSel.value);
const biomeSel = $('biome'), paletteSel = $('palette');
paletteSel.add(new Option('全て', 'all'));
for (const b of BIOMES) { biomeSel.add(new Option(b.name, b.id)); paletteSel.add(new Option(b.name, b.id)); }
biomeSel.onchange = e => {
  pushUndo(); state.biome = e.target.value;
  state.sunOn = !BIOME().noSun; $('sunOn').checked = state.sunOn;
  const a = BIOME().atmo; state.atmo = { ...state.atmo, kind: a ? a[0] : 'none', amount: a ? a[1] : state.atmo.amount };
  applyBiome(e.target.value); updateTerrain(); regenGroundProps(); toast(`マップのバイオーム: ${BIOME().name}` + (a ? `（${ATMOS[a[0]].name}）` : ''));
};
for(const [id,t] of Object.entries(TIMES)) $('timeOfDay').add(new Option(t.name,id));
$('timeOfDay').onchange = e => { pushUndo(); state.timeOfDay=timeId(e.target.value); applyAtmo(); };
$('sunOn').onchange = e => { pushUndo(); state.sunOn = e.target.checked; applyAtmo(); };
for (const [v, d] of Object.entries(DARK_LEVELS)) $('darkness').add(new Option(d.name, v));
$('darkness').onchange = e => { pushUndo(); state.darkness = e.target.value; applyAtmo(); };
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
// prop types as a folding tree: one group per kind, a group's box checks all its (shown) types
const placeOpen = new Set();   // groups of the 置く list the user opened
const PROP_GROUPS = [
  ['木・倒木', ['pine', 'oak', 'scotspine', 'birch', 'willow', 'hazel', 'rowan', 'juniper', 'deadtree', 'twisttree', 'palm', 'banana', 'maple', 'cherry', 'zelkova', 'nara', 'sugi', 'hinoki', 'islandash', 'olive', 'eucalyptus', 'dragontree', 'elftree', 'worldtree', 'log', 'stump', 'rootfan', 'driftwood']],
  ['草花・低木', ['shortgrass', 'meadowgrass', 'groundlitter', 'grass', 'meadowwhite', 'meadowyellow', 'meadowpink', 'meadowred', 'meadowviolet', 'bush', 'fern', 'bramble', 'ivy', 'sedge', 'foxglove', 'horsetail', 'dock', 'clover', 'reed', 'flowers', 'mushroom', 'glowmush', 'shelfshroom', 'cactus', 'barrelcactus']],
  ['岩・崖', ['drysoil_curl','drysoil_cup','drysoil_flake','scree', 'rock', 'mossrock', 'pebble', 'cliff', 'cliff_split', 'cliff_shoulder', 'cliff_joint', 'cliff_slab', 'cliff_talus', 'rubblepile', 'stalagmite', 'crystal', 'lavarock', 'obsidian', 'fumarole', 'iceblock', 'icespike']],
  ['遺跡・墓', ['column', 'brokencol', 'ruinwall', 'archgate', 'statue', 'statue_seated', 'statue_damaged', 'stele', 'obelisk', 'pyramid', 'gravestone', 'crossgrave', 'mausoleum', 'bones', 'bonepile', 'skullpile', 'magiccircle', 'demonspire']],
  ['海の生き物', ['braincoral', 'staghorn', 'pillarcoral', 'seafan', 'tablecoral', 'roundcoral', 'scallop', 'cowrie', 'shellbits', 'wrack', 'shells']],
  ['坑道小物', ['mine_rail_straight','mine_rail_curve','mine_rail_end','minecart']],
  ['建物・道具', ['wall_torch', 'torch', 'brazier', 'lantern', 'banner', 'woodfence', 'ironfence', 'castlewall', 'tower', 'gatehouse', 'lighthouse', 'rowboat', 'haystack', 'miningtools', 'supplycrate', 'treasurechest_worn', 'treasurechest', 'treasurechest_reinforced', 'treasurechest_ornate', 'treasurechest_silver', 'treasurechest_gold', 'treasurechest_rainbow', 'smallbarrel', 'tiedsack', 'coiledrope', 'storagepot', 'brokenpot', 'snowman', 'kamakura']],
];
// [group name, type indices]; types not in PROP_GROUPS (added later) land in "その他"
function propGroups() {
  const groups = PROP_GROUPS.map(([name, ids]) => [name, ids.map(TYPE).filter(i => i >= 0)]);
  const known = new Set(groups.flatMap(g => g[1])), rest = PROP.map((_, i) => i).filter(i => !known.has(i));
  if (rest.length) groups.push(['その他', rest]);
  return groups;
}
const typesEl = $('types');
{
  for (const [name, list] of propGroups()) {
    const d = document.createElement('details'); d.className = 'pg'; d.open = list.some(i => state.types.has(i));
    d.innerHTML = `<summary><input type="checkbox" class="gall"> ${name}<span class="cnt"></span></summary><div class="pgl"></div>`;
    for (const i of list) { const l = document.createElement('label'); l.dataset.type = i; l.innerHTML = `<input type="checkbox" data-type="${i}"> ${PROP[i].name}`; d.lastChild.appendChild(l); }
    typesEl.appendChild(d);
  }
}
function syncTypesUI() {
  for (const d of typesEl.children) {
    let shown = 0, on = 0;
    for (const l of d.querySelectorAll('label[data-type]')) {
      const i = +l.dataset.type, vis = propVisible(i); l.hidden = !vis; l.firstChild.checked = state.types.has(i);
      if (vis) { shown++; if (state.types.has(i)) on++; }
    }
    d.hidden = !shown; d.querySelector('.cnt').textContent = `${on}/${shown}`;
    const g = d.querySelector('.gall'); g.checked = shown > 0 && on === shown; g.indeterminate = on > 0 && on < shown;
  }
}
typesEl.addEventListener('change', e => {
  if (e.target.classList.contains('gall')) {
    for (const l of e.target.closest('details').querySelectorAll('label[data-type]')) if (!l.hidden) { const i = +l.dataset.type; e.target.checked ? state.types.add(i) : state.types.delete(i); }
  } else { const i = +e.target.dataset.type; e.target.checked ? state.types.add(i) : state.types.delete(i); }
  syncTypesUI();
});
syncTypesUI();

// brush shape (top bar)
function setBrushShape(v) { state.brushShape = v; $('shapeCircle').classList.toggle('on', v === 'circle'); $('shapeSquare').classList.toggle('on', v === 'square'); }
$('shapeCircle').onclick = () => setBrushShape('circle'); $('shapeSquare').onclick = () => setBrushShape('square');

// slots 1-9: a number recalls the tool, its kind, the brush (size, strength, density, shape) and the checked props saved
// with Shift+number (or Shift+click on the top bar). Unregistered numbers keep their tool from TOOLS. Kept in this browser.
const SLOT_KEY = 'tdj-map-editor/slots';
let slots = {}, slotNow = 0;
try { slots = JSON.parse(localStorage.getItem(SLOT_KEY)) || {}; } catch { slots = {}; }
const slotOf = n => slots[n] || (TOOLS.find(t => t.key === String(n)) ? { tool: TOOLS.find(t => t.key === String(n)).id } : null);
function slotLabel(sl) {
  const t = TOOLS.find(t => t.id === sl.tool); if (!t) return '？';
  if (sl.tool === 'place' && sl.variant) return `${t.name}：${PROP[TYPE(sl.variant)]?.name || sl.variant}`;
  if ((sl.tool === 'scatter' || sl.tool === 'erase') && sl.types) { const n = sl.types.map(id => PROP[TYPE(id)]?.name).filter(Boolean); return `${t.name}：${n.slice(0, 2).join('・')}${n.length > 2 ? ` 他${n.length - 2}` : ''}`; }
  return t.name;
}
const storeSlots = () => { try { localStorage.setItem(SLOT_KEY, JSON.stringify(slots)); } catch { } };
function saveSlot(n) {
  const v = state.variant[state.tool];
  slots[n] = { tool: state.tool, variant: v === undefined ? undefined : state.tool === 'place' ? PROP[v].id : v, radius: state.radius, strength: state.strength, density: state.density,
    shape: state.brushShape, types: [...state.types].map(i => PROP[i].id), placeScale: state.placeScale, placeRot: state.placeRot };
  storeSlots(); slotNow = n; renderSlots(); toast(`${n} に登録しました：${slotLabel(slots[n])}`);
}
function useSlot(n) {
  const sl = slotOf(n); if (!sl) return;
  if (!toolVisible(sl.tool)) { toast(`${n}：${slotLabel(sl)} は、いまのパレットでは使えません`); return; }
  if (sl.radius !== undefined) { state.radius = sl.radius; state.strength = sl.strength; state.density = sl.density; syncUI(); }
  if (sl.shape) setBrushShape(sl.shape);
  if (sl.types) { state.types = new Set(sl.types.map(TYPE).filter(i => i >= 0)); syncTypesUI(); }
  if (sl.variant !== undefined) {
    state.variant[sl.tool] = sl.tool === 'place' ? Math.max(0, TYPE(sl.variant)) : sl.variant;
    if (sl.tool === 'place') { preview.geometry = PROP[state.variant.place].roomTorch ? TDWallTorch.previewGeometry : PROP[state.variant.place].geo; state.placeScale = sl.placeScale ?? 1; state.placeRot = sl.placeRot ?? 0; syncPlaceUI(); }
  }
  setTool(sl.tool); slotNow = n; renderSlots(); toast(`${n}：${slotLabel(sl)}`);
}
function renderSlots() {
  const box = $('slots'); box.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const sl = slotOf(n), b = document.createElement('button');
    b.className = (slots[n] ? 'own' : '') + (slotNow === n ? ' on' : '');
    b.innerHTML = `<b>${n}</b><span>${sl ? slotLabel(sl) : '（空き）'}</span>`;
    b.title = `${n}：${sl ? slotLabel(sl) : '空き'}\nクリック／${n} キー：使う\nShift+クリック／Shift+${n}：いまの設定を登録\n右クリック：登録を消す`;
    b.onclick = e => e.shiftKey ? saveSlot(n) : useSlot(n);
    b.oncontextmenu = e => { e.preventDefault(); if (slots[n]) { delete slots[n]; storeSlots(); renderSlots(); toast(`${n} の登録を消しました`); } };
    box.appendChild(b);
  }
}
renderSlots();
const DRAG_TOOLS = ['bridge', 'slope', 'stairs', 'coast', 'pool', 'tunnel'];
const dragWidth = tool => tool === 'tunnel' ? (TDTunnels.SIZES[state.tunnelSize] || TDTunnels.SIZES.normal).w : tool === 'link' ? 2.2 : tool === 'marker' ? clamp(state.radius * .5, 1.5, 6) : tool === 'coast' ? 1 : tool === 'slope' ? clamp(state.radius, 2, 12) : tool === 'stairs' ? clamp(state.radius * .5, 1.2, 4) : clamp(state.radius * .5, 1.6, 4);
function showVariants() {
  const tool = state.tool, box = $('variantBox'), list = $('variants');
  $('groundDetailOpts').hidden = tool !== 'detail';
  if(tool==='detail')syncGroundDetailUI();
  $('markerOpts').hidden = tool !== 'marker' && tool !== 'link';
  $('tunnelOpts').hidden = tool !== 'tunnel';
  if (tool === 'tunnel') for (const [boxId, list, key] of [['tunnelSizes', TDTunnels.SIZES, 'tunnelSize'], ['tunnelSlopes', TDTunnels.SLOPES, 'tunnelSlope']]) {
    const el = $(boxId); el.innerHTML = '';
    for (const [v, q] of Object.entries(list)) { const b = document.createElement('button'); b.textContent = q.w ? `${q.name} ${q.w}×${q.h}m` : q.name; b.classList.toggle('on', state[key] === v); b.onclick = () => { state[key] = v; showVariants(); }; el.appendChild(b); }
  }
  $('markerTag').placeholder = tool === 'link' ? '行き先 例: B2, 上の階' : '例: field, boss, north';
  const opts = tool === 'marker' ? MARKER_KINDS : tool === 'link' ? LINK_KINDS : tool === 'cliffpaint' ? [[0, 'マップの既定'], ...CLIFF_STYLES.map((c, i) => [i + 1, c[1]])] : tool === 'bridge' ? BRIDGE_TYPES.filter(([v]) => inPalette(BRIDGE_TAGS[v]))
    : tool === 'stairs' ? STAIR_TYPES.filter(([v]) => inPalette(STAIR_TAGS[v]))
    : tool === 'spring' ? Object.entries(TDSprings.PRESETS).map(([v, q]) => [v, q.name]) : tool === 'pool' ? POOL_TYPES : tool === 'tunnel' ? TUNNEL_STYLES
    : tool === 'place' ? PROP.map((t, i) => [i, t.name]).filter(([i]) => propVisible(i)) : null;
  if (opts && opts.length && !opts.some(([v]) => v === state.variant[tool])) { state.variant[tool] = opts[0][0]; if (tool === 'place') preview.geometry = PROP[opts[0][0]].roomTorch ? TDWallTorch.previewGeometry : PROP[opts[0][0]].geo; }
  box.hidden = !opts; $('placeOpts').hidden = tool !== 'place';
  if (!opts) return;
  $('variantTitle').textContent = tool === 'marker' ? 'マーカーの種類' : tool === 'link' ? '階層移動の種類' : tool === 'cliffpaint' ? '岩壁の種類' : tool === 'bridge' ? '橋の種類' : tool === 'stairs' ? '階段の種類' : tool === 'spring' ? '湧出量' : tool === 'pool' ? 'プールの形' : tool === 'tunnel' ? '見た目' : '置く物';
  list.innerHTML = '';
  const button = (v, name, box) => {
    const b = document.createElement('button'); b.textContent = name; b.classList.toggle('on', state.variant[tool] === v);
    b.onclick = () => { state.variant[tool] = v; showVariants(); if (tool === 'place') preview.geometry = PROP[v].roomTorch ? TDWallTorch.previewGeometry : PROP[v].geo; };
    box.appendChild(b);
  };
  if (tool !== 'place') { for (const [v, name] of opts) button(v, name, list); return; }
  // things to place: the same folding groups as the prop list; a group stays open or closed while you pick
  for (const [gname, ids] of propGroups()) {
    const shown = opts.filter(([v]) => ids.includes(v)); if (!shown.length) continue;
    const d = document.createElement('details'); d.className = 'pg';
    d.open = placeOpen.has(gname) || shown.some(([v]) => v === state.variant.place);
    d.innerHTML = `<summary>${gname}<span class="cnt">${shown.length}</span></summary><div class="row variants"></div>`;
    d.ontoggle = () => { d.open ? placeOpen.add(gname) : placeOpen.delete(gname); };
    for (const [v, name] of shown) button(v, name, d.lastChild);
    list.appendChild(d);
  }
}
function applyBiome(id) {
  state.biome = (BIOMES.find(b => b.id === id) || BIOMES[1]).id;
  groundTrial.value = TDGroundData.biomes.includes(state.biome) && !location.hash.includes('ground=legacy') ? 1 : 0;
  const B = BIOME(), v3 = (u, c) => u.value.setRGB(c[0], c[1], c[2]);
  scene.background.setHex(B.bg); scene.fog.color.setHex(B.fog ?? B.bg); scene.fog.near = (B.fogNear ?? 140) * FOG_K; scene.fog.far = (B.fogFar ?? 280) * FOG_K;
  hemi.color.setHex(B.sky); hemi.groundColor.setHex(B.ground); hemi.intensity = B.hemi;
  sun.color.setHex(B.sun); sun.intensity = B.sunI; renderer.toneMappingExposure = B.exp;
  v3(BU.uG0, B.g[0]); v3(BU.uG1, B.g[1]); v3(BU.uGH, B.g[2]); v3(BU.uRockTint, B.rock || [1, 1, 1]); v3(BU.uPropTint, B.prop || [1, 1, 1]);
  v3(BU.uShallow, B.water[0]); v3(BU.uDeep, B.water[1]);
  if (B.moss) v3(BU.uMoss, B.moss); BU.uMossAmt.value = B.moss ? 1 : 0;
  BU.uLava.value = B.lava ? 1 : 0; BU.uSea.value = state.sea || B.id === 'beach' ? 1 : 0; computeShoreField(); rebuildWaterSides(); BU.uFlowers.value = B.flowers ?? 1; BU.uSnow.value = B.snow || 0; BU.uSnowLine.value = B.snowLine ?? -100;
  if ($('biome')) $('biome').value = B.id;
  walkDirty = true;
  applyAtmo();
}
function applyPalette() {
  for (const b of toolsEl.children) b.hidden = !toolVisible(b.dataset.tool);
  syncTypesUI();
  if (!toolVisible(state.tool)) setTool('plateau'); else showVariants();
  if (state.palette === 'all') { $('paletteInfo').textContent = '全てのパーツを表示しています。'; return; }
  const all = [...PROP.map(t => t.tags), ...Object.values(BRIDGE_TAGS), ...Object.values(STAIR_TAGS)];
  const own = all.filter(t => t.includes(state.palette)).length, common = all.filter(t => t.includes('common')).length;
  $('paletteInfo').textContent = `小物・橋・階段：専用 ${own}種 ＋ 共通 ${common}種（地形・地面の道具は常に表示）` + (own < 4 ? '（専用パーツは今後追加予定）' : '');
}
function setTool(id) {
  state.tool = id;
  if(id==='grass'||GROUND.includes(id))$('fillGround').value=id;
  if ($('variantBox')) showVariants();
  if ((id.startsWith('walk') || id === 'secret') && !state.showWalk) setWalkView(true);
  for (const b of toolsEl.children) b.classList.toggle('on', b.dataset.tool === id);
  $('hint').textContent = TOOLS.find(t => t.id === id).hint;
  if(id==='bedrock'){void bedrockReady().catch(()=>{});bedrockHint();}
}
const wsf = $('waterShowFlow'), wsm = $('waterShowFoam');
const syncWaterShow = which => { if (which === 'flow' && wsf.checked) wsm.checked = false; if (which === 'foam' && wsm.checked) wsf.checked = false; WATERU.uShow.value = wsf.checked ? 1 : wsm.checked ? 2 : 0; };
wsf.onchange = () => syncWaterShow('flow'); wsm.onchange = () => syncWaterShow('foam');
const sliders = [['radius', v => v.toFixed(1)+' m'], ['strength', v => v.toFixed(2)], ['density', v => v.toFixed(1)], ['water', v => v.toFixed(2)]];
function setBrushRadius(value){state.radius=clamp(Math.round(value*2)/2,1,14);syncUI();}
$('radiusMinus').onclick=()=>setBrushRadius(state.radius-.5);
$('radiusPlus').onclick=()=>setBrushRadius(state.radius+.5);
window.addEventListener('wheel',e=>{if(!e.shiftKey||e.ctrlKey||e.metaKey||e.altKey)return;const delta=e.deltaY||e.deltaX;if(!delta)return;e.preventDefault();e.stopPropagation();setBrushRadius(state.radius-Math.sign(delta)*.5);},{capture:true,passive:false});
function syncUI() { for (const [id, f] of sliders) { $(id).value = state[id]; $(id + 'V').textContent = f(state[id]); } }
for (const [id, f] of sliders) {
  $(id).addEventListener('input', e => {
    state[id] = +e.target.value; $(id + 'V').textContent = f(state[id]);
    if (id === 'water') { updateTerrain(); rebuildProps(); }
  });
  if (id === 'water') $(id).addEventListener('pointerdown', pushUndo);
}
function syncPlaceUI() { $('placeScale').value = state.placeScale; $('placeScaleV').textContent = '×' + state.placeScale.toFixed(2); $('placeRot').value = state.placeRot; $('placeRotV').textContent = state.placeRot + '°'; $('placeRandom').checked = state.placeRandom; }
// Placement shortcuts use the same range controls as the sliders.
function stepPlaceControl(id, direction) {
  const input = $(id);
  if (id === 'placeRot') {
    const min = +input.min, step = +input.step, count = Math.round((+input.max - min) / step) + 1;
    const index = Math.round((state.placeRot - min) / step);
    input.value = min + ((index + direction) % count + count) % count * step;
  } else input.stepUp(direction);
  state[id] = +input.value; syncPlaceUI(); updateRing();
}
$('placeScale').oninput = e => { state.placeScale = +e.target.value; syncPlaceUI(); updateRing(); };
$('placeRot').oninput = e => { state.placeRot = +e.target.value; syncPlaceUI(); updateRing(); };
$('placeRandom').onchange = e => { state.placeRandom = e.target.checked; };
syncPlaceUI();
// 自動下草を手直しした時だけ手置きへ切り替え、次回更新から保護する。
let groundDetailId=null;
const GROUND_DETAIL_IDS=new Set(['drysoil_curl','drysoil_cup','drysoil_flake','scree','shortgrass','meadowgrass','groundlitter','grass','clover','meadowwhite','meadowyellow','meadowpink','meadowred','meadowviolet','pebble','fern','sedge','dock','flowers','mushroom','shells']);
function selectedGroundDetail(){return props.find(p=>p[8]===groundDetailId)||null;}
function pickGroundDetail(x,z){
 let best=null,distance=Infinity;
 for(const p of props){if(!GROUND_DETAIL_IDS.has(PROP[p[0]].id)||!propVisible(p[0]))continue;const d=Math.hypot(p[1]-x,p[2]-z);if(d<Math.max(.22,Math.min(.8,VIS_R[p[0]]*p[4]))&&d<distance){best=p;distance=d;}}
 return best;
}
function syncGroundDetailUI(){
 const p=selectedGroundDetail();$('groundDetailName').textContent=p?PROP[p[0]].name+(p[5]===2?'（自動配置）':'（手置き・保持）'):'草・花・小石・落ち葉をクリックして選択';
 for(const id of ['detailX','detailZ','detailYaw','detailScale','detailApply','detailPin'])$(id).disabled=!p;
 if(!p)return;
 $('detailX').value=p[1].toFixed(2);$('detailZ').value=p[2].toFixed(2);$('detailYaw').value=((p[3]*180/Math.PI%360+360)%360).toFixed(1);$('detailScale').value=p[4].toFixed(3);
}
function adjustGroundDetail(x,z,yaw,scale){
 const p=selectedGroundDetail();if(!p)return false;
 if(![x,z,yaw,scale].every(Number.isFinite)||Math.abs(x)>HALF-.1||Math.abs(z)>HALF-.1||scale<.1||scale>3){toast('位置はマップ内、大きさは0.1〜3で指定してください');return false;}
 pushUndo();p[1]=x;p[2]=z;p[3]=yaw*Math.PI/180;p[4]=scale;p[5]=0;p[7]=null;rebuildProps();syncGroundDetailUI();return true;
}
$('detailApply').onclick=()=>{const ids=['detailX','detailZ','detailYaw','detailScale'];if(ids.some(id=>$(id).value.trim()==='')){toast('位置・向き・大きさを入力してください');return;}if(adjustGroundDetail(...ids.map(id=>+$(id).value)))toast('小物を調整しました。草・小石の更新後も残ります');};
$('detailPin').onclick=()=>{const p=selectedGroundDetail();if(p&&adjustGroundDetail(p[1],p[2],p[3]*180/Math.PI,p[4]))toast('この小物を自動更新から保護しました');};

$('modeEdit').onclick = () => setMode('edit');
$('modePlay').onclick = () => setMode('play');
$('undo').onclick = undo; $('redo').onclick = redo;
$('walkView').onclick = () => setWalkView(!state.showWalk);
if (heroBody) $('heroLookRemy').textContent = `Remy（ゲームの体・身長 ${heroBody.meta.height.toFixed(2)}m）`; else $('heroLookRemy').disabled = true;
$('heroLook').onchange = e => setHeroLook(e.target.value);
setHeroLook(heroBody ? 'remy' : 'box');
$('refreshGroundProps').onclick = () => { pushUndo(); regenGroundProps(); toast('地面の塗りに合わせて草と小石を更新しました'); };
$('autoRocks').onclick = () => prepareMap('rocks', Date.now());
$('newSample').onclick = () => { if(SIZE!==64){reloadAtSize(64,'sample');return;}prepareMap('sample',(Math.random()*1e6)|0); };
$('newSample2').onclick = () => { if(SIZE!==SAMPLE2_SIZE){reloadAtSize(SAMPLE2_SIZE,'sample2');return;}prepareMap('sample2',11); };
$('newFlat').onclick = () => { const size=+$('mapSize').value;if(size!==SIZE){reloadAtSize(size,'flat');return;}prepareMap('flat'); };
$('mapSize').innerHTML = MAP_SIZES.map(v => `<option value="${v}" ${v === SIZE ? 'selected' : ''}>${v} × ${v} m${v === 64 ? '（標準）' : v < 64 ? '（狭い部屋）' : '（広い部屋）'}</option>`).join('');
$('mapSizeNow').textContent = `いまのマップ: ${SIZE} × ${SIZE} m`;
// map name: shown in the tab title, kept in the save data and the export, and used as the file name
const fileSafe = v => v.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80);
function setMapName(v) {
  state.mapName = String(v || '').slice(0, 80);
  if ($('mapName').value !== state.mapName) $('mapName').value = state.mapName;
  document.title = (state.mapName ? state.mapName + ' - ' : '') + 'マップエディター 試作';
}
$('mapName').oninput = e => setMapName(e.target.value);
const baseName = () => fileSafe(state.mapName) || 'map';
const mapBlob = () => new Blob([JSON.stringify(serialize())], { type: 'application/json' });
// 名前を付けて保存 picks a file (Chrome / Edge: File System Access API) that 保存 then overwrites; elsewhere both download
let saveHandle = null;
const showSaveTarget = () => { $('saveTarget').textContent = saveHandle ? `保存先: ${saveHandle.name}（「保存」で上書きします）` : ''; };
async function writeHandle(h) { const w = await h.createWritable(); await w.write(mapBlob()); await w.close(); }
async function saveMap() {
  if (saveHandle) {
    try { await writeHandle(saveHandle); toast(`${saveHandle.name} に上書き保存しました`); return; }
    catch (err) { saveHandle = null; showSaveTarget(); toast('上書きできなかったので、ダウンロードで保存します'); }
  }
  download(baseName() + '.json', mapBlob()); toast(`${baseName()}.json を保存しました`);
}
async function saveMapAs() {
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: baseName() + '.json', types: [{ description: 'マップ (JSON)', accept: { 'application/json': ['.json'] } }] });
      if (!state.mapName) setMapName(h.name.replace(/\.json$/i, ''));
      await writeHandle(h); saveHandle = h; showSaveTarget(); toast(`${h.name} に保存しました`);
    } catch (err) { if (err.name !== 'AbortError') toast('保存できませんでした: ' + err.message); }
    return;
  }
  const v = prompt('マップの名前（ファイル名になります）', state.mapName); if (v === null) return;
  setMapName(v); download(baseName() + '.json', mapBlob()); toast(`${baseName()}.json を保存しました`);
}
const forgetSaveTarget = name => { saveHandle = null; showSaveTarget(); setMapName(name); };   // a new or loaded map is not the file chosen before
$('save').onclick = saveMap;
$('saveAs').onclick = saveMapAs;
$('load').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if(await prepareMap('load',0,{data:d})!==true){e.target.value='';return;}
    forgetSaveTarget(state.mapName || f.name.replace(/\.json$/i, '')); toast(`${state.mapName} を読み込みました`);
  } catch (err) { toast('読み込み失敗: ' + err.message); }
  e.target.value = '';
};
$('export').onclick = async () => {
  const button=$('export');if(button.disabled)return;button.disabled=true;
  try { const { files, validation } = await buildExport({sharedAssets:true}); showValidation(validation);
    download(baseName() + '_export_unity.zip', await makeZip(files));
    toast('UnityデータのZIPを書き出しました。初回・素材更新時は「共通素材（ZIP）」も書き出してください');
  } catch(err) { toast('書き出し失敗: '+err.message); } finally {button.disabled=false;}
};
let gameFolderHandle=null, gameFolderBusy=false;
$('saveGameFolder').onclick=async()=>{
 if(gameFolderBusy||roomPackageBusy)return;
 if(!window.showDirectoryPicker){$('advancedExport').open=true;toast('フォルダへの書き出しにはPC版ChromeまたはEdgeが必要です。「詳細な書き出し」から編集データ＋Unityデータと共通素材のZIPを書き出すこともできます。');return;}
 gameFolderBusy=true;$('saveGameFolder').disabled=true;
 try{
  if(!gameFolderHandle)gameFolderHandle=await window.showDirectoryPicker({id:'totsudan-maps',mode:'readwrite'});
  const before=TDMapPackage.authoringState(serialize()),result=await buildExport({sharedAssets:true});
  if(TDMapPackage.authoringState(serialize())!==before)throw Error('書き出し中に地図が変わりました。もう一度書き出してください。');
  const saved=await TDAssetRegistry.save(gameFolderHandle,result,baseName(),makeZip,sha256);
  showValidation(result.validation);$('sharedAssetsHint').textContent='書き出し先: '+gameFolderHandle.name+'/'+saved.folder+'。素材追加 '+saved.added+' 件、再利用 '+saved.reused+' 件。';
  toast(result.validation.errors.length?'Unity用に書き出しました。取り込み前に検証エラーの修正が必要です。':'Unity用データと必要な共通素材を書き出しました。');
 }catch(e){if(e.name!=='AbortError')toast('Unity用の書き出し失敗: '+e.message);if(e.name==='NotAllowedError')gameFolderHandle=null;}
 finally{gameFolderBusy=false;$('saveGameFolder').disabled=false;}
};
$('saveSharedAssets').onclick = async () => {
  const button=$('saveSharedAssets');if(button.disabled)return;button.disabled=true;
  try {const result=await buildExport({sharedAssets:true});download(result.sharedName,await makeZip(result.sharedFiles));
    $('sharedAssetsHint').textContent='共通素材 '+result.sharedName+' を書き出しました。同名ファイルは1つだけ保管してください。';
  } catch(err) {toast('共通素材の書き出し失敗: '+err.message);} finally {button.disabled=false;}
};
// ZIP内の原稿をそのまま併記し、別々の保存による版違いを防ぐ。
let roomPackageBusy = false;
$('saveRoom').onclick = async () => {
  if (roomPackageBusy) return;
  roomPackageBusy = true; $('saveRoom').disabled = true;
  try {
    ensureIds(); applyCatalog();
    toast('編集データとUnityデータを書き出しています。完了まで編集をお待ちください');
    const pack = await TDMapPackage.create({ name: baseName(), snapshot: serialize, buildExport:()=>buildExport({sharedAssets:true}), makeZip });
    showValidation(pack.validation); download(pack.name, pack.blob);
    toast(pack.validation.errors.length ? '編集データとUnityデータのZIPを書き出しました。検証エラーの修正が必要です' : '編集データとUnityデータのZIPを書き出しました。共通素材も一緒に保管してください');
  } catch (err) { toast('編集データとUnityデータを書き出せませんでした: ' + err.message); }
  finally { roomPackageBusy = false; $('saveRoom').disabled = false; }
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

function setMode(m,prepared=false) {
  if(mapPreparation&&!prepared){mapPreparation.requestedMode=m;return;}
  state.mode = m; document.body.classList.toggle('play', m === 'play');
  $('modeEdit').classList.toggle('on', m === 'edit'); $('modePlay').classList.toggle('on', m === 'play');
  $('modeBtn').textContent = m === 'play' ? '編集' : '歩く';
  hero.visible = m === 'play'; spawnMarker.visible = markerGroup.visible = springMarkGroup.visible = tunnelLineGroup.visible = m === 'edit'; if (m === 'edit') cutU.a.value.w = 0; preview.visible = false;
  if (m !== 'play' && ghosts.size) { ghosts = new Set(); rebuildProps(true); }
  heroStyle(false);if(typeof groundPreview!=='undefined')groundPreview.visible=false;
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
  groundPreview.visible=false;
  preview.visible = false;
  ring.visible = !!hit;
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
  if(state.tool==='detail'){
    const p=selectedGroundDetail()||pickGroundDetail(hit.x,hit.z);
    if(p)outline(circle(p[1],p[2],Math.max(.23,VIS_R[p[0]]*p[4])),0xffd36a,.12);
    else outline(circle(hit.x,hit.z,.25),0xffd36a,.12);
    return;
  }
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
    preview.material=PROP[t].mineCart?cartPreviewMat:PROP[t].mineRail?railPreviewMat:standardPreviewMat;
    if(PROP[t].mineRail){const p=TDMineRails.placement(PROP[t].id,hit.x,hit.z,state.placeRot*Math.PI/180,s0,props,PROP,floorAt);preview.visible=true;preview.position.set(p.x,p.y,p.z);preview.rotation.y=p.rot;preview.scale.setScalar(s0);outline(circle(p.x,p.z,.14),!p.valid?0xff5555:p.snapped?0x68ffb0:0xffd27a,.18);return;}
    if(PROP[t].mineCart){const p=TDMineCart.placement(hit.x,hit.z,state.placeRot*Math.PI/180,s0,props,PROP,floorAt);preview.visible=true;preview.position.set(p.x,p.y,p.z);preview.rotation.y=p.rot;preview.scale.setScalar(s0);outline(circle(p.x,p.z,.6*s0),!p.valid?0xff5555:p.snapped?0x68ffb0:0xffd27a,.18);return;}
    if(PROP[t].geo.userData.groundParts){setGroundPreview(t,hit.x,hit.z,state.placeRot*Math.PI/180,s0);preview.visible=false;}else{preview.visible = true; preview.position.set(hit.x, heightAt(hit.x, hit.z) + (PROP[t].roomTorch ? TDWallTorchSource.defaultMountHeight : 0), hit.z); preview.rotation.y = state.placeRot * Math.PI / 180; preview.scale.setScalar(s0);}
    outline(circle(hit.x, hit.z, VIS_R[t] * s0 * .75 + .15), 0x9cff8a, .15);
    return;
  }
  if (state.tool === 'pool' && stroke.active && stroke.dragStart) {
    const s0 = stroke.dragStart, p = { type: state.variant.pool, x1: Math.min(s0.x, hit.x), z1: Math.min(s0.z, hit.z), x2: Math.max(s0.x, hit.x), z2: Math.max(s0.z, hit.z) }, w = p.x2 - p.x1, l = p.z2 - p.z1;
    outline(w > .1 && l > .1 ? poolRing(p, 0, .4) : circle(hit.x, hit.z, .3), w >= 1.6 && l >= 1.6 && w <= 16 && l <= 16 ? 0xffd27a : 0xff7a6a, .3);
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
    const ok = state.tool === 'marker' || state.tool === 'link' ? true : state.tool === 'tunnel' ? L >= 1 : state.tool === 'coast' ? L >= 2 : state.tool === 'bridge' ? L >= 2 && L <= 26 : state.tool === 'slope' ? L >= 2 && dh / L <= .75 : L >= 1.2 && dh >= .3 && dh / L <= 1.25;
    ring.geometry.attributes.position.needsUpdate = true; ring.material.color.set(ok ? 0xffd27a : 0xff7a6a);
    return;
  }
  if (state.brushShape === 'square' && state.tool !== 'spawn' && state.tool !== 'fall') outline([[hit.x - r, hit.z - r], [hit.x + r, hit.z - r], [hit.x + r, hit.z + r], [hit.x - r, hit.z + r]], 0xffffff, .15);
  else for (let k = 0; k < RING_N; k++) { const t = k / RING_N * Math.PI * 2, x = hit.x + Math.cos(t) * r, z = hit.z + Math.sin(t) * r; a[k * 3] = x; a[k * 3 + 1] = Math.max(heightAt(x, z), state.water) + .15; a[k * 3 + 2] = z; }
  ring.geometry.attributes.position.needsUpdate = true;
  ring.material.color.set(state.tool === 'erase' ? 0xff7a6a : state.tool === 'scatter' || state.tool === 'walkOn' ? 0x9cff8a : state.tool === 'walkOff' ? 0xff6ae0 : state.tool === 'secret' ? 0x6ee6ff : 0xffffff);
}

const preview = new THREE.Mesh(PROP[0].geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: .6, depthWrite: false }));
const standardPreviewMat=preview.material,railPreviewMat=TDMineRails.material().clone();railPreviewMat.transparent=true;railPreviewMat.opacity=.65;railPreviewMat.depthWrite=false;
const cartPreviewMat=TDMineCart.material().clone();cartPreviewMat.onBeforeRender=TDMineCart.material().onBeforeRender;cartPreviewMat.transparent=true;cartPreviewMat.opacity=.65;cartPreviewMat.depthWrite=false;
preview.visible = false; preview.renderOrder = 9; scene.add(preview);
const groundPreview=new THREE.Group(),previewGroundPose=[];groundPreview.visible=false;scene.add(groundPreview);
function setGroundPreview(type,x,z,yaw,scale){
 const t=PROP[type];if(groundPreview.userData.type!==type){groundPreview.clear();TDPropGrounding.parts(t.geo).forEach(part=>{const m=new THREE.Mesh(part.geometry,t.surface?TDSmallPropSurface.material(preview.material,t.surface):preview.material);m.matrixAutoUpdate=false;m.frustumCulled=false;m.renderOrder=9;groundPreview.add(m);});groundPreview.userData.type=type;groundPreview.userData.fit=null;}
 previewGroundPose.splice(0,previewGroundPose.length,type,x,z,yaw,scale,0,1,null);const fit=groundedParts(previewGroundPose);if(groundPreview.userData.fit!==fit){groundPreview.children.forEach((m,i)=>m.matrix.copy(fit.matrices[i]));groundPreview.userData.fit=fit;}groundPreview.visible=true;
}
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
  const [x, y] = toLocal(cx, cy);   // the canvas fills the page from its corner, turned or not
  mouse.set(x / canvas.clientWidth * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  // Rail placement targets the actual tunnel floor even while the terrain roof is visible.
  // Other tools keep their existing terrain picking behavior.
  if(state.tool==='place'&&(PROP[state.variant.place]?.mineRail||PROP[state.variant.place]?.mineCart)){let nearest=null,distance=Infinity;const hitPoint=new THREE.Vector3();for(const t of tunnels)for(let i=0;i+1<t.pts.length;i++){const a=t.pts[i],b=t.pts[i+1],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-6)continue;const nx=-(b.z-a.z)/length*t.w*.5,nz=(b.x-a.x)/length*t.w*.5,corners=[new THREE.Vector3(a.x+nx,a.y,a.z+nz),new THREE.Vector3(b.x+nx,b.y,b.z+nz),new THREE.Vector3(b.x-nx,b.y,b.z-nz),new THREE.Vector3(a.x-nx,a.y,a.z-nz)];for(const ids of [[0,1,2],[0,2,3]])if(ray.ray.intersectTriangle(corners[ids[0]],corners[ids[1]],corners[ids[2]],false,hitPoint)){const d=ray.ray.origin.distanceToSquared(hitPoint);if(d<distance){distance=d;nearest=hitPoint.clone();}}}if(nearest)return nearest;}
  const h = ray.intersectObject(terrain, false)[0];
  return h ? h.point : null;
}
function beginStroke(e) {
  if (!hit) return;
  if(state.tool==='detail'){
   if(e.shiftKey&&selectedGroundDetail()){const p=selectedGroundDetail();adjustGroundDetail(hit.x,hit.z,p[3]*180/Math.PI,p[4]);}
   else {ensureIds();const p=pickGroundDetail(hit.x,hit.z);groundDetailId=p?p[8]:null;syncGroundDetailUI();}
   return;
  }
  pushUndo();
  stroke.active = true; stroke.base = heightAt(hit.x, hit.z); stroke.lower = e.shiftKey; stroke.lastStamp = null;
  if (state.tool === 'place') {
    stroke.active = false;
    const t = state.variant.place, s0 = (PROP[t].sc[0] + PROP[t].sc[1]) / 2 * state.placeScale * (state.placeRandom && !PROP[t].mineRail && !PROP[t].mineCart ? .9 + Math.random() * .2 : 1);
    if(PROP[t].mineRail){const p=TDMineRails.placement(PROP[t].id,hit.x,hit.z,state.placeRot*Math.PI/180,s0,props,PROP,floorAt);if(!p.valid){toast('レールの両端が同じ高さになる平らな場所に置いてください');return;}props.push([t,p.x,p.z,p.rot,s0,0,1,p.y]);rebuildProps();toast(PROP[t].name+(p.snapped?'を端点に接続しました':'を置きました'));return;}
    if(PROP[t].mineCart){const p=TDMineCart.placement(hit.x,hit.z,state.placeRot*Math.PI/180,s0,props,PROP,floorAt);if(!p.valid){toast(p.reason==='scale'?'レールと同じサイズにしてください':p.reason==='track'?'車輪を支えるレールと車止めの余裕を確保してください':'平らな場所に置いてください');return;}props.push([t,p.x,p.z,p.rot,s0,0,1,p.y]);rebuildProps();toast(PROP[t].name+(p.snapped?'をレール上に置きました':'を置きました'));return;}
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
  if (state.tool === 'tunnel' && e.shiftKey) {
    stroke.active = false; const n0 = tunnels.length; tunnels = tunnels.filter(t => { const T = TDTunnels.prepare([t], heightAt)[0], q = T && TDTunnels.nearest(T, hit.x, hit.z); return !(q && q.d < Math.max(t.w / 2 + .5, state.radius * .5)); });
    if (n0 !== tunnels.length) rebuildTunnels(); else undoStack.pop(); toast(n0 !== tunnels.length ? 'トンネルを消しました' : '近くにトンネルがありません'); return;
  }
  if (state.tool === 'slope' || state.tool === 'stairs' || state.tool === 'coast' || state.tool === 'pool' || state.tool === 'tunnel') { stroke.dragStart = { x: hit.x, z: hit.z }; return; }
  if (state.tool === 'bridge') {
    if (e.shiftKey) {
      stroke.active = false; const n0 = bridges.length;
      bridges = bridges.filter(b => distToPolyline(hit.x, hit.z, [[b.x1, b.z1], [b.x2, b.z2]]) > Math.max(state.radius, b.w));
      rebuildBridges(); toast(n0 !== bridges.length ? '橋を消しました' : '近くに橋がありません');
    } else stroke.dragStart = { x: hit.x, z: hit.z };
    return;
  }
  if (state.tool === 'spring') {
    stroke.active = false;
    if (e.shiftKey) { const n0 = springs.length; springs = springs.filter(q => Math.hypot(q.x - hit.x, q.z - hit.z) > Math.max(state.radius, 1)); if (n0 !== springs.length) applySprings(); else undoStack.pop(); toast(n0 !== springs.length ? '水源を消しました' : '近くに水源がありません'); }
    else { const err = placeSpring(hit.x, hit.z, state.variant.spring); if (err) undoStack.pop(); toast(err || `水源（${TDSprings.PRESETS[state.variant.spring].name}）を置きました`); }
    return;
  }
  if (state.tool === 'pool' && e.shiftKey) {
    stroke.active = false; const n0 = pools.length; pools = pools.filter(p => poolDist(p, hit.x, hit.z) > Math.max(state.radius * .5, 1));
    if (n0 !== pools.length) { rebuildPools(); applySprings(); } else undoStack.pop(); toast(n0 !== pools.length ? 'プールを消しました' : '近くにプールがありません'); return;
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
// mouse and pen: left = edit (in both modes), right = turn the view, middle = pan. Touch: see touch gestures below.
let lastClient = [0, 0];   // the pointer in screen coordinates (pick), lastXY in the page's own coordinates (drags)
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') { touchDown(e); return; }
  canvas.setPointerCapture(e.pointerId); canvas.focus(); lastXY = toLocal(e.clientX, e.clientY); lastClient = [e.clientX, e.clientY];
  if (e.button === 2) drag = 'orbit';
  else if (e.button === 1) { drag = 'pan'; e.preventDefault(); }
  else if (e.button === 0) { hit = pick(e.clientX, e.clientY); beginStroke(e); }   // the walk mode edits too
});
function dragView(dx, dy) {
  const c = state.mode === 'edit' ? cam : playCam;
  if (drag === 'orbit') { c.yaw -= dx * .006; if (state.mode === 'edit') c.pitch = clamp(c.pitch + dy * .005, .25, 1.45); }
  else if (drag === 'pan' && state.mode === 'edit') panView(dx, dy);
}
function panView(dx, dy) {
  const s = cam.dist * .0016, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  cam.target.x += (-dx * Math.cos(cam.yaw) + dy * fx) * s; cam.target.z += (dx * Math.sin(cam.yaw) + dy * fz) * s;
}
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') { touchMove(e); return; }
  pointerIn = true;
  const p = toLocal(e.clientX, e.clientY), dx = p[0] - lastXY[0], dy = p[1] - lastXY[1]; lastXY = p; lastClient = [e.clientX, e.clientY];
  dragView(dx, dy);
  hit = pick(e.clientX, e.clientY); if (stroke.active && hit && (state.tool === 'scatter' || state.tool === 'erase')) stampAt(hit);
});
function endStroke() {
  if (stroke.cliffChanged) { stroke.cliffChanged = false; rebuildProps(true); }
  if (stroke.active && markers.length && !['marker', 'link', 'spawn', 'pick', 'place'].includes(state.tool)) rebuildMarkers();   // rings follow edited ground
  if (stroke.groundChanged) { stroke.groundChanged = false; regenGroundProps(); }
  if (stroke.active && stroke.dragStart && hit) {
    const a = stroke.dragStart, c = { x: hit.x, z: hit.z }, w = dragWidth(state.tool);
    if (state.tool === 'bridge') toast(placeBridge(a, c, w, state.variant.bridge) ? '橋を架けました' : '長さ2〜26mの範囲でドラッグしてください');
    else if (state.tool === 'slope') { const err = placeSlope(a, c, w); toast(err || '坂を作りました'); }
    else if (state.tool === 'stairs') { const err = placeStairs(a, c, w, state.variant.stairs); toast(err || '階段を作りました'); }
    else if (state.tool === 'coast') toast(makeCoast(a, c) ? '海岸を作りました' : '2m以上ドラッグしてください');
    else if (state.tool === 'pool') { const err = placePool(a, c, state.variant.pool); toast(err || 'プールを作りました'); }
    else if (state.tool === 'tunnel') { const err = placeTunnel(a, c); toast(err || 'トンネルを掘りました'); }
    else if (state.tool === 'marker') { placeMarker('port', a, c); toast('出入口を置きました'); }
    else if (state.tool === 'link') { placeMarker(state.variant.link, a, c); toast(markerLabel(state.variant.link) + 'を置きました'); }
  }
  // ground the stroke reshaped is the user's now: the springs' carving there is no longer given back when they carve again
  const s0 = undoStack[undoStack.length - 1];
  if (stroke.active && s0 && s0.SC && !['spring', 'pool'].includes(state.tool)) for (let k = 0; k < N * N; k++) if (H[k] !== s0.H[k]) SC[k] = 0;
  if (stroke.active && falls.length && s0 && H.some((h, k) => h !== s0.H[k])) refitFalls();   // placed waterfalls follow the reshaped ground
  stroke.dragStart = null; drag = null; stroke.active = false;
}
canvas.addEventListener('pointerup', e => { if (e.pointerType === 'touch') { touchUp(e); return; } endStroke(); });
canvas.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') touchUp(e, true); else endStroke(); });
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'touch') return; pointerIn = false; hit = null; });

// ---- touch gestures. Walking: one finger turns the view, two fingers pinch to zoom. Editing: one finger edits (it starts
// after a moment, so a second finger can join without editing), two fingers zoom, turn and pan the view.
const touches = new Map(); let pinch = null, touchWait = null;
const pinchOf = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; };
function touchDown(e) {
  canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, toLocal(e.clientX, e.clientY)); pointerIn = false;
  if (touches.size === 1) {
    lastXY = toLocal(e.clientX, e.clientY); lastClient = [e.clientX, e.clientY];
    if (state.mode === 'play') { drag = 'orbit'; return; }
    hit = pick(e.clientX, e.clientY);
    touchWait = setTimeout(() => { touchWait = null; if (touches.size === 1 && hit) beginStroke({ shiftKey: false }); }, 120);
  } else if (touches.size === 2) {
    if (touchWait) { clearTimeout(touchWait); touchWait = null; }
    if (stroke.active) endStroke();
    drag = null; pinch = pinchOf();
  }
}
function touchMove(e) {
  if (!touches.has(e.pointerId)) return;
  const p = toLocal(e.clientX, e.clientY); touches.set(e.pointerId, p);
  if (touches.size >= 2 && pinch) {
    const n = pinchOf(), c = state.mode === 'edit' ? cam : playCam;
    c.dist = state.mode === 'edit' ? clamp(cam.dist * pinch.d / n.d, 6, Math.max(140, SIZE * 2.4)) : clamp(playCam.dist * pinch.d / n.d, 7, 40);
    if (state.mode === 'edit') { cam.yaw -= Math.atan2(Math.sin(n.ang - pinch.ang), Math.cos(n.ang - pinch.ang)); panView(n.m[0] - pinch.m[0], n.m[1] - pinch.m[1]); }
    pinch = n; return;
  }
  const dx = p[0] - lastXY[0], dy = p[1] - lastXY[1]; lastXY = p; lastClient = [e.clientX, e.clientY];
  if (state.mode === 'play') { dragView(dx, dy); return; }
  hit = pick(e.clientX, e.clientY); if (stroke.active && hit && (state.tool === 'scatter' || state.tool === 'erase')) stampAt(hit);
}
function touchUp(e, cancel) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (touches.size === 1) { const [p] = touches.values(); lastXY = p; }   // the finger left over carries on without a jump
  if (touches.size) return;
  if (touchWait) { clearTimeout(touchWait); touchWait = null; if (!cancel && hit && state.mode === 'edit') beginStroke({ shiftKey: false }); }   // a quick tap still places / picks / paints once
  drag = null; endStroke(); hit = null;
}
canvas.addEventListener('wheel', e => {
  if (e.ctrlKey) {
    if (state.mode !== 'edit' || state.tool !== 'place' || mapPreparation || e.metaKey || e.altKey) return;
    e.preventDefault();
    const delta = e.deltaY || e.deltaX;
    if (delta) stepPlaceControl('placeScale', -Math.sign(delta));
    return;
  }
  e.preventDefault();
  if (state.mode === 'edit') cam.dist = clamp(cam.dist * Math.exp(e.deltaY * .0012), 6, Math.max(140, SIZE * 2.4));
  else playCam.dist = clamp(playCam.dist * Math.exp(e.deltaY * .0012), 7, 40);
}, { passive: false });
window.addEventListener('keydown', e => {
  if(mapPreparation){if(e.code==='Tab'){e.preventDefault();setMode(mapPreparation.requestedMode==='edit'?'play':'edit');}else if(e.code==='Escape'){e.preventDefault();cancelMapPreparation(true);}return;}
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); e.shiftKey ? saveMapAs() : saveMap(); return; }
  if (e.target.isContentEditable || ['SELECT','TEXTAREA'].includes(e.target.tagName) || (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox')) return;
  if (state.mode === 'edit' && state.tool === 'place' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing && (e.code === 'KeyQ' || e.code === 'KeyE')) {
    e.preventDefault(); keys.delete(e.code); stepPlaceControl('placeRot', e.code === 'KeyQ' ? -1 : 1); return;
  }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey){const inc=e.key==='+'||e.code==='NumpadAdd'||e.key===']',dec=e.key==='-'||e.code==='NumpadSubtract'||e.key==='[';if(inc||dec){e.preventDefault();setBrushRadius(state.radius+(inc?.5:-.5));return;}}
  if (e.code === 'Tab') { e.preventDefault(); setMode((mapPreparation?.requestedMode||state.mode) === 'edit' ? 'play' : 'edit'); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
  const dg = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (dg && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); e.shiftKey ? saveSlot(+dg[1]) : useSlot(+dg[1]); return; }
  {   // tool keys work while walking too (none of them is a walking key: W A S D Q E Shift)
    const t = TOOLS.find(t => t.key === e.key); if (t && toolVisible(t.id)) { setTool(t.id); return; }
    if (e.key === 'v' || e.key === 'V') { setWalkView(!state.showWalk); return; }
    if ((e.key === 'r' || e.key === 'R') && state.tool === 'place') { state.placeRot = (state.placeRot + 45) % 360; syncPlaceUI(); return; }
  }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// ============================================================
// Phones and tablets: the menu in and out, a stick and a run button for walking, portrait / landscape
// ============================================================
document.body.classList.toggle('touch', TOUCH);
const PANEL_KEY = 'tdj-map-editor/panel';
function setPanel(open) {
  view.panel = open; document.body.classList.toggle('nopanel', !open); $('menuBtn').classList.toggle('on', open);
  try { localStorage.setItem(PANEL_KEY, open ? '1' : '0'); } catch { }
  resize();
}
$('menuBtn').onclick = () => setPanel(!view.panel);
$('modeBtn').onclick = () => setMode((mapPreparation?.requestedMode || state.mode) === 'edit' ? 'play' : 'edit');
{ let saved = null; try { saved = localStorage.getItem(PANEL_KEY); } catch { } setPanel(saved ? saved === '1' : !TOUCH); }   // phones start with the map uncovered
// the stick: x = right, y = forward, each -1..1 (shorter than 1 walks slower)
const joy = { x: 0, y: 0, id: null, run: false };
const JOY_R = 50;
function joyAt(e) {
  const r = $('joy').getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  let [x, y] = view.rotated ? [dy, -dx] : [dx, dy];   // the page is turned 90°: screen down is the page's right
  const l = Math.hypot(x, y); if (l > JOY_R) { x *= JOY_R / l; y *= JOY_R / l; }
  joy.x = x / JOY_R; joy.y = -y / JOY_R;
  $('joyKnob').style.transform = `translate(${x}px,${y}px)`;
}
function joyEnd(e) {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0; $('joyKnob').style.transform = '';
}
$('joy').addEventListener('pointerdown', e => { e.preventDefault(); $('joy').setPointerCapture(e.pointerId); joy.id = e.pointerId; joyAt(e); });
$('joy').addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyAt(e); });
$('joy').addEventListener('pointerup', joyEnd); $('joy').addEventListener('pointercancel', joyEnd);
$('runBtn').addEventListener('pointerdown', e => { e.preventDefault(); joy.run = !joy.run; $('runBtn').classList.toggle('on', joy.run); });
// portrait / landscape: lock the screen where the browser allows it (Android Chrome, in full screen); otherwise (iPhone
// Safari) turn the page itself 90° and lay it out in the other orientation
let orientLocked = false;
function setRotated(on) {
  view.rotated = on; document.body.classList.toggle('rot', on);
  document.body.style.width = on ? innerHeight + 'px' : ''; document.body.style.height = on ? innerWidth + 'px' : '';
  resize();
}
window.addEventListener('resize', () => { if (view.rotated) setRotated(true); });
async function toggleOrientation() {
  if (view.rotated) { setRotated(false); return; }
  if (orientLocked) {
    orientLocked = false; try { screen.orientation.unlock(); } catch { }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
    return;
  }
  const portrait = innerHeight > innerWidth;
  try {
    if (!screen.orientation?.lock || !document.documentElement.requestFullscreen) throw 0;
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    const want = portrait ? 'landscape' : 'portrait';
    // some browsers never settle the promise, or settle it without turning: give up after a moment and turn the page
    await Promise.race([screen.orientation.lock(want), new Promise((_, no) => setTimeout(no, 1500))]);
    if (!screen.orientation.type.startsWith(want)) throw 0;
    orientLocked = true;
  } catch {
    try { screen.orientation.unlock(); } catch { }
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => { });
    setRotated(true);
  }
}
$('rotBtn').onclick = toggleOrientation;

// ============================================================
// Loop
// ============================================================
// brush strokes and the brush outline, in the edit mode and while walking
function editTick(dt) {
  // while walking the camera follows the hero, so the ground under a resting cursor changes: look again every frame
  if (state.mode === 'play' && pointerIn) {
    hit = pick(lastClient[0], lastClient[1]);
    if (stroke.active && hit && (state.tool === 'scatter' || state.tool === 'erase')) stampAt(hit);
  }
  if (stroke.active && hit && !['scatter', 'erase', 'spawn', 'fall'].includes(state.tool)) {
    applyBrush(hit.x, hit.z, Math.min(dt, .05)); updateTerrain(); rebuildProps();
  }
  updateRing();
}
const _tgt = new THREE.Vector3();
let fpsAcc = 0, fpsN = 0, fps = 0;
function update(dt) {
  timeU.value += dt;
  chestPresentation.updateLights(camera);
  TDPineWind.set(timeU.value,BU.uWind.value.x,-BU.uWind.value.y,BU.uWind.value.z);
  for (const [o, sp] of linkSpin) { if (o.geometry.type === 'PlaneGeometry') o.rotation.z += dt * sp; else { o.rotation.y += dt * sp; o.material.opacity = .42 + Math.sin(timeU.value * 2.2) * .1; } }
  { const c = state.mode === 'edit' ? cam.target : player; WU.uCenter.value.set(c.x, (state.mode === 'edit' ? heightAt(c.x, c.z) : player.y) + 2, c.z); }
  if (WEATHER[state.weather.kind]?.lightning) {
    if (flash <= 0 && Math.random() < dt * .18 * state.weather.amount) flash = .4;
    if (flash > 0) { flash -= dt; const f = flash > .3 || (flash > .12 && flash < .2) ? 1 : 0; hemi.intensity = weatherHemi + f * 4; if (flash <= 0) hemi.intensity = weatherHemi; }
  }
  const torchCenter = state.mode === 'edit' ? cam.target : player;
  wallTorches.update(timeU.value, dt, camera, torchCenter, renderer.domElement.height);
  if (wallTorches.metrics.count) wallTorches.updateLights(glowLights, props, PROP, tunnelLamps, torchCenter, timeU.value, dt, dimU.value, heightAt);
  else {
    if (glowTick-- <= 0) { glowTick = 20; updateGlowLights(torchCenter.x, torchCenter.z); }
    glowLights.forEach((l, k) => { l.intensity = l.userData.base * (.85 + .15 * Math.sin(timeU.value * 9 + k * 2.1)) * (1 - .5 * dimU.value); });
  }
  for (const c of [...fallGroup.children, ...springFallGroup.children]) if (c.userData.mist) {
    const t = timeU.value * 1.3 + c.userData.ph; c.scale.setScalar(c.userData.base * (1 + .08 * Math.sin(t))); c.material.opacity = (.34 + .1 * Math.sin(t * .7)) * (1 - .6 * dimU.value);
  }
  const dimT = state.showWalk ? 1 : 0;
  if (dimU.value !== dimT) applyDim(Math.abs(dimT - dimU.value) < .02 ? dimT : lerp(dimU.value, dimT, Math.min(1, dt * 10)));
  const kx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), kz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const ix = kx || joy.x, iz = kz || joy.y, amt = kx || kz ? 1 : Math.min(1, Math.hypot(joy.x, joy.y));   // the stick walks slower when pushed less
  if (state.mode === 'edit') {
    if (ix || iz) {
      const s = cam.dist * .9 * dt, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      cam.target.x = clamp(cam.target.x + (fx * iz + rx * ix) * s, -HALF, HALF); cam.target.z = clamp(cam.target.z + (fz * iz + rz * ix) * s, -HALF, HALF);
    }
    if (state.tool !== 'place') { if (keys.has('KeyQ')) cam.yaw += dt * 1.2; if (keys.has('KeyE')) cam.yaw -= dt * 1.2; }
    if (state.showWalk && walkDirty) computeWalk();
    editTick(dt);
    placeCamera(cam, cam.target);
    // the tunnel tool: over a tunnel, its roof is cut away around the cursor, to see inside
    const tq = state.tool === 'tunnel' && hit && tunnelPrep.length ? TDTunnels.query(tunnelPrep, hit.x, hit.z) : null;
    cutU.a.value.set(hit ? hit.x : 0, tq ? tq.y : 0, hit ? hit.z : 0, tq && tq.cls === 2 ? 6 : 0); cutU.b.value.copy(camera.position);
    spawnMarker.position.set(state.spawn.x, heightAt(state.spawn.x, state.spawn.z) + 1.4 + Math.sin(timeU.value * 3) * .15, state.spawn.z);
  } else {
    editTick(dt);
    if (keys.has('KeyQ')) playCam.yaw += dt * 1.6; if (keys.has('KeyE')) playCam.yaw -= dt * 1.6;
    let mx = 0, mz = 0;
    if (ix || iz) {
      const fx = -Math.sin(playCam.yaw), fz = -Math.cos(playCam.yaw), rx = Math.cos(playCam.yaw), rz = -Math.sin(playCam.yaw);
      mx = fx * iz + rx * ix; mz = fz * iz + rz * ix; const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    }
    walkRef = player.y;   // a tunnel's floor while in it, the ground while above its roof
    const depth = waterAt(player.x, player.z) - floorAt(player.x, player.z);
    const inTun = tunnelPrep.length ? TDTunnels.query(tunnelPrep, player.x, player.z) : null, tunHere = inTun && player.y < inTun.y + inTun.h - .3;
    const onStruct = (bridges.length && bridgeAt(player.x, player.z) !== null) || (stairs.length && stairsAt(player.x, player.z) !== null) || !!tunHere;
    let gs = 1; if (!onStruct) for (let c = 2; c < NS; c++) gs = Math.min(gs, lerp(1, GROUND_SPEED[c], clamp(splatAt(player.x, player.z, c) * 1.6, 0, 1)));
    state.onPoison = !onStruct && splatAt(player.x, player.z, 5) > .5;
    state.onLink = markers.find(m => isLink(m.kind) && (() => { const T = linkTrigger(m); return Math.hypot(player.x - T.x, player.z - T.z) < m.r + state.agent.radius; })()) || null;
    const sp = (keys.has('ShiftLeft') || joy.run ? 8 : 5) * amt * (depth > .15 && !onStruct ? .5 : 1) * gs * dt;
    player.moving = 0;
    if (mx || mz) {
      const nx = player.x + mx * sp, nz = player.z + mz * sp;
      // a move must also keep to the floor the hero stands on: no jumping more than one step (agent.maxStep) up or
      // down, e.g. from a secret passage through its wall onto the cliff top above it
      const f0 = floorAt(player.x, player.z), can = (x, z) => walkable(x, z) && Math.abs(floorAt(x, z) - f0) <= state.agent.maxStep + .05;
      if (can(nx, nz)) { player.x = nx; player.z = nz; player.moving = 1; }
      else if (can(nx, player.z)) { player.x = nx; player.moving = 1; }
      else if (can(player.x, nz)) { player.z = nz; player.moving = 1; }
      const want = Math.atan2(mx, mz); let d = want - player.face; d = Math.atan2(Math.sin(d), Math.cos(d)); player.face += d * Math.min(1, dt * 12);
    }
    player.t += dt * (player.moving ? 1 : 0);
    const gy = floorAt(player.x, player.z);
    player.y = lerp(player.y, gy, Math.min(1, dt * 18)); walkRef = null;
    // under a tunnel's roof (ground over the head): cut away what lies between the camera and the hero
    const roofed = tunHere && heightAt(player.x, player.z) > player.y + 1.6;
    cutU.a.value.set(player.x, player.y, player.z, roofed ? 7 : 0);
    // inside a secret passage: fade what we overlap and keep the hero visible through rock
    const inSecret = overrideAt(player.x, player.z) === 3;
    const g = new Set();
    if (inSecret) for (const p of props) { if (PROP[p[0]].touch&&!PROP[p[0]].tree) continue;   // low plants bend out of the way instead of fading
      const r = VIS_R[p[0]] * p[4] + .35; if (Math.abs(p[1] - player.x) < r && Math.abs(p[2] - player.z) < r && Math.hypot(p[1] - player.x, p[2] - player.z) < r) g.add(p); }
    if (roofed) for (const p of props) { const dx = p[1] - player.x, dz = p[2] - player.z, r = 2.5 + VIS_R[p[0]] * p[4]; if (dx * dx + dz * dz < r * r && heightAt(p[1], p[2]) > player.y + 1.6) g.add(p); }   // what grows on the hill over the tunnel
    if (g.size !== ghosts.size || [...g].some(p => !ghosts.has(p))) { ghosts = g; rebuildProps(true); }
    const buried = inSecret && heightAt(player.x, player.z) > player.y + 1.2;
    if (heroMat.depthTest === buried) {
      // x-ray look while buried in rock, so it reads as "inside the wall", not "on top of it"
      heroStyle(buried);
    }
    if (!buried) { const pu = state.onPoison ? .5 + .5 * Math.sin(timeU.value * 7) : 0; heroGlow(.38 * pu, .05 * pu, .5 * pu); }
    // Remy は歩きのアニメーション（速さに合わせて再生、hero/hero.js）、簡易の人形は上下に揺らすだけ
    const remyShown = heroLook === 'remy';
    if (remyShown) heroBody.animate(dt, player.moving ? sp / Math.max(dt, 1e-4) : 0);
    hero.position.set(player.x, player.y + (player.moving && !remyShown ? Math.abs(Math.sin(player.t * 11)) * .08 : 0), player.z);
    hero.rotation.y = player.face;
    _tgt.set(player.x, player.y + 1, player.z);
    placeCamera(playCam, _tgt);
    cutU.b.value.copy(camera.position);
  }
  updateTouch(dt);
  sun.target.position.set(0, 0, 0);
}
function hud() {
  const n = props.length;
  $('hud').textContent = state.mode === 'edit'
    ? (TOUCH ? `編集モード  小物 ${n}  ${fps} fps\n1本指: 編集 / 2本指: 視点（ズーム・回転・移動）` : `編集モード  小物 ${n}  ${fps} fps\nTab: 歩く`)
    : (TOUCH ? `歩くモード  スティック: 移動 / 走る ボタン\n画面をなぞる: 視点 / 2本指: ズーム` : `歩くモード  WASD: 移動 / Shift: 走る / Q・E: 視点回転\nホイール: ズーム / Tab: 編集へ`) + (state.onPoison ? '\n☠ 毒沼の上（ゲーム側でダメージ）' : '') + (state.onLink ? `\n${state.onLink.kind === 'down' ? '▼' : state.onLink.kind === 'up' ? '▲' : '✦'} ${markerLabel(state.onLink.kind)}${state.onLink.tag ? ' → ' + state.onLink.tag : ''}（ゲームでは階層移動）` : '');
}
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, .1); last = now;
  if(mapPreparation){requestAnimationFrame(frame);return;}
  update(dt);
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++; if (fpsAcc > .5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; hud(); }
  requestAnimationFrame(frame);
}


// サンプルは仕上げ・通路検査・衝突準備まで終えてから操作可能にする。
// 処理中の状態を保存せず、別の生成要求と古い非同期ジョブを混ぜない。
const preparationPanel=document.createElement('div');
preparationPanel.id='mapPreparation';preparationPanel.hidden=true;
preparationPanel.setAttribute('role','status');preparationPanel.setAttribute('aria-live','polite');
preparationPanel.innerHTML='<div><strong>マップを準備しています</strong><p></p><span></span> <button type="button">中止して元に戻す</button></div>';
Object.assign(preparationPanel.style,{position:'fixed',inset:'0',zIndex:'10000',background:'#1119',alignItems:'center',justifyContent:'center',color:'#fff'});
Object.assign(preparationPanel.firstChild.style,{background:'#233039',padding:'24px',borderRadius:'8px',maxWidth:'440px'});
document.body.append(preparationPanel);
preparationPanel.querySelector('button').onclick=()=>cancelMapPreparation(true);
const preparationKeys=new Map();
function unlockPreparation(job){
 clearInterval(job.clock);for(const [el,disabled]of job.controls)el.disabled=disabled;
 // The loaded map may have changed outdoor lighting while controls were locked.
 $('timeOfDay').disabled=!state.sunOn;
 preparationPanel.hidden=true;preparationPanel.style.display='none';keys.clear();stroke.active=false;
}
function cancelMapPreparation(restoreMap=true){
 const old=mapPreparation;stopCliffPreparation();if(!old)return;
 mapPreparation=null;mapPreparationSerial++;unlockPreparation(old);
 if(restoreMap)return prepareMap('restore',0,{snapshot:old.backup,collision:old.backupCollision,metadata:old.backupMetadata,boot:true});
}
function captureCollisionPreparation(){
 const fitted=[];for(const [id,c]of cliffFits.cache){if(c.footprint)fitted.push([id,{pose:cliffFits.records.get(id)?.pose,input:cliffFits.input,footprint:c.footprint,y0:c.y0,y1:c.y1}]);}
 const prototypes=PROP.map(t=>t.footprint?[t.id,t.footprint.fields]:null).filter(Boolean);
 return {version:1,fitted,prototypes,walk:walkDirty?undefined:{signature:walkPreparationSignature(),auto:A.slice(),floor:F.slice(),walk:Uint8Array.from(wkGeo.attributes.walk.array),forced:Uint8Array.from(wkGeo.attributes.forced.array),secret:Uint8Array.from(wkGeo.attributes.secret.array)}};
}
function validFootprint(f){
 return f&&Number.isInteger(f.nx)&&Number.isInteger(f.nz)&&f.nx>0&&f.nz>0&&f.nx*f.nz<2e6&&((f.top instanceof Float32Array&&f.top.length===f.nx*f.nz&&f.top.every(Number.isFinite))||(f.fieldOnly===true&&f.top===undefined&&f.sink===0&&f.fields instanceof Map&&f.fields.size===1&&f.fields.has(20)))&&['x0','z0','R','sink'].every(k=>Number.isFinite(f[k]))&&f.fields instanceof Map;
}
function validFields(fields,n){return fields instanceof Map&&[...fields].every(([key,d])=>Number.isInteger(key)&&key>=0&&d.dist instanceof Float32Array&&d.dist.length===n&&(Array.isArray(d.edge)||d.edge instanceof Float64Array)&&d.edge.length%2===0&&d.edge.every(Number.isFinite)&&d.dist.every(Number.isFinite));}
async function installCollisionPreparation(data,job){
 if(!data||data.version!==1||!Array.isArray(data.fitted)||!Array.isArray(data.prototypes))throw Error('衝突準備の形式が違います');
 const ids=new Map(props.map(p=>[p[8],p]));
 await TDPreparation.each(data.fitted,([id,v])=>{const p=ids.get(id),r=cliffFits.records.get(id);if(!p||!r||v.pose!==r.pose||v.input!==cliffFits.input||!validFootprint(v.footprint)||!validFields(v.footprint.fields,v.footprint.nx*v.footprint.nz)||![v.y0,v.y1].every(Number.isFinite))throw Error('衝突準備と岩が一致しません');Object.assign(cliffFits.get(p),{footprint:v.footprint,y0:v.y0,y1:v.y1});},job);
 await installPrototypePreparation(data,job);
 if(data.walk)installWalkPreparation(data.walk);
}
async function installPrototypePreparation(data,job){
 if(!Array.isArray(data?.prototypes))throw Error('元部品の衝突準備がありません');
 // 完成岩の読込検査も元部品の距離場を使うので、検査より先に復元する。
 const entries=[];await TDPreparation.each(data.prototypes,([id,fields])=>{const f=PROP.find(t=>t.id===id)?.footprint;if(!f||!validFields(fields,f.top.length))throw Error('元部品の衝突準備が違います');entries.push([f,fields]);},job);
 for(const[f,fields]of entries)for(const[key,v]of fields)f.fields.set(key,v);
}
function walkPreparationSignature(){return cliffInputSignature()+'/'+sha256(O)+'/'+sha256(S)+'/'+sha256(new TextEncoder().encode(JSON.stringify([props,bridges,stairs,markers,state.agent,state.biome])));}
function installWalkPreparation(w){
 const count=N*N,flags=a=>a instanceof Uint8Array&&a.length===count&&a.every(x=>x<=1);
 if(!w||w.signature!==walkPreparationSignature()||!flags(w.auto)||!flags(w.walk)||!flags(w.forced)||!flags(w.secret)||!(w.floor instanceof Float32Array)||w.floor.length!==count||!w.floor.every(Number.isFinite))throw Error('通行準備とマップが一致しません');
 A.set(w.auto);F.set(w.floor);wkGeo.attributes.walk.array.set(w.walk);wkGeo.attributes.forced.array.set(w.forced);wkGeo.attributes.secret.array.set(w.secret);
 const pos=wkGeo.attributes.position.array;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=idx(i,j);pos[k*3]=vx(i);pos[k*3+1]=Math.max(H[k],state.water)+.06;pos[k*3+2]=vx(j);}
 for(const n of ['position','walk','forced','secret'])wkGeo.attributes[n].needsUpdate=true;wkGeo.computeBoundingSphere();walkDirty=false;
}
async function preparationKey(kind,seed,job){
 const config=JSON.stringify([kind,seed,SIZE,kind==='sample2'?'ruins':state.biome,state.agent,state.cliffStyle,state.catalog,TDPreparation.version,TDPreparedSamples.recipeVersion,[...document.scripts].filter(s=>!s.dataset.preparedSample&&!s.hasAttribute('data-presentation-only')).map(s=>(s.getAttribute('src')||'').replace('moon-reflection1&','').replace('time-of-day1&','').replace(/app.js\?(walltorch1|firequality1)&/,'app.js?public-label1&')).filter(Boolean)]);
 if(preparationKeys.has(config))return preparationKeys.get(config);
 const hashes=[];
 await TDPreparation.each(PROP,async t=>{if(t.r<=0||t.manualOnly)return;const prep=t.preparationGeo||t.geo,a=prep.attributes.position.array,ix=prep.index?.array;const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),v=>v.toString(16).padStart(2,'0')).join('');hashes.push([t.id,t.r,t.height,t.yawOffset,await hash(a),ix?await hash(ix):'']);},job);
 const key='sample:'+await crypto.subtle.digest('SHA-256',new TextEncoder().encode(config+JSON.stringify(hashes))).then(b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join(''));
 TDPreparation.check(job);preparationKeys.set(config,key);return key;
}
async function stageSnapshot(s,job){return cliffFits.prepareLoad(s.CF,s.P,cliffInputSignature(s.H,s.F,s.W),job);}
async function expandPreparedGeometry(value,job){
 await TDPreparation.each(Object.values(value.snapshot.CF.instances),r=>{
  const d=r.geometry;if(d?.preparedAffineDelta!==1)return;const type=PROP.findIndex(t=>t.id===r.type);if(type<0||cliffFits.sourceHash(type)!==r.sourceSha256||!Array.isArray(r.affine)||r.affine.length!==16||!r.affine.every(Number.isFinite))throw Error('完成岩の元モデルまたは変換が一致しません');
  const g=PROP[type].geo.clone().applyMatrix4(new THREE.Matrix4().fromArray(r.affine));try{for(const[name,v]of Object.entries(d.attributes)){const a=g.attributes[name];if(!a||a.itemSize!==v.size)throw Error('完成岩の属性が一致しません');const direct=v.delta instanceof Int32Array&&v.delta.length===a.array.length,palette=v.values instanceof Int32Array&&v.indices instanceof Uint16Array&&v.indices.length===a.count&&v.values.length%v.size===0&&v.indices.every(i=>i<v.values.length/v.size);if(!direct&&!palette)throw Error('完成岩の頂点差分が一致しません');const bits=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length);for(let i=0;i<bits.length;i++)bits[i]=(bits[i]+(direct?v.delta[i]:v.values[v.indices[Math.floor(i/v.size)]*v.size+i%v.size]))>>>0;}r.geometry=TDCliffFits.describe(g);}finally{g.dispose();}
 },job);
}
function preparedProfile(kind){return{splatChannels:NS,biome:kind==='sample2'?'ruins':state.biome,agent:{...state.agent},cliffStyle:state.cliffStyle,catalog:state.catalog};}
async function buildPreparedSample(kind,seed){
 if(!await prepareMap(kind,seed,{build:true,boot:true}))throw Error('固定サンプルの事前生成に失敗しました');
 const key=await preparationKey(kind,seed),cached=await TDPreparation.get(key);if(!cached?.collision.walk)throw Error('通行準備がありません');
 // 配布前にも完成岩の読込検査を通す。描画用geometryは検査後に破棄する。
 const checked=await stageSnapshot(cached.snapshot);for(const c of checked.cache.values())c.geometry.dispose();
 const readyCollision=captureCollisionPreparation();
 const fields=m=>new Map([...m].map(([k,d])=>[k,{...d,edge:Float64Array.from(d.edge)}]));
 const collision={...readyCollision,fitted:readyCollision.fitted.map(([id,d])=>[id,{...d,footprint:{...d.footprint,top:undefined,fieldOnly:true,fields:fields(d.footprint.fields)}}]),prototypes:readyCollision.prototypes.map(([id,m])=>[id,fields(m)])};
 const value={...cached,kind,seed,size:SIZE,profile:preparedProfile(kind),snapshot:{...cached.snapshot,CF:structuredClone(cached.snapshot.CF),rid:'prepared:'+kind+':'+SIZE+':'+seed},collision};
 for(const r of Object.values(value.snapshot.CF.instances)){
  const type=PROP.findIndex(t=>t.id===r.type),g=PROP[type].geo.clone().applyMatrix4(new THREE.Matrix4().fromArray(r.affine)),attributes={};
  try{for(const[name,v]of Object.entries(r.geometry.attributes)){const a=g.attributes[name],bytes=unb64(v.f32),actual=new Uint32Array(bytes.buffer),expected=new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length);if(a.itemSize!==v.size||actual.length!==expected.length)throw Error('頂点差分を作れません');const delta=new Int32Array(actual.length);let changed=false;for(let i=0;i<delta.length;i++){delta[i]=(actual[i]-expected[i])|0;changed||=delta[i]!==0;}if(changed){const table=[],indices=[],lookup=new Map();for(let i=0;i<delta.length;i+=v.size){const tuple=Array.from(delta.subarray(i,i+v.size)),key=tuple.join(',');let id=lookup.get(key);if(id===undefined){id=table.length/v.size;lookup.set(key,id);table.push(...tuple);}indices.push(id);}attributes[name]=table.length*4+indices.length*2<delta.byteLength&&lookup.size<65536?{size:v.size,values:Int32Array.from(table),indices:Uint16Array.from(indices)}:{size:v.size,delta};}}r.geometry={preparedAffineDelta:1,attributes};}finally{g.dispose();}
 }
 const raw=TDPreparedCodec.encode(value),packed=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 return{key,kind,seed,size:SIZE,profile:value.profile,rawBytes:raw.length,gzipBase64:b64(packed),props:props.length,fits:cliffFits.records.size};
}
async function compilePreparedMap(job){
 if(bedrockPainted){job.progress('岩盤を準備',0,0);await bedrockReady();TDPreparation.check(job);}
 // 風の値・カメラを確定してから初回プログラムを待つ。編集中の別ジョブは適用しない。
 for(;;){TDPreparation.check(job);const mode=job.requestedMode;setMode(mode,true);update(0);job.progress('初回の描画を準備',0,0);await renderer.compileAsync(scene,camera);await TDPreparation.pause(job);if(mode===job.requestedMode)break;}
}
async function prepareMap(kind,seed=7,options={}){
 const previous=mapPreparation;
 const backup=previous?.backup||snapshot(),backupCollision=previous?.backupCollision||captureCollisionPreparation();
 const backupMetadata=previous?.backupMetadata||{name:state.mapName,revision:state.revision,lastExportHash:state.lastExportHash,saveHandle};
 const requestedMode=previous?.requestedMode||state.mode;
 if(previous)cancelMapPreparation(false);else stopCliffPreparation();
 const job={id:++mapPreparationSerial,start:performance.now(),phase:'準備を開始',requestedMode,backup,backupCollision,backupMetadata,controls:[],valid(){return mapPreparation===this;},progress(phase,current,total){this.phase=phase;this.current=current;this.total=total;preparationPanel.querySelector('p').textContent=phase+(total?' '+current+' / '+total:'');}};
 mapPreparation=job;keys.clear();stroke.active=false;
 for(const el of document.querySelectorAll('button,input,select,textarea')){if(preparationPanel.contains(el))continue;job.controls.push([el,el.disabled]);el.disabled=true;}
 preparationPanel.hidden=false;preparationPanel.style.display='flex';job.clock=setInterval(()=>{preparationPanel.querySelector('span').textContent=((performance.now()-job.start)/1000).toFixed(1)+' 秒';},100);
 const viewSettings={atmo:{...state.atmo},weather:{...state.weather},sunOn:state.sunOn,timeOfDay:state.timeOfDay,darkness:state.darkness};
 let staged=null,cacheHit=false,fitStats=null,cacheKey=null,persistent=false,persistentStored=false,outgoingToken=null,preparedSource='generated',bundleBytes=0;
 try{
  await TDPreparation.pause(job);
  if(kind==='restore'){
   staged=await stageSnapshot(options.snapshot,job);TDPreparation.check(job);restore(options.snapshot,staged);staged=null;
   await installCollisionPreparation(options.collision,job);Object.assign(state,{revision:options.metadata.revision,lastExportHash:options.metadata.lastExportHash});setMapName(options.metadata.name);saveHandle=options.metadata.saveHandle;showSaveTarget();
  }else if(kind==='load'||kind==='pending'){
   const incoming=kind==='pending'?await TDPreparation.pending(options.token):options.data;TDPreparation.check(job);if(!incoming)throw Error('読み込むマップの一時データがありません');
   const d=remapPropTypes(incoming),targetSize=MAP_SIZES.includes(d.size)?d.size:SIZE;
   if(d.format!=='map-editor-proto'||d.vertices!==targetSize*RES+1)throw Error('サイズまたは形式が違います');
   const decoded=decodeMap(d,targetSize);job.progress('保存マップの岩を読み込み',0,0);
   staged=await cliffFits.prepareLoad(d.cliffFits,d.props,cliffInputSignature(decoded.newH,d.falls||[],d.waterLevel,targetSize),job);TDPreparation.check(job);
   if(d.vertices!==N){
    if(d.resolution!==RES||!MAP_SIZES.includes(d.size))throw Error('サイズまたは形式が違います');
    // 不正な入力は現在のマップを保ったまま拒否。形状の一時メモリはページ変更前に解放する。
    for(const c of staged.cache.values())c.geometry.dispose();staged=null;
    job.progress('サイズ変更後へ保存マップを引き継ぐ',0,0);outgoingToken=crypto.randomUUID();
    if(!await TDPreparation.stash(outgoingToken,d))throw Error('サイズ変更用の一時保存ができません（ブラウザの保存容量・設定を確認してください）');
    TDPreparation.check(job);if(kind==='pending')await TDPreparation.clearPending(options.token);TDPreparation.check(job);
    if(!reloadAtSize(d.size,'prepared:'+outgoingToken))throw Error('サイズ変更の識別子を保存できません');return 'redirected';
   }
   TDPreparation.check(job);deserialize(d,staged);staged=null;
  }else{
   if(kind==='sample'||kind==='sample2'){
    job.progress('完成済みサンプルを照合',0,0);cacheKey=await preparationKey(kind,seed,job);let cached=options.build?null:await TDPreparation.get(cacheKey);TDPreparation.check(job);
    for(let attempt=0;attempt<2&&!cacheHit;attempt++){
    if(!cached&&!options.build){const bundled=await TDPreparedSamples.load({kind,seed,size:SIZE,key:cacheKey,profile:preparedProfile(kind)},job);if(bundled){cached=bundled.value;preparedSource='bundle';bundleBytes=bundled.bytes;}}
    if(!cached)break;
    if(cached)try{
     if(cached.key!==cacheKey||cached.version!==1)throw Error('古いサンプル準備です');
     await installPrototypePreparation(cached.collision,job);if(preparedSource==='bundle')await expandPreparedGeometry(cached,job);staged=await stageSnapshot(cached.snapshot,job);TDPreparation.check(job);restore(cached.snapshot,staged,true);staged=null;await installCollisionPreparation(cached.collision,job);rebuildMarkers();cacheHit=true;if(preparedSource!=='bundle')preparedSource='cache';
     // 完成テンプレートの個体IDは維持し、新しい部屋の識別子だけを発行する。
     state.roomId=newRoomId();state.revision=0;state.lastExportHash='';Object.assign(state,viewSettings);applyAtmo();syncUI();
    }catch(e){if(e.name==='AbortError'||preparedSource==='bundle')throw e;for(const c of staged?.cache.values()||[])c.geometry.dispose();staged=null;cacheHit=false;cached=null;await TDPreparation.remove(cacheKey);TDPreparation.check(job);}
    }
   }
   if(!cacheHit){
    if(kind!=='rocks')cliffFits.clear();colliders=null;cliffContactStats=null;
    if(kind==='flat'){// genFlat の外部キャンセルを管理済みジョブでは行わない
     const active=mapPreparation;mapPreparation=null;genFlat();mapPreparation=active;
    }else await TDPreparation.run(kind==='rocks'?autoRocksSteps(seed):kind==='sample2'?sample2Steps(seed):sampleSteps(seed),job);
    TDPreparation.check(job);applyBiome(state.biome);syncUI();updateTerrain();rebuildProps();rebuildFalls();rebuildBridges();rebuildStairs();rebuildMarkers();
    if(kind!=='flat'){
     job.progress('崖の接地と通路を確認',0,0);fitStats=await fitCliffContact(job);TDPreparation.check(job);if(fitStats?.error||fitStats?.cancelled)throw Error(fitStats.error||'岩の準備を完了できませんでした');
    }
   }
  }
  job.progress('歩行用の衝突を準備',0,props.length);await primeCollisionFields(props,job);TDPreparation.check(job);const walkReused=!walkDirty;if(walkDirty)computeWalk();
  if(cacheKey&&(!cacheHit||preparedSource==='bundle')){
   job.progress('完成状態を再利用用に保存',0,0);persistent=(kind==='sample'&&seed===7)||(kind==='sample2'&&seed===11);
   // 別領域のキャッシュ。ユーザーのファイルや保存先を上書きしない。
   const value={version:1,key:cacheKey,snapshot:snapshot(),collision:captureCollisionPreparation()};
   TDPreparation.check(job);persistentStored=await TDPreparation.put(cacheKey,value,persistent);TDPreparation.check(job);
  }
  await compilePreparedMap(job);TDPreparation.check(job);job.progress('最初の画面を描画',0,0);await TDPreparation.pause(job);const firstRender=performance.now();renderer.render(scene,camera);job.firstRenderMs=performance.now()-firstRender;await TDPreparation.pause(job);
  if(kind==='pending'){await TDPreparation.clearPending(options.token);if(sessionStorage.getItem('me_pending')==='prepared:'+options.token)sessionStorage.removeItem('me_pending');TDPreparation.check(job);}
  if(!options.boot){undoStack.push(backup);if(undoStack.length>40)undoStack.shift();redoStack.length=0;if(kind!=='rocks'&&kind!=='load')forgetSaveTarget(kind==='sample'?'サンプル':kind==='sample2'?'サンプル2（隠し通路）':'');}
  lastPreparedState={kind,seed,cacheHit:cacheHit&&preparedSource==='cache',persistent,persistentStored,preparedSource,bundleBytes,walkReused,elapsedMs:performance.now()-job.start,firstRenderMs:job.firstRenderMs,props:props.length,fits:cliffFits.records.size,fitStats};
  mapPreparation=null;unlockPreparation(job);hud();toast(kind==='restore'?'元のマップに戻しました':'準備が完了しました（'+(lastPreparedState.elapsedMs/1000).toFixed(1)+'秒）');return true;
 }catch(e){
  for(const c of staged?.cache.values()||[])c.geometry.dispose();
  if(outgoingToken)await TDPreparation.clearPending(outgoingToken);if(kind==='pending'){await TDPreparation.clearPending(options.token);if(sessionStorage.getItem('me_pending')==='prepared:'+options.token)sessionStorage.removeItem('me_pending');}
  if(!job.valid())return false;
  mapPreparation=null;unlockPreparation(job);
  if(e.name!=='AbortError'){console.error(e);toast('準備失敗: '+e.message);}
  if(kind==='restore'){lastPreparedState={kind,error:e.message,elapsedMs:performance.now()-job.start};return false;}
  // 失敗時も部分生成をユーザーのマップとして残さない。
  await prepareMap('restore',0,{snapshot:backup,collision:backupCollision,metadata:backupMetadata,boot:true});if(e.name!=='AbortError')toast('準備失敗: '+e.message);return false;
 }
}

// ============================================================
// Boot
// ============================================================
let bootPending = null;
try { bootPending = sessionStorage.getItem('me_pending'); if(!bootPending?.startsWith('prepared:'))sessionStorage.removeItem('me_pending'); } catch (e) { }
genFlat();
applyCatalog(); applyBiome(state.biome); applyCliffStyle(); applyPalette(); setTool('plateau'); syncUI(); resize(); updateTerrain(); rebuildProps(); rebuildFalls(); rebuildBridges(); rebuildStairs(); rebuildMarkers(); hud();
requestAnimationFrame(frame);
let bootData=null;if(bootPending?.[0]==='{')try{bootData=JSON.parse(bootPending);}catch(e){toast('読み込み失敗: '+e.message);bootPending='flat';}
const bootReady=bootPending?.startsWith('prepared:')?prepareMap('pending',0,{token:bootPending.slice(9),boot:true}):bootData?prepareMap('load',0,{data:bootData,boot:true}):
  prepareMap(bootPending==='sample2'&&SIZE===SAMPLE2_SIZE?'sample2':bootPending==='flat'||SIZE!==64?'flat':'sample',bootPending==='sample2'?11:7,{boot:true});

// hooks for automated checks
window.__app = { chestPresentation, wallTorches, bedrockReady, splatAt,get tunnels() { return tunnels; }, set tunnels(v) { tunnels = v; }, get tunnelPrep() { return tunnelPrep; }, get tunnelLamps() { return tunnelLamps; }, placeTunnel, rebuildTunnels, tunnelGroup, tunnelHoleTex, cutU, refitFalls, placeFall, springFallGroup, fallGroup, get springs() { return springs; }, set springs(v) { springs = v; }, get pools() { return pools; }, get springRes() { return springRes; }, SC, placeSpring, placePool, applySprings, solveSprings, waterAt, springLevelAt, poolDist, poolWallAt, POOL_WALL, deckAt, fillGroundAll,buildPreparedSample,prepareMap,cancelMapPreparation,bootReady,get preparation(){return mapPreparation?{id:mapPreparation.id,phase:mapPreparation.phase,requestedMode:mapPreparation.requestedMode,elapsedMs:performance.now()-mapPreparation.start}:null;},get preparationStats(){return lastPreparedState;},
  propGrounding,groundedParts,groundedNormal,groundedGhost,groundPreview,setGroundPreview,propBaseY,get cliffContactProgress(){return cliffContactProgress;},cliffFits,effectiveGeometry,fitCliffContact,adoptCliffContact, cliffProtected,cliffProtectionReason,nearFeatureReason, get cliffContactStats(){return cliffContactStats;},
  pickGroundDetail,adjustGroundDetail,selectedGroundDetail,updateTouch,touchStats, pavingMask, cliffRelief, rebuildCliffRelief, groundTrial, groundTexture, terrainSource:tGeo, terrain, renderer, camera, SIZE, state, H, S, O, F, C, propMeshes, ghostMeshes, cliffIndexAt, BIOMES, CLIFF_STYLES, applyCliffStyle, deckAt, linkDeckAt, runValidation, genSample, genSample2, secretRegions, secretLineX, passageGeometry, terrainRes, TERRAIN_RES, snapshot, sha256, LINK_KINDS, normalizeCatalog, catalogExport, valueIssues, areaIssue, deckAt, getColliders, PROP, get colliderMaxR() { return colliderMaxR; }, rebuildMarkers, portLanding, linkTrigger, linkArrival, LINK_SPEC, get markers() { return markers; }, placeMarker, ensureIds, applyCatalog, ATMOS, WEATHER, applyAtmo, makeCoast, glowLights, applyBiome, applyPalette, TIMES, timeId, propVisible, toolVisible, updateTerrain, rebuildProps, genFlat, floorAt, bridgeAt, stairsAt, placeSlope, placeStairs, placeBridge, pickTarget, regenGroundProps, rebuildBridges, get stairs() { return stairs; }, get bridges() { return bridges; }, get falls() { return falls; }, overrideAt, heroMat, hero, heroBody, get heroLook() { return heroLook; }, setHeroLook, heroStyle, heroGlow, get ghosts() { return ghosts; }, get props() { return props; }, cam, playCam, player, keys, setMode, setTool, update, heightAt, walkable, slope: slopeAt,
  stroke(x, z, frames = 20, opts = {}) {
    hit = new THREE.Vector3(x, heightAt(x, z), z); beginStroke({ shiftKey: !!opts.shift });
    for (let f = 0; f < frames; f++) { if (stroke.active && !['scatter', 'erase'].includes(state.tool)) { applyBrush(x, z, 1 / 60); } }
    stroke.active = false; updateTerrain(); rebuildProps(); if (falls.length) refitFalls();
  },
  moonStrength, waterMat, water, waterSides, sun,
  render() { renderer.render(scene, camera); },
  setTime(t) { timeU.value = t; }, get time() { return timeU.value; },
  serialize, deserialize, buildExport, makeZip, undo, redo, refreshWaterData, WATERU, get waterInfo() { return waterInfo; }, syncWaterShow,
  TOUCH, view, joy, setPanel, setRotated, toLocal, get strokeActive() { return stroke.active; },
};
})();
