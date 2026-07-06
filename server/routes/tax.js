import { Router } from 'express';
import { run } from '../db/index.js';
import { estimate } from '../lib/tax.js';
const r = Router();
r.post('/estimate', async (req, res) => {
  const out = estimate({
    netSelfEmploymentCents: Number(req.body.netSelfEmploymentCents) || 0,
    priorYearTaxCents: Number(req.body.priorYearTaxCents) || 0,
    priorYearAgiCents: Number(req.body.priorYearAgiCents) || 0
  });
  await run(`INSERT INTO tax_estimates (created_at,tax_year,net_se_income_cents,se_tax_cents,federal_income_cents,michigan_cents,quarterly_cents)
             VALUES (?,?,?,?,?,?,?)`,
    [new Date().toISOString().slice(0,10), 2026, Number(req.body.netSelfEmploymentCents)||0,
     out.seTaxCents, out.federalIncomeCents, out.michiganCents, out.quarterlyCents]);
  res.json(out);
});
export default r;
