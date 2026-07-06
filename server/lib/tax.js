// 2026 constants — research-verified.
// SE tax 15.3% (12.4% Social Security + 2.9% Medicare) on 92.35% of net earnings.
// Social Security wage base 2026 = $184,500 (SSA, announced Oct 24 2025, up from $176,100).
// Additional Medicare 0.9% over $200,000 (single). Half of SE tax deductible above the line.
// Michigan flat individual income tax 2026 = 4.25% (MI Treasury notice, Apr 15 2026).
// Federal safe harbor: 100% of prior-year tax, or 110% if prior-year AGI > $150,000; or 90% current year.
export const C = {
  SE_MULT: 0.9235,
  SS_RATE: 0.124, SS_BASE_CENTS: 18450000,
  MEDICARE_RATE: 0.029, ADDL_MEDICARE_RATE: 0.009, ADDL_MEDICARE_THRESHOLD_CENTS: 20000000,
  MI_RATE: 0.0425, MI_EXEMPTION_CENTS: 580000, // verify 2026 exemption vs MI Form 446 (2025 was $5,800)
  // Simplified 2026 single-filer federal brackets (taxable income, cents).
  FED_BRACKETS: [
    [0, 0.10], [1192500, 0.12], [4847500, 0.22], [10335000, 0.24],
    [19730000, 0.32], [25052500, 0.35], [62635000, 0.37]
  ],
  DISCLAIMER: 'This is an estimate and a planning tool, not tax advice. Confirm with a CPA before paying. Figures use 2026 constants; a multi-member LLC is taxed as a partnership and each member reports their distributive share.'
};

export function estimate({ netSelfEmploymentCents, priorYearTaxCents = 0, priorYearAgiCents = 0 }) {
  const seBase = Math.round(netSelfEmploymentCents * C.SE_MULT);
  const ss = Math.round(Math.min(seBase, C.SS_BASE_CENTS) * C.SS_RATE);
  let medicare = Math.round(seBase * C.MEDICARE_RATE);
  if (seBase > C.ADDL_MEDICARE_THRESHOLD_CENTS)
    medicare += Math.round((seBase - C.ADDL_MEDICARE_THRESHOLD_CENTS) * C.ADDL_MEDICARE_RATE);
  const seTax = ss + medicare;
  const seDeduction = Math.round(seTax / 2); // employer-equivalent half, above the line

  // Federal income tax on (net SE income - half SE tax). Simplified, no other deductions.
  let taxable = Math.max(0, netSelfEmploymentCents - seDeduction);
  let fed = 0;
  for (let i = 0; i < C.FED_BRACKETS.length; i++) {
    const [floor, rate] = C.FED_BRACKETS[i];
    const ceil = C.FED_BRACKETS[i + 1]?.[0] ?? Infinity;
    if (taxable > floor) fed += Math.round((Math.min(taxable, ceil) - floor) * rate);
  }
  const miTaxable = Math.max(0, netSelfEmploymentCents - C.MI_EXEMPTION_CENTS);
  const michigan = Math.round(miTaxable * C.MI_RATE);

  const totalAnnual = seTax + fed + michigan;
  // Safe harbor target (federal): lesser of 90% current or 100%/110% prior.
  const shPct = priorYearAgiCents > 15000000 ? 1.10 : 1.00;
  const safeHarborAnnual = priorYearTaxCents
    ? Math.min(Math.round(totalAnnual * 0.90), Math.round(priorYearTaxCents * shPct))
    : Math.round(totalAnnual * 0.90);

  return {
    seTaxCents: seTax, federalIncomeCents: fed, michiganCents: michigan,
    seDeductionCents: seDeduction, totalAnnualCents: totalAnnual,
    quarterlyCents: Math.round(totalAnnual / 4),
    safeHarborAnnualCents: safeHarborAnnual, safeHarborQuarterlyCents: Math.round(safeHarborAnnual / 4),
    dueDates: ['2026-04-15','2026-06-15','2026-09-15','2027-01-15'],
    disclaimer: C.DISCLAIMER
  };
}
