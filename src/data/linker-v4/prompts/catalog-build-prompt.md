# Page Catalog Enrichment Task

You are helping build a page catalog for an internal linking system.
For each page below, generate a **purpose card** that describes what the page delivers to readers.

## Output Format

Return a JSON array of objects with this structure for each page:
```json
{
  "slug": "the-page-slug",
  "readerPromise": "One sentence: what the reader gets by visiting this page",
  "topicsCovered": ["topic1", "topic2", "topic3"],
  "questionsAnswered": ["What is X?", "How do I Y?"],
  "linkWhen": ["when the article discusses X", "when the reader needs help with Y"],
  "doNotLinkWhen": ["when the article only mentions X in passing", "when the context is about Z not Y"]
}
```

## Guidelines

- **readerPromise**: Be specific about what the READER gets, not what the PAGE contains.
  Example: 'Learn how DSCR loans let you qualify for US rentals using property income instead of personal income'
- **topicsCovered**: 5-8 specific topics covered in depth
- **questionsAnswered**: 3-5 real questions a reader can get answered
- **linkWhen**: 3-5 contexts in a blog post where linking helps the reader
- **doNotLinkWhen**: 2-4 contexts where linking would mislead the reader
  Example: linking to DSCR page when the article is about Canadian conventional mortgages

## Pages to Enrich

### Multifamily Loan Types
- **URL**: /loan-types/
- **Type**: pillar
- **Description**: Compare agency, bridge, bank, CMBS, debt fund, FHA/HUD, and Freddie Mac Optigo multifamily loan executions for US 5+ unit properties.
- **Region**: usa
- **Tags**: multifamily, commercial-financing, agency, bridge

### Multifamily Property Types
- **URL**: /property-types/
- **Type**: pillar
- **Description**: Financing and underwriting guides for garden-style, mid-rise, suburban, and value-add C-class multifamily assets.
- **Region**: usa
- **Tags**: multifamily, property-types

### Multifamily Financing Guides
- **URL**: /learn/
- **Type**: pillar
- **Description**: Plain-English guides covering commercial DSCR, debt yield, NOI normalization, agency vs bridge, and closing checklists.
- **Region**: usa
- **Tags**: education, underwriting, multifamily

### Multifamily Underwriting Calculators
- **URL**: /tools/
- **Type**: pillar
- **Description**: Free commercial DSCR, cap rate / NOI, debt yield, cash-on-cash, and loan sizing calculators for multifamily sponsors.
- **Region**: usa
- **Tags**: tools, dscr-loans, underwriting

### Multifamily Financing by State
- **URL**: /states/
- **Type**: pillar
- **Description**: State-by-state multifamily financing overviews covering tax, foreclosure, rent control, and capital market context.
- **Region**: usa
- **Tags**: markets, states

### Multifamily Financing by City
- **URL**: /cities/
- **Type**: pillar
- **Description**: City-level multifamily market snapshots with pricing, rents, and financing implications for US apartment investors.
- **Region**: usa
- **Tags**: markets, cities

### Compare Multifamily Capital Options
- **URL**: /compare/
- **Type**: pillar
- **Description**: Side-by-side comparisons of agency vs bridge, bank vs debt fund, fixed vs floating, recourse, CMBS, and FHA paths.
- **Region**: usa
- **Tags**: compare, capital-stack

### Investor Playbooks
- **URL**: /invest/
- **Type**: pillar
- **Description**: Capital strategy playbooks for first-time buyers, value-add sponsors, small portfolio operators, and institutional growth.
- **Region**: usa
- **Tags**: investing, sponsors

### Multifamily Financing Checklists
- **URL**: /checklists/
- **Type**: pillar
- **Description**: Due diligence, lender document, and pro forma checklists for commercial multifamily debt execution.
- **Region**: usa
- **Tags**: checklists, execution

### Multifamily Rate Context
- **URL**: /rates/
- **Type**: pillar
- **Description**: Current multifamily rate and spread context for agency, bridge, and bank executions.
- **Region**: usa
- **Tags**: rates, spreads

### Book a Strategy Call
- **URL**: /book-strategy-call/
- **Type**: pillar
- **Description**: Book a free multifamily strategy call with Multi-Family USA to review debt structure and lender fit.
- **Region**: usa
- **Tags**: booking

### Free Multifamily Deal Review
- **URL**: /deal-review/
- **Type**: pillar
- **Description**: Submit a multifamily deal for a free lender-fit and underwriting review.
- **Region**: usa
- **Tags**: deal-review

