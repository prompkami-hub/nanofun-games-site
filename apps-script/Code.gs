/* NanoFun: private Google Sheet + Apps Script, no external server.
 * Secrets live only in Script Properties. Run setup once as the Sheet owner.
 * Public API never accepts balances, VIP flags or nanofun_reward as proof.
 */
const NF_SHEET_ID = '1SChQqOESMElH1Ikvo9zRexxySpbaL4X3hoSQLquI_UA';
const NF_HEADERS = {
  Players: ['PlayerId','Email','Status','Coins','VipExpiresAt','StripeCustomerId','StripeSubscriptionId','UpdatedAt'],
  Ledger: ['OperationId','PlayerId','Kind','CoinDelta','VipExpiresAt','StripeSessionId','CreatedAt']
};
const NF_PLANS = {
  coins_50: {url:'https://buy.stripe.com/aFa9AS48v0vD4q72jMf7i02',amount:99,mode:'payment',coins:50},
  vip_year: {url:'https://buy.stripe.com/cNi28q34r92909Re2uf7i03',amount:999,mode:'subscription',coins:0}
};
function setup() {
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('AUTH_SECRET'))props.setProperty('AUTH_SECRET',Utilities.getUuid()+Utilities.getUuid());
  const book=SpreadsheetApp.openById(NF_SHEET_ID);
  Object.keys(NF_HEADERS).forEach(name=>{
    const s=book.getSheetByName(name);
    if(!s||JSON.stringify(s.getRange(1,1,1,NF_HEADERS[name].length).getValues()[0])!==JSON.stringify(NF_HEADERS[name]))throw Error('schema_mismatch');
  });
}
function nfJson(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return nfJson({service:'nanofun-wallet',schema:1,paid_enabled:false,ads_enabled:false});}
function doPost(e){
  try {
    const raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>8192)throw Error('invalid_request');
    const p=JSON.parse(raw);
    if(p.action==='request_login')return nfJson(nfRequestLogin(p.email));
    if(p.action==='login')return nfJson(nfLogin(p.email,p.code));
    const id=nfAuthenticate(p.token);
    if(p.action==='wallet')return nfJson(nfLocked(()=>nfWallet(id)));
    if(p.action==='start')return nfJson(nfLocked(()=>nfStart(id,p.operation_id)));
    if(p.action==='verify_checkout')return nfJson(nfVerifyCheckout(id,p.session_id));
    throw Error('unknown_action');
  }catch(err){return nfJson({ok:false,error:/^[a-z_]+$/.test(err.message)?err.message:'request_failed'});}
}
function nfLocked(fn){const l=LockService.getScriptLock();l.waitLock(10000);try{return fn();}finally{l.releaseLock();}}
function nfSheet(name){return SpreadsheetApp.openById(NF_SHEET_ID).getSheetByName(name);}
function nfRows(name){const s=nfSheet(name);return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,NF_HEADERS[name].length).getValues();}
function nfEmail(value){const s=String(value||'').trim().toLowerCase();if(s.length>254||/^[=+@-]/.test(s)||!/^\S+@[^\s@]+\.[^\s@]+$/.test(s))throw Error('invalid_email');return s;}
function nfHash(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(b=>(b+256).toString(16).slice(-2)).join('');}
function nfB64(bytes){return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');}
function nfMac(s){const secret=PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');if(!secret)throw Error('not_configured');return nfB64(Utilities.computeHmacSha256Signature(s,secret));}
function nfToken(id){const p=nfB64(JSON.stringify({id,expires:Date.now()+7*86400000}));return p+'.'+nfMac(p);}
function nfAuthenticate(token){
  const parts=String(token||'').split('.');if(parts.length!==2)throw Error('login_required');
  const expected=nfMac(parts[0]);let mismatch=expected.length^parts[1].length;
  for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^(parts[1].charCodeAt(i)||0);
  if(mismatch)throw Error('login_required');
  const p=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if(!/^nf_[0-9a-f-]{36}$/.test(p.id)||!Number.isFinite(p.expires)||p.expires<Date.now())throw Error('login_required');
  return p.id;
}
function nfRequestLogin(value){
  const email=nfEmail(value),cache=CacheService.getScriptCache(),key='otp:'+nfHash(email);
  return nfLocked(()=>{
    if(cache.get(key+':cooldown'))throw Error('try_later');
    const day=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyyMMdd'),budget='otp_budget:'+day;
    const props=PropertiesService.getScriptProperties(),count=Number(props.getProperty(budget)||0);
    if(count>=50||MailApp.getRemainingDailyQuota()<1)throw Error('try_later');
    const code=String(parseInt(Utilities.getUuid().replace(/-/g,'').slice(0,8),16)%1000000).padStart(6,'0');
    cache.put(key,JSON.stringify({hash:nfHash(code),attempts:0,expires:Date.now()+600000}),600);cache.put(key+':cooldown','1',60);
    props.setProperty(budget,String(count+1));
    MailApp.sendEmail({to:email,subject:'NanoFun sign-in code',body:'Your NanoFun sign-in code is '+code+'. It expires in 10 minutes. If you did not request this, ignore this email.'});
    return {ok:true,status:'code_sent'};
  });
}
function nfLogin(value,code){
  const email=nfEmail(value),cache=CacheService.getScriptCache(),key='otp:'+nfHash(email);
  return nfLocked(()=>{
    const raw=cache.get(key);if(!raw)throw Error('code_expired');const entry=JSON.parse(raw);
    if(entry.attempts>=5||entry.expires<Date.now()){cache.remove(key);throw Error('code_expired');}
    if(!/^\d{6}$/.test(String(code))||nfHash(String(code))!==entry.hash){entry.attempts++;cache.put(key,JSON.stringify(entry),600);throw Error('invalid_code');}
    cache.remove(key);
    let row=nfRows('Players').find(r=>r[1]===email);
    if(!row){row=['nf_'+Utilities.getUuid(),email,'active',0,'','','',new Date().toISOString()];nfSheet('Players').appendRow(row);}
    // The ledger is authoritative; a retry repairs the cached Players columns.
    nfAppend('welcome:'+nfHash(email),row[0],'welcome',5,'','');
    return {ok:true,token:nfToken(row[0]),wallet:nfWallet(row[0])};
  });
}
function nfAppend(operation,id,kind,coins,vip,session){
  const existing=nfRows('Ledger').find(r=>r[0]===operation);
  if(existing){if(existing[1]!==id)throw Error('order_already_used');return false;}
  nfSheet('Ledger').appendRow([operation,id,kind,coins,vip||'',session||'',new Date().toISOString()]);
  return true;
}
function nfWallet(id){
  const players=nfRows('Players'),index=players.findIndex(r=>r[0]===id);
  if(index<0||players[index][2]!=='active')throw Error('account_unavailable');
  const entries=nfRows('Ledger').filter(r=>r[1]===id);
  const coins=entries.reduce((n,r)=>n+Number(r[3]||0),0);
  if(!Number.isSafeInteger(coins)||coins<0)throw Error('ledger_needs_review');
  const until=entries.reduce((n,r)=>Math.max(n,Date.parse(r[4])||0),0);
  nfSheet('Players').getRange(index+2,4,1,2).setValues([[coins,until?new Date(until).toISOString():'']]);
  nfSheet('Players').getRange(index+2,8).setValue(new Date().toISOString());
  const properties=PropertiesService.getScriptProperties();
  const coinReady=properties.getProperty('COIN_CHECKOUT_ENABLED')==='true'&&!!properties.getProperty('STRIPE_READ_KEY');
  return {ok:true,player_id:id,coins,vip_expires_at:until||null,is_vip:until>Date.now(),paid_enabled:coinReady,checkout_ready:{coins_50:coinReady,vip_year:false},ads_enabled:false};
}
function nfStart(id,operation){
  if(!/^[0-9a-f-]{36}$/.test(String(operation||'')))throw Error('invalid_operation');
  const op='start:'+operation,previous=nfRows('Ledger').find(r=>r[0]===op);
  if(previous){if(previous[1]!==id)throw Error('invalid_operation');return {ok:true,already_processed:true,wallet:nfWallet(id)};}
  const wallet=nfWallet(id);if(!wallet.is_vip&&wallet.coins<1)throw Error('insufficient_coins');
  nfAppend(op,id,wallet.is_vip?'vip_start':'coin_start',wallet.is_vip?0:-1,'','');
  return {ok:true,wallet:nfWallet(id)};
}
function nfStripe(path){
  const key=PropertiesService.getScriptProperties().getProperty('STRIPE_READ_KEY');
  if(!key)throw Error('stripe_not_configured');
  const r=UrlFetchApp.fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+key},muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw Error('stripe_unavailable');return JSON.parse(r.getContentText());
}
function nfCheckPurchase(session,link,id,email){
  const plan=Object.keys(NF_PLANS).find(k=>NF_PLANS[k].url===link.url),p=NF_PLANS[plan];
  if(!p||session.status!=='complete'||session.payment_status!=='paid'||session.mode!==p.mode||session.currency!=='usd'||session.amount_total!==p.amount)throw Error('payment_not_verified');
  if(session.client_reference_id!==id||nfEmail(session.customer_details&&session.customer_details.email)!==email)throw Error('order_owner_mismatch');
  const items=session.line_items&&session.line_items.data;
  if(!items||items.length!==1||session.line_items.has_more||items[0].quantity!==1||items[0].price.unit_amount!==p.amount||items[0].price.currency!=='usd')throw Error('payment_not_verified');
  return plan;
}
function nfVerifyCheckout(id,sessionId){
  if(!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(String(sessionId||'')))throw Error('invalid_session');
  const row=nfRows('Players').find(r=>r[0]===id);if(!row||row[2]!=='active')throw Error('account_unavailable');
  const session=nfStripe('checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items&expand[]=subscription.latest_invoice');
  const linkId=typeof session.payment_link==='string'?session.payment_link:session.payment_link&&session.payment_link.id;
  if(!/^plink_[a-zA-Z0-9]+$/.test(String(linkId||'')))throw Error('payment_not_verified');
  const link=nfStripe('payment_links/'+linkId),plan=nfCheckPurchase(session,link,id,row[1]);
  // VIP remains disabled until subscription renewals/refunds/reconciliation are wired.
  if(plan==='vip_year')throw Error('vip_reconciliation_not_ready');
  if(PropertiesService.getScriptProperties().getProperty('COIN_CHECKOUT_ENABLED')!=='true')throw Error('checkout_not_enabled');
  return nfLocked(()=>{nfWallet(id);nfAppend('stripe:'+session.id,id,plan,50,'',session.id);return {ok:true,wallet:nfWallet(id)};});
}
