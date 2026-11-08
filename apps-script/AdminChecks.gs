/* Private editor-only diagnostics. Never return keys or customer/order details. */
function verifyNanoFunSandboxConnection() {
  const props=PropertiesService.getScriptProperties();
  const key=props.getProperty('STRIPE_TEST_READ_KEY');
  if(!key||!/^rk_test_/.test(key))throw Error('sandbox_read_key_required');
  const checks={};
  ['payment_links','checkout/sessions','events','invoices','subscriptions','charges','disputes','prices','payment_intents'].forEach(resource=>{
    try {
      const response=UrlFetchApp.fetch('https://api.stripe.com/v1/'+resource+'?limit=1',{headers:{Authorization:'Bearer '+key},muteHttpExceptions:true});
      if(response.getResponseCode()!==200)throw Error('sandbox_resource_unavailable');
      const value=JSON.parse(response.getContentText());
      if(value.object!=='list'||!Array.isArray(value.data)||value.data.some(row=>row.livemode!==false))throw Error('sandbox_mode_not_verified');
      checks[resource]={ok:true};
    } catch(e) { checks[resource]={ok:false,error:e.message==='sandbox_mode_not_verified'?e.message:'sandbox_resource_unavailable'}; }
  });
  const summary={service:'nanofun-sandbox-readonly-check',checks,complete:Object.values(checks).every(c=>c.ok),checkout_disabled:props.getProperty('BILLING_TEST_EMAIL')==='__awaiting_sandbox_acceptance__',receipt_delivery_disabled:props.getProperty('RECEIPT_EMAIL_ENABLED')!=='true'};
  console.log(JSON.stringify(summary));
  return summary;
}