### Commercial DSCR Calculator
- **URL**: /tools/commercial-dscr-calculator/
- **Type**: page
- **Description**: Calculate commercial debt service coverage ratio for US multifamily (5+ unit) deals.
- **Region**: usa
- **Tags**: dscr-loans, tools, underwriting

### Cap Rate & NOI Calculator
- **URL**: /tools/cap-rate-noi-calculator/
- **Type**: page
- **Description**: Calculate cap rate and net operating income for multifamily acquisitions and refinances.
- **Region**: usa
- **Tags**: cap-rate, noi, tools

### Debt Yield Calculator
- **URL**: /tools/debt-yield-calculator/
- **Type**: page
- **Description**: Calculate debt yield — the binding constraint on many agency and CMBS multifamily term sheets.
- **Region**: usa
- **Tags**: debt-yield, tools, underwriting

### Loan Sizing Calculator
- **URL**: /tools/loan-sizing-calculator/
- **Type**: page
- **Description**: Size multifamily loan proceeds using DSCR, debt yield, and LTV constraints.
- **Region**: usa
- **Tags**: loan-sizing, tools, underwriting

### Cash-on-Cash Calculator
- **URL**: /tools/cash-on-cash-calculator/
- **Type**: page
- **Description**: Calculate cash-on-cash return for leveraged multifamily investments.
- **Region**: usa
- **Tags**: cash-on-cash, tools

### Multifamily Due Diligence Checklist
- **URL**: /checklists/due-diligence-checklist/
- **Type**: page
- **Description**: Due diligence checklist for US commercial multifamily acquisitions.
- **Region**: usa
- **Tags**: checklists, due-diligence

### Lender Document Checklist
- **URL**: /checklists/lender-document-checklist/
- **Type**: page
- **Description**: Document package checklist lenders expect for multifamily debt.
- **Region**: usa
- **Tags**: checklists, lender-docs

### Multifamily Pro Forma Template
- **URL**: /checklists/pro-forma-template/
- **Type**: page
- **Description**: Pro forma structure lenders expect for multifamily underwriting.
- **Region**: usa
- **Tags**: checklists, pro-forma

### Multifamily Financing Glossary
- **URL**: /glossary/
- **Type**: page
- **Description**: Definitions for commercial multifamily financing and underwriting terms.
- **Region**: usa
- **Tags**: education, glossary

### About Multi-Family USA
- **URL**: /about/
- **Type**: page
- **Description**: About Multi-Family USA — commercial multifamily financing resource.
- **Region**: usa
- **Tags**: none

### Fannie Mae Multifamily Loan — Agency Stabilized
- **URL**: /loan-types/agency-stabilized/
- **Type**: page
- **Description**: Fannie Mae multifamily loan execution for stabilized US apartment buildings (5+ units)—agency underwriting, DSCR, debt yield, and fit vs bridge or CMBS.
- **Region**: usa
- **Tags**: loan-types, multifamily, fannie mae multifamily loan, fannie mae apartment loan, agency stabilized multifamily loan, fannie mae multifamily rates, multifamily financing

### Bank Balance-Sheet Multifamily Loan
- **URL**: /loan-types/bank-balance-sheet/
- **Type**: page
- **Description**: Execution framework for Bank Balance-Sheet Multifamily Loan in US commercial multifamily financing, including fit, constraints, and risk controls.
- **Region**: usa
- **Tags**: loan-types, multifamily, bank balance-sheet multifamily loan, multifamily financing, commercial apartment loan, loan structure

### Bridge Loan for Value-Add Multifamily
- **URL**: /loan-types/bridge-value-add/
- **Type**: page
- **Description**: Execution framework for Bridge Loan for Value-Add Multifamily in US commercial multifamily financing, including fit, constraints, and risk controls.
- **Region**: usa
- **Tags**: loan-types, multifamily, bridge loan for value-add multifamily, multifamily financing, commercial apartment loan, loan structure

### CMBS Stabilized Multifamily Loan
- **URL**: /loan-types/cmbs-stabilized/
- **Type**: page
- **Description**: Execution framework for CMBS stabilized multifamily financing on US 5+ unit assets, including sizing, prepayment, and servicing considerations.
- **Region**: usa
- **Tags**: loan-types, multifamily, cmbs multifamily loan, cmbs stabilized financing, commercial mortgage backed securities, multifamily permanent debt

### Debt Fund Floating-Rate Loan
- **URL**: /loan-types/debt-fund-floating-rate/
- **Type**: page
- **Description**: Execution framework for Debt Fund Floating-Rate Loan in US commercial multifamily financing, including fit, constraints, and risk controls.
- **Region**: usa
- **Tags**: loan-types, multifamily, debt fund floating-rate loan, multifamily financing, commercial apartment loan, loan structure

