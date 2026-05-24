import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const commonFields = {
  title: z.string(),
  description: z.string(),
  h1: z.string().optional(),
  slug: z.string().optional(),
  primaryKeyword: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  author: z.string().default("Multi-Family USA Editorial Team"),
  reviewer: z.string().optional(),
  readTime: z.number().optional(),
  lastUpdated: z.date().optional(),
  published: z.date().optional(),
  featured: z.boolean().optional(),
  noindex: z.boolean().optional(),
  relatedTools: z.array(z.string()).optional(),
  relatedGuides: z.array(z.string()).optional(),
  relatedStates: z.array(z.string()).optional(),
  relatedCities: z.array(z.string()).optional(),
  relatedLoanTypes: z.array(z.string()).optional(),
  relatedPropertyTypes: z.array(z.string()).optional(),
  relatedComparisons: z.array(z.string()).optional(),
  relatedInvestorProfiles: z.array(z.string()).optional(),
  relatedBlog: z.array(z.string()).optional(),
  faq: z
    .array(
      z.object({
        q: z.string(),
        a: z.string(),
      }),
    )
    .optional(),
};

const states = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/states" }),
  schema: z.object({
    ...commonFields,
    stateName: z.string(),
    stateCode: z.string().length(2),
    tier: z.enum(["1", "2", "3", "special"]),
    avgCapRate: z.number(),
    avgPricePerUnit: z.number(),
    statePropertyTax: z.number().optional(),
    hasStateIncomeTax: z.boolean(),
    foreclosureType: z.enum(["judicial", "non-judicial", "mixed"]),
    evictionTimelineDays: z.string().optional(),
    rentControl: z.boolean(),
    prohibitsPpp1to4Unit: z.boolean().default(false),
    topMarkets: z.array(z.string()),
  }),
});

const cities = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/cities" }),
  schema: z.object({
    ...commonFields,
    cityName: z.string(),
    stateName: z.string(),
    stateCode: z.string().length(2),
    medianPricePerUnit: z.number(),
    medianRentPerUnit: z.number(),
    typicalCapRate: z.number(),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/guides" }),
  schema: z.object({
    ...commonFields,
    category: z
      .enum(["fundamentals", "qualification", "capital-markets", "execution", "risk"])
      .default("fundamentals"),
  }),
});

const loanTypes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/loan-types" }),
  schema: z.object({
    ...commonFields,
    loanType: z.string(),
    typicalLeverage: z.string(),
    targetHoldPeriod: z.string(),
  }),
});

const propertyTypes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/property-types" }),
  schema: z.object({
    ...commonFields,
    propertyType: z.string(),
    minUnits: z.number().default(5),
    typicalCapRateBand: z.string(),
  }),
});

const comparisons = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/comparisons" }),
  schema: z.object({
    ...commonFields,
    productA: z.string(),
    productB: z.string(),
  }),
});

const investorProfiles = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/investor-profiles" }),
  schema: z.object({
    ...commonFields,
    profile: z.string(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/blog" }),
  schema: z.object({
    ...commonFields,
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Blog FAQs should be substantive when included.
    faq: z
      .array(
        z.object({
          q: z.string(),
          a: z.string(),
        }),
      )
      .min(3, "Blog FAQ must include at least 3 items when provided")
      .optional(),
  }),
});

const esStates = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-states" }),
  schema: states.schema,
});

const esCities = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-cities" }),
  schema: cities.schema,
});

const esGuides = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-guides" }),
  schema: guides.schema,
});

const esLoanTypes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-loan-types" }),
  schema: loanTypes.schema,
});

const esPropertyTypes = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-property-types" }),
  schema: propertyTypes.schema,
});

const esComparisons = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-comparisons" }),
  schema: comparisons.schema,
});

const esInvestorProfiles = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-investor-profiles" }),
  schema: investorProfiles.schema,
});

const esBlog = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/es-blog" }),
  schema: blog.schema,
});

export const collections = {
  states,
  cities,
  guides,
  loanTypes,
  propertyTypes,
  comparisons,
  investorProfiles,
  blog,
  esStates,
  esCities,
  esGuides,
  esLoanTypes,
  esPropertyTypes,
  esComparisons,
  esInvestorProfiles,
  esBlog,
};
