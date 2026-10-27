// 選択した人工物だけで使う静的な切石部品。地形・配置・自動生成には接続しない。
window.TDArchitectureParts=(()=>{
 const {mesh}=TDSmallParts;
 function bevelBox(w,h,d,edge=.012){
  const x=w/2,z=d/2,e=Math.min(edge,w*.15,d*.15),outline=[[-x+e,-z],[x-e,-z],[x,-z+e],[x,z-e],[x-e,z],[-x+e,z],[-x,z-e],[-x,-z+e]],v=[],ix=[];
  for(const y of [-h/2,h/2])for(const[x,z]of outline)v.push([x,y,z]);
  for(let j=0;j<8;j++){const n=(j+1)%8;ix.push(j,j+8,n,n,j+8,n+8);}
  for(let j=1;j<7;j++)ix.push(0,j,j+1,8,8+j+1,8+j);
  return mesh(v,ix);
 }
 function wedge(ri,ro,a,b,y,depth){
  const points=[[Math.cos(a)*ro,y+Math.sin(a)*ro],[Math.cos(b)*ro,y+Math.sin(b)*ro],[Math.cos(b)*ri,y+Math.sin(b)*ri],[Math.cos(a)*ri,y+Math.sin(a)*ri]];
  return new THREE.ExtrudeGeometry(new THREE.Shape(points.map(p=>new THREE.Vector2(...p))),{depth,bevelEnabled:false,steps:1});
 }
 function fractureBox(w,h,d,seed){
  const g=bevelBox(w,h,d,.010),p=g.attributes.position,v=[];for(let i=0;i<p.count;i++){let y=p.getY(i);if(i>=8)y-=.055*(.5+.5*Math.sin(i*2.31+seed*.73));v.push([p.getX(i),y,p.getZ(i)]);}
  const ix=Array.from(g.index.array).slice(0,48);for(let j=1;j<7;j++)ix.push(0,j,j+1);const c=v.length;v.push([0,h/2-.028,0]);for(let j=0;j<8;j++)ix.push(c,8+(j+1)%8,8+j);g.dispose();return mesh(v,ix);
 }
 // 指定した人工壁の矢狭間だけを静的に切り抜く。世界や衝突の生成には使わない。
 function cutRect(parts,x0,x1,y0,y1){
  function split(poly,axis,value,sign){const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;const list=da>=-1e-9?inside:outside;list.push(a);if((da>1e-9&&db<-1e-9)||(da<-1e-9&&db>1e-9)){const t=da/(da-db),q=a.map((v,k)=>v+(b[k]-v)*t);inside.push(q);outside.push(q);}}return[inside,outside];}
  return parts.map(part=>{const box=new THREE.Box3().setFromBufferAttribute(part.g.attributes.position).applyMatrix4(part.m);if(box.max.x<x0||box.min.x>x1||box.max.y<y0||box.min.y>y1)return part;const g=part.g.index?part.g.toNonIndexed():part.g.clone();g.applyMatrix4(part.m);const a=g.attributes.position,v=[];for(let i=0;i<a.count;i+=3){const points=[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]);if(Math.max(...points.map(p=>p[0]))<=x0||Math.min(...points.map(p=>p[0]))>=x1||Math.max(...points.map(p=>p[1]))<=y0||Math.min(...points.map(p=>p[1]))>=y1){for(const p of points)v.push(...p);continue;}let poly=[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]);for(const[axis,value,sign]of [[0,x0,1],[0,x1,-1],[1,y0,1],[1,y1,-1]]){if(poly.length<3)break;const result=split(poly,axis,value,sign);poly=result[0];const outside=result[1];for(let j=1;j<outside.length-1;j++)v.push(...outside[0],...outside[j],...outside[j+1]);}}
   g.dispose();const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(v,3));return{...part,g:out,m:new THREE.Matrix4()};});
 }
 return{bevelBox,wedge,fractureBox,cutRect};
})();
