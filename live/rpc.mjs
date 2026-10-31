// Loopback-only, bearer-token protected JSON-RPC 2.0 HTTP gateway.
// Never expose this server to the internet without an external auth proxy.
import { timingSafeEqual } from 'node:crypto';

const json = (res, status, value) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  });
  res.end(JSON.stringify(value));
};
const error = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
export function verifyBearer(header, secret) {
  if (!secret || secret.length < 24) return false;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
export function createRpcHandler({ engine, token, allowOrigin, onState } = {}) {
  const hits = new Map();
  return async (req, res) => {
    if (req.method !== 'POST') return json(res, 405, error(null, -32600, 'POST required'));
    if (!token || token.length < 24) return json(res, 503, error(null, -32003, 'RPC disabled; set TEMPLE_RPC_TOKEN (24+ chars)'));
    if (req.headers.origin && !allowOrigin(req.headers.origin)) return json(res, 403, error(null, -32003, 'Origin rejected'));
    if (!verifyBearer(req.headers.authorization, token)) return json(res, 401, error(null, -32001, 'Unauthorized'));
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, error(null, -32600, 'JSON content type required'));
    const addr = req.socket?.remoteAddress || 'local';
    const ts = Date.now();
    const current = (hits.get(addr) || []).filter(t => ts - t < 60_000);
    if (current.length >= 60) return json(res, 429, error(null, -32029, 'Rate limit'));
    current.push(ts); hits.set(addr, current);
    if (hits.size > 100) hits.delete(hits.keys().next().value);
    let body = '';
    try {
      for await (const part of req) {
        body += part.toString('utf8');
        if (Buffer.byteLength(body, 'utf8') > 16_384) return json(res, 413, error(null, -32600, 'Body too large'));
      }
      const m = JSON.parse(body);
      if (!m || Array.isArray(m) || m.jsonrpc !== '2.0' || typeof m.method !== 'string'
        || !Object.hasOwn(m, 'id') || !['string','number'].includes(typeof m.id)) {
        return json(res, 400, error(null, -32600, 'Invalid JSON-RPC request'));
      }
      if (!m.params) m.params = {};
      if (Array.isArray(m.params) || typeof m.params !== 'object') return json(res, 400, error(m.id, -32602, 'Invalid params'));
      if (m.method === 'temple.getState') return json(res, 200, { jsonrpc: '2.0', id: m.id, result: engine.getState() });
      const result = engine.perform(m.method, m.params, { speak: m.params.readTts !== false });
      onState?.(result.state);
      return json(res, 200, { jsonrpc: '2.0', id: m.id, result });
    } catch (err) {
      const code = err instanceof SyntaxError ? -32700 : /Unknown ritual method/.test(err.message) ? -32601 : -32602;
      return json(res, 400, error(null, code, code === -32700 ? 'Parse error' : code === -32601 ? 'Method not found' : 'Invalid request'));
    }
  };
}
