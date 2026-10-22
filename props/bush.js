// 既存の茂み。寸法・原点・IDを保った共有メッシュ。
TDProps.add({id:'bush',name:'茂み',r:0,min:1.0,sc:[.7,1.5],slope:.8,vis:.9,sway:.5,tags:['grassland','forest','jungle','canyon','ruins','castle','beach'],height:.93,touch:true,material:'shared',sharedAsset:'bush',assetKey:'tdj/bush',yawOffset:0,groundSink:.05,build(){return TDSharedProps.geometry('bush');}});
