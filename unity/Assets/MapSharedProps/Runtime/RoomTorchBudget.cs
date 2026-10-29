using System;
using UnityEngine;

namespace MapSharedProps
{
    // 原本VFXを編集せず、部屋に配置した灯具の照明・遠距離粒子だけを制限する。
    [DisallowMultipleComponent]
    public sealed class RoomTorchBudget : MonoBehaviour
    {
        [SerializeField] private RoomTorchInstance[] fixtures = Array.Empty<RoomTorchInstance>();
        [SerializeField] private Transform focus;
        [SerializeField, Range(0, 2)] private int shadowedLights = 2;
        private const int MaxLights = 6;
        private readonly RoomTorchInstance[] slots = new RoomTorchInstance[MaxLights];
        private readonly RoomTorchInstance[] targets = new RoomTorchInstance[MaxLights];
        private readonly float[] gains = new float[MaxLights];
        private int[] order = Array.Empty<int>();
        private float[] distances = Array.Empty<float>(), particleFades = Array.Empty<float>();
        private float selectionTimer, cameraTimer;
        private readonly Light[] pooledLampLights = new Light[MaxLights];
        public int PooledLampLightCount { get { int n=0; foreach(var light in pooledLampLights)if(light)n++; return n; } }
        private Light LampLight(int slot) { if(pooledLampLights[slot])return pooledLampLights[slot]; var go=new GameObject("Shared lamp light "+slot); go.hideFlags=HideFlags.DontSave; go.transform.SetParent(transform,false); var light=go.AddComponent<Light>();light.enabled=false;light.renderMode=LightRenderMode.ForcePixel;light.shadowCustomResolution=256;light.shadowBias=.03f;light.shadowNormalBias=.015f;pooledLampLights[slot]=light;return light; }
        // Slot owns its pooled light; a moving fixture may already borrow another slot's light.
        private void ReleaseSlot(int slot)
        {
            var fixture=slots[slot];
            var owned=pooledLampLights[slot];
            if(owned)owned.enabled=false;
            if(!fixture)return;
            if(fixture.IsPooledLamp)fixture.ReleaseLight(owned);
            else if(fixture.SourceLight)fixture.SourceLight.enabled=false;
        }
        private void OnDisable() { for(int i=0;i<MaxLights;i++)ReleaseSlot(i); ActiveLights=0; }
        private void OnDestroy() { foreach(var light in pooledLampLights)if(light){if(Application.isPlaying)Destroy(light.gameObject);else DestroyImmediate(light.gameObject);} }
        public float TimeOverride {get;set;} = -1f;
        public int ActiveLights { get; private set; }
        public int ActiveEmitters { get; private set; }
        public RoomTorchInstance[] Fixtures => fixtures;
        public void SetFocus(Transform value) { focus = value; selectionTimer = 0f; }

        public void Configure(RoomTorchInstance[] values)
        {
            fixtures = values; ResetBudget();
        }

        private void OnEnable() => ResetBudget();
        private void ResetBudget()
        {
            for(int i=0;i<MaxLights;i++)ReleaseSlot(i);
            order = new int[fixtures.Length]; distances = new float[fixtures.Length]; particleFades = new float[fixtures.Length];
            Array.Clear(slots, 0, slots.Length); Array.Clear(targets, 0, targets.Length); Array.Clear(gains, 0, gains.Length);
            for (int i = 0; i < fixtures.Length; i++) { order[i] = i; if (fixtures[i] != null && fixtures[i].SourceLight != null) fixtures[i].SourceLight.enabled = false; }
            selectionTimer = cameraTimer = 0f;
        }

        private void LateUpdate()
        {
            cameraTimer -= Time.deltaTime;
            if (focus == null && cameraTimer <= 0f) { cameraTimer = 1f; var camera = Camera.main; if (camera != null) focus = camera.transform; }
            if (focus != null) Tick(Time.deltaTime, focus.position);
        }

        public void Tick(float dt, Vector3 center)
        {
            if (order.Length != fixtures.Length) ResetBudget();
            ActiveEmitters = 0;
            for (int i = 0; i < fixtures.Length; i++)
            {
                var fixture = fixtures[i]; if (fixture == null || (fixture.IsPooledLamp && !fixture.isActiveAndEnabled)) { distances[i] = float.PositiveInfinity; continue; }
                Vector3 delta = fixture.transform.position - center; distances[i] = new Vector2(delta.x, delta.z).magnitude;
                float target = 1f - Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((distances[i] - 18f) / 14f));
                particleFades[i] = Mathf.Lerp(particleFades[i], target, 1f - Mathf.Exp(-Mathf.Max(0f, dt) * 5f));
                fixture.SetParticleVisibility(particleFades[i]); if (particleFades[i] > .001f) ActiveEmitters++;
            }
            if ((selectionTimer -= dt) <= 0f)
            {
                selectionTimer = .2f;
                // 現在の灯具を1.5m優先し、境界での頻繁な入れ替えを避ける。
                for (int i = 0; i < order.Length; i++) order[i] = i;
                Array.Sort(order, (a, b) => Score(a).CompareTo(Score(b)));
                Array.Clear(targets, 0, targets.Length);
                var selected=new System.Collections.Generic.List<RoomTorchInstance>();int lampCount=0;
                foreach(int index in order){if(distances[index]>=40f||fixtures[index]==null)continue;var f=fixtures[index];if(f.IsPooledLamp){if(lampCount>=2)continue;lampCount++;}selected.Add(f);if(selected.Count==MaxLights)break;}
                // 壁灯は先頭の影付き二枠。既存の六灯上限は増やさない。
                foreach(var f in selected){int slot=Array.IndexOf(slots,f);if(slot>=0&&(f.IsPooledLamp==(slot<lampCount)))targets[slot]=f;}
                foreach(var f in selected){if(Array.IndexOf(targets,f)>=0)continue;for(int slot=0;slot<MaxLights;slot++)if(targets[slot]==null&&(f.IsPooledLamp==(slot<lampCount))){targets[slot]=f;break;}}

            }
            ActiveLights = 0;
            for (int i = 0; i < MaxLights; i++)
            {
                if (slots[i] != targets[i] && gains[i] > .002f) gains[i] *= Mathf.Exp(-Mathf.Max(0f, dt) * 14f);
                else
                {
                    if (slots[i] != targets[i]) ReleaseSlot(i);
                    slots[i] = targets[i]; gains[i] = Mathf.Lerp(gains[i], slots[i] != null ? 1f : 0f, 1f - Mathf.Exp(-Mathf.Max(0f, dt) * 7f));
                }
                if (slots[i] != null && slots[i].IsPooledLamp) { slots[i].BorrowLight(LampLight(i)); slots[i].UpdateLamp(TimeOverride>=0?TimeOverride:Time.time); }
                if (slots[i] == null || slots[i].SourceLight == null) continue;
                Light light = slots[i].IsPooledLamp ? pooledLampLights[i] : slots[i].SourceLight; light.enabled = gains[i] > .001f;
                light.shadows = (slots[i].IsPooledLamp || i < shadowedLights) && i < 2 ? LightShadows.Soft : LightShadows.None;
                // 原本Updateの光量をLateUpdateでフェードする。元の明滅式・色・範囲は保持。
                light.intensity *= gains[i]; if (light.enabled) ActiveLights++;
            }
        }

        private float Score(int index) => distances[index] - (Array.IndexOf(slots, fixtures[index]) >= 0 ? 1.5f : 0f);
    }
}
