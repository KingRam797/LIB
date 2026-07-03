import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  totpSecretEnc: text("totp_secret_enc"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  kycStatus: text("kyc_status", {
    enum: ["not_started", "pending", "passed", "failed"],
  })
    .notNull()
    .default("not_started"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId), index("refresh_tokens_family_idx").on(t.familyId)],
);

export const sensitiveProfiles = pgTable("sensitive_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  ssnEnc: text("ssn_enc"),
  einEnc: text("ein_enc"),
  bankRoutingEnc: text("bank_routing_enc"),
  bankAccountEnc: text("bank_account_enc"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kycInquiries = pgTable(
  "kyc_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vendor: text("vendor").notNull().default("persona"),
    inquiryId: text("inquiry_id").notNull().unique(),
    status: text("status", { enum: ["pending", "passed", "failed"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kyc_inquiries_user_idx").on(t.userId)],
);

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  detail: jsonb("detail").notNull().default({}),
  prevHash: text("prev_hash").notNull(),
  entryHash: text("entry_hash").notNull(),
});
