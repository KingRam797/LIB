import { Router } from 'express';
import { all, get, run } from '../db/index.js';
const r = Router();
// CoinGecko Demo API: base api.coingecko.com/api/v3; /simple/price?ids=ripple&vs_currencies=usd
// Free Demo plan: stable rate limit of 100 calls/min, monthly cap of 10,000 calls. Key optional.
r.get('/', async (_q, res) => {
  const pos = await get('SELECT * FROM xrp_positions ORDER BY id DESC LIMIT 1');
  res.json({ position: pos || null });
});
r.post('/', async (req, res) => {
  await run('INSERT INTO xrp_positions (units,cost_basis_cents,updated_at) VALUES (?,?,?)',
    [req.body.units, req.body.cost_basis_cents || null, new Date().toISOString().slice(0,10)]);
  res.json({ ok: true });
});
r.get('/price', async (_q, res) => {
  try {
    const key = process.env.COINGECKO_DEMO_KEY;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd${key?`&x_cg_demo_api_key=${key}`:''}`;
    const data = await (await fetch(url)).json();
    res.json({ usd: data?.ripple?.usd ?? null });
  } catch { res.status(502).json({ usd: null, error: 'price fetch failed; enter manually' }); }
});
export default r;
