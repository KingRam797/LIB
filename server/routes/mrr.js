import { Router } from 'express';
import { all, run } from '../db/index.js';
import { ah, bad, isIsoDate, isIntCents } from '../lib/http.js';
const r = Router();
r.get('/', ah(async (_q, res) => {
  const rows = await all('SELECT * FROM mrr_entries ORDER BY as_of');
  const latest = rows[rows.length-1]?.mrr_cents || 0;
  res.json({ entries: rows, latestCents: latest, floorCents: 3500000, ceilCents: 5250000,
    label: 'Voice architecture MRR goal: $35,000–$52,500/mo.' });
}));
r.post('/', ah(async (req, res) => {
  const { as_of, mrr_cents, note } = req.body || {};
  if (!isIsoDate(as_of)) return bad(res, 'as_of must be YYYY-MM-DD');
  if (!isIntCents(mrr_cents) || mrr_cents < 0) return bad(res, 'mrr_cents must be a non-negative integer');
  await run('INSERT INTO mrr_entries (as_of,mrr_cents,note) VALUES (?,?,?)', [as_of, mrr_cents, note||null]);
  res.json({ ok: true });
}));
export default r;
