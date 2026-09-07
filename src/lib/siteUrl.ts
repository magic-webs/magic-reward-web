// Falls back to localhost so registration still works in local dev without
// NEXT_PUBLIC_SITE_URL set; production should always set it (e.g.
// https://win.magicwebs.ai) so the returned link is absolute and correct.
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

// The site-relative URL of a game page. Carrying `o` matters: without it
// the page re-resolves through getPublicWheelConfig, which falls back to
// the company's newest active offer — so a visitor who registered on one
// game gets redirected into a different one.
//
// A falsy `companySlug` keeps the original global shape (`/?t=<token>`) so
// existing production links never break; a slug namespaces the link under
// `/w/<slug>` for every other company.
export function buildGameHref(
  companySlug?: string | null,
  offerId?: string | null,
  token?: string | null,
) {
  const params = new URLSearchParams();
  if (offerId) params.set("o", offerId);
  if (token) params.set("t", token);

  const base = companySlug ? `/w/${companySlug}` : "/";
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function buildLoginUrl(token: string, companySlug?: string | null, offerId?: string | null) {
  return `${getSiteUrl()}${buildGameHref(companySlug, offerId, token)}`;
}
