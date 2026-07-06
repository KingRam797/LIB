import { Router } from 'express';
import { all, run } from '../db/index.js';
import { ah, bad, isIsoDate, isIntCents } from '../lib/http.js';
const r = Router();
r.get('/', ah(async (_q, res) => {
  const rows = await all('SELECT * FROM income_events ORDER BY occurred_on');
  const asset = rows.filter(x => x.source_type === 'asset').reduce((s,x)=>s+x.amount_cents,0);
  const labor = rows.filter(x => x.source_type === 'labor').reduce((s,x)=>s+x.amount_cents,0);
  const total = asset + labor || 1;
  res.json({
    events: rows, assetCents: asset, laborCents: labor,
    assetPct: +(asset/total*100).toFixed(1), laborPct: +(labor/total*100).toFixed(1),
    note: 'Piketty: when income from what you OWN outgrows income from what you DO, capital compounds. Track the ratio; grow the asset share.'
  });
}));
r.post('/', ah(async (req, res) => {
  const { occurred_on, amount_cents, source_type, label } = req.body || {};
  if (!isIsoDate(occurred_on)) return bad(res, 'occurred_on must be YYYY-MM-DD');
  if (!isIntCents(amount_cents) || amount_cents <= 0) return bad(res, 'amount_cents must be a positive integer');
  if (source_type !== 'asset' && source_type !== 'labor') return bad(res, "source_type must be 'asset' or 'labor'");
  await run('INSERT INTO income_events (occurred_on,amount_cents,source_type,label) VALUES (?,?,?,?)',
    [occurred_on, amount_cents, source_type, label || null]);
  res.json({ ok: true });
}));
export default r;
