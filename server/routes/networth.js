import { Router } from 'express';
import { all, run } from '../db/index.js';
const r = Router();
r.get('/', async (_q, res) => {
  const rows = await all('SELECT * FROM net_worth_entries ORDER BY as_of');
  const target = Number(process.env.NET_WORTH_TARGET_CENTS) || 100000000;
  const birthYear = Number(process.env.USER_BIRTH_YEAR) || 1997;
  const retireAge = Number(process.env.RETIRE_AGE) || 55;
  const targetYear = birthYear + retireAge;
  // Trajectory line from latest entry to target at age 55.
  const latest = rows[rows.length - 1];
  res.json({ entries: rows, targetCents: target, targetYear, latest });
});
r.post('/', async (req, res) => {
  await run('INSERT INTO net_worth_entries (as_of,amount_cents,note) VALUES (?,?,?)',
    [req.body.as_of, req.body.amount_cents, req.body.note || null]);
  res.json({ ok: true });
});
export default r;
