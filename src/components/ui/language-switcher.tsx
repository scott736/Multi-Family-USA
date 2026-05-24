import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  /** Current page language — "en" | "es" */
  currentLang?: "en" | "es";
  /** English page path (default: "/") */
  enPath?: string;
  /** Spanish page path (default: "/es") */
  esPath?: string;
  className?: string;
  /** Visual variant */
  variant?: "pill" | "icon" | "text";
}

const LABELS = {
  en: { short: "EN", full: "English", flag: "🇺🇸" },
  es: { short: "ES", full: "Español", flag: "🇲🇽" },
} as const;

export default function LanguageSwitcher({
  currentLang = "en",
  enPath = "/",
  esPath = "/es",
  className,
  variant = "pill",
}: LanguageSwitcherProps) {
  const otherLang = currentLang === "en" ? "es" : "en";
  const otherPath = currentLang === "en" ? esPath : enPath;
  const otherLabel = LABELS[otherLang];

  if (variant === "text") {
    return (
      <a
        href={otherPath}
        lang={otherLang}
        hrefLang={otherLang}
        aria-label={`Switch to ${otherLabel.full}`}
        className={cn(
          "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
          className,
        )}
      >
        {otherLabel.full}
      </a>
    );
  }

  if (variant === "icon") {
    return (
      <a
        href={otherPath}
        lang={otherLang}
        hrefLang={otherLang}
        aria-label={`Switch to ${otherLabel.full}`}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
          className,
        )}
        title={`${otherLabel.full}`}
      >
        {otherLabel.short}
      </a>
    );
  }

  // Default: pill variant — shows both languages, highlights current
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5",
        className,
      )}
      role="group"
      aria-label="Language selector"
    >
      {(["en", "es"] as const).map((lang) => {
        const isCurrent = lang === currentLang;
        const path = lang === "en" ? enPath : esPath;
        return (
          <a
            key={lang}
            href={isCurrent ? undefined : path}
            lang={lang}
            hrefLang={lang}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={LABELS[lang].full}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              isCurrent
                ? "bg-background text-foreground shadow-sm cursor-default pointer-events-none"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden="true">{LABELS[lang].flag}</span>
            {LABELS[lang].short}
          </a>
        );
      })}
    </div>
  );
}
