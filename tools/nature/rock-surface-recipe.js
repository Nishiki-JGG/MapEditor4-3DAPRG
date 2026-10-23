// 既存の岩の位置・UV・面を維持し、面ごとの暗い塗り分けを連続した石肌に置き換える。
(()=>{
 const a=TDSharedData.assets.find(a=>a.id==='rock');
 const clamp=(x,l=0,h=1)=>Math.max(l,Math.min(h,x)),smooth=x=>x*x*(3-2*x);
 const hash=(x,y,z=0)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7+34.1)*43758.5453;return s-Math.floor(s);};
 function noise(x,y,z=0,period=0){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz),at=(i,j,k)=>hash(period?(i%period+period)%period:i,period?(j%period+period)%period:j,k),mix=(a,b,t)=>a+(b-a)*t;return mix(mix(mix(at(ix,iy,iz),at(ix+1,iy,iz),u),mix(at(ix,iy+1,iz),at(ix+1,iy+1,iz),u),v),mix(mix(at(ix,iy,iz+1),at(ix+1,iy,iz+1),u),mix(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),u),v),w);}
 // 位置が同じ頂点を照合し、緩い面同士だけ法線を平均する。大きな割れ面の稜線は保つ。
 const groups=new Map(),keys=[];for(let i=0;i<a.positions.length;i+=3){const k=a.positions.slice(i,i+3).map(x=>x.toFixed(5)).join('/');keys.push(k);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 const original=a.normals.slice();for(let i=0;i<a.normals.length;i+=3){const n=original.slice(i,i+3),sum=[0,0,0];for(const j of groups.get(keys[i/3]))if(n.reduce((s,x,k)=>s+x*original[j+k],0)>.62)for(let k=0;k<3;k++)sum[k]+=original[j+k];const L=Math.hypot(...sum)||1;for(let k=0;k<3;k++)a.normals[i+k]=sum[k]/L;}
 const linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
 for(let i=0;i<a.positions.length;i+=3){const[x,y,z]=a.positions.slice(i,i+3),up=a.normals[i+1],broad=noise(x*2.6+7,y*2.6,z*2.6-3),speck=noise(x*8,y*8,z*8),base=.63+(broad-.5)*.12+(speck-.5)*.025,foot=.82+.18*smooth(clamp(y/.32));let rgb=[base*1.025,base*1.012,base*.955];const lichen=smooth(clamp((broad-.62)/.24))*smooth(clamp((up-.35)/.55))*.30;rgb=rgb.map((v,k)=>(v*(1-lichen)+[.52,.56,.37][k]*lichen)*foot);for(let k=0;k<3;k++)a.colors[i+k]=linear(rgb[k]);}
 // 周期ノイズの鉱物粒、薄い層理、途切れる細い割れ目。UVを変えず、滑らかな三角形間の色も保つ。
 const size=512,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),im=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n1=noise(u*4,v*4,0,4),n2=noise(u*16,v*16,2,16),n3=noise(u*64,v*64,4,64),fine=hash(x,y),warp=noise(u*8,v*8,1,8)-.5;
  const vein=Math.abs(Math.sin((u*3+v*2+warp*.20)*Math.PI));const split=Math.exp(-((vein/.028)**2))*smooth(clamp((n2-.30)/.32));
  const grain=(n3-.5)*.105+(fine-.5)*.07,layer=Math.sin((u+v*7+warp*.55)*Math.PI*2)*.016;
  const value=clamp(.84+(n1-.5)*.15+(n2-.5)*.09+grain+layer-split*.12,.58,.98),p=(y*size+x)*4;
  im.data[p]=Math.round(value*255);im.data[p+1]=Math.round(value*.99*255);im.data[p+2]=Math.round(value*.965*255);im.data[p+3]=255;
 }ctx.putImageData(im,0,0);
 const id='placed-rock-mineral-v3';TDSharedData.textures.push({id,width:size,height:size,png:c.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',wrap:'repeat',filter:'trilinear',mipmaps:true,anisotropy:4,appearanceVersion:3});
 a.material={...a.material,texture:id};a.version=5;a.appearance='灰褐色の鉱物粒、薄い層理、細い割れ目、上向き面の控えめな地衣。形状・配置・接地は既存のまま。';
})();
