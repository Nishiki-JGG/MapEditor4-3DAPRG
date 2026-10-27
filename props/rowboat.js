// 小舟（rowboat）
TDProps.add({
  id: 'rowboat', name: '小舟',
  r: .55, offs: [-.8, 0, .8], min: 3, sc: [.9, 1.1], slope: .6, vis: 1.3, anyGround: true,
  tags: ['beach'], height: 0.62, material: 'cards2',
  build() {
    const { col, mixc, mat4, makeGeo, ATLAS2 } = TDGeo;
    // a planked hull lofted from cross-sections (pointed bow and stern, round bilge), grain along the planks,
    // with gunwales, thwarts and an oar resting across (atlas 2 wood; the hull is one surface seen from both sides)
    const wood = (y, ny, R, pr) => mixc(col(0xb09878), col(0xe0ccac), pr);
    const N=14,M=9,L=1.35,width=t=>.64*Math.pow(Math.max(0,1-Math.pow(Math.abs(t),2.6)),.55),sheer=t=>.5+.1*t*t;
    // Keep the outer footprint; only deepen the bilge to meet the existing .05 sink.
    const at=(i,j,inner=false)=>{const t=i/N*2-1,th=(j/M-.5)*Math.PI,w=width(t),depth=(.5-.05)/Math.cos(Math.PI/18)*(1-.35*t*t);return[t*L,sheer(t)-depth*Math.cos(th)+(inner?.035*Math.cos(th):0),Math.max(0,w-(inner?.035:0))*Math.sin(th)];};
    const hull=()=>{
      const P=[],U=[],tri=(a,b,c,ua,ub,uc)=>{P.push(...a,...b,...c);U.push(...ua,...ub,...uc);};
      for(const inner of [false,true])for(let i=0;i<N;i++)for(let j=0;j<M;j++){
        const a=at(i,j,inner),b=at(i+1,j,inner),c=at(i+1,j+1,inner),d=at(i,j+1,inner),ua=[j/M,i/N],ub=[j/M,(i+1)/N],uc=[(j+1)/M,(i+1)/N],ud=[(j+1)/M,i/N];
        if(inner){tri(a,c,b,ua,uc,ub);tri(a,d,c,ua,ud,uc);}else{tri(a,b,c,ua,ub,uc);tri(a,c,d,ua,uc,ud);}
      }
      // Real rim thickness, not a back-face setting: both surfaces meet at the top.
      for(const j of [0,M])for(let i=0;i<N;i++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j,true),d=at(i,j,true),u=[0,0];if(j===0){tri(a,c,b,u,u,u);tri(a,d,c,u,u,u);}else{tri(a,b,c,u,u,u);tri(a,c,d,u,u,u);}}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));return g;
    };
    const parts=[{g:hull(),m:new THREE.Matrix4(),cfn:wood,uvr:ATLAS2.uvr('wood'),j:.04}];
    for(const side of [-1,1]){const points=[];for(let i=0;i<=N;i++){const t=i/N*2-1;points.push([t*1.325,sheer(t)-.016,side*Math.max(0,width(t)-.008)]);}parts.push({g:TDSmallParts.tube(points,points.map(()=>.025),4),m:new THREE.Matrix4(),c:col(0x5a4632)});}
    for(const [x,w]of [[-.55,.54],[.35,.58]])parts.push({g:new THREE.BoxGeometry(.2,.04,w*2),m:mat4(x,.4,0,1,1,1),cfn:wood,uvr:ATLAS2.uvr('wood')});
    const oar=mat4(.05,.4925,.12,1,1,1,.32,0,Math.PI/2+.08);
    parts.push({g:new THREE.CylinderGeometry(.022,.022,1.9,5),m:oar,cfn:wood,uvr:ATLAS2.uvr('wood')});
    // Blade and shaft share one transform, with a short physical overlap at the neck.
    const V=[],I=[],levels=[[-.86,.028],[-1.00,.075],[-1.22,.085],[-1.31,.055]];
    for(const[y,w]of levels)V.push([-.01,y,-w],[.01,y,-w],[.01,y,w],[-.01,y,w]);
    for(let k=0;k<levels.length-1;k++)for(let j=0;j<4;j++){const a=k*4+j,b=k*4+(j+1)%4,c=a+4,d=b+4;I.push(a,b,c,b,d,c);}I.push(0,2,1,0,3,2,12,13,14,12,14,15);
    const blade=TDSmallParts.mesh(V,I);blade.setAttribute('uv',new THREE.Float32BufferAttribute(V.flatMap(([x,y,z])=>[z/.17+.5,(-y-.86)/.45]),2));parts.push({g:blade,m:oar,cfn:wood,uvr:ATLAS2.uvr('wood')});
    return makeGeo(parts, 72, { ao: .35, uv: ATLAS2.white });
  },
});
