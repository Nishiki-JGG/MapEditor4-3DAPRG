using UnityEngine;
namespace MapSharedProps {
// Attach to an actor's feet/root; no physics body or game controller is replaced.
public sealed class SharedPlantContactSource : MonoBehaviour {
 [Min(0)] public float radius=.3f;
 [Min(.01f)] public float height=1.8f;
}
}
