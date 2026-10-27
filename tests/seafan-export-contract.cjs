// Dedicated regression for the one-ID optional Native extension; consumes real browser exports.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(process.env.SEAFAN_ROOT||'output/playwright/night-props');
const read=p=>JSON.parse(fs.readFileSync(path.join(out,p),'utf8'));
const old=read('batch15-native-baseline/after-export/small_props.json'),now=read('batch15-final-regression/after-export/small_props.json'),custom=read('batch15-custom/small_props.json');
for(const key of ['version','units','axes','assets','additionalAssets','rowboatAsset','atlas','instances','grounded'])assert.deepEqual(old[key],now[key],key+' must preserve prior payload');
assert.deepEqual(now.extraNativeAssetsV1.map(a=>a.id),['seafan']);assert.deepEqual(custom.extraNativeAssetsV1,[]);
assert.deepEqual(fs.readFileSync(path.join(out,'batch15-native-baseline/after-export/props.csv')),fs.readFileSync(path.join(out,'batch15-final-regression/after-export/props.csv')));
const before=old.extraNativeAssetsV1[0],after=now.extraNativeAssetsV1[0];
for(const key of ['id','assetKey','source','radius','height','groundSink','shape','material','light'])assert.deepEqual(before[key],after[key]);
// The displaced 80-triangle holdfast remains the exact same geometry and position.
assert.deepEqual(before.positions.slice(-80*9),after.positions.slice(-80*9),'holdfast');
assert(after.triangles.length<before.triangles.length);assert.equal(after.surface.id,'seafan-net-v1');assert.equal(after.surface.width,256);assert.equal(after.surface.height,256);assert.equal(after.surface.wrap,'clamp');assert.equal(after.surface.colorSpace,'sRGB');assert(after.surface.mipmaps);
const png=Buffer.from(after.surface.png,'base64');assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);assert.equal(png[25],6,'RGBA');
const sheet=[];for(let i=0;i<after.uv.length/2;i++)if(after.uv[i*2]>.12)sheet.push(i);const half=sheet.length/2;assert(Number.isInteger(half));const xy=i=>after.positions[i*3].toFixed(7)+':'+after.positions[i*3+1].toFixed(7);assert.deepEqual(new Set(sheet.slice(0,half).map(xy)),new Set(sheet.slice(half).map(xy)),'front/back XY');assert(sheet.slice(0,half).every(i=>after.normals[i*3+2]<-.99));assert(sheet.slice(half).every(i=>after.normals[i*3+2]>.99));
const contract=read('batch15-final-regression/contract.json'),a=contract.results.before,b=contract.results.after;let unchanged=0;for(let i=0;i<a.catalog.length;i++)if(a.catalog[i].id!=='seafan'){assert.deepEqual(a.catalog[i],b.catalog[i]);unchanged++;}assert.equal(unchanged,128);
const report={pass:true,unchangedModels:unchanged,priorNativeAssetsExact:33,csvExact:true,holdfastExact:true,frontBackXYExact:true,oppositeFaceNormals:true,oneWhitelistedId:'seafan',pngBytes:png.length,textureSize:[256,256],beforeTriangles:before.triangles.length/3,afterTriangles:after.triangles.length/3};
fs.writeFileSync(path.join(out,'batch15/seafan-contract.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
