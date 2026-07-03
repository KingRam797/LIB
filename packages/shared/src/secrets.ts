/**
 * Vendor-neutral secrets access (spec T0.4).
 *
 * All secret reads in the app go through SecretsProvider. Dev/test use the
 * env-based provider; production swaps in a Vault-backed implementation of
 * the same interface without touching call sites. Never read process.env
 * for a secret anywhere else.
 */

export interface SecretsProvider {
  /** Returns the secret value, or throws if it is not configured. */
  get(name: string): Promise<string>;
  /** Returns the secret value, or undefined if not configured. */
  getOptional(name: string): Promise<string | undefined>;
}

export class EnvSecretsProvider implements SecretsProvider {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

  async get(name: string): Promise<string> {
    const value = this.env[name];
    if (value === undefined || value === "") {
      throw new Error(`Missing required secret: ${name}`);
    }
    return value;
  }

  async getOptional(name: string): Promise<string | undefined> {
    const value = this.env[name];
    return value === undefined || value === "" ? undefined : value;
  }
}

/**
 * Vault-backed provider (KV v2 over HTTP). Activated when VAULT_ADDR and
 * VAULT_TOKEN are present; otherwise the app falls back to env secrets.
 * Uses fetch so there is no vendor SDK lock-in.
 */
export class VaultSecretsProvider implements SecretsProvider {
  private cache = new Map<string, string>();

  constructor(
    private readonly addr: string,
    private readonly token: string,
    private readonly mountPath = "secret",
    private readonly secretPath = "spendwhere",
  ) {}

  private async load(): Promise<void> {
    const res = await fetch(
      `${this.addr}/v1/${this.mountPath}/data/${this.secretPath}`,
      { headers: { "X-Vault-Token": this.token } },
    );
    if (!res.ok) {
      throw new Error(`Vault read failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { data?: { data?: Record<string, string> } };
    const data = body.data?.data ?? {};
    for (const [k, v] of Object.entries(data)) {
      this.cache.set(k, v);
    }
  }

  async get(name: string): Promise<string> {
    const value = await this.getOptional(name);
    if (value === undefined) {
      throw new Error(`Missing required secret in Vault: ${name}`);
    }
    return value;
  }

  async getOptional(name: string): Promise<string | undefined> {
    if (this.cache.size === 0) {
      await this.load();
    }
    return this.cache.get(name);
  }
}

/** Picks Vault when configured, env otherwise. */
export function createSecretsProvider(
  env: Record<string, string | undefined> = process.env,
): SecretsProvider {
  const addr = env["VAULT_ADDR"];
  const token = env["VAULT_TOKEN"];
  if (addr && token) {
    return new VaultSecretsProvider(addr, token);
  }
  return new EnvSecretsProvider(env);
}
