import { Router } from 'express';
import { all, run } from '../db/index.js';
const r = Router();
r.get('/', async (_q, res) => {
  const rows = await all('SELECT * FROM mrr_entries ORDER BY as_of');
  const latest = rows[rows.length-1]?.mrr_cents || 0;
  res.json({ entries: rows, latestCents: latest, floorCents: 3500000, ceilCents: 5250000,
    label: 'Voice architecture MRR goal: $35,000–$52,500/mo.' });
});
r.post('/', async (req,res)=>{ await run('INSERT INTO mrr_entries (as_of,mrr_cents,note) VALUES (?,?,?)',
  [req.body.as_of, req.body.mrr_cents, req.body.note||null]); res.json({ok:true}); });
export default r;
