// 独立配置の木製支保枠。既存の坑道生成やレール規格は変更しない。
window.TDMineTimber=(()=>{
 'use strict';
 const id='mine_timber_frame',spec={width:2.58,height:2.86,postCentres:2.22,clearWidth:1.98,clearHeight:2.55};
 const regions={wood:[4,4,252,188],end:[4,196,252,252],iron:[260,4,508,124],peg:[260,196,508,252]};
 function geometry(){
  const pos=[],normal=[],uv=[],indices=[];
  function face(points,expected,region,coords){
   let list=points.map(p=>p.clone()),st=coords.map(q=>q.slice());
   const n=list[1].clone().sub(list[0]).cross(list[2].clone().sub(list[0])).normalize();
   if(n.dot(expected)<0){list.reverse();st.reverse();n.negate();}
   const r=regions[region];for(let k=1;k<list.length-1;k++)for(const j of [0,k,k+1]){const p=list[j],t=st[j];indices.push(pos.length/3);pos.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);uv.push((r[0]+(r[2]-r[0])*t[0])/512,(r[1]+(r[3]-r[1])*t[1])/256);}
  }
  function beam(a,b,w,d,seed){
   const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),axis=B.clone().sub(A),length=axis.length();axis.normalize();
   const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis),c=.014,hw=w/2,hd=d/2;
   const ring=[[-hw+c,-hd],[hw-c,-hd],[hw,-hd+c],[hw,hd-c],[hw-c,hd],[-hw+c,hd],[-hw,hd-c],[-hw,-hd+c]],levels=[0,.43,1],verts=[];
   for(let l=0;l<3;l++)for(let j=0;j<8;j++){const[x,z]=ring[j],k=l===1?Math.sin(seed+j*.8)*.004:0;verts.push(new THREE.Vector3(x+k,levels[l]*length,z).applyQuaternion(q).add(A));}
   const u0=.04+(seed%4)*.025,u1=.94-(seed%3)*.025;
   for(let l=0;l<2;l++)for(let j=0;j<8;j++){const k=(j+1)%8,radial=new THREE.Vector3(ring[j][0]+ring[k][0],0,ring[j][1]+ring[k][1]).applyQuaternion(q);face([verts[l*8+j],verts[l*8+k],verts[(l+1)*8+k],verts[(l+1)*8+j]],radial,'wood',[[u0,levels[l]],[u1,levels[l]],[u1,levels[l+1]],[u0,levels[l+1]]]);}
   for(const l of [0,2])face(verts.slice(l*8,l*8+8),axis.clone().multiplyScalar(l===0?-1:1),'end',ring.map(([x,z])=>[x/w+.5,z/d+.5]));
  }
  function box(x,y,z,w,h,d,region='iron'){
   const v=(a,b,c)=>new THREE.Vector3(x+a*w/2,y+b*h/2,z+c*d/2),corners=[v(-1,-1,-1),v(1,-1,-1),v(1,1,-1),v(-1,1,-1),v(-1,-1,1),v(1,-1,1),v(1,1,1),v(-1,1,1)],faces=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];
   for(const f of faces){const p=f.map(i=>corners[i]),out=p.reduce((s,v)=>s.add(v),new THREE.Vector3()).multiplyScalar(.25).sub(new THREE.Vector3(x,y,z));face(p,out,region,[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]);}
  }
  // 柱上端が横梁下面へ直接当たり、方杖は柱と梁に食い込む。
  for(const s of [-1,1])beam([s*1.11,0,0],[s*1.11,2.55,0],.24,.28,s+3);
  beam([-1.29,2.7,0],[1.29,2.7,0],.30,.34,7);
  for(const s of [-1,1]){
   beam([s*1.10,1.95,0],[s*0.61,2.61,0],.16,.20,s+10);
   // 柱頭を巻く細い帯と、前後の留め頭。木部を隠す大型プレートは付けない。
   box(s*1.11,2.43,-.145,.25,.052,.014);box(s*1.11,2.43,.145,.25,.052,.014);
   box(s*1.11-.125,2.43,0,.014,.052,.29);box(s*1.11+.125,2.43,0,.014,.052,.29);
   for(const z of [-.159,.159])box(s*1.11,2.43,z,.038,.038,.016,'peg');
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3),1));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
 function exportData(types){return{version:1,units:'metres',axes:'Unity X/Y/Z',atlas:'mineRailsV1',assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,groundSink:0,shape:false,material:'mineTimber',...(t.r>0?{circleColliders:(t.offs||[[-1.11,0],[1.11,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height}))}:{}),...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'坑道の木製支保枠',r:.17,offs:[-1.11,1.11],min:3,sc:[1,1],slope:.05,vis:1.6,height:2.86,groundSink:0,anyGround:true,manualOnly:true,shape:false,tags:['cave','ruins'],material:'mineTimber',mineTimber:true,build:geometry});
 return{id,spec,geometry,material:()=>TDMineRails.material(),export:exportData};
})();
