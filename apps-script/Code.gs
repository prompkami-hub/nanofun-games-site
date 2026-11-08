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
function doGet(){return nfJson({service:'nanofun-wallet',schema:4,version:'receipt-outbox-4',paid_enabled:PropertiesService.getScriptProperties().getProperty('BILLING_ENABLED')==='true'&&!PropertiesService.getScriptProperties().getProperty('BILLING_TEST_EMAIL'),ads_enabled:false});}
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
    const result=nfLocked(()=>{
      nfAppend('stripe:'+session.id,id,'coins_50',50,'',session.id);
      const entries=nfRows('Ledger').filter(r=>r[1]===id&&r[5]===session.id&&(r[2]==='coins_50'||r[2]==='coin_adjustment'));
      const prior=entries.reduce((sum,r)=>sum+Number(r[3]),0);
      if(prior!==target)nfAppend('stripe_adjust:'+session.id+':'+entries.length+':'+target,id,'coin_adjustment',target-prior,'',session.id);
      return {ok:true,plan,wallet:nfWallet(id)};
    });
    result.receipt_status=nfTryQueueReceipt({key:'checkout:'+session.id,playerId:id,email:row[1],orderId:session.id,kind:'coins_50',amountCents:99,paidAt:charge.created,coinsCredited:target,receiptUrl:charge.receipt_url||''});
    return result;
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
  const result=nfLocked(()=>{
    const index=nfRows('Players').findIndex(r=>r[0]===id),old=nfRows('Players')[index];
    if(old[6]&&old[6]!==subscription.id)throw Error('multiple_subscriptions_need_review');
    nfSheet('Players').getRange(index+2,6,1,2).setValues([[nfObjectId(session.customer),subscription.id]]);
    const states=nfRows('Ledger').filter(r=>r[1]===id&&r[2]==='vip_state');
    const last=states.length?Date.parse(states[states.length-1][4]):null;
    if(last!==until)nfAppend('vip_state:'+subscription.id+':'+states.length+':'+until,id,'vip_state',0,new Date(until).toISOString(),session.id);
    return {ok:true,plan,wallet:nfWallet(id)};
  });
  if(until>Date.now())result.receipt_status=nfTryQueueReceipt({key:'invoice:'+invoice.id,playerId:id,email:row[1],orderId:session.id,kind:invoice.billing_reason==='subscription_cycle'?'vip_renewal':'vip_initial',amountCents:999,paidAt:invoice.status_transitions?.paid_at,vipUntil:until,receiptUrl:invoice.hosted_invoice_url||''});
  return result;
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
  summary.receipts=processNanoFunReceiptOutbox();
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

