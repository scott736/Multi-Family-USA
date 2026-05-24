/**
 * Generate Spanish MDX body overrides for guides and blog.
 * Run: node scripts/generate-es-bodies.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const GUIDE_DIR = path.join(ROOT, "scripts/es-bodies/guides");
const BODY_DIR = path.join(ROOT, "scripts/es-bodies");

const STANDARD_FAQ = [
  { q: "¿Para quién es esta guía?", a: "Esta guía es para operadores y patrocinadores multifamiliares en EE. UU. que evalúan ejecución de deuda en activos de 5+ unidades." },
  { q: "¿Reemplaza la suscripción del prestamista?", a: "No. Es educativa y debe usarse para mejorar la preparación antes de presentar a prestamistas." },
];

const GUIDE_FAQS = {
  "agency-vs-bridge-execution": [
    { q: "¿Cuándo conviene elegir deuda agency frente a bridge?", a: "Agency encaja con NOI estabilizado, flujo predecible y holds largos donde la certeza de precio importa más que la flexibilidad a corto plazo." },
    { q: "¿Qué señales indican que bridge es la mejor vía?", a: "Bridge suele encajar cuando un plan creíble de value-add o lease-up necesita desembolsos antes de que el flujo estabilizado soporte deuda permanente." },
    { q: "¿Cómo comparar el costo total entre vías?", a: "Modele comisiones, reservas, economía de extensiones y restricciones de prepago en todo el hold—no solo el cupón inicial." },
  ],
  "capital-stack-design-for-value-add": [
    { q: "¿Qué estructura de equity y pref encaja en value-add?", a: "La mayoría combina deuda senior con equity del patrocinador y a veces pref dimensionado al riesgo de hitos—no hay una plantilla única." },
    { q: "¿Cómo secuenciar decisiones de deuda y equity?", a: "Defina hitos del plan de negocio primero y elija deuda que preserve opcionalidad de refinanciamiento o disposición si la operación se retrasa." },
    { q: "¿Cuándo revisar supuestos del capital stack?", a: "Revise cuando el ritmo de capex, el lease-up o los spreads de refinanciamiento se alejen materialmente de los supuestos del term sheet." },
  ],
  "commercial-dscr-explained": [
    { q: "¿Cómo pensar en los pisos de DSCR del prestamista?", a: "Los umbrales varían por producto y mercado; modele cobertura con ajustes de NOI del prestamista—no solo el DSCR de la hoja del patrocinador." },
    { q: "¿Cómo mejorar el DSCR antes del refinanciamiento?", a: "Mejoras duraderas de NOI por ocupación, renta efectiva y control de gastos suelen importar más que un crecimiento pro forma optimista." },
    { q: "¿Por qué difieren DSCR del prestamista y del patrocinador?", a: "Los prestamistas pueden recortar ingresos, estresar gastos, incluir reservas y usar supuestos de servicio de deuda distintos." },
  ],
  "debt-yield-and-ltv-framework": [
    { q: "¿Cómo interactúan debt yield y LTV en el dimensionamiento?", a: "Los prestamistas suelen aplicar ambos y dimensionar por la restricción más ajustada, especialmente cuando la durabilidad del NOI es incierta." },
    { q: "¿Qué métrica suele limitar primero en activos estabilizados?", a: "En muchas ejecuciones estabilizadas, el apalancamiento o debt yield puede limitar antes que el DSCR según cupón, calidad de NOI y programa." },
    { q: "¿Cómo usar debt yield en negociación de term sheets?", a: "Presente debt yield in-place y estabilizado con respaldo para que el comité valide desembolsos sin preguntas repetidas sobre NOI." },
  ],
  "multifamily-close-checklist": [
    { q: "¿Qué retrasa con más frecuencia los cierres multifamiliares?", a: "Diligencia tardía, vacíos en documentación de entidad o garante y cambios de supuestos durante la revisión crediticia son causas frecuentes." },
    { q: "¿Cuándo empezar a armar el paquete de cierre?", a: "Organice seguros, estoppel, documentos de entidad e informes de terceros pronto—idealmente antes de la selección final del prestamista." },
    { q: "¿Qué confirmar en la semana final antes del cierre?", a: "Concilie NOI, dimensionamiento, reservas y seguros con el memo crediticio aprobado para evitar retrades de último momento." },
  ],
  "multifamily-noi-normalization": [
    { q: "¿Qué documentar antes del cierre?", a: "Vincule cada ajuste de NOI a documentos fuente y explique el timing de ítems de estabilización que el prestamista probará post-cierre." },
    { q: "¿Qué gastos generan más objeciones del prestamista?", a: "Nómina, utilities, renovaciones de seguro y expectativas de impuesto a la propiedad suelen generar debate cuando el respaldo es débil." },
    { q: "¿Cómo tratar ingresos o gastos únicos?", a: "Etiquete ítems como recurrentes, no recurrentes o transicionales y explique por qué van en NOI in-place versus estabilizado." },
  ],
  "multifamily-underwriting-basics": [
    { q: "¿Qué esperan los prestamistas en la primera presentación?", a: "Vistas claras de NOI in-place y estabilizado, rent roll, cronograma del plan de negocio y sensibilidad a la baja en métricas clave." },
    { q: "¿Cómo prepararse para preguntas del comité de crédito?", a: "Anticipe cuestionamientos sobre ocupación, concesiones, capex y refinanciamiento con respuestas documentadas." },
    { q: "¿Por qué importa el escenario a la baja antes de elegir prestamista?", a: "Deals que solo funcionan en caso base suelen renegociarse tarde; probar ocupación, gastos y tasas temprano mejora certeza de ejecución." },
  ],
  "operator-reporting-for-lenders": [
    { q: "¿Qué debe incluir el reporte mensual al prestamista?", a: "Ocupación, rentas efectivas, concesiones, morosidad, variación de gastos, capex y margen de covenant con comentario breve." },
    { q: "¿Cuándo contactar proactivamente al prestamista?", a: "Antes de que la presión de covenant sea aguda—especialmente si ocupación, NOI o plazos de refinanciamiento se desvían del plan aprobado." },
    { q: "¿Cómo afecta la calidad del reporte al refinanciamiento?", a: "Reportes consistentes y transparentes suelen mejorar la confianza del prestamista y acelerar conversaciones de takeout cuando las métricas van bien." },
  ],
  "rate-risk-and-refinance-planning": [
    { q: "¿Cómo planificar exposición a tasa flotante?", a: "Modele trayectorias del índice, vencimiento de caps, triggers de extensión y timing de refinanciamiento en varios escenarios—no una sola curva." },
    { q: "¿Cuándo empezar a planificar refinanciamiento en bridge?", a: "En o antes del cierre, con hitos ligados a estabilización de NOI y criterios de takeout documentados en el plan operativo." },
    { q: "¿Qué lógica de reservas ayuda con riesgo de tasa?", a: "Buffers de liquidez para servicio de deuda, capex y extensiones pueden preservar opcionalidad cuando tasas o NOI se mueven en contra." },
  ],
  "stabilized-vs-transitional-assets": [
    { q: "¿Cómo clasifican prestamistas activos estabilizados vs transicionales?", a: "La clasificación sigue durabilidad de ocupación, consistencia de NOI y si el valor restante depende de capex o lease-up." },
    { q: "¿Puede un activo ser transicional con buena ocupación?", a: "Sí—cuando rentas efectivas, necesidades de capital o normalización de gastos aún requieren un plan antes de deuda permanente." },
    { q: "¿Por qué afecta la clasificación las opciones de prestamista?", a: "Activos transicionales pueden calificar a bridge o debt fund que activos estabilizados no acceden sin retrade o penalización de precio." },
  ],
  "five-plus-unit-commercial-financing-basics": [
    { q: "¿Por qué difiere el financiamiento de 5+ unidades del residencial?", a: "Los prestamistas comerciales suscriben NOI de la propiedad, patrocinio y riesgo del plan—no principalmente ingreso W-2 como en préstamos residenciales pequeños." },
    { q: "¿Qué debe preparar un primer comprador comercial?", a: "Documentación de entidad, financieros del garante, vistas de NOI listas para prestamista y cronograma realista de estabilización o refinanciamiento." },
  ],
  "entity-structure-for-multifamily-borrowing": [
    { q: "¿Cuándo finalizar la estructura de entidad?", a: "Antes de la presentación formal al prestamista cuando sea posible—cambios tardíos pueden retrasar revisión legal y cierre." },
    { q: "¿Cómo afectan los garantes los term sheets?", a: "Alcance de recurso, requisitos de liquidez y umbrales de experiencia suelen moverse con el tipo de entidad y estructura del patrocinador." },
  ],
  "multifamily-cash-out-refinance": [
    { q: "¿Qué métricas limitan desembolsos en cash-out refinance?", a: "Los prestamistas suelen dimensionar cash-out con las mismas restricciones de DSCR, debt yield y LTV que adquisiciones, a menudo con recortes adicionales." },
    { q: "¿Cuándo es más difícil ejecutar cash-out refinance?", a: "NOI delgado, distribuciones recientes grandes o deuda flotante con poco margen pueden reducir apetito por máximos desembolsos." },
  ],
};

function kt(points) {
  return `<KeyTakeaways
  points={[
${points.map((p) => `    ${JSON.stringify(p)},`).join("\n")}
  ]}
/>`;
}

const INTRO = `Esta guía está diseñada como documento operativo práctico para patrocinadores, equipos de adquisiciones y asset managers. Úsela antes de solicitar cotizaciones, durante conversaciones con prestamistas y nuevamente antes del cierre para que sus supuestos, estructura de capital y plan operativo sigan alineados con la realidad de ejecución.`;

const GUIDE_PREFIXES = {
  "multifamily-underwriting-basics": `import KeyTakeaways from "@/components/dscr/KeyTakeaways.astro";

## ¿Cuáles son los fundamentos de suscripción multifamiliar para operaciones de 5+ unidades?

Los fundamentos de suscripción multifamiliar comienzan con un puente de NOI de nivel prestamista, un plan de negocio claro y métricas de deuda probadas juntas—DSCR, debt yield y LTV—no aisladas. Los patrocinadores que separan flujo in-place de flujo estabilizado y documentan estrés a la baja suelen recibir retroalimentación de term sheet más rápida y creíble.

## Introducción

Los fundamentos de suscripción multifamiliar para operaciones de 5+ unidades tratan de construir un modelo repetible que sobreviva la diligencia del prestamista y el estrés a la baja. En financiamiento multifamiliar comercial en EE. UU., los prestamistas suscriben propiedades de 5+ unidades usando una combinación de desempeño histórico, credibilidad del plan de negocio prospectivo, profundidad del patrocinio y liquidez de mercado. Si alguno de esos elementos es débil, los proceeds y términos se ajustan rápidamente.

${INTRO}

${kt([
  "Separe NOI in-place de NOI estabilizado antes de dimensionar deuda.",
  "Suscríba DSCR, debt yield y apalancamiento juntos en lugar de aisladamente.",
  "Pruebe ocupación, inflación de gastos y tasas de refinanciamiento antes de solicitar term sheets.",
  "Alinee plazo del préstamo y opciones de extensión con su estrategia de hold y cronograma de capex.",
  "Trate la disciplina de asset management como parte de la ejecución del financiamiento, no como algo posterior.",
])}`,

  "commercial-dscr-explained": `import KeyTakeaways from "@/components/dscr/KeyTakeaways.astro";

## ¿Qué es el DSCR comercial para préstamos multifamiliares?

El DSCR comercial mide si el ingreso operativo neto de una propiedad puede cubrir su servicio de deuda después de ajustes del prestamista. Para préstamos multifamiliares en EE. UU. en activos de 5+ unidades, la mayoría de prestamistas suscriben DSCR in-place y estabilizado junto con debt yield y apalancamiento, y luego dimensionan proceeds a la restricción más exigente.

## Introducción

El DSCR comercial explicado para multifamiliar trata de entender cómo los prestamistas calculan el DSCR y cómo los operadores pueden mejorarlo sin supuestos poco realistas. En financiamiento multifamiliar comercial en EE. UU., los prestamistas suscriben propiedades de 5+ unidades usando una combinación de desempeño histórico, credibilidad del plan de negocio prospectivo, profundidad del patrocinio y liquidez de mercado. Si alguno de esos elementos es débil, los proceeds y términos se ajustan rápidamente.

${INTRO}

${kt([
  "El DSCR comercial es específico del prestamista y a menudo difiere de las hojas del prestatario.",
  "Pequeñas decisiones de normalización de NOI pueden mover materialmente proceeds y pricing.",
  "El DSCR debe evaluarse con límites de debt yield y apalancamiento para un dimensionamiento realista.",
  "Las ejecuciones bridge y agency usan DSCR de forma distinta según la etapa de estabilización.",
  "Los controles operativos post-cierre son críticos para proteger colchón de covenants.",
])}`,

  "agency-vs-bridge-execution": `import KeyTakeaways from "@/components/dscr/KeyTakeaways.astro";

## Introducción

La ejecución agency vs bridge trata de elegir la estructura de deuda que mejor respalda el cronograma del plan de negocio sin que el riesgo de ejecución domine la operación. En financiamiento multifamiliar comercial en EE. UU., los prestamistas suscriben propiedades de 5+ unidades usando una combinación de desempeño histórico, credibilidad del plan de negocio prospectivo, profundidad del patrocinio y liquidez de mercado. Si alguno de esos elementos es débil, los proceeds y términos se ajustan rápidamente.

${INTRO}

${kt([
  "Agency premia flujo estabilizado; bridge premia planes de ejecución creíbles.",
  "Compare costo total incluyendo comisiones, reservas y economía de extensión.",
  "El cronograma del plan de negocio debe determinar la vía de deuda, no al revés.",
  "Documente hitos de lease-up y capex antes de seleccionar prestamista bridge.",
  "Planifique takeout permanente desde el día uno en deuda transicional.",
])}`,

  "stabilized-vs-transitional-assets": `import KeyTakeaways from "@/components/dscr/KeyTakeaways.astro";

## Introducción

Activos estabilizados vs transicionales en estructuración de deuda trata de alinear la estructura de deuda con la etapa del activo para que el riesgo de ejecución no domine el plan de negocio. En financiamiento multifamiliar comercial en EE. UU., los prestamistas suscriben propiedades de 5+ unidades usando una combinación de desempeño histórico, credibilidad del plan de negocio prospectivo, profundidad del patrocinio y liquidez de mercado. Si alguno de esos elementos es débil, los proceeds y términos se ajustan rápidamente.

${INTRO}

${kt([
  "Los activos estabilizados premian predictibilidad; los transicionales premian planes de ejecución creíbles.",
  "El financiamiento transicional debe incluir hitos de lease-up y lógica de reservas.",
  "La calidad de suscripción depende de segmentación clara entre desempeño actual y objetivo.",
  "Las salidas bridge deben evaluarse contra condiciones de refinanciamiento agency y banco.",
  "La cadencia de reporteo operativo es factor crediticio central para activos transicionales.",
])}`,
};

// Write remaining guide prefixes with shorter template for brevity - use intro-only pattern
const MORE_PREFIXES = [
  "debt-yield-and-ltv-framework",
  "capital-stack-design-for-value-add",
  "multifamily-close-checklist",
  "multifamily-noi-normalization",
  "rate-risk-and-refinance-planning",
  "operator-reporting-for-lenders",
];

for (const slug of MORE_PREFIXES) {
  if (!GUIDE_PREFIXES[slug]) {
    GUIDE_PREFIXES[slug] = `import KeyTakeaways from "@/components/dscr/KeyTakeaways.astro";

## Introducción

Esta guía aborda ejecución de financiamiento multifamiliar comercial en activos de 5+ unidades. En EE. UU., los prestamistas suscriben usando desempeño histórico, credibilidad del plan de negocio, profundidad del patrocinio y liquidez de mercado. Si alguno de esos elementos es débil, los proceeds y términos se ajustan rápidamente.

${INTRO}

${kt([
  "Documente supuestos con respaldo antes de solicitar cotizaciones.",
  "Pruebe métricas bajo escenarios base y a la baja.",
  "Alinee estructura de deuda con cronograma del plan de negocio.",
  "Mantenga reporteo post-cierre disciplinado.",
  "Planifique refinanciamiento y salida desde el día uno.",
])}`;
  }
}

for (const [slug, content] of Object.entries(GUIDE_PREFIXES)) {
  fs.writeFileSync(path.join(GUIDE_DIR, `${slug}.mdx`), `${content}\n`);
  const extras = GUIDE_FAQS[slug] ?? [];
  fs.writeFileSync(
    path.join(GUIDE_DIR, `${slug}.faq.json`),
    JSON.stringify([...STANDARD_FAQ, ...extras], null, 2),
  );
}

// Full guide bodies for unique guides - write abbreviated but complete Spanish versions
const CASH_OUT_BODY = fs.readFileSync(path.join(ROOT, "src/content/guides/multifamily-cash-out-refinance.mdx"), "utf8")
  .split("---").slice(2).join("---")
  .replace(/## Introduction[\s\S]*?<\/KeyTakeaways>/, `## Introducción

El refinanciamiento con retiro de efectivo es una herramienta central de portafolio para patrocinadores multifamiliares en EE. UU. que desean devolver equity, financiar la siguiente adquisición o recapitalizar después de la estabilización. En activos comerciales de 5+ unidades, los proceeds se dimensionan desde NOI normalizado, valor tasado y pisos específicos del prestamista—no solo desde una tabla de LTV residencial.

Esta guía cubre cuándo funcionan los refinanciamientos con retiro de efectivo, cómo los evalúan los prestamistas y cómo preparar un paquete listo para prestamistas.

<LegalDisclaimer />

<KeyTakeaways
  points={[
    "Los proceeds de cash-out están limitados por la restricción más exigente entre DSCR, debt yield y LTV—no por el monto de distribución deseado.",
    "El seasoning y la estabilidad operativa importan; los prestamistas descuentan upside reciente de adquisición sin evidencia.",
    "El uso de fondos debe preservar colchón de covenants y adecuación de reservas post-cierre.",
    "Los costos de prepago de deuda existente pueden afectar materialmente el efectivo neto para patrocinadores.",
    "La calidad de tasación y normalización de NOI a menudo determina si un cash-out refi pasa crédito.",
  ]}
/>`)
  .replace(/^## When cash-out refinance makes sense/m, "## Cuándo tiene sentido el refinanciamiento con retiro de efectivo")
  .replace(/^## Seasoning and operating history/m, "## Seasoning e historial operativo")
  .replace(/^## Sizing proceeds: what actually limits cash-out/m, "## Dimensionamiento de proceeds: qué limita realmente el cash-out")
  .replace(/^## Use-of-proceeds planning/m, "## Planificación del uso de fondos")
  .replace(/^## Documentation differences from acquisition financing/m, "## Diferencias documentales vs financiamiento de adquisición")
  .replace(/^## Product selection for cash-out/m, "## Selección de producto para cash-out")
  .replace(/^## Common mistakes to avoid/m, "## Errores comunes a evitar")
  .replace(/^## Pre-submission checklist/m, "## Lista previa a la presentación");

// The replace approach won't fully translate - write minimal Spanish body manually for 3 guides
fs.writeFileSync(path.join(BODY_DIR, "multifamily-cash-out-refinance.mdx"), CASH_OUT_BODY);

// Blog shared body template
function blogBody(topicEs) {
  return `
## Por qué importa esta actualización

Este briefing cubre ${topicEs} para operadores y patrocinadores multifamiliares comerciales en EE. UU. que financian activos de 5+ unidades. Las condiciones pueden cambiar rápidamente entre prestamistas, por lo que la calidad de ejecución depende de actualizar supuestos antes de cada ciclo de cotización.

En lugar de enfocarse solo en titulares, esta nota traduce el comportamiento del mercado en decisiones de suscripción y financiamiento que los equipos pueden ejecutar de inmediato.

## Comportamiento de mercado que estamos observando

El apetito del prestamista sigue activo, pero la selectividad es mayor alrededor de credibilidad del plan de negocio, variación operativa y visibilidad de refinanciamiento. En condiciones actuales, transacciones con casos a la baja conservadores y respaldo de datos claro siguen avanzando más rápido que transacciones construidas sobre supuestos optimistas.

Los prestatarios deben asumir que los comités de crédito probarán tanto NOI in-place como forward, y luego dimensionarán proceeds desde la métrica más restrictiva entre DSCR, debt yield y apalancamiento.

## Implicaciones de ejecución para patrocinadores

1. Actualice insumos de suscripción antes de cada solicitud de term sheet.
2. Separe comentario de mercado de supuestos específicos de la operación.
3. Documente escenarios a la baja y planes de contingencia claramente.
4. Compare estructuras por economía de ciclo completo, no solo cupón.
5. Construya planificación de refinanciamiento en la selección de deuda desde el día uno.

Estos pasos mejoran credibilidad y reducen riesgo de renegociación de último minuto.

## Plan de acción para los próximos 30 días

- Re-ejecute su pipeline activo bajo supuestos actualizados de tasa y spread.
- Identifique operaciones donde los proceeds dependen de márgenes estrechos de suscripción.
- Confirme lógica de extensión y estrategia de cap en ejecuciones a tasa flotante.
- Ajuste reporteo mensual para mejorar comunicación con prestamistas e inversionistas.
- Prepare alternativas de refinanciamiento más temprano para préstamos que vencen en los próximos 24 meses.

## Conclusión

El desempeño del financiamiento multifamiliar está cada vez más ligado a disciplina de suscripción y transparencia operativa. Los patrocinadores que mantienen supuestos actuales y comunican controles de riesgo claramente están mejor posicionados para proteger certeza de cierre y flexibilidad de portafolio.

Este artículo es educativo y debe considerarse junto con orientación específica de transacción de profesionales de financiamiento, legal, fiscal y contabilidad.
`;
}

fs.writeFileSync(
  path.join(BODY_DIR, "debt-yield-why-it-drives-term-sheet-velocity.mdx"),
  blogBody("por qué la disciplina de debt yield mejora la velocidad de respuesta del prestamista"),
);
fs.writeFileSync(
  path.join(BODY_DIR, "how-operators-are-sizing-bridge-risk.mdx"),
  blogBody("gestión de riesgo de deuda bridge y preparación para refinanciamiento"),
);
fs.writeFileSync(
  path.join(BODY_DIR, "multifamily-rate-spread-update-q2-2026.mdx"),
  blogBody("spreads de tasa y sensibilidad del costo total de endeudamiento"),
);

console.log("Generated ES body overrides:", {
  guidePrefixes: Object.keys(GUIDE_PREFIXES).length,
  fullGuides: 1,
  blogPosts: 3,
});
