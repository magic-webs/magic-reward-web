// Public-facing details used across the marketing and legal pages.
// Sourced from magicwebs.in.
export const legalEntity = {
  /** Registered company name as it should appear in legal copy. */
  name: "Magic Webs Technologies Pvt Ltd",
  /** Monitored inbox for support and privacy requests. */
  supportEmail: "hello@magicwebs.in",
  /** Inbox for data-deletion and privacy requests (may be the same). */
  privacyEmail: "hello@magicwebs.in",
  /** Registered office, shown in full on the legal pages. */
  address: "Office No. 705, ABC Tower-1, Sector 135, Noida, Uttar Pradesh 201305, India",
  /** Second office, listed alongside the registered one on Support. */
  secondaryAddress: "B-3/46A, Main Service Road, Yamuna Vihar, Delhi, India",
  /** E.164 for tel: links. */
  phone: "+919999064055",
  /** Same number, formatted for display. */
  phoneDisplay: "+91 99990 64055",
  /** Country whose law governs the terms. */
  jurisdiction: "India",
  /** Shown as "Last updated" on the legal pages. */
  lastUpdated: "23 August 2026",
} as const;

export const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/magicwebs.in" },
  { label: "Instagram", href: "https://www.instagram.com/magicwebs.in" },
  { label: "Facebook", href: "https://www.facebook.com/magicwebs.in" },
] as const;

export const product = {
  name: "Magic Reward",
  tagline: "Play-to-win campaigns that turn footfall into customers.",
  description:
    "Run branded prize offers on any device — a wheel, a scratch card, a slot machine and more. Set your own artwork, control the odds, collect the details you need, and watch every play land in your dashboard in real time.",
} as const;

export const appLinks = {
  /** Play Store listing for the companion Android app. */
  android: "https://play.google.com/store/apps/details?id=ai.magicwebs.reward",
} as const;

export const navLinks = [
  { label: "Offers", href: "#offers" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Mobile app", href: "#mobile" },
] as const;

export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Support", href: "/support" },
  { label: "Delete your data", href: "/delete-account" },
] as const;
