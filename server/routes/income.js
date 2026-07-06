import { Router } from 'express';
import { all, run } from '../db/index.js';
const r = Router();
r.get('/', async (_q, res) => {
  const rows = await all('SELECT * FROM income_events ORDER BY occurred_on');
  const asset = rows.filter(x => x.source_type === 'asset').reduce((s,x)=>s+x.amount_cents,0);
  const labor = rows.filter(x => x.source_type === 'labor').reduce((s,x)=>s+x.amount_cents,0);
  const total = asset + labor || 1;
  res.json({
    events: rows, assetCents: asset, laborCents: labor,
    assetPct: +(asset/total*100).toFixed(1), laborPct: +(labor/total*100).toFixed(1),
    note: 'Piketty: when income from what you OWN outgrows income from what you DO, capital compounds. Track the ratio; grow the asset share.'
  });
});
r.post('/', async (req, res) => {
  await run('INSERT INTO income_events (occurred_on,amount_cents,source_type,label) VALUES (?,?,?,?)',
    [req.body.occurred_on, req.body.amount_cents, req.body.source_type, req.body.label || null]);
  res.json({ ok: true });
});
export default r;
