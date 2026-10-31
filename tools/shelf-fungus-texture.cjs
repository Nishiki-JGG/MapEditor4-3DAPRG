// Original procedural bracket-fungus colour atlas, no image input or external dependencies.
const zlib=require('zlib'),fs=require('fs');const size=128,rgba=Buffer.alloc(size*size*4);
function clamp(x){return Math.max(0,Math.min(255,Math.round(x)));}function mix(a,b,t){return a.map((v,i)=>v*(1-t)+b[i]*t)}
function smooth(a,b,x){let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)}
function noise(x,y){return Math.sin(x*1.713+y*2.931)*Math.sin(x*.813-y*1.337)}
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 let c;
 if(y<96){let u=(x-64)/59,v=(91-y)/81,r=Math.hypot(u,v),angle=Math.atan2(v,u),warp=r+.045*Math.sin(angle*3+r*4)+.016*Math.sin(angle*7-r*7);
  // Broad unequal growth zones; subdued interruptions and a narrow pale growing margin.
  let ageing=smooth(-.25,.7,Math.sin(x*.083+y*.057)*Math.sin(y*.071-x*.035)),bands=(7*Math.sin(warp*19+.4)+4*Math.sin(warp*34-1.2))*(1-.7*ageing),cloud=11*Math.sin(x*.079+y*.051)*Math.sin(y*.089-x*.027),fibre=2.3*Math.sin(angle*86+r*5),grain=noise(x,y)*3;
  c=[134+bands+cloud+fibre+grain,108+bands*.82+cloud+grain,80+bands*.58+cloud*.7+grain];
  c=mix(c,[191+grain,178+grain,148+grain],smooth(.91+.025*Math.sin(angle*5),.985,warp)*(1-.7*ageing));
  // The oldest attached base is cooler and less saturated, not a cast shadow.
  c=mix(c,[100+cloud,88+cloud,69+cloud],(1-smooth(.04,.29,r))*.35);
 }else{let n=noise(x,y),patch=3*Math.sin(x*.11+y*.17),ageing=smooth(.1,.85,Math.sin(x*.081+.6))*(1-smooth(106,120,y));c=[181+patch+n*4-49*ageing,171+patch+n*4-51*ageing,145+patch+n*4-40*ageing];}
 const i=(y*size+x)*4;rgba[i]=clamp(c[0]);rgba[i+1]=clamp(c[1]);rgba[i+2]=clamp(c[2]);rgba[i+3]=255;
}
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});function crc(b){let c=0xffffffff;for(const n of b)c=table[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(name,data){let b=Buffer.concat([Buffer.from(name),data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);b.copy(out,4);out.writeUInt32BE(crc(b),out.length-4);return out;}
const head=Buffer.alloc(13);head.writeUInt32BE(size);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;
const scan=Buffer.alloc(size*(1+size*4));for(let y=0;y<size;y++)rgba.copy(scan,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(process.argv[2],png);console.log(JSON.stringify({size,bytes:png.length,originalProcedural:true}));
