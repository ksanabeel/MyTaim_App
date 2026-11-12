import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, readFile } from "fs/promises";
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

async function getProviders() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, bio, avatar_url")
    .or("is_active.eq.true,is_active.is.null")
    .not("username", "is", null)
    .neq("username", "");

  if (error) {
    console.error("Error fetching providers:", error.message);
    return [];
  }
  return (data || []).filter((p) => p.username);
}

async function getOfferings(supabase, providerIds) {
  if (providerIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("offerings")
    .select("provider_id, title, description, provider_role, price, currency, category, country, city")
    .in("provider_id", providerIds);

  if (error) {
    console.error("Error fetching offerings:", error.message);
    return new Map();
  }
  const map = new Map();
  for (const o of data || []) {
    if (!o.title) continue;
    if (!map.has(o.provider_id)) map.set(o.provider_id, []);
    map.get(o.provider_id).push(o);
  }
  return map;
}

function buildServicesHtml(offerings, providerName) {
  if (!offerings || offerings.length === 0) return "";
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
  return `      <h2>Services offered by ${providerName}</h2>\n${items}\n`;
}

function buildJsonLd(profile, offerings) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: profile.full_name || profile.username,
    alternateName: `@${profile.username}`,
    url: `${BASE_URL}/@${profile.username}`,
  };
  if (profile.avatar_url) jsonLd.image = profile.avatar_url;
  if (profile.bio) jsonLd.description = profile.bio;

  if (offerings && offerings.length > 0) {
    jsonLd.mainEntity = {
      "@type": "ItemList",
      itemListElement: offerings.map((o, i) => ({
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
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

function buildHead(profile) {
  const metaTitle = `${profile.full_name || profile.username} — BookOnMap`;
  const metaDesc = profile.bio
    ? `${profile.full_name || profile.username} — ${profile.bio}`.slice(0, 160)
    : `${profile.full_name || profile.username} على BookOnMap — احجز الخدمة بسهولة وسرعة`;
  const canonicalUrl = `${BASE_URL}/@${profile.username}`;
  const avatar = profile.avatar_url || "";

  return `<title>${escapeHtml(metaTitle)}</title>
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
}

function buildSeoBlock(profile, offerings) {
  const providerName = escapeHtml(profile.full_name || profile.username);
  const providerBio = escapeHtml(profile.bio || "");
  const providerUsername = escapeHtml(profile.username);
  const servicesHtml = buildServicesHtml(offerings, providerName);
  const jsonLd = buildJsonLd(profile, offerings);

  return `    <!-- SEO: Provider content for search engine crawlers -->
    <div id="seo-content" style="display:none" data-seo="true">
      <h1>${providerName}</h1>
      <p>Provider on BookOnMap — @${providerUsername}</p>
${providerBio ? `      <p>${providerBio}</p>\n` : ""}${servicesHtml}    </div>
    <!-- /SEO content -->
    ${jsonLd}`;
}

function injectIntoHtml(baseHtml, headContent, seoBlock) {
  let html = baseHtml;

  // Replace title
  html = html.replace(/<title>[^<]*<\/title>/, headContent);

  // Remove existing static OG/Twitter meta tags
  html = html.replace(/<meta property="og:title"[^>]*>/g, "");
  html = html.replace(/<meta property="og:description"[^>]*>/g, "");
  html = html.replace(/<meta property="og:image"[^>]*>/g, "");
  html = html.replace(/<meta property="og:type"[^>]*>/g, "");
  html = html.replace(/<meta property="og:url"[^>]*>/g, "");
  html = html.replace(/<meta name="twitter:card"[^>]*>/g, "");
  html = html.replace(/<meta name="twitter:title"[^>]*>/g, "");
  html = html.replace(/<meta name="twitter:description"[^>]*>/g, "");
  html = html.replace(/<meta name="twitter:image"[^>]*>/g, "");

  // Insert SEO content before </body>
  html = html.replace("</body>", `${seoBlock}\n  </body>`);

  return html;
}

async function generateSitemap(providers) {
  if (providers.length === 0) return;
  const urls = providers.map((p) => {
    const lastmod = new Date().toISOString().split("T")[0];
    return `  <url>
    <loc>${BASE_URL}/@${escapeXml(p.username)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  await writeFile(join(DIST_DIR, "sitemap.xml"), xml);
  console.log(`Generated sitemap.xml with ${providers.length + 1} URLs.`);
}

async function main() {
  console.log("=== Generating static provider pages ===");

  const providers = await getProviders();
  if (providers.length === 0) {
    console.log("No providers found. Skipping.");
    return;
  }
  console.log(`Found ${providers.length} providers.`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const providerIds = providers.map((p) => p.id).filter(Boolean);
  const offeringsMap = await getOfferings(supabase, providerIds);

  const baseHtml = await readFile(join(DIST_DIR, "index.html"), "utf-8");

  let success = 0;
  for (const profile of providers) {
    try {
      const offerings = offeringsMap.get(profile.id) || [];
      const headContent = buildHead(profile);
      const seoBlock = buildSeoBlock(profile, offerings);
      const html = injectIntoHtml(baseHtml, headContent, seoBlock);

      const outDir = join(DIST_DIR, "@", profile.username);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "index.html"), html);
      success++;
    } catch (err) {
      console.error(`  ERROR for /@${profile.username}: ${err.message}`);
    }
  }

  // Also generate a static sitemap.xml as a fallback
  await generateSitemap(providers);

  console.log(`\nDone: ${success}/${providers.length} provider pages generated.`);
}

main().catch((err) => {
  console.error("Build step failed:", err);
  process.exit(1);
});
