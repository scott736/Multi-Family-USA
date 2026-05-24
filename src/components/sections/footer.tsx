import { Phone } from "lucide-react";

import { SITE_PHONE, SITE_PHONE_HREF, SITE_SHORT_NAME } from "../../consts";

const navigation = [
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

const legal = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
  { name: "Cookie Policy", href: "/cookie-policy" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30 text-foreground">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary font-serif text-lg font-bold text-primary-foreground">
                M
              </span>
              <span className="text-lg font-bold tracking-tight">{SITE_SHORT_NAME}</span>
            </a>
            <p className="text-sm text-muted-foreground">
              Neutral US commercial multifamily financing resource focused on 5+ unit assets and execution-ready underwriting.
            </p>
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
          <p className="text-xs text-muted-foreground">
            Editorial note: {SITE_SHORT_NAME} is an independent educational publisher and lead-routing platform.
            We may earn compensation from partner lenders when a funded loan closes, but compensation does not influence
            our analysis or calculator methodology.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} {SITE_SHORT_NAME}. All rights reserved.</span>
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
