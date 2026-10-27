// Original pixel recipe. Offline authoring only; never loaded by the editor.
window.TDChestSurfacePixels=(()=>{
 const ids=['treasurechest_worn','treasurechest','treasurechest_reinforced','treasurechest_ornate','treasurechest_silver','treasurechest_gold','treasurechest_rainbow'];
 const size=512,tile=256,pad=8,materials=new Map();let atlas;
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
 function noise(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v),h=(a,b)=>TDGeo.hash2(a+seed,b+seed*7);return mix(mix(h(ix,iy),h(ix+1,iy),s),mix(h(ix,iy+1),h(ix+1,iy+1),s),t);}
 // Original architectural tracery, built from broad connected strokes rather than tiled icons.
 const gothicPaths=TDChestReliefDesign.paths.map(path=>path.points);
 function gothic(u,v){let d=2,metres=2;for(const path of gothicPaths)for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy));d=Math.min(d,Math.hypot(u-a[0]-t*dx,v-a[1]-t*dy));const mx=dx*.60,my=dy*.332,mt=clamp(((u-a[0])*.60*mx+(v-a[1])*.332*my)/(mx*mx+my*my));metres=Math.min(metres,Math.hypot((u-a[0])*.60-mt*mx,(v-a[1])*.332-mt*my));}return[Math.exp(-Math.pow(d/.009,4)),Math.exp(-Math.pow((d-.024)/.0025,2)),Math.exp(-Math.pow((metres-.007)/.0025,2))];}
 function get(){if(atlas)return atlas;const started=performance.now(),means=[];const canvases=[0,1].map(()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;}),contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size)),heights=[];
  for(let kind=0;kind<4;kind++){const scratches=Array.from({length:18},(_,k)=>{const x=.05+.8*TDGeo.hash2(k+11,37),y=.05+.9*TDGeo.hash2(k+21,71),length=.025+.10*TDGeo.hash2(k+31,23);return[x,y,length,length*(TDGeo.hash2(k+41,19)-.5)*.35];}),field=new Float32Array(tile*tile),colour=new Float32Array(tile*tile*3),rough=new Float32Array(tile*tile),ao=new Float32Array(tile*tile);
   for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){const u=(x+.5)/tile,v=(y+.5)/tile,cloud=noise(u*8,v*8,71+kind),broad=noise(u*8,v*1.4,113),fine=TDGeo.hash2(x+kind*271,y+139),i=y*tile+x;
    if(kind<2){
     // Long fibres follow board length (v). Irregular bands come from continuous fields,
     // never a periodic sine or per-pixel colour speckle. One broad knot deflects fibres.
     const ku=u-.36,kv=v-.64,knot=Math.exp(-(ku*ku/.0025+kv*kv/.048)),warp=(noise(u*5,v*1.7,17)-.5)*.047+(noise(u*12,v*2.4,41)-.5)*.008+.016*ku/(Math.abs(ku)+.012)*knot,w=u+warp,grain=noise(w*33,v*1.1,197),fibres=noise(w*83,v*1.8,307),vein=Math.pow(grain,3.5),core=Math.exp(-(ku*ku/.00012+kv*kv/.0016)),tone=.79+.12*(broad-.5)+.075*(cloud-.5)-.09*vein+.035*(fibres-.5)-.045*core;
     colour.set([tone*.90,tone*.69,tone*.46].map(c=>clamp(c*(kind===1?.89:1))),i*3);field[i]=.023*grain+.009*fibres-.006*core;rough[i]=clamp((kind===1?.84:.72)+.10*(cloud-.5)+.065*vein+.025*core);ao[i]=1-.018*vein-.015*core;
    }
    else{let groove=0,relief=0,contact=0;if(kind===3){[groove,relief,contact]=gothic(u,v);}
     // Low-frequency polishing variation and directional tooling are stored in the maps.
     // Avoid per-pixel grit: shallow overlapping worked facets form the cast surface.
     const brush=noise(u*3,v*76,43),worked=noise(u*19,v*23,83),mottle=noise(u*3.2,v*4.1,151),scratch=scratches.reduce((value,[x,y,dx,dy])=>{const t=clamp(((u-x)*dx+(v-y)*dy)/(dx*dx+dy*dy)),d=Math.hypot(u-x-t*dx,v-y-t*dy);return Math.max(value,Math.exp(-Math.pow(d/.0018,2))*Math.min(1,t*12,(1-t)*12));},0);
     const tone=.955+.065*(mottle-.5)-(kind===3?.035:0)*groove-.045*relief;
     colour.set([tone,tone,tone],i*3);
     field[i]=(kind===3?.030:.008)*worked+.004*brush-(kind===3?.010:0)*groove-.004*relief-.008*scratch;
     rough[i]=clamp((kind===3?.50:.28)+(kind===3?.20:.43)*mottle+.07*(brush-.5)+.06*scratch+(kind===3?.10:0)*groove-.05*relief);
     ao[i]=1-(kind===3?.055:0)*groove-(kind===3?.12:0)*contact;}


   }
   let sum=[0,0,0,0];for(let i=0;i<tile*tile;i++){for(let k=0;k<3;k++){const v=colour[i*3+k];sum[k]+=v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}sum[3]+=rough[i];}means.push(sum.map(v=>v/(tile*tile)));heights.push(field);for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){const sx=Math.min(tile-pad-1,Math.max(pad,x)),sy=Math.min(tile-pad-1,Math.max(pad,y)),i=sy*tile+sx,dx=(field[sy*tile+Math.min(tile-1,sx+1)]-field[sy*tile+Math.max(0,sx-1)])*tile*.5,dy=(field[Math.min(tile-1,sy+1)*tile+sx]-field[Math.max(0,sy-1)*tile+sx])*tile*.5,strength=kind<2?.0018:kind===3?.040:.042,nx=-dx*strength,ny=-dy*strength,len=Math.hypot(nx,ny,1),o=((Math.floor(kind/2)*tile+y)*size+(kind%2)*tile+x)*4;
    for(let c=0;c<3;c++)images[0].data[o+c]=Math.round(clamp(colour[i*3+c])*255);images[0].data[o+3]=255;images[1].data[o]=Math.round((nx/len*.5+.5)*255);images[1].data[o+1]=Math.round((ny/len*.5+.5)*255);images[1].data[o+2]=Math.round(rough[i]*255);images[1].data[o+3]=Math.round(ao[i]*255);
   }
  }
  const textures=canvases.map((c,i)=>{contexts[i].putImageData(images[i],0,0);const t=new THREE.CanvasTexture(c);t.flipY=false;t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.anisotropy=2;return t;});
  atlas={textures,canvases,creationMs:performance.now()-started,descriptor:{version:1,id:'chest-surface-atlas-v1',size,colour:{colorSpace:'sRGB'},packed:{colorSpace:'linear',channels:'normalX-normalY-roughness-occlusion'},woodRect:TDGeo.ATLAS2.uvr('wood'),means:means.flat()}};return atlas;
 }
 return{build(){const a=get();return{...a.descriptor,colour:{...a.descriptor.colour,png:a.canvases[0].toDataURL('image/png').split(',')[1]},packed:{...a.descriptor.packed,png:a.canvases[1].toDataURL('image/png').split(',')[1]}};}};
})();
