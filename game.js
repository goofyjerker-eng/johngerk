import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec7e7);
scene.fog = new THREE.Fog(0x8ec7e7, 110, 175);
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 260);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.querySelector('#game').prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdaf0ff, 0x48633e, 2.05));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.7);
sun.position.set(-32, 58, 26); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-72; sun.shadow.camera.right=72; sun.shadow.camera.top=72; sun.shadow.camera.bottom=-72; sun.shadow.bias=-0.0002;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc9e7ff, 0.8); fill.position.set(40,22,-36); scene.add(fill);

const fieldLength=100, fieldWidth=64, goalZ=50, goalHalf=3.66, players=[];
const mats={
  grass:[0x4b9656,0x438b4e], line:0xf4f0df, white:0xf3f1e8, skin:0xb8a88e, boot:0x171a19,
  red:0xe5473e, redDark:0xa92828, blue:0x3279db, blueDark:0x214f9b,
  keeperHome:0xf2c544, keeperAway:0x61d6a1, shorts:0xf4f1e7
};
const mat=(color,roughness=.82)=>new THREE.MeshStandardMaterial({color,roughness});
const grassMats=mats.grass.map(c=>mat(c));
const whiteMat=mat(mats.line,.7), darkMat=mat(0x14231d), ballMat=mat(0xf6f3e8,.45), blackMat=mat(0x202321,.55);whiteMat.side=THREE.DoubleSide;
const boxGeo=new THREE.BoxGeometry(1,1,1), sphereGeo=new THREE.SphereGeometry(1,12,8), cylGeo=new THREE.CylinderGeometry(.16,.19,.45,6);
const crowdFans=[];
function mesh(geo,material,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1){if(!parent||typeof parent.add!=='function'){console.error('invalid mesh parent',parent,x,y,z,sx,sy,sz);throw new Error('Invalid mesh parent');}const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const markingMat=new THREE.MeshBasicMaterial({color:0xf4f0df,side:THREE.DoubleSide});
function addLine(points, material=markingMat, width=.105){
  const vertices=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,ox=-dz/length*width/2,oz=dx/length*width/2;
    vertices.push(a[0]+ox,.055,a[1]+oz,a[0]-ox,.055,a[1]-oz,b[0]+ox,.055,b[1]+oz,b[0]+ox,.055,b[1]+oz,a[0]-ox,.055,a[1]-oz,b[0]-ox,.055,b[1]-oz);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const line=new THREE.Mesh(geometry,material);line.receiveShadow=false;line.castShadow=false;scene.add(line);return line;
}
function rectLine(x1,z1,x2,z2){addLine([[x1,z1],[x2,z1],[x2,z2],[x1,z2],[x1,z1]]);}
function circleLine(cx,cz,r,a0=0,a1=Math.PI*2){const ps=[];for(let i=0;i<=72;i++){const a=a0+(a1-a0)*i/72;ps.push([cx+Math.cos(a)*r,cz+Math.sin(a)*r]);}addLine(ps);}
function addSpatialLine(a,b,material=whiteMat,radius=.035){const curve=new THREE.LineCurve3(new THREE.Vector3(...a),new THREE.Vector3(...b));const line=new THREE.Mesh(new THREE.TubeGeometry(curve,1,radius,5,false),material);line.castShadow=false;line.receiveShadow=false;scene.add(line);}
const adNames=['MOSSBALL','GOALMINT','TURF TALES','KICKKIT','NET NEST','PITCHPIXEL','HALF-TIME','SUNDAY CO.'];
const adPaint=['#233e39','#315b79','#586d45','#8b433c','#48524b','#a77c37','#29484d','#58618a'];
const adMaterials=adNames.map((name,i)=>{
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
  ctx.fillStyle=adPaint[i];ctx.fillRect(0,0,1024,256);ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(0,0,18,256);ctx.fillRect(1006,0,18,256);
  ctx.fillStyle='#f7f1df';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 106px system-ui, sans-serif';ctx.fillText(name,512,132);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  return new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
});
function addAdFace(width,height,x,y,z,rotation,index){const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),adMaterials[index%adMaterials.length]);face.position.set(x,y,z);face.rotation.y=rotation;face.renderOrder=2;face.castShadow=false;face.receiveShadow=false;scene.add(face);}

function buildPitch(){
  const outer=mesh(new THREE.PlaneGeometry(250,250),mat(0x728b65),scene,0,-.34,0);outer.rotation.x=-Math.PI/2;outer.receiveShadow=true;
  for(let i=0;i<10;i++){
    const z=-45+i*10, stripe=mesh(new THREE.PlaneGeometry(fieldWidth,10),grassMats[i%2],scene,0,-.015,z);stripe.rotation.x=-Math.PI/2;stripe.receiveShadow=true;
  }
  rectLine(-fieldWidth/2,-fieldLength/2,fieldWidth/2,fieldLength/2);
  addLine([[-fieldWidth/2,0],[fieldWidth/2,0]]);circleLine(0,0,9.15);
  const spot=mesh(new THREE.CircleGeometry(.18,16),whiteMat,scene,0,.06,0);spot.rotation.x=-Math.PI/2;
  for(const sign of [-1,1]){
    const end=sign*goalZ, boxEnd=sign*33, sixEnd=sign*39.5;
    rectLine(-20.16,sign>0?33.5:-50,20.16,sign>0?50:-33.5);
    rectLine(-9.16,sign>0?44.5:-50,9.16,sign>0?50:-44.5);
    const p=mesh(new THREE.CircleGeometry(.18,16),whiteMat,scene,0,.06,sign*39);p.rotation.x=-Math.PI/2;
    const arc=[],centerZ=sign*39,arcStart=Math.asin(5.5/9.15);for(let i=0;i<=32;i++){const a=arcStart+(Math.PI-2*arcStart)*i/32;arc.push([Math.cos(a)*9.15,centerZ-sign*Math.sin(a)*9.15]);}addLine(arc);
    makeGoal(sign);
  }
  // Keep the broadcast-camera touchline clear; the main grandstand sits farther back on the far side.
  const standColors=[0x59695f,0x64746a,0x718077,0x53645a,0x68796f,0x78867b];
  function supporterFan(x,y,z,index){
    const support=index%2, palette=support===0?[0xc94e43,0xe6ddd0,0xa73c35]:[0x527da9,0xe6ddd0,0x315d88];
    const fan=mesh(boxGeo,mat(palette[Math.floor(index/2)%palette.length]),scene,x,y,z);fan.scale.set(.32,.58,.34);fan.castShadow=false;
    fan.userData.support=support;fan.userData.baseY=y;fan.userData.cheerTime=0;fan.userData.phase=Math.random()*Math.PI*2;crowdFans.push(fan);
  }
  {
    const side=1,center=44.5;
    const base=mesh(new THREE.BoxGeometry(14,1.25,105),mat(0x34453e),scene,side*center,.62,0);base.castShadow=false;
    const rear=mesh(new THREE.BoxGeometry(1.1,8.3,105),mat(0x3e5148),scene,side*(center+6.7),4.15,0);rear.castShadow=false;
    for(let row=0;row<6;row++){
      const x=side*(38.6+row*1.72),y=1.35+row*.68;
      const tier=mesh(new THREE.BoxGeometry(1.8,.34,105),mat(standColors[row]),scene,x,y,0);tier.castShadow=false;
      for(let i=0;i<36;i++)supporterFan(side*(38.35+row*1.72),y+.47+((i+row)%3)*.055,-51.5+i*2.94,i+row);
    }
    const canopy=mesh(new THREE.BoxGeometry(15,.62,105),mat(0x243a33),scene,side*center,10.25,0);canopy.castShadow=false;
    const fascia=mesh(new THREE.BoxGeometry(15.3,.32,105.3),mat(0x879385),scene,side*center,9.75,0);fascia.castShadow=false;
    for(const z of [-52,-26,0,26,52]){
      const pillar=mesh(new THREE.BoxGeometry(.5,8.8,.65),mat(0x879385),scene,side*39.2,5.1,z);pillar.castShadow=false;
      const backPillar=mesh(new THREE.BoxGeometry(.45,8.8,.55),mat(0x65776e),scene,side*(center+6.3),5.1,z);backPillar.castShadow=false;
    }
    for(const z of [-53,53]){
      const mast=mesh(new THREE.CylinderGeometry(.19,.34,15,8),mat(0x34453e),scene,side*(center+6.5),7.5,z);mast.castShadow=false;
      const bank=mesh(new THREE.BoxGeometry(2.5,.36,.6),mat(0xe7e2cb),scene,side*(center+6.5),15.1,z);bank.castShadow=false;
    }
  }
  // Compact end stands behind both goals complete the ground without crowding the pitch.
  for(const end of [-1,1]){
    const base=mesh(new THREE.BoxGeometry(100,1.1,13),mat(0x34453e),scene,0,.55,end*59.5);base.castShadow=false;
    const rear=mesh(new THREE.BoxGeometry(100,6,.8),mat(0x3e5148),scene,0,3.6,end*66);rear.castShadow=false;
    for(let row=0;row<5;row++){
      const z=end*(53.2+row*2.1),y=1.25+row*.72;
      const tier=mesh(new THREE.BoxGeometry(99,.34,2.1),mat(standColors[row]),scene,0,y,z);tier.castShadow=false;
      for(let i=0;i<34;i++)supporterFan(-49.5+i*3,y+.47+((i+row)%3)*.05,z,i+row+(end>0?0:1));
    }
    // Matching cantilevered end roofs shelter both goal-end stands.
    const roof=mesh(new THREE.BoxGeometry(104,.62,15),mat(0x243a33),scene,0,10.25,end*60);roof.castShadow=false;
    const fascia=mesh(new THREE.BoxGeometry(104.3,.32,15.3),mat(0x879385),scene,0,9.75,end*60);fascia.castShadow=false;
    for(const x of [-49.5,49.5])for(const z of [end*53.8,end*66.2]){const post=mesh(new THREE.BoxGeometry(.55,8.8,.55),mat(0x879385),scene,x,5.1,z);post.castShadow=false;}
  }
  // Bright perimeter advertising, broken around the goals so the nets stay clear.
  const adColors=[0xf0c45b,0xe7e3d5,0xd84d40,0x315f8e,0x293c35,0x8ab39a];
  // No boards along the removed camera-side stand; the remaining fictional sponsors face into the field.
  for(const side of [1]){
    for(let i=0;i<20;i++){const z=-47.5+i*5,brand=i%adNames.length;const panel=mesh(new THREE.BoxGeometry(.28,1.05,4.7),mat(adColors[i%adColors.length],.58),scene,side*34.4,.55,z);panel.castShadow=false;addAdFace(4.55,.84,side*(34.4-side*.15),.55,z,-side*Math.PI/2,brand);}
  }
  for(const end of [-1,1])for(let i=0;i<8;i++){const x=[-28,-21,-14,-7,7,14,21,28][i],brand=(i+(end>0?1:0))%adNames.length;const panel=mesh(new THREE.BoxGeometry(6.8,1.05,.28),mat(adColors[brand%adColors.length],.58),scene,x,.55,end*52.2);panel.castShadow=false;addAdFace(6.55,.84,x,.55,end*(52.2-end*.15),end>0?Math.PI:0,brand);}
}
function startCrowdCelebration(team){for(const fan of crowdFans)if(fan.userData.support===team&&Math.random()<.72){fan.userData.cheerTime=2.35;fan.userData.phase=Math.random()*Math.PI*2;}}
function updateCrowd(dt){for(const fan of crowdFans){const data=fan.userData;if(data.cheerTime>0){data.cheerTime=Math.max(0,data.cheerTime-dt);const fade=Math.min(1,data.cheerTime*1.5),bounce=Math.max(0,Math.sin((2.35-data.cheerTime)*10+data.phase));fan.position.y=data.baseY+bounce*.72*fade;}else fan.position.y=data.baseY;}}
function makeGoal(sign){
  const z=sign*50.15, y=2.44, postMat=mat(0xf7f3e8,.36);
  for(const x of [-goalHalf,goalHalf]){const p=mesh(new THREE.CylinderGeometry(.11,.11,y,10),postMat,scene,x,y/2,z);p.castShadow=true;}
  const bar=mesh(new THREE.CylinderGeometry(.11,.11,goalHalf*2,10),postMat,scene,0,y,z);bar.rotation.z=Math.PI/2;
  const backZ=z+sign*1.35;
  for(const x of [-goalHalf,0,goalHalf]) addSpatialLine([x,y,z],[x,y,backZ]);
  for(let i=0;i<=6;i++){const x=-goalHalf+i*goalHalf*2/6;addSpatialLine([x,y,backZ],[x,0,backZ]);}
  for(let j=0;j<=4;j++){const yy=j*y/4;addSpatialLine([-goalHalf,yy,backZ],[goalHalf,yy,backZ]);addSpatialLine([-goalHalf,yy,z],[-goalHalf,yy,backZ]);addSpatialLine([goalHalf,yy,z],[goalHalf,yy,backZ]);}
}
buildPitch();

