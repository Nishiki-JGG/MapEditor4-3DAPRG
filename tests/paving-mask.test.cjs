// node tests/paving-mask.test.cjs; no browser or additional package.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=process.argv[2]||path.resolve(__dirname,'..'),THREE=require(path.join(root,'three.min.js'));
const context={THREE,window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'terrain/paving-mask.js'),'utf8'),context);
const {createMask,updateMask}=context.window.TDPavingMask,n=5,channels=9,paint=new Uint8Array(n*n*channels),mask=createMask(n);
paint[(2*n+2)*channels+1]=200;const original=paint.slice();
assert.equal(updateMask(mask,paint,channels),true);assert.deepEqual(paint,original,'paint source mutated');
for(let j=0;j<n;j++)for(let i=0;i<n;i++){
 const k=(j*n+i)*4;assert.equal(mask.image.data[k],i===2&&j===2?200:0);
 assert.equal(mask.image.data[k+1],i>=1&&i<=3&&j>=1&&j<=3?200:0);
}
const version=mask.version;assert.equal(updateMask(mask,paint,channels),false);assert.equal(mask.version,version,'unchanged paint re-uploaded');
paint.fill(0);paint[1]=255;updateMask(mask,paint,channels);
assert.equal(mask.image.data[1],255);assert.equal(mask.image.data[(n*n-1)*4+1],0,'search margin wraps to the opposite map edge');
paint.fill(0);assert.equal(updateMask(mask,paint,channels),true);assert(mask.image.data.every(v=>v===0),'erased paving leaves a stale fringe');
assert.equal(mask.magFilter,THREE.LinearFilter);assert.equal(mask.minFilter,THREE.LinearFilter);assert.equal(mask.generateMipmaps,false);
assert.equal(mask.wrapS,THREE.ClampToEdgeWrapping);
mask.dispose();console.log(JSON.stringify({pass:true,checks:['exact paint channel and orientation','one-cell search margin','no source changes','no unchanged upload','edge clamp','erase clears fringe','linear non-colour mask']}));
