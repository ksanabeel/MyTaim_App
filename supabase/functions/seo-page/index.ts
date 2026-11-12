import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_URL = "https://www.bookonmap.com";

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchIndexHtml(): Promise<string> {
  const resp = await fetch(`${BASE_URL}/index.html`);
  return await resp.text();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };

  try {
    const url = new URL(req.url);

    // Get username from "u" query param (passed by Vercel rewrite)
    // or extract from path if called directly
    let username = url.searchParams.get("u");
    if (!username) {
      const path = url.pathname;
      const atMatch = path.match(/^\/@?(.+)$/);
      username = atMatch ? decodeURIComponent(atMatch[1]) : null;
    }

    // Always fetch real index.html — this has the correct hashed asset paths
    let html = await fetchIndexHtml();

    if (!username) {
      return new Response(html, { status: 200, headers: responseHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch provider profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, bio, avatar_url, rating")
      .eq("username", username)
      .maybeSingle();

    // If provider not found, return plain HTML — SPA handles the 404 UI
    if (profileError || !profile) {
      return new Response(html, { status: 200, headers: responseHeaders });
    }

    // Fetch the provider's offerings (services)
    let offerings: any[] = [];
    if (profile.id) {
      const { data: offeringsData } = await supabase
        .from("offerings")
        .select("title, description, provider_role, price, currency, category, country, city")
        .eq("provider_id", profile.id);
      offerings = (offeringsData || []).filter((o: any) => o && o.title);
    }

    // Build SEO content
    const providerName = escapeHtml(profile.full_name || profile.username);
    const providerBio = escapeHtml(profile.bio || "");
    const providerUsername = escapeHtml(profile.username);
    const providerAvatar = profile.avatar_url || "";
    const canonicalUrl = `${BASE_URL}/@${profile.username}`;

    // Build services HTML with microdata
    const servicesHtml = offerings.map((o: any) => {
      const title = escapeHtml(o.title);
      const desc = escapeHtml(o.description || "");
      const role = escapeHtml(o.provider_role || "");
      const price = o.price ? `${escapeHtml(o.price)} ${escapeHtml(o.currency || "")}` : "";
      const category = escapeHtml(o.category || "");
      const location = [o.city, o.country].filter(Boolean).map(escapeHtml).join(", ");

      return `      <div itemscope itemtype="https://schema.org/Service">
        <h3 itemprop="name">${title}</h3>${role ? `<span itemprop="serviceType">${role}</span>` : ""}${category ? `<span itemprop="category">${category}</span>` : ""}${desc ? `<p itemprop="description">${desc}</p>` : ""}${price ? `<span itemprop="offers">${price}</span>` : ""}${location ? `<span itemprop="areaServed">${location}</span>` : ""}
      </div>`;
    }).join("\n");

    // Build JSON-LD structured data
    const jsonLd: any = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: profile.full_name || profile.username,
      alternateName: `@${profile.username}`,
      url: canonicalUrl,
    };
    if (providerAvatar) jsonLd.image = providerAvatar;
    if (profile.bio) jsonLd.description = profile.bio;

    if (offerings.length > 0) {
      jsonLd.mainEntity = {
        "@type": "ItemList",
        itemListElement: offerings.map((o: any, i: number) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Service",
            name: o.title,
            description: o.description || undefined,
            provider: { "@type": "Person", name: profile.full_name || profile.username },
            offers: o.price ? { "@type": "Offer", price: o.price, priceCurrency: o.currency || undefined } : undefined,
            areaServed: o.city || o.country ? { "@type": "Place", name: [o.city, o.country].filter(Boolean).join(", ") } : undefined,
          },
        })),
      };
    }

    const jsonLdScript = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    // SEO block — hidden from human users but readable by search engine crawlers
    const seoBlock = `    <!-- SEO: Provider content for search engine crawlers -->
    <div id="seo-content" style="display:none" data-seo="true">
      <h1>${providerName}</h1>
      <p>Provider on BookOnMap — @${providerUsername}</p>
${providerBio ? `      <p>${providerBio}</p>\n` : ""}${servicesHtml ? `      <h2>Services offered by ${providerName}</h2>
${servicesHtml}
` : ""}    </div>
    <!-- /SEO content -->
    ${jsonLdScript}`;

    // Enhanced meta tags
    const metaTitle = `${profile.full_name || profile.username} — BookOnMap`;
    const metaDesc = profile.bio
      ? `${profile.full_name || profile.username} — ${profile.bio}`.slice(0, 160)
      : `${profile.full_name || profile.username} على BookOnMap — احجز الخدمة بسهولة وسرعة`;

    const enhancedHead = `<title>${escapeHtml(metaTitle)}</title>
    <meta name="description" content="${escapeHtml(metaDesc)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escapeHtml(metaTitle)}" />
    <meta property="og:description" content="${escapeHtml(metaDesc)}" />
    <meta property="og:url" content="${escapeXml(canonicalUrl)}" />
    ${providerAvatar ? `<meta property="og:image" content="${escapeHtml(providerAvatar)}" />` : ""}
    <meta property="og:site_name" content="BookOnMap" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
    ${providerAvatar ? `<meta name="twitter:image" content="${escapeHtml(providerAvatar)}" />` : ""}
    <link rel="canonical" href="${escapeXml(canonicalUrl)}" />`;

    // Replace existing <title> tag
    html = html.replace(/<title>[^<]*<\/title>/, enhancedHead);

    // Remove existing static OG/Twitter meta tags to avoid duplicates
    html = html.replace(/<meta property="og:title"[^>]*>/g, "");
    html = html.replace(/<meta property="og:description"[^>]*>/g, "");
    html = html.replace(/<meta property="og:image"[^>]*>/g, "");
    html = html.replace(/<meta property="og:type"[^>]*>/g, "");
    html = html.replace(/<meta property="og:url"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:card"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:title"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:description"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:image"[^>]*>/g, "");

    // Insert SEO content block right before </body>
    html = html.replace("</body>", `${seoBlock}\n  </body>`);

    return new Response(html, { status: 200, headers: responseHeaders });
  } catch (err) {
    // On any error, try to return plain HTML so the SPA still loads
    try {
      const html = await fetchIndexHtml();
      return new Response(html, { status: 200, headers: responseHeaders });
    } catch {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
});
