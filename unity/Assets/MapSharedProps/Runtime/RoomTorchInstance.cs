using System;
using System.Reflection;
using UnityEngine;

namespace MapSharedProps
{
    // 原本のPrefabと演出は保持し、インポート後の部屋Prefab再読込時にも初期化する。
    [DisallowMultipleComponent]
    public sealed class RoomTorchInstance : MonoBehaviour
    {
        [SerializeField] private MonoBehaviour presentation;
        [SerializeField] private int seed;
        [SerializeField] private string seedKey;
        [SerializeField] private Light sourceLight;
        [SerializeField] private ParticleSystem[] particles;
        private MethodInfo initialize;
        private float[] rates;
        private bool[] emissionEnabled;
        public Light SourceLight => sourceLight;
        public string SeedKey => seedKey;
        public int Seed => seed;
        public ParticleSystem[] Particles => particles;
        public float ParticleFade { get; private set; }

        public void Configure(MonoBehaviour original, int dungeonSeed, string key)
        {
            presentation = original; seed = dungeonSeed; seedKey = key;
            sourceLight = original.GetComponentInChildren<Light>(true);
            particles = original.GetComponentsInChildren<ParticleSystem>(true);
            InitializePresentation();
        }

        private void OnEnable() => InitializePresentation();

        public void InitializePresentation()
        {
            if (presentation == null || string.IsNullOrWhiteSpace(seedKey)) return;
            // 再有効化の前に距離制御で減らした煙のrateを戻す。原本ApplyQualityは煙のrateを戻さない。
            if (rates != null) SetParticleVisibility(1f);
            // playOnAwakeの粒子はOnEnable時には既に再生中になり得る。原本にseedを渡す前に完全停止する。
            foreach (var system in particles) system.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            if (presentation.GetType().FullName != "TotsuDan.Prototype.Discovery.DiscoveryRoomTorchPresentation" && !(presentation is FirePresentation))
                throw new InvalidOperationException("壁掛け松明の原本コンポーネントが違います。");
            if (initialize == null) initialize = presentation.GetType().GetMethod("Initialize", new[] { typeof(int), typeof(string) });
            if (initialize == null) throw new InvalidOperationException("元松明のInitialize(int,string)がありません。");
            initialize.Invoke(presentation, new object[] { seed, seedKey });
            rates = new float[particles.Length]; emissionEnabled = new bool[particles.Length];
            for (int i = 0; i < particles.Length; i++) { var emission = particles[i].emission; rates[i] = emission.rateOverTimeMultiplier; emissionEnabled[i] = emission.enabled; }
            if (isActiveAndEnabled)
                for (int i = 0; i < particles.Length; i++) if (emissionEnabled[i]) particles[i].Play();
            ParticleFade = 1f;
        }

        public void SetParticleVisibility(float fade)
        {
            ParticleFade = fade;
            if (rates == null) return;
            for (int i = 0; i < particles.Length; i++)
            {
                var system = particles[i]; var emission = system.emission;
                bool active = emissionEnabled[i] && fade > .001f;
                emission.enabled = active; emission.rateOverTimeMultiplier = rates[i] * fade;
                if (!active && system.isPlaying) system.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                else if (active && !system.isPlaying) system.Play();
            }
        }
    }
}
