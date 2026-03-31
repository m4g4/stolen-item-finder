const { waitForAnySelector } = require("./scrapeUtils");

const scrapeWillhaben = async (page, query) => {
  const site = "willhaben.at";
  const baseUrl = new URL(
    "https://www.willhaben.at/iad/kaufen-und-verkaufen/marktplatz"
  );
  baseUrl.searchParams.set("keyword", query);

  const selectors = {
    row: ['[data-testid^="search-result-entry-header"]', 'a[id^="search-result-entry-header"]'],
    nextPage: ["[data-testid='pagination-top-next-button']"]
  };

  const extractResults = async () => {
    return page.evaluate(() => {
      const rows = document.querySelectorAll('a[id^="search-result-entry-header"]');
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
  };

  const allResults = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = currentPage === 1 
      ? baseUrl.toString() 
      : `${baseUrl.toString()}&page=${currentPage}`;
    console.log(`[${site}] Scraping page ${currentPage}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await waitForAnySelector(page, [selectors.row], 15000);
    } catch (err) {
      console.warn(`[${site}] No results found on page ${currentPage}: ${err.message}`);
      if (currentPage === 1) {
        return { listings: [], error: `No results found: ${err.message}` };
      }
      break;
    }

    const results = await extractResults();
    allResults.push(...results.map((r) => ({
      ...r,
      site
    })));

    const nextPageEl = await page.$(selectors.nextPage.join(","));
    hasNextPage = !!nextPageEl;
    currentPage++;
  }

  console.log(`[${site}] Total results: ${allResults.length}`);

  return { listings: allResults };
};

module.exports = { scrapeWillhaben };
