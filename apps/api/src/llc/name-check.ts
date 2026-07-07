/**
 * T3.1 — business name availability signal.
 *
 * LARA has no public API, so this produces (a) deterministic format checks
 * against Michigan naming rules, (b) a normalized "distinguishable name"
 * per LARA's distinguishability conventions, and (c) direct links to the
 * authoritative LARA and USPTO searches the user must run themselves.
 */

export interface NameCheckResult {
  name: string;
  formatIssues: string[];
  distinguishableName: string;
  searches: {
    laraEntitySearch: string;
    usptoTrademarkSearch: string;
  };
  disclaimer: string;
}

export const NAME_CHECK_DISCLAIMER =
  "This is an automated format check only — it does NOT confirm availability. " +
  "Only LARA determines whether a Michigan LLC name is available, and a name that " +
  "clears LARA may still infringe a trademark. Run both linked searches and " +
  "consider consulting an attorney. Not legal advice.";

const DESIGNATORS = /\b(limited liability company|l\.?l\.?c\.?)\s*$/i;
const RESTRICTED_WORDS =
  /\b(bank|banking|credit union|trust|insurance|insurer|casualty|surety)\b/i;
const CORP_WORDS = /\b(corporation|corp|incorporated|inc)\b\.?/i;

/** LARA-style normalization: entity designators, punctuation, spacing, and case are not distinguishing. */
export function distinguishableName(name: string): string {
  return name
    .toLowerCase()
    .replace(DESIGNATORS, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkName(rawName: string): NameCheckResult {
  const name = rawName.trim();
  const formatIssues: string[] = [];

  if (name.length < 1) {
    formatIssues.push("Name is empty.");
  }
  if (name.length > 200) {
    formatIssues.push("Name is unreasonably long.");
  }
  if (!DESIGNATORS.test(name)) {
    formatIssues.push(
      'Michigan requires the name to end with "Limited Liability Company", "LLC", or "L.L.C." (MCL 450.4204).',
    );
  }
  if (CORP_WORDS.test(name)) {
    formatIssues.push(
      'The name must not contain "Corporation", "Corp", "Incorporated", or "Inc" — those designate a corporation, not an LLC.',
    );
  }
  if (RESTRICTED_WORDS.test(name)) {
    formatIssues.push(
      "Contains a restricted word (bank/trust/insurance/credit union) that requires regulatory approval in Michigan.",
    );
  }

  const base = distinguishableName(name);
  return {
    name,
    formatIssues,
    distinguishableName: base,
    searches: {
      laraEntitySearch: `https://cofs.lara.state.mi.us/SearchApi/Search/Search?SearchValue=${encodeURIComponent(base)}`,
      usptoTrademarkSearch: `https://tmsearch.uspto.gov/search/search-information?query=${encodeURIComponent(base)}`,
    },
    disclaimer: NAME_CHECK_DISCLAIMER,
  };
}
