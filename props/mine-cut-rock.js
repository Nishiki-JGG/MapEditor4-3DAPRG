// 掘削痕は自作。石肌は同梱CC0 Rock050から派生し、形状とUVは維持する。
window.TDMineCutRock=(()=>{
 'use strict';
 const id='mine_cut_rock',spec={version:1,width:1.8,height:1.92,depth:.30,front:'+Z',back:-.06};let textureSet,shared;
 const noise=(x,y)=>{const q=Math.sin(x*127.1+y*311.7)*43758.5453;return q-Math.floor(q)},marks=[];
 // 中央の作業面を主題とし、周囲の自然な割れは浅く抑える。
 const peels=[{u:.50,v:.55,a:.30,b:.17,tilt:.22,d:.14,fresh:1},{u:.30,v:.78,a:.26,b:.15,tilt:.28,d:.03,fresh:.10},{u:.65,v:.25,a:.27,b:.16,tilt:-.15,d:.035,fresh:.12}];
 const clamp=x=>Math.max(0,Math.min(1,x));
 function fracture(u,v){let depth=0,fresh=0;for(const p of peels){const x=(u-p.u)/p.a,y=(v-p.v+p.tilt*(u-p.u))/p.b,r=Math.max(Math.abs(x),Math.abs(y),Math.abs(x*.63+y*.54));const f=clamp((1-r)/.13);depth+=p.d*f*(.86+.14*x);fresh=Math.max(fresh,f*p.fresh);}return{depth,fresh};}
 // 一群の掘削打点。長さ/向き/間隔を不均一にして連続した爪傷にしない。
 const strikes=[[.32,.58,.15,.048,.023],[.39,.61,.48,.057,.025],[.46,.58,.31,.055,.027],[.53,.60,.70,.063,.028],[.60,.56,.38,.058,.026],[.68,.53,-.08,.049,.023],[.39,.48,.62,.043,.023],[.49,.47,.24,.052,.026],[.60,.45,.47,.047,.024]];
 strikes.forEach((a,i)=>marks.push({u:a[0],v:a[1],a:a[2],l:a[3],w:a[4],d:.75+noise(i,8)*.25,chip:noise(i,9)}));
 for(let i=0;i<11;i++)marks.push({u:.32+noise(i,1)*.34,v:.46+noise(i,3)*.14,a:.15+noise(i,4)*.65,l:.012+noise(i,5)*.017,w:.008+noise(i,7)*.008,d:.3+noise(i,8)*.3,chip:noise(i,9)});
 function sample(u,v,front=true){const cloud=(Math.sin(u*13+Math.sin(v*8))+Math.sin(v*21-u*9)*.5)/1.5;let groove=0,ridge=0;if(front)for(const m of marks){const dx=u-m.u,dy=v-m.v,c=Math.cos(m.a),s=Math.sin(m.a),along=dx*s+dy*c,across=dx*c-dy*s,t=along/m.l;if(t<-.8||t>1)continue;const taper=clamp((1-t)/1.3),q=across/(m.w*(.20+.8*taper)),broken=clamp((t+.8+q*.18*m.chip)*5),bite=clamp(1-Math.abs(q))*taper*broken*m.d;groove=Math.max(groove,bite);ridge=Math.max(ridge,Math.exp(-Math.pow((Math.abs(q)-1.15)*3.2,2))*taper*broken*.24*m.d);}
 const f=fracture(u,v),fault=Math.abs(v-(.39+.13*u+.012*Math.sin(u*21))),crack=front?clamp(1-fault/.004)*clamp(1-Math.abs(u-.67)*3):0;
 return{cloud,groove,ridge,crack,fresh:front?Math.max(f.fresh*.65,groove*.85,ridge*2):0,depth:front?f.depth:0,h:cloud*.0015-groove*.016+ridge*.004-crack*.004};}
 function maps(){if(textureSet)return textureSet;const w=512,h=256,colour=new Uint8Array(w*h*4),packed=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4),heights=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const front=x<384,u=front?(x-3)/378:(x-387)/122,v=(y-3)/250,q=sample(u,v,front),n=noise(x,y),grain=(n-.5)*7,stone=(noise(x>>3,y>>3)-.5)*7+(noise(x>>1,y>>1)-.5)*4,base=102+stone+q.cloud*7+q.fresh*23+q.ridge*9+q.groove*4-q.crack*12+(front?0:1);const i=(y*w+x)*4;colour[i]=Math.round(base+grain+6);colour[i+1]=Math.round(base+grain+3);colour[i+2]=Math.round(base+grain);colour[i+3]=255;packed[i]=0;packed[i+1]=Math.round(255*(1-q.groove*.16-q.crack*.18));packed[i+2]=0;packed[i+3]=Math.round(255*(.19+q.fresh*.09+q.cloud*.025-q.groove*.04));heights[y*w+x]=q.h+(n-.5)*.0004;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;let dx=(heights[y*w+Math.min(w-1,x+1)]-heights[y*w+Math.max(0,x-1)])*(x<384?378/3.6:122/3.6),dy=(heights[Math.min(h-1,y+1)*w+x]-heights[Math.max(0,y-1)*w+x])*(250/3.84);if(x===383||x===384)dx=0;const len=Math.hypot(dx,dy,1);normal[i]=Math.round((.5-dx*.5/len)*255);normal[i+1]=Math.round((.5-dy*.5/len)*255);normal[i+2]=Math.round((.5+.5/len)*255);normal[i+3]=255;}
 const tex=(bytes,srgb)=>{const t=new THREE.DataTexture(bytes,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.flipY=false;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=2;t.needsUpdate=true;return t;};const mr=new Uint8Array(packed);for(let i=0;i<mr.length;i+=4){mr[i]=packed[i+1];mr[i+1]=255-packed[i+3];mr[i+2]=0;}const data=tex(mr,false);textureSet={w,h,colour,packed,normal,map:tex(colour,true),metalRough:data,normalMap:tex(normal,false),aoMap:data,status:'loading',error:null};textureSet.ready=installStone(textureSet);return textureSet;
 }

 // Reuse the decoded, bundled CC0 source; no new file, GPU map, or geometry changes.
 // Atomic replacement keeps placed instances and preview clones on identical maps.
 async function installStone(t){try{
  await Promise.resolve();
  const source=window.TDMineCollapse;if(!source)throw Error('shared Rock050 source unavailable');
  await source.prepare();const rock=source.maps();if(rock.status!=='ready')throw Error('shared Rock050 source not ready');
  const linear=n=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4);};
  const srgb=n=>255*(n<=.0031308?n*12.92:1.055*Math.pow(n,1/2.4)-.055);
  const lut=Array.from({length:256},(_,i)=>linear(i)),mean=[new Float64Array(4),new Float64Array(4)];
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,m=mean[x>>8];for(let c=0;c<3;c++)m[c]+=lut[rock.colour[i+c]]/65536;m[3]+=rock.packed[i+3]/65536;}
  function read(bytes,u,v,half,c,colour=false){const x=clamp(u)*255,y=clamp(v)*255,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;let n=0;for(let j=0;j<2;j++)for(let k=0;k<2;k++){let b=bytes[((Math.min(255,y0+j)*512)+half*256+Math.min(255,x0+k))*4+c];n+=(colour?lut[b]:b)*(k?fx:1-fx)*(j?fy:1-fy);}return n;}
  const colour=new Uint8Array(t.colour),normal=new Uint8Array(t.normal),packed=new Uint8Array(t.packed);
  for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){
   const front=x<384,u=front?(x-3)/378:(x-387)/122,v=(y-3)/250,q=sample(u,v,front),fresh=clamp(q.fresh/0.65),i=(y*t.w+x)*4;
   // 1.8m front occupies 75% of the assumed 2.4m source tile. Same location on both rind/fresh halves.
   const su=.09+clamp(u)*.75,sv=.06+clamp(v)*.80,blend=(a,b)=>a*(1-fresh)+b*fresh;
   for(let c=0;c<3;c++){
    const ratio=blend(read(rock.colour,su,sv,0,c,true)/mean[0][c],read(rock.colour,su,sv,1,c,true)/mean[1][c]);
    const grain=(noise(x,y)-.5)*7+(noise(x>>3,y>>3)-.5)*7+(noise(x>>1,y>>1)-.5)*4;
    const base=linear(Math.max(0,colour[i+c]-grain*.8)),strength=blend(.85,.55);
    colour[i+c]=Math.round(Math.max(0,Math.min(255,srgb(base*(1+strength*(Math.max(.55,Math.min(1.65,ratio))-1))))));
   }
   const nx=blend(read(rock.normal,su,sv,0,0),read(rock.normal,su,sv,1,0))/127.5-1,
    ny=blend(read(rock.normal,su,sv,0,1),read(rock.normal,su,sv,1,1))/127.5-1,
    nz=Math.max(.25,blend(read(rock.normal,su,sv,0,2),read(rock.normal,su,sv,1,2))/127.5-1),
    z=Math.max(.1,normal[i+2]/127.5-1),strength=blend(.45,.22)*(1-q.groove*.75),
    dx=(normal[i]/127.5-1)/z+nx/nz*strength,dy=(normal[i+1]/127.5-1)/z+ny/nz*strength,len=Math.hypot(dx,dy,1);
   normal[i]=Math.round((.5+.5*dx/len)*255);normal[i+1]=Math.round((.5+.5*dy/len)*255);normal[i+2]=Math.round((.5+.5/len)*255);
   const ao=blend(read(rock.packed,su,sv,0,1),read(rock.packed,su,sv,1,1))/255;
   packed[i+1]=Math.round(packed[i+1]*(.92+.08*ao));
   packed[i+3]=Math.round(Math.max(0,Math.min(255,packed[i+3]+.4*blend(read(rock.packed,su,sv,0,3)-mean[0][3],read(rock.packed,su,sv,1,3)-mean[1][3]))));
  }
  t.colour.set(colour);t.normal.set(normal);t.packed.set(packed);
  const mr=t.metalRough.image.data;for(let i=0;i<mr.length;i+=4){mr[i]=packed[i+1];mr[i+1]=255-packed[i+3];mr[i+2]=0;mr[i+3]=255;}
  for(const map of [t.map,t.normalMap,t.metalRough])map.needsUpdate=true;t.status='ready';
 }catch(e){t.status='fallback';t.error=String(e.message||e);}}
 function prepare(){return maps().ready;}
 function material(){if(!shared){const t=maps();shared=new THREE.MeshStandardMaterial({name:'hand-picked-rock',map:t.map,metalness:0,roughness:1,roughnessMap:t.metalRough,normalMap:t.normalMap,normalScale:new THREE.Vector2(1,1),aoMap:t.aoMap,aoMapIntensity:.6});}return shared;}
 function geometry(){const nx=10,ny=12,p=[],uv=[],ix=[];
 const left=[-.85,-.87,-.88,-.88,-.83,-.82,-.81,-.86,-.90,-.87,-.83,-.76,-.70],right=[.87,.88,.88,.84,.77,.76,.79,.83,.84,.81,.75,.68,.58],top=[1.62,1.76,1.81,1.82,1.85,1.84,1.80,1.77,1.73,1.66,1.56],bottom=[0,0,0,0,0,.01,.04,.02,0,0,0];
 const uy=[0,.07,.14,.22,.30,.38,.46,.55,.64,.72,.81,.90,1];
 for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){let u=x/nx,v=uy[y];if(x>0&&x<nx)u+=(noise(x,y)-.5)*.04;if(y>0&&y<ny)v+=(noise(y,x+71)-.5)*.025;
 const xx=left[y]+u*(right[y]-left[y]),yy=bottom[x]*(1-v)+top[x]*v,gu=(xx+.9)/1.8,gv=yy/1.92,q=sample(gu,gv),edge=Math.max(clamp((.13-u)/.13),clamp((u-.87)/.13),clamp((v-.88)/.12));
 const exposed=(u>.72&&v>.86)||(u<.12&&v>.49&&v<.65),outer=-.035+(exposed?.065:0),plane=.14+.015*xx-.012*yy-q.depth*.6,z=plane*(1-edge)+outer*edge;
 p.push(xx,yy,z);uv.push((3+gu*378)/512,(3+gv*250)/256);}

 const area=(a,b,c)=>(p[b*3]-p[a*3])*(p[c*3+1]-p[a*3+1])-(p[b*3+1]-p[a*3+1])*(p[c*3]-p[a*3]);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+nx+1;if(area(a,a+1,b)>0&&area(a+1,b+1,b)>0)ix.push(a,a+1,b,a+1,b+1,b);else if(area(a,a+1,b+1)>0&&area(a,b+1,b)>0)ix.push(a,a+1,b+1,a,b+1,b);else throw Error("Rock front cell folds");}
 const front=new THREE.BufferGeometry();front.setAttribute('position',new THREE.Float32BufferAttribute(p,3));front.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));front.setIndex(ix);front.computeVertexNormals();const g=front.toNonIndexed(),faces=[],adj=Array.from({length:p.length/3},()=>[]),limit=Math.cos(35*Math.PI/180);
 for(let f=0;f<ix.length;f+=3){const a=new THREE.Vector3().fromArray(p,ix[f]*3),b=new THREE.Vector3().fromArray(p,ix[f+1]*3),c=new THREE.Vector3().fromArray(p,ix[f+2]*3),area=b.sub(a).cross(c.sub(a)),unit=area.clone().normalize();faces.push({area,unit});for(let k=0;k<3;k++)adj[ix[f+k]].push(f/3);}
 // 同一面内は面積加重で滑らかにし、35度を超える破断の稜線を跨がない。
 for(let f=0;f<faces.length;f++)for(let k=0;k<3;k++){const n=new THREE.Vector3();for(const j of adj[ix[f*3+k]])if(faces[f].unit.dot(faces[j].unit)>=limit)n.add(faces[j].area);n.normalize();g.attributes.normal.setXYZ(f*3+k,n.x,n.y,n.z);}front.dispose();const out={position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),uv:Array.from(g.attributes.uv.array)};g.dispose();
 const boundary=[];for(let x=0;x<=nx;x++)boundary.push(x);for(let y=1;y<=ny;y++)boundary.push(y*(nx+1)+nx);for(let x=nx-1;x>=0;x--)boundary.push(ny*(nx+1)+x);for(let y=ny-1;y>0;y--)boundary.push(y*(nx+1));
 function tri(a,b,c,coords){const normal=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a))).normalize();for(let k=0;k<3;k++){out.position.push(...[a,b,c][k]);out.normal.push(normal.x,normal.y,normal.z);out.uv.push((387+coords[k][0]*122)/512,(3+coords[k][1]*250)/256);}}
 for(let i=0;i<boundary.length;i++){const a=p.slice(boundary[i]*3,boundary[i]*3+3),b=p.slice(boundary[(i+1)%boundary.length]*3,boundary[(i+1)%boundary.length]*3+3),aa=[a[0],a[1],-.06],bb=[b[0],b[1],-.06];tri(a,aa,b,[[i/boundary.length,1],[i/boundary.length,0],[(i+1)/boundary.length,1]]);tri(b,aa,bb,[[(i+1)/boundary.length,1],[i/boundary.length,0],[(i+1)/boundary.length,0]]);tri([0,.96,-.06],bb,aa,[[.5,.5],[(b[0]+.9)/1.8,b[1]/1.92],[(a[0]+.9)/1.8,a[1]/1.92]]);}
 const result=new THREE.BufferGeometry();for(const name of Object.keys(out))result.setAttribute(name,new THREE.Float32BufferAttribute(out[name],name==='uv'?2:3));result.setAttribute('uv1',result.attributes.uv.clone());result.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(out.position.length).fill(1),3));result.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(out.position.length/3),1));result.setIndex(Array.from({length:out.position.length/3},(_,i)=>i));result.computeBoundingBox();result.computeBoundingSphere();return result;
 }
 function png(bytes){const t=maps(),c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(bytes),t.w,t.h),0,0);return c.toDataURL('image/png').split(',')[1];}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',textures:{width:t.w,height:t.h,colour:png(t.colour),packed:png(t.packed),normal:png(t.normal)},assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:0,material:'mineCutRock',...(!t.shape&&t.r>0?{circleColliders:(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height}))}:{}),...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'掘削痕の岩壁',r:.9,collisionGeo:new THREE.BoxGeometry(1.82,1.92,.36).translate(0,.96,.12),height:1.92,groundSink:0,min:2,sc:[1,1],slope:.1,vis:1,anyGround:true,manualOnly:true,shape:true,tags:['cave'],material:'mineCutRock',mineCutRock:true,build:geometry});
 return{id,spec,maps,material,prepare,stats:()=>({status:maps().status,error:maps().error}),export:exportData};
})();