const NF_SANDBOX_PLANS={
  coins_50:{link:'plink_1UZNr3CvKtvzDSIbfoBoo8bp',price:'price_1UZNpyCvKtvzDSIbvKUJbBel',amount:99,mode:'payment'},
  vip_initial:{link:'plink_1UZNrqCvKtvzDSIbyf2WUP2G',price:'price_1UZNqQCvKtvzDSIbQxgKTTEM',amount:999,mode:'subscription'}
};
function nfSandboxGet(path){
  const key=PropertiesService.getScriptProperties().getProperty('STRIPE_TEST_READ_KEY');
  if(!/^rk_test_/.test(key||''))throw Error('sandbox_read_key_required');
  const r=UrlFetchApp.fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+key},muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw Error('sandbox_resource_unavailable');
  const value=JSON.parse(r.getContentText());
  if(value.object!=='list'&&value.livemode!==false)throw Error('sandbox_mode_not_verified');
  return value;
}
function nfSandboxCharge(intentId,amount){
  if(!/^pi_[A-Za-z0-9]+$/.test(intentId||''))throw Error('sandbox_payment_not_verified');
  const intent=nfSandboxGet('payment_intents/'+intentId+'?expand[]=latest_charge');
  if(intent.status!=='succeeded'||intent.amount_received!==amount||intent.currency!=='usd')throw Error('sandbox_payment_not_verified');
  const charge=typeof intent.latest_charge==='string'?nfSandboxGet('charges/'+intent.latest_charge):intent.latest_charge;
  if(!charge||charge.livemode!==false||nfObjectId(charge.payment_intent)!==intentId||charge.disputed)throw Error('sandbox_charge_not_verified');
  return charge;
}
// Deliberately separate from Players, Ledger, Receipts and every public API action.
// Uses actual Stripe sandbox orders, but never grants production access.
function runNanoFunSandboxAcceptance(){
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('BILLING_TEST_EMAIL')!=='__awaiting_sandbox_acceptance__'||props.getProperty('RECEIPT_EMAIL_ENABLED')==='true')throw Error('production_must_remain_closed');
  const verified=[];
  Object.entries(NF_SANDBOX_PLANS).forEach(([kind,plan])=>{
    const list=nfSandboxGet('checkout/sessions?limit=25&payment_link='+plan.link);
    if(list.has_more)throw Error('sandbox_coverage_incomplete');
    list.data.filter(s=>s.status==='complete'&&s.payment_status==='paid').forEach(s=>{
      const session=nfSandboxGet('checkout/sessions/'+s.id+'?expand[]=line_items');
      const items=session.line_items;
      if(session.client_reference_id!=='nf_sandbox_acceptance'||nfEmail(session.customer_details?.email)!==nfEmail(props.getProperty('SANDBOX_RECIPIENT_EMAIL')||'')||nfObjectId(session.payment_link)!==plan.link||session.currency!=='usd'||session.amount_total!==plan.amount||session.mode!==plan.mode||!items||items.has_more||items.data.length!==1||items.data[0].quantity!==1||items.data[0].price.id!==plan.price||items.data[0].price.unit_amount!==plan.amount||items.data[0].price.currency!=='usd')throw Error('sandbox_order_not_verified');
      let charge,coins=0,until=0,invoice;
      if(kind==='coins_50'){charge=nfSandboxCharge(nfObjectId(session.payment_intent),99);coins=nfCoinTarget(charge,{data:[],has_more:false});}
      else {
        const sub=nfSandboxGet('subscriptions/'+nfObjectId(session.subscription));
        if(nfObjectId(sub.customer)!==nfObjectId(session.customer))throw Error('sandbox_owner_mismatch');
        invoice=nfSandboxGet('invoices/'+nfObjectId(sub.latest_invoice)+'?expand[]=payments.data.payment.payment_intent');
        let intent=nfObjectId(invoice.payment_intent);
        if(!intent){const payments=(invoice.payments?.data||[]).filter(p=>p.status==='paid');if(invoice.payments?.has_more||payments.length!==1)throw Error('sandbox_invoice_not_verified');intent=nfObjectId(payments[0].payment?.payment_intent);}
        charge=nfSandboxCharge(intent,999);until=nfVipUntil(sub,invoice,charge,{data:[],has_more:false},plan.price);
        if(until<=Date.now())throw Error('sandbox_vip_not_active');
      }
      const paidAt=kind==='coins_50'?charge.created:invoice.status_transitions?.paid_at;
      const payload={kind,orderId:session.id,reference:'NF-'+new Date(paidAt*1000).toISOString().slice(0,10).replace(/-/g,'')+'-'+nfHash('sandbox:'+session.id).slice(0,12).toUpperCase(),amountCents:plan.amount,currency:'usd',paidAt,coinsCredited:coins,vipUntil:until};
      nfRenderReceipt(payload);
      verified.push([session.id,kind,coins,until,'queued',JSON.stringify(payload),new Date().toISOString()]);
    });
  });
  const result=nfLocked(()=>{
    const book=SpreadsheetApp.openById(NF_SHEET_ID);let sheet=book.getSheetByName('SandboxAcceptance');
    const headers=['TestOrderId','Kind','TestCoins','TestVipUntil','TestReceiptState','PayloadJson','UpdatedAt'];
    if(!sheet){sheet=book.insertSheet('SandboxAcceptance');sheet.appendRow(headers);sheet.setFrozenRows(1);}
    if(JSON.stringify(sheet.getRange(1,1,1,7).getValues()[0])!==JSON.stringify(headers))throw Error('sandbox_schema_mismatch');
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,7).getValues():[];let added=0;
    verified.forEach(row=>{if(!rows.some(old=>old[0]===row[0])){sheet.appendRow(row);rows.push(row);added++;}});
    return {verified:verified.length,added,test_coin_balance:rows.reduce((n,r)=>n+Number(r[2]),0),annual_vip_verified:rows.some(r=>r[1]==='vip_initial'&&Number(r[3])>Date.now()),production_wallet_touched:false};
  });
  props.setProperty('sandbox_last_summary',JSON.stringify(result));console.log(JSON.stringify(result));return result;
}
function sendNanoFunSandboxReceipts(){
  if(!nfMailReady())throw Error('mail_sender_not_ready');
  const sheet=SpreadsheetApp.openById(NF_SHEET_ID).getSheetByName('SandboxAcceptance');if(!sheet)throw Error('sandbox_acceptance_required');
  let sent=0;
  for(let i=2;i<=sheet.getLastRow();i++){
    const payload=nfLocked(()=>{const row=sheet.getRange(i,1,1,7).getValues()[0];if(row[4]!=='queued')return null;const p=JSON.parse(row[5]);nfRenderReceipt(p);sheet.getRange(i,5).setValue('sending');return p;});
    if(!payload)continue;
    const receipt=nfRenderReceipt(payload);
    try{nfSendPublicMail({to:NF_PUBLIC_EMAIL,name:'NanoFun Games — Sandbox',subject:'[SANDBOX TEST — NO REAL PAYMENT] '+receipt.subject,body:'SANDBOX TEST ONLY. No real charge, coins or VIP access.\n\n'+receipt.body,htmlBody:'<p style="background:#ffe8a3;padding:20px;font-weight:bold">SANDBOX TEST ONLY — No real charge or production wallet entitlement.</p>'+receipt.htmlBody},'receipt:sandbox:'+nfHash(payload.orderId));sheet.getRange(i,5).setValue('sent');sent++;}
    catch(e){sheet.getRange(i,5).setValue('delivery_unknown');}
  }
  console.log(JSON.stringify({test_receipts_sent:sent,production_delivery_enabled:false}));
}

