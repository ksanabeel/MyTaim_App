import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { config as loadEnv } from "dotenv";

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DIST_DIR = join(process.cwd(), "dist");
const BASE_URL = "https://www.bookonmap.com";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function main() {
  console.log("=== Generating static provider pages ===");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log("Missing Supabase env vars. Skipping.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: providers, error: providersError } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, avatar_url")
    .or("is_active.eq.true,is_active.is.null")
    .not("username", "is", null)
    .neq("username", "")
    .limit(50);

  if (providersError) {
    console.error("Error fetching providers:", providersError.message);
    return;
  }

  if (!providers || providers.length === 0) {
    console.log("No providers found. Skipping.");
    return;
  }

  console.log(`Found ${providers.length} providers.`);

  const providerIds = providers.map((p) => p.id).filter(Boolean);
  let offeringsMap = new Map();
  if (providerIds.length > 0) {
    const { data: offerings, error: offeringsError } = await supabase
      .from("offerings")
      .select("provider_id, title, description, provider_role, price, currency, category, country, city")
      .in("provider_id", providerIds);

    if (!offeringsError && offerings) {
      for (const o of offerings) {
        if (!o.title) continue;
        if (!offeringsMap.has(o.provider_id)) offeringsMap.set(o.provider_id, []);
        offeringsMap.get(o.provider_id).push(o);
      }
    }
  }

  const indexPath = join(DIST_DIR, "index.html");
  if (!existsSync(indexPath)) {
    console.error("dist/index.html not found. Run vite build first.");
    return;
  }

  const baseHtml = readFileSync(indexPath, "utf-8");
  let success = 0;

  for (const profile of providers) {
    const username = profile.username;
    const offerings = offeringsMap.get(profile.id) || [];

    const providerName = escapeHtml(profile.full_name || username);
    const providerBio = escapeHtml(profile.bio || "");
    const providerUsername = escapeHtml(username);
    const avatar = profile.avatar_url || "";
    const canonicalUrl = `${BASE_URL}/@${username}`;

    const metaTitle = `${profile.full_name || username} — BookOnMap`;
    const metaDesc = profile.bio
      ? `${profile.full_name || username} — ${profile.bio}`.slice(0, 160)
      : `${profile.full_name || username} على BookOnMap — احجز الخدمة بسهولة وسرعة`;

    const headTags = `<title>${escapeHtml(metaTitle)}</title>
    <meta name="description" content="${escapeHtml(metaDesc)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escapeHtml(metaTitle)}" />
    <meta property="og:description" content="${escapeHtml(metaDesc)}" />
    <meta property="og:url" content="${escapeXml(canonicalUrl)}" />
    ${avatar ? `<meta property="og:image" content="${escapeHtml(avatar)}" />` : ""}
    <meta property="og:site_name" content="BookOnMap" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metaTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
    ${avatar ? `<meta name="twitter:image" content="${escapeHtml(avatar)}" />` : ""}
    <link rel="canonical" href="${escapeXml(canonicalUrl)}" />`;

    let servicesHtml = "";
    if (offerings.length > 0) {
      const items = offerings.map((o) => {
        const title = escapeHtml(o.title);
        const desc = escapeHtml(o.description || "");
        const role = escapeHtml(o.provider_role || "");
        const price = o.price ? `${escapeHtml(o.price)} ${escapeHtml(o.currency || "")}` : "";
        const category = escapeHtml(o.category || "");
        const location = [o.city, o.country].filter(Boolean).map(escapeHtml).join(", ");
        return `        <div itemscope itemtype="https://schema.org/Service">
          <h3 itemprop="name">${title}</h3>${role ? `<span itemprop="serviceType">${role}</span>` : ""}${category ? `<span itemprop="category">${category}</span>` : ""}${desc ? `<p itemprop="description">${desc}</p>` : ""}${price ? `<span itemprop="offers">${price}</span>` : ""}${location ? `<span itemprop="areaServed">${location}</span>` : ""}
        </div>`;
      }).join("\n");
      servicesHtml = `      <h2>Services offered by ${providerName}</h2>\n${items}\n`;
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: profile.full_name || username,
      alternateName: `@${username}`,
      url: canonicalUrl,
    };
    if (avatar) jsonLd.image = avatar;
    if (profile.bio) jsonLd.description = profile.bio;
    if (offerings.length > 0) {
      jsonLd.mainEntity = {
        "@type": "ItemList",
        itemListElement: offerings.map((o, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Service",
            name: o.title,
            description: o.description || undefined,
            provider: { "@type": "Person", name: profile.full_name || username },
            offers: o.price ? { "@type": "Offer", price: o.price, priceCurrency: o.currency || undefined } : undefined,
            areaServed: o.city || o.country ? { "@type": "Place", name: [o.city, o.country].filter(Boolean).join(", ") } : undefined,
          },
        })),
      };
    }

    const seoBlock = `    <!-- SEO: Provider content for search engine crawlers -->
    <div id="seo-content" style="display:none" data-seo="true">
      <h1>${providerName}</h1>
      <p>Provider on BookOnMap — @${providerUsername}</p>
${providerBio ? `      <p>${providerBio}</p>\n` : ""}${servicesHtml}    </div>
    <!-- /SEO content -->
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    let html = baseHtml;
    html = html.replace(/<title>[^<]*<\/title>/, headTags);
    html = html.replace(/<meta property="og:title"[^>]*>/g, "");
    html = html.replace(/<meta property="og:description"[^>]*>/g, "");
    html = html.replace(/<meta property="og:image"[^>]*>/g, "");
    html = html.replace(/<meta property="og:type"[^>]*>/g, "");
    html = html.replace(/<meta property="og:url"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:card"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:title"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:description"[^>]*>/g, "");
    html = html.replace(/<meta name="twitter:image"[^>]*>/g, "");
    html = html.replace("</body>", `${seoBlock}\n  </body>`);

    const outDir = join(DIST_DIR, "@", username);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "index.html"), html);
    success++;
  }

  const sitemapUrls = providers.map((p) => {
    const lastmod = new Date().toISOString().split("T")[0];
    return `  <url>
    <loc>${BASE_URL}/@${escapeXml(p.username)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${sitemapUrls}
</urlset>`;

  writeFileSync(join(DIST_DIR, "sitemap.xml"), sitemap);
  console.log(`Done: ${success}/${providers.length} provider pages generated. Sitemap written.`);
}

main().catch((err) => {
  console.error("Post-build step failed:", err);
  process.exit(1);
});
