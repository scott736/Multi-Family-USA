'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  MapPin,
  Building2,
  Gavel,
  Clock,
  ShieldAlert,
  Ban,
  Percent,
  Landmark,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { REGION_PATHS } from './us-state-svg-paths';

/* ─────────────────────── Types ─────────────────────── */

export interface StateData {
  slug: string;
  stateName: string;
  stateCode: string;
  tier: '1' | '2' | '3' | 'special';
  statePropertyTax?: number;
  hasStateIncomeTax: boolean;
  foreclosureType: 'judicial' | 'non-judicial' | 'mixed';
  evictionTimelineDays?: string;
  rentControl: boolean;
  prohibitsPpp1to4Unit: boolean;
  topMarkets?: string[];
}

interface PathData {
  d: string;
  labelX: number;
  labelY: number;
}

type Lang = 'en' | 'es';

/* ──────────── Tier color palette ──────────── */

const TIER_COLORS: Record<string, string> = {
  '1': '#10b981', // success green — highest lender competition
  '2': '#f5b800', // accent amber — strong markets
  '3': '#f97316', // orange — unique friction
  special: '#ef4444', // destructive red — requires special attention
};

const TIER_LABEL_EN: Record<string, string> = {
  '1': 'Tier 1 — top market',
  '2': 'Tier 2 — strong market',
  '3': 'Tier 3 — high friction',
  special: 'Special attention',
};

const TIER_LABEL_ES: Record<string, string> = {
  '1': 'Nivel 1 — mercado principal',
  '2': 'Nivel 2 — mercado sólido',
  '3': 'Nivel 3 — alta fricción',
  special: 'Atención especial',
};

/* Small states that need a smaller label font to avoid overflow */
const SMALL_STATE_SLUGS = new Set([
  'delaware',
  'district-of-columbia',
  'rhode-island',
  'connecticut',
  'new-jersey',
  'massachusetts',
  'new-hampshire',
  'vermont',
  'maryland',
]);

