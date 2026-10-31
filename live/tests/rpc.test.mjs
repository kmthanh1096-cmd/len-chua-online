import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRpcHandler, verifyBearer } from '../rpc.mjs';
import { createRitualEngine } from '../rituals.mjs';

const token = 'local-dev-test-secret-longer-than-24';
async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('bearer token is required and compared exactly', () => {
  assert.equal(verifyBearer('Bearer ' + token, token), true);
  assert.equal(verifyBearer('Bearer bad', token), false);
  assert.equal(verifyBearer('', token), false);
});
test('RPC disabled by default and rejects unauthorized calls', async () => {
  const engine = createRitualEngine();
  await withServer(createRpcHandler({ engine, allowOrigin: () => true }), async url => {
    const resp = await fetch(url, { method: 'POST' });
    assert.equal(resp.status, 503);
  });
  await withServer(createRpcHandler({ engine, token, allowOrigin: () => false }), async url => {
    const denied = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: '{}' });
    assert.equal(denied.status, 401);
    const forbidden = await fetch(url, { method:'POST', headers:{origin:'https://evil.example', authorization:'Bearer '+token, 'content-type':'application/json'}, body:'{}' });
    assert.equal(forbidden.status, 403);
  });
});
test('JSON-RPC processes allowed methods; no unknown actions', async () => {
  const engine = createRitualEngine();
  await withServer(createRpcHandler({ engine, token, allowOrigin: () => true }), async url => {
    const request = async method => {
      const response = await fetch(url, { method:'POST', headers:{authorization:'Bearer '+token, 'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:1,method,params:{user:'Lan'}})});
      return { status:response.status, data:await response.json() };
    };
    const ok = await request('temple.bow');
    assert.equal(ok.status, 200);
    assert.equal(ok.data.result.state.totals.bows, 3);
    const state = await request('temple.getState');
    assert.equal(state.data.result.totals.bows, 3);
    const blocked = await request('temple.connectTikTok');
    assert.equal(blocked.status, 400);
    assert.equal(blocked.data.error.code, -32601);
  });
});
