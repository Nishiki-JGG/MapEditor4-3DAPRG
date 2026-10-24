// Original packed albedo / shallow relief; no reference-image pixels.
(() => {
const texture=new THREE.TextureLoader().load(TDBedrockData);
texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
window.TDBedrock={texture,uniforms:{uBedrock:{value:texture}},GLSL:`
uniform sampler2D uBedrock;
// Each lattice corner owns one interior patch. Shared corner weights give
// continuous borders; restrained rotations and offsets remove the source's repeated
// diagonal rows without wrapping its non-seamless outer edges. Four fetches.
vec2 bedrockTurn(vec2 q,float turn){
 return mat2(1.,turn,-turn,1.)*q*inversesqrt(1.+turn*turn);
}
vec4 bedrockPatch(vec2 cell,vec2 q,vec2 dx,vec2 dy){
 vec3 h=fract(cell.xyx*vec3(.1031,.1030,.0973));
 h+=dot(h,h.yxz+33.33);h=fract((h.xxy+h.yxx)*h.zyx);
 float turn=(h.z-.5)*.8;
 vec2 r=bedrockTurn(q,turn);
 vec2 uv=.5+r*.28+(h.xy-.5)*.26;
 #ifdef texture2DGradEXT
 // Explicit continuous gradients prevent one-pixel mip seams at cell borders.
 return texture2DGradEXT(uBedrock,uv,bedrockTurn(dx,turn)*.392,bedrockTurn(dy,turn)*.392);
 #else
 // WebGL 1 fallback, where this renderer does not expose explicit gradients.
 return texture2D(uBedrock,uv);
 #endif
}
vec4 bedrockSurface(vec2 p){
 vec2 uv=p/1.8,cell=floor(uv),f=fract(uv),w=f*f*(3.-2.*f),dx=dFdx(uv),dy=dFdy(uv);
 w=w*w/(w*w+(1.-w)*(1.-w));
 vec4 a=bedrockPatch(cell,f,dx,dy);
 vec4 b=bedrockPatch(cell+vec2(1.,0.),f-vec2(1.,0.),dx,dy);
 vec4 c=bedrockPatch(cell+vec2(0.,1.),f-vec2(0.,1.),dx,dy);
 vec4 d=bedrockPatch(cell+vec2(1.,1.),f-vec2(1.,1.),dx,dy);
 vec4 bed=mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
 bed.rgb=mix(vec3(.43,.45,.47),bed.rgb*vec3(.94,1.,1.09),.92);
 return bed;
}`};
})();
