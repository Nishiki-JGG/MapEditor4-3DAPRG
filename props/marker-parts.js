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
