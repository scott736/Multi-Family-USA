/**
 * Generate fully localized Spanish state MDX from English sources.
 * Run: node scripts/localize-es-states.mjs
 */
import fs from "node:fs";
import path from "node:path";

const EN_DIR = path.resolve("src/content/states");
const ES_DIR = path.resolve("src/content/es-states");

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
    } else if (arr && line.match(/^- "?(.+?)"?$/)) {
      arr.push(RegExp.$1);
    } else if (arr && line.match(/^  - "?(.+?)"?$/)) {
      arr.push(RegExp.$1);
    }
  }
  return { fm, body: content.slice(m[0].length) };
}

function formatPrice(n) {
  return Number(n).toLocaleString("en-US");
}

function foreclosureLabelEs(type) {
  if (type === "mixed") return "mixto (judicial y extrajudicial)";
  if (type === "judicial") return "judicial";
  return "extrajudicial";
}

function buildLegalParagraphEs(stateName, d) {
  const taxRate =
    d.statePropertyTax != null
      ? `con una tasa efectiva de impuesto a la propiedad cerca del ${Number(d.statePropertyTax).toFixed(2)}%`
      : null;
  const eviction = d.evictionTimelineDays
    ? `plazos típicos de desalojo de ${d.evictionTimelineDays}`
    : null;
  const rent =
    d.rentControl === "true" || d.rentControl === true
      ? "y normas estatales o locales de control de rentas que pueden aplicar"
      : "y sin control de rentas a nivel estatal";
  const mid = [taxRate, eviction, rent].filter(Boolean).join(", ");
  const income =
    d.hasStateIncomeTax === "true" || d.hasStateIncomeTax === true
      ? `${stateName} tiene impuesto estatal sobre la renta. `
      : `${stateName} no tiene impuesto estatal sobre la renta. `;
  return `Desde una perspectiva de ejecución, ${stateName} se considera generalmente un estado de ejecución hipotecaria ${foreclosureLabelEs(d.foreclosureType)}${mid ? `, ${mid}` : ""}. ${income}Estos factores pueden influir en la evaluación de riesgo del prestamista, el alcance de la diligencia legal y la planificación de flujo de caja a nivel del patrocinador.`;
}

