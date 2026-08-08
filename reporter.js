const fs = require("fs");
const path = require("path");
const config = require("./config");
const db = require("./db");

const DEFAULT_REPORT_DIR = "./report";
const FINDINGS_FILE = "findings.json";
const INDEX_FILE = "index.html";
const DEFAULT_KEEP_DAYS = 30;
const DEFAULT_WINDOW_SIZE = 100;

function reportDir() {
  const dir = (config.htmlReportPath || DEFAULT_REPORT_DIR).replace(/\/+$/, "");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function keepDays() {
  const days = Number(config.htmlReportKeepDays);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_KEEP_DAYS;
}

function windowSize() {
  const n = Number(config.htmlReportWindowSize);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WINDOW_SIZE;
}

function findingsPath() {
  return path.join(reportDir(), FINDINGS_FILE);
}

function ageDays(indexedAt) {
  const time = indexedAt ? new Date(indexedAt).getTime() : Date.now();
  return (Date.now() - time) / 86400000;
}

function pruneOld(items) {
  const maxAge = keepDays();
  return items.filter((item) => ageDays(item.indexedAt) <= maxAge);
}

function loadFindingsFile() {
  const file = findingsPath();
  if (!fs.existsSync(file)) return null;
  try {
    const items = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(items) ? items : null;
  } catch (err) {
    console.warn(`Could not parse ${FINDINGS_FILE}, rebuilding:`, err.message);
    return null;
  }
}

async function ensureFindings() {
  const stored = loadFindingsFile();
  if (stored) {
    const pruned = pruneOld(stored);
    fs.writeFileSync(findingsPath(), JSON.stringify(pruned, null, 2), "utf8");
    return pruned;
  }

  const rows = await db.getAllListings().catch(() => []);
  const items = rows.map((row) => ({
    id: row.id,
    site: row.site,
    title: row.title,
    price: row.price,
    url: row.url,
    query: row.query || "",
    image: row.image || null,
    date: row.date || null,
    indexedAt: row.created_at || new Date().toISOString()
  }));

  fs.writeFileSync(findingsPath(), JSON.stringify(items, null, 2), "utf8");
  return items;
}

function serializeItem(listing) {
  return {
    id: listing.id,
    site: listing.site,
    title: listing.title,
    price: listing.price,
    url: listing.url,
    query: listing.query || "",
    image: listing.image || null,
    date: listing.date || null,
    indexedAt: listing.indexedAt || new Date().toISOString()
  };
}

function mergeNew(findings, newListings) {
  const existing = new Map(findings.map((item) => [item.id, item]));

  for (const listing of newListings) {
    if (!listing || !listing.id || existing.has(listing.id)) continue;
    existing.set(listing.id, serializeItem(listing));
  }

  return Array.from(existing.values());
}

function sortFindings(items) {
  return items
    .map((item) => ({
      ...item,
      indexedTime: new Date(item.indexedAt || 0).getTime()
    }))
    .sort((a, b) => b.indexedTime - a.indexedTime)
    .map(({ indexedTime, ...item }) => item);
}

function removeStaleReportFiles(dir) {
  for (const file of fs.readdirSync(dir)) {
    if (/^report-.*\.html$/.test(file)) {
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch (err) {
        console.warn(`Could not remove stale file ${file}:`, err.message);
      }
    }
  }
}

function escapeHtmlJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

async function generateHtmlReport(listings, outputPath, errors = []) {
  const dir = reportDir();

  let findings = await ensureFindings();
  findings = mergeNew(findings, listings);
  findings = pruneOld(findings);
  findings = sortFindings(findings);

  fs.writeFileSync(findingsPath(), JSON.stringify(findings, null, 2), "utf8");

  const html = buildIndexHtml(findings, errors);
  fs.writeFileSync(path.join(dir, INDEX_FILE), html, "utf8");

  console.log(`Report saved to: ${path.join(dir, INDEX_FILE)}`);
  console.log(`Findings store: ${findingsPath()} (${findings.length} items)`);

  removeStaleReportFiles(dir);

  return findings;
}

const CLIENT_JS = String.raw`
"use strict";

(function () {
  var REPORT = window.__REPORT__ || {};
  var rowsArr = REPORT.rows || [];
  var items = rowsArr;
  var WINDOW = Math.max(10, REPORT.window || 100);
  var MAX_RENDER = Math.max(60, WINDOW * 2);

  function findEl(id) { return document.getElementById(id); }
  var countEl = findEl("count");
  var topPadEl = findEl("topPad");
  var feedEl = findEl("feed");
  var bottomPadEl = findEl("bottomPad");

  if (countEl) countEl.textContent = REPORT.count || items.length;
  var genEl = findEl("generatedAt");
  if (genEl && REPORT.generatedAt) {
    genEl.textContent = new Date(REPORT.generatedAt).toLocaleString();
  }

  var errorsEl = findEl("errors");
  var errorsPanel = findEl("errorsPanel");
  var errorsBody = REPORT.errors || [];
  if (errorsEl && errorsBody.length) {
    var rows = "";
    errorsBody.forEach(function (e) {
      rows += "<tr>" +
        "<td>" + esc(e.site || "") + "</td>" +
        "<td>" + esc(e.query || "") + "</td>" +
        "<td>" + esc(e.error || "") + "</td>" +
        "<td>" + new Date(e.timestamp).toLocaleString() + "</td>" +
        "</tr>";
    });
    errorsEl.innerHTML = rows;
    if (errorsPanel) errorsPanel.style.display = "block";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function itemEl(item) {
    var div = document.createElement("div");
    div.className = "item";
    var img = item.image
      ? '<img src="' + esc(item.image) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : "";
    var date = item.date ? '<p class="date">Added: ' + esc(item.date) + "</p>" : "";
    div.innerHTML =
      img +
      '<div class="content">' +
        '<h3><a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + "</a></h3>" +
        '<p class="price">' + esc(item.price) + "</p>" +
        '<p class="site">' + esc(item.site) + "</p>" +
        date +
        '<p class="query">Search: ' + esc(item.query) + "</p>" +
      "</div>";
    return div;
  }

  function headerEl(date, count) {
    var div = document.createElement("div");
    div.className = "day-header";
    div.innerHTML =
      '<span class="day">&#128197; Indexed: ' + esc(date) + "</span>" +
      '<span class="day-count">' + count + " items</span>";
    return div;
  }

  function buildEl(entry) {
    if (entry.d) return headerEl(entry.d, entry.c);
    return itemEl(entry.i);
  }

  var heights = new Array(items.length);
  var heightSum = 0;
  var heightCount = 0;
  var avgHeight = 160;

  function heightOf(i) {
    return heights[i] != null ? heights[i] : avgHeight;
  }

  function offsetAt(endExclusive) {
    var acc = 0;
    for (var k = 0; k < endExclusive; k++) acc += heightOf(k);
    return acc;
  }

  function totalHeight() {
    return offsetAt(items.length);
  }

  function findIndex(y) {
    if (y <= 0) return 0;
    var acc = 0;
    for (var i = 0; i < items.length; i++) {
      var h = heightOf(i);
      if (acc + h > y) return i;
      acc += h;
    }
    return Math.max(0, items.length - 1);
  }

  function setHeight(el, value) {
    el.style.height = value + "px";
  }

  var start = 0;
  var end = 0;

  function render() {
    var oldTop = topPadEl.offsetHeight;
    var oldMid = 0;
    var children = feedEl.children;
    var i;
    for (i = 0; i < children.length; i++) oldMid += children[i].offsetHeight;
    var oldBottom = bottomPadEl.offsetHeight;
    var oldTotal = oldTop + oldMid + oldBottom;

    feedEl.innerHTML = "";
    for (i = start; i < end; i++) {
      feedEl.appendChild(buildEl(items[i]));
    }

    var newMid = 0;
    children = feedEl.children;
    for (i = 0; i < children.length; i++) {
      var idx = start + i;
      var h = children[i].offsetHeight;
      if (heights[idx] == null) {
        heightSum += h;
        heightCount++;
        avgHeight = heightSum / heightCount;
      }
      heights[idx] = h;
      newMid += h;
    }

    var top = offsetAt(start);
    var bottom = Math.max(0, totalHeight() - offsetAt(end));
    setHeight(topPadEl, top);
    setHeight(bottomPadEl, bottom);
  }

  function resize() {
    var vh = window.innerHeight;
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;

    var ns = findIndex(Math.max(0, sy - vh));
    var ne = Math.min(items.length, findIndex(Math.max(0, sy + vh * 3.5)) + 1);
    if (ne - ns < WINDOW) {
      var missing = WINDOW - (ne - ns);
      ns = Math.max(0, ns - missing);
      ne = Math.min(items.length, ns + WINDOW);
    }
    if (ne - ns > MAX_RENDER) {
      ne = ns + MAX_RENDER;
    }

    if (start !== ns || end !== ne) {
      start = ns;
      end = ne;
      render();
    }
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      resize();
      ticking = false;
    });
  }

  document.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  resize();
})();
`;

function dayKey(indexedAt) {
  return (indexedAt || "").slice(0, 10) || "Unknown";
}

function buildRows(findings) {
  const rows = [];
  let currentDay = null;
  let currentBatch = [];

  const flush = () => {
    if (currentBatch.length === 0) return;
    rows.push({ d: currentDay, c: currentBatch.length });
    for (const item of currentBatch) rows.push({ i: item });
    currentBatch = [];
  };

  for (const item of findings) {
    const day = dayKey(item.indexedAt);
    if (currentDay && day !== currentDay) {
      flush();
    }
    currentDay = day;
    currentBatch.push(item);
  }
  flush();

  return rows;
}

function buildIndexHtml(findings, errors) {
  const payload = escapeHtmlJson({
    rows: buildRows(findings),
    count: findings.length,
    errors: errors || [],
    window: windowSize(),
    generatedAt: new Date().toISOString()
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stolen Bike Search Feed</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      background: #f5f5f5;
      color: #333;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #fff;
      border-bottom: 1px solid #eee;
      padding: 12px 20px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
    .topbar h1 { margin: 0; font-size: 18px; color: #222; }
    .topbar .sub { color: #888; font-size: 12px; margin-top: 4px; }
    .main { max-width: 780px; margin: 0 auto; padding: 16px; }
    #errorsPanel {
      display: none;
      background: #fff4f4;
      border: 1px solid #f5c2c2;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    #errorsPanel summary { cursor: pointer; color: #b00020; font-weight: 600; }
    #errorsTable { width: 100%; border-collapse: collapse; margin-top: 8px; }
    #errorsTable th, #errorsTable td { padding: 6px 8px; border: 1px solid #f0d0d0; text-align: left; font-size: 12px; }
    #errorsTable th { background: #fdecec; }
    .item {
      display: flex;
      gap: 14px;
      align-items: center;
      background: #fff;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .item img {
      width: 150px;
      height: 150px;
      object-fit: cover;
      border-radius: 6px;
      flex: 0 0 auto;
    }
    .item .content { min-width: 0; }
    .item h3 { margin: 0 0 6px 0; font-size: 15px; }
    .item h3 a { color: #0066cc; text-decoration: none; word-break: break-word; }
    .item h3 a:hover { text-decoration: underline; }
    .price { font-weight: 700; color: #2a9d8f; margin: 4px 0; font-size: 15px; }
    .site { color: #666; font-size: 12px; margin: 3px 0; }
    .date { color: #e76f51; font-size: 12px; margin: 3px 0; }
    .query { color: #888; font-size: 11px; margin: 3px 0; }
    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #222;
      color: #fff;
      border-radius: 8px;
      padding: 8px 14px;
      margin: 6px 0 12px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .day-header .day-count { color: #bbb; font-size: 12px; font-weight: 400; }
    .bottom-line { text-align: center; color: #888; font-size: 12px; padding: 8px 0 24px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>&#128690; Stolen Bike Findings Feed</h1>
    <div class="sub"><span id="count">0</span> findings &middot; updated <span id="generatedAt"></span></div>
  </div>
  <div class="main">
    <details id="errorsPanel">
      <summary>&#9888;&#65039; Scrape errors</summary>
      <table id="errorsTable">
        <thead><tr><th>Site</th><th>Query</th><th>Error</th><th>Time</th></tr></thead>
        <tbody id="errors"></tbody>
      </table>
    </details>
    <div id="topPad"></div>
    <div id="feed"></div>
    <div id="bottomPad"></div>
    <div class="bottom-line">End of feed</div>
  </div>
  <script>
    window.__REPORT__ = ${payload};
  ${CLIENT_JS}
  </script>
</body>
</html>`;
}

function ensureReportDir() {
  reportDir();
}

module.exports = { generateHtmlReport, ensureReportDir };