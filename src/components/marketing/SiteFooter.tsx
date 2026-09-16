import Link from "next/link";
import Image from "next/image";
import { appLinks, legalEntity, legalLinks, navLinks, product, socialLinks } from "@/lib/siteConfig";

export function SiteFooter() {
  return (
    <footer className="border-t border-(--site-fg)/10 bg-(--site-bg)">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" />
            <span className="font-heading text-[15px] font-semibold text-(--site-fg)">{product.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-(--site-muted)">{product.tagline}</p>

          <address className="mt-6 space-y-1 text-sm not-italic text-(--site-muted)">
            <p className="text-(--site-soft)">{legalEntity.name}</p>
            <p className="max-w-xs">{legalEntity.address}</p>
            <p>
              <a
                href={`mailto:${legalEntity.supportEmail}`}
                className="transition-colors hover:text-(--site-fg)"
              >
                {legalEntity.supportEmail}
              </a>
              {" · "}
              <a href={`tel:${legalEntity.phone}`} className="transition-colors hover:text-(--site-fg)">
                {legalEntity.phoneDisplay}
              </a>
            </p>
          </address>

          <div className="mt-5 flex gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)"
              >
                {social.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-widest text-(--site-faint) uppercase">Product</h3>
          <ul className="mt-4 space-y-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/admin" className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)">
                Dashboard
              </Link>
            </li>
            <li>
              <a
                href={appLinks.android}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)"
              >
                Android app
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold tracking-widest text-(--site-faint) uppercase">Legal</h3>
          <ul className="mt-4 space-y-2.5">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-(--site-fg)/10">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <p className="text-xs text-(--site-faint)">
            © {new Date().getFullYear()} {legalEntity.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
