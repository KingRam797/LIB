import { Router } from 'express';
import { get, run } from '../db/index.js';
import { ah, bad, isIntCents } from '../lib/http.js';
const r = Router();
// CoinGecko Demo API: base api.coingecko.com/api/v3; /simple/price?ids=ripple&vs_currencies=usd
// Free Demo plan: stable rate limit of 100 calls/min, monthly cap of 10,000 calls. Key optional.
r.get('/', ah(async (_q, res) => {
  const pos = await get('SELECT * FROM xrp_positions ORDER BY id DESC LIMIT 1');
  res.json({ position: pos || null });
}));
r.post('/', ah(async (req, res) => {
  const { units, cost_basis_cents } = req.body || {};
  if (!Number.isFinite(units) || units < 0) return bad(res, 'units must be a non-negative number');
  if (cost_basis_cents != null && !isIntCents(cost_basis_cents)) return bad(res, 'cost_basis_cents must be an integer');
  await run('INSERT INTO xrp_positions (units,cost_basis_cents,updated_at) VALUES (?,?,?)',
    [units, cost_basis_cents ?? null, new Date().toISOString().slice(0,10)]);
  res.json({ ok: true });
}));
r.get('/price', ah(async (_q, res) => {
  try {
    const key = process.env.COINGECKO_DEMO_KEY;
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd';
    // Demo key travels in a header so it never lands in proxy/nginx access logs.
    const data = await (await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: key ? { 'x-cg-demo-api-key': key } : {}
    })).json();
    res.json({ usd: data?.ripple?.usd ?? null });
  } catch { res.status(502).json({ usd: null, error: 'price fetch failed; enter manually' }); }
}));
export default r;
