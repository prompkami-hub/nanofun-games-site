const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
function harness(){const b={};vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8'),b);return b;}
const charge=()=>({paid:true,captured:true,currency:'usd',amount:99,amount_refunded:0});
const disputes=()=>({data:[],has_more:false});
test('Coin entitlement responds to partial/full refunds and dispute outcomes',()=>{
 const b=harness(),c=charge(),d=disputes();assert.equal(b.nfCoinTarget(c,d),50);c.amount_refunded=50;assert.equal(b.nfCoinTarget(c,d),24);c.amount_refunded=99;assert.equal(b.nfCoinTarget(c,d),0);c.amount_refunded=0;d.data=[{status:'needs_response'}];assert.equal(b.nfCoinTarget(c,d),0);d.data=[{status:'lost'}];assert.equal(b.nfCoinTarget(c,d),0);d.data=[{status:'won'}];assert.equal(b.nfCoinTarget(c,d),50);d.has_more=true;assert.throws(()=>b.nfCoinTarget(c,d),/coverage/);c.amount=100;assert.throws(()=>b.nfCoinTarget(c,disputes()),/not_verified/);
});
function vip(){return {id:'sub_example',customer:'cus_example',status:'active',cancel_at_period_end:false,items:{has_more:false,data:[{quantity:1,current_period_end:1900000000,price:{id:'price_year',currency:'usd',unit_amount:999,recurring:{interval:'year',interval_count:1}}}]}};}
function invoice(){return {status:'paid',currency:'usd',amount_paid:999,total:999,customer:'cus_example',parent:{subscription_details:{subscription:'sub_example'}}};}
const vipCharge=()=>({...charge(),amount:999});
test('Annual VIP uses paid Stripe period; scheduled cancellation retains it, deletion/payment failure/refund revokes',()=>{
 const b=harness(),s=vip(),i=invoice(),c=vipCharge();const until=()=>b.nfVipUntil(s,i,c,disputes(),'price_year');assert.equal(until(),1900000000000);s.cancel_at_period_end=true;assert.equal(until(),1900000000000);s.items.data[0].current_period_end+=31536000;assert.equal(until(),1931536000000);s.status='canceled';assert.equal(until(),0);s.status='past_due';assert.equal(until(),0);s.status='active';i.status='open';assert.equal(until(),0);i.status='paid';c.amount_refunded=1;assert.equal(until(),0);c.amount_refunded=0;s.items.data[0].price.recurring.interval='month';assert.throws(until,/payment_not_verified/);
});
test('VIP cannot use another customer, subscription, price or unverified invoice',()=>{
 const b=harness();for(const edit of [i=>i.customer='cus_wrong',i=>i.parent.subscription_details.subscription='sub_wrong',i=>i.amount_paid=0]){const i=invoice();edit(i);assert.equal(b.nfVipUntil(vip(),i,vipCharge(),disputes(),'price_year'),0);}assert.throws(()=>b.nfVipUntil(vip(),invoice(),vipCharge(),disputes(),'price_wrong'),/not_verified/);
});
test('A later VIP revocation supersedes an earlier future grant; spent refunds do not create spendable negative coins',()=>{
 const b=harness(),players=[['nf_test','test@example.com','active',0,'','','','']],ledger=[['a','nf_test','coins_50',50,'','cs_a',''],['spent','nf_test','coin_start',-30,'','',''],['refund','nf_test','coin_adjustment',-50,'','cs_a',''],['vip','nf_test','vip_state',0,'2030-01-01T00:00:00.000Z','cs_v',''],['revoke','nf_test','vip_state',0,'1970-01-01T00:00:00.000Z','cs_v','']];
 b.nfRows=name=>name==='Players'?players:ledger;b.nfSheet=()=>({getRange:()=>({setValue(){},setValues(){}})});b.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};b.Utilities={formatDate:()=> '20261107'};const w=b.nfWallet('nf_test');assert.equal(w.coins,0);assert.equal(w.coin_adjustment_pending,30);assert.equal(w.is_vip,false);assert.equal(w.vip_expires_at,null);
});
test('Test-mode objects cannot fulfill live site purchases',()=>{assert.throws(()=>harness().nfLive({livemode:false}),/live_object_required/);});
test('Paid pack fulfillment and refund reconciliation are idempotent and bound to the exact NanoFun link and player',()=>{
 const b=harness(),players=[['nf_buyer','buyer@example.com','active',0,'','','','']],ledger=[];
 const session={id:'cs_live_example',livemode:true,status:'complete',payment_status:'paid',mode:'payment',currency:'usd',amount_total:99,client_reference_id:'nf_buyer',customer_details:{email:'buyer@example.com'},payment_link:'plink_1UZKbBCvKtvzDSIbCTog2dUn',payment_intent:'pi_example',line_items:{has_more:false,data:[{quantity:1,price:{id:'price_pack',unit_amount:99,currency:'usd'}}]}};
 const c={...charge(),livemode:true,id:'ch_example',payment_intent:'pi_example'};
 b.nfRows=name=>name==='Players'?players:ledger;b.nfSheet=()=>({appendRow:r=>ledger.push(r),getRange:()=>({setValue(){},setValues(){}})});b.nfLocked=fn=>fn();b.PropertiesService={getScriptProperties:()=>({getProperty:()=>null})};b.Utilities={formatDate:()=> '20261107'};
 b.nfStripe=path=>path.startsWith('checkout/sessions/')?session:path.startsWith('payment_links/')?{url:'https://buy.stripe.com/aFa9AS48v0vD4q72jMf7i02'}:path.startsWith('payment_intents/')?{livemode:true,status:'succeeded',currency:'usd',amount_received:99,latest_charge:c}:disputes();
 assert.equal(b.nfFulfillSession(session.id,'nf_buyer').wallet.coins,50);assert.equal(b.nfFulfillSession(session.id,'nf_buyer').wallet.coins,50);assert.equal(ledger.length,1);
 c.amount_refunded=99;assert.equal(b.nfFulfillSession(session.id,'nf_buyer').wallet.coins,0);assert.equal(b.nfFulfillSession(session.id,'nf_buyer').wallet.coins,0);assert.equal(ledger.length,2);
 assert.throws(()=>b.nfFulfillSession(session.id,'nf_other'),/owner_mismatch/);session.payment_link='plink_unrelated';assert.throws(()=>b.nfFulfillSession(session.id,'nf_buyer'),/not_verified/);
});
