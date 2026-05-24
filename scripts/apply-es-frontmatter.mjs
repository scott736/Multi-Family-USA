import fs from "node:fs";
import path from "node:path";

const COLLECTIONS = [
  { dir: "es-guides", enBase: "/learn", label: "guía" },
  { dir: "es-blog", enBase: "/blog", label: "artículo" },
  { dir: "es-loan-types", enBase: "/loan-types", label: "tipo de préstamo" },
  { dir: "es-property-types", enBase: "/property-types", label: "tipo de propiedad" },
  { dir: "es-comparisons", enBase: "/compare", label: "comparación" },
  { dir: "es-investor-profiles", enBase: "/invest", label: "perfil" },
  { dir: "es-cities", enBase: "/cities", label: "ciudad" },
  { dir: "es-states", enBase: "/states", label: "estado" },
];

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
};

function setField(content, field, value) {
  const re = new RegExp(`^${field}:.*$`, "m");
  const line = `${field}: ${JSON.stringify(value)}`;
  if (re.test(content)) return content.replace(re, line);
  return content.replace(/^---\n/, `---\n${line}\n`);
}

function patch(filePath, { enBase, label }, guideMeta) {
  const file = path.basename(filePath);
  const slug = file.replace(/\.mdx$/, "");
  let content = fs.readFileSync(filePath, "utf8");
  const meta = guideMeta?.[file];

  if (meta) {
    content = setField(content, "title", meta.title);
    content = setField(content, "description", meta.description);
    content = setField(content, "h1", meta.h1);
  }

  content = content.replaceAll(
    "Multi-Family USA Editorial Team",
    "Equipo editorial Multi-Family USA",
  );

  const enHref = `${enBase}/${slug}/`;
  const note = `\n> **Nota editorial:** Metadatos en español para esta ${label}. El cuerpo se está localizando; la [versión en inglés](${enHref}) sigue siendo la referencia editorial más actualizada.\n\n`;

  if (!content.includes("Nota editorial")) {
    const insertAt = content.indexOf("\n---\n", 4) + 5;
    content = content.slice(0, insertAt) + note + content.slice(insertAt);
  }

  fs.writeFileSync(filePath, content);
}

for (const col of COLLECTIONS) {
  const dir = path.join("src/content", col.dir);
  if (!fs.existsSync(dir)) continue;
  const guideMeta = col.dir === "es-guides" ? GUIDE_META : null;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))) {
    patch(path.join(dir, file), col, guideMeta);
  }
}

console.log("Spanish frontmatter pass complete.");
