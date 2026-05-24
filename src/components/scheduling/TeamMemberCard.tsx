import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TeamMember, Service } from '@/lib/nylas/types';

interface TeamMemberCardProps {
  member: TeamMember;
  services?: Service[];
  selected?: boolean;
  onClick?: () => void;
  showServices?: boolean;
  className?: string;
}

export function TeamMemberCard({
  member,
  services = [],
  selected = false,
  onClick,
  showServices = false,
  className,
}: TeamMemberCardProps) {
  const memberServices = services.filter((s) => member.services.includes(s.id));

  return (
    <Card
      className={cn(
        '',
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
        selected && 'ring-2 ring-brand border-brand',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-selected={onClick ? selected : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {member.photo ? (
            <img
              src={member.photo}
              alt={member.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold text-muted-foreground">
              {member.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <p className="text-brand text-sm font-medium">{member.title}</p>
              </div>
              {selected && (
                <div className="bg-brand text-brand-foreground flex h-6 w-6 items-center justify-center rounded-full">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {member.bio && <CardDescription className="line-clamp-3">{member.bio}</CardDescription>}

        {showServices && memberServices.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Specializes in
            </p>
            <div className="flex flex-wrap gap-1.5">
              {memberServices.map((service) => (
                <span
                  key={service.id}
                  className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {service.name}
                </span>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

interface TeamMemberListProps {
  members: TeamMember[];
  services?: Service[];
  selectedMember: TeamMember | null;
  onSelect: (member: TeamMember) => void;
  showServices?: boolean;
  className?: string;
}

export function TeamMemberList({
  members,
  services = [],
  selectedMember,
  onSelect,
  showServices = true,
  className,
}: TeamMemberListProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">Choose a Specialist</h2>
        <p className="text-muted-foreground mt-2">Select who you&apos;d like to meet with</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            services={services}
            selected={selectedMember?.id === member.id}
            onClick={() => onSelect(member)}
            showServices={showServices}
          />
        ))}
      </div>
    </div>
  );
}
