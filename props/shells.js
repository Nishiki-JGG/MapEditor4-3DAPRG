// 貝殻・ヒトデ（shells）
TDProps.add({
  id: 'shells', name: '貝殻・ヒトデ',
  r: 0, min: .6, sc: [.8, 1.6], slope: .7, vis: .35, anyGround: true,
  tags: ['beach'], height: 0.03, groundSink: .001,
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(74), parts = [];
    for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.18, .0175, .045), m: mat4(Math.cos(k * 1.2566) * .08, .01625, Math.sin(k * 1.2566) * .08, 1, 1, 1, -k * 1.2566), c: col(0xe8784a), j: .1 });
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.SphereGeometry(.06, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(.3 + R() * .4 - .2, 0, (R() - .5) * .5, 1, .5, 1.3, R() * 3), c: mixc(col(0xf1e3cf), col(0xf0b9a8), R()) });
    const original=makeGeo(parts,74),cap=makeGeo([{g:new THREE.SphereGeometry(.055,8,3,0,Math.PI*2,0,Math.PI/2),m:mat4(0,.025,0,1,.0075/.055,1,0),c:col(0xe8784a),j:.04}],740),g=new THREE.BufferGeometry();
    // 重なる腕の中央を薄い肉厚で覆う。配置外寸を維持し、貝の形・色は変更しない。
    const armCount=parts[0].g.index.count,capCount=cap.attributes.position.count;
    for(const[name,a]of Object.entries(original.attributes)){const b=cap.attributes[name],joined=new a.array.constructor(a.array.length+b.array.length),cut=armCount*a.itemSize;joined.set(a.array.subarray(0,cut));joined.set(b.array,cut);joined.set(a.array.subarray(cut),cut+b.array.length);g.setAttribute(name,new THREE.BufferAttribute(joined,a.itemSize,a.normalized));}
    let first=0;
    g.userData.groundParts=[];
    const count=p=>p.g.index?p.g.index.count:p.g.attributes.position.count;
    for(let k=0;k<5;k++){const n=count(parts[k])+(k===0?capCount:0);g.userData.groundParts.push({id:'starfish'+k,joint:'starfish',first,count:n,pivot:[0,0,0]});first+=n;}
    for(let k=5;k<parts.length;k++){const p=parts[k],n=count(p);g.userData.groundParts.push({id:'shell'+(k-5),first,count:n,pivot:[p.m.elements[12],0,p.m.elements[14]]});first+=n;}
    return g;
  },
});