/* Translates the foreclosureType value */
const foreclosureTypeLabel = (
  value: 'judicial' | 'non-judicial' | 'mixed',
  isEs: boolean,
): string => {
  if (isEs) {
    switch (value) {
      case 'judicial':
        return 'Judicial';
      case 'non-judicial':
        return 'No judicial';
      case 'mixed':
        return 'Mixta';
    }
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

/* ──────────────── Sub-components ──────────────── */

const RegionShape = ({
  slug,
  stateName,
  path,
  stateCode,
  isSelected,
  isHovered,
  index,
  color,
  onSelect,
  onHover,
  onLeave,
}: {
  slug: string;
  stateName: string;
  path: PathData;
  stateCode: string;
  isSelected: boolean;
  isHovered: boolean;
  index: number;
  color: string;
  onSelect: () => void;
  onHover: () => void;
  onLeave: () => void;
}) => {
  const labelSize = SMALL_STATE_SLUGS.has(slug) ? 6 : 10;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={stateName}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer outline-none focus-visible:outline-2"
    >
      {isSelected && (
        <motion.path
          d={path.d}
          fill={color}
          fillOpacity={0.25}
          stroke="none"
          filter="url(#us-region-glow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {isHovered && !isSelected && (
        <motion.path
          d={path.d}
          fill={color}
          fillOpacity={0.12}
          stroke="none"
          filter="url(#us-hover-glow)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}

      <motion.path
        d={path.d}
        fill={color}
        stroke={color}
        strokeLinejoin="round"
        initial={{ fillOpacity: 0, strokeOpacity: 0 }}
        animate={{
          fillOpacity: isSelected ? 0.65 : isHovered ? 0.48 : 0.28,
          strokeOpacity: isSelected ? 1 : isHovered ? 0.75 : 0.4,
          strokeWidth: isSelected ? 1.75 : isHovered ? 1.25 : 0.75,
        }}
        transition={{
          duration: 0.3,
          delay: isSelected || isHovered ? 0 : index * 0.01,
        }}
      />

      <motion.text
        x={path.labelX}
        y={path.labelY}
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none select-none"
        fill="white"
        style={{
          fontSize: labelSize,
          fontWeight: isSelected ? 700 : 600,
          letterSpacing: '0.04em',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: isSelected ? 1 : isHovered ? 0.95 : 0.7 }}
        transition={{ duration: 0.3, delay: index * 0.01 + 0.15 }}
      >
        {stateCode}
      </motion.text>
    </g>
  );
};

const MapTooltip = ({
  region,
  path,
  color,
  tierLabel,
}: {
  region: StateData;
  path: PathData;
  color: string;
  tierLabel: Record<string, string>;
}) => (
  <motion.g
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ duration: 0.15 }}
    className="pointer-events-none"
  >
    <rect
      x={path.labelX - 60}
      y={path.labelY - 42}
      width={120}
      height={30}
      rx={6}
      fill="rgba(10,10,20,0.94)"
      stroke={color}
      strokeWidth={1}
      strokeOpacity={0.55}
    />
    <rect
      x={path.labelX - 60}
      y={path.labelY - 42}
      width={3}
      height={30}
      rx={6}
      fill={color}
      fillOpacity={0.85}
    />
    <text
      x={path.labelX}
      y={path.labelY - 32}
      textAnchor="middle"
      dominantBaseline="central"
      fill="white"
      style={{ fontSize: 7.5, fontWeight: 600 }}
    >
      {region.stateName}
    </text>
    <text
      x={path.labelX}
      y={path.labelY - 22}
      textAnchor="middle"
      dominantBaseline="central"
      fill={color}
      style={{ fontSize: 6, fontWeight: 500 }}
    >
      {tierLabel[region.tier]}
    </text>
  </motion.g>
);

const DetailPanel = ({
  region,
  color,
  lang,
}: {
  region: StateData;
  color: string;
  lang: Lang;
}) => {
  const isEs = lang === 'es';
  const tierLabel = isEs ? TIER_LABEL_ES : TIER_LABEL_EN;

  const facts: { icon: typeof Percent; label: string; value: string }[] = [
    {
      icon: Percent,
      label: isEs ? 'Impuesto efectivo a la propiedad' : 'Effective property tax',
      value:
        region.statePropertyTax != null
          ? `${region.statePropertyTax.toFixed(2)}%`
          : isEs
            ? 'Varía'
            : 'Varies',
    },
    {
      icon: Landmark,
      label: isEs ? 'Impuesto estatal sobre la renta' : 'State income tax',
      value: region.hasStateIncomeTax
        ? isEs
          ? 'Sí'
          : 'Yes'
        : isEs
          ? 'Ninguno'
          : 'None',
    },
    {
      icon: Gavel,
      label: isEs ? 'Ejecución hipotecaria' : 'Foreclosure',
      value: foreclosureTypeLabel(region.foreclosureType, isEs),
    },
    {
      icon: Clock,
      label: isEs ? 'Plazo de desalojo' : 'Eviction timeline',
      value:
        region.evictionTimelineDays ?? (isEs ? 'Varía' : 'Varies'),
    },
    {
      icon: ShieldAlert,
      label: isEs ? 'Control de rentas' : 'Rent control',
      value: region.rentControl
        ? isEs
          ? 'Sí — revisa las reglas locales'
          : 'Yes — review local rules'
        : isEs
          ? 'No'
          : 'No',
    },
    {
      icon: Ban,
      label: isEs ? 'PPP en 1–4 unidades' : 'PPP on 1–4 unit',
      value: region.prohibitsPpp1to4Unit
        ? isEs
          ? 'Prohibido'
          : 'Prohibited'
        : isEs
          ? 'Permitido'
          : 'Permitted',
    },
  ];

  return (
    <motion.div
      key={region.slug}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col gap-5"
    >
      <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-background dark:from-transparent dark:via-muted/20 dark:to-muted/50">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <CardTitle className="text-2xl font-bold">
              {region.stateName}
            </CardTitle>
            <Badge
              variant="secondary"
              className="text-xs"
              style={{
                backgroundColor: `${color}20`,
                color,
                borderColor: `${color}40`,
              }}
            >
              {tierLabel[region.tier]}
            </Badge>
          </div>
          <CardDescription className="text-sm">
            {isEs
              ? `Resumen de préstamos DSCR para ${region.stateName} — ${
                  region.topMarkets?.slice(0, 3).join(', ') ??
                  'cobertura en todo el estado'
                }.`
              : `DSCR lending snapshot for ${region.stateName} — ${
                  region.topMarkets?.slice(0, 3).join(', ') ??
                  'statewide coverage'
                }.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pb-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {facts.map((fact, idx) => {
              const Icon = fact.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + idx * 0.05, duration: 0.25 }}
                  className="flex items-start gap-2 rounded-lg border p-3"
                  style={{ borderColor: `${color}20` }}
                >
                  <Icon
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {fact.label}
                    </p>
                    <p className="text-sm font-semibold">{fact.value}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {region.topMarkets && region.topMarkets.length > 0 && (
            <div
              className="rounded-lg border p-3"
              style={{ borderColor: `${color}20` }}
            >
              <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3.5" style={{ color }} />
                {isEs ? 'Mercados principales' : 'Top markets'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {region.topMarkets.slice(0, 6).map((m) => (
                  <Badge
                    key={m}
                    variant="outline"
                    className="text-xs"
                    style={{
                      borderColor: `${color}35`,
                      backgroundColor: `${color}10`,
                    }}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <a
            href={
              isEs ? `/es/states/${region.slug}` : `/states/${region.slug}`
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color }}
          >
            {isEs
              ? `Leer la guía DSCR completa de ${region.stateName}`
              : `Read the full ${region.stateName} DSCR guide`}
            <ArrowRight className="size-4" />
          </a>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

/* ──────────────── Main component ──────────────── */

const UsMapExplorer = ({
  states,
  className,
  lang = 'en',
}: {
  states: StateData[];
  className?: string;
  lang?: Lang;
}) => {
  const isEs = lang === 'es';
  const tierLabel = isEs ? TIER_LABEL_ES : TIER_LABEL_EN;

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const statesBySlug = new Map(states.map((s) => [s.slug, s]));
  const region = selected ? statesBySlug.get(selected) ?? null : null;
  const hoveredRegion = hovered ? statesBySlug.get(hovered) ?? null : null;

  const handleSelect = useCallback((slug: string) => {
    setSelected((prev) => (prev === slug ? null : slug));
  }, []);

  /* Render order: small/eastern states last so they layer on top */
  const renderOrder = [...states].sort((a, b) => {
    const aSmall = SMALL_STATE_SLUGS.has(a.slug) ? 1 : 0;
    const bSmall = SMALL_STATE_SLUGS.has(b.slug) ? 1 : 0;
    return aSmall - bSmall;
  });

  return (
    <section className={cn('py-12 md:py-16', className)}>
      <div className="container max-w-screen-xl">
        <div className="mb-8 max-w-2xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">
            {isEs ? 'Mapa interactivo de cobertura' : 'Interactive coverage map'}
          </p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {isEs
              ? 'Préstamos DSCR en cada estado — haz clic para explorar'
              : 'DSCR loans in every state — click to explore'}
          </h2>
          <p className="text-base text-muted-foreground md:text-lg">
            {isEs
              ? 'Los impuestos a la propiedad, los plazos de ejecución hipotecaria, el control de rentas y las reglas de PPP varían dramáticamente según el estado. Haz clic en cualquier estado para ver su resumen de préstamos DSCR y la guía completa para inversionistas.'
              : 'Property taxes, foreclosure timelines, rent control, and PPP rules vary dramatically by state. Click any state for its DSCR lending snapshot and the full investor guide.'}
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a14] p-4 shadow-2xl md:p-5">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 50% at 30% 60%, rgba(16,185,129,0.12), transparent), radial-gradient(ellipse 50% 40% at 70% 40%, rgba(245,184,0,0.1), transparent), radial-gradient(ellipse 40% 30% at 50% 80%, rgba(239,68,68,0.06), transparent)',
                }}
              />
              <svg
                viewBox="0 0 959 593"
                className="relative h-auto w-full"
                role="img"
                aria-label={
                  isEs
                    ? 'Mapa interactivo de los Estados Unidos que muestra la cobertura de préstamos DSCR por estado'
                    : 'Interactive map of the United States showing DSCR loan coverage by state'
                }
              >
                <defs>
                  <filter
                    id="us-region-glow"
                    x="-40%"
                    y="-40%"
                    width="180%"
                    height="180%"
                  >
                    <feGaussianBlur stdDeviation="12" result="blur" />
                    <feComposite
                      in="SourceGraphic"
                      in2="blur"
                      operator="over"
                    />
                  </filter>
                  <filter
                    id="us-hover-glow"
                    x="-30%"
                    y="-30%"
                    width="160%"
                    height="160%"
                  >
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite
                      in="SourceGraphic"
                      in2="blur"
                      operator="over"
                    />
                  </filter>
                  <pattern
                    id="us-grid"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="rgba(255,255,255,0.02)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>

                <rect
                  x="0"
                  y="0"
                  width="959"
                  height="593"
                  fill="url(#us-grid)"
                />

                {renderOrder.map((s, index) => {
                  const path = REGION_PATHS[s.slug];
                  if (!path) return null;
                  const color = TIER_COLORS[s.tier] ?? TIER_COLORS['3'];
                  return (
                    <RegionShape
                      key={s.slug}
                      slug={s.slug}
                      stateName={s.stateName}
                      path={path}
                      stateCode={s.stateCode}
                      isSelected={selected === s.slug}
                      isHovered={hovered === s.slug}
                      index={index}
                      color={color}
                      onSelect={() => handleSelect(s.slug)}
                      onHover={() => setHovered(s.slug)}
                      onLeave={() => setHovered(null)}
                    />
                  );
                })}

                <AnimatePresence>
                  {hovered &&
                    hovered !== selected &&
                    hoveredRegion &&
                    REGION_PATHS[hovered] && (
                      <MapTooltip
                        key={`tooltip-${hovered}`}
                        region={hoveredRegion}
                        path={REGION_PATHS[hovered]}
                        color={
                          TIER_COLORS[hoveredRegion.tier] ?? TIER_COLORS['3']
                        }
                        tierLabel={tierLabel}
                      />
                    )}
                </AnimatePresence>
              </svg>
            </div>

            {/* Tier legend */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">
                {isEs ? 'Nivel' : 'Tier'}
              </span>
              {(['1', '2', '3', 'special'] as const).map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: TIER_COLORS[t] }}
                  />
                  {tierLabel[t]}
                </span>
              ))}
            </div>

            {/* State pills for mobile fallback */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...states]
                .sort((a, b) => a.stateName.localeCompare(b.stateName))
                .map((s) => {
                  const pillColor = TIER_COLORS[s.tier] ?? TIER_COLORS['3'];
                  const isActive = selected === s.slug;
                  return (
                    <button
                      key={s.slug}
                      onClick={() => handleSelect(s.slug)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200',
                        isActive
                          ? 'border-transparent text-white'
                          : 'border-white/10 text-muted-foreground hover:text-white',
                      )}
                      style={
                        isActive
                          ? {
                              backgroundColor: `${pillColor}25`,
                              borderColor: `${pillColor}55`,
                              color: pillColor,
                            }
                          : undefined
                      }
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = `${pillColor}45`;
                          (e.currentTarget as HTMLButtonElement).style.color =
                            pillColor;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.borderColor = '';
                          (e.currentTarget as HTMLButtonElement).style.color =
                            '';
                        }
                      }}
                    >
                      {s.stateCode}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {region ? (
                <div key={region.slug} className="relative">
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute -top-1 right-0 z-10 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      isEs ? 'Cerrar panel de detalles' : 'Close detail panel'
                    }
                  >
                    <X className="size-4" />
                  </button>
                  <DetailPanel
                    region={region}
                    color={TIER_COLORS[region.tier] ?? TIER_COLORS['3']}
                    lang={lang}
                  />
                </div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Card className="border-dashed bg-gradient-to-br from-card via-card to-background dark:from-transparent dark:via-muted/20 dark:to-muted/50">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <MapPin className="mb-4 size-10 text-muted-foreground opacity-40" />
                      <p className="max-w-xs text-base text-muted-foreground">
                        {isEs
                          ? 'Haz clic en cualquier estado del mapa para ver su resumen de préstamos DSCR — impuestos, plazos de ejecución hipotecaria, control de rentas y mercados principales.'
                          : 'Click any state on the map to see its DSCR lending snapshot — taxes, foreclosure timeline, rent control, and top markets.'}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UsMapExplorer;
