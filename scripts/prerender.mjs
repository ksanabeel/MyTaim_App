import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";
import { mkdir, writeFile, readFile } from "fs/promises";
import { createServer } from "http";
import { join, extname } from "path";
import { config as loadEnv } from "dotenv";

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DIST_DIR = join(process.cwd(), "dist");
const PORT = 4899;
const BASE_URL = `http://localhost:${PORT}`;

const MIME_FALLBACKS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getMime(ext) {
  return MIME_FALLBACKS[ext] || "application/octet-stream";
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let urlPath = decodeURIComponent(new URL(req.url, BASE_URL).pathname);
        let filePath = join(DIST_DIR, urlPath);

        // SPA fallback: serve index.html for non-asset routes
        const ext = extname(urlPath);
        if (!ext || ext === ".html") {
          // Try exact file first, then index.html
          const fs = await import("fs/promises");
          try {
            const content = await readFile(filePath);
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(content);
            return;
          } catch {
            // Fall through to index.html
          }
          filePath = join(DIST_DIR, "index.html");
        }

        const content = await readFile(filePath);
        res.writeHead(200, { "Content-Type": getMime(extname(filePath)) });
        res.end(content);
      } catch {
        // Final fallback to index.html for SPA routes
        try {
          const content = await readFile(join(DIST_DIR, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end("Not found");
        }
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function getProviderUsernames() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .or("is_active.eq.true,is_active.is.null")
    .not("username", "is", null)
    .neq("username", "");

  if (error) {
    console.error("Error fetching providers:", error.message);
    return [];
  }
  return (data || []).map((p) => p.username).filter(Boolean);
}

async function waitForContent(page, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById("root");
      if (!root) return false;
      return root.children.length > 0 && root.innerHTML.length > 500;
    });
    if (hasContent) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function prerender() {
  console.log("=== Prerendering provider profiles ===");

  const usernames = await getProviderUsernames();
  if (usernames.length === 0) {
    console.log("No providers found. Skipping prerender.");
    return;
  }
  console.log(`Found ${usernames.length} providers to prerender.`);

  const baseHtml = await readFile(join(DIST_DIR, "index.html"), "utf-8");

  // Start a static file server for the dist folder
  console.log(`Starting static server on port ${PORT}...`);
  const server = await startStaticServer();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let successCount = 0;
  let failCount = 0;

  for (const username of usernames) {
    const page = await browser.newPage();
    try {
      const url = `${BASE_URL}/@${username}`;
      console.log(`  Prerendering: /@${username}`);

      await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
      const rendered = await waitForContent(page);

      if (!rendered) {
        console.log(`    WARN: Content did not fully render for /@${username}`);
      }

      const html = await page.content();

      // Save as dist/@username/index.html (clean URL structure)
      const outDir = join(DIST_DIR, "@", username);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "index.html"), html);

      successCount++;
    } catch (err) {
      console.error(`    ERROR for /@${username}: ${err.message}`);
      const outDir = join(DIST_DIR, "@", username);
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "index.html"), baseHtml);
      failCount++;
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Close the static server
  server.close();

  console.log(`\nPrerender complete: ${successCount} succeeded, ${failCount} failed.`);
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