### FHA HUD Multifamily Loan
- **URL**: /loan-types/fha-hud-multifamily/
- **Type**: page
- **Description**: FHA and HUD multifamily loan execution for eligible US apartment projects—including 221(d)(4) construction/rehab and 223(f) acquisition/refinance context.
- **Region**: usa
- **Tags**: loan-types, multifamily, fha hud multifamily loan, fha 221d4, hud 223f, fha multifamily loan, hud apartment financing

### Freddie Mac Optigo Multifamily Loan
- **URL**: /loan-types/freddie-mac-optigo/
- **Type**: page
- **Description**: Freddie Mac Optigo multifamily loan execution for stabilized US apartment buildings (5+ units)—agency underwriting, DSCR, debt yield, and fit vs Fannie or bridge.
- **Region**: usa
- **Tags**: loan-types, multifamily, freddie mac optigo multifamily loan, freddie mac multifamily loan, optigo apartment loan, agency multifamily loan, freddie mac multifamily rates

### Garden-Style Multifamily Financing Guide
- **URL**: /property-types/garden-style-multifamily/
- **Type**: page
- **Description**: Underwriting and debt execution guide for Garden-Style Multifamily assets in US multifamily financing (minimum 5 units).
- **Region**: usa
- **Tags**: property-types, multifamily, garden-style multifamily, multifamily property type, apartment underwriting, commercial multifamily loan

### Large Suburban Apartment Communities Financing Guide
- **URL**: /property-types/large-suburban-apartment/
- **Type**: page
- **Description**: Underwriting and debt execution guide for Large Suburban Apartment Communities assets in US multifamily financing (minimum 5 units).
- **Region**: usa
- **Tags**: property-types, multifamily, large suburban apartment communities, multifamily property type, apartment underwriting, commercial multifamily loan

### Mid-Rise Urban Multifamily Financing Guide
- **URL**: /property-types/mid-rise-urban-multifamily/
- **Type**: page
- **Description**: Underwriting and debt execution guide for Mid-Rise Urban Multifamily assets in US multifamily financing (minimum 5 units).
- **Region**: usa
- **Tags**: property-types, multifamily, mid-rise urban multifamily, multifamily property type, apartment underwriting, commercial multifamily loan

### Value-Add C-Class Multifamily Financing Guide
- **URL**: /property-types/value-add-c-class-multifamily/
- **Type**: page
- **Description**: Underwriting and debt execution guide for Value-Add C-Class Multifamily assets in US multifamily financing (minimum 5 units).
- **Region**: usa
- **Tags**: property-types, multifamily, value-add c-class multifamily, multifamily property type, apartment underwriting, commercial multifamily loan

### Agency vs Bridge Execution: Choosing the Right Path
- **URL**: /learn/agency-vs-bridge-execution/
- **Type**: page
- **Description**: Execution playbook for selecting agency versus bridge debt on US multifamily transactions and recapitalizations.
- **Region**: usa
- **Tags**: guides, education, agency vs bridge, multifamily bridge loan, fannie freddie loan, value add financing

### Apartment Building Loan Guide (5+ Units)
- **URL**: /learn/apartment-building-loan-guide/
- **Type**: page
- **Description**: How to get an apartment building loan or apartment complex loan for US commercial multifamily—products, underwriting, and execution for 5+ unit properties.
- **Region**: usa
- **Tags**: guides, education, apartment building loan, apartment complex loan, loans for apartment buildings, commercial multifamily financing, 5+ unit apartment loan

### Capital Stack Design for Value-Add Multifamily
- **URL**: /learn/capital-stack-design-for-value-add/
- **Type**: page
- **Description**: Capital stack design guide for value-add multifamily projects, covering senior debt, mezzanine, pref equity, and sponsor equity.
- **Region**: usa
- **Tags**: guides, education, capital stack, value add multifamily, pref equity, bridge loan structure

### Commercial DSCR Loan Guide for Multifamily
- **URL**: /learn/commercial-dscr-explained/
- **Type**: page
- **Description**: Commercial DSCR loan guide for US multifamily (5+ units)—how lenders calculate DSCR, thresholds by product, and improvement strategies for apartment financing.
- **Region**: usa
- **Tags**: guides, education, commercial dscr loan, commercial dscr, multifamily dscr, dscr calculator multifamily, apartment loan qualification

