/** Shared glossary terms for EN/ES pages and DefinedTermSet schema. */

export type GlossaryTerm = {
  term: string;
  definition: string;
  letterGroup: "A-C" | "D-F" | "G-N" | "O-S" | "T-Z";
};

export const GLOSSARY_TERMS_EN: GlossaryTerm[] = [
  {
    term: "Amortization",
    definition: "The schedule for principal repayment over the life of a loan.",
    letterGroup: "A-C",
  },
  {
    term: "Bridge Loan",
    definition: "Shorter-term financing commonly used for transitional multifamily business plans.",
    letterGroup: "A-C",
  },
  {
    term: "Cap Rate",
    definition: "Net operating income divided by value or purchase price, expressed as a percentage.",
    letterGroup: "A-C",
  },
  {
    term: "Cash-on-Cash Return",
    definition: "Annual pre-tax cash flow divided by invested equity.",
    letterGroup: "A-C",
  },
  {
    term: "CMBS",
    definition: "Commercial mortgage-backed securities financing, often used for stabilized commercial assets.",
    letterGroup: "A-C",
  },
  {
    term: "Debt Service",
    definition: "Total principal and interest payments required by the loan structure.",
    letterGroup: "D-F",
  },
  {
    term: "Debt Service Coverage Ratio (DSCR)",
    definition: "NOI divided by annual debt service; a core lender sizing metric.",
    letterGroup: "D-F",
  },
  {
    term: "Debt Yield",
    definition: "NOI divided by loan amount; a lender risk metric independent of interest rate.",
    letterGroup: "D-F",
  },
  {
    term: "Effective Gross Income",
    definition: "Scheduled income minus vacancy/credit loss plus other property income.",
    letterGroup: "D-F",
  },
  {
    term: "Exit Cap Rate",
    definition:
      "Assumed cap rate at refinance or sale used for sensitivity testing and valuation planning.",
    letterGroup: "D-F",
  },
  {
    term: "Guarantor",
    definition: "Individual or entity providing credit support to the borrowing structure.",
    letterGroup: "G-N",
  },
  {
    term: "In-Place NOI",
    definition: "NOI based on current operating performance before stabilization assumptions.",
    letterGroup: "G-N",
  },
  {
    term: "Interest Rate Cap",
    definition: "A derivative that limits floating-rate exposure on variable-rate debt.",
    letterGroup: "G-N",
  },
  {
    term: "LTV (Loan-to-Value)",
    definition: "Loan amount divided by collateral value.",
    letterGroup: "G-N",
  },
  {
    term: "NOI (Net Operating Income)",
    definition: "Property income minus operating expenses, before debt service and capital items.",
    letterGroup: "G-N",
  },
  {
    term: "Prepayment Penalty",
    definition:
      "Cost to pay off debt early, often including yield maintenance or defeasance provisions.",
    letterGroup: "O-S",
  },
  {
    term: "Recourse",
    definition: "Lender ability to pursue guarantor assets beyond collateral under specified conditions.",
    letterGroup: "O-S",
  },
  {
    term: "Reserve Account",
    definition: "Escrowed funds for taxes, insurance, repairs, or replacement needs.",
    letterGroup: "O-S",
  },
  {
    term: "Seasoning",
    definition:
      "Operating history lenders require after acquisition or recap before approving certain refinance or cash-out terms.",
    letterGroup: "O-S",
  },
  {
    term: "Single-Purpose Entity (SPE)",
    definition:
      "Borrowing entity structured to hold one asset with segregated accounts and limited cross-collateralization.",
    letterGroup: "O-S",
  },
  {
    term: "Stabilized NOI",
    definition: "NOI after business-plan improvements are completed and operations normalize.",
    letterGroup: "O-S",
  },
  {
    term: "Sponsorship",
    definition: "The borrower team and guarantor group assessed for experience, liquidity, and governance.",
    letterGroup: "O-S",
  },
  {
    term: "T12",
    definition: "Trailing 12-month operating statement used to evaluate recent financial performance.",
    letterGroup: "T-Z",
  },
  {
    term: "Term Sheet",
    definition: "Preliminary financing proposal outlining pricing, proceeds, covenants, and key conditions.",
    letterGroup: "T-Z",
  },
  {
    term: "Underwriting",
    definition: "The lender process of evaluating cash flow, collateral, sponsorship, and risk.",
    letterGroup: "T-Z",
  },
  {
    term: "Value-Add",
    definition: "Strategy focused on operational or capital improvements to increase NOI and value.",
    letterGroup: "T-Z",
  },
  {
    term: "Yield Maintenance",
    definition: "Prepayment structure intended to preserve lender yield if a loan is repaid early.",
    letterGroup: "T-Z",
  },
];

