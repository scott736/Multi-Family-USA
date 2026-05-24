/**
 * Replace English keywords in es-* MDX frontmatter with Spanish SEO keywords.
 * Run: node scripts/apply-es-keywords.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");

const KEYWORDS_BY_FILE = {
  // es-guides
  "es-guides/agency-vs-bridge-execution.mdx": [
    "agency vs bridge multifamiliar",
    "préstamo bridge multifamiliar",
    "préstamo Fannie Freddie",
    "financiamiento value-add",
  ],
  "es-guides/capital-stack-design-for-value-add.mdx": [
    "capital stack multifamiliar",
    "value-add multifamiliar",
    "equity preferente",
    "estructura préstamo bridge",
  ],
  "es-guides/commercial-dscr-explained.mdx": [
    "DSCR comercial",
    "DSCR multifamiliar",
    "calificación préstamo apartamentos",
    "suscripción prestamista",
  ],
  "es-guides/debt-yield-and-ltv-framework.mdx": [
    "debt yield",
    "LTV multifamiliar",
    "apalancamiento multifamiliar",
    "riesgo refinanciamiento",
  ],
  "es-guides/entity-structure-for-multifamily-borrowing.mdx": [
    "estructura entidad multifamiliar",
    "préstamo LLC",
    "marco garantía",
    "SPE multifamiliar",
    "entidad prestataria",
  ],
  "es-guides/five-plus-unit-commercial-financing-basics.mdx": [
    "financiamiento 5+ unidades",
    "préstamo multifamiliar comercial",
    "préstamo apartamento 5 unidades",
    "multifamiliar vs residencial",
  ],
  "es-guides/multifamily-cash-out-refinance.mdx": [
    "refinanciamiento cash-out multifamiliar",
    "refi comercial cash-out",
    "proceeds refinanciamiento apartamentos",
    "seasoning multifamiliar",
  ],
  "es-guides/multifamily-close-checklist.mdx": [
    "lista cierre multifamiliar",
    "proceso cierre préstamo",
    "ejecución deuda",
    "diligencia prestamista",
  ],
  "es-guides/multifamily-noi-normalization.mdx": [
    "normalización NOI",
    "suscripción multifamiliar",
    "suscripción gastos",
    "análisis T12",
  ],
  "es-guides/multifamily-underwriting-basics.mdx": [
    "suscripción multifamiliar",
    "financiamiento apartamentos",
    "DSCR comercial",
    "dimensionamiento deuda",
  ],
  "es-guides/operator-reporting-for-lenders.mdx": [
    "reporteo prestamista",
    "operaciones multifamiliar",
    "reporteo asset management",
    "cumplimiento préstamo",
  ],
  "es-guides/rate-risk-and-refinance-planning.mdx": [
    "riesgo de tasa",
    "planificación refinanciamiento",
    "tasa flotante multifamiliar",
    "estrés tasa interés",
  ],
  "es-guides/stabilized-vs-transitional-assets.mdx": [
    "multifamiliar estabilizado",
    "multifamiliar transicional",
    "bridge a agency",
    "estabilización activo",
  ],
  // es-blog
  "es-blog/debt-yield-why-it-drives-term-sheet-velocity.mdx": [
    "debt yield multifamiliar",
    "velocidad term sheet",
    "suscripción multifamiliar",
  ],
  "es-blog/how-operators-are-sizing-bridge-risk.mdx": [
    "riesgo bridge multifamiliar",
    "financiamiento multifamiliar",
    "ejecución deuda",
  ],
  "es-blog/multifamily-rate-spread-update-q2-2026.mdx": [
    "spreads tasa multifamiliar",
    "tasas financiamiento multifamiliar",
    "costo endeudamiento 2026",
  ],
  // es-loan-types
  "es-loan-types/agency-stabilized.mdx": [
    "préstamo agency estabilizado",
    "financiamiento multifamiliar",
    "préstamo comercial apartamentos",
    "estructura préstamo",
  ],
  "es-loan-types/bank-balance-sheet.mdx": [
    "préstamo banco balance sheet",
    "financiamiento multifamiliar",
    "préstamo comercial apartamentos",
    "estructura préstamo",
  ],
  "es-loan-types/bridge-value-add.mdx": [
    "préstamo bridge value-add",
    "financiamiento multifamiliar",
    "préstamo comercial apartamentos",
    "estructura préstamo",
  ],
  "es-loan-types/cmbs-stabilized.mdx": [
    "préstamo CMBS multifamiliar",
    "financiamiento CMBS estabilizado",
    "valores respaldados hipotecas comerciales",
    "deuda permanente multifamiliar",
  ],
  "es-loan-types/debt-fund-floating-rate.mdx": [
    "préstamo debt fund tasa flotante",
    "financiamiento multifamiliar",
    "préstamo comercial apartamentos",
    "estructura préstamo",
  ],
  // es-comparisons
  "es-comparisons/acquisition-vs-refinance.mdx": [
    "adquisición vs refinanciamiento",
    "financiamiento adquisición multifamiliar",
    "refinanciamiento multifamiliar",
    "comparación préstamo apartamentos",
  ],
  "es-comparisons/agency-vs-bridge.mdx": [
    "deuda agency vs bridge",
    "comparación deuda multifamiliar",
    "decisión capital stack",
    "estrategia préstamo apartamentos",
  ],
  "es-comparisons/bank-vs-debt-fund.mdx": [
    "préstamo banco vs debt fund",
    "comparación deuda multifamiliar",
    "decisión capital stack",
    "estrategia préstamo apartamentos",
  ],
  "es-comparisons/fixed-vs-floating-rate.mdx": [
    "deuda tasa fija vs flotante",
    "comparación deuda multifamiliar",
    "decisión capital stack",
    "estrategia préstamo apartamentos",
  ],
  "es-comparisons/recourse-vs-nonrecourse.mdx": [
    "deuda recourse vs non-recourse",
    "comparación deuda multifamiliar",
    "decisión capital stack",
    "estrategia préstamo apartamentos",
  ],
  // es-property-types
  "es-property-types/garden-style-multifamily.mdx": [
    "multifamiliar garden-style",
    "tipo propiedad multifamiliar",
    "suscripción apartamentos",
    "préstamo multifamiliar comercial",
  ],
  "es-property-types/large-suburban-apartment.mdx": [
    "comunidades suburbanas apartamentos",
    "tipo propiedad multifamiliar",
    "suscripción apartamentos",
    "préstamo multifamiliar comercial",
  ],
  "es-property-types/mid-rise-urban-multifamily.mdx": [
    "multifamiliar urbano mid-rise",
    "tipo propiedad multifamiliar",
    "suscripción apartamentos",
    "préstamo multifamiliar comercial",
  ],
  "es-property-types/value-add-c-class-multifamily.mdx": [
    "multifamiliar clase C value-add",
    "tipo propiedad multifamiliar",
    "suscripción apartamentos",
    "préstamo multifamiliar comercial",
  ],
  // es-investor-profiles
  "es-investor-profiles/first-time-multifamily-buyer.mdx": [
    "comprador multifamiliar primera vez",
    "perfil inversionista multifamiliar",
    "estrategia portafolio",
    "financiamiento apartamentos",
  ],
  "es-investor-profiles/institutional-growth-operator.mdx": [
    "operador institucional crecimiento",
    "perfil inversionista multifamiliar",
    "estrategia portafolio",
    "financiamiento apartamentos",
  ],
  "es-investor-profiles/small-portfolio-operator.mdx": [
    "operador portafolio pequeño",
    "perfil inversionista multifamiliar",
    "estrategia portafolio",
    "financiamiento apartamentos",
  ],
  "es-investor-profiles/value-add-sponsor.mdx": [
    "patrocinador value-add",
    "perfil inversionista multifamiliar",
    "estrategia portafolio",
    "financiamiento apartamentos",
  ],
  // es-cities
  "es-cities/atlanta.mdx": [
    "financiamiento multifamiliar Atlanta",
    "préstamo apartamentos Atlanta",
    "cap rate Atlanta",
    "préstamo multifamiliar comercial",
  ],
  "es-cities/charlotte.mdx": [
    "financiamiento multifamiliar Charlotte",
    "préstamo apartamentos Charlotte",
    "cap rate Charlotte",
    "préstamo multifamiliar comercial",
  ],
  "es-cities/dallas.mdx": [
    "financiamiento multifamiliar Dallas",
    "préstamo apartamentos Dallas",
    "cap rate Dallas",
    "préstamo multifamiliar comercial",
  ],
  "es-cities/phoenix.mdx": [
    "financiamiento multifamiliar Phoenix",
    "préstamo apartamentos Phoenix",
    "cap rate Phoenix",
    "préstamo multifamiliar comercial",
  ],
  "es-cities/tampa.mdx": [
    "financiamiento multifamiliar Tampa",
    "préstamo apartamentos Tampa",
    "cap rate Tampa",
    "préstamo multifamiliar comercial",
  ],
};

function replaceKeywords(relPath, keywords) {
  const filePath = path.join(ROOT, "src/content", relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`skip missing: ${relPath}`);
    return false;
  }
  let content = fs.readFileSync(filePath, "utf8");
  const block = `keywords:\n${keywords.map((k) => `- ${k}`).join("\n")}`;
  const updated = content.replace(/^keywords:\n(?:- .+\n)+/m, `${block}\n`);
  if (updated === content) {
    console.warn(`no keywords block replaced: ${relPath}`);
    return false;
  }
  fs.writeFileSync(filePath, updated);
  return true;
}

let count = 0;
for (const [relPath, keywords] of Object.entries(KEYWORDS_BY_FILE)) {
  if (replaceKeywords(relPath, keywords)) count++;
}
console.log(`Updated keywords in ${count} files.`);
