'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const endpoint='https://script.google.com/macros/s/AKfycbwoez3VLfp9FNF4AtlrY66bMPH99_YigtJegkjKnkok2mp7AvxHXRNBP11ry8_3jsDbJw/exec';
  const client=window.NanoFunWalletClient.createWalletClient({endpoint});
  let wallet=null,selectedGame='volleyball',toastTimer,loading=true,loginEmail='';
  const games = {volleyball:{name:'皮卡丘打排球',path:'pikachu-volleyball/?v=wallet1',hint:'选择模式时扣 1 币 / 场 · 左侧 WASD＋R · 右侧方向键＋Enter',paid:'本场可玩到 15 分。'},'2048':{name:'2048',path:'2048/?v=wallet1',hint:'滑动棋盘或使用方向键 / WASD · 开始和重开扣 1 币',paid:'达到 2048 后可免费继续挑战。'},snake:{name:'贪吃蛇',path:'snake/?v=wallet1',hint:'滑动、方向按钮或方向键 / WASD · 开始和重开扣 1 币',paid:'吃果子得分，撞墙或撞到自己结束。'}};
  const errors={login_required:'请用邮箱登录，恢复你的账户。',invalid_code:'验证码不正确，请重新输入。',code_expired:'验证码已过期，请重新发送。',try_later:'请求较多，请稍后再试。',insufficient_coins:'能量已用完，登录后领取每日能量。',verified_email_required:'请先验证邮箱。',previous_game_round_pending:'上次开局仍待确认，请先返回上一款游戏重试。',previous_account_round_pending:'上一账户有待确认的开局，请先恢复该账户。',checkout_not_ready:'付费补能尚未开放。',stripe_not_configured:'付费补能尚未开放。'};
  const message=e=>errors[e.message]||'连接暂时失败。请重试；开局请求会核对原编号，不会重复扣币。';
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
  function render(){
    const total=wallet?.coins;
    ['header-balance','cabinet-coins','wallet-balance'].forEach(id=>$(id).textContent=Number.isSafeInteger(total)?total:'—');
    const email=wallet?.kind==='email';
    $('email-form').hidden=email;$('account-panel').hidden=!wallet;$('code-form').hidden=email||!loginEmail;
    $('account-label').textContent=wallet?.email_label||'连接钱包中…';
    $('guest-status').textContent=loading?'正在连接你的钱包…':email?'账户余额已同步，换设备登录也能恢复。':wallet?'游客体验：首次 5 枚能量，开局扣 1 枚；登录后恢复账户并领取每日能量。':'填写邮箱，恢复你的账户余额。';
    $('daily-button').hidden=!email;$('daily-button').disabled=!wallet?.daily_available;
    $('daily-button').textContent=wallet?.daily_available?'领取今日 10 枚能量':'今日已领取 · 明天再来';
    $('wallet-play').hidden=!(wallet?.is_vip||total>0);
    $('coins-buy').disabled=!wallet?.checkout_ready?.coins_50;
    $('vip-buy').disabled=!wallet?.checkout_ready?.vip_year;
    $('reward-button').disabled=true;
    $('reward-status').textContent='广告仍在审核，暂不播放或发放广告奖励。';
    $('membership-status').textContent=wallet?.is_vip?'年度 VIP 有效至 '+new Date(wallet.vip_expires_at).toLocaleDateString():email?'已验证邮箱 · 账户余额由服务器记录':'游客钱包 · 验证邮箱后可跨设备恢复';
  }
  function accept(value){wallet=value;render();}
  function openWallet(text=''){
    window.NanoTouch?.pause();$('game-frame-host').firstChild?.contentWindow?.postMessage('nanofun:pause',location.origin);
    render();$('wallet-message').textContent=text;if(!$('wallet-dialog').open)$('wallet-dialog').showModal();
  }
  const gate=window.NanoFunRoundGate.createRoundGate({client,storage:localStorage,onUpdate:accept});
  const ready=(async()=>{
    try{
      if(localStorage.getItem('nanofun.wallet.auth.v1')){
        try{accept(await client.refresh());return;}catch(e){if(e.message!=='login_required')throw e;client.logout();}
      }
      accept(await client.guest());
    }catch(e){$('wallet-message').textContent=message(e);toast(message(e));}
    finally{loading=false;render();}
  })();
  $('email-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try{if(!$('email').checkValidity())return;const email=$('email').value.trim().toLowerCase();await client.requestLogin(email);loginEmail=email;$('wallet-message').textContent='验证码已发送，10 分钟内有效。';render();$('code').focus();}
    catch(error){$('wallet-message').textContent=message(error);}finally{button.disabled=false;}
  });
  $('code-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try{accept(await client.login(loginEmail,$('code').value.trim()));$('code').value='';loginEmail='';render();$('wallet-message').textContent='登录成功，账户余额已恢复。';}
    catch(error){$('wallet-message').textContent=message(error);}finally{button.disabled=false;}
  });
  $('daily-button').addEventListener('click',async()=>{try{$('daily-button').disabled=true;accept((await client.daily()).wallet);$('wallet-message').textContent='今日能量已到账。';}catch(e){$('wallet-message').textContent=message(e);render();}});
  $('switch-account').addEventListener('click',()=>{client.logout();wallet=null;loginEmail='';render();$('wallet-message').textContent='已退出登录，填写邮箱恢复余额。';});
  $('coins-buy').addEventListener('click',()=>{try{location.assign(client.checkoutUrl('coins_50'));}catch(e){$('wallet-message').textContent=message(e);}});
  $('vip-buy').addEventListener('click',()=>{try{location.assign(client.checkoutUrl('vip_year'));}catch(e){$('wallet-message').textContent=message(e);}});
  $('wallet-button').addEventListener('click',()=>openWallet());$('claim-entry').addEventListener('click',()=>openWallet());$('game-wallet').addEventListener('click',()=>openWallet());
  ['how-button','privacy-button'].forEach(id=>$(id).addEventListener('click',()=>$('info-dialog').showModal()));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $('wallet-play').addEventListener('click',()=>{$('wallet-dialog').close();if($('cabinet-dialog').open)$('cabinet-dialog').close();$('games').focus({preventScroll:true});$('games').scrollIntoView({block:'start'});});
  function openCabinet(gameId){
    selectedGame=games[gameId]?gameId:'volleyball';const game=games[selectedGame];
    const frame=document.createElement('iframe');frame.src='games/'+game.path;frame.title=game.name+' — NanoFun';frame.allow='autoplay; fullscreen';$('game-frame-host').replaceChildren(frame);
    $('cabinet-dialog').dataset.game=selectedGame;$('cabinet-title').textContent=game.name;$('cabinet-hint').textContent=game.hint.replaceAll('模拟币','能量');$('game-status').textContent='点击游戏内开始按钮，确认 1 枚能量后开局。';$('cabinet-dialog').showModal();window.NanoTouch?.enter();render();
  }
  $('play-button').addEventListener('click',()=>openCabinet('volleyball'));$('play-2048').addEventListener('click',()=>openCabinet('2048'));$('play-snake').addEventListener('click',()=>openCabinet('snake'));
  $('cabinet-dialog').addEventListener('pointerdown',()=>{if(selectedGame==='volleyball')$('game-frame-host').firstChild?.contentWindow?.NanoPikaAudio?.unlock();},{capture:true,passive:true});
  $('exit-game').addEventListener('click',()=>$('cabinet-dialog').close());$('cabinet-dialog').addEventListener('close',()=>{window.NanoTouch?.reset();$('game-frame-host').replaceChildren();});
  window.NanoArcade=Object.freeze({async requestMatch(single=true){
    if(!$('cabinet-dialog').open||gate.busy)return false;
    if(selectedGame==='volleyball'&&window.NanoOrientation&&!window.NanoOrientation.prepare(single))return false;
    await ready;if(!wallet){openWallet('请先恢复钱包连接或验证邮箱。');return false;}
    const frame=$('game-frame-host').firstChild,gameId=selectedGame;
    $('game-status').textContent='正在确认能量，请稍候…';
    try{
      const allowed=await gate.request({playerId:wallet.player_id,gameId,isCurrent:()=>$('cabinet-dialog').open&&$('game-frame-host').firstChild===frame&&selectedGame===gameId});
      if(allowed){$('game-status').textContent=wallet.is_vip?'VIP 畅玩，本局不扣能量。':'已确认 1 枚能量，祝你玩得开心！';return true;}
      return false;
    }catch(e){openWallet(message(e));return false;}
  }});
  window.addEventListener('storage',event=>{if(event.key==='nanofun.wallet.auth.v1')location.reload();});
  const session=new URL(location.href).searchParams.get('session_id');
  if(session)ready.then(async()=>{if(!wallet||wallet.kind!=='email'){openWallet('请登录付款时使用的邮箱，以核验订单。');return;}try{accept((await client.verifyCheckout(session)).wallet);openWallet('订单已核验，余额已更新。');history.replaceState({},'',location.pathname+location.hash);}catch(e){openWallet(message(e));}});
  render();
})();
