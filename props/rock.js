// 岩（rock）
TDProps.add({
  id: 'rock', name: '岩',
  r: .75, offs: [-.2, .5], min: 1.4, sc: [.6, 1.9], slope: 4, vis: 1.2, anyGround: true, shape: true,
  tags: ['common'], height: 1.1, material: 'shared',
  sharedAsset: 'rock',
  build() { return TDSharedProps.geometry('rock'); },
});
