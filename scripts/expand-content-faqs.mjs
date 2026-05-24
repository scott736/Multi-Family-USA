/**
 * One-time batch expansion of FAQ frontmatter across content collections.
 * Run: node scripts/expand-content-faqs.mjs
 */
import fs from "fs";
import path from "path";

const CONTENT_ROOT = "src/content";
const TARGET_COUNT = 5;

function walk(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) results.push(...walk(p));
    else if (f.endsWith(".mdx")) results.push(p);
  }
  return results;
}

function parseField(frontmatter, key) {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = frontmatter.match(re);
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : undefined;
}

function parseNumberField(frontmatter, key) {
  const v = parseField(frontmatter, key);
  return v !== undefined ? Number(v) : undefined;
}

function parseBooleanField(frontmatter, key) {
  const v = parseField(frontmatter, key);
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function countFaqs(frontmatter) {
  if (!frontmatter.includes("faq:")) return 0;
  const faqPart = frontmatter.split("faq:")[1] ?? "";
  return (faqPart.match(/^- q:/gm) ?? []).length;
}

function formatFaqItem({ q, a }) {
  const words = a.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 78 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  const indented =
    lines.length === 1
      ? `  a: ${lines[0]}`
      : `  a: ${lines[0]}\n${lines.slice(1).map((l) => `    ${l}`).join("\n")}`;

  return `- q: ${q}\n${indented}`;
}

function appendFaqs(content, newItems) {
  if (newItems.length === 0) return content;

  const parts = content.split("---");
  if (parts.length < 3) return content;

  const frontmatter = parts[1];
  if (!frontmatter.includes("faq:")) return content;

  const additions = newItems.map(formatFaqItem).join("\n");
  const faqIdx = frontmatter.indexOf("faq:");
  const afterFaq = frontmatter.slice(faqIdx);
  const nextKeyMatch = afterFaq.slice(4).match(/\n([a-zA-Z][\w]*):/);
  let updatedFront;

  if (nextKeyMatch) {
    const insertAt = faqIdx + 4 + nextKeyMatch.index;
    updatedFront =
      frontmatter.slice(0, insertAt).trimEnd() +
      "\n" +
      additions +
      "\n" +
      frontmatter.slice(insertAt);
  } else {
    updatedFront = frontmatter.trimEnd() + "\n" + additions + "\n";
  }

  parts[1] = updatedFront;
  return parts.join("---");
}

function isSpanish(relPath) {
  return (
    relPath.startsWith("es-states/") ||
    relPath.startsWith("es-cities/") ||
    relPath.startsWith("es-guides/") ||
    relPath.startsWith("es-loan-types/") ||
    relPath.startsWith("es-property-types/") ||
    relPath.startsWith("es-comparisons/") ||
    relPath.startsWith("es-investor-profiles/") ||
    relPath.startsWith("es-blog/")
  );
}

function collectionFromPath(relPath) {
  const dir = relPath.split("/")[0];
  return dir.replace(/^es-/, "");
}

const GUIDE_FAQS_EN = {
  "agency-vs-bridge-execution": [
    {
      q: "When should sponsors choose agency debt over bridge?",
      a: "Agency fits stabilized NOI, predictable cash flow, and long-term hold strategies where pricing certainty matters more than short-term flexibility.",
    },
    {
      q: "What signals that bridge is the better execution path?",
      a: "Bridge often fits when a credible value-add or lease-up plan needs proceeds before stabilized cash flow supports permanent debt.",
    },
    {
      q: "How should sponsors compare total cost between paths?",
      a: "Model fees, reserves, extension economics, and prepayment constraints over the expected hold—not just headline coupon.",
    },
  ],
  "capital-stack-design-for-value-add": [
    {
      q: "What equity and pref structure fits most value-add deals?",
      a: "Most value-add stacks pair senior debt with sponsor equity and sometimes pref equity sized to milestone risk—not a one-size template.",
    },
    {
      q: "How should sponsors sequence debt and equity decisions?",
      a: "Define business-plan milestones first, then select debt that preserves refinance or disposition optionality if operations slip.",
    },
    {
      q: "When should sponsors revisit capital stack assumptions?",
      a: "Revisit when capex pacing, lease-up timing, or refinance spreads move materially from the assumptions used at term sheet.",
    },
  ],
  "commercial-dscr-explained": [
    {
      q: "What is a realistic way to think about lender DSCR floors?",
      a: "Thresholds vary by product and market, but sponsors should model coverage under lender-specific NOI adjustments—not spreadsheet DSCR alone.",
    },
    {
      q: "How can operators improve DSCR before refinance?",
      a: "Durable NOI improvements from occupancy, effective rent, and expense control usually matter more than optimistic pro forma growth.",
    },
    {
      q: "Why do lender and sponsor DSCR figures differ?",
      a: "Lenders may haircut revenue, stress expenses, include reserves, and use different debt-service assumptions than sponsor models.",
    },
  ],
  "debt-yield-and-ltv-framework": [
    {
      q: "How do debt yield and LTV interact in lender sizing?",
      a: "Lenders often apply both and size to the tighter constraint, especially when cap rates or NOI durability is uncertain.",
    },
    {
      q: "Which metric usually binds first on stabilized assets?",
      a: "On many stabilized executions, leverage or debt yield can bind before DSCR depending on coupon, NOI quality, and lender program limits.",
    },
    {
      q: "How should sponsors use debt yield in term-sheet negotiations?",
      a: "Present in-place and stabilized debt yield with support so committees can quickly validate proceeds without repeated NOI questions.",
    },
  ],
  "multifamily-close-checklist": [
    {
      q: "What closes most often delay multifamily transactions?",
      a: "Late diligence assembly, entity or guarantor documentation gaps, and assumption changes during credit review are common friction points.",
    },
    {
      q: "When should sponsors start assembling closing packages?",
      a: "Begin organizing insurance, estoppels, entity docs, and third-party reports early—before final lender selection when possible.",
    },
    {
      q: "What should sponsors confirm in the final week before closing?",
      a: "Reconcile NOI, debt sizing, reserve funding, and insurance requirements against the approved credit memo to avoid last-minute retrades.",
    },
  ],
  "multifamily-noi-normalization": [
    {
      q: "What should sponsors document before closing?",
      a: "Tie each NOI adjustment to source documents and explain timing for stabilization items lenders will test post-close.",
    },
    {
      q: "Which expense items create the most lender pushback?",
      a: "Payroll, utilities, insurance renewals, and property tax expectations often drive normalization debates when support is thin.",
    },
    {
      q: "How should one-time revenue or expense items be treated?",
      a: "Label items as recurring, nonrecurring, or transitional and explain why each belongs in in-place versus stabilized NOI.",
    },
  ],
  "multifamily-underwriting-basics": [
    {
      q: "What do lenders expect in a first underwriting submission?",
      a: "Clear in-place and stabilized NOI views, rent roll support, business-plan timeline, and downside sensitivity on key metrics.",
    },
    {
      q: "How should sponsors prepare for credit committee questions?",
      a: "Anticipate challenges to occupancy, concessions, capex pacing, and refinance assumptions with documented responses.",
    },
    {
      q: "Why is downside testing important before lender selection?",
      a: "Deals that only work in a base case often retrade late; testing occupancy, expenses, and rates early improves execution certainty.",
    },
  ],
  "operator-reporting-for-lenders": [
    {
      q: "What should monthly lender reporting include?",
      a: "Occupancy, effective rents, concessions, bad debt, expense variance, capex status, and covenant headroom with brief commentary.",
    },
    {
      q: "When should sponsors proactively contact lenders about performance?",
      a: "Before covenant pressure becomes acute—especially when occupancy, NOI, or refinance timelines drift from the approved plan.",
    },
    {
      q: "How does reporting quality affect refinance options?",
      a: "Consistent, transparent reporting often improves lender confidence and can speed takeout discussions when metrics are on track.",
    },
  ],
  "rate-risk-and-refinance-planning": [
    {
      q: "How should sponsors plan for floating-rate exposure?",
      a: "Model index paths, cap expiration, extension triggers, and refinance timing under multiple rate scenarios—not a single forward curve.",
    },
    {
      q: "When should refinance planning start on bridge deals?",
      a: "At or before closing, with milestones tied to NOI stabilization and lender takeout criteria documented in the operating plan.",
    },
    {
      q: "What reserve logic helps manage rate risk?",
      a: "Liquidity buffers for debt service, capex, and extension fees can preserve optionality when rates or NOI move against the plan.",
    },
  ],
  "stabilized-vs-transitional-assets": [
    {
      q: "How do lenders classify stabilized versus transitional assets?",
      a: "Classification follows occupancy durability, NOI consistency, and whether remaining value creation depends on capex or lease-up execution.",
    },
    {
      q: "Can an asset be transitional even with strong occupancy?",
      a: "Yes—when effective rents, capital needs, or expense normalization still require a defined business plan before permanent debt fits.",
    },
    {
      q: "Why does asset classification affect lender options?",
      a: "Transitional assets may qualify for bridge or debt-fund paths that stabilized assets cannot access without retrade or pricing penalty.",
    },
  ],
  "five-plus-unit-commercial-financing-basics": [
    {
      q: "Why does five-plus unit financing differ from residential lending?",
      a: "Commercial multifamily lenders underwrite property NOI, sponsorship, and business-plan risk—not primarily borrower W-2 income on small residential loans.",
    },
    {
      q: "What should first-time commercial borrowers prepare?",
      a: "Entity documentation, guarantor financials, lender-ready NOI views, and a realistic timeline for stabilization or refinance.",
    },
  ],
  "entity-structure-for-multifamily-borrowing": [
    {
      q: "When should sponsors finalize entity structure?",
      a: "Before formal lender submission when possible—late entity changes can delay legal review and closing timelines.",
    },
    {
      q: "How do guarantor frameworks affect term sheets?",
      a: "Recourse scope, liquidity requirements, and experience thresholds often move with entity type and sponsorship structure.",
    },
  ],
  "multifamily-cash-out-refinance": [
    {
      q: "What metrics constrain cash-out refinance proceeds?",
      a: "Lenders typically size cash-out refinances using the same DSCR, debt yield, and LTV constraints as acquisitions, often with additional haircuts on proceeds.",
    },
    {
      q: "When is cash-out refinance harder to execute?",
      a: "Thin NOI growth, recent large distributions, or floating-rate debt with limited headroom can reduce lender appetite for maximum proceeds.",
    },
  ],
};

const GUIDE_FAQS_ES = {
  "agency-vs-bridge-execution": [
    {
      q: "¿Cuándo conviene elegir deuda agency frente a bridge?",
      a: "Agency encaja con NOI estabilizado, flujo predecible y holds largos donde la certeza de precio importa más que la flexibilidad a corto plazo.",
    },
    {
      q: "¿Qué señales indican que bridge es la mejor vía?",
      a: "Bridge suele encajar cuando un plan creíble de value-add o lease-up necesita desembolsos antes de que el flujo estabilizado soporte deuda permanente.",
    },
    {
      q: "¿Cómo comparar el costo total entre vías?",
      a: "Modele comisiones, reservas, economía de extensiones y restricciones de prepago en todo el hold—no solo el cupón inicial.",
    },
  ],
  "capital-stack-design-for-value-add": [
    {
      q: "¿Qué estructura de equity y pref encaja en value-add?",
      a: "La mayoría combina deuda senior con equity del patrocinador y a veces pref dimensionado al riesgo de hitos—no hay una plantilla única.",
    },
    {
      q: "¿Cómo secuenciar decisiones de deuda y equity?",
      a: "Defina hitos del plan de negocio primero y elija deuda que preserve opcionalidad de refinanciamiento o disposición si la operación se retrasa.",
    },
    {
      q: "¿Cuándo revisar supuestos del capital stack?",
      a: "Revise cuando el ritmo de capex, el lease-up o los spreads de refinanciamiento se alejen materialmente de los supuestos del term sheet.",
    },
  ],
  "commercial-dscr-explained": [
    {
      q: "¿Cómo pensar en los pisos de DSCR del prestamista?",
      a: "Los umbrales varían por producto y mercado; modele cobertura con ajustes de NOI del prestamista—no solo el DSCR de la hoja del patrocinador.",
    },
    {
      q: "¿Cómo mejorar el DSCR antes del refinanciamiento?",
      a: "Mejoras duraderas de NOI por ocupación, renta efectiva y control de gastos suelen importar más que un crecimiento pro forma optimista.",
    },
    {
      q: "¿Por qué difieren DSCR del prestamista y del patrocinador?",
      a: "Los prestamistas pueden recortar ingresos, estresar gastos, incluir reservas y usar supuestos de servicio de deuda distintos.",
    },
  ],
  "debt-yield-and-ltv-framework": [
    {
      q: "¿Cómo interactúan debt yield y LTV en el dimensionamiento?",
      a: "Los prestamistas suelen aplicar ambos y dimensionar por la restricción más ajustada, especialmente cuando la durabilidad del NOI es incierta.",
    },
    {
      q: "¿Qué métrica suele limitar primero en activos estabilizados?",
      a: "En muchas ejecuciones estabilizadas, el apalancamiento o debt yield puede limitar antes que el DSCR según cupón, calidad de NOI y programa.",
    },
    {
      q: "¿Cómo usar debt yield en negociación de term sheets?",
      a: "Presente debt yield in-place y estabilizado con respaldo para que el comité valide desembolsos sin preguntas repetidas sobre NOI.",
    },
  ],
  "multifamily-close-checklist": [
    {
      q: "¿Qué retrasa con más frecuencia los cierres multifamiliares?",
      a: "Diligencia tardía, vacíos en documentación de entidad o garante y cambios de supuestos durante la revisión crediticia son causas frecuentes.",
    },
    {
      q: "¿Cuándo empezar a armar el paquete de cierre?",
      a: "Organice seguros, estoppel, documentos de entidad e informes de terceros pronto—idealmente antes de la selección final del prestamista.",
    },
    {
      q: "¿Qué confirmar en la semana final antes del cierre?",
      a: "Concilie NOI, dimensionamiento, reservas y seguros con el memo crediticio aprobado para evitar retrades de último momento.",
    },
  ],
  "multifamily-noi-normalization": [
    {
      q: "¿Qué documentar antes del cierre?",
      a: "Vincule cada ajuste de NOI a documentos fuente y explique el timing de ítems de estabilización que el prestamista probará post-cierre.",
    },
    {
      q: "¿Qué gastos generan más objeciones del prestamista?",
      a: "Nómina, utilities, renovaciones de seguro y expectativas de impuesto a la propiedad suelen generar debate cuando el respaldo es débil.",
    },
    {
      q: "¿Cómo tratar ingresos o gastos únicos?",
      a: "Etiquete ítems como recurrentes, no recurrentes o transicionales y explique por qué van en NOI in-place versus estabilizado.",
    },
  ],
  "multifamily-underwriting-basics": [
    {
      q: "¿Qué esperan los prestamistas en la primera presentación?",
      a: "Vistas claras de NOI in-place y estabilizado, rent roll, cronograma del plan de negocio y sensibilidad a la baja en métricas clave.",
    },
    {
      q: "¿Cómo prepararse para preguntas del comité de crédito?",
      a: "Anticipe cuestionamientos sobre ocupación, concesiones, capex y refinanciamiento con respuestas documentadas.",
    },
    {
      q: "¿Por qué importa el escenario a la baja antes de elegir prestamista?",
      a: "Deals que solo funcionan en caso base suelen renegociarse tarde; probar ocupación, gastos y tasas temprano mejora certeza de ejecución.",
    },
  ],
  "operator-reporting-for-lenders": [
    {
      q: "¿Qué debe incluir el reporte mensual al prestamista?",
      a: "Ocupación, rentas efectivas, concesiones, morosidad, variación de gastos, capex y margen de covenant con comentario breve.",
    },
    {
      q: "¿Cuándo contactar proactivamente al prestamista?",
      a: "Antes de que la presión de covenant sea aguda—especialmente si ocupación, NOI o plazos de refinanciamiento se desvían del plan aprobado.",
    },
    {
      q: "¿Cómo afecta la calidad del reporte al refinanciamiento?",
      a: "Reportes consistentes y transparentes suelen mejorar la confianza del prestamista y acelerar conversaciones de takeout cuando las métricas van bien.",
    },
  ],
  "rate-risk-and-refinance-planning": [
    {
      q: "¿Cómo planificar exposición a tasa flotante?",
      a: "Modele trayectorias del índice, vencimiento de caps, triggers de extensión y timing de refinanciamiento en varios escenarios—no una sola curva.",
    },
    {
      q: "¿Cuándo empezar a planificar refinanciamiento en bridge?",
      a: "En o antes del cierre, con hitos ligados a estabilización de NOI y criterios de takeout documentados en el plan operativo.",
    },
    {
      q: "¿Qué lógica de reservas ayuda con riesgo de tasa?",
      a: "Buffers de liquidez para servicio de deuda, capex y extensiones pueden preservar opcionalidad cuando tasas o NOI se mueven en contra.",
    },
  ],
  "stabilized-vs-transitional-assets": [
    {
      q: "¿Cómo clasifican prestamistas activos estabilizados vs transicionales?",
      a: "La clasificación sigue durabilidad de ocupación, consistencia de NOI y si el valor restante depende de capex o lease-up.",
    },
    {
      q: "¿Puede un activo ser transicional con buena ocupación?",
      a: "Sí—cuando rentas efectivas, necesidades de capital o normalización de gastos aún requieren un plan antes de deuda permanente.",
    },
    {
      q: "¿Por qué afecta la clasificación las opciones de prestamista?",
      a: "Activos transicionales pueden calificar a bridge o debt fund que activos estabilizados no acceden sin retrade o penalización de precio.",
    },
  ],
  "five-plus-unit-commercial-financing-basics": [
    {
      q: "¿Por qué difiere el financiamiento de 5+ unidades del residencial?",
      a: "Los prestamistas comerciales suscriben NOI de la propiedad, patrocinio y riesgo del plan—no principalmente ingreso W-2 como en préstamos residenciales pequeños.",
    },
    {
      q: "¿Qué debe preparar un primer comprador comercial?",
      a: "Documentación de entidad, financieros del garante, vistas de NOI listas para prestamista y cronograma realista de estabilización o refinanciamiento.",
    },
  ],
  "entity-structure-for-multifamily-borrowing": [
    {
      q: "¿Cuándo finalizar la estructura de entidad?",
      a: "Antes de la presentación formal al prestamista cuando sea posible—cambios tardíos pueden retrasar revisión legal y cierre.",
    },
    {
      q: "¿Cómo afectan los garantes los term sheets?",
      a: "Alcance de recurso, requisitos de liquidez y umbrales de experiencia suelen moverse con el tipo de entidad y estructura del patrocinador.",
    },
  ],
  "multifamily-cash-out-refinance": [
    {
      q: "¿Qué métricas limitan desembolsos en cash-out refinance?",
      a: "Los prestamistas suelen dimensionar cash-out con las mismas restricciones de DSCR, debt yield y LTV que adquisiciones, a menudo con recortes adicionales.",
    },
    {
      q: "¿Cuándo es más difícil ejecutar cash-out refinance?",
      a: "NOI delgado, distribuciones recientes grandes o deuda flotante con poco margen pueden reducir apetito por máximos desembolsos.",
    },
  ],
};

function getGuideSlug(relPath) {
  return path.basename(relPath, ".mdx");
}

function additionsForFile(relPath, frontmatter) {
  const es = isSpanish(relPath);
  const collection = collectionFromPath(relPath);
  const slug = getGuideSlug(relPath);
  const current = countFaqs(frontmatter);
  const needed = Math.max(0, TARGET_COUNT - current);
  if (needed === 0) return [];

  if (collection === "guides") {
    const map = es ? GUIDE_FAQS_ES : GUIDE_FAQS_EN;
    const items = map[slug] ?? [];
    return items.slice(0, needed);
  }

  if (collection === "states") {
    const stateName = parseField(frontmatter, "stateName");
    const foreclosureType = parseField(frontmatter, "foreclosureType");
    const rentControl = parseBooleanField(frontmatter, "rentControl");
    const hasStateIncomeTax = parseBooleanField(frontmatter, "hasStateIncomeTax");
    const statePropertyTax = parseNumberField(frontmatter, "statePropertyTax");
    const avgCapRate = parseNumberField(frontmatter, "avgCapRate");
    const topMarkets = parseField(frontmatter, "topMarkets");

    if (es) {
      return [
        {
          q: `¿Qué factores legales y fiscales importan en ${stateName}?`,
          a: `Los patrocinadores deben abordar temprano el marco de ejecución hipotecaria (${foreclosureType}), el contexto fiscal a la propiedad${statePropertyTax ? ` cerca del ${statePropertyTax}%` : ""}, ${rentControl ? "control de rentas aplicable" : "ausencia de control de rentas estatal"}, y las implicaciones de ${hasStateIncomeTax ? "impuesto estatal sobre la renta" : "ausencia de impuesto estatal sobre la renta"}.`,
        },
        {
          q: `¿Cómo usar el contexto de cap rate en ${stateName}?`,
          a: `Un cap rate direccional cerca del ${avgCapRate}% es solo punto de partida; los prestamistas suelen exigir comps de submercado y NOI específico del activo${topMarkets ? ` en corredores como ${topMarkets.replace(/^\[|- /g, "").slice(0, 60)}` : ""}.`,
        },
      ].slice(0, needed);
    }

    return [
      {
        q: `What legal and tax factors matter in ${stateName} underwriting?`,
        a: `Sponsors should address ${stateName}'s ${foreclosureType} foreclosure framework, property-tax context${statePropertyTax ? ` near ${statePropertyTax}%` : ""}, ${rentControl ? "applicable rent-control rules" : "the absence of statewide rent control"}, and ${hasStateIncomeTax ? "state income tax" : "no state income tax"} implications early in diligence.`,
      },
      {
        q: `How should sponsors use statewide cap-rate context in ${stateName}?`,
        a: `Directional cap-rate context near ${avgCapRate}% is a starting point only; lenders usually require submarket comps and property-specific NOI support rather than statewide averages alone.`,
      },
    ].slice(0, needed);
  }

  if (collection === "cities") {
    const cityName = parseField(frontmatter, "cityName");
    const medianPricePerUnit = parseNumberField(frontmatter, "medianPricePerUnit");
    const medianRentPerUnit = parseNumberField(frontmatter, "medianRentPerUnit");
    const typicalCapRate = parseNumberField(frontmatter, "typicalCapRate");

    if (es) {
      return [
        {
          q: `¿Qué contexto de precios conviene citar en ${cityName}?`,
          a: `Precio mediano cerca de $${medianPricePerUnit?.toLocaleString("en-US")} por unidad y cap rates típicos alrededor del ${typicalCapRate}% son referencias direccionales; los comps de barrio siguen guiando la valoración del prestamista.`,
        },
        {
          q: `¿Qué supuestos de renta necesitan respaldo local en ${cityName}?`,
          a: `Renta mediana cerca de $${medianRentPerUnit?.toLocaleString("en-US")} por unidad enmarca conversaciones, pero los prestamistas esperan evidencia a nivel de lease, tendencias de concesiones y rotación del activo.`,
        },
      ].slice(0, needed);
    }

    return [
      {
        q: `What pricing context should sponsors cite for ${cityName} deals?`,
        a: `Median pricing near $${medianPricePerUnit?.toLocaleString("en-US")} per unit and typical cap rates around ${typicalCapRate}% are directional baselines—neighborhood-level comps still drive lender value opinions.`,
      },
      {
        q: `What rent assumptions need local support in ${cityName}?`,
        a: `Median rent near $${medianRentPerUnit?.toLocaleString("en-US")} per unit can frame conversations, but lenders expect lease-level evidence, concession trends, and turnover data for the subject asset.`,
      },
    ].slice(0, needed);
  }

  if (collection === "loan-types") {
    const loanType = parseField(frontmatter, "loanType") ?? parseField(frontmatter, "title");
    const typicalLeverage = parseField(frontmatter, "typicalLeverage");
    const targetHoldPeriod = parseField(frontmatter, "targetHoldPeriod");

    if (es) {
      return [
        {
          q: "¿Qué rango de apalancamiento es típico para este producto?",
          a: `Muchas ejecuciones apuntan aproximadamente a ${typicalLeverage} de apalancamiento, pero los desembolsos siguen dependiendo de DSCR, debt yield, calidad del activo y profundidad del patrocinador al momento de la cotización.`,
        },
        {
          q: `¿Qué supuestos de hold encajan con ${loanType}?`,
          a: `Los patrocinadores suelen modelar un hold de ${targetHoldPeriod}, pero deben incluir escenarios de extensión, prepago y refinanciamiento si el plan se retrasa.`,
        },
      ].slice(0, needed);
    }

    return [
      {
        q: "What leverage range is typical for this product?",
        a: `Many executions target roughly ${typicalLeverage} leverage, but proceeds still depend on DSCR, debt yield, asset quality, and sponsorship depth at the time of quote.`,
      },
      {
        q: `What hold-period assumptions fit ${loanType}?`,
        a: `Sponsors often underwrite toward a ${targetHoldPeriod} hold, but should model extension, prepayment, and refinance paths if the business plan slips.`,
      },
    ].slice(0, needed);
  }

  if (collection === "comparisons") {
    const productA = parseField(frontmatter, "productA");
    const productB = parseField(frontmatter, "productB");

    if (es) {
      return [
        {
          q: `¿Cuándo suele encajar mejor ${productA}?`,
          a: `${productA} tiende a encajar cuando la durabilidad del flujo, certeza de precio y objetivos de hold largo se alinean con las fortalezas de suscripción de esa estructura.`,
        },
        {
          q: `¿Cuándo tiene más sentido ${productB}?`,
          a: `${productB} puede encajar con plazos transicionales, alcance de value-add o necesidades de flexibilidad que estructuras permanentes no suelen sostener sin riesgo de retrade.`,
        },
      ].slice(0, needed);
    }

    return [
      {
        q: `When is ${productA} usually the better fit?`,
        a: `${productA} tends to fit when cash-flow durability, pricing certainty, and long-term hold objectives align with that structure's underwriting strengths.`,
      },
      {
        q: `When does ${productB} make more sense?`,
        a: `${productB} may fit transitional timelines, value-add scope, or flexibility needs that permanent structures cannot support without retrade risk.`,
      },
    ].slice(0, needed);
  }

  if (collection === "property-types") {
    const propertyType = parseField(frontmatter, "propertyType");
    const typicalCapRateBand = parseField(frontmatter, "typicalCapRateBand");
    const minUnits = parseNumberField(frontmatter, "minUnits") ?? 5;

    if (es) {
      return [
        {
          q: `¿Qué banda de cap rate es típica para ${propertyType}?`,
          a: `Bandas direccionales cerca de ${typicalCapRateBand} varían por mercado, condición y ocupación; los prestamistas siguen suscribiendo al NOI específico del activo.`,
        },
        {
          q: "¿Qué mínimo de unidades aplica a esta guía?",
          a: `Esta guía se centra en financiamiento multifamiliar comercial para activos con al menos ${minUnits} unidades; préstamos residenciales más pequeños quedan fuera del alcance de este sitio.`,
        },
      ].slice(0, needed);
    }

    return [
      {
        q: `What cap-rate band is typical for ${propertyType}?`,
        a: `Directional cap-rate bands near ${typicalCapRateBand} vary by market, condition, and occupancy—lenders still underwrite to asset-specific NOI.`,
      },
      {
        q: "What minimum unit count applies to this property type guide?",
        a: `This guide focuses on commercial multifamily financing for assets with at least ${minUnits} units; smaller residential lending is outside this site's scope.`,
      },
    ].slice(0, needed);
  }

  if (collection === "investor-profiles") {
    const profile = parseField(frontmatter, "profile");

    if (es) {
      return [
        {
          q: `¿Qué errores de estructura de capital debe evitar el perfil ${profile}?`,
          a: "Sobreapalancarse antes de madurar sistemas operativos, omitir pruebas a la baja y retrasar planificación de refinanciamiento son errores frecuentes en este perfil.",
        },
        {
          q: `¿Cómo priorizar relaciones con prestamistas como ${profile}?`,
          a: "Construya suscripción conservadora y reportes repetibles antes de escalar volumen; la confianza del prestamista suele seguir ejecución consistente más que cantidad de transacciones.",
        },
      ].slice(0, needed);
    }

    return [
      {
        q: `What capital structure mistakes should ${profile} operators avoid?`,
        a: "Over-leveraging before operational systems mature, skipping downside testing, and delaying refinance planning are common pitfalls for this profile.",
      },
      {
        q: `How should ${profile} operators prioritize lender relationships?`,
        a: "Build repeatable reporting and conservative underwriting before expanding volume—lender trust usually follows consistent execution more than transaction count.",
      },
    ].slice(0, needed);
  }

  return [];
}

let updated = 0;
let skipped = 0;

for (const filePath of walk(CONTENT_ROOT)) {
  const rel = filePath.replace(`${CONTENT_ROOT}/`, "");
  const content = fs.readFileSync(filePath, "utf8");
  const parts = content.split("---");
  if (parts.length < 3 || !parts[1].includes("faq:")) continue;

  const frontmatter = parts[1];
  const current = countFaqs(frontmatter);
  if (current >= TARGET_COUNT) {
    skipped++;
    continue;
  }

  const additions = additionsForFile(rel, frontmatter);
  if (additions.length === 0) {
    console.warn("No additions for", rel, `(count=${current})`);
    continue;
  }

  const next = appendFaqs(content, additions);
  if (next !== content) {
    fs.writeFileSync(filePath, next);
    updated++;
    console.log(`Updated ${rel}: ${current} -> ${current + additions.length}`);
  }
}

console.log(`Done. Updated ${updated} files, skipped ${skipped} already at target.`);