export const GLOSSARY_TERMS_ES: GlossaryTerm[] = [
  {
    term: "Amortización",
    definition: "El calendario de pago de capital a lo largo de la vida del préstamo.",
    letterGroup: "A-C",
  },
  {
    term: "Préstamo bridge",
    definition: "Financiamiento de plazo más corto usado comúnmente para planes de negocio multifamiliares transicionales.",
    letterGroup: "A-C",
  },
  {
    term: "Cap rate",
    definition: "Ingreso operativo neto dividido por el valor o precio de compra, expresado como porcentaje.",
    letterGroup: "A-C",
  },
  {
    term: "Retorno cash-on-cash",
    definition: "Flujo de caja anual antes de impuestos dividido por el capital invertido.",
    letterGroup: "A-C",
  },
  {
    term: "CMBS",
    definition: "Financiamiento con valores respaldados por hipotecas comerciales, a menudo usado para activos comerciales estabilizados.",
    letterGroup: "A-C",
  },
  {
    term: "Servicio de la deuda",
    definition: "Total de pagos de capital e intereses requeridos por la estructura del préstamo.",
    letterGroup: "D-F",
  },
  {
    term: "DSCR (índice de cobertura del servicio de la deuda)",
    definition: "NOI dividido por el servicio anual de la deuda; métrica central de sizing del prestamista.",
    letterGroup: "D-F",
  },
  {
    term: "Debt yield",
    definition: "NOI dividido por el monto del préstamo; métrica de riesgo del prestamista independiente de la tasa de interés.",
    letterGroup: "D-F",
  },
  {
    term: "Ingreso bruto efectivo",
    definition: "Ingreso programado menos vacancia/pérdida de crédito más otros ingresos de la propiedad.",
    letterGroup: "D-F",
  },
  {
    term: "Cap rate de salida",
    definition:
      "Cap rate asumido en el refinanciamiento o venta usado para pruebas de sensibilidad y planificación de valuación.",
    letterGroup: "D-F",
  },
  {
    term: "Garante",
    definition: "Persona o entidad que brinda soporte crediticio a la estructura de endeudamiento.",
    letterGroup: "G-N",
  },
  {
    term: "NOI in-place",
    definition: "NOI basado en el desempeño operativo actual antes de supuestos de estabilización.",
    letterGroup: "G-N",
  },
  {
    term: "Cap de tasa de interés",
    definition: "Derivado que limita la exposición a tasa flotante en deuda de tasa variable.",
    letterGroup: "G-N",
  },
  {
    term: "LTV (loan-to-value)",
    definition: "Monto del préstamo dividido por el valor del colateral.",
    letterGroup: "G-N",
  },
  {
    term: "NOI (ingreso operativo neto)",
    definition: "Ingreso de la propiedad menos gastos operativos, antes del servicio de la deuda y partidas de capital.",
    letterGroup: "G-N",
  },
  {
    term: "Penalidad por prepago",
    definition:
      "Costo de pagar la deuda anticipadamente, a menudo incluyendo yield maintenance o disposiciones de defeasance.",
    letterGroup: "O-S",
  },
  {
    term: "Recurso",
    definition: "Capacidad del prestamista de perseguir activos del garante más allá del colateral bajo condiciones especificadas.",
    letterGroup: "O-S",
  },
  {
    term: "Cuenta de reserva",
    definition: "Fondos en escrow para impuestos, seguros, reparaciones o necesidades de reemplazo.",
    letterGroup: "O-S",
  },
  {
    term: "Seasoning",
    definition:
      "Historial operativo que los prestamistas exigen después de la adquisición o recap antes de aprobar ciertos términos de refinanciamiento o cash-out.",
    letterGroup: "O-S",
  },
  {
    term: "Entidad de propósito único (SPE)",
    definition:
      "Entidad prestataria estructurada para poseer un solo activo con cuentas segregadas y cross-collateralization limitada.",
    letterGroup: "O-S",
  },
  {
    term: "NOI estabilizado",
    definition: "NOI después de completar las mejoras del plan de negocio y normalizar las operaciones.",
    letterGroup: "O-S",
  },
  {
    term: "Patrocinio",
    definition: "El equipo prestatario y el grupo de garantes evaluados por experiencia, liquidez y gobernanza.",
    letterGroup: "O-S",
  },
  {
    term: "T12",
    definition: "Estado operativo de los últimos 12 meses usado para evaluar el desempeño financiero reciente.",
    letterGroup: "T-Z",
  },
  {
    term: "Term sheet",
    definition: "Propuesta preliminar de financiamiento que describe precio, proceeds, covenants y condiciones clave.",
    letterGroup: "T-Z",
  },
  {
    term: "Suscripción (underwriting)",
    definition: "El proceso del prestamista de evaluar flujo de caja, colateral, patrocinio y riesgo.",
    letterGroup: "T-Z",
  },
  {
    term: "Value-add",
    definition: "Estrategia enfocada en mejoras operativas o de capital para aumentar NOI y valor.",
    letterGroup: "T-Z",
  },
  {
    term: "Yield maintenance",
    definition: "Estructura de prepago destinada a preservar el rendimiento del prestamista si el préstamo se paga anticipadamente.",
    letterGroup: "T-Z",
  },
];

export const GLOSSARY_LETTER_GROUPS = ["A-C", "D-F", "G-N", "O-S", "T-Z"] as const;