function makePlayer(team,role,num){
  const root=new THREE.Group();scene.add(root);
  const shirtColor=role==='REF'?0x171918:role==='GK'?(team===0?mats.keeperHome:mats.keeperAway):(team===0?mats.red:mats.blue);
  const shirt=mat(shirtColor), skin=mat(mats.skin), shorts=mat(role==='REF'?0x101211:mats.shorts), boots=mat(mats.boot);
  const body=new THREE.Group();root.add(body);
  mesh(boxGeo,shirt,body,0,1.02,0,.56,.68,.33);
  mesh(boxGeo,shirt,body,-.37,1.03,0,.2,.51,.23).rotation.z=-.12;
  mesh(boxGeo,shirt,body,.37,1.03,0,.2,.51,.23).rotation.z=.12;
  mesh(boxGeo,skin,body,0,1.62,0,.36,.37,.34);
  // Blocky hair cap keeps the supplied model's simple silhouette.
  mesh(boxGeo,mat(0x493d32),body,0,1.81,0,.38,.07,.35);
  const legPivots=[];
  for(const x of [-.16,.16]){const pivot=new THREE.Group();pivot.position.set(x,.61,0);body.add(pivot);mesh(boxGeo,shorts,pivot,0,-.12,0,.25,.29,.28);mesh(cylGeo,skin,pivot,0,-.39,0,1,1,.75);mesh(boxGeo,boots,pivot,0,-.62,.09,.25,.14,.44);legPivots.push(pivot);}
  const armPivots=[],sleeveMat=role==='REF'?mat(0x343a36):shirt;
  for(const x of [-.4,.4]){const pivot=new THREE.Group();pivot.position.set(x,1.26,0);body.add(pivot);mesh(boxGeo,sleeveMat,pivot,0,-.2,0,.17,.44,.18);mesh(boxGeo,skin,pivot,0,-.48,.015,.15,.17,.16);if(role==='REF')mesh(boxGeo,skin,pivot,0,-.63,.02,.14,.22,.14);armPivots.push(pivot);}
  const ring=mesh(new THREE.RingGeometry(.72,1.02,32),new THREE.MeshBasicMaterial({color:team===0?0xff332d:0x4d9dff,transparent:true,opacity:.98,depthWrite:false}),root,0,.055,0);ring.rotation.x=-Math.PI/2;ring.visible=false;ring.castShadow=false;ring.renderOrder=3;
  const p={team,role,num,root,body,legs:legPivots,arms:armPivots,ring,shirtColor,shirtMaterial:shirt,vel:new THREE.Vector3(),target:new THREE.Vector3(),freeKickTarget:new THREE.Vector3(),freeKickRole:null,freeKickMark:null,freeKickPhase:Math.random()*6,freeKickPushTimer:0,penaltyTarget:new THREE.Vector3(),throwInTime:0,action:Math.random()*5,movePhase:Math.random()*Math.PI*2,aiRunCooldown:5+Math.random()*9,aiRunTime:0,aiRunTarget:new THREE.Vector3(),expectedPassTime:0,decisionGrace:0,aiCooldown:1+Math.random(),aiTackleDecision:.8+Math.random()*1.8,tackleCooldown:0,slideTime:0,wallJumpTime:0,wallJumpDuration:.66,wallJumping:false,slideDir:new THREE.Vector3(),slideFrom:new THREE.Vector3(),slideSpeed:10,wallTarget:null,sentOff:false,keeperAction:'idle',keeperActionTime:0,keeperReleaseGrace:0,attackSign:team===0?1:-1,baseX:0,depth:0};
  if(role!=='REF')players.push(p);return p;
}
const formations=[
  {role:'GK',x:0,depth:0,name:'GOALKEEPER'},
  ...[-23,-8,8,23].map((x,i)=>({role:'DEF',x,depth:14,name:['LEFT BACK','CENTRE BACK','CENTRE BACK','RIGHT BACK'][i]})),
  ...[-9,9].map((x,i)=>({role:'MID',x,depth:28,name:i?'CENTRE MID':'HOLDING MID'})),
  {role:'AM',x:-21,depth:39,name:'LEFT WING'},
  {role:'AM',x:0,depth:30,name:'ATTACKING MID'},
  {role:'AM',x:21,depth:39,name:'RIGHT WING'},
  {role:'ST',x:0,depth:44,name:'STRIKER'}
];
const teams=[[],[]];
const shirtNumbers=[1,3,4,5,2,6,8,11,10,7,9];
for(let t=0;t<2;t++)for(let i=0;i<formations.length;i++){const f=formations[i],p=makePlayer(t,f.role,shirtNumbers[i]);p.name=f.name;p.baseX=f.x;p.depth=f.depth;teams[t].push(p);}
const referee=makePlayer(2,'REF',0);referee.root.position.set(2,0,0);
const cardMaterial=new THREE.MeshBasicMaterial({color:0xffd928,side:THREE.DoubleSide});
const refereeCard=mesh(boxGeo,cardMaterial,referee.arms[1],0,-.82,.02,.29,.42,.065);refereeCard.visible=false;refereeCard.castShadow=false;
let cardSequence=null;
const BALL_RADIUS=.25;
const ball=mesh(sphereGeo,ballMat,scene,0,BALL_RADIUS,0,BALL_RADIUS,BALL_RADIUS,BALL_RADIUS);ball.castShadow=true;
// Faceted dark patches make the ball readable at broadcast distance.
const patchMat=mat(0x252725,.65);for(let i=0;i<6;i++){const patch=mesh(sphereGeo,patchMat,ball,Math.cos(i*Math.PI/3)*.73,Math.sin(i*Math.PI/3)*.5,.48,.25,.25,.07);patch.castShadow=false;}

let attack=[1,-1], owner=null, lastTouch=0, userTeam=0, difficultyLevel=2, controlled=teams[0][10], switchLocked=false,lastKicker=null,kickerGrace=0,tackleGrace=0,kickoffHold=false,freeKickHold=false,restartSpot=new THREE.Vector3(),restartIsIndirect=false,indirectKick=false,indirectKicker=null,freeKickWall=[],freeKickRadius=9.2,restartKind='open',penaltyKeeper=null,offsidePlayers=new Set(),ballCurve=0,curveTime=0,curveVector=new THREE.Vector3(),refSignal=0;
let score=[0,0], half=1, timeLeft=240, ended=false, menuActive=true, restartTimer=0, kickCharge=0, charging=false, chargingKind='shot', matchState='playing', phaseTimer=0;
const ballVelocity=new THREE.Vector3(), ballAnchorDirection=new THREE.Vector3(0,0,1), keys=new Set(),mouse=new THREE.Vector2();
let ballAnchorOwner=null;
const scoreEl=document.querySelector('#score'),clockEl=document.querySelector('#clock'),halfEl=document.querySelector('#half'),msgEl=document.querySelector('#center-message'),powerWrap=document.querySelector('#power-wrap'),powerFill=document.querySelector('#power-fill'),powerLabel=document.querySelector('#power-label');
function setFormation(p){if(p.sentOff){p.root.visible=false;p.ring.visible=false;return;}p.root.visible=true;p.attackSign=attack[p.team];const sign=attack[p.team],ownZ=-sign*48;p.root.position.set(p.baseX,0,p.role==='GK'?-sign*(goalZ-1):ownZ+sign*p.depth);p.root.rotation.y=sign>0?0:Math.PI;p.vel.set(0,0,0);p.expectedPassTime=0;p.decisionGrace=0;p.distributionTarget=null;p.keeperAction='idle';p.keeperActionTime=0;p.keeperReleaseGrace=0;}
function setControlled(p){if(!p||p.team!==userTeam||p.role==='GK')return;controlled=p;for(const side of teams)for(const teammate of side)teammate.ring.visible=teammate===p;}
function announce(text,seconds=1.8){msgEl.firstElementChild.textContent=text;msgEl.classList.add('show');phaseTimer=seconds;}
function setupKickoff(team){
  owner=null;ballVelocity.set(0,0,0);lastTouch=team;switchLocked=false;kickerGrace=0;tackleGrace=.4;kickoffHold=true;freeKickHold=false;restartKind='open';penaltyKeeper=null;indirectKick=false;offsidePlayers.clear();
  for(const p of players)setFormation(p);
  const sign=attack[team],kickoffFacing=sign>0?Math.PI:0;
  for(const p of players){
    if(p.role!=='GK')p.root.rotation.y=kickoffFacing;
  }
  const striker=teams[team][10],mid=teams[team][6];
  striker.root.position.set(0,0,sign*.68);striker.root.rotation.y=kickoffFacing;striker.aiCooldown=.45;
  mid.root.position.set(0,0,-sign*3.5);mid.root.rotation.y=kickoffFacing;
  ball.position.set(0,.25,0);owner=striker;
  if(team===userTeam)setControlled(striker);
  matchState='playing';restartTimer=0;
  announce(team===0?'HOME KICK OFF':'AWAY KICK OFF',2.2);
  updateHUD();
}
function resetPlayersAfterScore(team){
  for(const p of players)setFormation(p);
  setupKickoff(team);
}
setupKickoff(0);

