import { SITE_URL } from "../consts";

export interface AuthorPerson {
  slug: string;
  name: string;
  title: string;
  bio: string;
  shortBio: string;
  credentials: string[];
  photo: string;
  knowsAbout: string[];
  sameAs?: string[];
}

export const AUTHORS: AuthorPerson[] = [
  {
    slug: "scott-dillingham",
    name: "Scott Dillingham",
    title: "Principal Advisor",
    shortBio:
      "Principal advisor focused on US multifamily debt execution and lender fit.",
    bio: "Scott advises sponsors and operators on multifamily debt strategy, lender-fit positioning, and execution sequencing across bridge, agency, and bank structures.",
    credentials: ["Real Estate Finance Advisor"],
    photo: "/images/team/scott-dillingham.webp",
    knowsAbout: ["Debt structuring", "Lender matching", "Refinance strategy", "Deal triage"],
    sameAs: ["https://www.linkedin.com/in/scottdillingham"],
  },
  {
    slug: "aya-dillingham",
    name: "Aya Dillingham",
    title: "Operations and Client Success",
    shortBio:
      "Coordinates intake, borrower communication, and follow-through on lender routing.",
    bio: "Aya leads intake operations and borrower support workflows to ensure submitted scenarios move quickly from inquiry to qualified lender conversations.",
    credentials: ["Client Success Lead"],
    photo: "/images/team/aya-dillingham.webp",
    knowsAbout: ["Deal intake", "Borrower onboarding", "Pipeline operations"],
  },
];

export function getPersonId(slug: string): string {
  return `${SITE_URL}/team/${slug}/#person`;
}

export function getAuthorBySlug(slug: string): AuthorPerson | undefined {
  return AUTHORS.find((author) => author.slug === slug);
}

export function getAuthorByName(name: string): AuthorPerson | undefined {
  if (!name) return undefined;
  const exact = AUTHORS.find((author) => author.name === name);
  if (exact) return exact;
  return AUTHORS.find((author) => name.startsWith(author.name));
}

export function getAuthorProfilePath(name: string): string {
  const author = getAuthorByName(name);
  if (author) return `/team/${author.slug}`;
  return "/about";
}
