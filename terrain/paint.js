// Coverage is conserved while painting: a material replaces existing layers, not the base underneath.
(function(root){
 function paint(data,offset,count,channel,amount){
  const alpha=Math.max(0,Math.min(1,amount));if(!alpha)return;
  let sum=0;for(let c=0;c<count;c++)sum+=data[offset+c];
  const normalization=Math.max(255,sum),target=Math.round(Math.min(255,sum)*(1-alpha)+(channel>=0?255*alpha:0));
  let rounded=0,biggest=0,bigValue=-1;
  for(let c=0;c<count;c++){const v=data[offset+c]*255/normalization*(1-alpha)+(c===channel?255*alpha:0);data[offset+c]=Math.round(v);rounded+=data[offset+c];if(v>bigValue){biggest=c;bigValue=v;}}
  data[offset+biggest]=Math.max(0,Math.min(255,data[offset+biggest]+target-rounded));
 }
 const api={paint};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDTerrainPaint=api;
})(typeof window!=='undefined'?window:globalThis);
