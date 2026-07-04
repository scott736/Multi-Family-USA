import { ArrowRight, Phone } from "lucide-react";

import { SITE_PHONE, SITE_PHONE_HREF, SITE_SHORT_NAME } from "../../consts";

const navigationEn = [
  {
    title: "Learn",
    links: [
      { name: "Fundamentals", href: "/learn" },
      { name: "Guides", href: "/learn" },
      { name: "FAQ", href: "/faq" },
      { name: "Glossary", href: "/glossary" },
    ],
  },
  {
    title: "Tools",
    links: [
      { name: "Cap Rate & NOI", href: "/tools/cap-rate-noi-calculator" },
      { name: "Debt Yield", href: "/tools/debt-yield-calculator" },
      { name: "Commercial DSCR", href: "/tools/commercial-dscr-calculator" },
      { name: "Loan Sizing", href: "/tools/loan-sizing-calculator" },
    ],
  },
  {
    title: "Markets",
    links: [
      { name: "States", href: "/states" },
      { name: "Cities", href: "/cities" },
      { name: "Rates", href: "/rates" },
      { name: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/about" },
      { name: "Editorial Standards", href: "/editorial-standards" },
      { name: "Team", href: "/team" },
      { name: "Book Strategy Call", href: "/book-strategy-call" },
      { name: "Free Deal Review", href: "/deal-review" },
    ],
  },
];

const navigationEs = [
  {
    title: "Aprender",
    links: [
      { name: "Fundamentos", href: "/es/learn" },
      { name: "Guías", href: "/es/learn" },
      { name: "FAQ", href: "/es/faq" },
    ],
  },
  {
    title: "Herramientas",
    links: [
      { name: "Cap rate y NOI", href: "/tools/cap-rate-noi-calculator" },
      { name: "Debt yield", href: "/tools/debt-yield-calculator" },
      { name: "DSCR comercial", href: "/tools/commercial-dscr-calculator" },
      { name: "Dimensionamiento", href: "/tools/loan-sizing-calculator" },
    ],
  },
  {
    title: "Mercados",
    links: [
      { name: "Estados", href: "/es/states" },
      { name: "Ciudades", href: "/es/cities" },
      { name: "Blog", href: "/es/blog" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { name: "Acerca de", href: "/es/about" },
      { name: "Reservar llamada", href: "/es/book-strategy-call" },
      { name: "Revisión gratuita", href: "/es/deal-review" },
      { name: "Contacto", href: "/es/contact" },
    ],
  },
];

const legalEn = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
  { name: "Cookie Policy", href: "/cookie-policy" },
];

const legalEs = [
  { name: "Política de privacidad", href: "/es/privacy" },
  { name: "Términos de servicio", href: "/es/terms" },
  { name: "Política de cookies", href: "/es/cookie-policy" },
];

interface FooterProps {
  currentPath?: string;
}

const CTA_HIDDEN_PATHS = ["/deal-review", "/book-strategy-call", "/thank-you", "/contact", "/booking"];

export function Footer({ currentPath = "/" }: FooterProps) {
  const isEs = currentPath === "/es" || currentPath.startsWith("/es/");
  const navigation = isEs ? navigationEs : navigationEn;
  const legal = isEs ? legalEs : legalEn;
  const showCta = !CTA_HIDDEN_PATHS.some((p) => currentPath.includes(p));
  const tagline = isEs
    ? "Recurso neutral de financiamiento multifamiliar comercial en EE. UU. enfocado en activos de 5+ unidades y suscripción lista para ejecución."
    : "Neutral US commercial multifamily financing resource focused on 5+ unit assets and execution-ready underwriting.";
  const editorialNote = isEs
    ? `Nota editorial: ${SITE_SHORT_NAME} es un editor educativo independiente y plataforma de enrutamiento de leads. Podemos recibir compensación de prestamistas socios cuando se cierra un préstamo financiado, pero la compensación no influye en nuestro análisis ni en la metodología de las calculadoras.`
    : `Editorial note: ${SITE_SHORT_NAME} is an independent educational publisher and lead-routing platform. We may earn compensation from partner lenders when a funded loan closes, but compensation does not influence our analysis or calculator methodology.`;
  const rightsReserved = isEs ? "Todos los derechos reservados." : "All rights reserved.";

  return (
    <footer className="border-t border-border bg-secondary/30 text-foreground">
      {showCta && (
        <div className="container pt-12 md:pt-14">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[hsl(215_55%_12%)] to-[hsl(215_50%_8%)] px-6 py-10 shadow-xl shadow-primary/15 md:px-12 md:py-12 dark:from-[hsl(215_50%_14%)] dark:via-[hsl(215_52%_10%)] dark:to-[hsl(215_55%_7%)] dark:ring-1 dark:ring-white/10">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, hsl(0 0% 100% / 0.07) 1px, transparent 0)",
                backgroundSize: "26px 26px",
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/15 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                  {isEs ? "Gratis · Sin consulta de crédito" : "Free · No credit pull"}
                </p>
                <h2 className="mt-3 max-w-xl text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {isEs
                    ? "¿Listo para revisar su próxima operación multifamiliar?"
                    : "Ready to pressure-test your next multifamily deal?"}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 md:text-base">
                  {isEs
                    ? "Envíe sus supuestos y reciba una lectura de suscripción y encaje con prestamistas — usualmente en una hora hábil."
                    : "Send your assumptions and get an underwriting and lender-fit read back — usually within one business hour."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <a
                  href={isEs ? "/es/deal-review" : "/deal-review"}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/25 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/35"
                  data-analytics-location="footer-cta"
                >
                  {isEs ? "Revisión gratuita del deal" : "Get My Free Deal Review"}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </a>
                <a
                  href={isEs ? "/es/book-strategy-call" : "/book-strategy-call"}
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.12]"
                  data-analytics-location="footer-cta"
                >
                  {isEs ? "Reservar llamada de 30 min" : "Book a 30-Min Strategy Call"}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:gap-8">
          <div className="max-w-xs">
            <a href={isEs ? "/es" : "/"} className="mb-4 flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold text-primary-foreground shadow-sm">
                M
              </span>
              <span className="text-lg font-bold tracking-tight">{SITE_SHORT_NAME}</span>
            </a>
            <p className="text-sm leading-relaxed text-muted-foreground">{tagline}</p>
            <a
              href={SITE_PHONE_HREF}
              className="mt-5 inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-semibold shadow-xs transition-colors hover:border-accent/50 hover:text-accent"
            >
              <Phone className="size-4 text-accent" /> {SITE_PHONE}
            </a>
          </div>

          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-foreground/80">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.name}`}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-accent"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground/80">{editorialNote}</p>
          <div className="mt-5 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {SITE_SHORT_NAME}.{" "}
              {rightsReserved}
            </span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {legal.map((link) => (
                <a key={link.href} href={link.href} className="transition-colors hover:text-accent">
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
