const { waitForAnySelector } = require("./scrapeUtils");

const scrapeWillhaben = async (page, query) => {
  const site = "willhaben.at";
  const url = new URL(
    "https://www.willhaben.at/iad/kaufen-und-verkaufen/marktplatz"
  );
  url.searchParams.set("keyword", query);

  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });

  try {
    await waitForAnySelector(page, ["script#__NEXT_DATA__"], 15000);
  } catch (err) {
    console.warn(`[${site}] No results found for "${query}": ${err.message}`);
    return [];
  }

  const results = await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="search-result-entry-header"]');
    return Array.from(rows).map(row => {
      const titleEl = row.querySelector("h3");
      const title = titleEl ? titleEl.textContent.trim() : "";
      const linkEl = row.querySelector("a[href]");
      const url = linkEl ? (linkEl.href || "") : "";
      const priceEl = row.querySelector('[data-testid*="price"]');
      const price = priceEl ? priceEl.textContent.trim() : "N/A";
      const dateEl = row.querySelector('p[aria-label^="veröffentlicht"]');
      const dateText = dateEl ? dateEl.textContent.trim() : null;
      const imageEl = row.querySelector("img");
      const image = imageEl ? imageEl.src : null;

      return { title, price, url, id: url, image, date: dateText };
    }).filter(item => item.title && item.url);
  });

  return results.map((r) => ({
    ...r,
    site
  }));
};

module.exports = { scrapeWillhaben };
