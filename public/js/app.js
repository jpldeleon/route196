(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Theme system                                                        */
  /* ------------------------------------------------------------------ */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const themeLabel = document.getElementById("themeLabel");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    themeToggle.setAttribute("aria-checked", theme === "mocha" ? "true" : "false");
    themeLabel.textContent = theme === "mocha" ? "Mocha" : "Latte";
    localStorage.setItem("route196-theme", theme);
  }

  const savedTheme = localStorage.getItem("route196-theme");
  const preferredTheme = savedTheme || "mocha";
  applyTheme(preferredTheme);

  themeToggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    applyTheme(current === "mocha" ? "latte" : "mocha");
  });

  /* ------------------------------------------------------------------ */
  /* Toast                                                                */
  /* ------------------------------------------------------------------ */
  const toastEl = document.getElementById("toast");
  let toastTimer;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-visible"), 2400);
  }

  /* ------------------------------------------------------------------ */
  /* Panel switching (floating pill acts as tabs + smooth scroll)        */
  /* ------------------------------------------------------------------ */
  const panels = document.querySelectorAll(".panel");
  const pillItems = document.querySelectorAll(".pill-nav__item[data-panel]");

  function activatePanel(name, { scroll = true } = {}) {
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
    pillItems.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.panel === name));
    if (scroll) {
      const target = document.getElementById(name);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  pillItems.forEach((btn) => {
    btn.addEventListener("click", () => activatePanel(btn.dataset.panel));
  });

  /* ------------------------------------------------------------------ */
  /* Output card state helper                                            */
  /* ------------------------------------------------------------------ */
  function setCardState(card, state) {
    card.dataset.state = state; // idle | loading | result | error
  }

  /* ------------------------------------------------------------------ */
  /* Robots.txt inspector                                                */
  /* ------------------------------------------------------------------ */
  const robotsForm = document.getElementById("robotsForm");
  const robotsOutput = document.getElementById("robotsOutput");
  const robotsStatusBadge = document.getElementById("robotsStatusBadge");
  const robotsCheckedUrl = document.getElementById("robotsCheckedUrl");
  const robotsContent = document.getElementById("robotsContent");

  robotsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("robotsUrl").value.trim();
    if (!url) return;
    setCardState(robotsOutput, "loading");
    toggleFormBusy(robotsForm, true);

    try {
      const res = await fetch(`/api/robots?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.ok) {
        setCardState(robotsOutput, "error");
        showToast(data.error || "Something went wrong.");
        return;
      }

      robotsCheckedUrl.textContent = data.checkedUrl;
      robotsCheckedUrl.href = data.checkedUrl;

      if (data.networkError) {
        robotsStatusBadge.textContent = "Unreachable";
        robotsStatusBadge.dataset.status = "error";
        robotsContent.textContent = data.networkError;
      } else if (data.found) {
        robotsStatusBadge.textContent = `${data.status} OK`;
        robotsStatusBadge.dataset.status = "ok";
        robotsContent.textContent = data.content || "(robots.txt is empty)";
      } else {
        robotsStatusBadge.textContent = `${data.status || 404} Not Found`;
        robotsStatusBadge.dataset.status = "missing";
        robotsContent.textContent = "No robots.txt found at this location.";
      }
      setCardState(robotsOutput, "result");
    } catch (err) {
      setCardState(robotsOutput, "error");
      showToast("Could not complete the inspection.");
    } finally {
      toggleFormBusy(robotsForm, false);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Sitemap.xml inspector                                               */
  /* ------------------------------------------------------------------ */
  const sitemapForm = document.getElementById("sitemapForm");
  const sitemapOutput = document.getElementById("sitemapOutput");
  const sitemapStatusBadge = document.getElementById("sitemapStatusBadge");
  const sitemapCheckedUrl = document.getElementById("sitemapCheckedUrl");
  const sitemapCount = document.getElementById("sitemapCount");
  const sitemapUrls = document.getElementById("sitemapUrls");

  sitemapForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("sitemapUrl").value.trim();
    if (!url) return;
    setCardState(sitemapOutput, "loading");
    toggleFormBusy(sitemapForm, true);

    try {
      const res = await fetch(`/api/sitemap?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.ok) {
        setCardState(sitemapOutput, "error");
        showToast(data.error || "Something went wrong.");
        return;
      }

      sitemapCheckedUrl.textContent = data.checkedUrl;
      sitemapCheckedUrl.href = data.checkedUrl;
      sitemapUrls.innerHTML = "";

      if (data.networkError) {
        sitemapStatusBadge.textContent = "Unreachable";
        sitemapStatusBadge.dataset.status = "error";
        sitemapCount.textContent = data.networkError;
      } else if (data.found) {
        sitemapStatusBadge.textContent = `${data.status} OK`;
        sitemapStatusBadge.dataset.status = "ok";
        const kind = data.isIndex ? "sitemap index entries" : "URLs";
        sitemapCount.innerHTML = `<strong>${data.count}</strong> ${kind} discovered${data.count > data.urls.length ? " (showing first " + data.urls.length + ")" : ""}.`;
        data.urls.forEach((loc) => {
          const item = document.createElement("div");
          item.className = "url-grid__item";
          const a = document.createElement("a");
          a.href = loc;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = loc;
          item.appendChild(a);
          sitemapUrls.appendChild(item);
        });
      } else {
        sitemapStatusBadge.textContent = `${data.status || 404} Not Found`;
        sitemapStatusBadge.dataset.status = "missing";
        sitemapCount.textContent = "No sitemap.xml found at this location.";
      }
      setCardState(sitemapOutput, "result");
    } catch (err) {
      setCardState(sitemapOutput, "error");
      showToast("Could not complete the inspection.");
    } finally {
      toggleFormBusy(sitemapForm, false);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Redirect path checker                                               */
  /* ------------------------------------------------------------------ */
  const redirectForm = document.getElementById("redirectForm");
  const redirectsOutput = document.getElementById("redirectsOutput");
  const hopList = document.getElementById("hopList");
  const hopSummary = document.getElementById("hopSummary");

  const HOP_ICON = {
    http: '<span class="hop-card__arrow">↳</span>',
    js: "JS",
    meta: "M",
    final: "✓",
    loop: "!",
    error: "!"
  };

  function renderHops(hops) {
    hopList.innerHTML = "";
    hops.forEach((hop) => {
      const card = document.createElement("div");
      card.className = "hop-card";
      card.dataset.type = hop.type;
      const icon = HOP_ICON[hop.type] || "?";
      card.innerHTML = `
        <span class="hop-card__icon">${icon}</span>
        <div class="hop-card__body">
          <a class="hop-card__url" href="${hop.url}" target="_blank" rel="noopener">${hop.url}</a>
          <p class="hop-card__desc">${hop.description}</p>
        </div>
      `;
      hopList.appendChild(card);
    });

    const finalHop = hops[hops.length - 1];
    const kind = finalHop.type === "final" ? "lands on" : finalHop.type === "loop" ? "loops at" : "stops at";
    hopSummary.innerHTML = `<strong>${hops.length}</strong> hop${hops.length === 1 ? "" : "s"} traced — ${kind} <code>${finalHop.url}</code>`;
  }

  redirectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("redirectUrl").value.trim();
    if (!url) return;

    setCardState(redirectsOutput, "loading");
    toggleFormBusy(redirectForm, true);

    try {
      const res = await fetch(`/api/redirect-check?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!data.ok) {
        setCardState(redirectsOutput, "error");
        showToast(data.error || "Could not trace that URL.");
        return;
      }
      renderHops(data.hops);
      setCardState(redirectsOutput, "result");
    } catch (err) {
      setCardState(redirectsOutput, "error");
      showToast("Could not trace that URL.");
    } finally {
      toggleFormBusy(redirectForm, false);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Wayback Machine inspector                                           */
  /* ------------------------------------------------------------------ */
  const waybackForm = document.getElementById("waybackForm");
  const waybackOutput = document.getElementById("waybackOutput");
  const waybackStatusBadge = document.getElementById("waybackStatusBadge");
  const waybackCheckedUrl = document.getElementById("waybackCheckedUrl");
  const waybackSummary = document.getElementById("waybackSummary");
  const waybackSnapshots = document.getElementById("waybackSnapshots");

  waybackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("waybackUrl").value.trim();
    if (!url) return;
    setCardState(waybackOutput, "loading");
    toggleFormBusy(waybackForm, true);

    try {
      const res = await fetch(`/api/wayback?url=${encodeURIComponent(url)}`);
      const data = await res.json();

      if (!data.ok) {
        setCardState(waybackOutput, "error");
        showToast(data.error || "Something went wrong.");
        return;
      }

      waybackCheckedUrl.textContent = data.checkedUrl;
      waybackCheckedUrl.href = data.checkedUrl;
      waybackSnapshots.innerHTML = "";

      if (data.networkError) {
        waybackStatusBadge.textContent = "Unreachable";
        waybackStatusBadge.dataset.status = "error";
        waybackSummary.textContent = data.networkError;
      } else if (data.closest) {
        waybackStatusBadge.textContent = "Archived";
        waybackStatusBadge.dataset.status = "ok";
        waybackSummary.innerHTML = `Closest snapshot: <strong>${data.closest.date}</strong> — <a href="${data.closest.url}" target="_blank" rel="noopener">view capture</a>. ${data.snapshotCount} recent capture${data.snapshotCount === 1 ? "" : "s"} on file.`;
        data.snapshots.forEach((snap) => {
          const item = document.createElement("div");
          item.className = "url-grid__item";
          const a = document.createElement("a");
          a.href = snap.waybackUrl;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = `${snap.date} (HTTP ${snap.status})`;
          item.appendChild(a);
          waybackSnapshots.appendChild(item);
        });
      } else {
        waybackStatusBadge.textContent = "Not Archived";
        waybackStatusBadge.dataset.status = "missing";
        waybackSummary.textContent = "The Wayback Machine has no snapshots of this URL yet.";
      }
      setCardState(waybackOutput, "result");
    } catch (err) {
      setCardState(waybackOutput, "error");
      showToast("Could not complete the inspection.");
    } finally {
      toggleFormBusy(waybackForm, false);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Clear / Reset                                                        */
  /* ------------------------------------------------------------------ */
  function clearRobots() {
    robotsForm.reset();
    setCardState(robotsOutput, "idle");
  }
  function clearSitemap() {
    sitemapForm.reset();
    setCardState(sitemapOutput, "idle");
    sitemapUrls.innerHTML = "";
  }
  function clearRedirects() {
    redirectForm.reset();
    hopList.innerHTML = "";
    hopSummary.innerHTML = "";
    setCardState(redirectsOutput, "idle");
  }
  function clearWayback() {
    waybackForm.reset();
    waybackSnapshots.innerHTML = "";
    waybackSummary.innerHTML = "";
    setCardState(waybackOutput, "idle");
  }

  document.querySelectorAll("[data-clear]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.clear;
      if (target === "robots") clearRobots();
      if (target === "sitemap") clearSitemap();
      if (target === "redirects") clearRedirects();
      if (target === "wayback") clearWayback();
      showToast("Cleared.");
    });
  });

  document.getElementById("pillReset").addEventListener("click", () => {
    clearRobots();
    clearSitemap();
    clearRedirects();
    clearWayback();
    showToast("Everything's reset.");
  });

  function toggleFormBusy(form, busy) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = "Working…";
    } else if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
  }

})();