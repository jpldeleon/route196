# Route 196 — A Cozy Route & Site Inspector

Route 196 is a small Express/EJS toolkit for checking how a website presents itself to the web: its `robots.txt`, its `sitemap.xml`, its redirect chain, and — new — its history in the **Internet Archive's Wayback Machine**.

## Features

| Panel | What it does |
|---|---|
| **Robots.txt Looker** | Fetches and displays a site's `robots.txt` |
| **Sitemap.xml Looker** | Fetches a site's `sitemap.xml` and lists the URLs (or sitemap index entries) it contains |
| **Redirect Path Checker** | Follows a URL's full redirect chain — HTTP 3xx, `<meta http-equiv="refresh">`, and JavaScript `window.location` jumps — hop by hop |
| **Wayback Machine Looker** | *(capstone API integration)* Calls the [Internet Archive Wayback Machine](https://archive.org/) API via **Axios** to find the closest archived snapshot of a URL and list its 10 most recent captures |

## Tech Stack

- **Node.js** + **Express** — server and routing
- **EJS** — server-rendered templating
- **Axios** — HTTP requests to the Wayback Machine API
- Native `fetch` — used internally by the pre-existing robots/sitemap/redirect tools (built before the Axios requirement was introduced)
- Vanilla JS + CSS on the frontend, no build step

## Getting Started

1. **Install dependencies**
   ```bash
   npm i
   ```

2. **Start the server**
   ```bash
   npm start
   ```
   or, for auto-restart on file changes:
   ```bash
   npm run dev
   ```

3. Open **http://localhost:3000** in your browser.

No API keys or environment variables are required — every API used (robots.txt/sitemap.xml fetches, the redirect checker, and the Wayback Machine) is public and unauthenticated.

## Wayback Machine Integration (Capstone API Requirement)

The **Wayback Machine Looker** panel is the capstone's required public-API integration, chosen because it's free, requires no authentication, and lets users retrieve, manipulate, and present genuinely interesting data.

- **Endpoint:** `GET /api/wayback?url=<site>`
- **Server logic** (`server.js`): uses **Axios** to call:
  1. the [Availability API](https://archive.org/help/wayback_api.php) (`https://archive.org/wayback/available`) to find the closest archived snapshot to right now, and
  2. the [CDX API](https://github.com/internetarchive/wayback/tree/master/wayback-cdx-server) (`https://web.archive.org/cdx/search/cdx`) to pull up to 10 recent, successful (HTTP 200) captures.
- The raw timestamps (`YYYYMMDDhhmmss`) returned by the API are reformatted into human-readable dates before being sent to the client — this is the "data manipulation" step.
- **Client logic** (`public/js/app.js`): submits the form, calls `/api/wayback`, and renders a status badge, a summary line with a link to the closest snapshot, and a grid of recent capture links.
- **Error handling:** unreachable hosts or API failures return `ok: true` with a `networkError` message rather than crashing, so the UI can show a friendly "Unreachable" state instead of a stack trace.

## Project Structure

```
route196/
├── server.js              # Express app + all /api routes
├── package.json
├── views/
│   ├── index.ejs           # Main page — all four tool panels
│   └── partials/
│       ├── head.ejs
│       ├── header.ejs
│       ├── footer.ejs
│       └── nav-pill.ejs    # Floating pill nav / tab switcher
└── public/
    ├── css/style.css
    └── js/app.js            # Frontend logic for all four panels
```

## Requirements Checklist

- [x] Express/Node.js project with a chosen public API (Wayback Machine)
- [x] Axios used to call the chosen API and handle its response
- [x] EJS templating for all views
- [x] At least one GET endpoint integrating the API (`/api/wayback`)
- [x] Data presented in a user-friendly way (status badge, snapshot links, formatted dates)
- [x] Error handling on both the server (try/catch, timeouts, friendly fallback JSON) and client (toast messages, "Unreachable"/"Not Archived" states)
- [x] Commented code throughout
- [x] README with setup instructions

## Author

Built by [jpldeleon](https://jpldeleon.github.io/) — [GitHub repo](https://github.com/jpldeleon/route196)