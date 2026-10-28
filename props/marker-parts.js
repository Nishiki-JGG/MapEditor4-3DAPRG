// 石碑・墓石の輪郭と碑面。外形と厚みは維持し、前後面を面取りへ連続させる。
window.TDMarkerParts = {
  arch(w, bottom, shoulder, steps = 8) {
    const p = [[-w,bottom],[w,bottom],[w,shoulder]];
    for(let j=1;j<=steps;j++){const a=j/steps*Math.PI;p.push([Math.cos(a)*w,shoulder+Math.sin(a)*w]);}
    return p;
  },
  slab(outline, depth, cf, panel) {
    const {mesh}=TDSmallParts,identity=new THREE.Matrix4(),parts=[],n=outline.length;
    const cy=outline.reduce((s,p)=>s+p[1],0)/n,inner=outline.map(([x,y])=>[x*.94,cy+(y-cy)*.975]);
    const points=[],ix=[],b=Math.min(.018,depth*.15);
    for(const [p,z]of [[outline,depth/2-b],[inner,depth/2],[outline,-depth/2+b],[inner,-depth/2]])for(const [x,y]of p)points.push([x,y,z]);
    for(const [f,k]of [[1,0],[0,2],[2,3]])for(let j=0;j<n;j++){const a=f*n+j,c=k*n+j,d=k*n+(j+1)%n,b0=f*n+(j+1)%n;ix.push(a,c,b0,b0,c,d);}
    const add=(g,cfn=cf)=>parts.push({g,m:identity,cfn,j:0});add(mesh(points,ix));
    const shape=new THREE.Shape(inner.map(p=>new THREE.Vector2(...p)));
    if(panel){const {x0,x1,y0,y1}=panel;shape.holes.push(new THREE.Path([[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>new THREE.Vector2(...p))));}
    add(new THREE.ShapeGeometry(shape).translate(0,0,depth/2));
    const back=new THREE.ShapeGeometry(new THREE.Shape(inner.map(p=>new THREE.Vector2(...p))));
    const idx=back.index.array;for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}add(back.translate(0,0,-depth/2));
    if(panel){
      const {x0,x1,y0,y1,marks=[]}=panel,z=depth/2-.025,p=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],wall=[],wi=[];
      for(const d of [depth/2,z])for(const [x,y]of p)wall.push([x,y,d]);
      for(let j=0;j<4;j++){const k=(j+1)%4;wi.push(j,k,j+4,k,k+4,j+4);}add(mesh(wall,wi));
      const markPolys=marks.map(([y,width])=>[[-width/2,y-.006],[width/2,y-.006],[width/2-.025,y+.006],[-width/2+.01,y+.006]]);
      const face=new THREE.Shape(p.map(q=>new THREE.Vector2(...q)));
      for(const q of markPolys)face.holes.push(new THREE.Path(q.map(v=>new THREE.Vector2(...v))));
      add(new THREE.ShapeGeometry(face).translate(0,0,z),(...args)=>TDGeo.mixc(cf(...args),TDGeo.col(0x726e65),.12));
      // 模様と碑面は同一平面の隣接面。重ねた薄板で自己影を作らない。
      for(const q of markPolys)add(mesh(q.map(([x,y])=>[x,y,z]),[0,1,2,0,2,3]),(...args)=>cf(...args).map(v=>v*.78));
    }
    return parts;
  },
};

// Worn solid stone with real bevelled recesses. The old slab helper remains unchanged.
TDMarkerParts.wornSlab=function(outline,depth,cf,panel){
 const {mesh}=TDSmallParts,I=new THREE.Matrix4(),parts=[],n=outline.length;
 const inset=(p,d)=>p.map((b,j)=>{const a=p[(j+p.length-1)%p.length],c=p[(j+1)%p.length],u=new THREE.Vector2(b[0]-a[0],b[1]-a[1]).normalize(),v=new THREE.Vector2(c[0]-b[0],c[1]-b[1]).normalize(),n1=new THREE.Vector2(-u.y,u.x),n2=new THREE.Vector2(-v.y,v.x),sum=n1.clone().add(n2),den=Math.max(.22,1+n1.dot(n2));return[b[0]+sum.x*d/den,b[1]+sum.y*d/den];});
 const tint=k=>(...args)=>cf(...args).map(v=>v*k),add=(g,cfn=cf)=>parts.push({g,m:I,cfn,j:.002});
 const inner=inset(outline,.010),f=depth/2,b=f-.014,points=[],ix=[];
 for(const[p,z]of[[outline,b],[inner,f],[outline,-b],[inner,-f]])for(const[x,y]of p)points.push([x,y,z]);
 for(let j=0;j<n;j++){const k=(j+1)%n;ix.push(j,k,n+j,k,n+k,n+j,j,2*n+j,k,k,2*n+j,2*n+k,2*n+j,3*n+j,2*n+k,2*n+k,3*n+j,3*n+k);}
 add(mesh(points,ix),tint(1.035));
 const shape=p=>new THREE.Shape(p.map(v=>new THREE.Vector2(...v))),hole=p=>new THREE.Path(p.map(v=>new THREE.Vector2(...v)));
 const front=shape(inner);if(panel)front.holes.push(hole(panel.outline));add(new THREE.ShapeGeometry(front).translate(0,0,f));
 const back=new THREE.ShapeGeometry(shape(inner)),bi=back.index.array;for(let j=0;j<bi.length;j+=3)[bi[j+1],bi[j+2]]=[bi[j+2],bi[j+1]];add(back.translate(0,0,-f));
 function rim(a,z0,c,z1,k){const v=[],ix=[];for(const[p,z]of[[a,z0],[c,z1]])for(const[x,y]of p)v.push([x,y,z]);for(let j=0;j<a.length;j++){const h=(j+1)%a.length;ix.push(j,h,j+a.length,h,h+a.length,j+a.length);}add(mesh(v,ix),tint(k));}
 if(panel){const p=panel.outline,inner=inset(p,panel.bevel||.009),z=f-(panel.depth||.030);rim(p,f,inner,z,.89);const floor=shape(inner),marks=(panel.marks||[]).map(([y,w])=>[[-w/2,y-.008],[w/2,y-.008],[w/2-.012,y+.008],[-w/2+.006,y+.008]]);for(const q of marks)floor.holes.push(hole(q));add(new THREE.ShapeGeometry(floor).translate(0,0,z),tint(.94));for(const q of marks){const base=inset(q,.004);rim(q,z,base,z-.009,.78);add(new THREE.ShapeGeometry(shape(base)).translate(0,0,z-.009),tint(.68));}}
 return parts;
};
