// Original ceremonial timeline for Len Chua Online. Browser and Node compatible.
// All poses are explicit and testable: two knees, both raised hands, full bow,
// and one incense stick held by both hands, walked to and inserted in the censer.
export const RITUAL_STATIONS=Object.freeze({
  burnIncense:Object.freeze({x:540,y:1168}),
  bow:Object.freeze({x:540,y:1240}),
  sendPrayer:Object.freeze({x:690,y:1250}),
  offerLotus:Object.freeze({x:420,y:1240}),
  drawFortune:Object.freeze({x:540,y:1250})
});
export const RITUAL_DURATIONS=Object.freeze({
  leaveSeat:.95, walkToStation:2.45,
  kneelDown:.8, raiseHands:.85, prostrate:.75, holdBow:.5, riseUp:.85,
  holdIncense:.75, raiseIncense:.9, placeIncense:1.25, joinHands:.8,
  holdLantern:.8, releaseLantern:.8, prepareAction:.6, performAction:1.6,
  holdAction:.8, returnAisle:2.4, returnSeat:1.05, simple:1.2
});
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=p=>{let t=clamp(p);return t*t*(3-2*t)};
const mix=(a,b,p)=>a+(b-a)*smooth(p);
const MOVEMENT=new Set(['leaveSeat','walkToStation','returnAisle','returnSeat']);

export function createRitualDirector({maxQueue=12,onStart=()=>({}),onPhase=()=>{},onFinish=()=>{}}={}){
  let active=null,queue=[],dropped=0,completed=0;
  const ids=new Set();
  const startStage=event=>['ringBell','strikeWoodenFish'].includes(event.type)?'simple':'leaveSeat';
  function enter(stage){
    if(!active)return;
    active.stage=stage;active.stageTime=0;
    onPhase(active.event,stage);
  }
  function activate(){
    if(active||!queue.length)return;
    const event=queue.shift(),p=onStart(event)||{};
    active={
      event,
      home:{x:clamp(Number(p.x)||380,45,1035),y:clamp(Number(p.y)||1710,1200,1900)},
      station:RITUAL_STATIONS[event.type]||RITUAL_STATIONS.bow,
      stage:'',stageTime:0,elapsed:0,bowCount:0,
      voiceStarted:false,voiceDone:false
    };
    enter(startStage(event));
  }
  function enqueue(event){
    if(!event||typeof event.id!=='string'||!event.id||!event.type||ids.has(event.id))return false;
    if(queue.length>=maxQueue){dropped++;return false;}
    ids.add(event.id);queue.push(event);activate();return true;
  }
  function complete(){
    if(!active)return;
    const event=active.event;ids.delete(event.id);completed++;active=null;onFinish(event);activate();
  }
  function speechStart(id){if(active?.event.id!==id)return false;active.voiceStarted=true;return true;}
  function speechEnd(id){if(active?.event.id!==id)return false;active.voiceDone=true;return true;}
  function advance(dt){
    activate();if(!active)return null;
    const a=active,tick=clamp(Number(dt)||0,0,.1);
    a.elapsed+=tick;a.stageTime+=tick;
    const done=a.stageTime>=(RITUAL_DURATIONS[a.stage]||1);
    if(done)switch(a.stage){
      case 'simple':complete();break;
      case 'leaveSeat':enter('walkToStation');break;
      case 'walkToStation':
        if(a.event.type==='bow')enter('kneelDown');
        else if(a.event.type==='burnIncense')enter('holdIncense');
        else if(a.event.type==='sendPrayer')enter('holdLantern');
        else enter('prepareAction');
        break;
      case 'kneelDown':enter('raiseHands');break;
      case 'raiseHands':enter('prostrate');break;
      case 'prostrate':enter('holdBow');break;
      case 'holdBow':enter('riseUp');break;
      case 'riseUp':
        a.bowCount++;
        if(a.bowCount<3)enter('kneelDown');else enter('holdAction');
        break;
      case 'holdIncense':enter('raiseIncense');break;
      case 'raiseIncense':enter('placeIncense');break;
      case 'placeIncense':enter('joinHands');break;
      case 'joinHands':enter('holdAction');break;
      case 'holdLantern':enter('releaseLantern');break;
      case 'releaseLantern':enter('joinHands');break;
      case 'prepareAction':enter('performAction');break;
      case 'performAction':enter('holdAction');break;
      case 'holdAction':
        // Voice is optional and never freezes the event queue.
        if(!a.voiceStarted||a.voiceDone||a.stageTime>10)enter('returnAisle');
        break;
      case 'returnAisle':enter('returnSeat');break;
      case 'returnSeat':complete();break;
    }
    return snapshot();
  }
  function snapshot(){
    if(!active)return null;
    const a=active,t=a.stageTime,stage=a.stage,home=a.home,station=a.station;
    const aisle={x:540,y:home.y},p=clamp(t/(RITUAL_DURATIONS[stage]||1));
    let x=station.x,y=station.y;
    if(stage==='simple'){x=home.x;y=home.y;}
    else if(stage==='leaveSeat'){x=mix(home.x,aisle.x,p);y=home.y;}
    else if(stage==='walkToStation'){x=mix(aisle.x,station.x,p);y=mix(aisle.y,station.y,p);}
    else if(stage==='returnAisle'){x=mix(station.x,aisle.x,p);y=mix(station.y,aisle.y,p);}
    else if(stage==='returnSeat'){x=mix(aisle.x,home.x,p);y=home.y;}
    const walking=MOVEMENT.has(stage);
    let pose=walking?'walk':'stand',kneel=0,raise=0,bow=0;
    if(stage==='kneelDown'){pose='kneel';kneel=smooth(p);}
    else if(stage==='raiseHands'){pose='raiseHands';kneel=1;raise=smooth(p);}
    else if(stage==='prostrate'){pose='prostrate';kneel=1;raise=1;bow=smooth(p);}
    else if(stage==='holdBow'){pose='prostrate';kneel=1;raise=1;bow=1;}
    else if(stage==='riseUp'){pose='rise';kneel=1;raise=1;bow=1-smooth(p);}
    else if(stage==='holdAction'&&a.event.type==='bow'){pose='kneel';kneel=1;}
    else if(a.event.type==='burnIncense'){
      if(stage==='holdIncense')pose='holdIncense';
      else if(stage==='raiseIncense')pose='raiseIncense';
      else if(stage==='placeIncense')pose='placeIncense';
      else if(stage==='joinHands'||stage==='holdAction')pose='joinHands';
      else if(walking&&['leaveSeat','walkToStation'].includes(stage))pose='walkIncense';
    }else if(stage==='holdLantern')pose='holdLantern';
    else if(stage==='releaseLantern')pose='releaseLantern';
    else if(stage==='joinHands'||stage==='holdAction'||stage==='prepareAction')pose='joinHands';
    return{
      event:a.event,stage,pose,x,y,kneel,raise,bow,
      bowCount:Math.min(3,a.bowCount+1),
      moving:walking,progress:p,stageTime:t,elapsed:a.elapsed,
      station:{...station},canPlayVoice:['holdIncense','raiseIncense','kneelDown','raiseHands','holdLantern','prepareAction','performAction','holdAction'].includes(stage)
    };
  }
  function stats(){return{active:active?.event.id||null,queued:queue.length,dropped,completed};}
  function reset(){active=null;queue=[];ids.clear();}
  return{enqueue,advance,snapshot,stats,reset,speechStart,speechEnd};
}
