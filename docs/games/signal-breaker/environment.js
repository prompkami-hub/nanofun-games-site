import * as T from './vendor/three.module.min.js';
// Original modular environment. Geometry and texture generation are deterministic.
export function buildVillage(scene, world, renderer, cover, mobile){
 let seed=7391;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.78,...extra});
 function texture(kind){const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d');p.fillStyle=kind==='stone'?'#64716d':kind==='wood'?'#544034':'#b4ada0';p.fillRect(0,0,512,512);
 for(let i=0;i<18000;i++){const a=rand()*.15;p.fillStyle=rand()>.5?'rgba(255,255,255,'+a+')':'rgba(0,0,0,'+a+')';p.fillRect(rand()*512,rand()*512,1+rand()*3,1+rand()*3);}
 if(kind==='stone'){for(let row=0;row<8;row++)for(let col=-1;col<9;col++){const x=col*64+(row%2)*32,y=row*64;p.strokeStyle='#283e3b';p.lineWidth=3;p.strokeRect(x+1,y+1,62,62);p.strokeStyle='#85918a';p.lineWidth=1;p.strokeRect(x+5,y+5,54,54);p.fillStyle='rgba(29,52,37,.2)';p.fillRect(x+3,y+3,rand()*38,5);}}
 if(kind==='wood'){for(let i=0;i<180;i++){p.strokeStyle=i%3?'#332c2555':'#a28b6060';p.lineWidth=.3+rand();p.beginPath();const x=rand()*512;p.moveTo(x,0);p.bezierCurveTo(x+18,180,x-15,300,x+rand()*8,512);p.stroke();}for(let i=0;i<4;i++){p.strokeStyle='#211c1a';p.lineWidth=4;p.strokeRect(i*128,0,128,512);}}
 if(kind==='plaster'){for(let i=0;i<25;i++){let x=rand()*512,y=rand()*512;p.strokeStyle='#605f4b55';p.lineWidth=1;p.beginPath();p.moveTo(x,y);for(let j=0;j<6;j++){x+=rand()*14-7;y+=rand()*25;p.lineTo(x,y);}p.stroke();}const g=p.createLinearGradient(0,0,0,512);g.addColorStop(0,'#273d2a00');g.addColorStop(.6,'#273d2a00');g.addColorStop(1,'#263e3380');p.fillStyle=g;p.fillRect(0,0,512,512);}
 const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
 const stoneMap=texture('stone'),woodMap=texture('wood'),wallMap=texture('plaster');stoneMap.repeat.set(24,24);
 const stone=mat(0xb8c4bd,{map:stoneMap,bumpMap:stoneMap,bumpScale:.08,roughness:.28,metalness:.18});
 const wood=mat(0xc0b092,{map:woodMap,bumpMap:woodMap,bumpScale:.04}),dark=mat(0x202f2e,{map:woodMap}),wall=mat(0xc2c0a8,{map:wallMap,bumpMap:wallMap,bumpScale:.025}),tile=mat(0x536f70,{roughness:.26,metalness:.2}),edge=mat(0x718482,{roughness:.4}),red=mat(0x852f24,{map:woodMap}),moss=mat(0x344b2a),bronze=mat(0x98815b,{metalness:.7,roughness:.35}),paper=mat(0xffd3a0,{emissive:0xe88a36,emissiveIntensity:.55,roughness:.65});
 const geo={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,10),sphere:new T.SphereGeometry(1,12,8)};
 const batches=new Map(),dummy=new T.Object3D();
 function add(g,m,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){let key=g.uuid+m.uuid;if(!batches.has(key))batches.set(key,{g,m,list:[]});batches.get(key).list.push([x,y,z,sx,sy,sz,rx,ry,rz]);}
 const box=(m,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>add(geo.box,m,x,y,z,w,h,d,rx,ry,rz);
 const cyl=(m,x,y,z,r,h,rz=0)=>add(geo.cyl,m,x,y,z,r,h,r,0,0,rz);
 box(stone,0,-.22,0,64,.44,64);
 // Two stone storm-drain channels, inset grates and hand-set courtyard steps.
 for(const x of [-2.8,2.8]){box(dark,x,.006,0,.18,.018,56);for(let z=-28;z<29;z+=.6)box(bronze,x,.018,z,.21,.03,.055);}
 for(let i=0;i<5;i++)box(edge,0,.04,25+i*.5,4.6,.08,.38);
 cover.forEach(([x,z,w,d],index)=>{
 box(dark,x,1.65,z,w,3.3,d);box(wall,x,1.9,z,w-.12,2.8,d-.12);
 // Heavy timber corners, stone footings, weathered sills and rafters on all four sides.
 for(const sx of [-1,1])for(const sz of [-1,1]){box(wood,x+sx*(w/2-.09),1.8,z+sz*(d/2-.09),.2,3.6,.2);box(edge,x+sx*(w/2-.09),.25,z+sz*(d/2-.09),.38,.5,.38);}
 for(const side of [-1,1]){
 const zz=z+side*(d/2+.04);box(wood,x,.55,zz,w,.18,.14);box(wood,x,3.15,zz,w,.18,.16);box(edge,x,.16,zz,w+.24,.3,.25);
 for(let k=-w/2+.65;k<w/2-.3;k+=1.15){const xx=x+k;box(dark,xx,1.85,zz+side*.05,.9,1.9,.09);box(paper,xx,1.85,zz+side*.11,.76,1.65,.02);for(let a=-.36;a<=.37;a+=.18)box(wood,xx+a,1.85,zz+side*.14,.025,1.7,.035);for(let y=1.1;y<2.7;y+=.32)box(wood,xx,y,zz+side*.14,.8,.025,.035);box(wood,xx,1,zz+side*.25,1.05,.08,.5);}
 for(let k=-w/2;k<=w/2;k+=.48)box(wood,x+k,3.36,zz+side*.4,.07,.15,1.1);
 }
 for(const side of [-1,1]){box(wood,x+side*w/2,1,z,.12,.12,d);for(let j=-d/2+.4;j<d/2;j+=.7)box(wood,x+side*(w/2+.01),1.8,z+j,.15,2.6,.08);}
 // Individually laid overlapping barrel tiles; batched into a few instanced draws.
 const roofY=3.65+d*.12;
 for(const side of [-1,1]){box(tile,x,roofY,z+side*d*.25,w+1,.15,d*.62,side*.4);for(let xx=-w/2-.45;xx<w/2+.5;xx+=mobile?.4:.26){for(let zz=0;zz<d*.55;zz+=.36){const y=roofY+.15+(d*.27-zz)*.4;add(geo.cyl,edge,x+xx,y,z+side*zz,.075,.4,.075,Math.PI/2+side*.38,0,0);}}box(dark,x,roofY+d*.11,z,w+1.2,.23,.28);for(const end of [-1,1])box(edge,x+end*(w/2+.4),roofY+d*.12+.16,z,.5,.14,.35,0,0,end*.26);}
 // Stone base, porch rails, hanging eave bells and layered fascia.
 box(wood,x,.37,z+d/2+.37,w+.5,.12,.75);for(const a of [-1,1]){cyl(bronze,x+a*(w/2-.35),3.1,z+d/2+.5,.055,.18);box(red,x+a*w/2,3.5,z+d/2+.4,.28,.1,.4);}
 });
 function lamp(x,z){const g=new T.Group();g.position.set(x,0,z);world.add(g);box(edge,x,.22,z,.8,.44,.8);cyl(dark,x,1.1,z,.085,1.8);box(dark,x,2.2,z,.7,.12,.7);box(paper,x,1.82,z,.45,.65,.45);box(dark,x,1.45,z,.7,.12,.7);for(const a of [-1,1])for(const b of [-1,1])box(dark,x+a*.23,1.83,z+b*.23,.045,.7,.045);for(let i=0;i<5;i++)box(dark,x,2.24+i*.07,z,.8-i*.12,.08,.8-i*.12);const l=new T.PointLight(0xffa252,mobile?4:7,11,2);l.position.set(x,1.85,z);world.add(l);}
 [[-4,23],[4,23],[-17,4],[15,-4],[-24,-24],[24,-24],[-25,15],[23,12],[-10,-9],[8,-22]].forEach(([x,z])=>lamp(x,z));
 // Boundary walls: stone courses, tile caps, wooden gates.
 for(const side of [-1,1]){box(dark,side*30,1,0,.4,2,60);box(dark,0,1,side*30,60,2,.4);for(let j=-29;j<=29;j+=1.4){box(edge,side*30,.45,j,.7,.9,1.2);box(tile,side*30,2.12,j,.8,.2,1.4);box(edge,j,.45,side*30,1.2,.9,.7);box(tile,j,2.12,side*30,1.4,.2,.8);}}
 // Gate with mortise beams, endcaps, shimenawa rope, paper wards and brass bosses.
 for(const a of [-1,1]){cyl(red,a*2.6,2.5,26,.22,5);box(edge,a*2.6,.3,26,.7,.6,.7);for(const y of [.65,3.8])cyl(bronze,a*2.6,y,26,.235,.1);}
 box(red,0,4.25,26,6.1,.25,.38);box(dark,0,5.1,26,7,.28,.6);for(let i=-3;i<=3;i++)box(tile,i,5.27+Math.abs(i)*.04,26,1.1,.18,.8,0,0,i*.035);
 for(let i=-12;i<=12;i++){const xx=i*.18,yy=4.35-.26*(1-xx*xx/5);add(geo.sphere,bronze,xx,yy,26.12,.13,.055,.055);if(i%4===0){box(wall,xx,yy-.27,26.16,.12,.4,.015,0,0,.2);box(wall,xx+.08,yy-.51,26.16,.12,.25,.015,0,0,-.25);}}
 // Dense bamboo canopy with nodes and lance-shaped leaves; rings of cliffs behind it.
 const leafGeom=new T.BufferGeometry();leafGeom.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.16,.12,.65,0,0,1.3,-.16,.12,.65],3));leafGeom.setIndex([0,1,2,0,2,3]);leafGeom.computeVertexNormals();const leaves=mat(0x50775c,{side:T.DoubleSide});
 for(let i=0;i<(mobile?120:240);i++){const a=i*2.39996,r=32+rand()*12,x=Math.cos(a)*r,z=Math.sin(a)*r,h=7+rand()*9;cyl(moss,x,h/2,z,.08+rand()*.06,h,(rand()-.5)*.12);for(let y=1;y<h;y+=1.1)cyl(edge,x,y,z,.105,.035);for(let j=0;j<7;j++)add(leafGeom,leaves,x+(rand()-.5)*2,h*.65+rand()*h*.4,z+(rand()-.5)*2,1,1,1,-.4+rand(),rand()*6,rand()-.5);}
 const rockGeo=new T.IcosahedronGeometry(1,1);for(let i=0;i<38;i++){const a=i*2.4,r=45+rand()*12;add(rockGeo,mat(0x354b48),Math.cos(a)*r,1,Math.sin(a)*r,4+rand()*4,5+rand()*10,4+rand()*3,rand(),rand(),rand());}
 // Small dressing stays inside solid building footprints to keep movement honest.
 for(const [x,z,w,d] of cover){for(let i=0;i<3;i++){const xx=x+(rand()-.5)*w*.7,zz=z+(rand()-.5)*d*.7;box(wood,xx,.55,zz,.85,1.1,.85);for(const y of [.15,.9])box(bronze,xx,y,zz,.9,.07,.9);}for(let i=0;i<4;i++){const xx=x+(rand()-.5)*w,zz=z+(rand()-.5)*d;add(rockGeo,moss,xx,.08,zz,.4,.12,.35,0,rand()*6,0);}}
 // Street-edge ferns, fallen leaves and gravel break up the pristine courtyard.
 const fern=mat(0x52744c,{side:T.DoubleSide}),fallen=mat(0x987647,{side:T.DoubleSide});
 for(let i=0;i<(mobile?160:350);i++){const a=rand()*Math.PI*2,rad=25+rand()*4,x=Math.cos(a)*rad,z=Math.sin(a)*rad;if(Math.abs(x)<3&&z>23)continue;for(let j=0;j<3;j++)add(leafGeom,fern,x,.04,z,.22,.25,.3,-.9,rand()*6,0);}
 for(let i=0;i<100;i++){const x=(rand()-.5)*56,z=(rand()-.5)*56;add(leafGeom,fallen,x,.035,z,.11,.03,.13,-Math.PI/2,rand()*6,0);}
 // Silk banners, turned rain chains and brass fittings under the eaves.
 for(const [x,z,w,d]of cover){const xx=x-w/2+.22,zz=z+d/2+.38;for(let y=.5;y<3.2;y+=.16)add(geo.sphere,bronze,xx,y,zz,.03,.06,.03);box(red,x+w/2-.4,2.65,zz,.56,.85,.025);for(let k=0;k<3;k++)box(paper,x+w/2-.4,2.4+k*.18,zz+.02,.2,.045,.01);}
 for(const b of batches.values()){const mesh=new T.InstancedMesh(b.g,b.m,b.list.length);b.list.forEach((a,i)=>{dummy.position.set(...a.slice(0,3));dummy.scale.set(...a.slice(3,6));dummy.rotation.set(...a.slice(6,9));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=b.m!==paper;mesh.receiveShadow=true;mesh.frustumCulled=true;world.add(mesh);}
 // Rain streaks, not point dots. GPU animation keeps draw calls and CPU cost bounded.
 const n=mobile?600:1400,positions=new Float32Array(n*6);for(let i=0;i<n;i++){const x=(rand()-.5)*70,y=rand()*23,z=(rand()-.5)*70;positions.set([x,y,z,x+.035,y+.42,z],i*6);}const rainG=new T.BufferGeometry();rainG.setAttribute('position',new T.BufferAttribute(positions,3));const rainM=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'uniform float time;void main(){vec3 p=position;p.y=mod(p.y-time*11.,23.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(.65,.81,.84,.22);}'});world.add(new T.LineSegments(rainG,rainM));
 const water=new T.MeshPhysicalMaterial({color:0x839d97,metalness:.75,roughness:.07,transparent:true,opacity:.48,clearcoat:1,clearcoatRoughness:.08});const pools=[];for(const [x,z,sx,sz]of[[-1,21,2,.7],[7,20,3,.8],[-6,6,3,1],[19,10,2,.8],[-23,-12,3,1.2],[4,-15,4,1],[-19,-25,3,.6]]){const p=new T.Mesh(new T.CircleGeometry(1,48),water);p.rotation.x=-Math.PI/2;p.position.set(x,.028,z);p.scale.set(sx,sz,1);world.add(p);pools.push(p);}
 // A local environment probe provides actual scene reflections on wet stone and metal.
 const target=new T.WebGLCubeRenderTarget(mobile?64:128,{type:T.HalfFloatType,generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter});const probe=new T.CubeCamera(.1,140,target);probe.position.set(0,2,18);scene.add(probe);pools.forEach(p=>p.visible=false);probe.update(renderer,scene);pools.forEach(p=>p.visible=true);scene.environment=target.texture;water.envMap=target.texture;water.envMapIntensity=1.7;stone.envMapIntensity=.35;tile.envMapIntensity=.5;
 let objects=0;world.traverse(()=>objects++);
 return {update(t){rainM.uniforms.time.value=t;},stats:{instances:[...batches.values()].reduce((n,b)=>n+b.list.length,0),batches:batches.size,objects,reflectionProbe:true,texturedMaterials:true}};
}
