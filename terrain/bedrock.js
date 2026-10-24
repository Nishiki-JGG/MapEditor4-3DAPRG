// Original packed albedo / shallow relief; no reference-image pixels.
(() => {
const texture=new THREE.TextureLoader().load(TDBedrockData);
texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
window.TDBedrock={texture,uniforms:{uBedrock:{value:texture}},GLSL:`
uniform sampler2D uBedrock;
vec4 bedrockSurface(vec2 p){
 // Fade each source edge to zero before it wraps. Half-tile offsets cover
 // those edges, so a generated image cannot introduce a visible square seam.
 // Slow continuous domain warp also breaks the exact four-metre repetition.
 vec2 uv=p/4.+.28*vec2(groundNoise(p*.11+19.),groundNoise(p*.11+37.));
 vec2 f=fract(uv),w=sin(f*3.14159265);w*=w;
 vec4 a=texture2D(uBedrock,uv);
 vec4 b=texture2D(uBedrock,uv+vec2(.5,0.));
 vec4 c=texture2D(uBedrock,uv+vec2(0.,.5));
 vec4 d=texture2D(uBedrock,uv+vec2(.5,.5));
 return mix(mix(d,c,w.x),mix(b,a,w.x),w.y);
}`};
})();
