# Project memory

## Product intent & audience

- **BookOnMap** — a marketplace/booking app where individual service providers have public profile pages.
- Audience: end-customers searching for providers and booking services via provider-specific URLs.
- Provider profile pages are the primary SEO surface; goal is Google indexing of individual provider pages.

## Brand personality & voice

- Inferred from naming/metadata: straightforward, provider-centric ("Provider Name - Service Type | BookOnMap").

## Visual design & UX direction

- App supports RTL/direction-aware layout (`direction` set on root container).
- **Hard constraint:** UI components, layouts, and colors must not be changed; SEO work is background-only.
- Routing: `/:storeUsername` → provider profile page (`ClientMarketplace`).
- `react-helmet-async` already installed; `HelmetProvider` wraps the app.

## Decisions, constraints & rationale

- **Dynamic meta tags** on provider profile via `react-helmet-async`: `<title>`, meta description, Open Graph, Twitter Card, canonical URL, and JSON-LD structured data — all driven by fetched `storeProfile` data.
- **Sitemap is fully dynamic** — no static XML. A Supabase Edge Function queries the `profiles` table for active providers and generates `/sitemap.xml` on the fly, so new providers appear automatically without redeployment.
- Vercel `vercel.json` proxies `/sitemap.xml` to the edge function before the SPA catch-all.
- `robots.txt` added to declare crawlability and sitemap location.
- Supabase Edge Functions used for serverless routes; `config.toml` present under `supabase/`.
- Build verified passing after changes.

## Open questions & assumptions

- Assumes `profiles` table has fields sufficient for provider name, service type, and active status filtering.
- Assumes Vercel is the deployment target (edge function + rewrites).
- Exact `profiles` schema fields beyond store username/name/service type not yet documented.