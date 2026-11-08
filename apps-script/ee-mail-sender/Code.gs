/* Deploy separately from the ee Google account. No wallet/Stripe access. */
const EE_SENDER='superpowergames.us@gmail.com';
function eeJson(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function eeOwner(){if(Session.getEffectiveUser().getEmail().toLowerCase()!==EE_SENDER)throw Error('wrong_sender');}
function eeHash(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>(b+256).toString(16).slice(-2)).join('');}
function eeSignature(value,secret){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,secret)).replace(/=+$/,'');}
function eeEqual(a,b){let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
function verifyEeSenderAccess(){eeOwner();console.log(JSON.stringify({sender:EE_SENDER,quota:MailApp.getRemainingDailyQuota(),mail_sent:false,secret_created:false}));}
// The owner must run this initialization personally; the secret is never logged.
function initializeEeMailSender(){
  eeOwner();const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('MAIL_RELAY_SECRET'))props.setProperty('MAIL_RELAY_SECRET',Utilities.getUuid()+Utilities.getUuid());
  console.log(JSON.stringify({sender:EE_SENDER,initialized:true,quota:MailApp.getRemainingDailyQuota(),secret_logged:false}));
}
function doGet(){return eeJson({service:'nanofun-brand-mail',sender:EE_SENDER,anonymous_send:false});}
function eeValidate(p,secret){
  if(typeof secret!=='string'||secret.length<32)throw Error('not_configured');
  if(!Number.isSafeInteger(p.at)||Math.abs(Date.now()-p.at)>120000||!/^[0-9a-f-]{36}$/.test(p.nonce||'')||typeof p.payload!=='string'||p.payload.length>48000||typeof p.signature!=='string'||p.signature.length>100)throw Error('invalid_request');
  if(!eeEqual(eeSignature(p.at+'\n'+p.nonce+'\n'+p.payload,secret),p.signature))throw Error('unauthorized');
  const m=JSON.parse(p.payload);
  if(!/^(login|receipt|probe):[a-zA-Z0-9:_-]{8,180}$/.test(m.operation||'')||typeof m.to!=='string'||m.to.length>254||!/^\S+@[^\s@,;]+\.[^\s@,;]+$/.test(m.to)||/[\r\n]/.test(m.to)||typeof m.subject!=='string'||m.subject.length>240||/[\r\n]/.test(m.subject)||typeof m.body!=='string'||m.body.length>16000||m.htmlBody!==undefined&&(typeof m.htmlBody!=='string'||m.htmlBody.length>32000))throw Error('invalid_message');
  if(m.operation.startsWith('probe:')&&m.to!==EE_SENDER)throw Error('invalid_probe');
  return m;
}
function doPost(e){
  let claimed=false;
  try{
    eeOwner();const raw=e?.postData?.contents;if(typeof raw!=='string'||raw.length>64000)throw Error('invalid_request');
    const props=PropertiesService.getScriptProperties(),m=eeValidate(JSON.parse(raw),props.getProperty('MAIL_RELAY_SECRET'));
    const key='mail:'+eeHash(m.operation),digest=eeHash(JSON.stringify(m)),lock=LockService.getScriptLock();let held=false,previous;
    try{
      lock.waitLock(10000);held=true;
      // Only hashes/state/timestamps are retained; never recipients, OTPs or bodies.
      const all=props.getProperties();Object.keys(all).filter(k=>k.startsWith('mail:')).forEach(k=>{try{const r=JSON.parse(all[k]);if(r.state==='sent'&&Date.now()-r.at>7*86400000)props.deleteProperty(k);}catch(_){}});
      previous=props.getProperty(key);if(previous){const r=JSON.parse(previous);if(r.digest!==digest)throw Error('operation_conflict');return eeJson({ok:r.state==='sent',status:r.state==='sent'?'already_sent':'delivery_unknown',sender:EE_SENDER});}
      if(MailApp.getRemainingDailyQuota()<1)return eeJson({ok:false,status:'quota_exhausted',not_sent:true});
      props.setProperty(key,JSON.stringify({digest,state:'sending',at:Date.now()}));
      claimed=true;
    }finally{if(held)lock.releaseLock();}
    try{
      MailApp.sendEmail({to:m.to,subject:m.subject,body:m.body,...(m.htmlBody?{htmlBody:m.htmlBody}:{}),name:'NanoFun Games',replyTo:EE_SENDER});
      props.setProperty(key,JSON.stringify({digest,state:'sent',at:Date.now()}));
      return eeJson({ok:true,status:'sent',sender:EE_SENDER});
    }catch(_){props.setProperty(key,JSON.stringify({digest,state:'delivery_unknown',at:Date.now()}));return eeJson({ok:false,status:'delivery_unknown'});}
  }catch(err){return eeJson({ok:false,status:claimed?'delivery_unknown':/^[a-z_]+$/.test(err.message)?err.message:'request_failed',not_sent:!claimed});}
}
