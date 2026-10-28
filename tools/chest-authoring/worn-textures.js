window.ChestWornWeather=(()=>{
 const size=512,colour=document.createElement('canvas'),roughness=document.createElement('canvas');colour.width=colour.height=roughness.width=roughness.height=size;
 const ctx=colour.getContext('2d'),rc=roughness.getContext('2d'),pixels=ctx.createImageData(size,size),rp=rc.createImageData(size,size);let cell=0;const records=[];
 function hash(x,y){const t=Math.sin(x*127.1+y*311.7)*43758.5453;return t-Math.floor(t);}
 function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,U=u*u*(3-2*u),V=v*v*(3-2*v);return(1-V)*((1-U)*hash(a,b)+U*hash(a+1,b))+V*((1-U)*hash(a,b+1)+U*hash(a+1,b+1));}
 function pointDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);}
 function board(g,w,h,left,right,split,wood){const index=cell++;if(index>=32)throw Error('Worn atlas cell budget');const x0=(index%4)*128,y0=Math.floor(index/4)*64,phase=index*1.739;
  for(let y=0;y<64;y++)for(let x=0;x<128;x++){const u=Math.max(0,Math.min(1,(x-3)/121)),v=Math.max(0,Math.min(1,(y-3)/57)),end=Math.exp(-u/((left>.08)?.11:.035))*(left>.08?1:.35)+Math.exp(-(1-u)/((right>.08)?.14:.035))*(right>.08?1:.35),grain=Math.sin(v*112+Math.sin(u*8+phase)*1.2)+.45*Math.sin(v*247+u*3+phase),cloud=Math.sin(u*5.1+phase)*Math.sin(v*2.9+phase*.3),exposure=.5+.5*Math.sin(phase*.72);
   let fissure=0;if(split){const poly=[[-.31,-.055],[-.12,-.025],[-.035,.04],[-.10,.085],[-.23,.035]];let dist=10;for(let k=0;k<poly.length;k++)dist=Math.min(dist,pointDistance(u-.5,v-.5,poly[k],poly[(k+1)%poly.length]));fissure=Math.max(0,1-dist/.017);}
   const front=index>=9&&index<=12;
   const flow=v+.018*Math.sin(u*10+phase)+.009*Math.sin(u*23+phase*.7),fibres=(noise(u*1.5+phase,flow*22+phase)-.5)*2,splitLine=(Math.exp(-Math.pow((v-(.28+.012*Math.sin(u*15+phase)))/.008,2))+Math.exp(-Math.pow((v-(.67+.018*Math.sin(u*8+phase)))/.006,2)))*Math.pow(u,3)*(right>.08?1:split?.4:0);
   const damage=Math.min(1,end)*(right>.08||left>.08?1:0),bleach=damage*(.5+.5*Math.sin(v*21+u*7+phase));
   const broad=(front?150:128)+exposure*12+(noise(u*4+phase,v*3)-.5)*11+grain*.5+fibres*5-splitLine*21-end*23-fissure*20+bleach*6;const rgb=wood?[broad+7,broad+4,broad-5]:[76+grain,59+grain,46+grain];const off=((y0+y)*size+x0+x)*4;for(let c=0;c<3;c++){pixels.data[off+c]=Math.max(0,Math.min(255,rgb[c]));rp.data[off+c]=wood?Math.min(250,223+end*16+fissure*7+cloud*4):229;}pixels.data[off+3]=rp.data[off+3]=255;
  }
  const p=g.attributes.position,uv=[];for(let k=0;k<p.count;k++){const u=Math.max(0,Math.min(1,p.getX(k)/w+.5)),v=Math.max(0,Math.min(1,p.getY(k)/h+.5));uv.push((x0+3+u*121+.5)/size,(y0+3+v*57+.5)/size);}g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));records.push({index,w,h,left,right,split,wood,rect:[x0,y0,128,64]});return g;
 }
 let material;function get(){if(material)return material;ctx.putImageData(pixels,0,0);rc.putImageData(rp,0,0);const map=new THREE.CanvasTexture(colour),rough=new THREE.CanvasTexture(roughness);map.colorSpace=THREE.SRGBColorSpace;rough.colorSpace=THREE.NoColorSpace;for(const t of [map,rough]){t.flipY=false;t.anisotropy=2;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;}material=new THREE.MeshStandardMaterial({map,roughnessMap:rough,roughness:1,metalness:0,color:0xffffff,vertexColors:false});return material;}
 const original=TDChestSurface.material;TDChestSurface.material=(source,id,...args)=>id==='treasurechest_worn'?get():original(source,id,...args);
 return{board,get,records,colour,roughness};
})();
