import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

export const onboardingProfiles = pgTable("onboarding_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  persona: text("persona", {
    enum: ["gig_worker", "creator", "freelancer", "small_business", "investor", "other"],
  }),
  incomeBand: text("income_band", {
    enum: ["under_30k", "30k_75k", "75k_150k", "150k_500k", "500k_1m", "1m_3m", "over_3m"],
  }),
  goals: jsonb("goals").notNull().default([]),
  homeState: text("home_state"),
  currentStep: integer("current_step").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  bodyMd: text("body_md").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const investmentSchedules = pgTable(
  "investment_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cadence: text("cadence", { enum: ["weekly", "biweekly", "monthly"] }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    target: text("target", {
      enum: ["emergency_fund", "index_fund", "retirement", "real_estate", "custom"],
    }).notNull(),
    startsOn: date("starts_on").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("investment_schedules_user_idx").on(t.userId)],
);

export const budgetTransactions = pgTable(
  "budget_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    occurredOn: date("occurred_on").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    category: text("category", {
      enum: [
        "income",
        "housing",
        "food",
        "transportation",
        "business",
        "healthcare",
        "taxes",
        "savings",
        "entertainment",
        "other",
      ],
    }).notNull(),
    source: text("source", { enum: ["manual", "import"] }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("budget_transactions_user_date_idx").on(t.userId, t.occurredOn)],
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
