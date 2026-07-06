import { Router } from 'express';
import { all, run } from '../db/index.js';
import { ah, bad, isIsoDate, isIntCents } from '../lib/http.js';
const r = Router();
export const DIVISIONS = ['Properties','Productions','Producers','Professionals','Projects','Products'];
r.get('/', ah(async (_q, res) => {
  const rows = await all('SELECT * FROM transactions ORDER BY occurred_on DESC');
  const routing = DIVISIONS.map(d => ({
    division: d,
    expenseCents: rows.filter(x=>x.division===d&&x.direction==='expense').reduce((s,x)=>s+x.amount_cents,0),
    incomeCents: rows.filter(x=>x.division===d&&x.direction==='income').reduce((s,x)=>s+x.amount_cents,0)
  }));
  res.json({ transactions: rows, routing, divisions: DIVISIONS });
}));
r.post('/', ah(async (req, res) => {
  const { occurred_on, amount_cents, direction, division, memo } = req.body || {};
  if (!isIsoDate(occurred_on)) return bad(res, 'occurred_on must be YYYY-MM-DD');
  if (!isIntCents(amount_cents) || amount_cents <= 0) return bad(res, 'amount_cents must be a positive integer');
  if (direction !== 'income' && direction !== 'expense') return bad(res, "direction must be 'income' or 'expense'");
  if (!DIVISIONS.includes(division)) return bad(res, `division must be one of: ${DIVISIONS.join(', ')}`);
  await run('INSERT INTO transactions (occurred_on,amount_cents,direction,division,memo) VALUES (?,?,?,?,?)',
    [occurred_on, amount_cents, direction, division, memo||null]);
  res.json({ ok: true });
}));
export default r;
