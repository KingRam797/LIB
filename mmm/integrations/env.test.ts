import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadEnvLocal, mmmEnv, MissingEnvError, parseEnvFile } from './env.js';

describe('parseEnvFile', () => {
  it('parses keys, ignores comments/blank lines, strips quotes and export', () => {
    const parsed = parseEnvFile(
      [
        '# comment',
        '',
        'PLAIN=value',
        'QUOTED="with spaces"',
        "SINGLE='single'",
        'export EXPORTED=yes',
        'EQUALS=a=b=c',
      ].join('\n'),
    );
    expect(parsed).toEqual({
      PLAIN: 'value',
      QUOTED: 'with spaces',
      SINGLE: 'single',
      EXPORTED: 'yes',
      EQUALS: 'a=b=c',
    });
  });
});

describe('loadEnvLocal', () => {
  it('finds .env.local walking up from a nested dir; real env wins', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-env-'));
    const nested = path.join(root, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
      path.join(root, '.env.local'),
      'SHOPIFY_STORE_DOMAIN=file.myshopify.com\nALREADY_SET=from-file\n',
    );
    const env: NodeJS.ProcessEnv = { ALREADY_SET: 'from-real-env' };
    const loaded = loadEnvLocal(nested, env);
    expect(loaded).toBe(path.join(root, '.env.local'));
    expect(env.SHOPIFY_STORE_DOMAIN).toBe('file.myshopify.com');
    expect(env.ALREADY_SET).toBe('from-real-env');
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('mmmEnv', () => {
  it('throws MissingEnvError listing absent required keys', () => {
    expect(() => mmmEnv({})).toThrow(MissingEnvError);
  });

  it('returns typed config; phase-2 services null until keys exist', () => {
    const cfg = mmmEnv({
      SHOPIFY_STORE_DOMAIN: 'mmm-co.myshopify.com',
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'tok',
    });
    expect(cfg.shopify.storeDomain).toBe('mmm-co.myshopify.com');
    expect(cfg.klaviyo).toBeNull();
    expect(cfg.recharge).toBeNull();
  });

  it('populates phase-2 services when keys are present', () => {
    const cfg = mmmEnv({
      SHOPIFY_STORE_DOMAIN: 'mmm-co.myshopify.com',
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'tok',
      KLAVIYO_PRIVATE_KEY: 'pk_test',
      RECHARGE_API_TOKEN: 'rc_test',
    });
    expect(cfg.klaviyo).toEqual({ apiKey: 'pk_test' });
    expect(cfg.recharge).toEqual({ apiToken: 'rc_test' });
  });
});