function updateHUD(){
  scoreEl.textContent=score[0]+' — '+score[1];halfEl.textContent=half===1?'1ST':'2ND';
  const secs=Math.max(0,Math.ceil(timeLeft));clockEl.textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
}
function currentForward(team){return attack[team];}
function releaseBall(player,kind,power=1,underPressure=false){
  if(owner!==player)return;
  const botPass=player!==controlled;
  const fromFreeKick=freeKickHold,fromKickoff=kickoffHold,fromSetPiece=freeKickHold||kickoffHold,fromThrowIn=freeKickHold&&restartKind==='throwin',fromPenalty=freeKickHold&&restartKind==='penalty';
  const pos=player.root.position,forward=attack[player.team];
  const facing=new THREE.Vector3(Math.sin(player.root.rotation.y),0,Math.cos(player.root.rotation.y)).normalize();
  const origin=new THREE.Vector3(pos.x,0,pos.z).addScaledVector(facing,.45);
  let aim=origin.clone().addScaledVector(facing,65),recipient=null,passDistance=16;
  if(kind==='shot'&&player!==controlled){
    const sign=attack[player.team];
    if(player.team===1){
      const keeper=teams[0].find(p=>p.role==='GK'&&!p.sentOff),leftX=-goalHalf+.48,rightX=goalHalf-.48;
      const leftSpace=Math.abs(leftX-(keeper?.root.position.x??0)),rightSpace=Math.abs(rightX-(keeper?.root.position.x??0));
      let side=leftSpace>rightSpace?-1:1;
      if(Math.abs(leftSpace-rightSpace)<.7)side=Math.random()<.5?-1:1;
      const targetX=side*(goalHalf-.42-Math.random()*.42);
      aim.set(targetX,0,sign*goalZ);
    }else aim.set(0,0,sign*goalZ);
  }
  if(kind==='pass'){
    const offsideExempt=fromFreeKick&&['throwin','penalty','corner','goalKick'].includes(restartKind);
    const passDefenders=teams[1-player.team].filter(p=>!p.sentOff).map(p=>p.root.position.z*forward).sort((a,b)=>b-a);
    const passSecondLast=passDefenders[1]??goalZ,ballProgress=pos.z*forward;
    const choices=teams[player.team].filter(p=>{
      if(p===player||p.role==='GK'||p.sentOff)return false;
      if(!botPass||offsideExempt)return true;
      const playerProgress=p.root.position.z*forward;
      return !(playerProgress>0&&playerProgress>ballProgress+.15&&playerProgress>passSecondLast+.15);
    });let bestScore=-Infinity;
    for(const candidate of choices){
      const offset=candidate.root.position.clone().sub(pos),distance=Math.hypot(offset.x,offset.z);
      if(distance<3||distance>25)continue;
      const alignment=(offset.x*facing.x+offset.z*facing.z)/distance;
      if(alignment<(underPressure&&botPass?-.85:.18))continue;
      let space=14;for(const opponent of teams[1-player.team])space=Math.min(space,candidate.root.position.distanceTo(opponent.root.position));
      const progress=offset.z*attack[player.team];
      const score=alignment*(underPressure&&botPass?4:8)-distance*.16+Math.min(space,underPressure?16:12)*(underPressure?.85:.55)+progress*.12+(candidate.role==='ST'?1:0);
      if(score>bestScore){recipient=candidate;bestScore=score;}
    }
    if(recipient){passDistance=Math.hypot(recipient.root.position.x-pos.x,recipient.root.position.z-pos.z);aim.copy(recipient.root.position).addScaledVector(recipient.vel,botPass ? .24 : .42);if(!botPass)aim.addScaledVector(facing,1.2);}
    // Restart passes must always have a safe outlet. A strict forward-facing
    // pass check can otherwise leave AI kickoffs, goal kicks, or throw-ins frozen.
    const cornerCross=!recipient&&fromFreeKick&&restartKind==='corner';
    if(cornerCross){aim.set(0,0,attack[player.team]*(goalZ-9));passDistance=25;}
    else if(!recipient&&fromSetPiece&&choices.length){
      recipient=choices.reduce((best,candidate)=>{
        if(!best)return candidate;
        const distance=candidate.root.position.distanceToSquared(pos),bestDistance=best.root.position.distanceToSquared(pos);
        return distance<bestDistance?candidate:best;
      },null);
      passDistance=Math.hypot(recipient.root.position.x-pos.x,recipient.root.position.z-pos.z);
      aim.copy(recipient.root.position).addScaledVector(recipient.vel,botPass ? .22 : .42);
      if(!botPass)aim.addScaledVector(facing,1.2);
    }else if(!recipient&&fromSetPiece){aim.set(pos.x,0,pos.z+attack[player.team]*18);passDistance=18;}
    if(!recipient&&player!==controlled&&!fromSetPiece)return false;
  }
  if(kind==='pass'){
    // Most passes stay on a direct line to the receiver; a small minority are mis-hit.
    if(botPass&&Math.random()<.055){aim.x+=(Math.random()-.5)*5.2;aim.z+=(Math.random()-.5)*3.8;}
    if(botPass)passDistance=Math.max(1,Math.hypot(aim.x-origin.x,aim.z-origin.z));
  }
  const initialBallHeight=fromThrowIn?2.05:.29;
  const passFlightTime=THREE.MathUtils.clamp(.34+passDistance*.022-power*.1,.38,1.02);
  const passSpeed=passDistance/passFlightTime;
  const passLoft=Math.max(1.8,9.6*passFlightTime+(.25-initialBallHeight)/passFlightTime);
  const direction=aim.sub(origin).normalize();
  // Offside position is judged when the ball is played, not when it is received.
  const sign=attack[player.team], defenders=teams[1-player.team].map(p=>p.root.position.z*sign).sort((a,b)=>b-a), secondLast=defenders[1]??goalZ;
  offsidePlayers=fromFreeKick&&['throwin','penalty','corner','goalKick'].includes(restartKind)?new Set():new Set(teams[player.team].filter(p=>p!==player&&p.root.position.z*sign>0&&p.root.position.z*sign>pos.z*sign&&p.root.position.z*sign>secondLast).map(p=>p));
  ballCurve=kind==='shot'?(keys.has('KeyA')?-1:keys.has('KeyD')?1:0):0;
  curveVector.set(-direction.z,0,direction.x).multiplyScalar(ballCurve*(.32+power*.38));curveTime=ballCurve?1.45:0;
  const legacySpeed=fromThrowIn?THREE.MathUtils.clamp(passDistance*.72+power*16,14,31):kind==='pass'?THREE.MathUtils.clamp(passDistance*.95+power*24,12,42):15+power*22;
  const legacyLoft=fromThrowIn?6+power*4:kind==='pass'?3.5+power*12:(ballCurve?1.6+power*5.2:2.2+power*8.2);
  const speed=kind==='pass'&&botPass?THREE.MathUtils.clamp(passSpeed,12,38):legacySpeed;
  const loft=kind==='pass'&&botPass?passLoft:legacyLoft;
  ball.position.set(fromThrowIn?restartSpot.x-Math.sign(restartSpot.x)*.1:pos.x+direction.x*.48,fromThrowIn?2.05:.29,fromThrowIn?restartSpot.z+direction.z*.25:pos.z+direction.z*.48);
  ballVelocity.set(direction.x*speed,loft,direction.z*speed);
  lastTouch=player.team;owner=null;ballAnchorOwner=null;player.aiCooldown=1.2;lastKicker=player;kickerGrace=.42;if(fromThrowIn)player.throwInTime=.68;
  for(const teammate of players)teammate.expectedPassTime=0;
  if(kind==='pass'&&recipient)recipient.expectedPassTime=1.5;
  indirectKick=freeKickHold&&restartIsIndirect;indirectKicker=indirectKick?player:null;
  kickoffHold=false;freeKickHold=false;
  if(fromFreeKick&&player.team===1)for(const teammate of teams[1])if(teammate.role==='MID'||teammate.role==='AM')teammate.freeKickPushTimer=7;
  if(fromFreeKick&&kind==='shot')for(const defender of freeKickWall){defender.wallJumpTime=defender.wallJumpDuration;defender.wallJumping=true;}
  restartKind='open';penaltyKeeper=null;
  if(kind==='pass'&&player.team===userTeam&&recipient){setControlled(recipient);switchLocked=true;}
  updateHUD();
  return true;
}
function nearestPlayer(point,team=null,exclude=null){let best=null,d=Infinity;for(const p of players){if(p===exclude||p.sentOff||(team!==null&&p.team!==team))continue;const dist=p.root.position.distanceToSquared(point);if(dist<d){d=dist;best=p;}}return best;}
function keepFreeKickDistance(target,spot,minimum=freeKickRadius+.45){
  const radial=target.clone().sub(spot);
  if(radial.length()<minimum){if(radial.lengthSq()<.001)radial.set(1,0,0);target.copy(spot).addScaledVector(radial.normalize(),minimum);}
  return target;
}
function moveFreeKickPlayer(p,dt){
  const attackTeam=p.freeKickRole==='defend'?(p.freeKickMark?.team??1-p.team):p.team;
  const sign=attack[attackTeam];
  p.freeKickPhase+=dt*(p.freeKickRole==='attack'?1.45:1.1);
  const target=p.freeKickRole==='defend'&&p.freeKickMark?p.freeKickMark.root.position.clone():p.freeKickTarget.clone();
  if(p.freeKickRole==='defend')target.z+=(restartKind==='corner'?sign:-sign)*1.7;
  else{target.x+=Math.sin(p.freeKickPhase)*1.65+Math.sin(p.freeKickPhase*.43)*.55;target.z+=Math.cos(p.freeKickPhase*.72)*1.15;}
  if(p.freeKickRole==='defend')keepFreeKickDistance(target,restartSpot,restartKind==='throwin'?2.2:freeKickRadius+.45);
  target.x=THREE.MathUtils.clamp(target.x,-fieldWidth/2+2.5,fieldWidth/2-2.5);target.z=THREE.MathUtils.clamp(target.z,-goalZ+2.5,goalZ-2.5);
  const delta=target.sub(p.root.position);delta.y=0;const distance=delta.length();
  if(distance>.16){const speed=p.freeKickRole==='defend'?7:6.2;p.vel.lerp(delta.normalize().multiplyScalar(Math.min(speed,distance*2)),Math.min(1,dt*5));p.root.position.addScaledVector(p.vel,dt);}else p.vel.multiplyScalar(.65);
  const look=restartSpot.clone().sub(p.root.position);p.root.rotation.y=Math.atan2(look.x,look.z);
}
function updateFreeKickMovement(dt){
  for(const p of players){if(!p.freeKickRole||p.sentOff)continue;p.action+=dt*8;moveFreeKickPlayer(p,dt);const swing=Math.sin(p.action)*Math.min(1,p.vel.length()/5.4)*.58;p.legs[0].rotation.x=swing;p.legs[1].rotation.x=-swing;p.arms[0].rotation.x=-swing*.55;p.arms[1].rotation.x=swing*.55;}
}
function prepareFreeKickShape(team,kicker,spot,kind='free'){
  const sign=attack[team],goalDistance=goalZ-spot.z*sign,cornerEnd=sign*goalZ,throwSide=Math.sign(spot.x)||1;
  const attackers=teams[team].filter(p=>p!==kicker&&p.role!=='GK'&&!p.sentOff);
  attackers.forEach(p=>{
    let lateral,forward,cornerDepth;
    if(kind==='corner'){
      cornerDepth=(p.role==='ST'?7:p.role==='AM'?10+(Math.abs(p.baseX)<1?2:0):p.role==='MID'?14:19)+Math.sin(p.num*1.7)*1.2;
      lateral=p.baseX*.42+Math.sin(p.num*1.9)*2.2;
    }else if(kind==='throwin'){
      let inward,run;
      if(p.role==='ST'){inward=22;run=20;}
      else if(p.role==='AM'){inward=Math.abs(p.baseX)<1?11:15;run=Math.abs(p.baseX)<1?17:(p.baseX<0?9:13);}
      else if(p.role==='MID'){inward=p.baseX<0?4:16;run=p.baseX<0?4:-6;}
      else{inward=12+Math.abs(p.baseX)*.38;run=p.baseX< -15?-8:p.baseX>15?7:p.baseX<0?2:-4;}
      lateral=-throwSide*(inward+Math.sin(p.num*2)*.75);
      forward=run+Math.cos(p.num*1.6)*1.1;
    }else{
      const roleDepth=p.role==='ST'?24:p.role==='AM'?17+(Math.abs(p.baseX)<1?3:0):p.role==='MID'?12:7;
      forward=Math.min(Math.max(5,roleDepth+Math.cos(p.num*1.9)*2.4),Math.max(5,goalDistance-4));
      lateral=p.baseX*.52+Math.sin(p.num*2.1)*1.7;
    }
    p.freeKickRole='attack';p.freeKickMark=null;p.freeKickPhase=Math.random()*Math.PI*2;
    const targetX=kind==='corner'?lateral:spot.x+lateral;
    const targetZ=kind==='corner'?cornerEnd-sign*cornerDepth:spot.z+sign*forward;
    p.freeKickTarget.set(THREE.MathUtils.clamp(targetX,-fieldWidth/2+3,fieldWidth/2-3),0,THREE.MathUtils.clamp(targetZ,-goalZ+3,goalZ-3));
  });
  let markTargets=attackers;
  let available=teams[1-team].filter(p=>p.role!=='GK'&&!p.sentOff&&!p.wallTarget);
  if(kind==='throwin'){markTargets=attackers.slice().sort((a,b)=>a.freeKickTarget.distanceToSquared(spot)-b.freeKickTarget.distanceToSquared(spot)).slice(0,4);available=available.sort((a,b)=>a.root.position.distanceToSquared(spot)-b.root.position.distanceToSquared(spot)).slice(0,4);}
  for(const attacker of markTargets){
    if(!available.length)break;
    let bestIndex=0,bestDistance=Infinity;
    for(let i=0;i<available.length;i++){const distance=available[i].root.position.distanceToSquared(attacker.freeKickTarget);if(distance<bestDistance){bestDistance=distance;bestIndex=i;}}
    const marker=available.splice(bestIndex,1)[0];marker.freeKickRole='defend';marker.freeKickMark=attacker;marker.freeKickPhase=Math.random()*Math.PI*2;marker.freeKickTarget.copy(attacker.freeKickTarget);
  }
  for(const p of attackers){const position=p.freeKickTarget.clone();p.root.position.set(position.x,0,position.z);p.root.rotation.y=Math.atan2(spot.x-position.x,spot.z-position.z);}
  for(const marker of teams[1-team])if(marker.freeKickRole==='defend'&&marker.freeKickMark){const position=marker.freeKickMark.root.position.clone();position.z+=(kind==='corner'?sign:-sign)*1.7;keepFreeKickDistance(position,spot,kind==='throwin'?2.2:freeKickRadius+.45);position.x=THREE.MathUtils.clamp(position.x,-fieldWidth/2+2.5,fieldWidth/2-2.5);position.z=THREE.MathUtils.clamp(position.z,-goalZ+2.5,goalZ-2.5);marker.root.position.set(position.x,0,position.z);marker.root.rotation.y=Math.atan2(spot.x-position.x,spot.z-position.z);}
}
function beginFreeKick(team,point,indirect=false,label='FREE KICK',kind='free'){
  const spot=point.clone(),touchSide=Math.sign(point.x)||1,endSide=Math.sign(point.z)||1;
  if(kind==='throwin'){spot.x=touchSide*fieldWidth/2;spot.z=THREE.MathUtils.clamp(spot.z,-goalZ+1,goalZ-1);}
  else if(kind==='corner'){spot.x=touchSide*(fieldWidth/2-.2);spot.z=endSide*(goalZ-.2);}
  else{spot.x=THREE.MathUtils.clamp(spot.x,-fieldWidth/2+2,fieldWidth/2-2);spot.z=THREE.MathUtils.clamp(spot.z,-goalZ+4,goalZ-4);}
  restartKind=kind;freeKickHold=true;kickoffHold=false;restartSpot.copy(spot);restartIsIndirect=indirect;indirectKick=false;indirectKicker=null;offsidePlayers.clear();penaltyKeeper=null;
  for(const p of players){p.wallTarget=null;p.freeKickTarget.set(0,0,0);p.freeKickRole=null;p.freeKickMark=null;p.penaltyTarget.set(0,0,0);}freeKickWall=[];
  const goalDistance=goalZ-spot.z*attack[team];
  if(kind==='free'&&goalDistance<=30){
    const direction=new THREE.Vector3(-spot.x,0,attack[team]*goalDistance).normalize(),side=new THREE.Vector3(direction.z,0,-direction.x),center=spot.clone().addScaledVector(direction,freeKickRadius+.35);
    const defenders=teams[1-team].filter(p=>p.role!=='GK'&&!p.sentOff&&p!==controlled).sort((a,b)=>a.root.position.distanceToSquared(center)-b.root.position.distanceToSquared(center)).slice(0,4);
    const slots=[-1.65,-.55,.55,1.65];defenders.forEach((p,i)=>{p.wallTarget=center.clone().addScaledVector(side,slots[i]);p.root.position.copy(p.wallTarget);p.root.position.y=0;p.root.rotation.y=Math.atan2(spot.x-p.root.position.x,spot.z-p.root.position.z);freeKickWall.push(p);});
  }
  ball.position.set(spot.x,.25,spot.z);ballVelocity.set(0,0,0);
  const outfield=teams[team].filter(p=>p.role!=='GK'&&!p.sentOff);
  owner=kind==='goalKick'?teams[team].find(p=>p.role==='GK'&&!p.sentOff):kind==='penalty'?(team===userTeam&&!controlled.sentOff?controlled:(teams[team].find(p=>p.role==='ST'&&!p.sentOff)||outfield[0])):outfield.reduce((best,p)=>!best||p.root.position.distanceToSquared(spot)<best.root.position.distanceToSquared(spot)?p:best,null);
  if(!owner)owner=outfield[0]||teams[team][0];
  const sign=attack[team];
  if(kind==='throwin'){owner.root.position.set(touchSide*(fieldWidth/2+.62),0,spot.z);owner.root.rotation.y=Math.atan2(-touchSide,0);}
  else if(kind==='corner'){
    owner.root.position.set(spot.x,0,spot.z-sign*1.25);
    // Face from the flag toward the penalty area, not straight over the goal line.
    const inwardX=-(Math.sign(spot.x)||1);owner.root.rotation.y=Math.atan2(inwardX,-sign);
  }else{owner.root.position.set(spot.x,0,spot.z-sign*1.25);owner.root.rotation.y=sign>0?0:Math.PI;}
  owner.vel.set(0,0,0);owner.aiCooldown=kind==='corner'?.16:.32;tackleGrace=.4;switchLocked=false;
  if(kind==='penalty'){
    penaltyKeeper=teams[1-team].find(p=>p.role==='GK'&&!p.sentOff)||null;
    if(penaltyKeeper){penaltyKeeper.root.position.set(0,0,sign*(goalZ-1));penaltyKeeper.penaltyTarget.copy(penaltyKeeper.root.position);penaltyKeeper.root.rotation.y=Math.atan2(spot.x-penaltyKeeper.root.position.x,spot.z-penaltyKeeper.root.position.z);penaltyKeeper.vel.set(0,0,0);}
    const waiting=players.filter(p=>p!==owner&&p!==penaltyKeeper&&!p.sentOff);
    waiting.forEach((p,i)=>{const col=i%10,row=Math.floor(i/10),x=(col-4.5)*5.6,depth=20.5+row*2.8+(i%3)*.25;p.penaltyTarget.set(x,0,sign*(goalZ-depth));p.root.position.copy(p.penaltyTarget);p.root.rotation.y=Math.atan2(spot.x-x,spot.z-p.root.position.z);p.vel.set(0,0,0);});
  }else prepareFreeKickShape(team,owner,spot,kind);
  if(team===userTeam)setControlled(owner);
  refSignal=2.2;referee.arms[0].rotation.z=-1.15;announce(label,2.1);
}
function awardOffside(point){beginFreeKick(1-lastTouch,point,true,'OFFSIDE · INDIRECT FREE KICK');}
function adjudicateOutOfPlay(point,sideFirst,touchingTeam,height=.25){
  owner=null;ballVelocity.set(0,0,0);lastTouch=touchingTeam;
  if(sideFirst){point.x=Math.sign(point.x||1)*fieldWidth/2;point.z=THREE.MathUtils.clamp(point.z,-goalZ+1,goalZ-1);beginFreeKick(1-touchingTeam,new THREE.Vector3(point.x,0,point.z),true,'THROW IN','throwin');return;}
  const endSign=Math.sign(point.z)||1;point.z=endSign*goalZ;const attackingTeam=attack[0]===endSign?0:1,defendingTeam=1-attackingTeam;
  if(Math.abs(point.x)<goalHalf-BALL_RADIUS&&height<=2.44+BALL_RADIUS&&height>=BALL_RADIUS&&!indirectKick){score[attackingTeam]++;startCrowdCelebration(attackingTeam);lastTouch=attackingTeam;matchState='goal';restartTimer=1.35;announce('GOAL',1.35);updateHUD();return;}
  if(lastTouch===defendingTeam){const cornerX=Math.sign(point.x)||1;beginFreeKick(attackingTeam,new THREE.Vector3(cornerX*fieldWidth/2,0,endSign*goalZ),false,'CORNER','corner');}
  else beginFreeKick(defendingTeam,new THREE.Vector3(0,0,endSign*(goalZ-5.5)),false,'GOAL KICK','goalKick');
}
function switchPlayer(){
  if(switchLocked||kickoffHold||matchState!=='playing')return;
  const choices=teams[userTeam].filter(p=>p.role!=='GK'&&!p.sentOff);
  if(freeKickHold&&owner&&owner.team!==userTeam){const current=choices.indexOf(controlled);setControlled(choices[(current+1+choices.length)%choices.length]);updateHUD();return;}
  if(freeKickHold)return;
  const closest=choices.reduce((best,p)=>p.root.position.distanceToSquared(ball.position)<best.root.position.distanceToSquared(ball.position)?p:best);if(closest===controlled)return;setControlled(closest);updateHUD();
}
function canMove(p){return p!==controlled||owner?.team!==userTeam;}
function startSlide(p){
  if(!p||p.role==='GK'||p.sentOff||p.slideTime>0||p.tackleCooldown>0||p.team===owner?.team||kickoffHold||freeKickHold||matchState!=='playing')return;
  const sprinting=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const target=owner&&owner.team!==p.team?owner.root.position:ball.position,dir=target.clone().sub(p.root.position);dir.y=0;if(dir.length()>(sprinting?12:8))return;
  if(sprinting&&p.vel.length()>.5)dir.copy(p.vel);
  p.slideDir.copy(dir.normalize());p.slideFrom.copy(p.root.position);p.slideSpeed=sprinting?13:10;p.slideTime=sprinting?.86:.72;p.tackleCooldown=4.1;p.root.rotation.y=Math.atan2(p.slideDir.x,p.slideDir.z);p.vel.copy(p.slideDir).multiplyScalar(p.slideSpeed);
}
function aiDifficulty(p){return p.team===userTeam?1:[.78,.9,1,1.1,1.22][difficultyLevel];}
function desiredAI(p,dt){
  const level=aiDifficulty(p);
  const sign=attack[p.team], poss=owner?owner.team:lastTouch, attacking=poss===p.team;
  const baseZ=-sign*48+sign*p.depth;
  const ownHalfDepth=ball.position.z*(-sign),ballInOwnHalf=ownHalfDepth>2.5;
  let tx=p.baseX,tz=baseZ;
  const ballZ=ball.position.z;
  if(kickoffHold){if(p===owner&&p!==controlled){p.aiCooldown-=dt;if(p.aiCooldown<=0)releaseBall(p,'pass',.35);}return;}
  if(p.expectedPassTime>0){
    if(owner){p.expectedPassTime=0;}
    else{
      p.expectedPassTime=Math.max(0,p.expectedPassTime-dt);
      const intercept=ball.position.clone().addScaledVector(ballVelocity,.14);intercept.y=0;
      intercept.x=THREE.MathUtils.clamp(intercept.x,-fieldWidth/2+2.4,fieldWidth/2-2.4);
      intercept.z=THREE.MathUtils.clamp(intercept.z,-goalZ+2.4,goalZ-2.4);
      const chase=intercept.sub(p.root.position),distance=chase.length();
      if(distance>.22){p.vel.lerp(chase.normalize().multiplyScalar(8.8*level),Math.min(1,dt*7));p.root.position.addScaledVector(p.vel,dt);p.root.rotation.y=Math.atan2(p.vel.x,p.vel.z);}
      else p.vel.multiplyScalar(.55);
      return;
    }
  }
  if(!owner){
    const available=teams[p.team].filter(a=>a.role!=='GK'&&a!==controlled&&!a.sentOff);
    const chaser=available.reduce((a,b)=>a.root.position.distanceToSquared(ball.position)<b.root.position.distanceToSquared(ball.position)?a:b);
    if(p===chaser){const intercept=ball.position.clone().addScaledVector(ballVelocity,.18);intercept.x=THREE.MathUtils.clamp(intercept.x,-fieldWidth/2+2.4,fieldWidth/2-2.4);intercept.z=THREE.MathUtils.clamp(intercept.z,-goalZ+2.4,goalZ-2.4);const chase=intercept.sub(p.root.position);for(const other of players){if(other===p||other.role==='GK')continue;const dx=p.root.position.x-other.root.position.x,dz=p.root.position.z-other.root.position.z,distance=Math.hypot(dx,dz);if(distance>0&&distance<2.5)chase.add(new THREE.Vector3(dx/distance,0,dz/distance).multiplyScalar((2.5-distance)*1.8));}const distance=chase.length();if(distance>.2){p.vel.lerp(chase.normalize().multiplyScalar(7.6*level),Math.min(1,dt*5));p.root.position.addScaledVector(p.vel,dt);p.root.rotation.y=Math.atan2(p.vel.x,p.vel.z);}return;}
  }
  const progress=THREE.MathUtils.clamp((ballZ*sign+50)/100,0,1);
  let carryRun=false;
  if(attacking){
    // Shape advances in possession; the back four only cross halfway for a deep attack.
    const advance=THREE.MathUtils.lerp(9,30,progress);
    tz+=sign*advance;
    if(p.role==='ST'){tx+=THREE.MathUtils.clamp((ball.position.x-tx)*.28,-8,8);tz+=sign*7;}
    if(p.role==='AM'||p.role==='MID'){tx+=THREE.MathUtils.clamp((ball.position.x-tx)*.2,-10,10);tz+=sign*4;}
    if(p.role==='DEF')tz+=sign*(progress>.34?13:5);
    if(p.team===1&&p.freeKickPushTimer>0&&(p.role==='MID'||p.role==='AM')){const supportDepth=Math.min(goalZ-(p.role==='MID'?18:12),ballZ*sign+(p.role==='MID'?12:10));tz=sign*Math.max(tz*sign,supportDepth);}
    if(progress>.58&&(p.role==='ST'||p.role==='AM'||p.role==='MID')){
      const boxDepth=p.role==='ST'?6:p.role==='AM'?(p.name==='ATTACKING MID'?19:12):18;
      tz=sign*Math.max(tz*sign,goalZ-boxDepth);
      tx=THREE.MathUtils.lerp(tx,THREE.MathUtils.clamp(ball.position.x*.45+p.baseX*.55,-12,12),.55);
    }else if(progress>.72&&p.role==='DEF'){
      tz=sign*Math.max(tz*sign,goalZ-25);
    }
  }else{
    // Hold a high block in the opponent's half, then fade it into a retreat as
    // the ball travels deeper into our own half instead of dropping on turnover.
    const stepUp=p.role==='DEF'?10:p.role==='MID'?13:p.role==='AM'?14:p.role==='ST'?11:0;
    const pressFactor=1-THREE.MathUtils.clamp(ownHalfDepth/22,0,1);
    const retreat=THREE.MathUtils.clamp((ownHalfDepth-2.5)*.42,0,18);
    tz+=sign*(stepUp*pressFactor-retreat);
    if(!ballInOwnHalf&&(p.role==='DEF'||p.role==='MID'||p.role==='AM'))tx+=THREE.MathUtils.clamp((ball.position.x-tx)*(p.role==='DEF'?.12:.2),-8,8);
    if(ballInOwnHalf&&(p.role==='DEF'||p.role==='MID'))tx+=THREE.MathUtils.clamp((ball.position.x-tx)*.16,-8,8);
  }
  if(p===owner){
    p.aiCooldown-=dt;
    const goalDistance=(goalZ-sign*p.root.position.z);
    if(p.role==='GK'){
      if(p.aiCooldown<=0){const outfield=teams[p.team].filter(a=>a.role==='DEF'&&!a.sentOff);const mate=outfield[Math.floor(Math.random()*outfield.length)];ball.position.copy(p.root.position).add(new THREE.Vector3(0,.5,sign*.6));ballVelocity.set((mate.root.position.x-p.root.position.x)*.55,4.4,sign*23);owner=null;lastTouch=p.team;p.aiCooldown=3;}
      return;
    }
    let pressure=100;for(const opponent of teams[1-p.team])pressure=Math.min(pressure,p.root.position.distanceTo(opponent.root.position));
    p.decisionGrace=Math.max(0,p.decisionGrace-dt);
    const pressed=pressure<4.6;
    if(p.aiCooldown<=0||(pressed&&p.aiCooldown>.28&&p.decisionGrace<=0)){
      const leftAngle=Math.atan2(-goalHalf-p.root.position.x,Math.max(1,goalDistance));
      const rightAngle=Math.atan2(goalHalf-p.root.position.x,Math.max(1,goalDistance));
      const goalAngle=Math.abs(rightAngle-leftAngle);
      const shootingLane=goalDistance>1.5&&goalDistance<31&&goalAngle>.075;
      const closeCentralShot=goalDistance<10&&Math.abs(p.root.position.x)<17;
      const shouldShoot=goalDistance<21&&(shootingLane||closeCentralShot)&&(pressure>2.6||goalDistance<16);
      const urgentShot=goalDistance<12&&(shootingLane||closeCentralShot);
      const released=urgentShot?releaseBall(p,'shot',.5):pressed?releaseBall(p,'pass',.58,true):shouldShoot?releaseBall(p,'shot',goalDistance<12?.5:.4):releaseBall(p,'pass',.55);
      if(!released){carryRun=true;p.aiCooldown=pressed?.28:.55;}
      else p.aiCooldown=1.1+Math.random()*.9;
    }
    if(owner===p){
      if(goalDistance<19){
        const targetGap=goalDistance<6?6:Math.max(6,goalDistance-(carryRun?4.5:2.2));
        tz=sign*(goalZ-targetGap);
        const lane=THREE.MathUtils.clamp(ball.position.x*.38+p.baseX*.18+Math.sin(p.movePhase)*1.5,-12,12);
        tx=THREE.MathUtils.lerp(p.root.position.x,lane,.72);
      }else{tz=p.root.position.z+sign*(carryRun?7:4);tx=carryRun?THREE.MathUtils.lerp(p.root.position.x,0,.18):p.root.position.x;}
    }
  }else if(!attacking){
    if(owner?.role!=='GK'){
      const nonKeeper=teams[p.team].filter(a=>a.role!=='GK'&&a!==controlled&&!a.sentOff);
      const nearest=nonKeeper.reduce((a,b)=>a.root.position.distanceToSquared(ball.position)<b.root.position.distanceToSquared(ball.position)?a:b);
      const attackProgress=THREE.MathUtils.clamp((ballZ*attack[1-p.team]+50)/100,0,1);
      let presser=nearest;
      if(attackProgress>.72){
        const defenders=nonKeeper.filter(a=>a.role==='DEF');
        const closestDefender=defenders.reduce((a,b)=>!a||b.root.position.distanceToSquared(ball.position)<a.root.position.distanceToSquared(ball.position)?b:a,null);
        const alternateDefender=defenders.filter(a=>a!==nearest).reduce((a,b)=>!a||b.root.position.distanceToSquared(ball.position)<a.root.position.distanceToSquared(ball.position)?b:a,null);
        presser=nearest?.role==='DEF'?(alternateDefender||closestDefender):(closestDefender||nearest);
      }
      if(p===presser&&ball.position.distanceToSquared(p.root.position)>1){tx=owner?.root.position.x??ball.position.x;tz=owner?.root.position.z??ball.position.z;}
      else if(!ballInOwnHalf&&(p.role==='AM'||p.role==='MID')){
        tx+=THREE.MathUtils.clamp((ball.position.x-tx)*(p.role==='AM'?.24:.16),-9,9);
        if(p.role==='AM')tz=THREE.MathUtils.lerp(tz,(owner?.root.position.z??ball.position.z)+sign*6,.22);
      }
      else if(ballInOwnHalf&&(p.role==='DEF'||p.role==='MID')&&ballZ*sign>-30&&ballZ*sign<12){tx+=THREE.MathUtils.clamp((ball.position.x-tx)*.2,-12,12);tz+=sign*2;}
    }
  }else if(!owner&&ball.position.distanceToSquared(p.root.position)<230){
    const closest=teams[p.team].filter(a=>a.role!=='GK'&&!a.sentOff).reduce((a,b)=>a.root.position.distanceToSquared(ball.position)<b.root.position.distanceToSquared(ball.position)?a:b);
    if(closest===p){tx=ball.position.x;tz=ball.position.z;}
  }
  if(p.role==='ST'&&attacking&&owner!==p){
    // Find a passing lane off the keeper's centerline; never drift onto the goal line.
    const side=ball.position.x>1?-1:ball.position.x< -1?1:(p.team===0?1:-1);
    tx=THREE.MathUtils.clamp(ball.position.x*.32+side*7,-14,14);
    const desiredDepth=Math.min(goalZ-11,Math.max(tz*sign,ballZ*sign+7));tz=sign*desiredDepth;
  }
  if(p!==owner){
    p.aiRunCooldown-=dt;
    if(p.aiRunCooldown<=0){
      p.aiRunCooldown=7+Math.random()*11;
      if(attacking&&progress>.32&&(p.role!=='DEF'||progress>.62)&&Math.random()<.075){
        const side=Math.random()<.5?-1:1,runDepth=p.role==='DEF'?7:6+Math.random()*8;
        p.aiRunTarget.set(THREE.MathUtils.clamp(ball.position.x+side*(4+Math.random()*5),-22,22),0,sign*Math.min(goalZ-7,ballZ*sign+runDepth));
        p.aiRunTime=2.6+Math.random()*2.2;
      }
    }
    p.aiRunTime=Math.max(0,p.aiRunTime-dt);
    if(p.aiRunTime>0){tx=THREE.MathUtils.lerp(tx,p.aiRunTarget.x,.76);tz=THREE.MathUtils.lerp(tz,p.aiRunTarget.z,.76);}
    // Small, unsynchronised off-ball adjustments keep the shape alive without wandering.
    tx+=Math.sin(p.action*.16+p.movePhase)*.55;
    tz+=Math.cos(p.action*.13+p.movePhase*1.7)*.35;
  }
  tx=THREE.MathUtils.clamp(tx,-fieldWidth/2+2.4,fieldWidth/2-2.4);tz=THREE.MathUtils.clamp(tz,-goalZ+2.4,goalZ-2.4);
  const aim=new THREE.Vector3(tx,0,tz);const delta=aim.sub(p.root.position);
  for(const other of players){
    if(other===p||other.role==='GK')continue;
    const dx=p.root.position.x-other.root.position.x,dz=p.root.position.z-other.root.position.z,distance=Math.hypot(dx,dz);
    const personalSpace=other===owner&&other.team!==p.team?1.55:(other===controlled?2.8:2.1);
    if(distance>0&&distance<personalSpace)delta.add(new THREE.Vector3(dx/distance,0,dz/distance).multiplyScalar((personalSpace-distance)*1.8));
  }
  const dist=delta.length();
  if(dist>.35){const speed=(p.role==='DEF'?8.2:8.5)*level;p.vel.lerp(delta.normalize().multiplyScalar(Math.min(speed,dist*2)),Math.min(1,dt*10));p.root.position.addScaledVector(p.vel,dt);p.root.rotation.y=Math.atan2(p.vel.x,p.vel.z);}
}
function updateKeeper(p,dt){
  const sign=attack[p.team],ownGoal=-sign*goalZ,lineZ=ownGoal+sign*1;
  p.keeperActionTime=Math.max(0,p.keeperActionTime-dt);
  p.keeperReleaseGrace=Math.max(0,p.keeperReleaseGrace-dt);
  let x=THREE.MathUtils.clamp(ball.position.x,-goalHalf+1,goalHalf-1),z=lineZ;
  const towardGoal=(ball.position.z-ownGoal)*sign;
  const inPenaltyBox=Math.abs(ball.position.x)<20.16&&towardGoal>=0&&towardGoal<=16.5;
  const looseInBox=!owner&&inPenaltyBox;
  const teammateChasing=looseInBox&&teams[p.team].some(m=>{if(m.role==='GK')return false;const toBall=ball.position.clone().sub(m.root.position);const distance=toBall.length();return distance<13&&(distance<5||m.vel.dot(toBall.normalize())>1.1);});
  const keeperShouldHold=looseInBox&&teammateChasing;
  if(towardGoal<20&&towardGoal>-8){
    const travel=Math.max(0,(Math.abs(ball.position.z-ownGoal)-2)/Math.max(2,Math.abs(ballVelocity.z)));
    x=THREE.MathUtils.clamp(ball.position.x+ballVelocity.x*travel*.2,-goalHalf+1,goalHalf-1);
    z=ownGoal+sign*Math.min(6,Math.max(1,towardGoal*.28));
  }
  if(looseInBox){
    x=THREE.MathUtils.clamp(ball.position.x+ballVelocity.x*.18,-19.5,19.5);
    const targetDepth=THREE.MathUtils.clamp((ball.position.z+ballVelocity.z*.18-ownGoal)*sign,1,16);
    z=ownGoal+sign*targetDepth;
  }
  const delta=new THREE.Vector3(x-p.root.position.x,0,z-p.root.position.z),dist=delta.length();
  const dive=towardGoal<11&&ballVelocity.z*sign< -7&&Math.abs(ball.position.x)<goalHalf+4;
  p.body.rotation.z=THREE.MathUtils.damp(p.body.rotation.z,dive?THREE.MathUtils.clamp((x-p.root.position.x)*-.16,-.8,.8):0,dive?8:4,dt);
  if(dist>.15){p.vel.lerp(delta.normalize().multiplyScalar(dive?8:looseInBox?6:4.6),Math.min(1,dt*(dive?6:looseInBox?5:4.5)));p.root.position.addScaledVector(p.vel,dt);}
  p.root.position.x=THREE.MathUtils.clamp(p.root.position.x,looseInBox?-19.5:-goalHalf+.7,looseInBox?19.5:goalHalf-.7);
  const depthFromLine=(p.root.position.z-lineZ)*sign;p.root.position.z=lineZ+sign*THREE.MathUtils.clamp(depthFromLine,-2,looseInBox?15.5:4);
  p.root.rotation.y=sign>0?0:Math.PI;
  if(owner===p){
    p.vel.set(0,0,0);p.root.position.x=THREE.MathUtils.clamp(p.root.position.x,-goalHalf+.7,goalHalf-.7);p.root.position.z=lineZ;
    ball.position.set(p.root.position.x+Math.sin(p.root.rotation.y)*.3,1.2,p.root.position.z+sign*.48);ballVelocity.set(0,0,0);
    if(p.distributionTarget){
      if(p.keeperActionTime<=.38){
        const target=p.distributionTarget,dir=target.clone().sub(p.root.position);dir.y=0;dir.normalize();
        const punt=p.keeperAction==='punt',speed=punt?21:15.5,loft=punt?7.5:4.8;
        ball.position.set(p.root.position.x+dir.x*2.8,punt?.56:1.62,p.root.position.z+dir.z*2.8);
        ballVelocity.set(dir.x*speed,loft,dir.z*speed);owner=null;lastTouch=p.team;lastKicker=p;kickerGrace=.5;p.keeperReleaseGrace=2.2;
        p.distributionTarget=null;p.aiCooldown=3.4;ballAnchorOwner=null;
      }
    }else{
      p.aiCooldown-=dt;
      if(p.aiCooldown<=0){
        let target=null,best=-Infinity;
        for(const mate of teams[p.team]){
          if(mate.role==='GK'||mate.sentOff)continue;
          const distance=mate.root.position.distanceTo(p.root.position);
          if(distance<11||distance>39)continue;
          let nearestOpponent=100;
          for(const opponent of teams[1-p.team])nearestOpponent=Math.min(nearestOpponent,mate.root.position.distanceTo(opponent.root.position));
          const advance=(mate.root.position.z-p.root.position.z)*sign;
          const value=Math.min(nearestOpponent,28)*1.25+Math.min(advance,35)*.35-distance*.12-Math.abs(mate.root.position.x-p.root.position.x)*.08;
          if(value>best){best=value;target=mate;}
        }
        if(!target)target=new THREE.Vector3(p.root.position.x+sign*8,0,p.root.position.z+sign*28);
        const distance=target instanceof THREE.Vector3?30:target.root.position.distanceTo(p.root.position);
        const aim=target instanceof THREE.Vector3?target:target.root.position;
        p.keeperAction=distance>22||Math.random()<.72?'punt':'throw';
        p.distributionTarget=aim.clone();p.keeperActionTime=.76;p.aiCooldown=99;
      }
    }
    return;
  }
  const keeperReach=looseInBox?1.9:dive?1.72:1.22;
  const catchDistance=ball.position.distanceTo(p.root.position),catchHeight=dive?3.15:2.25;
  if(p.keeperReleaseGrace<=0&&catchDistance<keeperReach&&ball.position.y<catchHeight&&(looseInBox||ballVelocity.z*sign<1||dive||catchDistance<1.25)){
    // Diving saves sometimes spill the shot wide instead of securing it.
    if(dive&&Math.random()<.32){
      const side=Math.abs(ball.position.x)>.35?Math.sign(ball.position.x):(Math.random()<.5?-1:1);
      const targetX=side*Math.max(goalHalf+.9,Math.abs(ball.position.x)+.75);
      const zSpeed=THREE.MathUtils.clamp(towardGoal*1.25,2.2,5.5);
      const travelTime=Math.max(.22,towardGoal/zSpeed);
      ballVelocity.set(THREE.MathUtils.clamp((targetX-ball.position.x)/travelTime,10,18),Math.max(2.3,ballVelocity.y*.25+2.2),-sign*zSpeed);
      owner=null;ballAnchorOwner=null;lastTouch=p.team;p.keeperReleaseGrace=.42;p.keeperAction='dive';p.keeperActionTime=.6;p.distributionTarget=null;
      return;
    }
    owner=p;ballAnchorOwner=null;lastTouch=p.team;offsidePlayers.clear();indirectKick=false;p.aiCooldown=1.25;p.keeperAction='catch';p.keeperActionTime=.48;p.distributionTarget=null;ballVelocity.set(0,0,0);
  }
}
function updatePlayers(dt,time){
  for(const p of players){
    if(p.sentOff){p.vel.set(0,0,0);continue;}
    if(kickoffHold&&p.role!=='GK'){p.vel.set(0,0,0);if(p===owner&&p!==controlled){p.aiCooldown-=dt;if(p.aiCooldown<=0)releaseBall(p,'pass',.35);}continue;}
    if(freeKickHold&&p===owner){p.vel.set(0,0,0);if(restartKind==='throwin'){p.arms[0].rotation.z=-2.3;p.arms[1].rotation.z=2.3;}if(p!==controlled){p.aiCooldown-=dt;if(p.aiCooldown<=0){const restartPass=restartKind==='throwin'||restartKind==='corner'||restartKind==='goalKick';releaseBall(p,restartPass?'pass':'shot',.45);}}if(freeKickHold)continue;}
    p.action+=dt*(p.vel.length()>5?11:8);
    p.tackleCooldown=Math.max(0,p.tackleCooldown-dt);
    if(p.freeKickPushTimer>0)p.freeKickPushTimer=Math.max(0,p.freeKickPushTimer-dt);
    if(freeKickHold&&restartKind==='penalty'&&p===penaltyKeeper){p.vel.set(0,0,0);p.root.position.copy(p.penaltyTarget);}
    else if(freeKickHold&&restartKind==='penalty'&&p!==owner){p.vel.set(0,0,0);p.root.position.copy(p.penaltyTarget);}
    else if(p.role==='GK'){updateKeeper(p,dt);}
    else if(freeKickHold&&p.wallTarget&&!(p===controlled&&owner&&owner.team!==userTeam)){const delta=p.wallTarget.clone().sub(p.root.position);delta.y=0;if(delta.length()>.12){p.vel.lerp(delta.normalize().multiplyScalar(7),Math.min(1,dt*8));p.root.position.addScaledVector(p.vel,dt);}else p.vel.set(0,0,0);}
    else if(freeKickHold&&p.freeKickRole&&!(p===controlled&&owner&&owner.team!==userTeam))moveFreeKickPlayer(p,dt);
    else if(p.slideTime>0){
      p.slideFrom.copy(p.root.position);p.slideTime=Math.max(0,p.slideTime-dt);p.vel.copy(p.slideDir).multiplyScalar(p.slideSpeed||10);p.root.position.addScaledVector(p.slideDir,(p.slideSpeed||10)*dt);
    }else if(p===controlled){
      const forward=camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
      const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
      const amount=Math.hypot(mouse.x,mouse.y),deadZone=.12;
      const move=amount>deadZone?right.multiplyScalar(mouse.x).addScaledVector(forward,mouse.y).normalize():new THREE.Vector3();
      const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'),speed=sprint?9.5:7.2;
      if(move.lengthSq()>.001){p.root.rotation.y=Math.atan2(move.x,move.z);p.vel.copy(move).multiplyScalar(speed);}else p.vel.set(0,0,0);
      p.root.position.addScaledVector(p.vel,dt);
    }else desiredAI(p,dt);
    // AI only considers an occasional challenge when it is the nearest player to the ball carrier.
    if(p!==controlled&&p.role!=='GK'&&!p.sentOff&&owner&&owner.team!==p.team&&p.tackleCooldown<=0){
      p.aiTackleDecision-=dt;
      if(p.aiTackleDecision<=0){
        p.aiTackleDecision=(1.6+Math.random()*1.8)/aiDifficulty(p);
        const defenders=teams[p.team].filter(a=>a.role!=='GK'&&!a.sentOff);
        const nearest=defenders.reduce((a,b)=>a.root.position.distanceToSquared(owner.root.position)<b.root.position.distanceToSquared(owner.root.position)?a:b);
        if(p===nearest&&p.root.position.distanceTo(owner.root.position)<3.3&&Math.random()<.11*aiDifficulty(p))startSlide(p);
      }
    }
    const sidelineLimit=freeKickHold&&restartKind==='throwin'&&p===owner?fieldWidth/2+1:fieldWidth/2;p.root.position.x=THREE.MathUtils.clamp(p.root.position.x,-sidelineLimit,sidelineLimit);
    p.root.position.z=THREE.MathUtils.clamp(p.root.position.z,-goalZ,goalZ);
    if(freeKickHold&&restartKind!=='penalty'&&p!==owner&&p.team!==owner.team&&p.role!=='GK'){const minDistance=restartKind==='throwin'?2.2:freeKickRadius,dx=p.root.position.x-restartSpot.x,dz=p.root.position.z-restartSpot.z,d=Math.hypot(dx,dz);if(d<minDistance){const nx=d>.001?dx/d:1,nz=d>.001?dz/d:0;p.root.position.x=restartSpot.x+nx*minDistance;p.root.position.z=restartSpot.z+nz*minDistance;}}
    const movement=Math.min(1,p.vel.length()/5.4), swing=Math.sin(p.action)*.58*movement;
    if(p.slideTime>0){const blend=Math.min(1,p.slideTime/.18);p.body.rotation.x=-.72*blend;p.body.position.y=-.27*blend;p.legs[0].rotation.x=-1.05*blend;p.legs[1].rotation.x=.65*blend;p.arms[0].rotation.x=.7*blend;p.arms[1].rotation.x=-.7*blend;}
    else{p.body.rotation.x=0;p.body.position.y=movement>.12?Math.abs(Math.sin(p.action*2))*.055:0;p.legs[0].rotation.x=swing;p.legs[1].rotation.x=-swing;p.arms[0].rotation.x=-swing*.55;p.arms[1].rotation.x=swing*.55;}
    if(p.throwInTime>0){p.throwInTime=Math.max(0,p.throwInTime-dt);const throwProgress=Math.sin((1-p.throwInTime/.68)*Math.PI);p.body.rotation.x=-.16*throwProgress;p.arms[0].rotation.z=-2.25*throwProgress;p.arms[1].rotation.z=2.25*throwProgress;}
    if(p.wallJumpTime>0){const duration=p.wallJumpDuration||.66;p.wallJumpTime=Math.max(0,p.wallJumpTime-dt);const jump=Math.sin((1-p.wallJumpTime/duration)*Math.PI);p.root.position.y=jump*1.15;p.legs[0].rotation.x=-jump*.48;p.legs[1].rotation.x=-jump*.48;p.arms[0].rotation.x=-jump*.55;p.arms[1].rotation.x=-jump*.55;if(p.wallJumpTime===0){p.root.position.y=0;p.wallJumping=false;}}else if(p.wallJumping){p.root.position.y=0;p.wallJumping=false;}
    if(p.role==='GK'){
      if(p.keeperActionTime>0){const swing=Math.sin(Math.PI*THREE.MathUtils.clamp(1-p.keeperActionTime/.76,0,1));p.body.rotation.x=p.keeperAction==='throw'?.22*swing:-.12*swing;p.arms[0].rotation.z=p.keeperAction==='throw'?-.95*swing:-.45*swing;p.arms[1].rotation.z=p.keeperAction==='throw'?.85*swing:.75*swing;if(p.keeperAction==='punt')p.legs[0].rotation.x=-1.05*swing;}
      else{p.body.rotation.x=0;p.arms[0].rotation.z=0;p.arms[1].rotation.z=0;}
    }
    if(p!==owner&&p!==controlled)p.vel.multiplyScalar(Math.max(0,1-dt*1.7));
  }
  // A small personal-space push keeps the compact 4-2-3-1 readable during pressure.
  if(!kickoffHold&&!freeKickHold)for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i],b=players[j];if(a.role==='GK'||b.role==='GK')continue;const dx=b.root.position.x-a.root.position.x,dz=b.root.position.z-a.root.position.z,d2=dx*dx+dz*dz;if(d2>0&&d2<.62){const d=Math.sqrt(d2),push=(.79-d)*.5;a.root.position.x-=dx/d*push;b.root.position.x+=dx/d*push;a.root.position.z-=dz/d*push;b.root.position.z+=dz/d*push;}}
  updateReferee(dt);resolveSlideTackles();
  if(owner&&owner.role!=='GK'){
    if(kickoffHold)ball.position.set(0,.25,0);
    else if(freeKickHold)ball.position.set(restartSpot.x,restartKind==='throwin'?2.05:.25,restartSpot.z);
    else{
      const facing=new THREE.Vector3(Math.sin(owner.root.rotation.y),0,Math.cos(owner.root.rotation.y));
      const direction=owner.vel.length()>.6?owner.vel.clone().setY(0).normalize():facing;
      if(ballAnchorOwner!==owner){ballAnchorOwner=owner;ballAnchorDirection.copy(facing);}
      ballAnchorDirection.lerp(direction,Math.min(1,dt*6)).normalize();
      const footX=owner.root.position.x+ballAnchorDirection.x*.72,footZ=owner.root.position.z+ballAnchorDirection.z*.72,follow=Math.min(1,dt*22);
      ball.position.x=THREE.MathUtils.lerp(ball.position.x,footX,follow);ball.position.y=THREE.MathUtils.lerp(ball.position.y,.27,follow);ball.position.z=THREE.MathUtils.lerp(ball.position.z,footZ,follow);
    }
    ballVelocity.set(0,0,0);
  }
}
function updateReferee(dt){
  refSignal=Math.max(0,refSignal-dt);
  let target=new THREE.Vector3(THREE.MathUtils.clamp(ball.position.x*.62+2,-fieldWidth/2+4,fieldWidth/2-4),0,THREE.MathUtils.clamp(ball.position.z*.62,-goalZ+6,goalZ-6));
  if(cardSequence){
    const offender=cardSequence.player;
    if(cardSequence.phase==='approach'){
      const away=referee.root.position.clone().sub(offender.root.position);away.y=0;if(away.lengthSq()<.01)away.set(1,0,0);away.normalize();target=offender.root.position.clone().addScaledVector(away,2.05);
      if(target.distanceTo(referee.root.position)<.45){cardSequence.phase='show';cardSequence.elapsed=0;refereeCard.visible=true;refereeCard.material.color.set(cardSequence.type==='RED'?0xf02d28:0xffd928);}
    }else{
      cardSequence.elapsed+=dt;target=referee.root.position.clone();
      const face=offender.root.position.clone().sub(referee.root.position);referee.root.rotation.y=Math.atan2(face.x,face.z);
      referee.arms[1].rotation.z=THREE.MathUtils.damp(referee.arms[1].rotation.z,2.7,9,dt);
      if(cardSequence.elapsed>2.45){if(cardSequence.type==='RED'){offender.root.position.x=fieldWidth/2+12;offender.root.visible=false;offender.ring.visible=false;}refereeCard.visible=false;cardSequence=null;}
    }
  }
  const d=target.sub(referee.root.position),distance=d.length();if(distance>.4){const speed=cardSequence?8:6;referee.vel.lerp(d.normalize().multiplyScalar(Math.min(speed,distance*1.7)),Math.min(1,dt*(cardSequence?5:3)));referee.root.position.addScaledVector(referee.vel,dt);referee.root.rotation.y=Math.atan2(referee.vel.x,referee.vel.z);}else referee.vel.multiplyScalar(.8);
  referee.action+=dt*(referee.vel.length()>2?10:4);const swing=Math.sin(referee.action)*.4*Math.min(1,referee.vel.length()/4);referee.legs[0].rotation.x=swing;referee.legs[1].rotation.x=-swing;
  referee.arms[0].rotation.z=THREE.MathUtils.damp(referee.arms[0].rotation.z,refSignal>0?-1.15:0,7,dt);
  if(!cardSequence)referee.arms[1].rotation.z=THREE.MathUtils.damp(referee.arms[1].rotation.z,0,7,dt);
}
function segmentDistance(point,a,b){const ab=b.clone().sub(a),denom=ab.lengthSq();const t=denom?THREE.MathUtils.clamp(point.clone().sub(a).dot(ab)/denom,0,1):0;return point.distanceTo(a.clone().addScaledVector(ab,t));}
function resolveSlideTackles(){
  for(const tackler of players){if(tackler.slideTime<=0||tackler.sentOff)continue;
    const from=tackler.slideFrom,to=tackler.root.position;let victim=null,playerGap=Infinity;
    for(const candidate of teams[1-tackler.team]){if(candidate.sentOff||candidate.role==='GK')continue;const gap=segmentDistance(candidate.root.position,from,to);if(gap<playerGap){playerGap=gap;victim=candidate;}}
    const ballGap=segmentDistance(ball.position,from,to);
    if(victim&&playerGap<1.48){
      tackler.slideTime=0;
      if(ballGap<.68){if(owner===victim){owner=null;ball.position.y=.34;ballVelocity.copy(tackler.slideDir).multiplyScalar(4.2);ballVelocity.y=1.8;lastTouch=tackler.team;offsidePlayers.clear();tackleGrace=.18;}else if(!owner){ballVelocity.copy(tackler.slideDir).multiplyScalar(5);ballVelocity.y=1.6;lastTouch=tackler.team;}continue;}
      const towardTackler=tackler.slideDir.clone().negate(),facing=new THREE.Vector3(Math.sin(victim.root.rotation.y),0,Math.cos(victim.root.rotation.y));
      const red=towardTackler.dot(facing)<-.35;tackler.sentOff=red;tackler.vel.set(0,0,0);
      tackler.body.rotation.x=0;tackler.body.position.y=0;tackler.legs.forEach(leg=>leg.rotation.x=0);
      if(red&&controlled===tackler)setControlled(teams[tackler.team].find(p=>!p.sentOff&&p.role!=='GK')||teams[tackler.team][0]);
      const penaltyDepth=goalZ-victim.root.position.z*attack[victim.team],isPenalty=Math.abs(victim.root.position.x)<=20.16&&penaltyDepth>=0&&penaltyDepth<=16.5;
      const restartSpotForFoul=isPenalty?new THREE.Vector3(0,0,attack[victim.team]*39):victim.root.position.clone();
      const foulLabel=isPenalty?(red?'RED CARD · PENALTY KICK':'PENALTY KICK'):(red?'RED CARD · FREE KICK':'YELLOW CARD · FREE KICK');
      beginFreeKick(victim.team,restartSpotForFoul,false,foulLabel,isPenalty?'penalty':'free');
      cardSequence={player:tackler,type:red?'RED':'YELLOW',phase:'approach',elapsed:0};refereeCard.visible=false;
      return;
    }
  }
}
function resolveGoalCollision(previous){
  const combined=BALL_RADIUS+.11;
  for(const end of [-1,1]){
    const postZ=end*(goalZ+.15);
    for(const postX of [-goalHalf,goalHalf]){
      const dx=ball.position.x-previous.x,dz=ball.position.z-previous.z;
      const sx=previous.x-postX,sz=previous.z-postZ,den=dx*dx+dz*dz;
      const t=den?THREE.MathUtils.clamp(-(sx*dx+sz*dz)/den,0,1):0;
      const px=sx+dx*t,pz=sz+dz*t,hitY=THREE.MathUtils.lerp(previous.y,ball.position.y,t),distance=Math.hypot(px,pz);
      if(hitY>=-BALL_RADIUS&&hitY<=2.44+BALL_RADIUS&&distance<combined){
        let nx,nz;if(distance>.001){nx=px/distance;nz=pz/distance;}else{const speed=Math.hypot(ballVelocity.x,ballVelocity.z)||1;nx=-ballVelocity.x/speed;nz=-ballVelocity.z/speed;}
        const hitX=previous.x+dx*t,hitZ=previous.z+dz*t;ball.position.set(hitX+nx*combined,hitY,hitZ+nz*combined);
        const into=ballVelocity.x*nx+ballVelocity.z*nz;if(into<0){ballVelocity.x-=(1.72*into)*nx;ballVelocity.z-=(1.72*into)*nz;ballVelocity.multiplyScalar(1);}
      }
    }
    // Swept sphere against the horizontal crossbar.
    const barZ=end*(goalZ+.15),dy=ball.position.y-previous.y,dz=ball.position.z-previous.z;
    const sy=previous.y-2.44,sz=previous.z-barZ,den=dy*dy+dz*dz;
    const t=den?THREE.MathUtils.clamp(-(sy*dy+sz*dz)/den,0,1):0;
    const py=sy+dy*t,pz=sz+dz*t,xAt=THREE.MathUtils.lerp(previous.x,ball.position.x,t),distance=Math.hypot(py,pz);
    if(Math.abs(xAt)<=goalHalf+combined&&distance<combined){
      let ny,nz;if(distance>.001){ny=py/distance;nz=pz/distance;}else{const speed=Math.hypot(ballVelocity.y,ballVelocity.z)||1;ny=-ballVelocity.y/speed;nz=-ballVelocity.z/speed;}
      const hitY=previous.y+dy*t,hitZ=previous.z+dz*t;ball.position.set(xAt,hitY+ny*combined,hitZ+nz*combined);
      const into=ballVelocity.y*ny+ballVelocity.z*nz;if(into<0){ballVelocity.y-=1.72*into*ny;ballVelocity.z-=1.72*into*nz;}
    }
  }
}
function updateBall(dt){
  if(owner&&(freeKickHold||kickoffHold))return;
  if(owner&&owner.role!=='GK'&&!freeKickHold&&!kickoffHold&&(Math.abs(ball.position.x)>fieldWidth/2+BALL_RADIUS||Math.abs(ball.position.z)>goalZ+BALL_RADIUS)){const point=ball.position.clone();adjudicateOutOfPlay(point,Math.abs(point.x)>fieldWidth/2&&Math.abs(point.z)<=goalZ,owner.team,point.y);return;}
  if(owner){
    if(owner.role==='GK')return;
    tackleGrace=Math.max(0,tackleGrace-dt);
    if(tackleGrace>0)return;
    const holder=owner;let tackler=null;
    for(const p of players){
      if(p.team===holder.team||p.role==='GK'||p.sentOff||p.tackleCooldown>0)continue;
      if(p.root.position.distanceTo(holder.root.position)<1.8){
        const toward=holder.root.position.clone().sub(p.root.position).normalize();
        const facing=new THREE.Vector3(Math.sin(p.root.rotation.y),0,Math.cos(p.root.rotation.y));
        if(toward.dot(facing)>.05||p.team===1){
          if(Math.random()<(p.team===1?.9:.55)){tackler=p;p.tackleCooldown=1.05;break;}
          p.tackleCooldown=.55;
        }
      }
    }
    if(tackler){owner=tackler;ballAnchorOwner=null;lastTouch=tackler.team;const goalDistance=goalZ-attack[tackler.team]*tackler.root.position.z;tackler.aiCooldown=goalDistance<18?.22+Math.random()*.16:1.05+Math.random()*.35;tackler.decisionGrace=goalDistance<18?.12:.85;for(const p of players)p.expectedPassTime=0;ballVelocity.set(0,0,0);switchLocked=false;tackleGrace=.34;if(tackler.team===userTeam)setControlled(tackler);}
    if(owner)return;
  }
  if(curveTime>0&&ballCurve!==0&&ball.position.y>.35){ballVelocity.addScaledVector(curveVector,7*dt);curveTime=Math.max(0,curveTime-dt);}
  else if(curveTime<=0)ballCurve=0;
  const previousBallPosition=ball.position.clone();
  ballVelocity.y-=19.2*dt;ball.position.addScaledVector(ballVelocity,dt);
  resolveGoalCollision(previousBallPosition);
  if(ball.position.y<BALL_RADIUS){ball.position.y=BALL_RADIUS;if(ballVelocity.y< -1.4)ballVelocity.y=-ballVelocity.y*.35;else ballVelocity.y=0;ballVelocity.x*=Math.pow(.985,dt*60);ballVelocity.z*=Math.pow(.985,dt*60);if(Math.abs(ballVelocity.y)<.65)ballVelocity.y=0;}
  ball.rotation.x+=ballVelocity.z*dt*1.8;ball.rotation.z-=ballVelocity.x*dt*1.8;
  const boundaryTime=(from,to,limit)=>{if(to>limit)return Math.max(0,(limit-from)/(to-from||1));if(to< -limit)return Math.max(0,(-limit-from)/(to-from||1));return Infinity;};
  const sideTime=boundaryTime(previousBallPosition.x,ball.position.x,fieldWidth/2+BALL_RADIUS),endTime=boundaryTime(previousBallPosition.z,ball.position.z,goalZ+BALL_RADIUS);
  if(sideTime<=1||endTime<=1){
    const sideFirst=sideTime<endTime,time=Math.min(1,sideFirst?sideTime:endTime),outPoint=previousBallPosition.clone().lerp(ball.position,time),outHeight=previousBallPosition.y+(ball.position.y-previousBallPosition.y)*time;
    if(sideFirst){outPoint.x=Math.sign(ball.position.x)*(fieldWidth/2+BALL_RADIUS);outPoint.z=THREE.MathUtils.clamp(outPoint.z,-goalZ+1,goalZ-1);}
    else outPoint.z=Math.sign(ball.position.z)*(goalZ+BALL_RADIUS);
    adjudicateOutOfPlay(outPoint,sideFirst,lastTouch,outHeight);return;
  }
  kickerGrace=Math.max(0,kickerGrace-dt);
  const candidate=nearestPlayer(ball.position,null,kickerGrace>0?lastKicker:null);
  if(candidate&&candidate.role!=='GK'&&ball.position.distanceTo(candidate.root.position)<1.15&&ball.position.y<1.25){
    if(offsidePlayers.has(candidate)){awardOffside(ball.position.clone());return;}
    offsidePlayers.clear();if(indirectKick&&candidate!==indirectKicker)indirectKick=false;owner=candidate;ballAnchorOwner=null;lastTouch=candidate.team;candidate.expectedPassTime=0;const receiveGoalDistance=goalZ-attack[candidate.team]*candidate.root.position.z;candidate.aiCooldown=receiveGoalDistance<18?.22+Math.random()*.16:1.1+Math.random()*.45;candidate.decisionGrace=receiveGoalDistance<18?.12:.9;for(const p of players)p.expectedPassTime=0;ballVelocity.set(0,0,0);tackleGrace=.24;
    if(candidate.team!==userTeam)switchLocked=false;
    if(candidate.team===userTeam){setControlled(candidate);switchLocked=false;}
    return;
  }
}
function updateMatch(dt){
  if(phaseTimer>0){phaseTimer-=dt;if(phaseTimer<=0)msgEl.classList.remove('show');}
  if(matchState==='playing'&&!kickoffHold&&!freeKickHold&&!cardSequence){
    timeLeft-=dt;
    if(timeLeft<=0){
      timeLeft=0;
      if(half===1){matchState='halftime';document.querySelector('#half-score').textContent=score[0]+' — '+score[1];document.querySelector('#halftime').classList.remove('hidden');}
      else{ended=true;matchState='full time';document.querySelector('#final-score').textContent=score[0]+' — '+score[1];document.querySelector('#match-end').classList.remove('hidden');}
    }
  }else if(matchState==='goal'){
    restartTimer-=dt;if(restartTimer<=0){const scoringTeam=lastTouch;resetPlayersAfterScore(1-scoringTeam);}
  }
  updateHUD();
}
function updateCamera(dt){
  const cinematic=!!cardSequence,f=attack[0];
  const focus=cinematic?referee.root.position:(owner?owner.root.position:ball.position);
  const desired=cinematic
    ?new THREE.Vector3(focus.x-24,14,focus.z-f*8)
    :new THREE.Vector3(focus.x-56,31,focus.z-f*17);
  // Keep the camera on the pitch side of the end-stand canopies. Otherwise,
  // chasing a goalkeeper puts it behind/inside the roof and the roof fills the view.
  const endRoofSafe=!cinematic&&(desired.z < -46 || desired.z > 46);
  desired.z=THREE.MathUtils.clamp(desired.z,-46,46);
  camera.position.lerp(desired,1-Math.exp(-dt*(cinematic?3.2:1.8)));
  camera.position.z=THREE.MathUtils.clamp(camera.position.z,-46,46);
  camera.fov=THREE.MathUtils.damp(camera.fov,cinematic?30:38,cinematic?3.2:2.1,dt);camera.updateProjectionMatrix();
  camera.lookAt(focus.x,cinematic?.8:0,focus.z+(cinematic||endRoofSafe?0:f*4));
}
let previous=performance.now();function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,(now-previous)/1000);previous=now;
  updateCrowd(dt);
  if(!ended){if(!menuActive){updateMatch(dt);if(matchState==='playing'){if(cardSequence){updateReferee(dt);if(freeKickHold)updateFreeKickMovement(dt);}else{updatePlayers(dt,now/1000);updateBall(dt);}}}updateCamera(dt);}
  if(charging){kickCharge=Math.min(1,(now-chargeStart)/(chargingKind==='shot'?1800:1300));powerFill.style.width=(kickCharge*100)+'%';}
  renderer.render(scene,camera);
}
let chargeStart=0;
window.addEventListener('pointermove',e=>{mouse.x=e.clientX/innerWidth*2-1;mouse.y=1-e.clientY/innerHeight*2;});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(menuActive)return;keys.add(e.code);if(e.code==='KeyQ'&&!e.repeat)switchPlayer();if(e.code==='Space'&&!e.repeat)startSlide(controlled);});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();charging=false;powerWrap.classList.remove('active');});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{
  if((e.button===0||e.button===2)&&owner===controlled&&matchState==='playing'){
    if(restartKind==='throwin'&&e.button!==2)return;
    e.preventDefault();charging=true;chargingKind=restartKind==='throwin'?'pass':e.button===0?'shot':'pass';chargeStart=performance.now();kickCharge=0;
    powerLabel.textContent=restartKind==='throwin'?'THROW POWER':chargingKind==='shot'?'SHOT POWER':'PASS POWER';powerWrap.classList.add('active');
  }
});
window.addEventListener('pointerup',e=>{
  const released=e.button===0?'shot':e.button===2?'pass':null;
  if(charging&&released===chargingKind){charging=false;powerWrap.classList.remove('active');if(owner===controlled&&matchState==='playing')releaseBall(controlled,chargingKind,Math.max(.05,kickCharge));}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));});
