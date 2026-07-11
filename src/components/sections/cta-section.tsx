import { Button } from "@/components/ui/button";
import { Building2, ChevronRight } from "@/components/ui/icons";
import { trackConversion } from "@/lib/analytics";
import { getPageCta, type PageCtaConfig } from "@/lib/page-cta";

interface CtaSectionProps {
  lang?: string;
  /** Current page pathname for contextual CTA lookup */
  pathname?: string;
  /** Optional explicit override — skips path-based lookup */
  config?: PageCtaConfig;
}

export default function CtaSection({
  lang: _lang = "en",
  pathname,
  config,
}: CtaSectionProps) {
  const ctaContent = config || (pathname ? getPageCta(pathname) : getPageCta("/"));

  const trackSecondary = () => {
    trackConversion("cta_click", {
      type: ctaContent.secondary.type,
      location: "cta_section",
    });
  };

  return (
    <section id="cta" className="container py-12">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/20 via-card to-primary/10 px-6 py-10 text-center shadow-lg shadow-primary/[0.06] md:px-10 md:py-12">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-border bg-background">
          <Building2 className="size-5 text-accent" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
          {ctaContent.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
          {ctaContent.description}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-1">
            <a
              href={ctaContent.primary.href}
              onClick={() =>
                trackConversion("cta_click", {
                  type: ctaContent.primary.type,
                  location: "cta_section",
                })
              }
              data-analytics-location="smart-cta-primary"
            >
              {ctaContent.primary.label}
              <ChevronRight className="size-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-1">
            <a
              href={ctaContent.secondary.href}
              onClick={trackSecondary}
              data-analytics-location="smart-cta-secondary"
            >
              {ctaContent.secondary.label}
              <ChevronRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
