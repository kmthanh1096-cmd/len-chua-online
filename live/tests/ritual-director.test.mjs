import test from 'node:test';
import assert from 'node:assert/strict';
import {createRitualDirector,RITUAL_STATIONS} from '../ritual-director.js';
const evt=(id,type='bow',speechExpected=false)=>({id,type,user:'Thiện Tâm',title:'Lễ Phật',speechExpected});
function run(d,seconds,cb=()=>{}){for(let i=0;i<seconds*20;i++){const s=d.advance(.05);if(s)cb(s);}}
test('two knees first, both hands raised, forehead lowered for three distinct prostrations',()=>{
  const phases=[],d=createRitualDirector({onStart:()=>({x:250,y:1780}),onPhase:(_,p)=>phases.push(p)});
  d.enqueue(evt('a'));let peakCount=0,high=false,atStation=false,walkingIncense=false;
  run(d,40,s=>{
    if(s.stage==='kneelDown'){assert.equal(s.pose,'kneel');assert.ok(s.kneel>=0&&s.kneel<=1);}
    if(s.stage==='raiseHands'){assert.equal(s.kneel,1);assert.equal(s.pose,'raiseHands');}
    if(s.stage==='holdBow'){assert.equal(s.bow,1);assert.equal(s.pose,'prostrate');}
    const peak=s.stage==='holdBow';
    if(peak&&!high)peakCount++; high=peak;
    if(s.stage==='prostrate'&&s.x===RITUAL_STATIONS.bow.x)atStation=true;
  });
  assert.equal(peakCount,3);
  assert.ok(atStation);
  assert.deepEqual(phases.filter(p=>p==='kneelDown'),['kneelDown','kneelDown','kneelDown']);
  assert.equal(d.stats().active,null);
  assert.equal(d.stats().completed,1);
});
test('one incense stick is carried while walking then inserted exactly once',()=>{
  const phases=[],d=createRitualDirector({onPhase:(event,p)=>phases.push(p)});
  d.enqueue(evt('inc','burnIncense'));let carrying=false,placing=false;
  run(d,25,s=>{
    if(s.stage==='walkToStation'){carrying=carrying||s.pose==='walkIncense';}
    if(s.stage==='placeIncense'){placing=true;assert.equal(s.x,540);assert.equal(s.y,1168);}
  });
  assert.equal(carrying,true);assert.equal(placing,true);
  assert.equal(phases.filter(p=>p==='placeIncense').length,1);
  assert.ok(phases.indexOf('placeIncense')>phases.indexOf('raiseIncense'));
  assert.ok(phases.indexOf('placeIncense')<phases.indexOf('joinHands'));
  assert.equal(d.stats().active,null);
});
test('lantern retains its own ritual sequence and station',()=>{
  const d=createRitualDirector();d.enqueue(evt('l','sendPrayer'));
  let held=false,released=false;run(d,22,s=>{
    if(s.pose==='holdLantern')held=true;
    if(s.pose==='releaseLantern'){released=true;assert.equal(s.x,690);}
  });
  assert.equal(held,true);assert.equal(released,true);
});
test('TTS ids are matched and missing speech does not freeze the queue',()=>{
  const d=createRitualDirector();
  d.enqueue(evt('p','bow',true));
  assert.equal(d.speechStart('bad'),false);
  assert.equal(d.speechStart('p'),true);
  assert.equal(d.speechEnd('p'),true);
  run(d,40);assert.equal(d.stats().active,null);
  d.enqueue(evt('p2','burnIncense',true));run(d,40);
  assert.equal(d.stats().active,null);
});
test('bounded queue, de-dupe and reset',()=>{
  const d=createRitualDirector({maxQueue:2});
  assert.equal(d.enqueue(evt('a')),true);assert.equal(d.enqueue(evt('a')),false);
  assert.equal(d.enqueue(evt('b')),true);assert.equal(d.enqueue(evt('c')),true);
  assert.equal(d.enqueue(evt('d')),false);
  run(d,120);assert.equal(d.stats().completed,3);assert.equal(d.stats().dropped,1);
  d.reset();assert.equal(d.stats().queued,0);assert.equal(d.stats().active,null);
});
test('bell and wooden fish are instantaneous non-walking ceremonies',()=>{
  const d=createRitualDirector();
  d.enqueue(evt('bell','ringBell'));
  assert.equal(d.snapshot().stage,'simple');
  run(d,3);assert.equal(d.stats().completed,1);
});
