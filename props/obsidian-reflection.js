// Obsidian alone receives the existing shared presentation environment.
// No new probe, image, light, shader pass, or change to scene lighting.
window.TDObsidianReflection=(()=>{
 let material;
 function create(source){if(material)return material;material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
  material.onBeforeRender=(renderer,scene)=>{const environment=scene.environment||window.TDChestSanctum?.reflectionEnvironment?.()||null;if(material.envMap!==environment){material.envMap=environment;material.needsUpdate=true;}
   let ambient=0;for(const light of scene.children)if(light.visible&&(light.isHemisphereLight||light.isAmbientLight))ambient+=light.intensity;
   material.envMapIntensity=Math.max(0,Math.min(1,ambient));
  };return material;
 }
 function descriptor(types){const t=types.find(t=>t.id==='obsidian'&&t.assetKey==='tdj/obsidian');if(!t)return null;return{version:1,asset:{id:t.id,assetKey:t.assetKey,source:'editor-procedural-mesh',material:'gloss',radius:t.r,height:t.height,groundSink:.05,shape:true,...TDSmallPropExport.geometry(t.geo,false)}};}
 return{material:create,export:descriptor};
})();
