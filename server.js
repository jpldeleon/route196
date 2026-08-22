const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function normalizeUrl(raw) {
  if (!raw) return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, ms = 8000, redirectMode = "follow") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: redirectMode,
      headers: { "User-Agent": "Route196-Inspector/1.0 (+cozy site inspector)" }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------- */
/* View                                                                  */
/* -------------------------------------------------------------------- */
app.get("/", (req, res) => {
  res.render("index");
});

/* -------------------------------------------------------------------- */
/* robots.txt inspector                                                 */
/* -------------------------------------------------------------------- */
app.get("/api/robots", async (req, res) => {
  const target = normalizeUrl(req.query.url);
  if (!target) {
    return res.status(400).json({ ok: false, error: "Enter a valid URL, like example.com" });
  }
  const robotsUrl = new URL("/robots.txt", target).toString();
  try {
    const response = await fetchWithTimeout(robotsUrl);
    const body = response.ok ? await response.text() : "";
    return res.json({
      ok: true,
      checkedUrl: robotsUrl,
      status: response.status,
      found: response.ok,
      content: response.ok ? body : ""
    });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      checkedUrl: robotsUrl,
      status: 0,
      found: false,
      content: "",
      networkError: "Could not reach that host."
    });
  }
});

/* -------------------------------------------------------------------- */
/* sitemap.xml inspector                                                */
/* -------------------------------------------------------------------- */
app.get("/api/sitemap", async (req, res) => {
  const target = normalizeUrl(req.query.url);
  if (!target) {
    return res.status(400).json({ ok: false, error: "Enter a valid URL, like example.com" });
  }
  const sitemapUrl = new URL("/sitemap.xml", target).toString();
  try {
    const response = await fetchWithTimeout(sitemapUrl);
    if (!response.ok) {
      return res.json({
        ok: true,
        checkedUrl: sitemapUrl,
        status: response.status,
        found: false,
        isIndex: false,
        urls: []
      });
    }
    const xml = await response.text();
    const isIndex = /<sitemapindex/i.test(xml);
    const locMatches = [...xml.matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)].map((m) => m[1]);
    return res.json({
      ok: true,
      checkedUrl: sitemapUrl,
      status: response.status,
      found: true,
      isIndex,
      count: locMatches.length,
      urls: locMatches.slice(0, 200)
    });
  } catch (err) {
    return res.status(200).json({
      ok: true,
      checkedUrl: sitemapUrl,
      status: 0,
      found: false,
      isIndex: false,
      urls: [],
      networkError: "Could not reach that host."
    });
  }
});

/* -------------------------------------------------------------------- */
/* Redirect path checker — follows the real hop-by-hop chain:           */
/* HTTP 3xx, <meta http-equiv="refresh">, and window.location JS jumps. */
/* -------------------------------------------------------------------- */
const HTTP_STATUS_TEXT = {
  200: "HTTP/1.1 200",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  404: "Not Found",
  500: "Internal Server Error"
};

function findMetaRefreshTarget(html, baseUrl) {
  const match = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?\s*\d+\s*;\s*url=([^"'>]+)/i);
  if (!match) return null;
  try {
    return new URL(match[1].trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function findJsRedirectTarget(html, baseUrl) {
  const patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i,
    /window\.location\.replace\(\s*["']([^"']+)["']\s*\)/i,
    /location\.href\s*=\s*["']([^"']+)["']/i,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        return new URL(match[1].trim(), baseUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

app.get("/api/redirect-check", async (req, res) => {
  const start = normalizeUrl(req.query.url);
  if (!start) {
    return res.status(400).json({ ok: false, error: "Enter a valid URL, like example.com" });
  }

  const hops = [];
  const seen = new Set();
  let current = start;
  const MAX_HOPS = 10;

  try {
    for (let i = 0; i < MAX_HOPS; i++) {
      if (seen.has(current)) {
        hops.push({ type: "loop", status: null, url: current, description: "Redirect loop detected — this URL was already visited." });
        break;
      }
      seen.add(current);

      const response = await fetchWithTimeout(current, 8000, "manual");
      const status = response.status;

      if (status >= 300 && status < 400 && response.headers.get("location")) {
        const location = new URL(response.headers.get("location"), current).toString();
        hops.push({
          type: "http",
          status,
          url: current,
          target: location,
          description: `${status} ${HTTP_STATUS_TEXT[status] || ""} → ${location}`.trim()
        });
        current = location;
        continue;
      }

      // Not an HTTP redirect — check the body for a meta-refresh or JS redirect.
      let html = "";
      try {
        html = await response.text();
      } catch {
        html = "";
      }

      const metaTarget = findMetaRefreshTarget(html, current);
      const jsTarget = !metaTarget ? findJsRedirectTarget(html, current) : null;
      const target = metaTarget || jsTarget;

      if (target) {
        hops.push({
          type: metaTarget ? "meta" : "js",
          status,
          url: current,
          target,
          description: `${status} then ${metaTarget ? "META" : "JAVASCRIPT"} redirect to ${target}`
        });
        current = target;
        continue;
      }

      hops.push({
        type: "final",
        status,
        url: current,
        description: `${status}: ${HTTP_STATUS_TEXT[status] || `HTTP/1.1 ${status}`}`
      });
      break;
    }

    if (hops.length === MAX_HOPS && hops[hops.length - 1].type !== "final" && hops[hops.length - 1].type !== "loop") {
      hops.push({ type: "final", status: null, url: current, description: "Stopped after 10 hops — this chain may be unusually long." });
    }

    res.json({ ok: true, startUrl: start, hops });
  } catch (err) {
    res.json({
      ok: true,
      startUrl: start,
      hops: [
        { type: "error", status: null, url: current, description: "Could not reach that host." }
      ]
    });
  }
});

app.listen(PORT, () => {
  console.log(`Route 196 is running → http://localhost:${PORT}`);
});
