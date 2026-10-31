using System;
using UnityEngine;
using UnityEngine.Rendering;
namespace TotsuDan.MapEditor
{
 // Store one immutable source mesh and a placement, not one baked mesh asset per rock.
 [ExecuteAlways, DisallowMultipleComponent, RequireComponent(typeof(MeshFilter),typeof(MeshRenderer),typeof(MeshCollider))]
 public sealed class MapAffineRock : MonoBehaviour
 {
  [SerializeField] Mesh source;
  [SerializeField] Matrix4x4 placement=Matrix4x4.identity;
  [SerializeField] Color tint=Color.white;
  [NonSerialized] Mesh owned;
  public Mesh Source => source;
  public Matrix4x4 Placement => placement;
  public void Configure(Mesh mesh,Matrix4x4 transformMatrix,Color color){Release();source=mesh;placement=transformMatrix;tint=color;Rebuild();}
  public void ClearGeneratedForSave(){Release();}
  void OnEnable(){if(source&&!owned)Rebuild();}
  void OnDestroy(){Release();}
  public void Rebuild()
  {
   if(!source)return;
   Release();
   var vertices=source.vertices;var normals=source.normals;var colors=source.colors;var indices=source.triangles;
   if(normals.Length!=vertices.Length)throw new InvalidOperationException("岩の共通形状に法線がありません");
   var normalMatrix=placement.inverse.transpose;
   for(int i=0;i<vertices.Length;i++){vertices[i]=placement.MultiplyPoint3x4(vertices[i]);normals[i]=normalMatrix.MultiplyVector(normals[i]).normalized;}
   if(colors.Length!=vertices.Length){colors=new Color[vertices.Length];for(int i=0;i<colors.Length;i++)colors[i]=Color.white;}
   for(int i=0;i<colors.Length;i++)colors[i]*=tint;
   if(placement.determinant<0)for(int i=0;i<indices.Length;i+=3){int t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
   owned=new Mesh{name="AffineRock_"+name,hideFlags=HideFlags.DontSave,indexFormat=vertices.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16};
   owned.vertices=vertices;owned.normals=normals;owned.colors=colors;owned.uv=source.uv;owned.triangles=indices;owned.RecalculateBounds();
   GetComponent<MeshFilter>().sharedMesh=owned;GetComponent<MeshCollider>().sharedMesh=owned;
  }
  void Release(){if(!owned)return;var filter=GetComponent<MeshFilter>();var collider=GetComponent<MeshCollider>();if(filter&&filter.sharedMesh==owned)filter.sharedMesh=null;if(collider&&collider.sharedMesh==owned)collider.sharedMesh=null;if(UnityEngine.Application.isPlaying)Destroy(owned);else DestroyImmediate(owned);owned=null;}
 }
}
