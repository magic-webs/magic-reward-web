import { appLinks } from "@/lib/siteConfig";

// Google ships an official "Get it on Google Play" badge as a fixed-colour
// image, which would sit badly on a surface that inverts with the theme.
// This is the same wordmark and glyph built from site tokens instead, so it
// reads correctly in both. Swap in the official asset if the listing ever
// needs to follow Google's badge guidelines to the letter.
export function GooglePlayButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={appLinks.android}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-3 rounded-xl border border-(--site-fg)/20 bg-(--site-fg)/5 px-5 py-2.5 transition-colors hover:border-(--site-fg)/35 hover:bg-(--site-fg)/10 ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0 fill-current">
        <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.9-.18l13.362-7.514-3.262-3.239z" />
      </svg>
      <span className="flex flex-col text-left leading-none">
        <span className="font-mono text-[10px] tracking-widest text-(--site-faint) uppercase">
          Get it on
        </span>
        <span className="font-heading mt-1 text-base font-semibold tracking-tight">Google Play</span>
      </span>
    </a>
  );
}
