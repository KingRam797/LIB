/**
 * Mmm! — ReCharge integration. PHASE 2/3 — typed stub.
 *
 * Phase 2: bundle/box mapping so a recommended stack becomes ONE subscription
 * ([CONFIG] creates the bundle in ReCharge; this module maps stack → bundle).
 * Phase 3: skip/pause/cancel handling for the pre-charge reminder flow.
 *
 * Nothing here runs yet — the shapes are committed so Phase 2 code has a
 * stable seam to build against.
 */

import type { SkuCode } from './products.js';

export interface StackSubscription {
  skus: SkuCode[];
  /** 30-day default cadence (Phase 1 [CONFIG]); flexibility options land in Phase 3. */
  intervalDays: 30 | 45 | 60 | 90;
}

export interface RechargeClientConfig {
  apiToken: string; // RECHARGE_API_TOKEN
}

/** Read config from the environment (see integrations/env.ts + .env.example). */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): RechargeClientConfig {
  const apiToken = env.RECHARGE_API_TOKEN;
  if (!apiToken) {
    throw new Error('Missing RECHARGE_API_TOKEN — see .env.example at the repo root.');
  }
  return { apiToken };
}

export class RechargeClient {
  constructor(private readonly config: RechargeClientConfig) {
    void this.config;
  }

  /** Phase 2: resolve a recommended stack to the ReCharge bundle selling plan. */
  async bundleForStack(_stack: StackSubscription): Promise<never> {
    throw new Error('Phase 2: implement after King creates the ReCharge bundle mapping ([CONFIG]).');
  }
}
