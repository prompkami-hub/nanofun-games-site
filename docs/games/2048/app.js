'use strict';
const $=id=>document.getElementById(id),E=Puzzle2048;
let board=Array(16).fill(0),score=0,best=0,playing=false,paused=false,won=false,pointer=null;
try{best=Number(localStorage.getItem('nanofun.2048.best'))||0;}catch{}
function render(previous=[]){$('board').replaceChildren(...board.map((value,i)=>{const el=document.createElement('div');el.className='tile'+(value>=2048?' high':'')+(value&&value!==previous[i]?' pop':'');el.dataset.value=value;el.textContent=value||'';return el;}));$('score').textContent=score;$('best').textContent=best;}
function overlay(title,message,mode){$('title').textContent=title;$('message').textContent=message;$('overlay').hidden=false;$('start').hidden=mode==='resume';$('start').textContent=playing?'再来一局 · 1 币':'开始游戏 · 1 币';$('continue').hidden=!mode;$('continue').textContent=mode==='win'?'继续挑战 · 免费':'继续游戏 · 免费';}
function pay(){try{return parent!==window&&parent.NanoArcade?parent.NanoArcade.requestMatch(true):true;}catch{return false;}}
let authorizing=false;
async function start(){if(authorizing)return;authorizing=true;NanoSFX.unlock();try{if(!await pay())return;NanoSFX.play('start');board=E.spawn(E.spawn(Array(16).fill(0)));score=0;playing=true;paused=false;won=false;$('overlay').hidden=true;$('pause').disabled=false;$('restart').disabled=false;$('pause').textContent='暂停';$('status').textContent='目标 2048 · 慢慢想，不限时';render();}finally{authorizing=false;}}
function pause(){if(!playing||paused)return;NanoSFX.stop();paused=true;$('pause').textContent='继续';overlay('休息一下。','这一局还在，准备好后继续。','resume');}
function resume(){if(!playing)return;NanoSFX.play('resume');paused=false;$('overlay').hidden=true;$('pause').textContent='暂停';}
function move(direction){if(!playing||paused)return;const result=E.move(board,direction);if(!result.changed)return;NanoSFX.play(result.score?'merge':'move',result.score);const previous=board;board=E.spawn(result.board);score+=result.score;if(score>best){best=score;try{localStorage.setItem('nanofun.2048.best',best);}catch{}}render(previous);$('status').textContent=result.score?'合并 +'+result.score+' 分':'继续寻找下一次合并';if(!won&&board.some(v=>v>=2048)){won=true;paused=true;NanoSFX.play('win');overlay('2048，做到了！','可以免费继续，挑战 4096 和更高数字。','win');}else if(!E.canMove(board)){playing=false;NanoSFX.play('lose');$('pause').disabled=true;overlay('这一步，到这里。','本局 '+score+' 分。下次试试把大数字留在角落。');}}
$('start').onclick=start;$('restart').onclick=()=>{pause();overlay('重新开一局？','重新开始会结束当前棋盘，并扣 1 枚模拟币。',playing?'resume':null);$('start').hidden=false;};$('continue').onclick=()=>{resume();if(!E.canMove(board)){playing=false;$('pause').disabled=true;overlay('棋盘已满。','本局 '+score+' 分，再来挑战一次吧。');}};$('pause').onclick=()=>paused?resume():pause();
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
document.addEventListener('keydown',e=>{const d=keys[e.key]||keys[e.key.toLowerCase()];if(d){e.preventDefault();move(d);}if(e.code==='Space'){e.preventDefault();paused?resume():pause();}});
$('board').addEventListener('pointerdown',e=>{if(pointer)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};$('board').setPointerCapture(e.pointerId);});
$('board').addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.max(Math.abs(dx),Math.abs(dy))>=20)move(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
['pointercancel','lostpointercapture'].forEach(type=>$('board').addEventListener(type,()=>pointer=null));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data==='nanofun:pause')pause();});
['gesturestart','dblclick','contextmenu'].forEach(type=>document.addEventListener(type,e=>e.preventDefault(),{passive:false}));
if(parent===window){$('kicker').textContent='独立试玩 · 不计模拟币';$('start').textContent='开始试玩';}
render();
