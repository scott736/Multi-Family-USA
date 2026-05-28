import { Phone } from "lucide-react";

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

export function Footer({ currentPath = "/" }: FooterProps) {
  const isEs = currentPath === "/es" || currentPath.startsWith("/es/");
  const navigation = isEs ? navigationEs : navigationEn;
  const legal = isEs ? legalEs : legalEn;
  const tagline = isEs
    ? "Recurso neutral de financiamiento multifamiliar comercial en EE. UU. enfocado en activos de 5+ unidades y suscripción lista para ejecución."
    : "Neutral US commercial multifamily financing resource focused on 5+ unit assets and execution-ready underwriting.";
  const editorialNote = isEs
    ? `Nota editorial: ${SITE_SHORT_NAME} es un editor educativo independiente y plataforma de enrutamiento de leads. Podemos recibir compensación de prestamistas socios cuando se cierra un préstamo financiado, pero la compensación no influye en nuestro análisis ni en la metodología de las calculadoras.`
    : `Editorial note: ${SITE_SHORT_NAME} is an independent educational publisher and lead-routing platform. We may earn compensation from partner lenders when a funded loan closes, but compensation does not influence our analysis or calculator methodology.`;
  const rightsReserved = isEs ? "Todos los derechos reservados." : "All rights reserved.";
  return (
    <footer className="border-t border-border bg-secondary/30 text-foreground">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <a href={isEs ? "/es" : "/"} className="flex items-center gap-2 mb-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary font-serif text-lg font-bold text-primary-foreground">
                M
              </span>
              <span className="text-lg font-bold tracking-tight">{SITE_SHORT_NAME}</span>
            </a>
            <p className="text-sm text-muted-foreground">{tagline}</p>
            <a href={SITE_PHONE_HREF} className="mt-4 inline-flex items-center gap-2 font-semibold hover:text-primary">
              <Phone className="size-4 text-accent" /> {SITE_PHONE}
            </a>
          </div>

          {navigation.map((section) => (
            <div key={section.title}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-foreground">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">{editorialNote}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {SITE_SHORT_NAME}. {rightsReserved}
            </span>
            {legal.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-primary">
                {link.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