function buildStateEs(fm) {
  const stateName = fm.stateName;
  const avgCapRate = Number(fm.avgCapRate);
  const avgPricePerUnit = Number(fm.avgPricePerUnit);
  const topList = (fm.topMarkets || []).slice(0, 3).join(", ");
  const taxPct = fm.statePropertyTax != null ? Number(fm.statePropertyTax).toFixed(2) : null;
  const rentNote =
    fm.rentControl === "true" || fm.rentControl === true
      ? "normas aplicables de control de rentas"
      : "la ausencia de control de rentas a nivel estatal";
  const incomeNote =
    fm.hasStateIncomeTax === "true" || fm.hasStateIncomeTax === true
      ? "implicaciones del impuesto estatal sobre la renta"
      : "implicaciones de la ausencia de impuesto estatal sobre la renta";

  const title = `Guía de financiamiento multifamiliar en ${stateName} (5+ unidades)`;
  const description = `Contexto de financiamiento y suscripción multifamiliar comercial en ${stateName} (5+ unidades), incluyendo dimensionamiento basado en NOI, expectativas de prestamistas, contexto de cap rate y estrategia de ejecución.`;

  const faq = [
    {
      q: `¿Cómo ven los prestamistas el apalancamiento en ${stateName}?`,
      a: `Los prestamistas suelen dimensionar los proceeds multifamiliares comerciales usando el NOI de la propiedad y la restricción más exigente entre DSCR comercial, debt yield y LTV—más la calidad del patrocinio y la liquidez del submercado en ${stateName}, en lugar de apuntar a un objetivo único.`,
    },
    {
      q: `¿Qué importa más en un paquete de deuda multifamiliar en ${stateName}?`,
      a: "La normalización clara del NOI, supuestos de renta realistas y un plan operativo documentado suelen ser los factores que más impulsan la confianza y la velocidad de ejecución.",
    },
    {
      q: "¿Puede funcionar deuda bridge en propiedades de 5+ unidades?",
      a: "Sí, especialmente en activos transicionales, pero el plan debe incluir ritmo de lease-up, lógica de reservas, opciones de extensión y contingencias de refinanciamiento.",
    },
    {
      q: `¿Qué factores legales y fiscales importan en la suscripción en ${stateName}?`,
      a: `Los patrocinadores deben abordar temprano el marco de ejecución hipotecaria ${foreclosureLabelEs(fm.foreclosureType)} de ${stateName}${taxPct ? `, el contexto fiscal a la propiedad cerca del ${taxPct}%` : ""}, ${rentNote}, y ${incomeNote}.`,
    },
    {
      q: `¿Cómo deben usar los patrocinadores el contexto de cap rate estatal en ${stateName}?`,
      a: `Un contexto direccional de cap rate cerca del ${avgCapRate}% es solo un punto de partida; los prestamistas suelen exigir comps de submercado y respaldo de NOI específico del activo en corredores como ${topList || stateName}.`,
    },
  ];

  const keywords = [
    `financiamiento multifamiliar ${stateName}`,
    `préstamo multifamiliar comercial ${stateName}`,
    `suscripción 5+ unidades ${stateName}`,
    "financiamiento multifamiliar comercial",
  ];

  const body = `

## Resumen de financiamiento multifamiliar en ${stateName}

${stateName} sigue siendo un mercado activo para financiamiento multifamiliar comercial en EE. UU. en propiedades de 5+ unidades, pero el apetito del prestamista puede variar según la calidad del submercado, la profundidad del patrocinio y el riesgo del plan de negocio. Esta página ofrece orientación práctica de ejecución que puede usar antes de solicitar cotizaciones, durante la negociación del term sheet y a lo largo de la gestión del activo.

Un punto de partida práctico de suscripción para ${stateName} es un contexto de cap rate promedio cerca del ${avgCapRate}% y precios promedio cerca de $${formatPrice(avgPricePerUnit)} por unidad, con resultados de transacción que siguen dependiendo en gran medida de la condición de la propiedad, la durabilidad de la ocupación y los impulsores de demanda local. Estas cifras estatales son direccionales y deben refinarse con evidencia de comps actual para su submercado específico.

## Contexto de submercado y demanda

La confianza del prestamista suele mejorar cuando los patrocinadores presentan evidencia de demanda a nivel de submercado en lugar de promedios estatales solamente. En ${stateName}, los operadores suelen enmarcar esto mostrando momentum de leasing y demanda de inquilinos en áreas como ${topList}.

En su paquete, documente oferta competidora, tendencias de concesiones, diversidad de empleo y posicionamiento de asequibilidad para el micromercado específico. Operaciones que funcionan bien en un corredor pueden suscribirse de forma muy distinta a pocas millas de distancia.

## Cómo suscriben los prestamistas operaciones en ${stateName}

Los prestamistas comerciales suscriben propiedades de 5+ unidades sobre NOI normalizado, contexto de cap rate y calidad del rent roll. Los proceeds suelen limitarse por la restricción más exigente entre cobertura de servicio de deuda comercial (DSCR), debt yield y LTV. Las ejecuciones agency premian NOI estabilizado y ocupación durable; los prestamistas bridge pueden financiar planes value-add y de lease-up cuando el alcance de capex, reservas, opciones de extensión y una vía creíble de takeout o refinanciamiento están documentados.

Para refinanciamientos, incluya historial de desempeño trailing, términos de deuda actuales y cualquier riesgo próximo de capex o rollover. Para adquisiciones, incluya respaldo de T12 normalizado, verificaciones de calidad del rent roll y un cronograma de estabilización defendible.

## Factores legales y fiscales a abordar temprano

${buildLegalParagraphEs(stateName, fm)}

Coordine estructura de entidad, marco de garantía y documentación de propiedad antes de redactar documentos de préstamo. La alineación legal y fiscal temprana reduce fricción de cierre y protege los cronogramas.

## Expectativas del plan operativo después del cierre

La gestión de desempeño post-cierre es parte del éxito del financiamiento. Construya un paquete operativo mensual que rastree ocupación, rentas efectivas, concesiones, morosidad, variación de gastos y colchón de covenants. Incluya comentario sobre variaciones y acciones siguientes, no solo métricas estáticas.

Si su estrategia usa deuda a tasa flotante, monitoree vencimiento de cap y disparadores de extensión con mucha anticipación. La comunicación proactiva con prestamistas suele ser la forma más efectiva de preservar opcionalidad.

## Lista de ejecución a 90 días para ${stateName}

1. Reconfirme supuestos de NOI in-place y estabilizado usando evidencia de mercado actual.
2. Redimensione la deuda usando NOI, DSCR comercial, debt yield y LTV en escenarios base y a la baja antes de la selección final del prestamista.
3. Complete documentación de entidad legal y garantía antes del redactado final del préstamo.
4. Construya una cadencia de reporteo lista para prestamistas durante los primeros tres trimestres post-cierre.
5. Mantenga un plan de refinanciamiento desde el día uno, incluso en estrategias de hold más largo.

Esta guía es educativa y debe complementarse con asesoría de prestamista, legal, fiscal y contable específica para su transacción y mercado.
`;

  const faqYaml = faq
    .map(({ q, a }) => {
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
    })
    .join("\n");

  const marketsYaml = (fm.topMarkets || []).map((m) => `- ${m}`).join("\n");
  const keywordsYaml = keywords.map((k) => `- ${k}`).join("\n");

  return `---
title: ${title}
description: ${description}
stateName: ${stateName}
stateCode: ${fm.stateCode}
tier: '${fm.tier}'
avgCapRate: ${fm.avgCapRate}
avgPricePerUnit: ${fm.avgPricePerUnit}
hasStateIncomeTax: ${fm.hasStateIncomeTax}
foreclosureType: ${fm.foreclosureType}
statePropertyTax: ${fm.statePropertyTax ?? 0}
evictionTimelineDays: ${fm.evictionTimelineDays ?? ""}
rentControl: ${fm.rentControl}
prohibitsPpp1to4Unit: ${fm.prohibitsPpp1to4Unit ?? false}
topMarkets:
${marketsYaml}
author: Equipo editorial Multi-Family USA
reviewer: Scott Dillingham
readTime: ${fm.readTime ?? 9}
lastUpdated: ${fm.lastUpdated ?? "2026-05-24"}
published: ${fm.published ?? "2026-05-24"}
keywords:
${keywordsYaml}
faq:
${faqYaml}
---
${body}
`;
}

if (!fs.existsSync(ES_DIR)) fs.mkdirSync(ES_DIR, { recursive: true });

let count = 0;
for (const file of fs.readdirSync(EN_DIR).filter((f) => f.endsWith(".mdx")).sort()) {
  const parsed = parseFrontmatter(fs.readFileSync(path.join(EN_DIR, file), "utf8"));
  if (!parsed) {
    console.warn("skip parse:", file);
    continue;
  }
  fs.writeFileSync(path.join(ES_DIR, file), buildStateEs(parsed.fm));
  count++;
}

console.log(`Localized ${count} Spanish state files.`);
