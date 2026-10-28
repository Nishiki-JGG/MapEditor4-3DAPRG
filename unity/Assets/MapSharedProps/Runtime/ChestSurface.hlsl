#ifndef MAP_CHEST_SURFACE_INCLUDED
#define MAP_CHEST_SURFACE_INCLUDED
TEXTURE2D(_ChestColour);SAMPLER(sampler_ChestColour);
TEXTURE2D(_ChestPacked);SAMPLER(sampler_ChestPacked);
float3 ChestSurfaceUV(float3 p,float3 n,float2 original,float glow){
 p.z=-p.z;n.z=-n.z;if(_ChestVariant<3.5)original.y=1-original.y;
 float kind=0,cell=2;float2 q=0;
 if(_ChestVariant<3.5){bool wood=all(original>=min(_ChestWoodRect.xy,_ChestWoodRect.zw)-.00001)&&all(original<=max(_ChestWoodRect.xy,_ChestWoodRect.zw)+.00001);if(wood){q=(original-_ChestWoodRect.xy)/(_ChestWoodRect.zw-_ChestWoodRect.xy);kind=1;cell=_ChestVariant<.5?1:0;}else{q=abs(n.x)>.65?float2((p.z+.36)/.72,p.y/.8):float2((p.x+.55)/1.1,p.y/.8);kind=2;cell=2;}}
 else{q=p.y>.433?float2((p.x+.55)/1.1,atan2(p.y-.435,-p.z)/3.14159265):abs(n.x)>.65?float2((p.z+.36)/.72,p.y/.43):float2((p.x+.55)/1.1,p.y/.43);kind=glow>.001||original.x< -3?0:2;cell=2;}
 if(_ChestVariant>2.5&&_ChestVariant<3.5&&p.y>.725&&abs(p.x)<.09&&abs(p.z)<.08)kind=0;return float3((float2(fmod(cell,2),floor(cell/2))+(8+clamp(q,0,1)*239)/256)*.5,kind);
}
float3 ChestOrnamentUV(float3 p,float mode,float glow){p.z=-p.z;if(mode<.5||glow>.001)return float3(.25,.75,0);bool etched=mode>2.5||(mode>.5&&mode<1.5);float2 q;if(p.y>.433){float angle=atan2(p.y-.435,-p.z)/3.14159265;q=etched?float2((p.x+.38)/.76,(min(angle,1-angle)-.04)/.30):float2((p.x+.55)/1.1,angle);}else if(abs(p.x)>.48)q=etched?float2((p.z+.28)/.56,(p.y-.09)/.31):float2((p.z+.36)/.72,p.y/.43);else q=etched?float2((p.x+.38)/.76,(p.y-.09)/.31):float2((p.x+.55)/1.1,p.y/.43);float cell=etched?3:2;return float3((float2(fmod(cell,2),floor(cell/2))+(8+clamp(q,0,1)*239)/256)*.5,mode+2);}
// Match the Web Gothic coordinates after the source Z flip. Keep raw UV derivatives continuous across panel borders.
float3 ChestSurfaceSampleUV(float3 surface,float3 local){if(_ChestVariant<3.5||surface.z>2.5)return surface;float3 p=local;p.z=-p.z;float2 q;float ellipse=(p.y-.435)*(p.y-.435)/(.274*.274)+p.z*p.z/(.337*.337);if(p.y>.09&&p.y<.40&&abs(p.x)>.48&&abs(p.z)<.28)q=float2((p.z+.28)/.56,(p.y-.09)/.31);else if(abs(p.x)<.38&&p.y>.47&&p.y<.718&&ellipse>.94&&ellipse<1.04){float theta=((surface.y*2-1)*256-8)/239;q=float2((p.x+.38)/.76,(min(theta,1-theta)-.04)/.30);}else return surface;surface.xy=(1+(8+clamp(q,0,1)*239)/256)*.5;return surface;}
float ChestPattern(float3 local){float3 p=local;p.z=-p.z;if(_ChestVariant<3.5)return 0;float e=(p.y-.435)*(p.y-.435)/(.274*.274)+p.z*p.z/(.337*.337);float side=smoothstep(.09,.105,p.y)*(1-smoothstep(.385,.40,p.y))*smoothstep(.48,.49,abs(p.x))*(1-smoothstep(.265,.28,abs(p.z)));float lid=(1-smoothstep(.36,.38,abs(p.x)))*smoothstep(.47,.49,p.y)*(1-smoothstep(.70,.718,p.y))*smoothstep(.94,.98,e)*(1-smoothstep(1.015,1.04,e));return max(side,lid);}
float4 ChestMean(float3 surface){int cell=clamp((int)(floor(surface.x*2)+2*floor(surface.y*2)),0,3);float4 value=cell==0?_ChestMean0:cell==1?_ChestMean1:cell==2?_ChestMean2:_ChestMean3;
#if defined(UNITY_COLORSPACE_GAMMA)
 value.rgb=LinearToSRGB(value.rgb);
#endif
 return value;}
