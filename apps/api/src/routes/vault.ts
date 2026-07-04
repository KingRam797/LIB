import { randomUUID } from "node:crypto";
import { and, arrayOverlaps, eq, ilike, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decryptBytes, deriveUserKey, encryptBytes } from "@spendwhere/shared";
import { appendAudit } from "../audit.js";
import { documents } from "../db/schema.js";
import { makeRequireAuth } from "../plugins/auth-guard.js";
import type { BlobStorage } from "../vault/storage.js";
import type { AppContext } from "../context.js";

const CATEGORIES = [
  "articles",
  "ein_letter",
  "operating_agreement",
  "tax",
  "identity",
  "other",
] as const;

const UploadInput = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  category: z.enum(CATEGORIES).default("other"),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  dataBase64: z.string().min(1).max(14_000_000), // ~10 MB binary
});

const UpdateInput = z.object({
  category: z.enum(CATEGORIES).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export async function vaultRoutes(
  app: FastifyInstance,
  ctx: AppContext & { storage: BlobStorage },
): Promise<void> {
  const { config, db, storage } = ctx;
  const requireAuth = makeRequireAuth(config.jwtSecret);

  // T4.1 — upload: encrypt with the caller's derived key, store ciphertext only.
  app.post("/vault/documents", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = UploadInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", detail: parsed.error.flatten() });
    }
    const userId = req.auth!.sub;
    const { filename, contentType, category, tags, dataBase64 } = parsed.data;

    let data: Buffer;
    try {
      data = Buffer.from(dataBase64, "base64");
      if (data.length === 0) throw new Error("empty");
    } catch {
      return reply.code(400).send({ error: "dataBase64 is not valid base64" });
    }

    const key = deriveUserKey(config.fieldKey, userId);
    const encrypted = encryptBytes(data, key);
    const storageKey = `${userId}/${randomUUID()}`;
    await storage.put(storageKey, encrypted);

    const doc = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .insert(documents)
        .values({ userId, filename, contentType, sizeBytes: data.length, category, tags, storageKey })
        .returning();
      return row!;
    });
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "vault.upload",
      resource: `document:${doc.id}`,
      detail: { category, sizeBytes: data.length },
    });
    return reply.code(201).send({ document: publicDoc(doc) });
  });

  // T4.2 — list/search by category, tag, or filename.
  app.get("/vault/documents", { preHandler: requireAuth }, async (req, reply) => {
    const { category, q, tag } = req.query as { category?: string; q?: string; tag?: string };
    const userId = req.auth!.sub;
    const rows = await db.withUserDb(userId, (tx) => {
      const conditions = [eq(documents.userId, userId)];
      if (category) {
        conditions.push(eq(documents.category, category as (typeof CATEGORIES)[number]));
      }
      if (tag) conditions.push(arrayOverlaps(documents.tags, [tag]));
      if (q) {
        conditions.push(
          or(ilike(documents.filename, `%${q}%`), arrayOverlaps(documents.tags, [q]))!,
        );
      }
      return tx.select().from(documents).where(and(...conditions));
    });
    return reply.send({ documents: rows.map(publicDoc) });
  });

  app.get("/vault/documents/:id/download", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const doc = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .limit(1);
      return row ?? null;
    });
    if (!doc) return reply.code(404).send({ error: "Document not found" });

    const encrypted = await storage.get(doc.storageKey);
    const data = decryptBytes(encrypted, deriveUserKey(config.fieldKey, userId));
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "vault.download",
      resource: `document:${doc.id}`,
    });
    return reply
      .header("content-type", doc.contentType)
      .header("content-disposition", `attachment; filename="${doc.filename.replaceAll('"', "")}"`)
      .send(data);
  });

  app.patch("/vault/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = UpdateInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input" });
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const doc = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .update(documents)
        .set(parsed.data)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning();
      return row ?? null;
    });
    if (!doc) return reply.code(404).send({ error: "Document not found" });
    return reply.send({ document: publicDoc(doc) });
  });

  app.delete("/vault/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.auth!.sub;
    const { id } = req.params as { id: string };
    const doc = await db.withUserDb(userId, async (tx) => {
      const [row] = await tx
        .delete(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, userId)))
        .returning();
      return row ?? null;
    });
    if (!doc) return reply.code(404).send({ error: "Document not found" });
    await storage.delete(doc.storageKey);
    await appendAudit(db.pool, {
      actorUserId: userId,
      action: "vault.delete",
      resource: `document:${doc.id}`,
    });
    return reply.send({ ok: true });
  });
}

type DocRow = typeof documents.$inferSelect;

function publicDoc(doc: DocRow) {
  return {
    id: doc.id,
    filename: doc.filename,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    category: doc.category,
    tags: doc.tags,
    createdAt: doc.createdAt.toISOString(),
  };
}
