import test from 'node:test';
import assert from 'node:assert/strict';
import { createRitualDirector, RITUAL_STATIONS } from '../ritual-director.js';

const event=(id,type='bow',speechExpected=false)=>({id,type,title:'Nghi lễ',user:'Diệu Hạnh',speechExpected});
function step(d,seconds){let s;for(let i=0;i<seconds*20;i++)s=d.advance(.05);return s;}
test('three distinct full prostrations at altar followed by return to home',()=>{
  const done=[],stages=[];
  const d=createRitualDirector({onStart:()=>({x:240,y:1750}),onFinish:e=>done.push(e.id),onPhase:(_,stage)=>stages.push(stage)});
  d.enqueue(event('a'));
  let peaks=0,high=false,feetAtHome=false,altar=false,actorWentAway=false;
  for(let i=0;i<450;i++){
    const s=d.advance(.05);
    if(!s)break;
    if(s.pose==='walk'&&s.x>300)actorWentAway=true;
    if(s.stage==='performAction'){altar=altar||s.x===RITUAL_STATIONS.bow.x&&s.y===RITUAL_STATIONS.bow.y;}
    const peak=s.pose==='prostrate';
    if(peak&&!high)peaks++;
    high=peak;
    if(s.stage==='returnSeat'&&Math.abs(s.x-240)<10)feetAtHome=true;
  }
  assert.equal(altar,true);assert.equal(actorWentAway,true);assert.equal(peaks,3);
  assert.equal(feetAtHome,true);assert.deepEqual(done,['a']);
  assert.ok(stages.includes('prepareAction')&&stages.includes('returnAisle'));
  assert.equal(d.stats().active,null);
});
test('incense offering actually has an offer pose at incense station',()=>{
  const d=createRitualDirector({onStart:()=>({x:330,y:1700})});
  d.enqueue(event('inc','burnIncense'));
  let offered=false;
  for(let i=0;i<300;i++){
    const s=d.advance(.05);
    if(s?.pose==='offerIncense'){offered=true;assert.equal(s.x,540);assert.equal(s.y,1165);}
  }
  assert.equal(offered,true);
});
test('lantern held before release at its own station',()=>{
  const d=createRitualDirector();d.enqueue(event('lan','sendPrayer'));
  let held=false,released=false;
  for(let i=0;i<300;i++){
    const s=d.advance(.05);
    if(s?.pose==='holdLantern')held=true;
    if(s?.pose==='releaseLantern'){released=true;assert.equal(s.station.x,690);}
  }
  assert.equal(held,true);assert.equal(released,true);
});
test('TTS events tied to active ritual; failed voice must not trap queue',()=>{
  const d=createRitualDirector();d.enqueue(event('p','sendPrayer',true));
  step(d,4.5);
  assert.equal(d.speechStart('wrong'),false);
  assert.equal(d.speechStart('p'),true);
  assert.equal(d.speechEnd('p'),true);
  step(d,20);
  assert.equal(d.stats().active,null);
});
test('bounded queue and deduplication, fallback when voice never starts',()=>{
  const d=createRitualDirector({maxQueue:2});
  assert.equal(d.enqueue(event('1','bow',true)),true);
  assert.equal(d.enqueue(event('1')),false);
  assert.equal(d.enqueue(event('2')),true);
  assert.equal(d.enqueue(event('3')),true);
  assert.equal(d.enqueue(event('4')),false);
  step(d,85);
  assert.equal(d.stats().completed,3);
  assert.equal(d.stats().queued,0);
  assert.equal(d.stats().dropped,1);
});
test('bell and wooden fish skip movement choreography',()=>{
  const d=createRitualDirector();
  d.enqueue(event('b','ringBell'));
  assert.equal(d.snapshot().stage,'simple');
  step(d,3);assert.equal(d.stats().completed,1);
});