// Transactional receipts. No customer records or message bodies are logged.
const NF_RECEIPT_HEADERS=['ReceiptId','PlayerId','OrderId','Kind','State','ToEmail','PayloadJson','Attempts','UpdatedAt','LastError'];
function setupNanoFunReceipts(){
  const book=SpreadsheetApp.openById(NF_SHEET_ID);let sheet=book.getSheetByName('Receipts');
  if(!sheet){sheet=book.insertSheet('Receipts');sheet.getRange(1,1,1,NF_RECEIPT_HEADERS.length).setValues([NF_RECEIPT_HEADERS]);sheet.setFrozenRows(1);}
  if(JSON.stringify(sheet.getRange(1,1,1,NF_RECEIPT_HEADERS.length).getValues()[0])!==JSON.stringify(NF_RECEIPT_HEADERS))throw Error('receipt_schema_mismatch');
  const props=PropertiesService.getScriptProperties();if(!props.getProperty('RECEIPT_EMAIL_SINCE'))props.setProperty('RECEIPT_EMAIL_SINCE',String(Math.floor(Date.now()/1000)));
  props.setProperty('RECEIPT_OUTBOX_READY','true');
  // Sending remains off during sandbox acceptance. No historical backfill.
  console.log('Private receipt outbox ready. Automatic sending stays disabled until acceptance.');
}
function nfReceiptRows(){const s=nfSheet('Receipts');return s.getLastRow()<2?[]:s.getRange(2,1,s.getLastRow()-1,NF_RECEIPT_HEADERS.length).getValues();}
function nfReceiptWrite(index,row){
  const rows=nfReceiptRows(),actual=rows.findIndex(r=>r[0]===row[0]);
  if(actual<0||rows[actual][1]!==row[1])throw Error('receipt_owner_mismatch');
  nfSheet('Receipts').getRange(actual+2,1,1,NF_RECEIPT_HEADERS.length).setValues([row]);
}
function nfEscapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function nfRenderReceipt(p){
  if(!['coins_50','vip_initial','vip_renewal'].includes(p.kind)||!/^NF-\d{8}-[A-F0-9]{12}$/.test(p.reference||'')||!/^cs_(live|test)_[A-Za-z0-9]+$/.test(p.orderId||''))throw Error('invalid_receipt_payload');
  const coin=p.kind==='coins_50',product=coin?'NanoFun 50 Coins Pack':'NanoFun Annual VIP Pass';
  if(p.amountCents!==(coin?99:999)||p.currency!=='usd'||!Number.isSafeInteger(p.paidAt)||p.paidAt<=0)throw Error('invalid_receipt_payload');
  if(coin&&(!Number.isSafeInteger(p.coinsCredited)||p.coinsCredited<0||p.coinsCredited>50))throw Error('invalid_receipt_payload');
  if(!coin&&(!Number.isSafeInteger(p.vipUntil)||p.vipUntil<=p.paidAt*1000))throw Error('invalid_receipt_payload');
  const amount=coin?'$0.99 USD':'$9.99 USD';
  const intro=p.kind==='vip_renewal'?'Your annual renewal payment has been verified and your NanoFun access has been updated.':'Your payment has been verified and your NanoFun wallet has been updated.';
  const entitlement=coin?(p.coinsCredited===50?'You purchased 50 coins. They have been credited to your wallet. Each new game or restart costs 1 coin; pausing and resuming are free.':'You purchased 50 coins. At order verification, after the recorded refund or dispute adjustment, this purchase provided '+p.coinsCredited+' coins. Your wallet shows the current available balance.'):'This paid annual VIP period was recorded through '+new Date(p.vipUntil).toISOString().replace('T',' ').replace('.000Z',' UTC')+'. Supported games do not spend coins while VIP is active. Check your wallet for current access after any later cancellation, refund or dispute.';
  const terms=coin?'One-time purchase. No recurring charge for this coin pack. Coins have no cash value and cannot be withdrawn.':'$9.99 USD per year. The subscription renews annually until canceled. Canceling future renewal does not shorten an already-paid period. For cancellation help, contact superpowergames.us@gmail.com. Rewarded continuation ads, when available, are hidden during active VIP access.';
  let receipt='';if(p.receiptUrl){if(!/^https:\/\/(?:pay|invoice)\.stripe\.com\/[A-Za-z0-9_/?=&%#.+:-]+$/.test(p.receiptUrl))throw Error('invalid_receipt_link');receipt='<p style="font-size:13px"><a href="'+nfEscapeHtml(p.receiptUrl)+'">View your Stripe payment document</a></p>';}
  const subject='NanoFun '+(p.kind==='vip_renewal'?'renewal confirmation':'purchase confirmation')+' — '+product+' ['+p.reference+']';
  const paidAt=new Date(p.paidAt*1000).toISOString().replace('T',' ').replace('.000Z',' UTC');
  const replacements={SUBJECT:subject,INTRO:intro,PRODUCT:product,AMOUNT:amount,REFERENCE:p.reference,PAID_AT:paidAt,ENTITLEMENT:entitlement,BILLING_TERMS:terms,ORDER_ID:p.orderId};
  const htmlBody=NF_RECEIPT_HTML.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>key==='STRIPE_RECEIPT_LINK'?receipt:nfEscapeHtml(replacements[key]??''));
  return {subject,htmlBody,body:[intro,'','Product: '+product,'Quantity: 1','Amount paid: '+amount,'Order reference: '+p.reference,'Payment date: '+paidAt,'Stripe order: '+p.orderId,'',entitlement,terms,'','Open NanoFun: https://nanofungames.com/','Sign in with the same purchase email. Open your wallet and choose Restore purchases if needed.',p.receiptUrl?'Stripe payment document: '+p.receiptUrl:'','Payment merchant: PromptKami. Product: NanoFun Games.','Support: superpowergames.us@gmail.com','This purchase confirmation is not a tax invoice or marketing subscription.'].filter(v=>v!==null).join('\n')};
}
function nfTryQueueReceipt(info){
  const props=PropertiesService.getScriptProperties();if(props.getProperty('RECEIPT_OUTBOX_READY')!=='true')return 'not_configured';
  const since=Number(props.getProperty('RECEIPT_EMAIL_SINCE'));if(!Number.isSafeInteger(info.paidAt)||!Number.isFinite(since)||since<=0)return 'needs_review';
  if(info.paidAt<since)return 'historical_skipped';
  try{return nfLocked(()=>{
    const existing=nfReceiptRows().find(r=>r[0]===info.key);if(existing){if(existing[1]!==info.playerId||existing[2]!==info.orderId)throw Error('receipt_owner_mismatch');return existing[4];}
    const row=nfRows('Players').find(r=>r[0]===info.playerId&&r[2]==='active'&&!String(r[1]).startsWith('guest:'));if(!row||nfEmail(info.email)!==row[1])throw Error('receipt_owner_mismatch');
    const reference='NF-'+new Date(info.paidAt*1000).toISOString().slice(0,10).replace(/-/g,'')+'-'+nfHash(info.key).slice(0,12).toUpperCase();
    const payload={kind:info.kind,orderId:info.orderId,reference,amountCents:info.amountCents,currency:'usd',paidAt:info.paidAt,coinsCredited:info.coinsCredited,vipUntil:info.vipUntil,receiptUrl:info.receiptUrl||''};
    nfRenderReceipt(payload);nfSheet('Receipts').appendRow([info.key,info.playerId,info.orderId,info.kind,'queued',row[1],JSON.stringify(payload),0,new Date().toISOString(),'']);return 'queued';
  });}catch(e){console.warn('Receipt queue needs review; wallet fulfillment is preserved.');return 'queue_needs_review';}
}
function processNanoFunReceiptOutbox(){
  const props=PropertiesService.getScriptProperties();const summary={sent:0,pending:0,delivery_unknown:0};
  if(props.getProperty('RECEIPT_OUTBOX_READY')!=='true'||props.getProperty('RECEIPT_EMAIL_ENABLED')!=='true')return {...summary,disabled:true};
  for(let n=0;n<10;n++){
    if(MailApp.getRemainingDailyQuota()<1){summary.pending++;break;}
    const job=nfLocked(()=>{
      const rows=nfReceiptRows();
      rows.forEach((r,i)=>{if(r[4]==='sending'&&Date.now()-Date.parse(r[8])>600000){r[4]='delivery_unknown';r[9]='Interrupted send; reconcile Sent mailbox before retry';r[8]=new Date().toISOString();nfReceiptWrite(i,r);}});
      const index=rows.findIndex(r=>r[4]==='queued');if(index<0)return null;
      const row=rows[index];let message;
      try{nfEmail(row[5]);message=nfRenderReceipt(JSON.parse(row[6]));}catch(e){row[4]='needs_review';row[9]='Invalid receipt payload';nfReceiptWrite(index,row);return {skip:true};}
      row[4]='sending';row[7]=Number(row[7])+1;row[8]=new Date().toISOString();row[9]='';nfReceiptWrite(index,row);return {index,row,message};
    });
    if(!job)break;if(job.skip)continue;
    // MailApp has no provider idempotency key. A crash/uncertain send is held
    // for Sent-mail reconciliation, never automatically sent a second time.
    try{
      MailApp.sendEmail({to:job.row[5],subject:job.message.subject,body:job.message.body,htmlBody:job.message.htmlBody,name:'NanoFun Games',replyTo:'superpowergames.us@gmail.com'});
      nfLocked(()=>{job.row[4]='sent';job.row[8]=new Date().toISOString();nfReceiptWrite(job.index,job.row);});summary.sent++;
    }catch(e){
      nfLocked(()=>{job.row[4]='delivery_unknown';job.row[9]='Reconcile Sent mailbox by order reference before retry';job.row[8]=new Date().toISOString();nfReceiptWrite(job.index,job.row);});summary.delivery_unknown++;
    }
  }
  const remaining=nfReceiptRows();
  summary.pending=remaining.filter(r=>r[4]==='queued').length;
  summary.delivery_unknown=remaining.filter(r=>r[4]==='delivery_unknown').length;
  summary.needs_review=remaining.filter(r=>r[4]==='needs_review').length;
  return summary;
}

// BEGIN GENERATED RECEIPT TEMPLATE
const NF_RECEIPT_HTML="<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{{SUBJECT}}</title></head><body style=\"margin:0;background:#f4f1ea;color:#242134;font-family:Arial,sans-serif;line-height:1.6\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\" style=\"padding:24px 12px\"><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"width:100%;max-width:600px;background:#fff;border-radius:16px;overflow:hidden\"><tr><td style=\"padding:24px 32px;background:#211c32;color:#f3ff80;font-size:24px;font-weight:700;letter-spacing:3px\">NANOFUN<span style=\"display:block;color:#dedbe8;letter-spacing:2px;font-size:11px\">YOUR LITTLE ARCADE</span></td></tr><tr><td style=\"padding:28px 32px\"><p style=\"margin:0;color:#777;font-size:11px;letter-spacing:2px\">PURCHASE CONFIRMATION</p><h1 style=\"font-size:24px;line-height:1.3;margin:8px 0 16px\">Thank you for your purchase.</h1><p>{{INTRO}}</p><table role=\"presentation\" width=\"100%\" cellpadding=\"8\" cellspacing=\"0\" style=\"background:#f6f5f9;border-radius:12px;font-size:14px\"><tr><td>Product</td><td align=\"right\"><strong>{{PRODUCT}}</strong></td></tr><tr><td>Quantity</td><td align=\"right\">1</td></tr><tr><td>Amount paid</td><td align=\"right\"><strong>{{AMOUNT}}</strong></td></tr><tr><td>Order reference</td><td align=\"right\" style=\"word-break:break-all\">{{REFERENCE}}</td></tr><tr><td>Payment date (UTC)</td><td align=\"right\">{{PAID_AT}}</td></tr></table><h2 style=\"font-size:17px;margin:24px 0 8px\">What you purchased</h2><p>{{ENTITLEMENT}}</p><p style=\"color:#666;font-size:13px\">{{BILLING_TERMS}}</p><p style=\"text-align:center;margin:28px 0\"><a href=\"https://nanofungames.com/\" style=\"display:inline-block;padding:13px 28px;border-radius:8px;background:#211c32;color:#f3ff80;text-decoration:none;font-weight:700\">Open NanoFun</a></p><p style=\"font-size:13px;color:#666\">Sign in with the same email used for this purchase. Open your wallet and select <strong>Restore purchases</strong> if your balance or access needs refreshing.</p>{{STRIPE_RECEIPT_LINK}}<p style=\"font-size:12px;color:#777;word-break:break-all\">Stripe order: {{ORDER_ID}}</p></td></tr><tr><td style=\"padding:20px 32px;background:#f6f5f9;font-size:12px;color:#777\">Payment merchant: PromptKami · Product: NanoFun Games<br>Need help? <a style=\"color:#575062\" href=\"mailto:superpowergames.us@gmail.com\">superpowergames.us@gmail.com</a><br>This is a purchase confirmation, not a tax invoice or a marketing subscription.</td></tr></table></td></tr></table></body></html>\n";
// END GENERATED RECEIPT TEMPLATE
