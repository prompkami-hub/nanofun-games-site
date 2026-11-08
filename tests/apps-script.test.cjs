const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const s={};vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8'),s);
function valid(){return {id:'cs_live_example',status:'complete',payment_status:'paid',mode:'payment',currency:'usd',amount_total:99,client_reference_id:'player1',customer_details:{email:'buyer@example.com'},line_items:{has_more:false,data:[{quantity:1,price:{unit_amount:99,currency:'usd'}}]}};}
const link={url:'https://buy.stripe.com/aFa9AS48v0vD4q72jMf7i02'};
test('Paid order must match server-known product, amount, currency, owner and quantity',()=>{
 assert.equal(s.nfCheckPurchase(valid(),link,'player1','buyer@example.com'),'coins_50');
 for(const [field,value] of [['payment_status','unpaid'],['amount_total',0],['currency','eur'],['mode','subscription'],['client_reference_id','another-player']]){
  const order=valid();order[field]=value;assert.throws(()=>s.nfCheckPurchase(order,link,'player1','buyer@example.com'));
 }
 const order=valid();order.line_items.data[0].quantity=2;assert.throws(()=>s.nfCheckPurchase(order,link,'player1','buyer@example.com'));
 assert.throws(()=>s.nfCheckPurchase(valid(),{url:'https://buy.stripe.com/unrelated'},'player1','buyer@example.com'));
 assert.throws(()=>s.nfCheckPurchase(valid(),link,'player1','other@example.com'));
});
test('Return URL flags cannot create an entitlement',()=>{
 assert.throws(()=>s.nfVerifyCheckout('player1','coins_50'),/invalid_session/);
 assert.throws(()=>s.nfVerifyCheckout('player1','vip_year'),/invalid_session/);
});

test('Round retries are idempotent and a sixth paid start is blocked at zero',()=>{
 const ledger=[['welcome:buyer','buyer','welcome',5,'','','']];
 const sandbox={};vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8'),sandbox);
 sandbox.nfRows=()=>ledger;
 sandbox.nfSheet=()=>({appendRow:r=>ledger.push(r)});
 sandbox.nfWallet=()=>({coins:ledger.reduce((n,r)=>n+r[3],0),is_vip:false});
 for(let i=0;i<5;i++){const op=`00000000-0000-4000-8000-00000000000${i}`;sandbox.nfStart('buyer',op);assert.equal(sandbox.nfStart('buyer',op).already_processed,true);}
 assert.equal(sandbox.nfWallet().coins,0);
 assert.throws(()=>sandbox.nfStart('buyer','00000000-0000-4000-8000-000000000009'),/insufficient_coins/);
 assert.equal(ledger.length,6);
});
