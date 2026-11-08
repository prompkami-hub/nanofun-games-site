'use strict';
// Google H5 Ad Placement API adapter. Approval and provider wiring are required.
// grantReward must record the reward once; this adapter is not an entitlement server.
(function(root){
  function createRewardedAds({enabled=false,requestPlacement,grantReward,prompt=()=>false,pause=()=>{},resume=()=>{}}={}){
    let busy=false;
    return Object.freeze({
      async request(){
        if(!enabled||typeof requestPlacement!=='function'||typeof grantReward!=='function')return {status:'not_configured',rewarded:false};
        if(busy)return {status:'busy',rewarded:false};
        busy=true;
        return new Promise(resolve=>{
          let ended=false,viewed=false,rewardPromise=null,shown=false;
          const finish=async status=>{
            if(ended)return;ended=true;
            let rewarded=false;
            if(rewardPromise){try{rewarded=(await rewardPromise)===true;}catch{}}
            try{if(shown)resume();}catch{}
            busy=false;
            resolve({status:viewed?(rewarded?'rewarded':'reward_pending'):status,rewarded});
          };
          try{
            requestPlacement({type:'reward',name:'nanofun_energy_3',
              beforeReward:showAd=>{Promise.resolve().then(()=>prompt({coins:3})).then(accepted=>{
                if(!accepted||ended){finish('declined');return;}
                try{showAd();}catch{finish('provider_error');}
              },()=>finish('prompt_error'));},
              beforeAd:()=>{shown=true;pause();},
              // Only the documented completion callback can request the reward.
              adViewed:()=>{if(ended||viewed)return;viewed=true;rewardPromise=Promise.resolve().then(()=>grantReward({coins:3})).then(value=>value===true,()=>false);},
              adDismissed:()=>finish('dismissed'),
              adBreakDone:info=>finish(info?.breakStatus||'unknown')
            });
          }catch{finish('provider_error');}
        });
      }
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createRewardedAds};
  else root.NanoFunRewarded=Object.freeze({createRewardedAds});
})(typeof window==='undefined'?globalThis:window);
