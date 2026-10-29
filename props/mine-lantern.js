// 坑道壁灯。灯体・芯・ガラスは共有し、照明は既存の6灯枠を使用する。
window.TDMineLantern=(()=>{
 const id='mine_wall_lantern',mount=1.65,origin=[0,-.14,.50],power=3.2,range=5.5;
 let cached,mat,glassMat,bodyGeo,glassGeo;
 function maps(){if(cached)return cached;const w=256,h=128,colour=new Uint8Array(w*h*4),packed=colour.slice(),normal=colour.slice(),emission=colour.slice();
 const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4,slot=x>>6,u=(x%64)/63,v=y/127,n=noise(x,y),cloud=.5+.25*Math.sin(u*9+v*5)+.25*Math.sin(v*13-u*3),edge=Math.pow(Math.abs(u-.5)*2,10),rust=Math.max(0,cloud-.62)*(1-edge),soot=slot===2?Math.pow(v,2)*.22:0;let rgb,metal,rough;
 if(slot===0){rgb=[.28,.30,.31].map((a,j)=>a+edge*.18+n*.025+rust*[.36,.12,-.02][j]);metal=.72-rust;rough=.42+rust*.6-cloud*.07;}
 if(slot===1){rgb=[.56,.40,.19].map((a,j)=>a*(.88+.18*cloud)+edge*[.20,.16,.08][j]);metal=.82;rough=.34+.12*cloud;}
 if(slot===2){rgb=[.22,.24,.25].map(a=>a*(1-soot)+edge*.12+n*.018);metal=.58;rough=.58+.18*v;}
 if(slot===3){rgb=[1,.55+.25*v,.09+.2*v];metal=0;rough=.85;}
 for(let j=0;j<3;j++)colour[k+j]=Math.round(Math.max(0,Math.min(1,rgb[j]))*255);colour[k+3]=255;
 packed.set([Math.round(metal*255),255,0,Math.round((1-rough)*255)],k);normal.set([128+Math.round((n-.5)*3),128+Math.round(Math.sin(v*160)*1.4),255,255],k);emission.set(slot===3?[255,Math.round(230-105*v),Math.round(130-114*v),255]:[0,0,0,255],k);}
 const tex=(data,srgb=false)=>{const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};const mr=packed.slice();for(let k=0;k<mr.length;k+=4){mr[k+1]=255-packed[k+3];mr[k+2]=packed[k];}cached={w,h,colour,packed,normal,emission,colourTex:tex(colour,true),mrTex:tex(mr),normalTex:tex(normal),emissionTex:tex(emission,true)};return cached;}
 function material(){if(mat)return mat;const t=maps();return mat=new THREE.MeshStandardMaterial({name:'Mine wall lantern iron and brass',color:0xffffff,map:t.colourTex,metalness:1,roughness:1,metalnessMap:t.mrTex,roughnessMap:t.mrTex,normalMap:t.normalTex,normalScale:new THREE.Vector2(.3,.3),emissive:0xffffff,emissiveMap:t.emissionTex,emissiveIntensity:3});}
 function glassMaterial(){return glassMat||(glassMat=new THREE.MeshStandardMaterial({name:'Mine lamp thin clear glass',color:0xc6d5cf,roughness:.18,metalness:.05,transparent:true,opacity:.16,depthWrite:false,side:THREE.FrontSide}));}
 function geometry(){if(bodyGeo)return bodyGeo;const p=[],n=[],uv=[];function add(g,slot,pos=[0,0,0],rot=[0,0,0]){let q=g.index?g.toNonIndexed():g;const m=new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1));q.applyMatrix4(m);const a=q.attributes;for(let i=0;i<a.position.count;i++){p.push(a.position.getX(i),a.position.getY(i),a.position.getZ(i));n.push(a.normal.getX(i),a.normal.getY(i),a.normal.getZ(i));uv.push((slot*64+3+Math.max(0,Math.min(1,a.uv.getX(i)))*58)/256,(3+Math.max(0,Math.min(1,a.uv.getY(i)))*122)/128);}if(q!==g)q.dispose();g.dispose();}
 const box=(x,y,z,w,h,d,slot=0)=>add(new THREE.BoxGeometry(w,h,d),slot,[x,y,z]);const rod=(a,b,r,slot=0)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r,r,av.distanceTo(bv),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.clone().sub(av).normalize()));add(g,slot,av.add(bv).multiplyScalar(.5).toArray());};const lathe=(profile,slot)=>add(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),12),slot,[0,0,.38]);
 box(0,.16,.018,.115,.56,.036);for(const y of [-.045,.365])add(new THREE.CylinderGeometry(.024,.027,.018,6),1,[0,y,.043],[Math.PI/2,0,0]);
 box(0,.414,.22,.044,.040,.40);rod([0,.06,.04],[0,.399,.36],.018);box(0,.39,.395,.052,.05,.038);
 add(new THREE.TorusGeometry(.034,.009,4,10,Math.PI*1.7),0,[0,.365,.38],[0,Math.PI/2,.20]);
 // 環・覆い・燃料槽は同じ中心軸。吊り環の頂点が腕のフックを通る。
 add(new THREE.TorusGeometry(.086,.012,4,12,Math.PI),0,[0,.272,.38]);for(const x of [-.086,.086])rod([x,.272,.38],[x,.198,.38],.012);
 lathe([[.001,-.438],[.103,-.438],[.122,-.421],[.122,-.333],[.112,-.308],[.106,-.275],[.115,-.263],[.115,-.242],[.001,-.242]],1);
 lathe([[.115,.02],[.125,.029],[.125,.05],[.105,.06],[.094,.17],[.06,.202],[.001,.208]],2);
 for(const y of [-.24,.025])lathe([[.105,y-.010],[.117,y-.010],[.117,y+.01],[.105,y+.01]],1);
 for(let j=0;j<4;j++){const a=Math.PI/4+j*Math.PI/2;rod([Math.cos(a)*.108,-.25,.38+Math.sin(a)*.108],[Math.cos(a)*.108,.045,.38+Math.sin(a)*.108],.010);}
 // 背面反射板と芯皿。透明面の内側に実体があり、発光ガラス全体にはしない。
 box(0,-.108,.295,.12,.24,.008,1);lathe([[.001,-.243],[.045,-.243],[.045,-.22],[.023,-.21],[.023,-.196],[.001,-.196]],1);
 lathe([[.001,-.197],[.027,-.18],[.024,-.135],[.012,-.085],[.002,-.057]],3);
 for(const x of [-.05,.05])box(x,.12,.466,.013,.064,.006,0);
 box(.125,-.36,.38,.024,.025,.038,0);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(p.length).fill(1),3));g.setAttribute('glow',new THREE.Float32BufferAttribute(new Float32Array(p.length/3),1));g.setIndex(Array.from({length:p.length/3},(_,i)=>i));g.computeBoundingBox();g.computeBoundingSphere();return bodyGeo=g;}
 function glassGeometry(){if(glassGeo)return glassGeo;const g=new THREE.CylinderGeometry(.102,.102,.265,12,1,true);g.translate(0,-.1075,.38);g.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));g.computeBoundingBox();g.computeBoundingSphere();return glassGeo=g;}
 function create(scene){let mesh=null,count=0;return{sync(props,types,baseY){const rows=props.filter(p=>types[p[0]].mineLantern);count=rows.length;if(!mesh||mesh.instanceMatrix.count<count){if(mesh){scene.remove(mesh);mesh.dispose();}mesh=new THREE.InstancedMesh(glassGeometry(),glassMaterial(),Math.max(1,2**Math.ceil(Math.log2(Math.max(1,count)))));mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;scene.add(mesh);}mesh.count=count;const m=new THREE.Matrix4();rows.forEach((p,i)=>{m.compose(new THREE.Vector3(p[1],baseY(p),p[2]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]-(types[p[0]].yawOffset||0)*Math.PI/180),new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4]));mesh.setMatrixAt(i,m);});mesh.instanceMatrix.needsUpdate=true;},get count(){return count;},get mesh(){return mesh;}};}
 function phase(id){let h=2166136261;for(const c of String(id||""))h=Math.imul(h^c.charCodeAt(0),16777619);return (h&65535)/65536;}
 function lightPose(p,t,y){const v=new THREE.Vector3(...origin).multiply(new THREE.Vector3(p[4],p[4]*(p[6]??1),p[4])).applyAxisAngle(new THREE.Vector3(0,1,0),p[3]-(t.yawOffset||0)*Math.PI/180);return v.add(new THREE.Vector3(p[1],y,p[2]));}
 function png(data){const t=maps(),c=document.createElement('canvas');c.width=t.w;c.height=t.h;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),t.w,t.h),0,0);return c.toDataURL('image/png').split(',')[1];}
 function exportData(types){const t=maps();return{version:1,units:'metres',axes:'Unity X/Y/Z',textures:{width:t.w,height:t.h,colour:png(t.colour),packed:png(t.packed),normal:png(t.normal),emission:png(t.emission)},light:{origin:[origin[0],origin[1],-origin[2]],power,range},glass:TDSmallPropExport.geometry(glassGeometry()),assets:types.filter(t=>t.id===id&&t.assetKey==='tdj/'+id).map(t=>({id,assetKey:t.assetKey,radius:t.r,height:t.height,shape:!!t.shape,groundSink:-mount,material:'mineLantern',circleColliders:t.r>0&&!t.shape?(t.offs||[[0,0]]).map(o=>({center:[o[0],0,-o[1]],radius:t.r,height:t.height})):undefined,...TDSmallPropExport.geometry(t.geo)}))};}
 TDProps.add({id,name:'壁掛けランタン',r:0,height:.9,groundSink:-mount,min:2,sc:[1,1],slope:10,vis:.5,anyGround:true,manualOnly:true,tags:['cave'],mineLantern:true,material:'mineLantern',light:[0xffb95c,power,mount+origin[1]],build:geometry});
 return{id,mount,origin,power,range,maps,material,glassMaterial,glassGeometry,geometry,create,lightPose,phase,export:exportData};
})();
