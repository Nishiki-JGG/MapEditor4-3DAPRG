// シダ（fern）
TDProps.add({
  id: 'fern', name: 'シダ',
  r: 0, min: 1, sc: [.8, 1.5], slope: .8, vis: .8, sway: 0,
  tags: ['jungle', 'forest'], height: 0.58, material: 'shared',
  sharedAsset: 'fern',
  build() { return TDSharedProps.geometry('fern'); },
});
