using UnityEngine;

namespace MapSharedProps {
// One bounded GPU effect mesh owned by its prefab. No Update, allocation loop or light.
public sealed class ChestPresentation : MonoBehaviour {
 [SerializeField] Renderer effectRenderer;
 [SerializeField] float seed;
 [SerializeField] float timeOverride=-1;
 public void Configure(Renderer renderer){effectRenderer=renderer;Apply();}
 public static float Seed(string id){uint h=2166136261;unchecked{foreach(char c in id??"")h=(h^c)*16777619;}return (h&65535)/65536f;}
 public void SetSeed(string id){seed=Seed(id);Apply();}
 public void SetTime(float time){timeOverride=time;Apply();}
 void OnEnable(){Apply();}
 void Apply(){if(effectRenderer==null)return;var block=new MaterialPropertyBlock();effectRenderer.GetPropertyBlock(block);block.SetFloat("_ChestSeed",seed);block.SetFloat("_ChestFxTime",timeOverride);effectRenderer.SetPropertyBlock(block);}
}
}
