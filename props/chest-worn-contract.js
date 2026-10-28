// Optional material/UV extension. Old readers use the unchanged legacy mesh fields.
(function(root){'use strict';
 function check(v,m){if(!v)throw Error('Worn atlas: '+m);}
 function validate(d,vertices){check(d&&d.version===1&&d.id==='worn-board-atlas-v1'&&d.assetKey==='tdj/treasurechest_worn'&&d.size===512&&d.uvOrigin==='top-left','identity');
 for(const [name,space,channels]of [['colour','sRGB','RGB-intrinsic-colour'],['roughness','linear','roughnessR']]){
 const im=d[name];check(im&&im.colorSpace===space&&im.channels===channels&&typeof im.png==='string'&&im.png.length>32&&im.png.length<2000000,'image contract');
 const b=Uint8Array.from(atob(im.png),x=>x.charCodeAt(0)),v=new DataView(b.buffer);
 check(b.length>33&&[137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x)&&v.getUint32(8)===13&&v.getUint32(12)===0x49484452&&v.getUint32(16)===512&&v.getUint32(20)===512&&b[24]===8&&b[25]===6,'PNG');
 }if(vertices!==undefined)check(Number.isInteger(vertices)&&vertices>0&&vertices<60000&&d.vertices===vertices&&Array.isArray(d.uv)&&d.uv.length===vertices*2&&d.uv.every(x=>Number.isFinite(x)&&x>=0&&x<=1),'UV binding');const m=d.mesh;if(vertices!==undefined)check(m&&['positions','normals','colors'].every(k=>Array.isArray(m[k])&&m[k].length===vertices*3&&m[k].every(Number.isFinite))&&m.positions.every(x=>Math.abs(x)<=2)&&m.colors.every(x=>x>=0&&x<=1)&&Array.isArray(m.triangles)&&m.triangles.length>0&&m.triangles.length%3===0&&m.triangles.length<180000&&m.triangles.every(x=>Number.isInteger(x)&&x>=0&&x<vertices),'visual mesh');return d;}
 const api={validate};root.TDChestWornContract=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
