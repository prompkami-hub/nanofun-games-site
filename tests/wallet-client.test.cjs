const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWalletClient}=require('../dist/wallet-client.js');
test('Checkout uses verified server readiness and player reference, not URL reward flags',async()=>{
 let sent;const store=new Map();const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const player='nf_00000000-0000-4000-8000-000000000001';
 const client=createWalletClient({endpoint:'https://script.google.com/macros/s/example/exec',storage,fetcher:async(u,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,token:'example-token',wallet:{player_id:player,checkout_ready:{coins_50:true,vip_year:false}}})};}});
 assert.throws(()=>client.checkoutUrl('coins_50'),/checkout_not_ready/);
 await client.login('buyer@example.com','123456');assert.equal(sent.action,'login');
 assert.equal(new URL(client.checkoutUrl('coins_50')).searchParams.get('client_reference_id'),player);
 assert.throws(()=>client.checkoutUrl('vip_year'),/checkout_not_ready/);
 await client.verifyCheckout('coins_50');assert.equal(sent.action,'verify_checkout');assert.equal(sent.session_id,'coins_50');assert.equal(sent.token,'example-token');
 client.logout();assert.throws(()=>client.checkoutUrl('coins_50'),/checkout_not_ready/);
});
test('Misconfigured or failed endpoint never enables a checkout',async()=>{
 assert.throws(()=>createWalletClient({endpoint:'https://example.com/steal'}),/wallet_not_configured/);
 const client=createWalletClient({endpoint:'https://script.google.com/macros/s/example/exec',storage:{getItem:()=>null},fetcher:async()=>({ok:false})});
 await assert.rejects(client.refresh(),/wallet_unavailable/);assert.throws(()=>client.checkoutUrl('coins_50'));
});
