/**
 * Mmm! — Shopify Storefront API client.
 *
 * Thin, dependency-free client over the Storefront GraphQL API (2025-01).
 * Used by the quiz result → prefilled cart flow (Phase 2) and by any
 * server-side rendering of live product data.
 *
 * Auth: a *public* Storefront access token (safe for client exposure), NOT
 * an Admin token. Set via environment:
 *   SHOPIFY_STORE_DOMAIN            e.g. "mmm-co.myshopify.com"
 *   SHOPIFY_STOREFRONT_ACCESS_TOKEN
 */

import { PRODUCTS, type SkuCode } from './products.js';

const API_VERSION = '2025-01';

export interface StorefrontConfig {
  storeDomain: string;
  storefrontAccessToken: string;
}

export interface StorefrontVariant {
  id: string;
  sku: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  sellingPlanIds: string[];
}

export interface StorefrontProduct {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  featuredImageUrl: string | null;
  variants: StorefrontVariant[];
}

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  /** ReCharge subscription selling plan — set for the subscription-first default. */
  sellingPlanId?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): StorefrontConfig {
  const storeDomain = env.SHOPIFY_STORE_DOMAIN;
  const storefrontAccessToken = env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!storeDomain || !storefrontAccessToken) {
    throw new Error(
      'Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN — see config-checklists/phase-1-foundation.md',
    );
  }
  return { storeDomain, storefrontAccessToken };
}

export class StorefrontClient {
  constructor(private readonly config: StorefrontConfig) {}

  private get endpoint(): string {
    return `https://${this.config.storeDomain}/api/${API_VERSION}/graphql.json`;
  }

  async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': this.config.storefrontAccessToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      throw new Error(`Storefront API ${res.status}: ${await res.text()}`);
    }
    const payload = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (payload.errors?.length) {
      throw new Error(`Storefront API errors: ${payload.errors.map((e) => e.message).join('; ')}`);
    }
    if (!payload.data) throw new Error('Storefront API returned no data');
    return payload.data;
  }

  /** Fetch one product by handle, normalized to our shape. */
  async getProductByHandle(handle: string): Promise<StorefrontProduct | null> {
    interface Raw {
      product: {
        id: string;
        handle: string;
        title: string;
        descriptionHtml: string;
        featuredImage: { url: string } | null;
        variants: {
          nodes: Array<{
            id: string;
            sku: string;
            availableForSale: boolean;
            price: { amount: string; currencyCode: string };
            sellingPlanAllocations: { nodes: Array<{ sellingPlan: { id: string } }> };
          }>;
        };
      } | null;
    }
    const data = await this.query<Raw>(
      /* GraphQL */ `
        query MmmProduct($handle: String!) {
          product(handle: $handle) {
            id
            handle
            title
            descriptionHtml
            featuredImage { url }
            variants(first: 10) {
              nodes {
                id
                sku
                availableForSale
                price { amount currencyCode }
                sellingPlanAllocations(first: 5) {
                  nodes { sellingPlan { id } }
                }
              }
            }
          }
        }
      `,
      { handle },
    );
    if (!data.product) return null;
    const p = data.product;
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      descriptionHtml: p.descriptionHtml,
      featuredImageUrl: p.featuredImage?.url ?? null,
      variants: p.variants.nodes.map((v) => ({
        id: v.id,
        sku: v.sku,
        price: v.price,
        availableForSale: v.availableForSale,
        sellingPlanIds: v.sellingPlanAllocations.nodes.map((n) => n.sellingPlan.id),
      })),
    };
  }

  /** Fetch all four Mmm! SKUs by their canonical handles. */
  async getAllSkus(): Promise<Partial<Record<SkuCode, StorefrontProduct>>> {
    const out: Partial<Record<SkuCode, StorefrontProduct>> = {};
    for (const product of Object.values(PRODUCTS)) {
      const fetched = await this.getProductByHandle(product.handle);
      if (fetched) out[product.sku] = fetched;
    }
    return out;
  }

  /**
   * Create a cart prefilled with the recommended stack (Phase 2: quiz result →
   * one-tap subscribe). Returns the checkout URL to send the visitor to.
   */
  async createCart(lines: CartLineInput[]): Promise<{ cartId: string; checkoutUrl: string }> {
    interface Raw {
      cartCreate: {
        cart: { id: string; checkoutUrl: string } | null;
        userErrors: Array<{ message: string }>;
      };
    }
    const data = await this.query<Raw>(
      /* GraphQL */ `
        mutation MmmCartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { id checkoutUrl }
            userErrors { message }
          }
        }
      `,
      {
        input: {
          lines: lines.map((l) => ({
            merchandiseId: l.merchandiseId,
            quantity: l.quantity,
            ...(l.sellingPlanId ? { sellingPlanId: l.sellingPlanId } : {}),
          })),
        },
      },
    );
    if (data.cartCreate.userErrors.length) {
      throw new Error(`cartCreate: ${data.cartCreate.userErrors.map((e) => e.message).join('; ')}`);
    }
    if (!data.cartCreate.cart) throw new Error('cartCreate returned no cart');
    return { cartId: data.cartCreate.cart.id, checkoutUrl: data.cartCreate.cart.checkoutUrl };
  }
}
