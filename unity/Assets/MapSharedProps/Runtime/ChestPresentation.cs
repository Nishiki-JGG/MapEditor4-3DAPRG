using System.Collections.Generic;
using UnityEngine;

namespace MapSharedProps {
// GPU motes plus two unshadowed light clusters per gold chest, capped at eight active lights.
public sealed class ChestPresentation : MonoBehaviour {
 [SerializeField] Renderer effectRenderer;
 [SerializeField] float seed;
 [SerializeField] float timeOverride=-1;
 [SerializeField] Light[] goldLights;
 static readonly List<ChestPresentation> active=new List<ChestPresentation>();
 MaterialPropertyBlock block;
 public void Configure(Renderer renderer,bool gold=false){effectRenderer=renderer;if(gold&&(goldLights==null||goldLights.Length==0)){goldLights=new Light[2];for(int k=0;k<2;k++){var child=new GameObject("Gold sparkle light cluster "+k);child.transform.SetParent(transform,false);var light=child.AddComponent<Light>();light.type=LightType.Point;light.color=new Color(1,.72f,.24f);light.range=2.4f;light.shadows=LightShadows.None;light.renderMode=LightRenderMode.ForcePixel;goldLights[k]=light;}}Register();Apply();}
 public static float Seed(string id){uint h=2166136261;unchecked{foreach(char c in id??"")h=(h^c)*16777619;}return (h&65535)/65536f;}
 public void SetSeed(string id){seed=Seed(id);Apply();}
 public void SetTime(float time){timeOverride=time;Apply();}
 void Register(){active.RemoveAll(x=>!x);if(goldLights!=null&&goldLights.Length>0&&gameObject.scene.IsValid()&&isActiveAndEnabled&&!active.Contains(this))active.Add(this);}
 void OnEnable(){Register();Apply();}
 void OnDisable(){active.Remove(this);SetLightVisibility(false);}
 void OnDestroy(){active.Remove(this);}
 void Update(){if(active.Count>0&&active[0]==this)RefreshLights(Camera.main);}
 public static void LightState(int index,float time,float phase,out Vector3 position,out float intensity){
  float p=phase*6.2831853f+index*2.35f;
  position=new Vector3((index==0?-.48f:.48f)+.055f*Mathf.Sin(time*1.7f+p),.43f+.06f*Mathf.Sin(time*1.2f+p),-.28f-.045f*Mathf.Cos(time*1.4f+p));
  float pulse=.5f+.5f*Mathf.Sin(time*5+phase*19+index*2.35f);
  intensity=2.5f+2.5f*pulse*pulse*pulse;
 }
 // The closest four chests use two pooled-in-prefab clusters each; no per-mote lights.
 public static void RefreshLights(Camera camera){
  Vector3 eye=camera?camera.transform.position:Vector3.zero;
  for(int i=0;i<active.Count;i++){var a=active[i];if(!a)continue;float distance=camera?Vector3.Distance(eye,a.transform.position):0;int rank=0;
   for(int j=0;j<active.Count;j++){var b=active[j];if(!b||i==j)continue;float other=camera?Vector3.Distance(eye,b.transform.position):0;if(other<distance||(other==distance&&j<i))rank++;}
   a.UpdateLights(rank<4?1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(14,20,distance)):0);
  }
 }
 public void SetLightVisibility(bool value){if(goldLights!=null)foreach(var light in goldLights)if(light)light.enabled=value;}
 void UpdateLights(float fade){if(goldLights==null)return;float t=timeOverride<0?Time.time:timeOverride;float scale=Mathf.Max(Mathf.Abs(transform.lossyScale.x),Mathf.Abs(transform.lossyScale.z));for(int k=0;k<goldLights.Length;k++){var light=goldLights[k];if(!light)continue;LightState(k,t,seed,out var p,out var power);light.transform.localPosition=p;light.range=2.4f*scale;light.intensity=power*fade;light.enabled=fade>0;}}
 void Apply(){Register();if(effectRenderer!=null){if(block==null)block=new MaterialPropertyBlock();effectRenderer.GetPropertyBlock(block);block.SetFloat("_ChestSeed",seed);block.SetFloat("_ChestFxTime",timeOverride);effectRenderer.SetPropertyBlock(block);}UpdateLights(isActiveAndEnabled?1:0);}
}
}
