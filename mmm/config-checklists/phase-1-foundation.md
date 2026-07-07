# Phase 1 [CONFIG] — Foundation checklist for King

Claw built the [CODE] lane; these are the dashboard clicks only you can make.
Work top to bottom — later steps depend on earlier ones. When all boxes are
checked, the Phase 1 Acceptance block should pass and Claw can start Phase 2.

> **Acceptance we're driving toward:** store loads at mmm.co, four SKUs purchasable
> one-time AND as a 30-day subscription, brand system applied, DSHEA disclaimer
> visible on every PDP.

---

## 1. Supliful — product selection + white label

- [ ] Create/confirm the Supliful account and connect billing.
- [ ] Select the four base products:

  | Our SKU | Product to select | Label name | Role line for the label |
  |---|---|---|---|
  | MMM | Daily multivitamin (capsule) | **Mmm** | Everyone's floor. The daily foundation, right-dosed. |
  | OOO | Omega-3 (fish oil; note the algae option for a vegan variant later) | **Ooo** | Supports heart, brain, and mood — the long game. |
  | AAH | Ashwagandha (root extract, KSM-66 if offered) | **Aah** | Helps maintain a sense of calm and supports the body's response to everyday stress. |
  | TASTY | Turmeric (with black pepper / piperine — buyers are rightly skeptical of curcumin without it) | **Tasty** | Supports joint comfort, mobility, and a healthy inflammatory response. |

- [ ] **Record the actual actives + per-serving amounts from each Supliful label** and paste
  them back to Claw (issue or commit comment). ⚠️ The Phase 2 dosing table is built from
  these confirmed values — Claw will not assume a dose.
- [ ] **Record per-unit COGS + shipping** for each SKU and paste back. Margin discipline
  (build principle #3) needs real numbers before the offer or any price is final.
- [ ] Apply label designs: palette sunrise orange `#F4772E` / green `#3E9B6E` / violet
  `#9C8CD9` / warm white `#FDF8F1`; Fraunces for the product name, Hanken Grotesk for
  everything else. Confirm Supliful's compliance review passes.
- [ ] Confirm the DSHEA disclaimer prints on every label (Supliful default, but verify).

## 2. Shopify — store + products

- [ ] Connect the Supliful app to the Shopify store; import the four products.
- [ ] Set product handles to exactly: `mmm-multivitamin`, `ooo-omega-3`,
  `aah-ashwagandha`, `tasty-turmeric` (the code's typed schema and the Phase 2 quiz
  depend on these — `integrations/products.ts`).
- [ ] Set variant SKUs to exactly: `MMM`, `OOO`, `AAH`, `TASTY` (drives per-SKU brand
  accents on product cards).
- [ ] Add a `mmm.role_line` product metafield (type: single-line text) on each product,
  using the role lines from the table above.
- [ ] **Pricing — decision needed from you.** ⚠️ Claw will not assume a price (plan §0).
  Context from research: the direct peer set (quiz-based DTC) sells in the **$30–60/mo**
  band; subscribe discount best practice is **10–20%, not 30–40%** (deep discounts
  attract subscribers who never intended to stay). Set prices only after COGS from
  step 1 confirms margin-positive unit economics.
- [ ] Theme: fork Dawn, apply the overlay per `theme/README.md` (Claw can pair on this —
  the copy-over is mechanical), confirm the disclaimer renders on all four PDPs.
- [ ] Create a Storefront API access token (Settings → Apps → Develop apps →
  Storefront API, read products + write cart scopes) and hand Claw:
  `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`.
- [ ] Point **mmm.co** at the store; publish.

## 3. ReCharge — subscriptions

- [ ] Install ReCharge from the Shopify app store.
- [ ] Create a subscription selling plan on all four products: **30-day cadence default**,
  subscribe-and-save discount per the pricing decision above.
- [ ] Confirm the PDP purchase toggle shows Subscribe as the featured default (the
  `mmm-subscription-toggle` snippet handles this once selling plans exist).
- [ ] Leave the "Grab a round, keep one around" offer OFF for now — it's configured in
  Phase 3 once margin numbers from step 1 are in.

## 4. Fulfillment posture (resolved decision — just confirming)

- [ ] Supliful POD, zero inventory, through launch. No ShipBob action now.
- [ ] Note the trigger: **100 bottles/month** → convene on custom-label/custom-formula
  pivot (ShipBob only if that pivot holds inventory).

---

## Paste-back to Claw when done

1. Confirmed actives + per-serving amounts per SKU (from Supliful labels).
2. Per-unit COGS + shipping per SKU.
3. Chosen retail + subscription prices.
4. `SHOPIFY_STORE_DOMAIN` + Storefront token (via env/secret, not committed).
5. Screenshot or link of one PDP showing the disclaimer, for the acceptance record.
