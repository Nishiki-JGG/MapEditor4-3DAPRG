// 自作の洞窟床。ワールドメートル固定。色はgamma値、呼出側で一度だけdecodeする。
float caveHash(vec2 p) {
  // 2^24未満の整数演算でhashを作り、GLSL/HLSLの積和精度差を増幅しない。
  vec2 q=p-floor(p/4096.)*4096.;
  float n=q.x*173.+q.y*927.+19.;n-=floor(n/4096.)*4096.;
  float k=n-floor(n/31.)*31.+7.;n*=k;n-=floor(n/4096.)*4096.;
  return n/4096.;
}
float caveNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(caveHash(i),caveHash(i+vec2(1.,0.)),f.x),mix(caveHash(i+vec2(0.,1.)),caveHash(i+vec2(1.,1.)),f.x),f.y);
}
struct CaveFloorSample {vec3 albedo;float relief;float wet;};
CaveFloorSample sampleCaveFloor(vec2 p,float wetAmount) {
  float macro=caveNoise(p*.29+vec2(12.7,4.3));
  float sediment=caveNoise(p*1.8+vec2(5.1,7.3));
  float fine=caveNoise(p*24.);
  float bedrock=smoothstep(.18,.86,sediment+(macro-.5)*.16);
  vec3 silt=mix(vec3(.43,.415,.38),vec3(.53,.51,.465),.25+.5*macro);
  vec3 rock=mix(vec3(.48,.47,.43),vec3(.59,.575,.525),.25+.5*macro);
  vec3 color=mix(silt,rock,bedrock)*(.95+.10*fine);
  // 数cmの埋もれた粒。セル端には置かず、反復する格子や大きな閉じた割れ目を作らない。
  vec2 cell=floor(p*6.),f=fract(p*6.);
  float seed=caveHash(cell+vec2(71.,31.));
  vec2 center=vec2(.26,.26)+.48*vec2(caveHash(cell+7.),caveHash(cell+19.));
  float r=length((f-center)*vec2(1.,1.25));
  float radius=.06+.05*caveHash(cell+53.);
  float aa=max(fwidth(r),.012);
  float pebble=(1.-smoothstep(radius-aa,radius+aa,r))*step(.52,seed);
  color=mix(color,mix(vec3(.41,.40,.36),vec3(.64,.62,.56),seed),pebble*.48);
  float wet=clamp(wetAmount,0.,1.)*smoothstep(.30,.68,macro*.45+sediment*.55);
  CaveFloorSample result;
  result.albedo=color*(1.-.24*wet);
  result.relief=(fine-.5)*.0007+pebble*.0018+bedrock*.001;
  result.wet=wet;
  return result;
}
