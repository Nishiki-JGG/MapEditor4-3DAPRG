// 実ブラウザから保存した正式出力を検査する。旧形式・既存32種・外部キーを保全。
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'output/playwright/night-props');
const current=path.resolve(process.env.BOAT_EXPORT||path.join(base,'batch13-final-regression/after-export'));
const previous=path.resolve(process.env.BOAT_PREVIOUS||path.join(base,'batch12-final-regression/after-export'));
const reference=path.resolve(process.env.BOAT_REFERENCE||path.join(base,'batch13-final-regression/before-export'));
const custom=path.resolve(process.env.BOAT_CUSTOM||path.join(base,'batch13-custom'));
const read=dir=>JSON.parse(fs.readFileSync(path.join(dir,'small_props.json'),'utf8'));
const d=read(current),old=read(previous),boat=d.rowboatAsset;
assert.equal(d.version,1);assert.equal(d.assets.length,19);assert.equal(d.additionalAssets.length,13);
assert.deepEqual(d.assets,old.assets,'all previous nineteen core meshes/materials remain exact');
assert.deepEqual(d.additionalAssets,old.additionalAssets,'all previous thirteen optional meshes/materials remain exact');
assert.equal(boat.id,'rowboat');assert.equal(boat.assetKey,'tdj/rowboat');assert.equal(boat.material,'cards2');
assert.deepEqual(boat.circleColliders,[[-.8,0,0],[0,0,0],[.8,0,0]].map(center=>({center,radius:.55,height:.62})));
const ys=boat.positions.filter((_,i)=>i%3===1);assert(Math.abs(Math.min(...ys)-.05)<1e-6,'closed shell reaches the unchanged Web default sink');
assert(boat.positions.every(Number.isFinite)&&boat.normals.every(Number.isFinite));
assert.equal(fs.readFileSync(path.join(current,'props.csv'),'utf8'),fs.readFileSync(path.join(reference,'props.csv'),'utf8'),'CSV placement and prefab keys remain exact');
const csv=fs.readFileSync(path.join(current,'props.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(r=>r.split(','));
const roots=d.instances.filter(t=>t.rootPosition);assert.equal(roots.length,3);
for(const t of roots){const row=csv.find(r=>r[0]===t.instanceId);assert.equal(row[1],'rowboat');assert.equal(row[2],'tdj/rowboat');assert.equal(t.rootPosition[0],Number(row[3]));assert.equal(t.rootPosition[2],Number(row[5]));const n=Number(t.instanceId.split('-').at(-1));assert(Math.abs(t.rootPosition[1]-Number(row[4])-(n===2?0:-.05))<1e-6,'only automatic boat roots bridge the legacy CSV difference');}
const external=read(custom);assert.equal(external.rowboatAsset,undefined);assert.deepEqual(external.assets,old.assets);assert.deepEqual(external.additionalAssets,old.additionalAssets);
const report={pass:true,requiredAssets:19,previousNativeAssetsExact:32,optionalBoat:true,csvUnchanged:true,sourceRoots:roots.map(t=>({id:t.instanceId,position:t.rootPosition})),customBoatRemainsExternal:true,triangles:boat.triangles.length/3};
const out=path.resolve(process.env.BOAT_REPORT||path.join(base,'batch13-final/rowboat-output-proof.json'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
