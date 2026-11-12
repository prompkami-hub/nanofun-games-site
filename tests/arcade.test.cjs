const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const {createRoundGate}=require('../dist/round-gate.js');

async function harness({fail=false}={}) {
 const nodes=new Map(),store=new Map();let coins=5,calls=0;
 function node(id){if(nodes.has(id))return nodes.get(id);const n={id,dataset:{},textContent:'',hidden:false,disabled:false,open:false,value:'',children:[],handlers:{},classList:{add(){},remove(){}},addEventListener(type,fn){this.handlers[type]=fn;},focus(){},scrollIntoView(){},replaceChildren(...items){this.children=items;this.firstChild=items[0];},showModal(){this.open=true;},close(){this.open=false;this.handlers.close?.();},checkValidity(){return this.value.includes('@');}};nodes.set(id,n);return n;}
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 const snapshot=()=>({player_id:'nf_test',kind:'guest',coins,daily_available:false,checkout_ready:{coins_50:false,vip_year:false}});
 const client={guest:async()=>{if(fail)throw Error('network');return snapshot();},start:async()=>{calls++;if(coins<=0)throw Error('insufficient_coins');return {wallet:{...snapshot(),coins:--coins}};}};
 const window={addEventListener(){},NanoFunWalletClient:{createWalletClient:()=>client},NanoFunRoundGate:{createRoundGate:options=>createRoundGate({...options,uuid:()=>webcrypto.randomUUID()})}};
 const sandbox={document:{getElementById:node,querySelectorAll:()=>[],createElement:t=>node(t+Math.random())},localStorage,window,location:{href:'https://nanofungames.com/',origin:'https://nanofungames.com'},URL,Date,setTimeout:()=>0,clearTimeout(){},console};
 vm.runInNewContext(fs.readFileSync('dist/arcade.js','utf8'),sandbox);
 await new Promise(resolve=>setImmediate(resolve));
 return {node,window,click:id=>node(id).handlers.click(),balance:()=>Number(node('header-balance').textContent),calls:()=>calls};
}
test('Server-authorized guest rounds: opening free, five starts, sixth blocked',async()=>{
 const h=await harness();assert.equal(h.balance(),5);h.click('play-snake');assert.equal(h.calls(),0);
 for(let i=0;i<5;i++)assert.equal(await h.window.NanoArcade.requestMatch(),true);
 assert.equal(h.balance(),0);assert.equal(await h.window.NanoArcade.requestMatch(),false);assert.equal(h.node('wallet-dialog').open,true);
 assert.equal(h.node('reward-button').disabled,true);assert.equal(h.node('coins-buy').disabled,true);assert.equal(h.node('vip-buy').disabled,true);
 h.click('exit-game');const count=h.calls();assert.equal(await h.window.NanoArcade.requestMatch(),false);assert.equal(h.calls(),count);
});
test('All five game cabinets await authorization; orientation gate never spends a coin',async()=>{
 const h=await harness();h.click('play-button');h.window.NanoOrientation={prepare:()=>false};assert.equal(await h.window.NanoArcade.requestMatch(false),false);assert.equal(h.calls(),0);h.click('exit-game');
 for(const game of ['2048','snake','drift-coast','signal-breaker']){const before=h.balance();h.click('play-'+game);assert.match(h.node('game-frame-host').firstChild.src,new RegExp('games/'+game+'/'));assert.equal(h.balance(),before);assert.equal(await h.window.NanoArcade.requestMatch(),true);assert.equal(h.balance(),before-1);h.click('exit-game');}
});
test('Unavailable server wallet fails closed instead of trusting local demo coins',async()=>{
 const h=await harness({fail:true});h.click('play-snake');assert.equal(await h.window.NanoArcade.requestMatch(),false);assert.equal(h.calls(),0);assert.equal(h.node('wallet-dialog').open,true);
});
