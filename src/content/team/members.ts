import { SITE_URL } from "../../consts";
import { AUTHORS, getAuthorByName, getAuthorBySlug, getAuthorProfilePath } from "../../lib/authors";

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

export const TEAM_MEMBERS: TeamMember[] = AUTHORS.map((author) => ({
  slug: author.slug,
  name: author.name,
  jobTitle: author.title,
  image: `${SITE_URL}${author.photo}`,
  shortBio: author.shortBio,
  fullBio: author.bio,
  knowsAbout: author.knowsAbout,
  credentials: author.credentials,
  sameAs: author.sameAs,
}));

export function getMemberBySlug(slug: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.slug === slug);
}

export function getMemberSlugByName(name: string): string | undefined {
  return getAuthorByName(name)?.slug;
}

export { getAuthorBySlug,getAuthorProfilePath };
