// Original 2.5D ritual choreography for Len Chua Online.
// Pure timeline/queue logic: runs in browsers and is unit-tested in Node.
const MOVE_TO_AISLE = 1.0;
const MOVE_TO_ALTAR = 2.4;
const MOVE_BACK_AISLE = 2.4;
const MOVE_BACK_SEAT = 1.0;
const ALTAR = Object.freeze({ x: 540, y: 1175 });
const CLAMP = (n, low, high) => Math.max(low, Math.min(high, n));
const LERP = (a, b, p) => a + (b - a) * CLAMP(p, 0, 1);
const EASE = p => { const x = CLAMP(p, 0, 1); return x * x * (3 - 2 * x); };
const MAX_PENDING = 12;
const MAX_SPEECH_WAIT = 12; // seconds after arriving at altar

export function createRitualDirector({ maxQueue = MAX_PENDING, onStart = () => {}, onFinish = () => {} } = {}) {
  let pending = [], active = null, dropped = 0, completed = 0;
  const ids = new Set();

  const isCeremony = event => !['ringBell', 'strikeWoodenFish'].includes(event.type);
  function enqueue(event) {
    if (!event || typeof event.id !== 'string' || !event.type || ids.has(event.id)) return false;
    if (pending.length >= maxQueue) { dropped++; return false; }
    ids.add(event.id);
    pending.push(event);
    if (!active) activate();
    return true;
  }
  function activate() {
    if (active || !pending.length) return;
    const event = pending.shift();
    const start = onStart(event) || {};
    const home = {
      x: CLAMP(Number(start.x) || 540, 50, 1030),
      y: CLAMP(Number(start.y) || 1850, 1160, 2050)
    };
    active = {
      event, home, elapsed: 0,
      stage: isCeremony(event) ? 'toAisle' : 'simple',
      stageTime: 0, voiceStarted: false, voiceDone: false
    };
  }
  function next() {
    if (!active) return;
    const finished = active.event;
    ids.delete(finished.id);
    completed++;
    active = null;
    onFinish(finished);
    activate();
  }
  function speechStart(id) {
    if (!active || active.event.id !== id) return false;
    active.voiceStarted = true;
    return true;
  }
  function speechEnd(id) {
    if (!active || active.event.id !== id) return false;
    active.voiceDone = true;
    return true;
  }
  function advance(dt) {
    if (!active) activate();
    if (!active) return null;
    const s = active;
    const step = CLAMP(Number(dt) || 0, 0, 0.1);
    s.elapsed += step;
    s.stageTime += step;
    const move = stage => { s.stage = stage; s.stageTime = 0; };
    switch (s.stage) {
      case 'simple':
        if (s.stageTime >= 1.7) next();
        break;
      case 'toAisle':
        if (s.stageTime >= MOVE_TO_AISLE) move('toAltar');
        break;
      case 'toAltar':
        if (s.stageTime >= MOVE_TO_ALTAR) move('waiting');
        break;
      case 'waiting':
        if (!s.event.speechExpected || s.voiceStarted || s.stageTime >= MAX_SPEECH_WAIT) move('bowing');
        break;
      case 'bowing': {
        const cycles = s.event.type === 'bow' ? 3 : 1;
        const motionDone = s.stageTime >= cycles * 1.4;
        const narrationDone = !s.event.speechExpected || !s.voiceStarted || s.voiceDone || s.stageTime > 25;
        if (motionDone && narrationDone) move('fromAltar');
        break;
      }
      case 'fromAltar':
        if (s.stageTime >= MOVE_BACK_AISLE) move('toSeat');
        break;
      case 'toSeat':
        if (s.stageTime >= MOVE_BACK_SEAT) next();
        break;
    }
    return snapshot();
  }
  function snapshot() {
    if (!active) return null;
    const s = active, t = s.stageTime, home = s.home;
    const aisle = { x: ALTAR.x, y: home.y };
    let x = home.x, y = home.y, bow = 0;
    switch (s.stage) {
      case 'toAisle': x = LERP(home.x, aisle.x, EASE(t / MOVE_TO_AISLE)); break;
      case 'toAltar': x = aisle.x; y = LERP(aisle.y, ALTAR.y, EASE(t / MOVE_TO_ALTAR)); break;
      case 'waiting': case 'bowing':
        x = ALTAR.x; y = ALTAR.y;
        if (s.stage === 'bowing') {
          const cycles = s.event.type === 'bow' ? 3 : 1;
          const fraction = Math.min(t / 1.4, cycles);
          bow = t >= cycles * 1.4 ? 0 : Math.pow(Math.sin(Math.PI * (fraction % 1)), 2);
        }
        break;
      case 'fromAltar': x = ALTAR.x; y = LERP(ALTAR.y, aisle.y, EASE(t / MOVE_BACK_AISLE)); break;
      case 'toSeat': x = LERP(aisle.x, home.x, EASE(t / MOVE_BACK_SEAT)); y = home.y; break;
    }
    return { event: s.event, stage: s.stage, x, y, bow, moving: ['toAisle','toAltar','fromAltar','toSeat'].includes(s.stage),
      speechWaiting: s.stage === 'waiting' && s.event.speechExpected && !s.voiceStarted };
  }
  function stats() { return { queued: pending.length, active: active?.event.id ?? null, dropped, completed }; }
  function reset() { pending = []; ids.clear(); active = null; }
  return { enqueue, advance, snapshot, speechStart, speechEnd, stats, reset };
}
