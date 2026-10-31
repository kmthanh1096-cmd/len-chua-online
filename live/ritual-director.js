// Original action choreography; browser + Node compatible. No borrowed assets.
export const RITUAL_STATIONS = Object.freeze({
  burnIncense: { x: 540, y: 1165 },
  bow: { x: 540, y: 1220 },
  sendPrayer: { x: 690, y: 1245 },
  offerLotus: { x: 420, y: 1225 },
  drawFortune: { x: 540, y: 1245 }
});
const clip = (n, low=0, high=1) => Math.max(low, Math.min(high, n));
const ease = p => { const t=clip(p);return t*t*(3-2*t); };
const mix = (a,b,p) => a+(b-a)*clip(p);
const TIME = Object.freeze({
  leaveSeat: 1.05, walkToStation: 2.1, prepareAction: 0.85,
  returnAisle: 2.1, returnSeat: 1.05, simple: 1.2
});
const DURATION = { burnIncense: 3.8, bow: 5.7, sendPrayer: 3.8,
  offerLotus: 2.5, drawFortune: 2.5 };
const DEFAULT_HOME = { x: 380, y: 1720 };

export function createRitualDirector({ maxQueue=12, onStart=()=>({}), onFinish=()=>{}, onPhase=()=>{} }={}) {
  let pending=[], active=null, completed=0, dropped=0;
  const ids=new Set();
  function enter(stage) {
    if(!active) return;
    active.stage=stage;active.stageTime=0;
    onPhase(active.event,stage);
  }
  function start() {
    if(active || !pending.length) return;
    const event=pending.shift();
    const placement=onStart(event)||{};
    const home={x:clip(Number(placement.x)||DEFAULT_HOME.x,40,1040),
      y:clip(Number(placement.y)||DEFAULT_HOME.y,1180,1900)};
    active={event,home,station:RITUAL_STATIONS[event.type]||RITUAL_STATIONS.bow,
      stage:'',stageTime:0,elapsed:0,voiceStarted:false,voiceDone:false};
    enter(['ringBell','strikeWoodenFish'].includes(event.type)?'simple':'leaveSeat');
  }
  function enqueue(event) {
    if(!event || typeof event.id!=='string' || !event.id || !event.type || ids.has(event.id)) return false;
    if(pending.length>=maxQueue){dropped++;return false;}
    ids.add(event.id);pending.push(event);start();return true;
  }
  function complete(){
    if(!active)return;
    const event=active.event;
    ids.delete(event.id); completed++;active=null;
    onFinish(event);start();
  }
  function speechStart(id) {
    if(active?.event.id!==id)return false;
    active.voiceStarted=true;return true;
  }
  function speechEnd(id) {
    if(active?.event.id!==id)return false;
    active.voiceDone=true;return true;
  }
  function advance(dt) {
    start();if(!active)return null;
    const s=active;
    const tick=clip(Number(dt)||0,0,0.1);
    s.elapsed+=tick;s.stageTime+=tick;
    const t=s.stageTime;
    switch(s.stage){
      case 'simple':if(t>=TIME.simple)complete();break;
      case 'leaveSeat':if(t>=TIME.leaveSeat)enter('walkToStation');break;
      case 'walkToStation':if(t>=TIME.walkToStation)enter('prepareAction');break;
      case 'prepareAction':if(t>=TIME.prepareAction)enter('performAction');break;
      case 'performAction':
        if(t>=(DURATION[s.event.type]||2.5))enter('holdAction');
        break;
      case 'holdAction':
        // Never trap the actor because the voice engine or network failed.
        if(t>0.55 && (!s.voiceStarted || s.voiceDone || t>9))enter('returnAisle');
        break;
      case 'returnAisle':if(t>=TIME.returnAisle)enter('returnSeat');break;
      case 'returnSeat':if(t>=TIME.returnSeat)complete();break;
    }
    return snapshot();
  }
  function snapshot(){
    if(!active)return null;
    const s=active,{event,home,station}=s;
    const t=s.stageTime;
    const aisle={x:540,y:home.y};
    let x=home.x,y=home.y,pose='stand',bow=0,bowCount=0,actionProgress=0;
    switch(s.stage){
      case 'leaveSeat':
        x=mix(home.x,aisle.x,ease(t/TIME.leaveSeat));pose='walk';break;
      case 'walkToStation':
        x=mix(aisle.x,station.x,ease(t/TIME.walkToStation));
        y=mix(aisle.y,station.y,ease(t/TIME.walkToStation));pose='walk';break;
      case 'prepareAction':
        x=station.x;y=station.y;pose='joinHands';break;
      case 'performAction':{
        x=station.x;y=station.y;
        const duration=DURATION[event.type]||2.5;
        actionProgress=clip(t/duration);
        if(event.type==='bow'){
          const index=Math.min(2,Math.floor(t/1.9));
          const cycle=clip((t-index*1.9)/1.9);
          // Each bow: hands joined -> kneel -> five-point prostration -> rise.
          bowCount=index+1;
          bow=cycle<.22?0:cycle<.48?ease((cycle-.22)/.26):cycle<.72?1:1-ease((cycle-.72)/.28);
          pose=bow>.75?'prostrate':bow>.25?'kneel':'joinHands';
        }else if(event.type==='burnIncense'){
          pose=actionProgress<.25?'joinHands':actionProgress<.75?'offerIncense':'joinHands';
        }else if(event.type==='sendPrayer'){
          pose=actionProgress<.65?'holdLantern':'releaseLantern';
        }else{
          pose='joinHands';
        }
        break;
      }
      case 'holdAction':
        x=station.x;y=station.y;pose='joinHands';actionProgress=1;break;
      case 'returnAisle':
        x=mix(station.x,aisle.x,ease(t/TIME.returnAisle));
        y=mix(station.y,aisle.y,ease(t/TIME.returnAisle));pose='walk';break;
      case 'returnSeat':
        x=mix(aisle.x,home.x,ease(t/TIME.returnSeat));y=home.y;pose='walk';break;
      case 'simple':
        pose='stand';break;
    }
    return {event,stage:s.stage,x,y,pose,bow,bowCount,actionProgress,
      moving:pose==='walk',canPlayVoice:['prepareAction','performAction','holdAction'].includes(s.stage),
      elapsed:s.elapsed,stageTime:s.stageTime,station:{...station}};
  }
  function stats(){return {active:active?.event.id||null,queued:pending.length,completed,dropped};}
  function reset(){pending=[];active=null;ids.clear();}
  return {enqueue,advance,snapshot,stats,speechStart,speechEnd,reset};
}
