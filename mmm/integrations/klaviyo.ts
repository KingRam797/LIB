/**
 * Mmm! — Klaviyo integration. PHASE 2/3 — typed stub.
 *
 * Phase 2: sync quiz answers → profile properties (powers segmentation and the
 * quiz-triggered flow that "reads like a conversation the shopper already started").
 * Phase 3: event tracking (quiz_completed, subscribed, skipped, churned) + flow specs.
 *
 * Shapes committed now so the quiz can be built against a stable seam.
 */

import type { GoalSegment } from './products.js';

/** Quiz answers as Klaviyo profile properties. Preferences and goals only — never anything that reads as a medical record (§5 data model rule). */
export interface MmmProfileProperties {
  mmm_primary_goal: GoalSegment;
  mmm_secondary_goal?: GoalSegment;
  mmm_diet: 'omnivore' | 'vegetarian' | 'vegan';
  mmm_sun_exposure: 'outdoor' | 'mixed' | 'indoor';
  mmm_age_band: string;
  mmm_biological_sex: 'female' | 'male' | 'prefer_not_to_say';
  /** True routes lifecycle copy to the gentler, provider-first variants. Stored as a flag only. */
  mmm_provider_first: boolean;
  mmm_archetype_id?: string;
  mmm_quiz_version: 'set-6' | 'set-10';
}

export type MmmEvent = 'quiz_completed' | 'subscribed' | 'skipped' | 'churned';

export interface KlaviyoClientConfig {
  apiKey: string; // KLAVIYO_PRIVATE_KEY
}

/** Read config from the environment (see integrations/env.ts + .env.example). */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): KlaviyoClientConfig {
  const apiKey = env.KLAVIYO_PRIVATE_KEY;
  if (!apiKey) {
    throw new Error('Missing KLAVIYO_PRIVATE_KEY — see .env.example at the repo root.');
  }
  return { apiKey };
}

export class KlaviyoClient {
  constructor(private readonly config: KlaviyoClientConfig) {
    void this.config;
  }

  async upsertProfile(_email: string, _properties: MmmProfileProperties): Promise<never> {
    throw new Error('Phase 2: implement with quiz persistence.');
  }

  async track(_event: MmmEvent, _email: string, _payload?: Record<string, unknown>): Promise<never> {
    throw new Error('Phase 3: implement with lifecycle flows.');
  }
}
