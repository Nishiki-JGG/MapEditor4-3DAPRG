const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const root=process.argv[2]||path.resolve(__dirname,'..'),THREE=require(path.join(root,'three.min.js'));
const c={THREE,structuredClone,TextEncoder,TextDecoder,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Map,Set,WeakMap,ArrayBuffer,DataView,Blob,Response,CompressionStream,DecompressionStream,btoa,atob,crypto:crypto.webcrypto,TDPreparedCodec:require(path.join(root,'terrain/prepared-codec.js'))};c.window=c;vm.createContext(c);
const load=f=>vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);load('terrain/cliff-fits.js');load('terrain/map-archive.js');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(app.slice(app.indexOf('const CRC ='),app.indexOf('// SHA-256 (FIPS')),c);
(async()=>{
 const geo=new THREE.BoxGeometry(2,3,1,2,2,2),m=new THREE.Matrix4().makeShear(.2,0,.1,0,0,0),actual=geo.clone().applyMatrix4(m);const b=new Uint32Array(actual.attributes.position.array.buffer);b[0]++;
 const record={type:'fixture',sourceSha256:'fixture-hash',affine:m.toArray(),geometry:c.TDCliffFits.describe(actual),pose:'[]',input:'fixture'};
 const map={format:'map-editor-proto',version:2,roomId:'test',cliffFits:{formatVersion:1,instances:{a:record}},props:[]},value={version:1,surface:{position:Float32Array.of(0,1,2)},collision:{dist:Float32Array.of(.1,.2)}},resolve=(type,hash)=>{assert.equal(type,'fixture');assert.equal(hash,'fixture-hash');return geo;};
 const blob=await c.TDMapArchive.create(map,value,resolve,c.makeZip),bytes=new Uint8Array(await blob.arrayBuffer()),restored=await c.TDMapArchive.read(bytes,resolve);
 assert.equal(JSON.stringify(restored),JSON.stringify(map));assert.deepEqual(c.TDMapArchive.completedFor(restored),value);
 const old=JSON.stringify(map);const compact=c.TDMapArchive.compactFits(map.cliffFits,resolve);assert.equal(JSON.stringify(map),old);assert(compact.instances.a.geometry.preparedAffineDelta===1);
 await assert.rejects(c.TDMapArchive.read(bytes,()=>{throw Error('missing version');}),/missing version/);
 for(const index of [0,Math.floor(bytes.length/2),bytes.length-1]){const broken=bytes.slice();broken[index]^=255;await assert.rejects(c.TDMapArchive.read(broken,resolve));}
 const traversal=await c.makeZip([{name:'manifest.json',data:'{}'},{name:'../map.tdps',data:new Uint8Array([1])}]);await assert.rejects(c.TDMapArchive.read(await traversal.arrayBuffer(),resolve));
 const duplicate=await c.makeZip([{name:'manifest.json',data:'{}'},{name:'manifest.json',data:'{}'}]);await assert.rejects(c.TDMapArchive.read(await duplicate.arrayBuffer(),resolve));
 console.log(JSON.stringify({pass:true,affineShear:true,float32Bits:true,sourceUnmodified:true,missingVersionRejected:true,crcCorruptionRejected:true,pathAndDuplicateRejected:true,bytes:bytes.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
