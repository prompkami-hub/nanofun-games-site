const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRewardedAds}=require('../dist/rewarded-ads.js');

test('Disabled ads never call provider, show a fake ad, or award coins',async()=>{
 const ads=createRewardedAds({requestPlacement(){throw Error('must not run');},grantReward(){throw Error('must not grant');}});
 assert.deepEqual(await ads.request(),{status:'not_configured',rewarded:false});
});
test('Completion grants exactly three once, repeated callbacks and clicks do not duplicate',async()=>{
 let callbacks,count=0,paused=0,resumed=0;
 const ads=createRewardedAds({enabled:true,requestPlacement:o=>{callbacks=o;},prompt:()=>true,pause:()=>paused++,resume:()=>resumed++,grantReward:async ({coins})=>{count+=coins;return true;}});
 const pending=ads.request();assert.equal((await ads.request()).status,'busy');
 callbacks.beforeReward(()=>callbacks.beforeAd());await new Promise(setImmediate);
 callbacks.adViewed();callbacks.adViewed();callbacks.adBreakDone({breakStatus:'viewed'});
 assert.equal((await pending).rewarded,true);assert.equal(count,3);assert.equal(paused,1);assert.equal(resumed,1);
 callbacks.adViewed();callbacks.adBreakDone({breakStatus:'viewed'});assert.equal(count,3);
});
test('Dismissal, no inventory, and a viewed status without completion do not award',async()=>{
 for(const status of ['dismissed','noAdPreloaded','frequencyCapped','viewed']){
  let c,count=0;
  const ads=createRewardedAds({enabled:true,requestPlacement:o=>c=o,grantReward:()=>{count++;return true;}});
  const pending=ads.request();if(status==='dismissed')c.adDismissed();else c.adBreakDone({breakStatus:status});
  assert.equal((await pending).rewarded,false);c.adViewed();assert.equal(count,0);
 }
});
test('Declined reward prompt does not display an ad; failed grant is pending, not success',async()=>{
 let c;
 const ads=createRewardedAds({enabled:true,requestPlacement:o=>c=o,prompt:()=>false,grantReward:()=>true});
 let pending=ads.request();c.beforeReward(()=>{throw Error('must not display');});assert.equal((await pending).status,'declined');
 const failed=createRewardedAds({enabled:true,requestPlacement:o=>c=o,grantReward:()=>{throw Error('server offline');}});
 pending=failed.request();c.adViewed();c.adBreakDone({breakStatus:'viewed'});assert.equal((await pending).status,'reward_pending');
});
