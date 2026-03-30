const { waitForAnySelector, extractListings } = require("./scrapeUtils");

const scrapeOlx = async (page, countryDomain, query) => {
  const site = `olx.${countryDomain}`;
  const slug = encodeURIComponent(query.trim()).replace(/%20/g, "-");
  const url = `https://www.olx.${countryDomain}/oferty/q-${slug}/`;

  await page.goto(url, { waitUntil: "domcontentloaded" });

  const selectors = {
    row: ["[data-testid='l-card']", "[data-cy='l-card']"],
    title: [
      "div[data-testid='ad-card-title'] h4",
      "div[data-testid='ad-card-title'] a",
      "h4"
    ],
    link: ["div[data-testid='ad-card-title'] a", "a[href]"],
    price: ["p[data-testid='ad-price']", "[data-testid='ad-price']"],
    image: ["img"],
    date: ["p[data-testid='location-date']"]
  };

  try {
    await waitForAnySelector(page, selectors.row, 15000);
  } catch (err) {
    console.warn(`[${site}] No results found for "${query}": ${err.message}`);
    return [];
  }

  const results = await extractListings(page, selectors);

  return results.map((r) => ({
    ...r,
    site
  }));
};

module.exports = { scrapeOlx };
