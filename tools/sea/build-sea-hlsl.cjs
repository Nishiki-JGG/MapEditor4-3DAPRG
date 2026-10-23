// Writes the Unity copy of the sea's shader code from sea.js (the editor's copy):
//   node tools/sea/build-sea-hlsl.cjs   → unity/Assets/MapWater/Runtime/Shaders/MapSeaShared.hlsl
// Run it after changing sea.js; tests/sea_hlsl_sync.cjs fails while the two differ.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'unity/Assets/MapWater/Runtime/Shaders/MapSeaShared.hlsl');
function loadSea() { const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'sea.js'), 'utf8'), ctx); return ctx.window.TDSea; }
module.exports = { loadSea, out, hlsl: () => loadSea().hlsl() };
if (require.main === module) { fs.writeFileSync(out, module.exports.hlsl()); console.log('wrote ' + path.relative(root, out)); }
