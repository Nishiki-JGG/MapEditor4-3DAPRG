// Pure browser/Node serializer. Preserve spatial buckets and Array.prop metadata.
function normalizeCollision(value) {
  const active = new WeakSet();
  const sort = xs => xs.sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0);
  function visit(v) {
    if(v===null || typeof v==='string' || typeof v==='boolean')return v;
    if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Non-finite collision number');return Object.is(v,-0)?0:v;}
    if(v===undefined)return {$undefined:true};
    if(typeof v!=='object')throw Error('Unsupported collision value: '+typeof v);
    if(active.has(v))throw Error('Cyclic collision data');active.add(v);let result;
    if(v instanceof Map)result={$map:sort([...v].map(([k,x])=>[visit(k),visit(x)]))};
    else if(v instanceof Set)result={$set:sort([...v].map(visit))};
    else if(ArrayBuffer.isView(v))result={$typed:v.constructor.name,values:Array.from(v,visit)};
    else if(Array.isArray(v)){
      const extras=Object.keys(v).filter(k=>!(/^(0|[1-9]\d*)$/.test(k)&&Number(k)<v.length)).sort();
      result=extras.length?{$array:v.map(visit),properties:Object.fromEntries(extras.map(k=>[k,visit(v[k])]))}:v.map(visit);
    }else {
      // Footprint distance fields are lazy memoization, populated by load/queries.
      // Compare the authoritative height grid and bounds, not cache warm-up history.
      const footprint=v.fields instanceof Map&&Number.isInteger(v.nx)&&Number.isInteger(v.nz)&&ArrayBuffer.isView(v.top)&&v.top.length===v.nx*v.nz;
      result=Object.fromEntries(Object.keys(v).filter(k=>!(footprint&&k==='fields')).sort().map(k=>[k,visit(v[k])]));
      if(footprint)result.$omittedDerivedCache='footprint.fields';
    }
    active.delete(v);return result;
  }
  return visit(value);
}
module.exports={normalizeCollision};
if(require.main===module){
 const assert=require('assert/strict'),a=[1,2,.7,0,1.69];a.prop=[4,1,2,0,1];
 const make=(entries,set)=>({cs:4,m:new Map(entries),seen:new Set(set)}),x=make([[3,[a]],[1,[]]],['b','a']),y=make([[1,[]],[3,[a]]],['a','b']);
 assert.deepEqual(normalizeCollision(x),normalizeCollision(y));
 const changed=a.slice();changed.prop=a.prop.slice();changed[2]=.8;
 assert.notDeepEqual(normalizeCollision(x),normalizeCollision(make([[3,[changed]],[1,[]]],['a','b'])));
 changed[2]=.7;changed.prop[1]=99;
 assert.notDeepEqual(normalizeCollision(x),normalizeCollision(make([[3,[changed]],[1,[]]],['a','b'])));
 assert.equal(normalizeCollision(x).m.$map.length,2);
 const f={nx:1,nz:1,top:new Float32Array([.5]),fields:new Map()};const cold=normalizeCollision(f);f.fields.set(20,{dist:new Float32Array([0])});assert.deepEqual(cold,normalizeCollision(f));f.top[0]=.8;assert.notDeepEqual(cold,normalizeCollision(f));
 assert.throws(()=>normalizeCollision({radius:NaN}));console.log('Collision snapshot Map/Set/order/radius/Array.prop/footprint negative controls PASS');
}
