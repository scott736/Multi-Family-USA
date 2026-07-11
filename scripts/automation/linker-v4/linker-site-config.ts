// ============================================
// Smart Linker — per-site voice & quality knobs
// ============================================
// Satellite repos keep their own copy of this file (brand/templates).
// Shared logic (quality-score, force-orphan) imports from here.

export type LinkerPageType = "post" | "pillar" | "tool" | "page" | "other";

export interface LinkerSiteConfig {
  brand: string;
  /** Minimum intent overlap to insert a force-bridge (raise = fewer filler links). */
  minForceOverlap: number;
  /** Max force-bridges inserted into a single source article. */
  maxForceBridgesPerSource: number;
  /** Marker left in markdown so force-bridges can be audited / upgraded. */
  forceBridgeMarker: string;
  /** URLs that should never receive forced inbound bridges. */
  skipForceOrphanUrls: string[];
  /** Build one mid-article bridge sentence with a single markdown link. */
  buildForceBridge: (args: {
    title: string;
    url: string;
    type: LinkerPageType | string;
  }) => string;
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function cleanAnchor(title: string): string {
  return title.replace(/[\[\]]/g, "").slice(0, 80);
}

const FORCE_BRIDGE_MARKER = "<!-- linker-force-bridge -->";

export const LINKER_SITE: LinkerSiteConfig = {
  brand: "Multi-Family USA",
  minForceOverlap: 0.14,
  maxForceBridgesPerSource: 2,
  forceBridgeMarker: FORCE_BRIDGE_MARKER,
  skipForceOrphanUrls: ["/", "/blog/", "/es/", "/book-strategy-call/"],
  buildForceBridge({ title, url, type }) {
    const href = normalizeUrl(url);
    const anchor = cleanAnchor(title);
    const link = `[${anchor}](${href})`;

    if (type === "tool") {
      return `${FORCE_BRIDGE_MARKER}\nWhen operators underwrite the next term sheet, ${link} walks through the same inputs Multi-Family USA reviews on live deals.`;
    }
    if (type === "pillar" || type === "page") {
      return `${FORCE_BRIDGE_MARKER}\nThat decision sits inside our ${link} hub, where Multi-Family USA maps lender fit and structure tradeoffs.`;
    }
    // posts / other — rotate lightly by title length to avoid identical filler
    const variants = [
      `${FORCE_BRIDGE_MARKER}\nRelated reading: ${link} covers how operators execute the same debt path in practice.`,
      `${FORCE_BRIDGE_MARKER}\nFor a closer look at the capital-stack choice, ${link} breaks down how Multi-Family USA approaches it.`,
      `${FORCE_BRIDGE_MARKER}\nOperators comparing options often continue with ${link} before booking a strategy call.`,
    ];
    return variants[anchor.length % variants.length]!;
  },
};

/** Detect legacy filler bridges that predate the marker. */
export const LEGACY_FORCE_BRIDGE_PATTERNS: RegExp[] = [
  /If you're exploring this further,\s*our guide to\s*\[[^\]]+\]\([^)]+\)\s*covers the details\./gi,
  /If you're exploring this further,\s*\[[^\]]+\]\([^)]+\)\s*covers the details[^.]*\./gi,
  /For homeowners navigating renewal options,\s*\[[^\]]+\]\([^)]+\)\s*covers the details\./gi,
  /For multifamily investors digging deeper,\s*\[[^\]]+\]\([^)]+\)\s*covers the details\./gi,
  /For Canadian homeowners exploring reverse mortgage options,\s*\[[^\]]+\]\([^)]+\)\s*covers the details from Reverse Mortgage Centre\./gi,
];
