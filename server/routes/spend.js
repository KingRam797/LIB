import { Router } from 'express';
import { all, run } from '../db/index.js';
const r = Router();
export const DIVISIONS = ['Properties','Productions','Producers','Professionals','Projects','Products'];
r.get('/', async (_q, res) => {
  const rows = await all('SELECT * FROM transactions ORDER BY occurred_on DESC');
  const routing = DIVISIONS.map(d => ({
    division: d,
    expenseCents: rows.filter(x=>x.division===d&&x.direction==='expense').reduce((s,x)=>s+x.amount_cents,0),
    incomeCents: rows.filter(x=>x.division===d&&x.direction==='income').reduce((s,x)=>s+x.amount_cents,0)
  }));
  res.json({ transactions: rows, routing, divisions: DIVISIONS });
});
r.post('/', async (req, res) => {
  await run('INSERT INTO transactions (occurred_on,amount_cents,direction,division,memo) VALUES (?,?,?,?,?)',
    [req.body.occurred_on, req.body.amount_cents, req.body.direction, req.body.division, req.body.memo||null]);
  res.json({ ok: true });
});
export default r;
