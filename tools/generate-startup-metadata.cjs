const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),w={},ctx=vm.createContext({window:w});
for(const f of ['props/shared/assets.js','props/shared/cave-decor-data.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const omit=new Set(['positions','normals','colors','uv','triangles','motionWeights','rootWood','rootWeights','glow','png']);
const slim=(x)=>Object.fromEntries(Object.entries(x).filter(([k])=>!omit.has(k)));
const shared={...w.TDSharedData,assets:w.TDSharedData.assets.map(slim),textures:w.TDSharedData.textures.map(slim)};
const cave={...w.TDCaveDecorData,assets:w.TDCaveDecorData.assets.map(slim),textures:w.TDCaveDecorData.textures.map(slim)};
fs.writeFileSync(path.join(root,'props/shared/startup-metadata.js'),'// Generated metadata only. Full source assets load after the first editable frame.\nwindow.TDSharedData='+JSON.stringify(shared)+';\nwindow.TDCaveDecorData='+JSON.stringify(cave)+';\n');
