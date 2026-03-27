const puppeteer = require("puppeteer");
const config = require("./config");
const db = require("./db");
const { sendEmailAlert } = require("./notifier");
const { generateHtmlReport, ensureReportDir } = require("./reporter");

const { scrapeBazos } = require("./sites/bazos");
const { scrapeWillhaben } = require("./sites/willhaben");
const { scrapeOlx } = require("./sites/olx");
const { scrapeJofogas } = require("./sites/jofogas");

let allNewListings = [];

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
          const results = await scrapeFn(query);
          await handleResults(results, query);
        } catch (err) {
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
        runQueries("jofogas_hu", queries, (q) => scrapeJofogas(page, q))
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
    }

    if (allNewListings.length > 0 && config.htmlReport !== false) {
      const reportPath = config.htmlReportPath || "./report.html";
      generateHtmlReport(allNewListings, reportPath);
    }
  } finally {
    await browser.close();
  }
}

async function handleResults(results, query) {
  for (const listing of results) {
    const exists = await db.hasListing(listing.id);

    if (!exists) {
      listing.query = query;
      console.log("NEW:", listing.title, listing.price, listing.url);
      await db.saveListing(listing);
      allNewListings.push(listing);
      await sendEmailAlert(listing);
    }
  }
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
