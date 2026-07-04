import type { ContentKind } from "@/lib/related-links";

const OG_BY_KIND: Partial<Record<ContentKind, string>> = {
  guide: "/og/learn.png",
  state: "/og/states.png",
  city: "/og/cities.png",
  tool: "/og/tools.png",
  blog: "/og/learn.png",
  loanType: "/og/learn.png",
  propertyType: "/og/learn.png",
  comparison: "/og/learn.png",
  investorProfile: "/og/learn.png",
};

export function getOgImageForKind(kind?: ContentKind, override?: string): string | undefined {
  if (override) return override;
  if (!kind) return undefined;
  return OG_BY_KIND[kind];
}
