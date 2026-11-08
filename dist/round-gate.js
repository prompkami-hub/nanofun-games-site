'use strict';
(function(root){
  function createRoundGate({client,storage,uuid=()=>root.crypto.randomUUID(),onUpdate=()=>{}}){
    const key='nanofun.wallet.pending-round.v1';let busy=false;
    async function request({playerId,gameId,isCurrent=()=>true}){
      if(busy)return false;busy=true;
      try{
        let pending;
        try{pending=JSON.parse(storage.getItem(key)||'null');}catch{throw Error('pending_round_unreadable');}
        if(pending&&pending.playerId!==playerId)throw Error('previous_account_round_pending');
        if(pending&&pending.gameId!==gameId)throw Error('previous_game_round_pending');
        if(!pending){pending={playerId,gameId,operationId:uuid()};storage.setItem(key,JSON.stringify(pending));}
        const r=await client.start(pending.operationId);onUpdate(r.wallet);
        // If the cabinet closed while authorizing, keep its operation so the
        // next attempt recovers the paid round rather than charging again.
        if(!isCurrent())return false;
        storage.removeItem(key);return true;
      }catch(e){
        if(['insufficient_coins','login_required','account_unavailable','invalid_operation'].includes(e.message))storage.removeItem(key);
        throw e;
      }finally{busy=false;}
    }
    return Object.freeze({request,get busy(){return busy;}});
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createRoundGate};
  else root.NanoFunRoundGate=Object.freeze({createRoundGate});
})(typeof window==='undefined'?globalThis:window);
