/**
 * Mmm! — central environment configuration.
 *
 * One place that knows every key the project consumes, where they come from,
 * and which are required per phase. Server-side only (uses node:fs) — never
 * import from theme/browser code.
 *
 * Sources, in precedence order:
 *   1. Real environment variables (Vercel / CI / shell) — always win.
 *   2. `.env.local` (then `.env`) found by walking up from cwd to the repo
 *      root — developer convenience only. See `.env.example` at the repo root.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Every env key the project reads, with phase + exposure notes. */
export const ENV_KEYS = {
  SHOPIFY_STORE_DOMAIN: { phase: 1, required: true, public: true },
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: { phase: 1, required: true, public: true },
  KLAVIYO_PRIVATE_KEY: { phase: 2, required: false, public: false },
  RECHARGE_API_TOKEN: { phase: 2, required: false, public: false },
} as const;

export type EnvKey = keyof typeof ENV_KEYS;

/** Parse a dotenv-style file: KEY=VALUE lines, # comments, optional quotes. */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Find and load `.env.local` (preferred) or `.env`, walking up from
 * `startDir` toward the filesystem root — so it finds the file at the LIB
 * repo root whether you run from the root or from `mmm/`.
 *
 * Values never override real environment variables. Returns the path of the
 * file loaded, or null if none was found.
 */
export function loadEnvLocal(
  startDir: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    for (const name of ['.env.local', '.env']) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        const parsed = parseEnvFile(fs.readFileSync(candidate, 'utf8'));
        for (const [key, value] of Object.entries(parsed)) {
          if (env[key] === undefined) env[key] = value;
        }
        return candidate;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export class MissingEnvError extends Error {
  constructor(public readonly keys: EnvKey[]) {
    super(
      `Missing required environment keys: ${keys.join(', ')}. ` +
        'Copy .env.example to .env.local at the repo root and fill in values, ' +
        'or set them in Vercel → Settings → Environment Variables.',
    );
    this.name = 'MissingEnvError';
  }
}

export interface MmmEnv {
  shopify: { storeDomain: string; storefrontAccessToken: string };
  /** null until Phase 2 keys are provided. */
  klaviyo: { apiKey: string } | null;
  /** null until Phase 2 keys are provided. */
  recharge: { apiToken: string } | null;
}

/**
 * Load `.env.local` if present, then return the full typed config.
 * Throws MissingEnvError if any Phase 1 (required) key is absent.
 */
export function mmmEnv(env: NodeJS.ProcessEnv = process.env): MmmEnv {
  if (env === process.env) loadEnvLocal();

  const missing = (Object.keys(ENV_KEYS) as EnvKey[]).filter(
    (k) => ENV_KEYS[k].required && !env[k],
  );
  if (missing.length) throw new MissingEnvError(missing);

  return {
    shopify: {
      storeDomain: env.SHOPIFY_STORE_DOMAIN!,
      storefrontAccessToken: env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!,
    },
    klaviyo: env.KLAVIYO_PRIVATE_KEY ? { apiKey: env.KLAVIYO_PRIVATE_KEY } : null,
    recharge: env.RECHARGE_API_TOKEN ? { apiToken: env.RECHARGE_API_TOKEN } : null,
  };
}
