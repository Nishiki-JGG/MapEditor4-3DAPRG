// 草むら（grass）。地面を覆う丈の高い草の株。歩くと押しのけられる
TDProps.add({
  id: 'grass', name: '草むら',
  r: 0, min: .5, sc: [.7, 1.4], slope: 1, vis: .55,
  sway: 0, tags: ['grassland', 'forest', 'jungle', 'ruins', 'graveyard', 'beach', 'canyon', 'castle'], height: .615, touch: true, material: 'shared', sharedAsset: 'grass',
  build() { return TDSharedProps.geometry('grass'); },
});
