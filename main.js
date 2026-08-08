const puppeteer = require("puppeteer");
const { spawnSync } = require("child_process");
const config = require("./config");
const db = require("./db");
const { sendSummaryEmail } = require("./notifier");
const { generateHtmlReport, ensureReportDir } = require("./reporter");

const { scrapeBazos } = require("./sites/bazos");
const { scrapeWillhaben } = require("./sites/willhaben");
const { scrapeOlx } = require("./sites/olx");
const { scrapeJofogas } = require("./sites/jofogas");
const { scrapeMtbiker } = require("./sites/mtbiker");

let allNewListings = [];
let scrapeErrors = [];

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(15000);

    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    const runQueries = async (siteKey, queries, scrapeFn) => {
      for (const query of queries) {
        try {
          const result = await scrapeFn(query) || {};
          if (result.error) {
            scrapeErrors.push({
              site: siteKey,
              query,
              error: result.error,
              timestamp: new Date().toISOString()
            });
            console.warn(`[${siteKey}] ${result.error}`);
          }
          await handleResults(result.listings || [], query);
        } catch (err) {
          scrapeErrors.push({
            site: siteKey,
            query,
            error: err.message || String(err),
            timestamp: new Date().toISOString()
          });
          console.error(
            `[${siteKey}] Failed for "${query}": ${err.message || err}`
          );
        }
      }
    };

    const siteHandlers = {
      bazos_sk: (queries) =>
        runQueries("bazos_sk", queries, (q) => scrapeBazos(page, "sk", q)),
      bazos_cz: (queries) =>
        runQueries("bazos_cz", queries, (q) => scrapeBazos(page, "cz", q)),
      willhaben_at: (queries) =>
        runQueries("willhaben_at", queries, (q) => scrapeWillhaben(page, q)),
      olx_sk: (queries) =>
        runQueries("olx_sk", queries, (q) => scrapeOlx(page, "sk", q)),
      olx_pl: (queries) =>
        runQueries("olx_pl", queries, (q) => scrapeOlx(page, "pl", q)),
      jofogas_hu: (queries) =>
        runQueries("jofogas_hu", queries, (q) => scrapeJofogas(page, q)),
      mtbiker_sk: (queries) =>
        runQueries("mtbiker_sk", queries, (q) => scrapeMtbiker(page, q))
    };

    for (const [siteKey, enabled] of Object.entries(config.sites)) {
      if (!enabled) continue;

      const queries = config.searchTerms[siteKey] || [];
      console.log(`\n=== Scraping ${siteKey} ===`);

      const handler = siteHandlers[siteKey];
      if (handler) {
        await handler(queries);
      }
    }

    if (config.htmlReport !== false) {
      ensureReportDir();
      await generateHtmlReport(allNewListings, config.htmlReportPath, scrapeErrors);
    }

    if (allNewListings.length > 0 && config.lftp?.enabled) {
      copyReportViaLftp();
    }

    if (allNewListings.length > 0) {
      const reportUrl = config.lftp?.enabled
        ? `https://${config.lftp.host}/snapshot_testing/${config.lftp.path}/index.html`
        : `./report/index.html`;
      await sendSummaryEmail(allNewListings, reportUrl, scrapeErrors);
    }
  } finally {
    await browser.close();
  }
}

async function handleResults(results, query) {
  const listings = Array.isArray(results) ? results : (results?.listings || []);
  
  for (const listing of listings) {
    const exists = await db.hasListing(listing.id);

    if (!exists) {
      listing.query = query;
      console.log("NEW:", listing.title, listing.price, listing.url);
      await db.saveListing(listing);
      allNewListings.push(listing);
    }
  }
}

function copyReportViaLftp() {
  const { lftp } = config;

  const lftpCommands = `mirror -R --delete "./report" "${lftp.path}"
quit`;

  try {
    spawnSync("lftp", [
      "-u", `${lftp.user},${lftp.password}`,
      `sftp://${lftp.host}`,
      "-e", lftpCommands
    ], { stdio: "inherit" });
    console.log(`Report synced to ${lftp.host}`);
  } catch (err) {
    console.error("Failed to sync report via lftp:", err.message);
  }
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
