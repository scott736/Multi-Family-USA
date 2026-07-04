export interface ChecklistSection {
  title: string;
  items: string[];
}

export interface ChecklistDefinition {
  id: string;
  titleEn: string;
  titleEs: string;
  sectionsEn: ChecklistSection[];
  sectionsEs: ChecklistSection[];
}

export const CHECKLISTS: Record<string, ChecklistDefinition> = {
  'due-diligence-checklist': {
    id: 'due-diligence-checklist',
    titleEn: 'Multifamily Due Diligence Checklist',
    titleEs: 'Lista de due diligence multifamiliar',
    sectionsEn: [
      {
        title: 'Financial diligence',
        items: [
          'Reconcile trailing 12-month operating statements and rent roll totals.',
          'Build in-place and stabilized NOI bridges with support for each adjustment.',
          'Stress test occupancy, concessions, bad debt, and expense inflation.',
          'Validate debt sizing under DSCR, debt yield, and leverage constraints.',
        ],
      },
      {
        title: 'Lease and tenant diligence',
        items: [
          'Audit lease terms, concessions, expiration clustering, and delinquency patterns.',
          'Confirm occupancy reporting methodology and unit-status definitions.',
          'Review tenant concentration and exposure to nonrecurring occupancy drivers.',
        ],
      },
      {
        title: 'Physical and capex diligence',
        items: [
          'Complete PCA and relevant environmental reports required by lenders.',
          'Map immediate-life-safety needs versus strategic value-add improvements.',
          'Align capex sequencing with loan covenants, reserves, and lease-up timing.',
        ],
      },
      {
        title: 'Legal and entity diligence',
        items: [
          'Verify borrowing entity formation documents and ownership structure.',
          'Confirm guarantor framework, authority documents, and signature readiness.',
          'Review title, survey, zoning, and litigation matters before loan-doc drafting.',
        ],
      },
      {
        title: 'Debt execution and closing controls',
        items: [
          'Track lender conditions with owner-level due dates and document status.',
          'Confirm reserve requirements, escrows, and cash-management mechanics.',
          'Verify extension tests and refinance assumptions for transitional strategies.',
          'Prepare post-close reporting templates before funding.',
        ],
      },
    ],
    sectionsEs: [
      {
        title: 'Diligencia financiera',
        items: [
          'Concilie estados operativos de 12 meses y totales del rent roll.',
          'Construya puentes de NOI in-place y estabilizado con soporte de cada ajuste.',
          'Pruebe ocupación, concesiones, incobrables e inflación de gastos.',
          'Valide dimensionamiento de deuda bajo DSCR, debt yield y apalancamiento.',
        ],
      },
      {
        title: 'Diligencia de arrendamientos e inquilinos',
        items: [
          'Audite términos de arrendamiento, concesiones, vencimientos y morosidad.',
          'Confirme metodología de ocupación y definiciones de estatus de unidades.',
          'Revise concentración de inquilinos y exposición a ocupación no recurrente.',
        ],
      },
      {
        title: 'Diligencia física y capex',
        items: [
          'Complete PCA e informes ambientales requeridos por prestamistas.',
          'Mapee necesidades de seguridad inmediata versus mejoras value-add.',
          'Alinee secuencia de capex con convenios, reservas y lease-up.',
        ],
      },
      {
        title: 'Diligencia legal y de entidad',
        items: [
          'Verifique documentos de constitución y estructura de titularidad.',
          'Confirme marco de garantía, autoridad y documentos de firma.',
          'Revise título, survey, zonificación y litigios antes de documentos de préstamo.',
        ],
      },
      {
        title: 'Ejecución de deuda y controles de cierre',
        items: [
          'Rastree condiciones del prestamista con fechas y estatus de documentos.',
          'Confirme reservas, escrows y mecánicas de gestión de efectivo.',
          'Verifique pruebas de extensión y supuestos de refinanciamiento.',
          'Prepare plantillas de reporteo post-cierre antes del funding.',
        ],
      },
    ],
  },
  'lender-document-checklist': {
    id: 'lender-document-checklist',
    titleEn: 'Multifamily Lender Document Checklist',
    titleEs: 'Lista de documentos para prestamistas multifamiliares',
    sectionsEn: [
      {
        title: 'Sponsorship and guarantor package',
        items: [
          'Guarantor personal financial statements (dated within 90 days).',
          'Guarantor schedules of real estate owned with debt and maturity dates.',
          'Guarantor liquidity verification (bank or brokerage statements).',
          'Guarantor resume or track-record summary for multifamily experience.',
          'Background and credit authorization forms required by the lender.',
          'Identification and entity authority documents for each signing guarantor.',
        ],
      },
      {
        title: 'Borrowing entity and organizational documents',
        items: [
          'Certificate of formation and operating agreement for the borrowing entity.',
          'Organizational chart showing ownership from guarantor(s) to borrowing entity.',
          'Certificate of good standing for each entity in the borrowing structure.',
          'Operating agreement amendments affecting manager authority or transfers.',
          'Certificate of incumbency or manager resolutions authorizing the loan.',
          'EIN confirmation and registered agent details for each entity.',
        ],
      },
      {
        title: 'Property operating and financial package',
        items: [
          'Current rent roll aligned to trailing operating statement period.',
          'Trailing 12-month operating statement and year-to-date financials.',
          'NOI normalization memo with support for each adjustment.',
          'Lease audit summary for material leases and delinquency trends.',
          'Accounts receivable and bad-debt detail if collections are elevated.',
          'Utility, payroll, insurance, and tax expense support where trends are unusual.',
        ],
      },
      {
        title: 'Business plan and underwriting support',
        items: [
          'Sources and uses summary with equity commitment and closing cost detail.',
          'In-place and stabilized NOI views with explicit bridge assumptions.',
          'Debt-sizing summary across DSCR, debt yield, and leverage constraints.',
          'Capex scope, budget, timeline, and contractor quotes for value-add strategies.',
          'Lease-up or stabilization timeline with milestone-based occupancy targets.',
          'Refinance or exit thesis for bridge and transitional executions.',
        ],
      },
      {
        title: 'Third-party reports (as applicable)',
        items: [
          'Property condition assessment (PCA) and Phase I environmental.',
          'Appraisal engagement package with property data sheet and rent comps.',
          'Seismic or zoning reports when required by market or lender policy.',
          'Survey, title commitment, and exception review materials for purchase deals.',
          'Existing loan payoff statement and reserve reconciliation for refinances.',
        ],
      },
    ],
    sectionsEs: [
      {
        title: 'Paquete de patrocinio y garantes',
        items: [
          'Estados financieros personales del garante (dentro de 90 días).',
          'Programas de bienes raíces del garante con deuda y vencimientos.',
          'Verificación de liquidez del garante.',
          'Currículum o resumen de historial multifamiliar del garante.',
          'Formularios de autorización de antecedentes y crédito.',
          'Identificación y documentos de autoridad de entidad para cada garante.',
        ],
      },
      {
        title: 'Entidad prestataria y documentos organizacionales',
        items: [
          'Certificado de constitución y operating agreement de la entidad prestataria.',
          'Organigrama de titularidad desde garantes hasta entidad prestataria.',
          'Certificado de buena reputación de cada entidad.',
          'Enmiendas al operating agreement que afecten autoridad del manager.',
          'Certificado de incumbencia o resoluciones que autoricen el préstamo.',
          'Confirmación de EIN y agente registrado de cada entidad.',
        ],
      },
      {
        title: 'Paquete operativo y financiero de la propiedad',
        items: [
          'Rent roll actual alineado al período del estado operativo.',
          'Estado operativo de 12 meses y finanzas año a la fecha.',
          'Memo de normalización de NOI con soporte de cada ajuste.',
          'Resumen de auditoría de arrendamientos y morosidad.',
          'Detalle de cuentas por cobrar e incobrables si aplica.',
          'Soporte de servicios, nómina, seguros e impuestos atípicos.',
        ],
      },
      {
        title: 'Plan de negocio y soporte de suscripción',
        items: [
          'Resumen de fuentes y usos con equity y costos de cierre.',
          'Vistas in-place y estabilizadas de NOI con supuestos bridge.',
          'Resumen de dimensionamiento bajo DSCR, debt yield y apalancamiento.',
          'Alcance de capex, presupuesto, cronograma y cotizaciones.',
          'Cronograma de lease-up o estabilización con metas de ocupación.',
          'Tesis de refinanciamiento o salida para ejecuciones bridge.',
        ],
      },
      {
        title: 'Informes de terceros (según aplique)',
        items: [
          'Evaluación de condición (PCA) y ambiental Fase I.',
          'Paquete de encargo de tasación con comparables de renta.',
          'Informes sísmicos o de zonificación cuando aplique.',
          'Survey, compromiso de título y excepciones en compras.',
          'Carta de pago y conciliación de reservas en refinanciamientos.',
        ],
      },
    ],
  },
  'pro-forma-template': {
    id: 'pro-forma-template',
    titleEn: 'Multifamily Pro Forma Template',
    titleEs: 'Plantilla de pro forma multifamiliar',
    sectionsEn: [
      {
        title: 'Template structure',
        items: [
          'Separate tabs for in-place operations and stabilized operations.',
          'NOI normalization support for one-time and recurring adjustments.',
          'Debt-sizing outputs for DSCR, debt yield, and leverage constraints.',
          'Sensitivity grids for occupancy, rent growth, and expense pressure.',
          'Refinance and disposition scenario checks across hold-period assumptions.',
        ],
      },
      {
        title: 'Modeling standards',
        items: [
          'Tie every major line item to T12, rent roll, market evidence, or operating plans.',
          'Document assumption sources for lender review.',
          'Keep audit-ready backup tabs alongside presentation outputs.',
        ],
      },
      {
        title: 'Common mistakes to avoid',
        items: [
          'Overstating rent growth without submarket-specific support.',
          'Underestimating insurance, taxes, payroll, and replacement reserves.',
          'Sizing debt from one metric instead of multiple lender constraints.',
          'Ignoring extension and refinance assumptions on transitional deals.',
        ],
      },
      {
        title: 'Implementation workflow',
        items: [
          'Import T12 and rent-roll data; complete NOI normalization first.',
          'Set base case assumptions and run debt sizing across lender constraints.',
          'Build downside scenarios and identify breakpoints before quote requests.',
          'Package outputs for lender discussions with clear assumption commentary.',
        ],
      },
    ],
    sectionsEs: [
      {
        title: 'Estructura de la plantilla',
        items: [
          'Pestañas separadas para operaciones in-place y estabilizadas.',
          'Soporte de normalización de NOI para ajustes únicos y recurrentes.',
          'Salidas de dimensionamiento bajo DSCR, debt yield y apalancamiento.',
          'Grillas de sensibilidad para ocupación, crecimiento de renta y gastos.',
          'Escenarios de refinanciamiento y disposición según período de tenencia.',
        ],
      },
      {
        title: 'Estándares de modelado',
        items: [
          'Vincule cada partida a T12, rent roll, evidencia de mercado o planes operativos.',
          'Documente fuentes de supuestos para revisión del prestamista.',
          'Mantenga pestañas de respaldo auditables junto a salidas de presentación.',
        ],
      },
      {
        title: 'Errores comunes a evitar',
        items: [
          'Sobreestimar crecimiento de renta sin soporte de submercado.',
          'Subestimar seguros, impuestos, nómina y reservas de reemplazo.',
          'Dimensionar deuda con una sola métrica en lugar de múltiples restricciones.',
          'Ignorar supuestos de extensión y refinanciamiento en deals transicionales.',
        ],
      },
      {
        title: 'Flujo de implementación',
        items: [
          'Importe T12 y rent roll; complete normalización de NOI primero.',
          'Defina supuestos base y ejecute dimensionamiento bajo restricciones.',
          'Construya escenarios downside e identifique puntos de quiebre antes de cotizar.',
          'Empaquete salidas para prestamistas con comentario claro de supuestos.',
        ],
      },
    ],
  },
};

export function getChecklist(id: string): ChecklistDefinition | undefined {
  return CHECKLISTS[id];
}

export const VALID_CHECKLIST_IDS = Object.keys(CHECKLISTS);
