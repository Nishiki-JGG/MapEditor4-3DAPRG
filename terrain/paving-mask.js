// Derived display mask only. Red = original paving paint; green = one-cell search margin.
// Sampling a stone's centre keeps its silhouette intact at the edge of a painted area.
(() => {
'use strict';
function createMask(size){
  const texture=new THREE.DataTexture(new Uint8Array(size*size*4),size,size,THREE.RGBAFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
function updateMask(texture,paint,stride){
  const {data,width:n}=texture.image;let changed=false;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i,r=paint[k*stride+1];let margin=r;
    for(let y=Math.max(0,j-1);y<=Math.min(n-1,j+1);y++)for(let x=Math.max(0,i-1);x<=Math.min(n-1,i+1);x++)margin=Math.max(margin,paint[(y*n+x)*stride+1]);
    if(data[k*4]!==r||data[k*4+1]!==margin){data[k*4]=r;data[k*4+1]=margin;changed=true;}
  }
  if(changed)texture.needsUpdate=true;return changed;
}
window.TDPavingMask={createMask,updateMask};
})();
