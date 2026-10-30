// 自作の古い乱網。写真は使わず、支持糸・捕獲部・破れを決定的に描く。
window.TDMineCobweb=(()=>{
 const id='mine_cobweb',mount=1.65,cutoff=.12;let cache,mat,geo;
 function maps(){if(cache)return cache;const w=512,h=512,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');let seed=177031;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function thread(a,b,width,alpha=.9,sag=.012){ctx.beginPath();ctx.moveTo(a[0]*w,a[1]*h);ctx.quadraticCurveTo((a[0]+b[0])*.5*w,((a[1]+b[1])*.5+sag)*h,b[0]*w,b[1]*h);ctx.strokeStyle=`rgba(194,190,174,${alpha})`;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
 const anchors=[[.045,.055],[.965,.045],[.055,.95],[.74,.61]];
 thread(anchors[0],anchors[1],1.8,.92,.065);thread(anchors[0],anchors[2],1.7,.91,.02);thread(anchors[1],anchors[3],1.35,.83,.025);thread(anchors[2],[.22,.89],1.20,.80,.025);thread([.29,.84],[.43,.79],1.35,.75,.02);thread([.60,.69],anchors[3],1.35,.78,.025);
 // 結節の間隔と高さを不均一に歪め、格子の整列を崩す。捕獲部の二群は保持。
 const points=[];for(let j=0;j<13;j++){const row=[];for(let i=0;i<15;i++){const v=.09+j*.061+Math.sin(i*.65+j*.75)*.022+(rnd()-.5)*.045,u=.07+i*.058+Math.sin(j*.80+i*.55)*.027+(rnd()-.5)*.045;const right=.94-.38*v;const hole=((u-.60)/.115)**2+((v-.53)/.14)**2<1;row.push(u<right&&!hole&&!(v>.72&&u>.40)?[u,v]:null);}points.push(row);}
 for(let j=0;j<13;j++)for(let i=0;i<15;i++){const a=points[j][i];if(!a)continue;const links=[[j,i+1],[j+1,i],[j+1,i+(rnd()<.5?-1:1)]];for(const [y,x]of links){const b=points[y]?.[x];if(b&&rnd()>.19){const dense=(a[0]<.43&&a[1]<.55);thread(a,b,dense?1.12:.84,.58+rnd()*.35,.003+rnd()*.025);}}}
 // 捕獲部の二つの群に細糸を集める。全域均一な格子にはしない。
 for(const [cx,cy,rx,ry]of [[.27,.29,.19,.14],[.21,.59,.12,.17]]){
  const cluster=[];for(let k=0;k<60;k++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd());cluster.push([cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r]);}
  for(let k=0;k<cluster.length;k++){const a=cluster[k];const support=points.flat().filter(Boolean).sort((b,c)=>((b[0]-a[0])**2+(b[1]-a[1])**2)-((c[0]-a[0])**2+(c[1]-a[1])**2))[0];thread(a,support,.8,.64,.004);const near=cluster.map((b,j)=>({b,j,d:(b[0]-a[0])**2+(b[1]-a[1])**2})).filter(x=>x.j!==k).sort((a,b)=>a.d-b.d);for(const q of near.slice(0,2))if(q.j>k)thread(a,q.b,.68+rnd()*.22,.48+rnd()*.27,.003+rnd()*.006);}
 }
 // 長い支持糸は網の途中に消えず、壁・梁の接点へ集める。
 for(const [a,b]of [[anchors[0],[.31,.46]],[anchors[1],[.49,.32]],[anchors[2],[.22,.62]],[anchors[3],[.43,.37]],[[.07,.31],[.64,.24]],[[.11,.62],[.53,.70]]])thread(a,b,1.22,.85,.025);
 // 破れた端に少数の垂れ糸。全面の白い膜・同心円は作らない。
 for(const [a,b]of [[[.50,.41],[.56,.48]],[[.46,.61],[.48,.69]],[[.40,.77],[.43,.90]],[[.70,.39],[.76,.46]]])thread(a,b,1.05,.70,.035);
 for(let k=0;k<80;k++){const a=points[Math.floor(rnd()*10)]?.[Math.floor(rnd()*8)];if(!a||rnd()<.35)continue;ctx.fillStyle='rgba(153,145,125,.24)';ctx.beginPath();ctx.ellipse(a[0]*w,a[1]*h,1.0+rnd()*2.4,.7+rnd()*1.6,rnd()*3,0,Math.PI*2);ctx.fill();}
 const rgba=new Uint8Array(ctx.getImageData(0,0,w,h).data),tex=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=2;tex.needsUpdate=true;cache={w,h,rgba,tex,png:c.toDataURL('image/png').split(',')[1],coverage:rgba.filter((_,i)=>i%4===3).reduce((n,a)=>n+(a>cutoff*255),0)/(w*h)};return cache;}
 function material(){return mat||(mat=new THREE.MeshStandardMaterial({name:'Dusty old cobweb',map:maps().tex,color:0xffffff,roughness:.91,metalness:0,alphaTest:cutoff,transparent:false,depthWrite:true,side:THREE.FrontSide,alphaToCoverage:true}));}
 function geometry(){if(geo)return geo;const p=[],n=[],uv=[],ix=[];const nx=5,ny=4;
 const pos=(u,v)=>[(u-.5)*1.6,(.5-v)*1.2,.025+.24*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+.055*u*v];
 for(let side=0;side<2;side++){let off=p.length/3;for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const u=x/nx,v=y/ny;p.push(...pos(u,v));uv.push(u,v);}for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=off+y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;ix.push(...(side?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(p.length/3),1));g.computeBoundingBox();g.computeBoundingSphere();return geo=g;}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',textures:{width:t.w,height:t.h,colour:t.png},cutoff,assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:-mount,material:'mineCobweb',circleColliders:t.r>0&&!t.shape?(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height})):undefined,...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'古いクモの巣',r:0,height:1.2,groundSink:-mount,min:2,sc:[1,1],slope:10,vis:.5,anyGround:true,manualOnly:true,tags:['cave','ruins'],mineCobweb:true,material:'mineCobweb',build:geometry});
 return{id,mount,cutoff,maps,material,geometry,export:exportData};
})();