document.querySelector('#restart').addEventListener('click',()=>location.reload());
document.querySelector('#continue-match').addEventListener('click',()=>{
  if(matchState!=='halftime')return;
  document.querySelector('#halftime').classList.add('hidden');half=2;attack[0]*=-1;attack[1]*=-1;timeLeft=240;setupKickoff(1);announce('AWAY KICK OFF',2.2);
});
const mainMenu=document.querySelector('#main-menu'),menuCard=document.querySelector('.menu-card'),modeView=document.querySelector('#mode-view'),teamSelectView=document.querySelector('#team-select-view'),kitSelectView=document.querySelector('#kit-select-view'),sideSelectView=document.querySelector('#side-select-view'),comingView=document.querySelector('#coming-view');
const sideData={
  England:{
    'Premier League':'Arsenal|ARS|🔴;Aston Villa|AVL|🟣;Bournemouth|BOU|🍒;Brentford|BRE|🐝;Brighton|BHA|🔵;Burnley|BUR|🍷;Chelsea|CHE|🔵;Crystal Palace|CRY|🦅;Everton|EVE|🔵;Fulham|FUL|⚫;Leeds United|LEE|⚪;Liverpool|LIV|🔴;Manchester City|MCI|🩵;Manchester United|MUN|🔴;Newcastle United|NEW|⚫;Nottingham Forest|NFO|🌳;Sunderland|SUN|🔴;Tottenham Hotspur|TOT|⚪;West Ham United|WHU|🍷;Wolverhampton Wanderers|WOL|🟠',
    'Championship':'Birmingham City|BIR|🔵;Blackburn Rovers|BLK|🔵;Bristol City|BRC|🔴;Charlton Athletic|CHA|🔴;Coventry City|COV|🔵;Derby County|DER|⚫;Hull City|HUL|🟠;Ipswich Town|IPS|🔵;Leicester City|LEI|🔵;Middlesbrough|MID|🔴;Millwall|MWL|🔵;Norwich City|NOR|🟡;Oxford United|OXF|🟡;Portsmouth|POR|🔵;Preston North End|PNE|⚪;Queens Park Rangers|QPR|🔵;Sheffield United|SHU|🔴;Sheffield Wednesday|SHW|🔵;Southampton|SOU|🔴;Stoke City|STK|🔴;Swansea City|SWA|⚪;Watford|WAT|🟡;West Bromwich Albion|WBA|⚪;Wrexham|WRE|🔴',
    'League One':'Barnsley|BAR|🔴;Blackpool|BLA|🟠;Bolton Wanderers|BOL|⚪;Bradford City|BFD|🟡;Burton Albion|BRT|🟡;Cardiff City|CAR|🔵;Doncaster Rovers|DON|🔴;Exeter City|EXE|🔴;Huddersfield Town|HUD|🔵;Leyton Orient|LEY|🔴;Lincoln City|LIN|🔴;Luton Town|LUT|🟠;Mansfield Town|MAN|🟡;Northampton Town|NOR|🔴;Peterborough United|PET|🔵;Plymouth Argyle|PLY|🟢;Port Vale|PVA|⚫;Reading|REA|🔵;Rotherham United|ROT|🔴;Stevenage|STE|🔴;Stockport County|STO|🔴;Wigan Athletic|WIG|🔵;Wycombe Wanderers|WYC|🔵;AFC Wimbledon|WIM|🔵',
    'League Two':'Accrington Stanley|ACC|🔴;Barrow|BAW|🔵;Bristol Rovers|BRR|🔵;Bromley|BRO|🔴;Cambridge United|CAM|🟡;Cheltenham Town|CLT|🔴;Chesterfield|CHF|🔵;Colchester United|COL|🔵;Crawley Town|CRA|🔴;Crewe Alexandra|CRE|🔴;Fleetwood Town|FLE|🔴;Gillingham|GIL|🔵;Grimsby Town|GRI|⚫;Harrogate Town|HAR|🟡;Newport County|NPT|🟠;Notts County|NOT|⚫;Oldham Athletic|OLD|🔵;Salford City|SAL|🔴;Shrewsbury Town|SHR|🔵;Swindon Town|SWI|🔴;Tranmere Rovers|TRA|⚪;Walsall|WAL|🔴;Milton Keynes Dons|MKD|⚪;Barnet|BNE|🟠'
  },
  Spain:{
    'La Liga':'Athletic Club|ATH|🔴;Atlético Madrid|ATM|🔴;Barcelona|BAR|🔵;Real Betis|BET|🟢;Celta Vigo|CEL|🩵;Espanyol|ESY|🔵;Getafe|GET|🔵;Girona|GIR|🔴;Osasuna|OSA|🔴;Real Madrid|RMA|⚪;Mallorca|MLL|🔴;Rayo Vallecano|RAY|🔴;Real Sociedad|RSO|🔵;Sevilla|SEV|⚪;Valencia|VAL|🟠;Villarreal|VIL|🟡;Alavés|ALA|🔵;Elche|ELC|🟢;Levante|LEV|🔴;Real Oviedo|OVI|🔵',
    'La Liga Hypermotion':'Albacete|ALB|⚪;Almería|ALM|🔴;Burgos|BGU|⚫;Cádiz|CAD|🟡;Castellón|CAS|⚫;Córdoba|COR|⚪;Deportivo La Coruña|DEP|🔵;Eibar|EIB|🔴;Granada|GRA|🔴;Huesca|HUE|🔵;Las Palmas|LPA|🟡;Leganés|LEG|🔵;Málaga|MAL|🔵;Mirandés|MIR|🔴;Racing Santander|RAC|⚪;Sporting Gijón|SPO|🔴;Tenerife|TEN|🔵;Real Zaragoza|ZAR|⚪'
  },
  France:{
    'Ligue 1':'Auxerre|AUX|🔵;Lens|LEN|🟡;Lille|LIL|🔴;Lyon|LYO|🔴;Marseille|OM|🩵;Monaco|MON|🔴;Montpellier|MTP|🟠;Nantes|NAN|🟡;Nice|NIC|🔴;Paris Saint-Germain|PSG|🔵;Rennes|REN|🔴;Strasbourg|STR|🔵;Toulouse|TOU|🟣;Brest|BST|🔴;Le Havre|HAV|🩵;Lorient|LOR|🟠;Metz|MET|🍷;Saint-Étienne|STE|🟢',
    'Ligue 2':'Amiens|AMI|⚫;Annecy|ANN|🔴;Bastia|BAS|🔵;Clermont Foot|CLE|🔴;Dunkerque|DUN|🔵;Grenoble|GRE|🔵;Guingamp|GUI|🔴;Laval|LAV|🟠;Pau|PAU|🟡;Red Star|RED|🟢;Rodez|ROD|🔴;Troyes|TRO|🔵'
  },
  Germany:{
    'Bundesliga':'Augsburg|AUG|🔴;Bayer Leverkusen|B04|🔴;Bayern Munich|BAY|🔴;Borussia Dortmund|DOR|🟡;Borussia Mönchengladbach|BMG|⚫;Eintracht Frankfurt|SGE|⚫;Freiburg|SCF|⚫;Hamburger SV|HSV|🔵;Heidenheim|HDH|🔴;Hoffenheim|TSG|🔵;Mainz 05|MAI|🔴;RB Leipzig|RBL|⚪;St. Pauli|STP|🟤;Schalke 04|S04|🔵;Union Berlin|FCU|🔴;Werder Bremen|SVW|🟢;Wolfsburg|WOB|🟢;FC Köln|KOE|⚪',
    '2. Bundesliga':'Arminia Bielefeld|BIE|🔵;Bochum|BOC|🔵;Darmstadt 98|DAR|🔵;Dynamo Dresden|DRE|🟡;Elversberg|ELV|⚫;Fortuna Düsseldorf|FDU|🔴;Hannover 96|HAN|🟢;Hertha Berlin|HER|🔵;Kaiserslautern|FCK|🔴;Karlsruhe|KSC|🔵;Nürnberg|FCN|🔴;Paderborn|PAD|🔵;Preußen Münster|MUN|🟢;Greuther Fürth|FUR|🟢'
  },
  Italy:{
    'Serie A':'Atalanta|ATA|🔵;Bologna|BOL|🔴;Cagliari|CAG|🔴;Como|COM|🔵;Cremonese|CRE|🔴;Fiorentina|FIO|🟣;Genoa|GEN|🔴;Inter Milan|INT|🔵;Juventus|JUV|⚫;Lazio|LAZ|🩵;Lecce|LEC|🟡;AC Milan|MIL|🔴;Napoli|NAP|🔵;Parma|PAR|🟡;Pisa|PIS|⚫;Roma|ROM|🟠;Sassuolo|SAS|🟢;Torino|TOR|🍷;Udinese|UDI|⚫;Verona|VER|🟡',
    'Serie B':'Avellino|AVE|🟢;Bari|BAR|⚪;Catanzaro|CAT|🟡;Cesena|CES|⚫;Empoli|EMP|🔵;Frosinone|FRO|🟡;Juve Stabia|JST|🟡;Mantova|MAN|🔴;Modena|MOD|🟡;Monza|MNZ|🔴;Padova|PAD|⚪;Palermo|PAL|🩷;Pescara|PES|🩵;Reggiana|REG|🔴;Sampdoria|SAM|🔵;Spezia|SPE|⚪;Südtirol|SUD|⚪;Venezia|VEN|🟠'
  }
};
const confederations={
  UEFA:'France|FRA|🇫🇷;Spain|ESP|🇪🇸;England|ENG|🏴;Germany|GER|🇩🇪;Italy|ITA|🇮🇹;Portugal|POR|🇵🇹;Netherlands|NED|🇳🇱;Scotland|SCO|🏴',
  AFC:'Japan|JPN|🇯🇵;South Korea|KOR|🇰🇷;Australia|AUS|🇦🇺;Iran|IRN|🇮🇷;Saudi Arabia|KSA|🇸🇦',
  CAF:'Morocco|MAR|🇲🇦;Senegal|SEN|🇸🇳;Nigeria|NGA|🇳🇬;Egypt|EGY|🇪🇬;South Africa|RSA|🇿🇦',
  CONCACAF:'United States|USA|🇺🇸;Mexico|MEX|🇲🇽;Canada|CAN|🇨🇦;Jamaica|JAM|🇯🇲;Costa Rica|CRC|🇨🇷',
  CONMEBOL:'Argentina|ARG|🇦🇷;Brazil|BRA|🇧🇷;Uruguay|URU|🇺🇾;Colombia|COL|🇨🇴;Chile|CHI|🇨🇱',
  OFC:'New Zealand|NZL|🇳🇿;Fiji|FIJ|🇫🇯;Solomon Islands|SOL|🇸🇧'
};
const parseRows=rows=>rows.split(';').filter(Boolean).map(row=>{const [name,abbr,emoji]=row.split('|');return {name,abbr,emoji};});
const domesticCountries=['England','Spain','France','Germany','Italy'];
const countryOptions=[...domesticCountries,'International'];
const selectedClubs={home:null,away:null};
const selector=(side,name)=>document.querySelector('#'+side+'-'+name);
function fillOptions(element,items,valueOf,labelOf){element.replaceChildren(...items.map(item=>{const option=document.createElement('option');option.value=valueOf(item);option.textContent=labelOf(item);return option;}));}
function teamsForSide(side){
  const country=selector(side,'country').value,second=selector(side,'secondary').value;
  if(country==='International')return parseRows(confederations[second]||confederations.UEFA);
  return parseRows((sideData[country]||{})[second]||Object.values(sideData[country])[0]);
}
function updateClubPreview(side){
  const team=teamsForSide(side).find(item=>item.abbr===selector(side,'team').value)||teamsForSide(side)[0];
  selectedClubs[side]={...team,isInternational:selector(side,'country').value==='International'};
  selector(side,'emoji').textContent=team.emoji;selector(side,'team-name').textContent=team.name;selector(side,'team-abbr').textContent=team.abbr;
}
function updateTeamChoices(side,preferred){
  const country=selector(side,'country').value,secondary=selector(side,'secondary'),teamLabel=selector(side,'team-label');
  const teamLabelText=country==='International'?'NATIONAL TEAM':'TEAM';teamLabel.textContent=teamLabelText;
  const choices=teamsForSide(side);fillOptions(selector(side,'team'),choices,t=>t.abbr,t=>t.name);
  if(preferred&&choices.some(t=>t.abbr===preferred))selector(side,'team').value=preferred;
  updateClubPreview(side);
}
function updateSideOptions(side,defaultLeague,defaultTeam){
  const countrySelect=selector(side,'country'),country=countrySelect.value,secondary=selector(side,'secondary'),label=selector(side,'secondary-label');
  if(country==='International'){
    label.textContent='CONFEDERATION';fillOptions(secondary,Object.keys(confederations),x=>x,x=>x);
    if(defaultLeague&&confederations[defaultLeague])secondary.value=defaultLeague;
  }else{
    label.textContent='LEAGUE';const leagues=Object.keys(sideData[country]);fillOptions(secondary,leagues,x=>x,x=>x);
    if(defaultLeague&&sideData[country][defaultLeague])secondary.value=defaultLeague;
  }
  updateTeamChoices(side,defaultTeam);
}
function initializeSide(side,teamAbbr){
  fillOptions(selector(side,'country'),countryOptions,x=>x,x=>x);
  selector(side,'country').value='England';selector(side,'country').addEventListener('change',()=>updateSideOptions(side));
  selector(side,'secondary').addEventListener('change',()=>updateTeamChoices(side));
  selector(side,'team').addEventListener('change',()=>updateClubPreview(side));
  updateSideOptions(side,'Premier League',teamAbbr);
}
initializeSide('home','ARS');initializeSide('away','LIV');
const clubKitRegistry={
  ARS:[0xef0107,0xffffff,0x18345e],AVL:[0x670e36,0x95bfe5,0xf5d64e],BOU:[0xd71920,0x151515,0x35a68b],BRE:[0xe30613,0x111111,0xf0d34f],BHA:[0x0057b8,0xffd700,0x102a43],BUR:[0x6c1d45,0x8cc5e8,0xf4cf36],CHE:[0x034694,0xffffff,0x171717],CRY:[0x1b458f,0xffffff,0xc8102e],EVE:[0x003399,0xf5a623,0xffffff],FUL:[0xffffff,0x171717,0xd71920],LEE:[0xffffff,0x17284b,0xffcd00],LIV:[0xc8102e,0xf3f1e8,0x108b8b],MCI:[0x6cabdd,0x142d54,0x7b243d],MUN:[0xd71920,0x17284b,0xf4f1e8],NEW:[0x171717,0x9bd7e8,0x1b7f61],NFO:[0xe53233,0xffffff,0xf1d34f],SUN:[0xeb172b,0xffffff,0x168b62],TOT:[0xffffff,0x17284b,0xf0d339],WHU:[0x7a263a,0xffffff,0x6db8d4],WOL:[0xfdb913,0x171717,0xffffff],
  FRA:[0x14285a,0xf7f6f0],ESP:[0xaa151b,0x173660],ENG:[0xf3f2ed,0x14285a],GER:[0xf3f2ed,0x181818],ITA:[0x1859a9,0xf6f5ef],POR:[0xc91e32,0xf5f2e8],NED:[0xf36c21,0x14285a],SCO:[0x193b75,0xffffff],JPN:[0x123b85,0xffffff],KOR:[0xd71920,0xffffff],AUS:[0x157a48,0xf4d330],IRN:[0x19824a,0xffffff],KSA:[0x16854a,0xffffff],MAR:[0xd71920,0xffffff],SEN:[0x16834b,0xffffff],NGA:[0x16834b,0xffffff],EGY:[0xd71920,0xffffff],RSA:[0x16834b,0xffffff],USA:[0xf4f2ed,0x183b70],MEX:[0x087d4b,0xffffff],CAN:[0xd71920,0xffffff],JAM:[0xf0c62d,0x111111],CRC:[0xd71920,0xffffff],ARG:[0x83c6e8,0xffffff],BRA:[0xf5d52f,0x1b4e9b],URU:[0x83c6e8,0x171717],COL:[0xf5d22e,0x173a70],CHI:[0xd71920,0xffffff],NZL:[0xffffff,0x171717],FIJ:[0x73b8e8,0xffffff],SOL:[0x1e4d9a,0xffffff],
  ATH:[0xd71920,0xffffff,0x176642],BET:[0x147047,0xffffff,0x173d7a],CEL:[0x79c6e8,0xffffff,0x173d7a],GET:[0x1766b0,0xffffff,0x173d7a],GIR:[0xd71920,0xffffff,0x171717],OSA:[0xc92335,0x171717,0xffffff],MLL:[0xd71920,0x171717,0xffffff],RAY:[0xf4f2ed,0xd71920,0x171717],RSO:[0xffffff,0x1766b0,0x171717],SEV:[0xffffff,0xd71920,0x171717],VAL:[0xf4f2ed,0x171717,0xe77825],VIL:[0xf3d12e,0x171717,0xffffff],ALA:[0x1766b0,0xffffff,0x171717],ELC:[0x16834a,0xffffff,0x171717],LEV:[0x1b458f,0xd71920,0xffffff],OVI:[0x1766b0,0xffffff,0x171717],AUX:[0xffffff,0x1766b0,0xd71920],LEN:[0xd71920,0xf3d12e,0x171717],LIL:[0xd71920,0xffffff,0x171717],LYO:[0xffffff,0x1766b0,0xd71920],MON:[0xd71920,0xffffff,0x171717],REN:[0xd71920,0x171717,0xffffff],STR:[0x1766b0,0xffffff,0xd71920],TOU:[0x632c73,0xffffff,0xe77825],OM:[0xffffff,0x70b9d5,0x173d7a],B04:[0xe32219,0xffffff,0x171717],RMA:[0xf4f2ed,0x173d7a,0xffc928],BAR:[0x9e1b43,0x17284b,0xf3cb34],ATM:[0xd71920,0xffffff,0x173d7a],PSG:[0x173d7a,0xffffff,0xef3340],BAY:[0xd71920,0xffffff,0x171717],DOR:[0xf5df00,0x171717,0xffffff],LEV:[0xe32219,0xffffff,0x171717],INT:[0x0879c9,0x171717,0xffffff],JUV:[0xffffff,0x171717,0xf3b21b],MIL:[0xd71920,0xffffff,0x171717],NAP:[0x1595d3,0xffffff,0x173d7a],ROM:[0x8b1e2d,0xf2b03a,0xffffff],
};
const emojiColor={'🔴':0xc92335,'🟣':0x632c73,'🍒':0xc92335,'🐝':0xe1c12d,'🔵':0x1766b0,'🩵':0x70b9d5,'🍷':0x702a42,'⚪':0xf2f0e8,'🟠':0xe77825,'⚫':0x1b1d20,'🟡':0xe2c72b,'🟢':0x18834a,'🦅':0x244b85,'🌳':0xd92c38,'🍺':0xdaa83a};
function getKitPalette(club){return clubKitRegistry[club.abbr]||[emojiColor[club.emoji]||0x2866a2,0xf2f0e8,0x23384f];}
function currentKitColor(side){const club=selectedClubs[side],idx={home:0,away:1,third:2}[selector(side,'kit').value];return getKitPalette(club)[idx];}
function configureKitOptions(side){
  const club=selectedClubs[side],select=selector(side,'kit');
  const options=club.isInternational?[['home','Home Kit'],['away','Away Kit']]:[['home','Home Kit'],['away','Away Kit'],['third','Third Kit']];
  fillOptions(select,options,item=>item[0],item=>item[1]);
}
function refreshKitPreview(side){
  const club=selectedClubs[side];selector(side,'kit-name').textContent=club.name;selector(side,'kit-abbr').textContent=club.abbr;
  selector(side,'kit-swatch').style.backgroundColor='#'+currentKitColor(side).toString(16).padStart(6,'0');
}
function showModes(){modeView.hidden=false;teamSelectView.hidden=true;kitSelectView.hidden=true;sideSelectView.hidden=true;comingView.hidden=true;menuCard.classList.remove('setup-active');}
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.mode;
  if(mode==='quick'){modeView.hidden=true;teamSelectView.hidden=false;kitSelectView.hidden=true;sideSelectView.hidden=true;menuCard.classList.add('setup-active');return;}
  modeView.hidden=true;comingView.hidden=false;document.querySelector('#coming-title').textContent=button.querySelector('span:nth-child(2)').textContent;
}));
document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',showModes));
document.querySelector('[data-setup-back]').addEventListener('click',showModes);
document.querySelector('#next-kits').addEventListener('click',()=>{
  document.querySelector('#team-select-error').textContent='';
  if(selectedClubs.home.abbr===selectedClubs.away.abbr){document.querySelector('#team-select-error').textContent='Choose two different teams.';return;}
  modeView.hidden=true;teamSelectView.hidden=true;kitSelectView.hidden=false;
  document.querySelector('#home-kit-name').textContent=selectedClubs.home.name;document.querySelector('#away-kit-name').textContent=selectedClubs.away.name;
  document.querySelector('#home-kit-abbr').textContent=selectedClubs.home.abbr;document.querySelector('#away-kit-abbr').textContent=selectedClubs.away.abbr;
  configureKitOptions('home');configureKitOptions('away');selector('home','kit').value='home';selector('away','kit').value='away';refreshKitPreview('home');refreshKitPreview('away');
});
document.querySelector('[data-kits-back]').addEventListener('click',()=>{kitSelectView.hidden=true;teamSelectView.hidden=false;});
selector('home','kit').addEventListener('change',()=>refreshKitPreview('home'));selector('away','kit').addEventListener('change',()=>refreshKitPreview('away'));
document.querySelector('#start-quick-match').addEventListener('click',()=>{
  document.querySelector('#choose-home-name').textContent=selectedClubs.home.name;document.querySelector('#choose-away-name').textContent=selectedClubs.away.name;
  kitSelectView.hidden=true;sideSelectView.hidden=false;chosenUserTeam=0;updateUserSideChoice();
});
document.querySelector('[data-side-back]').addEventListener('click',()=>{sideSelectView.hidden=true;kitSelectView.hidden=false;});
let chosenUserTeam=0;
function updateUserSideChoice(){
  document.querySelectorAll('[data-user-side]').forEach(button=>button.classList.toggle('selected',Number(button.dataset.userSide)===chosenUserTeam));
  document.querySelector('#user-side-note').textContent=chosenUserTeam===0?'You control the home team and kick off first.':'You control the away team. Home kicks off first.';
}
document.querySelectorAll('[data-user-side]').forEach(button=>button.addEventListener('click',()=>{chosenUserTeam=Number(button.dataset.userSide);updateUserSideChoice();}));
document.querySelector('#confirm-match').addEventListener('click',()=>{
  document.querySelector('#home-abbr').textContent=selectedClubs.home.abbr;document.querySelector('#away-abbr').textContent=selectedClubs.away.abbr;
  for(const p of teams[0])if(p.role!=='GK'){const color=currentKitColor('home');p.shirtMaterial.color.setHex(color);p.shirtColor=color;}
  for(const p of teams[1])if(p.role!=='GK'){const color=currentKitColor('away');p.shirtMaterial.color.setHex(color);p.shirtColor=color;}
  userTeam=chosenUserTeam;difficultyLevel=Number(document.querySelector('#difficulty').value);setControlled(teams[userTeam].find(p=>p.role==='ST'&&!p.sentOff)||teams[userTeam].find(p=>p.role!=='GK'&&!p.sentOff));
  menuActive=false;mainMenu.classList.add('hidden');announce('HOME KICK OFF',2.2);
});
controlled.ring.visible=true;
requestAnimationFrame(animate);
setTimeout(()=>document.querySelector('.loading').classList.add('done'),650);