### Debt Yield and LTV: A Practical Framework
- **URL**: /learn/debt-yield-and-ltv-framework/
- **Type**: page
- **Description**: Practical debt yield and LTV framework for multifamily sponsors balancing proceeds, resilience, and refinance risk.
- **Region**: usa
- **Tags**: guides, education, debt yield, loan to value, multifamily leverage, refinance risk

### Entity Structure for Multifamily Borrowing
- **URL**: /learn/entity-structure-for-multifamily-borrowing/
- **Type**: page
- **Description**: Entity structure, LLC borrowing, guarantor frameworks, and vesting considerations for US commercial multifamily financing on 5+ unit assets.
- **Region**: usa
- **Tags**: guides, education, multifamily entity structure, llc borrowing, guarantor framework, spe multifamily, borrowing entity

### FHA and HUD Multifamily Financing Guide
- **URL**: /learn/fha-hud-multifamily-financing/
- **Type**: page
- **Description**: FHA multifamily loan and HUD multifamily loan overview—including FHA 221(d)(4) and execution context for US apartment developers and sponsors.
- **Region**: usa
- **Tags**: guides, education, fha multifamily loan, hud multifamily loan, fha 221d4, hud apartment financing, government multifamily loan

### Five-Plus Unit Commercial Financing Basics
- **URL**: /learn/five-plus-unit-commercial-financing-basics/
- **Type**: page
- **Description**: Why US multifamily financing changes at five units—commercial vs residential lending boundaries, products, and underwriting for apartment investors.
- **Region**: usa
- **Tags**: guides, education, five plus unit financing, commercial multifamily lending, 5 unit apartment loan, multifamily vs residential

### Multifamily Cash-Out Refinance Guide
- **URL**: /learn/multifamily-cash-out-refinance/
- **Type**: page
- **Description**: Cash-out refinance framework for US commercial multifamily sponsors—seasoning, proceeds sizing, lender criteria, and use-of-proceeds planning on 5+ unit assets.
- **Region**: usa
- **Tags**: guides, education, multifamily cash out refinance, commercial cash out refi, apartment refinance proceeds, seasoning multifamily

### Multifamily Closing Checklist for Debt Execution
- **URL**: /learn/multifamily-close-checklist/
- **Type**: page
- **Description**: Comprehensive closing checklist for multifamily debt execution from signed term sheet through funding.
- **Region**: usa
- **Tags**: guides, education, multifamily closing checklist, loan closing process, debt execution, lender due diligence

### Multifamily Construction Financing Guide
- **URL**: /learn/multifamily-construction-financing/
- **Type**: page
- **Description**: Multifamily construction loan and apartment construction financing for US 5+ unit ground-up and major rehab projects—products, draws, and lender expectations.
- **Region**: usa
- **Tags**: guides, education, multifamily construction loan, apartment construction financing, ground-up multifamily loan, construction to permanent multifamily, development financing

### NOI Normalization for Real-World Underwriting
- **URL**: /learn/multifamily-noi-normalization/
- **Type**: page
- **Description**: Detailed NOI normalization guide for multifamily acquisitions, refinances, and debt sizing conversations.
- **Region**: usa
- **Tags**: guides, education, noi normalization, multifamily underwriting, expense underwriting, t12 analysis

### Multifamily Underwriting Basics for 5+ Unit Deals
- **URL**: /learn/multifamily-underwriting-basics/
- **Type**: page
- **Description**: Comprehensive underwriting framework for US commercial multifamily acquisitions and refinances on 5+ unit properties.
- **Region**: usa
- **Tags**: guides, education, multifamily underwriting, apartment financing, commercial DSCR, debt sizing

### Operator Reporting Packages Lenders Actually Read
- **URL**: /learn/operator-reporting-for-lenders/
- **Type**: page
- **Description**: Guide to building lender-grade reporting packages that improve multifamily debt execution and post-close relationships.
- **Region**: usa
- **Tags**: guides, education, lender reporting, multifamily operations, asset management reporting, loan compliance

### Rate Risk and Refinance Planning
- **URL**: /learn/rate-risk-and-refinance-planning/
- **Type**: page
- **Description**: Rate risk and refinance planning framework for multifamily sponsors using agency, bridge, and CMBS executions.
- **Region**: usa
- **Tags**: guides, education, rate risk, refinance planning, multifamily floating rate, interest rate stress

### Stabilized vs Transitional Assets in Debt Structuring
- **URL**: /learn/stabilized-vs-transitional-assets/
- **Type**: page
- **Description**: Framework for financing stabilized and transitional multifamily assets with lender-specific expectations and risk controls.
- **Region**: usa
- **Tags**: guides, education, stabilized multifamily, transitional multifamily, bridge to agency, asset stabilization

