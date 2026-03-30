const fs = require("fs");
const path = require("path");

const REPORT_DIR = "./report";

function generateHtmlReport(listings, outputPath) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `report-${timestamp}.html`;
  const reportPath = path.join(REPORT_DIR, filename);

  const itemsHtml = listings.map(item => `
    <div class="item">
      ${item.image ? `<img src="${item.image}" alt="${item.title}" onerror="this.style.display='none'">` : ""}
      <div class="content">
        <h3><a href="${item.url}" target="_blank">${item.title}</a></h3>
        <p class="price">${item.price}</p>
        <p class="site">${item.site}</p>
        ${item.date ? `<p class="date">Added: ${item.date}</p>` : ""}
        <p class="query">Search: ${item.query}</p>
      </div>
    </div>
  `).join("\n");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stolen Bike Search Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .item { 
      background: white; 
      border-radius: 8px; 
      padding: 15px; 
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .item img { 
      width: 150px; 
      height: 150px; 
      object-fit: cover; 
      border-radius: 4px;
    }
    .item .content { flex: 1; }
    .item h3 { margin: 0 0 5px 0; }
    .item h3 a { color: #0066cc; text-decoration: none; }
    .item h3 a:hover { text-decoration: underline; }
    .price { font-weight: bold; color: #2a9d8f; margin: 5px 0; font-size: 1.1em; }
    .site { color: #666; font-size: 0.9em; margin: 3px 0; }
    .date { color: #e76f51; font-size: 0.9em; margin: 3px 0; font-weight: 500; }
    .query { color: #888; font-size: 0.8em; margin: 3px 0; }
    .count { color: #666; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>🚲 Stolen Bike Search Results</h1>
  <p class="count">Found ${listings.length} listings</p>
  ${itemsHtml}
</body>
</html>`;

  fs.writeFileSync(reportPath, html);
  console.log(`\nHTML report saved to: ${reportPath}`);

  updateIndex();
}

function updateIndex() {
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.endsWith(".html") && f !== "index.html")
    .sort()
    .reverse();

  const linksHtml = files.map(f => {
    const stat = fs.statSync(path.join(REPORT_DIR, f));
    const date = stat.mtime.toLocaleString();
    return `<li><a href="${f}">${f}</a> - ${date}</li>`;
  }).join("\n");

  const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reports Index</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { background: white; padding: 10px; margin-bottom: 8px; border-radius: 4px; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📋 Reports Index</h1>
  <ul>
    ${linksHtml}
  </ul>
</body>
</html>`;

  fs.writeFileSync(path.join(REPORT_DIR, "index.html"), indexHtml);
  console.log(`Index updated: ${REPORT_DIR}/index.html`);
}

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  updateIndex();
}

module.exports = { generateHtmlReport, ensureReportDir };
