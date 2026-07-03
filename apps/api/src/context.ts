import type { PublicUser } from "@spendwhere/shared";
import type { ApiConfig } from "./config.js";
import type { DbHandle } from "./db/client.js";
import type { KycClient } from "./kyc/persona.js";
import type { users } from "./db/schema.js";

export interface AppContext {
  config: ApiConfig;
  db: DbHandle;
  kyc: KycClient;
}

type UserRow = typeof users.$inferSelect;

export function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
  };
}
