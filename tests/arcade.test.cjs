const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');

function harness(storage=new Map(),session=new Map()) {
  const nodes=new Map();
  function node(id){if(nodes.has(id))return nodes.get(id);const n={id,dataset:{},textContent:'',hidden:false,disabled:false,open:false,value:'',children:[],handlers:{},classList:{add(){},remove(){}},addEventListener(type,fn){this.handlers[type]=fn;},append(...items){this.children.push(...items);this.firstChild=this.children[0];},replaceChildren(...items){this.children=items;this.firstChild=items[0];},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();},checkValidity(){return this.value.includes('@');},reportValidity(){}};nodes.set(id,n);return n;}
  const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
  const window={addEventListener(){}};
  const sandbox={document:{getElementById:node,querySelectorAll:()=>[],createElement:t=>node(t+Math.random())},localStorage,sessionStorage:{getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)},window,crypto:webcrypto,TextEncoder,Date,setTimeout:()=>0,clearTimeout(){},console};
  vm.runInNewContext(fs.readFileSync('dist/arcade.js','utf8'),sandbox);
  return {node,storage,session,window,click:id=>node(id).handlers.click(),async login(email){node('email').value=email;await node('email-form').handlers.submit({preventDefault(){},submitter:node('submit')});},balance:()=>Number(node('header-balance').textContent)};
}

test('Daily grant, per-match charge, zero balance, simulated reward and persistence',async()=>{
 const h=harness(new Map(),new Map([["nanofun.arcade.guest.v1",'{"coins":0}']]));assert.equal(h.balance(),0);
 assert.equal(h.window.NanoArcade.requestMatch(),false,'unauthenticated cannot play');
 await h.login('arcade-test@example.com');assert.equal(h.balance(),10);
 h.click('daily-button');assert.equal(h.balance(),10,'daily reward cannot repeat');
 h.click('reward-button');assert.equal(h.balance(),10,'ad reward unavailable before empty');
 h.click('play-button');assert.equal(h.balance(),10,'opening cabinet is free');
 h.window.NanoOrientation={prepare:()=>false};assert.equal(h.window.NanoArcade.requestMatch(false),false);assert.equal(h.balance(),10,'waiting for landscape never charges');
 delete h.window.NanoOrientation;
 for(let i=0;i<10;i++)assert.equal(h.window.NanoArcade.requestMatch(),true);
 assert.equal(h.balance(),0);assert.equal(h.window.NanoArcade.requestMatch(),false);assert.equal(h.balance(),0);
 h.click('reward-button');assert.equal(h.balance(),10);
 h.click('reward-button');assert.equal(h.balance(),10,'reward cannot double-credit');
 const next=harness(h.storage,h.session);assert.equal(next.balance(),10,'refresh preserves balance');
 next.click('switch-account');await next.login('ARCADE-TEST@EXAMPLE.COM');assert.equal(next.balance(),10,'email normalization prevents extra daily grant');
 const raw=[...h.storage.values()].join('');assert.ok(!raw.includes('arcade-test@example.com'),'full email is not persisted');
 next.click('exit-game');assert.equal(next.window.NanoArcade.requestMatch(),false,'closed cabinet cannot charge');
});

test('2048 and Snake select distinct frames and charge only on actual start',async()=>{
 const h=harness(new Map(),new Map([["nanofun.arcade.guest.v1",'{"coins":0}']]));await h.login('classics-test@example.com');
 h.window.NanoOrientation={prepare:()=>{throw Error('puzzle must not use volleyball orientation gate');}};
 for(const game of ['2048','snake']){
 const before=h.balance();h.click('play-'+game);assert.equal(h.balance(),before);assert.match(h.node('game-frame-host').firstChild.src,new RegExp('games/'+game+'/'));
 assert.equal(h.node('cabinet-dialog').dataset.game,game);assert.equal(h.window.NanoArcade.requestMatch(true),true);assert.equal(h.balance(),before-1);
 h.click('exit-game');assert.equal(h.node('game-frame-host').children.length,0);
 }
 const raw=[...h.storage.values()].join('');assert.ok(raw.includes('2048开赛'));assert.ok(raw.includes('贪吃蛇开赛'));
});

test('Welcome grant permits five plays, persists across tabs, and sixth start asks for email',async()=>{
 const h=harness();assert.equal(h.balance(),5);assert.equal(h.node('wallet-dialog').open,false);
 h.click('play-snake');assert.equal(h.node('wallet-dialog').open,false);
 for(let i=0;i<5;i++){assert.equal(h.window.NanoArcade.requestMatch(),true);assert.equal(h.node('wallet-dialog').open,false);}
 assert.equal(h.balance(),0);assert.equal(h.window.NanoArcade.requestMatch(),false);assert.equal(h.node('wallet-dialog').open,true);assert.equal(h.node('email-form').hidden,false);
 const refreshed=harness(h.storage,h.session);assert.equal(refreshed.balance(),0);assert.equal(refreshed.node('wallet-dialog').open,false);refreshed.click('play-2048');assert.equal(refreshed.node('wallet-dialog').open,false);assert.equal(refreshed.window.NanoArcade.requestMatch(),false);
 await refreshed.login('guest-test@example.com');assert.equal(refreshed.balance(),10);refreshed.node('wallet-dialog').close();assert.equal(refreshed.window.NanoArcade.requestMatch(),true);assert.equal(refreshed.balance(),9);
 const newSession=harness(h.storage);assert.equal(newSession.balance(),9,'new tab does not refill the welcome grant');
});
test('Guest coins cannot unlock ads early and are not refilled by identity switching',async()=>{
 const h=harness();await h.login('early@example.com');assert.equal(h.balance(),15);h.click('reward-button');assert.equal(h.balance(),15);h.click('play-snake');h.window.NanoArcade.requestMatch();assert.equal(h.balance(),14);h.click('switch-account');assert.equal(h.balance(),4);assert.equal(harness(h.storage,h.session).balance(),4);
});

 test('Welcome balance is shared between tabs and migration does not refill used coins',()=>{
 const store=new Map(),a=harness(store),b=harness(store);
 a.click('play-snake');b.click('play-2048');
 for(let i=0;i<5;i++)assert.equal((i%2?a:b).window.NanoArcade.requestMatch(),true);
 assert.equal(a.window.NanoArcade.requestMatch(),false);
 assert.equal(b.window.NanoArcade.requestMatch(),false);
 assert.equal(a.balance(),0);assert.equal(b.balance(),0);
 assert.equal(harness(store).balance(),0);
 const migrated=harness(new Map(),new Map([["nanofun.arcade.guest.v1",'{"coins":2}']]));
 assert.equal(migrated.balance(),2);assert.equal(harness(migrated.storage).balance(),2);
 const corrupt=harness(new Map([["nanofun.arcade.guest.v1",'bad json']]));
 assert.equal(corrupt.balance(),0);
 });

test('Guest starts fail closed when storage cannot persist a spend',()=>{
 const store=new Map();const h=harness(store);assert.equal(h.balance(),5);h.click('play-snake');
 store.set=()=>{throw new Error('quota exceeded');};
 assert.equal(h.window.NanoArcade.requestMatch(),false);
 assert.equal(JSON.parse(store.get('nanofun.arcade.guest.v1')).coins,5);
});