float ChestWidth(float3 surface,float3 raw){return max(fwidth(raw.x),fwidth(raw.y))*(_ChestVariant>3.5&&surface.x>.5?2.2:1);}
float ChestFade(float3 surface,float3 raw){return 1-smoothstep(.012,.03,ChestWidth(surface,raw));}
float4 ChestPackedRaw(float3 surface,float3 raw,float3 local){float4 packed=SAMPLE_TEXTURE2D(_ChestPacked,sampler_ChestPacked,float2(surface.x,1-surface.y));float fade=ChestFade(surface,raw);packed.b=lerp(ChestMean(surface).a,packed.b,fade);packed.xy=lerp(.5,packed.xy,fade);packed.a=lerp(1,packed.a,fade);if(_ChestVariant<3.5||surface.z>2.5)return packed;float4 plain=SAMPLE_TEXTURE2D(_ChestPacked,sampler_ChestPacked,float2(raw.x,1-raw.y));float rawFade=ChestFade(raw,raw);plain.b=lerp(ChestMean(raw).a,plain.b,rawFade);plain.xy=lerp(.5,plain.xy,rawFade);plain.a=lerp(1,plain.a,rawFade);return lerp(plain,packed,ChestPattern(local));}
float4 ChestApplyPacked(float4 a,float3 surface,float3 local){if(_ChestVariant<3.5||surface.z<.5)return a;float3 p=local;p.z=-p.z;float front=smoothstep(.30,.335,p.z),lock=1-smoothstep(.045,.13,length(float2(p.x,(p.y-.32)*1.3))),handle=1-smoothstep(.035,.085,length(float2(abs(p.x)-.46,p.y-.27))),touch=front*max(lock,handle*.75),role=surface.z;float alloy=_ChestVariant<4.5?-.09:_ChestVariant<5.5?.015:-.045;
 if(role>4.5){a.b=clamp(.61+(a.b-.5)*.45+alloy,.48,.84);a.xy=lerp(.5,a.xy,.75);}
 else if(role>3.5){a.b=clamp(.31+(a.b-.5)*.22+alloy*.4-touch*.16,.12,.43);a.xy=lerp(.5,a.xy,.22);}
 else if(role>2.5){a.b=clamp(.48+(a.b-.5)*.50+alloy-touch*.10,.28,.76);a.xy=lerp(.5,a.xy,.65);}
 else {float band=(1-smoothstep(.020,.030,abs(abs(p.x)-.40)))*step(.43,p.y);a.b=clamp(a.b+alloy-touch*.12-band*.14,.16,.78);}return a;}
