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
function doGet(){return nfJson({service:'nanofun-wallet',schema:3,version:'billing-acceptance-3',paid_enabled:PropertiesService.getScriptProperties().getProperty('BILLING_ENABLED')==='true'&&!PropertiesService.getScriptProperties().getProperty('BILLING_TEST_EMAIL'),ads_enabled:false});}
function doPost(e){
  try {
    const raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>8192)throw Error('invalid_request');
    const p=JSON.parse(raw);
    if(p.action==='request_login')return nfJson(nfRequestLogin(p.email));
    if(p.action==='guest')return nfJson(nfGuest(p.device_id));
    if(p.action==='login')return nfJson(nfLogin(p.email,p.code,p.token));
    const id=nfAuthenticate(p.token);
    if(p.action==='wallet'){nfSyncKnownBilling(id);return nfJson(nfLocked(()=>nfWallet(id)));}
    if(p.action==='restore_orders')return nfJson(nfRestoreOrders(id));
    if(p.action==='start'){nfSyncKnownBilling(id);return nfJson(nfLocked(()=>nfStart(id,p.operation_id)));}
    if(p.action==='daily')return nfJson(nfLocked(()=>nfDaily(id)));
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
function nfGuest(device){
  if(!/^[0-9a-f-]{36}$/.test(String(device||'')))throw Error('invalid_device');
  return nfLocked(()=>{
    const identity='guest:'+nfHash(device),rows=nfRows('Players');
    let row=rows.find(r=>r[1]===identity);
    if(row&&row[2]!=='active')throw Error('login_required');
    if(!row){
      const props=PropertiesService.getScriptProperties(),day=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyyMMdd'),key='guest_budget:'+day;
      const count=Number(props.getProperty(key)||0);
      if(count>=500)throw Error('try_later');
      props.setProperty(key,String(count+1));
      row=['nf_'+Utilities.getUuid(),identity,'active',0,'','','',new Date().toISOString()];nfSheet('Players').appendRow(row);
    }
    nfAppend('guest_welcome:'+nfHash(device),row[0],'welcome',5,'','');
    return {ok:true,token:nfToken(row[0]),wallet:nfWallet(row[0])};
  });
}
function nfLogin(value,code,previousToken){
  const email=nfEmail(value),cache=CacheService.getScriptCache(),key='otp:'+nfHash(email);
  return nfLocked(()=>{
    const raw=cache.get(key);if(!raw)throw Error('code_expired');const entry=JSON.parse(raw);
    if(entry.attempts>=5||entry.expires<Date.now()){cache.remove(key);throw Error('code_expired');}
    if(!/^\d{6}$/.test(String(code))||nfHash(String(code))!==entry.hash){entry.attempts++;cache.put(key,JSON.stringify(entry),600);throw Error('invalid_code');}
    cache.remove(key);
    let guest=null;
    if(previousToken){
      try{const oldId=nfAuthenticate(previousToken);guest=nfRows('Players').find(r=>r[0]===oldId&&r[2]==='active'&&String(r[1]).startsWith('guest:'));}catch(err){/* Expired sessions cannot transfer a guest grant. */}
    }
    let row=nfRows('Players').find(r=>r[1]===email);
    if(!row){row=['nf_'+Utilities.getUuid(),email,'active',0,'','','',new Date().toISOString()];nfSheet('Players').appendRow(row);}
    // The ledger is authoritative; a retry repairs the cached Players columns.
    const remaining=guest?nfWallet(guest[0]).coins:5;
    // A verified email receives one welcome grant, carrying only an existing
    // guest's unspent welcome coins; repeated guest logins never refill it.
    nfAppend('welcome:'+nfHash(email),row[0],'welcome',remaining,'','');
    if(guest){
      nfAppend('merge_out:'+guest[0],guest[0],'guest_merge',-remaining,'','');
      const index=nfRows('Players').findIndex(r=>r[0]===guest[0]);
      nfSheet('Players').getRange(index+2,3).setValue('merged');
    }
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
  if(!Number.isSafeInteger(coins))throw Error('ledger_needs_review');
  const vipStates=entries.filter(r=>r[2]==='vip_state');
  const until=vipStates.length?(Date.parse(vipStates[vipStates.length-1][4])||0):0;
  nfSheet('Players').getRange(index+2,4,1,2).setValues([[coins,until?new Date(until).toISOString():'']]);
  nfSheet('Players').getRange(index+2,8).setValue(new Date().toISOString());
  const properties=PropertiesService.getScriptProperties();
  const guest=String(players[index][1]).startsWith('guest:');
  const testEmail=properties.getProperty('BILLING_TEST_EMAIL');
  const coinReady=!guest&&(!testEmail||testEmail===players[index][1])&&properties.getProperty('BILLING_ENABLED')==='true'&&!!properties.getProperty('STRIPE_READ_KEY');
  const vipReady=coinReady&&properties.getProperty('VIP_CHECKOUT_ENABLED')==='true'&&!players[index][6];
  const email=String(players[index][1]),parts=email.split('@');
  const day=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyyMMdd');
  return {ok:true,player_id:id,kind:guest?'guest':'email',email_label:guest?'Guest':parts[0].slice(0,2)+'***@'+parts[1],coins:Math.max(0,coins),coin_adjustment_pending:Math.max(0,-coins),vip_expires_at:until||null,is_vip:until>Date.now(),daily_available:!guest&&!entries.some(r=>r[0]==='daily:'+id+':'+day),paid_enabled:coinReady,checkout_ready:{coins_50:coinReady,vip_year:vipReady},ads_enabled:false};
}
function nfDaily(id){
  const row=nfRows('Players').find(r=>r[0]===id);
  if(!row||String(row[1]).startsWith('guest:'))throw Error('verified_email_required');
  nfWallet(id);
  const day=Utilities.formatDate(new Date(),'America/Los_Angeles','yyyyMMdd');
  nfAppend('daily:'+id+':'+day,id,'daily',10,'','');
  return {ok:true,wallet:nfWallet(id)};
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
  if(PropertiesService.getScriptProperties().getProperty('BILLING_ENABLED')!=='true')throw Error('checkout_not_enabled');
  return nfFulfillSession(sessionId,id);
}

// Read-only diagnostic; never prints credentials or customer/order records.
function verifyStripeConnection() {
  const checks = {};
  const resources = {coins_link:'payment_links/plink_1UZKbBCvKtvzDSIbCTog2dUn',vip_link:'payment_links/plink_1UZKdqCvKtvzDSIbd6DqXejE',sessions:'checkout/sessions?limit=1',events:'events?limit=1',invoices:'invoices?limit=1',subscriptions:'subscriptions?limit=1',charges:'charges?limit=1',disputes:'disputes?limit=1',prices:'prices?limit=1',payment_intents:'payment_intents?limit=1'};
  Object.keys(resources).forEach(name=>{try{const r=nfStripe(resources[name]);checks[name]=name==='coins_link'||name==='vip_link'?{ok:true,url_matches:r.url===NF_PLANS[name==='coins_link'?'coins_50':'vip_year'].url,active:r.active===true}:{ok:true};}catch(e){checks[name]={ok:false,error:e.message};}});
  console.log(JSON.stringify({service:'nanofun-stripe-readonly-check',checks}));
  return checks;
}
// Billing uses only Stripe GET requests. No payouts, refunds or subscription mutations.
const NF_LINKS={coins_50:'plink_1UZKbBCvKtvzDSIbCTog2dUn',vip_year:'plink_1UZKdqCvKtvzDSIbd6DqXejE'};
function nfObjectId(value){return typeof value==='string'?value:value&&value.id;}
function nfLive(value){if(!value||value.livemode!==true)throw Error('live_object_required');return value;}
function nfCoinTarget(charge,disputes){
  if(!charge||charge.paid!==true||charge.captured!==true||charge.currency!=='usd'||charge.amount!==99||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<0||charge.amount_refunded>99)throw Error('payment_not_verified');
  if(disputes.has_more)throw Error('billing_coverage_incomplete');
  if(disputes.data.some(d=>d.status!=='won'))return 0;
  return Math.floor(50*(99-charge.amount_refunded)/99);
}
function nfVipUntil(subscription,invoice,charge,disputes,expectedPrice){
  const items=subscription.items;
  if(!items||items.has_more||items.data.length!==1)throw Error('payment_not_verified');
  const item=items.data[0],price=item.price;
  if(item.quantity!==1||price.id!==expectedPrice||price.currency!=='usd'||price.unit_amount!==999||price.recurring?.interval!=='year'||price.recurring?.interval_count!==1)throw Error('payment_not_verified');
  if(disputes.has_more)throw Error('billing_coverage_incomplete');
  if(subscription.status!=='active'||invoice.status!=='paid'||invoice.currency!=='usd'||invoice.amount_paid!==999||invoice.total!==999||nfObjectId(invoice.customer)!==nfObjectId(subscription.customer)||nfObjectId(invoice.parent?.subscription_details?.subscription||invoice.subscription)!==subscription.id||!charge?.paid||!charge.captured||charge.currency!=='usd'||charge.amount!==999||charge.amount_refunded!==0||disputes.data.some(d=>d.status!=='won'))return 0;
  const end=item.current_period_end||subscription.current_period_end;
  if(!Number.isSafeInteger(end)||end<0)throw Error('payment_not_verified');
  return end*1000;
}
function nfGetCharge(intentId,amount){
  if(!/^pi_[A-Za-z0-9]+$/.test(intentId||''))throw Error('payment_not_verified');
  const intent=nfLive(nfStripe('payment_intents/'+intentId+'?expand[]=latest_charge'));
  if(intent.status!=='succeeded'||intent.amount_received!==amount||intent.currency!=='usd')throw Error('payment_not_verified');
  let charge=intent.latest_charge;if(typeof charge==='string')charge=nfStripe('charges/'+charge);
  nfLive(charge);if(nfObjectId(charge.payment_intent)!==intentId)throw Error('payment_not_verified');
  const disputes=charge.disputed?nfStripe('disputes?charge='+encodeURIComponent(charge.id)+'&limit=100'):{data:[],has_more:false};
  return {charge,disputes};
}
function nfFulfillSession(sessionId,expectedPlayer){
  if(!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId||''))throw Error('invalid_session');
  const session=nfLive(nfStripe('checkout/sessions/'+sessionId+'?expand[]=line_items'));
  const id=session.client_reference_id;
  if(expectedPlayer&&expectedPlayer!==id)throw Error('order_owner_mismatch');
  const row=nfRows('Players').find(r=>r[0]===id&&r[2]==='active'&&!String(r[1]).startsWith('guest:'));
  if(!row)throw Error('order_owner_mismatch');
  const linkId=nfObjectId(session.payment_link),plan=Object.keys(NF_LINKS).find(k=>NF_LINKS[k]===linkId);
  if(!plan)throw Error('payment_not_verified');
  const link=nfStripe('payment_links/'+linkId);nfCheckPurchase(session,link,id,row[1]);
  const boughtPrice=session.line_items.data[0].price.id;
  if(plan==='coins_50'){
    const {charge,disputes}=nfGetCharge(nfObjectId(session.payment_intent),99),target=nfCoinTarget(charge,disputes);
    return nfLocked(()=>{
      nfAppend('stripe:'+session.id,id,'coins_50',50,'',session.id);
      const entries=nfRows('Ledger').filter(r=>r[1]===id&&r[5]===session.id&&(r[2]==='coins_50'||r[2]==='coin_adjustment'));
      const prior=entries.reduce((sum,r)=>sum+Number(r[3]),0);
      if(prior!==target)nfAppend('stripe_adjust:'+session.id+':'+entries.length+':'+target,id,'coin_adjustment',target-prior,'',session.id);
      return {ok:true,plan,wallet:nfWallet(id)};
    });
  }
  const subscription=nfLive(nfStripe('subscriptions/'+nfObjectId(session.subscription)));
  if(nfObjectId(subscription.customer)!==nfObjectId(session.customer))throw Error('order_owner_mismatch');
  const invoice=nfLive(nfStripe('invoices/'+nfObjectId(subscription.latest_invoice)+'?expand[]=payments.data.payment.payment_intent'));
  let until=0;
  if(subscription.status==='active'&&invoice.status==='paid'){
  let intentId=nfObjectId(invoice.payment_intent);
  if(!intentId){if(invoice.payments?.has_more)throw Error('billing_coverage_incomplete');const payments=(invoice.payments?.data||[]).filter(p=>p.status==='paid');if(payments.length!==1)throw Error('payment_not_verified');intentId=nfObjectId(payments[0].payment?.payment_intent);}
  const {charge,disputes}=nfGetCharge(intentId,999);until=nfVipUntil(subscription,invoice,charge,disputes,boughtPrice);
  }else{nfVipUntil(subscription,invoice,null,{data:[],has_more:false},boughtPrice);}
  return nfLocked(()=>{
    const index=nfRows('Players').findIndex(r=>r[0]===id),old=nfRows('Players')[index];
    if(old[6]&&old[6]!==subscription.id)throw Error('multiple_subscriptions_need_review');
    nfSheet('Players').getRange(index+2,6,1,2).setValues([[nfObjectId(session.customer),subscription.id]]);
    const states=nfRows('Ledger').filter(r=>r[1]===id&&r[2]==='vip_state');
    const last=states.length?Date.parse(states[states.length-1][4]):null;
    if(last!==until)nfAppend('vip_state:'+subscription.id+':'+states.length+':'+until,id,'vip_state',0,new Date(until).toISOString(),session.id);
    return {ok:true,plan,wallet:nfWallet(id)};
  });
}
function nfSyncKnownBilling(id){
  const props=PropertiesService.getScriptProperties();if(props.getProperty('BILLING_ENABLED')!=='true')return;
  const cache=CacheService.getScriptCache(),key='billing_sync:'+id;if(cache.get(key))return;
  const paid=nfRows('Ledger').filter(r=>r[1]===id&&['coins_50','vip_state'].includes(r[2])&&r[5]);
  // Interactive checks cover current VIP and the latest pack. The persistent
  // background cursor checks the entire history, including older refunds.
  const latestCoin=paid.filter(r=>r[2]==='coins_50').slice(-1),latestVip=paid.filter(r=>r[2]==='vip_state').slice(-1);
  const sessions=[...new Set([...latestCoin,...latestVip].map(r=>r[5]))];
  sessions.forEach(s=>nfFulfillSession(s,id));cache.put(key,'1',60);
}
function nfRestoreOrders(id){
  if(PropertiesService.getScriptProperties().getProperty('BILLING_ENABLED')!=='true')throw Error('checkout_not_enabled');
  const row=nfRows('Players').find(r=>r[0]===id&&r[2]==='active'&&!String(r[1]).startsWith('guest:'));if(!row)throw Error('verified_email_required');
  let matched=0;
  Object.values(NF_LINKS).forEach(link=>{
    let cursor='';
    for(let page=0;page<10;page++){
      const list=nfStripe('checkout/sessions?limit=100&payment_link='+link+(cursor?'&starting_after='+cursor:''));
      list.data.filter(s=>s.client_reference_id===id&&s.status==='complete'&&s.payment_status==='paid').forEach(s=>{nfFulfillSession(s.id,id);matched++;});
      if(!list.has_more)return;
      if(!list.data.length)throw Error('billing_coverage_incomplete');cursor=list.data[list.data.length-1].id;
    }
    throw Error('billing_coverage_incomplete');
  });
  return nfLocked(()=>({ok:true,matched,wallet:nfWallet(id)}));
}
function reconcileNanoFunBilling(){
  // A bounded, persistent cursor resumes rather than pretending a partial scan is complete.
  const props=PropertiesService.getScriptProperties();if(props.getProperty('BILLING_ENABLED')!=='true')return;
  const summary={processed:0,pending:0,errors:0,completed_links:0};
  Object.values(NF_LINKS).forEach(link=>{
    const cursor=props.getProperty('billing_cursor:'+link)||'';
    const list=nfStripe('checkout/sessions?limit=25&payment_link='+link+(cursor?'&starting_after='+cursor:''));
    list.data.filter(s=>s.status==='complete'&&s.payment_status==='paid').forEach(s=>{
      if(!s.client_reference_id){summary.pending++;return;}
      try{nfFulfillSession(s.id);summary.processed++;}catch(e){summary.errors++;}
    });
    if(list.has_more){if(!list.data.length)throw Error('billing_coverage_incomplete');props.setProperty('billing_cursor:'+link,list.data[list.data.length-1].id);}else{props.deleteProperty('billing_cursor:'+link);summary.completed_links++;}
  });
  props.setProperty('billing_last_summary',JSON.stringify({...summary,at:new Date().toISOString()}));console.log(JSON.stringify(summary));return summary;
}
function installNanoFunBilling(){
  const checks=verifyStripeConnection();if(Object.values(checks).some(c=>!c.ok||c.url_matches===false||c.active===false))throw Error('stripe_readiness_failed');
  Object.entries(NF_LINKS).forEach(([plan,id])=>{
    const link=nfStripe('payment_links/'+id+'?expand[]=line_items');
    if(link.after_completion?.type!=='redirect'||link.after_completion.redirect.url!=='https://nanofungames.com/?session_id={CHECKOUT_SESSION_ID}')throw Error('checkout_redirect_required');
    const items=link.line_items;if(!items||items.has_more||items.data.length!==1||items.data[0].quantity!==1||items.data[0].price.unit_amount!==NF_PLANS[plan].amount||items.data[0].price.currency!=='usd')throw Error('price_not_verified');
    if(plan==='vip_year'&&(items.data[0].price.recurring?.interval!=='year'||items.data[0].price.recurring.interval_count!==1))throw Error('price_not_verified');
  });
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('BILLING_TRIGGER_CONFIRMED')!=='true')throw Error('reconciliation_trigger_required');
  props.setProperty('BILLING_TEST_EMAIL','pawfunstudios@gmail.com');
  props.setProperty('BILLING_ENABLED','true');
  console.log('Owner-only 50-coin payment acceptance enabled; public checkout and annual VIP remain closed.');
}

function confirmNanoFunBillingTrigger(){
  PropertiesService.getScriptProperties().setProperty('BILLING_TRIGGER_CONFIRMED','true');
  console.log('Reconciliation trigger confirmation recorded; checkout not enabled by this function.');
}
