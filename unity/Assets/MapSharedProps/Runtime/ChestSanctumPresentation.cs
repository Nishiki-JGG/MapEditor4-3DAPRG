using System.Collections.Generic;using UnityEngine;
namespace MapSharedProps {
// A shared pool of at most six lights serves the two nearest rainbow chests.
public sealed class ChestSanctumPresentation:MonoBehaviour {
 [SerializeField]Renderer[] surfaces;[SerializeField]Renderer effect;[SerializeField]float timeOverride=-1,seed;[SerializeField]Color tint=Color.white;
 static readonly List<ChestSanctumPresentation> active=new List<ChestSanctumPresentation>(),ordered=new List<ChestSanctumPresentation>();static readonly List<Light> pool=new List<Light>();static GameObject host;MaterialPropertyBlock block;
 public void Configure(Renderer[] materials,Renderer fx){surfaces=materials;effect=fx;Register();Apply();}
 void Register(){active.RemoveAll(x=>!x);if(gameObject.scene.IsValid()&&isActiveAndEnabled&&surfaces!=null&&!active.Contains(this))active.Add(this);}
 void OnEnable(){Register();Apply();}void OnDisable(){active.Remove(this);RefreshLights(Camera.main);}void OnDestroy(){active.Remove(this);RefreshLights(Camera.main);}
 void Update(){if(active.Count>0&&active[0]==this)RefreshLights(Camera.main);}
 public void SetSeed(string id){seed=ChestPresentation.Seed(id);Apply();}public void SetTime(float t){timeOverride=t;Apply();}public void SetTint(Color c){tint=c;Apply();}
 void Apply(){if(block==null)block=new MaterialPropertyBlock();if(surfaces!=null)foreach(var r in surfaces)if(r){r.GetPropertyBlock(block);block.SetFloat("_ChestTime",timeOverride);block.SetColor("_BaseColor",tint);r.SetPropertyBlock(block);}if(effect){effect.GetPropertyBlock(block);block.SetFloat("_ChestFxTime",timeOverride);block.SetFloat("_ChestSeed",seed);effect.SetPropertyBlock(block);}Register();}
 public static void LightState(int k,float t,float phase,out Vector3 pos,out Color colour,out float intensity){float a=k*2.094f+t*.28f+phase;pos=new Vector3(Mathf.Cos(a)*.49f,.48f+Mathf.Sin(t+k+phase)*.06f,Mathf.Sin(a)*.38f);colour=Color.HSVToRGB(Mathf.Repeat(k/3f+t*.055f+phase*.03f,1),.857142857f,.875f);intensity=5.5f+1.5f*Mathf.Sin(t*3+k*2+phase);}
 public static int ActiveLights {get{int n=0;foreach(var l in pool)if(l&&l.enabled)n++;return n;}}
 public static int LightCapacity=>pool.Count;
 public static void RefreshLights(Camera camera){active.RemoveAll(x=>!x||!x.isActiveAndEnabled);ordered.Clear();ordered.AddRange(active);Vector3 eye=camera?camera.transform.position:Vector3.zero;ordered.Sort((a,b)=>{int c=(a.transform.position-eye).sqrMagnitude.CompareTo((b.transform.position-eye).sqrMagnitude);return c!=0?c:active.IndexOf(a).CompareTo(active.IndexOf(b));});
  if(!host)pool.Clear();int count=0;foreach(var a in ordered){if(count>=6)break;float distance=camera?Vector3.Distance(eye,a.transform.position):0,fade=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(14,20,distance));if(fade<=0)continue;float t=a.timeOverride<0?Time.time:a.timeOverride,scale=Mathf.Max(Mathf.Abs(a.transform.lossyScale.x),Mathf.Abs(a.transform.lossyScale.z));for(int k=0;k<3;k++){if(!host){host=new GameObject("Shared rainbow light pool");host.hideFlags=HideFlags.DontSave;}if(count==pool.Count){var o=new GameObject("Rainbow cluster "+count);o.transform.SetParent(host.transform,false);var created=o.AddComponent<Light>();created.type=LightType.Point;created.shadows=LightShadows.None;created.renderMode=LightRenderMode.ForcePixel;pool.Add(created);}var l=pool[count++];LightState(k,t,a.seed,out var p,out var c,out var power);l.transform.position=a.transform.TransformPoint(p);l.color=c;l.intensity=power*fade;l.range=3.3f*scale;l.enabled=true;}}
  for(int k=count;k<pool.Count;k++)if(pool[k])pool[k].enabled=false;
  if(active.Count==0&&host){if(Application.isPlaying)Destroy(host);else DestroyImmediate(host);host=null;pool.Clear();}
 }
}
}
