const { waitForAnySelector, extractListings } = require("./scrapeUtils");

const scrollToLoadImages = async (page) => {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise(r => setTimeout(r, 1000));
};

const scrapeOlx = async (page, countryDomain, query) => {
  const site = `olx.${countryDomain}`;
  const slug = encodeURIComponent(query.trim()).replace(/%20/g, "-");
  const baseUrl = `https://www.olx.${countryDomain}/oferty/q-${slug}/`;

  const selectors = {
    row: ["[data-testid='l-card']", "[data-cy='l-card']"],
    title: [
      "div[data-testid='ad-card-title'] h4",
      "div[data-testid='ad-card-title'] a",
      "h4"
    ],
    link: ["div[data-testid='ad-card-title'] a", "a[href]"],
    price: ["p[data-testid='ad-price']", "[data-testid='ad-price']"],
    image: ["[data-testid='l-card'] > div > div[type='list'] > div[type='list'] > a img"],
    date: ["p[data-testid='location-date']"],
    nextPage: ["[data-testid='pagination-next']", "a[aria-label='Next page']", "a[rel='next']"]
  };

  const allResults = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;
    console.log(`[${site}] Scraping page ${currentPage}: ${url}`);
    
    await page.goto(url, { waitUntil: "domcontentloaded" });

    try {
      await waitForAnySelector(page, selectors.row, 15000);
      await scrollToLoadImages(page);
    } catch (err) {
      console.warn(`[${site}] No results found on page ${currentPage}: ${err.message}`);
      if (currentPage === 1) {
        return { listings: [], error: `No results found: ${err.message}` };
      }
      break;
    }

    const results = await extractListings(page, selectors);
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

module.exports = { scrapeOlx };
