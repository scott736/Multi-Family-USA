// ============================================
// Smart Linker — Pillar Page Intent Cards (Multi-Family USA)
// ============================================

export interface PillarIntentCard {
  readerPromise: string;
  topicsCovered: string[];
  questionsAnswered: string[];
  linkWhen: string[];
  doNotLinkWhen: string[];
  assetTypes: string[];
  unitRange?: string;
}

export const PILLAR_INTENT_CARDS: Record<string, PillarIntentCard> = {
  "loan-types": {
    readerPromise:
      "Compare US commercial multifamily loan executions — agency, bridge, bank, CMBS, debt fund, FHA/HUD, and Freddie Mac Optigo — and choose the fit for your asset.",
    topicsCovered: [
      "Agency stabilized multifamily",
      "Bridge value-add debt",
      "Bank balance-sheet loans",
      "CMBS and debt fund structures",
      "FHA/HUD multifamily",
      "Freddie Mac Optigo",
    ],
    questionsAnswered: [
      "Which multifamily loan type fits a stabilized apartment building?",
      "When is bridge debt better than agency?",
      "How do FHA/HUD programs compare to Fannie/Freddie?",
    ],
    linkWhen: [
      "when the article discusses choosing or comparing multifamily loan products",
      "when agency, bridge, bank, CMBS, or FHA execution is the topic",
      "when a sponsor needs a product overview before underwriting detail",
    ],
    doNotLinkWhen: [
      "when the article is already a deep dive on a single loan product page",
      "when the context is Canadian CMHC-only financing",
    ],
    assetTypes: ["multifamily", "apartment"],
    unitRange: "5+",
  },

  "property-types": {
    readerPromise:
      "Understand how garden-style, mid-rise, suburban, and value-add C-class multifamily assets underwrite and finance differently.",
    topicsCovered: [
      "Garden-style multifamily",
      "Mid-rise urban apartments",
      "Large suburban communities",
      "Value-add C-class assets",
    ],
    questionsAnswered: [
      "How does property type change multifamily loan structure?",
      "What underwriting differs for value-add C-class?",
    ],
    linkWhen: [
      "when the article focuses on a specific multifamily asset class",
      "when property type drives leverage or lender appetite",
    ],
    doNotLinkWhen: [
      "when the article is purely about loan products with no asset-type angle",
    ],
    assetTypes: ["multifamily", "garden", "mid-rise", "value-add"],
    unitRange: "5+",
  },

  learn: {
    readerPromise:
      "Learn commercial multifamily financing fundamentals — DSCR, debt yield, NOI, capital stack, and execution playbooks.",
    topicsCovered: [
      "Commercial DSCR",
      "Debt yield and LTV",
      "NOI normalization",
      "Agency vs bridge execution",
      "Closing and entity structure",
    ],
    questionsAnswered: [
      "How does commercial DSCR work for 5+ unit deals?",
      "What is debt yield and why does it matter?",
      "How do I prepare for multifamily closing?",
    ],
    linkWhen: [
      "when the reader needs educational depth on underwriting concepts",
      "when linking to a how-to guide rather than a product page",
    ],
    doNotLinkWhen: [
      "when a calculator tool is the better destination for a numeric workflow",
    ],
    assetTypes: ["multifamily"],
    unitRange: "5+",
  },

  tools: {
    readerPromise:
      "Run free multifamily calculators for commercial DSCR, cap rate/NOI, debt yield, cash-on-cash, and loan sizing.",
    topicsCovered: [
      "Commercial DSCR calculator",
      "Cap rate and NOI",
      "Debt yield",
      "Loan sizing",
      "Cash-on-cash",
    ],
    questionsAnswered: [
      "How do I calculate commercial DSCR?",
      "How do I size a multifamily loan?",
      "What is my deal's debt yield?",
    ],
    linkWhen: [
      "when the reader should run numbers rather than only read theory",
      "when DSCR, debt yield, cap rate, or proceeds sizing is mentioned",
    ],
    doNotLinkWhen: [
      "when the article already embeds the same calculator",
    ],
    assetTypes: ["multifamily"],
  },

  "tools/commercial-dscr-calculator": {
    readerPromise:
      "Calculate commercial DSCR for US multifamily deals and see how coverage drives proceeds.",
    topicsCovered: ["DSCR", "NOI", "debt service", "coverage floors"],
    questionsAnswered: ["How do I calculate commercial DSCR for multifamily?"],
    linkWhen: [
      "when the article discusses DSCR thresholds or coverage tests",
      "when readers need to run DSCR on their own numbers",
    ],
    doNotLinkWhen: ["when DSCR is mentioned only in passing without calculation intent"],
    assetTypes: ["multifamily"],
  },

  "tools/debt-yield-calculator": {
    readerPromise:
      "Calculate debt yield — often the binding constraint on agency and CMBS multifamily term sheets.",
    topicsCovered: ["debt yield", "NOI", "loan proceeds"],
    questionsAnswered: ["How do I calculate debt yield?"],
    linkWhen: [
      "when debt yield, proceeds caps, or term-sheet velocity is the focus",
    ],
    doNotLinkWhen: ["when the article is exclusively about residential 1–4 unit DSCR"],
    assetTypes: ["multifamily"],
  },

  "tools/cap-rate-noi-calculator": {
    readerPromise: "Calculate cap rate and NOI for multifamily acquisitions and refinances.",
    topicsCovered: ["cap rate", "NOI", "valuation"],
    questionsAnswered: ["How do I calculate cap rate and NOI?"],
    linkWhen: ["when cap rate or NOI math is central to the article"],
    doNotLinkWhen: ["when valuation is only mentioned as background"],
    assetTypes: ["multifamily"],
  },

  "tools/loan-sizing-calculator": {
    readerPromise:
      "Size multifamily loan proceeds using DSCR, debt yield, and LTV constraints together.",
    topicsCovered: ["loan sizing", "LTV", "DSCR", "debt yield"],
    questionsAnswered: ["How much can I borrow on a multifamily deal?"],
    linkWhen: ["when proceeds sizing or leverage math is the reader intent"],
    doNotLinkWhen: ["when the article is a soft market overview with no sizing angle"],
    assetTypes: ["multifamily"],
  },

  states: {
    readerPromise:
      "Review state-level multifamily financing context — tax, foreclosure, rent control, and capital markets.",
    topicsCovered: ["state markets", "property tax", "rent control", "foreclosure"],
    questionsAnswered: ["How does my state affect multifamily financing?"],
    linkWhen: ["when a US state market or state-specific financing context is discussed"],
    doNotLinkWhen: ["when geography is only incidental"],
    assetTypes: ["multifamily"],
  },

  cities: {
    readerPromise:
      "City-level multifamily market snapshots with pricing, rents, and financing implications.",
    topicsCovered: ["city markets", "rents", "price per unit"],
    questionsAnswered: ["What does multifamily financing look like in this city?"],
    linkWhen: ["when a specific US city market is the focus"],
    doNotLinkWhen: ["when city names appear only as examples"],
    assetTypes: ["multifamily"],
  },

  compare: {
    readerPromise:
      "Compare capital options — agency vs bridge, bank vs debt fund, fixed vs floating, recourse, CMBS, and FHA.",
    topicsCovered: [
      "agency vs bridge",
      "bank vs debt fund",
      "fixed vs floating",
      "recourse vs non-recourse",
    ],
    questionsAnswered: ["Which capital path should I choose for this multifamily deal?"],
    linkWhen: [
      "when the article frames a decision between two financing paths",
    ],
    doNotLinkWhen: ["when only one product is being explained in depth"],
    assetTypes: ["multifamily"],
  },

  invest: {
    readerPromise:
      "Investor playbooks for first-time buyers, value-add sponsors, small portfolio operators, and institutional growth.",
    topicsCovered: ["sponsor playbooks", "capital strategy", "operator profiles"],
    questionsAnswered: ["What financing strategy fits my sponsor profile?"],
    linkWhen: ["when the article addresses sponsor type or investment strategy persona"],
    doNotLinkWhen: ["when the focus is purely product mechanics"],
    assetTypes: ["multifamily"],
  },

  checklists: {
    readerPromise:
      "Use due diligence, lender document, and pro forma checklists for multifamily debt execution.",
    topicsCovered: ["due diligence", "lender docs", "pro forma"],
    questionsAnswered: ["What documents do multifamily lenders require?"],
    linkWhen: ["when preparation, closing, or document packaging is the focus"],
    doNotLinkWhen: ["when the article is a rate or market update only"],
    assetTypes: ["multifamily"],
  },

  rates: {
    readerPromise:
      "Understand multifamily rate and spread context across agency, bridge, and bank executions.",
    topicsCovered: ["rates", "spreads", "all-in cost"],
    questionsAnswered: ["Where are multifamily rates and spreads today?"],
    linkWhen: ["when rate or spread movement is the article focus"],
    doNotLinkWhen: ["when rates are mentioned only as a generic cost of capital"],
    assetTypes: ["multifamily"],
  },

  "book-strategy-call": {
    readerPromise:
      "Book a free strategy call with Multi-Family USA to review debt structure and lender fit.",
    topicsCovered: ["strategy call", "deal review", "lender fit"],
    questionsAnswered: ["How do I talk to a multifamily financing specialist?"],
    linkWhen: [
      "when the reader is ready for personalized deal guidance",
    ],
    doNotLinkWhen: [
      "when an educational guide or calculator is the better next step",
    ],
    assetTypes: ["multifamily"],
  },

  "deal-review": {
    readerPromise:
      "Submit a multifamily deal for a free lender-fit and underwriting review.",
    topicsCovered: ["deal review", "underwriting read", "lender fit"],
    questionsAnswered: ["Can someone review my multifamily deal?"],
    linkWhen: ["when the reader has a live deal and needs feedback"],
    doNotLinkWhen: ["when the reader is still learning fundamentals"],
    assetTypes: ["multifamily"],
  },
};
