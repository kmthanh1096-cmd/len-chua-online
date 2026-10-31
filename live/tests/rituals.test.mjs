import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseRitualComment, cleanText, createRitualEngine } from '../rituals.mjs';

test('Vietnamese and no-diacritic commands, without matching ordinary chat', () => {
  assert.equal(parseRitualComment('thắp hương cầu an'), 'temple.burnIncense');
  assert.equal(parseRitualComment('THAP HUONG'), 'temple.burnIncense');
  assert.equal(parseRitualComment('xin xăm'), 'temple.drawFortune');
  assert.equal(parseRitualComment('lạy Phật'), 'temple.bow');
  assert.equal(parseRitualComment('cầu cho cha mẹ bình an'), 'temple.sendPrayer');
  assert.equal(parseRitualComment('Nam mô A Di Đà Phật'), null);
  assert.equal(parseRitualComment('nam'), null);
});
test('limits names and wishes to visible plain text', () => {
  assert.equal(cleanText('<script>alert(1)</script>', 10).length <= 10, true);
  assert.equal(cleanText('Hi 😊 Nam mô'), 'Hi Nam mô');
});
test('events persist aggregate counts only; no usernames or prayers', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'temple-'));
  const filePath = path.join(dir, 'ritual-state.json');
  const events = [], speeches = [];
  let clock = 50000;
  const e = createRitualEngine({ filePath, emit: x => events.push(x), speak: x => speeches.push(x), now: () => clock });
  e.perform('temple.burnIncense', { user: 'Diệu Tâm', wish: 'Cầu cho mẹ', count: 999 });
  e.perform('temple.bow', { user: 'Diệu Tâm' });
  e.perform('temple.drawFortune', { user: 'Diệu Tâm' });
  const first = e.fromComment({ id: 'u1', user: 'Hiền', text: 'Thắp hương' });
  assert.ok(first);
  assert.equal(e.fromComment({ id: 'u1', user: 'Hiền', text: 'Thắp hương' }), null);
  clock += 6000;
  assert.ok(e.fromComment({ id: 'u1', user: 'Hiền', text: 'Thắp hương' }));
  assert.equal(e.getState().totals.incense, 9);
  assert.equal(e.getState().totals.bows, 3);
  assert.equal(events.length, 5);
  assert.ok(speeches.length >= 3);
  await e.flush();
  const raw = readFileSync(filePath, 'utf8');
  assert.equal(raw.includes('Diệu Tâm'), false);
  assert.equal(raw.includes('Cầu cho mẹ'), false);
  const loaded = createRitualEngine({ filePath });
  assert.deepEqual(loaded.getState(), e.getState());
  assert.throws(() => e.perform('temple.deleteEverything'), /Unknown ritual method/);
});
