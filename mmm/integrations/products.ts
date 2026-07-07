/**
 * Mmm! — typed product schema for the four SKUs.
 *
 * This is the code-side product truth. Prices and label actives are set by
 * King in Shopify/Supliful ([CONFIG]); this module deliberately carries no
 * prices and no doses — doses live in engine/dosing.ts (Phase 2) and are
 * always deterministic.
 */

export const SKU_CODES = ['MMM', 'OOO', 'AAH', 'TASTY'] as const;
export type SkuCode = (typeof SKU_CODES)[number];

export type GoalSegment =
  | 'energy'
  | 'stress'
  | 'sleep'
  | 'focus'
  | 'joints'
  | 'general';

export interface MmmProduct {
  sku: SkuCode;
  name: string;
  actives: string;
  /** One warm line, structure/function-safe. Mirrors the `mmm.role_line` Shopify metafield. */
  roleLine: string;
  /** Which quiz goal segments this SKU serves (drives Phase 2 rules mapping). */
  goals: GoalSegment[];
  /** Shopify handle — must match what King publishes ([CONFIG] checklist). */
  handle: string;
  /** Brand accent token from theme/config/tokens.json `sku-accent`. */
  accentToken: string;
}

export const PRODUCTS: Record<SkuCode, MmmProduct> = {
  MMM: {
    sku: 'MMM',
    name: 'Mmm',
    actives: 'Multivitamin base',
    roleLine: "Everyone's floor. The daily foundation, right-dosed.",
    goals: ['energy', 'general'],
    handle: 'mmm-multivitamin',
    accentToken: 'sunrise-orange',
  },
  OOO: {
    sku: 'OOO',
    name: 'Ooo',
    actives: 'Omega-3',
    roleLine: 'Supports heart, brain, and mood — the long game.',
    goals: ['focus', 'general'],
    handle: 'ooo-omega-3',
    accentToken: 'fresh-green',
  },
  AAH: {
    sku: 'AAH',
    name: 'Aah',
    actives: 'Ashwagandha',
    roleLine: "Helps maintain a sense of calm and supports the body's response to everyday stress.",
    goals: ['stress', 'sleep'],
    handle: 'aah-ashwagandha',
    accentToken: 'soft-violet',
  },
  TASTY: {
    sku: 'TASTY',
    name: 'Tasty',
    actives: 'Turmeric',
    roleLine: 'Supports joint comfort, mobility, and a healthy inflammatory response.',
    goals: ['joints'],
    handle: 'tasty-turmeric',
    accentToken: 'sunrise-orange-deep',
  },
};

/** Goal → add-on SKU mapping (§5): MMM is always the base; these stack on top. */
export const GOAL_ADDONS: Record<GoalSegment, SkuCode[]> = {
  energy: [], // the MMM base carries energy; no add-on by default
  stress: ['AAH'],
  sleep: ['AAH'],
  focus: ['OOO'],
  joints: ['TASTY'],
  general: [],
};

export function isSkuCode(value: string): value is SkuCode {
  return (SKU_CODES as readonly string[]).includes(value);
}
