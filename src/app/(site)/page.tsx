import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Brush,
  ClipboardList,
  Gauge,
  Layers,
  ListChecks,
  MousePointerClick,
  QrCode,
  Scale,
  Smartphone,
  Sparkles,
  Ticket,
  UserCheck,
  Webhook,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { HeroDiagram } from "@/components/marketing/HeroDiagram";
import { GooglePlayButton } from "@/components/marketing/GooglePlayButton";
import { AppShowcase } from "@/components/marketing/AppShowcase";
import { EVENT_THEMES, GAME_TYPES } from "@/lib/gameTypes";
import { product } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: `${product.name} — ${product.tagline}`,
  description: product.description,
};

// Keyed off GAME_TYPES so the marketing list can never claim a type the
// dashboard does not actually offer. A type added there without a blurb
// still shows up here, just without the supporting line.
const typeBlurbs: Record<string, string> = {
  wheel: "The classic. Your artwork, your segments, a pointer that lands where the odds say it should.",
  scratch: "A foil panel the customer rubs away with a finger. Reads as a real scratch card on a phone.",
  slot: "Three reels that spin down to the prize. The fruit-machine tension, none of the hardware.",
  giftbox: "A row of wrapped boxes. Pick one, open it, find out what was inside all along.",
  plinko: "Drop a ball through the pegs and watch it rattle into a prize slot at the bottom.",
  memory: "Flip cards to match a pair. The only type here that asks for a little skill.",
};

const features = [
  {
    icon: Layers,
    title: "One account, many offers",
    body: "Every campaign is its own offer with its own type, artwork, prizes and questions. Run the summer sale and the launch promo side by side.",
  },
  {
    icon: Brush,
    title: "Your artwork, your brand",
    body: "Upload the board, background and pointer you designed. Prizes map onto them in the order you set — no template to fight.",
  },
  {
    icon: Scale,
    title: "Odds you control",
    body: "Give every prize a weight and the draw follows it exactly. Mark which outcomes count as a win and which don't.",
  },
  {
    icon: ListChecks,
    title: "Collect what you need",
    body: "Name and phone out of the box, plus any custom question you add — text, dropdown, radio or checkboxes. Answers land on the registration.",
  },
  {
    icon: UserCheck,
    title: "One play per person",
    body: "Registrations dedupe on phone number per company, and everyone gets a magic link back to the result they already won.",
  },
  {
    icon: MousePointerClick,
    title: "Embed it on your site",
    body: "Drop in one script and the offer opens on exit intent, after a delay, at a scroll depth, or from a launcher button you style.",
  },
  {
    icon: BellRing,
    title: "Social proof that's real",
    body: "Notifications built from actual winners and signups, clearly separated in the dashboard from the simulated ones you configure.",
  },
  {
    icon: ClipboardList,
    title: "Live dashboard",
    body: "Every registration and prize the moment it happens, filterable by prize and date, and one click away from a CSV.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    body: "Push registrations and results straight into your CRM, per offer. Every delivery is HMAC-signed so you can verify it.",
  },
] as const;

