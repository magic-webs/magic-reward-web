import Image from "next/image";

// Real captures from the Android app rather than a drawn mock. Both are
// light-theme shots, which is why they sit in a frame — against the dark
// site they need the bezel to read as a phone and not a floating white box.
const shots = [
  {
    src: "/images/app-screenshots/app-offer-setup.png",
    alt: "Offer setup in the Magic Reward app, showing the six offer types and the seasonal themes",
    className: "w-[46%] -translate-y-2 -rotate-6",
  },
  {
    src: "/images/app-screenshots/app-dashboard.png",
    alt: "The Magic Reward app dashboard, showing registrations, conversion and a chart of signups per day",
    className: "z-10 -ml-8 w-[52%] translate-y-4 rotate-3",
  },
] as const;

export function AppShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="grid-lines absolute inset-0 rounded-3xl border border-(--site-fg)/10" />
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.16),transparent_65%)]" />

      <div className="relative flex items-center justify-center px-6 py-12">
        {shots.map((shot) => (
          <div
            key={shot.src}
            className={`rounded-[1.75rem] border border-(--site-fg)/15 bg-(--site-panel) p-1.5 shadow-2xl shadow-(color:--site-shadow) ${shot.className}`}
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              width={1220}
              height={2712}
              // Never rendered wider than about a quarter of the 6xl column,
              // so keep the served file small rather than shipping the
              // full-resolution capture.
              sizes="(min-width: 1024px) 240px, 45vw"
              className="h-auto w-full rounded-[1.4rem]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
