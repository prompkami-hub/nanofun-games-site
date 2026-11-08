const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{test}=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('apps-script/ee-mail-sender/Code.gs','utf8');
function harness(){
 const props=new Map([['MAIL_RELAY_SECRET','unit-test-only-not-a-live-mail-credential']]),sent=[];let owner='superpowergames.us@gmail.com',quota=100,fail=false;
 const b={console:{log(){}},Session:{getEffectiveUser:()=>({getEmail:()=>owner})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:m=>{if(fail)throw Error('unknown');sent.push(m);}},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
 vm.runInNewContext(source,b);b.eeHash=s=>crypto.createHash('sha256').update(s).digest('hex');b.eeSignature=(s,k)=>crypto.createHmac('sha256',k).update(s).digest('base64url');
 const envelope=(extra={})=>{const p={at:Date.now(),nonce:'11111111-1111-4111-8111-111111111111',payload:JSON.stringify({operation:'receipt:unit_test_order',to:'buyer@example.com',subject:'NanoFun purchase confirmation',body:'A verified purchase',...extra})};p.signature=b.eeSignature(p.at+'\n'+p.nonce+'\n'+p.payload,props.get('MAIL_RELAY_SECRET'));return {postData:{contents:JSON.stringify(p)}};};
 return {b,props,sent,envelope,owner:v=>owner=v,quota:v=>quota=v,fail:()=>fail=true};
}
test('Brand relay requires the exact ee execution identity and a fresh authenticated envelope',()=>{
 const h=harness();h.owner('other@example.com');assert.equal(h.b.doPost(h.envelope()).status,'wrong_sender');assert.equal(h.sent.length,0);h.owner('superpowergames.us@gmail.com');let e=h.envelope();const p=JSON.parse(e.postData.contents);p.payload=p.payload.replace('buyer@example.com','attacker@example.com');e.postData.contents=JSON.stringify(p);assert.equal(h.b.doPost(e).status,'unauthorized');p.at=1;e.postData.contents=JSON.stringify(p);assert.equal(h.b.doPost(e).status,'invalid_request');assert.equal(h.sent.length,0);
});
test('Relay sends once with brand Reply-To, rejects changed payloads and retains ambiguous sends',()=>{
 const h=harness();assert.equal(h.b.doPost(h.envelope()).ok,true);assert.equal(h.b.doPost(h.envelope()).status,'already_sent');assert.equal(h.sent.length,1);assert.equal(h.sent[0].replyTo,'superpowergames.us@gmail.com');assert.equal(h.b.doPost(h.envelope({body:'different'})).status,'operation_conflict');
 const f=harness();f.fail();assert.equal(f.b.doPost(f.envelope()).status,'delivery_unknown');assert.equal(f.b.doPost(f.envelope()).status,'delivery_unknown');assert.equal(f.sent.length,0);assert.ok(![...h.props.values()].some(v=>String(v).includes('buyer@example.com')));
});
test('Quota exhaustion is explicitly not-sent, so a later retry can deliver',()=>{
 const h=harness();h.quota(0);const r=h.b.doPost(h.envelope());assert.equal(r.not_sent,true);assert.equal(r.status,'quota_exhausted');h.quota(1);assert.equal(h.b.doPost(h.envelope()).ok,true);assert.equal(h.sent.length,1);
});