float4 ChestPacked(float3 surface,float3 raw,float3 local){return ChestApplyPacked(ChestPackedRaw(surface,raw,local),surface,local);}
float3 ChestColour(float3 surface,float3 raw,float3 local){float width=ChestWidth(surface,raw),fade=_ChestVariant>3.5&&surface.x>.5?1-smoothstep(.028,.045,width):ChestFade(surface,raw);float3 patterned=lerp(ChestMean(surface).rgb,SAMPLE_TEXTURE2D(_ChestColour,sampler_ChestColour,float2(surface.x,1-surface.y)).rgb,fade);if(_ChestVariant<3.5||surface.z>2.5)return patterned;float3 plain=lerp(ChestMean(raw).rgb,SAMPLE_TEXTURE2D(_ChestColour,sampler_ChestColour,float2(raw.x,1-raw.y)).rgb,ChestFade(raw,raw));return lerp(plain,patterned,ChestPattern(local));}
float3 ChestDetailNormal(float3 n,float3 p,float2 uv,float2 tilt){float3 dx=ddx(p),dy=ddy(p);float2 ux=ddx(uv),uy=ddy(uv);float3 tangent=dx*uy.y-dy*ux.y,bitangent=dy*ux.x-dx*uy.x;float det=ux.x*uy.y-ux.y*uy.x,scale=rsqrt(max(max(dot(tangent,tangent),dot(bitangent,bitangent)),1e-12));return normalize(n+(tangent*tilt.x+bitangent*tilt.y)*scale*sign(det));}

#if defined(CHEST_GOLD_ATLAS) || defined(CHEST_PART_ATLAS)
float ChestGoldFace(float3 p,float3 n){p.z=-p.z;return abs(p.x)>.48&&abs(n.x)>.65?(p.x<0?2:3):p.y>.433?4:p.z>=0?0:1;}
float2 ChestGoldUV(float3 p,float face){p.z=-p.z;float2 q;float4 r;
 if(face<.5){q=float2((p.x+.55)/1.1,p.y/.433);r=float4(0,0,256,192);}
 else if(face<1.5){q=float2((-p.x+.55)/1.1,p.y/.433);r=float4(256,0,256,192);}
 else if(face<2.5){q=float2((p.z+.36)/.72,p.y/.8);r=float4(0,192,256,128);}
 else if(face<3.5){q=float2((-p.z+.36)/.72,p.y/.8);r=float4(256,192,256,128);}
 else{q=float2((p.x+.55)/1.1,atan2(p.y-.435,-p.z)/3.14159265);r=float4(0,320,512,192);}
 return(r.xy+4+clamp(q,0,1)*(r.zw-9)+.5)/512;
}
float4 ChestGoldMean(float face){float4 value=face<.5?_ChestGoldMean0:face<1.5?_ChestGoldMean1:face<2.5?_ChestGoldMean2:face<3.5?_ChestGoldMean3:_ChestGoldMean4;
#if defined(UNITY_COLORSPACE_GAMMA)
 value.rgb=LinearToSRGB(value.rgb);
#endif
 return value;}
float ChestGoldFade(float2 uv){return 1-smoothstep(.012,.03,max(fwidth(uv.x),fwidth(uv.y)));}
float4 ChestGoldRaw(float2 uv,float face){float4 a=SAMPLE_TEXTURE2D(_ChestPacked,sampler_ChestPacked,float2(uv.x,1-uv.y));float fade=ChestGoldFade(uv);a.b=lerp(ChestGoldMean(face).a,a.b,fade);a.xy=lerp(.5,a.xy,fade);a.a=1;return a;}
float3 ChestGoldColour(float2 uv,float face){return lerp(ChestGoldMean(face).rgb,SAMPLE_TEXTURE2D(_ChestColour,sampler_ChestColour,float2(uv.x,1-uv.y)).rgb,ChestGoldFade(uv));}
float ChestGoldKeyhole(float3 p){p.z=-p.z;return step(.3867,p.z)*(1-step(.006,abs(p.x)))*(1-step(.014,abs(p.y-.321)));}
#endif
#endif
