import { SITE_URL } from "../../consts";

export interface TeamMember {
  slug: string;
  name: string;
  jobTitle: string;
  image: string;
  shortBio: string;
  fullBio: string;
  knowsAbout: string[];
  credentials?: string[];
  sameAs?: string[];
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    slug: "scott-dillingham",
    name: "Scott Dillingham",
    jobTitle: "Principal Advisor",
    image: `${SITE_URL}/images/team/chris-micucci.webp`,
    shortBio: "Principal advisor focused on US multifamily debt execution and lender fit.",
    fullBio:
      "Scott advises sponsors and operators on multifamily debt strategy, lender-fit positioning, and execution sequencing across bridge, agency, and bank structures.",
    knowsAbout: ["Debt structuring", "Lender matching", "Refinance strategy", "Deal triage"],
    credentials: ["Real Estate Finance Advisor"],
  },
  {
    slug: "aya-dillingham",
    name: "Aya Dillingham",
    jobTitle: "Operations and Client Success",
    image: `${SITE_URL}/images/team/david-cardozo.webp`,
    shortBio: "Coordinates intake, borrower communication, and follow-through on lender routing.",
    fullBio:
      "Aya leads intake operations and borrower support workflows to ensure submitted scenarios move quickly from inquiry to qualified lender conversations.",
    knowsAbout: ["Deal intake", "Borrower onboarding", "Pipeline operations"],
    credentials: ["Client Success Lead"],
  },
];

export function getMemberBySlug(slug: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.slug === slug);
}

export function getMemberSlugByName(name: string): string | undefined {
  if (!name) return undefined;
  const exact = TEAM_MEMBERS.find((m) => m.name === name);
  if (exact) return exact.slug;
  const byPrefix = TEAM_MEMBERS.find((m) => name.startsWith(m.name));
  return byPrefix?.slug;
}

export function getAuthorProfilePath(name: string): string {
  const slug = getMemberSlugByName(name);
  if (slug) return `/team/${slug}`;
  return "/about";
}
