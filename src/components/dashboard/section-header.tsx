import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  subtitle,
  href,
  hrefLabel,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-wide text-[var(--ov-text)]">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-xs text-[var(--ov-muted)]">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--ov-text-secondary)] transition-colors hover:text-[var(--ov-accent)]"
        >
          {hrefLabel ?? "View all"}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
