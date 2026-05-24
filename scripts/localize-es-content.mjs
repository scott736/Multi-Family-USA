/**
 * Localize non-state ES MDX collections from English sources.
 * Run: node scripts/localize-es-content.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { SHARED_GUIDE_SECTIONS_ES, DSCR_SECTION_3_ES } from "./es-shared-guide-sections.mjs";

const ROOT = path.resolve(".");

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  const lines = m[1].split("\n");
  let key = null;
  let arr = null;
  for (const line of lines) {
    const kv = line.match(/^(\w+): (.+)$/);
    if (kv) {
      key = kv[1];
      arr = null;
      let val = kv[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    } else if (line.match(/^(\w+):$/)) {
      key = RegExp.$1;
      arr = [];
      fm[key] = arr;
    } else if (arr && line.match(/^  - "?(.+?)"?$/)) {
      arr.push(RegExp.$1);
    } else if (key === "faq" && line.match(/^- q: (.+)$/)) {
      if (!fm.faq) fm.faq = [];
      fm.faq.push({ q: RegExp.$1 });
    } else if (key === "faq" && fm.faq?.length && line.match(/^  a: (.+)$/)) {
      fm.faq[fm.faq.length - 1].a = RegExp.$1;
    }
  }
  return { fm, rawFm: m[1], body: content.slice(m[0].length) };
}

function formatPrice(n) {
  return Number(n).toLocaleString("en-US");
}

function formatFaqYaml(faq) {
  return faq
    .map(({ q, a }) => {
      const words = a.split(" ");
      const lines = [];
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 78 && current) {
          lines.push(current);
          current = word;
        } else current = next;
      }
      if (current) lines.push(current);
      const indented =
        lines.length === 1
          ? `  a: ${lines[0]}`
          : `  a: ${lines[0]}\n${lines.slice(1).map((l) => `    ${l}`).join("\n")}`;
      return `- q: ${q}\n${indented}`;
    })
    .join("\n");
}

function preserveRelated(rawFm) {
  const blocks = [];
  for (const key of [
    "relatedTools",
    "relatedGuides",
    "relatedStates",
    "relatedCities",
    "relatedLoanTypes",
    "relatedPropertyTypes",
    "relatedComparisons",
    "relatedInvestorProfiles",
    "relatedBlog",
    "tags",
  ]) {
    const re = new RegExp(`^${key}:\\n(?:- .+\\n)+`, "m");
    const m = rawFm.match(re);
    if (m) blocks.push(m[0].trimEnd());
  }
  return blocks.length ? `\n${blocks.join("\n")}` : "";
}

function buildCityEs(fm, slug) {
  const { cityName, stateName, stateCode } = fm;
  const cap = Number(fm.typicalCapRate);
  const price = Number(fm.medianPricePerUnit);
  const rent = Number(fm.medianRentPerUnit);
  const title = `Panorama de financiamiento multifamiliar en ${cityName}, ${stateCode}`;
  const description = `Panorama detallado de financiamiento para activos multifamiliares en ${cityName}, ${stateName} (5+ unidades), incluyendo suscripción y orientación de ejecución.`;
  const faq = [
    {
      q: `¿Qué hace diferente la suscripción en ${cityName} de los promedios estatales?`,
      a: `Los resultados de préstamo en ${cityName} suelen impulsarse por ocupación a nivel de vecindario, durabilidad de renta y presión de oferta más que por medianas amplias a nivel estatal.`,
    },
    {
      q: `¿Cómo deben dimensionar deuda los patrocinadores en ${cityName}?`,
      a: "Use restricciones de DSCR, debt yield y apalancamiento juntas en casos base y a la baja antes de seleccionar una vía de ejecución con prestamistas.",
    },
    {
      q: "¿Es viable deuda bridge en este mercado?",
      a: "La deuda bridge puede ser viable para activos transicionales cuando el alcance de renovación, plan de lease-up, reservas y estrategia de refinanciamiento están documentados claramente.",
    },
    {
      q: `¿Qué contexto de precios conviene citar en operaciones en ${cityName}?`,
      a: `Precio mediano cerca de $${formatPrice(price)} por unidad y cap rates típicos alrededor del ${cap}% son referencias direccionales; los comps de vecindario siguen guiando la opinión de valor del prestamista.`,
    },
    {
      q: `¿Qué supuestos de renta necesitan respaldo local en ${cityName}?`,
      a: `Renta mediana cerca de $${formatPrice(rent)} por unidad enmarca conversaciones, pero los prestamistas esperan evidencia a nivel de lease, tendencias de concesiones y rotación del activo.`,
    },
  ];
  const body = `
## Contexto de mercado multifamiliar en ${cityName}

${cityName}, ${stateName} es un mercado central de financiamiento multifamiliar en EE. UU. donde el apetito del prestamista puede mantenerse sólido tanto para activos estabilizados como transicionales de 5+ unidades. Los patrocinadores aún necesitan suscripción específica de mercado porque el desempeño del submercado puede divergir rápidamente incluso dentro de la misma metro.

Una línea base práctica de mercado para conversaciones con prestamistas es un cap rate típico alrededor del ${cap}%, precios medianos cerca de $${formatPrice(price)} por unidad y renta mediana cerca de $${formatPrice(rent)} por unidad. Esas cifras son direccionales y deben refinarse con evidencia de comps actual para su vecindario exacto.

## Estrategia de ejecución de financiamiento en ${cityName}

Para activos estabilizados, ejecuciones agency y de banco suelen competir en estructura y certeza. Para activos transicionales, prestamistas bridge pueden ofrecer flexibilidad, pero esperarán un plan creíble de mejora de NOI y supuestos realistas de extensión/refinanciamiento.

Antes de solicitar cotizaciones, prepare tanto un caso de NOI in-place como uno estabilizado. Esto permite a los equipos de crédito ver dónde los proceeds son sostenibles hoy versus qué depende de ejecución operativa.

## Prioridades de suscripción en las que se enfocan los prestamistas

- Durabilidad de ocupación y tendencia de concesiones por submercado.
- Presión de gastos, especialmente seguros, impuestos, nómina y reparaciones.
- Track record del patrocinador en vintage y calidad de activo similares.
- Opcionalidad de salida hacia refinanciamiento agency, banco o CMBS.

Los operadores que proporcionan respaldo para cada supuesto suelen avanzar más rápido en crédito que quienes presentan solo proyecciones resumidas.

## Controles de riesgo y operaciones post-cierre

Después del cierre, el éxito del financiamiento depende de disciplina operativa. Rastree cobranzas de renta, morosidad, rotación, gastos controlables y colchón de covenants cada mes. Incluya comentario de variaciones y planes de acción para que los stakeholders puedan reaccionar rápido.

Si el plan de negocio usa deuda a tasa flotante, monitoree cronogramas de cap de tasa y pruebas de extensión mucho antes de los plazos. El engagement temprano con prestamistas suele ser la mejor protección contra decisiones forzadas.

## Próximos pasos prácticos para prestatarios

1. Construya un set de comps específico del vecindario antes del outreach de term sheet.
2. Dimensione deuda bajo múltiples restricciones, no solo un objetivo de apalancamiento.
3. Documente alcance y cronograma de capex en formato listo para prestamistas.
4. Establezca estándares de reporteo mensual antes del cierre.
5. Mantenga escenarios de refinanciamiento actualizados durante todo el periodo de hold.

Esta página es educativa y debe complementarse con orientación específica de transacción de profesionales de financiamiento, legal, fiscal y contabilidad.
`;
  return { title, description, faq, body, h1: title };
}

const LOAN_TYPE_ES = {
  "agency-stabilized": {
    loanType: "Préstamo multifamiliar estabilizado agency",
    title: "Préstamo multifamiliar estabilizado agency",
    description:
      "Marco de ejecución para préstamos multifamiliares estabilizados agency en financiamiento multifamiliar comercial en EE. UU., incluyendo encaje, restricciones y controles de riesgo.",
  },
  "bridge-value-add": {
    loanType: "Préstamo bridge para multifamiliar value-add",
    title: "Préstamo bridge para multifamiliar value-add",
    description:
      "Marco de ejecución para préstamos bridge value-add multifamiliar en financiamiento comercial en EE. UU., incluyendo encaje, restricciones y controles de riesgo.",
  },
  "bank-balance-sheet": {
    loanType: "Préstamo multifamiliar en balance de banco",
    title: "Préstamo multifamiliar en balance de banco",
    description:
      "Marco de ejecución para préstamos multifamiliares en balance de banco en financiamiento comercial en EE. UU., incluyendo encaje, restricciones y controles de riesgo.",
  },
  "cmbs-stabilized": {
    loanType: "Préstamo multifamiliar estabilizado CMBS",
    title: "Préstamo multifamiliar estabilizado CMBS",
    description:
      "Marco de ejecución para préstamos multifamiliares estabilizados CMBS en financiamiento comercial en EE. UU., incluyendo encaje, restricciones y controles de riesgo.",
  },
  "debt-fund-floating-rate": {
    loanType: "Préstamo a tasa flotante de debt fund",
    title: "Préstamo a tasa flotante de debt fund",
    description:
      "Marco de ejecución para préstamos a tasa flotante de debt fund en financiamiento multifamiliar comercial en EE. UU., incluyendo encaje, restricciones y controles de riesgo.",
  },
};

function buildLoanTypeEs(fm, slug) {
  const meta = LOAN_TYPE_ES[slug];
  const { loanType, typicalLeverage, targetHoldPeriod } = fm;
  const lt = meta?.loanType ?? loanType;
  const faq = [
    {
      q: `¿Quién debería considerar ${lt}?`,
      a: "Los patrocinadores deberían considerar esta estructura cuando la etapa del activo, el cronograma del plan de negocio y la tolerancia al riesgo se alinean con las expectativas de suscripción del prestamista.",
    },
    {
      q: "¿Qué suele bloquear la aprobación?",
      a: "NOI débil, cronogramas de estabilización poco realistas e insuficiencia de liquidez del patrocinador son razones comunes por las que los términos se vuelven menos competitivos.",
    },
    {
      q: "¿Cómo pueden los prestatarios mejorar la certeza de ejecución?",
      a: "Presente supuestos listos para prestamistas, pruebas a la baja y un plan claro de reporteo post-cierre antes de que comience la revisión crediticia formal.",
    },
    {
      q: "¿Qué rango de apalancamiento es típico para este producto?",
      a: `Muchas ejecuciones apuntan a un apalancamiento aproximado de ${typicalLeverage}, pero los proceeds siguen dependiendo de DSCR, debt yield, calidad del activo y profundidad del patrocinador al momento de la cotización.`,
    },
    {
      q: `¿Qué supuestos de periodo de hold encajan con ${lt}?`,
      a: `Los patrocinadores suelen suscribir hacia un hold de ${targetHoldPeriod}, pero deben modelar rutas de extensión, prepago y refinanciamiento si el plan de negocio se retrasa.`,
    },
  ];
  const body = `
## Dónde encaja ${lt} en una estrategia de capital multifamiliar

${lt} se usa típicamente cuando los patrocinadores necesitan una combinación específica de proceeds, pricing, flexibilidad y certeza de ejecución. En la mayoría de transacciones, este producto debe evaluarse contra al menos una estructura alternativa para que los trade-offs sean explícitos antes de seleccionar term sheet.

Un punto de partida práctico es apalancamiento típico en el rango ${typicalLeverage} y un periodo de hold previsto alrededor de ${targetHoldPeriod}. Los resultados reales dependen de DSCR, debt yield, calidad de la propiedad, profundidad del patrocinador y liquidez de mercado al momento de ejecución.

## Criterios centrales de suscripción

Los prestamistas generalmente se enfocan en cuatro áreas:

1. Durabilidad de flujo de caja respaldada por supuestos de NOI normalizado.
2. Experiencia del patrocinador con tipos de activo y estrategia similares.
3. Liquidez de mercado y opcionalidad de refinanciamiento.
4. Credibilidad del plan de negocio, incluyendo ritmo de capex y realismo del cronograma.

Para estrategias transicionales, incluya objetivos de desempeño basados en hitos y planificación de reservas. Para estrategias estabilizadas, enfatice durabilidad de renta y control de gastos.

## Ventajas y restricciones

### Ventajas potenciales

- Alineación específica del producto con ciertos perfiles de hold y riesgo.
- Estructura potencialmente competitiva cuando los supuestos están bien respaldados.
- Flexibilidad útil para patrocinadores con disciplina de ejecución clara.

### Restricciones comunes

- Pisos duros de suscripción en DSCR, debt yield y apalancamiento.
- Requisitos de covenants y reporteo que continúan post-cierre.
- Mayor escrutinio cuando los supuestos dependen en gran medida de cambios de desempeño a corto plazo.

## Recomendaciones de estructuración

Modele este tipo de préstamo bajo casos base y a la baja antes de seleccionar prestamista. Incluya escenarios de movimiento de tasas, estrés de ocupación y presión de gastos. Si hay exposición a tasa flotante, agregue estrategia de cap y economía de extensión directamente en su modelo.

Al negociar términos, compare no solo cupón y proceeds sino también marco de recourse, requisitos de reservas, restricciones de prepago, obligaciones de reporteo y certeza de cronograma.

## Playbook operativo post-cierre

Los resultados de financiamiento se protegen mediante operaciones. Rastree ocupación, cobranzas, variación de gastos y colchón de covenants mensualmente. Prepare comentario de variaciones de calidad prestamista para reducir fricción y mantener opciones abiertas para extensiones o refinanciamientos.

Los prestatarios que tratan la ejecución de deuda como un proceso de ciclo completo, no como un evento único de cierre, suelen preservar más flexibilidad estratégica.

## Lista rápida antes de solicitar cotizaciones

- Finalice supuestos de NOI normalizado con respaldo.
- Pruebe dimensionamiento de deuda bajo múltiples restricciones del prestamista.
- Confirme estructura legal y de garantía temprano.
- Prepare un paquete de diligencia completo antes de la presentación.
- Defina cadencia de reporteo post-cierre y ownership.

Este contenido es educativo y debe combinarse con asesoría específica de transacción de profesionales de financiamiento, legal, fiscal y contabilidad.
`;
  return {
    title: meta?.title ?? fm.title,
    description: meta?.description ?? fm.description,
    loanType: lt,
    faq,
    body,
  };
}

const COMPARISON_ES = {
  "agency-vs-bridge": { productA: "Deuda agency", productB: "Deuda bridge" },
  "bank-vs-debt-fund": { productA: "Préstamo bancario", productB: "Préstamo de debt fund" },
  "fixed-vs-floating-rate": { productA: "Deuda a tasa fija", productB: "Deuda a tasa flotante" },
  "recourse-vs-nonrecourse": { productA: "Deuda con recourse", productB: "Deuda sin recourse" },
  "acquisition-vs-refinance": {
    productA: "Financiamiento de adquisición",
    productB: "Financiamiento de refinanciamiento",
  },
};

function buildComparisonEs(fm, slug) {
  const names = COMPARISON_ES[slug] ?? { productA: fm.productA, productB: fm.productB };
  const { productA, productB } = names;
  const title = `${productA} vs. ${productB} en multifamiliar`;
  const description = `Marco de decisión que compara ${productA} y ${productB} para ejecución de financiamiento multifamiliar en EE. UU. en activos de 5+ unidades.`;
  const faq = [
    {
      q: `¿${productA} siempre es más barato que ${productB}?`,
      a: "No siempre. El costo real depende de comisiones, reservas, restricciones de prepago, economía de extensión y la probabilidad de cumplir hitos del plan de negocio.",
    },
    {
      q: "¿Cómo deben tomar la decisión final los patrocinadores?",
      a: "Seleccione la estructura que mejor se ajuste al riesgo de cronograma, durabilidad de NOI y opcionalidad de refinanciamiento bajo escenarios a la baja.",
    },
    {
      q: "¿Pueden los patrocinadores cambiar de estructura a mitad del proceso?",
      a: "A veces, pero el cronograma y los costos de diligencia suelen aumentar. Es mejor comparar estructuras rigurosamente antes de la presentación formal.",
    },
    {
      q: `¿Cuándo suele ser ${productA} el mejor encaje?`,
      a: `${productA} tiende a encajar cuando la durabilidad del flujo de caja, certeza de pricing y objetivos de hold a largo plazo se alinean con las fortalezas de suscripción de esa estructura.`,
    },
    {
      q: `¿Cuándo tiene más sentido ${productB}?`,
      a: `${productB} puede encajar en cronogramas transicionales, alcance value-add o necesidades de flexibilidad que estructuras permanentes no pueden soportar sin riesgo de retrade.`,
    },
  ];
  const body = `
## ${productA} vs. ${productB}: contexto de decisión

Comparar ${productA} y ${productB} no es solo un ejercicio de pricing. En financiamiento multifamiliar, la mejor opción es la que mejor respalda el cronograma de su plan de negocio, resiliencia a la baja y flexibilidad de salida en activos de 5+ unidades.

Use esta guía para evaluar trade-offs de ejecución antes de seleccionar una vía de prestamista. Una comparación disciplinada a menudo previene riesgo de pivote tardío y protege la certeza de cierre.

## Evalúe costo total, no solo cupón

Los prestatarios a menudo anclan en tasa headline, pero el costo efectivo incluye comisiones, reservas, costos de cap, términos de extensión, economía de prepago e implicaciones potenciales de recourse. Construya un modelo lado a lado que incluya estos elementos durante el periodo de hold esperado.

Cuando los supuestos son inciertos, modele un caso conservador y uno estresado. La estructura que parece óptima en un caso base puede volverse frágil bajo crecimiento de NOI más lento o spreads de refinanciamiento más amplios.

## Diferencias de suscripción y covenants

Los productos evalúan riesgo de forma distinta. Compare:

- Umbrales de DSCR y debt yield.
- Supuestos de estabilización requeridos.
- Expectativas de liquidez y track record del patrocinador.
- Obligaciones de reporteo y covenants después del cierre.

Si una opción requiere supuestos agresivos para funcionar, trátese como riesgo en lugar de upside.

## Velocidad y certeza de ejecución

El cronograma importa. Algunas estructuras pueden ofrecer flexibilidad pero requieren diligencia más profunda o negociación legal más compleja. Otras pueden ofrecer ejecución más limpia si el perfil de la propiedad ya está alineado con estándares del prestamista.

Mapee cada opción contra hitos clave de transacción: plazos de compra, fechas de inicio de capex, ventanas de lease-up y timing de refinanciamiento proyectado.

## Planificación de refinanciamiento y salida

Su decisión de deuda debe incluir un mapa de salida desde el día uno. Estime elegibilidad de refinanciamiento bajo múltiples escenarios de tasa y cap rate. Si los derechos de extensión son críticos, valórelos explícitamente y confirme que las pruebas asociadas son alcanzables de forma realista.

Los patrocinadores que integran planificación de salida en la selección inicial de deuda suelen preservar más opcionalidad estratégica.

## Lista de decisión antes de solicitar cotizaciones

1. Defina el cronograma del plan de negocio y la tolerancia al riesgo operativo.
2. Modele costo total bajo casos base y a la baja para cada estructura.
3. Compare requisitos de covenants y calidad de reporteo post-cierre.
4. Evalúe opcionalidad de refinanciamiento y economía de extensión.
5. Seleccione la estructura que mejor equilibre proceeds, certeza y flexibilidad.

Este contenido es educativo y debe combinarse con asesoría de financiamiento, legal, fiscal y contabilidad para cada transacción.
`;
  return { title, description, productA, productB, faq, body };
}

const PROPERTY_TYPE_ES = {
  "garden-style-multifamily": {
    propertyType: "Multifamiliar garden-style",
    title: "Guía de financiamiento multifamiliar garden-style",
  },
  "mid-rise-urban-multifamily": {
    propertyType: "Multifamiliar urbano mid-rise",
    title: "Guía de financiamiento multifamiliar urbano mid-rise",
  },
  "large-suburban-apartment": {
    propertyType: "Comunidades suburbanas de apartamentos grandes",
    title: "Guía de financiamiento para comunidades suburbanas de apartamentos grandes",
  },
  "value-add-c-class-multifamily": {
    propertyType: "Multifamiliar clase C value-add",
    title: "Guía de financiamiento multifamiliar clase C value-add",
  },
};

function buildPropertyTypeEs(fm, slug) {
  const meta = PROPERTY_TYPE_ES[slug];
  const pt = meta?.propertyType ?? fm.propertyType;
  const band = fm.typicalCapRateBand;
  const minUnits = fm.minUnits ?? 5;
  const faq = [
    {
      q: `¿Cómo varía el apetito del prestamista para ${pt}?`,
      a: "El apetito del prestamista suele depender de durabilidad de ocupación, condición de la propiedad, calidad del patrocinador y liquidez local para ese perfil de activo específico.",
    },
    {
      q: "¿Qué supuestos deben validar primero los patrocinadores?",
      a: "Comience con supuestos realistas de renta, rotación, concesiones y gastos, luego dimensione deuda bajo casos operativos base y a la baja.",
    },
    {
      q: "¿Puede este tipo de activo soportar financiamiento value-add?",
      a: "A menudo sí, cuando el alcance de renovación y el ritmo de lease-up son creíbles y las vías de refinanciamiento se modelan de forma conservadora.",
    },
    {
      q: `¿Qué banda de cap rate es típica para ${pt}?`,
      a: `Bandas direccionales de cap rate cerca de ${band} varían por mercado, condición y ocupación—los prestamistas siguen suscribiendo al NOI específico del activo.`,
    },
    {
      q: "¿Qué conteo mínimo de unidades aplica a esta guía de tipo de propiedad?",
      a: `Esta guía se enfoca en financiamiento multifamiliar comercial para activos con al menos ${minUnits} unidades; préstamos residenciales más pequeños están fuera del alcance de este sitio.`,
    },
  ];
  const body = `
## Por qué ${pt} necesita suscripción específica del activo

Las transacciones de ${pt} pueden desempeñarse muy diferente de otras categorías multifamiliares, incluso dentro del mismo mercado. Para fines de financiamiento, los prestamistas se enfocan en cómo se comporta esta clase de activo a través de ciclos de ocupación, presión de gastos y cambios en demanda de inquilinos.

Para propiedades multifamiliares comerciales en EE. UU. con 5+ unidades, este tipo de activo a menudo se evalúa dentro de una banda típica de cap rate de ${band}. Los patrocinadores deben usar esa banda como contexto direccional y apoyarse en datos de comps actuales para suscripción a nivel de operación.

## Características operativas que evalúan los prestamistas

Los equipos de crédito generalmente evalúan:

- Rotación y velocidad de leasing relativa a activos competidores.
- Durabilidad de renta efectiva después de concesiones y riesgo de cobranza.
- Perfil de gastos, incluyendo reparaciones, nómina, seguros e impuestos.
- Requisitos de gasto de capital para sostener posición de mercado.

Las operaciones con controles operativos claros y supuestos respaldados generalmente reciben términos de ejecución más competitivos.

## Estrategia de estructuración de deuda para este tipo de activo

Para propiedades estabilizadas de flujo de caja, ejecuciones agency o de banco pueden ofrecer certeza atractiva. Para propiedades transicionales, deuda bridge puede ser útil cuando los patrocinadores proporcionan un plan de negocio detallado con reporteo basado en hitos y planificación de reservas.

Modele deuda bajo restricciones de DSCR, debt yield y apalancamiento juntas. Si los proceeds solo funcionan en supuestos optimistas, revise la estructura temprano en lugar de depender de negociación tardía.

## Diligencia y gestión de riesgo

Antes del cierre, confirme supuestos de mix de unidades, calidad de auditoría de leases, alcance de mantenimiento diferido y prioridades de capex. Asegure que la estructura de entidad legal y el marco de garantía se alineen con su propiedad y capital stack.

Después del cierre, mantenga reporteo mensual sobre ocupación, realización de renta, variación de gastos y colchón de covenants. El reporteo consistente preserva flexibilidad para extensiones, deuda suplementaria y refinanciamiento eventual.

## Plan de acción práctico

1. Construya un puente de NOI in-place y estabilizado con respaldo.
2. Valide supuestos contra evidencia de comps local actual.
3. Dimensione deuda bajo múltiples restricciones y escenarios a la baja.
4. Alinee documentación legal, fiscal y de propiedad antes del redactado del préstamo.
5. Lance una cadencia de reporteo post-cierre vinculada a monitoreo de covenants.

Esta guía es educativa y debe combinarse con orientación de prestamista, legal, fiscal y contabilidad específica para su transacción.
`;
  return {
    title: meta?.title ?? fm.title,
    description: `Guía de suscripción y ejecución de deuda para activos ${pt} en financiamiento multifamiliar en EE. UU. (mínimo ${minUnits} unidades).`,
    propertyType: pt,
    faq,
    body,
  };
}

const PROFILE_ES = {
  "first-time-multifamily-buyer": {
    profile: "Comprador multifamiliar por primera vez",
    title: "Playbook para comprador multifamiliar por primera vez",
  },
  "small-portfolio-operator": {
    profile: "Operador de portafolio pequeño",
    title: "Playbook para operador de portafolio pequeño",
  },
  "value-add-sponsor": {
    profile: "Patrocinador value-add",
    title: "Playbook para patrocinador value-add",
  },
  "institutional-growth-operator": {
    profile: "Operador institucional en crecimiento",
    title: "Playbook para operador institucional en crecimiento",
  },
};

function buildInvestorProfileEs(fm, slug) {
  const meta = PROFILE_ES[slug];
  const profile = meta?.profile ?? fm.profile;
  const faq = [
    {
      q: `¿Qué deberían priorizar primero los operadores del perfil ${profile}?`,
      a: "Priorice disciplina de suscripción repetible, objetivos de apalancamiento realistas y reporteo listo para prestamistas antes de escalar volumen de transacciones.",
    },
    {
      q: "¿Qué tan rápido debería escalar este perfil?",
      a: "Escale solo al ritmo en que su equipo pueda suscribir, operar y reportar de forma consistente sin debilitar la calidad de ejecución de deuda.",
    },
    {
      q: "¿Cuáles son los errores de financiamiento más comunes?",
      a: "Sobreapalancamiento temprano, subestimar complejidad operativa y retrasar planificación de refinanciamiento son problemas comunes en portafolios en crecimiento.",
    },
    {
      q: `¿Qué errores de estructura de capital deberían evitar operadores ${profile}?`,
      a: "Sobreapalancarse antes de que maduren los sistemas operativos, omitir pruebas a la baja y retrasar planificación de refinanciamiento son trampas comunes para este perfil.",
    },
    {
      q: `¿Cómo deberían priorizar relaciones con prestamistas los operadores ${profile}?`,
      a: "Construya reporteo repetible y suscripción conservadora antes de expandir volumen—la confianza del prestamista suele seguir ejecución consistente más que conteo de transacciones.",
    },
  ];
  const body = `
## Resumen del perfil: ${profile}

El perfil ${profile} puede construir resultados sólidos a largo plazo en multifamiliar en EE. UU., pero la estrategia de financiamiento debe coincidir con capacidad operativa y tolerancia al riesgo. Este playbook se enfoca en ejecución multifamiliar comercial de 5+ unidades, donde la disciplina del prestamista y la calidad de asset management influyen directamente en el ritmo de crecimiento.

Un objetivo práctico es construir un sistema repetible que funcione a través de ciclos de adquisición, estabilización y refinanciamiento.

## Prioridades de estrategia de capital

Comience definiendo rangos objetivo de apalancamiento, confort mínimo de debt yield y colchones de liquidez que sigan siendo manejables en escenarios a la baja. Evite construir estrategia alrededor de supuestos de mejor caso.

Para cada operación, compare al menos dos vías de deuda y mapee ventanas de refinanciamiento esperadas al cierre. Si se usa deuda bridge, incluya estrategia de cap, economía de extensión y objetivos operativos basados en hitos.

## Modelo operativo de suscripción

Use una plantilla de suscripción estandarizada en todas las operaciones. Separe NOI in-place de NOI estabilizado, documente cada ajuste y requiera respaldo para supuestos de renta, ocupación y gastos. La estandarización reduce errores evitables y mejora la confianza del prestamista.

Antes de presentar a prestamistas, ejecute pruebas de sensibilidad para suavidad de ocupación, inflación de gastos y movimiento de tasas de refinanciamiento. Una operación que solo funciona en un escenario usualmente no es escalable en portafolio.

## Requisitos de equipo y proceso

La calidad del financiamiento depende de disciplina de proceso. Asigne ownership para suscripción de adquisiciones, ejecución de préstamo, diligencia legal y reporteo post-cierre. Establezca revisiones semanales de pipeline que cubran vencimientos pendientes, estado de covenants y oportunidades de refinanciamiento.

A medida que crece el tamaño del portafolio, la calidad del reporteo debe mejorar, no declinar. La comunicación consistente con prestamistas puede convertirse en ventaja estratégica.

## Controles de riesgo para crecimiento

Construya guardrails para concentración por mercado, vintage y estructura de deuda. Mantenga reservas de efectivo que reflejen volatilidad operativa real, no umbrales mínimos del prestamista. Cuando el desempeño se desvía, reproyecte inmediatamente y ajuste estrategia antes de que los covenants se aprieten.

Escalar responsablemente usualmente significa declinar operaciones que no encajan en su marco de financiamiento u operación.

## Hoja de ruta de ejecución a 12 meses

1. Estandarice suscripción, pruebas de sensibilidad y formato de memo de inversión.
2. Construya paquetes de diligencia listos para prestamistas antes del outreach de term sheet.
3. Implemente reporteo mensual con comentario de variaciones en el portafolio.
4. Mantenga un tracker rolling de vencimientos y refinanciamiento para todos los préstamos.
5. Revise apalancamiento y liquidez del portafolio trimestralmente con supuestos a la baja.

Este playbook es educativo y debe adaptarse con asesores de financiamiento, legal, fiscal y contabilidad para cada transacción y estructura de propiedad.
`;
  return {
    title: meta?.title ?? fm.title,
    description: `Estrategia de capital y playbook de suscripción para el perfil ${profile} en financiamiento multifamiliar en EE. UU.`,
    profile,
    faq,
    body,
  };
}

function yamlScalar(val) {
  if (typeof val !== "string") return val;
  if (/[:#]|^[\s-]/.test(val) || val.includes("\n")) return JSON.stringify(val);
  return val;
}

function patchFrontmatter(rawFm, patches, faq) {
  let inner = rawFm;
  for (const [key, val] of Object.entries(patches)) {
    if (val === undefined) continue;
    const re = new RegExp(`^${key}:.*(?:\\n(?:  .+|-.+))*`, "m");
    const line = `${key}: ${yamlScalar(val)}`;
    inner = re.test(inner) ? inner.replace(re, line) : `${line}\n${inner}`;
  }
  inner = inner.replace(/^author: .*$/m, "author: Equipo editorial Multi-Family USA");
  if (faq?.length) {
    const faqBlock = `faq:\n${formatFaqYaml(faq)}`;
    inner = inner.replace(/^faq:[\s\S]*?(?=\n(?:keywords|related[A-Za-z]*|tags|category|author|reviewer|readTime|lastUpdated|published|noindex|featured|h1|slug|primaryKeyword):)/gm, "");
    inner = inner.replace(/\nfaq:[\s\S]*$/m, "");
    const insertRe = /\n(?:keywords|related[A-Za-z]*):/;
    if (insertRe.test(inner)) {
      inner = inner.replace(insertRe, `\n${faqBlock}$&`);
    } else {
      inner = `${inner.trimEnd()}\n${faqBlock}\n`;
    }
  }
  return inner.trim();
}

function writeMdx(outPath, patches, faq, body, rawFm) {
  const frontmatter = patchFrontmatter(rawFm, patches, faq);
  fs.writeFileSync(outPath, `---\n${frontmatter.trim()}\n---\n${body}\n`);
}

function localizeCollection(enDir, esDir, builder) {
  let count = 0;
  for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith(".mdx")).sort()) {
    const slug = file.replace(".mdx", "");
    const parsed = parseFrontmatter(fs.readFileSync(path.join(enDir, file), "utf8"));
    if (!parsed) continue;
    const built = builder(parsed.fm, slug);
    const { body, faq, ...patches } = built;
    writeMdx(path.join(esDir, file), patches, faq, body, parsed.rawFm);
    count++;
  }
  return count;
}

// --- Guides & blog: read optional body overrides ---
function loadBodyOverride(slug) {
  const p = path.join(ROOT, "scripts/es-bodies", `${slug}.mdx`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const GUIDE_META = {
  "multifamily-underwriting-basics.mdx": {
    title: "Fundamentos de suscripción multifamiliar para activos de 5+ unidades",
    description:
      "Marco práctico de suscripción multifamiliar en EE. UU. para adquisiciones y refinanciamientos comerciales de 5+ unidades.",
    h1: "Fundamentos de suscripción multifamiliar para activos de 5+ unidades",
  },
  "commercial-dscr-explained.mdx": {
    title: "DSCR comercial explicado para préstamos multifamiliares",
    description:
      "Guía sobre DSCR comercial para préstamos multifamiliares en EE. UU., umbrales de prestamistas y pruebas de estrés.",
    h1: "DSCR comercial explicado para préstamos multifamiliares",
  },
  "debt-yield-and-ltv-framework.mdx": {
    title: "Marco de debt yield y LTV para patrocinadores multifamiliares",
    description:
      "Marco práctico de debt yield y LTV para equilibrar apalancamiento, cobertura y velocidad de ejecución en multifamiliar.",
    h1: "Marco de debt yield y LTV para patrocinadores multifamiliares",
  },
  "agency-vs-bridge-execution.mdx": {
    title: "Ejecución agency vs. bridge en multifamiliar",
    description:
      "Cómo elegir entre deuda agency y bridge según estabilización, cronograma de capex y riesgo de refinanciamiento.",
    h1: "Ejecución agency vs. bridge en multifamiliar",
  },
  "capital-stack-design-for-value-add.mdx": {
    title: "Diseño del capital stack para value-add multifamiliar",
    description:
      "Cómo estructurar equity, deuda senior y reservas en planes value-add de 5+ unidades sin sobrecargar el refinanciamiento.",
    h1: "Diseño del capital stack para value-add multifamiliar",
  },
  "multifamily-close-checklist.mdx": {
    title: "Lista de cierre multifamiliar para patrocinadores",
    description:
      "Lista de cierre orientada a prestamistas para transacciones multifamiliares comerciales de 5+ unidades en EE. UU.",
    h1: "Lista de cierre multifamiliar para patrocinadores",
  },
  "multifamily-noi-normalization.mdx": {
    title: "Normalización de NOI multifamiliar para prestamistas",
    description:
      "Cómo normalizar NOI en archivos multifamiliares para mejorar proceeds, velocidad de term sheet y credibilidad.",
    h1: "Normalización de NOI multifamiliar para prestamistas",
  },
  "rate-risk-and-refinance-planning.mdx": {
    title: "Riesgo de tasa y planificación de refinanciamiento",
    description:
      "Planificación de refinanciamiento y riesgo de tasa para operadores multifamiliares con deuda flotante o ventanas de salida.",
    h1: "Riesgo de tasa y planificación de refinanciamiento",
  },
  "stabilized-vs-transitional-assets.mdx": {
    title: "Activos estabilizados vs. transicionales en multifamiliar",
    description:
      "Cómo la clasificación estabilizado vs. transicional cambia producto de deuda, covenants y expectativas de prestamistas.",
    h1: "Activos estabilizados vs. transicionales en multifamiliar",
  },
  "operator-reporting-for-lenders.mdx": {
    title: "Reporteo operativo para prestamistas multifamiliares",
    description:
      "Qué reportes mensuales esperan los prestamistas después del cierre y cómo reducir fricción en revisiones de crédito.",
    h1: "Reporteo operativo para prestamistas multifamiliares",
  },
  "multifamily-cash-out-refinance.mdx": {
    title: "Guía de refinanciamiento multifamiliar con retiro de efectivo",
    description:
      "Marco de refinanciamiento con retiro de efectivo para patrocinadores multifamiliares en EE. UU.—seasoning, dimensionamiento de proceeds, criterios del prestamista y planificación de uso de fondos en activos de 5+ unidades.",
    h1: "Guía de refinanciamiento multifamiliar con retiro de efectivo",
  },
  "five-plus-unit-commercial-financing-basics.mdx": {
    title: "Fundamentos de financiamiento comercial para 5+ unidades",
    description:
      "Por qué el financiamiento multifamiliar cambia a cinco unidades—límites entre préstamo comercial y residencial, productos y suscripción para inversionistas en apartamentos.",
    h1: "Fundamentos de financiamiento comercial para 5+ unidades",
  },
  "entity-structure-for-multifamily-borrowing.mdx": {
    title: "Estructura de entidad para préstamos multifamiliares",
    description:
      "Estructura de entidad, préstamos vía LLC, marcos de garantía y consideraciones de vesting para financiamiento multifamiliar comercial en EE. UU. en activos de 5+ unidades.",
    h1: "Estructura de entidad para préstamos multifamiliares",
  },
};

const STANDARD_FAQ_ES = [
  {
    q: "¿Para quién es esta guía?",
    a: "Esta guía es para operadores y patrocinadores multifamiliares en EE. UU. que evalúan ejecución de deuda en activos de 5+ unidades.",
  },
  {
    q: "¿Reemplaza la suscripción del prestamista?",
    a: "No. Es educativa y debe usarse para mejorar la preparación antes de presentar a prestamistas.",
  },
];

function localizeGuides() {
  const enDir = path.join(ROOT, "src/content/guides");
  const esDir = path.join(ROOT, "src/content/es-guides");
  let count = 0;
  for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith(".mdx")).sort()) {
    const slug = file.replace(".mdx", "");
    const enPath = path.join(enDir, file);
    const parsed = parseFrontmatter(fs.readFileSync(enPath, "utf8"));
    if (!parsed) continue;
    const meta = GUIDE_META[file] ?? {};
    const override = loadBodyOverride(slug);
    let body = override;
    if (!body) {
      const marker = "## 1) Start with the business plan and hold strategy";
      const idx = parsed.body.indexOf(marker);
      if (idx >= 0) {
        const prefixPath = path.join(ROOT, "scripts/es-bodies/guides", `${slug}.mdx`);
        const prefix = fs.existsSync(prefixPath)
          ? fs.readFileSync(prefixPath, "utf8")
          : parsed.body.slice(0, idx);
        const shared =
          slug === "commercial-dscr-explained"
            ? SHARED_GUIDE_SECTIONS_ES.replace(
                "## 3) Dimensione la deuda usando múltiples restricciones\n\nLos prestamistas multifamiliares comerciales no dimensionan deuda desde una sola métrica. Suelen evaluar DSCR, debt yield y apalancamiento simultáneamente, y luego eligen el resultado más restrictivo. Construya su modelo de la misma forma para saber dónde está su techo real de proceeds.\n\nLas ejecuciones agency suelen enfatizar flujo de caja estabilizado durable y liquidez de mercado. Las ejecuciones bridge pueden permitir mayor apalancamiento para activos transicionales pero requieren lógica de extensión más clara, estrategia de cap y visibilidad de refinanciamiento. Las ejecuciones CMBS pueden ofrecer estructura sólida en escenarios específicos, pero consideraciones de prepago y servicio deben modelarse desde el inicio.\n\nAl presentar a prestamistas, muestre casos a la baja que incluyan suavidad de ocupación, crecimiento de renta más lento, inflación de gastos y tasas de refinanciamiento menos favorables. La transparencia a la baja mejora la credibilidad y puede acortar ciclos de decisión.",
                DSCR_SECTION_3_ES.trim(),
              )
            : SHARED_GUIDE_SECTIONS_ES;
        body = `${prefix.trimEnd()}\n\n${shared.trim()}`;
      } else {
        console.warn("missing body override for guide:", slug);
        body = parsed.body.replace(/Nota editorial[\s\S]*?\n\n/g, "");
      }
    }
    const enFaqs = parsed.fm.faq ?? [];
    const faqPath = path.join(ROOT, "scripts/es-bodies/guides", `${slug}.faq.json`);
    const faqAlt = path.join(ROOT, "scripts/es-bodies", `${slug}.faq.json`);
    const faqFinal = fs.existsSync(faqPath)
      ? JSON.parse(fs.readFileSync(faqPath, "utf8"))
      : fs.existsSync(faqAlt)
        ? JSON.parse(fs.readFileSync(faqAlt, "utf8"))
        : enFaqs.length >= 2
          ? [...STANDARD_FAQ_ES, ...enFaqs.slice(2)]
          : enFaqs;

    writeMdx(path.join(esDir, file), meta, faqFinal, body, parsed.rawFm);
    count++;
  }
  return count;
}

function localizeBlog() {
  const enDir = path.join(ROOT, "src/content/blog");
  const esDir = path.join(ROOT, "src/content/es-blog");
  let count = 0;
  for (const file of fs.readdirSync(enDir).filter((f) => f.endsWith(".mdx")).sort()) {
    const slug = file.replace(".mdx", "");
    const parsed = parseFrontmatter(fs.readFileSync(path.join(enDir, file), "utf8"));
    const override = loadBodyOverride(slug);
    if (!override) {
      console.warn("missing blog body override:", slug);
      continue;
    }
    const faqPath = path.join(ROOT, "scripts/es-bodies", `${slug}.faq.json`);
    const faq = fs.existsSync(faqPath) ? JSON.parse(fs.readFileSync(faqPath, "utf8")) : parsed.fm.faq;
    const titles = {
      "debt-yield-why-it-drives-term-sheet-velocity": {
        title: "Debt yield: por qué impulsa la velocidad del term sheet",
        description:
          "Por qué el debt yield puede acelerar o frenar la retroalimentación del prestamista incluso cuando el DSCR parece aceptable.",
      },
      "how-operators-are-sizing-bridge-risk": {
        title: "Cómo los operadores dimensionan el riesgo bridge",
        description:
          "Cómo los operadores multifamiliares están probando supuestos bridge antes de solicitar term sheets en activos transicionales.",
      },
      "multifamily-rate-spread-update-q2-2026": {
        title: "Actualización de spreads de tasa multifamiliar Q2 2026",
        description:
          "Panorama de spreads de tasa y apetito del prestamista para operadores multifamiliares comerciales en el segundo trimestre de 2026.",
      },
    };
    writeMdx(path.join(esDir, file), titles[slug] ?? {}, faq, override, parsed.rawFm);
    count++;
  }
  return count;
}

const counts = {
  cities: localizeCollection(
    path.join(ROOT, "src/content/cities"),
    path.join(ROOT, "src/content/es-cities"),
    buildCityEs,
  ),
  loanTypes: localizeCollection(
    path.join(ROOT, "src/content/loan-types"),
    path.join(ROOT, "src/content/es-loan-types"),
    buildLoanTypeEs,
  ),
  comparisons: localizeCollection(
    path.join(ROOT, "src/content/comparisons"),
    path.join(ROOT, "src/content/es-comparisons"),
    buildComparisonEs,
  ),
  propertyTypes: localizeCollection(
    path.join(ROOT, "src/content/property-types"),
    path.join(ROOT, "src/content/es-property-types"),
    buildPropertyTypeEs,
  ),
  investorProfiles: localizeCollection(
    path.join(ROOT, "src/content/investor-profiles"),
    path.join(ROOT, "src/content/es-investor-profiles"),
    buildInvestorProfileEs,
  ),
  guides: localizeGuides(),
  blog: localizeBlog(),
};

console.log("ES content localization complete:", counts);
