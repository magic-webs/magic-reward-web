import type { ReactNode } from "react";
import { SmoothScroll } from "@/components/marketing/SmoothScroll";
import { SiteNav } from "@/components/marketing/SiteNav";
import { SiteFooter } from "@/components/marketing/SiteFooter";

// `site-surface` carries the public site's own palette and inverts it with
// the theme — see the Marketing site block in globals.css. Everything below
// reads those tokens, so no component here needs a `dark:` variant.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <SmoothScroll>
      <div className="site-surface min-h-screen">
        <noscript>
          {/* GSAP never runs, so un-hide everything it would have revealed. */}
          <style>{`.reveal,.reveal-children>*{opacity:1 !important}`}</style>
        </noscript>
        <SiteNav />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
