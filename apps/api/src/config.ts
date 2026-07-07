import { createSecretsProvider, parseFieldKey, type SecretsProvider } from "@spendwhere/shared";

export interface ApiConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigin: string;
  /** Runtime connection — the RLS-constrained spendwhere_app role. */
  databaseUrl: string;
  jwtSecret: Uint8Array;
  fieldKey: Buffer;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  persona: {
    apiKey?: string;
    webhookSecret?: string;
    templateId?: string;
    environment: string;
  };
  vault: {
    /** "s3" when S3_BUCKET is configured, otherwise local filesystem. */
    driver: "local" | "s3";
    localDir: string;
    s3?: {
      endpoint?: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
}

export async function loadConfig(
  secrets: SecretsProvider = createSecretsProvider(),
  env: Record<string, string | undefined> = process.env,
): Promise<ApiConfig> {
  const nodeEnv = (env["NODE_ENV"] ?? "development") as ApiConfig["nodeEnv"];
  return {
    nodeEnv,
    port: Number(env["PORT"] ?? 4000),
    corsOrigin: env["CORS_ORIGIN"] ?? "http://localhost:3000",
    databaseUrl: await secrets.get("DATABASE_URL"),
    jwtSecret: new TextEncoder().encode(await secrets.get("JWT_SECRET")),
    fieldKey: parseFieldKey(await secrets.get("FIELD_ENCRYPTION_KEY")),
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    persona: {
      apiKey: await secrets.getOptional("PERSONA_API_KEY"),
      webhookSecret: await secrets.getOptional("PERSONA_WEBHOOK_SECRET"),
      templateId: env["PERSONA_TEMPLATE_ID"],
      environment: env["PERSONA_ENVIRONMENT"] ?? "sandbox",
    },
    vault: await loadVaultConfig(secrets, env),
  };
}

async function loadVaultConfig(
  secrets: SecretsProvider,
  env: Record<string, string | undefined>,
): Promise<ApiConfig["vault"]> {
  const bucket = await secrets.getOptional("S3_BUCKET");
  if (bucket) {
    return {
      driver: "s3",
      localDir: env["VAULT_STORAGE_DIR"] ?? "./vault-data",
      s3: {
        endpoint: await secrets.getOptional("S3_ENDPOINT"),
        region: env["S3_REGION"] ?? "us-east-1",
        bucket,
        accessKeyId: await secrets.get("S3_ACCESS_KEY_ID"),
        secretAccessKey: await secrets.get("S3_SECRET_ACCESS_KEY"),
      },
    };
  }
  return { driver: "local", localDir: env["VAULT_STORAGE_DIR"] ?? "./vault-data" };
}
