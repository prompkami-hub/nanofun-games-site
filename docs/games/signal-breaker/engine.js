(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const COVER=[[-11,12,8,4], [11,8,7,5],[-9,-2,7,5],[7,-8,6,7],[-23,-7,4,9],[21,0,4,8],[-3,-20,9,4],[0,18,4,3],[22,24,5,4],[-23,22,5,4]];
 const RELAYS=[[-19,-20],[20,-17],[16,19]];
 function create(difficulty='normal'){
  const spawns=[[-21,3],[19,-5],[-12,-16],[8,-24],[23,13],[-20,-24],[23,-24],[-25,14]];
  return {phase:'playing',difficulty,time:0,health:100,ammo:24,reload:0,cooldown:0,invulnerable:0,stamina:100,kills:0,shots:0,hits:0,player:{x:0,z:26,yaw:0,pitch:0},relays:RELAYS.map(([x,z],i)=>({x,z,off:false,progress:0,id:i})),enemies:spawns.map(([x,z],i)=>({x,z,y:i%3===0? .85:2.1,radius:i%3===0?.7:.8,hp:i%3===0?3:2,type:i%3===0?'crawler':'drone',attack:1+i*.17,seed:i,alert:false})),events:[],extraction:{x:0,z:26},extracted:false};
 }
 function blocked(x,z,r=.36){return Math.abs(x)>29-r||Math.abs(z)>29-r||COVER.some(([cx,cz,w,d])=>Math.hypot(x-clamp(x,cx-w/2,cx+w/2),z-clamp(z,cz-d/2,cz+d/2))<r);}
 function move(p,dx,dz,r=.36){if(!blocked(p.x+dx,p.z,r))p.x+=dx;if(!blocked(p.x,p.z+dz,r))p.z+=dz;}
 function segmentBox(o,dir,b,max=Infinity){let near=0,far=max;for(const axis of ['x','y','z']){const lo=b[axis][0],hi=b[axis][1],v=dir[axis];if(Math.abs(v)<1e-8){if(o[axis]<lo||o[axis]>hi)return Infinity;}else{let a=(lo-o[axis])/v,c=(hi-o[axis])/v;if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>far)return Infinity;}}return near;}
 function wallDistance(o,d,max=Infinity){return Math.min(max,...COVER.map(([x,z,w,h])=>segmentBox(o,d,{x:[x-w/2,x+w/2],y:[0,3.4],z:[z-h/2,z+h/2]},max)));}
 function lineOfSight(a,b){let dx=b.x-a.x,dz=b.z-a.z,dist=Math.hypot(dx,dz);return wallDistance({x:a.x,y:1.5,z:a.z},{x:dx/dist,y:0,z:dz/dist},dist)>=dist-.1;}
 function nearestRelay(s){return s.relays.filter(r=>!r.off).map(r=>({relay:r,distance:Math.hypot(r.x-s.player.x,r.z-s.player.z)})).sort((a,b)=>a.distance-b.distance)[0]||null;}
 function reload(s){if(s.phase==='playing'&&!s.reload&&s.ammo<24){s.reload=1.4;s.events.push({type:'reload'});}}
 function shoot(s){
  if(s.phase!=='playing'||s.reload||s.cooldown)return null;
  if(!s.ammo){reload(s);return null;}
  s.ammo--;s.shots++;s.cooldown=.19;const p=s.player,cp=Math.cos(p.pitch),d={x:-Math.sin(p.yaw)*cp,y:Math.sin(p.pitch),z:-Math.cos(p.yaw)*cp},o={x:p.x,y:1.65,z:p.z};let distance=wallDistance(o,d,60),target=null;
  for(const e of s.enemies){if(e.hp<=0)continue;const v={x:e.x-o.x,y:e.y-o.y,z:e.z-o.z},t=v.x*d.x+v.y*d.y+v.z*d.z,disc=e.radius*e.radius-(v.x*v.x+v.y*v.y+v.z*v.z-t*t);if(disc>=0&&t>0){const hit=t-Math.sqrt(disc);if(hit<distance){distance=hit;target=e;}}}
  if(target){target.hp--;target.alert=true;s.hits++;if(!target.hp)s.kills++;}const hit={type:'shot',distance,target:!!target,killed:!!target&&target.hp===0,origin:o,direction:d};s.events.push(hit);return hit;
 }
 function update(s,input,dt){
  if(s.phase!=='playing')return;s.time+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.invulnerable=Math.max(0,s.invulnerable-dt);
  if(s.reload){s.reload=Math.max(0,s.reload-dt);if(!s.reload){s.ammo=24;s.events.push({type:'loaded'});}}
  const p=s.player,rawX=input.x||0,rawF=input.forward||0,n=Math.max(1,Math.hypot(rawX,rawF));let speed=5.2;const sprint=input.sprint&&s.stamina>1&&n>0&&!!(rawX||rawF);if(sprint){speed=8;s.stamina=Math.max(0,s.stamina-dt*28);}else s.stamina=Math.min(100,s.stamina+dt*19);
  move(p,(rawX*Math.cos(p.yaw)-rawF*Math.sin(p.yaw))/n*speed*dt,(-rawX*Math.sin(p.yaw)-rawF*Math.cos(p.yaw))/n*speed*dt);
  const near=nearestRelay(s);for(const r of s.relays){if(r.off)continue;if(near?.relay===r&&near.distance<3.3&&input.interact){r.progress=Math.min(1,r.progress+dt/1.25);if(r.progress===1){r.off=true;s.health=Math.min(100,s.health+18);s.events.push({type:'relay',id:r.id});}}else r.progress=Math.max(0,r.progress-dt*.6);}
  const complete=s.relays.every(r=>r.off);if(complete&&Math.hypot(p.x-s.extraction.x,p.z-s.extraction.z)<2.6){s.phase='won';s.extracted=true;s.events.push({type:'won'});return;}
  for(const e of s.enemies){if(e.hp<=0)continue;const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz),visible=dist<23&&lineOfSight(e,p);if(visible)e.alert=true;let tx, tz;
   if(e.alert&&dist> (e.type==='crawler'?1.2:7)){tx=dx;tz=dz;}else if(!e.alert){tx=Math.sin(s.time*.25+e.seed)*.4;tz=Math.cos(s.time*.3+e.seed)*.4;}else{tx=Math.cos(s.time+e.seed)*.3;tz=Math.sin(s.time+e.seed)*.3;}
   const len=Math.max(1,Math.hypot(tx,tz)),v=e.type==='crawler'?2.5:1.9;move(e,tx/len*v*dt,tz/len*v*dt,.65);e.attack-=dt;
   if(e.attack<=0&&visible&&dist<(e.type==='crawler'?1.65:22)){e.attack=e.type==='crawler'?.9:1.9+e.seed*.08;s.events.push({type:'enemyfire',x:e.x,y:e.y,z:e.z});if(!s.invulnerable){s.health=Math.max(0,s.health-(s.difficulty==='easy'?3:6));s.invulnerable=.38;s.events.push({type:'hurt'});}}
  }
  if(s.health<=0){s.phase='lost';s.events.push({type:'lost'});}
 }
 const api={COVER,RELAYS,create,blocked,move,lineOfSight,nearestRelay,reload,shoot,update,wallDistance};if(typeof module!=='undefined')module.exports=api;else root.SignalBreakerEngine=api;
})(typeof window==='undefined'?globalThis:window);