// Run only for the user's explicit public release request. No key is created,
// no charge is made, and no access scope or deployment audience is changed.
function releaseNanoFunPublicBilling(){
  nfValidateBillingConfiguration();
  const props=PropertiesService.getScriptProperties();
  const summary=JSON.parse(props.getProperty('sandbox_last_summary')||'{}');
  if(summary.verified!==2||summary.test_coin_balance!==50||summary.annual_vip_verified!==true||summary.production_wallet_touched!==false)throw Error('sandbox_acceptance_required');
  const sheet=SpreadsheetApp.openById(NF_SHEET_ID).getSheetByName('SandboxAcceptance');
  if(!sheet||sheet.getLastRow()!==3)throw Error('sandbox_receipts_required');
  const rows=sheet.getRange(2,1,2,7).getValues();
  if(!['coins_50','vip_initial'].every(kind=>rows.some(r=>r[1]===kind&&r[4]==='sent')))throw Error('sandbox_receipts_required');
  // The existing time trigger is verified in the Google Triggers UI.
  // Do not request a new ScriptApp scope just to inspect an already-installed trigger.
  if(props.getProperty('BILLING_TRIGGER_CONFIRMED')!=='true')throw Error('reconciliation_trigger_required');
  setupNanoFunReceipts();
  props.setProperties({BILLING_ENABLED:'true',VIP_CHECKOUT_ENABLED:'true',RECEIPT_EMAIL_ENABLED:'true'});
  props.deleteProperty('BILLING_TEST_EMAIL');
  props.setProperty('public_billing_released_at',new Date().toISOString());
  console.log(JSON.stringify({public_checkout_enabled:true,annual_vip_enabled:true,receipt_delivery_enabled:true,ads_enabled:false,real_payment_created:false}));
}


function probeEeMailSender(){
  const operation='probe:'+Utilities.getUuid();
  const r=nfRelaySend({to:NF_PUBLIC_EMAIL,subject:'NanoFun sender verification',body:'This is a NanoFun sender test. The From and Reply-To must both be superpowergames.us@gmail.com. No customer purchase or code is included.'},operation);
  PropertiesService.getScriptProperties().setProperty('EE_MAIL_PROBE_ACCEPTED',r.sender===NF_PUBLIC_EMAIL?'true':'false');
  console.log(JSON.stringify({sender:r.sender,accepted:r.ok,operation}));
}
// Run only after the operator reads the actual From header in the ee inbox.
function confirmEeSenderAfterAcceptance(){
  const deployed=JSON.parse(UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbwoez3VLfp9FNF4AtlrY66bMPH99_YigtJegkjKnkok2mp7AvxHXRNBP11ry8_3jsDbJw/exec').getContentText());if(deployed.version!=='ee-mail-relay-7'||deployed.mail_transport!=='brand_relay')throw Error('relay_backend_deployment_required');
  const p=PropertiesService.getScriptProperties();if(p.getProperty('EE_MAIL_PROBE_ACCEPTED')!=='true')throw Error('brand_mail_acceptance_required');
  p.setProperty('OUTBOUND_IDENTITY_CONFIRMED',NF_PUBLIC_EMAIL);
  if(!nfMailReady()){p.deleteProperty('OUTBOUND_IDENTITY_CONFIRMED');throw Error('mail_sender_not_ready');}
  console.log(JSON.stringify({public_sender:NF_PUBLIC_EMAIL,brand_mail_ready:true}));
}
