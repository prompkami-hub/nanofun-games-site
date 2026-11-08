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

function accountBackend(){
 const tables={Players:[],Ledger:[]},properties=new Map(),cache=new Map();let sequence=0,day='20261107';
 const box={PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},Utilities:{getUuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,formatDate:()=>day},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})}};
 vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8'),box);
 box.nfLocked=fn=>fn();box.nfHash=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');box.nfToken=id=>'signed:'+id;box.nfAuthenticate=t=>{if(!t?.startsWith('signed:'))throw Error('login_required');return t.slice(7);};
 box.nfRows=name=>tables[name];box.nfSheet=name=>({appendRow:r=>tables[name].push(r),getRange:(row,column)=>({setValue:v=>tables[name][row-2][column-1]=v,setValues:values=>values[0].forEach((v,i)=>tables[name][row-2][column-1+i]=v)})});
 return {s:box,tables,nextDay:()=>day='20261108',login(email,token){cache.set('otp:'+box.nfHash(email),JSON.stringify({hash:box.nfHash('123456'),attempts:0,expires:Date.now()+10000}));return box.nfLogin(email,'123456',token);}};
}
test('Guest refresh does not refill, and email upgrade carries unspent coins only once',()=>{
 const b=accountBackend(),id='00000000-0000-4000-8000-000000000099',g=b.s.nfGuest(id);
 b.s.nfStart(g.wallet.player_id,'00000000-0000-4000-8000-000000000001');b.s.nfStart(g.wallet.player_id,'00000000-0000-4000-8000-000000000002');assert.equal(b.s.nfGuest(id).wallet.coins,3);
 const a=b.login('buyer@example.com',g.token);assert.equal(a.wallet.coins,3);assert.equal(a.wallet.kind,'email');assert.throws(()=>b.s.nfGuest(id),/login_required/);
 const another=b.s.nfGuest('00000000-0000-4000-8000-000000000088');assert.equal(b.login('buyer@example.com',another.token).wallet.coins,3,'fresh guests cannot refill an existing email');assert.equal(b.tables.Ledger.filter(r=>r[0].startsWith('welcome:')).length,1);
});
test('Daily energy needs verified email, grants once per LA day, and never enables checkout',()=>{
 const b=accountBackend(),g=b.s.nfGuest('00000000-0000-4000-8000-000000000099');assert.throws(()=>b.s.nfDaily(g.wallet.player_id),/verified_email_required/);
 const a=b.login('buyer@example.com',g.token);assert.equal(b.s.nfDaily(a.wallet.player_id).wallet.coins,15);assert.equal(b.s.nfDaily(a.wallet.player_id).wallet.coins,15);b.nextDay();assert.equal(b.s.nfDaily(a.wallet.player_id).wallet.coins,25);assert.equal(b.s.nfWallet(a.wallet.player_id).checkout_ready.coins_50,false);
});