### Acquisition vs Refinance Financing
- **URL**: /compare/acquisition-vs-refinance/
- **Type**: page
- **Description**: Decision framework comparing acquisition and refinance financing paths for US commercial multifamily sponsors on 5+ unit assets.
- **Region**: usa
- **Tags**: compare, acquisition vs refinance, multifamily acquisition financing, multifamily refinance, apartment loan comparison

### Agency vs Bridge for Multifamily
- **URL**: /compare/agency-vs-bridge/
- **Type**: page
- **Description**: Decision framework comparing Agency Debt and Bridge Debt for US multifamily financing execution on 5+ unit assets.
- **Region**: usa
- **Tags**: compare, agency debt vs bridge debt, multifamily debt comparison, capital stack decision, apartment loan strategy

### Bank vs Debt Fund Execution
- **URL**: /compare/bank-vs-debt-fund/
- **Type**: page
- **Description**: Decision framework comparing Bank Loan and Debt Fund Loan for US multifamily financing execution on 5+ unit assets.
- **Region**: usa
- **Tags**: compare, bank loan vs debt fund loan, multifamily debt comparison, capital stack decision, apartment loan strategy

### CMBS vs Agency Multifamily Financing
- **URL**: /compare/cmbs-vs-agency-multifamily/
- **Type**: page
- **Description**: Compare CMBS and agency multifamily loans for US apartment investors—proceeds, prepay, recourse, and execution on stabilized 5+ unit assets.
- **Region**: usa
- **Tags**: compare, cmbs vs agency multifamily, cmbs apartment loan, fannie mae vs cmbs, multifamily permanent debt comparison

### FHA HUD vs Agency Multifamily Financing
- **URL**: /compare/fha-vs-agency-multifamily/
- **Type**: page
- **Description**: Compare FHA HUD multifamily programs and Fannie Mae agency debt for US apartment sponsors—timelines, fit, and execution trade-offs on 5+ unit properties.
- **Region**: usa
- **Tags**: compare, fha vs agency multifamily, hud vs fannie mae multifamily, fha 221d4 vs agency, government vs agency apartment loan

### Fixed vs Floating-Rate Multifamily Debt
- **URL**: /compare/fixed-vs-floating-rate/
- **Type**: page
- **Description**: Decision framework comparing Fixed-Rate Debt and Floating-Rate Debt for US multifamily financing execution on 5+ unit assets.
- **Region**: usa
- **Tags**: compare, fixed-rate debt vs floating-rate debt, multifamily debt comparison, capital stack decision, apartment loan strategy

### Recourse vs Non-Recourse Structures
- **URL**: /compare/recourse-vs-nonrecourse/
- **Type**: page
- **Description**: Decision framework comparing Recourse Debt and Non-Recourse Debt for US multifamily financing execution on 5+ unit assets.
- **Region**: usa
- **Tags**: compare, recourse debt vs non-recourse debt, multifamily debt comparison, capital stack decision, apartment loan strategy

### First-Time Multifamily Buyer Playbook
- **URL**: /invest/first-time-multifamily-buyer/
- **Type**: page
- **Description**: Capital strategy and underwriting playbook for the First-time multifamily buyer profile in US multifamily financing.
- **Region**: usa
- **Tags**: invest, sponsors, first-time multifamily buyer, multifamily investor profile, portfolio strategy, apartment financing

### Institutional Growth Operator Playbook
- **URL**: /invest/institutional-growth-operator/
- **Type**: page
- **Description**: Capital strategy and underwriting playbook for the Institutional growth operator profile in US multifamily financing.
- **Region**: usa
- **Tags**: invest, sponsors, institutional growth operator, multifamily investor profile, portfolio strategy, apartment financing

### Small Portfolio Operator Playbook
- **URL**: /invest/small-portfolio-operator/
- **Type**: page
- **Description**: Capital strategy and underwriting playbook for the Small portfolio operator profile in US multifamily financing.
- **Region**: usa
- **Tags**: invest, sponsors, small portfolio operator, multifamily investor profile, portfolio strategy, apartment financing

### Value-Add Sponsor Playbook
- **URL**: /invest/value-add-sponsor/
- **Type**: page
- **Description**: Capital strategy and underwriting playbook for the Value-add sponsor profile in US multifamily financing.
- **Region**: usa
- **Tags**: invest, sponsors, value-add sponsor, multifamily investor profile, portfolio strategy, apartment financing
