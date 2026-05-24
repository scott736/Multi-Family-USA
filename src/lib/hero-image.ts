import type { ImageMetadata } from "astro";

type Collection =
  | "guides"
  | "states"
  | "loan-types"
  | "property-types"
  | "comparisons"
  | "investor-profiles"
  | "blog";

const heroImages = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/articles/**/*.webp",
);

export async function getHeroImage(
  collection: Collection,
  slug: string,
): Promise<ImageMetadata | undefined> {
  const key = `/src/assets/articles/${collection}/${slug}.webp`;
  const loader = heroImages[key];
  if (!loader) return undefined;
  const mod = await loader();
  return mod.default;
}
