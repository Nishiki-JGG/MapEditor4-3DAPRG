// The sea's shader code is written once (sea.js) and copied to Unity (MapSeaShared.hlsl) by tools/sea/build-sea-hlsl.cjs.
// Checks: the Unity copy is up to date, and the shared code keeps to the dialect both GLSL and HLSL read.
//   node tests/sea_hlsl_sync.cjs
const fs = require('fs'), assert = require('assert');
const { loadSea, out, hlsl } = require('../tools/sea/build-sea-hlsl.cjs');
const S = loadSea(), code = S.COMMON + S.SHADE, checks = [];
const check = (name, ok, detail) => { checks.push([name, ok, detail]); };
check('Unity の MapSeaShared.hlsl が sea.js と同じ（node tools/sea/build-sea-hlsl.cjs で作り直す）', fs.existsSync(out) && fs.readFileSync(out, 'utf8') === hlsl());
const bad = [
  [/\b(vec[234]|mat[234])\s*\(/, 'GLSL の型（float2/3/4 を使う）'], [/\bfract\s*\(/, 'fract（frac を使う）'], [/\bmix\s*\(/, 'mix（lerp を使う）'],
  [/\bmod\s*\(/, 'mod（seaMod を使う）'], [/\batan\s*\(/, 'atan(y,x)（atan2 を使う）'], [/\bsaturate\s*\(/, 'saturate（three.js と重なる。clamp を使う）'],
  [/\bfloat[234]\(\s*[^,()]*\)/, '1 つだけの引数の float2/3/4(...)（HLSL では使えない）'], [/^\s*(const|uniform|varying|static|in|out)\s/m, '大域の const / uniform / varying / static'],
  [/\btexture2?D?\s*\(/, 'テクスチャ読み（共有のコードでは使わない）'],
];
for (const [re, what] of bad) { const m = code.match(re); check('共有のコードに ' + what + ' が無い', !m, m && m[0]); }
const used = new Set(code.match(/\bsea[A-Z]\w*/g)), defined = new Set([...code.matchAll(/\b(?:float[234]?|void)\s+(sea\w+)\s*\(/g)].map(m => m[1]));
const globals = ['seaTime', 'seaWaveH', 'seaSun', 'seaShallow', 'seaDeep', 'seaView'], unknown = [...used].filter(n => !defined.has(n) && !globals.includes(n));
check('共有のコードが読む大域は seaTime・seaWaveH・seaSun・seaShallow・seaDeep・seaView だけ', !unknown.length, unknown.join(','));
const shader = fs.readFileSync(out.replace('MapSeaShared.hlsl', 'MapSea.shader'), 'utf8');
check('MapSea.shader がこの大域をすべて宣言して代入する', globals.every(g => new RegExp('static\\s+float3?\\s+[^;]*\\b' + g + '\\b').test(shader) && new RegExp('\\b' + g + '\\s*=').test(shader)));
check('MapSea.shader が MapSeaShared.hlsl を読み、seaWave（頂点と画素の両方）・seaColor・wetSand を呼ぶ', /#include\s+"MapSeaShared\.hlsl"/.test(shader) && (shader.match(/\bseaWave\s*\(/g) || []).length >= 2 && /\bseaColor\s*\(/.test(shader) && /\bwetSand\s*\(/.test(shader));
for (const [n, ok, d] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok || !d ? '' : '  — ' + d));
process.exit(checks.every(c => c[1]) ? 0 : 1);
