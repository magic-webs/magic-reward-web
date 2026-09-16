"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { SiteThemeToggle } from "@/components/marketing/SiteThemeToggle";
import { navLinks, product } from "@/lib/siteConfig";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-(--site-fg)/10 bg-(--site-bg)/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" priority />
          <span className="font-heading text-[15px] font-semibold tracking-tight text-(--site-fg)">
            {product.name}
          </span>
        </Link>

        <div className="ml-4 hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-(--site-muted) transition-colors hover:text-(--site-fg)"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <SiteThemeToggle />

          <Link
            href="/admin"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-(--site-soft) transition-colors hover:text-(--site-fg) md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/admin"
            className="hidden rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-emerald-400 md:inline-flex"
          >
            Open dashboard
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-(--site-soft) md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-(--site-fg)/10 bg-(--site-bg)/95 px-5 py-4 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-(--site-soft) hover:bg-(--site-fg)/5 hover:text-(--site-fg)"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-[#0a0a0a]"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
