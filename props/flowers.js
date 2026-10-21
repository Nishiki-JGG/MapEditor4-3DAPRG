// 花（flowers）
TDProps.add({
  id: 'flowers', name: '花',
  r: 0, min: .6, sc: [.8, 1.4], slope: .8, vis: .45,
  sway: 0, tags: ['grassland', 'forest', 'ruins'], height: .437, touch: true, material: 'shared', sharedAsset: 'flowers',
  build() { return TDSharedProps.geometry('flowers'); },
});
