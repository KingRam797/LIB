import { describe, expect, it } from 'vitest';
import { GOAL_ADDONS, PRODUCTS, SKU_CODES, isSkuCode } from './products.js';

// Words that turn a supplement line into a disease claim (§6 / research §3).
// The full-library no-claims test (Phase 2, library.test.ts) extends this list;
// this guards the product truth we ship in Phase 1.
const PROHIBITED_CLAIM_PATTERNS = [
  /\btreats?\b/i,
  /\bcures?\b/i,
  /\bprevents?\b/i,
  /\brelieves?\b/i,
  /\bheals?\b/i,
  /\banti-inflammatory\b/i,
  /\banxiety\b/i,
  /\bdepression\b/i,
  /\binsomnia\b/i,
  /\barthritis\b/i,
  /\bdisease\b/i,
  /\bADHD\b/,
  /\bdementia\b/i,
];

describe('product truth', () => {
  it('carries exactly the four SKUs from the build plan', () => {
    expect(SKU_CODES).toEqual(['MMM', 'OOO', 'AAH', 'TASTY']);
    expect(Object.keys(PRODUCTS).sort()).toEqual([...SKU_CODES].sort());
  });

  it('keys every product record by its own SKU', () => {
    for (const sku of SKU_CODES) {
      expect(PRODUCTS[sku].sku).toBe(sku);
    }
  });

  it('gives every SKU a unique Shopify handle', () => {
    const handles = Object.values(PRODUCTS).map((p) => p.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it('never carries a dose number — doses live in engine/dosing.ts only', () => {
    for (const product of Object.values(PRODUCTS)) {
      expect(product.roleLine).not.toMatch(/\d+\s*(mg|mcg|iu|g)\b/i);
    }
  });

  it('keeps every role line structure/function-safe (no disease claims)', () => {
    for (const product of Object.values(PRODUCTS)) {
      for (const pattern of PROHIBITED_CLAIM_PATTERNS) {
        expect(product.roleLine, `${product.sku}: "${product.roleLine}" matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('maps every goal segment to add-ons per §5 (MMM is always the base, never an add-on)', () => {
    expect(GOAL_ADDONS.stress).toEqual(['AAH']);
    expect(GOAL_ADDONS.sleep).toEqual(['AAH']);
    expect(GOAL_ADDONS.focus).toEqual(['OOO']);
    expect(GOAL_ADDONS.joints).toEqual(['TASTY']);
    for (const addons of Object.values(GOAL_ADDONS)) {
      expect(addons).not.toContain('MMM');
    }
  });

  it('narrows SKU strings safely', () => {
    expect(isSkuCode('AAH')).toBe(true);
    expect(isSkuCode('XXX')).toBe(false);
  });
});
