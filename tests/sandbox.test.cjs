const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const code=fs.readFileSync('apps-script/AdminChecks.gs','utf8');
test('Sandbox diagnostics reject live credentials and live objects, never print secrets',()=>{
 let key='rk_live_fake';const logs=[],calls=[];
 const b={console:{log:v=>logs.push(v)},PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='STRIPE_TEST_READ_KEY'?key:n==='BILLING_TEST_EMAIL'?'__awaiting_sandbox_acceptance__':n==='SANDBOX_RECIPIENT_EMAIL'?'superpowergames.us@gmail.com':null})},UrlFetchApp:{fetch:(url)=>{calls.push(url);return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({object:'list',data:[{livemode:false}]})};}}};vm.runInNewContext(code,b);
 assert.throws(()=>b.verifyNanoFunSandboxConnection(),/sandbox_read_key/);assert.equal(calls.length,0);key='rk_test_fake';assert.equal(b.verifyNanoFunSandboxConnection().complete,true);assert.equal(calls.length,9);assert.ok(!logs.join('').includes(key));b.UrlFetchApp.fetch=()=>({getResponseCode:()=>200,getContentText:()=>'{"object":"charge","livemode":true}'});assert.throws(()=>b.nfSandboxGet('charges/ch_fake'),/sandbox_mode/);
});
test('Sandbox acceptance writes only its isolated table and reruns cannot duplicate test coins',()=>{
 const rows=[['TestOrderId','Kind','TestCoins','TestVipUntil','TestReceiptState','PayloadJson','UpdatedAt']];
 const sheet={getLastRow:()=>rows.length,getRange:(r,c,n=1,m=1)=>({getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+m))}),appendRow:r=>rows.push(r)};
 const b={console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:n=>n==='BILLING_TEST_EMAIL'?'__awaiting_sandbox_acceptance__':n==='SANDBOX_RECIPIENT_EMAIL'?'superpowergames.us@gmail.com':null,setProperty(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>{assert.equal(n,'SandboxAcceptance');return sheet;}})}};
 vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8')+'\n'+code,b);b.nfLocked=f=>f();b.nfHash=()=> 'abcdef0123456789';b.nfRenderReceipt=()=>({});b.nfSandboxCharge=()=>({paid:true,captured:true,currency:'usd',amount:99,amount_refunded:0,created:1794112000});
 const s={id:'cs_test_mock',status:'complete',payment_status:'paid',client_reference_id:'nf_sandbox_acceptance',customer_details:{email:'superpowergames.us@gmail.com'},payment_link:'plink_1UZNr3CvKtvzDSIbfoBoo8bp',currency:'usd',amount_total:99,mode:'payment',payment_intent:'pi_mock',line_items:{data:[{quantity:1,price:{id:'price_1UZNpyCvKtvzDSIbvKUJbBel',unit_amount:99,currency:'usd'}}],has_more:false}};
 b.nfSandboxGet=p=>p.startsWith('checkout/sessions/')?s:{data:p.includes('plink_1UZNr3')?[s]:[],has_more:false};
 assert.equal(b.runNanoFunSandboxAcceptance().test_coin_balance,50);assert.equal(b.runNanoFunSandboxAcceptance().added,0);assert.equal(rows.length,2);s.customer_details.email='other@example.com';assert.throws(()=>b.runNanoFunSandboxAcceptance(),/order_not_verified/);
});
