// 葦（reed）
TDProps.add({
  id: 'reed', name: '葦',
  r: 0, min: .7, sc: [.8, 1.3], slope: .7, vis: .5, anyGround: true,
  sway: 0, tags: ['grassland', 'forest', 'jungle', 'beach'], height: 1.79, touch: true, material: 'shared', sharedAsset: 'reed',
  build() { return TDSharedProps.geometry('reed'); },
});
