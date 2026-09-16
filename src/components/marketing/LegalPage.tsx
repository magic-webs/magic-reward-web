import type { ReactNode } from "react";
import { legalEntity } from "@/lib/siteConfig";

// Shared shell for the policy pages. Long-form prose gets its own reading
// measure and heading rhythm rather than inheriting the marketing scale.
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative border-b border-(--site-fg)/10 pt-16">
      <div className="grid-lines grid-fade pointer-events-none absolute inset-x-0 top-0 h-64" />
      <article className="relative mx-auto max-w-3xl px-5 py-16 sm:py-20">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 font-mono text-xs text-(--site-faint)">
          Last updated {legalEntity.lastUpdated}
        </p>
        {intro && <p className="mt-6 text-base leading-relaxed text-(--site-muted)">{intro}</p>}
        <div className="mt-12 space-y-10">{children}</div>
      </article>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-(--site-muted) [&_a]:text-(--site-accent) [&_a:hover]:text-(--site-accent-strong) [&_strong]:font-semibold [&_strong]:text-(--site-soft)">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
