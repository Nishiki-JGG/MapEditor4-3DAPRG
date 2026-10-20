// Bake editor-authored meshes once. Both engines consume the resulting arrays/PNG.
const fs=require('fs'),path=require('path');const {withPage}=require('../../tests/cdp');
const repo=path.resolve(__dirname,'../..'),out=path.resolve(repo,'../ground-texture-evidence');
(async()=>{
 const data=await withPage('file:///'+path.join(__dirname,'bake.html').replaceAll('\\','/'),async p=>p.eval(`(async()=>{
  const d=TDSharedData; d.assets=d.assets.filter(a=>['rock','fern'].includes(a.id));d.textures=d.textures.filter(t=>['rock-basecolor-v1','fern-basecolor-v1'].includes(t.id)); d.libraryVersion='shared-nature/1';
  const cv=document.createElement('canvas');cv.width=512;cv.height=1024;const c=cv.getContext('2d');
  const src=document.createElement('canvas');src.width=src.height=1024;src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(TDGeo.ATLAS.paint()),1024,1024),0,0);
  c.drawImage(src,512,0,512,512,0,0,512,512);c.drawImage(src,0,768,256,256,0,512,256,256);c.fillStyle='#fff';c.fillRect(256,512,256,512);
  // Padding below the needle region avoids black filtering fringes.
  d.textures.push({id:'forest-atlas-v1',width:512,height:1024,png:cv.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',wrap:'clamp',filter:'trilinear',mipmaps:true,anisotropy:2});
  const stats=[];
  for(const id of ['pine','log','stump','rootfan']){
   const t=recipes.find(t=>t.id===id),g=t.geo,P=Array.from(g.attributes.position.array),N=Array.from(g.attributes.normal.array),C=Array.from(g.attributes.color.array),U=[];
   const ys=P.filter((v,i)=>i%3===1),lo=Math.min(...ys);let upper=0,lowestBranch=Infinity;
   for(let i=0;i<P.length;i+=3){if(id==='stump')P[i+1]=Math.max(0,P[i+1]);else P[i+1]-=lo;P[i+2]=-P[i+2];N[i+2]=-N[i+2];upper=Math.max(upper,P[i+1]);}
   // Source atlas rows (top-down) -> the packed atlas, canonical UV bottom-up.
   for(let i=0;i<g.attributes.uv.count;i++){
    const x=g.attributes.uv.getX(i)*1024,y=g.attributes.uv.getY(i)*1024;
    if(x>=512&&y<512){U.push((x-512)/512,1-y/1024);lowestBranch=Math.min(lowestBranch,P[i*3+1]);}
    else if(x<256&&y>=768)U.push(x/512,1-(y-768+512)/1024);
    else U.push(.75,.125);
   }
   const a={id,assetKey:'tdj/'+id,version:1,pivot:[0,0,0],positions:P,normals:N,colors:C,uv:U,triangles:Array.from({length:P.length/3},(_,i)=>i-i%3+[0,2,1][i%3]),material:{texture:'forest-atlas-v1',baseColor:[1,1,1,1],lighting:'lambert',alphaCutoff:id==='pine'?.42:0,doubleSided:id==='pine'},groundContact:'ground pivot, minimum y=0',deformation:'none (static shared pilot)'};
   d.assets.push(a);stats.push({id,triangles:a.triangles.length/3,materials:1,height:upper,lowestBranch:Number.isFinite(lowestBranch)?lowestBranch:null,sourceMinY:lo});
  }
  const old=recipes.find(t=>t.id==='pine-before').geo;stats.push({id:'pine-before',triangles:old.attributes.position.count/3,materials:1,minY:Math.min(...Array.from(old.attributes.position.array).filter((v,i)=>i%3===1))});
  // Code-authored periodic grass fibres over the self-authored game's broad colour layer.
  const ground={...TDGroundSource},gc=document.createElement('canvas');gc.width=gc.height=512;const gg=gc.getContext('2d'),image=new Image();image.src='data:image/png;base64,'+ground.png;await image.decode();gg.drawImage(image,0,0);
  const R=TDGeo.rng(81327);gg.lineCap='round';
  for(let k=0;k<36000;k++){const x=R()*512,y=R()*512,L=2+R()*5,a=R()*Math.PI*2,bright=R()>.48;
   gg.strokeStyle=bright?'rgba(151,159,75,.22)':'rgba(32,57,23,.22)';gg.lineWidth=.5+R()*.7;
   for(const dx of [-512,0,512])for(const dy of [-512,0,512]){gg.beginPath();gg.moveTo(x+dx,y+dy);gg.quadraticCurveTo(x+dx+Math.cos(a+.3)*L*.5,y+dy+Math.sin(a+.3)*L*.5,x+dx+Math.cos(a)*L,y+dy+Math.sin(a)*L);gg.stroke();}
  }
  ground.imageBase64=gc.toDataURL('image/jpeg',.88).split(',')[1];ground.mime='image/jpeg';delete ground.png;ground.recipe='self-authored procedural base, Lanczos 1024 to 512; 36000 seeded periodic low-contrast fibres; tools/nature/bake.cjs';ground.sourceFile='field_grass_ground_albedo_procedural.png';ground.materialVersion=3;ground.secondWeight=.4;ground.rotationCS=[0.8660254037844386,.5];ground.secondOffset=[.37,.21];ground.decodeExponent=2.2;ground.macroWaves=[[.47,.29,.045],[-.21,.53,.025]];ground.waveA=ground.macroWaves[0];ground.waveB=ground.macroWaves[1];ground.projection='browser: (world.x,world.z); Unity: (world.x-editorZero.x,editorZero.y-world.z)';
  return{data:d,stats,ground};})()`),{wait:1500});
 fs.writeFileSync(path.join(repo,'props/shared/assets.js'),'// Authoritative shared data; see docs/TERRAIN_NATURE_BATCH.md.\nwindow.TDSharedData = '+JSON.stringify(data.data)+';\n');
 fs.writeFileSync(path.join(repo,'terrain/grass.js'),'// Local grass prototype. See docs/TERRAIN_NATURE_BATCH.md.\nwindow.TDGroundData = '+JSON.stringify(data.ground)+';\n');
 fs.writeFileSync(path.join(out,'nature-source-counts.json'),JSON.stringify(data.stats,null,2));console.log(data.stats);
})().catch(e=>{console.error(e);process.exit(1)});
