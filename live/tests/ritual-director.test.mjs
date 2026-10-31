import test from 'node:test';
import assert from 'node:assert/strict';
import { createRitualDirector } from '../ritual-director.js';

const event = (id, type='bow', speechExpected=false) => ({ id, type, title:'Nghi lễ', user:'Diệu Hạnh', speechExpected });
function run(director, seconds, dt=.05) {
  let result;
  for(let i=0;i<Math.ceil(seconds/dt);i++) result=director.advance(dt);
  return result;
}
test('one worshipper travels aisle, reaches altar, completes three bows and returns to original seat', () => {
  const started=[], done=[];
  const d=createRitualDirector({onStart:e=>{started.push(e.id);return{x:240,y:1750};},onFinish:e=>done.push(e.id)});
  assert.equal(d.enqueue(event('a')),true);
  let seenAisle=false, seenAltar=false, bowPeaks=0, wasHigh=false;
  for(let i=0;i<400;i++){
    const s=d.advance(.05);
    if(!s)break;
    if(s.stage==='toAisle')seenAisle=true;
    if(s.stage==='bowing' && s.x===540 && s.y===1175)seenAltar=true;
    const high=s.bow>.8;
    if(high&&!wasHigh)bowPeaks++;
    wasHigh=high;
  }
  assert.equal(seenAisle,true);
  assert.equal(seenAltar,true);
  assert.equal(bowPeaks,3);
  assert.deepEqual(started,['a']);
  assert.deepEqual(done,['a']);
  assert.equal(d.stats().active,null);
});
test('wait for matching TTS playback start and completion; do not sync to another ritual',()=>{
  const d=createRitualDirector();
  d.enqueue(event('p','sendPrayer',true));
  run(d,4);
  assert.equal(d.snapshot()?.stage,'waiting');
  assert.equal(d.speechStart('wrong'),false);
  assert.equal(d.speechStart('p'),true);
  run(d,3);
  assert.equal(d.snapshot()?.stage,'bowing');
  d.speechEnd('p');
  run(d,7);
  assert.equal(d.stats().active,null);
});
test('fallback progress when audio is unavailable, bounded queue and de-duplication',()=>{
  const d=createRitualDirector({maxQueue:2});
  assert.equal(d.enqueue(event('1','bow',true)),true);
  assert.equal(d.enqueue(event('1','bow',true)),false);
  assert.equal(d.enqueue(event('2')),true);
  assert.equal(d.enqueue(event('3')),true);
  assert.equal(d.enqueue(event('4')),false);
  assert.equal(d.stats().dropped,1);
  run(d,70);
  assert.equal(d.stats().active,null);
  assert.equal(d.stats().queued,0);
  assert.equal(d.stats().completed,3);
});
test('bell and wooden fish bypass walking sequence',()=>{
  const d=createRitualDirector();
  d.enqueue(event('b','ringBell'));
  assert.equal(d.snapshot()?.stage,'simple');
  run(d,3);
  assert.equal(d.stats().completed,1);
});
