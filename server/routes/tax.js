import { Router } from 'express';
import { run } from '../db/index.js';
import { estimate } from '../lib/tax.js';
import { ah, bad, isIntCents } from '../lib/http.js';
const r = Router();
r.post('/estimate', ah(async (req, res) => {
  const { netSelfEmploymentCents, priorYearTaxCents = 0, priorYearAgiCents = 0 } = req.body || {};
  if (!isIntCents(netSelfEmploymentCents) || netSelfEmploymentCents < 0)
    return bad(res, 'netSelfEmploymentCents must be a non-negative integer');
  if (!isIntCents(priorYearTaxCents) || priorYearTaxCents < 0)
    return bad(res, 'priorYearTaxCents must be a non-negative integer');
  if (!isIntCents(priorYearAgiCents) || priorYearAgiCents < 0)
    return bad(res, 'priorYearAgiCents must be a non-negative integer');
  const out = estimate({ netSelfEmploymentCents, priorYearTaxCents, priorYearAgiCents });
  await run(`INSERT INTO tax_estimates (created_at,tax_year,net_se_income_cents,se_tax_cents,federal_income_cents,michigan_cents,quarterly_cents)
             VALUES (?,?,?,?,?,?,?)`,
    [new Date().toISOString().slice(0,10), 2026, netSelfEmploymentCents,
     out.seTaxCents, out.federalIncomeCents, out.michiganCents, out.quarterlyCents]);
  res.json(out);
}));
export default r;
