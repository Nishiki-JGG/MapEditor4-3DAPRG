// 塔（tower）
TDProps.add({
  id: 'tower', name: '塔',
  r: 1.3, min: 4, sc: [.9, 1.15], slope: .4, vis: 1.3, anyGround: true,
  tags: ['castle'], height: 7.45, material: 'carved',
  build() {
    const {col,mixc,mat4,makeGeo,hash2,displace}=TDGeo,{mesh}=TDSmallParts,{bevelBox}=TDArchitectureParts,p=[];
    const R=y=>1.25-.15*y/5,holes=[{a:.6-.06/R(2.2),b:.6+.06/R(2.2),lo:1.95,hi:2.45},{a:2.4-.06/R(3.6),b:2.4+.06/R(3.6),lo:3.35,hi:3.85},{a:4.2-.06/R(3),b:4.2+.06/R(3),lo:2.75,hi:3.25},{a:Math.PI/2-.35/R(.55),b:Math.PI/2+.35/R(.55),lo:0,hi:1.1}];
    const pos=(a,y,d=0)=>[Math.cos(a)*(R(y)-d),y,Math.sin(a)*(R(y)-d)],add=(g,m,cfn,j=.01)=>p.push({g,m,cfn,j}),stone=(y,ny,r,pr)=>mixc(col(0x77756e),col(0xaaa69c),.2+pr*.3);
    // 同じ輪郭の円塔に、段違いの目地と実際の厚みを持つ小開口を作る。
    for(let row=0;row<10;row++){
      const lo=row*5/10,hi=(row+1)*5/10,active=holes.filter(h=>h.hi>lo&&h.lo<hi),angles=[0,Math.PI*2];for(let j=1;j<16;j++)angles.push(j*Math.PI/8);for(const h of active)angles.push(h.a,h.b);angles.sort((a,b)=>a-b);
      const ys=[lo,hi,...active.flatMap(h=>[h.lo,h.hi]).filter(y=>y>lo&&y<hi)].sort((a,b)=>a-b);
      for(let k=0;k<ys.length-1;k++)for(let j=0;j<angles.length-1;j++){
        const am=(angles[j]+angles[j+1])/2,ym=(ys[k]+ys[k+1])/2;if(active.some(h=>am>h.a&&am<h.b&&ym>h.lo&&ym<h.hi))continue;
        const joint=a=>Math.abs(a/(Math.PI/8)-Math.round(a/(Math.PI/8)))<1e-6&&((Math.round(a/(Math.PI/8))-row%2+16)%2===0),aa=angles[j]+(joint(angles[j])?.0025:0),bb=angles[j+1]-(joint(angles[j+1])?.0025:0),y0=ys[k]+(Math.abs(ys[k]-lo)<1e-6&&row>0?.008:0),y1=ys[k+1]-(Math.abs(ys[k+1]-hi)<1e-6&&row<9?.008:0),shade=hash2(row,Math.floor(am/(Math.PI/4)-row%2*.5+12));
        add(mesh([pos(aa,y0),pos(bb,y0),pos(aa,y1),pos(bb,y1)],[0,2,1,1,2,3]),new THREE.Matrix4(),()=>mixc(col(0x77756e),col(0xaaa69c),.15+shade*.55),.006);
      }
    }
    add(new THREE.CylinderGeometry(1.05,1.20,5,16,1,true),mat4(0,2.5,0,1,1,1),()=>col(0x36342e));
    for(const h of holes){const v=[pos(h.a,h.lo),pos(h.b,h.lo),pos(h.b,h.hi),pos(h.a,h.hi),pos(h.a,h.lo,.05),pos(h.b,h.lo,.05),pos(h.b,h.hi,.05),pos(h.a,h.hi,.05)];add(mesh(v,[0,4,3,3,4,7,1,2,5,2,6,5,0,1,4,1,5,4,3,7,2,2,7,6]),new THREE.Matrix4(),stone);}
    const wood=()=>col(0x765a3d);for(let k=0;k<4;k++){const x0=-.35+k*.175+.002,x1=x0+.171,f=(x,y,d)=>[x,y,Math.sqrt(R(y)**2-x*x)-d],v=[f(x0,.01,.018),f(x1,.01,.018),f(x1,1.09,.018),f(x0,1.09,.018),f(x0,.01,.043),f(x1,.01,.043),f(x1,1.09,.043),f(x0,1.09,.043)];add(mesh(v,[0,1,2,0,2,3,4,6,5,4,7,6,0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,3,7,0,0,7,4]),new THREE.Matrix4(),wood);}
    add(new THREE.BoxGeometry(.025,.10,.025),mat4(.16,.55,Math.sqrt(R(.55)**2-.16**2)-.002,1,1,1),()=>col(0x302d29));
    add(new THREE.CylinderGeometry(1.3,1.15,.3,16),mat4(0,5.15,0,1,1,1),stone);
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2;add(bevelBox(.4,.45,.35,.01),mat4(Math.cos(a)*1.18,5.52,Math.sin(a)*1.18,1,1,1,-a),stone);}
    add(new THREE.CylinderGeometry(.98,.98,.27,16,1,true),mat4(0,5.425,0,1,1,1),stone);
    const roofVertices=Array.from({length:16},(_,k)=>[Math.cos(k*Math.PI/8)*1.15,-.95,Math.sin(k*Math.PI/8)*1.15]),roofIndices=[];roofVertices.push([0,.95,0]);for(let k=0;k<16;k++)roofIndices.push(k,16,(k+1)%16);add(mesh(roofVertices,roofIndices),mat4(0,6.5,0,1,1,1),()=>col(0x3a465c));
    add(new THREE.RingGeometry(.98,1.15,16),mat4(0,5.55,0,1,1,1,0,Math.PI/2),()=>col(0x303a4b));
    p.push({g:displace(new THREE.IcosahedronGeometry(.4,0),.4,4),m:mat4(-.9,.1,.7,1.4,.35,1,.3),c:col(0x4e6a34),j:.1});
    return makeGeo(p,89,{ao:.9,smooth:35});
  },
});
