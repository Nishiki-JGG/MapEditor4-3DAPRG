// シダ（fern）
TDProps.add({
  id: 'fern', name: 'シダ',
  r: 0, min: 1, sc: [.8, 1.5], slope: .8, vis: .8, sway: 0,
  tags: ['jungle', 'forest', 'cave'], placementHint: '洞窟では入口・天窓など光の入る場所用。暗い奥には岩や菌類を使います。', height: 0.58, touch: true, material: 'shared',
  sharedAsset: 'fern',
  build() { return TDSharedProps.geometry('fern'); },
});
