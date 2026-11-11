(function(root){
'use strict';
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mod=(n,m)=>(n%m+m)%m;
function track(theme='marina',count=640){
 const points=[];let length=0;
 for(let i=0;i<=count;i++){const t=i/count*TAU,r=theme==='alpine'?1:.0;points.push({x:Math.sin(t)*(94+19*Math.sin(t*3+.4+r)),y:theme==='alpine'?8+7*Math.sin(t*2):3+1.8*Math.sin(t*2),z:Math.cos(t)*(116+14*Math.cos(t*2+r))});}
 const distances=[0];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];length+=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);distances.push(length);}
 return {theme,points,distances,length,count};
}
function sample(t,s,d=0){
 const at=mod(s,t.length);let lo=0,hi=t.count;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(t.distances[mid]<=at)lo=mid;else hi=mid;}
 const a=t.points[lo],b=t.points[lo+1],f=(at-t.distances[lo])/(t.distances[lo+1]-t.distances[lo]);const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz),tx=dx/l,tz=dz/l;
 return {x:a.x+(b.x-a.x)*f+tz*d,y:a.y+(b.y-a.y)*f,z:a.z+(b.z-a.z)*f-tx*d,tx,tz,heading:Math.atan2(tx,tz)};
}
function bend(t,s){const a=sample(t,s-4),b=sample(t,s+4);return Math.atan2(a.tz*b.tx-a.tx*b.tz,a.tx*b.tx+a.tz*b.tz)/8;}
function create(theme='marina',laps=3){const road=track(theme);return {road,laps:clamp(Math.floor(laps)||3,1,3),player:{s:0,d:0,speed:0,lateral:0,charge:0,nitro:1,boost:0,driftTime:0,drifting:false,lapTimes:[],lastLap:0},bots:Array.from({length:5},(_,i)=>({s:9+i*7,d:(i%3-1)*3.2,speed:0,skill:.86+i*.027,lane:(i%3-1)*3.2})),time:0,finished:false,events:[],collideCooldown:0};}
function rank(g){return 1+g.bots.filter(b=>b.s>g.player.s).length;}
function step(g,input,dt){
 if(g.finished)return g;dt=clamp(Number(dt)||0,0,.05);if(!dt)return g;
 const p=g.player;g.time+=dt;g.events=[];g.collideCooldown=Math.max(0,g.collideCooldown-dt);
 const steer=clamp(Number(input.steer)||0,-1,1),throttle=clamp(Number(input.throttle)||0,0,1),curve=bend(g.road,p.s);
 if(input.nitro&&p.nitro>0&&p.boost<=0){p.nitro--;p.boost=2.1;g.events.push('nitro');}
 const drifting=!!input.drift&&Math.abs(steer)>.18&&p.speed>15;
 if(drifting){p.charge+=dt*(23+Math.abs(steer)*12);p.driftTime+=dt;if(p.charge>=100){p.charge-=100;if(p.nitro<2){p.nitro++;g.events.push('charged');}}}
 else if(p.drifting){if(p.driftTime>.5){p.boost=Math.max(p.boost,.55);g.events.push('mini');}p.driftTime=0;}
 p.drifting=drifting;p.boost=Math.max(0,p.boost-dt);
 const limit=p.boost>0?57:drifting?34:40;
 const acceleration=throttle*(p.boost>0?25:14)-3.6-(input.brake?30:0);
 p.speed=clamp(p.speed+acceleration*dt,0,limit);
 const target=-steer*(drifting?14:10)*(.25+p.speed/40)-curve*p.speed*p.speed*.20;
 p.lateral+=(target-p.lateral)*Math.min(1,dt*8);p.d+=p.lateral*dt;
 if(Math.abs(p.d)>6.15){p.speed=Math.min(20,Math.max(0,p.speed-5*dt));p.d=clamp(p.d,-6.8,6.8);}
 const before=Math.floor(p.s/g.road.length);p.s+=p.speed*dt;
 if(Math.floor(p.s/g.road.length)>before){p.lapTimes.push(g.time-p.lastLap);p.lastLap=g.time;g.events.push('lap');}
 for(const b of g.bots){const curve=Math.abs(bend(g.road,b.s));const wanted=(38-Math.min(12,curve*650))*b.skill;b.speed+=(wanted-b.speed)*Math.min(1,dt*1.8);b.s+=b.speed*dt;b.d=b.lane+Math.sin(b.s*.027+b.skill)*.8;
  const delta=mod(b.s-p.s+g.road.length/2,g.road.length)-g.road.length/2;
  if(!g.collideCooldown&&Math.abs(delta)<2.8&&Math.abs(b.d-p.d)<1.5&&p.speed>10){p.speed*=.68;p.d=clamp(p.d+(p.d>=b.d?.7:-.7),-6.8,6.8);g.collideCooldown=.8;g.events.push('bump');}
 }
 if(p.s>=g.road.length*g.laps){g.finished=true;g.events.push('finish');}
 return g;
}
// Track d is positive toward the chase camera's LEFT. Input steer remains screen-right positive.
function steerFromDrag(deltaX){return clamp(Number(deltaX)/55||0,-1,1);}
function steeringYaw(lateral,speed,drifting,steer){return lateral/Math.max(15,speed)-(drifting?steer*.32:0);}
function resetCar(g){g.player.d=0;g.player.speed=0;g.player.lateral=0;g.player.boost=0;g.player.drifting=false;g.player.driftTime=0;}
const api={track,sample,bend,create,step,rank,resetCar,steerFromDrag,steeringYaw,clamp};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DriftCoastEngine=api;
})(globalThis);
