const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{test}=require('node:test'),assert=require('node:assert/strict');
function harness(){
 const rows=[],sent=[],props=new Map([['RECEIPT_OUTBOX_READY','true'],['RECEIPT_EMAIL_SINCE','1700000000']]);let quota=100,failSend=false,failSentWrite=false;
 const b={console:{log(){},warn(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{if(failSend)throw Error('network_unknown');sent.push(m);}}};
 vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8'),b);b.nfLocked=fn=>fn();b.nfHash=s=>crypto.createHash('sha256').update(s).digest('hex');b.nfRows=()=>[['nf_buyer','buyer@example.com','active']];b.nfReceiptRows=()=>rows.map(r=>r.slice());
 b.nfSheet=()=>({appendRow:r=>rows.push(r),getRange:(row)=>({setValues:values=>{if(failSentWrite&&values[0][4]==='sent')throw Error('sheet_unavailable');rows[row-2]=values[0].slice();}})});
 return {b,rows,sent,props,quota:v=>quota=v,failSend:()=>failSend=true,failSentWrite:()=>failSentWrite=true};
}
const coin=()=>({key:'checkout:cs_live_example',playerId:'nf_buyer',email:'buyer@example.com',orderId:'cs_live_example',kind:'coins_50',amountCents:99,paidAt:1794108000,coinsCredited:50});
function payload(kind='coins_50'){return {...coin(),reference:'NF-20261107-ABCDEF123456',currency:'usd',kind,vipUntil:1825644000000};}
test('English receipt names the exact product, verified amount, entitlement and support without marketing or private access tokens',()=>{
 const b=harness().b,c=b.nfRenderReceipt(payload());assert.match(c.subject,/50 Coins Pack/);assert.match(c.body,/Quantity: 1/);assert.match(c.body,/\$0\.99 USD/);assert.match(c.body,/One-time purchase/);assert.match(c.body,/Restore purchases/);assert.match(c.htmlBody,/https:\/\/nanofungames.com\//);assert.ok(!c.htmlBody.includes('{{'));assert.ok(!/AUTH_SECRET|signed:|Bearer |api\.stripe/.test(c.body+c.htmlBody));
 const vip=payload('vip_renewal');vip.amountCents=999;const v=b.nfRenderReceipt(vip);assert.match(v.subject,/renewal confirmation/);assert.match(v.body,/\$9\.99 USD per year/);assert.match(v.body,/renews annually until canceled/);assert.match(v.body,/2027-/);
});
test('Template rejects unverified values and off-domain receipt links; source HTML matches compiled Apps Script template',()=>{
 const b=harness().b;assert.throws(()=>b.nfRenderReceipt({...payload(),amountCents:0}),/invalid_receipt/);assert.throws(()=>b.nfRenderReceipt({...payload(),receiptUrl:'https://pay.stripe.com.evil.example/receipt'}),/invalid_receipt_link/);assert.throws(()=>b.nfRenderReceipt({...payload(),orderId:'<script>'}),/invalid_receipt_payload/);assert.equal(b.nfEscapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
 const template=vm.runInNewContext(fs.readFileSync('apps-script/Code.gs','utf8')+'\nNF_RECEIPT_HTML');assert.equal(template,fs.readFileSync('apps-script/templates/purchase_receipt.html','utf8'));
});
test('Outbox queues once per paid order; no receipt is sent until sending is explicitly enabled',()=>{
 const h=harness();assert.equal(h.b.nfTryQueueReceipt(coin()),'queued');assert.equal(h.b.nfTryQueueReceipt(coin()),'queued');assert.equal(h.rows.length,1);assert.equal(h.b.processNanoFunReceiptOutbox().disabled,true);assert.equal(h.sent.length,0);
 h.props.set('RECEIPT_EMAIL_ENABLED','true');assert.equal(h.b.processNanoFunReceiptOutbox().sent,1);assert.equal(h.sent.length,1);assert.equal(h.sent[0].to,'buyer@example.com');assert.equal(h.sent[0].name,'NanoFun Games');assert.equal(h.rows[0][4],'sent');assert.equal(h.b.processNanoFunReceiptOutbox().sent,0);assert.equal(h.sent.length,1);
});
test('Renewal deduplicates by invoice, independent of repeated checkout reconciliation; a new paid invoice gets one new receipt',()=>{
 const h=harness(),info={...coin(),kind:'vip_renewal',amountCents:999,vipUntil:1825644000000,key:'invoice:in_first'};h.b.nfTryQueueReceipt(info);h.b.nfTryQueueReceipt(info);h.b.nfTryQueueReceipt({...info,key:'invoice:in_second',paidAt:1825644000,vipUntil:1857180000000});assert.equal(h.rows.length,2);
});
test('Historical orders and unmatched recipients are not mailed; quota exhaustion retains a queued receipt for the next run',()=>{
 const h=harness();assert.equal(h.b.nfTryQueueReceipt({...coin(),paidAt:1600000000}),'historical_skipped');assert.equal(h.b.nfTryQueueReceipt({...coin(),email:'another@example.com'}),'queue_needs_review');assert.equal(h.rows.length,0);h.b.nfTryQueueReceipt(coin());h.props.set('RECEIPT_EMAIL_ENABLED','true');h.quota(0);assert.equal(h.b.processNanoFunReceiptOutbox().pending,1);assert.equal(h.rows[0][4],'queued');assert.equal(h.sent.length,0);h.quota(1);assert.equal(h.b.processNanoFunReceiptOutbox().sent,1);
});
test('Uncertain send and post-send persistence failures are held for reconciliation, never automatically resent',()=>{
 for(const fail of ['failSend','failSentWrite']){const h=harness();h.b.nfTryQueueReceipt(coin());h.props.set('RECEIPT_EMAIL_ENABLED','true');h[fail]();assert.equal(h.b.processNanoFunReceiptOutbox().delivery_unknown,1);assert.equal(h.rows[0][4],'delivery_unknown');const count=h.sent.length;assert.equal(h.b.processNanoFunReceiptOutbox().delivery_unknown,1);assert.equal(h.sent.length,count);}
 const h=harness();h.b.nfTryQueueReceipt(coin());h.rows[0][4]='sending';h.rows[0][8]=new Date(Date.now()-700000).toISOString();h.props.set('RECEIPT_EMAIL_ENABLED','true');h.b.processNanoFunReceiptOutbox();assert.equal(h.rows[0][4],'delivery_unknown');assert.equal(h.sent.length,0);
});
