/**
 * T1.5 — KYC via Persona (spec-recommended vendor; King's final call).
 *
 * Compliance posture: we store ONLY the vendor inquiry id + pass/fail
 * status. Raw identity documents and extracted PII stay with the vendor.
 *
 * Without PERSONA_API_KEY the client runs in stub mode so the KYC gate is
 * fully exercisable in dev/test before the vendor account exists.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export interface KycInquiryRef {
  inquiryId: string;
  /** Hosted-flow URL the user completes verification at (real mode only). */
  sessionUrl?: string;
  stub: boolean;
}

export interface KycClient {
  readonly stub: boolean;
  createInquiry(referenceId: string): Promise<KycInquiryRef>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}

export interface PersonaConfig {
  apiKey?: string;
  webhookSecret?: string;
  templateId?: string;
  environment: string;
}

const PERSONA_API = "https://api.withpersona.com/api/v1";

export function createKycClient(config: PersonaConfig): KycClient {
  const stub = !config.apiKey;
  return {
    stub,
    async createInquiry(referenceId: string): Promise<KycInquiryRef> {
      if (stub) {
        return { inquiryId: `stub-inq-${randomUUID()}`, stub: true };
      }
      const res = await fetch(`${PERSONA_API}/inquiries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Persona-Version": "2023-01-05",
        },
        body: JSON.stringify({
          data: {
            attributes: {
              "inquiry-template-id": config.templateId,
              "reference-id": referenceId,
            },
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`Persona inquiry creation failed: ${res.status}`);
      }
      const body = (await res.json()) as { data: { id: string } };
      return {
        inquiryId: body.data.id,
        sessionUrl: `https://withpersona.com/verify?inquiry-id=${body.data.id}`,
        stub: false,
      };
    },
    verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
      if (!config.webhookSecret) return stub; // stub mode: only dev route is exposed
      if (!signatureHeader) return false;
      // Persona-Signature: t=<ts>,v1=<hmac>
      const parts = Object.fromEntries(
        signatureHeader.split(",").map((p) => p.split("=", 2) as [string, string]),
      );
      const t = parts["t"];
      const v1 = parts["v1"];
      if (!t || !v1) return false;
      const expected = createHmac("sha256", config.webhookSecret)
        .update(`${t}.${rawBody}`)
        .digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(v1);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}