const steps = [
  {
    icon: Ticket,
    title: "Build the offer",
    body: "Choose one of the six types, add your prizes, set the weights, upload your artwork and choose which details to ask for.",
  },
  {
    icon: QrCode,
    title: "Share one link",
    body: "Every offer gets a public URL. Put it behind a QR code on the counter, a story link, an SMS — or embed it on your site.",
  },
  {
    icon: Gauge,
    title: "Watch it convert",
    body: "Registrations and wins stream into the dashboard, and out to your own systems over webhooks.",
  },
] as const;

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16">
        <div className="grid-lines grid-fade pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(16,185,129,0.13),transparent)]" />

        <div className="relative mx-auto max-w-6xl px-5">
          <div className="h-[240px] sm:h-[300px] lg:h-[340px]">
            <HeroDiagram />
          </div>

          <Reveal className="mx-auto max-w-3xl pb-24 text-center sm:pb-32">
            <h1 className="font-heading text-[2.6rem] leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Prize offers that actually convert
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-(--site-muted) sm:text-lg">
              {product.description}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/admin"
                className="group flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-emerald-400 sm:w-auto"
              >
                Start building for free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#offers"
                className="w-full rounded-full border border-(--site-fg)/20 px-7 py-3.5 text-center text-sm font-semibold text-(--site-fg) transition-colors hover:border-(--site-fg)/40 hover:bg-(--site-fg)/5 sm:w-auto"
              >
                See the offer types
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Offer types ──────────────────────────────────────────────── */}
      <section id="offers" className="relative border-t border-(--site-fg)/10">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="py-16 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 px-2.5 py-1 font-mono text-xs text-(--site-accent)">
              <Ticket className="size-3.5" /> {GAME_TYPES.length} OFFER TYPES
            </span>
            <h2 className="font-heading mt-6 max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              Not just a wheel
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-(--site-muted)">
              Every offer picks how it plays. Same prizes, same odds, same entry form underneath —
              switch the type whenever a campaign needs a different feel.
            </p>
          </Reveal>

          <Reveal
            stagger={0.08}
            className="grid grid-cols-1 border-t border-l border-(--site-fg)/10 sm:grid-cols-2 lg:grid-cols-3"
          >
            {GAME_TYPES.map((type) => (
              <div
                key={type.value}
                className="group relative border-r border-b border-(--site-fg)/10 p-7 transition-colors hover:bg-(--site-fg)/[0.025] sm:p-9"
              >
                <span className="flex size-11 items-center justify-center rounded-xl border border-(--site-fg)/10 bg-(--site-fg)/5 transition-colors group-hover:border-emerald-500/40">
                  <type.icon
                    className="size-5 text-(--site-soft) transition-colors group-hover:text-(--site-accent)"
                    strokeWidth={1.5}
                  />
                </span>
                <h3 className="font-heading mt-5 text-lg font-semibold tracking-tight">
                  {type.label}
                </h3>
                {typeBlurbs[type.value] && (
                  <p className="mt-2.5 text-sm leading-relaxed text-(--site-muted)">
                    {typeBlurbs[type.value]}
                  </p>
                )}
              </div>
            ))}
          </Reveal>

          <Reveal className="py-14 sm:py-16">
            <div className="rounded-2xl border border-(--site-fg)/10 bg-(--site-fg)/[0.02] p-7 sm:p-9">
              <h3 className="font-heading text-xl font-semibold tracking-tight">
                Dressed for the occasion
              </h3>
              <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-(--site-muted)">
                Any offer can wear a seasonal theme, so the same campaign looks right in October
                and again in December.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                {EVENT_THEMES.map((theme) => (
                  <span
                    key={theme.value}
                    className="inline-flex items-center gap-2 rounded-full border border-(--site-fg)/10 bg-(--site-fg)/[0.03] px-3.5 py-2 text-sm text-(--site-muted)"
                  >
                    <theme.icon className="size-4 text-(--site-accent)" strokeWidth={1.5} />
                    {theme.label}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="relative border-t border-(--site-fg)/10">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal className="py-16 sm:py-20">
            <h2 className="font-heading max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              Everything a promotion needs, nothing it doesn&apos;t
            </h2>
          </Reveal>

          <Reveal
            stagger={0.09}
            className="grid grid-cols-1 border-t border-l border-(--site-fg)/10 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group relative border-r border-b border-(--site-fg)/10 p-7 transition-colors hover:bg-(--site-fg)/[0.025] sm:p-9"
              >
                <feature.icon
                  className="size-5 text-(--site-soft) transition-colors group-hover:text-(--site-accent)"
                  strokeWidth={1.5}
                />
                <h3 className="font-heading mt-5 text-lg font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-(--site-muted)">{feature.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="relative border-t border-(--site-fg)/10">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 px-2.5 py-1 font-mono text-xs text-(--site-accent)">
                <Sparkles className="size-3.5" /> HOW IT WORKS
              </span>
              <h2 className="font-heading mt-6 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
                Live in an afternoon, not a sprint
              </h2>
              <p className="mt-5 text-sm leading-relaxed text-(--site-muted)">
                Nothing to deploy and no SDK to learn. Set the offer up in the dashboard and share
                the link it gives you.
              </p>
              <Link
                href="/admin"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-(--site-accent) hover:text-(--site-accent-strong)"
              >
                Open the dashboard
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>

            <Reveal stagger={0.12} className="space-y-4">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-(--site-fg)/10 bg-(--site-fg)/[0.02] p-7 backdrop-blur-sm sm:p-8"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--site-fg)/10 bg-(--site-fg)/5">
                      <step.icon className="size-4.5 text-(--site-accent)" strokeWidth={1.5} />
                    </span>
                    <span className="font-mono text-xs text-(--site-faint)">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-heading mt-5 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-(--site-muted)">{step.body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Mobile app ───────────────────────────────────────────────── */}
      <section id="mobile" className="relative border-t border-(--site-fg)/10">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 px-2.5 py-1 font-mono text-xs text-(--site-accent)">
                <Smartphone className="size-3.5" /> MOBILE
              </span>
              <h2 className="font-heading mt-6 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
                Run your offers
                <br />
                from the shop floor
              </h2>
              <p className="mt-5 max-w-md text-sm leading-relaxed text-(--site-muted)">
                The companion app gives you the whole dashboard on your phone — offers, prizes, form
                fields, registrations and webhooks, with the same sign-in you use on the web.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Check today's registrations between customers",
                  "Swap a prize or its odds without opening a laptop",
                  "Filter who won what, by prize or by date",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-(--site-muted)">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>

              <GooglePlayButton className="mt-9" />
            </Reveal>

            <Reveal y={40} className="relative">
              <AppShowcase />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="relative border-t border-(--site-fg)/10">
        <div className="grid-lines grid-fade pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_100%,rgba(16,185,129,0.13),transparent)]" />
        <Reveal className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-32">
          <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Give people a reason to leave their number
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-pretty text-(--site-muted)">
            Set up your first offer today and start turning walk-ins into a list you own.
          </p>
          <Link
            href="/admin"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-emerald-400"
          >
            Start building for free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
