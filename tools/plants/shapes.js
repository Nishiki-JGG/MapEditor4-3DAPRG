// Authoring-only, deterministic geometry. Grass consists of folded, curved individual leaves.
(() => {
const T=THREE;
function grass(count=11,height=.72,radius=.48){
 const P=[],C=[],U=[],uvMap=new Map(),R=TDGeo.rng(5721);
 const tri=(a,b,c,color)=>{P.push(...a,...b,...c);for(const v of [a,b,c]){C.push(...color);U.push(...(uvMap.get(v)||[.5,.5]));}};
 for(let k=0;k<count;k++){
  const angle=k*2.399963+(R()-.5)*1.15,dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;
  const bx=(R()-.5)*.23,bz=(R()-.5)*.23,h=height*(.52+R()*.48),reach=radius*(.40+R()*.60),width=.022+R()*.022,bend=(R()-.5)*radius*.65;
  const rows=[];
  for(const t of [0,.34,.72,1]){
   const reachT=reach*t*t,y=t===0?0:h*Math.sin(t*Math.PI*.68),w=t===1?0:width*Math.sin(.10+t*Math.PI*.90),ridge=w*.27,curve=bend*Math.sin(t*Math.PI*.8);
   rows.push([[-w,0],[0,ridge],[w,0]].map(([s,up])=>[bx+dx*reachT+sx*(s+curve),y+up,bz+dz*reachT+sz*(s+curve)]));
  }
  for(let j=0;j<rows.length;j++)for(let n=0;n<3;n++)uvMap.set(rows[j][n],[n/2,[0,.34,.72,1][j]]);
  const c=new T.Color().setHSL(.22+R()*.025,.32+R()*.10,.22+R()*.10);
  for(let j=0;j<3;j++)for(let s=0;s<2;s++){
   const color=[c.r*(.82+j*.08),c.g*(.82+j*.08),c.b*(.82+j*.08)];
   tri(rows[j][s],rows[j+1][s],rows[j][s+1],color);
   if(j<2)tri(rows[j][s+1],rows[j+1][s],rows[j+1][s+1],color);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();
 // Shared logical leaf vertices have duplicated triangle records. Smooth only
 // this authoring mesh so the fold does not read as a dark straight board.
 const pos=g.attributes.position,n=g.attributes.normal,sums=new Map(),keys=[];
 for(let i=0;i<pos.count;i++){const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].join('/');keys.push(key);if(!sums.has(key))sums.set(key,new T.Vector3());sums.get(key).add(new T.Vector3(n.getX(i),n.getY(i),n.getZ(i)));}
 for(let i=0;i<n.count;i++){const v=sums.get(keys[i]).clone().normalize();n.setXYZ(i,v.x,v.y,v.z);}return g;
}
window.TDPlantShapes={grass};
})();
