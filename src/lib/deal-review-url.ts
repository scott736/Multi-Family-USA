/** Build /deal-review (or /es/deal-review) URLs with calculator handoff params. */
export function buildDealReviewUrl(
  params: Record<string, string | number | undefined | null>,
  isEs = false,
): string {
  const base = isEs ? "/es/deal-review" : "/deal-review";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") search.set(key, String(Math.round(Number(value)) || value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/** Map calculator query params into LeadForm initial field values. */
export function parseLeadFormPrefill(search: string): Partial<{
  purpose: string;
  purchasePrice: string;
  loanAmount: string;
  annualNoi: string;
  occupancy: string;
  state: string;
  units: string;
  sourceContext: string;
}> {
  const params = new URLSearchParams(search);
  const out: ReturnType<typeof parseLeadFormPrefill> = {};

  const source = params.get("source");
  if (source) out.sourceContext = source;

  const purpose = params.get("purpose");
  if (purpose === "purchase" || purpose === "acquisition") out.purpose = "acquisition";
  else if (purpose === "refinance") out.purpose = "refinance";

  const purchasePrice = params.get("purchasePrice") ?? params.get("propertyValue") ?? params.get("price");
  if (purchasePrice) out.purchasePrice = purchasePrice;

  const loanAmount = params.get("loanAmount");
  if (loanAmount) out.loanAmount = loanAmount;

  const annualNoi = params.get("annualNoi") ?? params.get("noi");
  const monthlyRent = params.get("monthlyRent");
  if (annualNoi) {
    out.annualNoi = annualNoi;
  } else if (monthlyRent) {
    const rent = parseFloat(monthlyRent);
    if (rent > 0) out.annualNoi = String(Math.round(rent * 12));
  }

  const occupancy = params.get("occupancy");
  if (occupancy) out.occupancy = occupancy;

  const state = params.get("state");
  if (state && state.length === 2) out.state = state.toUpperCase();

  const units = params.get("units");
  if (units) out.units = units;

  return out;
}
