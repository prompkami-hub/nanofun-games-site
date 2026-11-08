const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRoundGate}=require('../dist/round-gate.js');
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('A lost start response retries the same operation and charges once',async()=>{
 let coins=5,seen=new Set(),attempt=0,ids=[];const store=storage();
 const gate=createRoundGate({storage:store,uuid:()=> 'operation',client:{async start(id){ids.push(id);if(!seen.has(id)){seen.add(id);coins--;}if(++attempt===1)throw Error('wallet_unavailable');return {wallet:{coins}};}}});
 await assert.rejects(gate.request({playerId:'p',gameId:'snake'}));assert.equal(coins,4);
 assert.equal(await gate.request({playerId:'p',gameId:'snake'}),true);assert.deepEqual(ids,['operation','operation']);assert.equal(coins,4);
});
test('Concurrent clicks cannot start two rounds using one charge',async()=>{
 let finish,calls=0;const gate=createRoundGate({storage:storage(),uuid:()=> 'one',client:{start(){calls++;return new Promise(r=>finish=r);}}});
 const a=gate.request({playerId:'p',gameId:'2048'});assert.equal(await gate.request({playerId:'p',gameId:'2048'}),false);finish({wallet:{coins:4}});assert.equal(await a,true);assert.equal(calls,1);
});
test('Closing a cabinet while authorizing retains recovery and blocks changing its game',async()=>{
 const ids=[],store=storage();let current=false;
 const gate=createRoundGate({storage:store,uuid:()=> 'pending',client:{async start(id){ids.push(id);return {wallet:{coins:4}};}}});
 assert.equal(await gate.request({playerId:'p',gameId:'snake',isCurrent:()=>current}),false);
 await assert.rejects(gate.request({playerId:'p',gameId:'2048'}),/previous_game_round_pending/);
 current=true;assert.equal(await gate.request({playerId:'p',gameId:'snake',isCurrent:()=>current}),true);assert.deepEqual(ids,['pending','pending']);
});
