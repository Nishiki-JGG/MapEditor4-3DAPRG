// Sea surf, written once and used by the editor (WebGL GLSL) and by Unity (HLSL).
//   editor: app.js puts GLSL_PRELUDE + COMMON in the water's vertex shader and GLSL_PRELUDE + COMMON + SHADE in its fragment shader
//   Unity : node tools/sea/build-sea-hlsl.cjs writes unity/Assets/MapWater/Runtime/Shaders/MapSeaShared.hlsl (HLSL_PRELUDE + COMMON + SHADE);
//           tests/sea_hlsl_sync.cjs fails when that file is out of date
// The shader code is in a dialect both languages read: float2/3/4, frac, lerp, atan2 (no saturate: three.js defines its own); constructors always get every
// component (HLSL has no float3(0.)); seaMod instead of mod (GLSL mod and HLSL fmod differ below zero); constants are #defines.
// It reads these globals: seaTime, seaWaveH (both stages); seaSun, seaShallow, seaDeep, seaView (fragment). Positions are in the
// editor's frame (x right, z toward the viewer of the top view, origin at the map centre); Unity converts before calling.
(() => {
'use strict';
const WAVELENGTH = 7.5, PERIOD = 4.4, STEEPEN_DEPTH = 3.2, BREAK_DEPTH = [.75, 1.5], RUNUP_GAIN = 1.2, RUNUP_REACH = 1.4;

const COMMON = `
#define SEA_TAU 6.2831853
#define SEA_WK (SEA_TAU/${WAVELENGTH.toFixed(4)})
#define SEA_WW (SEA_TAU/${PERIOD.toFixed(4)})
#define SEA_DRIFT 4.
float2 seaMod(float2 x, float y){ return x-y*floor(x/y); }
// value noise and Voronoi (same as the editor's GLSL_NOISE, own names)
float seaH21(float2 p){ p=frac(p*float2(123.34,456.21)); p+=dot(p,p+45.32); return frac(p.x*p.y); }
float seaVn(float2 p){ float2 i=floor(p), f=frac(p); f=f*f*(3.-2.*f);
  return lerp(lerp(seaH21(i),seaH21(i+float2(1.,0.)),f.x), lerp(seaH21(i+float2(0.,1.)),seaH21(i+float2(1.,1.)),f.x), f.y); }
float seaFbm(float2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*seaVn(p); p=p*2.03+17.1; a*=.5; } return s; }
float3 seaVor(float2 p){ float2 i=floor(p), f=frac(p); float d1=8., d2=8., id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ float2 g=float2(float(x),float(y)); float2 c=i+g;
    float2 o=float2(seaH21(c),seaH21(c+37.7)); float d=length(g+o-f);
    if(d<d1){ d2=d1; d1=d; id=seaH21(c+11.3); } else if(d<d2){ d2=d; } }
  return float3(d1,d2,id); }
// u: 0 at the crest, rising to 1 just in front of the next crest; 0..1. st: 0 = rounded swell, 1 = steep breaking front
float seaCrest(float u, float st){
  float sym=.5+.5*cos(SEA_TAU*u), saw=u<.86?exp(-u*3.6):lerp(exp(-.86*3.6),1.,smoothstep(.86,1.,u));
  return lerp(sym,saw,st);
}
// Height of the sea above its still level at p (m). s = distance to the still waterline (m, + at sea), d = still depth (m).
// riv = (o, j): o = how far the crests are from where the shoreline alone would put them (m): the crests follow the coast
// smoothed over about a wavelength, with river mouths closed (waves refract on the large-scale bed, not on every inlet);
// j = 0..1, the river's outflow jet in front of a mouth: the waves steepen and break against it and are stopped inside it.
// Crests roll in toward the shore (each with its own height, bent a little along it), grow and steepen below ${STEEPEN_DEPTH} m,
// break (brk) between ${BREAK_DEPTH[1]} and ${BREAK_DEPTH[0]} m and run on as a lower bore; past the waterline the bore runs up the
// sand, lagging as it climbs, spent within a few metres, and slides back. ph = wave phase.
float seaH(float2 p, float s, float d, float2 riv, out float ph, out float brk){
  float bend=(seaFbm(p*.03)-.5)*5.;
  ph=SEA_WK*(max(s,0.)+riv.x)+SEA_WW*seaTime+bend;
  // Blend each wave's envelope between crests. At u=1 it equals the next
  // cycle at u=0; changing the random amplitude abruptly there tore strong waves.
  float u=frac(ph/SEA_TAU), ci=floor(ph/SEA_TAU), blend=smoothstep(.2,.8,u);
  float crest=.62+.38*lerp(frac(sin(ci*12.9898)*43758.5453),frac(sin((ci+1.)*12.9898)*43758.5453),blend);
  float along=.7+.6*lerp(seaFbm(p*.06+float2(ci*1.7,ci*.9)),seaFbm(p*.06+float2((ci+1.)*1.7,(ci+1.)*.9)),blend);
  // against the river's jet: steep and breaking at its front, stopped inside it (no waves run up the river)
  float stop=smoothstep(.5,.9,riv.y), front=smoothstep(.05,.3,riv.y)*(1.-stop);
  float st=max(smoothstep(${STEEPEN_DEPTH.toFixed(2)},1.,d),front); brk=max(smoothstep(${BREAK_DEPTH[1].toFixed(2)},${BREAK_DEPTH[0].toFixed(2)},d),front*.85)*step(0.,s);
  float A=seaWaveH*crest*along*(1.+.8*smoothstep(4.5,1.2,d))*lerp(1.,.5,smoothstep(1.,0.,d))*lerp(1.,.5,smoothstep(14.,40.,s))*(1.+.3*front)*(1.-.9*stop);
  float hw=(seaCrest(u,st)-.3)*A;
  float phl=SEA_WK*riv.x+SEA_WW*seaTime+bend-SEA_WK*1.8*max(-s,0.), ul=frac(phl/SEA_TAU), cl=floor(phl/SEA_TAU);
  float hl=seaWaveH*(.75+.45*lerp(frac(sin(cl*12.9898)*43758.5453),frac(sin((cl+1.)*12.9898)*43758.5453),smoothstep(.2,.8,ul)))*seaCrest(ul,1.)*exp(-max(-s,0.)/${RUNUP_REACH.toFixed(2)})*(1.-stop)-.05;
  return lerp(hl,hw,smoothstep(0.,1.6,s));
}
// the sea surface at p: returns its slope; h = height above the still level, ph = phase, brk = breaking. Used per vertex
// (to move the mesh) and again per pixel (so crests, shading, foam and the water's edge are smooth curves, not 0.5 m facets).
// d0 = still depth, dir = toward the shore (across the crests), riv = (o, j) as seaH
float2 seaWave(float2 p, float s, float d0, float2 dir, float2 riv, out float h, out float ph, out float brk){
  float ph2, b2, dd=max(d0,0.);
  float lace=(seaFbm(p*2.7+float2(seaTime*.21,-seaTime*.17))-.5)*.035*(1.-smoothstep(.3,2.,abs(s)));   // near the waterline only
  float chop=(seaFbm(p*1.9+float2(seaTime*.5,-seaTime*.4))-.5)*.10*smoothstep(.15,.6,riv.y)*seaWaveH;   // short, confused chop where the river runs out into the sea
  h=seaH(p,s,dd,riv,ph,brk)+lace+chop;
  float h2=seaH(p,s+.3,dd,riv,ph2,b2)+lace+chop;
  // A trough cannot cut through the submerged bed. Preserve the offshore wave height,
  // but leave a thin water layer in shallows (the same bound for geometry and normals).
  // Dry sand uses the separate run-up handling in the surface shader.
  if(d0>0.){ h=max(h,-d0*.9); h2=max(h2,-d0*.9); }
  return -dir*(h2-h)/.3;   // s grows away from the shore, so the slope points back out to sea
}
`;

const SHADE = `
// tileable water caustics (two drifting layers so the tile does not show)
float seaCausticL(float2 uv, float time){
  float2 p=seaMod(uv*SEA_TAU,SEA_TAU)-250.; float2 i=p; float c=1., inten=.005;
  for(int n=0;n<4;n++){ float t=time*(1.-(3.5/float(n+1))); i=p+float2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x)); c+=1./length(float2(p.x/(sin(i.x+t)/inten),p.y/(cos(i.y+t)/inten))); }
  c/=4.; c=1.17-pow(c,1.4); return clamp(pow(abs(c),8.),0.,1.);
}
float seaCaustic(float2 p, float t){
  float2 w=float2(seaFbm(p*.11+t*.03),seaFbm(p*.11-t*.025+5.))*2.4;
  return seaCausticL(p*.30+w*.05,t*.55)*.6+seaCausticL(p*.47-w*.04+.37,t*.42+1.7)*.45;
}
// sand the run-up has just left: darker, with a thin sheen right behind the water's edge. d = depth now, d0 = still depth.
// The sand the waves keep soaked (up to the run-up's reach) is darkened here only where SEA_SOAKED is 1 (Unity); the editor's
// terrain darkens it itself, smoothly across the still waterline, so the sheet adds nothing there (no seam where the sea's
// weight ends, and nothing to flicker against the sand on phones, whose depth buffer cannot hold the sheet 2 cm above it)
float4 wetSand(float2 p, float d, float d0, float4 sea){
  float e=-d0, run=sea.w*${RUNUP_GAIN.toFixed(2)};
  float soaked=smoothstep(run+.05,run*.25,e)*SEA_SOAKED, fresh=smoothstep(.25,0.,-d)*smoothstep(0.,.06,-d);   // darkest a little behind the edge, rising gently from the water's edge
  float wet=clamp(max(soaked*.6,fresh*.8),0.,1.);
  float sp=pow(max(dot(reflect(-seaSun,float3(0.,1.,0.)),seaView),0.),60.)*fresh;
  return float4(float3(.04,.06,.07)+sp*.8, (wet*.24+sp*.3)*smoothstep(0.,.3,sea.x));   // gone before the sea's weight ends (no slivers where the sheet dips under the sand)
}
// the foam's lace at q: warped, two sizes of holes (an irregular lace, not a dot grid)
float seaFoamPat(float2 q, float tt){
  float2 qw=q+(float2(seaFbm(q*.6),seaFbm(q*.6+9.))-.5)*1.6;
  float holes=smoothstep(.06,.42,seaVor(qw*1.3).x)*.55+smoothstep(.08,.45,seaVor(qw*3.2+7.).x)*.45;
  return holes*.7+seaFbm(q*2.6+tt*.1)*.42;
}
// colour and opacity of the sea at p. sea = (sea weight, breaking, distance to the still waterline, wave height);
// ph = (cos, sin) of the wave phase; grad = slope of the wave surface; dir = toward the shore; riv = (o, j) as seaH
float4 seaColor(float2 p, float d, float d0, float4 sea, float2 ph, float2 grad, float2 dir, float2 riv){
  float t=1.-exp(-d*.55), brk=sea.y;
  float3 col=lerp(lerp(seaShallow,float3(.10,.78,.80),.35),seaDeep,t);   // clear tropical water: emerald over the sand, deep blue further out
  // the river's water fanning out from its mouth: greener and cloudier, in uneven tongues
  float plume=riv.y*smoothstep(.25,.6,riv.y+(seaFbm(p*.35-dir*seaTime*.05)-.5)*.5);
  col=lerp(col,float3(.32,.44,.34),plume*.7);
  // dark beds of sea grass and rock on the floor between the shallows and the deep (seen through the water)
  float bed=smoothstep(.56,.7,seaFbm(p*.11+3.7)+seaFbm(p*.5)*.25)*smoothstep(.5,1.4,d)*(1.-smoothstep(3.5,7.,d));
  col=lerp(col,float3(.03,.22,.20),bed*.75);
  // surface: the wave's own slope plus two scales of ripples
  float tt=seaTime;
  float2 r1=float2(seaFbm(p*1.7+tt*.35+float2(.13,0.))-seaFbm(p*1.7+tt*.35-float2(.13,0.)),seaFbm(p*1.7+tt*.35+float2(0.,.13))-seaFbm(p*1.7+tt*.35-float2(0.,.13)))/.26;
  float2 r2=float2(seaVn(p*6.1-tt*.9+float2(.05,0.))-seaVn(p*6.1-tt*.9-float2(.05,0.)),seaVn(p*6.1-tt*.9+float2(0.,.05))-seaVn(p*6.1-tt*.9-float2(0.,.05)))/.1;
  float3 n=normalize(float3(-(grad.x*3.+r1.x*.10+r2.x*.03),1.,-(grad.y*3.+r1.y*.10+r2.y*.03)));
  float3 V=seaView;
  // wave faces turned to the sun are lighter, the backs darker: the rows of crests read from above
  float face=dot(normalize(float3(-grad.x*3.,1.,-grad.y*3.)),seaSun)-dot(float3(0.,1.,0.),seaSun);
  col*=1.+clamp(face*2.2,-.38,.32)*lerp(1.,.35,smoothstep(6.,16.,sea.z));
  float fres=pow(1.-max(dot(n,V),0.),4.); col=lerp(col,float3(.72,.87,.97),fres*.6);
  // light network on the floor, strongest in the shallows
  float c=seaCaustic(p,tt)*(1.-t*.85)*smoothstep(0.,.2,d)*(1.-bed*.6)*(1.-plume*.8)*1.6;
  // foam: white tops as the crests steepen, white water trailing a broken crest, a lace line at the run-up's edge
  float u=frac(atan2(ph.y,ph.x)/SEA_TAU+1.), cu=min(u,1.-u);
  float calm=1.-smoothstep(.5,.9,riv.y);   // no crests inside the river's jet
  float cap=smoothstep(.08,0.,cu)*smoothstep(3.,1.4,d0)*smoothstep(-.2,.8,sea.z)*calm;
  float wash=brk*(exp(-u*3.2)*.95+.05)*step(u,.93)*calm;
  float edge=smoothstep(.12,0.,d)*smoothstep(-.4,.4,sea.z+1.2);
  // foam drifts shoreward with the bores. Each copy of the pattern drifts for SEA_DRIFT s and starts again, crossfaded with a
  // copy half a cycle behind: drifting by direction × time for ever would stretch the lace into streaks wherever the direction
  // turns (and so would a drift that changes from place to place, so the white water at a river's jet stands where it is)
  float2 drift=dir*1.1*SEA_DRIFT;
  float f0=frac(tt/SEA_DRIFT), f1=frac(tt/SEA_DRIFT+.5), w0=1.-abs(2.*f0-1.);
  float2 q=p+drift*f0;
  float pat=lerp(seaFoamPat(p+drift*f1+float2(7.3,1.9),tt),seaFoamPat(q,tt),w0);
  float jf=smoothstep(.05,.3,riv.y)*(1.-smoothstep(.5,.9,riv.y));   // white water standing at the front of the river's jet, where the waves break against it
  float dens=max(max(max(cap*.95,wash*.8),edge*.95),jf*(.35+.3*seaFbm(p*.8+float2(tt*.3,-tt*.2))));
  float foam=clamp((pat-(1.-dens)*1.05)*2.2,0.,1.)*smoothstep(0.,.25,dens);
  float streak=lerp(seaFbm((p+drift*f1)*.9-tt*.03),seaFbm(q*.9-tt*.03),w0);
  foam=clamp(foam+smoothstep(.78,.95,streak)*.10*smoothstep(1.,4.,d0),0.,1.);   // faint streaks offshore
  float3 R=reflect(-seaSun,n); float sp=max(dot(R,V),0.);
  float glint=pow(sp,240.)*2.4+pow(sp,36.)*.10+step(.986,seaVn(p*9.+tt*2.3))*pow(sp,10.)*1.3;
  float a=max(lerp(.34,.96,t),bed*.7); a=lerp(a,max(a,.8),plume);   // the river's silt hides the floor
  float ca=c; col=(col*a+float3(1.,1.,.9)*ca)/(a+ca+1e-4); a=a+ca*(1.-a);
  col=lerp(col,float3(.97,.99,1.),foam); a=max(a,foam*.96);
  float thin=smoothstep(0.,.04,d); a=max(a*thin,foam*.96*smoothstep(0.,.012,d));   // at the water's edge the water fades out onto the wet sand under it (the lace stays to the edge)
  col+=glint*(1.-foam); a=max(a,clamp(glint,0.,1.)*.8);
  return float4(col,clamp(a,0.,1.));
}
`;

const GLSL_PRELUDE = `
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define frac fract
#define lerp mix
#define atan2 atan
#define seaTime uTime
#define seaWaveH uWaveH
#define seaSun uSun
#define seaShallow uShallow
#define seaDeep uDeep
#define seaView normalize(cameraPosition-vWPos)
#define SEA_SOAKED 0.
`;

const HLSL_PRELUDE = `// GENERATED by tools/sea/build-sea-hlsl.cjs from sea.js — do not edit; edit sea.js and run the tool again.
// Sea surf shared with the map editor (same formulas, same noise). The including shader declares and sets, before calling:
//   static float seaTime, seaWaveH;  static float3 seaSun, seaShallow, seaDeep, seaView;   (editor frame, see MapSea.shader)
#ifndef MAP_SEA_SHARED_INCLUDED
#define MAP_SEA_SHARED_INCLUDED
// Unity's terrain does not darken the sand the waves keep wet, so the sea's sheet does (the editor's terrain does it itself)
#define SEA_SOAKED 1.
`;
const HLSL_END = `
#endif
`;

window.TDSea = {
  WAVELENGTH, PERIOD, STEEPEN_DEPTH, BREAK_DEPTH, RUNUP_GAIN, RUNUP_REACH,
  COMMON, SHADE, GLSL_PRELUDE,
  hlsl: () => HLSL_PRELUDE + COMMON + SHADE + HLSL_END,
};
})();
