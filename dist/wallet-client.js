'use strict';
(function(root){
  const plans=Object.freeze({coins_50:'https://buy.stripe.com/aFa9AS48v0vD4q72jMf7i02',vip_year:'https://buy.stripe.com/cNi28q34r92909Re2uf7i03'});
  function createWalletClient({endpoint,fetcher=fetch,storage=root.localStorage}={}){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint||''))throw Error('wallet_not_configured');
    if(!storage)throw Error('storage_unavailable');
    let wallet=null;
    async function call(action,data={}){
      const token=storage.getItem('nanofun.wallet.auth.v1');
      const response=await fetcher(endpoint,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...data,token})});
      if(!response.ok)throw Error('wallet_unavailable');
      const result=await response.json();if(!result.ok)throw Error(result.error||'wallet_unavailable');
      if(result.wallet)wallet=result.wallet;else if(action==='wallet')wallet=result;
      return result;
    }
    return Object.freeze({
      requestLogin:email=>call('request_login',{email}),
      async login(email,code){const r=await call('login',{email,code});if(!r.token)throw Error('login_failed');storage.setItem('nanofun.wallet.auth.v1',r.token);return r.wallet;},
      refresh:()=>call('wallet'),
      start:operationId=>call('start',{operation_id:operationId}),
      // A return session ID requests server verification. URL flags never grant coins.
      verifyCheckout:sessionId=>call('verify_checkout',{session_id:sessionId}),
      checkoutUrl(plan){
        if(!plans[plan]||!wallet?.checkout_ready?.[plan]||!/^nf_[0-9a-f-]{36}$/.test(wallet.player_id))throw Error('checkout_not_ready');
        const url=new URL(plans[plan]);url.searchParams.set('client_reference_id',wallet.player_id);return url.href;
      },
      logout(){storage.removeItem('nanofun.wallet.auth.v1');wallet=null;}
    });
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createWalletClient};
  else root.NanoFunWalletClient=Object.freeze({createWalletClient});
})(typeof window==='undefined'?globalThis:window);
