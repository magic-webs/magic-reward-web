import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone, Trash2 } from "lucide-react";
import { LegalPage, Section } from "@/components/marketing/LegalPage";
import { legalEntity, product } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: `Support — ${product.name}`,
  description: `Get help with ${product.name} — contact details and answers to common questions.`,
};

const faqs = [
  {
    q: "How do prize odds work?",
    a: "Every prize has a weight. A prize's chance of being drawn is its weight divided by the total of all weights on the wheel, so a prize weighted 10 against a total of 100 lands roughly one spin in ten.",
  },
  {
    q: "Why does the wheel image not match my prizes?",
    a: "Prizes map to segments clockwise starting at the top of the wheel image, in the order they appear in the dashboard. Reorder them there to match your artwork, and make sure the number of prizes equals the number of segments you drew.",
  },
  {
    q: "Can someone spin twice?",
    a: "No. Registrations are deduplicated by phone number within a company, and returning to the link shows the result already won rather than drawing again.",
  },
  {
    q: "Can a company sign in without the platform admin password?",
    a: "Yes. Set a password for the company under Settings, and it can then sign in with its own slug and that password.",
  },
  {
    q: "How do I get registrations into my own system?",
    a: "Add a webhook endpoint under Webhooks and subscribe it to the events you care about. Every delivery is signed so you can verify it came from us, and you can send a test and inspect the response before going live.",
  },
];

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro={`Need a hand with ${product.name}? Start here — and if the answer isn't below, write to us.`}
    >
      <Section heading="Contact us">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={`mailto:${legalEntity.supportEmail}`}
            className="flex items-start gap-3 rounded-xl border border-(--site-fg)/10 bg-(--site-fg)/[0.02] p-4 transition-colors hover:border-(--site-fg)/25 hover:bg-(--site-fg)/[0.04]"
          >
            <Mail className="mt-0.5 size-4 shrink-0 text-(--site-accent)" strokeWidth={1.5} />
            <span>
              <span className="block text-sm font-medium text-(--site-soft)">Email support</span>
              <span className="block text-sm text-(--site-muted)">{legalEntity.supportEmail}</span>
            </span>
          </a>
          <a
            href={`tel:${legalEntity.phone}`}
            className="flex items-start gap-3 rounded-xl border border-(--site-fg)/10 bg-(--site-fg)/[0.02] p-4 transition-colors hover:border-(--site-fg)/25 hover:bg-(--site-fg)/[0.04]"
          >
            <Phone className="mt-0.5 size-4 shrink-0 text-(--site-accent)" strokeWidth={1.5} />
            <span>
              <span className="block text-sm font-medium text-(--site-soft)">Call us</span>
              <span className="block text-sm text-(--site-muted)">{legalEntity.phoneDisplay}</span>
            </span>
          </a>
          <Link
            href="/delete-account"
            className="flex items-start gap-3 rounded-xl border border-(--site-fg)/10 bg-(--site-fg)/[0.02] p-4 transition-colors hover:border-(--site-fg)/25 hover:bg-(--site-fg)/[0.04] sm:col-span-2"
          >
            <Trash2 className="mt-0.5 size-4 shrink-0 text-(--site-accent)" strokeWidth={1.5} />
            <span>
              <span className="block text-sm font-medium text-(--site-soft)">Delete your data</span>
              <span className="block text-sm text-(--site-muted)">Request account and data removal</span>
            </span>
          </Link>
        </div>
        <div className="flex items-start gap-3 pt-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-(--site-faint)" strokeWidth={1.5} />
          <div className="space-y-3">
            <p>
              <span className="text-(--site-soft)">{legalEntity.name}</span>
              <br />
              {legalEntity.address}
            </p>
            <p>
              <span className="text-(--site-soft)">Delhi office</span>
              <br />
              {legalEntity.secondaryAddress}
            </p>
          </div>
        </div>
        <p>We aim to reply to every message within two business days.</p>
      </Section>

      <Section heading="Common questions">
        <div className="space-y-5">
          {faqs.map((faq) => (
            <div key={faq.q}>
              <h3 className="text-sm font-semibold text-(--site-soft)">{faq.q}</h3>
              <p className="mt-1.5">{faq.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section heading="Reporting a problem">
        <p>
          When reporting a bug, tell us the company slug, roughly when it happened, and what you
          expected instead. If it involves a specific registration or spin, the phone number used
          helps us find it quickly.
        </p>
      </Section>
    </LegalPage>
  );
}
