using System;
using UnityEngine;
namespace MapSharedProps {
 // エディタ由来の灯具専用。元ゲームのRoomTorchには取り付けない。
 public sealed class FirePresentation : MonoBehaviour {
  [SerializeField] Light sourceLight; [SerializeField] float power; [SerializeField] Renderer[] flames; [SerializeField] ParticleSystem[] particles;
  [SerializeField] float phase; public bool Initialized {get;private set;}
  public void Configure(Light light,float intensity,Renderer[] surfaces,ParticleSystem[] systems){sourceLight=light;power=intensity;flames=surfaces;particles=systems;}
  [UnityEngine.Scripting.Preserve] public void Initialize(int seed,string key){uint h=unchecked(((uint)2166136261^ (uint)seed)*16777619);foreach(char c in key){h=unchecked((h^(byte)c)*16777619);h=unchecked((h^(byte)(c>>8))*16777619);}phase=(h&0xffffff)/16777215f;
   for(int i=0;i<particles.Length;i++){particles[i].Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);particles[i].useAutoRandomSeed=false;particles[i].randomSeed=h+(uint)i*1973+1;}
   for(int i=0;i<flames.Length;i++){var b=new MaterialPropertyBlock();b.SetFloat("_Phase",phase*17+i*1.7f);flames[i].SetPropertyBlock(b);}Initialized=true;Update();
  }
  void Update(){if(!Initialized||sourceLight==null)return;float t=Time.time*1.7f;float f=Mathf.PerlinNoise(t+phase*19.19f,phase*7.37f+.31f)*.78f+(Mathf.Sin((t+phase*3.1f)*4.3f)*.5f+.5f)*.22f;sourceLight.intensity=power*(.86f+.28f*f);}
 }
}
